import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

// Same approach as frontend.test.js: load the real frontend modules through data: URLs,
// only replacing Vite's compile-time env and the '@/...' aliases.
const values = new Map();
globalThis.localStorage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, String(value)), removeItem: key => values.delete(key), key: () => null, length: 0 };
globalThis.window = globalThis.window || new EventTarget();
const moduleUrl = source => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
const source = file => fs.readFileSync(new URL(`../../frontend/src/${file}`, import.meta.url), 'utf8');
const httpUrl = moduleUrl(source('services/http.js').replace('import.meta.env.VITE_API_URL', "'https://app.example.test/api'"));
const downloadUrl = moduleUrl(source('utils/download.js'));
const withHttp = file => source(file).replace("'@/services/http'", JSON.stringify(httpUrl));

const { default: aiValidationService } = await import(moduleUrl(withHttp('services/aiValidationService.js')
  .replace('import.meta.env.VITE_AI_VALIDATION_ENABLED', 'undefined')));
const { default: responseViewerApi } = await import(moduleUrl(withHttp('services/responseViewerApi.js')));
const { default: api } = await import(moduleUrl(withHttp('services/api.js').replace("'@/utils/download'", JSON.stringify(downloadUrl))));
const roles = await import(moduleUrl(source('utils/roles.js')));
const constants = await import(moduleUrl(source('components/prior-auth/constants.js')));

beforeEach(() => { values.clear(); aiValidationService.setEnabled(true); });

test('AI form validation fails closed when the AI service errors', async t => {
  t.mock.method(console, 'error', () => {});
  t.mock.method(globalThis, 'fetch', async () => new Response(JSON.stringify({ message: 'model offline' }), { status: 503 }));
  const result = await aiValidationService.validateForm({ patient_name: 'Test' });
  assert.equal(result.success, false);
  assert.notEqual(result.data.isValid, true, 'an AI error must never be reported as valid');
  assert.equal(result.data.isValid, null);
  assert.equal(result.data.aiUnavailable, true);
  assert.equal(result.data.requiresManualReview, true);
  assert.equal(result.data.warnings[0].severity, 'high');
});

test('AI form validation fails closed when the network request throws', async t => {
  t.mock.method(console, 'error', () => {});
  t.mock.method(globalThis, 'fetch', async () => { throw new TypeError('Failed to fetch'); });
  const result = await aiValidationService.validateForm({});
  assert.equal(result.data.isValid, null);
  assert.equal(result.data.requiresManualReview, true);
});

test('Disabled AI validation is reported as not validated, not as valid', async () => {
  aiValidationService.setEnabled(false);
  const result = await aiValidationService.validateForm({});
  assert.equal(result.data.isValid, null);
  assert.equal(result.data.aiUnavailable, true);
});

test('Response viewer keeps Content-Type when a caller passes its own headers', async t => {
  t.mock.method(globalThis, 'fetch', async (_, options) => {
    assert.equal(options.headers.get('Content-Type'), 'application/json');
    assert.equal(options.headers.get('X-Test'), 'yes');
    return new Response('{"data":[]}');
  });
  await responseViewerApi.request('/claims', { method: 'GET', headers: { 'X-Test': 'yes' } });
  assert.equal(globalThis.fetch.mock.callCount(), 1);
});

test('A role denial (403) becomes a clear permission message naming the required role', async t => {
  t.mock.method(console, 'error', () => {});
  t.mock.method(globalThis, 'fetch', async () => new Response(JSON.stringify({ error: 'forbidden', requiredRole: 'submitter' }), { status: 403 }));
  await assert.rejects(api.sendPriorAuthorizationToNphies(1), error => {
    assert.equal(error.message, 'You do not have permission for this action (requires submitter)');
    assert.equal(error.response.status, 403);
    assert.equal(error.response.data.error, error.message);
    assert.equal(error.response.data.code, 'forbidden');
    return true;
  });
});

test('The legacy admin-only 403 also names the admin role; other 403s keep their message', async t => {
  t.mock.method(console, 'error', () => {});
  t.mock.method(globalThis, 'fetch', async () => new Response(JSON.stringify({ error: 'Forbidden', message: 'Administrator role required' }), { status: 403 }));
  await assert.rejects(api.triggerSystemPoll(), /requires admin\)$/);
  t.mock.restoreAll();
  t.mock.method(console, 'error', () => {});
  t.mock.method(globalThis, 'fetch', async () => new Response(JSON.stringify({ error: 'Communication does not belong to this prior authorization' }), { status: 403 }));
  await assert.rejects(api.triggerSystemPoll(), error => {
    assert.equal(error.response.data.error, 'Communication does not belong to this prior authorization');
    return true;
  });
});

test('Role permissions follow the contract; legacy user acts as submitter; unknown roles are denied', () => {
  const { roleCan, hasAnyRole } = roles;
  assert.equal(roleCan('viewer', 'view'), true);
  assert.equal(roleCan('viewer', 'send'), false);
  assert.equal(roleCan('reviewer', 'validate'), true);
  assert.equal(roleCan('reviewer', 'create'), false);
  assert.equal(roleCan('submitter', 'send'), true);
  assert.equal(roleCan('submitter', 'delete'), false);
  assert.equal(roleCan('user', 'send'), true);
  assert.equal(roleCan('user', 'triggerSystemPoll'), false);
  assert.equal(roleCan('admin', 'delete'), true);
  assert.equal(roleCan('admin', 'no-such-action'), false);
  assert.equal(roleCan('superuser', 'view'), false);
  assert.equal(roleCan(undefined, 'view'), false);
  assert.equal(hasAnyRole('user', ['submitter']), true);
  assert.equal(hasAnyRole('viewer', ['admin', 'submitter']), false);
});

test('Treating practitioner is required for professional, institutional, dental and vision only', () => {
  const { validatePractitionerFields } = constants;
  for (const auth_type of ['professional', 'institutional', 'dental', 'vision']) {
    const fields = validatePractitionerFields({ auth_type, practitioner_identifier_type: 'MD' }).map(e => e.field);
    assert.deepEqual(fields, ['practitioner_license', 'practitioner_name'], auth_type);
  }
  assert.deepEqual(validatePractitionerFields({ auth_type: 'pharmacy' }), []);
  assert.deepEqual(validatePractitionerFields({
    auth_type: 'professional', practitioner_license: 'LIC-1', practitioner_name: 'Test Practitioner', practitioner_identifier_type: 'MD'
  }), []);
  assert.deepEqual(validatePractitionerFields({
    auth_type: 'dental', practitioner_license: '  ', practitioner_name: 'Test Practitioner', practitioner_identifier_type: 'XX'
  }).map(e => e.field), ['practitioner_license', 'practitioner_identifier_type']);
});
