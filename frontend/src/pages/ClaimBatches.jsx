import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import DataTable from '@/components/DataTable';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Package, Shield, Plus, Send, RefreshCw, Eye, Trash2, X, CheckCircle2, AlertCircle, Clock, Layers } from 'lucide-react';
import api, { clearApiCache } from '@/services/api';
import { useAuth } from '@/context/AuthContext';

const COLORS = ['#553781', '#9658C4', '#8572CD', '#00DEFE', '#26A69A', '#E0E7FF'];

export default function ClaimBatches() {
  const { can } = useAuth();
  const navigate = useNavigate();
  const [claimBatches, setClaimBatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  
  // Action states
  const [actionLoading, setActionLoading] = useState(null);
  
  // Chart data states
  const [batchesByStatus, setBatchesByStatus] = useState([]);
  const [batchesByInsurer, setBatchesByInsurer] = useState([]);
  
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
      let batchesData = [];
      if (Array.isArray(response.data)) {
        batchesData = response.data;
      } else if (response.data?.data && Array.isArray(response.data.data)) {
        batchesData = response.data.data;
      } else if (Array.isArray(response)) {
        batchesData = response;
      }
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

  // Batch action handlers
  const handleSendToNphies = async (batchId) => {
    if (!confirm('Are you sure you want to submit this batch to NPHIES?')) return;

    try {
      setActionLoading(batchId);
      const response = await api.sendBatchToNphies(batchId);
      
      if (response.success) {
        alert(response.message || 'Batch submitted successfully');
        loadClaimBatches();
        loadStats();
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
        loadStats();
      } else {
        alert(response.error || 'Poll failed');
      }
    } catch (error) {
      console.error('Error polling responses:', error);
      alert(error.response?.data?.error || 'Failed to poll responses');
    } finally {
      setActionLoading(null);
    }
  };

  const handlePreviewBundle = (batchId) => {
    // Navigate to the dedicated preview page
    navigate(`/claim-batches/${batchId}/preview`);
  };

  const handleDeleteBatch = async (batchId) => {
    if (!confirm('Are you sure you want to delete this batch? Claims will be removed from the batch but not deleted.')) return;

    try {
      setActionLoading(batchId);
      await api.deleteClaimBatch(batchId);
      loadClaimBatches();
      loadStats();
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
          {(row.status === 'Draft' || row.status === 'Error') && (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={(e) => { e.stopPropagation(); handlePreviewBundle(row.id); }}
                disabled={actionLoading === row.id}
                title="Preview Bundle"
              >
                <Eye className="h-4 w-4" />
              </Button>
              {can('send') && (
                <Button
                  size="sm"
                  onClick={(e) => { e.stopPropagation(); handleSendToNphies(row.id); }}
                  disabled={actionLoading === row.id}
                  title={row.status === 'Error' ? 'Retry Submission' : 'Send to NPHIES'}
                >
                  <Send className="h-4 w-4" />
                </Button>
              )}
              {row.status === 'Draft' && can('delete') && (
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={(e) => { e.stopPropagation(); handleDeleteBatch(row.id); }}
                  disabled={actionLoading === row.id}
                  title="Delete Batch"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </>
          )}
          {row.status === 'Pending' && (
            <Button
              size="sm"
              variant="outline"
              onClick={(e) => { e.stopPropagation(); navigate(`/claim-batches/${row.id}`); }}
              title="Batch is being sent - open to check status / poll"
            >
              <Clock className="h-4 w-4" />
            </Button>
          )}
          {['Submitted', 'Queued', 'Partial'].includes(row.status) && can('poll') && (
            <Button
              size="sm"
              variant="outline"
              onClick={(e) => { e.stopPropagation(); handlePollResponses(row.id); }}
              disabled={actionLoading === row.id}
              title="Poll Responses"
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
    const name = data?.payload?.name ?? data?.name;
    if (!name) return;
    setDrillDownTitle(`Batches with Status: ${name}`);
    setDrillDownData(claimBatches.filter(item => (item.status || 'Unknown') === name));
    setShowDrillDown(true);
  };

  // Per-Bar onClick receives the bar's data entry (fields are also under .payload)
  const handleInsurerClick = (data) => {
    const name = data?.payload?.name ?? data?.name;
    if (!name) return;
    setDrillDownTitle(`Batches for Insurer: ${name}`);
    setDrillDownData(claimBatches.filter(item => (item.insurer_name || 'Unknown') === name));
    setShowDrillDown(true);
  };

  // Re-fetch (bypassing the GET cache) so batches stuck in 'Pending' show their current status
  const handleRefresh = () => {
    clearApiCache();
    loadClaimBatches();
    loadStats();
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
            <Button variant="outline" onClick={handleRefresh}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
            {can('create') && (
              <Button onClick={() => navigate('/claim-batches/create')} className="bg-gradient-to-r from-primary-purple to-accent-purple">
                <Plus className="h-5 w-5 mr-2" />
                Create Batch
              </Button>
            )}
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
                <BarChart data={batchesByInsurer}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} fontSize={12} />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="value" fill="#553781" style={{ cursor: 'pointer' }} radius={[4, 4, 0, 0]} onClick={handleInsurerClick} />
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
