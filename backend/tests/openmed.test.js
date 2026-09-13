import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import pg from 'pg';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import { createAdvisoryRouter } from '../openmed/routes.js';
import { runLocalAnalysis } from '../openmed/inference.js';

test('OpenMed rejects unauthenticated access before reading the database', async t => {
  const app = express();
  app.use('/api/openmed', createAdvisoryRouter({ query: () => { throw new Error('Must not query'); } }));
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => server.close());
  assert.equal((await fetch(`http://127.0.0.1:${server.address().port}/api/openmed/status`)).status, 401);
});

test('OpenMed database integration and isolation', { skip: !process.env.TEST_OPENMED_DATABASE_URL }, async t => {
  const url = new URL(process.env.TEST_OPENMED_DATABASE_URL);
  assert.ok(['localhost', '127.0.0.1'].includes(url.hostname) && url.pathname.endsWith('_regression'));
  const suffix = randomUUID().replaceAll('-', '');
  const dbName = `openmed_${suffix}_regression`, login = `om_${suffix}`;
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
  await owner.query(`CREATE TABLE public.users(id SERIAL PRIMARY KEY);
    CREATE TABLE public.patients(patient_id UUID PRIMARY KEY,name TEXT,identifier TEXT);
    CREATE TABLE public.prior_authorizations(id INTEGER PRIMARY KEY,patient_id UUID,request_number TEXT,primary_diagnosis TEXT,diagnosis_codes TEXT);
    CREATE TABLE public.claim_submissions(id INTEGER PRIMARY KEY,patient_id UUID,claim_number TEXT,primary_diagnosis TEXT,diagnosis_codes TEXT);
    CREATE TABLE public.prior_authorization_supporting_info(prior_auth_id INTEGER,value_string TEXT);
    CREATE TABLE public.claim_submission_supporting_info(claim_id INTEGER,value_string TEXT);
    INSERT INTO public.users VALUES (1),(2);`);
  const patientId = randomUUID(), otherPatient = randomUUID();
  await owner.query('INSERT INTO public.patients VALUES ($1,$2,$3),($4,$5,$6)', [patientId,'Synthetic Patient','SYNTHETIC-1',otherPatient,'Other Synthetic','SYNTHETIC-2']);
  await owner.query("INSERT INTO public.prior_authorizations VALUES (1,$1,'PA-TEST','diabetes','E11')", [patientId]);
  await owner.query("INSERT INTO public.claim_submissions VALUES (1,$1,'CL-TEST','diabetes','E11')", [patientId]);
  await owner.query("INSERT INTO public.prior_authorization_supporting_info VALUES (1,'Patient takes metformin for type 2 diabetes.')");
  await owner.query("INSERT INTO public.claim_submission_supporting_info VALUES (1,'Patient takes metformin for type 2 diabetes.')");
  const migration = await fs.readFile(new URL('../migrations/064_openmed_advisory.sql', import.meta.url), 'utf8');
  await owner.query(migration);
  await owner.query(migration); // idempotent
  // Generated identifiers/password contain only a-z0-9; no user SQL interpolation.
  const password = randomUUID().replaceAll('-', '');
  await admin.query(`CREATE ROLE ${login} LOGIN PASSWORD '${password}' IN ROLE nafes_openmed`);
  url.username = login; url.password = password;
  restricted = new pg.Client({ connectionString: url.href });
  await restricted.connect();
  const query = (sql, values) => restricted.query(sql, values);
  const result = { entities: [{ text:'metformin',label:'CHEM',confidence:0.95,start:14,end:23 }],
    model: { id:'synthetic-test-model',revision:'test' },advisory_only:true,sdk_version:'2.3.0',language:'en' };
  let simulateFailure = false;
  const app = express(); app.use(express.json());
  app.use((req, res, next) => { req.user = { id: Number(req.get('test-user') || 1) }; next(); });
  app.use('/api/openmed', createAdvisoryRouter({ query, ready: () => true, analyze: async (...args) => {
    if (simulateFailure) throw Object.assign(new Error('Analysis failed'), { status:503 });
    return process.env.TEST_OPENMED_REAL_MODELS === 'true' ? runLocalAnalysis(...args) : result;
  } }));
  const server = app.listen(0,'127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => server.close());
  const base = `http://127.0.0.1:${server.address().port}/api/openmed`;
  async function call(path, method='GET', body, user=1) {
    const response = await fetch(base+path,{method,headers:{'Content-Type':'application/json','test-user':String(user)},
      ...(body ? {body:JSON.stringify(body)} : {})});
    return { status:response.status,body:await response.json() };
  }
  const snapshot = async () => (await owner.query(`SELECT jsonb_build_object(
    'patients',(SELECT jsonb_agg(t) FROM public.patients t),
    'pa',(SELECT jsonb_agg(t) FROM public.prior_authorizations t),
    'claims',(SELECT jsonb_agg(t) FROM public.claim_submissions t),
    'pa_info',(SELECT jsonb_agg(t) FROM public.prior_authorization_supporting_info t),
    'claim_info',(SELECT jsonb_agg(t) FROM public.claim_submission_supporting_info t)) AS data`)).rows[0].data;
  const before = await snapshot();
  await t.test('Refuses privileged connection credentials before serving advisory data', async () => {
    const unsafeApp = express();
    unsafeApp.use((req,res,next) => { req.user={id:1}; next(); });
    unsafeApp.use(createAdvisoryRouter({query:(sql,values)=>owner.query(sql,values)}));
    const unsafeServer = unsafeApp.listen(0,'127.0.0.1');
    await new Promise(resolve=>unsafeServer.once('listening',resolve));
    try {
      assert.equal((await fetch(`http://127.0.0.1:${unsafeServer.address().port}/status`)).status,503);
    } finally { await new Promise(resolve=>unsafeServer.close(resolve)); }
  });
  await t.test('Database role cannot modify any original table or even read ungranted user data', async () => {
    for (const table of ['patients','prior_authorizations','claim_submissions','prior_authorization_supporting_info','claim_submission_supporting_info']) {
      await assert.rejects(query(`DELETE FROM public.${table}`), { code:'42501' });
    }
    await assert.rejects(query('SELECT * FROM public.users'), { code:'42501' });
    assert.equal((await call('/status')).status,200);
  });
  await t.test('Reads patient/source context without modifying originals', async () => {
    assert.equal((await call('/patients?search=SYNTHETIC-1')).body.data[0].patient_id,patientId);
    assert.equal((await call(`/patients/${patientId}/sources`)).body.data.length,2);
    for (const type of ['claim','prior_authorization']) {
      assert.match((await call(`/patients/${patientId}/sources/${type}/1`)).body.text,/metformin/);
      assert.equal((await call(`/patients/${otherPatient}/sources/${type}/1`)).status,404);
    }
  });
  const payload = {patient_id:patientId,source_type:'claim',source_id:1,mode:'medications',text:'Patient takes metformin for type 2 diabetes.'};
  let saved;
  await t.test('Analysis is persisted, owner-scoped, and review changes only the advisory row', async () => {
    saved = await call('/analyses','POST',payload);
    assert.equal(saved.status,201,JSON.stringify(saved.body));
    assert.ok(saved.body.result.entities.some(entity=>entity.text.toLowerCase()==='metformin'));
    assert.equal((await call(`/analyses?patient_id=${patientId}`)).body.data.length,1);
    assert.equal((await call(`/analyses?patient_id=${patientId}`,'GET',null,2)).body.data.length,0);
    assert.equal((await call(`/analyses/${saved.body.id}`,'PATCH',{review_status:'reviewed'},2)).status,404);
    const reviewed = await call(`/analyses/${saved.body.id}`,'PATCH',{review_status:'reviewed',review_note:'Synthetic review'});
    assert.equal(reviewed.body.review_note,'Synthetic review');
    assert.equal(reviewed.body.result.advisory_only,true);
  });
  await t.test('Rejects forged fields, Arabic input, mismatched references, and failed inference', async () => {
    assert.equal((await call('/analyses','POST',{...payload,status:'approved'})).status,400);
    assert.equal((await call('/analyses','POST',{...payload,text:'نص طبي'})).status,400);
    assert.equal((await call('/analyses','POST',{...payload,patient_id:otherPatient})).status,404);
    assert.equal((await call('/analyses','POST',{...payload,source_type:'manual'})).status,400);
    simulateFailure=true;
    assert.equal((await call('/analyses','POST',payload)).status,503);
    simulateFailure=false;
    assert.equal((await call(`/analyses?patient_id=${patientId}`)).body.data.length,1);
  });
  await t.test('All original patient and NPHIES source rows remain byte-equivalent as JSON', async () => {
    assert.deepEqual(await snapshot(),before);
  });
});

test('Real local disease model and long-note tail extraction', {skip:process.env.TEST_OPENMED_REAL_MODELS !== 'true'}, async () => {
  const result = await runLocalAnalysis('Routine follow up. '.repeat(140) + 'Patient has diabetes.', 'diseases');
  assert.ok(result.entities.some(entity => /diabetes/i.test(entity.text) && entity.start > 2400));
  assert.equal(result.advisory_only,true);
});
