import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Select from 'react-select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Save,
  ArrowLeft,
  Loader2,
  AlertCircle,
  Shield
} from 'lucide-react';
import api, { extractErrorMessage } from '@/services/api';
import { selectStyles } from '@/components/prior-auth/styles';

export default function InsurerForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEditMode = Boolean(id);

  const [loading, setLoading] = useState(isEditMode);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [formData, setFormData] = useState({
    insurer_name: '',
    nphies_id: '',
    status: 'Active',
    contact_person: '',
    phone: '',
    email: '',
    address: '',
    plan_type: ''
  });
  const [errors, setErrors] = useState({});

  // Options for dropdowns
  const statusOptions = [
    { value: 'Active', label: 'Active' },
    { value: 'Inactive', label: 'Inactive' },
    { value: 'Suspended', label: 'Suspended' },
    { value: 'Pending', label: 'Pending' }
  ];

  const planTypeOptions = [
    { value: 'HMO', label: 'HMO (Health Maintenance Organization)' },
    { value: 'PPO', label: 'PPO (Preferred Provider Organization)' },
    { value: 'EPO', label: 'EPO (Exclusive Provider Organization)' },
    { value: 'POS', label: 'POS (Point of Service)' },
    { value: 'Comprehensive', label: 'Comprehensive' },
    { value: 'Basic', label: 'Basic' },
    { value: 'Premium', label: 'Premium' }
  ];

  useEffect(() => {
    if (isEditMode) {
      loadInsurer();
    }
  }, [id]);

  const loadInsurer = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.getInsurer(id);
      const insurer = response.data || response;
      setFormData({
        insurer_name: insurer.insurer_name || '',
        nphies_id: insurer.nphies_id || '',
        status: insurer.status || 'Active',
        contact_person: insurer.contact_person || '',
        phone: insurer.phone || '',
        email: insurer.email || '',
        address: insurer.address || '',
        plan_type: insurer.plan_type || ''
      });
    } catch (err) {
      console.error('Error loading insurer:', err);
      setError(extractErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: null }));
    }
  };

  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.insurer_name?.trim()) {
      newErrors.insurer_name = 'Insurer name is required';
    }
    
    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Invalid email format';
    }
    
    if (formData.phone && !/^[\d\s+\-()]+$/.test(formData.phone)) {
      newErrors.phone = 'Invalid phone format';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    try {
      setSaving(true);
      setError(null);

      // Prepare data for submission
      const submitData = { ...formData };
      
      // Remove empty strings
      Object.keys(submitData).forEach(key => {
        if (submitData[key] === '') {
          submitData[key] = null;
        }
      });

      if (isEditMode) {
        await api.updateInsurer(id, submitData);
      } else {
        await api.createInsurer(submitData);
      }

      navigate('/insurers', { 
        state: { message: `Insurer ${isEditMode ? 'updated' : 'created'} successfully!` }
      });
    } catch (err) {
      console.error('Error saving insurer:', err);
      setError(extractErrorMessage(err));
    } finally {
      setSaving(false);
    }
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
      <div className="mx-auto space-y-6">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => navigate('/insurers')}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                title="Back to insurers"
              >
                <ArrowLeft className="h-5 w-5 text-gray-600" />
              </button>
              <div className="flex items-center space-x-3">
                <div className="relative bg-gradient-to-br from-primary-purple/10 to-accent-purple/10 rounded-lg p-2">
                  <Shield className="h-6 w-6 text-primary-purple" />
                </div>
                <div>
                  <h1 className="text-3xl font-bold text-gray-900">
                    {isEditMode ? 'Edit Insurer' : 'New Insurer'}
                  </h1>
                  <p className="text-gray-600 mt-1">
                    {isEditMode ? 'Update insurer information' : 'Register a new insurance provider'}
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
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <Card className="bg-white border border-gray-200 shadow-sm">
            <CardHeader className="pb-4 border-b border-gray-200">
              <CardTitle className="text-xl font-semibold text-gray-900">
                Insurer Information
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* Insurer Name */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-gray-700">
                    Insurer Name <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    value={formData.insurer_name}
                    onChange={(e) => handleChange('insurer_name', e.target.value)}
                    placeholder="Enter insurer name"
                    className={`h-10 ${errors.insurer_name ? 'border-red-500' : ''}`}
                  />
                  {errors.insurer_name && <p className="text-red-500 text-xs mt-1">{errors.insurer_name}</p>}
                </div>

                {/* NPHIES ID */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-gray-700">NPHIES ID</Label>
                  <Input
                    value={formData.nphies_id}
                    onChange={(e) => handleChange('nphies_id', e.target.value)}
                    placeholder="Enter NPHIES ID"
                    className="h-10"
                  />
                </div>

                {/* Status */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-gray-700">Status</Label>
                  <Select
                    value={statusOptions.find(opt => opt.value === formData.status) || null}
                    onChange={(option) => handleChange('status', option?.value || 'Active')}
                    options={statusOptions}
                    styles={selectStyles}
                    placeholder="Select status"
                  />
                </div>

                {/* Plan Type */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-gray-700">Plan Type</Label>
                  <Select
                    value={planTypeOptions.find(opt => opt.value === formData.plan_type) || null}
                    onChange={(option) => handleChange('plan_type', option?.value || '')}
                    options={planTypeOptions}
                    styles={selectStyles}
                    placeholder="Select plan type"
                    isClearable
                  />
                </div>

                {/* Contact Person */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-gray-700">Contact Person</Label>
                  <Input
                    value={formData.contact_person}
                    onChange={(e) => handleChange('contact_person', e.target.value)}
                    placeholder="Enter contact person name"
                    className="h-10"
                  />
                </div>

                {/* Phone */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-gray-700">Phone Number</Label>
                  <Input
                    value={formData.phone}
                    onChange={(e) => handleChange('phone', e.target.value)}
                    placeholder="+966XXXXXXXXX"
                    className={`h-10 ${errors.phone ? 'border-red-500' : ''}`}
                  />
                  {errors.phone && <p className="text-red-500 text-xs mt-1">{errors.phone}</p>}
                </div>

                {/* Email */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-gray-700">Email Address</Label>
                  <Input
                    type="email"
                    value={formData.email}
                    onChange={(e) => handleChange('email', e.target.value)}
                    placeholder="email@example.com"
                    className={`h-10 ${errors.email ? 'border-red-500' : ''}`}
                  />
                  {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email}</p>}
                </div>

                {/* Address - Full Width */}
                <div className="space-y-2 md:col-span-2 lg:col-span-2">
                  <Label className="text-sm font-medium text-gray-700">Address</Label>
                  <Input
                    value={formData.address}
                    onChange={(e) => handleChange('address', e.target.value)}
                    placeholder="Enter full address"
                    className="h-10"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <div className="flex justify-end space-x-4 mt-6">
            <button
              type="button"
              onClick={() => navigate('/insurers')}
              className="px-6 py-2.5 text-gray-600 hover:text-gray-800 font-medium transition-colors border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="bg-primary-purple hover:bg-primary-purple/90 text-white px-6 py-2.5 rounded-lg transition-colors font-medium flex items-center space-x-2 disabled:opacity-50"
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  <span>{isEditMode ? 'Update Insurer' : 'Create Insurer'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

