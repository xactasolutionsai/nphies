/**
 * ai_audit_log access (migration 069). Only hashes, sizes, models and PHI-free summaries are
 * stored: callers must redact output_summary with services/ai/phi.js before writing it.
 */
import { query } from '../../db.js';

export async function writeAudit({ feature, userId = null, source = 'llm', model = null, inputHash = null,
  latencyMs = null, available = false, error = null, outputSummary = null }, queryFn = query) {
  const result = await queryFn(`
    INSERT INTO ai_audit_log (feature, user_id, source, model, input_hash, latency_ms, available, error, output_summary)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    RETURNING id
  `, [feature, userId, source, model, inputHash, latencyMs, available, error ? String(error).slice(0, 500) : null,
    outputSummary === null ? null : JSON.stringify(outputSummary)]);
  return result.rows[0]?.id ?? null;
}

/** Latest successful output for the same feature, input hash and model (used as a cache). */
export async function findCachedOutput({ feature, inputHash, model }, queryFn = query) {
  const result = await queryFn(`
    SELECT id, output_summary, created_at FROM ai_audit_log
    WHERE feature = $1 AND input_hash = $2 AND model = $3 AND available = true AND output_summary IS NOT NULL
    ORDER BY created_at DESC, id DESC
    LIMIT 1
  `, [feature, inputHash, model]);
  const row = result.rows[0];
  if (!row) return null;
  const output = typeof row.output_summary === 'string' ? JSON.parse(row.output_summary) : row.output_summary;
  return { auditId: row.id, output, createdAt: row.created_at };
}
