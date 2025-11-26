import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import DataTable from '@/components/DataTable';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { TrendingUp, Receipt, FileText, Calendar, Users, DollarSign, Building2, Shield } from 'lucide-react';
import api from '@/services/api';

const COLORS = ['#553781', '#9658C4', '#8572CD', '#00DEFE', '#26A69A', '#E0E7FF'];

export default function Claims() {
  const [claims, setClaims] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedClaim, setSelectedClaim] = useState(null);
  
  // Chart data states
  const [claimsByStatus, setClaimsByStatus] = useState([]);
  const [claimsByInsurer, setClaimsByInsurer] = useState([]);
  const [monthlyTrends, setMonthlyTrends] = useState([]);
  const [claimsByProvider, setClaimsByProvider] = useState([]);
  
  // Drill-down state
  const [drillDownData, setDrillDownData] = useState([]);
  const [showDrillDown, setShowDrillDown] = useState(false);
  const [drillDownTitle, setDrillDownTitle] = useState('');

  useEffect(() => {
    loadClaims();
  }, []);

  const loadClaims = async () => {
    try {
      setLoading(true);
      const response = await api.getClaims({ limit: 1000 });
      const claimsData = response.data || response || [];
      setClaims(claimsData);
      
      // Process chart data
      processChartData(claimsData);
    } catch (error) {
      console.error('Error loading claims:', error);
      // Mock data for demonstration
      const mockClaims = [
        {
          id: 1,
          claim_number: 'CLM001',
          patient_name: 'أحمد محمد العلي',
          provider_name: 'مستشفى الملك فهد التخصصي',
          insurer_name: 'التأمين الصحي السعودي',
          status: 'Approved',
          amount: '15000',
          submission_date: '2024-01-15'
        },
        {
          id: 2,
          claim_number: 'CLM002',
          patient_name: 'فاطمة عبدالله السعد',
          provider_name: 'عيادة الدكتور أحمد محمد',
          insurer_name: 'بوبا العربية للتأمين',
          status: 'Pending',
          amount: '500',
          submission_date: '2024-01-20'
        },
        {
          id: 3,
          claim_number: 'CLM003',
          patient_name: 'محمد خالد القحطاني',
          provider_name: 'مركز الأسنان المتخصص',
          insurer_name: 'تأمين مدجلف',
          status: 'Rejected',
          amount: '2000',
          submission_date: '2024-01-18'
        }
      ];
      setClaims(mockClaims);
      processChartData(mockClaims);
    } finally {
      setLoading(false);
    }
  };

  const processChartData = (claimsData) => {
    // Claims by Status
    const statusCounts = {};
    claimsData.forEach(claim => {
      statusCounts[claim.status] = (statusCounts[claim.status] || 0) + 1;
    });
    setClaimsByStatus(Object.entries(statusCounts).map(([name, value]) => ({ name, value })));

    // Claims by Insurer
    const insurerAmounts = {};
    claimsData.forEach(claim => {
      const insurer = claim.insurer_name || 'Unknown';
      insurerAmounts[insurer] = (insurerAmounts[insurer] || 0) + parseFloat(claim.amount || 0);
    });
    setClaimsByInsurer(Object.entries(insurerAmounts).map(([name, value]) => ({ name, value })));

    // Monthly Trends
    const monthlyData = {};
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    claimsData.forEach(claim => {
      const date = new Date(claim.submission_date);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      if (!monthlyData[monthKey]) {
        monthlyData[monthKey] = {
          month: months[date.getMonth()],
          amount: 0,
          count: 0
        };
      }
      monthlyData[monthKey].amount += parseFloat(claim.amount || 0);
      monthlyData[monthKey].count += 1;
    });
    setMonthlyTrends(Object.values(monthlyData).sort((a, b) => {
      const aDate = new Date(a.month + ' 1, 2024');
      const bDate = new Date(b.month + ' 1, 2024');
      return aDate - bDate;
    }));

    // Claims by Provider
    const providerCounts = {};
    claimsData.forEach(claim => {
      const provider = claim.provider_name || 'Unknown';
      providerCounts[provider] = (providerCounts[provider] || 0) + 1;
    });
    setClaimsByProvider(Object.entries(providerCounts).map(([name, value]) => ({ name, value })));
  };

  const getStatusBadge = (status) => {
    const variants = {
      'Approved': 'default',
      'Pending': 'secondary',
      'Rejected': 'destructive',
      'Under Review': 'outline'
    };
    return variants[status] || 'outline';
  };

  const columns = [
    {
      key: 'claim_number',
      header: 'Claim Number',
      accessor: 'claim_number'
    },
    {
      key: 'patient_name',
      header: 'Patient',
      accessor: 'patient_name'
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
      key: 'amount',
      header: 'Amount',
      accessor: 'amount',
      render: (row) => `$${parseFloat(row.amount || 0).toLocaleString()}`
    },
    {
      key: 'submission_date',
      header: 'Submission Date',
      accessor: 'submission_date',
      render: (row) => new Date(row.submission_date).toLocaleDateString()
    }
  ];

  // Drill-down functions
  const handleStatusClick = async (data) => {
    try {
      setDrillDownTitle(`Claims with Status: ${data.name}`);
      const filteredClaims = claims.filter(item => item.status === data.name);
      setDrillDownData(filteredClaims);
      setShowDrillDown(true);
    } catch (error) {
      console.error('Error loading status drill-down data:', error);
    }
  };

  const handleInsurerClick = async (data) => {
    try {
      setDrillDownTitle(`Claims for Insurer: ${data.name}`);
      const filteredClaims = claims.filter(item => item.insurer_name === data.name);
      setDrillDownData(filteredClaims);
      setShowDrillDown(true);
    } catch (error) {
      console.error('Error loading insurer drill-down data:', error);
    }
  };

  const handleProviderClick = async (data) => {
    try {
      setDrillDownTitle(`Claims for Provider: ${data.name}`);
      const filteredClaims = claims.filter(item => item.provider_name === data.name);
      setDrillDownData(filteredClaims);
      setShowDrillDown(true);
    } catch (error) {
      console.error('Error loading provider drill-down data:', error);
    }
  };

  const handleMonthlyTrendClick = async (data) => {
    try {
      setDrillDownTitle(`Claims for Month: ${data.month}`);
      const monthDate = new Date(data.month + ' 1, 2024');
      const startDate = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
      const endDate = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0);
      
      const filteredClaims = claims.filter(item => {
        const submissionDate = new Date(item.submission_date);
        return submissionDate >= startDate && submissionDate <= endDate;
      });
      
      setDrillDownData(filteredClaims);
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

  const handleRowClick = (claim) => {
    setSelectedClaim(claim);
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
                Healthcare Claims
              </h1>
              <p className="text-gray-600 mt-2 text-lg">Manage healthcare claims and their processing status</p>
              <div className="flex items-center space-x-4 mt-4">
                <div className="flex items-center space-x-2 text-sm text-gray-500">
                  <div className="w-2 h-2 bg-accent-cyan rounded-full animate-pulse"></div>
                  <span>System Active</span>
                </div>
                <div className="text-sm text-gray-500">
                  Total Claims: {claims.length}
                </div>
                <div className="text-sm text-gray-500">
                  Last updated: {new Date().toLocaleTimeString()}
                </div>
              </div>
            </div>
            <div className="hidden md:flex items-center space-x-3">
              <div className="bg-white rounded-xl p-3 border border-gray-100">
                <Receipt className="h-8 w-8 text-primary-purple" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Claims by Status Donut Chart */}
        <div className="relative group">
 
          <Card className="relative bg-white border-0 transition-all duration-300 hover:-translate-y-2">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center text-gray-900">
                <div className="relative mr-3">
                  <div className="absolute -inset-1 bg-primary-purple/20 rounded-lg"></div>
                  <div className="relative from-primary-purple/10 to-accent-purple/10 rounded-lg p-2">
                    <Receipt className="h-6 w-6 text-primary-purple" />
                  </div>
                </div>
                <div>
                  <h3 className="text-xl font-bold">Claims by Status</h3>
                  <p className="text-sm text-gray-600 font-medium">Distribution of claim statuses</p>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[350px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={claimsByStatus}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      innerRadius={50}
                      outerRadius={100}
                      dataKey="value"
                      onClick={handleStatusClick}
                      style={{ cursor: 'pointer' }}
                      className="hover:opacity-80 transition-opacity"
                    >
                      {claimsByStatus.map((entry, index) => (
                        <Cell 
                          key={`cell-${index}`} 
                          fill={COLORS[index % COLORS.length]}
                          className="hover:opacity-80 transition-opacity"
                        />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{
                        background: 'rgba(255, 255, 255, 0.95)',
 
                        border: '1px solid rgba(85, 55, 129, 0.2)',
                        borderRadius: '12px',
                        boxShadow: 'none'
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Claims by Insurer */}
        <div className="relative group">
 
          <Card className="relative bg-white border-0 transition-all duration-300 hover:-translate-y-2">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center text-gray-900">
                <div className="relative mr-3">
 
                  <div className="relative bg-gradient-to-br from-accent-purple/10 to-accent-purple/5 rounded-lg p-2">
                    <FileText className="h-6 w-6 text-accent-cyan" />
                  </div>
                </div>
                <div>
                  <h3 className="text-xl font-bold">Claims by Insurer</h3>
                  <p className="text-sm text-gray-600 font-medium">Total claim amounts by insurer</p>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[350px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={claimsByInsurer} onClick={handleInsurerClick}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" strokeOpacity={0.5} />
                    <XAxis 
                      dataKey="name" 
                      angle={-45} 
                      textAnchor="end" 
                      height={100} 
                      stroke="#6B7280"
                      tick={{ fill: '#6B7280' }}
                      fontSize={12}
                    />
                    <YAxis stroke="#6B7280" tick={{ fill: '#6B7280' }} />
                    <Tooltip 
                      contentStyle={{
                        background: 'rgba(255, 255, 255, 0.95)',
 
                        border: '1px solid rgba(85, 55, 129, 0.2)',
                        borderRadius: '12px',
                        boxShadow: 'none'
                      }}
                      formatter={(value) => [`$${value.toLocaleString()}`, 'Amount']} 
                    />
                    <Bar 
                      dataKey="value" 
                      fill="#26A69A" 
                      style={{ cursor: 'pointer' }} 
                      radius={[4, 4, 0, 0]}
                      className="hover:opacity-80 transition-opacity"
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Daily Trends */}
        <div className="relative group">
 
          <Card className="relative bg-white border-0 transition-all duration-300 hover:-translate-y-2">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center text-gray-900">
                <div className="relative mr-3">
 
                  <div className="relative bg-gradient-to-br from-accent-purple/10 to-accent-purple/5 rounded-lg p-2">
                    <TrendingUp className="h-6 w-6 text-accent-cyan" />
                  </div>
                </div>
                <div>
                  <h3 className="text-xl font-bold">Daily Claim Trends</h3>
                  <p className="text-sm text-gray-600 font-medium">Claim amounts and counts over the last 30 days</p>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[350px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={monthlyTrends} onClick={handleMonthlyTrendClick}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" strokeOpacity={0.5} />
                    <XAxis 
                      dataKey="month" 
                      stroke="#6B7280" 
                      angle={-45}
                      textAnchor="end"
                      height={80}
                      fontSize={12}
                      tick={{ fill: '#6B7280' }}
                    />
                    <YAxis yAxisId="left" stroke="#6B7280" tick={{ fill: '#6B7280' }} />
                    <YAxis yAxisId="right" orientation="right" stroke="#6B7280" tick={{ fill: '#6B7280' }} />
                    <Tooltip 
                      contentStyle={{
                        background: 'rgba(255, 255, 255, 0.95)',
 
                        border: '1px solid rgba(85, 55, 129, 0.2)',
                        borderRadius: '12px',
                        boxShadow: 'none'
                      }}
                      formatter={(value, name) => [
                        name === 'amount' ? `$${value.toLocaleString()}` : value,
                        name === 'amount' ? 'Amount' : 'Count'
                      ]}
                    />
                    <Line yAxisId="left" type="monotone" dataKey="amount" stroke="#26A69A" strokeWidth={3} style={{ cursor: 'pointer' }} className="hover:opacity-80 transition-opacity" />
                    <Line yAxisId="right" type="monotone" dataKey="count" stroke="#00DEFE" strokeWidth={3} style={{ cursor: 'pointer' }} className="hover:opacity-80 transition-opacity" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Claims by Provider */}
        <div className="relative group">
 
          <Card className="relative bg-white border-0 transition-all duration-300 hover:-translate-y-2">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center text-gray-900">
                <div className="relative mr-3">
 
                  <div className="relative bg-gradient-to-br from-accent-purple/10 to-accent-purple/5 rounded-lg p-2">
                    <Users className="h-6 w-6 text-accent-purple" />
                  </div>
                </div>
                <div>
                  <h3 className="text-xl font-bold">Claims by Provider</h3>
                  <p className="text-sm text-gray-600 font-medium">Number of claims submitted by each provider</p>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[350px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={claimsByProvider} onClick={handleProviderClick}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" strokeOpacity={0.5} />
                    <XAxis 
                      dataKey="name" 
                      angle={-45} 
                      textAnchor="end" 
                      height={100} 
                      stroke="#6B7280"
                      tick={{ fill: '#6B7280' }}
                      fontSize={12}
                    />
                    <YAxis stroke="#6B7280" tick={{ fill: '#6B7280' }} />
                    <Tooltip 
                      contentStyle={{
                        background: 'rgba(255, 255, 255, 0.95)',
 
                        border: '1px solid rgba(85, 55, 129, 0.2)',
                        borderRadius: '12px',
                        boxShadow: 'none'
                      }}
                      formatter={(value) => [value, 'Claims']} 
                    />
                    <Bar 
                      dataKey="value" 
                      fill="#26A69A" 
                      style={{ cursor: 'pointer' }} 
                      radius={[4, 4, 0, 0]}
                      className="hover:opacity-80 transition-opacity"
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Enhanced Claims Data Table */}
      <div className="relative group">
 
        <Card className="relative bg-white border-0 transition-all duration-300 hover:-translate-y-2">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center text-gray-900">
              <div className="relative mr-3">
                <div className="absolute -inset-1 bg-primary-purple/20 rounded-lg"></div>
                <div className="relative from-primary-purple/10 to-accent-purple/10 rounded-lg p-2">
                  <Receipt className="h-6 w-6 text-primary-purple" />
                </div>
              </div>
              <div>
                <h3 className="text-xl font-bold">Healthcare Claims</h3>
                <p className="text-sm text-gray-600 font-medium">Track and manage all healthcare claims submitted to insurers</p>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <DataTable
              data={claims}
              columns={columns}
              onRowClick={handleRowClick}
              searchable={true}
              sortable={true}
              pageSize={10}
            />
          </CardContent>
        </Card>
      </div>

      {/* Enhanced Claim Detail Modal */}
      {selectedClaim && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="relative bg-white rounded-3xl max-w-4xl w-full max-h-[90vh] overflow-hidden ">
 
            <div className="relative bg-white rounded-3xl overflow-hidden">
              {/* Enhanced Header */}
              <div className="bg-gradient-to-r from-primary-purple to-accent-purple p-6 text-white">
                <div className="flex justify-between items-center">
                  <div className="flex items-center space-x-3">
                    <div className="relative">
 
                      <div className="relative bg-white/20 rounded-full p-2">
                        <Receipt className="h-6 w-6" />
                      </div>
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold">Claim Details</h2>
                      <p className="text-white/80 mt-1">Comprehensive claim information</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedClaim(null)}
                    className="text-white/80 hover:text-white hover:bg-white/20 p-2 rounded-xl transition-all duration-200"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
              
              {/* Claim Information Grid */}
              <div className="p-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="relative group">
 
                    <div className="relative bg-gray-50 rounded-xl p-4">
                      <div className="flex items-center space-x-3">
                        <div className="bg-primary-purple/10 rounded-lg p-2">
                          <Receipt className="h-5 w-5 text-primary-purple" />
                        </div>
                        <div>
                          <label className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Claim Number</label>
                          <p className="text-lg font-semibold text-gray-900">{selectedClaim.claim_number || 'N/A'}</p>
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
                          <label className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Status</label>
                          <div className="mt-1">
                            <Badge variant={getStatusBadge(selectedClaim.status)} className="text-sm">
                              {selectedClaim.status}
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
                          <DollarSign className="h-5 w-5 text-primary-purple" />
                        </div>
                        <div>
                          <label className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Amount</label>
                          <p className="text-lg font-semibold text-gray-900">${parseFloat(selectedClaim.amount || 0).toLocaleString()}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="relative group">
 
                    <div className="relative bg-gray-50 rounded-xl p-4">
                      <div className="flex items-center space-x-3">
                        <div className="bg-accent-cyan/10 rounded-lg p-2">
                          <Users className="h-5 w-5 text-accent-cyan" />
                        </div>
                        <div>
                          <label className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Patient</label>
                          <p className="text-lg font-semibold text-gray-900">{selectedClaim.patient_name || 'N/A'}</p>
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
                          <p className="text-lg font-semibold text-gray-900">{selectedClaim.provider_name || 'N/A'}</p>
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
                          <p className="text-lg font-semibold text-gray-900">{selectedClaim.insurer_name || 'N/A'}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="relative group md:col-span-2">
 
                    <div className="relative bg-gray-50 rounded-xl p-4">
                      <div className="flex items-center space-x-3">
                        <div className="bg-primary-purple/10 rounded-lg p-2">
                          <Calendar className="h-5 w-5 text-primary-purple" />
                        </div>
                        <div>
                          <label className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Submission Date</label>
                          <p className="text-lg font-semibold text-gray-900">{new Date(selectedClaim.submission_date).toLocaleDateString()}</p>
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
                    <span className="font-medium">Claim ID:</span> {selectedClaim.claim_number || 'N/A'}
                  </div>
                  <div className="flex space-x-3">
                    <button
                      onClick={() => setSelectedClaim(null)}
                      className="px-6 py-2 text-gray-600 hover:text-gray-800 font-medium transition-colors"
                    >
                      Close
                    </button>
                    <button
                      className="bg-gradient-to-r from-primary-purple to-accent-purple text-white px-6 py-2 rounded-xl transition-all duration-200 font-medium"
                    >
                      Edit Claim
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
                        Claim Number
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">
                        Patient
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">
                        Provider
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">
                        Insurer
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">
                        Amount
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
                          {item.claim_number || 'N/A'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          {item.patient_name || 'N/A'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          {item.provider_name || 'N/A'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          {item.insurer_name || 'N/A'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex px-3 py-1 text-xs font-semibold rounded-full ${
                            item.status === 'Approved' || item.status === 'Completed' ? 'bg-accent-teal/10 text-accent-teal' :
                            item.status === 'Pending' ? 'bg-yellow-100 text-yellow-800' :
                            item.status === 'Rejected' || item.status === 'Failed' ? 'bg-red-100 text-red-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {item.status || 'N/A'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          ${parseFloat(item.amount || 0).toLocaleString()}
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
