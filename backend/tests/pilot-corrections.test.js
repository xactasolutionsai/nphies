// Pilot review -> development cases (scripts/exportPilotCorrections.js). Synthetic rows only.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { annotate } from '../clinical-context/index.js';
import { buildCorrectionRecords } from '../scripts/exportPilotCorrections.js';

const note = 'Metformin discontinued. No diabetes.';
const context = { status: 'ok', ...annotate(note, [
  { text: 'Metformin', start: 0, end: 9, type: 'medication' }, { text: 'diabetes', start: 27, end: 35, type: 'problem' }]) };

test('Accepted reviews confirm every context field; corrections only the corrected fields', () => {
  const { records } = buildCorrectionRecords([
    { analysis_id: 'a1', input_text: note, result: { context }, decision: 'accepted', corrections: [] },
    { analysis_id: 'a2', input_text: note, result: { context }, decision: 'corrected',
      corrections: [{ entity_index: 1, field: 'assertion', value: 'present' }] }]);
  assert.equal(records.length, 2);
  assert.ok(records.every(r => r.split === 'dev' && r.source === 'pilot_review'));
  assert.deepEqual(records[0].entities[0].gold, { assertion: 'present', experiencer: 'patient', temporality: 'historical', medication_status: 'discontinued' });
  assert.deepEqual(records[1].entities, [{ start: 27, end: 35, type: 'problem', gold: { assertion: 'present' } }]);
});

test('Rejected reviews, failed contexts and texts with identifiers are not exported', () => {
  const r = buildCorrectionRecords([
    { analysis_id: 'a', input_text: note, result: { context }, decision: 'rejected', corrections: [] },
    { analysis_id: 'b', input_text: note, result: { context: { status: 'failed' } }, decision: 'accepted', corrections: [] },
    { analysis_id: 'c', input_text: `${note} MRN: 55123`, result: { context }, decision: 'accepted', corrections: [] }]);
  assert.deepEqual([r.records.length, r.skipped_identifiers, r.skipped_without_context], [0, 1, 1]);
});

test('The export refuses to run without confirmation or into a test/validation file', () => {
  const cwd = fileURLToPath(new URL('..', import.meta.url));
  const run = args => spawnSync(process.execPath, ['scripts/exportPilotCorrections.js', ...args], { cwd, encoding: 'utf8' });
  assert.equal(run(['--pilot', 'x', '--out', 'dev.jsonl']).status, 2);
  const named = run(['--pilot', 'x', '--out', 'test-set.jsonl', '--i-confirm-authorised-environment']);
  assert.equal(named.status, 2);
  assert.match(named.stderr, /development data only/);
});
