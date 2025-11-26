import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import api from '@/services/api';
import { Save, ArrowLeft, Plus, Trash2, FileText, User, Stethoscope, Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import Select from 'react-select';
import { format } from 'date-fns';
import './StandardApprovalsForm.css';

export default function StandardApprovalsForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = !!id;
  
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('basic');
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [formData, setFormData] = useState({
    provider_name: '',
    insurance_company_name: '',
    tpa_company_name: '',
    patient_file_number: '',
    department: '',
    marital_status: '',
    plan_type: '',
    date_of_visit: '',
    visit_type: '',
    insured_name: '',
    id_card_number: '',
    sex: '',
    age: '',
    policy_holder: '',
    policy_number: '',
    expiry_date: '',
    approval_field: '',
    patient_type: '',
    emergency_case: false,
    emergency_care_level: '',
    bp: '',
    pulse: '',
    temp: '',
    weight: '',
    height: '',
    respiratory_rate: '',
    duration_of_illness_days: '',
    chief_complaints: '',
    significant_signs: '',
    other_conditions: '',
    diagnosis: '',
    principal_code: '',
    second_code: '',
    third_code: '',
    fourth_code: '',
    chronic: false,
    congenital: false,
    rta: false,
    work_related: false,
    vaccination: false,
    check_up: false,
    psychiatric: false,
    infertility: false,
    pregnancy: false,
    completed_coded_by: '',
    provider_signature: '',
    provider_date: '',
    case_management_form_included: false,
    possible_line_of_management: '',
    estimated_length_of_stay_days: '',
    expected_date_of_admission: '',
    patient_id: '',
    provider_id: '',
    insurer_id: '',
    management_items: [],
    medications: []
  });

  useEffect(() => {
    if (isEdit) {
      loadFormData();
    }
  }, [id]);

  const loadFormData = async () => {
    try {
      setLoading(true);
      const response = await api.getStandardApproval(id);
      const data = response.data || response;
      
      // Remove join fields that shouldn't be in formData
      // Note: provider_name from join overwrites the form field, but we need the form field
      // So we extract it before removing join fields
      const { patient_name, insurer_name, provider_name_joined, ...formFields } = data;
      
      // Convert null values to empty strings for form inputs
      const sanitizedData = Object.keys(formFields).reduce((acc, key) => {
        const value = formFields[key];
        if (value === null || value === undefined) {
          acc[key] = '';
        } else {
          acc[key] = value;
        }
        return acc;
      }, {});
      
      setFormData({
        ...sanitizedData,
        management_items: data.management_items || [],
        medications: data.medications || []
      });
    } catch (error) {
      console.error('Error loading form:', error);
      alert('Error loading form data');
    } finally {
      setLoading(false);
    }
  };

  // Helper function to convert date string to Date object
  const parseDate = (dateString) => {
    if (!dateString) return null;
    return new Date(dateString);
  };

  // Helper function to format date for API (YYYY-MM-DD)
  const formatDateForAPI = (date) => {
    if (!date) return '';
    return format(date, 'yyyy-MM-dd');
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const handleDateChange = (field, date) => {
    setFormData(prev => ({ ...prev, [field]: formatDateForAPI(date) }));
    // Clear error when date is selected
    if (errors[field]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const handleSelectChange = (field, selectedOption) => {
    setFormData(prev => ({ ...prev, [field]: selectedOption ? selectedOption.value : '' }));
    // Clear error when option is selected
    if (errors[field]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const handleCheckboxChange = (field) => {
    setFormData(prev => ({ ...prev, [field]: !prev[field] }));
  };

  // Options for select dropdowns
  const maritalStatusOptions = [
    { value: 'Single', label: 'Single' },
    { value: 'Married', label: 'Married' }
  ];

  const visitTypeOptions = [
    { value: 'New visit', label: 'New visit' },
    { value: 'Follow Up', label: 'Follow Up' },
    { value: 'Refill', label: 'Refill' },
    { value: 'walk in', label: 'walk in' },
    { value: 'Referral', label: 'Referral' }
  ];

  const patientTypeOptions = [
    { value: 'Inpatient', label: 'Inpatient' },
    { value: 'Outpatient', label: 'Outpatient' }
  ];

  const emergencyLevelOptions = [
    { value: '1', label: 'Level 1' },
    { value: '2', label: 'Level 2' },
    { value: '3', label: 'Level 3' }
  ];

  // Custom styles for react-select with menuPortalTarget
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

  const handleAddManagementItem = () => {
    setFormData(prev => ({
      ...prev,
      management_items: [...prev.management_items, { code: '', description: '', type: '', quantity: '', cost: '' }]
    }));
  };

  const handleRemoveManagementItem = (index) => {
    setFormData(prev => ({
      ...prev,
      management_items: prev.management_items.filter((_, i) => i !== index)
    }));
  };

  const handleManagementItemChange = (index, field, value) => {
    setFormData(prev => ({
      ...prev,
      management_items: prev.management_items.map((item, i) =>
        i === index ? { ...item, [field]: value } : item
      )
    }));
  };

  const handleAddMedication = () => {
    setFormData(prev => ({
      ...prev,
      medications: [...prev.medications, { medication_name: '', type: '', quantity: '' }]
    }));
  };

  const handleRemoveMedication = (index) => {
    setFormData(prev => ({
      ...prev,
      medications: prev.medications.filter((_, i) => i !== index)
    }));
  };

  const handleMedicationChange = (index, field, value) => {
    setFormData(prev => ({
      ...prev,
      medications: prev.medications.map((med, i) =>
        i === index ? { ...med, [field]: value } : med
      )
    }));
  };

  // Validation rules
  const validateForm = () => {
    const newErrors = {};
    
    // Basic Info validation
    if (!formData.provider_name.trim()) newErrors.provider_name = 'Provider name is required';
    if (!formData.insurance_company_name.trim()) newErrors.insurance_company_name = 'Insurance company name is required';
    if (!formData.patient_file_number.trim()) newErrors.patient_file_number = 'Patient file number is required';
    if (!formData.date_of_visit) newErrors.date_of_visit = 'Date of visit is required';
    if (!formData.visit_type) newErrors.visit_type = 'Visit type is required';
    
    // Insured Info validation
    if (!formData.insured_name.trim()) newErrors.insured_name = 'Insured name is required';
    if (!formData.id_card_number.trim()) newErrors.id_card_number = 'ID card number is required';
    if (!formData.age || formData.age < 0 || formData.age > 150) newErrors.age = 'Valid age is required';
    
    // Clinical validation
    if (!formData.patient_type) newErrors.patient_type = 'Patient type is required';
    if (formData.emergency_case && !formData.emergency_care_level) {
      newErrors.emergency_care_level = 'Emergency care level is required when emergency case is selected';
    }
    if (!formData.diagnosis.trim()) newErrors.diagnosis = 'Diagnosis is required';
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Get errors for a specific tab (only show errors for touched fields)
  // Map fields to their tabs
  const getFieldTab = (fieldName) => {
    const fieldTabMap = {
      // Basic Info tab
      provider_name: 'basic',
      insurance_company_name: 'basic',
      tpa_company_name: 'basic',
      patient_file_number: 'basic',
      department: 'basic',
      marital_status: 'basic',
      plan_type: 'basic',
      date_of_visit: 'basic',
      visit_type: 'basic',
      // Insured Info tab
      insured_name: 'insured',
      id_card_number: 'insured',
      sex: 'insured',
      age: 'insured',
      policy_holder: 'insured',
      policy_number: 'insured',
      expiry_date: 'insured',
      approval_field: 'insured',
      // Clinical tab
      patient_type: 'clinical',
      emergency_case: 'clinical',
      emergency_care_level: 'clinical',
      bp: 'clinical',
      pulse: 'clinical',
      temp: 'clinical',
      weight: 'clinical',
      height: 'clinical',
      respiratory_rate: 'clinical',
      duration_of_illness_days: 'clinical',
      chief_complaints: 'clinical',
      significant_signs: 'clinical',
      other_conditions: 'clinical',
      diagnosis: 'clinical',
      principal_code: 'clinical',
      second_code: 'clinical',
      third_code: 'clinical',
      fourth_code: 'clinical',
      chronic: 'clinical',
      congenital: 'clinical',
      rta: 'clinical',
      work_related: 'clinical',
      vaccination: 'clinical',
      check_up: 'clinical',
      psychiatric: 'clinical',
      infertility: 'clinical',
      pregnancy: 'clinical',
      completed_coded_by: 'clinical',
      provider_signature: 'clinical',
      provider_date: 'clinical',
      case_management_form_included: 'clinical',
      possible_line_of_management: 'clinical',
      estimated_length_of_stay_days: 'clinical',
      expected_date_of_admission: 'clinical',
      // ID fields (can be in any tab, default to basic)
      patient_id: 'basic',
      provider_id: 'basic',
      insurer_id: 'basic'
    };
    return fieldTabMap[fieldName] || 'basic';
  };

  const getTabErrors = (tabId) => {
    // Define field-to-tab mapping
    const fieldTabMap = {
      // Basic Info tab
      provider_name: 'basic',
      insurance_company_name: 'basic',
      tpa_company_name: 'basic',
      patient_file_number: 'basic',
      department: 'basic',
      marital_status: 'basic',
      plan_type: 'basic',
      date_of_visit: 'basic',
      visit_type: 'basic',
      patient_id: 'basic',
      provider_id: 'basic',
      insurer_id: 'basic',
      // Insured Info tab
      insured_name: 'insured',
      id_card_number: 'insured',
      sex: 'insured',
      age: 'insured',
      policy_holder: 'insured',
      policy_number: 'insured',
      expiry_date: 'insured',
      approval_field: 'insured',
      // Clinical tab
      patient_type: 'clinical',
      emergency_case: 'clinical',
      emergency_care_level: 'clinical',
      bp: 'clinical',
      pulse: 'clinical',
      temp: 'clinical',
      weight: 'clinical',
      height: 'clinical',
      respiratory_rate: 'clinical',
      duration_of_illness_days: 'clinical',
      chief_complaints: 'clinical',
      significant_signs: 'clinical',
      other_conditions: 'clinical',
      diagnosis: 'clinical',
      principal_code: 'clinical',
      second_code: 'clinical',
      third_code: 'clinical',
      fourth_code: 'clinical',
      chronic: 'clinical',
      congenital: 'clinical',
      rta: 'clinical',
      work_related: 'clinical',
      vaccination: 'clinical',
      check_up: 'clinical',
      psychiatric: 'clinical',
      infertility: 'clinical',
      pregnancy: 'clinical',
      completed_coded_by: 'clinical',
      provider_signature: 'clinical',
      provider_date: 'clinical',
      case_management_form_included: 'clinical',
      possible_line_of_management: 'clinical',
      estimated_length_of_stay_days: 'clinical',
      expected_date_of_admission: 'clinical'
    };
    
    // Get all fields for this tab
    const allFieldsInTab = Object.keys(fieldTabMap).filter(field => fieldTabMap[field] === tabId);
    
    // Check if any field in this tab has an error
    return allFieldsInTab.some(field => errors[field]);
  };

  const handleBlur = (field) => {
    setTouched(prev => ({ ...prev, [field]: true }));
    // Only validate after blur, don't show errors while typing
    const newErrors = {};
    // Validate specific field
    if (field === 'provider_name' && !formData.provider_name.trim()) newErrors.provider_name = 'Provider name is required';
    if (field === 'insurance_company_name' && !formData.insurance_company_name.trim()) newErrors.insurance_company_name = 'Insurance company name is required';
    if (field === 'patient_file_number' && !formData.patient_file_number.trim()) newErrors.patient_file_number = 'Patient file number is required';
    if (field === 'date_of_visit' && !formData.date_of_visit) newErrors.date_of_visit = 'Date of visit is required';
    if (field === 'visit_type' && !formData.visit_type) newErrors.visit_type = 'Visit type is required';
    if (field === 'insured_name' && !formData.insured_name.trim()) newErrors.insured_name = 'Insured name is required';
    if (field === 'id_card_number' && !formData.id_card_number.trim()) newErrors.id_card_number = 'ID card number is required';
    if (field === 'age' && (!formData.age || formData.age < 0 || formData.age > 150)) newErrors.age = 'Valid age is required';
    if (field === 'patient_type' && !formData.patient_type) newErrors.patient_type = 'Patient type is required';
    if (field === 'emergency_care_level' && formData.emergency_case && !formData.emergency_care_level) {
      newErrors.emergency_care_level = 'Emergency care level is required when emergency case is selected';
    }
    if (field === 'diagnosis' && !formData.diagnosis.trim()) newErrors.diagnosis = 'Diagnosis is required';
    
    setErrors(prev => ({ ...prev, ...newErrors }));
  };

  const handleSaveForm = async (e) => {
    e.preventDefault();
    
    // Mark all fields as touched
    const allFields = Object.keys(formData);
    setTouched(allFields.reduce((acc, field) => ({ ...acc, [field]: true }), {}));
    
    // Validate form
    if (!validateForm()) {
      // Find first tab with error and switch to it
      const tabsOrder = ['basic', 'insured', 'clinical'];
      for (const tab of tabsOrder) {
        if (getTabErrors(tab)) {
          setActiveTab(tab);
          break;
        }
      }
      return;
    }

    try {
      setLoading(true);
      
      // Helper function to convert string to number or null
      const toNumberOrNull = (value) => {
        if (value === '' || value === null || value === undefined) return null;
        const num = Number(value);
        return isNaN(num) ? null : num;
      };

      // Helper function to handle UUID fields (keep as string or null)
      const toUuidOrNull = (value) => {
        if (value === '' || value === null || value === undefined) return null;
        return String(value); // Keep as string for UUID
      };

      // Fields to exclude from save (internal fields or removed fields)
      const excludedFields = [
        'id',
        'created_at',
        'updated_at',
        'patient_name', // This is from join, not an actual form field
        'provider_name_joined', // This is from join, not an actual form field
        'insurer_name', // This is from join, not an actual form field
        // Note: provider_name exists as both a form field AND join field - we keep the form field value
        // Removed approval fields (in case they still exist in DB)
        'physician_name',
        'physician_signature',
        'physician_stamp',
        'physician_certification_date',
        'patient_guardian_name',
        'patient_guardian_relationship',
        'patient_guardian_signature',
        'patient_guardian_date',
        'insurance_approval_status',
        'approval_number',
        'approval_validity_days',
        'insurance_comments',
        'approved_disapproved_by',
        'insurance_signature',
        'insurance_approval_date'
      ];

      // Filter out excluded fields and prepare data for save
      const filteredData = Object.keys(formData).reduce((acc, key) => {
        if (!excludedFields.includes(key)) {
          acc[key] = formData[key];
        }
        return acc;
      }, {});

      // Convert numeric fields to numbers
      const dataToSave = {
        ...filteredData,
        // Convert ID fields (UUIDs - keep as strings)
        patient_id: toUuidOrNull(filteredData.patient_id),
        provider_id: toUuidOrNull(filteredData.provider_id),
        insurer_id: toUuidOrNull(filteredData.insurer_id),
        // Convert other numeric fields
        age: toNumberOrNull(filteredData.age),
        emergency_care_level: toNumberOrNull(filteredData.emergency_care_level),
        pulse: toNumberOrNull(filteredData.pulse),
        temp: toNumberOrNull(filteredData.temp),
        weight: toNumberOrNull(filteredData.weight),
        height: toNumberOrNull(filteredData.height),
        respiratory_rate: toNumberOrNull(filteredData.respiratory_rate),
        duration_of_illness_days: toNumberOrNull(filteredData.duration_of_illness_days),
        estimated_length_of_stay_days: toNumberOrNull(filteredData.estimated_length_of_stay_days),
        // Process nested arrays with numeric conversions
        management_items: (filteredData.management_items || [])
          .filter(item => item.code || item.description)
          .map(item => ({
            ...item,
            quantity: toNumberOrNull(item.quantity),
            cost: toNumberOrNull(item.cost)
          })),
        medications: (filteredData.medications || [])
          .filter(med => med.medication_name)
          .map(med => ({
            ...med,
            quantity: toNumberOrNull(med.quantity)
          }))
      };

      if (isEdit) {
        await api.updateStandardApproval(id, dataToSave);
      } else {
        await api.createStandardApproval(dataToSave);
      }
      
      navigate('/standard-approvals');
    } catch (error) {
      console.error('Error saving form:', error);
      console.error('Error response data:', error.response?.data);
      
      // Parse backend error response
      let backendErrors = {};
      let errorMessage = 'Error saving form. Please try again.';
      
      if (error.response?.data) {
        const errorData = error.response.data;
        
        // Handle validation errors with field names
        if (errorData.errors && Array.isArray(errorData.errors)) {
          console.log('Processing validation errors:', errorData.errors);
          errorData.errors.forEach(err => {
            backendErrors[err.field] = err.message;
            // Mark field as touched
            setTouched(prev => ({ ...prev, [err.field]: true }));
          });
          
          console.log('Setting backend errors:', backendErrors);
          
          // Set errors state
          setErrors(prev => {
            const newErrors = { ...prev, ...backendErrors };
            console.log('New errors state:', newErrors);
            return newErrors;
          });
          
          // Find first tab with error and switch to it
          const errorFields = Object.keys(backendErrors);
          console.log('Error fields:', errorFields);
          if (errorFields.length > 0) {
            const firstErrorTab = getFieldTab(errorFields[0]);
            console.log('Switching to tab:', firstErrorTab);
            setActiveTab(firstErrorTab);
          }
          
          errorMessage = errorData.errors[0].message || errorMessage;
        } else if (errorData.error) {
          // Handle single error message
          errorMessage = errorData.error;
          if (errorData.details) {
            errorMessage += `: ${errorData.details}`;
          }
        }
      }
      
      // Show error alert
      alert(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const tabs = [
    { id: 'basic', label: 'Basic Info', icon: FileText },
    { id: 'insured', label: 'Insured Info', icon: User },
    { id: 'clinical', label: 'Clinical', icon: Stethoscope }
  ];

  const handleNextTab = () => {
    const currentIndex = tabs.findIndex(tab => tab.id === activeTab);
    if (currentIndex < tabs.length - 1) {
      setActiveTab(tabs[currentIndex + 1].id);
    }
  };

  const handlePreviousTab = () => {
    const currentIndex = tabs.findIndex(tab => tab.id === activeTab);
    if (currentIndex > 0) {
      setActiveTab(tabs[currentIndex - 1].id);
    }
  };

  if (loading && isEdit) {
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
    <div className="mx-auto space-y-10 px-8 pt-8 pb-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" onClick={() => navigate('/standard-approvals')} size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {isEdit ? 'Edit Form' : 'New Standard Approval Form'}
            </h1>
            <p className="text-sm text-gray-500 mt-1">Fill in all required information</p>
          </div>
        </div>
        <Button onClick={handleSaveForm} disabled={loading} className="bg-gradient-to-r from-primary-purple to-accent-purple">
          <Save className="h-4 w-4 mr-2" />
          {loading ? 'Saving...' : 'Save'}
        </Button>
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

      {/* Form Content */}
      <form onSubmit={handleSaveForm}>
        <Card className="">
          <CardContent className="p-10">
            {/* Tab 1: Basic Info */}
            {activeTab === 'basic' && (
              <div className="space-y-10">
                <div className="border-b border-gray-200 pb-8">
                  <h3 className="text-lg font-semibold mb-8 text-gray-800">Provider & Visit Information</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <div className="space-y-2">
                      <Label className="text-xs text-gray-600">Provider Name <span className="text-red-500">*</span></Label>
                      <Input 
                        value={formData.provider_name} 
                        onChange={(e) => handleInputChange('provider_name', e.target.value)}
                        onBlur={() => handleBlur('provider_name')}
                        placeholder="Enter provider name"
                        className={`${errors.provider_name ? 'border-red-500' : ''}`}
                      />
                      {errors.provider_name && (
                        <p className="text-xs text-red-500">{errors.provider_name}</p>
                      )}
                    </div>
                    <div>
                      <Label className="text-xs text-gray-600">Insurance Company <span className="text-red-500">*</span></Label>
                      <Input 
                        value={formData.insurance_company_name} 
                        onChange={(e) => handleInputChange('insurance_company_name', e.target.value)}
                        onBlur={() => handleBlur('insurance_company_name')}
                        placeholder="Enter insurance company name"
                        className={`mt-1 ${errors.insurance_company_name ? 'border-red-500' : ''}`}
                      />
                      {errors.insurance_company_name && (
                        <p className="text-xs text-red-500 mt-1">{errors.insurance_company_name}</p>
                      )}
                    </div>
                    <div>
                      <Label className="text-xs text-gray-600">TPA Company</Label>
                      <Input value={formData.tpa_company_name} onChange={(e) => handleInputChange('tpa_company_name', e.target.value)} placeholder="Enter TPA company name" className="mt-1" />
                    </div>
                    <div>
                      <Label className="text-xs text-gray-600">Patient File Number <span className="text-red-500">*</span></Label>
                      <Input 
                        value={formData.patient_file_number} 
                        onChange={(e) => handleInputChange('patient_file_number', e.target.value)}
                        onBlur={() => handleBlur('patient_file_number')}
                        placeholder="Enter patient file number"
                        className={`mt-1 ${errors.patient_file_number ? 'border-red-500' : ''}`}
                      />
                      {errors.patient_file_number && (
                        <p className="text-xs text-red-500 mt-1">{errors.patient_file_number}</p>
                      )}
                    </div>
                    <div>
                      <Label className="text-xs text-gray-600">Department</Label>
                      <Input value={formData.department} onChange={(e) => handleInputChange('department', e.target.value)} placeholder="e.g., Cardiology, Neurology" className="mt-1" />
                    </div>
                    <div>
                      <Label className="text-xs text-gray-600">Marital Status</Label>
                      <Select
                        value={maritalStatusOptions.find(opt => opt.value === formData.marital_status)}
                        onChange={(option) => handleSelectChange('marital_status', option)}
                        options={maritalStatusOptions}
                        placeholder="Select..."
                        isClearable
                        styles={selectStyles}
                        className="mt-1 react-select-container"
                        classNamePrefix="react-select"
                        name="marital_status"
                        menuPortalTarget={document.body}
                        menuPosition="fixed"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-gray-600">Plan Type</Label>
                      <Input value={formData.plan_type} onChange={(e) => handleInputChange('plan_type', e.target.value)} placeholder="Enter plan type" className="mt-1" />
                    </div>
                    <div>
                      <Label className="text-xs text-gray-600">Date of Visit <span className="text-red-500">*</span></Label>
                      <div className="relative mt-1">
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
                      {errors.date_of_visit && (
                        <p className="text-xs text-red-500 mt-1">{errors.date_of_visit}</p>
                      )}
                    </div>
                    <div>
                      <Label className="text-xs text-gray-600">Visit Type <span className="text-red-500">*</span></Label>
                      <Select
                        value={visitTypeOptions.find(opt => opt.value === formData.visit_type)}
                        onChange={(option) => handleSelectChange('visit_type', option)}
                        onBlur={() => handleBlur('visit_type')}
                        options={visitTypeOptions}
                        placeholder="Select..."
                        isClearable
                        styles={selectStyles}
                        className="mt-1 react-select-container"
                        classNamePrefix="react-select"
                        name="visit_type"
                        menuPortalTarget={document.body}
                        menuPosition="fixed"
                      />
                      {errors.visit_type && (
                        <p className="text-xs text-red-500 mt-1">{errors.visit_type}</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Tab 2: Insured Info */}
            {activeTab === 'insured' && (
              <div className="space-y-10">
                <div className="border-b border-gray-200 pb-8">
                  <h3 className="text-lg font-semibold mb-8 text-gray-800">Insured Information</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <div>
                      <Label className="text-xs text-gray-600">Insured Name <span className="text-red-500">*</span></Label>
                      <Input 
                        value={formData.insured_name} 
                        onChange={(e) => handleInputChange('insured_name', e.target.value)}
                        onBlur={() => handleBlur('insured_name')}
                        placeholder="Enter insured person name"
                        className={`mt-1 ${errors.insured_name ? 'border-red-500' : ''}`}
                      />
                      {errors.insured_name && (
                        <p className="text-xs text-red-500 mt-1">{errors.insured_name}</p>
                      )}
                    </div>
                    <div>
                      <Label className="text-xs text-gray-600">ID Card Number <span className="text-red-500">*</span></Label>
                      <Input 
                        value={formData.id_card_number} 
                        onChange={(e) => handleInputChange('id_card_number', e.target.value)}
                        onBlur={() => handleBlur('id_card_number')}
                        placeholder="Enter ID card number"
                        className={`mt-1 ${errors.id_card_number ? 'border-red-500' : ''}`}
                      />
                      {errors.id_card_number && (
                        <p className="text-xs text-red-500 mt-1">{errors.id_card_number}</p>
                      )}
                    </div>
                    <div>
                      <Label className="text-xs text-gray-600">Sex</Label>
                      <Input 
                        value={formData.sex} 
                        onChange={(e) => handleInputChange('sex', e.target.value)}
                        onBlur={() => handleBlur('sex')}
                        placeholder="M/F" 
                        className={`mt-1 ${errors.sex ? 'border-red-500' : ''}`}
                      />
                      {errors.sex && (
                        <p className="text-xs text-red-500 mt-1">{errors.sex}</p>
                      )}
                    </div>
                    <div>
                      <Label className="text-xs text-gray-600">Age <span className="text-red-500">*</span></Label>
                      <Input 
                        type="number" 
                        value={formData.age} 
                        onChange={(e) => handleInputChange('age', e.target.value)}
                        onBlur={() => handleBlur('age')}
                        placeholder="Enter age"
                        className={`mt-1 ${errors.age ? 'border-red-500' : ''}`}
                      />
                      {errors.age && (
                        <p className="text-xs text-red-500 mt-1">{errors.age}</p>
                      )}
                    </div>
                    <div>
                      <Label className="text-xs text-gray-600">Policy Holder</Label>
                      <Input value={formData.policy_holder} onChange={(e) => handleInputChange('policy_holder', e.target.value)} placeholder="Enter policy holder name" className="mt-1" />
                    </div>
                    <div>
                      <Label className="text-xs text-gray-600">Policy Number</Label>
                      <Input value={formData.policy_number} onChange={(e) => handleInputChange('policy_number', e.target.value)} placeholder="Enter policy number" className="mt-1" />
                    </div>
                    <div>
                      <Label className="text-xs text-gray-600">Expiry Date</Label>
                      <div className="relative mt-1">
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
                      <Label className="text-xs text-gray-600">Approval</Label>
                      <Input value={formData.approval_field} onChange={(e) => handleInputChange('approval_field', e.target.value)} placeholder="Enter approval field" className="mt-1" />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Tab 3: Clinical */}
            {activeTab === 'clinical' && (
              <div className="space-y-10">
                {/* Patient Type */}
                <div className="border-b border-gray-200 pb-8">
                  <h3 className="text-lg font-semibold mb-8 text-gray-800">Patient Type & Emergency</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <Label className="text-xs text-gray-600">Patient Type <span className="text-red-500">*</span></Label>
                      <Select
                        value={patientTypeOptions.find(opt => opt.value === formData.patient_type)}
                        onChange={(option) => handleSelectChange('patient_type', option)}
                        onBlur={() => handleBlur('patient_type')}
                        options={patientTypeOptions}
                        placeholder="Select..."
                        isClearable
                        styles={selectStyles}
                        className="mt-1 react-select-container"
                        classNamePrefix="react-select"
                        name="patient_type"
                        menuPortalTarget={document.body}
                        menuPosition="fixed"
                      />
                      {errors.patient_type && (
                        <p className="text-xs text-red-500 mt-1">{errors.patient_type}</p>
                      )}
                    </div>
                    <div className="flex items-end">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={formData.emergency_case} onChange={() => handleCheckboxChange('emergency_case')} className="w-4 h-4" />
                        <span className="text-sm">Emergency Case</span>
                      </label>
                      {formData.emergency_case && (
                        <div className="ml-4 flex-1">
                          <Select
                            value={emergencyLevelOptions.find(opt => opt.value === formData.emergency_care_level)}
                            onChange={(option) => handleSelectChange('emergency_care_level', option)}
                            onBlur={() => handleBlur('emergency_care_level')}
                            options={emergencyLevelOptions}
                            placeholder="Select level"
                            isClearable
                            styles={selectStyles}
                            classNamePrefix="react-select"
                            name="emergency_care_level"
                            menuPortalTarget={document.body}
                            menuPosition="fixed"
                          />
                          {errors.emergency_care_level && (
                            <p className="text-xs text-red-500 mt-1">{errors.emergency_care_level}</p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Vital Signs */}
                <div className="pt-8 border-b border-gray-200 pb-8">
                  <h3 className="text-lg font-semibold mb-8 text-gray-800">Vital Signs</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-6">
                    <div>
                      <Label className="text-xs text-gray-600">BP</Label>
                      <Input value={formData.bp} onChange={(e) => handleInputChange('bp', e.target.value)} placeholder="___/___" className="mt-1" />
                    </div>
                    <div>
                      <Label className="text-xs text-gray-600">Pulse</Label>
                      <Input type="number" value={formData.pulse} onChange={(e) => handleInputChange('pulse', e.target.value)} placeholder="bpm" className="mt-1" />
                    </div>
                    <div>
                      <Label className="text-xs text-gray-600">Temp (°C)</Label>
                      <Input type="number" step="0.1" value={formData.temp} onChange={(e) => handleInputChange('temp', e.target.value)} placeholder="°C" className="mt-1" />
                    </div>
                    <div>
                      <Label className="text-xs text-gray-600">Weight (Kg)</Label>
                      <Input type="number" step="0.1" value={formData.weight} onChange={(e) => handleInputChange('weight', e.target.value)} placeholder="Kg" className="mt-1" />
                    </div>
                    <div>
                      <Label className="text-xs text-gray-600">Height (cm)</Label>
                      <Input type="number" step="0.1" value={formData.height} onChange={(e) => handleInputChange('height', e.target.value)} placeholder="cm" className="mt-1" />
                    </div>
                    <div>
                      <Label className="text-xs text-gray-600">R.R.</Label>
                      <Input type="number" value={formData.respiratory_rate} onChange={(e) => handleInputChange('respiratory_rate', e.target.value)} placeholder="per minute" className="mt-1" />
                    </div>
                    <div>
                      <Label className="text-xs text-gray-600">Illness Days</Label>
                      <Input type="number" value={formData.duration_of_illness_days} onChange={(e) => handleInputChange('duration_of_illness_days', e.target.value)} placeholder="days" className="mt-1" />
                    </div>
                  </div>
                </div>

                {/* Clinical Details */}
                <div className="pt-8 border-b border-gray-200 pb-8">
                  <h3 className="text-lg font-semibold mb-8 text-gray-800">Clinical Details</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <Label className="text-xs text-gray-600">Chief Complaints</Label>
                      <textarea value={formData.chief_complaints} onChange={(e) => handleInputChange('chief_complaints', e.target.value)} placeholder="Describe the chief complaints..." className="mt-1 w-full rounded border border-[#d1d5db] bg-background px-3 py-2 text-sm min-h-[80px]" />
                    </div>
                    <div>
                      <Label className="text-xs text-gray-600">Significant Signs</Label>
                      <textarea value={formData.significant_signs} onChange={(e) => handleInputChange('significant_signs', e.target.value)} placeholder="Describe significant signs..." className="mt-1 w-full rounded border border-[#d1d5db] bg-background px-3 py-2 text-sm min-h-[80px]" />
                    </div>
                    <div>
                      <Label className="text-xs text-gray-600">Other Conditions</Label>
                      <textarea value={formData.other_conditions} onChange={(e) => handleInputChange('other_conditions', e.target.value)} placeholder="Describe other conditions..." className="mt-1 w-full rounded border border-[#d1d5db] bg-background px-3 py-2 text-sm min-h-[80px]" />
                    </div>
                    <div>
                      <Label className="text-xs text-gray-600">Diagnosis <span className="text-red-500">*</span></Label>
                      <textarea value={formData.diagnosis} onChange={(e) => handleInputChange('diagnosis', e.target.value)} onBlur={() => handleBlur('diagnosis')} placeholder="Enter diagnosis..." className={`mt-1 w-full rounded border ${errors.diagnosis && touched.diagnosis ? 'border-red-500' : 'border-[#d1d5db]'} bg-background px-3 py-2 text-sm min-h-[80px]`} />
                      {errors.diagnosis && (
                        <p className="text-xs text-red-500 mt-1">{errors.diagnosis}</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Codes */}
                <div className="pt-8 border-b border-gray-200 pb-8">
                  <h3 className="text-lg font-semibold mb-8 text-gray-800">Coding</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                    <div>
                      <Label className="text-xs text-gray-600">Principal Code</Label>
                      <Input value={formData.principal_code} onChange={(e) => handleInputChange('principal_code', e.target.value)} placeholder="e.g., I10" className="mt-1" />
                    </div>
                    <div>
                      <Label className="text-xs text-gray-600">2nd Code</Label>
                      <Input value={formData.second_code} onChange={(e) => handleInputChange('second_code', e.target.value)} placeholder="e.g., E11" className="mt-1" />
                    </div>
                    <div>
                      <Label className="text-xs text-gray-600">3rd Code</Label>
                      <Input value={formData.third_code} onChange={(e) => handleInputChange('third_code', e.target.value)} placeholder="e.g., M54" className="mt-1" />
                    </div>
                    <div>
                      <Label className="text-xs text-gray-600">4th Code</Label>
                      <Input value={formData.fourth_code} onChange={(e) => handleInputChange('fourth_code', e.target.value)} placeholder="e.g., K59" className="mt-1" />
                    </div>
                  </div>
                </div>

                {/* Conditions */}
                <div className="pt-8 border-b border-gray-200 pb-8">
                  <h3 className="text-lg font-semibold mb-8 text-gray-800">Conditions</h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-5">
                    {['chronic', 'congenital', 'rta', 'work_related', 'vaccination', 'check_up', 'psychiatric', 'infertility', 'pregnancy'].map((key) => (
                      <label key={key} className="flex items-center gap-2 cursor-pointer text-sm">
                        <input type="checkbox" checked={formData[key]} onChange={() => handleCheckboxChange(key)} className="w-4 h-4" />
                        <span className="capitalize">{key.replace('_', ' ')}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Management Items */}
                <div className="pt-8 border-b border-gray-200 pb-8">
                  <div className="flex justify-between items-center mb-8">
                    <h3 className="text-lg font-semibold text-gray-800">Management Items</h3>
                    <Button type="button" onClick={handleAddManagementItem} size="sm" variant="outline">
                      <Plus className="h-4 w-4 mr-2" />
                      Add
                    </Button>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm border-collapse">
                      <thead>
                        <tr className="bg-gray-50 border-b">
                          <th className="p-2 text-left">Code</th>
                          <th className="p-2 text-left">Description</th>
                          <th className="p-2 text-left">Type</th>
                          <th className="p-2 text-left">Qty</th>
                          <th className="p-2 text-left">Cost</th>
                          <th className="p-2 text-left">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {formData.management_items.map((item, index) => (
                          <tr key={index} className="border-b hover:bg-gray-50">
                            <td className="p-2"><Input value={item.code} onChange={(e) => handleManagementItemChange(index, 'code', e.target.value)} placeholder="Code" className="h-8" /></td>
                            <td className="p-2"><Input value={item.description} onChange={(e) => handleManagementItemChange(index, 'description', e.target.value)} placeholder="Description" className="h-8" /></td>
                            <td className="p-2"><Input value={item.type} onChange={(e) => handleManagementItemChange(index, 'type', e.target.value)} placeholder="Type" className="h-8" /></td>
                            <td className="p-2"><Input type="number" value={item.quantity} onChange={(e) => handleManagementItemChange(index, 'quantity', e.target.value)} placeholder="Qty" className="h-8" /></td>
                            <td className="p-2"><Input type="number" step="0.01" value={item.cost} onChange={(e) => handleManagementItemChange(index, 'cost', e.target.value)} placeholder="Cost" className="h-8" /></td>
                            <td className="p-2"><Button type="button" variant="destructive" size="sm" onClick={() => handleRemoveManagementItem(index)}><Trash2 className="h-3 w-3" /></Button></td>
                          </tr>
                        ))}
                        {formData.management_items.length === 0 && (
                          <tr><td colSpan="6" className="p-4 text-center text-gray-400 text-sm">No items added</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Medications */}
                <div className="pt-8 border-b border-gray-200 pb-8">
                  <div className="flex justify-between items-center mb-8">
                    <h3 className="text-lg font-semibold text-gray-800">Medications</h3>
                    <Button type="button" onClick={handleAddMedication} size="sm" variant="outline">
                      <Plus className="h-4 w-4 mr-2" />
                      Add
                    </Button>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm border-collapse">
                      <thead>
                        <tr className="bg-gray-50 border-b">
                          <th className="p-2 text-left">Medication Name</th>
                          <th className="p-2 text-left">Type</th>
                          <th className="p-2 text-left">Quantity</th>
                          <th className="p-2 text-left">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {formData.medications.map((med, index) => (
                          <tr key={index} className="border-b hover:bg-gray-50">
                            <td className="p-2"><Input value={med.medication_name} onChange={(e) => handleMedicationChange(index, 'medication_name', e.target.value)} placeholder="Medication name" className="h-8" /></td>
                            <td className="p-2"><Input value={med.type} onChange={(e) => handleMedicationChange(index, 'type', e.target.value)} placeholder="Type" className="h-8" /></td>
                            <td className="p-2"><Input type="number" value={med.quantity} onChange={(e) => handleMedicationChange(index, 'quantity', e.target.value)} placeholder="Qty" className="h-8" /></td>
                            <td className="p-2"><Button type="button" variant="destructive" size="sm" onClick={() => handleRemoveMedication(index)}><Trash2 className="h-3 w-3" /></Button></td>
                          </tr>
                        ))}
                        {formData.medications.length === 0 && (
                          <tr><td colSpan="4" className="p-4 text-center text-gray-400 text-sm">No medications added</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Provider Approval */}
                <div className="pt-8 border-b border-gray-200 pb-8">
                  <h3 className="text-lg font-semibold mb-8 text-gray-800">Provider Approval</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div>
                      <Label className="text-xs text-gray-600">Completed/Coded BY</Label>
                      <Input 
                        value={formData.completed_coded_by} 
                        onChange={(e) => handleInputChange('completed_coded_by', e.target.value)} 
                        placeholder="Enter name" 
                        className="mt-1" 
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-gray-600">Signature</Label>
                      <Input value={formData.provider_signature} onChange={(e) => handleInputChange('provider_signature', e.target.value)} placeholder="Enter signature" className="mt-1" />
                    </div>
                    <div>
                      <Label className="text-xs text-gray-600">Date</Label>
                      <div className="relative mt-1">
                        <DatePicker
                          selected={parseDate(formData.provider_date)}
                          onChange={(date) => handleDateChange('provider_date', date)}
                          dateFormat="dd/MM/yyyy"
                          placeholderText="Select date"
                          className="w-full rounded border border-[#d1d5db] bg-background px-3 py-2 pl-10 text-sm"
                          wrapperClassName="w-full"
                        />
                        <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Case Management */}
                <div className="pt-8 border-b border-gray-200 pb-8">
                  <h3 className="text-lg font-semibold mb-8 text-gray-800">Case Management</h3>
                  <div className="space-y-6">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={formData.case_management_form_included} onChange={() => handleCheckboxChange('case_management_form_included')} className="w-4 h-4" />
                      <span className="text-sm">Case management Form (CMF 1.0) included</span>
                    </label>
                    <div>
                      <Label className="text-xs text-gray-600">Possible line of management</Label>
                      <textarea value={formData.possible_line_of_management} onChange={(e) => handleInputChange('possible_line_of_management', e.target.value)} placeholder="Describe possible line of management..." className="mt-1 w-full rounded border border-[#d1d5db] bg-background px-3 py-2 text-sm min-h-[80px]" />
                    </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <Label className="text-xs text-gray-600">Estimated Length of stay (days)</Label>
                        <Input type="number" value={formData.estimated_length_of_stay_days} onChange={(e) => handleInputChange('estimated_length_of_stay_days', e.target.value)} placeholder="days" className="mt-1" />
                      </div>
                      <div>
                        <Label className="text-xs text-gray-600">Expected date of admissions</Label>
                        <div className="relative mt-1">
                          <DatePicker
                            selected={parseDate(formData.expected_date_of_admission)}
                            onChange={(date) => handleDateChange('expected_date_of_admission', date)}
                            dateFormat="dd/MM/yyyy"
                            placeholderText="Select date"
                            className="w-full rounded border border-[#d1d5db] bg-background px-3 py-2 pl-10 text-sm"
                            wrapperClassName="w-full"
                          />
                          <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Navigation Buttons */}
        <div className="flex items-center justify-between mt-10">
          <Button
            type="button"
            variant="outline"
            onClick={handlePreviousTab}
            disabled={activeTab === 'basic'}
            className="flex items-center gap-2"
          >
            <ChevronLeft className="h-4 w-4" />
            Previous
          </Button>
          <div className="text-sm text-gray-500">
            Tab {tabs.findIndex(tab => tab.id === activeTab) + 1} of {tabs.length}
          </div>
          {activeTab === 'clinical' ? (
            <Button
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 bg-gradient-to-r from-primary-purple to-accent-purple"
            >
              <Save className="h-4 w-4" />
              {loading ? 'Saving...' : 'Save'}
            </Button>
          ) : (
            <Button
              type="button"
              variant="outline"
              onClick={handleNextTab}
              className="flex items-center gap-2"
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          )}
        </div>
      </form>
    </div>
  );
}
