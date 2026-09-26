import React, { useEffect, useState } from 'react';
import { Clock } from 'lucide-react';
import aiApi from '@/services/aiApi';
import { extractErrorMessage } from '@/services/api';
import AIBadge from '@/components/ai/AIBadge';

const formatSeconds = (seconds) => {
  if (seconds === null || seconds === undefined) return '—';
  if (seconds < 120) return `${Math.round(seconds)} s`;
  if (seconds < 7200) return `${Math.round(seconds / 60)} min`;
  return `${(seconds / 3600).toFixed(1)} h`;
};

const TYPE_LABELS = { prior_authorization: 'Prior authorization', claim: 'Claim' };

function Percentiles({ value }) {
  if (!value) return <span>—</span>;
  if (value.insufficientData) {
    return <span className="text-gray-500">not enough data (n={value.count}, need {value.minimum})</span>;
  }
  return <span>P50 {formatSeconds(value.p50Seconds)} · P90 {formatSeconds(value.p90Seconds)} <span className="text-gray-500">(n={value.n})</span></span>;
}

/**
 * Advisory poll statistics (GET /api/ai/analytics/poll-timing). Read-only: nothing here changes
 * the poll scheduler. `compact` shows only the global advice (used on the System Poll page).
 */
export default function PollTimingAdvisory({ range, compact = false }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const from = range?.from;
  const to = range?.to;

  useEffect(() => {
    let active = true;
    setError(null);
    aiApi.getPollTiming({ from, to })
      .then(result => { if (active) setData(result); })
      .catch(err => { if (active) setError(extractErrorMessage(err)); });
    return () => { active = false; };
  }, [from, to]);

  if (error) return <p className="text-sm text-red-700">Poll statistics unavailable: {error}</p>;
  if (!data) return <p className="text-sm text-gray-500">Loading poll statistics…</p>;
  const g = data.global || {};

  return (
    <div className="space-y-3 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 font-medium text-gray-900">
          <Clock className="h-4 w-4 text-gray-600" /> Poll timing (advisory)
        </div>
        <AIBadge source={data.source} certainty={data.certainty} basis={data.basis} />
      </div>
      <p className="text-gray-600">{data.note}</p>
      {g.insufficientData ? (
        <p className="text-gray-700">
          Not enough completed polls in {data.range?.from} – {data.range?.to} for a recommendation (n={g.count}, need {g.minimum}).
          Current interval: {g.currentIntervalMinutes} min{g.scheduledPollingEnabled ? '' : ' (scheduled polling disabled)'}.
        </p>
      ) : (
        <ul className="list-disc pl-5 text-gray-700 space-y-1">
          <li>{g.completedPolls} completed polls, {g.messages} messages: {g.messagesPerPoll} messages per poll, {Math.round((g.emptyPollRatio || 0) * 100)}% empty polls.</li>
          <li>Median time between polls: {formatSeconds(g.medianSecondsBetweenPolls)}; arrival rate {g.arrivalRatePerHour ?? '—'} messages/hour.</li>
          <li>
            Suggested interval band: {g.recommendedIntervalMinutes
              ? `${g.recommendedIntervalMinutes.minMinutes}–${g.recommendedIntervalMinutes.maxMinutes} min`
              : 'none (no messages arrived)'}; currently {g.currentIntervalMinutes} min{g.scheduledPollingEnabled ? '' : ' (scheduled polling disabled)'}.
            <span className="text-gray-500"> {g.recommendationBasis}</span>
          </li>
        </ul>
      )}
      {!compact && (
        <div className="overflow-auto rounded border border-gray-100">
          <table className="w-full text-xs">
            <thead className="bg-gray-50 text-left text-gray-600">
              <tr><th className="p-2">Insurer</th><th className="p-2">Type</th><th className="p-2">Submission → first response</th><th className="p-2">Submission → first non-queued response</th></tr>
            </thead>
            <tbody>
              {(data.perInsurer || []).length === 0 && (
                <tr><td colSpan={4} className="p-2 text-gray-500">No responses in this range.</td></tr>
              )}
              {(data.perInsurer || []).map(row => (
                <tr key={`${row.requestType}:${row.insurerId}`} className="border-t border-gray-100">
                  <td className="p-2">{row.insurerName || row.insurerId || 'Unknown insurer'}</td>
                  <td className="p-2">{TYPE_LABELS[row.requestType] || row.requestType}</td>
                  <td className="p-2"><Percentiles value={row.firstResponse} /></td>
                  <td className="p-2"><Percentiles value={row.finalResponse} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
