/**
 * Pilot gate for the clinical assistant (migration 074). A model analysis or a summary may
 * run only when the user is a current participant of an active, hospital-approved pilot,
 * today is within its dates, the deployed build is the build that was evaluated, and no
 * serious error report is unresolved. Every refusal carries a reason code, never data.
 */
export const PILOT_REASONS = Object.freeze({
  no_active_pilot: 'The clinical assistant is not enabled for you: no active approved pilot includes your account',
  outside_dates: 'The clinical assistant is not enabled today: outside the approved pilot dates',
  build_not_evaluated: 'The clinical assistant is paused: the deployed version is not the version that was evaluated',
  paused_serious_issue: 'The clinical assistant is paused while a serious error report is reviewed'
});

export async function pilotEligibility(query, userId, buildSha256) {
  const { rows } = await query(`SELECT p.id, p.name, p.scope, p.starts_on, p.ends_on, p.evaluation_build_sha256,
      current_date BETWEEN p.starts_on AND p.ends_on AS in_dates,
      EXISTS (SELECT 1 FROM clinical_pilot.issue_reports r WHERE r.pilot_id = p.id AND r.severity = 'serious'
              AND r.status IN ('open', 'triaged')) AS serious_open
    FROM clinical_pilot.pilots p
    JOIN clinical_pilot.participants m ON m.pilot_id = p.id
    WHERE m.user_id = $1 AND m.removed_at IS NULL AND p.status = 'active'
    ORDER BY p.starts_on DESC, p.id`, [userId]);
  if (!rows.length) return { eligible: false, reason: 'no_active_pilot', pilot: null };
  const describe = r => ({ id: r.id, name: r.name, scope: r.scope, starts_on: r.starts_on, ends_on: r.ends_on });
  const checks = rows.map(r => ({ r, reason: !r.in_dates ? 'outside_dates'
    : r.evaluation_build_sha256 !== buildSha256 ? 'build_not_evaluated'
      : r.serious_open ? 'paused_serious_issue' : null }));
  const ok = checks.find(c => c.reason === null);
  if (ok) return { eligible: true, reason: null, pilot: describe(ok.r) };
  return { eligible: false, reason: checks[0].reason, pilot: describe(checks[0].r) };
}
