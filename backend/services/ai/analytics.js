/**
 * Advisory statistics computed in SQL (no language model):
 *
 * rejectionAnalytics  P2.3  adjudication reasons of denied/partial items and NPHIES error codes of
 *                           responses, per insurer and request type, with counts, share and sample size.
 * pollTimingStats     P2.5  poll statistics and time-to-response percentiles.
 *
 * NPHIES polling is endpoint-wide: one poll returns messages for every insurer and poll_logs has no
 * insurer column, so there is no per-insurer poll interval to tune. The per-insurer numbers are the
 * time from submission to the first response. Nothing here changes the scheduler.
 *
 * Statistics below the minimum sample size (AI_MIN_SAMPLE_SIZE, default 30) are refused
 * (insufficientData: true with the count), per AI spec principle 5.
 */
import { query } from '../../db.js';
import { envelope, insufficientData } from './response.js';
import { minSampleSize } from './config.js';
import { redactText } from './phi.js';
import { describeCodes, codeKey } from './codeDescriptions.js';

export class AnalyticsInputError extends Error {}

const DAY_MS = 86_400_000;
const DEFAULT_RANGE_DAYS = 90;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const REQUEST_TYPES = ['prior_authorization', 'claim'];
const round = (value, digits = 4) => (value === null || value === undefined ? null : Number(Number(value).toFixed(digits)));
const isoDate = date => date.toISOString().slice(0, 10);

/** Validate ?from=YYYY-MM-DD&to=YYYY-MM-DD (inclusive). Defaults to the last 90 days. */
export function parseRange({ from, to } = {}, now = new Date()) {
  const parse = (value, name) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value))) throw new AnalyticsInputError(`${name} must be a date (YYYY-MM-DD)`);
    const date = new Date(`${value}T00:00:00Z`);
    if (Number.isNaN(date.getTime()) || isoDate(date) !== value) throw new AnalyticsInputError(`${name} is not a valid date`);
    return date;
  };
  const end = to ? parse(to, 'to') : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const start = from ? parse(from, 'from') : new Date(end.getTime() - (DEFAULT_RANGE_DAYS - 1) * DAY_MS);
  if (start > end) throw new AnalyticsInputError('from must not be after to');
  return { from: isoDate(start), to: isoDate(end), start: isoDate(start), endExclusive: isoDate(new Date(end.getTime() + DAY_MS)) };
}

function parseTop(top) {
  if (top === undefined || top === '') return 10;
  const value = Number(top);
  if (!Number.isInteger(value) || value < 1 || value > 50) throw new AnalyticsInputError('top must be an integer from 1 to 50');
  return value;
}

// A stored adjudication_reason is either the NPHIES reason code or its display text.
const looksLikeCode = value => /^[A-Za-z0-9][A-Za-z0-9._-]{0,39}$/.test(String(value || ''));
const REASON_TEXT_NOTE = 'Stored as reason text (no code was kept for this item).';

const REJECTION_SAMPLE_SQL = `
  WITH records AS (
    SELECT 'prior_authorization' AS request_type, pa.auth_type AS record_type, pa.insurer_id, pa.id, pa.status
    FROM prior_authorizations pa
    WHERE pa.request_date >= $1 AND pa.request_date < $2
      AND EXISTS (SELECT 1 FROM prior_authorization_responses r WHERE r.prior_auth_id = pa.id)
    UNION ALL
    SELECT 'claim', cs.claim_type, cs.insurer_id, cs.id, cs.status
    FROM claim_submissions cs
    WHERE cs.request_date >= $1 AND cs.request_date < $2
      AND EXISTS (SELECT 1 FROM claim_submission_responses r WHERE r.claim_id = cs.id)
  )
  SELECT r.request_type, r.record_type, r.insurer_id, i.insurer_name,
         COUNT(*)::int AS sample_size,
         COUNT(*) FILTER (WHERE r.status IN ('denied', 'error', 'partial'))::int AS affected_records
  FROM records r
  LEFT JOIN insurers i ON i.insurer_id = r.insurer_id
  WHERE ($3::text IS NULL OR r.request_type = $3) AND ($4::uuid IS NULL OR r.insurer_id = $4)
  GROUP BY r.request_type, r.record_type, r.insurer_id, i.insurer_name
`;

const REJECTION_EVENTS_SQL = `
  WITH events AS (
    SELECT 'prior_authorization' AS request_type, pa.auth_type AS record_type, pa.insurer_id, pa.id AS record_id,
           'adjudication_reason' AS kind, NULLIF(TRIM(it.adjudication_reason), '') AS code, NULL::text AS system, NULL::text AS message
    FROM prior_authorization_items it JOIN prior_authorizations pa ON pa.id = it.prior_auth_id
    WHERE it.adjudication_status IN ('denied', 'partial') AND pa.request_date >= $1 AND pa.request_date < $2
    UNION ALL
    SELECT 'prior_authorization', pa.auth_type, pa.insurer_id, pa.id,
           'error', COALESCE(e->>'code', 'UNKNOWN'), e->'coding'->0->>'system', COALESCE(e->>'message', e->>'details')
    FROM prior_authorization_responses r JOIN prior_authorizations pa ON pa.id = r.prior_auth_id
    CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(r.errors) = 'array' THEN r.errors ELSE '[]'::jsonb END) e
    WHERE pa.request_date >= $1 AND pa.request_date < $2
    UNION ALL
    SELECT 'claim', cs.claim_type, cs.insurer_id, cs.id,
           'adjudication_reason', NULLIF(TRIM(it.adjudication_reason), ''), NULL, NULL
    FROM claim_submission_items it JOIN claim_submissions cs ON cs.id = it.claim_id
    WHERE it.adjudication_status IN ('denied', 'partial') AND cs.request_date >= $1 AND cs.request_date < $2
    UNION ALL
    SELECT 'claim', cs.claim_type, cs.insurer_id, cs.id,
           'error', COALESCE(e->>'code', 'UNKNOWN'), e->'coding'->0->>'system', COALESCE(e->>'message', e->>'details')
    FROM claim_submission_responses r JOIN claim_submissions cs ON cs.id = r.claim_id
    CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(r.errors) = 'array' THEN r.errors ELSE '[]'::jsonb END) e
    WHERE cs.request_date >= $1 AND cs.request_date < $2
  )
  SELECT request_type, record_type, insurer_id, kind, COALESCE(code, '(no reason given)') AS code,
         MAX(system) AS system, MIN(message) AS sample_message,
         COUNT(*)::int AS occurrences, COUNT(DISTINCT record_id)::int AS records
  FROM events
  WHERE ($3::text IS NULL OR request_type = $3) AND ($4::uuid IS NULL OR insurer_id = $4)
  GROUP BY request_type, record_type, insurer_id, kind, COALESCE(code, '(no reason given)')
`;

const groupKey = row => `${row.request_type}|${row.record_type}|${row.insurer_id ?? ''}`;

export async function rejectionAnalytics(params = {}, { queryFn = query, env = process.env, now = new Date() } = {}) {
  const range = parseRange(params, now);
  const top = parseTop(params.top);
  const type = params.type || null;
  if (type && !REQUEST_TYPES.includes(type)) throw new AnalyticsInputError(`type must be one of ${REQUEST_TYPES.join(', ')}`);
  const insurerId = params.insurerId || null;
  if (insurerId && !UUID.test(insurerId)) throw new AnalyticsInputError('insurerId must be a UUID');
  const minimum = minSampleSize(env);
  const sqlParams = [range.start, range.endExclusive, type, insurerId];

  const [samples, events] = await Promise.all([
    queryFn(REJECTION_SAMPLE_SQL, sqlParams),
    queryFn(REJECTION_EVENTS_SQL, sqlParams)
  ]);

  const codeEntries = events.rows
    .filter(r => r.kind === 'error' || looksLikeCode(r.code))
    .map(r => ({ code: r.code, system: r.system || null }));
  const descriptions = await describeCodes(codeEntries, { queryFn });

  const groups = new Map();
  for (const row of samples.rows) {
    groups.set(groupKey(row), {
      requestType: row.request_type, recordType: row.record_type, insurerId: row.insurer_id,
      insurerName: row.insurer_name || null, sampleSize: row.sample_size, affectedRecords: row.affected_records, events: []
    });
  }
  for (const row of events.rows) {
    const key = groupKey(row);
    if (!groups.has(key)) {
      groups.set(key, { requestType: row.request_type, recordType: row.record_type, insurerId: row.insurer_id,
        insurerName: null, sampleSize: 0, affectedRecords: 0, events: [] });
    }
    groups.get(key).events.push(row);
  }

  const result = [...groups.values()].map(({ events: rows, ...group }) => {
    const totalOccurrences = rows.reduce((sum, r) => sum + r.occurrences, 0);
    const enough = group.sampleSize >= minimum;
    const codes = rows
      .sort((a, b) => b.occurrences - a.occurrences || String(a.code).localeCompare(String(b.code)))
      .slice(0, top)
      .map(r => {
        const isCode = r.kind === 'error' || looksLikeCode(r.code);
        const described = isCode ? descriptions.get(codeKey({ code: r.code, system: r.system || null })) : null;
        return {
          kind: r.kind,
          code: redactText(r.code),
          system: r.system || null,
          count: r.occurrences,
          records: r.records,
          share: enough && totalOccurrences ? round(r.occurrences / totalOccurrences) : null,
          description: described?.description ?? null,
          descriptionSource: described?.descriptionSource ?? null,
          ...(isCode ? (described?.note ? { note: described.note } : {}) : { note: REASON_TEXT_NOTE }),
          ...(r.sample_message ? { nphiesMessage: redactText(r.sample_message) } : {})
        };
      });
    return {
      ...group,
      totalOccurrences,
      insufficientData: !enough,
      ...(enough ? {} : { minimum }),
      codes
    };
  }).sort((a, b) => b.totalOccurrences - a.totalOccurrences);

  return envelope({
    source: 'statistics',
    certainty: result.some(g => !g.insufficientData) ? 'medium' : 'low',
    basis: {
      description: 'Counts of adjudication reasons on denied/partial items and of NPHIES error codes on stored responses, ' +
        'per insurer and request type, for requests dated in the range. Share = occurrences / all occurrences in the group.',
      tables: ['prior_authorization_items', 'prior_authorization_responses', 'claim_submission_items', 'claim_submission_responses'],
      sampleSize: 'records with at least one stored response (per group)',
      minimumSampleSize: minimum
    },
    range: { from: range.from, to: range.to },
    top,
    groups: result
  });
}

/**
 * Advisory poll-interval band from the message arrival rate (messages per hour): between one and
 * three mean inter-arrival times, clamped to 1..60 minutes. Null when no messages arrived.
 */
export function recommendedIntervalBand(arrivalRatePerHour) {
  if (!(arrivalRatePerHour > 0)) return null;
  const clamp = minutes => Math.min(60, Math.max(1, Math.round(minutes)));
  const meanGapMinutes = 60 / arrivalRatePerHour;
  return { minMinutes: clamp(meanGapMinutes), maxMinutes: clamp(3 * meanGapMinutes) };
}

const POLL_GLOBAL_SQL = `
  WITH logs AS (
    SELECT status, COALESCE(messages_received, 0) AS messages, COALESCE(started_at, created_at) AS at
    FROM poll_logs
    WHERE created_at >= $1 AND created_at < $2
  ), gaps AS (
    SELECT EXTRACT(EPOCH FROM (at - LAG(at) OVER (ORDER BY at)))::float AS gap FROM logs
  )
  SELECT (SELECT COUNT(*) FROM logs)::int AS polls,
         (SELECT COUNT(*) FROM logs WHERE status IN ('success', 'no_messages'))::int AS completed,
         (SELECT COUNT(*) FROM logs WHERE status IN ('success', 'no_messages') AND messages = 0)::int AS empty_polls,
         (SELECT COALESCE(SUM(messages), 0) FROM logs WHERE status IN ('success', 'no_messages'))::int AS messages,
         (SELECT EXTRACT(EPOCH FROM (MAX(at) - MIN(at)))::float FROM logs WHERE status IN ('success', 'no_messages')) AS span_seconds,
         (SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY gap) FROM gaps WHERE gap IS NOT NULL) AS median_gap_seconds
`;

const RESPONSE_TIMES_SQL = `
  WITH firsts AS (
    SELECT 'prior_authorization' AS request_type, pa.insurer_id,
           EXTRACT(EPOCH FROM (MIN(r.received_at) - pa.request_date))::float AS first_seconds,
           EXTRACT(EPOCH FROM (MIN(r.received_at) FILTER (WHERE r.outcome IS DISTINCT FROM 'queued') - pa.request_date))::float AS final_seconds
    FROM prior_authorizations pa
    JOIN prior_authorization_responses r ON r.prior_auth_id = pa.id AND r.received_at >= pa.request_date AND r.response_type <> 'cancel'
    WHERE pa.request_date >= $1 AND pa.request_date < $2
    GROUP BY pa.id, pa.insurer_id, pa.request_date
    UNION ALL
    SELECT 'claim', cs.insurer_id,
           EXTRACT(EPOCH FROM (MIN(r.received_at) - cs.request_date))::float,
           EXTRACT(EPOCH FROM (MIN(r.received_at) FILTER (WHERE r.outcome IS DISTINCT FROM 'queued') - cs.request_date))::float
    FROM claim_submissions cs
    JOIN claim_submission_responses r ON r.claim_id = cs.id AND r.received_at >= cs.request_date AND r.response_type <> 'cancel'
    WHERE cs.request_date >= $1 AND cs.request_date < $2
    GROUP BY cs.id, cs.insurer_id, cs.request_date
  )
  SELECT f.request_type, f.insurer_id, i.insurer_name,
         COUNT(f.first_seconds)::int AS n_first,
         percentile_cont(0.5) WITHIN GROUP (ORDER BY f.first_seconds) AS p50_first,
         percentile_cont(0.9) WITHIN GROUP (ORDER BY f.first_seconds) AS p90_first,
         COUNT(f.final_seconds)::int AS n_final,
         percentile_cont(0.5) WITHIN GROUP (ORDER BY f.final_seconds) AS p50_final,
         percentile_cont(0.9) WITHIN GROUP (ORDER BY f.final_seconds) AS p90_final
  FROM firsts f
  LEFT JOIN insurers i ON i.insurer_id = f.insurer_id
  GROUP BY f.request_type, f.insurer_id, i.insurer_name
`;

export const POLL_SCOPE_NOTE =
  'NPHIES polling here is endpoint-wide: one poll returns messages for every insurer and poll_logs has no insurer column, ' +
  'so a per-insurer poll interval does not exist. Per-insurer figures are the time from submission to the first response. ' +
  'Advisory only: the scheduler is not changed.';

export async function pollTimingStats(params = {}, { queryFn = query, env = process.env, now = new Date() } = {}) {
  const range = parseRange(params, now);
  const minimum = minSampleSize(env);
  const sqlParams = [range.start, range.endExclusive];
  const [globalRes, timesRes] = await Promise.all([queryFn(POLL_GLOBAL_SQL, sqlParams), queryFn(RESPONSE_TIMES_SQL, sqlParams)]);
  const g = globalRes.rows[0] || { polls: 0, completed: 0, empty_polls: 0, messages: 0, span_seconds: null, median_gap_seconds: null };
  const configured = parseInt(env.POLL_INTERVAL_MINUTES || '5', 10);
  const currentIntervalMinutes = Number.isInteger(configured) && configured > 0 ? configured : 5;

  let global;
  if (g.completed < minimum) {
    global = insufficientData({ count: g.completed, minimum, polls: g.polls });
  } else {
    const hours = Number(g.span_seconds) / 3600;
    const arrivalRatePerHour = hours > 0 ? round(g.messages / hours, 3) : null;
    global = {
      insufficientData: false,
      polls: g.polls,
      completedPolls: g.completed,
      messages: g.messages,
      messagesPerPoll: round(g.messages / g.completed, 3),
      emptyPollRatio: round(g.empty_polls / g.completed, 4),
      medianSecondsBetweenPolls: round(g.median_gap_seconds, 1),
      arrivalRatePerHour,
      recommendedIntervalMinutes: recommendedIntervalBand(arrivalRatePerHour),
      recommendationBasis: 'Between one and three mean message inter-arrival times, clamped to 1-60 minutes (heuristic).'
    };
  }
  global.currentIntervalMinutes = currentIntervalMinutes;
  global.scheduledPollingEnabled = env.ENABLE_SCHEDULED_POLLING === 'true';

  const percentiles = (n, p50, p90) => (n >= minimum
    ? { n, p50Seconds: round(p50, 1), p90Seconds: round(p90, 1) }
    : insufficientData({ count: n, minimum }));
  const perInsurer = timesRes.rows.map(row => ({
    requestType: row.request_type,
    insurerId: row.insurer_id,
    insurerName: row.insurer_name || null,
    firstResponse: percentiles(row.n_first, row.p50_first, row.p90_first),
    finalResponse: percentiles(row.n_final, row.p50_final, row.p90_final)
  }));

  return envelope({
    source: 'statistics',
    certainty: global.insufficientData ? 'low' : 'medium',
    basis: {
      description: 'poll_logs (completed polls) for the global figures; request_date of prior authorizations / claims and ' +
        'received_at of their stored responses for the per-insurer time to first response and to first non-queued response.',
      minimumSampleSize: minimum
    },
    scope: 'endpoint-wide',
    perInsurerPollInterval: false,
    note: POLL_SCOPE_NOTE,
    range: { from: range.from, to: range.to },
    global,
    perInsurer
  });
}
