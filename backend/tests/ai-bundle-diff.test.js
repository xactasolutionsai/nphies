// P2.2 Failed vs nearest successful bundle diff (deterministic; optional LLM explanation).
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import pg from 'pg';
import jwt from 'jsonwebtoken';
import pool from '../db.js';
import app from '../server.js';
import { getJwtSecret } from '../config/auth.js';
import { normalizeBundle, diffBundles, claimProfile } from '../services/bundleDiff.js';
import { compareWithLastAccepted, explainComparison, CompareError } from '../services/compareSuccessService.js';

console.error = () => {};
console.warn = () => {};

const PROFILE = 'http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/pharmacy-priorauth|1.0.0';
const EXT = 'http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-';

function bundle({ uuid = crypto.randomUUID(), withMaternity = true, medCode = '06281147005347', extraNote = false,
  patientName = 'Fatimah Al-Harbi', nationalId = '1098765432', amount = 200, profile = PROFILE } = {}) {
  const item = {
    sequence: 1,
    extension: [
      { url: `${EXT}package`, valueBoolean: false },
      ...(withMaternity ? [{ url: `${EXT}maternity`, valueBoolean: false }] : [])
    ],
    productOrService: { coding: [{ system: 'http://nphies.sa/terminology/CodeSystem/medication-codes', code: medCode, display: 'OLANA 5 MG' }] },
    net: { value: amount, currency: 'SAR' },
    servicedDate: '2026-04-23'
  };
  return {
    resourceType: 'Bundle', id: uuid, type: 'message', timestamp: '2026-04-23T10:00:00+03:00',
    meta: { profile: ['http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/bundle|1.0.0'] },
    entry: [
      { fullUrl: `http://provider.example/Claim/${uuid}`, resource: {
        resourceType: 'Claim', id: uuid, meta: { profile: [profile] }, use: 'preauthorization', created: '2026-04-23T10:00:00+03:00',
        identifier: [{ system: 'http://provider.example/authorization', value: `req-${uuid}` }],
        patient: { reference: `Patient/${uuid}` },
        item: [item],
        ...(extraNote ? { note: [{ text: `Called ${patientName} on 0551234567` }] } : {}),
        total: { value: amount, currency: 'SAR' }
      } },
      { fullUrl: `http://provider.example/Patient/${uuid}`, resource: {
        resourceType: 'Patient', id: uuid,
        identifier: [{ system: 'http://nphies.sa/identifier/nationalid', value: nationalId }],
        name: [{ text: patientName, family: patientName.split(' ').at(-1), given: [patientName.split(' ')[0]] }],
        telecom: [{ system: 'phone', value: '0551234567' }],
        gender: 'female', birthDate: '1990-05-05'
      } }
    ]
  };
}

test('Normalization drops volatile values and keeps codes, systems, profiles and structure only', () => {
  const map = normalizeBundle(bundle({ uuid: '11111111-1111-4111-8111-111111111111' }));
  const keys = [...map.keys()];
  assert.ok(!keys.some(k => /\.id$|fullUrl|timestamp|created$/.test(k)), keys.join('\n'));
  assert.deepEqual([...map.get('Claim.meta.profile')], [PROFILE]);
  assert.deepEqual([...map.get('Claim.patient.reference')], ['Patient/{id}']);
  assert.deepEqual([...map.get('Claim.identifier[http://provider.example/authorization].value')], ['{value}']);
  assert.deepEqual([...map.get('Claim.item[].productOrService.coding[http://nphies.sa/terminology/CodeSystem/medication-codes].code')], ['06281147005347']);
  assert.deepEqual([...map.get('Claim.item[].productOrService.coding[http://nphies.sa/terminology/CodeSystem/medication-codes].display')], ['{value}']);
  assert.deepEqual([...map.get('Claim.item[].net.value')], ['{amount}']);
  assert.deepEqual([...map.get('Claim.item[].servicedDate')], ['{date}']);
  assert.deepEqual([...map.get(`Claim.item[].extension[${EXT}maternity].valueBoolean`)], ['false']);
  assert.deepEqual([...map.get('Patient.gender')], ['{value}']);
  assert.deepEqual([...map.get('Patient.identifier[http://nphies.sa/identifier/nationalid].value')], ['{value}']);
  assert.deepEqual([...normalizeBundle(bundle(), { includeAmounts: true }).get('Claim.item[].net.value')], ['200']);
  assert.equal(claimProfile(bundle()), JSON.stringify([PROFILE]));
  assert.equal(claimProfile({ resourceType: 'Bundle' }), null);
});

test('Diff reports missing / extra / different paths, collapses subtrees, and never shows patient values', () => {
  const failed = bundle({ withMaternity: false, medCode: '99999999999999', extraNote: true, patientName: 'Fatimah Al-Harbi', nationalId: '1098765432', amount: 999 });
  const reference = bundle({ patientName: 'Other Person', nationalId: '2012345678' });
  const { diff, truncated, summary } = diffBundles(failed, reference);
  assert.equal(truncated, false);
  const byPath = Object.fromEntries(diff.map(d => [d.path, d]));
  assert.deepEqual(byPath[`Claim.item[].extension[${EXT}maternity]`], { path: `Claim.item[].extension[${EXT}maternity]`, kind: 'missing', failed: null, reference: null });
  assert.deepEqual(byPath['Claim.note[]'], { path: 'Claim.note[]', kind: 'extra', failed: null, reference: null });
  assert.deepEqual(byPath['Claim.item[].productOrService.coding[http://nphies.sa/terminology/CodeSystem/medication-codes].code'],
    { path: 'Claim.item[].productOrService.coding[http://nphies.sa/terminology/CodeSystem/medication-codes].code', kind: 'different',
      failed: ['99999999999999'], reference: ['06281147005347'] });
  assert.ok(!byPath['Claim.item[].net.value'], 'amounts are ignored by default');
  assert.deepEqual(summary, { missing: 1, extra: 1, different: 1 });
  const text = JSON.stringify(diff);
  for (const phi of ['Fatimah', 'Harbi', '1098765432', '2012345678', '0551234567', 'Other Person', '1990-05-05']) {
    assert.ok(!text.includes(phi), `${phi} leaked`);
  }
  assert.deepEqual(diffBundles(bundle(), bundle()).diff, [], 'identical structure after normalization');
  const many = diffBundles(bundle(), { resourceType: 'Bundle', entry: [] }, { limit: 2 });
  assert.equal(many.diff.length, 2);
  assert.equal(many.truncated, true);
});

test('Diff values: numbers sort numerically, truncated lists keep the differing values and say how many are hidden', () => {
  const claim = sequences => ({ resourceType: 'Bundle', entry: [{ resource: { resourceType: 'Claim', item: sequences.map(sequence => ({ sequence })) } }] });
  const row = (failed, reference) => diffBundles(claim(failed), claim(reference)).diff.find(d => d.path === 'Claim.item[].sequence');

  // Numeric order, not string order ("10" before "9").
  assert.deepEqual(row([2, 10], [2, 9]), { path: 'Claim.item[].sequence', kind: 'different', failed: ['2', '10'], reference: ['2', '9'] });

  // Seven values each that differ only in the last one: the old string sort + slice(0, 5) showed
  // ['1','2','3','4','5'] on both sides of a "different" row. The differing value must be visible.
  const d = row([1, 2, 3, 4, 5, 6, 7], [1, 2, 3, 4, 5, 6, 8]);
  assert.equal(d.kind, 'different');
  assert.ok(d.failed.includes('7'), JSON.stringify(d.failed));
  assert.ok(d.reference.includes('8'), JSON.stringify(d.reference));
  assert.notDeepEqual(d.failed, d.reference);
  assert.equal(d.failed.at(-1), '(+2 more)');
  assert.equal(d.reference.at(-1), '(+2 more)');
  assert.deepEqual(d.failed.slice(0, -1), ['1', '2', '3', '4', '7']);

  // Short lists are not marked; non-numeric values keep string order.
  assert.deepEqual(row([1, 2], [1, 3]).failed, ['1', '2']);
  const codes = values => ({ resourceType: 'Bundle', entry: [{ resource: { resourceType: 'Claim', item: values.map(code => ({ productOrService: { coding: [{ system: 'S', code }] } })) } }] });
  const codeRow = diffBundles(codes(['b', 'a', '10']), codes(['a', '9'])).diff.find(x => x.kind === 'different');
  assert.deepEqual(codeRow.failed, ['10', 'a', 'b']);
});

function fakeDb({ failed, reference, lastErrors = [{ code: 'BV-00163', message: 'Patient 1098765432 is not eligible', coding: [{ system: 'http://nphies.sa/terminology/CodeSystem/adjudication-error' }] }] }) {
  const calls = [];
  const queryFn = async (sql, params) => {
    calls.push({ sql, params });
    if (sql.includes('WHERE id = $1')) return { rows: failed ? [failed] : [] };
    if (sql.includes('ORDER BY r.received_at DESC')) return { rows: [{ errors: lastErrors }] };
    if (sql.includes('JOIN LATERAL')) return { rows: reference ? [reference] : [] };
    if (sql.includes('ai_audit_log')) return { rows: [] };
    throw new Error(`unexpected SQL: ${sql.slice(0, 80)}`);
  };
  return { calls, queryFn };
}

test('compareWithLastAccepted: 404, status gate, reference selection parameters and a PHI-free result', async () => {
  await assert.rejects(() => compareWithLastAccepted('prior-authorizations', 'abc', { queryFn: async () => ({ rows: [] }) }),
    e => e instanceof CompareError && e.status === 400);
  await assert.rejects(() => compareWithLastAccepted('prior-authorizations', 5, fakeDb({}) ), e => e.status === 404);
  await assert.rejects(() => compareWithLastAccepted('prior-authorizations', 5,
    fakeDb({ failed: { id: 5, status: 'approved', record_type: 'pharmacy', insurer_id: 'i', request_bundle: bundle() } })), e => e.status === 409);

  const failedBundle = bundle({ withMaternity: false });
  const db = fakeDb({
    failed: { id: 5, status: 'error', record_type: 'pharmacy', insurer_id: 'ins-1', request_bundle: JSON.stringify(failedBundle) },
    reference: { id: 3, status: 'approved', request_date: '2026-04-01T00:00:00Z', request_bundle: bundle() }
  });
  const result = await compareWithLastAccepted('prior-authorizations', '5', db);
  const lateral = db.calls.find(c => c.sql.includes('JOIN LATERAL'));
  assert.match(lateral.sql, /FROM prior_authorizations t/);
  assert.match(lateral.sql, /prior_authorization_responses/);
  assert.match(lateral.sql, /outcome IN \('complete', 'partial'\)/);
  assert.deepEqual(lateral.params, [5, 'pharmacy', 'ins-1', ['approved', 'partial'], JSON.stringify([PROFILE])]);
  assert.equal(result.source, 'rules');
  assert.equal(result.certainty, 'high');
  assert.equal(result.reference.id, 3);
  assert.deepEqual(result.failed.errorCodes, [{ code: 'BV-00163', system: 'http://nphies.sa/terminology/CodeSystem/adjudication-error',
    message: 'Patient [NATIONAL_ID] is not eligible' }]);
  assert.equal(result.diff[0].kind, 'missing');

  const claims = fakeDb({ failed: { id: 9, status: 'denied', record_type: 'professional', insurer_id: 'ins-1', request_bundle: bundle() } });
  const none = await compareWithLastAccepted('claim-submissions', 9, claims);
  assert.match(claims.calls.find(c => c.sql.includes('JOIN LATERAL')).sql, /FROM claim_submissions t/);
  assert.deepEqual(claims.calls.find(c => c.sql.includes('JOIN LATERAL')).params[3], ['approved', 'partial', 'paid']);
  assert.equal(none.reference, null);
  assert.match(none.message, /No accepted/);
  assert.deepEqual(none.diff, []);

  const noInsurer = await compareWithLastAccepted('claim-submissions', 9,
    fakeDb({ failed: { id: 9, status: 'error', record_type: 'professional', insurer_id: null, request_bundle: bundle() } }));
  assert.equal(noInsurer.reference, null);
  assert.match(noInsurer.message, /no insurer/);
});

test('Explain: sends only the redacted diff and error codes, labels llm/low, caches, fails closed', async () => {
  const failedBundle = bundle({ withMaternity: false, extraNote: true });
  const state = {
    failed: { id: 5, status: 'error', record_type: 'pharmacy', insurer_id: 'ins-1', request_bundle: failedBundle },
    reference: { id: 3, status: 'approved', request_date: '2026-04-01', request_bundle: bundle() }
  };
  let prompt;
  const llm = { model: 'fake:1', generateJSON: async args => {
    prompt = args;
    return { available: true, data: { summary: 'The maternity extension is missing.', likelyCauses: [{ path: 'Claim.item[]', explanation: 'x' }] }, auditId: 42, model: 'fake:1' };
  } };
  const result = await explainComparison('prior-authorizations', 5, { ...fakeDb(state), llm, userId: 7, env: {} });
  assert.equal(result.explanation.available, true);
  assert.equal(result.explanation.source, 'llm');
  assert.equal(result.explanation.certainty, 'low');
  assert.ok(result.explanation.disclaimer);
  assert.equal(result.explanation.auditId, 42);
  assert.equal(result.explanation.summary, 'The maternity extension is missing.');
  assert.equal(result.source, 'rules', 'the deterministic diff keeps its own label');
  assert.equal(prompt.feature, 'bundle_diff_explain');
  assert.equal(prompt.userId, 7);
  const sent = JSON.stringify(prompt);
  for (const phi of ['Fatimah', 'Harbi', '1098765432', '0551234567']) assert.ok(!sent.includes(phi), `${phi} sent to the LLM`);
  assert.match(sent, /BV-00163/);

  const cachedDb = fakeDb(state);
  const inner = cachedDb.queryFn;
  cachedDb.queryFn = async (sql, params) => sql.includes('ai_audit_log')
    ? { rows: [{ id: 41, output_summary: { summary: 'cached text', likelyCauses: [] }, created_at: '2026-09-01' }] }
    : inner(sql, params);
  let called = false;
  const cached = await explainComparison('prior-authorizations', 5, { ...cachedDb, llm: { model: 'fake:1', generateJSON: async () => { called = true; } }, env: {} });
  assert.equal(called, false);
  assert.equal(cached.explanation.cached, true);
  assert.equal(cached.explanation.summary, 'cached text');
  assert.equal(cached.explanation.auditId, 41);

  const down = await explainComparison('prior-authorizations', 5, { ...fakeDb(state), env: {},
    llm: { model: 'fake:1', generateJSON: async () => ({ available: false, reason: 'The AI model is unavailable', auditId: 43 }) } });
  assert.equal(down.explanation.available, false);
  assert.equal(down.explanation.reason, 'The AI model is unavailable');
  assert.ok(down.diff.length > 0, 'deterministic part still returned');

  const disabled = await explainComparison('prior-authorizations', 5, { ...fakeDb(state), env: { AI_FEATURES_ENABLED: 'false' },
    llm: { model: 'fake:1', generateJSON: async () => { throw new Error('must not be called'); } } });
  assert.equal(disabled.explanation.available, false);
  assert.match(disabled.explanation.reason, /disabled/);

  const noRef = await explainComparison('prior-authorizations', 5, { ...fakeDb({ failed: state.failed }), env: {},
    llm: { model: 'fake:1', generateJSON: async () => { throw new Error('must not be called'); } } });
  assert.equal(noRef.explanation.available, false);
  assert.match(noRef.explanation.reason, /no accepted/i);
});

test('Compare routes: viewers read the diff, only reviewers and up may ask for the AI explanation', async t => {
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); }));
  const base = `http://127.0.0.1:${server.address().port}`;
  let role = 'viewer';
  t.mock.method(pool, 'query', async sql => {
    if (sql.includes('FROM users WHERE id')) return { rows: [{ id: 4, email: 'v@example.test', role }] };
    if (sql.includes('WHERE id = $1')) return { rows: [{ id: 5, status: 'error', record_type: 'pharmacy', insurer_id: 'ins-1', request_bundle: bundle({ withMaternity: false }) }] };
    if (sql.includes('ORDER BY r.received_at DESC')) return { rows: [] };
    if (sql.includes('JOIN LATERAL')) return { rows: [{ id: 3, status: 'approved', request_date: '2026-04-01', request_bundle: bundle() }] };
    return { rows: [] };
  });
  const headers = { Authorization: `Bearer ${jwt.sign({ userId: 4 }, getJwtSecret())}`, 'Content-Type': 'application/json' };
  for (const kind of ['prior-authorizations', 'claim-submissions']) {
    const res = await fetch(`${base}/api/${kind}/5/compare-success`, { headers });
    assert.equal(res.status, 200, kind);
    const body = await res.json();
    assert.equal(body.reference.id, 3);
    assert.equal(body.diff[0].kind, 'missing');
    assert.equal((await fetch(`${base}/api/${kind}/5/compare-success/explain`, { method: 'POST', headers, body: '{}' })).status, 403);
  }
  assert.equal((await fetch(`${base}/api/prior-authorizations/abc/compare-success`, { headers })).status, 400);
  role = 'reviewer';
  const explained = await fetch(`${base}/api/claim-submissions/5/compare-success/explain`, { method: 'POST', headers, body: '{}' });
  assert.equal(explained.status, 200);
  const body = await explained.json();
  assert.equal(body.explanation.available, false, 'Ollama is not reachable in tests: fails closed');
  assert.equal(body.reference.id, 3);
});

test('Reference selection SQL on PostgreSQL: same type, insurer and profile, latest response accepted', { skip: !process.env.TEST_DATABASE_URL }, async t => {
  const schema = `aidiff_${crypto.randomUUID().replaceAll('-', '')}`;
  const client = new pg.Client({ connectionString: process.env.TEST_DATABASE_URL, options: `-c search_path=${schema}` });
  await client.connect();
  t.after(async () => { await client.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`); await client.end(); });
  await client.query(`CREATE SCHEMA ${schema}`);
  await client.query(`CREATE TABLE patients (patient_id UUID PRIMARY KEY); CREATE TABLE providers (provider_id UUID PRIMARY KEY);
    CREATE TABLE insurers (insurer_id UUID PRIMARY KEY, insurer_name TEXT);`);
  for (const file of ['migrations/create_prior_authorization_tables.sql', 'migrations/create_claim_submissions_tables.sql']) {
    await client.query(await fs.readFile(new URL(`../${file}`, import.meta.url), 'utf8'));
  }
  const queryFn = (sql, params) => client.query(sql, params);
  const [insA, insB] = [crypto.randomUUID(), crypto.randomUUID()];
  await client.query('INSERT INTO insurers VALUES ($1, $2), ($3, $4)', [insA, 'A', insB, 'B']);
  const add = async ({ number, type = 'pharmacy', insurer = insA, status, date, profile = PROFILE, outcome, errors = null }) => {
    const row = await client.query(`INSERT INTO prior_authorizations (request_number, auth_type, insurer_id, status, request_date, request_bundle)
      VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`, [number, type, insurer, status, date, JSON.stringify(bundle({ profile }))]);
    if (outcome) {
      await client.query(`INSERT INTO prior_authorization_responses (prior_auth_id, response_type, outcome, bundle_json, has_errors, errors)
        VALUES ($1, 'initial', $2, '{}', $3, $4)`, [row.rows[0].id, outcome, Boolean(errors), errors ? JSON.stringify(errors) : null]);
    }
    return row.rows[0].id;
  };
  const failed = await add({ number: 'F', status: 'error', date: '2026-05-01', outcome: 'error', errors: [{ code: 'BV-1' }] });
  const expected = await add({ number: 'OK-OLD', status: 'approved', date: '2026-03-01', outcome: 'complete' });
  await add({ number: 'OK-NEWER-BUT-ERRORS', status: 'approved', date: '2026-04-01', outcome: 'complete', errors: [{ code: 'X' }] });
  await add({ number: 'OTHER-INSURER', insurer: insB, status: 'approved', date: '2026-04-02', outcome: 'complete' });
  await add({ number: 'OTHER-TYPE', type: 'professional', status: 'approved', date: '2026-04-03', outcome: 'complete' });
  await add({ number: 'OTHER-PROFILE', profile: 'http://other/profile|1.0.0', status: 'approved', date: '2026-04-04', outcome: 'complete' });
  await add({ number: 'QUEUED', status: 'partial', date: '2026-04-05', outcome: 'queued' });
  await add({ number: 'DENIED', status: 'denied', date: '2026-04-06', outcome: 'complete' });
  const result = await compareWithLastAccepted('prior-authorizations', failed, { queryFn });
  assert.equal(result.reference.id, expected);
  assert.deepEqual(result.failed.errorCodes.map(e => e.code), ['BV-1']);
  assert.deepEqual(result.diff, []);
});
