import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import pg from 'pg';
import crypto from 'node:crypto';
import { clinicalInput } from './fixtures/clinicalInput.js';

const response = () => ({ statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } });

test('Isolated PostgreSQL regression suite', { skip: !process.env.TEST_DATABASE_URL }, async t => {
  const url = new URL(process.env.TEST_DATABASE_URL);
  if (!url.pathname.endsWith('_regression') || !['localhost', '127.0.0.1'].includes(url.hostname)) {
    throw new Error('TEST_DATABASE_URL must point to a local dedicated *_regression database');
  }
  Object.assign(process.env, { DB_HOST: url.hostname, DB_PORT: url.port, DB_USER: decodeURIComponent(url.username),
    DB_PASSWORD: decodeURIComponent(url.password), DB_NAME: url.pathname.slice(1), JWT_SECRET: 'local-regression-secret-with-at-least-32-characters' });
  const schema = `review_${crypto.randomUUID().replaceAll('-', '')}`;
  const admin = new pg.Client({ connectionString: url.href });
  await admin.connect();
  await admin.query(`CREATE SCHEMA ${schema}`);
  const { default: pool, query } = await import('../db.js');
  pool.options.options = `-c search_path=${schema}`;
  t.after(async () => { await pool.end(); await admin.query(`DROP SCHEMA ${schema} CASCADE`); await admin.end(); });
  await query(`
    CREATE TABLE patients (patient_id UUID PRIMARY KEY, name TEXT, identifier TEXT, gender TEXT, birth_date DATE);
    CREATE TABLE providers (provider_id UUID PRIMARY KEY, provider_name TEXT, nphies_id TEXT, provider_type TEXT, type TEXT);
    CREATE TABLE insurers (insurer_id UUID PRIMARY KEY, insurer_name TEXT, nphies_id TEXT);
    CREATE TABLE patient_coverage (coverage_id UUID PRIMARY KEY, patient_id UUID REFERENCES patients, insurer_id UUID REFERENCES insurers,
      member_id TEXT, policy_number TEXT, is_active BOOLEAN DEFAULT true, created_at TIMESTAMP DEFAULT NOW());
    CREATE TABLE claims (claim_id UUID PRIMARY KEY, claim_number TEXT, patient_id UUID, provider_id UUID, insurer_id UUID, status TEXT, submission_date TIMESTAMP);
    CREATE TABLE authorizations (auth_id UUID PRIMARY KEY, patient_id UUID, provider_id UUID, insurer_id UUID, auth_status TEXT);
    CREATE TABLE payments (payment_id UUID PRIMARY KEY, insurer_id UUID, provider_id UUID, payment_ref TEXT, amount NUMERIC, payment_date DATE);
  `);
  const migrate = async file => query(await fs.readFile(new URL(`../${file}`, import.meta.url), 'utf8'));
  for (const file of ['migrations/048_create_users_table.sql', 'migrations/create_prior_authorization_tables.sql',
    'migrations/create_claim_submissions_tables.sql', 'migration_eye_approvals.sql', 'migration_dental_approvals.sql',
    'migrations/062_user_roles.sql', 'migrations/063_selected_coverage.sql']) await migrate(file);
  await query('ALTER TABLE claim_submissions ADD COLUMN outbound_message_header_id TEXT');
  await query('ALTER TABLE prior_authorizations ADD COLUMN outbound_message_header_id TEXT');
  const input = clinicalInput();
  await t.test('Common CRUD uses the real primary key and touches only the selected patient', async () => {
    const { queries } = await import('../db/queries.js');
    const first = crypto.randomUUID(), second = crypto.randomUUID();
    await query(queries.COMMON.INSERT('patients', ['patient_id','name']), [first, 'Synthetic first']);
    await query(queries.COMMON.INSERT('patients', ['patient_id','name']), [second, 'Synthetic second']);
    const updated = await query(queries.COMMON.UPDATE('patients', ['name']), ['Synthetic changed', first]);
    assert.equal(updated.rowCount, 1);
    assert.equal((await query(queries.COMMON.GET_BY_ID('patients'), [second])).rows[0].name, 'Synthetic second');
    assert.equal((await query(queries.COMMON.DELETE('patients'), [first])).rowCount, 1);
    assert.equal((await query(queries.COMMON.GET_ALL('patients'), [10,0])).rows.length, 1);
    await query(queries.COMMON.DELETE('patients'), [second]);
    for (const [table, key] of Object.entries({providers:'provider_id',insurers:'insurer_id',authorizations:'auth_id',
      eligibility:'eligibility_id',claims:'claim_id',payments:'payment_id',claim_batches:'id',prior_authorizations:'id'})) {
      assert.ok(queries.COMMON.DELETE(table).includes(`WHERE ${key} = $1`));
    }
  });
  await query('INSERT INTO patients VALUES ($1,$2,$3,$4,$5)', Object.values(input.patient).filter((_, i) => i !== 3));
  await query('INSERT INTO providers VALUES ($1,$2,$3,$4,$5)', Object.values(input.provider));
  await query('INSERT INTO insurers VALUES ($1,$2,$3)', Object.values(input.insurer));
  await query('INSERT INTO patient_coverage (coverage_id,patient_id,insurer_id,member_id,policy_number) VALUES ($1,$2,$3,$4,$5)',
    [input.coverage.coverage_id, input.patient.patient_id, input.insurer.insurer_id, 'SELECTED', 'POLICY-1']);

  await t.test('Role and coverage migrations are repeatable and preserve legacy references', async () => {
    await query("INSERT INTO prior_authorizations (request_number,auth_type,coverage_id) VALUES ('LEGACY','professional',123)");
    await migrate('migrations/062_user_roles.sql');
    await migrate('migrations/063_selected_coverage.sql');
    assert.equal((await query("SELECT coverage_id FROM prior_authorizations WHERE request_number='LEGACY'")).rows[0].coverage_id, 123);
  });

  await t.test('Search/count parameters execute in PostgreSQL', async () => {
    for (const name of ['claims', 'authorizations', 'payments']) {
      const { default: controller } = await import(`../controllers/${name}Controller.js`);
      const res = response();
      await controller.getAll({ query: { search: 'Test', ...(name === 'payments' ? {} : { status: 'draft' }) } }, res);
      assert.equal(res.statusCode, 200, JSON.stringify(res.body));
    }
  });

  const { default: eye } = await import('../controllers/eyeApprovalsController.js');
  await t.test('Failure restores both the parent and deleted child rows', async () => {
    const id = (await query("INSERT INTO eye_approvals (form_number,insured_name) VALUES ('EYE-1','Before') RETURNING id")).rows[0].id;
    await query("INSERT INTO eye_procedures(form_id,code,cost) VALUES ($1,'OLD',10)", [id]);
    const res = response();
    await eye.update({ params: { id }, body: { insured_name: 'After', procedures: [{ code: 'NEW', cost: 'invalid-number' }] } }, res);
    assert.equal(res.statusCode, 500);
    assert.equal((await query('SELECT insured_name FROM eye_approvals WHERE id=$1', [id])).rows[0].insured_name, 'Before');
    assert.equal((await query('SELECT code FROM eye_procedures WHERE form_id=$1', [id])).rows[0].code, 'OLD');
    const partial = response();
    await eye.update({ params: { id }, body: { insured_name: 'Changed safely' } }, partial);
    assert.equal(partial.statusCode, 200);
    assert.equal((await query('SELECT COUNT(*) FROM eye_procedures WHERE form_id=$1', [id])).rows[0].count, '1');
    const clear = response();
    await eye.update({ params: { id }, body: { procedures: [] } }, clear);
    assert.equal(clear.statusCode, 200);
    assert.equal((await query('SELECT COUNT(*) FROM eye_procedures WHERE form_id=$1', [id])).rows[0].count, '0');
  });

  const { default: claims } = await import('../controllers/claimSubmissionsController.js');
  // Keep the integration focused on writes and submission arbitration. Full mapper
  // output is independently compared against the pre-change golden fixtures.
  t.mock.method(claims, 'getByIdInternal', async id => {
    const row = (await query('SELECT *, selected_coverage_id AS coverage_id FROM claim_submissions WHERE id=$1', [id])).rows[0];
    return row ? { ...input.claim, ...row, items: [], supporting_info: [], diagnoses: [], attachments: [] } : null;
  });
  let claimId;
  await t.test('Selected policy is persisted and forged approval fields are ignored', async () => {
    const res = response();
    await claims.create({ body: { claim_type: 'professional', patient_id: input.patient.patient_id, provider_id: input.provider.provider_id,
      insurer_id: input.insurer.insurer_id, coverage_id: input.coverage.coverage_id, status: 'approved', approved_amount: 999 }, params: {} }, res);
    assert.equal(res.statusCode, 201, JSON.stringify(res.body));
    claimId = res.body.data.id;
    const row = (await query('SELECT * FROM claim_submissions WHERE id=$1', [claimId])).rows[0];
    assert.equal(row.status, 'draft');
    assert.equal(row.approved_amount, null);
    assert.equal(row.selected_coverage_id, input.coverage.coverage_id);
    const bad = response();
    await claims.update({ params: { id: claimId }, body: { coverage_id: '99999999-9999-4999-8999-999999999999' } }, bad);
    assert.equal(bad.statusCode, 400);
    assert.equal((await query('SELECT selected_coverage_id FROM claim_submissions WHERE id=$1', [claimId])).rows[0].selected_coverage_id, input.coverage.coverage_id);
  });

  const { default: priorAuth } = await import('../controllers/priorAuthorizationsController.js');
  const readPA = async id => {
    const row = (await query('SELECT *, selected_coverage_id AS coverage_id FROM prior_authorizations WHERE id=$1', [id])).rows[0];
    return row ? { ...input.priorAuth, ...row, items: [], supporting_info: [], diagnoses: [], attachments: [] } : null;
  };
  t.mock.method(priorAuth, 'getByIdInternal', readPA);
  let paId;
  await t.test('Prior authorization saves the selected policy and accepts partial edits', async () => {
    const res = response();
    await priorAuth.create({ params: {}, body: { auth_type: 'professional', patient_id: input.patient.patient_id,
      provider_id: input.provider.provider_id, insurer_id: input.insurer.insurer_id, coverage_id: input.coverage.coverage_id } }, res);
    assert.equal(res.statusCode, 201, JSON.stringify(res.body));
    paId = res.body.data.id;
    assert.equal(res.body.data.coverage_id, input.coverage.coverage_id);
    const partial = response();
    await priorAuth.update({ params: { id: paId }, body: { priority: 'normal' } }, partial);
    assert.equal(partial.statusCode, 200, JSON.stringify(partial.body));
    assert.equal(partial.body.data.coverage_id, input.coverage.coverage_id);
  });

  for (const [name, controller, id, method] of [['claim', claims, claimId, 'submitClaim'], ['prior auth', priorAuth, paId, 'submitPriorAuth']]) {
    await t.test(`Concurrent ${name} sends with both reads seeing draft make only one upstream call`, { timeout: 5000 }, async sub => {
      const { default: service } = await import('../services/nphiesService.js');
      let releaseReads;
      const bothRead = new Promise(resolve => { releaseReads = resolve; });
      const readRecord = controller.getByIdInternal.bind(controller);
      let reads = 0;
      sub.mock.method(controller, 'getByIdInternal', async recordId => {
        const row = await readRecord(recordId);
        if (++reads <= 2) { if (reads === 2) releaseReads(); await bothRead; }
        return row;
      });
      let finish;
      const waiting = new Promise(resolve => { finish = resolve; });
      sub.after(() => finish());
      const sender = sub.mock.method(service, method, async () => {
        await waiting;
        return { success: false, error: { message: 'Simulated upstream failure' } };
      });
      const first = response(), second = response();
      const requests = [controller.sendToNphies({ params: { id } }, first), controller.sendToNphies({ params: { id } }, second)];
      await Promise.race(requests); // Losing reservation returns before the upstream call is released.
      assert.ok([first.statusCode, second.statusCode].includes(409));
      finish();
      await Promise.all(requests);
      assert.equal(sender.mock.callCount(), 1);
      assert.deepEqual([first.statusCode, second.statusCode].sort(), [409, 502]);
    });
  }
});
