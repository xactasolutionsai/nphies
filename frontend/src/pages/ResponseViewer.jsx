import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Input } from '../components/ui/input';
import { 
  FileText, 
  Shield, 
  Users, 
  DollarSign, 
  Search, 
  Eye,
  ChevronLeft,
  ChevronRight,
  CheckCircle,
  Clock,
  AlertCircle,
  Activity,
  RefreshCw,
  User,
  Building2
} from 'lucide-react';
import responseViewerApi from '../services/responseViewerApi';

// Date-range presets -> lower bound (local time). Used client-side as a fallback while the
// legacy /response-viewer endpoints do not filter server-side.
const getDateLowerBound = (range) => {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  switch (range) {
    case 'today':
      return start;
    case 'week':
      start.setDate(start.getDate() - start.getDay());
      return start;
    case 'month':
      return new Date(now.getFullYear(), now.getMonth(), 1);
    case 'quarter':
      return new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
    default:
      return null;
  }
};

const getRecordId = (item) =>
  item.claim_id ?? item.auth_id ?? item.eligibility_id ?? item.payment_id ?? item.id;

const getRecordStatus = (item) =>
  item.status ?? item.auth_status ?? item.eligibility_status ?? item.payment_status;

const getRecordDate = (item) =>
  item.submission_date || item.request_date || item.requested_date || item.payment_date || item.created_at;

const TAB_LOADERS = {
  claims: (params) => responseViewerApi.getClaims(params),
  authorizations: (params) => responseViewerApi.getAuthorizations(params),
  eligibility: (params) => responseViewerApi.getEligibility(params),
  payments: (params) => responseViewerApi.getPayments(params)
};

const ResponseViewer = () => {
  const [activeTab, setActiveTab] = useState('claims');
  const [records, setRecords] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [showDetails, setShowDetails] = useState(false);
  
  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [pageSize] = useState(10);
  
  // Filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('all');
  const [sortBy, setSortBy] = useState('created_at');
  const [sortOrder, setSortOrder] = useState('DESC');

  // Debounced search
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  // Guards against out-of-order responses when filters change quickly
  const requestSeq = useRef(0);

  useEffect(() => {
    loadDashboardData();
  }, []);

  // Debounce search term
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Any filter / tab change starts again from page 1
  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, debouncedSearchTerm, statusFilter, dateFilter, sortBy, sortOrder]);

  const loadTabData = useCallback(async () => {
    const loader = TAB_LOADERS[activeTab];
    if (!loader) return;
    const seq = ++requestSeq.current;
    setLoading(true);
    try {
      const params = {
        page: currentPage,
        limit: pageSize,
        search: debouncedSearchTerm || undefined,
        status: statusFilter !== 'all' ? statusFilter : undefined,
        dateRange: dateFilter !== 'all' ? dateFilter : undefined,
        sortBy,
        sortOrder
      };
      const response = await loader(params);
      if (seq !== requestSeq.current) return;
      const rows = Array.isArray(response?.data) ? response.data : (Array.isArray(response) ? response : []);
      setRecords(rows);
      const total = response?.pagination?.total ?? rows.length;
      setTotalPages(Math.max(1, Math.ceil(total / pageSize)));
    } catch (error) {
      if (seq !== requestSeq.current) return;
      console.error(`Error loading ${activeTab}:`, error);
      setRecords([]);
      setTotalPages(1);
    } finally {
      if (seq === requestSeq.current) setLoading(false);
    }
  }, [activeTab, currentPage, pageSize, debouncedSearchTerm, statusFilter, dateFilter, sortBy, sortOrder]);

  useEffect(() => {
    loadTabData();
  }, [loadTabData]);

  const loadDashboardData = async () => {
    try {
      const response = await responseViewerApi.getDashboardStats();
      setStats(response.data || response);
    } catch (error) {
      console.error('Error loading dashboard stats:', error);
      // Fallback to empty stats if API fails
      setStats({
        counts: {
          claims: 0,
          authorizations: 0,
          patients: 0,
          payments: 0
        },
        claimsByStatus: []
      });
    }
  };

  // There are no per-record endpoints on /response-viewer, so details are shown from the
  // already-loaded row.
  const handleViewDetails = (record) => {
    setSelectedRecord({ ...record, id: getRecordId(record), status: getRecordStatus(record) });
    setShowDetails(true);
  };

  const handleTabChange = (tab) => {
    if (tab === activeTab) return;
    setRecords([]);
    setActiveTab(tab);
  };

  const handleRefresh = () => {
    loadDashboardData();
    loadTabData();
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      'Submitted': { variant: 'secondary', label: 'Submitted', icon: Clock },
      'Approved': { variant: 'default', label: 'Approved', icon: CheckCircle },
      'Denied': { variant: 'destructive', label: 'Denied', icon: AlertCircle },
      'Pending': { variant: 'outline', label: 'Pending', icon: Clock },
      'Adjudicated': { variant: 'default', label: 'Adjudicated', icon: CheckCircle },
      'Rejected': { variant: 'destructive', label: 'Rejected', icon: AlertCircle },
      'Eligible': { variant: 'default', label: 'Eligible', icon: CheckCircle },
      'Not Eligible': { variant: 'destructive', label: 'Not Eligible', icon: AlertCircle },
      'Under Review': { variant: 'outline', label: 'Under Review', icon: Activity },
      'Completed': { variant: 'default', label: 'Completed', icon: CheckCircle },
      'Failed': { variant: 'destructive', label: 'Failed', icon: AlertCircle },
      // Legacy lowercase support
      'submitted': { variant: 'secondary', label: 'Submitted', icon: Clock },
      'approved': { variant: 'default', label: 'Approved', icon: CheckCircle },
      'denied': { variant: 'destructive', label: 'Denied', icon: AlertCircle },
      'pending': { variant: 'outline', label: 'Pending', icon: Clock },
      'adjudicated': { variant: 'default', label: 'Adjudicated', icon: CheckCircle },
      'rejected': { variant: 'destructive', label: 'Rejected', icon: AlertCircle },
      'eligible': { variant: 'default', label: 'Eligible', icon: CheckCircle },
      'not_eligible': { variant: 'destructive', label: 'Not Eligible', icon: AlertCircle },
      'under_review': { variant: 'outline', label: 'Under Review', icon: Activity },
      'completed': { variant: 'default', label: 'Completed', icon: CheckCircle },
      'failed': { variant: 'destructive', label: 'Failed', icon: AlertCircle }
    };
    
    const config = statusConfig[status] || { variant: 'outline', label: status || '-', icon: Activity };
    const Icon = config.icon;
    return (
      <Badge variant={config.variant} className="flex items-center gap-1">
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return Number.isNaN(date.getTime()) ? '-' : date.toLocaleDateString();
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-SA', {
      style: 'currency',
      currency: 'SAR'
    }).format(Number(amount) || 0);
  };

  // Client-side filtering of the loaded page (the legacy endpoints may ignore the filter params).
  const getCurrentData = () => {
    let data = records;
    const term = searchTerm.trim().toLowerCase();
    if (term) {
      data = data.filter(item =>
        String(item.patient_name ?? '').toLowerCase().includes(term) ||
        String(item.provider_name ?? '').toLowerCase().includes(term) ||
        String(item.claim_number ?? item.payment_ref ?? '').toLowerCase().includes(term) ||
        String(getRecordId(item) ?? '').toLowerCase().includes(term)
      );
    }
    if (statusFilter !== 'all') {
      data = data.filter(item => getRecordStatus(item) === statusFilter);
    }
    const lowerBound = getDateLowerBound(dateFilter);
    if (lowerBound) {
      data = data.filter(item => {
        const d = new Date(getRecordDate(item));
        return !Number.isNaN(d.getTime()) && d >= lowerBound;
      });
    }
    return data;
  };

  const currentData = getCurrentData();

  return (
    <div className="p-6">
      <div className="mb-8">
        <div className="flex justify-between items-center">
          <div className="flex items-center space-x-4">
            <img 
              src="/logo.svg" 
              alt="Xacta Solutions" 
              className="h-14 w-auto object-contain"
            />
            <div>
              <h1 className="text-3xl font-bold text-gray-900">NPHIES Response Viewer</h1>
              <p className="text-gray-600">View and analyze submitted requests and their responses</p>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Claims</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.counts?.claims || 0}</div>
            <p className="text-xs text-muted-foreground">
              {stats.claimsByStatus?.find(s => s.status === 'Approved')?.count || 0} approved
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Authorizations</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.counts?.authorizations || 0}</div>
            <p className="text-xs text-muted-foreground">
              {stats.claimsByStatus?.find(s => s.status === 'Pending')?.count || 0} pending
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Patients</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.counts?.patients || 0}</div>
            <p className="text-xs text-muted-foreground">
              {stats.counts?.providers || 0} providers
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Payments</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.counts?.payments || 0}</div>
            <p className="text-xs text-muted-foreground">
              {stats.paymentsByInsurer?.length || 0} insurers
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <div className="mb-6">
        <div className="flex justify-between items-center mb-4">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8">
              <button
                onClick={() => handleTabChange('claims')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'claims'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <FileText className="h-4 w-4 inline mr-2" />
                Claims
              </button>
              <button
                onClick={() => handleTabChange('authorizations')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'authorizations'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Shield className="h-4 w-4 inline mr-2" />
                Authorizations
              </button>
              <button
                onClick={() => handleTabChange('eligibility')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'eligibility'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <CheckCircle className="h-4 w-4 inline mr-2" />
                Eligibility
              </button>
              <button
                onClick={() => handleTabChange('payments')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'payments'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <DollarSign className="h-4 w-4 inline mr-2" />
                Payments
              </button>
            </nav>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleRefresh}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="Search..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <select 
            value={statusFilter} 
            onChange={(e) => setStatusFilter(e.target.value)}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <option value="all">All Status</option>
            <option value="Pending">Pending</option>
            <option value="Approved">Approved</option>
            <option value="Rejected">Rejected</option>
            <option value="Under Review">Under Review</option>
            <option value="Eligible">Eligible</option>
            <option value="Not Eligible">Not Eligible</option>
            <option value="Completed">Completed</option>
          </select>
          <select 
            value={dateFilter} 
            onChange={(e) => setDateFilter(e.target.value)}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <option value="all">All Dates</option>
            <option value="today">Today</option>
            <option value="week">This Week</option>
            <option value="month">This Month</option>
            <option value="quarter">This Quarter</option>
          </select>
          <div className="flex gap-2">
            <select 
              value={sortBy} 
              onChange={(e) => setSortBy(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <option value="created_at">Sort by Date</option>
              <option value="status">Sort by Status</option>
              <option value="amount">Sort by Amount</option>
              <option value="patient_name">Sort by Patient</option>
            </select>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setSortOrder(sortOrder === 'ASC' ? 'DESC' : 'ASC')}
            >
              {sortOrder === 'ASC' ? '↑' : '↓'}
            </Button>
          </div>
        </div>
      </div>

      {/* Data Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center">Loading...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  {activeTab === 'claims' ? (
                    <>
                      <TableHead>Claim Number</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Patient</TableHead>
                      <TableHead>Provider</TableHead>
                      <TableHead>Submission Date</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Actions</TableHead>
                    </>
                  ) : activeTab === 'authorizations' ? (
                    <>
                      <TableHead>Auth ID</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Patient</TableHead>
                      <TableHead>Provider</TableHead>
                      <TableHead>Request Date</TableHead>
                      <TableHead>Urgency</TableHead>
                      <TableHead>Actions</TableHead>
                    </>
                  ) : activeTab === 'eligibility' ? (
                    <>
                      <TableHead>ID</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Patient</TableHead>
                      <TableHead>Provider</TableHead>
                      <TableHead>Purpose</TableHead>
                      <TableHead>Request Date</TableHead>
                      <TableHead>Actions</TableHead>
                    </>
                  ) : activeTab === 'payments' ? (
                    <>
                      <TableHead>Payment ID</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Patient</TableHead>
                      <TableHead>Provider</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Payment Date</TableHead>
                      <TableHead>Actions</TableHead>
                    </>
                  ) : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {activeTab === 'claims' ? (
                  currentData.map((claim) => (
                    <TableRow key={claim.claim_id || claim.id}>
                      <TableCell className="font-medium">{claim.claim_number || claim.claim_id || claim.id}</TableCell>
                      <TableCell>{getStatusBadge(claim.status)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-gray-400" />
                          <div>
                            <div className="font-medium">{claim.patient_name || `Patient ${claim.patient_id}`}</div>
                            <div className="text-sm text-gray-500">{claim.patient_identifier || claim.national_id}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-gray-400" />
                          <div>
                            <div className="font-medium">{claim.provider_name || `Provider ${claim.provider_id}`}</div>
                            <div className="text-sm text-gray-500">{claim.provider_type || 'Healthcare Provider'}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{formatDate(claim.submission_date || claim.created_at)}</TableCell>
                      <TableCell className="font-medium">{formatCurrency(claim.amount || claim.total_amount || 0)}</TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleViewDetails(claim)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                ) : activeTab === 'authorizations' ? (
                  currentData.map((auth) => (
                    <TableRow key={auth.auth_id || auth.id}>
                      <TableCell className="font-medium">{auth.auth_id || auth.id}</TableCell>
                      <TableCell>{getStatusBadge(auth.auth_status || auth.status)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-gray-400" />
                          <div>
                            <div className="font-medium">{auth.patient_name || `Patient ${auth.patient_id}`}</div>
                            <div className="text-sm text-gray-500">{auth.patient_identifier || auth.national_id}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-gray-400" />
                          <div>
                            <div className="font-medium">{auth.provider_name || `Provider ${auth.provider_id}`}</div>
                            <div className="text-sm text-gray-500">{auth.provider_type || 'Healthcare Provider'}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{formatDate(auth.request_date || auth.requested_date || auth.created_at)}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{auth.urgency || 'routine'}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleViewDetails(auth)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : activeTab === 'eligibility' ? (
                  currentData.map((record) => (
                    <TableRow key={record.eligibility_id || record.id}>
                      <TableCell className="font-medium">{record.eligibility_id || record.id}</TableCell>
                      <TableCell>{getStatusBadge(record.eligibility_status || record.status)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-gray-400" />
                          <div>
                            <div className="font-medium">{record.patient_name || `Patient ${record.patient_id}`}</div>
                            <div className="text-sm text-gray-500">{record.patient_identifier || record.national_id}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-gray-400" />
                          <div>
                            <div className="font-medium">{record.provider_name || `Provider ${record.provider_id}`}</div>
                            <div className="text-sm text-gray-500">{record.provider_type || 'Healthcare Provider'}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{record.purpose || record.service_type}</TableCell>
                      <TableCell>{formatDate(record.request_date || record.created_at)}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleViewDetails(record)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : activeTab === 'payments' ? (
                  currentData.map((payment) => (
                    <TableRow key={payment.payment_id || payment.id}>
                      <TableCell className="font-medium">{payment.payment_ref || payment.payment_id || payment.id}</TableCell>
                      <TableCell>{getStatusBadge(payment.payment_status || payment.status)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-gray-400" />
                          <div>
                            <div className="font-medium">{payment.patient_name || `Patient ${payment.patient_id}`}</div>
                            <div className="text-sm text-gray-500">{payment.patient_identifier || payment.national_id}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-gray-400" />
                          <div>
                            <div className="font-medium">{payment.provider_name || `Provider ${payment.provider_id}`}</div>
                            <div className="text-sm text-gray-500">{payment.provider_type || 'Healthcare Provider'}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">{formatCurrency(payment.amount || payment.total_amount || 0)}</TableCell>
                      <TableCell>{formatDate(payment.payment_date || payment.created_at)}</TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleViewDetails(payment)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                ) : null}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      <div className="flex items-center justify-between mt-6">
        <div className="text-sm text-gray-700">
          Page {currentPage} of {totalPages}
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
            disabled={currentPage === 1}
          >
            <ChevronLeft className="h-4 w-4" />
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
            disabled={currentPage === totalPages}
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Enhanced Details Modal */}
      {showDetails && selectedRecord && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="relative bg-white rounded-3xl max-w-4xl w-full max-h-[90vh] overflow-hidden ">
 
            <div className="relative bg-white rounded-3xl overflow-hidden">
              {/* Enhanced Header */}
              <div className="bg-gradient-to-r from-primary-purple to-accent-purple p-6 text-white">
                <div className="flex justify-between items-center">
                  <div className="flex items-center space-x-3">
                    <div className="relative">
 
                      <div className="relative bg-white/20 rounded-full p-2">
                        <FileText className="h-6 w-6" />
                      </div>
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold">Record Details</h2>
                      <p className="text-white/80 mt-1">Comprehensive record information</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowDetails(false)}
                    className="text-white/80 hover:text-white hover:bg-white/20 p-2 rounded-xl transition-all duration-200"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Record Information */}
              <div className="p-8 overflow-y-auto max-h-[calc(90vh-200px)]">
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="relative group">
 
                      <div className="relative bg-gray-50 rounded-xl p-4">
                        <div className="flex items-center space-x-3">
                          <div className="bg-primary-purple/10 rounded-lg p-2">
                            <FileText className="h-5 w-5 text-primary-purple" />
                          </div>
                          <div>
                            <label className="text-sm font-semibold text-gray-500 uppercase tracking-wider">ID</label>
                            <p className="text-lg font-semibold text-gray-900">{selectedRecord.id}</p>
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
                            <div className="mt-1">{getStatusBadge(selectedRecord.status)}</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="relative group">
 
                      <div className="relative bg-gray-50 rounded-xl p-4">
                        <div className="flex items-center space-x-3">
                          <div className="bg-primary-purple/10 rounded-lg p-2">
                            <User className="h-5 w-5 text-primary-purple" />
                          </div>
                          <div>
                            <label className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Patient</label>
                            <p className="text-lg font-semibold text-gray-900">{selectedRecord.patient_name}</p>
                            <p className="text-sm text-gray-600 mt-1">{selectedRecord.patient_identifier}</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="relative group">
 
                      <div className="relative bg-gray-50 rounded-xl p-4">
                        <div className="flex items-center space-x-3">
                          <div className="bg-accent-cyan/10 rounded-lg p-2">
                            <Building2 className="h-5 w-5 text-accent-cyan" />
                          </div>
                          <div>
                            <label className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Provider</label>
                            <p className="text-lg font-semibold text-gray-900">{selectedRecord.provider_name}</p>
                            <p className="text-sm text-gray-600 mt-1">{selectedRecord.provider_type}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {selectedRecord.amount != null && (
                    <div className="relative group">
 
                      <div className="relative bg-gray-50 rounded-xl p-4">
                        <div className="flex items-center space-x-3">
                          <div className="bg-primary-purple/10 rounded-lg p-2">
                            <DollarSign className="h-5 w-5 text-primary-purple" />
                          </div>
                          <div>
                            <label className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Amount</label>
                            <p className="text-2xl font-bold text-accent-cyan">{formatCurrency(selectedRecord.amount)}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {selectedRecord.purpose && (
                    <div className="relative group">
 
                      <div className="relative bg-gray-50 rounded-xl p-4">
                        <label className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Purpose</label>
                        <p className="text-lg font-semibold text-gray-900 mt-2">{selectedRecord.purpose}</p>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {selectedRecord.urgency && (
                      <div className="relative group">
   
                        <div className="relative bg-gray-50 rounded-xl p-4">
                          <label className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Urgency</label>
                          <div className="mt-2">
                            <Badge variant="outline">{selectedRecord.urgency}</Badge>
                          </div>
                        </div>
                      </div>
                    )}

                    {selectedRecord.coverage && (
                      <div className="relative group">
   
                        <div className="relative bg-gray-50 rounded-xl p-4">
                          <label className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Coverage</label>
                          <div className="mt-2">
                            <Badge variant="outline">{selectedRecord.coverage}</Badge>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="relative group border-t border-gray-200 pt-6">
 
                    <div className="relative bg-gray-50 rounded-xl p-4">
                      <label className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Full Record Data (JSON)</label>
                      <pre className="bg-white p-4 rounded-md overflow-x-auto text-sm mt-2 border border-gray-200">
                        {JSON.stringify(selectedRecord, null, 2)}
                      </pre>
                    </div>
                  </div>
                </div>
              </div>

              {/* Enhanced Footer */}
              <div className="bg-gray-50 px-6 py-4 border-t border-gray-200">
                <div className="flex justify-between items-center">
                  <div className="text-sm text-gray-600">
                    <span className="font-medium">Record ID:</span> {selectedRecord.id}
                  </div>
                  <div className="flex space-x-3">
                    <button
                      onClick={() => setShowDetails(false)}
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
    </div>
  );
};

export default ResponseViewer;
