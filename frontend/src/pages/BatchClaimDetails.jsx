import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Package, ArrowLeft, Send, RefreshCw, Eye, Trash2, CheckCircle2, 
  AlertCircle, Clock, Building2, Shield, Calendar, DollarSign,
  FileText, Activity, Info, X, Download, Copy
} from 'lucide-react';
import api from '@/services/api';

export default function BatchClaimDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  
  const [batch, setBatch] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [showBundlePreview, setShowBundlePreview] = useState(false);
  const [bundlePreview, setBundlePreview] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [pollingStatus, setPollingStatus] = useState(null);
  const [lastPollTime, setLastPollTime] = useState(null);

  useEffect(() => {
    loadBatchDetails();
  }, [id]);

  const loadBatchDetails = async () => {
    try {
      setLoading(true);
      const response = await api.getClaimBatch(id);
      setBatch(response.data);
    } catch (error) {
      console.error('Error loading batch details:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSendToNphies = async () => {
    if (!confirm('Are you sure you want to submit this batch to NPHIES?')) return;

    try {
      setActionLoading(true);
      const response = await api.sendBatchToNphies(id);
      
      if (response.success) {
        alert(response.message || 'Batch submitted successfully');
        loadBatchDetails();
      } else {
        alert(response.error || 'Failed to submit batch');
      }
    } catch (error) {
      console.error('Error sending batch to NPHIES:', error);
      alert(error.response?.data?.error || 'Failed to submit batch');
    } finally {
      setActionLoading(false);
    }
  };

  const handlePollResponses = async () => {
    try {
      setActionLoading(true);
      setPollingStatus('Polling NPHIES for responses...');
      
      const response = await api.pollBatchResponses(id);
      
      if (response.success) {
        setPollingStatus(response.pollResult?.message || 'Poll completed');
        setLastPollTime(new Date().toISOString());
        loadBatchDetails();
      } else {
        setPollingStatus('Poll failed: ' + (response.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Error polling responses:', error);
      setPollingStatus('Poll failed: ' + (error.response?.data?.error || 'Unknown error'));
    } finally {
      setActionLoading(false);
    }
  };

  const handlePreviewBundle = async () => {
    try {
      setActionLoading(true);
      const response = await api.previewBatchBundle(id);
      setBundlePreview(response.data);
      setShowBundlePreview(true);
    } catch (error) {
      console.error('Error previewing bundle:', error);
      alert(error.response?.data?.error || 'Failed to preview bundle');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteBatch = async () => {
    if (!confirm('Are you sure you want to delete this batch? Claims will be removed from the batch but not deleted.')) return;

    try {
      setActionLoading(true);
      await api.deleteClaimBatch(id);
      navigate('/claim-batches');
    } catch (error) {
      console.error('Error deleting batch:', error);
      alert(error.response?.data?.error || 'Failed to delete batch');
    } finally {
      setActionLoading(false);
    }
  };

  const copyBundleToClipboard = () => {
    navigator.clipboard.writeText(JSON.stringify(bundlePreview, null, 2));
    alert('Bundle copied to clipboard');
  };

  const downloadBundle = () => {
    const blob = new Blob([JSON.stringify(bundlePreview, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `batch-${batch?.batch_identifier || id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getStatusBadge = (status) => {
    const variants = {
      'Processed': 'default',
      'Partial': 'default',
      'Pending': 'secondary',
      'Submitted': 'secondary',
      'Queued': 'secondary',
      'Draft': 'outline',
      'Rejected': 'destructive',
      'Error': 'destructive'
    };
    return variants[status] || 'outline';
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'Processed': return <CheckCircle2 className="h-5 w-5 text-green-500" />;
      case 'Partial': return <CheckCircle2 className="h-5 w-5 text-yellow-500" />;
      case 'Pending':
      case 'Submitted':
      case 'Queued': return <Clock className="h-5 w-5 text-blue-500" />;
      case 'Draft': return <FileText className="h-5 w-5 text-gray-500" />;
      case 'Rejected':
      case 'Error': return <AlertCircle className="h-5 w-5 text-red-500" />;
      default: return <Info className="h-5 w-5 text-gray-500" />;
    }
  };

  const getClaimStatusBadge = (status) => {
    const variants = {
      'Approved': 'default',
      'approved': 'default',
      'queued': 'secondary',
      'Queued': 'secondary',
      'pended': 'secondary',
      'Pended': 'secondary',
      'complete': 'default',
      'Complete': 'default',
      'error': 'destructive',
      'Error': 'destructive',
      'Rejected': 'destructive',
      'rejected': 'destructive'
    };
    return variants[status] || 'outline';
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

  if (!batch) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <AlertCircle className="h-16 w-16 text-red-500 mb-4" />
        <h2 className="text-xl font-semibold text-gray-700">Batch Not Found</h2>
        <p className="text-gray-500 mt-2">The requested batch could not be found.</p>
        <Button onClick={() => navigate('/claim-batches')} className="mt-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Batches
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="relative bg-white rounded-2xl p-8 border border-gray-100">
        <Button 
          variant="ghost" 
          onClick={() => navigate('/claim-batches')}
          className="absolute top-4 left-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>

        <div className="flex items-center justify-between pt-8">
          <div>
            <div className="flex items-center space-x-3">
              {getStatusIcon(batch.status)}
              <h1 className="text-3xl font-bold text-gray-900">{batch.batch_identifier}</h1>
              <Badge variant={getStatusBadge(batch.status)} className="text-sm">
                {batch.status}
              </Badge>
            </div>
            <p className="text-gray-600 mt-2">{batch.description || 'No description'}</p>
            <div className="flex items-center space-x-4 mt-4 text-sm text-gray-500">
              <div className="flex items-center">
                <Calendar className="h-4 w-4 mr-1" />
                Created: {new Date(batch.created_at).toLocaleString()}
              </div>
              {batch.submission_date && (
                <div className="flex items-center">
                  <Send className="h-4 w-4 mr-1" />
                  Submitted: {new Date(batch.submission_date).toLocaleString()}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center space-x-3">
            {batch.status === 'Draft' && (
              <>
                <Button variant="outline" onClick={handlePreviewBundle} disabled={actionLoading}>
                  <Eye className="h-4 w-4 mr-2" />
                  Preview Bundle
                </Button>
                <Button 
                  onClick={handleSendToNphies} 
                  disabled={actionLoading}
                  className="bg-gradient-to-r from-primary-purple to-accent-purple"
                >
                  <Send className="h-4 w-4 mr-2" />
                  Send to NPHIES
                </Button>
                <Button variant="destructive" onClick={handleDeleteBatch} disabled={actionLoading}>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </Button>
              </>
            )}
            {['Submitted', 'Queued', 'Partial'].includes(batch.status) && (
              <Button 
                onClick={handlePollResponses} 
                disabled={actionLoading}
                variant="outline"
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${actionLoading ? 'animate-spin' : ''}`} />
                Poll Responses
              </Button>
            )}
          </div>
        </div>

        {/* Polling Status */}
        {pollingStatus && (
          <div className={`mt-4 p-3 rounded-lg ${pollingStatus.includes('failed') ? 'bg-red-50 text-red-700' : 'bg-blue-50 text-blue-700'}`}>
            <div className="flex items-center">
              <Activity className="h-4 w-4 mr-2" />
              {pollingStatus}
              {lastPollTime && (
                <span className="ml-4 text-sm opacity-75">
                  Last poll: {new Date(lastPollTime).toLocaleTimeString()}
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
        <Card className="bg-gradient-to-br from-blue-50 to-white">
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-sm text-gray-500">Total Claims</p>
              <p className="text-3xl font-bold text-blue-600">{batch.total_claims || batch.claims?.length || 0}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-purple-50 to-white">
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-sm text-gray-500">Total Amount</p>
              <p className="text-2xl font-bold text-purple-600">SAR {parseFloat(batch.total_amount || 0).toLocaleString()}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-green-50 to-white">
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-sm text-gray-500">Approved</p>
              <p className="text-3xl font-bold text-green-600">{batch.approved_claims || batch.statistics?.approved_claims || 0}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-yellow-50 to-white">
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-sm text-gray-500">Pending</p>
              <p className="text-3xl font-bold text-yellow-600">{batch.pending_claims || batch.statistics?.pending_claims || 0}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-red-50 to-white">
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-sm text-gray-500">Rejected</p>
              <p className="text-3xl font-bold text-red-600">{batch.rejected_claims || batch.statistics?.rejected_claims || 0}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-cyan-50 to-white">
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-sm text-gray-500">Approved Amount</p>
              <p className="text-2xl font-bold text-cyan-600">SAR {parseFloat(batch.approved_amount || batch.statistics?.total_approved_amount || 0).toLocaleString()}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Provider & Insurer Info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center space-x-4">
              <div className="bg-purple-100 p-3 rounded-lg">
                <Building2 className="h-8 w-8 text-primary-purple" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Provider</p>
                <p className="text-xl font-semibold">{batch.provider_name}</p>
                {batch.provider_license && (
                  <p className="text-sm text-gray-400">License: {batch.provider_license}</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center space-x-4">
              <div className="bg-cyan-100 p-3 rounded-lg">
                <Shield className="h-8 w-8 text-accent-cyan" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Insurer</p>
                <p className="text-xl font-semibold">{batch.insurer_name}</p>
                {batch.insurer_nphies_id && (
                  <p className="text-sm text-gray-400">NPHIES ID: {batch.insurer_nphies_id}</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="bg-white border">
          <TabsTrigger value="overview" className="data-[state=active]:bg-primary-purple data-[state=active]:text-white">
            <Package className="h-4 w-4 mr-2" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="claims" className="data-[state=active]:bg-primary-purple data-[state=active]:text-white">
            <FileText className="h-4 w-4 mr-2" />
            Claims ({batch.claims?.length || 0})
          </TabsTrigger>
          {batch.errors && batch.errors.length > 0 && (
            <TabsTrigger value="errors" className="data-[state=active]:bg-primary-purple data-[state=active]:text-white">
              <AlertCircle className="h-4 w-4 mr-2" />
              Errors ({batch.errors.length})
            </TabsTrigger>
          )}
          {batch.nphies_response && (
            <TabsTrigger value="response" className="data-[state=active]:bg-primary-purple data-[state=active]:text-white">
              <Activity className="h-4 w-4 mr-2" />
              NPHIES Response
            </TabsTrigger>
          )}
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview">
          <Card>
            <CardHeader>
              <CardTitle>Batch Information</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                <div>
                  <p className="text-sm text-gray-500">Batch Identifier</p>
                  <p className="font-semibold">{batch.batch_identifier}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">NPHIES Request ID</p>
                  <p className="font-semibold">{batch.nphies_request_id || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">NPHIES Response ID</p>
                  <p className="font-semibold">{batch.nphies_response_id || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Batch Period</p>
                  <p className="font-semibold">
                    {batch.batch_period_start ? new Date(batch.batch_period_start).toLocaleDateString() : '-'} 
                    {' - '} 
                    {batch.batch_period_end ? new Date(batch.batch_period_end).toLocaleDateString() : '-'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Submission Date</p>
                  <p className="font-semibold">{batch.submission_date ? new Date(batch.submission_date).toLocaleString() : '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Processed Date</p>
                  <p className="font-semibold">{batch.processed_date ? new Date(batch.processed_date).toLocaleString() : '-'}</p>
                </div>
              </div>

              {/* Progress Bar */}
              {batch.total_claims > 0 && (
                <div className="mt-8">
                  <p className="text-sm text-gray-500 mb-2">Processing Progress</p>
                  <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden">
                    <div className="h-full flex">
                      <div 
                        className="bg-green-500 h-full transition-all duration-500" 
                        style={{ width: `${((batch.approved_claims || 0) / batch.total_claims) * 100}%` }}
                      />
                      <div 
                        className="bg-red-500 h-full transition-all duration-500" 
                        style={{ width: `${((batch.rejected_claims || 0) / batch.total_claims) * 100}%` }}
                      />
                      <div 
                        className="bg-yellow-500 h-full transition-all duration-500" 
                        style={{ width: `${((batch.pending_claims || 0) / batch.total_claims) * 100}%` }}
                      />
                    </div>
                  </div>
                  <div className="flex justify-between mt-2 text-xs text-gray-500">
                    <span className="flex items-center">
                      <div className="w-3 h-3 bg-green-500 rounded mr-1"></div>
                      Approved ({batch.approved_claims || 0})
                    </span>
                    <span className="flex items-center">
                      <div className="w-3 h-3 bg-red-500 rounded mr-1"></div>
                      Rejected ({batch.rejected_claims || 0})
                    </span>
                    <span className="flex items-center">
                      <div className="w-3 h-3 bg-yellow-500 rounded mr-1"></div>
                      Pending ({batch.pending_claims || 0})
                    </span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Claims Tab */}
        <TabsContent value="claims">
          <Card>
            <CardHeader>
              <CardTitle>Claims in Batch</CardTitle>
              <CardDescription>All claims included in this batch submission</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">#</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Claim Number</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Patient</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Type</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Amount</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Approved</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Status</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {batch.claims && batch.claims.length > 0 ? (
                      batch.claims.map((claim, index) => (
                        <tr key={claim.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm">{claim.batch_number || index + 1}</td>
                          <td className="px-4 py-3 text-sm font-medium">{claim.claim_number}</td>
                          <td className="px-4 py-3 text-sm">{claim.patient_name}</td>
                          <td className="px-4 py-3 text-sm">{claim.claim_type}</td>
                          <td className="px-4 py-3 text-sm">SAR {parseFloat(claim.total_amount || 0).toLocaleString()}</td>
                          <td className="px-4 py-3 text-sm text-green-600">
                            {claim.approved_amount ? `SAR ${parseFloat(claim.approved_amount).toLocaleString()}` : '-'}
                          </td>
                          <td className="px-4 py-3">
                            <Badge variant={getClaimStatusBadge(claim.status)}>{claim.status}</Badge>
                          </td>
                          <td className="px-4 py-3">
                            <Button 
                              size="sm" 
                              variant="ghost"
                              onClick={() => navigate(`/claim-submissions/${claim.id}`)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                          No claims in this batch
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Errors Tab */}
        {batch.errors && batch.errors.length > 0 && (
          <TabsContent value="errors">
            <Card>
              <CardHeader>
                <CardTitle className="text-red-600 flex items-center">
                  <AlertCircle className="h-5 w-5 mr-2" />
                  Errors
                </CardTitle>
                <CardDescription>Errors returned from NPHIES</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {batch.errors.map((error, index) => (
                    <div key={index} className="bg-red-50 border border-red-200 rounded-lg p-4">
                      <div className="flex items-start">
                        <AlertCircle className="h-5 w-5 text-red-500 mr-3 mt-0.5" />
                        <div>
                          {error.code && (
                            <p className="font-semibold text-red-700">[{error.code}]</p>
                          )}
                          <p className="text-red-600">{error.message || error.diagnostics}</p>
                          {error.location && (
                            <p className="text-sm text-red-400 mt-1">Location: {error.location}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* NPHIES Response Tab */}
        {batch.nphies_response && (
          <TabsContent value="response">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Activity className="h-5 w-5 mr-2" />
                  NPHIES Response
                </CardTitle>
                <CardDescription>Raw response from NPHIES</CardDescription>
              </CardHeader>
              <CardContent>
                <pre className="bg-gray-900 text-green-400 p-4 rounded-lg overflow-x-auto text-sm max-h-96">
                  {typeof batch.nphies_response === 'string' 
                    ? batch.nphies_response 
                    : JSON.stringify(batch.nphies_response, null, 2)}
                </pre>
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>

      {/* Bundle Preview Modal */}
      {showBundlePreview && bundlePreview && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-5xl w-full max-h-[90vh] overflow-hidden">
            <div className="bg-gradient-to-r from-primary-purple to-accent-purple p-6 text-white">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-2xl font-bold">FHIR Bundle Preview</h2>
                  <p className="text-white/80 mt-1">This is what will be sent to NPHIES</p>
                </div>
                <button onClick={() => setShowBundlePreview(false)} className="text-white/80 hover:text-white p-2">
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>
            <div className="p-6 overflow-y-auto max-h-[60vh]">
              <pre className="bg-gray-900 text-green-400 p-4 rounded-lg overflow-x-auto text-sm">
                {JSON.stringify(bundlePreview, null, 2)}
              </pre>
            </div>
            <div className="bg-gray-50 px-6 py-4 border-t flex justify-between items-center">
              <div className="text-sm text-gray-500">
                Bundle Type: {bundlePreview.type} | Entries: {bundlePreview.entry?.length || 0}
              </div>
              <div className="flex space-x-3">
                <Button variant="outline" onClick={copyBundleToClipboard}>
                  <Copy className="h-4 w-4 mr-2" />
                  Copy
                </Button>
                <Button variant="outline" onClick={downloadBundle}>
                  <Download className="h-4 w-4 mr-2" />
                  Download
                </Button>
                <Button variant="outline" onClick={() => setShowBundlePreview(false)}>Close</Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

