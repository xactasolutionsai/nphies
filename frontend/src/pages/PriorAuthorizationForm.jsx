import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import DatePicker from 'react-datepicker';
import Select from 'react-select';
import AsyncSelect from 'react-select/async';
import 'react-datepicker/dist/react-datepicker.css';
import api from '@/services/api';
import { 
  Save, Send, ArrowLeft, Plus, Trash2, FileText, User, Building, 
  Shield, Stethoscope, Activity, Receipt, Paperclip, Eye, Pill,
  Calendar, DollarSign, AlertCircle, CheckCircle, XCircle, Copy, CreditCard, Sparkles,
  Upload, File, X, RefreshCw, AlertTriangle, Info, MessageSquare
} from 'lucide-react';

// Import AI Medication Safety components
import MedicationSafetyPanel from '@/components/general-request/shared/MedicationSafetyPanel';
import MedicationSuggestionsPanel from '@/components/general-request/shared/MedicationSuggestionsPanel';

// Import extracted modules
import {
  AUTH_TYPE_OPTIONS,
  PRIORITY_OPTIONS,
  CLAIM_SUBTYPE_OPTIONS,
  ALLOWED_CLAIM_SUBTYPES,
  getClaimSubtypeOptions,
  ENCOUNTER_CLASS_OPTIONS,
  ALLOWED_ENCOUNTER_CLASSES,
  getEncounterClassOptions,
  ADMIT_SOURCE_OPTIONS,
  CURRENCY_OPTIONS,
  DIAGNOSIS_TYPE_OPTIONS,
  EYE_OPTIONS,
  BODY_SITE_OPTIONS_BY_AUTH_TYPE,
  FDI_TOOTH_OPTIONS,
  TOOTH_SURFACE_OPTIONS,
  SUPPORTING_INFO_CATEGORY_OPTIONS,
  VITAL_SIGNS_FIELDS,
  CLINICAL_TEXT_FIELDS,
  ADMISSION_FIELDS,
  INVESTIGATION_RESULT_OPTIONS,
  SERVICE_EVENT_TYPE_OPTIONS,
  PRACTICE_CODES_OPTIONS,
  DENTAL_CHIEF_COMPLAINT_OPTIONS,
  CHIEF_COMPLAINT_FORMAT_OPTIONS,
  TRIAGE_CATEGORY_OPTIONS,
  ENCOUNTER_SERVICE_TYPE_OPTIONS,
  ENCOUNTER_PRIORITY_OPTIONS,
  DENTAL_PROCEDURE_OPTIONS,
  NPHIES_PROCEDURE_OPTIONS,
  LOINC_LAB_OPTIONS,
  SERVICE_CODE_SYSTEM_OPTIONS,
  NPHIES_LAB_SERVICE_OPTIONS
} from '@/components/prior-auth/constants';
import { datePickerStyles, selectStyles } from '@/components/prior-auth/styles';
import {
  formatAmount,
  getInitialItemData,
  getInitialDiagnosisData,
  getInitialSupportingInfoData,
  getInitialLabObservationData
} from '@/components/prior-auth/helpers';
import { TabButton, generateDummyVitalsAndClinical, AIValidationPanel, DrugInteractionJustificationModal, CommunicationPanel } from '@/components/prior-auth';

export default function PriorAuthorizationForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditMode = !!id;

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [errors, setErrors] = useState([]);
  const [activeTab, setActiveTab] = useState('basic');
  
  // Preview state
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewData, setPreviewData] = useState(null);
  const [showPreview, setShowPreview] = useState(false);
  
  // Reference data
  const [patients, setPatients] = useState([]);
  const [providers, setProviders] = useState([]);
  const [insurers, setInsurers] = useState([]);
  const [coverages, setCoverages] = useState([]);
  const [loadingCoverages, setLoadingCoverages] = useState(false);
  
  // AI Medication Safety Analysis (for pharmacy auth type)
  const [medicationSafetyAnalysis, setMedicationSafetyAnalysis] = useState(null);
  const [safetyLoading, setSafetyLoading] = useState(false);
  const [safetyError, setSafetyError] = useState(null);
  const [medicationSuggestions, setMedicationSuggestions] = useState([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [suggestionsError, setSuggestionsError] = useState(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  
  // AI Prior Auth Validation State
  const [aiValidationResult, setAiValidationResult] = useState(null);
  const [aiValidationLoading, setAiValidationLoading] = useState(false);
  const [showAiValidation, setShowAiValidation] = useState(false);
  const [enhancingField, setEnhancingField] = useState(null); // Track which field is being enhanced
  const [suggestionsPatientContext, setSuggestionsPatientContext] = useState(null);
  
  // Drug Interaction Justification Modal State
  const [showJustificationModal, setShowJustificationModal] = useState(false);
  const [pendingSaveAction, setPendingSaveAction] = useState(null); // 'save' or 'saveAndSend'
  const [drugInteractionJustification, setDrugInteractionJustification] = useState('');

  // Form data
  const [formData, setFormData] = useState({
    auth_type: 'professional',
    sub_type: 'op', // NPHIES: Claim subType (op=OutPatient, ip=Inpatient, emr=Emergency)
    status: 'draft',
    priority: 'normal',
    currency: 'SAR',
    encounter_class: 'ambulatory',
    admit_source: 'WKIN', // NPHIES: hospitalization.admitSource (default: Walk-in)
    service_event_type: 'ICSE', // NPHIES: ICSE (Initial) or SCSE (Subsequent)
    // Emergency encounter fields (per NPHIES Encounter-10122.json)
    triage_category: '', // Required for EMER: I, VU, U, S, NS
    triage_date: '', // Required for EMER: datetime of triage assessment
    service_type: '', // Service type: acute-care, sub-acute-care, etc.
    encounter_priority: '', // For EMER: EM, UR, S, etc.
    // Eligibility response (per NPHIES Claim-173086.json)
    eligibility_response_id: '', // Identifier-based reference (preferred)
    eligibility_response_system: '', // System for the identifier
    patient_id: '',
    provider_id: '',
    practice_code: '08.00', // NPHIES: Practice code for careTeam.qualification (default: Internal Medicine)
    insurer_id: '',
    coverage_id: '',
    diagnosis_codes: '',
    primary_diagnosis: '',
    total_amount: '',
    eligibility_ref: '',
    encounter_start: '',
    encounter_end: '',
    items: [getInitialItemData(1)],
    supporting_info: [],
    diagnoses: [getInitialDiagnosisData(1)],
    attachments: [],
    // NPHIES Vital Signs & Clinical Data
    vital_signs: {
      systolic: '',
      diastolic: '',
      height: '',
      weight: '',
      pulse: '',
      temperature: '',
      oxygen_saturation: '',
      respiratory_rate: '',
      measurement_time: null
    },
    clinical_info: {
      chief_complaint_format: 'snomed', // 'snomed' for SNOMED codes, 'text' for free text
      chief_complaint_code: '',
      chief_complaint_display: '',
      chief_complaint_text: '', // Free text option (like json2 example)
      patient_history: '',
      history_of_present_illness: '',
      physical_examination: '',
      treatment_plan: '',
      investigation_result: ''
    },
    admission_info: {
      admission_weight: '',
      estimated_length_of_stay: ''
    },
    // Clinical Documents (PDF uploads for future use)
    clinical_documents: [],
    // Lab Observations for Professional claims (LOINC codes for Observation resources)
    // Per NPHIES IG: Lab test details MUST be in Observation resources, NOT Claim.item.productOrService
    // These are referenced via Claim.supportingInfo with category = "laboratory"
    lab_observations: [],
    // Vision Prescription Data (per NPHIES VisionPrescription-3.json standard)
    vision_prescription: {
      product_type: 'lens', // 'lens' or 'contact'
      date_written: null,
      prescriber_license: '', // Optional: for identifier-based prescriber reference
      right_eye: {
        sphere: '',
        cylinder: '',
        axis: '',
        add: '',
        prism_amount: '',
        prism_base: '' // up, down, in, out
      },
      left_eye: {
        sphere: '',
        cylinder: '',
        axis: '',
        add: '',
        prism_amount: '',
        prism_base: '' // up, down, in, out
      }
    }
  });

  useEffect(() => {
    loadReferenceData();
    if (isEditMode) {
      loadPriorAuthorization();
    }
  }, [id]);

  // Auto-analyze medication safety when pharmacy items change
  useEffect(() => {
    // Only run for pharmacy auth type
    if (formData.auth_type !== 'pharmacy') {
      setMedicationSafetyAnalysis(null);
      setSafetyError(null);
      return;
    }

    // Extract medications with valid medication codes
    const validMedications = formData.items.filter(item => 
      item.medication_code && item.medication_name
    );

    if (validMedications.length === 0) {
      setMedicationSafetyAnalysis(null);
      setSafetyError(null);
      return;
    }

    // Debounce the analysis
    const timer = setTimeout(async () => {
      await analyzeMedicationSafety();
    }, 1000);

    return () => clearTimeout(timer);
  }, [formData.auth_type, formData.items, formData.patient_id, formData.diagnoses]);

  // Helper to calculate patient age from birth date
  const calculatePatientAge = (birthDate) => {
    if (!birthDate) return null;
    const birth = new Date(birthDate);
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age;
  };

  // Analyze medication safety using AI
  const analyzeMedicationSafety = async () => {
    const validMedications = formData.items.filter(item => 
      item.medication_code && item.medication_name
    );

    if (validMedications.length === 0) {
      setMedicationSafetyAnalysis(null);
      return;
    }

    setSafetyLoading(true);
    setSafetyError(null);

    try {
      // Get patient data for context
      const selectedPatient = patients.find(p => p.patient_id == formData.patient_id);
      const patientAge = selectedPatient ? calculatePatientAge(selectedPatient.birth_date || selectedPatient.date_of_birth) : null;
      const patientGender = selectedPatient?.gender;

      // Get primary diagnosis
      const primaryDiagnosis = formData.diagnoses?.find(d => d.diagnosis_type === 'principal')?.diagnosis_display || 
                               formData.diagnoses?.[0]?.diagnosis_display || '';

      const response = await api.analyzeMedicationSafety(
        validMedications.map(item => ({
          medicationName: item.medication_name,
          activeIngredient: item.medication_name, // Use medication name as fallback
          medicationCode: item.medication_code,
          strength: item.quantity || '',
        })),
        {
          age: patientAge,
          gender: patientGender,
          diagnosis: primaryDiagnosis,
          pregnant: false, // Could be enhanced with patient data
          emergencyCase: formData.sub_type === 'emr'
        }
      );

      if (response.success && response.analysis) {
        setMedicationSafetyAnalysis(response.analysis);
      } else {
        throw new Error(response.message || 'Analysis failed');
      }
    } catch (error) {
      console.error('Medication safety analysis error:', error);
      setSafetyError(error.message || 'Failed to analyze medication safety');
    } finally {
      setSafetyLoading(false);
    }
  };

  // Get AI medication suggestions based on diagnosis
  const getMedicationSuggestionsHandler = async () => {
    const primaryDiagnosis = formData.diagnoses?.find(d => d.diagnosis_type === 'principal')?.diagnosis_display || 
                             formData.diagnoses?.[0]?.diagnosis_display;

    if (!primaryDiagnosis) {
      setSuggestionsError('Please add a diagnosis first to get medication suggestions');
      return;
    }

    setSuggestionsLoading(true);
    setSuggestionsError(null);

    try {
      const selectedPatient = patients.find(p => p.patient_id == formData.patient_id);
      const patientAge = selectedPatient ? calculatePatientAge(selectedPatient.birth_date || selectedPatient.date_of_birth) : null;
      const patientGender = selectedPatient?.gender;

      const response = await api.getMedicationSuggestions(
        primaryDiagnosis,
        patientAge,
        patientGender,
        formData.sub_type === 'emr'
      );

      if (response.success && response.suggestions) {
        setMedicationSuggestions(response.suggestions);
        setShowSuggestions(true);
        // Store patient context from response for display in panel
        if (response.patientContext) {
          setSuggestionsPatientContext(response.patientContext);
        }
      } else {
        throw new Error(response.message || 'Failed to get suggestions');
      }
    } catch (error) {
      console.error('Medication suggestions error:', error);
      setSuggestionsError(error.message || 'Failed to get medication suggestions');
    } finally {
      setSuggestionsLoading(false);
    }
  };

  const loadReferenceData = async () => {
    try {
      const [patientsRes, providersRes, insurersRes] = await Promise.all([
        api.getPatients({ limit: 1000 }),
        api.getProviders({ limit: 1000 }),
        api.getInsurers({ limit: 1000 })
      ]);
      setPatients(patientsRes?.data || []);
      setProviders(providersRes?.data || []);
      setInsurers(insurersRes?.data || []);
    } catch (error) {
      console.error('Error loading reference data:', error);
    }
  };

  const loadPriorAuthorization = async () => {
    try {
      setLoading(true);
      const response = await api.getPriorAuthorization(id);
      const data = response.data;
      
      // Parse existing supporting_info into structured fields
      const supportingInfo = data.supporting_info || [];
      const vitalSigns = {
        systolic: '', diastolic: '', height: '', weight: '',
        pulse: '', temperature: '', oxygen_saturation: '', respiratory_rate: '',
        measurement_time: null
      };
      const clinicalInfo = {
        chief_complaint_format: 'snomed', // Default format
        chief_complaint_code: '', chief_complaint_display: '',
        chief_complaint_text: '', // Free text option
        patient_history: '', history_of_present_illness: '',
        physical_examination: '', treatment_plan: '',
        investigation_result: ''
      };
      const admissionInfo = {
        admission_weight: '', estimated_length_of_stay: ''
      };
      
      // Track which supporting_info items are parsed into structured fields
      const parsedCategories = new Set();
      
      supportingInfo.forEach(info => {
        // Vital signs
        const vitalField = VITAL_SIGNS_FIELDS.find(f => f.category === info.category);
        if (vitalField && info.value_quantity != null) {
          vitalSigns[vitalField.key] = String(info.value_quantity);
          if (info.timing_period_start && !vitalSigns.measurement_time) {
            vitalSigns.measurement_time = info.timing_period_start;
          }
          parsedCategories.add(info.category);
        }
        
        // Clinical text fields
        const clinicalField = CLINICAL_TEXT_FIELDS.find(f => f.category === info.category);
        if (clinicalField && info.value_string) {
          clinicalInfo[clinicalField.key] = info.value_string;
          parsedCategories.add(info.category);
        }
        
        // Chief complaint - supports both SNOMED code and free text formats
        if (info.category === 'chief-complaint') {
          if (info.code_text) {
            // Free text format
            clinicalInfo.chief_complaint_format = 'text';
            clinicalInfo.chief_complaint_text = info.code_text;
            clinicalInfo.chief_complaint_code = '';
            clinicalInfo.chief_complaint_display = '';
          } else if (info.code) {
            // SNOMED code format
            clinicalInfo.chief_complaint_format = 'snomed';
            clinicalInfo.chief_complaint_code = info.code;
            clinicalInfo.chief_complaint_display = info.code_display || '';
            clinicalInfo.chief_complaint_text = '';
          } else if (info.value_string) {
            // Legacy: value_string format
            clinicalInfo.chief_complaint_format = 'text';
            clinicalInfo.chief_complaint_text = info.value_string;
            clinicalInfo.chief_complaint_code = '';
            clinicalInfo.chief_complaint_display = '';
          }
          parsedCategories.add(info.category);
        }
        
        // Investigation result
        if (info.category === 'investigation-result' && info.code) {
          clinicalInfo.investigation_result = info.code;
          parsedCategories.add(info.category);
        }
        
        // Admission fields
        const admissionField = ADMISSION_FIELDS.find(f => f.category === info.category);
        if (admissionField && info.value_quantity != null) {
          admissionInfo[admissionField.key] = String(info.value_quantity);
          parsedCategories.add(info.category);
        }
      });
      
      // Filter out parsed items from supporting_info (keep only manual/other entries)
      const remainingSupportingInfo = supportingInfo.filter(info => !parsedCategories.has(info.category));
      
      setFormData({
        ...data,
        items: data.items?.length > 0 ? data.items : [getInitialItemData(1)],
        diagnoses: data.diagnoses?.length > 0 ? data.diagnoses : [getInitialDiagnosisData(1)],
        supporting_info: remainingSupportingInfo,
        attachments: data.attachments || [],
        vital_signs: vitalSigns,
        clinical_info: clinicalInfo,
        admission_info: admissionInfo,
        vision_prescription: data.vision_prescription || {
          product_type: 'lens',
          date_written: null,
          prescriber_license: '',
          right_eye: { sphere: '', cylinder: '', axis: '', add: '', prism_amount: '', prism_base: '' },
          left_eye: { sphere: '', cylinder: '', axis: '', add: '', prism_amount: '', prism_base: '' }
        }
      });
      
      // Load coverages for the patient (if patient exists)
      if (data.patient_id) {
        try {
          const coveragesRes = await api.getPatientCoverages(data.patient_id);
          setCoverages(coveragesRes?.data || []);
        } catch (coverageError) {
          console.error('Error loading patient coverages:', coverageError);
        }
      }
    } catch (error) {
      console.error('Error loading prior authorization:', error);
      alert('Error loading prior authorization');
      navigate('/prior-authorizations');
    } finally {
      setLoading(false);
    }
  };

  // Load coverages when patient is selected
  const loadPatientCoverages = async (patientId) => {
    if (!patientId) {
      setCoverages([]);
      return;
    }
    
    try {
      setLoadingCoverages(true);
      const response = await api.getPatientCoverages(patientId);
      const patientCoverages = response?.data || [];
      setCoverages(patientCoverages);
      
      // If patient has only one coverage, auto-select it
      if (patientCoverages.length === 1) {
        const coverage = patientCoverages[0];
        setFormData(prev => ({
          ...prev,
          coverage_id: coverage.coverage_id,
          insurer_id: coverage.insurer_id
        }));
      } else {
        // Clear coverage and insurer if patient has multiple or no coverages
        setFormData(prev => ({
          ...prev,
          coverage_id: '',
          insurer_id: ''
        }));
      }
    } catch (error) {
      console.error('Error loading patient coverages:', error);
      setCoverages([]);
    } finally {
      setLoadingCoverages(false);
    }
  };

  // Handle coverage selection - auto-set insurer
  const handleCoverageChange = (coverageId) => {
    const selectedCoverage = coverages.find(c => c.coverage_id === coverageId);
    setFormData(prev => ({
      ...prev,
      coverage_id: coverageId,
      insurer_id: selectedCoverage?.insurer_id || prev.insurer_id
    }));
  };

  const handleChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    
    // If patient changed, load their coverages
    if (field === 'patient_id') {
      loadPatientCoverages(value);
    }
  };

  const handleItemChange = (index, field, value) => {
    setFormData(prev => {
      const newItems = [...prev.items];
      newItems[index] = { ...newItems[index], [field]: value };
      
      // Auto-calculate net amount
      if (field === 'quantity' || field === 'unit_price') {
        const qty = field === 'quantity' ? value : newItems[index].quantity;
        const price = field === 'unit_price' ? value : newItems[index].unit_price;
        newItems[index].net_amount = (parseFloat(qty) || 0) * (parseFloat(price) || 0);
      }
      
      return { ...prev, items: newItems };
    });
  };

  const addItem = () => {
    setFormData(prev => ({
      ...prev,
      items: [...prev.items, getInitialItemData(prev.items.length + 1, prev.auth_type)]
    }));
  };

  const removeItem = (index) => {
    if (formData.items.length > 1) {
      setFormData(prev => ({
        ...prev,
        items: prev.items.filter((_, i) => i !== index).map((item, i) => ({ ...item, sequence: i + 1 }))
      }));
    }
  };

  const handleDiagnosisChange = (index, field, value) => {
    setFormData(prev => {
      const newDiagnoses = [...prev.diagnoses];
      newDiagnoses[index] = { ...newDiagnoses[index], [field]: value };
      return { ...prev, diagnoses: newDiagnoses };
    });
  };

  const addDiagnosis = () => {
    setFormData(prev => ({
      ...prev,
      diagnoses: [...prev.diagnoses, getInitialDiagnosisData(prev.diagnoses.length + 1)]
    }));
  };

  const removeDiagnosis = (index) => {
    if (formData.diagnoses.length > 1) {
      setFormData(prev => ({
        ...prev,
        diagnoses: prev.diagnoses.filter((_, i) => i !== index).map((diag, i) => ({ ...diag, sequence: i + 1 }))
      }));
    }
  };

  const handleSupportingInfoChange = (index, field, value) => {
    setFormData(prev => {
      const newInfo = [...prev.supporting_info];
      newInfo[index] = { ...newInfo[index], [field]: value };
      return { ...prev, supporting_info: newInfo };
    });
  };

  const addSupportingInfo = (category = 'info') => {
    setFormData(prev => ({
      ...prev,
      supporting_info: [...prev.supporting_info, getInitialSupportingInfoData(prev.supporting_info.length + 1, category)]
    }));
  };

  const removeSupportingInfo = (index) => {
    setFormData(prev => ({
      ...prev,
      supporting_info: prev.supporting_info.filter((_, i) => i !== index).map((info, i) => ({ ...info, sequence: i + 1 }))
    }));
  };

  // Handlers for structured vital signs, clinical info, and admission info
  const handleVitalSignChange = (key, value) => {
    setFormData(prev => ({
      ...prev,
      vital_signs: { ...prev.vital_signs, [key]: value }
    }));
  };

  const handleClinicalInfoChange = (key, value) => {
    setFormData(prev => ({
      ...prev,
      clinical_info: { ...prev.clinical_info, [key]: value }
    }));
  };

  const handleAdmissionInfoChange = (key, value) => {
    setFormData(prev => ({
      ...prev,
      admission_info: { ...prev.admission_info, [key]: value }
    }));
  };

  // Handler for PDF file uploads
  const handlePdfUpload = (e) => {
    const files = Array.from(e.target.files);
    const pdfFiles = files.filter(file => file.type === 'application/pdf');
    
    if (pdfFiles.length !== files.length) {
      alert('Only PDF files are allowed');
    }
    
    if (pdfFiles.length > 0) {
      // Convert files to base64 for storage
      pdfFiles.forEach(file => {
        const reader = new FileReader();
        reader.onload = (event) => {
          const newDocument = {
            id: `doc-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            name: file.name,
            size: file.size,
            type: file.type,
            data: event.target.result, // base64 data
            uploadedAt: new Date().toISOString()
          };
          setFormData(prev => ({
            ...prev,
            clinical_documents: [...prev.clinical_documents, newDocument]
          }));
        };
        reader.readAsDataURL(file);
      });
    }
    
    // Reset input
    e.target.value = '';
  };

  // Handler to remove uploaded PDF
  const handleRemovePdf = (documentId) => {
    setFormData(prev => ({
      ...prev,
      clinical_documents: prev.clinical_documents.filter(doc => doc.id !== documentId)
    }));
  };

  // Format file size for display
  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Handler for filling dummy/sample data in Vitals & Clinical tab
  const handleFillDummyData = () => {
    const dummyData = generateDummyVitalsAndClinical(formData.auth_type, formData.encounter_class);
    setFormData(prev => ({
      ...prev,
      vital_signs: { ...prev.vital_signs, ...dummyData.vital_signs },
      clinical_info: { ...prev.clinical_info, ...dummyData.clinical_info },
      admission_info: { ...prev.admission_info, ...dummyData.admission_info }
    }));
  };

  // AI Validation Handler - Validate prior auth with biomistral AI
  const handleAIValidation = async () => {
    setAiValidationLoading(true);
    setShowAiValidation(true);
    setAiValidationResult(null);

    try {
      // Build supporting info array for validation
      const supportingInfoArray = buildSupportingInfoArray();
      
      const validationData = {
        ...formData,
        supporting_info: supportingInfoArray
      };

      const response = await api.validatePriorAuth(validationData);
      
      if (response.success) {
        setAiValidationResult(response);
      } else {
        setAiValidationResult({
          success: false,
          error: response.error || 'Validation failed',
          riskScores: { overall: 0, categories: {}, riskLevel: 'low' },
          suggestions: []
        });
      }
    } catch (error) {
      console.error('AI validation error:', error);
      setAiValidationResult({
        success: false,
        error: error.message || 'Failed to validate prior authorization',
        riskScores: { overall: 0, categories: {}, riskLevel: 'low' },
        suggestions: []
      });
    } finally {
      setAiValidationLoading(false);
    }
  };

  // Apply AI suggestion to form
  const handleApplyAISuggestion = (suggestion) => {
    if (suggestion.type === 'justification' && suggestion.suggestedText) {
      // Append to treatment plan
      setFormData(prev => ({
        ...prev,
        clinical_info: {
          ...prev.clinical_info,
          treatment_plan: prev.clinical_info.treatment_plan 
            ? `${prev.clinical_info.treatment_plan}\n\n${suggestion.suggestedText}`
            : suggestion.suggestedText
        }
      }));
    } else if (suggestion.field && suggestion.suggestedText) {
      // Apply to specific field
      const fieldParts = suggestion.field.split('.');
      if (fieldParts[0] === 'clinical_info') {
        setFormData(prev => ({
          ...prev,
          clinical_info: {
            ...prev.clinical_info,
            [fieldParts[1]]: prev.clinical_info[fieldParts[1]]
              ? `${prev.clinical_info[fieldParts[1]]}\n\n${suggestion.suggestedText}`
              : suggestion.suggestedText
          }
        }));
      }
    }
    
    // Re-run validation after applying suggestion
    setTimeout(() => handleAIValidation(), 500);
  };

  // Enhance clinical text with AI
  const handleEnhanceClinicalText = async (field) => {
    const currentText = formData.clinical_info[field];
    if (!currentText || currentText.trim().length < 5) {
      alert('Please enter at least 5 characters before enhancing with AI.');
      return;
    }

    setEnhancingField(field);

    try {
      // Get selected patient from loaded patients (using patient_id)
      const selectedPatient = patients.find(p => p.patient_id == formData.patient_id);
      const patientAge = selectedPatient ? calculatePatientAge(selectedPatient.birth_date || selectedPatient.date_of_birth) : null;
      
      // Get selected provider from loaded providers
      const selectedProvider = providers.find(p => p.provider_id == formData.provider_id);
      
      // Get selected insurer from loaded insurers
      const selectedInsurer = insurers.find(i => i.insurer_id == formData.insurer_id);
      
      // Build comprehensive context from all form data
      const context = {
        // Patient Information (from database)
        patientName: selectedPatient?.name || selectedPatient?.full_name || '',
        patientAge: patientAge,
        patientGender: selectedPatient?.gender || '',
        patientId: selectedPatient?.identifier || selectedPatient?.national_id || '',
        
        // Basic Information
        authType: formData.auth_type || '',
        priority: formData.priority || '',
        encounterClass: formData.encounter_class || '',
        claimSubtype: formData.claim_subtype || '',
        
        // Chief Complaint
        chiefComplaint: formData.clinical_info.chief_complaint_display || formData.clinical_info.chief_complaint_text || '',
        chiefComplaintCode: formData.clinical_info.chief_complaint_code || '',
        
        // Diagnoses (all of them)
        diagnoses: (formData.diagnoses || []).map(d => ({
          code: d.diagnosis_code || '',
          display: d.diagnosis_display || '',
          description: d.diagnosis_description || '',
          type: d.diagnosis_type || ''
        })),
        
        // Vital Signs (all of them)
        vitalSigns: {
          systolic: formData.vital_signs?.systolic || '',
          diastolic: formData.vital_signs?.diastolic || '',
          pulse: formData.vital_signs?.pulse || '',
          temperature: formData.vital_signs?.temperature || '',
          oxygen_saturation: formData.vital_signs?.oxygen_saturation || '',
          respiratory_rate: formData.vital_signs?.respiratory_rate || '',
          height: formData.vital_signs?.height || '',
          weight: formData.vital_signs?.weight || ''
        },
        
        // Requested Services/Procedures/Medications
        requestedServices: (formData.items || []).map(item => ({
          code: item.product_or_service_code || item.medication_code || '',
          description: item.service_description || item.medication_name || '',
          quantity: item.quantity || '',
          bodySite: item.body_site || '',
          tooth: item.tooth_number || ''
        })),
        
        // Provider Information (from database)
        providerName: selectedProvider?.name || selectedProvider?.facility_name || '',
        providerType: selectedProvider?.provider_type || '',
        
        // Insurer Information (from database)
        insurerName: selectedInsurer?.name || selectedInsurer?.organization_name || '',
        
        // Admission Info (for inpatient)
        admissionWeight: formData.admission_info?.admission_weight || '',
        estimatedLengthOfStay: formData.admission_info?.estimated_length_of_stay || ''
      };

      console.log(`🤖 Enhancing ${field} with AI...`);
      console.log('📋 Context:', context);

      const response = await api.enhanceClinicalText(currentText, field, context);
      
      if (response.success && response.enhancedText && response.enhancedText !== currentText) {
        setFormData(prev => ({
          ...prev,
          clinical_info: {
            ...prev.clinical_info,
            [field]: response.enhancedText
          }
        }));
        console.log(`✅ Enhanced ${field} successfully`);
      } else if (response.error) {
        console.error('Enhancement failed:', response.error);
        alert(`Enhancement failed: ${response.error}\n\nPlease try again or add more detail to your text.`);
      } else {
        console.warn('No enhancement returned');
        alert('AI could not enhance the text. Try adding more clinical details to your input.');
      }
    } catch (error) {
      console.error('Error enhancing clinical text:', error);
      alert('Failed to connect to AI service. Please check the server is running and try again.');
    } finally {
      setEnhancingField(null);
    }
  };

  // Handler for vision prescription fields
  const handleVisionPrescriptionChange = (field, value, eye = null) => {
    setFormData(prev => {
      if (eye) {
        // Update eye-specific field (sphere, cylinder, axis, add)
        return {
          ...prev,
          vision_prescription: {
            ...prev.vision_prescription,
            [eye]: {
              ...prev.vision_prescription[eye],
              [field]: value
            }
          }
        };
      } else {
        // Update general field (product_type, date_written)
        return {
          ...prev,
          vision_prescription: {
            ...prev.vision_prescription,
            [field]: value
          }
        };
      }
    });
  };

  // Build supporting info array from structured data (for save/preview)
  const buildSupportingInfoArray = () => {
    const supportingInfo = [...formData.supporting_info]; // Keep existing manual entries
    let sequence = supportingInfo.length + 1;

    // Add vital signs
    VITAL_SIGNS_FIELDS.forEach(field => {
      if (formData.vital_signs[field.key]) {
        supportingInfo.push({
          sequence: sequence++,
          category: field.category,
          value_quantity: parseFloat(formData.vital_signs[field.key]),
          value_quantity_unit: field.unit,
          timing_period_start: formData.vital_signs.measurement_time || formData.encounter_start || new Date().toISOString()
        });
      }
    });

    // Add chief complaint if provided (supports SNOMED code or free text)
    if (formData.clinical_info.chief_complaint_format === 'text' && formData.clinical_info.chief_complaint_text) {
      // Free text format: code.text
      supportingInfo.push({
        sequence: sequence++,
        category: 'chief-complaint',
        code_text: formData.clinical_info.chief_complaint_text
      });
    } else if (formData.clinical_info.chief_complaint_code) {
      // SNOMED code format: code.coding
      supportingInfo.push({
        sequence: sequence++,
        category: 'chief-complaint',
        code: formData.clinical_info.chief_complaint_code,
        code_system: 'http://snomed.info/sct',
        code_display: formData.clinical_info.chief_complaint_display || ''
      });
    }

    // Add clinical text fields
    CLINICAL_TEXT_FIELDS.forEach(field => {
      if (formData.clinical_info[field.key]) {
        supportingInfo.push({
          sequence: sequence++,
          category: field.category,
          value_string: formData.clinical_info[field.key]
        });
      }
    });

    // Add investigation result if provided
    if (formData.clinical_info.investigation_result) {
      supportingInfo.push({
        sequence: sequence++,
        category: 'investigation-result',
        code: formData.clinical_info.investigation_result,
        code_system: 'http://nphies.sa/terminology/CodeSystem/investigation-result',
        code_display: INVESTIGATION_RESULT_OPTIONS.find(o => o.value === formData.clinical_info.investigation_result)?.label || ''
      });
    }

    // Add admission fields (only for inpatient/daycase)
    if (['inpatient', 'daycase'].includes(formData.encounter_class)) {
      ADMISSION_FIELDS.forEach(field => {
        if (formData.admission_info[field.key]) {
          supportingInfo.push({
            sequence: sequence++,
            category: field.category,
            value_quantity: parseFloat(formData.admission_info[field.key]),
            value_quantity_unit: field.unit
          });
        }
      });
    }

    return supportingInfo;
  };

  // Pure function for display - doesn't set state
  const getCalculatedTotal = () => {
    return formData.items.reduce((sum, item) => sum + (parseFloat(item.net_amount) || 0), 0);
  };

  // Click handler that sets state
  const calculateTotal = () => {
    const total = getCalculatedTotal();
    handleChange('total_amount', total);
    return total;
  };

  const validateForm = () => {
    const validationErrors = [];
    if (!formData.patient_id) validationErrors.push({ field: 'patient_id', message: 'Patient is required' });
    if (!formData.provider_id) validationErrors.push({ field: 'provider_id', message: 'Provider is required' });
    if (!formData.insurer_id) validationErrors.push({ field: 'insurer_id', message: 'Insurer is required' });
    if (!formData.items || formData.items.length === 0) validationErrors.push({ field: 'items', message: 'At least one service item is required' });
    
    // Validate item codes based on auth type
    // Pharmacy uses medication_code, others use product_or_service_code
    const invalidItems = formData.items.filter(item => {
      if (formData.auth_type === 'pharmacy') {
        return !item.medication_code;
      }
      return !item.product_or_service_code;
    });
    if (invalidItems.length > 0) {
      const codeType = formData.auth_type === 'pharmacy' ? 'medication code' : 'service code';
      validationErrors.push({ field: 'items', message: `All items must have a ${codeType}` });
    }
    
    return { valid: validationErrors.length === 0, errors: validationErrors };
  };

  // Check if there are drug safety issues that require justification
  const hasDrugSafetyIssues = () => {
    if (formData.auth_type !== 'pharmacy' || !medicationSafetyAnalysis) {
      return false;
    }
    
    const {
      drugInteractions = [],
      ageRelatedWarnings = [],
      pregnancyWarnings = [],
      overallRiskAssessment
    } = medicationSafetyAnalysis;
    
    return (
      drugInteractions.length > 0 ||
      ageRelatedWarnings.length > 0 ||
      pregnancyWarnings.length > 0 ||
      overallRiskAssessment === 'high'
    );
  };

  // Execute the actual save operation
  const executeSave = async (justification = null) => {
    try {
      setSaving(true);
      setErrors([]);

      // Merge structured vital signs and clinical data into supporting_info
      const dataToSave = {
        ...formData,
        supporting_info: buildSupportingInfoArray()
      };
      // Remove structured fields (already merged into supporting_info or handled separately)
      delete dataToSave.vital_signs;
      delete dataToSave.clinical_info;
      delete dataToSave.admission_info;
      // Keep vision_prescription for vision auth types - needed for VisionPrescription FHIR resource
      if (dataToSave.auth_type !== 'vision') {
        delete dataToSave.vision_prescription;
      }
      
      // Dental/Vision claims use AMB encounter class - don't send end date
      // Per NPHIES Encounter-10123 example: AMB encounters have no end date
      // NPHIES Rules: Dental and Vision must use 'ambulatory'
      if (dataToSave.auth_type === 'dental' || dataToSave.auth_type === 'vision') {
        delete dataToSave.encounter_end;
        dataToSave.encounter_class = 'ambulatory';
      }
      
      // Institutional claims MUST use inpatient (IMP) or daycase (SS) encounter class
      // Per NPHIES BV-00741: Encounter Class Shall be either 'Inpatient Admission', 'Day Case Admission' or 'inpatient acute' for Institutional Claim
      // Per NPHIES BV-00845: Encounter Class 'Outpatient' SHALL be used only when claim is 'oral' or 'professional'
      if (dataToSave.auth_type === 'institutional') {
        if (!['inpatient', 'daycase'].includes(dataToSave.encounter_class)) {
          dataToSave.encounter_class = 'daycase';
        }
      }
      
      // Include AI medication safety analysis for pharmacy authorizations
      if (dataToSave.auth_type === 'pharmacy' && medicationSafetyAnalysis) {
        dataToSave.medication_safety_analysis = medicationSafetyAnalysis;
      }
      
      // Include drug interaction justification if provided
      if (justification) {
        dataToSave.drug_interaction_justification = justification;
        dataToSave.drug_interaction_justification_date = new Date().toISOString();
      }

      let response;
      if (isEditMode) {
        response = await api.updatePriorAuthorization(id, dataToSave);
      } else {
        response = await api.createPriorAuthorization(dataToSave);
      }

      alert(isEditMode ? 'Prior authorization updated successfully!' : 'Prior authorization created successfully!');
      navigate(`/prior-authorizations/${response.data.id}`);
    } catch (error) {
      console.error('Error saving prior authorization:', error);
      const errorMsg = error.response?.data?.error || error.message;
      setErrors([{ field: 'general', message: errorMsg }]);
      alert(`Error: ${errorMsg}`);
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async () => {
    const validation = validateForm();
    if (!validation.valid) {
      setErrors(validation.errors);
      alert('Please fix the validation errors before saving.');
      return;
    }
    
    // Check if drug safety issues exist and no justification has been provided
    if (hasDrugSafetyIssues() && !drugInteractionJustification) {
      setPendingSaveAction('save');
      setShowJustificationModal(true);
      return;
    }
    
    // Proceed with save (with existing justification if any)
    await executeSave(drugInteractionJustification || null);
  };

  // Execute the actual save and send operation
  const executeSaveAndSend = async (justification = null) => {
    try {
      setSending(true);
      setErrors([]);

      // Merge structured vital signs and clinical data into supporting_info
      const dataToSave = {
        ...formData,
        supporting_info: buildSupportingInfoArray()
      };
      // Remove structured fields (already merged into supporting_info or handled separately)
      delete dataToSave.vital_signs;
      delete dataToSave.clinical_info;
      delete dataToSave.admission_info;
      // Keep vision_prescription for vision auth types - needed for VisionPrescription FHIR resource
      if (dataToSave.auth_type !== 'vision') {
        delete dataToSave.vision_prescription;
      }
      
      // Dental claims use AMB encounter class - don't send end date
      // Dental/Vision claims use AMB encounter class - don't send end date
      // Per NPHIES Encounter-10123 example: AMB encounters have no end date
      // NPHIES Rules: Dental and Vision must use 'ambulatory'
      if (dataToSave.auth_type === 'dental' || dataToSave.auth_type === 'vision') {
        delete dataToSave.encounter_end;
        dataToSave.encounter_class = 'ambulatory';
      }
      
      // Institutional claims MUST use inpatient (IMP) or daycase (SS) encounter class
      // Per NPHIES BV-00741: Encounter Class Shall be either 'Inpatient Admission', 'Day Case Admission' or 'inpatient acute' for Institutional Claim
      // Per NPHIES BV-00845: Encounter Class 'Outpatient' SHALL be used only when claim is 'oral' or 'professional'
      if (dataToSave.auth_type === 'institutional') {
        if (!['inpatient', 'daycase'].includes(dataToSave.encounter_class)) {
          dataToSave.encounter_class = 'daycase';
        }
      }
      
      // Include AI medication safety analysis for pharmacy authorizations
      if (dataToSave.auth_type === 'pharmacy' && medicationSafetyAnalysis) {
        dataToSave.medication_safety_analysis = medicationSafetyAnalysis;
      }
      
      // Include drug interaction justification if provided
      if (justification) {
        dataToSave.drug_interaction_justification = justification;
        dataToSave.drug_interaction_justification_date = new Date().toISOString();
      }

      // Save first
      let savedId = id;
      if (!isEditMode) {
        const createResponse = await api.createPriorAuthorization(dataToSave);
        savedId = createResponse.data.id;
      } else {
        await api.updatePriorAuthorization(id, dataToSave);
      }

      // Then send to NPHIES
      const sendResponse = await api.sendPriorAuthorizationToNphies(savedId);
      
      if (sendResponse.success) {
        alert(`Successfully sent to NPHIES!\nPre-Auth Ref: ${sendResponse.nphiesResponse?.preAuthRef || 'Pending'}`);
        navigate(`/prior-authorizations/${savedId}`);
      } else {
        alert(`NPHIES Error: ${sendResponse.error?.message || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error sending to NPHIES:', error);
      const errorMsg = error.response?.data?.error || error.message;
      setErrors([{ field: 'general', message: errorMsg }]);
      alert(`Error: ${errorMsg}`);
    } finally {
      setSending(false);
    }
  };

  const handleSaveAndSend = async () => {
    const validation = validateForm();
    if (!validation.valid) {
      setErrors(validation.errors);
      alert('Please fix the validation errors before sending.');
      return;
    }
    
    // Check if drug safety issues exist and no justification has been provided
    if (hasDrugSafetyIssues() && !drugInteractionJustification) {
      setPendingSaveAction('saveAndSend');
      setShowJustificationModal(true);
      return;
    }
    
    // Proceed with save and send (with existing justification if any)
    await executeSaveAndSend(drugInteractionJustification || null);
  };

  // Handle justification modal submission
  const handleJustificationSubmit = async (justification) => {
    setDrugInteractionJustification(justification);
    setShowJustificationModal(false);
    
    // Execute the pending save action with the justification
    if (pendingSaveAction === 'save') {
      await executeSave(justification);
    } else if (pendingSaveAction === 'saveAndSend') {
      await executeSaveAndSend(justification);
    }
    
    setPendingSaveAction(null);
  };

  // Handle justification modal cancel
  const handleJustificationCancel = () => {
    setShowJustificationModal(false);
    setPendingSaveAction(null);
  };

  const handlePreview = async () => {
    try {
      setPreviewLoading(true);
      setErrors([]);

      const validation = validateForm();
      if (!validation.valid) {
        setErrors(validation.errors);
        alert('Please fix the validation errors before previewing.');
        return;
      }

      // Merge structured vital signs and clinical data into supporting_info
      const dataToPreview = {
        ...formData,
        supporting_info: buildSupportingInfoArray()
      };
      // Remove structured fields (already merged into supporting_info or handled separately)
      delete dataToPreview.vital_signs;
      delete dataToPreview.clinical_info;
      delete dataToPreview.admission_info;
      // Keep vision_prescription for vision auth types - needed for VisionPrescription FHIR resource
      if (dataToPreview.auth_type !== 'vision') {
        delete dataToPreview.vision_prescription;
      }
      
      // Dental claims use AMB encounter class - don't send end date
      // Dental/Vision claims use AMB encounter class - don't send end date
      // Per NPHIES Encounter-10123 example: AMB encounters have no end date
      // NPHIES Rules: Dental and Vision must use 'ambulatory'
      if (dataToPreview.auth_type === 'dental' || dataToPreview.auth_type === 'vision') {
        delete dataToPreview.encounter_end;
        dataToPreview.encounter_class = 'ambulatory';
      }
      
      // Institutional claims MUST use inpatient (IMP) or daycase (SS) encounter class
      // Per NPHIES BV-00741: Encounter Class Shall be either 'Inpatient Admission', 'Day Case Admission' or 'inpatient acute' for Institutional Claim
      // Per NPHIES BV-00845: Encounter Class 'Outpatient' SHALL be used only when claim is 'oral' or 'professional'
      if (dataToPreview.auth_type === 'institutional') {
        if (!['inpatient', 'daycase'].includes(dataToPreview.encounter_class)) {
          dataToPreview.encounter_class = 'daycase';
        }
      }

      // Include the ID if we're editing an existing record - this allows the backend to save
      // the request bundle for later viewing in the details page
      if (id) {
        dataToPreview.id = id;
        dataToPreview.prior_auth_id = id;
      }

      const response = await api.previewPriorAuthorizationBundle(dataToPreview);
      setPreviewData(response);
      setShowPreview(true);
    } catch (error) {
      console.error('Error generating preview:', error);
      const errorMsg = error.response?.data?.error || error.message;
      alert(`Error: ${errorMsg}`);
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleCopyJson = (bundleType = 'request') => {
    let bundleData;
    let bundleName;
    
    if (bundleType === 'response') {
      // Copy NPHIES response bundle (only available after test send)
      bundleData = previewData?.data;
      bundleName = 'NPHIES Response Bundle';
    } else {
      // Copy request bundle (what was/will be sent to NPHIES)
      // For preview: fhirBundle, for test send: requestBundle
      bundleData = previewData?.requestBundle || previewData?.fhirBundle;
      bundleName = 'FHIR Request Bundle';
    }
    
    if (bundleData) {
      navigator.clipboard.writeText(JSON.stringify(bundleData, null, 2));
      alert(`${bundleName} copied to clipboard!`);
    } else {
      alert(`No ${bundleName.toLowerCase()} available to copy.`);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="relative">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-primary-purple/20"></div>
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-transparent border-t-primary-purple absolute top-0"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-10">
      {/* Inject custom DatePicker styles */}
      <style>{datePickerStyles}</style>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => navigate('/prior-authorizations')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              {isEditMode ? 'Edit Prior Authorization' : 'New Prior Authorization'}
            </h1>
            <p className="text-gray-600">
              {isEditMode ? `Request #: ${formData.request_number}` : 'Create a new NPHIES prior authorization request'}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate('/prior-authorizations')}>
            Cancel
          </Button>
          <Button 
            variant="outline" 
            onClick={handlePreview} 
            disabled={previewLoading || saving || sending}
          >
            <Eye className="h-4 w-4 mr-2" />
            {previewLoading ? 'Building...' : 'Preview JSON'}
          </Button>
          <Button onClick={handleSave} disabled={saving || sending || previewLoading}>
            <Save className="h-4 w-4 mr-2" />
            {saving ? 'Saving...' : 'Save Draft'}
          </Button>
          <Button 
            onClick={handleSaveAndSend} 
            disabled={saving || sending || previewLoading}
            className="bg-gradient-to-r from-blue-500 to-blue-600"
          >
            <Send className="h-4 w-4 mr-2" />
            {sending ? 'Sending...' : 'Save & Send to NPHIES'}
          </Button>
        </div>
      </div>

      {/* Validation Errors */}
      {errors.length > 0 && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-4">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-5 w-5 text-red-500 mt-0.5" />
              <div>
                <p className="font-medium text-red-800">Please fix the following errors:</p>
                <ul className="mt-2 text-sm text-red-700 list-disc list-inside">
                  {errors.map((error, index) => (
                    <li key={index}>{error.message}</li>
                  ))}
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabs Navigation */}
      <div className="flex gap-2 bg-gray-100 p-1 rounded-lg w-fit flex-wrap">
        <TabButton active={activeTab === 'basic'} onClick={() => setActiveTab('basic')} icon={FileText}>
          Basic Info
        </TabButton>
        <TabButton active={activeTab === 'parties'} onClick={() => setActiveTab('parties')} icon={Building}>
          Parties
        </TabButton>
        <TabButton active={activeTab === 'clinical'} onClick={() => setActiveTab('clinical')} icon={Stethoscope}>
          Clinical
        </TabButton>
        <TabButton active={activeTab === 'vitals'} onClick={() => setActiveTab('vitals')} icon={Activity}>
          Vitals & Clinical
        </TabButton>
        <TabButton active={activeTab === 'items'} onClick={() => setActiveTab('items')} icon={Receipt}>
          Items
        </TabButton>
        <TabButton active={activeTab === 'supporting'} onClick={() => setActiveTab('supporting')} icon={Paperclip}>
          Supporting Info
        </TabButton>
        {/* Communications Tab - Show for saved PAs in queued/pended status */}
        {isEditMode && (formData.status === 'queued' || formData.outcome === 'queued' || formData.adjudication_outcome === 'pended') && (
          <TabButton active={activeTab === 'communications'} onClick={() => setActiveTab('communications')} icon={MessageSquare}>
            Communications
          </TabButton>
        )}
      </div>

      {/* Basic Info Tab */}
      {activeTab === 'basic' && (
        <Card>
          <CardHeader>
            <CardTitle>Basic Information</CardTitle>
            <CardDescription>Core details about the prior authorization request</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Authorization Type *</Label>
                <Select
                  value={AUTH_TYPE_OPTIONS.find(opt => opt.value === formData.auth_type)}
                  onChange={(option) => {
                    const newAuthType = option?.value || 'professional';
                    handleChange('auth_type', newAuthType);
                    
                    // Get allowed claim subtypes for the new auth type
                    const allowedSubtypes = ALLOWED_CLAIM_SUBTYPES[newAuthType] || ALLOWED_CLAIM_SUBTYPES.professional;
                    const currentSubType = formData.sub_type;
                    
                    // Auto-update sub_type if current selection is not allowed for new auth type
                    if (!allowedSubtypes.includes(currentSubType)) {
                      handleChange('sub_type', allowedSubtypes[0] || 'op');
                    }
                    
                    // Get allowed encounter classes for the new auth type
                    const allowed = ALLOWED_ENCOUNTER_CLASSES[newAuthType] || ALLOWED_ENCOUNTER_CLASSES.professional;
                    const currentClass = formData.encounter_class;
                    
                    // Auto-update encounter class if current selection is not allowed for new auth type
                    // For institutional: default to 'daycase' (SS - Short Stay)
                    // For professional/dental: default to 'ambulatory' (AMB)
                    if (!allowed.includes(currentClass)) {
                      const defaultClass = newAuthType === 'institutional' ? 'daycase' : (allowed[0] || 'ambulatory');
                      handleChange('encounter_class', defaultClass);
                      if (defaultClass === 'ambulatory') {
                        handleChange('encounter_end', '');
                      }
                    }
                    
                    // Clear end date for dental/vision/pharmacy (no encounter needed)
                    if (newAuthType === 'dental' || newAuthType === 'vision' || newAuthType === 'pharmacy') {
                      handleChange('encounter_end', '');
                    }

                    // Reset items with auth-type specific fields when switching
                    setFormData(prev => ({
                      ...prev,
                      items: [getInitialItemData(1, newAuthType)]
                    }));
                  }}
                  options={AUTH_TYPE_OPTIONS}
                  styles={selectStyles}
                  menuPortalTarget={document.body}
                />
              </div>
              <div className="space-y-2">
                <Label>Claim SubType *</Label>
                <Select
                  value={CLAIM_SUBTYPE_OPTIONS.find(opt => opt.value === formData.sub_type)}
                  onChange={(option) => {
                    const newSubType = option?.value || 'op';
                    handleChange('sub_type', newSubType);
                  }}
                  options={getClaimSubtypeOptions(formData.auth_type)}
                  styles={selectStyles}
                  menuPortalTarget={document.body}
                  isOptionDisabled={(option) => option.isDisabled}
                />
                <p className="text-xs text-gray-500">
                  NPHIES: OP (OutPatient), IP (Inpatient), EMR (Emergency)
                </p>
              </div>
              <div className="space-y-2">
                <Label>Priority</Label>
                <Select
                  value={PRIORITY_OPTIONS.find(opt => opt.value === formData.priority)}
                  onChange={(option) => handleChange('priority', option?.value || 'normal')}
                  options={PRIORITY_OPTIONS}
                  styles={selectStyles}
                  menuPortalTarget={document.body}
                />
              </div>
              {/* Encounter Class - NOT shown for Vision/Pharmacy claims (they don't use Encounter per NPHIES examples) */}
              {formData.auth_type !== 'vision' && formData.auth_type !== 'pharmacy' && (
                <div className="space-y-2">
                  <Label>Encounter Class</Label>
                  <Select
                    value={ENCOUNTER_CLASS_OPTIONS.find(opt => opt.value === formData.encounter_class)}
                    onChange={(option) => handleChange('encounter_class', option?.value || 'ambulatory')}
                    options={getEncounterClassOptions(formData.auth_type)}
                    styles={selectStyles}
                    menuPortalTarget={document.body}
                    isOptionDisabled={(option) => option.isDisabled}
                  />
                </div>
              )}
              {/* Admit Source - Required for hospitalization encounters (institutional: inpatient/daycase) */}
              {formData.auth_type === 'institutional' && ['inpatient', 'daycase'].includes(formData.encounter_class) && (
                <div className="space-y-2">
                  <Label>Admit Source</Label>
                  <Select
                    value={ADMIT_SOURCE_OPTIONS.find(opt => opt.value === formData.admit_source)}
                    onChange={(option) => handleChange('admit_source', option?.value || 'WKIN')}
                    options={ADMIT_SOURCE_OPTIONS}
                    styles={selectStyles}
                    menuPortalTarget={document.body}
                    placeholder="Select admit source..."
                  />
                  <p className="text-xs text-gray-500">
                    How the patient was admitted to the facility
                  </p>
                </div>
              )}
            </div>

            {/* Vision claims info - No Encounter needed */}
            {formData.auth_type === 'vision' && (
              <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <AlertCircle className="h-5 w-5 text-blue-500" />
                <span className="text-sm text-blue-700">
                  Vision claims do not require Encounter information per NPHIES specification.
                </span>
              </div>
            )}

            {/* Pharmacy claims info */}
            {formData.auth_type === 'pharmacy' && (
              <div className="flex items-center gap-2 p-3 bg-purple-50 border border-purple-200 rounded-lg">
                <Pill className="h-5 w-5 text-purple-500" />
                <span className="text-sm text-purple-700">
                  Pharmacy claims do not require Encounter information per NPHIES specification. Required: Patient, Provider, Diagnosis, Items with medication codes, and Insurance.
                </span>
              </div>
            )}

            {/* Service Event Type - For dental claims only (standalone) */}
            {formData.auth_type === 'dental' && (
              <div className="space-y-2">
                <Label>Service Event Type *</Label>
                <Select
                  value={SERVICE_EVENT_TYPE_OPTIONS.find(opt => opt.value === formData.service_event_type)}
                  onChange={(option) => handleChange('service_event_type', option?.value || 'ICSE')}
                  options={SERVICE_EVENT_TYPE_OPTIONS}
                  styles={selectStyles}
                  menuPortalTarget={document.body}
                />
                <p className="text-xs text-gray-500">
                  ICSE = New visit, SCSE = Follow-up visit
                </p>
              </div>
            )}

            {/* Professional Non-Emergency Encounter Details - Grouped in a card */}
            {formData.auth_type === 'professional' && formData.encounter_class !== 'emergency' && (
              <div className="space-y-4 p-4 bg-gradient-to-r from-indigo-50/50 to-purple-50/50 border border-indigo-200 rounded-lg">
                <div className="flex items-center gap-2 text-indigo-700 font-medium">
                  <Activity className="h-5 w-5" />
                  Professional Encounter Details
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Service Event Type</Label>
                    <Select
                      value={SERVICE_EVENT_TYPE_OPTIONS.find(opt => opt.value === formData.service_event_type)}
                      onChange={(option) => handleChange('service_event_type', option?.value || 'ICSE')}
                      options={SERVICE_EVENT_TYPE_OPTIONS}
                      styles={selectStyles}
                      menuPortalTarget={document.body}
                      isClearable
                    />
                    <p className="text-xs text-gray-500">
                      ICSE = New visit, SCSE = Follow-up visit
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label>Service Type</Label>
                    <Select
                      value={ENCOUNTER_SERVICE_TYPE_OPTIONS.find(opt => opt.value === formData.service_type)}
                      onChange={(option) => handleChange('service_type', option?.value || '')}
                      options={ENCOUNTER_SERVICE_TYPE_OPTIONS}
                      styles={selectStyles}
                      menuPortalTarget={document.body}
                      isClearable
                      placeholder="Select service type..."
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Emergency Encounter Fields - Required for EMER class per NPHIES Encounter-10122 */}
            {formData.encounter_class === 'emergency' && (
              <div className="space-y-4 p-4 bg-red-50/50 border border-red-200 rounded-lg">
                <div className="flex items-center gap-2 text-red-700 font-medium">
                  <AlertCircle className="h-5 w-5" />
                  Emergency Encounter Information
                </div>
                <p className="text-xs text-red-600">
                  These fields are required for Emergency (EMER) encounters per NPHIES specification.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Triage Category *</Label>
                    <Select
                      value={TRIAGE_CATEGORY_OPTIONS.find(opt => opt.value === formData.triage_category)}
                      onChange={(option) => handleChange('triage_category', option?.value || '')}
                      options={TRIAGE_CATEGORY_OPTIONS}
                      styles={selectStyles}
                      menuPortalTarget={document.body}
                      placeholder="Select triage category..."
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Triage Date & Time *</Label>
                    <div className="datepicker-wrapper">
                      <DatePicker
                        selected={formData.triage_date ? new Date(formData.triage_date) : null}
                        onChange={(date) => handleChange('triage_date', date ? date.toISOString() : '')}
                        showTimeSelect
                        dateFormat="yyyy-MM-dd HH:mm"
                        className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-300"
                        placeholderText="Select triage date & time"
                      />
                      <Calendar className="datepicker-icon h-4 w-4" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Encounter Priority *</Label>
                    <Select
                      value={ENCOUNTER_PRIORITY_OPTIONS.find(opt => opt.value === formData.encounter_priority)}
                      onChange={(option) => handleChange('encounter_priority', option?.value || 'EM')}
                      options={ENCOUNTER_PRIORITY_OPTIONS}
                      styles={selectStyles}
                      menuPortalTarget={document.body}
                      placeholder="Select priority..."
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Service Type</Label>
                    <Select
                      value={ENCOUNTER_SERVICE_TYPE_OPTIONS.find(opt => opt.value === formData.service_type)}
                      onChange={(option) => handleChange('service_type', option?.value || '')}
                      options={ENCOUNTER_SERVICE_TYPE_OPTIONS}
                      styles={selectStyles}
                      menuPortalTarget={document.body}
                      isClearable
                      placeholder="Select service type..."
                    />
                  </div>
                  {/* Service Event Type - inside emergency box for professional emergency */}
                  {formData.auth_type === 'professional' && (
                    <div className="space-y-2">
                      <Label>Service Event Type</Label>
                      <Select
                        value={SERVICE_EVENT_TYPE_OPTIONS.find(opt => opt.value === formData.service_event_type)}
                        onChange={(option) => handleChange('service_event_type', option?.value || 'ICSE')}
                        options={SERVICE_EVENT_TYPE_OPTIONS}
                        styles={selectStyles}
                        menuPortalTarget={document.body}
                        isClearable
                        placeholder="Select event type..."
                      />
                      <p className="text-xs text-gray-500">
                        ICSE = New visit, SCSE = Follow-up
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Service Type for non-emergency encounters (Institutional only - Professional has its own card, Dental/Vision/Pharmacy don't need it) */}
            {formData.auth_type === 'institutional' && formData.encounter_class !== 'emergency' && (
              <div className="space-y-2">
                <Label>Service Type</Label>
                <Select
                  value={ENCOUNTER_SERVICE_TYPE_OPTIONS.find(opt => opt.value === formData.service_type)}
                  onChange={(option) => handleChange('service_type', option?.value || '')}
                  options={ENCOUNTER_SERVICE_TYPE_OPTIONS}
                  styles={selectStyles}
                  menuPortalTarget={document.body}
                  isClearable
                  placeholder="Select service type (optional)..."
                />
              </div>
            )}

            {/* Encounter Period - Only for claims that use Encounter (not Vision/Pharmacy) */}
            {formData.auth_type !== 'vision' && formData.auth_type !== 'pharmacy' && (
              <>
                <hr className="border-gray-200" />

                {/* Encounter Period - Format depends on encounter class:
                    - AMB (Ambulatory/Dental): date only "2023-12-04" per https://portal.nphies.sa/ig/Encounter-10123.json.html
                    - SS/IMP (Short Stay/Inpatient): dateTime "2023-12-04T10:25:00+03:00" per https://portal.nphies.sa/ig/Encounter-10124.json.html
                    Note: Dental claims always use AMB encounter class */}
                {(() => {
                  // Dental claims MUST use ambulatory encounter class (date-only, no end date per NPHIES)
                  const isDentalClaim = formData.auth_type === 'dental';
                  const needsDateTime = !isDentalClaim && ['inpatient', 'daycase'].includes(formData.encounter_class);
                  // Per NPHIES Encounter-10123 example: AMB encounters don't need end date (ongoing)
                  const showEndDate = needsDateTime;
                  
                  return (
                    <div className={`grid grid-cols-1 ${showEndDate ? 'md:grid-cols-2' : ''} gap-4`}>
                      <div className="space-y-2">
                        <Label>
                          Encounter Start {needsDateTime ? 'Date & Time' : 'Date'}
                          {isDentalClaim && <span className="text-xs text-gray-500 ml-1">(Dental uses date only)</span>}
                        </Label>
                        <div className="datepicker-wrapper">
                          <DatePicker
                            selected={formData.encounter_start ? new Date(formData.encounter_start) : null}
                            onChange={(date) => handleChange('encounter_start', date ? (
                              needsDateTime 
                                ? date.toISOString() 
                                : date.toISOString().split('T')[0]
                            ) : '')}
                            showTimeSelect={needsDateTime}
                            dateFormat={needsDateTime ? "yyyy-MM-dd HH:mm" : "yyyy-MM-dd"}
                            className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-purple/30"
                            placeholderText={needsDateTime ? "Select date & time" : "Select date"}
                          />
                          <Calendar className="datepicker-icon h-4 w-4" />
                        </div>
                      </div>
                      {showEndDate && (
                        <div className="space-y-2">
                          <Label>
                            Encounter End Date & Time (Optional)
                          </Label>
                          <div className="datepicker-wrapper">
                            <DatePicker
                              selected={formData.encounter_end ? new Date(formData.encounter_end) : null}
                              onChange={(date) => handleChange('encounter_end', date ? date.toISOString() : '')}
                              showTimeSelect
                              dateFormat="yyyy-MM-dd HH:mm"
                              isClearable
                              className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-purple/30"
                              placeholderText="Select date & time (optional)"
                            />
                            <Calendar className="datepicker-icon h-4 w-4" />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </>
            )}

            <hr className="border-gray-200" />

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="total_amount">Total Amount</Label>
                <div className="flex gap-2">
                  <Input
                    id="total_amount"
                    type="number"
                    step="0.01"
                    value={formData.total_amount ?? ''}
                    onChange={(e) => handleChange('total_amount', e.target.value)}
                    placeholder="0.00"
                  />
                  <Button type="button" variant="outline" size="sm" onClick={calculateTotal}>
                    Calculate
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Currency</Label>
                <Select
                  value={CURRENCY_OPTIONS.find(opt => opt.value === formData.currency)}
                  onChange={(option) => handleChange('currency', option?.value || 'SAR')}
                  options={CURRENCY_OPTIONS}
                  styles={selectStyles}
                  menuPortalTarget={document.body}
                />
              </div>
              {/* Eligibility Reference - Show legacy format for non-professional types */}
              {formData.auth_type !== 'professional' && (
                <div className="space-y-2">
                  <Label htmlFor="eligibility_ref">Eligibility Reference</Label>
                  <Input
                    id="eligibility_ref"
                    value={formData.eligibility_ref || ''}
                    onChange={(e) => handleChange('eligibility_ref', e.target.value)}
                    placeholder="CoverageEligibilityResponse/uuid"
                  />
                  <p className="text-xs text-gray-500">
                    Direct reference format (e.g., CoverageEligibilityResponse/12345)
                  </p>
                </div>
              )}
            </div>

            {/* Eligibility Response Identifier - Only for Professional claims per NPHIES Claim-173086 */}
            {formData.auth_type === 'professional' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 p-4 bg-blue-50/50 border border-blue-200 rounded-lg">
                <div className="col-span-2 flex items-center gap-2 text-blue-700 font-medium text-sm">
                  <CheckCircle className="h-4 w-4" />
                  Eligibility Response Identifier
                </div>
                <div className="space-y-2">
                  <Label htmlFor="eligibility_response_id">Eligibility Response ID</Label>
                  <Input
                    id="eligibility_response_id"
                    value={formData.eligibility_response_id || ''}
                    onChange={(e) => handleChange('eligibility_response_id', e.target.value)}
                    placeholder="e.g., Elig_199719982262"
                  />
                  <p className="text-xs text-gray-500">
                    The eligibility response identifier value from the payer
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="eligibility_response_system">Identifier System (Optional)</Label>
                  <Input
                    id="eligibility_response_system"
                    value={formData.eligibility_response_system || ''}
                    onChange={(e) => handleChange('eligibility_response_system', e.target.value)}
                    placeholder="http://payer.com/identifiers/coverageeligibilityresponse"
                  />
                  <p className="text-xs text-gray-500">
                    Leave empty to use payer's default system
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Parties Tab */}
      {activeTab === 'parties' && (
        <Card>
          <CardHeader>
            <CardTitle>Involved Parties</CardTitle>
            <CardDescription>Select the patient, provider, and insurer for this request</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Patient */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Patient *
                </Label>
                <Select
                  value={patients.map(p => ({ value: p.patient_id, label: `${p.name}${p.identifier ? ` (${p.identifier})` : ''}` })).find(opt => opt.value == formData.patient_id)}
                  onChange={(option) => handleChange('patient_id', option?.value || '')}
                  options={patients.map(p => ({ value: p.patient_id, label: `${p.name}${p.identifier ? ` (${p.identifier})` : ''}` }))}
                  styles={selectStyles}
                  placeholder="Search and select patient..."
                  isClearable
                  isSearchable
                  menuPortalTarget={document.body}
                />
              </div>

              {/* Provider */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Building className="h-4 w-4" />
                  Provider *
                </Label>
                <Select
                  value={providers.map(p => ({ value: p.provider_id, label: `${p.provider_name || p.name}${p.nphies_id ? ` (${p.nphies_id})` : ''}` })).find(opt => opt.value == formData.provider_id)}
                  onChange={(option) => handleChange('provider_id', option?.value || '')}
                  options={providers.map(p => ({ value: p.provider_id, label: `${p.provider_name || p.name}${p.nphies_id ? ` (${p.nphies_id})` : ''}` }))}
                  styles={selectStyles}
                  placeholder="Search and select provider..."
                  isClearable
                  isSearchable
                  menuPortalTarget={document.body}
                />
              </div>

              {/* Practice Code - NPHIES careTeam.qualification */}
              {/* NOT shown for pharmacy/vision claims (they don't have careTeam per NPHIES examples) */}
              {formData.auth_type !== 'pharmacy' && formData.auth_type !== 'vision' && (
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Stethoscope className="h-4 w-4" />
                    Practice Code / Specialty *
                  </Label>
                  <Select
                    value={PRACTICE_CODES_OPTIONS.flatMap(group => group.options).find(opt => opt.value === formData.practice_code)}
                    onChange={(option) => handleChange('practice_code', option?.value || '08.00')}
                    options={PRACTICE_CODES_OPTIONS}
                    styles={selectStyles}
                    placeholder="Select practice code/specialty..."
                    isSearchable
                    menuPortalTarget={document.body}
                  />
                  <p className="text-xs text-gray-500">
                    NPHIES: Provider's practice specialty for careTeam.qualification
                  </p>
                </div>
              )}

              {/* Coverage - Shows patient's insurance coverages */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <CreditCard className="h-4 w-4" />
                  Coverage {formData.patient_id && '*'}
                  {loadingCoverages && <span className="text-xs text-gray-500">(Loading...)</span>}
                </Label>
                {!formData.patient_id ? (
                  <div className="text-sm text-gray-500 p-3 bg-gray-50 rounded-md">
                    Select a patient first to see their insurance coverages
                  </div>
                ) : coverages.length === 0 && !loadingCoverages ? (
                  <div className="text-sm text-amber-600 p-3 bg-amber-50 rounded-md">
                    No coverages found for this patient. You can manually select an insurer below.
                  </div>
                ) : (
                  <Select
                    value={coverages.map(c => ({ 
                      value: c.coverage_id, 
                      label: `${c.insurer_name || 'Unknown Insurer'} - ${c.member_id || c.policy_number}${c.plan_name ? ` (${c.plan_name})` : ''}`
                    })).find(opt => opt.value == formData.coverage_id)}
                    onChange={(option) => handleCoverageChange(option?.value || '')}
                    options={coverages.map(c => ({ 
                      value: c.coverage_id, 
                      label: `${c.insurer_name || 'Unknown Insurer'} - ${c.member_id || c.policy_number}${c.plan_name ? ` (${c.plan_name})` : ''}`
                    }))}
                    styles={selectStyles}
                    placeholder="Select coverage..."
                    isClearable
                    isSearchable
                    isLoading={loadingCoverages}
                    menuPortalTarget={document.body}
                  />
                )}
              </div>

              {/* Insurer - Auto-filled from coverage, or manual selection */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Shield className="h-4 w-4" />
                  Insurer *
                  {formData.coverage_id && <span className="text-xs text-green-600">(from coverage)</span>}
                </Label>
                <Select
                  value={insurers.map(i => ({ value: i.insurer_id, label: `${i.insurer_name || i.name}${i.nphies_id ? ` (${i.nphies_id})` : ''}` })).find(opt => opt.value == formData.insurer_id)}
                  onChange={(option) => handleChange('insurer_id', option?.value || '')}
                  options={insurers.map(i => ({ value: i.insurer_id, label: `${i.insurer_name || i.name}${i.nphies_id ? ` (${i.nphies_id})` : ''}` }))}
                  styles={selectStyles}
                  placeholder="Search and select insurer..."
                  isClearable
                  isSearchable
                  menuPortalTarget={document.body}
                  isDisabled={!!formData.coverage_id}
                />
                {formData.coverage_id && (
                  <p className="text-xs text-gray-500">Clear coverage selection to manually choose insurer</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Clinical Tab */}
      {activeTab === 'clinical' && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Diagnoses</CardTitle>
                <CardDescription>ICD-10 diagnosis codes for this authorization</CardDescription>
              </div>
              <Button type="button" onClick={addDiagnosis} variant="outline" size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Add Diagnosis
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {formData.diagnoses.map((diagnosis, index) => (
              <div key={index} className="flex items-start gap-4 p-4 border rounded-lg bg-gray-50">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary-purple text-white flex items-center justify-center text-sm font-medium">
                  {diagnosis.sequence}
                </div>
                <div className="flex-1 grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="space-y-2 md:col-span-2">
                    <Label>ICD-10 Code *</Label>
                    <AsyncSelect
                      value={diagnosis.diagnosis_code ? {
                        value: diagnosis.diagnosis_code,
                        label: `${diagnosis.diagnosis_code}${diagnosis.diagnosis_display ? ' - ' + diagnosis.diagnosis_display : ''}`
                      } : null}
                      onChange={(option) => {
                        handleDiagnosisChange(index, 'diagnosis_code', option?.value || '');
                        // Extract description from label (format: "CODE - Description")
                        const description = option?.label?.includes(' - ') 
                          ? option.label.split(' - ').slice(1).join(' - ')
                          : '';
                        handleDiagnosisChange(index, 'diagnosis_display', description);
                      }}
                      loadOptions={async (inputValue) => {
                        try {
                          const results = await api.searchIcd10Codes(inputValue, 50);
                          return results;
                        } catch (error) {
                          console.error('Error loading ICD-10 codes:', error);
                          return [];
                        }
                      }}
                      defaultOptions
                      cacheOptions
                      styles={selectStyles}
                      placeholder="Search ICD-10 codes..."
                      isClearable
                      isSearchable
                      menuPortalTarget={document.body}
                      noOptionsMessage={({ inputValue }) => 
                        inputValue ? `No codes found for "${inputValue}"` : 'Type to search ICD-10 codes...'
                      }
                      loadingMessage={() => 'Searching...'}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Description</Label>
                    <Input
                      value={diagnosis.diagnosis_display || ''}
                      onChange={(e) => handleDiagnosisChange(index, 'diagnosis_display', e.target.value)}
                      placeholder="Auto-filled from ICD-10 selection"
                      readOnly
                      className="bg-gray-50"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Type</Label>
                    <Select
                      value={DIAGNOSIS_TYPE_OPTIONS.find(opt => opt.value === diagnosis.diagnosis_type)}
                      onChange={(option) => handleDiagnosisChange(index, 'diagnosis_type', option?.value || 'principal')}
                      options={DIAGNOSIS_TYPE_OPTIONS}
                      styles={selectStyles}
                      menuPortalTarget={document.body}
                    />
                  </div>
                </div>
                {formData.diagnoses.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-red-500 hover:text-red-700"
                    onClick={() => removeDiagnosis(index)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Vitals & Clinical Tab */}
      {activeTab === 'vitals' && (
        <div className="space-y-6">
          {/* Vital Signs Section */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="h-5 w-5 text-red-500" />
                    Vital Signs
                  </CardTitle>
                  <CardDescription>Patient vital signs measured during the encounter</CardDescription>
                </div>
                <div className="flex items-center gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleAIValidation}
                    disabled={aiValidationLoading}
                    className="flex items-center gap-2 text-blue-600 border-blue-200 hover:bg-blue-50 hover:border-blue-300"
                    title="Validate clinical data with AI to identify potential rejection risks"
                  >
                    {aiValidationLoading ? (
                      <RefreshCw className="h-4 w-4 animate-spin" />
                    ) : (
                      <Sparkles className="h-4 w-4" />
                    )}
                    AI Validate
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleFillDummyData}
                    className="flex items-center gap-2 text-purple-600 border-purple-200 hover:bg-purple-50 hover:border-purple-300"
                    title="Fill with realistic sample data based on authorization type"
                  >
                    <Sparkles className="h-4 w-4" />
                    Fill Sample Data
                  </Button>
                  <div className="flex items-center gap-2">
                    <Label className="text-sm text-gray-500">Measurement Time:</Label>
                    <div className="datepicker-wrapper w-52">
                      <DatePicker
                        selected={formData.vital_signs.measurement_time ? new Date(formData.vital_signs.measurement_time) : null}
                        onChange={(date) => handleVitalSignChange('measurement_time', date ? date.toISOString() : null)}
                        showTimeInput
                        timeInputLabel="Time:"
                        dateFormat="yyyy-MM-dd HH:mm"
                        className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-purple/30"
                        placeholderText="Select date & time"
                      />
                      <Calendar className="datepicker-icon h-4 w-4" />
                    </div>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {VITAL_SIGNS_FIELDS.map((field) => (
                  <div key={field.key} className="space-y-2">
                    <Label htmlFor={field.key} className="text-sm font-medium">
                      {field.label}
                    </Label>
                    <div className="relative">
                      <Input
                        id={field.key}
                        type="number"
                        step="0.1"
                        value={formData.vital_signs?.[field.key] ?? ''}
                        onChange={(e) => handleVitalSignChange(field.key, e.target.value)}
                        placeholder={field.placeholder}
                        className="pr-16"
                      />
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        <Badge variant="secondary" className="font-mono text-xs">
                          {field.unitLabel}
                        </Badge>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Quick BMI calculation display */}
              {formData.vital_signs.height && formData.vital_signs.weight && (
                <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <p className="text-sm text-blue-800">
                    <strong>Calculated BMI:</strong>{' '}
                    {(parseFloat(formData.vital_signs.weight) / Math.pow(parseFloat(formData.vital_signs.height) / 100, 2)).toFixed(1)} kg/m²
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* AI Validation Panel */}
          {showAiValidation && (
            <AIValidationPanel
              validationResult={aiValidationResult}
              loading={aiValidationLoading}
              onApplySuggestion={handleApplyAISuggestion}
              onDismiss={() => setShowAiValidation(false)}
            />
          )}

          {/* Clinical Information Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Stethoscope className="h-5 w-5 text-blue-500" />
                Clinical Information
              </CardTitle>
              <CardDescription>Chief complaint, patient history, and clinical findings</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Chief Complaint Section */}
              {formData.auth_type === 'dental' ? (
                /* Dental: SNOMED dropdown or Free Text */
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label>Chief Complaint Format</Label>
                      <Select
                        value={CHIEF_COMPLAINT_FORMAT_OPTIONS.find(opt => opt.value === formData.clinical_info.chief_complaint_format)}
                        onChange={(option) => {
                          handleClinicalInfoChange('chief_complaint_format', option?.value || 'snomed');
                          // Clear values when switching format
                          if (option?.value === 'text') {
                            handleClinicalInfoChange('chief_complaint_code', '');
                            handleClinicalInfoChange('chief_complaint_display', '');
                          } else {
                            handleClinicalInfoChange('chief_complaint_text', '');
                          }
                        }}
                        options={CHIEF_COMPLAINT_FORMAT_OPTIONS}
                        styles={selectStyles}
                        menuPortalTarget={document.body}
                      />
                    </div>
                    {formData.clinical_info.chief_complaint_format === 'snomed' ? (
                      <div className="space-y-2 md:col-span-2">
                        <Label>Chief Complaint (SNOMED) *</Label>
                        <Select
                          value={DENTAL_CHIEF_COMPLAINT_OPTIONS.find(opt => opt.value === formData.clinical_info.chief_complaint_code)}
                          onChange={(option) => {
                            handleClinicalInfoChange('chief_complaint_code', option?.value || '');
                            handleClinicalInfoChange('chief_complaint_display', option?.label?.split(' - ')[1] || '');
                          }}
                          options={DENTAL_CHIEF_COMPLAINT_OPTIONS}
                          styles={selectStyles}
                          placeholder="Select chief complaint..."
                          isClearable
                          isSearchable
                          menuPortalTarget={document.body}
                        />
                      </div>
                    ) : (
                      <div className="space-y-2 md:col-span-2">
                        <Label>Chief Complaint (Free Text) *</Label>
                        <Input
                          value={formData.clinical_info?.chief_complaint_text ?? ''}
                          onChange={(e) => handleClinicalInfoChange('chief_complaint_text', e.target.value)}
                          placeholder="e.g., Periodic oral examination"
                        />
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                /* Non-Dental: Standard SNOMED code + description */
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="chief_complaint_code">Chief Complaint Code (SNOMED)</Label>
                    <Input
                      id="chief_complaint_code"
                      value={formData.clinical_info?.chief_complaint_code ?? ''}
                      onChange={(e) => handleClinicalInfoChange('chief_complaint_code', e.target.value)}
                      placeholder="e.g., 21522001"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="chief_complaint_display">Chief Complaint Description</Label>
                    <Input
                      id="chief_complaint_display"
                      value={formData.clinical_info?.chief_complaint_display ?? ''}
                      onChange={(e) => handleClinicalInfoChange('chief_complaint_display', e.target.value)}
                      placeholder="e.g., Abdominal pain"
                    />
                  </div>
                </div>
              )}

              {/* Clinical Text Fields */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {CLINICAL_TEXT_FIELDS.map((field) => (
                  <div key={field.key} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor={field.key}>{field.label}</Label>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEnhanceClinicalText(field.key)}
                        disabled={enhancingField === field.key || !formData.clinical_info?.[field.key] || formData.clinical_info?.[field.key]?.length < 5}
                        className="h-7 px-2 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50 disabled:opacity-50"
                        title="Enhance this text with AI to make it more detailed and clinically complete"
                      >
                        {enhancingField === field.key ? (
                          <>
                            <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                            Enhancing...
                          </>
                        ) : (
                          <>
                            <Sparkles className="h-3 w-3 mr-1" />
                            Enhance with AI
                          </>
                        )}
                      </Button>
                    </div>
                    <textarea
                      id={field.key}
                      value={formData.clinical_info?.[field.key] ?? ''}
                      onChange={(e) => handleClinicalInfoChange(field.key, e.target.value)}
                      placeholder={field.placeholder}
                      rows={5}
                      className={`w-full rounded-md border bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-purple/30 resize-y min-h-[120px] transition-colors ${
                        enhancingField === field.key 
                          ? 'border-blue-300 bg-blue-50/30' 
                          : 'border-gray-200'
                      }`}
                      disabled={enhancingField === field.key}
                    />
                    <p className={`text-xs text-right ${
                      enhancingField === field.key ? 'text-blue-500' : 'text-gray-400'
                    }`}>
                      {enhancingField === field.key 
                        ? '✨ AI is enhancing this text...' 
                        : `${formData.clinical_info?.[field.key]?.length || 0} characters`
                      }
                    </p>
                  </div>
                ))}
              </div>

              {/* Investigation Result */}
              <div className="space-y-2">
                <Label>Investigation Result</Label>
                <Select
                  value={INVESTIGATION_RESULT_OPTIONS.find(opt => opt.value === formData.clinical_info.investigation_result)}
                  onChange={(option) => handleClinicalInfoChange('investigation_result', option?.value || '')}
                  options={INVESTIGATION_RESULT_OPTIONS}
                  styles={selectStyles}
                  placeholder="Select investigation result status..."
                  isClearable
                  menuPortalTarget={document.body}
                />
              </div>
            </CardContent>
          </Card>

          {/* Admission Information Section - Only for inpatient/daycase */}
          {['inpatient', 'daycase'].includes(formData.encounter_class) && (
            <Card className="border-amber-200 bg-amber-50/30">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building className="h-5 w-5 text-amber-600" />
                  Admission Information
                </CardTitle>
                <CardDescription>
                  Required for {formData.encounter_class === 'inpatient' ? 'inpatient' : 'day case'} encounters
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {ADMISSION_FIELDS.map((field) => (
                    <div key={field.key} className="space-y-2">
                      <Label htmlFor={field.key}>{field.label}</Label>
                      <div className="relative">
                        <Input
                          id={field.key}
                          type="number"
                          step={field.key === 'estimated_length_of_stay' ? '1' : '0.1'}
                          value={formData.admission_info?.[field.key] ?? ''}
                          onChange={(e) => handleAdmissionInfoChange(field.key, e.target.value)}
                          placeholder={field.placeholder}
                          className="pr-16"
                        />
                        <div className="absolute right-3 top-1/2 -translate-y-1/2">
                          <Badge variant="secondary" className="font-mono text-xs">
                            {field.unitLabel}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Non-admission hint */}
          {!['inpatient', 'daycase'].includes(formData.encounter_class) && (
            <div className="flex items-center gap-2 p-4 bg-gray-50 border border-gray-200 rounded-lg">
              <AlertCircle className="h-5 w-5 text-gray-400" />
              <span className="text-sm text-gray-600">
                Admission information fields are only shown for Inpatient or Day Case encounters. 
                Current encounter type: <strong className="capitalize">{formData.encounter_class}</strong>
              </span>
            </div>
          )}

          {/* Clinical Documents Upload Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <File className="h-5 w-5 text-red-500" />
                Clinical Documents
              </CardTitle>
              <CardDescription>
                Upload PDF documents related to the clinical case (lab results, medical reports, etc.)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Upload Area */}
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-purple-400 hover:bg-purple-50/30 transition-colors">
                <input
                  type="file"
                  accept=".pdf,application/pdf"
                  multiple
                  onChange={handlePdfUpload}
                  className="hidden"
                  id="pdf-upload"
                />
                <label htmlFor="pdf-upload" className="cursor-pointer">
                  <Upload className="h-10 w-10 mx-auto text-gray-400 mb-3" />
                  <p className="text-sm font-medium text-gray-700">
                    Click to upload PDF files
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    PDF files only • Multiple files allowed
                  </p>
                </label>
              </div>

              {/* Uploaded Files List */}
              {formData.clinical_documents?.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-gray-700">
                    Uploaded Documents ({formData.clinical_documents.length})
                  </p>
                  <div className="space-y-2">
                    {formData.clinical_documents.map((doc) => (
                      <div 
                        key={doc.id} 
                        className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200 hover:border-gray-300 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-red-100 rounded-lg">
                            <FileText className="h-5 w-5 text-red-600" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-800 truncate max-w-xs">
                              {doc.name}
                            </p>
                            <p className="text-xs text-gray-500">
                              {formatFileSize(doc.size)} • Uploaded {new Date(doc.uploadedAt).toLocaleString()}
                            </p>
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemovePdf(doc.id)}
                          className="text-gray-400 hover:text-red-500 hover:bg-red-50"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Summary of what will be submitted */}
          <Card className="bg-gradient-to-r from-purple-50 to-blue-50 border-purple-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                Data Summary
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-sm">
                <div className="bg-white rounded-lg p-2 border">
                  <p className="text-gray-500 text-xs">Vital Signs</p>
                  <p className="font-medium">
                    {VITAL_SIGNS_FIELDS.filter(f => formData.vital_signs[f.key]).length} / {VITAL_SIGNS_FIELDS.length}
                  </p>
                </div>
                <div className="bg-white rounded-lg p-2 border">
                  <p className="text-gray-500 text-xs">Clinical Fields</p>
                  <p className="font-medium">
                    {CLINICAL_TEXT_FIELDS.filter(f => formData.clinical_info[f.key]).length} / {CLINICAL_TEXT_FIELDS.length}
                  </p>
                </div>
                <div className="bg-white rounded-lg p-2 border">
                  <p className="text-gray-500 text-xs">Chief Complaint</p>
                  <p className="font-medium">
                    {formData.clinical_info.chief_complaint_code || formData.clinical_info.chief_complaint_text ? 'Set' : 'Not set'}
                  </p>
                </div>
                <div className="bg-white rounded-lg p-2 border">
                  <p className="text-gray-500 text-xs">Investigation Result</p>
                  <p className="font-medium">
                    {formData.clinical_info.investigation_result || 'Not set'}
                  </p>
                </div>
                <div className="bg-white rounded-lg p-2 border">
                  <p className="text-gray-500 text-xs">Documents</p>
                  <p className="font-medium">
                    {formData.clinical_documents?.length || 0} file(s)
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Items Tab */}
      {activeTab === 'items' && (
        <div className="space-y-6">
          {/* Vision Prescription Card - Only for vision auth type */}
          {formData.auth_type === 'vision' && (
            <Card className="border-blue-200 bg-blue-50/30">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Eye className="h-5 w-5 text-blue-600" />
                  Vision Prescription
                </CardTitle>
                <CardDescription>Lens specifications for the vision authorization</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Prescription Type and Date */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Product Type *</Label>
                    <Select
                      value={[
                        { value: 'lens', label: 'Spectacle Lens' },
                        { value: 'contact', label: 'Contact Lens' }
                      ].find(opt => opt.value === formData.vision_prescription.product_type)}
                      onChange={(option) => handleVisionPrescriptionChange('product_type', option?.value || 'lens')}
                      options={[
                        { value: 'lens', label: 'Spectacle Lens' },
                        { value: 'contact', label: 'Contact Lens' }
                      ]}
                      styles={selectStyles}
                      menuPortalTarget={document.body}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Date Written</Label>
                    <div className="datepicker-wrapper">
                      <DatePicker
                        selected={formData.vision_prescription.date_written ? new Date(formData.vision_prescription.date_written) : null}
                        onChange={(date) => handleVisionPrescriptionChange('date_written', date ? date.toISOString() : null)}
                        dateFormat="yyyy-MM-dd"
                        className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-purple/30"
                        placeholderText="Select prescription date"
                      />
                      <Calendar className="datepicker-icon h-4 w-4" />
                    </div>
                  </div>
                </div>

                {/* Right Eye Specifications */}
                <div className="p-4 border rounded-lg bg-white">
                  <h4 className="font-medium text-gray-900 mb-4 flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-green-500 text-white flex items-center justify-center text-xs">R</div>
                    Right Eye (OD)
                  </h4>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                    <div className="space-y-2">
                      <Label>Sphere (SPH)</Label>
                      <Input
                        type="number"
                        step="0.25"
                        value={formData.vision_prescription.right_eye.sphere}
                        onChange={(e) => handleVisionPrescriptionChange('sphere', e.target.value, 'right_eye')}
                        placeholder="e.g., -2.50"
                      />
                      <p className="text-xs text-gray-400">Diopters</p>
                    </div>
                    <div className="space-y-2">
                      <Label>Cylinder (CYL)</Label>
                      <Input
                        type="number"
                        step="0.25"
                        value={formData.vision_prescription.right_eye.cylinder}
                        onChange={(e) => handleVisionPrescriptionChange('cylinder', e.target.value, 'right_eye')}
                        placeholder="e.g., -1.25"
                      />
                      <p className="text-xs text-gray-400">Diopters</p>
                    </div>
                    <div className="space-y-2">
                      <Label>Axis</Label>
                      <Input
                        type="number"
                        min="1"
                        max="180"
                        value={formData.vision_prescription.right_eye.axis}
                        onChange={(e) => handleVisionPrescriptionChange('axis', e.target.value, 'right_eye')}
                        placeholder="1-180"
                      />
                      <p className="text-xs text-gray-400">Degrees</p>
                    </div>
                    <div className="space-y-2">
                      <Label>Add (Reading)</Label>
                      <Input
                        type="number"
                        step="0.25"
                        value={formData.vision_prescription.right_eye.add}
                        onChange={(e) => handleVisionPrescriptionChange('add', e.target.value, 'right_eye')}
                        placeholder="e.g., +2.00"
                      />
                      <p className="text-xs text-gray-400">Diopters</p>
                    </div>
                    <div className="space-y-2">
                      <Label>Prism Amount</Label>
                      <Input
                        type="number"
                        step="0.25"
                        value={formData.vision_prescription.right_eye.prism_amount}
                        onChange={(e) => handleVisionPrescriptionChange('prism_amount', e.target.value, 'right_eye')}
                        placeholder="e.g., 2"
                      />
                      <p className="text-xs text-gray-400">Prism diopters</p>
                    </div>
                    <div className="space-y-2">
                      <Label>Prism Base</Label>
                      <Select
                        value={[
                          { value: 'up', label: 'Up' },
                          { value: 'down', label: 'Down' },
                          { value: 'in', label: 'In' },
                          { value: 'out', label: 'Out' }
                        ].find(opt => opt.value === formData.vision_prescription.right_eye.prism_base)}
                        onChange={(option) => handleVisionPrescriptionChange('prism_base', option?.value || '', 'right_eye')}
                        options={[
                          { value: 'up', label: 'Up' },
                          { value: 'down', label: 'Down' },
                          { value: 'in', label: 'In' },
                          { value: 'out', label: 'Out' }
                        ]}
                        styles={selectStyles}
                        placeholder="Select..."
                        isClearable
                        menuPortalTarget={document.body}
                      />
                      <p className="text-xs text-gray-400">Base direction</p>
                    </div>
                  </div>
                </div>

                {/* Left Eye Specifications */}
                <div className="p-4 border rounded-lg bg-white">
                  <h4 className="font-medium text-gray-900 mb-4 flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-blue-500 text-white flex items-center justify-center text-xs">L</div>
                    Left Eye (OS)
                  </h4>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                    <div className="space-y-2">
                      <Label>Sphere (SPH)</Label>
                      <Input
                        type="number"
                        step="0.25"
                        value={formData.vision_prescription.left_eye.sphere}
                        onChange={(e) => handleVisionPrescriptionChange('sphere', e.target.value, 'left_eye')}
                        placeholder="e.g., -2.25"
                      />
                      <p className="text-xs text-gray-400">Diopters</p>
                    </div>
                    <div className="space-y-2">
                      <Label>Cylinder (CYL)</Label>
                      <Input
                        type="number"
                        step="0.25"
                        value={formData.vision_prescription.left_eye.cylinder}
                        onChange={(e) => handleVisionPrescriptionChange('cylinder', e.target.value, 'left_eye')}
                        placeholder="e.g., -1.00"
                      />
                      <p className="text-xs text-gray-400">Diopters</p>
                    </div>
                    <div className="space-y-2">
                      <Label>Axis</Label>
                      <Input
                        type="number"
                        min="1"
                        max="180"
                        value={formData.vision_prescription.left_eye.axis}
                        onChange={(e) => handleVisionPrescriptionChange('axis', e.target.value, 'left_eye')}
                        placeholder="1-180"
                      />
                      <p className="text-xs text-gray-400">Degrees</p>
                    </div>
                    <div className="space-y-2">
                      <Label>Add (Reading)</Label>
                      <Input
                        type="number"
                        step="0.25"
                        value={formData.vision_prescription.left_eye.add}
                        onChange={(e) => handleVisionPrescriptionChange('add', e.target.value, 'left_eye')}
                        placeholder="e.g., +2.00"
                      />
                      <p className="text-xs text-gray-400">Diopters</p>
                    </div>
                    <div className="space-y-2">
                      <Label>Prism Amount</Label>
                      <Input
                        type="number"
                        step="0.25"
                        value={formData.vision_prescription.left_eye.prism_amount}
                        onChange={(e) => handleVisionPrescriptionChange('prism_amount', e.target.value, 'left_eye')}
                        placeholder="e.g., 2"
                      />
                      <p className="text-xs text-gray-400">Prism diopters</p>
                    </div>
                    <div className="space-y-2">
                      <Label>Prism Base</Label>
                      <Select
                        value={[
                          { value: 'up', label: 'Up' },
                          { value: 'down', label: 'Down' },
                          { value: 'in', label: 'In' },
                          { value: 'out', label: 'Out' }
                        ].find(opt => opt.value === formData.vision_prescription.left_eye.prism_base)}
                        onChange={(option) => handleVisionPrescriptionChange('prism_base', option?.value || '', 'left_eye')}
                        options={[
                          { value: 'up', label: 'Up' },
                          { value: 'down', label: 'Down' },
                          { value: 'in', label: 'In' },
                          { value: 'out', label: 'Out' }
                        ]}
                        styles={selectStyles}
                        placeholder="Select..."
                        isClearable
                        menuPortalTarget={document.body}
                      />
                      <p className="text-xs text-gray-400">Base direction</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Service Items Card */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Service Items</CardTitle>
                  <CardDescription>Services, procedures, or medications requiring authorization</CardDescription>
                </div>
                <Button type="button" onClick={addItem} variant="outline" size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Item
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
            {formData.items.map((item, index) => (
              <div key={index} className="p-4 border rounded-lg bg-gray-50 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-primary-purple text-white flex items-center justify-center text-sm font-medium">
                      {item.sequence}
                    </div>
                    <span className="font-medium">Item {item.sequence}</span>
                  </div>
                  {formData.items.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-red-500 hover:text-red-700"
                      onClick={() => removeItem(index)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                
                {/* Generic procedure code fields - hidden for dental/pharmacy (they use specialized fields below) */}
                {formData.auth_type !== 'dental' && formData.auth_type !== 'pharmacy' && (
                  <div className="space-y-4">
                    {/* Code System Selection */}
                    {/* Per NPHIES IG: Claim.item.productOrService MUST use NPHIES codes, NOT LOINC */}
                    {/* LOINC codes are for Observation resources (see Lab Observations section below) */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label>Code System</Label>
                        <Select
                          value={SERVICE_CODE_SYSTEM_OPTIONS.find(opt => 
                            opt.value === (item.is_lab_service ? 'nphies-lab' : 'nphies')
                          ) || SERVICE_CODE_SYSTEM_OPTIONS[0]}
                          onChange={(option) => {
                            // Clear current code when switching systems
                            handleItemChange(index, 'product_or_service_code', '');
                            handleItemChange(index, 'product_or_service_display', '');
                            handleItemChange(index, 'product_or_service_system', option?.system || 'http://nphies.sa/terminology/CodeSystem/procedures');
                            handleItemChange(index, 'is_lab_service', option?.value === 'nphies-lab');
                          }}
                          options={SERVICE_CODE_SYSTEM_OPTIONS}
                          styles={selectStyles}
                          menuPortalTarget={document.body}
                        />
                        <p className="text-xs text-amber-600">
                          Note: LOINC codes go in Lab Observations section below
                        </p>
                      </div>
                      <div className="space-y-2">
                        <Label>Service/Procedure Code *</Label>
                        <Select
                          value={
                            item.is_lab_service
                              ? NPHIES_LAB_SERVICE_OPTIONS.find(opt => opt.value === item.product_or_service_code)
                              : NPHIES_PROCEDURE_OPTIONS.find(opt => opt.value === item.product_or_service_code)
                          }
                          onChange={(option) => {
                            handleItemChange(index, 'product_or_service_code', option?.value || '');
                            // Extract description from label (format: "CODE - Description")
                            const description = option?.label?.includes(' - ') 
                              ? option.label.split(' - ').slice(1).join(' - ')
                              : '';
                            handleItemChange(index, 'product_or_service_display', description);
                            // Always use NPHIES system (not LOINC)
                            handleItemChange(index, 'product_or_service_system', 'http://nphies.sa/terminology/CodeSystem/procedures');
                          }}
                          options={
                            item.is_lab_service
                              ? NPHIES_LAB_SERVICE_OPTIONS
                              : NPHIES_PROCEDURE_OPTIONS
                          }
                          styles={selectStyles}
                          placeholder={
                            item.is_lab_service
                              ? "Select NPHIES lab service..."
                              : "Select procedure..."
                          }
                          isClearable
                          isSearchable
                          menuPortalTarget={document.body}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Description</Label>
                        <Input
                          value={item.product_or_service_display || ''}
                          onChange={(e) => handleItemChange(index, 'product_or_service_display', e.target.value)}
                          placeholder="Auto-filled from selection"
                          readOnly
                          className="bg-gray-50"
                        />
                      </div>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="space-y-2">
                    <Label>Quantity</Label>
                    <Input
                      type="number"
                      min="1"
                      value={item.quantity}
                      onChange={(e) => handleItemChange(index, 'quantity', e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Unit Price</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={item.unit_price}
                      onChange={(e) => handleItemChange(index, 'unit_price', e.target.value)}
                      placeholder="0.00"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Net Amount</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={item.net_amount}
                      onChange={(e) => handleItemChange(index, 'net_amount', e.target.value)}
                      placeholder="Auto-calculated"
                      className="bg-gray-100"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Service Date</Label>
                    <div className="datepicker-wrapper">
                      <DatePicker
                        selected={item.serviced_date ? new Date(item.serviced_date) : null}
                        onChange={(date) => handleItemChange(index, 'serviced_date', date ? date.toISOString().split('T')[0] : '')}
                        dateFormat="yyyy-MM-dd"
                        className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-purple/30"
                        placeholderText="Select date"
                      />
                      <Calendar className="datepicker-icon h-4 w-4" />
                    </div>
                  </div>
                </div>

                {/* Package Item & Maternity checkboxes - For all auth types except pharmacy (pharmacy has its own section) */}
                {formData.auth_type !== 'pharmacy' && (
                  <div className="flex items-center gap-6 p-3 bg-blue-50 rounded-lg border border-blue-200">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={item.is_package || false}
                        onChange={(e) => handleItemChange(index, 'is_package', e.target.checked)}
                        className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm font-medium text-blue-800">Package Item</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={item.is_maternity || false}
                        onChange={(e) => handleItemChange(index, 'is_maternity', e.target.checked)}
                        className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm font-medium text-blue-800">Maternity Related</span>
                    </label>
                  </div>
                )}

                {/* Type-specific fields */}
                {formData.auth_type === 'dental' && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Dental Procedure Code *</Label>
                        <Select
                          value={DENTAL_PROCEDURE_OPTIONS.find(opt => opt.value === item.product_or_service_code)}
                          onChange={(option) => {
                            handleItemChange(index, 'product_or_service_code', option?.value || '');
                            // Extract description from label (format: "CODE - Description")
                            const description = option?.label?.includes(' - ') 
                              ? option.label.split(' - ').slice(1).join(' - ')
                              : '';
                            handleItemChange(index, 'product_or_service_display', description);
                            handleItemChange(index, 'product_or_service_system', 'http://nphies.sa/terminology/CodeSystem/oral-health-op');
                          }}
                          options={DENTAL_PROCEDURE_OPTIONS}
                          styles={selectStyles}
                          placeholder="Select dental procedure..."
                          isClearable
                          isSearchable
                          menuPortalTarget={document.body}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Procedure Description</Label>
                        <Input
                          value={item.product_or_service_display || ''}
                          onChange={(e) => handleItemChange(index, 'product_or_service_display', e.target.value)}
                          placeholder="Auto-filled from selection"
                          readOnly
                          className="bg-gray-50"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Tooth Number (FDI)</Label>
                        <Select
                          value={FDI_TOOTH_OPTIONS.find(opt => opt.value === item.tooth_number)}
                          onChange={(option) => {
                            handleItemChange(index, 'tooth_number', option?.value || '');
                            handleItemChange(index, 'tooth_display', option?.display || '');
                          }}
                          options={FDI_TOOTH_OPTIONS}
                          styles={selectStyles}
                          placeholder="Select tooth..."
                          isClearable
                          isSearchable
                          menuPortalTarget={document.body}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Tooth Surfaces (select multiple if needed)</Label>
                      <Select
                        value={TOOTH_SURFACE_OPTIONS.filter(opt => 
                          item.tooth_surface?.split(',').map(s => s.trim()).includes(opt.value)
                        )}
                        onChange={(options) => {
                          const surfaces = options?.map(opt => opt.value).join(',') || '';
                          handleItemChange(index, 'tooth_surface', surfaces);
                        }}
                        options={TOOTH_SURFACE_OPTIONS}
                        styles={selectStyles}
                        placeholder="Select tooth surfaces..."
                        isClearable
                        isMulti
                        menuPortalTarget={document.body}
                      />
                      <p className="text-xs text-gray-500">
                        M=Mesial, O=Occlusal, D=Distal, B=Buccal, L=Lingual
                      </p>
                    </div>
                  </div>
                )}

                {/* 
                  Vision claims: Per NPHIES BV-00374, NO bodySite on items for Vision claims
                  The Eye and Body Site fields are NOT required for vision - only the VisionPrescription
                  resource contains eye-specific details (right_eye/left_eye prescription data)
                  
                  Vision Claim items only need: service code, quantity, unit price
                  The eye specification is captured in the VisionPrescription section, not in items
                */}

                {/* Body Site for Professional/Institutional */}
                {['professional', 'institutional'].includes(formData.auth_type) && (
                  <div className="space-y-2">
                    <Label>Body Site (Optional)</Label>
                    <Select
                      value={BODY_SITE_OPTIONS_BY_AUTH_TYPE[formData.auth_type]?.find(opt => opt.value === item.body_site_code)}
                      onChange={(option) => handleItemChange(index, 'body_site_code', option?.value || '')}
                      options={BODY_SITE_OPTIONS_BY_AUTH_TYPE[formData.auth_type] || []}
                      styles={selectStyles}
                      placeholder="Select body site if applicable..."
                      isClearable
                      menuPortalTarget={document.body}
                    />
                    <p className="text-xs text-gray-500">
                      LT/RT for sides, F1-F9/FA for hands, T1-T9/TA for feet, LC/LD/LM/RC/RI for coronary
                    </p>
                  </div>
                )}

                {formData.auth_type === 'pharmacy' && (
                  <div className="space-y-4 p-4 bg-purple-50 rounded-lg border border-purple-200">
                    <h4 className="font-medium text-purple-800 flex items-center gap-2">
                      <Pill className="h-4 w-4" />
                      Pharmacy-Specific Information (NPHIES Required)
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Medication *</Label>
                        <AsyncSelect
                          value={item.medication_code ? {
                            value: item.medication_code,
                            label: `${item.medication_code}${item.medication_name ? ' - ' + item.medication_name : ''}`
                          } : null}
                          onChange={(option) => {
                            // Update medication code
                            handleItemChange(index, 'medication_code', option?.value || '');
                            // Auto-fill medication name from selection
                            if (option?.medication) {
                              handleItemChange(index, 'medication_name', option.medication.display || '');
                            } else {
                              handleItemChange(index, 'medication_name', '');
                            }
                          }}
                          loadOptions={async (inputValue) => {
                            try {
                              const results = await api.searchMedicationCodes(inputValue, 50);
                              return results;
                            } catch (error) {
                              console.error('Error loading medications:', error);
                              return [];
                            }
                          }}
                          defaultOptions
                          cacheOptions
                          styles={selectStyles}
                          placeholder="Search medications by name, code, or ingredient..."
                          isClearable
                          isSearchable
                          menuPortalTarget={document.body}
                          noOptionsMessage={({ inputValue }) => 
                            inputValue ? `No medications found for "${inputValue}"` : 'Type to search medications...'
                          }
                          loadingMessage={() => 'Searching medications...'}
                        />
                        <p className="text-xs text-gray-500">Search by medication name, GTIN code, or ingredient</p>
                      </div>
                      <div className="space-y-2">
                        <Label>Medication Name</Label>
                        <Input
                          value={item.medication_name || ''}
                          onChange={(e) => handleItemChange(index, 'medication_name', e.target.value)}
                          placeholder="Auto-filled from selection"
                          readOnly
                          className="bg-gray-50"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Prescribed Medication Code</Label>
                        <AsyncSelect
                          value={item.prescribed_medication_code ? {
                            value: item.prescribed_medication_code,
                            label: item.prescribed_medication_code
                          } : null}
                          onChange={(option) => {
                            handleItemChange(index, 'prescribed_medication_code', option?.value || '');
                          }}
                          loadOptions={async (inputValue) => {
                            try {
                              const results = await api.searchMedicationCodes(inputValue, 50);
                              return results;
                            } catch (error) {
                              console.error('Error loading medications:', error);
                              return [];
                            }
                          }}
                          defaultOptions
                          cacheOptions
                          styles={selectStyles}
                          placeholder="Search original prescription..."
                          isClearable
                          isSearchable
                          menuPortalTarget={document.body}
                          noOptionsMessage={({ inputValue }) => 
                            inputValue ? `No medications found` : 'Type to search...'
                          }
                        />
                        <p className="text-xs text-gray-500">Original prescribed medication (if substituting)</p>
                      </div>
                      <div className="space-y-2">
                        <Label>Days Supply *</Label>
                        <Input
                          type="number"
                          value={item.days_supply || 30}
                          onChange={(e) => handleItemChange(index, 'days_supply', e.target.value)}
                          placeholder="30"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Pharmacist Selection Reason *</Label>
                        <Select
                          value={[
                            { value: 'patient-request', label: 'Patient Request' },
                            { value: 'out-of-stock', label: 'Out of Stock' },
                            { value: 'formulary-drug', label: 'Formulary Drug' },
                            { value: 'therapeutic-alternative', label: 'Therapeutic Alternative' },
                            { value: 'other', label: 'Other' }
                          ].find(opt => opt.value === (item.pharmacist_selection_reason || 'patient-request'))}
                          onChange={(option) => handleItemChange(index, 'pharmacist_selection_reason', option?.value || 'patient-request')}
                          options={[
                            { value: 'patient-request', label: 'Patient Request' },
                            { value: 'out-of-stock', label: 'Out of Stock' },
                            { value: 'formulary-drug', label: 'Formulary Drug' },
                            { value: 'therapeutic-alternative', label: 'Therapeutic Alternative' },
                            { value: 'other', label: 'Other' }
                          ]}
                          styles={selectStyles}
                          menuPortalTarget={document.body}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Pharmacist Substitute *</Label>
                        <Select
                          value={[
                            { value: 'Irreplaceable', label: 'SFDA Irreplaceable drugs' },
                            { value: 'Replaceable', label: 'SFDA Replaceable drugs' },
                            { value: 'Therapeutic-alternative', label: 'Therapeutic Alternative' },
                            { value: 'Not-substituted', label: 'Not Substituted' }
                          ].find(opt => opt.value === (item.pharmacist_substitute || 'Irreplaceable'))}
                          onChange={(option) => handleItemChange(index, 'pharmacist_substitute', option?.value || 'Irreplaceable')}
                          options={[
                            { value: 'Irreplaceable', label: 'SFDA Irreplaceable drugs' },
                            { value: 'Replaceable', label: 'SFDA Replaceable drugs' },
                            { value: 'Therapeutic-alternative', label: 'Therapeutic Alternative' },
                            { value: 'Not-substituted', label: 'Not Substituted' }
                          ]}
                          styles={selectStyles}
                          menuPortalTarget={document.body}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label>Patient Share (SAR)</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={item.patient_share || 0}
                          onChange={(e) => handleItemChange(index, 'patient_share', e.target.value)}
                          placeholder="0.00"
                        />
                      </div>
                      <div className="flex items-center gap-4 pt-6">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={item.is_package || false}
                            onChange={(e) => handleItemChange(index, 'is_package', e.target.checked)}
                            className="w-4 h-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                          />
                          <span className="text-sm">Package Item</span>
                        </label>
                      </div>
                      <div className="flex items-center gap-4 pt-6">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={item.is_maternity || false}
                            onChange={(e) => handleItemChange(index, 'is_maternity', e.target.checked)}
                            className="w-4 h-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                          />
                          <span className="text-sm">Maternity Related</span>
                        </label>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}

            {/* Total */}
            <div className="flex justify-end pt-4 border-t">
              <div className="text-right">
                <p className="text-sm text-gray-500">Total Amount</p>
                <p className="text-2xl font-bold text-primary-purple">
                  {formatAmount(formData.total_amount || getCalculatedTotal(), formData.currency)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

          {/* AI Medication Safety Analysis - Only for Pharmacy */}
          {formData.auth_type === 'pharmacy' && (
            <>
              {/* AI Suggestions Button */}
              {formData.diagnoses?.some(d => d.diagnosis_code) && !showSuggestions && (() => {
                // Get patient information for display
                const selectedPatient = patients.find(p => p.patient_id == formData.patient_id);
                const patientAge = selectedPatient ? calculatePatientAge(selectedPatient.birth_date || selectedPatient.date_of_birth) : null;
                const patientGender = selectedPatient?.gender;
                const patientName = selectedPatient?.name;
                const hasPatientInfo = selectedPatient && patientAge;
                
                return (
                  <div className="bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-lg p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h4 className="text-sm font-medium text-purple-900 mb-1 flex items-center gap-2">
                          <Sparkles className="w-4 h-4" />
                          AI Medication Suggestions Available
                        </h4>
                        <p className="text-sm text-purple-700 mb-2">
                          Get AI-powered medication recommendations based on:
                        </p>
                        
                        {/* Patient & Diagnosis Info */}
                        <div className="bg-white rounded-lg p-3 mb-3 border border-purple-100">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                            {/* Patient Info */}
                            <div>
                              <p className="text-xs font-medium text-gray-500 uppercase mb-1">Patient</p>
                              {hasPatientInfo ? (
                                <div className="flex flex-wrap gap-2">
                                  <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs font-medium">
                                    {patientName || 'Selected Patient'}
                                  </span>
                                  <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-xs font-medium">
                                    Age: {patientAge} years
                                  </span>
                                  <span className="px-2 py-1 bg-purple-100 text-purple-800 rounded text-xs font-medium">
                                    {patientGender || 'Gender N/A'}
                                  </span>
                                </div>
                              ) : (
                                <span className="text-orange-600 text-xs">
                                  ⚠️ Select a patient in "Involved Parties" for age-appropriate suggestions
                                </span>
                              )}
                            </div>
                            
                            {/* Diagnosis Info */}
                            <div>
                              <p className="text-xs font-medium text-gray-500 uppercase mb-1">Diagnosis</p>
                              <span className="px-2 py-1 bg-red-100 text-red-800 rounded text-xs font-medium">
                                {formData.diagnoses?.find(d => d.diagnosis_type === 'principal')?.diagnosis_display || formData.diagnoses?.[0]?.diagnosis_display || 'Selected diagnosis'}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <Button
                      type="button"
                      onClick={getMedicationSuggestionsHandler}
                      disabled={suggestionsLoading}
                      className="bg-purple-600 hover:bg-purple-700 text-white"
                    >
                      <Sparkles className={`w-4 h-4 mr-2 ${suggestionsLoading ? 'animate-pulse' : ''}`} />
                      {suggestionsLoading ? 'Generating Suggestions...' : 'Get AI Suggestions'}
                    </Button>
                    
                    {!hasPatientInfo && (
                      <p className="text-xs text-orange-600 mt-2">
                        💡 Tip: Select a patient first to get age and gender-appropriate medication suggestions
                      </p>
                    )}
                    
                    {suggestionsError && (
                      <p className="text-sm text-red-600 mt-2">{suggestionsError}</p>
                    )}
                  </div>
                );
              })()}

              {/* Medication Suggestions Panel */}
              {showSuggestions && (
                <div>
                  <MedicationSuggestionsPanel
                    suggestions={medicationSuggestions}
                    isLoading={suggestionsLoading}
                    error={suggestionsError}
                    patientContext={suggestionsPatientContext}
                    onAddMedication={(suggestion) => {
                      // Add a new item with the suggested medication (generic - no system match)
                      addItem();
                      const newIndex = formData.items.length;
                      setTimeout(() => {
                        handleItemChange(newIndex, 'medication_name', suggestion.genericName);
                        handleItemChange(newIndex, 'medication_code', ''); // User needs to search for actual code
                      }, 100);
                    }}
                    onAddSystemMedication={(systemMed, suggestion) => {
                      // Add medication directly from system database with full details
                      addItem();
                      const newIndex = formData.items.length;
                      setTimeout(() => {
                        // Set the medication code (GTIN)
                        handleItemChange(newIndex, 'medication_code', systemMed.code);
                        // Set the medication name (display name from database)
                        handleItemChange(newIndex, 'medication_name', systemMed.display);
                        // Set default quantity
                        handleItemChange(newIndex, 'quantity', 1);
                        // Set unit price if available
                        if (systemMed.price) {
                          handleItemChange(newIndex, 'unit_price', parseFloat(systemMed.price));
                          handleItemChange(newIndex, 'net_amount', parseFloat(systemMed.price));
                        }
                        // Set product/service code to GTIN for NPHIES
                        handleItemChange(newIndex, 'product_or_service_code', systemMed.code);
                        handleItemChange(newIndex, 'product_or_service_display', systemMed.display);
                        handleItemChange(newIndex, 'product_or_service_system', 'http://nphies.sa/terminology/CodeSystem/medication-codes');
                        // Set days supply default
                        handleItemChange(newIndex, 'days_supply', 30);
                      }, 100);
                    }}
                  />
                  <button
                    onClick={() => setShowSuggestions(false)}
                    className="mt-3 text-sm text-gray-600 hover:text-gray-900 underline"
                  >
                    Hide suggestions
                  </button>
                </div>
              )}

              {/* Safety Analysis Card */}
              {formData.items.some(item => item.medication_code && item.medication_name) && (
                <Card className="border-blue-200">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center gap-2">
                        <Shield className="w-5 h-5 text-blue-600" />
                        AI Medication Safety Analysis
                      </CardTitle>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={analyzeMedicationSafety}
                        disabled={safetyLoading}
                        className="flex items-center gap-2"
                      >
                        <RefreshCw className={`w-4 h-4 ${safetyLoading ? 'animate-spin' : ''}`} />
                        {safetyLoading ? 'Analyzing...' : 'Re-analyze'}
                      </Button>
                    </div>
                    <CardDescription>
                      AI-powered analysis of drug interactions, side effects, and safety warnings
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <MedicationSafetyPanel
                      analysis={medicationSafetyAnalysis}
                      isLoading={safetyLoading}
                      error={safetyError}
                    />
                  </CardContent>
                </Card>
              )}

              {/* Info when no medications selected */}
              {!formData.items.some(item => item.medication_code && item.medication_name) && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-sm font-medium text-blue-900 mb-1">
                        AI Safety Analysis Available
                      </h4>
                      <p className="text-sm text-blue-700">
                        Select medications above to automatically analyze drug interactions, side effects, and get safety recommendations powered by AI.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Lab Observations Card - Only for Professional auth type */}
          {/* Per NPHIES IG: Lab test details MUST be in Observation resources with LOINC codes */}
          {/* These are referenced via Claim.supportingInfo with category = "laboratory" */}
          {formData.auth_type === 'professional' && (
            <Card className="border-emerald-200 bg-emerald-50/30 mt-6">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Activity className="h-5 w-5 text-emerald-600" />
                      Lab Observations (LOINC)
                    </CardTitle>
                    <CardDescription>
                      Laboratory test details for Observation resources. Required for lab service items.
                      <br />
                      <span className="text-amber-600 font-medium">
                        Note: Use NPHIES Lab Service codes for items above. LOINC codes go here for Observation resources.
                      </span>
                    </CardDescription>
                  </div>
                  <Button 
                    type="button" 
                    onClick={() => {
                      setFormData(prev => ({
                        ...prev,
                        lab_observations: [...prev.lab_observations, getInitialLabObservationData(prev.lab_observations.length + 1)]
                      }));
                    }} 
                    variant="outline" 
                    size="sm"
                    className="border-emerald-300 text-emerald-700 hover:bg-emerald-100"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Lab Observation
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {formData.lab_observations.length === 0 ? (
                  <div className="text-center py-8 text-gray-500 bg-white rounded-lg border border-dashed border-emerald-300">
                    <Activity className="h-8 w-8 mx-auto mb-2 text-emerald-400" />
                    <p>No lab observations added yet.</p>
                    <p className="text-sm text-emerald-600 mt-1">
                      Add LOINC-coded lab tests that will be linked to your lab service items.
                    </p>
                  </div>
                ) : (
                  formData.lab_observations.map((obs, index) => (
                    <div key={index} className="p-4 border rounded-lg bg-white space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-emerald-500 text-white flex items-center justify-center text-sm font-medium">
                            {obs.sequence}
                          </div>
                          <span className="font-medium">Lab Observation {obs.sequence}</span>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="text-red-500 hover:text-red-700"
                          onClick={() => {
                            setFormData(prev => ({
                              ...prev,
                              lab_observations: prev.lab_observations.filter((_, i) => i !== index)
                                .map((o, i) => ({ ...o, sequence: i + 1 }))
                            }));
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>LOINC Code *</Label>
                          <Select
                            value={LOINC_LAB_OPTIONS.find(opt => opt.value === obs.loinc_code)}
                            onChange={(option) => {
                              const newObs = [...formData.lab_observations];
                              newObs[index] = {
                                ...newObs[index],
                                loinc_code: option?.value || '',
                                loinc_display: option?.label?.includes(' - ') 
                                  ? option.label.split(' - ').slice(1).join(' - ')
                                  : '',
                                unit: option?.unit || '',
                                unit_code: option?.unit || ''
                              };
                              setFormData(prev => ({ ...prev, lab_observations: newObs }));
                            }}
                            options={LOINC_LAB_OPTIONS}
                            styles={selectStyles}
                            placeholder="Select LOINC lab test..."
                            isClearable
                            isSearchable
                            menuPortalTarget={document.body}
                          />
                          <p className="text-xs text-emerald-600">
                            Required codes: 80096-1, 43863-0, 55951-8, 12419-8
                          </p>
                        </div>
                        <div className="space-y-2">
                          <Label>Test Name</Label>
                          <Input
                            value={obs.loinc_display || obs.test_name || ''}
                            onChange={(e) => {
                              const newObs = [...formData.lab_observations];
                              newObs[index] = { ...newObs[index], test_name: e.target.value };
                              setFormData(prev => ({ ...prev, lab_observations: newObs }));
                            }}
                            placeholder="Auto-filled from LOINC selection"
                            readOnly={!!obs.loinc_display}
                            className={obs.loinc_display ? "bg-gray-50" : ""}
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="space-y-2">
                          <Label>Value (optional)</Label>
                          <Input
                            type={obs.value_type === 'string' ? 'text' : 'number'}
                            value={obs.value || ''}
                            onChange={(e) => {
                              const newObs = [...formData.lab_observations];
                              newObs[index] = { ...newObs[index], value: e.target.value };
                              setFormData(prev => ({ ...prev, lab_observations: newObs }));
                            }}
                            placeholder="Enter result value"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Unit</Label>
                          <Input
                            value={obs.unit || ''}
                            onChange={(e) => {
                              const newObs = [...formData.lab_observations];
                              newObs[index] = { ...newObs[index], unit: e.target.value };
                              setFormData(prev => ({ ...prev, lab_observations: newObs }));
                            }}
                            placeholder="e.g., mg/dL"
                            readOnly={!!obs.unit_code}
                            className={obs.unit_code ? "bg-gray-50" : ""}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Status</Label>
                          <Select
                            value={[
                              { value: 'registered', label: 'Registered (Ordered)' },
                              { value: 'preliminary', label: 'Preliminary' },
                              { value: 'final', label: 'Final' },
                              { value: 'amended', label: 'Amended' }
                            ].find(opt => opt.value === obs.status)}
                            onChange={(option) => {
                              const newObs = [...formData.lab_observations];
                              newObs[index] = { ...newObs[index], status: option?.value || 'registered' };
                              setFormData(prev => ({ ...prev, lab_observations: newObs }));
                            }}
                            options={[
                              { value: 'registered', label: 'Registered (Ordered)' },
                              { value: 'preliminary', label: 'Preliminary' },
                              { value: 'final', label: 'Final' },
                              { value: 'amended', label: 'Amended' }
                            ]}
                            styles={selectStyles}
                            menuPortalTarget={document.body}
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label>Note (optional)</Label>
                        <Input
                          value={obs.note || ''}
                          onChange={(e) => {
                            const newObs = [...formData.lab_observations];
                            newObs[index] = { ...newObs[index], note: e.target.value };
                            setFormData(prev => ({ ...prev, lab_observations: newObs }));
                          }}
                          placeholder="Additional notes about this lab test"
                        />
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Supporting Info Tab */}
      {activeTab === 'supporting' && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Supporting Information</CardTitle>
                <CardDescription>Additional clinical justification and attachments</CardDescription>
              </div>
              <div className="flex gap-2">
                <Button type="button" onClick={() => addSupportingInfo('info')} variant="outline" size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Info
                </Button>
                {formData.auth_type === 'pharmacy' && (
                  <Button type="button" onClick={() => addSupportingInfo('days-supply')} variant="outline" size="sm">
                    <Pill className="h-4 w-4 mr-2" />
                    Add Days Supply
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {formData.supporting_info.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Paperclip className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                <p>No supporting information added</p>
                <p className="text-sm">Click "Add Info" to add clinical justification</p>
              </div>
            ) : (
              formData.supporting_info.map((info, index) => {
                const selectedCategory = SUPPORTING_INFO_CATEGORY_OPTIONS.find(opt => opt.value === info.category);
                const needsCode = selectedCategory?.needsCode || false;
                
                return (
                  <div key={index} className="flex items-start gap-4 p-4 border rounded-lg bg-gray-50">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-accent-cyan text-white flex items-center justify-center text-sm font-medium">
                      {info.sequence}
                    </div>
                    <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label>Category</Label>
                        <Select
                          value={selectedCategory}
                          onChange={(option) => {
                            handleSupportingInfoChange(index, 'category', option?.value || 'info');
                            // Auto-fill code with category value (NPHIES uses category as code)
                            if (!option?.needsCode) {
                              handleSupportingInfoChange(index, 'code', option?.value || '');
                            } else {
                              handleSupportingInfoChange(index, 'code', '');
                            }
                          }}
                          options={SUPPORTING_INFO_CATEGORY_OPTIONS}
                          styles={selectStyles}
                          menuPortalTarget={document.body}
                          formatOptionLabel={(option) => (
                            <div>
                              <div className="font-medium">{option.label}</div>
                              {option.description && (
                                <div className="text-xs text-gray-500">{option.description}</div>
                              )}
                            </div>
                          )}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Code</Label>
                        <Input
                          value={info.code || info.category || ''}
                          onChange={(e) => handleSupportingInfoChange(index, 'code', e.target.value)}
                          placeholder={needsCode ? "Enter code (e.g., lab test code)" : "Auto-filled from category"}
                          readOnly={!needsCode}
                          className={!needsCode ? "bg-gray-100" : ""}
                        />
                        {!needsCode && (
                          <p className="text-xs text-gray-500">Code auto-filled from category</p>
                        )}
                      </div>
                      {info.category === 'days-supply' ? (
                        <div className="space-y-2">
                          <Label>Days</Label>
                          <Input
                            type="number"
                            value={info.value_quantity || ''}
                            onChange={(e) => handleSupportingInfoChange(index, 'value_quantity', e.target.value)}
                            placeholder="Number of days"
                          />
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <Label>Value</Label>
                          <Input
                            value={info.value_string || ''}
                            onChange={(e) => handleSupportingInfoChange(index, 'value_string', e.target.value)}
                            placeholder="Value"
                          />
                        </div>
                      )}
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-red-500 hover:text-red-700"
                      onClick={() => removeSupportingInfo(index)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                );
              })
            )}

            {/* Pharmacy warning */}
            {formData.auth_type === 'pharmacy' && !formData.supporting_info.some(i => i.category === 'days-supply') && (
              <div className="flex items-center gap-2 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <AlertCircle className="h-5 w-5 text-yellow-600" />
                <span className="text-sm text-yellow-800">
                  Pharmacy authorizations require "Days Supply" supporting information
                </span>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Communications Tab - For queued/pended PAs */}
      {activeTab === 'communications' && isEditMode && (formData.status === 'queued' || formData.outcome === 'queued' || formData.adjudication_outcome === 'pended') && (
        <Card>
          <CardContent className="pt-6">
            <CommunicationPanel
              priorAuthId={parseInt(id)}
              priorAuthStatus={formData.status}
              items={formData.items || []}
              onStatusUpdate={(updatedPA) => {
                // Update form data with new status
                setFormData(prev => ({
                  ...prev,
                  status: updatedPA.status,
                  outcome: updatedPA.outcome,
                  disposition: updatedPA.disposition,
                  pre_auth_ref: updatedPA.pre_auth_ref || prev.pre_auth_ref
                }));
              }}
            />
          </CardContent>
        </Card>
      )}

      {/* Preview Modal */}
      {showPreview && previewData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col m-4">
            {/* Modal Header */}
            <div className={`flex items-center justify-between p-6 border-b ${
              previewData.errors?.length > 0 
                ? 'bg-gradient-to-r from-red-50 to-amber-50' 
                : 'bg-gradient-to-r from-blue-50 to-purple-50'
            }`}>
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${
                  previewData.errors?.length > 0 ? 'bg-red-100' : 'bg-blue-100'
                }`}>
                  {previewData.errors?.length > 0 ? (
                    <AlertCircle className="h-6 w-6 text-red-600" />
                  ) : (
                    <Eye className="h-6 w-6 text-blue-600" />
                  )}
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900">
                    {previewData.errors?.length > 0 ? 'NPHIES Validation Errors' : 'FHIR Request Preview'}
                  </h2>
                  <p className="text-sm text-gray-600">
                    {previewData.errors?.length > 0 
                      ? `${previewData.errors.length} validation error(s) returned from NPHIES`
                      : 'This is the bundle that will be sent to NPHIES'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {previewData.outcome && (
                  <Badge variant={previewData.outcome === 'error' ? 'destructive' : 'default'}>
                    {previewData.outcome?.toUpperCase()}
                  </Badge>
                )}
                <button
                  onClick={() => setShowPreview(false)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <XCircle className="h-6 w-6 text-gray-500" />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              
              {/* NPHIES Errors Section */}
              {previewData.errors && previewData.errors.length > 0 && (
                <div className="bg-red-50 rounded-xl p-6 border border-red-200">
                  <h3 className="text-lg font-semibold mb-4 text-red-900 flex items-center">
                    <AlertCircle className="h-5 w-5 mr-2" />
                    NPHIES Validation Errors ({previewData.errors.length})
                  </h3>
                  <div className="space-y-3">
                    {previewData.errors.map((err, index) => (
                      <div key={index} className="bg-white rounded-lg p-4 border-l-4 border-red-500">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center space-x-2 mb-2">
                              <Badge variant="destructive" className="font-mono">
                                {err.code}
                              </Badge>
                              <span className="text-sm text-gray-500">Error #{index + 1}</span>
                            </div>
                            <p className="text-red-700 font-medium mb-2">{err.message || err.display}</p>
                            {err.location && (
                              <div className="bg-gray-50 rounded px-3 py-2 mt-2">
                                <p className="text-xs text-gray-600 mb-1">Location in Bundle:</p>
                                <p className="text-sm font-mono text-gray-800">{err.location}</p>
                              </div>
                            )}
                          </div>
                          <XCircle className="h-5 w-5 text-red-500 flex-shrink-0 ml-3" />
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 p-3 bg-amber-50 rounded-lg border border-amber-200">
                    <p className="text-sm text-amber-800">
                      <strong>Tip:</strong> Review the errors above and update your request accordingly. 
                      Common issues include missing required fields, invalid references, or incorrect data formats.
                    </p>
                  </div>
                </div>
              )}

              {/* Entities Summary */}
              <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                <h3 className="font-semibold text-gray-800 mb-3">Request Summary</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                  <div className="bg-white rounded-lg p-3 border">
                    <p className="text-gray-500 text-xs mb-1">Patient</p>
                    <p className="font-medium">{previewData.entities?.patient?.name || 'N/A'}</p>
                    <p className="text-xs text-gray-400 font-mono">{previewData.entities?.patient?.identifier}</p>
                  </div>
                  <div className="bg-white rounded-lg p-3 border">
                    <p className="text-gray-500 text-xs mb-1">Provider</p>
                    <p className="font-medium">{previewData.entities?.provider?.name || 'N/A'}</p>
                    <p className="text-xs text-gray-400 font-mono">{previewData.entities?.provider?.nphiesId}</p>
                  </div>
                  <div className="bg-white rounded-lg p-3 border">
                    <p className="text-gray-500 text-xs mb-1">Insurer</p>
                    <p className="font-medium">{previewData.entities?.insurer?.name || 'N/A'}</p>
                    <p className="text-xs text-gray-400 font-mono">{previewData.entities?.insurer?.nphiesId}</p>
                  </div>
                  <div className="bg-white rounded-lg p-3 border">
                    <p className="text-gray-500 text-xs mb-1">Authorization Type</p>
                    <p className="font-medium capitalize">{previewData.options?.authType || formData.auth_type || 'N/A'}</p>
                    <p className="text-xs text-gray-400">
                      {previewData.options?.itemsCount || formData.items?.length || 0} items
                    </p>
                  </div>
                </div>
                <div className="mt-3 pt-3 border-t border-gray-200 flex flex-wrap gap-2">
                  <Badge className="capitalize bg-primary-purple">
                    {previewData.options?.authType || formData.auth_type || 'professional'}
                  </Badge>
                  <Badge variant="outline" className="capitalize">
                    Priority: {previewData.options?.priority || formData.priority || 'normal'}
                  </Badge>
                  {(previewData.options?.encounterClass || formData.encounter_class) && (
                    <Badge variant="outline" className="capitalize">
                      Encounter: {previewData.options?.encounterClass || formData.encounter_class}
                    </Badge>
                  )}
                  {previewData.preAuthRef && (
                    <Badge variant="secondary" className="font-mono text-xs">
                      Pre-Auth Ref: {previewData.preAuthRef}
                    </Badge>
                  )}
                  {previewData.nphiesResponseId && (
                    <Badge variant="secondary" className="font-mono text-xs">
                      Response ID: {previewData.nphiesResponseId}
                    </Badge>
                  )}
                </div>
              </div>

              {/* Request Bundle JSON - What was/will be sent to NPHIES */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                    <Send className="h-4 w-4 text-blue-500" />
                    Request Bundle (Sent to NPHIES)
                  </h3>
                  <Button variant="outline" size="sm" onClick={() => handleCopyJson('request')}>
                    <Copy className="h-4 w-4 mr-2" />
                    Copy Request
                  </Button>
                </div>
                {(previewData.requestBundle || previewData.fhirBundle) ? (
                  <pre className="bg-gray-900 text-green-400 p-4 rounded-lg overflow-x-auto text-xs max-h-[350px] overflow-y-auto">
                    {JSON.stringify(previewData.requestBundle || previewData.fhirBundle, null, 2)}
                  </pre>
                ) : (
                  <div className="bg-gray-100 p-4 rounded-lg text-gray-500 text-center">
                    No request bundle available
                  </div>
                )}
              </div>

              {/* Response Bundle JSON - Only shown for test send results */}
              {previewData.data && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                      <Shield className="h-4 w-4 text-green-500" />
                      Response Bundle (From NPHIES)
                      {previewData.outcome && (
                        <Badge variant={previewData.outcome === 'error' ? 'destructive' : 'default'} className="ml-2">
                          {previewData.outcome}
                        </Badge>
                      )}
                    </h3>
                    <Button variant="outline" size="sm" onClick={() => handleCopyJson('response')}>
                      <Copy className="h-4 w-4 mr-2" />
                      Copy Response
                    </Button>
                  </div>
                  <pre className="bg-slate-900 text-amber-400 p-4 rounded-lg overflow-x-auto text-xs max-h-[350px] overflow-y-auto">
                    {JSON.stringify(previewData.data, null, 2)}
                  </pre>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between p-6 border-t bg-gray-50">
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => handleCopyJson('request')}>
                  <Copy className="h-4 w-4 mr-2" />
                  Copy Request
                </Button>
                {previewData.data && (
                  <Button variant="outline" size="sm" onClick={() => handleCopyJson('response')}>
                    <Copy className="h-4 w-4 mr-2" />
                    Copy Response
                  </Button>
                )}
              </div>
              <Button onClick={() => setShowPreview(false)}>
                Close Preview
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Drug Interaction Justification Modal */}
      <DrugInteractionJustificationModal
        isOpen={showJustificationModal}
        safetyAnalysis={medicationSafetyAnalysis}
        onSubmit={handleJustificationSubmit}
        onCancel={handleJustificationCancel}
      />
    </div>
  );
}
