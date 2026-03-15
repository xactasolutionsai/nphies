import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Package, ArrowLeft, Send, RefreshCw, Eye, Trash2, CheckCircle2, 
  AlertCircle, Clock, Building2, Shield, Calendar, DollarSign,
  FileText, Activity, Info, Copy, Download, Loader2, Calculator,
  ChevronDown, ChevronUp, User, Hash
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
  const [expandedClaims, setExpandedClaims] = useState({});

  useEffect(() => {
    loadBatchDetails();
  }, [id]);

  // Auto-load bundles when Request Bundle tab is selected AND batch is loaded
  useEffect(() => {
    if (activeTab === 'request' && batch && !freshBundles && !bundlesLoading && !bundlesError) {
      loadFreshBundles();
    }
  }, [activeTab, batch]);

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

  // Load FHIR bundles - use stored request_bundle if batch was submitted, otherwise preview
  const loadFreshBundles = async () => {
    try {
      setBundlesLoading(true);
      setBundlesError(null);
      
      if (batch && batch.status !== 'Draft' && batch.request_bundle) {
        const storedBundle = typeof batch.request_bundle === 'string' 
          ? JSON.parse(batch.request_bundle) 
          : batch.request_bundle;
        
        let bundles = [];
        if (storedBundle.batchBundle) {
          bundles = [storedBundle.batchBundle];
        } else if (storedBundle.bundles && Array.isArray(storedBundle.bundles)) {
          bundles = storedBundle.bundles;
        } else if (Array.isArray(storedBundle)) {
          bundles = storedBundle;
        } else if (storedBundle.resourceType === 'Bundle') {
          bundles = [storedBundle];
        }
        
        setFreshBundles(bundles);
        return;
      }
      
      const response = await api.previewBatchBundle(id);
      const individualBundles = response.data || [];
      const batchBundle = response.batchBundle;
      
      if (batchBundle) {
        setFreshBundles([batchBundle]);
      } else {
        setFreshBundles(individualBundles);
      }
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
            {(batch.status === 'Draft' || batch.status === 'Error') && (
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
                  {batch.status === 'Error' ? 'Retry Submission' : 'Send to NPHIES'}
                </Button>
                {batch.status === 'Draft' && (
                  <Button variant="destructive" onClick={handleDeleteBatch} disabled={actionLoading}>
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </Button>
                )}
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
                              onClick={() => navigate(`/prior-authorizations/${claim.prior_auth_db_id || claim.prior_auth_id}`)}
                              title="View Prior Authorization"
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
                        Batch Bundle
                      </Badge>
                      <span className="text-sm text-gray-600">
                        Batch: <code className="bg-white px-2 py-0.5 rounded font-mono text-xs">{batch?.batch_identifier}</code>
                      </span>
                    </div>
                    <span className="text-xs text-gray-500">
                      Single HTTP POST to NPHIES (event=batch-request)
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
                              Single batch-request bundle - Batch: {batch?.batch_identifier}
                            </p>
                          </div>
                          <Badge className="bg-white/20 text-white">
                            {(JSON.stringify(freshBundles.map(cleanBundleForCopy)).length / 1024).toFixed(1)} KB
                          </Badge>
                        </div>
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
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                        <p className="text-sm text-blue-700">
                          This shows the batch bundle sent as a single HTTP POST to NPHIES. It contains nested claim bundles inside.
                          Use <strong>"Copy This Bundle"</strong> to copy the full JSON payload.
                        </p>
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
            {(() => {
              const rb = typeof batch.response_bundle === 'string' ? JSON.parse(batch.response_bundle) : batch.response_bundle;
              const isRawFhir = rb?.resourceType === 'Bundle' && Array.isArray(rb?.entry);
              const outerMH = isRawFhir ? rb.entry?.[0]?.resource : null;
              const responseCode = outerMH?.response?.code;
              const eventCode = outerMH?.eventCoding?.code;
              const metaTags = outerMH?.meta?.tag || [];
              const hasQueuedTag = metaTags.some(t => t.code === 'queued-messages');

              const nestedBundles = isRawFhir
                ? rb.entry.filter(e => e.resource?.resourceType === 'Bundle').map(e => ({ ...e.resource, _fullUrl: e.fullUrl }))
                : [];

              const polledResponses = rb?.polledResponses || [];

              return (
                <div className="space-y-6">
                  {/* Section 1: Batch Response Overview */}
                  {isRawFhir && outerMH && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center">
                          <Activity className="h-5 w-5 mr-2" />
                          Batch Response Overview
                        </CardTitle>
                        <CardDescription>High-level summary of the NPHIES batch response</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          <div className="bg-gray-50 rounded-lg p-3">
                            <p className="text-xs text-gray-500 mb-1">Response Code</p>
                            <Badge variant={responseCode === 'ok' ? 'default' : 'destructive'} className="text-sm">
                              {responseCode || '-'}
                            </Badge>
                          </div>
                          <div className="bg-gray-50 rounded-lg p-3">
                            <p className="text-xs text-gray-500 mb-1">Event</p>
                            <p className="font-semibold text-sm">{eventCode || '-'}</p>
                          </div>
                          <div className="bg-gray-50 rounded-lg p-3">
                            <p className="text-xs text-gray-500 mb-1">Claim Responses</p>
                            <p className="font-semibold text-sm">{nestedBundles.length}</p>
                          </div>
                          <div className="bg-gray-50 rounded-lg p-3">
                            <p className="text-xs text-gray-500 mb-1">Timestamp</p>
                            <p className="font-semibold text-sm">{rb.timestamp ? new Date(rb.timestamp).toLocaleString() : '-'}</p>
                          </div>
                        </div>

                        <div className="mt-4 grid grid-cols-2 md:grid-cols-3 gap-4">
                          <div>
                            <p className="text-xs text-gray-500">Response Bundle ID</p>
                            <p className="text-sm font-mono break-all">{rb.id || '-'}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500">MessageHeader ID</p>
                            <p className="text-sm font-mono break-all">{outerMH.id || '-'}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500">Request Identifier</p>
                            <p className="text-sm font-mono break-all">{outerMH.response?.identifier || '-'}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500">Sender</p>
                            <p className="text-sm">{outerMH.sender?.identifier?.value || '-'} <span className="text-gray-400">({outerMH.sender?.type || '-'})</span></p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500">Source Endpoint</p>
                            <p className="text-sm font-mono">{outerMH.source?.endpoint || '-'}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500">Destination</p>
                            <p className="text-sm font-mono">{outerMH.destination?.[0]?.endpoint || '-'}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500">Receiver</p>
                            <p className="text-sm">{outerMH.destination?.[0]?.receiver?.identifier?.value || '-'} <span className="text-gray-400">({outerMH.destination?.[0]?.receiver?.type || ''})</span></p>
                          </div>
                        </div>

                        {metaTags.length > 0 && (
                          <div className="mt-4">
                            <p className="text-xs text-gray-500 mb-2">Meta Tags</p>
                            <div className="flex gap-2 flex-wrap">
                              {metaTags.map((tag, i) => (
                                <Badge key={i} variant={tag.code === 'queued-messages' ? 'secondary' : 'outline'} className="text-xs">
                                  {tag.display || tag.code}
                                  {tag.system && <span className="ml-1 opacity-50">({tag.system.split('/').pop()})</span>}
                                </Badge>
                              ))}
                            </div>
                            {hasQueuedTag && (
                              <div className="mt-2 bg-amber-50 border border-amber-200 rounded-lg p-2 flex items-center gap-2">
                                <Clock className="h-4 w-4 text-amber-600" />
                                <p className="text-xs text-amber-700">
                                  Claims are queued for async processing. Use <strong>"Poll Responses"</strong> to check for adjudication updates.
                                </p>
                              </div>
                            )}
                          </div>
                        )}

                        {outerMH.focus && outerMH.focus.length > 0 && (
                          <div className="mt-4">
                            <p className="text-xs text-gray-500 mb-2">Focus References ({outerMH.focus.length})</p>
                            <div className="space-y-1">
                              {outerMH.focus.map((f, i) => (
                                <p key={i} className="text-xs font-mono bg-gray-50 px-2 py-1 rounded break-all">{f.reference}</p>
                              ))}
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  )}

                  {/* Section 2: Per-Claim Response Summary Table */}
                  {nestedBundles.length > 0 && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center">
                          <FileText className="h-5 w-5 mr-2" />
                          Per-Claim Response Summary
                        </CardTitle>
                        <CardDescription>Quick overview of each claim's outcome</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="border rounded-lg overflow-hidden">
                          <table className="w-full">
                            <thead className="bg-gray-50">
                              <tr>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">#</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Claim ID</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">NPHIES ID</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Type</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Patient</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Response</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Outcome</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Status</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Created</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                              {nestedBundles.map((nested, idx) => {
                                const innerMH = nested.entry?.find(e => e.resource?.resourceType === 'MessageHeader')?.resource;
                                const cr = nested.entry?.find(e => e.resource?.resourceType === 'ClaimResponse')?.resource;
                                const patient = nested.entry?.find(e => e.resource?.resourceType === 'Patient')?.resource;
                                const patientName = patient?.name?.[0]?.text || `${patient?.name?.[0]?.given?.join(' ') || ''} ${patient?.name?.[0]?.family || ''}`.trim() || '-';

                                return (
                                  <tr key={`claim-${idx}`} className="hover:bg-gray-50">
                                    <td className="px-4 py-3 text-sm font-medium">{idx + 1}</td>
                                    <td className="px-4 py-3 text-sm font-mono">{cr?.request?.identifier?.value || '-'}</td>
                                    <td className="px-4 py-3 text-sm font-mono">{cr?.identifier?.[0]?.value || cr?.id || '-'}</td>
                                    <td className="px-4 py-3 text-sm">
                                      <Badge variant="outline" className="text-xs">{cr?.type?.coding?.[0]?.code || '-'}</Badge>
                                    </td>
                                    <td className="px-4 py-3 text-sm">{patientName}</td>
                                    <td className="px-4 py-3">
                                      <Badge variant={innerMH?.response?.code === 'ok' ? 'default' : 'destructive'} className="text-xs">
                                        {innerMH?.response?.code || '-'}
                                      </Badge>
                                    </td>
                                    <td className="px-4 py-3">
                                      <Badge variant={
                                        cr?.outcome === 'queued' ? 'secondary' :
                                        cr?.outcome === 'complete' ? 'default' :
                                        cr?.outcome === 'error' ? 'destructive' : 'outline'
                                      } className="text-xs">
                                        {cr?.outcome || '-'}
                                      </Badge>
                                    </td>
                                    <td className="px-4 py-3">
                                      <Badge variant={cr?.status === 'active' ? 'default' : 'outline'} className="text-xs">
                                        {cr?.status || '-'}
                                      </Badge>
                                    </td>
                                    <td className="px-4 py-3 text-sm text-gray-500">
                                      {cr?.created ? new Date(cr.created).toLocaleString() : '-'}
                                    </td>
                                  </tr>
                                );
                              })}
                              {polledResponses.map((pr, idx) => (
                                <tr key={`poll-${idx}`} className="hover:bg-gray-50 bg-blue-50/30">
                                  <td className="px-4 py-3 text-sm">
                                    {pr.batchNumber || idx + 1}
                                    <Badge variant="secondary" className="ml-1 text-xs">polled</Badge>
                                  </td>
                                  <td className="px-4 py-3 text-sm font-mono">{pr.claimIdentifier || '-'}</td>
                                  <td className="px-4 py-3 text-sm font-mono">{pr.nphiesClaimId || '-'}</td>
                                  <td className="px-4 py-3 text-sm">-</td>
                                  <td className="px-4 py-3 text-sm">-</td>
                                  <td className="px-4 py-3">
                                    <Badge variant={pr.outcome !== 'error' ? 'default' : 'destructive'} className="text-xs">
                                      {pr.outcome !== 'error' ? 'ok' : 'error'}
                                    </Badge>
                                  </td>
                                  <td className="px-4 py-3">
                                    <Badge variant={
                                      pr.outcome === 'queued' ? 'secondary' :
                                      pr.outcome === 'complete' ? 'default' :
                                      pr.outcome === 'error' ? 'destructive' : 'outline'
                                    } className="text-xs">
                                      {pr.outcome || '-'}
                                    </Badge>
                                  </td>
                                  <td className="px-4 py-3">
                                    <Badge variant={
                                      pr.adjudicationOutcome === 'approved' ? 'default' :
                                      pr.adjudicationOutcome === 'rejected' ? 'destructive' : 'secondary'
                                    } className="text-xs">
                                      {pr.adjudicationOutcome || '-'}
                                    </Badge>
                                  </td>
                                  <td className="px-4 py-3 text-sm text-gray-500">{pr.disposition || '-'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Section 3: Detailed Per-Claim Responses (expandable) */}
                  {nestedBundles.length > 0 && (
                    <Card>
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <div>
                            <CardTitle className="flex items-center">
                              <Activity className="h-5 w-5 mr-2" />
                              Detailed Claim Responses ({nestedBundles.length})
                            </CardTitle>
                            <CardDescription>Click each claim to expand full FHIR response details</CardDescription>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                const allExpanded = nestedBundles.every((_, i) => expandedClaims[i]);
                                const newState = {};
                                nestedBundles.forEach((_, i) => { newState[i] = !allExpanded; });
                                setExpandedClaims(newState);
                              }}
                            >
                              {nestedBundles.every((_, i) => expandedClaims[i]) ? 'Collapse All' : 'Expand All'}
                            </Button>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {nestedBundles.map((nested, index) => {
                          const innerMH = nested.entry?.find(e => e.resource?.resourceType === 'MessageHeader')?.resource;
                          const cr = nested.entry?.find(e => e.resource?.resourceType === 'ClaimResponse')?.resource;
                          const patient = nested.entry?.find(e => e.resource?.resourceType === 'Patient')?.resource;
                          const providerOrg = nested.entry?.find(e =>
                            e.resource?.resourceType === 'Organization' &&
                            e.resource?.type?.[0]?.coding?.[0]?.code === 'prov'
                          )?.resource;
                          const insurerOrg = nested.entry?.find(e =>
                            e.resource?.resourceType === 'Organization' &&
                            (e.resource?.type?.[0]?.coding?.[0]?.code === 'ins' ||
                             e.resource?.meta?.profile?.[0]?.includes('insurer'))
                          )?.resource;
                          const coverage = nested.entry?.find(e => e.resource?.resourceType === 'Coverage')?.resource;
                          const oo = nested.entry?.find(e => e.resource?.resourceType === 'OperationOutcome')?.resource;

                          const outcome = cr?.outcome || 'unknown';
                          const adjOutcome = cr?.extension?.find(ext => ext.url?.includes('adjudication-outcome'))?.valueCodeableConcept?.coding?.[0]?.code;
                          const claimType = cr?.type?.coding?.[0]?.code;
                          const requestId = cr?.request?.identifier?.value;
                          const patientName = patient?.name?.[0]?.text || `${patient?.name?.[0]?.given?.join(' ') || ''} ${patient?.name?.[0]?.family || ''}`.trim() || 'Unknown';
                          const isExpanded = expandedClaims[index];

                          return (
                            <div key={index} className="border rounded-lg overflow-hidden">
                              {/* Claim header row - clickable */}
                              <div
                                className="bg-gray-50 px-4 py-3 cursor-pointer hover:bg-gray-100 transition-colors"
                                onClick={() => setExpandedClaims(prev => ({ ...prev, [index]: !prev[index] }))}
                              >
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-3">
                                    <div className={`rounded-full w-8 h-8 flex items-center justify-center font-bold text-sm text-white ${
                                      outcome === 'queued' ? 'bg-blue-500' :
                                      outcome === 'complete' ? 'bg-green-500' :
                                      outcome === 'error' ? 'bg-red-500' : 'bg-gray-500'
                                    }`}>
                                      {index + 1}
                                    </div>
                                    <div>
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <span className="font-semibold text-sm">{requestId || `Claim #${index + 1}`}</span>
                                        <Badge variant="outline" className="text-xs">{claimType || '-'}</Badge>
                                        <Badge variant={innerMH?.response?.code === 'ok' ? 'default' : 'destructive'} className="text-xs">
                                          {innerMH?.response?.code || '-'}
                                        </Badge>
                                        <Badge variant={
                                          outcome === 'queued' ? 'secondary' :
                                          outcome === 'complete' ? 'default' :
                                          outcome === 'error' ? 'destructive' : 'outline'
                                        } className="text-xs">
                                          {outcome}
                                        </Badge>
                                        {adjOutcome && (
                                          <Badge variant={
                                            adjOutcome === 'approved' ? 'default' :
                                            adjOutcome === 'rejected' ? 'destructive' : 'secondary'
                                          } className="text-xs">
                                            {adjOutcome}
                                          </Badge>
                                        )}
                                      </div>
                                      <p className="text-xs text-gray-500 mt-0.5">
                                        {patientName} &bull; NPHIES ID: {cr?.identifier?.[0]?.value || cr?.id || '-'} &bull; {nested.entry?.length || 0} resources
                                      </p>
                                    </div>
                                  </div>
                                  {isExpanded
                                    ? <ChevronUp className="h-5 w-5 text-gray-400" />
                                    : <ChevronDown className="h-5 w-5 text-gray-400" />
                                  }
                                </div>
                              </div>

                              {/* Expanded details */}
                              {isExpanded && (
                                <div className="px-4 py-4 space-y-5 border-t bg-white">

                                  {/* Inner MessageHeader */}
                                  {innerMH && (
                                    <div>
                                      <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center">
                                        <Info className="h-4 w-4 mr-1.5" />
                                        Message Header
                                      </h4>
                                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-gray-50 rounded-lg p-3">
                                        <div>
                                          <p className="text-xs text-gray-500">Response Code</p>
                                          <Badge variant={innerMH.response?.code === 'ok' ? 'default' : 'destructive'} className="text-xs mt-1">
                                            {innerMH.response?.code || '-'}
                                          </Badge>
                                        </div>
                                        <div>
                                          <p className="text-xs text-gray-500">Event</p>
                                          <p className="text-sm font-medium">{innerMH.eventCoding?.code || '-'}</p>
                                        </div>
                                        <div>
                                          <p className="text-xs text-gray-500">Request Identifier</p>
                                          <p className="text-xs font-mono break-all">{innerMH.response?.identifier || '-'}</p>
                                        </div>
                                        <div>
                                          <p className="text-xs text-gray-500">MessageHeader ID</p>
                                          <p className="text-xs font-mono break-all">{innerMH.id || '-'}</p>
                                        </div>
                                        <div>
                                          <p className="text-xs text-gray-500">Sender</p>
                                          <p className="text-sm">{innerMH.sender?.identifier?.value || '-'}</p>
                                        </div>
                                        <div>
                                          <p className="text-xs text-gray-500">Source Endpoint</p>
                                          <p className="text-xs font-mono">{innerMH.source?.endpoint || '-'}</p>
                                        </div>
                                        <div>
                                          <p className="text-xs text-gray-500">Destination</p>
                                          <p className="text-xs font-mono">{innerMH.destination?.[0]?.endpoint || '-'}</p>
                                        </div>
                                        <div>
                                          <p className="text-xs text-gray-500">Receiver License</p>
                                          <p className="text-sm">{innerMH.destination?.[0]?.receiver?.identifier?.value || '-'}</p>
                                        </div>
                                      </div>
                                      {innerMH.focus && innerMH.focus.length > 0 && (
                                        <div className="mt-2">
                                          <p className="text-xs text-gray-500 mb-1">Focus</p>
                                          {innerMH.focus.map((f, fi) => (
                                            <p key={fi} className="text-xs font-mono bg-gray-50 px-2 py-1 rounded break-all">{f.reference}</p>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  )}

                                  {/* ClaimResponse Details */}
                                  {cr && (
                                    <div>
                                      <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center">
                                        <FileText className="h-4 w-4 mr-1.5" />
                                        Claim Response
                                      </h4>
                                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-blue-50 rounded-lg p-3">
                                        <div>
                                          <p className="text-xs text-gray-500">ClaimResponse ID</p>
                                          <p className="text-sm font-mono">{cr.id || '-'}</p>
                                        </div>
                                        <div>
                                          <p className="text-xs text-gray-500">Use</p>
                                          <p className="text-sm font-medium">{cr.use || '-'}</p>
                                        </div>
                                        <div>
                                          <p className="text-xs text-gray-500">Type</p>
                                          <Badge variant="outline" className="text-xs mt-1">{cr.type?.coding?.[0]?.code || '-'}</Badge>
                                        </div>
                                        <div>
                                          <p className="text-xs text-gray-500">Status</p>
                                          <Badge variant={cr.status === 'active' ? 'default' : 'outline'} className="text-xs mt-1">
                                            {cr.status || '-'}
                                          </Badge>
                                        </div>
                                        <div>
                                          <p className="text-xs text-gray-500">Outcome</p>
                                          <Badge variant={
                                            cr.outcome === 'queued' ? 'secondary' :
                                            cr.outcome === 'complete' ? 'default' :
                                            cr.outcome === 'error' ? 'destructive' : 'outline'
                                          } className="text-xs mt-1">
                                            {cr.outcome || '-'}
                                          </Badge>
                                        </div>
                                        <div>
                                          <p className="text-xs text-gray-500">Created</p>
                                          <p className="text-sm">{cr.created ? new Date(cr.created).toLocaleString() : '-'}</p>
                                        </div>
                                        <div>
                                          <p className="text-xs text-gray-500">Request Identifier</p>
                                          <p className="text-sm font-mono">{cr.request?.identifier?.value || '-'}</p>
                                        </div>
                                        <div>
                                          <p className="text-xs text-gray-500">NPHIES Identifier</p>
                                          <p className="text-sm font-mono">{cr.identifier?.[0]?.value || '-'}</p>
                                        </div>
                                      </div>

                                      {/* Request reference */}
                                      {cr.request && (
                                        <div className="mt-2 bg-blue-50 rounded-lg p-3">
                                          <p className="text-xs text-gray-500 mb-1">Request Reference</p>
                                          <div className="grid grid-cols-2 gap-3">
                                            <div>
                                              <p className="text-xs text-gray-400">Type</p>
                                              <p className="text-sm">{cr.request.type || '-'}</p>
                                            </div>
                                            <div>
                                              <p className="text-xs text-gray-400">Identifier</p>
                                              <p className="text-sm font-mono">{cr.request.identifier?.value || '-'}</p>
                                              {cr.request.identifier?.system && (
                                                <p className="text-xs text-gray-400 font-mono">{cr.request.identifier.system}</p>
                                              )}
                                            </div>
                                          </div>
                                        </div>
                                      )}

                                      {/* NPHIES Generated tag */}
                                      {cr.meta?.tag && cr.meta.tag.length > 0 && (
                                        <div className="mt-2 flex gap-2 flex-wrap">
                                          {cr.meta.tag.map((tag, ti) => (
                                            <Badge key={ti} variant="secondary" className="text-xs">
                                              {tag.display || tag.code}
                                            </Badge>
                                          ))}
                                        </div>
                                      )}

                                      {adjOutcome && (
                                        <div className="mt-2 bg-blue-50 rounded-lg p-3">
                                          <p className="text-xs text-gray-500">Adjudication Outcome</p>
                                          <Badge variant={
                                            adjOutcome === 'approved' ? 'default' :
                                            adjOutcome === 'rejected' ? 'destructive' : 'secondary'
                                          } className="mt-1">
                                            {adjOutcome}
                                          </Badge>
                                        </div>
                                      )}

                                      {cr.disposition && (
                                        <div className="mt-2 bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                                          <p className="text-xs text-gray-500">Disposition</p>
                                          <p className="text-sm">{cr.disposition}</p>
                                        </div>
                                      )}

                                      {cr.preAuthRef && (
                                        <div className="mt-2">
                                          <p className="text-xs text-gray-500">Pre-Authorization References</p>
                                          <p className="text-sm font-mono">{Array.isArray(cr.preAuthRef) ? cr.preAuthRef.join(', ') : cr.preAuthRef}</p>
                                        </div>
                                      )}

                                      {/* Totals */}
                                      {cr.total && cr.total.length > 0 && (
                                        <div className="mt-3">
                                          <p className="text-xs text-gray-500 mb-2">Totals</p>
                                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                            {cr.total.map((t, ti) => (
                                              <div key={ti} className="bg-green-50 rounded-lg p-3 text-center">
                                                <p className="text-xs text-gray-500 capitalize">{t.category?.coding?.[0]?.code || 'Total'}</p>
                                                <p className="text-lg font-bold text-green-700">
                                                  {t.amount?.currency || 'SAR'} {parseFloat(t.amount?.value || 0).toLocaleString()}
                                                </p>
                                              </div>
                                            ))}
                                          </div>
                                        </div>
                                      )}

                                      {/* Item-level adjudication */}
                                      {cr.item && cr.item.length > 0 && (
                                        <div className="mt-3">
                                          <p className="text-xs text-gray-500 mb-2">Item Adjudication ({cr.item.length} items)</p>
                                          <div className="border rounded-lg overflow-hidden">
                                            <table className="w-full text-xs">
                                              <thead className="bg-gray-100">
                                                <tr>
                                                  <th className="px-3 py-2 text-left">Sequence</th>
                                                  <th className="px-3 py-2 text-left">Adjudication</th>
                                                  <th className="px-3 py-2 text-left">Notes</th>
                                                </tr>
                                              </thead>
                                              <tbody className="divide-y">
                                                {cr.item.map((item, ii) => (
                                                  <tr key={ii} className="hover:bg-gray-50">
                                                    <td className="px-3 py-2">{item.itemSequence}</td>
                                                    <td className="px-3 py-2">
                                                      {item.adjudication?.map((adj, ai) => (
                                                        <span key={ai} className="inline-block mr-2 mb-1">
                                                          <span className="text-gray-500">{adj.category?.coding?.[0]?.code}:</span>{' '}
                                                          {adj.amount ? `${adj.amount.currency || 'SAR'} ${adj.amount.value}` : adj.value || '-'}
                                                        </span>
                                                      )) || '-'}
                                                    </td>
                                                    <td className="px-3 py-2">{item.noteNumber?.join(', ') || '-'}</td>
                                                  </tr>
                                                ))}
                                              </tbody>
                                            </table>
                                          </div>
                                        </div>
                                      )}

                                      {/* Process Notes */}
                                      {cr.processNote && cr.processNote.length > 0 && (
                                        <div className="mt-3">
                                          <p className="text-xs text-gray-500 mb-2">Process Notes ({cr.processNote.length})</p>
                                          <div className="space-y-1">
                                            {cr.processNote.map((note, ni) => (
                                              <div key={ni} className="bg-gray-50 rounded p-2 text-sm">
                                                <span className="text-gray-400 mr-2">#{note.number}</span>
                                                <span className="text-gray-600">[{note.type}]</span> {note.text}
                                              </div>
                                            ))}
                                          </div>
                                        </div>
                                      )}

                                      {/* Insurance */}
                                      {cr.insurance && cr.insurance.length > 0 && (
                                        <div className="mt-3">
                                          <p className="text-xs text-gray-500 mb-2">Insurance</p>
                                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                            {cr.insurance.map((ins, ii) => (
                                              <div key={ii} className="bg-gray-50 rounded-lg p-2 text-xs grid grid-cols-3 gap-2">
                                                <div>
                                                  <span className="text-gray-500">Sequence:</span> {ins.sequence}
                                                </div>
                                                <div>
                                                  <span className="text-gray-500">Focal:</span> {ins.focal ? 'Yes' : 'No'}
                                                </div>
                                                <div>
                                                  <span className="text-gray-500">Coverage:</span>{' '}
                                                  <span className="font-mono break-all">{ins.coverage?.reference || '-'}</span>
                                                </div>
                                              </div>
                                            ))}
                                          </div>
                                        </div>
                                      )}

                                      {/* References */}
                                      <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3">
                                        {cr.patient?.reference && (
                                          <div className="bg-gray-50 rounded p-2">
                                            <p className="text-xs text-gray-500">Patient</p>
                                            <p className="text-xs font-mono break-all">{cr.patient.reference}</p>
                                          </div>
                                        )}
                                        {cr.insurer?.reference && (
                                          <div className="bg-gray-50 rounded p-2">
                                            <p className="text-xs text-gray-500">Insurer</p>
                                            <p className="text-xs font-mono break-all">{cr.insurer.reference}</p>
                                          </div>
                                        )}
                                        {cr.requestor?.reference && (
                                          <div className="bg-gray-50 rounded p-2">
                                            <p className="text-xs text-gray-500">Requestor</p>
                                            <p className="text-xs font-mono break-all">{cr.requestor.reference}</p>
                                          </div>
                                        )}
                                      </div>

                                      {/* Extensions */}
                                      {cr.extension && cr.extension.length > 0 && (
                                        <div className="mt-3">
                                          <p className="text-xs text-gray-500 mb-2">Extensions ({cr.extension.length})</p>
                                          <div className="space-y-1">
                                            {cr.extension.map((ext, ei) => (
                                              <div key={ei} className="bg-gray-50 rounded p-2 text-xs flex items-start gap-2">
                                                <span className="text-gray-400 font-mono break-all flex-1">{ext.url?.split('/').pop() || ext.url}</span>
                                                <span className="font-medium">
                                                  {ext.valueBoolean !== undefined ? String(ext.valueBoolean) :
                                                   ext.valueString || ext.valueCode ||
                                                   ext.valueCodeableConcept?.coding?.[0]?.code ||
                                                   ext.valueIdentifier?.value ||
                                                   ext.valuePositiveInt ||
                                                   ext.valueDate || ext.valuePeriod?.start ||
                                                   JSON.stringify(ext.value || '')}
                                                </span>
                                              </div>
                                            ))}
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  )}

                                  {/* Patient Details */}
                                  {patient && (
                                    <div>
                                      <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center">
                                        <User className="h-4 w-4 mr-1.5" />
                                        Patient
                                      </h4>
                                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-green-50 rounded-lg p-3">
                                        <div>
                                          <p className="text-xs text-gray-500">Name</p>
                                          <p className="text-sm font-medium">{patient.name?.[0]?.text || `${patient.name?.[0]?.given?.join(' ') || ''} ${patient.name?.[0]?.family || ''}`.trim() || '-'}</p>
                                        </div>
                                        <div>
                                          <p className="text-xs text-gray-500">Gender</p>
                                          <p className="text-sm capitalize">{patient.gender || '-'}</p>
                                          {patient._gender?.extension?.[0]?.valueCodeableConcept?.coding?.[0]?.code && (
                                            <p className="text-xs text-gray-400">KSA: {patient._gender.extension[0].valueCodeableConcept.coding[0].code}</p>
                                          )}
                                        </div>
                                        <div>
                                          <p className="text-xs text-gray-500">Birth Date</p>
                                          <p className="text-sm">{patient.birthDate || '-'}</p>
                                        </div>
                                        <div>
                                          <p className="text-xs text-gray-500">Active</p>
                                          <p className="text-sm">{patient.active ? 'Yes' : 'No'}</p>
                                        </div>
                                        <div>
                                          <p className="text-xs text-gray-500">Identifier</p>
                                          <p className="text-sm font-mono">{patient.identifier?.[0]?.value || '-'}</p>
                                        </div>
                                        <div>
                                          <p className="text-xs text-gray-500">ID Type</p>
                                          <p className="text-sm">{patient.identifier?.[0]?.type?.coding?.[0]?.display || patient.identifier?.[0]?.type?.coding?.[0]?.code || '-'}</p>
                                        </div>
                                        <div>
                                          <p className="text-xs text-gray-500">ID System</p>
                                          <p className="text-xs font-mono break-all">{patient.identifier?.[0]?.system || '-'}</p>
                                        </div>
                                        <div>
                                          <p className="text-xs text-gray-500">Marital Status</p>
                                          <p className="text-sm">{patient.maritalStatus?.coding?.[0]?.code || '-'}</p>
                                        </div>
                                        {patient.deceasedBoolean !== undefined && (
                                          <div>
                                            <p className="text-xs text-gray-500">Deceased</p>
                                            <p className="text-sm">{patient.deceasedBoolean ? 'Yes' : 'No'}</p>
                                          </div>
                                        )}
                                      </div>
                                      {/* Patient extensions (e.g. occupation) */}
                                      {patient.extension && patient.extension.length > 0 && (
                                        <div className="mt-2 flex gap-2 flex-wrap">
                                          {patient.extension.map((ext, ei) => (
                                            <Badge key={ei} variant="outline" className="text-xs">
                                              {ext.url?.split('/').pop()}: {ext.valueCodeableConcept?.coding?.[0]?.code || ext.valueString || '-'}
                                            </Badge>
                                          ))}
                                        </div>
                                      )}
                                      {/* Patient identifier extensions (e.g. country) */}
                                      {patient.identifier?.[0]?.extension && patient.identifier[0].extension.length > 0 && (
                                        <div className="mt-1 flex gap-2 flex-wrap">
                                          {patient.identifier[0].extension.map((ext, ei) => (
                                            <Badge key={ei} variant="outline" className="text-xs">
                                              {ext.url?.split('/').pop()}: {ext.valueCodeableConcept?.coding?.[0]?.display || ext.valueCodeableConcept?.coding?.[0]?.code || '-'}
                                            </Badge>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  )}

                                  {/* Provider Organization */}
                                  {providerOrg && (
                                    <div>
                                      <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center">
                                        <Building2 className="h-4 w-4 mr-1.5" />
                                        Provider Organization
                                      </h4>
                                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-purple-50 rounded-lg p-3">
                                        <div>
                                          <p className="text-xs text-gray-500">Name</p>
                                          <p className="text-sm font-medium">{providerOrg.name || '-'}</p>
                                        </div>
                                        <div>
                                          <p className="text-xs text-gray-500">License</p>
                                          <p className="text-sm font-mono">{providerOrg.identifier?.[0]?.value || '-'}</p>
                                        </div>
                                        <div>
                                          <p className="text-xs text-gray-500">Provider Type</p>
                                          <p className="text-sm">{providerOrg.extension?.find(ext => ext.url?.includes('extension-provider-type'))?.valueCodeableConcept?.coding?.[0]?.display || '-'}</p>
                                        </div>
                                        <div>
                                          <p className="text-xs text-gray-500">Active</p>
                                          <p className="text-sm">{providerOrg.active ? 'Yes' : 'No'}</p>
                                        </div>
                                        <div>
                                          <p className="text-xs text-gray-500">Organization Type</p>
                                          <p className="text-sm">{providerOrg.type?.[0]?.coding?.[0]?.code || '-'}</p>
                                        </div>
                                        <div>
                                          <p className="text-xs text-gray-500">ID</p>
                                          <p className="text-xs font-mono break-all">{providerOrg.id || '-'}</p>
                                        </div>
                                      </div>
                                    </div>
                                  )}

                                  {/* Insurer Organization */}
                                  {insurerOrg && (
                                    <div>
                                      <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center">
                                        <Shield className="h-4 w-4 mr-1.5" />
                                        Insurer Organization
                                      </h4>
                                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-cyan-50 rounded-lg p-3">
                                        <div>
                                          <p className="text-xs text-gray-500">Name</p>
                                          <p className="text-sm font-medium">{insurerOrg.name || '-'}</p>
                                        </div>
                                        <div>
                                          <p className="text-xs text-gray-500">License</p>
                                          <p className="text-sm font-mono">{insurerOrg.identifier?.[0]?.value || '-'}</p>
                                        </div>
                                        <div>
                                          <p className="text-xs text-gray-500">License System</p>
                                          <p className="text-xs font-mono break-all">{insurerOrg.identifier?.[0]?.system || '-'}</p>
                                        </div>
                                        <div>
                                          <p className="text-xs text-gray-500">Type</p>
                                          <p className="text-sm">{insurerOrg.type?.[0]?.coding?.[0]?.display || insurerOrg.type?.[0]?.coding?.[0]?.code || '-'}</p>
                                        </div>
                                        <div>
                                          <p className="text-xs text-gray-500">Active</p>
                                          <p className="text-sm">{insurerOrg.active ? 'Yes' : 'No'}</p>
                                        </div>
                                        <div>
                                          <p className="text-xs text-gray-500">ID</p>
                                          <p className="text-xs font-mono break-all">{insurerOrg.id || '-'}</p>
                                        </div>
                                      </div>
                                    </div>
                                  )}

                                  {/* Coverage */}
                                  {coverage && (
                                    <div>
                                      <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center">
                                        <Shield className="h-4 w-4 mr-1.5" />
                                        Coverage
                                      </h4>
                                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-amber-50 rounded-lg p-3">
                                        <div>
                                          <p className="text-xs text-gray-500">Member ID</p>
                                          <p className="text-sm font-mono">{coverage.identifier?.[0]?.value || '-'}</p>
                                        </div>
                                        <div>
                                          <p className="text-xs text-gray-500">Type</p>
                                          <p className="text-sm">{coverage.type?.coding?.[0]?.display || coverage.type?.coding?.[0]?.code || '-'}</p>
                                        </div>
                                        <div>
                                          <p className="text-xs text-gray-500">Status</p>
                                          <Badge variant={coverage.status === 'active' ? 'default' : 'outline'} className="text-xs mt-1">
                                            {coverage.status || '-'}
                                          </Badge>
                                        </div>
                                        <div>
                                          <p className="text-xs text-gray-500">Relationship</p>
                                          <p className="text-sm">{coverage.relationship?.coding?.[0]?.display || coverage.relationship?.coding?.[0]?.code || '-'}</p>
                                        </div>
                                        <div>
                                          <p className="text-xs text-gray-500">Plan</p>
                                          <p className="text-sm">{coverage.class?.[0]?.name || coverage.class?.[0]?.value || '-'}</p>
                                        </div>
                                        <div>
                                          <p className="text-xs text-gray-500">Period</p>
                                          <p className="text-sm">{coverage.period?.start || '-'} to {coverage.period?.end || '-'}</p>
                                        </div>
                                        <div>
                                          <p className="text-xs text-gray-500">Subscriber</p>
                                          <p className="text-xs font-mono break-all">{coverage.subscriber?.reference || '-'}</p>
                                        </div>
                                        <div>
                                          <p className="text-xs text-gray-500">Beneficiary</p>
                                          <p className="text-xs font-mono break-all">{coverage.beneficiary?.reference || '-'}</p>
                                        </div>
                                        <div>
                                          <p className="text-xs text-gray-500">Policy Holder</p>
                                          <p className="text-xs font-mono break-all">{coverage.policyHolder?.reference || '-'}</p>
                                        </div>
                                        <div>
                                          <p className="text-xs text-gray-500">Payor</p>
                                          <p className="text-xs font-mono break-all">{coverage.payor?.[0]?.reference || '-'}</p>
                                        </div>
                                      </div>
                                    </div>
                                  )}

                                  {/* Operation Outcome */}
                                  {oo && oo.issue && oo.issue.length > 0 && (
                                    <div>
                                      <h4 className="text-sm font-semibold text-red-600 mb-2 flex items-center">
                                        <AlertCircle className="h-4 w-4 mr-1.5" />
                                        Operation Outcome ({oo.issue.length} issues)
                                      </h4>
                                      <div className="space-y-2">
                                        {oo.issue.map((issue, ii) => (
                                          <div key={ii} className={`rounded-lg p-3 ${
                                            issue.severity === 'error' || issue.severity === 'fatal'
                                              ? 'bg-red-50 border border-red-200'
                                              : issue.severity === 'warning'
                                              ? 'bg-yellow-50 border border-yellow-200'
                                              : 'bg-blue-50 border border-blue-200'
                                          }`}>
                                            <div className="flex items-start gap-2">
                                              <Badge variant={issue.severity === 'error' || issue.severity === 'fatal' ? 'destructive' : 'secondary'} className="text-xs shrink-0">
                                                {issue.severity}
                                              </Badge>
                                              <div className="min-w-0">
                                                <p className="text-sm font-medium">{issue.details?.coding?.[0]?.code || issue.code || '-'}</p>
                                                <p className="text-sm text-gray-700">{issue.details?.coding?.[0]?.display || issue.diagnostics || issue.details?.text || '-'}</p>
                                                {issue.expression && issue.expression.length > 0 && (
                                                  <p className="text-xs text-gray-500 font-mono mt-1 break-all">{issue.expression.join(', ')}</p>
                                                )}
                                                {issue.location && issue.location.length > 0 && (
                                                  <p className="text-xs text-gray-500 font-mono mt-1 break-all">Location: {issue.location.join(', ')}</p>
                                                )}
                                              </div>
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}

                                  {/* Bundle metadata footer */}
                                  <div className="text-xs text-gray-400 pt-3 border-t flex flex-wrap gap-x-4 gap-y-1">
                                    <span>Bundle ID: <span className="font-mono">{nested.id}</span></span>
                                    <span>Full URL: <span className="font-mono break-all">{nested._fullUrl || '-'}</span></span>
                                    <span>Timestamp: {nested.timestamp ? new Date(nested.timestamp).toLocaleString() : '-'}</span>
                                    <span>Resources: {nested.entry?.length || 0}</span>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </CardContent>
                    </Card>
                  )}

                  {/* Polled Responses Section */}
                  {polledResponses.length > 0 && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center">
                          <RefreshCw className="h-5 w-5 mr-2" />
                          Polled Responses ({polledResponses.length})
                        </CardTitle>
                        <CardDescription>Responses retrieved via polling after initial submission</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="border rounded-lg overflow-hidden">
                          <table className="w-full">
                            <thead className="bg-blue-50">
                              <tr>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Batch #</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Claim ID</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">NPHIES ID</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Outcome</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Adjudication</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Disposition</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Errors</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                              {polledResponses.map((pr, idx) => (
                                <tr key={idx} className="hover:bg-gray-50">
                                  <td className="px-4 py-3 text-sm">{pr.batchNumber || idx + 1}</td>
                                  <td className="px-4 py-3 text-sm font-mono">{pr.claimIdentifier || '-'}</td>
                                  <td className="px-4 py-3 text-sm font-mono">{pr.nphiesClaimId || '-'}</td>
                                  <td className="px-4 py-3">
                                    <Badge variant={
                                      pr.outcome === 'complete' ? 'default' :
                                      pr.outcome === 'queued' ? 'secondary' :
                                      pr.outcome === 'error' ? 'destructive' : 'outline'
                                    } className="text-xs">
                                      {pr.outcome || '-'}
                                    </Badge>
                                  </td>
                                  <td className="px-4 py-3">
                                    <Badge variant={
                                      pr.adjudicationOutcome === 'approved' ? 'default' :
                                      pr.adjudicationOutcome === 'rejected' ? 'destructive' : 'secondary'
                                    } className="text-xs">
                                      {pr.adjudicationOutcome || '-'}
                                    </Badge>
                                  </td>
                                  <td className="px-4 py-3 text-sm">{pr.disposition || '-'}</td>
                                  <td className="px-4 py-3 text-sm">
                                    {pr.errors?.length > 0 ? (
                                      <span className="text-red-600 text-xs">{pr.errors.map(e => e.message || e.code).join('; ')}</span>
                                    ) : '-'}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Raw Response JSON */}
                  <Card>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle className="flex items-center">
                            <Hash className="h-5 w-5 mr-2" />
                            Raw Response JSON
                          </CardTitle>
                          <CardDescription>Full FHIR response bundle received from NPHIES</CardDescription>
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
                </div>
              );
            })()}
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}

