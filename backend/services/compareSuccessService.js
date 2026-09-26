/**
 * "Compare with last accepted request" for prior authorizations and claims (P2.2).
 *
 * For a record whose status is error or denied, the reference is the most recent record of the
 * same auth/claim type and the same insurer whose Claim meta.profile is identical ("same schema")
 * and whose LATEST stored response was accepted: outcome complete/partial, no errors, record status
 * approved/partial (claims also paid). Both are read on the same connection, i.e. the same database
 * schema. The two request bundles are compared structurally (services/bundleDiff.js); the output
 * holds codes, systems and profiles only, never patient values.
 *
 * explainComparison() optionally asks the LLM to explain the (already redacted) diff and the NPHIES
 * error codes. It is labelled source 'llm', certainty 'low', cached in ai_audit_log, and fails closed.
 */
import { query } from '../db.js';
import { diffBundles, claimProfile } from './bundleDiff.js';
import { envelope, unavailable, LLM_DISCLAIMER } from './ai/response.js';
import { redactText, redactDeep } from './ai/phi.js';
import { isAIFeatureEnabled } from './ai/config.js';
import { hashInput } from './ai/llmClient.js';
import defaultLlm from './ai/llmClient.js';
import { findCachedOutput } from './ai/audit.js';

export class CompareError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

export const COMPARE_KINDS = Object.freeze({
  'prior-authorizations': {
    table: 'prior_authorizations', typeColumn: 'auth_type',
    responses: 'prior_authorization_responses', fk: 'prior_auth_id', accepted: ['approved', 'partial']
  },
  'claim-submissions': {
    table: 'claim_submissions', typeColumn: 'claim_type',
    responses: 'claim_submission_responses', fk: 'claim_id', accepted: ['approved', 'partial', 'paid']
  }
});

export const COMPARABLE_STATUSES = Object.freeze(['error', 'denied']);
export const EXPLAIN_FEATURE = 'bundle_diff_explain';
const EXPLAIN_PROMPT_VERSION = 1;

const parseJson = value => (typeof value === 'string' ? JSON.parse(value) : value);

function errorCodesOf(errors) {
  const list = Array.isArray(parseJson(errors)) ? parseJson(errors) : [];
  return list.slice(0, 50).map(e => ({
    code: e?.code ?? null,
    system: e?.coding?.[0]?.system ?? e?.system ?? null,
    message: e?.message ? redactText(String(e.message)).slice(0, 300) : null
  }));
}

export async function compareWithLastAccepted(kind, rawId, { queryFn = query } = {}) {
  const config = COMPARE_KINDS[kind];
  if (!config) throw new CompareError(404, 'Unknown record type');
  const id = Number(rawId);
  if (!Number.isSafeInteger(id) || id <= 0) throw new CompareError(400, 'Invalid id');

  const failedRow = (await queryFn(
    `SELECT id, status, ${config.typeColumn} AS record_type, insurer_id, request_bundle FROM ${config.table} WHERE id = $1`, [id]
  )).rows[0];
  if (!failedRow) throw new CompareError(404, 'Record not found');
  if (!COMPARABLE_STATUSES.includes(failedRow.status)) {
    throw new CompareError(409, `Comparison is available for records with status ${COMPARABLE_STATUSES.join(' or ')} (this one is ${failedRow.status})`);
  }

  const lastResponse = (await queryFn(
    `SELECT r.errors FROM ${config.responses} r WHERE r.${config.fk} = $1 ORDER BY r.received_at DESC, r.id DESC LIMIT 1`, [id]
  )).rows[0];
  const failed = { id: failedRow.id, status: failedRow.status, recordType: failedRow.record_type, errorCodes: errorCodesOf(lastResponse?.errors) };

  const failedBundle = failedRow.request_bundle ? parseJson(failedRow.request_bundle) : null;
  const profile = failedBundle ? claimProfile(failedBundle) : null;
  const basis = {
    description: 'Structural comparison of the stored request bundles. Volatile values (ids, fullUrl, timestamps, identifier ' +
      'values, patient data, amounts) are ignored; codes, systems, profiles and element presence are compared.',
    referenceRule: `Most recent ${config.table} record with the same ${config.typeColumn}, the same insurer and the same Claim ` +
      `meta.profile, status ${config.accepted.join('/')}, whose latest response is complete/partial without errors.`
  };
  const result = (reference, extra) => envelope({ source: 'rules', certainty: 'high', basis, failed, reference, ...extra });
  const empty = message => result(null, { message, diff: [], truncated: false, summary: { missing: 0, extra: 0, different: 0 } });

  if (!failedBundle) return empty('No request bundle is stored for this record, so there is nothing to compare.');
  if (!failedRow.insurer_id) return empty('The record has no insurer, so no reference of the same insurer can be chosen.');

  const referenceRow = (await queryFn(`
    SELECT t.id, t.status, t.request_date, t.request_bundle
    FROM ${config.table} t
    JOIN LATERAL (
      SELECT x.outcome, x.has_errors, x.errors FROM ${config.responses} x
      WHERE x.${config.fk} = t.id ORDER BY x.received_at DESC, x.id DESC LIMIT 1
    ) latest ON true
    WHERE t.id <> $1 AND t.${config.typeColumn} = $2 AND t.insurer_id = $3
      AND t.status = ANY($4) AND t.request_bundle IS NOT NULL
      AND latest.outcome IN ('complete', 'partial') AND COALESCE(latest.has_errors, false) = false
      AND (latest.errors IS NULL OR jsonb_typeof(latest.errors) = 'null'
           OR (jsonb_typeof(latest.errors) = 'array' AND jsonb_array_length(latest.errors) = 0))
      AND ($5::jsonb IS NULL OR EXISTS (
        SELECT 1 FROM jsonb_array_elements(CASE WHEN jsonb_typeof(t.request_bundle->'entry') = 'array'
                                                THEN t.request_bundle->'entry' ELSE '[]'::jsonb END) e
        WHERE e->'resource'->>'resourceType' = 'Claim' AND e->'resource'->'meta'->'profile' = $5::jsonb))
    ORDER BY t.request_date DESC NULLS LAST, t.id DESC
    LIMIT 1
  `, [id, failedRow.record_type, failedRow.insurer_id, config.accepted, profile])).rows[0];

  if (!referenceRow) {
    return empty('No accepted request of the same type, insurer and profile was found to compare with.');
  }
  const { diff, truncated, summary } = diffBundles(failedBundle, parseJson(referenceRow.request_bundle));
  return result({ id: referenceRow.id, status: referenceRow.status, requestDate: referenceRow.request_date }, { diff, truncated, summary });
}

const EXPLAIN_SCHEMA = {
  type: 'object',
  properties: {
    summary: { type: 'string', maxLength: 2000 },
    likelyCauses: {
      type: 'array', maxItems: 10,
      items: {
        type: 'object',
        properties: { path: { type: 'string' }, explanation: { type: 'string', maxLength: 600 } },
        required: ['path', 'explanation']
      }
    }
  },
  required: ['summary', 'likelyCauses']
};

const EXPLAIN_SYSTEM = [
  'You help a billing specialist understand why an NPHIES (Saudi health insurance) FHIR request was rejected.',
  'You receive the NPHIES error codes and a structural diff between the rejected request and the most recent accepted request',
  'of the same type, insurer and profile. Paths are FHIR element paths; "missing" means present only in the accepted request,',
  '"extra" only in the rejected one. Explain which differences most plausibly relate to the error codes.',
  'Only use the data given. Do not invent codes or rules. If the diff does not explain the errors, say so.',
  'Answer in JSON matching the schema.'
].join(' ');

export async function explainComparison(kind, rawId, { queryFn = query, llm = defaultLlm, userId = null, env = process.env } = {}) {
  const comparison = await compareWithLastAccepted(kind, rawId, { queryFn });
  const basis = { description: 'Language-model explanation of the structural diff and NPHIES error codes shown above.', model: llm.model };
  const done = explanation => ({ ...comparison, explanation });

  if (!comparison.reference) return done(unavailable('Nothing to explain: no accepted reference request was found.'));
  if (!isAIFeatureEnabled(EXPLAIN_FEATURE, env)) return done(unavailable('AI features are disabled'));

  // The diff and error messages are already PHI-free; redact again as a guard before sending.
  const payload = redactDeep({ errorCodes: comparison.failed.errorCodes, differences: comparison.diff.slice(0, 80) });
  const inputHash = hashInput({ feature: EXPLAIN_FEATURE, version: EXPLAIN_PROMPT_VERSION, payload, model: llm.model });
  const labelled = (output, extra) => ({
    available: true,
    ...envelope({ source: 'llm', certainty: 'low', basis, disclaimer: LLM_DISCLAIMER }),
    summary: output.summary,
    likelyCauses: output.likelyCauses || [],
    ...extra
  });

  try {
    const cached = await findCachedOutput({ feature: EXPLAIN_FEATURE, inputHash, model: llm.model }, queryFn);
    if (cached) return done(labelled(cached.output, { auditId: cached.auditId, cached: true }));
  } catch (error) {
    console.error('[AI] Explanation cache lookup failed:', error.message);
  }

  const reply = await llm.generateJSON({
    feature: EXPLAIN_FEATURE,
    system: EXPLAIN_SYSTEM,
    prompt: JSON.stringify(payload),
    schema: EXPLAIN_SCHEMA,
    userId,
    inputHash,
    summarize: data => redactDeep(data)
  });
  if (!reply?.available) return done(unavailable(reply?.reason || 'The AI model is unavailable', { auditId: reply?.auditId ?? null }));
  return done(labelled(redactDeep(reply.data), { auditId: reply.auditId ?? null, cached: false }));
}
