// Gate artefacts: scripts/aiReadiness.js (pure decision logic with fake Ollama / fake DB)
// and scripts/aiDataVolumeReport.js (read-only SQL against a throwaway schema in the local
// regression database; skipped without TEST_DATABASE_URL). No network, no data changes.
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import pg from 'pg';
import { checkBaseUrl, collectReadiness, evaluateReadiness, formatReport } from '../scripts/aiReadiness.js';
import { assessModel, runReadOnly, toMarkdown, DEFAULT_THRESHOLDS } from '../scripts/aiDataVolumeReport.js';

const byId = (report, id) => report.checks.find(c => c.id === id);

function fakeOllama({ names = [], dimension = 1024, down = false } = {}) {
  const calls = [];
  const fetchImpl = async (url, init = {}) => {
    calls.push({ url, method: init.method, body: init.body });
    if (down) throw Object.assign(new Error('connect ECONNREFUSED'), { name: 'Error' });
    if (url.endsWith('/api/tags')) return { ok: true, json: async () => ({ models: names.map(name => ({ name })) }) };
    if (url.endsWith('/api/embed')) return { ok: true, json: async () => ({ embeddings: [Array(dimension).fill(0.1)] }) };
    return { ok: false, status: 404, json: async () => ({}) };
  };
  return { fetchImpl, calls };
}

function fakeDb({ available = true, installed = false, columns = {}, counts = {} } = {}) {
  const statements = [];
  const queryFn = async (sql, params = []) => {
    statements.push(sql);
    if (sql.includes('pg_available_extensions')) return { rows: available ? [{ '?column?': 1 }] : [] };
    if (sql.includes('pg_extension')) return { rows: installed ? [{ extversion: '0.8.0' }] : [] };
    if (sql.includes('format_type')) return { rows: columns[params[0]] ? [{ column_type: columns[params[0]] }] : [] };
    const table = /FROM (\w+) WHERE embedding IS NOT NULL/.exec(sql)?.[1];
    if (table) return { rows: [{ count: String(counts[table] ?? 0) }] };
    throw new Error(`unexpected SQL ${sql}`);
  };
  return { queryFn, statements };
}

test('AI readiness: base URL rule follows ollamaConfig (https or loopback/private only)', () => {
  assert.equal(checkBaseUrl({ OLLAMA_BASE_URL: 'https://ai.example.test' }).status, 'PASS');
  assert.equal(checkBaseUrl({ OLLAMA_BASE_URL: 'http://127.0.0.1:11434' }).status, 'PASS');
  assert.equal(checkBaseUrl({ OLLAMA_BASE_URL: 'http://10.0.0.5:11434' }).status, 'PASS');
  assert.equal(checkBaseUrl({ OLLAMA_BASE_URL: 'http://203.0.113.9:11434' }).status, 'FAIL');
  const optedIn = checkBaseUrl({ OLLAMA_BASE_URL: 'http://203.0.113.9:11434', OLLAMA_ALLOW_INSECURE_REMOTE: 'true' });
  assert.equal(optedIn.status, 'FAIL', 'the insecure opt-in is reported, not passed');
  assert.match(optedIn.detail, /OLLAMA_ALLOW_INSECURE_REMOTE/);
});

test('AI readiness: reachable Ollama with bge-m3, one embed call, dimension checked against the vector columns', async () => {
  const env = { OLLAMA_BASE_URL: 'http://127.0.0.1:11434', OLLAMA_MODEL: 'llama3', OLLAMA_EMBED_MODEL: 'bge-m3', EMBEDDING_DIM: '1024' };
  const ollama = fakeOllama({ names: ['llama3:latest', 'bge-m3:latest'], dimension: 1024 });
  const db = fakeDb({ available: true, installed: false, columns: { medicines: 'vector(4096)' }, counts: { medicines: 12 } });
  const report = await collectReadiness({ env, fetchImpl: ollama.fetchImpl, queryFn: db.queryFn });

  assert.equal(byId(report, 'ollama_reachable').status, 'PASS');
  assert.equal(byId(report, 'generation_model_present').status, 'PASS');
  assert.equal(byId(report, 'embedding_model_configured').status, 'PASS');
  assert.equal(byId(report, 'embedding_model_present').status, 'PASS');
  assert.deepEqual(byId(report, 'bge_m3_installed').models, ['bge-m3:latest']);
  const dim = byId(report, 'embedding_dimension');
  assert.equal(dim.dimension, 1024);
  assert.equal(dim.status, 'FAIL', 'vector(4096) columns cannot hold 1024-dimension embeddings');
  assert.match(dim.detail, /vector\(4096\)/);
  assert.equal(byId(report, 'pgvector_available').status, 'PASS');
  assert.equal(byId(report, 'pgvector_installed').status, 'FAIL');
  const stored = byId(report, 'stored_embeddings_medicines');
  assert.equal(stored.status, 'UNKNOWN');
  assert.equal(stored.count, 12);
  assert.equal(stored.countQuery, 'SELECT count(*) FROM medicines WHERE embedding IS NOT NULL;');
  assert.match(stored.detail, /hash/);
  assert.equal(byId(report, 'stored_embeddings_medical_knowledge').status, 'UNKNOWN', 'table without embedding column');

  const embedCalls = ollama.calls.filter(c => c.url.endsWith('/api/embed'));
  assert.equal(embedCalls.length, 1);
  assert.deepEqual(JSON.parse(embedCalls[0].body), { model: 'bge-m3', input: 'test' });
  assert.ok(db.statements.every(sql => /^\s*SELECT/i.test(sql)), 'database probes are SELECT only');
  assert.match(formatReport(report), /\[FAIL   \] Embedding dimension/);
});

test('AI readiness: unreachable Ollama and database give UNKNOWN, never PASS, and no embed call', async () => {
  const env = { OLLAMA_BASE_URL: 'http://127.0.0.1:11434', OLLAMA_MODEL: 'llama3' };
  const ollama = fakeOllama({ down: true });
  const report = await collectReadiness({ env, fetchImpl: ollama.fetchImpl, dbError: 'connection refused' });
  assert.equal(byId(report, 'ollama_reachable').status, 'FAIL');
  for (const id of ['generation_model_present', 'bge_m3_installed', 'embedding_dimension', 'pgvector_installed', 'stored_embeddings_medicines']) {
    assert.equal(byId(report, id).status, 'UNKNOWN', id);
  }
  assert.equal(byId(report, 'embedding_model_configured').status, 'FAIL', 'OLLAMA_EMBED_MODEL unset');
  assert.equal(ollama.calls.filter(c => c.url.endsWith('/api/embed')).length, 0);
  assert.equal(report.summary.PASS + report.summary.FAIL + report.summary.UNKNOWN, report.checks.length);

  // No bge-m3 installed, empty embedding tables, matching dimension -> PASS where due.
  const checks = evaluateReadiness({
    env: { OLLAMA_MODEL: 'm', OLLAMA_EMBED_MODEL: 'nomic-embed-text', EMBEDDING_DIM: '768' },
    tags: { reachable: true, names: ['m:latest', 'nomic-embed-text:latest'] },
    embed: { dimension: 768 },
    db: { vectorAvailable: true, vectorInstalled: true, columns: { medicines: 'vector(768)', medical_knowledge: 'vector(768)' }, counts: { medicines: 0, medical_knowledge: 0 } }
  });
  const get = id => checks.find(c => c.id === id);
  assert.equal(get('bge_m3_installed').status, 'FAIL');
  assert.equal(get('embedding_dimension').status, 'PASS');
  assert.equal(get('stored_embeddings_medicines').status, 'PASS');
});

test('AI data report: sufficiency thresholds are explicit heuristics', () => {
  assert.deepEqual(DEFAULT_THRESHOLDS, { minLabelled: 1000, minMinority: 100, minMonths: 12 });
  const enough = assessModel('m', 'd', { accepted: 1500, denied: 120, labelled: 1620, monthsCovered: 14 });
  assert.equal(enough.sufficient, true);
  const rareDenials = assessModel('m', 'd', { accepted: 1500, denied: 90, labelled: 1590, monthsCovered: 14 });
  assert.equal(rareDenials.sufficient, false);
  assert.equal(rareDenials.checks.find(c => !c.pass).name, 'minority class (denied)');
  assert.equal(assessModel('m', 'd', null).sufficient, false);
});

test('AI data report runs read-only on PostgreSQL and prints aggregates without patient identifiers', { skip: !process.env.TEST_DATABASE_URL }, async t => {
  const url = new URL(process.env.TEST_DATABASE_URL);
  const schema = `aidv_${crypto.randomUUID().replaceAll('-', '')}`;
  const client = new pg.Client({ connectionString: url.href, options: `-c search_path=${schema}` });
  await client.connect();
  t.after(async () => { await client.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`); await client.end(); });
  await client.query(`CREATE SCHEMA ${schema}`);
  await client.query(`
    CREATE TABLE patients (patient_id UUID PRIMARY KEY, name TEXT, identifier TEXT);
    CREATE TABLE providers (provider_id UUID PRIMARY KEY);
    CREATE TABLE insurers (insurer_id UUID PRIMARY KEY, insurer_name TEXT);
  `);
  for (const file of ['migrations/create_prior_authorization_tables.sql', 'migrations/create_claim_submissions_tables.sql', 'migrations/067_practitioner_fields.sql']) {
    await client.query(await fs.readFile(new URL(`../${file}`, import.meta.url), 'utf8'));
  }
  const patient = crypto.randomUUID();
  const insurer = crypto.randomUUID();
  await client.query('INSERT INTO patients VALUES ($1, $2, $3)', [patient, 'Synthetic Zeta Person', '1098765432']);
  await client.query('INSERT INTO insurers VALUES ($1, $2)', [insurer, 'Insurer Alpha']);

  const pas = [
    ['PA-SYN-1', 'pharmacy', 'approved', '2026-01-10', 'DOC-1'],
    ['PA-SYN-2', 'pharmacy', 'denied', '2026-03-05', null],
    ['PA-SYN-3', 'professional', 'pending', '2026-03-20', null]
  ];
  const ids = [];
  for (const [number, type, status, date, license] of pas) {
    const row = await client.query(`INSERT INTO prior_authorizations (request_number, auth_type, patient_id, insurer_id, status, request_date, total_amount, practitioner_license)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`, [number, type, patient, status === 'pending' ? null : insurer, status, date, status === 'pending' ? null : 100, license]);
    ids.push(row.rows[0].id);
  }
  await client.query(`INSERT INTO prior_authorization_diagnoses (prior_auth_id, sequence, diagnosis_code) VALUES ($1, 1, 'J20.9')`, [ids[0]]);
  await client.query(`INSERT INTO prior_authorization_items (prior_auth_id, sequence, product_or_service_code, adjudication_status)
    VALUES ($1, 1, 'X1', 'approved'), ($2, 1, 'X2', 'denied'), ($2, 2, 'X3', 'denied')`, [ids[0], ids[1]]);
  await client.query(`INSERT INTO prior_authorization_supporting_info (prior_auth_id, sequence, category) VALUES ($1, 1, 'info'), ($1, 2, 'onset')`, [ids[0]]);
  await client.query(`INSERT INTO prior_authorization_responses (prior_auth_id, response_type, outcome, bundle_json, has_errors, errors)
    VALUES ($1, 'initial', 'error', '{}', true, $2), ($3, 'initial', 'error', '{}', true, $4)`,
  [ids[1], JSON.stringify([{ code: 'BV-00163' }, { code: 'MN-1-1' }]), ids[2], JSON.stringify([{ code: 'BV-00163' }])]);
  const claim = await client.query(`INSERT INTO claim_submissions (claim_number, claim_type, patient_id, insurer_id, status, adjudication_outcome, request_date)
    VALUES ('CL-SYN-1', 'professional', $1, $2, 'approved', 'rejected', '2026-02-01') RETURNING id`, [patient, insurer]);
  await client.query(`INSERT INTO claim_submission_items (claim_id, sequence, product_or_service_code, adjudication_status) VALUES ($1, 1, 'X1', 'denied')`, [claim.rows[0].id]);

  const statements = [];
  const recording = { query: (sql, params) => { statements.push(sql); return client.query(sql, params); } };
  const report = await runReadOnly(recording, { now: () => new Date('2026-09-26T00:00:00Z') });
  assert.equal(statements[0], 'BEGIN READ ONLY');
  assert.equal(statements.at(-1), 'ROLLBACK');
  assert.ok(statements.slice(1, -1).every(sql => /^\s*SELECT/i.test(sql)), 'only SELECT statements run');

  const pa = report.sources.find(s => s.source === 'prior_authorizations');
  assert.equal(pa.total, 3);
  assert.deepEqual(pa.byOutcome.status.map(g => [g.key, g.count]).sort(), [['approved', 1], ['denied', 1], ['pending', 1]]);
  assert.ok(pa.notInSchema.includes('adjudication_outcome'), 'prior_authorizations has no adjudication_outcome column');
  assert.deepEqual(pa.byType.map(g => [g.key, g.count]), [['pharmacy', 2], ['professional', 1]]);
  assert.deepEqual(pa.byInsurer.map(g => [g.key, g.count]), [['Insurer Alpha', 2], ['(no insurer)', 1]]);
  assert.deepEqual(pa.byMonth.map(g => [g.key, g.count]), [['2026-03', 2], ['2026-01', 1]]);
  assert.equal(pa.dateRange.first.slice(0, 10), '2026-01-10');
  assert.deepEqual(pa.missingRates.diagnosis_codes_present, { missing: 2, total: 3, rate: 0.6667 });
  assert.equal(pa.missingRates.item_codes_present.missing, 1);
  assert.equal(pa.missingRates.total_amount.missing, 1);
  assert.equal(pa.missingRates.practitioner_license.missing, 2);
  assert.equal(pa.missingRates.encounter_class.missing, 3);
  assert.equal(pa.missingRates.supporting_info.missing, 2);
  assert.deepEqual(pa.supportingInfoPerRecord, { mean: 0.67, max: 2 });
  assert.deepEqual(pa.items.byOutcome.adjudication_status.map(g => [g.key, g.count]), [['denied', 2], ['approved', 1]]);
  assert.deepEqual(pa.errorCodes, { distinctCodes: 2, responsesWithCodes: 2 });
  assert.equal(pa.labels.accepted, 1);
  assert.equal(pa.labels.denied, 1);
  assert.equal(pa.labels.monthsCovered, 3);

  const claims = report.sources.find(s => s.source === 'claim_submissions');
  assert.deepEqual(claims.byOutcome.adjudication_outcome.map(g => [g.key, g.count]), [['rejected', 1]]);
  assert.equal(claims.labels.denied, 1, 'adjudication_outcome rejected wins over status approved');
  assert.equal(claims.errorCodes.distinctCodes, 0);

  const models = Object.fromEntries(report.sufficiency.models.map(m => [m.model, m]));
  assert.equal(models.pa_denial.sufficient, false);
  assert.match(report.sufficiency.note, /not guarantees/);

  const markdown = toMarkdown(report);
  const json = JSON.stringify(report);
  for (const secret of ['Synthetic Zeta Person', '1098765432', 'PA-SYN-1', 'CL-SYN-1', patient]) {
    assert.ok(!markdown.includes(secret) && !json.includes(secret), `${secret} must not be printed`);
  }
  assert.match(markdown, /## Sufficiency \(heuristic\)/);
  assert.match(markdown, /\| pa_denial \| FAIL \|/);
});
