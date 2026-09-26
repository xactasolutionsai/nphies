#!/usr/bin/env node
/**
 * Split a hospital-annotated JSONL file into dev / validation / test and freeze it.
 *
 *   node scripts/clinicalEvalSplit.js --in annotated.jsonl --out-dir eval-2026 \
 *        --salt <any text> [--criteria criteria.json] [--ratios 0.6,0.2,0.2]
 *
 * Writes dev.jsonl, validation.jsonl, test.jsonl and manifest.json with each file's SHA-256,
 * counts per split and language, and (optionally) the SHA-256 of the success criteria. The
 * evaluator refuses a test run whose file or criteria differ from this manifest, so the test
 * split and the criteria cannot be changed after the fact without it being visible.
 * Prints counts only, never note text. Store the output with the same protection as the input.
 */
import fs from 'node:fs';
import path from 'node:path';
import { assignSplit, languageOf, sha256 } from '../clinical-context/evalKit.js';

export function splitRecords(records, { salt, ratios }) {
  const ids = new Set();
  for (const r of records) {
    if (typeof r.id !== 'string' || !r.id) throw new Error('Every record needs a string id');
    if (ids.has(r.id)) throw new Error(`Duplicate record id (${ids.size + 1}th record)`);
    ids.add(r.id);
  }
  const splits = { dev: [], validation: [], test: [] };
  for (const r of records) {
    const split = assignSplit(r.id, salt, { dev: ratios[0], validation: ratios[1], test: ratios[2] });
    splits[split].push({ ...r, split, language: languageOf(r) });
  }
  return splits;
}

function main() {
  const a = {};
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i += 2) a[argv[i].replace(/^--/, '')] = argv[i + 1];
  if (!a.in || !a['out-dir'] || !a.salt) {
    console.error('Usage: --in <jsonl> --out-dir <dir> --salt <text> [--criteria <json>] [--ratios 0.6,0.2,0.2]');
    process.exit(2);
  }
  const ratios = (a.ratios || '0.6,0.2,0.2').split(',').map(Number);
  if (ratios.length !== 3 || Math.abs(ratios.reduce((x, y) => x + y, 0) - 1) > 1e-9) {
    console.error('Ratios must be three numbers that add up to 1'); process.exit(2);
  }
  const records = fs.readFileSync(a.in, 'utf8').split('\n').filter(l => l.trim()).map(l => JSON.parse(l));
  const splits = splitRecords(records, { salt: a.salt, ratios });
  fs.mkdirSync(a['out-dir'], { recursive: true });
  const manifest = { created_at: new Date().toISOString(), salt: a.salt, ratios, files: {}, counts: {} };
  for (const [split, rows] of Object.entries(splits)) {
    const content = rows.map(r => JSON.stringify(r)).join('\n') + (rows.length ? '\n' : '');
    const file = `${split}.jsonl`;
    fs.writeFileSync(path.join(a['out-dir'], file), content);
    manifest.files[split] = { file, sha256: sha256(content), records: rows.length };
    manifest.counts[split] = rows.reduce((c, r) => ({ ...c, [r.language]: (c[r.language] || 0) + 1 }), {});
  }
  if (a.criteria) manifest.criteria = { file: path.basename(a.criteria), sha256: sha256(fs.readFileSync(a.criteria)) };
  fs.writeFileSync(path.join(a['out-dir'], 'manifest.json'), JSON.stringify(manifest, null, 2));
  console.log(JSON.stringify({ files: manifest.files, counts: manifest.counts, criteria: manifest.criteria ?? null }, null, 2));
}

if (import.meta.url === `file://${process.argv[1]}`) main();
