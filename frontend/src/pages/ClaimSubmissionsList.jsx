import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import DataTable from '@/components/DataTable';
import api, { extractErrorMessage, clearApiCache } from '@/services/api';
import { 
  FileText, Trash2, Eye, Send, RefreshCw,
  XCircle, Clock, CheckCircle, AlertCircle,
  Filter, Search, Receipt, DollarSign
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

// Claim type display helper
const getClaimTypeDisplay = (claimType) => {
  const types = {
    institutional: 'Institutional',
    professional: 'Professional',
    pharmacy: 'Pharmacy',
    dental: 'Dental',
    vision: 'Vision'
  };
  return types[claimType] || claimType;
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

export default function ClaimSubmissionsList() {
  const { can } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [claims, setClaims] = useState([]);
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
    claim_type: searchParams.get('claim_type') || ''
  });
  const [searchVersion, setSearchVersion] = useState(0);

  const loadClaims = async ({ fresh = false } = {}) => {
    try {
      setLoading(true);
      // Bypass the 30s GET cache when the user explicitly refreshes / after a mutation
      if (fresh) clearApiCache();
      const params = {
        page: pagination.page,
        limit: pagination.limit,
        ...(filters.search && { search: filters.search }),
        ...(filters.status && { status: filters.status }),
        ...(filters.claim_type && { claim_type: filters.claim_type })
      };
      const response = await api.getClaimSubmissions(params);
      const data = response?.data || [];
      setClaims(Array.isArray(data) ? data : []);
      if (response?.pagination) {
        setPagination(prev => ({
          ...prev,
          total: response.pagination.total,
          pages: response.pagination.pages
        }));
      }
    } catch (error) {
      console.error('Error loading claim submissions:', error);
      setClaims([]);
    } finally {
      setLoading(false);
    }
  };

  // Search text is applied only on explicit search (searchVersion), not on every keystroke
  useEffect(() => {
    loadClaims();
  }, [pagination.page, pagination.limit, filters.status, filters.claim_type, searchVersion]);

  const handleSearch = () => {
    setPagination(prev => ({ ...prev, page: 1 }));
    setSearchVersion(v => v + 1);
    const params = new URLSearchParams();
    if (filters.search) params.set('search', filters.search);
    if (filters.status) params.set('status', filters.status);
    if (filters.claim_type) params.set('claim_type', filters.claim_type);
    setSearchParams(params);
  };

  const handleClearFilters = () => {
    setFilters({ search: '', status: '', claim_type: '' });
    setSearchParams({});
    setPagination(prev => ({ ...prev, page: 1 }));
    setSearchVersion(v => v + 1);
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this claim submission?')) {
      try {
        setLoading(true);
        await api.deleteClaimSubmission(id);
        setClaims(prev => prev.filter(claim => claim.id !== id));
        await loadClaims({ fresh: true });
      } catch (error) {
        console.error('Error deleting claim submission:', error);
        const errorMsg = error.response?.data?.error || 'Error deleting claim submission. Please try again.';
        alert(errorMsg);
        await loadClaims({ fresh: true });
      } finally {
        setLoading(false);
      }
    }
  };

  const handleSendToNphies = async (id) => {
    if (window.confirm('Send this claim to NPHIES?')) {
      try {
        setLoading(true);
        const response = await api.sendClaimSubmissionToNphies(id);
        if (response.success) {
          alert(`Successfully sent to NPHIES!\nClaim Ref: ${response.nphiesResponse?.claimRef || 'Pending'}`);
        } else {
          alert(`NPHIES Error: ${response.error?.message || 'Unknown error'}`);
        }
        await loadClaims({ fresh: true });
      } catch (error) {
        console.error('Error sending to NPHIES:', error);
        alert(`Error: ${extractErrorMessage(error)}`);
        await loadClaims({ fresh: true });
      } finally {
        setLoading(false);
      }
    }
  };

  // Poll NPHIES for queued claim responses, then reload the list
  const handlePoll = async (id) => {
    try {
      setLoading(true);
      const response = await api.pollClaimMessages(id);
      if (response?.success === false) {
        alert(`Poll failed: ${response.error?.message || response.error || response.message || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error polling claim:', error);
      alert(`Error: ${extractErrorMessage(error)}`);
    } finally {
      await loadClaims({ fresh: true });
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
      paid: { variant: 'default', icon: DollarSign, className: 'bg-emerald-600' },
      cancelled: { variant: 'outline', icon: XCircle, className: 'text-gray-500' },
      error: { variant: 'destructive', icon: AlertCircle, className: '' }
    };
    const config = configs[status] || configs.draft;
    const Icon = config.icon;
    
    return (
      <Badge variant={config.variant} className={`gap-1 ${config.className}`}>
        <Icon className="h-3 w-3" />
        {status ? status.charAt(0).toUpperCase() + status.slice(1) : 'Draft'}
      </Badge>
    );
  };

  const getClaimTypeBadge = (claimType) => {
    const colors = {
      institutional: 'bg-purple-100 text-purple-800',
      professional: 'bg-blue-100 text-blue-800',
      pharmacy: 'bg-green-100 text-green-800',
      dental: 'bg-orange-100 text-orange-800',
      vision: 'bg-pink-100 text-pink-800'
    };
    return (
      <Badge variant="outline" className={colors[claimType] || ''}>
        {getClaimTypeDisplay(claimType)}
      </Badge>
    );
  };

  const columns = [
    {
      key: 'claim_number',
      header: 'Claim #',
      accessor: 'claim_number',
      render: (row) => (
        <div>
          <span className="font-mono text-sm">{row.claim_number || '-'}</span>
          {row.pre_auth_ref && (
            <div className="text-xs text-gray-500">PA: {row.pre_auth_ref}</div>
          )}
          {row.bundle_id && (
            <div className="text-xs text-purple-500 font-mono truncate max-w-[180px]" title={row.bundle_id}>
              Bundle: {row.bundle_id}
            </div>
          )}
        </div>
      )
    },
    {
      key: 'claim_type',
      header: 'Type',
      accessor: 'claim_type',
      render: (row) => getClaimTypeBadge(row.claim_type)
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
      key: 'service_date',
      header: 'Service Date',
      accessor: 'service_date',
      render: (row) => formatDate(row.service_date)
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
              navigate(`/claim-submissions/${row.id}`);
            }}
          >
            <Eye className="h-4 w-4" />
          </Button>
          {(row.status === 'draft' || row.status === 'error') && (
            <>
              {can('send') && (
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
              )}
              {can('delete') && (
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
              )}
            </>
          )}
          {row.status === 'queued' && can('poll') && (
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

  // Stats calculations: only "total" is global; the per-status counts cover the current page
  const stats = {
    total: pagination.total,
    draft: claims.filter(a => a.status === 'draft').length,
    pending: claims.filter(a => a.status === 'pending').length,
    approved: claims.filter(a => a.status === 'approved').length,
    denied: claims.filter(a => a.status === 'denied').length
  };

  if (loading && claims.length === 0) {
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
                Claim Submissions
              </h1>
              <p className="text-gray-600 mt-2 text-lg">
                NPHIES Claims (use: "claim") - Billing for delivered services
              </p>
              <div className="flex items-center space-x-4 mt-4">
                <div className="flex items-center space-x-2 text-sm text-gray-500">
                  <div className="w-2 h-2 bg-accent-cyan rounded-full animate-pulse"></div>
                  <span>Connected to NPHIES</span>
                </div>
                <div className="text-sm text-gray-500">
                  Total: {stats.total} | On this page: Draft {stats.draft}, Approved {stats.approved}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 rounded-lg border border-blue-200">
              <FileText className="h-5 w-5 text-blue-600" />
              <span className="text-sm text-blue-700">
                Claims are created from approved Prior Authorizations
              </span>
            </div>
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
              <Receipt className="h-8 w-8 text-gray-400" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-blue-50 to-white">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-blue-600">Pending <span className="text-xs text-gray-400">(this page)</span></p>
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
                <p className="text-sm text-green-600">Approved <span className="text-xs text-gray-400">(this page)</span></p>
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
                <p className="text-sm text-red-600">Denied <span className="text-xs text-gray-400">(this page)</span></p>
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
                <p className="text-sm text-yellow-600">Draft <span className="text-xs text-gray-400">(this page)</span></p>
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
                  placeholder="Search by claim #, patient, provider, bundle ID..."
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
                onChange={(e) => {
                  setFilters(prev => ({ ...prev, status: e.target.value }));
                  setPagination(prev => ({ ...prev, page: 1 }));
                }}
                className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-purple/30"
              >
                <option value="">All Status</option>
                <option value="draft">Draft</option>
                <option value="pending">Pending</option>
                <option value="queued">Queued</option>
                <option value="approved">Approved</option>
                <option value="partial">Partial</option>
                <option value="denied">Denied</option>
                <option value="paid">Paid</option>
                <option value="cancelled">Cancelled</option>
                <option value="error">Error</option>
              </select>
            </div>
            <div className="w-40">
              <label className="text-sm font-medium mb-1 block">Type</label>
              <select
                value={filters.claim_type}
                onChange={(e) => {
                  setFilters(prev => ({ ...prev, claim_type: e.target.value }));
                  setPagination(prev => ({ ...prev, page: 1 }));
                }}
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
            <CardTitle>Claim Submission Requests</CardTitle>
            <Button variant="outline" size="sm" onClick={() => loadClaims({ fresh: true })} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <DataTable
            data={claims}
            columns={columns}
            searchable={false}
            sortable={true}
            pageSize={pagination.limit}
            onRowClick={(row) => navigate(`/claim-submissions/${row.id}`)}
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
