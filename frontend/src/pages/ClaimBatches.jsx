import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import DataTable from '@/components/DataTable';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { Package, TrendingUp, Users, DollarSign, Calendar, Building2, Shield, Receipt } from 'lucide-react';
import api from '@/services/api';

const COLORS = ['#553781', '#9658C4', '#8572CD', '#00DEFE', '#26A69A', '#E0E7FF'];

export default function ClaimBatches() {
  const [claimBatches, setClaimBatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedBatch, setSelectedBatch] = useState(null);
  
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
  }, []);

  const loadClaimBatches = async () => {
    try {
      setLoading(true);
      const response = await api.getClaimBatches({ limit: 1000 });
      const batchesData = response.data || response || [];
      setClaimBatches(batchesData);
      
      // Process chart data
      processChartData(batchesData);
    } catch (error) {
      console.error('Error loading claim batches:', error);
      // Mock data for demonstration
      const mockData = [
        {
          id: 1,
          batch_identifier: 'BATCH001',
          submission_date: '2024-01-15',
          number_of_claims: 25,
          status: 'Processed',
          total_amount: 125000,
          provider_name: 'مستشفى الملك فهد التخصصي',
          insurer_name: 'التأمين الصحي السعودي'
        },
        {
          id: 2,
          batch_identifier: 'BATCH002',
          submission_date: '2024-01-20',
          number_of_claims: 15,
          status: 'Pending',
          total_amount: 75000,
          provider_name: 'عيادة الدكتور أحمد محمد',
          insurer_name: 'بوبا العربية للتأمين'
        },
        {
          id: 3,
          batch_identifier: 'BATCH003',
          submission_date: '2024-01-18',
          number_of_claims: 8,
          status: 'Rejected',
          total_amount: 40000,
          provider_name: 'مركز الأسنان المتخصص',
          insurer_name: 'تأمين مدجلف'
        }
      ];
      setClaimBatches(mockData);
      processChartData(mockData);
    } finally {
      setLoading(false);
    }
  };

  const processChartData = (data) => {
    // Process batches by status
    const statusCounts = {};
    data.forEach(item => {
      statusCounts[item.status] = (statusCounts[item.status] || 0) + 1;
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
      const date = new Date(item.submission_date);
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
      
      if (item.status === 'Processed') {
        monthlyData[monthKey].processed += 1;
      } else if (item.status === 'Pending') {
        monthlyData[monthKey].pending += 1;
      } else if (item.status === 'Rejected') {
        monthlyData[monthKey].rejected += 1;
      }
    });

    // Convert to array and sort by date
    const trendsArray = Object.values(monthlyData).sort((a, b) => {
      const aDate = new Date(a.month + ' 1, 2024');
      const bDate = new Date(b.month + ' 1, 2024');
      return aDate - bDate;
    });

    setMonthlyTrends(trendsArray.slice(-6)); // Last 6 months
  };

  const getStatusBadge = (status) => {
    const variants = {
      'Processed': 'default',
      'Pending': 'secondary',
      'Rejected': 'destructive',
      'Under Review': 'outline'
    };
    return variants[status] || 'outline';
  };

  const columns = [
    {
      key: 'batch_identifier',
      header: 'Batch ID',
      accessor: 'batch_identifier'
    },
    {
      key: 'submission_date',
      header: 'Submission Date',
      accessor: 'submission_date',
      render: (row) => new Date(row.submission_date).toLocaleDateString()
    },
    {
      key: 'number_of_claims',
      header: 'Number of Claims',
      accessor: 'number_of_claims'
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
      key: 'total_amount',
      header: 'Total Amount',
      accessor: 'total_amount',
      render: (row) => `$${parseFloat(row.total_amount || 0).toLocaleString()}`
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
    }
  ];

  // Drill-down functions
  const handleStatusClick = async (data) => {
    try {
      setDrillDownTitle(`Claim Batches with Status: ${data.name}`);
      const filteredBatches = claimBatches.filter(item => item.status === data.name);
      setDrillDownData(filteredBatches);
      setShowDrillDown(true);
    } catch (error) {
      console.error('Error loading status drill-down data:', error);
    }
  };

  const handleInsurerClick = async (data) => {
    try {
      setDrillDownTitle(`Claim Batches for Insurer: ${data.name}`);
      const filteredBatches = claimBatches.filter(item => item.insurer_name === data.name);
      setDrillDownData(filteredBatches);
      setShowDrillDown(true);
    } catch (error) {
      console.error('Error loading insurer drill-down data:', error);
    }
  };

  const handleProviderClick = async (data) => {
    try {
      setDrillDownTitle(`Claim Batches for Provider: ${data.name}`);
      const filteredBatches = claimBatches.filter(item => item.provider_name === data.name);
      setDrillDownData(filteredBatches);
      setShowDrillDown(true);
    } catch (error) {
      console.error('Error loading provider drill-down data:', error);
    }
  };

  const handleMonthlyTrendClick = async (data) => {
    try {
      setDrillDownTitle(`Claim Batches for Month: ${data.month}`);
      const monthDate = new Date(data.month + ' 1, 2024');
      const startDate = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
      const endDate = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0);
      
      const filteredBatches = claimBatches.filter(item => {
        const submissionDate = new Date(item.submission_date);
        return submissionDate >= startDate && submissionDate <= endDate;
      });
      
      setDrillDownData(filteredBatches);
      setShowDrillDown(true);
    } catch (error) {
      console.error('Error loading monthly trend drill-down data:', error);
    }
  };

  const closeDrillDown = () => {
    setShowDrillDown(false);
    setDrillDownData([]);
    setDrillDownTitle('');
  };

  const handleRowClick = (batch) => {
    setSelectedBatch(batch);
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
      {/* Enhanced Header */}
      <div className="relative">
        <div className="relative bg-white rounded-2xl p-8 border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold text-gray-900">
                Claim Batches
              </h1>
              <p className="text-gray-600 mt-2 text-lg">Manage batches of claims submitted to insurers</p>
              <div className="flex items-center space-x-4 mt-4">
                <div className="flex items-center space-x-2 text-sm text-gray-500">
                  <div className="w-2 h-2 bg-accent-cyan rounded-full animate-pulse"></div>
                  <span>System Active</span>
                </div>
                <div className="text-sm text-gray-500">
                  Total Batches: {claimBatches.length}
                </div>
                <div className="text-sm text-gray-500">
                  Last updated: {new Date().toLocaleTimeString()}
                </div>
              </div>
            </div>
            <div className="hidden md:flex items-center space-x-3">
              <div className="relative">
 
                <div className="relative bg-white rounded-xl p-3 border border-gray-100">
                  <Package className="h-8 w-8 text-primary-purple" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Enhanced Claim Batches by Status Donut Chart */}
        <div className="relative group">
 
          <Card className="relative bg-white border-0 transition-all duration-300 hover:-translate-y-2">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center text-gray-900">
                <div className="relative mr-3">
                  <div className="absolute -inset-1 bg-primary-purple/20 rounded-lg"></div>
                  <div className="relative from-primary-purple/10 to-accent-purple/10 rounded-lg p-2">
                    <Package className="h-6 w-6 text-primary-purple" />
                  </div>
                </div>
                <div>
                  <h3 className="text-xl font-bold">Claim Batches by Status</h3>
                  <p className="text-sm text-gray-600 font-medium">Distribution of batch statuses (Processed, Pending, Rejected, etc.)</p>
                </div>
              </CardTitle>
            </CardHeader>
          <CardContent>
            <div className="h-[400px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={batchesByStatus}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    innerRadius={60}
                    outerRadius={120}
                    fill="#2196F3"
                    dataKey="value"
                    onClick={handleStatusClick}
                    style={{ cursor: 'pointer' }}
                  >
                    {batchesByStatus.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{
                      backgroundColor: '#FFFFFF',
                      border: '1px solid #E5E7EB',
                      borderRadius: '8px',
                      boxShadow: 'none'
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
          </Card>
        </div>

        {/* Enhanced Claim Batches by Insurer Bar Chart */}
        <div className="relative group">
 
          <Card className="relative bg-white border-0 transition-all duration-300 hover:-translate-y-2">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center text-gray-900">
                <div className="relative mr-3">
                  <div className="absolute -inset-1 bg-primary-purple/20 rounded-lg"></div>
                  <div className="relative from-primary-purple/10 to-accent-purple/10 rounded-lg p-2">
                    <DollarSign className="h-6 w-6 text-primary-purple" />
                  </div>
                </div>
                <div>
                  <h3 className="text-xl font-bold">Claim Batches by Insurer</h3>
                  <p className="text-sm text-gray-600 font-medium">Number of claim batches by each insurer</p>
                </div>
              </CardTitle>
            </CardHeader>
          <CardContent>
            <div className="h-[400px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={batchesByInsurer} onClick={handleInsurerClick}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                  <XAxis dataKey="name" angle={-45} textAnchor="end" height={120} stroke="#6B7280" />
                  <YAxis stroke="#6B7280" />
                  <Tooltip 
                    contentStyle={{
                      backgroundColor: '#FFFFFF',
                      border: '1px solid #E5E7EB',
                      borderRadius: '8px',
                      boxShadow: 'none'
                    }}
                    formatter={(value, name) => [
                      name === 'amount' ? `$${value.toLocaleString()}` : value,
                      name === 'amount' ? 'Total Amount' : 'Batches'
                    ]} 
                  />
                  <Bar dataKey="value" fill="#059669" style={{ cursor: 'pointer' }} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
          </Card>
        </div>

        {/* Enhanced Daily Trends Line Chart */}
        <div className="relative group">
 
          <Card className="relative bg-white border-0 transition-all duration-300 hover:-translate-y-2">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center text-gray-900">
                <div className="relative mr-3">
                  <div className="absolute -inset-1 bg-primary-purple/20 rounded-lg"></div>
                  <div className="relative from-primary-purple/10 to-accent-purple/10 rounded-lg p-2">
                    <TrendingUp className="h-6 w-6 text-primary-purple" />
                  </div>
                </div>
                <div>
                  <h3 className="text-xl font-bold">Daily Batch Trends</h3>
                  <p className="text-sm text-gray-600 font-medium">Claim batch processing trends over the last 30 days</p>
                </div>
              </CardTitle>
            </CardHeader>
          <CardContent>
            <div className="h-[400px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={monthlyTrends} onClick={handleMonthlyTrendClick}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                  <XAxis 
                    dataKey="day" 
                    stroke="#6B7280" 
                    angle={-45}
                    textAnchor="end"
                    height={80}
                    fontSize={12}
                  />
                  <YAxis yAxisId="left" stroke="#6B7280" />
                  <YAxis yAxisId="right" orientation="right" stroke="#6B7280" />
                  <Tooltip 
                    contentStyle={{
                      backgroundColor: '#FFFFFF',
                      border: '1px solid #E5E7EB',
                      borderRadius: '8px',
                      boxShadow: 'none'
                    }}
                    formatter={(value, name) => [
                      name === 'amount' ? `$${value.toLocaleString()}` : value,
                      name === 'amount' ? 'Total Amount' : 
                      name === 'processed' ? 'Processed' :
                      name === 'pending' ? 'Pending' :
                      name === 'rejected' ? 'Rejected' : 'Total'
                    ]}
                  />
                  <Line yAxisId="left" type="monotone" dataKey="processed" stroke="#059669" strokeWidth={2} name="processed" style={{ cursor: 'pointer' }} />
                  <Line yAxisId="left" type="monotone" dataKey="pending" stroke="#10B981" strokeWidth={2} name="pending" style={{ cursor: 'pointer' }} />
                  <Line yAxisId="left" type="monotone" dataKey="rejected" stroke="#34D399" strokeWidth={2} name="rejected" style={{ cursor: 'pointer' }} />
                  <Line yAxisId="right" type="monotone" dataKey="amount" stroke="#6EE7B7" strokeWidth={2} name="amount" style={{ cursor: 'pointer' }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
          </Card>
        </div>

        {/* Enhanced Claim Batches by Provider Bar Chart */}
        <div className="relative group">
 
          <Card className="relative bg-white border-0 transition-all duration-300 hover:-translate-y-2">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center text-gray-900">
                <div className="relative mr-3">
                  <div className="absolute -inset-1 bg-primary-purple/20 rounded-lg"></div>
                  <div className="relative from-primary-purple/10 to-accent-purple/10 rounded-lg p-2">
                    <Users className="h-6 w-6 text-primary-purple" />
                  </div>
                </div>
                <div>
                  <h3 className="text-xl font-bold">Claim Batches by Provider</h3>
                  <p className="text-sm text-gray-600 font-medium">Number of claim batches submitted by each provider</p>
                </div>
              </CardTitle>
            </CardHeader>
          <CardContent>
            <div className="h-[400px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={batchesByProvider} onClick={handleProviderClick}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                  <XAxis dataKey="name" angle={-45} textAnchor="end" height={120} stroke="#6B7280" />
                  <YAxis stroke="#6B7280" />
                  <Tooltip 
                    contentStyle={{
                      backgroundColor: '#FFFFFF',
                      border: '1px solid #E5E7EB',
                      borderRadius: '8px',
                      boxShadow: 'none'
                    }}
                    formatter={(value) => [value, 'Claim Batches']} 
                  />
                  <Bar dataKey="value" fill="#059669" style={{ cursor: 'pointer' }} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
          </Card>
        </div>
      </div>

      {/* Enhanced Claim Batches Data Table */}
      <div className="relative group">
 
        <Card className="relative bg-white border-0 transition-all duration-300 hover:-translate-y-2">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center text-gray-900">
              <div className="relative mr-3">
                <div className="absolute -inset-1 bg-primary-purple/20 rounded-lg"></div>
                <div className="relative from-primary-purple/10 to-accent-purple/10 rounded-lg p-2">
                  <Package className="h-6 w-6 text-primary-purple" />
                </div>
              </div>
              <div>
                <h3 className="text-xl font-bold">Claim Batches</h3>
                <p className="text-sm text-gray-600 font-medium">Track and manage batches of claims submitted to insurance providers</p>
              </div>
            </CardTitle>
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
      </div>

      {/* Enhanced Batch Detail Modal */}
      {selectedBatch && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="relative bg-white rounded-3xl max-w-4xl w-full max-h-[90vh] overflow-hidden ">
 
            <div className="relative bg-white rounded-3xl overflow-hidden">
              {/* Enhanced Header */}
              <div className="bg-gradient-to-r from-primary-purple to-accent-purple p-6 text-white">
                <div className="flex justify-between items-center">
                  <div className="flex items-center space-x-3">
                    <div className="relative">
 
                      <div className="relative bg-white/20 rounded-full p-2">
                        <Package className="h-6 w-6" />
                      </div>
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold">Batch Details</h2>
                      <p className="text-white/80 mt-1">Comprehensive batch information</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedBatch(null)}
                    className="text-white/80 hover:text-white hover:bg-white/20 p-2 rounded-xl transition-all duration-200"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Batch Information Grid */}
              <div className="p-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="relative group">
 
                    <div className="relative bg-gray-50 rounded-xl p-4">
                      <div className="flex items-center space-x-3">
                        <div className="bg-primary-purple/10 rounded-lg p-2">
                          <Package className="h-5 w-5 text-primary-purple" />
                        </div>
                        <div>
                          <label className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Batch Identifier</label>
                          <p className="text-lg font-semibold text-gray-900">{selectedBatch.batch_identifier || 'N/A'}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="relative group">
 
                    <div className="relative bg-gray-50 rounded-xl p-4">
                      <div className="flex items-center space-x-3">
                        <div className="bg-accent-cyan/10 rounded-lg p-2">
                          <Badge variant={getStatusBadge(selectedBatch.status)} className="h-5 w-5" />
                        </div>
                        <div>
                          <label className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Status</label>
                          <div className="mt-1">
                            <Badge variant={getStatusBadge(selectedBatch.status)} className="text-sm">
                              {selectedBatch.status}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="relative group">
 
                    <div className="relative bg-gray-50 rounded-xl p-4">
                      <div className="flex items-center space-x-3">
                        <div className="bg-primary-purple/10 rounded-lg p-2">
                          <Receipt className="h-5 w-5 text-primary-purple" />
                        </div>
                        <div>
                          <label className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Number of Claims</label>
                          <p className="text-lg font-semibold text-gray-900">{selectedBatch.number_of_claims || 'N/A'}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="relative group">
 
                    <div className="relative bg-gray-50 rounded-xl p-4">
                      <div className="flex items-center space-x-3">
                        <div className="bg-accent-cyan/10 rounded-lg p-2">
                          <DollarSign className="h-5 w-5 text-accent-cyan" />
                        </div>
                        <div>
                          <label className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Total Amount</label>
                          <p className="text-lg font-semibold text-gray-900">${parseFloat(selectedBatch.total_amount || 0).toLocaleString()}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="relative group">
 
                    <div className="relative bg-gray-50 rounded-xl p-4">
                      <div className="flex items-center space-x-3">
                        <div className="bg-primary-purple/10 rounded-lg p-2">
                          <Building2 className="h-5 w-5 text-primary-purple" />
                        </div>
                        <div>
                          <label className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Provider</label>
                          <p className="text-lg font-semibold text-gray-900">{selectedBatch.provider_name || 'N/A'}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="relative group">
 
                    <div className="relative bg-gray-50 rounded-xl p-4">
                      <div className="flex items-center space-x-3">
                        <div className="bg-accent-cyan/10 rounded-lg p-2">
                          <Shield className="h-5 w-5 text-accent-cyan" />
                        </div>
                        <div>
                          <label className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Insurer</label>
                          <p className="text-lg font-semibold text-gray-900">{selectedBatch.insurer_name || 'N/A'}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="relative group">
 
                    <div className="relative bg-gray-50 rounded-xl p-4">
                      <div className="flex items-center space-x-3">
                        <div className="bg-primary-purple/10 rounded-lg p-2">
                          <Calendar className="h-5 w-5 text-primary-purple" />
                        </div>
                        <div>
                          <label className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Submission Date</label>
                          <p className="text-lg font-semibold text-gray-900">{new Date(selectedBatch.submission_date).toLocaleDateString()}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Enhanced Footer */}
              <div className="bg-gray-50 px-6 py-4 border-t border-gray-200">
                <div className="flex justify-between items-center">
                  <div className="text-sm text-gray-600">
                    <span className="font-medium">Batch Identifier:</span> {selectedBatch.batch_identifier || 'N/A'}
                  </div>
                  <div className="flex space-x-3">
                    <button
                      onClick={() => setSelectedBatch(null)}
                      className="px-6 py-2 text-gray-600 hover:text-gray-800 font-medium transition-colors"
                    >
                      Close
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Enhanced Drill-down Modal */}
      {showDrillDown && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="relative bg-white rounded-3xl max-w-7xl w-full max-h-[90vh] overflow-hidden ">
 
            <div className="relative bg-white rounded-3xl overflow-hidden">
              {/* Header */}
              <div className="bg-gradient-to-r from-primary-purple to-accent-purple p-6 text-white">
                <div className="flex justify-between items-center">
                  <div>
                    <h2 className="text-2xl font-bold">{drillDownTitle}</h2>
                    <p className="text-white/80 mt-1">Detailed breakdown of selected data</p>
                  </div>
                  <button
                    onClick={closeDrillDown}
                    className="text-white/80 hover:text-white hover:bg-white/20 p-2 rounded-xl transition-all duration-200"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
              
              <div className="overflow-x-auto p-6">
                <table className="min-w-full">
                  <thead>
                    <tr className="bg-gradient-to-r from-gray-50 to-gray-100">
                      <th className="px-6 py-4 text-left text-xs font-bold text-gray-600 uppercase tracking-wider rounded-tl-xl">
                        Batch ID
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">
                        Claims Count
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">
                        Total Amount
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">
                        Provider
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">
                        Insurer
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-gray-600 uppercase tracking-wider rounded-tr-xl">
                        Date
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {drillDownData.map((item, index) => (
                      <tr key={index} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {item.batch_identifier || 'N/A'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex px-3 py-1 text-xs font-semibold rounded-full ${
                            item.status === 'Processed' ? 'bg-accent-teal/10 text-accent-teal' :
                            item.status === 'Pending' ? 'bg-yellow-100 text-yellow-800' :
                            item.status === 'Rejected' ? 'bg-red-100 text-red-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {item.status || 'N/A'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          {item.number_of_claims || 'N/A'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          ${parseFloat(item.total_amount || 0).toLocaleString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          {item.provider_name || 'N/A'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          {item.insurer_name || 'N/A'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          {item.submission_date ? new Date(item.submission_date).toLocaleDateString() : 'N/A'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                
                {drillDownData.length === 0 && (
                  <div className="text-center text-gray-500 py-12">
                    <div className="w-20 h-20 bg-gray-100 rounded-full mx-auto mb-4 flex items-center justify-center">
                      <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <p className="text-xl font-medium">No data found</p>
                    <p className="text-gray-400 mt-2">No records match the selected criteria</p>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="bg-gray-50 px-6 py-4 border-t border-gray-200">
                <div className="flex justify-between items-center">
                  <div className="text-sm text-gray-600">
                    Showing {drillDownData.length} record{drillDownData.length !== 1 ? 's' : ''}
                  </div>
                  <button
                    onClick={closeDrillDown}
                    className="bg-gradient-to-r from-primary-purple to-accent-purple text-white px-6 py-2 rounded-xl transition-all duration-200 font-medium"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
