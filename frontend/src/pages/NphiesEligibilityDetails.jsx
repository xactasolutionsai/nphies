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
  return genders[gender?.toLowerCase()] || gender || 'N/A';
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
    patient: null,
    coverage: null,
    insurer: null,
    eligibilityResponse: null
  };
  
  for (const entry of bundle.entry) {
    const resource = entry.resource;
    if (!resource) continue;
    
    switch (resource.resourceType) {
      case 'Patient':
        result.patient = resource;
        break;
      case 'Coverage':
        result.coverage = resource;
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
        break;
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
  
  // Patient details from FHIR
  const patientData = fhirData.patient || {};
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
  
  // Coverage details from FHIR
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
  
  // Cost to Beneficiary (Copays) from FHIR
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
                {record.inforce !== undefined && (
                  <Badge className={record.inforce ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>
                    {record.inforce ? 'In Force' : 'Not In Force'}
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
      {record.siteEligibility && (
        <div className={`rounded-xl p-4 border ${getSiteEligibilityColor(record.siteEligibility.code || record.site_eligibility)}`}>
          <div className="flex items-center space-x-3">
            {(record.siteEligibility.code || record.site_eligibility) === 'eligible' ? (
              <CheckCircle className="h-6 w-6" />
            ) : (
              <XCircle className="h-6 w-6" />
            )}
            <div>
              <p className="font-semibold">Site Eligibility: {(record.siteEligibility.code || record.site_eligibility)?.toUpperCase()}</p>
              <p className="text-sm">{record.siteEligibility.display || getSiteEligibilityDisplay(record.siteEligibility.code || record.site_eligibility)}</p>
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
                {record.inforce ? (
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
          {record.purpose && (
            <div className="mt-4 pt-4 border-t border-gray-100">
              <p className="text-sm text-gray-600 mb-2">Request Purpose</p>
              <div className="flex flex-wrap gap-2">
                {(typeof record.purpose === 'string' ? record.purpose.split(',') : record.purpose).map((p, idx) => (
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
                  <Badge variant="outline" className="capitalize">
                    {getGenderDisplay(patientGender)}
                  </Badge>
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

      {/* Coverage Information - Enhanced */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center">
              <CreditCard className="h-5 w-5 text-green-600 mr-2" />
              Coverage Information
            </span>
            {coverageStatus && (
              <Badge className={coverageStatus === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}>
                {coverageStatus.toUpperCase()}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
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

          {/* Serviced Period (Eligibility Check Period) */}
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
                <div>
                  <p className="text-sm text-gray-600">Disposition</p>
                  <p className="font-medium text-green-700">{disposition}</p>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Cost to Beneficiary (Copays) */}
      {costToBeneficiary.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <DollarSign className="h-5 w-5 text-emerald-600 mr-2" />
              Cost to Beneficiary (Copays & Deductibles)
            </CardTitle>
            <CardDescription>
              Patient cost sharing amounts for different service types
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {costToBeneficiary.map((cost, idx) => {
                const costType = cost.type?.coding?.[0]?.code;
                const costTypeDisplay = getCopayTypeDisplay(costType);
                const hasMoney = cost.valueMoney;
                const hasQuantity = cost.valueQuantity;
                
                return (
                  <div key={idx} className="bg-gradient-to-br from-emerald-50 to-teal-50 p-4 rounded-lg border border-emerald-200">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-medium text-emerald-800">{costTypeDisplay}</p>
                      <Badge variant="outline" className="text-xs font-mono">{costType}</Badge>
                    </div>
                    <div className="flex items-baseline">
                      {hasMoney && (
                        <>
                          <span className="text-2xl font-bold text-emerald-700">
                            {cost.valueMoney.value}
                          </span>
                          <span className="ml-1 text-sm text-emerald-600">
                            {cost.valueMoney.currency || 'SAR'}
                          </span>
                        </>
                      )}
                      {hasQuantity && (
                        <>
                          <span className="text-2xl font-bold text-emerald-700">
                            {cost.valueQuantity.value}
                          </span>
                          <span className="ml-1 text-sm text-emerald-600">
                            {cost.valueQuantity.unit || '%'}
                          </span>
                        </>
                      )}
                      {!hasMoney && !hasQuantity && (
                        <span className="text-gray-500">N/A</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

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

