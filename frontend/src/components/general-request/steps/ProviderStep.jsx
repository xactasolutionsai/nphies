import React, { useCallback, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import '../styles/datepicker-custom.css';
import { Calendar } from 'lucide-react';
import ValidationMessage from '../shared/ValidationMessage';
import RequiredFieldIndicator from '../shared/RequiredFieldIndicator';
import api from '@/services/api';

/**
 * ProviderStep Component
 * Step 3: Provider and facility information
 */
const ProviderStep = React.memo(({ formData, setField, errors }) => {
  const [fetchStatus, setFetchStatus] = useState({ type: 'idle', message: '' });
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
  
  // Fetch provider data from backend
  const fetchProvider = useCallback(async () => {
    const license = formData.provider.licenseNumber?.trim();
    if (!license) {
      setFetchStatus({ type: 'error', message: 'Enter License/NPI to fetch provider.' });
      return;
    }
    try {
      setFetchStatus({ type: 'idle', message: 'Fetching provider…' });
      
      let data;
      try {
        data = await api.getProvider(license);
      } catch (error) {
        // Try search fallback
        try {
          const res = await api.getProviders({ license: license, limit: 1 });
          if (res?.data && Array.isArray(res.data) && res.data.length > 0) {
            data = res.data[0];
          } else if (Array.isArray(res) && res.length > 0) {
            data = res[0];
          } else {
            throw new Error('Provider not found');
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
        throw new Error('Provider not found');
      }
      
      // Handle both direct response and wrapped response
      const provider = data.data || data;
      
      // Store the provider UUID for database foreign key
      if (provider.provider_id) {
        setField('provider.provider_id', provider.provider_id);
      }
      
      // Map fields with fallbacks
      setField('provider.facilityName', provider.facility_name || provider.facilityName || provider.name || '');
      setField('provider.doctorName', provider.doctor_name || provider.doctorName || provider.contact_person || '');
      setField('provider.department', provider.department || '');
      setField('provider.contactPhone', provider.phone || provider.contactPhone || provider.contact_phone || '');
      setField('provider.email', provider.email || '');
      
      setFetchStatus({ type: 'success', message: 'Provider info retrieved successfully.' });
    } catch (e) {
      console.error('Error fetching provider:', e);
      setFetchStatus({ type: 'error', message: e?.message || 'Failed to fetch provider' });
    }
  }, [formData.provider.licenseNumber, setField]);
  
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
      
      {/* Provider Information */}
      <Card>
        <CardHeader>
          <CardTitle>Healthcare Provider</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Facility Name <RequiredFieldIndicator />
              </label>
              <input
                type="text"
                value={formData.provider.facilityName}
                onChange={(e) => setField('provider.facilityName', e.target.value)}
                className={`w-full rounded-[4px] border ${errors['provider.facilityName'] ? 'border-red-500' : 'border-gray-200'} bg-gray-50 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-purple/30`}
                placeholder="e.g. King Faisal Hospital"
              />
              <ValidationMessage error={errors['provider.facilityName']} />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Doctor Name <RequiredFieldIndicator />
              </label>
              <input
                type="text"
                value={formData.provider.doctorName}
                onChange={(e) => setField('provider.doctorName', e.target.value)}
                className={`w-full rounded-[4px] border ${errors['provider.doctorName'] ? 'border-red-500' : 'border-gray-200'} bg-gray-50 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-purple/30`}
                placeholder="e.g. Dr. Sara Al-Shehri"
              />
              <ValidationMessage error={errors['provider.doctorName']} />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                License/NPI <RequiredFieldIndicator />
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={formData.provider.licenseNumber}
                  onChange={(e) => setField('provider.licenseNumber', e.target.value)}
                  className={`flex-1 rounded-[4px] border ${errors['provider.licenseNumber'] ? 'border-red-500' : 'border-gray-200'} bg-gray-50 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-purple/30`}
                  placeholder="e.g. 12-345678"
                />
                <button
                  type="button"
                  onClick={fetchProvider}
                  className="px-4 py-2 rounded-lg bg-primary-purple text-white hover:opacity-90 transition whitespace-nowrap"
                >
                  Fetch
                </button>
              </div>
              <ValidationMessage error={errors['provider.licenseNumber']} />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Department
              </label>
              <input
                type="text"
                value={formData.provider.department}
                onChange={(e) => setField('provider.department', e.target.value)}
                className="w-full rounded-[4px] border border-gray-200 bg-gray-50 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-purple/30"
                placeholder="e.g. Radiology"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Contact Phone
              </label>
              <input
                type="tel"
                value={formData.provider.contactPhone}
                onChange={(e) => setField('provider.contactPhone', e.target.value)}
                className={`w-full rounded-[4px] border ${errors['provider.contactPhone'] ? 'border-red-500' : 'border-gray-200'} bg-gray-50 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-purple/30`}
                placeholder="+966 XX XXX XXXX"
              />
              <ValidationMessage error={errors['provider.contactPhone']} />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <input
                type="email"
                value={formData.provider.email}
                onChange={(e) => setField('provider.email', e.target.value)}
                className={`w-full rounded-[4px] border ${errors['provider.email'] ? 'border-red-500' : 'border-gray-200'} bg-gray-50 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-purple/30`}
                placeholder="referral@hospital.sa"
              />
              <ValidationMessage error={errors['provider.email']} />
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Provider Approval */}
      <Card>
        <CardHeader>
          <CardTitle>Provider Approval & Signature</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Completed/Coded By
              </label>
              <input
                type="text"
                value={formData.provider.completedCodedBy}
                onChange={(e) => setField('provider.completedCodedBy', e.target.value)}
                className="w-full rounded-[4px] border border-gray-200 bg-gray-50 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-purple/30"
                placeholder="Staff name"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Signature
              </label>
              <input
                type="text"
                value={formData.provider.signature}
                onChange={(e) => setField('provider.signature', e.target.value)}
                className="w-full rounded-[4px] border border-gray-200 bg-gray-50 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-purple/30"
                placeholder="Digital signature or name"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Date
              </label>
              <div className="datepicker-wrapper">
                <DatePicker
                  selected={parseDate(formData.provider.date)}
                  onChange={(date) => setField('provider.date', formatDate(date))}
                  dateFormat="yyyy-MM-dd"
                  className="w-full rounded-[4px] border border-gray-200 bg-gray-50 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-purple/30"
                  placeholderText="YYYY-MM-DD"
                  maxDate={new Date()}
                />
                <Calendar className="datepicker-icon h-4 w-4" />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
});

ProviderStep.displayName = 'ProviderStep';

export default ProviderStep;

