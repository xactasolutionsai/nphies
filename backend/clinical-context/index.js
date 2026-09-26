/**
 * Clinical context engine: decides, for each entity mention found by an extractor (NER),
 * whether it is asserted present / absent / possible / conditional, who it belongs to, when
 * it applies, and for medications whether the drug is current, stopped, proposed or past.
 *
 * Deterministic and dependency-free: same input, same output; no network, no database,
 * no model. It never adds entities, doses or units that are not written in the text. When
 * the rules disagree it answers `unknown` and asks for human review.
 *
 * English only. Arabic or mixed Arabic/English text is refused (LanguageNotSupportedError)
 * until an Arabic trigger set is written and evaluated on annotated data.
 */
import { TRIGGERS, TERMINATORS, WINDOW, SECTIONS } from './lexicon.js';
import { readMedicationDetails, readMeasurements, readDates, readAllergyStatements } from './details.js';

export const ENGINE = Object.freeze({
  name: 'nafes-clinical-context',
  version: '1.0.0',
  method: 'rule-based trigger and scope (NegEx/ConText-style); project-authored English trigger lists',
  languages: ['en']
});

export const ENTITY_TYPES = Object.freeze(['problem', 'medication', 'allergy', 'procedure']);
export const MAX_TEXT_LENGTH = 12000;
export const MAX_ENTITIES = 500;

const NOTICE = 'Rule-based context output for human review. Values are not a clinical probability, '
  + 'not a diagnosis and not a prescription. Entity recognition and context rules are not validated '
  + 'on hospital data.';

export class LanguageNotSupportedError extends Error {
  constructor() {
    super('Arabic or mixed-language text is not supported by the clinical context engine; review manually');
    this.name = 'LanguageNotSupportedError';
    this.status = 422;
  }
}

const ARABIC = /[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]/u;
const L = '(?<![A-Za-z0-9])', R = '(?![A-Za-z0-9])';
const escape = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const phraseSource = p => escape(p).replace(/\s+/g, '\\s+');

const COMPILED_TRIGGERS = TRIGGERS.map(t => ({
  ...t,
  regex: new RegExp(`${L}(?:${t.re ? t.p : phraseSource(t.p)})${R}`, 'gi')
}));
const COMPILED_TERMINATORS = Object.fromEntries(Object.entries(TERMINATORS).map(([cat, words]) =>
  [cat, new RegExp(`${L}(?:${words.map(phraseSource).sort((a, b) => b.length - a.length).join('|')})${R}`, 'gi')]));
const SECTION_REGEX = new RegExp(`${L}(?:${SECTIONS.flatMap(s => s.names).map(phraseSource)
  .sort((a, b) => b.length - a.length).join('|')})\\s*:`, 'gi');
const SECTION_BY_NAME = new Map(SECTIONS.flatMap(s => s.names.map(n => [n, s])));

// ---------------------------------------------------------------- text structure

/** Sentence spans. Boundaries: . ! ? ; and newlines; not decimals or dotted abbreviations (b.i.d.). */
function sentences(text) {
  const out = [];
  let start = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    let boundary = c === '\n' || c === ';'
      || ((c === '!' || c === '?') && (i + 1 === text.length || /\s/.test(text[i + 1])));
    if (c === '.') {
      const next = text[i + 1];
      const word = text.slice(0, i + 1).match(/\S+$/)?.[0] || '';
      const decimal = /\d/.test(text[i - 1] || '') && /\d/.test(next || '');
      const dotted = /^(?:[A-Za-z]\.){2,}$/.test(word) || /^(?:vs|e\.g|i\.e|dr|approx|no)\.$/i.test(word);
      boundary = !decimal && !dotted && (next === undefined || /\s/.test(next));
    }
    if (boundary) {
      out.push({ start, end: i + 1 });
      start = i + 1;
    }
  }
  if (start < text.length) out.push({ start, end: text.length });
  return out;
}

function sectionScopes(text, sents) {
  const found = [];
  for (const m of text.matchAll(SECTION_REGEX)) {
    const lineStart = text.lastIndexOf('\n', m.index - 1) + 1;
    const sent = sents.find(s => s.start <= m.index && m.index < s.end);
    const before = text.slice(Math.max(lineStart, sent?.start ?? 0), m.index);
    if (before.trim() !== '') continue;           // a header starts a line or a sentence
    const name = m[0].replace(/\s*:$/, '').replace(/\s+/g, ' ').toLowerCase();
    found.push({ section: SECTION_BY_NAME.get(name), header: { start: m.index, end: m.index + m[0].length } });
  }
  return found.map((f, i) => {
    const lineEnd = text.indexOf('\n', f.header.end);
    const restOfLine = text.slice(f.header.end, lineEnd < 0 ? text.length : lineEnd);
    let end;
    if (restOfLine.trim() === '') {
      // Header alone on its line: the section runs to the next header or blank line.
      const nextHeader = found[i + 1]?.header.start ?? text.length;
      const blank = text.slice(f.header.end).search(/\n\s*\n/);
      end = Math.min(nextHeader, blank < 0 ? text.length : f.header.end + blank);
    } else {
      // Content on the header line: the section is the header's sentence.
      end = sents.find(s => s.start <= f.header.start && f.header.start < s.end)?.end ?? text.length;
    }
    return { kind: f.section.kind, set: f.section.set, start: f.header.end, end, header: f.header };
  });
}

function overlaps(a, b) {
  return a.start < b.end && b.start < a.end;
}

/** Accept trigger matches longest-first; identical spans may carry several categories. */
function matchTriggers(text, entities) {
  const all = [];
  for (const t of COMPILED_TRIGGERS) {
    for (const m of text.matchAll(t.regex)) {
      const span = { start: m.index, end: m.index + m[0].length };
      if (entities.some(e => overlaps(e, span))) continue;
      all.push({ ...t, text: m[0], ...span });
    }
  }
  all.sort((a, b) => (b.end - b.start) - (a.end - a.start) || a.start - b.start);
  const accepted = [];
  for (const m of all) {
    const clash = accepted.find(a => overlaps(a, m));
    if (!clash || (clash.start === m.start && clash.end === m.end)) accepted.push(m);
  }
  return accepted.filter(t => t.cat !== 'pseudo').sort((a, b) => a.start - b.start);
}

function wordsForward(text, pos, n, limit) {
  const re = /\S+/g;
  re.lastIndex = pos;
  let end = pos, count = 0, m;
  while (count < n && (m = re.exec(text)) && m.index < limit) {
    end = m.index + m[0].length;
    count++;
  }
  return Math.min(count < n ? limit : end, limit);
}

function wordsBackward(text, pos, n, limit) {
  const words = [...text.slice(limit, pos).matchAll(/\S+/g)];
  return words.length <= n ? limit : limit + words[words.length - n].index;
}

function terminatorPositions(text, cat, sent, blocked) {
  return [...text.slice(sent.start, sent.end).matchAll(COMPILED_TERMINATORS[cat])]
    .map(m => ({ start: sent.start + m.index, end: sent.start + m.index + m[0].length }))
    .filter(p => !blocked.some(b => overlaps(b, p)));
}

/** Scopes of every trigger, clipped to its sentence, window, terminators and same-category triggers. */
function triggerScopes(text, triggers, sents, entities) {
  const blocked = [...triggers, ...entities];
  return triggers.flatMap(t => {
    const sent = sents.find(s => s.start <= t.start && t.start < s.end);
    const terms = terminatorPositions(text, t.cat, sent, blocked);
    const sameCat = triggers.filter(o => o !== t && o.cat === t.cat && sent.start <= o.start && o.start < sent.end
      && !(o.start === t.start && o.end === t.end));
    const scopes = [];
    if (t.dir === 'pre' || t.dir === 'both') {
      const window = t.cat === 'allergy' ? WINDOW.allergyPre : WINDOW.pre;
      let end = wordsForward(text, t.end, window, sent.end);
      for (const p of [...terms, ...sameCat]) if (p.start >= t.end && p.start < end) end = p.start;
      scopes.push({ trigger: t, start: t.end, end });
    }
    if (t.dir === 'post' || t.dir === 'both') {
      const window = t.dir === 'both' ? WINDOW.bothBackward : WINDOW.post;
      let start = wordsBackward(text, t.start, window, sent.start);
      for (const p of [...terms, ...sameCat]) if (p.end <= t.start && p.end > start) start = p.end;
      if (t.dir === 'both') {
        // Bidirectional triggers do not reach back across a list separator.
        const sep = text.slice(start, t.start).search(/,[^,]*$|\band\b(?![\s\S]*\band\b)/i);
        if (sep >= 0) start = start + sep + 1;
      }
      scopes.push({ trigger: t, start, end: t.start });
    }
    return scopes;
  });
}

// ---------------------------------------------------------------- per-entity decisions

function decide(values, fallback) {
  const distinct = [...new Set(values)];
  if (distinct.length === 0) return { value: fallback, competing: false };
  if (distinct.length === 1) return { value: distinct[0], competing: false };
  return { value: 'unknown', competing: true };
}

function questionMark(text, entity, sent) {
  const after = text.slice(entity.end, sent.end).match(/^\s*\?/);
  // "?pneumonia": the question mark is written directly against the mention
  const before = text.slice(sent.start, entity.start).match(/(?:^|\s)\?$/);
  const m = after
    ? { start: entity.end + after[0].indexOf('?'), end: entity.end + after[0].length }
    : before ? { start: entity.start - 1, end: entity.start } : null;
  return m ? { cat: 'assertion', v: 'possible', text: '?', start: m.start, end: m.end, p: '?', dir: after ? 'post' : 'pre' } : null;
}

function validate(text, entities) {
  if (typeof text !== 'string' || text.trim() === '' || text.length > MAX_TEXT_LENGTH) {
    throw Object.assign(new Error(`Text must be 1-${MAX_TEXT_LENGTH} characters`), { status: 400 });
  }
  if (ARABIC.test(text)) throw new LanguageNotSupportedError();
  if (!Array.isArray(entities) || entities.length > MAX_ENTITIES) {
    throw Object.assign(new Error(`At most ${MAX_ENTITIES} entities are accepted`), { status: 400 });
  }
  for (const e of entities) {
    if (!ENTITY_TYPES.includes(e?.type)) {
      throw Object.assign(new Error(`Unsupported entity type: ${String(e?.type)}`), { status: 400 });
    }
    if (!Number.isInteger(e.start) || !Number.isInteger(e.end) || e.start < 0 || e.end <= e.start
      || e.end > text.length || text.slice(e.start, e.end) !== e.text) {
      throw Object.assign(new Error('Entity span does not match the source text'), { status: 400 });
    }
  }
}

const evidenceOf = (attribute, value, t) => ({
  attribute, value, source: 'trigger', trigger: t.text, start: t.start, end: t.end,
  rule_id: `${t.cat}:${t.v}:${t.dir}:${t.p}`, ...(t.variant ? { variant: t.variant } : {})
});

/**
 * Annotate NER entities with clinical context.
 * @param {string} text  source text (English)
 * @param {Array<{text,start,end,type,source?}>} entities  spans from the extractor; `source`
 *   ({ extractor, model, revision, confidence }) is carried through unchanged
 */
export function annotate(text, entities = []) {
  validate(text, entities);
  const sents = sentences(text);
  const sections = sectionScopes(text, sents);
  const headerSpans = sections.map(s => s.header);
  const triggers = matchTriggers(text, [...entities, ...headerSpans]);
  const scopes = triggerScopes(text, triggers, sents, entities);
  const ordered = entities.map((e, i) => ({ ...e, index: i })).sort((a, b) => a.start - b.start);

  const results = entities.map((entity, index) => {
    const sent = sents.find(s => s.start <= entity.start && entity.start < s.end) || { start: 0, end: text.length };
    const applies = t => !t.types || t.types.includes(entity.type);
    const hits = scopes.filter(s => applies(s.trigger) && s.start <= entity.start && entity.end <= s.end)
      .map(s => s.trigger);
    const q = questionMark(text, entity, sent);
    if (q) hits.push(q);
    const byCat = cat => hits.filter(t => t.cat === cat);
    const inSections = sections.filter(s => s.start <= entity.start && entity.end <= s.end);
    const sectionValue = attr => inSections.map(s => s.set[attr]).filter(Boolean);
    const evidence = [];
    const reasons = [];

    const pick = (attr, cat, fallback) => {
      const trig = byCat(cat);
      if (trig.length) {
        trig.forEach(t => evidence.push(evidenceOf(attr, t.v, t)));
        const d = decide(trig.map(t => t.v), fallback);
        if (d.competing) reasons.push(`competing_triggers:${attr}`);
        return d.value;
      }
      const fromSection = sectionValue(attr === 'medication_status' ? 'med_status' : attr);
      if (fromSection.length) {
        inSections.filter(s => s.set[attr === 'medication_status' ? 'med_status' : attr]).forEach(s =>
          evidence.push({ attribute: attr, value: s.set[attr === 'medication_status' ? 'med_status' : attr],
            source: 'section', trigger: text.slice(s.header.start, s.header.end), start: s.header.start,
            end: s.header.end, rule_id: `section:${s.kind}` }));
        const d = decide(fromSection, fallback);
        if (d.competing) reasons.push(`competing_sections:${attr}`);
        return d.value;
      }
      evidence.push({ attribute: attr, value: fallback, source: 'default', rule_id: `default:${attr}` });
      return fallback;
    };

    // Allergy: a medication mention inside an allergy trigger or section is an allergy record.
    const allergyTriggers = byCat('allergy');
    const allergySection = entity.type === 'medication'
      ? inSections.find(s => s.set.allergy) : null;
    const isAllergy = entity.type === 'allergy' || allergyTriggers.length > 0 || Boolean(allergySection);
    const type = isAllergy ? 'allergy' : entity.type;

    const assertionValues = byCat('assertion').map(t => t.v);
    byCat('assertion').forEach(t => evidence.push(evidenceOf('assertion', t.v, t)));
    allergyTriggers.forEach(t => { assertionValues.push(t.v); evidence.push(evidenceOf('assertion', t.v, t)); });
    let assertion;
    if (assertionValues.length) {
      const d = decide(assertionValues, 'present');
      if (d.competing) reasons.push('competing_triggers:assertion');
      assertion = d.value;
    } else {
      const fromSection = sectionValue('assertion');
      if (fromSection.length) {
        assertion = decide(fromSection, 'present').value;
        inSections.filter(s => s.set.assertion).forEach(s => evidence.push({ attribute: 'assertion',
          value: s.set.assertion, source: 'section', trigger: text.slice(s.header.start, s.header.end),
          start: s.header.start, end: s.header.end, rule_id: `section:${s.kind}` }));
      } else {
        assertion = 'present';
        evidence.push({ attribute: 'assertion', value: 'present', source: 'default', rule_id: 'default:assertion' });
      }
    }

    const experiencer = pick('experiencer', 'experiencer', 'patient');

    const out = {
      index, text: entity.text, start: entity.start, end: entity.end, type,
      extracted_type: entity.type, extractor: entity.source ?? null,
      sentence: { start: sent.start, end: sent.end },
      assertion, experiencer, temporality: null,
      normalized: null, normalization_status: 'not_configured',
      method: 'rule', evidence, missing: [], needs_review: false, review_reasons: reasons
    };

    if (type === 'medication') {
      const status = pick('medication_status', 'med_status', 'unknown');
      const next = ordered.find(o => o.start >= entity.end && o.index !== index);
      const windowEnd = Math.min(sent.end, next ? next.start : sent.end, entity.end + 120);
      const details = readMedicationDetails(text.slice(entity.end, windowEnd), entity.end);
      out.medication = { status, dose: details.dose, unit: details.unit, route: details.route,
        frequency: details.frequency, duration: details.duration, detail_spans: details.spans };
      out.temporality = { current: 'current', proposed: 'future', historical: 'historical',
        discontinued: 'historical' }[status] ?? 'unknown';
      if (details.dose && !details.unit) reasons.push('dose_without_unit');
      if (assertion === 'present' && (status === 'current' || status === 'proposed')) {
        out.missing = ['dose', 'unit', 'route', 'frequency'].filter(k => out.medication[k] === null);
      }
      if (status === 'unknown') reasons.push('medication_status_unknown');
    } else if (type === 'allergy') {
      const t = allergyTriggers[0];
      out.allergy = {
        substance: entity.text,
        verification: 'unverified',
        evidence: t ? { trigger: t.text, start: t.start, end: t.end }
          : allergySection ? { trigger: text.slice(allergySection.header.start, allergySection.header.end),
            start: allergySection.header.start, end: allergySection.header.end }
            : { trigger: null, source: 'extractor_label' }
      };
      out.temporality = 'current';
    } else {
      out.temporality = pick('temporality', 'temporality', 'current');
    }

    if (assertion === 'unknown' || experiencer === 'unknown' || out.temporality === 'unknown') {
      reasons.push('context_not_determined');
    }
    return out;
  });

  const conflicts = findConflicts(results);
  for (const r of results) {
    r.review_reasons = [...new Set(r.review_reasons)];
    r.needs_review = r.review_reasons.length > 0;
  }

  return {
    engine: ENGINE,
    language: 'en',
    notice: NOTICE,
    entities: results,
    conflicts,
    measurements: readMeasurements(text),
    dates: readDates(text),
    allergy_statements: readAllergyStatements(text),
    summary: summarize(results)
  };
}

/** Same patient finding stated as present and as absent (or a drug as current and stopped). */
function findConflicts(results) {
  const groups = new Map();
  for (const r of results) {
    if (r.experiencer !== 'patient') continue;
    const key = `${r.type}:${r.text.trim().toLowerCase().replace(/\s+/g, ' ')}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(r);
  }
  const conflicts = [];
  for (const [key, group] of groups) {
    const assertions = new Set(group.map(r => r.assertion));
    const statuses = new Set(group.map(r => r.medication?.status).filter(Boolean));
    const assertionConflict = assertions.has('present') && assertions.has('absent');
    const statusConflict = statuses.has('current') && statuses.has('discontinued');
    if (!assertionConflict && !statusConflict) continue;
    conflicts.push({ key, entity_indexes: group.map(r => r.index),
      kind: assertionConflict ? 'present_and_absent' : 'current_and_discontinued' });
    group.forEach(r => r.review_reasons.push('conflicting_mentions'));
  }
  return conflicts;
}

function summarize(results) {
  const item = r => ({ index: r.index, text: r.text });
  const ok = r => !r.needs_review;
  const problem = r => r.type === 'problem' || r.type === 'procedure';
  return {
    patient_problems_present: results.filter(r => problem(r) && ok(r) && r.assertion === 'present'
      && r.experiencer === 'patient' && r.temporality === 'current').map(item),
    patient_history: results.filter(r => problem(r) && ok(r) && r.assertion === 'present'
      && r.experiencer === 'patient' && r.temporality === 'historical').map(item),
    absent_or_excluded: results.filter(r => ok(r) && r.assertion === 'absent' && r.experiencer === 'patient').map(item),
    possible_or_conditional: results.filter(r => ok(r) && ['possible', 'conditional'].includes(r.assertion)).map(item),
    family_history: results.filter(r => r.experiencer === 'family').map(item),
    other_person: results.filter(r => r.experiencer === 'other').map(item),
    current_medications: results.filter(r => r.type === 'medication' && ok(r) && r.assertion === 'present'
      && r.experiencer === 'patient' && r.medication.status === 'current').map(item),
    other_medications: results.filter(r => r.type === 'medication' && !(ok(r) && r.assertion === 'present'
      && r.experiencer === 'patient' && r.medication.status === 'current'))
      .map(r => ({ ...item(r), status: r.medication.status })),
    allergies: results.filter(r => r.type === 'allergy' && r.assertion === 'present').map(item),
    needs_review: results.filter(r => r.needs_review).map(r => ({ ...item(r), reasons: r.review_reasons }))
  };
}
