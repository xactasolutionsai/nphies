import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import DatePicker from 'react-datepicker';
import Select from 'react-select';
import 'react-datepicker/dist/react-datepicker.css';
import api from '@/services/api';
import { 
  Save, Send, ArrowLeft, Plus, Trash2, FileText, User, Building, 
  Shield, Stethoscope, Activity, Receipt, Paperclip, Eye, Pill,
  Calendar, DollarSign, AlertCircle, CheckCircle, XCircle, Copy
} from 'lucide-react';

// Custom CSS for DatePicker
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

// Select styles matching the design system
const selectStyles = {
  control: (base, state) => ({
    ...base,
    minHeight: '42px',
    borderColor: '#e5e7eb',
    borderRadius: '6px',
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

// Dropdown options
const AUTH_TYPE_OPTIONS = [
  { value: 'institutional', label: 'Institutional' },
  { value: 'professional', label: 'Professional' },
  { value: 'pharmacy', label: 'Pharmacy' },
  { value: 'dental', label: 'Dental' },
  { value: 'vision', label: 'Vision' }
];

const PRIORITY_OPTIONS = [
  { value: 'stat', label: 'STAT (Urgent)' },
  { value: 'normal', label: 'Normal' },
  { value: 'deferred', label: 'Deferred' }
];

const ENCOUNTER_CLASS_OPTIONS = [
  { value: 'inpatient', label: 'Inpatient (IMP)' },
  { value: 'outpatient', label: 'Outpatient' },
  { value: 'ambulatory', label: 'Ambulatory (AMB)' },
  { value: 'daycase', label: 'Day Case (SS)' },
  { value: 'emergency', label: 'Emergency (EMER)' },
  { value: 'home', label: 'Home Healthcare (HH)' },
  { value: 'telemedicine', label: 'Telemedicine (VR)' }
];

const CURRENCY_OPTIONS = [
  { value: 'SAR', label: 'SAR - Saudi Riyal' },
  { value: 'USD', label: 'USD - US Dollar' }
];

const DIAGNOSIS_TYPE_OPTIONS = [
  { value: 'principal', label: 'Principal' },
  { value: 'secondary', label: 'Secondary' },
  { value: 'admitting', label: 'Admitting' },
  { value: 'discharge', label: 'Discharge' }
];

const EYE_OPTIONS = [
  { value: 'left', label: 'Left' },
  { value: 'right', label: 'Right' },
  { value: 'both', label: 'Both' }
];

const SUPPORTING_INFO_CATEGORY_OPTIONS = [
  { value: 'info', label: 'General Info' },
  { value: 'days-supply', label: 'Days Supply' },
  { value: 'attachment', label: 'Attachment' },
  { value: 'clinical-notes', label: 'Clinical Notes' },
  { value: 'onset', label: 'Onset' },
  { value: 'related-claim', label: 'Related Claim' }
];

// Helper functions
const formatAmount = (amount, currency = 'SAR') => {
  if (amount == null || amount === '') return `0.00 ${currency}`;
  return `${parseFloat(amount).toFixed(2)} ${currency}`;
};

const getInitialItemData = (sequence) => ({
  sequence,
  product_or_service_code: '',
  product_or_service_display: '',
  quantity: 1,
  unit_price: '',
  net_amount: ''
});

const getInitialDiagnosisData = (sequence) => ({
  sequence,
  diagnosis_code: '',
  diagnosis_display: '',
  diagnosis_type: 'principal'
});

const getInitialSupportingInfoData = (sequence, category = 'info') => ({
  sequence,
  category,
  code: '',
  value_string: '',
  value_quantity: ''
});

// Tab Button Component
const TabButton = ({ active, onClick, icon: Icon, children }) => (
  <button
    type="button"
    onClick={onClick}
    className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
      active 
        ? 'bg-primary-purple text-white' 
        : 'text-gray-600 hover:bg-gray-100'
    }`}
  >
    {Icon && <Icon className="h-4 w-4" />}
    {children}
  </button>
);

export default function PriorAuthorizationForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditMode = !!id;

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [errors, setErrors] = useState([]);
  const [activeTab, setActiveTab] = useState('basic');
  
  // Preview state
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewData, setPreviewData] = useState(null);
  const [showPreview, setShowPreview] = useState(false);
  
  // Reference data
  const [patients, setPatients] = useState([]);
  const [providers, setProviders] = useState([]);
  const [insurers, setInsurers] = useState([]);

  // Form data
  const [formData, setFormData] = useState({
    auth_type: 'professional',
    status: 'draft',
    priority: 'normal',
    currency: 'SAR',
    encounter_class: 'ambulatory',
    patient_id: '',
    provider_id: '',
    insurer_id: '',
    diagnosis_codes: '',
    primary_diagnosis: '',
    total_amount: '',
    eligibility_ref: '',
    encounter_start: '',
    encounter_end: '',
    items: [getInitialItemData(1)],
    supporting_info: [],
    diagnoses: [getInitialDiagnosisData(1)],
    attachments: []
  });

  useEffect(() => {
    loadReferenceData();
    if (isEditMode) {
      loadPriorAuthorization();
    }
  }, [id]);

  const loadReferenceData = async () => {
    try {
      const [patientsRes, providersRes, insurersRes] = await Promise.all([
        api.getPatients({ limit: 1000 }),
        api.getProviders({ limit: 1000 }),
        api.getInsurers({ limit: 1000 })
      ]);
      setPatients(patientsRes?.data || []);
      setProviders(providersRes?.data || []);
      setInsurers(insurersRes?.data || []);
    } catch (error) {
      console.error('Error loading reference data:', error);
    }
  };

  const loadPriorAuthorization = async () => {
    try {
      setLoading(true);
      const response = await api.getPriorAuthorization(id);
      const data = response.data;
      
      setFormData({
        ...data,
        items: data.items?.length > 0 ? data.items : [getInitialItemData(1)],
        diagnoses: data.diagnoses?.length > 0 ? data.diagnoses : [getInitialDiagnosisData(1)],
        supporting_info: data.supporting_info || [],
        attachments: data.attachments || []
      });
    } catch (error) {
      console.error('Error loading prior authorization:', error);
      alert('Error loading prior authorization');
      navigate('/prior-authorizations');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleItemChange = (index, field, value) => {
    setFormData(prev => {
      const newItems = [...prev.items];
      newItems[index] = { ...newItems[index], [field]: value };
      
      // Auto-calculate net amount
      if (field === 'quantity' || field === 'unit_price') {
        const qty = field === 'quantity' ? value : newItems[index].quantity;
        const price = field === 'unit_price' ? value : newItems[index].unit_price;
        newItems[index].net_amount = (parseFloat(qty) || 0) * (parseFloat(price) || 0);
      }
      
      return { ...prev, items: newItems };
    });
  };

  const addItem = () => {
    setFormData(prev => ({
      ...prev,
      items: [...prev.items, getInitialItemData(prev.items.length + 1)]
    }));
  };

  const removeItem = (index) => {
    if (formData.items.length > 1) {
      setFormData(prev => ({
        ...prev,
        items: prev.items.filter((_, i) => i !== index).map((item, i) => ({ ...item, sequence: i + 1 }))
      }));
    }
  };

  const handleDiagnosisChange = (index, field, value) => {
    setFormData(prev => {
      const newDiagnoses = [...prev.diagnoses];
      newDiagnoses[index] = { ...newDiagnoses[index], [field]: value };
      return { ...prev, diagnoses: newDiagnoses };
    });
  };

  const addDiagnosis = () => {
    setFormData(prev => ({
      ...prev,
      diagnoses: [...prev.diagnoses, getInitialDiagnosisData(prev.diagnoses.length + 1)]
    }));
  };

  const removeDiagnosis = (index) => {
    if (formData.diagnoses.length > 1) {
      setFormData(prev => ({
        ...prev,
        diagnoses: prev.diagnoses.filter((_, i) => i !== index).map((diag, i) => ({ ...diag, sequence: i + 1 }))
      }));
    }
  };

  const handleSupportingInfoChange = (index, field, value) => {
    setFormData(prev => {
      const newInfo = [...prev.supporting_info];
      newInfo[index] = { ...newInfo[index], [field]: value };
      return { ...prev, supporting_info: newInfo };
    });
  };

  const addSupportingInfo = (category = 'info') => {
    setFormData(prev => ({
      ...prev,
      supporting_info: [...prev.supporting_info, getInitialSupportingInfoData(prev.supporting_info.length + 1, category)]
    }));
  };

  const removeSupportingInfo = (index) => {
    setFormData(prev => ({
      ...prev,
      supporting_info: prev.supporting_info.filter((_, i) => i !== index).map((info, i) => ({ ...info, sequence: i + 1 }))
    }));
  };

  // Pure function for display - doesn't set state
  const getCalculatedTotal = () => {
    return formData.items.reduce((sum, item) => sum + (parseFloat(item.net_amount) || 0), 0);
  };

  // Click handler that sets state
  const calculateTotal = () => {
    const total = getCalculatedTotal();
    handleChange('total_amount', total);
    return total;
  };

  const validateForm = () => {
    const validationErrors = [];
    if (!formData.patient_id) validationErrors.push({ field: 'patient_id', message: 'Patient is required' });
    if (!formData.provider_id) validationErrors.push({ field: 'provider_id', message: 'Provider is required' });
    if (!formData.insurer_id) validationErrors.push({ field: 'insurer_id', message: 'Insurer is required' });
    if (!formData.items || formData.items.length === 0) validationErrors.push({ field: 'items', message: 'At least one service item is required' });
    
    const invalidItems = formData.items.filter(item => !item.product_or_service_code);
    if (invalidItems.length > 0) validationErrors.push({ field: 'items', message: 'All items must have a service code' });
    
    return { valid: validationErrors.length === 0, errors: validationErrors };
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setErrors([]);

      const validation = validateForm();
      if (!validation.valid) {
        setErrors(validation.errors);
        alert('Please fix the validation errors before saving.');
        return;
      }

      let response;
      if (isEditMode) {
        response = await api.updatePriorAuthorization(id, formData);
      } else {
        response = await api.createPriorAuthorization(formData);
      }

      alert(isEditMode ? 'Prior authorization updated successfully!' : 'Prior authorization created successfully!');
      navigate(`/prior-authorizations/${response.data.id}`);
    } catch (error) {
      console.error('Error saving prior authorization:', error);
      const errorMsg = error.response?.data?.error || error.message;
      setErrors([{ field: 'general', message: errorMsg }]);
      alert(`Error: ${errorMsg}`);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAndSend = async () => {
    try {
      setSending(true);
      setErrors([]);

      const validation = validateForm();
      if (!validation.valid) {
        setErrors(validation.errors);
        alert('Please fix the validation errors before sending.');
        return;
      }

      // Save first
      let savedId = id;
      if (!isEditMode) {
        const createResponse = await api.createPriorAuthorization(formData);
        savedId = createResponse.data.id;
      } else {
        await api.updatePriorAuthorization(id, formData);
      }

      // Then send to NPHIES
      const sendResponse = await api.sendPriorAuthorizationToNphies(savedId);
      
      if (sendResponse.success) {
        alert(`Successfully sent to NPHIES!\nPre-Auth Ref: ${sendResponse.nphiesResponse?.preAuthRef || 'Pending'}`);
        navigate(`/prior-authorizations/${savedId}`);
      } else {
        alert(`NPHIES Error: ${sendResponse.error?.message || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error sending to NPHIES:', error);
      const errorMsg = error.response?.data?.error || error.message;
      setErrors([{ field: 'general', message: errorMsg }]);
      alert(`Error: ${errorMsg}`);
    } finally {
      setSending(false);
    }
  };

  const handlePreview = async () => {
    try {
      setPreviewLoading(true);
      setErrors([]);

      const validation = validateForm();
      if (!validation.valid) {
        setErrors(validation.errors);
        alert('Please fix the validation errors before previewing.');
        return;
      }

      const response = await api.previewPriorAuthorizationBundle(formData);
      setPreviewData(response);
      setShowPreview(true);
    } catch (error) {
      console.error('Error generating preview:', error);
      const errorMsg = error.response?.data?.error || error.message;
      alert(`Error: ${errorMsg}`);
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleCopyJson = () => {
    if (previewData?.fhirBundle) {
      navigator.clipboard.writeText(JSON.stringify(previewData.fhirBundle, null, 2));
      alert('FHIR Bundle copied to clipboard!');
    }
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

  return (
    <div className="space-y-6 pb-10">
      {/* Inject custom DatePicker styles */}
      <style>{datePickerStyles}</style>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => navigate('/prior-authorizations')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              {isEditMode ? 'Edit Prior Authorization' : 'New Prior Authorization'}
            </h1>
            <p className="text-gray-600">
              {isEditMode ? `Request #: ${formData.request_number}` : 'Create a new NPHIES prior authorization request'}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate('/prior-authorizations')}>
            Cancel
          </Button>
          <Button 
            variant="outline" 
            onClick={handlePreview} 
            disabled={previewLoading || saving || sending}
          >
            <Eye className="h-4 w-4 mr-2" />
            {previewLoading ? 'Building...' : 'Preview JSON'}
          </Button>
          <Button onClick={handleSave} disabled={saving || sending || previewLoading}>
            <Save className="h-4 w-4 mr-2" />
            {saving ? 'Saving...' : 'Save Draft'}
          </Button>
          <Button 
            onClick={handleSaveAndSend} 
            disabled={saving || sending || previewLoading}
            className="bg-gradient-to-r from-blue-500 to-blue-600"
          >
            <Send className="h-4 w-4 mr-2" />
            {sending ? 'Sending...' : 'Save & Send to NPHIES'}
          </Button>
        </div>
      </div>

      {/* Validation Errors */}
      {errors.length > 0 && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-4">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-5 w-5 text-red-500 mt-0.5" />
              <div>
                <p className="font-medium text-red-800">Please fix the following errors:</p>
                <ul className="mt-2 text-sm text-red-700 list-disc list-inside">
                  {errors.map((error, index) => (
                    <li key={index}>{error.message}</li>
                  ))}
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabs Navigation */}
      <div className="flex gap-2 bg-gray-100 p-1 rounded-lg w-fit flex-wrap">
        <TabButton active={activeTab === 'basic'} onClick={() => setActiveTab('basic')} icon={FileText}>
          Basic Info
        </TabButton>
        <TabButton active={activeTab === 'parties'} onClick={() => setActiveTab('parties')} icon={Building}>
          Parties
        </TabButton>
        <TabButton active={activeTab === 'clinical'} onClick={() => setActiveTab('clinical')} icon={Stethoscope}>
          Clinical
        </TabButton>
        <TabButton active={activeTab === 'items'} onClick={() => setActiveTab('items')} icon={Receipt}>
          Items
        </TabButton>
        <TabButton active={activeTab === 'supporting'} onClick={() => setActiveTab('supporting')} icon={Paperclip}>
          Supporting Info
        </TabButton>
      </div>

      {/* Basic Info Tab */}
      {activeTab === 'basic' && (
        <Card>
          <CardHeader>
            <CardTitle>Basic Information</CardTitle>
            <CardDescription>Core details about the prior authorization request</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Authorization Type *</Label>
                <Select
                  value={AUTH_TYPE_OPTIONS.find(opt => opt.value === formData.auth_type)}
                  onChange={(option) => handleChange('auth_type', option?.value || 'professional')}
                  options={AUTH_TYPE_OPTIONS}
                  styles={selectStyles}
                  menuPortalTarget={document.body}
                />
              </div>
              <div className="space-y-2">
                <Label>Priority</Label>
                <Select
                  value={PRIORITY_OPTIONS.find(opt => opt.value === formData.priority)}
                  onChange={(option) => handleChange('priority', option?.value || 'normal')}
                  options={PRIORITY_OPTIONS}
                  styles={selectStyles}
                  menuPortalTarget={document.body}
                />
              </div>
              <div className="space-y-2">
                <Label>Encounter Class</Label>
                <Select
                  value={ENCOUNTER_CLASS_OPTIONS.find(opt => opt.value === formData.encounter_class)}
                  onChange={(option) => handleChange('encounter_class', option?.value || 'ambulatory')}
                  options={ENCOUNTER_CLASS_OPTIONS}
                  styles={selectStyles}
                  menuPortalTarget={document.body}
                />
              </div>
            </div>

            <hr className="border-gray-200" />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Encounter Start Date</Label>
                <div className="datepicker-wrapper">
                  <DatePicker
                    selected={formData.encounter_start ? new Date(formData.encounter_start) : null}
                    onChange={(date) => handleChange('encounter_start', date ? date.toISOString() : '')}
                    showTimeSelect
                    dateFormat="yyyy-MM-dd HH:mm"
                    className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-purple/30"
                    placeholderText="Select date and time"
                  />
                  <Calendar className="datepicker-icon h-4 w-4" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Encounter End Date</Label>
                <div className="datepicker-wrapper">
                  <DatePicker
                    selected={formData.encounter_end ? new Date(formData.encounter_end) : null}
                    onChange={(date) => handleChange('encounter_end', date ? date.toISOString() : '')}
                    showTimeSelect
                    dateFormat="yyyy-MM-dd HH:mm"
                    className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-purple/30"
                    placeholderText="Select date and time"
                  />
                  <Calendar className="datepicker-icon h-4 w-4" />
                </div>
              </div>
            </div>

            <hr className="border-gray-200" />

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="total_amount">Total Amount</Label>
                <div className="flex gap-2">
                  <Input
                    id="total_amount"
                    type="number"
                    step="0.01"
                    value={formData.total_amount}
                    onChange={(e) => handleChange('total_amount', e.target.value)}
                    placeholder="0.00"
                  />
                  <Button type="button" variant="outline" size="sm" onClick={calculateTotal}>
                    Calculate
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Currency</Label>
                <Select
                  value={CURRENCY_OPTIONS.find(opt => opt.value === formData.currency)}
                  onChange={(option) => handleChange('currency', option?.value || 'SAR')}
                  options={CURRENCY_OPTIONS}
                  styles={selectStyles}
                  menuPortalTarget={document.body}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="eligibility_ref">Eligibility Reference</Label>
                <Input
                  id="eligibility_ref"
                  value={formData.eligibility_ref || ''}
                  onChange={(e) => handleChange('eligibility_ref', e.target.value)}
                  placeholder="Optional eligibility reference"
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Parties Tab */}
      {activeTab === 'parties' && (
        <Card>
          <CardHeader>
            <CardTitle>Involved Parties</CardTitle>
            <CardDescription>Select the patient, provider, and insurer for this request</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Patient */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Patient *
                </Label>
                <Select
                  value={patients.map(p => ({ value: p.patient_id, label: `${p.name}${p.identifier ? ` (${p.identifier})` : ''}` })).find(opt => opt.value == formData.patient_id)}
                  onChange={(option) => handleChange('patient_id', option?.value || '')}
                  options={patients.map(p => ({ value: p.patient_id, label: `${p.name}${p.identifier ? ` (${p.identifier})` : ''}` }))}
                  styles={selectStyles}
                  placeholder="Search and select patient..."
                  isClearable
                  isSearchable
                  menuPortalTarget={document.body}
                />
              </div>

              {/* Provider */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Building className="h-4 w-4" />
                  Provider *
                </Label>
                <Select
                  value={providers.map(p => ({ value: p.provider_id, label: `${p.provider_name || p.name}${p.nphies_id ? ` (${p.nphies_id})` : ''}` })).find(opt => opt.value == formData.provider_id)}
                  onChange={(option) => handleChange('provider_id', option?.value || '')}
                  options={providers.map(p => ({ value: p.provider_id, label: `${p.provider_name || p.name}${p.nphies_id ? ` (${p.nphies_id})` : ''}` }))}
                  styles={selectStyles}
                  placeholder="Search and select provider..."
                  isClearable
                  isSearchable
                  menuPortalTarget={document.body}
                />
              </div>

              {/* Insurer */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Shield className="h-4 w-4" />
                  Insurer *
                </Label>
                <Select
                  value={insurers.map(i => ({ value: i.insurer_id, label: `${i.insurer_name || i.name}${i.nphies_id ? ` (${i.nphies_id})` : ''}` })).find(opt => opt.value == formData.insurer_id)}
                  onChange={(option) => handleChange('insurer_id', option?.value || '')}
                  options={insurers.map(i => ({ value: i.insurer_id, label: `${i.insurer_name || i.name}${i.nphies_id ? ` (${i.nphies_id})` : ''}` }))}
                  styles={selectStyles}
                  placeholder="Search and select insurer..."
                  isClearable
                  isSearchable
                  menuPortalTarget={document.body}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Clinical Tab */}
      {activeTab === 'clinical' && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Diagnoses</CardTitle>
                <CardDescription>ICD-10 diagnosis codes for this authorization</CardDescription>
              </div>
              <Button type="button" onClick={addDiagnosis} variant="outline" size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Add Diagnosis
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {formData.diagnoses.map((diagnosis, index) => (
              <div key={index} className="flex items-start gap-4 p-4 border rounded-lg bg-gray-50">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary-purple text-white flex items-center justify-center text-sm font-medium">
                  {diagnosis.sequence}
                </div>
                <div className="flex-1 grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="space-y-2">
                    <Label>ICD-10 Code *</Label>
                    <Input
                      value={diagnosis.diagnosis_code}
                      onChange={(e) => handleDiagnosisChange(index, 'diagnosis_code', e.target.value)}
                      placeholder="e.g., J06.9"
                    />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label>Description</Label>
                    <Input
                      value={diagnosis.diagnosis_display || ''}
                      onChange={(e) => handleDiagnosisChange(index, 'diagnosis_display', e.target.value)}
                      placeholder="Diagnosis description"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Type</Label>
                    <Select
                      value={DIAGNOSIS_TYPE_OPTIONS.find(opt => opt.value === diagnosis.diagnosis_type)}
                      onChange={(option) => handleDiagnosisChange(index, 'diagnosis_type', option?.value || 'principal')}
                      options={DIAGNOSIS_TYPE_OPTIONS}
                      styles={selectStyles}
                      menuPortalTarget={document.body}
                    />
                  </div>
                </div>
                {formData.diagnoses.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-red-500 hover:text-red-700"
                    onClick={() => removeDiagnosis(index)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Items Tab */}
      {activeTab === 'items' && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Service Items</CardTitle>
                <CardDescription>Services, procedures, or medications requiring authorization</CardDescription>
              </div>
              <Button type="button" onClick={addItem} variant="outline" size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Add Item
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {formData.items.map((item, index) => (
              <div key={index} className="p-4 border rounded-lg bg-gray-50 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-primary-purple text-white flex items-center justify-center text-sm font-medium">
                      {item.sequence}
                    </div>
                    <span className="font-medium">Item {item.sequence}</span>
                  </div>
                  {formData.items.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-red-500 hover:text-red-700"
                      onClick={() => removeItem(index)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Service/Procedure Code *</Label>
                    <Input
                      value={item.product_or_service_code}
                      onChange={(e) => handleItemChange(index, 'product_or_service_code', e.target.value)}
                      placeholder="CPT/SNOMED code"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Description</Label>
                    <Input
                      value={item.product_or_service_display || ''}
                      onChange={(e) => handleItemChange(index, 'product_or_service_display', e.target.value)}
                      placeholder="Service description"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="space-y-2">
                    <Label>Quantity</Label>
                    <Input
                      type="number"
                      min="1"
                      value={item.quantity}
                      onChange={(e) => handleItemChange(index, 'quantity', e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Unit Price</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={item.unit_price}
                      onChange={(e) => handleItemChange(index, 'unit_price', e.target.value)}
                      placeholder="0.00"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Net Amount</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={item.net_amount}
                      onChange={(e) => handleItemChange(index, 'net_amount', e.target.value)}
                      placeholder="Auto-calculated"
                      className="bg-gray-100"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Service Date</Label>
                    <div className="datepicker-wrapper">
                      <DatePicker
                        selected={item.serviced_date ? new Date(item.serviced_date) : null}
                        onChange={(date) => handleItemChange(index, 'serviced_date', date ? date.toISOString().split('T')[0] : '')}
                        dateFormat="yyyy-MM-dd"
                        className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-purple/30"
                        placeholderText="Select date"
                      />
                      <Calendar className="datepicker-icon h-4 w-4" />
                    </div>
                  </div>
                </div>

                {/* Type-specific fields */}
                {formData.auth_type === 'dental' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Tooth Number</Label>
                      <Input
                        value={item.tooth_number || ''}
                        onChange={(e) => handleItemChange(index, 'tooth_number', e.target.value)}
                        placeholder="e.g., 11, 21"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Tooth Surface</Label>
                      <Input
                        value={item.tooth_surface || ''}
                        onChange={(e) => handleItemChange(index, 'tooth_surface', e.target.value)}
                        placeholder="e.g., M, O, D, B, L"
                      />
                    </div>
                  </div>
                )}

                {formData.auth_type === 'vision' && (
                  <div className="space-y-2">
                    <Label>Eye</Label>
                    <Select
                      value={EYE_OPTIONS.find(opt => opt.value === item.eye)}
                      onChange={(option) => handleItemChange(index, 'eye', option?.value || '')}
                      options={EYE_OPTIONS}
                      styles={selectStyles}
                      placeholder="Select eye..."
                      isClearable
                      menuPortalTarget={document.body}
                    />
                  </div>
                )}

                {formData.auth_type === 'pharmacy' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Medication Code</Label>
                      <Input
                        value={item.medication_code || ''}
                        onChange={(e) => handleItemChange(index, 'medication_code', e.target.value)}
                        placeholder="NPHIES medication code"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Days Supply</Label>
                      <Input
                        type="number"
                        value={item.days_supply || ''}
                        onChange={(e) => handleItemChange(index, 'days_supply', e.target.value)}
                        placeholder="Required for pharmacy"
                      />
                    </div>
                  </div>
                )}
              </div>
            ))}

            {/* Total */}
            <div className="flex justify-end pt-4 border-t">
              <div className="text-right">
                <p className="text-sm text-gray-500">Total Amount</p>
                <p className="text-2xl font-bold text-primary-purple">
                  {formatAmount(formData.total_amount || getCalculatedTotal(), formData.currency)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Supporting Info Tab */}
      {activeTab === 'supporting' && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Supporting Information</CardTitle>
                <CardDescription>Additional clinical justification and attachments</CardDescription>
              </div>
              <div className="flex gap-2">
                <Button type="button" onClick={() => addSupportingInfo('info')} variant="outline" size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Info
                </Button>
                {formData.auth_type === 'pharmacy' && (
                  <Button type="button" onClick={() => addSupportingInfo('days-supply')} variant="outline" size="sm">
                    <Pill className="h-4 w-4 mr-2" />
                    Add Days Supply
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {formData.supporting_info.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Paperclip className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                <p>No supporting information added</p>
                <p className="text-sm">Click "Add Info" to add clinical justification</p>
              </div>
            ) : (
              formData.supporting_info.map((info, index) => (
                <div key={index} className="flex items-start gap-4 p-4 border rounded-lg bg-gray-50">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-accent-cyan text-white flex items-center justify-center text-sm font-medium">
                    {info.sequence}
                  </div>
                  <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label>Category</Label>
                      <Select
                        value={SUPPORTING_INFO_CATEGORY_OPTIONS.find(opt => opt.value === info.category)}
                        onChange={(option) => handleSupportingInfoChange(index, 'category', option?.value || 'info')}
                        options={SUPPORTING_INFO_CATEGORY_OPTIONS}
                        styles={selectStyles}
                        menuPortalTarget={document.body}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Code</Label>
                      <Input
                        value={info.code || ''}
                        onChange={(e) => handleSupportingInfoChange(index, 'code', e.target.value)}
                        placeholder="Code"
                      />
                    </div>
                    {info.category === 'days-supply' ? (
                      <div className="space-y-2">
                        <Label>Days</Label>
                        <Input
                          type="number"
                          value={info.value_quantity || ''}
                          onChange={(e) => handleSupportingInfoChange(index, 'value_quantity', e.target.value)}
                          placeholder="Number of days"
                        />
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <Label>Value</Label>
                        <Input
                          value={info.value_string || ''}
                          onChange={(e) => handleSupportingInfoChange(index, 'value_string', e.target.value)}
                          placeholder="Value"
                        />
                      </div>
                    )}
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-red-500 hover:text-red-700"
                    onClick={() => removeSupportingInfo(index)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))
            )}

            {/* Pharmacy warning */}
            {formData.auth_type === 'pharmacy' && !formData.supporting_info.some(i => i.category === 'days-supply') && (
              <div className="flex items-center gap-2 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <AlertCircle className="h-5 w-5 text-yellow-600" />
                <span className="text-sm text-yellow-800">
                  Pharmacy authorizations require "Days Supply" supporting information
                </span>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Preview Modal */}
      {showPreview && previewData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col m-4">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b bg-gradient-to-r from-blue-50 to-purple-50">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Eye className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900">FHIR Request Preview</h2>
                  <p className="text-sm text-gray-600">This is the bundle that will be sent to NPHIES</p>
                </div>
              </div>
              <button
                onClick={() => setShowPreview(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <XCircle className="h-6 w-6 text-gray-500" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Entities Summary */}
              <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                <h3 className="font-semibold text-gray-800 mb-3">Request Summary</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                  <div className="bg-white rounded-lg p-3 border">
                    <p className="text-gray-500 text-xs mb-1">Patient</p>
                    <p className="font-medium">{previewData.entities?.patient?.name || 'N/A'}</p>
                    <p className="text-xs text-gray-400 font-mono">{previewData.entities?.patient?.identifier}</p>
                  </div>
                  <div className="bg-white rounded-lg p-3 border">
                    <p className="text-gray-500 text-xs mb-1">Provider</p>
                    <p className="font-medium">{previewData.entities?.provider?.name || 'N/A'}</p>
                    <p className="text-xs text-gray-400 font-mono">{previewData.entities?.provider?.nphiesId}</p>
                  </div>
                  <div className="bg-white rounded-lg p-3 border">
                    <p className="text-gray-500 text-xs mb-1">Insurer</p>
                    <p className="font-medium">{previewData.entities?.insurer?.name || 'N/A'}</p>
                    <p className="text-xs text-gray-400 font-mono">{previewData.entities?.insurer?.nphiesId}</p>
                  </div>
                  <div className="bg-white rounded-lg p-3 border">
                    <p className="text-gray-500 text-xs mb-1">Authorization Type</p>
                    <p className="font-medium capitalize">{previewData.options?.authType || 'N/A'}</p>
                    <p className="text-xs text-gray-400">
                      {previewData.options?.itemsCount || 0} items, {previewData.options?.diagnosesCount || 0} diagnoses
                    </p>
                  </div>
                </div>
                <div className="mt-3 pt-3 border-t border-gray-200 flex flex-wrap gap-2">
                  <Badge variant="outline" className="capitalize">
                    Priority: {previewData.options?.priority || 'normal'}
                  </Badge>
                  {previewData.options?.encounterClass && (
                    <Badge variant="outline" className="capitalize">
                      Encounter: {previewData.options?.encounterClass}
                    </Badge>
                  )}
                </div>
              </div>

              {/* FHIR Bundle JSON */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    FHIR Bundle (JSON)
                  </h3>
                  <Button variant="outline" size="sm" onClick={handleCopyJson}>
                    <Copy className="h-4 w-4 mr-2" />
                    Copy JSON
                  </Button>
                </div>
                <pre className="bg-gray-900 text-green-400 p-4 rounded-lg overflow-x-auto text-xs max-h-[400px] overflow-y-auto">
                  {JSON.stringify(previewData.fhirBundle, null, 2)}
                </pre>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-3 p-6 border-t bg-gray-50">
              <Button variant="outline" onClick={handleCopyJson}>
                <Copy className="h-4 w-4 mr-2" />
                Copy to Clipboard
              </Button>
              <Button onClick={() => setShowPreview(false)}>
                Close Preview
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
