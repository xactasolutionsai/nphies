/**
 * Handlers for "Compare with last accepted request" (P2.2), mounted on the prior authorization
 * and claim submission routers:
 *   GET  /:id/compare-success           deterministic diff (every role)
 *   POST /:id/compare-success/explain   optional LLM explanation (reviewer and up; fails closed)
 */
import { compareWithLastAccepted, explainComparison, CompareError } from '../../services/compareSuccessService.js';

function handle(fn) {
  return async (req, res) => {
    try {
      res.json(await fn(req));
    } catch (error) {
      if (error instanceof CompareError) return res.status(error.status).json({ error: error.message });
      console.error('[AI] Compare with last accepted request failed:', error.message);
      res.status(500).json({ error: 'Comparison failed' });
    }
  };
}

export function registerCompareSuccessRoutes(router, kind) {
  router.get('/:id/compare-success', handle(req => compareWithLastAccepted(kind, req.params.id)));
  router.post('/:id/compare-success/explain', handle(req => explainComparison(kind, req.params.id, { userId: req.user?.id ?? null })));
}
