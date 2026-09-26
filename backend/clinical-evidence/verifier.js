/**
 * Verifier for any future generated (LLM) answer. No generator is enabled; this is the gate
 * such an answer must pass before it can be shown. It fails closed.
 *
 * Expected answer shape:
 *   { sentences: [{ text, citations: [{ type: 'patient'|'passage'|'note', id?, quote }] }] }
 * Rules per sentence:
 *   - at least one citation; every cited id exists in the material given to the generator
 *     (patient facts of this analysis, retrieved approved passages) - nothing from elsewhere;
 *   - every quote appears verbatim (whitespace/case-insensitive) in what it cites;
 *   - every number in the sentence appears in one of its quotes (doses are not rewritten);
 *   - a sentence about the patient needs a patient or note citation (reference text alone
 *     cannot establish a patient fact - this is what stops injected passages);
 *   - a negated, family, uncertain or stopped fact can only be cited by a sentence that
 *     says so.
 * Retrieved passages are data, not instructions: their content can only be quoted.
 */

const norm = s => String(s ?? '').replace(/\s+/g, ' ').trim().toLowerCase();
const PATIENT_WORDS = /\b(?:patient|pt|he|she|his|her|they)\b/i;
const CUES = {
  absent: /\b(?:no|not|denies|denied|without|absent|negative|ruled out|excluded)\b/i,
  allergy_absent: /\b(?:no|not|denies|without)\b/i,
  family: /\b(?:mother|father|family|brother|sister|parent|grand\w*|aunt|uncle|cousin|son|daughter)\b/i,
  other_person: /\b(?:wife|husband|spouse|partner|contact|friend)\b/i,
  possible: /\b(?:possible|possibly|suspected|may|might|could|rule out|unlikely|if|risk)\b|\?/i,
  medication_other: /\b(?:stopped|discontinued|held|previous|previously|no longer|proposed|planned|consider|start)\b/i,
  needs_review: null
};

export function verifyGeneratedAnswer(answer, { facts = [], passages = [], noteText = null } = {}) {
  if (!answer || typeof answer !== 'object' || !Array.isArray(answer.sentences)) {
    return { accepted: false, problems: ['invalid_shape'], sentences: [] };
  }
  if (answer.sentences.length === 0) return { accepted: false, problems: ['empty_answer'], sentences: [] };
  const factById = new Map(facts.map(f => [f.id, f]));
  const passageById = new Map(passages.map(p => [p.passage_id, p]));

  const sentences = answer.sentences.map((s, index) => {
    const problems = [];
    const text = typeof s?.text === 'string' ? s.text : '';
    const citations = Array.isArray(s?.citations) ? s.citations : [];
    if (!text.trim()) problems.push('empty_sentence');
    if (!citations.length) problems.push('no_citation');
    const quotes = [];
    for (const c of citations) {
      let source = null;
      if (c?.type === 'patient') source = factById.get(c.id)?.quote ?? null;
      else if (c?.type === 'passage') source = passageById.get(c.id)?.text ?? null;
      else if (c?.type === 'note') source = noteText;
      if (source === null) { problems.push('unknown_citation'); continue; }
      if (!c.quote || !norm(source).includes(norm(c.quote))) { problems.push('quote_not_found'); continue; }
      quotes.push(norm(c.quote));
      if (c.type === 'patient') {
        const fact = factById.get(c.id);
        if (fact.category === 'needs_review') problems.push('cites_fact_needing_review');
        else if (CUES[fact.category] && !CUES[fact.category].test(text)) problems.push('cites_non_positive_fact');
      }
    }
    for (const n of text.match(/\d+(?:\.\d+)?/g) || []) {
      if (!quotes.some(q => new RegExp(`(?<![\\d.])${n.replace('.', '\\.')}(?![\\d])`).test(q))) {
        problems.push('number_not_in_citations');
        break;
      }
    }
    if (PATIENT_WORDS.test(text) && !citations.some(c => c?.type === 'patient' || c?.type === 'note')) {
      problems.push('patient_claim_needs_patient_citation');
    }
    return { index, problems: [...new Set(problems)] };
  });
  return { accepted: sentences.every(s => s.problems.length === 0), problems: [], sentences };
}
