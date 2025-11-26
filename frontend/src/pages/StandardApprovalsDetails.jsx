import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
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
  Printer,
  Download,
  Activity,
  Heart,
  Pill,
  ClipboardList,
  CheckCircle2,
  AlertCircle,
  Building2,
  Shield,
  FileCheck
} from 'lucide-react';
import { format } from 'date-fns';

export default function StandardApprovalsDetails() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState(null);
  const [exportingPDF, setExportingPDF] = useState(false);
  const printRef = useRef();

  useEffect(() => {
    loadFormData();
  }, [id]);

  const loadFormData = async () => {
    try {
      setLoading(true);
      const response = await api.getStandardApproval(id);
      const data = response.data || response;
      
      // Remove join fields
      const { patient_name, insurer_name, provider_name_joined, ...formFields } = data;
      
      setFormData({
        ...formFields,
        management_items: data.management_items || [],
        medications: data.medications || []
      });
    } catch (error) {
      console.error('Error loading form:', error);
      alert('Error loading form data');
      navigate('/standard-approvals');
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

  const handlePrint = () => {
    window.print();
  };

  const handleExportPDF = async () => {
    if (!printRef.current || exportingPDF) return;
    
    setExportingPDF(true);
    try {
      const element = printRef.current;
      
      // Temporarily show the element for capture (it's hidden by default)
      element.classList.remove('hidden');
      element.classList.add('pdf-export');
      
      // Wait a bit for the element to render
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
      });
      
      // Hide the element again and remove PDF export class
      element.classList.add('hidden');
      element.classList.remove('pdf-export');
      
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;
      
      // Calculate dimensions to fit the page
      const ratio = imgWidth / imgHeight;
      let finalWidth = pdfWidth - 20; // 10mm margin on each side
      let finalHeight = finalWidth / ratio;
      
      // If height is too large, scale based on height instead
      if (finalHeight > pdfHeight - 20) {
        finalHeight = pdfHeight - 20;
        finalWidth = finalHeight * ratio;
      }
      
      const imgX = (pdfWidth - finalWidth) / 2;
      const imgY = 10;
      
      pdf.addImage(imgData, 'PNG', imgX, imgY, finalWidth, finalHeight);
      pdf.save(`StandardApproval_${formData?.form_number || 'Form'}_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Error generating PDF. Please try again.');
    } finally {
      setExportingPDF(false);
    }
  };

  const countConditions = () => {
    if (!formData) return 0;
    const conditions = ['chronic', 'congenital', 'rta', 'work_related', 'vaccination', 'check_up', 'psychiatric', 'infertility', 'pregnancy'];
    return conditions.filter(c => formData[c]).length;
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

  if (!formData) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Form not found</p>
        <Button onClick={() => navigate('/standard-approvals')} className="mt-4">
          Back to List
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header - Not printed */}
      <div className="flex items-center justify-between print:hidden">
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            onClick={() => navigate('/standard-approvals')}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Standard Approval Form
            </h1>
            <p className="text-gray-600 mt-1">View complete form details</p>
          </div>
        </div>
      </div>

      {/* Two Column Layout - Screen View Only */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 print:hidden">
       
        {/* Right Content - Details (70%) */}
        <div className="lg:col-span-8">
          <div className="space-y-6">
            {/* Print Header - Only visible when printing */}
            <div className="hidden print:block border-b-2 border-primary-purple pb-4 mb-6">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">Standard Approval Form</h1>
                  <p className="text-sm text-gray-600 mt-1">Form Number: {formData.form_number || 'N/A'}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-600">Date: {formatDate(new Date())}</p>
                  {getStatusBadge(formData.status)}
                </div>
              </div>
            </div>

            {/* Provider & Visit Information */}
            <Card className="border-l-4 border-l-blue-500 print:break-inside-avoid">
              <CardHeader className="bg-gradient-to-r from-blue-50 to-transparent">
                <div className="flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-blue-600" />
                  <CardTitle className="text-blue-900">Provider & Visit Information</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
                  <div>
                    <Label className="text-xs text-gray-500 uppercase tracking-wide">Provider Name</Label>
                    <p className="mt-1 text-sm font-semibold text-gray-900">{formData.provider_name || 'N/A'}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-gray-500 uppercase tracking-wide">Insurance Company</Label>
                    <p className="mt-1 text-sm font-semibold text-gray-900">{formData.insurance_company_name || 'N/A'}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-gray-500 uppercase tracking-wide">TPA Company</Label>
                    <p className="mt-1 text-sm font-medium text-gray-700">{formData.tpa_company_name || 'N/A'}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-gray-500 uppercase tracking-wide">Patient File Number</Label>
                    <p className="mt-1 text-sm font-medium text-gray-700">{formData.patient_file_number || 'N/A'}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-gray-500 uppercase tracking-wide">Department</Label>
                    <p className="mt-1 text-sm font-medium text-gray-700">{formData.department || 'N/A'}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-gray-500 uppercase tracking-wide">Marital Status</Label>
                    <p className="mt-1 text-sm font-medium text-gray-700">{formData.marital_status || 'N/A'}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-gray-500 uppercase tracking-wide">Plan Type</Label>
                    <p className="mt-1 text-sm font-medium text-gray-700">{formData.plan_type || 'N/A'}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-gray-500 uppercase tracking-wide">Date of Visit</Label>
                    <p className="mt-1 text-sm font-semibold text-gray-900">{formatDate(formData.date_of_visit)}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-gray-500 uppercase tracking-wide">Visit Type</Label>
                    <p className="mt-1 text-sm font-medium text-gray-700">{formData.visit_type || 'N/A'}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Insured Information */}
            <Card className="border-l-4 border-l-cyan-500 print:break-inside-avoid">
              <CardHeader className="bg-gradient-to-r from-cyan-50 to-transparent">
                <div className="flex items-center gap-2">
                  <User className="h-5 w-5 text-cyan-600" />
                  <CardTitle className="text-cyan-900">Insured Information</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
                  <div>
                    <Label className="text-xs text-gray-500 uppercase tracking-wide">Insured Name</Label>
                    <p className="mt-1 text-sm font-semibold text-gray-900">{formData.insured_name || 'N/A'}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-gray-500 uppercase tracking-wide">ID Card Number</Label>
                    <p className="mt-1 text-sm font-semibold text-gray-900">{formData.id_card_number || 'N/A'}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-gray-500 uppercase tracking-wide">Sex</Label>
                    <p className="mt-1 text-sm font-medium text-gray-700">{formData.sex || 'N/A'}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-gray-500 uppercase tracking-wide">Age</Label>
                    <p className="mt-1 text-sm font-medium text-gray-700">{formData.age || 'N/A'} years</p>
                  </div>
                  <div>
                    <Label className="text-xs text-gray-500 uppercase tracking-wide">Policy Holder</Label>
                    <p className="mt-1 text-sm font-medium text-gray-700">{formData.policy_holder || 'N/A'}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-gray-500 uppercase tracking-wide">Policy Number</Label>
                    <p className="mt-1 text-sm font-medium text-gray-700">{formData.policy_number || 'N/A'}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-gray-500 uppercase tracking-wide">Expiry Date</Label>
                    <p className="mt-1 text-sm font-medium text-gray-700">{formatDate(formData.expiry_date)}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-gray-500 uppercase tracking-wide">Approval</Label>
                    <p className="mt-1 text-sm font-medium text-gray-700">{formData.approval_field || 'N/A'}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Patient Type & Emergency */}
            <Card className="border-l-4 border-l-red-500 print:break-inside-avoid">
              <CardHeader className="bg-gradient-to-r from-red-50 to-transparent">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-5 w-5 text-red-600" />
                  <CardTitle className="text-red-900">Patient Type & Emergency</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
                  <div>
                    <Label className="text-xs text-gray-500 uppercase tracking-wide">Patient Type</Label>
                    <p className="mt-1 text-sm font-semibold text-gray-900">{formData.patient_type || 'N/A'}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-gray-500 uppercase tracking-wide">Emergency Case</Label>
                    <div className="mt-1 flex items-center gap-2">
                      <Badge variant={formData.emergency_case ? 'destructive' : 'secondary'}>
                        {formData.emergency_case ? 'Yes' : 'No'}
                      </Badge>
                      {formData.emergency_case && formData.emergency_care_level && (
                        <span className="text-sm text-gray-700">(Level {formData.emergency_care_level})</span>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Vital Signs */}
            <Card className="border-l-4 border-l-green-500 print:break-inside-avoid">
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
                    <p className="text-lg font-bold text-gray-900">{formData.bp || 'N/A'}</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3 text-center">
                    <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Pulse</p>
                    <p className="text-lg font-bold text-gray-900">{formData.pulse || 'N/A'}</p>
                    <p className="text-xs text-gray-500">bpm</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3 text-center">
                    <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Temp</p>
                    <p className="text-lg font-bold text-gray-900">{formData.temp || 'N/A'}</p>
                    <p className="text-xs text-gray-500">°C</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3 text-center">
                    <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Weight</p>
                    <p className="text-lg font-bold text-gray-900">{formData.weight || 'N/A'}</p>
                    <p className="text-xs text-gray-500">Kg</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3 text-center">
                    <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Height</p>
                    <p className="text-lg font-bold text-gray-900">{formData.height || 'N/A'}</p>
                    <p className="text-xs text-gray-500">cm</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3 text-center">
                    <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">R.R.</p>
                    <p className="text-lg font-bold text-gray-900">{formData.respiratory_rate || 'N/A'}</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3 text-center col-span-2">
                    <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Illness Duration</p>
                    <p className="text-lg font-bold text-gray-900">{formData.duration_of_illness_days || 'N/A'}</p>
                    <p className="text-xs text-gray-500">days</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Clinical Details */}
            <Card className="border-l-4 border-l-purple-500 print:break-inside-avoid">
              <CardHeader className="bg-gradient-to-r from-purple-50 to-transparent">
                <div className="flex items-center gap-2">
                  <Stethoscope className="h-5 w-5 text-purple-600" />
                  <CardTitle className="text-purple-900">Clinical Details</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-6 space-y-4">
                <div>
                  <Label className="text-xs text-gray-500 uppercase tracking-wide">Chief Complaints</Label>
                  <p className="mt-2 text-sm text-gray-700 leading-relaxed">{formData.chief_complaints || 'N/A'}</p>
                </div>
                <div className="border-t pt-4">
                  <Label className="text-xs text-gray-500 uppercase tracking-wide">Significant Signs</Label>
                  <p className="mt-2 text-sm text-gray-700 leading-relaxed">{formData.significant_signs || 'N/A'}</p>
                </div>
                <div className="border-t pt-4">
                  <Label className="text-xs text-gray-500 uppercase tracking-wide">Other Conditions</Label>
                  <p className="mt-2 text-sm text-gray-700 leading-relaxed">{formData.other_conditions || 'N/A'}</p>
                </div>
                <div className="border-t pt-4">
                  <Label className="text-xs text-gray-500 uppercase tracking-wide">Diagnosis</Label>
                  <p className="mt-2 text-sm font-semibold text-gray-900 leading-relaxed">{formData.diagnosis || 'N/A'}</p>
                </div>
              </CardContent>
            </Card>

            {/* Coding */}
            <Card className="border-l-4 border-l-indigo-500 print:break-inside-avoid">
              <CardHeader className="bg-gradient-to-r from-indigo-50 to-transparent">
                <div className="flex items-center gap-2">
                  <FileCheck className="h-5 w-5 text-indigo-600" />
                  <CardTitle className="text-indigo-900">Medical Coding</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-indigo-50 rounded-lg p-4 text-center">
                    <p className="text-xs text-indigo-600 font-semibold uppercase tracking-wide mb-2">Principal Code</p>
                    <p className="text-lg font-bold text-indigo-900">{formData.principal_code || 'N/A'}</p>
                  </div>
                  <div className="bg-indigo-50 rounded-lg p-4 text-center">
                    <p className="text-xs text-indigo-600 font-semibold uppercase tracking-wide mb-2">2nd Code</p>
                    <p className="text-lg font-bold text-indigo-900">{formData.second_code || 'N/A'}</p>
                  </div>
                  <div className="bg-indigo-50 rounded-lg p-4 text-center">
                    <p className="text-xs text-indigo-600 font-semibold uppercase tracking-wide mb-2">3rd Code</p>
                    <p className="text-lg font-bold text-indigo-900">{formData.third_code || 'N/A'}</p>
                  </div>
                  <div className="bg-indigo-50 rounded-lg p-4 text-center">
                    <p className="text-xs text-indigo-600 font-semibold uppercase tracking-wide mb-2">4th Code</p>
                    <p className="text-lg font-bold text-indigo-900">{formData.fourth_code || 'N/A'}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Conditions */}
            <Card className="border-l-4 border-l-orange-500 print:break-inside-avoid">
              <CardHeader className="bg-gradient-to-r from-orange-50 to-transparent">
                <div className="flex items-center gap-2">
                  <Heart className="h-5 w-5 text-orange-600" />
                  <CardTitle className="text-orange-900">Medical Conditions</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {[
                    { key: 'chronic', label: 'Chronic' },
                    { key: 'congenital', label: 'Congenital' },
                    { key: 'rta', label: 'RTA' },
                    { key: 'work_related', label: 'Work Related' },
                    { key: 'vaccination', label: 'Vaccination' },
                    { key: 'check_up', label: 'Check Up' },
                    { key: 'psychiatric', label: 'Psychiatric' },
                    { key: 'infertility', label: 'Infertility' },
                    { key: 'pregnancy', label: 'Pregnancy' }
                  ].map(({ key, label }) => (
                    <div key={key} className={`flex items-center gap-2 px-3 py-2 rounded-lg ${
                      formData[key] ? 'bg-orange-50 border border-orange-200' : 'bg-gray-50'
                    }`}>
                      <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                        formData[key] ? 'bg-orange-500 border-orange-500' : 'border-gray-300'
                      }`}>
                        {formData[key] && (
                          <CheckCircle2 className="w-4 h-4 text-white" />
                        )}
                      </div>
                      <span className={`text-sm font-medium ${
                        formData[key] ? 'text-orange-900' : 'text-gray-600'
                      }`}>{label}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Management Items */}
            <Card className="border-l-4 border-l-blue-500 print:break-inside-avoid">
              <CardHeader className="bg-gradient-to-r from-blue-50 to-transparent">
                <div className="flex items-center gap-2">
                  <ClipboardList className="h-5 w-5 text-blue-600" />
                  <CardTitle className="text-blue-900">Management Items</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-6">
                {formData.management_items && formData.management_items.length > 0 ? (
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
                        {formData.management_items.map((item, index) => (
                          <TableRow key={index} className="hover:bg-gray-50">
                            <TableCell className="font-medium">{item.code || 'N/A'}</TableCell>
                            <TableCell>{item.description || 'N/A'}</TableCell>
                            <TableCell>{item.type || 'N/A'}</TableCell>
                            <TableCell className="text-right">{item.quantity || 'N/A'}</TableCell>
                            <TableCell className="text-right font-semibold">
                              {item.cost ? `$${item.cost.toLocaleString()}` : 'N/A'}
                            </TableCell>
                          </TableRow>
                        ))}
                        <TableRow className="bg-gray-50 font-semibold">
                          <TableCell colSpan={4} className="text-right">Total Cost:</TableCell>
                          <TableCell className="text-right">
                            ${formData.management_items.reduce((sum, item) => sum + (parseFloat(item.cost) || 0), 0).toLocaleString()}
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="text-center py-8 bg-gray-50 rounded-lg">
                    <ClipboardList className="h-12 w-12 text-gray-300 mx-auto mb-2" />
                    <p className="text-gray-500 text-sm">No management items added</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Medications */}
            <Card className="border-l-4 border-l-green-500 print:break-inside-avoid">
              <CardHeader className="bg-gradient-to-r from-green-50 to-transparent">
                <div className="flex items-center gap-2">
                  <Pill className="h-5 w-5 text-green-600" />
                  <CardTitle className="text-green-900">Medications</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-6">
                {formData.medications && formData.medications.length > 0 ? (
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-gray-50">
                          <TableHead className="font-semibold">Medication Name</TableHead>
                          <TableHead className="font-semibold">Type</TableHead>
                          <TableHead className="font-semibold text-right">Quantity</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {formData.medications.map((med, index) => (
                          <TableRow key={index} className="hover:bg-gray-50">
                            <TableCell className="font-medium">{med.medication_name || 'N/A'}</TableCell>
                            <TableCell>{med.type || 'N/A'}</TableCell>
                            <TableCell className="text-right">{med.quantity || 'N/A'}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="text-center py-8 bg-gray-50 rounded-lg">
                    <Pill className="h-12 w-12 text-gray-300 mx-auto mb-2" />
                    <p className="text-gray-500 text-sm">No medications added</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Provider Approval */}
            <Card className="border-l-4 border-l-teal-500 print:break-inside-avoid">
              <CardHeader className="bg-gradient-to-r from-teal-50 to-transparent">
                <div className="flex items-center gap-2">
                  <FileCheck className="h-5 w-5 text-teal-600" />
                  <CardTitle className="text-teal-900">Provider Approval</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div>
                    <Label className="text-xs text-gray-500 uppercase tracking-wide">Completed/Coded BY</Label>
                    <p className="mt-2 text-sm font-semibold text-gray-900">{formData.completed_coded_by || 'N/A'}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-gray-500 uppercase tracking-wide">Signature</Label>
                    <p className="mt-2 text-sm font-semibold text-gray-900">{formData.provider_signature || 'N/A'}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-gray-500 uppercase tracking-wide">Date</Label>
                    <p className="mt-2 text-sm font-semibold text-gray-900">{formatDate(formData.provider_date)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Case Management */}
            <Card className="border-l-4 border-l-pink-500 print:break-inside-avoid">
              <CardHeader className="bg-gradient-to-r from-pink-50 to-transparent">
                <div className="flex items-center gap-2">
                  <Shield className="h-5 w-5 text-pink-600" />
                  <CardTitle className="text-pink-900">Case Management</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-6 space-y-4">
                <div className={`flex items-center gap-2 px-4 py-2 rounded-lg ${
                  formData.case_management_form_included ? 'bg-pink-50 border border-pink-200' : 'bg-gray-50'
                }`}>
                  <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                    formData.case_management_form_included ? 'bg-pink-500 border-pink-500' : 'border-gray-300'
                  }`}>
                    {formData.case_management_form_included && (
                      <CheckCircle2 className="w-4 h-4 text-white" />
                    )}
                  </div>
                  <span className={`text-sm font-medium ${
                    formData.case_management_form_included ? 'text-pink-900' : 'text-gray-600'
                  }`}>Case management Form (CMF 1.0) included</span>
                </div>
                <div className="border-t pt-4">
                  <Label className="text-xs text-gray-500 uppercase tracking-wide">Possible line of management</Label>
                  <p className="mt-2 text-sm text-gray-700 leading-relaxed">{formData.possible_line_of_management || 'N/A'}</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 border-t pt-4">
                  <div>
                    <Label className="text-xs text-gray-500 uppercase tracking-wide">Estimated Length of stay</Label>
                    <p className="mt-2 text-sm font-semibold text-gray-900">{formData.estimated_length_of_stay_days || 'N/A'} days</p>
                  </div>
                  <div>
                    <Label className="text-xs text-gray-500 uppercase tracking-wide">Expected date of admissions</Label>
                    <p className="mt-2 text-sm font-semibold text-gray-900">{formatDate(formData.expected_date_of_admission)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Print Footer */}
            <div className="hidden print:block border-t-2 border-gray-200 pt-4 mt-8 text-center text-xs text-gray-500">
              <p>Generated on {format(new Date(), 'dd/MM/yyyy HH:mm')}</p>
              <p className="mt-1">This is an official document - Standard Approval Form</p>
            </div>
          </div>
        </div>
         {/* Left Sidebar - Summary (30%) */}
         <div className="lg:col-span-4 print:hidden">
          <div className="lg:sticky lg:top-6 space-y-4">
            {/* Summary Card */}
            <Card className="border-l-4 border-l-primary-purple">
              <CardHeader className="bg-gradient-to-r from-primary-purple/5 to-transparent pb-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">Form Summary</CardTitle>
                  <FileText className="h-5 w-5 text-primary-purple" />
                </div>
              </CardHeader>
              <CardContent className="space-y-4 pt-6">
                <div>
                  <Label className="text-xs text-gray-500 uppercase tracking-wide">Form Number</Label>
                  <p className="text-xl font-bold text-gray-900 mt-1">{formData.form_number || 'N/A'}</p>
                </div>
                
                <div className="flex items-center justify-between pt-2 border-t">
                  <Label className="text-xs text-gray-500 uppercase tracking-wide">Status</Label>
                  {getStatusBadge(formData.status)}
                </div>

                <div className="pt-2 border-t">
                  <Label className="text-xs text-gray-500 uppercase tracking-wide mb-2 block">Key Information</Label>
                  <div className="space-y-3">
                    <div className="flex items-start gap-2">
                      <Building2 className="h-4 w-4 text-primary-purple mt-0.5 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-gray-500">Provider</p>
                        <p className="text-sm font-medium text-gray-900 truncate">{formData.provider_name || 'N/A'}</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <User className="h-4 w-4 text-accent-cyan mt-0.5 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-gray-500">Insured Name</p>
                        <p className="text-sm font-medium text-gray-900 truncate">{formData.insured_name || 'N/A'}</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <Calendar className="h-4 w-4 text-accent-purple mt-0.5 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-gray-500">Date of Visit</p>
                        <p className="text-sm font-medium text-gray-900">{formatDate(formData.date_of_visit)}</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t">
                  <Label className="text-xs text-gray-500 uppercase tracking-wide mb-3 block">Quick Stats</Label>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="bg-blue-50 rounded-lg p-3 text-center">
                      <ClipboardList className="h-5 w-5 text-blue-600 mx-auto mb-1" />
                      <p className="text-lg font-bold text-blue-600">{formData.management_items?.length || 0}</p>
                      <p className="text-xs text-gray-600">Items</p>
                    </div>
                    <div className="bg-green-50 rounded-lg p-3 text-center">
                      <Pill className="h-5 w-5 text-green-600 mx-auto mb-1" />
                      <p className="text-lg font-bold text-green-600">{formData.medications?.length || 0}</p>
                      <p className="text-xs text-gray-600">Meds</p>
                    </div>
                    <div className="bg-purple-50 rounded-lg p-3 text-center">
                      <CheckCircle2 className="h-5 w-5 text-purple-600 mx-auto mb-1" />
                      <p className="text-lg font-bold text-purple-600">{countConditions()}</p>
                      <p className="text-xs text-gray-600">Conditions</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Action Buttons */}
            <Card>
              <CardContent className="p-4 space-y-2">
                <Button
                  onClick={() => navigate(`/standard-approvals/${id}/edit`)}
                  className="w-full bg-gradient-to-r from-primary-purple to-accent-purple hover:opacity-90"
                >
                  <Edit className="h-4 w-4 mr-2" />
                  Edit Form
                </Button>
                <Button
                  onClick={handlePrint}
                  variant="outline"
                  className="w-full"
                >
                  <Printer className="h-4 w-4 mr-2" />
                  Print
                </Button>
                <Button
                  onClick={handleExportPDF}
                  variant="outline"
                  className="w-full"
                  disabled={exportingPDF}
                >
                  <Download className="h-4 w-4 mr-2" />
                  {exportingPDF ? 'Generating...' : 'Export PDF'}
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>

      </div>

      {/* Print-Only Hospital Form Template */}
      <div ref={printRef} className="hidden print:block pdf-export-content">
        <div className="form-template" style={{ fontFamily: 'Arial, sans-serif', fontSize: '11px', lineHeight: '1.4', padding: '20px' }}>
          
          {/* Header Boxes */}
          <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
            
            {/* Left Box - Reception/Nurse */}
            <div style={{ flex: 1, border: '2px solid #000', borderRadius: '15px', padding: '10px' }}>
              <div style={{ fontWeight: 'bold', marginBottom: '8px', fontSize: '10px' }}>
                To be completed & ID verified by the reception/nurse:
              </div>
              <div style={{ marginBottom: '4px' }}>
                Provider Name: <span style={{ borderBottom: '1px dotted #000', display: 'inline-block', minWidth: '200px' }}>{formData.provider_name || ''}</span>
              </div>
              <div style={{ marginBottom: '4px' }}>
                Insurance Company Name: <span style={{ borderBottom: '1px dotted #000', display: 'inline-block', minWidth: '150px' }}>{formData.insurance_company_name || ''}</span>
                <span style={{ marginLeft: '10px' }}>TPA Company Name: <span style={{ borderBottom: '1px dotted #000', display: 'inline-block', minWidth: '150px' }}>{formData.tpa_company_name || ''}</span></span>
              </div>
              <div style={{ marginBottom: '4px' }}>
                Patient File Number: <span style={{ borderBottom: '1px dotted #000', display: 'inline-block', minWidth: '150px' }}>{formData.patient_file_number || ''}</span>
                <span style={{ marginLeft: '10px' }}>Dept.: <span style={{ borderBottom: '1px dotted #000', display: 'inline-block', minWidth: '100px' }}>{formData.department || ''}</span></span>
              </div>
              <div style={{ marginBottom: '4px' }}>
                Single ( {formData.marital_status === 'Single' ? '✓' : '\u00A0'} )
                <span style={{ marginLeft: '15px' }}>Married ( {formData.marital_status === 'Married' ? '✓' : '\u00A0'} )</span>
                <span style={{ marginLeft: '15px' }}>Plan Type ( {formData.plan_type || '\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0'} )</span>
              </div>
              <div style={{ marginBottom: '4px' }}>
                Data of visit <span style={{ marginLeft: '10px', borderBottom: '1px dotted #000', display: 'inline-block', minWidth: '40px' }}>{formData.date_of_visit ? formatDate(formData.date_of_visit).split('/')[0] : ''}</span>
                / <span style={{ borderBottom: '1px dotted #000', display: 'inline-block', minWidth: '40px' }}>{formData.date_of_visit ? formatDate(formData.date_of_visit).split('/')[1] : ''}</span>
                / <span style={{ borderBottom: '1px dotted #000', display: 'inline-block', minWidth: '60px' }}>{formData.date_of_visit ? formatDate(formData.date_of_visit).split('/')[2] : ''}</span>
              </div>
              <div>
                New visit ( {formData.visit_type === 'New visit' ? '✓' : '\u00A0'} )
                <span style={{ marginLeft: '10px' }}>I Follow Up ( {formData.visit_type === 'Follow Up' ? '✓' : '\u00A0'} )</span>
                <span style={{ marginLeft: '10px' }}>I Refill ( {formData.visit_type === 'Refill' ? '✓' : '\u00A0'} )</span>
                <span style={{ marginLeft: '10px' }}>I walk in ( {formData.visit_type === 'Walk in' ? '✓' : '\u00A0'} )</span>
                <span style={{ marginLeft: '10px' }}>I Referral ( {formData.visit_type === 'Referral' ? '✓' : '\u00A0'} )</span>
              </div>
            </div>

            {/* Right Box - Print/Fill */}
            <div style={{ flex: 1, border: '2px solid #000', borderRadius: '15px', padding: '10px' }}>
              <div style={{ fontWeight: 'bold', marginBottom: '8px', fontSize: '10px' }}>
                Print/Fill in clear letters or Emboss Card:
              </div>
              <div style={{ marginBottom: '4px' }}>
                Insured Name: <span style={{ borderBottom: '1px dotted #000', display: 'inline-block', minWidth: '250px' }}>{formData.insured_name || ''}</span>
              </div>
              <div style={{ marginBottom: '4px' }}>
                ID Card No. <span style={{ borderBottom: '1px dotted #000', display: 'inline-block', minWidth: '150px' }}>{formData.id_card_number || ''}</span>
                <span style={{ marginLeft: '10px' }}>Sex <span style={{ borderBottom: '1px dotted #000', display: 'inline-block', minWidth: '60px' }}>{formData.sex || ''}</span></span>
                <span style={{ marginLeft: '10px' }}>Age <span style={{ borderBottom: '1px dotted #000', display: 'inline-block', minWidth: '40px' }}>{formData.age || ''}</span></span>
              </div>
              <div style={{ marginBottom: '4px' }}>
                Policy Holder <span style={{ borderBottom: '1px dotted #000', display: 'inline-block', minWidth: '150px' }}>{formData.policy_holder || ''}</span>
                <span style={{ marginLeft: '10px' }}>Policy No <span style={{ borderBottom: '1px dotted #000', display: 'inline-block', minWidth: '120px' }}>{formData.policy_number || ''}</span></span>
              </div>
              <div style={{ marginBottom: '4px' }}>
                Expiry Data <span style={{ marginLeft: '10px', borderBottom: '1px dotted #000', display: 'inline-block', minWidth: '40px' }}>{formData.expiry_date ? formatDate(formData.expiry_date).split('/')[0] : ''}</span>
                / <span style={{ borderBottom: '1px dotted #000', display: 'inline-block', minWidth: '40px' }}>{formData.expiry_date ? formatDate(formData.expiry_date).split('/')[1] : ''}</span>
                / <span style={{ borderBottom: '1px dotted #000', display: 'inline-block', minWidth: '60px' }}>{formData.expiry_date ? formatDate(formData.expiry_date).split('/')[2] : ''}</span>
              </div>
              <div>
                Approval <span style={{ borderBottom: '1px dotted #000', display: 'inline-block', minWidth: '300px' }}>{formData.approval_field || ''}</span>
              </div>
            </div>

          </div>

          {/* Main Physician Section */}
          <div style={{ border: '2px solid #000', padding: '10px', marginBottom: '10px' }}>
            <div style={{ fontWeight: 'bold', marginBottom: '10px', fontSize: '11px' }}>
              To be completed & by the Attending PHYSICIAN: Please tick ( ✓ )
            </div>

            {/* Patient Type and Emergency */}
            <div style={{ marginBottom: '8px' }}>
              Inpatient ( {formData.patient_type === 'Inpatient' ? '✓' : '\u00A0'} )
              <span style={{ marginLeft: '15px' }}>Outpatient ( {formData.patient_type === 'Outpatient' ? '✓' : '\u00A0'} )</span>
              <span style={{ marginLeft: '30px', borderLeft: '1px solid #000', paddingLeft: '15px' }}>
                Emergency Case ( {formData.emergency_case ? '✓' : '\u00A0'} )
              </span>
              <span style={{ marginLeft: '15px' }}>
                I Emergency Care Level: 
                <span style={{ marginLeft: '5px' }}>1( {formData.emergency_care_level === 1 ? '✓' : '\u00A0'} )</span>
                <span style={{ marginLeft: '10px' }}>2( {formData.emergency_care_level === 2 ? '✓' : '\u00A0'} )</span>
                <span style={{ marginLeft: '10px' }}>3( {formData.emergency_care_level === 3 ? '✓' : '\u00A0'} )</span>
              </span>
            </div>

            {/* Vital Signs */}
            <div style={{ marginBottom: '8px' }}>
              BP:<span style={{ borderBottom: '1px dotted #000', display: 'inline-block', minWidth: '50px' }}>{formData.bp || ''}</span>/<span style={{ borderBottom: '1px dotted #000', display: 'inline-block', minWidth: '50px' }}></span>
              <span style={{ marginLeft: '10px' }}>Pulse:<span style={{ borderBottom: '1px dotted #000', display: 'inline-block', minWidth: '50px' }}>{formData.pulse || ''}</span>bpm</span>
              <span style={{ marginLeft: '10px' }}>Temp <span style={{ borderBottom: '1px dotted #000', display: 'inline-block', minWidth: '40px' }}>{formData.temp || ''}</span> C</span>
              <span style={{ marginLeft: '10px' }}>Weight:<span style={{ borderBottom: '1px dotted #000', display: 'inline-block', minWidth: '40px' }}>{formData.weight || ''}</span>Kg</span>
              <span style={{ marginLeft: '10px' }}>Height:<span style={{ borderBottom: '1px dotted #000', display: 'inline-block', minWidth: '40px' }}>{formData.height || ''}</span>cm</span>
              <span style={{ marginLeft: '10px' }}>R.R.:<span style={{ borderBottom: '1px dotted #000', display: 'inline-block', minWidth: '40px' }}>{formData.respiratory_rate || ''}</span></span>
              <span style={{ marginLeft: '10px' }}>Duration of Illness :<span style={{ borderBottom: '1px dotted #000', display: 'inline-block', minWidth: '40px' }}>{formData.duration_of_illness_days || ''}</span>( Days)</span>
            </div>

            {/* Chief Complaints */}
            <div style={{ marginBottom: '6px' }}>
              <span style={{ fontWeight: 'bold', fontSize: '10px' }}>Chief Complaints and Main symptoms</span>
              <div style={{ borderBottom: '1px dotted #000', minHeight: '30px', paddingTop: '2px' }}>
                {formData.chief_complaints || ''}
              </div>
            </div>

            {/* Significant Signs */}
            <div style={{ marginBottom: '6px' }}>
              <span style={{ fontWeight: 'bold', fontSize: '10px' }}>Significant Signs:</span>
              <div style={{ borderBottom: '1px dotted #000', minHeight: '30px', paddingTop: '2px' }}>
                {formData.significant_signs || ''}
              </div>
            </div>

            {/* Other Conditions */}
            <div style={{ marginBottom: '6px' }}>
              <span style={{ fontWeight: 'bold', fontSize: '10px' }}>Other Conditions</span>
              <div style={{ borderBottom: '1px dotted #000', minHeight: '30px', paddingTop: '2px' }}>
                {formData.other_conditions || ''}
              </div>
            </div>

            {/* Diagnosis */}
            <div style={{ marginBottom: '8px' }}>
              <span style={{ fontWeight: 'bold', fontSize: '10px' }}>Diagnosis</span>
              <div style={{ borderBottom: '1px dotted #000', minHeight: '30px', paddingTop: '2px' }}>
                {formData.diagnosis || ''}
              </div>
            </div>

            {/* Codes */}
            <div style={{ marginBottom: '8px', borderTop: '1px solid #000', paddingTop: '4px' }}>
              <span style={{ fontWeight: 'bold', fontSize: '10px' }}>Principal Code:</span>
              <span style={{ marginLeft: '10px', borderBottom: '1px solid #000', display: 'inline-block', minWidth: '150px' }}>{formData.principal_code || ''}</span>
              <span style={{ marginLeft: '30px', fontWeight: 'bold', fontSize: '10px' }}>2<sup>nd</sup> Code:</span>
              <span style={{ marginLeft: '10px', borderBottom: '1px solid #000', display: 'inline-block', minWidth: '150px' }}>{formData.second_code || ''}</span>
              <span style={{ marginLeft: '30px', fontWeight: 'bold', fontSize: '10px' }}>3<sup>rd</sup> Code:</span>
              <span style={{ marginLeft: '10px', borderBottom: '1px solid #000', display: 'inline-block', minWidth: '150px' }}>{formData.third_code || ''}</span>
              <span style={{ marginLeft: '30px', fontWeight: 'bold', fontSize: '10px' }}>4<sup>th</sup> Code:</span>
              <span style={{ marginLeft: '10px', borderBottom: '1px solid #000', display: 'inline-block', minWidth: '150px' }}>{formData.fourth_code || ''}</span>
            </div>

            {/* Conditions Checkboxes */}
            <div style={{ marginBottom: '8px', borderTop: '1px solid #000', paddingTop: '4px' }}>
              <div style={{ fontWeight: 'bold', marginBottom: '4px', fontSize: '10px' }}>
                Please tick ( ✓ ) where appropriate:
              </div>
              <div>
                Chronic ( {formData.chronic ? '✓' : '\u00A0'} )
                <span style={{ marginLeft: '20px' }}>Congenital ( {formData.congenital ? '✓' : '\u00A0'} )</span>
                <span style={{ marginLeft: '20px' }}>RTA ( {formData.rta ? '✓' : '\u00A0'} )</span>
                <span style={{ marginLeft: '20px' }}>Work Related ( {formData.work_related ? '✓' : '\u00A0'} )</span>
                <span style={{ marginLeft: '20px' }}>Vaccination ( {formData.vaccination ? '✓' : '\u00A0'} )</span>
                <span style={{ marginLeft: '20px' }}>Check-Up ( {formData.check_up ? '✓' : '\u00A0'} )</span>
              </div>
              <div style={{ marginTop: '4px' }}>
                Psychiatric ( {formData.psychiatric ? '✓' : '\u00A0'} )
                <span style={{ marginLeft: '20px' }}>Infertility ( {formData.infertility ? '✓' : '\u00A0'} )</span>
                <span style={{ marginLeft: '20px' }}>Pregnancy ( {formData.pregnancy ? '✓' : '\u00A0'} )</span>
              </div>
            </div>

            {/* Management Line */}
            <div style={{ marginBottom: '4px', fontSize: '10px' }}>
              <span style={{ fontWeight: 'bold' }}>Suggestive line(s) of management:</span> Kindly, enumerate the recommended investigations, and/or procedures <span style={{ fontWeight: 'bold' }}>For outpatient approvals only:</span>
            </div>

            {/* Management Items Table */}
            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '10px', fontSize: '10px' }}>
              <thead>
                <tr style={{ backgroundColor: '#fff' }}>
                  <th style={{ border: '2px solid #000', padding: '6px', fontWeight: 'bold', textAlign: 'left' }}>Code</th>
                  <th style={{ border: '2px solid #000', padding: '6px', fontWeight: 'bold', textAlign: 'left' }}>Description/Service</th>
                  <th style={{ border: '2px solid #000', padding: '6px', fontWeight: 'bold', textAlign: 'center', width: '80px' }}>Type</th>
                  <th style={{ border: '2px solid #000', padding: '6px', fontWeight: 'bold', textAlign: 'center', width: '70px' }}>Quantity</th>
                  <th style={{ border: '2px solid #000', padding: '6px', fontWeight: 'bold', textAlign: 'right', width: '80px' }}>Cost</th>
                </tr>
              </thead>
              <tbody>
                {formData.management_items && formData.management_items.length > 0 ? (
                  formData.management_items.map((item, index) => (
                    <tr key={index}>
                      <td style={{ border: '1px solid #000', padding: '6px' }}>{item.code || ''}</td>
                      <td style={{ border: '1px solid #000', padding: '6px' }}>{item.description || ''}</td>
                      <td style={{ border: '1px solid #000', padding: '6px', textAlign: 'center' }}>{item.type || ''}</td>
                      <td style={{ border: '1px solid #000', padding: '6px', textAlign: 'center' }}>{item.quantity || ''}</td>
                      <td style={{ border: '1px solid #000', padding: '6px', textAlign: 'right' }}>{item.cost || ''}</td>
                    </tr>
                  ))
                ) : (
                  <>
                    <tr>
                      <td style={{ border: '1px solid #000', padding: '15px' }}>&nbsp;</td>
                      <td style={{ border: '1px solid #000', padding: '15px' }}>&nbsp;</td>
                      <td style={{ border: '1px solid #000', padding: '15px' }}>&nbsp;</td>
                      <td style={{ border: '1px solid #000', padding: '15px' }}>&nbsp;</td>
                      <td style={{ border: '1px solid #000', padding: '15px' }}>&nbsp;</td>
                    </tr>
                    <tr>
                      <td style={{ border: '1px solid #000', padding: '15px' }}>&nbsp;</td>
                      <td style={{ border: '1px solid #000', padding: '15px' }}>&nbsp;</td>
                      <td style={{ border: '1px solid #000', padding: '15px' }}>&nbsp;</td>
                      <td style={{ border: '1px solid #000', padding: '15px' }}>&nbsp;</td>
                      <td style={{ border: '1px solid #000', padding: '15px' }}>&nbsp;</td>
                    </tr>
                    <tr>
                      <td style={{ border: '1px solid #000', padding: '15px' }}>&nbsp;</td>
                      <td style={{ border: '1px solid #000', padding: '15px' }}>&nbsp;</td>
                      <td style={{ border: '1px solid #000', padding: '15px' }}>&nbsp;</td>
                      <td style={{ border: '1px solid #000', padding: '15px' }}>&nbsp;</td>
                      <td style={{ border: '1px solid #000', padding: '15px' }}>&nbsp;</td>
                    </tr>
                  </>
                )}
              </tbody>
            </table>

            {/* Provider Approval */}
            <div style={{ marginBottom: '10px', fontSize: '10px', borderTop: '1px solid #000', paddingTop: '6px' }}>
              <span style={{ fontWeight: 'bold' }}>Providers Approval/Coding Staff must review/code the recommended service(s) and allocate cost and complete the following:</span>
            </div>

            <div style={{ display: 'flex', marginBottom: '10px', fontSize: '10px' }}>
              <div style={{ flex: 1 }}>
                <span style={{ fontWeight: 'bold' }}>Completed/Coded BY</span>
                <div style={{ borderBottom: '1px solid #000', minHeight: '20px' }}>{formData.completed_coded_by || ''}</div>
              </div>
              <div style={{ flex: 1, marginLeft: '20px' }}>
                <span style={{ fontWeight: 'bold' }}>Signature</span>
                <div style={{ borderBottom: '1px solid #000', minHeight: '20px' }}>{formData.provider_signature || ''}</div>
              </div>
              <div style={{ flex: 1, marginLeft: '20px' }}>
                <span style={{ fontWeight: 'bold' }}>Data</span>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <span style={{ borderBottom: '1px solid #000', display: 'inline-block', minWidth: '40px', textAlign: 'center' }}>{formData.provider_date ? formatDate(formData.provider_date).split('/')[0] : ''}</span>
                  <span style={{ margin: '0 4px' }}>/</span>
                  <span style={{ borderBottom: '1px solid #000', display: 'inline-block', minWidth: '40px', textAlign: 'center' }}>{formData.provider_date ? formatDate(formData.provider_date).split('/')[1] : ''}</span>
                  <span style={{ margin: '0 4px' }}>/</span>
                  <span style={{ borderBottom: '1px solid #000', display: 'inline-block', minWidth: '60px', textAlign: 'center' }}>{formData.provider_date ? formatDate(formData.provider_date).split('/')[2] : ''}</span>
                </div>
              </div>
            </div>

            {/* Medications Table */}
            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '10px', fontSize: '10px' }}>
              <thead>
                <tr style={{ backgroundColor: '#fff' }}>
                  <th style={{ border: '2px solid #000', padding: '6px', fontWeight: 'bold', textAlign: 'left' }}>Medication Name (Generic Name)</th>
                  <th style={{ border: '2px solid #000', padding: '6px', fontWeight: 'bold', textAlign: 'center', width: '150px' }}>Type</th>
                  <th style={{ border: '2px solid #000', padding: '6px', fontWeight: 'bold', textAlign: 'center', width: '100px' }}>Quantity</th>
                </tr>
              </thead>
              <tbody>
                {formData.medications && formData.medications.length > 0 ? (
                  formData.medications.map((med, index) => (
                    <tr key={index}>
                      <td style={{ border: '1px solid #000', padding: '6px' }}>{med.medication_name || ''}</td>
                      <td style={{ border: '1px solid #000', padding: '6px', textAlign: 'center' }}>{med.type || ''}</td>
                      <td style={{ border: '1px solid #000', padding: '6px', textAlign: 'center' }}>{med.quantity || ''}</td>
                    </tr>
                  ))
                ) : (
                  <>
                    <tr>
                      <td style={{ border: '1px solid #000', padding: '15px' }}>&nbsp;</td>
                      <td style={{ border: '1px solid #000', padding: '15px' }}>&nbsp;</td>
                      <td style={{ border: '1px solid #000', padding: '15px' }}>&nbsp;</td>
                    </tr>
                    <tr>
                      <td style={{ border: '1px solid #000', padding: '15px' }}>&nbsp;</td>
                      <td style={{ border: '1px solid #000', padding: '15px' }}>&nbsp;</td>
                      <td style={{ border: '1px solid #000', padding: '15px' }}>&nbsp;</td>
                    </tr>
                  </>
                )}
              </tbody>
            </table>

            {/* Case Management */}
            <div style={{ fontSize: '10px', display: 'flex', alignItems: 'flex-start', gap: '20px' }}>
              <div style={{ flex: 1 }}>
                <span style={{ fontWeight: 'bold' }}>I Case management Form (CMF 1.0) included</span>
                <span style={{ marginLeft: '20px' }}>Yes ( {formData.case_management_form_included ? '✓' : '\u00A0'} )</span>
                <span style={{ marginLeft: '15px' }}>No ( {!formData.case_management_form_included ? '✓' : '\u00A0'} )</span>
              </div>
            </div>

          </div>

        </div>
      </div>

      {/* Print & PDF Export Styles */}
      <style>{`
        @media print {
          @page {
            margin: 1cm;
            size: A4;
          }
          
          body {
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
          }
          
          .print\\:hidden {
            display: none !important;
          }
          
          .print\\:block {
            display: block !important;
          }
          
          .print\\:break-inside-avoid {
            break-inside: avoid;
            page-break-inside: avoid;
          }
          
          /* Form template specific styles */
          .form-template {
            background: white !important;
            color: black !important;
          }

          .form-template * {
            box-sizing: border-box;
          }

          .form-template table {
            page-break-inside: auto;
          }

          .form-template tr {
            page-break-inside: avoid;
            page-break-after: auto;
          }
        }

        /* PDF Export Styles - Black and White Hospital Form Template */
        .pdf-export-content,
        .pdf-export {
          background: white !important;
        }

        .pdf-export-content *,
        .pdf-export * {
          color: #000000 !important;
        }

        /* Form template is already styled inline, just ensure it prints */
        .pdf-export-content .form-template,
        .pdf-export .form-template {
          background: white !important;
          color: black !important;
        }

        .pdf-export-content table,
        .pdf-export table {
          border-collapse: collapse !important;
          width: 100% !important;
        }

        .pdf-export-content table th,
        .pdf-export table th {
          background: white !important;
          border: 2px solid #000000 !important;
          font-weight: bold !important;
          padding: 6px !important;
        }

        .pdf-export-content table td,
        .pdf-export table td {
          border: 1px solid #000000 !important;
          padding: 6px !important;
        }
      `}</style>
    </div>
  );
}
