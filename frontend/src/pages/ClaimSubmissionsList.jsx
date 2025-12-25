import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import DataTable from '@/components/DataTable';
import Select from 'react-select';
import api, { extractErrorMessage } from '@/services/api';
import { 
  FileText, Edit, Trash2, Eye, Send, RefreshCw, 
  XCircle, Clock, CheckCircle, AlertCircle,
  Filter, Search, Copy, Receipt, DollarSign, X, AlertTriangle, Plus
} from 'lucide-react';

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

// Custom Modal Component
const Modal = ({ open, onClose, title, description, children, footer }) => {
  if (!open) return null;
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/50" onClick={onClose}></div>
      <div className="relative bg-white rounded-xl shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-hidden">
        <div className="p-6 border-b">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold">{title}</h2>
              {description && <p className="text-sm text-gray-500 mt-1">{description}</p>}
            </div>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
        <div className="p-6 overflow-auto max-h-[60vh]">
          {children}
        </div>
        {footer && (
          <div className="p-6 border-t bg-gray-50 flex justify-end gap-3">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};

export default function ClaimSubmissionsList() {
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
  
  // Test Claim Modal State
  const [showTestClaimModal, setShowTestClaimModal] = useState(false);
  const [testClaimForm, setTestClaimForm] = useState({
    claim_type: 'professional',
    patient_id: '',
    provider_id: '',
    insurer_id: '',
    priority: 'normal',
    encounter_class: 'ambulatory',
    service_date: new Date().toISOString().split('T')[0],
    total_amount: '',
    currency: 'SAR'
  });
  const [patients, setPatients] = useState([]);
  const [providers, setProviders] = useState([]);
  const [insurers, setInsurers] = useState([]);
  const [creatingTestClaim, setCreatingTestClaim] = useState(false);
  const [formErrors, setFormErrors] = useState({});

  useEffect(() => {
    loadClaims();
  }, [pagination.page, filters.status, filters.claim_type]);

  // Load reference data when modal opens
  useEffect(() => {
    if (showTestClaimModal) {
      loadReferenceData();
    }
  }, [showTestClaimModal]);

  const loadClaims = async () => {
    try {
      setLoading(true);
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

  const handleSearch = () => {
    setPagination(prev => ({ ...prev, page: 1 }));
    loadClaims();
    // Update URL params
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
    loadClaims();
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this claim submission?')) {
      try {
        setLoading(true);
        await api.deleteClaimSubmission(id);
        setClaims(prev => prev.filter(claim => claim.id !== id));
        await loadClaims();
      } catch (error) {
        console.error('Error deleting claim submission:', error);
        const errorMsg = error.response?.data?.error || 'Error deleting claim submission. Please try again.';
        alert(errorMsg);
        await loadClaims();
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
        await loadClaims();
      } catch (error) {
        console.error('Error sending to NPHIES:', error);
        alert(`Error: ${extractErrorMessage(error)}`);
        await loadClaims();
      } finally {
        setLoading(false);
      }
    }
  };

  const handleDuplicate = async (id) => {
    if (window.confirm('Create a duplicate of this claim as a new draft?')) {
      try {
        setLoading(true);
        // For now, navigate to create from the claim (similar to PA duplicate)
        // Can be expanded with a dedicated duplicate API endpoint
        navigate(`/claim-submissions/${id}/edit`);
      } catch (error) {
        console.error('Error duplicating claim:', error);
        alert(`Error: ${extractErrorMessage(error)}`);
      } finally {
        setLoading(false);
      }
    }
  };

  const loadReferenceData = async () => {
    try {
      const [patientsRes, providersRes, insurersRes] = await Promise.all([
        api.getPatients({ limit: 1000 }),
        api.getProviders({ limit: 1000 }),
        api.getInsurers({ limit: 1000 })
      ]);
      setPatients(patientsRes?.data || []);
      setProviders(providersRes?.data || []);
      setInsurers(insurersRes?.data || []);
      
      // Auto-select patient with Iqama 2333333333 for Test Case 5
      const testPatient = (patientsRes?.data || []).find(p => p.identifier === '2333333333');
      if (testPatient) {
        setTestClaimForm(prev => ({ ...prev, patient_id: testPatient.patient_id }));
      }
    } catch (error) {
      console.error('Error loading reference data:', error);
    }
  };

  const handleTestClaimFormChange = (field, value) => {
    setTestClaimForm(prev => ({ ...prev, [field]: value }));
    // Clear error when user changes field
    if (formErrors[field]) {
      setFormErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
    
    // Auto-set encounter class based on claim type
    if (field === 'claim_type') {
      const defaultEncounterClasses = {
        professional: 'ambulatory',
        institutional: 'inpatient',
        pharmacy: 'ambulatory',
        dental: 'ambulatory',
        vision: 'ambulatory'
      };
      setTestClaimForm(prev => ({ 
        ...prev, 
        encounter_class: defaultEncounterClasses[value] || 'ambulatory' 
      }));
    }
  };

  const validateTestClaimForm = () => {
    const errors = {};
    if (!testClaimForm.claim_type) errors.claim_type = 'Claim type is required';
    if (!testClaimForm.patient_id) errors.patient_id = 'Patient is required';
    if (!testClaimForm.provider_id) errors.provider_id = 'Provider is required';
    if (!testClaimForm.insurer_id) errors.insurer_id = 'Insurer is required';
    if (!testClaimForm.priority) errors.priority = 'Priority is required';
    if (!testClaimForm.service_date) errors.service_date = 'Service date is required';
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const generateMinimalItems = () => {
    // Generate minimal item structure for test claim
    const items = [{
      sequence: 1,
      product_or_service_code: '99213', // Common office visit CPT code
      product_or_service_system: 'http://www.ama-assn.org/go/cpt',
      product_or_service_display: 'Office or other outpatient visit',
      quantity: 1,
      unit_price: parseFloat(testClaimForm.total_amount) || 100,
      net_amount: parseFloat(testClaimForm.total_amount) || 100,
      currency: testClaimForm.currency || 'SAR',
      serviced_date: testClaimForm.service_date
    }];
    return items;
  };

  const generateMinimalDiagnoses = () => {
    // Generate minimal diagnosis structure
    const diagnoses = [{
      sequence: 1,
      diagnosis_code: 'Z00.00',
      diagnosis_system: 'http://hl7.org/fhir/sid/icd-10',
      diagnosis_display: 'Encounter for general adult medical examination without abnormal findings'
    }];
    return diagnoses;
  };

  const handleCreateTestClaim = async (sendToNphies = false) => {
    if (!validateTestClaimForm()) {
      return;
    }

    try {
      setCreatingTestClaim(true);
      
      // Prepare claim data - explicitly exclude references
      const claimData = {
        claim_type: testClaimForm.claim_type,
        patient_id: testClaimForm.patient_id,
        provider_id: testClaimForm.provider_id,
        insurer_id: testClaimForm.insurer_id,
        priority: testClaimForm.priority || 'normal', // Test Case 5 requirement
        encounter_class: testClaimForm.encounter_class,
        service_date: testClaimForm.service_date,
        total_amount: testClaimForm.total_amount ? parseFloat(testClaimForm.total_amount) : 100,
        currency: testClaimForm.currency || 'SAR',
        status: 'draft',
        // Explicitly exclude prior auth and eligibility references
        pre_auth_ref: null,
        prior_auth_id: null,
        eligibility_ref: null,
        eligibility_offline_ref: null,
        // Auto-generate minimal required data
        items: generateMinimalItems(),
        diagnoses: generateMinimalDiagnoses(),
        supporting_info: []
      };

      const response = await api.createClaimSubmission(claimData);
      const claimId = response.data?.id || response.id;

      if (!claimId) {
        alert('Failed to create test claim. Please try again.');
        return;
      }

      if (sendToNphies) {
        // Send to NPHIES immediately
        try {
          const sendResponse = await api.sendClaimSubmissionToNphies(claimId);
          if (sendResponse.success) {
            alert('Test claim created and sent to NPHIES. Expected to receive error response (Test Case 5).');
          } else {
            alert(`Test claim created but failed to send to NPHIES: ${sendResponse.error?.message || 'Unknown error'}`);
          }
        } catch (sendError) {
          console.error('Error sending to NPHIES:', sendError);
          alert(`Test claim created but failed to send to NPHIES: ${extractErrorMessage(sendError)}`);
        }
      } else {
        alert('Test claim created successfully. Navigate to claim details to send to NPHIES.');
      }

      // Close modal and reset form
      setShowTestClaimModal(false);
      setTestClaimForm({
        claim_type: 'professional',
        patient_id: '',
        provider_id: '',
        insurer_id: '',
        priority: 'normal',
        encounter_class: 'ambulatory',
        service_date: new Date().toISOString().split('T')[0],
        total_amount: '',
        currency: 'SAR'
      });
      setFormErrors({});

      // Reload claims list
      await loadClaims();

      // Navigate to claim details
      navigate(`/claim-submissions/${claimId}`);
    } catch (error) {
      console.error('Error creating test claim:', error);
      alert(`Error: ${extractErrorMessage(error)}`);
    } finally {
      setCreatingTestClaim(false);
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
                  navigate(`/claim-submissions/${row.id}/edit`);
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
                loadClaims();
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
                  Total: {stats.total} | Draft: {stats.draft} | Approved: {stats.approved}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Button
                onClick={() => setShowTestClaimModal(true)}
                variant="outline"
                className="border-orange-500 text-orange-600 hover:bg-orange-50"
              >
                <Plus className="h-4 w-4 mr-2" />
                Create Test Claim
              </Button>
              <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 rounded-lg border border-blue-200">
                <FileText className="h-5 w-5 text-blue-600" />
                <span className="text-sm text-blue-700">
                  Claims are created from approved Prior Authorizations
                </span>
              </div>
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
                  placeholder="Search by claim #, patient, provider..."
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
                value={filters.claim_type}
                onChange={(e) => setFilters(prev => ({ ...prev, claim_type: e.target.value }))}
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
            <Button variant="outline" size="sm" onClick={loadClaims} disabled={loading}>
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

      {/* Create Test Claim Modal */}
      <Modal
        open={showTestClaimModal}
        onClose={() => {
          setShowTestClaimModal(false);
          setFormErrors({});
        }}
        title="Create Test Claim (Without References)"
        description="Create a claim without prior authorization or eligibility references for testing NPHIES error responses (Test Case 5)"
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => {
                setShowTestClaimModal(false);
                setFormErrors({});
              }}
              disabled={creatingTestClaim}
            >
              Cancel
            </Button>
            <Button
              onClick={() => handleCreateTestClaim(false)}
              disabled={creatingTestClaim}
              variant="outline"
              className="border-blue-500 text-blue-600 hover:bg-blue-50"
            >
              {creatingTestClaim ? 'Creating...' : 'Create Draft'}
            </Button>
            <Button
              onClick={() => handleCreateTestClaim(true)}
              disabled={creatingTestClaim}
              className="bg-orange-500 hover:bg-orange-600"
            >
              {creatingTestClaim ? 'Creating & Sending...' : 'Create & Send to NPHIES'}
            </Button>
          </>
        }
      >
        <div className="space-y-6">
          {/* Warning Message */}
          <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-orange-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-orange-800">
                  Test Claim - Expected Error Response
                </p>
                <p className="text-sm text-orange-700 mt-1">
                  This claim will be submitted without prior authorization or eligibility references. 
                  According to Test Case 5, NPHIES should return an error response when a claim is submitted 
                  without any references. Priority must be set to "normal" and use member Iqama 2333333333 for testing.
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Claim Type */}
            <div className="space-y-2">
              <Label htmlFor="claim_type">Claim Type *</Label>
              <select
                id="claim_type"
                value={testClaimForm.claim_type}
                onChange={(e) => handleTestClaimFormChange('claim_type', e.target.value)}
                className={`w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-purple/30 ${
                  formErrors.claim_type ? 'border-red-300' : 'border-gray-200'
                }`}
              >
                <option value="professional">Professional</option>
                <option value="institutional">Institutional</option>
                <option value="pharmacy">Pharmacy</option>
                <option value="dental">Dental</option>
                <option value="vision">Vision</option>
              </select>
              {formErrors.claim_type && (
                <p className="text-xs text-red-600">{formErrors.claim_type}</p>
              )}
            </div>

            {/* Priority */}
            <div className="space-y-2">
              <Label htmlFor="priority">Priority *</Label>
              <select
                id="priority"
                value={testClaimForm.priority}
                onChange={(e) => handleTestClaimFormChange('priority', e.target.value)}
                className={`w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-purple/30 ${
                  formErrors.priority ? 'border-red-300' : 'border-gray-200'
                }`}
              >
                <option value="normal">Normal (Test Case 5)</option>
                <option value="urgent">Urgent</option>
                <option value="asap">ASAP</option>
              </select>
              {formErrors.priority && (
                <p className="text-xs text-red-600">{formErrors.priority}</p>
              )}
            </div>

            {/* Patient */}
            <div className="space-y-2">
              <Label htmlFor="patient">Patient * (Use Iqama 2333333333 for Test Case 5)</Label>
              <Select
                value={patients.map(p => ({ 
                  value: p.patient_id, 
                  label: `${p.name}${p.identifier ? ` (${p.identifier})` : ''}` 
                })).find(opt => opt.value === testClaimForm.patient_id)}
                onChange={(option) => handleTestClaimFormChange('patient_id', option?.value || '')}
                options={patients.map(p => ({ 
                  value: p.patient_id, 
                  label: `${p.name}${p.identifier ? ` (${p.identifier})` : ''}` 
                }))}
                placeholder="Search and select patient..."
                isClearable
                isSearchable
                menuPortalTarget={document.body}
                styles={{
                  control: (base) => ({
                    ...base,
                    borderColor: formErrors.patient_id ? '#fca5a5' : base.borderColor,
                    '&:hover': {
                      borderColor: formErrors.patient_id ? '#fca5a5' : base.borderColor
                    }
                  }),
                  menuPortal: (base) => ({ ...base, zIndex: 9999 })
                }}
              />
              {formErrors.patient_id && (
                <p className="text-xs text-red-600">{formErrors.patient_id}</p>
              )}
            </div>

            {/* Provider */}
            <div className="space-y-2">
              <Label htmlFor="provider">Provider *</Label>
              <Select
                value={providers.map(p => ({ 
                  value: p.provider_id, 
                  label: `${p.provider_name || p.name}${p.nphies_id ? ` (${p.nphies_id})` : ''}` 
                })).find(opt => opt.value === testClaimForm.provider_id)}
                onChange={(option) => handleTestClaimFormChange('provider_id', option?.value || '')}
                options={providers.map(p => ({ 
                  value: p.provider_id, 
                  label: `${p.provider_name || p.name}${p.nphies_id ? ` (${p.nphies_id})` : ''}` 
                }))}
                placeholder="Search and select provider..."
                isClearable
                isSearchable
                menuPortalTarget={document.body}
                styles={{
                  control: (base) => ({
                    ...base,
                    borderColor: formErrors.provider_id ? '#fca5a5' : base.borderColor,
                    '&:hover': {
                      borderColor: formErrors.provider_id ? '#fca5a5' : base.borderColor
                    }
                  }),
                  menuPortal: (base) => ({ ...base, zIndex: 9999 })
                }}
              />
              {formErrors.provider_id && (
                <p className="text-xs text-red-600">{formErrors.provider_id}</p>
              )}
            </div>

            {/* Insurer */}
            <div className="space-y-2">
              <Label htmlFor="insurer">Insurer *</Label>
              <Select
                value={insurers.map(i => ({ 
                  value: i.insurer_id, 
                  label: `${i.insurer_name || i.name}${i.nphies_id ? ` (${i.nphies_id})` : ''}` 
                })).find(opt => opt.value === testClaimForm.insurer_id)}
                onChange={(option) => handleTestClaimFormChange('insurer_id', option?.value || '')}
                options={insurers.map(i => ({ 
                  value: i.insurer_id, 
                  label: `${i.insurer_name || i.name}${i.nphies_id ? ` (${i.nphies_id})` : ''}` 
                }))}
                placeholder="Search and select insurer..."
                isClearable
                isSearchable
                menuPortalTarget={document.body}
                styles={{
                  control: (base) => ({
                    ...base,
                    borderColor: formErrors.insurer_id ? '#fca5a5' : base.borderColor,
                    '&:hover': {
                      borderColor: formErrors.insurer_id ? '#fca5a5' : base.borderColor
                    }
                  }),
                  menuPortal: (base) => ({ ...base, zIndex: 9999 })
                }}
              />
              {formErrors.insurer_id && (
                <p className="text-xs text-red-600">{formErrors.insurer_id}</p>
              )}
            </div>

            {/* Encounter Class */}
            <div className="space-y-2">
              <Label htmlFor="encounter_class">Encounter Class</Label>
              <select
                id="encounter_class"
                value={testClaimForm.encounter_class}
                onChange={(e) => handleTestClaimFormChange('encounter_class', e.target.value)}
                className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-purple/30"
              >
                <option value="inpatient">Inpatient</option>
                <option value="outpatient">Outpatient</option>
                <option value="daycase">Day Case</option>
                <option value="emergency">Emergency</option>
                <option value="ambulatory">Ambulatory</option>
                <option value="home">Home</option>
                <option value="telemedicine">Telemedicine</option>
              </select>
            </div>

            {/* Service Date */}
            <div className="space-y-2">
              <Label htmlFor="service_date">Service Date *</Label>
              <Input
                id="service_date"
                type="date"
                value={testClaimForm.service_date}
                onChange={(e) => handleTestClaimFormChange('service_date', e.target.value)}
                className={formErrors.service_date ? 'border-red-300' : ''}
              />
              {formErrors.service_date && (
                <p className="text-xs text-red-600">{formErrors.service_date}</p>
              )}
            </div>

            {/* Total Amount */}
            <div className="space-y-2">
              <Label htmlFor="total_amount">Total Amount (SAR)</Label>
              <Input
                id="total_amount"
                type="number"
                step="0.01"
                value={testClaimForm.total_amount}
                onChange={(e) => handleTestClaimFormChange('total_amount', e.target.value)}
                placeholder="100.00"
              />
            </div>

            {/* Currency */}
            <div className="space-y-2">
              <Label htmlFor="currency">Currency</Label>
              <select
                id="currency"
                value={testClaimForm.currency}
                onChange={(e) => handleTestClaimFormChange('currency', e.target.value)}
                className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-purple/30"
              >
                <option value="SAR">SAR</option>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
              </select>
            </div>
          </div>

          <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
            <p className="text-xs text-gray-600">
              <strong>Note:</strong> Minimal required data (items, diagnoses) will be auto-generated. 
              This claim will be created without prior authorization or eligibility references to test NPHIES error handling.
            </p>
          </div>
        </div>
      </Modal>
    </div>
  );
}
