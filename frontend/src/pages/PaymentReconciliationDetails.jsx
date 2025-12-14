import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  ArrowLeft, 
  Wallet, 
  Building2, 
  Calendar, 
  FileText,
  DollarSign,
  Receipt,
  AlertCircle,
  CheckCircle,
  Clock,
  ExternalLink,
  Download,
  Copy,
  ChevronDown,
  ChevronUp,
  Minus,
  Plus,
  FileJson,
  Send,
  Eye,
  RefreshCw
} from 'lucide-react';
import api from '@/services/api';

export default function PaymentReconciliationDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [reconciliation, setReconciliation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expandedDetails, setExpandedDetails] = useState({});
  const [showRawBundle, setShowRawBundle] = useState(false);
  const [sendingAck, setSendingAck] = useState(false);
  const [showPreviewDialog, setShowPreviewDialog] = useState(false);
  const [previewBundle, setPreviewBundle] = useState(null);

  useEffect(() => {
    loadReconciliation();
  }, [id]);

  const loadReconciliation = async () => {
    try {
      setLoading(true);
      const response = await api.getPaymentReconciliation(id);
      setReconciliation(response.data || null);
    } catch (error) {
      console.error('Error loading reconciliation:', error);
    } finally {
      setLoading(false);
    }
  };
  
  const handleSendAcknowledgement = async () => {
    if (!confirm('Send Payment Notice acknowledgement to NPHIES?\n\nThis will notify NPHIES that you have received and processed this payment reconciliation.')) {
      return;
    }
    
    try {
      setSendingAck(true);
      const response = await api.sendPaymentNoticeAcknowledgement(id);
      
      if (response.success) {
        alert('Payment Notice sent successfully to NPHIES!');
        await loadReconciliation(); // Reload to show updated status
      } else {
        alert(`Failed to send Payment Notice: ${response.error}`);
      }
    } catch (error) {
      console.error('Error sending acknowledgement:', error);
      alert(`Error sending Payment Notice: ${error.message}`);
    } finally {
      setSendingAck(false);
    }
  };
  
  const handlePreviewAcknowledgement = async () => {
    try {
      const response = await api.previewPaymentNotice(id);
      if (response.success) {
        setPreviewBundle(response.data.bundle);
        setShowPreviewDialog(true);
      } else {
        alert(`Failed to preview: ${response.error}`);
      }
    } catch (error) {
      console.error('Error previewing acknowledgement:', error);
      alert(`Error: ${error.message}`);
    }
  };
  
  const copyBundleToClipboard = (bundle) => {
    navigator.clipboard.writeText(JSON.stringify(bundle, null, 2));
    alert('Bundle copied to clipboard!');
  };

  const toggleDetailExpand = (detailId) => {
    setExpandedDetails(prev => ({
      ...prev,
      [detailId]: !prev[detailId]
    }));
  };

  const formatCurrency = (amount, currency = 'SAR') => {
    if (amount === null || amount === undefined) return '-';
    return new Intl.NumberFormat('en-SA', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2
    }).format(amount);
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatDateTime = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusBadge = (status) => {
    const config = {
      'active': { variant: 'default', icon: CheckCircle, color: 'text-emerald-600' },
      'cancelled': { variant: 'destructive', icon: AlertCircle, color: 'text-red-600' },
      'draft': { variant: 'secondary', icon: Clock, color: 'text-gray-600' },
      'entered-in-error': { variant: 'outline', icon: AlertCircle, color: 'text-amber-600' }
    };
    return config[status] || { variant: 'outline', icon: Clock, color: 'text-gray-600' };
  };

  const getComponentIcon = (type) => {
    const icons = {
      'payment': { icon: DollarSign, color: 'text-emerald-600', bg: 'bg-emerald-100' },
      'early_fee': { icon: Clock, color: 'text-purple-600', bg: 'bg-purple-100' },
      'nphies_fee': { icon: AlertCircle, color: 'text-amber-600', bg: 'bg-amber-100' },
      'other': { icon: FileText, color: 'text-gray-600', bg: 'bg-gray-100' }
    };
    return icons[type] || icons['other'];
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
  };

  const downloadBundle = async () => {
    try {
      const response = await api.getPaymentReconciliationBundle(id);
      const blob = new Blob([JSON.stringify(response.data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `payment-reconciliation-${reconciliation.fhir_id}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading bundle:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="relative">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-emerald-500/20"></div>
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-transparent border-t-emerald-500 absolute top-0"></div>
        </div>
      </div>
    );
  }

  if (!reconciliation) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="h-16 w-16 mx-auto text-gray-400 mb-4" />
        <h2 className="text-xl font-semibold text-gray-900">Reconciliation Not Found</h2>
        <p className="text-gray-500 mt-2">The requested payment reconciliation could not be found.</p>
        <Button onClick={() => navigate('/payment-reconciliations')} className="mt-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to List
        </Button>
      </div>
    );
  }

  const statusConfig = getStatusBadge(reconciliation.status);
  const StatusIcon = statusConfig.icon;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button variant="outline" onClick={() => navigate('/payment-reconciliations')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Payment Reconciliation</h1>
            <p className="text-gray-500 font-mono">{reconciliation.fhir_id}</p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          {/* Payment Notice Actions */}
          {reconciliation.acknowledgement_status !== 'sent' ? (
            <>
              <Button 
                onClick={handlePreviewAcknowledgement}
                variant="outline"
                className="border-purple-500 text-purple-600 hover:bg-purple-50"
              >
                <Eye className="h-4 w-4 mr-2" />
                Preview Payment Notice
              </Button>
              <Button 
                onClick={handleSendAcknowledgement}
                disabled={sendingAck}
                className="bg-purple-600 hover:bg-purple-700 text-white"
              >
                {sendingAck ? (
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Send className="h-4 w-4 mr-2" />
                )}
                {sendingAck ? 'Sending...' : 'Send Payment Notice'}
              </Button>
            </>
          ) : (
            <Badge className="bg-green-100 text-green-800 border-green-300">
              <CheckCircle className="h-4 w-4 mr-1" />
              Payment Notice Sent
            </Badge>
          )}
          
          <Button variant="outline" onClick={downloadBundle}>
            <Download className="h-4 w-4 mr-2" />
            Download FHIR Bundle
          </Button>
          <Button variant="outline" onClick={() => setShowRawBundle(!showRawBundle)}>
            <FileJson className="h-4 w-4 mr-2" />
            {showRawBundle ? 'Hide' : 'View'} Raw JSON
          </Button>
        </div>
      </div>

      {/* Status Banner */}
      <Card className={`border-l-4 ${
        reconciliation.status === 'active' ? 'border-l-emerald-500 bg-emerald-50' :
        reconciliation.status === 'cancelled' ? 'border-l-red-500 bg-red-50' :
        'border-l-gray-500 bg-gray-50'
      }`}>
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <StatusIcon className={`h-6 w-6 ${statusConfig.color}`} />
              <div>
                <p className="font-semibold text-gray-900">
                  Status: <span className="capitalize">{reconciliation.status}</span>
                </p>
                <p className="text-sm text-gray-600">
                  {reconciliation.disposition || 'No disposition message'}
                </p>
              </div>
            </div>
            <Badge variant={statusConfig.variant} className="text-sm">
              {reconciliation.processing_status}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Main Info Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Payment Summary */}
        <Card className="lg:col-span-2 bg-gradient-to-br from-emerald-500 to-teal-600 text-white border-0">
          <CardHeader>
            <CardTitle className="flex items-center text-white">
              <Wallet className="h-5 w-5 mr-2" />
              Payment Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-6">
              <div>
                <p className="text-emerald-100 text-sm">Total Payment Amount</p>
                <p className="text-4xl font-bold mt-1">
                  {formatCurrency(reconciliation.payment_amount, reconciliation.payment_currency)}
                </p>
              </div>
              <div>
                <p className="text-emerald-100 text-sm">Payment Date</p>
                <p className="text-2xl font-semibold mt-1">
                  {formatDate(reconciliation.payment_date)}
                </p>
              </div>
              <div>
                <p className="text-emerald-100 text-sm">Payment Reference</p>
                <p className="text-lg font-mono mt-1 flex items-center">
                  {reconciliation.payment_identifier_value || '-'}
                  {reconciliation.payment_identifier_value && (
                    <button 
                      onClick={() => copyToClipboard(reconciliation.payment_identifier_value)}
                      className="ml-2 hover:text-emerald-200"
                    >
                      <Copy className="h-4 w-4" />
                    </button>
                  )}
                </p>
              </div>
              <div>
                <p className="text-emerald-100 text-sm">Payment Method</p>
                <p className="text-lg font-semibold mt-1 uppercase">
                  {reconciliation.payment_method_code || 'Not specified'}
                </p>
              </div>
            </div>
            {reconciliation.period_start && (
              <div className="mt-6 pt-4 border-t border-emerald-400/30">
                <p className="text-emerald-100 text-sm">Period</p>
                <p className="text-lg mt-1">
                  {formatDate(reconciliation.period_start)} — {formatDate(reconciliation.period_end)}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Organizations */}
        <Card className="bg-white border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center text-gray-900">
              <Building2 className="h-5 w-5 mr-2 text-blue-600" />
              Organizations
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 bg-blue-50 rounded-lg">
              <p className="text-sm text-blue-600 font-medium">Payment Issuer (Insurer)</p>
              <p className="text-lg font-semibold text-gray-900 mt-1">
                {reconciliation.insurer_name || 'Unknown Insurer'}
              </p>
              {reconciliation.insurer_nphies_id && (
                <p className="text-sm text-gray-500 font-mono mt-1">
                  ID: {reconciliation.insurer_nphies_id}
                </p>
              )}
            </div>
            <div className="p-4 bg-emerald-50 rounded-lg">
              <p className="text-sm text-emerald-600 font-medium">Requestor (Provider)</p>
              <p className="text-lg font-semibold text-gray-900 mt-1">
                {reconciliation.provider_name || 'Unknown Provider'}
              </p>
              {reconciliation.provider_nphies_id && (
                <p className="text-sm text-gray-500 font-mono mt-1">
                  ID: {reconciliation.provider_nphies_id}
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Payment Details */}
      <Card className="bg-white border-0 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center text-gray-900">
              <Receipt className="h-5 w-5 mr-2 text-emerald-600" />
              Payment Details ({reconciliation.details?.length || 0} claims)
            </div>
            <div className="text-sm font-normal text-gray-500">
              Click to expand and see fee components
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {reconciliation.details && reconciliation.details.length > 0 ? (
            <div className="space-y-4">
              {reconciliation.details.map((detail, index) => {
                const isExpanded = expandedDetails[detail.id];
                return (
                  <div 
                    key={detail.id} 
                    className="border border-gray-200 rounded-xl overflow-hidden hover:border-emerald-300 transition-colors"
                  >
                    {/* Detail Header */}
                    <div 
                      className="p-4 bg-gray-50 cursor-pointer flex items-center justify-between"
                      onClick={() => toggleDetailExpand(detail.id)}
                    >
                      <div className="flex items-center space-x-4">
                        <div className="bg-emerald-100 rounded-lg p-2">
                          <FileText className="h-5 w-5 text-emerald-600" />
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900">
                            Claim: {detail.claim_identifier_value || 'Unknown'}
                          </p>
                          <p className="text-sm text-gray-500">
                            Sequence #{detail.sequence} • {detail.type_display || detail.type_code || 'Payment'}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-4">
                        <div className="text-right">
                          <p className="text-lg font-bold text-emerald-600">
                            {formatCurrency(detail.amount, detail.currency)}
                          </p>
                          <p className="text-sm text-gray-500">
                            {formatDate(detail.detail_date)}
                          </p>
                        </div>
                        {isExpanded ? (
                          <ChevronUp className="h-5 w-5 text-gray-400" />
                        ) : (
                          <ChevronDown className="h-5 w-5 text-gray-400" />
                        )}
                      </div>
                    </div>

                    {/* Expanded Content */}
                    {isExpanded && (
                      <div className="p-4 border-t border-gray-200">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                          {/* Claim Reference */}
                          <div className="p-3 bg-blue-50 rounded-lg">
                            <p className="text-sm text-blue-600 font-medium">Claim Reference</p>
                            <p className="font-mono text-sm mt-1 text-gray-900">
                              {detail.claim_identifier_value || detail.claim_reference || '-'}
                            </p>
                            {detail.linked_claim_number && (
                              <Badge variant="outline" className="mt-2 text-xs">
                                Linked to: {detail.linked_claim_number}
                              </Badge>
                            )}
                          </div>

                          {/* ClaimResponse Reference */}
                          <div className="p-3 bg-purple-50 rounded-lg">
                            <p className="text-sm text-purple-600 font-medium">ClaimResponse Reference</p>
                            <p className="font-mono text-sm mt-1 text-gray-900">
                              {detail.claim_response_identifier_value || detail.claim_response_reference || '-'}
                            </p>
                          </div>
                        </div>

                        {/* Fee Components */}
                        {detail.components && detail.components.length > 0 && (
                          <div>
                            <p className="text-sm font-semibold text-gray-700 mb-3">Fee Components</p>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                              {detail.components.map((component, compIndex) => {
                                const compConfig = getComponentIcon(component.component_type);
                                const CompIcon = compConfig.icon;
                                const isNegative = component.amount < 0;
                                
                                return (
                                  <div 
                                    key={compIndex}
                                    className={`p-3 rounded-lg border ${
                                      component.component_type === 'payment' ? 'border-emerald-200 bg-emerald-50' :
                                      component.component_type === 'nphies_fee' ? 'border-amber-200 bg-amber-50' :
                                      component.component_type === 'early_fee' ? 'border-purple-200 bg-purple-50' :
                                      'border-gray-200 bg-gray-50'
                                    }`}
                                  >
                                    <div className="flex items-center space-x-2 mb-2">
                                      <div className={`p-1.5 rounded ${compConfig.bg}`}>
                                        <CompIcon className={`h-4 w-4 ${compConfig.color}`} />
                                      </div>
                                      <span className="text-sm font-medium text-gray-700">
                                        {component.display_name}
                                      </span>
                                    </div>
                                    <p className={`text-xl font-bold ${
                                      isNegative ? 'text-red-600' : 'text-emerald-600'
                                    }`}>
                                      {isNegative && <Minus className="h-4 w-4 inline mr-1" />}
                                      {!isNegative && component.component_type === 'payment' && <Plus className="h-4 w-4 inline mr-1" />}
                                      {formatCurrency(Math.abs(component.amount), component.currency)}
                                    </p>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* Submitter/Payee */}
                        {(detail.submitter_reference || detail.payee_reference) && (
                          <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-gray-200">
                            {detail.submitter_reference && (
                              <div>
                                <p className="text-sm text-gray-500">Submitter</p>
                                <p className="text-sm font-mono text-gray-900">{detail.submitter_reference}</p>
                              </div>
                            )}
                            {detail.payee_reference && (
                              <div>
                                <p className="text-sm text-gray-500">Payee</p>
                                <p className="text-sm font-mono text-gray-900">{detail.payee_reference}</p>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-400">
              <Receipt className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No payment details available</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Metadata */}
      <Card className="bg-white border-0 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center text-gray-900">
            <Calendar className="h-5 w-5 mr-2 text-gray-600" />
            Processing Information
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-gray-500">Created Date</p>
              <p className="font-medium">{formatDateTime(reconciliation.created_date)}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Received At</p>
              <p className="font-medium">{formatDateTime(reconciliation.received_at)}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Processed At</p>
              <p className="font-medium">{formatDateTime(reconciliation.processed_at)}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">nphies Message ID</p>
              <p className="font-mono text-sm">{reconciliation.nphies_message_id || '-'}</p>
            </div>
          </div>
          
          {/* Acknowledgement Status */}
          <div className="mt-4 pt-4 border-t border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Payment Notice Status</p>
                {reconciliation.acknowledgement_status === 'sent' ? (
                  <div className="flex items-center mt-1">
                    <CheckCircle className="h-5 w-5 text-green-600 mr-2" />
                    <span className="font-medium text-green-600">Sent to NPHIES</span>
                    {reconciliation.acknowledgement_date && (
                      <span className="text-sm text-gray-500 ml-2">
                        on {formatDateTime(reconciliation.acknowledgement_date)}
                      </span>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center mt-1">
                    <Clock className="h-5 w-5 text-amber-500 mr-2" />
                    <span className="font-medium text-amber-600">Not yet sent</span>
                  </div>
                )}
              </div>
              {reconciliation.acknowledgement_bundle && (
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => {
                    setPreviewBundle(reconciliation.acknowledgement_bundle);
                    setShowPreviewDialog(true);
                  }}
                >
                  <Eye className="h-4 w-4 mr-2" />
                  View Sent Bundle
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Raw Bundle Modal */}
      {showRawBundle && reconciliation.request_bundle && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
            <div className="p-4 border-b flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">Raw FHIR Bundle</h3>
              <div className="flex items-center space-x-2">
                <Button variant="outline" size="sm" onClick={downloadBundle}>
                  <Download className="h-4 w-4 mr-2" />
                  Download
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setShowRawBundle(false)}>
                  Close
                </Button>
              </div>
            </div>
            <div className="p-4 overflow-auto max-h-[calc(90vh-80px)]">
              <pre className="text-xs bg-gray-900 text-emerald-400 p-4 rounded-lg overflow-auto">
                {JSON.stringify(reconciliation.request_bundle, null, 2)}
              </pre>
            </div>
          </div>
        </div>
      )}
      
      {/* Payment Notice Preview Modal */}
      {showPreviewDialog && previewBundle && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
            <div className="p-4 border-b flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">
                <Send className="h-5 w-5 inline mr-2 text-purple-600" />
                Payment Notice Bundle Preview
              </h3>
              <div className="flex items-center space-x-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => copyBundleToClipboard(previewBundle)}
                >
                  <Copy className="h-4 w-4 mr-2" />
                  Copy
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setShowPreviewDialog(false)}>
                  Close
                </Button>
              </div>
            </div>
            <div className="p-4 overflow-auto max-h-[calc(90vh-80px)]">
              <div className="mb-4 p-3 bg-purple-50 rounded-lg border border-purple-200">
                <p className="text-sm text-purple-800">
                  <strong>This is the FHIR PaymentNotice bundle that will be sent to NPHIES.</strong>
                  <br />
                  It acknowledges receipt of the PaymentReconciliation and confirms the payment has been processed.
                </p>
              </div>
              <pre className="text-xs bg-gray-900 text-purple-400 p-4 rounded-lg overflow-auto">
                {JSON.stringify(previewBundle, null, 2)}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

