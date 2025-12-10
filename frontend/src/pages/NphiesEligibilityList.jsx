import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import DataTable from '@/components/DataTable';
import api from '@/services/api';
import { 
  Shield, Plus, Eye, RefreshCw, 
  CheckCircle, XCircle, AlertCircle, Clock,
  Filter, Search, FileText
} from 'lucide-react';

// Status display helper
const getStatusDisplay = (status) => {
  const statuses = {
    eligible: 'Eligible',
    not_eligible: 'Not Eligible',
    pending: 'Pending',
    error: 'Error'
  };
  return statuses[status] || status;
};

// Format date helper
const formatDate = (dateString) => {
  if (!dateString) return '-';
  return new Date(dateString).toLocaleDateString();
};

export default function NphiesEligibilityList() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [eligibilityRecords, setEligibilityRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    pages: 0
  });
  const [filters, setFilters] = useState({
    search: searchParams.get('search') || '',
    status: searchParams.get('status') || ''
  });

  useEffect(() => {
    loadEligibilityRecords();
  }, [pagination.page, filters.status]);

  const loadEligibilityRecords = async () => {
    try {
      setLoading(true);
      const params = {
        page: pagination.page,
        limit: pagination.limit,
        ...(filters.search && { search: filters.search }),
        ...(filters.status && { status: filters.status })
      };
      const response = await api.getEligibility(params);
      const data = response?.data || [];
      setEligibilityRecords(Array.isArray(data) ? data : []);
      if (response?.pagination) {
        setPagination(prev => ({
          ...prev,
          total: response.pagination.total,
          pages: response.pagination.pages
        }));
      }
    } catch (error) {
      console.error('Error loading eligibility records:', error);
      setEligibilityRecords([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    setPagination(prev => ({ ...prev, page: 1 }));
    loadEligibilityRecords();
    // Update URL params
    const params = new URLSearchParams();
    if (filters.search) params.set('search', filters.search);
    if (filters.status) params.set('status', filters.status);
    setSearchParams(params);
  };

  const handleClearFilters = () => {
    setFilters({ search: '', status: '' });
    setSearchParams({});
    setPagination(prev => ({ ...prev, page: 1 }));
    loadEligibilityRecords();
  };

  const getStatusBadge = (status) => {
    const configs = {
      eligible: { variant: 'default', icon: CheckCircle, className: 'bg-green-500' },
      not_eligible: { variant: 'destructive', icon: XCircle, className: '' },
      pending: { variant: 'default', icon: Clock, className: 'bg-blue-500' },
      error: { variant: 'destructive', icon: AlertCircle, className: '' }
    };
    const config = configs[status] || { variant: 'outline', icon: FileText, className: 'text-gray-600' };
    const Icon = config.icon;
    
    return (
      <Badge variant={config.variant} className={`gap-1 ${config.className}`}>
        <Icon className="h-3 w-3" />
        {getStatusDisplay(status)}
      </Badge>
    );
  };

  const getOutcomeBadge = (outcome) => {
    const configs = {
      complete: { variant: 'default', className: 'bg-green-500' },
      error: { variant: 'destructive', className: '' },
      partial: { variant: 'default', className: 'bg-orange-500' }
    };
    const config = configs[outcome] || { variant: 'outline', className: '' };
    
    return (
      <Badge variant={config.variant} className={config.className}>
        {outcome?.toUpperCase() || 'N/A'}
      </Badge>
    );
  };

  const getSiteEligibilityBadge = (siteEligibility) => {
    if (!siteEligibility) return <span className="text-gray-400">-</span>;
    const isEligible = siteEligibility === 'eligible';
    return (
      <Badge variant={isEligible ? 'default' : 'destructive'} className={isEligible ? 'bg-green-500' : ''}>
        {isEligible ? 'Eligible' : 'Not Eligible'}
      </Badge>
    );
  };

  // Table columns
  const columns = [
    {
      key: 'patient_name',
      header: 'Patient',
      accessor: 'patient_name',
      render: (row) => (
        <div>
          <div className="font-medium">{row.patient_name || '-'}</div>
          <div className="text-xs text-gray-500">{row.patient_identifier}</div>
        </div>
      )
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
      render: (row) => getStatusBadge(row.status)
    },
    {
      key: 'outcome',
      header: 'Outcome',
      accessor: 'outcome',
      render: (row) => getOutcomeBadge(row.outcome)
    },
    {
      key: 'site_eligibility',
      header: 'Site Eligibility',
      accessor: 'site_eligibility',
      render: (row) => getSiteEligibilityBadge(row.site_eligibility)
    },
    {
      key: 'inforce',
      header: 'In Force',
      accessor: 'inforce',
      render: (row) => (
        row.inforce ? (
          <Badge variant="default" className="bg-green-500 gap-1">
            <CheckCircle className="h-3 w-3" />
            Yes
          </Badge>
        ) : (
          <Badge variant="destructive" className="gap-1">
            <XCircle className="h-3 w-3" />
            No
          </Badge>
        )
      )
    },
    {
      key: 'request_date',
      header: 'Request Date',
      accessor: 'request_date',
      render: (row) => formatDate(row.request_date)
    },
    {
      key: 'actions',
      header: 'Actions',
      accessor: 'id',
      render: (row) => (
        <div className="flex gap-1">
          <Button
            size="sm"
            variant="outline"
            title="View Details"
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/nphies-eligibility/${row.eligibility_id || row.id}`);
            }}
          >
            <Eye className="h-4 w-4" />
          </Button>
        </div>
      )
    }
  ];

  // Stats calculations
  const stats = {
    total: pagination.total,
    eligible: eligibilityRecords.filter(r => r.status === 'eligible').length,
    notEligible: eligibilityRecords.filter(r => r.status === 'not_eligible').length,
    pending: eligibilityRecords.filter(r => r.status === 'pending').length
  };

  if (loading && eligibilityRecords.length === 0) {
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
      <div className="relative">
        <div className="relative bg-white rounded-2xl p-8 border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold text-gray-900">
                NPHIES Eligibility
              </h1>
              <p className="text-gray-600 mt-2 text-lg">
                Patient Insurance Eligibility Verification
              </p>
              <div className="flex items-center space-x-4 mt-4">
                <div className="flex items-center space-x-2 text-sm text-gray-500">
                  <div className="w-2 h-2 bg-accent-cyan rounded-full animate-pulse"></div>
                  <span>Connected to NPHIES</span>
                </div>
                <div className="text-sm text-gray-500">
                  Total: {stats.total} | Eligible: {stats.eligible} | Not Eligible: {stats.notEligible}
                </div>
              </div>
            </div>
            <Button 
              onClick={() => navigate('/nphies-eligibility/new')} 
              className="bg-gradient-to-r from-primary-purple to-accent-purple"
            >
              <Plus className="h-5 w-5 mr-2" />
              New Eligibility Check
            </Button>
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-gray-50 to-white">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Total</p>
                <p className="text-2xl font-bold">{stats.total}</p>
              </div>
              <FileText className="h-8 w-8 text-gray-400" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-green-50 to-white">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-green-600">Eligible</p>
                <p className="text-2xl font-bold text-green-700">{stats.eligible}</p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-400" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-red-50 to-white">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-red-600">Not Eligible</p>
                <p className="text-2xl font-bold text-red-700">{stats.notEligible}</p>
              </div>
              <XCircle className="h-8 w-8 text-red-400" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-blue-50 to-white">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-blue-600">Pending</p>
                <p className="text-2xl font-bold text-blue-700">{stats.pending}</p>
              </div>
              <Clock className="h-8 w-8 text-blue-400" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4 items-end">
            <div className="flex-1 min-w-[200px]">
              <label className="text-sm font-medium mb-1 block">Search</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search by patient, provider, insurer..."
                  value={filters.search}
                  onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="w-40">
              <label className="text-sm font-medium mb-1 block">Status</label>
              <select
                value={filters.status}
                onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
                className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-purple/30"
              >
                <option value="">All Status</option>
                <option value="eligible">Eligible</option>
                <option value="not_eligible">Not Eligible</option>
                <option value="pending">Pending</option>
                <option value="error">Error</option>
              </select>
            </div>
            <Button onClick={handleSearch} className="bg-primary-purple">
              <Search className="h-4 w-4 mr-2" />
              Search
            </Button>
            <Button variant="outline" onClick={handleClearFilters}>
              Clear
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Data Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Eligibility Records</CardTitle>
            <Button variant="outline" size="sm" onClick={loadEligibilityRecords} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <DataTable
            data={eligibilityRecords}
            columns={columns}
            searchable={false}
            sortable={true}
            pageSize={pagination.limit}
            onRowClick={(row) => navigate(`/nphies-eligibility/${row.eligibility_id || row.id}`)}
          />
          
          {/* Pagination */}
          {pagination.pages > 1 && (
            <div className="flex items-center justify-between mt-4 pt-4 border-t">
              <div className="text-sm text-gray-500">
                Showing {((pagination.page - 1) * pagination.limit) + 1} to {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} results
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pagination.page === 1}
                  onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                >
                  Previous
                </Button>
                <span className="flex items-center px-3 text-sm">
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
