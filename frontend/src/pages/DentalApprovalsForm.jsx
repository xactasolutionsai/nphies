import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import api from '@/services/api';
import { 
  Save, 
  ArrowLeft, 
  Plus, 
  Trash2, 
  FileText, 
  User, 
  Stethoscope, 
  Calendar,
  Pill,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import DentalChart from '@/components/DentalChart';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import Select from 'react-select';
import { format } from 'date-fns';

export default function DentalApprovalsForm() {
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

  const [formData, setFormData] = useState({
    // Reception/Nurse Section
    provider_name: '',
    insurance_company_name: '',
    tpa_company_name: '',
    patient_file_number: '',
    date_of_visit: '',
    plan_type: '',
    new_visit: false,
    follow_up: false,
    
    // Insured Information
    insured_name: '',
    id_card_number: '',
    sex: '',
    age: '',
    policy_holder: '',
    policy_number: '',
    expiry_date: '',
    class: '',
    
    // Dentist Section
    duration_of_illness_days: '',
    chief_complaints: '',
    significant_signs: '',
    diagnosis_icd10: '',
    primary_diagnosis: '',
    secondary_diagnosis: '',
    other_conditions: '',
    
    // Treatment Type
    regular_dental_treatment: false,
    dental_cleaning: false,
    trauma_treatment: false,
    trauma_rta: false,
    work_related: false,
    other_treatment: false,
    treatment_details: '',
    treatment_how: '',
    treatment_when: '',
    treatment_where: '',
    
    // Provider Approval
    completed_coded_by: '',
    provider_signature: '',
    provider_date: '',
    
    // Foreign Keys
    patient_id: '',
    provider_id: '',
    insurer_id: '',
    status: 'Draft'
  });

  const [procedures, setProcedures] = useState([
    { code: '', service_description: '', tooth_number: '', cost: '' }
  ]);

  const [medications, setMedications] = useState([
    { medication_name: '', type: '', quantity: '' }
  ]);

  const [activeProcedureIndex, setActiveProcedureIndex] = useState(null);

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
    setFormData(prev => ({ ...prev, [field]: selectedOption?.value || '' }));
    // Clear error when selection is made
    if (errors[field]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  // Custom styles for react-select with error handling
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

  // Dropdown options
  const sexOptions = [
    { value: 'Male', label: 'Male' },
    { value: 'Female', label: 'Female' },
    { value: 'Other', label: 'Other' }
  ];

  const statusOptions = [
    { value: 'Draft', label: 'Draft' },
    { value: 'Submitted', label: 'Submitted' },
    { value: 'Approved', label: 'Approved' },
    { value: 'Rejected', label: 'Rejected' },
    { value: 'Pending', label: 'Pending' }
  ];

  useEffect(() => {
    loadDropdownData();
    if (isEditMode) {
      loadFormData();
    }
  }, [id]);

  const loadDropdownData = async () => {
    try {
      const [patientsRes, providersRes, insurersRes] = await Promise.all([
        api.getPatients({ limit: 1000 }),
        api.getProviders({ limit: 1000 }),
        api.getInsurers({ limit: 1000 })
      ]);
      
      setPatients(patientsRes?.data?.data || patientsRes?.data || []);
      setProviders(providersRes?.data?.data || providersRes?.data || []);
      setInsurers(insurersRes?.data?.data || insurersRes?.data || []);
    } catch (error) {
      console.error('Error loading dropdown data:', error);
    }
  };

  const loadFormData = async () => {
    try {
      setLoading(true);
      const response = await api.getDentalApproval(id);
      const data = response?.data || response;
      
      setFormData({
        provider_name: data.provider_name || '',
        insurance_company_name: data.insurance_company_name || '',
        tpa_company_name: data.tpa_company_name || '',
        patient_file_number: data.patient_file_number || '',
        date_of_visit: data.date_of_visit ? data.date_of_visit.split('T')[0] : '',
        plan_type: data.plan_type || '',
        new_visit: data.new_visit || false,
        follow_up: data.follow_up || false,
        insured_name: data.insured_name || '',
        id_card_number: data.id_card_number || '',
        sex: data.sex || '',
        age: data.age || '',
        policy_holder: data.policy_holder || '',
        policy_number: data.policy_number || '',
        expiry_date: data.expiry_date ? data.expiry_date.split('T')[0] : '',
        class: data.class || '',
        duration_of_illness_days: data.duration_of_illness_days || '',
        chief_complaints: data.chief_complaints || '',
        significant_signs: data.significant_signs || '',
        diagnosis_icd10: data.diagnosis_icd10 || '',
        primary_diagnosis: data.primary_diagnosis || '',
        secondary_diagnosis: data.secondary_diagnosis || '',
        other_conditions: data.other_conditions || '',
        regular_dental_treatment: data.regular_dental_treatment || false,
        dental_cleaning: data.dental_cleaning || false,
        trauma_treatment: data.trauma_treatment || false,
        trauma_rta: data.trauma_rta || false,
        work_related: data.work_related || false,
        other_treatment: data.other_treatment || false,
        treatment_details: data.treatment_details || '',
        treatment_how: data.treatment_how || '',
        treatment_when: data.treatment_when || '',
        treatment_where: data.treatment_where || '',
        completed_coded_by: data.completed_coded_by || '',
        provider_signature: data.provider_signature || '',
        provider_date: data.provider_date ? data.provider_date.split('T')[0] : '',
        patient_id: data.patient_id || '',
        provider_id: data.provider_id || '',
        insurer_id: data.insurer_id || '',
        status: data.status || 'Draft'
      });

      if (data.procedures && data.procedures.length > 0) {
        setProcedures(data.procedures.map(p => ({
          code: p.code || '',
          service_description: p.service_description || '',
          tooth_number: p.tooth_number || '',
          cost: p.cost || ''
        })));
      }

      if (data.medications && data.medications.length > 0) {
        setMedications(data.medications.map(m => ({
          medication_name: m.medication_name || '',
          type: m.type || '',
          quantity: m.quantity || ''
        })));
      }
    } catch (error) {
      console.error('Error loading form data:', error);
      alert('Error loading form data');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const handleCheckboxChange = (field, checked) => {
    setFormData(prev => ({
      ...prev,
      [field]: checked
    }));
  };

  const handleBlur = (field) => {
    setTouched(prev => ({ ...prev, [field]: true }));
    validateField(field);
  };

  const validateField = (field) => {
    let error = '';
    
    // Required fields validation
    const requiredFields = {
      provider_name: 'Provider name is required',
      insurance_company_name: 'Insurance company name is required',
      date_of_visit: 'Date of visit is required',
      insured_name: 'Insured name is required',
      id_card_number: 'ID card number is required',
      sex: 'Sex is required',
      age: 'Age is required'
    };

    if (requiredFields[field] && !formData[field]) {
      error = requiredFields[field];
    }

    // Age validation
    if (field === 'age' && formData.age) {
      if (formData.age < 0 || formData.age > 150) {
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

    // Required field validations
    if (!formData.provider_name) newErrors.provider_name = 'Provider name is required';
    if (!formData.insurance_company_name) newErrors.insurance_company_name = 'Insurance company name is required';
    if (!formData.date_of_visit) newErrors.date_of_visit = 'Date of visit is required';
    if (!formData.insured_name) newErrors.insured_name = 'Insured name is required';
    if (!formData.id_card_number) newErrors.id_card_number = 'ID card number is required';
    if (!formData.sex) newErrors.sex = 'Sex is required';
    if (!formData.age) newErrors.age = 'Age is required';

    // Age validation
    if (formData.age && (formData.age < 0 || formData.age > 150)) {
      newErrors.age = 'Age must be between 0 and 150';
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

  // Get which tab each field belongs to
  const getFieldTab = (field) => {
    const receptionFields = ['provider_name', 'insurance_company_name', 'tpa_company_name', 'patient_file_number', 'date_of_visit', 'plan_type', 'new_visit', 'follow_up', 'patient_id', 'provider_id', 'insurer_id', 'status'];
    const insuredFields = ['insured_name', 'id_card_number', 'sex', 'age', 'policy_holder', 'policy_number', 'expiry_date', 'class'];
    const dentistFields = ['duration_of_illness_days', 'chief_complaints', 'significant_signs', 'diagnosis_icd10', 'primary_diagnosis', 'secondary_diagnosis', 'other_conditions', 'regular_dental_treatment', 'dental_cleaning', 'trauma_treatment', 'trauma_rta', 'work_related', 'other_treatment', 'treatment_details', 'treatment_how', 'treatment_when', 'treatment_where', 'completed_coded_by', 'provider_signature', 'provider_date'];

    if (receptionFields.includes(field)) return 'reception';
    if (insuredFields.includes(field)) return 'insured';
    if (dentistFields.includes(field)) return 'dentist';
    return 'procedures';
  };

  // Check if a tab has errors
  const getTabErrors = (tabId) => {
    const errorFields = Object.keys(errors);
    return errorFields.some(field => getFieldTab(field) === tabId);
  };

  const handleProcedureChange = (index, field, value) => {
    const newProcedures = [...procedures];
    newProcedures[index][field] = value;
    setProcedures(newProcedures);
  };

  const addProcedure = () => {
    const newIndex = procedures.length;
    setProcedures([...procedures, { code: '', service_description: '', tooth_number: '', cost: '' }]);
    setActiveProcedureIndex(newIndex);
  };

  const handleToothClick = (selectedTeethArray) => {
    // Handle single tooth selection (backward compatibility)
    if (typeof selectedTeethArray === 'string') {
      selectedTeethArray = [selectedTeethArray];
    }

    // If no teeth selected, do nothing
    if (!selectedTeethArray || selectedTeethArray.length === 0) {
      return;
    }

    // Get current procedure tooth numbers
    const currentToothNumbers = procedures.map(p => p.tooth_number).filter(Boolean);
    
    // Find teeth that need new rows (not already in procedures)
    const newTeeth = selectedTeethArray.filter(tooth => !currentToothNumbers.includes(tooth));
    
    // Find procedures that should be removed (tooth deselected)
    const proceduresToUpdate = procedures.map((proc, index) => {
      if (proc.tooth_number && !selectedTeethArray.includes(proc.tooth_number)) {
        // Tooth was deselected, clear the tooth number but keep the row if it has other data
        if (proc.code || proc.service_description || proc.cost) {
          return { ...proc, tooth_number: '' };
        }
        return null; // Mark for removal if row is empty
      }
      return proc;
    }).filter(p => p !== null);

    // Add new rows for newly selected teeth
    const newProcedures = [...proceduresToUpdate];
    
    newTeeth.forEach(tooth => {
      // Try to find an empty row to fill
      const emptyRowIndex = newProcedures.findIndex(p => !p.tooth_number && !p.code && !p.service_description && !p.cost);
      
      if (emptyRowIndex !== -1) {
        // Fill the empty row
        newProcedures[emptyRowIndex] = { ...newProcedures[emptyRowIndex], tooth_number: tooth };
      } else {
        // Create a new row for this tooth
        newProcedures.push({ code: '', service_description: '', tooth_number: tooth, cost: '' });
      }
    });

    // Ensure at least one row exists
    if (newProcedures.length === 0) {
      newProcedures.push({ code: '', service_description: '', tooth_number: '', cost: '' });
    }

    setProcedures(newProcedures);
    
    // Set active index to the first row with a newly added tooth
    if (newTeeth.length > 0) {
      const firstNewToothIndex = newProcedures.findIndex(p => p.tooth_number === newTeeth[0]);
      if (firstNewToothIndex !== -1) {
        setActiveProcedureIndex(firstNewToothIndex);
      }
    }
  };

  // Get selected teeth from procedures
  const getSelectedTeeth = () => {
    return procedures
      .filter(p => p.tooth_number)
      .map(p => p.tooth_number.toString());
  };

  const removeProcedure = (index) => {
    if (procedures.length > 1) {
      setProcedures(procedures.filter((_, i) => i !== index));
    }
  };

  const handleMedicationChange = (index, field, value) => {
    const newMedications = [...medications];
    newMedications[index][field] = value;
    setMedications(newMedications);
  };

  const addMedication = () => {
    setMedications([...medications, { medication_name: '', type: '', quantity: '' }]);
  };

  const removeMedication = (index) => {
    if (medications.length > 1) {
      setMedications(medications.filter((_, i) => i !== index));
    }
  };

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    
    // Validate form before submission
    if (!validateForm()) {
      alert('Please fill in all required fields correctly.');
      // Switch to first tab with error
      const errorFields = Object.keys(errors);
      if (errorFields.length > 0) {
        const firstErrorTab = getFieldTab(errorFields[0]);
        setActiveTab(firstErrorTab);
      }
      return;
    }
    
    try {
      setSaving(true);
      const dataToSubmit = {
        ...formData,
        procedures: procedures.filter(p => p.code || p.service_description),
        medications: medications.filter(m => m.medication_name)
      };

      if (isEditMode) {
        await api.updateDentalApproval(id, dataToSubmit);
        alert('Dental form updated successfully!');
      } else {
        await api.createDentalApproval(dataToSubmit);
        alert('Dental form created successfully!');
      }
      
      navigate('/dental-approvals');
    } catch (error) {
      console.error('Error saving form:', error);
      const errorMessage = error?.response?.data?.error || error?.message || 'Error saving form';
      alert(errorMessage);
    } finally {
      setSaving(false);
    }
  };

  const tabs = [
    { id: 'reception', label: 'Reception/Nurse', icon: FileText },
    { id: 'insured', label: 'Insured Info', icon: User },
    { id: 'dentist', label: 'Dentist Section', icon: Stethoscope },
    { id: 'procedures', label: 'Procedures & Medications', icon: Pill }
  ];

  const handleNextTab = () => {
    const currentIndex = tabs.findIndex(tab => tab.id === activeTab);
    if (currentIndex < tabs.length - 1) {
      setActiveTab(tabs[currentIndex + 1].id);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handlePreviousTab = () => {
    const currentIndex = tabs.findIndex(tab => tab.id === activeTab);
    if (currentIndex > 0) {
      setActiveTab(tabs[currentIndex - 1].id);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const isLastTab = () => {
    const currentIndex = tabs.findIndex(tab => tab.id === activeTab);
    return currentIndex === tabs.length - 1;
  };

  const isFirstTab = () => {
    const currentIndex = tabs.findIndex(tab => tab.id === activeTab);
    return currentIndex === 0;
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

  // Create patient/provider/insurer options for react-select
  const patientOptions = patients.map(p => ({ value: p.patient_id, label: p.name }));
  const providerOptions = providers.map(p => ({ value: p.provider_id, label: p.provider_name }));
  const insurerOptions = insurers.map(i => ({ value: i.insurer_id, label: i.insurer_name }));

  return (
    <div className="mx-auto space-y-10 px-8 pt-8 pb-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" onClick={() => navigate('/dental-approvals')} size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {isEditMode ? 'Edit Dental Form' : 'New Dental Form'}
            </h1>
            <p className="text-sm text-gray-500 mt-1">Dental Approvals and Claims Application</p>
          </div>
        </div>
        <Button onClick={handleSubmit} disabled={saving} className="bg-gradient-to-r from-primary-purple to-accent-purple">
          <Save className="h-4 w-4 mr-2" />
          {saving ? 'Saving...' : 'Save'}
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
      <form onSubmit={handleSubmit}>
        <Card>
          <CardContent className="p-10">
            {/* Tab 1: Reception/Nurse */}
            {activeTab === 'reception' && (
              <div className="space-y-10">
                <div className="border-b border-gray-200 pb-8">
                  <h3 className="text-lg font-semibold mb-8 text-gray-800">To be completed & ID verified by the reception/nurse</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <div className="space-y-2">
                      <Label className="text-xs text-gray-600">Provider Name <span className="text-red-500">*</span></Label>
                      <Input
                        value={formData.provider_name}
                        onChange={(e) => handleInputChange('provider_name', e.target.value)}
                        onBlur={() => handleBlur('provider_name')}
                        placeholder="Enter provider name"
                        className={errors.provider_name ? 'border-red-500' : ''}
                      />
                      {errors.provider_name && (
                        <p className="text-xs text-red-500 mt-1">{errors.provider_name}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs text-gray-600">Insurance Company Name <span className="text-red-500">*</span></Label>
                      <Input
                        value={formData.insurance_company_name}
                        onChange={(e) => handleInputChange('insurance_company_name', e.target.value)}
                        onBlur={() => handleBlur('insurance_company_name')}
                        placeholder="Enter insurance company"
                        className={errors.insurance_company_name ? 'border-red-500' : ''}
                      />
                      {errors.insurance_company_name && (
                        <p className="text-xs text-red-500 mt-1">{errors.insurance_company_name}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs text-gray-600">TPA Company Name</Label>
                      <Input
                        value={formData.tpa_company_name}
                        onChange={(e) => handleInputChange('tpa_company_name', e.target.value)}
                        placeholder="Enter TPA company"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs text-gray-600">Patient File Number</Label>
                      <Input
                        value={formData.patient_file_number}
                        onChange={(e) => handleInputChange('patient_file_number', e.target.value)}
                        placeholder="Enter file number"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs text-gray-600">Date of Visit <span className="text-red-500">*</span></Label>
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
                      {errors.date_of_visit && (
                        <p className="text-xs text-red-500 mt-1">{errors.date_of_visit}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs text-gray-600">Plan Type</Label>
                      <Input
                        value={formData.plan_type}
                        onChange={(e) => handleInputChange('plan_type', e.target.value)}
                        placeholder="Enter plan type"
                      />
                    </div>
                  </div>
                  <div className="mt-6 flex gap-6">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.new_visit}
                        onChange={(e) => handleCheckboxChange('new_visit', e.target.checked)}
                        className="w-4 h-4 text-primary-purple border-gray-300 rounded focus:ring-primary-purple"
                      />
                      <span className="text-sm text-gray-700">New Visit</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.follow_up}
                        onChange={(e) => handleCheckboxChange('follow_up', e.target.checked)}
                        className="w-4 h-4 text-primary-purple border-gray-300 rounded focus:ring-primary-purple"
                      />
                      <span className="text-sm text-gray-700">Follow Up</span>
                    </label>
                  </div>
                </div>

                {/* Related Records */}
                <div className="border-b border-gray-200 pb-8">
                  <h3 className="text-lg font-semibold mb-8 text-gray-800">Related Records</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <div className="space-y-2">
                      <Label className="text-xs text-gray-600">Patient</Label>
                      <Select
                        value={patientOptions.find(opt => opt.value === formData.patient_id)}
                        onChange={(option) => handleSelectChange('patient_id', option)}
                        options={patientOptions}
                        placeholder="Select patient..."
                        isClearable
                        styles={selectStyles}
                        menuPortalTarget={document.body}
                        menuPosition="fixed"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs text-gray-600">Provider</Label>
                      <Select
                        value={providerOptions.find(opt => opt.value === formData.provider_id)}
                        onChange={(option) => handleSelectChange('provider_id', option)}
                        options={providerOptions}
                        placeholder="Select provider..."
                        isClearable
                        styles={selectStyles}
                        menuPortalTarget={document.body}
                        menuPosition="fixed"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs text-gray-600">Insurer</Label>
                      <Select
                        value={insurerOptions.find(opt => opt.value === formData.insurer_id)}
                        onChange={(option) => handleSelectChange('insurer_id', option)}
                        options={insurerOptions}
                        placeholder="Select insurer..."
                        isClearable
                        styles={selectStyles}
                        menuPortalTarget={document.body}
                        menuPosition="fixed"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs text-gray-600">Status</Label>
                      <Select
                        value={statusOptions.find(opt => opt.value === formData.status)}
                        onChange={(option) => handleSelectChange('status', option)}
                        options={statusOptions}
                        placeholder="Select status..."
                        styles={selectStyles}
                        menuPortalTarget={document.body}
                        menuPosition="fixed"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Tab 2: Insured Information */}
            {activeTab === 'insured' && (
              <div className="space-y-10">
                <div className="border-b border-gray-200 pb-8">
                  <h3 className="text-lg font-semibold mb-8 text-gray-800">Print/Fill in letters or Emboss Card</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <div className="space-y-2">
                      <Label className="text-xs text-gray-600">Insured Name <span className="text-red-500">*</span></Label>
                      <Input
                        value={formData.insured_name}
                        onChange={(e) => handleInputChange('insured_name', e.target.value)}
                        onBlur={() => handleBlur('insured_name')}
                        placeholder="Enter insured name"
                        className={errors.insured_name ? 'border-red-500' : ''}
                      />
                      {errors.insured_name && (
                        <p className="text-xs text-red-500 mt-1">{errors.insured_name}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs text-gray-600">ID Card No. <span className="text-red-500">*</span></Label>
                      <Input
                        value={formData.id_card_number}
                        onChange={(e) => handleInputChange('id_card_number', e.target.value)}
                        onBlur={() => handleBlur('id_card_number')}
                        placeholder="Enter ID card number"
                        className={errors.id_card_number ? 'border-red-500' : ''}
                      />
                      {errors.id_card_number && (
                        <p className="text-xs text-red-500 mt-1">{errors.id_card_number}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs text-gray-600">Sex <span className="text-red-500">*</span></Label>
                      <Select
                        value={sexOptions.find(opt => opt.value === formData.sex)}
                        onChange={(option) => handleSelectChange('sex', option)}
                        onBlur={() => handleBlur('sex')}
                        options={sexOptions}
                        placeholder="Select sex..."
                        isClearable
                        styles={selectStyles}
                        menuPortalTarget={document.body}
                        menuPosition="fixed"
                      />
                      {errors.sex && (
                        <p className="text-xs text-red-500 mt-1">{errors.sex}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs text-gray-600">Age <span className="text-red-500">*</span></Label>
                      <Input
                        type="number"
                        value={formData.age}
                        onChange={(e) => handleInputChange('age', e.target.value)}
                        onBlur={() => handleBlur('age')}
                        placeholder="Enter age"
                        className={errors.age ? 'border-red-500' : ''}
                      />
                      {errors.age && (
                        <p className="text-xs text-red-500 mt-1">{errors.age}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs text-gray-600">Policy Holder</Label>
                      <Input
                        value={formData.policy_holder}
                        onChange={(e) => handleInputChange('policy_holder', e.target.value)}
                        placeholder="Enter policy holder"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs text-gray-600">Policy No</Label>
                      <Input
                        value={formData.policy_number}
                        onChange={(e) => handleInputChange('policy_number', e.target.value)}
                        placeholder="Enter policy number"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs text-gray-600">Expiry Date</Label>
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
                    <div className="space-y-2">
                      <Label className="text-xs text-gray-600">Class</Label>
                      <Input
                        value={formData.class}
                        onChange={(e) => handleInputChange('class', e.target.value)}
                        placeholder="Enter class"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Tab 3: Dentist Section */}
            {activeTab === 'dentist' && (
              <div className="space-y-10">
                <div className="border-b border-gray-200 pb-8">
                  <h3 className="text-lg font-semibold mb-8 text-gray-800">To be completed by the Dentist</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <div className="space-y-2">
                      <Label className="text-xs text-gray-600">Duration of Illness (Days)</Label>
                      <Input
                        type="number"
                        value={formData.duration_of_illness_days}
                        onChange={(e) => handleInputChange('duration_of_illness_days', e.target.value)}
                        placeholder="Enter duration"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs text-gray-600">Diagnosis (ICD10)</Label>
                      <Input
                        value={formData.diagnosis_icd10}
                        onChange={(e) => handleInputChange('diagnosis_icd10', e.target.value)}
                        placeholder="Enter ICD10 code"
                      />
                    </div>
                  </div>
                </div>

                <div className="border-b border-gray-200 pb-8">
                  <div className="space-y-6">
                    <div className="space-y-2">
                      <Label className="text-xs text-gray-600">Chief Complaint & Main symptoms</Label>
                      <textarea
                        value={formData.chief_complaints}
                        onChange={(e) => handleInputChange('chief_complaints', e.target.value)}
                        rows="3"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                        placeholder="Enter chief complaints..."
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs text-gray-600">Significant Signs</Label>
                      <textarea
                        value={formData.significant_signs}
                        onChange={(e) => handleInputChange('significant_signs', e.target.value)}
                        rows="3"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                        placeholder="Enter significant signs..."
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs text-gray-600">Primary Diagnosis</Label>
                      <textarea
                        value={formData.primary_diagnosis}
                        onChange={(e) => handleInputChange('primary_diagnosis', e.target.value)}
                        rows="2"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                        placeholder="Enter primary diagnosis..."
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs text-gray-600">Secondary Diagnosis</Label>
                      <textarea
                        value={formData.secondary_diagnosis}
                        onChange={(e) => handleInputChange('secondary_diagnosis', e.target.value)}
                        rows="2"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                        placeholder="Enter secondary diagnosis..."
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs text-gray-600">Other Conditions</Label>
                      <textarea
                        value={formData.other_conditions}
                        onChange={(e) => handleInputChange('other_conditions', e.target.value)}
                        rows="2"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                        placeholder="Enter other conditions..."
                      />
                    </div>
                  </div>
                </div>

                {/* Treatment Type */}
                <div className="border-b border-gray-200 pb-8">
                  <h3 className="text-lg font-semibold mb-6 text-gray-800">Please tick where appropriate:</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.regular_dental_treatment}
                        onChange={(e) => handleCheckboxChange('regular_dental_treatment', e.target.checked)}
                        className="w-4 h-4 text-primary-purple border-gray-300 rounded focus:ring-primary-purple"
                      />
                      <span className="text-sm text-gray-700">Regular Dental Treatment</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.dental_cleaning}
                        onChange={(e) => handleCheckboxChange('dental_cleaning', e.target.checked)}
                        className="w-4 h-4 text-primary-purple border-gray-300 rounded focus:ring-primary-purple"
                      />
                      <span className="text-sm text-gray-700">Dental Cleaning</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.trauma_treatment}
                        onChange={(e) => handleCheckboxChange('trauma_treatment', e.target.checked)}
                        className="w-4 h-4 text-primary-purple border-gray-300 rounded focus:ring-primary-purple"
                      />
                      <span className="text-sm text-gray-700">Trauma Treatment Specify: RTA</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.work_related}
                        onChange={(e) => handleCheckboxChange('work_related', e.target.checked)}
                        className="w-4 h-4 text-primary-purple border-gray-300 rounded focus:ring-primary-purple"
                      />
                      <span className="text-sm text-gray-700">Work Related</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.other_treatment}
                        onChange={(e) => handleCheckboxChange('other_treatment', e.target.checked)}
                        className="w-4 h-4 text-primary-purple border-gray-300 rounded focus:ring-primary-purple"
                      />
                      <span className="text-sm text-gray-700">Other</span>
                    </label>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
                    <div className="space-y-2">
                      <Label className="text-xs text-gray-600">How:</Label>
                      <Input
                        value={formData.treatment_how}
                        onChange={(e) => handleInputChange('treatment_how', e.target.value)}
                        placeholder="How"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs text-gray-600">When:</Label>
                      <Input
                        value={formData.treatment_when}
                        onChange={(e) => handleInputChange('treatment_when', e.target.value)}
                        placeholder="When"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs text-gray-600">Where:</Label>
                      <Input
                        value={formData.treatment_where}
                        onChange={(e) => handleInputChange('treatment_where', e.target.value)}
                        placeholder="Where"
                      />
                    </div>
                  </div>
                </div>

                {/* Provider Approval */}
                <div className="border-b border-gray-200 pb-8">
                  <h3 className="text-lg font-semibold mb-6 text-gray-800">Providers Approval/Coding Staff</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="space-y-2">
                      <Label className="text-xs text-gray-600">Completed/Coded BY</Label>
                      <Input
                        value={formData.completed_coded_by}
                        onChange={(e) => handleInputChange('completed_coded_by', e.target.value)}
                        placeholder="Enter name"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs text-gray-600">Signature</Label>
                      <Input
                        value={formData.provider_signature}
                        onChange={(e) => handleInputChange('provider_signature', e.target.value)}
                        placeholder="Enter signature"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs text-gray-600">Date</Label>
                      <div className="relative">
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
              </div>
            )}

            {/* Tab 4: Procedures & Medications */}
            {activeTab === 'procedures' && (
              <div className="space-y-10">
                {/* Interactive Dental Chart */}
                <div className="border-b border-gray-200 pb-8">
                  <h3 className="text-lg font-semibold mb-6 text-gray-800">Interactive Dental Chart</h3>
                  <DentalChart
                    selectedTeeth={getSelectedTeeth()}
                    onToothClick={handleToothClick}
                    mode="select"
                  />
                </div>

                {/* Procedures */}
                <div className="border-b border-gray-200 pb-8">
                  <div className="flex justify-between items-center mb-6">
                    <h3 className="text-lg font-semibold text-gray-800">Specify The recommended procedures using the tooth number</h3>
                    <Button type="button" onClick={addProcedure} size="sm" variant="outline">
                      <Plus className="h-4 w-4 mr-2" />
                      Add Procedure
                    </Button>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="border-b bg-gray-50">
                          <th className="text-left p-3 text-xs font-semibold text-gray-600">Code</th>
                          <th className="text-left p-3 text-xs font-semibold text-gray-600">Dental / Service</th>
                          <th className="text-left p-3 text-xs font-semibold text-gray-600">Tooth No.</th>
                          <th className="text-left p-3 text-xs font-semibold text-gray-600">Cost</th>
                          <th className="text-left p-3 text-xs font-semibold text-gray-600">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {procedures.map((proc, index) => (
                          <tr 
                            key={index} 
                            className={`border-b transition-colors ${
                              activeProcedureIndex === index 
                                ? 'bg-purple-50 ring-2 ring-primary-purple ring-inset' 
                                : 'hover:bg-gray-50'
                            }`}
                            onClick={() => setActiveProcedureIndex(index)}
                          >
                            <td className="p-2">
                              <Input
                                value={proc.code}
                                onChange={(e) => handleProcedureChange(index, 'code', e.target.value)}
                                onFocus={() => setActiveProcedureIndex(index)}
                                placeholder="Code"
                                className="text-sm"
                              />
                            </td>
                            <td className="p-2">
                              <Input
                                value={proc.service_description}
                                onChange={(e) => handleProcedureChange(index, 'service_description', e.target.value)}
                                onFocus={() => setActiveProcedureIndex(index)}
                                placeholder="Service Description"
                                className="text-sm"
                              />
                            </td>
                            <td className="p-2">
                              <div className="flex items-center gap-2">
                                <Input
                                  value={proc.tooth_number}
                                  onChange={(e) => handleProcedureChange(index, 'tooth_number', e.target.value)}
                                  onFocus={() => setActiveProcedureIndex(index)}
                                  placeholder="Click tooth above"
                                  className={`text-sm ${activeProcedureIndex === index ? 'border-primary-purple' : ''}`}
                                />
                                {activeProcedureIndex === index && (
                                  <span className="text-xs text-primary-purple whitespace-nowrap">← Active</span>
                                )}
                              </div>
                            </td>
                            <td className="p-2">
                              <Input
                                type="number"
                                step="0.01"
                                value={proc.cost}
                                onChange={(e) => handleProcedureChange(index, 'cost', e.target.value)}
                                onFocus={() => setActiveProcedureIndex(index)}
                                placeholder="Cost"
                                className="text-sm"
                              />
                            </td>
                            <td className="p-2">
                              <Button
                                type="button"
                                variant="destructive"
                                size="sm"
                                onClick={() => removeProcedure(index)}
                                disabled={procedures.length === 1}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Medications */}
                <div className="border-b border-gray-200 pb-8">
                  <div className="flex justify-between items-center mb-6">
                    <h3 className="text-lg font-semibold text-gray-800">Medication Name (Generic Name)</h3>
                    <Button type="button" onClick={addMedication} size="sm" variant="outline">
                      <Plus className="h-4 w-4 mr-2" />
                      Add Medication
                    </Button>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="border-b bg-gray-50">
                          <th className="text-left p-3 text-xs font-semibold text-gray-600">Medication Name (Generic Name)</th>
                          <th className="text-left p-3 text-xs font-semibold text-gray-600">Type</th>
                          <th className="text-left p-3 text-xs font-semibold text-gray-600">Quantity</th>
                          <th className="text-left p-3 text-xs font-semibold text-gray-600">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {medications.map((med, index) => (
                          <tr key={index} className="border-b">
                            <td className="p-2">
                              <Input
                                value={med.medication_name}
                                onChange={(e) => handleMedicationChange(index, 'medication_name', e.target.value)}
                                placeholder="Medication Name"
                                className="text-sm"
                              />
                            </td>
                            <td className="p-2">
                              <Input
                                value={med.type}
                                onChange={(e) => handleMedicationChange(index, 'type', e.target.value)}
                                placeholder="Type"
                                className="text-sm"
                              />
                            </td>
                            <td className="p-2">
                              <Input
                                type="number"
                                value={med.quantity}
                                onChange={(e) => handleMedicationChange(index, 'quantity', e.target.value)}
                                placeholder="Quantity"
                                className="text-sm"
                              />
                            </td>
                            <td className="p-2">
                              <Button
                                type="button"
                                variant="destructive"
                                size="sm"
                                onClick={() => removeMedication(index)}
                                disabled={medications.length === 1}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* Navigation Buttons */}
            <div className="flex justify-between items-center pt-8 border-t border-gray-200 mt-10">
              <Button
                type="button"
                variant="outline"
                onClick={handlePreviousTab}
                disabled={isFirstTab()}
                className="min-w-[120px]"
              >
                <ChevronLeft className="h-4 w-4 mr-2" />
                Previous
              </Button>

              <div className="text-sm text-gray-500">
                Step {tabs.findIndex(tab => tab.id === activeTab) + 1} of {tabs.length}
              </div>

              {isLastTab() ? (
                <Button
                  type="button"
                  onClick={handleSubmit}
                  disabled={saving}
                  className="bg-gradient-to-r from-primary-purple to-accent-purple min-w-[120px]"
                >
                  <Save className="h-4 w-4 mr-2" />
                  {saving ? 'Saving...' : 'Save'}
                </Button>
              ) : (
                <Button
                  type="button"
                  onClick={handleNextTab}
                  className="bg-gradient-to-r from-primary-purple to-accent-purple min-w-[120px]"
                >
                  Next
                  <ChevronRight className="h-4 w-4 ml-2" />
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  );
}
