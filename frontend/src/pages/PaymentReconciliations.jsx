import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import DataTable from '@/components/DataTable';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Legend } from 'recharts';
import { 
  Wallet, 
  TrendingUp, 
  Building2, 
  FileCheck, 
  AlertCircle, 
  Calendar,
  DollarSign,
  Receipt,
  ArrowRight,
  RefreshCw,
  Filter,
  Search
} from 'lucide-react';
import api from '@/services/api';

const COLORS = ['#10B981', '#6366F1', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];

export default function PaymentReconciliations() {
  const navigate = useNavigate();
  const [reconciliations, setReconciliations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, pages: 0 });
  
  // Filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  useEffect(() => {
    loadData();
  }, [pagination.page, statusFilter, startDate, endDate]);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Load reconciliations using proper API method
      const reconciliationsResponse = await api.getPaymentReconciliations({
        page: pagination.page,
        limit: pagination.limit,
        search: searchTerm,
        status: statusFilter,
        startDate,
        endDate
      });
      
      setReconciliations(reconciliationsResponse.data || []);
      if (reconciliationsResponse.pagination) {
        setPagination(prev => ({ ...prev, ...reconciliationsResponse.pagination }));
      }
      
      // Load stats using proper API method
      const statsResponse = await api.getPaymentReconciliationStats();
      setStats(statsResponse.data || null);
      
    } catch (error) {
      console.error('Error loading payment reconciliations:', error);
      // Set mock data for demonstration
      setReconciliations([]);
      setStats({
        summary: {
          total_reconciliations: 0,
          total_payment_amount: 0,
          active_count: 0,
          processed_count: 0,
          total_nphies_fees: 0,
          total_early_fees: 0
        },
        monthlyTrends: [],
        byInsurer: []
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    setPagination(prev => ({ ...prev, page: 1 }));
    loadData();
  };

  const handleRowClick = (reconciliation) => {
    navigate(`/payment-reconciliations/${reconciliation.id}`);
  };

  const getStatusBadge = (status) => {
    const variants = {
      'active': 'default',
      'cancelled': 'destructive',
      'draft': 'secondary',
      'entered-in-error': 'outline'
    };
    return variants[status] || 'outline';
  };

  const getProcessingBadge = (status) => {
    const variants = {
      'processed': 'default',
      'received': 'secondary',
      'error': 'destructive',
      'duplicate': 'outline'
    };
    return variants[status] || 'outline';
  };

  const formatCurrency = (amount, currency = 'SAR') => {
    if (amount === null || amount === undefined) return '-';
    return new Intl.NumberFormat('en-SA', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2
    }).format(amount);
  };

  const columns = [
    {
      key: 'fhir_id',
      header: 'Reconciliation ID',
      accessor: 'fhir_id',
      render: (row) => (
        <span className="font-mono text-sm text-primary-purple">{row.fhir_id}</span>
      )
    },
    {
      key: 'insurer_name',
      header: 'Insurer',
      accessor: 'insurer_name',
      render: (row) => row.insurer_name || <span className="text-gray-400">Unknown</span>
    },
    {
      key: 'payment_amount',
      header: 'Payment Amount',
      accessor: 'payment_amount',
      render: (row) => (
        <span className="font-semibold text-emerald-600">
          {formatCurrency(row.payment_amount, row.payment_currency)}
        </span>
      )
    },
    {
      key: 'detail_count',
      header: 'Claims',
      accessor: 'detail_count',
      render: (row) => (
        <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
          {row.detail_count || 0} claims
        </Badge>
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
      key: 'processing_status',
      header: 'Processing',
      accessor: 'processing_status',
      render: (row) => (
        <Badge variant={getProcessingBadge(row.processing_status)}>
          {row.processing_status}
        </Badge>
      )
    },
    {
      key: 'payment_date',
      header: 'Payment Date',
      accessor: 'payment_date',
      render: (row) => row.payment_date ? new Date(row.payment_date).toLocaleDateString() : '-'
    },
    {
      key: 'actions',
      header: '',
      render: (row) => (
        <Button 
          variant="ghost" 
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            navigate(`/payment-reconciliations/${row.id}`);
          }}
        >
          <ArrowRight className="h-4 w-4" />
        </Button>
      )
    }
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="relative">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-emerald-500/20"></div>
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-transparent border-t-emerald-500 absolute top-0"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="relative">
        <div className="relative bg-gradient-to-br from-emerald-50 via-white to-teal-50 rounded-2xl p-8 border border-emerald-100 overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-emerald-200/20 to-teal-200/20 rounded-full -translate-y-1/2 translate-x-1/2"></div>
          <div className="relative flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-emerald-700 to-teal-600 bg-clip-text text-transparent">
                Payment Reconciliation
              </h1>
              <p className="text-gray-600 mt-2 text-lg">nphies Payment Notifications from Insurers</p>
              <div className="flex items-center space-x-4 mt-4">
                <div className="flex items-center space-x-2 text-sm text-gray-500">
                  <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                  <span>FHIR R4 Compliant</span>
                </div>
                <div className="text-sm text-gray-500">
                  Total Records: {pagination.total}
                </div>
              </div>
            </div>
            <div className="hidden md:flex items-center space-x-3">
              <div className="bg-white/80 backdrop-blur rounded-xl p-4 border border-emerald-100 shadow-sm">
                <Wallet className="h-10 w-10 text-emerald-600" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="bg-gradient-to-br from-emerald-500 to-teal-600 text-white border-0">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-emerald-100 text-sm font-medium">Total Payments</p>
                  <p className="text-3xl font-bold mt-1">
                    {formatCurrency(stats.summary?.total_payment_amount || 0)}
                  </p>
                </div>
                <div className="bg-white/20 rounded-xl p-3">
                  <DollarSign className="h-8 w-8" />
                </div>
              </div>
              <div className="mt-4 flex items-center text-emerald-100 text-sm">
                <Receipt className="h-4 w-4 mr-1" />
                {stats.summary?.total_reconciliations || 0} reconciliations
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white border border-gray-100 hover:shadow-lg transition-shadow">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-500 text-sm font-medium">Active Records</p>
                  <p className="text-3xl font-bold text-gray-900 mt-1">
                    {stats.summary?.active_count || 0}
                  </p>
                </div>
                <div className="bg-blue-100 rounded-xl p-3">
                  <FileCheck className="h-8 w-8 text-blue-600" />
                </div>
              </div>
              <div className="mt-4 flex items-center text-gray-500 text-sm">
                <TrendingUp className="h-4 w-4 mr-1 text-emerald-500" />
                {stats.summary?.processed_count || 0} processed
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white border border-gray-100 hover:shadow-lg transition-shadow">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-500 text-sm font-medium">nphies Fees</p>
                  <p className="text-3xl font-bold text-amber-600 mt-1">
                    {formatCurrency(Math.abs(stats.summary?.total_nphies_fees || 0))}
                  </p>
                </div>
                <div className="bg-amber-100 rounded-xl p-3">
                  <AlertCircle className="h-8 w-8 text-amber-600" />
                </div>
              </div>
              <div className="mt-4 flex items-center text-gray-500 text-sm">
                Service charges deducted
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white border border-gray-100 hover:shadow-lg transition-shadow">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-500 text-sm font-medium">Early Fees</p>
                  <p className="text-3xl font-bold text-purple-600 mt-1">
                    {formatCurrency(Math.abs(stats.summary?.total_early_fees || 0))}
                  </p>
                </div>
                <div className="bg-purple-100 rounded-xl p-3">
                  <Calendar className="h-8 w-8 text-purple-600" />
                </div>
              </div>
              <div className="mt-4 flex items-center text-gray-500 text-sm">
                Early settlement charges
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Charts */}
      {stats && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Monthly Trends */}
          <Card className="bg-white border-0 shadow-sm">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center text-gray-900">
                <div className="bg-emerald-100 rounded-lg p-2 mr-3">
                  <TrendingUp className="h-5 w-5 text-emerald-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold">Monthly Payment Trends</h3>
                  <p className="text-sm text-gray-500 font-normal">Last 12 months</p>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                {stats.monthlyTrends && stats.monthlyTrends.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={stats.monthlyTrends}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                      <XAxis 
                        dataKey="month" 
                        stroke="#6B7280"
                        tickFormatter={(value) => {
                          const date = new Date(value);
                          return date.toLocaleDateString('en-US', { month: 'short' });
                        }}
                      />
                      <YAxis stroke="#6B7280" />
                      <Tooltip 
                        contentStyle={{
                          backgroundColor: '#FFFFFF',
                          border: '1px solid #E5E7EB',
                          borderRadius: '8px'
                        }}
                        formatter={(value, name) => [
                          name === 'amount' ? formatCurrency(value) : value,
                          name === 'amount' ? 'Amount' : 'Count'
                        ]}
                      />
                      <Legend />
                      <Line 
                        type="monotone" 
                        dataKey="amount" 
                        stroke="#10B981" 
                        strokeWidth={2}
                        dot={{ fill: '#10B981' }}
                        name="Payment Amount"
                      />
                      <Line 
                        type="monotone" 
                        dataKey="count" 
                        stroke="#6366F1" 
                        strokeWidth={2}
                        dot={{ fill: '#6366F1' }}
                        name="Count"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-gray-400">
                    <div className="text-center">
                      <TrendingUp className="h-12 w-12 mx-auto mb-2 opacity-50" />
                      <p>No trend data available</p>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* By Insurer */}
          <Card className="bg-white border-0 shadow-sm">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center text-gray-900">
                <div className="bg-blue-100 rounded-lg p-2 mr-3">
                  <Building2 className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold">Payments by Insurer</h3>
                  <p className="text-sm text-gray-500 font-normal">Top 10 insurers</p>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                {stats.byInsurer && stats.byInsurer.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={stats.byInsurer} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                      <XAxis type="number" stroke="#6B7280" />
                      <YAxis 
                        type="category" 
                        dataKey="insurer_name" 
                        stroke="#6B7280"
                        width={120}
                        tick={{ fontSize: 12 }}
                      />
                      <Tooltip 
                        contentStyle={{
                          backgroundColor: '#FFFFFF',
                          border: '1px solid #E5E7EB',
                          borderRadius: '8px'
                        }}
                        formatter={(value) => [formatCurrency(value), 'Amount']}
                      />
                      <Bar dataKey="amount" fill="#10B981" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-gray-400">
                    <div className="text-center">
                      <Building2 className="h-12 w-12 mx-auto mb-2 opacity-50" />
                      <p>No insurer data available</p>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <Card className="bg-white border-0 shadow-sm">
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4 items-end">
            <div className="flex-1 min-w-[200px]">
              <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by ID, reference..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                />
              </div>
            </div>
            
            <div className="w-40">
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              >
                <option value="">All Status</option>
                <option value="active">Active</option>
                <option value="cancelled">Cancelled</option>
                <option value="draft">Draft</option>
              </select>
            </div>
            
            <div className="w-40">
              <label className="block text-sm font-medium text-gray-700 mb-1">From Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              />
            </div>
            
            <div className="w-40">
              <label className="block text-sm font-medium text-gray-700 mb-1">To Date</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              />
            </div>
            
            <Button onClick={handleSearch} className="bg-emerald-600 hover:bg-emerald-700">
              <Filter className="h-4 w-4 mr-2" />
              Apply Filters
            </Button>
            
            <Button variant="outline" onClick={() => {
              setSearchTerm('');
              setStatusFilter('');
              setStartDate('');
              setEndDate('');
              setPagination(prev => ({ ...prev, page: 1 }));
              loadData();
            }}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Reset
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Data Table */}
      <Card className="bg-white border-0 shadow-sm">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center text-gray-900">
            <div className="bg-emerald-100 rounded-lg p-2 mr-3">
              <Receipt className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold">Payment Reconciliations</h3>
              <p className="text-sm text-gray-500 font-normal">Click a row to view details</p>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {reconciliations.length > 0 ? (
            <DataTable
              data={reconciliations}
              columns={columns}
              onRowClick={handleRowClick}
              sortable={true}
              pageSize={pagination.limit}
            />
          ) : (
            <div className="text-center py-12 text-gray-400">
              <Wallet className="h-16 w-16 mx-auto mb-4 opacity-50" />
              <p className="text-xl font-medium">No reconciliations found</p>
              <p className="mt-2">Payment reconciliation records will appear here when insurers send payment notifications.</p>
            </div>
          )}
          
          {/* Pagination */}
          {pagination.pages > 1 && (
            <div className="flex items-center justify-between mt-6 pt-6 border-t">
              <div className="text-sm text-gray-500">
                Showing {((pagination.page - 1) * pagination.limit) + 1} to {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} results
              </div>
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pagination.page === 1}
                  onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                >
                  Previous
                </Button>
                <span className="px-3 py-1 bg-emerald-50 text-emerald-700 rounded-lg text-sm font-medium">
                  Page {pagination.page} of {pagination.pages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pagination.page === pagination.pages}
                  onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

