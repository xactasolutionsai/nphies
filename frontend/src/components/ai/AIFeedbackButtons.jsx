import React, { useState } from 'react';
import { ThumbsUp, ThumbsDown } from 'lucide-react';
import aiApi from '@/services/aiApi';

/**
 * "Was this helpful?" buttons for one AI output (ai_audit_log id). Every role may send feedback.
 * The comment is optional; the backend redacts personal data before storing it.
 */
export default function AIFeedbackButtons({ auditId, className = '' }) {
  const [state, setState] = useState('idle'); // idle | sending | sent | error
  const [verdict, setVerdict] = useState(null);
  const [comment, setComment] = useState('');

  if (!auditId) return null;

  const send = async (value) => {
    setVerdict(value);
    setState('sending');
    try {
      await aiApi.sendFeedback(auditId, value, comment.trim() || undefined);
      setState('sent');
    } catch {
      setState('error');
    }
  };

  if (state === 'sent') {
    return <p className={`text-xs text-gray-500 ${className}`}>Thank you — feedback recorded ({verdict}).</p>;
  }

  return (
    <div className={`flex flex-wrap items-center gap-2 text-xs ${className}`}>
      <span className="text-gray-500">Was this explanation useful?</span>
      <button
        type="button"
        disabled={state === 'sending'}
        onClick={() => send('accepted')}
        className="inline-flex items-center gap-1 rounded border border-gray-300 px-2 py-1 hover:bg-green-50 disabled:opacity-50"
      >
        <ThumbsUp className="h-3 w-3" /> Yes
      </button>
      <button
        type="button"
        disabled={state === 'sending'}
        onClick={() => send('rejected')}
        className="inline-flex items-center gap-1 rounded border border-gray-300 px-2 py-1 hover:bg-red-50 disabled:opacity-50"
      >
        <ThumbsDown className="h-3 w-3" /> No
      </button>
      <input
        type="text"
        value={comment}
        maxLength={2000}
        onChange={(e) => setComment(e.target.value)}
        placeholder="Optional comment (no patient data)"
        className="min-w-[12rem] flex-1 rounded border border-gray-300 px-2 py-1"
      />
      {state === 'error' && <span className="text-red-600">Feedback could not be sent.</span>}
    </div>
  );
}
