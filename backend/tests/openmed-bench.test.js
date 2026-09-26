// Benchmark harness (scripts/benchOpenmed.js) in simulated mode: structure and labelling only.
import test from 'node:test';
import assert from 'node:assert/strict';
import { benchmark, syntheticText } from '../scripts/benchOpenmed.js';

test('Synthetic benchmark text is sized and identifier-free', () => {
  const text = syntheticText(2000);
  assert.ok(text.length <= 2000 && text.length > 1900);
  assert.doesNotMatch(text, /\d{10}|@/);
});

test('Simulated benchmark reports latency, throughput, resources and recovery, labelled as simulated', async () => {
  const report = await benchmark({ simulate: true, workers: [1], concurrency: [2], requests: 4, sizes: [200],
    mode: 'diseases', timeout: 5000 });
  assert.match(report.label, /SIMULATED/);
  assert.match(report.caveat, /Not a procurement specification or SLA/);
  const run = report.runs[0];
  assert.ok(run.cold_start_ms > 0 && run.first_request_ms > 0);
  assert.equal(run.levels[0].ok, 4);
  assert.equal(run.levels[0].latency_ms.n, 4);
  assert.ok(run.recovery_ms_after_kill > 0 && run.full_recovery_ms >= run.recovery_ms_after_kill);
  assert.equal(run.pool.restarts, 1);
  assert.match(report.build.sha256, /^[0-9a-f]{64}$/);
});
