import test from 'node:test';
import assert from 'node:assert/strict';
import pool from '../db.js';
import jwt from 'jsonwebtoken';
import { getJwtSecret } from '../config/auth.js';
import app from '../server.js';

test('API authentication protects clinical and NPHIES operations; login remains public', async t => {
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); }));
  const base = `http://127.0.0.1:${server.address().port}`;
  const database = t.mock.method(pool, 'query', async sql => {
    if (sql.includes('FROM users')) return { rows: [{ id: 1, email: 'test@example.test', role: 'user' }] };
    if (sql.includes('COUNT(')) return { rows: [{ total: '0' }] };
    return { rows: [] };
  });
  for (const [method, url] of [
    ['GET', '/api/patients'], ['DELETE', '/api/patients/1'],
    ['POST', '/api/prior-authorizations/1/send'], ['POST', '/api/claim-submissions/1/send'],
    ['POST', '/api/advanced-authorizations/1/cancel'], ['POST', '/api/system-poll/trigger'],
    ['GET', '/api/payment-reconciliation'], ['GET', '/api/users'], ['GET', '/api/contacts']
  ]) {
    const response = await fetch(base + url, { method });
    assert.equal(response.status, 401, `${method} ${url}`);
  }
  assert.equal(database.mock.callCount(), 0);
  assert.equal((await fetch(base + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })).status, 400);
  const token = jwt.sign({ userId: 1 }, getJwtSecret());
  const response = await fetch(base + '/api/patients', { headers: { Authorization: `Bearer ${token}` } });
  assert.equal(response.status, 200);
});
