import express from 'express';
import Joi from 'joi';
import { randomUUID } from 'node:crypto';
import { advisoryQuery } from './database.js';
import { runLocalAnalysis, runtimeReady, runtimeStatus as poolStatus } from './inference.js';
import { buildFingerprint } from './fingerprint.js';
import { contextForOpenMed } from '../clinical-context/openmedAdapter.js';
import { ENGINE } from '../clinical-context/index.js';
import { buildSummary, patientFacts, queryTerms } from '../clinical-evidence/summary.js';
import { retrieveForTerms, corpusSnapshot } from '../clinical-evidence/retrieval.js';

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

// An active, unexpired, unrevoked grant for (user, patient) in public.clinical_ai_patient_access
// (migration 071). Being logged in is not enough to read a patient's clinical text.
const ACTIVE_GRANT = `EXISTS (SELECT 1 FROM public.clinical_ai_patient_access g
  WHERE g.user_id = $USER AND g.patient_id = $PATIENT AND g.revoked_at IS NULL
    AND (g.expires_at IS NULL OR g.expires_at > now()))`;
const grantSql = (userParam, patientExpr) => ACTIVE_GRANT.replace('$USER', userParam).replace('$PATIENT', patientExpr);

const ENUMS = {
  assertion: ['present', 'absent', 'possible', 'conditional', 'unknown'],
  experiencer: ['patient', 'family', 'other', 'unknown'],
  temporality: ['current', 'historical', 'future', 'unknown'],
  medication_status: ['current', 'discontinued', 'proposed', 'historical', 'unknown'],
  type: ['problem', 'medication', 'allergy', 'procedure', 'not_an_entity']
};
const FREE_TEXT_FIELDS = ['dose', 'unit', 'route', 'frequency', 'duration'];
const correction = Joi.object({
  entity_index: Joi.number().integer().min(0).required(),
  field: Joi.string().valid(...Object.keys(ENUMS), ...FREE_TEXT_FIELDS).required(),
  value: Joi.alternatives().conditional('field', [
    ...Object.entries(ENUMS).map(([field, values]) => ({ is: field, then: Joi.string().valid(...values).required() }))
  ], { otherwise: Joi.string().trim().max(50).allow('', null).required() }),
  reason: Joi.string().trim().max(500).allow('').default('')
}).unknown(false);
const reviewInput = Joi.object({
  decision: Joi.string().valid('accepted', 'rejected', 'corrected').required(),
  corrections: Joi.when('decision', { is: 'corrected',
    then: Joi.array().items(correction).min(1).max(200).required(),
    otherwise: Joi.array().max(0).default([]) }),
  note: Joi.string().max(2000).allow('').default('')
}).unknown(false);

const IDEMPOTENCY_KEY = /^[A-Za-z0-9-]{8,100}$/;

/** Per-user token bucket for model runs (in this process; several instances need a shared store). */
export function createRateLimiter({ perMinute = 20, now = () => Date.now() } = {}) {
  const buckets = new Map();
  return userId => {
    const t = now();
    const bucket = buckets.get(userId) || { tokens: perMinute, at: t };
    bucket.tokens = Math.min(perMinute, bucket.tokens + ((t - bucket.at) * perMinute) / 60000);
    bucket.at = t;
    buckets.set(userId, bucket);
    if (bucket.tokens < 1) return Math.ceil(((1 - bucket.tokens) * 60000) / perMinute / 1000);
    bucket.tokens -= 1;
    return 0;
  };
}

export function createAdvisoryRouter({ query = advisoryQuery, analyze = runLocalAnalysis, ready = runtimeReady,
  runtimeStatus = poolStatus, fingerprint = buildFingerprint,
  rateLimit = createRateLimiter({ perMinute: Number(process.env.OPENMED_RATE_PER_MINUTE) || 20 }) } = {}) {
  const router = express.Router();
  const inFlight = new Map();          // `${user}:${idempotency key}` -> promise of the stored row
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
  async function requirePatientAccess(userId, patientId) {
    const { rows } = await query(`SELECT ${grantSql('$1', '$2')} AS allowed`, [userId, patientId]);
    if (rows[0]?.allowed !== true) throw failure('No active clinical AI access to this patient', 403);
  }
  router.get('/status', route(async (req, res) => {
    await query('SELECT id FROM openmed_advisory.analyses LIMIT 0');
    await query('SELECT analysis_id FROM openmed_advisory.analysis_reviews LIMIT 0');
    res.json({ database: 'connected', runtime_ready: ready(), advisory_only: true, language: 'en', sdk_version: '2.3.0',
      context_engine: { name: ENGINE.name, version: ENGINE.version, languages: ENGINE.languages },
      patient_access: 'explicit_grant', runtime: runtimeStatus(), build: fingerprint() });
  }));
  router.get('/patients', route(async (req, res) => {
    const search = validate(Joi.string().trim().min(2).max(100).required(), req.query.search);
    const { rows } = await query(`SELECT p.patient_id,p.name,p.identifier FROM public.patients p
      WHERE (p.name ILIKE $1 OR p.identifier ILIKE $1) AND ${grantSql('$2', 'p.patient_id')}
      ORDER BY p.name LIMIT 20`, [`%${search}%`, req.user.id]);
    res.json({ data: rows });
  }));
  router.get('/patients/:patientId/sources', route(async (req, res) => {
    const patient = validate(uuid, req.params.patientId);
    await requirePatientAccess(req.user.id, patient);
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
      : 'SELECT value_string FROM public.claim_submission_supporting_info WHERE claim_id=$1', [id]);
    const text = [rows[0].primary_diagnosis, rows[0].diagnosis_codes, ...details.rows.map(row => row.value_string)].filter(Boolean).join('\n');
    if (text.length > 12000) throw failure('Source exceeds 12000 characters; select a shorter manual excerpt', 400);
    return text;
  }
  router.get('/patients/:patientId/sources/:type/:sourceId', route(async (req, res) => {
    const patient = validate(uuid, req.params.patientId);
    const type = validate(Joi.string().valid('prior_authorization', 'claim').required(), req.params.type);
    const id = validate(Joi.number().integer().positive().required(), req.params.sourceId);
    await requirePatientAccess(req.user.id, patient);
    res.json({ text: await source(patient, type, id) });
  }));
  router.post('/analyses', route(async (req, res) => {
    const value = validate(input, req.body);
    if (/[\u0600-\u06ff]/u.test(value.text)) throw failure('Configured models support English text only; Arabic clinical accuracy is not validated', 400);
    if ((value.source_type === 'manual') !== (value.source_id === null)) throw failure('Invalid source reference', 400);
    const patient = await query('SELECT patient_id FROM public.patients WHERE patient_id=$1', [value.patient_id]);
    if (!patient.rows[0]) throw failure('Patient not found', 404);
    await requirePatientAccess(req.user.id, value.patient_id);
    if (value.source_type !== 'manual') await source(value.patient_id, value.source_type, value.source_id);

    // Idempotency: the same key from the same user returns the first result (no second run).
    const key = req.get('Idempotency-Key') ?? null;
    if (key !== null && !IDEMPOTENCY_KEY.test(key)) throw failure('Invalid Idempotency-Key', 400);
    const sameInput = row => row.patient_id === value.patient_id && row.mode === value.mode && row.input_text === value.text
      && row.source_type === value.source_type && (row.source_id ?? null) === value.source_id;
    const replay = row => {
      if (!sameInput(row)) throw failure('Idempotency-Key was already used for a different request', 409);
      res.set('Idempotent-Replay', 'true').status(200).json(row);
    };
    const existing = async () => key === null ? null : (await query(
      'SELECT * FROM openmed_advisory.analyses WHERE user_id=$1 AND idempotency_key=$2', [req.user.id, key])).rows[0];
    const stored = await existing();
    if (stored) return replay(stored);
    const flightKey = key === null ? null : `${req.user.id}:${key}`;
    if (flightKey && inFlight.has(flightKey)) return replay(await inFlight.get(flightKey));

    const retryAfter = rateLimit(req.user.id);
    if (retryAfter > 0) {
      res.set('Retry-After', String(retryAfter));
      throw failure('Too many analyses; try again shortly', 429);
    }

    // A client that disconnects cancels its queued analysis instead of occupying a worker.
    const controller = new AbortController();
    res.on('close', () => { if (!res.writableFinished) controller.abort(); });
    const run = (async () => {
      const analysis = await analyze(value.text, value.mode, { signal: controller.signal });
      // Context (negation, family history, medication status...) is computed before anything is
      // stored, so entities are never saved or shown without it. A context failure is stored as such.
      const result = { ...analysis, context: contextForOpenMed(value.text, analysis, value.mode) };
      try {
        const { rows } = await query(`INSERT INTO openmed_advisory.analyses
          (id,user_id,patient_id,source_type,source_id,mode,input_text,result,idempotency_key)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9) RETURNING *`,
        [randomUUID(), req.user.id, value.patient_id, value.source_type, value.source_id, value.mode, value.text,
          JSON.stringify(result), key]);
        return rows[0];
      } catch (error) {
        const winner = error.code === '23505' ? await existing() : null;   // another instance stored it first
        if (winner) return winner;
        throw error;
      }
    })();
    if (flightKey) inFlight.set(flightKey, run);
    try {
      const row = await run;
      if (key !== null && row.id && !sameInput(row)) return replay(row);
      res.status(201).json(row);
    } finally {
      if (flightKey) inFlight.delete(flightKey);
    }
  }));
  router.get('/analyses', route(async (req, res) => {
    const patient = validate(uuid, req.query.patient_id);
    await requirePatientAccess(req.user.id, patient);
    const { rows } = await query('SELECT * FROM openmed_advisory.analyses WHERE user_id=$1 AND patient_id=$2 ORDER BY created_at DESC LIMIT 30', [req.user.id, patient]);
    res.json({ data: rows });
  }));
  router.patch('/analyses/:id', route(async (req, res) => {
    const id = validate(uuid, req.params.id);
    const value = validate(Joi.object({ review_status: Joi.string().valid('reviewed','dismissed').required(),
      review_note: Joi.string().max(2000).allow('').default('') }).unknown(false), req.body);
    const { rows } = await query(`UPDATE openmed_advisory.analyses a SET review_status=$1,review_note=$2,reviewed_at=now()
      WHERE a.id=$3 AND a.user_id=$4 AND ${grantSql('$4', 'a.patient_id')} RETURNING *`,
    [value.review_status, value.review_note, id, req.user.id]);
    if (!rows[0]) throw failure('Analysis not found', 404);
    res.json(rows[0]);
  }));
  // Versioned human review: accept, reject, or correct individual context fields.
  // The stored model/rule output is never modified; each review is a new version.
  async function ownAnalysis(req) {
    const id = validate(uuid, req.params.id);
    const { rows } = await query(`SELECT a.id, a.result, a.input_text FROM openmed_advisory.analyses a
      WHERE a.id=$1 AND a.user_id=$2 AND ${grantSql('$2', 'a.patient_id')}`, [id, req.user.id]);
    if (!rows[0]) throw failure('Analysis not found', 404);
    return rows[0];
  }
  router.get('/analyses/:id/reviews', route(async (req, res) => {
    const analysis = await ownAnalysis(req);
    const { rows } = await query(`SELECT id,analysis_id,version,reviewer_id,decision,corrections,note,engine_version,created_at
      FROM openmed_advisory.analysis_reviews WHERE analysis_id=$1 ORDER BY version`, [analysis.id]);
    res.json({ data: rows });
  }));
  router.post('/analyses/:id/reviews', route(async (req, res) => {
    const analysis = await ownAnalysis(req);
    const value = validate(reviewInput, req.body);
    const entityCount = analysis.result?.context?.entities?.length ?? 0;
    if (value.corrections.some(c => c.entity_index >= entityCount)) throw failure('Correction refers to an unknown entity', 400);
    try {
      const { rows } = await query(`WITH ins AS (
          INSERT INTO openmed_advisory.analysis_reviews (id,analysis_id,version,reviewer_id,decision,corrections,note,engine_version)
          SELECT $1,$2,COALESCE((SELECT max(version) FROM openmed_advisory.analysis_reviews WHERE analysis_id=$2),0)+1,
            $3,$4,$5::jsonb,$6,$7
          RETURNING *),
        upd AS (UPDATE openmed_advisory.analyses SET review_status=$8, review_note=$6, reviewed_at=now()
          WHERE id=(SELECT analysis_id FROM ins) RETURNING id)
        SELECT ins.* FROM ins`,
      [randomUUID(), analysis.id, req.user.id, value.decision, JSON.stringify(value.corrections), value.note,
        analysis.result?.context?.engine?.version ?? null, value.decision === 'rejected' ? 'dismissed' : 'reviewed']);
      res.status(201).json(rows[0]);
    } catch (error) {
      if (error.code === '23505') throw failure('Another review was saved at the same time; reload and try again', 409);
      throw error;
    }
  }));
  // Evidence-backed summary (extractive): patient facts from this analysis only, approved
  // reference passages quoted verbatim, no inference. Each generation is a stored version.
  router.post('/analyses/:id/summaries', route(async (req, res) => {
    const analysis = await ownAnalysis(req);
    const context = analysis.result?.context;
    const terms = context?.status === 'ok' ? queryTerms(patientFacts(context, analysis.input_text)) : [];
    const retrieval = await retrieveForTerms(query, terms);
    const content = buildSummary({ context, text: analysis.input_text, retrieval });
    const corpus = await corpusSnapshot(query);
    try {
      const { rows } = await query(`INSERT INTO openmed_advisory.summaries (id,analysis_id,version,created_by,content,corpus)
        SELECT $1,$2,COALESCE((SELECT max(version) FROM openmed_advisory.summaries WHERE analysis_id=$2),0)+1,$3,$4::jsonb,$5::jsonb
        RETURNING *`, [randomUUID(), analysis.id, req.user.id, JSON.stringify(content), JSON.stringify(corpus)]);
      res.status(201).json(rows[0]);
    } catch (error) {
      if (error.code === '23505') throw failure('Another summary was saved at the same time; reload and try again', 409);
      throw error;
    }
  }));
  router.get('/analyses/:id/summaries', route(async (req, res) => {
    const analysis = await ownAnalysis(req);
    const { rows } = await query(`SELECT s.*, COALESCE((SELECT jsonb_agg(r ORDER BY r.created_at) FROM openmed_advisory.summary_reviews r
        WHERE r.summary_id = s.id), '[]'::jsonb) AS reviews
      FROM openmed_advisory.summaries s WHERE s.analysis_id=$1 ORDER BY s.version DESC LIMIT 20`, [analysis.id]);
    res.json({ data: rows });
  }));
  router.post('/summaries/:id/reviews', route(async (req, res) => {
    const id = validate(uuid, req.params.id);
    const value = validate(Joi.object({ decision: Joi.string().valid('accepted', 'rejected').required(),
      note: Joi.string().max(2000).allow('').default('') }).unknown(false), req.body);
    const { rows } = await query(`INSERT INTO openmed_advisory.summary_reviews (id,summary_id,reviewer_id,decision,note)
      SELECT $1, s.id, $3, $4, $5 FROM openmed_advisory.summaries s JOIN openmed_advisory.analyses a ON a.id = s.analysis_id
      WHERE s.id = $2 AND a.user_id = $3 AND ${grantSql('$3', 'a.patient_id')} RETURNING *`,
    [randomUUID(), id, req.user.id, value.decision, value.note]);
    if (!rows[0]) throw failure('Summary not found', 404);
    res.status(201).json(rows[0]);
  }));
  return router;
}

export default createAdvisoryRouter();
