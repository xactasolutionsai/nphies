import React, { useState } from 'react';
import { GitCompare, Sparkles, RefreshCw } from 'lucide-react';
import aiApi, { aiActionsAvailable } from '@/services/aiApi';
import { extractErrorMessage } from '@/services/api';
import useAIHealth from '@/hooks/useAIHealth';
import { useAuth } from '@/context/AuthContext';
import AIBadge from '@/components/ai/AIBadge';
import AIUnavailable from '@/components/ai/AIUnavailable';
import AIFeedbackButtons from '@/components/ai/AIFeedbackButtons';

const KIND_STYLES = {
  missing: 'bg-amber-100 text-amber-900',
  extra: 'bg-blue-100 text-blue-900',
  different: 'bg-purple-100 text-purple-900'
};
const KIND_HELP = {
  missing: 'only in the accepted request',
  extra: 'only in this request',
  different: 'value differs'
};

const valueList = (values) => (values && values.length ? values.join(', ') : '—');

/**
 * "Compare with last accepted request" for a rejected prior authorization or claim.
 * The diff is computed by rules (no AI). An optional AI explanation is offered only to roles
 * that may validate, and only when the AI health check says the model is reachable.
 *
 * kind: 'prior-authorizations' | 'claim-submissions'
 */
export default function CompareWithAcceptedPanel({ kind, recordId }) {
  const { can } = useAuth();
  const { health } = useAIHealth();
  const [comparison, setComparison] = useState(null);
  const [explanation, setExplanation] = useState(null);
  const [loading, setLoading] = useState(false);
  const [explaining, setExplaining] = useState(false);
  const [error, setError] = useState(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    setExplanation(null);
    try {
      setComparison(await aiApi.compareWithLastAccepted(kind, recordId));
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const explain = async () => {
    setExplaining(true);
    try {
      const result = await aiApi.explainComparison(kind, recordId);
      setComparison(result);
      setExplanation(result.explanation);
    } catch (err) {
      setExplanation({ available: false, reason: extractErrorMessage(err) });
    } finally {
      setExplaining(false);
    }
  };

  const canExplain = can('validate') && aiActionsAvailable(health) && comparison?.reference && comparison?.diff?.length > 0;

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 font-medium text-gray-900">
          <GitCompare className="h-4 w-4 text-gray-600" />
          Compare with last accepted request
        </div>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="inline-flex items-center gap-1 rounded border border-gray-300 px-3 py-1 text-xs font-medium hover:bg-gray-50 disabled:opacity-50"
        >
          <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
          {comparison ? 'Refresh' : 'Compare'}
        </button>
      </div>

      {error && <p className="mt-2 text-red-700">{error}</p>}

      {comparison && (
        <div className="mt-3 space-y-3">
          <AIBadge source={comparison.source} certainty={comparison.certainty} basis={comparison.basis} showBasis />
          {!comparison.reference ? (
            <p className="text-gray-700">{comparison.message}</p>
          ) : (
            <>
              <p className="text-gray-700">
                Reference: accepted request #{comparison.reference.id} ({comparison.reference.status}).{' '}
                {comparison.summary && (
                  <span className="text-gray-500">
                    {comparison.summary.missing} missing, {comparison.summary.extra} extra, {comparison.summary.different} different
                    {comparison.truncated ? ' (list truncated)' : ''}.
                  </span>
                )}
              </p>
              {comparison.diff.length === 0 ? (
                <p className="text-gray-600">No structural difference found (volatile values and amounts are ignored).</p>
              ) : (
                <div className="max-h-80 overflow-auto rounded border border-gray-100">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50 text-left text-gray-600">
                      <tr><th className="p-2">Path</th><th className="p-2">Kind</th><th className="p-2">This request</th><th className="p-2">Accepted request</th></tr>
                    </thead>
                    <tbody>
                      {comparison.diff.map((d) => (
                        <tr key={`${d.kind}:${d.path}`} className="border-t border-gray-100 align-top">
                          <td className="p-2 font-mono break-all">{d.path}</td>
                          <td className="p-2"><span className={`rounded px-1.5 py-0.5 ${KIND_STYLES[d.kind] || ''}`} title={KIND_HELP[d.kind]}>{d.kind}</span></td>
                          <td className="p-2 font-mono break-all">{valueList(d.failed)}</td>
                          <td className="p-2 font-mono break-all">{valueList(d.reference)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}

          {canExplain && !explanation && (
            <button
              type="button"
              onClick={explain}
              disabled={explaining}
              className="inline-flex items-center gap-1 rounded border border-purple-300 bg-purple-50 px-3 py-1 text-xs font-medium text-purple-800 hover:bg-purple-100 disabled:opacity-50"
            >
              <Sparkles className="h-3 w-3" />
              {explaining ? 'Asking the AI…' : 'Explain the differences (AI, advisory)'}
            </button>
          )}

          {explanation && !explanation.available && <AIUnavailable reason={explanation.reason} />}
          {explanation?.available && (
            <div className="space-y-2 rounded border border-purple-200 bg-purple-50/40 p-3">
              <AIBadge source={explanation.source} certainty={explanation.certainty} basis={explanation.basis} />
              <p className="text-gray-800 whitespace-pre-line">{explanation.summary}</p>
              {explanation.likelyCauses?.length > 0 && (
                <ul className="list-disc space-y-1 pl-5 text-gray-700">
                  {explanation.likelyCauses.map((cause, i) => (
                    <li key={i}><span className="font-mono text-xs">{cause.path}</span>: {cause.explanation}</li>
                  ))}
                </ul>
              )}
              {explanation.disclaimer && <p className="text-xs text-gray-500">{explanation.disclaimer}</p>}
              <AIFeedbackButtons auditId={explanation.auditId} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
