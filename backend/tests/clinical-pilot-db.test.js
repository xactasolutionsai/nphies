// Phase 4 against PostgreSQL: the pilot gate, error reports that pause the pilot, admin
// activation that requires the evaluated build, triage, and aggregate metrics.
// Throw-away database, synthetic data only.
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
import { requiredRoleFor } from '../middleware/requireRole.js';

async function listen(t, app) {
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); }));
  return `http://127.0.0.1:${server.address().port}`;
}
const caller = base => async (path, method = 'GET', body, user = 1) => {
  const r = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json', 'test-user': String(user) },
    ...(body ? { body: JSON.stringify(body) } : {}) });
  return { status: r.status, body: await r.json() };
};

test('Pilot administration is admin-only', () => {
  for (const m of ['GET', 'POST', 'PATCH']) assert.equal(requiredRoleFor(m, '/clinical-pilot/pilots'), 'admin');
  assert.equal(requiredRoleFor('POST', '/openmed/issues'), 'reviewer');
});

test('Pilot gate, error reports, activation and metrics', { skip: !process.env.TEST_OPENMED_DATABASE_URL }, async t => {
  const url = new URL(process.env.TEST_OPENMED_DATABASE_URL);
  assert.ok(['localhost', '127.0.0.1'].includes(url.hostname) && url.pathname.endsWith('_regression'));
  const suffix = randomUUID().replaceAll('-', '');
  const dbName = `pilot_${suffix}_regression`, login = `pl_${suffix}`;
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
    '073_openmed_idempotency.sql', '074_clinical_pilot.sql']) {
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

  t.mock.method(pool, 'query', (sql, params) => owner.query(sql, params));
  t.mock.method(pool, 'connect', async () => ({ query: (sql, params) => owner.query(sql, params), release() {} }));
  const aapp = express(); aapp.use(express.json());
  aapp.use((req, res, next) => { req.user = { id: 3, role: 'admin' }; next(); });
  aapp.use('/p', pilotRouter);
  const adm = caller(`${await listen(t, aapp)}/p`);

  let deployed = buildFingerprint().sha256;
  const app = express(); app.use(express.json());
  app.use((req, res, next) => { req.user = { id: Number(req.get('test-user') || 1) }; next(); });
  app.use('/om', createAdvisoryRouter({ query: rquery, ready: () => true, requirePilot: true,
    fingerprint: () => ({ ...buildFingerprint(), sha256: deployed }),
    analyze: async text => ({ entities: [{ text: 'metformin', label: 'CHEM', confidence: 0.9, start: text.indexOf('metformin'), end: text.indexOf('metformin') + 9 }],
      model: { id: 'synthetic', revision: 'none' }, advisory_only: true, language: 'en', sdk_version: 'test' }) }));
  const om = caller(`${await listen(t, app)}/om`);
  const payload = { patient_id: patient, mode: 'medications', text: 'Takes metformin 500 mg PO BID.' };

  let pilotId, analysisId;
  await t.test('Without an active approved pilot the assistant does not run', async () => {
    const r = await om('/analyses', 'POST', payload);
    assert.equal(r.status, 403);
    assert.equal(r.body.reason, 'no_active_pilot');
    assert.equal((await om('/status')).body.pilot.reason, 'no_active_pilot');
  });

  await t.test('Activation needs dates, participants, approval evidence and the evaluated build', async () => {
    const created = await adm('/pilots', 'POST', { name: 'SYNTHETIC pilot', scope: 'synthetic test ward' });
    assert.equal(created.status, 201);
    pilotId = created.body.id;
    const approval = { approval_reference: 'SYN-MINUTE-1', approved_by_name: 'Synthetic Approver', approved_by_role: 'Medical Director (test)',
      evaluation_report_ref: 'SYN-EVAL-1', evaluation_build_sha256: deployed, criteria_ref: 'SYN-CRITERIA-1' };
    const early = await adm(`/pilots/${pilotId}/activate`, 'POST', approval);
    assert.equal(early.status, 422);
    assert.deepEqual(early.body.problems.sort(), ['dates', 'max_participants', 'participants']);
    const today = new Date().toISOString().slice(0, 10);
    const later = new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10);
    assert.equal((await adm(`/pilots/${pilotId}`, 'PATCH', { starts_on: today, ends_on: later, max_participants: 1 })).status, 200);
    assert.equal((await adm(`/pilots/${pilotId}/participants`, 'POST', { user_id: 1, role_label: 'physician' })).status, 201);
    assert.equal((await adm(`/pilots/${pilotId}/participants`, 'POST', { user_id: 2, role_label: 'pharmacist' })).status, 409, 'max participants');
    assert.equal((await adm(`/pilots/${pilotId}/activate`, 'POST', { ...approval, evaluation_report_ref: undefined })).status, 400);
    const wrongBuild = await adm(`/pilots/${pilotId}/activate`, 'POST', { ...approval, evaluation_build_sha256: 'f'.repeat(64) });
    assert.equal(wrongBuild.status, 409);
    assert.equal(wrongBuild.body.deployed_build, buildFingerprint().sha256);
    const ok = await adm(`/pilots/${pilotId}/activate`, 'POST', approval);
    assert.equal(ok.status, 200);
    assert.equal(ok.body.status, 'active');
    assert.equal((await adm(`/pilots/${pilotId}`, 'PATCH', { name: 'changed' })).status, 409);
  });

  await t.test('Participants of the active pilot can run it; others cannot', async () => {
    const r = await om('/analyses', 'POST', payload);
    assert.equal(r.status, 201, JSON.stringify(r.body));
    assert.equal(r.body.pilot_id, pilotId);
    analysisId = r.body.id;
    const other = await om('/analyses', 'POST', payload, 2);
    assert.equal(other.status, 403);
    assert.equal(other.body.reason, 'no_active_pilot');
    assert.equal((await om('/status')).body.pilot.eligible, true);
  });

  await t.test('Outside the dates or with a different deployed build the assistant stops', async () => {
    await owner.query("UPDATE clinical_pilot.pilots SET starts_on = current_date + 1, ends_on = current_date + 5 WHERE id = $1", [pilotId]);
    assert.equal((await om('/analyses', 'POST', payload)).body.reason, 'outside_dates');
    await owner.query("UPDATE clinical_pilot.pilots SET starts_on = current_date, ends_on = current_date + 30 WHERE id = $1", [pilotId]);
    deployed = '0'.repeat(64);
    assert.equal((await om('/analyses', 'POST', payload)).body.reason, 'build_not_evaluated');
    assert.equal((await om(`/analyses/${analysisId}/summaries`, 'POST', {})).status, 403);
    deployed = buildFingerprint().sha256;
  });

  let seriousId;
  await t.test('Error reports: own analyses only, no identifiers, and a serious report pauses the pilot', async () => {
    const minor = await om('/issues', 'POST', { analysis_id: analysisId, category: 'wrong_medication_status', severity: 'minor', entity_index: 0 });
    assert.equal(minor.status, 201);
    assert.equal(minor.body.pilot_id, pilotId);
    assert.equal((await om('/issues', 'POST', { analysis_id: analysisId, category: 'other', severity: 'minor',
      description: 'patient 1023456789 affected' })).status, 422);
    assert.equal((await om('/issues', 'POST', { analysis_id: analysisId, category: 'wrong_entity', severity: 'minor' }, 2)).status, 404);
    assert.equal((await om('/issues', 'POST', { category: 'wrong_entity', severity: 'minor' })).status, 400);
    const serious = await om('/issues', 'POST', { analysis_id: analysisId, category: 'wrong_assertion', severity: 'serious',
      description: 'Negated finding shown as present (synthetic)' });
    assert.equal(serious.body.pauses_pilot, true);
    seriousId = serious.body.id;
    const blocked = await om('/analyses', 'POST', payload);
    assert.equal(blocked.status, 403);
    assert.equal(blocked.body.reason, 'paused_serious_issue');
    // Reading, reviewing and reporting still work while paused
    assert.equal((await om(`/analyses?patient_id=${patient}`)).status, 200);
    assert.equal((await om(`/analyses/${analysisId}/reviews`, 'POST', { decision: 'rejected', note: 'synthetic' })).status, 201);
    assert.equal((await om('/issues')).body.data.length, 2);
    assert.equal((await om('/issues', 'GET', null, 2)).body.data.length, 0);
  });

  await t.test('Resolution: resume refused while a serious report is open; fixing it reopens the gate', async () => {
    assert.equal((await adm(`/pilots/${pilotId}/pause`, 'POST', { reason: 'serious report under review' })).status, 200);
    assert.equal((await adm(`/pilots/${pilotId}/resume`, 'POST', { reason: 'try' })).status, 409);
    assert.equal((await adm(`/issues/${seriousId}`, 'PATCH', { status: 'fixed' })).status, 400, 'fixed needs the build');
    assert.equal((await adm(`/issues/${seriousId}`, 'PATCH', { status: 'fixed', triage_note: 'rule corrected (synthetic)',
      fixed_in_build: buildFingerprint().sha256 })).status, 200);
    assert.equal((await adm(`/pilots/${pilotId}/resume`, 'POST', { reason: 'fix verified' })).status, 200);
    assert.equal((await om('/analyses', 'POST', { ...payload, text: 'Continue metformin 500 mg daily.' })).status, 201);
  });

  await t.test('Metrics are aggregates without note text; the advisory login cannot manage pilots', async () => {
    const m = (await adm(`/pilots/${pilotId}/metrics`)).body;
    assert.equal(m.analyses.total, 2);
    assert.deepEqual(m.reviews, [{ decision: 'rejected', n: 1 }]);
    assert.equal(m.rates.review_coverage, 0.5);
    assert.equal(m.issues.reduce((s, i) => s + i.n, 0), 2);
    assert.ok(!JSON.stringify(m).toLowerCase().includes('metformin'));
    await assert.rejects(rquery("UPDATE clinical_pilot.pilots SET status='active'"), { code: '42501' });
    await assert.rejects(rquery("UPDATE clinical_pilot.issue_reports SET status='fixed'"), { code: '42501' });
    await assert.rejects(rquery('DELETE FROM clinical_pilot.issue_reports'), { code: '42501' });
    await assert.rejects(rquery("INSERT INTO clinical_pilot.participants (pilot_id,user_id,role_label) VALUES ($1,2,'x')", [pilotId]), { code: '42501' });
    assert.equal((await adm(`/pilots/${pilotId}/close`, 'POST', { reason: 'synthetic pilot finished' })).status, 200);
    assert.equal((await om('/analyses', 'POST', payload)).body.reason, 'no_active_pilot');
  });
});
