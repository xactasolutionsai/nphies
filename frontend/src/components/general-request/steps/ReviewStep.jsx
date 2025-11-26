import React, { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Scan, CheckCircle, AlertCircle, XCircle, Loader2, Shield, AlertTriangle } from 'lucide-react';
import api from '@/services/api';
import MedicationSafetyPanel from '../shared/MedicationSafetyPanel';

/**
 * ReviewStep Component
 * Step 6: Review form data and perform AI validation
 */
const ReviewStep = React.memo(({ formData, safetyAnalysis }) => {
  const [isValidating, setIsValidating] = useState(false);
  const [validationResult, setValidationResult] = useState(null);
  const [validationError, setValidationError] = useState(null);
  
  // Perform DUAL validation (Traditional + AI-Enhanced)
  const handleAIValidation = useCallback(async () => {
    // Validate required fields first
    if (!formData.service.diagnosis || !formData.service.description) {
      setValidationError('Diagnosis and service description are required for AI validation.');
      return;
    }
    
    setIsValidating(true);
    setValidationError(null);
    setValidationResult(null);
    
    try {
      // Send complete form data for AI-enhanced validation
      const response = await api.request('/general-request/validate', {
        method: 'POST',
        body: JSON.stringify({
          patient: formData.patient,
          coverage: formData.coverage,
          provider: formData.provider,
          service: formData.service,
          medications: formData.medications || []
        })
      });
      
      setValidationResult(response);
    } catch (error) {
      console.error('AI validation error:', error);
      setValidationError(error?.message || 'Failed to validate request');
    } finally {
      setIsValidating(false);
    }
  }, [formData]);
  
  // Format display value
  const formatValue = (value) => {
    if (value === null || value === undefined || value === '') return 'N/A';
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    if (typeof value === 'object') return JSON.stringify(value, null, 2);
    return String(value);
  };
  
  // Render summary section
  const renderSection = (title, data, fields) => {
    const hasData = fields.some(([_, path]) => {
      const value = path.split('.').reduce((obj, key) => obj?.[key], data);
      return value !== null && value !== undefined && value !== '';
    });
    
    if (!hasData) return null;
    
    return (
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-3 border-b pb-2">
          {title}
        </h3>
        <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-3">
          {fields.map(([label, path]) => {
            const value = path.split('.').reduce((obj, key) => obj?.[key], data);
            if (value === null || value === undefined || value === '') return null;
            
            return (
              <div key={path}>
                <dt className="text-sm font-medium text-gray-600">{label}</dt>
                <dd className="text-sm text-gray-900 mt-1">{formatValue(value)}</dd>
              </div>
            );
          })}
        </dl>
      </div>
    );
  };
  
  return (
    <div className="space-y-6">
      {/* AI Validation Card */}
      <Card>
        <CardHeader>
          <CardTitle>AI Validation</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Validate the appropriateness of the requested scan for the diagnosis using AI.
            </p>
            
            <button
              type="button"
              onClick={handleAIValidation}
              disabled={isValidating}
              className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-lg transition font-medium ${
                isValidating
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800'
              } text-white`}
            >
              {isValidating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Validating...
                </>
              ) : (
                <>
                  <Scan className="h-4 w-4" />
                  Run AI Validation
                </>
              )}
            </button>
            
            {validationError && (
              <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
                <XCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-sm font-medium text-red-900">Validation Error</h4>
                  <p className="text-sm text-red-700 mt-1">{validationError}</p>
                </div>
              </div>
            )}
            
            {validationResult && (
              <div className="space-y-4">
                {/* Traditional Validation Result */}
                {validationResult.traditional && (
                  <div className="border border-gray-300 rounded-lg overflow-hidden">
                    <div className="bg-gray-100 px-4 py-2 border-b border-gray-300">
                      <h5 className="text-sm font-semibold text-gray-900">
                        Traditional Validation (Database Rules)
                      </h5>
                    </div>
                    <div className={`flex items-start gap-3 p-4 ${
                      validationResult.traditional.fit
                        ? 'bg-green-50'
                        : 'bg-yellow-50'
                    }`}>
                      {validationResult.traditional.fit ? (
                        <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                      ) : (
                        <AlertCircle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                      )}
                      <div className="flex-1">
                        <h4 className={`text-sm font-medium ${
                          validationResult.traditional.fit ? 'text-green-900' : 'text-yellow-900'
                        }`}>
                          {validationResult.traditional.fit ? 'Validation Passed ✓' : 'Validation Warning'}
                        </h4>
                        <div className="text-sm mt-2 space-y-2">
                          <div>
                            <span className="font-medium">Fit: </span>
                            <span className={validationResult.traditional.fit ? 'text-green-700' : 'text-yellow-700'}>
                              {validationResult.traditional.fit ? 'Yes' : 'No'}
                            </span>
                          </div>
                          {validationResult.traditional.diagnoses && (
                            <div>
                              <span className="font-medium">Suggested Diagnoses: </span>
                              <span className={validationResult.traditional.fit ? 'text-green-700' : 'text-yellow-700'}>
                                {Array.isArray(validationResult.traditional.diagnoses) 
                                  ? validationResult.traditional.diagnoses.join(', ') 
                                  : validationResult.traditional.diagnoses}
                              </span>
                            </div>
                          )}
                          {validationResult.traditional.lateralityMismatch && (
                            <div className="text-red-700 text-xs mt-1">
                              ⚠️ Laterality mismatch detected
                            </div>
                          )}
                          {validationResult.traditional.requiresPrerequisites && (
                            <div className="text-yellow-700 text-xs mt-1">
                              ℹ️ Prerequisites: {validationResult.traditional.prerequisitesNeeded}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* AI-Enhanced Validation Result */}
                {validationResult.aiEnhanced ? (
                  <div className="border border-blue-300 rounded-lg overflow-hidden">
                    <div className="bg-blue-100 px-4 py-2 border-b border-blue-300">
                      <h5 className="text-sm font-semibold text-blue-900">
                        AI-Enhanced Clinical Recommendations
                      </h5>
                    </div>
                    <div className="bg-blue-50 p-4 space-y-4">
                      {/* Test Appropriateness */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {validationResult.aiEnhanced.testAppropriate ? (
                            <CheckCircle className="h-5 w-5 text-blue-600" />
                          ) : (
                            <AlertCircle className="h-5 w-5 text-orange-600" />
                          )}
                          <span className="text-sm font-medium text-blue-900">
                            Test Appropriate: {validationResult.aiEnhanced.testAppropriate ? 'Yes' : 'No'}
                          </span>
                        </div>
                        <span className="text-xs font-semibold text-blue-700 bg-blue-200 px-2 py-1 rounded">
                          {Math.round(validationResult.aiEnhanced.confidence * 100)}% Confidence
                        </span>
                      </div>

                      {/* Clinical Reasoning */}
                      {validationResult.aiEnhanced.reasoning && (
                        <div>
                          <h6 className="text-xs font-semibold text-blue-900 mb-1">Clinical Reasoning:</h6>
                          <p className="text-sm text-blue-800 bg-white p-2 rounded border border-blue-200">
                            {typeof validationResult.aiEnhanced.reasoning === 'string' ? validationResult.aiEnhanced.reasoning : JSON.stringify(validationResult.aiEnhanced.reasoning)}
                          </p>
                        </div>
                      )}

                      {/* Emergency Modifications */}
                      {validationResult.aiEnhanced.emergencyModifications && (
                        <div className="bg-orange-50 border border-orange-300 rounded p-3">
                          <h6 className="text-xs font-semibold text-orange-900 mb-1">⚡ Emergency Modifications:</h6>
                          <p className="text-sm text-orange-800">
                            {typeof validationResult.aiEnhanced.emergencyModifications === 'string' ? validationResult.aiEnhanced.emergencyModifications : JSON.stringify(validationResult.aiEnhanced.emergencyModifications)}
                          </p>
                        </div>
                      )}

                      {/* Prerequisite Chain */}
                      {validationResult.aiEnhanced.prerequisiteChain && validationResult.aiEnhanced.prerequisiteChain.length > 0 && (
                        <div>
                          <h6 className="text-xs font-semibold text-blue-900 mb-2">Recommended Diagnostic Pathway:</h6>
                          <div className="space-y-2">
                            {validationResult.aiEnhanced.prerequisiteChain.map((test, idx) => (
                              <div key={idx} className="bg-white border border-blue-200 rounded p-3">
                                <div className="flex items-start gap-2">
                                  <span className="flex-shrink-0 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold">
                                    {test.order || idx + 1}
                                  </span>
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-1">
                                      <span className="text-sm font-semibold text-blue-900">
                                        {typeof test.testName === 'string' ? test.testName : JSON.stringify(test.testName)}
                                      </span>
                                      <span className={`text-xs px-2 py-0.5 rounded ${
                                        test.urgency === 'immediate' ? 'bg-red-100 text-red-700' :
                                        test.urgency === 'urgent' ? 'bg-orange-100 text-orange-700' :
                                        'bg-gray-100 text-gray-700'
                                      }`}>
                                        {test.urgency || 'routine'}
                                      </span>
                                    </div>
                                    <p className="text-xs text-gray-700 mb-1">
                                      <span className="font-medium">Reason:</span> {typeof test.clinicalReason === 'string' ? test.clinicalReason : JSON.stringify(test.clinicalReason)}
                                    </p>
                                    {test.typicalFindings && (
                                      <p className="text-xs text-gray-600">
                                        <span className="font-medium">Typical findings:</span> {typeof test.typicalFindings === 'string' ? test.typicalFindings : JSON.stringify(test.typicalFindings)}
                                      </p>
                                    )}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Alternative Tests */}
                      {validationResult.aiEnhanced.alternativeTests && validationResult.aiEnhanced.alternativeTests.length > 0 && (
                        <div>
                          <h6 className="text-xs font-semibold text-blue-900 mb-1">Alternative Tests:</h6>
                          <ul className="list-disc list-inside text-sm text-blue-800 space-y-1">
                            {validationResult.aiEnhanced.alternativeTests.map((test, idx) => (
                              <li key={idx}>{typeof test === 'string' ? test : JSON.stringify(test)}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Contraindications */}
                      {validationResult.aiEnhanced.contraindications && validationResult.aiEnhanced.contraindications.length > 0 && (
                        <div className="bg-red-50 border border-red-300 rounded p-3">
                          <h6 className="text-xs font-semibold text-red-900 mb-1">⚠️ Contraindications & Warnings:</h6>
                          <ul className="list-disc list-inside text-sm text-red-800 space-y-1">
                            {validationResult.aiEnhanced.contraindications.map((warning, idx) => (
                              <li key={idx}>{typeof warning === 'string' ? warning : JSON.stringify(warning)}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Critical Prerequisites */}
                      {validationResult.aiEnhanced.criticalPrerequisites && validationResult.aiEnhanced.criticalPrerequisites.length > 0 && (
                        <div className="bg-yellow-50 border border-yellow-300 rounded p-3">
                          <h6 className="text-xs font-semibold text-yellow-900 mb-1">Critical Prerequisites:</h6>
                          <ul className="list-disc list-inside text-sm text-yellow-800 space-y-1">
                            {validationResult.aiEnhanced.criticalPrerequisites.map((prereq, idx) => (
                              <li key={idx}>{typeof prereq === 'string' ? prereq : JSON.stringify(prereq)}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                ) : validationResult.traditional && (
                  <div className="bg-yellow-50 border border-yellow-300 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <AlertCircle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <h5 className="text-sm font-medium text-yellow-900">AI System Unavailable</h5>
                        <p className="text-sm text-yellow-700 mt-1">
                          AI-enhanced recommendations could not be generated. Showing traditional validation only.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
      
      {/* Form Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Request Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {renderSection('Patient Information', formData, [
              ['Full Name', 'patient.fullName'],
              ['ID Number', 'patient.idNumber'],
              ['Date of Birth', 'patient.dob'],
              ['Gender', 'patient.gender'],
              ['Contact Phone', 'patient.contactPhone'],
              ['Email', 'patient.email']
            ])}
            
            {renderSection('Insurance Coverage', formData, [
              ['Insurer', 'coverage.insurer'],
              ['Policy Number', 'coverage.policyNumber'],
              ['Coverage Type', 'coverage.coverageType'],
              ['Policy Holder', 'coverage.policyHolder'],
              ['Expiry Date', 'coverage.expiryDate']
            ])}
            
            {renderSection('Healthcare Provider', formData, [
              ['Facility', 'provider.facilityName'],
              ['Doctor', 'provider.doctorName'],
              ['License', 'provider.licenseNumber'],
              ['Department', 'provider.department'],
              ['Contact', 'provider.contactPhone']
            ])}
            
            {renderSection('Service Request', formData, [
              ['Service Type', 'service.description'],
              ['Body Part', 'service.bodyPart'],
              ['Laterality', 'service.laterality'],
              ['Diagnosis', 'service.diagnosis'],
              ['Urgency', 'service.urgency'],
              ['Emergency Case', 'service.emergencyCase']
            ])}
            
            {formData.medications && formData.medications.length > 0 && (
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-3 border-b pb-2">
                  Medications
                </h3>
                <div className="space-y-2">
                  {formData.medications.map((med, idx) => {
                    if (!med.medicationName) return null;
                    
                    const warningCount = [
                      med.hasInteractions,
                      med.hasSideEffects,
                      med.hasAgeWarning,
                      med.hasPregnancyWarning,
                      med.isDuplicate
                    ].filter(Boolean).length;
                    
                    return (
                      <div key={idx} className="text-sm flex items-center gap-2">
                        <span className="font-medium">{med.medicationName}</span>
                        {med.type && <span className="text-gray-600"> - {med.type}</span>}
                        {med.quantity && <span className="text-gray-600"> (Qty: {med.quantity})</span>}
                        {warningCount > 0 && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-yellow-100 text-yellow-800 rounded-full text-xs font-medium">
                            <AlertTriangle className="w-3 h-3" />
                            {warningCount} warning{warningCount > 1 ? 's' : ''}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
      
      {/* Medication Safety Analysis */}
      {formData.medications && formData.medications.filter(med => med.medicationName?.trim()).length > 0 && safetyAnalysis && (
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
              isLoading={false}
              error={null}
            />
          </CardContent>
        </Card>
      )}
      
      {/* JSON Preview */}
      <Card>
        <CardHeader>
          <CardTitle>JSON Preview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="bg-gray-900 rounded-lg p-4 overflow-auto max-h-96">
            <pre className="text-xs text-green-400 font-mono">
              {JSON.stringify(formData, null, 2)}
            </pre>
          </div>
        </CardContent>
      </Card>
    </div>
  );
});

ReviewStep.displayName = 'ReviewStep';

export default ReviewStep;

