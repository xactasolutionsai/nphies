import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Users, Building2, Receipt, CreditCard, TrendingUp, Activity, Shield, 
  FileCheck, BarChart3, Heart, DollarSign, FileText, RefreshCw, 
  AlertCircle, Clock, Download, Eye, Pill, Stethoscope, CheckCircle2,
  XCircle, ArrowUpRight, ArrowDownRight, ChevronRight
} from 'lucide-react';
import { 
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer, AreaChart, Area, Legend, 
  ComposedChart, Line, RadialBarChart, RadialBar
} from 'recharts';
import StatCard from '@/components/StatCard';
import StatusBadge from '@/components/StatusBadge';
import api from '@/services/api';

// Refined color palette for light minimal theme
const CHART_COLORS = {
  primary: '#6366F1',    // Indigo
  secondary: '#8B5CF6',  // Violet
  success: '#10B981',    // Emerald
  warning: '#F59E0B',    // Amber
  danger: '#EF4444',     // Red
  info: '#06B6D4',       // Cyan
  muted: '#94A3B8',      // Slate
  purple: '#A855F7',     // Purple
};

const PIE_COLORS = ['#6366F1', '#8B5CF6', '#A855F7', '#06B6D4', '#10B981', '#F59E0B'];

// Status-based colors for claims pipeline chart
const PIPELINE_STATUS_COLORS = {
  'Pending': '#F59E0B',      // Amber - waiting
  'Under Review': '#8B5CF6', // Violet - in progress
  'Resubmitted': '#06B6D4',  // Cyan - resubmitted
  'Approved': '#10B981',     // Green - success
  'Denied': '#EF4444',       // Red - rejected
  'Rejected': '#DC2626',     // Darker red - rejected
  'Paid': '#059669',         // Emerald - completed
  'Finalized': '#6366F1',    // Indigo - done
  'Draft': '#94A3B8',        // Gray - draft
  'Error': '#F43F5E',        // Rose - error
};

const STATUS_COLORS = {
  approved: '#10B981',
  denied: '#EF4444',
  pending: '#F59E0B',
  draft: '#94A3B8',
  error: '#EF4444',
  eligible: '#10B981',
  not_eligible: '#EF4444'
};

const AUTO_REFRESH_INTERVAL = 60000;

export default function Dashboard() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefreshTime, setLastRefreshTime] = useState(new Date());
  const autoRefreshIntervalRef = useRef(null);

  const loadDashboardData = useCallback(async () => {
    try {
      setRefreshing(true);
      const response = await api.getComprehensiveDashboardStats();
      setData(response.data);
      setLastRefreshTime(new Date());
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadDashboardData();
    autoRefreshIntervalRef.current = setInterval(loadDashboardData, AUTO_REFRESH_INTERVAL);
    return () => {
      if (autoRefreshIntervalRef.current) {
        clearInterval(autoRefreshIntervalRef.current);
      }
    };
  }, [loadDashboardData]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="relative inline-flex">
            <div className="w-12 h-12 border-4 border-indigo-200 rounded-full"></div>
            <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin absolute top-0"></div>
          </div>
          <p className="mt-4 text-gray-500 font-medium">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  const { 
    counts = {}, 
    priorAuthorizations = {}, 
    eligibilityAnalytics = {},
    coverageDistribution = [],
    claimsPipeline = [],
    enhancedPerformance = {},
    financial = {},
    timeSeries = {},
    recentActivity = [],
    specialtyApprovals = []
  } = data || {};

  // Calculate summary metrics
  const totalClaimsValue = claimsPipeline.reduce((sum, item) => sum + parseFloat(item.total_amount || 0), 0);
  const avgClaimValue = claimsPipeline.reduce((sum, item) => sum + parseFloat(item.avg_amount || 0), 0) / (claimsPipeline.length || 1);
  
  // Process prior auth data for charts
  const priorAuthByType = (priorAuthorizations.summary || []).map(item => ({
    name: item.auth_type?.charAt(0).toUpperCase() + item.auth_type?.slice(1) || 'Unknown',
    value: parseInt(item.total) || 0,
    approved: parseInt(item.approved) || 0,
    denied: parseInt(item.denied) || 0,
    approvalRate: parseFloat(item.approval_rate) || 0
  }));

  // Process eligibility by insurer
  const eligibilityByInsurer = (eligibilityAnalytics.byInsurer || []).slice(0, 8).map(item => ({
    name: item.insurer_name?.length > 20 ? item.insurer_name.substring(0, 20) + '...' : item.insurer_name,
    fullName: item.insurer_name,
    eligible: parseInt(item.eligible) || 0,
    notEligible: parseInt(item.not_eligible) || 0,
    total: parseInt(item.total_checks) || 0,
    rate: parseFloat(item.eligibility_rate) || 0
  }));

  // Process claims pipeline for funnel with status-based colors
  const pipelineData = claimsPipeline.map(item => ({
    name: item.status,
    count: parseInt(item.count) || 0,
    amount: parseFloat(item.total_amount) || 0,
    fill: PIPELINE_STATUS_COLORS[item.status] || CHART_COLORS.primary
  }));

  // Custom tooltip for charts
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white px-4 py-3 rounded-lg shadow-lg border border-gray-100">
          <p className="font-medium text-gray-900 mb-1">{label}</p>
          {payload.map((entry, index) => (
            <p key={index} className="text-sm" style={{ color: entry.color }}>
              {entry.name}: {typeof entry.value === 'number' && entry.value >= 1000 
                ? `${entry.value.toLocaleString()} SAR` 
                : entry.value}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-[1600px] mx-auto px-6 py-8">
        
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Healthcare Analytics</h1>
              <p className="text-gray-500 mt-1">Comprehensive overview of your healthcare management system</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <span>Live</span>
                <span className="text-gray-300">|</span>
                <Clock className="w-4 h-4" />
                <span>{lastRefreshTime.toLocaleTimeString()}</span>
              </div>
              <button
                onClick={loadDashboardData}
                disabled={refreshing}
                className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>
          </div>
        </div>

        {/* Hero Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
          <StatCard
            title="Patients"
            value={counts.patients || 0}
            icon={Users}
            color="primary"
            size="small"
          />
          <StatCard
            title="Providers"
            value={counts.providers || 0}
            icon={Building2}
            color="purple"
            size="small"
          />
          <StatCard
            title="Insurers"
            value={counts.insurers || 0}
            icon={Shield}
            color="cyan"
            size="small"
          />
          <StatCard
            title="Prior Auths"
            value={counts.priorAuthorizations || 0}
            icon={FileCheck}
            color="teal"
            size="small"
          />
          <StatCard
            title="Eligibility Rate"
            value={`${counts.eligibilityRate || 0}%`}
            icon={CheckCircle2}
            color="green"
            size="small"
          />
          <StatCard
            title="Claims Value"
            value={`${(totalClaimsValue / 1000).toFixed(1)}K SAR`}
            icon={DollarSign}
            color="orange"
            size="small"
          />
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          
          {/* Prior Authorization by Type */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Prior Authorizations</h2>
                <p className="text-sm text-gray-500">Distribution by type</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold text-gray-900">{counts.priorAuthorizations || 0}</span>
                <span className="text-sm text-gray-500">total</span>
              </div>
            </div>
            
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={priorAuthByType}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {priorAuthByType.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            
            {/* Legend */}
            <div className="grid grid-cols-2 gap-3 mt-4">
              {priorAuthByType.map((item, index) => (
                <div key={item.name} className="flex items-center justify-between p-2 rounded-lg bg-gray-50">
                  <div className="flex items-center gap-2">
                    <div 
                      className="w-3 h-3 rounded-full" 
                      style={{ backgroundColor: PIE_COLORS[index % PIE_COLORS.length] }}
                    />
                    <span className="text-sm font-medium text-gray-700">{item.name}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-semibold text-gray-900">{item.value}</span>
                    <span className="text-xs text-gray-500 ml-1">({item.approvalRate}%)</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Eligibility by Insurer */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Eligibility by Insurer</h2>
                <p className="text-sm text-gray-500">Eligible vs Not Eligible checks</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold text-green-600">{counts.eligibilityRate || 0}%</span>
                <span className="text-sm text-gray-500">rate</span>
              </div>
            </div>
            
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={eligibilityByInsurer}
                  layout="vertical"
                  margin={{ top: 0, right: 0, left: 0, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 12, fill: '#64748B' }} axisLine={false} />
                  <YAxis 
                    type="category" 
                    dataKey="name" 
                    tick={{ fontSize: 11, fill: '#64748B' }} 
                    width={100}
                    axisLine={false}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="eligible" stackId="a" fill={CHART_COLORS.success} radius={[0, 0, 0, 0]} name="Eligible" />
                  <Bar dataKey="notEligible" stackId="a" fill={CHART_COLORS.danger} radius={[0, 4, 4, 0]} name="Not Eligible" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Claims Pipeline & Financial Summary */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          
          {/* Claims Pipeline */}
          <div className="lg:col-span-2 bg-white rounded-xl border border-gray-100 shadow-sm p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Claims Pipeline</h2>
                <p className="text-sm text-gray-500">Status distribution and amounts</p>
              </div>
            </div>
            
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={pipelineData} margin={{ top: 20, right: 30, left: 0, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                  <XAxis 
                    dataKey="name" 
                    tick={{ fontSize: 11, fill: '#64748B' }} 
                    angle={-45}
                    textAnchor="end"
                    height={60}
                  />
                  <YAxis yAxisId="left" tick={{ fontSize: 12, fill: '#64748B' }} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12, fill: '#64748B' }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                  <Bar yAxisId="left" dataKey="count" radius={[4, 4, 0, 0]} name="Count">
                    {pipelineData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Bar>
                  <Line yAxisId="right" type="monotone" dataKey="amount" stroke={CHART_COLORS.warning} strokeWidth={2} dot={{ fill: CHART_COLORS.warning }} name="Amount (SAR)" />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Financial Summary */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
            <div className="mb-6">
              <h2 className="text-lg font-semibold text-gray-900">Financial Summary</h2>
              <p className="text-sm text-gray-500">Key financial metrics</p>
            </div>
            
            <div className="space-y-4">
              <div className="p-4 rounded-lg bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-100">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-600">Total Claims</span>
                  <DollarSign className="w-5 h-5 text-indigo-500" />
                </div>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {parseFloat(financial.summary?.total_claims_amount || 0).toLocaleString()} SAR
                </p>
              </div>
              
              <div className="p-4 rounded-lg bg-gradient-to-r from-green-50 to-emerald-50 border border-green-100">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-600">Paid Claims</span>
                  <CheckCircle2 className="w-5 h-5 text-green-500" />
                </div>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {parseFloat(financial.summary?.paid_claims_amount || 0).toLocaleString()} SAR
                </p>
              </div>
              
              <div className="p-4 rounded-lg bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-100">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-600">Outstanding</span>
                  <AlertCircle className="w-5 h-5 text-amber-500" />
                </div>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {parseFloat(financial.summary?.outstanding_amount || 0).toLocaleString()} SAR
                </p>
              </div>
              
              <div className="p-4 rounded-lg bg-gray-50 border border-gray-100">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-600">Avg Claim</span>
                  <BarChart3 className="w-5 h-5 text-gray-500" />
                </div>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {parseFloat(financial.summary?.avg_claim_amount || 0).toFixed(0)} SAR
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Provider & Insurer Performance */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          
          {/* Provider Performance */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Provider Performance</h2>
                <p className="text-sm text-gray-500">Claims and authorization metrics</p>
              </div>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider pb-3">Provider</th>
                    <th className="text-right text-xs font-medium text-gray-500 uppercase tracking-wider pb-3">Claims</th>
                    <th className="text-right text-xs font-medium text-gray-500 uppercase tracking-wider pb-3">Auths</th>
                    <th className="text-right text-xs font-medium text-gray-500 uppercase tracking-wider pb-3">Rate</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {(enhancedPerformance.providers || [])
                    .sort((a, b) => (parseFloat(b.auth_approval_rate) || 0) - (parseFloat(a.auth_approval_rate) || 0))
                    .slice(0, 5)
                    .map((provider, index) => (
                    <tr key={index} className="hover:bg-gray-50 transition-colors">
                      <td className="py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center">
                            <Building2 className="w-4 h-4 text-indigo-600" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-900 truncate max-w-[150px]">
                              {provider.provider_name}
                            </p>
                            <p className="text-xs text-gray-500">{provider.provider_type || 'Provider'}</p>
                          </div>
                        </div>
                      </td>
                      <td className="text-right py-3">
                        <span className="text-sm font-semibold text-gray-900">{provider.total_claims || 0}</span>
                      </td>
                      <td className="text-right py-3">
                        <span className="text-sm font-semibold text-gray-900">{provider.total_auths || 0}</span>
                      </td>
                      <td className="text-right py-3">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-16 h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-green-500 rounded-full"
                              style={{ width: `${provider.auth_approval_rate || 0}%` }}
                            />
                          </div>
                          <span className="text-sm font-medium text-gray-700 w-10 text-right">
                            {provider.auth_approval_rate || 0}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Insurer Performance */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Insurer Performance</h2>
                <p className="text-sm text-gray-500">Eligibility and claims metrics</p>
              </div>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider pb-3">Insurer</th>
                    <th className="text-right text-xs font-medium text-gray-500 uppercase tracking-wider pb-3">Claims</th>
                    <th className="text-right text-xs font-medium text-gray-500 uppercase tracking-wider pb-3">Checks</th>
                    <th className="text-right text-xs font-medium text-gray-500 uppercase tracking-wider pb-3">Elig. Rate</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {(enhancedPerformance.insurers || []).slice(0, 5).map((insurer, index) => (
                    <tr key={index} className="hover:bg-gray-50 transition-colors">
                      <td className="py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center">
                            <Shield className="w-4 h-4 text-purple-600" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-900 truncate max-w-[150px]">
                              {insurer.insurer_name}
                            </p>
                            <p className="text-xs text-gray-500">{insurer.plan_type || 'Insurance'}</p>
                          </div>
                        </div>
                      </td>
                      <td className="text-right py-3">
                        <span className="text-sm font-semibold text-gray-900">{insurer.total_claims || 0}</span>
                      </td>
                      <td className="text-right py-3">
                        <span className="text-sm font-semibold text-gray-900">{insurer.eligibility_checks || 0}</span>
                      </td>
                      <td className="text-right py-3">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-16 h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-emerald-500 rounded-full"
                              style={{ width: `${insurer.eligibility_rate || 0}%` }}
                            />
                          </div>
                          <span className="text-sm font-medium text-gray-700 w-10 text-right">
                            {insurer.eligibility_rate || 0}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Coverage Distribution & Trends */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          
          {/* Coverage Distribution */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Coverage Distribution</h2>
                <p className="text-sm text-gray-500">Patients per insurer</p>
              </div>
            </div>
            
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={(coverageDistribution || []).slice(0, 8)} margin={{ top: 0, right: 0, left: 0, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                  <XAxis 
                    dataKey="insurer_name" 
                    tick={{ fontSize: 10, fill: '#64748B' }}
                    angle={-45}
                    textAnchor="end"
                    height={60}
                    tickFormatter={(value) => value?.length > 12 ? value.substring(0, 12) + '...' : value}
                  />
                  <YAxis tick={{ fontSize: 12, fill: '#64748B' }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="patient_count" fill={CHART_COLORS.info} radius={[4, 4, 0, 0]} name="Patients" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Prior Auth Trends */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Authorization Trends</h2>
                <p className="text-sm text-gray-500">Last 30 days</p>
              </div>
            </div>
            
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={timeSeries.priorAuthTrends || []} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={CHART_COLORS.primary} stopOpacity={0.2}/>
                      <stop offset="95%" stopColor={CHART_COLORS.primary} stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorApproved" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={CHART_COLORS.success} stopOpacity={0.2}/>
                      <stop offset="95%" stopColor={CHART_COLORS.success} stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                  <XAxis 
                    dataKey="day" 
                    tick={{ fontSize: 11, fill: '#64748B' }}
                    angle={-45}
                    textAnchor="end"
                    height={50}
                  />
                  <YAxis tick={{ fontSize: 12, fill: '#64748B' }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area 
                    type="monotone" 
                    dataKey="total" 
                    stroke={CHART_COLORS.primary} 
                    strokeWidth={2}
                    fill="url(#colorTotal)" 
                    name="Total"
                  />
                  <Area 
                    type="monotone" 
                    dataKey="approved" 
                    stroke={CHART_COLORS.success} 
                    strokeWidth={2}
                    fill="url(#colorApproved)" 
                    name="Approved"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Recent Activity & Specialty Approvals */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Recent Prior Authorizations */}
          <div className="lg:col-span-2 bg-white rounded-xl border border-gray-100 shadow-sm p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Recent Prior Authorizations</h2>
                <p className="text-sm text-gray-500">Latest authorization requests</p>
              </div>
              <button 
                onClick={() => navigate('/prior-authorizations')}
                className="text-sm text-indigo-600 hover:text-indigo-700 font-medium flex items-center gap-1"
              >
                View all <ChevronRight className="w-4 h-4" />
              </button>
            </div>
            
            <div className="space-y-3">
              {(priorAuthorizations.recent || []).slice(0, 5).map((auth, index) => (
                <div 
                  key={index} 
                  onClick={() => navigate(`/prior-authorizations/${auth.id}`)}
                  className="flex items-center justify-between p-4 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors cursor-pointer group"
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      auth.auth_type === 'pharmacy' ? 'bg-purple-100' :
                      auth.auth_type === 'dental' ? 'bg-blue-100' :
                      auth.auth_type === 'vision' ? 'bg-cyan-100' :
                      'bg-indigo-100'
                    }`}>
                      {auth.auth_type === 'pharmacy' ? <Pill className="w-5 h-5 text-purple-600" /> :
                       auth.auth_type === 'dental' ? <Stethoscope className="w-5 h-5 text-blue-600" /> :
                       auth.auth_type === 'vision' ? <Eye className="w-5 h-5 text-cyan-600" /> :
                       <FileCheck className="w-5 h-5 text-indigo-600" />}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900 group-hover:text-indigo-600 transition-colors">{auth.patient_name || 'Unknown Patient'}</p>
                      <p className="text-xs text-gray-500">
                        {auth.provider_name || 'Unknown Provider'} • {auth.auth_type}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <StatusBadge status={auth.status} size="small" />
                    <span className="text-xs text-gray-400">
                      {auth.created_at ? new Date(auth.created_at).toLocaleDateString() : 'N/A'}
                    </span>
                    <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-indigo-500 transition-colors" />
                  </div>
                </div>
              ))}
              
              {(!priorAuthorizations.recent || priorAuthorizations.recent.length === 0) && (
                <div className="text-center py-8 text-gray-500">
                  <FileCheck className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                  <p>No recent authorizations</p>
                </div>
              )}
            </div>
          </div>

          {/* Authorization Types Summary */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
            <div className="mb-6">
              <h2 className="text-lg font-semibold text-gray-900">Authorization Types</h2>
              <p className="text-sm text-gray-500">All prior authorization categories</p>
            </div>
            
            <div className="space-y-3">
              {(specialtyApprovals || []).map((specialty, index) => {
                const typeConfig = {
                  dental: { icon: Stethoscope, bg: 'bg-blue-100', color: 'text-blue-600' },
                  vision: { icon: Eye, bg: 'bg-cyan-100', color: 'text-cyan-600' },
                  pharmacy: { icon: Pill, bg: 'bg-purple-100', color: 'text-purple-600' },
                  institutional: { icon: Building2, bg: 'bg-indigo-100', color: 'text-indigo-600' }
                };
                const config = typeConfig[specialty.type] || { icon: FileCheck, bg: 'bg-gray-100', color: 'text-gray-600' };
                const IconComponent = config.icon;
                
                return (
                  <div key={index} className="p-4 rounded-lg border border-gray-100 hover:border-gray-200 transition-colors">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-lg ${config.bg} flex items-center justify-center`}>
                          <IconComponent className={`w-5 h-5 ${config.color}`} />
                        </div>
                        <span className="font-medium text-gray-900 capitalize">{specialty.type}</span>
                      </div>
                      <span className="text-2xl font-bold text-gray-900">{specialty.total || 0}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="flex items-center gap-1.5 bg-green-50 rounded-md px-2 py-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                        <span className="text-green-700 font-medium">{specialty.approved || 0} approved</span>
                      </div>
                      <div className="flex items-center gap-1.5 bg-amber-50 rounded-md px-2 py-1.5">
                        <Clock className="w-3.5 h-3.5 text-amber-500" />
                        <span className="text-amber-700 font-medium">{specialty.pending || 0} pending</span>
                      </div>
                      <div className="flex items-center gap-1.5 bg-red-50 rounded-md px-2 py-1.5">
                        <XCircle className="w-3.5 h-3.5 text-red-500" />
                        <span className="text-red-700 font-medium">{specialty.denied || 0} denied</span>
                      </div>
                      <div className="flex items-center gap-1.5 bg-gray-50 rounded-md px-2 py-1.5">
                        <AlertCircle className="w-3.5 h-3.5 text-gray-500" />
                        <span className="text-gray-700 font-medium">{specialty.error || 0} error</span>
                      </div>
                    </div>
                  </div>
                );
              })}
              
              {(!specialtyApprovals || specialtyApprovals.length === 0) && (
                <div className="text-center py-8 text-gray-500">
                  <FileCheck className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                  <p>No authorization data</p>
                </div>
              )}
            </div>

            {/* Recent Activity */}
            <div className="mt-6 pt-6 border-t border-gray-100">
              <h3 className="text-sm font-semibold text-gray-900 mb-4">Recent Activity</h3>
              <div className="space-y-3">
                {(recentActivity || []).slice(0, 3).map((activity, index) => (
                  <div key={index} className="flex items-start gap-3">
                    <div className={`w-2 h-2 rounded-full mt-2 ${
                      activity.type === 'claim' ? 'bg-indigo-500' :
                      activity.type === 'payment' ? 'bg-green-500' :
                      activity.type === 'authorization' ? 'bg-purple-500' :
                      'bg-gray-400'
                    }`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-900 truncate">{activity.description}</p>
                      <p className="text-xs text-gray-500">{activity.title}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
