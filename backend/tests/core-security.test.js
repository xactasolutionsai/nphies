import test from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import pool from '../db.js';
import app from '../server.js';
import { getJwtSecret } from '../config/auth.js';
import { isAdminOnlyOperation, requireRole } from '../middleware/requireRole.js';
import { validateContactSubmission, isSafeHttpUrl, CONTACT_LIMITS } from '../utils/contactValidation.js';

async function startServer(t) {
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); }));
  return `http://127.0.0.1:${server.address().port}`;
}

function mockDatabase(t, role) {
  return t.mock.method(pool, 'query', async sql => {
    if (sql.includes('FROM users WHERE id')) return { rows: [{ id: 1, email: 'someone@example.test', role }] };
    if (sql.includes('INSERT INTO contacts')) return { rows: [{ id: 1, status: 'new' }] };
    if (sql.includes('COUNT(')) return { rows: [{ total: '0' }] };
    return { rows: [], rowCount: 0 };
  });
}

const token = () => jwt.sign({ userId: 1 }, getJwtSecret());

test('Admin-only operation matcher covers deletes, polls, cache refresh, raw relay and users', () => {
  for (const [method, path] of [
    ['DELETE', '/patients/1'], ['DELETE', '/prior-authorizations/5'], ['delete', '/claim-batches/3'],
    ['POST', '/system-poll/trigger'], ['POST', '/System-Poll/Trigger/'], ['POST', '//system-poll//trigger'],
    ['POST', '/nphies-codes/refresh'], ['POST', '/NPHIES-codes/refresh/'],
    ['POST', '/eligibility/check-nphies-direct'], ['POST', '/Eligibility/Check-Nphies-Direct/'],
    ['GET', '/users'], ['GET', '/users/7'], ['GET', '/USERS/']
  ]) assert.equal(isAdminOnlyOperation(method, path), true, `${method} ${path}`);
  for (const [method, path] of [
    ['GET', '/patients'], ['POST', '/prior-authorizations/1/send'], ['POST', '/claim-submissions/1/send'],
    ['POST', '/eligibility/check-nphies'], ['GET', '/system-poll/logs'], ['POST', '/nphies-codes/lookup'],
    ['GET', '/nphies-codes/refresh'], ['PUT', '/patients/1'], ['GET', '/users-guide']
  ]) assert.equal(isAdminOnlyOperation(method, path), false, `${method} ${path}`);
});

test('requireRole rejects missing users and other roles', () => {
  const res = () => ({ statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } });
  const r1 = res(); requireRole('admin')({}, r1, () => assert.fail('must not pass')); assert.equal(r1.statusCode, 401);
  const r2 = res(); requireRole('admin')({ user: { role: 'user' } }, r2, () => assert.fail('must not pass')); assert.equal(r2.statusCode, 403);
  let passed = false; requireRole('admin')({ user: { role: 'admin' } }, res(), () => { passed = true; }); assert.ok(passed);
});

test('Ordinary users get 403 on admin operations but can still send to NPHIES', async t => {
  const base = await startServer(t);
  mockDatabase(t, 'user');
  const headers = { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' };
  for (const [method, url] of [
    ['DELETE', '/api/patients/00000000-0000-4000-8000-000000000001'], ['DELETE', '/api/prior-authorizations/1'],
    ['POST', '/api/system-poll/trigger'], ['POST', '/API/System-Poll/Trigger/'], ['POST', '/api/nphies-codes/refresh'],
    ['POST', '/api/eligibility/check-nphies-direct'], ['GET', '/api/users'], ['GET', '/api/users/1']
  ]) {
    const response = await fetch(base + url, { method, headers, body: method === 'POST' ? '{}' : undefined });
    assert.equal(response.status, 403, `${method} ${url}`);
  }
  const send = await fetch(base + '/api/prior-authorizations/1/send', { method: 'POST', headers, body: '{}' });
  assert.notEqual(send.status, 403);
  assert.notEqual(send.status, 401);
  assert.equal((await fetch(base + '/api/patients', { headers })).status, 200);
});

test('Administrators pass the role gate', async t => {
  const base = await startServer(t);
  mockDatabase(t, 'admin');
  const response = await fetch(base + '/api/users', { headers: { Authorization: `Bearer ${token()}` } });
  assert.equal(response.status, 200);
});

test('Public registration is disabled unless ENABLE_PUBLIC_REGISTRATION=true', async t => {
  const base = await startServer(t);
  const database = mockDatabase(t, 'user');
  const previous = process.env.ENABLE_PUBLIC_REGISTRATION;
  t.after(() => { if (previous === undefined) delete process.env.ENABLE_PUBLIC_REGISTRATION; else process.env.ENABLE_PUBLIC_REGISTRATION = previous; });
  const register = path => fetch(base + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
  delete process.env.ENABLE_PUBLIC_REGISTRATION;
  for (const path of ['/api/auth/register', '/API/Auth/Register/']) assert.equal((await register(path)).status, 403, path);
  process.env.ENABLE_PUBLIC_REGISTRATION = 'false';
  assert.equal((await register('/api/auth/register')).status, 403);
  assert.equal(database.mock.callCount(), 0);
  process.env.ENABLE_PUBLIC_REGISTRATION = 'true';
  assert.equal((await register('/api/auth/register')).status, 400); // reaches the controller's validation
});

test('Contact validation accepts only absolute http(s) source URLs and bounded strings', () => {
  const valid = { name: 'Synthetic Person', email: 'person@example.test', message: 'Hello', source_url: 'https://example.test/contact' };
  assert.deepEqual(validateContactSubmission(valid), []);
  assert.deepEqual(validateContactSubmission({ ...valid, source_url: undefined, company: '' }), []);
  for (const url of ['javascript:alert(1)', 'data:text/html,<script>', '//example.test', '/relative', 'ftp://example.test',
    'https://user:pass@example.test', 'https://example.test/"onmouseover="x', 'https://' + 'a'.repeat(CONTACT_LIMITS.source_url), 42]) {
    assert.equal(isSafeHttpUrl(url), false, String(url));
    assert.ok(validateContactSubmission({ ...valid, source_url: url }).some(e => e.field === 'source_url'), String(url));
  }
  assert.ok(validateContactSubmission({ ...valid, name: { $ne: 1 } }).some(e => e.field === 'name'));
  assert.ok(validateContactSubmission({ ...valid, email: 'not-an-email' }).some(e => e.field === 'email'));
  assert.ok(validateContactSubmission({ ...valid, message: 'x'.repeat(CONTACT_LIMITS.message + 1) }).some(e => e.field === 'message'));
  assert.ok(validateContactSubmission({ ...valid, company: 'x'.repeat(256) }).some(e => e.field === 'company'));
  assert.ok(validateContactSubmission({ ...valid, message: '   ' }).some(e => e.field === 'message'));
  assert.ok(validateContactSubmission([]).length > 0);
});

test('POST /api/contacts rejects unsafe input before the controller and drops unsafe Referer', async t => {
  const base = await startServer(t);
  const database = mockDatabase(t, 'user');
  const post = (body, headers = {}) => fetch(base + '/api/contacts', { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) });
  const valid = { name: 'Synthetic Person', email: 'person@example.test', message: 'Hello' };
  assert.equal((await post({ ...valid, source_url: 'javascript:alert(document.cookie)' })).status, 400);
  assert.equal((await post({ ...valid, name: ['array'] })).status, 400);
  assert.equal(database.mock.callCount(), 0);
  assert.equal((await post({ ...valid, source_url: 'https://example.test/page' })).status, 201);
  const insert = database.mock.calls.at(-1).arguments;
  assert.ok(insert[1].includes('https://example.test/page'));
  await post(valid, { Referer: 'javascript:alert(1)' });
  const insertWithReferer = database.mock.calls.at(-1).arguments;
  assert.ok(!insertWithReferer[1].some(value => String(value).startsWith('javascript:')));
});

test('Blocked CORS origins get 403, and /health does not leak database errors', async t => {
  const base = await startServer(t);
  const cors = await fetch(base + '/api/auth/login', { method: 'POST', headers: { Origin: 'https://attacker.example', 'Content-Type': 'application/json' }, body: '{}' });
  assert.equal(cors.status, 403);
  t.mock.method(pool, 'query', async () => { throw new Error('password authentication failed for user "secret_user"'); });
  const health = await fetch(base + '/health');
  assert.equal(health.status, 503);
  const text = await health.text();
  assert.ok(!text.includes('secret_user') && !text.includes('password'), text);
});
