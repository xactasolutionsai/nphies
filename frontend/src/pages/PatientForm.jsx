import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Select from 'react-select';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  Save,
  ArrowLeft,
  Loader2,
  AlertCircle,
  User,
  Calendar
} from 'lucide-react';
import api, { extractErrorMessage } from '@/services/api';
import { selectStyles, datePickerStyles } from '@/components/prior-auth/styles';

export default function PatientForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEditMode = !!id;
  
  const [loading, setLoading] = useState(isEditMode);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  
  const [formData, setFormData] = useState({
    name: '',
    identifier: '',
    identifier_type: 'national_id',
    identifier_system: '',
    gender: '',
    birth_date: '',
    phone: '',
    email: '',
    nationality: 'SAU',
    marital_status: '',
    address: '',
    city: '',
    country: 'SAU',
    occupation: '',
    is_newborn: false,
    nphies_patient_id: ''
  });

  const [errors, setErrors] = useState({});

  // Options for dropdowns
  const genderOptions = [
    { value: 'male', label: 'Male' },
    { value: 'female', label: 'Female' },
    { value: 'other', label: 'Other' },
    { value: 'unknown', label: 'Unknown' }
  ];

  const maritalStatusOptions = [
    { value: '', label: 'Not specified' },
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

  const nationalityOptions = [
    { value: 'SAU', label: 'Saudi Arabia' },
    { value: 'ARE', label: 'UAE' },
    { value: 'KWT', label: 'Kuwait' },
    { value: 'BHR', label: 'Bahrain' },
    { value: 'QAT', label: 'Qatar' },
    { value: 'OMN', label: 'Oman' },
    { value: 'EGY', label: 'Egypt' },
    { value: 'JOR', label: 'Jordan' },
    { value: 'LBN', label: 'Lebanon' },
    { value: 'SYR', label: 'Syria' },
    { value: 'IRQ', label: 'Iraq' },
    { value: 'YEM', label: 'Yemen' },
    { value: 'PAK', label: 'Pakistan' },
    { value: 'IND', label: 'India' },
    { value: 'PHL', label: 'Philippines' },
    { value: 'OTHER', label: 'Other' }
  ];

  const identifierTypeOptions = [
    { value: 'national_id', label: 'NI - National Identifier' },
    { value: 'iqama', label: 'PRC - Permanent Resident Card (Iqama)' },
    { value: 'passport', label: 'PPN - Passport Number' },
    { value: 'mrn', label: 'MR - Medical Record Number' },
    { value: 'visa', label: 'VS - Visa' },
    { value: 'border_number', label: 'BN - Border Number' },
    { value: 'displaced_person', label: 'DP - Displaced Person' }
  ];

  const countryOptions = [
    { value: 'SAU', label: 'Saudi Arabia' },
    { value: 'ARE', label: 'UAE' },
    { value: 'KWT', label: 'Kuwait' },
    { value: 'BHR', label: 'Bahrain' },
    { value: 'QAT', label: 'Qatar' },
    { value: 'OMN', label: 'Oman' },
    { value: 'OTHER', label: 'Other' }
  ];

  useEffect(() => {
    if (isEditMode) {
      loadPatient();
    }
  }, [id]);

  const loadPatient = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.getPatient(id);
      const patient = response.data || response;
      
      // Handle birth_date - it may come as ISO string or YYYY-MM-DD
      let birthDate = patient.birth_date || '';
      if (birthDate && birthDate.includes('T')) {
        // If it's an ISO string, extract just the date part
        birthDate = birthDate.split('T')[0];
      }
      
      setFormData({
        name: patient.name || '',
        identifier: patient.identifier || '',
        identifier_type: patient.identifier_type || 'national_id',
        identifier_system: patient.identifier_system || '',
        gender: patient.gender || '',
        birth_date: birthDate,
        phone: patient.phone || '',
        email: patient.email || '',
        nationality: patient.nationality || 'SAU',
        marital_status: patient.marital_status || '',
        address: patient.address || '',
        city: patient.city || '',
        country: patient.country || 'SAU',
        occupation: patient.occupation || '',
        is_newborn: patient.is_newborn === true,
        nphies_patient_id: patient.nphies_patient_id || ''
      });
    } catch (err) {
      console.error('Error loading patient:', err);
      setError(extractErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.name || formData.name.trim().length < 2) {
      newErrors.name = 'Name is required (minimum 2 characters)';
    }
    
    if (!formData.identifier || formData.identifier.trim().length < 5) {
      newErrors.identifier = 'Identifier is required (minimum 5 characters)';
    }
    
    if (!formData.gender) {
      newErrors.gender = 'Gender is required';
    }
    
    if (!formData.birth_date) {
      newErrors.birth_date = 'Birth date is required';
    }
    
    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Invalid email format';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error for this field when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: null }));
    }
  };

  const handleSelectChange = (field, selectedOption) => {
    handleChange(field, selectedOption?.value || '');
  };

  const handleDateChange = (date) => {
    if (!date) {
      handleChange('birth_date', '');
      return;
    }
    // Format date as YYYY-MM-DD in local timezone to avoid -1 day issue
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    handleChange('birth_date', `${year}-${month}-${day}`);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }
    
    try {
      setSaving(true);
      setError(null);
      
      // Prepare data for API
      const submitData = {
        ...formData,
        gender: formData.gender.toLowerCase(),
        marital_status: formData.marital_status ? formData.marital_status.toLowerCase() : null
      };
      
      if (isEditMode) {
        await api.updatePatient(id, submitData);
      } else {
        await api.createPatient(submitData);
      }
      
      navigate('/patients');
    } catch (err) {
      console.error('Error saving patient:', err);
      setError(extractErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  // Get date value for DatePicker - fix timezone issue
  const getBirthDateValue = () => {
    if (!formData.birth_date) return null;
    // Parse date string as local date to avoid timezone issues
    const [year, month, day] = formData.birth_date.split('-').map(Number);
    if (!year || !month || !day) return null;
    const date = new Date(year, month - 1, day);
    return isNaN(date.getTime()) ? null : date;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="relative">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-primary-purple/20"></div>
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-transparent border-t-primary-purple absolute top-0"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-8 px-4 sm:px-6 lg:px-8">
      <style>{datePickerStyles}</style>
      <div className="mx-auto space-y-6">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => navigate('/patients')}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                title="Back to patients"
              >
                <ArrowLeft className="h-5 w-5 text-gray-600" />
              </button>
              <div className="flex items-center space-x-3">
                <div className="bg-gradient-to-br from-primary-purple to-accent-purple rounded-lg p-2.5">
                  <User className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h1 className="text-3xl font-bold text-gray-900">
                    {isEditMode ? 'Edit Patient' : 'New Patient'}
                  </h1>
                  <p className="text-gray-600 mt-1">
                    {isEditMode ? 'Update patient information' : 'Register a new patient in the system'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="bg-red-50 border-l-4 border-red-500 rounded-lg p-4 flex items-start space-x-3">
            <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-red-800 font-medium">Error</p>
              <p className="text-red-700 mt-1 text-sm">{error}</p>
            </div>
            <button
              onClick={() => setError(null)}
              className="text-red-500 hover:text-red-700 transition-colors"
            >
              <AlertCircle className="h-5 w-5" />
            </button>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Personal Information */}
          <Card className="bg-white border border-gray-200 shadow-sm">
            <CardHeader className="pb-4 border-b border-gray-200">
              <CardTitle className="text-xl font-semibold text-gray-900">
                Personal Information
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* Name */}
                <div className="space-y-2 md:col-span-2 lg:col-span-3">
                  <Label htmlFor="name" className="text-sm font-medium text-gray-700">
                    Full Name <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => handleChange('name', e.target.value)}
                    placeholder="Enter patient full name"
                    className={`h-10 ${errors.name ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : ''}`}
                  />
                  {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name}</p>}
                </div>

                {/* Gender */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-gray-700">
                    Gender <span className="text-red-500">*</span>
                  </Label>
                  <Select
                    value={genderOptions.find(opt => opt.value === formData.gender)}
                    onChange={(option) => handleSelectChange('gender', option)}
                    options={genderOptions}
                    placeholder="Select gender"
                    styles={{
                      ...selectStyles,
                      control: (base, state = {}) => ({
                        ...selectStyles.control(base, state),
                        minHeight: '40px',
                        height: '40px',
                        borderColor: errors.gender ? '#ef4444' : (state?.isFocused ? '#553781' : '#e5e7eb'),
                        boxShadow: errors.gender 
                          ? '0 0 0 2px rgba(239, 68, 68, 0.2)' 
                          : (state?.isFocused 
                            ? '0 0 0 2px rgba(85, 55, 129, 0.3)' 
                            : 'none')
                      })
                    }}
                    className="react-select-container"
                    classNamePrefix="react-select"
                    menuPortalTarget={document.body}
                  />
                  {errors.gender && <p className="text-red-500 text-xs mt-1">{errors.gender}</p>}
                </div>

                {/* Birth Date */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-gray-700">
                    Date of Birth <span className="text-red-500">*</span>
                  </Label>
                  <div className="datepicker-wrapper">
                    <DatePicker
                      selected={getBirthDateValue()}
                      onChange={handleDateChange}
                      dateFormat="yyyy-MM-dd"
                      className={`w-full rounded-md border ${errors.birth_date ? 'border-red-500' : 'border-gray-300'} bg-white px-3 py-2 text-sm h-10 focus:outline-none focus:ring-2 ${errors.birth_date ? 'focus:ring-red-500' : 'focus:ring-primary-purple'}`}
                      placeholderText="Select birth date"
                      maxDate={new Date()}
                    />
                    <Calendar className="datepicker-icon h-4 w-4" />
                  </div>
                  {errors.birth_date && <p className="text-red-500 text-xs mt-1">{errors.birth_date}</p>}
                </div>

                {/* Marital Status */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-gray-700">
                    Marital Status
                  </Label>
                  <Select
                    value={maritalStatusOptions.find(opt => opt.value === formData.marital_status)}
                    onChange={(option) => handleSelectChange('marital_status', option)}
                    options={maritalStatusOptions}
                    placeholder="Select marital status"
                    styles={{
                      ...selectStyles,
                      control: (base, state = {}) => ({
                        ...selectStyles.control(base, state),
                        minHeight: '40px',
                        height: '40px'
                      })
                    }}
                    className="react-select-container"
                    classNamePrefix="react-select"
                    menuPortalTarget={document.body}
                  />
                </div>

                {/* Nationality */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-gray-700">
                    Nationality
                  </Label>
                  <Select
                    value={nationalityOptions.find(opt => opt.value === formData.nationality)}
                    onChange={(option) => handleSelectChange('nationality', option)}
                    options={nationalityOptions}
                    placeholder="Select nationality"
                    styles={{
                      ...selectStyles,
                      control: (base, state = {}) => ({
                        ...selectStyles.control(base, state),
                        minHeight: '40px',
                        height: '40px'
                      })
                    }}
                    className="react-select-container"
                    classNamePrefix="react-select"
                    menuPortalTarget={document.body}
                    isSearchable
                  />
                </div>

                {/* Is Newborn */}
                <div className="space-y-2 flex items-end">
                  <div className="flex items-center space-x-2 p-2 w-full">
                    <Checkbox
                      id="is_newborn"
                      checked={formData.is_newborn}
                      onCheckedChange={(checked) => handleChange('is_newborn', checked)}
                    />
                    <Label htmlFor="is_newborn" className="text-sm font-medium text-gray-700 cursor-pointer">
                      Is Newborn
                    </Label>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Identification */}
          <Card className="bg-white border border-gray-200 shadow-sm">
            <CardHeader className="pb-4 border-b border-gray-200">
              <CardTitle className="text-xl font-semibold text-gray-900">
                Identification
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Identifier */}
                <div className="space-y-2">
                  <Label htmlFor="identifier" className="text-sm font-medium text-gray-700">
                    Identifier (ID Number) <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="identifier"
                    value={formData.identifier}
                    onChange={(e) => handleChange('identifier', e.target.value)}
                    placeholder="e.g., 1234567890"
                    className={`h-10 ${errors.identifier ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : ''}`}
                  />
                  {errors.identifier && <p className="text-red-500 text-xs mt-1">{errors.identifier}</p>}
                </div>

                {/* Identifier Type */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-gray-700">
                    Identifier Type
                  </Label>
                  <Select
                    value={identifierTypeOptions.find(opt => opt.value === formData.identifier_type)}
                    onChange={(option) => handleSelectChange('identifier_type', option)}
                    options={identifierTypeOptions}
                    placeholder="Select type"
                    styles={{
                      ...selectStyles,
                      control: (base, state = {}) => ({
                        ...selectStyles.control(base, state),
                        minHeight: '40px',
                        height: '40px'
                      })
                    }}
                    className="react-select-container"
                    classNamePrefix="react-select"
                    menuPortalTarget={document.body}
                  />
                </div>

                {/* Identifier System */}
                <div className="space-y-2">
                  <Label htmlFor="identifier_system" className="text-sm font-medium text-gray-700">
                    Identifier System
                  </Label>
                  <Input
                    id="identifier_system"
                    value={formData.identifier_system}
                    onChange={(e) => handleChange('identifier_system', e.target.value)}
                    placeholder="e.g., http://nphies.sa/identifier/nationalid"
                    className="h-10"
                  />
                </div>

                {/* NPHIES Patient ID */}
                <div className="space-y-2">
                  <Label htmlFor="nphies_patient_id" className="text-sm font-medium text-gray-700">
                    NPHIES Patient ID
                  </Label>
                  <Input
                    id="nphies_patient_id"
                    value={formData.nphies_patient_id}
                    onChange={(e) => handleChange('nphies_patient_id', e.target.value)}
                    placeholder="NPHIES assigned ID"
                    className="h-10"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Contact Information */}
          <Card className="bg-white border border-gray-200 shadow-sm">
            <CardHeader className="pb-4 border-b border-gray-200">
              <CardTitle className="text-xl font-semibold text-gray-900">
                Contact Information
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Phone */}
                <div className="space-y-2">
                  <Label htmlFor="phone" className="text-sm font-medium text-gray-700">
                    Phone Number
                  </Label>
                  <Input
                    id="phone"
                    value={formData.phone}
                    onChange={(e) => handleChange('phone', e.target.value)}
                    placeholder="e.g., +966501234567"
                    className="h-10"
                  />
                </div>

                {/* Email */}
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-sm font-medium text-gray-700">
                    Email Address
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => handleChange('email', e.target.value)}
                    placeholder="e.g., patient@example.com"
                    className={`h-10 ${errors.email ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : ''}`}
                  />
                  {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email}</p>}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Address Information */}
          <Card className="bg-white border border-gray-200 shadow-sm">
            <CardHeader className="pb-4 border-b border-gray-200">
              <CardTitle className="text-xl font-semibold text-gray-900">
                Address Information
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* Address */}
                <div className="space-y-2 md:col-span-2 lg:col-span-3">
                  <Label htmlFor="address" className="text-sm font-medium text-gray-700">
                    Street Address
                  </Label>
                  <Input
                    id="address"
                    value={formData.address}
                    onChange={(e) => handleChange('address', e.target.value)}
                    placeholder="Enter street address"
                    className="h-10"
                  />
                </div>

                {/* City */}
                <div className="space-y-2">
                  <Label htmlFor="city" className="text-sm font-medium text-gray-700">
                    City
                  </Label>
                  <Input
                    id="city"
                    value={formData.city}
                    onChange={(e) => handleChange('city', e.target.value)}
                    placeholder="e.g., Riyadh"
                    className="h-10"
                  />
                </div>

                {/* Country */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-gray-700">
                    Country
                  </Label>
                  <Select
                    value={countryOptions.find(opt => opt.value === formData.country)}
                    onChange={(option) => handleSelectChange('country', option)}
                    options={countryOptions}
                    placeholder="Select country"
                    styles={{
                      ...selectStyles,
                      control: (base, state = {}) => ({
                        ...selectStyles.control(base, state),
                        minHeight: '40px',
                        height: '40px'
                      })
                    }}
                    className="react-select-container"
                    classNamePrefix="react-select"
                    menuPortalTarget={document.body}
                  />
                </div>

                {/* Occupation */}
                <div className="space-y-2">
                  <Label htmlFor="occupation" className="text-sm font-medium text-gray-700">
                    Occupation
                  </Label>
                  <Input
                    id="occupation"
                    value={formData.occupation}
                    onChange={(e) => handleChange('occupation', e.target.value)}
                    placeholder="e.g., Engineer"
                    className="h-10"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Form Actions */}
          <div className="flex flex-col sm:flex-row justify-end space-y-3 sm:space-y-0 sm:space-x-4 pt-4 pb-8">
            <button
              type="button"
              onClick={() => navigate('/patients')}
              className="px-6 py-2.5 text-gray-700 hover:text-gray-900 font-medium transition-colors border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="bg-gradient-to-r from-primary-purple to-accent-purple text-white px-6 py-2.5 rounded-lg transition-all duration-200 font-medium flex items-center justify-center space-x-2 hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  <span>{isEditMode ? 'Update Patient' : 'Create Patient'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
