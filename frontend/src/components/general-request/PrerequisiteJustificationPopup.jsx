import React, { useState } from 'react';
import { AlertTriangle, FileText, X } from 'lucide-react';

/**
 * PrerequisiteJustificationPopup Component
 * Displays missing prerequisites and/or fit issues, and collects justification from user
 * 
 * @param {object} props
 * @param {boolean} props.isOpen - Whether the popup is visible
 * @param {array} props.dbPrerequisites - Prerequisites from database (strings)
 * @param {array} props.aiPrerequisites - Prerequisites from AI (objects with details)
 * @param {boolean} props.fitIssue - Whether diagnosis doesn't fit the scan
 * @param {array} props.suggestedDiagnoses - AI's suggested better diagnoses
 * @param {string} props.currentDiagnosis - User's current diagnosis
 * @param {string} props.requestedScan - Requested scan/service
 * @param {function} props.onSubmit - Callback when user submits with justification
 * @param {function} props.onCancel - Callback when user cancels
 */
const PrerequisiteJustificationPopup = ({
  isOpen,
  dbPrerequisites = [],
  aiPrerequisites = [],
  fitIssue = false,
  suggestedDiagnoses = [],
  currentDiagnosis = '',
  requestedScan = '',
  onSubmit,
  onCancel
}) => {
  const [justification, setJustification] = useState('');
  const [error, setError] = useState('');

  if (!isOpen) return null;

  // Combine and deduplicate prerequisites
  const hasDbPrereqs = dbPrerequisites && dbPrerequisites.length > 0;
  const hasAiPrereqs = aiPrerequisites && aiPrerequisites.length > 0;
  const hasAnyPrereqs = hasDbPrereqs || hasAiPrereqs;
  const hasAnyIssues = hasAnyPrereqs || fitIssue;

  const handleSubmit = () => {
    // Validate justification
    if (!justification || justification.trim().length < 10) {
      setError('Please provide a justification of at least 10 characters');
      return;
    }

    // Log for now (fake storage)
    console.log('=== VALIDATION OVERRIDE JUSTIFICATION ===');
    console.log('Justification:', justification);
    if (dbPrerequisites.length > 0) {
      console.log('DB Prerequisites Bypassed:', dbPrerequisites);
    }
    if (aiPrerequisites.length > 0) {
      console.log('AI Prerequisites Bypassed:', aiPrerequisites);
    }
    if (fitIssue) {
      console.log('Fit Issue Override:', {
        currentDiagnosis,
        requestedScan,
        suggestedDiagnoses
      });
    }
    console.log('=========================================');

    // Clear and submit
    setJustification('');
    setError('');
    onSubmit(justification);
  };

  const handleCancel = () => {
    setJustification('');
    setError('');
    onCancel();
  };

  const handleJustificationChange = (e) => {
    setJustification(e.target.value);
    if (error) setError(''); // Clear error on input
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-100 rounded-lg">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">
                {fitIssue && hasAnyPrereqs 
                  ? 'Validation Issues Detected'
                  : fitIssue 
                  ? 'Diagnosis-to-Scan Mismatch'
                  : 'Missing Prerequisites Detected'
                }
              </h3>
              <p className="text-sm text-gray-600">
                Justification required to proceed
              </p>
            </div>
          </div>
          <button
            onClick={handleCancel}
            className="text-gray-400 hover:text-gray-600 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-4 space-y-4">
          {/* DB Prerequisites */}
          {hasDbPrereqs && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="font-semibold text-blue-900 mb-2 flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Required Prerequisites (Database)
              </h4>
              <ul className="space-y-1 text-sm text-blue-800">
                {dbPrerequisites.map((prereq, index) => (
                  <li key={`db-${index}`} className="flex items-start gap-2">
                    <span className="text-blue-600 mt-0.5">•</span>
                    <span>{prereq}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* AI Prerequisites */}
          {hasAiPrereqs && (
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
              <h4 className="font-semibold text-purple-900 mb-2 flex items-center gap-2">
                <FileText className="h-4 w-4" />
                AI-Recommended Prerequisites
              </h4>
              <div className="space-y-3">
                {aiPrerequisites.map((prereq, index) => (
                  <div key={`ai-${index}`} className="text-sm">
                    {typeof prereq === 'string' ? (
                      <div className="flex items-start gap-2">
                        <span className="text-purple-600 mt-0.5">•</span>
                        <span className="text-purple-800">{prereq}</span>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <div className="flex items-start gap-2">
                          <span className="text-purple-600 mt-0.5 font-semibold">
                            {prereq.order || index + 1}.
                          </span>
                          <div className="flex-1">
                            <p className="font-medium text-purple-900">
                              {prereq.testName || prereq.name || 'Test required'}
                            </p>
                            {prereq.clinicalReason && (
                              <p className="text-purple-700 mt-0.5">
                                {prereq.clinicalReason}
                              </p>
                            )}
                            {prereq.urgency && (
                              <span className={`inline-block mt-1 px-2 py-0.5 rounded text-xs font-medium ${
                                prereq.urgency === 'immediate' || prereq.urgency === 'urgent'
                                  ? 'bg-red-100 text-red-700'
                                  : prereq.urgency === 'routine'
                                  ? 'bg-blue-100 text-blue-700'
                                  : 'bg-gray-100 text-gray-700'
                              }`}>
                                {prereq.urgency}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Fit Issue Section */}
          {fitIssue && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <h4 className="font-semibold text-red-900 mb-2 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                Diagnosis-to-Scan Mismatch
              </h4>
              <p className="text-sm text-red-800 mb-2">
                The diagnosis "<strong>{currentDiagnosis}</strong>" may not be appropriate for "<strong>{requestedScan}</strong>"
              </p>
              {suggestedDiagnoses && suggestedDiagnoses.length > 0 && (
                <div className="mt-3">
                  <p className="text-sm text-red-700 font-medium mb-1">Suggested diagnoses:</p>
                  <ul className="space-y-1 text-sm text-red-700">
                    {suggestedDiagnoses.map((diagnosis, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="text-red-600 mt-0.5">•</span>
                        <span>{diagnosis}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Warning Message */}
          {hasAnyIssues && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <p className="text-sm text-amber-800">
                <strong>Note:</strong> {hasAnyPrereqs && fitIssue 
                  ? 'The requested test requires prerequisites and the diagnosis may not be appropriate.'
                  : hasAnyPrereqs
                  ? 'The requested test typically requires the above prerequisites. Proceeding without them may affect the diagnostic quality or patient safety.'
                  : 'The diagnosis may not be appropriate for the requested scan.'
                } Please provide a justification for proceeding.
              </p>
            </div>
          )}

          {/* Justification Input */}
          <div className="space-y-2">
            <label htmlFor="justification" className="block text-sm font-medium text-gray-700">
              Justification for Proceeding <span className="text-red-500">*</span>
            </label>
            <textarea
              id="justification"
              rows={4}
              value={justification}
              onChange={handleJustificationChange}
              placeholder="Explain why the request should proceed without the required prerequisites (minimum 10 characters)..."
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-purple focus:border-transparent transition ${
                error ? 'border-red-500' : 'border-gray-300'
              }`}
            />
            {error && (
              <p className="text-sm text-red-600 flex items-center gap-1">
                <AlertTriangle className="h-4 w-4" />
                {error}
              </p>
            )}
            <p className="text-xs text-gray-500">
              {justification.length} / 10 minimum characters
            </p>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 px-6 py-4 flex items-center justify-end gap-3">
          <button
            onClick={handleCancel}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition font-medium"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            className="px-6 py-2 bg-primary-purple text-white rounded-lg hover:opacity-90 transition font-medium"
          >
            Submit with Justification
          </button>
        </div>
      </div>
    </div>
  );
};

export default PrerequisiteJustificationPopup;

