/**
 * Operating alerts for the clinical assistant. Rules read aggregates only (counts, rates,
 * dates) and store an alert row for administrators; nothing leaves the server and no note
 * text is read. An open alert for the same rule and pilot is not repeated within an hour.
 *
 * Thresholds are starting defaults, not validated limits: the hospital sets its own
 * (CLINICAL_AI_ALERT_THRESHOLDS as JSON overrides these keys).
 */
export const DEFAULT_THRESHOLDS = Object.freeze({
  worker_error_rate: { warning: 0.05, critical: 0.2, min_n: 20 },
  queue_rejections: { warning: 1 },
  context_failure_rate: { warning: 0.05, min_n: 20, window_minutes: 60 },
  correction_rate: { warning: 0.3, min_n: 20, window_minutes: 7 * 24 * 60 },
  generation_rejection_rate: { warning: 0.5, min_n: 10, window_minutes: 24 * 60 },
  open_serious_issues: { critical: 1 },
  pilot_ending_days: { warning: 3 }
});

export function thresholds(env = process.env) {
  try { return { ...DEFAULT_THRESHOLDS, ...(env.CLINICAL_AI_ALERT_THRESHOLDS ? JSON.parse(env.CLINICAL_AI_ALERT_THRESHOLDS) : {}) }; }
  catch { return DEFAULT_THRESHOLDS; }
}

const rate = (a, b) => (b ? a / b : 0);

/** Pure rule evaluation over collected aggregates; returns alert candidates. */
export function alertCandidates({ runtime, pilots }, t = DEFAULT_THRESHOLDS) {
  const out = [];
  const s = runtime?.stats;
  if (s) {
    const bad = (s.timeouts || 0) + (s.crashes || 0) + (s.failed || 0);
    const n = bad + (s.completed || 0);
    const r = rate(bad, n);
    if (n >= t.worker_error_rate.min_n && r >= t.worker_error_rate.warning) {
      out.push({ pilot_id: null, rule: 'worker_error_rate', level: r >= t.worker_error_rate.critical ? 'critical' : 'warning',
        observed: r, threshold: t.worker_error_rate.warning, details: { n, bad } });
    }
    const rejected = (s.rejected_queue_full || 0) + (s.rejected_queue_wait || 0);
    if (rejected >= t.queue_rejections.warning) {
      out.push({ pilot_id: null, rule: 'queue_rejections', level: 'warning', observed: rejected, threshold: t.queue_rejections.warning, details: {} });
    }
  }
  for (const p of pilots) {
    const add = (rule, level, observed, threshold, window, details = {}) =>
      out.push({ pilot_id: p.id, rule, level, observed, threshold, window_minutes: window ?? null, details });
    if (p.open_serious >= t.open_serious_issues.critical) add('open_serious_issues', 'critical', p.open_serious, t.open_serious_issues.critical);
    if (p.analyses_recent >= t.context_failure_rate.min_n && rate(p.context_failed_recent, p.analyses_recent) >= t.context_failure_rate.warning) {
      add('context_failure_rate', 'warning', rate(p.context_failed_recent, p.analyses_recent), t.context_failure_rate.warning,
        t.context_failure_rate.window_minutes, { n: p.analyses_recent });
    }
    if (p.reviews_recent >= t.correction_rate.min_n && rate(p.not_accepted_recent, p.reviews_recent) >= t.correction_rate.warning) {
      add('correction_rate', 'warning', rate(p.not_accepted_recent, p.reviews_recent), t.correction_rate.warning,
        t.correction_rate.window_minutes, { n: p.reviews_recent });
    }
    if (p.generation_recent >= t.generation_rejection_rate.min_n && rate(p.generation_rejected_recent, p.generation_recent) >= t.generation_rejection_rate.warning) {
      add('generation_rejection_rate', 'warning', rate(p.generation_rejected_recent, p.generation_recent),
        t.generation_rejection_rate.warning, t.generation_rejection_rate.window_minutes, { n: p.generation_recent });
    }
    if (p.days_left !== null && p.days_left <= t.pilot_ending_days.warning) add('pilot_ending', 'warning', p.days_left, t.pilot_ending_days.warning);
  }
  return out;
}

/** Collect aggregates, evaluate, and store new alerts. Returns the stored rows. */
export async function evaluateAlerts({ query, runtime, env = process.env }) {
  const t = thresholds(env);
  const { rows: pilots } = await query(`SELECT p.id, (p.ends_on - current_date) AS days_left,
      (SELECT count(*)::int FROM clinical_pilot.issue_reports r WHERE r.pilot_id = p.id AND r.severity = 'serious'
        AND r.status IN ('open','triaged')) AS open_serious,
      (SELECT count(*)::int FROM openmed_advisory.analyses a WHERE a.pilot_id = p.id
        AND a.created_at > now() - make_interval(mins => $1)) AS analyses_recent,
      (SELECT count(*)::int FROM openmed_advisory.analyses a WHERE a.pilot_id = p.id AND a.result->'context'->>'status' = 'failed'
        AND a.created_at > now() - make_interval(mins => $1)) AS context_failed_recent,
      (SELECT count(*)::int FROM openmed_advisory.analysis_reviews r JOIN openmed_advisory.analyses a ON a.id = r.analysis_id
        WHERE a.pilot_id = p.id AND r.created_at > now() - make_interval(mins => $2)) AS reviews_recent,
      (SELECT count(*)::int FROM openmed_advisory.analysis_reviews r JOIN openmed_advisory.analyses a ON a.id = r.analysis_id
        WHERE a.pilot_id = p.id AND r.decision <> 'accepted' AND r.created_at > now() - make_interval(mins => $2)) AS not_accepted_recent,
      (SELECT count(*)::int FROM openmed_advisory.generation_attempts g WHERE g.pilot_id = p.id
        AND g.created_at > now() - make_interval(mins => $3)) AS generation_recent,
      (SELECT count(*)::int FROM openmed_advisory.generation_attempts g WHERE g.pilot_id = p.id AND NOT g.accepted
        AND g.created_at > now() - make_interval(mins => $3)) AS generation_rejected_recent
    FROM clinical_pilot.pilots p WHERE p.status IN ('active', 'paused')`,
  [t.context_failure_rate.window_minutes, t.correction_rate.window_minutes, t.generation_rejection_rate.window_minutes]);
  const created = [];
  for (const c of alertCandidates({ runtime, pilots }, t)) {
    const { rows } = await query(`INSERT INTO clinical_pilot.alerts (pilot_id, rule, level, observed, threshold, window_minutes, details)
      SELECT $1, $2, $3, $4, $5, $6, $7::jsonb
      WHERE NOT EXISTS (SELECT 1 FROM clinical_pilot.alerts x WHERE x.rule = $2 AND x.pilot_id IS NOT DISTINCT FROM $1
        AND x.acknowledged_at IS NULL AND x.created_at > now() - interval '1 hour') RETURNING *`,
    [c.pilot_id, c.rule, c.level, c.observed, c.threshold, c.window_minutes ?? null, JSON.stringify(c.details || {})]);
    if (rows[0]) created.push(rows[0]);
  }
  if (created.length) console.warn(`[clinical-ai] ${created.length} alert(s): ${created.map(a => `${a.level}:${a.rule}`).join(', ')}`);
  return created;
}
