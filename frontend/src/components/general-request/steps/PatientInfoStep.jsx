import React, { useCallback, useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import DatePicker from 'react-datepicker';
import Select from 'react-select';
import 'react-datepicker/dist/react-datepicker.css';
import '../styles/datepicker-custom.css';
import { Calendar } from 'lucide-react';
import ValidationMessage from '../shared/ValidationMessage';
import RequiredFieldIndicator from '../shared/RequiredFieldIndicator';
import { GENDER_OPTIONS, MARITAL_STATUS_OPTIONS, PLAN_TYPE_OPTIONS } from '../config/wizardConfig';
import api from '@/services/api';

/**
 * PatientInfoStep Component
 * Step 1: Patient demographics and vitals
 */
const PatientInfoStep = React.memo(({ formData, setField, errors }) => {
  const [fetchStatus, setFetchStatus] = useState({ type: 'idle', message: '' });
  
  // Calculate age from date of birth
  const calculateAge = useCallback((dob) => {
    if (!dob) return '';
    const birthDate = new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age.toString();
  }, []);
  
  // Auto-calculate age when DOB changes
  useEffect(() => {
    if (formData.patient.dob) {
      const calculatedAge = calculateAge(formData.patient.dob);
      if (calculatedAge && calculatedAge !== formData.patient.age) {
        setField('patient.age', calculatedAge);
      }
    }
  }, [formData.patient.dob, calculateAge, setField, formData.patient.age]);
  
  // Parse date helper
  const parseDate = useCallback((dateString) => {
    if (!dateString) return null;
    return new Date(dateString);
  }, []);
  
  // Format date for API
  const formatDate = useCallback((date) => {
    if (!date) return '';
    return date.toISOString().split('T')[0];
  }, []);
  
  // Fetch patient data from backend
  const fetchPatient = useCallback(async () => {
    const id = formData.patient.idNumber?.trim();
    if (!id) {
      setFetchStatus({ type: 'error', message: 'Enter ID/Iqama to fetch patient.' });
      return;
    }
    try {
      setFetchStatus({ type: 'idle', message: 'Fetching patient…' });
      
      let data;
      try {
        data = await api.getPatient(id);
      } catch (error) {
        // Try search fallback
        try {
          const res = await api.getPatients({ identifier: id, limit: 1 });
          if (res?.data && Array.isArray(res.data) && res.data.length > 0) {
            data = res.data[0];
          } else if (Array.isArray(res) && res.length > 0) {
            data = res[0];
          } else {
            throw new Error('Patient not found');
          }
        } catch {
          throw error; // Throw original error
        }
      }
      
      // Check for error response
      if (data?.error) {
        throw new Error(data.error);
      }
      
      if (!data) {
        throw new Error('Patient not found');
      }
      
      // Handle both direct response and wrapped response
      const patient = data.data || data;
      
      // Store the patient UUID for database foreign key
      if (patient.patient_id) {
        setField('patient.patient_id', patient.patient_id);
      }
      
      // Map fields with fallbacks
      setField('patient.fullName', patient.name || patient.full_name || patient.fullName || '');
      const dob = patient.birthdate || patient.dob || '';
      setField('patient.dob', dob);
      // Auto-calculate age from DOB
      if (dob) {
        setField('patient.age', calculateAge(dob));
      }
      setField('patient.gender', (patient.gender || '').toLowerCase() || 'male');
      setField('patient.contactPhone', patient.phone || patient.contactPhone || patient.contact_phone || '');
      setField('patient.email', patient.email || '');
      
      setFetchStatus({ type: 'success', message: 'Patient info retrieved successfully.' });
    } catch (e) {
      console.error('Error fetching patient:', e);
      setFetchStatus({ type: 'error', message: e?.message || 'Failed to fetch patient' });
    }
  }, [formData.patient.idNumber, setField, calculateAge]);
  
  // Select styles
  const selectStyles = {
    control: (base, state) => ({
      ...base,
      minHeight: '42px',
      borderColor: '#e5e7eb',
      borderRadius: '4px',
      backgroundColor: '#f9fafb',
      paddingLeft: '0.25rem',
      paddingRight: '0.25rem',
      boxShadow: state.isFocused ? '0 0 0 2px rgba(85, 55, 129, 0.3)' : 'none',
      borderWidth: '1px',
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
  
  return (
    <div className="space-y-6">
      {/* Fetch Status Message */}
      {fetchStatus.message && (
        <div className={`p-4 rounded-lg ${
          fetchStatus.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' :
          fetchStatus.type === 'error' ? 'bg-red-50 text-red-700 border border-red-200' :
          'bg-blue-50 text-blue-700 border border-blue-200'
        }`}>
          {fetchStatus.message}
        </div>
      )}
      
      {/* Basic Information */}
      <Card>
        <CardHeader>
          <CardTitle>Patient Demographics</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Full Name <RequiredFieldIndicator />
              </label>
              <input
                type="text"
                value={formData.patient.fullName}
                onChange={(e) => setField('patient.fullName', e.target.value)}
                className={`w-full rounded-[4px] border ${errors['patient.fullName'] ? 'border-red-500' : 'border-gray-200'} bg-gray-50 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-purple/30`}
                placeholder="e.g. Ahmed Al-Saud"
              />
              <ValidationMessage error={errors['patient.fullName']} />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                ID Number <RequiredFieldIndicator />
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={formData.patient.idNumber}
                  onChange={(e) => setField('patient.idNumber', e.target.value)}
                  className={`flex-1 rounded-[4px] border ${errors['patient.idNumber'] ? 'border-red-500' : 'border-gray-200'} bg-gray-50 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-purple/30`}
                  placeholder="e.g. 1234567890"
                  maxLength="10"
                />
                <button
                  type="button"
                  onClick={fetchPatient}
                  className="px-4 py-2 rounded-lg bg-primary-purple text-white hover:opacity-90 transition whitespace-nowrap"
                >
                  Fetch
                </button>
              </div>
              <ValidationMessage error={errors['patient.idNumber']} />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                File Number
              </label>
              <input
                type="text"
                value={formData.patient.fileNumber}
                onChange={(e) => setField('patient.fileNumber', e.target.value)}
                className="w-full rounded-[4px] border border-gray-200 bg-gray-50 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-purple/30"
                placeholder="Medical record number"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Date of Birth <RequiredFieldIndicator />
              </label>
              <div className="datepicker-wrapper">
                <DatePicker
                  selected={parseDate(formData.patient.dob)}
                  onChange={(date) => setField('patient.dob', formatDate(date))}
                  dateFormat="yyyy-MM-dd"
                  className={`w-full rounded-[4px] border ${errors['patient.dob'] ? 'border-red-500' : 'border-gray-200'} bg-gray-50 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-purple/30`}
                  placeholderText="YYYY-MM-DD"
                  showYearDropdown
                  scrollableYearDropdown
                  yearDropdownItemNumber={100}
                  maxDate={new Date()}
                />
                <Calendar className="datepicker-icon h-4 w-4" />
              </div>
              <ValidationMessage error={errors['patient.dob']} />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Age
              </label>
              <input
                type="text"
                value={formData.patient.age}
                onChange={(e) => setField('patient.age', e.target.value)}
                className="w-full rounded-[4px] border border-gray-200 bg-gray-100 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-purple/30"
                placeholder="Auto-calculated from DOB"
                readOnly
                title="Age is automatically calculated from Date of Birth"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Gender <RequiredFieldIndicator />
              </label>
              <Select
                value={GENDER_OPTIONS.find(opt => opt.value === formData.patient.gender)}
                onChange={(option) => setField('patient.gender', option.value)}
                options={GENDER_OPTIONS}
                styles={selectStyles}
                className={errors['patient.gender'] ? 'border border-red-500 rounded-[4px]' : ''}
              />
              <ValidationMessage error={errors['patient.gender']} />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Contact Phone
              </label>
              <input
                type="tel"
                value={formData.patient.contactPhone}
                onChange={(e) => setField('patient.contactPhone', e.target.value)}
                className={`w-full rounded-[4px] border ${errors['patient.contactPhone'] ? 'border-red-500' : 'border-gray-200'} bg-gray-50 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-purple/30`}
                placeholder="+966 XX XXX XXXX"
              />
              <ValidationMessage error={errors['patient.contactPhone']} />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <input
                type="email"
                value={formData.patient.email}
                onChange={(e) => setField('patient.email', e.target.value)}
                className={`w-full rounded-[4px] border ${errors['patient.email'] ? 'border-red-500' : 'border-gray-200'} bg-gray-50 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-purple/30`}
                placeholder="patient@example.com"
              />
              <ValidationMessage error={errors['patient.email']} />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Marital Status
              </label>
              <Select
                value={MARITAL_STATUS_OPTIONS.find(opt => opt.value === formData.patient.maritalStatus)}
                onChange={(option) => setField('patient.maritalStatus', option?.value || '')}
                options={MARITAL_STATUS_OPTIONS}
                styles={selectStyles}
                isClearable
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Plan Type
              </label>
              <Select
                value={PLAN_TYPE_OPTIONS.find(opt => opt.value === formData.patient.planType)}
                onChange={(option) => setField('patient.planType', option?.value || '')}
                options={PLAN_TYPE_OPTIONS}
                styles={selectStyles}
                isClearable
              />
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Vitals */}
      <Card>
        <CardHeader>
          <CardTitle>Vital Signs</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Blood Pressure
              </label>
              <input
                type="text"
                value={formData.patient.vitals.bloodPressure}
                onChange={(e) => setField('patient.vitals.bloodPressure', e.target.value)}
                className="w-full rounded-[4px] border border-gray-200 bg-gray-50 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-purple/30"
                placeholder="e.g. 120/80"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Temperature (°C)
              </label>
              <input
                type="text"
                value={formData.patient.vitals.temperature}
                onChange={(e) => setField('patient.vitals.temperature', e.target.value)}
                className="w-full rounded-[4px] border border-gray-200 bg-gray-50 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-purple/30"
                placeholder="e.g. 37.0"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Pulse (bpm)
              </label>
              <input
                type="text"
                value={formData.patient.vitals.pulse}
                onChange={(e) => setField('patient.vitals.pulse', e.target.value)}
                className="w-full rounded-[4px] border border-gray-200 bg-gray-50 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-purple/30"
                placeholder="e.g. 72"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Respiratory Rate
              </label>
              <input
                type="text"
                value={formData.patient.vitals.respiratoryRate}
                onChange={(e) => setField('patient.vitals.respiratoryRate', e.target.value)}
                className="w-full rounded-[4px] border border-gray-200 bg-gray-50 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-purple/30"
                placeholder="e.g. 16"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Weight (kg)
              </label>
              <input
                type="text"
                value={formData.patient.vitals.weight}
                onChange={(e) => setField('patient.vitals.weight', e.target.value)}
                className="w-full rounded-[4px] border border-gray-200 bg-gray-50 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-purple/30"
                placeholder="e.g. 70"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Height (cm)
              </label>
              <input
                type="text"
                value={formData.patient.vitals.height}
                onChange={(e) => setField('patient.vitals.height', e.target.value)}
                className="w-full rounded-[4px] border border-gray-200 bg-gray-50 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-purple/30"
                placeholder="e.g. 175"
              />
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Clinical Details */}
      <Card>
        <CardHeader>
          <CardTitle>Clinical Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Chief Complaints
              </label>
              <textarea
                value={formData.patient.chiefComplaints}
                onChange={(e) => setField('patient.chiefComplaints', e.target.value)}
                rows="3"
                className="w-full rounded-[4px] border border-gray-200 bg-gray-50 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-purple/30"
                placeholder="Patient's main complaints..."
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Significant Signs
              </label>
              <textarea
                value={formData.patient.significantSigns}
                onChange={(e) => setField('patient.significantSigns', e.target.value)}
                rows="3"
                className="w-full rounded-[4px] border border-gray-200 bg-gray-50 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-purple/30"
                placeholder="Notable clinical signs observed..."
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Other Conditions
              </label>
              <textarea
                value={formData.patient.otherConditions}
                onChange={(e) => setField('patient.otherConditions', e.target.value)}
                rows="2"
                className="w-full rounded-[4px] border border-gray-200 bg-gray-50 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-purple/30"
                placeholder="Pre-existing conditions, allergies, etc."
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Duration of Illness (Days)
              </label>
              <input
                type="number"
                value={formData.patient.durationOfIllnessDays}
                onChange={(e) => setField('patient.durationOfIllnessDays', e.target.value)}
                className="w-full rounded-[4px] border border-gray-200 bg-gray-50 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-purple/30"
                placeholder="Number of days"
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
});

PatientInfoStep.displayName = 'PatientInfoStep';

export default PatientInfoStep;

