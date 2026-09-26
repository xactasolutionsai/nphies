// Runs the Python protocol tests of openmed/worker.py (fake backend; no model, no torch).
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const cwd = fileURLToPath(new URL('..', import.meta.url));
const python = process.env.OPENMED_TEST_PYTHON || 'python3';
const available = spawnSync(python, ['--version']).status === 0;

test('OpenMed worker protocol (Python unit tests)', { skip: !available && 'python3 not available' }, () => {
  const r = spawnSync(python, ['-m', 'unittest', 'tests/python/test_openmed_worker.py'], { cwd, encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stderr, /OK/);
});
