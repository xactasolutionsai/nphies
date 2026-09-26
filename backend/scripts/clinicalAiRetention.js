#!/usr/bin/env node
/**
 * Retention for clinical-assistant records, per the hospital's approved policy.
 *
 *   node scripts/clinicalAiRetention.js --days 365                    # dry run: counts only
 *   node scripts/clinicalAiRetention.js --days 365 --apply --policy-ref "DPO-2026-04"
 *
 * After N days the note text and model/rule output of an analysis, its summaries and its
 * generated drafts are replaced by a marker; ids, dates, users, pilot, decisions and review
 * history stay for audit and metrics. Nothing is deleted. Runs in one transaction. Without
 * --apply nothing changes. The retention period is the hospital's decision, not a default.
 */
export const MARKER = '[removed after retention period]';

export async function applyRetention(client, { days, apply = false, policyRef = null }) {
  if (!Number.isInteger(days) || days < 1) throw new Error('--days must be a positive whole number');
  if (apply && (!policyRef || policyRef.trim().length < 2)) throw new Error('--apply needs --policy-ref (the approved retention policy)');
  await client.query('BEGIN');
  try {
    const cutoff = `now() - make_interval(days => $1)`;
    const counts = (await client.query(`SELECT
        (SELECT count(*)::int FROM openmed_advisory.analyses WHERE created_at < ${cutoff} AND input_text <> $2) AS analyses,
        (SELECT count(*)::int FROM openmed_advisory.summaries s JOIN openmed_advisory.analyses a ON a.id = s.analysis_id
          WHERE a.created_at < ${cutoff} AND NOT (s.content ? 'retention')) AS summaries,
        (SELECT count(*)::int FROM openmed_advisory.generated_drafts d JOIN openmed_advisory.summaries s ON s.id = d.summary_id
          JOIN openmed_advisory.analyses a ON a.id = s.analysis_id WHERE a.created_at < ${cutoff} AND d.sentences <> '[]'::jsonb) AS drafts`,
    [days, MARKER])).rows[0];
    if (apply) {
      const marker = JSON.stringify({ retention: { removed_at: new Date().toISOString(), policy_ref: policyRef.trim(), days } });
      await client.query(`UPDATE openmed_advisory.analyses SET input_text = $2,
          result = jsonb_build_object('advisory_only', true, 'model', result->'model', 'context_engine', result->'context'->'engine') || $3::jsonb
        WHERE created_at < ${cutoff} AND input_text <> $2`, [days, MARKER, marker]);
      await client.query(`UPDATE openmed_advisory.summaries s SET content = jsonb_build_object('status', s.content->'status',
          'summary_version', s.content->'summary_version', 'generator', s.content->'generator') || $2::jsonb
        FROM openmed_advisory.analyses a WHERE a.id = s.analysis_id AND a.created_at < ${cutoff} AND NOT (s.content ? 'retention')`, [days, marker]);
      await client.query(`UPDATE openmed_advisory.generated_drafts d SET sentences = '[]'::jsonb
        FROM openmed_advisory.summaries s, openmed_advisory.analyses a
        WHERE s.id = d.summary_id AND a.id = s.analysis_id AND a.created_at < ${cutoff} AND d.sentences <> '[]'::jsonb`, [days]);
      await client.query(`UPDATE openmed_advisory.generation_attempts g SET raw_output = NULL
        FROM openmed_advisory.summaries s, openmed_advisory.analyses a
        WHERE s.id = g.summary_id AND a.id = s.analysis_id AND a.created_at < ${cutoff} AND g.raw_output IS NOT NULL`, [days]);
      await client.query(`UPDATE openmed_advisory.draft_reviews r SET edited_text = $2
        FROM openmed_advisory.generated_drafts d, openmed_advisory.summaries s, openmed_advisory.analyses a
        WHERE d.id = r.draft_id AND s.id = d.summary_id AND a.id = s.analysis_id AND a.created_at < ${cutoff}
          AND r.edited_text IS NOT NULL AND r.edited_text <> $2`, [days, MARKER]);
    }
    await client.query(apply ? 'COMMIT' : 'ROLLBACK');
    return { days, applied: apply, eligible: counts };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
}

async function main() {
  const argv = process.argv.slice(2);
  const arg = n => (argv.includes(n) ? argv[argv.indexOf(n) + 1] : null);
  const db = await import('../db.js');
  const client = await db.default.connect();
  try {
    const result = await applyRetention(client, { days: Number(arg('--days')), apply: argv.includes('--apply'), policyRef: arg('--policy-ref') });
    console.log(JSON.stringify(result));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 2;
  } finally {
    client.release();
    await db.default.end();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) main();
