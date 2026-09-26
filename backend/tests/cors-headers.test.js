// The browser sends Idempotency-Key with OpenMed analyses; the CORS preflight must allow it,
// or the browser blocks the request before it reaches the server ("Failed to fetch").
import test from 'node:test';
import assert from 'node:assert/strict';
import app from '../server.js';

test('CORS preflight allows the Idempotency-Key header from the frontend origin', async t => {
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); }));
  const response = await fetch(`http://127.0.0.1:${server.address().port}/api/openmed/analyses`, {
    method: 'OPTIONS',
    headers: { Origin: 'http://localhost:5173', 'Access-Control-Request-Method': 'POST',
      'Access-Control-Request-Headers': 'authorization,content-type,idempotency-key' }
  });
  assert.equal(response.status, 204);
  const allowed = (response.headers.get('access-control-allow-headers') || '').toLowerCase().split(',').map(h => h.trim());
  for (const header of ['authorization', 'content-type', 'idempotency-key']) assert.ok(allowed.includes(header), header);
});
