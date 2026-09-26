/**
 * Ollama health for the AI UI (GET /api/ai/health).
 *
 * Uses the single Ollama configuration (services/ollamaConfig.js) and asks GET <base>/api/tags
 * with a 3 s timeout. The result is cached for 60 s and check() never throws: an unreachable,
 * misconfigured or disabled AI is reported in the result, so forms keep working.
 */
import { getOllamaConfig } from '../ollamaConfig.js';
import { isAIEnabled, aiModels } from './config.js';

export const HEALTH_TTL_MS = 60_000;
export const HEALTH_TIMEOUT_MS = 3_000;

const withoutLatest = name => String(name || '').replace(/:latest$/, '');

/** Ollama treats "name" and "name:latest" as the same model. */
export function modelIsPresent(names, model) {
  if (!model) return false;
  const wanted = withoutLatest(model);
  return (names || []).some(name => withoutLatest(name) === wanted);
}

export function createHealthChecker({
  env = process.env,
  fetchImpl = (...args) => globalThis.fetch(...args),
  ttlMs = HEALTH_TTL_MS,
  timeoutMs = HEALTH_TIMEOUT_MS,
  now = () => Date.now()
} = {}) {
  let cached = null;
  let inFlight = null;

  async function probe() {
    const { model, embedModel } = aiModels(env);
    const checkedAt = new Date(now()).toISOString();
    const base = { enabled: isAIEnabled(env), reachable: null, baseUrlIsTls: null, model, modelPresent: null, embedModel, embedModelPresent: null, checkedAt };
    if (!base.enabled) return { ...base, reason: 'AI features are disabled (AI_FEATURES_ENABLED)' };

    const { baseUrl, configError } = getOllamaConfig(env);
    if (configError) {
      return { ...base, reachable: false, modelPresent: false, embedModelPresent: false, reason: `Ollama configuration refused: ${configError.message}` };
    }
    base.baseUrlIsTls = baseUrl.startsWith('https://');
    try {
      const response = await fetchImpl(`${baseUrl}/api/tags`, { method: 'GET', signal: AbortSignal.timeout(timeoutMs) });
      if (!response.ok) {
        return { ...base, reachable: false, modelPresent: false, embedModelPresent: false, reason: `Ollama answered HTTP ${response.status}` };
      }
      const data = await response.json().catch(() => ({}));
      const names = (Array.isArray(data?.models) ? data.models : []).map(m => m?.name || m?.model).filter(Boolean);
      return { ...base, reachable: true, modelPresent: modelIsPresent(names, model), embedModelPresent: modelIsPresent(names, embedModel) };
    } catch (error) {
      const timedOut = error?.name === 'TimeoutError' || error?.name === 'AbortError';
      return {
        ...base, reachable: false, modelPresent: false, embedModelPresent: false,
        reason: timedOut ? `Ollama is not reachable (no answer within ${timeoutMs} ms)` : 'Ollama is not reachable'
      };
    }
  }

  return {
    async check({ force = false } = {}) {
      if (!force && cached && now() - cached.at < ttlMs) return cached.result;
      if (inFlight) return inFlight;
      inFlight = probe()
        .catch(() => ({ enabled: isAIEnabled(env), reachable: false, reason: 'Health check failed', checkedAt: new Date(now()).toISOString() }))
        .then(result => { cached = { result, at: now() }; return result; })
        .finally(() => { inFlight = null; });
      return inFlight;
    },
    reset() { cached = null; }
  };
}

export default createHealthChecker();
