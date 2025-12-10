import React, { useState } from 'react';
import { Pill, Plus, Loader2, AlertCircle, Info, ChevronDown, ChevronUp, Database, CheckCircle, User } from 'lucide-react';

/**
 * MedicationSuggestionsPanel Component
 * Displays AI-generated medication suggestions based on diagnosis
 * Enhanced to show matching medications from the system database
 */
const MedicationSuggestionsPanel = ({ 
  suggestions, 
  isLoading, 
  error, 
  onAddMedication,
  onAddSystemMedication, // New prop for adding medications with system code
  patientContext // Patient context used for suggestions (age, gender, emergencyCase)
}) => {
  const [expandedSuggestions, setExpandedSuggestions] = useState({});

  const toggleExpanded = (idx) => {
    setExpandedSuggestions(prev => ({
      ...prev,
      [idx]: !prev[idx]
    }));
  };

  if (isLoading) {
    return (
      <div className="bg-white border border-blue-200 rounded-lg p-6">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-10 h-10 animate-spin text-blue-600" />
          <span className="ml-3 text-gray-600">Generating AI medication suggestions...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="text-sm font-medium text-red-900">Failed to Generate Suggestions</h4>
            <p className="text-sm text-red-700 mt-1">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!suggestions || suggestions.length === 0) {
    return null;
  }

  return (
    <div className="bg-white border border-blue-200 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-100 to-purple-100 px-4 py-3 border-b border-blue-200">
        <h3 className="text-lg font-semibold text-blue-900 flex items-center gap-2">
          <Pill className="w-5 h-5" />
          AI Medication Suggestions ({suggestions.length})
        </h3>
        <p className="text-sm text-blue-700 mt-1">
          Based on the diagnosis and patient profile. Click on system medications to add directly.
        </p>
        
        {/* Patient Context Display */}
        {patientContext && (patientContext.age || patientContext.gender) && (
          <div className="mt-2 flex items-center gap-2 flex-wrap">
            <span className="text-xs text-blue-600 flex items-center gap-1">
              <User className="w-3 h-3" />
              Suggestions tailored for:
            </span>
            {patientContext.age && (
              <span className="px-2 py-0.5 bg-blue-200 text-blue-800 text-xs font-medium rounded">
                Age {patientContext.age} years
              </span>
            )}
            {patientContext.gender && (
              <span className="px-2 py-0.5 bg-purple-200 text-purple-800 text-xs font-medium rounded">
                {patientContext.gender}
              </span>
            )}
            {patientContext.emergencyCase && (
              <span className="px-2 py-0.5 bg-red-200 text-red-800 text-xs font-medium rounded">
                Emergency Case
              </span>
            )}
          </div>
        )}
      </div>

      {/* Suggestions */}
      <div className="p-4 space-y-4">
        {suggestions.map((suggestion, idx) => (
          <div
            key={idx}
            className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
          >
            {/* Header */}
            <div className="flex justify-between items-start mb-3">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <h4 className="text-lg font-semibold text-gray-900">
                    {suggestion.genericName}
                  </h4>
                  {suggestion.ageAppropriate === false && (
                    <span className="px-2 py-1 bg-orange-100 text-orange-800 text-xs font-medium rounded">
                      Age Consideration
                    </span>
                  )}
                  {suggestion.hasSystemMatches && (
                    <span className="px-2 py-1 bg-green-100 text-green-800 text-xs font-medium rounded flex items-center gap-1">
                      <Database className="w-3 h-3" />
                      {suggestion.systemMedications?.length} in System
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-600">
                  <span className="font-medium">Class:</span> {suggestion.medicationClass}
                </p>
              </div>
              
              {!suggestion.hasSystemMatches && (
                <button
                  onClick={() => onAddMedication(suggestion)}
                  className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 flex items-center gap-2 text-sm font-medium"
                  title="Add as generic - no exact match in system"
                >
                  <Plus className="w-4 h-4" />
                  Add Generic
                </button>
              )}
            </div>

            {/* System Medications - Matching products from database */}
            {suggestion.hasSystemMatches && suggestion.systemMedications?.length > 0 && (
              <div className="mb-3">
                <button
                  onClick={() => toggleExpanded(idx)}
                  className="flex items-center gap-2 text-sm font-medium text-green-700 mb-2 hover:text-green-800"
                >
                  <Database className="w-4 h-4" />
                  Available in System ({suggestion.systemMedications.length} products)
                  {expandedSuggestions[idx] ? (
                    <ChevronUp className="w-4 h-4" />
                  ) : (
                    <ChevronDown className="w-4 h-4" />
                  )}
                </button>
                
                {(expandedSuggestions[idx] || suggestion.systemMedications.length <= 3) && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3 space-y-2">
                    {suggestion.systemMedications.slice(0, expandedSuggestions[idx] ? undefined : 3).map((med, medIdx) => (
                      <div 
                        key={medIdx}
                        className="flex items-center justify-between bg-white rounded-lg p-3 border border-green-100 hover:border-green-300 transition-colors"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-900 truncate">{med.display}</p>
                          <div className="flex flex-wrap gap-2 mt-1 text-xs text-gray-600">
                            <span className="bg-gray-100 px-2 py-0.5 rounded">Code: {med.code}</span>
                            {med.strength && <span className="bg-blue-100 px-2 py-0.5 rounded">{med.strength}</span>}
                            {med.dosageForm && <span className="bg-purple-100 px-2 py-0.5 rounded">{med.dosageForm}</span>}
                            {med.price && <span className="bg-yellow-100 px-2 py-0.5 rounded">{med.price} SAR</span>}
                          </div>
                        </div>
                        <button
                          onClick={() => onAddSystemMedication ? onAddSystemMedication(med, suggestion) : onAddMedication({
                            ...suggestion,
                            selectedMedication: med
                          })}
                          className="ml-3 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-1 text-sm font-medium flex-shrink-0"
                        >
                          <CheckCircle className="w-4 h-4" />
                          Add
                        </button>
                      </div>
                    ))}
                    {!expandedSuggestions[idx] && suggestion.systemMedications.length > 3 && (
                      <button
                        onClick={() => toggleExpanded(idx)}
                        className="text-sm text-green-700 hover:text-green-800 font-medium"
                      >
                        Show {suggestion.systemMedications.length - 3} more...
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Brand Names */}
            {suggestion.brandNamesExamples && suggestion.brandNamesExamples.length > 0 && (
              <div className="mb-3">
                <p className="text-xs font-medium text-gray-700 mb-1">Brand Names (Reference):</p>
                <div className="flex flex-wrap gap-2">
                  {suggestion.brandNamesExamples.map((brand, brandIdx) => (
                    <span
                      key={brandIdx}
                      className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs"
                    >
                      {brand}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Dosage */}
            {suggestion.typicalDosage && (
              <div className="mb-3 p-3 bg-green-50 border border-green-200 rounded">
                <p className="text-xs font-medium text-green-900 mb-1">
                  💊 Typical Dosage:
                </p>
                <p className="text-sm text-green-800">{suggestion.typicalDosage}</p>
              </div>
            )}

            {/* Reasoning */}
            {suggestion.reasoning && (
              <div className="mb-3 p-3 bg-blue-50 border border-blue-200 rounded">
                <p className="text-xs font-medium text-blue-900 mb-1">
                  📋 Clinical Rationale:
                </p>
                <p className="text-sm text-blue-800">{suggestion.reasoning}</p>
              </div>
            )}

            {/* Contraindications */}
            {suggestion.contraindications && (
              <div className="mb-3 p-3 bg-yellow-50 border border-yellow-200 rounded">
                <p className="text-xs font-medium text-yellow-900 mb-1 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  Key Contraindications:
                </p>
                <p className="text-sm text-yellow-800">{suggestion.contraindications}</p>
              </div>
            )}

            {/* Monitoring Required */}
            {suggestion.monitoringRequired && (
              <div className="p-3 bg-purple-50 border border-purple-200 rounded">
                <p className="text-xs font-medium text-purple-900 mb-1 flex items-center gap-1">
                  <Info className="w-3 h-3" />
                  Monitoring Required:
                </p>
                <p className="text-sm text-purple-800">{suggestion.monitoringRequired}</p>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Footer Note */}
      <div className="bg-gray-50 px-4 py-3 border-t border-gray-200">
        <p className="text-xs text-gray-600">
          💡 <strong>Note:</strong> Green highlighted medications are available in your system database and can be added directly with their GTIN codes. 
          AI suggestions are based on standard treatment protocols - always verify appropriateness for the specific patient.
        </p>
      </div>
    </div>
  );
};

export default MedicationSuggestionsPanel;
