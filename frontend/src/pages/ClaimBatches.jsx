import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
  
  // Action states
  const [actionLoading, setActionLoading] = useState(null);
  
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
            <Button onClick={() => navigate('/claim-batches/create')} className="bg-gradient-to-r from-primary-purple to-accent-purple">
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
