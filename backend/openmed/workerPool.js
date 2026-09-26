/**
 * Pool of persistent OpenMed workers (openmed/worker.py, JSON-lines protocol).
 *
 * - Models stay loaded: each worker process serves many requests, one at a time.
 * - Bounded FIFO queue: a full queue answers 429 at once; a request that waits too long 503.
 * - Per-request timeout: the stuck worker is killed (inference cannot be interrupted safely)
 *   and replaced; the caller gets 504.
 * - Cancellation: a caller that goes away leaves the queue; a running request is discarded.
 * - Recovery: a worker that exits is restarted with back-off; its request fails with 503.
 * - Nothing in status() or in error messages contains request text.
 */
import { spawn as nodeSpawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { performance } from 'node:perf_hooks';

const fail = (message, status, code) => Object.assign(new Error(message), { status, code });

const WORKER_ERRORS = {
  arabic_not_supported: ['Configured models support English text only; Arabic clinical accuracy is not validated', 400],
  invalid_input: ['Invalid advisory input', 400],
  unsupported_mode: ['Invalid advisory input', 400],
  invalid_json: ['Invalid advisory input', 400],
  invalid_request_id: ['Invalid advisory input', 400],
  request_too_large: ['Invalid advisory input', 400],
  model_unavailable: ['Local OpenMed models are not installed', 503],
  analysis_failed: ['Local OpenMed analysis failed', 503]
};

export function percentiles(values) {
  if (!values.length) return { n: 0, p50: null, p95: null, p99: null, max: null };
  const sorted = [...values].sort((a, b) => a - b);
  const at = p => sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1))];
  const round = v => Math.round(v * 10) / 10;
  return { n: sorted.length, p50: round(at(50)), p95: round(at(95)), p99: round(at(99)), max: round(sorted.at(-1)) };
}

export class WorkerPool {
  constructor({
    command, args = [], env = {}, size = 1, maxQueue = 8, queueTimeoutMs = 30000, requestTimeoutMs = 120000,
    startTimeoutMs = 300000, maxLineBytes = 2_000_000, restartBackoffMs = [1000, 5000, 30000], spawn = nodeSpawn
  }) {
    Object.assign(this, { command, args, env, size, maxQueue, queueTimeoutMs, requestTimeoutMs, startTimeoutMs,
      maxLineBytes, restartBackoffMs, spawnFn: spawn });
    this.workers = [];
    this.queue = [];
    this.started = false;
    this.closed = false;
    this.stats = { completed: 0, failed: 0, timeouts: 0, crashes: 0, restarts: 0, cancelled: 0,
      rejected_queue_full: 0, rejected_queue_wait: 0 };
    this.serviceMs = [];
    this.totalMs = [];
    this.startupMs = [];
  }

  analyze(text, mode, { signal } = {}) {
    if (this.closed) return Promise.reject(fail('OpenMed runtime is shutting down', 503));
    if (signal?.aborted) return Promise.reject(fail('Request cancelled', 499, 'cancelled'));
    this.#ensureStarted();
    if (this.queue.length >= this.maxQueue) {
      this.stats.rejected_queue_full++;
      return Promise.reject(fail('OpenMed is busy; the queue is full, try again shortly', 429, 'queue_full'));
    }
    return new Promise((resolve, reject) => {
      const job = { id: randomUUID(), text, mode, enqueuedAt: performance.now(), settled: false, signal };
      job.settle = (error, result) => {
        if (job.settled) return;
        job.settled = true;
        clearTimeout(job.queueTimer);
        clearTimeout(job.requestTimer);
        signal?.removeEventListener('abort', job.onAbort);
        if (error) reject(error); else resolve(result);
      };
      job.queueTimer = setTimeout(() => {
        if (!this.#dequeue(job)) return;
        this.stats.rejected_queue_wait++;
        job.settle(fail('OpenMed is busy; try again shortly', 503, 'queue_timeout'));
      }, this.queueTimeoutMs);
      job.onAbort = () => {
        this.stats.cancelled++;
        // Queued: leave the queue. Running: the worker finishes, the result is discarded.
        this.#dequeue(job);
        job.settle(fail('Request cancelled', 499, 'cancelled'));
      };
      signal?.addEventListener('abort', job.onAbort, { once: true });
      this.queue.push(job);
      this.#dispatch();
    });
  }

  status() {
    return {
      size: this.size,
      workers: this.workers.map(w => ({ pid: w.child?.pid ?? null, state: w.state, served: w.served, restarts: w.restarts,
        startup_ms: w.startupMs ?? null, uptime_s: w.readyAt ? Math.round((performance.now() - w.readyAt) / 1000) : 0 })),
      queued: this.queue.length,
      in_flight: this.workers.filter(w => w.state === 'busy').length,
      stats: { ...this.stats },
      latency_ms: { service: percentiles(this.serviceMs), total: percentiles(this.totalMs) },
      startup_ms: percentiles(this.startupMs),
      limits: { max_queue: this.maxQueue, queue_timeout_ms: this.queueTimeoutMs, request_timeout_ms: this.requestTimeoutMs }
    };
  }

  async close() {
    this.closed = true;
    for (const job of this.queue.splice(0)) job.settle(fail('OpenMed runtime is shutting down', 503));
    await Promise.all(this.workers.map(w => new Promise(resolve => {
      w.current?.settle(fail('OpenMed runtime is shutting down', 503));
      clearTimeout(w.restartTimer);
      if (w.state === 'dead') return resolve();
      w.child.once('exit', resolve);
      w.child.kill('SIGTERM');
      setTimeout(() => { w.child.kill('SIGKILL'); resolve(); }, 2000).unref();
    })));
  }

  #ensureStarted() {
    if (this.started) return;
    this.started = true;
    for (let i = 0; i < this.size; i++) this.workers.push(this.#spawn({ restarts: 0, served: 0, failures: 0 }));
  }

  #dequeue(job) {
    const index = this.queue.indexOf(job);
    if (index < 0) return false;
    this.queue.splice(index, 1);
    return true;
  }

  #spawn(slot) {
    const worker = Object.assign(slot, { state: 'starting', current: null, buffer: '', spawnedAt: performance.now(),
      readyAt: null, killedByPool: false });
    let child;
    try {
      child = this.spawnFn(this.command, this.args,
        { env: this.env, stdio: ['pipe', 'pipe', 'ignore'], shell: false, windowsHide: true });
    } catch {
      worker.state = 'dead';
      this.#scheduleRestart(worker);
      return worker;
    }
    worker.child = child;
    worker.startTimer = setTimeout(() => child.kill('SIGKILL'), this.startTimeoutMs);
    child.stdin.on('error', () => {});
    child.on('error', () => {});
    child.stdout.on('data', chunk => this.#onData(worker, chunk));
    child.on('exit', () => this.#onExit(worker));
    return worker;
  }

  #onData(worker, chunk) {
    worker.buffer += chunk.toString('utf8');
    let newline;
    while ((newline = worker.buffer.indexOf('\n')) >= 0) {
      const line = worker.buffer.slice(0, newline);
      worker.buffer = worker.buffer.slice(newline + 1);
      this.#onLine(worker, line);
    }
    if (worker.buffer.length > this.maxLineBytes) {
      worker.buffer = '';
      if (worker.current) this.stats.failed++;
      worker.current?.settle(fail('Local OpenMed analysis produced an invalid response', 503, 'invalid_response'));
      worker.killedByPool = true;
      worker.child.kill('SIGKILL');
    }
  }

  #onLine(worker, line) {
    let message;
    try { message = JSON.parse(line); } catch { return; }
    if (message?.type === 'ready') {
      clearTimeout(worker.startTimer);
      worker.state = 'idle';
      worker.readyAt = performance.now();
      worker.startupMs = Math.round(worker.readyAt - worker.spawnedAt);
      this.startupMs.push(worker.startupMs);
      this.#dispatch();
      return;
    }
    const job = worker.current;
    if (!job || message?.id !== job.id) return;          // stale or foreign response: ignore
    clearTimeout(job.requestTimer);
    worker.current = null;
    worker.state = 'idle';
    worker.served++;
    worker.failures = 0;
    const now = performance.now();
    this.#record(this.serviceMs, now - job.startedAt);
    this.#record(this.totalMs, now - job.enqueuedAt);
    if (job.settled) {
      // The caller cancelled while the worker was running; the result is discarded.
    } else if (message.ok === true && Array.isArray(message.result?.entities) && message.result.advisory_only === true) {
      this.stats.completed++;
      job.settle(null, message.result);
    } else {
      this.stats.failed++;
      const [text, status] = WORKER_ERRORS[message.error] || WORKER_ERRORS.analysis_failed;
      job.settle(fail(text, status, message.error || 'analysis_failed'));
    }
    this.#dispatch();
  }

  #onExit(worker) {
    clearTimeout(worker.startTimer);
    const job = worker.current;
    worker.current = null;
    worker.state = 'dead';
    if (job && !worker.killedByPool) {
      this.stats.crashes++;
      job.settle(fail('OpenMed worker stopped during analysis', 503, 'worker_crashed'));
    }
    if (!this.closed) this.#scheduleRestart(worker);
  }

  #scheduleRestart(worker) {
    const delay = this.restartBackoffMs[Math.min(worker.failures, this.restartBackoffMs.length - 1)];
    worker.failures++;
    worker.restartTimer = setTimeout(() => {
      if (this.closed) return;
      worker.restarts++;
      this.stats.restarts++;
      this.#spawn(worker);
    }, delay);
    worker.restartTimer.unref?.();
  }

  #dispatch() {
    for (const worker of this.workers) {
      if (worker.state !== 'idle') continue;
      const job = this.queue.shift();
      if (!job) return;
      clearTimeout(job.queueTimer);
      worker.state = 'busy';
      worker.current = job;
      job.startedAt = performance.now();
      job.requestTimer = setTimeout(() => {
        this.stats.timeouts++;
        worker.killedByPool = true;
        job.settle(fail('Local OpenMed analysis timed out', 504, 'timeout'));
        worker.child.kill('SIGKILL');
      }, this.requestTimeoutMs);
      worker.child.stdin.write(`${JSON.stringify({ id: job.id, text: job.text, mode: job.mode })}\n`);
    }
  }

  #record(list, value) {
    list.push(value);
    if (list.length > 500) list.shift();
  }
}
