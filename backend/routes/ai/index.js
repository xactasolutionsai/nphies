/**
 * Advisory AI API, mounted at /api/ai (after authenticateToken and enforceRoles).
 *
 * GET  /api/ai/health                   Ollama status for the UI (never fails; cached 60 s)
 * POST /api/ai/feedback                 { auditId, verdict: accepted|rejected|edited, comment? } (every role)
 * GET  /api/ai/analytics/rejections     rejection / error codes per insurer (SQL only)
 * GET  /api/ai/analytics/poll-timing    poll and response-time statistics (advisory; scheduler unchanged)
 */
import express from 'express';
import { query } from '../../db.js';
import healthChecker from '../../services/ai/health.js';
import { redactText } from '../../services/ai/phi.js';
import { rejectionAnalytics, pollTimingStats, AnalyticsInputError } from '../../services/ai/analytics.js';

const router = express.Router();

export const FEEDBACK_VERDICTS = Object.freeze(['accepted', 'rejected', 'edited']);
export const FEEDBACK_COMMENT_MAX = 2000;

router.get('/health', async (req, res) => {
  res.json(await healthChecker.check());
});

router.post('/feedback', async (req, res) => {
  const { auditId, verdict, comment } = req.body || {};
  const id = Number(auditId);
  if (!Number.isSafeInteger(id) || id <= 0) return res.status(400).json({ error: 'auditId must be a positive integer' });
  if (!FEEDBACK_VERDICTS.includes(verdict)) return res.status(400).json({ error: `verdict must be one of ${FEEDBACK_VERDICTS.join(', ')}` });
  if (comment !== undefined && comment !== null && (typeof comment !== 'string' || comment.length > FEEDBACK_COMMENT_MAX)) {
    return res.status(400).json({ error: `comment must be text of at most ${FEEDBACK_COMMENT_MAX} characters` });
  }
  try {
    const result = await query(
      'INSERT INTO ai_feedback (audit_id, user_id, verdict, comment) VALUES ($1, $2, $3, $4) RETURNING id, created_at',
      [id, req.user?.id ?? null, verdict, comment ? redactText(comment.trim()) : null]
    );
    res.status(201).json({ id: result.rows[0].id, createdAt: result.rows[0].created_at });
  } catch (error) {
    if (error.code === '23503') return res.status(404).json({ error: 'Unknown AI audit entry' });
    console.error('[AI] Feedback could not be stored:', error.message);
    res.status(500).json({ error: 'Feedback could not be stored' });
  }
});

const analyticsHandler = fn => async (req, res) => {
  try {
    res.json(await fn(req.query || {}));
  } catch (error) {
    if (error instanceof AnalyticsInputError) return res.status(400).json({ error: error.message });
    console.error('[AI] Analytics failed:', error.message);
    res.status(500).json({ error: 'Analytics could not be computed' });
  }
};

router.get('/analytics/rejections', analyticsHandler(params => rejectionAnalytics(params)));
router.get('/analytics/poll-timing', analyticsHandler(params => pollTimingStats(params)));

export default router;
