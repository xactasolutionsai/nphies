import api, { AI_FEATURES_ENABLED } from '@/services/api';
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Pill, Shield, Sparkles, RefreshCw } from 'lucide-react';
import MedicationsTable from '../shared/MedicationsTable';
import MedicationSafetyPanel from '../shared/MedicationSafetyPanel';
import MedicationSuggestionsPanel from '../shared/MedicationSuggestionsPanel';


/**
 * MedicationsStep Component
 * Step 6: Medications management with AI safety and suggestions
 */
const MedicationsStep = React.memo(({ 
  formData, 
  addMedication, 
  removeMedication, 
  updateMedication,
  setMedicationFromSearch,
  setMedicationWarnings,
  setSafetyAnalysis: setParentSafetyAnalysis
}) => {
  const [safetyAnalysis, setSafetyAnalysis] = useState(null);
  const [safetyLoading, setSafetyLoading] = useState(false);
  const [safetyError, setSafetyError] = useState(null);
  
  const [suggestions, setSuggestions] = useState([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [suggestionsError, setSuggestionsError] = useState(null);
  
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Medications that have a name, keeping their index in the full list so that
  // warnings are applied to the right rows (empty rows would otherwise shift them)
  const validMedications = useMemo(() => 
    formData.medications
      .map((med, index) => ({ med, index }))
      .filter(({ med }) => med.medicationName?.trim()),
    [formData.medications]
  );
  // Re-run auto-analysis when any medication name changes, not only the count
  const medicationNamesKey = useMemo(
    () => validMedications.map(({ med }) => med.medicationName.trim().toLowerCase()).join('|'),
    [validMedications]
  );

  // Track if we've already cleared warnings to prevent infinite loops
  const hasWarningsRef = useRef(false);

  // Calculate patient age from DOB
  const calculateAge = (dob) => {
    if (!dob) return null;
    const birthDate = new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  // Analyze medication safety (respects AI_FEATURES_ENABLED via api.analyzeMedicationSafety)
  const analyzeSafety = useCallback(async () => {
    if (!AI_FEATURES_ENABLED) return;
    if (validMedications.length === 0) {
      setSafetyAnalysis(null);
      return;
    }

    setSafetyLoading(true);
    setSafetyError(null);

    try {
      const patientAge = calculateAge(formData.patient?.dob);
      
      const data = await api.analyzeMedicationSafety(
        validMedications.map(({ med }) => ({
          name: med.medicationName,
          activeIngredient: med.activeIngredient,
          mrid: med.mrid
        })),
        {
          age: patientAge,
          gender: formData.patient?.gender,
          isPregnant: formData.service?.conditions?.pregnancy || false,
          diagnosis: formData.service?.diagnosis
        }
      );
      if (data?.disabled) return;
      
      if (data.success && data.analysis) {
        // Store only the analysis part (not the whole response)
        setSafetyAnalysis(data.analysis);
        setParentSafetyAnalysis(data.analysis);
        
        // Update medication warnings in form state, keyed by index in the full list
        const warnings = {};
        const analysis = data.analysis;
        
        validMedications.forEach(({ med, index }) => {
          warnings[index] = {
            hasInteractions: analysis.drugInteractions?.some(i => 
              i.affectedDrugs?.includes(med.medicationName)
            ) || false,
            hasSideEffects: analysis.sideEffectsOverview?.common?.length > 0 || 
                           analysis.sideEffectsOverview?.serious?.length > 0 || false,
            hasAgeWarning: analysis.ageRelatedWarnings?.some(w => 
              w.medication === med.medicationName
            ) || false,
            hasPregnancyWarning: analysis.pregnancyWarnings?.some(w => 
              w.medication === med.medicationName
            ) || false,
            isDuplicate: analysis.duplicateIngredients?.some(d => 
              d.medications?.includes(med.medicationName)
            ) || false
          };
        });
        
        setMedicationWarnings(warnings);
        hasWarningsRef.current = true;
      } else {
        throw new Error(data.error || 'Analysis failed');
      }
    } catch (error) {
      console.error('Safety analysis error:', error);
      setSafetyError(error.response?.data?.error || error.message);
    } finally {
      setSafetyLoading(false);
    }
  }, [validMedications, formData.patient, formData.service, setMedicationWarnings, setParentSafetyAnalysis]);

  // Get AI medication suggestions (respects AI_FEATURES_ENABLED via api.getMedicationSuggestions)
  const getSuggestions = useCallback(async () => {
    if (!AI_FEATURES_ENABLED) return;
    if (!formData.service?.diagnosis) {
      setSuggestionsError('Diagnosis is required to generate suggestions');
      return;
    }

    setSuggestionsLoading(true);
    setSuggestionsError(null);

    try {
      const patientAge = calculateAge(formData.patient?.dob);
      
      const data = await api.getMedicationSuggestions(
        formData.service.diagnosis,
        patientAge,
        formData.patient?.gender,
        String(formData.service?.urgency || '').toLowerCase() === 'emergency'
      );
      if (data?.disabled) return;
      
      if (data.success && data.suggestions) {
        setSuggestions(data.suggestions);
        setShowSuggestions(true);
      } else {
        throw new Error(data.error || 'No suggestions generated');
      }
    } catch (error) {
      console.error('Suggestions error:', error);
      setSuggestionsError(error.response?.data?.error || error.message);
    } finally {
      setSuggestionsLoading(false);
    }
  }, [formData.service, formData.patient]);

  // Add suggested medication to the list
  const handleAddSuggestion = (suggestion) => {
    addMedication();
    const newIndex = formData.medications.length;
    
    // Set the medication data after a brief delay to ensure state update
    setTimeout(() => {
      updateMedication(newIndex, 'medicationName', suggestion.genericName);
      updateMedication(newIndex, 'type', 'Suggested by AI');
    }, 100);
  };

  // Auto-analyze when medications (names) change
  useEffect(() => {
    if (!AI_FEATURES_ENABLED) return undefined;
    if (validMedications.length > 0) {
      const timer = setTimeout(() => {
        analyzeSafety();
      }, 1000); // Debounce for 1 second
      
      return () => clearTimeout(timer);
    } else {
      // Only clear if there were warnings before
      if (hasWarningsRef.current) {
        setSafetyAnalysis(null);
        setParentSafetyAnalysis(null);
        setMedicationWarnings({});
        hasWarningsRef.current = false;
      }
    }
    return undefined;
  }, [medicationNamesKey]);

  return (
    <div className="space-y-6">
      {/* Medications Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Pill className="w-5 h-5" />
              Prescribed Medications
            </CardTitle>
            {AI_FEATURES_ENABLED && validMedications.length > 0 && (
              <button
                type="button"
                onClick={analyzeSafety}
                disabled={safetyLoading}
                className="px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 text-sm flex items-center gap-2"
              >
                <RefreshCw className={`w-4 h-4 ${safetyLoading ? 'animate-spin' : ''}`} />
                {safetyLoading ? 'Analyzing...' : 'Re-analyze Safety'}
              </button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <MedicationsTable
            medications={formData.medications}
            onAdd={addMedication}
            onRemove={removeMedication}
            onUpdate={updateMedication}
            onSelectFromSearch={setMedicationFromSearch}
          />
        </CardContent>
      </Card>
      
      {/* AI Suggestions Button */}
      {AI_FEATURES_ENABLED && formData.service?.diagnosis && !showSuggestions && (
        <div className="bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-lg p-4">
          <div className="flex items-start justify-between">
            <div>
              <h4 className="text-sm font-medium text-purple-900 mb-1 flex items-center gap-2">
                <Sparkles className="w-4 h-4" />
                AI Medication Suggestions Available
              </h4>
              <p className="text-sm text-purple-700 mb-3">
                Get AI-powered medication recommendations based on the diagnosis: <strong>{formData.service.diagnosis}</strong>
              </p>
            </div>
          </div>
          <button
            onClick={getSuggestions}
            disabled={suggestionsLoading}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-400 text-sm flex items-center gap-2"
          >
            <Sparkles className={`w-4 h-4 ${suggestionsLoading ? 'animate-pulse' : ''}`} />
            {suggestionsLoading ? 'Generating Suggestions...' : 'Get AI Suggestions'}
          </button>
        </div>
      )}

      {/* Medication Suggestions */}
      {showSuggestions && (
        <div>
          <MedicationSuggestionsPanel
            suggestions={suggestions}
            isLoading={suggestionsLoading}
            error={suggestionsError}
            onAddMedication={handleAddSuggestion}
          />
          <button
            onClick={() => setShowSuggestions(false)}
            className="mt-3 text-sm text-gray-600 hover:text-gray-900 underline"
          >
            Hide suggestions
          </button>
        </div>
      )}
      
      {/* Safety Analysis */}
      {AI_FEATURES_ENABLED && validMedications.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-blue-600" />
              Medication Safety Analysis
            </CardTitle>
          </CardHeader>
          <CardContent>
            <MedicationSafetyPanel
              analysis={safetyAnalysis}
              isLoading={safetyLoading}
              error={safetyError}
            />
          </CardContent>
        </Card>
      )}
      
      {/* Info Box */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="text-sm font-medium text-blue-900 mb-1">
          💡 Optional Step
        </h4>
        <p className="text-sm text-blue-700">
          Medications are optional for imaging requests. You can skip this step if no medications need to be recorded.
        </p>
      </div>
    </div>
  );
});

MedicationsStep.displayName = 'MedicationsStep';

export default MedicationsStep;

