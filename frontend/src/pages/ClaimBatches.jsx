import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem } from '@/components/ui/select';
import DataTable from '@/components/DataTable';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { Package, TrendingUp, Users, DollarSign, Calendar, Building2, Shield, Receipt, Plus, Send, RefreshCw, Eye, Trash2, X, CheckCircle2, AlertCircle, Clock, Layers } from 'lucide-react';
import api from '@/services/api';

const COLORS = ['#553781', '#9658C4', '#8572CD', '#00DEFE', '#26A69A', '#E0E7FF'];

export default function ClaimBatches() {
  const navigate = useNavigate();
  const [claimBatches, setClaimBatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedBatch, setSelectedBatch] = useState(null);
  const [stats, setStats] = useState(null);
  
  // Batch creation state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [availableClaims, setAvailableClaims] = useState([]);
  const [selectedClaims, setSelectedClaims] = useState([]);
  const [batchForm, setBatchForm] = useState({
    batch_identifier: '',
    batch_period_start: new Date().toISOString().split('T')[0],
    batch_period_end: new Date().toISOString().split('T')[0],
    description: ''
  });
  const [createLoading, setCreateLoading] = useState(false);
  const [filterInsurer, setFilterInsurer] = useState('');
  const [filterClaimType, setFilterClaimType] = useState('');
  
  // Action states
  const [actionLoading, setActionLoading] = useState(null);
  const [showBundlePreview, setShowBundlePreview] = useState(false);
  const [bundlePreview, setBundlePreview] = useState(null);
  const [copySuccess, setCopySuccess] = useState(false);

  // Helper function to clean bundle for NPHIES (remove internal metadata)
  const cleanBundleForNphies = (bundle) => {
    if (!bundle) return bundle;
    const { _batchMetadata, ...cleanBundle } = bundle;
    return cleanBundle;
  };
  
  // Chart data states
  const [batchesByStatus, setBatchesByStatus] = useState([]);
  const [batchesByInsurer, setBatchesByInsurer] = useState([]);
  const [monthlyTrends, setMonthlyTrends] = useState([]);
  const [batchesByProvider, setBatchesByProvider] = useState([]);
  
  // Drill-down state
  const [drillDownData, setDrillDownData] = useState([]);
  const [showDrillDown, setShowDrillDown] = useState(false);
  const [drillDownTitle, setDrillDownTitle] = useState('');

  useEffect(() => {
    loadClaimBatches();
    loadStats();
  }, []);

  const loadClaimBatches = async () => {
    try {
      setLoading(true);
      const response = await api.getClaimBatches({ limit: 1000 });
      const batchesData = response.data || response || [];
      setClaimBatches(batchesData);
      processChartData(batchesData);
    } catch (error) {
      console.error('Error loading claim batches:', error);
      setClaimBatches([]);
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const response = await api.getClaimBatchStats();
      setStats(response.data || response);
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  const loadAvailableClaims = async (insurerId = null) => {
    try {
      const params = {};
      if (insurerId) params.insurer_id = insurerId;
      const response = await api.getAvailableClaimsForBatch(params);
      setAvailableClaims(response.data || []);
    } catch (error) {
      console.error('Error loading available claims:', error);
      setAvailableClaims([]);
    }
  };

  const processChartData = (data) => {
    // Process batches by status
    const statusCounts = {};
    data.forEach(item => {
      const status = item.status || 'Unknown';
      statusCounts[status] = (statusCounts[status] || 0) + 1;
    });
    setBatchesByStatus(Object.entries(statusCounts).map(([name, value]) => ({ name, value })));

    // Process batches by insurer
    const insurerCounts = {};
    const insurerAmounts = {};
    data.forEach(item => {
      const insurer = item.insurer_name || 'Unknown';
      insurerCounts[insurer] = (insurerCounts[insurer] || 0) + 1;
      insurerAmounts[insurer] = (insurerAmounts[insurer] || 0) + parseFloat(item.total_amount || 0);
    });
    setBatchesByInsurer(Object.entries(insurerCounts).map(([name, value]) => ({ 
      name, 
      value,
      amount: insurerAmounts[name] 
    })));

    // Process batches by provider
    const providerCounts = {};
    data.forEach(item => {
      const provider = item.provider_name || 'Unknown';
      providerCounts[provider] = (providerCounts[provider] || 0) + 1;
    });
    setBatchesByProvider(Object.entries(providerCounts).map(([name, value]) => ({ name, value })));

    // Process monthly trends
    const monthlyData = {};
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    data.forEach(item => {
      const date = new Date(item.submission_date || item.created_at);
      if (isNaN(date.getTime())) return;
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      if (!monthlyData[monthKey]) {
        monthlyData[monthKey] = {
          month: months[date.getMonth()],
          count: 0,
          amount: 0,
          processed: 0,
          pending: 0,
          rejected: 0
        };
      }
      monthlyData[monthKey].count += 1;
      monthlyData[monthKey].amount += parseFloat(item.total_amount || 0);
      
      if (item.status === 'Processed') monthlyData[monthKey].processed += 1;
      else if (['Pending', 'Submitted', 'Queued', 'Draft'].includes(item.status)) monthlyData[monthKey].pending += 1;
      else if (['Rejected', 'Error'].includes(item.status)) monthlyData[monthKey].rejected += 1;
    });

    const trendsArray = Object.values(monthlyData);
    setMonthlyTrends(trendsArray.slice(-6));
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
      case 'Processed': return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'Partial': return <CheckCircle2 className="h-4 w-4 text-yellow-500" />;
      case 'Pending':
      case 'Submitted':
      case 'Queued': return <Clock className="h-4 w-4 text-blue-500" />;
      case 'Draft': return <Layers className="h-4 w-4 text-gray-500" />;
      case 'Rejected':
      case 'Error': return <AlertCircle className="h-4 w-4 text-red-500" />;
      default: return null;
    }
  };

  // Generate batch identifier options
  const generateBatchIdentifierOptions = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const timestamp = Date.now();
    const shortId = timestamp.toString().slice(-6);
    
    return [
      { value: `BATCH-${year}${month}${day}-${shortId}`, label: `BATCH-${year}${month}${day}-${shortId} (Date + ID)` },
      { value: `BATCH-${year}-${month}-${shortId}`, label: `BATCH-${year}-${month}-${shortId} (Year-Month + ID)` },
      { value: `CLM-BATCH-${shortId}`, label: `CLM-BATCH-${shortId} (Simple)` },
      { value: `MONTHLY-${year}${month}-${shortId}`, label: `MONTHLY-${year}${month}-${shortId} (Monthly)` },
      { value: `WEEKLY-${year}W${getWeekNumber(now)}-${shortId}`, label: `WEEKLY-${year}W${getWeekNumber(now)}-${shortId} (Weekly)` },
      { value: `DAILY-${year}${month}${day}-${shortId}`, label: `DAILY-${year}${month}${day}-${shortId} (Daily)` },
    ];
  };

  const getWeekNumber = (date) => {
    const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
    const pastDaysOfYear = (date - firstDayOfYear) / 86400000;
    return String(Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7)).padStart(2, '0');
  };

  const [batchIdentifierOptions, setBatchIdentifierOptions] = useState([]);

  // Batch creation handlers
  const openCreateModal = () => {
    setShowCreateModal(true);
    setSelectedClaims([]);
    setFilterClaimType(''); // Reset claim type filter
    const options = generateBatchIdentifierOptions();
    setBatchIdentifierOptions(options);
    setBatchForm({
      batch_identifier: options[0].value,
      batch_period_start: new Date().toISOString().split('T')[0],
      batch_period_end: new Date().toISOString().split('T')[0],
      description: ''
    });
    loadAvailableClaims();
  };

  // Get unique claim types from available claims
  const getUniqueClaimTypes = () => {
    const types = new Set();
    availableClaims.forEach(c => {
      if (c.claim_type) types.add(c.claim_type);
    });
    return Array.from(types);
  };

  // Get filtered claims based on selected claim type
  const getFilteredClaims = () => {
    if (!filterClaimType) return availableClaims;
    return availableClaims.filter(c => c.claim_type === filterClaimType);
  };

  const handleClaimSelect = (claimId) => {
    const filteredClaims = getFilteredClaims();
    setSelectedClaims(prev => {
      if (prev.includes(claimId)) {
        return prev.filter(id => id !== claimId);
      } else {
        // Check if we're at 200 limit
        if (prev.length >= 200) {
          alert('Maximum 200 claims per batch');
          return prev;
        }
        // Check insurer consistency
        const claim = filteredClaims.find(c => c.id === claimId);
        if (prev.length > 0) {
          const firstClaim = filteredClaims.find(c => c.id === prev[0]);
          if (claim.insurer_id !== firstClaim.insurer_id) {
            alert('All claims in a batch must be for the same insurer');
            return prev;
          }
          // Check claim type consistency
          if (claim.claim_type !== firstClaim.claim_type) {
            alert('All claims in a batch must be of the same type');
            return prev;
          }
        }
        return [...prev, claimId];
      }
    });
  };

  const handleSelectAllClaims = () => {
    const filteredClaims = getFilteredClaims();
    if (selectedClaims.length === filteredClaims.length) {
      setSelectedClaims([]);
    } else {
      // Only select claims with same insurer and type as first one
      if (filteredClaims.length > 0) {
        const firstInsurer = filteredClaims[0].insurer_id;
        const firstType = filteredClaims[0].claim_type;
        const compatibleClaims = filteredClaims
          .filter(c => c.insurer_id === firstInsurer && c.claim_type === firstType)
          .slice(0, 200)
          .map(c => c.id);
        setSelectedClaims(compatibleClaims);
      }
    }
  };

  const handleCreateBatch = async () => {
    if (selectedClaims.length < 2) {
      alert('Please select at least 2 claims for the batch');
      return;
    }

    try {
      setCreateLoading(true);
      const response = await api.createClaimBatch({
        ...batchForm,
        claim_ids: selectedClaims
      });

      if (response.data) {
        setShowCreateModal(false);
        loadClaimBatches();
        loadStats();
        // Navigate to the new batch details
        setSelectedBatch(response.data);
      }
    } catch (error) {
      console.error('Error creating batch:', error);
      alert(error.response?.data?.error || 'Failed to create batch');
    } finally {
      setCreateLoading(false);
    }
  };

  // Batch action handlers
  const handleSendToNphies = async (batchId) => {
    if (!confirm('Are you sure you want to submit this batch to NPHIES?')) return;

    try {
      setActionLoading(batchId);
      const response = await api.sendBatchToNphies(batchId);
      
      if (response.success) {
        alert(response.message || 'Batch submitted successfully');
        loadClaimBatches();
        if (selectedBatch?.id === batchId) {
          const updatedBatch = await api.getClaimBatch(batchId);
          setSelectedBatch(updatedBatch.data);
        }
      } else {
        alert(response.error || 'Failed to submit batch');
      }
    } catch (error) {
      console.error('Error sending batch to NPHIES:', error);
      alert(error.response?.data?.error || 'Failed to submit batch');
    } finally {
      setActionLoading(null);
    }
  };

  const handlePollResponses = async (batchId) => {
    try {
      setActionLoading(batchId);
      const response = await api.pollBatchResponses(batchId);
      
      if (response.success) {
        alert(response.pollResult?.message || 'Poll completed');
        loadClaimBatches();
        if (selectedBatch?.id === batchId) {
          const updatedBatch = await api.getClaimBatch(batchId);
          setSelectedBatch(updatedBatch.data);
        }
      }
    } catch (error) {
      console.error('Error polling responses:', error);
      alert(error.response?.data?.error || 'Failed to poll responses');
    } finally {
      setActionLoading(null);
    }
  };

  const handlePreviewBundle = async (batchId) => {
    try {
      setActionLoading(batchId);
      const response = await api.previewBatchBundle(batchId);
      // response.data is now an array of bundles (one per claim)
      setBundlePreview(response);
      setShowBundlePreview(true);
    } catch (error) {
      console.error('Error previewing bundle:', error);
      alert(error.response?.data?.error || 'Failed to preview bundle');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteBatch = async (batchId) => {
    if (!confirm('Are you sure you want to delete this batch? Claims will be removed from the batch but not deleted.')) return;

    try {
      setActionLoading(batchId);
      await api.deleteClaimBatch(batchId);
      loadClaimBatches();
      loadStats();
      if (selectedBatch?.id === batchId) {
        setSelectedBatch(null);
      }
    } catch (error) {
      console.error('Error deleting batch:', error);
      alert(error.response?.data?.error || 'Failed to delete batch');
    } finally {
      setActionLoading(null);
    }
  };

  const columns = [
    {
      key: 'batch_identifier',
      header: 'Batch ID',
      accessor: 'batch_identifier',
      render: (row) => (
        <div className="flex items-center space-x-2">
          {getStatusIcon(row.status)}
          <span className="font-medium">{row.batch_identifier}</span>
        </div>
      )
    },
    {
      key: 'status',
      header: 'Status',
      accessor: 'status',
      render: (row) => (
        <Badge variant={getStatusBadge(row.status)}>
          {row.status}
        </Badge>
      )
    },
    {
      key: 'total_claims',
      header: 'Claims',
      accessor: 'total_claims',
      render: (row) => row.total_claims || row.claim_count || 0
    },
    {
      key: 'total_amount',
      header: 'Total Amount',
      accessor: 'total_amount',
      render: (row) => `SAR ${parseFloat(row.total_amount || 0).toLocaleString()}`
    },
    {
      key: 'provider_name',
      header: 'Provider',
      accessor: 'provider_name'
    },
    {
      key: 'insurer_name',
      header: 'Insurer',
      accessor: 'insurer_name'
    },
    {
      key: 'created_at',
      header: 'Created',
      accessor: 'created_at',
      render: (row) => new Date(row.created_at).toLocaleDateString()
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (row) => (
        <div className="flex items-center space-x-2">
          {row.status === 'Draft' && (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={(e) => { e.stopPropagation(); handlePreviewBundle(row.id); }}
                disabled={actionLoading === row.id}
              >
                <Eye className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                onClick={(e) => { e.stopPropagation(); handleSendToNphies(row.id); }}
                disabled={actionLoading === row.id}
              >
                <Send className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={(e) => { e.stopPropagation(); handleDeleteBatch(row.id); }}
                disabled={actionLoading === row.id}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </>
          )}
          {['Submitted', 'Queued', 'Partial'].includes(row.status) && (
            <Button
              size="sm"
              variant="outline"
              onClick={(e) => { e.stopPropagation(); handlePollResponses(row.id); }}
              disabled={actionLoading === row.id}
            >
              <RefreshCw className={`h-4 w-4 ${actionLoading === row.id ? 'animate-spin' : ''}`} />
            </Button>
          )}
        </div>
      )
    }
  ];

  // Drill-down handlers
  const handleStatusClick = (data) => {
    setDrillDownTitle(`Batches with Status: ${data.name}`);
    setDrillDownData(claimBatches.filter(item => item.status === data.name));
    setShowDrillDown(true);
  };

  const handleInsurerClick = (data) => {
    setDrillDownTitle(`Batches for Insurer: ${data.name}`);
    setDrillDownData(claimBatches.filter(item => item.insurer_name === data.name));
    setShowDrillDown(true);
  };

  const handleProviderClick = (data) => {
    setDrillDownTitle(`Batches for Provider: ${data.name}`);
    setDrillDownData(claimBatches.filter(item => item.provider_name === data.name));
    setShowDrillDown(true);
  };

  const handleRowClick = (batch) => {
    // Navigate to batch details page
    navigate(`/claim-batches/${batch.id}`);
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

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="relative bg-white rounded-2xl p-8 border border-gray-100">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold text-gray-900">Batch Claims</h1>
            <p className="text-gray-600 mt-2 text-lg">Create and manage NPHIES batch claim submissions</p>
            <div className="flex items-center space-x-4 mt-4">
              <div className="flex items-center space-x-2 text-sm text-gray-500">
                <div className="w-2 h-2 bg-accent-cyan rounded-full animate-pulse"></div>
                <span>System Active</span>
              </div>
              <div className="text-sm text-gray-500">
                Total Batches: {claimBatches.length}
              </div>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <Button onClick={openCreateModal} className="bg-gradient-to-r from-primary-purple to-accent-purple">
              <Plus className="h-5 w-5 mr-2" />
              Create Batch
            </Button>
            <div className="bg-white rounded-xl p-3 border border-gray-100">
              <Package className="h-8 w-8 text-primary-purple" />
            </div>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <Card className="bg-gradient-to-br from-blue-50 to-white">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Total Batches</p>
                  <p className="text-2xl font-bold">{stats.total_batches || 0}</p>
                </div>
                <Package className="h-8 w-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-gray-50 to-white">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Draft</p>
                  <p className="text-2xl font-bold">{stats.draft_batches || 0}</p>
                </div>
                <Layers className="h-8 w-8 text-gray-500" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-yellow-50 to-white">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Pending</p>
                  <p className="text-2xl font-bold">{stats.pending_batches || 0}</p>
                </div>
                <Clock className="h-8 w-8 text-yellow-500" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-green-50 to-white">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Processed</p>
                  <p className="text-2xl font-bold">{stats.processed_batches || 0}</p>
                </div>
                <CheckCircle2 className="h-8 w-8 text-green-500" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-red-50 to-white">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Rejected</p>
                  <p className="text-2xl font-bold">{stats.rejected_batches || 0}</p>
                </div>
                <AlertCircle className="h-8 w-8 text-red-500" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Status Chart */}
        <Card className="bg-white border-0">
          <CardHeader>
            <CardTitle className="flex items-center">
              <Package className="h-6 w-6 text-primary-purple mr-2" />
              Batches by Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={batchesByStatus}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    dataKey="value"
                    onClick={handleStatusClick}
                    style={{ cursor: 'pointer' }}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  >
                    {batchesByStatus.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Insurer Chart */}
        <Card className="bg-white border-0">
          <CardHeader>
            <CardTitle className="flex items-center">
              <Shield className="h-6 w-6 text-primary-purple mr-2" />
              Batches by Insurer
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={batchesByInsurer} onClick={handleInsurerClick}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} fontSize={12} />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="value" fill="#553781" style={{ cursor: 'pointer' }} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Data Table */}
      <Card className="bg-white border-0">
        <CardHeader>
          <CardTitle className="flex items-center">
            <Package className="h-6 w-6 text-primary-purple mr-2" />
            All Batches
          </CardTitle>
          <CardDescription>Click on a batch to view details</CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable
            data={claimBatches}
            columns={columns}
            onRowClick={handleRowClick}
            searchable={true}
            sortable={true}
            pageSize={10}
          />
        </CardContent>
      </Card>

      {/* Create Batch Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden">
            <div className="bg-gradient-to-r from-primary-purple to-accent-purple p-6 text-white">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-2xl font-bold">Create Batch Claim</h2>
                  <p className="text-white/80 mt-1">Select approved authorization items to submit as batch claim</p>
                </div>
                <button onClick={() => setShowCreateModal(false)} className="text-white/80 hover:text-white p-2">
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            <div className="p-6 overflow-y-auto max-h-[60vh]">
              {/* Batch Form */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div>
                  <Label>Batch Identifier</Label>
                  <Select
                    value={batchForm.batch_identifier}
                    onValueChange={(value) => setBatchForm(prev => ({ ...prev, batch_identifier: value }))}
                    placeholder="Select batch identifier format"
                  >
                    <SelectContent>
                      {batchIdentifierOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Description</Label>
                  <Input
                    value={batchForm.description}
                    onChange={(e) => setBatchForm(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Optional description"
                  />
                </div>
                <div>
                  <Label>Period Start</Label>
                  <Input
                    type="date"
                    value={batchForm.batch_period_start}
                    onChange={(e) => setBatchForm(prev => ({ ...prev, batch_period_start: e.target.value }))}
                  />
                </div>
                <div>
                  <Label>Period End</Label>
                  <Input
                    type="date"
                    value={batchForm.batch_period_end}
                    onChange={(e) => setBatchForm(prev => ({ ...prev, batch_period_end: e.target.value }))}
                  />
                </div>
              </div>

              {/* Claim Type Filter */}
              <div className="mb-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <Label className="text-blue-800 font-medium">Filter by Claim Type:</Label>
                    <select
                      value={filterClaimType}
                      onChange={(e) => {
                        setFilterClaimType(e.target.value);
                        setSelectedClaims([]); // Reset selection when filter changes
                      }}
                      className="px-3 py-2 border border-blue-300 rounded-lg bg-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="">All Types ({availableClaims.length} items)</option>
                      {getUniqueClaimTypes().map(type => (
                        <option key={type} value={type}>
                          {type.charAt(0).toUpperCase() + type.slice(1)} ({availableClaims.filter(c => c.claim_type === type).length} items)
                        </option>
                      ))}
                    </select>
                  </div>
                  {filterClaimType && (
                    <span className="text-sm text-blue-600">
                      Showing {getFilteredClaims().length} {filterClaimType} claims
                    </span>
                  )}
                </div>
                <p className="text-xs text-blue-600 mt-2">
                  <AlertCircle className="w-3 h-3 inline mr-1" />
                  NPHIES requires all claims in a batch to be of the same type (e.g., all oral, all vision, etc.)
                </p>
              </div>

              {/* Selection Info */}
              <div className="flex items-center justify-between mb-4 p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center space-x-4">
                  <span className="font-medium">Selected Items: {selectedClaims.length} / 200</span>
                  {selectedClaims.length > 0 && (
                    <span className="text-sm text-gray-500">
                      Total Amount: SAR {getFilteredClaims()
                        .filter(c => selectedClaims.includes(c.id))
                        .reduce((sum, c) => sum + parseFloat(c.total_amount || 0), 0)
                        .toLocaleString()}
                    </span>
                  )}
                </div>
                <Button variant="outline" size="sm" onClick={handleSelectAllClaims}>
                  {selectedClaims.length === getFilteredClaims().length && getFilteredClaims().length > 0 ? 'Deselect All' : 'Select All (Same Insurer & Type)'}
                </Button>
              </div>

              {/* Approved Auth Items List */}
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Select</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Auth Request #</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Type</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Service</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Patient</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Insurer</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Amount</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {getFilteredClaims().map((item) => (
                      <tr 
                        key={item.id} 
                        className={`hover:bg-gray-50 cursor-pointer ${selectedClaims.includes(item.id) ? 'bg-purple-50' : ''}`}
                        onClick={() => handleClaimSelect(item.id)}
                      >
                        <td className="px-4 py-3">
                          <Checkbox 
                            checked={selectedClaims.includes(item.id)}
                            onCheckedChange={() => handleClaimSelect(item.id)}
                          />
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <div className="flex flex-col">
                            <span className="font-medium">{item.auth_request_number}</span>
                            <span className="text-xs text-gray-400">Item #{item.sequence}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <Badge 
                            variant="outline" 
                            className={`text-xs ${
                              item.claim_type === 'oral' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                              item.claim_type === 'dental' ? 'bg-cyan-50 text-cyan-700 border-cyan-200' :
                              item.claim_type === 'vision' ? 'bg-purple-50 text-purple-700 border-purple-200' :
                              item.claim_type === 'pharmacy' ? 'bg-green-50 text-green-700 border-green-200' :
                              item.claim_type === 'professional' ? 'bg-orange-50 text-orange-700 border-orange-200' :
                              item.claim_type === 'institutional' ? 'bg-red-50 text-red-700 border-red-200' :
                              'bg-gray-50 text-gray-700 border-gray-200'
                            }`}
                          >
                            {item.claim_type ? item.claim_type.charAt(0).toUpperCase() + item.claim_type.slice(1) : 'N/A'}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <div className="flex flex-col">
                            <span className="font-medium">{item.product_code}</span>
                            <span className="text-xs text-gray-400 truncate max-w-[200px]" title={item.product_display}>
                              {item.product_display}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm">{item.patient_name}</td>
                        <td className="px-4 py-3 text-sm">{item.insurer_name}</td>
                        <td className="px-4 py-3 text-sm">SAR {parseFloat(item.total_amount || 0).toLocaleString()}</td>
                        <td className="px-4 py-3 text-sm">
                          <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
                            {item.status === 'approved' ? 'Approved' : item.status}
                          </Badge>
                          {item.pre_auth_ref && (
                            <span className="text-xs text-gray-400 block mt-0.5">
                              Ref: {item.pre_auth_ref}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                    {getFilteredClaims().length === 0 && (
                      <tr>
                        <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                          {filterClaimType 
                            ? `No approved ${filterClaimType} authorization items available. Try selecting a different claim type.`
                            : 'No approved authorization items available for batching. Submit prior authorizations and get them approved first.'
                          }
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="bg-gray-50 px-6 py-4 border-t flex justify-between items-center">
              <p className="text-sm text-gray-500">
                {selectedClaims.length < 2 ? 'Select at least 2 approved items' : `${selectedClaims.length} approved items selected`}
              </p>
              <div className="flex space-x-3">
                <Button variant="outline" onClick={() => setShowCreateModal(false)}>Cancel</Button>
                <Button 
                  onClick={handleCreateBatch} 
                  disabled={selectedClaims.length < 2 || createLoading}
                  className="bg-gradient-to-r from-primary-purple to-accent-purple"
                >
                  {createLoading ? 'Creating...' : 'Create Batch Claim'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Batch Detail Modal */}
      {selectedBatch && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-5xl w-full max-h-[90vh] overflow-hidden">
            <div className="bg-gradient-to-r from-primary-purple to-accent-purple p-6 text-white">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-2xl font-bold">Batch: {selectedBatch.batch_identifier}</h2>
                  <p className="text-white/80 mt-1">
                    <Badge variant="secondary" className="bg-white/20 text-white">
                      {selectedBatch.status}
                    </Badge>
                  </p>
                </div>
                <button onClick={() => setSelectedBatch(null)} className="text-white/80 hover:text-white p-2">
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            <div className="p-6 overflow-y-auto max-h-[60vh]">
              {/* Batch Info */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-sm text-gray-500">Total Claims</p>
                  <p className="text-2xl font-bold">{selectedBatch.total_claims || selectedBatch.claims?.length || 0}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-sm text-gray-500">Total Amount</p>
                  <p className="text-2xl font-bold">SAR {parseFloat(selectedBatch.total_amount || 0).toLocaleString()}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-sm text-gray-500">Approved</p>
                  <p className="text-2xl font-bold text-green-600">{selectedBatch.approved_claims || selectedBatch.statistics?.approved_claims || 0}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-sm text-gray-500">Rejected</p>
                  <p className="text-2xl font-bold text-red-600">{selectedBatch.rejected_claims || selectedBatch.statistics?.rejected_claims || 0}</p>
                </div>
              </div>

              {/* Provider/Insurer Info */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="flex items-center space-x-3 bg-gray-50 rounded-lg p-4">
                  <Building2 className="h-8 w-8 text-primary-purple" />
                  <div>
                    <p className="text-sm text-gray-500">Provider</p>
                    <p className="font-semibold">{selectedBatch.provider_name}</p>
                  </div>
                </div>
                <div className="flex items-center space-x-3 bg-gray-50 rounded-lg p-4">
                  <Shield className="h-8 w-8 text-accent-purple" />
                  <div>
                    <p className="text-sm text-gray-500">Insurer</p>
                    <p className="font-semibold">{selectedBatch.insurer_name}</p>
                  </div>
                </div>
              </div>

              {/* Claims in Batch */}
              {selectedBatch.claims && selectedBatch.claims.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold mb-3">Claims in Batch</h3>
                  <div className="border rounded-lg overflow-hidden">
                    <table className="w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">#</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Claim Number</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Patient</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Amount</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {selectedBatch.claims.map((claim, index) => (
                          <tr key={claim.id} className="hover:bg-gray-50">
                            <td className="px-4 py-3 text-sm">{claim.batch_number || index + 1}</td>
                            <td className="px-4 py-3 text-sm font-medium">{claim.claim_number}</td>
                            <td className="px-4 py-3 text-sm">{claim.patient_name}</td>
                            <td className="px-4 py-3 text-sm">SAR {parseFloat(claim.total_amount || 0).toLocaleString()}</td>
                            <td className="px-4 py-3">
                              <Badge variant={getStatusBadge(claim.status)}>{claim.status}</Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Errors */}
              {selectedBatch.errors && selectedBatch.errors.length > 0 && (
                <div className="mt-6">
                  <h3 className="text-lg font-semibold mb-3 text-red-600">Errors</h3>
                  <div className="bg-red-50 rounded-lg p-4">
                    {selectedBatch.errors.map((error, index) => (
                      <div key={index} className="text-sm text-red-700 mb-2">
                        {error.code && <span className="font-semibold">[{error.code}]</span>} {error.message}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="bg-gray-50 px-6 py-4 border-t flex justify-between items-center">
              <div className="text-sm text-gray-500">
                Created: {new Date(selectedBatch.created_at).toLocaleString()}
              </div>
              <div className="flex space-x-3">
                {selectedBatch.status === 'Draft' && (
                  <>
                    <Button variant="outline" onClick={() => handlePreviewBundle(selectedBatch.id)}>
                      <Eye className="h-4 w-4 mr-2" />
                      Preview Bundle
                    </Button>
                    <Button onClick={() => handleSendToNphies(selectedBatch.id)} className="bg-gradient-to-r from-primary-purple to-accent-purple">
                      <Send className="h-4 w-4 mr-2" />
                      Send to NPHIES
                    </Button>
                  </>
                )}
                {['Submitted', 'Queued', 'Partial'].includes(selectedBatch.status) && (
                  <Button onClick={() => handlePollResponses(selectedBatch.id)} variant="outline">
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Poll Responses
                  </Button>
                )}
                <Button variant="outline" onClick={() => setSelectedBatch(null)}>Close</Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bundle Preview Modal */}
      {showBundlePreview && bundlePreview && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden">
            <div className="bg-gradient-to-r from-primary-purple to-accent-purple p-6 text-white">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-2xl font-bold">FHIR Bundles Preview</h2>
                  <p className="text-white/80 mt-1">
                    {bundlePreview?.bundleCount || bundlePreview?.data?.length || 0} separate bundles will be sent to NPHIES
                  </p>
                </div>
                <button onClick={() => setShowBundlePreview(false)} className="text-white/80 hover:text-white p-2">
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>
            
            {/* Bundle Summary */}
            <div className="px-6 py-4 bg-gray-50 border-b">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <span className="text-gray-500">Total Bundles:</span>
                  <span className="ml-2 font-medium">{bundlePreview?.bundleCount || bundlePreview?.data?.length || 0}</span>
                </div>
                <div>
                  <span className="text-gray-500">Claims Count:</span>
                  <span className="ml-2 font-medium">{bundlePreview?.claimCount || 0}</span>
                </div>
                <div>
                  <span className="text-gray-500">Total Amount:</span>
                  <span className="ml-2 font-medium">{bundlePreview?.totalAmount?.toLocaleString() || 0} SAR</span>
                </div>
                <div>
                  <span className="text-gray-500">Structure:</span>
                  <span className="ml-2 font-medium text-xs">1 Bundle per Claim</span>
                </div>
              </div>
              {bundlePreview?.note && (
                <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700">
                  <strong>Note:</strong> {bundlePreview.note}
                </div>
              )}
            </div>

            <div className="p-6 overflow-y-auto max-h-[50vh]">
              {/* Show each bundle separately */}
              {Array.isArray(bundlePreview?.data) ? (
                <div className="space-y-4">
                  {bundlePreview.data.map((bundle, index) => (
                    <div key={index} className="border rounded-lg overflow-hidden">
                      <div className="bg-gray-100 px-4 py-2 flex justify-between items-center">
                        <span className="font-medium">Bundle {index + 1} - Claim #{bundle._batchMetadata?.batchNumber || index + 1}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-500">
                            {bundle.entry?.length || 0} entries
                          </span>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={async () => {
                              try {
                                // Clean bundle by removing _batchMetadata
                                const cleanBundle = cleanBundleForNphies(bundle);
                                const jsonString = JSON.stringify(cleanBundle, null, 2);
                                await navigator.clipboard.writeText(jsonString);
                                alert(`Bundle ${index + 1} copied to clipboard!`);
                              } catch (err) {
                                console.error('Failed to copy:', err);
                              }
                            }}
                            className="h-7 px-2 text-xs"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1">
                              <rect width="14" height="14" x="8" y="8" rx="2" ry="2"/>
                              <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>
                            </svg>
                            Copy
                          </Button>
                        </div>
                      </div>
                      <pre className="bg-gray-900 text-green-400 p-4 overflow-x-auto text-sm font-mono leading-relaxed max-h-[300px] overflow-y-auto whitespace-pre-wrap break-all select-all">
                        {JSON.stringify(bundle, null, 2)}
                      </pre>
                    </div>
                  ))}
                </div>
              ) : (
                <pre className="bg-gray-900 text-green-400 p-4 rounded-lg overflow-x-auto text-sm font-mono leading-relaxed whitespace-pre-wrap break-all select-all">
                  {JSON.stringify(bundlePreview?.data || bundlePreview, null, 2)}
                </pre>
              )}
            </div>
            
            <div className="bg-gray-50 px-6 py-4 border-t flex justify-between items-center">
              <span className="text-sm text-gray-500">
                Total Size: {(JSON.stringify(bundlePreview?.data || bundlePreview).length / 1024).toFixed(2)} KB
              </span>
              <div className="flex gap-3">
                <Button 
                  variant={copySuccess ? "default" : "outline"}
                  onClick={async () => {
                    try {
                      const rawData = bundlePreview?.data || bundlePreview;
                      // Clean each bundle by removing _batchMetadata (internal use only)
                      const dataToCopy = Array.isArray(rawData) 
                        ? rawData.map(cleanBundleForNphies)
                        : cleanBundleForNphies(rawData);
                      const jsonString = JSON.stringify(dataToCopy, null, 2);
                      
                      if (navigator.clipboard && navigator.clipboard.writeText) {
                        await navigator.clipboard.writeText(jsonString);
                      } else {
                        // Fallback for older browsers
                        const textArea = document.createElement('textarea');
                        textArea.value = jsonString;
                        textArea.style.position = 'fixed';
                        textArea.style.left = '-9999px';
                        textArea.style.top = '-9999px';
                        document.body.appendChild(textArea);
                        textArea.focus();
                        textArea.select();
                        document.execCommand('copy');
                        document.body.removeChild(textArea);
                      }
                      
                      setCopySuccess(true);
                      setTimeout(() => setCopySuccess(false), 2000);
                    } catch (err) {
                      console.error('Failed to copy:', err);
                      alert('Failed to copy to clipboard. Please try the Download option instead.');
                    }
                  }}
                  className={copySuccess ? "bg-green-600 hover:bg-green-700 text-white flex items-center gap-2" : "flex items-center gap-2"}
                >
                  {copySuccess ? (
                    <>
                      <CheckCircle2 className="h-4 w-4" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect width="14" height="14" x="8" y="8" rx="2" ry="2"/>
                        <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>
                      </svg>
                      Copy All JSON
                    </>
                  )}
                </Button>
                <Button 
                  variant="outline"
                  onClick={() => {
                    const rawData = bundlePreview?.data || bundlePreview;
                    // Clean each bundle by removing _batchMetadata (internal use only)
                    const dataToDownload = Array.isArray(rawData) 
                      ? rawData.map(cleanBundleForNphies)
                      : cleanBundleForNphies(rawData);
                    const blob = new Blob([JSON.stringify(dataToDownload, null, 2)], { type: 'application/json' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `batch-claim-bundles-preview.json`;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                  }}
                  className="flex items-center gap-2"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                    <polyline points="7 10 12 15 17 10"/>
                    <line x1="12" x2="12" y1="15" y2="3"/>
                  </svg>
                  Download All
                </Button>
                <Button variant="outline" onClick={() => setShowBundlePreview(false)}>Close</Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Drill-down Modal */}
      {showDrillDown && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden">
            <div className="bg-gradient-to-r from-primary-purple to-accent-purple p-6 text-white">
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold">{drillDownTitle}</h2>
                <button onClick={() => setShowDrillDown(false)} className="text-white/80 hover:text-white p-2">
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>
            <div className="p-6 overflow-y-auto max-h-[60vh]">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Batch ID</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Claims</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Amount</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Provider</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Insurer</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {drillDownData.map((item) => (
                    <tr key={item.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-medium">{item.batch_identifier}</td>
                      <td className="px-4 py-3"><Badge variant={getStatusBadge(item.status)}>{item.status}</Badge></td>
                      <td className="px-4 py-3 text-sm">{item.total_claims || item.claim_count || 0}</td>
                      <td className="px-4 py-3 text-sm">SAR {parseFloat(item.total_amount || 0).toLocaleString()}</td>
                      <td className="px-4 py-3 text-sm">{item.provider_name}</td>
                      <td className="px-4 py-3 text-sm">{item.insurer_name}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="bg-gray-50 px-6 py-4 border-t flex justify-between items-center">
              <span className="text-sm text-gray-500">{drillDownData.length} batches</span>
              <Button variant="outline" onClick={() => setShowDrillDown(false)}>Close</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
