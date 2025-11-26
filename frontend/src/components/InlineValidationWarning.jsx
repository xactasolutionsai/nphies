import React, { useState } from 'react';
import { AlertTriangle, Info, X } from 'lucide-react';

export default function InlineValidationWarning({ warning, onDismiss }) {
  const [dismissed, setDismissed] = useState(false);

  if (!warning || dismissed) return null;

  const getSeverityStyles = (severity) => {
    switch (severity) {
      case 'high':
        return {
          container: 'bg-red-50 border-red-300 text-red-800',
          icon: 'text-red-600',
          iconComponent: <AlertTriangle className="h-4 w-4" />
        };
      case 'medium':
        return {
          container: 'bg-orange-50 border-orange-300 text-orange-800',
          icon: 'text-orange-600',
          iconComponent: <AlertTriangle className="h-4 w-4" />
        };
      case 'low':
        return {
          container: 'bg-yellow-50 border-yellow-300 text-yellow-800',
          icon: 'text-yellow-600',
          iconComponent: <Info className="h-4 w-4" />
        };
      default:
        return {
          container: 'bg-gray-50 border-gray-300 text-gray-800',
          icon: 'text-gray-600',
          iconComponent: <Info className="h-4 w-4" />
        };
    }
  };

  const styles = getSeverityStyles(warning.severity);

  const handleDismiss = () => {
    setDismissed(true);
    if (onDismiss) {
      onDismiss(warning);
    }
  };

  return (
    <div className={`mt-2 p-3 rounded-md border ${styles.container} flex items-start gap-2 animate-slideIn`}>
      <div className={`mt-0.5 ${styles.icon}`}>
        {styles.iconComponent}
      </div>
      <div className="flex-1">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-medium">AI Validation</p>
            <p className="text-sm mt-1">{warning.message}</p>
            {warning.severity && (
              <p className="text-xs mt-1 opacity-75">
                Severity: {warning.severity}
              </p>
            )}
          </div>
          {onDismiss && (
            <button
              onClick={handleDismiss}
              className="ml-2 opacity-60 hover:opacity-100 transition-opacity"
              aria-label="Dismiss warning"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

