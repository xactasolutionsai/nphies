import api from '@/services/api';

/**
 * Advisory AI API (/api/ai and the compare / duplicate-ingredient endpoints).
 * Every response carries source ('rules' | 'statistics' | 'retrieval' | 'llm'), certainty and basis;
 * an unavailable AI part is { available: false, reason }. Nothing here sends data to NPHIES.
 */

const qs = (params = {}) => {
  const clean = Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== ''));
  const text = new URLSearchParams(clean).toString();
  return text ? `?${text}` : '';
};

/** True when the "AI unavailable" banner should be shown: AI is enabled but Ollama is not reachable. */
export function aiBannerVisible(health) {
  return Boolean(health && health.enabled === true && health.reachable === false);
}

/** True when optional LLM actions (e.g. "Explain") can be offered. */
export function aiActionsAvailable(health) {
  return Boolean(health && health.enabled === true && health.reachable === true && health.modelPresent !== false);
}

export const AI_UNAVAILABLE_BANNER = 'AI features unavailable — forms still work; AI checks require manual review';

const aiApi = {
  getHealth() {
    return api.request('/ai/health');
  },

  sendFeedback(auditId, verdict, comment) {
    return api.request('/ai/feedback', {
      method: 'POST',
      body: JSON.stringify({ auditId, verdict, ...(comment ? { comment } : {}) })
    });
  },

  getRejectionAnalytics(params) {
    return api.request(`/ai/analytics/rejections${qs(params)}`);
  },

  getPollTiming(params) {
    return api.request(`/ai/analytics/poll-timing${qs(params)}`);
  },

  /** items: [{ sequence, code }] or ['code', ...] */
  checkDuplicateIngredients(items) {
    return api.request('/medication-safety/duplicate-ingredients', {
      method: 'POST',
      body: JSON.stringify({ codes: items })
    });
  },

  /** kind: 'prior-authorizations' | 'claim-submissions' */
  compareWithLastAccepted(kind, id) {
    return api.request(`/${kind}/${encodeURIComponent(id)}/compare-success`);
  },

  explainComparison(kind, id) {
    return api.request(`/${kind}/${encodeURIComponent(id)}/compare-success/explain`, { method: 'POST', body: '{}' });
  }
};

export default aiApi;
