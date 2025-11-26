import React, { useCallback, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import DatePicker from 'react-datepicker';
import Select from 'react-select';
import 'react-datepicker/dist/react-datepicker.css';
import '../styles/datepicker-custom.css';
import { Calendar } from 'lucide-react';
import ValidationMessage from '../shared/ValidationMessage';
import RequiredFieldIndicator from '../shared/RequiredFieldIndicator';
import { COVERAGE_TYPE_OPTIONS } from '../config/wizardConfig';
import api from '@/services/api';

/**
 * CoverageStep Component
 * Step 2: Insurance and coverage details
 */
const CoverageStep = React.memo(({ formData, setField, errors }) => {
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
  
  // Fetch insurer data from backend
  const fetchInsurer = useCallback(async () => {
    const nameOrId = formData.coverage.insurer?.trim();
    if (!nameOrId) {
      setFetchStatus({ type: 'error', message: 'Enter Insurance Company name or ID to fetch.' });
      return;
    }
    try {
      setFetchStatus({ type: 'idle', message: 'Fetching insurer…' });
      let data;
      
      // Check if input looks like a UUID (insurer_id)
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(nameOrId);
      
      if (isUUID) {
        // Try to get by ID first if it looks like a UUID
        try {
          data = await api.getInsurer(nameOrId);
        } catch (error) {
          // Fall back to search if ID lookup fails
          try {
            const res = await api.getInsurers({ search: nameOrId, limit: 1 });
            if (res?.data && Array.isArray(res.data) && res.data.length > 0) {
              data = res.data[0];
            } else if (Array.isArray(res) && res.length > 0) {
              data = res[0];
            } else {
              throw new Error('Insurer not found');
            }
          } catch {
            throw error; // Throw original error
          }
        }
      } else {
        // Search by name directly
        const res = await api.getInsurers({ search: nameOrId, limit: 1 });
        if (res?.data && Array.isArray(res.data) && res.data.length > 0) {
          data = res.data[0];
        } else if (Array.isArray(res) && res.length > 0) {
          data = res[0];
        } else {
          throw new Error('Insurer not found');
        }
      }
      
      // Check for error response
      if (data?.error) {
        throw new Error(data.error);
      }
      
      if (!data) {
        throw new Error('Insurer not found');
      }
      
      // Handle both direct response and wrapped response
      const insurer = data.data || data;
      
      // Store the insurer UUID for database foreign key
      if (insurer.insurer_id) {
        setField('coverage.insurer_id', insurer.insurer_id);
      }
      
      // Map fields with fallbacks
      setField('coverage.insurer', insurer.name || insurer.insurer_name || '');
      setField('coverage.contactPerson', insurer.contact_person || insurer.contactPerson || '');
      setField('coverage.phone', insurer.phone || insurer.contact_phone || '');
      setField('coverage.coverageType', insurer.plan_type || insurer.coverageType || '');
      
      setFetchStatus({ type: 'success', message: 'Insurer info retrieved successfully.' });
    } catch (e) {
      console.error('Error fetching insurer:', e);
      setFetchStatus({ type: 'error', message: e?.message || 'Failed to fetch insurer' });
    }
  }, [formData.coverage.insurer, setField]);
  
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
  
  // Check if TPA coverage type is selected
  const isTPA = formData.coverage.coverageType === 'TPA';
  
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
      
      {/* Coverage Information */}
      <Card>
        <CardHeader>
          <CardTitle>Insurance Coverage</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Insurer <RequiredFieldIndicator />
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={formData.coverage.insurer}
                  onChange={(e) => setField('coverage.insurer', e.target.value)}
                  className={`flex-1 rounded-[4px] border ${errors['coverage.insurer'] ? 'border-red-500' : 'border-gray-200'} bg-gray-50 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-purple/30`}
                  placeholder="e.g. Bupa Arabia"
                />
                <button
                  type="button"
                  onClick={fetchInsurer}
                  className="px-4 py-2 rounded-lg bg-primary-purple text-white hover:opacity-90 transition whitespace-nowrap"
                >
                  Fetch
                </button>
              </div>
              <ValidationMessage error={errors['coverage.insurer']} />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Policy Number <RequiredFieldIndicator />
              </label>
              <input
                type="text"
                value={formData.coverage.policyNumber}
                onChange={(e) => setField('coverage.policyNumber', e.target.value)}
                className={`w-full rounded-[4px] border ${errors['coverage.policyNumber'] ? 'border-red-500' : 'border-gray-200'} bg-gray-50 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-purple/30`}
                placeholder="Policy/Member ID"
              />
              <ValidationMessage error={errors['coverage.policyNumber']} />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Coverage Type
              </label>
              <Select
                value={COVERAGE_TYPE_OPTIONS.find(opt => opt.value === formData.coverage.coverageType)}
                onChange={(option) => setField('coverage.coverageType', option?.value || '')}
                options={COVERAGE_TYPE_OPTIONS}
                styles={selectStyles}
                isClearable
              />
            </div>
            
            {/* Conditional TPA field */}
            {isTPA && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  TPA Company Name
                </label>
                <input
                  type="text"
                  value={formData.coverage.tpaCompanyName}
                  onChange={(e) => setField('coverage.tpaCompanyName', e.target.value)}
                  className="w-full rounded-[4px] border border-gray-200 bg-gray-50 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-purple/30"
                  placeholder="Third Party Administrator name"
                />
              </div>
            )}
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Policy Holder
              </label>
              <input
                type="text"
                value={formData.coverage.policyHolder}
                onChange={(e) => setField('coverage.policyHolder', e.target.value)}
                className="w-full rounded-[4px] border border-gray-200 bg-gray-50 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-purple/30"
                placeholder="Name of policy holder"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Expiry Date
              </label>
              <div className="datepicker-wrapper">
                <DatePicker
                  selected={parseDate(formData.coverage.expiryDate)}
                  onChange={(date) => setField('coverage.expiryDate', formatDate(date))}
                  dateFormat="yyyy-MM-dd"
                  className="w-full rounded-[4px] border border-gray-200 bg-gray-50 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-purple/30"
                  placeholderText="YYYY-MM-DD"
                  minDate={new Date()}
                />
                <Calendar className="datepicker-icon h-4 w-4" />
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Contact Person
              </label>
              <input
                type="text"
                value={formData.coverage.contactPerson}
                onChange={(e) => setField('coverage.contactPerson', e.target.value)}
                className="w-full rounded-[4px] border border-gray-200 bg-gray-50 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-purple/30"
                placeholder="Contact at insurer"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Phone
              </label>
              <input
                type="tel"
                value={formData.coverage.phone}
                onChange={(e) => setField('coverage.phone', e.target.value)}
                className="w-full rounded-[4px] border border-gray-200 bg-gray-50 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-purple/30"
                placeholder="+966 XX XXX XXXX"
              />
            </div>
            
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Approval Field
              </label>
              <textarea
                value={formData.coverage.approvalField}
                onChange={(e) => setField('coverage.approvalField', e.target.value)}
                rows="3"
                className="w-full rounded-[4px] border border-gray-200 bg-gray-50 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-purple/30"
                placeholder="Pre-authorization or approval details..."
              />
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Insured Information */}
      <Card>
        <CardHeader>
          <CardTitle>Insured Person Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Insured Name
              </label>
              <input
                type="text"
                value={formData.insured.name}
                onChange={(e) => setField('insured.name', e.target.value)}
                className="w-full rounded-[4px] border border-gray-200 bg-gray-50 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-purple/30"
                placeholder="Name on insurance card"
              />
              <p className="text-xs text-gray-500 mt-1">If different from patient</p>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                ID Card Number
              </label>
              <input
                type="text"
                value={formData.insured.idCardNumber}
                onChange={(e) => setField('insured.idCardNumber', e.target.value)}
                className="w-full rounded-[4px] border border-gray-200 bg-gray-50 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-purple/30"
                placeholder="Insurance card number"
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
});

CoverageStep.displayName = 'CoverageStep';

export default CoverageStep;

