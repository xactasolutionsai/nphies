import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import DatePicker from 'react-datepicker';
import Select from 'react-select';
import 'react-datepicker/dist/react-datepicker.css';
import api from '@/services/api';
import { 
  Save, Send, ArrowLeft, Plus, Trash2, FileText, User, Building, 
  Shield, Stethoscope, Activity, Receipt, Paperclip, Eye, Pill,
  Calendar, DollarSign, AlertCircle, CheckCircle, XCircle, Copy, CreditCard
} from 'lucide-react';

// Import extracted modules
import {
  AUTH_TYPE_OPTIONS,
  PRIORITY_OPTIONS,
  ENCOUNTER_CLASS_OPTIONS,
  ALLOWED_ENCOUNTER_CLASSES,
  getEncounterClassOptions,
  CURRENCY_OPTIONS,
  DIAGNOSIS_TYPE_OPTIONS,
  DENTAL_ICD10_OPTIONS,
  VISION_ICD10_OPTIONS,
  EYE_OPTIONS,
  BODY_SITE_OPTIONS_BY_AUTH_TYPE,
  FDI_TOOTH_OPTIONS,
  TOOTH_SURFACE_OPTIONS,
  SUPPORTING_INFO_CATEGORY_OPTIONS,
  VITAL_SIGNS_FIELDS,
  CLINICAL_TEXT_FIELDS,
  ADMISSION_FIELDS,
  INVESTIGATION_RESULT_OPTIONS
} from '@/components/prior-auth/constants';
import { datePickerStyles, selectStyles } from '@/components/prior-auth/styles';
import {
  formatAmount,
  getInitialItemData,
  getInitialDiagnosisData,
  getInitialSupportingInfoData
} from '@/components/prior-auth/helpers';
import { TabButton } from '@/components/prior-auth';

export default function PriorAuthorizationForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditMode = !!id;

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [testSending, setTestSending] = useState(false);
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

  // Form data
  const [formData, setFormData] = useState({
    auth_type: 'professional',
    status: 'draft',
    priority: 'normal',
    currency: 'SAR',
    encounter_class: 'ambulatory',
    patient_id: '',
    provider_id: '',
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
      chief_complaint_code: '',
      chief_complaint_display: '',
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
        chief_complaint_code: '', chief_complaint_display: '',
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
        
        // Chief complaint
        if (info.category === 'chief-complaint' && info.code) {
          clinicalInfo.chief_complaint_code = info.code;
          clinicalInfo.chief_complaint_display = info.code_display || '';
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
      items: [...prev.items, getInitialItemData(prev.items.length + 1)]
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

    // Add chief complaint if provided
    if (formData.clinical_info.chief_complaint_code) {
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
    
    const invalidItems = formData.items.filter(item => !item.product_or_service_code);
    if (invalidItems.length > 0) validationErrors.push({ field: 'items', message: 'All items must have a service code' });
    
    return { valid: validationErrors.length === 0, errors: validationErrors };
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setErrors([]);

      const validation = validateForm();
      if (!validation.valid) {
        setErrors(validation.errors);
        alert('Please fix the validation errors before saving.');
        return;
      }

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

  const handleSaveAndSend = async () => {
    try {
      setSending(true);
      setErrors([]);

      const validation = validateForm();
      if (!validation.valid) {
        setErrors(validation.errors);
        alert('Please fix the validation errors before sending.');
        return;
      }

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

  // Test send to NPHIES (validates without saving to DB)
  const handleTestSend = async () => {
    try {
      setTestSending(true);
      setErrors([]);

      const validation = validateForm();
      if (!validation.valid) {
        setErrors(validation.errors);
        alert('Please fix the validation errors before testing.');
        return;
      }

      // Merge structured vital signs and clinical data into supporting_info
      const dataToTest = {
        ...formData,
        supporting_info: buildSupportingInfoArray()
      };
      // Remove structured fields (already merged into supporting_info or handled separately)
      delete dataToTest.vital_signs;
      delete dataToTest.clinical_info;
      delete dataToTest.admission_info;
      // Keep vision_prescription for vision auth types - needed for VisionPrescription FHIR resource
      if (dataToTest.auth_type !== 'vision') {
        delete dataToTest.vision_prescription;
      }
      
      // Dental claims use AMB encounter class - don't send end date
      // Dental/Vision claims use AMB encounter class - don't send end date
      // Per NPHIES Encounter-10123 example: AMB encounters have no end date
      // NPHIES Rules: Dental and Vision must use 'ambulatory'
      if (dataToTest.auth_type === 'dental' || dataToTest.auth_type === 'vision') {
        delete dataToTest.encounter_end;
        dataToTest.encounter_class = 'ambulatory';
      }

      const response = await api.testSendPriorAuthorization(dataToTest);
      setPreviewData(response);
      setShowPreview(true);
    } catch (error) {
      console.error('Error testing NPHIES send:', error);
      const errorMsg = error.response?.data?.error || error.message;
      setPreviewData({
        success: false,
        outcome: 'error',
        errors: [{
          code: 'REQUEST_ERROR',
          message: errorMsg
        }],
        entities: {
          patient: { name: patients.find(p => p.patient_id === formData.patient_id)?.name || 'N/A' },
          provider: { name: providers.find(p => p.provider_id === formData.provider_id)?.provider_name || 'N/A' },
          insurer: { name: insurers.find(i => i.insurer_id === formData.insurer_id)?.insurer_name || 'N/A' }
        }
      });
      setShowPreview(true);
    } finally {
      setTestSending(false);
    }
  };

  const handleCopyJson = () => {
    const bundleData = previewData?.data || previewData?.fhirBundle;
    if (bundleData) {
      navigator.clipboard.writeText(JSON.stringify(bundleData, null, 2));
      alert('FHIR Bundle copied to clipboard!');
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
            disabled={previewLoading || testSending || saving || sending}
          >
            <Eye className="h-4 w-4 mr-2" />
            {previewLoading ? 'Building...' : 'Preview JSON'}
          </Button>
          <Button 
            variant="outline"
            onClick={handleTestSend} 
            disabled={testSending || previewLoading || saving || sending}
            className="border-amber-500 text-amber-600 hover:bg-amber-50"
          >
            <Shield className="h-4 w-4 mr-2" />
            {testSending ? 'Testing...' : 'Test with NPHIES'}
          </Button>
          <Button onClick={handleSave} disabled={saving || sending || previewLoading || testSending}>
            <Save className="h-4 w-4 mr-2" />
            {saving ? 'Saving...' : 'Save Draft'}
          </Button>
          <Button 
            onClick={handleSaveAndSend} 
            disabled={saving || sending || previewLoading || testSending}
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
                    
                    // Get allowed encounter classes for the new auth type
                    const allowed = ALLOWED_ENCOUNTER_CLASSES[newAuthType] || ALLOWED_ENCOUNTER_CLASSES.professional;
                    const currentClass = formData.encounter_class;
                    
                    // Auto-update encounter class if current selection is not allowed for new auth type
                    // NPHIES Rules:
                    // - Dental/Vision: Must use 'ambulatory' (AMB)
                    // - Outpatient: Only for 'dental' or 'professional'
                    // - Inpatient/Daycase: Only for 'institutional'
                    if (!allowed.includes(currentClass)) {
                      // Default to first allowed option (usually 'ambulatory')
                      handleChange('encounter_class', allowed[0]);
                      // Clear end date for ambulatory encounters
                      if (allowed[0] === 'ambulatory') {
                        handleChange('encounter_end', '');
                      }
                    }
                    
                    // Clear end date for dental/vision (AMB encounters don't need end date)
                    if (newAuthType === 'dental' || newAuthType === 'vision') {
                      handleChange('encounter_end', '');
                    }
                  }}
                  options={AUTH_TYPE_OPTIONS}
                  styles={selectStyles}
                  menuPortalTarget={document.body}
                />
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
            </div>

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

            <hr className="border-gray-200" />

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="total_amount">Total Amount</Label>
                <div className="flex gap-2">
                  <Input
                    id="total_amount"
                    type="number"
                    step="0.01"
                    value={formData.total_amount}
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
              <div className="space-y-2">
                <Label htmlFor="eligibility_ref">Eligibility Reference</Label>
                <Input
                  id="eligibility_ref"
                  value={formData.eligibility_ref || ''}
                  onChange={(e) => handleChange('eligibility_ref', e.target.value)}
                  placeholder="Optional eligibility reference"
                />
              </div>
            </div>
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
                    {(formData.auth_type === 'dental' || formData.auth_type === 'vision') ? (
                      <Select
                        value={(formData.auth_type === 'dental' ? DENTAL_ICD10_OPTIONS : VISION_ICD10_OPTIONS).find(opt => opt.value === diagnosis.diagnosis_code)}
                        onChange={(option) => {
                          handleDiagnosisChange(index, 'diagnosis_code', option?.value || '');
                          handleDiagnosisChange(index, 'diagnosis_display', option?.label?.split(' - ')[1] || '');
                        }}
                        options={formData.auth_type === 'dental' ? DENTAL_ICD10_OPTIONS : VISION_ICD10_OPTIONS}
                        styles={selectStyles}
                        placeholder={formData.auth_type === 'dental' ? "Select dental diagnosis..." : "Select vision diagnosis..."}
                        isClearable
                        isSearchable
                        menuPortalTarget={document.body}
                      />
                    ) : (
                      <Input
                        value={diagnosis.diagnosis_code}
                        onChange={(e) => handleDiagnosisChange(index, 'diagnosis_code', e.target.value)}
                        placeholder="e.g., J06.9"
                      />
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label>Description</Label>
                    <Input
                      value={diagnosis.diagnosis_display || ''}
                      onChange={(e) => handleDiagnosisChange(index, 'diagnosis_display', e.target.value)}
                      placeholder="Diagnosis description"
                      disabled={formData.auth_type === 'dental' || formData.auth_type === 'vision'}
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
                <div className="flex items-center gap-2">
                  <Label className="text-sm text-gray-500">Measurement Time:</Label>
                  <div className="datepicker-wrapper w-52">
                    <DatePicker
                      selected={formData.vital_signs.measurement_time ? new Date(formData.vital_signs.measurement_time) : null}
                      onChange={(date) => handleVitalSignChange('measurement_time', date ? date.toISOString() : null)}
                      showTimeSelect
                      dateFormat="yyyy-MM-dd HH:mm"
                      className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-purple/30"
                      placeholderText="Select time"
                    />
                    <Calendar className="datepicker-icon h-4 w-4" />
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
                        value={formData.vital_signs[field.key]}
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
              {/* Chief Complaint Row */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="chief_complaint_code">Chief Complaint Code (SNOMED)</Label>
                  <Input
                    id="chief_complaint_code"
                    value={formData.clinical_info.chief_complaint_code}
                    onChange={(e) => handleClinicalInfoChange('chief_complaint_code', e.target.value)}
                    placeholder="e.g., 21522001"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="chief_complaint_display">Chief Complaint Description</Label>
                  <Input
                    id="chief_complaint_display"
                    value={formData.clinical_info.chief_complaint_display}
                    onChange={(e) => handleClinicalInfoChange('chief_complaint_display', e.target.value)}
                    placeholder="e.g., Abdominal pain"
                  />
                </div>
              </div>

              {/* Clinical Text Fields */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {CLINICAL_TEXT_FIELDS.map((field) => (
                  <div key={field.key} className="space-y-2">
                    <Label htmlFor={field.key}>{field.label}</Label>
                    <textarea
                      id={field.key}
                      value={formData.clinical_info[field.key]}
                      onChange={(e) => handleClinicalInfoChange(field.key, e.target.value)}
                      placeholder={field.placeholder}
                      rows={3}
                      className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-purple/30 resize-none"
                    />
                    <p className="text-xs text-gray-400 text-right">
                      {formData.clinical_info[field.key]?.length || 0} characters
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
                          value={formData.admission_info[field.key]}
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

          {/* Summary of what will be submitted */}
          <Card className="bg-gradient-to-r from-purple-50 to-blue-50 border-purple-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                Data Summary
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
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
                    {formData.clinical_info.chief_complaint_code ? 'Set' : 'Not set'}
                  </p>
                </div>
                <div className="bg-white rounded-lg p-2 border">
                  <p className="text-gray-500 text-xs">Investigation Result</p>
                  <p className="font-medium">
                    {formData.clinical_info.investigation_result || 'Not set'}
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
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Service/Procedure Code *</Label>
                    <Input
                      value={item.product_or_service_code}
                      onChange={(e) => handleItemChange(index, 'product_or_service_code', e.target.value)}
                      placeholder="CPT/SNOMED code"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Description</Label>
                    <Input
                      value={item.product_or_service_display || ''}
                      onChange={(e) => handleItemChange(index, 'product_or_service_display', e.target.value)}
                      placeholder="Service description"
                    />
                  </div>
                </div>

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

                {/* Type-specific fields */}
                {formData.auth_type === 'dental' && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Dental Procedure Code (oral-health-op)</Label>
                        <Input
                          value={item.product_or_service_code || ''}
                          onChange={(e) => {
                            handleItemChange(index, 'product_or_service_code', e.target.value);
                            handleItemChange(index, 'product_or_service_system', 'http://nphies.sa/terminology/CodeSystem/oral-health-op');
                          }}
                          placeholder="e.g. 97613-07-00"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Procedure Description</Label>
                        <Input
                          value={item.product_or_service_display || ''}
                          onChange={(e) => handleItemChange(index, 'product_or_service_display', e.target.value)}
                          placeholder="e.g. Lithium disilicate ceramic crown"
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

                {formData.auth_type === 'vision' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Eye</Label>
                      <Select
                        value={EYE_OPTIONS.find(opt => opt.value === item.eye)}
                        onChange={(option) => handleItemChange(index, 'eye', option?.value || '')}
                        options={EYE_OPTIONS}
                        styles={selectStyles}
                        placeholder="Select eye..."
                        isClearable
                        menuPortalTarget={document.body}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Body Site</Label>
                      <Select
                        value={BODY_SITE_OPTIONS_BY_AUTH_TYPE.vision?.find(opt => opt.value === item.body_site_code)}
                        onChange={(option) => handleItemChange(index, 'body_site_code', option?.value || '')}
                        options={BODY_SITE_OPTIONS_BY_AUTH_TYPE.vision || []}
                        styles={selectStyles}
                        placeholder="Select body site..."
                        isClearable
                        menuPortalTarget={document.body}
                      />
                    </div>
                  </div>
                )}

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
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Medication Code</Label>
                      <Input
                        value={item.medication_code || ''}
                        onChange={(e) => handleItemChange(index, 'medication_code', e.target.value)}
                        placeholder="NPHIES medication code"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Days Supply</Label>
                      <Input
                        type="number"
                        value={item.days_supply || ''}
                        onChange={(e) => handleItemChange(index, 'days_supply', e.target.value)}
                        placeholder="Required for pharmacy"
                      />
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
              formData.supporting_info.map((info, index) => (
                <div key={index} className="flex items-start gap-4 p-4 border rounded-lg bg-gray-50">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-accent-cyan text-white flex items-center justify-center text-sm font-medium">
                    {info.sequence}
                  </div>
                  <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label>Category</Label>
                      <Select
                        value={SUPPORTING_INFO_CATEGORY_OPTIONS.find(opt => opt.value === info.category)}
                        onChange={(option) => handleSupportingInfoChange(index, 'category', option?.value || 'info')}
                        options={SUPPORTING_INFO_CATEGORY_OPTIONS}
                        styles={selectStyles}
                        menuPortalTarget={document.body}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Code</Label>
                      <Input
                        value={info.code || ''}
                        onChange={(e) => handleSupportingInfoChange(index, 'code', e.target.value)}
                        placeholder="Code"
                      />
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
              ))
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
                    <p className="font-medium capitalize">{previewData.entities?.authType || formData.auth_type || 'N/A'}</p>
                    <p className="text-xs text-gray-400">
                      {previewData.entities?.itemsCount || formData.items?.length || 0} items
                    </p>
                  </div>
                </div>
                <div className="mt-3 pt-3 border-t border-gray-200 flex flex-wrap gap-2">
                  <Badge variant="outline" className="capitalize">
                    Priority: {formData.priority || 'normal'}
                  </Badge>
                  {formData.encounter_class && (
                    <Badge variant="outline" className="capitalize">
                      Encounter: {formData.encounter_class}
                    </Badge>
                  )}
                  {previewData.nphiesResponseId && (
                    <Badge variant="secondary" className="font-mono text-xs">
                      Response ID: {previewData.nphiesResponseId}
                    </Badge>
                  )}
                </div>
              </div>

              {/* FHIR Bundle JSON */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    FHIR Bundle (JSON)
                  </h3>
                  <Button variant="outline" size="sm" onClick={handleCopyJson}>
                    <Copy className="h-4 w-4 mr-2" />
                    Copy JSON
                  </Button>
                </div>
                <pre className="bg-gray-900 text-green-400 p-4 rounded-lg overflow-x-auto text-xs max-h-[400px] overflow-y-auto">
                  {JSON.stringify(previewData.data || previewData.fhirBundle, null, 2)}
                </pre>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-3 p-6 border-t bg-gray-50">
              <Button variant="outline" onClick={handleCopyJson}>
                <Copy className="h-4 w-4 mr-2" />
                Copy to Clipboard
              </Button>
              <Button onClick={() => setShowPreview(false)}>
                Close Preview
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
