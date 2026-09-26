// AI foundation (Phase 2): PHI redaction, response envelope, feature flags, Ollama health,
// LLM client (fake transport only), feedback route, RBAC and the 069 migration.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import pg from 'pg';
import jwt from 'jsonwebtoken';
import pool from '../db.js';
import app from '../server.js';
import { getJwtSecret } from '../config/auth.js';
import { requiredRoleFor } from '../middleware/requireRole.js';
import { redactText, redactDeep, minimizePatient, ageFromBirthDate, containsPhi } from '../services/ai/phi.js';
import { envelope, unavailable, insufficientData, AI_SOURCES } from '../services/ai/response.js';
import { isAIEnabled, isAIFeatureEnabled, minSampleSize, aiModels } from '../services/ai/config.js';
import { createHealthChecker, modelIsPresent } from '../services/ai/health.js';
import { createLlmClient, validateAgainstSchema, hashInput } from '../services/ai/llmClient.js';
import { MIGRATIONS } from '../scripts/migrate.js';

console.error = () => {};
console.warn = () => {};

test('PHI redactor removes national IDs, iqama, phones, emails, MRNs and known names', () => {
  const text = 'Patient Mohammed Al-Qahtani (ID 1023456789, iqama 2456789012) phone 0551234567 / +966 55 123 4567 ' +
    'email pt.one@example.com MRN: A-778899 file no 55512';
  const out = redactText(text, { names: ['Mohammed Al-Qahtani'], identifiers: ['55512'] });
  for (const leaked of ['1023456789', '2456789012', '0551234567', '123 4567', 'pt.one@example.com', 'A-778899', '55512', 'Mohammed', 'Qahtani']) {
    assert.ok(!out.includes(leaked), `${leaked} leaked: ${out}`);
  }
  assert.match(out, /\[NATIONAL_ID\]/);
  assert.match(out, /\[PHONE\]/);
  assert.match(out, /\[EMAIL\]/);
  assert.match(out, /\[MRN\]/);
  assert.match(out, /\[NAME\]/);
  // Codes that are not identifiers survive (ICD-10, GTIN, NPHIES error codes).
  const codes = redactText('Diagnosis J20.9, GTIN 06281147005347, error BV-00163, amount 1500.00 SAR');
  assert.equal(codes, 'Diagnosis J20.9, GTIN 06281147005347, error BV-00163, amount 1500.00 SAR');
  // Arabic names are matched without ASCII word boundaries.
  assert.equal(redactText('المريض محمد القحطاني', { names: ['محمد القحطاني'] }), 'المريض [NAME]');
  assert.equal(containsPhi(out, { names: ['Mohammed Al-Qahtani'] }), false);
  assert.equal(containsPhi('call 0551234567'), true);
});

test('PHI helpers redact nested values and send age/gender instead of name/DOB', () => {
  const nested = redactDeep({ a: ['mail x@y.org'], b: { c: 'ID 1122334455' }, n: 5, keep: null });
  assert.deepEqual(nested, { a: ['mail [EMAIL]'], b: { c: 'ID [NATIONAL_ID]' }, n: 5, keep: null });
  const now = new Date('2026-09-26T00:00:00Z');
  assert.equal(ageFromBirthDate('2000-09-27', now), 25);
  assert.equal(ageFromBirthDate('2000-09-26', now), 26);
  assert.equal(ageFromBirthDate('not a date', now), null);
  assert.deepEqual(minimizePatient({ name: 'X Y', birth_date: '1990-01-01', gender: 'male', identifier: '1000000001' }, now),
    { age: 36, gender: 'male' });
});

test('Response envelope carries source, certainty, basis and optional disclaimer', () => {
  assert.deepEqual(AI_SOURCES, ['rules', 'statistics', 'retrieval', 'llm']);
  const e = envelope({ source: 'rules', certainty: 'high', basis: { description: 'x' }, findings: [] });
  assert.deepEqual(e, { source: 'rules', certainty: 'high', basis: { description: 'x' }, findings: [] });
  assert.equal(envelope({ source: 'llm', certainty: 'low', basis: 'y', disclaimer: 'Advisory' }).disclaimer, 'Advisory');
  assert.throws(() => envelope({ source: 'magic', certainty: 'high', basis: 'x' }), /source/);
  assert.throws(() => envelope({ source: 'rules', certainty: 'sure', basis: 'x' }), /certainty/);
  assert.throws(() => envelope({ source: 'rules', certainty: 'high' }), /basis/);
  assert.deepEqual(unavailable('offline', { findings: [1] }), { available: false, reason: 'offline', findings: [1] });
  assert.deepEqual(insufficientData({ count: 3, minimum: 30 }), { insufficientData: true, count: 3, minimum: 30 });
});

test('AI feature flags: off by default in production, on elsewhere, per-feature opt-out', () => {
  assert.equal(isAIEnabled({ NODE_ENV: 'production' }), false);
  assert.equal(isAIEnabled({ NODE_ENV: 'production', AI_FEATURES_ENABLED: 'true' }), true);
  assert.equal(isAIEnabled({ NODE_ENV: 'development' }), true);
  assert.equal(isAIEnabled({ AI_FEATURES_ENABLED: 'false' }), false);
  assert.equal(isAIFeatureEnabled('bundle_diff_explain', { AI_FEATURE_BUNDLE_DIFF_EXPLAIN: 'false' }), false);
  assert.equal(isAIFeatureEnabled('bundle-diff-explain', { AI_FEATURE_BUNDLE_DIFF_EXPLAIN: 'false' }), false);
  assert.equal(isAIFeatureEnabled('bundle-diff-explain', {}), true);
  assert.equal(isAIFeatureEnabled('x', { AI_FEATURES_ENABLED: 'false' }), false);
  assert.equal(minSampleSize({}), 30);
  assert.equal(minSampleSize({ AI_MIN_SAMPLE_SIZE: '50' }), 50);
  assert.equal(minSampleSize({ AI_MIN_SAMPLE_SIZE: 'abc' }), 30);
  assert.deepEqual(aiModels({ OLLAMA_MODEL: 'm:1' }), { model: 'm:1', embedModel: 'm:1' });
  assert.deepEqual(aiModels({ OLLAMA_MODEL: 'm:1', OLLAMA_EMBED_MODEL: 'e' }), { model: 'm:1', embedModel: 'e' });
});

test('Ollama health: /api/tags with a 3s timeout, model presence, 60s cache, never throws', async () => {
  assert.equal(modelIsPresent(['llama3:latest'], 'llama3'), true);
  assert.equal(modelIsPresent(['llama3'], 'llama3:latest'), true);
  assert.equal(modelIsPresent(['llama3:8b'], 'llama3'), false);
  let now = 1_000_000;
  const calls = [];
  const env = { OLLAMA_BASE_URL: 'https://ai.example.test', OLLAMA_MODEL: 'med:1', OLLAMA_EMBED_MODEL: 'embed' };
  const checker = createHealthChecker({
    env, now: () => now,
    fetchImpl: async (url, init) => {
      calls.push({ url, init });
      return new Response(JSON.stringify({ models: [{ name: 'med:1' }] }), { status: 200 });
    }
  });
  const first = await checker.check();
  assert.equal(calls[0].url, 'https://ai.example.test/api/tags');
  assert.ok(calls[0].init.signal instanceof AbortSignal);
  assert.deepEqual({ ...first, checkedAt: undefined }, {
    enabled: true, reachable: true, baseUrlIsTls: true, model: 'med:1', modelPresent: true,
    embedModel: 'embed', embedModelPresent: false, checkedAt: undefined
  });
  now += 59_000;
  await checker.check();
  assert.equal(calls.length, 1, 'cached for 60s');
  now += 2_000;
  await checker.check();
  assert.equal(calls.length, 2, 'refreshed after 60s');

  const down = createHealthChecker({ env, fetchImpl: async () => { throw new Error('ECONNREFUSED'); } });
  const result = await down.check();
  assert.equal(result.reachable, false);
  assert.equal(result.modelPresent, false);
  assert.match(result.reason, /not reachable/);

  const badStatus = createHealthChecker({ env, fetchImpl: async () => new Response('x', { status: 500 }) });
  assert.equal((await badStatus.check()).reachable, false);

  // The timeout is real: a fetch that never resolves is aborted after timeoutMs.
  const hanging = createHealthChecker({ env, timeoutMs: 50, fetchImpl: (_url, init) => new Promise((_, reject) => {
    init.signal.addEventListener('abort', () => reject(init.signal.reason));
  }) });
  const started = Date.now();
  const keepAlive = setTimeout(() => {}, 5000); // AbortSignal.timeout timers do not hold the event loop open
  assert.equal((await hanging.check()).reachable, false);
  clearTimeout(keepAlive);
  assert.ok(Date.now() - started < 1000);

  const insecure = createHealthChecker({ env: { OLLAMA_BASE_URL: 'http://8.8.8.8:11434' }, fetchImpl: async () => { throw new Error('must not be called'); } });
  const refused = await insecure.check();
  assert.equal(refused.reachable, false);
  assert.match(refused.reason, /configuration/i);

  let disabledCalls = 0;
  const disabled = createHealthChecker({ env: { AI_FEATURES_ENABLED: 'false' }, fetchImpl: async () => { disabledCalls++; } });
  const off = await disabled.check();
  assert.equal(off.enabled, false);
  assert.equal(off.reachable, null);
  assert.equal(disabledCalls, 0);
});

test('LLM client: structured output, schema validation, audit, fails closed (fake transport)', async () => {
  const schema = { type: 'object', properties: { summary: { type: 'string' }, n: { type: 'integer' } }, required: ['summary'] };
  assert.deepEqual(validateAgainstSchema(schema, { summary: 'ok', n: 2 }), []);
  assert.ok(validateAgainstSchema(schema, { n: 2.5 }).length >= 2);
  assert.ok(validateAgainstSchema({ type: 'string', enum: ['a'] }, 'b').length === 1);
  assert.equal(hashInput({ b: 1, a: [2] }), hashInput({ a: [2], b: 1 }), 'stable hash');

  const audits = [];
  const audit = async entry => { audits.push(entry); return audits.length; };
  let request;
  const client = { generate: async req => { request = req; return { response: '{"summary":"explained"}' }; } };
  const llm = createLlmClient({ client, audit, env: { OLLAMA_MODEL: 'fake:1' } });
  const ok = await llm.generateJSON({ feature: 'demo', system: 's', prompt: 'p', schema, userId: 7 });
  assert.equal(ok.available, true);
  assert.deepEqual(ok.data, { summary: 'explained' });
  assert.equal(ok.model, 'fake:1');
  assert.equal(ok.auditId, 1);
  assert.deepEqual(request.format, schema);
  assert.equal(request.stream, false);
  assert.equal(audits[0].feature, 'demo');
  assert.equal(audits[0].source, 'llm');
  assert.equal(audits[0].available, true);
  assert.equal(audits[0].userId, 7);
  assert.equal(audits[0].inputHash.length, 64);

  const wrong = createLlmClient({ client: { generate: async () => ({ response: '{"other":1}' }) }, audit, env: {} });
  const bad = await wrong.generateJSON({ feature: 'demo', prompt: 'p', schema });
  assert.equal(bad.available, false);
  assert.match(bad.reason, /expected format/);
  assert.equal(audits.at(-1).available, false);

  const offline = createLlmClient({ client: { generate: async () => { throw new Error('fetch failed'); } }, audit, env: {} });
  const off = await offline.generateJSON({ feature: 'demo', prompt: 'p', schema });
  assert.equal(off.available, false);
  assert.match(off.reason, /unavailable/);

  let called = false;
  const disabled = createLlmClient({ client: { generate: async () => { called = true; } }, audit, env: { AI_FEATURES_ENABLED: 'false' } });
  const d = await disabled.generateJSON({ feature: 'demo', prompt: 'p', schema });
  assert.equal(d.available, false);
  assert.equal(called, false);

  const auditFails = createLlmClient({ client, audit: async () => { throw new Error('db down'); }, env: {} });
  const stillOk = await auditFails.generateJSON({ feature: 'demo', prompt: 'p', schema });
  assert.equal(stillOk.available, true);
  assert.equal(stillOk.auditId, null);
});

test('RBAC: AI GET endpoints for every role, feedback POST for every role, explain for reviewers', () => {
  for (const [method, url, role] of [
    ['GET', '/ai/health', 'viewer'], ['GET', '/ai/analytics/rejections', 'viewer'], ['GET', '/ai/analytics/poll-timing', 'viewer'],
    ['POST', '/ai/feedback', 'viewer'], ['POST', '/AI/Feedback/', 'viewer'],
    ['POST', '/medication-safety/duplicate-ingredients', 'reviewer'],
    ['GET', '/prior-authorizations/5/compare-success', 'viewer'], ['GET', '/claim-submissions/5/compare-success', 'viewer'],
    ['POST', '/prior-authorizations/5/compare-success/explain', 'reviewer'],
    ['POST', '/claim-submissions/5/compare-success/explain', 'reviewer'],
    ['POST', '/ai/other', 'submitter'], ['DELETE', '/ai/feedback', 'admin']
  ]) assert.equal(requiredRoleFor(method, url), role, `${method} ${url}`);
});

async function startServer(t) {
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); }));
  return `http://127.0.0.1:${server.address().port}`;
}

test('GET /api/ai/health and POST /api/ai/feedback work for a viewer', async t => {
  const base = await startServer(t);
  const inserts = [];
  t.mock.method(pool, 'query', async (sql, params) => {
    if (sql.includes('FROM users WHERE id')) return { rows: [{ id: 3, email: 'viewer@example.test', role: 'viewer' }] };
    if (sql.includes('INSERT INTO ai_feedback')) {
      inserts.push(params);
      if (params[0] === 999) throw Object.assign(new Error('fk'), { code: '23503' });
      return { rows: [{ id: 11, created_at: '2026-09-26T00:00:00Z' }] };
    }
    return { rows: [] };
  });
  const headers = { Authorization: `Bearer ${jwt.sign({ userId: 3 }, getJwtSecret())}`, 'Content-Type': 'application/json' };
  const health = await fetch(`${base}/api/ai/health`, { headers });
  assert.equal(health.status, 200);
  const body = await health.json();
  for (const key of ['enabled', 'reachable', 'baseUrlIsTls', 'model', 'modelPresent', 'embedModel', 'embedModelPresent', 'checkedAt']) {
    assert.ok(key in body, `health has ${key}`);
  }
  assert.equal(body.reachable, false, 'tests point Ollama at a closed port');

  const post = body => fetch(`${base}/api/ai/feedback`, { method: 'POST', headers, body: JSON.stringify(body) });
  const ok = await post({ auditId: 5, verdict: 'accepted', comment: 'fine, call 0551234567' });
  assert.equal(ok.status, 201);
  assert.deepEqual(inserts[0], [5, 3, 'accepted', 'fine, call [PHONE]']);
  assert.equal((await post({ auditId: 5, verdict: 'maybe' })).status, 400);
  assert.equal((await post({ auditId: 'x', verdict: 'accepted' })).status, 400);
  assert.equal((await post({ auditId: 5, verdict: 'edited', comment: 'x'.repeat(2001) })).status, 400);
  assert.equal((await post({ auditId: 999, verdict: 'rejected' })).status, 404);
});

test('Migration 069 is listed after 068 and creates ai_audit_log / ai_feedback idempotently', { skip: !process.env.TEST_DATABASE_URL }, async t => {
  const files = MIGRATIONS.map(m => m.file);
  const index = files.indexOf('migrations/069_ai_foundation.sql');
  assert.ok(index > files.indexOf('migrations/068_user_roles_extended.sql'));
  assert.equal(MIGRATIONS[index].afterBaseline, true);

  const client = new pg.Client({ connectionString: process.env.TEST_DATABASE_URL });
  await client.connect();
  const schema = `ai_${crypto.randomUUID().replaceAll('-', '')}`;
  t.after(async () => { await client.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`); await client.end(); });
  await client.query(`CREATE SCHEMA ${schema}`);
  await client.query(`SET search_path TO ${schema}`);
  await client.query(await fs.readFile(new URL('../migrations/048_create_users_table.sql', import.meta.url), 'utf8'));
  const sql = await fs.readFile(new URL('../migrations/069_ai_foundation.sql', import.meta.url), 'utf8');
  await client.query(sql);
  await client.query(sql);
  const audit = await client.query(`INSERT INTO ai_audit_log (feature, source, model, input_hash, latency_ms, available, output_summary)
    VALUES ('demo', 'llm', 'm', repeat('a', 64), 12, true, '{"summary":"x"}') RETURNING id`);
  await client.query(`INSERT INTO ai_feedback (audit_id, verdict, comment) VALUES ($1, 'accepted', 'ok')`, [audit.rows[0].id]);
  await assert.rejects(() => client.query(`INSERT INTO ai_feedback (audit_id, verdict) VALUES ($1, 'perhaps')`, [audit.rows[0].id]));
  await assert.rejects(() => client.query(`INSERT INTO ai_audit_log (feature, source) VALUES ('demo', 'oracle')`));
  await assert.rejects(() => client.query(`INSERT INTO ai_feedback (audit_id, verdict) VALUES (987654, 'accepted')`));
});
