import React, { Suspense, lazy, useCallback, useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Send, Save, RotateCcw } from 'lucide-react';
import { useGeneralRequestForm } from './useGeneralRequestForm';
import WizardProgress from './WizardProgress';
import { WIZARD_STEPS, isFirstStep, isLastStep } from './config/wizardConfig';
import { hasDraft, getDraftTimestampFormatted, clearDraft } from '@/utils/draftManager';
import PrerequisiteJustificationPopup from './PrerequisiteJustificationPopup';

// Lazy load step components for better performance
const PatientInfoStep = lazy(() => import('./steps/PatientInfoStep'));
const CoverageStep = lazy(() => import('./steps/CoverageStep'));
const ProviderStep = lazy(() => import('./steps/ProviderStep'));
const ServiceRequestStep = lazy(() => import('./steps/ServiceRequestStep'));
const MedicationsStep = lazy(() => import('./steps/MedicationsStep'));
const ReviewStep = lazy(() => import('./steps/ReviewStep'));

// Loading fallback
const StepLoadingFallback = () => (
  <div className="flex items-center justify-center py-12">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-purple"></div>
  </div>
);

/**
 * GeneralRequestWizard Component
 * Main container for the multi-step general request form
 */
const GeneralRequestWizard = ({ initialData = null, isEditMode = false, requestId = null }) => {
  const {
    formData,
    currentStep,
    errors,
    completedSteps,
    setField,
    validateCurrentStep,
    nextStep,
    prevStep,
    goToStep,
    isStepComplete,
    loadDraftData,
    loadExistingData,
    resetForm,
    addMedication,
    removeMedication,
    updateMedication,
    setMedicationFromSearch,
    setMedicationWarnings,
    setSafetyAnalysis,
    addManagementItem,
    removeManagementItem,
    updateManagementItem
  } = useGeneralRequestForm();
  
  const [showDraftPrompt, setShowDraftPrompt] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPrerequisitePopup, setShowPrerequisitePopup] = useState(false);
  const [prerequisitesData, setPrerequisitesData] = useState({
    dbPrerequisites: [],
    aiPrerequisites: [],
    fitIssue: false,
    suggestedDiagnoses: [],
    currentDiagnosis: '',
    requestedScan: ''
  });
  const [pendingJustification, setPendingJustification] = useState('');
  
  // Load existing data if in edit mode
  useEffect(() => {
    if (isEditMode && initialData) {
      loadExistingData(initialData);
    }
  }, [isEditMode, initialData]);
  
  // Check for draft on mount (only if not in edit mode)
  useEffect(() => {
    if (!isEditMode && hasDraft()) {
      setShowDraftPrompt(true);
    }
  }, [isEditMode]);
  
  // Handle draft loading
  const handleLoadDraft = useCallback(() => {
    loadDraftData();
    setShowDraftPrompt(false);
  }, [loadDraftData]);
  
  // Handle draft dismissal
  const handleDismissDraft = useCallback(() => {
    clearDraft();
    setShowDraftPrompt(false);
  }, []);
  
  // Handle next button
  const handleNext = useCallback(() => {
    const success = nextStep();
    if (success) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [nextStep]);
  
  // Handle previous button
  const handlePrev = useCallback(() => {
    prevStep();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [prevStep]);
  
  // Handle step click from progress bar
  const handleStepClick = useCallback((stepId) => {
    goToStep(stepId);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [goToStep]);
  
  // Validate prerequisites with backend
  const validatePrerequisites = useCallback(async () => {
    try {
      console.log('🔍 Validating prerequisites...');
      const response = await fetch('http://localhost:8001/api/general-request/validate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        throw new Error(`Validation failed: ${response.status}`);
      }

      const validationResult = await response.json();
      console.log('✅ Validation result:', validationResult);

      // Extract prerequisites from both sources
      const dbPrereqs = [];
      const aiPrereqs = [];

      // Database prerequisites (traditional)
      if (validationResult.traditional?.requiresPrerequisites && 
          validationResult.traditional?.prerequisitesNeeded) {
        const prereqString = validationResult.traditional.prerequisitesNeeded;
        // Split by comma and clean up
        dbPrereqs.push(...prereqString.split(',').map(p => p.trim()).filter(p => p));
      }

      // AI prerequisites
      if (validationResult.aiEnhanced) {
        // Critical prerequisites (array of strings)
        if (Array.isArray(validationResult.aiEnhanced.criticalPrerequisites)) {
          aiPrereqs.push(...validationResult.aiEnhanced.criticalPrerequisites);
        }
        
        // Prerequisite chain (array of objects with details)
        if (Array.isArray(validationResult.aiEnhanced.prerequisiteChain) && 
            validationResult.aiEnhanced.prerequisiteChain.length > 0) {
          aiPrereqs.push(...validationResult.aiEnhanced.prerequisiteChain);
        }
      }

      // Extract traditional validation fit status
      const traditionalFit = validationResult.traditional?.fit ?? true;
      const traditionalDiagnoses = validationResult.traditional?.diagnoses ?? [];

      return { 
        dbPrereqs, 
        aiPrereqs,
        traditionalFit,
        traditionalDiagnoses
      };
    } catch (error) {
      console.error('❌ Prerequisite validation error:', error);
      // On error, continue without prerequisite check
      return { 
        dbPrereqs: [], 
        aiPrereqs: [],
        traditionalFit: true,
        traditionalDiagnoses: []
      };
    }
  }, [formData]);

  // Handle actual submission (after prerequisites cleared)
  const performSubmission = useCallback(async () => {
    try {
      const submissionData = {
        ...formData,
        // Include UUIDs for database foreign keys
        patient_id: formData.patient?.patient_id || null,
        provider_id: formData.provider?.provider_id || null,
        insurer_id: formData.coverage?.insurer_id || null,
        prerequisiteJustification: pendingJustification || '',
        status: 'Submitted'
      };
      
      console.log('Submitting form data:', submissionData);
      
      let response;
      if (isEditMode && requestId) {
        // Update existing request
        response = await fetch(`http://localhost:8001/api/general-requests/${requestId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(submissionData),
        });
      } else {
        // Create new request
        response = await fetch('http://localhost:8001/api/general-requests', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(submissionData),
        });
      }

      if (!response.ok) {
        throw new Error(`Submission failed: ${response.status}`);
      }

      const result = await response.json();
      console.log('✅ Submission successful:', result);
      
      alert(isEditMode ? 'Request updated successfully!' : 'Request created successfully!');
      
      // Clear draft after successful submission
      if (!isEditMode) {
        clearDraft();
      }
      
      // Navigate to the list page
      window.location.href = '/general-requests';
      
    } catch (error) {
      console.error('Submission error:', error);
      alert('Failed to submit request. Please try again.');
      throw error;
    }
  }, [formData, pendingJustification, isEditMode, requestId]);

  // Handle form submission (with prerequisite check and fit validation)
  const handleSubmit = useCallback(async () => {
    setIsSubmitting(true);
    
    try {
      // Step 1: Validate prerequisites and fit
      const { dbPrereqs, aiPrereqs, traditionalFit, traditionalDiagnoses } = await validatePrerequisites();
      
      // Step 2: Check if there are any prerequisites or fit issues
      const hasPrerequisites = dbPrereqs.length > 0 || aiPrereqs.length > 0;
      const doesNotFit = !traditionalFit;
      const needsJustification = hasPrerequisites || doesNotFit;
      
      if (needsJustification) {
        console.log('⚠️ Validation issues detected:', { 
          hasPrerequisites, 
          doesNotFit, 
          dbPrereqs, 
          aiPrereqs, 
          traditionalDiagnoses 
        });
        // Show popup for justification
        setPrerequisitesData({ 
          dbPrerequisites: dbPrereqs, 
          aiPrerequisites: aiPrereqs,
          fitIssue: doesNotFit,
          suggestedDiagnoses: traditionalDiagnoses,
          currentDiagnosis: formData.service?.diagnosis || '',
          requestedScan: formData.service?.description || ''
        });
        setShowPrerequisitePopup(true);
        setIsSubmitting(false);
      } else {
        // No prerequisites or fit issues, submit directly
        console.log('✅ No validation issues, submitting...');
        await performSubmission();
        setIsSubmitting(false);
      }
      
    } catch (error) {
      console.error('Submission error:', error);
      alert('Failed to submit request. Please try again.');
      setIsSubmitting(false);
    }
  }, [validatePrerequisites, performSubmission, formData]);

  // Handle justification submission from popup
  const handleJustificationSubmit = useCallback(async (justification) => {
    setPendingJustification(justification);
    setShowPrerequisitePopup(false);
    setIsSubmitting(true);
    
    try {
      await performSubmission();
    } catch (error) {
      // Error already handled in performSubmission
    } finally {
      setIsSubmitting(false);
    }
  }, [performSubmission]);

  // Handle popup cancel
  const handlePrerequisiteCancel = useCallback(() => {
    setShowPrerequisitePopup(false);
    // Show warning but allow user to try again
    alert('⚠️ Warning: Submission may be rejected without proper prerequisites. You can modify your request or submit again with justification.');
  }, []);
  
  // Render current step component
  const renderStep = useCallback(() => {
    const stepProps = {
      formData,
      setField,
      errors
    };
    
    switch (currentStep) {
      case 1:
        return <PatientInfoStep {...stepProps} />;
      case 2:
        return <CoverageStep {...stepProps} />;
      case 3:
        return <ProviderStep {...stepProps} />;
      case 4:
        return <ServiceRequestStep {...stepProps} />;
      case 5:
        return <ReviewStep formData={formData} safetyAnalysis={formData.medicationSafetyAnalysis} />;
      case 6:
        return (
          <MedicationsStep
            formData={formData}
            addMedication={addMedication}
            removeMedication={removeMedication}
            updateMedication={updateMedication}
            setMedicationFromSearch={setMedicationFromSearch}
            setMedicationWarnings={setMedicationWarnings}
            setSafetyAnalysis={setSafetyAnalysis}
          />
        );
      default:
        return <div>Unknown step</div>;
    }
  }, [currentStep, formData, setField, errors, addMedication, removeMedication, updateMedication, setMedicationFromSearch, setMedicationWarnings, setSafetyAnalysis]);
  
  // Show validation errors but don't block navigation
  const currentStepConfig = WIZARD_STEPS.find(s => s.id === currentStep);
  const hasErrors = false; // Allow navigation even with errors
  
  return (
    <div className="min-h-screen">
      {/* Draft Prompt */}
      {showDraftPrompt && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Draft Found
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              We found a saved draft from {getDraftTimestampFormatted()}. Would you like to continue where you left off?
            </p>
            <div className="flex gap-3">
              <button
                onClick={handleLoadDraft}
                className="flex-1 px-4 py-2 bg-primary-purple text-white rounded-lg hover:opacity-90 transition"
              >
                Load Draft
              </button>
              <button
                onClick={handleDismissDraft}
                className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition"
              >
                Start Fresh
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Prerequisite Justification Popup */}
      <PrerequisiteJustificationPopup
        isOpen={showPrerequisitePopup}
        dbPrerequisites={prerequisitesData.dbPrerequisites}
        aiPrerequisites={prerequisitesData.aiPrerequisites}
        fitIssue={prerequisitesData.fitIssue}
        suggestedDiagnoses={prerequisitesData.suggestedDiagnoses}
        currentDiagnosis={prerequisitesData.currentDiagnosis}
        requestedScan={prerequisitesData.requestedScan}
        onSubmit={handleJustificationSubmit}
        onCancel={handlePrerequisiteCancel}
      />
      
      {/* Progress Bar */}
      <WizardProgress
        currentStep={currentStep}
        completedSteps={completedSteps}
        onStepClick={handleStepClick}
      />
      
      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Step Content */}
        <div className="mb-8">
          <Suspense fallback={<StepLoadingFallback />}>
            {renderStep()}
          </Suspense>
        </div>
        
        {/* Navigation Buttons */}
        <div className="flex items-center justify-between border-t pt-6 sticky bottom-0 bg-gray-50 pb-6">
          <div>
            {!isFirstStep(currentStep) && (
              <button
                type="button"
                onClick={handlePrev}
                className="inline-flex items-center gap-2 px-5 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition font-medium"
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </button>
            )}
          </div>
          
          <div className="flex gap-3">
            <button
              type="button"
              onClick={resetForm}
              className="inline-flex items-center gap-2 px-4 py-2.5 text-gray-600 hover:text-gray-900 transition"
            >
              <RotateCcw className="h-4 w-4" />
              Reset Form
            </button>
            
            {/* Show submit button on both steps 5 and 6 */}
            {currentStep >= 5 ? (
              <>
                {/* Show Next button only on step 5 */}
                {currentStep === 5 && (
                  <button
                    type="button"
                    onClick={handleNext}
                    disabled={hasErrors}
                    className={`inline-flex items-center gap-2 px-6 py-2.5 rounded-lg transition font-medium text-white ${
                      hasErrors
                        ? 'bg-gray-400 cursor-not-allowed'
                        : 'bg-primary-purple hover:opacity-90'
                    }`}
                  >
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </button>
                )}
                {/* Show Submit button on both steps 5 and 6 */}
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                  className={`inline-flex items-center gap-2 px-6 py-2.5 rounded-lg transition font-medium text-white ${
                    isSubmitting
                      ? 'bg-gray-400 cursor-not-allowed'
                      : 'bg-green-600 hover:bg-green-700'
                  }`}
                >
                  {isSubmitting ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Submitting...
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4" />
                      Submit Request
                    </>
                  )}
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={handleNext}
                disabled={hasErrors}
                className={`inline-flex items-center gap-2 px-6 py-2.5 rounded-lg transition font-medium text-white ${
                  hasErrors
                    ? 'bg-gray-400 cursor-not-allowed'
                    : 'bg-primary-purple hover:opacity-90'
                }`}
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </div>
      
      {/* Auto-save indicator */}
      <div className="fixed bottom-4 left-4 bg-white px-4 py-2 rounded-lg shadow-lg border border-gray-200 text-sm text-gray-600">
        💾 Auto-saving every 30 seconds
      </div>
    </div>
  );
};

export default GeneralRequestWizard;

