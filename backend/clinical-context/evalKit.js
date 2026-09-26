/**
 * Building blocks for an independent evaluation on hospital-annotated data:
 * language grouping, deterministic dev/validation/test assignment, file hashing for a
 * frozen test split, inter-annotator agreement (Cohen's kappa), and checking results
 * against success criteria that were registered before the test run.
 */
import { createHash } from 'node:crypto';

export const sha256 = content => createHash('sha256').update(content).digest('hex');

const ARABIC = /[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]/u;
const LATIN = /[A-Za-z]/;
/** 'en' | 'ar' | 'mixed' | 'other' from the text itself (a declared field wins if present). */
export function languageOf(record) {
  if (['en', 'ar', 'mixed'].includes(record.language)) return record.language;
  const ar = ARABIC.test(record.text), en = LATIN.test(record.text);
  return ar && en ? 'mixed' : ar ? 'ar' : en ? 'en' : 'other';
}

/** Deterministic split from a hash of (salt, id): the same record always lands in the same split. */
export function assignSplit(id, salt, ratios = { dev: 0.6, validation: 0.2, test: 0.2 }) {
  const value = parseInt(sha256(`${salt}\0${id}`).slice(0, 12), 16) / 0x1000000000000;
  let edge = 0;
  for (const [split, ratio] of Object.entries(ratios)) {
    edge += ratio;
    if (value < edge) return split;
  }
  return Object.keys(ratios).at(-1);
}

/** Cohen's kappa for two raters over the same items (labels may be any strings). */
export function cohenKappa(pairs) {
  const n = pairs.length;
  if (!n) return { n: 0, observed: null, kappa: null };
  const labels = [...new Set(pairs.flat())];
  const observed = pairs.filter(([a, b]) => a === b).length / n;
  const expected = labels.reduce((sum, l) =>
    sum + (pairs.filter(([a]) => a === l).length / n) * (pairs.filter(([, b]) => b === l).length / n), 0);
  const kappa = expected === 1 ? (observed === 1 ? 1 : 0) : (observed - expected) / (1 - expected);
  return { n, observed: Math.round(observed * 1000) / 1000, kappa: Math.round(kappa * 1000) / 1000 };
}

/**
 * Compare an evaluation report with pre-registered criteria:
 *   { criteria: [{ id, attribute, metric: 'accuracy'|'precision'|'recall'|'f1'|'unknown_rate_max',
 *                  class?, min?, max?, use_lower_ci?: true, min_n? }] }
 * A criterion with too little data fails as 'insufficient_data', never passes.
 */
export function checkCriteria(report, criteria) {
  return criteria.criteria.map(c => {
    const attr = report.attributes[c.attribute];
    const base = { id: c.id, attribute: c.attribute, metric: c.metric, class: c.class ?? null };
    if (!attr) return { ...base, result: 'insufficient_data', observed: null };
    const n = c.class ? attr.per_class[c.class]?.support ?? 0 : attr.n;
    if (n < (c.min_n ?? 1)) return { ...base, result: 'insufficient_data', observed: null, n };
    let observed;
    if (c.metric === 'accuracy') observed = c.use_lower_ci ? attr.accuracy_ci95?.[0] : attr.accuracy;
    else if (c.metric === 'unknown_rate_max') observed = attr.unknown_rate;
    else if (c.metric === 'recall' && c.use_lower_ci) observed = attr.per_class[c.class]?.recall_ci95?.[0];
    else observed = attr.per_class[c.class]?.[c.metric];
    if (observed === null || observed === undefined) return { ...base, result: 'insufficient_data', observed: null, n };
    const pass = (c.min === undefined || observed >= c.min) && (c.max === undefined || observed <= c.max);
    return { ...base, n, observed: Math.round(observed * 1000) / 1000, min: c.min ?? null, max: c.max ?? null,
      used_lower_ci: Boolean(c.use_lower_ci), result: pass ? 'pass' : 'fail' };
  });
}
