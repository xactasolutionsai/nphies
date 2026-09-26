// AI data-volume report (read-only). Gate artefact for the statistical / predictive phases.
//
// Usage:
//   npm run ai:data-report              markdown report
//   npm run ai:data-report -- --json    same result as JSON
//
// Every query runs inside BEGIN READ ONLY ... ROLLBACK; nothing is written or deleted.
// Only aggregates are printed: counts per status / outcome / insurer / type / month, date
// ranges, missing rates and the number of distinct error codes. No patient identifier, name,
// request number or free text is selected. Insurer names (organisations) are shown.
//
// The "sufficiency" section applies the explicit thresholds in DEFAULT_THRESHOLDS. They are
// rules of thumb for whether training/evaluating a classifier is worth attempting, NOT a
// guarantee that a model built on the data will be accurate or unbiased.
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Heuristic minimums per candidate model (documented in docs/AI_ROADMAP_GATES.md):
 * - minLabelled: records with a final decision (the label) — at least 1000;
 * - minMinority: records in the rarer class (e.g. denied) — at least 100, so a held-out
 *   test set still has enough of them to measure recall;
 * - minMonths: calendar months covered by the labelled records — at least 12, so seasonal
 *   and policy changes are represented and a time-based split is possible.
 */
export const DEFAULT_THRESHOLDS = Object.freeze({ minLabelled: 1000, minMinority: 100, minMonths: 12 });

/**
 * Record-level label: adjudication_outcome when the insurer sent one ('rejected' = denied,
 * 'approved'/'partial' = accepted), otherwise the status ('denied' vs the accepted statuses).
 * Anything else (draft, pending, queued, error, cancelled, pended) is unlabelled.
 */
function recordLabelSql(cols, acceptedStatuses) {
  if (!cols.has('status')) return null;
  const accepted = acceptedStatuses.map(v => `'${v}'`).join(', ');
  if (!cols.has('adjudication_outcome')) {
    return `CASE WHEN r.status = 'denied' THEN 'denied' WHEN r.status IN (${accepted}) THEN 'accepted' END`;
  }
  return `CASE WHEN r.adjudication_outcome = 'rejected' OR (r.adjudication_outcome IS NULL AND r.status = 'denied') THEN 'denied'
    WHEN r.adjudication_outcome IN ('approved', 'partial') OR (r.adjudication_outcome IS NULL AND r.status IN (${accepted})) THEN 'accepted' END`;
}

export const SOURCES = Object.freeze({
  prior_authorizations: {
    label: 'Prior authorizations',
    table: 'prior_authorizations',
    typeColumn: 'auth_type',
    fk: 'prior_auth_id',
    items: 'prior_authorization_items',
    responses: 'prior_authorization_responses',
    diagnoses: 'prior_authorization_diagnoses',
    supporting: 'prior_authorization_supporting_info',
    labelSql: cols => recordLabelSql(cols, ['approved', 'partial']),
    labelDefinition: "adjudication_outcome 'rejected' vs 'approved'/'partial' (status denied vs approved/partial when adjudication_outcome is empty)"
  },
  claim_submissions: {
    label: 'Claim submissions',
    table: 'claim_submissions',
    typeColumn: 'claim_type',
    fk: 'claim_id',
    items: 'claim_submission_items',
    responses: 'claim_submission_responses',
    diagnoses: 'claim_submission_diagnoses',
    supporting: 'claim_submission_supporting_info',
    labelSql: cols => recordLabelSql(cols, ['approved', 'partial', 'paid']),
    labelDefinition: "adjudication_outcome 'rejected' vs 'approved'/'partial' (status denied vs approved/partial/paid when adjudication_outcome is empty)"
  }
});

const ITEM_LABEL_SQL = "CASE WHEN it.adjudication_status = 'denied' THEN 'denied' WHEN it.adjudication_status IN ('approved', 'partial') THEN 'accepted' END";

/** Columns of a table in the current search_path, or null when the table does not exist. */
export async function tableColumns(queryFn, table) {
  const result = await queryFn(`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = $1 AND table_schema = (
      SELECT n.nspname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.oid = to_regclass($1))`, [table]);
  return result.rows.length ? new Set(result.rows.map(r => r.column_name)) : null;
}

const toCount = value => Number(value ?? 0);
const dateExpr = cols => [cols.has('request_date') && 'r.request_date', cols.has('created_at') && 'r.created_at'].filter(Boolean);
const coalesceDate = cols => {
  const parts = dateExpr(cols);
  return parts.length ? `COALESCE(${parts.join(', ')})` : null;
};
const nonBlank = expr => `NULLIF(btrim(${expr}::text), '') IS NOT NULL`;

async function groupCounts(queryFn, from, keyExpr) {
  const result = await queryFn(`SELECT ${keyExpr} AS key, count(*)::int AS count FROM ${from} GROUP BY 1 ORDER BY 2 DESC, 1`);
  return result.rows.map(row => ({ key: row.key ?? '(empty)', count: toCount(row.count) }));
}

function monthsCovered(first, last) {
  if (!first || !last) return 0;
  const a = new Date(first);
  const b = new Date(last);
  return (b.getUTCFullYear() - a.getUTCFullYear()) * 12 + (b.getUTCMonth() - a.getUTCMonth()) + 1;
}

async function labelStats(queryFn, from, labelSql, dateSql) {
  const result = await queryFn(`
    SELECT label, count(*)::int AS count, min(d) AS first, max(d) AS last
    FROM (SELECT ${labelSql} AS label, ${dateSql} AS d FROM ${from}) x
    WHERE label IS NOT NULL
    GROUP BY label`);
  const byLabel = Object.fromEntries(result.rows.map(r => [r.label, toCount(r.count)]));
  const firsts = result.rows.map(r => r.first).filter(Boolean).map(d => new Date(d));
  const lasts = result.rows.map(r => r.last).filter(Boolean).map(d => new Date(d));
  const first = firsts.length ? new Date(Math.min(...firsts)).toISOString() : null;
  const last = lasts.length ? new Date(Math.max(...lasts)).toISOString() : null;
  return {
    accepted: byLabel.accepted || 0,
    denied: byLabel.denied || 0,
    labelled: (byLabel.accepted || 0) + (byLabel.denied || 0),
    first, last, monthsCovered: monthsCovered(first, last)
  };
}

/** Aggregates for one source (prior authorizations or claim submissions). */
export async function sourceReport(queryFn, spec) {
  const cols = await tableColumns(queryFn, spec.table);
  if (!cols) return { source: spec.table, label: spec.label, present: false };
  const itemCols = await tableColumns(queryFn, spec.items);
  const responseCols = await tableColumns(queryFn, spec.responses);
  const diagnosisCols = await tableColumns(queryFn, spec.diagnoses);
  const supportingCols = await tableColumns(queryFn, spec.supporting);
  const from = `${spec.table} r`;
  const date = coalesceDate(cols);

  const total = toCount((await queryFn(`SELECT count(*)::int AS n FROM ${from}`)).rows[0].n);
  const report = { source: spec.table, label: spec.label, present: true, total, byOutcome: {}, notInSchema: [] };

  if (date) {
    const range = (await queryFn(`SELECT min(${date}) AS first, max(${date}) AS last FROM ${from}`)).rows[0];
    report.dateRange = { first: range.first ? new Date(range.first).toISOString() : null, last: range.last ? new Date(range.last).toISOString() : null };
    report.byMonth = await groupCounts(queryFn, from, `to_char(date_trunc('month', ${date}), 'YYYY-MM')`);
  } else report.notInSchema.push('request_date/created_at');

  for (const column of ['status', 'outcome', 'adjudication_outcome']) {
    if (cols.has(column)) report.byOutcome[column] = await groupCounts(queryFn, from, `r.${column}`);
    else report.notInSchema.push(column);
  }
  if (cols.has(spec.typeColumn)) report.byType = await groupCounts(queryFn, from, `r.${spec.typeColumn}`);
  else report.notInSchema.push(spec.typeColumn);

  if (cols.has('insurer_id')) {
    const insurerCols = await tableColumns(queryFn, 'insurers');
    report.byInsurer = insurerCols?.has('insurer_name')
      ? await groupCounts(queryFn, `${from} LEFT JOIN insurers i ON i.insurer_id = r.insurer_id`,
        "COALESCE(i.insurer_name, CASE WHEN r.insurer_id IS NULL THEN '(no insurer)' ELSE 'insurer ' || r.insurer_id::text END)")
      : await groupCounts(queryFn, from, "COALESCE(r.insurer_id::text, '(no insurer)')");
  } else report.notInSchema.push('insurer_id');

  // Candidate features: share of records where the value is missing.
  const features = {};
  const addFeature = (name, expr, reason) => { features[name] = expr ? { expr } : { notInSchema: reason }; };
  const diagParts = [
    diagnosisCols?.has(spec.fk) && `EXISTS (SELECT 1 FROM ${spec.diagnoses} d WHERE d.${spec.fk} = r.id)`,
    cols.has('diagnosis_codes') && nonBlank('r.diagnosis_codes'),
    cols.has('primary_diagnosis') && nonBlank('r.primary_diagnosis')
  ].filter(Boolean);
  addFeature('diagnosis_codes_present', diagParts.length ? `(${diagParts.join(' OR ')})` : null, 'no diagnosis table/columns');
  const itemCodeCols = ['product_or_service_code', 'medication_code'].filter(c => itemCols?.has(c));
  addFeature('item_codes_present', itemCols?.has(spec.fk) && itemCodeCols.length
    ? `EXISTS (SELECT 1 FROM ${spec.items} it WHERE it.${spec.fk} = r.id AND (${itemCodeCols.map(c => nonBlank(`it.${c}`)).join(' OR ')}))`
    : null, 'no item table/code columns');
  addFeature('total_amount', cols.has('total_amount') ? 'r.total_amount IS NOT NULL' : null, 'column total_amount not present');
  addFeature('insurer', cols.has('insurer_id') ? 'r.insurer_id IS NOT NULL' : null, 'column insurer_id not present');
  addFeature(spec.typeColumn, cols.has(spec.typeColumn) ? nonBlank(`r.${spec.typeColumn}`) : null, `column ${spec.typeColumn} not present`);
  addFeature('encounter_class', cols.has('encounter_class') ? nonBlank('r.encounter_class') : null, 'column encounter_class not present');
  addFeature('practitioner_license', cols.has('practitioner_license') ? nonBlank('r.practitioner_license') : null,
    'column practitioner_license not present (migration 067)');
  addFeature('supporting_info', supportingCols?.has(spec.fk)
    ? `EXISTS (SELECT 1 FROM ${spec.supporting} s WHERE s.${spec.fk} = r.id)` : null, 'no supporting info table');

  const measured = Object.entries(features).filter(([, f]) => f.expr);
  const missingRow = measured.length
    ? (await queryFn(`SELECT ${measured.map(([name, f], i) => `count(*) FILTER (WHERE NOT (${f.expr}))::int AS m${i}`).join(', ')} FROM ${from}`)).rows[0]
    : {};
  report.missingRates = Object.fromEntries(Object.entries(features).map(([name, f]) => {
    if (!f.expr) return [name, { notInSchema: f.notInSchema }];
    const missing = toCount(missingRow[`m${measured.findIndex(([n]) => n === name)}`]);
    return [name, { missing, total, rate: total ? Number((missing / total).toFixed(4)) : null }];
  }));
  if (supportingCols?.has(spec.fk)) {
    const row = (await queryFn(`
      SELECT COALESCE(avg(n), 0)::float AS mean, COALESCE(max(n), 0)::int AS max
      FROM (SELECT (SELECT count(*) FROM ${spec.supporting} s WHERE s.${spec.fk} = r.id) AS n FROM ${from}) x`)).rows[0];
    report.supportingInfoPerRecord = { mean: Number(Number(row.mean).toFixed(2)), max: toCount(row.max) };
  }

  // Item level
  if (itemCols?.has(spec.fk)) {
    const itemFrom = `${spec.items} it JOIN ${spec.table} r ON r.id = it.${spec.fk}`;
    report.items = { total: toCount((await queryFn(`SELECT count(*)::int AS n FROM ${spec.items}`)).rows[0].n), byOutcome: {} };
    for (const column of ['adjudication_status', 'adjudication_outcome']) {
      if (itemCols.has(column)) report.items.byOutcome[column] = await groupCounts(queryFn, `${spec.items} it`, `it.${column}`);
    }
    report.items.labels = itemCols.has('adjudication_status') && date
      ? await labelStats(queryFn, itemFrom, ITEM_LABEL_SQL, date) : null;
  } else report.notInSchema.push(spec.items);

  // Labels for the record-level model
  const labelSql = spec.labelSql(cols);
  report.labelDefinition = spec.labelDefinition;
  report.labels = labelSql && date ? await labelStats(queryFn, from, labelSql, date) : null;

  // Distinct NPHIES error codes in responses
  if (responseCols?.has('errors')) {
    const row = (await queryFn(`
      SELECT count(DISTINCT e->>'code')::int AS codes, count(DISTINCT x.id)::int AS responses_with_codes
      FROM ${spec.responses} x
      CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(x.errors) = 'array' THEN x.errors ELSE '[]'::jsonb END) e
      WHERE NULLIF(e->>'code', '') IS NOT NULL`)).rows[0];
    report.errorCodes = { distinctCodes: toCount(row.codes), responsesWithCodes: toCount(row.responses_with_codes) };
  } else report.notInSchema.push(`${spec.responses}.errors`);

  return report;
}

/** Pure: apply the thresholds to one set of label statistics. */
export function assessModel(name, description, labels, thresholds = DEFAULT_THRESHOLDS, missingReason = 'no label/date column in the schema') {
  if (!labels) {
    return { model: name, description, sufficient: false, checks: [], reason: missingReason };
  }
  const minority = labels.denied <= labels.accepted
    ? { class: 'denied', count: labels.denied } : { class: 'accepted', count: labels.accepted };
  const checks = [
    { name: 'labelled records', value: labels.labelled, threshold: thresholds.minLabelled, pass: labels.labelled >= thresholds.minLabelled },
    { name: `minority class (${minority.class})`, value: minority.count, threshold: thresholds.minMinority, pass: minority.count >= thresholds.minMinority },
    { name: 'calendar months covered', value: labels.monthsCovered, threshold: thresholds.minMonths, pass: labels.monthsCovered >= thresholds.minMonths }
  ];
  return { model: name, description, sufficient: checks.every(c => c.pass), checks };
}

export function sufficiency(sources, thresholds = DEFAULT_THRESHOLDS) {
  const pa = sources.find(s => s.source === 'prior_authorizations');
  const claims = sources.find(s => s.source === 'claim_submissions');
  const why = source => (source?.present ? undefined : 'table not present in this database');
  return {
    thresholds,
    note: 'Heuristic minimums, not guarantees: meeting them means a model is worth trying and evaluating on a ' +
      'time-based hold-out set; it says nothing about the accuracy or fairness the model will reach.',
    models: [
      assessModel('pa_denial', 'Prior authorization denied vs approved/partial (record level)', pa?.labels ?? null, thresholds, why(pa)),
      assessModel('pa_item_denial', 'Prior authorization item denied vs approved/partial', pa?.items?.labels ?? null, thresholds, why(pa)),
      assessModel('claim_rejection', 'Claim rejected vs approved/partial (record level)', claims?.labels ?? null, thresholds, why(claims)),
      assessModel('claim_item_denial', 'Claim item denied vs approved/partial', claims?.items?.labels ?? null, thresholds, why(claims))
    ]
  };
}

/** Build the whole report with a query function (caller owns the READ ONLY transaction). */
export async function buildDataVolumeReport(queryFn, { thresholds = DEFAULT_THRESHOLDS, now = () => new Date() } = {}) {
  const sources = [];
  for (const spec of Object.values(SOURCES)) sources.push(await sourceReport(queryFn, spec));
  return { generatedAt: now().toISOString(), sources, sufficiency: sufficiency(sources, thresholds) };
}

/** Run inside BEGIN READ ONLY and always roll back. client: pg client with query(). */
export async function runReadOnly(client, options) {
  await client.query('BEGIN READ ONLY');
  try {
    return await buildDataVolumeReport((sql, params) => client.query(sql, params), options);
  } finally {
    await client.query('ROLLBACK').catch(() => {});
  }
}

const pct = rate => (rate === null || rate === undefined ? 'n/a' : `${(rate * 100).toFixed(1)}%`);
const table = (rows, headers) => rows.length
  ? [`| ${headers.join(' | ')} |`, `|${headers.map(() => '---').join('|')}|`, ...rows.map(r => `| ${r.join(' | ')} |`)].join('\n')
  : '_none_';
const countsTable = (groups, keyName) => table((groups || []).map(g => [g.key, g.count]), [keyName, 'count']);

export function toMarkdown(report) {
  const out = [`# AI data-volume report`, '', `Generated ${report.generatedAt}. Read-only aggregates; no patient identifiers.`, ''];
  for (const s of report.sources) {
    out.push(`## ${s.label} (\`${s.source}\`)`, '');
    if (!s.present) { out.push('Table not present in this database.', ''); continue; }
    out.push(`Records: **${s.total}**`);
    if (s.dateRange) out.push(`Date range (request_date, else created_at): ${s.dateRange.first ?? 'n/a'} → ${s.dateRange.last ?? 'n/a'}`);
    out.push('');
    for (const [column, groups] of Object.entries(s.byOutcome)) out.push(`### By ${column}`, '', countsTable(groups, column), '');
    if (s.byType) out.push('### By type', '', countsTable(s.byType, 'type'), '');
    if (s.byInsurer) out.push('### By insurer', '', countsTable(s.byInsurer, 'insurer'), '');
    if (s.byMonth) out.push('### By month', '', countsTable(s.byMonth, 'month'), '');
    if (s.items) {
      out.push(`### Items (${s.items.total})`, '');
      for (const [column, groups] of Object.entries(s.items.byOutcome)) out.push(countsTable(groups, column), '');
    }
    out.push('### Missing rate of candidate features', '', table(Object.entries(s.missingRates).map(([name, m]) =>
      m.notInSchema ? [name, 'not in schema', m.notInSchema] : [name, `${m.missing}/${m.total}`, pct(m.rate)]), ['feature', 'missing', 'rate']), '');
    if (s.supportingInfoPerRecord) out.push(`Supporting info rows per record: mean ${s.supportingInfoPerRecord.mean}, max ${s.supportingInfoPerRecord.max}`, '');
    if (s.errorCodes) out.push(`Distinct error codes in \`${SOURCES[s.source].responses}.errors\`: **${s.errorCodes.distinctCodes}** (in ${s.errorCodes.responsesWithCodes} responses)`, '');
    if (s.labels) out.push(`Label (${s.labelDefinition}): accepted ${s.labels.accepted}, denied ${s.labels.denied}, months covered ${s.labels.monthsCovered}`, '');
    if (s.notInSchema.length) out.push(`Not in schema: ${s.notInSchema.join(', ')}`, '');
  }
  const t = report.sufficiency.thresholds;
  out.push('## Sufficiency (heuristic)', '', report.sufficiency.note, '',
    `Thresholds per model: labelled ≥ ${t.minLabelled}, minority class ≥ ${t.minMinority}, calendar months ≥ ${t.minMonths}.`, '');
  out.push(table(report.sufficiency.models.map(m => [
    m.model,
    m.sufficient ? 'PASS' : 'FAIL',
    m.checks.length ? m.checks.map(c => `${c.name}: ${c.value}/${c.threshold}${c.pass ? '' : ' ✗'}`).join('; ') : m.reason
  ]), ['model', 'status', 'evidence']), '');
  return out.join('\n');
}

async function main(argv) {
  const { default: pool } = await import('../db.js');
  let client;
  try {
    client = await pool.connect();
    const report = await runReadOnly(client);
    console.log(argv.includes('--json') ? JSON.stringify(report, null, 2) : toMarkdown(report));
  } catch (error) {
    console.error(`AI data-volume report failed: ${error.message}`);
    process.exitCode = 1;
  } finally {
    client?.release();
    await pool.end().catch(() => {});
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main(process.argv.slice(2));
}
