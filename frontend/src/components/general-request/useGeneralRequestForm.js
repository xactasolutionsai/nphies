import { useReducer, useEffect, useRef, useCallback } from 'react';
import { validateStep } from '@/utils/formValidation';
import { saveDraft, loadDraft, clearDraft } from '@/utils/draftManager';
import { WIZARD_STEPS } from './config/wizardConfig';

// Initial form state
const initialFormState = {
  patient: {
    patient_id: '',  // UUID for database foreign key
    fullName: '',
    idNumber: '',
    fileNumber: '',
    dob: '',
    age: '',
    gender: 'male',
    contactPhone: '',
    email: '',
    vitals: {
      bloodPressure: '',
      temperature: '',
      pulse: '',
      respiratoryRate: '',
      weight: '',
      height: ''
    },
    otherConditions: '',
    chiefComplaints: '',
    significantSigns: '',
    durationOfIllnessDays: '',
    maritalStatus: '',
    planType: ''
  },
  insured: {
    name: '',
    idCardNumber: ''
  },
  provider: {
    provider_id: '',  // UUID for database foreign key
    facilityName: '',
    doctorName: '',
    licenseNumber: '',
    department: '',
    contactPhone: '',
    email: '',
    completedCodedBy: '',
    signature: '',
    date: ''
  },
  coverage: {
    insurer_id: '',  // UUID for database foreign key
    insurer: '',
    contactPerson: '',
    phone: '',
    coverageType: '',
    tpaCompanyName: '',
    policyHolder: '',
    policyNumber: '',
    expiryDate: '',
    approvalField: ''
  },
  encounterClass: 'outpatient',
  encounterStart: '',
  encounterEnd: '',
  service: {
    description: '',
    diagnosis: '',
    previousTest: '',
    testResults: '',
    medicalPlan: '',
    startDate: '',
    urgency: 'routine',
    visitType: '',
    emergencyCase: false,
    emergencyCareLevel: '',
    bodyPart: '',
    laterality: 'left',
    cptCodes: '',
    icd10Codes: '',
    principalCode: '',
    secondCode: '',
    thirdCode: '',
    fourthCode: '',
    conditions: {
      chronic: false,
      congenital: false,
      rta: false,
      workRelated: false,
      vaccination: false,
      checkUp: false,
      psychiatric: false,
      infertility: false,
      pregnancy: false
    },
    caseManagementFormIncluded: false,
    possibleLineOfManagement: '',
    estimatedLengthOfStayDays: '',
    expectedDateOfAdmission: ''
  },
  managementItems: [{ code: '', description: '', type: '', quantity: '', cost: '' }],
  medications: [{
    medicationName: '',
    type: '',
    quantity: '',
    mrid: '',
    activeIngredient: '',
    strength: '',
    unit: '',
    dosageForm: null,
    brands: [],
    hasInteractions: false,
    hasSideEffects: false,
    hasAgeWarning: false,
    hasPregnancyWarning: false,
    isDuplicate: false
  }],
  medicationSafetyAnalysis: null,
  attachments: []
};

// Action types
const ACTIONS = {
  SET_FIELD: 'SET_FIELD',
  SET_STEP: 'SET_STEP',
  SET_ERRORS: 'SET_ERRORS',
  CLEAR_ERROR: 'CLEAR_ERROR',
  LOAD_DRAFT: 'LOAD_DRAFT',
  RESET_FORM: 'RESET_FORM',
  MARK_STEP_COMPLETE: 'MARK_STEP_COMPLETE',
  ADD_MEDICATION: 'ADD_MEDICATION',
  REMOVE_MEDICATION: 'REMOVE_MEDICATION',
  UPDATE_MEDICATION: 'UPDATE_MEDICATION',
  SET_MEDICATION_FROM_SEARCH: 'SET_MEDICATION_FROM_SEARCH',
  SET_MEDICATION_WARNINGS: 'SET_MEDICATION_WARNINGS',
  SET_MEDICATION_SAFETY_ANALYSIS: 'SET_MEDICATION_SAFETY_ANALYSIS',
  ADD_MANAGEMENT_ITEM: 'ADD_MANAGEMENT_ITEM',
  REMOVE_MANAGEMENT_ITEM: 'REMOVE_MANAGEMENT_ITEM',
  UPDATE_MANAGEMENT_ITEM: 'UPDATE_MANAGEMENT_ITEM',
  LOAD_EXISTING_DATA: 'LOAD_EXISTING_DATA'
};

// Reducer function
const formReducer = (state, action) => {
  switch (action.type) {
    case ACTIONS.SET_FIELD: {
      const { path, value } = action.payload;
      const keys = path.split('.');
      const newFormData = { ...state.formData };
      let current = newFormData;
      
      for (let i = 0; i < keys.length - 1; i++) {
        current[keys[i]] = { ...current[keys[i]] };
        current = current[keys[i]];
      }
      
      current[keys[keys.length - 1]] = value;
      
      return {
        ...state,
        formData: newFormData
      };
    }
    
    case ACTIONS.SET_STEP:
      return {
        ...state,
        currentStep: action.payload
      };
    
    case ACTIONS.SET_ERRORS:
      return {
        ...state,
        errors: action.payload
      };
    
    case ACTIONS.CLEAR_ERROR: {
      const newErrors = { ...state.errors };
      delete newErrors[action.payload];
      return {
        ...state,
        errors: newErrors
      };
    }
    
    case ACTIONS.LOAD_DRAFT:
      return {
        ...state,
        formData: action.payload
      };
    
    case ACTIONS.RESET_FORM:
      return {
        formData: initialFormState,
        currentStep: 1,
        errors: {},
        completedSteps: []
      };
    
    case ACTIONS.MARK_STEP_COMPLETE: {
      const stepId = action.payload;
      if (!state.completedSteps.includes(stepId)) {
        return {
          ...state,
          completedSteps: [...state.completedSteps, stepId]
        };
      }
      return state;
    }
    
    case ACTIONS.ADD_MEDICATION:
      return {
        ...state,
        formData: {
          ...state.formData,
          medications: [
            ...state.formData.medications,
            {
              medicationName: '',
              type: '',
              quantity: '',
              mrid: '',
              activeIngredient: '',
              strength: '',
              unit: '',
              dosageForm: null,
              brands: [],
              hasInteractions: false,
              hasSideEffects: false,
              hasAgeWarning: false,
              hasPregnancyWarning: false,
              isDuplicate: false
            }
          ]
        }
      };
    
    case ACTIONS.REMOVE_MEDICATION: {
      const index = action.payload;
      return {
        ...state,
        formData: {
          ...state.formData,
          medications: state.formData.medications.filter((_, i) => i !== index)
        }
      };
    }
    
    case ACTIONS.UPDATE_MEDICATION: {
      const { index, field, value } = action.payload;
      const newMedications = [...state.formData.medications];
      newMedications[index] = { ...newMedications[index], [field]: value };
      return {
        ...state,
        formData: {
          ...state.formData,
          medications: newMedications
        }
      };
    }
    
    case ACTIONS.ADD_MANAGEMENT_ITEM:
      return {
        ...state,
        formData: {
          ...state.formData,
          managementItems: [
            ...state.formData.managementItems,
            { code: '', description: '', type: '', quantity: '', cost: '' }
          ]
        }
      };
    
    case ACTIONS.REMOVE_MANAGEMENT_ITEM: {
      const index = action.payload;
      return {
        ...state,
        formData: {
          ...state.formData,
          managementItems: state.formData.managementItems.filter((_, i) => i !== index)
        }
      };
    }
    
    case ACTIONS.UPDATE_MANAGEMENT_ITEM: {
      const { index, field, value } = action.payload;
      const newItems = [...state.formData.managementItems];
      newItems[index] = { ...newItems[index], [field]: value };
      return {
        ...state,
        formData: {
          ...state.formData,
          managementItems: newItems
        }
      };
    }
    
    case ACTIONS.SET_MEDICATION_FROM_SEARCH: {
      const { index, medicineData } = action.payload;
      const newMedications = [...state.formData.medications];
      newMedications[index] = {
        ...newMedications[index],
        medicationName: medicineData.activeIngredient || medicineData.medicationName || '',
        mrid: medicineData.mrid || '',
        activeIngredient: medicineData.activeIngredient || '',
        strength: medicineData.strength || '',
        unit: medicineData.unit || '',
        dosageForm: medicineData.dosageForm || null,
        brands: medicineData.brands || []
      };
      return {
        ...state,
        formData: {
          ...state.formData,
          medications: newMedications
        }
      };
    }
    
    case ACTIONS.SET_MEDICATION_WARNINGS: {
      const { warnings } = action.payload;
      const newMedications = [...state.formData.medications];
      
      // Reset all warnings first
      newMedications.forEach(med => {
        med.hasInteractions = false;
        med.hasSideEffects = false;
        med.hasAgeWarning = false;
        med.hasPregnancyWarning = false;
        med.isDuplicate = false;
      });
      
      // Apply new warnings - only update specific warning flags
      if (warnings && Object.keys(warnings).length > 0) {
        Object.keys(warnings).forEach(index => {
          const medIndex = parseInt(index);
          if (newMedications[medIndex] && warnings[index]) {
            // Only spread valid warning properties
            newMedications[medIndex] = {
              ...newMedications[medIndex],
              hasInteractions: Boolean(warnings[index].hasInteractions),
              hasSideEffects: Boolean(warnings[index].hasSideEffects),
              hasAgeWarning: Boolean(warnings[index].hasAgeWarning),
              hasPregnancyWarning: Boolean(warnings[index].hasPregnancyWarning),
              isDuplicate: Boolean(warnings[index].isDuplicate)
            };
          }
        });
      }
      
      return {
        ...state,
        formData: {
          ...state.formData,
          medications: newMedications
        }
      };
    }
    
    case ACTIONS.SET_MEDICATION_SAFETY_ANALYSIS:
      return {
        ...state,
        formData: {
          ...state.formData,
          medicationSafetyAnalysis: action.payload
        }
      };
    
    case ACTIONS.LOAD_EXISTING_DATA:
      return {
        ...state,
        formData: action.payload
      };
    
    default:
      return state;
  }
};

/**
 * Custom hook for managing General Request form state
 */
export const useGeneralRequestForm = () => {
  const [state, dispatch] = useReducer(formReducer, {
    formData: initialFormState,
    currentStep: 1,
    errors: {},
    completedSteps: []
  });
  
  const autoSaveTimerRef = useRef(null);
  
  // Set field value
  const setField = useCallback((path, value) => {
    dispatch({ type: ACTIONS.SET_FIELD, payload: { path, value } });
    // Clear error for this field when user starts typing
    dispatch({ type: ACTIONS.CLEAR_ERROR, payload: path });
  }, []);
  
  // Validate current step
  const validateCurrentStep = useCallback(() => {
    const currentStepConfig = WIZARD_STEPS.find(s => s.id === state.currentStep);
    if (!currentStepConfig) return true;
    
    const errors = validateStep(state.formData, currentStepConfig.requiredFields);
    dispatch({ type: ACTIONS.SET_ERRORS, payload: errors });
    
    return Object.keys(errors).length === 0;
  }, [state.currentStep, state.formData]);
  
  // Navigate to next step (without validation blocking)
  const nextStep = useCallback(() => {
    // Still validate to show errors, but don't block navigation
    validateCurrentStep();
    
    dispatch({ type: ACTIONS.MARK_STEP_COMPLETE, payload: state.currentStep });
    const nextStepId = state.currentStep + 1;
    if (nextStepId <= WIZARD_STEPS.length) {
      dispatch({ type: ACTIONS.SET_STEP, payload: nextStepId });
      return true;
    }
    return false;
  }, [state.currentStep, validateCurrentStep]);
  
  // Navigate to previous step
  const prevStep = useCallback(() => {
    const prevStepId = state.currentStep - 1;
    if (prevStepId >= 1) {
      dispatch({ type: ACTIONS.SET_STEP, payload: prevStepId });
      return true;
    }
    return false;
  }, [state.currentStep]);
  
  // Go to specific step
  const goToStep = useCallback((stepId) => {
    if (stepId >= 1 && stepId <= WIZARD_STEPS.length) {
      dispatch({ type: ACTIONS.SET_STEP, payload: stepId });
      return true;
    }
    return false;
  }, []);
  
  // Check if step is complete
  const isStepComplete = useCallback((stepId) => {
    return state.completedSteps.includes(stepId);
  }, [state.completedSteps]);
  
  // Load draft from localStorage
  const loadDraftData = useCallback(() => {
    const draft = loadDraft();
    if (draft && draft.data) {
      dispatch({ type: ACTIONS.LOAD_DRAFT, payload: draft.data });
      return true;
    }
    return false;
  }, []);
  
  // Load existing data (for edit mode)
  const loadExistingData = useCallback((data) => {
    dispatch({ type: ACTIONS.LOAD_EXISTING_DATA, payload: data });
  }, []);
  
  // Clear all data
  const resetForm = useCallback(() => {
    dispatch({ type: ACTIONS.RESET_FORM });
    clearDraft();
  }, []);
  
  // Medication handlers
  const addMedication = useCallback(() => {
    dispatch({ type: ACTIONS.ADD_MEDICATION });
  }, []);
  
  const removeMedication = useCallback((index) => {
    dispatch({ type: ACTIONS.REMOVE_MEDICATION, payload: index });
  }, []);
  
  const updateMedication = useCallback((index, field, value) => {
    dispatch({ type: ACTIONS.UPDATE_MEDICATION, payload: { index, field, value } });
  }, []);
  
  const setMedicationFromSearch = useCallback((index, medicineData) => {
    dispatch({ type: ACTIONS.SET_MEDICATION_FROM_SEARCH, payload: { index, medicineData } });
  }, []);
  
  const setMedicationWarnings = useCallback((warnings) => {
    dispatch({ type: ACTIONS.SET_MEDICATION_WARNINGS, payload: { warnings } });
  }, []);
  
  const setSafetyAnalysis = useCallback((analysis) => {
    dispatch({ type: ACTIONS.SET_MEDICATION_SAFETY_ANALYSIS, payload: analysis });
  }, []);
  
  // Management item handlers
  const addManagementItem = useCallback(() => {
    dispatch({ type: ACTIONS.ADD_MANAGEMENT_ITEM });
  }, []);
  
  const removeManagementItem = useCallback((index) => {
    dispatch({ type: ACTIONS.REMOVE_MANAGEMENT_ITEM, payload: index });
  }, []);
  
  const updateManagementItem = useCallback((index, field, value) => {
    dispatch({ type: ACTIONS.UPDATE_MANAGEMENT_ITEM, payload: { index, field, value } });
  }, []);
  
  // Auto-save effect
  useEffect(() => {
    // Clear existing timer
    if (autoSaveTimerRef.current) {
      clearInterval(autoSaveTimerRef.current);
    }
    
    // Set up new auto-save timer (every 30 seconds)
    autoSaveTimerRef.current = setInterval(() => {
      saveDraft(state.formData);
      console.log('📝 Auto-saved draft');
    }, 30000);
    
    // Cleanup
    return () => {
      if (autoSaveTimerRef.current) {
        clearInterval(autoSaveTimerRef.current);
      }
    };
  }, [state.formData]);
  
  // Save on unmount
  useEffect(() => {
    return () => {
      saveDraft(state.formData);
    };
  }, [state.formData]);
  
  return {
    formData: state.formData,
    currentStep: state.currentStep,
    errors: state.errors,
    completedSteps: state.completedSteps,
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
  };
};

