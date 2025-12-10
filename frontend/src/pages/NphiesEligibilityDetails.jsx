import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import api from '@/services/api';
import { 
  Shield, CheckCircle, XCircle, AlertCircle, Info, FileText, 
  ChevronDown, ChevronUp, ArrowLeft, RefreshCw, Copy, User, 
  Building, CreditCard, Calendar, Clock
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

  // Parse benefits and errors from JSON if needed
  const benefits = typeof record.benefits === 'string' ? JSON.parse(record.benefits || '[]') : (record.benefits || []);
  const errors = typeof record.error_codes === 'string' ? JSON.parse(record.error_codes || '[]') : (record.error_codes || record.errors || []);
  const rawRequest = typeof record.raw_request === 'string' ? JSON.parse(record.raw_request || '{}') : (record.raw_request || record.raw?.request || {});
  const rawResponse = typeof record.raw_response === 'string' ? JSON.parse(record.raw_response || '{}') : (record.raw_response || record.raw?.response || {});

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

      {/* Patient, Provider, Insurer Information */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Patient */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center text-lg">
              <User className="h-5 w-5 text-blue-600 mr-2" />
              Patient
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div>
                <p className="text-sm text-gray-600">Name</p>
                <p className="font-semibold">{record.patient_name || record.patient?.name || 'N/A'}</p>
              </div>
              {(record.patient_identifier || record.patient?.identifier) && (
                <div>
                  <p className="text-sm text-gray-600">Identifier</p>
                  <p className="font-mono">{record.patient_identifier || record.patient?.identifier}</p>
                </div>
              )}
              {record.patient_is_newborn !== undefined && (
                <div>
                  <p className="text-sm text-gray-600">Newborn</p>
                  <Badge variant={record.patient_is_newborn ? 'default' : 'secondary'}>
                    {record.patient_is_newborn ? 'Yes' : 'No'}
                  </Badge>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

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
            <div className="space-y-3">
              <div>
                <p className="text-sm text-gray-600">Name</p>
                <p className="font-semibold">{record.insurer_name || record.insurer?.name || 'N/A'}</p>
              </div>
              {(record.insurer_nphies_id || record.insurer?.nphiesId) && (
                <div>
                  <p className="text-sm text-gray-600">NPHIES ID</p>
                  <p className="font-mono text-sm bg-gray-100 px-2 py-1 rounded inline-block">
                    {record.insurer_nphies_id || record.insurer?.nphiesId}
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Coverage Information */}
      {(record.policy_number || record.coverage_type || record.coverage) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <CreditCard className="h-5 w-5 text-green-600 mr-2" />
              Coverage Information
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-gray-600">Policy Number</p>
                <p className="font-semibold">{record.policy_number || record.coverage?.policyNumber || 'N/A'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Coverage Type</p>
                <p className="font-semibold">{record.coverage_type || record.coverage?.type || 'N/A'}</p>
              </div>
              {record.coverage?.relationship && (
                <div>
                  <p className="text-sm text-gray-600">Relationship</p>
                  <p className="font-semibold capitalize">{record.coverage.relationship}</p>
                </div>
              )}
              {record.coverage?.network && (
                <div>
                  <p className="text-sm text-gray-600">Network</p>
                  <p className="font-semibold">{record.coverage.network}</p>
                </div>
              )}
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

