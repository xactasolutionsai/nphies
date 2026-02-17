import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import api, { extractErrorMessage } from '@/services/api';
import {
  ArrowLeft, Download, RefreshCw, ShieldAlert, ChevronDown, ChevronRight,
  FileJson, Building2, User, Stethoscope, ClipboardList, Pill,
  Receipt, FileText, Shield, AlertCircle, Clock, CheckCircle,
  Calendar, DollarSign, MessageSquare, Activity, Code, Eye, Copy, X
} from 'lucide-react';

import AdvancedAuthCommunicationPanel from '@/components/advanced-auth/AdvancedAuthCommunicationPanel';

// ============================================================================
// HELPERS
// ============================================================================
const formatDate = (d) => d ? new Date(d).toLocaleDateString() : '-';
const formatDateTime = (d) => d ? new Date(d).toLocaleString() : '-';
const formatAmount = (val, currency = 'SAR') => val != null ? `${parseFloat(val).toFixed(2)} ${currency}` : '-';

const getAuthReasonDisplay = (r) => ({
  'referral': 'Referral',
  'medication-dispense': 'Medication Dispense',
  'new-born': 'New Born',
  'transfer': 'Transfer',
}[r] || r || '-');

const getClaimTypeDisplay = (t) => ({
  'institutional': 'Institutional',
  'oral': 'Oral/Dental',
  'pharmacy': 'Pharmacy',
  'professional': 'Professional',
  'vision': 'Vision',
}[t] || t || '-');

const getOutcomeBadgeClass = (outcome) => ({
  'approved': 'bg-green-100 text-green-800',
  'complete': 'bg-green-100 text-green-800',
  'partial': 'bg-yellow-100 text-yellow-800',
  'denied': 'bg-red-100 text-red-800',
  'refused': 'bg-red-100 text-red-800',
  'queued': 'bg-blue-100 text-blue-800',
  'error': 'bg-red-100 text-red-800',
}[outcome] || 'bg-gray-100 text-gray-800');

const categoryDisplayMap = {
  'vital-sign-systolic': 'Systolic BP',
  'vital-sign-diastolic': 'Diastolic BP',
  'vital-sign-height': 'Height',
  'vital-sign-weight': 'Weight',
  'pulse': 'Pulse',
  'temperature': 'Temperature',
  'oxygen-saturation': 'Oxygen Saturation',
  'respiratory-rate': 'Respiratory Rate',
  'admission-weight': 'Admission Weight',
  'chief-complaint': 'Chief Complaint',
  'patient-history': 'Patient History',
  'investigation-result': 'Investigation Result',
  'treatment-plan': 'Treatment Plan',
  'physical-examination': 'Physical Examination',
  'history-of-present-illness': 'History of Present Illness',
  'onset': 'Onset',
  'info': 'Information',
  'days-supply': 'Days Supply',
  'attachment': 'Attachment',
};

const adjCategoryDisplay = {
  'eligible': 'Eligible Amount',
  'copay': 'CoPay',
  'benefit': 'Benefit Amount',
  'tax': 'Tax',
  'approved-quantity': 'Approved Quantity',
};

// ============================================================================
// ATTACHMENT EXTRACTION FROM RAW BUNDLE
// ============================================================================

function extractAttachmentFromBundle(responseBundle, sequence) {
  if (!responseBundle) return null;

  // The response_bundle is the ClaimResponse itself (or could be wrapped in a Bundle)
  let claimResponse = responseBundle;
  if (responseBundle.resourceType === 'Bundle' && responseBundle.entry) {
    claimResponse = responseBundle.entry.find(e => e.resource?.resourceType === 'ClaimResponse')?.resource;
  }
  if (!claimResponse) return null;

  const extensions = claimResponse.extension || [];
  
  // Find the supportingInfo extension matching this sequence
  const infoExt = extensions.find(ext => {
    if (!ext.url?.includes('extension-supportingInfo') || ext.url?.includes('extension-supportingInfo-')) return false;
    const subExts = ext.extension || [];
    const seqExt = subExts.find(e => e.url?.includes('extension-supportingInfo-sequence'));
    return seqExt?.valuePositiveInt === sequence;
  });

  if (!infoExt) return null;

  const subExts = infoExt.extension || [];
  const attachmentExt = subExts.find(e => e.url?.includes('extension-supportingInfo-valueAttachment'));
  if (!attachmentExt?.valueAttachment?.data) return null;

  return {
    data: attachmentExt.valueAttachment.data,
    contentType: attachmentExt.valueAttachment.contentType || 'application/octet-stream',
    title: attachmentExt.valueAttachment.title || 'attachment',
    size: attachmentExt.valueAttachment.size || null,
  };
}

function handleDownloadAttachment(responseBundle, sequence, title) {
  const attachment = extractAttachmentFromBundle(responseBundle, sequence);
  if (!attachment) {
    alert('Attachment data not found in the response bundle.');
    return;
  }

  try {
    const byteCharacters = atob(attachment.data);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: attachment.contentType });

    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = title || attachment.title;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  } catch (err) {
    console.error('Error downloading attachment:', err);
    alert('Failed to download attachment.');
  }
}

function handleViewAttachment(responseBundle, sequence) {
  const attachment = extractAttachmentFromBundle(responseBundle, sequence);
  if (!attachment) {
    alert('Attachment data not found in the response bundle.');
    return;
  }

  try {
    const byteCharacters = atob(attachment.data);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: attachment.contentType });
    const url = window.URL.createObjectURL(blob);
    window.open(url, '_blank');
  } catch (err) {
    console.error('Error viewing attachment:', err);
    alert('Failed to open attachment.');
  }
}

function formatFileSize(bytes) {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ============================================================================
// BUNDLE DATA EXTRACTION
// ============================================================================

/**
 * Get the inner message Bundle from a poll response that contains ClaimResponse + Patient/Org/Coverage.
 * Poll response structure: entry[].resource can be Task, MessageHeader, or a Bundle (type message).
 * The Bundle with type "message" contains entry[] with ClaimResponse, Patient, Organization, Coverage.
 */
function getDisplayBundleFromPollResponse(pollResponseBundle) {
  if (!pollResponseBundle || pollResponseBundle.resourceType !== 'Bundle' || !pollResponseBundle.entry) return null;
  for (const entry of pollResponseBundle.entry) {
    const resource = entry?.resource;
    if (resource?.resourceType === 'Bundle' && resource.type === 'message' && resource.entry?.length) {
      const hasClaimResponse = resource.entry.some(e => e.resource?.resourceType === 'ClaimResponse');
      if (hasClaimResponse) return resource;
    }
  }
  return null;
}

/**
 * Extract Patient, Provider, Insurer, Coverage from a Bundle (with entry[]) or from poll_response_bundle.
 * When response_bundle is the raw ClaimResponse (no entry[]), use poll_response_bundle to get the inner message Bundle.
 */
function extractBundleEntities(responseBundle, pollResponseBundle = null) {
  let entries = [];

  const innerBundle = getDisplayBundleFromPollResponse(pollResponseBundle);
  if (innerBundle?.entry) {
    entries = innerBundle.entry.map(e => e.resource).filter(Boolean);
  } else if (responseBundle?.resourceType === 'Bundle' && responseBundle.entry) {
    entries = responseBundle.entry.map(e => e.resource).filter(Boolean);
  }

  if (entries.length === 0) return { patient: null, provider: null, insurer: null, coverage: null };

  // Patient
  const patientRes = entries.find(r => r.resourceType === 'Patient');
  let patient = null;
  if (patientRes) {
    const nameObj = patientRes.name?.[0];
    const idObj = patientRes.identifier?.[0];
    patient = {
      id: patientRes.id,
      name: nameObj?.text || [nameObj?.given?.[0], nameObj?.family].filter(Boolean).join(' ') || null,
      identifier: idObj?.value || null,
      identifierType: idObj?.type?.coding?.[0]?.code || null,
      gender: patientRes.gender || null,
      birthDate: patientRes.birthDate || null,
      phone: patientRes.telecom?.find(t => t.system === 'phone')?.value || null,
      maritalStatus: patientRes.maritalStatus?.coding?.[0]?.code || null,
      maritalStatusDisplay: patientRes.maritalStatus?.coding?.[0]?.display || null,
    };
  }

  // Provider Organization (type = prov)
  const providerOrg = entries.find(r =>
    r.resourceType === 'Organization' &&
    r.type?.some(t => t.coding?.some(c => c.code === 'prov'))
  );
  let provider = null;
  if (providerOrg) {
    provider = {
      id: providerOrg.id,
      name: providerOrg.name || null,
      nphiesId: providerOrg.identifier?.find(i => i.system?.includes('provider-license'))?.value || null,
    };
  }

  // Insurer Organization (type = ins)
  const insurerOrg = entries.find(r =>
    r.resourceType === 'Organization' &&
    r.type?.some(t => t.coding?.some(c => c.code === 'ins'))
  );
  let insurer = null;
  if (insurerOrg) {
    insurer = {
      id: insurerOrg.id,
      name: insurerOrg.name || null,
      nphiesId: insurerOrg.identifier?.find(i => i.system?.includes('payer-license'))?.value || null,
    };
  }

  // Coverage (identifier, class, relationship, type from bundle)
  const coverageRes = entries.find(r => r.resourceType === 'Coverage');
  let coverage = null;
  if (coverageRes) {
    const class0 = coverageRes.class?.[0];
    const id0 = coverageRes.identifier?.[0];
    coverage = {
      id: coverageRes.id,
      status: coverageRes.status,
      subscriberId: coverageRes.subscriberId,
      identifierValue: id0?.value || null,
      identifierSystem: id0?.system || null,
      relationship: coverageRes.relationship?.coding?.[0]?.code,
      relationshipDisplay: coverageRes.relationship?.coding?.[0]?.display || null,
      classValue: class0?.value ?? null,
      className: class0?.name ?? null,
      typeDisplay: coverageRes.type?.coding?.[0]?.display || null,
    };
  }

  return { patient, provider, insurer, coverage };
}

// ============================================================================
// TAB BUTTON COMPONENT
// ============================================================================

function TabButton({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
        active
          ? 'bg-white text-blue-600 shadow-sm'
          : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'
      }`}
    >
      {children}
    </button>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function AdvancedAuthorizationDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('details');
  const [showRawJson, setShowRawJson] = useState(false);

  useEffect(() => {
    loadData();
  }, [id]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.getAdvancedAuthorization(id);
      setData(response.data);
    } catch (err) {
      console.error('Error loading advanced authorization:', err);
      setError(extractErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async () => {
    try {
      const response = await api.downloadAdvancedAuthorizationJson(id);
      const blob = new Blob([JSON.stringify(response, null, 2)], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `advanced-auth-${data?.identifier_value || id}.json`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      alert(`Error: ${extractErrorMessage(err)}`);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <RefreshCw className="h-6 w-6 animate-spin text-gray-400" />
        <span className="ml-2 text-gray-500">Loading...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-red-500">
        <AlertCircle className="h-10 w-10 mb-3" />
        <p>{error}</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate('/advanced-authorizations')}>
          Back to List
        </Button>
      </div>
    );
  }

  if (!data) return null;

  const diagnoses = data.diagnoses || [];
  const supportingInfo = data.supporting_info || [];
  const addItems = data.add_items || [];
  const totals = data.totals || [];
  const processNotes = data.process_notes || [];
  const insurance = data.insurance || [];

  // Extract entities: use poll_response_bundle inner Bundle when available (has Patient/Org/Coverage)
  const { patient, provider, insurer, coverage } = extractBundleEntities(
    data.response_bundle,
    data.poll_response_bundle
  );

  // Request identifier & payee type from raw ClaimResponse (response_bundle)
  const claimResponse = data.response_bundle?.resourceType === 'ClaimResponse'
    ? data.response_bundle
    : null;
  const requestIdentifier = claimResponse?.request?.identifier?.value ?? null;
  const requestIdentifierSystem = claimResponse?.request?.identifier?.system ?? null;
  const payeeTypeDisplay = claimResponse?.payeeType?.coding?.[0]?.display
    || claimResponse?.payeeType?.coding?.[0]?.code
    || null;

  // Financial summary from totals
  const benefitTotal = totals.find(t => t.category === 'benefit');
  const eligibleTotal = totals.find(t => t.category === 'eligible');
  const copayTotal = totals.find(t => t.category === 'copay');
  const taxTotal = totals.find(t => t.category === 'tax');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate('/advanced-authorizations')}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Back
          </Button>
          <div>
            <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <ShieldAlert className="h-5 w-5" />
              Advanced Authorization
              <Badge className={getOutcomeBadgeClass(data.adjudication_outcome || data.outcome)}>
                {data.adjudication_outcome || data.outcome || data.status || '-'}
              </Badge>
            </h1>
            <p className="text-sm text-gray-500 font-mono">{data.identifier_value || `#${data.id}`}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={loadData}>
            <RefreshCw className="h-4 w-4 mr-1" /> Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={handleDownload}>
            <Download className="h-4 w-4 mr-1" /> Download JSON
          </Button>
        </div>
      </div>

      {/* Main Content - 2 column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Main Details with Tabs */}
        <div className="lg:col-span-2 space-y-6">
          {/* Tabs */}
          <div className="flex gap-2 bg-gray-100 p-1 rounded-lg w-fit flex-wrap">
            <TabButton active={activeTab === 'details'} onClick={() => setActiveTab('details')}>
              Details
            </TabButton>
            <TabButton active={activeTab === 'items'} onClick={() => setActiveTab('items')}>
              Items ({addItems.length})
            </TabButton>
            <TabButton active={activeTab === 'clinical'} onClick={() => setActiveTab('clinical')}>
              Clinical
            </TabButton>
            {data.response_bundle && (
              <TabButton active={activeTab === 'nphies'} onClick={() => setActiveTab('nphies')}>
                <Code className="h-4 w-4 mr-1 inline" />
                NPHIES Response
              </TabButton>
            )}
            <TabButton active={activeTab === 'communications'} onClick={() => setActiveTab('communications')}>
              <MessageSquare className="h-4 w-4 mr-1 inline" />
              Communications
            </TabButton>
          </div>

          {/* ============================================ */}
          {/* DETAILS TAB */}
          {/* ============================================ */}
          {activeTab === 'details' && (
            <div className="space-y-6">
              {/* Authorization Details */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <FileText className="h-4 w-4" /> Authorization Details
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <InfoItem label="Status">
                      <Badge className="bg-blue-100 text-blue-800">{data.status}</Badge>
                    </InfoItem>
                    <InfoItem label="Auth Reason">
                      <Badge variant="outline" className="font-semibold">
                        {getAuthReasonDisplay(data.auth_reason)}
                      </Badge>
                    </InfoItem>
                    <InfoItem label="Claim Type">
                      {getClaimTypeDisplay(data.claim_type)}
                    </InfoItem>
                    <InfoItem label="SubType">
                      {data.claim_subtype?.toUpperCase() || '-'}
                    </InfoItem>
                    <InfoItem label="Outcome">
                      <Badge className={getOutcomeBadgeClass(data.adjudication_outcome || data.outcome)}>
                        {data.adjudication_outcome || data.outcome || '-'}
                      </Badge>
                    </InfoItem>
                    <InfoItem label="Use">
                      {data.use_field || '-'}
                    </InfoItem>
                    <InfoItem label="PreAuth Ref">
                      <span className="font-mono text-xs">{data.pre_auth_ref || '-'}</span>
                    </InfoItem>
                    {requestIdentifier && (
                      <InfoItem label="Request Identifier">
                        <span className="font-mono text-xs" title={requestIdentifierSystem || ''}>
                          {requestIdentifier}
                        </span>
                      </InfoItem>
                    )}
                    {payeeTypeDisplay && (
                      <InfoItem label="Payee Type">
                        {payeeTypeDisplay}
                      </InfoItem>
                    )}
                    <InfoItem label="Created Date">
                      {formatDate(data.created_date)}
                    </InfoItem>
                    <InfoItem label="PreAuth Period">
                      {data.pre_auth_period_start
                        ? `${formatDate(data.pre_auth_period_start)} - ${formatDate(data.pre_auth_period_end)}`
                        : '-'}
                    </InfoItem>
                    <InfoItem label="Disposition">
                      {data.disposition || '-'}
                    </InfoItem>
                    <InfoItem label="Newborn">
                      {data.is_newborn ? 'Yes' : 'No'}
                    </InfoItem>
                    <InfoItem label="Received At">
                      {formatDateTime(data.received_at)}
                    </InfoItem>
                    {data.reissue_reason && (
                      <InfoItem label="Reissue Reason">
                        <Badge variant="outline">{data.reissue_reason}</Badge>
                      </InfoItem>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Provider & Referring Provider */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Building2 className="h-4 w-4" /> Service Provider
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm">{provider?.name || data.service_provider_reference || '-'}</p>
                    {provider?.nphiesId && (
                      <p className="text-xs text-gray-500 font-mono mt-1">NPHIES ID: {provider.nphiesId}</p>
                    )}
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Stethoscope className="h-4 w-4" /> Referring Provider
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm">{data.referring_provider_display || data.referring_provider_reference || '-'}</p>
                  </CardContent>
                </Card>
              </div>

              {/* Totals */}
              {totals.length > 0 && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Receipt className="h-4 w-4" /> Totals
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {totals.map((total, i) => (
                        <div key={i} className="bg-gray-50 rounded-lg p-3">
                          <div className="text-xs text-gray-500">
                            {adjCategoryDisplay[total.category] || total.category}
                          </div>
                          <div className="text-lg font-bold">
                            {formatAmount(total.amount, total.currency)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Process Notes */}
              {processNotes.length > 0 && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Process Notes ({processNotes.length})</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {processNotes.map((note, i) => (
                        <div key={i} className="bg-gray-50 rounded p-3">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge variant="outline" className="text-xs">Note {note.number || i + 1}</Badge>
                            {note.type && <span className="text-xs text-gray-400 capitalize">{note.type}</span>}
                          </div>
                          <p className="text-sm">{note.text || '-'}</p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Insurance */}
              {insurance.length > 0 && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Shield className="h-4 w-4" /> Insurance
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {insurance.map((ins, i) => (
                        <div key={i} className="bg-gray-50 rounded p-3 text-sm">
                          <div className="grid grid-cols-3 gap-3">
                            <InfoItem label="Sequence">{ins.sequence}</InfoItem>
                            <InfoItem label="Focal">{ins.focal ? 'Yes' : 'No'}</InfoItem>
                            <InfoItem label="Coverage">
                              <span className="font-mono text-xs">{ins.coverage?.reference || '-'}</span>
                            </InfoItem>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Transfer Info */}
              {(data.transfer_auth_number || data.transfer_auth_provider) && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Transfer Authorization</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      <InfoItem label="Transfer Auth Number">
                        <span className="font-mono text-xs">{data.transfer_auth_number || '-'}</span>
                      </InfoItem>
                      <InfoItem label="Transfer Provider">
                        <span className="font-mono text-xs">{data.transfer_auth_provider || '-'}</span>
                      </InfoItem>
                      <InfoItem label="Transfer Period">
                        {data.transfer_auth_period_start
                          ? `${formatDate(data.transfer_auth_period_start)} - ${formatDate(data.transfer_auth_period_end)}`
                          : '-'}
                      </InfoItem>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Prescription */}
              {data.prescription_reference && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Pill className="h-4 w-4" /> Prescription
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <InfoItem label="Reference">{data.prescription_reference?.reference || '-'}</InfoItem>
                      <InfoItem label="Identifier">
                        {data.prescription_reference?.value
                          ? `${data.prescription_reference.system || ''} / ${data.prescription_reference.value}`
                          : '-'}
                      </InfoItem>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {/* ============================================ */}
          {/* ITEMS TAB */}
          {/* ============================================ */}
          {activeTab === 'items' && (
            <div className="space-y-4">
              {addItems.length === 0 ? (
                <Card>
                  <CardContent className="py-10 text-center text-gray-500">
                    No items found in this authorization.
                  </CardContent>
                </Card>
              ) : (
                addItems.map((item, i) => {
                  const rawAddItem = claimResponse?.addItem?.[i];
                  const productCodings = rawAddItem?.productOrService?.coding || (item.productOrService?.code ? [{ code: item.productOrService.code, system: item.productOrService.system, display: item.productOrService.display }] : []);
                  return (
                  <Card key={i}>
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-3 flex-wrap">
                            <Badge variant="outline">Item {item.sequence || i + 1}</Badge>
                            <span className="font-medium text-sm">
                              {item.productOrService?.display || item.productOrService?.code || '-'}
                            </span>
                            {productCodings.length > 0 && (
                              <span className="text-xs text-gray-400 font-mono">
                                {productCodings.map(c => c.code).filter(Boolean).join(', ')}
                              </span>
                            )}
                          </div>
                          {productCodings.length > 1 && (
                            <div className="flex flex-wrap gap-2 mt-1">
                              {productCodings.map((coding, k) => (
                                <span key={k} className="text-xs bg-gray-100 rounded px-2 py-0.5 font-mono" title={coding.system}>
                                  {coding.display || coding.code}
                                  {coding.system && !coding.system.includes('nphies.sa') && (
                                    <span className="text-gray-400 ml-1">({coding.code})</span>
                                  )}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                        <Badge className={getOutcomeBadgeClass(item.adjudicationOutcome)}>
                          {item.adjudicationOutcome || '-'}
                        </Badge>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                        <InfoItem label="Quantity">{item.quantity || '-'}</InfoItem>
                        <InfoItem label="Maternity">{item.maternity ? 'Yes' : 'No'}</InfoItem>
                        <InfoItem label="Package">{item.isPackage ? 'Yes' : 'No'}</InfoItem>
                        {item.bodySite && (
                          <InfoItem label="Body Site">
                            {item.bodySite.display || item.bodySite.code || '-'}
                          </InfoItem>
                        )}
                        {item.subSite && (
                          <InfoItem label="Sub Site">
                            {item.subSite.display || item.subSite.code || '-'}
                          </InfoItem>
                        )}
                      </div>

                      {/* Adjudication */}
                      {item.adjudication?.length > 0 && (
                        <div>
                          <h4 className="text-xs font-semibold text-gray-500 mb-2">Adjudication</h4>
                          <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                            {item.adjudication.map((adj, j) => (
                              <div key={j} className="bg-gray-50 rounded p-2">
                                <div className="text-xs text-gray-500">
                                  {adjCategoryDisplay[adj.category] || adj.category}
                                </div>
                                <div className="font-semibold text-sm">
                                  {adj.amount != null
                                    ? formatAmount(adj.amount, adj.currency)
                                    : adj.value != null
                                      ? adj.value
                                      : '-'}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Sub-details */}
                      {item.details?.length > 0 && (
                        <div className="ml-4 border-l-2 pl-4 space-y-2">
                          <h4 className="text-xs font-semibold text-gray-500">Detail Items</h4>
                          {item.details.map((detail, j) => (
                            <div key={j} className="bg-gray-50 rounded p-3">
                              <div className="flex items-center gap-2 mb-2">
                                <Badge variant="outline" className="text-xs">Detail {detail.sequence || j + 1}</Badge>
                                <span className="text-sm">{detail.productOrService?.display || detail.productOrService?.code}</span>
                              </div>
                              {detail.adjudication?.length > 0 && (
                                <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                                  {detail.adjudication.map((adj, k) => (
                                    <div key={k} className="text-xs">
                                      <span className="text-gray-500">{adjCategoryDisplay[adj.category] || adj.category}: </span>
                                      <span className="font-medium">
                                        {adj.amount != null ? formatAmount(adj.amount, adj.currency) : adj.value ?? '-'}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                  );
                })
              )}
            </div>
          )}

          {/* ============================================ */}
          {/* CLINICAL TAB */}
          {/* ============================================ */}
          {activeTab === 'clinical' && (
            <div className="space-y-6">
              {/* Diagnoses */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <ClipboardList className="h-4 w-4" /> Diagnoses ({diagnoses.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  {diagnoses.length === 0 ? (
                    <div className="py-8 text-center text-gray-500 px-4">No diagnoses recorded</div>
                  ) : (
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-gray-50">
                          <th className="px-4 py-2 text-left font-medium text-gray-500">#</th>
                          <th className="px-4 py-2 text-left font-medium text-gray-500">Code</th>
                          <th className="px-4 py-2 text-left font-medium text-gray-500">Display</th>
                          <th className="px-4 py-2 text-left font-medium text-gray-500">Type</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {diagnoses.map((dx, i) => (
                          <tr key={i} className="hover:bg-gray-50">
                            <td className="px-4 py-2">{dx.sequence || i + 1}</td>
                            <td className="px-4 py-2 font-mono text-xs">{dx.code || '-'}</td>
                            <td className="px-4 py-2">{dx.display || '-'}</td>
                            <td className="px-4 py-2">
                              <Badge variant="outline" className="text-xs capitalize">{dx.type || '-'}</Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </CardContent>
              </Card>

              {/* Supporting Info */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <FileText className="h-4 w-4" /> Supporting Information ({supportingInfo.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  {supportingInfo.length === 0 ? (
                    <div className="py-8 text-center text-gray-500 px-4">No supporting information</div>
                  ) : (
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-gray-50">
                          <th className="px-4 py-2 text-left font-medium text-gray-500">#</th>
                          <th className="px-4 py-2 text-left font-medium text-gray-500">Category</th>
                          <th className="px-4 py-2 text-left font-medium text-gray-500">Value</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {supportingInfo.map((info, i) => (
                          <tr key={i} className="hover:bg-gray-50">
                            <td className="px-4 py-2">{info.sequence || i + 1}</td>
                            <td className="px-4 py-2">
                              {categoryDisplayMap[info.category] || info.category || '-'}
                            </td>
                            <td className="px-4 py-2">
                              <SupportingInfoValue info={info} responseBundle={data.response_bundle} />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {/* ============================================ */}
          {/* NPHIES RESPONSE TAB */}
          {/* ============================================ */}
          {activeTab === 'nphies' && data.response_bundle && (
            <div className="space-y-6">
              {/* Bundle Summary */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Code className="h-4 w-4" /> NPHIES Response Bundle
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <NphiesResponseSummary responseBundle={data.response_bundle} />
                </CardContent>
              </Card>

              {/* Raw JSON */}
              <Card>
                <CardHeader className="pb-3 cursor-pointer" onClick={() => setShowRawJson(!showRawJson)}>
                  <CardTitle className="text-base flex items-center gap-2">
                    <FileJson className="h-4 w-4" />
                    Raw FHIR ClaimResponse
                    {showRawJson ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  </CardTitle>
                </CardHeader>
                {showRawJson && (
                  <CardContent className="p-0">
                    <pre className="bg-gray-900 text-green-400 p-4 rounded-b-lg overflow-auto max-h-[600px] text-xs">
                      {JSON.stringify(data.response_bundle, null, 2)}
                    </pre>
                  </CardContent>
                )}
              </Card>
            </div>
          )}

          {/* ============================================ */}
          {/* COMMUNICATIONS TAB */}
          {/* ============================================ */}
          {activeTab === 'communications' && (
            <AdvancedAuthCommunicationPanel
              advAuthId={parseInt(id)}
              advAuthStatus={data.adjudication_outcome || data.status}
              items={addItems}
              onStatusUpdate={loadData}
            />
          )}
        </div>

        {/* ============================================ */}
        {/* RIGHT SIDEBAR */}
        {/* ============================================ */}
        <div className="space-y-4">
          {/* Financial Summary */}
          {totals.length > 0 && (
            <Card className="border-green-200">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2 text-green-700">
                  <DollarSign className="h-4 w-4" /> Financial Summary
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {benefitTotal && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Benefit</span>
                    <span className="font-bold text-green-700">{formatAmount(benefitTotal.amount, benefitTotal.currency)}</span>
                  </div>
                )}
                {eligibleTotal && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Eligible</span>
                    <span className="font-semibold">{formatAmount(eligibleTotal.amount, eligibleTotal.currency)}</span>
                  </div>
                )}
                {copayTotal && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">CoPay</span>
                    <span className="font-semibold text-orange-600">{formatAmount(copayTotal.amount, copayTotal.currency)}</span>
                  </div>
                )}
                {taxTotal && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Tax</span>
                    <span className="font-semibold">{formatAmount(taxTotal.amount, taxTotal.currency)}</span>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Patient Card */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <User className="h-4 w-4" /> Patient
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5 text-sm">
              {patient ? (
                <>
                  {patient.name && <div><span className="text-gray-500">Name:</span> {patient.name}</div>}
                  {patient.identifier && <div><span className="text-gray-500">ID:</span> <span className="font-mono text-xs">{patient.identifier}</span></div>}
                  {patient.identifierType && <div><span className="text-gray-500">ID Type:</span> <span className="font-mono text-xs">{patient.identifierType}</span></div>}
                  {patient.gender && <div><span className="text-gray-500">Gender:</span> <span className="capitalize">{patient.gender}</span></div>}
                  {patient.birthDate && <div><span className="text-gray-500">DOB:</span> {formatDate(patient.birthDate)}</div>}
                  {(patient.maritalStatusDisplay || patient.maritalStatus) && <div><span className="text-gray-500">Marital:</span> {patient.maritalStatusDisplay || patient.maritalStatus}</div>}
                  {patient.phone && <div><span className="text-gray-500">Phone:</span> {patient.phone}</div>}
                </>
              ) : (
                <div className="text-gray-400 text-xs">
                  <span className="font-mono">{data.patient_reference || 'No patient data'}</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Provider Card */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Building2 className="h-4 w-4" /> Provider
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5 text-sm">
              {provider ? (
                <>
                  {provider.name && <div><span className="text-gray-500">Name:</span> {provider.name}</div>}
                  {provider.nphiesId && <div><span className="text-gray-500">NPHIES ID:</span> <span className="font-mono text-xs">{provider.nphiesId}</span></div>}
                </>
              ) : (
                <div className="text-gray-400 text-xs">
                  <span className="font-mono">{data.service_provider_reference || 'No provider data'}</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Insurer Card */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Shield className="h-4 w-4" /> Insurer
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5 text-sm">
              {insurer ? (
                <>
                  {insurer.name && <div><span className="text-gray-500">Name:</span> {insurer.name}</div>}
                  {insurer.nphiesId && <div><span className="text-gray-500">NPHIES ID:</span> <span className="font-mono text-xs">{insurer.nphiesId}</span></div>}
                </>
              ) : (
                <div className="text-gray-400 text-xs">
                  <span className="font-mono">{data.insurer_reference || 'No insurer data'}</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Coverage Card */}
          {coverage && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Shield className="h-4 w-4" /> Coverage
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1.5 text-sm">
                {coverage.status && <div><span className="text-gray-500">Status:</span> {coverage.status}</div>}
                {(coverage.identifierValue || coverage.subscriberId) && (
                  <div><span className="text-gray-500">Identifier:</span> <span className="font-mono text-xs break-all">{coverage.identifierValue || coverage.subscriberId}</span></div>
                )}
                {coverage.identifierSystem && <div><span className="text-gray-500">ID System:</span> <span className="font-mono text-xs break-all">{coverage.identifierSystem}</span></div>}
                {(coverage.relationshipDisplay || coverage.relationship) && <div><span className="text-gray-500">Relationship:</span> {coverage.relationshipDisplay || coverage.relationship}</div>}
                {(coverage.classValue || coverage.className) && <div><span className="text-gray-500">Class:</span> {coverage.className ? `${coverage.className} (${coverage.classValue})` : coverage.classValue}</div>}
                {coverage.typeDisplay && <div><span className="text-gray-500">Type:</span> {coverage.typeDisplay}</div>}
              </CardContent>
            </Card>
          )}

          {/* References Card */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <FileText className="h-4 w-4" /> References
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5 text-sm">
              <div><span className="text-gray-500">Identifier:</span> <span className="font-mono text-xs">{data.identifier_value || '-'}</span></div>
              <div><span className="text-gray-500">System:</span> <span className="font-mono text-xs break-all">{data.identifier_system || '-'}</span></div>
              <div><span className="text-gray-500">PreAuth Ref:</span> <span className="font-mono text-xs">{data.pre_auth_ref || '-'}</span></div>
            </CardContent>
          </Card>

          {/* Validity Card */}
          {(data.pre_auth_period_start || data.pre_auth_period_end) && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Calendar className="h-4 w-4" /> Validity Period
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1.5 text-sm">
                <div><span className="text-gray-500">Start:</span> {formatDateTime(data.pre_auth_period_start)}</div>
                <div><span className="text-gray-500">End:</span> {formatDateTime(data.pre_auth_period_end)}</div>
              </CardContent>
            </Card>
          )}

          {/* Timeline Card */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Clock className="h-4 w-4" /> Timeline
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {data.created_date && (
                  <TimelineItem icon={<Calendar className="h-3 w-3" />} label="Created" date={data.created_date} />
                )}
                {data.received_at && (
                  <TimelineItem icon={<CheckCircle className="h-3 w-3" />} label="Received" date={data.received_at} />
                )}
                {data.updated_at && (
                  <TimelineItem icon={<Activity className="h-3 w-3" />} label="Updated" date={data.updated_at} />
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

function InfoItem({ label, children }) {
  return (
    <div>
      <div className="text-xs font-medium text-gray-500 mb-0.5">{label}</div>
      <div className="text-sm">{children}</div>
    </div>
  );
}

function TimelineItem({ icon, label, date }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center justify-center w-6 h-6 rounded-full bg-gray-100 text-gray-500 flex-shrink-0">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-gray-500">{label}</p>
        <p className="text-xs font-medium">{formatDateTime(date)}</p>
      </div>
    </div>
  );
}

function SupportingInfoValue({ info, responseBundle }) {
  if (!info) return <span>-</span>;

  switch (info.valueType) {
    case 'string':
      return <span>{info.value}</span>;
    case 'quantity':
      return (
        <span>
          {info.value} <span className="text-gray-400">{info.unit}</span>
        </span>
      );
    case 'code':
      return (
        <span>
          {info.codeDisplay || info.codeText || info.code || '-'}
          {info.code && <span className="text-gray-400 ml-1 text-xs font-mono">({info.code})</span>}
        </span>
      );
    case 'attachment':
      return (
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-blue-500 flex-shrink-0" />
            <span className="font-medium">{info.title || 'Attachment'}</span>
            {info.contentType && (
              <Badge variant="outline" className="text-xs">{info.contentType}</Badge>
            )}
          </div>
          {info.hasData && (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                onClick={() => handleViewAttachment(responseBundle, info.sequence)}
              >
                <Eye className="h-3 w-3 mr-1" />
                View
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                onClick={() => handleDownloadAttachment(responseBundle, info.sequence, info.title)}
              >
                <Download className="h-3 w-3 mr-1" />
                Download
              </Button>
              {info.size && (
                <span className="text-xs text-gray-400">{formatFileSize(info.size)}</span>
              )}
            </div>
          )}
        </div>
      );
    default:
      if (info.reason) {
        return <span className="text-orange-600">{info.reasonDisplay || info.reason}</span>;
      }
      return <span>-</span>;
  }
}

function NphiesResponseSummary({ responseBundle }) {
  if (!responseBundle) return null;

  // Extract ClaimResponse
  let claimResponse = responseBundle;
  if (responseBundle.resourceType === 'Bundle' && responseBundle.entry) {
    claimResponse = responseBundle.entry.find(e => e.resource?.resourceType === 'ClaimResponse')?.resource || responseBundle;
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
        <InfoItem label="Resource Type">{claimResponse.resourceType || '-'}</InfoItem>
        <InfoItem label="ID"><span className="font-mono text-xs">{claimResponse.id || '-'}</span></InfoItem>
        <InfoItem label="Status">{claimResponse.status || '-'}</InfoItem>
        <InfoItem label="Outcome">
          <Badge className={getOutcomeBadgeClass(claimResponse.outcome)}>
            {claimResponse.outcome || '-'}
          </Badge>
        </InfoItem>
        <InfoItem label="Disposition">{claimResponse.disposition || '-'}</InfoItem>
        <InfoItem label="PreAuth Ref">{claimResponse.preAuthRef || '-'}</InfoItem>
        <InfoItem label="Created">{formatDate(claimResponse.created)}</InfoItem>
        <InfoItem label="Use">{claimResponse.use || '-'}</InfoItem>
      </div>

      {/* Profile */}
      {claimResponse.meta?.profile && (
        <div>
          <p className="text-xs font-medium text-gray-500 mb-1">Profile</p>
          {claimResponse.meta.profile.map((p, i) => (
            <p key={i} className="text-xs font-mono text-gray-600 break-all">{p}</p>
          ))}
        </div>
      )}

      {/* Extensions */}
      {claimResponse.extension?.length > 0 && (
        <div>
          <p className="text-xs font-medium text-gray-500 mb-1">Extensions</p>
          <div className="space-y-1">
            {claimResponse.extension.map((ext, i) => {
              const urlParts = ext.url?.split('/');
              const shortName = urlParts?.[urlParts.length - 1] || ext.url;
              let value = ext.valueCodeableConcept?.coding?.[0]?.code ||
                          ext.valueBoolean?.toString() ||
                          ext.valueString ||
                          ext.valueCode ||
                          JSON.stringify(ext.value || '');
              return (
                <div key={i} className="flex items-center gap-2 text-xs">
                  <span className="text-gray-500">{shortName}:</span>
                  <span className="font-medium">{value}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
