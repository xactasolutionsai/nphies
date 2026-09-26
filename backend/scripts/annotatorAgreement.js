#!/usr/bin/env node
/**
 * Inter-annotator agreement between two annotation files of the same records.
 *
 *   node scripts/annotatorAgreement.js --a annotator1.jsonl --b annotator2.jsonl
 *
 * Entities are matched by record id and span (start/end, or phrase + nth). For each
 * attribute: items compared, raw agreement and Cohen's kappa; disagreements are listed by
 * record id and entity position only (no text), for adjudication.
 */
import fs from 'node:fs';
import { cohenKappa } from '../clinical-context/evalKit.js';

const ATTRIBUTES = ['assertion', 'experiencer', 'temporality', 'medication_status', 'type'];

function keyed(records) {
  const map = new Map();
  for (const r of records) {
    for (const [i, e] of (r.entities || []).entries()) {
      const span = Number.isInteger(e.start) ? `${e.start}-${e.end}` : `${e.phrase}#${e.nth ?? 0}`;
      map.set(`${r.id}|${span}`, { id: r.id, entity: i, gold: e.gold || {} });
    }
  }
  return map;
}

export function agreement(recordsA, recordsB) {
  const a = keyed(recordsA), b = keyed(recordsB);
  const shared = [...a.keys()].filter(k => b.has(k));
  const out = { entities_a: a.size, entities_b: b.size, entities_matched: shared.length, attributes: {} };
  for (const attribute of ATTRIBUTES) {
    const pairs = [], disagreements = [];
    for (const k of shared) {
      const x = a.get(k).gold[attribute], y = b.get(k).gold[attribute];
      if (x === undefined || y === undefined) continue;
      pairs.push([String(x), String(y)]);
      if (x !== y) disagreements.push({ id: a.get(k).id, entity: a.get(k).entity, a: x, b: y });
    }
    if (pairs.length) out.attributes[attribute] = { ...cohenKappa(pairs), disagreements };
  }
  return out;
}

function main() {
  const argv = process.argv.slice(2);
  const arg = name => argv[argv.indexOf(name) + 1];
  if (!argv.includes('--a') || !argv.includes('--b')) { console.error('Usage: --a <jsonl> --b <jsonl>'); process.exit(2); }
  const read = f => fs.readFileSync(f, 'utf8').split('\n').filter(l => l.trim()).map(l => JSON.parse(l));
  console.log(JSON.stringify(agreement(read(arg('--a')), read(arg('--b'))), null, 2));
}

if (import.meta.url === `file://${process.argv[1]}`) main();
