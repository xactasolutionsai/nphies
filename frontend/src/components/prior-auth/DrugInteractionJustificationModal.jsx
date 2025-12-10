import React, { useState } from 'react';
import { AlertTriangle, AlertCircle, X, Shield, FileText, Pill } from 'lucide-react';

/**
 * DrugInteractionJustificationModal Component
 * Displays drug interactions and safety warnings, requires justification to proceed
 * 
 * @param {object} props
 * @param {boolean} props.isOpen - Whether the modal is visible
 * @param {object} props.safetyAnalysis - The medication safety analysis object
 * @param {function} props.onSubmit - Callback when user submits with justification
 * @param {function} props.onCancel - Callback when user cancels
 */
const DrugInteractionJustificationModal = ({
  isOpen,
  safetyAnalysis,
  onSubmit,
  onCancel
}) => {
  const [justification, setJustification] = useState('');
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const {
    drugInteractions = [],
    ageRelatedWarnings = [],
    pregnancyWarnings = [],
    duplicateIngredients = [],
    overallRiskAssessment = 'moderate'
  } = safetyAnalysis || {};

  const hasDrugInteractions = drugInteractions.length > 0;
  const hasAgeWarnings = ageRelatedWarnings.length > 0;
  const hasPregnancyWarnings = pregnancyWarnings.length > 0;
  const hasDuplicates = duplicateIngredients.length > 0;
  const isHighRisk = overallRiskAssessment === 'high';

  const handleSubmit = () => {
    if (!justification || justification.trim().length < 10) {
      setError('Please provide a justification of at least 10 characters');
      return;
    }

    // Clear and submit
    setJustification('');
    setError('');
    onSubmit(justification.trim());
  };

  const handleCancel = () => {
    setJustification('');
    setError('');
    onCancel();
  };

  const handleJustificationChange = (e) => {
    setJustification(e.target.value);
    if (error) setError('');
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${isHighRisk ? 'bg-red-100' : 'bg-amber-100'}`}>
              <Shield className={`h-5 w-5 ${isHighRisk ? 'text-red-600' : 'text-amber-600'}`} />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">
                Drug Safety Warnings Detected
              </h3>
              <p className="text-sm text-gray-600">
                Justification required to proceed with this authorization
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
          {/* Overall Risk Badge */}
          <div className={`flex items-center gap-2 p-3 rounded-lg ${
            isHighRisk ? 'bg-red-50 border border-red-200' : 'bg-amber-50 border border-amber-200'
          }`}>
            <AlertCircle className={`h-5 w-5 ${isHighRisk ? 'text-red-600' : 'text-amber-600'}`} />
            <span className={`font-medium ${isHighRisk ? 'text-red-900' : 'text-amber-900'}`}>
              Overall Risk Assessment: {overallRiskAssessment?.charAt(0).toUpperCase() + overallRiskAssessment?.slice(1)}
            </span>
          </div>

          {/* Drug Interactions */}
          {hasDrugInteractions && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <h4 className="font-semibold text-red-900 mb-3 flex items-center gap-2">
                <AlertCircle className="h-4 w-4" />
                Drug Interactions ({drugInteractions.length})
              </h4>
              <div className="space-y-3">
                {drugInteractions.map((interaction, index) => (
                  <div key={index} className="bg-white border border-red-100 rounded-lg p-3">
                    <div className="flex items-start gap-2 mb-2">
                      <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                        interaction.severity === 'severe' ? 'bg-red-200 text-red-900' :
                        interaction.severity === 'moderate' ? 'bg-orange-200 text-orange-900' :
                        'bg-yellow-200 text-yellow-900'
                      }`}>
                        {interaction.severity?.toUpperCase()}
                      </span>
                      <span className="font-medium text-gray-900 text-sm">
                        {interaction.affectedDrugs?.join(' + ')}
                      </span>
                    </div>
                    <p className="text-sm text-gray-700">{interaction.interaction}</p>
                    {interaction.clinicalSignificance && (
                      <p className="text-xs text-gray-600 mt-1">
                        <span className="font-medium">Clinical Significance:</span> {interaction.clinicalSignificance}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Age-Related Warnings */}
          {hasAgeWarnings && (
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
              <h4 className="font-semibold text-orange-900 mb-3 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                Age-Related Warnings ({ageRelatedWarnings.length})
              </h4>
              <div className="space-y-2">
                {ageRelatedWarnings.map((warning, index) => (
                  <div key={index} className="bg-white border border-orange-100 rounded-lg p-3">
                    <p className="text-sm font-medium text-gray-900">{warning.medication}</p>
                    <p className="text-sm text-gray-700 mt-1">{warning.warning}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Pregnancy Warnings */}
          {hasPregnancyWarnings && (
            <div className="bg-pink-50 border border-pink-200 rounded-lg p-4">
              <h4 className="font-semibold text-pink-900 mb-3 flex items-center gap-2">
                <AlertCircle className="h-4 w-4" />
                Pregnancy Warnings ({pregnancyWarnings.length})
              </h4>
              <div className="space-y-2">
                {pregnancyWarnings.map((warning, index) => (
                  <div key={index} className="bg-white border border-pink-100 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-sm font-medium text-gray-900">{warning.medication}</p>
                      {warning.category && (
                        <span className="px-2 py-0.5 bg-pink-200 text-pink-900 rounded text-xs font-semibold">
                          Category {warning.category}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-700">{warning.warning}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Duplicate Ingredients */}
          {hasDuplicates && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="font-semibold text-blue-900 mb-3 flex items-center gap-2">
                <Pill className="h-4 w-4" />
                Duplicate Active Ingredients ({duplicateIngredients.length})
              </h4>
              <div className="space-y-2">
                {duplicateIngredients.map((dup, index) => (
                  <div key={index} className="bg-white border border-blue-100 rounded-lg p-3">
                    <p className="text-sm font-medium text-gray-900">{dup.activeIngredient}</p>
                    <p className="text-sm text-gray-700 mt-1">
                      Found in: {dup.medications?.join(', ')}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Warning Message */}
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <p className="text-sm text-amber-800">
              <strong>Important:</strong> The medication combination in this authorization has potential safety concerns. 
              Please provide a clinical justification for proceeding with this prescription. 
              This justification will be recorded for audit purposes.
            </p>
          </div>

          {/* Justification Input */}
          <div className="space-y-2">
            <label htmlFor="justification" className="block text-sm font-medium text-gray-700">
              Clinical Justification for Proceeding <span className="text-red-500">*</span>
            </label>
            <textarea
              id="justification"
              rows={4}
              value={justification}
              onChange={handleJustificationChange}
              placeholder="Provide clinical reasoning for proceeding despite the safety warnings (minimum 10 characters)..."
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition ${
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
        <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 px-6 py-4 flex items-center justify-between">
          <p className="text-xs text-gray-500 flex items-center gap-1">
            <FileText className="h-3 w-3" />
            This justification will be saved with the authorization record
          </p>
          <div className="flex items-center gap-3">
            <button
              onClick={handleCancel}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition font-medium"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition font-medium"
            >
              Submit with Justification
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DrugInteractionJustificationModal;

