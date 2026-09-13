import express from 'express';
import Joi from 'joi';
import { randomUUID } from 'node:crypto';
import { advisoryQuery } from './database.js';
import { runLocalAnalysis, runtimeReady } from './inference.js';

const uuid = Joi.string().guid({ version: ['uuidv4', 'uuidv5', 'uuidv1', 'uuidv3', 'uuidv2'] }).required();
const sourceTypes = ['manual', 'prior_authorization', 'claim'];
const input = Joi.object({ patient_id: uuid, source_type: Joi.string().valid(...sourceTypes).default('manual'),
  source_id: Joi.number().integer().positive().allow(null).default(null),
  mode: Joi.string().valid('medications', 'diseases').required(), text: Joi.string().trim().min(1).max(12000).required() }).unknown(false);
function validate(schema, value) {
  const result = schema.validate(value);
  if (result.error) throw Object.assign(new Error('Invalid advisory input'), { status: 400 });
  return result.value;
}
function failure(message, status) { return Object.assign(new Error(message), { status }); }

export function createAdvisoryRouter({ query = advisoryQuery, analyze = runLocalAnalysis, ready = runtimeReady } = {}) {
  const router = express.Router();
  const route = fn => async (req, res) => {
    try { await fn(req, res); }
    catch (error) { res.status(error.status || 503).json({ error: error.status ? error.message : 'OpenMed database is unavailable or not migrated' }); }
  };
  router.use((req, res, next) => {
    res.set('Cache-Control', 'no-store');
    if (!req.user?.id) return res.status(401).json({ error: 'Authentication required' });
    next();
  });
  // Verify effective privileges, not just a role name. Refuse privileged app credentials.
  router.use(async (req, res, next) => {
    try {
      const { rows } = await query(`SELECT EXISTS (
        SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
        WHERE n.nspname='public' AND c.relkind IN ('r','p') AND
          (has_table_privilege(current_user,c.oid,'INSERT,UPDATE,DELETE,TRUNCATE')
           OR has_any_column_privilege(current_user,c.oid,'INSERT,UPDATE'))
      ) AS unsafe`);
      if (rows[0]?.unsafe !== false) return res.status(503).json({ error: 'OpenMed requires a database login without write access to application tables' });
      next();
    } catch { res.status(503).json({ error: 'OpenMed database is not configured or unavailable' }); }
  });
  router.get('/status', route(async (req, res) => {
    await query('SELECT id FROM openmed_advisory.analyses LIMIT 0');
    res.json({ database: 'connected', runtime_ready: ready(), advisory_only: true, language: 'en', sdk_version: '2.3.0' });
  }));
  router.get('/patients', route(async (req, res) => {
    const search = validate(Joi.string().trim().min(2).max(100).required(), req.query.search);
    const { rows } = await query('SELECT patient_id,name,identifier FROM public.patients WHERE name ILIKE $1 OR identifier ILIKE $1 ORDER BY name LIMIT 20', [`%${search}%`]);
    res.json({ data: rows });
  }));
  router.get('/patients/:patientId/sources', route(async (req, res) => {
    const patient = validate(uuid, req.params.patientId);
    const { rows } = await query(`SELECT 'prior_authorization' AS source_type,id AS source_id,request_number AS label
      FROM public.prior_authorizations WHERE patient_id=$1
      UNION ALL SELECT 'claim',id,claim_number FROM public.claim_submissions WHERE patient_id=$1
      ORDER BY source_type,source_id DESC LIMIT 100`, [patient]);
    res.json({ data: rows });
  }));
  async function source(patient, type, id) {
    const sql = type === 'prior_authorization'
      ? `SELECT primary_diagnosis,diagnosis_codes FROM public.prior_authorizations WHERE id=$1 AND patient_id=$2`
      : `SELECT primary_diagnosis,diagnosis_codes FROM public.claim_submissions WHERE id=$1 AND patient_id=$2`;
    const { rows } = await query(sql, [id, patient]);
    if (!rows[0]) throw failure('Source does not belong to the selected patient', 404);
    const details = await query(type === 'prior_authorization'
      ? 'SELECT value_string FROM public.prior_authorization_supporting_info WHERE prior_auth_id=$1'
      : 'SELECT value_string FROM public.claim_supporting_info WHERE claim_id=$1', [id]);
    const text = [rows[0].primary_diagnosis, rows[0].diagnosis_codes, ...details.rows.map(row => row.value_string)].filter(Boolean).join('\n');
    if (text.length > 12000) throw failure('Source exceeds 12000 characters; select a shorter manual excerpt', 400);
    return text;
  }
  router.get('/patients/:patientId/sources/:type/:sourceId', route(async (req, res) => {
    const patient = validate(uuid, req.params.patientId);
    const type = validate(Joi.string().valid('prior_authorization', 'claim').required(), req.params.type);
    const id = validate(Joi.number().integer().positive().required(), req.params.sourceId);
    res.json({ text: await source(patient, type, id) });
  }));
  router.post('/analyses', route(async (req, res) => {
    const value = validate(input, req.body);
    if (/[\u0600-\u06ff]/u.test(value.text)) throw failure('Configured models support English text only; Arabic clinical accuracy is not validated', 400);
    if ((value.source_type === 'manual') !== (value.source_id === null)) throw failure('Invalid source reference', 400);
    const patient = await query('SELECT patient_id FROM public.patients WHERE patient_id=$1', [value.patient_id]);
    if (!patient.rows[0]) throw failure('Patient not found', 404);
    if (value.source_type !== 'manual') await source(value.patient_id, value.source_type, value.source_id);
    const result = await analyze(value.text, value.mode);
    const { rows } = await query(`INSERT INTO openmed_advisory.analyses
      (id,user_id,patient_id,source_type,source_id,mode,input_text,result) VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb) RETURNING *`,
    [randomUUID(), req.user.id, value.patient_id, value.source_type, value.source_id, value.mode, value.text, JSON.stringify(result)]);
    res.status(201).json(rows[0]);
  }));
  router.get('/analyses', route(async (req, res) => {
    const patient = validate(uuid, req.query.patient_id);
    const { rows } = await query('SELECT * FROM openmed_advisory.analyses WHERE user_id=$1 AND patient_id=$2 ORDER BY created_at DESC LIMIT 30', [req.user.id, patient]);
    res.json({ data: rows });
  }));
  router.patch('/analyses/:id', route(async (req, res) => {
    const id = validate(uuid, req.params.id);
    const value = validate(Joi.object({ review_status: Joi.string().valid('reviewed','dismissed').required(),
      review_note: Joi.string().max(2000).allow('').default('') }).unknown(false), req.body);
    const { rows } = await query(`UPDATE openmed_advisory.analyses SET review_status=$1,review_note=$2,reviewed_at=now()
      WHERE id=$3 AND user_id=$4 RETURNING *`, [value.review_status, value.review_note, id, req.user.id]);
    if (!rows[0]) throw failure('Analysis not found', 404);
    res.json(rows[0]);
  }));
  return router;
}

export default createAdvisoryRouter();
