/**
 * Build fingerprint of the clinical AI code paths: a SHA-256 over the exact source files
 * that decide what the assistant outputs. Shown in /api/openmed/status and in evaluation
 * reports, so a deployment can be checked against the version that was tested.
 */
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ENGINE } from '../clinical-context/index.js';
import { SUMMARY_VERSION } from '../clinical-evidence/summary.js';

const BACKEND = fileURLToPath(new URL('..', import.meta.url));
export const FINGERPRINT_PATHS = Object.freeze([
  'clinical-context', 'clinical-evidence', 'openmed/worker.py', 'openmed/workerPool.js', 'openmed/inference.js',
  'openmed/routes.js', 'openmed/models.json',
  'migrations/064_openmed_advisory.sql', 'migrations/071_clinical_ai_access_and_reviews.sql',
  'migrations/072_clinical_knowledge_sources.sql', 'migrations/073_openmed_idempotency.sql',
  'migrations/074_clinical_pilot.sql', 'migrations/075_clinical_ai_rollout_generation.sql', 'openmed/pilot.js'
]);

function listFiles(root, relative) {
  const full = path.join(root, relative);
  if (!fs.existsSync(full)) return [];
  if (fs.statSync(full).isFile()) return [relative];
  return fs.readdirSync(full, { withFileTypes: true }).flatMap(entry => {
    const child = path.join(relative, entry.name);
    if (entry.isDirectory()) return entry.name === 'eval' ? [] : listFiles(root, child);
    return /\.(js|py|json|sql)$/.test(entry.name) ? [child] : [];
  });
}

export function computeFingerprint({ root = BACKEND, paths = FINGERPRINT_PATHS } = {}) {
  const files = paths.flatMap(p => listFiles(root, p)).map(f => f.split(path.sep).join('/')).sort();
  const hash = createHash('sha256');
  for (const file of files) {
    hash.update(file).update('\0').update(fs.readFileSync(path.join(root, file))).update('\0');
  }
  return { sha256: hash.digest('hex'), files: files.length, context_engine: ENGINE.version,
    summary_version: SUMMARY_VERSION, commit: process.env.BUILD_COMMIT || null };
}

let cached;
export function buildFingerprint() {
  cached ||= computeFingerprint();
  return cached;
}

if (import.meta.url === `file://${process.argv[1]}`) console.log(JSON.stringify(buildFingerprint(), null, 2));
