// Evaluation harness (scripts/evalClinicalContext.js): metrics are correct, reports never
// contain note or entity text, and the held-out split cannot be run by accident.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { evaluate, wilson } from '../scripts/evalClinicalContext.js';

const script = fileURLToPath(new URL('../scripts/evalClinicalContext.js', import.meta.url));
const cwd = fileURLToPath(new URL('..', import.meta.url));

test('Wilson interval matches the published formula', () => {
  const [lo, hi] = wilson(8, 10);
  assert.ok(Math.abs(lo - 0.4902) < 1e-3 && Math.abs(hi - 0.9433) < 1e-3);
  assert.equal(wilson(0, 0), null);
});

test('Scores only annotated attributes and reports errors without text', () => {
  const secret = 'Zyxwq Synthetic-Name';
  const report = evaluate([{ id: 'r1', text: `${secret} has no diabetes.`, entities: [
    { phrase: 'diabetes', type: 'problem', gold: { assertion: 'present' } }] }]);
  assert.equal(report.attributes.assertion.n, 1);
  assert.equal(report.attributes.assertion.correct, 0);
  assert.deepEqual(report.attributes.assertion.errors, [{ id: 'r1', entity: 0, gold: 'present', pred: 'absent' }]);
  assert.equal(report.attributes.experiencer, undefined);
  assert.ok(!JSON.stringify(report).includes('Zyxwq'));
  assert.ok(!JSON.stringify(report).includes('diabetes'));
});

test('Refused Arabic records are counted as invalid, not scored', () => {
  const report = evaluate([{ id: 'ar1', text: 'لا يوجد سكري', entities: [] }]);
  assert.deepEqual(report.invalid, [{ id: 'ar1', problem: 'language_refused' }]);
});

test('The held-out test split needs explicit confirmation', () => {
  const r = spawnSync(process.execPath, [script, '--file', 'clinical-context/eval/dev.jsonl', '--split', 'test'], { cwd, encoding: 'utf8' });
  assert.equal(r.status, 2);
  assert.match(r.stderr, /held out/);
});

test('Shipped dev and validation files are well-formed and fully resolvable', () => {
  for (const [file, split] of [['clinical-context/eval/dev.jsonl', 'dev'], ['clinical-context/eval/validation.jsonl', 'validation']]) {
    const r = spawnSync(process.execPath, [script, '--file', file, '--split', split, '--json'], { cwd, encoding: 'utf8' });
    assert.equal(r.status, 0, r.stderr);
    const report = JSON.parse(r.stdout);
    assert.ok(report.records > 0);
    assert.deepEqual(report.invalid, []);
  }
});
