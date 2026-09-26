#!/usr/bin/env node
/**
 * Turn clinician reviews made during a pilot into development cases for the rules.
 *
 *   node scripts/exportPilotCorrections.js --pilot <uuid> --out pilot-dev.jsonl --i-confirm-authorised-environment
 *
 * - Output split is always 'dev': pilot reviews are single-reviewer and not adjudicated, so
 *   they may guide rule changes but must never be used as validation or test data.
 * - Gold values come only from what the reviewer confirmed: every field of an accepted
 *   analysis, and only the corrected fields of a corrected one (latest review wins).
 * - Records whose text still contains detectable identifiers (ID, phone, e-mail, file number)
 *   are skipped and counted. Names are not detectable: the file holds clinical text and must
 *   stay inside the hospital's authorised environment.
 * Prints counts only.
 */
import fs from 'node:fs';
import path from 'node:path';
import { inspectPassage } from '../clinical-evidence/ingestion.js';

const FIELDS = ['assertion', 'experiencer', 'temporality', 'medication_status', 'type', 'dose', 'unit', 'route', 'frequency', 'duration'];
const current = (entity, field) => (field === 'medication_status' ? entity.medication?.status
  : ['dose', 'unit', 'route', 'frequency', 'duration'].includes(field) ? entity.medication?.[field] : entity[field]);

/** rows: [{ analysis_id, input_text, result, decision, corrections }] — latest review per analysis. */
export function buildCorrectionRecords(rows) {
  const records = [];
  let skippedIdentifiers = 0, skippedNoContext = 0;
  for (const row of rows) {
    const context = row.result?.context;
    if (context?.status !== 'ok' || row.decision === 'rejected') { skippedNoContext += row.decision === 'rejected' ? 0 : 1; continue; }
    if (inspectPassage(row.input_text).phi.length) { skippedIdentifiers++; continue; }
    const entities = context.entities.map(e => {
      const gold = {};
      if (row.decision === 'accepted') {
        for (const f of ['assertion', 'experiencer', 'temporality', 'medication_status']) {
          const v = current(e, f);
          if (v !== undefined && v !== null) gold[f] = v;
        }
      }
      for (const c of (row.corrections || []).filter(c => c.entity_index === e.index && FIELDS.includes(c.field))) {
        gold[c.field] = c.value;
      }
      return { start: e.start, end: e.end, type: e.extracted_type, gold };
    }).filter(e => Object.keys(e.gold).length && e.gold.type !== 'not_an_entity');
    if (entities.length) {
      records.push({ id: `pilot-${row.analysis_id}`, split: 'dev', source: 'pilot_review', text: row.input_text, entities });
    }
  }
  return { records, skipped_identifiers: skippedIdentifiers, skipped_without_context: skippedNoContext };
}

async function main() {
  const argv = process.argv.slice(2);
  const arg = name => (argv.includes(name) ? argv[argv.indexOf(name) + 1] : null);
  const pilot = arg('--pilot'), out = arg('--out');
  if (!pilot || !out) { console.error('Usage: --pilot <uuid> --out <file.jsonl> --i-confirm-authorised-environment'); process.exit(2); }
  if (!argv.includes('--i-confirm-authorised-environment')) {
    console.error('The export contains clinical text. Run it only inside the hospital environment and confirm with --i-confirm-authorised-environment.');
    process.exit(2);
  }
  if (/test|valid/i.test(path.basename(out))) { console.error('Pilot corrections are development data only; do not name the file as a test or validation set.'); process.exit(2); }
  const db = await import('../db.js');
  try {
    const { rows } = await db.query(`SELECT DISTINCT ON (a.id) a.id AS analysis_id, a.input_text, a.result, r.decision, r.corrections
      FROM openmed_advisory.analyses a JOIN openmed_advisory.analysis_reviews r ON r.analysis_id = a.id
      WHERE a.pilot_id = $1 ORDER BY a.id, r.version DESC`, [pilot]);
    const built = buildCorrectionRecords(rows);
    fs.writeFileSync(out, built.records.map(r => JSON.stringify(r)).join('\n') + (built.records.length ? '\n' : ''), { mode: 0o600 });
    console.log(JSON.stringify({ reviewed_analyses: rows.length, exported: built.records.length,
      skipped_identifiers: built.skipped_identifiers, skipped_without_context: built.skipped_without_context, split: 'dev' }));
  } finally {
    await db.default.end();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) main();
