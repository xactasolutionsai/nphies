#!/usr/bin/env node
/**
 * Load and recovery benchmark for the OpenMed worker pool, to be run on hardware comparable
 * to the hospital's, with the real models installed. It never touches the database or the
 * network and uses synthetic English text only.
 *
 *   node scripts/benchOpenmed.js --workers 1,2 --concurrency 1,4,8 --requests 40 \
 *        --sizes 300,3000,10000 --mode diseases --out bench.json
 *   node scripts/benchOpenmed.js --simulate ...   # fake worker: checks the harness only
 *
 * Measures, per pool size: cold start (spawn to ready, model preloaded), first-request
 * latency, warm latency p50/p95/p99 and throughput per concurrency level and text size,
 * error and rejection counts, worker memory (RSS / peak) and CPU seconds from /proc, and
 * recovery time after a worker is killed.
 *
 * The numbers describe this machine, these settings and synthetic text. They are not a
 * procurement specification or an SLA: those need the hospital's expected users, volumes
 * and response-time limits, tested on its hardware.
 */
import fs from 'node:fs';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';
import { WorkerPool, percentiles } from '../openmed/workerPool.js';
import { computeFingerprint } from '../openmed/fingerprint.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const list = v => String(v).split(',').map(Number).filter(n => Number.isInteger(n) && n > 0);

function parseArgs(argv) {
  const a = { workers: [1], concurrency: [1, 4], requests: 20, sizes: [300, 3000], mode: 'diseases', simulate: false,
    out: null, timeout: 120000, python: process.env.OPENMED_PYTHON || `${ROOT}.venv-openmed/bin/python` };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i], v = argv[i + 1];
    if (k === '--workers') { a.workers = list(v); i++; }
    else if (k === '--concurrency') { a.concurrency = list(v); i++; }
    else if (k === '--requests') { a.requests = Number(v); i++; }
    else if (k === '--sizes') { a.sizes = list(v); i++; }
    else if (k === '--mode') { a.mode = v; i++; }
    else if (k === '--out') { a.out = v; i++; }
    else if (k === '--timeout') { a.timeout = Number(v); i++; }
    else if (k === '--python') { a.python = v; i++; }
    else if (k === '--simulate') a.simulate = true;
  }
  return a;
}

// Synthetic, identifier-free clinical-style sentences.
const SENTENCES = [
  'Patient reports intermittent chest pain on exertion.', 'No fever or cough.', 'Takes metformin 500 mg twice daily.',
  'History of hypertension, well controlled.', 'Mother has type 2 diabetes.', 'Pneumonia ruled out on chest x-ray.',
  'Plan to start atorvastatin 20 mg nightly.', 'Allergic to penicillin.', 'Denies shortness of breath.'
];
export function syntheticText(chars) {
  let text = '', i = 0;
  while (text.length < chars) text += `${SENTENCES[i++ % SENTENCES.length]} `;
  return text.slice(0, chars).trim();
}

function procStats(pid) {
  try {
    const status = fs.readFileSync(`/proc/${pid}/status`, 'utf8');
    const kb = key => Number((status.match(new RegExp(`${key}:\\s+(\\d+)`)) || [])[1] || 0);
    const stat = fs.readFileSync(`/proc/${pid}/stat`, 'utf8').split(') ')[1].split(' ');
    const ticks = 100;   // USER_HZ on Linux
    return { rss_mb: kb('VmRSS') / 1024, peak_rss_mb: kb('VmHWM') / 1024, cpu_s: (Number(stat[11]) + Number(stat[12])) / ticks };
  } catch { return null; }
}

function poolFor(args, size) {
  const fake = fileURLToPath(new URL('../tests/fixtures/fake-openmed-worker.mjs', import.meta.url));
  const env = { PATH: process.env.PATH, HOME: process.env.HOME || '', OPENMED_PRELOAD: args.mode,
    ...(args.simulate ? { FAKE_BASE_MS: '20', FAKE_MS_PER_KCHAR: '5', FAKE_READY_DELAY_MS: '200' } : {}) };
  return new WorkerPool({
    command: args.simulate ? process.execPath : args.python,
    args: [args.simulate ? fake : `${ROOT}openmed/worker.py`],
    env, size, maxQueue: 100000, queueTimeoutMs: 600000, requestTimeoutMs: args.timeout, restartBackoffMs: [200]
  });
}

async function waitReady(pool, size) {
  const start = Date.now();
  while (pool.status().workers.filter(w => w.state === 'idle').length < size) {
    if (Date.now() - start > 600000) throw new Error('workers did not start');
    await new Promise(r => setTimeout(r, 20));
  }
}

async function runLevel(pool, args, concurrency, text) {
  const service = [], errors = {};
  let next = 0;
  const started = performance.now();
  await Promise.all(Array.from({ length: concurrency }, async () => {
    while (next < args.requests) {
      next++;
      const t0 = performance.now();
      try { await pool.analyze(text, args.mode); service.push(performance.now() - t0); }
      catch (e) { errors[e.code || e.status || 'error'] = (errors[e.code || e.status || 'error'] || 0) + 1; }
    }
  }));
  const seconds = (performance.now() - started) / 1000;
  return { concurrency, text_chars: text.length, requests: args.requests, ok: service.length, errors,
    error_rate: (args.requests - service.length) / args.requests, throughput_rps: Math.round((service.length / seconds) * 100) / 100,
    latency_ms: percentiles(service) };
}

export async function benchmark(args) {
  const report = {
    label: args.simulate ? 'SIMULATED (fake worker; harness check only, not a model measurement)' : 'REAL MODEL',
    caveat: 'Valid only for this hardware, these settings and synthetic text. Not a procurement specification or SLA.',
    machine: { platform: `${os.platform()} ${os.release()}`, cpus: os.cpus().length, cpu_model: os.cpus()[0]?.model,
      memory_gb: Math.round(os.totalmem() / 1e9 * 10) / 10, node: process.version },
    build: computeFingerprint(), mode: args.mode, runs: []
  };
  for (const size of args.workers) {
    const pool = poolFor(args, size);
    const spawnAt = performance.now();
    pool.analyze(syntheticText(50), args.mode).catch(() => {});      // starts the workers
    await waitReady(pool, size);
    const coldStartMs = Math.round(performance.now() - spawnAt);
    const t0 = performance.now();
    await pool.analyze(syntheticText(args.sizes[0]), args.mode);
    const firstRequestMs = Math.round(performance.now() - t0);
    const levels = [];
    for (const chars of args.sizes) {
      const text = syntheticText(chars);
      for (const concurrency of args.concurrency) levels.push(await runLevel(pool, args, concurrency, text));
    }
    const resources = pool.status().workers.map(w => ({ pid: w.pid, ...procStats(w.pid) }));
    // Recovery: kill one worker and time until the pool answers again.
    const victim = pool.status().workers[0].pid;
    const killedAt = performance.now();
    process.kill(victim, 'SIGKILL');
    await new Promise(r => setTimeout(r, 50));
    let recoveryMs = null;
    for (let attempt = 0; attempt < 600 && recoveryMs === null; attempt++) {
      try { await pool.analyze(syntheticText(100), args.mode); recoveryMs = Math.round(performance.now() - killedAt); }
      catch { await new Promise(r => setTimeout(r, 100)); }
    }
    // Full recovery: the killed worker itself is back (model reloaded) and idle.
    let fullRecoveryMs = null;
    for (let attempt = 0; attempt < 6000 && fullRecoveryMs === null; attempt++) {
      const workers = pool.status().workers;
      if (workers.every(w => w.state === 'idle') && !workers.some(w => w.pid === victim)) fullRecoveryMs = Math.round(performance.now() - killedAt);
      else await new Promise(r => setTimeout(r, 50));
    }
    report.runs.push({ workers: size, cold_start_ms: coldStartMs, first_request_ms: firstRequestMs, levels,
      resources, recovery_ms_after_kill: recoveryMs, full_recovery_ms: fullRecoveryMs, pool: pool.status().stats });
    await pool.close();
  }
  return report;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.simulate && !fs.existsSync(args.python)) {
    console.error('Python for OpenMed not found. Install the runtime (docs/OPENMED_ADVISORY.md) or use --simulate to check the harness.');
    process.exit(2);
  }
  const report = await benchmark(args);
  if (args.out) fs.writeFileSync(args.out, JSON.stringify(report, null, 2));
  console.log(report.label);
  console.log(report.caveat);
  for (const run of report.runs) {
    console.log(`\nworkers=${run.workers} cold_start=${run.cold_start_ms}ms first_request=${run.first_request_ms}ms ` +
      `recovery=${run.recovery_ms_after_kill}ms full_recovery=${run.full_recovery_ms}ms`);
    for (const l of run.levels) {
      console.log(`  chars=${String(l.text_chars).padStart(6)} conc=${String(l.concurrency).padStart(3)} ` +
        `p50=${l.latency_ms.p50} p95=${l.latency_ms.p95} p99=${l.latency_ms.p99} ms  ${l.throughput_rps} req/s  errors=${l.error_rate}`);
    }
    for (const r of run.resources) console.log(`  worker rss=${r.rss_mb?.toFixed(0)}MB peak=${r.peak_rss_mb?.toFixed(0)}MB cpu=${r.cpu_s}s`);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) main();
