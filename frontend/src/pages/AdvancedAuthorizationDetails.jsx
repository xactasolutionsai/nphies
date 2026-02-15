import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import api, { extractErrorMessage } from '@/services/api';
import {
  ArrowLeft, Download, RefreshCw, ShieldAlert, ChevronDown, ChevronRight,
  FileJson, Building2, User, Stethoscope, ClipboardList, Pill,
  Receipt, FileText, Shield, AlertCircle
} from 'lucide-react';

// Helpers
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

// Category display map for supporting info
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

// Adjudication category display
const adjCategoryDisplay = {
  'eligible': 'Eligible Amount',
  'copay': 'CoPay',
  'benefit': 'Benefit Amount',
  'tax': 'Tax',
  'approved-quantity': 'Approved Quantity',
};

export default function AdvancedAuthorizationDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
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
            </h1>
            <p className="text-sm text-gray-500 font-mono">{data.identifier_value || `#${data.id}`}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleDownload}>
            <Download className="h-4 w-4 mr-1" /> Download JSON
          </Button>
        </div>
      </div>

      {/* Key Info Card */}
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
            <InfoItem label="Created Date">
              {formatDate(data.created_date)}
            </InfoItem>
            <InfoItem label="PreAuth Period">
              {data.pre_auth_period_start
                ? `${formatDateTime(data.pre_auth_period_start)} - ${formatDateTime(data.pre_auth_period_end)}`
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

      {/* Provider Info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Building2 className="h-4 w-4" /> Service Provider
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm font-mono">{data.service_provider_reference || '-'}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Stethoscope className="h-4 w-4" /> Referring Provider
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm">
              {data.referring_provider_display || data.referring_provider_reference || '-'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Patient & Insurer */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <User className="h-4 w-4" /> Patient
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm font-mono">{data.patient_reference || '-'}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Shield className="h-4 w-4" /> Insurer
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm font-mono">{data.insurer_reference || '-'}</p>
          </CardContent>
        </Card>
      </div>

      {/* Diagnoses */}
      {diagnoses.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <ClipboardList className="h-4 w-4" /> Diagnoses ({diagnoses.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
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
          </CardContent>
        </Card>
      )}

      {/* Supporting Info */}
      {supportingInfo.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-4 w-4" /> Supporting Information ({supportingInfo.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
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
                      <SupportingInfoValue info={info} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {/* Items (addItem) */}
      {addItems.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Pill className="h-4 w-4" /> Items ({addItems.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 p-4">
            {addItems.map((item, i) => (
              <div key={i} className="border rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Badge variant="outline">Item {item.sequence || i + 1}</Badge>
                    <span className="font-medium text-sm">
                      {item.productOrService?.display || item.productOrService?.code || '-'}
                    </span>
                    <span className="text-xs text-gray-400 font-mono">
                      {item.productOrService?.code}
                    </span>
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
              </div>
            ))}
          </CardContent>
        </Card>
      )}

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
            <CardTitle className="text-base">Process Notes</CardTitle>
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

      {/* Transfer Info (if present) */}
      {(data.transfer_auth_number || data.transfer_auth_provider) && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Transfer Authorization</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <InfoItem label="Transfer Auth Number">
                <span className="font-mono text-xs">{data.transfer_auth_number || '-'}</span>
              </InfoItem>
              <InfoItem label="Transfer Provider">
                <span className="font-mono text-xs">{data.transfer_auth_provider || '-'}</span>
              </InfoItem>
              <InfoItem label="Transfer Period">
                {data.transfer_auth_period_start
                  ? `${formatDateTime(data.transfer_auth_period_start)} - ${formatDateTime(data.transfer_auth_period_end)}`
                  : '-'}
              </InfoItem>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Prescription (if present) */}
      {data.prescription_reference && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Prescription</CardTitle>
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

function SupportingInfoValue({ info }) {
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
        <span className="flex items-center gap-1">
          <FileText className="h-3 w-3" />
          {info.title || info.contentType || 'Attachment'}
          {info.hasData && <Badge className="text-xs bg-blue-100 text-blue-800">Has Data</Badge>}
        </span>
      );
    default:
      if (info.reason) {
        return <span className="text-orange-600">{info.reasonDisplay || info.reason}</span>;
      }
      return <span>-</span>;
  }
}
