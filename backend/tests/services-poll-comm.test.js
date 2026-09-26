import test from 'node:test';
import assert from 'node:assert/strict';
import pool from '../db.js';
import nphiesService from '../services/nphiesService.js';
import messageUpdater, { mapClaimResponseStatus } from '../services/messageUpdater.js';
import messageCorrelator from '../services/messageCorrelator.js';
import systemPollService from '../services/systemPollService.js';
import claimCommunicationService from '../services/claimCommunicationService.js';
import communicationService from '../services/communicationService.js';
import advancedAuthCommunicationService from '../services/advancedAuthCommunicationService.js';
import advancedAuthParser from '../services/advancedAuthParser.js';
import { validateSchemaName, connectWithSchema, releaseSchemaClient } from '../services/dbSchema.js';

console.warn = () => {};
console.error = () => {};

// Synthetic demographics required by the Communication mapper.
const patientColumns = {
  patient_id: 'p-1', patient_identifier: '1000000001', patient_identifier_type: 'national_id',
  patient_name: 'Synthetic Patient', patient_gender: 'male', patient_birth_date: '1990-01-01',
  provider_id: 'prov-1', provider_name: 'Prov', insurer_id: 'ins-1', insurer_name: 'Ins'
};

/** Fake pooled client that records every statement and answers via `handler`. */
function fakeClient(handler = () => null) {
  const calls = [];
  const state = { inTransaction: false, released: 0 };
  const client = {
    async query(sql, params) {
      calls.push({ sql, params, inTransaction: state.inTransaction });
      if (sql === 'BEGIN') state.inTransaction = true;
      if (sql === 'COMMIT' || sql === 'ROLLBACK') state.inTransaction = false;
      return (await handler(sql, params)) || { rows: [], rowCount: 0 };
    },
    release() { state.released++; }
  };
  return { client, calls, state };
}

const claimResponse = (requestValue, extra = {}) => ({
  resourceType: 'ClaimResponse', id: `cr-${requestValue}`, outcome: 'complete',
  request: { identifier: { system: 'http://provider/identifiers/claim', value: requestValue } },
  extension: [{ url: 'http://nphies.sa/extension-adjudication-outcome', valueCodeableConcept: { coding: [{ code: 'approved' }] } }],
  total: [{ category: { coding: [{ code: 'benefit' }] }, amount: { value: 0 } }],
  ...extra
});
const messageBundle = (resource, header = {}) => ({
  resourceType: 'Bundle', type: 'message',
  entry: [{ resource: { resourceType: 'MessageHeader', id: 'mh', ...header } }, { resource }]
});

test('ClaimResponse status mapping never defaults to approved', () => {
  const unclear = mapClaimResponseStatus({ outcome: 'complete', disposition: 'Processed' });
  assert.equal(unclear.status, 'pending');
  assert.equal(unclear.adjudicationOutcome, null);
  assert.equal(unclear.needsReview, true);
  const notApproved = mapClaimResponseStatus({ outcome: 'complete', disposition: 'Request NOT approved' });
  assert.equal(notApproved.status, 'denied');
  assert.equal(notApproved.adjudicationOutcome, 'rejected');
  assert.equal(mapClaimResponseStatus({ outcome: 'complete', disposition: 'Approved' }).status, 'approved');
  assert.equal(mapClaimResponseStatus({ outcome: 'partial' }).status, 'partial');
  assert.equal(mapClaimResponseStatus({ outcome: 'error' }).status, 'error');
  assert.equal(mapClaimResponseStatus({ outcome: 'queued' }).status, 'queued');
  assert.equal(mapClaimResponseStatus(claimResponse('x', { outcome: 'complete' })).status, 'approved');
  const pended = mapClaimResponseStatus({ outcome: 'complete', extension: [{ url: 'x/extension-adjudication-outcome',
    valueCodeableConcept: { coding: [{ code: 'pended' }] } }] });
  assert.equal(pended.status, 'queued');
});

test('Claim system-poll update: partial and error outcomes are kept, not collapsed to pending', async t => {
  const updates = [];
  t.mock.method(pool, 'connect', async () => fakeClient((sql, params) => {
    if (sql.includes('UPDATE claim_submissions')) updates.push(params);
  }).client);
  await messageUpdater.updateClaimSubmission(1, { id: 'a', outcome: 'partial' }, null, 'public');
  await messageUpdater.updateClaimSubmission(1, { id: 'b', outcome: 'error' }, null, 'public');
  await messageUpdater.updateClaimSubmission(1, { id: 'c', outcome: 'complete', disposition: 'done' }, null, 'public');
  assert.deepEqual(updates.map(p => p[0]), ['partial', 'error', 'pending']);
});

test('Schema names are validated and set as a bind parameter, then reset', async t => {
  assert.throws(() => validateSchemaName('public; DROP TABLE users'));
  assert.throws(() => validateSchemaName('Public'));
  assert.equal(validateSchemaName(undefined), 'public');
  const fake = fakeClient();
  t.mock.method(pool, 'connect', async () => fake.client);
  const client = await connectWithSchema('tenant_1');
  await releaseSchemaClient(client);
  assert.deepEqual(fake.calls[0], { sql: "SELECT set_config('search_path', $1, false)", params: ['tenant_1'], inTransaction: false });
  assert.equal(fake.calls[1].sql, 'RESET search_path');
  assert.equal(fake.state.released, 1);
  await assert.rejects(() => claimCommunicationService.getCommunications(1, "x'; DROP TABLE y; --"), /Invalid schema name/);
});

test('Claim poll applies only its own ClaimResponse/CommunicationRequest and hands the rest to the system poll path', async t => {
  const fake = fakeClient(sql => {
    if (sql.includes('FROM claim_submissions cs')) {
      return { rows: [{ id: 7, claim_number: 'CLM-7', nphies_claim_id: null, nphies_request_id: 'REQ-7', provider_nphies_id: 'P1', provider_name: 'Prov' }] };
    }
    if (sql.includes('INSERT INTO nphies_communication_requests')) return { rows: [{ id: 99 }] };
  });
  t.mock.method(pool, 'connect', async () => fake.client);
  const own = claimResponse('CLM-7');
  const other = claimResponse('CLM-OTHER');
  const ownRequest = { resourceType: 'CommunicationRequest', id: 'req-own', about: [{ identifier: { value: 'CLM-7' } }] };
  const otherRequest = { resourceType: 'CommunicationRequest', id: 'req-other', about: [{ identifier: { value: 'PA-1' } }] };
  t.mock.method(nphiesService, 'sendPoll', async () => ({ success: true, data: { resourceType: 'Bundle', type: 'message', entry: [
    { resource: { resourceType: 'MessageHeader', id: 'outer' } },
    { resource: messageBundle(own) }, { resource: messageBundle(other) },
    { resource: messageBundle(ownRequest) }, { resource: messageBundle(otherRequest) }
  ] } }));
  let handedOver;
  t.mock.method(systemPollService, 'processForeignMessages', async messages => {
    handedOver = messages;
    return { processed: messages.length, matched: 1, unmatched: messages.length - 1, errors: [], pollLogId: 5 };
  });

  const result = await claimCommunicationService.pollForMessages(7, 'public');

  assert.equal(result.claimResponses.length, 1);
  assert.equal(result.claimResponses[0].id, own.id);
  assert.equal(result.communicationRequests.length, 1);
  assert.deepEqual(handedOver.map(m => m.resource.id), [other.id, otherRequest.id]);
  assert.equal(result.otherMessages.count, 2);
  const claimUpdates = fake.calls.filter(c => c.sql.includes('UPDATE claim_submissions'));
  assert.equal(claimUpdates.length, 1, 'another claim\'s response must not be written onto this claim');
  assert.equal(claimUpdates[0].params[5], 0, 'zero benefit is stored as 0');
  assert.ok(claimUpdates[0].inTransaction);
  assert.ok(fake.calls.every(c => !/SET search_path TO/.test(c.sql)));
});

test('Acknowledgment polling routes unrelated messages instead of dropping them', async t => {
  t.mock.method(pool, 'connect', async () => fakeClient(sql => {
    if (sql.includes('FROM nphies_communications c')) {
      return { rows: [{ communication_id: 'comm-1', acknowledgment_received: false, provider_nphies_id: 'P1' }] };
    }
  }).client);
  const ack = { resourceType: 'Communication', id: 'ack', status: 'completed', inResponseTo: [{ reference: 'Communication/comm-1' }] };
  const unrelated = claimResponse('CLM-9');
  t.mock.method(nphiesService, 'sendPoll', async () => ({ success: true, data: { resourceType: 'Bundle', entry: [
    { resource: messageBundle(ack) }, { resource: messageBundle(unrelated) }
  ] } }));
  let handedOver = [];
  t.mock.method(systemPollService, 'processForeignMessages', async messages => {
    handedOver = messages;
    return { processed: 1, matched: 1, unmatched: 0, errors: [], pollLogId: 1 };
  });
  const result = await claimCommunicationService.pollCommunicationAcknowledgment(3, 'comm-1', 'public');
  assert.equal(result.acknowledgmentFound, true);
  assert.deepEqual(handedOver.map(m => m.resource.id), [unrelated.id]);
});

test('pollAll releases its client before the per-communication polls', async t => {
  let open = 0;
  let maxOpen = 0;
  t.mock.method(pool, 'connect', async () => {
    open++; maxOpen = Math.max(maxOpen, open);
    const fake = fakeClient(sql => {
      if (sql.includes('SELECT c.communication_id')) return { rows: [{ communication_id: 'a' }, { communication_id: 'b' }] };
    });
    fake.client.release = () => { open--; };
    return fake.client;
  });
  t.mock.method(claimCommunicationService, 'pollCommunicationAcknowledgment', async () => {
    const client = await pool.connect();
    client.release();
    return { success: true, acknowledgmentFound: false };
  });
  const result = await claimCommunicationService.pollAllQueuedAcknowledgments(1, 'public');
  assert.equal(result.totalPolled, 2);
  assert.equal(maxOpen, 1);
});

test('Outbound communication is recorded before sending and no transaction is open during the send', async t => {
  const fake = fakeClient(sql => {
    if (sql.includes('FROM prior_authorizations pa')) {
      return { rows: [{ ...patientColumns, id: 4, request_number: 'PA-4', provider_nphies_id: 'P1', insurer_nphies_id: 'I1' }] };
    }
    if (sql.includes('INSERT INTO nphies_communications')) return { rows: [{ id: 11, communication_id: 'c', status: 'in-progress' }] };
    if (sql.includes('UPDATE nphies_communications')) return { rows: [{ id: 11, communication_id: 'c', status: 'completed', sent_at: 'now' }] };
  });
  t.mock.method(pool, 'connect', async () => fake.client);
  let sentWhile;
  t.mock.method(nphiesService, 'sendCommunication', async bundle => {
    sentWhile = {
      inserted: fake.calls.some(c => c.sql.includes('INSERT INTO nphies_communications')),
      openTransaction: fake.state.inTransaction,
      event: bundle.entry[0].resource.eventCoding.code
    };
    return { success: true, status: 200, data: { resourceType: 'Bundle', entry: [{ resource: { resourceType: 'MessageHeader', id: 'resp', response: { code: 'ok' } } }] } };
  });
  const result = await communicationService.sendUnsolicitedCommunication(4, [{ contentType: 'string', contentString: 'note' }], 'public');
  assert.deepEqual(sentWhile, { inserted: true, openTransaction: false, event: 'communication' });
  assert.equal(result.success, true);
  const update = fake.calls.find(c => c.sql.includes('UPDATE nphies_communications'));
  assert.equal(update.params[1], 'completed');
  assert.equal(update.params[3], 'ok');
});

test('Delivered message is not lost when saving the result fails', async t => {
  const fake = fakeClient(sql => {
    if (sql.includes('FROM claim_submissions cs')) return { rows: [{ ...patientColumns, id: 2, claim_number: 'CLM-2', provider_nphies_id: 'P1', insurer_nphies_id: 'I1' }] };
    if (sql.includes('INSERT INTO nphies_communications')) return { rows: [{ id: 21, communication_id: 'c2' }] };
    if (sql.includes('UPDATE nphies_communications')) throw new Error('db down');
  });
  t.mock.method(pool, 'connect', async () => fake.client);
  t.mock.method(nphiesService, 'sendCommunication', async () => ({ success: true, status: 200, data: null }));
  const result = await claimCommunicationService.sendUnsolicitedCommunication(2, [], 'public');
  assert.equal(result.success, true);
  assert.match(result.warning, /could not be saved/);
  const committedInsert = fake.calls.findIndex(c => c.sql.includes('INSERT INTO nphies_communications'));
  assert.ok(fake.calls.slice(committedInsert).some(c => c.sql === 'COMMIT'), 'outbound row was committed');
});

test('Advanced-auth Communication bundles use the communication event', async t => {
  t.mock.method(pool, 'connect', async () => fakeClient(sql => {
    if (sql.includes('FROM advanced_authorizations')) {
      const inner = { resourceType: 'Bundle', type: 'message', entry: [
        { resource: { resourceType: 'ClaimResponse', id: 'aa-cr' } },
        { resource: { resourceType: 'Patient', id: 'pat-1', gender: 'female', birthDate: '1985-05-05',
          name: [{ text: 'Synthetic Patient' }], identifier: [{ value: '1000000002', type: { coding: [{ code: 'NI' }] } }] } },
        { resource: { resourceType: 'Organization', id: 'org-prov', name: 'Prov', type: [{ coding: [{ code: 'prov' }] }],
          identifier: [{ system: 'http://nphies.sa/license/provider-license', value: 'P1' }] } },
        { resource: { resourceType: 'Organization', id: 'org-ins', name: 'Ins', type: [{ coding: [{ code: 'ins' }] }],
          identifier: [{ system: 'http://nphies.sa/license/payer-license', value: 'I1' }] } }
      ] };
      return { rows: [{ id: 1, identifier_value: 'AA-1', pre_auth_ref: 'REF', response_bundle: null, poll_response_bundle: inner }] };
    }
  }).client);
  const preview = await advancedAuthCommunicationService.previewCommunicationBundle(1, [{ contentType: 'string', contentString: 'x' }], 'unsolicited', null, 'public');
  const header = preview.bundle.entry.find(e => e.resource.resourceType === 'MessageHeader').resource;
  assert.equal(header.eventCoding.code, 'communication');
});

test('Identifier-only CommunicationRequest.about links the claim; alias does not shadow the FK', async t => {
  const fake = fakeClient((sql, params) => {
    if (sql.includes('FROM claim_submissions')) return { rows: params[0] === 'CLM-5' ? [{ id: 5 }] : [] };
    if (sql.includes('INSERT INTO nphies_communication_requests')) return { rows: [{ id: 1 }] };
  });
  const stored = await communicationService.storeCommunicationRequest(fake.client, 3, {
    resourceType: 'CommunicationRequest', id: 'cr-5', status: 'active',
    about: [{ type: 'Claim', identifier: { system: 'http://p/identifiers/claim', value: 'CLM-5' } }]
  });
  assert.equal(stored.claimId, 5);
  t.mock.method(pool, 'connect', async () => fake.client);
  await communicationService.getCommunicationRequests(3, 'public');
  const select = fake.calls.find(c => c.sql.includes('LEFT JOIN nphies_communications c'));
  assert.match(select.sql, /response_communication_uuid/);
  assert.doesNotMatch(select.sql, /as response_communication_id/);
});

test('Batch update is locked, deduplicated and never exceeds the batch size', async t => {
  const fake = fakeClient(sql => {
    if (sql.includes('FROM claim_batches')) {
      return { rows: [{ total_claims: 1, request_bundle: { item_ids: [70] }, response_bundle: { polledResponses: [
        { batchNumber: 1, nphiesClaimId: 'NC-1', outcome: 'complete', adjudicationOutcome: 'approved', approvedAmount: 10 }
      ] } }] };
    }
  });
  t.mock.method(pool, 'connect', async () => fake.client);
  const response = claimResponse('REQ-1', { identifier: [{ value: 'NC-1' }] });
  const result = await messageUpdater.updateClaimBatch(9, response, { batchNumber: 1 }, 'public');
  assert.equal(result.duplicate, true);
  const select = fake.calls.find(c => c.sql.includes('FROM claim_batches'));
  assert.match(select.sql, /FOR UPDATE/);
  assert.ok(select.inTransaction);
  const update = fake.calls.find(c => c.sql.includes('UPDATE claim_batches'));
  assert.equal(JSON.parse(update.params[0]).polledResponses.length, 1);
  assert.equal(update.params[2], 1);
  assert.equal(update.params[1], 'Processed');
});

test('Advanced authorization save is serialized with an advisory lock in a transaction', async t => {
  const fake = fakeClient(sql => {
    if (sql.includes('INSERT INTO advanced_authorizations')) return { rows: [{ id: 3 }] };
  });
  t.mock.method(pool, 'connect', async () => fake.client);
  t.mock.method(advancedAuthParser, 'parseAdvancedAuthorization', () => ({ identifier_value: 'AA-9' }));
  const result = await messageUpdater.saveAdvancedAuthorization({}, null, null, 'public');
  assert.equal(result.isNew, true);
  const lock = fake.calls.find(c => c.sql.includes('pg_advisory_xact_lock'));
  assert.ok(lock && lock.inTransaction);
  // Same lock key as the manual poll (advancedAuthorizationsController)
  assert.equal(lock.sql, 'SELECT pg_advisory_xact_lock(hashtextextended($1, 0))');
  assert.deepEqual(lock.params, ['advanced_authorizations:AA-9']);
  assert.ok(fake.calls.findIndex(c => c.sql.includes('pg_advisory_xact_lock')) < fake.calls.findIndex(c => c.sql.includes('SELECT id FROM advanced_authorizations')));
});

test('System poll stores acknowledgments on the original Communication using real columns', async t => {
  const fake = fakeClient(sql => {
    if (sql.includes('UPDATE nphies_communications')) return { rows: [{ id: 8, claim_id: 2 }] };
  });
  t.mock.method(pool, 'connect', async () => fake.client);
  const result = await messageUpdater.storeCommunication({ resourceType: 'Communication', id: 'ack-1', status: 'completed',
    inResponseTo: [{ reference: 'Communication/ours' }] }, null, 'public');
  assert.equal(result.acknowledgment, true);
  assert.equal(result.table, 'claim_submissions');
  assert.ok(fake.calls.every(c => !/communication_bundle|sent_date/.test(c.sql)));
});

test('Top-level PaymentReconciliation is processed as unsolicited in its own message context', async t => {
  const payment = { resourceType: 'PaymentReconciliation', id: 'pr-1' };
  const response = { resourceType: 'Bundle', type: 'message', entry: [
    { resource: { resourceType: 'MessageHeader', id: 'poll-resp', eventCoding: { code: 'poll-response' }, response: { identifier: 'our-poll', code: 'ok' } } },
    { fullUrl: 'urn:uuid:pr-1', resource: payment },
    { resource: { resourceType: 'Organization', id: 'org' } }
  ] };
  t.mock.method(messageCorrelator, 'handleNewInboundEvent', async () => ({ table: 'payment_reconciliations', isNew: true, strategy: 'new_payment_reconciliation' }));
  let stored;
  t.mock.method(messageUpdater, 'storePaymentReconciliation', async bundle => { stored = bundle; return { table: 'payment_reconciliations', recordId: 1, isNew: true }; });
  const correlate = t.mock.method(messageCorrelator, 'correlateToOutboundRequest', async () => null);
  t.mock.method(systemPollService, 'logPollMessage', async () => {});
  const result = await systemPollService.processResponseBundle(response, {}, 1, 'public');
  assert.equal(correlate.mock.callCount(), 0);
  assert.equal(result.messagesMatched, 1);
  assert.ok(!stored.entry.some(e => e.resource.resourceType === 'MessageHeader'));
  assert.ok(stored.entry.some(e => e.resource.resourceType === 'Organization'));
});

test('Poll log duration is recorded and a single log is scoped to the schema', async t => {
  const queries = [];
  t.mock.method(pool, 'query', async (sql, params) => { queries.push({ sql, params }); return { rows: [] }; });
  const startedAt = new Date(1000);
  await systemPollService.updatePollLog(1, { status: 'success', startedAt, completedAt: new Date(3500) });
  assert.equal(queries[0].params[10], 2500);
  assert.equal(await systemPollService.getPollLog(5, 'tenant_a'), null);
  assert.match(queries[1].sql, /schema_name = \$2/);
  assert.deepEqual(queries[1].params, [5, 'tenant_a']);
});
