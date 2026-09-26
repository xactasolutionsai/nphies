#!/usr/bin/env node
/**
 * Evaluate the clinical context engine against an annotated JSONL file.
 *
 *   node scripts/evalClinicalContext.js --file clinical-context/eval/dev.jsonl --split dev [--json]
 *
 * Each line: { id, split: 'dev'|'validation'|'test', text,
 *              entities: [{ phrase, nth?, start?, end?, type, gold: { assertion?, experiencer?,
 *                           temporality?, medication_status?, type?, dose?, unit?, route?,
 *                           frequency?, duration? } }] }
 * Only attributes present in `gold` are scored.
 *
 * Output never contains note text or entity text: errors are listed by record id and entity
 * position, so the report can be shared even when the file holds real (authorised) notes.
 *
 * The held-out 'test' split needs --held-out-confirmed: run it once, after rules are frozen,
 * and do not change rules in response to its results (use 'validation' for that).
 */
import fs from 'node:fs';
import path from 'node:path';
import { annotate, ENGINE } from '../clinical-context/index.js';
import { languageOf, sha256, checkCriteria } from '../clinical-context/evalKit.js';
import { computeFingerprint } from '../openmed/fingerprint.js';

const ATTRIBUTES = ['assertion', 'experiencer', 'temporality', 'medication_status', 'type',
  'dose', 'unit', 'route', 'frequency', 'duration'];

export function wilson(successes, n, z = 1.96) {
  if (n === 0) return null;
  const p = successes / n;
  const denom = 1 + z * z / n;
  const centre = (p + z * z / (2 * n)) / denom;
  const half = (z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n))) / denom;
  return [Math.max(0, centre - half), Math.min(1, centre + half)];
}

function resolveSpan(text, e) {
  if (Number.isInteger(e.start) && Number.isInteger(e.end)) return { start: e.start, end: e.end };
  let from = 0, start = -1;
  for (let i = 0; i <= (e.nth ?? 0); i++) {
    start = text.indexOf(e.phrase, from);
    if (start < 0) return null;
    from = start + 1;
  }
  return { start, end: start + e.phrase.length };
}

function predicted(entity, attribute) {
  if (attribute === 'medication_status') return entity.medication?.status ?? null;
  if (['dose', 'unit', 'route', 'frequency', 'duration'].includes(attribute)) return entity.medication?.[attribute] ?? null;
  return entity[attribute] ?? null;
}

const norm = v => (v === null || v === undefined ? null : String(v).trim().toLowerCase());

export function evaluate(records) {
  const pairs = Object.fromEntries(ATTRIBUTES.map(a => [a, []]));
  const invalid = [];
  for (const record of records) {
    const entities = [];
    for (const [i, e] of record.entities.entries()) {
      const span = resolveSpan(record.text, e);
      if (!span) { invalid.push({ id: record.id, entity: i, problem: 'span_not_found' }); continue; }
      entities.push({ text: record.text.slice(span.start, span.end), ...span, type: e.type, gold: e.gold, i });
    }
    let result;
    try {
      result = annotate(record.text, entities.map(({ gold, i, ...rest }) => rest));
    } catch (error) {
      invalid.push({ id: record.id, problem: error.name === 'LanguageNotSupportedError' ? 'language_refused' : 'engine_error' });
      continue;
    }
    entities.forEach((e, k) => {
      for (const [attribute, gold] of Object.entries(e.gold || {})) {
        if (!ATTRIBUTES.includes(attribute)) continue;
        pairs[attribute].push({ id: record.id, entity: e.i, gold: norm(gold), pred: norm(predicted(result.entities[k], attribute)) });
      }
    });
  }

  const attributes = {};
  for (const [attribute, list] of Object.entries(pairs)) {
    if (!list.length) continue;
    const correct = list.filter(p => p.gold === p.pred).length;
    const unknown = list.filter(p => p.pred === 'unknown').length;
    const decided = list.filter(p => p.pred !== 'unknown');
    const classes = [...new Set(list.flatMap(p => [p.gold, p.pred]).filter(v => v !== null))].sort();
    const perClass = Object.fromEntries(classes.map(c => {
      const tp = list.filter(p => p.gold === c && p.pred === c).length;
      const fp = list.filter(p => p.gold !== c && p.pred === c).length;
      const fn = list.filter(p => p.gold === c && p.pred !== c).length;
      const precision = tp + fp ? tp / (tp + fp) : null;
      const recall = tp + fn ? tp / (tp + fn) : null;
      const f1 = precision !== null && recall !== null && precision + recall ? 2 * precision * recall / (precision + recall) : null;
      return [c, { support: tp + fn, tp, fp, fn, precision, recall, recall_ci95: wilson(tp, tp + fn), f1 }];
    }));
    attributes[attribute] = {
      n: list.length, correct, accuracy: correct / list.length, accuracy_ci95: wilson(correct, list.length),
      unknown_rate: unknown / list.length,
      accuracy_when_decided: decided.length ? decided.filter(p => p.gold === p.pred).length / decided.length : null,
      per_class: perClass,
      errors: list.filter(p => p.gold !== p.pred).map(({ id, entity, gold, pred }) => ({ id, entity, gold, pred }))
    };
  }
  return { attributes, invalid };
}

function parseArgs(argv) {
  const args = { json: false, heldOutConfirmed: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--file') args.file = argv[++i];
    else if (argv[i] === '--split') args.split = argv[++i];
    else if (argv[i] === '--manifest') args.manifest = argv[++i];
    else if (argv[i] === '--criteria') args.criteria = argv[++i];
    else if (argv[i] === '--json') args.json = true;
    else if (argv[i] === '--held-out-confirmed') args.heldOutConfirmed = true;
  }
  return args;
}

const refuse = message => Object.assign(new Error(message), { exitCode: 2 });

/**
 * Evaluate one split. With a manifest (scripts/clinicalEvalSplit.js) the file and the
 * criteria must match the hashes recorded when the data was split; the test split requires
 * both a manifest and --held-out-confirmed, and every test run is logged next to the manifest.
 */
export function runEvaluation({ file, split, manifest: manifestPath, criteria: criteriaPath, heldOutConfirmed }) {
  if (!file || !['dev', 'validation', 'test'].includes(split)) {
    throw refuse('Usage: --file <jsonl> --split dev|validation|test [--manifest m.json] [--criteria c.json] [--json] [--held-out-confirmed]');
  }
  if (split === 'test' && !heldOutConfirmed) {
    throw refuse('The test split is held out: pass --held-out-confirmed only for the single final run after rules are frozen.');
  }
  if (split === 'test' && !manifestPath) throw refuse('The test split needs the manifest written when the data was split (--manifest).');
  const content = fs.readFileSync(file);
  let manifest = null, testRun = null;
  if (manifestPath) {
    manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    if (manifest.files?.[split]?.sha256 !== sha256(content)) {
      throw refuse(`The ${split} file differs from the manifest: it was changed after the split.`);
    }
    if (manifest.criteria) {
      if (!criteriaPath) throw refuse('The manifest registers success criteria: pass them with --criteria.');
      if (sha256(fs.readFileSync(criteriaPath)) !== manifest.criteria.sha256) {
        throw refuse('The criteria differ from the ones registered before the split.');
      }
    }
  }
  const records = content.toString('utf8').split('\n').filter(l => l.trim()).map(l => JSON.parse(l)).filter(r => r.split === split);
  const build = computeFingerprint();
  if (split === 'test') {
    const log = path.join(path.dirname(manifestPath), 'test-runs.log');
    const previous = fs.existsSync(log) ? fs.readFileSync(log, 'utf8').split('\n').filter(Boolean).length : 0;
    fs.appendFileSync(log, `${JSON.stringify({ at: new Date().toISOString(), build: build.sha256, file: sha256(content) })}\n`);
    testRun = { number: previous + 1, warning: previous ? `The test split was already evaluated ${previous} time(s); results may no longer be independent.` : null };
  }
  const groups = new Map();
  for (const r of records) {
    const lang = languageOf(r);
    if (!groups.has(lang)) groups.set(lang, []);
    groups.get(lang).push(r);
  }
  const byLanguage = Object.fromEntries([...groups].map(([lang, rows]) => {
    const e = evaluate(rows);
    return [lang, { records: rows.length, refused_or_invalid: e.invalid.length,
      attributes: Object.fromEntries(Object.entries(e.attributes).map(([k, v]) => [k, { n: v.n, accuracy: v.accuracy, accuracy_ci95: v.accuracy_ci95 }])) }];
  }));
  const report = { engine: ENGINE, build, split, records: records.length, test_run: testRun, ...evaluate(records),
    by_language: byLanguage,
    caveat: split === 'dev'
      ? 'Development split: seen while writing rules; not an estimate of performance on new text.'
      : 'Only meaningful if annotated independently (clinicians) and not used to change rules.' };
  if (criteriaPath) report.criteria_results = checkCriteria(report, JSON.parse(fs.readFileSync(criteriaPath, 'utf8')));
  return report;
}

const pct = v => (v === null || v === undefined ? '—' : `${(v * 100).toFixed(1)}%`);

async function main() {
  let report;
  try { report = runEvaluation(parseArgs(process.argv.slice(2))); }
  catch (error) { console.error(error.message); process.exit(error.exitCode || 1); }
  if (process.argv.includes('--json')) { console.log(JSON.stringify(report, null, 2)); return; }
  console.log(`${ENGINE.name} ${ENGINE.version} · build ${report.build.sha256.slice(0, 12)} · split=${report.split} · records=${report.records}`);
  console.log(report.caveat);
  if (report.test_run?.warning) console.log(`WARNING: ${report.test_run.warning}`);
  for (const [a, r] of Object.entries(report.attributes)) {
    const ci = r.accuracy_ci95 ? `${pct(r.accuracy_ci95[0])}–${pct(r.accuracy_ci95[1])}` : '—';
    console.log(`\n${a}: ${r.correct}/${r.n} = ${pct(r.accuracy)} (95% CI ${ci}); unknown ${pct(r.unknown_rate)}`);
    for (const [c, m] of Object.entries(r.per_class)) {
      console.log(`  ${c.padEnd(13)} support=${m.support} P=${pct(m.precision)} R=${pct(m.recall)} F1=${pct(m.f1)}`);
    }
    for (const e of r.errors) console.log(`  error ${e.id}#${e.entity}: gold=${e.gold} predicted=${e.pred}`);
  }
  console.log('\nBy language:');
  for (const [lang, g] of Object.entries(report.by_language)) {
    console.log(`  ${lang}: records=${g.records} refused/invalid=${g.refused_or_invalid} ` +
      Object.entries(g.attributes).map(([k, v]) => `${k}=${pct(v.accuracy)} (n=${v.n})`).join(' '));
  }
  if (report.criteria_results) {
    console.log('\nPre-registered criteria:');
    for (const c of report.criteria_results) console.log(`  ${c.id}: ${c.result} (observed ${c.observed ?? '—'}, n=${c.n ?? 0})`);
  }
  if (report.invalid.length) console.log('\nInvalid records:', report.invalid);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
