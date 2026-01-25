import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Scan, ClipboardCheck, Calendar, Plus, Trash2 } from 'lucide-react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import Select from 'react-select';
import { format } from 'date-fns';
import api from '@/services/api';

export default function GeneralFormSection() {
  const [form, setForm] = useState({
    patient: {
      fullName: '',
      idNumber: '',
      fileNumber: '',
      dob: '',
      age: '',
      gender: 'male',
      contactPhone: '',
      email: '',
      // Clinical Detail fields
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
    medications: [{ medicationName: '', type: '', quantity: '' }],
    attachments: []
  });
  const [status, setStatus] = useState({ type: 'idle', message: '' });
  const [preview, setPreview] = useState(null);
  const [lastResponse, setLastResponse] = useState(null);
  const [isValidating, setIsValidating] = useState(false);

  const setField = (path, value) => {
    const keys = path.split('.');
    setForm(prev => {
      const newForm = { ...prev };
      let current = newForm;
      for (let i = 0; i < keys.length - 1; i++) {
        current = current[keys[i]] = { ...current[keys[i]] };
      }
      current[keys[keys.length - 1]] = value;
      return newForm;
    });
  };

  // Date helper functions
  const parseDate = (dateString) => {
    if (!dateString) return null;
    return new Date(dateString);
  };

  const formatDateForAPI = (date) => {
    if (!date) return '';
    return format(date, 'yyyy-MM-dd');
  };

  // Management items handlers
  const handleAddManagementItem = () => {
    setForm(prev => ({
      ...prev,
      managementItems: [...prev.managementItems, { code: '', description: '', type: '', quantity: '', cost: '' }]
    }));
  };

  const handleRemoveManagementItem = (index) => {
    setForm(prev => ({
      ...prev,
      managementItems: prev.managementItems.filter((_, i) => i !== index)
    }));
  };

  const handleManagementItemChange = (index, field, value) => {
    setForm(prev => ({
      ...prev,
      managementItems: prev.managementItems.map((item, i) =>
        i === index ? { ...item, [field]: value } : item
      )
    }));
  };

  // Medication handlers
  const handleAddMedication = () => {
    setForm(prev => ({
      ...prev,
      medications: [...prev.medications, { medicationName: '', type: '', quantity: '' }]
    }));
  };

  const handleRemoveMedication = (index) => {
    setForm(prev => ({
      ...prev,
      medications: prev.medications.filter((_, i) => i !== index)
    }));
  };

  const handleMedicationChange = (index, field, value) => {
    setForm(prev => ({
      ...prev,
      medications: prev.medications.map((med, i) =>
        i === index ? { ...med, [field]: value } : med
      )
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setPreview(form);
    setStatus({ type: 'success', message: 'General request prepared automatically. Click "AI Check" to validate with n8n.' });
  };

  const handleAICheck = async () => {
    // Prevent multiple simultaneous requests
    if (isValidating) {
      return;
    }

    // Auto-generate preview if not exists
    if (!preview) {
      setPreview(form);
    }

    try {
      setIsValidating(true);
      setStatus({ type: 'idle', message: 'Sending to AI for validation...' });
      
      // Validate required fields
      if (!form.service.diagnosis || !form.service.description) {
        setStatus({ type: 'error', message: 'Diagnosis and service description are required for validation.' });
        setIsValidating(false);
        return;
      }

      // Send to local API endpoint
      const response = await api.request('/general-request/validate', {
        method: 'POST',
        body: JSON.stringify({
          service: {
            diagnosis: form.service.diagnosis,
            description: form.service.description,
            bodyPart: form.service.bodyPart,
            laterality: form.service.laterality,
            previousTests: form.service.previousTest
          }
        })
      });

      setLastResponse(response);
      
      // Set appropriate status message based on response
      if (response.success) {
        if (response.fit) {
          setStatus({ type: 'success', message: 'AI validation passed! The scan is appropriate for the diagnosis.' });
        } else if (response.lateralityMismatch) {
          setStatus({ type: 'error', message: 'Laterality mismatch detected! Please check the side (left/right) matches between diagnosis and scan.' });
        } else if (response.requiresPrerequisites) {
          setStatus({ type: 'error', message: `Prerequisites required: ${response.prerequisitesNeeded}` });
        } else {
          setStatus({ type: 'error', message: 'AI validation failed. The scan may not be appropriate for this diagnosis.' });
        }
      } else {
        setStatus({ type: 'error', message: response.message || 'AI validation failed' });
      }
    } catch (error) {
      console.error('Error during AI validation:', error);
      setStatus({ type: 'error', message: error?.message || 'Failed to validate request' });
    } finally {
      setIsValidating(false);
    }
  };

  // Select styles configuration - matching input field styling
  const selectStyles = {
    control: (base, state) => ({
      ...base,
      minHeight: '42px',
      borderColor: '#e5e7eb',
      borderRadius: '0.75rem',
      backgroundColor: '#f9fafb',
      paddingLeft: '0.25rem',
      paddingRight: '0.25rem',
      boxShadow: state.isFocused ? '0 0 0 2px rgba(85, 55, 129, 0.3)' : 'none',
      borderWidth: '1px',
      '&:hover': { 
        borderColor: '#e5e7eb'
      }
    }),
    valueContainer: (base) => ({
      ...base,
      padding: '0.25rem 0.5rem'
    }),
    input: (base) => ({
      ...base,
      margin: '0px',
      paddingTop: '0px',
      paddingBottom: '0px'
    }),
    option: (base, { isFocused, isSelected }) => ({
      ...base,
      backgroundColor: isSelected ? '#553781' : isFocused ? '#f3f4f6' : 'white',
      color: isSelected ? 'white' : '#374151',
      cursor: 'pointer'
    }),
    menu: (base) => ({ 
      ...base, 
      borderRadius: '0.75rem', 
      zIndex: 9999,
      marginTop: '0.25rem',
      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)'
    }),
    menuPortal: (base) => ({ ...base, zIndex: 9999 }),
    indicatorSeparator: () => ({ display: 'none' }),
    dropdownIndicator: (base) => ({
      ...base,
      color: '#9ca3af',
      '&:hover': { color: '#6b7280' }
    })
  };

  const visitTypeOptions = [
    { value: 'New visit', label: 'New visit' },
    { value: 'Follow Up', label: 'Follow Up' },
    { value: 'Refill', label: 'Refill' },
    { value: 'walk in', label: 'walk in' },
    { value: 'Referral', label: 'Referral' }
  ];

  const emergencyLevelOptions = [
    { value: '1', label: 'Level 1' },
    { value: '2', label: 'Level 2' },
    { value: '3', label: 'Level 3' }
  ];

  const maritalStatusOptions = [
    { value: 'S', label: 'S - Never Married (Single)' },
    { value: 'M', label: 'M - Married' },
    { value: 'D', label: 'D - Divorced' },
    { value: 'W', label: 'W - Widowed' },
    { value: 'A', label: 'A - Annulled' },
    { value: 'I', label: 'I - Interlocutory' },
    { value: 'L', label: 'L - Legally Separated' },
    { value: 'P', label: 'P - Polygamous' },
    { value: 'T', label: 'T - Domestic Partner' },
    { value: 'U', label: 'U - Unknown' }
  ];

  const planTypeOptions = [
    { value: 'individual', label: 'Individual' },
    { value: 'family', label: 'Family' },
    { value: 'corporate', label: 'Corporate' },
    { value: 'government', label: 'Government' }
  ];

  const bodyPartOptions = [
    'Head', 'Brain', 'Spine', 'Neck', 'Chest', 'Breast', 'Abdomen', 'Pelvis',
    'Knee', 'Shoulder', 'Hip', 'Hand', 'Foot', 'Sinuses', 'Orbit'
  ];

  // Backend lookups (patients by ID/Iqama, provider by license, insurer by name or id)
  const fetchPatient = async () => {
    const id = form.patient.idNumber?.trim();
    if (!id) {
      setStatus({ type: 'error', message: 'Enter ID/Iqama to fetch patient.' });
      return;
    }
    try {
      setStatus({ type: 'idle', message: 'Fetching patient…' });
      // Try direct lookup; if backend expects different param, try search fallback
      let data;
      try {
        data = await api.getPatient(id);
      } catch {
        const res = await api.getPatients({ identifier: id, limit: 1 });
        data = (res?.data && res.data[0]) || (Array.isArray(res) ? res[0] : null);
      }
      if (!data) throw new Error('Patient not found');
      const p = data.data || data;
      setField('patient.fullName', p.name || p.full_name || p.fullName || '');
      setField('patient.dob', p.birthdate || p.dob || '');
      setField('patient.gender', (p.gender || '').toLowerCase() || 'male');
      setField('patient.contactPhone', p.phone || p.contactPhone || '');
      setField('patient.email', p.email || '');
      setStatus({ type: 'success', message: 'Patient info retrieved.' });
    } catch (e) {
      setStatus({ type: 'error', message: e?.message || 'Failed to fetch patient' });
    }
  };

  const fetchProvider = async () => {
    const license = form.provider.licenseNumber?.trim();
    if (!license) {
      setStatus({ type: 'error', message: 'Enter License/NPI to fetch provider.' });
      return;
    }
    try {
      setStatus({ type: 'idle', message: 'Fetching provider…' });
      let data;
      try {
        data = await api.getProvider(license);
      } catch {
        const res = await api.getProviders({ license: license, limit: 1 });
        data = (res?.data && res.data[0]) || (Array.isArray(res) ? res[0] : null);
      }
      if (!data) throw new Error('Provider not found');
      const pr = data.data || data;
      setField('provider.facilityName', pr.facility_name || pr.facilityName || pr.name || '');
      setField('provider.doctorName', pr.doctor_name || pr.doctorName || pr.contact_person || '');
      setField('provider.department', pr.department || '');
      setField('provider.contactPhone', pr.phone || pr.contactPhone || '');
      setField('provider.email', pr.email || '');
      setStatus({ type: 'success', message: 'Provider info retrieved.' });
    } catch (e) {
      setStatus({ type: 'error', message: e?.message || 'Failed to fetch provider' });
    }
  };

  const fetchInsurer = async () => {
    const nameOrId = form.coverage.insurer?.trim();
    if (!nameOrId) {
      setStatus({ type: 'error', message: 'Enter Insurance Company name or ID to fetch.' });
      return;
    }
    try {
      setStatus({ type: 'idle', message: 'Fetching insurer…' });
      let data;
      
      // Check if input looks like a UUID (insurer_id)
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(nameOrId);
      
      if (isUUID) {
        // Try to get by ID first if it looks like a UUID
        try {
          data = await api.getInsurer(nameOrId);
        } catch {
          // Fall back to search if ID lookup fails
          const res = await api.getInsurers({ search: nameOrId, limit: 1 });
          data = (res?.data && res.data[0]) || (Array.isArray(res) ? res[0] : null);
        }
      } else {
        // Search by name directly
        const res = await api.getInsurers({ search: nameOrId, limit: 1 });
        data = (res?.data && res.data[0]) || (Array.isArray(res) ? res[0] : null);
      }
      
      if (!data) throw new Error('Insurer not found');
      const ins = data.data || data;
      setField('coverage.insurer', ins.name || ins.insurer_name || '');
      setField('coverage.contactPerson', ins.contact_person || ins.contactPerson || '');
      setField('coverage.phone', ins.phone || ins.contact_phone || '');
      setField('coverage.coverageType', ins.plan_type || ins.coverageType || '');
      setStatus({ type: 'success', message: 'Insurer info retrieved.' });
    } catch (e) {
      setStatus({ type: 'error', message: e?.message || 'Failed to fetch insurer' });
    }
  };

  return (
    <div className="space-y-6">
      <style>{`
        /* DatePicker custom styling to match input fields */
        .react-datepicker-wrapper {
          width: 100%;
        }
        .react-datepicker__input-container input {
          width: 100%;
          border-radius: 0.25rem;
          border: 1px solid #e5e7eb;
          background-color: #f9fafb;
          padding: 0.5rem 0.75rem;
          padding-left: 2.5rem;
          font-size: 0.875rem;
          line-height: 1.25rem;
          outline: none;
          transition: all 0.15s ease-in-out;
        }
        .react-datepicker__input-container input:focus {
          outline: none;
          box-shadow: 0 0 0 2px rgba(85, 55, 129, 0.3);
          border-color: #e5e7eb;
        }
        .react-datepicker__input-container input::placeholder {
          color: #9ca3af;
        }
        /* DatePicker popup styling */
        .react-datepicker {
          font-family: inherit;
          border-radius: 0.25rem;
          border: 1px solid #e5e7eb;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
        }
        .react-datepicker__header {
          background-color: #f9fafb;
          border-bottom: 1px solid #e5e7eb;
          border-top-left-radius: 0.75rem;
          border-top-right-radius: 0.75rem;
          padding-top: 0.5rem;
        }
        .react-datepicker__current-month {
          color: #111827;
          font-weight: 600;
          font-size: 0.875rem;
        }
        .react-datepicker__day-name {
          color: #6b7280;
          font-size: 0.75rem;
          font-weight: 500;
        }
        .react-datepicker__day {
          color: #374151;
          border-radius: 0.375rem;
          transition: all 0.15s ease-in-out;
        }
        .react-datepicker__day:hover {
          background-color: #f3f4f6;
        }
        .react-datepicker__day--selected,
        .react-datepicker__day--keyboard-selected {
          background-color: #553781;
          color: white;
          font-weight: 500;
        }
        .react-datepicker__day--selected:hover {
          background-color: #6b46a0;
        }
        .react-datepicker__day--today {
          font-weight: 600;
          color: #553781;
        }
        .react-datepicker__day--disabled {
          color: #d1d5db;
          cursor: not-allowed;
        }
        .react-datepicker__navigation {
          top: 0.75rem;
        }
        .react-datepicker__navigation-icon::before {
          border-color: #6b7280;
        }
        .react-datepicker__navigation:hover .react-datepicker__navigation-icon::before {
          border-color: #374151;
        }
      `}</style>
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Patient Information */}
        <Card>
          <CardHeader>
            <CardTitle>Patient Information</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Full Name *</label>
                <input
                  type="text"
                  value={form.patient.fullName}
                  onChange={(e) => setField('patient.fullName', e.target.value)}
                  className="w-full rounded-[4px] border border-gray-200 bg-gray-50 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-purple/30"
                  placeholder="e.g. Ahmed Al-Qahtani"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ID/Iqama *</label>
                <div className="flex gap-2">
                <input
                  type="text"
                  value={form.patient.idNumber}
                  onChange={(e) => setField('patient.idNumber', e.target.value)}
                  className="w-full rounded-[4px] border border-gray-200 bg-gray-50 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-purple/30"
                  placeholder="e.g. 1023456789"
                  required
                />
                <button type="button" onClick={fetchPatient} className="px-3 py-2 rounded-lg bg-primary-purple text-white hover:opacity-90">Fetch</button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Patient File Number</label>
                <input
                  type="text"
                  value={form.patient.fileNumber}
                  onChange={(e) => setField('patient.fileNumber', e.target.value)}
                  className="w-full rounded-[4px] border border-gray-200 bg-gray-50 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-purple/30"
                  placeholder="e.g. P-2024-0001"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date of Birth *</label>
                <div className="relative">
                  <DatePicker
                    selected={parseDate(form.patient.dob)}
                    onChange={(date) => setField('patient.dob', formatDateForAPI(date))}
                    dateFormat="dd/MM/yyyy"
                    placeholderText="Select date"
                    wrapperClassName="w-full"
                  />
                  <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Age</label>
                <input
                  type="number"
                  value={form.patient.age}
                  onChange={(e) => setField('patient.age', e.target.value)}
                  className="w-full rounded-[4px] border border-gray-200 bg-gray-50 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-purple/30"
                  placeholder="e.g. 45"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Gender *</label>
                <select
                  value={form.patient.gender}
                  onChange={(e) => setField('patient.gender', e.target.value)}
                  className="w-full rounded-[4px] border border-gray-200 bg-gray-50 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-purple/30"
                  required
                >
                  <option value="">Select gender…</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                  <option value="unknown">Unknown</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                <input
                  type="text"
                  value={form.patient.contactPhone}
                  onChange={(e) => setField('patient.contactPhone', e.target.value)}
                  className="w-full rounded-[4px] border border-gray-200 bg-gray-50 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-purple/30"
                  placeholder="e.g. +966512345678"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  value={form.patient.email}
                  onChange={(e) => setField('patient.email', e.target.value)}
                  className="w-full rounded-[4px] border border-gray-200 bg-gray-50 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-purple/30"
                  placeholder="e.g. ahmed@example.com"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Insured/Policy Holder Information */}
        <Card>
          <CardHeader>
            <CardTitle>Insured/Policy Holder Information</CardTitle>
            <CardDescription>Information about the insured person (may be different from patient)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Insured Name</label>
                <input
                  type="text"
                  value={form.insured.name}
                  onChange={(e) => setField('insured.name', e.target.value)}
                  className="w-full rounded-[4px] border border-gray-200 bg-gray-50 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-purple/30"
                  placeholder="e.g. Mohammed Al-Faisal"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ID Card Number</label>
                <input
                  type="text"
                  value={form.insured.idCardNumber}
                  onChange={(e) => setField('insured.idCardNumber', e.target.value)}
                  className="w-full rounded-[4px] border border-gray-200 bg-gray-50 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-purple/30"
                  placeholder="e.g. 2012345678"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Clinical Detail Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Scan className="h-5 w-5 text-primary-purple" />
              Clinical Detail Information
            </CardTitle>
            <CardDescription>Essential clinical information for proper diagnosis and treatment planning</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {/* Vitals Section */}
              <div>
                <h4 className="text-lg font-semibold text-gray-800 mb-4">Vital Signs</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Blood Pressure</label>
                    <input
                      type="text"
                      value={form.patient.vitals.bloodPressure}
                      onChange={(e) => setField('patient.vitals.bloodPressure', e.target.value)}
                      className="w-full rounded-[4px] border border-gray-200 bg-gray-50 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-purple/30"
                      placeholder="e.g. 120/80"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Temperature</label>
                    <input
                      type="text"
                      value={form.patient.vitals.temperature}
                      onChange={(e) => setField('patient.vitals.temperature', e.target.value)}
                      className="w-full rounded-[4px] border border-gray-200 bg-gray-50 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-purple/30"
                      placeholder="e.g. 37.0 °C"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Pulse</label>
                    <input
                      type="text"
                      value={form.patient.vitals.pulse}
                      onChange={(e) => setField('patient.vitals.pulse', e.target.value)}
                      className="w-full rounded-[4px] border border-gray-200 bg-gray-50 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-purple/30"
                      placeholder="e.g. 72 bpm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Respiratory Rate</label>
                    <input
                      type="text"
                      value={form.patient.vitals.respiratoryRate}
                      onChange={(e) => setField('patient.vitals.respiratoryRate', e.target.value)}
                      className="w-full rounded-[4px] border border-gray-200 bg-gray-50 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-purple/30"
                      placeholder="e.g. 16"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Weight</label>
                    <input
                      type="text"
                      value={form.patient.vitals.weight}
                      onChange={(e) => setField('patient.vitals.weight', e.target.value)}
                      className="w-full rounded-[4px] border border-gray-200 bg-gray-50 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-purple/30"
                      placeholder="e.g. 70 kg"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Height</label>
                    <input
                      type="text"
                      value={form.patient.vitals.height}
                      onChange={(e) => setField('patient.vitals.height', e.target.value)}
                      className="w-full rounded-[4px] border border-gray-200 bg-gray-50 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-purple/30"
                      placeholder="e.g. 175 cm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Duration of Illness (Days)</label>
                    <input
                      type="number"
                      value={form.patient.durationOfIllnessDays}
                      onChange={(e) => setField('patient.durationOfIllnessDays', e.target.value)}
                      className="w-full rounded-[4px] border border-gray-200 bg-gray-50 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-purple/30"
                      placeholder="e.g. 3"
                    />
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-2">Required documentation to justify urgency and necessity of the service</p>
              </div>

              {/* Other Clinical Information */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Other Conditions</label>
                  <textarea
                    value={form.patient.otherConditions}
                    onChange={(e) => setField('patient.otherConditions', e.target.value)}
                    className="w-full rounded-[4px] border border-gray-200 bg-gray-50 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-purple/30"
                    placeholder="e.g. Patient has known history of Hypertension and Asthma"
                    rows={3}
                  />
                  <p className="text-xs text-gray-500 mt-1">Chronic, non-acute conditions that may affect treatment</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Chief Complaints and Main Symptoms *</label>
                  <textarea
                    value={form.patient.chiefComplaints}
                    onChange={(e) => setField('patient.chiefComplaints', e.target.value)}
                    className="w-full rounded-[4px] border border-gray-200 bg-gray-50 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-purple/30"
                    placeholder="e.g. Severe abdominal pain for 48 hours, radiating to the back"
                    rows={3}
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">Primary complaints before formal diagnosis</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Significant Signs</label>
                  <textarea
                    value={form.patient.significantSigns}
                    onChange={(e) => setField('patient.significantSigns', e.target.value)}
                    className="w-full rounded-[4px] border border-gray-200 bg-gray-50 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-purple/30"
                    placeholder="e.g. Fever, swelling, tenderness"
                    rows={3}
                  />
                  <p className="text-xs text-gray-500 mt-1">Observable clinical signs</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Marital Status</label>
                  <Select
                    value={maritalStatusOptions.find(opt => opt.value === form.patient.maritalStatus)}
                    onChange={(option) => setField('patient.maritalStatus', option ? option.value : '')}
                    options={maritalStatusOptions}
                    placeholder="Select marital status..."
                    isClearable
                    styles={selectStyles}
                    className="react-select-container"
                    classNamePrefix="react-select"
                    menuPortalTarget={document.body}
                    menuPosition="fixed"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Plan Type</label>
                  <Select
                    value={planTypeOptions.find(opt => opt.value === form.patient.planType)}
                    onChange={(option) => setField('patient.planType', option ? option.value : '')}
                    options={planTypeOptions}
                    placeholder="Select plan type..."
                    isClearable
                    styles={selectStyles}
                    className="react-select-container"
                    classNamePrefix="react-select"
                    menuPortalTarget={document.body}
                    menuPosition="fixed"
                  />
                  <p className="text-xs text-gray-500 mt-1">Used to verify eligibility and scope of coverage</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Provider Information */}
        <Card>
          <CardHeader>
            <CardTitle>Provider Information</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Facility *</label>
                  <input
                    type="text"
                    value={form.provider.facilityName}
                    onChange={(e) => setField('provider.facilityName', e.target.value)}
                    className="w-full rounded-[4px] border border-gray-200 bg-gray-50 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-purple/30"
                    placeholder="e.g. King Faisal Hospital"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Doctor *</label>
                  <input
                    type="text"
                    value={form.provider.doctorName}
                    onChange={(e) => setField('provider.doctorName', e.target.value)}
                    className="w-full rounded-[4px] border border-gray-200 bg-gray-50 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-purple/30"
                    placeholder="e.g. Dr. Sara Al-Shehri"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">License/NPI *</label>
                  <div className="flex gap-2">
                  <input
                    type="text"
                    value={form.provider.licenseNumber}
                    onChange={(e) => setField('provider.licenseNumber', e.target.value)}
                    className="w-full rounded-[4px] border border-gray-200 bg-gray-50 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-purple/30"
                    placeholder="e.g. 12-345678"
                    required
                  />
                  <button type="button" onClick={fetchProvider} className="px-3 py-2 rounded-lg bg-primary-purple text-white hover:opacity-90">Fetch</button>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
                  <input
                    type="text"
                    value={form.provider.department}
                    onChange={(e) => setField('provider.department', e.target.value)}
                    className="w-full rounded-[4px] border border-gray-200 bg-gray-50 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-purple/30"
                    placeholder="e.g. Radiology"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                  <input
                    type="text"
                    value={form.provider.contactPhone}
                    onChange={(e) => setField('provider.contactPhone', e.target.value)}
                    className="w-full rounded-[4px] border border-gray-200 bg-gray-50 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-purple/30"
                    placeholder="e.g. +966511223344"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input
                    type="email"
                    value={form.provider.email}
                    onChange={(e) => setField('provider.email', e.target.value)}
                    className="w-full rounded-[4px] border border-gray-200 bg-gray-50 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-purple/30"
                    placeholder="e.g. referral@kfh.sa"
                  />
                </div>
              </div>

              {/* Provider Approval Section */}
              <div className="border-t pt-6">
                <h4 className="text-lg font-semibold text-gray-800 mb-4">Provider Approval</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Completed/Coded By</label>
                    <input
                      type="text"
                      value={form.provider.completedCodedBy}
                      onChange={(e) => setField('provider.completedCodedBy', e.target.value)}
                      className="w-full rounded-[4px] border border-gray-200 bg-gray-50 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-purple/30"
                      placeholder="Enter name"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Signature</label>
                    <input
                      type="text"
                      value={form.provider.signature}
                      onChange={(e) => setField('provider.signature', e.target.value)}
                      className="w-full rounded-[4px] border border-gray-200 bg-gray-50 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-purple/30"
                      placeholder="Enter signature"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                    <div className="relative">
                      <DatePicker
                        selected={parseDate(form.provider.date)}
                        onChange={(date) => setField('provider.date', formatDateForAPI(date))}
                        dateFormat="dd/MM/yyyy"
                        placeholderText="Select date"
                        wrapperClassName="w-full"
                      />
                      <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Coverage Information */}
        <Card>
          <CardHeader>
            <CardTitle>Coverage Information</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Insurance Company *</label>
                <div className="flex gap-2">
                <input
                  type="text"
                  value={form.coverage.insurer}
                  onChange={(e) => setField('coverage.insurer', e.target.value)}
                  className="w-full rounded-[4px] border border-gray-200 bg-gray-50 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-purple/30"
                  placeholder="e.g. Bupa Arabia"
                  required
                />
                <button type="button" onClick={fetchInsurer} className="px-3 py-2 rounded-lg bg-primary-purple text-white hover:opacity-90">Fetch</button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">TPA Company</label>
                <input
                  type="text"
                  value={form.coverage.tpaCompanyName}
                  onChange={(e) => setField('coverage.tpaCompanyName', e.target.value)}
                  className="w-full rounded-[4px] border border-gray-200 bg-gray-50 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-purple/30"
                  placeholder="e.g. Mednet"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Contact Person</label>
                <input
                  type="text"
                  value={form.coverage.contactPerson}
                  onChange={(e) => setField('coverage.contactPerson', e.target.value)}
                  className="w-full rounded-[4px] border border-gray-200 bg-gray-50 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-purple/30"
                  placeholder="e.g. John Smith"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                <input
                  type="text"
                  value={form.coverage.phone}
                  onChange={(e) => setField('coverage.phone', e.target.value)}
                  className="w-full rounded-[4px] border border-gray-200 bg-gray-50 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-purple/30"
                  placeholder="e.g. +966501234567"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Policy Holder</label>
                <input
                  type="text"
                  value={form.coverage.policyHolder}
                  onChange={(e) => setField('coverage.policyHolder', e.target.value)}
                  className="w-full rounded-[4px] border border-gray-200 bg-gray-50 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-purple/30"
                  placeholder="Enter policy holder name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Policy Number</label>
                <input
                  type="text"
                  value={form.coverage.policyNumber}
                  onChange={(e) => setField('coverage.policyNumber', e.target.value)}
                  className="w-full rounded-[4px] border border-gray-200 bg-gray-50 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-purple/30"
                  placeholder="Enter policy number"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Expiry Date</label>
                <div className="relative">
                  <DatePicker
                    selected={parseDate(form.coverage.expiryDate)}
                    onChange={(date) => setField('coverage.expiryDate', formatDateForAPI(date))}
                    dateFormat="dd/MM/yyyy"
                    placeholderText="Select date"
                    wrapperClassName="w-full"
                  />
                  <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Approval</label>
                <input
                  type="text"
                  value={form.coverage.approvalField}
                  onChange={(e) => setField('coverage.approvalField', e.target.value)}
                  className="w-full rounded-[4px] border border-gray-200 bg-gray-50 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-purple/30"
                  placeholder="Enter approval field"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Encounter & Service */}
        <Card>
          <CardHeader>
            <CardTitle>Encounter & Service</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Encounter *</label>
                  <select
                    value={form.encounterClass}
                    onChange={(e) => setField('encounterClass', e.target.value)}
                    className="w-full rounded-[4px] border border-gray-200 bg-gray-50 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-purple/30"
                    required
                  >
                    <option value="">Select</option>
                    <option value="inpatient">Inpatient</option>
                    <option value="outpatient">Outpatient</option>
                    <option value="daycase">Daycase</option>
                    <option value="emergency">Emergency</option>
                    <option value="telemedicine">Telemedicine</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Visit Type</label>
                  <Select
                    value={visitTypeOptions.find(opt => opt.value === form.service.visitType)}
                    onChange={(option) => setField('service.visitType', option ? option.value : '')}
                    options={visitTypeOptions}
                    placeholder="Select..."
                    isClearable
                    styles={selectStyles}
                    className="react-select-container"
                    classNamePrefix="react-select"
                    menuPortalTarget={document.body}
                    menuPosition="fixed"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Start Date *</label>
                  <div className="relative">
                    <DatePicker
                      selected={parseDate(form.service.startDate)}
                      onChange={(date) => setField('service.startDate', formatDateForAPI(date))}
                      dateFormat="dd/MM/yyyy"
                      placeholderText="Select date"
                      wrapperClassName="w-full"
                    />
                    <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Urgency *</label>
                  <select
                    value={form.service.urgency}
                    onChange={(e) => setField('service.urgency', e.target.value)}
                    className="w-full rounded-[4px] border border-gray-200 bg-gray-50 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-purple/30"
                    required
                  >
                    <option value="routine">Routine</option>
                    <option value="urgent">Urgent</option>
                    <option value="emergency">Emergency</option>
                  </select>
                </div>
              </div>

              {/* Emergency Case Section */}
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={form.service.emergencyCase} 
                    onChange={(e) => setField('service.emergencyCase', e.target.checked)} 
                    className="w-4 h-4 rounded border-gray-300 text-primary-purple focus:ring-primary-purple"
                  />
                  <span className="text-sm font-medium text-gray-700">Emergency Case</span>
                </label>
                {form.service.emergencyCase && (
                  <div className="flex-1">
                    <Select
                      value={emergencyLevelOptions.find(opt => opt.value === form.service.emergencyCareLevel)}
                      onChange={(option) => setField('service.emergencyCareLevel', option ? option.value : '')}
                      options={emergencyLevelOptions}
                      placeholder="Select emergency level..."
                      isClearable
                      styles={selectStyles}
                      className="react-select-container"
                      classNamePrefix="react-select"
                      menuPortalTarget={document.body}
                      menuPosition="fixed"
                    />
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Service Description *</label>
                  <select
                    value={form.service.description}
                    onChange={(e) => setField('service.description', e.target.value)}
                    className="w-full rounded-[4px] border border-gray-200 bg-gray-50 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-purple/30"
                    required
                  >
                    <option value="">Select a service...</option>
                    <option value="X-Ray">X-Ray</option>
                    <option value="MRI">MRI</option>
                    <option value="CT">CT</option>
                    <option value="Ultrasound">Ultrasound</option>
                    <option value="Mammography">Mammography</option>
                    <option value="custom">Other (custom input)</option>
                  </select>
                  {form.service.description === 'custom' && (
                    <input
                      type="text"
                      placeholder="e.g. MRI spine without contrast"
                      className="w-full rounded-[4px] border border-gray-200 bg-gray-50 px-3 py-2 mt-2 focus:outline-none focus:ring-2 focus:ring-primary-purple/30"
                      onChange={(e) => setField('service.description', e.target.value)}
                    />
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">CPT Codes</label>
                  <input
                    type="text"
                    value={form.service.cptCodes}
                    onChange={(e) => setField('service.cptCodes', e.target.value)}
                    className="w-full rounded-[4px] border border-gray-200 bg-gray-50 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-purple/30"
                    placeholder="e.g. 70551"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">ICD-10 Codes</label>
                  <input
                    type="text"
                    value={form.service.icd10Codes}
                    onChange={(e) => setField('service.icd10Codes', e.target.value)}
                    className="w-full rounded-[4px] border border-gray-200 bg-gray-50 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-purple/30"
                    placeholder="e.g. R51.9"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Diagnosis</label>
                  <textarea
                    value={form.service.diagnosis}
                    onChange={(e) => setField('service.diagnosis', e.target.value)}
                    className="w-full rounded-[4px] border border-gray-200 bg-gray-50 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-purple/30"
                    placeholder="e.g. Acute appendicitis, Type 2 diabetes mellitus"
                    rows={3}
                  />
                </div>
              </div>

              {/* Additional Diagnosis Codes */}
              <div>
                <h4 className="text-sm font-semibold text-gray-800 mb-3">Additional Diagnosis Codes</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Principal Code</label>
                    <input
                      type="text"
                      value={form.service.principalCode}
                      onChange={(e) => setField('service.principalCode', e.target.value)}
                      className="w-full rounded-[4px] border border-gray-200 bg-gray-50 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-purple/30 text-sm"
                      placeholder="e.g. I10"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">2nd Code</label>
                    <input
                      type="text"
                      value={form.service.secondCode}
                      onChange={(e) => setField('service.secondCode', e.target.value)}
                      className="w-full rounded-[4px] border border-gray-200 bg-gray-50 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-purple/30 text-sm"
                      placeholder="e.g. E11"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">3rd Code</label>
                    <input
                      type="text"
                      value={form.service.thirdCode}
                      onChange={(e) => setField('service.thirdCode', e.target.value)}
                      className="w-full rounded-[4px] border border-gray-200 bg-gray-50 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-purple/30 text-sm"
                      placeholder="e.g. M54"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">4th Code</label>
                    <input
                      type="text"
                      value={form.service.fourthCode}
                      onChange={(e) => setField('service.fourthCode', e.target.value)}
                      className="w-full rounded-[4px] border border-gray-200 bg-gray-50 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-purple/30 text-sm"
                      placeholder="e.g. K59"
                    />
                  </div>
                </div>
              </div>

              {/* Conditions Checkboxes */}
              <div>
                <h4 className="text-sm font-semibold text-gray-800 mb-3">Conditions</h4>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                  {[
                    { key: 'chronic', label: 'Chronic' },
                    { key: 'congenital', label: 'Congenital' },
                    { key: 'rta', label: 'RTA' },
                    { key: 'workRelated', label: 'Work Related' },
                    { key: 'vaccination', label: 'Vaccination' },
                    { key: 'checkUp', label: 'Check Up' },
                    { key: 'psychiatric', label: 'Psychiatric' },
                    { key: 'infertility', label: 'Infertility' },
                    { key: 'pregnancy', label: 'Pregnancy' }
                  ].map(({ key, label }) => (
                    <label key={key} className="flex items-center gap-2 cursor-pointer text-sm">
                      <input 
                        type="checkbox" 
                        checked={form.service.conditions[key]} 
                        onChange={(e) => setField(`service.conditions.${key}`, e.target.checked)}
                        className="w-4 h-4 rounded border-gray-300 text-primary-purple focus:ring-primary-purple"
                      />
                      <span>{label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Imaging-specific fields */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Body Part</label>
                  <select
                    value={form.service.bodyPart}
                    onChange={(e) => setField('service.bodyPart', e.target.value)}
                    className="w-full rounded-[4px] border border-gray-200 bg-gray-50 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-purple/30"
                  >
                    <option value="">Select body part…</option>
                    {bodyPartOptions.map((part) => (
                      <option key={part} value={part}>{part}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Side</label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setField('service.laterality', 'left')}
                      className={`px-3 py-2 rounded-lg text-sm font-medium transition ${
                        form.service.laterality === 'left'
                          ? 'bg-primary-purple text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      Left
                    </button>
                    <button
                      type="button"
                      onClick={() => setField('service.laterality', 'right')}
                      className={`px-3 py-2 rounded-lg text-sm font-medium transition ${
                        form.service.laterality === 'right'
                          ? 'bg-primary-purple text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      Right
                    </button>
                    <button
                      type="button"
                      onClick={() => setField('service.laterality', 'bilateral')}
                      className={`px-3 py-2 rounded-lg text-sm font-medium transition ${
                        form.service.laterality === 'bilateral'
                          ? 'bg-primary-purple text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      Bilateral
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Previous Tests</label>
                  <textarea
                    value={form.service.previousTest}
                    onChange={(e) => setField('service.previousTest', e.target.value)}
                    className="w-full rounded-[4px] border border-gray-200 bg-gray-50 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-purple/30"
                    placeholder="Prior imaging/labs/therapies and dates"
                    rows={3}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Test Results</label>
                  <textarea
                    value={form.service.testResults}
                    onChange={(e) => setField('service.testResults', e.target.value)}
                    className="w-full rounded-[4px] border border-gray-200 bg-gray-50 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-purple/30"
                    placeholder="Key findings, abnormal values, severity"
                    rows={3}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Medical Plan</label>
                  <textarea
                    value={form.service.medicalPlan}
                    onChange={(e) => setField('service.medicalPlan', e.target.value)}
                    className="w-full rounded-[4px] border border-gray-200 bg-gray-50 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-purple/30"
                    placeholder="Planned management and rationale"
                    rows={3}
                  />
                </div>
              </div>

              {/* Case Management Section */}
              <div className="border-t pt-6">
                <h4 className="text-lg font-semibold text-gray-800 mb-4">Case Management</h4>
                <div className="space-y-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={form.service.caseManagementFormIncluded} 
                      onChange={(e) => setField('service.caseManagementFormIncluded', e.target.checked)}
                      className="w-4 h-4 rounded border-gray-300 text-primary-purple focus:ring-primary-purple"
                    />
                    <span className="text-sm font-medium text-gray-700">Case Management Form (CMF 1.0) included</span>
                  </label>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Possible Line of Management</label>
                    <textarea
                      value={form.service.possibleLineOfManagement}
                      onChange={(e) => setField('service.possibleLineOfManagement', e.target.value)}
                      className="w-full rounded-[4px] border border-gray-200 bg-gray-50 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-purple/30"
                      placeholder="Describe possible line of management..."
                      rows={3}
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Estimated Length of Stay (days)</label>
                      <input
                        type="number"
                        value={form.service.estimatedLengthOfStayDays}
                        onChange={(e) => setField('service.estimatedLengthOfStayDays', e.target.value)}
                        className="w-full rounded-[4px] border border-gray-200 bg-gray-50 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-purple/30"
                        placeholder="days"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Expected Date of Admission</label>
                      <div className="relative">
                        <DatePicker
                          selected={parseDate(form.service.expectedDateOfAdmission)}
                          onChange={(date) => setField('service.expectedDateOfAdmission', formatDateForAPI(date))}
                          dateFormat="dd/MM/yyyy"
                          placeholderText="Select date"
                          wrapperClassName="w-full"
                        />
                        <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Management Items */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Management Items</CardTitle>
              <button 
                type="button" 
                onClick={handleAddManagementItem}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary-purple text-white text-sm hover:opacity-90 transition"
              >
                <Plus className="h-4 w-4" />
                Add Item
              </button>
            </div>
          </CardHeader>
          <CardContent>
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
                  {form.managementItems.map((item, index) => (
                    <tr key={index} className="border-b hover:bg-gray-50">
                      <td className="p-2">
                        <input 
                          type="text"
                          value={item.code} 
                          onChange={(e) => handleManagementItemChange(index, 'code', e.target.value)} 
                          placeholder="Code" 
                          className="w-full rounded-[4px] border border-gray-200 bg-gray-50 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-primary-purple/30"
                        />
                      </td>
                      <td className="p-2">
                        <input 
                          type="text"
                          value={item.description} 
                          onChange={(e) => handleManagementItemChange(index, 'description', e.target.value)} 
                          placeholder="Description" 
                          className="w-full rounded-[4px] border border-gray-200 bg-gray-50 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-primary-purple/30"
                        />
                      </td>
                      <td className="p-2">
                        <input 
                          type="text"
                          value={item.type} 
                          onChange={(e) => handleManagementItemChange(index, 'type', e.target.value)} 
                          placeholder="Type" 
                          className="w-full rounded-[4px] border border-gray-200 bg-gray-50 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-primary-purple/30"
                        />
                      </td>
                      <td className="p-2">
                        <input 
                          type="number"
                          value={item.quantity} 
                          onChange={(e) => handleManagementItemChange(index, 'quantity', e.target.value)} 
                          placeholder="Qty" 
                          className="w-full rounded-[4px] border border-gray-200 bg-gray-50 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-primary-purple/30"
                        />
                      </td>
                      <td className="p-2">
                        <input 
                          type="number"
                          step="0.01"
                          value={item.cost} 
                          onChange={(e) => handleManagementItemChange(index, 'cost', e.target.value)} 
                          placeholder="Cost" 
                          className="w-full rounded-[4px] border border-gray-200 bg-gray-50 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-primary-purple/30"
                        />
                      </td>
                      <td className="p-2">
                        <button 
                          type="button" 
                          onClick={() => handleRemoveManagementItem(index)}
                          className={`p-1.5 rounded-[4px] transition ${
                            form.managementItems.length === 1 
                              ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
                              : 'bg-red-50 text-red-600 hover:bg-red-100'
                          }`}
                          disabled={form.managementItems.length === 1}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Medications */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Medications</CardTitle>
              <button 
                type="button" 
                onClick={handleAddMedication}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary-purple text-white text-sm hover:opacity-90 transition"
              >
                <Plus className="h-4 w-4" />
                Add Medication
              </button>
            </div>
          </CardHeader>
          <CardContent>
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
                  {form.medications.map((med, index) => (
                    <tr key={index} className="border-b hover:bg-gray-50">
                      <td className="p-2">
                        <input 
                          type="text"
                          value={med.medicationName} 
                          onChange={(e) => handleMedicationChange(index, 'medicationName', e.target.value)} 
                          placeholder="Medication name" 
                          className="w-full rounded-[4px] border border-gray-200 bg-gray-50 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-primary-purple/30"
                        />
                      </td>
                      <td className="p-2">
                        <input 
                          type="text"
                          value={med.type} 
                          onChange={(e) => handleMedicationChange(index, 'type', e.target.value)} 
                          placeholder="Type" 
                          className="w-full rounded-[4px] border border-gray-200 bg-gray-50 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-primary-purple/30"
                        />
                      </td>
                      <td className="p-2">
                        <input 
                          type="number"
                          value={med.quantity} 
                          onChange={(e) => handleMedicationChange(index, 'quantity', e.target.value)} 
                          placeholder="Qty" 
                          className="w-full rounded-[4px] border border-gray-200 bg-gray-50 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-primary-purple/30"
                        />
                      </td>
                      <td className="p-2">
                        <button 
                          type="button" 
                          onClick={() => handleRemoveMedication(index)}
                          className={`p-1.5 rounded-[4px] transition ${
                            form.medications.length === 1 
                              ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
                              : 'bg-red-50 text-red-600 hover:bg-red-100'
                          }`}
                          disabled={form.medications.length === 1}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Attachments */}
        <Card>
          <CardHeader>
            <CardTitle>Attachments</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center text-gray-500 py-8">
              <Scan className="h-12 w-12 mx-auto mb-4 text-gray-400" />
              <p>File upload functionality can be added here</p>
            </div>
          </CardContent>
        </Card>

        {status.type !== 'idle' && status.message && (
          <div className={
            status.type === 'success' ?
              'text-green-700 bg-green-50 border border-green-200 rounded-[4px] px-4 py-3' :
              status.type === 'error' ?
              'text-red-700 bg-red-50 border border-red-200 rounded-[4px] px-4 py-3' :
              'text-blue-700 bg-blue-50 border border-blue-200 rounded-[4px] px-4 py-3'
          }>
            {status.message}
          </div>
        )}

        {lastResponse && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-semibold">AI Validation Response</h2>
            </div>
            
            <div className="bg-gray-50 rounded-lg p-4 border">
              <div className="space-y-3">
                {/* Validation Result */}
                <div className="flex items-start space-x-3">
                  <span className="font-medium text-gray-700 min-w-32">Validation:</span>
                  <span className={`font-semibold ${lastResponse.fit ? 'text-green-600' : 'text-red-600'}`}>
                    {lastResponse.fit ? '✓ PASSED' : '✗ FAILED'}
                  </span>
                </div>

                {/* Diagnoses */}
                {lastResponse.diagnoses && (
                  <div className="flex items-start space-x-3">
                    <span className="font-medium text-gray-700 min-w-32">
                      {lastResponse.fit ? 'Supporting Diagnoses:' : 'Suggested Diagnoses:'}
                    </span>
                    <div className="flex-1">
                      {Array.isArray(lastResponse.diagnoses) ? (
                        <ul className="list-disc list-inside space-y-1">
                          {lastResponse.diagnoses.map((diagnosis, index) => (
                            <li key={index} className="text-gray-900">{diagnosis}</li>
                          ))}
                        </ul>
                      ) : (
                        <span className="text-gray-900">{lastResponse.diagnoses}</span>
                      )}
                    </div>
                  </div>
                )}

                {/* Prerequisites if needed */}
                {lastResponse.requiresPrerequisites && (
                  <div className="flex items-start space-x-3">
                    <span className="font-medium text-gray-700 min-w-32">Prerequisites Needed:</span>
                    <span className="text-orange-600 font-medium">{lastResponse.prerequisitesNeeded}</span>
                  </div>
                )}

                {/* Laterality Mismatch Warning */}
                {lastResponse.lateralityMismatch && (
                  <div className="flex items-start space-x-3 p-2 bg-yellow-50 rounded border border-yellow-200">
                    <span className="font-medium text-yellow-800">⚠️ Laterality mismatch between diagnosis and scan request</span>
                  </div>
                )}

                {/* Metadata */}
                {lastResponse.metadata && (
                  <div className="pt-3 border-t mt-4">
                    <details className="text-sm text-gray-600">
                      <summary className="cursor-pointer font-medium hover:text-gray-800">Technical Details</summary>
                      <div className="mt-2 space-y-1 pl-4">
                        <div>Model: {lastResponse.metadata.model || 'N/A'}</div>
                        <div>Response Time: {lastResponse.metadata.responseTime || 'N/A'}</div>
                        <div>Timestamp: {lastResponse.metadata.timestamp || 'N/A'}</div>
                      </div>
                    </details>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={() => {
              setForm({
                patient: { 
                  fullName: '', idNumber: '', fileNumber: '', dob: '', age: '', gender: 'male', contactPhone: '', email: '',
                  vitals: { bloodPressure: '', temperature: '', pulse: '', respiratoryRate: '', weight: '', height: '' },
                  otherConditions: '', chiefComplaints: '', significantSigns: '', durationOfIllnessDays: '', maritalStatus: '', planType: ''
                },
                insured: { name: '', idCardNumber: '' },
                provider: { facilityName: '', doctorName: '', licenseNumber: '', department: '', contactPhone: '', email: '', completedCodedBy: '', signature: '', date: '' },
                coverage: { insurer: '', contactPerson: '', phone: '', coverageType: '', tpaCompanyName: '', policyHolder: '', policyNumber: '', expiryDate: '', approvalField: '' },
                encounterClass: 'outpatient',
                encounterStart: '',
                encounterEnd: '',
                service: { 
                  description: '', diagnosis: '', previousTest: '', testResults: '', medicalPlan: '', startDate: '', urgency: 'routine', 
                  visitType: '', emergencyCase: false, emergencyCareLevel: '', bodyPart: '', laterality: 'left', cptCodes: '', icd10Codes: '',
                  principalCode: '', secondCode: '', thirdCode: '', fourthCode: '',
                  conditions: { chronic: false, congenital: false, rta: false, workRelated: false, vaccination: false, checkUp: false, psychiatric: false, infertility: false, pregnancy: false },
                  caseManagementFormIncluded: false, possibleLineOfManagement: '', estimatedLengthOfStayDays: '', expectedDateOfAdmission: ''
                },
                managementItems: [{ code: '', description: '', type: '', quantity: '', cost: '' }],
                medications: [{ medicationName: '', type: '', quantity: '' }],
                attachments: []
              });
              setPreview(null);
              setLastResponse(null);
              setStatus({ type: 'idle', message: '' });
              setIsValidating(false);
            }}
            className="px-4 py-2 rounded-[4px] border border-gray-200 text-gray-700 hover:bg-gray-50 transition"
          >
            Reset
          </button>
          <button
            type="button"
            onClick={handleAICheck}
            disabled={isValidating}
            className={`inline-flex items-center gap-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white px-5 py-2 rounded-[4px] transition ${
              isValidating ? 'opacity-60 cursor-not-allowed' : 'hover:from-blue-700 hover:to-blue-800'
            }`}
          >
            {isValidating ? (
              <>
                <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Validating...
              </>
            ) : (
              <>
                <Scan className="h-4 w-4" />
                AI Check
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
