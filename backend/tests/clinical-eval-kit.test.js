// Independent-evaluation kit: split/freeze, pre-registered criteria, per-language reporting,
// inter-annotator agreement. Synthetic records only.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { assignSplit, cohenKappa, languageOf, checkCriteria } from '../clinical-context/evalKit.js';
import { splitRecords } from '../scripts/clinicalEvalSplit.js';
import { runEvaluation } from '../scripts/evalClinicalContext.js';
import { agreement } from '../scripts/annotatorAgreement.js';

const backend = fileURLToPath(new URL('..', import.meta.url));

test('Language groups are reported separately', () => {
  assert.equal(languageOf({ text: 'No diabetes.' }), 'en');
  assert.equal(languageOf({ text: 'لا يوجد سكري' }), 'ar');
  assert.equal(languageOf({ text: 'No diabetes لا يوجد' }), 'mixed');
  assert.equal(languageOf({ text: 'x', language: 'ar' }), 'ar');
});

test('Split assignment is deterministic, salted and close to the ratios', () => {
  const ids = Array.from({ length: 2000 }, (_, i) => `rec-${i}`);
  const a = ids.map(id => assignSplit(id, 'salt-1'));
  assert.deepEqual(ids.map(id => assignSplit(id, 'salt-1')), a);
  assert.notDeepEqual(ids.map(id => assignSplit(id, 'salt-2')), a);
  const share = s => a.filter(x => x === s).length / ids.length;
  assert.ok(Math.abs(share('dev') - 0.6) < 0.05 && Math.abs(share('test') - 0.2) < 0.05);
  assert.throws(() => splitRecords([{ id: 'x', text: 'a' }, { id: 'x', text: 'b' }], { salt: 's', ratios: [0.6, 0.2, 0.2] }), /Duplicate/);
});

test("Cohen's kappa matches the textbook value", () => {
  const pairs = [...Array(4).fill(['y', 'y']), ...Array(3).fill(['n', 'n']), ...Array(2).fill(['y', 'n']), ['n', 'y']];
  assert.deepEqual(cohenKappa(pairs), { n: 10, observed: 0.7, kappa: 0.4 });
});

test('Agreement report lists disagreements by id and position only', () => {
  const a = [{ id: 'r1', text: 'Secret-Name has no diabetes', entities: [{ phrase: 'diabetes', type: 'problem', gold: { assertion: 'absent' } }] }];
  const b = [{ id: 'r1', text: 'Secret-Name has no diabetes', entities: [{ phrase: 'diabetes', type: 'problem', gold: { assertion: 'present' } }] }];
  const r = agreement(a, b);
  assert.equal(r.entities_matched, 1);
  assert.deepEqual(r.attributes.assertion.disagreements, [{ id: 'r1', entity: 0, a: 'absent', b: 'present' }]);
  assert.ok(!JSON.stringify(r).includes('Secret-Name'));
});

test('Criteria are checked as registered; too little data never passes', () => {
  const report = { attributes: { assertion: { n: 10, accuracy: 0.9, accuracy_ci95: [0.6, 0.98], unknown_rate: 0.1,
    per_class: { absent: { support: 4, recall: 1, recall_ci95: [0.51, 1], precision: 0.8, f1: 0.89 } } } } };
  const results = checkCriteria(report, { criteria: [
    { id: 'c1', attribute: 'assertion', metric: 'accuracy', min: 0.85 },
    { id: 'c2', attribute: 'assertion', metric: 'accuracy', min: 0.85, use_lower_ci: true },
    { id: 'c3', attribute: 'assertion', metric: 'recall', class: 'absent', min: 0.9, min_n: 30 },
    { id: 'c4', attribute: 'experiencer', metric: 'accuracy', min: 0.5 },
    { id: 'c5', attribute: 'assertion', metric: 'unknown_rate_max', max: 0.05 }] });
  assert.deepEqual(results.map(r => r.result), ['pass', 'fail', 'insufficient_data', 'insufficient_data', 'fail']);
});

test('Frozen test split: hashes enforced, criteria must be the registered ones, every run logged', t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'evalkit-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  // Synthetic "hospital" file: the shipped dev records re-labelled, plus one Arabic record
  const dev = fs.readFileSync(path.join(backend, 'clinical-context/eval/dev.jsonl'), 'utf8').split('\n').filter(Boolean)
    .map(l => JSON.parse(l));
  const input = [...dev, { id: 'ar-1', text: 'لا يوجد سكري', entities: [] }].map(r => JSON.stringify({ ...r, split: undefined })).join('\n');
  fs.writeFileSync(path.join(dir, 'annotated.jsonl'), input);
  const criteria = { criteria: [{ id: 'negation-recall', attribute: 'assertion', metric: 'recall', class: 'absent', min: 0.8 }] };
  fs.writeFileSync(path.join(dir, 'criteria.json'), JSON.stringify(criteria));
  const out = path.join(dir, 'split');
  const r = spawnSync(process.execPath, ['scripts/clinicalEvalSplit.js', '--in', path.join(dir, 'annotated.jsonl'), '--out-dir', out,
    '--salt', 'synthetic', '--criteria', path.join(dir, 'criteria.json'), '--ratios', '0.34,0.33,0.33'], { cwd: backend, encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  assert.ok(!r.stdout.includes('diabetes'), 'the split script prints counts only');
  const manifest = path.join(out, 'manifest.json');
  const args = { file: path.join(out, 'test.jsonl'), split: 'test', manifest, criteria: path.join(dir, 'criteria.json'), heldOutConfirmed: true };

  assert.throws(() => runEvaluation({ ...args, manifest: undefined }), /manifest/);
  assert.throws(() => runEvaluation({ ...args, criteria: undefined }), /criteria/);
  const first = runEvaluation(args);
  assert.equal(first.test_run.number, 1);
  assert.equal(first.test_run.warning, null);
  assert.equal(first.criteria_results[0].id, 'negation-recall');
  assert.match(first.build.sha256, /^[0-9a-f]{64}$/);
  assert.ok(first.by_language.en);
  const second = runEvaluation(args);
  assert.equal(second.test_run.number, 2);
  assert.match(second.test_run.warning, /already evaluated 1 time/);

  fs.writeFileSync(path.join(dir, 'criteria.json'), JSON.stringify({ criteria: [{ ...criteria.criteria[0], min: 0.1 }] }));
  assert.throws(() => runEvaluation(args), /criteria differ/);
  fs.writeFileSync(path.join(dir, 'criteria.json'), JSON.stringify(criteria));
  fs.appendFileSync(args.file, '\n');
  assert.throws(() => runEvaluation(args), /changed after the split/);

  const all = ['dev', 'validation', 'test'].flatMap(s => fs.readFileSync(path.join(out, `${s}.jsonl`), 'utf8').split('\n').filter(l => l.trim()).map(l => JSON.parse(l).id));
  assert.equal(new Set(all).size, all.length, 'no record is in two splits');
  assert.equal(all.length, dev.length + 1);
});
