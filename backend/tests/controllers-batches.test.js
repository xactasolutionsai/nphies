import test from 'node:test';
import assert from 'node:assert/strict';
import pool from '../db.js';
import claimBatchesController from '../controllers/claimBatchesController.js';
import batchClaimMapper from '../services/claimMapper/BatchClaimMapper.js';
import nphiesService from '../services/nphiesService.js';

const response = () => ({
  statusCode: 200,
  status(code) { this.statusCode = code; return this; },
  json(body) { this.body = body; return this; }
});

function fakeDb(t, handlers) {
  const calls = [];
  const run = async (sql, params) => {
    calls.push({ sql: String(sql), params });
    for (const [pattern, result] of handlers) {
      if (pattern.test(sql)) return typeof result === 'function' ? result(sql, params) : result;
    }
    return { rows: [], rowCount: 0 };
  };
  t.mock.method(pool, 'query', run);
  t.mock.method(pool, 'connect', async () => ({ query: run, release() {} }));
  return calls;
}

const draftBatch = {
  id: 4, status: 'Draft', batch_identifier: 'B-4', provider_id: 'pr', insurer_id: 'i', submission_date: null,
  request_bundle: { item_ids: [1, 2] }, claims: [{}, {}]
};

test('Batch send is a guarded transition and a fresh batch gets no resubmit suffix', async t => {
  const calls = fakeDb(t, [[/SET status = 'Pending'/, { rows: [], rowCount: 0 }]]);
  t.mock.method(claimBatchesController, 'getByIdInternal', async () => ({ ...draftBatch }));
  const prepare = t.mock.method(claimBatchesController, 'prepareBatchBundleData', async () => ({}));
  t.mock.method(batchClaimMapper, 'buildBatchRequestBundle', () => ({}));
  const submit = t.mock.method(nphiesService, 'submitBatchClaim', async () => ({ success: true }));

  const res = response();
  await claimBatchesController.sendToNphies({ params: { id: '4' } }, res);

  assert.equal(res.statusCode, 409);
  assert.equal(submit.mock.callCount(), 0);
  assert.match(calls.find(c => /SET status = 'Pending'/.test(c.sql)).sql, /status IN \('Draft', 'Error'\)/);
  assert.equal(prepare.mock.calls[0].arguments[1], '');
  assert.ok(!calls.some(c => /SET status = 'Error'/.test(c.sql)), 'a refused reservation must not flip the batch to Error');
});

test('Batch send refuses items already submitted in another batch', async t => {
  fakeDb(t, [[/jsonb_array_elements_text/, { rows: [{ item_id: 1, batch_identifier: 'B-OTHER', status: 'Submitted' }] }]]);
  t.mock.method(claimBatchesController, 'getByIdInternal', async () => ({ ...draftBatch, status: 'Error' }));
  const submit = t.mock.method(nphiesService, 'submitBatchClaim', async () => ({ success: true }));
  const res = response();
  await claimBatchesController.sendToNphies({ params: { id: '4' } }, res);
  assert.equal(res.statusCode, 409);
  assert.equal(submit.mock.callCount(), 0);
});

test('Batch creation rejects items that are already in another active batch', async t => {
  fakeDb(t, [
    [/FROM prior_authorization_items pai\s+INNER JOIN/, { rows: [1, 2].map(id => ({
      id, adjudication_status: 'approved', auth_status: 'approved', insurer_id: 'i', provider_id: 'pr', auth_type: 'professional'
    })) }],
    [/jsonb_array_elements_text/, (sql, params) => {
      assert.match(sql, /NOT \(cb\.status = ANY/);
      assert.deepEqual(params[2], ['Rejected', 'Error']);
      return { rows: [{ item_id: 2, batch_identifier: 'B-1', status: 'Draft' }] };
    }]
  ]);
  const res = response();
  await claimBatchesController.createBatch({ body: { batch_identifier: 'B-2', claim_ids: [1, 2] } }, res);
  assert.equal(res.statusCode, 409);
  assert.match(res.body.error, /Item 2 \(B-1\)/);
});

test('Adding items checks approval and claim type', async t => {
  fakeDb(t, [
    [/SELECT \* FROM claim_batches WHERE id/, { rows: [{ ...draftBatch }] }],
    [/SELECT DISTINCT pa\.auth_type/, { rows: [{ auth_type: 'professional' }] }],
    [/FROM prior_authorization_items pai\s+INNER JOIN/, { rows: [{
      id: 3, adjudication_status: 'denied', auth_status: 'partial', insurer_id: 'i', provider_id: 'pr', auth_type: 'professional'
    }] }]
  ]);
  let res = response();
  await claimBatchesController.addClaimsToBatch({ params: { id: '4' }, body: { claim_ids: [3] } }, res);
  assert.equal(res.statusCode, 400);
  assert.match(res.body.error, /not approved/);

  fakeDb(t, [
    [/SELECT \* FROM claim_batches WHERE id/, { rows: [{ ...draftBatch }] }],
    [/SELECT DISTINCT pa\.auth_type/, { rows: [{ auth_type: 'professional' }] }],
    [/FROM prior_authorization_items pai\s+INNER JOIN/, { rows: [{
      id: 3, adjudication_status: 'approved', auth_status: 'approved', insurer_id: 'i', provider_id: 'pr', auth_type: 'pharmacy'
    }] }]
  ]);
  res = response();
  await claimBatchesController.addClaimsToBatch({ params: { id: '4' }, body: { claim_ids: [3] } }, res);
  assert.equal(res.statusCode, 400);
  assert.match(res.body.error, /this batch is professional/);
});

test('A failed batch poll is reported as a failure', async t => {
  fakeDb(t, [[/FROM providers/, { rows: [{ provider_id: 'pr' }] }]]);
  t.mock.method(claimBatchesController, 'getByIdInternal', async () => ({ ...draftBatch, status: 'Queued' }));
  t.mock.method(nphiesService, 'pollBatchClaimResponses', async () => ({ success: false, error: 'timeout' }));
  const res = response();
  await claimBatchesController.pollResponses({ params: { id: '4' } }, res);
  assert.equal(res.statusCode, 502);
  assert.equal(res.body.success, false);
});

test('Polled responses are de-duplicated per claim and statistics reach Processed', async t => {
  const calls = fakeDb(t, []);
  await claimBatchesController.processPolledClaimResponses(4, [
    { batchNumber: 1, outcome: 'complete', adjudicationOutcome: 'approved' }
  ], { request_bundle: { item_ids: [1, 2] }, response_bundle: { polledResponses: [{ batchNumber: 1, outcome: 'queued' }] } });
  const stored = JSON.parse(calls.find(c => /SET response_bundle/.test(c.sql)).params[0]);
  assert.equal(stored.polledResponses.length, 1);
  assert.equal(stored.polledResponses[0].outcome, 'complete');

  const batchNumber = n => ({ url: 'x/extension-batch-number', valuePositiveInt: n });
  const statsCalls = fakeDb(t, [[/SELECT response_bundle, total_claims/, { rows: [{
    total_claims: 2,
    response_bundle: {
      // Initial batch-response: both claims queued
      entry: [1, 2].map(n => ({ resource: { resourceType: 'ClaimResponse', outcome: 'queued', extension: [batchNumber(n)] } })),
      // Final polled responses (a repeat of claim 1 must not double count)
      polledResponses: [
        { batchNumber: 1, outcome: 'complete', adjudicationOutcome: 'approved' },
        { batchNumber: 2, outcome: 'complete', adjudicationOutcome: 'approved' }
      ]
    }
  }] }]]);
  await claimBatchesController.updateBatchStatistics(4);
  const update = statsCalls.find(c => /SET processed_claims/.test(c.sql));
  assert.deepEqual(update.params.slice(0, 4), [2, 2, 0, 'Processed']);
  // Error / Draft / Pending are never overwritten by a recalculation
  assert.match(update.sql, /CASE WHEN status IN \('Draft', 'Pending', 'Error'\) THEN status/);
});

test('Batch bundle uses the coverage selected on the prior authorization and never invents one', async t => {
  const calls = fakeDb(t, [
    [/FROM prior_authorization_items pai\s+INNER JOIN prior_authorizations pa ON pai\.prior_auth_id = pa\.id\s+LEFT JOIN patients/, { rows: [{
      id: 1, sequence: 1, request_number: 'PA-1', patient_id: 'p', insurer_id: 'i', selected_coverage_id: 'cov-selected', auth_id: 5
    }] }],
    [/FROM patient_coverage/, (sql, params) => ({ rows: params[0] === 'cov-selected' ? [{ coverage_id: 'cov-selected', member_id: 'M-1' }] : [] })]
  ]);
  const data = await claimBatchesController.getAuthItemDataForBundle(1);
  assert.equal(data.coverage.coverage_id, 'cov-selected');
  assert.equal(data.practitioner, undefined);
  assert.match(calls.find(c => /FROM patient_coverage/.test(c.sql)).sql, /coverage_id = \$1 AND patient_id = \$2 AND insurer_id = \$3/);

  fakeDb(t, [
    [/LEFT JOIN patients/, { rows: [{ id: 1, sequence: 1, request_number: 'PA-1', patient_id: 'p', insurer_id: 'i', auth_id: 5 }] }],
    [/FROM patient_coverage/, { rows: [] }]
  ]);
  await assert.rejects(claimBatchesController.getAuthItemDataForBundle(1), /coverage \(member id\) is required/);
});
