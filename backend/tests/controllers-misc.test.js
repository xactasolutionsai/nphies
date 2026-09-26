import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import express from 'express';
import pool from '../db.js';
import dentalApprovalsController from '../controllers/dentalApprovalsController.js';
import eyeApprovalsController from '../controllers/eyeApprovalsController.js';
import standardApprovalsController from '../controllers/standardApprovalsController.js';
import generalRequestsController from '../controllers/generalRequestsController.js';
import eligibilityController from '../controllers/eligibilityController.js';
import advancedAuthorizationsController from '../controllers/advancedAuthorizationsController.js';
import advancedAuthCommunicationService from '../services/advancedAuthCommunicationService.js';
import generalRequestValidationService from '../services/generalRequestValidationService.js';
import nphiesService from '../services/nphiesService.js';
import nphiesMapper from '../services/nphiesMapper.js';
import nphiesDataService from '../services/nphiesDataService.js';
import chatService from '../services/chatService.js';
import { streamChat } from '../controllers/chatController.js';
import coveragesRoutes from '../routes/coverages.js';
import claimSubmissionsRoutes from '../routes/claimSubmissions.js';
import dashboardRoutes from '../routes/dashboard.js';

const response = () => ({
  statusCode: 200,
  status(code) { this.statusCode = code; return this; },
  json(body) { this.body = body; return this; }
});

function fakeDb(t, handlers = []) {
  const calls = [];
  const run = async (sql, params = []) => {
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

async function serve(t, path, router) {
  const app = express();
  app.use(express.json());
  app.use(path, router);
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); }));
  return `http://127.0.0.1:${server.address().port}${path}`;
}

const highestPlaceholder = sql => Math.max(0, ...[...sql.matchAll(/\$(\d+)/g)].map(m => Number(m[1])));

test('Form list search/status count queries bind every placeholder they use', async t => {
  for (const controller of [dentalApprovalsController, eyeApprovalsController, standardApprovalsController, generalRequestsController]) {
    const calls = fakeDb(t, [[/COUNT\(\*\)/, { rows: [{ total: '0' }] }]]);
    const res = response();
    await controller.getAll({ query: { search: 'x', status: 'Draft' } }, res);
    assert.equal(res.statusCode, 200, JSON.stringify(res.body));
    for (const call of calls) assert.equal(highestPlaceholder(call.sql), call.params.length, call.sql);
  }
});

test('General request update keeps submitted_at and does not blank sections it was not sent', async t => {
  const submittedAt = new Date('2026-01-02T03:04:05Z');
  const calls = fakeDb(t, [[/SELECT id, status, submitted_at/, { rows: [{ id: 1, status: 'Submitted', submitted_at: submittedAt }] }],
    [/UPDATE general_requests/, { rows: [{ id: 1 }] }]]);
  t.mock.method(generalRequestValidationService, 'validateDiagnosisToScan', async () => { throw new Error('offline'); });
  const res = response();
  await generalRequestsController.update({ params: { id: '1' }, body: { patient: { name: 'Synthetic' } } }, res);
  assert.equal(res.statusCode, 200);
  const update = calls.find(c => /UPDATE general_requests/.test(c.sql));
  assert.match(update.sql, /patient_data = \$/);
  for (const untouched of ['service_data', 'management_items', 'medications', 'validation_results', 'patient_id']) {
    assert.ok(!update.sql.includes(`${untouched} =`), `${untouched} must not be overwritten`);
  }
  assert.ok(update.params.includes(submittedAt));
});

test('Dental/eye edits accept the joined provider_name_joined field returned by GET', async t => {
  for (const controller of [dentalApprovalsController, eyeApprovalsController]) {
    fakeDb(t, [[/FOR UPDATE|SELECT/, { rows: [] }]]);
    const res = response();
    await controller.update({ params: { id: '1' }, body: { provider_name_joined: 'Synthetic Clinic' } }, res);
    assert.ok(!/Unknown field/.test(res.body?.error || ''), JSON.stringify(res.body));
  }
});

test('Eye forms reject invalid JSON specs with 400 and no raw database text', async t => {
  fakeDb(t, []);
  const res = response();
  await eyeApprovalsController.create({ body: { right_eye_specs: '{not json' } }, res);
  assert.equal(res.statusCode, 400);
  assert.match(res.body.error, /right_eye_specs must be valid JSON/);

  fakeDb(t, [[/INSERT INTO/, () => { throw Object.assign(new Error('relation "secret_table" does not exist'), { code: '42P01' }); }]]);
  const failed = response();
  await standardApprovalsController.create({ body: {} }, failed);
  assert.ok(!JSON.stringify(failed.body).includes('secret_table'), JSON.stringify(failed.body));
});

test('Dynamic eligibility: a saved coverage must belong to the selected patient', async t => {
  const calls = fakeDb(t, [
    [/FROM patients WHERE patient_id/, { rows: [{ patient_id: 'patient-a', name: 'Synthetic' }] }],
    [/FROM insurers WHERE insurer_id/, { rows: [{ insurer_id: 'ins', nphies_id: '2000' }] }],
    [/FROM providers WHERE provider_id/, { rows: [{ provider_id: 'pr', nphies_id: '1000' }] }],
    [/FROM patient_coverage/, { rows: [] }]
  ]);
  const check = t.mock.method(nphiesService, 'checkEligibility', async () => ({ success: true, data: {} }));
  const res = response();
  await eligibilityController.checkDynamicEligibility({ body: { patientId: 'patient-a', insurerId: 'ins', providerId: 'pr', coverageId: 'cov-of-b' } }, res);
  assert.equal(res.statusCode, 404);
  assert.equal(check.mock.callCount(), 0);
  assert.deepEqual(calls.find(c => /FROM patient_coverage/.test(c.sql)).params, ['cov-of-b', 'patient-a']);

  const other = response();
  await eligibilityController.checkDynamicEligibility({ body: { patientData: { identifier: '1' }, insurerId: 'ins', providerId: 'pr', coverageId: 'cov-of-b' } }, other);
  assert.equal(other.statusCode, 400);
});

test('Dynamic eligibility: a new patient coverage is stored after the patient, with its id', async t => {
  fakeDb(t, [
    [/FROM insurers WHERE insurer_id/, { rows: [{ insurer_id: 'ins', nphies_id: '2000' }] }],
    [/FROM providers WHERE provider_id/, { rows: [{ provider_id: 'pr', nphies_id: '1000' }] }]
  ]);
  const order = [];
  t.mock.method(nphiesMapper, 'buildEligibilityRequestBundle', ({ coverage }) => { order.push(['bundle', coverage.member_id]); return {}; });
  t.mock.method(nphiesService, 'checkEligibility', async () => { order.push(['nphies']); return { success: true, data: {} }; });
  t.mock.method(nphiesMapper, 'parseEligibilityResponse', () => ({ success: true }));
  t.mock.method(nphiesDataService, 'upsertPatient', async () => { order.push(['patient']); return { patient_id: 'new-patient' }; });
  t.mock.method(nphiesDataService, 'upsertCoverage', async (data, patientId, insurerId) => {
    order.push(['coverage', patientId, insurerId]); return { coverage_id: 'cov-new' };
  });
  t.mock.method(nphiesDataService, 'processNphiesResponse', async () => ({}));
  t.mock.method(nphiesDataService, 'storeEligibilityResult', async () => ({ eligibilityId: 1 }));
  const res = response();
  await eligibilityController.checkDynamicEligibility({ body: {
    patientData: { identifier: '1', name: 'Synthetic' }, insurerId: 'ins', providerId: 'pr', coverageData: { memberId: 'M-1' }
  } }, res);
  assert.equal(res.statusCode, 200, JSON.stringify(res.body));
  assert.deepEqual(order, [['bundle', 'M-1'], ['nphies'], ['patient'], ['coverage', 'new-patient', 'ins']]);
});

test('Advanced authorization communications are scoped to their authorization; listing is bounded', async t => {
  t.mock.method(advancedAuthCommunicationService, 'getCommunication', async () => ({ id: 9, advanced_authorization_id: 2 }));
  let res = response();
  await advancedAuthorizationsController.getCommunicationById({ params: { id: '1', commId: '9' } }, res);
  assert.equal(res.statusCode, 404);
  res = response();
  await advancedAuthorizationsController.getCommunicationById({ params: { id: '2', commId: '9' } }, res);
  assert.equal(res.statusCode, 200);

  const calls = fakeDb(t, [[/COUNT\(\*\)/, { rows: [{ count: '0', total: '0' }] }]]);
  res = response();
  await advancedAuthorizationsController.getAll({ query: { limit: '100000', sort_order: ['ASC', 'DESC'] } }, res);
  assert.equal(res.statusCode, 200, JSON.stringify(res.body));
  const data = calls.find(c => /ORDER BY/.test(c.sql));
  assert.equal(data.params.at(-2), 100);
  assert.ok(!calls.some(c => /search_path/.test(c.sql)), 'no search_path switch without a tenant schema');
});

test('Advanced authorization save serializes concurrent polls of the same APA', async t => {
  const { default: advancedAuthParser } = await import('../services/advancedAuthParser.js');
  t.mock.method(advancedAuthParser, 'parseAdvancedAuthorization', () => ({ identifier_value: 'APA-1' }));
  const calls = fakeDb(t, [[/INSERT INTO advanced_authorizations/, { rows: [{ id: 1 }] }]]);
  await advancedAuthorizationsController.saveAdvancedAuth({}, undefined);
  const sql = calls.map(c => c.sql);
  assert.equal(sql[0], 'BEGIN');
  assert.match(sql[1], /pg_advisory_xact_lock/);
  assert.equal(sql.at(-1), 'COMMIT');
});

test('Chat stops consuming the model stream once the client disconnects', async t => {
  let produced = 0;
  t.mock.method(chatService, 'streamChat', async (message, mode, history, onChunk, onComplete, onError) => {
    assert.deepEqual(history, [{ role: 'user', content: 'hi' }]);
    try {
      for (let i = 0; i < 50; i++) { produced++; onChunk(`c${i}`); }
      onComplete('done');
    } catch (error) {
      onError(error);
    }
  });
  const res = new EventEmitter();
  res.writableEnded = false;
  res.writes = [];
  res.setHeader = () => {};
  res.status = () => res;
  res.json = () => res;
  res.write = chunk => {
    res.writes.push(chunk);
    if (res.writes.length === 2) res.emit('close'); // client goes away after the first chunk
    return true;
  };
  res.end = () => { res.writableEnded = true; };
  await streamChat({ body: { message: 'x', conversationHistory: [
    { role: 'system', content: 'mode switch' }, { role: 'user', content: 'hi' }, { role: 'assistant', content: '' }, 'junk'
  ] } }, res);
  assert.ok(produced <= 3, `generation continued after disconnect (${produced} chunks)`);
  assert.equal(res.writes.length, 2);
});

test('Coverages list: bad paging falls back, count is over the de-duplicated set, no raw errors', async t => {
  const calls = fakeDb(t, [[/SELECT COUNT\(\*\) FROM \(/, { rows: [{ count: '3' }] }]]);
  const base = await serve(t, '/api/coverages', coveragesRoutes);
  const result = await fetch(`${base}?limit=abc&offset=-5&search=x`);
  assert.equal(result.status, 200);
  const body = await result.json();
  assert.deepEqual([body.pagination.limit, body.pagination.offset, body.pagination.total], [100, 0, 3]);
  assert.match(calls.find(c => /SELECT COUNT/.test(c.sql)).sql, /DISTINCT ON/);

  fakeDb(t, [[/./, () => { throw new Error('relation "patient_coverage" does not exist'); }]]);
  const failed = await (await fetch(base)).json();
  assert.ok(!JSON.stringify(failed).includes('patient_coverage'));
});

test('Claim poll preview route builds the poll bundle without contacting NPHIES', async t => {
  fakeDb(t, [[/FROM claim_submissions cs/, { rows: [{ id: 5, claim_number: 'CLM-5', provider_name: 'Synthetic Clinic', provider_nphies_id: '1000', status: 'queued' }] }]]);
  const poll = t.mock.method(nphiesService, 'sendPoll', async () => ({ success: true }));
  const base = await serve(t, '/api/claim-submissions', claimSubmissionsRoutes);
  const result = await fetch(`${base}/5/poll/preview`);
  assert.equal(result.status, 200);
  const body = await result.json();
  assert.equal(body.bundle.resourceType, 'Bundle');
  assert.equal(body.metadata.claimNumber, 'CLM-5');
  assert.equal(poll.mock.callCount(), 0);
});

test('Dashboard survives a failing query and keeps local calendar dates', async t => {
  const local = new Date(2026, 0, 15); // local midnight, as pg returns DATE_TRUNC timestamps
  fakeDb(t, [
    [/prior_authorizations/, () => { throw new Error('relation missing'); }],
    [/DATE_TRUNC\('day', submission_date\)/, { rows: [{ date: local, claim_count: '2', claim_amount: '10' }] }],
    [/COUNT/, { rows: [{ total: '1' }] }]
  ]);
  const base = await serve(t, '/api/dashboard', dashboardRoutes);
  const stats = await fetch(`${base}/stats`);
  assert.equal(stats.status, 200);
  const comprehensive = await fetch(`${base}/comprehensive-stats`);
  assert.equal(comprehensive.status, 200);
  const body = await comprehensive.json();
  assert.equal(body.partial, true);
  assert.ok(body.failedSections.length > 0);
  assert.equal(body.data.timeSeries.daily[0].date, '2026-01-15');
});
