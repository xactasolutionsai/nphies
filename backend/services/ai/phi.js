/**
 * PHI minimization for anything that may be sent to a language model, stored in the AI
 * audit log or shown in an AI panel (AI spec, principle 4).
 *
 * redactText() replaces:
 *   - e-mail addresses                                  -> [EMAIL]
 *   - international (+ / 00966) and Saudi phone numbers -> [PHONE]
 *   - Saudi national ID / iqama (10 digits, 1 or 2 first) -> [NATIONAL_ID]
 *   - "MRN: X", "medical record number X", "file no X"  -> [MRN]
 *   - identifiers passed by the caller (MRN, member id)  -> [ID]
 *   - patient names passed by the caller (full name and each part of 3+ letters) -> [NAME]
 * Codes (ICD-10, GTIN, NPHIES error codes) and amounts are left alone.
 *
 * Only free-text values are redacted. Structural fields (FHIR paths, keys, codes, systems,
 * urls, profiles: STRUCTURAL_KEYS) are never passed through redactText, because a name part
 * such as "Patient" would otherwise turn "patient-history" into "[NAME]-history". Such fields
 * are only checked by redactExactValue: a value that IS a known identifier or full name.
 *
 * Send age/gender (minimizePatient) instead of name and date of birth.
 */

const escapeRegExp = value => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const PATTERNS = [
  [/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[EMAIL]'],
  [/(?:\+\d|\b00966)[\d\s-]{7,15}\d(?!\d)/g, '[PHONE]'],
  [/(?<!\d)[12]\d{9}(?!\d)/g, '[NATIONAL_ID]'],
  [/(?<!\d)(?:966|0)5\d{8}(?!\d)/g, '[PHONE]'],
  [/(?<!\d)01\d{7,8}(?!\d)/g, '[PHONE]'],
  [/\b(MRN|medical record(?: number| no\.?)?|file (?:no\.?|number))(\s*[:#-]?\s*)(?!\[)[A-Z0-9][A-Z0-9-]{2,}/gi, '$1$2[MRN]']
];

function nameVariants(names) {
  const variants = new Set();
  for (const name of names || []) {
    const full = String(name || '').trim();
    if (full.length < 3) continue;
    variants.add(full);
    for (const part of full.split(/[\s\-_,.]+/)) {
      if (part.length >= 3) variants.add(part);
    }
  }
  // Longest first so a full name is replaced before its parts.
  return [...variants].sort((a, b) => b.length - a.length);
}

export function redactText(text, { names = [], identifiers = [] } = {}) {
  if (text === null || text === undefined) return text;
  let out = String(text);
  for (const id of identifiers || []) {
    const value = String(id ?? '').trim();
    if (value.length >= 3) out = out.replace(new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegExp(value)}(?![\\p{L}\\p{N}])`, 'giu'), '[ID]');
  }
  for (const variant of nameVariants(names)) {
    out = out.replace(new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegExp(variant)}(?![\\p{L}\\p{N}])`, 'giu'), '[NAME]');
  }
  for (const [pattern, replacement] of PATTERNS) out = out.replace(pattern, replacement);
  return out;
}

/** Object keys whose string values are structural (paths, codes, systems), not free text. */
export const STRUCTURAL_KEYS = new Set(['path', 'key', 'code', 'system', 'url', 'profile', 'resourceType']);

/**
 * Redaction for a structural value (code, system, path segment): replaced only when the whole
 * value equals a known identifier ([ID]) or a known full name ([NAME]), case-insensitively.
 * No substring, name-part or pattern matching, so codes like "patient-history" stay intact.
 */
export function redactExactValue(value, { names = [], identifiers = [] } = {}) {
  if (typeof value !== 'string') return value;
  const text = value.trim().toLowerCase();
  if (!text) return value;
  if ((identifiers || []).some(id => String(id ?? '').trim().toLowerCase() === text)) return '[ID]';
  if ((names || []).some(name => String(name ?? '').trim().length >= 3 && String(name).trim().toLowerCase() === text)) return '[NAME]';
  return value;
}

/**
 * Redact every free-text string inside an object/array (returns a copy). String values under a
 * STRUCTURAL_KEYS key (and arrays of them) only get redactExactValue.
 */
export function redactDeep(value, options = {}, structural = false) {
  if (typeof value === 'string') return structural ? redactExactValue(value, options) : redactText(value, options);
  if (Array.isArray(value)) return value.map(v => redactDeep(v, options, structural));
  if (value && typeof value === 'object' && !(value instanceof Date)) {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, redactDeep(v, options, STRUCTURAL_KEYS.has(k))]));
  }
  return value;
}

/** True when redactText would change the text (used as a guard before sending or storing). */
export function containsPhi(text, options = {}) {
  if (text === null || text === undefined) return false;
  const value = typeof text === 'string' ? text : JSON.stringify(text);
  return redactText(value, options) !== value;
}

/** Whole years between a birth date and `now` (UTC), or null when the date is unusable. */
export function ageFromBirthDate(birthDate, now = new Date()) {
  if (!birthDate) return null;
  const birth = birthDate instanceof Date ? birthDate : new Date(`${String(birthDate).slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(birth.getTime())) return null;
  let age = now.getUTCFullYear() - birth.getUTCFullYear();
  const beforeBirthday = now.getUTCMonth() < birth.getUTCMonth() ||
    (now.getUTCMonth() === birth.getUTCMonth() && now.getUTCDate() < birth.getUTCDate());
  if (beforeBirthday) age--;
  return age >= 0 && age < 150 ? age : null;
}

/** The only patient attributes an LLM prompt may carry. */
export function minimizePatient(patient = {}, now = new Date()) {
  return {
    age: ageFromBirthDate(patient.birth_date ?? patient.birthDate ?? patient.date_of_birth, now),
    gender: patient.gender || null
  };
}
