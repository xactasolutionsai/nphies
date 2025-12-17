import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import DataTable from '@/components/DataTable';
import api, { extractErrorMessage } from '@/services/api';
import { 
  FileText, Plus, Edit, Trash2, Eye, Send, RefreshCw, 
  XCircle, ArrowRightLeft, Clock, CheckCircle, AlertCircle,
  Filter, Search, Copy
} from 'lucide-react';

// Auth type display helper
const getAuthTypeDisplay = (authType) => {
  const types = {
    institutional: 'Institutional',
    professional: 'Professional',
    pharmacy: 'Pharmacy',
    dental: 'Dental',
    vision: 'Vision'
  };
  return types[authType] || authType;
};

// Format amount helper
const formatAmount = (amount, currency = 'SAR') => {
  if (amount == null) return '-';
  return `${parseFloat(amount).toFixed(2)} ${currency}`;
};

// Format date helper
const formatDate = (dateString) => {
  if (!dateString) return '-';
  return new Date(dateString).toLocaleDateString();
};

export default function PriorAuthorizations() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [authorizations, setAuthorizations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    pages: 0
  });
  const [filters, setFilters] = useState({
    search: searchParams.get('search') || '',
    status: searchParams.get('status') || '',
    auth_type: searchParams.get('auth_type') || ''
  });

  useEffect(() => {
    loadAuthorizations();
  }, [pagination.page, filters.status, filters.auth_type]);

  const loadAuthorizations = async () => {
    try {
      setLoading(true);
      const params = {
        page: pagination.page,
        limit: pagination.limit,
        ...(filters.search && { search: filters.search }),
        ...(filters.status && { status: filters.status }),
        ...(filters.auth_type && { auth_type: filters.auth_type })
      };
      const response = await api.getPriorAuthorizations(params);
      const data = response?.data || [];
      setAuthorizations(Array.isArray(data) ? data : []);
      if (response?.pagination) {
        setPagination(prev => ({
          ...prev,
          total: response.pagination.total,
          pages: response.pagination.pages
        }));
      }
    } catch (error) {
      console.error('Error loading prior authorizations:', error);
      setAuthorizations([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    setPagination(prev => ({ ...prev, page: 1 }));
    loadAuthorizations();
    // Update URL params
    const params = new URLSearchParams();
    if (filters.search) params.set('search', filters.search);
    if (filters.status) params.set('status', filters.status);
    if (filters.auth_type) params.set('auth_type', filters.auth_type);
    setSearchParams(params);
  };

  const handleClearFilters = () => {
    setFilters({ search: '', status: '', auth_type: '' });
    setSearchParams({});
    setPagination(prev => ({ ...prev, page: 1 }));
    loadAuthorizations();
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this prior authorization?')) {
      try {
        setLoading(true);
        await api.deletePriorAuthorization(id);
        setAuthorizations(prev => prev.filter(auth => auth.id !== id));
        await loadAuthorizations();
      } catch (error) {
        console.error('Error deleting prior authorization:', error);
        alert(`Error: ${extractErrorMessage(error)}`);
        await loadAuthorizations();
      } finally {
        setLoading(false);
      }
    }
  };

  const handleSendToNphies = async (id) => {
    if (window.confirm('Send this prior authorization to NPHIES?')) {
      try {
        setLoading(true);
        const response = await api.sendPriorAuthorizationToNphies(id);
        if (response.success) {
          alert(`Successfully sent to NPHIES!\nPre-Auth Ref: ${response.nphiesResponse?.preAuthRef || 'Pending'}`);
        } else {
          alert(`NPHIES Error: ${response.error?.message || 'Unknown error'}`);
        }
        await loadAuthorizations();
      } catch (error) {
        console.error('Error sending to NPHIES:', error);
        alert(`Error: ${extractErrorMessage(error)}`);
        await loadAuthorizations();
      } finally {
        setLoading(false);
      }
    }
  };

  const handlePoll = async (id) => {
    try {
      setLoading(true);
      const response = await api.pollNphiesAuthorizationResponse(id);
      await loadAuthorizations();
      alert(response.message || 'Polling complete');
    } catch (error) {
      console.error('Error polling:', error);
      alert(`Error: ${extractErrorMessage(error)}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDuplicate = async (id) => {
    if (window.confirm('Create a duplicate of this prior authorization as a new draft?')) {
      try {
        setLoading(true);
        const response = await api.duplicatePriorAuthorization(id);
        const newId = response.data?.id || response.id;
        alert('Prior authorization duplicated successfully!');
        // Navigate to edit the new duplicate
        navigate(`/prior-authorizations/${newId}/edit`);
      } catch (error) {
        console.error('Error duplicating prior authorization:', error);
        alert(`Error: ${extractErrorMessage(error)}`);
      } finally {
        setLoading(false);
      }
    }
  };

  const getStatusBadge = (status) => {
    const configs = {
      draft: { variant: 'outline', icon: FileText, className: 'text-gray-600' },
      pending: { variant: 'default', icon: Clock, className: 'bg-blue-500' },
      queued: { variant: 'secondary', icon: Clock, className: 'bg-yellow-500 text-black' },
      approved: { variant: 'default', icon: CheckCircle, className: 'bg-green-500' },
      partial: { variant: 'default', icon: AlertCircle, className: 'bg-orange-500' },
      denied: { variant: 'destructive', icon: XCircle, className: '' },
      cancelled: { variant: 'outline', icon: XCircle, className: 'text-gray-500' },
      error: { variant: 'destructive', icon: AlertCircle, className: '' }
    };
    const config = configs[status] || configs.draft;
    const Icon = config.icon;
    
    return (
      <Badge variant={config.variant} className={`gap-1 ${config.className}`}>
        <Icon className="h-3 w-3" />
        {status?.charAt(0).toUpperCase() + status?.slice(1)}
      </Badge>
    );
  };

  const getAuthTypeBadge = (authType) => {
    const colors = {
      institutional: 'bg-purple-100 text-purple-800',
      professional: 'bg-blue-100 text-blue-800',
      pharmacy: 'bg-green-100 text-green-800',
      dental: 'bg-orange-100 text-orange-800',
      vision: 'bg-pink-100 text-pink-800'
    };
    return (
      <Badge variant="outline" className={colors[authType] || ''}>
        {getAuthTypeDisplay(authType)}
      </Badge>
    );
  };

  const columns = [
    {
      key: 'request_number',
      header: 'Request #',
      accessor: 'request_number',
      render: (row) => (
        <span className="font-mono text-sm">{row.request_number || '-'}</span>
      )
    },
    {
      key: 'auth_type',
      header: 'Type',
      accessor: 'auth_type',
      render: (row) => getAuthTypeBadge(row.auth_type)
    },
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
      key: 'pre_auth_ref',
      header: 'Pre-Auth Ref',
      accessor: 'pre_auth_ref',
      render: (row) => (
        <span className="font-mono text-sm text-green-600">
          {row.pre_auth_ref || '-'}
        </span>
      )
    },
    {
      key: 'total_amount',
      header: 'Amount',
      accessor: 'total_amount',
      render: (row) => formatAmount(row.total_amount, row.currency)
    },
    {
      key: 'created_at',
      header: 'Created',
      accessor: 'created_at',
      render: (row) => formatDate(row.created_at)
    },
    {
      key: 'actions',
      header: 'Actions',
      accessor: 'id',
      render: (row) => (
        <div className="flex gap-1 flex-wrap">
          <Button
            size="sm"
            variant="outline"
            title="View Details"
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/prior-authorizations/${row.id}`);
            }}
          >
            <Eye className="h-4 w-4" />
          </Button>
          {/* Duplicate button - available for all records */}
          <Button
            size="sm"
            variant="outline"
            title="Duplicate as new draft"
            className="text-purple-600 hover:text-purple-700 hover:bg-purple-50"
            onClick={(e) => {
              e.stopPropagation();
              handleDuplicate(row.id);
            }}
          >
            <Copy className="h-4 w-4" />
          </Button>
          {(row.status === 'draft' || row.status === 'error') && (
            <>
              <Button
                size="sm"
                variant="outline"
                title="Edit"
                onClick={(e) => {
                  e.stopPropagation();
                  navigate(`/prior-authorizations/${row.id}/edit`);
                }}
              >
                <Edit className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                variant="default"
                className="bg-blue-500 hover:bg-blue-600"
                title="Send to NPHIES"
                onClick={(e) => {
                  e.stopPropagation();
                  handleSendToNphies(row.id);
                }}
              >
                <Send className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                variant="destructive"
                title="Delete"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDelete(row.id);
                }}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </>
          )}
          {row.status === 'queued' && (
            <Button
              size="sm"
              variant="outline"
              title="Poll for Response"
              onClick={(e) => {
                e.stopPropagation();
                handlePoll(row.id);
              }}
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          )}
        </div>
      )
    }
  ];

  // Stats calculations
  const stats = {
    total: pagination.total,
    draft: authorizations.filter(a => a.status === 'draft').length,
    pending: authorizations.filter(a => a.status === 'pending').length,
    approved: authorizations.filter(a => a.status === 'approved').length,
    denied: authorizations.filter(a => a.status === 'denied').length
  };

  if (loading && authorizations.length === 0) {
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
                Prior Authorizations
              </h1>
              <p className="text-gray-600 mt-2 text-lg">
                NPHIES-compliant Prior Authorization Management
              </p>
              <div className="flex items-center space-x-4 mt-4">
                <div className="flex items-center space-x-2 text-sm text-gray-500">
                  <div className="w-2 h-2 bg-accent-cyan rounded-full animate-pulse"></div>
                  <span>Connected to NPHIES</span>
                </div>
                <div className="text-sm text-gray-500">
                  Total: {stats.total} | Draft: {stats.draft} | Approved: {stats.approved}
                </div>
              </div>
            </div>
            <Button 
              onClick={() => navigate('/prior-authorizations/new')} 
              className="bg-gradient-to-r from-primary-purple to-accent-purple"
            >
              <Plus className="h-5 w-5 mr-2" />
              New Prior Authorization
            </Button>
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
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
        <Card className="bg-gradient-to-br from-green-50 to-white">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-green-600">Approved</p>
                <p className="text-2xl font-bold text-green-700">{stats.approved}</p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-400" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-red-50 to-white">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-red-600">Denied</p>
                <p className="text-2xl font-bold text-red-700">{stats.denied}</p>
              </div>
              <XCircle className="h-8 w-8 text-red-400" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-yellow-50 to-white">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-yellow-600">Draft</p>
                <p className="text-2xl font-bold text-yellow-700">{stats.draft}</p>
              </div>
              <FileText className="h-8 w-8 text-yellow-400" />
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
                  placeholder="Search by request #, patient, provider..."
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
                <option value="draft">Draft</option>
                <option value="pending">Pending</option>
                <option value="queued">Queued</option>
                <option value="approved">Approved</option>
                <option value="partial">Partial</option>
                <option value="denied">Denied</option>
                <option value="cancelled">Cancelled</option>
                <option value="error">Error</option>
              </select>
            </div>
            <div className="w-40">
              <label className="text-sm font-medium mb-1 block">Type</label>
              <select
                value={filters.auth_type}
                onChange={(e) => setFilters(prev => ({ ...prev, auth_type: e.target.value }))}
                className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-purple/30"
              >
                <option value="">All Types</option>
                <option value="institutional">Institutional</option>
                <option value="professional">Professional</option>
                <option value="pharmacy">Pharmacy</option>
                <option value="dental">Dental</option>
                <option value="vision">Vision</option>
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
            <CardTitle>Prior Authorization Requests</CardTitle>
            <Button variant="outline" size="sm" onClick={loadAuthorizations} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <DataTable
            data={authorizations}
            columns={columns}
            searchable={false}
            sortable={true}
            pageSize={pagination.limit}
            onRowClick={(row) => navigate(`/prior-authorizations/${row.id}`)}
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
