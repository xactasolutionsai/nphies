import React from 'react';

/**
 * RequiredFieldIndicator Component
 * Displays an asterisk (*) for required fields
 */
const RequiredFieldIndicator = () => {
  return (
    <span className="text-red-500 ml-1" aria-label="required">
      *
    </span>
  );
};

export default RequiredFieldIndicator;

