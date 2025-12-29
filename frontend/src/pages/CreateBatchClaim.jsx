import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem } from '@/components/ui/select';
import { 
  ArrowLeft, Package, AlertCircle, Loader2, CheckCircle2, 
  DollarSign, Users, Calendar
} from 'lucide-react';
import api from '@/services/api';

export default function CreateBatchClaim() {
  const navigate = useNavigate();
  
  // Form state
  const [batchForm, setBatchForm] = useState({
    batch_identifier: '',
    batch_period_start: new Date().toISOString().split('T')[0],
    batch_period_end: new Date().toISOString().split('T')[0],
    description: ''
  });
  const [batchIdentifierOptions, setBatchIdentifierOptions] = useState([]);
  
  // Claims selection state
  const [availableClaims, setAvailableClaims] = useState([]);
  const [selectedClaims, setSelectedClaims] = useState([]);
  const [filterClaimType, setFilterClaimType] = useState('');
  
  // Loading states
  const [loading, setLoading] = useState(true);
  const [createLoading, setCreateLoading] = useState(false);

  useEffect(() => {
    initializePage();
  }, []);

  const initializePage = async () => {
    setLoading(true);
    const options = generateBatchIdentifierOptions();
    setBatchIdentifierOptions(options);
    setBatchForm(prev => ({
      ...prev,
      batch_identifier: options[0].value
    }));
    await loadAvailableClaims();
    setLoading(false);
  };

  const getWeekNumber = (date) => {
    const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
    const pastDaysOfYear = (date - firstDayOfYear) / 86400000;
    return String(Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7)).padStart(2, '0');
  };

  const generateBatchIdentifierOptions = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const timestamp = Date.now();
    const shortId = timestamp.toString().slice(-6);
    
    return [
      { value: `BATCH-${year}${month}${day}-${shortId}`, label: `BATCH-${year}${month}${day}-${shortId} (Date + ID)` },
      { value: `BATCH-${year}-${month}-${shortId}`, label: `BATCH-${year}-${month}-${shortId} (Year-Month + ID)` },
      { value: `CLM-BATCH-${shortId}`, label: `CLM-BATCH-${shortId} (Simple)` },
      { value: `MONTHLY-${year}${month}-${shortId}`, label: `MONTHLY-${year}${month}-${shortId} (Monthly)` },
      { value: `WEEKLY-${year}W${getWeekNumber(now)}-${shortId}`, label: `WEEKLY-${year}W${getWeekNumber(now)}-${shortId} (Weekly)` },
      { value: `DAILY-${year}${month}${day}-${shortId}`, label: `DAILY-${year}${month}${day}-${shortId} (Daily)` },
    ];
  };

  const loadAvailableClaims = async (insurerId = null) => {
    try {
      const params = {};
      if (insurerId) params.insurer_id = insurerId;
      const response = await api.getAvailableClaimsForBatch(params);
      setAvailableClaims(response.data || []);
    } catch (error) {
      console.error('Error loading available claims:', error);
      setAvailableClaims([]);
    }
  };

  // Get unique claim types from available claims
  const getUniqueClaimTypes = () => {
    const types = new Set();
    availableClaims.forEach(c => {
      if (c.claim_type) types.add(c.claim_type);
    });
    return Array.from(types);
  };

  // Get filtered claims based on selected claim type
  const getFilteredClaims = () => {
    if (!filterClaimType) return availableClaims;
    return availableClaims.filter(c => c.claim_type === filterClaimType);
  };

  const handleClaimSelect = (claimId) => {
    const filteredClaims = getFilteredClaims();
    setSelectedClaims(prev => {
      if (prev.includes(claimId)) {
        return prev.filter(id => id !== claimId);
      } else {
        // Check if we're at 200 limit
        if (prev.length >= 200) {
          alert('Maximum 200 claims per batch');
          return prev;
        }
        // Check insurer consistency
        const claim = filteredClaims.find(c => c.id === claimId);
        if (prev.length > 0) {
          const firstClaim = filteredClaims.find(c => c.id === prev[0]);
          if (claim.insurer_id !== firstClaim.insurer_id) {
            alert('All claims in a batch must be for the same insurer');
            return prev;
          }
          // Check claim type consistency
          if (claim.claim_type !== firstClaim.claim_type) {
            alert('All claims in a batch must be of the same type');
            return prev;
          }
        }
        return [...prev, claimId];
      }
    });
  };

  const handleSelectAllClaims = () => {
    const filteredClaims = getFilteredClaims();
    if (selectedClaims.length === filteredClaims.length) {
      setSelectedClaims([]);
    } else {
      // Only select claims with same insurer and type as first one
      if (filteredClaims.length > 0) {
        const firstInsurer = filteredClaims[0].insurer_id;
        const firstType = filteredClaims[0].claim_type;
        const compatibleClaims = filteredClaims
          .filter(c => c.insurer_id === firstInsurer && c.claim_type === firstType)
          .slice(0, 200)
          .map(c => c.id);
        setSelectedClaims(compatibleClaims);
      }
    }
  };

  const handleCreateBatch = async () => {
    if (selectedClaims.length < 2) {
      alert('Please select at least 2 claims for the batch');
      return;
    }

    try {
      setCreateLoading(true);
      const response = await api.createClaimBatch({
        ...batchForm,
        claim_ids: selectedClaims
      });

      if (response.data) {
        // Navigate to the new batch details
        navigate(`/claim-batches/${response.data.id}`);
      }
    } catch (error) {
      console.error('Error creating batch:', error);
      alert(error.response?.data?.error || 'Failed to create batch');
    } finally {
      setCreateLoading(false);
    }
  };

  // Calculate selected claims total
  const getSelectedTotal = () => {
    return getFilteredClaims()
      .filter(c => selectedClaims.includes(c.id))
      .reduce((sum, c) => sum + parseFloat(c.total_amount || 0), 0);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary-purple mx-auto mb-4" />
          <p className="text-gray-600">Loading available claims...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Header */}
      <div className="bg-gradient-to-r from-primary-purple to-accent-purple text-white">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <Button 
            variant="ghost" 
            onClick={() => navigate('/claim-batches')}
            className="mb-4 text-white/80 hover:text-white hover:bg-white/10"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Claim Batches
          </Button>
          
          <div className="flex items-center gap-3">
            <Package className="h-8 w-8" />
            <div>
              <h1 className="text-3xl font-bold">Create Batch Claim</h1>
              <p className="text-white/80 mt-1">
                Select approved authorization items to submit as batch claim
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Batch Form */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center">
              <Calendar className="h-5 w-5 mr-2 text-primary-purple" />
              Batch Information
            </CardTitle>
            <CardDescription>Configure batch identifier and period</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <Label>Batch Identifier</Label>
                <Select
                  value={batchForm.batch_identifier}
                  onValueChange={(value) => setBatchForm(prev => ({ ...prev, batch_identifier: value }))}
                  placeholder="Select batch identifier format"
                >
                  <SelectContent>
                    {batchIdentifierOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Description</Label>
                <Input
                  value={batchForm.description}
                  onChange={(e) => setBatchForm(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Optional description"
                />
              </div>
              <div>
                <Label>Period Start</Label>
                <Input
                  type="date"
                  value={batchForm.batch_period_start}
                  onChange={(e) => setBatchForm(prev => ({ ...prev, batch_period_start: e.target.value }))}
                />
              </div>
              <div>
                <Label>Period End</Label>
                <Input
                  type="date"
                  value={batchForm.batch_period_end}
                  onChange={(e) => setBatchForm(prev => ({ ...prev, batch_period_end: e.target.value }))}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Summary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Card className="bg-purple-50 border-purple-200">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-sm text-purple-600">Selected Claims</p>
                <p className="text-2xl font-bold text-purple-700">{selectedClaims.length} / 200</p>
              </div>
              <Users className="h-8 w-8 text-purple-500" />
            </CardContent>
          </Card>
          <Card className="bg-green-50 border-green-200">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-sm text-green-600">Total Amount</p>
                <p className="text-2xl font-bold text-green-700">SAR {getSelectedTotal().toLocaleString()}</p>
              </div>
              <DollarSign className="h-8 w-8 text-green-500" />
            </CardContent>
          </Card>
          <Card className="bg-blue-50 border-blue-200">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-sm text-blue-600">Available Claims</p>
                <p className="text-2xl font-bold text-blue-700">{availableClaims.length}</p>
              </div>
              <Package className="h-8 w-8 text-blue-500" />
            </CardContent>
          </Card>
        </div>

        {/* Claim Type Filter */}
        <Card className="mb-6 border-blue-200 bg-blue-50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <Label className="text-blue-800 font-medium">Filter by Claim Type:</Label>
                <select
                  value={filterClaimType}
                  onChange={(e) => {
                    setFilterClaimType(e.target.value);
                    setSelectedClaims([]); // Reset selection when filter changes
                  }}
                  className="px-3 py-2 border border-blue-300 rounded-lg bg-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">All Types ({availableClaims.length} items)</option>
                  {getUniqueClaimTypes().map(type => (
                    <option key={type} value={type}>
                      {type.charAt(0).toUpperCase() + type.slice(1)} ({availableClaims.filter(c => c.claim_type === type).length} items)
                    </option>
                  ))}
                </select>
              </div>
              {filterClaimType && (
                <span className="text-sm text-blue-600">
                  Showing {getFilteredClaims().length} {filterClaimType} claims
                </span>
              )}
            </div>
            <p className="text-xs text-blue-600 mt-2">
              <AlertCircle className="w-3 h-3 inline mr-1" />
              NPHIES requires all claims in a batch to be of the same type (e.g., all oral, all vision, etc.)
            </p>
          </CardContent>
        </Card>

        {/* Selection Controls */}
        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <span className="font-medium">Selected Items: {selectedClaims.length} / 200</span>
                {selectedClaims.length > 0 && (
                  <span className="text-sm text-gray-500">
                    Total Amount: SAR {getSelectedTotal().toLocaleString()}
                  </span>
                )}
              </div>
              <Button variant="outline" size="sm" onClick={handleSelectAllClaims}>
                {selectedClaims.length === getFilteredClaims().length && getFilteredClaims().length > 0 
                  ? 'Deselect All' 
                  : 'Select All (Same Insurer & Type)'}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Claims Table */}
        <Card>
          <CardHeader>
            <CardTitle>Available Authorization Items</CardTitle>
            <CardDescription>Select approved items to include in the batch claim</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Select</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Auth Request #</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Type</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Service</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Patient</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Insurer</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Amount</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {getFilteredClaims().map((item) => (
                    <tr 
                      key={item.id} 
                      className={`hover:bg-gray-50 cursor-pointer ${selectedClaims.includes(item.id) ? 'bg-purple-50' : ''}`}
                      onClick={() => handleClaimSelect(item.id)}
                    >
                      <td className="px-4 py-3">
                        <Checkbox 
                          checked={selectedClaims.includes(item.id)}
                          onCheckedChange={() => handleClaimSelect(item.id)}
                        />
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <div className="flex flex-col">
                          <span className="font-medium">{item.auth_request_number}</span>
                          <span className="text-xs text-gray-400">Item #{item.sequence}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <Badge 
                          variant="outline" 
                          className={`text-xs ${
                            item.claim_type === 'oral' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                            item.claim_type === 'dental' ? 'bg-cyan-50 text-cyan-700 border-cyan-200' :
                            item.claim_type === 'vision' ? 'bg-purple-50 text-purple-700 border-purple-200' :
                            item.claim_type === 'pharmacy' ? 'bg-green-50 text-green-700 border-green-200' :
                            item.claim_type === 'professional' ? 'bg-orange-50 text-orange-700 border-orange-200' :
                            item.claim_type === 'institutional' ? 'bg-red-50 text-red-700 border-red-200' :
                            'bg-gray-50 text-gray-700 border-gray-200'
                          }`}
                        >
                          {item.claim_type ? item.claim_type.charAt(0).toUpperCase() + item.claim_type.slice(1) : 'N/A'}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <div className="flex flex-col">
                          <span className="font-medium">{item.product_code}</span>
                          <span className="text-xs text-gray-400 truncate max-w-[200px]" title={item.product_display}>
                            {item.product_display}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm">{item.patient_name}</td>
                      <td className="px-4 py-3 text-sm">{item.insurer_name}</td>
                      <td className="px-4 py-3 text-sm">SAR {parseFloat(item.total_amount || 0).toLocaleString()}</td>
                      <td className="px-4 py-3 text-sm">
                        <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
                          {item.status === 'approved' ? 'Approved' : item.status}
                        </Badge>
                        {item.pre_auth_ref && (
                          <span className="text-xs text-gray-400 block mt-0.5">
                            Ref: {item.pre_auth_ref}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {getFilteredClaims().length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                        {filterClaimType 
                          ? `No approved ${filterClaimType} authorization items available. Try selecting a different claim type.`
                          : 'No approved authorization items available for batching. Submit prior authorizations and get them approved first.'
                        }
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Footer Actions */}
        <div className="mt-8 flex items-center justify-between p-6 bg-white rounded-lg shadow-sm border">
          <p className="text-sm text-gray-500">
            {selectedClaims.length < 2 
              ? 'Select at least 2 approved items to create a batch' 
              : `${selectedClaims.length} approved items selected`}
          </p>
          <div className="flex items-center gap-3">
            <Button 
              variant="outline"
              onClick={() => navigate('/claim-batches')}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleCreateBatch} 
              disabled={selectedClaims.length < 2 || createLoading}
              className="bg-gradient-to-r from-primary-purple to-accent-purple"
            >
              {createLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Create Batch Claim
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

