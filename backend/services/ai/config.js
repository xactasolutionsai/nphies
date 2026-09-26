/**
 * AI feature flags and shared settings (see the AI spec, principle 8).
 *
 * - AI_FEATURES_ENABLED: master switch. Defaults to false in production and true elsewhere.
 * - AI_FEATURE_<NAME>=false: turns one feature off (name upper-cased, '-' and ' ' become '_').
 * - AI_MIN_SAMPLE_SIZE: minimum records before a statistic is shown (default 30).
 *
 * Deterministic features (rules, SQL statistics) do not depend on these flags; only calls
 * to the language model do. The Ollama endpoint itself comes from services/ollamaConfig.js.
 */
import { DEFAULT_OLLAMA_MODEL } from '../ollamaConfig.js';

export const DEFAULT_MIN_SAMPLE_SIZE = 30;

export function isAIEnabled(env = process.env) {
  const value = String(env.AI_FEATURES_ENABLED ?? '').trim().toLowerCase();
  if (value === '') return env.NODE_ENV !== 'production';
  return value === 'true';
}

export function featureFlagName(name) {
  return `AI_FEATURE_${String(name).toUpperCase().replace(/[^A-Z0-9]+/g, '_')}`;
}

export function isAIFeatureEnabled(name, env = process.env) {
  if (!isAIEnabled(env)) return false;
  return String(env[featureFlagName(name)] ?? '').trim().toLowerCase() !== 'false';
}

export function minSampleSize(env = process.env) {
  const value = parseInt(env.AI_MIN_SAMPLE_SIZE, 10);
  return Number.isInteger(value) && value > 0 ? value : DEFAULT_MIN_SAMPLE_SIZE;
}

/** Generation and embedding models (same defaults as services/ollamaService.js). */
export function aiModels(env = process.env) {
  const model = env.OLLAMA_MODEL || DEFAULT_OLLAMA_MODEL;
  return { model, embedModel: env.OLLAMA_EMBED_MODEL || model };
}
