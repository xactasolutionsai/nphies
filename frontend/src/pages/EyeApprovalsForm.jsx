import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import api from '@/services/api';
import aiValidationService from '@/services/aiValidationService';
import AIValidationModal from '@/components/AIValidationModal';
import InlineValidationWarning from '@/components/InlineValidationWarning';
import { 
  Save, 
  ArrowLeft, 
  Plus, 
  Trash2, 
  FileText, 
  User, 
  Stethoscope, 
  Calendar,
  ChevronLeft,
  ChevronRight,
  Eye,
  Building2,
  Brain,
  Sparkles
} from 'lucide-react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import Select from 'react-select';
import { format } from 'date-fns';

export default function EyeApprovalsForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditMode = Boolean(id);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('reception');
  const [patients, setPatients] = useState([]);
  const [providers, setProviders] = useState([]);
  const [insurers, setInsurers] = useState([]);
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  
  // AI Validation state
  const [validating, setValidating] = useState(false);
  const [validationResult, setValidationResult] = useState(null);
  const [showValidationModal, setShowValidationModal] = useState(false);
  const [aiWarnings, setAiWarnings] = useState({});
  const [validationBypass, setValidationBypass] = useState(false);

  const [formData, setFormData] = useState({
    // Reception/Nurse Section
    provider_name: 'Vision Care Medical Center', // TEMP: Remove later
    insurance_company_name: 'Bupa Arabia Insurance', // TEMP: Remove later
    tpa_company_name: 'MedNet TPA Services', // TEMP: Remove later
    patient_file_number: 'PF-2024-00789', // TEMP: Remove later
    date_of_visit: format(new Date(), 'yyyy-MM-dd'), // TEMP: Remove later
    plan_type: 'Gold Premium Plan', // TEMP: Remove later
    new_visit: true, // TEMP: Remove later
    follow_up: false,
    
    // Insured Information
    insured_name: 'Ahmed Mohammed Al-Qahtani', // TEMP: Remove later
    id_card_number: '2234567890', // TEMP: Remove later
    sex: 'Male', // TEMP: Remove later
    age: '45', // TEMP: Remove later
    policy_holder: 'Self', // TEMP: Remove later
    policy_number: 'BUPA-POL-123456', // TEMP: Remove later
    expiry_date: format(new Date(2025, 11, 31), 'yyyy-MM-dd'), // TEMP: Remove later
    class: 'A', // TEMP: Remove later
    approval: '', // TEMP: Remove later
    
    // Optician Section
    duration_of_illness_days: '30', // TEMP: Remove later
    chief_complaints: 'Difficulty reading small text, blurred vision at near distance, eyestrain when using computer', // TEMP: Remove later
    significant_signs: 'Patient reports progressive difficulty with near vision over past 6 months. No pain, no redness, no discharge. Vision worse in evening.', // TEMP: Remove later
    
    // Eye Specifications (JSONB fields)
    // TEMP: Remove static data later
    right_eye_specs: {
      distance: { sphere: '-2.00', cylinder: '-0.75', axis: '180', prism: '', vn: '6/6' },
      near: { sphere: '', cylinder: '', axis: '', prism: '', vn: '6/9' },
      bifocal_add: '+2.00',
      vertex_add: '12'
    },
    left_eye_specs: {
      distance: { sphere: '-1.75', cylinder: '-0.50', axis: '175', prism: '', vn: '6/6', pd: '32' },
      near: { sphere: '', cylinder: '', axis: '', prism: '', vn: '6/9' },
      bifocal_add: '+2.00'
    },
    
    // Lens Type
    lens_type: 'plastic', // TEMP: Remove later
    
    // Lens Specifications (JSONB field)
    // TEMP: Remove static data later
    lens_specifications: {
      multi_coated: true,
      varilux: false,
      light: false,
      aspheric: true,
      bifocal: true,
      medium: false,
      lenticular: false,
      single_vision: false,
      dark: false,
      safety_thickness: false,
      anti_reflecting: true,
      photosensitive: false,
      high_index: false,
      colored: false,
      anti_scratch: true
    },
    
    // Contact Lenses
    contact_lenses_permanent: false,
    contact_lenses_disposal: false,
    
    // Frames
    frames_required: true, // TEMP: Remove later
    number_of_pairs: '1', // TEMP: Remove later
    
    // Provider Approval
    completed_coded_by: 'Dr. Sarah Al-Mansoori', // TEMP: Remove later
    provider_signature: 'Dr. S. Al-Mansoori', // TEMP: Remove later
    provider_date: format(new Date(), 'yyyy-MM-dd'), // TEMP: Remove later
    
    // Foreign Keys
    patient_id: '',
    provider_id: '',
    insurer_id: '',
    status: 'Draft'
  });

  // TEMP: Remove static data later
  const [procedures, setProcedures] = useState([
    { code: '92015', service_description: 'Comprehensive Eye Examination with Refraction', type: 'Examination', cost: '350.00' },
    { code: '92310', service_description: 'Prescription of Optical and Physical Characteristics of Contact Lenses', type: 'Consultation', cost: '150.00' }
  ]);

  // Helper functions for date handling
  const parseDate = (dateString) => {
    if (!dateString) return null;
    return new Date(dateString);
  };

  const formatDateForAPI = (date) => {
    if (!date) return '';
    return format(date, 'yyyy-MM-dd');
  };

  const handleDateChange = (field, date) => {
    setFormData(prev => ({ ...prev, [field]: formatDateForAPI(date) }));
    if (errors[field]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const handleSelectChange = (field, selectedOption) => {
    setFormData(prev => ({ ...prev, [field]: selectedOption?.value || '' }));
    if (errors[field]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  // Custom styles for react-select
  const selectStyles = {
    control: (base, state) => ({
      ...base,
      minHeight: '38px',
      borderColor: state.isFocused ? '#553781' : errors[state.selectProps.name] ? '#ef4444' : '#d1d5db',
      boxShadow: 'none',
      outline: 'none',
      '&:hover': {
        borderColor: state.isFocused ? '#553781' : errors[state.selectProps.name] ? '#ef4444' : '#9ca3af'
      }
    }),
    option: (base, { isFocused, isSelected }) => ({
      ...base,
      backgroundColor: isSelected ? '#553781' : isFocused ? '#f3f4f6' : 'white',
      color: isSelected ? 'white' : '#374151',
      '&:hover': {
        backgroundColor: isSelected ? '#553781' : '#f3f4f6'
      }
    }),
    menu: (base) => ({
      ...base,
      marginTop: '4px',
      borderRadius: '0.25rem',
      border: '1px solid #e5e7eb',
      boxShadow: 'none',
      zIndex: 9999
    }),
    menuPortal: (base) => ({ 
      ...base, 
      zIndex: 9999 
    }),
    menuList: (base) => ({
      ...base,
      padding: '4px',
      maxHeight: '200px'
    }),
    input: (base) => ({
      ...base,
      margin: 0,
      padding: 0,
      boxShadow: 'none',
      outline: 'none'
    }),
    valueContainer: (base) => ({
      ...base,
      padding: '0 8px'
    })
  };

  useEffect(() => {
    if (isEditMode) {
      loadForm();
    }
    loadPatients();
    loadProviders();
    loadInsurers();
  }, [id]);

  const loadForm = async () => {
    try {
      setLoading(true);
      const response = await api.getEyeApproval(id);
      const data = response.data || response;
      
      // Parse JSONB fields
      const parsedData = {
        ...data,
        right_eye_specs: typeof data.right_eye_specs === 'string' ? JSON.parse(data.right_eye_specs) : (data.right_eye_specs || formData.right_eye_specs),
        left_eye_specs: typeof data.left_eye_specs === 'string' ? JSON.parse(data.left_eye_specs) : (data.left_eye_specs || formData.left_eye_specs),
        lens_specifications: typeof data.lens_specifications === 'string' ? JSON.parse(data.lens_specifications) : (data.lens_specifications || formData.lens_specifications)
      };
      
      setFormData(parsedData);
      setProcedures(data.procedures && data.procedures.length > 0 ? data.procedures : [{ code: '', service_description: '', type: '', cost: '' }]);
    } catch (error) {
      console.error('Error loading form:', error);
      alert('Error loading form data');
      navigate('/eye-approvals');
    } finally {
      setLoading(false);
    }
  };

  const loadPatients = async () => {
    try {
      const response = await api.getPatients({ limit: 1000 });
      const data = response?.data?.data || response?.data || response || [];
      setPatients(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error loading patients:', error);
      setPatients([]);
    }
  };

  const loadProviders = async () => {
    try {
      const response = await api.getProviders({ limit: 1000 });
      const data = response?.data?.data || response?.data || response || [];
      setProviders(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error loading providers:', error);
      setProviders([]);
    }
  };

  const loadInsurers = async () => {
    try {
      const response = await api.getInsurers({ limit: 1000 });
      const data = response?.data?.data || response?.data || response || [];
      setInsurers(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error loading insurers:', error);
      setInsurers([]);
    }
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const handleEyeSpecChange = (eye, section, field, value) => {
    setFormData(prev => ({
      ...prev,
      [`${eye}_eye_specs`]: {
        ...prev[`${eye}_eye_specs`],
        [section]: typeof prev[`${eye}_eye_specs`][section] === 'object' 
          ? { ...prev[`${eye}_eye_specs`][section], [field]: value }
          : value
      }
    }));
  };

  const handleLensSpecChange = (field) => {
    setFormData(prev => ({
      ...prev,
      lens_specifications: {
        ...prev.lens_specifications,
        [field]: !prev.lens_specifications[field]
      }
    }));
  };

  const handleProcedureChange = (index, field, value) => {
    const newProcedures = [...procedures];
    newProcedures[index][field] = value;
    setProcedures(newProcedures);
  };

  const addProcedure = () => {
    setProcedures([...procedures, { code: '', service_description: '', type: '', cost: '' }]);
  };

  const removeProcedure = (index) => {
    if (procedures.length > 1) {
      setProcedures(procedures.filter((_, i) => i !== index));
    }
  };

  const handleBlur = (field) => {
    setTouched(prev => ({ ...prev, [field]: true }));
    validateField(field);
  };

  const validateField = (field) => {
    let error = '';
    
    // Required fields validation - Administrative + Clinical
    const requiredFields = {
      // Administrative (Insurance/Patient Info)
      provider_name: 'Provider name is required',
      insurance_company_name: 'Insurance company is required',
      insured_name: 'Insured name is required',
      id_card_number: 'ID card number is required',
      date_of_visit: 'Date of visit is required',
      
      // Clinical Data (Essential for AI validation)
      age: 'Age is required for medical assessment',
      chief_complaints: 'Chief complaints are required (reason for visit)',
      duration_of_illness_days: 'Duration of illness is required'
    };

    if (requiredFields[field] && !formData[field]) {
      error = requiredFields[field];
    }

    // Age validation
    if (field === 'age' && formData.age) {
      const ageNum = parseInt(formData.age);
      if (isNaN(ageNum) || ageNum < 0 || ageNum > 150) {
        error = 'Age must be between 0 and 150';
      }
    }

    if (error) {
      setErrors(prev => ({ ...prev, [field]: error }));
    } else {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const validateForm = () => {
    const newErrors = {};
    
    // Administrative Required Fields
    if (!formData.provider_name) newErrors.provider_name = 'Provider name is required';
    if (!formData.insurance_company_name) newErrors.insurance_company_name = 'Insurance company is required';
    if (!formData.insured_name) newErrors.insured_name = 'Insured name is required';
    if (!formData.id_card_number) newErrors.id_card_number = 'ID card number is required';
    if (!formData.date_of_visit) newErrors.date_of_visit = 'Date of visit is required';
    
    // Clinical Required Fields (Essential for AI validation)
    if (!formData.age) {
      newErrors.age = 'Age is required for medical assessment';
    } else {
      const ageNum = parseInt(formData.age);
      if (isNaN(ageNum) || ageNum < 0 || ageNum > 150) {
        newErrors.age = 'Age must be between 0 and 150';
      }
    }
    
    if (!formData.chief_complaints || formData.chief_complaints.trim() === '') {
      newErrors.chief_complaints = 'Chief complaints are required (reason for visit)';
    }
    
    if (!formData.duration_of_illness_days) {
      newErrors.duration_of_illness_days = 'Duration of illness is required';
    }
    
    // At least ONE eye prescription is required
    const hasRightEyePrescription = formData.right_eye_specs?.distance?.sphere || 
                                     formData.right_eye_specs?.distance?.cylinder;
    const hasLeftEyePrescription = formData.left_eye_specs?.distance?.sphere || 
                                    formData.left_eye_specs?.distance?.cylinder;
    
    if (!hasRightEyePrescription && !hasLeftEyePrescription) {
      newErrors.right_eye_specs = 'At least one eye prescription (right or left) is required';
      newErrors.left_eye_specs = 'At least one eye prescription (right or left) is required';
    }
    
    // At least ONE procedure is required
    const hasValidProcedure = procedures.some(proc => proc.code || proc.service_description);
    if (!hasValidProcedure) {
      newErrors.procedures = 'At least one procedure is required';
    }
    
    setErrors(newErrors);
    
    // Mark all required fields as touched
    const touchedFields = {};
    Object.keys(newErrors).forEach(key => {
      touchedFields[key] = true;
    });
    setTouched(prev => ({ ...prev, ...touchedFields }));
    
    return Object.keys(newErrors).length === 0;
  };

  const handleAIValidation = async () => {
    if (!validateForm()) {
      alert('Please fill in all required fields before AI validation');
      return;
    }

    try {
      setValidating(true);
      
      const submitData = {
        ...formData,
        procedures: procedures.filter(proc => proc.code || proc.service_description)
      };

      const response = await aiValidationService.validateForm(submitData, {
        saveToDatabase: isEditMode, // Save to DB when editing existing form
        formId: id || null
      });

      if (response.success && response.data) {
        setValidationResult(response.data);
        setShowValidationModal(true);
        
        // Map warnings to fields for inline display
        const warningsByField = {};
        if (response.data.warnings) {
          response.data.warnings.forEach(warning => {
            if (warning.field && warning.field !== 'general' && warning.field !== 'system') {
              warningsByField[warning.field] = warning;
            }
          });
        }
        setAiWarnings(warningsByField);
      }
    } catch (error) {
      console.error('Error during AI validation:', error);
      alert('AI validation is temporarily unavailable. You can proceed with manual validation.');
    } finally {
      setValidating(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      alert('Please fill in all required fields');
      return;
    }

    // Check if AI validation is enabled and not already validated
    const aiEnabled = aiValidationService.isEnabled();
    if (aiEnabled && !validationBypass && !validationResult) {
      // Trigger AI validation before submitting
      await handleAIValidation();
      return; // Don't proceed yet, wait for user to review validation
    }

    try {
      setSaving(true);
      
      const submitData = {
        ...formData,
        procedures: procedures.filter(proc => proc.code || proc.service_description)
      };

      let savedFormId = id; // For edit mode
      
      if (isEditMode) {
        await api.updateEyeApproval(id, submitData);
        alert('Form updated successfully!');
      } else {
        const response = await api.createEyeApproval(submitData);
        savedFormId = response?.data?.id || response?.id; // Get the new form ID
        alert('Form created successfully!');
      }
      
      // Save AI validation result to database if we have one
      if (validationResult && savedFormId) {
        try {
          console.log(`💾 Attempting to save AI validation for form ID: ${savedFormId}`);
          const saveResponse = await aiValidationService.validateForm(submitData, {
            saveToDatabase: true,
            formId: savedFormId
          });
          console.log('✅ AI validation saved to database:', saveResponse);
        } catch (aiError) {
          console.error('❌ Error saving AI validation to database:', aiError);
          console.error('Error details:', aiError.response?.data || aiError.message);
          // Don't block form submission if AI save fails
        }
      } else {
        console.log('ℹ️ No AI validation to save:', { hasValidationResult: !!validationResult, savedFormId });
      }
      
      navigate('/eye-approvals');
    } catch (error) {
      console.error('Error saving form:', error);
      const errorMessage = error?.response?.data?.error || error?.message || 'Failed to save form';
      alert(`Error: ${errorMessage}`);
    } finally {
      setSaving(false);
    }
  };

  const handleValidationProceed = () => {
    setShowValidationModal(false);
    setValidationBypass(true);
    // Trigger form submission
    const form = document.querySelector('form');
    if (form) {
      form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
    }
  };

  const handleValidationFixIssues = () => {
    setShowValidationModal(false);
    // Stay on form to fix issues
  };

  const dismissAiWarning = (field) => {
    setAiWarnings(prev => {
      const updated = { ...prev };
      delete updated[field];
      return updated;
    });
  };

  const tabs = [
    { id: 'reception', label: 'Reception/Nurse', icon: Building2 },
    { id: 'insured', label: 'Insured Info', icon: User },
    { id: 'optician', label: 'Optician', icon: Eye },
    { id: 'procedures', label: 'Procedures', icon: Stethoscope }
  ];

  // Get which tab each field belongs to
  const getFieldTab = (field) => {
    const receptionFields = ['provider_name', 'insurance_company_name', 'tpa_company_name', 'patient_file_number', 'date_of_visit', 'plan_type', 'new_visit', 'follow_up'];
    const insuredFields = ['insured_name', 'id_card_number', 'sex', 'age', 'policy_holder', 'policy_number', 'expiry_date', 'class', 'approval'];
    const opticianFields = ['duration_of_illness_days', 'chief_complaints', 'significant_signs', 'right_eye_specs', 'left_eye_specs', 'lens_type', 'lens_specifications'];
    const procedureFields = ['procedures'];

    if (receptionFields.includes(field)) return 'reception';
    if (insuredFields.includes(field)) return 'insured';
    if (opticianFields.includes(field)) return 'optician';
    if (procedureFields.includes(field)) return 'procedures';
    return 'procedures';
  };

  // Check if a tab has errors
  const getTabErrors = (tabId) => {
    const errorFields = Object.keys(errors);
    return errorFields.some(field => getFieldTab(field) === tabId);
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            onClick={() => navigate('/eye-approvals')}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              {isEditMode ? 'Edit' : 'New'} Eye Approval Form
            </h1>
            <p className="text-gray-600 mt-1">
              {isEditMode ? 'Update existing form' : 'Create a new eye/optical approval form'}
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-lg border border-gray-200 p-3">
        <div className="flex gap-2">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const hasError = getTabErrors(tab.id);
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-md text-sm font-medium transition-all relative ${
                  activeTab === tab.id
                    ? 'bg-gradient-to-r from-primary-purple to-accent-purple text-white'
                    : hasError
                    ? 'text-red-600 bg-red-50 border-2 border-red-300'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
                {hasError && (
                  <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Reception/Nurse Tab */}
        {activeTab === 'reception' && (
          <Card>
            <CardContent className="pt-6 space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Reception/Nurse Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>Provider Name *</Label>
                    <Input
                      value={formData.provider_name}
                      onChange={(e) => handleInputChange('provider_name', e.target.value)}
                      onBlur={() => handleBlur('provider_name')}
                      placeholder="e.g. Eye Care Center"
                      className={errors.provider_name ? 'border-red-500' : ''}
                    />
                    {errors.provider_name && <p className="text-red-500 text-xs mt-1">{errors.provider_name}</p>}
                    {aiWarnings.provider_name && (
                      <InlineValidationWarning 
                        warning={aiWarnings.provider_name}
                        onDismiss={() => dismissAiWarning('provider_name')}
                      />
                    )}
                  </div>
                  <div>
                    <Label>Insurance Company Name *</Label>
                    <Input
                      value={formData.insurance_company_name}
                      onChange={(e) => handleInputChange('insurance_company_name', e.target.value)}
                      onBlur={() => handleBlur('insurance_company_name')}
                      placeholder="e.g. Bupa Arabia"
                      className={errors.insurance_company_name ? 'border-red-500' : ''}
                    />
                    {errors.insurance_company_name && <p className="text-red-500 text-xs mt-1">{errors.insurance_company_name}</p>}
                  </div>
                  <div>
                    <Label>TPA Company Name</Label>
                    <Input
                      value={formData.tpa_company_name}
                      onChange={(e) => handleInputChange('tpa_company_name', e.target.value)}
                      placeholder="e.g. TPA Services"
                    />
                  </div>
                  <div>
                    <Label>Patient File Number</Label>
                    <Input
                      value={formData.patient_file_number}
                      onChange={(e) => handleInputChange('patient_file_number', e.target.value)}
                      placeholder="e.g. PF-12345"
                    />
                  </div>
                  <div>
                    <Label>Date of Visit *</Label>
                    <div className="relative">
                      <DatePicker
                        selected={parseDate(formData.date_of_visit)}
                        onChange={(date) => handleDateChange('date_of_visit', date)}
                        onBlur={() => handleBlur('date_of_visit')}
                        dateFormat="dd/MM/yyyy"
                        placeholderText="Select date"
                        className={`w-full rounded border ${errors.date_of_visit ? 'border-red-500' : 'border-[#d1d5db]'} bg-background px-3 py-2 pl-10 text-sm`}
                        wrapperClassName="w-full"
                      />
                      <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                    </div>
                    {errors.date_of_visit && <p className="text-red-500 text-xs mt-1">{errors.date_of_visit}</p>}
                  </div>
                  <div>
                    <Label>Plan Type</Label>
                    <Input
                      value={formData.plan_type}
                      onChange={(e) => handleInputChange('plan_type', e.target.value)}
                      placeholder="e.g. Gold Plan"
                    />
                  </div>
                  <div className="col-span-2 flex gap-4">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={formData.new_visit}
                        onChange={(e) => handleInputChange('new_visit', e.target.checked)}
                        className="rounded border-gray-300"
                      />
                      <span className="text-sm">New Visit</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={formData.follow_up}
                        onChange={(e) => handleInputChange('follow_up', e.target.checked)}
                        className="rounded border-gray-300"
                      />
                      <span className="text-sm">Follow Up</span>
                    </label>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Insured Information Tab */}
        {activeTab === 'insured' && (
          <Card>
            <CardContent className="pt-6 space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Insured Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>Insured Name *</Label>
                    <Input
                      value={formData.insured_name}
                      onChange={(e) => handleInputChange('insured_name', e.target.value)}
                      onBlur={() => handleBlur('insured_name')}
                      placeholder="e.g. Ahmed Al-Qahtani"
                      className={errors.insured_name ? 'border-red-500' : ''}
                    />
                    {errors.insured_name && <p className="text-red-500 text-xs mt-1">{errors.insured_name}</p>}
                  </div>
                  <div>
                    <Label>ID Card Number *</Label>
                    <Input
                      value={formData.id_card_number}
                      onChange={(e) => handleInputChange('id_card_number', e.target.value)}
                      onBlur={() => handleBlur('id_card_number')}
                      placeholder="e.g. 1234567890"
                      className={errors.id_card_number ? 'border-red-500' : ''}
                    />
                    {errors.id_card_number && <p className="text-red-500 text-xs mt-1">{errors.id_card_number}</p>}
                  </div>
                  <div>
                    <Label>Sex</Label>
                    <Select
                      value={[{ value: 'Male', label: 'Male' }, { value: 'Female', label: 'Female' }, { value: 'Other', label: 'Other' }].find(opt => opt.value === formData.sex)}
                      onChange={(option) => handleSelectChange('sex', option)}
                      onBlur={() => handleBlur('sex')}
                      options={[{ value: 'Male', label: 'Male' }, { value: 'Female', label: 'Female' }, { value: 'Other', label: 'Other' }]}
                      placeholder="Select sex..."
                      isClearable
                      styles={selectStyles}
                      name="sex"
                      menuPortalTarget={document.body}
                      menuPosition="fixed"
                    />
                  </div>
                  <div>
                    <Label>Age *</Label>
                    <Input
                      type="number"
                      value={formData.age}
                      onChange={(e) => handleInputChange('age', e.target.value)}
                      onBlur={() => handleBlur('age')}
                      placeholder="e.g. 35"
                      className={errors.age ? 'border-red-500' : ''}
                    />
                    {errors.age && <p className="text-red-500 text-xs mt-1">{errors.age}</p>}
                  </div>
                  <div>
                    <Label>Policy Holder</Label>
                    <Input
                      value={formData.policy_holder}
                      onChange={(e) => handleInputChange('policy_holder', e.target.value)}
                      placeholder="e.g. Self"
                    />
                  </div>
                  <div>
                    <Label>Policy Number</Label>
                    <Input
                      value={formData.policy_number}
                      onChange={(e) => handleInputChange('policy_number', e.target.value)}
                      placeholder="e.g. POL-123456"
                    />
                  </div>
                  <div>
                    <Label>Expiry Date</Label>
                    <div className="relative">
                      <DatePicker
                        selected={parseDate(formData.expiry_date)}
                        onChange={(date) => handleDateChange('expiry_date', date)}
                        dateFormat="dd/MM/yyyy"
                        placeholderText="Select date"
                        className="w-full rounded border border-[#d1d5db] bg-background px-3 py-2 pl-10 text-sm"
                        wrapperClassName="w-full"
                      />
                      <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                    </div>
                  </div>
                  <div>
                    <Label>Class</Label>
                    <Input
                      value={formData.class}
                      onChange={(e) => handleInputChange('class', e.target.value)}
                      placeholder="e.g. A"
                    />
                  </div>
                  <div>
                    <Label>Approval</Label>
                    <Input
                      value={formData.approval}
                      onChange={(e) => handleInputChange('approval', e.target.value)}
                      placeholder="e.g. Approved"
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Optician Tab */}
        {activeTab === 'optician' && (
          <div className="space-y-6">
            <Card>
              <CardContent className="pt-6 space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Clinical Information</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label>Duration of Illness (Days) *</Label>
                      <Input
                        type="number"
                        value={formData.duration_of_illness_days}
                        onChange={(e) => handleInputChange('duration_of_illness_days', e.target.value)}
                        onBlur={() => handleBlur('duration_of_illness_days')}
                        placeholder="e.g. 7"
                        className={errors.duration_of_illness_days ? 'border-red-500' : ''}
                      />
                      {errors.duration_of_illness_days && <p className="text-red-500 text-xs mt-1">{errors.duration_of_illness_days}</p>}
                    </div>
                    <div>
                      <Label>Chief Complaints *</Label>
                      <textarea
                        value={formData.chief_complaints}
                        onChange={(e) => handleInputChange('chief_complaints', e.target.value)}
                        onBlur={() => handleBlur('chief_complaints')}
                        className={`w-full rounded-md border ${errors.chief_complaints ? 'border-red-500' : 'border-gray-300'} px-3 py-2`}
                        rows="2"
                        placeholder="e.g. Blurred vision when reading"
                      />
                      {errors.chief_complaints && <p className="text-red-500 text-xs mt-1">{errors.chief_complaints}</p>}
                    </div>
                    <div className="md:col-span-2">
                      <Label>Significant Signs</Label>
                      <textarea
                        value={formData.significant_signs}
                        onChange={(e) => handleInputChange('significant_signs', e.target.value)}
                        className="w-full rounded-md border border-gray-300 px-3 py-2"
                        rows="2"
                        placeholder="e.g. Patient experiencing double vision"
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Right Eye Specifications */}
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">Right Eye Specifications</h3>
                  {errors.right_eye_specs && (
                    <p className="text-red-500 text-sm">* At least one eye prescription required</p>
                  )}
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse border border-gray-300">
                    <thead>
                      <tr className="bg-gray-50">
                        <th className="border border-gray-300 px-4 py-2 text-left"></th>
                        <th className="border border-gray-300 px-4 py-2">Sphere</th>
                        <th className="border border-gray-300 px-4 py-2">Cylinder</th>
                        <th className="border border-gray-300 px-4 py-2">Axis</th>
                        <th className="border border-gray-300 px-4 py-2">Prism</th>
                        <th className="border border-gray-300 px-4 py-2">V/N</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className="border border-gray-300 px-4 py-2 font-medium">Distance</td>
                        <td className="border border-gray-300 px-2 py-2">
                          <Input
                            value={formData.right_eye_specs.distance.sphere}
                            onChange={(e) => handleEyeSpecChange('right', 'distance', 'sphere', e.target.value)}
                            className="w-full"
                          />
                        </td>
                        <td className="border border-gray-300 px-2 py-2">
                          <Input
                            value={formData.right_eye_specs.distance.cylinder}
                            onChange={(e) => handleEyeSpecChange('right', 'distance', 'cylinder', e.target.value)}
                            className="w-full"
                          />
                        </td>
                        <td className="border border-gray-300 px-2 py-2">
                          <Input
                            value={formData.right_eye_specs.distance.axis}
                            onChange={(e) => handleEyeSpecChange('right', 'distance', 'axis', e.target.value)}
                            className="w-full"
                          />
                        </td>
                        <td className="border border-gray-300 px-2 py-2">
                          <Input
                            value={formData.right_eye_specs.distance.prism}
                            onChange={(e) => handleEyeSpecChange('right', 'distance', 'prism', e.target.value)}
                            className="w-full"
                          />
                        </td>
                        <td className="border border-gray-300 px-2 py-2">
                          <Input
                            value={formData.right_eye_specs.distance.vn}
                            onChange={(e) => handleEyeSpecChange('right', 'distance', 'vn', e.target.value)}
                            className="w-full"
                          />
                        </td>
                      </tr>
                      <tr>
                        <td className="border border-gray-300 px-4 py-2 font-medium">Near</td>
                        <td className="border border-gray-300 px-2 py-2">
                          <Input
                            value={formData.right_eye_specs.near.sphere}
                            onChange={(e) => handleEyeSpecChange('right', 'near', 'sphere', e.target.value)}
                            className="w-full"
                          />
                        </td>
                        <td className="border border-gray-300 px-2 py-2">
                          <Input
                            value={formData.right_eye_specs.near.cylinder}
                            onChange={(e) => handleEyeSpecChange('right', 'near', 'cylinder', e.target.value)}
                            className="w-full"
                          />
                        </td>
                        <td className="border border-gray-300 px-2 py-2">
                          <Input
                            value={formData.right_eye_specs.near.axis}
                            onChange={(e) => handleEyeSpecChange('right', 'near', 'axis', e.target.value)}
                            className="w-full"
                          />
                        </td>
                        <td className="border border-gray-300 px-2 py-2">
                          <Input
                            value={formData.right_eye_specs.near.prism}
                            onChange={(e) => handleEyeSpecChange('right', 'near', 'prism', e.target.value)}
                            className="w-full"
                          />
                        </td>
                        <td className="border border-gray-300 px-2 py-2">
                          <Input
                            value={formData.right_eye_specs.near.vn}
                            onChange={(e) => handleEyeSpecChange('right', 'near', 'vn', e.target.value)}
                            className="w-full"
                          />
                        </td>
                      </tr>
                      <tr>
                        <td className="border border-gray-300 px-4 py-2 font-medium">Bifocal</td>
                        <td colSpan="2" className="border border-gray-300 px-2 py-2">
                          <Label className="text-xs">Add</Label>
                          <Input
                            value={formData.right_eye_specs.bifocal_add}
                            onChange={(e) => handleEyeSpecChange('right', 'bifocal_add', '', e.target.value)}
                            className="w-full"
                          />
                        </td>
                        <td colSpan="3" className="border border-gray-300 px-2 py-2">
                          <Label className="text-xs">Vertex</Label>
                          <Input
                            value={formData.right_eye_specs.vertex_add}
                            onChange={(e) => handleEyeSpecChange('right', 'vertex_add', '', e.target.value)}
                            className="w-full"
                          />
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            {/* Left Eye Specifications */}
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">Left Eye Specifications</h3>
                  {errors.left_eye_specs && (
                    <p className="text-red-500 text-sm">* At least one eye prescription required</p>
                  )}
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse border border-gray-300">
                    <thead>
                      <tr className="bg-gray-50">
                        <th className="border border-gray-300 px-4 py-2 text-left"></th>
                        <th className="border border-gray-300 px-4 py-2">Sphere</th>
                        <th className="border border-gray-300 px-4 py-2">Cylinder</th>
                        <th className="border border-gray-300 px-4 py-2">Axis</th>
                        <th className="border border-gray-300 px-4 py-2">Prism</th>
                        <th className="border border-gray-300 px-4 py-2">V/N</th>
                        <th className="border border-gray-300 px-4 py-2">PD</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className="border border-gray-300 px-4 py-2 font-medium">Distance</td>
                        <td className="border border-gray-300 px-2 py-2">
                          <Input
                            value={formData.left_eye_specs.distance.sphere}
                            onChange={(e) => handleEyeSpecChange('left', 'distance', 'sphere', e.target.value)}
                            className="w-full"
                          />
                        </td>
                        <td className="border border-gray-300 px-2 py-2">
                          <Input
                            value={formData.left_eye_specs.distance.cylinder}
                            onChange={(e) => handleEyeSpecChange('left', 'distance', 'cylinder', e.target.value)}
                            className="w-full"
                          />
                        </td>
                        <td className="border border-gray-300 px-2 py-2">
                          <Input
                            value={formData.left_eye_specs.distance.axis}
                            onChange={(e) => handleEyeSpecChange('left', 'distance', 'axis', e.target.value)}
                            className="w-full"
                          />
                        </td>
                        <td className="border border-gray-300 px-2 py-2">
                          <Input
                            value={formData.left_eye_specs.distance.prism}
                            onChange={(e) => handleEyeSpecChange('left', 'distance', 'prism', e.target.value)}
                            className="w-full"
                          />
                        </td>
                        <td className="border border-gray-300 px-2 py-2">
                          <Input
                            value={formData.left_eye_specs.distance.vn}
                            onChange={(e) => handleEyeSpecChange('left', 'distance', 'vn', e.target.value)}
                            className="w-full"
                          />
                        </td>
                        <td className="border border-gray-300 px-2 py-2">
                          <Input
                            value={formData.left_eye_specs.distance.pd}
                            onChange={(e) => handleEyeSpecChange('left', 'distance', 'pd', e.target.value)}
                            className="w-full"
                          />
                        </td>
                      </tr>
                      <tr>
                        <td className="border border-gray-300 px-4 py-2 font-medium">Near</td>
                        <td className="border border-gray-300 px-2 py-2">
                          <Input
                            value={formData.left_eye_specs.near.sphere}
                            onChange={(e) => handleEyeSpecChange('left', 'near', 'sphere', e.target.value)}
                            className="w-full"
                          />
                        </td>
                        <td className="border border-gray-300 px-2 py-2">
                          <Input
                            value={formData.left_eye_specs.near.cylinder}
                            onChange={(e) => handleEyeSpecChange('left', 'near', 'cylinder', e.target.value)}
                            className="w-full"
                          />
                        </td>
                        <td className="border border-gray-300 px-2 py-2">
                          <Input
                            value={formData.left_eye_specs.near.axis}
                            onChange={(e) => handleEyeSpecChange('left', 'near', 'axis', e.target.value)}
                            className="w-full"
                          />
                        </td>
                        <td className="border border-gray-300 px-2 py-2">
                          <Input
                            value={formData.left_eye_specs.near.prism}
                            onChange={(e) => handleEyeSpecChange('left', 'near', 'prism', e.target.value)}
                            className="w-full"
                          />
                        </td>
                        <td className="border border-gray-300 px-2 py-2">
                          <Input
                            value={formData.left_eye_specs.near.vn}
                            onChange={(e) => handleEyeSpecChange('left', 'near', 'vn', e.target.value)}
                            className="w-full"
                          />
                        </td>
                        <td className="border border-gray-300 px-2 py-2"></td>
                      </tr>
                      <tr>
                        <td className="border border-gray-300 px-4 py-2 font-medium">Bifocal</td>
                        <td colSpan="6" className="border border-gray-300 px-2 py-2">
                          <Label className="text-xs">Add</Label>
                          <Input
                            value={formData.left_eye_specs.bifocal_add}
                            onChange={(e) => handleEyeSpecChange('left', 'bifocal_add', '', e.target.value)}
                            className="w-full"
                          />
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            {/* Lens Type and Specifications */}
            <Card>
              <CardContent className="pt-6 space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Regular Lenses Type</h3>
                  <div className="flex gap-6">
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="lens_type"
                        value="glass"
                        checked={formData.lens_type === 'glass'}
                        onChange={(e) => handleInputChange('lens_type', e.target.value)}
                        className="border-gray-300"
                      />
                      <span>Glass</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="lens_type"
                        value="plastic"
                        checked={formData.lens_type === 'plastic'}
                        onChange={(e) => handleInputChange('lens_type', e.target.value)}
                        className="border-gray-300"
                      />
                      <span>Plastic</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="lens_type"
                        value="none"
                        checked={formData.lens_type === 'none'}
                        onChange={(e) => handleInputChange('lens_type', e.target.value)}
                        className="border-gray-300"
                      />
                      <span>None</span>
                    </label>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Lenses Specification</h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {Object.keys(formData.lens_specifications).map((key) => (
                      <label key={key} className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={formData.lens_specifications[key]}
                          onChange={() => handleLensSpecChange(key)}
                          className="rounded border-gray-300"
                        />
                        <span className="text-sm capitalize">{key.replace(/_/g, ' ')}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Contact Lenses Type</h3>
                  <div className="flex gap-6">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={formData.contact_lenses_permanent}
                        onChange={(e) => handleInputChange('contact_lenses_permanent', e.target.checked)}
                        className="rounded border-gray-300"
                      />
                      <span>Permanent</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={formData.contact_lenses_disposal}
                        onChange={(e) => handleInputChange('contact_lenses_disposal', e.target.checked)}
                        className="rounded border-gray-300"
                      />
                      <span>Disposal</span>
                    </label>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Frames</h3>
                  <div className="flex gap-6 items-center">
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="frames_required"
                        value="yes"
                        checked={formData.frames_required === true}
                        onChange={() => handleInputChange('frames_required', true)}
                        className="border-gray-300"
                      />
                      <span>Yes</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="frames_required"
                        value="no"
                        checked={formData.frames_required === false}
                        onChange={() => handleInputChange('frames_required', false)}
                        className="border-gray-300"
                      />
                      <span>No</span>
                    </label>
                    {formData.frames_required && (
                      <div className="flex items-center gap-2">
                        <Label className="whitespace-nowrap">Number of pairs:</Label>
                        <Input
                          type="number"
                          value={formData.number_of_pairs}
                          onChange={(e) => handleInputChange('number_of_pairs', e.target.value)}
                          className="w-24"
                          placeholder="0"
                        />
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Provider Approval */}
            <Card>
              <CardContent className="pt-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Provider Approval</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label>Completed/Coded By</Label>
                    <Input
                      value={formData.completed_coded_by}
                      onChange={(e) => handleInputChange('completed_coded_by', e.target.value)}
                      placeholder="e.g. John Doe"
                    />
                  </div>
                  <div>
                    <Label>Provider Signature</Label>
                    <Input
                      value={formData.provider_signature}
                      onChange={(e) => handleInputChange('provider_signature', e.target.value)}
                      placeholder="Signature"
                    />
                  </div>
                  <div>
                    <Label>Date</Label>
                    <DatePicker
                      selected={parseDate(formData.provider_date)}
                      onChange={(date) => handleDateChange('provider_date', date)}
                      dateFormat="yyyy-MM-dd"
                      className="w-full rounded-md border border-gray-300 px-3 py-2"
                      placeholderText="Select date"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Procedures Tab */}
        {activeTab === 'procedures' && (
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Procedures</h3>
                  {errors.procedures && (
                    <p className="text-red-500 text-sm">* At least one procedure is required</p>
                  )}
                </div>
                <Button type="button" onClick={addProcedure} size="sm" variant="outline">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Procedure
                </Button>
              </div>
              <div className="space-y-4">
                {procedures.map((procedure, index) => (
                  <div key={index} className="grid grid-cols-1 md:grid-cols-5 gap-4 p-4 border border-gray-200 rounded-lg">
                    <div>
                      <Label>Code</Label>
                      <Input
                        value={procedure.code}
                        onChange={(e) => handleProcedureChange(index, 'code', e.target.value)}
                        placeholder="e.g. 3320"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <Label>Service Description</Label>
                      <Input
                        value={procedure.service_description}
                        onChange={(e) => handleProcedureChange(index, 'service_description', e.target.value)}
                        placeholder="e.g. Eye examination"
                      />
                    </div>
                    <div>
                      <Label>Type</Label>
                      <Input
                        value={procedure.type}
                        onChange={(e) => handleProcedureChange(index, 'type', e.target.value)}
                        placeholder="e.g. Exam"
                      />
                    </div>
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <Label>Cost</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={procedure.cost}
                          onChange={(e) => handleProcedureChange(index, 'cost', e.target.value)}
                          placeholder="0.00"
                        />
                      </div>
                      {procedures.length > 1 && (
                        <div className="flex items-end">
                          <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            onClick={() => removeProcedure(index)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Form Actions */}
        <div className="flex items-center justify-between">
          <div className="flex gap-2">
            {activeTab !== 'reception' && (
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  const currentIndex = tabs.findIndex(t => t.id === activeTab);
                  if (currentIndex > 0) {
                    setActiveTab(tabs[currentIndex - 1].id);
                  }
                }}
              >
                <ChevronLeft className="h-4 w-4 mr-2" />
                Previous
              </Button>
            )}
            {activeTab !== 'procedures' && (
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  const currentIndex = tabs.findIndex(t => t.id === activeTab);
                  if (currentIndex < tabs.length - 1) {
                    setActiveTab(tabs[currentIndex + 1].id);
                  }
                }}
              >
                Next
                <ChevronRight className="h-4 w-4 ml-2" />
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate('/eye-approvals')}
            >
              Cancel
            </Button>
            {aiValidationService.isEnabled() && (
              <Button
                type="button"
                variant="outline"
                onClick={handleAIValidation}
                disabled={validating}
                className="border-purple-500 text-purple-600 hover:bg-purple-50"
              >
                {validating ? (
                  <>
                    <Sparkles className="h-4 w-4 mr-2 animate-spin" />
                    Validating...
                  </>
                ) : (
                  <>
                    <Brain className="h-4 w-4 mr-2" />
                    AI Validate
                  </>
                )}
              </Button>
            )}
            <Button
              type="submit"
              disabled={saving || validating}
              className="bg-gradient-to-r from-primary-purple to-accent-purple"
            >
              {saving ? (
                <>Saving...</>
              ) : validating ? (
                <>Validating...</>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  {isEditMode ? 'Update' : 'Save'} Form
                </>
              )}
            </Button>
          </div>
        </div>
      </form>

      {/* AI Validation Modal */}
      <AIValidationModal
        isOpen={showValidationModal}
        onClose={() => setShowValidationModal(false)}
        validationResult={validationResult}
        onProceed={handleValidationProceed}
        onFixIssues={handleValidationFixIssues}
      />
    </div>
  );
}

