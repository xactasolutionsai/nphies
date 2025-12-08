import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
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
  Shield, Stethoscope, Activity, Receipt, Eye, Calendar, DollarSign,
  AlertCircle, CheckCircle, RefreshCw, Copy, CreditCard
} from 'lucide-react';

// Import shared styles and components from prior-auth
import { datePickerStyles, selectStyles } from '@/components/prior-auth/styles';
import { TabButton } from '@/components/prior-auth';
import {
  AUTH_TYPE_OPTIONS,
  PRIORITY_OPTIONS,
  CLAIM_SUBTYPE_OPTIONS,
  ALLOWED_CLAIM_SUBTYPES,
  getClaimSubtypeOptions,
  ENCOUNTER_CLASS_OPTIONS,
  ALLOWED_ENCOUNTER_CLASSES,
  getEncounterClassOptions,
  CURRENCY_OPTIONS,
  DIAGNOSIS_TYPE_OPTIONS,
  SUPPORTING_INFO_CATEGORY_OPTIONS,
  ENCOUNTER_SERVICE_TYPE_OPTIONS,
  PRACTICE_CODES_OPTIONS
} from '@/components/prior-auth/constants';

// Claim-specific constants (extending AUTH_TYPE_OPTIONS as CLAIM_TYPE)
const CLAIM_TYPE_OPTIONS = AUTH_TYPE_OPTIONS;

// Admit Source options for institutional claims
const ADMIT_SOURCE_OPTIONS = [
  { value: 'WKIN', label: 'Walk-in' },
  { value: 'EMR', label: 'Emergency Room' },
  { value: 'TRANS', label: 'Transfer' },
  { value: 'REF', label: 'Referral' },
  { value: 'HCARE', label: 'Healthcare Facility' }
];

// Service Type options for institutional claims
const SERVICE_TYPE_OPTIONS = [
  { value: 'acute-care', label: 'Acute Care' },
  { value: 'sub-acute-care', label: 'Sub-Acute Care' },
  { value: 'rehabilitation', label: 'Rehabilitation' }
];

// Condition onset options
const CONDITION_ONSET_OPTIONS = [
  { value: 'NR', label: 'NR - Not Recorded' },
  { value: 'POA', label: 'POA - Present on Admission' },
  { value: 'NPOA', label: 'NPOA - Not Present on Admission' },
  { value: 'UNK', label: 'UNK - Unknown' }
];

// Helper functions
const getInitialItemData = (seq) => ({
  sequence: seq,
  product_or_service_code: '',
  product_or_service_display: '',
  quantity: 1,
  unit_price: '',
  net_amount: 0,
  factor: 1,
  tax: 0,
  patient_share: 0,
  serviced_date: new Date().toISOString().split('T')[0],
  is_package: false,
  is_maternity: false,
  patient_invoice: ''
});

const getInitialDiagnosisData = (seq) => ({
  sequence: seq,
  diagnosis_code: '',
  diagnosis_display: '',
  diagnosis_type: 'principal',
  on_admission: true,
  condition_onset: 'NR'
});

const getInitialSupportingInfoData = (seq) => ({
  sequence: seq,
  category: '',
  code: '',
  code_display: '',
  value_string: '',
  value_quantity: '',
  value_quantity_unit: '',
  timing_date: null
});

export default function ClaimSubmissionForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const paId = searchParams.get('from_pa');
  const isEditMode = !!id;

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [errors, setErrors] = useState([]);
  const [activeTab, setActiveTab] = useState('basic');
  
  // Preview state
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewData, setPreviewData] = useState(null);
  
  // Reference data
  const [patients, setPatients] = useState([]);
  const [providers, setProviders] = useState([]);
  const [insurers, setInsurers] = useState([]);
  const [coverages, setCoverages] = useState([]);
  const [loadingCoverages, setLoadingCoverages] = useState(false);

  // Form data
  const [formData, setFormData] = useState({
    claim_type: 'institutional',
    sub_type: 'ip',
    status: 'draft',
    priority: 'normal',
    currency: 'SAR',
    encounter_class: 'inpatient',
    patient_id: '',
    provider_id: '',
    insurer_id: '',
    coverage_id: '',
    practice_code: '08.00',
    admit_source: 'WKIN',
    service_type: 'acute-care',
    total_amount: '',
    service_date: new Date().toISOString().split('T')[0],
    encounter_start: new Date().toISOString(),
    encounter_end: null,
    pre_auth_ref: '',
    eligibility_offline_ref: '',
    episode_identifier: '',
    items: [getInitialItemData(1)],
    supporting_info: [],
    diagnoses: [getInitialDiagnosisData(1)]
  });

  useEffect(() => {
    loadReferenceData();
    if (isEditMode) {
      loadClaimSubmission();
    } else if (paId) {
      createFromPriorAuth();
    }
  }, [id, paId]);

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

  const loadClaimSubmission = async () => {
    try {
      setLoading(true);
      const response = await api.getClaimSubmission(id);
      const data = response.data;
      
      setFormData({
        ...data,
        service_date: data.service_date || new Date().toISOString().split('T')[0],
        encounter_start: data.encounter_start || new Date().toISOString(),
        encounter_end: data.encounter_end || null,
        items: data.items?.length > 0 ? data.items : [getInitialItemData(1)],
        diagnoses: data.diagnoses?.length > 0 ? data.diagnoses : [getInitialDiagnosisData(1)],
        supporting_info: data.supporting_info || []
      });

      // Load coverages for the patient (if patient exists)
      if (data.patient_id) {
        loadPatientCoverages(data.patient_id);
      }
    } catch (error) {
      console.error('Error loading claim:', error);
      setErrors([{ message: error.message || 'Failed to load claim' }]);
    } finally {
      setLoading(false);
    }
  };

  const createFromPriorAuth = async () => {
    try {
      setLoading(true);
      const response = await api.createClaimFromPriorAuth(paId);
      if (response.data) {
        navigate(`/claim-submissions/${response.data.id}/edit`, { replace: true });
      }
    } catch (error) {
      console.error('Error creating claim from PA:', error);
      setErrors([{ message: error.message || 'Failed to create claim from prior authorization' }]);
      setLoading(false);
    }
  };

  // Load coverages when patient is selected
  const loadPatientCoverages = async (patientId) => {
    if (!patientId) {
      setCoverages([]);
      return;
    }
    
    try {
      setLoadingCoverages(true);
      const response = await api.getPatientCoverages(patientId);
      const patientCoverages = response?.data || [];
      setCoverages(patientCoverages);
      
      // If patient has only one coverage, auto-select it
      if (patientCoverages.length === 1) {
        const coverage = patientCoverages[0];
        setFormData(prev => ({
          ...prev,
          coverage_id: coverage.coverage_id,
          insurer_id: coverage.insurer_id
        }));
      } else {
        // Clear coverage and insurer if patient has multiple or no coverages
        setFormData(prev => ({
          ...prev,
          coverage_id: '',
          insurer_id: ''
        }));
      }
    } catch (error) {
      console.error('Error loading patient coverages:', error);
      setCoverages([]);
    } finally {
      setLoadingCoverages(false);
    }
  };

  // Handle coverage selection - auto-set insurer
  const handleCoverageChange = (coverageId) => {
    const selectedCoverage = coverages.find(c => c.coverage_id === coverageId);
    setFormData(prev => ({
      ...prev,
      coverage_id: coverageId,
      insurer_id: selectedCoverage?.insurer_id || prev.insurer_id
    }));
  };

  const handleChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    
    // If patient changed, load their coverages
    if (field === 'patient_id') {
      loadPatientCoverages(value);
    }
  };

  // Item handlers
  const handleItemChange = (index, field, value) => {
    setFormData(prev => {
      const newItems = [...prev.items];
      newItems[index] = { ...newItems[index], [field]: value };
      
      // Auto-calculate net amount
      if (field === 'quantity' || field === 'unit_price' || field === 'factor' || field === 'tax') {
        const qty = field === 'quantity' ? value : newItems[index].quantity;
        const price = field === 'unit_price' ? value : newItems[index].unit_price;
        const factor = field === 'factor' ? value : (newItems[index].factor || 1);
        const tax = field === 'tax' ? value : (newItems[index].tax || 0);
        newItems[index].net_amount = ((parseFloat(qty) || 0) * (parseFloat(price) || 0) * (parseFloat(factor) || 1)) + (parseFloat(tax) || 0);
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

  // Diagnosis handlers
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

  // Supporting Info handlers
  const handleSupportingInfoChange = (index, field, value) => {
    setFormData(prev => {
      const newInfo = [...prev.supporting_info];
      newInfo[index] = { ...newInfo[index], [field]: value };
      return { ...prev, supporting_info: newInfo };
    });
  };

  const addSupportingInfo = () => {
    setFormData(prev => ({
      ...prev,
      supporting_info: [...prev.supporting_info, getInitialSupportingInfoData(prev.supporting_info.length + 1)]
    }));
  };

  const removeSupportingInfo = (index) => {
    setFormData(prev => ({
      ...prev,
      supporting_info: prev.supporting_info.filter((_, i) => i !== index).map((info, i) => ({ ...info, sequence: i + 1 }))
    }));
  };

  // Calculate totals
  const getCalculatedTotal = () => {
    return formData.items.reduce((sum, item) => sum + (parseFloat(item.net_amount) || 0), 0);
  };

  const calculateTotal = () => {
    const total = getCalculatedTotal();
    handleChange('total_amount', total);
    return total;
  };

  // Save as draft
  const handleSave = async () => {
    try {
      setSaving(true);
      setErrors([]);

      const dataToSave = { ...formData };

      let response;
      if (isEditMode) {
        response = await api.updateClaimSubmission(id, dataToSave);
      } else {
        response = await api.createClaimSubmission(dataToSave);
      }

      if (response.data) {
        navigate(`/claim-submissions/${response.data.id}`, { replace: true });
      }
    } catch (error) {
      console.error('Error saving claim:', error);
      setErrors([{ message: error.message || 'Failed to save claim' }]);
    } finally {
      setSaving(false);
    }
  };

  // Send to NPHIES
  const handleSaveAndSend = async () => {
    if (!window.confirm('Save and send this claim to NPHIES?')) return;
    
    try {
      setSending(true);
      setErrors([]);

      const dataToSave = { ...formData };

      let claimId = id;
      if (!isEditMode || formData.status === 'draft') {
        const saveResponse = isEditMode 
          ? await api.updateClaimSubmission(id, dataToSave)
          : await api.createClaimSubmission(dataToSave);
        claimId = saveResponse.data?.id || id;
      }

      const sendResponse = await api.sendClaimSubmissionToNphies(claimId);
      
      if (sendResponse.success) {
        navigate(`/claim-submissions/${claimId}`);
      } else {
        setErrors([{ message: sendResponse.error?.message || 'Failed to send claim' }]);
      }
    } catch (error) {
      console.error('Error sending claim:', error);
      setErrors([{ message: error.message || 'Failed to send claim' }]);
    } finally {
      setSending(false);
    }
  };

  // Preview bundle
  const handlePreview = async () => {
    try {
      setPreviewLoading(true);
      const response = await api.previewClaimSubmissionBundle(formData);
      setPreviewData(response);
      setActiveTab('preview');
    } catch (error) {
      console.error('Error previewing bundle:', error);
      setErrors([{ message: error.message || 'Failed to generate preview' }]);
    } finally {
      setPreviewLoading(false);
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
          <Button variant="ghost" onClick={() => navigate('/claim-submissions')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              {isEditMode ? 'Edit Claim Submission' : 'New Claim Submission'}
            </h1>
            <p className="text-gray-600">
              {isEditMode ? `Claim #: ${formData.claim_number}` : 'Create a new NPHIES claim submission'}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate('/claim-submissions')}>
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
        <TabButton active={activeTab === 'diagnoses'} onClick={() => setActiveTab('diagnoses')} icon={Stethoscope}>
          Diagnoses
        </TabButton>
        <TabButton active={activeTab === 'items'} onClick={() => setActiveTab('items')} icon={Receipt}>
          Items
        </TabButton>
        <TabButton active={activeTab === 'supporting'} onClick={() => setActiveTab('supporting')} icon={Activity}>
          Supporting Info
        </TabButton>
        <TabButton active={activeTab === 'preview'} onClick={() => setActiveTab('preview')} icon={Eye}>
          FHIR Preview
        </TabButton>
      </div>

      {/* Basic Info Tab */}
      {activeTab === 'basic' && (
        <Card>
          <CardHeader>
            <CardTitle>Basic Information</CardTitle>
            <CardDescription>Core details about the claim submission</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Claim Type *</Label>
                <Select
                  value={CLAIM_TYPE_OPTIONS.find(opt => opt.value === formData.claim_type)}
                  onChange={(option) => {
                    const newType = option?.value || 'institutional';
                    handleChange('claim_type', newType);
                    // Auto-adjust sub_type based on allowed subtypes
                    const allowed = ALLOWED_CLAIM_SUBTYPES[newType] || ['op'];
                    if (!allowed.includes(formData.sub_type)) {
                      handleChange('sub_type', allowed[0] || 'op');
                    }
                    // Auto-adjust encounter_class based on allowed classes
                    const allowedClasses = ALLOWED_ENCOUNTER_CLASSES[newType] || [];
                    if (allowedClasses.length > 0 && !allowedClasses.includes(formData.encounter_class)) {
                      handleChange('encounter_class', allowedClasses[0]);
                    }
                  }}
                  options={CLAIM_TYPE_OPTIONS}
                  styles={selectStyles}
                  menuPortalTarget={document.body}
                />
              </div>
              <div className="space-y-2">
                <Label>Claim SubType *</Label>
                <Select
                  value={CLAIM_SUBTYPE_OPTIONS.find(opt => opt.value === formData.sub_type)}
                  onChange={(option) => handleChange('sub_type', option?.value || 'op')}
                  options={getClaimSubtypeOptions(formData.claim_type)}
                  styles={selectStyles}
                  menuPortalTarget={document.body}
                  isOptionDisabled={(option) => option.isDisabled}
                />
                <p className="text-xs text-gray-500">
                  NPHIES: OP (OutPatient), IP (Inpatient), EMR (Emergency)
                </p>
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
            </div>

            {/* Encounter Class - Only for claim types that require Encounter */}
            {formData.claim_type !== 'vision' && formData.claim_type !== 'pharmacy' && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Encounter Class</Label>
                  <Select
                    value={ENCOUNTER_CLASS_OPTIONS.find(opt => opt.value === formData.encounter_class)}
                    onChange={(option) => handleChange('encounter_class', option?.value || 'inpatient')}
                    options={getEncounterClassOptions(formData.claim_type)}
                    styles={selectStyles}
                    menuPortalTarget={document.body}
                    isOptionDisabled={(option) => option.isDisabled}
                  />
                </div>
                {formData.claim_type === 'institutional' && (
                  <>
                    <div className="space-y-2">
                      <Label>Service Type</Label>
                      <Select
                        value={SERVICE_TYPE_OPTIONS.find(opt => opt.value === formData.service_type)}
                        onChange={(option) => handleChange('service_type', option?.value || 'acute-care')}
                        options={SERVICE_TYPE_OPTIONS}
                        styles={selectStyles}
                        menuPortalTarget={document.body}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Admit Source</Label>
                      <Select
                        value={ADMIT_SOURCE_OPTIONS.find(opt => opt.value === formData.admit_source)}
                        onChange={(option) => handleChange('admit_source', option?.value || 'WKIN')}
                        options={ADMIT_SOURCE_OPTIONS}
                        styles={selectStyles}
                        menuPortalTarget={document.body}
                      />
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Vision/Pharmacy info - No Encounter needed */}
            {(formData.claim_type === 'vision' || formData.claim_type === 'pharmacy') && (
              <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <AlertCircle className="h-5 w-5 text-blue-500" />
                <span className="text-sm text-blue-700">
                  {formData.claim_type === 'vision' 
                    ? 'Vision claims do not require Encounter information per NPHIES specification.'
                    : 'Pharmacy claims do not require Encounter information per NPHIES specification.'}
                </span>
              </div>
            )}

            <hr className="border-gray-200" />

            {/* Dates */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Service Date *</Label>
                <div className="datepicker-wrapper">
                  <DatePicker
                    selected={formData.service_date ? new Date(formData.service_date) : null}
                    onChange={(date) => handleChange('service_date', date ? date.toISOString().split('T')[0] : '')}
                    dateFormat="yyyy-MM-dd"
                    className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-purple/30"
                    placeholderText="Select service date"
                  />
                  <Calendar className="datepicker-icon h-4 w-4" />
                </div>
              </div>
              {formData.claim_type !== 'vision' && formData.claim_type !== 'pharmacy' && (
                <>
                  <div className="space-y-2">
                    <Label>Encounter Start</Label>
                    <div className="datepicker-wrapper">
                      <DatePicker
                        selected={formData.encounter_start ? new Date(formData.encounter_start) : null}
                        onChange={(date) => handleChange('encounter_start', date ? date.toISOString() : '')}
                        showTimeSelect
                        dateFormat="yyyy-MM-dd HH:mm"
                        className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-purple/30"
                        placeholderText="Select start date & time"
                      />
                      <Calendar className="datepicker-icon h-4 w-4" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Encounter End</Label>
                    <div className="datepicker-wrapper">
                      <DatePicker
                        selected={formData.encounter_end ? new Date(formData.encounter_end) : null}
                        onChange={(date) => handleChange('encounter_end', date ? date.toISOString() : null)}
                        showTimeSelect
                        dateFormat="yyyy-MM-dd HH:mm"
                        isClearable
                        className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-purple/30"
                        placeholderText="Select end date & time (optional)"
                      />
                      <Calendar className="datepicker-icon h-4 w-4" />
                    </div>
                  </div>
                </>
              )}
            </div>

            <hr className="border-gray-200" />

            {/* Financial */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="total_amount">Total Amount</Label>
                <div className="flex gap-2">
                  <Input
                    id="total_amount"
                    type="number"
                    step="0.01"
                    value={formData.total_amount ?? ''}
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
            </div>

            {/* References */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-blue-50/50 border border-blue-200 rounded-lg">
              <div className="col-span-2 flex items-center gap-2 text-blue-700 font-medium text-sm">
                <CheckCircle className="h-4 w-4" />
                Prior Authorization & Eligibility References
              </div>
              <div className="space-y-2">
                <Label>Pre-Auth Reference</Label>
                <Input
                  value={formData.pre_auth_ref || ''}
                  onChange={(e) => handleChange('pre_auth_ref', e.target.value)}
                  placeholder="NPHIES PA reference..."
                />
              </div>
              <div className="space-y-2">
                <Label>Eligibility Offline Reference</Label>
                <Input
                  value={formData.eligibility_offline_ref || ''}
                  onChange={(e) => handleChange('eligibility_offline_ref', e.target.value)}
                  placeholder="Eligibility reference..."
                />
              </div>
              <div className="space-y-2">
                <Label>Episode Identifier</Label>
                <Input
                  value={formData.episode_identifier || ''}
                  onChange={(e) => handleChange('episode_identifier', e.target.value)}
                  placeholder="Episode identifier..."
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
            <CardDescription>Select the patient, provider, and insurer for this claim</CardDescription>
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

              {/* Practice Code - NPHIES careTeam.qualification */}
              {/* NOT shown for pharmacy/vision claims (they don't have careTeam per NPHIES examples) */}
              {formData.claim_type !== 'pharmacy' && formData.claim_type !== 'vision' && (
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Stethoscope className="h-4 w-4" />
                    Practice Code / Specialty *
                  </Label>
                  <Select
                    value={PRACTICE_CODES_OPTIONS.flatMap(group => group.options).find(opt => opt.value === formData.practice_code)}
                    onChange={(option) => handleChange('practice_code', option?.value || '08.00')}
                    options={PRACTICE_CODES_OPTIONS}
                    styles={selectStyles}
                    placeholder="Select practice code/specialty..."
                    isSearchable
                    menuPortalTarget={document.body}
                  />
                  <p className="text-xs text-gray-500">
                    NPHIES: Provider's practice specialty for careTeam.qualification
                  </p>
                </div>
              )}

              {/* Coverage - Shows patient's insurance coverages */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <CreditCard className="h-4 w-4" />
                  Coverage {formData.patient_id && '*'}
                  {loadingCoverages && <span className="text-xs text-gray-500">(Loading...)</span>}
                </Label>
                {!formData.patient_id ? (
                  <div className="text-sm text-gray-500 p-3 bg-gray-50 rounded-md">
                    Select a patient first to see their insurance coverages
                  </div>
                ) : coverages.length === 0 && !loadingCoverages ? (
                  <div className="text-sm text-amber-600 p-3 bg-amber-50 rounded-md">
                    No coverages found for this patient. You can manually select an insurer below.
                  </div>
                ) : (
                  <Select
                    value={coverages.map(c => ({ 
                      value: c.coverage_id, 
                      label: `${c.insurer_name || 'Unknown Insurer'} - ${c.member_id || c.policy_number}${c.plan_name ? ` (${c.plan_name})` : ''}`
                    })).find(opt => opt.value == formData.coverage_id)}
                    onChange={(option) => handleCoverageChange(option?.value || '')}
                    options={coverages.map(c => ({ 
                      value: c.coverage_id, 
                      label: `${c.insurer_name || 'Unknown Insurer'} - ${c.member_id || c.policy_number}${c.plan_name ? ` (${c.plan_name})` : ''}`
                    }))}
                    styles={selectStyles}
                    placeholder="Select coverage..."
                    isClearable
                    isSearchable
                    isLoading={loadingCoverages}
                    menuPortalTarget={document.body}
                  />
                )}
              </div>

              {/* Insurer - Auto-filled from coverage, or manual selection */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Shield className="h-4 w-4" />
                  Insurer *
                  {formData.coverage_id && <span className="text-xs text-green-600">(from coverage)</span>}
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
                  isDisabled={!!formData.coverage_id}
                />
                {formData.coverage_id && (
                  <p className="text-xs text-gray-500">Clear coverage selection to manually choose insurer</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Diagnoses Tab */}
      {activeTab === 'diagnoses' && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Diagnoses</CardTitle>
                <CardDescription>ICD-10 diagnosis codes for this claim</CardDescription>
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
                  <div className="space-y-2 md:col-span-2">
                    <Label>ICD-10 Code *</Label>
                    <Input
                      value={diagnosis.diagnosis_code}
                      onChange={(e) => handleDiagnosisChange(index, 'diagnosis_code', e.target.value)}
                      placeholder="e.g., J06.9"
                    />
                  </div>
                  <div className="space-y-2">
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
                  <div className="space-y-2">
                    <Label>Condition Onset</Label>
                    <Select
                      value={CONDITION_ONSET_OPTIONS.find(opt => opt.value === diagnosis.condition_onset)}
                      onChange={(option) => handleDiagnosisChange(index, 'condition_onset', option?.value || 'NR')}
                      options={CONDITION_ONSET_OPTIONS}
                      styles={selectStyles}
                      menuPortalTarget={document.body}
                    />
                  </div>
                  <div className="flex items-center gap-4 pt-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={diagnosis.on_admission !== false}
                        onChange={(e) => handleDiagnosisChange(index, 'on_admission', e.target.checked)}
                        className="rounded border-gray-300"
                      />
                      <span className="text-sm">On Admission</span>
                    </label>
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
                <CardTitle>Claim Items</CardTitle>
                <CardDescription>Services and procedures being claimed</CardDescription>
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

                <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
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
                    <Label>Factor</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={item.factor || 1}
                      onChange={(e) => handleItemChange(index, 'factor', e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Tax</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={item.tax || 0}
                      onChange={(e) => handleItemChange(index, 'tax', e.target.value)}
                      placeholder="0.00"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Net Amount</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={item.net_amount || 0}
                      onChange={(e) => handleItemChange(index, 'net_amount', e.target.value)}
                      placeholder="Auto-calculated"
                      className="bg-gray-100"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                  <div className="space-y-2">
                    <Label>Patient Share</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={item.patient_share || 0}
                      onChange={(e) => handleItemChange(index, 'patient_share', e.target.value)}
                      placeholder="0.00"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Patient Invoice #</Label>
                    <Input
                      value={item.patient_invoice || ''}
                      onChange={(e) => handleItemChange(index, 'patient_invoice', e.target.value)}
                      placeholder="Invoice number..."
                    />
                  </div>
                </div>

                <div className="flex items-center gap-6 pt-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={item.is_package || false}
                      onChange={(e) => handleItemChange(index, 'is_package', e.target.checked)}
                      className="rounded border-gray-300"
                    />
                    <span className="text-sm">Package</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={item.is_maternity || false}
                      onChange={(e) => handleItemChange(index, 'is_maternity', e.target.checked)}
                      className="rounded border-gray-300"
                    />
                    <span className="text-sm">Maternity</span>
                  </label>
                </div>
              </div>
            ))}

            {/* Total Summary */}
            <Card className="bg-gradient-to-r from-purple-50 to-blue-50 border-purple-200">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <DollarSign className="h-5 w-5 text-purple-600" />
                    <span className="font-medium text-purple-900">Items Total</span>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-purple-900">
                      {getCalculatedTotal().toFixed(2)} {formData.currency}
                    </p>
                    <p className="text-xs text-purple-600">{formData.items.length} item(s)</p>
                  </div>
                </div>
              </CardContent>
            </Card>
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
                <CardDescription>Additional information to support the claim</CardDescription>
              </div>
              <Button type="button" onClick={addSupportingInfo} variant="outline" size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Add Info
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {formData.supporting_info.length === 0 ? (
              <div className="text-center py-12">
                <Activity className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                <p className="text-gray-500">No supporting information added</p>
                <Button onClick={addSupportingInfo} variant="outline" className="mt-4">
                  <Plus className="h-4 w-4 mr-1" />
                  Add Supporting Info
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {formData.supporting_info.map((info, index) => (
                  <div key={index} className="flex items-start gap-4 p-4 border rounded-lg bg-gray-50">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary-purple text-white flex items-center justify-center text-sm font-medium">
                      {info.sequence}
                    </div>
                    <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label>Category *</Label>
                        <Select
                          value={SUPPORTING_INFO_CATEGORY_OPTIONS.find(opt => opt.value === info.category)}
                          onChange={(option) => handleSupportingInfoChange(index, 'category', option?.value || '')}
                          options={SUPPORTING_INFO_CATEGORY_OPTIONS}
                          styles={selectStyles}
                          menuPortalTarget={document.body}
                          placeholder="Select category..."
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Code</Label>
                        <Input
                          value={info.code || ''}
                          onChange={(e) => handleSupportingInfoChange(index, 'code', e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Display</Label>
                        <Input
                          value={info.code_display || ''}
                          onChange={(e) => handleSupportingInfoChange(index, 'code_display', e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Value (String)</Label>
                        <Input
                          value={info.value_string || ''}
                          onChange={(e) => handleSupportingInfoChange(index, 'value_string', e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Value (Quantity)</Label>
                        <Input
                          type="number"
                          value={info.value_quantity || ''}
                          onChange={(e) => handleSupportingInfoChange(index, 'value_quantity', e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Unit</Label>
                        <Input
                          value={info.value_quantity_unit || ''}
                          onChange={(e) => handleSupportingInfoChange(index, 'value_quantity_unit', e.target.value)}
                          placeholder="e.g., mm[Hg]"
                        />
                      </div>
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
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Preview Tab */}
      {activeTab === 'preview' && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>FHIR Bundle Preview</CardTitle>
              <CardDescription>Preview the NPHIES-compliant FHIR bundle that will be submitted</CardDescription>
            </div>
            <Button onClick={handlePreview} disabled={previewLoading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${previewLoading ? 'animate-spin' : ''}`} />
              Refresh Preview
            </Button>
          </CardHeader>
          <CardContent>
            {!previewData ? (
              <div className="text-center py-12">
                <Eye className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                <p className="text-gray-500">Click "Refresh Preview" to generate the FHIR bundle</p>
              </div>
            ) : (
              <div className="space-y-4">
                {previewData.entities && (
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <h4 className="font-medium mb-2">Entities</h4>
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div><span className="text-gray-500">Patient:</span> {previewData.entities.patient?.name}</div>
                      <div><span className="text-gray-500">Provider:</span> {previewData.entities.provider?.name}</div>
                      <div><span className="text-gray-500">Insurer:</span> {previewData.entities.insurer?.name}</div>
                    </div>
                  </div>
                )}
                <div className="relative">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="absolute top-2 right-2 z-10"
                    onClick={() => {
                      navigator.clipboard.writeText(JSON.stringify(previewData.fhirBundle, null, 2));
                    }}
                  >
                    <Copy className="h-4 w-4 mr-1" />
                    Copy
                  </Button>
                  <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-auto max-h-[600px] text-sm">
                    {JSON.stringify(previewData.fhirBundle, null, 2)}
                  </pre>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
