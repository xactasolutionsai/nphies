// Persistent OpenMed worker pool (openmed/workerPool.js) against a protocol-compatible
// fake worker (tests/fixtures/fake-openmed-worker.mjs). No model is involved.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { WorkerPool, percentiles } from '../openmed/workerPool.js';

const FAKE = fileURLToPath(new URL('./fixtures/fake-openmed-worker.mjs', import.meta.url));

function makePool(t, options = {}, env = {}) {
  let spawns = 0;
  const pool = new WorkerPool({
    command: process.execPath, args: [FAKE], env: { PATH: process.env.PATH, ...env },
    restartBackoffMs: [20], queueTimeoutMs: 2000, requestTimeoutMs: 2000, ...options,
    spawn: (...args) => { spawns++; return spawn(...args); }
  });
  t.after(() => pool.close());
  return { pool, spawns: () => spawns };
}
const until = async (check, ms = 3000) => {
  const end = Date.now() + ms;
  while (!check()) { if (Date.now() > end) throw new Error('condition not reached'); await new Promise(r => setTimeout(r, 10)); }
};

test('Workers persist: many requests, one process, one start', async t => {
  const { pool, spawns } = makePool(t);
  const results = [];
  for (let i = 0; i < 3; i++) results.push(await pool.analyze('takes metformin', 'medications'));
  assert.equal(new Set(results.map(r => r.pid)).size, 1);
  assert.deepEqual(results.map(r => r.served), [1, 2, 3]);
  assert.equal(spawns(), 1);
  assert.equal(results[0].entities[0].start, 6);
  const s = pool.status();
  assert.equal(s.stats.completed, 3);
  assert.equal(s.latency_ms.service.n, 3);
  assert.equal(s.startup_ms.n, 1);
});

test('Concurrency equals the pool size', async t => {
  const { pool } = makePool(t, { size: 2, maxQueue: 10 });
  let maxInFlight = 0;
  const watcher = setInterval(() => { maxInFlight = Math.max(maxInFlight, pool.status().in_flight); }, 5);
  const started = Date.now();
  const results = await Promise.all([1, 2, 3, 4].map(() => pool.analyze('__SLOW:150__ metformin', 'medications')));
  clearInterval(watcher);
  assert.equal(maxInFlight, 2);
  assert.equal(new Set(results.map(r => r.pid)).size, 2);
  assert.ok(Date.now() - started < 580, 'two workers in parallel, not four requests in series');
});

test('A full queue is refused at once; a long wait is refused with 503', async t => {
  const { pool } = makePool(t, { maxQueue: 1, queueTimeoutMs: 150 });
  const running = pool.analyze('__SLOW:400__', 'diseases');
  await until(() => pool.status().in_flight === 1);
  const queued = pool.analyze('waits', 'diseases');
  await assert.rejects(pool.analyze('third', 'diseases'), { status: 429, code: 'queue_full' });
  await assert.rejects(queued, { status: 503, code: 'queue_timeout' });
  await running;
  assert.equal(pool.status().stats.rejected_queue_full, 1);
  assert.equal(pool.status().stats.rejected_queue_wait, 1);
});

test('A hung analysis times out, the worker is replaced and the next request succeeds', async t => {
  const { pool, spawns } = makePool(t, { requestTimeoutMs: 150 });
  const first = await pool.analyze('warm', 'diseases');
  await assert.rejects(pool.analyze('__HANG__', 'diseases'), { status: 504, code: 'timeout' });
  const next = await pool.analyze('metformin again', 'medications');
  assert.notEqual(next.pid, first.pid);
  assert.equal(spawns(), 2);
  assert.equal(pool.status().stats.timeouts, 1);
  assert.equal(pool.status().stats.crashes, 0);
});

test('A crashed worker fails only its request and is restarted', async t => {
  const { pool } = makePool(t);
  await assert.rejects(pool.analyze('__CRASH__', 'diseases'), { status: 503, code: 'worker_crashed' });
  const recoveredAt = Date.now();
  const next = await pool.analyze('metformin', 'medications');
  assert.equal(next.entities.length, 1);
  assert.ok(Date.now() - recoveredAt < 2000);
  assert.equal(pool.status().stats.crashes, 1);
  assert.equal(pool.status().stats.restarts, 1);
});

test('Cancelled requests leave the queue; a cancelled running request is discarded', async t => {
  const { pool } = makePool(t, { maxQueue: 5 });
  const running = new AbortController(), queued = new AbortController();
  const a = pool.analyze('__SLOW:200__ metformin', 'medications', { signal: running.signal });
  await until(() => pool.status().in_flight === 1);
  const b = pool.analyze('queued', 'diseases', { signal: queued.signal });
  queued.abort();
  await assert.rejects(b, { status: 499 });
  assert.equal(pool.status().queued, 0);
  running.abort();
  await assert.rejects(a, { status: 499 });
  const c = await pool.analyze('metformin', 'medications');
  assert.equal(c.entities.length, 1);
  assert.equal(pool.status().stats.cancelled, 2);
  await assert.rejects(pool.analyze('x', 'diseases', { signal: AbortSignal.abort() }), { status: 499 });
});

test('Oversized or foreign responses never reach the caller', async t => {
  const { pool } = makePool(t);
  await assert.rejects(pool.analyze('__HUGE__', 'diseases'), { status: 503, code: 'invalid_response' });
  const r = await pool.analyze('__WRONGID__ metformin', 'medications');
  assert.equal(r.entities.length, 1, 'the response with another id was ignored');
  assert.equal(pool.status().stats.crashes, 0);
});

test('Worker error codes map to safe HTTP statuses', async t => {
  const { pool } = makePool(t);
  await assert.rejects(pool.analyze('__ERR:arabic_not_supported__', 'diseases'), { status: 400 });
  await assert.rejects(pool.analyze('__ERR:model_unavailable__', 'diseases'), { status: 503 });
  await assert.rejects(pool.analyze('__ERR:anything_else__', 'diseases'), { status: 503 });
});

test('Status and errors contain no request text', async t => {
  const { pool } = makePool(t, { requestTimeoutMs: 100 });
  const secret = 'Zyxwq-synthetic-secret metformin';
  await pool.analyze(secret, 'medications');
  const errors = [];
  for (const text of [`${secret} __HANG__`, `${secret} __CRASH__`, `${secret} __ERR:analysis_failed__`]) {
    await pool.analyze(text, 'diseases').catch(e => errors.push(e.message));
  }
  assert.equal(errors.length, 3);
  assert.ok(!JSON.stringify([pool.status(), errors]).includes('Zyxwq'));
});

test('A worker that never starts leaves requests to fail cleanly; close() rejects the queue', async t => {
  const { pool } = makePool(t, { queueTimeoutMs: 150, startTimeoutMs: 100 }, { FAKE_NO_READY: '1' });
  await assert.rejects(pool.analyze('x', 'diseases'), { status: 503, code: 'queue_timeout' });
  await until(() => pool.status().stats.restarts >= 1);
  const pending = assert.rejects(pool.analyze('y', 'diseases'), { status: 503 });
  await pool.close();
  await pending;
  await assert.rejects(pool.analyze('z', 'diseases'), { status: 503 });
});

test('Percentiles use nearest rank', () => {
  assert.deepEqual(percentiles([5, 1, 3, 2, 4]), { n: 5, p50: 3, p95: 5, p99: 5, max: 5 });
  assert.deepEqual(percentiles([]), { n: 0, p50: null, p95: null, p99: null, max: null });
});
