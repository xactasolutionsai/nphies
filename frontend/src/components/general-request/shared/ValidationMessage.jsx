import React from 'react';
import { AlertCircle } from 'lucide-react';

/**
 * ValidationMessage Component
 * Displays validation error messages for form fields
 */
const ValidationMessage = ({ error, className = '' }) => {
  if (!error) return null;
  
  return (
    <div className={`flex items-center gap-1 text-red-600 text-sm mt-1 ${className}`}>
      <AlertCircle className="h-3 w-3 flex-shrink-0" />
      <span>{error}</span>
    </div>
  );
};

export default ValidationMessage;

