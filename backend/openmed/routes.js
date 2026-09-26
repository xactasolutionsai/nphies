import express from 'express';
import Joi from 'joi';
import { randomUUID } from 'node:crypto';
import { advisoryQuery } from './database.js';
import { runLocalAnalysis, runtimeReady, runtimeStatus as poolStatus } from './inference.js';
import { buildFingerprint } from './fingerprint.js';
import { pilotEligibility, PILOT_REASONS } from './pilot.js';
import { generateDraft } from '../clinical-evidence/generator.js';
import { createLlmClient } from '../services/ai/llmClient.js';
import { inspectPassage } from '../clinical-evidence/ingestion.js';
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

/**
 * Shared per-user limit for model runs, counted in the database so that several server
 * instances enforce one limit: analyses and generation attempts of the last minute, plus
 * the runs this instance has in flight. Returns the seconds to wait (0 = allowed).
 */
export function createDbRateLimiter({ query, perMinute = 20 }) {
  const inFlight = new Map();
  const limiter = async userId => {
    const { rows } = await query(`SELECT count(*)::int AS n, min(created_at) AS oldest FROM (
        SELECT created_at FROM openmed_advisory.analyses WHERE user_id = $1 AND created_at > now() - interval '1 minute'
        UNION ALL
        SELECT created_at FROM openmed_advisory.generation_attempts WHERE user_id = $1 AND created_at > now() - interval '1 minute'
      ) recent`, [userId]);
    const used = rows[0].n + (inFlight.get(userId) || 0);
    if (used < perMinute) return 0;
    const oldest = rows[0].oldest ? new Date(rows[0].oldest).getTime() : Date.now();
    return Math.max(1, Math.ceil((oldest + 60000 - Date.now()) / 1000));
  };
  limiter.begin = userId => inFlight.set(userId, (inFlight.get(userId) || 0) + 1);
  limiter.end = userId => inFlight.set(userId, Math.max(0, (inFlight.get(userId) || 1) - 1));
  return limiter;
}

/** Per-user token bucket for model runs, in this process only (OPENMED_RATE_LIMIT_STORE=memory). */
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
  // Model runs need an approved pilot (migration 074). 'false' is for non-clinical test setups only.
  requirePilot = process.env.CLINICAL_AI_REQUIRE_PILOT !== 'false',
  rateLimit = process.env.OPENMED_RATE_LIMIT_STORE === 'memory'
    ? createRateLimiter({ perMinute: Number(process.env.OPENMED_RATE_PER_MINUTE) || 20 })
    : createDbRateLimiter({ query, perMinute: Number(process.env.OPENMED_RATE_PER_MINUTE) || 20 }),
  // Generated drafts: off unless CLINICAL_AI_GENERATION=on AND the pilot approves 'generation'.
  generationEnabled = process.env.CLINICAL_AI_GENERATION === 'on',
  llm = createLlmClient({ audit: async () => null }) } = {}) {
  const router = express.Router();
  const inFlight = new Map();          // `${user}:${idempotency key}` -> promise of the stored row
  const route = fn => async (req, res) => {
    try { await fn(req, res); }
    catch (error) {
      res.status(error.status || 503).json({ error: error.status ? error.message : 'OpenMed database is unavailable or not migrated',
        ...(error.reason ? { reason: error.reason } : {}) });
    }
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
  // Returns the pilot the run belongs to (null when pilots are not enforced) or refuses with 403.
  async function requirePilotEligibility(userId, feature = 'analysis') {
    if (!requirePilot) return null;
    const result = await pilotEligibility(query, userId, fingerprint().sha256, feature);
    if (!result.eligible) throw Object.assign(failure(PILOT_REASONS[result.reason], 403), { reason: result.reason });
    return result.pilot;
  }
  async function requirePatientAccess(userId, patientId) {
    const { rows } = await query(`SELECT ${grantSql('$1', '$2')} AS allowed`, [userId, patientId]);
    if (rows[0]?.allowed !== true) throw failure('No active clinical AI access to this patient', 403);
  }
  router.get('/status', route(async (req, res) => {
    await query('SELECT id FROM openmed_advisory.analyses LIMIT 0');
    await query('SELECT analysis_id FROM openmed_advisory.analysis_reviews LIMIT 0');
    res.json({ database: 'connected', runtime_ready: ready(), advisory_only: true, language: 'en', sdk_version: '2.3.0',
      context_engine: { name: ENGINE.name, version: ENGINE.version, languages: ENGINE.languages },
      patient_access: 'explicit_grant', runtime: runtimeStatus(), build: fingerprint(),
      pilot: requirePilot ? await pilotEligibility(query, req.user.id, fingerprint().sha256) : { enforced: false },
      generation: { enabled_on_server: generationEnabled,
        approved_for_user: requirePilot ? (await pilotEligibility(query, req.user.id, fingerprint().sha256, 'generation')).eligible : generationEnabled } });
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

    const pilot = await requirePilotEligibility(req.user.id);
    const retryAfter = await rateLimit(req.user.id);
    if (retryAfter > 0) {
      res.set('Retry-After', String(retryAfter));
      throw failure('Too many analyses; try again shortly', 429);
    }

    // A client that disconnects cancels its queued analysis instead of occupying a worker.
    const controller = new AbortController();
    res.on('close', () => { if (!res.writableFinished) controller.abort(); });
    rateLimit.begin?.(req.user.id);
    const run = (async () => {
      const analysis = await analyze(value.text, value.mode, { signal: controller.signal });
      // Context (negation, family history, medication status...) is computed before anything is
      // stored, so entities are never saved or shown without it. A context failure is stored as such.
      const result = { ...analysis, context: contextForOpenMed(value.text, analysis, value.mode) };
      try {
        const { rows } = await query(`INSERT INTO openmed_advisory.analyses
          (id,user_id,patient_id,source_type,source_id,mode,input_text,result,idempotency_key,pilot_id)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10) RETURNING *`,
        [randomUUID(), req.user.id, value.patient_id, value.source_type, value.source_id, value.mode, value.text,
          JSON.stringify(result), key, pilot?.id ?? null]);
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
      rateLimit.end?.(req.user.id);
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
    await requirePilotEligibility(req.user.id, 'summary');
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
  // Generated drafts: the model writes from this summary's facts and approved passages only;
  // every sentence must pass the verifier or nothing is shown. Drafts always need review.
  async function ownSummary(req) {
    const id = validate(uuid, req.params.id);
    const { rows } = await query(`SELECT s.id, s.content, s.analysis_id FROM openmed_advisory.summaries s
      JOIN openmed_advisory.analyses a ON a.id = s.analysis_id
      WHERE s.id=$1 AND a.user_id=$2 AND ${grantSql('$2', 'a.patient_id')}`, [id, req.user.id]);
    if (!rows[0]) throw failure('Summary not found', 404);
    return rows[0];
  }
  router.post('/summaries/:id/drafts', route(async (req, res) => {
    const summary = await ownSummary(req);
    if (!generationEnabled) throw Object.assign(failure(PILOT_REASONS.generation_disabled, 409), { reason: 'generation_disabled' });
    const pilot = await requirePilotEligibility(req.user.id, 'generation');
    const retryAfter = await rateLimit(req.user.id);
    if (retryAfter > 0) {
      res.set('Retry-After', String(retryAfter));
      throw failure('Too many model runs; try again shortly', 429);
    }
    rateLimit.begin?.(req.user.id);
    let outcome;
    try { outcome = await generateDraft({ summary, llm, userId: req.user.id }); }
    finally { rateLimit.end?.(req.user.id); }
    const attemptId = randomUUID();
    await query(`INSERT INTO openmed_advisory.generation_attempts (id, summary_id, user_id, pilot_id, model, prompt_sha256,
        input_fact_ids, input_passage_ids, raw_output, verification, accepted, reason, latency_ms)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10::jsonb,$11,$12,$13)`,
    [attemptId, summary.id, req.user.id, pilot?.id ?? null, outcome.model ?? null, outcome.promptSha256 ?? 'none',
      outcome.factIds ?? [], outcome.passageIds ?? [], outcome.raw ? JSON.stringify(outcome.raw) : null,
      outcome.verification ? JSON.stringify(outcome.verification) : null, outcome.accepted, outcome.reason, outcome.latencyMs ?? null]);
    let draft = null;
    if (outcome.accepted) {
      draft = (await query(`INSERT INTO openmed_advisory.generated_drafts (id, attempt_id, summary_id, sentences)
        VALUES ($1,$2,$3,$4::jsonb) RETURNING *`, [randomUUID(), attemptId, summary.id, JSON.stringify(outcome.raw.sentences)])).rows[0];
    }
    res.status(201).json({ attempt: { id: attemptId, accepted: outcome.accepted, reason: outcome.reason,
      problems: outcome.verification?.sentences?.filter(x => x.problems.length) ?? [] }, draft });
  }));
  router.get('/summaries/:id/drafts', route(async (req, res) => {
    const summary = await ownSummary(req);
    const { rows } = await query(`SELECT d.*, COALESCE((SELECT jsonb_agg(r ORDER BY r.created_at) FROM openmed_advisory.draft_reviews r
        WHERE r.draft_id = d.id), '[]'::jsonb) AS reviews
      FROM openmed_advisory.generated_drafts d WHERE d.summary_id = $1 ORDER BY d.created_at DESC LIMIT 20`, [summary.id]);
    const attempts = (await query(`SELECT count(*)::int AS total, count(*) FILTER (WHERE accepted)::int AS accepted
      FROM openmed_advisory.generation_attempts WHERE summary_id = $1`, [summary.id])).rows[0];
    res.json({ data: rows, attempts });
  }));
  router.post('/drafts/:id/reviews', route(async (req, res) => {
    const id = validate(uuid, req.params.id);
    const value = validate(Joi.object({ decision: Joi.string().valid('accepted', 'edited', 'rejected').required(),
      edited_text: Joi.when('decision', { is: 'edited', then: Joi.string().trim().min(1).max(8000).required(), otherwise: Joi.forbidden() }),
      note: Joi.string().max(2000).allow('').default('') }).unknown(false), req.body);
    const { rows } = await query(`INSERT INTO openmed_advisory.draft_reviews (id, draft_id, reviewer_id, decision, edited_text, note)
      SELECT $1, d.id, $3, $4, $5, $6 FROM openmed_advisory.generated_drafts d
        JOIN openmed_advisory.summaries s ON s.id = d.summary_id JOIN openmed_advisory.analyses a ON a.id = s.analysis_id
      WHERE d.id = $2 AND a.user_id = $3 AND ${grantSql('$3', 'a.patient_id')} RETURNING *`,
    [randomUUID(), id, req.user.id, value.decision, value.edited_text ?? null, value.note]);
    if (!rows[0]) throw failure('Draft not found', 404);
    res.status(201).json(rows[0]);
  }));

  // Error reports during the pilot. Allowed even while the pilot is paused. A serious report
  // pauses the assistant for the whole pilot until it is resolved.
  const issueInput = Joi.object({
    analysis_id: Joi.string().guid().allow(null).default(null),
    summary_id: Joi.string().guid().allow(null).default(null),
    category: Joi.string().valid('wrong_assertion', 'wrong_experiencer', 'wrong_temporality', 'wrong_medication_status',
      'missed_entity', 'wrong_entity', 'wrong_medication_detail', 'wrong_reference', 'unsupported_statement',
      'access_or_privacy', 'performance', 'other').required(),
    severity: Joi.string().valid('minor', 'moderate', 'serious').required(),
    entity_index: Joi.number().integer().min(0).allow(null).default(null),
    description: Joi.string().trim().max(2000).allow('').default('')
  }).unknown(false);
  router.post('/issues', route(async (req, res) => {
    const value = validate(issueInput, req.body);
    if (inspectPassage(value.description).phi.length) {
      throw failure('Remove patient identifiers (ID, phone, e-mail, file number) from the description', 422);
    }
    let analysisId = value.analysis_id, pilotId = null;
    if (value.summary_id) {
      const { rows } = await query(`SELECT s.analysis_id FROM openmed_advisory.summaries s
        JOIN openmed_advisory.analyses a ON a.id = s.analysis_id
        WHERE s.id=$1 AND a.user_id=$2 AND ${grantSql('$2', 'a.patient_id')}`, [value.summary_id, req.user.id]);
      if (!rows[0] || (analysisId && rows[0].analysis_id !== analysisId)) throw failure('Summary not found', 404);
      analysisId = rows[0].analysis_id;
    }
    if (analysisId) {
      const { rows } = await query(`SELECT a.pilot_id FROM openmed_advisory.analyses a
        WHERE a.id=$1 AND a.user_id=$2 AND ${grantSql('$2', 'a.patient_id')}`, [analysisId, req.user.id]);
      if (!rows[0]) throw failure('Analysis not found', 404);
      pilotId = rows[0].pilot_id;
    } else if (!['performance', 'access_or_privacy', 'other'].includes(value.category)) {
      throw failure('This category needs the analysis or summary it concerns', 400);
    }
    if (!pilotId && requirePilot) pilotId = (await pilotEligibility(query, req.user.id, fingerprint().sha256)).pilot?.id ?? null;
    const { rows } = await query(`INSERT INTO clinical_pilot.issue_reports
      (id, pilot_id, analysis_id, summary_id, reporter_id, category, severity, entity_index, description, build_sha256)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id, pilot_id, category, severity, status, created_at`,
    [randomUUID(), pilotId, analysisId, value.summary_id, req.user.id, value.category, value.severity,
      value.entity_index, value.description, fingerprint().sha256]);
    res.status(201).json({ ...rows[0], pauses_pilot: value.severity === 'serious' && Boolean(pilotId) });
  }));
  router.get('/issues', route(async (req, res) => {
    const { rows } = await query(`SELECT id, pilot_id, analysis_id, summary_id, category, severity, status, triage_note,
      created_at, updated_at FROM clinical_pilot.issue_reports WHERE reporter_id=$1 ORDER BY created_at DESC LIMIT 100`, [req.user.id]);
    res.json({ data: rows });
  }));
  return router;
}

export default createAdvisoryRouter();
