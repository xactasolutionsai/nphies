import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import api, { extractErrorMessage } from '@/services/api';
import {
  RefreshCw, Eye, Trash2, Download, Search, Filter,
  ShieldCheck, ShieldAlert, ShieldX, Clock, CheckCircle,
  AlertCircle, XCircle, FileJson
} from 'lucide-react';

// Auth reason display helper
const getAuthReasonDisplay = (reason) => {
  const reasons = {
    'referral': 'Referral',
    'medication-dispense': 'Medication Dispense',
    'new-born': 'New Born',
    'transfer': 'Transfer',
  };
  return reasons[reason] || reason || '-';
};

// Claim type display helper
const getClaimTypeDisplay = (type) => {
  const types = {
    'institutional': 'Institutional',
    'oral': 'Oral/Dental',
    'pharmacy': 'Pharmacy',
    'professional': 'Professional',
    'vision': 'Vision',
  };
  return types[type] || type || '-';
};

// Outcome badge helper
const getOutcomeBadge = (outcome, adjudicationOutcome) => {
  const display = adjudicationOutcome || outcome || 'unknown';
  const colorMap = {
    'approved': 'bg-green-100 text-green-800',
    'complete': 'bg-green-100 text-green-800',
    'partial': 'bg-yellow-100 text-yellow-800',
    'denied': 'bg-red-100 text-red-800',
    'refused': 'bg-red-100 text-red-800',
    'queued': 'bg-blue-100 text-blue-800',
    'error': 'bg-red-100 text-red-800',
  };
  const className = colorMap[display] || 'bg-gray-100 text-gray-800';
  return <Badge className={className}>{display}</Badge>;
};

// Format date helper
const formatDate = (dateString) => {
  if (!dateString) return '-';
  return new Date(dateString).toLocaleDateString();
};

const formatDateTime = (dateString) => {
  if (!dateString) return '-';
  return new Date(dateString).toLocaleString();
};

export default function AdvancedAuthorizations() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [authorizations, setAuthorizations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0
  });
  const [stats, setStats] = useState({
    total: 0, approved: 0, partial: 0, denied: 0, pending: 0
  });
  const [filters, setFilters] = useState({
    search: searchParams.get('search') || '',
    auth_reason: searchParams.get('auth_reason') || '',
    claim_type: searchParams.get('claim_type') || '',
    adjudication_outcome: searchParams.get('adjudication_outcome') || ''
  });
  const [searchQuery, setSearchQuery] = useState(searchParams.get('search') || '');

  useEffect(() => {
    loadData();
  }, [pagination.page, filters.auth_reason, filters.claim_type, filters.adjudication_outcome, searchQuery]);

  const loadData = async () => {
    try {
      setLoading(true);
      const params = {
        page: pagination.page,
        limit: pagination.limit,
        ...(searchQuery && { search: searchQuery }),
        ...(filters.auth_reason && { auth_reason: filters.auth_reason }),
        ...(filters.claim_type && { claim_type: filters.claim_type }),
        ...(filters.adjudication_outcome && { adjudication_outcome: filters.adjudication_outcome })
      };
      const response = await api.getAdvancedAuthorizations(params);
      setAuthorizations(response?.data || []);
      if (response?.pagination) {
        setPagination(prev => ({
          ...prev,
          total: response.pagination.total,
          totalPages: response.pagination.totalPages
        }));
      }
      if (response?.stats) {
        setStats(response.stats);
      }
    } catch (error) {
      console.error('Error loading advanced authorizations:', error);
      setAuthorizations([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    setSearchQuery(filters.search);
    setPagination(prev => ({ ...prev, page: 1 }));
    const params = new URLSearchParams();
    if (filters.search) params.set('search', filters.search);
    if (filters.auth_reason) params.set('auth_reason', filters.auth_reason);
    if (filters.claim_type) params.set('claim_type', filters.claim_type);
    if (filters.adjudication_outcome) params.set('adjudication_outcome', filters.adjudication_outcome);
    setSearchParams(params);
  };

  const handleClearFilters = () => {
    setFilters({ search: '', auth_reason: '', claim_type: '', adjudication_outcome: '' });
    setSearchQuery('');
    setSearchParams({});
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this advanced authorization?')) {
      try {
        setLoading(true);
        await api.deleteAdvancedAuthorization(id);
        await loadData();
      } catch (error) {
        console.error('Error deleting:', error);
        alert(`Error: ${extractErrorMessage(error)}`);
      } finally {
        setLoading(false);
      }
    }
  };

  const handleDownload = async (id) => {
    try {
      const response = await api.downloadAdvancedAuthorizationJson(id);
      const blob = new Blob([JSON.stringify(response, null, 2)], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `advanced-auth-${id}.json`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Error downloading:', error);
      alert(`Error: ${extractErrorMessage(error)}`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Advanced Authorizations</h1>
          <p className="text-sm text-gray-500 mt-1">
            Payer-initiated Advanced Prior Authorization responses received via polling
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => navigate('/system-poll')}
          className="flex items-center gap-2"
        >
          <RefreshCw className="h-4 w-4" />
          System Poll
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="text-sm font-medium text-gray-500">Total</div>
            <div className="text-2xl font-bold">{stats.total || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="text-sm font-medium text-green-600 flex items-center gap-1">
              <CheckCircle className="h-3 w-3" /> Approved
            </div>
            <div className="text-2xl font-bold text-green-700">{stats.approved || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="text-sm font-medium text-yellow-600 flex items-center gap-1">
              <AlertCircle className="h-3 w-3" /> Partial
            </div>
            <div className="text-2xl font-bold text-yellow-700">{stats.partial || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="text-sm font-medium text-red-600 flex items-center gap-1">
              <XCircle className="h-3 w-3" /> Denied
            </div>
            <div className="text-2xl font-bold text-red-700">{stats.denied || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="text-sm font-medium text-blue-600 flex items-center gap-1">
              <Clock className="h-3 w-3" /> Pending
            </div>
            <div className="text-2xl font-bold text-blue-700">{stats.pending || 0}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="py-4">
          <div className="flex flex-wrap gap-3 items-end">
            <div className="flex-1 min-w-[200px]">
              <label className="text-xs font-medium text-gray-500 mb-1 block">Search</label>
              <div className="flex gap-2">
                <Input
                  placeholder="Search by identifier, preAuthRef..."
                  value={filters.search}
                  onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  className="h-9"
                />
                <Button variant="outline" size="sm" onClick={handleSearch} className="h-9">
                  <Search className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="min-w-[140px]">
              <label className="text-xs font-medium text-gray-500 mb-1 block">Auth Reason</label>
              <select
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                value={filters.auth_reason}
                onChange={(e) => {
                  setFilters(prev => ({ ...prev, auth_reason: e.target.value }));
                  setPagination(prev => ({ ...prev, page: 1 }));
                }}
              >
                <option value="">All Reasons</option>
                <option value="referral">Referral</option>
                <option value="medication-dispense">Medication Dispense</option>
                <option value="new-born">New Born</option>
                <option value="transfer">Transfer</option>
              </select>
            </div>

            <div className="min-w-[140px]">
              <label className="text-xs font-medium text-gray-500 mb-1 block">Claim Type</label>
              <select
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                value={filters.claim_type}
                onChange={(e) => {
                  setFilters(prev => ({ ...prev, claim_type: e.target.value }));
                  setPagination(prev => ({ ...prev, page: 1 }));
                }}
              >
                <option value="">All Types</option>
                <option value="institutional">Institutional</option>
                <option value="oral">Oral/Dental</option>
                <option value="pharmacy">Pharmacy</option>
                <option value="professional">Professional</option>
                <option value="vision">Vision</option>
              </select>
            </div>

            <div className="min-w-[140px]">
              <label className="text-xs font-medium text-gray-500 mb-1 block">Outcome</label>
              <select
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                value={filters.adjudication_outcome}
                onChange={(e) => {
                  setFilters(prev => ({ ...prev, adjudication_outcome: e.target.value }));
                  setPagination(prev => ({ ...prev, page: 1 }));
                }}
              >
                <option value="">All Outcomes</option>
                <option value="approved">Approved</option>
                <option value="partial">Partial</option>
                <option value="denied">Denied</option>
              </select>
            </div>

            <Button variant="ghost" size="sm" onClick={handleClearFilters} className="h-9">
              <Filter className="h-4 w-4 mr-1" /> Clear
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Data Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="h-6 w-6 animate-spin text-gray-400" />
              <span className="ml-2 text-gray-500">Loading...</span>
            </div>
          ) : authorizations.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-gray-500">
              <ShieldAlert className="h-12 w-12 mb-3 text-gray-300" />
              <p className="text-lg font-medium">No Advanced Authorizations Found</p>
              <p className="text-sm mt-1">Click "Poll for New" to check for incoming authorizations from payers.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50">
                    <th className="px-4 py-3 text-left font-medium text-gray-500">ID</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-500">Auth Reason</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-500">Type</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-500">Patient</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-500">Outcome</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-500">PreAuth Ref</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-500">Created</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-500">Received</th>
                    <th className="px-4 py-3 text-right font-medium text-gray-500">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {authorizations.map((auth) => (
                    <tr key={auth.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <span className="font-mono text-xs text-gray-600">
                          {auth.identifier_value
                            ? (auth.identifier_value.length > 20
                              ? `...${auth.identifier_value.slice(-16)}`
                              : auth.identifier_value)
                            : `#${auth.id}`}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className="font-medium">
                          {getAuthReasonDisplay(auth.auth_reason)}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-xs">
                          <div>{getClaimTypeDisplay(auth.claim_type)}</div>
                          <div className="text-gray-400">{auth.claim_subtype?.toUpperCase()}</div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-600">
                        {auth.patient_reference
                          ? auth.patient_reference.replace(/^.*\//, '')
                          : '-'}
                      </td>
                      <td className="px-4 py-3">
                        {getOutcomeBadge(auth.outcome, auth.adjudication_outcome)}
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-mono text-xs">
                          {auth.pre_auth_ref || '-'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500">
                        {formatDate(auth.created_date)}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500">
                        {formatDateTime(auth.received_at)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => navigate(`/advanced-authorizations/${auth.id}`)}
                            title="View Details"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDownload(auth.id)}
                            title="Download JSON"
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(auth.id)}
                            title="Delete"
                            className="text-red-500 hover:text-red-700"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t">
              <div className="text-sm text-gray-500">
                Showing {((pagination.page - 1) * pagination.limit) + 1} to{' '}
                {Math.min(pagination.page * pagination.limit, pagination.total)} of{' '}
                {pagination.total} results
              </div>
              <div className="flex gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pagination.page <= 1}
                  onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pagination.page >= pagination.totalPages}
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
