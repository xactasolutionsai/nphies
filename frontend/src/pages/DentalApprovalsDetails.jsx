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
import { format } from 'date-fns';
import { 
  ArrowLeft, 
  Edit, 
  Printer,
  Download,
  Trash2,
  User,
  Building2,
  Shield,
  Calendar,
  Stethoscope,
  Pill,
  FileText
} from 'lucide-react';

export default function DentalApprovalsDetails() {
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
      const response = await api.getDentalApproval(id);
      const data = response.data || response;
      
      setFormData({
        ...data,
        procedures: data.procedures || [],
        medications: data.medications || []
      });
    } catch (error) {
      console.error('Error loading form:', error);
      alert('Error loading form data');
      navigate('/dental-approvals');
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
      pdf.save(`DentalApproval_${formData?.form_number || 'Form'}_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Error generating PDF. Please try again.');
    } finally {
      setExportingPDF(false);
    }
  };

  const handleDelete = async () => {
    if (window.confirm('Are you sure you want to delete this dental form?')) {
      try {
        await api.deleteDentalApproval(id);
        alert('Form deleted successfully');
        navigate('/dental-approvals');
      } catch (error) {
        console.error('Error deleting form:', error);
        alert('Error deleting form');
      }
    }
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
    return <div>Form not found</div>;
  }

  const totalCost = formData.procedures.reduce((sum, proc) => sum + (parseFloat(proc.cost) || 0), 0);

  return (
    <div className="space-y-6">
      {/* Header - Not printed */}
      <div className="flex items-center justify-between print:hidden">
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            onClick={() => navigate('/dental-approvals')}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Dental Approval Form
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
                  <h1 className="text-2xl font-bold text-gray-900">Dental Approval Form</h1>
                  <p className="text-sm text-gray-600 mt-1">Form Number: {formData.form_number || 'N/A'}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-600">Date: {formatDate(new Date())}</p>
                  {getStatusBadge(formData.status)}
                </div>
            </div>
          </div>

            {/* Section 1: Reception/Nurse */}
            <Card className="border-l-4 border-l-blue-500 print:break-inside-avoid">
              <CardHeader className="bg-gradient-to-r from-blue-50 to-transparent">
                <div className="flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-blue-600" />
                  <CardTitle className="text-blue-900">Section 1: Reception/Nurse Information</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
                  <div>
                    <Label className="text-xs text-gray-500 uppercase tracking-wide">Provider Name</Label>
                    <p className="mt-1 text-sm font-semibold text-gray-900">{formData.provider_name || 'N/A'}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-gray-500 uppercase tracking-wide">Insurance Company Name</Label>
                    <p className="mt-1 text-sm font-semibold text-gray-900">{formData.insurance_company_name || 'N/A'}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-gray-500 uppercase tracking-wide">TPA Company Name</Label>
                    <p className="mt-1 text-sm font-medium text-gray-700">{formData.tpa_company_name || 'N/A'}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-gray-500 uppercase tracking-wide">Patient File Number</Label>
                    <p className="mt-1 text-sm font-medium text-gray-700">{formData.patient_file_number || 'N/A'}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-gray-500 uppercase tracking-wide">Date of Visit</Label>
                    <p className="mt-1 text-sm font-semibold text-gray-900">{formatDate(formData.date_of_visit)}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-gray-500 uppercase tracking-wide">Plan Type</Label>
                    <p className="mt-1 text-sm font-medium text-gray-700">{formData.plan_type || 'N/A'}</p>
                  </div>
                  <div className="col-span-2">
                    <Label className="text-xs text-gray-500 uppercase tracking-wide mb-2 block">Visit Type</Label>
                    <div className="flex gap-2">
                      {formData.new_visit && <Badge variant="outline">New Visit</Badge>}
                      {formData.follow_up && <Badge variant="outline">Follow Up</Badge>}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Section 2: Insured Information */}
            <Card className="border-l-4 border-l-cyan-500 print:break-inside-avoid">
              <CardHeader className="bg-gradient-to-r from-cyan-50 to-transparent">
                <div className="flex items-center gap-2">
                  <User className="h-5 w-5 text-cyan-600" />
                  <CardTitle className="text-cyan-900">Section 2: Insured Information</CardTitle>
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
                    <Label className="text-xs text-gray-500 uppercase tracking-wide">Class</Label>
                    <p className="mt-1 text-sm font-medium text-gray-700">{formData.class || 'N/A'}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Section 3: Dentist Section */}
            <Card className="border-l-4 border-l-purple-500 print:break-inside-avoid">
              <CardHeader className="bg-gradient-to-r from-purple-50 to-transparent">
                <div className="flex items-center gap-2">
                  <Stethoscope className="h-5 w-5 text-purple-600" />
                  <CardTitle className="text-purple-900">Section 3: Dentist Information</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-6 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
                  <div>
                    <Label className="text-xs text-gray-500 uppercase tracking-wide">Duration of Illness</Label>
                    <p className="mt-2 text-sm font-semibold text-gray-900">{formData.duration_of_illness_days ? `${formData.duration_of_illness_days} days` : 'N/A'}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-gray-500 uppercase tracking-wide">Diagnosis (ICD10)</Label>
                    <p className="mt-2 text-sm font-semibold text-gray-900">{formData.diagnosis_icd10 || 'N/A'}</p>
                  </div>
                </div>
                <div className="border-t pt-4">
                  <Label className="text-xs text-gray-500 uppercase tracking-wide">Chief Complaints & Main Symptoms</Label>
                  <p className="mt-2 text-sm text-gray-700 leading-relaxed">{formData.chief_complaints || 'N/A'}</p>
                </div>
                <div className="border-t pt-4">
                  <Label className="text-xs text-gray-500 uppercase tracking-wide">Significant Signs</Label>
                  <p className="mt-2 text-sm text-gray-700 leading-relaxed">{formData.significant_signs || 'N/A'}</p>
                </div>
                <div className="border-t pt-4">
                  <Label className="text-xs text-gray-500 uppercase tracking-wide">Primary Diagnosis</Label>
                  <p className="mt-2 text-sm font-semibold text-gray-900 leading-relaxed">{formData.primary_diagnosis || 'N/A'}</p>
                </div>
                <div className="border-t pt-4">
                  <Label className="text-xs text-gray-500 uppercase tracking-wide">Secondary Diagnosis</Label>
                  <p className="mt-2 text-sm text-gray-700 leading-relaxed">{formData.secondary_diagnosis || 'N/A'}</p>
                </div>
                <div className="border-t pt-4">
                  <Label className="text-xs text-gray-500 uppercase tracking-wide">Other Conditions</Label>
                  <p className="mt-2 text-sm text-gray-700 leading-relaxed">{formData.other_conditions || 'N/A'}</p>
                </div>

                <div className="border-t pt-4">
                  <Label className="text-xs text-gray-500 uppercase tracking-wide mb-3 block">Treatment Type</Label>
                  <div className="flex flex-wrap gap-2">
                    {formData.regular_dental_treatment && <Badge variant="outline">Regular Dental Treatment</Badge>}
                    {formData.dental_cleaning && <Badge variant="outline">Dental Cleaning</Badge>}
                    {formData.trauma_treatment && <Badge variant="outline">Trauma Treatment</Badge>}
                    {formData.trauma_rta && <Badge variant="outline">RTA</Badge>}
                    {formData.work_related && <Badge variant="outline">Work Related</Badge>}
                    {formData.other_treatment && <Badge variant="outline">Other</Badge>}
                  </div>
                </div>

                {(formData.treatment_how || formData.treatment_when || formData.treatment_where) && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 border-t pt-4">
                    <div>
                      <Label className="text-xs text-gray-500 uppercase tracking-wide">How</Label>
                      <p className="mt-2 text-sm font-medium text-gray-900">{formData.treatment_how || 'N/A'}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-gray-500 uppercase tracking-wide">When</Label>
                      <p className="mt-2 text-sm font-medium text-gray-900">{formData.treatment_when || 'N/A'}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-gray-500 uppercase tracking-wide">Where</Label>
                      <p className="mt-2 text-sm font-medium text-gray-900">{formData.treatment_where || 'N/A'}</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Dental Procedures */}
            <Card className="border-l-4 border-l-green-500 print:break-inside-avoid">
              <CardHeader className="bg-gradient-to-r from-green-50 to-transparent">
                <div className="flex items-center gap-2">
                  <Stethoscope className="h-5 w-5 text-green-600" />
                  <CardTitle className="text-green-900">Dental Procedures</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-6">
                {formData.procedures && formData.procedures.length > 0 ? (
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-gray-50">
                          <TableHead className="font-semibold">Code</TableHead>
                          <TableHead className="font-semibold">Dental / Service</TableHead>
                          <TableHead className="font-semibold">Tooth No.</TableHead>
                          <TableHead className="font-semibold text-right">Cost</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {formData.procedures.map((proc, index) => (
                          <TableRow key={index} className="hover:bg-gray-50">
                            <TableCell className="font-medium">{proc.code || 'N/A'}</TableCell>
                            <TableCell>{proc.service_description || 'N/A'}</TableCell>
                            <TableCell>{proc.tooth_number || 'N/A'}</TableCell>
                            <TableCell className="text-right font-semibold">
                              ${parseFloat(proc.cost || 0).toFixed(2)}
                            </TableCell>
                          </TableRow>
                        ))}
                        <TableRow className="bg-gray-50 font-semibold">
                          <TableCell colSpan={3} className="text-right">Total Cost:</TableCell>
                          <TableCell className="text-right">
                            ${totalCost.toFixed(2)}
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="text-center py-8 bg-gray-50 rounded-lg">
                    <Stethoscope className="h-12 w-12 text-gray-300 mx-auto mb-2" />
                    <p className="text-gray-500 text-sm">No procedures added</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Medications */}
            <Card className="border-l-4 border-l-orange-500 print:break-inside-avoid">
              <CardHeader className="bg-gradient-to-r from-orange-50 to-transparent">
                <div className="flex items-center gap-2">
                  <Pill className="h-5 w-5 text-orange-600" />
                  <CardTitle className="text-orange-900">Medications</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-6">
                {formData.medications && formData.medications.length > 0 ? (
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-gray-50">
                          <TableHead className="font-semibold">Medication Name (Generic Name)</TableHead>
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
                  <Shield className="h-5 w-5 text-teal-600" />
                  <CardTitle className="text-teal-900">Provider Approval/Coding Staff</CardTitle>
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

            {/* Print Footer */}
            <div className="hidden print:block border-t-2 border-gray-200 pt-4 mt-8 text-center text-xs text-gray-500">
              <p>Generated on {formatDate(new Date())}</p>
              <p className="mt-1">This is an official document - Dental Approval Form</p>
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
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-green-50 rounded-lg p-3 text-center">
                      <Stethoscope className="h-5 w-5 text-green-600 mx-auto mb-1" />
                      <p className="text-lg font-bold text-green-600">{formData.procedures?.length || 0}</p>
                      <p className="text-xs text-gray-600">Procedures</p>
                    </div>
                    <div className="bg-orange-50 rounded-lg p-3 text-center">
                      <Pill className="h-5 w-5 text-orange-600 mx-auto mb-1" />
                      <p className="text-lg font-bold text-orange-600">{formData.medications?.length || 0}</p>
                      <p className="text-xs text-gray-600">Meds</p>
                    </div>
                  </div>
                  <div className="mt-2 bg-purple-50 rounded-lg p-3 text-center">
                    <p className="text-xs text-gray-500 mb-1">Total Cost</p>
                    <p className="text-2xl font-bold text-purple-600">${totalCost.toFixed(2)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Action Buttons */}
            <Card>
              <CardContent className="p-4 space-y-2">
                <Button
                  onClick={() => navigate(`/dental-approvals/${id}/edit`)}
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
                <Button
                  onClick={handleDelete}
                  variant="destructive"
                  className="w-full"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Form
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>

      </div>

      {/* Print-Only Hospital Form Template */}
      <div ref={printRef} className="hidden print:block pdf-export-content">
        <div className="form-template" style={{ fontFamily: 'Arial, sans-serif', fontSize: '11px', lineHeight: '1.4', padding: '20px' }}>
          
          {/* Header */}
          <div style={{ textAlign: 'center', marginBottom: '15px', borderBottom: '2px solid #000', paddingBottom: '10px' }}>
            <h1 style={{ fontSize: '18px', fontWeight: 'bold', margin: '0' }}>DENTAL APPROVALS AND CLAIMS APPLICATION FORM</h1>
            <p style={{ fontSize: '10px', margin: '5px 0 0 0' }}>Form Number: {formData.form_number || 'N/A'} | Status: {formData.status || 'N/A'}</p>
          </div>

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
                <span style={{ marginLeft: '10px' }}>TPA Company Name: <span style={{ borderBottom: '1px dotted #000', display: 'inline-block', minWidth: '120px' }}>{formData.tpa_company_name || ''}</span></span>
              </div>
              <div style={{ marginBottom: '4px' }}>
                Patient File Number: <span style={{ borderBottom: '1px dotted #000', display: 'inline-block', minWidth: '150px' }}>{formData.patient_file_number || ''}</span>
              </div>
              <div style={{ marginBottom: '4px' }}>
                Plan Type: <span style={{ borderBottom: '1px dotted #000', display: 'inline-block', minWidth: '100px' }}>{formData.plan_type || ''}</span>
              </div>
              <div style={{ marginBottom: '4px' }}>
                Date of visit: <span style={{ borderBottom: '1px dotted #000', display: 'inline-block', minWidth: '150px' }}>{formatDate(formData.date_of_visit)}</span>
              </div>
              <div>
                New visit ( {formData.new_visit ? '✓' : '\u00A0'} )
                <span style={{ marginLeft: '10px' }}>Follow Up ( {formData.follow_up ? '✓' : '\u00A0'} )</span>
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
                Expiry Date: <span style={{ borderBottom: '1px dotted #000', display: 'inline-block', minWidth: '150px' }}>{formatDate(formData.expiry_date)}</span>
              </div>
              <div>
                Class: <span style={{ borderBottom: '1px dotted #000', display: 'inline-block', minWidth: '100px' }}>{formData.class || ''}</span>
              </div>
            </div>

          </div>

          {/* Main Dentist Section */}
          <div style={{ border: '2px solid #000', padding: '10px', marginBottom: '10px' }}>
            <div style={{ fontWeight: 'bold', marginBottom: '10px', fontSize: '11px' }}>
              To be completed by the Attending DENTIST: Please tick ( ✓ )
            </div>

            {/* Duration */}
            <div style={{ marginBottom: '8px' }}>
              Duration of Illness: <span style={{ borderBottom: '1px dotted #000', display: 'inline-block', minWidth: '40px' }}>{formData.duration_of_illness_days || ''}</span> (Days)
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

            {/* Diagnosis */}
            <div style={{ marginBottom: '8px' }}>
              <span style={{ fontWeight: 'bold', fontSize: '10px' }}>Diagnosis (ICD10):</span>
              <span style={{ marginLeft: '10px', borderBottom: '1px solid #000', display: 'inline-block', minWidth: '100px' }}>{formData.diagnosis_icd10 || ''}</span>
            </div>
            <div style={{ marginBottom: '6px' }}>
              <span style={{ fontWeight: 'bold', fontSize: '10px' }}>Primary Diagnosis:</span>
              <div style={{ borderBottom: '1px dotted #000', minHeight: '25px', paddingTop: '2px' }}>
                {formData.primary_diagnosis || ''}
              </div>
            </div>
            <div style={{ marginBottom: '6px' }}>
              <span style={{ fontWeight: 'bold', fontSize: '10px' }}>Secondary Diagnosis:</span>
              <div style={{ borderBottom: '1px dotted #000', minHeight: '25px', paddingTop: '2px' }}>
                {formData.secondary_diagnosis || ''}
              </div>
            </div>
            <div style={{ marginBottom: '6px' }}>
              <span style={{ fontWeight: 'bold', fontSize: '10px' }}>Other Conditions:</span>
              <div style={{ borderBottom: '1px dotted #000', minHeight: '25px', paddingTop: '2px' }}>
                {formData.other_conditions || ''}
              </div>
            </div>

            {/* Treatment Type */}
            <div style={{ marginBottom: '8px', borderTop: '1px solid #000', paddingTop: '4px' }}>
              <div style={{ fontWeight: 'bold', marginBottom: '4px', fontSize: '10px' }}>
                Treatment Type - Please tick ( ✓ ):
              </div>
              <div>
                Regular Dental Treatment ( {formData.regular_dental_treatment ? '✓' : '\u00A0'} )
                <span style={{ marginLeft: '20px' }}>Dental Cleaning ( {formData.dental_cleaning ? '✓' : '\u00A0'} )</span>
                <span style={{ marginLeft: '20px' }}>Trauma Treatment ( {formData.trauma_treatment ? '✓' : '\u00A0'} )</span>
              </div>
              <div style={{ marginTop: '4px' }}>
                RTA ( {formData.trauma_rta ? '✓' : '\u00A0'} )
                <span style={{ marginLeft: '20px' }}>Work Related ( {formData.work_related ? '✓' : '\u00A0'} )</span>
                <span style={{ marginLeft: '20px' }}>Other ( {formData.other_treatment ? '✓' : '\u00A0'} )</span>
              </div>
            </div>

            {/* Procedures Table */}
            <div style={{ marginBottom: '10px', fontSize: '10px' }}>
              <span style={{ fontWeight: 'bold' }}>Dental Procedures:</span>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '10px', fontSize: '10px' }}>
              <thead>
                <tr style={{ backgroundColor: '#fff' }}>
                  <th style={{ border: '2px solid #000', padding: '6px', fontWeight: 'bold', textAlign: 'left' }}>Code</th>
                  <th style={{ border: '2px solid #000', padding: '6px', fontWeight: 'bold', textAlign: 'left' }}>Dental / Service Description</th>
                  <th style={{ border: '2px solid #000', padding: '6px', fontWeight: 'bold', textAlign: 'center', width: '80px' }}>Tooth No.</th>
                  <th style={{ border: '2px solid #000', padding: '6px', fontWeight: 'bold', textAlign: 'right', width: '80px' }}>Cost</th>
                </tr>
              </thead>
              <tbody>
                {formData.procedures && formData.procedures.length > 0 ? (
                  formData.procedures.map((proc, index) => (
                    <tr key={index}>
                      <td style={{ border: '1px solid #000', padding: '6px' }}>{proc.code || ''}</td>
                      <td style={{ border: '1px solid #000', padding: '6px' }}>{proc.service_description || ''}</td>
                      <td style={{ border: '1px solid #000', padding: '6px', textAlign: 'center' }}>{proc.tooth_number || ''}</td>
                      <td style={{ border: '1px solid #000', padding: '6px', textAlign: 'right' }}>{proc.cost || ''}</td>
                    </tr>
                  ))
                ) : (
                  <>
                    <tr>
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
                    </tr>
                  </>
                )}
                <tr style={{ fontWeight: 'bold' }}>
                  <td colSpan="3" style={{ border: '2px solid #000', padding: '6px', textAlign: 'right' }}>Total Cost:</td>
                  <td style={{ border: '2px solid #000', padding: '6px', textAlign: 'right' }}>${totalCost.toFixed(2)}</td>
                </tr>
              </tbody>
            </table>

            {/* Provider Approval */}
            <div style={{ marginBottom: '10px', fontSize: '10px', borderTop: '1px solid #000', paddingTop: '6px' }}>
              <span style={{ fontWeight: 'bold' }}>Provider Approval/Coding Staff must review/code and complete the following:</span>
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
                <span style={{ fontWeight: 'bold' }}>Date</span>
                <div style={{ borderBottom: '1px solid #000', minHeight: '20px' }}>{formatDate(formData.provider_date)}</div>
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
                  </>
                )}
              </tbody>
            </table>

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

