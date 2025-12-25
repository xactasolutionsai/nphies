import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import api, { extractErrorMessage } from '@/services/api';
import { 
  ArrowLeft, Send, RefreshCw, XCircle, 
  FileText, User, Building, Shield, Stethoscope, Receipt, 
  Clock, CheckCircle, AlertCircle, Calendar, DollarSign,
  Code, Activity, Paperclip, History, Eye, X, Copy, ExternalLink,
  Wallet, Banknote, ArrowRight, MessageSquare
} from 'lucide-react';
import ClaimCommunicationPanel from '@/components/claims/ClaimCommunicationPanel';

// Helper functions
const getClaimTypeDisplay = (claimType) => {
  const types = {
    institutional: 'Institutional',
    professional: 'Professional',
    pharmacy: 'Pharmacy',
    dental: 'Dental',
    vision: 'Vision'
  };
  return types[claimType] || claimType;
};

const getEncounterClassDisplay = (encounterClass) => {
  const classes = {
    AMB: 'Ambulatory',
    ambulatory: 'Ambulatory',
    EMER: 'Emergency',
    emergency: 'Emergency',
    HH: 'Home Healthcare',
    IMP: 'Inpatient',
    inpatient: 'Inpatient',
    SS: 'Day Case',
    VR: 'Telemedicine'
  };
  return classes[encounterClass] || encounterClass || '-';
};

const formatAmount = (amount, currency = 'SAR') => {
  if (amount == null) return '-';
  return `${parseFloat(amount).toFixed(2)} ${currency}`;
};

const formatDate = (dateString) => {
  if (!dateString) return '-';
  return new Date(dateString).toLocaleDateString();
};

const formatDateTime = (dateString) => {
  if (!dateString) return '-';
  return new Date(dateString).toLocaleString();
};

/**
 * Safely extract value from FHIR CodeableConcept or simple value
 * Handles cases where value might be:
 * - A simple string: "op"
 * - A FHIR CodeableConcept: { coding: [{ code: "op", system: "..." }] }
 * - An object with code property: { code: "op" }
 */
const extractCodeValue = (value, fallback = '-') => {
  if (!value) return fallback;
  if (typeof value === 'string') return value;
  if (typeof value === 'object') {
    // FHIR CodeableConcept structure
    if (value.coding && Array.isArray(value.coding)) {
      return value.coding[0]?.code || value.coding[0]?.display || fallback;
    }
    // Simple object with code
    if (value.code) return value.code;
    // Object with display
    if (value.display) return value.display;
  }
  return fallback;
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

export default function ClaimDetails() {
  const navigate = useNavigate();
  const { id } = useParams();
  
  const [loading, setLoading] = useState(true);
  const [claim, setClaim] = useState(null);
  const [bundle, setBundle] = useState(null);
  const [activeTab, setActiveTab] = useState('details');
  const [showBundleDialog, setShowBundleDialog] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [copiedToClipboard, setCopiedToClipboard] = useState(false);
  const [payments, setPayments] = useState([]);
  const [paymentsLoading, setPaymentsLoading] = useState(false);
  const [simulatingPayment, setSimulatingPayment] = useState(false);
  const [pollingPayments, setPollingPayments] = useState(false);
  const [lastSimulateBundle, setLastSimulateBundle] = useState(null);
  const [lastPollBundle, setLastPollBundle] = useState(null);

  useEffect(() => {
    loadClaim();
  }, [id]);

  // Load payments when claim is loaded
  useEffect(() => {
    if (claim?.claim_number || claim?.nphies_claim_id) {
      loadPayments();
    }
  }, [claim?.claim_number, claim?.nphies_claim_id]);

  const loadClaim = async () => {
    try {
      setLoading(true);
      const response = await api.getClaimSubmission(id);
      setClaim(response.data || response);
    } catch (error) {
      console.error('Error loading claim:', error);
      alert('Error loading claim');
      navigate('/claim-submissions');
    } finally {
      setLoading(false);
    }
  };

  const loadPayments = async () => {
    try {
      setPaymentsLoading(true);
      // Use the numeric claim ID from URL params (id) for the API call
      // The backend query searches by claim_submission_id (integer) and claim_identifier_value (string)
      const response = await api.getPaymentReconciliationsForClaim(id);
      setPayments(response.data || []);
    } catch (error) {
      console.error('Error loading payments:', error);
      setPayments([]);
    } finally {
      setPaymentsLoading(false);
    }
  };

  // Simulate payment for testing (generates a mock PaymentReconciliation)
  const handleSimulatePayment = async () => {
    if (!claim) return;
    
    const isApproved = claim.status === 'approved' || 
                       claim.status === 'complete' || 
                       claim.adjudication_outcome === 'approved';
    
    if (!isApproved) {
      alert('Cannot simulate payment: Claim must be approved first.');
      return;
    }
    
    if (!window.confirm('This will generate a simulated PaymentReconciliation for testing purposes. Continue?')) {
      return;
    }
    
    try {
      setSimulatingPayment(true);
      const response = await api.simulatePaymentReconciliation(id);
      
      if (response.success) {
        // Store the generated bundle for copying
        if (response.data?.generatedBundle) {
          setLastSimulateBundle(response.data.generatedBundle);
        }
        alert(`Payment simulated successfully!\n\nAmount: ${response.data.paymentAmount} SAR\nPayment ID: ${response.data.paymentIdentifier}\n\nClick "Copy Simulate JSON" to copy the generated FHIR bundle.`);
        // Refresh payments list
        await loadPayments();
        // Switch to payments tab
        setActiveTab('payments');
      } else {
        alert(`Failed to simulate payment: ${response.error}`);
      }
    } catch (error) {
      console.error('Error simulating payment:', error);
      const errorMessage = error.response?.data?.error || error.message || 'Unknown error';
      alert(`Error simulating payment: ${errorMessage}`);
    } finally {
      setSimulatingPayment(false);
    }
  };

  // Poll NPHIES for pending payment reconciliations
  const handlePollPayments = async () => {
    if (!window.confirm('This will poll NPHIES for any pending PaymentReconciliation messages. Continue?')) {
      return;
    }
    
    try {
      setPollingPayments(true);
      const response = await api.pollPaymentReconciliations();
      
      // Store the poll request bundle for copying
      if (response.data?.pollRequestBundle) {
        setLastPollBundle(response.data.pollRequestBundle);
      }
      
      if (response.success) {
        const { processed, failed, total } = response.data;
        
        if (total === 0) {
          alert('No pending payment reconciliations found on NPHIES.\n\nClick "Copy Poll JSON" to copy the poll request bundle.');
        } else {
          alert(`Poll complete!\n\nTotal found: ${total}\nProcessed: ${processed}\nFailed: ${failed}\n\nClick "Copy Poll JSON" to copy the poll request bundle.`);
          // Refresh payments list
          await loadPayments();
          // Switch to payments tab if we got new payments
          if (processed > 0) {
            setActiveTab('payments');
          }
        }
      } else {
        alert(`Poll failed: ${response.message}\n\nClick "Copy Poll JSON" to copy the poll request bundle.`);
      }
    } catch (error) {
      console.error('Error polling NPHIES:', error);
      const errorMessage = error.response?.data?.error || error.message || 'Unknown error';
      alert(`Error polling NPHIES: ${errorMessage}`);
    } finally {
      setPollingPayments(false);
    }
  };

  // Copy simulate bundle to clipboard
  const handleCopySimulateBundle = async () => {
    if (!lastSimulateBundle) {
      alert('No simulate bundle available. Run "Simulate Payment" first.');
      return;
    }
    try {
      await navigator.clipboard.writeText(JSON.stringify(lastSimulateBundle, null, 2));
      alert('Simulate bundle copied to clipboard!');
    } catch (error) {
      console.error('Failed to copy:', error);
      alert('Failed to copy to clipboard');
    }
  };

  // Copy poll bundle to clipboard
  const handleCopyPollBundle = async () => {
    if (!lastPollBundle) {
      alert('No poll bundle available. Run "Poll NPHIES Payments" first.');
      return;
    }
    try {
      await navigator.clipboard.writeText(JSON.stringify(lastPollBundle, null, 2));
      alert('Poll bundle copied to clipboard!');
    } catch (error) {
      console.error('Failed to copy:', error);
      alert('Failed to copy to clipboard');
    }
  };

  // Preview simulate bundle (copy JSON before sending)
  const handlePreviewSimulate = async () => {
    if (!claim) return;
    
    const isApproved = claim.status === 'approved' || 
                       claim.status === 'complete' || 
                       claim.adjudication_outcome === 'approved';
    
    if (!isApproved) {
      alert('Cannot preview: Claim must be approved first.');
      return;
    }
    
    try {
      const response = await api.previewSimulatePaymentReconciliation(id);
      
      if (response.success && response.data?.bundle) {
        await navigator.clipboard.writeText(JSON.stringify(response.data.bundle, null, 2));
        setLastSimulateBundle(response.data.bundle);
        alert(`Simulate bundle copied to clipboard!\n\nPayment Amount: ${response.data.paymentAmount} SAR\nBenefit Amount: ${response.data.benefitAmount} SAR\nnphies Fee: ${response.data.nphiesFee} SAR`);
      } else {
        alert(`Failed to preview: ${response.error}`);
      }
    } catch (error) {
      console.error('Error previewing simulate:', error);
      const errorMessage = error.response?.data?.error || error.message || 'Unknown error';
      alert(`Error previewing: ${errorMessage}`);
    }
  };

  // Preview poll bundle (copy JSON before sending)
  const handlePreviewPoll = async () => {
    try {
      const response = await api.previewPollPaymentReconciliation();
      
      if (response.success && response.data?.bundle) {
        await navigator.clipboard.writeText(JSON.stringify(response.data.bundle, null, 2));
        setLastPollBundle(response.data.bundle);
        alert(`Poll bundle copied to clipboard!\n\nProvider ID: ${response.data.providerId}`);
      } else {
        alert(`Failed to preview: ${response.error}`);
      }
    } catch (error) {
      console.error('Error previewing poll:', error);
      const errorMessage = error.response?.data?.error || error.message || 'Unknown error';
      alert(`Error previewing: ${errorMessage}`);
    }
  };

  const handleLoadBundle = async () => {
    try {
      setActionLoading(true);
      // Show actual stored bundles from database
      const bundleData = {
        request: claim.request_bundle || null,
        response: claim.response_bundle || null
      };
      setBundle(bundleData);
      setShowBundleDialog(true);
    } catch (error) {
      console.error('Error loading bundle:', error);
      alert(`Error: ${extractErrorMessage(error)}`);
    } finally {
      setActionLoading(false);
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

  /**
   * Helper to extract ClaimResponse from response_bundle
   * Handles both cases:
   * 1. Bundle structure: { entry: [{ resource: { resourceType: 'ClaimResponse', ... } }] }
   * 2. Direct ClaimResponse: { resourceType: 'ClaimResponse', ... }
   */
  const getClaimResponseFromBundle = () => {
    if (!claim.response_bundle) return null;
    
    // Check if response_bundle is a direct ClaimResponse
    if (claim.response_bundle.resourceType === 'ClaimResponse') {
      return claim.response_bundle;
    }
    
    // Otherwise, look for it in bundle entries
    return claim.response_bundle?.entry?.find(
      e => e.resource?.resourceType === 'ClaimResponse'
    )?.resource || null;
  };

  // Extract totals from response bundle
  const getResponseTotals = () => {
    const claimResponse = getClaimResponseFromBundle();
    
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
    const claimResponse = getClaimResponseFromBundle();
    
    return claimResponse?.extension?.find(
      ext => ext.url?.includes('extension-adjudication-outcome')
    )?.valueCodeableConcept?.coding?.[0]?.code;
  };

  // Extract Bundle-level details from response bundle
  const getBundleDetails = () => {
    if (!claim.response_bundle) return null;
    
    return {
      id: claim.response_bundle.id,
      type: claim.response_bundle.type,
      timestamp: claim.response_bundle.timestamp,
      profile: claim.response_bundle.meta?.profile?.[0],
      entryCount: claim.response_bundle.entry?.length
    };
  };

  // Extract MessageHeader details from response bundle
  const getMessageHeaderDetails = () => {
    if (!claim.response_bundle) return null;
    
    const messageHeader = claim.response_bundle?.entry?.find(
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
    const claimResponse = getClaimResponseFromBundle();
    
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

    // Extract batch extensions
    const batchIdentifier = claimResponse.extension?.find(
      ext => ext.url?.includes('extension-batch-identifier')
    )?.valueIdentifier;
    
    const batchNumber = claimResponse.extension?.find(
      ext => ext.url?.includes('extension-batch-number')
    )?.valuePositiveInt;
    
    const batchPeriod = claimResponse.extension?.find(
      ext => ext.url?.includes('extension-batch-period')
    )?.valuePeriod;

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
      adjudicationOutcome: adjudicationOutcome, // Pended, approved, rejected, partial
      created: claimResponse.created,
      disposition: claimResponse.disposition,
      // Pre-Authorization Reference (from response)
      preAuthRef: claimResponse.preAuthRef,
      preAuthPeriod: claimResponse.preAuthPeriod,
      // Batch information
      batchIdentifier: batchIdentifier?.value,
      batchIdentifierSystem: batchIdentifier?.system,
      batchNumber: batchNumber,
      batchPeriod: batchPeriod,
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
    if (!claim.response_bundle) return null;
    
    const coverage = claim.response_bundle?.entry?.find(
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
    if (!claim.response_bundle) return null;
    
    const patient = claim.response_bundle?.entry?.find(
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
    if (!claim.response_bundle) return null;
    
    const provider = claim.response_bundle?.entry?.find(
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
    if (!claim.response_bundle) return null;
    
    const insurer = claim.response_bundle?.entry?.find(
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
    if (!window.confirm('Send this claim to NPHIES?')) return;
    
    try {
      setActionLoading(true);
      const response = await api.sendClaimSubmissionToNphies(id);
      
      if (response.success) {
        alert(`Successfully sent to NPHIES!\nNPHIES Response ID: ${response.nphiesResponse?.nphiesResponseId || 'Pending'}`);
        await loadClaim();
      } else {
        alert(`NPHIES Error: ${response.error?.message || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error sending to NPHIES:', error);
      alert(`Error: ${extractErrorMessage(error)}`);
    } finally {
      setActionLoading(false);
    }
  };

  const getStatusBadge = (status, outcome) => {
    // Use outcome for display if available (approved, denied, etc.)
    const displayStatus = outcome || status;
    
    const configs = {
      draft: { variant: 'outline', icon: FileText, className: 'text-gray-600 border-gray-300' },
      pending: { variant: 'default', icon: Clock, className: 'bg-blue-500' },
      queued: { variant: 'secondary', icon: Clock, className: 'bg-yellow-500 text-black' },
      pended: { variant: 'secondary', icon: Clock, className: 'bg-yellow-500 text-black' }, // Pended status (for deferred priority claims)
      approved: { variant: 'default', icon: CheckCircle, className: 'bg-green-500' },
      complete: { variant: 'default', icon: CheckCircle, className: 'bg-green-500' },
      partial: { variant: 'default', icon: AlertCircle, className: 'bg-orange-500' },
      denied: { variant: 'destructive', icon: XCircle, className: '' },
      rejected: { variant: 'destructive', icon: XCircle, className: '' },
      cancelled: { variant: 'outline', icon: XCircle, className: 'text-gray-500' },
      error: { variant: 'destructive', icon: AlertCircle, className: '' }
    };
    const config = configs[displayStatus] || configs.draft;
    const Icon = config.icon;
    
    return (
      <Badge variant={config.variant} className={`gap-1 text-base px-3 py-1 ${config.className}`}>
        <Icon className="h-4 w-4" />
        {displayStatus?.charAt(0).toUpperCase() + displayStatus?.slice(1)}
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

  if (!claim) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Claim not found</p>
        <Button onClick={() => navigate('/claim-submissions')} className="mt-4">
          Back to List
        </Button>
      </div>
    );
  }

  const responseTotals = getResponseTotals();
  const adjudicationOutcome = getAdjudicationOutcome();

  return (
    <div className="space-y-6 pb-10">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => navigate('/claim-submissions')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold text-gray-900">
                {claim.claim_number || `CLM-${claim.id}`}
              </h1>
              {getStatusBadge(claim.status, claim.adjudication_outcome || adjudicationOutcome)}
            </div>
            <p className="text-gray-600 mt-1">
              {getClaimTypeDisplay(extractCodeValue(claim.claim_type))} Claim
              {claim.pre_auth_ref && (
                <span className="ml-2 text-blue-600 font-mono">
                  • Pre-Auth Ref: {claim.pre_auth_ref}
                </span>
              )}
              {claim.prior_auth_id && (
                <Link 
                  to={`/prior-authorizations/${claim.prior_auth_id}`}
                  className="ml-2 text-purple-600 hover:underline inline-flex items-center gap-1"
                >
                  <ExternalLink className="h-3 w-3" />
                  View Prior Auth
                </Link>
              )}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleLoadBundle} disabled={actionLoading}>
            <Code className="h-4 w-4 mr-2" />
            View FHIR Bundle
          </Button>
          
          {(claim.status === 'draft' || claim.status === 'error') && (
            <Button onClick={handleSendToNphies} disabled={actionLoading} className="bg-blue-500 hover:bg-blue-600">
              <Send className="h-4 w-4 mr-2" />
              Send to NPHIES
            </Button>
          )}
          
          {claim.status === 'queued' && (
            <Button onClick={loadClaim} disabled={actionLoading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${actionLoading ? 'animate-spin' : ''}`} />
              Refresh Status
            </Button>
          )}
          
          {/* Payment Actions - Show for approved claims */}
          {(claim.status === 'approved' || claim.status === 'complete' || claim.adjudication_outcome === 'approved') && (
            <Button 
              onClick={handleSimulatePayment} 
              disabled={simulatingPayment}
              variant="outline"
              className="border-emerald-500 text-emerald-600 hover:bg-emerald-50"
            >
              {simulatingPayment ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Banknote className="h-4 w-4 mr-2" />
              )}
              {simulatingPayment ? 'Simulating...' : 'Simulate Payment'}
            </Button>
          )}
          
          <Button 
            onClick={handlePollPayments} 
            disabled={pollingPayments}
            variant="outline"
            className="border-purple-500 text-purple-600 hover:bg-purple-50"
          >
            {pollingPayments ? (
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Wallet className="h-4 w-4 mr-2" />
            )}
            {pollingPayments ? 'Polling...' : 'Poll NPHIES Payments'}
          </Button>
          
          {/* Preview JSON Buttons (copy before sending) */}
          {(claim.status === 'approved' || claim.status === 'complete' || claim.adjudication_outcome === 'approved') && (
            <Button 
              onClick={handlePreviewSimulate}
              variant="outline"
              className="border-orange-500 text-orange-600 hover:bg-orange-50"
              title="Preview and copy the PaymentReconciliation bundle (without sending)"
            >
              <Eye className="h-4 w-4 mr-2" />
              Preview Simulate
            </Button>
          )}
          
          <Button 
            onClick={handlePreviewPoll}
            variant="outline"
            className="border-cyan-500 text-cyan-600 hover:bg-cyan-50"
            title="Preview and copy the poll request bundle (without sending)"
          >
            <Eye className="h-4 w-4 mr-2" />
            Preview Poll
          </Button>
          
          {/* Copy JSON Buttons (after sending) */}
          {lastSimulateBundle && (
            <Button 
              onClick={handleCopySimulateBundle}
              variant="outline"
              className="border-green-500 text-green-600 hover:bg-green-50"
              title="Copy the last generated PaymentReconciliation FHIR bundle"
            >
              <Copy className="h-4 w-4 mr-2" />
              Copy Simulate JSON
            </Button>
          )}
          
          {lastPollBundle && (
            <Button 
              onClick={handleCopyPollBundle}
              variant="outline"
              className="border-blue-500 text-blue-600 hover:bg-blue-50"
              title="Copy the last poll request FHIR bundle"
            >
              <Copy className="h-4 w-4 mr-2" />
              Copy Poll JSON
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
              Items ({claim.items?.length || 0})
            </TabButton>
            <TabButton active={activeTab === 'clinical'} onClick={() => setActiveTab('clinical')}>
              Clinical
            </TabButton>
            {claim.response_bundle && (
              <TabButton active={activeTab === 'nphies'} onClick={() => setActiveTab('nphies')}>
                <CheckCircle className="h-4 w-4 mr-1 inline" />
                NPHIES Response
              </TabButton>
            )}
            <TabButton active={activeTab === 'responses'} onClick={() => setActiveTab('responses')}>
              Responses ({claim.responses?.length || 0})
            </TabButton>
            <TabButton active={activeTab === 'payments'} onClick={() => setActiveTab('payments')}>
              <Wallet className="h-4 w-4 mr-1 inline" />
              Payments {payments.length > 0 && `(${payments.length})`}
            </TabButton>
            {/* Communications Tab - Show for queued, pended, or approved claims */}
            {(claim.status === 'queued' || claim.status === 'pended' || claim.status === 'approved' || claim.adjudication_outcome === 'approved') && (
              <TabButton active={activeTab === 'communications'} onClick={() => setActiveTab('communications')}>
                <MessageSquare className="h-4 w-4 mr-1 inline" />
                Communications
              </TabButton>
            )}
          </div>

          {/* Details Tab */}
          {activeTab === 'details' && (
            <Card>
              <CardHeader>
                <CardTitle>Claim Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-gray-500">Claim Type</Label>
                    <p className="font-medium">{getClaimTypeDisplay(extractCodeValue(claim.claim_type))}</p>
                  </div>
                  <div>
                    <Label className="text-gray-500">Sub Type</Label>
                    <p className="font-medium uppercase">{extractCodeValue(claim.sub_type)}</p>
                  </div>
                  <div>
                    <Label className="text-gray-500">Priority</Label>
                    <p className="font-medium capitalize">{extractCodeValue(claim.priority, 'Normal')}</p>
                  </div>
                  <div>
                    <Label className="text-gray-500">Outcome</Label>
                    <p className="font-medium capitalize">{extractCodeValue(claim.outcome) || extractCodeValue(claim.adjudication_outcome) || '-'}</p>
                  </div>
                </div>

                <hr className="border-gray-200" />

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-gray-500">Service Date</Label>
                    <p className="font-medium">{formatDateTime(claim.service_date)}</p>
                  </div>
                  <div>
                    <Label className="text-gray-500">Request Date</Label>
                    <p className="font-medium">{formatDateTime(claim.request_date)}</p>
                  </div>
                  <div>
                    <Label className="text-gray-500">Response Date</Label>
                    <p className="font-medium">{formatDateTime(claim.response_date)}</p>
                  </div>
                  <div>
                    <Label className="text-gray-500">Created At</Label>
                    <p className="font-medium">{formatDateTime(claim.created_at)}</p>
                  </div>
                </div>

                {/* Encounter Info (not for Vision claims) */}
                {extractCodeValue(claim.claim_type) !== 'vision' && claim.encounter_class && (
                  <>
                    <hr className="border-gray-200" />
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label className="text-gray-500">Encounter Class</Label>
                        <p className="font-medium">{getEncounterClassDisplay(extractCodeValue(claim.encounter_class))}</p>
                      </div>
                      {claim.encounter_start && (
                        <div>
                          <Label className="text-gray-500">Encounter Period</Label>
                          <p className="font-medium">
                            {formatDateTime(claim.encounter_start)} - {formatDateTime(claim.encounter_end)}
                          </p>
                        </div>
                      )}
                    </div>
                  </>
                )}

                {claim.disposition && (
                  <>
                    <hr className="border-gray-200" />
                    <div>
                      <Label className="text-gray-500">Disposition</Label>
                      <p className="font-medium mt-1">{claim.disposition}</p>
                    </div>
                  </>
                )}

                {/* Error Summary - Show if there are errors in responses */}
                {claim.responses?.some(r => r.has_errors && r.errors) && (
                  <>
                    <hr className="border-gray-200" />
                    <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                      <div className="flex items-center gap-2 text-red-600 font-semibold mb-3">
                        <AlertCircle className="h-5 w-5" />
                        <span>NPHIES Validation Errors</span>
                      </div>
                      {claim.responses.filter(r => r.has_errors && r.errors).map((resp, respIndex) => {
                        let parsedErrors = [];
                        try {
                          parsedErrors = typeof resp.errors === 'string' ? JSON.parse(resp.errors) : resp.errors;
                          if (!Array.isArray(parsedErrors)) parsedErrors = [parsedErrors];
                        } catch (e) {
                          parsedErrors = [{ message: resp.errors }];
                        }
                        return (
                          <div key={respIndex} className="space-y-2">
                            {parsedErrors.map((error, errIndex) => (
                              <div key={errIndex} className="flex items-start gap-2 text-sm">
                                <XCircle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
                                <div>
                                  {error.code && (
                                    <span className="font-mono text-red-600 mr-2">[{error.code}]</span>
                                  )}
                                  <span className="text-red-700">{error.message || error.diagnostics || JSON.stringify(error)}</span>
                                  {error.location && (
                                    <p className="text-xs text-red-500 mt-0.5 font-mono">{error.location}</p>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          )}

          {/* Items Tab */}
          {activeTab === 'items' && (
            <Card>
              <CardHeader>
                <CardTitle>Service Items</CardTitle>
              </CardHeader>
              <CardContent>
                {claim.items && claim.items.length > 0 ? (
                  <div className="space-y-4">
                    {claim.items.map((item, index) => {
                      // Get item-level adjudication details from response bundle
                      // Handle both bundle structure and direct ClaimResponse
                      const claimResponseForItems = getClaimResponseFromBundle();
                      const responseItem = claimResponseForItems?.item?.find(i => i.itemSequence === item.sequence);
                      
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
                                    tax: 'text-purple-600',
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
                          
                          {/* Additional item details - Show only relevant fields based on claim type */}
                          {(() => {
                            const claimType = extractCodeValue(claim.claim_type);
                            const hasDentalFields = claimType === 'dental' && (item.tooth_number || item.tooth_surface);
                            const hasVisionFields = claimType === 'vision' && item.eye;
                            const hasPharmacyFields = claimType === 'pharmacy' && item.days_supply;
                            
                            if (!hasDentalFields && !hasVisionFields && !hasPharmacyFields) {
                              return null;
                            }
                            
                            return (
                              <div className="mt-3 pt-3 border-t text-sm">
                                {claimType === 'dental' && (
                                  <>
                                    {item.tooth_number && <span className="mr-4">Tooth: {item.tooth_number}</span>}
                                    {item.tooth_surface && <span className="mr-4">Surface: {item.tooth_surface}</span>}
                                  </>
                                )}
                                {claimType === 'vision' && item.eye && (
                                  <span className="mr-4">Eye: {item.eye}</span>
                                )}
                                {claimType === 'pharmacy' && item.days_supply && (
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
                  {claim.diagnoses && claim.diagnoses.length > 0 ? (
                    <div className="space-y-2">
                      {claim.diagnoses.map((diag, index) => (
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
                  {claim.supporting_info && claim.supporting_info.length > 0 ? (
                    <div className="space-y-2">
                      {claim.supporting_info.map((info, index) => (
                        <div key={index} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                          <Badge variant="outline">{info.category}</Badge>
                          {info.code && <span className="font-mono text-sm">{info.code}</span>}
                          <span className="text-gray-600">
                            {info.value_string || info.code_text || info.value_quantity || info.value_reference || '-'}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-500">No supporting information</p>
                  )}
                </div>

                {/* Attachments */}
                {claim.attachments && claim.attachments.length > 0 && (
                  <>
                    <hr className="border-gray-200" />
                    <div>
                      <h4 className="font-medium mb-3">Attachments</h4>
                      <div className="space-y-2">
                        {claim.attachments.map((att, index) => (
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

          {/* NPHIES Response Tab */}
          {activeTab === 'nphies' && claim.response_bundle && (
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
                        NPHIES Claim Response Details
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      {/* NPHIES Response Identifier - Important for tracking */}
                      {claimResponseDetails.identifier && (
                        <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                          <Label className="text-blue-700 text-xs uppercase tracking-wider">NPHIES Response Identifier</Label>
                          <p className="font-mono text-sm mt-1 text-blue-900">{claimResponseDetails.identifier}</p>
                          {claimResponseDetails.identifierSystem && (
                            <p className="text-xs text-blue-600 mt-0.5">{claimResponseDetails.identifierSystem}</p>
                          )}
                        </div>
                      )}

                      {/* Profile Information */}
                      {claimResponseDetails.profile && (
                        <div className="p-2 bg-gray-50 rounded-lg border border-gray-200">
                          <Label className="text-gray-500 text-xs">FHIR Profile</Label>
                          <p className="font-mono text-xs mt-1 text-gray-700 break-all">{claimResponseDetails.profile}</p>
                        </div>
                      )}
                      
                      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
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
                          <Label className="text-gray-500">Adjudication Outcome</Label>
                          {claimResponseDetails.adjudicationOutcome ? (
                            <Badge 
                              variant={claimResponseDetails.adjudicationOutcome === 'approved' ? 'default' : 
                                      claimResponseDetails.adjudicationOutcome === 'rejected' ? 'destructive' :
                                      claimResponseDetails.adjudicationOutcome === 'pended' ? 'secondary' : 'secondary'}
                              className={
                                claimResponseDetails.adjudicationOutcome === 'approved' ? 'bg-green-500 mt-1' :
                                claimResponseDetails.adjudicationOutcome === 'rejected' ? 'bg-red-500 mt-1' :
                                claimResponseDetails.adjudicationOutcome === 'pended' ? 'bg-amber-500 text-white mt-1' :
                                claimResponseDetails.adjudicationOutcome === 'partial' ? 'bg-orange-500 mt-1' : 'mt-1'
                              }
                            >
                              {claimResponseDetails.adjudicationOutcome}
                            </Badge>
                          ) : (
                            <p className="text-sm text-gray-500 mt-1">-</p>
                          )}
                        </div>
                        <div>
                          <Label className="text-gray-500">Use</Label>
                          <Badge variant="outline" className="mt-1">
                            {claimResponseDetails.use || '-'}
                          </Badge>
                        </div>
                      </div>
                      
                      <hr className="border-gray-200" />
                      
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div>
                          <Label className="text-gray-500">Type</Label>
                          <p className="font-medium capitalize">{claimResponseDetails.type || '-'}</p>
                        </div>
                        <div>
                          <Label className="text-gray-500">Sub Type</Label>
                          <p className="font-medium uppercase">{claimResponseDetails.subType || '-'}</p>
                        </div>
                        <div>
                          <Label className="text-gray-500">Created Date</Label>
                          <p className="font-medium">{formatDate(claimResponseDetails.created)}</p>
                        </div>
                        <div>
                          <Label className="text-gray-500">Insurance Focal</Label>
                          <p className="font-medium">{claimResponseDetails.insuranceFocal ? 'Yes' : 'No'}</p>
                        </div>
                      </div>
                      
                      {claimResponseDetails.requestIdentifier && (
                        <>
                          <hr className="border-gray-200" />
                          <div>
                            <Label className="text-gray-500">Original Request</Label>
                            <div className="mt-1 p-3 bg-gray-50 rounded-lg">
                              <p className="font-mono text-sm">{claimResponseDetails.requestIdentifier}</p>
                              <p className="text-xs text-gray-500 mt-1">{claimResponseDetails.requestIdentifierSystem}</p>
                            </div>
                          </div>
                        </>
                      )}

                      {claimResponseDetails.disposition && (
                        <>
                          <hr className="border-gray-200" />
                          <div>
                            <Label className="text-gray-500">Disposition</Label>
                            <p className="mt-1">{claimResponseDetails.disposition}</p>
                          </div>
                        </>
                      )}

                      {/* Pre-Authorization Reference */}
                      {claimResponseDetails.preAuthRef && (
                        <>
                          <hr className="border-gray-200" />
                          <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
                            <Label className="text-purple-700 text-xs uppercase tracking-wider">Pre-Authorization Reference</Label>
                            <p className="font-mono text-sm mt-1 text-purple-900">{claimResponseDetails.preAuthRef}</p>
                            {claimResponseDetails.preAuthPeriod && (
                              <div className="mt-2 pt-2 border-t border-purple-200">
                                <p className="text-xs text-purple-600">Valid Period</p>
                                <p className="text-sm font-medium text-purple-800">
                                  {formatDate(claimResponseDetails.preAuthPeriod.start)} - {formatDate(claimResponseDetails.preAuthPeriod.end)}
                                </p>
                              </div>
                            )}
                          </div>
                        </>
                      )}

                      {/* FHIR References from Response */}
                      {(claimResponseDetails.patientReference || claimResponseDetails.insurerReference || claimResponseDetails.requestorReference || claimResponseDetails.coverageReference) && (
                        <>
                          <hr className="border-gray-200" />
                          <div>
                            <Label className="text-gray-500 text-xs uppercase tracking-wider">FHIR References</Label>
                            <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                              {claimResponseDetails.patientReference && (
                                <div className="p-2 bg-gray-50 rounded">
                                  <p className="text-xs text-gray-500">Patient</p>
                                  <p className="font-mono text-xs break-all">{claimResponseDetails.patientReference}</p>
                                </div>
                              )}
                              {claimResponseDetails.insurerReference && (
                                <div className="p-2 bg-gray-50 rounded">
                                  <p className="text-xs text-gray-500">Insurer</p>
                                  <p className="font-mono text-xs break-all">{claimResponseDetails.insurerReference}</p>
                                </div>
                              )}
                              {claimResponseDetails.requestorReference && (
                                <div className="p-2 bg-gray-50 rounded">
                                  <p className="text-xs text-gray-500">Requestor</p>
                                  <p className="font-mono text-xs break-all">{claimResponseDetails.requestorReference}</p>
                                </div>
                              )}
                              {claimResponseDetails.coverageReference && (
                                <div className="p-2 bg-gray-50 rounded">
                                  <p className="text-xs text-gray-500">Coverage</p>
                                  <p className="font-mono text-xs break-all">{claimResponseDetails.coverageReference}</p>
                                </div>
                              )}
                            </div>
                          </div>
                        </>
                      )}

                      {/* Batch Information */}
                      {(claimResponseDetails.batchIdentifier || claimResponseDetails.batchNumber || claimResponseDetails.batchPeriod) && (
                        <>
                          <hr className="border-gray-200" />
                          <div>
                            <Label className="text-gray-500">Batch Information</Label>
                            <div className="mt-2 space-y-2">
                              {claimResponseDetails.batchIdentifier && (
                                <div>
                                  <p className="text-xs text-gray-500">Batch Identifier</p>
                                  <p className="font-mono text-sm">{claimResponseDetails.batchIdentifier}</p>
                                  {claimResponseDetails.batchIdentifierSystem && (
                                    <p className="text-xs text-gray-400 mt-0.5">{claimResponseDetails.batchIdentifierSystem}</p>
                                  )}
                                </div>
                              )}
                              {claimResponseDetails.batchNumber && (
                                <div>
                                  <p className="text-xs text-gray-500">Batch Number</p>
                                  <p className="font-medium">{claimResponseDetails.batchNumber}</p>
                                </div>
                              )}
                              {claimResponseDetails.batchPeriod && (
                                <div>
                                  <p className="text-xs text-gray-500">Batch Period</p>
                                  <p className="font-medium">
                                    {formatDate(claimResponseDetails.batchPeriod.start)}
                                    {claimResponseDetails.batchPeriod.end && claimResponseDetails.batchPeriod.end !== claimResponseDetails.batchPeriod.start && 
                                      ` - ${formatDate(claimResponseDetails.batchPeriod.end)}`
                                    }
                                  </p>
                                </div>
                              )}
                            </div>
                          </div>
                        </>
                      )}
                    </CardContent>
                  </Card>
                );
              })()}

              {/* Response Totals */}
              {responseTotals && responseTotals.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <DollarSign className="h-5 w-5" />
                      Adjudication Totals
                    </CardTitle>
                    <CardDescription>
                      Summary of claim adjudication amounts
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                      {responseTotals.map((total, idx) => {
                        const categoryColors = {
                          eligible: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
                          benefit: { bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200' },
                          copay: { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200' },
                          deductible: { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200' },
                          tax: { bg: 'bg-gray-50', text: 'text-gray-700', border: 'border-gray-200' }
                        };
                        const colors = categoryColors[total.category] || { bg: 'bg-gray-50', text: 'text-gray-700', border: 'border-gray-200' };
                        
                        return (
                          <div key={idx} className={`p-4 rounded-lg border ${colors.bg} ${colors.border}`}>
                            <p className={`text-xs uppercase tracking-wider font-medium ${colors.text}`}>
                              {total.categoryDisplay || total.category}
                            </p>
                            <p className={`text-2xl font-bold mt-1 ${colors.text}`}>
                              {formatAmount(total.amount, total.currency)}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
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
                {claim.responses && claim.responses.length > 0 ? (
                  <div className="space-y-4">
                    {claim.responses.map((resp, index) => {
                      // Parse errors if it's a string
                      let parsedErrors = [];
                      if (resp.errors) {
                        try {
                          parsedErrors = typeof resp.errors === 'string' ? JSON.parse(resp.errors) : resp.errors;
                          if (!Array.isArray(parsedErrors)) parsedErrors = [parsedErrors];
                        } catch (e) {
                          parsedErrors = [{ message: resp.errors }];
                        }
                      }
                      
                      return (
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
                              <p className="font-medium capitalize">{resp.outcome || '-'}</p>
                            </div>
                            {resp.nphies_claim_id && (
                              <div>
                                <p className="text-gray-500">NPHIES Claim ID</p>
                                <p className="font-medium text-green-600 font-mono">{resp.nphies_claim_id}</p>
                              </div>
                            )}
                          </div>
                          
                          {resp.disposition && (
                            <div className="mt-3">
                              <p className="text-gray-500 text-sm">Disposition</p>
                              <p className="mt-1">{resp.disposition}</p>
                            </div>
                          )}
                          
                          {resp.has_errors && parsedErrors.length > 0 && (
                            <div className="mt-3 p-3 bg-red-50 rounded-lg">
                              <p className="text-sm font-medium text-red-800 mb-2">Errors:</p>
                              <ul className="text-sm text-red-600 space-y-1">
                                {parsedErrors.map((error, errIndex) => (
                                  <li key={errIndex}>{error.details || error.message || JSON.stringify(error)}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-center text-gray-500 py-4">No responses yet</p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Payments Tab */}
          {activeTab === 'payments' && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Wallet className="h-5 w-5 text-emerald-600" />
                  Payment History
                </CardTitle>
                <CardDescription>
                  Payment reconciliations received from insurers for this claim
                </CardDescription>
              </CardHeader>
              <CardContent>
                {paymentsLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="relative">
                      <div className="animate-spin rounded-full h-8 w-8 border-2 border-emerald-500/20"></div>
                      <div className="animate-spin rounded-full h-8 w-8 border-2 border-transparent border-t-emerald-500 absolute top-0"></div>
                    </div>
                  </div>
                ) : payments.length > 0 ? (
                  <div className="space-y-4">
                    {payments.map((payment, index) => (
                      <div 
                        key={payment.id || index} 
                        className="p-4 border border-emerald-200 rounded-xl bg-gradient-to-r from-emerald-50 to-teal-50 hover:shadow-md transition-shadow cursor-pointer"
                        onClick={() => navigate(`/payment-reconciliations/${payment.id}`)}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3">
                            <div className="bg-emerald-100 rounded-lg p-2">
                              <Banknote className="h-5 w-5 text-emerald-600" />
                            </div>
                            <div>
                              <p className="font-semibold text-gray-900">
                                Payment Reconciliation
                              </p>
                              <p className="text-sm text-gray-500 font-mono">
                                {payment.fhir_id || `PR-${payment.id}`}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-xl font-bold text-emerald-600">
                              {formatAmount(payment.claim_payment_amount || payment.payment_amount, 'SAR')}
                            </p>
                            <Badge 
                              variant={payment.status === 'active' ? 'default' : 'secondary'}
                              className={payment.status === 'active' ? 'bg-emerald-500 mt-1' : 'mt-1'}
                            >
                              {payment.status}
                            </Badge>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-emerald-200/50">
                          <div>
                            <p className="text-xs text-gray-500 uppercase tracking-wider">Payment Date</p>
                            <p className="font-medium text-sm">{formatDate(payment.payment_date || payment.detail_date)}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500 uppercase tracking-wider">Insurer</p>
                            <p className="font-medium text-sm">{payment.insurer_name || 'Unknown'}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500 uppercase tracking-wider">Total Reconciliation</p>
                            <p className="font-medium text-sm">{formatAmount(payment.payment_amount, 'SAR')}</p>
                          </div>
                        </div>
                        
                        <div className="flex items-center justify-end mt-3 text-emerald-600 text-sm font-medium">
                          <span>View Full Details</span>
                          <ArrowRight className="h-4 w-4 ml-1" />
                        </div>
                      </div>
                    ))}
                    
                    {/* Summary */}
                    <div className="mt-6 p-4 bg-gray-50 rounded-xl">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-gray-500">Total Payments Received</p>
                          <p className="text-2xl font-bold text-emerald-600">
                            {formatAmount(
                              payments.reduce((sum, p) => sum + parseFloat(p.claim_payment_amount || p.payment_amount || 0), 0),
                              'SAR'
                            )}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-gray-500">Number of Payments</p>
                          <p className="text-2xl font-bold text-gray-900">{payments.length}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <div className="bg-gray-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                      <Wallet className="h-8 w-8 text-gray-400" />
                    </div>
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No Payments Yet</h3>
                    <p className="text-gray-500 max-w-md mx-auto">
                      Payment reconciliation records will appear here when the insurer sends payment notifications for this claim.
                    </p>
                    {claim.adjudication_outcome === 'approved' || claim.outcome === 'complete' ? (
                      <div className="mt-4 p-3 bg-blue-50 rounded-lg inline-block">
                        <p className="text-sm text-blue-700">
                          <CheckCircle className="h-4 w-4 inline mr-1" />
                          This claim has been approved. Payment notification is pending from the insurer.
                        </p>
                      </div>
                    ) : claim.status === 'queued' || claim.status === 'pending' ? (
                      <div className="mt-4 p-3 bg-yellow-50 rounded-lg inline-block">
                        <p className="text-sm text-yellow-700">
                          <Clock className="h-4 w-4 inline mr-1" />
                          This claim is still being processed by the insurer.
                        </p>
                      </div>
                    ) : null}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Communications Tab - Status Check, Poll, and Communications */}
          {activeTab === 'communications' && (
            <ClaimCommunicationPanel 
              claimId={id}
              claimStatus={claim.status}
              nphiesClaimId={claim.nphies_claim_id}
              items={claim.items || []}
              onStatusUpdate={(data) => {
                // Reload claim data when status changes
                loadClaim();
              }}
            />
          )}
        </div>

        {/* Right Column - Summary Cards */}
        <div className="space-y-6">
          {/* Financial Summary */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                Financial Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-gray-500">Total Amount</span>
                  <span className="font-bold text-lg">{formatAmount(claim.total_amount, claim.currency)}</span>
                </div>
                {claim.approved_amount && (
                  <div className="flex justify-between items-center text-green-600">
                    <span>Approved</span>
                    <span className="font-bold">{formatAmount(claim.approved_amount, claim.currency)}</span>
                  </div>
                )}
                {claim.eligible_amount && (
                  <div className="flex justify-between items-center text-blue-600">
                    <span>Eligible</span>
                    <span className="font-bold">{formatAmount(claim.eligible_amount, claim.currency)}</span>
                  </div>
                )}
                {claim.benefit_amount && (
                  <div className="flex justify-between items-center text-green-600">
                    <span>Benefit</span>
                    <span className="font-bold">{formatAmount(claim.benefit_amount, claim.currency)}</span>
                  </div>
                )}
                {claim.copay_amount && (
                  <div className="flex justify-between items-center text-orange-600">
                    <span>Copay</span>
                    <span className="font-bold">{formatAmount(claim.copay_amount, claim.currency)}</span>
                  </div>
                )}
                {claim.tax_amount && (
                  <div className="flex justify-between items-center text-gray-600">
                    <span>Tax</span>
                    <span className="font-bold">{formatAmount(claim.tax_amount, claim.currency)}</span>
                  </div>
                )}
              </div>

              {/* NPHIES Response Totals */}
              {responseTotals && responseTotals.length > 0 && (
                <>
                  <hr className="border-gray-200" />
                  <div>
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">NPHIES Adjudication</p>
                    <div className="space-y-2">
                      {responseTotals.map((total, idx) => (
                        <div key={idx} className="flex justify-between items-center">
                          <span className="text-gray-500 capitalize">{total.category}</span>
                          <span className="font-medium">{formatAmount(total.amount, total.currency)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Patient Info */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <User className="h-5 w-5" />
                Patient
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <p className="font-medium text-lg">{claim.patient_name || 'Unknown'}</p>
                <p className="text-sm text-gray-500 font-mono">{claim.patient_identifier}</p>
                {claim.patient_gender && (
                  <p className="text-sm capitalize">{claim.patient_gender}</p>
                )}
                {claim.patient_birth_date && (
                  <p className="text-sm text-gray-500">DOB: {formatDate(claim.patient_birth_date)}</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Provider Info */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Building className="h-5 w-5" />
                Provider
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <p className="font-medium">{claim.provider_name || 'Unknown'}</p>
                <p className="text-sm text-gray-500 font-mono">{claim.provider_nphies_id}</p>
                {claim.provider_type && (
                  <Badge variant="outline" className="mt-1">Type: {extractCodeValue(claim.provider_type)}</Badge>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Insurer Info */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Insurer
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <p className="font-medium">{claim.insurer_name || 'Unknown'}</p>
                <p className="text-sm text-gray-500 font-mono">{claim.insurer_nphies_id}</p>
              </div>
            </CardContent>
          </Card>

          {/* NPHIES IDs */}
          {(claim.nphies_request_id || claim.nphies_response_id || claim.nphies_claim_id) && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Activity className="h-5 w-5" />
                  NPHIES IDs
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {claim.nphies_request_id && (
                  <div>
                    <Label className="text-gray-500 text-xs">Request ID</Label>
                    <p className="font-mono text-xs break-all">{claim.nphies_request_id}</p>
                  </div>
                )}
                {claim.nphies_response_id && (
                  <div>
                    <Label className="text-gray-500 text-xs">Response ID</Label>
                    <p className="font-mono text-xs break-all">{claim.nphies_response_id}</p>
                  </div>
                )}
                {claim.nphies_claim_id && (
                  <div>
                    <Label className="text-gray-500 text-xs">Claim ID</Label>
                    <p className="font-mono text-xs break-all">{claim.nphies_claim_id}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Eligibility Reference */}
          {claim.eligibility_ref && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <CheckCircle className="h-5 w-5" />
                  Eligibility
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <p className="font-mono text-sm">{claim.eligibility_ref}</p>
                  {claim.eligibility_offline_ref && (
                    <p className="text-sm text-gray-500">Offline: {claim.eligibility_offline_ref}</p>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* FHIR Bundle Dialog */}
      <Modal
        open={showBundleDialog}
        onClose={() => setShowBundleDialog(false)}
        title="FHIR Bundle"
        description="Request and Response FHIR Bundles"
        footer={
          <>
            <Button variant="outline" onClick={() => setShowBundleDialog(false)}>
              Close
            </Button>
            {bundle?.request && (
              <Button 
                variant="outline" 
                onClick={() => handleCopyToClipboard(bundle.request)}
                className="gap-2"
              >
                <Copy className="h-4 w-4" />
                {copiedToClipboard ? 'Copied!' : 'Copy Request'}
              </Button>
            )}
          </>
        }
      >
        <div className="space-y-6">
          {bundle?.request && (
            <div>
              <h3 className="font-medium mb-2 flex items-center gap-2">
                <Send className="h-4 w-4" />
                Request Bundle
              </h3>
              <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-auto max-h-80 text-xs">
                {JSON.stringify(bundle.request, null, 2)}
              </pre>
            </div>
          )}
          {bundle?.response && (
            <div>
              <h3 className="font-medium mb-2 flex items-center gap-2">
                <Receipt className="h-4 w-4" />
                Response Bundle
              </h3>
              <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-auto max-h-80 text-xs">
                {JSON.stringify(bundle.response, null, 2)}
              </pre>
            </div>
          )}
          {!bundle?.request && !bundle?.response && (
            <p className="text-center text-gray-500 py-8">No FHIR bundles available</p>
          )}
        </div>
      </Modal>
    </div>
  );
}
