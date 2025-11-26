import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import api from '@/services/api';
import { 
  ArrowLeft, 
  Edit, 
  FileText, 
  User, 
  Stethoscope, 
  Calendar,
  Activity,
  Heart,
  Pill,
  ClipboardList,
  CheckCircle2,
  AlertCircle,
  Building2,
  Shield,
  FileCheck,
  Brain,
  AlertTriangle,
  Phone,
  Mail,
  CreditCard,
  Users,
  Clock,
  Paperclip,
  FileWarning,
  TestTube2,
  MapPin
} from 'lucide-react';
import { format } from 'date-fns';

export default function GeneralRequestDetails() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [loading, setLoading] = useState(true);
  const [requestData, setRequestData] = useState(null);

  useEffect(() => {
    loadRequestData();
  }, [id]);

  const loadRequestData = async () => {
    try {
      setLoading(true);
      const response = await api.getGeneralRequest(id);
      const data = response.data || response;
      setRequestData(data);
    } catch (error) {
      console.error('Error loading request:', error);
      alert('Error loading request data');
      navigate('/general-requests');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      return format(new Date(dateString), 'dd/MM/yyyy');
    } catch {
      return dateString;
    }
  };

  const getStatusBadge = (status) => {
    const variants = {
      'Approved': 'default',
      'Draft': 'secondary',
      'Submitted': 'default',
      'Rejected': 'destructive',
      'Pending': 'outline'
    };
    return <Badge variant={variants[status] || 'outline'} className="text-sm px-3 py-1">{status || 'Draft'}</Badge>;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="relative">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-primary-purple/20"></div>
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-transparent border-t-primary-purple absolute top-0"></div>
        </div>
      </div>
    );
  }

  if (!requestData) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Request not found</p>
        <Button onClick={() => navigate('/general-requests')} className="mt-4">
          Back to List
        </Button>
      </div>
    );
  }

  // Safely parse JSONB fields
  const safeJSONParse = (data, fallback) => {
    try {
      if (!data || data === '' || data === 'null') return fallback;
      if (typeof data === 'string') return JSON.parse(data);
      return data || fallback;
    } catch (e) {
      console.error('JSON parse error:', e);
      return fallback;
    }
  };

  const patientData = safeJSONParse(requestData.patient_data, {});
  const insuredData = safeJSONParse(requestData.insured_data, {});
  const providerData = safeJSONParse(requestData.provider_data, {});
  const coverageData = safeJSONParse(requestData.coverage_data, {});
  const serviceData = safeJSONParse(requestData.service_data, {});
  const managementItems = safeJSONParse(requestData.management_items, []);
  const medications = safeJSONParse(requestData.medications, []);
  const validationResults = safeJSONParse(requestData.validation_results, null);
  const medicationSafetyAnalysis = safeJSONParse(requestData.medication_safety_analysis, null);
  const attachments = safeJSONParse(requestData.attachments, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between print:hidden">
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            onClick={() => navigate('/general-requests')}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              General Request Details
            </h1>
            <p className="text-gray-600 mt-1">View complete request information</p>
          </div>
        </div>
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-8">
          <div className="space-y-6">
            {/* Patient Information */}
            <Card className="border-l-4 border-l-blue-500">
              <CardHeader className="bg-gradient-to-r from-blue-50 to-transparent">
                <div className="flex items-center gap-2">
                  <User className="h-5 w-5 text-blue-600" />
                  <CardTitle className="text-blue-900">Patient Information</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
                  <div>
                    <Label className="text-xs text-gray-500 uppercase tracking-wide">Full Name</Label>
                    <p className="mt-1 text-sm font-semibold text-gray-900">{patientData.fullName || 'N/A'}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-gray-500 uppercase tracking-wide">ID Number</Label>
                    <p className="mt-1 text-sm font-semibold text-gray-900">{patientData.idNumber || 'N/A'}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-gray-500 uppercase tracking-wide">Date of Birth</Label>
                    <p className="mt-1 text-sm font-medium text-gray-700">{formatDate(patientData.dob)}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-gray-500 uppercase tracking-wide">Age</Label>
                    <p className="mt-1 text-sm font-medium text-gray-700">{patientData.age || 'N/A'} years</p>
                  </div>
                  <div>
                    <Label className="text-xs text-gray-500 uppercase tracking-wide">Gender</Label>
                    <p className="mt-1 text-sm font-medium text-gray-700 capitalize">{patientData.gender || 'N/A'}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-gray-500 uppercase tracking-wide">Contact Phone</Label>
                    <p className="mt-1 text-sm font-medium text-gray-700">{patientData.contactPhone || 'N/A'}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Vital Signs */}
            {patientData.vitals && (
              <Card className="border-l-4 border-l-green-500">
                <CardHeader className="bg-gradient-to-r from-green-50 to-transparent">
                  <div className="flex items-center gap-2">
                    <Activity className="h-5 w-5 text-green-600" />
                    <CardTitle className="text-green-900">Vital Signs</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="pt-6">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-gray-50 rounded-lg p-3 text-center">
                      <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">BP</p>
                      <p className="text-lg font-bold text-gray-900">{patientData.vitals.bloodPressure || 'N/A'}</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3 text-center">
                      <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Pulse</p>
                      <p className="text-lg font-bold text-gray-900">{patientData.vitals.pulse || 'N/A'}</p>
                      <p className="text-xs text-gray-500">bpm</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3 text-center">
                      <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Temp</p>
                      <p className="text-lg font-bold text-gray-900">{patientData.vitals.temperature || 'N/A'}</p>
                      <p className="text-xs text-gray-500">°C</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3 text-center">
                      <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Weight</p>
                      <p className="text-lg font-bold text-gray-900">{patientData.vitals.weight || 'N/A'}</p>
                      <p className="text-xs text-gray-500">Kg</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Clinical Information */}
            <Card className="border-l-4 border-l-purple-500">
              <CardHeader className="bg-gradient-to-r from-purple-50 to-transparent">
                <div className="flex items-center gap-2">
                  <Heart className="h-5 w-5 text-purple-600" />
                  <CardTitle className="text-purple-900">Clinical Information</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-6 space-y-4">
                <div>
                  <Label className="text-xs text-gray-500 uppercase tracking-wide">Chief Complaints</Label>
                  <p className="mt-2 text-sm text-gray-700 leading-relaxed bg-gray-50 p-3 rounded-lg">{patientData.chiefComplaints || 'N/A'}</p>
                </div>
                <div className="border-t pt-4">
                  <Label className="text-xs text-gray-500 uppercase tracking-wide">Significant Signs</Label>
                  <p className="mt-2 text-sm text-gray-700 leading-relaxed bg-gray-50 p-3 rounded-lg">{patientData.significantSigns || 'N/A'}</p>
                </div>
                <div className="border-t pt-4">
                  <Label className="text-xs text-gray-500 uppercase tracking-wide">Other Conditions (Allergies, Pre-existing)</Label>
                  <p className="mt-2 text-sm text-gray-700 leading-relaxed bg-gray-50 p-3 rounded-lg">{patientData.otherConditions || 'N/A'}</p>
                </div>
                <div className="border-t pt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label className="text-xs text-gray-500 uppercase tracking-wide">Duration of Illness</Label>
                    <p className="mt-1 text-sm font-medium text-gray-900">{patientData.durationOfIllnessDays ? `${patientData.durationOfIllnessDays} days` : 'N/A'}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-gray-500 uppercase tracking-wide">Marital Status</Label>
                    <p className="mt-1 text-sm font-medium text-gray-900 capitalize">{patientData.maritalStatus || 'N/A'}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-gray-500 uppercase tracking-wide">Plan Type</Label>
                    <p className="mt-1 text-sm font-medium text-gray-900 capitalize">{patientData.planType || 'N/A'}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Provider Information */}
            <Card className="border-l-4 border-l-cyan-500">
              <CardHeader className="bg-gradient-to-r from-cyan-50 to-transparent">
                <div className="flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-cyan-600" />
                  <CardTitle className="text-cyan-900">Provider Information</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
                  <div>
                    <Label className="text-xs text-gray-500 uppercase tracking-wide">Facility Name</Label>
                    <p className="mt-1 text-sm font-semibold text-gray-900">{providerData.facilityName || 'N/A'}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-gray-500 uppercase tracking-wide">Doctor Name</Label>
                    <p className="mt-1 text-sm font-semibold text-gray-900">{providerData.doctorName || 'N/A'}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-gray-500 uppercase tracking-wide">License/NPI Number</Label>
                    <p className="mt-1 text-sm font-medium text-gray-700">{providerData.licenseNumber || 'N/A'}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-gray-500 uppercase tracking-wide">Department</Label>
                    <p className="mt-1 text-sm font-medium text-gray-700">{providerData.department || 'N/A'}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-gray-500 uppercase tracking-wide flex items-center gap-1">
                      <Phone className="h-3 w-3" />
                      Contact Phone
                    </Label>
                    <p className="mt-1 text-sm font-medium text-gray-700">{providerData.contactPhone || 'N/A'}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-gray-500 uppercase tracking-wide flex items-center gap-1">
                      <Mail className="h-3 w-3" />
                      Email
                    </Label>
                    <p className="mt-1 text-sm font-medium text-gray-700">{providerData.email || 'N/A'}</p>
                  </div>
                </div>
                <div className="border-t mt-4 pt-4">
                  <Label className="text-xs text-gray-500 uppercase tracking-wide mb-3 block">Approval & Signature</Label>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <Label className="text-xs text-gray-500">Completed/Coded By</Label>
                      <p className="mt-1 text-sm font-medium text-gray-700">{providerData.completedCodedBy || 'N/A'}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-gray-500">Signature</Label>
                      <p className="mt-1 text-sm font-medium text-gray-700">{providerData.signature || 'N/A'}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-gray-500">Date</Label>
                      <p className="mt-1 text-sm font-medium text-gray-700">{formatDate(providerData.date)}</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Insurance & Coverage */}
            <Card className="border-l-4 border-l-orange-500">
              <CardHeader className="bg-gradient-to-r from-orange-50 to-transparent">
                <div className="flex items-center gap-2">
                  <Shield className="h-5 w-5 text-orange-600" />
                  <CardTitle className="text-orange-900">Insurance & Coverage</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
                  <div>
                    <Label className="text-xs text-gray-500 uppercase tracking-wide">Insurer</Label>
                    <p className="mt-1 text-sm font-semibold text-gray-900">{coverageData.insurer || 'N/A'}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-gray-500 uppercase tracking-wide flex items-center gap-1">
                      <CreditCard className="h-3 w-3" />
                      Policy Number
                    </Label>
                    <p className="mt-1 text-sm font-semibold text-gray-900">{coverageData.policyNumber || 'N/A'}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-gray-500 uppercase tracking-wide">Coverage Type</Label>
                    <p className="mt-1 text-sm font-medium text-gray-700 capitalize">{coverageData.coverageType || 'N/A'}</p>
                  </div>
                  {coverageData.tpaCompanyName && (
                    <div>
                      <Label className="text-xs text-gray-500 uppercase tracking-wide">TPA Company</Label>
                      <p className="mt-1 text-sm font-medium text-gray-700">{coverageData.tpaCompanyName}</p>
                    </div>
                  )}
                  <div>
                    <Label className="text-xs text-gray-500 uppercase tracking-wide">Policy Holder</Label>
                    <p className="mt-1 text-sm font-medium text-gray-700">{coverageData.policyHolder || 'N/A'}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-gray-500 uppercase tracking-wide">Expiry Date</Label>
                    <p className="mt-1 text-sm font-medium text-gray-700">{formatDate(coverageData.expiryDate)}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-gray-500 uppercase tracking-wide">Contact Person</Label>
                    <p className="mt-1 text-sm font-medium text-gray-700">{coverageData.contactPerson || 'N/A'}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-gray-500 uppercase tracking-wide flex items-center gap-1">
                      <Phone className="h-3 w-3" />
                      Phone
                    </Label>
                    <p className="mt-1 text-sm font-medium text-gray-700">{coverageData.phone || 'N/A'}</p>
                  </div>
                </div>
                {coverageData.approvalField && (
                  <div className="border-t mt-4 pt-4">
                    <Label className="text-xs text-gray-500 uppercase tracking-wide">Approval Field</Label>
                    <p className="mt-2 text-sm text-gray-700 leading-relaxed bg-gray-50 p-3 rounded-lg">{coverageData.approvalField}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Insured Person Details */}
            {(insuredData.name || insuredData.idCardNumber) && (
              <Card className="border-l-4 border-l-teal-500">
                <CardHeader className="bg-gradient-to-r from-teal-50 to-transparent">
                  <div className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-teal-600" />
                    <CardTitle className="text-teal-900">Insured Person Details</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="pt-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
                    <div>
                      <Label className="text-xs text-gray-500 uppercase tracking-wide">Insured Name</Label>
                      <p className="mt-1 text-sm font-semibold text-gray-900">{insuredData.name || 'N/A'}</p>
                      <p className="text-xs text-gray-500 mt-1">If different from patient</p>
                    </div>
                    <div>
                      <Label className="text-xs text-gray-500 uppercase tracking-wide">ID Card Number</Label>
                      <p className="mt-1 text-sm font-medium text-gray-700">{insuredData.idCardNumber || 'N/A'}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Encounter Details */}
            {(requestData.encounter_class || requestData.encounter_start || requestData.encounter_end) && (
              <Card className="border-l-4 border-l-indigo-500">
                <CardHeader className="bg-gradient-to-r from-indigo-50 to-transparent">
                  <div className="flex items-center gap-2">
                    <Clock className="h-5 w-5 text-indigo-600" />
                    <CardTitle className="text-indigo-900">Encounter Details</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="pt-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-x-8 gap-y-4">
                    <div>
                      <Label className="text-xs text-gray-500 uppercase tracking-wide">Encounter Class</Label>
                      <p className="mt-1 text-sm font-semibold text-gray-900 capitalize">{requestData.encounter_class || 'N/A'}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-gray-500 uppercase tracking-wide">Start Date</Label>
                      <p className="mt-1 text-sm font-medium text-gray-700">{formatDate(requestData.encounter_start)}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-gray-500 uppercase tracking-wide">End Date</Label>
                      <p className="mt-1 text-sm font-medium text-gray-700">{formatDate(requestData.encounter_end)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Complete Service Details */}
            <Card className="border-l-4 border-l-purple-500">
              <CardHeader className="bg-gradient-to-r from-purple-50 to-transparent">
                <div className="flex items-center gap-2">
                  <Stethoscope className="h-5 w-5 text-purple-600" />
                  <CardTitle className="text-purple-900">Complete Service Details</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-6 space-y-4">
                <div>
                  <Label className="text-xs text-gray-500 uppercase tracking-wide">Service Description</Label>
                  <p className="mt-2 text-sm text-gray-700 leading-relaxed bg-gray-50 p-3 rounded-lg">{serviceData.description || 'N/A'}</p>
                </div>
                <div className="border-t pt-4">
                  <Label className="text-xs text-gray-500 uppercase tracking-wide">Diagnosis</Label>
                  <p className="mt-2 text-sm font-semibold text-gray-900 leading-relaxed bg-gray-50 p-3 rounded-lg">{serviceData.diagnosis || 'N/A'}</p>
                </div>
                <div className="border-t pt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs text-gray-500 uppercase tracking-wide">Previous Tests</Label>
                    <p className="mt-2 text-sm text-gray-700 leading-relaxed">{serviceData.previousTest || 'N/A'}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-gray-500 uppercase tracking-wide">Test Results</Label>
                    <p className="mt-2 text-sm text-gray-700 leading-relaxed">{serviceData.testResults || 'N/A'}</p>
                  </div>
                </div>
                <div className="border-t pt-4">
                  <Label className="text-xs text-gray-500 uppercase tracking-wide">Medical Plan</Label>
                  <p className="mt-2 text-sm text-gray-700 leading-relaxed bg-gray-50 p-3 rounded-lg">{serviceData.medicalPlan || 'N/A'}</p>
                </div>
                <div className="border-t pt-4 grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <Label className="text-xs text-gray-500 uppercase tracking-wide">Start Date</Label>
                    <p className="mt-1 text-sm font-medium text-gray-900">{formatDate(serviceData.startDate)}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-gray-500 uppercase tracking-wide">Urgency</Label>
                    <Badge variant={serviceData.urgency === 'emergency' ? 'destructive' : 'outline'} className="mt-1">
                      {serviceData.urgency || 'N/A'}
                    </Badge>
                  </div>
                  <div>
                    <Label className="text-xs text-gray-500 uppercase tracking-wide">Visit Type</Label>
                    <p className="mt-1 text-sm font-medium text-gray-900 capitalize">{serviceData.visitType || 'N/A'}</p>
                  </div>
                  {serviceData.emergencyCase && (
                    <div>
                      <Label className="text-xs text-gray-500 uppercase tracking-wide">Emergency Level</Label>
                      <Badge variant="destructive" className="mt-1">Level {serviceData.emergencyCareLevel || 'N/A'}</Badge>
                    </div>
                  )}
                </div>
                {(serviceData.bodyPart || serviceData.laterality) && (
                  <div className="border-t pt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-xs text-gray-500 uppercase tracking-wide flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        Body Part
                      </Label>
                      <p className="mt-1 text-sm font-medium text-gray-900">{serviceData.bodyPart || 'N/A'}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-gray-500 uppercase tracking-wide">Laterality</Label>
                      <p className="mt-1 text-sm font-medium text-gray-900 capitalize">{serviceData.laterality || 'N/A'}</p>
                    </div>
                  </div>
                )}
                {(serviceData.cptCodes && serviceData.cptCodes.length > 0) && (
                  <div className="border-t pt-4">
                    <Label className="text-xs text-gray-500 uppercase tracking-wide mb-2 block">CPT Codes</Label>
                    <div className="flex flex-wrap gap-2">
                      {serviceData.cptCodes.map((code, idx) => (
                        <Badge key={idx} variant="outline" className="font-mono">{code}</Badge>
                      ))}
                    </div>
                  </div>
                )}
                {(serviceData.icd10Codes && serviceData.icd10Codes.length > 0) && (
                  <div className="border-t pt-4">
                    <Label className="text-xs text-gray-500 uppercase tracking-wide mb-2 block">ICD-10 Codes</Label>
                    <div className="flex flex-wrap gap-2">
                      {serviceData.icd10Codes.map((code, idx) => (
                        <Badge key={idx} variant="outline" className="font-mono">{code}</Badge>
                      ))}
                    </div>
                  </div>
                )}
                {(serviceData.principalCode || serviceData.secondCode || serviceData.thirdCode || serviceData.fourthCode) && (
                  <div className="border-t pt-4 grid grid-cols-2 md:grid-cols-4 gap-4">
                    {serviceData.principalCode && (
                      <div>
                        <Label className="text-xs text-gray-500">Principal Code</Label>
                        <p className="mt-1 text-sm font-mono font-medium text-gray-900">{serviceData.principalCode}</p>
                      </div>
                    )}
                    {serviceData.secondCode && (
                      <div>
                        <Label className="text-xs text-gray-500">Second Code</Label>
                        <p className="mt-1 text-sm font-mono font-medium text-gray-900">{serviceData.secondCode}</p>
                      </div>
                    )}
                    {serviceData.thirdCode && (
                      <div>
                        <Label className="text-xs text-gray-500">Third Code</Label>
                        <p className="mt-1 text-sm font-mono font-medium text-gray-900">{serviceData.thirdCode}</p>
                      </div>
                    )}
                    {serviceData.fourthCode && (
                      <div>
                        <Label className="text-xs text-gray-500">Fourth Code</Label>
                        <p className="mt-1 text-sm font-mono font-medium text-gray-900">{serviceData.fourthCode}</p>
                      </div>
                    )}
                  </div>
                )}
                {serviceData.conditions && (
                  <div className="border-t pt-4">
                    <Label className="text-xs text-gray-500 uppercase tracking-wide mb-3 block">Conditions</Label>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                      {serviceData.conditions.chronic && <Badge variant="outline" className="justify-center">Chronic</Badge>}
                      {serviceData.conditions.congenital && <Badge variant="outline" className="justify-center">Congenital</Badge>}
                      {serviceData.conditions.rta && <Badge variant="outline" className="justify-center">RTA</Badge>}
                      {serviceData.conditions.workRelated && <Badge variant="outline" className="justify-center">Work-Related</Badge>}
                      {serviceData.conditions.vaccination && <Badge variant="outline" className="justify-center">Vaccination</Badge>}
                      {serviceData.conditions.checkUp && <Badge variant="outline" className="justify-center">Check-Up</Badge>}
                      {serviceData.conditions.psychiatric && <Badge variant="outline" className="justify-center">Psychiatric</Badge>}
                      {serviceData.conditions.infertility && <Badge variant="outline" className="justify-center">Infertility</Badge>}
                      {serviceData.conditions.pregnancy && <Badge variant="outline" className="justify-center">Pregnancy</Badge>}
                    </div>
                  </div>
                )}
                {(serviceData.caseManagementFormIncluded || serviceData.possibleLineOfManagement || serviceData.estimatedLengthOfStayDays || serviceData.expectedDateOfAdmission) && (
                  <div className="border-t pt-4 space-y-3">
                    <Label className="text-xs text-gray-500 uppercase tracking-wide block">Case Management</Label>
                    {serviceData.caseManagementFormIncluded && (
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                        <span className="text-sm text-gray-700">Case Management Form Included</span>
                      </div>
                    )}
                    {serviceData.possibleLineOfManagement && (
                      <div>
                        <Label className="text-xs text-gray-500">Possible Line of Management</Label>
                        <p className="mt-1 text-sm text-gray-700">{serviceData.possibleLineOfManagement}</p>
                      </div>
                    )}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {serviceData.estimatedLengthOfStayDays && (
                        <div>
                          <Label className="text-xs text-gray-500">Estimated Length of Stay</Label>
                          <p className="mt-1 text-sm font-medium text-gray-900">{serviceData.estimatedLengthOfStayDays} days</p>
                        </div>
                      )}
                      {serviceData.expectedDateOfAdmission && (
                        <div>
                          <Label className="text-xs text-gray-500">Expected Date of Admission</Label>
                          <p className="mt-1 text-sm font-medium text-gray-900">{formatDate(serviceData.expectedDateOfAdmission)}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Management Items */}
            <Card className="border-l-4 border-l-blue-500">
              <CardHeader className="bg-gradient-to-r from-blue-50 to-transparent">
                <div className="flex items-center gap-2">
                  <ClipboardList className="h-5 w-5 text-blue-600" />
                  <CardTitle className="text-blue-900">Management Items</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-6">
                {managementItems && managementItems.length > 0 ? (
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-gray-50">
                          <TableHead className="font-semibold">Code</TableHead>
                          <TableHead className="font-semibold">Description</TableHead>
                          <TableHead className="font-semibold">Type</TableHead>
                          <TableHead className="font-semibold text-right">Quantity</TableHead>
                          <TableHead className="font-semibold text-right">Cost</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {managementItems.map((item, index) => (
                          <TableRow key={index} className="hover:bg-gray-50">
                            <TableCell className="font-medium">{item.code || 'N/A'}</TableCell>
                            <TableCell>{item.description || 'N/A'}</TableCell>
                            <TableCell>{item.type || 'N/A'}</TableCell>
                            <TableCell className="text-right">{item.quantity || 'N/A'}</TableCell>
                            <TableCell className="text-right font-semibold">
                              {item.cost ? `$${item.cost}` : 'N/A'}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="text-center py-8 bg-gray-50 rounded-lg">
                    <ClipboardList className="h-12 w-12 text-gray-300 mx-auto mb-2" />
                    <p className="text-gray-500 text-sm">No management items</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Medications */}
            <Card className="border-l-4 border-l-green-500">
              <CardHeader className="bg-gradient-to-r from-green-50 to-transparent">
                <div className="flex items-center gap-2">
                  <Pill className="h-5 w-5 text-green-600" />
                  <CardTitle className="text-green-900">Medications</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-6">
                {medications && medications.length > 0 ? (
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-gray-50">
                          <TableHead className="font-semibold">Medication Name</TableHead>
                          <TableHead className="font-semibold">Type</TableHead>
                          <TableHead className="font-semibold text-right">Quantity</TableHead>
                          <TableHead className="font-semibold">Warnings</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {medications.map((med, index) => (
                          <TableRow key={index} className="hover:bg-gray-50">
                            <TableCell className="font-medium">{med.medicationName || 'N/A'}</TableCell>
                            <TableCell>{med.type || 'N/A'}</TableCell>
                            <TableCell className="text-right">{med.quantity || 'N/A'}</TableCell>
                            <TableCell>
                              <div className="flex gap-1">
                                {med.hasInteractions && <Badge variant="destructive" className="text-xs">Interactions</Badge>}
                                {med.hasSideEffects && <Badge variant="outline" className="text-xs">Side Effects</Badge>}
                                {med.hasAgeWarning && <Badge variant="outline" className="text-xs">Age Warning</Badge>}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="text-center py-8 bg-gray-50 rounded-lg">
                    <Pill className="h-12 w-12 text-gray-300 mx-auto mb-2" />
                    <p className="text-gray-500 text-sm">No medications</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Medication Safety Analysis */}
            {medicationSafetyAnalysis && (
              <Card className="border-l-4 border-l-red-500">
                <CardHeader className="bg-gradient-to-r from-red-50 to-transparent">
                  <div className="flex items-center gap-2">
                    <FileWarning className="h-5 w-5 text-red-600" />
                    <CardTitle className="text-red-900">Medication Safety Analysis</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="pt-6 space-y-4">
                  {/* Overall Risk Assessment */}
                  {medicationSafetyAnalysis.overallRisk && (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                      <Label className="text-xs text-gray-700 uppercase tracking-wide font-semibold mb-2 block">Overall Risk Level</Label>
                      <Badge variant={medicationSafetyAnalysis.overallRisk === 'high' ? 'destructive' : medicationSafetyAnalysis.overallRisk === 'medium' ? 'outline' : 'default'} className="text-sm">
                        {medicationSafetyAnalysis.overallRisk.toUpperCase()}
                      </Badge>
                    </div>
                  )}

                  {/* Drug Interactions */}
                  {medicationSafetyAnalysis.interactions && medicationSafetyAnalysis.interactions.length > 0 && (
                    <div className="border-t pt-4">
                      <Label className="text-xs text-gray-500 uppercase tracking-wide mb-3 block">Drug Interactions</Label>
                      <div className="space-y-3">
                        {medicationSafetyAnalysis.interactions.map((interaction, idx) => (
                          <div key={idx} className="bg-red-50 border border-red-200 rounded-lg p-3">
                            <div className="flex items-start gap-2">
                              <AlertTriangle className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
                              <div className="flex-1">
                                <p className="text-sm font-semibold text-gray-900 mb-1">
                                  {interaction.drug1} + {interaction.drug2}
                                </p>
                                <p className="text-xs text-gray-700">{interaction.description || interaction.severity}</p>
                                {interaction.severity && (
                                  <Badge variant="destructive" className="text-xs mt-2">{interaction.severity}</Badge>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Side Effects */}
                  {medicationSafetyAnalysis.sideEffects && medicationSafetyAnalysis.sideEffects.length > 0 && (
                    <div className="border-t pt-4">
                      <Label className="text-xs text-gray-500 uppercase tracking-wide mb-3 block">Side Effects by Medication</Label>
                      <div className="space-y-2">
                        {medicationSafetyAnalysis.sideEffects.map((item, idx) => (
                          <div key={idx} className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                            <p className="text-sm font-semibold text-gray-900 mb-1">{item.medication}</p>
                            <div className="flex flex-wrap gap-1 mt-2">
                              {(Array.isArray(item.effects) ? item.effects : [item.effects]).map((effect, i) => (
                                <Badge key={i} variant="outline" className="text-xs">{effect}</Badge>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Age Warnings */}
                  {medicationSafetyAnalysis.ageWarnings && medicationSafetyAnalysis.ageWarnings.length > 0 && (
                    <div className="border-t pt-4">
                      <Label className="text-xs text-gray-500 uppercase tracking-wide mb-3 block">Age-Related Warnings</Label>
                      <div className="space-y-2">
                        {medicationSafetyAnalysis.ageWarnings.map((warning, idx) => (
                          <div key={idx} className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                            <div className="flex items-start gap-2">
                              <AlertCircle className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                              <div className="flex-1">
                                <p className="text-sm font-semibold text-gray-900">{warning.medication}</p>
                                <p className="text-xs text-gray-700 mt-1">{warning.warning || warning.message}</p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Pregnancy/Lactation Warnings */}
                  {medicationSafetyAnalysis.pregnancyWarnings && medicationSafetyAnalysis.pregnancyWarnings.length > 0 && (
                    <div className="border-t pt-4">
                      <Label className="text-xs text-gray-500 uppercase tracking-wide mb-3 block">Pregnancy/Lactation Warnings</Label>
                      <div className="space-y-2">
                        {medicationSafetyAnalysis.pregnancyWarnings.map((warning, idx) => (
                          <div key={idx} className="bg-pink-50 border border-pink-200 rounded-lg p-3">
                            <div className="flex items-start gap-2">
                              <AlertTriangle className="h-4 w-4 text-pink-600 mt-0.5 flex-shrink-0" />
                              <div className="flex-1">
                                <p className="text-sm font-semibold text-gray-900">{warning.medication}</p>
                                <p className="text-xs text-gray-700 mt-1">{warning.warning || warning.message}</p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Duplicate Therapy */}
                  {medicationSafetyAnalysis.duplicates && medicationSafetyAnalysis.duplicates.length > 0 && (
                    <div className="border-t pt-4">
                      <Label className="text-xs text-gray-500 uppercase tracking-wide mb-3 block">Duplicate Therapy Alerts</Label>
                      <div className="space-y-2">
                        {medicationSafetyAnalysis.duplicates.map((dup, idx) => (
                          <div key={idx} className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                            <div className="flex items-start gap-2">
                              <AlertCircle className="h-4 w-4 text-yellow-600 mt-0.5 flex-shrink-0" />
                              <div className="flex-1">
                                <p className="text-sm text-gray-900">
                                  <span className="font-semibold">{dup.medication1}</span> and <span className="font-semibold">{dup.medication2}</span>
                                </p>
                                <p className="text-xs text-gray-700 mt-1">{dup.reason || 'Similar therapeutic effect'}</p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Recommendations */}
                  {medicationSafetyAnalysis.recommendations && medicationSafetyAnalysis.recommendations.length > 0 && (
                    <div className="border-t pt-4">
                      <Label className="text-xs text-gray-500 uppercase tracking-wide mb-3 block">Recommendations</Label>
                      <div className="bg-green-50 border border-green-200 rounded-lg p-4 space-y-2">
                        {medicationSafetyAnalysis.recommendations.map((rec, idx) => (
                          <div key={idx} className="flex items-start gap-2">
                            <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                            <p className="text-sm text-gray-700">{rec}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Summary/Notes */}
                  {medicationSafetyAnalysis.summary && (
                    <div className="border-t pt-4">
                      <Label className="text-xs text-gray-500 uppercase tracking-wide mb-2 block">Summary</Label>
                      <p className="text-sm text-gray-700 leading-relaxed bg-gray-50 p-3 rounded-lg">{medicationSafetyAnalysis.summary}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Attachments */}
            {attachments && attachments.length > 0 && (
              <Card className="border-l-4 border-l-gray-500">
                <CardHeader className="bg-gradient-to-r from-gray-50 to-transparent">
                  <div className="flex items-center gap-2">
                    <Paperclip className="h-5 w-5 text-gray-600" />
                    <CardTitle className="text-gray-900">Attachments</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="pt-6">
                  <div className="space-y-2">
                    {attachments.map((attachment, idx) => (
                      <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200 hover:bg-gray-100 transition">
                        <div className="flex items-center gap-3 flex-1">
                          <FileText className="h-5 w-5 text-gray-500 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">{attachment.name || attachment.filename || `Attachment ${idx + 1}`}</p>
                            <div className="flex items-center gap-3 text-xs text-gray-500 mt-1">
                              {attachment.size && <span>{(attachment.size / 1024).toFixed(2)} KB</span>}
                              {attachment.type && <span>{attachment.type}</span>}
                              {attachment.uploadedAt && <span>{formatDate(attachment.uploadedAt)}</span>}
                            </div>
                          </div>
                        </div>
                        {attachment.url && (
                          <Button variant="outline" size="sm" asChild>
                            <a href={attachment.url} download target="_blank" rel="noopener noreferrer">
                              Download
                            </a>
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* AI Validation Results */}
            {validationResults && (
              <Card className="border-l-4 border-l-orange-500">
                <CardHeader className="bg-gradient-to-r from-orange-50 to-transparent">
                  <div className="flex items-center gap-2">
                    <Brain className="h-5 w-5 text-orange-600" />
                    <CardTitle className="text-orange-900">AI Validation Results</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="pt-6 space-y-4">
                  {/* Traditional Validation */}
                  {validationResults.traditional && (
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
                        <FileCheck className="h-4 w-4" />
                        Traditional Validation
                      </h3>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-600">Fit Status:</span>
                          <Badge variant={validationResults.traditional.fit ? 'default' : 'destructive'}>
                            {validationResults.traditional.fit ? 'Fits' : 'Does Not Fit'}
                          </Badge>
                        </div>
                        {validationResults.traditional.requiresPrerequisites && (
                          <div>
                            <span className="text-gray-600 block mb-1">Prerequisites Required:</span>
                            <p className="text-gray-900 bg-white p-2 rounded border">
                              {validationResults.traditional.prerequisitesNeeded || 'N/A'}
                            </p>
                          </div>
                        )}
                        {validationResults.traditional.diagnoses && validationResults.traditional.diagnoses.length > 0 && (
                          <div>
                            <span className="text-gray-600 block mb-1">Suggested Diagnoses:</span>
                            <div className="flex flex-wrap gap-1">
                              {validationResults.traditional.diagnoses.map((diag, idx) => (
                                <Badge key={idx} variant="outline" className="text-xs">{diag}</Badge>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* AI Enhanced Validation */}
                  {validationResults.aiEnhanced && (
                    <div className="bg-purple-50 p-4 rounded-lg">
                      <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
                        <Brain className="h-4 w-4" />
                        AI-Enhanced Analysis
                      </h3>
                      
                      {/* Critical Prerequisites */}
                      {validationResults.aiEnhanced.criticalPrerequisites && validationResults.aiEnhanced.criticalPrerequisites.length > 0 && (
                        <div className="mb-3">
                          <span className="text-gray-600 text-sm block mb-2">Critical Prerequisites:</span>
                          <div className="space-y-2">
                            {validationResults.aiEnhanced.criticalPrerequisites.map((prereq, idx) => (
                              <div key={idx} className="flex items-start gap-2 bg-white p-2 rounded border border-orange-200">
                                <AlertTriangle className="h-4 w-4 text-orange-600 mt-0.5 flex-shrink-0" />
                                <span className="text-sm text-gray-900">{prereq}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Prerequisite Chain */}
                      {validationResults.aiEnhanced.prerequisiteChain && validationResults.aiEnhanced.prerequisiteChain.length > 0 && (
                        <div>
                          <span className="text-gray-600 text-sm block mb-2">Prerequisite Chain:</span>
                          <div className="space-y-2">
                            {validationResults.aiEnhanced.prerequisiteChain.map((item, idx) => (
                              <div key={idx} className="bg-white p-3 rounded border">
                                <div className="font-medium text-sm text-gray-900 mb-1">
                                  {typeof item === 'string' ? item : item.test || item.name || 'Prerequisite'}
                                </div>
                                {typeof item === 'object' && item.reason && (
                                  <p className="text-xs text-gray-600">{item.reason}</p>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Justification */}
                  {requestData.prerequisite_justification && (
                    <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
                      <h3 className="font-semibold text-sm mb-2 flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        Provider Justification
                      </h3>
                      <p className="text-sm text-gray-700">{requestData.prerequisite_justification}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="lg:col-span-4">
          <div className="lg:sticky lg:top-6 space-y-4">
            {/* Summary Card */}
            <Card className="border-l-4 border-l-primary-purple">
              <CardHeader className="bg-gradient-to-r from-primary-purple/5 to-transparent pb-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">Request Summary</CardTitle>
                  <FileText className="h-5 w-5 text-primary-purple" />
                </div>
              </CardHeader>
              <CardContent className="space-y-4 pt-6">
                <div>
                  <Label className="text-xs text-gray-500 uppercase tracking-wide">Form Number</Label>
                  <p className="text-xl font-bold text-gray-900 mt-1">{requestData.form_number || 'N/A'}</p>
                </div>
                
                <div className="flex items-center justify-between pt-2 border-t">
                  <Label className="text-xs text-gray-500 uppercase tracking-wide">Status</Label>
                  {getStatusBadge(requestData.status)}
                </div>

                <div className="pt-2 border-t">
                  <Label className="text-xs text-gray-500 uppercase tracking-wide mb-2 block">Key Information</Label>
                  <div className="space-y-3">
                    <div className="flex items-start gap-2">
                      <User className="h-4 w-4 text-accent-cyan mt-0.5 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-gray-500">Patient</p>
                        <p className="text-sm font-medium text-gray-900 truncate">{patientData.fullName || 'N/A'}</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <Calendar className="h-4 w-4 text-accent-purple mt-0.5 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-gray-500">Created</p>
                        <p className="text-sm font-medium text-gray-900">{formatDate(requestData.created_at)}</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t">
                  <Label className="text-xs text-gray-500 uppercase tracking-wide mb-3 block">Quick Stats</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-blue-50 rounded-lg p-3 text-center">
                      <ClipboardList className="h-5 w-5 text-blue-600 mx-auto mb-1" />
                      <p className="text-lg font-bold text-blue-600">{managementItems?.length || 0}</p>
                      <p className="text-xs text-gray-600">Items</p>
                    </div>
                    <div className="bg-green-50 rounded-lg p-3 text-center">
                      <Pill className="h-5 w-5 text-green-600 mx-auto mb-1" />
                      <p className="text-lg font-bold text-green-600">{medications?.length || 0}</p>
                      <p className="text-xs text-gray-600">Meds</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Action Buttons */}
            <Card>
              <CardContent className="p-4 space-y-2">
                <Button
                  onClick={() => navigate(`/general-requests/${id}/edit`)}
                  className="w-full bg-gradient-to-r from-primary-purple to-accent-purple hover:opacity-90"
                >
                  <Edit className="h-4 w-4 mr-2" />
                  Edit Request
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

