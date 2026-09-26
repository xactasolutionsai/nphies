#!/usr/bin/env node
// Test double for openmed/worker.py: same JSON-lines protocol, no model. Behaviour is
// driven by markers in the request text so tests can exercise the pool's failure paths.
import readline from 'node:readline';

let served = 0;
const readyDelay = Number(process.env.FAKE_READY_DELAY_MS || 0);
if (process.env.FAKE_NO_READY !== '1') {
  setTimeout(() => process.stdout.write(`${JSON.stringify({ type: 'ready', sdk_version: 'fake', preloaded: [] })}\n`), readyDelay);
}
const rl = readline.createInterface({ input: process.stdin });
rl.on('line', async line => {
  const { id, text, mode } = JSON.parse(line);
  if (text.includes('__CRASH__')) process.exit(3);
  if (text.includes('__HANG__')) return;
  if (text.includes('__HUGE__')) { process.stdout.write('x'.repeat(3_000_000)); return; }
  const slow = /__SLOW:(\d+)__/.exec(text);
  if (slow) await new Promise(r => setTimeout(r, Number(slow[1])));
  // Optional simulated cost for harness checks: base + per 1000 characters (not a model measurement).
  const simulated = Number(process.env.FAKE_BASE_MS || 0) + Number(process.env.FAKE_MS_PER_KCHAR || 0) * text.length / 1000;
  if (simulated > 0) await new Promise(r => setTimeout(r, simulated));
  if (text.includes('__WRONGID__')) process.stdout.write(`${JSON.stringify({ id: 'someone-else', ok: true, result: { entities: [], advisory_only: true } })}\n`);
  const error = /__ERR:([a-z_]+)__/.exec(text);
  if (error) { process.stdout.write(`${JSON.stringify({ id, ok: false, error: error[1] })}\n`); return; }
  served++;
  const entities = [];
  for (let i = text.indexOf('metformin'); i >= 0; i = text.indexOf('metformin', i + 1)) {
    entities.push({ text: 'metformin', label: 'CHEM', confidence: 0.9, start: i, end: i + 9 });
  }
  process.stdout.write(`${JSON.stringify({ id, ok: true, result: { entities, model: { id: 'fake', revision: 'none' },
    advisory_only: true, language: 'en', mode, pid: process.pid, served } })}\n`);
});
