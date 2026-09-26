import React from 'react';
import { Stethoscope } from 'lucide-react';

/**
 * Treating practitioner of a prior authorization or claim
 * (practitioner_license / _name / _specialty_code / _identifier_type).
 */
const PractitionerSummary = ({ record }) => {
  if (!record) return null;
  const hasPractitioner = record.practitioner_license || record.practitioner_name;
  return (
    <div className="mt-3 pt-3 border-t border-gray-100">
      <p className="text-xs text-gray-500 flex items-center gap-1">
        <Stethoscope className="h-3.5 w-3.5" />
        Treating practitioner
      </p>
      {hasPractitioner ? (
        <>
          <p className="font-medium">{record.practitioner_name || '-'}</p>
          <p className="text-sm text-gray-500 font-mono">
            {record.practitioner_identifier_type ? `${record.practitioner_identifier_type}: ` : ''}{record.practitioner_license || '-'}
          </p>
          {record.practitioner_specialty_code && (
            <p className="text-xs text-gray-500">Specialty: <span className="font-mono">{record.practitioner_specialty_code}</span></p>
          )}
        </>
      ) : (
        <p className="text-sm text-gray-400">Not recorded</p>
      )}
    </div>
  );
};

export default PractitionerSummary;
