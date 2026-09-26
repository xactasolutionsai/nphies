// Guard for the legacy faker seed scripts (seed.js, seed-fixed.js, seed-corrected.js).
// They TRUNCATE ... CASCADE core tables, so they only run when invoked directly,
// never in production, and only with an explicit ALLOW_DESTRUCTIVE_SEED=true opt-in.
import { pathToFileURL } from 'node:url';

export function isMainModule(moduleUrl, argv = process.argv) {
  return Boolean(argv[1]) && pathToFileURL(argv[1]).href === moduleUrl;
}

export function destructiveSeedRefusal(env = process.env) {
  if (env.NODE_ENV === 'production') return 'Refusing to seed: NODE_ENV=production.';
  if (env.ALLOW_DESTRUCTIVE_SEED !== 'true') {
    return 'Refusing to seed: this script TRUNCATEs patients, providers, insurers and every table referencing them. ' +
      'Set ALLOW_DESTRUCTIVE_SEED=true to confirm on a disposable database.';
  }
  return null;
}

export function assertDestructiveSeedAllowed(env = process.env) {
  const refusal = destructiveSeedRefusal(env);
  if (refusal) throw new Error(refusal);
}
