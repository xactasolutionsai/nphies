// Patient access grant administration for the clinical AI module (routes/clinicalAiAccess.js).
import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import pool from '../db.js';
import router from '../routes/clinicalAiAccess.js';
import { requiredRoleFor } from '../middleware/requireRole.js';

function fakeDb(t, handler = () => ({ rows: [], rowCount: 0 })) {
  const calls = [];
  t.mock.method(pool, 'query', async (sql, params = []) => {
    calls.push({ sql: String(sql), params });
    return handler(String(sql), params);
  });
  return calls;
}

async function serve(t) {
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => { req.user = { id: 7, role: 'admin' }; next(); });
  app.use('/api/clinical-ai-access', router);
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); }));
  const base = `http://127.0.0.1:${server.address().port}/api/clinical-ai-access`;
  return async (path, method = 'GET', body) => {
    const response = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json' },
      ...(body ? { body: JSON.stringify(body) } : {}) });
    return { status: response.status, body: await response.json() };
  };
}

const PATIENT = '11111111-1111-4111-8111-111111111111';

test('Only administrators manage clinical AI patient access', () => {
  for (const method of ['GET', 'POST']) {
    assert.equal(requiredRoleFor(method, '/clinical-ai-access'), 'admin');
    assert.equal(requiredRoleFor(method, '/clinical-ai-access/5/revoke'), 'admin');
  }
});

test('Granting records who granted it and requires a reason', async t => {
  const calls = fakeDb(t, sql => /INSERT/.test(sql) ? { rows: [{ id: 1 }] } : { rows: [] });
  const call = await serve(t);
  assert.equal((await call('/', 'POST', { user_id: 3, patient_id: PATIENT })).status, 400);
  assert.equal((await call('/', 'POST', { user_id: 3, patient_id: PATIENT, reason: 'treating team', granted_by: 1 })).status, 400);
  assert.equal((await call('/', 'POST', { user_id: 3, patient_id: PATIENT, reason: 'x', expires_at: '2000-01-01' })).status, 400);
  const ok = await call('/', 'POST', { user_id: 3, patient_id: PATIENT, reason: 'treating team' });
  assert.equal(ok.status, 201);
  const insert = calls.find(c => /INSERT/.test(c.sql));
  assert.deepEqual(insert.params, [3, PATIENT, 'treating team', 7, null]);
});

test('Revoking keeps the row and records who revoked it', async t => {
  const calls = fakeDb(t, sql => /UPDATE/.test(sql) ? { rows: [{ id: 4 }] } : { rows: [] });
  const call = await serve(t);
  assert.equal((await call('/4/revoke', 'POST', {})).status, 400);
  assert.equal((await call('/4/revoke', 'POST', { reason: 'left the team' })).status, 200);
  const update = calls.find(c => /UPDATE/.test(c.sql));
  assert.match(update.sql, /revoked_at IS NULL/);
  assert.doesNotMatch(update.sql, /DELETE/);
  assert.deepEqual(update.params, [4, 7, 'left the team']);
});

test('Listing defaults to active grants', async t => {
  const calls = fakeDb(t);
  const call = await serve(t);
  assert.equal((await call(`/?patient_id=${PATIENT}`)).status, 200);
  assert.match(calls[0].sql, /revoked_at IS NULL AND \(expires_at IS NULL OR expires_at > now\(\)\)/);
  assert.deepEqual(calls[0].params, [PATIENT]);
});
