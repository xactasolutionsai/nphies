/**
 * Descriptions for NPHIES codes shown by the analytics (deterministic lookups only).
 *
 * Order: docs/"nphies CodeSystems.csv" (official; matched by system + code, or by code alone when
 * no system is known and the code is unique in the file), then the local nphies_codes table (only
 * when that code has a single display). Anything else is reported with UNKNOWN_CODE_NOTE: the
 * CSV lists the adjudication-error and adjudication-reason systems but their codes live in
 * appendices that are not in the file, and the published adjudication-error list is a fragment.
 */
import fs from 'node:fs/promises';
import { query } from '../../db.js';

export const CODE_SYSTEMS_CSV = new URL('../../../docs/nphies CodeSystems.csv', import.meta.url);
export const CSV_SOURCE = 'nphies CodeSystems.csv (official)';
export const TABLE_SOURCE = 'nphies_codes (local table)';
export const UNKNOWN_CODE_NOTE =
  'Code not in local code list (the official adjudication-error list is a published fragment).';

/** RFC 4180 CSV parser (quoted fields may contain commas, "" and newlines). */
export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  const input = String(text).replace(/^﻿/, '');
  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (quoted) {
      if (ch === '"' && input[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { row.push(field); field = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && input[i + 1] === '\n') i++;
      row.push(field); rows.push(row); row = []; field = '';
    } else field += ch;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows;
}

let cachedIndex = null;

/**
 * Map "<system>|<code>" -> display from the CSV (system is carried down from the row that
 * names it). `index.byCode` maps a code to every { system, display } that uses it.
 */
export async function loadCodeSystemIndex(file = CODE_SYSTEMS_CSV) {
  if (cachedIndex && file === CODE_SYSTEMS_CSV) return cachedIndex;
  const index = new Map();
  index.byCode = new Map();
  let text = '';
  try {
    text = await fs.readFile(file, 'utf8');
  } catch (error) {
    console.error('[AI] Code system CSV is not readable:', error.message);
  }
  const rows = parseCsv(text);
  const header = rows[0] || [];
  const systemCol = header.indexOf('code system');
  const codeCol = header.indexOf('code');
  const displayCol = header.indexOf('Display');
  let system = null;
  for (const row of rows.slice(1)) {
    if (row[systemCol]) system = row[systemCol].trim();
    const code = (row[codeCol] || '').trim();
    const display = (row[displayCol] || '').trim();
    if (!system || !code || code === '---' || !display || display === '---') continue;
    index.set(`${system}|${code}`, display);
    if (!index.byCode.has(code)) index.byCode.set(code, []);
    index.byCode.get(code).push({ system, display });
  }
  if (file === CODE_SYSTEMS_CSV) cachedIndex = index;
  return index;
}

export const codeKey = ({ code, system }) => `${system || ''}|${code}`;

/**
 * Describe a list of { code, system? }. Returns Map codeKey -> { description, descriptionSource }
 * or { description: null, descriptionSource: null, note: UNKNOWN_CODE_NOTE }.
 */
export async function describeCodes(entries, { queryFn = query, index } = {}) {
  const csv = index || await loadCodeSystemIndex();
  const result = new Map();
  const missing = [];
  for (const entry of entries) {
    const key = codeKey(entry);
    if (result.has(key)) continue;
    let display = entry.system ? csv.get(`${entry.system}|${entry.code}`) : undefined;
    if (!display && !entry.system) {
      const matches = csv.byCode?.get(entry.code) || [];
      if (new Set(matches.map(m => m.display)).size === 1) display = matches[0].display;
    }
    if (display) result.set(key, { description: display, descriptionSource: CSV_SOURCE });
    else missing.push(entry);
  }
  let local = new Map();
  const codes = [...new Set(missing.map(e => e.code))];
  if (codes.length) {
    try {
      const rows = (await queryFn(`
        SELECT code, MIN(display_en) AS display_en FROM nphies_codes
        WHERE code = ANY($1) AND is_active IS NOT FALSE
        GROUP BY code HAVING COUNT(DISTINCT display_en) = 1
      `, [codes])).rows;
      local = new Map(rows.map(r => [r.code, r.display_en]));
    } catch (error) {
      // The table is optional (not every deployment imported the code tables).
      if (error.code !== '42P01') console.error('[AI] nphies_codes lookup failed:', error.message);
    }
  }
  for (const entry of missing) {
    const display = local.get(entry.code);
    result.set(codeKey(entry), display
      ? { description: display, descriptionSource: TABLE_SOURCE }
      : { description: null, descriptionSource: null, note: UNKNOWN_CODE_NOTE });
  }
  return result;
}
