import React, { useEffect, useState } from 'react';
import { BarChart3, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import aiApi from '@/services/aiApi';
import { extractErrorMessage } from '@/services/api';
import AIBadge from '@/components/ai/AIBadge';
import PollTimingAdvisory from '@/components/ai/PollTimingAdvisory';

const TYPE_LABELS = { prior_authorization: 'Prior authorization', claim: 'Claim' };
const KIND_LABELS = { error: 'NPHIES error', adjudication_reason: 'Adjudication reason' };

const isoDay = (date) => date.toISOString().slice(0, 10);
const defaultRange = () => {
  const to = new Date();
  const from = new Date(to.getTime() - 89 * 86400000);
  return { from: isoDay(from), to: isoDay(to) };
};

/**
 * AI Insights: rejection analytics per insurer and poll timing. All numbers come from SQL on the
 * stored requests and responses (source 'statistics'); no language model is involved.
 */
export default function AIInsights() {
  const [range, setRange] = useState(defaultRange);
  const [draft, setDraft] = useState(range);
  const [type, setType] = useState('');
  const [top, setTop] = useState(10);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    aiApi.getRejectionAnalytics({ from: range.from, to: range.to, type, top })
      .then(result => { if (active) setData(result); })
      .catch(err => { if (active) setError(extractErrorMessage(err)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [range, type, top]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-sm">
          <span className="block text-gray-600">From</span>
          <input type="date" value={draft.from} onChange={e => setDraft(d => ({ ...d, from: e.target.value }))} className="rounded border border-gray-300 px-2 py-1" />
        </label>
        <label className="text-sm">
          <span className="block text-gray-600">To</span>
          <input type="date" value={draft.to} onChange={e => setDraft(d => ({ ...d, to: e.target.value }))} className="rounded border border-gray-300 px-2 py-1" />
        </label>
        <label className="text-sm">
          <span className="block text-gray-600">Request type</span>
          <select value={type} onChange={e => setType(e.target.value)} className="rounded border border-gray-300 px-2 py-1">
            <option value="">All</option>
            <option value="prior_authorization">Prior authorizations</option>
            <option value="claim">Claims</option>
          </select>
        </label>
        <label className="text-sm">
          <span className="block text-gray-600">Top codes</span>
          <select value={top} onChange={e => setTop(Number(e.target.value))} className="rounded border border-gray-300 px-2 py-1">
            {[5, 10, 20, 50].map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
        <button
          type="button"
          onClick={() => setRange({ ...draft })}
          className="inline-flex items-center gap-1 rounded bg-primary-purple px-3 py-1.5 text-sm font-medium text-white hover:opacity-90"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Apply
        </button>
      </div>

      <Card>
        <CardHeader className="p-6">
          <CardTitle className="flex items-center gap-2 text-lg"><BarChart3 className="h-5 w-5" /> Rejections and errors per insurer</CardTitle>
          <CardDescription>
            Adjudication reasons of denied/partial items and NPHIES error codes of stored responses. Counts are exact;
            shares are shown only when the group has enough records.
          </CardDescription>
          {data && <AIBadge source={data.source} certainty={data.certainty} basis={data.basis} showBasis />}
        </CardHeader>
        <CardContent className="px-6 space-y-4">
          {error && <p className="text-sm text-red-700">{error}</p>}
          {data && data.groups.length === 0 && <p className="text-sm text-gray-600">No requests with responses in {data.range.from} – {data.range.to}.</p>}
          {data?.groups.map(group => (
            <div key={`${group.requestType}:${group.recordType}:${group.insurerId}`} className="rounded-lg border border-gray-200">
              <div className="flex flex-wrap items-center justify-between gap-2 bg-gray-50 px-3 py-2 text-sm">
                <span className="font-medium text-gray-900">
                  {group.insurerName || group.insurerId || 'Unknown insurer'} · {TYPE_LABELS[group.requestType] || group.requestType} · {group.recordType}
                </span>
                <span className="text-gray-600">
                  Sample: {group.sampleSize} records with a response · {group.affectedRecords} denied/partial/error · {group.totalOccurrences} occurrences
                  {group.insufficientData && <span className="ml-2 text-amber-700">(below the minimum of {group.minimum}: shares not shown)</span>}
                </span>
              </div>
              <table className="w-full text-xs">
                <thead className="text-left text-gray-600">
                  <tr><th className="p-2">Kind</th><th className="p-2">Code</th><th className="p-2">Count</th><th className="p-2">Records</th><th className="p-2">Share</th><th className="p-2">Description</th></tr>
                </thead>
                <tbody>
                  {group.codes.map(code => (
                    <tr key={`${code.kind}:${code.code}:${code.system || ''}`} className="border-t border-gray-100 align-top">
                      <td className="p-2">{KIND_LABELS[code.kind] || code.kind}</td>
                      <td className="p-2 font-mono break-all">{code.code}</td>
                      <td className="p-2">{code.count}</td>
                      <td className="p-2">{code.records}</td>
                      <td className="p-2">{code.share === null ? '—' : `${(code.share * 100).toFixed(1)}%`}</td>
                      <td className="p-2">
                        {code.description && <span>{code.description} <span className="text-gray-500">({code.descriptionSource})</span></span>}
                        {code.note && <span className="text-gray-500">{code.note}</span>}
                        {code.nphiesMessage && <div className="text-gray-600">NPHIES message: {code.nphiesMessage}</div>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="p-6">
          <CardTitle className="text-lg">Polling and response times</CardTitle>
          <CardDescription>Advisory statistics; the poll scheduler is not changed from here.</CardDescription>
        </CardHeader>
        <CardContent className="px-6">
          <PollTimingAdvisory range={range} />
        </CardContent>
      </Card>
    </div>
  );
}
