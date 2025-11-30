import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import api from '@/services/api';
import { 
  ArrowLeft, Edit, Send, RefreshCw, XCircle, ArrowRightLeft,
  FileText, User, Building, Shield, Stethoscope, Receipt, 
  Clock, CheckCircle, AlertCircle, Calendar, DollarSign,
  Code, Activity, Paperclip, History, Eye, X
} from 'lucide-react';

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
      alert('Error loading prior authorization');
      navigate('/prior-authorizations');
    } finally {
      setLoading(false);
    }
  };

  const handleLoadBundle = async () => {
    try {
      setActionLoading(true);
      // Build bundle preview from current data
      const bundleData = {
        resourceType: 'Bundle',
        type: 'message',
        id: priorAuth.nphies_request_id || `pa-${priorAuth.id}`,
        entry: [
          {
            resource: {
              resourceType: 'MessageHeader',
              eventCoding: { code: 'priorauth-request', system: 'http://nphies.sa/terminology' }
            }
          },
          {
            resource: {
              resourceType: 'Claim',
              id: priorAuth.request_number,
              status: 'active',
              type: { coding: [{ code: 'preauthorization' }] },
              patient: { reference: `Patient/${priorAuth.patient_id}` },
              provider: { reference: `Organization/${priorAuth.provider_id}` },
              insurer: { reference: `Organization/${priorAuth.insurer_id}` }
            }
          }
        ]
      };
      setBundle(bundleData);
      setShowBundleDialog(true);
    } catch (error) {
      console.error('Error loading bundle:', error);
      alert(`Error: ${error.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleSendToNphies = async () => {
    if (!window.confirm('Send this prior authorization to NPHIES?')) return;
    
    try {
      setActionLoading(true);
      const response = await api.sendPriorAuthorizationToNphies(id);
      
      if (response.success) {
        alert(`Successfully sent to NPHIES!\nPre-Auth Ref: ${response.nphiesResponse?.preAuthRef || 'Pending'}`);
        await loadPriorAuthorization();
      } else {
        alert(`NPHIES Error: ${response.error?.message || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error sending to NPHIES:', error);
      alert(`Error: ${error.response?.data?.error || error.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handlePoll = async () => {
    try {
      setActionLoading(true);
      const response = await api.pollNphiesAuthorizationResponse(id);
      await loadPriorAuthorization();
      alert(response.message || 'Polling complete');
    } catch (error) {
      console.error('Error polling:', error);
      alert(`Error: ${error.response?.data?.error || error.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancel = async () => {
    try {
      setActionLoading(true);
      const response = await api.cancelNphiesAuthorization(id, { reason: cancelReason });
      
      if (response.success) {
        alert('Prior authorization cancelled successfully');
        setShowCancelDialog(false);
        await loadPriorAuthorization();
      } else {
        alert(`Error: ${response.error?.message || 'Failed to cancel'}`);
      }
    } catch (error) {
      console.error('Error cancelling:', error);
      alert(`Error: ${error.response?.data?.error || error.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleCreateUpdate = async () => {
    navigate(`/prior-authorizations/${id}/edit?update=true`);
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
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => navigate('/prior-authorizations')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold text-gray-900">
                {priorAuth.request_number || `PA-${priorAuth.id}`}
              </h1>
              {getStatusBadge(priorAuth.status)}
            </div>
            <p className="text-gray-600 mt-1">
              {getAuthTypeDisplay(priorAuth.auth_type)} Authorization
              {priorAuth.pre_auth_ref && (
                <span className="ml-2 text-green-600 font-mono">
                  • Pre-Auth Ref: {priorAuth.pre_auth_ref}
                </span>
              )}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleLoadBundle} disabled={actionLoading}>
            <Code className="h-4 w-4 mr-2" />
            View FHIR Bundle
          </Button>
          
          {(priorAuth.status === 'draft' || priorAuth.status === 'error') && (
            <>
              <Button variant="outline" onClick={() => navigate(`/prior-authorizations/${id}/edit`)}>
                <Edit className="h-4 w-4 mr-2" />
                Edit
              </Button>
              <Button onClick={handleSendToNphies} disabled={actionLoading} className="bg-blue-500 hover:bg-blue-600">
                <Send className="h-4 w-4 mr-2" />
                Send to NPHIES
              </Button>
            </>
          )}
          
          {priorAuth.status === 'queued' && (
            <Button onClick={handlePoll} disabled={actionLoading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${actionLoading ? 'animate-spin' : ''}`} />
              Poll Response
            </Button>
          )}
          
          {priorAuth.status === 'approved' && (
            <>
              <Button variant="outline" onClick={handleCreateUpdate} disabled={actionLoading}>
                <Edit className="h-4 w-4 mr-2" />
                Create Update
              </Button>
              <Button variant="outline" onClick={() => setShowCancelDialog(true)} className="text-red-500 border-red-300 hover:bg-red-50">
                <XCircle className="h-4 w-4 mr-2" />
                Cancel
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Main Details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Tabs */}
          <div className="flex gap-2 bg-gray-100 p-1 rounded-lg w-fit">
            <TabButton active={activeTab === 'details'} onClick={() => setActiveTab('details')}>
              Details
            </TabButton>
            <TabButton active={activeTab === 'items'} onClick={() => setActiveTab('items')}>
              Items ({priorAuth.items?.length || 0})
            </TabButton>
            <TabButton active={activeTab === 'clinical'} onClick={() => setActiveTab('clinical')}>
              Clinical
            </TabButton>
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
                  <div>
                    <Label className="text-gray-500">Encounter Class</Label>
                    <p className="font-medium">{getEncounterClassDisplay(priorAuth.encounter_class)}</p>
                  </div>
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
                {priorAuth.items && priorAuth.items.length > 0 ? (
                  <div className="space-y-4">
                    {priorAuth.items.map((item, index) => (
                      <div key={index} className="p-4 border rounded-lg bg-gray-50">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-primary-purple text-white flex items-center justify-center text-sm font-medium">
                              {item.sequence}
                            </div>
                            <div>
                              <p className="font-medium">{item.product_or_service_code}</p>
                              <p className="text-sm text-gray-500">{item.product_or_service_display || 'No description'}</p>
                            </div>
                          </div>
                          {item.adjudication_status && (
                            <Badge variant={item.adjudication_status === 'approved' ? 'default' : 'outline'} 
                                   className={item.adjudication_status === 'approved' ? 'bg-green-500' : ''}>
                              {item.adjudication_status}
                            </Badge>
                          )}
                        </div>
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
                          {item.adjudication_amount && (
                            <div>
                              <p className="text-gray-500">Approved Amount</p>
                              <p className="font-medium text-green-600">
                                {formatAmount(item.adjudication_amount, item.currency)}
                              </p>
                            </div>
                          )}
                        </div>
                        {(item.tooth_number || item.eye || item.days_supply) && (
                          <div className="mt-3 pt-3 border-t text-sm">
                            {item.tooth_number && <span className="mr-4">Tooth: {item.tooth_number}</span>}
                            {item.tooth_surface && <span className="mr-4">Surface: {item.tooth_surface}</span>}
                            {item.eye && <span className="mr-4">Eye: {item.eye}</span>}
                            {item.days_supply && <span>Days Supply: {item.days_supply}</span>}
                          </div>
                        )}
                      </div>
                    ))}
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
                <span className="font-medium">{formatAmount(priorAuth.total_amount, priorAuth.currency)}</span>
              </div>
              {priorAuth.approved_amount && (
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
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="font-medium">{priorAuth.patient_name || '-'}</p>
              <p className="text-sm text-gray-500">{priorAuth.patient_identifier}</p>
            </CardContent>
          </Card>

          {/* Provider Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Building className="h-5 w-5" />
                Provider
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="font-medium">{priorAuth.provider_name || '-'}</p>
              <p className="text-sm text-gray-500 font-mono">{priorAuth.provider_nphies_id}</p>
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
        title="FHIR Bundle"
        description="The FHIR R4 message bundle for this prior authorization request"
        footer={
          <>
            <Button variant="outline" onClick={() => setShowBundleDialog(false)}>Close</Button>
            <Button onClick={() => {
              navigator.clipboard.writeText(JSON.stringify(bundle, null, 2));
              alert('Copied to clipboard!');
            }}>
              Copy to Clipboard
            </Button>
          </>
        }
      >
        <pre className="bg-gray-900 text-green-400 p-4 rounded-lg text-sm overflow-auto max-h-[50vh]">
          {bundle ? JSON.stringify(bundle, null, 2) : 'Loading...'}
        </pre>
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
            <Label htmlFor="cancelReason">Cancellation Reason</Label>
            <textarea
              id="cancelReason"
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="Enter the reason for cancellation..."
              rows={3}
              className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-purple/30"
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}
