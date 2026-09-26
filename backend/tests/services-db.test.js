import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import pg from 'pg';
import crypto from 'node:crypto';

console.warn = () => {};
console.error = () => {};

// Real-PostgreSQL checks for the communication/poll persistence SQL (column names,
// ON CONFLICT targets, schema-scoped search_path). Skipped without a test database.
test('Communication and poll persistence against PostgreSQL', { skip: !process.env.TEST_DATABASE_URL }, async t => {
  const url = new URL(process.env.TEST_DATABASE_URL);
  if (!url.pathname.endsWith('_regression') || !['localhost', '127.0.0.1'].includes(url.hostname)) {
    throw new Error('TEST_DATABASE_URL must point to a local dedicated *_regression database');
  }
  Object.assign(process.env, { DB_HOST: url.hostname, DB_PORT: url.port, DB_USER: decodeURIComponent(url.username),
    DB_PASSWORD: decodeURIComponent(url.password), DB_NAME: url.pathname.slice(1) });
  const schema = `svc_${crypto.randomUUID().replaceAll('-', '')}`;
  const admin = new pg.Client({ connectionString: url.href });
  await admin.connect();
  await admin.query(`CREATE SCHEMA ${schema}`);
  const { default: pool } = await import('../db.js');
  t.after(async () => { await pool.end(); await admin.query(`DROP SCHEMA ${schema} CASCADE`); await admin.end(); });

  const run = async sql => {
    const client = await pool.connect();
    try {
      await client.query(`SET search_path TO ${schema}`);
      return await client.query(sql);
    } finally {
      await client.query('RESET search_path');
      client.release();
    }
  };
  await run(`
    CREATE TABLE patients (patient_id UUID PRIMARY KEY, name TEXT, identifier TEXT, identifier_type TEXT, gender TEXT,
      birth_date DATE, phone TEXT, address TEXT);
    CREATE TABLE providers (provider_id UUID PRIMARY KEY, provider_name TEXT, nphies_id TEXT, provider_type TEXT, address TEXT,
      created_at TIMESTAMP DEFAULT NOW());
    CREATE TABLE insurers (insurer_id UUID PRIMARY KEY, insurer_name TEXT, nphies_id TEXT, address TEXT);
  `);
  for (const file of ['migrations/create_prior_authorization_tables.sql', 'migrations/create_claim_submissions_tables.sql',
    'migrations/032_nphies_communications.sql', 'migrations/052_add_communication_request_identifiers.sql',
    'migrations/055_add_advanced_auth_id_to_communications.sql', 'migrations/create_advanced_authorizations.sql',
    'migrations/053_create_poll_tables.sql']) {
    await run(await fs.readFile(new URL(`../${file}`, import.meta.url), 'utf8'));
  }

  const patientId = crypto.randomUUID(), providerId = crypto.randomUUID(), insurerId = crypto.randomUUID();
  await run(`
    INSERT INTO patients VALUES ('${patientId}', 'Synthetic Patient', '1000000001', 'national_id', 'male', '1990-01-01', NULL, NULL);
    INSERT INTO providers (provider_id, provider_name, nphies_id, provider_type) VALUES ('${providerId}', 'Prov', 'P1', '1');
    INSERT INTO insurers VALUES ('${insurerId}', 'Ins', 'I1', NULL);
  `);
  const claimId = (await run(`INSERT INTO claim_submissions (claim_number, claim_type, patient_id, provider_id, insurer_id, status)
    VALUES ('CLM-DB-1', 'professional', '${patientId}', '${providerId}', '${insurerId}', 'queued') RETURNING id`)).rows[0].id;

  const { default: messageUpdater } = await import('../services/messageUpdater.js');
  const { default: nphiesService } = await import('../services/nphiesService.js');
  const { default: claimCommunicationService } = await import('../services/claimCommunicationService.js');
  const { connectWithSchema, releaseSchemaClient } = await import('../services/dbSchema.js');

  await t.test('search_path is restored before a client returns to the pool', async () => {
    const before = (await pool.query('SHOW search_path')).rows[0].search_path;
    const client = await connectWithSchema(schema);
    assert.equal((await client.query('SHOW search_path')).rows[0].search_path, schema);
    await releaseSchemaClient(client);
    assert.equal((await pool.query('SHOW search_path')).rows[0].search_path, before);
  });

  await t.test('CommunicationRequest re-delivery is idempotent', async () => {
    const request = { resourceType: 'CommunicationRequest', id: 'cr-db-1', status: 'active',
      about: [{ type: 'Claim', identifier: { value: 'CLM-DB-1' } }], payload: [{ contentString: 'Need report' }] };
    const correlation = { table: 'claim_submissions', recordId: claimId };
    const first = await messageUpdater.storeCommunicationRequest(request, correlation, schema);
    const second = await messageUpdater.storeCommunicationRequest(request, correlation, schema);
    assert.equal(first.isNew, true);
    assert.equal(second.alreadyStored, true);
    assert.equal(second.id, first.newRecordId);
  });

  await t.test('Unsolicited claim communication is recorded, sent and finalized', async sub => {
    sub.mock.method(nphiesService, 'sendCommunication', async () => ({ success: true, status: 200,
      data: { resourceType: 'Bundle', entry: [{ resource: { resourceType: 'MessageHeader', id: 'resp-1', response: { code: 'ok' } } }] } }));
    const result = await claimCommunicationService.sendUnsolicitedCommunication(claimId,
      [{ contentType: 'string', contentString: 'Additional information' }], schema);
    assert.equal(result.success, true);
    const row = (await run(`SELECT * FROM nphies_communications WHERE id = ${result.communication.id}`)).rows[0];
    assert.equal(row.status, 'completed');
    assert.equal(row.acknowledgment_status, 'ok');
    assert.equal(row.claim_id, claimId);
    assert.ok(row.sent_at);
    assert.equal((await run(`SELECT COUNT(*) FROM nphies_communication_payloads WHERE communication_id = ${row.id}`)).rows[0].count, '1');

    // The acknowledgment path of the system poll updates this row using real columns.
    const ack = await messageUpdater.storeCommunication({ resourceType: 'Communication', id: 'ack-db-1', status: 'completed',
      inResponseTo: [{ reference: `Communication/${row.communication_id}` }] }, null, schema);
    assert.equal(ack.acknowledgment, true);
    // A payer-initiated Communication is stored as a new row.
    const inbound = await messageUpdater.storeCommunication({ resourceType: 'Communication', id: 'payer-db-1', status: 'completed',
      about: [{ reference: 'Claim/CLM-DB-1' }], payload: [{ contentString: 'FYI' }] }, { table: 'claim_submissions', recordId: claimId }, schema);
    assert.equal(inbound.isNew, true);
  });

  await t.test('Failed delivery keeps the outbound record', async sub => {
    sub.mock.method(nphiesService, 'sendCommunication', async () => ({ success: false, status: 400, data: null, error: 'rejected' }));
    const result = await claimCommunicationService.sendUnsolicitedCommunication(claimId, [], schema);
    assert.equal(result.success, false);
    const row = (await run(`SELECT status, request_bundle FROM nphies_communications WHERE id = ${result.communication.id}`)).rows[0];
    assert.equal(row.status, 'entered-in-error');
    assert.ok(row.request_bundle);
  });

  await t.test('Concurrent advanced-authorization saves create one row', async sub => {
    const { default: advancedAuthParser } = await import('../services/advancedAuthParser.js');
    sub.mock.method(advancedAuthParser, 'parseAdvancedAuthorization', () => ({ identifier_system: 'sys', identifier_value: 'AA-DB-1', status: 'active', response_bundle: { resourceType: 'ClaimResponse' } }));
    await Promise.all([1, 2, 3].map(() => messageUpdater.saveAdvancedAuthorization({}, null, null, schema)));
    assert.equal((await run(`SELECT COUNT(*) FROM advanced_authorizations WHERE identifier_value = 'AA-DB-1'`)).rows[0].count, '1');
  });

  await t.test('Claim status update keeps a zero benefit and marks unclear results pending', async () => {
    await messageUpdater.updateClaimSubmission(claimId, { resourceType: 'ClaimResponse', id: 'r-db', outcome: 'complete',
      disposition: 'Processed', total: [{ category: { coding: [{ code: 'benefit' }] }, amount: { value: 0 } }] }, null, schema);
    const row = (await run(`SELECT status, benefit_amount, adjudication_outcome FROM claim_submissions WHERE id = ${claimId}`)).rows[0];
    assert.equal(row.status, 'pending');
    assert.equal(Number(row.benefit_amount), 0);
    assert.equal(row.adjudication_outcome, null);
  });
});
