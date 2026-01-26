import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import api from '@/services/api';
import { 
  Shield, CheckCircle, XCircle, AlertCircle, Info, FileText, 
  ChevronDown, ChevronUp, ArrowLeft, RefreshCw, Copy, User, 
  Building, CreditCard, Calendar, Clock, Phone, Heart, Briefcase,
  Users, MapPin, DollarSign, Network, Hash
} from 'lucide-react';

// Status display helper
const getStatusDisplay = (status) => {
  const statuses = {
    eligible: 'Eligible',
    not_eligible: 'Not Eligible',
    pending: 'Pending',
    error: 'Error'
  };
  return statuses[status] || status;
};

// Status badge color helper
const getStatusBadgeClass = (status) => {
  switch (status) {
    case 'eligible':
      return 'bg-green-100 text-green-800 border-green-300';
    case 'not_eligible':
      return 'bg-red-100 text-red-800 border-red-300';
    case 'pending':
      return 'bg-yellow-100 text-yellow-800 border-yellow-300';
    case 'error':
      return 'bg-red-100 text-red-800 border-red-300';
    default:
      return 'bg-gray-100 text-gray-800 border-gray-300';
  }
};

// Get Site Eligibility display text
const getSiteEligibilityDisplay = (code) => {
  const displays = {
    'eligible': 'Patient is eligible for coverage at this site',
    'not-eligible': 'Patient is not eligible for coverage at this site',
    'not-in-network': 'Provider is not in the patient\'s network',
    'plan-expired': 'Patient\'s plan has expired',
    'coverage-suspended': 'Patient\'s coverage is suspended',
    'benefit-exhausted': 'Patient\'s benefits have been exhausted'
  };
  return displays[code] || code;
};

// Get Site Eligibility badge color
const getSiteEligibilityColor = (code) => {
  if (code === 'eligible') return 'bg-green-100 text-green-800 border-green-300';
  return 'bg-red-100 text-red-800 border-red-300';
};

// Format date helper
const formatDate = (dateString) => {
  if (!dateString) return '-';
  return new Date(dateString).toLocaleDateString();
};

const formatDateTime = (dateString) => {
  if (!dateString) return '-';
  return new Date(dateString).toLocaleString();
};

// Get gender display text
const getGenderDisplay = (gender) => {
  const genders = {
    'male': 'Male',
    'female': 'Female',
    'other': 'Other',
    'unknown': 'Unknown'
  };
  return genders[gender] || genders[gender?.toLowerCase()] || gender || 'N/A';
};

// Get marital status display
const getMaritalStatusDisplay = (code) => {
  const statuses = {
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
  return statuses[code] || code || 'N/A';
};

// Get copay type display
const getCopayTypeDisplay = (code) => {
  const types = {
    'gpvisit': 'GP Visit',
    'spvisit': 'Specialist Visit',
    'emergency': 'Emergency',
    'inpatient': 'Inpatient',
    'outpatient': 'Outpatient',
    'pharmacy': 'Pharmacy',
    'vision': 'Vision',
    'dental': 'Dental',
    'copaypct': 'Co-pay Percentage',
    'copay': 'Co-pay',
    'deductible': 'Deductible',
    'maxoutofpocket': 'Max Out of Pocket'
  };
  return types[code?.toLowerCase()] || code || 'Unknown';
};

// Get coverage type display
const getCoverageTypeDisplay = (code) => {
  const types = {
    'EHCPOL': 'Extended Healthcare',
    'PUBLICPOL': 'Public Healthcare',
    'DENTPRG': 'Dental Program',
    'DISEASEPRG': 'Disease Management Program',
    'CANPRG': 'Cancer Program',
    'MENTPRG': 'Mental Health Program',
    'SUBPRG': 'Substance Abuse Program',
    'SUBSIDIZ': 'Subsidized Health Program',
    'WCBPOL': 'Workers Compensation',
    'AUTOPOL': 'Automobile',
    'COL': 'Collision Coverage',
    'UNINSMOT': 'Uninsured Motorist',
    'PAY': 'Pay'
  };
  return types[code] || code || 'N/A';
};

// Get relationship display
const getRelationshipDisplay = (code) => {
  const relationships = {
    'self': 'Self',
    'spouse': 'Spouse',
    'child': 'Child',
    'parent': 'Parent',
    'common': 'Common Law Spouse',
    'other': 'Other',
    'injured': 'Injured Party'
  };
  return relationships[code?.toLowerCase()] || code || 'N/A';
};

// Helper to extract data from raw FHIR response
const extractFromFhirBundle = (bundle) => {
  if (!bundle || !bundle.entry) return {};
  
  const result = {
    patient: null, // Primary patient (newborn for newborn cases)
    motherPatient: null, // Mother patient (for newborn cases)
    patients: [], // All patient resources
    coverage: null, // Primary coverage (first one for backward compatibility)
    coverages: [], // All coverage resources (policies)
    insurer: null,
    eligibilityResponse: null,
    eligibilityResponseFullUrl: null,
    messageHeader: null
  };
  
  for (const entry of bundle.entry) {
    const resource = entry.resource;
    if (!resource) continue;
    
    switch (resource.resourceType) {
      case 'Patient':
        // Store all patients
        result.patients.push(resource);
        // For now, use the last patient as primary (will be determined by Coverage references)
        result.patient = resource;
        break;
      case 'Coverage':
        // Store all coverages/policies
        result.coverages.push(resource);
        // Keep first coverage as primary for backward compatibility
        if (!result.coverage) {
          result.coverage = resource;
        }
        break;
      case 'Organization':
        // Check if it's an insurer
        if (resource.meta?.profile?.some(p => p.includes('insurer'))) {
          result.insurer = resource;
        } else if (!result.insurer) {
          result.insurer = resource;
        }
        break;
      case 'CoverageEligibilityResponse':
        result.eligibilityResponse = resource;
        result.eligibilityResponseFullUrl = entry.fullUrl; // Capture fullUrl for reference
        break;
      case 'MessageHeader':
        result.messageHeader = resource;
        break;
    }
  }
  
  // For newborn cases: Identify newborn vs mother based on Coverage references
  // Coverage.beneficiary = newborn, Coverage.subscriber = mother
  if (result.coverage && result.patients.length >= 2) {
    const beneficiaryRef = result.coverage.beneficiary?.reference;
    const subscriberRef = result.coverage.subscriber?.reference;
    
    if (beneficiaryRef && subscriberRef) {
      // Extract patient IDs from references (format: "Patient/patient-xxx" or full URL)
      const beneficiaryId = beneficiaryRef.split('/').pop();
      const subscriberId = subscriberRef.split('/').pop();
      
      // Find patients by ID match
      const beneficiaryPatient = result.patients.find(p => p.id === beneficiaryId || beneficiaryRef.includes(p.id));
      const subscriberPatient = result.patients.find(p => p.id === subscriberId || subscriberRef.includes(p.id));
      
      if (beneficiaryPatient && subscriberPatient) {
        // Newborn is beneficiary, mother is subscriber
        result.patient = beneficiaryPatient; // Newborn (primary patient)
        result.motherPatient = subscriberPatient; // Mother
      }
    }
  }
  
  return result;
};

export default function NphiesEligibilityDetails() {
  const navigate = useNavigate();
  const { id } = useParams();
  
  const [loading, setLoading] = useState(true);
  const [record, setRecord] = useState(null);
  const [showRawRequest, setShowRawRequest] = useState(false);
  const [showRawResponse, setShowRawResponse] = useState(false);
  const [copiedToClipboard, setCopiedToClipboard] = useState(false);

  useEffect(() => {
    loadEligibilityRecord();
  }, [id]);

  const loadEligibilityRecord = async () => {
    try {
      setLoading(true);
      const response = await api.getNphiesEligibilityDetails(id);
      setRecord(response.data || response);
    } catch (error) {
      console.error('Error loading eligibility record:', error);
      alert('Error loading eligibility record');
      navigate('/nphies-eligibility');
    } finally {
      setLoading(false);
    }
  };

  // Copy JSON to clipboard
  const handleCopyToClipboard = async (jsonData, label) => {
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

  // Parse benefits and errors from JSON if needed - must be before any early returns
  const benefits = useMemo(() => {
    if (!record) return [];
    return typeof record.benefits === 'string' ? JSON.parse(record.benefits || '[]') : (record.benefits || []);
  }, [record]);
  
  const errors = useMemo(() => {
    if (!record) return [];
    return typeof record.error_codes === 'string' ? JSON.parse(record.error_codes || '[]') : (record.error_codes || record.errors || []);
  }, [record]);
  
  const rawRequest = useMemo(() => {
    if (!record) return {};
    return typeof record.raw_request === 'string' ? JSON.parse(record.raw_request || '{}') : (record.raw_request || record.raw?.request || {});
  }, [record]);
  
  const rawResponse = useMemo(() => {
    if (!record) return {};
    return typeof record.raw_response === 'string' ? JSON.parse(record.raw_response || '{}') : (record.raw_response || record.raw?.response || {});
  }, [record]);

  // Extract detailed data from FHIR response bundle
  const fhirData = useMemo(() => extractFromFhirBundle(rawResponse), [rawResponse]);
  
  // Patient details from FHIR (primary patient - newborn for newborn cases)
  const patientData = fhirData.patient || {};
  
  // Mother patient details (for newborn cases)
  const motherPatientData = fhirData.motherPatient || {};
  const patientName = useMemo(() => {
    return patientData.name?.[0]?.text || 
      [patientData.name?.[0]?.given?.join(' '), patientData.name?.[0]?.family].filter(Boolean).join(' ') ||
      record?.patient_name || record?.patient?.name;
  }, [patientData, record]);
  
  const patientGender = patientData.gender || record?.patient?.gender;
  const patientBirthDate = patientData.birthDate || record?.patient?.birthDate;
  const patientPhone = patientData.telecom?.find(t => t.system === 'phone')?.value || record?.patient?.phone;
  const patientEmail = patientData.telecom?.find(t => t.system === 'email')?.value || record?.patient?.email;
  const patientMaritalStatus = patientData.maritalStatus?.coding?.[0]?.code || record?.patient?.maritalStatus;
  const patientOccupation = patientData.extension?.find(e => e.url?.includes('occupation'))?.valueCodeableConcept?.coding?.[0]?.code || record?.patient?.occupation;
  const patientIdentifier = patientData.identifier?.[0] || {};
  const patientIdentifierType = patientIdentifier.type?.coding?.[0]?.display || patientIdentifier.type?.coding?.[0]?.code;
  const patientIdentifierValue = patientIdentifier.value || record?.patient_identifier || record?.patient?.identifier;
  const patientIdentifierCountry = patientIdentifier.extension?.find(e => e.url?.includes('country'))?.valueCodeableConcept?.coding?.[0]?.display;
  
  // Coverage details from FHIR - All coverages/policies
  const allCoverages = fhirData.coverages || [];
  const coverageData = fhirData.coverage || {};
  const coverageType = coverageData.type?.coding?.[0]?.code || record?.coverage_type || record?.coverage?.type;
  const coverageTypeDisplay = coverageData.type?.coding?.[0]?.display || getCoverageTypeDisplay(coverageType);
  const coverageMemberId = coverageData.identifier?.find(i => i.system?.includes('memberid'))?.value || 
    coverageData.identifier?.[0]?.value || record?.member_id || record?.coverage?.memberId;
  const coveragePeriod = coverageData.period || record?.coverage?.period;
  const coverageNetwork = coverageData.network || record?.coverage?.network;
  const coverageDependent = coverageData.dependent || record?.coverage?.dependent;
  const coverageRelationship = coverageData.relationship?.coding?.[0]?.code || record?.coverage?.relationship;
  const coverageSubrogation = coverageData.subrogation;
  const coverageClasses = coverageData.class || [];
  const coverageStatus = coverageData.status || record?.coverage?.status;
  
  // Cost to Beneficiary (Copays) from FHIR - combine from all coverages
  const costToBeneficiary = coverageData.costToBeneficiary || [];
  
  // Insurer details from FHIR
  const insurerData = fhirData.insurer || {};
  const insurerName = insurerData.name || record?.insurer_name || record?.insurer?.name;
  const insurerType = insurerData.type?.[0]?.coding?.[0]?.display || insurerData.type?.[0]?.coding?.[0]?.code;
  const insurerAddress = insurerData.address?.[0];
  const insurerNphiesId = insurerData.identifier?.find(i => i.system?.includes('nphies') || i.system?.includes('payer'))?.value ||
    record?.insurer_nphies_id || record?.insurer?.nphiesId;
  
  // Eligibility Response details
  const eligibilityResponse = fhirData.eligibilityResponse || {};
  const disposition = eligibilityResponse.disposition || record?.disposition;
  const servicedPeriod = eligibilityResponse.servicedPeriod || record?.serviced_period;
  
  // Extract inforce status from insurance[0].inforce (from FHIR response)
  const inforceFromResponse = eligibilityResponse.insurance?.[0]?.inforce;
  
  // Extract Eligibility Reference ID (needed for Prior Authorization)
  // This is the CoverageEligibilityResponse.id (e.g., "76999")
  const eligibilityRefId = eligibilityResponse.id || record?.eligibility_ref || record?.eligibility_response_id;
  
  // Extract fullUrl from bundle entry (contains full reference URL)
  const eligibilityResponseFullUrl = fhirData.eligibilityResponseFullUrl;
  
  // Extract Eligibility Response Identifier (alternative identifier)
  const eligibilityResponseIdentifier = eligibilityResponse.identifier?.[0];
  const eligibilityResponseIdentifierValue = eligibilityResponseIdentifier?.value;
  const eligibilityResponseIdentifierSystem = eligibilityResponseIdentifier?.system;
  
  // Site Eligibility from response extension
  const responseSiteEligibility = eligibilityResponse.extension?.find(
    e => e.url?.includes('siteEligibility')
  )?.valueCodeableConcept?.coding?.[0];
  
  // Insurance-level site eligibility
  const insuranceSiteEligibility = eligibilityResponse.insurance?.[0]?.extension?.find(
    e => e.url?.includes('siteEligibility')
  )?.valueCodeableConcept?.coding?.[0];
  
  // Use the most specific site eligibility
  const siteEligibility = responseSiteEligibility || insuranceSiteEligibility || record?.siteEligibility;
  
  // Message Header details
  const messageHeader = fhirData.messageHeader || {};
  const messageResponseCode = messageHeader.response?.code;
  const messageResponseId = messageHeader.response?.identifier;
  const messageSender = messageHeader.sender?.identifier?.value;
  const messageDestination = messageHeader.destination?.[0]?.receiver?.identifier?.value;
  const messageEventCode = messageHeader.eventCoding?.code;
  
  // Patient KSA Gender extension
  const patientKsaGender = patientData._gender?.extension?.find(
    e => e.url?.includes('ksa-administrative-gender')
  )?.valueCodeableConcept?.coding?.[0]?.code;
  
  // Coverage references
  const coverageSubscriber = coverageData.subscriber?.reference;
  const coverageBeneficiary = coverageData.beneficiary?.reference;
  const coveragePolicyHolder = coverageData.policyHolder?.reference;

  // Early returns AFTER all hooks
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

  if (!record) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-gray-500">
        <AlertCircle className="h-16 w-16 mb-4 opacity-50" />
        <p className="text-lg font-medium">Eligibility record not found</p>
        <Button
          onClick={() => navigate('/nphies-eligibility')}
          className="mt-4"
          variant="outline"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to List
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="relative">
        <div className="relative bg-white rounded-2xl p-8 border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center space-x-4 mb-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate('/nphies-eligibility')}
                  className="text-gray-600 hover:text-gray-900"
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to List
                </Button>
              </div>
              <h1 className="text-4xl font-bold text-gray-900">
                Eligibility Details
              </h1>
              <p className="text-gray-600 mt-2 text-lg">
                Request ID: <span className="font-mono">{record.eligibilityId || record.eligibility_id || id}</span>
              </p>
              <div className="flex items-center space-x-4 mt-4">
                <Badge className={getStatusBadgeClass(record.status)}>
                  {record.status === 'eligible' && <CheckCircle className="h-3 w-3 mr-1" />}
                  {record.status === 'not_eligible' && <XCircle className="h-3 w-3 mr-1" />}
                  {getStatusDisplay(record.status)}
                </Badge>
                {record.outcome && (
                  <Badge variant="outline">
                    Outcome: {record.outcome?.toUpperCase()}
                  </Badge>
                )}
                {(record.inforce !== undefined || inforceFromResponse !== undefined) && (
                  <Badge className={(record.inforce ?? inforceFromResponse) ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>
                    {(record.inforce ?? inforceFromResponse) ? 'In Force' : 'Not In Force'}
                  </Badge>
                )}
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <Button variant="outline" onClick={loadEligibilityRecord}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
              <Button
                onClick={() => navigate('/nphies-eligibility/new')}
                className="bg-gradient-to-r from-primary-purple to-accent-purple text-white"
              >
                <Shield className="h-4 w-4 mr-2" />
                New Check
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Site Eligibility Banner */}
      {(siteEligibility || record.siteEligibility || record.site_eligibility) && (
        <div className={`rounded-xl p-4 border ${getSiteEligibilityColor(siteEligibility?.code || record.siteEligibility?.code || record.site_eligibility)}`}>
          <div className="flex items-center space-x-3">
            {(siteEligibility?.code || record.siteEligibility?.code || record.site_eligibility) === 'eligible' ? (
              <CheckCircle className="h-6 w-6" />
            ) : (
              <XCircle className="h-6 w-6" />
            )}
            <div>
              <p className="font-semibold">Site Eligibility: {(siteEligibility?.code || record.siteEligibility?.code || record.site_eligibility)?.toUpperCase()}</p>
              <p className="text-sm">{siteEligibility?.display || record.siteEligibility?.display || getSiteEligibilityDisplay(siteEligibility?.code || record.siteEligibility?.code || record.site_eligibility)}</p>
            </div>
          </div>
        </div>
      )}

      {/* Response Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Info className="h-5 w-5 text-primary-purple mr-2" />
            Response Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="bg-gray-50 p-4 rounded-lg">
              <p className="text-sm text-gray-600 mb-1">Outcome</p>
              <Badge variant={record.outcome === 'complete' ? 'default' : 'destructive'}>
                {record.outcome?.toUpperCase() || 'N/A'}
              </Badge>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg">
              <p className="text-sm text-gray-600 mb-1">Coverage Status</p>
              <p className="text-lg font-semibold">
                {(record.inforce ?? inforceFromResponse) ? (
                  <span className="text-green-600 flex items-center">
                    <CheckCircle className="h-5 w-5 mr-1" /> In Force
                  </span>
                ) : (
                  <span className="text-red-600 flex items-center">
                    <XCircle className="h-5 w-5 mr-1" /> Not In Force
                  </span>
                )}
              </p>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg">
              <p className="text-sm text-gray-600 mb-1">Request Date</p>
              <p className="font-medium flex items-center">
                <Calendar className="h-4 w-4 mr-2 text-gray-400" />
                {formatDateTime(record.request_date || record.requestDate)}
              </p>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg">
              <p className="text-sm text-gray-600 mb-1">Response Date</p>
              <p className="font-medium flex items-center">
                <Clock className="h-4 w-4 mr-2 text-gray-400" />
                {formatDateTime(record.response_date || record.responseDate)}
              </p>
            </div>
          </div>

          {/* Message Header Info */}
          {(messageResponseCode || messageSender || messageDestination) && (
            <div className="mt-4 pt-4 border-t border-gray-100">
              <h4 className="text-sm font-semibold text-gray-700 mb-3">NPHIES Message Details</h4>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {messageResponseCode && (
                  <div className="bg-green-50 p-3 rounded-lg">
                    <p className="text-xs text-green-600 mb-1">Response Code</p>
                    <Badge className={messageResponseCode === 'ok' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>
                      {messageResponseCode.toUpperCase()}
                    </Badge>
                  </div>
                )}
                {messageEventCode && (
                  <div className="bg-purple-50 p-3 rounded-lg">
                    <p className="text-xs text-purple-600 mb-1">Event Type</p>
                    <p className="font-medium text-sm">{messageEventCode}</p>
                  </div>
                )}
                {messageSender && (
                  <div className="bg-amber-50 p-3 rounded-lg">
                    <p className="text-xs text-amber-600 mb-1">From (Payer)</p>
                    <p className="font-mono text-sm">{messageSender}</p>
                  </div>
                )}
                {messageDestination && (
                  <div className="bg-blue-50 p-3 rounded-lg">
                    <p className="text-xs text-blue-600 mb-1">To (Provider)</p>
                    <p className="font-mono text-sm">{messageDestination}</p>
                  </div>
                )}
              </div>
              {messageResponseId && (
                <div className="mt-3 bg-gray-50 p-3 rounded-lg">
                  <p className="text-xs text-gray-600 mb-1">Original Request ID (Correlation)</p>
                  <p className="font-mono text-sm">{messageResponseId}</p>
                </div>
              )}
            </div>
          )}

          {/* Eligibility Reference ID - Important for Prior Authorization */}
          {eligibilityRefId && (
            <div className="mt-4 pt-4 border-t border-gray-100">
              <div className="bg-gradient-to-r from-purple-50 to-indigo-50 p-4 rounded-lg border-2 border-purple-200">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-purple-900 mb-1 flex items-center">
                      <Shield className="h-4 w-4 mr-2" />
                      Eligibility Reference ID (For Prior Authorization)
                    </p>
                    <p className="text-xs text-purple-700 mb-2">
                      Use this ID when creating a Prior Authorization request
                    </p>
                    <div className="bg-white rounded-lg p-3 border border-purple-300">
                      <p className="font-mono text-lg font-bold text-purple-900">{eligibilityRefId}</p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="ml-4"
                    onClick={() => {
                      navigator.clipboard.writeText(eligibilityRefId);
                      setCopiedToClipboard(true);
                      setTimeout(() => setCopiedToClipboard(false), 2000);
                    }}
                  >
                    <Copy className="h-4 w-4 mr-2" />
                    Copy
                  </Button>
                </div>
                {eligibilityResponseFullUrl && (
                  <div className="mt-3 pt-3 border-t border-purple-200">
                    <p className="text-xs text-purple-600 mb-1">Full Reference URL</p>
                    <p className="font-mono text-xs text-purple-800 break-all">{eligibilityResponseFullUrl}</p>
                  </div>
                )}
                {eligibilityResponseIdentifierValue && (
                  <div className="mt-3 pt-3 border-t border-purple-200">
                    <p className="text-xs text-purple-600 mb-1">Alternative Identifier</p>
                    <p className="font-mono text-sm text-purple-800">{eligibilityResponseIdentifierValue}</p>
                    {eligibilityResponseIdentifierSystem && (
                      <p className="text-xs text-purple-500 mt-1">{eligibilityResponseIdentifierSystem}</p>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* NPHIES IDs */}
          {(record.nphies_request_id || record.nphies_response_id) && (
            <div className="mt-4 pt-4 border-t border-gray-100">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {record.nphies_request_id && (
                  <div className="bg-blue-50 p-3 rounded-lg">
                    <p className="text-xs text-blue-600 mb-1">NPHIES Request ID</p>
                    <p className="font-mono text-sm">{record.nphies_request_id}</p>
                  </div>
                )}
                {record.nphies_response_id && (
                  <div className="bg-blue-50 p-3 rounded-lg">
                    <p className="text-xs text-blue-600 mb-1">NPHIES Response ID</p>
                    <p className="font-mono text-sm">{record.nphies_response_id}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Purpose */}
          {(record.purpose || eligibilityResponse.purpose) && (
            <div className="mt-4 pt-4 border-t border-gray-100">
              <p className="text-sm text-gray-600 mb-2">Request Purpose</p>
              <div className="flex flex-wrap gap-2">
                {(typeof (record.purpose || eligibilityResponse.purpose) === 'string' 
                  ? (record.purpose || eligibilityResponse.purpose).split(',') 
                  : (record.purpose || eligibilityResponse.purpose)
                ).map((p, idx) => (
                  <Badge key={idx} variant="outline" className="capitalize">
                    {p.trim()}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Patient Information - Full Width */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center text-lg">
            <User className="h-5 w-5 text-blue-600 mr-2" />
            Patient Information
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Basic Info */}
            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-600 flex items-center">
                  <User className="h-3 w-3 mr-1" /> Full Name
                </p>
                <p className="font-semibold text-lg">{patientName || 'N/A'}</p>
              </div>
              {patientIdentifierValue && (
                <div>
                  <p className="text-sm text-gray-600 flex items-center">
                    <Hash className="h-3 w-3 mr-1" /> {patientIdentifierType || 'Identifier'}
                  </p>
                  <p className="font-mono bg-gray-100 px-2 py-1 rounded inline-block text-sm">
                    {patientIdentifierValue}
                  </p>
                  {patientIdentifierCountry && (
                    <p className="text-xs text-gray-500 mt-1">Country: {patientIdentifierCountry}</p>
                  )}
                </div>
              )}
            </div>
            
            {/* Demographics */}
            <div className="space-y-4">
              {patientGender && (
                <div>
                  <p className="text-sm text-gray-600">Gender</p>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="capitalize">
                      {getGenderDisplay(patientGender)}
                    </Badge>
                    {patientKsaGender && patientKsaGender !== patientGender && (
                      <Badge variant="secondary" className="text-xs">
                        KSA: {getGenderDisplay(patientKsaGender)}
                      </Badge>
                    )}
                  </div>
                </div>
              )}
              {patientBirthDate && (
                <div>
                  <p className="text-sm text-gray-600 flex items-center">
                    <Calendar className="h-3 w-3 mr-1" /> Date of Birth
                  </p>
                  <p className="font-medium">{formatDate(patientBirthDate)}</p>
                </div>
              )}
              {patientMaritalStatus && (
                <div>
                  <p className="text-sm text-gray-600 flex items-center">
                    <Heart className="h-3 w-3 mr-1" /> Marital Status
                  </p>
                  <p className="font-medium">{getMaritalStatusDisplay(patientMaritalStatus)}</p>
                </div>
              )}
            </div>
            
            {/* Contact Info */}
            <div className="space-y-4">
              {patientPhone && (
                <div>
                  <p className="text-sm text-gray-600 flex items-center">
                    <Phone className="h-3 w-3 mr-1" /> Phone
                  </p>
                  <p className="font-medium">{patientPhone}</p>
                </div>
              )}
              {patientEmail && (
                <div>
                  <p className="text-sm text-gray-600">Email</p>
                  <p className="font-medium text-sm">{patientEmail}</p>
                </div>
              )}
              {patientOccupation && (
                <div>
                  <p className="text-sm text-gray-600 flex items-center">
                    <Briefcase className="h-3 w-3 mr-1" /> Occupation
                  </p>
                  <Badge variant="secondary" className="capitalize">
                    {patientOccupation}
                  </Badge>
                </div>
              )}
            </div>
            
            {/* Status Info */}
            <div className="space-y-4">
              {record.patient_is_newborn !== undefined && (
                <div>
                  <p className="text-sm text-gray-600">Newborn Status</p>
                  <Badge variant={record.patient_is_newborn ? 'default' : 'secondary'}>
                    {record.patient_is_newborn ? 'Yes - Newborn' : 'No'}
                  </Badge>
                </div>
              )}
              {patientData.active !== undefined && (
                <div>
                  <p className="text-sm text-gray-600">Patient Status</p>
                  <Badge className={patientData.active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}>
                    {patientData.active ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
              )}
              {patientData.deceasedBoolean !== undefined && patientData.deceasedBoolean && (
                <div>
                  <p className="text-sm text-gray-600">Deceased</p>
                  <Badge variant="destructive">Yes</Badge>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Mother Patient Information (for Newborn Cases) */}
      {motherPatientData.id && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center text-lg">
              <User className="h-5 w-5 text-purple-600 mr-2" />
              Mother Patient Information
            </CardTitle>
            <CardDescription>
              Coverage subscriber information for newborn eligibility
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {/* Basic Info */}
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-gray-600 flex items-center">
                    <User className="h-3 w-3 mr-1" /> Full Name
                  </p>
                  <p className="font-semibold text-lg">
                    {motherPatientData.name?.[0]?.text || 
                      [motherPatientData.name?.[0]?.given?.join(' '), motherPatientData.name?.[0]?.family].filter(Boolean).join(' ') || 
                      'N/A'}
                  </p>
                </div>
                {motherPatientData.identifier?.[0]?.value && (
                  <div>
                    <p className="text-sm text-gray-600 flex items-center">
                      <Hash className="h-3 w-3 mr-1" /> {motherPatientData.identifier?.[0]?.type?.coding?.[0]?.display || 'Identifier'}
                    </p>
                    <p className="font-mono bg-gray-100 px-2 py-1 rounded inline-block text-sm">
                      {motherPatientData.identifier[0].value}
                    </p>
                    {motherPatientData.identifier[0].extension?.find(e => e.url?.includes('country'))?.valueCodeableConcept?.coding?.[0]?.display && (
                      <p className="text-xs text-gray-500 mt-1">
                        Country: {motherPatientData.identifier[0].extension.find(e => e.url?.includes('country')).valueCodeableConcept.coding[0].display}
                      </p>
                    )}
                  </div>
                )}
              </div>
              
              {/* Demographics */}
              <div className="space-y-4">
                {motherPatientData.gender && (
                  <div>
                    <p className="text-sm text-gray-600">Gender</p>
                    <Badge variant="outline" className="capitalize">
                      {getGenderDisplay(motherPatientData.gender)}
                    </Badge>
                  </div>
                )}
                {motherPatientData.birthDate && (
                  <div>
                    <p className="text-sm text-gray-600 flex items-center">
                      <Calendar className="h-3 w-3 mr-1" /> Date of Birth
                    </p>
                    <p className="font-medium">{formatDate(motherPatientData.birthDate)}</p>
                  </div>
                )}
                {motherPatientData.maritalStatus?.coding?.[0]?.code && (
                  <div>
                    <p className="text-sm text-gray-600 flex items-center">
                      <Heart className="h-3 w-3 mr-1" /> Marital Status
                    </p>
                    <p className="font-medium">{getMaritalStatusDisplay(motherPatientData.maritalStatus.coding[0].code)}</p>
                  </div>
                )}
              </div>
              
              {/* Contact Info */}
              <div className="space-y-4">
                {motherPatientData.telecom?.find(t => t.system === 'phone')?.value && (
                  <div>
                    <p className="text-sm text-gray-600 flex items-center">
                      <Phone className="h-3 w-3 mr-1" /> Phone
                    </p>
                    <p className="font-medium">{motherPatientData.telecom.find(t => t.system === 'phone').value}</p>
                  </div>
                )}
                {motherPatientData.telecom?.find(t => t.system === 'email')?.value && (
                  <div>
                    <p className="text-sm text-gray-600">Email</p>
                    <p className="font-medium text-sm">{motherPatientData.telecom.find(t => t.system === 'email').value}</p>
                  </div>
                )}
                {motherPatientData.extension?.find(e => e.url?.includes('occupation'))?.valueCodeableConcept?.coding?.[0]?.code && (
                  <div>
                    <p className="text-sm text-gray-600 flex items-center">
                      <Briefcase className="h-3 w-3 mr-1" /> Occupation
                    </p>
                    <Badge variant="secondary" className="capitalize">
                      {motherPatientData.extension.find(e => e.url?.includes('occupation')).valueCodeableConcept.coding[0].code}
                    </Badge>
                  </div>
                )}
              </div>
              
              {/* Status Info */}
              <div className="space-y-4">
                {motherPatientData.active !== undefined && (
                  <div>
                    <p className="text-sm text-gray-600">Patient Status</p>
                    <Badge className={motherPatientData.active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}>
                      {motherPatientData.active ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                )}
                {motherPatientData.deceasedBoolean !== undefined && motherPatientData.deceasedBoolean && (
                  <div>
                    <p className="text-sm text-gray-600">Deceased</p>
                    <Badge variant="destructive">Yes</Badge>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Coverage Relationship Information (for Newborn Cases) */}
      {coverageRelationship === 'child' && coverageSubscriber && coverageBeneficiary && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center text-lg">
              <Users className="h-5 w-5 text-indigo-600 mr-2" />
              Coverage Relationship
            </CardTitle>
            <CardDescription>
              Newborn coverage relationship information
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-blue-50 p-4 rounded-lg">
                <p className="text-sm text-blue-600 mb-1">Subscriber (Mother)</p>
                <p className="font-mono text-sm break-all">{coverageSubscriber}</p>
              </div>
              <div className="bg-purple-50 p-4 rounded-lg">
                <p className="text-sm text-purple-600 mb-1">Beneficiary (Newborn)</p>
                <p className="font-mono text-sm break-all">{coverageBeneficiary}</p>
              </div>
              <div className="bg-indigo-50 p-4 rounded-lg">
                <p className="text-sm text-indigo-600 mb-1">Relationship</p>
                <Badge variant="outline" className="mt-1">
                  {getRelationshipDisplay(coverageRelationship)}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Provider and Insurer Information */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Provider */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center text-lg">
              <Building className="h-5 w-5 text-purple-600 mr-2" />
              Provider
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div>
                <p className="text-sm text-gray-600">Name</p>
                <p className="font-semibold">{record.provider_name || record.provider?.name || 'N/A'}</p>
              </div>
              {(record.provider_nphies_id || record.provider?.nphiesId) && (
                <div>
                  <p className="text-sm text-gray-600">NPHIES ID</p>
                  <p className="font-mono text-sm bg-gray-100 px-2 py-1 rounded inline-block">
                    {record.provider_nphies_id || record.provider?.nphiesId}
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Insurer */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center text-lg">
              <Shield className="h-5 w-5 text-amber-600 mr-2" />
              Insurer
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-3">
                <div>
                  <p className="text-sm text-gray-600">Name</p>
                  <p className="font-semibold">{insurerName || 'N/A'}</p>
                </div>
                {insurerNphiesId && (
                  <div>
                    <p className="text-sm text-gray-600">NPHIES ID</p>
                    <p className="font-mono text-sm bg-gray-100 px-2 py-1 rounded inline-block">
                      {insurerNphiesId}
                    </p>
                  </div>
                )}
                {insurerType && (
                  <div>
                    <p className="text-sm text-gray-600">Type</p>
                    <Badge variant="outline" className="capitalize">{insurerType}</Badge>
                  </div>
                )}
              </div>
              {insurerAddress && (
                <div className="space-y-3">
                  <div>
                    <p className="text-sm text-gray-600 flex items-center">
                      <MapPin className="h-3 w-3 mr-1" /> Address
                    </p>
                    <div className="text-sm">
                      {insurerAddress.line?.map((line, idx) => (
                        <p key={idx}>{line}</p>
                      ))}
                      {insurerAddress.city && <p>{insurerAddress.city}</p>}
                      {insurerAddress.country && <p>{insurerAddress.country}</p>}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Coverage Information - Enhanced with Multiple Policies Support */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center">
              <CreditCard className="h-5 w-5 text-green-600 mr-2" />
              Coverage Information
              {allCoverages.length > 1 && (
                <Badge className="ml-2 bg-blue-100 text-blue-800">
                  {allCoverages.length} Policies
                </Badge>
              )}
            </span>
            {coverageStatus && (
              <Badge className={coverageStatus === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}>
                {coverageStatus.toUpperCase()}
              </Badge>
            )}
          </CardTitle>
          {allCoverages.length > 1 && (
            <CardDescription>
              This patient has {allCoverages.length} active insurance policies
            </CardDescription>
          )}
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Display all coverages/policies */}
          {allCoverages.length > 0 ? (
            <div className="space-y-6">
              {allCoverages.map((coverage, policyIndex) => {
                const polCoverageType = coverage.type?.coding?.[0]?.code;
                const polCoverageTypeDisplay = coverage.type?.coding?.[0]?.display || getCoverageTypeDisplay(polCoverageType);
                const polMemberId = coverage.identifier?.find(i => i.system?.includes('memberid'))?.value || 
                  coverage.identifier?.[0]?.value;
                const polPeriod = coverage.period;
                const polNetwork = coverage.network;
                const polRelationship = coverage.relationship?.coding?.[0]?.code;
                const polStatus = coverage.status;
                const polClasses = coverage.class || [];
                const polCostToBeneficiary = coverage.costToBeneficiary || [];
                const polSubscriber = coverage.subscriber?.reference;
                const polBeneficiary = coverage.beneficiary?.reference;
                const polPolicyHolder = coverage.policyHolder?.reference;
                const polDependent = coverage.dependent;
                const polSubrogation = coverage.subrogation;
                
                // Generate unique colors for each policy card
                const policyColors = [
                  { bg: 'bg-gradient-to-r from-green-50 to-emerald-50', border: 'border-green-200', accent: 'text-green-700' },
                  { bg: 'bg-gradient-to-r from-blue-50 to-indigo-50', border: 'border-blue-200', accent: 'text-blue-700' },
                  { bg: 'bg-gradient-to-r from-purple-50 to-violet-50', border: 'border-purple-200', accent: 'text-purple-700' },
                  { bg: 'bg-gradient-to-r from-amber-50 to-orange-50', border: 'border-amber-200', accent: 'text-amber-700' },
                  { bg: 'bg-gradient-to-r from-rose-50 to-pink-50', border: 'border-rose-200', accent: 'text-rose-700' },
                ];
                const colorScheme = policyColors[policyIndex % policyColors.length];
                
                return (
                  <div 
                    key={coverage.id || policyIndex} 
                    className={`${colorScheme.bg} ${colorScheme.border} border-2 rounded-xl p-5`}
                  >
                    {/* Policy Header */}
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full bg-white flex items-center justify-center ${colorScheme.accent} font-bold text-sm border`}>
                          {policyIndex + 1}
                        </div>
                        <div>
                          <h4 className={`font-semibold ${colorScheme.accent}`}>
                            Policy #{policyIndex + 1}
                          </h4>
                          <p className="text-sm text-gray-600">{polCoverageTypeDisplay}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {polStatus && (
                          <Badge className={polStatus === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}>
                            {polStatus.toUpperCase()}
                          </Badge>
                        )}
                      </div>
                    </div>
                    
                    {/* Main Policy Details */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                      <div className="bg-white/70 p-3 rounded-lg">
                        <p className="text-sm text-gray-600 flex items-center">
                          <Hash className="h-3 w-3 mr-1" /> Member ID
                        </p>
                        <p className="font-mono font-semibold text-lg">{polMemberId || 'N/A'}</p>
                      </div>
                      <div className="bg-white/70 p-3 rounded-lg">
                        <p className="text-sm text-gray-600">Coverage Type</p>
                        <p className="font-semibold">{polCoverageTypeDisplay}</p>
                        {polCoverageType && polCoverageType !== polCoverageTypeDisplay && (
                          <p className="text-xs text-gray-500 font-mono">{polCoverageType}</p>
                        )}
                      </div>
                      <div className="bg-white/70 p-3 rounded-lg">
                        <p className="text-sm text-gray-600 flex items-center">
                          <Users className="h-3 w-3 mr-1" /> Relationship
                        </p>
                        <p className="font-semibold">{getRelationshipDisplay(polRelationship)}</p>
                      </div>
                      <div className="bg-white/70 p-3 rounded-lg">
                        <p className="text-sm text-gray-600 flex items-center">
                          <Network className="h-3 w-3 mr-1" /> Network
                        </p>
                        <p className="font-semibold">{polNetwork || 'N/A'}</p>
                      </div>
                    </div>

                    {/* Coverage Period */}
                    {polPeriod && (
                      <div className="mb-4">
                        <h5 className="text-sm font-semibold text-gray-700 mb-2 flex items-center">
                          <Calendar className="h-4 w-4 mr-2" /> Coverage Period
                        </h5>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="bg-white/70 p-2 rounded-lg">
                            <p className="text-xs text-gray-600">Start Date</p>
                            <p className="font-semibold">{formatDate(polPeriod.start)}</p>
                          </div>
                          <div className="bg-white/70 p-2 rounded-lg">
                            <p className="text-xs text-gray-600">End Date</p>
                            <p className="font-semibold">{formatDate(polPeriod.end)}</p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Group/Plan Classes */}
                    {polClasses.length > 0 && (
                      <div className="mb-4">
                        <h5 className="text-sm font-semibold text-gray-700 mb-2">Plan & Group Details</h5>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          {polClasses.map((cls, idx) => {
                            const classType = cls.type?.coding?.[0]?.code || 'unknown';
                            return (
                              <div key={idx} className="bg-white/70 p-2 rounded-lg border">
                                <p className="text-xs text-gray-600 font-medium uppercase">{classType}</p>
                                <p className="font-semibold text-sm">{cls.name || cls.value}</p>
                                {cls.name && cls.value && (
                                  <p className="text-xs text-gray-500 font-mono">{cls.value}</p>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Cost to Beneficiary for this policy */}
                    {polCostToBeneficiary.length > 0 && (
                      <div className="mb-4">
                        <h5 className="text-sm font-semibold text-gray-700 mb-2 flex items-center">
                          <DollarSign className="h-4 w-4 mr-2" /> Cost to Beneficiary
                        </h5>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                          {polCostToBeneficiary.map((cost, idx) => {
                            const costType = cost.type?.coding?.[0]?.code;
                            const costTypeDisplay = getCopayTypeDisplay(costType);
                            const hasMoney = cost.valueMoney;
                            const hasQuantity = cost.valueQuantity;
                            
                            return (
                              <div key={idx} className="bg-white/70 p-2 rounded-lg border">
                                <p className="text-xs text-gray-600">{costTypeDisplay}</p>
                                <p className="font-semibold">
                                  {hasMoney && `${cost.valueMoney.value} ${cost.valueMoney.currency || 'SAR'}`}
                                  {hasQuantity && `${cost.valueQuantity.value}${cost.valueQuantity.code || '%'}`}
                                  {!hasMoney && !hasQuantity && 'N/A'}
                                </p>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Additional Details */}
                    {(polDependent || polSubrogation !== undefined) && (
                      <div className="grid grid-cols-2 gap-3 mb-4">
                        {polDependent && (
                          <div className="bg-white/70 p-2 rounded-lg">
                            <p className="text-xs text-gray-600">Dependent</p>
                            <p className="font-medium">{polDependent}</p>
                          </div>
                        )}
                        {polSubrogation !== undefined && (
                          <div className="bg-white/70 p-2 rounded-lg">
                            <p className="text-xs text-gray-600">Subrogation</p>
                            <Badge variant={polSubrogation ? 'default' : 'secondary'} className="mt-1">
                              {polSubrogation ? 'Yes' : 'No'}
                            </Badge>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Coverage References - Collapsible */}
                    {(polSubscriber || polBeneficiary || polPolicyHolder) && (
                      <div className="border-t border-gray-200/50 pt-3 mt-3">
                        <details className="group">
                          <summary className="text-xs text-gray-600 cursor-pointer hover:text-gray-800 flex items-center">
                            <ChevronDown className="h-3 w-3 mr-1 group-open:rotate-180 transition-transform" />
                            Coverage References
                          </summary>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mt-2 text-xs">
                            {polSubscriber && (
                              <div className="bg-white/50 p-2 rounded">
                                <p className="text-gray-500">Subscriber</p>
                                <p className="font-mono break-all">{polSubscriber}</p>
                              </div>
                            )}
                            {polBeneficiary && (
                              <div className="bg-white/50 p-2 rounded">
                                <p className="text-gray-500">Beneficiary</p>
                                <p className="font-mono break-all">{polBeneficiary}</p>
                              </div>
                            )}
                            {polPolicyHolder && (
                              <div className="bg-white/50 p-2 rounded">
                                <p className="text-gray-500">Policy Holder</p>
                                <p className="font-mono break-all">{polPolicyHolder}</p>
                              </div>
                            )}
                          </div>
                        </details>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            /* Fallback to single coverage display if no coverages array */
            <>
              {/* Main Coverage Details */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-600 flex items-center">
                    <Hash className="h-3 w-3 mr-1" /> Member ID
                  </p>
                  <p className="font-mono font-semibold text-lg">{coverageMemberId || record.policy_number || 'N/A'}</p>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-600">Coverage Type</p>
                  <p className="font-semibold">{coverageTypeDisplay}</p>
                  {coverageType && coverageType !== coverageTypeDisplay && (
                    <p className="text-xs text-gray-500 font-mono">{coverageType}</p>
                  )}
                </div>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-600 flex items-center">
                    <Users className="h-3 w-3 mr-1" /> Relationship
                  </p>
                  <p className="font-semibold">{getRelationshipDisplay(coverageRelationship)}</p>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-600 flex items-center">
                    <Network className="h-3 w-3 mr-1" /> Network
                  </p>
                  <p className="font-semibold">{coverageNetwork || 'N/A'}</p>
                </div>
              </div>

              {/* Coverage Period */}
              {coveragePeriod && (
                <div className="border-t pt-4">
                  <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center">
                    <Calendar className="h-4 w-4 mr-2" /> Coverage Period
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-blue-50 p-3 rounded-lg">
                      <p className="text-xs text-blue-600">Start Date</p>
                      <p className="font-semibold">{formatDate(coveragePeriod.start)}</p>
                    </div>
                    <div className="bg-blue-50 p-3 rounded-lg">
                      <p className="text-xs text-blue-600">End Date</p>
                      <p className="font-semibold">{formatDate(coveragePeriod.end)}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Group/Plan Classes */}
              {coverageClasses.length > 0 && (
                <div className="border-t pt-4">
                  <h4 className="text-sm font-semibold text-gray-700 mb-3">Plan & Group Details</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {coverageClasses.map((cls, idx) => {
                      const classType = cls.type?.coding?.[0]?.code || 'unknown';
                      const bgColor = classType === 'group' ? 'bg-amber-50' : 
                                      classType === 'plan' ? 'bg-emerald-50' : 'bg-gray-50';
                      const textColor = classType === 'group' ? 'text-amber-700' : 
                                        classType === 'plan' ? 'text-emerald-700' : 'text-gray-700';
                      return (
                        <div key={idx} className={`${bgColor} p-3 rounded-lg border`}>
                          <p className={`text-xs ${textColor} font-medium uppercase`}>{classType}</p>
                          <p className="font-semibold">{cls.name || 'N/A'}</p>
                          <p className="text-sm text-gray-600 font-mono">{cls.value}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Additional Coverage Details */}
              <div className="border-t pt-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {coverageDependent && (
                    <div>
                      <p className="text-sm text-gray-600">Dependent</p>
                      <p className="font-medium">{coverageDependent}</p>
                    </div>
                  )}
                  {coverageSubrogation !== undefined && (
                    <div>
                      <p className="text-sm text-gray-600">Subrogation</p>
                      <Badge variant={coverageSubrogation ? 'default' : 'secondary'}>
                        {coverageSubrogation ? 'Yes' : 'No'}
                      </Badge>
                    </div>
                  )}
                  {disposition && (
                    <div className="col-span-full">
                      <p className="text-sm text-gray-600">Disposition</p>
                      <p className={`font-medium ${record?.outcome === 'error' ? 'text-red-700' : 'text-green-700'}`}>{disposition}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Coverage References */}
              {(coverageSubscriber || coverageBeneficiary || coveragePolicyHolder) && (
                <div className="border-t pt-4">
                  <h4 className="text-sm font-semibold text-gray-700 mb-3">Coverage References</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                    {coverageSubscriber && (
                      <div className="bg-gray-50 p-3 rounded-lg">
                        <p className="text-xs text-gray-600 mb-1">Subscriber</p>
                        <p className="font-mono text-xs break-all">{coverageSubscriber}</p>
                      </div>
                    )}
                    {coverageBeneficiary && (
                      <div className="bg-gray-50 p-3 rounded-lg">
                        <p className="text-xs text-gray-600 mb-1">Beneficiary</p>
                        <p className="font-mono text-xs break-all">{coverageBeneficiary}</p>
                      </div>
                    )}
                    {coveragePolicyHolder && (
                      <div className="bg-gray-50 p-3 rounded-lg">
                        <p className="text-xs text-gray-600 mb-1">Policy Holder</p>
                        <p className="font-mono text-xs break-all">{coveragePolicyHolder}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}

          {/* Serviced Period (Eligibility Check Period) - Common for all policies */}
          {servicedPeriod && (
            <div className="border-t pt-4">
              <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center">
                <Clock className="h-4 w-4 mr-2" /> Eligibility Check Period (Serviced)
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-purple-50 p-3 rounded-lg">
                  <p className="text-xs text-purple-600">From</p>
                  <p className="font-semibold">{formatDate(servicedPeriod.start)}</p>
                </div>
                <div className="bg-purple-50 p-3 rounded-lg">
                  <p className="text-xs text-purple-600">To</p>
                  <p className="font-semibold">{formatDate(servicedPeriod.end)}</p>
                </div>
              </div>
            </div>
          )}

          {/* Disposition - Common */}
          {disposition && allCoverages.length > 0 && (
            <div className="border-t pt-4">
              <p className="text-sm text-gray-600">Disposition</p>
              <p className={`font-medium ${record?.outcome === 'error' ? 'text-red-700' : 'text-green-700'}`}>{disposition}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Benefits */}
      {benefits && benefits.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center">
                <CheckCircle className="h-5 w-5 text-green-600 mr-2" />
                Benefits Details ({benefits.length} items)
              </span>
              <Badge variant="outline">{benefits.filter(b => !b.excluded).length} Active</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {benefits.map((benefit, index) => (
                <div key={index} className={`rounded-lg p-4 border ${benefit.excluded ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-gray-200'}`}>
                  {/* Benefit Header */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h4 className="font-semibold text-gray-900">{benefit.category}</h4>
                      {benefit.description && (
                        <p className="text-sm text-gray-600 mt-1">{benefit.description}</p>
                      )}
                    </div>
                    <div className="flex gap-2 ml-4">
                      <Badge variant={benefit.networkCode === 'in' ? 'default' : 'secondary'} className="text-xs">
                        {benefit.network || (benefit.networkCode === 'in' ? 'In Network' : 'Out of Network')}
                      </Badge>
                      {benefit.term && (
                        <Badge variant="outline" className="text-xs">{benefit.term}</Badge>
                      )}
                    </div>
                  </div>
                  
                  {/* Benefit Details */}
                  {benefit.benefitDetails && benefit.benefitDetails.length > 0 && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {benefit.benefitDetails.map((detail, detailIndex) => (
                        <div key={detailIndex} className={`p-2 rounded ${
                          detail.type === 'benefit' ? 'bg-green-100' :
                          detail.type === 'approval-limit' ? 'bg-blue-100' :
                          detail.type?.includes('copay') ? 'bg-amber-100' :
                          detail.type === 'room' ? 'bg-purple-100' : 'bg-gray-100'
                        }`}>
                          <p className="text-xs text-gray-600">{detail.typeDisplay || detail.type}</p>
                          <p className="font-semibold text-sm">{detail.allowedDisplay || detail.allowed || 'N/A'}</p>
                          {detail.usedDisplay && (
                            <p className="text-xs text-gray-500">Used: {detail.usedDisplay}</p>
                          )}
                          {detail.remainingDisplay && (
                            <p className="text-xs text-blue-600 font-medium">Left: {detail.remainingDisplay}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  
                  {benefit.excluded && (
                    <Badge variant="destructive" className="mt-2">Excluded</Badge>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Errors */}
      {errors && errors.length > 0 && (
        <Card className="border-red-200">
          <CardHeader>
            <CardTitle className="flex items-center text-red-900">
              <AlertCircle className="h-5 w-5 mr-2" />
              NPHIES Validation Errors ({errors.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {errors.map((err, index) => (
                <div key={index} className="bg-red-50 rounded-lg p-4 border-l-4 border-red-500">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-2">
                        <Badge variant="destructive" className="font-mono">
                          {err.code || 'ERROR'}
                        </Badge>
                        <span className="text-sm text-gray-500">Error #{index + 1}</span>
                      </div>
                      <p className="text-red-700 font-medium mb-2">{err.message || err}</p>
                      {err.location && (
                        <div className="bg-white rounded px-3 py-2 mt-2">
                          <p className="text-xs text-gray-600 mb-1">Location in Bundle:</p>
                          <p className="text-sm font-mono text-gray-800">{err.location}</p>
                        </div>
                      )}
                    </div>
                    <XCircle className="h-5 w-5 text-red-500 flex-shrink-0 ml-3" />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Raw FHIR Data */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <FileText className="h-5 w-5 text-gray-600 mr-2" />
            Raw FHIR Data
          </CardTitle>
          <CardDescription>
            View the complete FHIR request and response bundles
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Request Bundle */}
          <div className="border rounded-lg">
            <div className="flex items-center justify-between p-4">
              <button
                type="button"
                onClick={() => setShowRawRequest(!showRawRequest)}
                className="flex-1 flex items-center justify-between text-left font-semibold text-gray-700 hover:text-gray-900 transition-colors"
              >
                <span>Request Bundle</span>
                {showRawRequest ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
              </button>
              <Button
                variant="ghost"
                size="sm"
                className="ml-2"
                onClick={() => handleCopyToClipboard(rawRequest, 'Request')}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            {showRawRequest && (
              <div className="border-t p-4">
                <pre className="bg-gray-900 text-green-400 p-4 rounded-lg overflow-x-auto text-xs max-h-96">
                  {JSON.stringify(rawRequest, null, 2)}
                </pre>
              </div>
            )}
          </div>

          {/* Response Bundle */}
          <div className="border rounded-lg">
            <div className="flex items-center justify-between p-4">
              <button
                type="button"
                onClick={() => setShowRawResponse(!showRawResponse)}
                className="flex-1 flex items-center justify-between text-left font-semibold text-gray-700 hover:text-gray-900 transition-colors"
              >
                <span>Response Bundle</span>
                {showRawResponse ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
              </button>
              <Button
                variant="ghost"
                size="sm"
                className="ml-2"
                onClick={() => handleCopyToClipboard(rawResponse, 'Response')}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            {showRawResponse && (
              <div className="border-t p-4">
                <pre className="bg-gray-900 text-green-400 p-4 rounded-lg overflow-x-auto text-xs max-h-96">
                  {JSON.stringify(rawResponse, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Clipboard notification */}
      {copiedToClipboard && (
        <div className="fixed bottom-4 right-4 bg-green-600 text-white px-4 py-2 rounded-lg shadow-lg flex items-center space-x-2 animate-fade-in">
          <CheckCircle className="h-4 w-4" />
          <span>Copied to clipboard!</span>
        </div>
      )}
    </div>
  );
}

