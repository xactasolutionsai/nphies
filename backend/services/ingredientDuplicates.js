/**
 * Active-ingredient duplication check (deterministic, no language model).
 *
 * Each item's medication code is looked up in medication_codes; its `ingredients` text is
 * normalized (lower case, strengths such as "500 mg" or "4.3 g/ 100 ml" removed, parenthetical
 * qualifiers such as "(as phosphate)" removed, split on , + / ; | and " and "). Findings:
 *   shared_ingredient  two different codes contain the same normalized ingredient
 *   same_code          the same code is used on more than one item
 * Codes missing from medication_codes are listed in `unmatchedCodes` and codes without ingredient
 * data in `codesWithoutIngredients`: the check is then reported incomplete, never "no duplicates".
 * ("|" is included because the NPHIES medication code list separates ingredients with it.)
 */
import { query } from '../db.js';
import { envelope } from './ai/response.js';

const UNIT = '(?:mega\\s*units?|units?|mcg|µg|ug|mg|kg|g|ml|l|iu|u|%|mmol|meq)';
const PER_UNIT = '(?:mg|mcg|kg|g|ml|l|hrs?|h|hours?|doses?|tablets?|tabs?|actuations?|puffs?|sachets?|vials?|amps?)';
const STRENGTH = new RegExp(
  `\\d+(?:[.,]\\d+)?\\s*${UNIT}(?![a-z])(?:\\s*\\/\\s*(?:\\d+(?:[.,]\\d+)?\\s*)?${PER_UNIT}(?![a-z]))?`, 'gi');
const SEPARATORS = /[,+/;|]|\s+and\s+/i;

const unique = values => [...new Set(values)];

/** Normalized ingredient names contained in a medication_codes.ingredients value. */
export function normalizeIngredients(text) {
  if (text === null || text === undefined) return [];
  let value = String(text).toLowerCase().replace(STRENGTH, ' ');
  let previous;
  do { previous = value; value = value.replace(/\([^()]*\)/g, ' '); } while (value !== previous);
  return unique(value.split(SEPARATORS)
    .map(part => part.replace(/[:()[\]]/g, ' ').replace(/\s+/g, ' ').trim())
    .filter(part => part && /[a-z؀-ۿ]/.test(part)));
}

/** Accept ['code', ...] or [{ sequence, code }, ...]; sequence defaults to the 1-based position. */
export function toCodedItems(codes) {
  return (codes || []).map((entry, index) => {
    const code = String((entry && typeof entry === 'object' ? entry.code : entry) ?? '').trim();
    const sequence = Number(entry && typeof entry === 'object' && entry.sequence != null ? entry.sequence : index + 1);
    return { sequence: Number.isInteger(sequence) ? sequence : index + 1, code };
  }).filter(item => item.code);
}

const itemList = sequences => `Items ${sequences.join(', ')}`;

/** Pure part of the check: items [{ sequence, code }] against medication_codes rows. */
export function findDuplicateIngredients(items, rows) {
  const byCode = new Map((rows || []).map(row => [String(row.code), row]));
  const codes = unique(items.map(i => i.code));
  const unmatchedCodes = codes.filter(code => !byCode.has(code));
  const ingredientsOf = new Map(codes.filter(code => byCode.has(code))
    .map(code => [code, normalizeIngredients(byCode.get(code).ingredients)]));
  const codesWithoutIngredients = codes.filter(code => ingredientsOf.has(code) && ingredientsOf.get(code).length === 0);

  const findings = [];
  const byIngredient = new Map();
  for (const item of items) {
    for (const ingredient of ingredientsOf.get(item.code) || []) {
      if (!byIngredient.has(ingredient)) byIngredient.set(ingredient, []);
      byIngredient.get(ingredient).push(item);
    }
  }
  for (const [ingredient, entries] of byIngredient) {
    const entryCodes = unique(entries.map(e => e.code));
    if (entryCodes.length < 2) continue;
    const itemSequences = unique(entries.map(e => e.sequence)).sort((a, b) => a - b);
    findings.push({ type: 'shared_ingredient', severity: 'warn', ingredient, itemSequences, codes: entryCodes,
      message: `${itemList(itemSequences)} contain the same active ingredient (${ingredient}).` });
  }
  for (const code of codes) {
    const sameCode = items.filter(i => i.code === code);
    if (sameCode.length < 2) continue;
    const itemSequences = unique(sameCode.map(i => i.sequence)).sort((a, b) => a - b);
    const ingredients = ingredientsOf.get(code) || [];
    findings.push({ type: 'same_code', severity: 'warn', ingredient: ingredients.length ? ingredients.join(', ') : null,
      itemSequences, codes: [code], message: `${itemList(itemSequences)} use the same medication code (${code}).` });
  }
  return { findings, unmatchedCodes, codesWithoutIngredients };
}

/** Query medication_codes for the items' codes and return the findings in the standard envelope. */
export async function checkDuplicateIngredients(items, { queryFn = query } = {}) {
  const codes = unique(items.map(i => i.code));
  const rows = codes.length
    ? (await queryFn('SELECT code, display, ingredients FROM medication_codes WHERE code = ANY($1)', [codes])).rows
    : [];
  const result = findDuplicateIngredients(items, rows);
  const complete = result.unmatchedCodes.length === 0 && result.codesWithoutIngredients.length === 0;
  return envelope({
    source: 'rules',
    certainty: complete ? 'high' : 'medium',
    basis: {
      description: 'Active ingredients from medication_codes.ingredients (local NPHIES medication code list), ' +
        'normalized and compared between items. Codes not found or without ingredient data could not be checked.',
      codesChecked: codes.length,
      codesMatched: rows.length
    },
    complete,
    ...result
  });
}
