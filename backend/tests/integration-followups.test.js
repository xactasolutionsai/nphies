// Regression tests for the backend integration follow-ups (practitioner, roles,
// identifier systems, schema handling, response viewer, chat abort, scripts, docs).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { EventEmitter } from 'node:events';
import jwt from 'jsonwebtoken';
import pool from '../db.js';
import app from '../server.js';
import { getJwtSecret } from '../config/auth.js';
import priorAuthorizationsController from '../controllers/priorAuthorizationsController.js';
import claimSubmissionsController from '../controllers/claimSubmissionsController.js';
import claimBatchesController from '../controllers/claimBatchesController.js';
import advancedAuthorizationsController from '../controllers/advancedAuthorizationsController.js';
import systemPollController from '../controllers/systemPollController.js';
import responseViewerController from '../controllers/responseViewerController.js';
import patientsController from '../controllers/patientsController.js';
import usersController from '../controllers/usersController.js';
import authController from '../controllers/authController.js';
import { connectForSchema, releaseSchemaClient } from '../controllers/controllerHelpers.js';
import { requiredRoleFor } from '../middleware/requireRole.js';
import { validationSchemas } from '../models/schema.js';
import { validateClaimInput } from '../models/claimInput.js';
import priorAuthMapper from '../services/priorAuthMapper/index.js';
import { getClaimMapper } from '../services/claimMapper/index.js';
import batchClaimMapper from '../services/claimMapper/BatchClaimMapper.js';
import nphiesService from '../services/nphiesService.js';
import claimCommunicationService from '../services/claimCommunicationService.js';
import systemPollService from '../services/systemPollService.js';
import paymentReconciliationService from '../services/paymentReconciliationService.js';
import chatService from '../services/chatService.js';
import ragService from '../services/ragService.js';
import { streamChat } from '../controllers/chatController.js';
import { queries } from '../db/queries.js';
import MedicineImporter from '../scripts/importMedicines.js';
import { embeddingRunSummary } from '../scripts/seedMedicalKnowledge.js';
import { setUserRole, parseSetUserRoleArgs } from '../scripts/setUserRole.js';
import { clinicalInput } from './fixtures/clinicalInput.js';

const backendDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

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

const resource = (bundle, type) => bundle.entry.find(e => e.resource?.resourceType === type)?.resource;

const PRACTITIONER_COLUMNS = {
  practitioner_license: 'LIC-SYN-1', practitioner_name: 'Synthetic Practitioner',
  practitioner_specialty_code: '08.00', practitioner_identifier_type: 'MD'
};
const PRACTITIONER = { license_number: 'LIC-SYN-1', name: 'Synthetic Practitioner', specialty_code: '08.00', identifier_type: 'MD' };

/** Entity lookups for the send/preview paths, answered from the synthetic fixture. */
function entityHandlers(data) {
  return [
    [/FROM patients WHERE patient_id/, { rows: [data.patient] }],
    [/FROM providers WHERE provider_id/, { rows: [data.provider] }],
    [/FROM insurers WHERE insurer_id/, { rows: [data.insurer] }],
    [/FROM patient_coverage/, { rows: [data.coverage] }]
  ];
}

function recordWithoutEmbeddedPractitioner(record, withColumns) {
  const copy = { ...record };
  delete copy.practitioner;
  return withColumns ? { ...copy, ...PRACTITIONER_COLUMNS } : copy;
}

// ---------------------------------------------------------------------------
// 1. Practitioner
// ---------------------------------------------------------------------------

test('Practitioner: PA send builds the Practitioner from the stored practitioner_* columns', async t => {
  const data = clinicalInput('professional');
  const calls = fakeDb(t, [...entityHandlers(data), [/SET status = 'pending'/, { rows: [{ id: 1 }], rowCount: 1 }]]);
  t.mock.method(priorAuthorizationsController, 'getByIdInternal', async () => recordWithoutEmbeddedPractitioner(data.priorAuth, true));
  let sent;
  t.mock.method(nphiesService, 'submitPriorAuth', async bundle => { sent = bundle; return { success: false, error: { message: 'stub' } }; });
  const res = response();
  await priorAuthorizationsController.sendToNphies({ params: { id: '1' } }, res);
  assert.ok(sent, JSON.stringify(res.body));
  const practitioner = resource(sent, 'Practitioner');
  assert.equal(practitioner.identifier[0].value, 'LIC-SYN-1');
  assert.equal(practitioner.name[0].text, 'Synthetic Practitioner');
  assert.ok(calls.some(c => /SET status = 'pending'/.test(c.sql)));
});

test('Practitioner: a PA without a practitioner gets 400 with the mapper message and is never reserved', async t => {
  const data = clinicalInput('professional');
  const calls = fakeDb(t, [...entityHandlers(data), [/SET status = 'pending'/, { rows: [{ id: 1 }], rowCount: 1 }]]);
  t.mock.method(priorAuthorizationsController, 'getByIdInternal', async () => recordWithoutEmbeddedPractitioner(data.priorAuth, false));
  const submit = t.mock.method(nphiesService, 'submitPriorAuth', async () => ({ success: true }));
  const res = response();
  await priorAuthorizationsController.sendToNphies({ params: { id: '1' } }, res);
  assert.equal(res.statusCode, 400);
  assert.match(res.body.error, /Practitioner license/);
  assert.equal(submit.mock.callCount(), 0);
  assert.ok(!calls.some(c => /SET status = 'pending'/.test(c.sql)), 'no pending reservation before mapping succeeds');
});

test('Practitioner: claim send passes the stored practitioner; missing practitioner is a 400', async t => {
  const data = clinicalInput('professional');
  const claim = { ...recordWithoutEmbeddedPractitioner(data.claim, true), coverage_id: null };
  const calls = fakeDb(t, [...entityHandlers(data), [/SET status = 'pending'/, { rows: [{ id: 1 }], rowCount: 1 }]]);
  t.mock.method(claimSubmissionsController, 'getByIdInternal', async () => ({ ...claim }));
  let sent;
  t.mock.method(nphiesService, 'submitClaim', async bundle => { sent = bundle; return { success: false, error: { message: 'stub' } }; });
  await claimSubmissionsController.sendToNphies({ params: { id: '1' } }, response());
  assert.equal(resource(sent, 'Practitioner').identifier[0].value, 'LIC-SYN-1');

  calls.length = 0;
  const bare = { ...recordWithoutEmbeddedPractitioner(data.claim, false), coverage_id: null };
  claimSubmissionsController.getByIdInternal.mock.mockImplementation(async () => ({ ...bare }));
  const res = response();
  await claimSubmissionsController.sendToNphies({ params: { id: '1' } }, res);
  assert.equal(res.statusCode, 400);
  assert.match(res.body.error, /Practitioner license/);
  assert.ok(!calls.some(c => /SET status = 'pending'/.test(c.sql)));
});

test('Practitioner: PA and claim previews use the practitioner fields from the form', async t => {
  const data = clinicalInput('professional');
  fakeDb(t, entityHandlers(data));
  const body = { ...recordWithoutEmbeddedPractitioner(data.priorAuth, true), id: undefined, coverage_id: undefined };
  const paRes = response();
  await priorAuthorizationsController.previewBundle({ body }, paRes);
  assert.equal(resource(paRes.body.fhirBundle, 'Practitioner').identifier[0].value, 'LIC-SYN-1', JSON.stringify(paRes.body));
  // The claim preview takes narratives from supporting_info rows; only the practitioner hand-off is checked here.
  const build = t.mock.method(getClaimMapper('professional'), 'buildClaimRequestBundle', () => ({ resourceType: 'Bundle', entry: [] }));
  const claimRes = response();
  await claimSubmissionsController.previewBundle({ body: { ...body, claim_type: 'professional' } }, claimRes);
  assert.equal(claimRes.statusCode, 200, JSON.stringify(claimRes.body));
  assert.deepEqual(build.mock.calls[0].arguments[0].practitioner, PRACTITIONER);
});

test('Practitioner: fields are accepted on create/update and returned by the PA detail query', async t => {
  const paResult = validationSchemas.priorAuthorization.validate({ auth_type: 'professional', ...PRACTITIONER_COLUMNS });
  assert.equal(paResult.error, undefined);
  assert.deepEqual(validateClaimInput({ claim_type: 'professional', ...PRACTITIONER_COLUMNS }).practitioner_license, 'LIC-SYN-1');
  assert.ok(validationSchemas.priorAuthorization.validate({ auth_type: 'professional', practitioner_license: 'x'.repeat(51) }).error);
  const calls = fakeDb(t);
  await priorAuthorizationsController.getByIdInternal(1);
  for (const column of Object.keys(PRACTITIONER_COLUMNS)) assert.match(calls[0].sql, new RegExp(`pa\\.${column}`));
});

test('Practitioner: a claim created from a PA copies the practitioner columns', async t => {
  const calls = fakeDb(t, [
    [/FOR UPDATE/, { rows: [{ id: 7 }] }],
    [/SELECT pa\.\*/, { rows: [{ id: 7, status: 'approved', auth_type: 'professional', patient_id: 'p', provider_id: 'pr', insurer_id: 'i', total_amount: 10, ...PRACTITIONER_COLUMNS }] }],
    [/INSERT INTO claim_submissions/, { rows: [{ id: 9 }] }]
  ]);
  t.mock.method(claimSubmissionsController, 'getByIdInternal', async () => ({ id: 9 }));
  const res = response();
  await claimSubmissionsController.createFromPriorAuth({ params: { paId: '7' }, body: {} }, res);
  const insert = calls.find(c => /INSERT INTO claim_submissions/.test(c.sql));
  const columns = insert.sql.match(/\(([^)]*)\)/)[1].split(',').map(s => s.trim());
  for (const [column, value] of Object.entries(PRACTITIONER_COLUMNS)) assert.equal(insert.params[columns.indexOf(column)], value, column);
});

test('Practitioner: batch claims use the practitioner of their prior authorization', async t => {
  const calls = fakeDb(t, [
    [/LEFT JOIN patients/, { rows: [{ id: 1, sequence: 1, request_number: 'PA-1', patient_id: 'p', insurer_id: 'i', selected_coverage_id: 'c', auth_id: 5, ...PRACTITIONER_COLUMNS }] }],
    [/FROM patient_coverage/, { rows: [{ coverage_id: 'c', member_id: 'M-1' }] }]
  ]);
  const data = await claimBatchesController.getAuthItemDataForBundle(1);
  assert.deepEqual(data.practitioner, PRACTITIONER);
  const select = calls[0].sql;
  for (const column of Object.keys(PRACTITIONER_COLUMNS)) assert.match(select, new RegExp(`pa\\.${column}`));
});

// ---------------------------------------------------------------------------
// 2. Roles
// ---------------------------------------------------------------------------

test('Roles: operations map to the least role allowed to perform them', () => {
  for (const [method, url, role] of [
    ['GET', '/prior-authorizations', 'viewer'], ['GET', '/claim-submissions/1', 'viewer'],
    ['POST', '/prior-authorizations/preview', 'reviewer'], ['POST', '/claim-submissions/5/communication/preview', 'reviewer'],
    ['POST', '/ai-validation/validate-prior-auth', 'reviewer'], ['POST', '/medication-safety/analyze', 'reviewer'],
    ['POST', '/general-request/validate', 'reviewer'], ['POST', '/chat/stream', 'reviewer'], ['POST', '/openmed/analyze', 'reviewer'],
    ['POST', '/prior-authorizations', 'submitter'], ['PUT', '/claim-submissions/1', 'submitter'],
    ['POST', '/prior-authorizations/1/send', 'submitter'], ['POST', '/claim-submissions/1/cancel', 'submitter'],
    ['POST', '/general-requests', 'submitter'], ['POST', '/prior-authorizations/previews', 'submitter'],
    ['DELETE', '/patients/1', 'admin'], ['POST', '/system-poll/trigger', 'admin'], ['GET', '/users', 'admin']
  ]) assert.equal(requiredRoleFor(method, url), role, `${method} ${url}`);
});

async function startServer(t) {
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); }));
  return `http://127.0.0.1:${server.address().port}`;
}

test('Roles: viewer, reviewer, submitter, legacy user and admin get exactly their operations', async t => {
  const base = await startServer(t);
  let role = 'viewer';
  t.mock.method(pool, 'query', async sql => {
    if (sql.includes('FROM users WHERE id')) return { rows: [{ id: 1, email: 'someone@example.test', role }] };
    if (sql.includes('COUNT(')) return { rows: [{ total: '0', count: '0' }] };
    return { rows: [], rowCount: 0 };
  });
  t.mock.method(pool, 'connect', async () => ({ query: pool.query, release() {} }));
  const headers = { Authorization: `Bearer ${jwt.sign({ userId: 1 }, getJwtSecret())}`, 'Content-Type': 'application/json' };
  const call = (method, url) => fetch(base + url, { method, headers, body: method === 'GET' || method === 'DELETE' ? undefined : '{}' });
  const expectForbidden = async (method, url, requiredRole) => {
    const res = await call(method, url);
    assert.equal(res.status, 403, `${role} ${method} ${url}`);
    assert.deepEqual(await res.json(), { error: 'forbidden', requiredRole });
  };
  const expectAllowed = async (method, url) => {
    const res = await call(method, url);
    assert.notEqual(res.status, 403, `${role} ${method} ${url}`);
    assert.notEqual(res.status, 401, `${role} ${method} ${url}`);
  };

  role = 'viewer';
  assert.equal((await call('GET', '/api/patients')).status, 200);
  await expectForbidden('POST', '/api/prior-authorizations/preview', 'reviewer');
  await expectForbidden('POST', '/api/prior-authorizations', 'submitter');
  await expectForbidden('DELETE', '/api/patients/00000000-0000-4000-8000-000000000001', 'admin');

  role = 'reviewer';
  await expectAllowed('POST', '/api/prior-authorizations/preview');
  await expectAllowed('POST', '/api/general-request/validate');
  await expectForbidden('POST', '/api/prior-authorizations/1/send', 'submitter');
  await expectForbidden('PUT', '/api/patients/00000000-0000-4000-8000-000000000001', 'submitter');

  for (role of ['submitter', 'user']) {
    await expectAllowed('POST', '/api/prior-authorizations/1/send');
    await expectAllowed('POST', '/api/prior-authorizations/preview');
    await expectForbidden('DELETE', '/api/prior-authorizations/1', 'admin');
    await expectForbidden('GET', '/api/users', 'admin');
  }

  role = 'admin';
  await expectAllowed('DELETE', '/api/prior-authorizations/1');
  await expectAllowed('GET', '/api/users');
  for (const method of ['PUT', 'PATCH']) {
    const res = await fetch(`${base}/api/users/2/role`, { method, headers, body: JSON.stringify({ role: 'superuser' }) });
    assert.equal(res.status, 400, `${method} /api/users/:id/role reaches the role validation`);
  }

  role = 'unknown-role';
  await expectForbidden('GET', '/api/patients', 'viewer');
});

test('Roles: an administrator can change another user\'s role, with validation', async t => {
  const calls = fakeDb(t, [[/UPDATE users SET role/, (sql, params) => params[1] === 2
    ? { rows: [{ id: 2, email: 'b@example.test', role: params[0] }], rowCount: 1 } : { rows: [], rowCount: 0 }]]);
  const admin = { id: 1, role: 'admin' };
  const run = async (params, body, user = admin) => { const res = response(); await usersController.updateRole({ params, body, user }, res); return res; };

  const ok = await run({ id: '2' }, { role: 'reviewer' });
  assert.equal(ok.statusCode, 200);
  assert.equal(ok.body.data.role, 'reviewer');
  assert.deepEqual(calls.at(-1).params, ['reviewer', 2]);
  assert.equal((await run({ id: '2' }, { role: 'superuser' })).statusCode, 400);
  assert.equal((await run({ id: '2' }, {})).statusCode, 400);
  assert.equal((await run({ id: 'abc' }, { role: 'viewer' })).statusCode, 400);
  assert.equal((await run({ id: '1' }, { role: 'viewer' })).statusCode, 400, 'an admin cannot demote themselves');
  assert.equal((await run({ id: '99' }, { role: 'viewer' })).statusCode, 404);
  assert.equal((await run({ id: '2' }, { role: 'viewer' }, { id: 5, role: 'submitter' })).statusCode, 403);
});

test('Roles: setUserRole script validates arguments and updates only an existing user', async () => {
  assert.throws(() => parseSetUserRoleArgs(['node', 'setUserRole.js']), /Usage/);
  assert.throws(() => parseSetUserRoleArgs(['node', 'setUserRole.js', 'a@example.test', 'root']), /Role must be one of/);
  assert.deepEqual(parseSetUserRoleArgs(['node', 's', ' A@Example.Test ', 'Reviewer']), { email: 'a@example.test', role: 'reviewer' });
  const seen = [];
  await setUserRole('a@example.test', 'viewer', async (sql, params) => { seen.push([sql, params]); return { rowCount: 1 }; });
  assert.match(seen[0][0], /UPDATE users SET role = \$1 WHERE email = \$2/);
  assert.deepEqual(seen[0][1], ['viewer', 'a@example.test']);
  await assert.rejects(setUserRole('missing@example.test', 'viewer', async () => ({ rowCount: 0 })), /User not found/);
});

// ---------------------------------------------------------------------------
// 3. Registration flag
// ---------------------------------------------------------------------------

test('Registration: the controller uses ENABLE_PUBLIC_REGISTRATION like the route guard', async t => {
  const previous = { flag: process.env.ENABLE_PUBLIC_REGISTRATION, env: process.env.NODE_ENV };
  t.after(() => {
    if (previous.flag === undefined) delete process.env.ENABLE_PUBLIC_REGISTRATION; else process.env.ENABLE_PUBLIC_REGISTRATION = previous.flag;
    process.env.NODE_ENV = previous.env;
  });
  fakeDb(t);
  delete process.env.ENABLE_PUBLIC_REGISTRATION;
  const denied = response();
  await authController.register({ body: {} }, denied);
  assert.equal(denied.statusCode, 403);
  process.env.ENABLE_PUBLIC_REGISTRATION = 'true';
  process.env.NODE_ENV = 'production';
  const allowed = response();
  await authController.register({ body: {} }, allowed);
  assert.equal(allowed.statusCode, 400, 'enabled registration reaches validation');
});

// ---------------------------------------------------------------------------
// 4. Identifier systems: every follow-up message echoes the submitted Claim.identifier
// ---------------------------------------------------------------------------

function submittedClaim() {
  const data = clinicalInput('professional');
  data.provider.provider_name = 'Al-Noor Hospital';
  const bundle = getClaimMapper('professional').buildClaimRequestBundle(data);
  const submitted = resource(bundle, 'Claim').identifier[0];
  const row = {
    ...data.claim, id: 5, status: 'queued', claim_number: data.claim.claim_number, nphies_request_id: 'clm-req-1',
    request_bundle: bundle, provider_name: data.provider.provider_name, provider_nphies_id: data.provider.nphies_id,
    insurer_name: data.insurer.insurer_name, insurer_nphies_id: data.insurer.nphies_id,
    patient_identifier: data.patient.identifier, patient_name: data.patient.name,
    patient_gender: data.patient.gender, patient_birth_date: data.patient.birth_date, patient_identifier_type: data.patient.identifier_type
  };
  return { data, bundle, submitted, row };
}

test('Identifiers: claim status-check Task.focus equals the submitted Claim.identifier (preview and send)', async t => {
  const { submitted, row } = submittedClaim();
  fakeDb(t, [[/FROM claim_submissions cs/, { rows: [row] }]]);
  const preview = await claimCommunicationService.previewStatusCheck(5, 'public');
  assert.deepEqual(resource(preview.statusCheckBundle, 'Task').focus.identifier, submitted);
  let sent;
  t.mock.method(nphiesService, 'sendStatusCheck', async bundle => { sent = bundle; return { success: true, data: {} }; });
  await claimCommunicationService.sendStatusCheck(5, 'public');
  assert.deepEqual(resource(sent, 'Task').focus.identifier, submitted);
});

test('Identifiers: claim unsolicited Communication.about equals the submitted Claim.identifier', async t => {
  const { submitted, row } = submittedClaim();
  fakeDb(t, [[/FROM claim_submissions cs/, { rows: [row] }], [/INSERT INTO nphies_communications/, { rows: [{ id: 1 }] }]]);
  let sent;
  t.mock.method(nphiesService, 'sendCommunication', async bundle => { sent = bundle; return { success: false, error: { message: 'stub' } }; });
  await claimCommunicationService.sendUnsolicitedCommunication(5, [{ content_type: 'string', content_string: 'Synthetic note' }], 'public').catch(() => {});
  assert.ok(sent, 'communication was sent');
  assert.deepEqual(resource(sent, 'Communication').about[0].identifier, submitted);
  const preview = await claimCommunicationService.previewCommunicationBundle(5, [{ content_type: 'string', content_string: 'x' }], 'unsolicited', null, 'public');
  assert.deepEqual(resource(preview.bundle, 'Communication').about[0].identifier, submitted);
});

test('Identifiers: claim solicited Communication.about falls back to the submitted Claim.identifier', async t => {
  const { submitted, row } = submittedClaim();
  const commRequest = { id: 3, claim_id: 5, request_id: 'CR-1', cr_identifier: 'CR-1', cr_identifier_system: 'http://payer.example/communicationrequest',
    about_identifier: null, about_identifier_system: null, ...row, id_cr: 3 };
  fakeDb(t, [
    [/FROM nphies_communication_requests cr/, { rows: [{ ...commRequest, id: 3, claim_id: 5 }] }],
    [/FROM nphies_communication_requests WHERE id/, { rows: [{ id: 3, request_id: 'CR-1', cr_identifier: 'CR-1' }] }],
    [/FROM claim_submissions cs/, { rows: [row] }],
    [/INSERT INTO nphies_communications/, { rows: [{ id: 1 }] }]
  ]);
  let sent;
  t.mock.method(nphiesService, 'sendCommunication', async bundle => { sent = bundle; return { success: false, error: { message: 'stub' } }; });
  await claimCommunicationService.sendSolicitedCommunication(3, [{ content_type: 'string', content_string: 'Synthetic reply' }], 'public').catch(() => {});
  assert.deepEqual(resource(sent, 'Communication').about[0].identifier, submitted);
  const preview = await claimCommunicationService.previewCommunicationBundle(5, [{ content_type: 'string', content_string: 'x' }], 'solicited', 3, 'public');
  assert.deepEqual(resource(preview.bundle, 'Communication').about[0].identifier, submitted);
});

test('Identifiers: claim cancel Task.focus equals the identifier of the bundle that was actually sent', async t => {
  const { submitted, row, data } = submittedClaim();
  fakeDb(t, [[/FROM providers/, { rows: [data.provider] }], [/FROM insurers/, { rows: [data.insurer] }]]);
  t.mock.method(claimSubmissionsController, 'getByIdInternal', async () => ({ ...row, status: 'approved' }));
  let sent;
  t.mock.method(nphiesService, 'submitCancelRequest', async bundle => { sent = bundle; return { success: false, error: { message: 'stub' } }; });
  await claimSubmissionsController.cancel({ params: { id: '5' }, body: { reason: 'WI' } }, response());
  assert.deepEqual(resource(sent, 'Task').focus.identifier, submitted);
});

test('Identifiers: advanced authorization cancel echoes the stored identifier and never invents an insurer', async t => {
  const insurerOrg = { resourceType: 'Organization', id: 'ins', type: [{ coding: [{ code: 'ins' }] }], identifier: [{ system: 'http://nphies.sa/license/payer-license', value: 'PAYER-1' }], name: 'Synthetic Payer' };
  const providerOrg = { resourceType: 'Organization', id: 'prov', type: [{ coding: [{ code: 'prov' }] }], identifier: [{ system: 'http://nphies.sa/license/provider-license', value: 'PROV-1' }], name: 'Synthetic Clinic' };
  const claimResponse = { resourceType: 'ClaimResponse', id: 'cr', identifier: [{ system: 'http://payer.example/identifiers/claimresponse', value: 'APA-1' }] };
  const advAuth = { id: 4, status: 'active', identifier_system: 'http://payer.example/identifiers/claimresponse', identifier_value: 'APA-1', pre_auth_ref: 'REF-1',
    response_bundle: claimResponse, poll_response_bundle: { resourceType: 'Bundle', type: 'message', entry: [claimResponse, providerOrg, insurerOrg].map(resource => ({ resource })) } };
  fakeDb(t, [[/FROM advanced_authorizations WHERE id/, { rows: [advAuth] }]]);
  let sent;
  const submit = t.mock.method(nphiesService, 'submitCancelRequest', async bundle => { sent = bundle; return { success: false, error: { message: 'stub' } }; });
  await advancedAuthorizationsController.cancel({ params: { id: '4' }, body: { reason: 'WI' } }, response());
  assert.deepEqual(resource(sent, 'Task').focus.identifier, { system: 'http://payer.example/identifiers/claimresponse', value: 'APA-1' });
  assert.equal(resource(sent, 'MessageHeader').destination[0].receiver.identifier.value, 'PAYER-1');

  // A ClaimResponse naming the original request: the request identifier is echoed as-is.
  advAuth.response_bundle = { ...claimResponse, request: { identifier: { system: 'http://syntheticclinic.com.sa/identifiers/authorization', value: 'REQ-9' } } };
  await advancedAuthorizationsController.cancel({ params: { id: '4' }, body: { reason: 'WI' } }, response());
  assert.deepEqual(resource(sent, 'Task').focus.identifier, { system: 'http://syntheticclinic.com.sa/identifiers/authorization', value: 'REQ-9' });

  // No insurer in the stored message: refuse instead of sending to a default payer.
  advAuth.poll_response_bundle = { resourceType: 'Bundle', type: 'message', entry: [claimResponse, providerOrg].map(resource => ({ resource })) };
  advAuth.response_bundle = claimResponse;
  const calls = submit.mock.callCount();
  const res = response();
  await advancedAuthorizationsController.cancel({ params: { id: '4' }, body: { reason: 'WI' } }, res);
  assert.equal(res.statusCode, 400);
  assert.match(res.body.error, /insurer/i);
  assert.equal(submit.mock.callCount(), calls);
});

// ---------------------------------------------------------------------------
// 5/6. search_path and schema scoping
// ---------------------------------------------------------------------------

test('Schema: controllers switch search_path with a bound, validated value and reset it', async t => {
  const seen = [];
  const client = { query: async (sql, params) => { seen.push([String(sql), params]); return { rows: [] }; }, release() { seen.push(['release']); } };
  t.mock.method(pool, 'connect', async () => client);
  const scoped = await connectForSchema('tenant_1');
  await releaseSchemaClient(scoped);
  assert.deepEqual(seen[0], ["SELECT set_config('search_path', $1, false)", ['tenant_1']]);
  assert.equal(seen[1][0], 'RESET search_path');
  await assert.rejects(connectForSchema('x; DROP TABLE users'), /Invalid schema name/);
  seen.length = 0;
  await releaseSchemaClient(await connectForSchema(undefined));
  assert.ok(!seen.some(([sql]) => /search_path', \$1/.test(sql)), 'no schema requested: the pool default is kept');
});

test('Schema: no source file interpolates a value into SET search_path', async () => {
  const offenders = [];
  const walk = async dir => {
    for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
      if (['node_modules', 'tests', '.git'].includes(entry.name)) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) await walk(full);
      else if (entry.name.endsWith('.js') && /SET\s+search_path\s+TO\s+\$\{/i.test(await fs.readFile(full, 'utf8'))) offenders.push(full);
    }
  };
  await walk(backendDir);
  assert.deepEqual(offenders, []);
});

test('Schema: poll log and record poll messages are read from the caller\'s schema', async t => {
  const getLog = t.mock.method(systemPollService, 'getPollLog', async () => ({ id: 1 }));
  const getMessages = t.mock.method(systemPollService, 'getPollMessagesForRecord', async () => ({ data: [] }));
  await systemPollController.getPollLog({ params: { id: '1' }, schemaName: 'tenant_1' }, response());
  assert.deepEqual(getLog.mock.calls[0].arguments, [1, 'tenant_1']);
  await systemPollController.getRecordPollMessages({ params: { table: 'claim_submissions', recordId: '2' }, query: {}, schemaName: 'tenant_1' }, response());
  assert.equal(getMessages.mock.calls[0].arguments[2].schemaName, 'tenant_1');
});

// ---------------------------------------------------------------------------
// 7. Batch preview
// ---------------------------------------------------------------------------

test('Batch preview: individual bundles are the nested bundles of the batch bundle (same ids)', async t => {
  const one = clinicalInput('professional');
  const two = clinicalInput('professional');
  two.claim.claim_number = 'TEST-CLAIM-2';
  t.mock.method(claimBatchesController, 'getByIdInternal', async () => ({ id: 1, claims: [{}, {}], total_amount: 200 }));
  t.mock.method(claimBatchesController, 'prepareBatchBundleData', async () => ({
    batchIdentifier: 'B-1', batchPeriodStart: '2026-08-01', batchPeriodEnd: '2026-08-31',
    provider: one.provider, insurer: one.insurer, claims: [one, two]
  }));
  const res = response();
  await claimBatchesController.previewBundle({ params: { id: '1' } }, res);
  const nested = res.body.batchBundle.entry.filter(e => e.resource?.resourceType === 'Bundle').map(e => e.resource);
  assert.equal(nested.length, 2);
  assert.deepEqual(res.body.data, nested);
});

test('Batch validation failures are client errors (400), not 500', () => {
  assert.throws(() => batchClaimMapper.buildNestedClaimBundles({ batchIdentifier: 'B', batchPeriodStart: 'x', batchPeriodEnd: 'y', claims: [] }),
    error => error.status === 400 && /at least 2 claims/.test(error.message));
});

// ---------------------------------------------------------------------------
// 9. Response viewer, patients, trends
// ---------------------------------------------------------------------------

const highestPlaceholder = sql => Math.max(0, ...[...sql.matchAll(/\$(\d+)/g)].map(m => Number(m[1])));

test('Response viewer applies search, status, date range and a whitelisted sort to data and count', async t => {
  for (const method of ['getClaims', 'getAuthorizations', 'getEligibility', 'getPayments']) {
    const calls = fakeDb(t, [[/COUNT\(\*\)/, { rows: [{ total: '0' }] }]]);
    const res = response();
    await responseViewerController[method]({ query: { page: '2', limit: '5', search: 'Syn', status: 'Approved', dateRange: 'month', sortBy: 'amount', sortOrder: 'asc' } }, res);
    assert.equal(res.statusCode, 200, `${method} ${JSON.stringify(res.body)}`);
    const [data, count] = [calls.find(c => /LIMIT/.test(c.sql)), calls.find(c => /COUNT\(\*\)/.test(c.sql))];
    assert.match(data.sql, /ILIKE/, method);
    assert.match(data.sql, /LOWER\(/, method);
    assert.match(data.sql, /date_trunc\('month', CURRENT_DATE\)/i, method);
    assert.match(data.sql, /ORDER BY [^\n]* ASC/, method);
    assert.equal(highestPlaceholder(count.sql), count.params.length, method);
    assert.equal(highestPlaceholder(data.sql), data.params.length, method);
    assert.deepEqual(data.params.slice(-2), [5, 5], method);

    calls.length = 0;
    await responseViewerController[method]({ query: { sortBy: 'amount; DROP TABLE claims', sortOrder: 'sideways', dateRange: 'decade' } }, response());
    const plain = calls.find(c => /LIMIT/.test(c.sql));
    assert.doesNotMatch(plain.sql, /DROP|sideways|decade/);
    assert.match(plain.sql, /DESC/);
  }
});

test('Patients list is ordered by name with a capped page size', async t => {
  const calls = fakeDb(t, [[/COUNT/, { rows: [{ total: '0' }] }]]);
  const res = response();
  await patientsController.getAll({ query: { limit: '50000' } }, res);
  const data = calls.find(c => /LIMIT/.test(c.sql));
  assert.match(data.sql, /ORDER BY name ASC/);
  assert.equal(data.params[0], 1000);
  assert.equal(res.body.pagination.limit, 1000);
});

test('Trend queries are returned oldest first', async t => {
  for (const name of ['GET_DAILY_TRENDS', 'GET_PAYMENT_TRENDS', 'GET_MONTHLY_TRENDS', 'GET_PRIOR_AUTH_TRENDS']) {
    assert.match(queries.DASHBOARD[name], /ORDER BY (date|month) ASC/, name);
  }
  const calls = fakeDb(t, [[/./, { rows: [{}] }]]);
  await paymentReconciliationService.getStats().catch(() => {});
  const monthly = calls.find(c => /DATE_TRUNC\('month', payment_date\)/.test(c.sql));
  assert.match(monthly.sql, /ORDER BY month ASC/);
});

// ---------------------------------------------------------------------------
// 10. Chat abort
// ---------------------------------------------------------------------------

test('Chat: streamChat aborts the Ollama stream when the caller\'s signal fires', async t => {
  let aborted = false;
  let produced = 0;
  const controller = new AbortController();
  assert.equal(chatService.configError, null);
  t.mock.method(chatService.client, 'generate', async () => ({
    abort() { aborted = true; },
    async *[Symbol.asyncIterator]() {
      for (let i = 0; i < 20; i++) {
        if (aborted) throw Object.assign(new Error('aborted'), { name: 'AbortError' });
        produced++;
        yield { response: `c${i}` };
      }
      yield { done: true };
    }
  }));
  const chunks = [];
  const errors = [];
  await chatService.streamChat('hi', 'general', [], chunk => { chunks.push(chunk); if (chunks.length === 2) controller.abort(); },
    () => assert.fail('must not complete'), error => errors.push(error), { signal: controller.signal });
  assert.ok(aborted, 'stream.abort() was called');
  assert.ok(produced <= 3, `generation continued after abort (${produced})`);
  assert.deepEqual(errors, [], 'an abort requested by the caller is not reported as an error');
});

test('Chat: the controller passes an AbortSignal that fires when the client disconnects', async t => {
  let signal;
  t.mock.method(chatService, 'streamChat', async (message, mode, history, onChunk, onComplete, onError, options) => {
    signal = options?.signal;
    res.emit('close');
  });
  const res = new EventEmitter();
  res.writableEnded = false;
  res.setHeader = () => {};
  res.write = () => true;
  res.end = () => { res.writableEnded = true; };
  await streamChat({ body: { message: 'x' } }, res);
  assert.ok(signal instanceof AbortSignal);
  assert.equal(signal.aborted, true);
});

// ---------------------------------------------------------------------------
// 11. Embedding scripts
// ---------------------------------------------------------------------------

test('Medicine import skips and counts rows without an embedding and exits non-zero', async t => {
  const calls = fakeDb(t);
  const importer = new MedicineImporter();
  t.mock.method(importer, 'parseCSV', () => [
    { MG_MRID: 'M-1', 'Active Ingredient': 'synthetic a' }, { MG_MRID: 'M-2', 'Active Ingredient': 'synthetic b' }
  ]);
  t.mock.method(ragService, 'generateEmbedding', async text => {
    if (text.includes('synthetic b')) throw new Error('model unavailable');
    return [0.1, 0.2];
  });
  await importer.importGenericMedicines();
  const inserts = calls.filter(c => /INSERT INTO medicines/.test(c.sql));
  assert.equal(inserts.length, 1);
  assert.equal(inserts[0].params[0], 'M-1');
  assert.equal(importer.stats.medicines.embeddingFailed, 1);
  assert.equal(importer.exitCode(), 1);
});

test('Knowledge seeding reports skipped embeddings as a failure', () => {
  assert.deepEqual(embeddingRunSummary(3, 3), { failed: 0, exitCode: 0, message: 'All 3 entries stored with embeddings' });
  const partial = embeddingRunSummary(3, 1);
  assert.equal(partial.failed, 2);
  assert.equal(partial.exitCode, 1);
  assert.match(partial.message, /2 of 3 entries were skipped/);
});

// ---------------------------------------------------------------------------
// 12. Configuration and docs
// ---------------------------------------------------------------------------

test('env.example documents every runtime switch; helper scripts have no password default; docs use a local Ollama', async () => {
  const env = await fs.readFile(path.join(backendDir, 'env.example'), 'utf8');
  for (const name of ['OLLAMA_EMBED_MODEL', 'EMBEDDING_DIM', 'OLLAMA_ALLOW_INSECURE_REMOTE', 'MEDBOT_MODEL', 'CHAT_DRUG_MODEL',
    'DB_LOG_QUERIES', 'NPHIES_DEBUG_BUNDLES', 'ENABLE_PUBLIC_REGISTRATION', 'ALLOW_DESTRUCTIVE_SEED']) {
    assert.match(env, new RegExp(`^#?\\s*${name}=`, 'm'), name);
  }
  assert.doesNotMatch(env, /hardcoded in medbotService/);
  for (const file of ['debug-seed.js', 'test-connection.js']) {
    assert.doesNotMatch(await fs.readFile(path.join(backendDir, file), 'utf8'), /\|\|\s*'password'/, file);
  }
  for (const file of ['SEED-README.md', 'run-seed.bat']) {
    assert.match(await fs.readFile(path.join(backendDir, file), 'utf8'), /ALLOW_DESTRUCTIVE_SEED/, file);
  }
  const repoRoot = path.resolve(backendDir, '..');
  const docs = [...(await fs.readdir(backendDir)).filter(f => f.endsWith('.md')).map(f => path.join(backendDir, f)),
    ...(await fs.readdir(repoRoot)).filter(f => f.endsWith('.md')).map(f => path.join(repoRoot, f))];
  for (const doc of docs) assert.doesNotMatch(await fs.readFile(doc, 'utf8'), /206\.168\.83\.244/, doc);
});
