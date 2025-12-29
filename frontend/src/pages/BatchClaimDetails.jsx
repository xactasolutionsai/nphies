import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Package, ArrowLeft, Send, RefreshCw, Eye, Trash2, CheckCircle2, 
  AlertCircle, Clock, Building2, Shield, Calendar, DollarSign,
  FileText, Activity, Info, Copy, Download, Loader2, Calculator
} from 'lucide-react';
import api from '@/services/api';

export default function BatchClaimDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  
  const [batch, setBatch] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [pollingStatus, setPollingStatus] = useState(null);
  const [lastPollTime, setLastPollTime] = useState(null);
  // State for fresh FHIR bundles (fetched from preview API)
  const [freshBundles, setFreshBundles] = useState(null);
  const [bundlesLoading, setBundlesLoading] = useState(false);
  const [bundlesError, setBundlesError] = useState(null);
  const [copiedIndex, setCopiedIndex] = useState(null);
  const [viewMode, setViewMode] = useState('individual'); // 'individual' or 'full'

  useEffect(() => {
    loadBatchDetails();
  }, [id]);

  // Auto-load bundles when Request Bundle tab is selected
  useEffect(() => {
    if (activeTab === 'request' && !freshBundles && !bundlesLoading && !bundlesError) {
      loadFreshBundles();
    }
  }, [activeTab]);

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

  // Load fresh FHIR bundles from preview API (the exact JSON sent to NPHIES)
  const loadFreshBundles = async () => {
    try {
      setBundlesLoading(true);
      setBundlesError(null);
      const response = await api.previewBatchBundle(id);
      // response.data contains the array of bundles
      setFreshBundles(response.data || response);
    } catch (error) {
      console.error('Error loading fresh bundles:', error);
      setBundlesError(error.response?.data?.error || error.message || 'Failed to load bundles');
    } finally {
      setBundlesLoading(false);
    }
  };

  // Helper to clean bundle for copying (remove internal metadata)
  const cleanBundleForCopy = (bundle) => {
    if (!bundle) return bundle;
    const { _batchMetadata, ...clean } = bundle;
    return clean;
  };

  // Copy single bundle to clipboard
  const copySingleBundle = async (bundle, index) => {
    try {
      const cleanBundle = cleanBundleForCopy(bundle);
      await navigator.clipboard.writeText(JSON.stringify(cleanBundle, null, 2));
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
      alert('Failed to copy to clipboard');
    }
  };

  // Copy all bundles as formatted text showing each HTTP request
  const copyAllBundlesFormatted = async (bundles) => {
    try {
      const cleanBundles = bundles.map(cleanBundleForCopy);
      
      // Format as separate HTTP requests
      let formattedOutput = `// ==========================================\n`;
      formattedOutput += `// Batch Claim: ${batch?.batch_identifier}\n`;
      formattedOutput += `// Total HTTP Requests: ${cleanBundles.length}\n`;
      formattedOutput += `// Each bundle below is sent as a SEPARATE HTTP POST request\n`;
      formattedOutput += `// ==========================================\n\n`;
      
      cleanBundles.forEach((bundle, index) => {
        const batchNumber = bundle.entry?.find(e => e.resource?.resourceType === 'Claim')
          ?.resource?.extension?.find(ext => ext.url?.includes('extension-batch-number'))
          ?.valuePositiveInt || (index + 1);
        
        formattedOutput += `// ------------------------------------------\n`;
        formattedOutput += `// HTTP Request #${index + 1} (batch-number: ${batchNumber})\n`;
        formattedOutput += `// POST to NPHIES API\n`;
        formattedOutput += `// ------------------------------------------\n`;
        formattedOutput += JSON.stringify(bundle, null, 2);
        formattedOutput += `\n\n`;
      });
      
      await navigator.clipboard.writeText(formattedOutput);
      setCopiedIndex('all');
      setTimeout(() => setCopiedIndex(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
      alert('Failed to copy to clipboard');
    }
  };

  // Copy all bundles as JSON array (for reference)
  const copyAllBundlesAsArray = async (bundles) => {
    try {
      const cleanBundles = bundles.map(cleanBundleForCopy);
      await navigator.clipboard.writeText(JSON.stringify(cleanBundles, null, 2));
      setCopiedIndex('array');
      setTimeout(() => setCopiedIndex(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
      alert('Failed to copy to clipboard');
    }
  };

  // Download single bundle
  const downloadSingleBundle = (bundle, index) => {
    const cleanBundle = cleanBundleForCopy(bundle);
    const blob = new Blob([JSON.stringify(cleanBundle, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `batch-${batch?.batch_identifier}-bundle-${index + 1}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Download all bundles
  const downloadAllBundles = (bundles) => {
    const cleanBundles = bundles.map(cleanBundleForCopy);
    const blob = new Blob([JSON.stringify(cleanBundles, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `batch-${batch?.batch_identifier}-all-bundles.json`;
    a.click();
    URL.revokeObjectURL(url);
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

  const handlePreviewBundle = () => {
    // Navigate to the dedicated preview page
    navigate(`/claim-batches/${id}/preview`);
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

  const handleRecalculateStats = async () => {
    try {
      setActionLoading(true);
      const response = await api.recalculateBatchStatistics(id);
      if (response.success) {
        setBatch(response.data);
        alert('Statistics recalculated successfully!');
      } else {
        alert(response.error || 'Failed to recalculate statistics');
      }
    } catch (error) {
      console.error('Error recalculating statistics:', error);
      alert(error.response?.data?.error || 'Failed to recalculate statistics');
    } finally {
      setActionLoading(false);
    }
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
            {batch.response_bundle && (
              <Button 
                onClick={handleRecalculateStats} 
                disabled={actionLoading}
                variant="outline"
                title="Recalculate statistics from response data"
              >
                <Calculator className={`h-4 w-4 mr-2 ${actionLoading ? 'animate-spin' : ''}`} />
                Recalculate Stats
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
          <TabsTrigger 
            value="request" 
            className="data-[state=active]:bg-primary-purple data-[state=active]:text-white"
          >
            <Send className="h-4 w-4 mr-2" />
            Request Bundle
          </TabsTrigger>
          {batch.response_bundle && (
            <TabsTrigger value="response" className="data-[state=active]:bg-primary-purple data-[state=active]:text-white">
              <Activity className="h-4 w-4 mr-2" />
              Response Bundle
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

        {/* Request Bundle Tab - Shows exact JSON sent to NPHIES */}
        <TabsContent value="request">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center">
                    <Send className="h-5 w-5 mr-2" />
                    Request Bundles
                  </CardTitle>
                  <CardDescription>
                    Exact FHIR Bundles sent to NPHIES - Copy for Postman testing
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  {!freshBundles && !bundlesLoading && (
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={loadFreshBundles}
                    >
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Load Bundles
                    </Button>
                  )}
                  {freshBundles && Array.isArray(freshBundles) && (
                    <>
                      {/* View Mode Toggle */}
                      <div className="flex items-center bg-gray-100 rounded-lg p-1">
                        <button
                          onClick={() => setViewMode('individual')}
                          className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                            viewMode === 'individual' 
                              ? 'bg-white text-primary-purple shadow-sm' 
                              : 'text-gray-600 hover:text-gray-900'
                          }`}
                        >
                          Individual
                        </button>
                        <button
                          onClick={() => setViewMode('full')}
                          className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                            viewMode === 'full' 
                              ? 'bg-white text-primary-purple shadow-sm' 
                              : 'text-gray-600 hover:text-gray-900'
                          }`}
                        >
                          Full View
                        </button>
                      </div>
                      
                      {viewMode === 'full' && (
                        <>
                          <Button 
                            variant={copiedIndex === 'all' ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => copyAllBundlesFormatted(freshBundles)}
                            className={copiedIndex === 'all' ? 'bg-green-600 hover:bg-green-700 text-white' : ''}
                          >
                            {copiedIndex === 'all' ? (
                              <>
                                <CheckCircle2 className="h-4 w-4 mr-1" />
                                Copied!
                              </>
                            ) : (
                              <>
                                <Copy className="h-4 w-4 mr-1" />
                                Copy All (Formatted)
                              </>
                            )}
                          </Button>
                          <Button 
                            variant={copiedIndex === 'array' ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => copyAllBundlesAsArray(freshBundles)}
                            className={copiedIndex === 'array' ? 'bg-green-600 hover:bg-green-700 text-white' : ''}
                            title="Copy as JSON Array"
                          >
                            {copiedIndex === 'array' ? (
                              <CheckCircle2 className="h-4 w-4" />
                            ) : (
                              <>[ ]</>
                            )}
                          </Button>
                        </>
                      )}
                      
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={loadFreshBundles}
                        disabled={bundlesLoading}
                        title="Refresh bundles"
                      >
                        <RefreshCw className={`h-4 w-4 ${bundlesLoading ? 'animate-spin' : ''}`} />
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {/* Loading state */}
              {bundlesLoading && (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-primary-purple mr-3" />
                  <span className="text-gray-600">Loading FHIR bundles...</span>
                </div>
              )}

              {/* Error state */}
              {bundlesError && !bundlesLoading && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <div className="flex items-center">
                    <AlertCircle className="h-5 w-5 text-red-500 mr-2" />
                    <span className="text-red-700">{bundlesError}</span>
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={loadFreshBundles}
                    className="mt-3"
                  >
                    Try Again
                  </Button>
                </div>
              )}

              {/* Initial state - prompt to load */}
              {!freshBundles && !bundlesLoading && !bundlesError && (
                <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
                  <Send className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-700 mb-2">Load Request Bundles</h3>
                  <p className="text-gray-500 mb-4">
                    Click below to generate the exact FHIR bundles that will be sent to NPHIES
                  </p>
                  <Button onClick={loadFreshBundles}>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Generate Bundles
                  </Button>
                </div>
              )}

              {/* Bundles display */}
              {freshBundles && Array.isArray(freshBundles) && !bundlesLoading && (
                <div className="space-y-4">
                  {/* Batch Info Summary */}
                  <div className="bg-gray-100 rounded-lg p-3 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <Badge className="bg-primary-purple text-white">
                        {freshBundles.length} HTTP Requests
                      </Badge>
                      <span className="text-sm text-gray-600">
                        Batch: <code className="bg-white px-2 py-0.5 rounded font-mono text-xs">{batch?.batch_identifier}</code>
                      </span>
                    </div>
                    <span className="text-xs text-gray-500">
                      كل Bundle = HTTP Request منفصل
                    </span>
                  </div>

                  {/* Full View Mode - Show all bundles in one view */}
                  {viewMode === 'full' && (
                    <div className="border-2 border-primary-purple/30 rounded-lg overflow-hidden">
                      <div className="bg-gradient-to-r from-primary-purple to-accent-purple px-4 py-3 text-white">
                        <div className="flex items-center justify-between">
                          <div>
                            <h3 className="font-bold text-lg">Complete Batch Request</h3>
                            <p className="text-white/80 text-sm">
                              {freshBundles.length} HTTP Requests - Batch: {batch?.batch_identifier}
                            </p>
                          </div>
                          <Badge className="bg-white/20 text-white">
                            {(JSON.stringify(freshBundles.map(cleanBundleForCopy)).length / 1024).toFixed(1)} KB
                          </Badge>
                        </div>
                      </div>
                      <div className="bg-amber-50 border-b border-amber-200 px-4 py-2">
                        <p className="text-sm text-amber-800">
                          <strong>⚠️ ملاحظة:</strong> كل Bundle يُرسل في HTTP POST منفصل لـ NPHIES. الـ Comments تُظهر ترتيب الإرسال.
                        </p>
                      </div>
                      <pre className="bg-gray-900 text-green-400 p-4 overflow-x-auto text-sm font-mono leading-relaxed max-h-[600px] overflow-y-auto whitespace-pre-wrap break-all select-all">
{(() => {
  const cleanBundles = freshBundles.map(cleanBundleForCopy);
  let output = `// ==========================================\n`;
  output += `// Batch Claim: ${batch?.batch_identifier}\n`;
  output += `// Total HTTP Requests: ${cleanBundles.length}\n`;
  output += `// Each bundle below is sent as a SEPARATE HTTP POST request\n`;
  output += `// ==========================================\n\n`;
  
  cleanBundles.forEach((bundle, index) => {
    const batchNumber = bundle.entry?.find(e => e.resource?.resourceType === 'Claim')
      ?.resource?.extension?.find(ext => ext.url?.includes('extension-batch-number'))
      ?.valuePositiveInt || (index + 1);
    
    output += `// ------------------------------------------\n`;
    output += `// HTTP Request #${index + 1} (batch-number: ${batchNumber})\n`;
    output += `// POST to NPHIES API\n`;
    output += `// ------------------------------------------\n`;
    output += JSON.stringify(bundle, null, 2);
    output += `\n\n`;
  });
  
  return output;
})()}
                      </pre>
                    </div>
                  )}

                  {/* Individual View Mode - Show each bundle separately */}
                  {viewMode === 'individual' && (
                    <>
                      {/* Important Warning */}
                      <div className="bg-amber-50 border-2 border-amber-300 rounded-lg p-4">
                        <div className="flex items-start gap-3">
                          <AlertCircle className="h-6 w-6 text-amber-600 flex-shrink-0 mt-0.5" />
                          <div>
                            <p className="font-bold text-amber-800 text-base mb-2">
                              ⚠️ هام جداً - كيفية إرسال Batch Claim لـ NPHIES
                            </p>
                            <ul className="text-sm text-amber-700 space-y-1 list-disc list-inside">
                              <li><strong>كل Bundle يُرسل في HTTP Request منفصل</strong></li>
                              <li>استخدم زر <strong>"Copy This Bundle"</strong> لكل Bundle</li>
                              <li>الـ Bundles مرتبطة ببعض عبر <code className="bg-amber-200 px-1 rounded">batch-identifier</code></li>
                            </ul>
                          </div>
                        </div>
                      </div>
                  
                      {freshBundles.map((bundle, index) => {
                    const cleanBundle = cleanBundleForCopy(bundle);
                    const batchNumber = cleanBundle.entry?.find(e => e.resource?.resourceType === 'Claim')
                      ?.resource?.extension?.find(ext => ext.url?.includes('extension-batch-number'))
                      ?.valuePositiveInt || (index + 1);
                    
                    return (
                      <div key={index} className="border-2 border-gray-200 rounded-lg overflow-hidden hover:border-primary-purple/50 transition-colors">
                        <div className="bg-gradient-to-r from-gray-100 to-gray-50 px-4 py-3 flex justify-between items-center">
                          <div className="flex items-center gap-3">
                            <div className="bg-primary-purple text-white rounded-full w-8 h-8 flex items-center justify-center font-bold text-sm">
                              {index + 1}
                            </div>
                            <div>
                              <span className="font-semibold text-gray-800">
                                HTTP Request #{index + 1}
                              </span>
                              <span className="text-gray-500 text-sm ml-2">
                                (batch-number: {batchNumber})
                              </span>
                            </div>
                            <Badge variant="secondary" className="text-xs">
                              {cleanBundle.entry?.length || 0} resources
                            </Badge>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button 
                              variant={copiedIndex === index ? 'default' : 'default'}
                              size="sm"
                              onClick={() => copySingleBundle(bundle, index)}
                              className={copiedIndex === index 
                                ? 'bg-green-600 hover:bg-green-700 text-white' 
                                : 'bg-primary-purple hover:bg-primary-purple/90 text-white'}
                            >
                              {copiedIndex === index ? (
                                <>
                                  <CheckCircle2 className="h-4 w-4 mr-1" />
                                  ✓ Copied!
                                </>
                              ) : (
                                <>
                                  <Copy className="h-4 w-4 mr-1" />
                                  Copy This Bundle
                                </>
                              )}
                            </Button>
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => downloadSingleBundle(bundle, index)}
                            >
                              <Download className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                        <pre className="bg-gray-900 text-green-400 p-4 overflow-x-auto text-sm font-mono leading-relaxed max-h-[400px] overflow-y-auto whitespace-pre-wrap break-all select-all">
                          {JSON.stringify(cleanBundle, null, 2)}
                        </pre>
                      </div>
                    );
                      })}
                    </>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Response Bundle Tab */}
        {batch.response_bundle && (
          <TabsContent value="response">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                <CardTitle className="flex items-center">
                  <Activity className="h-5 w-5 mr-2" />
                      Response Bundle
                </CardTitle>
                    <CardDescription>FHIR Bundle received from NPHIES</CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => {
                        const data = typeof batch.response_bundle === 'string' 
                          ? batch.response_bundle 
                          : JSON.stringify(batch.response_bundle, null, 2);
                        navigator.clipboard.writeText(data);
                        alert('Response bundle copied to clipboard!');
                      }}
                    >
                      <Copy className="h-4 w-4 mr-2" />
                      Copy
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => {
                        const data = typeof batch.response_bundle === 'string' 
                          ? batch.response_bundle 
                          : JSON.stringify(batch.response_bundle, null, 2);
                        const blob = new Blob([data], { type: 'application/json' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `batch-${batch.batch_identifier}-response.json`;
                        a.click();
                        URL.revokeObjectURL(url);
                      }}
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Download
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <pre className="bg-gray-900 text-green-400 p-4 rounded-lg overflow-x-auto text-sm max-h-[600px] overflow-y-auto whitespace-pre-wrap break-all select-all">
                  {typeof batch.response_bundle === 'string' 
                    ? batch.response_bundle 
                    : JSON.stringify(batch.response_bundle, null, 2)}
                </pre>
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}

