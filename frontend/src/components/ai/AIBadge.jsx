import React from 'react';
import { Bot, Calculator, ListChecks, BookOpen } from 'lucide-react';

const SOURCE_LABELS = {
  rules: { label: 'Rules', icon: ListChecks, className: 'bg-slate-100 text-slate-800 border-slate-300' },
  statistics: { label: 'Statistics', icon: Calculator, className: 'bg-blue-50 text-blue-800 border-blue-200' },
  retrieval: { label: 'Reference documents', icon: BookOpen, className: 'bg-emerald-50 text-emerald-800 border-emerald-200' },
  llm: { label: 'AI (language model)', icon: Bot, className: 'bg-purple-50 text-purple-800 border-purple-200' }
};

const CERTAINTY_LABELS = { high: 'high certainty', medium: 'medium certainty', low: 'low certainty' };

function basisText(basis) {
  if (!basis) return '';
  if (typeof basis === 'string') return basis;
  const parts = [basis.description];
  if (basis.sampleSize !== undefined) parts.push(`Sample: ${basis.sampleSize}`);
  if (basis.minimumSampleSize !== undefined) parts.push(`Minimum sample: ${basis.minimumSampleSize}`);
  if (basis.codesChecked !== undefined) parts.push(`Codes checked: ${basis.codesChecked}, found: ${basis.codesMatched}`);
  if (basis.referenceRule) parts.push(basis.referenceRule);
  if (basis.model) parts.push(`Model: ${basis.model}`);
  return parts.filter(Boolean).join(' · ');
}

/**
 * Shows where an advisory result comes from (source), how certain it is and, on hover or
 * below (showBasis), what it was based on. Used on every AI / rules / statistics panel.
 */
export default function AIBadge({ source, certainty, basis, showBasis = false, className = '' }) {
  const meta = SOURCE_LABELS[source] || { label: source || 'Unknown source', icon: Bot, className: 'bg-gray-100 text-gray-700 border-gray-300' };
  const Icon = meta.icon;
  const text = basisText(basis);
  return (
    <div className={`inline-flex flex-col gap-1 ${className}`}>
      <span
        className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${meta.className}`}
        title={text || undefined}
      >
        <Icon className="h-3 w-3" />
        {meta.label}
        {certainty && <span className="opacity-75">· {CERTAINTY_LABELS[certainty] || certainty}</span>}
      </span>
      {showBasis && text && <span className="text-xs text-gray-500">{text}</span>}
    </div>
  );
}
