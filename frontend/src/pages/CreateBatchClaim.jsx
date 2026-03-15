import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { 
  ArrowLeft, ArrowRight, Package, AlertCircle, Loader2, CheckCircle2, 
  DollarSign, Users, Calendar, Check, FileText, ClipboardList
} from 'lucide-react';
import api from '@/services/api';

const CLAIM_TYPES = [
  { value: 'oral', label: 'Oral / Dental', color: 'bg-blue-100 text-blue-700 border-blue-200' },
  { value: 'vision', label: 'Vision', color: 'bg-purple-100 text-purple-700 border-purple-200' },
  { value: 'pharmacy', label: 'Pharmacy', color: 'bg-green-100 text-green-700 border-green-200' },
  { value: 'professional', label: 'Professional', color: 'bg-orange-100 text-orange-700 border-orange-200' },
  { value: 'institutional', label: 'Institutional', color: 'bg-red-100 text-red-700 border-red-200' },
];

const STEPS = [
  { id: 1, label: 'Select Claim Type', icon: FileText },
  { id: 2, label: 'Select Claims & Configure', icon: ClipboardList },
  { id: 3, label: 'Review & Create', icon: CheckCircle2 },
];

export default function CreateBatchClaim() {
  const navigate = useNavigate();
  
  const [step, setStep] = useState(1);
  const [selectedClaimType, setSelectedClaimType] = useState('');
  
  const [batchForm, setBatchForm] = useState({
    batch_identifier: '',
    batch_period_start: new Date().toISOString().split('T')[0],
    batch_period_end: new Date().toISOString().split('T')[0],
    description: ''
  });
  const [batchIdentifierOptions, setBatchIdentifierOptions] = useState([]);
  
  const [availableClaims, setAvailableClaims] = useState([]);
  const [selectedClaims, setSelectedClaims] = useState([]);
  
  const [loading, setLoading] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [validationError, setValidationError] = useState('');

  useEffect(() => {
    const options = generateBatchIdentifierOptions();
    setBatchIdentifierOptions(options);
    setBatchForm(prev => ({ ...prev, batch_identifier: options[0].value }));
  }, []);

  useEffect(() => {
    if (selectedClaimType) {
      loadAvailableClaims();
    }
  }, [selectedClaimType]);

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
    const shortId = Date.now().toString().slice(-6);
    
    return [
      { value: `BATCH-${year}${month}${day}-${shortId}`, label: `BATCH-${year}${month}${day}-${shortId} (Date + ID)` },
      { value: `BATCH-${year}-${month}-${shortId}`, label: `BATCH-${year}-${month}-${shortId} (Year-Month + ID)` },
      { value: `CLM-BATCH-${shortId}`, label: `CLM-BATCH-${shortId} (Simple)` },
      { value: `MONTHLY-${year}${month}-${shortId}`, label: `MONTHLY-${year}${month}-${shortId} (Monthly)` },
      { value: `WEEKLY-${year}W${getWeekNumber(now)}-${shortId}`, label: `WEEKLY-${year}W${getWeekNumber(now)}-${shortId} (Weekly)` },
      { value: `DAILY-${year}${month}${day}-${shortId}`, label: `DAILY-${year}${month}${day}-${shortId} (Daily)` },
    ];
  };

  const loadAvailableClaims = async () => {
    try {
      setLoading(true);
      const response = await api.getAvailableClaimsForBatch({});
      const allClaims = response.data || [];
      const filtered = allClaims.filter(c => {
        const type = (c.claim_type || '').toLowerCase();
        const normalized = ['dental', 'oral'].includes(type) ? 'oral' : 
                          ['institutional', 'inpatient', 'daycase'].includes(type) ? 'institutional' : type;
        return normalized === selectedClaimType;
      });
      setAvailableClaims(filtered);
      setSelectedClaims([]);
    } catch (error) {
      console.error('Error loading available claims:', error);
      setAvailableClaims([]);
    } finally {
      setLoading(false);
    }
  };

  const getInsurersFromClaims = () => {
    const insurers = {};
    availableClaims.forEach(c => {
      if (c.insurer_id && c.insurer_name) {
        if (!insurers[c.insurer_id]) {
          insurers[c.insurer_id] = { id: c.insurer_id, name: c.insurer_name, count: 0 };
        }
        insurers[c.insurer_id].count++;
      }
    });
    return Object.values(insurers);
  };

  const getSelectedInsurerId = () => {
    if (selectedClaims.length === 0) return null;
    const firstClaim = availableClaims.find(c => c.id === selectedClaims[0]);
    return firstClaim?.insurer_id || null;
  };

  const handleClaimSelect = (claimId) => {
    setValidationError('');
    setSelectedClaims(prev => {
      if (prev.includes(claimId)) {
        return prev.filter(id => id !== claimId);
      }
      if (prev.length >= 200) {
        setValidationError('Maximum 200 claims per batch');
        return prev;
      }
      const claim = availableClaims.find(c => c.id === claimId);
      if (prev.length > 0) {
        const firstClaim = availableClaims.find(c => c.id === prev[0]);
        if (claim.insurer_id !== firstClaim.insurer_id) {
          setValidationError('All claims in a batch must be for the same insurer');
          return prev;
        }
      }
      return [...prev, claimId];
    });
  };

  const handleSelectAll = () => {
    setValidationError('');
    if (selectedClaims.length > 0 && selectedClaims.length === getFilteredClaimsForSelection().length) {
      setSelectedClaims([]);
    } else {
      const claims = getFilteredClaimsForSelection();
      if (claims.length === 0) return;
      const firstInsurer = claims[0].insurer_id;
      const compatible = claims
        .filter(c => c.insurer_id === firstInsurer)
        .slice(0, 200)
        .map(c => c.id);
      setSelectedClaims(compatible);
    }
  };

  const getFilteredClaimsForSelection = () => {
    const selectedInsurerId = getSelectedInsurerId();
    if (!selectedInsurerId) return availableClaims;
    return availableClaims.filter(c => c.insurer_id === selectedInsurerId);
  };

  const getSelectedTotal = () => {
    return availableClaims
      .filter(c => selectedClaims.includes(c.id))
      .reduce((sum, c) => sum + parseFloat(c.total_amount || 0), 0);
  };

  const getSelectedInsurer = () => {
    if (selectedClaims.length === 0) return null;
    const firstClaim = availableClaims.find(c => c.id === selectedClaims[0]);
    return firstClaim ? { id: firstClaim.insurer_id, name: firstClaim.insurer_name } : null;
  };

  const canProceedStep2 = () => {
    return selectedClaims.length >= 2 && batchForm.batch_identifier;
  };

  const handleCreateBatch = async () => {
    if (selectedClaims.length < 2) {
      setValidationError('Select at least 2 claims for the batch');
      return;
    }

    try {
      setCreateLoading(true);
      setValidationError('');
      const response = await api.createClaimBatch({
        ...batchForm,
        claim_ids: selectedClaims
      });

      if (response.data) {
        navigate(`/claim-batches/${response.data.id}`);
      }
    } catch (error) {
      console.error('Error creating batch:', error);
      setValidationError(error.response?.data?.error || 'Failed to create batch');
    } finally {
      setCreateLoading(false);
    }
  };

  const claimTypeConfig = CLAIM_TYPES.find(t => t.value === selectedClaimType);

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
                Select approved authorization items to submit as a batch claim to NPHIES
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Stepper */}
      <div className="max-w-7xl mx-auto px-6 -mt-4">
        <div className="bg-white rounded-xl shadow-sm border p-4">
          <div className="flex items-center justify-between">
            {STEPS.map((s, idx) => {
              const Icon = s.icon;
              const isActive = step === s.id;
              const isDone = step > s.id;
              return (
                <React.Fragment key={s.id}>
                  {idx > 0 && (
                    <div className={`flex-1 h-0.5 mx-3 rounded ${isDone ? 'bg-primary-purple' : 'bg-gray-200'}`} />
                  )}
                  <div 
                    className={`flex items-center gap-2 cursor-pointer transition-colors ${
                      isActive ? 'text-primary-purple font-semibold' : isDone ? 'text-green-600' : 'text-gray-400'
                    }`}
                    onClick={() => { if (isDone || isActive) setStep(s.id); }}
                  >
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                      isActive ? 'bg-primary-purple text-white' : isDone ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'
                    }`}>
                      {isDone ? <Check className="h-4 w-4" /> : s.id}
                    </div>
                    <span className="hidden md:inline text-sm">{s.label}</span>
                  </div>
                </React.Fragment>
              );
            })}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6">
        {/* Validation Error */}
        {validationError && (
          <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-3 flex items-center gap-2 text-red-700 text-sm">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            {validationError}
          </div>
        )}

        {/* ========== STEP 1: Select Claim Type ========== */}
        {step === 1 && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-primary-purple" />
                  Select Claim Type
                </CardTitle>
                <CardDescription>
                  NPHIES requires all claims in a batch to be of the same type. Choose the type first.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {CLAIM_TYPES.map(type => (
                    <button
                      key={type.value}
                      onClick={() => { setSelectedClaimType(type.value); setSelectedClaims([]); }}
                      className={`p-6 rounded-xl border-2 text-left transition-all ${
                        selectedClaimType === type.value 
                          ? 'border-primary-purple bg-purple-50 ring-2 ring-primary-purple/20' 
                          : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <Badge variant="outline" className={type.color}>
                          {type.label}
                        </Badge>
                        {selectedClaimType === type.value && (
                          <CheckCircle2 className="h-5 w-5 text-primary-purple" />
                        )}
                      </div>
                      <p className="text-sm text-gray-500 mt-1">
                        Select to see available {type.label.toLowerCase()} claims
                      </p>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-end">
              <Button 
                onClick={() => setStep(2)}
                disabled={!selectedClaimType}
                className="bg-gradient-to-r from-primary-purple to-accent-purple"
              >
                Continue
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </div>
        )}

        {/* ========== STEP 2: Select Claims & Configure ========== */}
        {step === 2 && (
          <div className="space-y-6">
            {/* Batch Configuration */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-primary-purple" />
                  Batch Configuration
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
                    >
                      <SelectTrigger className="w-full mt-1 border rounded-md px-3 py-2 text-sm bg-white cursor-pointer hover:bg-gray-50">
                        <SelectValue placeholder="Select batch identifier format" />
                      </SelectTrigger>
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
                      className="mt-1"
                      value={batchForm.description}
                      onChange={(e) => setBatchForm(prev => ({ ...prev, description: e.target.value }))}
                      placeholder="Optional description"
                    />
                  </div>
                  <div>
                    <Label>Period Start</Label>
                    <Input
                      className="mt-1"
                      type="date"
                      value={batchForm.batch_period_start}
                      onChange={(e) => setBatchForm(prev => ({ ...prev, batch_period_start: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label>Period End</Label>
                    <Input
                      className="mt-1"
                      type="date"
                      value={batchForm.batch_period_end}
                      onChange={(e) => setBatchForm(prev => ({ ...prev, batch_period_end: e.target.value }))}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Summary Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card className={`border-2 ${claimTypeConfig?.color?.replace('bg-', 'border-').replace('100', '200') || 'border-gray-200'}`}>
                <CardContent className="p-4 flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">Claim Type</p>
                    <p className="text-lg font-bold">{claimTypeConfig?.label || selectedClaimType}</p>
                  </div>
                  <FileText className="h-7 w-7 text-gray-400" />
                </CardContent>
              </Card>
              <Card className="bg-purple-50 border-purple-200">
                <CardContent className="p-4 flex items-center justify-between">
                  <div>
                    <p className="text-sm text-purple-600">Selected Claims</p>
                    <p className="text-2xl font-bold text-purple-700">{selectedClaims.length} / 200</p>
                  </div>
                  <Users className="h-7 w-7 text-purple-500" />
                </CardContent>
              </Card>
              <Card className="bg-green-50 border-green-200">
                <CardContent className="p-4 flex items-center justify-between">
                  <div>
                    <p className="text-sm text-green-600">Total Amount</p>
                    <p className="text-2xl font-bold text-green-700">SAR {getSelectedTotal().toLocaleString()}</p>
                  </div>
                  <DollarSign className="h-7 w-7 text-green-500" />
                </CardContent>
              </Card>
              <Card className="bg-blue-50 border-blue-200">
                <CardContent className="p-4 flex items-center justify-between">
                  <div>
                    <p className="text-sm text-blue-600">Available</p>
                    <p className="text-2xl font-bold text-blue-700">{availableClaims.length}</p>
                  </div>
                  <Package className="h-7 w-7 text-blue-500" />
                </CardContent>
              </Card>
            </div>

            {/* Insurer info */}
            {getSelectedInsurer() && (
              <Card className="border-amber-200 bg-amber-50">
                <CardContent className="p-3 flex items-center gap-2 text-amber-800 text-sm">
                  <AlertCircle className="h-4 w-4 flex-shrink-0" />
                  Insurer locked to <strong>{getSelectedInsurer().name}</strong> based on your first selection. Only claims for this insurer can be added.
                </CardContent>
              </Card>
            )}

            {/* Selection Controls */}
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-sm">
                    {selectedClaims.length} of {getFilteredClaimsForSelection().length} items selected
                    {selectedClaims.length < 2 && <span className="text-red-500 ml-2">(min 2 required)</span>}
                  </span>
                  <Button variant="outline" size="sm" onClick={handleSelectAll}>
                    {selectedClaims.length > 0 && selectedClaims.length === getFilteredClaimsForSelection().length
                      ? 'Deselect All'
                      : 'Select All (Same Insurer)'}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Claims Table */}
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary-purple mr-3" />
                <span className="text-gray-600">Loading available claims...</span>
              </div>
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle>Available {claimTypeConfig?.label || ''} Authorization Items</CardTitle>
                  <CardDescription>Select approved items to include in the batch claim</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Select</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Auth Request #</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Service</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Patient</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Insurer</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Amount</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {availableClaims.map((item) => {
                          const isDisabled = getSelectedInsurer() && item.insurer_id !== getSelectedInsurer().id;
                          return (
                            <tr 
                              key={item.id} 
                              className={`transition-colors cursor-pointer ${
                                selectedClaims.includes(item.id) ? 'bg-purple-50' : 
                                isDisabled ? 'opacity-40 cursor-not-allowed' : 'hover:bg-gray-50'
                              }`}
                              onClick={() => !isDisabled && handleClaimSelect(item.id)}
                            >
                              <td className="px-4 py-3">
                                <Checkbox 
                                  checked={selectedClaims.includes(item.id)}
                                  onCheckedChange={() => !isDisabled && handleClaimSelect(item.id)}
                                  disabled={isDisabled}
                                />
                              </td>
                              <td className="px-4 py-3 text-sm">
                                <div className="flex flex-col">
                                  <span className="font-medium">{item.auth_request_number}</span>
                                  <span className="text-xs text-gray-400">Item #{item.sequence}</span>
                                </div>
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
                                  Approved
                                </Badge>
                                {item.pre_auth_ref && (
                                  <span className="text-xs text-gray-400 block mt-0.5">
                                    Ref: {item.pre_auth_ref}
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                        {availableClaims.length === 0 && (
                          <tr>
                            <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                              No approved {claimTypeConfig?.label || ''} authorization items available. Submit prior authorizations and get them approved first.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Step Navigation */}
            <div className="flex items-center justify-between">
              <Button variant="outline" onClick={() => setStep(1)}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
              <Button 
                onClick={() => setStep(3)}
                disabled={!canProceedStep2()}
                className="bg-gradient-to-r from-primary-purple to-accent-purple"
              >
                Review
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </div>
        )}

        {/* ========== STEP 3: Review & Create ========== */}
        {step === 3 && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-primary-purple" />
                  Review Batch Claim
                </CardTitle>
                <CardDescription>Review the batch details before creating</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-sm text-gray-500">Batch Identifier</p>
                    <p className="font-semibold text-sm mt-1 break-all">{batchForm.batch_identifier}</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-sm text-gray-500">Claim Type</p>
                    <Badge variant="outline" className={claimTypeConfig?.color || ''}>
                      {claimTypeConfig?.label || selectedClaimType}
                    </Badge>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-sm text-gray-500">Insurer</p>
                    <p className="font-semibold text-sm mt-1">{getSelectedInsurer()?.name || '-'}</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-sm text-gray-500">Period</p>
                    <p className="font-semibold text-sm mt-1">{batchForm.batch_period_start} to {batchForm.batch_period_end}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-6">
                  <Card className="bg-purple-50 border-purple-200">
                    <CardContent className="p-4 text-center">
                      <p className="text-sm text-purple-600">Total Claims</p>
                      <p className="text-3xl font-bold text-purple-700">{selectedClaims.length}</p>
                    </CardContent>
                  </Card>
                  <Card className="bg-green-50 border-green-200">
                    <CardContent className="p-4 text-center">
                      <p className="text-sm text-green-600">Total Amount</p>
                      <p className="text-2xl font-bold text-green-700">SAR {getSelectedTotal().toLocaleString()}</p>
                    </CardContent>
                  </Card>
                  <Card className="bg-blue-50 border-blue-200">
                    <CardContent className="p-4 text-center">
                      <p className="text-sm text-blue-600">NPHIES Action</p>
                      <p className="text-sm font-semibold text-blue-700 mt-1">Validate &rarr; Queue for Insurer</p>
                    </CardContent>
                  </Card>
                </div>

                {batchForm.description && (
                  <div className="mt-4 bg-gray-50 rounded-lg p-4">
                    <p className="text-sm text-gray-500">Description</p>
                    <p className="text-sm mt-1">{batchForm.description}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Selected Claims List */}
            <Card>
              <CardHeader>
                <CardTitle>Selected Claims ({selectedClaims.length})</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 sticky top-0">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">#</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Auth Request</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Service</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Patient</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {selectedClaims.map((claimId, idx) => {
                        const claim = availableClaims.find(c => c.id === claimId);
                        if (!claim) return null;
                        return (
                          <tr key={claimId} className="hover:bg-gray-50">
                            <td className="px-4 py-2 text-sm text-gray-500">{idx + 1}</td>
                            <td className="px-4 py-2 text-sm font-medium">{claim.auth_request_number}-{claim.sequence}</td>
                            <td className="px-4 py-2 text-sm">{claim.product_code}</td>
                            <td className="px-4 py-2 text-sm">{claim.patient_name}</td>
                            <td className="px-4 py-2 text-sm">SAR {parseFloat(claim.total_amount || 0).toLocaleString()}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            {/* Actions */}
            <div className="flex items-center justify-between p-6 bg-white rounded-lg shadow-sm border">
              <Button variant="outline" onClick={() => setStep(2)}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Selection
              </Button>
              <div className="flex items-center gap-3">
                <Button variant="outline" onClick={() => navigate('/claim-batches')}>
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
        )}
      </div>
    </div>
  );
}
