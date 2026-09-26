/**
 * Checks applied when reference passages are added to the knowledge registry and when a
 * source is approved. Reference knowledge must not contain patient data, and text that reads
 * like instructions to a model is flagged for the approving committee.
 * Results carry positions and kinds only; the matched text is never echoed.
 */

const PHI_PATTERNS = [
  ['national_id', /(?<!\d)[12]\d{9}(?!\d)/g],                                   // Saudi national ID / Iqama
  ['phone', /(?<![\d+])(?:\+?966|0)5\d{8}(?!\d)/g],
  ['email', /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g],
  ['mrn', /\b(?:MRN|medical record (?:number|no\.?)|file (?:no\.?|number))[:#\s]*\d{3,}/gi]
];

const INJECTION_PATTERNS = [
  ['instruction_override', /\b(?:ignore|disregard|forget)\b[^.\n]{0,40}\b(?:previous|prior|above|earlier|all)\b[^.\n]{0,20}\b(?:instructions?|prompts?|rules?|context)\b/i],
  ['prompt_exfiltration', /\b(?:system prompt|developer message|hidden instructions?)\b/i],
  ['role_play', /\byou are (?:now )?(?:an? |the )?(?:ai|assistant|model|chatbot)\b/i],
  ['role_tags', /<\s*\/?\s*(?:system|assistant|user)\s*>/i],
  ['exfiltration_url', /\b(?:send|post|upload|forward)\b[^.\n]{0,60}https?:\/\//i]
];

export function inspectPassage(text) {
  const phi = PHI_PATTERNS.flatMap(([kind, regex]) =>
    [...String(text).matchAll(regex)].map(m => ({ kind, start: m.index, end: m.index + m[0].length })));
  const injection = INJECTION_PATTERNS.filter(([, regex]) => regex.test(String(text))).map(([kind]) => kind);
  return { phi: phi.sort((a, b) => a.start - b.start), injection };
}

export const SUPPORTED_LANGUAGES = Object.freeze(['en']);

/** Reasons a source cannot be approved yet; [] when it can. */
export function approvalProblems(source, passages) {
  if (!SUPPORTED_LANGUAGES.includes(source.language)) return ['language_not_supported'];
  const problems = [];
  for (const field of ['license', 'usage_rights', 'version', 'published_on', 'scope', 'approval_reference']) {
    const value = source[field];
    if (value === null || value === undefined || String(value).trim() === '') problems.push(field);
  }
  if (!Number.isInteger(source.precedence_rank) || source.precedence_rank < 1) problems.push('precedence_rank');
  if (!passages.length) problems.push('no_passages');
  if (passages.some(p => (p.injection_flags || []).length && !p.injection_reviewed)) problems.push('unreviewed_injection_flags');
  return problems;
}
