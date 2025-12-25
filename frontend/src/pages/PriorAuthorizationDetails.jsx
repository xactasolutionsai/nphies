import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import api, { extractErrorMessage } from '@/services/api';
import { 
  ArrowLeft, Edit, Send, RefreshCw, XCircle, ArrowRightLeft,
  FileText, User, Building, Shield, Stethoscope, Receipt, 
  Clock, CheckCircle, AlertCircle, Calendar, DollarSign,
  Code, Activity, Paperclip, History, Eye, X, Copy, ClipboardCheck, Pill,
  MessageSquare, RotateCcw, PlusCircle
} from 'lucide-react';

// Import AI Medication Safety Panel
import MedicationSafetyPanel from '@/components/general-request/shared/MedicationSafetyPanel';

// Import Communication Panel for NPHIES communications
import { CommunicationPanel } from '@/components/prior-auth';
import { PRIORITY_OPTIONS } from '@/components/prior-auth/constants';
import { selectStyles } from '@/components/prior-auth/styles';
import Select from 'react-select';

// Helper functions
const getAuthTypeDisplay = (authType) => {
  const types = {
    institutional: 'Institutional',
    professional: 'Professional',
    pharmacy: 'Pharmacy',
    dental: 'Dental',
    vision: 'Vision'
  };
  return types[authType] || authType;
};

const getEncounterClassDisplay = (encounterClass) => {
  const classes = {
    AMB: 'Ambulatory',
    EMER: 'Emergency',
    HH: 'Home Healthcare',
    IMP: 'Inpatient',
    SS: 'Day Case',
    VR: 'Telemedicine'
  };
  return classes[encounterClass] || encounterClass || '-';
};

const formatAmount = (amount, currency = 'SAR') => {
  if (amount == null || amount === '' || isNaN(parseFloat(amount))) return '-';
  return `${parseFloat(amount).toFixed(2)} ${currency}`;
};

// Calculate age from birth date with appropriate units (days, months, years)
const calculateAge = (birthDate) => {
  if (!birthDate) return null;
  const today = new Date();
  const birth = new Date(birthDate);
  
  // Calculate difference in milliseconds
  const diffMs = today - birth;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  // Less than 1 month - show days
  if (diffDays < 30) {
    return `${diffDays} day${diffDays !== 1 ? 's' : ''}`;
  }
  
  // Less than 2 years - show months
  const diffMonths = Math.floor(diffDays / 30.44); // Average days per month
  if (diffMonths < 24) {
    return `${diffMonths} month${diffMonths !== 1 ? 's' : ''}`;
  }
  
  // 2 years or more - show years
  let years = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    years--;
  }
  return `${years} year${years !== 1 ? 's' : ''}`;
};

// Calculate total from items if total_amount is not set
const calculateTotalFromItems = (items) => {
  if (!items || items.length === 0) return null;
  const total = items.reduce((sum, item) => {
    const netAmount = parseFloat(item.net_amount) || 0;
    return sum + netAmount;
  }, 0);
  return total > 0 ? total : null;
};

const formatDate = (dateString) => {
  if (!dateString) return '-';
  return new Date(dateString).toLocaleDateString();
};

const formatDateTime = (dateString) => {
  if (!dateString) return '-';
  return new Date(dateString).toLocaleString();
};

// Custom Modal Component
const Modal = ({ open, onClose, title, description, children, footer }) => {
  if (!open) return null;
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/50" onClick={onClose}></div>
      <div className="relative bg-white rounded-xl shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-hidden">
        <div className="p-6 border-b">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold">{title}</h2>
              {description && <p className="text-sm text-gray-500 mt-1">{description}</p>}
            </div>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
        <div className="p-6 overflow-auto max-h-[60vh]">
          {children}
        </div>
        {footer && (
          <div className="p-6 border-t bg-gray-50 flex justify-end gap-3">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};

// Tab Component
const TabButton = ({ active, onClick, children }) => (
  <button
    onClick={onClick}
    className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
      active 
        ? 'bg-primary-purple text-white' 
        : 'text-gray-600 hover:bg-gray-100'
    }`}
  >
    {children}
  </button>
);

export default function PriorAuthorizationDetails() {
  const navigate = useNavigate();
  const { id } = useParams();
  
  const [loading, setLoading] = useState(true);
  const [priorAuth, setPriorAuth] = useState(null);
  const [bundle, setBundle] = useState(null);
  const [activeTab, setActiveTab] = useState('details');
  const [showBundleDialog, setShowBundleDialog] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  
  // Claim submission state
  const [claimBundle, setClaimBundle] = useState(null);
  const [claimResponse, setClaimResponse] = useState(null);
  const [showClaimBundleDialog, setShowClaimBundleDialog] = useState(false);
  const [showClaimResponseDialog, setShowClaimResponseDialog] = useState(false);
  const [claimBundleLoading, setClaimBundleLoading] = useState(false);
  const [copiedToClipboard, setCopiedToClipboard] = useState(false);
  
  // Professional claim service code dialog state
  const [showServiceCodeDialog, setShowServiceCodeDialog] = useState(false);
  const [serviceCodeOverrides, setServiceCodeOverrides] = useState([]);

  // Priority selection modal state
  const [showPriorityModal, setShowPriorityModal] = useState(false);
  const [selectedPriority, setSelectedPriority] = useState('normal');
  
  // Error/Success/Confirm modal states
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmMessage, setConfirmMessage] = useState('');
  const [confirmCallback, setConfirmCallback] = useState(null);

  useEffect(() => {
    loadPriorAuthorization();
  }, [id]);

  const loadPriorAuthorization = async () => {
    try {
      setLoading(true);
      const response = await api.getPriorAuthorization(id);
      setPriorAuth(response.data);
    } catch (error) {
      console.error('Error loading prior authorization:', error);
      setErrorMessage('Error loading prior authorization');
      setShowErrorModal(true);
      setTimeout(() => navigate('/prior-authorizations'), 2000);
    } finally {
      setLoading(false);
    }
  };

  const handleLoadBundle = async () => {
    try {
      setActionLoading(true);
      // Show actual stored bundles from database
      const bundleData = {
        request: priorAuth.request_bundle || null,
        response: priorAuth.response_bundle || null
      };
      setBundle(bundleData);
      setShowBundleDialog(true);
    } catch (error) {
      console.error('Error loading bundle:', error);
      setErrorMessage(`Error: ${extractErrorMessage(error)}`);
      setShowErrorModal(true);
    } finally {
      setActionLoading(false);
    }
  };

  // Extract totals from response bundle
  const getResponseTotals = () => {
    if (!priorAuth.response_bundle) return null;
    
    const claimResponse = priorAuth.response_bundle?.entry?.find(
      e => e.resource?.resourceType === 'ClaimResponse'
    )?.resource;
    
    if (!claimResponse?.total) return null;
    
    return claimResponse.total.map(t => ({
      category: t.category?.coding?.[0]?.code,
      categoryDisplay: t.category?.coding?.[0]?.display,
      amount: t.amount?.value,
      currency: t.amount?.currency || 'SAR'
    }));
  };

  // Extract adjudication outcome from response
  const getAdjudicationOutcome = () => {
    if (!priorAuth.response_bundle) return null;
    
    const claimResponse = priorAuth.response_bundle?.entry?.find(
      e => e.resource?.resourceType === 'ClaimResponse'
    )?.resource;
    
    return claimResponse?.extension?.find(
      ext => ext.url?.includes('extension-adjudication-outcome')
    )?.valueCodeableConcept?.coding?.[0]?.code;
  };

  // Extract Bundle-level details from response bundle
  const getBundleDetails = () => {
    if (!priorAuth.response_bundle) return null;
    
    return {
      id: priorAuth.response_bundle.id,
      type: priorAuth.response_bundle.type,
      timestamp: priorAuth.response_bundle.timestamp,
      profile: priorAuth.response_bundle.meta?.profile?.[0],
      entryCount: priorAuth.response_bundle.entry?.length
    };
  };

  // Extract MessageHeader details from response bundle
  const getMessageHeaderDetails = () => {
    if (!priorAuth.response_bundle) return null;
    
    const messageHeader = priorAuth.response_bundle?.entry?.find(
      e => e.resource?.resourceType === 'MessageHeader'
    )?.resource;
    
    if (!messageHeader) return null;

    return {
      id: messageHeader.id,
      profile: messageHeader.meta?.profile?.[0],
      eventCode: messageHeader.eventCoding?.code,
      eventSystem: messageHeader.eventCoding?.system,
      metaTag: messageHeader.meta?.tag?.[0]?.code,
      metaTagSystem: messageHeader.meta?.tag?.[0]?.system,
      destinationEndpoint: messageHeader.destination?.[0]?.endpoint,
      receiverIdentifier: messageHeader.destination?.[0]?.receiver?.identifier?.value,
      receiverSystem: messageHeader.destination?.[0]?.receiver?.identifier?.system,
      receiverType: messageHeader.destination?.[0]?.receiver?.type,
      senderIdentifier: messageHeader.sender?.identifier?.value,
      senderSystem: messageHeader.sender?.identifier?.system,
      senderType: messageHeader.sender?.type,
      sourceEndpoint: messageHeader.source?.endpoint,
      responseIdentifier: messageHeader.response?.identifier,
      responseCode: messageHeader.response?.code,
      focusReference: messageHeader.focus?.[0]?.reference
    };
  };

  // Extract ClaimResponse details from response bundle
  const getClaimResponseDetails = () => {
    if (!priorAuth.response_bundle) return null;
    
    const claimResponse = priorAuth.response_bundle?.entry?.find(
      e => e.resource?.resourceType === 'ClaimResponse'
    )?.resource;
    
    if (!claimResponse) return null;

    // Get insurance details
    const insurance = claimResponse.insurance?.[0];

    // Helper to extract ID from reference
    const extractIdFromRef = (ref) => {
      if (!ref) return null;
      const parts = ref.split('/');
      return parts[parts.length - 1];
    };

    // Extract adjudication outcome from extension
    const adjudicationOutcome = claimResponse.extension?.find(
      ext => ext.url?.includes('extension-adjudication-outcome')
    )?.valueCodeableConcept?.coding?.[0]?.code;

    // Extract process notes (important for referral/transfer info)
    const processNotes = claimResponse.processNote?.map(note => ({
      number: note.number,
      type: note.type,
      text: note.text
    })) || [];

    return {
      id: claimResponse.id,
      profile: claimResponse.meta?.profile?.[0],
      metaTag: claimResponse.meta?.tag?.[0]?.code,
      metaTagDisplay: claimResponse.meta?.tag?.[0]?.display,
      identifier: claimResponse.identifier?.[0]?.value,
      identifierSystem: claimResponse.identifier?.[0]?.system,
      status: claimResponse.status,
      type: claimResponse.type?.coding?.[0]?.code,
      subType: claimResponse.subType?.coding?.[0]?.code,
      use: claimResponse.use,
      outcome: claimResponse.outcome,
      adjudicationOutcome: adjudicationOutcome,
      preAuthRef: claimResponse.preAuthRef,
      preAuthPeriod: claimResponse.preAuthPeriod,
      created: claimResponse.created,
      disposition: claimResponse.disposition,
      processNotes: processNotes,
      // References
      patientReference: claimResponse.patient?.reference,
      patientId: extractIdFromRef(claimResponse.patient?.reference),
      insurerReference: claimResponse.insurer?.reference,
      insurerId: extractIdFromRef(claimResponse.insurer?.reference),
      requestorReference: claimResponse.requestor?.reference,
      requestorId: extractIdFromRef(claimResponse.requestor?.reference),
      // Original request details
      requestType: claimResponse.request?.type,
      requestIdentifier: claimResponse.request?.identifier?.value,
      requestIdentifierSystem: claimResponse.request?.identifier?.system,
      // Insurance details
      insuranceSequence: insurance?.sequence,
      insuranceFocal: insurance?.focal,
      coverageReference: insurance?.coverage?.reference
    };
  };

  // Extract Coverage details from response bundle
  const getCoverageDetails = () => {
    if (!priorAuth.response_bundle) return null;
    
    const coverage = priorAuth.response_bundle?.entry?.find(
      e => e.resource?.resourceType === 'Coverage'
    )?.resource;
    
    if (!coverage) return null;

    // Helper to extract ID from reference
    const extractIdFromRef = (ref) => {
      if (!ref) return null;
      const parts = ref.split('/');
      return parts[parts.length - 1];
    };

    return {
      id: coverage.id,
      memberId: coverage.identifier?.[0]?.value,
      memberIdSystem: coverage.identifier?.[0]?.system,
      status: coverage.status,
      type: coverage.type?.coding?.[0]?.display || coverage.type?.coding?.[0]?.code,
      typeCode: coverage.type?.coding?.[0]?.code,
      policyPeriod: coverage.period,
      planName: coverage.class?.find(c => c.type?.coding?.[0]?.code === 'plan')?.name,
      planValue: coverage.class?.find(c => c.type?.coding?.[0]?.code === 'plan')?.value,
      relationship: coverage.relationship?.coding?.[0]?.display || coverage.relationship?.coding?.[0]?.code,
      relationshipCode: coverage.relationship?.coding?.[0]?.code,
      // References
      policyHolderRef: coverage.policyHolder?.reference,
      policyHolderId: extractIdFromRef(coverage.policyHolder?.reference),
      subscriberRef: coverage.subscriber?.reference,
      subscriberId: extractIdFromRef(coverage.subscriber?.reference),
      beneficiaryRef: coverage.beneficiary?.reference,
      beneficiaryId: extractIdFromRef(coverage.beneficiary?.reference),
      payorRef: coverage.payor?.[0]?.reference,
      payorId: extractIdFromRef(coverage.payor?.[0]?.reference)
    };
  };

  // Extract Patient details from response bundle
  const getPatientFromResponse = () => {
    if (!priorAuth.response_bundle) return null;
    
    const patient = priorAuth.response_bundle?.entry?.find(
      e => e.resource?.resourceType === 'Patient'
    )?.resource;
    
    if (!patient) return null;

    // Get occupation from extension
    const occupationExt = patient.extension?.find(
      ext => ext.url?.includes('extension-occupation')
    );
    const occupation = occupationExt?.valueCodeableConcept?.coding?.[0]?.code;

    // Get marital status
    const maritalStatus = patient.maritalStatus?.coding?.[0]?.code;
    const maritalStatusDisplay = {
      'A': 'Annulled',
      'D': 'Divorced',
      'I': 'Interlocutory',
      'L': 'Legally Separated',
      'M': 'Married',
      'P': 'Polygamous',
      'S': 'Never Married',
      'T': 'Domestic Partner',
      'U': 'Unmarried',
      'W': 'Widowed',
      'UNK': 'Unknown'
    };

    return {
      id: patient.id,
      name: patient.name?.[0]?.text || `${patient.name?.[0]?.given?.join(' ')} ${patient.name?.[0]?.family}`,
      identifier: patient.identifier?.[0]?.value,
      identifierType: patient.identifier?.[0]?.type?.coding?.[0]?.display,
      identifierCountry: patient.identifier?.[0]?.extension?.find(
        ext => ext.url?.includes('extension-identifier-country')
      )?.valueCodeableConcept?.coding?.[0]?.display,
      gender: patient.gender,
      birthDate: patient.birthDate,
      active: patient.active,
      occupation: occupation,
      maritalStatus: maritalStatus,
      maritalStatusDisplay: maritalStatusDisplay[maritalStatus] || maritalStatus,
      deceased: patient.deceasedBoolean
    };
  };

  // Extract Provider Organization details from response bundle
  const getProviderFromResponse = () => {
    if (!priorAuth.response_bundle) return null;
    
    const provider = priorAuth.response_bundle?.entry?.find(
      e => e.resource?.resourceType === 'Organization' && 
           e.resource?.type?.some(t => t.coding?.some(c => c.code === 'prov'))
    )?.resource;
    
    if (!provider) return null;

    // Get provider type from extension
    const providerTypeExt = provider.extension?.find(
      ext => ext.url?.includes('extension-provider-type')
    );
    const providerType = providerTypeExt?.valueCodeableConcept?.coding?.[0];

    return {
      id: provider.id,
      name: provider.name,
      identifier: provider.identifier?.[0]?.value,
      providerType: providerType?.display || providerType?.code,
      active: provider.active,
      address: provider.address?.[0]
    };
  };

  // Extract Insurer Organization details from response bundle
  const getInsurerFromResponse = () => {
    if (!priorAuth.response_bundle) return null;
    
    const insurer = priorAuth.response_bundle?.entry?.find(
      e => e.resource?.resourceType === 'Organization' && 
           e.resource?.type?.some(t => t.coding?.some(c => c.code === 'ins'))
    )?.resource;
    
    if (!insurer) return null;

    return {
      id: insurer.id,
      name: insurer.name,
      identifier: insurer.identifier?.[0]?.value,
      organizationType: insurer.type?.[0]?.coding?.[0]?.display,
      active: insurer.active,
      address: insurer.address?.[0]
    };
  };

  const handleSendToNphies = async () => {
    setConfirmMessage('Send this prior authorization to NPHIES?');
    setConfirmCallback(async () => {
      setShowConfirmModal(false);
      try {
        setActionLoading(true);
        const response = await api.sendPriorAuthorizationToNphies(id);
        
        if (response.success) {
          setSuccessMessage(`Successfully sent to NPHIES!\nPre-Auth Ref: ${response.nphiesResponse?.preAuthRef || 'Pending'}`);
          setShowSuccessModal(true);
          await loadPriorAuthorization();
        } else {
          setErrorMessage(`NPHIES Error: ${response.error?.message || 'Unknown error'}`);
          setShowErrorModal(true);
        }
      } catch (error) {
        console.error('Error sending to NPHIES:', error);
        setErrorMessage(`Error: ${extractErrorMessage(error)}`);
        setShowErrorModal(true);
      } finally {
        setActionLoading(false);
      }
    });
    setShowConfirmModal(true);
  };

  const handlePoll = async () => {
    try {
      setActionLoading(true);
      const response = await api.pollPriorAuthorizationResponse(id);
      await loadPriorAuthorization();
      setSuccessMessage(response.message || 'Polling complete');
      setShowSuccessModal(true);
    } catch (error) {
      console.error('Error polling:', error);
      setErrorMessage(`Error: ${extractErrorMessage(error)}`);
      setShowErrorModal(true);
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!cancelReason.trim()) {
      setErrorMessage('Please provide a reason for cancellation');
      setShowErrorModal(true);
      return;
    }
    
    try {
      setActionLoading(true);
      const response = await api.cancelPriorAuthorization(id, cancelReason);
      
      if (response.success) {
        setSuccessMessage('Prior authorization cancelled successfully');
        setShowSuccessModal(true);
        setShowCancelDialog(false);
        setCancelReason('');
        await loadPriorAuthorization();
      } else {
        setErrorMessage(`Error: ${response.error?.message || 'Failed to cancel'}`);
        setShowErrorModal(true);
      }
    } catch (error) {
      console.error('Error cancelling:', error);
      setErrorMessage(`Error: ${extractErrorMessage(error)}`);
      setShowErrorModal(true);
    } finally {
      setActionLoading(false);
    }
  };

  const handleCreateUpdate = async () => {
    navigate(`/prior-authorizations/${id}/edit?update=true`);
  };

  /**
   * Handle resubmission of rejected/partial authorization
   * Creates a new PA request linked to the original via Claim.related
   */
  const handleResubmit = () => {
    // Navigate to new PA form with resubmission params
    // The form will use the original request_number as related_claim_identifier
    const params = new URLSearchParams({
      resubmit: 'true',
      related_claim_identifier: priorAuth.request_number,
      source_id: id
    });
    navigate(`/prior-authorizations/new?${params.toString()}`);
  };

  /**
   * Handle follow-up authorization (Use Case 7)
   * Creates a new PA request to add services to an approved authorization
   * Linked to the original via Claim.related with relationship "prior"
   */
  const handleFollowUp = () => {
    // Navigate to new PA form with follow-up params
    // The form will use the original request_number as related_claim_identifier
    const params = new URLSearchParams({
      followup: 'true',
      related_claim_identifier: priorAuth.request_number,
      source_id: id
    });
    navigate(`/prior-authorizations/new?${params.toString()}`);
  };

  const handleSubmitAsClaim = async () => {
    // Set default priority from prior auth
    setSelectedPriority(priorAuth?.priority || 'normal');
    // Show priority modal
    setShowPriorityModal(true);
  };

  // Preview Claim Bundle (what will be sent to NPHIES)
  const handlePreviewClaimBundle = async () => {
    try {
      setClaimBundleLoading(true);
      
      // Build claim preview data from the prior authorization
      // For claims, we use the PA's encounter dates as the reference period
      // Item servicedDate must be within the encounter period (BV-00041)
      // Extract date without timezone conversion to avoid date shifting
      let encounterStartDate;
      if (priorAuth.encounter_start) {
        const dateStr = String(priorAuth.encounter_start);
        encounterStartDate = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr.substring(0, 10);
      } else {
        // Fallback to today in local time
        const today = new Date();
        encounterStartDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      }
      
      const claimPreviewData = {
        claim_type: priorAuth.auth_type,
        sub_type: priorAuth.sub_type || 'ip',
        patient_id: priorAuth.patient_id,
        provider_id: priorAuth.provider_id,
        insurer_id: priorAuth.insurer_id,
        pre_auth_ref: priorAuth.pre_auth_ref,
        priority: priorAuth.priority || 'normal',
        encounter_class: priorAuth.encounter_class,
        encounter_start: priorAuth.encounter_start,
        encounter_end: priorAuth.encounter_end,
        service_date: encounterStartDate, // Use encounter start date for service
        total_amount: priorAuth.approved_amount || priorAuth.total_amount,
        currency: priorAuth.currency || 'SAR',
        practice_code: priorAuth.practice_code,
        service_type: priorAuth.service_type,
        eligibility_offline_ref: priorAuth.eligibility_offline_ref,
        items: priorAuth.items?.map((item, idx) => {
          // Extract date without timezone conversion
          // If item.serviced_date is ISO string like "2023-12-03T21:00:00.000Z", extract just the date part
          let itemServicedDate = encounterStartDate;
          if (item.serviced_date && item.serviced_date !== '') {
            // Handle both ISO strings and plain date strings
            const dateStr = String(item.serviced_date);
            if (dateStr.includes('T')) {
              // ISO string - extract date part directly without timezone conversion
              itemServicedDate = dateStr.split('T')[0];
            } else {
              // Plain date string - use as is
              itemServicedDate = dateStr.substring(0, 10);
            }
          }
          
          return {
            ...item,
            sequence: idx + 1,
            serviced_date: itemServicedDate
          };
        }) || [],
        diagnoses: priorAuth.diagnoses || [],
        supporting_info: priorAuth.supporting_info || []
      };
      
      const response = await api.previewClaimSubmissionBundle(claimPreviewData);
      setClaimBundle(response.fhirBundle || response);
      setShowClaimBundleDialog(true);
    } catch (error) {
      console.error('Error previewing claim bundle:', error);
      setErrorMessage(`Error: ${extractErrorMessage(error)}`);
      setShowErrorModal(true);
    } finally {
      setClaimBundleLoading(false);
    }
  };

  // Copy JSON to clipboard
  const handleCopyToClipboard = async (jsonData) => {
    try {
      const jsonString = JSON.stringify(jsonData, null, 2);
      await navigator.clipboard.writeText(jsonString);
      setCopiedToClipboard(true);
      setTimeout(() => setCopiedToClipboard(false), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
      alert('Failed to copy to clipboard');
    }
  };

  // Initialize service code overrides from PA items for professional claims
  const initializeServiceCodeOverrides = () => {
    if (priorAuth?.items) {
      const overrides = priorAuth.items.map((item, idx) => ({
        sequence: idx + 1,
        original_code: item.product_or_service_code || item.service_code,
        original_display: item.product_or_service_display || item.service_display,
        service_code: '', // User will enter the new service code
        service_display: item.product_or_service_display || item.service_display || ''
      }));
      setServiceCodeOverrides(overrides);
    }
  };

  // Handle Submit as Claim button click
  const handleSubmitAsClaimWithResponse = async () => {
    // Set default priority from prior auth
    setSelectedPriority(priorAuth?.priority || 'normal');
    
    // For professional claims, show the service code dialog first, then priority modal
    if (priorAuth?.auth_type === 'professional') {
      initializeServiceCodeOverrides();
      setShowServiceCodeDialog(true);
      return;
    }
    
    // For non-professional claims, show priority modal first
    setShowPriorityModal(true);
  };

  // Update service code override for an item
  const handleServiceCodeChange = (index, field, value) => {
    setServiceCodeOverrides(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  // Submit claim with service code overrides
  const handleSubmitWithServiceCodes = async () => {
    // Validate that all service codes are filled
    const missingCodes = serviceCodeOverrides.filter(item => !item.service_code?.trim());
    if (missingCodes.length > 0) {
      setErrorMessage(`Please enter service codes for all items. Missing codes for items: ${missingCodes.map(i => i.sequence).join(', ')}`);
      setShowErrorModal(true);
      return;
    }
    
    setShowServiceCodeDialog(false);
    // Set default priority from prior auth
    setSelectedPriority(priorAuth?.priority || 'normal');
    // Show priority modal
    setShowPriorityModal(true);
  };

  // Handle priority modal submission
  const handleSubmitWithPriority = async (priority, itemOverrides = null) => {
    setShowPriorityModal(false);
    await submitClaimToNphies(priority, itemOverrides);
  };

  // Core claim submission logic
  const submitClaimToNphies = async (priority, itemOverrides = null) => {
    try {
      setActionLoading(true);
      
      // Step 1: Create the claim from the prior authorization with priority and optional overrides
      const createResponse = await api.createClaimFromPriorAuth(id, { 
        priority: priority || priorAuth?.priority || 'normal',
        itemOverrides: itemOverrides || null
      });
      const claimId = createResponse.data?.id;
      
      if (!claimId) {
        setErrorMessage('Failed to create claim. Please try again.');
        setShowErrorModal(true);
        setActionLoading(false);
        return;
      }
      
      // Step 2: Send the claim to NPHIES
      const sendResponse = await api.sendClaimSubmissionToNphies(claimId);
      
      // Store the full response for viewing
      setClaimResponse({
        claimId,
        success: sendResponse.success,
        nphiesResponse: sendResponse.nphiesResponse,
        data: sendResponse.data,
        error: sendResponse.error,
        requestBundle: sendResponse.data?.request_bundle,
        responseBundle: sendResponse.data?.response_bundle
      });
      
      if (sendResponse.success) {
        const claimRef = sendResponse.nphiesResponse?.nphiesClaimId || sendResponse.data?.nphies_claim_id || 'Pending';
        setShowClaimResponseDialog(true);
      } else {
        setShowClaimResponseDialog(true);
      }
    } catch (error) {
      console.error('Error creating/submitting claim:', error);
      setClaimResponse({
        success: false,
        error: { message: error.response?.data?.error || error.message }
      });
      setShowClaimResponseDialog(true);
    } finally {
      setActionLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    const configs = {
      draft: { variant: 'outline', icon: FileText, className: 'text-gray-600 border-gray-300' },
      pending: { variant: 'default', icon: Clock, className: 'bg-blue-500' },
      queued: { variant: 'secondary', icon: Clock, className: 'bg-yellow-500 text-black' },
      approved: { variant: 'default', icon: CheckCircle, className: 'bg-green-500' },
      partial: { variant: 'default', icon: AlertCircle, className: 'bg-orange-500' },
      denied: { variant: 'destructive', icon: XCircle, className: '' },
      cancelled: { variant: 'outline', icon: XCircle, className: 'text-gray-500' },
      error: { variant: 'destructive', icon: AlertCircle, className: '' }
    };
    const config = configs[status] || configs.draft;
    const Icon = config.icon;
    
    return (
      <Badge variant={config.variant} className={`gap-1 text-base px-3 py-1 ${config.className}`}>
        <Icon className="h-4 w-4" />
        {status?.charAt(0).toUpperCase() + status?.slice(1)}
      </Badge>
    );
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

  if (!priorAuth) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Prior authorization not found</p>
        <Button onClick={() => navigate('/prior-authorizations')} className="mt-4">
          Back to List
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-10">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
        <div className="flex items-start gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate('/prior-authorizations')} className="mt-1">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 truncate">
                {priorAuth.request_number || `PA-${priorAuth.id}`}
              </h1>
              {getStatusBadge(priorAuth.status)}
              {/* Show adjudication outcome if different from status and response exists */}
              {(() => {
                const adjOutcome = priorAuth.adjudication_outcome || getAdjudicationOutcome();
                if (!adjOutcome || adjOutcome === priorAuth.status) return null;
                
                const adjConfig = {
                  approved: { className: 'bg-green-500 text-white', label: 'Approved' },
                  partial: { className: 'bg-orange-500 text-white', label: 'Partial' },
                  rejected: { className: 'bg-red-500 text-white', label: 'Rejected' },
                  denied: { className: 'bg-red-500 text-white', label: 'Denied' },
                  pended: { className: 'bg-yellow-500 text-black', label: 'Pended' }
                };
                const config = adjConfig[adjOutcome] || { className: 'bg-gray-500 text-white', label: adjOutcome };
                
                return (
                  <Badge className={`gap-1 text-xs px-2 py-0.5 ${config.className}`}>
                    {config.label}
                  </Badge>
                );
              })()}
            </div>
            <p className="text-gray-600 text-sm mt-1">
              {getAuthTypeDisplay(priorAuth.auth_type)} Authorization
              {priorAuth.pre_auth_ref && (
                <span className="ml-2 text-green-600 font-mono text-xs">
                  • {priorAuth.pre_auth_ref}
                </span>
              )}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 justify-end">
          {/* Always visible: View Bundle */}
          <Button variant="outline" size="sm" onClick={handleLoadBundle} disabled={actionLoading}>
            <Code className="h-4 w-4 mr-1" />
            FHIR Bundle
          </Button>
          
          {/* Draft/Error status actions */}
          {(priorAuth.status === 'draft' || priorAuth.status === 'error') && (
            <>
              <Button variant="outline" size="sm" onClick={() => navigate(`/prior-authorizations/${id}/edit`)}>
                <Edit className="h-4 w-4 mr-1" />
                Edit
              </Button>
              <Button size="sm" onClick={handleSendToNphies} disabled={actionLoading} className="bg-blue-500 hover:bg-blue-600">
                <Send className="h-4 w-4 mr-1" />
                Send
              </Button>
            </>
          )}
          
          {/* Queued status: Poll */}
          {priorAuth.status === 'queued' && (
            <Button size="sm" onClick={handlePoll} disabled={actionLoading}>
              <RefreshCw className={`h-4 w-4 mr-1 ${actionLoading ? 'animate-spin' : ''}`} />
              Poll
            </Button>
          )}
          
          {/* Approved status actions */}
          {priorAuth.status === 'approved' && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={handlePreviewClaimBundle}
                disabled={actionLoading || claimBundleLoading}
                className="text-blue-600 border-blue-300 hover:bg-blue-50"
              >
                <Code className="h-4 w-4 mr-1" />
                {claimBundleLoading ? '...' : 'Claim JSON'}
              </Button>
              <Button
                size="sm"
                onClick={handleSubmitAsClaimWithResponse}
                disabled={actionLoading}
                className="bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700"
              >
                <Receipt className="h-4 w-4 mr-1" />
                Submit Claim
              </Button>
              <Button variant="outline" size="sm" onClick={handleCreateUpdate} disabled={actionLoading}>
                <Edit className="h-4 w-4 mr-1" />
                Update
              </Button>
              <Button variant="outline" size="sm" onClick={() => setShowCancelDialog(true)} className="text-red-500 border-red-300 hover:bg-red-50">
                <XCircle className="h-4 w-4 mr-1" />
                Cancel
              </Button>
            </>
          )}
          
          {/* Follow Up button for approved authorizations (Use Case 7) */}
          {priorAuth.status === 'approved' && (
            <Button 
              size="sm"
              onClick={handleFollowUp} 
              disabled={actionLoading}
              className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700"
            >
              <PlusCircle className="h-4 w-4 mr-1" />
              Follow Up
            </Button>
          )}
          
          {/* Resubmit button for rejected or partial authorizations */}
          {(priorAuth.status === 'rejected' || priorAuth.adjudication_outcome === 'partial' || priorAuth.outcome === 'partial') && (
            <Button 
              size="sm"
              onClick={handleResubmit} 
              disabled={actionLoading}
              className="bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700"
            >
              <RotateCcw className="h-4 w-4 mr-1" />
              Resubmit
            </Button>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Main Details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Tabs */}
          <div className="flex gap-2 bg-gray-100 p-1 rounded-lg w-fit flex-wrap">
            <TabButton active={activeTab === 'details'} onClick={() => setActiveTab('details')}>
              Details
            </TabButton>
            <TabButton active={activeTab === 'items'} onClick={() => setActiveTab('items')}>
              Items ({priorAuth.items?.length || 0})
            </TabButton>
            <TabButton active={activeTab === 'clinical'} onClick={() => setActiveTab('clinical')}>
              Clinical
            </TabButton>
            {priorAuth.auth_type === 'vision' && (
              <TabButton active={activeTab === 'vision'} onClick={() => setActiveTab('vision')}>
                <Eye className="h-4 w-4 mr-1 inline" />
                Vision Rx
              </TabButton>
            )}
            {priorAuth.auth_type === 'pharmacy' && priorAuth.medication_safety_analysis && (
              <TabButton active={activeTab === 'safety'} onClick={() => setActiveTab('safety')}>
                <Shield className="h-4 w-4 mr-1 inline" />
                AI Safety Analysis
              </TabButton>
            )}
            {priorAuth.response_bundle && (
              <TabButton active={activeTab === 'nphies'} onClick={() => setActiveTab('nphies')}>
                <CheckCircle className="h-4 w-4 mr-1 inline" />
                NPHIES Response
              </TabButton>
            )}
            {/* Communications Tab - Show for queued, pended, or approved PAs */}
            {(priorAuth.status === 'queued' || priorAuth.status === 'approved' || priorAuth.outcome === 'queued' || priorAuth.adjudication_outcome === 'pended') && (
              <TabButton active={activeTab === 'communications'} onClick={() => setActiveTab('communications')}>
                <MessageSquare className="h-4 w-4 mr-1 inline" />
                Communications
              </TabButton>
            )}
            <TabButton active={activeTab === 'responses'} onClick={() => setActiveTab('responses')}>
              Responses ({priorAuth.responses?.length || 0})
            </TabButton>
          </div>

          {/* Details Tab */}
          {activeTab === 'details' && (
            <Card>
              <CardHeader>
                <CardTitle>Request Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-gray-500">Authorization Type</Label>
                    <p className="font-medium">{getAuthTypeDisplay(priorAuth.auth_type)}</p>
                  </div>
                  <div>
                    <Label className="text-gray-500">Priority</Label>
                    <p className="font-medium capitalize">{priorAuth.priority || 'Normal'}</p>
                  </div>
                  {/* Vision claims don't use Encounter per NPHIES */}
                  {priorAuth.auth_type !== 'vision' ? (
                    <div>
                      <Label className="text-gray-500">Encounter Class</Label>
                      <p className="font-medium">{getEncounterClassDisplay(priorAuth.encounter_class)}</p>
                    </div>
                  ) : (
                    <div>
                      <Label className="text-gray-500">Encounter</Label>
                      <p className="text-gray-400 text-sm italic">Not required for Vision claims</p>
                    </div>
                  )}
                  <div>
                    <Label className="text-gray-500">Outcome</Label>
                    <p className="font-medium capitalize">{priorAuth.outcome || '-'}</p>
                  </div>
                </div>

                <hr className="border-gray-200" />

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-gray-500">Request Date</Label>
                    <p className="font-medium">{formatDateTime(priorAuth.request_date)}</p>
                  </div>
                  <div>
                    <Label className="text-gray-500">Response Date</Label>
                    <p className="font-medium">{formatDateTime(priorAuth.response_date)}</p>
                  </div>
                  {priorAuth.pre_auth_period_start && (
                    <>
                      <div>
                        <Label className="text-gray-500">Auth Period Start</Label>
                        <p className="font-medium">{formatDate(priorAuth.pre_auth_period_start)}</p>
                      </div>
                      <div>
                        <Label className="text-gray-500">Auth Period End</Label>
                        <p className="font-medium">{formatDate(priorAuth.pre_auth_period_end)}</p>
                      </div>
                    </>
                  )}
                </div>

                {priorAuth.disposition && (
                  <>
                    <hr className="border-gray-200" />
                    <div>
                      <Label className="text-gray-500">Disposition</Label>
                      <p className="font-medium mt-1">{priorAuth.disposition}</p>
                    </div>
                  </>
                )}

                {/* Cancellation Details Section */}
                {priorAuth.is_cancelled && (
                  <>
                    <hr className="border-gray-200" />
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <XCircle className="h-5 w-5 text-red-600" />
                        <h3 className="font-semibold text-red-800">Cancellation Details</h3>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label className="text-red-700">Cancellation Reason Code</Label>
                          <p className="font-medium text-red-900">
                            {priorAuth.cancellation_reason === 'WI' && 'WI - Wrong Information'}
                            {priorAuth.cancellation_reason === 'NP' && 'NP - Service Not Performed'}
                            {priorAuth.cancellation_reason === 'TAS' && 'TAS - Transaction Already Submitted'}
                            {priorAuth.cancellation_reason === 'SU' && 'SU - Service Unavailable'}
                            {priorAuth.cancellation_reason === 'resubmission' && 'Claim Re-submission'}
                            {!['WI', 'NP', 'TAS', 'SU', 'resubmission'].includes(priorAuth.cancellation_reason) && 
                              (priorAuth.cancellation_reason || 'Not specified')}
                          </p>
                        </div>
                        <div>
                          <Label className="text-red-700">Cancellation Status</Label>
                          <p className="font-medium text-red-900">
                            {priorAuth.responses?.find(r => r.response_type === 'cancel')?.outcome === 'complete' 
                              ? '✓ Confirmed by NPHIES' 
                              : priorAuth.responses?.find(r => r.response_type === 'cancel')?.outcome === 'error'
                              ? '✗ Rejected by NPHIES'
                              : 'Pending'}
                          </p>
                        </div>
                        {priorAuth.responses?.find(r => r.response_type === 'cancel')?.received_at && (
                          <div>
                            <Label className="text-red-700">Cancelled At</Label>
                            <p className="font-medium text-red-900">
                              {formatDateTime(priorAuth.responses.find(r => r.response_type === 'cancel').received_at)}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          )}

          {/* Items Tab */}
          {activeTab === 'items' && (
            <>
            <Card>
              <CardHeader>
                <CardTitle>Service Items</CardTitle>
              </CardHeader>
              <CardContent>
                {priorAuth.items && priorAuth.items.length > 0 ? (
                  <div className="space-y-4">
                    {priorAuth.items.map((item, index) => {
                      // Get item-level adjudication details from response bundle
                      const responseItem = priorAuth.response_bundle?.entry?.find(
                        e => e.resource?.resourceType === 'ClaimResponse'
                      )?.resource?.item?.find(i => i.itemSequence === item.sequence);
                      
                      const itemAdjudications = responseItem?.adjudication || [];
                      const itemOutcome = responseItem?.extension?.find(
                        ext => ext.url?.includes('extension-adjudication-outcome')
                      )?.valueCodeableConcept?.coding?.[0]?.code;
                      
                      return (
                        <div key={index} className="p-4 border rounded-lg bg-gray-50">
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-primary-purple text-white flex items-center justify-center text-sm font-medium">
                                {item.sequence}
                              </div>
                              <div>
                                <p className="font-medium">{item.product_or_service_code}</p>
                                <p className="text-sm text-gray-500">{item.product_or_service_display || item.medication_name || 'No description'}</p>
                              </div>
                            </div>
                            <Badge variant={
                              (itemOutcome === 'approved' || item.adjudication_status === 'approved') ? 'default' : 
                              (itemOutcome === 'rejected' || item.adjudication_status === 'denied') ? 'destructive' : 'outline'
                            } className={(itemOutcome === 'approved' || item.adjudication_status === 'approved') ? 'bg-green-500' : ''}>
                              {itemOutcome || item.adjudication_status || 'pending'}
                            </Badge>
                          </div>
                          
                          {/* Request Details */}
                          <div className="grid grid-cols-4 gap-4 mt-4 text-sm">
                            <div>
                              <p className="text-gray-500">Quantity</p>
                              <p className="font-medium">{item.quantity || 1}</p>
                            </div>
                            <div>
                              <p className="text-gray-500">Unit Price</p>
                              <p className="font-medium">{formatAmount(item.unit_price, item.currency)}</p>
                            </div>
                            <div>
                              <p className="text-gray-500">Net Amount</p>
                              <p className="font-medium">{formatAmount(item.net_amount, item.currency)}</p>
                            </div>
                            {item.serviced_date && (
                              <div>
                                <p className="text-gray-500">Service Date</p>
                                <p className="font-medium">{formatDate(item.serviced_date)}</p>
                              </div>
                            )}
                          </div>
                          
                          {/* Response Adjudication Details */}
                          {itemAdjudications.length > 0 && (
                            <div className="mt-4 pt-4 border-t border-gray-200">
                              <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">
                                NPHIES Adjudication
                              </p>
                              <div className="grid grid-cols-4 gap-4 text-sm">
                                {itemAdjudications.map((adj, adjIdx) => {
                                  const category = adj.category?.coding?.[0]?.code;
                                  const amount = adj.amount?.value;
                                  const value = adj.value;
                                  const displayValue = amount !== undefined 
                                    ? formatAmount(amount, adj.amount?.currency) 
                                    : value !== undefined 
                                      ? value 
                                      : '-';
                                  
                                  const categoryColors = {
                                    eligible: 'text-blue-600',
                                    benefit: 'text-green-600',
                                    copay: 'text-orange-600',
                                    'approved-quantity': 'text-purple-600'
                                  };
                                  
                                  return (
                                    <div key={adjIdx}>
                                      <p className="text-gray-500 capitalize">{category?.replace('-', ' ')}</p>
                                      <p className={`font-medium ${categoryColors[category] || ''}`}>
                                        {displayValue}
                                      </p>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                          
                          {/* Adjudication Reason if present */}
                          {item.adjudication_reason && (
                            <div className="mt-3 p-2 bg-yellow-50 rounded text-sm text-yellow-800">
                              <span className="font-medium">Reason:</span> {item.adjudication_reason}
                            </div>
                          )}
                          
                          {/* Additional item details - Show only relevant fields based on auth type */}
                          {(() => {
                            const hasDentalFields = priorAuth.auth_type === 'dental' && (item.tooth_number || item.tooth_surface);
                            const hasVisionFields = priorAuth.auth_type === 'vision' && item.eye;
                            const hasPharmacyFields = priorAuth.auth_type === 'pharmacy' && item.days_supply;
                            
                            if (!hasDentalFields && !hasVisionFields && !hasPharmacyFields) return null;
                            
                            return (
                              <div className="mt-3 pt-3 border-t text-sm">
                                {/* Dental fields - only for dental auth type */}
                                {priorAuth.auth_type === 'dental' && (
                                  <>
                                    {item.tooth_number && <span className="mr-4">Tooth: {item.tooth_number}</span>}
                                    {item.tooth_surface && <span className="mr-4">Surface: {item.tooth_surface}</span>}
                                  </>
                                )}
                                {/* Vision fields - only for vision auth type */}
                                {priorAuth.auth_type === 'vision' && item.eye && (
                                  <span className="mr-4">Eye: {item.eye}</span>
                                )}
                                {/* Pharmacy fields - only for pharmacy auth type */}
                                {priorAuth.auth_type === 'pharmacy' && item.days_supply && (
                                  <span>Days Supply: {item.days_supply}</span>
                                )}
                              </div>
                            );
                          })()}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-center text-gray-500 py-4">No items</p>
                )}
              </CardContent>
            </Card>

            {/* Lab Observations Section - Only for Professional auth type */}
            {priorAuth.auth_type === 'professional' && priorAuth.lab_observations && priorAuth.lab_observations.length > 0 && (
              <Card className="mt-6">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="h-5 w-5 text-emerald-600" />
                    Lab Observations (LOINC)
                  </CardTitle>
                  <CardDescription>
                    Laboratory test details linked via supportingInfo
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {(Array.isArray(priorAuth.lab_observations) 
                      ? priorAuth.lab_observations 
                      : JSON.parse(priorAuth.lab_observations || '[]')
                    ).map((obs, index) => (
                      <div key={index} className="p-4 border rounded-lg bg-emerald-50/50">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-emerald-500 text-white flex items-center justify-center text-sm font-medium">
                              {obs.sequence || index + 1}
                            </div>
                            <div>
                              <p className="font-medium">{obs.loinc_code}</p>
                              <p className="text-sm text-gray-600">{obs.loinc_display || obs.test_name || 'Lab Test'}</p>
                            </div>
                          </div>
                          <Badge variant="outline" className="capitalize">
                            {obs.status || 'registered'}
                          </Badge>
                        </div>
                        
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4 text-sm">
                          {obs.value && (
                            <div>
                              <p className="text-gray-500">Value</p>
                              <p className="font-medium">
                                {obs.value} {obs.unit || obs.unit_code || ''}
                              </p>
                            </div>
                          )}
                          {obs.effective_date && (
                            <div>
                              <p className="text-gray-500">Effective Date</p>
                              <p className="font-medium">{formatDate(obs.effective_date)}</p>
                            </div>
                          )}
                          {obs.interpretation && (
                            <div>
                              <p className="text-gray-500">Interpretation</p>
                              <p className="font-medium capitalize">{obs.interpretation}</p>
                            </div>
                          )}
                        </div>
                        
                        {(obs.note || obs.notes) && (
                          <div className="mt-3 pt-3 border-t text-sm">
                            <p className="text-gray-500">Notes</p>
                            <p className="text-gray-700">{obs.note || obs.notes}</p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
            </>
          )}

          {/* Clinical Tab */}
          {activeTab === 'clinical' && (
            <Card>
              <CardHeader>
                <CardTitle>Clinical Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Diagnoses */}
                <div>
                  <h4 className="font-medium mb-3 flex items-center gap-2">
                    <Stethoscope className="h-4 w-4" />
                    Diagnoses
                  </h4>
                  {priorAuth.diagnoses && priorAuth.diagnoses.length > 0 ? (
                    <div className="space-y-2">
                      {priorAuth.diagnoses.map((diag, index) => (
                        <div key={index} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                          <Badge variant="outline">{diag.diagnosis_type}</Badge>
                          <span className="font-mono text-sm">{diag.diagnosis_code}</span>
                          <span className="text-gray-600">{diag.diagnosis_display}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-500">No diagnoses recorded</p>
                  )}
                </div>

                <hr className="border-gray-200" />

                {/* Supporting Info */}
                <div>
                  <h4 className="font-medium mb-3 flex items-center gap-2">
                    <Paperclip className="h-4 w-4" />
                    Supporting Information
                  </h4>
                  {priorAuth.supporting_info && priorAuth.supporting_info.length > 0 ? (
                    <div className="space-y-2">
                      {priorAuth.supporting_info.map((info, index) => (
                        <div key={index} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                          <Badge variant="outline">{info.category}</Badge>
                          {info.code && <span className="font-mono text-sm">{info.code}</span>}
                          <span className="text-gray-600">
                            {info.value_string || info.value_quantity || info.value_reference || '-'}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-500">No supporting information</p>
                  )}
                </div>

                {/* Attachments */}
                {priorAuth.attachments && priorAuth.attachments.length > 0 && (
                  <>
                    <hr className="border-gray-200" />
                    <div>
                      <h4 className="font-medium mb-3">Attachments</h4>
                      <div className="space-y-2">
                        {priorAuth.attachments.map((att, index) => (
                          <div key={index} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                            <FileText className="h-5 w-5 text-gray-400" />
                            <div>
                              <p className="font-medium">{att.file_name}</p>
                              <p className="text-sm text-gray-500">
                                {att.content_type} • {att.file_size ? `${(att.file_size / 1024).toFixed(1)} KB` : 'Size unknown'}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          )}

          {/* AI Medication Safety Analysis Tab */}
          {activeTab === 'safety' && priorAuth.auth_type === 'pharmacy' && (
            <div className="space-y-6">
              <Card className="border-blue-200">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="h-5 w-5 text-blue-600" />
                    AI Medication Safety Analysis
                  </CardTitle>
                  <CardDescription>
                    AI-powered analysis of drug interactions, side effects, and safety warnings for this pharmacy authorization
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {priorAuth.medication_safety_analysis ? (
                    <MedicationSafetyPanel
                      analysis={priorAuth.medication_safety_analysis}
                      isLoading={false}
                      error={null}
                    />
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      <Shield className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                      <p>No medication safety analysis available</p>
                      <p className="text-sm mt-1">Safety analysis is generated when medications are added in the pharmacy authorization form</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Drug Interaction Justification - Show if exists */}
              {priorAuth.drug_interaction_justification && (
                <Card className="border-amber-200 bg-amber-50">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-amber-900">
                      <FileText className="h-5 w-5 text-amber-600" />
                      Clinical Justification for Drug Safety Override
                    </CardTitle>
                    <CardDescription className="text-amber-700">
                      This authorization was approved with the following justification for proceeding despite safety warnings
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="bg-white border border-amber-200 rounded-lg p-4">
                      <div className="flex items-start gap-3">
                        <div className="p-2 bg-amber-100 rounded-lg flex-shrink-0">
                          <AlertCircle className="h-5 w-5 text-amber-600" />
                        </div>
                        <div className="flex-1">
                          <p className="text-gray-900 whitespace-pre-wrap">{priorAuth.drug_interaction_justification}</p>
                          {priorAuth.drug_interaction_justification_date && (
                            <p className="text-sm text-gray-500 mt-3 flex items-center gap-1">
                              <Clock className="h-4 w-4" />
                              Provided on: {new Date(priorAuth.drug_interaction_justification_date).toLocaleString()}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="mt-4 p-3 bg-amber-100 border border-amber-200 rounded-lg">
                      <p className="text-sm text-amber-800">
                        <strong>Note:</strong> This authorization contains medications with potential safety concerns. 
                        The prescriber has provided the above clinical justification for proceeding with this prescription.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {/* Vision Prescription Tab */}
          {activeTab === 'vision' && priorAuth.auth_type === 'vision' && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Eye className="h-5 w-5" />
                  Vision Prescription Details
                </CardTitle>
                <CardDescription>
                  Lens specifications for the vision authorization
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* General Vision Prescription Info */}
                {priorAuth.vision_prescription && (
                  <>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div>
                        <Label className="text-gray-500">Product Type</Label>
                        <p className="font-medium capitalize">
                          {priorAuth.vision_prescription.product_type || '-'}
                        </p>
                      </div>
                      <div>
                        <Label className="text-gray-500">Lens Type</Label>
                        <p className="font-medium capitalize">
                          {priorAuth.vision_prescription.lens_type || '-'}
                        </p>
                      </div>
                      <div>
                        <Label className="text-gray-500">Date Written</Label>
                        <p className="font-medium">
                          {formatDate(priorAuth.vision_prescription.date_written) || '-'}
                        </p>
                      </div>
                      <div>
                        <Label className="text-gray-500">Prescription Status</Label>
                        <Badge variant="outline" className="mt-1">
                          {priorAuth.vision_prescription.status || 'Active'}
                        </Badge>
                      </div>
                    </div>

                    <hr className="border-gray-200" />

                    {/* Right Eye */}
                    <div className="p-4 border rounded-lg bg-blue-50/50">
                      <h4 className="font-medium mb-4 flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-blue-500 text-white flex items-center justify-center text-xs font-bold">R</div>
                        Right Eye (OD)
                      </h4>
                      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
                        <div>
                          <p className="text-gray-500">Sphere (SPH)</p>
                          <p className="font-medium text-lg">
                            {priorAuth.vision_prescription.right_eye?.sphere 
                              ? (parseFloat(priorAuth.vision_prescription.right_eye.sphere) >= 0 ? '+' : '') + priorAuth.vision_prescription.right_eye.sphere 
                              : '-'}
                          </p>
                        </div>
                        <div>
                          <p className="text-gray-500">Cylinder (CYL)</p>
                          <p className="font-medium text-lg">
                            {priorAuth.vision_prescription.right_eye?.cylinder 
                              ? (parseFloat(priorAuth.vision_prescription.right_eye.cylinder) >= 0 ? '+' : '') + priorAuth.vision_prescription.right_eye.cylinder 
                              : '-'}
                          </p>
                        </div>
                        <div>
                          <p className="text-gray-500">Axis</p>
                          <p className="font-medium text-lg">
                            {priorAuth.vision_prescription.right_eye?.axis 
                              ? priorAuth.vision_prescription.right_eye.axis + '°' 
                              : '-'}
                          </p>
                        </div>
                        <div>
                          <p className="text-gray-500">Add Power</p>
                          <p className="font-medium text-lg">
                            {priorAuth.vision_prescription.right_eye?.add 
                              ? '+' + priorAuth.vision_prescription.right_eye.add 
                              : '-'}
                          </p>
                        </div>
                        <div>
                          <p className="text-gray-500">Prism</p>
                          <p className="font-medium">
                            {priorAuth.vision_prescription.right_eye?.prism_amount 
                              ? `${priorAuth.vision_prescription.right_eye.prism_amount} ${priorAuth.vision_prescription.right_eye.prism_base || ''}` 
                              : '-'}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Left Eye */}
                    <div className="p-4 border rounded-lg bg-green-50/50">
                      <h4 className="font-medium mb-4 flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-green-500 text-white flex items-center justify-center text-xs font-bold">L</div>
                        Left Eye (OS)
                      </h4>
                      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
                        <div>
                          <p className="text-gray-500">Sphere (SPH)</p>
                          <p className="font-medium text-lg">
                            {priorAuth.vision_prescription.left_eye?.sphere 
                              ? (parseFloat(priorAuth.vision_prescription.left_eye.sphere) >= 0 ? '+' : '') + priorAuth.vision_prescription.left_eye.sphere 
                              : '-'}
                          </p>
                        </div>
                        <div>
                          <p className="text-gray-500">Cylinder (CYL)</p>
                          <p className="font-medium text-lg">
                            {priorAuth.vision_prescription.left_eye?.cylinder 
                              ? (parseFloat(priorAuth.vision_prescription.left_eye.cylinder) >= 0 ? '+' : '') + priorAuth.vision_prescription.left_eye.cylinder 
                              : '-'}
                          </p>
                        </div>
                        <div>
                          <p className="text-gray-500">Axis</p>
                          <p className="font-medium text-lg">
                            {priorAuth.vision_prescription.left_eye?.axis 
                              ? priorAuth.vision_prescription.left_eye.axis + '°' 
                              : '-'}
                          </p>
                        </div>
                        <div>
                          <p className="text-gray-500">Add Power</p>
                          <p className="font-medium text-lg">
                            {priorAuth.vision_prescription.left_eye?.add 
                              ? '+' + priorAuth.vision_prescription.left_eye.add 
                              : '-'}
                          </p>
                        </div>
                        <div>
                          <p className="text-gray-500">Prism</p>
                          <p className="font-medium">
                            {priorAuth.vision_prescription.left_eye?.prism_amount 
                              ? `${priorAuth.vision_prescription.left_eye.prism_amount} ${priorAuth.vision_prescription.left_eye.prism_base || ''}` 
                              : '-'}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Additional Notes */}
                    {priorAuth.vision_prescription.notes && (
                      <>
                        <hr className="border-gray-200" />
                        <div>
                          <Label className="text-gray-500">Prescriber Notes</Label>
                          <p className="mt-1 p-3 bg-gray-50 rounded-lg">
                            {priorAuth.vision_prescription.notes}
                          </p>
                        </div>
                      </>
                    )}
                  </>
                )}

                {!priorAuth.vision_prescription && (
                  <div className="text-center py-8 text-gray-500">
                    <Eye className="h-12 w-12 mx-auto mb-3 opacity-30" />
                    <p>No vision prescription data available</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* NPHIES Response Tab */}
          {activeTab === 'nphies' && priorAuth.response_bundle && (
            <div className="space-y-6">
              {/* Bundle Info */}
              {(() => {
                const bundleDetails = getBundleDetails();
                if (!bundleDetails) return null;

                return (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Code className="h-5 w-5" />
                        Response Bundle
                      </CardTitle>
                      <CardDescription>
                        FHIR Bundle Container Information
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div>
                          <Label className="text-gray-500">Bundle ID</Label>
                          <p className="font-mono text-xs break-all">{bundleDetails.id || '-'}</p>
                        </div>
                        <div>
                          <Label className="text-gray-500">Type</Label>
                          <Badge variant="outline" className="mt-1">
                            {bundleDetails.type || '-'}
                          </Badge>
                        </div>
                        <div>
                          <Label className="text-gray-500">Timestamp</Label>
                          <p className="font-medium text-sm">{formatDateTime(bundleDetails.timestamp)}</p>
                        </div>
                        <div>
                          <Label className="text-gray-500">Entries</Label>
                          <Badge variant="secondary" className="mt-1">
                            {bundleDetails.entryCount || 0} resources
                          </Badge>
                        </div>
                      </div>
                      {bundleDetails.profile && (
                        <div className="mt-4 pt-4 border-t">
                          <Label className="text-gray-500">Profile</Label>
                          <p className="font-mono text-xs text-gray-500 break-all mt-1">{bundleDetails.profile}</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })()}

              {/* Message Header Details */}
              {(() => {
                const messageHeader = getMessageHeaderDetails();
                if (!messageHeader) return null;

                return (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <FileText className="h-5 w-5" />
                        Message Header
                      </CardTitle>
                      <CardDescription>
                        NPHIES Message Exchange Details
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div>
                          <Label className="text-gray-500">Message ID</Label>
                          <p className="font-mono text-xs break-all">{messageHeader.id || '-'}</p>
                        </div>
                        <div>
                          <Label className="text-gray-500">Event</Label>
                          <Badge variant="outline" className="mt-1">
                            {messageHeader.eventCode || '-'}
                          </Badge>
                        </div>
                        <div>
                          <Label className="text-gray-500">Response Code</Label>
                          <Badge 
                            variant={messageHeader.responseCode === 'ok' ? 'default' : 'secondary'}
                            className={messageHeader.responseCode === 'ok' ? 'bg-green-500 mt-1' : 'mt-1'}
                          >
                            {messageHeader.responseCode || '-'}
                          </Badge>
                        </div>
                        <div>
                          <Label className="text-gray-500">Meta Tag</Label>
                          <p className="font-medium text-sm">{messageHeader.metaTag || '-'}</p>
                        </div>
                      </div>
                      
                      <hr className="border-gray-200" />
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="p-3 bg-blue-50 rounded-lg">
                          <Label className="text-blue-700 text-xs uppercase tracking-wider">Sender ({messageHeader.senderType || 'Payer'})</Label>
                          <p className="font-mono text-sm mt-1">{messageHeader.senderIdentifier || '-'}</p>
                          <p className="text-xs text-gray-500 mt-1">Endpoint: {messageHeader.sourceEndpoint || '-'}</p>
                        </div>
                        <div className="p-3 bg-green-50 rounded-lg">
                          <Label className="text-green-700 text-xs uppercase tracking-wider">Receiver ({messageHeader.receiverType || 'Provider'})</Label>
                          <p className="font-mono text-sm mt-1">{messageHeader.receiverIdentifier || '-'}</p>
                          <p className="text-xs text-gray-500 mt-1">Endpoint: {messageHeader.destinationEndpoint || '-'}</p>
                        </div>
                      </div>
                      
                      {(messageHeader.responseIdentifier || messageHeader.focusReference) && (
                        <>
                          <hr className="border-gray-200" />
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {messageHeader.responseIdentifier && (
                              <div>
                                <Label className="text-gray-500">Original Request ID</Label>
                                <p className="font-mono text-xs break-all mt-1">{messageHeader.responseIdentifier}</p>
                              </div>
                            )}
                            {messageHeader.focusReference && (
                              <div>
                                <Label className="text-gray-500">Focus Reference</Label>
                                <p className="font-mono text-xs break-all mt-1">{messageHeader.focusReference}</p>
                              </div>
                            )}
                          </div>
                        </>
                      )}
                    </CardContent>
                  </Card>
                );
              })()}

              {/* ClaimResponse Details */}
              {(() => {
                const claimResponseDetails = getClaimResponseDetails();
                if (!claimResponseDetails) return null;

                return (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Receipt className="h-5 w-5" />
                        Claim Response
                      </CardTitle>
                      <CardDescription>
                        NPHIES Prior Authorization Response Details
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div>
                          <Label className="text-gray-500">Response ID</Label>
                          <p className="font-mono text-xs break-all">{claimResponseDetails.id || '-'}</p>
                        </div>
                        <div>
                          <Label className="text-gray-500">Status</Label>
                          <Badge variant="outline" className="mt-1 capitalize">
                            {claimResponseDetails.status || '-'}
                          </Badge>
                        </div>
                        <div>
                          <Label className="text-gray-500">Outcome</Label>
                          <Badge 
                            variant={claimResponseDetails.outcome === 'complete' ? 'default' : 'secondary'}
                            className={claimResponseDetails.outcome === 'complete' ? 'bg-green-500 mt-1' : 'mt-1'}
                          >
                            {claimResponseDetails.outcome || '-'}
                          </Badge>
                        </div>
                        <div>
                          <Label className="text-gray-500">Created</Label>
                          <p className="font-medium">{formatDate(claimResponseDetails.created)}</p>
                        </div>
                      </div>
                      
                      {/* Meta Tag (NPHIES generated indicator) */}
                      {claimResponseDetails.metaTag && (
                        <div className="p-2 bg-yellow-50 border border-yellow-200 rounded-lg inline-block">
                          <Badge variant="outline" className="text-yellow-700 border-yellow-400">
                            {claimResponseDetails.metaTagDisplay || claimResponseDetails.metaTag}
                          </Badge>
                        </div>
                      )}
                      
                      {/* Identifier */}
                      {claimResponseDetails.identifier && (
                        <>
                          <hr className="border-gray-200" />
                          <div>
                            <Label className="text-gray-500">Response Identifier</Label>
                            <p className="font-mono text-xs break-all mt-1">{claimResponseDetails.identifier}</p>
                            {claimResponseDetails.identifierSystem && (
                              <p className="text-xs text-gray-400 mt-1">{claimResponseDetails.identifierSystem}</p>
                            )}
                          </div>
                        </>
                      )}
                      
                      {/* Original Request Details */}
                      {claimResponseDetails.requestIdentifier && (
                        <>
                          <hr className="border-gray-200" />
                          <div className="p-3 bg-gray-50 rounded-lg">
                            <Label className="text-gray-500 text-xs uppercase tracking-wider">Original Request</Label>
                            <div className="grid grid-cols-2 gap-4 mt-2">
                              <div>
                                <p className="text-xs text-gray-500">Request Type</p>
                                <Badge variant="outline" className="mt-1">
                                  {claimResponseDetails.requestType || '-'}
                                </Badge>
                              </div>
                              <div>
                                <p className="text-xs text-gray-500">Request Identifier</p>
                                <p className="font-mono text-xs break-all mt-1">{claimResponseDetails.requestIdentifier}</p>
                                {claimResponseDetails.requestIdentifierSystem && (
                                  <p className="text-xs text-gray-400">{claimResponseDetails.requestIdentifierSystem}</p>
                                )}
                              </div>
                            </div>
                          </div>
                        </>
                      )}
                      
                      {/* Resource References */}
                      {(claimResponseDetails.patientId || claimResponseDetails.insurerId || claimResponseDetails.requestorId) && (
                        <>
                          <hr className="border-gray-200" />
                          <div>
                            <Label className="text-gray-500 text-xs uppercase tracking-wider mb-3 block">Resource References</Label>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                              {claimResponseDetails.patientReference && (
                                <div className="p-2 bg-blue-50 rounded">
                                  <p className="text-xs text-blue-600 font-medium">Patient</p>
                                  <p className="font-mono text-xs break-all mt-1">{claimResponseDetails.patientId}</p>
                                </div>
                              )}
                              {claimResponseDetails.insurerReference && (
                                <div className="p-2 bg-purple-50 rounded">
                                  <p className="text-xs text-purple-600 font-medium">Insurer</p>
                                  <p className="font-mono text-xs break-all mt-1">{claimResponseDetails.insurerId}</p>
                                </div>
                              )}
                              {claimResponseDetails.requestorReference && (
                                <div className="p-2 bg-green-50 rounded">
                                  <p className="text-xs text-green-600 font-medium">Requestor (Provider)</p>
                                  <p className="font-mono text-xs break-all mt-1">{claimResponseDetails.requestorId}</p>
                                </div>
                              )}
                            </div>
                          </div>
                        </>
                      )}
                      
                      {/* Insurance Details */}
                      {claimResponseDetails.insuranceSequence && (
                        <>
                          <hr className="border-gray-200" />
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                            <div>
                              <Label className="text-gray-500">Insurance Sequence</Label>
                              <p className="font-medium">{claimResponseDetails.insuranceSequence}</p>
                            </div>
                            <div>
                              <Label className="text-gray-500">Focal</Label>
                              <Badge variant={claimResponseDetails.insuranceFocal ? 'default' : 'secondary'}
                                     className={claimResponseDetails.insuranceFocal ? 'bg-blue-500 mt-1' : 'mt-1'}>
                                {claimResponseDetails.insuranceFocal ? 'Yes' : 'No'}
                              </Badge>
                            </div>
                            {claimResponseDetails.coverageReference && (
                              <div>
                                <Label className="text-gray-500">Coverage Reference</Label>
                                <p className="font-mono text-xs break-all">{claimResponseDetails.coverageReference}</p>
                              </div>
                            )}
                          </div>
                        </>
                      )}
                      
                      {/* Profile */}
                      {claimResponseDetails.profile && (
                        <>
                          <hr className="border-gray-200" />
                          <div>
                            <Label className="text-gray-500">FHIR Profile</Label>
                            <p className="font-mono text-xs text-gray-500 break-all mt-1">{claimResponseDetails.profile}</p>
                          </div>
                        </>
                      )}

                      <hr className="border-gray-200" />

                      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        <div>
                          <Label className="text-gray-500">Type</Label>
                          <p className="font-medium capitalize">{claimResponseDetails.type || '-'}</p>
                        </div>
                        <div>
                          <Label className="text-gray-500">Sub Type</Label>
                          <p className="font-medium uppercase">{claimResponseDetails.subType || '-'}</p>
                        </div>
                        <div>
                          <Label className="text-gray-500">Use</Label>
                          <p className="font-medium capitalize">{claimResponseDetails.use || '-'}</p>
                        </div>
                      </div>

                      {/* Pre-Auth Reference - Highlighted */}
                      {claimResponseDetails.preAuthRef && (
                        <>
                          <hr className="border-gray-200" />
                          <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                            <Label className="text-green-700">Pre-Authorization Reference Number</Label>
                            <p className="text-2xl font-mono font-bold text-green-600 mt-1">
                              {claimResponseDetails.preAuthRef}
                            </p>
                          </div>
                        </>
                      )}

                      {/* Pre-Auth Period */}
                      {claimResponseDetails.preAuthPeriod && (
                        <>
                          <hr className="border-gray-200" />
                          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                            <Label className="text-blue-700">Authorization Validity Period</Label>
                            <div className="flex items-center gap-4 mt-2">
                              <div>
                                <p className="text-xs text-gray-500">Start Date</p>
                                <p className="font-medium text-lg">
                                  {formatDate(claimResponseDetails.preAuthPeriod.start)}
                                </p>
                              </div>
                              <div className="text-gray-400">→</div>
                              <div>
                                <p className="text-xs text-gray-500">End Date</p>
                                <p className="font-medium text-lg">
                                  {formatDate(claimResponseDetails.preAuthPeriod.end)}
                                </p>
                              </div>
                              <div className="ml-auto">
                                <Badge variant="outline" className="text-blue-600 border-blue-300">
                                  {(() => {
                                    const end = new Date(claimResponseDetails.preAuthPeriod.end);
                                    const now = new Date();
                                    const days = Math.ceil((end - now) / (1000 * 60 * 60 * 24));
                                    if (days < 0) return 'Expired';
                                    if (days === 0) return 'Expires Today';
                                    return `${days} days remaining`;
                                  })()}
                                </Badge>
                              </div>
                            </div>
                          </div>
                        </>
                      )}

                      {/* Disposition */}
                      {claimResponseDetails.disposition && (
                        <>
                          <hr className="border-gray-200" />
                          <div>
                            <Label className="text-gray-500">Disposition</Label>
                            <p className="mt-1 p-3 bg-gray-50 rounded-lg">
                              {claimResponseDetails.disposition}
                            </p>
                          </div>
                        </>
                      )}

                      {/* Adjudication Outcome */}
                      {claimResponseDetails.adjudicationOutcome && (
                        <>
                          <hr className="border-gray-200" />
                          <div className={`p-4 rounded-lg border ${
                            claimResponseDetails.adjudicationOutcome === 'approved' ? 'bg-green-50 border-green-200' :
                            claimResponseDetails.adjudicationOutcome === 'rejected' ? 'bg-red-50 border-red-200' :
                            claimResponseDetails.adjudicationOutcome === 'pended' ? 'bg-yellow-50 border-yellow-200' :
                            'bg-gray-50 border-gray-200'
                          }`}>
                            <Label className={`${
                              claimResponseDetails.adjudicationOutcome === 'approved' ? 'text-green-700' :
                              claimResponseDetails.adjudicationOutcome === 'rejected' ? 'text-red-700' :
                              claimResponseDetails.adjudicationOutcome === 'pended' ? 'text-yellow-700' :
                              'text-gray-700'
                            }`}>Adjudication Outcome</Label>
                            <Badge 
                              className={`mt-2 text-lg px-3 py-1 ${
                                claimResponseDetails.adjudicationOutcome === 'approved' ? 'bg-green-500' :
                                claimResponseDetails.adjudicationOutcome === 'rejected' ? 'bg-red-500' :
                                claimResponseDetails.adjudicationOutcome === 'pended' ? 'bg-yellow-500 text-yellow-900' :
                                'bg-gray-500'
                              }`}
                            >
                              {claimResponseDetails.adjudicationOutcome.toUpperCase()}
                            </Badge>
                          </div>
                        </>
                      )}

                      {/* Process Notes - Important for referral/transfer info */}
                      {claimResponseDetails.processNotes && claimResponseDetails.processNotes.length > 0 && (
                        <>
                          <hr className="border-gray-200" />
                          <div>
                            <Label className="text-gray-500 flex items-center gap-2">
                              <MessageSquare className="h-4 w-4" />
                              Process Notes
                            </Label>
                            <div className="mt-2 space-y-2">
                              {claimResponseDetails.processNotes.map((note, idx) => (
                                <div key={idx} className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                                  <div className="flex items-center gap-2 mb-1">
                                    {note.number && (
                                      <Badge variant="outline" className="text-amber-700 border-amber-400">
                                        #{note.number}
                                      </Badge>
                                    )}
                                    {note.type && (
                                      <Badge variant="outline" className="text-amber-600 border-amber-300 capitalize">
                                        {note.type}
                                      </Badge>
                                    )}
                                  </div>
                                  <p className="text-amber-800">{note.text}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        </>
                      )}
                    </CardContent>
                  </Card>
                );
              })()}

              {/* Totals Summary */}
              {(() => {
                const totals = getResponseTotals();
                const outcome = getAdjudicationOutcome();
                if (!totals) return null;

                return (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <DollarSign className="h-5 w-5" />
                        Financial Adjudication
                        {outcome && (
                          <Badge 
                            variant={outcome === 'approved' ? 'default' : outcome === 'rejected' ? 'destructive' : 'secondary'}
                            className={outcome === 'approved' ? 'bg-green-500 ml-2' : 'ml-2'}
                          >
                            {outcome}
                          </Badge>
                        )}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {totals.map((t, i) => (
                          <div 
                            key={i} 
                            className={`p-4 rounded-lg border ${
                              t.category === 'eligible' ? 'bg-blue-50 border-blue-200' :
                              t.category === 'benefit' ? 'bg-green-50 border-green-200' :
                              t.category === 'copay' ? 'bg-orange-50 border-orange-200' :
                              'bg-gray-50 border-gray-200'
                            }`}
                          >
                            <p className={`text-sm font-medium capitalize ${
                              t.category === 'eligible' ? 'text-blue-700' :
                              t.category === 'benefit' ? 'text-green-700' :
                              t.category === 'copay' ? 'text-orange-700' :
                              'text-gray-700'
                            }`}>
                              {t.category?.replace('-', ' ')}
                            </p>
                            <p className={`text-2xl font-bold mt-1 ${
                              t.category === 'eligible' ? 'text-blue-600' :
                              t.category === 'benefit' ? 'text-green-600' :
                              t.category === 'copay' ? 'text-orange-600' :
                              'text-gray-900'
                            }`}>
                              {formatAmount(t.amount, t.currency)}
                            </p>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                );
              })()}

              {/* Coverage Details */}
              {(() => {
                const coverage = getCoverageDetails();
                if (!coverage) return null;

                return (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Shield className="h-5 w-5" />
                        Coverage Information
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div>
                          <Label className="text-gray-500">Member ID</Label>
                          <p className="font-mono font-medium">{coverage.memberId || '-'}</p>
                        </div>
                        <div>
                          <Label className="text-gray-500">Status</Label>
                          <Badge variant={coverage.status === 'active' ? 'default' : 'secondary'} 
                                 className={coverage.status === 'active' ? 'bg-green-500 mt-1' : 'mt-1'}>
                            {coverage.status || '-'}
                          </Badge>
                        </div>
                        <div>
                          <Label className="text-gray-500">Coverage Type</Label>
                          <p className="font-medium">{coverage.type || '-'}</p>
                          {coverage.typeCode && coverage.typeCode !== coverage.type && (
                            <p className="text-xs text-gray-500 font-mono">{coverage.typeCode}</p>
                          )}
                        </div>
                        <div>
                          <Label className="text-gray-500">Subscriber Relationship</Label>
                          <p className="font-medium capitalize">{coverage.relationship || '-'}</p>
                        </div>
                      </div>
                      
                      <hr className="border-gray-200" />
                      
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div>
                          <Label className="text-gray-500">Plan Name</Label>
                          <p className="font-medium">{coverage.planName || '-'}</p>
                        </div>
                        <div>
                          <Label className="text-gray-500">Plan ID</Label>
                          <p className="font-mono text-sm">{coverage.planValue || '-'}</p>
                        </div>
                        {coverage.policyPeriod && (
                          <>
                            <div>
                              <Label className="text-gray-500">Policy Start</Label>
                              <p className="font-medium">{formatDate(coverage.policyPeriod.start)}</p>
                            </div>
                            <div>
                              <Label className="text-gray-500">Policy End</Label>
                              <p className="font-medium">{formatDate(coverage.policyPeriod.end)}</p>
                            </div>
                          </>
                        )}
                      </div>
                      
                      {/* Coverage References */}
                      {(coverage.policyHolderId || coverage.subscriberId || coverage.beneficiaryId || coverage.payorId) && (
                        <>
                          <hr className="border-gray-200" />
                          <div>
                            <Label className="text-gray-500 text-xs uppercase tracking-wider mb-3 block">Coverage References</Label>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                              {coverage.policyHolderId && (
                                <div className="p-2 bg-gray-50 rounded">
                                  <p className="text-xs text-gray-500">Policy Holder</p>
                                  <p className="font-mono text-xs break-all">{coverage.policyHolderId}</p>
                                </div>
                              )}
                              {coverage.subscriberId && (
                                <div className="p-2 bg-gray-50 rounded">
                                  <p className="text-xs text-gray-500">Subscriber</p>
                                  <p className="font-mono text-xs break-all">{coverage.subscriberId}</p>
                                </div>
                              )}
                              {coverage.beneficiaryId && (
                                <div className="p-2 bg-gray-50 rounded">
                                  <p className="text-xs text-gray-500">Beneficiary</p>
                                  <p className="font-mono text-xs break-all">{coverage.beneficiaryId}</p>
                                </div>
                              )}
                              {coverage.payorId && (
                                <div className="p-2 bg-gray-50 rounded">
                                  <p className="text-xs text-gray-500">Payor</p>
                                  <p className="font-mono text-xs break-all">{coverage.payorId}</p>
                                </div>
                              )}
                            </div>
                          </div>
                        </>
                      )}
                      
                      {/* Member ID System */}
                      {coverage.memberIdSystem && (
                        <>
                          <hr className="border-gray-200" />
                          <div>
                            <Label className="text-gray-500">Member ID System</Label>
                            <p className="font-mono text-xs text-gray-500 mt-1">{coverage.memberIdSystem}</p>
                          </div>
                        </>
                      )}
                    </CardContent>
                  </Card>
                );
              })()}

              {/* Patient Details from Response */}
              {(() => {
                const patient = getPatientFromResponse();
                if (!patient) return null;

                return (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <User className="h-5 w-5" />
                        Patient (from Response)
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div>
                          <Label className="text-gray-500">Name</Label>
                          <p className="font-medium">{patient.name || '-'}</p>
                        </div>
                        <div>
                          <Label className="text-gray-500">Identifier</Label>
                          <p className="font-mono">{patient.identifier || '-'}</p>
                          {patient.identifierType && (
                            <p className="text-xs text-gray-500">{patient.identifierType}</p>
                          )}
                          {patient.identifierCountry && (
                            <p className="text-xs text-gray-500">{patient.identifierCountry}</p>
                          )}
                        </div>
                        <div>
                          <Label className="text-gray-500">Gender</Label>
                          <p className="font-medium capitalize">{patient.gender || '-'}</p>
                        </div>
                        <div>
                          <Label className="text-gray-500">Date of Birth</Label>
                          <p className="font-medium">{formatDate(patient.birthDate)}</p>
                        </div>
                      </div>
                      
                      <hr className="border-gray-200" />
                      
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div>
                          <Label className="text-gray-500">Occupation</Label>
                          <p className="font-medium capitalize">{patient.occupation || '-'}</p>
                        </div>
                        <div>
                          <Label className="text-gray-500">Marital Status</Label>
                          <p className="font-medium">{patient.maritalStatusDisplay || '-'}</p>
                        </div>
                        <div>
                          <Label className="text-gray-500">Status</Label>
                          <Badge variant={patient.active ? 'default' : 'secondary'} 
                                 className={patient.active ? 'bg-green-500' : ''}>
                            {patient.active ? 'Active' : 'Inactive'}
                          </Badge>
                        </div>
                        <div>
                          <Label className="text-gray-500">Deceased</Label>
                          <p className="font-medium">{patient.deceased === true ? 'Yes' : patient.deceased === false ? 'No' : '-'}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })()}

              {/* Provider Organization Details from Response */}
              {(() => {
                const provider = getProviderFromResponse();
                if (!provider) return null;

                return (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Building className="h-5 w-5" />
                        Provider Organization (from Response)
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div>
                          <Label className="text-gray-500">Name</Label>
                          <p className="font-medium">{provider.name || '-'}</p>
                        </div>
                        <div>
                          <Label className="text-gray-500">License ID</Label>
                          <p className="font-mono">{provider.identifier || '-'}</p>
                        </div>
                        <div>
                          <Label className="text-gray-500">Provider Type</Label>
                          <p className="font-medium">{provider.providerType || '-'}</p>
                        </div>
                        <div>
                          <Label className="text-gray-500">Status</Label>
                          <Badge variant={provider.active ? 'default' : 'secondary'} 
                                 className={provider.active ? 'bg-green-500' : ''}>
                            {provider.active ? 'Active' : 'Inactive'}
                          </Badge>
                        </div>
                      </div>
                      
                      {provider.address && (
                        <>
                          <hr className="border-gray-200" />
                          <div>
                            <Label className="text-gray-500">Address</Label>
                            <p className="font-medium mt-1">{provider.address.text || provider.address.line?.join(', ') || '-'}</p>
                            <p className="text-sm text-gray-500">
                              {[provider.address.city, provider.address.state, provider.address.country].filter(Boolean).join(', ')}
                            </p>
                          </div>
                        </>
                      )}
                    </CardContent>
                  </Card>
                );
              })()}

              {/* Insurer Organization Details from Response */}
              {(() => {
                const insurer = getInsurerFromResponse();
                if (!insurer) return null;

                return (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Shield className="h-5 w-5" />
                        Insurer Organization (from Response)
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div>
                          <Label className="text-gray-500">Name</Label>
                          <p className="font-medium">{insurer.name || '-'}</p>
                        </div>
                        <div>
                          <Label className="text-gray-500">License ID</Label>
                          <p className="font-mono">{insurer.identifier || '-'}</p>
                        </div>
                        <div>
                          <Label className="text-gray-500">Organization Type</Label>
                          <p className="font-medium">{insurer.organizationType || '-'}</p>
                        </div>
                        <div>
                          <Label className="text-gray-500">Status</Label>
                          <Badge variant={insurer.active ? 'default' : 'secondary'} 
                                 className={insurer.active ? 'bg-green-500' : ''}>
                            {insurer.active ? 'Active' : 'Inactive'}
                          </Badge>
                        </div>
                      </div>
                      
                      {insurer.address && (
                        <>
                          <hr className="border-gray-200" />
                          <div>
                            <Label className="text-gray-500">Address</Label>
                            <p className="font-medium mt-1">{insurer.address.text || insurer.address.line?.join(', ') || '-'}</p>
                            <p className="text-sm text-gray-500">
                              {[insurer.address.city, insurer.address.state, insurer.address.country].filter(Boolean).join(', ')}
                            </p>
                          </div>
                        </>
                      )}
                    </CardContent>
                  </Card>
                );
              })()}
            </div>
          )}

          {/* Communications Tab */}
          {activeTab === 'communications' && (priorAuth.status === 'queued' || priorAuth.status === 'approved' || priorAuth.outcome === 'queued' || priorAuth.adjudication_outcome === 'pended') && (
            <CommunicationPanel
              priorAuthId={parseInt(id)}
              priorAuthStatus={priorAuth.status}
              items={priorAuth.items || []}
              onStatusUpdate={(updatedPA) => {
                // Refresh the prior auth data
                setPriorAuth(prev => ({
                  ...prev,
                  status: updatedPA.status,
                  outcome: updatedPA.outcome,
                  adjudication_outcome: updatedPA.adjudication_outcome,
                  disposition: updatedPA.disposition
                }));
              }}
            />
          )}

          {/* Responses Tab */}
          {activeTab === 'responses' && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <History className="h-5 w-5" />
                  Response History
                </CardTitle>
              </CardHeader>
              <CardContent>
                {priorAuth.responses && priorAuth.responses.length > 0 ? (
                  <div className="space-y-4">
                    {priorAuth.responses.map((resp, index) => (
                      <div key={index} className="p-4 border rounded-lg">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <Badge variant={resp.has_errors ? 'destructive' : 'default'}>
                              {resp.response_type || 'Response'}
                            </Badge>
                            {resp.is_nphies_generated && (
                              <Badge variant="outline" className="text-yellow-600 border-yellow-300">
                                NPHIES Generated
                              </Badge>
                            )}
                          </div>
                          <span className="text-sm text-gray-500">
                            {formatDateTime(resp.received_at)}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <p className="text-gray-500">Outcome</p>
                            <p className="font-medium capitalize">{resp.outcome}</p>
                          </div>
                          {resp.pre_auth_ref && (
                            <div>
                              <p className="text-gray-500">Pre-Auth Ref</p>
                              <p className="font-medium text-green-600 font-mono">{resp.pre_auth_ref}</p>
                            </div>
                          )}
                        </div>
                        {resp.disposition && (
                          <div className="mt-3">
                            <p className="text-gray-500 text-sm">Disposition</p>
                            <p className="mt-1">{resp.disposition}</p>
                          </div>
                        )}
                        {resp.has_errors && resp.errors && (
                          <div className="mt-3 p-3 bg-red-50 rounded-lg">
                            <p className="text-sm font-medium text-red-800 mb-2">Errors:</p>
                            <ul className="text-sm text-red-600 space-y-1">
                              {(typeof resp.errors === 'string' ? JSON.parse(resp.errors) : resp.errors).map((err, i) => (
                                <li key={i}>{err.details || err.message || JSON.stringify(err)}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-gray-500 py-8">No responses yet</p>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right Column - Summary Cards */}
        <div className="space-y-6">
          {/* Financial Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                Financial Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between">
                <span className="text-gray-500">Requested Amount</span>
                <span className="font-medium">
                  {formatAmount(
                    priorAuth.total_amount || calculateTotalFromItems(priorAuth.items), 
                    priorAuth.currency
                  )}
                </span>
              </div>
              
              {/* Response totals from NPHIES */}
              {(() => {
                const totals = getResponseTotals();
                const outcome = getAdjudicationOutcome();
                if (!totals) return null;
                
                return (
                  <>
                    <hr className="border-gray-200" />
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-sm font-medium text-gray-700">NPHIES Response</span>
                      {outcome && (
                        <Badge variant={outcome === 'approved' ? 'default' : outcome === 'rejected' ? 'destructive' : 'secondary'}
                               className={outcome === 'approved' ? 'bg-green-500' : ''}>
                          {outcome}
                        </Badge>
                      )}
                    </div>
                    {totals.map((t, i) => (
                      <div key={i} className="flex justify-between text-sm">
                        <span className="text-gray-500 capitalize">{t.category}</span>
                        <span className={`font-medium ${t.category === 'benefit' ? 'text-green-600' : t.category === 'copay' ? 'text-orange-600' : ''}`}>
                          {formatAmount(t.amount, t.currency)}
                        </span>
                      </div>
                    ))}
                  </>
                );
              })()}
              
              {priorAuth.approved_amount && !getResponseTotals() && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Approved Amount</span>
                  <span className="font-medium text-green-600">
                    {formatAmount(priorAuth.approved_amount, priorAuth.currency)}
                  </span>
                </div>
              )}
              <hr className="border-gray-200" />
              <div className="flex justify-between">
                <span className="text-gray-500">Items</span>
                <span className="font-medium">{priorAuth.items?.length || 0}</span>
              </div>
            </CardContent>
          </Card>

          {/* Patient Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <User className="h-5 w-5" />
                Patient
                {priorAuth.is_newborn && (
                  <Badge className="bg-pink-100 text-pink-700 border-pink-300 ml-2">
                    Newborn
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="font-medium">{priorAuth.patient_name || '-'}</p>
              <p className="text-sm text-gray-500">{priorAuth.patient_identifier}</p>
              {(priorAuth.patient_birth_date || priorAuth.patient_gender) && (
                <div className="flex items-center gap-3 mt-2 text-sm text-gray-600">
                  {priorAuth.patient_birth_date && (
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3.5 w-3.5" />
                      {calculateAge(priorAuth.patient_birth_date)}
                    </span>
                  )}
                  {priorAuth.patient_gender && (
                    <span className="capitalize">{priorAuth.patient_gender}</span>
                  )}
                </div>
              )}
              {/* Newborn Extension Details */}
              {priorAuth.is_newborn && priorAuth.birth_weight && (
                <div className="mt-3 p-2 bg-pink-50 rounded-md border border-pink-200">
                  <p className="text-sm text-pink-700">
                    <span className="font-medium">Birth Weight:</span> {priorAuth.birth_weight} g
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Provider Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Building className="h-5 w-5" />
                Provider
                {priorAuth.is_transfer && (
                  <Badge className="bg-blue-100 text-blue-700 border-blue-300 ml-2">
                    Transfer
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="font-medium">{priorAuth.provider_name || '-'}</p>
              <p className="text-sm text-gray-500 font-mono">{priorAuth.provider_nphies_id}</p>
              {/* Transfer Extension Details */}
              {priorAuth.is_transfer && (
                <div className="mt-3 p-2 bg-blue-50 rounded-md border border-blue-200">
                  <p className="text-sm text-blue-700">
                    This is a referral/transfer request to another provider
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Insurer Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Insurer
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="font-medium">{priorAuth.insurer_name || '-'}</p>
              <p className="text-sm text-gray-500 font-mono">{priorAuth.insurer_nphies_id}</p>
            </CardContent>
          </Card>

          {/* NPHIES References */}
          {(priorAuth.pre_auth_ref || priorAuth.nphies_request_id) && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Activity className="h-5 w-5" />
                  NPHIES References
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {priorAuth.pre_auth_ref && (
                  <div>
                    <p className="text-sm text-gray-500">Pre-Auth Reference</p>
                    <p className="font-mono text-green-600">{priorAuth.pre_auth_ref}</p>
                  </div>
                )}
                {priorAuth.nphies_request_id && (
                  <div>
                    <p className="text-sm text-gray-500">Request ID</p>
                    <p className="font-mono text-sm">{priorAuth.nphies_request_id}</p>
                  </div>
                )}
                {priorAuth.nphies_response_id && (
                  <div>
                    <p className="text-sm text-gray-500">Response ID</p>
                    <p className="font-mono text-sm">{priorAuth.nphies_response_id}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Transfer Authorization Card - NPHIES Test Case 9 */}
          {priorAuth.transfer_auth_number && (
            <Card className="border-blue-300 bg-blue-50">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2 text-blue-700">
                  <RefreshCw className="h-5 w-5" />
                  Transfer Authorization
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <p className="text-sm text-blue-600">Transfer Authorization Number</p>
                  <p className="font-mono text-lg font-bold text-blue-700">{priorAuth.transfer_auth_number}</p>
                </div>
                {(priorAuth.transfer_period_start || priorAuth.transfer_period_end) && (
                  <div className="grid grid-cols-2 gap-4">
                    {priorAuth.transfer_period_start && (
                      <div>
                        <p className="text-sm text-blue-600">Valid From</p>
                        <p className="font-medium">{formatDate(priorAuth.transfer_period_start)}</p>
                      </div>
                    )}
                    {priorAuth.transfer_period_end && (
                      <div>
                        <p className="text-sm text-blue-600">Valid Until</p>
                        <p className="font-medium">{formatDate(priorAuth.transfer_period_end)}</p>
                      </div>
                    )}
                  </div>
                )}
                <p className="text-xs text-blue-600 mt-2">
                  This authorization has been approved for transfer to another provider
                </p>
              </CardContent>
            </Card>
          )}

          {/* Pre-Auth Period Card */}
          {(() => {
            const claimResponse = getClaimResponseDetails();
            if (!claimResponse?.preAuthPeriod) return null;

            const endDate = new Date(claimResponse.preAuthPeriod.end);
            const now = new Date();
            const daysRemaining = Math.ceil((endDate - now) / (1000 * 60 * 60 * 24));
            const isExpired = daysRemaining < 0;
            const isExpiringSoon = daysRemaining >= 0 && daysRemaining <= 7;

            return (
              <Card className={isExpired ? 'border-red-300 bg-red-50' : isExpiringSoon ? 'border-orange-300 bg-orange-50' : 'border-green-300 bg-green-50'}>
                <CardHeader>
                  <CardTitle className={`text-lg flex items-center gap-2 ${isExpired ? 'text-red-700' : isExpiringSoon ? 'text-orange-700' : 'text-green-700'}`}>
                    <Calendar className="h-5 w-5" />
                    Authorization Validity
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Valid From</span>
                    <span className="font-medium">{formatDate(claimResponse.preAuthPeriod.start)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Valid Until</span>
                    <span className="font-medium">{formatDate(claimResponse.preAuthPeriod.end)}</span>
                  </div>
                  <hr className={isExpired ? 'border-red-200' : isExpiringSoon ? 'border-orange-200' : 'border-green-200'} />
                  <div className="text-center">
                    <Badge 
                      variant={isExpired ? 'destructive' : isExpiringSoon ? 'secondary' : 'default'}
                      className={`text-sm py-1 px-3 ${
                        isExpired ? '' : 
                        isExpiringSoon ? 'bg-orange-500 text-white' : 
                        'bg-green-500'
                      }`}
                    >
                      {isExpired 
                        ? 'Expired' 
                        : daysRemaining === 0 
                          ? 'Expires Today' 
                          : `${daysRemaining} days remaining`}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            );
          })()}

          {/* Timeline */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Timeline
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Created</span>
                <span>{formatDateTime(priorAuth.created_at)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Updated</span>
                <span>{formatDateTime(priorAuth.updated_at)}</span>
              </div>
              {priorAuth.request_date && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Sent to NPHIES</span>
                  <span>{formatDateTime(priorAuth.request_date)}</span>
                </div>
              )}
              {priorAuth.response_date && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Response Received</span>
                  <span>{formatDateTime(priorAuth.response_date)}</span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* FHIR Bundle Modal */}
      <Modal
        open={showBundleDialog}
        onClose={() => setShowBundleDialog(false)}
        title="FHIR Bundles"
        description="Request and Response FHIR R4 message bundles for this prior authorization"
        footer={
          <>
            <Button variant="outline" onClick={() => setShowBundleDialog(false)}>Close</Button>
            <Button onClick={() => {
              navigator.clipboard.writeText(JSON.stringify(bundle, null, 2));
              alert('Copied to clipboard!');
            }}>
              Copy All to Clipboard
            </Button>
          </>
        }
      >
        <div className="space-y-6">
          {/* Request Bundle */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                <Send className="h-4 w-4 text-blue-500" />
                Request Bundle
              </h3>
              {bundle?.request && (
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(JSON.stringify(bundle.request, null, 2));
                      setCopiedToClipboard(true);
                      setTimeout(() => setCopiedToClipboard(false), 2000);
                    } catch (error) {
                      console.error('Failed to copy:', error);
                    }
                  }}
                >
                  {copiedToClipboard ? <ClipboardCheck className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              )}
            </div>
            <pre className="bg-gray-900 text-green-400 p-4 rounded-lg text-xs overflow-auto max-h-[30vh]">
              {bundle?.request ? JSON.stringify(bundle.request, null, 2) : 'No request bundle available'}
            </pre>
          </div>
          
          {/* Response Bundle */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                Response Bundle
              </h3>
              {bundle?.response && (
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(JSON.stringify(bundle.response, null, 2));
                      setCopiedToClipboard(true);
                      setTimeout(() => setCopiedToClipboard(false), 2000);
                    } catch (error) {
                      console.error('Failed to copy:', error);
                    }
                  }}
                >
                  {copiedToClipboard ? <ClipboardCheck className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              )}
            </div>
            <pre className="bg-gray-900 text-blue-400 p-4 rounded-lg text-xs overflow-auto max-h-[30vh]">
              {bundle?.response ? JSON.stringify(bundle.response, null, 2) : 'No response bundle yet'}
            </pre>
          </div>
        </div>
      </Modal>

      {/* Cancel Modal */}
      <Modal
        open={showCancelDialog}
        onClose={() => setShowCancelDialog(false)}
        title="Cancel Prior Authorization"
        description="Are you sure you want to cancel this prior authorization? This action will be sent to NPHIES."
        footer={
          <>
            <Button variant="outline" onClick={() => setShowCancelDialog(false)}>Cancel</Button>
            <Button 
              variant="destructive" 
              onClick={handleCancel} 
              disabled={actionLoading || !cancelReason}
              className="bg-red-500 hover:bg-red-600"
            >
              {actionLoading ? 'Cancelling...' : 'Confirm Cancellation'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="cancelReason">Cancellation Reason (NPHIES Required)</Label>
            <select
              id="cancelReason"
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-purple/30"
            >
              <option value="">-- Select Reason --</option>
              <option value="NP">Service Not Performed - Service was not performed</option>
              <option value="WI">Wrong Information - Wrong information submitted</option>
              <option value="TAS">Transaction Already Submitted - Duplicate transaction</option>
              <option value="SU">Service Unavailable - Product/Service is unavailable</option>
              <option value="resubmission">Claim Re-submission - Need to re-submit claim</option>
            </select>
            <p className="text-xs text-gray-500 mt-1">
              Select the appropriate reason code as required by NPHIES
            </p>
          </div>
        </div>
      </Modal>

      {/* Claim Bundle Preview Modal */}
      <Modal
        open={showClaimBundleDialog}
        onClose={() => setShowClaimBundleDialog(false)}
        title="Claim FHIR Bundle Preview"
        description="This is the FHIR bundle that will be sent to NPHIES when you submit this as a claim"
        footer={
          <>
            <Button variant="outline" onClick={() => setShowClaimBundleDialog(false)}>Close</Button>
            <Button 
              onClick={() => handleCopyToClipboard(claimBundle)}
              className="bg-blue-500 hover:bg-blue-600"
            >
              {copiedToClipboard ? (
                <>
                  <ClipboardCheck className="h-4 w-4 mr-2" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4 mr-2" />
                  Copy JSON
                </>
              )}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {claimBundle && (
            <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-auto max-h-[500px] text-xs font-mono">
              {JSON.stringify(claimBundle, null, 2)}
            </pre>
          )}
        </div>
      </Modal>

      {/* Claim Response Modal */}
      <Modal
        open={showClaimResponseDialog}
        onClose={() => {
          setShowClaimResponseDialog(false);
          if (claimResponse?.claimId) {
            navigate(`/claim-submissions/${claimResponse.claimId}`);
          }
        }}
        title={claimResponse?.success ? "Claim Submitted Successfully" : "Claim Submission Result"}
        description={claimResponse?.success 
          ? "The claim has been created and submitted to NPHIES" 
          : "There was an issue with the claim submission"}
        footer={
          <>
            <Button 
              variant="outline" 
              onClick={() => handleCopyToClipboard(claimResponse)}
            >
              {copiedToClipboard ? (
                <>
                  <ClipboardCheck className="h-4 w-4 mr-2" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4 mr-2" />
                  Copy Full Response
                </>
              )}
            </Button>
            <Button 
              onClick={() => {
                setShowClaimResponseDialog(false);
                if (claimResponse?.claimId) {
                  navigate(`/claim-submissions/${claimResponse.claimId}`);
                }
              }}
              className={claimResponse?.success ? "bg-green-500 hover:bg-green-600" : "bg-blue-500 hover:bg-blue-600"}
            >
              {claimResponse?.claimId ? 'View Claim Details' : 'Close'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {/* Status Summary */}
          <div className={`p-4 rounded-lg ${claimResponse?.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
            <div className="flex items-center gap-2">
              {claimResponse?.success ? (
                <CheckCircle className="h-5 w-5 text-green-600" />
              ) : (
                <AlertCircle className="h-5 w-5 text-red-600" />
              )}
              <span className={`font-medium ${claimResponse?.success ? 'text-green-800' : 'text-red-800'}`}>
                {claimResponse?.success ? 'Submission Successful' : 'Submission Failed'}
              </span>
            </div>
            {claimResponse?.claimId && (
              <p className="mt-2 text-sm text-gray-600">Claim ID: <span className="font-mono">{claimResponse.claimId}</span></p>
            )}
            {claimResponse?.nphiesResponse?.nphiesClaimId && (
              <p className="text-sm text-gray-600">NPHIES Claim Ref: <span className="font-mono text-green-600">{claimResponse.nphiesResponse.nphiesClaimId}</span></p>
            )}
            {claimResponse?.nphiesResponse?.outcome && (
              <p className="text-sm text-gray-600">Outcome: <span className="font-semibold">{claimResponse.nphiesResponse.outcome}</span></p>
            )}
            {claimResponse?.nphiesResponse?.disposition && (
              <p className="text-sm text-gray-600">Disposition: {claimResponse.nphiesResponse.disposition}</p>
            )}
            {claimResponse?.error?.message && (
              <p className="mt-2 text-sm text-red-600">Error: {claimResponse.error.message}</p>
            )}
          </div>

          {/* Full Response JSON */}
          <div className="space-y-2">
            <h4 className="font-medium text-gray-700">Full NPHIES Response:</h4>
            <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-auto max-h-[400px] text-xs font-mono">
              {JSON.stringify(claimResponse, null, 2)}
            </pre>
          </div>
        </div>
      </Modal>

      {/* Service Code Dialog for Professional Claims */}
      <Modal
        open={showServiceCodeDialog}
        onClose={() => setShowServiceCodeDialog(false)}
        title="Enter Service Codes for Professional Claim"
        description="Professional claims require service codes from the NPHIES Services CodeSystem. Please enter the correct service code for each item."
        footer={
          <>
            <Button variant="outline" onClick={() => setShowServiceCodeDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleSubmitWithServiceCodes}
              className="bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700"
              disabled={actionLoading}
            >
              <Receipt className="h-4 w-4 mr-2" />
              {actionLoading ? 'Submitting...' : 'Submit Claim'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {/* Info Alert */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5" />
              <div className="text-sm text-blue-800">
                <p className="font-medium">Important:</p>
                <p className="mt-1">
                  Prior Authorization uses <code className="bg-blue-100 px-1 rounded">procedures</code> codes, 
                  but Claims require <code className="bg-blue-100 px-1 rounded">services</code> codes. 
                  Enter the corresponding service code for each procedure below.
                </p>
              </div>
            </div>
          </div>

          {/* Service Code Input Table */}
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Item #</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Original Procedure Code</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Service Code (Required)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {serviceCodeOverrides.map((item, index) => (
                  <tr key={item.sequence} className="bg-white">
                    <td className="px-4 py-3 text-sm text-gray-600">{item.sequence}</td>
                    <td className="px-4 py-3">
                      <div>
                        <code className="text-sm bg-gray-100 px-2 py-1 rounded font-mono">
                          {item.original_code || '-'}
                        </code>
                        {item.original_display && (
                          <p className="text-xs text-gray-500 mt-1">{item.original_display}</p>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="space-y-2">
                        <Input
                          type="text"
                          placeholder="e.g., 83600-00-10"
                          value={item.service_code}
                          onChange={(e) => handleServiceCodeChange(index, 'service_code', e.target.value)}
                          className={`font-mono ${!item.service_code?.trim() ? 'border-red-300 focus:border-red-500' : 'border-gray-300'}`}
                        />
                        <Input
                          type="text"
                          placeholder="Service description (optional)"
                          value={item.service_display}
                          onChange={(e) => handleServiceCodeChange(index, 'service_display', e.target.value)}
                          className="text-sm"
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Help Text */}
          <div className="text-xs text-gray-500 space-y-1">
            <p>• Service codes must be valid codes from the NPHIES Services CodeSystem</p>
            <p>• You can find service codes in your hospital's service catalog or NPHIES documentation</p>
            <p>• Example format: <code className="bg-gray-100 px-1 rounded">83600-00-10</code></p>
          </div>
        </div>
      </Modal>

      {/* Priority Selection Modal */}
      <Modal
        open={showPriorityModal}
        onClose={() => setShowPriorityModal(false)}
        title="Set Claim Priority"
        description="Select the priority for this claim submission. Setting priority to 'Deferred' will result in a pended response from NPHIES."
        footer={
          <>
            <Button variant="outline" onClick={() => setShowPriorityModal(false)}>
              Cancel
            </Button>
            <Button 
              onClick={() => handleSubmitWithPriority(selectedPriority, serviceCodeOverrides.length > 0 ? serviceCodeOverrides : null)}
              disabled={actionLoading || !selectedPriority}
            >
              {actionLoading ? 'Submitting...' : 'Submit Claim'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Priority *</Label>
            <Select
              value={PRIORITY_OPTIONS.find(opt => opt.value === selectedPriority)}
              onChange={(option) => setSelectedPriority(option?.value || 'normal')}
              options={PRIORITY_OPTIONS}
              styles={selectStyles}
              menuPortalTarget={document.body}
              placeholder="Select priority..."
            />
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-sm text-blue-800">
              <strong>Note:</strong> Setting priority to "Deferred" will result in a pended response from NPHIES that requires polling to retrieve the final response.
            </p>
          </div>
        </div>
      </Modal>

      {/* Error Modal */}
      <Modal
        open={showErrorModal}
        onClose={() => setShowErrorModal(false)}
        title="Error"
        description={errorMessage}
        footer={
          <Button onClick={() => setShowErrorModal(false)}>
            Close
          </Button>
        }
      >
        <div className="flex items-center gap-3 text-red-600">
          <AlertCircle className="h-5 w-5" />
          <p className="whitespace-pre-line">{errorMessage}</p>
        </div>
      </Modal>

      {/* Success Modal */}
      <Modal
        open={showSuccessModal}
        onClose={() => setShowSuccessModal(false)}
        title="Success"
        description=""
        footer={
          <Button onClick={() => setShowSuccessModal(false)}>
            Close
          </Button>
        }
      >
        <div className="flex items-center gap-3 text-green-600">
          <CheckCircle className="h-5 w-5" />
          <p className="whitespace-pre-line">{successMessage}</p>
        </div>
      </Modal>

      {/* Confirm Modal */}
      <Modal
        open={showConfirmModal}
        onClose={() => setShowConfirmModal(false)}
        title="Confirm"
        description={confirmMessage}
        footer={
          <>
            <Button variant="outline" onClick={() => setShowConfirmModal(false)}>
              Cancel
            </Button>
            <Button onClick={() => {
              if (confirmCallback) {
                confirmCallback();
              }
            }}>
              Confirm
            </Button>
          </>
        }
      >
        <p className="text-gray-700">{confirmMessage}</p>
      </Modal>

    </div>
  );
}
