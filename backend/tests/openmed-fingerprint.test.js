// Build fingerprint (openmed/fingerprint.js): changes with any output-deciding source file,
// ignores evaluation data, and is stable across runs.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { computeFingerprint, buildFingerprint } from '../openmed/fingerprint.js';

test('Fingerprint changes with code, not with evaluation files', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fp-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.mkdirSync(path.join(root, 'engine/eval'), { recursive: true });
  fs.writeFileSync(path.join(root, 'engine/rules.js'), 'export const a = 1;');
  fs.writeFileSync(path.join(root, 'engine/eval/dev.jsonl'), '{}');
  const paths = ['engine', 'missing.sql'];
  const one = computeFingerprint({ root, paths });
  assert.equal(one.files, 1);
  assert.equal(computeFingerprint({ root, paths }).sha256, one.sha256);
  fs.writeFileSync(path.join(root, 'engine/eval/dev.jsonl'), '{"changed":true}');
  assert.equal(computeFingerprint({ root, paths }).sha256, one.sha256);
  fs.writeFileSync(path.join(root, 'engine/rules.js'), 'export const a = 2;');
  assert.notEqual(computeFingerprint({ root, paths }).sha256, one.sha256);
});

test('The real fingerprint covers the clinical AI files', () => {
  const fp = buildFingerprint();
  assert.match(fp.sha256, /^[0-9a-f]{64}$/);
  assert.ok(fp.files >= 15, `${fp.files} files`);
  assert.ok(fp.context_engine && fp.summary_version);
});
