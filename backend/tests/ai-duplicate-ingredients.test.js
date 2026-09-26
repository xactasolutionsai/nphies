// P2.1 Active-ingredient duplication check (deterministic; no LLM).
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import pg from 'pg';
import jwt from 'jsonwebtoken';
import pool from '../db.js';
import app from '../server.js';
import { getJwtSecret } from '../config/auth.js';
import medbotService from '../services/medbotService.js';
import medicationSafetyService from '../services/medicationSafetyService.js';
import { normalizeIngredients, findDuplicateIngredients, checkDuplicateIngredients, toCodedItems } from '../services/ingredientDuplicates.js';

console.error = () => {};
console.warn = () => {};

test('Ingredient strings are normalized: case, separators, strengths, salt qualifiers', () => {
  assert.deepEqual(normalizeIngredients('PARACETAMOL 500 MG'), ['paracetamol']);
  assert.deepEqual(normalizeIngredients(' Paracetamol + Caffeine 65mg '), ['paracetamol', 'caffeine']);
  assert.deepEqual(normalizeIngredients('DEXTROSE|SODIUM CHLORIDE'), ['dextrose', 'sodium chloride']);
  assert.deepEqual(normalizeIngredients('amoxicillin/clavulanic acid; lactobacillus and zinc'),
    ['amoxicillin', 'clavulanic acid', 'lactobacillus', 'zinc']);
  assert.deepEqual(normalizeIngredients('CLINDAMYCIN (AS PHOSPHATE)'), ['clindamycin']);
  assert.deepEqual(normalizeIngredients('ACYCLOVIR 3 G/ 100 G, IBUPROFEN 200 MG/5 ML'), ['acyclovir', 'ibuprofen']);
  assert.deepEqual(normalizeIngredients('Sand and gravel'), ['sand', 'gravel'], "' and ' splits");
  assert.deepEqual(normalizeIngredients('Sandalwood'), ['sandalwood']);
  assert.deepEqual(normalizeIngredients(null), []);
  assert.deepEqual(normalizeIngredients(' , + '), []);
});

const rows = [
  { code: 'A', display: 'PANADOL 500 MG TABLET', ingredients: 'PARACETAMOL' },
  { code: 'B', display: 'PANADOL EXTRA', ingredients: 'Paracetamol 500 mg + Caffeine 65 mg' },
  { code: 'C', display: 'BRUFEN', ingredients: 'IBUPROFEN' },
  { code: 'D', display: 'NO DATA', ingredients: null }
];

test('Two different items sharing a normalized ingredient give a warn finding; same code twice too', () => {
  const result = findDuplicateIngredients(
    [{ sequence: 1, code: 'A' }, { sequence: 2, code: 'B' }, { sequence: 3, code: 'C' }, { sequence: 4, code: 'C' },
      { sequence: 5, code: 'ZZZ' }, { sequence: 6, code: 'D' }],
    rows);
  const shared = result.findings.filter(f => f.type === 'shared_ingredient');
  assert.deepEqual(shared, [{ type: 'shared_ingredient', severity: 'warn', ingredient: 'paracetamol', itemSequences: [1, 2], codes: ['A', 'B'],
    message: 'Items 1, 2 contain the same active ingredient (paracetamol).' }]);
  const same = result.findings.filter(f => f.type === 'same_code');
  assert.deepEqual(same, [{ type: 'same_code', severity: 'warn', ingredient: 'ibuprofen', itemSequences: [3, 4], codes: ['C'],
    message: 'Items 3, 4 use the same medication code (C).' }]);
  assert.deepEqual(result.unmatchedCodes, ['ZZZ']);
  assert.deepEqual(result.codesWithoutIngredients, ['D']);
});

test('Unknown codes are listed, never reported as "no duplicates"', () => {
  const result = findDuplicateIngredients([{ sequence: 1, code: 'X' }, { sequence: 2, code: 'Y' }], []);
  assert.deepEqual(result.findings, []);
  assert.deepEqual(result.unmatchedCodes, ['X', 'Y']);
});

test('checkDuplicateIngredients queries medication_codes by code and returns a rules envelope', async () => {
  const calls = [];
  const queryFn = async (sql, params) => { calls.push({ sql, params }); return { rows: rows.slice(0, 2) }; };
  const result = await checkDuplicateIngredients(toCodedItems(['A', 'B', 'Q']), { queryFn });
  assert.match(calls[0].sql, /FROM medication_codes/);
  assert.match(calls[0].sql, /code = ANY\(\$1\)/);
  assert.deepEqual(calls[0].params, [['A', 'B', 'Q']]);
  assert.equal(result.source, 'rules');
  assert.equal(result.certainty, 'medium', 'incomplete when a code is unknown');
  assert.equal(result.complete, false);
  assert.deepEqual(result.unmatchedCodes, ['Q']);
  assert.equal(result.findings.length, 1);
  assert.equal(result.basis.codesChecked, 3);
  assert.equal(result.basis.codesMatched, 2);
  const complete = await checkDuplicateIngredients(toCodedItems([{ sequence: 7, code: 'C' }]), { queryFn: async () => ({ rows: [rows[2]] }) });
  assert.equal(complete.certainty, 'high');
  assert.equal(complete.complete, true);
  assert.deepEqual(toCodedItems([' A ', { sequence: '3', code: 'B' }, '', { code: 'C' }]),
    [{ sequence: 1, code: 'A' }, { sequence: 3, code: 'B' }, { sequence: 4, code: 'C' }]);
});

test('Safety analysis runs the rule check before the LLM and still returns it when the LLM is down', async t => {
  const order = [];
  t.mock.method(pool, 'query', async (sql, params) => {
    order.push('sql');
    assert.deepEqual(params, [['A', 'B']]);
    return { rows: rows.slice(0, 2) };
  });
  t.mock.method(medbotService, 'generateCompletion', async () => { order.push('llm'); throw new Error('ECONNREFUSED'); });
  const result = await medicationSafetyService.analyzeMedicationSafety(
    [{ medicationName: 'Panadol', medicationCode: 'A' }, { medicationName: 'Panadol Extra', medicationCode: 'B' }], { age: 40 });
  assert.deepEqual(order, ['sql', 'llm']);
  assert.equal(result.success, true);
  assert.equal(result.ai.available, false);
  assert.equal(result.ruleFindings.source, 'rules');
  assert.equal(result.ruleFindings.findings[0].ingredient, 'paracetamol');
  assert.equal(result.analysis.analysisIncomplete, true, 'fails closed');
  assert.equal(result.analysis.overallRiskAssessment, 'unknown');

  // AI disabled: no LLM call at all, deterministic part still returned.
  const previous = process.env.AI_FEATURES_ENABLED;
  process.env.AI_FEATURES_ENABLED = 'false';
  t.after(() => { if (previous === undefined) delete process.env.AI_FEATURES_ENABLED; else process.env.AI_FEATURES_ENABLED = previous; });
  order.length = 0;
  const disabled = await medicationSafetyService.analyzeMedicationSafety([{ medicationName: 'Panadol', medicationCode: 'A' }, { medicationName: 'X', medicationCode: 'B' }]);
  assert.deepEqual(order, ['sql']);
  assert.equal(disabled.ai.available, false);
  assert.match(disabled.ai.reason, /disabled/);
  assert.equal(disabled.ruleFindings.findings.length, 1);
});

test('POST /api/medication-safety/duplicate-ingredients validates input and returns findings', async t => {
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); }));
  const base = `http://127.0.0.1:${server.address().port}`;
  let role = 'reviewer';
  t.mock.method(pool, 'query', async sql => {
    if (sql.includes('FROM users WHERE id')) return { rows: [{ id: 2, email: 'r@example.test', role }] };
    if (sql.includes('FROM medication_codes')) return { rows: rows.slice(0, 2) };
    return { rows: [] };
  });
  const headers = { Authorization: `Bearer ${jwt.sign({ userId: 2 }, getJwtSecret())}`, 'Content-Type': 'application/json' };
  const post = body => fetch(`${base}/api/medication-safety/duplicate-ingredients`, { method: 'POST', headers, body: JSON.stringify(body) });
  const ok = await post({ codes: ['A', 'B'] });
  assert.equal(ok.status, 200);
  const body = await ok.json();
  assert.equal(body.success, true);
  assert.equal(body.source, 'rules');
  assert.equal(body.findings[0].severity, 'warn');
  assert.deepEqual(body.findings[0].itemSequences, [1, 2]);
  assert.equal((await post({})).status, 400);
  assert.equal((await post({ codes: 'A' })).status, 400);
  assert.equal((await post({ codes: Array.from({ length: 101 }, (_, i) => `C${i}`) })).status, 400);
  assert.equal((await post({ codes: ['x'.repeat(51)] })).status, 400);
  role = 'viewer';
  assert.equal((await post({ codes: ['A'] })).status, 403);
});

test('Duplicate-ingredient SQL runs against the real medication_codes table', { skip: !process.env.TEST_DATABASE_URL }, async t => {
  const schema = `aidup_${crypto.randomUUID().replaceAll('-', '')}`;
  const client = new pg.Client({ connectionString: process.env.TEST_DATABASE_URL, options: `-c search_path=${schema},public` });
  await client.connect();
  t.after(async () => { await client.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`); await client.end(); });
  await client.query(`CREATE SCHEMA ${schema}`);
  const ddl = await fs.readFile(new URL('../migrations/create_medication_codes_table.sql', import.meta.url), 'utf8');
  // The extension line needs a superuser and is database-wide; the table and indexes are what matter here.
  await client.query(ddl.replace(/CREATE EXTENSION IF NOT EXISTS pg_trgm;/, '').replace(/CREATE INDEX IF NOT EXISTS \w+_trgm[^;]+;/g, ''));
  await client.query(`INSERT INTO medication_codes (code, display, ingredients) VALUES
    ('06281147005347', 'OLANA 5 MG', 'OLANZAPINE'), ('06281147009999', 'OLANZAPINE GENERIC', 'Olanzapine 10 mg'),
    ('06285096001627', 'NO INGREDIENTS', NULL)`);
  const result = await checkDuplicateIngredients(toCodedItems(['06281147005347', '06281147009999', '06285096001627', '00000000000000']),
    { queryFn: (sql, params) => client.query(sql, params) });
  assert.equal(result.findings.length, 1);
  assert.equal(result.findings[0].ingredient, 'olanzapine');
  assert.deepEqual(result.unmatchedCodes, ['00000000000000']);
  assert.deepEqual(result.codesWithoutIngredients, ['06285096001627']);
});
