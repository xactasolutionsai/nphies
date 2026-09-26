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
import { annotate, ENGINE } from '../clinical-context/index.js';

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
    else if (argv[i] === '--json') args.json = true;
    else if (argv[i] === '--held-out-confirmed') args.heldOutConfirmed = true;
  }
  return args;
}

const pct = v => (v === null ? '—' : `${(v * 100).toFixed(1)}%`);

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.file || !['dev', 'validation', 'test'].includes(args.split)) {
    console.error('Usage: --file <jsonl> --split dev|validation|test [--json] [--held-out-confirmed]');
    process.exit(2);
  }
  if (args.split === 'test' && !args.heldOutConfirmed) {
    console.error('The test split is held out: pass --held-out-confirmed only for the single final run after rules are frozen.');
    process.exit(2);
  }
  const records = fs.readFileSync(args.file, 'utf8').split('\n').filter(l => l.trim()).map(l => JSON.parse(l));
  const selected = records.filter(r => r.split === args.split);
  const report = { engine: ENGINE, split: args.split, records: selected.length, ...evaluate(selected),
    caveat: args.split === 'dev'
      ? 'Development split: seen while writing rules; not an estimate of performance on new text.'
      : 'Only meaningful if annotated independently (clinicians) and not used to change rules.' };
  if (args.json) { console.log(JSON.stringify(report, null, 2)); return; }
  console.log(`${ENGINE.name} ${ENGINE.version} · split=${args.split} · records=${selected.length}`);
  console.log(report.caveat);
  for (const [a, r] of Object.entries(report.attributes)) {
    const ci = r.accuracy_ci95 ? `${pct(r.accuracy_ci95[0])}–${pct(r.accuracy_ci95[1])}` : '—';
    console.log(`\n${a}: ${r.correct}/${r.n} = ${pct(r.accuracy)} (95% CI ${ci}); unknown ${pct(r.unknown_rate)}`);
    for (const [c, m] of Object.entries(r.per_class)) {
      console.log(`  ${c.padEnd(13)} support=${m.support} P=${pct(m.precision)} R=${pct(m.recall)} F1=${pct(m.f1)}`);
    }
    for (const e of r.errors) console.log(`  error ${e.id}#${e.entity}: gold=${e.gold} predicted=${e.pred}`);
  }
  if (report.invalid.length) console.log('\nInvalid records:', report.invalid);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
