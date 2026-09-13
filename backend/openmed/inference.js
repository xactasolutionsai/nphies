import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';

const root = fileURLToPath(new URL('./', import.meta.url));
const defaultPython = fileURLToPath(new URL(process.platform === 'win32'
  ? '../.venv-openmed/Scripts/python.exe' : '../.venv-openmed/bin/python', import.meta.url));
let busy = false;
export function runtimeReady() {
  return fs.existsSync(process.env.OPENMED_PYTHON || defaultPython) && ['medications', 'diseases'].every(mode =>
    fs.existsSync(`${root}/openmed-models/${mode}/nafes-model.json`));
}
export function runLocalAnalysis(text, mode) {
  if (busy) throw Object.assign(new Error('OpenMed is busy; try again shortly'), { status: 429 });
  if (!runtimeReady()) throw Object.assign(new Error('Local OpenMed models are not installed'), { status: 503 });
  busy = true;
  return new Promise((resolve, reject) => {
    // Do not inherit database passwords, app JWTs, proxies, or provider credentials.
    const env = Object.fromEntries(['PATH', 'SystemRoot', 'WINDIR', 'TEMP', 'TMP', 'HOME', 'USERPROFILE']
      .filter(key => process.env[key]).map(key => [key, process.env[key]]));
    const child = spawn(process.env.OPENMED_PYTHON || defaultPython, [`${root}/worker.py`],
      { shell: false, windowsHide: true, env, stdio: ['pipe', 'pipe', 'pipe'] });
    let output = '', failed = false;
    const timer = setTimeout(() => { failed = true; child.kill(); }, 120000);
    child.stderr.resume(); // Never log model diagnostics or clinical text.
    child.stdout.on('data', data => {
      output += data.toString();
      if (output.length > 2000000) { failed = true; child.kill(); }
    });
    child.stdin.on('error', () => { failed = true; });
    child.on('error', () => { failed = true; });
    child.on('close', code => {
      clearTimeout(timer); busy = false;
      try {
        if (failed || code !== 0) throw new Error();
        const result = JSON.parse(output);
        if (!Array.isArray(result.entities) || result.advisory_only !== true) throw new Error();
        resolve(result);
      } catch {
        reject(Object.assign(new Error('Local OpenMed analysis failed or timed out'), { status: 503 }));
      }
    });
    child.stdin.end(JSON.stringify({ text, mode }));
  });
}
