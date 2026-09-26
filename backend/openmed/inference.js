import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import { WorkerPool } from './workerPool.js';

const root = fileURLToPath(new URL('./', import.meta.url));
const defaultPython = fileURLToPath(new URL(process.platform === 'win32'
  ? '../.venv-openmed/Scripts/python.exe' : '../.venv-openmed/bin/python', import.meta.url));
const intEnv = (name, fallback) => {
  const value = Number.parseInt(process.env[name] ?? '', 10);
  return Number.isInteger(value) && value > 0 ? value : fallback;
};

export function runtimeReady() {
  return fs.existsSync(process.env.OPENMED_PYTHON || defaultPython) && ['medications', 'diseases'].every(mode =>
    fs.existsSync(`${root}/openmed-models/${mode}/nafes-model.json`));
}

let pool = null;
/** The process-wide pool of persistent workers, created on first use from OPENMED_* settings. */
export function getPool() {
  if (!pool) {
    // Do not inherit database passwords, app JWTs, proxies, or provider credentials.
    const env = Object.fromEntries(['PATH', 'SystemRoot', 'WINDIR', 'TEMP', 'TMP', 'HOME', 'USERPROFILE']
      .filter(key => process.env[key]).map(key => [key, process.env[key]]));
    if (process.env.OPENMED_PRELOAD) env.OPENMED_PRELOAD = process.env.OPENMED_PRELOAD;
    if (process.env.OPENMED_TORCH_THREADS) env.OPENMED_TORCH_THREADS = process.env.OPENMED_TORCH_THREADS;
    pool = new WorkerPool({
      command: process.env.OPENMED_PYTHON || defaultPython,
      args: [`${root}/worker.py`],
      env,
      size: intEnv('OPENMED_WORKERS', 1),
      maxQueue: intEnv('OPENMED_MAX_QUEUE', 8),
      queueTimeoutMs: intEnv('OPENMED_QUEUE_TIMEOUT_MS', 30000),
      requestTimeoutMs: intEnv('OPENMED_TIMEOUT_MS', 120000)
    });
  }
  return pool;
}

export function runtimeStatus() {
  return pool ? pool.status() : { started: false };
}

export async function closeRuntime() {
  if (pool) await pool.close();
  pool = null;
}

export function runLocalAnalysis(text, mode, { signal } = {}) {
  if (!runtimeReady()) return Promise.reject(Object.assign(new Error('Local OpenMed models are not installed'), { status: 503 }));
  return getPool().analyze(text, mode, { signal });
}
