import express from 'express';
import Joi from 'joi';
import { randomUUID } from 'node:crypto';
import { query, transaction } from '../db.js';
import { buildFingerprint } from '../openmed/fingerprint.js';
import { runtimeStatus } from '../openmed/inference.js';
import { evaluateAlerts } from '../openmed/alerts.js';

// Administration of the clinical assistant pilot (migration 074). Admin-only
// (middleware/requireRole.js). Activation records the hospital's approval and the evaluated
// build; the deployed build must be that build. Metrics are aggregates only: no note text.

const router = express.Router();
const uuid = Joi.string().guid().required();
const day = Joi.date().iso().raw();
const reasonInput = Joi.object({ reason: Joi.string().trim().min(3).max(500).required() }).unknown(false);
const closeInput = Joi.object({ reason: Joi.string().trim().min(3).max(500).required(),
  outcome_ref: Joi.string().trim().min(2).max(300) }).unknown(false);
const pilotFields = {
  name: Joi.string().trim().min(3).max(200), scope: Joi.string().trim().min(3).max(1000),
  starts_on: day, ends_on: day, max_participants: Joi.number().integer().min(1).max(5000),
  kind: Joi.string().valid('pilot', 'rollout'),
  approved_features: Joi.array().items(Joi.string().valid('analysis', 'summary', 'generation')).unique()
    .has(Joi.string().valid('analysis')).min(1),
  prerequisite_pilot_id: Joi.string().guid().allow(null)
};
const createInput = Joi.object({ ...pilotFields, name: pilotFields.name.required(), scope: pilotFields.scope.required() }).unknown(false);
const updateInput = Joi.object(pilotFields).min(1).unknown(false);
const participantInput = Joi.object({ user_id: Joi.number().integer().positive().required(),
  role_label: Joi.string().trim().min(2).max(100).required() }).unknown(false);
const activateInput = Joi.object({
  approval_reference: Joi.string().trim().min(2).max(300).required(),
  approved_by_name: Joi.string().trim().min(2).max(200).required(),
  approved_by_role: Joi.string().trim().min(2).max(200).required(),
  evaluation_report_ref: Joi.string().trim().min(2).max(300).required(),
  evaluation_build_sha256: Joi.string().pattern(/^[0-9a-f]{64}$/).required(),
  criteria_ref: Joi.string().trim().min(2).max(300).required()
}).unknown(false);
const triageInput = Joi.object({
  status: Joi.string().valid('open', 'triaged', 'fixed', 'wont_fix', 'duplicate').required(),
  triage_note: Joi.string().trim().max(2000).allow('').default(''),
  fixed_in_build: Joi.string().pattern(/^[0-9a-f]{64}$/).allow(null).default(null)
}).unknown(false);

const fail = (status, error, extra = {}) => Object.assign(new Error(error), { status, extra });
const check = (schema, value) => {
  const r = schema.validate(value);
  if (r.error) throw fail(400, 'Invalid request', { details: r.error.details.map(d => d.message) });
  return r.value;
};
const handle = fn => async (req, res) => {
  try { await fn(req, res); }
  catch (error) {
    if (error.status) return res.status(error.status).json({ error: error.message, ...error.extra });
    if (error.code === '23503') return res.status(400).json({ error: 'Unknown user' });
    if (error.code === '23514') return res.status(400).json({ error: 'The pilot record is incomplete or inconsistent' });
    res.status(503).json({ error: 'Pilot registry unavailable; run migrations (074)' });
  }
};

async function lockPilot(client, id) {
  const { rows } = await client.query('SELECT * FROM clinical_pilot.pilots WHERE id = $1 FOR UPDATE', [id]);
  if (!rows[0]) throw fail(404, 'Pilot not found');
  return rows[0];
}
const openSerious = async (client, id) => (await client.query(`SELECT count(*)::int AS n FROM clinical_pilot.issue_reports
  WHERE pilot_id = $1 AND severity = 'serious' AND status IN ('open', 'triaged')`, [id])).rows[0].n;

router.get('/build', (req, res) => res.json(buildFingerprint()));

router.get('/pilots', handle(async (req, res) => {
  const { rows } = await query(`SELECT p.*, (SELECT count(*)::int FROM clinical_pilot.participants m
      WHERE m.pilot_id = p.id AND m.removed_at IS NULL) AS participants,
    (SELECT count(*)::int FROM clinical_pilot.issue_reports r WHERE r.pilot_id = p.id AND r.severity = 'serious'
      AND r.status IN ('open', 'triaged')) AS open_serious_issues
    FROM clinical_pilot.pilots p ORDER BY p.created_at DESC LIMIT 100`);
  res.json({ data: rows, deployed_build: buildFingerprint().sha256 });
}));

router.post('/pilots', handle(async (req, res) => {
  const v = check(createInput, req.body);
  const { rows } = await query(`INSERT INTO clinical_pilot.pilots (id, name, scope, starts_on, ends_on, max_participants, created_by,
      kind, approved_features, prerequisite_pilot_id)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
  [randomUUID(), v.name, v.scope, v.starts_on ?? null, v.ends_on ?? null, v.max_participants ?? null, req.user.id,
    v.kind ?? 'pilot', v.approved_features ?? ['analysis', 'summary'], v.prerequisite_pilot_id ?? null]);
  res.status(201).json(rows[0]);
}));

router.patch('/pilots/:id', handle(async (req, res) => {
  const id = check(uuid, req.params.id);
  const v = check(updateInput, req.body);
  const row = await transaction(async client => {
    const pilot = await lockPilot(client, id);
    if (pilot.status !== 'draft') throw fail(409, 'Only a draft pilot can be edited; close it and register a new one');
    const fields = Object.keys(v);
    return (await client.query(`UPDATE clinical_pilot.pilots SET ${fields.map((f, i) => `${f} = $${i + 2}`).join(', ')}
      WHERE id = $1 RETURNING *`, [id, ...fields.map(f => v[f])])).rows[0];
  });
  res.json(row);
}));

router.get('/pilots/:id/participants', handle(async (req, res) => {
  const id = check(uuid, req.params.id);
  const { rows } = await query(`SELECT m.user_id, m.role_label, m.added_at, m.removed_at, u.email
    FROM clinical_pilot.participants m JOIN users u ON u.id = m.user_id WHERE m.pilot_id = $1 ORDER BY m.added_at`, [id]);
  res.json({ data: rows });
}));

router.post('/pilots/:id/participants', handle(async (req, res) => {
  const id = check(uuid, req.params.id);
  const v = check(participantInput, req.body);
  const row = await transaction(async client => {
    const pilot = await lockPilot(client, id);
    if (pilot.status === 'closed') throw fail(409, 'The pilot is closed');
    const count = (await client.query(`SELECT count(*)::int AS n FROM clinical_pilot.participants
      WHERE pilot_id = $1 AND removed_at IS NULL AND user_id <> $2`, [id, v.user_id])).rows[0].n;
    if (pilot.max_participants && count >= pilot.max_participants) throw fail(409, 'The approved number of participants is reached');
    return (await client.query(`INSERT INTO clinical_pilot.participants (pilot_id, user_id, role_label, added_by)
      VALUES ($1,$2,$3,$4) ON CONFLICT (pilot_id, user_id) DO UPDATE SET role_label = EXCLUDED.role_label,
        removed_at = NULL, added_by = EXCLUDED.added_by, added_at = now() RETURNING *`, [id, v.user_id, v.role_label, req.user.id])).rows[0];
  });
  res.status(201).json(row);
}));

router.post('/pilots/:id/participants/:userId/remove', handle(async (req, res) => {
  const id = check(uuid, req.params.id);
  const userId = check(Joi.number().integer().positive().required(), req.params.userId);
  const { rows } = await query(`UPDATE clinical_pilot.participants SET removed_at = now()
    WHERE pilot_id = $1 AND user_id = $2 AND removed_at IS NULL RETURNING *`, [id, userId]);
  if (!rows[0]) throw fail(404, 'Active participant not found');
  res.json(rows[0]);
}));

router.post('/pilots/:id/activate', handle(async (req, res) => {
  const id = check(uuid, req.params.id);
  const v = check(activateInput, req.body);
  const row = await transaction(async client => {
    const pilot = await lockPilot(client, id);
    if (pilot.status !== 'draft') throw fail(409, `The pilot is ${pilot.status}; only a draft can be activated`);
    const problems = [];
    if (!pilot.starts_on || !pilot.ends_on) problems.push('dates');
    if (!pilot.max_participants) problems.push('max_participants');
    const participants = (await client.query(`SELECT count(*)::int AS n FROM clinical_pilot.participants
      WHERE pilot_id = $1 AND removed_at IS NULL`, [id])).rows[0].n;
    if (!participants) problems.push('participants');
    const ended = (await client.query('SELECT $1::date < current_date AS ended', [pilot.ends_on ?? '9999-12-31'])).rows[0].ended;
    if (ended) problems.push('ends_on_in_past');
    if (problems.length) throw fail(422, 'The pilot cannot be activated yet', { problems });
    if (pilot.kind === 'rollout') {
      // Wider use only on top of a pilot that was closed with the hospital's outcome review,
      // and only for features that pilot approved.
      const prior = pilot.prerequisite_pilot_id
        ? (await client.query('SELECT kind, status, outcome_ref, approved_features FROM clinical_pilot.pilots WHERE id = $1', [pilot.prerequisite_pilot_id])).rows[0]
        : null;
      const rollout = [];
      if (!prior) rollout.push('prerequisite_pilot');
      else {
        if (prior.kind !== 'pilot') rollout.push('prerequisite_must_be_a_pilot');
        if (prior.status !== 'closed') rollout.push('prerequisite_pilot_not_closed');
        if (!prior.outcome_ref) rollout.push('prerequisite_pilot_outcome_missing');
        if (pilot.approved_features.some(f => !prior.approved_features.includes(f))) rollout.push('feature_not_piloted');
      }
      if (rollout.length) throw fail(422, 'The rollout cannot be activated yet', { problems: rollout });
    }
    if (v.evaluation_build_sha256 !== buildFingerprint().sha256) {
      throw fail(409, 'The deployed build is not the evaluated build: deploy the evaluated version or evaluate this one',
        { deployed_build: buildFingerprint().sha256 });
    }
    return (await client.query(`UPDATE clinical_pilot.pilots SET status = 'active', approval_reference = $2, approved_by_name = $3,
      approved_by_role = $4, evaluation_report_ref = $5, evaluation_build_sha256 = $6, criteria_ref = $7,
      activated_by = $8, activated_at = now(), status_changed_by = $8, status_changed_at = now(), status_reason = 'activated'
      WHERE id = $1 RETURNING *`, [id, v.approval_reference, v.approved_by_name, v.approved_by_role, v.evaluation_report_ref,
      v.evaluation_build_sha256, v.criteria_ref, req.user.id])).rows[0];
  });
  res.json(row);
}));

for (const [action, from, to] of [['pause', ['active'], 'paused'], ['resume', ['paused'], 'active'], ['close', ['draft', 'active', 'paused'], 'closed']]) {
  router.post(`/pilots/:id/${action}`, handle(async (req, res) => {
    const id = check(uuid, req.params.id);
    const v = check(action === 'close' ? closeInput : reasonInput, req.body);
    const row = await transaction(async client => {
      const pilot = await lockPilot(client, id);
      if (!from.includes(pilot.status)) throw fail(409, `Cannot ${action} a ${pilot.status} pilot`);
      if (action === 'resume' && await openSerious(client, id)) throw fail(409, 'Resolve the open serious error reports first');
      return (await client.query(`UPDATE clinical_pilot.pilots SET status = $2, status_reason = $3, status_changed_by = $4,
        status_changed_at = now(), outcome_ref = COALESCE($5, outcome_ref) WHERE id = $1 RETURNING *`,
      [id, to, v.reason, req.user.id, v.outcome_ref ?? null])).rows[0];
    });
    res.json(row);
  }));
}

router.get('/issues', handle(async (req, res) => {
  const v = check(Joi.object({ pilot_id: Joi.string().guid(), status: Joi.string().valid('open', 'triaged', 'fixed', 'wont_fix', 'duplicate') })
    .unknown(false), req.query);
  const where = [], params = [];
  if (v.pilot_id) { params.push(v.pilot_id); where.push(`pilot_id = $${params.length}`); }
  if (v.status) { params.push(v.status); where.push(`status = $${params.length}`); }
  const { rows } = await query(`SELECT * FROM clinical_pilot.issue_reports ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
    ORDER BY (severity = 'serious' AND status IN ('open','triaged')) DESC, created_at DESC LIMIT 500`, params);
  res.json({ data: rows });
}));

router.patch('/issues/:id', handle(async (req, res) => {
  const id = check(uuid, req.params.id);
  const v = check(triageInput, req.body);
  if (v.status === 'fixed' && !v.fixed_in_build) throw fail(400, 'A fixed report needs the build (fingerprint) that contains the fix');
  const { rows } = await query(`UPDATE clinical_pilot.issue_reports SET status = $2, triage_note = $3, fixed_in_build = $4,
    resolved_by = CASE WHEN $2 IN ('fixed','wont_fix','duplicate') THEN $5::int ELSE NULL END, updated_at = now()
    WHERE id = $1 RETURNING *`, [id, v.status, v.triage_note, v.fixed_in_build, req.user.id]);
  if (!rows[0]) throw fail(404, 'Report not found');
  res.json(rows[0]);
}));

// Operating alerts (aggregates only). Evaluated on demand here, or on a timer when
// CLINICAL_AI_ALERT_INTERVAL_MIN is set (server.js). Stored for administrators; nothing is sent out.
router.post('/alerts/evaluate', handle(async (req, res) => {
  res.json({ created: await evaluateAlerts({ query, runtime: runtimeStatus() }) });
}));
router.get('/alerts', handle(async (req, res) => {
  const open = req.query.open !== 'false';
  const { rows } = await query(`SELECT * FROM clinical_pilot.alerts ${open ? 'WHERE acknowledged_at IS NULL' : ''}
    ORDER BY created_at DESC LIMIT 200`);
  res.json({ data: rows });
}));
router.post('/alerts/:id/ack', handle(async (req, res) => {
  const id = check(Joi.number().integer().positive().required(), req.params.id);
  const { rows } = await query(`UPDATE clinical_pilot.alerts SET acknowledged_by = $2, acknowledged_at = now()
    WHERE id = $1 AND acknowledged_at IS NULL RETURNING *`, [id, req.user.id]);
  if (!rows[0]) throw fail(404, 'Open alert not found');
  res.json(rows[0]);
}));

// Aggregates only (counts and rates); no note text, no patient data.
router.get('/pilots/:id/metrics', handle(async (req, res) => {
  const id = check(uuid, req.params.id);
  const one = async (sql) => (await query(sql, [id])).rows;
  const [analyses] = await one(`SELECT count(*)::int AS total,
      count(*) FILTER (WHERE result->'context'->>'status' = 'failed')::int AS context_failed,
      count(DISTINCT user_id)::int AS users, count(DISTINCT patient_id)::int AS patients
    FROM openmed_advisory.analyses WHERE pilot_id = $1`);
  const reviews = await one(`SELECT r.decision, count(*)::int AS n FROM openmed_advisory.analysis_reviews r
    JOIN openmed_advisory.analyses a ON a.id = r.analysis_id WHERE a.pilot_id = $1 GROUP BY r.decision ORDER BY r.decision`);
  const corrections = await one(`SELECT c->>'field' AS field, count(*)::int AS n FROM openmed_advisory.analysis_reviews r
    JOIN openmed_advisory.analyses a ON a.id = r.analysis_id, jsonb_array_elements(r.corrections) c
    WHERE a.pilot_id = $1 GROUP BY 1 ORDER BY 2 DESC`);
  const [summaries] = await one(`SELECT count(*)::int AS total,
      coalesce(sum(jsonb_array_length(s.content->'abstentions')), 0)::int AS abstentions,
      coalesce(sum(jsonb_array_length(s.content->'reference_knowledge')), 0)::int AS cited_terms
    FROM openmed_advisory.summaries s JOIN openmed_advisory.analyses a ON a.id = s.analysis_id WHERE a.pilot_id = $1`);
  const summaryReviews = await one(`SELECT sr.decision, count(*)::int AS n FROM openmed_advisory.summary_reviews sr
    JOIN openmed_advisory.summaries s ON s.id = sr.summary_id JOIN openmed_advisory.analyses a ON a.id = s.analysis_id
    WHERE a.pilot_id = $1 GROUP BY sr.decision ORDER BY sr.decision`);
  const [generation] = await one(`SELECT count(*)::int AS attempts, count(*) FILTER (WHERE accepted)::int AS accepted,
      count(*) FILTER (WHERE NOT accepted AND reason = 'verification_failed')::int AS rejected_by_verifier
    FROM openmed_advisory.generation_attempts WHERE pilot_id = $1`);
  const draftReviews = await one(`SELECT r.decision, count(*)::int AS n FROM openmed_advisory.draft_reviews r
    JOIN openmed_advisory.generated_drafts d ON d.id = r.draft_id JOIN openmed_advisory.generation_attempts g ON g.id = d.attempt_id
    WHERE g.pilot_id = $1 GROUP BY r.decision ORDER BY r.decision`);
  const issues = await one(`SELECT category, severity, status, count(*)::int AS n FROM clinical_pilot.issue_reports
    WHERE pilot_id = $1 GROUP BY category, severity, status ORDER BY severity, category`);
  const reviewed = reviews.reduce((s, r) => s + r.n, 0);
  res.json({
    analyses, reviews, corrections, summaries, summary_reviews: summaryReviews, generation, draft_reviews: draftReviews, issues,
    rates: {
      review_coverage: analyses.total ? Math.round((reviewed / analyses.total) * 1000) / 1000 : null,
      corrected_or_rejected: reviewed ? Math.round((reviews.filter(r => r.decision !== 'accepted').reduce((s, r) => s + r.n, 0) / reviewed) * 1000) / 1000 : null,
      abstention_share: (summaries.abstentions + summaries.cited_terms)
        ? Math.round((summaries.abstentions / (summaries.abstentions + summaries.cited_terms)) * 1000) / 1000 : null
    },
    runtime: runtimeStatus(),
    note: 'Aggregates from this pilot only. Review decisions are clinician judgements during use, not an evaluation on annotated data.'
  });
}));

export default router;
