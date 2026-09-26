import express from 'express';
import Joi from 'joi';
import { query } from '../db.js';

// Administration of patient access grants for the clinical AI module (migration 071).
// Admin-only (middleware/requireRole.js ADMIN_ONLY_OPERATIONS). Grants are never deleted:
// revoking keeps the row with who revoked it and why.

const router = express.Router();

const grantInput = Joi.object({
  user_id: Joi.number().integer().positive().required(),
  patient_id: Joi.string().guid().required(),
  reason: Joi.string().trim().min(3).max(500).required(),
  expires_at: Joi.date().iso().greater('now').allow(null).default(null)
}).unknown(false);
const revokeInput = Joi.object({ reason: Joi.string().trim().min(3).max(500).required() }).unknown(false);
const listInput = Joi.object({
  user_id: Joi.number().integer().positive(),
  patient_id: Joi.string().guid(),
  active: Joi.boolean().default(true)
}).unknown(false);

const COLUMNS = 'id, user_id, patient_id, reason, granted_by, granted_at, expires_at, revoked_at, revoked_by, revoke_reason';

function invalid(res, error) {
  return res.status(400).json({ error: 'Invalid request', details: error.details.map(d => d.message) });
}

router.get('/', async (req, res) => {
  const { error, value } = listInput.validate(req.query);
  if (error) return invalid(res, error);
  const where = [], params = [];
  if (value.user_id) { params.push(value.user_id); where.push(`user_id = $${params.length}`); }
  if (value.patient_id) { params.push(value.patient_id); where.push(`patient_id = $${params.length}`); }
  if (value.active) where.push('revoked_at IS NULL AND (expires_at IS NULL OR expires_at > now())');
  try {
    const { rows } = await query(`SELECT ${COLUMNS} FROM clinical_ai_patient_access
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY granted_at DESC LIMIT 500`, params);
    res.json({ data: rows });
  } catch {
    res.status(503).json({ error: 'Access grants are unavailable; run migrations (071)' });
  }
});

router.post('/', async (req, res) => {
  const { error, value } = grantInput.validate(req.body);
  if (error) return invalid(res, error);
  try {
    const { rows } = await query(`INSERT INTO clinical_ai_patient_access (user_id, patient_id, reason, granted_by, expires_at)
      VALUES ($1, $2, $3, $4, $5) RETURNING ${COLUMNS}`,
    [value.user_id, value.patient_id, value.reason, req.user.id, value.expires_at]);
    res.status(201).json(rows[0]);
  } catch (e) {
    if (e.code === '23503') return res.status(400).json({ error: 'Unknown user or patient' });
    res.status(503).json({ error: 'Access grants are unavailable; run migrations (071)' });
  }
});

router.post('/:id/revoke', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id < 1) return res.status(400).json({ error: 'Invalid grant id' });
  const { error, value } = revokeInput.validate(req.body);
  if (error) return invalid(res, error);
  try {
    const { rows } = await query(`UPDATE clinical_ai_patient_access
      SET revoked_at = now(), revoked_by = $2, revoke_reason = $3
      WHERE id = $1 AND revoked_at IS NULL RETURNING ${COLUMNS}`, [id, req.user.id, value.reason]);
    if (!rows[0]) return res.status(404).json({ error: 'Active grant not found' });
    res.json(rows[0]);
  } catch {
    res.status(503).json({ error: 'Access grants are unavailable; run migrations (071)' });
  }
});

export default router;
