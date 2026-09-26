import { useEffect, useState } from 'react';
import aiApi from '@/services/aiApi';

// One health request per minute for the whole app (the backend also caches for 60 s).
const TTL_MS = 60000;
let cached = null;
let cachedAt = 0;
let inFlight = null;

function loadHealth() {
  if (cached && Date.now() - cachedAt < TTL_MS) return Promise.resolve(cached);
  if (!inFlight) {
    inFlight = aiApi.getHealth()
      .then(health => { cached = health; cachedAt = Date.now(); return health; })
      .catch(() => {
        // The health endpoint itself failed: treat AI as unknown (no banner, no AI actions).
        cached = null;
        return null;
      })
      .finally(() => { inFlight = null; });
  }
  return inFlight;
}

/**
 * Ollama / AI status from GET /api/ai/health:
 * { enabled, reachable, baseUrlIsTls, model, modelPresent, embedModel, embedModelPresent, checkedAt }.
 * `health` is null while loading or when the status could not be read.
 */
export default function useAIHealth() {
  const [health, setHealth] = useState(cached);
  const [loading, setLoading] = useState(!cached);

  useEffect(() => {
    let active = true;
    const refresh = () => loadHealth().then(result => {
      if (active) { setHealth(result); setLoading(false); }
    });
    refresh();
    const timer = setInterval(refresh, TTL_MS);
    return () => { active = false; clearInterval(timer); };
  }, []);

  return { health, loading };
}
