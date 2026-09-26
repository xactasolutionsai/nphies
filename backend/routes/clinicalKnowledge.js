import express from 'express';
import Joi from 'joi';
import { createHash, randomUUID } from 'node:crypto';
import { query, transaction } from '../db.js';
import { inspectPassage, approvalProblems } from '../clinical-evidence/ingestion.js';

// Registry of reference sources for the clinical assistant (migration 072). Admin-only
// (middleware/requireRole.js). A source is used for retrieval only after approval, which
// needs licence, usage rights, version, dates, scope, a committee reference and a precedence
// rank. Approved passages are frozen by the database; a new edition is a new source.

const router = express.Router();
const uuid = Joi.string().guid().required();
const date = Joi.date().iso().raw().allow(null);
const text = max => Joi.string().trim().max(max).allow(null, '');
const sourceFields = {
  title: Joi.string().trim().min(2).max(300),
  publisher: Joi.string().trim().min(2).max(300),
  language: Joi.string().valid('en', 'ar'),
  license: text(500), usage_rights: text(500), version: text(100), scope: text(1000),
  published_on: date, reviewed_on: date, next_review_due: date,
  supersedes_source_id: Joi.string().guid().allow(null)
};
const createSource = Joi.object({ ...sourceFields,
  title: sourceFields.title.required(), publisher: sourceFields.publisher.required(),
  language: sourceFields.language.default('en') }).unknown(false);
const updateSource = Joi.object(sourceFields).min(1).unknown(false);
const passageInput = Joi.object({ section: text(300), locator: text(100),
  text: Joi.string().trim().min(20).max(4000).required() }).unknown(false);
const approveInput = Joi.object({ approval_reference: Joi.string().trim().min(2).max(300).required(),
  precedence_rank: Joi.number().integer().min(1).max(1000).required() }).unknown(false);
const reasonInput = Joi.object({ reason: Joi.string().trim().min(3).max(500).required() }).unknown(false);

const fail = (status, error, extra = {}) => Object.assign(new Error(error), { status, extra });
const check = (schema, value) => {
  const result = schema.validate(value);
  if (result.error) throw fail(400, 'Invalid request', { details: result.error.details.map(d => d.message) });
  return result.value;
};
const blank = v => (v === '' ? null : v);

const handle = fn => async (req, res) => {
  try { await fn(req, res); }
  catch (error) {
    if (error.status) return res.status(error.status).json({ error: error.message, ...error.extra });
    if (error.code === 'P0001') return res.status(409).json({ error: 'Passages of an approved or retired source cannot be changed' });
    if (error.code === '23505') return res.status(409).json({ error: 'This passage already exists in the source' });
    if (error.code === '23503') return res.status(400).json({ error: 'Referenced source or user does not exist' });
    res.status(503).json({ error: 'Knowledge registry unavailable; run migrations (072)' });
  }
};

async function draftSource(client, id) {
  const { rows } = await client.query('SELECT * FROM clinical_knowledge.sources WHERE id = $1 FOR UPDATE', [id]);
  if (!rows[0]) throw fail(404, 'Source not found');
  if (rows[0].status !== 'draft') throw fail(409, `Source is ${rows[0].status}; only drafts can change`);
  return rows[0];
}

router.get('/sources', handle(async (req, res) => {
  const { rows } = await query(`SELECT s.*, (SELECT count(*)::int FROM clinical_knowledge.passages p WHERE p.source_id = s.id) AS passage_count
    FROM clinical_knowledge.sources s ORDER BY s.status, s.precedence_rank NULLS LAST, s.created_at DESC LIMIT 500`);
  res.json({ data: rows });
}));

router.get('/sources/:id', handle(async (req, res) => {
  const id = check(uuid, req.params.id);
  const source = (await query('SELECT * FROM clinical_knowledge.sources WHERE id = $1', [id])).rows[0];
  if (!source) throw fail(404, 'Source not found');
  const passages = (await query(`SELECT id, section, locator, text, injection_flags, injection_reviewed, created_at
    FROM clinical_knowledge.passages WHERE source_id = $1 ORDER BY created_at`, [id])).rows;
  res.json({ ...source, passages, approval_problems: source.status === 'draft' ? approvalProblems(source, passages) : [] });
}));

router.post('/sources', handle(async (req, res) => {
  const v = check(createSource, req.body);
  const { rows } = await query(`INSERT INTO clinical_knowledge.sources (id, title, publisher, language, license, usage_rights,
      version, scope, published_on, reviewed_on, next_review_due, supersedes_source_id, created_by)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
  [randomUUID(), v.title, v.publisher, v.language, blank(v.license), blank(v.usage_rights), blank(v.version),
    blank(v.scope), v.published_on ?? null, v.reviewed_on ?? null, v.next_review_due ?? null,
    v.supersedes_source_id ?? null, req.user.id]);
  res.status(201).json(rows[0]);
}));

router.patch('/sources/:id', handle(async (req, res) => {
  const id = check(uuid, req.params.id);
  const v = check(updateSource, req.body);
  const row = await transaction(async client => {
    await draftSource(client, id);
    const fields = Object.keys(v);
    const { rows } = await client.query(`UPDATE clinical_knowledge.sources SET ${fields.map((f, i) => `${f} = $${i + 2}`).join(', ')}
      WHERE id = $1 RETURNING *`, [id, ...fields.map(f => blank(v[f]))]);
    return rows[0];
  });
  res.json(row);
}));

router.post('/sources/:id/passages', handle(async (req, res) => {
  const id = check(uuid, req.params.id);
  const v = check(passageInput, req.body);
  const inspection = inspectPassage(v.text);
  if (inspection.phi.length) {
    // Reference knowledge must not carry patient data; report kinds and positions only.
    throw fail(422, 'Passage appears to contain patient identifiers; remove them before adding', { phi: inspection.phi });
  }
  const row = await transaction(async client => {
    await draftSource(client, id);
    const { rows } = await client.query(`INSERT INTO clinical_knowledge.passages
        (id, source_id, section, locator, text, content_sha256, injection_flags, created_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id, section, locator, text, injection_flags, injection_reviewed`,
    [randomUUID(), id, blank(v.section), blank(v.locator), v.text, createHash('sha256').update(v.text).digest('hex'),
      inspection.injection, req.user.id]);
    return rows[0];
  });
  res.status(201).json(row);
}));

// The approver confirms that flagged, instruction-like wording is legitimate reference text.
router.post('/sources/:id/passages/:passageId/review-injection', handle(async (req, res) => {
  const id = check(uuid, req.params.id);
  const passageId = check(uuid, req.params.passageId);
  const row = await transaction(async client => {
    await draftSource(client, id);
    const { rows } = await client.query(`UPDATE clinical_knowledge.passages SET injection_reviewed = true, injection_reviewed_by = $3
      WHERE id = $1 AND source_id = $2 RETURNING id, injection_flags, injection_reviewed`, [passageId, id, req.user.id]);
    if (!rows[0]) throw fail(404, 'Passage not found');
    return rows[0];
  });
  res.json(row);
}));

router.post('/sources/:id/approve', handle(async (req, res) => {
  const id = check(uuid, req.params.id);
  const v = check(approveInput, req.body);
  const row = await transaction(async client => {
    const source = await draftSource(client, id);
    const passages = (await client.query('SELECT injection_flags, injection_reviewed FROM clinical_knowledge.passages WHERE source_id = $1', [id])).rows;
    const problems = approvalProblems({ ...source, ...v }, passages);
    if (problems.length) throw fail(422, 'Source cannot be approved yet', { problems });
    const { rows } = await client.query(`UPDATE clinical_knowledge.sources SET status = 'approved', approval_reference = $2,
      precedence_rank = $3, approved_by = $4, approved_at = now() WHERE id = $1 RETURNING *`,
    [id, v.approval_reference, v.precedence_rank, req.user.id]);
    return rows[0];
  });
  res.json(row);
}));

router.post('/sources/:id/retire', handle(async (req, res) => {
  const id = check(uuid, req.params.id);
  const v = check(reasonInput, req.body);
  const { rows } = await query(`UPDATE clinical_knowledge.sources SET status = 'retired', retired_by = $2, retired_at = now(),
    retire_reason = $3 WHERE id = $1 AND status <> 'retired' RETURNING *`, [id, req.user.id, v.reason]);
  if (!rows[0]) throw fail(404, 'Active source not found');
  res.json(rows[0]);
}));

export default router;
