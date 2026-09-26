import test from 'node:test';
import assert from 'node:assert/strict';
import pool from '../db.js';
import priorAuthorizationsController from '../controllers/priorAuthorizationsController.js';
import claimSubmissionsController from '../controllers/claimSubmissionsController.js';
import priorAuthMapper from '../services/priorAuthMapper/index.js';
import claimMapper from '../services/claimMapper/index.js';
import nphiesService from '../services/nphiesService.js';
import shadowBillingService from '../services/shadowBillingService.js';

const response = () => ({
  statusCode: 200,
  status(code) { this.statusCode = code; return this; },
  json(body) { this.body = body; return this; }
});

// Routes SQL to canned results; records every statement (also inside transactions).
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

const draftPa = { id: 1, status: 'draft', auth_type: 'professional', patient_id: 'p', provider_id: 'pr', insurer_id: 'i', coverage_id: null };
const entityRows = [
  [/SELECT \* FROM (patients|providers|insurers) WHERE/, { rows: [{ name: 'Synthetic' }] }],
  [/FROM patient_coverage/, { rows: [] }]
];

test('PA send: an exception after the pending reservation resets the record to error', async t => {
  const calls = fakeDb(t, [...entityRows, [/SET status = 'pending'/, { rows: [{ id: 1 }], rowCount: 1 }]]);
  t.mock.method(priorAuthorizationsController, 'getByIdInternal', async () => ({ ...draftPa }));
  t.mock.method(priorAuthMapper, 'buildPriorAuthRequestBundle', () => ({ resourceType: 'Bundle', entry: [] }));
  t.mock.method(nphiesService, 'submitPriorAuth', async () => { throw new Error('socket hang up'); });

  const res = response();
  await priorAuthorizationsController.sendToNphies({ params: { id: '1' } }, res);

  assert.equal(res.statusCode, 500);
  const reset = calls.find(c => /SET status = 'error'/.test(c.sql) && /status = 'pending'/.test(c.sql));
  assert.ok(reset, 'pending reservation must be released');
  assert.match(reset.params[0], /socket hang up/);
});

test('PA send: an OperationOutcome from NPHIES is stored as error (resendable), not denied', async t => {
  const calls = fakeDb(t, [...entityRows, [/SET status = 'pending'/, { rows: [{ id: 1 }], rowCount: 1 }]]);
  t.mock.method(priorAuthorizationsController, 'getByIdInternal', async () => ({ ...draftPa }));
  t.mock.method(priorAuthMapper, 'buildPriorAuthRequestBundle', () => ({ resourceType: 'Bundle', entry: [] }));
  t.mock.method(nphiesService, 'submitPriorAuth', async () => ({
    success: true,
    data: { resourceType: 'OperationOutcome', issue: [{ severity: 'error', code: 'invalid', details: { coding: [{ code: 'BV-1' }] } }] }
  }));

  const res = response();
  await priorAuthorizationsController.sendToNphies({ params: { id: '1' } }, res);

  const update = calls.find(c => /UPDATE prior_authorizations\s+SET status = \$1/.test(c.sql));
  assert.equal(update.params[0], 'error');
});

test('Claim send: partial adjudication is stored as partial with item adjudication and the ClaimResponse id', async t => {
  const calls = fakeDb(t, [...entityRows, [/SET status = 'pending'/, { rows: [{ id: 5 }], rowCount: 1 }]]);
  t.mock.method(claimSubmissionsController, 'getByIdInternal', async () => ({
    id: 5, status: 'draft', claim_type: 'professional', claim_number: 'CLM-1', patient_id: 'p', provider_id: 'pr', insurer_id: 'i'
  }));
  t.mock.method(claimMapper, 'buildClaimRequestBundle', () => ({ resourceType: 'Bundle', entry: [] }));
  t.mock.method(nphiesService, 'submitClaim', async () => ({
    success: true,
    data: {
      resourceType: 'Bundle', type: 'message',
      entry: [{ resource: {
        resourceType: 'ClaimResponse', id: 'cr-9', outcome: 'complete',
        identifier: [{ value: 'CR-IDENT' }],
        extension: [{ url: 'http://nphies.sa/extension-adjudication-outcome', valueCodeableConcept: { coding: [{ code: 'partial' }] } }],
        item: [{ itemSequence: 1, extension: [{ url: 'x/extension-adjudication-outcome', valueCodeableConcept: { coding: [{ code: 'rejected' }] } }] }]
      } }]
    }
  }));

  const res = response();
  await claimSubmissionsController.sendToNphies({ params: { id: '5' } }, res);

  const update = calls.find(c => /UPDATE claim_submissions SET status = \$1/.test(c.sql));
  assert.equal(update.params[0], 'partial');
  assert.equal(update.params[3], 'CR-IDENT', 'nphies_claim_id is the ClaimResponse identifier');
  assert.notEqual(update.params[4], update.params[3], 'nphies_response_id is not a copy of nphies_claim_id');
  assert.equal(update.params[7], 'partial');
  const item = calls.find(c => /UPDATE claim_submission_items/.test(c.sql));
  assert.equal(item.params[0], 'denied');
  assert.equal(res.body.nphiesResponse.nphiesClaimId, 'CR-IDENT');
});

test('Claim cancel refuses a never-sent draft without calling NPHIES', async t => {
  fakeDb(t, []);
  t.mock.method(claimSubmissionsController, 'getByIdInternal', async () => ({ id: 5, status: 'draft', claim_number: 'CLM-1' }));
  const cancel = t.mock.method(nphiesService, 'submitCancelRequest', async () => ({ success: true }));
  const res = response();
  await claimSubmissionsController.cancel({ params: { id: '5' }, body: { reason: 'WI' } }, res);
  assert.equal(res.statusCode, 400);
  assert.equal(cancel.mock.callCount(), 0);
});

test('Claim cancel targets the provider-side Claim.identifier that was submitted', async t => {
  fakeDb(t, [[/FROM providers/, { rows: [{ provider_name: 'Synthetic Clinic', nphies_id: '1000' }] }],
    [/FROM insurers/, { rows: [{ insurer_name: 'Synthetic Payer', nphies_id: '2000' }] }]]);
  const submitted = { system: 'http://syntheticclinic.com.sa/identifiers/claim', value: 'CLM-42' };
  t.mock.method(claimSubmissionsController, 'getByIdInternal', async () => ({
    id: 5, status: 'approved', claim_type: 'professional', claim_number: 'CLM-42', nphies_claim_id: 'CR-IDENT',
    nphies_request_id: 'clm-req-1', provider_id: 'pr', insurer_id: 'i',
    request_bundle: { entry: [{ resource: { resourceType: 'Claim', identifier: [submitted] } }] }
  }));
  let sentBundle;
  t.mock.method(nphiesService, 'submitCancelRequest', async bundle => { sentBundle = bundle; return { success: false, error: { message: 'stub' } }; });
  const res = response();
  await claimSubmissionsController.cancel({ params: { id: '5' }, body: { reason: 'WI' } }, res);
  const task = sentBundle.entry.find(e => e.resource.resourceType === 'Task').resource;
  assert.deepEqual(task.focus.identifier, submitted);
});

test('PA previewBundle never overwrites the request_bundle of a sent record', async t => {
  const calls = fakeDb(t, [...entityRows]);
  t.mock.method(priorAuthMapper, 'buildPriorAuthRequestBundle', () => ({ resourceType: 'Bundle', entry: [] }));
  const res = response();
  await priorAuthorizationsController.previewBundle({ body: { id: 1, patient_id: 'p', provider_id: 'pr', insurer_id: 'i' } }, res);
  const save = calls.find(c => /SET request_bundle = \$1/.test(c.sql));
  assert.match(save.sql, /status IN \('draft', 'error'\)/);
  assert.equal(res.body.savedToRecord, null);
});

test('PA update/transfer drafts never inherit response data and require an adjudicated source', async t => {
  const approved = {
    ...draftPa, status: 'approved', request_number: 'PA-1', pre_auth_ref: 'REF-1', outcome: 'complete',
    adjudication_outcome: 'approved', approved_amount: '90', pre_auth_period_start: '2026-01-01',
    nphies_response_id: 'resp', nphies_request_id: 'req', claim_response_status: 'active',
    created_at: new Date(), responses: [], items: [], supporting_info: [], diagnoses: [],
    attachments: [{ file_name: 'a.pdf', content_type: 'application/pdf', base64_content: 'AA==' }]
  };
  const calls = fakeDb(t, [
    [/INSERT INTO prior_authorizations/, { rows: [{ id: 2 }] }],
    [/FROM providers WHERE provider_id::text/, (sql, params) => ({ rows: params[0] === 'known' ? [{ provider_id: 'known' }] : [] })]
  ]);
  t.mock.method(shadowBillingService, 'processItems', async () => {});
  t.mock.method(priorAuthorizationsController, 'getByIdInternal', async id => (String(id) === '1' ? { ...approved } : { id }));

  let res = response();
  await priorAuthorizationsController.submitUpdate({ params: { id: '1' }, body: {} }, res);
  assert.equal(res.statusCode, 201);
  const insert = calls.find(c => /INSERT INTO prior_authorizations/.test(c.sql));
  const columns = insert.sql.match(/\(([^)]*)\)/)[1].split(',').map(s => s.trim());
  for (const leaked of ['outcome', 'adjudication_outcome', 'approved_amount', 'pre_auth_period_start',
    'nphies_response_id', 'nphies_request_id', 'claim_response_status', 'created_at', 'id']) {
    assert.ok(!columns.includes(leaked), `${leaked} must not be copied`);
  }
  assert.ok(columns.includes('is_update'));

  res = response();
  await priorAuthorizationsController.transfer({ params: { id: '1' }, body: { transfer_provider_id: 'unknown' } }, res);
  assert.equal(res.statusCode, 400);

  calls.length = 0;
  res = response();
  await priorAuthorizationsController.transfer({ params: { id: '1' }, body: { transfer_provider_id: 'known' } }, res);
  assert.equal(res.statusCode, 201);
  assert.ok(calls.some(c => /INSERT INTO prior_authorization_attachments/.test(c.sql)), 'attachments are copied on transfer');

  t.mock.method(priorAuthorizationsController, 'getByIdInternal', async () => ({ ...approved, status: 'draft' }));
  res = response();
  await priorAuthorizationsController.submitUpdate({ params: { id: '1' }, body: {} }, res);
  assert.equal(res.statusCode, 400);
});

test('Claim from PA: skips denied items, totals match billed items, accepts partial, blocks duplicates', async t => {
  let existingClaims = [];
  const calls = fakeDb(t, [
    [/FOR UPDATE/, { rows: [{ id: 5 }] }],
    [/FROM prior_authorizations pa\s+LEFT JOIN patients/, { rows: [{ id: 5, status: 'partial', auth_type: 'institutional', total_amount: '999', approved_amount: '1' }] }],
    [/FROM claim_submissions\s+WHERE prior_auth_id/, () => ({ rows: existingClaims })],
    [/FROM prior_authorization_items WHERE prior_auth_id/, { rows: [
      { id: 1, sequence: 1, net_amount: '100', adjudication_status: 'approved' },
      { id: 2, sequence: 2, net_amount: '50', adjudication_status: 'denied' },
      { id: 3, sequence: 3, net_amount: '30.5', adjudication_status: null }
    ] }],
    [/INSERT INTO claim_submissions/, { rows: [{ id: 9 }] }],
    [/INSERT INTO claim_submission_items/, { rows: [{ id: 1 }] }]
  ]);
  t.mock.method(shadowBillingService, 'processItems', async () => {});
  t.mock.method(claimSubmissionsController, 'getByIdInternal', async () => ({ id: 9 }));

  let res = response();
  await claimSubmissionsController.createFromPriorAuth({ params: { paId: '5' }, body: {} }, res);
  assert.equal(res.statusCode, 201, JSON.stringify(res.body));
  const header = calls.find(c => /INSERT INTO claim_submissions/.test(c.sql));
  const columns = header.sql.match(/\(([^)]*)\)/)[1].split(',').map(s => s.trim());
  assert.equal(header.params[columns.indexOf('total_amount')], 130.5);
  const items = calls.filter(c => /INSERT INTO claim_submission_items/.test(c.sql));
  assert.deepEqual(items.map(c => [c.params[1], c.params[17]]), [[1, '100'], [2, '30.5']]);

  existingClaims = [{ id: 3, claim_number: 'CLM-3', status: 'draft' }];
  res = response();
  await claimSubmissionsController.createFromPriorAuth({ params: { paId: '5' }, body: {} }, res);
  assert.equal(res.statusCode, 409);
});
