import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, Building2, Receipt, CreditCard, TrendingUp, Activity, Shield, FileCheck, BarChart3, Heart, DollarSign, FileText } from 'lucide-react';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Area, AreaChart } from 'recharts';
import KPIRing from '@/components/KPIRing';
import DataTableWithBars from '@/components/DataTableWithBars';
import TrendIndicator from '@/components/TrendIndicator';
import api from '@/services/api';
// Imaging moved to its own page

const COLORS = ['#553781', '#9658C4', '#8572CD', '#00DEFE', '#26A69A', '#E0E7FF'];

export default function Dashboard() {
  const [stats, setStats] = useState({
    totalPatients: 0,
    totalClaims: 0,
    totalPayments: 0,
    totalProviders: 0,
    totalInsurers: 0,
    totalAuthorizations: 0
  });
  
  const [previousStats, setPreviousStats] = useState({
    totalPatients: 0,
    totalClaims: 0,
    totalPayments: 0,
    totalProviders: 0,
    totalInsurers: 0,
    totalAuthorizations: 0
  });
  const [claimsByStatus, setClaimsByStatus] = useState([]);
  const [paymentsByInsurer, setPaymentsByInsurer] = useState([]);
  const [eligibilityByStatus, setEligibilityByStatus] = useState([]);
  const [authorizationsByStatus, setAuthorizationsByStatus] = useState([]);
  const [monthlyTrends, setMonthlyTrends] = useState([]);
  const [recentActivity, setRecentActivity] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Sample data for table and heatmap
  const [tableData, setTableData] = useState([
    { id: 1, name: 'Saudi Health Insurance', score: 85, status: 'Approved', amount: 450000 },
    { id: 2, name: 'Bupa Arabia', score: 72, status: 'Pending', amount: 320000 },
    { id: 3, name: 'MedGulf', score: 91, status: 'Approved', amount: 280000 },
    { id: 4, name: 'Tawuniya', score: 68, status: 'Under Review', amount: 200000 },
    { id: 5, name: 'AXA Cooperative', score: 78, status: 'Approved', amount: 180000 },
  ]);
  
  const [heatmapData, setHeatmapData] = useState([
    [85, 72, 91, 68, 78, 82],
    [76, 88, 65, 94, 71, 83],
    [92, 67, 89, 75, 86, 79],
    [81, 95, 73, 87, 69, 84],
    [77, 83, 90, 72, 88, 76],
  ]);
  
  const heatmapXLabels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
  const heatmapYLabels = ['Claims', 'Payments', 'Eligibility', 'Auth', 'Reviews'];
  
  // Drill-down state
  const [selectedStatus, setSelectedStatus] = useState(null);
  const [selectedInsurer, setSelectedInsurer] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState(null);
  const [drillDownData, setDrillDownData] = useState([]);
  const [showDrillDown, setShowDrillDown] = useState(false);
  const [drillDownTitle, setDrillDownTitle] = useState('');

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      
      // Load dashboard statistics from the stats endpoint
      const dashboardStats = await api.getDashboardStats();
      
      setStats({
        totalPatients: dashboardStats.data?.counts?.patients || 0,
        totalProviders: dashboardStats.data?.counts?.providers || 0,
        totalInsurers: dashboardStats.data?.counts?.insurers || 0,
        totalClaims: dashboardStats.data?.counts?.claims || 0,
        totalPayments: dashboardStats.data?.counts?.payments || 0,
        totalAuthorizations: dashboardStats.data?.counts?.authorizations || 0
      });

      // Load claims by status from dashboard stats
      const claimsByStatusData = dashboardStats.data?.claimsByStatus || [];
      setClaimsByStatus(claimsByStatusData.map(item => ({ 
        name: item.status, 
        value: parseInt(item.count) 
      })));

      // Load payments by insurer from dashboard stats
      const paymentsByInsurerData = dashboardStats.data?.paymentsByInsurer || [];
      setPaymentsByInsurer(
        paymentsByInsurerData.map(item => ({
          name: item.insurer_name || item.name,
          value: parseFloat(item.amount ?? item.total_amount ?? 0)
        }))
      );

      // Load recent activity from dashboard stats
      const recentActivityData = dashboardStats.data?.recentActivity || [];
      setRecentActivity(recentActivityData);

      // Load additional data for new charts
      await loadAdditionalChartData();

    } catch (error) {
      console.error('Error loading dashboard data:', error);
      // Set mock data for demonstration
      setStats({
        totalPatients: 1250,
        totalProviders: 45,
        totalInsurers: 8,
        totalClaims: 3420,
        totalPayments: 2890,
        totalAuthorizations: 1560
      });

      // Set previous period data for trend comparison
      setPreviousStats({
        totalPatients: 1180,
        totalProviders: 42,
        totalInsurers: 8,
        totalClaims: 3100,
        totalPayments: 2650,
        totalAuthorizations: 1420
      });

      // Set mock data for charts - ensure this is always set
      setClaimsByStatus([
        { name: 'Paid', value: 1200 },
        { name: 'Pending', value: 800 },
        { name: 'Rejected', value: 300 },
        { name: 'Under Review', value: 200 }
      ]);

      setPaymentsByInsurer([
        { name: 'Saudi Health Insurance', value: 450000 },
        { name: 'Bupa Arabia', value: 320000 },
        { name: 'MedGulf', value: 280000 },
        { name: 'Tawuniya', value: 200000 }
      ]);

      // Set mock data for additional charts
      setEligibilityByStatus([
        { name: 'Approved', value: 450 },
        { name: 'Pending', value: 320 },
        { name: 'Under Review', value: 180 },
        { name: 'Rejected', value: 90 }
      ]);

      setAuthorizationsByStatus([
        { name: 'Approved', value: 680 },
        { name: 'Pending', value: 420 },
        { name: 'Under Review', value: 280 },
        { name: 'Rejected', value: 120 }
      ]);

      setMonthlyTrends([
        { day: 'Sep 15', claims: 45, payments: 32, amount: 125000 },
        { day: 'Sep 16', claims: 52, payments: 38, amount: 145000 },
        { day: 'Sep 17', claims: 48, payments: 35, amount: 132000 },
        { day: 'Sep 18', claims: 61, payments: 42, amount: 168000 },
        { day: 'Sep 19', claims: 55, payments: 39, amount: 152000 },
        { day: 'Sep 20', claims: 58, payments: 41, amount: 161000 },
        { day: 'Sep 21', claims: 63, payments: 45, amount: 178000 }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const loadAdditionalChartData = async () => {
    try {
      // Load eligibility by status
      const eligibilityData = await api.getEligibility({ limit: 1000 });
      const eligibilityStatusCounts = {};
      eligibilityData.data?.forEach(eligibility => {
        eligibilityStatusCounts[eligibility.status] = (eligibilityStatusCounts[eligibility.status] || 0) + 1;
      });
      setEligibilityByStatus(Object.entries(eligibilityStatusCounts).map(([name, value]) => ({ name, value })));

      // Load authorizations by status
      const authorizationsData = await api.getAuthorizations({ limit: 1000 });
      const authStatusCounts = {};
      authorizationsData.data?.forEach(auth => {
        authStatusCounts[auth.status] = (authStatusCounts[auth.status] || 0) + 1;
      });
      setAuthorizationsByStatus(Object.entries(authStatusCounts).map(([name, value]) => ({ name, value })));

      // Load daily trends (claims and payments over last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const claimsData = await api.getClaims({ 
        limit: 1000,
        start_date: thirtyDaysAgo.toISOString().split('T')[0]
      });
      
      const paymentsData = await api.getPayments({ 
        limit: 1000,
        start_date: thirtyDaysAgo.toISOString().split('T')[0]
      });

      // Group by day
      const dailyData = {};
      
      // Process claims
      claimsData.data?.forEach(claim => {
        // Use submission_date instead of created_at, and add null check
        const dateValue = claim.submission_date;
        if (!dateValue) return; // Skip if no date
        
        const date = new Date(dateValue);
        if (isNaN(date.getTime())) return; // Skip if invalid date
        
        const dayKey = date.toISOString().split('T')[0];
        if (!dailyData[dayKey]) {
          dailyData[dayKey] = {
            day: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
            claims: 0,
            payments: 0,
            amount: 0
          };
        }
        dailyData[dayKey].claims += 1;
        dailyData[dayKey].amount += parseFloat(claim.amount || 0);
      });

      // Process payments
      paymentsData.data?.forEach(payment => {
        // Use payment_date instead of created_at, and add null check
        const dateValue = payment.payment_date;
        if (!dateValue) return; // Skip if no date
        
        const date = new Date(dateValue);
        if (isNaN(date.getTime())) return; // Skip if invalid date
        
        const dayKey = date.toISOString().split('T')[0];
        if (!dailyData[dayKey]) {
          dailyData[dayKey] = {
            day: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
            claims: 0,
            payments: 0,
            amount: 0
          };
        }
        dailyData[dayKey].payments += 1;
      });

      // Convert to array and sort by date
      const trendsArray = Object.values(dailyData).sort((a, b) => {
        const aDate = new Date(a.day + ', 2024');
        const bDate = new Date(b.day + ', 2024');
        return aDate - bDate;
      });

      setMonthlyTrends(trendsArray.slice(-30)); // Last 30 days

    } catch (error) {
      console.error('Error loading additional chart data:', error);
    }
  };

  // Drill-down functions
  const handleClaimsStatusClick = async (data) => {
    try {
      setSelectedStatus(data.name);
      setDrillDownTitle(`Claims with Status: ${data.name}`);
      
      const claimsData = await api.getClaims({ 
        limit: 1000,
        status: data.name 
      });
      
      setDrillDownData(claimsData.data || []);
      setShowDrillDown(true);
    } catch (error) {
      console.error('Error loading claims drill-down data:', error);
    }
  };

  const handlePaymentsInsurerClick = async (data) => {
    try {
      setSelectedInsurer(data.name);
      setDrillDownTitle(`Payments for Insurer: ${data.name}`);
      
      const paymentsData = await api.getPayments({ 
        limit: 1000,
        insurer_name: data.name 
      });
      
      setDrillDownData(paymentsData.data || []);
      setShowDrillDown(true);
    } catch (error) {
      console.error('Error loading payments drill-down data:', error);
    }
  };

  const handleEligibilityStatusClick = async (data) => {
    try {
      setSelectedStatus(data.name);
      setDrillDownTitle(`Eligibility with Status: ${data.name}`);
      
      const eligibilityData = await api.getEligibility({ 
        limit: 1000,
        status: data.name 
      });
      
      setDrillDownData(eligibilityData.data || []);
      setShowDrillDown(true);
    } catch (error) {
      console.error('Error loading eligibility drill-down data:', error);
    }
  };

  const handleAuthorizationsStatusClick = async (data) => {
    try {
      setSelectedStatus(data.name);
      setDrillDownTitle(`Authorizations with Status: ${data.name}`);
      
      const authorizationsData = await api.getAuthorizations({ 
        limit: 1000,
        status: data.name 
      });
      
      setDrillDownData(authorizationsData.data || []);
      setShowDrillDown(true);
    } catch (error) {
      console.error('Error loading authorizations drill-down data:', error);
    }
  };

  const handleDailyTrendClick = async (data) => {
    try {
      setSelectedMonth(data.day);
      setDrillDownTitle(`Data for Day: ${data.day}`);
      
      // Get claims and payments for the selected day
      const dayDate = new Date(data.day + ', 2024');
      const startDate = new Date(dayDate.getFullYear(), dayDate.getMonth(), dayDate.getDate());
      const endDate = new Date(dayDate.getFullYear(), dayDate.getMonth(), dayDate.getDate() + 1);
      
      const [claimsData, paymentsData] = await Promise.all([
        api.getClaims({ 
          limit: 1000,
          start_date: startDate.toISOString().split('T')[0],
          end_date: endDate.toISOString().split('T')[0]
        }),
        api.getPayments({ 
          limit: 1000,
          start_date: startDate.toISOString().split('T')[0],
          end_date: endDate.toISOString().split('T')[0]
        })
      ]);
      
      // Combine claims and payments data
      const combinedData = [
        ...(claimsData.data || []).map(item => ({ ...item, type: 'Claim' })),
        ...(paymentsData.data || []).map(item => ({ ...item, type: 'Payment' }))
      ];
      
      setDrillDownData(combinedData);
      setShowDrillDown(true);
    } catch (error) {
      console.error('Error loading daily trend drill-down data:', error);
    }
  };

  const closeDrillDown = () => {
    setShowDrillDown(false);
    setDrillDownData([]);
    setDrillDownTitle('');
    setSelectedStatus(null);
    setSelectedInsurer(null);
    setSelectedMonth(null);
  };

  // Calculate paid totals for Claims and Authorizations
  const approvedClaims = claimsByStatus.find(item => item.name === 'Paid')?.value || 0;
  const approvedAuthorizations = authorizationsByStatus.find(item => item.name === 'Approved')?.value || 0;
  
  // Calculate expected payments (total approved amount)
  const expectedPayments = paymentsByInsurer.reduce((sum, item) => sum + item.value, 0);

  const kpiData = [
    {
      label: 'Total Patients',
      value: stats.totalPatients,
      previousValue: previousStats.totalPatients,
      color: '#553781',
      icon: Heart,
      showTarget: false,
      isCurrency: false
    },
    {
      label: 'Total Providers',
      value: stats.totalProviders,
      previousValue: previousStats.totalProviders,
      color: '#9658C4',
      icon: Building2,
      showTarget: false,
      isCurrency: false
    },
    {
      label: 'Paid Claims',
      value: approvedClaims,
      previousValue: previousStats.totalClaims,
      color: '#8572CD',
      icon: FileCheck,
      showTarget: false,
      isCurrency: false
    },
    {
      label: 'Expected Payments',
      value: expectedPayments,
      previousValue: previousStats.totalPayments,
      color: '#00DEFE',
      icon: DollarSign,
      showTarget: false,
      isCurrency: true
    },
    {
      label: 'Approved Authorizations',
      value: approvedAuthorizations,
      previousValue: previousStats.totalAuthorizations,
      color: '#26A69A',
      icon: FileText,
      showTarget: false,
      isCurrency: false
    }
  ];

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
      <div>
        <div className="bg-white rounded-lg p-8 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold text-gray-900">
                Healthcare Dashboard
              </h1>
              <p className="text-gray-600 mt-2 text-lg">Comprehensive overview of your healthcare management system</p>
              <div className="flex items-center space-x-4 mt-4">
                <div className="flex items-center space-x-2 text-sm text-gray-500">
                  <div className="w-2 h-2 bg-accent-cyan rounded-full"></div>
                  <span>System Online</span>
                </div>
                <div className="text-sm text-gray-500">
                  Last updated: {new Date().toLocaleTimeString()}
                </div>
              </div>
            </div>
            <div className="hidden md:flex items-center space-x-3">
              <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                <Heart className="h-8 w-8 text-primary-purple" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Imaging Requests moved to dedicated page */}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
        {kpiData.map((kpi) => (
          <Card key={kpi.label} className="p-4 bg-white border border-gray-200 hover:border-primary-purple transition-colors">
            <div className="flex flex-col items-center space-y-3">
              <div className="bg-primary-purple/5 rounded-full p-2">
                <kpi.icon className="h-6 w-6 text-primary-purple" />
              </div>
              <div className="text-center w-full">
                <KPIRing
                  value={kpi.value}
                  target={kpi.target}
                  label=""
                  color={kpi.color}
                  size={90}
                  strokeWidth={5}
                  showTarget={kpi.showTarget}
                  isCurrency={kpi.isCurrency}
                />
                <h3 className="text-xs font-semibold text-gray-900 mt-1">{kpi.label}</h3>
              </div>
              <TrendIndicator
                currentValue={kpi.value}
                previousValue={kpi.previousValue}
                isCurrency={kpi.isCurrency}
                className="text-xs"
              />
            </div>
          </Card>
        ))}
      </div>

      {/* Main Charts - Enhanced Grid */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        {/* Claims by Status Donut Chart */}
        <Card className="bg-white border border-gray-200 hover:border-primary-purple transition-colors">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center text-gray-900">
              <div className="mr-3">
                <div className="bg-primary-purple/5 rounded-lg p-2">
                  <Receipt className="h-6 w-6 text-primary-purple" />
                </div>
              </div>
              <div>
                <h3 className="text-xl font-bold">Claims by Status</h3>
                <p className="text-sm text-gray-600 font-medium">Distribution across different statuses</p>
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
                    labelStyle={{ fill: '#374151', fontSize: '14px', fontWeight: '500' }}
                      innerRadius={50}
                      outerRadius={100}
                    dataKey="value"
                    onClick={handleClaimsStatusClick}
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
                        background: 'rgba(255, 255, 255, 0.98)',
                        border: '1px solid rgba(85, 55, 129, 0.2)',
                        borderRadius: '8px'
                      }}
                    />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Daily Trends Line Chart */}
        <Card className="bg-white border border-gray-200 hover:border-primary-purple transition-colors">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center text-gray-900">
              <div className="mr-3">
                <div className="bg-accent-cyan/5 rounded-lg p-2">
                  <TrendingUp className="h-6 w-6 text-accent-cyan" />
                </div>
              </div>
              <div>
                <h3 className="text-xl font-bold">Daily Trends</h3>
                <p className="text-sm text-gray-600 font-medium">Claims and payments over the last 30 days</p>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
              <div className="h-[350px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={monthlyTrends} onClick={handleDailyTrendClick}>
                  <defs>
                    <linearGradient id="colorClaims" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#553781" stopOpacity={0.15}/>
                        <stop offset="95%" stopColor="#553781" stopOpacity={0.05}/>
                    </linearGradient>
                    <linearGradient id="colorPayments" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#9658C4" stopOpacity={0.15}/>
                        <stop offset="95%" stopColor="#9658C4" stopOpacity={0.05}/>
                    </linearGradient>
                  </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" strokeOpacity={0.5} />
                  <XAxis 
                    dataKey="day" 
                    stroke="#374151" 
                    angle={-45}
                    textAnchor="end"
                    height={80}
                    fontSize={12}
                      tick={{ fill: '#374151' }}
                  />
                    <YAxis stroke="#374151" tick={{ fill: '#374151' }} />
                  <Tooltip
                    contentStyle={{
                        background: 'rgba(255, 255, 255, 0.98)',
                        border: '1px solid rgba(85, 55, 129, 0.2)',
                        borderRadius: '8px'
                    }}
                    formatter={(value, name) => [
                      name === 'claims' ? value : `$${value.toLocaleString()}`,
                      name === 'claims' ? 'Claims' : 'Amount'
                    ]}
                  />
                  <Area
                    type="monotone"
                    dataKey="claims"
                      stroke="#553781"
                      strokeWidth={3}
                    fill="url(#colorClaims)"
                      className="hover:opacity-80 transition-opacity"
                  />
                  <Area
                    type="monotone"
                    dataKey="amount"
                      stroke="#9658C4"
                      strokeWidth={3}
                    fill="url(#colorPayments)"
                      className="hover:opacity-80 transition-opacity"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Payments by Insurer Bar Chart */}
        <Card className="bg-white border border-gray-200 hover:border-primary-purple transition-colors">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center text-gray-900">
              <div className="mr-3">
                <div className="bg-accent-purple/5 rounded-lg p-2">
                  <CreditCard className="h-6 w-6 text-accent-purple" />
                </div>
              </div>
              <div>
                <h3 className="text-xl font-bold">Payments by Insurer</h3>
                <p className="text-sm text-gray-600 font-medium">Total payment amounts by insurance provider</p>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
              <div className="h-[350px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={paymentsByInsurer} onClick={handlePaymentsInsurerClick}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" strokeOpacity={0.5} />
                    <XAxis
                      dataKey="name"
                      angle={-45}
                      textAnchor="end"
                      height={100}
                      stroke="#374151"
                      tick={{ fill: '#374151' }}
                      fontSize={12}
                    />
                    <YAxis stroke="#374151" tick={{ fill: '#374151' }} />
                  <Tooltip 
                    contentStyle={{
                        background: 'rgba(255, 255, 255, 0.98)',
                        border: '1px solid rgba(85, 55, 129, 0.2)',
                        borderRadius: '8px'
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

        {/* Performance Overview Table */}
        <Card className="bg-white border border-gray-200 hover:border-primary-purple transition-colors">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center text-gray-900">
              <div className="mr-3">
                <div className="bg-primary-purple/5 rounded-lg p-2">
                  <BarChart3 className="h-6 w-6 text-primary-purple" />
                </div>
              </div>
              <div>
                <h3 className="text-xl font-bold">Performance Overview</h3>
                <p className="text-sm text-gray-600 font-medium">Insurer performance with best score indicators</p>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <DataTableWithBars
              data={tableData}
              columns={[
                { key: 'name', header: 'Insurer' },
                { key: 'score', header: 'Best Score' },
                { key: 'status', header: 'Status' },
                { key: 'amount', header: 'Amount' }
              ]}
              onRowClick={(row) => console.log('Row clicked:', row)}
            />
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <Card className="bg-white border border-gray-200 hover:border-primary-purple transition-colors">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center text-gray-900">
            <div className="mr-3">
              <div className="bg-primary-purple/5 rounded-lg p-2">
                <Activity className="h-6 w-6 text-primary-purple" />
              </div>
            </div>
            <div>
              <h3 className="text-xl font-bold">Recent Activity</h3>
              <p className="text-sm text-gray-600 font-medium">Latest updates in your system</p>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {recentActivity.length > 0 ? (
              recentActivity.slice(0, 5).map((activity, index) => (
                <div key={index} className="flex items-center space-x-4 p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors">
                  <div className={`w-3 h-3 rounded-full ${
                    activity.type === 'claim' ? 'bg-accent-cyan' :
                    activity.type === 'payment' ? 'bg-primary-purple' :
                    activity.type === 'authorization' ? 'bg-accent-purple' :
                    'bg-gray-400'
                  }`}></div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-gray-900">{activity.description}</p>
                    <p className="text-xs text-gray-600 mt-1">{activity.title}</p>
                  </div>
                  <span className="text-xs text-gray-500">
                    {activity.created_at ? new Date(activity.created_at).toLocaleString() : 'N/A'}
                  </span>
                </div>
              ))
            ) : (
              <div className="text-center text-gray-500 py-8">
                <div className="w-16 h-16 bg-gray-100 rounded-full mx-auto mb-4 flex items-center justify-center">
                  <Activity className="w-8 h-8 text-gray-400" />
                </div>
                <p className="text-lg font-medium">No recent activity</p>
                <p className="text-sm text-gray-400 mt-1">Activity will appear here when available</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Drill-down Modal */}
      {showDrillDown && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-7xl w-full max-h-[90vh] overflow-hidden border border-gray-200">
            {/* Header */}
            <div className="bg-primary-purple p-6 text-white">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-2xl font-bold">{drillDownTitle}</h2>
                  <p className="text-white/80 mt-1">Detailed breakdown of selected data</p>
                </div>
                <button
                  onClick={closeDrillDown}
                  className="text-white/80 hover:text-white hover:bg-white/10 p-2 rounded-lg transition-colors"
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
                    <tr className="bg-gray-50">
                      <th className="px-6 py-4 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">
                        ID
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">
                        Type
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">
                        Amount
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">
                        Date
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">
                        Details
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {drillDownData.map((item, index) => (
                      <tr key={index} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {item.id || item.claim_number || item.payment_ref_number || 'N/A'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          {item.type || 'Record'}
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
                          {item.amount ? `$${parseFloat(item.amount).toLocaleString()}` :
                           item.total_amount ? `$${parseFloat(item.total_amount).toLocaleString()}` : 'N/A'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          {item.created_at ? new Date(item.created_at).toLocaleDateString() :
                           item.payment_date ? new Date(item.payment_date).toLocaleDateString() : 'N/A'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          {item.description || item.purpose || 'N/A'}
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
                  className="bg-primary-purple text-white px-6 py-2 rounded-lg hover:bg-primary-purple/90 transition-colors font-medium"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
