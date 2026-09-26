// Stage 5 against PostgreSQL: verified generative drafts behind a server switch and a
// per-pilot feature approval, a rate limit shared by several server instances, rollout
// activation rules, operating alerts, and the retention tool. Fake model; synthetic data.
import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import pg from 'pg';
import fs from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import pool from '../db.js';
import pilotRouter from '../routes/clinicalPilot.js';
import { createAdvisoryRouter } from '../openmed/routes.js';
import { buildFingerprint } from '../openmed/fingerprint.js';
import { alertCandidates, DEFAULT_THRESHOLDS } from '../openmed/alerts.js';
import { applyRetention, MARKER } from '../scripts/clinicalAiRetention.js';

async function listen(t, app) {
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); }));
  return `http://127.0.0.1:${server.address().port}`;
}
const caller = base => async (path, method = 'GET', body, user = 1) => {
  const r = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json', 'test-user': String(user) },
    ...(body ? { body: JSON.stringify(body) } : {}) });
  return { status: r.status, headers: r.headers, body: await r.json() };
};

test('Alert rules: thresholds and minimum sample sizes', () => {
  const none = alertCandidates({ runtime: { stats: { completed: 5, timeouts: 5 } }, pilots: [] });
  assert.deepEqual(none, [], 'below min_n no alert');
  const r = alertCandidates({ runtime: { stats: { completed: 70, timeouts: 20, crashes: 10, rejected_queue_full: 2 } }, pilots: [
    { id: 'p', open_serious: 1, analyses_recent: 10, context_failed_recent: 10, reviews_recent: 25, not_accepted_recent: 10,
      generation_recent: 10, generation_rejected_recent: 6, days_left: 2 }] }, DEFAULT_THRESHOLDS);
  assert.deepEqual(r.map(a => `${a.level}:${a.rule}`).sort(), ['critical:open_serious_issues', 'critical:worker_error_rate',
    'warning:correction_rate', 'warning:generation_rejection_rate', 'warning:pilot_ending', 'warning:queue_rejections']);
});

test('Stage 5 with PostgreSQL', { skip: !process.env.TEST_OPENMED_DATABASE_URL }, async t => {
  const url = new URL(process.env.TEST_OPENMED_DATABASE_URL);
  assert.ok(['localhost', '127.0.0.1'].includes(url.hostname) && url.pathname.endsWith('_regression'));
  const suffix = randomUUID().replaceAll('-', '');
  const dbName = `stage5_${suffix}_regression`, login = `s5_${suffix}`;
  const admin = new pg.Client({ connectionString: url.href });
  await admin.connect();
  const groupExisted = (await admin.query("SELECT 1 FROM pg_roles WHERE rolname='nafes_openmed'")).rowCount > 0;
  await admin.query(`CREATE DATABASE ${dbName}`);
  url.pathname = `/${dbName}`;
  const owner = new pg.Client({ connectionString: url.href });
  await owner.connect();
  let restricted;
  t.after(async () => {
    if (restricted) await restricted.end();
    await owner.end();
    await admin.query(`DROP DATABASE ${dbName}`);
    await admin.query(`DROP ROLE IF EXISTS ${login}`);
    if (!groupExisted) await admin.query('DROP ROLE IF EXISTS nafes_openmed');
    await admin.end();
  });
  await owner.query(`CREATE TABLE public.users(id SERIAL PRIMARY KEY, email TEXT);
    CREATE TABLE public.patients(patient_id UUID PRIMARY KEY,name TEXT,identifier TEXT);
    CREATE TABLE public.prior_authorizations(id INTEGER PRIMARY KEY,patient_id UUID,request_number TEXT,primary_diagnosis TEXT,diagnosis_codes TEXT);
    CREATE TABLE public.claim_submissions(id INTEGER PRIMARY KEY,patient_id UUID,claim_number TEXT,primary_diagnosis TEXT,diagnosis_codes TEXT);
    CREATE TABLE public.prior_authorization_supporting_info(prior_auth_id INTEGER,value_string TEXT);
    CREATE TABLE public.claim_submission_supporting_info(claim_id INTEGER,value_string TEXT);
    INSERT INTO public.users (email) VALUES ('u1@example.test'),('u2@example.test'),('admin@example.test');`);
  const patient = randomUUID();
  await owner.query("INSERT INTO public.patients VALUES ($1,'Synthetic P','SYN-P')", [patient]);
  for (const file of ['064_openmed_advisory.sql', '071_clinical_ai_access_and_reviews.sql', '072_clinical_knowledge_sources.sql',
    '073_openmed_idempotency.sql', '074_clinical_pilot.sql', '075_clinical_ai_rollout_generation.sql']) {
    const sql = await fs.readFile(new URL(`../migrations/${file}`, import.meta.url), 'utf8');
    await owner.query(sql);
    await owner.query(sql);
  }
  await owner.query("INSERT INTO public.clinical_ai_patient_access (user_id,patient_id,reason) VALUES (1,$1,'grant'),(2,$1,'grant')", [patient]);
  const password = randomUUID().replaceAll('-', '');
  await admin.query(`CREATE ROLE ${login} LOGIN PASSWORD '${password}' IN ROLE nafes_openmed`);
  url.username = login; url.password = password;
  restricted = new pg.Client({ connectionString: url.href });
  await restricted.connect();
  const rquery = (sql, values) => restricted.query(sql, values);
  const build = buildFingerprint().sha256;

  // An active pilot for user 1 (analysis + summary only)
  const pilotId = randomUUID();
  await owner.query(`INSERT INTO clinical_pilot.pilots (id,name,scope,status,starts_on,ends_on,max_participants,approval_reference,
      approved_by_name,approved_by_role,evaluation_report_ref,evaluation_build_sha256,criteria_ref,activated_at)
    VALUES ($1,'SYNTHETIC pilot','synthetic','active',current_date,current_date+30,5,'SYN','Synthetic','Test','SYN-EVAL',$2,'SYN-CRIT',now())`, [pilotId, build]);
  await owner.query("INSERT INTO clinical_pilot.participants (pilot_id,user_id,role_label) VALUES ($1,1,'physician')", [pilotId]);

  t.mock.method(pool, 'query', (sql, params) => owner.query(sql, params));
  t.mock.method(pool, 'connect', async () => ({ query: (sql, params) => owner.query(sql, params), release() {} }));
  const aapp = express(); aapp.use(express.json());
  aapp.use((req, res, next) => { req.user = { id: 3, role: 'admin' }; next(); });
  aapp.use('/p', pilotRouter);
  const adm = caller(`${await listen(t, aapp)}/p`);

  const note = 'Patient has hypertension. No diabetes. Takes metformin 500 mg PO BID.';
  const extractor = async text => ({ entities: ['hypertension', 'diabetes'].map(term => {
    const i = text.indexOf(term);
    return i < 0 ? null : { text: term, label: 'DISEASE', confidence: 0.9, start: i, end: i + term.length };
  }).filter(Boolean), model: { id: 'synthetic', revision: 'none' }, advisory_only: true, language: 'en', sdk_version: 'test' });
  let llmReply;
  const llm = { calls: 0, generateJSON: async () => { llm.calls++; return llmReply; } };
  const mount = async (opts) => {
    const app = express(); app.use(express.json());
    app.use((req, res, next) => { req.user = { id: Number(req.get('test-user') || 1) }; next(); });
    app.use('/om', createAdvisoryRouter({ query: rquery, ready: () => true, requirePilot: true, analyze: extractor, llm, ...opts }));
    return caller(`${await listen(t, app)}/om`);
  };
  const off = await mount({ generationEnabled: false });
  const on = await mount({ generationEnabled: true });

  let summaryId;
  await t.test('Generation is off by default and needs the pilot to approve it', async () => {
    const analysis = await on('/analyses', 'POST', { patient_id: patient, mode: 'diseases', text: note });
    assert.equal(analysis.status, 201, JSON.stringify(analysis.body));
    const summary = await on(`/analyses/${analysis.body.id}/summaries`, 'POST', {});
    assert.equal(summary.status, 201);
    summaryId = summary.body.id;
    const disabled = await off(`/summaries/${summaryId}/drafts`, 'POST', {});
    assert.equal(disabled.status, 409);
    assert.equal(disabled.body.reason, 'generation_disabled');
    const notApproved = await on(`/summaries/${summaryId}/drafts`, 'POST', {});
    assert.equal(notApproved.status, 403);
    assert.equal(notApproved.body.reason, 'feature_not_approved');
    assert.equal((await on('/status')).body.generation.approved_for_user, false);
    assert.equal(llm.calls, 0, 'the model was never called');
  });

  await t.test('Only fully verified drafts are stored; every attempt is audited', async () => {
    await owner.query("UPDATE clinical_pilot.pilots SET approved_features = '{analysis,summary,generation}' WHERE id = $1", [pilotId]);
    const facts = (await owner.query('SELECT content FROM openmed_advisory.summaries WHERE id = $1', [summaryId])).rows[0].content.patient_data;
    const f = text => facts.find(x => x.text === text).id;
    llmReply = { available: true, model: 'fake', latencyMs: 3, data: { sentences: [
      { text: 'The patient has hypertension.', citations: [{ type: 'patient', id: f('hypertension'), quote: 'hypertension' }] },
      { text: 'Diabetes is not present.', citations: [{ type: 'patient', id: f('diabetes'), quote: 'diabetes' }] }] } };
    const good = await on(`/summaries/${summaryId}/drafts`, 'POST', {});
    assert.equal(good.status, 201, JSON.stringify(good.body));
    assert.equal(good.body.attempt.accepted, true);
    assert.equal(good.body.draft.sentences.length, 2);
    llmReply = { available: true, model: 'fake', latencyMs: 3, data: { sentences: [
      { text: 'The patient has diabetes.', citations: [{ type: 'patient', id: f('diabetes'), quote: 'diabetes' }] }] } };
    const bad = await on(`/summaries/${summaryId}/drafts`, 'POST', {});
    assert.equal(bad.body.attempt.accepted, false);
    assert.equal(bad.body.draft, null);
    assert.ok(bad.body.attempt.problems[0].problems.includes('cites_non_positive_fact'));
    const list = (await on(`/summaries/${summaryId}/drafts`)).body;
    assert.equal(list.data.length, 1);
    assert.deepEqual(list.attempts, { total: 2, accepted: 1 });
    const attempts = (await owner.query('SELECT accepted, prompt_sha256, verification FROM openmed_advisory.generation_attempts ORDER BY created_at')).rows;
    assert.deepEqual(attempts.map(a => a.accepted), [true, false]);
    assert.ok(attempts.every(a => /^[0-9a-f]{64}$/.test(a.prompt_sha256) && a.verification));
    const draftId = good.body.draft.id;
    assert.equal((await on(`/drafts/${draftId}/reviews`, 'POST', { decision: 'edited' })).status, 400);
    assert.equal((await on(`/drafts/${draftId}/reviews`, 'POST', { decision: 'edited', edited_text: 'Hypertension; diabetes absent.' })).status, 201);
    assert.equal((await on(`/drafts/${draftId}/reviews`, 'POST', { decision: 'accepted' }, 2)).status, 404);
    await assert.rejects(rquery('UPDATE openmed_advisory.generated_drafts SET sentences = $1', ['[]']), { code: '42501' });
    const metrics = (await adm(`/pilots/${pilotId}/metrics`)).body;
    assert.deepEqual(metrics.generation, { attempts: 2, accepted: 1, rejected_by_verifier: 1 });
    assert.deepEqual(metrics.draft_reviews, [{ decision: 'edited', n: 1 }]);
  });

  await t.test('The rate limit is shared by server instances (counted in the database)', async () => {
    await owner.query("UPDATE openmed_advisory.generation_attempts SET created_at = now() - interval '2 minutes'");
    await owner.query("UPDATE openmed_advisory.analyses SET created_at = now() - interval '2 minutes'");
    process.env.OPENMED_RATE_PER_MINUTE = '3';
    t.after(() => { delete process.env.OPENMED_RATE_PER_MINUTE; });
    const a = await mount({ generationEnabled: true });
    const b = await mount({ generationEnabled: true });
    const body = i => ({ patient_id: patient, mode: 'diseases', text: `Patient has hypertension ${i}.` });
    const statuses = [];
    for (const [i, instance] of [a, b, a, b].entries()) statuses.push((await instance('/analyses', 'POST', body(i))).status);
    assert.deepEqual(statuses, [201, 201, 201, 429]);
  });

  await t.test('A rollout needs a closed pilot with an outcome review, and only piloted features', async () => {
    const roll = await adm('/pilots', 'POST', { name: 'SYNTHETIC rollout', scope: 'two wards', kind: 'rollout',
      approved_features: ['analysis', 'summary'], prerequisite_pilot_id: pilotId, starts_on: new Date().toISOString().slice(0, 10),
      ends_on: new Date(Date.now() + 60 * 864e5).toISOString().slice(0, 10), max_participants: 1000 });
    assert.equal(roll.status, 201, JSON.stringify(roll.body));
    await adm(`/pilots/${roll.body.id}/participants`, 'POST', { user_id: 2, role_label: 'pharmacist' });
    const approval = { approval_reference: 'SYN-2', approved_by_name: 'Synthetic', approved_by_role: 'Test', evaluation_report_ref: 'SYN-EVAL',
      evaluation_build_sha256: build, criteria_ref: 'SYN-CRIT' };
    let r = await adm(`/pilots/${roll.body.id}/activate`, 'POST', approval);
    assert.equal(r.status, 422, JSON.stringify(r.body));
    assert.deepEqual(r.body.problems.sort(), ['prerequisite_pilot_not_closed', 'prerequisite_pilot_outcome_missing']);
    assert.equal((await adm(`/pilots/${pilotId}/close`, 'POST', { reason: 'pilot finished', outcome_ref: 'SYN-PILOT-REVIEW-1' })).status, 200);
    r = await adm(`/pilots/${roll.body.id}/activate`, 'POST', approval);
    assert.equal(r.status, 200, JSON.stringify(r.body));
    const wide = await adm('/pilots', 'POST', { name: 'SYNTHETIC rollout 2', scope: 'synthetic scope', kind: 'rollout', prerequisite_pilot_id: pilotId,
      approved_features: ['analysis', 'summary', 'generation', 'generation'] });
    assert.equal(wide.status, 400, 'duplicate features refused');
    const wider = await adm('/pilots', 'POST', { name: 'SYNTHETIC rollout 3', scope: 'synthetic scope', kind: 'rollout', prerequisite_pilot_id: roll.body.id,
      approved_features: ['analysis'], starts_on: new Date().toISOString().slice(0, 10), ends_on: new Date(Date.now() + 864e5).toISOString().slice(0, 10), max_participants: 10 });
    assert.equal(wider.status, 201, JSON.stringify(wider.body));
    await adm(`/pilots/${wider.body.id}/participants`, 'POST', { user_id: 1, role_label: 'physician' });
    const widerActivation = await adm(`/pilots/${wider.body.id}/activate`, 'POST', approval);
    assert.equal(widerActivation.status, 422, JSON.stringify(widerActivation.body));
    assert.deepEqual(widerActivation.body.problems.sort(),
      ['prerequisite_must_be_a_pilot', 'prerequisite_pilot_not_closed', 'prerequisite_pilot_outcome_missing']);
    assert.equal((await adm('/pilots', 'POST', { name: 'no analysis', scope: 'synthetic scope', approved_features: ['summary'] })).status, 400);
    // A feature the pilot did not approve cannot be rolled out
    const narrowPilot = randomUUID();
    await owner.query(`INSERT INTO clinical_pilot.pilots (id,name,scope,status,starts_on,ends_on,max_participants,approval_reference,
        approved_by_name,approved_by_role,evaluation_report_ref,evaluation_build_sha256,criteria_ref,activated_at,outcome_ref,approved_features)
      VALUES ($1,'SYNTHETIC narrow pilot','synthetic','closed',current_date-30,current_date-1,5,'SYN','Synthetic','Test','SYN-EVAL',$2,'SYN-CRIT',now(),'SYN-REVIEW','{analysis,summary}')`,
    [narrowPilot, build]);
    const genRollout = await adm('/pilots', 'POST', { name: 'SYNTHETIC generation rollout', scope: 'synthetic scope', kind: 'rollout',
      prerequisite_pilot_id: narrowPilot, approved_features: ['analysis', 'generation'], starts_on: new Date().toISOString().slice(0, 10),
      ends_on: new Date(Date.now() + 864e5).toISOString().slice(0, 10), max_participants: 10 });
    await adm(`/pilots/${genRollout.body.id}/participants`, 'POST', { user_id: 1, role_label: 'physician' });
    assert.deepEqual((await adm(`/pilots/${genRollout.body.id}/activate`, 'POST', approval)).body.problems, ['feature_not_piloted']);
  });

  await t.test('Alerts are stored once per rule and pilot, and can be acknowledged', async () => {
    const rolloutId = (await owner.query("SELECT id FROM clinical_pilot.pilots WHERE name = 'SYNTHETIC rollout'")).rows[0].id;
    await owner.query(`INSERT INTO clinical_pilot.issue_reports (id,pilot_id,category,severity,description)
      VALUES ($1,$2,'other','serious','synthetic')`, [randomUUID(), rolloutId]);
    const first = (await adm('/alerts/evaluate', 'POST', {})).body.created;
    assert.ok(first.some(a => a.rule === 'open_serious_issues' && a.level === 'critical' && a.pilot_id === rolloutId));
    const again = (await adm('/alerts/evaluate', 'POST', {})).body.created;
    assert.ok(!again.some(a => a.rule === 'open_serious_issues'), 'not repeated while open');
    const alert = first.find(a => a.rule === 'open_serious_issues');
    assert.equal((await adm(`/alerts/${alert.id}/ack`, 'POST', {})).status, 200);
    assert.ok(!(await adm('/alerts')).body.data.some(a => a.id === alert.id));
    await assert.rejects(rquery('SELECT * FROM clinical_pilot.alerts'), { code: '42501' });
  });

  await t.test('Retention: dry run changes nothing; apply needs a policy and keeps the audit trail', async () => {
    const client = { query: (sql, params) => owner.query(sql, params) };
    await owner.query("UPDATE openmed_advisory.analyses SET created_at = now() - interval '400 days'");
    const dry = await applyRetention(client, { days: 365 });
    assert.ok(dry.eligible.analyses >= 1, JSON.stringify(dry));
    assert.ok(dry.eligible.analyses >= 1 && dry.eligible.summaries >= 1 && dry.eligible.drafts >= 1);
    assert.equal((await owner.query('SELECT count(*)::int AS n FROM openmed_advisory.analyses WHERE input_text = $1', [MARKER])).rows[0].n, 0);
    await assert.rejects(applyRetention(client, { days: 365, apply: true }), /policy-ref/);
    const reviewsBefore = (await owner.query('SELECT count(*)::int AS n FROM openmed_advisory.draft_reviews')).rows[0].n;
    const done = await applyRetention(client, { days: 365, apply: true, policyRef: 'SYN-POLICY' });
    assert.equal(done.applied, true);
    const a = (await owner.query('SELECT input_text, result FROM openmed_advisory.analyses LIMIT 1')).rows[0];
    assert.equal(a.input_text, MARKER);
    assert.equal(a.result.retention.policy_ref, 'SYN-POLICY');
    assert.ok(!JSON.stringify(a.result).includes('hypertension'));
    const s = (await owner.query('SELECT content FROM openmed_advisory.summaries LIMIT 1')).rows[0].content;
    assert.ok(!JSON.stringify(s).includes('hypertension') && s.retention);
    assert.equal((await owner.query("SELECT count(*)::int AS n FROM openmed_advisory.generated_drafts WHERE sentences <> '[]'::jsonb")).rows[0].n, 0);
    assert.equal((await owner.query('SELECT count(*)::int AS n FROM openmed_advisory.draft_reviews')).rows[0].n, reviewsBefore);
    assert.equal((await owner.query('SELECT count(*)::int AS n FROM openmed_advisory.draft_reviews WHERE edited_text <> $1', [MARKER])).rows[0].n, 0);
    assert.deepEqual((await applyRetention(client, { days: 365 })).eligible, { analyses: 0, summaries: 0, drafts: 0 });
  });
});
