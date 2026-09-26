/**
 * Extractive, evidence-backed summary of one analysed note.
 *
 * Three sections are kept apart and never mixed:
 *   patient_data         facts from the clinical-context output, each with its source span
 *   reference_knowledge  approved passages quoted verbatim, each with its citation
 *   inference            always empty in extractive mode (nothing is concluded for the user)
 * When no approved passage exists for a finding, the summary abstains for that finding.
 * No model is used. The generator field records that.
 */

export const SUMMARY_VERSION = '1.0.0';

const MEDICATION_TERM_STATUSES = new Set(['current', 'proposed']);

function categoryOf(e) {
  if (e.needs_review) return 'needs_review';
  if (e.experiencer === 'family') return 'family';
  if (e.experiencer === 'other') return 'other_person';
  if (e.type === 'allergy') return e.assertion === 'present' ? 'allergy' : e.assertion === 'absent' ? 'allergy_absent' : 'needs_review';
  if (e.assertion === 'absent') return 'absent';
  if (e.assertion === 'possible' || e.assertion === 'conditional') return 'possible';
  if (e.type === 'medication') return e.medication.status === 'current' ? 'medication_current' : 'medication_other';
  if (e.temporality === 'historical') return 'problem_history';
  if (e.temporality === 'future') return 'planned';
  return 'problem_present';
}

/** Patient facts with stable ids (P1, P2, ...) in text order. */
export function patientFacts(context, text) {
  if (!context || context.status === 'failed') return [];
  const facts = [...context.entities].sort((a, b) => a.start - b.start).map(e => {
    const fact = {
      category: categoryOf(e), text: e.text, quote: text.slice(e.start, e.end), start: e.start, end: e.end,
      entity_index: e.index, sentence: e.sentence,
      attributes: { assertion: e.assertion, experiencer: e.experiencer, temporality: e.temporality }
    };
    if (e.medication) {
      fact.status = e.medication.status;
      fact.attributes.medication = Object.fromEntries(['dose', 'unit', 'route', 'frequency', 'duration']
        .map(k => [k, e.medication[k]]));
    }
    if (e.needs_review) fact.review_reasons = e.review_reasons;
    return fact;
  });
  for (const m of context.measurements || []) {
    facts.push({ category: 'measurement', text: m.text, quote: text.slice(m.start, m.end), start: m.start, end: m.end,
      kind: m.kind, value: m.value, unit: m.unit });
  }
  for (const s of context.allergy_statements || []) {
    facts.push({ category: 'allergy_statement', text: s.statement, quote: text.slice(s.start, s.end), start: s.start, end: s.end });
  }
  return facts.sort((a, b) => a.start - b.start).map((f, i) => ({ id: `P${i + 1}`, ...f }));
}

/** Retrieval terms: positive patient findings only (never negated, family or uncertain mentions). */
export function queryTerms(facts, max = 12) {
  const terms = facts.filter(f => ['problem_present', 'problem_history', 'medication_current', 'allergy'].includes(f.category)
    || (f.category === 'medication_other' && MEDICATION_TERM_STATUSES.has(f.status)))
    .map(f => f.text.trim().toLowerCase());
  return [...new Set(terms)].slice(0, max);
}

function gapsOf(context) {
  const gaps = [];
  for (const c of context.conflicts || []) gaps.push({ kind: 'conflict', entity_indexes: c.entity_indexes, detail: c.kind });
  for (const e of context.entities) {
    if (e.needs_review) gaps.push({ kind: 'needs_review', entity_index: e.index, text: e.text, reasons: e.review_reasons });
    if (e.missing?.length) gaps.push({ kind: 'missing_medication_detail', entity_index: e.index, text: e.text, fields: e.missing });
  }
  for (const m of context.measurements || []) {
    if (!m.unit) gaps.push({ kind: 'measurement_without_unit', start: m.start, end: m.end, measurement: m.kind });
  }
  for (const d of context.dates || []) {
    if (d.ambiguous) gaps.push({ kind: 'ambiguous_date', start: d.start, end: d.end });
  }
  return gaps;
}

const POLICY = 'Passages are ordered by the hospital-approved precedence rank of their source. Differences '
  + 'between sources are not resolved automatically: when several sources apply, review all of them.';

/**
 * @param {object} args.context   clinical-context output stored with the analysis
 * @param {string} args.text      the analysed note
 * @param {Array<{term, passages}>} args.retrieval  approved passages found per term
 */
export function buildSummary({ context, text, retrieval = [] }) {
  const base = { summary_version: SUMMARY_VERSION, generator: { mode: 'extractive', model: null },
    inference: [], inference_note: 'No inference is generated in extractive mode.' };
  if (!context || context.status === 'failed' || !Array.isArray(context.entities)) {
    return { ...base, status: 'unavailable', reason: context?.reason || 'no_context', patient_data: [],
      reference_knowledge: [], abstentions: [], gaps: [{ kind: 'context_unavailable' }] };
  }
  const reference = [], abstentions = [];
  for (const { term, passages } of retrieval) {
    if (!passages?.length) { abstentions.push({ term, reason: 'no_approved_evidence' }); continue; }
    const ordered = [...passages].sort((a, b) => (a.source.precedence_rank - b.source.precedence_rank)
      || ((b.rank ?? 0) - (a.rank ?? 0)));
    reference.push({
      term,
      multiple_sources: new Set(ordered.map(p => p.source.id)).size > 1,
      policy: POLICY,
      passages: ordered.map(p => ({
        passage_id: p.passage_id, quote: p.text, section: p.section ?? null, locator: p.locator ?? null,
        citation: { source_id: p.source.id, source_title: p.source.title, publisher: p.source.publisher,
          version: p.source.version, published_on: p.source.published_on, reviewed_on: p.source.reviewed_on,
          license: p.source.license, precedence_rank: p.source.precedence_rank }
      }))
    });
  }
  return {
    ...base, status: 'ok', context_engine: context.engine?.version ?? null,
    patient_data: patientFacts(context, text), reference_knowledge: reference, abstentions, gaps: gapsOf(context)
  };
}
