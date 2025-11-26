import React, { useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import DatePicker from 'react-datepicker';
import Select from 'react-select';
import 'react-datepicker/dist/react-datepicker.css';
import '../styles/datepicker-custom.css';
import { Calendar } from 'lucide-react';
import ValidationMessage from '../shared/ValidationMessage';
import RequiredFieldIndicator from '../shared/RequiredFieldIndicator';
import {
  SERVICE_DESCRIPTIONS,
  BODY_PARTS,
  LATERALITY_OPTIONS,
  URGENCY_OPTIONS,
  ENCOUNTER_CLASS_OPTIONS,
  EMERGENCY_CARE_LEVEL_OPTIONS
} from '../config/wizardConfig';

/**
 * ServiceRequestStep Component
 * Step 4: Service details, diagnosis, and clinical information
 */
const ServiceRequestStep = React.memo(({ formData, setField, errors }) => {
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
  
  // Select styles
  const selectStyles = useMemo(() => ({
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
  }), []);
  
  // Conditional rendering checks
  const isEmergency = formData.service.emergencyCase;
  const isInpatient = formData.encounterClass === 'inpatient';
  const isPregnancy = formData.service.conditions.pregnancy;
  const isWorkRelated = formData.service.conditions.workRelated;
  
  return (
    <div className="space-y-6">
      {/* Encounter Information */}
      <Card>
        <CardHeader>
          <CardTitle>Encounter Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Encounter Class
              </label>
              <Select
                value={ENCOUNTER_CLASS_OPTIONS.find(opt => opt.value === formData.encounterClass)}
                onChange={(option) => setField('encounterClass', option?.value || 'outpatient')}
                options={ENCOUNTER_CLASS_OPTIONS}
                styles={selectStyles}
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Urgency
              </label>
              <Select
                value={URGENCY_OPTIONS.find(opt => opt.value === formData.service.urgency)}
                onChange={(option) => setField('service.urgency', option?.value || 'routine')}
                options={URGENCY_OPTIONS}
                styles={selectStyles}
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Encounter Start
              </label>
              <div className="datepicker-wrapper">
                <DatePicker
                  selected={parseDate(formData.encounterStart)}
                  onChange={(date) => setField('encounterStart', formatDate(date))}
                  dateFormat="yyyy-MM-dd"
                  className="w-full rounded-[4px] border border-gray-200 bg-gray-50 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-purple/30"
                  placeholderText="YYYY-MM-DD"
                />
                <Calendar className="datepicker-icon h-4 w-4" />
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Encounter End
              </label>
              <div className="datepicker-wrapper">
                <DatePicker
                  selected={parseDate(formData.encounterEnd)}
                  onChange={(date) => setField('encounterEnd', formatDate(date))}
                  dateFormat="yyyy-MM-dd"
                  className="w-full rounded-[4px] border border-gray-200 bg-gray-50 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-purple/30"
                  placeholderText="YYYY-MM-DD"
                  minDate={parseDate(formData.encounterStart) || undefined}
                />
                <Calendar className="datepicker-icon h-4 w-4" />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Service Request */}
      <Card>
        <CardHeader>
          <CardTitle>Service Request</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Service Description (Scan Type) <RequiredFieldIndicator />
                </label>
                <Select
                  value={SERVICE_DESCRIPTIONS.find(opt => opt.value === formData.service.description)}
                  onChange={(option) => setField('service.description', option?.value || '')}
                  options={SERVICE_DESCRIPTIONS}
                  styles={selectStyles}
                  isClearable
                  className={errors['service.description'] ? 'border border-red-500 rounded-[4px]' : ''}
                />
                <ValidationMessage error={errors['service.description']} />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Body Part <RequiredFieldIndicator />
                </label>
                <Select
                  value={BODY_PARTS.find(opt => opt.value === formData.service.bodyPart)}
                  onChange={(option) => setField('service.bodyPart', option?.value || '')}
                  options={BODY_PARTS}
                  styles={selectStyles}
                  isClearable
                  className={errors['service.bodyPart'] ? 'border border-red-500 rounded-[4px]' : ''}
                />
                <ValidationMessage error={errors['service.bodyPart']} />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Laterality
                </label>
                <Select
                  value={LATERALITY_OPTIONS.find(opt => opt.value === formData.service.laterality)}
                  onChange={(option) => setField('service.laterality', option?.value || 'left')}
                  options={LATERALITY_OPTIONS}
                  styles={selectStyles}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Start Date
                </label>
                <div className="datepicker-wrapper">
                  <DatePicker
                    selected={parseDate(formData.service.startDate)}
                    onChange={(date) => setField('service.startDate', formatDate(date))}
                    dateFormat="yyyy-MM-dd"
                    className="w-full rounded-[4px] border border-gray-200 bg-gray-50 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-purple/30"
                    placeholderText="YYYY-MM-DD"
                  />
                  <Calendar className="datepicker-icon h-4 w-4" />
                </div>
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Diagnosis <RequiredFieldIndicator />
              </label>
              <textarea
                value={formData.service.diagnosis}
                onChange={(e) => setField('service.diagnosis', e.target.value)}
                rows="3"
                className={`w-full rounded-[4px] border ${errors['service.diagnosis'] ? 'border-red-500' : 'border-gray-200'} bg-gray-50 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-purple/30`}
                placeholder="Primary diagnosis for this request..."
              />
              <ValidationMessage error={errors['service.diagnosis']} />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Previous Tests
              </label>
              <textarea
                value={formData.service.previousTest}
                onChange={(e) => setField('service.previousTest', e.target.value)}
                rows="2"
                className="w-full rounded-[4px] border border-gray-200 bg-gray-50 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-purple/30"
                placeholder="Previously conducted tests..."
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Test Results
              </label>
              <textarea
                value={formData.service.testResults}
                onChange={(e) => setField('service.testResults', e.target.value)}
                rows="2"
                className="w-full rounded-[4px] border border-gray-200 bg-gray-50 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-purple/30"
                placeholder="Results from previous tests..."
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Medical Plan
              </label>
              <textarea
                value={formData.service.medicalPlan}
                onChange={(e) => setField('service.medicalPlan', e.target.value)}
                rows="3"
                className="w-full rounded-[4px] border border-gray-200 bg-gray-50 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-purple/30"
                placeholder="Treatment plan and next steps..."
              />
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Emergency Case */}
      <Card>
        <CardHeader>
          <CardTitle>Emergency Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center">
              <input
                type="checkbox"
                id="emergencyCase"
                checked={formData.service.emergencyCase}
                onChange={(e) => setField('service.emergencyCase', e.target.checked)}
                className="h-4 w-4 text-primary-purple focus:ring-primary-purple border-gray-300 rounded"
              />
              <label htmlFor="emergencyCase" className="ml-2 block text-sm text-gray-900">
                This is an emergency case
              </label>
            </div>
            
            {isEmergency && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Emergency Care Level
                </label>
                <Select
                  value={EMERGENCY_CARE_LEVEL_OPTIONS.find(opt => opt.value === formData.service.emergencyCareLevel)}
                  onChange={(option) => setField('service.emergencyCareLevel', option?.value || '')}
                  options={EMERGENCY_CARE_LEVEL_OPTIONS}
                  styles={selectStyles}
                  isClearable
                />
              </div>
            )}
          </div>
        </CardContent>
      </Card>
      
      {/* Inpatient-specific fields */}
      {isInpatient && (
        <Card>
          <CardHeader>
            <CardTitle>Inpatient Details</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Estimated Length of Stay (Days)
                </label>
                <input
                  type="number"
                  value={formData.service.estimatedLengthOfStayDays}
                  onChange={(e) => setField('service.estimatedLengthOfStayDays', e.target.value)}
                  className="w-full rounded-[4px] border border-gray-200 bg-gray-50 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-purple/30"
                  placeholder="Number of days"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Expected Date of Admission
                </label>
                <div className="datepicker-wrapper">
                  <DatePicker
                    selected={parseDate(formData.service.expectedDateOfAdmission)}
                    onChange={(date) => setField('service.expectedDateOfAdmission', formatDate(date))}
                    dateFormat="yyyy-MM-dd"
                    className="w-full rounded-[4px] border border-gray-200 bg-gray-50 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-purple/30"
                    placeholderText="YYYY-MM-DD"
                    minDate={new Date()}
                  />
                  <Calendar className="datepicker-icon h-4 w-4" />
                </div>
              </div>
              
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Possible Line of Management
                </label>
                <textarea
                  value={formData.service.possibleLineOfManagement}
                  onChange={(e) => setField('service.possibleLineOfManagement', e.target.value)}
                  rows="3"
                  className="w-full rounded-[4px] border border-gray-200 bg-gray-50 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-purple/30"
                  placeholder="Treatment plan for inpatient care..."
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}
      
      {/* Conditions */}
      <Card>
        <CardHeader>
          <CardTitle>Service Conditions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {Object.entries(formData.service.conditions).map(([key, value]) => (
              <div key={key} className="flex items-center">
                <input
                  type="checkbox"
                  id={`condition-${key}`}
                  checked={value}
                  onChange={(e) => setField(`service.conditions.${key}`, e.target.checked)}
                  className="h-4 w-4 text-primary-purple focus:ring-primary-purple border-gray-300 rounded"
                />
                <label htmlFor={`condition-${key}`} className="ml-2 block text-sm text-gray-900 capitalize">
                  {key.replace(/([A-Z])/g, ' $1').trim()}
                </label>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
      
      {/* Coding */}
      <Card>
        <CardHeader>
          <CardTitle>Medical Coding</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                CPT Codes
              </label>
              <input
                type="text"
                value={formData.service.cptCodes}
                onChange={(e) => setField('service.cptCodes', e.target.value)}
                className="w-full rounded-[4px] border border-gray-200 bg-gray-50 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-purple/30"
                placeholder="e.g. 70450, 70460"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                ICD-10 Codes
              </label>
              <input
                type="text"
                value={formData.service.icd10Codes}
                onChange={(e) => setField('service.icd10Codes', e.target.value)}
                className="w-full rounded-[4px] border border-gray-200 bg-gray-50 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-purple/30"
                placeholder="e.g. S82.101A"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Principal Code
              </label>
              <input
                type="text"
                value={formData.service.principalCode}
                onChange={(e) => setField('service.principalCode', e.target.value)}
                className="w-full rounded-[4px] border border-gray-200 bg-gray-50 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-purple/30"
                placeholder="Primary diagnosis code"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Secondary Code
              </label>
              <input
                type="text"
                value={formData.service.secondCode}
                onChange={(e) => setField('service.secondCode', e.target.value)}
                className="w-full rounded-[4px] border border-gray-200 bg-gray-50 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-purple/30"
                placeholder="Secondary diagnosis code"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Third Code
              </label>
              <input
                type="text"
                value={formData.service.thirdCode}
                onChange={(e) => setField('service.thirdCode', e.target.value)}
                className="w-full rounded-[4px] border border-gray-200 bg-gray-50 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-purple/30"
                placeholder="Third diagnosis code"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Fourth Code
              </label>
              <input
                type="text"
                value={formData.service.fourthCode}
                onChange={(e) => setField('service.fourthCode', e.target.value)}
                className="w-full rounded-[4px] border border-gray-200 bg-gray-50 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-purple/30"
                placeholder="Fourth diagnosis code"
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
});

ServiceRequestStep.displayName = 'ServiceRequestStep';

export default ServiceRequestStep;

