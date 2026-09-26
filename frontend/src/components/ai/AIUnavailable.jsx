import React from 'react';
import { AlertTriangle } from 'lucide-react';

/**
 * Visible notice that an AI part could not run (principle: fail visibly). It never implies that
 * something is valid or safe; the deterministic results shown next to it still apply.
 */
export default function AIUnavailable({ reason, children, className = '' }) {
  return (
    <div className={`flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 ${className}`}>
      <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0 text-amber-600" />
      <div>
        <p className="font-medium">AI part unavailable — manual review required</p>
        {reason && <p className="text-amber-800">{reason}</p>}
        {children}
      </div>
    </div>
  );
}
