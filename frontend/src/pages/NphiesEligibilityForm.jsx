import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Shield, CheckCircle, XCircle, AlertCircle, Info, FileText, ChevronDown, ChevronUp, Baby, ArrowRightLeft, User, Building, CreditCard, Search, Calendar, Eye, ArrowLeft, Copy } from 'lucide-react';
import DatePicker from 'react-datepicker';
import Select from 'react-select';
import 'react-datepicker/dist/react-datepicker.css';
import api from '@/services/api';

// Custom CSS for DatePicker to fix selected date visibility
const datePickerStyles = `
  .react-datepicker__day--selected,
  .react-datepicker__day--keyboard-selected {
    background-color: #553781 !important;
    color: white !important;
  }
  .react-datepicker__day--selected:hover,
  .react-datepicker__day--keyboard-selected:hover {
    background-color: #452d6b !important;
    color: white !important;
  }
  .react-datepicker__day:hover {
    background-color: #f3f4f6 !important;
  }
  .react-datepicker__day--today {
    font-weight: bold;
    border: 1px solid #553781;
  }
  .react-datepicker-wrapper {
    width: 100%;
  }
  .datepicker-wrapper {
    position: relative;
    width: 100%;
  }
  .datepicker-wrapper .datepicker-icon {
    position: absolute;
    left: 12px;
    top: 50%;
    transform: translateY(-50%);
    color: #9ca3af;
    pointer-events: none;
    z-index: 1;
  }
  .datepicker-wrapper input {
    padding-left: 36px !important;
  }
`;

// Select styles matching PatientInfoStep
const selectStyles = {
  control: (base, state) => ({
    ...base,
    minHeight: '42px',
    borderColor: '#e5e7eb',
    borderRadius: '4px',
    backgroundColor: state.isDisabled ? '#f3f4f6' : 'white',
    paddingLeft: '0.25rem',
    paddingRight: '0.25rem',
    boxShadow: state.isFocused ? '0 0 0 2px rgba(85, 55, 129, 0.3)' : 'none',
    borderWidth: '1px',
    cursor: state.isDisabled ? 'not-allowed' : 'default',
    '&:hover': {
      borderColor: '#e5e7eb'
    }
  }),
  option: (base, { isFocused, isSelected }) => ({
    ...base,
    backgroundColor: isSelected ? '#553781' : isFocused ? '#f3f4f6' : 'white',
    color: isSelected ? 'white' : '#374151',
    cursor: 'pointer',
    padding: '8px 12px'
  }),
  menu: (base) => ({ 
    ...base, 
    zIndex: 9999,
    position: 'absolute'
  }),
  menuPortal: (base) => ({ 
    ...base, 
    zIndex: 9999 
  })
};

// Options for dropdowns
const GENDER_OPTIONS = [
  { value: 'female', label: 'Female' },
  { value: 'male', label: 'Male' },
  { value: 'C', label: 'C - Not Completed' },
  { value: 'A', label: 'A - Sex changed to Male' },
  { value: 'U', label: 'U - Undetermined' },
  { value: 'unknown', label: 'unknown' },
  { value: 'N', label: 'N - Undifferentiated' },
  { value: 'B', label: 'B - Sex changed to female' }
];

const IDENTIFIER_TYPE_OPTIONS = [
  { value: 'national_id', label: 'NI - National Identifier' },
  { value: 'iqama', label: 'PRC - Permanent Resident Card (Iqama)' },
  { value: 'passport', label: 'PPN - Passport Number' },
  { value: 'mrn', label: 'MR - Medical Record Number' },
  { value: 'border_number', label: 'BN - Border Number' },
  { value: 'displaced_person', label: 'DP - Displaced Person' },
  { value: 'visitor_permit', label: 'VP - Visitor Permit' }
];

const COVERAGE_TYPE_OPTIONS = [
  { value: 'EHCPOL', label: 'Extended Healthcare (EHCPOL)' },
  { value: 'PUBLICPOL', label: 'Public Policy (PUBLICPOL)' },
  { value: 'DENTAL', label: 'Dental (DENTAL)' },
  { value: 'MENTPOL', label: 'Mental Health (MENTPOL)' },
  { value: 'DRUGPOL', label: 'Drug Coverage (DRUGPOL)' }
];

const RELATIONSHIP_OPTIONS = [
  { value: 'self', label: 'Self' },
  { value: 'spouse', label: 'Spouse' },
  { value: 'child', label: 'Child' },
  { value: 'parent', label: 'Parent' },
  { value: 'other', label: 'Other' }
];

// Required field indicator component
const RequiredFieldIndicator = () => (
  <span className="text-red-500 ml-1">*</span>
);

export default function NphiesEligibilityForm() {
  const navigate = useNavigate();
  
  // Input mode toggles
  const [patientMode, setPatientMode] = useState('existing'); // 'existing' | 'manual'
  const [providerMode, setProviderMode] = useState('existing'); // 'existing' | 'manual'
  const [insurerMode, setInsurerMode] = useState('existing'); // 'existing' | 'manual'
  const [coverageMode, setCoverageMode] = useState('existing'); // 'existing' | 'manual' | 'discovery'

  // Existing records data
  const [patients, setPatients] = useState([]);
  const [providers, setProviders] = useState([]);
  const [insurers, setInsurers] = useState([]);
  const [coverages, setCoverages] = useState([]);
  
  // Selected IDs for existing records
  const [selectedPatient, setSelectedPatient] = useState('');
  const [selectedProvider, setSelectedProvider] = useState('');
  const [selectedInsurer, setSelectedInsurer] = useState('');
  const [selectedCoverage, setSelectedCoverage] = useState('');
  
  // Manual entry data for Patient
  const [patientData, setPatientData] = useState({
    name: '',
    identifier: '',
    identifierType: 'national_id',
    gender: '',
    birthDate: '',
    phone: '',
    email: ''
  });

  // Manual entry data for Provider
  const [providerData, setProviderData] = useState({
    name: '',
    nphiesId: '',
    locationLicense: 'GACH'
  });

  // Manual entry data for Insurer
  const [insurerData, setInsurerData] = useState({
    name: '',
    nphiesId: ''
  });

  // Manual entry data for Coverage
  const [coverageData, setCoverageData] = useState({
    memberId: '',
    coverageType: 'EHCPOL',
    planName: '',
    relationship: 'self',
    network: ''
  });

  // Request options
  const [selectedPurpose, setSelectedPurpose] = useState(['benefits', 'validation']);
  const [servicedDate, setServicedDate] = useState(new Date());
  
  // NPHIES Extension flags
  const [isNewborn, setIsNewborn] = useState(false);
  const [isTransfer, setIsTransfer] = useState(false);
  
  // Mother patient state (for newborn requests)
  const [motherPatientMode, setMotherPatientMode] = useState('existing'); // 'existing' | 'manual'
  const [selectedMotherPatient, setSelectedMotherPatient] = useState('');
  const [selectedMotherPatientDetails, setSelectedMotherPatientDetails] = useState(null); // Store full patient details when selected
  const [motherPatientData, setMotherPatientData] = useState({
    name: '',
    identifier: '',
    identifierType: 'iqama',
    gender: '',
    birthDate: '',
    phone: '',
    email: ''
  });
  
  // UI state
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [showRawData, setShowRawData] = useState(false);
  
  // Preview state
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewData, setPreviewData] = useState(null);
  const [showPreview, setShowPreview] = useState(false);

  // Date helpers
  const parseDate = (dateString) => {
    if (!dateString) return null;
    return new Date(dateString);
  };

  const formatDate = (date) => {
    if (!date) return '';
    return date.toISOString().split('T')[0];
  };

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    if (selectedPatient && patientMode === 'existing') {
      loadPatientCoverages(selectedPatient);
    } else {
      // Load all coverages when no patient is selected or in manual patient mode
      loadAllCoverages();
    }
  }, [selectedPatient, patientMode]);

  // Update selected mother patient details when selection changes
  useEffect(() => {
    if (selectedMotherPatient && motherPatientMode === 'existing') {
      const patient = patients.find(p => p.patient_id === selectedMotherPatient);
      setSelectedMotherPatientDetails(patient || null);
    } else {
      setSelectedMotherPatientDetails(null);
    }
  }, [selectedMotherPatient, motherPatientMode, patients]);

  const loadInitialData = async () => {
    try {
      setLoadingData(true);
      const [patientsRes, providersRes, insurersRes] = await Promise.all([
        api.getPatients({ limit: 100 }),
        api.getProviders({ limit: 100 }),
        api.getInsurers({ limit: 100 })
      ]);

      setPatients(patientsRes.data || []);
      setProviders(providersRes.data || []);
      setInsurers(insurersRes.data || []);
    } catch (err) {
      console.error('Error loading data:', err);
      setError('Failed to load initial data');
    } finally {
      setLoadingData(false);
    }
  };

  const loadPatientCoverages = async (patientId) => {
    try {
      const res = await api.getPatientCoverages(patientId);
      setCoverages(res.data || []);
      
      // Auto-select first coverage if available
      if (res.data && res.data.length > 0) {
        setSelectedCoverage(res.data[0].coverage_id.toString());
      }
    } catch (err) {
      console.error('Error loading coverages:', err);
      setCoverages([]);
    }
  };

  const loadAllCoverages = async () => {
    try {
      const res = await api.getCoverages({ limit: 100 });
      setCoverages(res.data || []);
    } catch (err) {
      console.error('Error loading all coverages:', err);
      setCoverages([]);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validate based on input modes
    if (patientMode === 'existing' && !selectedPatient) {
      setError('Please select a patient');
      return;
    }
    if (patientMode === 'manual' && !patientData.identifier) {
      setError('Please enter patient identifier');
      return;
    }

    // Validate mother patient for newborn requests
    if (isNewborn) {
      if (motherPatientMode === 'existing' && !selectedMotherPatient) {
        setError('Please select mother patient for newborn request');
        return;
      }
      if (motherPatientMode === 'manual' && !motherPatientData.identifier) {
        setError('Please enter mother Iqama number for newborn request');
        return;
      }
    }

    if (insurerMode === 'existing' && !selectedInsurer) {
      setError('Please select an insurer');
      return;
    }
    if (insurerMode === 'manual' && !insurerData.nphiesId) {
      setError('Please enter insurer NPHIES ID');
      return;
    }

    // Provider validation
    if (providerMode === 'existing' && !selectedProvider) {
      setError('Please select a provider');
      return;
    }
    if (providerMode === 'manual' && !providerData.nphiesId) {
      setError('Please enter provider NPHIES ID');
      return;
    }

    // Coverage validation (not required for discovery mode or manual mode)
    if (coverageMode === 'existing' && !selectedCoverage) {
      setError('Please select a coverage');
      return;
    }

    if (selectedPurpose.length === 0) {
      setError('Please select at least one purpose');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      // Build request data based on input modes
      const requestData = {
        // Patient
        ...(patientMode === 'existing' 
          ? { patientId: selectedPatient }
          : { patientData: { ...patientData, birthDate: patientData.birthDate } }
        ),
        // Mother Patient (for newborn requests)
        ...(isNewborn && (motherPatientMode === 'existing'
          ? { motherPatientId: selectedMotherPatient }
          : { motherPatientData: { ...motherPatientData, birthDate: motherPatientData.birthDate, identifierType: 'iqama' } }
        )),
        // Provider
        ...(providerMode === 'existing'
          ? { providerId: selectedProvider }
          : { providerData }
        ),
        // Insurer
        ...(insurerMode === 'existing'
          ? { insurerId: selectedInsurer }
          : { insurerData }
        ),
        // Coverage (null for discovery mode)
        ...(coverageMode === 'existing' && selectedCoverage
          ? { coverageId: selectedCoverage }
          : coverageMode === 'manual'
          ? { coverageData }
          : {} // Discovery mode - no coverage
        ),
        // Options
        purpose: selectedPurpose,
        servicedDate: formatDate(servicedDate),
        isNewborn,
        isTransfer
      };

      console.log('Submitting dynamic eligibility request:', requestData);
      
      // Use the dynamic endpoint
      const response = await api.checkDynamicEligibility(requestData);
      
      console.log('Response received from NPHIES:', response);
      setResult(response);
      
      // Navigate to details page if we have an eligibilityId (even if outcome is "error")
      // The eligibilityId means the request was processed and saved
      if (response.eligibilityId) {
        navigate(`/nphies-eligibility/${response.eligibilityId}`);
      } else if (!response.success && !response.apiSuccess) {
        // Only show error if the API call itself failed (no eligibilityId)
        setError(response.error || 'Eligibility check failed');
      }
    } catch (err) {
      console.error('Error checking eligibility:', err);
      setError(err.message || 'Failed to check eligibility');
    } finally {
      setLoading(false);
    }
  };

  const handlePurposeToggle = (purpose) => {
    setSelectedPurpose(prev => {
      if (prev.includes(purpose)) {
        return prev.filter(p => p !== purpose);
      } else {
        return [...prev, purpose];
      }
    });
  };

  // Helper function to remove empty/null/undefined values from an object
  const removeEmptyFields = (obj) => {
    if (obj === null || obj === undefined) return undefined;
    if (typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) {
      const filtered = obj.filter(item => item !== null && item !== undefined && item !== '');
      return filtered.length > 0 ? filtered : undefined;
    }
    
    const cleaned = {};
    for (const [key, value] of Object.entries(obj)) {
      if (value === null || value === undefined || value === '') continue;
      if (typeof value === 'object' && !Array.isArray(value)) {
        const cleanedValue = removeEmptyFields(value);
        if (cleanedValue !== undefined && Object.keys(cleanedValue).length > 0) {
          cleaned[key] = cleanedValue;
        }
      } else if (Array.isArray(value)) {
        const cleanedArray = removeEmptyFields(value);
        if (cleanedArray !== undefined) {
          cleaned[key] = cleanedArray;
        }
      } else {
        cleaned[key] = value;
      }
    }
    return Object.keys(cleaned).length > 0 ? cleaned : undefined;
  };

  // Preview the FHIR bundle without sending to NPHIES (no validation)
  // Only includes fields that are actually filled - no placeholders, no empty fields
  const handlePreview = async () => {
    setPreviewLoading(true);
    setError(null);

    try {
      // Build request data, only including non-empty fields
      const requestData = {
        // Patient - only include if there's actual data
        ...(patientMode === 'existing' && selectedPatient
          ? { patientId: selectedPatient }
          : patientMode === 'manual' 
          ? { patientData: removeEmptyFields(patientData) }
          : {}
        ),
        // Mother Patient (for newborn) - only include if newborn is checked and there's data
        ...(isNewborn && (motherPatientMode === 'existing' && selectedMotherPatient
          ? { motherPatientId: selectedMotherPatient }
          : motherPatientMode === 'manual' && motherPatientData.identifier
          ? { motherPatientData: removeEmptyFields({ ...motherPatientData, identifierType: 'iqama' }) }
          : {}
        )),
        // Provider - only include if there's actual data
        ...(providerMode === 'existing' && selectedProvider
          ? { providerId: selectedProvider }
          : providerMode === 'manual' && providerData.nphiesId
          ? { providerData: removeEmptyFields(providerData) }
          : {}
        ),
        // Insurer - only include if there's actual data
        ...(insurerMode === 'existing' && selectedInsurer
          ? { insurerId: selectedInsurer }
          : insurerMode === 'manual' && insurerData.nphiesId
          ? { insurerData: removeEmptyFields(insurerData) }
          : {}
        ),
        // Coverage - only include if there's actual data (not in discovery mode)
        ...(coverageMode === 'existing' && selectedCoverage
          ? { coverageId: selectedCoverage }
          : coverageMode === 'manual' && (coverageData.memberId || coverageData.policyNumber)
          ? { coverageData: removeEmptyFields(coverageData) }
          : {}
        ),
        // Purpose - only include if selected
        ...(selectedPurpose.length > 0 ? { purpose: selectedPurpose } : {}),
        // Service date - only include if set
        ...(servicedDate ? { servicedDate: formatDate(servicedDate) } : {}),
        // Extensions - only include if true
        ...(isNewborn ? { isNewborn: true } : {}),
        ...(isTransfer ? { isTransfer: true } : {}),
        // Tell backend this is preview mode - skip validation, only include filled fields
        partialMode: true
      };

      // Remove any undefined values at the top level
      const cleanedRequestData = removeEmptyFields(requestData) || {};

      const response = await api.previewEligibilityRequest(cleanedRequestData);
      setPreviewData(response);
      setShowPreview(true);
    } catch (err) {
      console.error('Error generating preview:', err);
      setError(err.message || 'Failed to generate preview');
    } finally {
      setPreviewLoading(false);
    }
  };

  const clearForm = () => {
    setPatientMode('existing');
    setProviderMode('existing');
    setInsurerMode('existing');
    setCoverageMode('existing');
    setSelectedPatient('');
    setSelectedProvider('');
    setSelectedInsurer('');
    setSelectedCoverage('');
    setPatientData({
      name: '',
      identifier: '',
      identifierType: 'national_id',
      gender: '',
      birthDate: '',
      phone: '',
      email: ''
    });
    setProviderData({ name: '', nphiesId: '', locationLicense: 'GACH' });
    setInsurerData({ name: '', nphiesId: '' });
    setCoverageData({
      memberId: '',
      coverageType: 'EHCPOL',
      planName: '',
      relationship: 'self',
      network: ''
    });
    setSelectedPurpose(['benefits', 'validation']);
    setServicedDate(new Date());
    setIsNewborn(false);
    setIsTransfer(false);
    setMotherPatientMode('existing');
    setSelectedMotherPatient('');
    setSelectedMotherPatientDetails(null);
    setMotherPatientData({
      name: '',
      identifier: '',
      identifierType: 'iqama',
      gender: '',
      birthDate: '',
      phone: '',
      email: ''
    });
    setResult(null);
    setError(null);
  };

  // Mode toggle button component
  const ModeToggle = ({ mode, setMode, options, labels }) => (
    <div className="flex space-x-1 bg-gray-100 rounded-lg p-1 mb-3">
      {options.map((opt, idx) => (
        <button
          key={opt}
          type="button"
          onClick={() => setMode(opt)}
          className={`flex-1 px-3 py-2 text-sm font-medium rounded-md transition-all ${
            mode === opt
              ? 'bg-white text-primary-purple shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          {labels[idx]}
        </button>
      ))}
    </div>
  );

  // Convert patients to Select options
  const patientOptions = patients.map(p => ({
    value: p.patient_id,
    label: `${p.name} - ${p.identifier || p.patient_id}`
  }));

  // Convert providers to Select options
  const providerOptions = providers.map(p => ({
    value: p.provider_id,
    label: `${p.provider_name || p.name}${p.nphies_id ? ` (${p.nphies_id})` : ''}`
  }));

  // Convert insurers to Select options
  const insurerOptions = insurers.map(i => ({
    value: i.insurer_id,
    label: `${i.insurer_name || i.name}${i.nphies_id ? ` (${i.nphies_id})` : ''}`
  }));

  // Convert coverages to Select options (deduplicated by coverage_id)
  const coverageOptions = [...new Map(coverages.map(c => [
    c.coverage_id.toString(),
    {
      value: c.coverage_id.toString(),
      label: `${c.policy_number || c.member_id || 'N/A'} - ${c.plan_name || c.coverage_type}${c.insurer_name ? ` (${c.insurer_name})` : ''}`
    }
  ])).values()];

  if (loadingData) {
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
    <div className="space-y-8">
      {/* Inject custom DatePicker styles */}
      <style>{datePickerStyles}</style>

      {/* Header */}
      <div className="relative">
        <div className="relative bg-white rounded-2xl p-8 border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center space-x-4 mb-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate('/nphies-eligibility')}
                  className="text-gray-600 hover:text-gray-900"
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to List
                </Button>
              </div>
              <h1 className="text-4xl font-bold text-gray-900">
                New Eligibility Check
              </h1>
              <p className="text-gray-600 mt-2 text-lg">
                Verify patient insurance coverage with NPHIES platform
              </p>
              <div className="flex items-center space-x-4 mt-4">
                <div className="flex items-center space-x-2 text-sm text-gray-500">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                  <span>Connected to NPHIES</span>
                </div>
              </div>
            </div>
            <div className="hidden md:flex items-center space-x-3">
              <div className="relative bg-white rounded-xl p-3 border border-gray-100">
                <Shield className="h-8 w-8 text-primary-purple" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Form */}
      <Card>
        <CardHeader>
          <CardTitle>Eligibility Request Form</CardTitle>
          <CardDescription>Fill in the details to check patient eligibility with NPHIES. You can select existing records or enter data manually.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            
            {/* Provider Section */}
            <div className="bg-purple-50 rounded-xl p-4 border border-purple-200">
              <div className="flex items-center space-x-2 mb-2">
                <Building className="h-5 w-5 text-primary-purple" />
                <label className="text-sm font-medium text-gray-700">
                  Provider <RequiredFieldIndicator />
                </label>
              </div>
              
              <ModeToggle
                mode={providerMode}
                setMode={setProviderMode}
                options={['existing', 'manual']}
                labels={['Select Existing', 'Enter Manually']}
              />

              {providerMode === 'existing' ? (
                <Select
                  value={providerOptions.find(opt => opt.value === selectedProvider)}
                  onChange={(option) => setSelectedProvider(option?.value || '')}
                  options={providerOptions}
                  styles={selectStyles}
                  placeholder="Search and select provider..."
                  isClearable
                  isSearchable
                />
              ) : (
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Provider Name</label>
                    <input
                      type="text"
                      value={providerData.name}
                      onChange={(e) => setProviderData({...providerData, name: e.target.value})}
                      className="w-full rounded-[4px] border border-gray-200 bg-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-purple/30"
                      placeholder="e.g. Saudi General Hospital"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        NPHIES ID <RequiredFieldIndicator />
                      </label>
                      <input
                        type="text"
                        value={providerData.nphiesId}
                        onChange={(e) => setProviderData({...providerData, nphiesId: e.target.value})}
                        className="w-full rounded-[4px] border border-gray-200 bg-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-purple/30"
                        placeholder="e.g. PR-FHIR"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Location License</label>
                      <input
                        type="text"
                        value={providerData.locationLicense}
                        onChange={(e) => setProviderData({...providerData, locationLicense: e.target.value})}
                        className="w-full rounded-[4px] border border-gray-200 bg-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-purple/30"
                        placeholder="e.g. GACH"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Patient & Insurer - Side by Side */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              
              {/* Patient Section */}
              <div className="bg-white rounded-xl p-4 border border-gray-200">
                <div className="flex items-center space-x-2 mb-2">
                  <User className="h-5 w-5 text-blue-600" />
                  <label className="text-sm font-medium text-gray-700">
                    Patient <RequiredFieldIndicator />
                </label>
              </div>

                <ModeToggle
                  mode={patientMode}
                  setMode={setPatientMode}
                  options={['existing', 'manual']}
                  labels={['Select Existing', 'Enter Manually']}
                />

                {patientMode === 'existing' ? (
                  <Select
                    value={patientOptions.find(opt => opt.value === selectedPatient)}
                    onChange={(option) => setSelectedPatient(option?.value || '')}
                    options={patientOptions}
                    styles={selectStyles}
                    placeholder="Search and select patient..."
                    isClearable
                    isSearchable
                  />
                ) : (
                  <div className="space-y-3">
              <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                      <input
                        type="text"
                        value={patientData.name}
                        onChange={(e) => setPatientData({...patientData, name: e.target.value})}
                        className="w-full rounded-[4px] border border-gray-200 bg-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-purple/30"
                        placeholder="e.g. Ahmed Al-Rashid"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          ID Number <RequiredFieldIndicator />
                </label>
                        <input
                          type="text"
                          value={patientData.identifier}
                          onChange={(e) => setPatientData({...patientData, identifier: e.target.value})}
                          className="w-full rounded-[4px] border border-gray-200 bg-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-purple/30"
                          placeholder="e.g. 1111100111"
                          maxLength="10"
                        />
              </div>
              <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">ID Type</label>
                        <Select
                          value={IDENTIFIER_TYPE_OPTIONS.find(opt => opt.value === patientData.identifierType)}
                          onChange={(option) => setPatientData({...patientData, identifierType: option?.value || 'national_id'})}
                          options={IDENTIFIER_TYPE_OPTIONS}
                          styles={selectStyles}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Gender</label>
                        <Select
                          value={GENDER_OPTIONS.find(opt => opt.value === patientData.gender)}
                          onChange={(option) => setPatientData({...patientData, gender: option?.value || ''})}
                          options={GENDER_OPTIONS}
                          styles={selectStyles}
                          placeholder="Select..."
                          isClearable
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Date of Birth</label>
                        <div className="datepicker-wrapper">
                          <DatePicker
                            selected={parseDate(patientData.birthDate)}
                            onChange={(date) => setPatientData({...patientData, birthDate: formatDate(date)})}
                            dateFormat="yyyy-MM-dd"
                            className="w-full rounded-[4px] border border-gray-200 bg-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-purple/30"
                            placeholderText="YYYY-MM-DD"
                            showYearDropdown
                            scrollableYearDropdown
                            yearDropdownItemNumber={100}
                            maxDate={new Date()}
                          />
                          <Calendar className="datepicker-icon h-4 w-4" />
                        </div>
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
                      <input
                        type="tel"
                        value={patientData.phone}
                        onChange={(e) => setPatientData({...patientData, phone: e.target.value})}
                        className="w-full rounded-[4px] border border-gray-200 bg-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-purple/30"
                        placeholder="+966 XX XXX XXXX"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Insurer Section */}
              <div className="bg-white rounded-xl p-4 border border-gray-200">
                <div className="flex items-center space-x-2 mb-2">
                  <Building className="h-5 w-5 text-amber-600" />
                  <label className="text-sm font-medium text-gray-700">
                    Insurer <RequiredFieldIndicator />
                </label>
              </div>

                <ModeToggle
                  mode={insurerMode}
                  setMode={setInsurerMode}
                  options={['existing', 'manual']}
                  labels={['Select Existing', 'Enter Manually']}
                />

                {insurerMode === 'existing' ? (
                  <Select
                    value={insurerOptions.find(opt => opt.value === selectedInsurer)}
                    onChange={(option) => setSelectedInsurer(option?.value || '')}
                    options={insurerOptions}
                    styles={selectStyles}
                    placeholder="Search and select insurer..."
                    isClearable
                    isSearchable
                  />
                ) : (
                  <div className="space-y-3">
              <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Insurer Name</label>
                      <input
                        type="text"
                        value={insurerData.name}
                        onChange={(e) => setInsurerData({...insurerData, name: e.target.value})}
                        className="w-full rounded-[4px] border border-gray-200 bg-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-purple/30"
                        placeholder="e.g. Tawuniya Insurance"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        NPHIES ID <RequiredFieldIndicator />
                </label>
                      <input
                        type="text"
                        value={insurerData.nphiesId}
                        onChange={(e) => setInsurerData({...insurerData, nphiesId: e.target.value})}
                        className="w-full rounded-[4px] border border-gray-200 bg-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-purple/30"
                        placeholder="e.g. INS-001"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Coverage Section */}
            <div className="bg-white rounded-xl p-4 border border-gray-200">
              <div className="flex items-center space-x-2 mb-2">
                <CreditCard className="h-5 w-5 text-green-600" />
                <label className="text-sm font-medium text-gray-700">
                  Coverage/Policy {coverageMode !== 'discovery' && <RequiredFieldIndicator />}
                </label>
              </div>
              
              <ModeToggle
                mode={coverageMode}
                setMode={setCoverageMode}
                options={['existing', 'manual', 'discovery']}
                labels={['Select Existing', 'Enter Manually', 'Discovery Mode']}
              />

              {coverageMode === 'existing' ? (
                <>
                  <Select
                    value={coverageOptions.find(opt => opt.value === selectedCoverage)}
                    onChange={(option) => setSelectedCoverage(option?.value || '')}
                    options={coverageOptions}
                    styles={selectStyles}
                    placeholder="Search and select coverage..."
                    isClearable
                    isSearchable
                  />
                  {patientMode === 'existing' && selectedPatient && (
                    <p className="text-sm text-blue-600 mt-2">Showing coverages for selected patient</p>
                  )}
                  {(patientMode === 'manual' || !selectedPatient) && (
                    <p className="text-sm text-gray-500 mt-2">Showing all available coverages</p>
                  )}
                  {coverages.length === 0 && (
                    <p className="text-sm text-amber-600 mt-2">No coverages found. Try manual entry or discovery mode.</p>
                  )}
                </>
              ) : coverageMode === 'manual' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Member ID</label>
                    <input
                      type="text"
                      value={coverageData.memberId}
                      onChange={(e) => setCoverageData({...coverageData, memberId: e.target.value})}
                      className="w-full rounded-[4px] border border-gray-200 bg-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-purple/30"
                      placeholder="e.g. MEM-00123456"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Coverage Type</label>
                    <Select
                      value={COVERAGE_TYPE_OPTIONS.find(opt => opt.value === coverageData.coverageType)}
                      onChange={(option) => setCoverageData({...coverageData, coverageType: option?.value || 'EHCPOL'})}
                      options={COVERAGE_TYPE_OPTIONS}
                      styles={selectStyles}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Plan Name</label>
                    <input
                      type="text"
                      value={coverageData.planName}
                      onChange={(e) => setCoverageData({...coverageData, planName: e.target.value})}
                      className="w-full rounded-[4px] border border-gray-200 bg-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-purple/30"
                      placeholder="e.g. Gold Plan"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Relationship</label>
                    <Select
                      value={RELATIONSHIP_OPTIONS.find(opt => opt.value === coverageData.relationship)}
                      onChange={(option) => setCoverageData({...coverageData, relationship: option?.value || 'self'})}
                      options={RELATIONSHIP_OPTIONS}
                      styles={selectStyles}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Network</label>
                    <input
                      type="text"
                      value={coverageData.network}
                      onChange={(e) => setCoverageData({...coverageData, network: e.target.value})}
                      className="w-full rounded-[4px] border border-gray-200 bg-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-purple/30"
                      placeholder="e.g. Golden C"
                    />
                  </div>
                </div>
              ) : (
                <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                  <div className="flex items-start space-x-3">
                    <Search className="h-5 w-5 text-blue-600 mt-0.5" />
                    <div>
                      <p className="font-semibold text-blue-900">Discovery Mode</p>
                      <p className="text-sm text-blue-700">
                        NPHIES will search for all active coverages for this patient. 
                        No coverage information is required. Make sure "discovery" is selected as a purpose.
                      </p>
                    </div>
                  </div>
                </div>
                )}
              </div>

              {/* Service Date */}
              <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Service Date <RequiredFieldIndicator />
                </label>
              <div className="datepicker-wrapper max-w-xs">
                <DatePicker
                  selected={servicedDate}
                  onChange={(date) => setServicedDate(date)}
                  dateFormat="yyyy-MM-dd"
                  className="w-full rounded-[4px] border border-gray-200 bg-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-purple/30"
                  placeholderText="Select service date"
                />
                <Calendar className="datepicker-icon h-4 w-4" />
              </div>
            </div>

            {/* Purpose Checkboxes */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Purpose <RequiredFieldIndicator />
              </label>
              <div className="flex flex-wrap gap-4">
                {['discovery', 'benefits', 'validation'].map(purpose => (
                  <label key={purpose} className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedPurpose.includes(purpose)}
                      onChange={() => handlePurposeToggle(purpose)}
                      className="w-5 h-5 text-primary-purple border-gray-300 rounded focus:ring-primary-purple"
                    />
                    <span className="text-gray-700 capitalize">{purpose}</span>
                  </label>
                ))}
              </div>
              <p className="text-sm text-gray-500 mt-2">
                {coverageMode === 'discovery' 
                  ? 'Discovery mode enabled - include "discovery" purpose for best results'
                  : 'Select at least one purpose for the eligibility check'
                }
              </p>
            </div>

            {/* NPHIES Extensions */}
            <div className="bg-white rounded-xl p-4">
              <label className="block text-sm font-medium text-gray-700 mb-3">
                NPHIES Extensions
              </label>
              <div className="flex flex-wrap gap-6">
                {/* Newborn Extension */}
                <label className="flex items-center space-x-3 cursor-pointer bg-white px-4 py-3 rounded-lg border border-gray-200 hover:border-primary-purple transition-colors">
                  <input
                    type="checkbox"
                    checked={isNewborn}
                    onChange={(e) => setIsNewborn(e.target.checked)}
                    className="w-5 h-5 text-primary-purple border-gray-300 rounded focus:ring-primary-purple"
                  />
                  <Baby className="h-5 w-5 text-pink-500" />
                  <div>
                    <span className="text-gray-700 font-medium">Newborn</span>
                    <p className="text-xs text-gray-500">Coverage is mother's policy</p>
                  </div>
                </label>
                
                {/* Transfer Extension */}
                <label className="flex items-center space-x-3 cursor-pointer bg-white px-4 py-3 rounded-lg border border-gray-200 hover:border-primary-purple transition-colors">
                  <input
                    type="checkbox"
                    checked={isTransfer}
                    onChange={(e) => setIsTransfer(e.target.checked)}
                    className="w-5 h-5 text-primary-purple border-gray-300 rounded focus:ring-primary-purple"
                  />
                  <ArrowRightLeft className="h-5 w-5 text-blue-500" />
                  <div>
                    <span className="text-gray-700 font-medium">Transfer of Care</span>
                    <p className="text-xs text-gray-500">Services transferred from another provider</p>
                  </div>
                </label>
              </div>
            </div>

            {/* Mother Patient Information (for newborn requests) */}
            {isNewborn && (
              <div className="bg-pink-50 rounded-xl p-4 border border-pink-200">
                <div className="flex items-center space-x-2 mb-3">
                  <User className="h-5 w-5 text-pink-600" />
                  <label className="text-sm font-medium text-gray-700">
                    Mother Patient Information <RequiredFieldIndicator />
                  </label>
                </div>
                <p className="text-sm text-pink-700 mb-3">
                  For newborn requests, the mother's coverage will be used. The newborn has MRN identifier, and the mother has Iqama identifier.
                </p>
                
                <ModeToggle
                  mode={motherPatientMode}
                  setMode={setMotherPatientMode}
                  options={['existing', 'manual']}
                  labels={['Select Existing', 'Enter Manually']}
                />

                {motherPatientMode === 'existing' ? (
                  <div className="space-y-3">
                    <Select
                      value={patientOptions.find(opt => opt.value === selectedMotherPatient)}
                      onChange={(option) => {
                        setSelectedMotherPatient(option?.value || '');
                        // Find and store the full patient details
                        if (option?.value) {
                          const patient = patients.find(p => p.patient_id === option.value);
                          setSelectedMotherPatientDetails(patient || null);
                        } else {
                          setSelectedMotherPatientDetails(null);
                        }
                      }}
                      options={patientOptions.filter(p => {
                        // Filter to show patients with Iqama identifier type (typically starting with 2)
                        const patient = patients.find(pa => pa.patient_id === p.value);
                        return patient && (patient.identifier_type === 'iqama' || (patient.identifier && patient.identifier.startsWith('2')));
                      })}
                      styles={selectStyles}
                      placeholder="Search and select mother patient (Iqama ID)..."
                      isClearable
                      isSearchable
                    />
                    
                    {/* Display selected mother patient details */}
                    {selectedMotherPatientDetails && (
                      <div className="bg-white rounded-lg p-4 border border-pink-300 space-y-2">
                        <div className="flex items-center space-x-2 mb-2">
                          <User className="h-4 w-4 text-pink-600" />
                          <span className="text-sm font-semibold text-gray-700">Selected Mother Patient Details</span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                          <div>
                            <span className="text-gray-500">Name:</span>
                            <span className="ml-2 font-medium text-gray-800">{selectedMotherPatientDetails.name || 'N/A'}</span>
                          </div>
                          <div>
                            <span className="text-gray-500">Iqama Number:</span>
                            <span className="ml-2 font-medium text-gray-800">{selectedMotherPatientDetails.identifier || 'N/A'}</span>
                          </div>
                          <div>
                            <span className="text-gray-500">Date of Birth:</span>
                            <span className="ml-2 font-medium text-gray-800">
                              {selectedMotherPatientDetails.birth_date 
                                ? new Date(selectedMotherPatientDetails.birth_date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
                                : 'N/A'}
                            </span>
                          </div>
                          <div>
                            <span className="text-gray-500">Gender:</span>
                            <span className="ml-2 font-medium text-gray-800 capitalize">{selectedMotherPatientDetails.gender || 'N/A'}</span>
                          </div>
                          {selectedMotherPatientDetails.phone && (
                            <div>
                              <span className="text-gray-500">Phone:</span>
                              <span className="ml-2 font-medium text-gray-800">{selectedMotherPatientDetails.phone}</span>
                            </div>
                          )}
                          {selectedMotherPatientDetails.email && (
                            <div>
                              <span className="text-gray-500">Email:</span>
                              <span className="ml-2 font-medium text-gray-800">{selectedMotherPatientDetails.email}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                      <input
                        type="text"
                        value={motherPatientData.name}
                        onChange={(e) => setMotherPatientData({...motherPatientData, name: e.target.value})}
                        className="w-full rounded-[4px] border border-gray-200 bg-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-purple/30"
                        placeholder="e.g. Maria Khaled Rizwan"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Iqama Number <RequiredFieldIndicator />
                        </label>
                        <input
                          type="text"
                          value={motherPatientData.identifier}
                          onChange={(e) => setMotherPatientData({...motherPatientData, identifier: e.target.value})}
                          className="w-full rounded-[4px] border border-gray-200 bg-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-purple/30"
                          placeholder="e.g. 2000000001"
                          maxLength="10"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Gender</label>
                        <Select
                          value={GENDER_OPTIONS.find(opt => opt.value === motherPatientData.gender)}
                          onChange={(option) => setMotherPatientData({...motherPatientData, gender: option?.value || ''})}
                          options={GENDER_OPTIONS}
                          styles={selectStyles}
                          placeholder="Select..."
                          isClearable
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Date of Birth</label>
                      <div className="datepicker-wrapper">
                        <DatePicker
                          selected={parseDate(motherPatientData.birthDate)}
                          onChange={(date) => setMotherPatientData({...motherPatientData, birthDate: formatDate(date)})}
                          dateFormat="yyyy-MM-dd"
                          className="w-full rounded-[4px] border border-gray-200 bg-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-purple/30"
                          placeholderText="YYYY-MM-DD"
                          showYearDropdown
                          scrollableYearDropdown
                          yearDropdownItemNumber={100}
                          maxDate={new Date()}
                        />
                        <Calendar className="datepicker-icon h-4 w-4" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
                      <input
                        type="tel"
                        value={motherPatientData.phone}
                        onChange={(e) => setMotherPatientData({...motherPatientData, phone: e.target.value})}
                        className="w-full rounded-[4px] border border-gray-200 bg-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-purple/30"
                        placeholder="+966 XX XXX XXXX"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start space-x-3">
                <XCircle className="h-5 w-5 text-red-500 mt-0.5" />
                <div>
                  <p className="font-semibold text-red-800">Error</p>
                  <p className="text-red-700">{error}</p>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex justify-between">
              <div className="flex space-x-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate('/nphies-eligibility')}
                >
                  Cancel
                </Button>
                <button
                  type="button"
                  onClick={clearForm}
                  className="px-6 py-3 bg-gray-200 text-gray-700 rounded-xl hover:bg-gray-300 transition-colors font-medium"
                >
                  Clear Form
                </button>
              </div>
              <div className="flex space-x-3">
                {/* Preview Button - No validation required */}
                <button
                  type="button"
                  onClick={handlePreview}
                  disabled={previewLoading}
                  className="px-6 py-3 bg-white border-2 border-primary-purple text-primary-purple rounded-xl hover:bg-purple-50 transition-all duration-200 font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                >
                  {previewLoading ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-2 border-primary-purple border-t-transparent"></div>
                      <span>Building...</span>
                    </>
                  ) : (
                    <>
                      <Eye className="h-5 w-5" />
                      <span>Preview Request</span>
                    </>
                  )}
                </button>
                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={loading || selectedPurpose.length === 0}
                  className="px-8 py-3 bg-gradient-to-r from-primary-purple to-accent-purple text-white rounded-xl hover:opacity-90 transition-all duration-200 font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                    <span>Checking...</span>
                  </>
                ) : (
                  <>
                    <Shield className="h-5 w-5" />
                    <span>Check Eligibility</span>
                  </>
                )}
              </button>
              </div>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Preview Modal/Section */}
      {showPreview && previewData && (
        <Card className="border-blue-200 bg-blue-50/50">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center">
                <Eye className="h-6 w-6 text-blue-600 mr-2" />
                <span className="text-blue-900">FHIR Request Preview</span>
              </div>
              <button
                onClick={() => setShowPreview(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <XCircle className="h-5 w-5" />
              </button>
            </CardTitle>
            <CardDescription>
              This is a preview of the FHIR bundle that will be sent to NPHIES. No request has been sent yet.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Entities Summary */}
            <div className="bg-white rounded-xl p-4 border border-gray-200">
              <h3 className="font-semibold text-gray-800 mb-3">Request Summary</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="text-gray-500">Patient</p>
                  <p className="font-medium">{previewData.entities?.patient?.name || 'N/A'}</p>
                  <p className="text-xs text-gray-400">{previewData.entities?.patient?.identifier}</p>
                </div>
                <div>
                  <p className="text-gray-500">Provider</p>
                  <p className="font-medium">{previewData.entities?.provider?.name || 'N/A'}</p>
                  <p className="text-xs text-gray-400 font-mono">{previewData.entities?.provider?.nphiesId}</p>
                </div>
                <div>
                  <p className="text-gray-500">Insurer</p>
                  <p className="font-medium">{previewData.entities?.insurer?.name || 'N/A'}</p>
                  <p className="text-xs text-gray-400 font-mono">{previewData.entities?.insurer?.nphiesId}</p>
                </div>
                <div>
                  <p className="text-gray-500">Coverage</p>
                  {previewData.isDiscoveryMode ? (
                    <p className="font-medium text-blue-600">Discovery Mode</p>
                  ) : (
                    <>
                      <p className="font-medium">{previewData.entities?.coverage?.policyNumber || 'N/A'}</p>
                      <p className="text-xs text-gray-400">{previewData.entities?.coverage?.type}</p>
                    </>
                  )}
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-gray-100">
                <div className="flex flex-wrap gap-2 text-xs">
                  <span className="px-2 py-1 bg-gray-100 rounded">Purpose: {previewData.options?.purpose?.join(', ')}</span>
                  <span className="px-2 py-1 bg-gray-100 rounded">Date: {previewData.options?.servicedDate}</span>
                  {previewData.options?.isNewborn && <span className="px-2 py-1 bg-pink-100 text-pink-700 rounded">Newborn</span>}
                  {previewData.options?.isTransfer && <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded">Transfer</span>}
                </div>
              </div>
            </div>

            {/* FHIR Bundle */}
            <div>
              <h3 className="font-semibold text-gray-800 mb-2 flex items-center">
                <FileText className="h-4 w-4 mr-2" />
                FHIR Bundle (JSON)
              </h3>
              <pre className="bg-gray-900 text-green-400 p-4 rounded-lg overflow-x-auto text-xs max-h-[500px] overflow-y-auto">
                {JSON.stringify(previewData.fhirBundle, null, 2)}
              </pre>
            </div>

            {/* Action buttons */}
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(JSON.stringify(previewData.fhirBundle, null, 2));
                }}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors text-sm font-medium flex items-center space-x-2"
              >
                <Copy className="h-4 w-4" />
                <span>Copy JSON</span>
              </button>
              <button
                onClick={() => setShowPreview(false)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
              >
                Close Preview
              </button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

