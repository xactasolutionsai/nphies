import React from 'react';
import { AlertCircle, AlertTriangle, Info, CheckCircle, XCircle } from 'lucide-react';

/**
 * MedicationSafetyPanel Component
 * Displays comprehensive medication safety analysis results
 */
const MedicationSafetyPanel = ({ analysis, isLoading, error }) => {
  if (isLoading) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
          <span className="ml-3 text-gray-600">Analyzing medication safety...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <XCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="text-sm font-medium text-red-900">Analysis Failed</h4>
            <p className="text-sm text-red-700 mt-1">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!analysis) {
    return null;
  }

  const { 
    drugInteractions = [], 
    ageRelatedWarnings = [], 
    pregnancyWarnings = [],
    duplicateIngredients = [],
    sideEffectsOverview = {},
    overallRiskAssessment = 'moderate',
    recommendations = []
  } = analysis;

  const hasIssues = drugInteractions.length > 0 || ageRelatedWarnings.length > 0 || 
                     pregnancyWarnings.length > 0 || duplicateIngredients.length > 0;

  return (
    <div className="space-y-4">
      {/* Overall Risk Assessment */}
      <div className={`border rounded-lg p-4 ${
        overallRiskAssessment === 'high' ? 'bg-red-50 border-red-300' :
        overallRiskAssessment === 'moderate' ? 'bg-yellow-50 border-yellow-300' :
        'bg-green-50 border-green-300'
      }`}>
        <div className="flex items-center gap-3">
          {overallRiskAssessment === 'high' ? (
            <AlertCircle className="w-6 h-6 text-red-600" />
          ) : overallRiskAssessment === 'moderate' ? (
            <AlertTriangle className="w-6 h-6 text-yellow-600" />
          ) : (
            <CheckCircle className="w-6 h-6 text-green-600" />
          )}
          <div>
            <h3 className={`text-lg font-semibold ${
              overallRiskAssessment === 'high' ? 'text-red-900' :
              overallRiskAssessment === 'moderate' ? 'text-yellow-900' :
              'text-green-900'
            }`}>
              Overall Risk: {overallRiskAssessment.charAt(0).toUpperCase() + overallRiskAssessment.slice(1)}
            </h3>
            <p className={`text-sm ${
              overallRiskAssessment === 'high' ? 'text-red-700' :
              overallRiskAssessment === 'moderate' ? 'text-yellow-700' :
              'text-green-700'
            }`}>
              {hasIssues ? 'Review warnings and recommendations below' : 'No major safety concerns detected'}
            </p>
          </div>
        </div>
      </div>

      {/* Drug Interactions */}
      {drugInteractions.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="bg-gray-100 px-4 py-3 border-b">
            <h4 className="text-md font-semibold text-gray-900 flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-red-600" />
              Drug Interactions ({drugInteractions.length})
            </h4>
          </div>
          <div className="p-4 space-y-3">
            {drugInteractions.map((interaction, idx) => (
              <div
                key={idx}
                className={`border rounded-lg p-3 ${
                  interaction.severity === 'severe' ? 'bg-red-50 border-red-300' :
                  interaction.severity === 'moderate' ? 'bg-orange-50 border-orange-300' :
                  'bg-yellow-50 border-yellow-300'
                }`}
              >
                <div className="flex items-start gap-2 mb-2">
                  <span className={`px-2 py-1 rounded text-xs font-semibold ${
                    interaction.severity === 'severe' ? 'bg-red-200 text-red-900' :
                    interaction.severity === 'moderate' ? 'bg-orange-200 text-orange-900' :
                    'bg-yellow-200 text-yellow-900'
                  }`}>
                    {interaction.severity?.toUpperCase()}
                  </span>
                  <h5 className="text-sm font-semibold text-gray-900 flex-1">
                    {interaction.affectedDrugs?.join(' + ')}
                  </h5>
                </div>
                <p className="text-sm text-gray-700 mb-2">{interaction.interaction}</p>
                {interaction.clinicalSignificance && (
                  <p className="text-xs text-gray-600 mb-2">
                    <span className="font-medium">Clinical Significance:</span> {interaction.clinicalSignificance}
                  </p>
                )}
                {interaction.recommendation && (
                  <p className="text-xs font-medium text-blue-700 bg-blue-50 p-2 rounded">
                    💡 {interaction.recommendation}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Age-Related Warnings */}
      {ageRelatedWarnings.length > 0 && (
        <div className="bg-white border border-orange-200 rounded-lg overflow-hidden">
          <div className="bg-orange-100 px-4 py-3 border-b border-orange-200">
            <h4 className="text-md font-semibold text-gray-900 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-orange-600" />
              Age-Related Warnings ({ageRelatedWarnings.length})
            </h4>
          </div>
          <div className="p-4 space-y-3">
            {ageRelatedWarnings.map((warning, idx) => (
              <div key={idx} className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                <p className="text-sm font-semibold text-gray-900 mb-1">{warning.medication}</p>
                <p className="text-sm text-gray-700 mb-2">{warning.warning}</p>
                {warning.recommendation && (
                  <p className="text-xs text-orange-800 bg-orange-100 p-2 rounded">
                    📋 {warning.recommendation}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pregnancy Warnings */}
      {pregnancyWarnings.length > 0 && (
        <div className="bg-white border border-red-200 rounded-lg overflow-hidden">
          <div className="bg-red-100 px-4 py-3 border-b border-red-200">
            <h4 className="text-md font-semibold text-gray-900 flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-red-600" />
              Pregnancy Warnings ({pregnancyWarnings.length})
            </h4>
          </div>
          <div className="p-4 space-y-3">
            {pregnancyWarnings.map((warning, idx) => (
              <div key={idx} className="bg-red-50 border border-red-200 rounded-lg p-3">
                <div className="flex items-start justify-between mb-2">
                  <p className="text-sm font-semibold text-gray-900">{warning.medication}</p>
                  {warning.category && (
                    <span className="px-2 py-1 bg-red-200 text-red-900 rounded text-xs font-semibold">
                      Category {warning.category}
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-700 mb-2">{warning.warning}</p>
                {warning.recommendation && (
                  <p className="text-xs text-red-800 bg-red-100 p-2 rounded">
                    ⚠️ {warning.recommendation}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Duplicate Ingredients */}
      {duplicateIngredients.length > 0 && (
        <div className="bg-white border border-blue-200 rounded-lg overflow-hidden">
          <div className="bg-blue-100 px-4 py-3 border-b border-blue-200">
            <h4 className="text-md font-semibold text-gray-900 flex items-center gap-2">
              <Info className="w-5 h-5 text-blue-600" />
              Duplicate Active Ingredients ({duplicateIngredients.length})
            </h4>
          </div>
          <div className="p-4 space-y-3">
            {duplicateIngredients.map((duplicate, idx) => (
              <div key={idx} className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-sm font-semibold text-gray-900 mb-1">
                  {duplicate.activeIngredient}
                </p>
                <p className="text-sm text-gray-700 mb-1">
                  Found in: {duplicate.medications?.join(', ')}
                </p>
                <p className="text-xs text-blue-700 bg-blue-100 p-2 rounded">
                  ℹ️ {duplicate.recommendation}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Side Effects Overview */}
      {(sideEffectsOverview.common?.length > 0 || sideEffectsOverview.serious?.length > 0) && (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="bg-gray-100 px-4 py-3 border-b">
            <h4 className="text-md font-semibold text-gray-900">Side Effects Overview</h4>
          </div>
          <div className="p-4 space-y-4">
            {sideEffectsOverview.common?.length > 0 && (
              <div>
                <h5 className="text-sm font-semibold text-gray-900 mb-2">Common Side Effects:</h5>
                <ul className="list-disc list-inside text-sm text-gray-700 space-y-1">
                  {sideEffectsOverview.common.map((effect, idx) => (
                    <li key={idx}>{effect}</li>
                  ))}
                </ul>
              </div>
            )}
            {sideEffectsOverview.serious?.length > 0 && (
              <div>
                <h5 className="text-sm font-semibold text-red-900 mb-2">Serious Side Effects (Seek medical attention):</h5>
                <ul className="list-disc list-inside text-sm text-red-700 space-y-1">
                  {sideEffectsOverview.serious.map((effect, idx) => (
                    <li key={idx}>{effect}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Clinical Recommendations */}
      {recommendations.length > 0 && (
        <div className="bg-white border border-green-200 rounded-lg overflow-hidden">
          <div className="bg-green-100 px-4 py-3 border-b border-green-200">
            <h4 className="text-md font-semibold text-gray-900 flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-600" />
              Clinical Recommendations ({recommendations.length})
            </h4>
          </div>
          <div className="p-4">
            <ul className="space-y-2">
              {recommendations.map((rec, idx) => (
                <li key={idx} className="flex items-start gap-2 text-sm text-gray-700">
                  <span className="text-green-600 font-bold mt-1">•</span>
                  <span>{rec}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};

export default MedicationSafetyPanel;

