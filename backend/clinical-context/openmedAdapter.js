/**
 * Maps OpenMed NER output (backend/openmed/worker.py) to clinical-context entities.
 * The OpenMed mode decides the entity type; the model's label and score are carried
 * through as extractor metadata. The score is a token-classification score, not a
 * probability that the patient has the condition or takes the drug.
 */
import { annotate, ENGINE } from './index.js';

export const MODE_TYPES = Object.freeze({ medications: 'medication', diseases: 'problem' });

export function entitiesFromOpenMed(result, mode) {
  const type = MODE_TYPES[mode];
  if (!type) throw Object.assign(new Error('Unsupported OpenMed mode'), { status: 400 });
  return (result?.entities ?? []).map(e => ({
    text: e.text, start: e.start, end: e.end, type,
    source: {
      extractor: 'openmed', mode, model: result.model?.id ?? null, revision: result.model?.revision ?? null,
      label: e.label ?? null, score: typeof e.confidence === 'number' ? e.confidence : null,
      score_meaning: 'model token-classification score; not a clinical probability'
    }
  }));
}

/**
 * Context for an OpenMed result. Never throws: a failure is returned as
 * { status: 'failed' } so the caller stores the analysis as needing manual review
 * instead of presenting un-contextualised entities as findings.
 */
export function contextForOpenMed(text, result, mode) {
  try {
    return { status: 'ok', ...annotate(text, entitiesFromOpenMed(result, mode)) };
  } catch (error) {
    return { status: 'failed', engine: ENGINE, reason: error.name === 'LanguageNotSupportedError'
      ? 'language_not_supported' : 'context_rules_failed' };
  }
}
