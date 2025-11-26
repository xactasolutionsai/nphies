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
  Eye,
  FileText,
  Brain,
  Lightbulb,
  AlertTriangle,
  FlaskConical
} from 'lucide-react';

export default function EyeApprovalsDetails() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState(null);
  const [exportingPDF, setExportingPDF] = useState(false);
  const [aiValidations, setAiValidations] = useState([]);
  const [loadingAiValidations, setLoadingAiValidations] = useState(false);
  const printRef = useRef();

  useEffect(() => {
    loadFormData();
    loadAiValidations();
  }, [id]);

  const loadFormData = async () => {
    try {
      setLoading(true);
      const response = await api.getEyeApproval(id);
      const data = response.data || response;
      
      // Parse JSONB fields
      const parsedData = {
        ...data,
        right_eye_specs: typeof data.right_eye_specs === 'string' ? JSON.parse(data.right_eye_specs) : (data.right_eye_specs || {}),
        left_eye_specs: typeof data.left_eye_specs === 'string' ? JSON.parse(data.left_eye_specs) : (data.left_eye_specs || {}),
        lens_specifications: typeof data.lens_specifications === 'string' ? JSON.parse(data.lens_specifications) : (data.lens_specifications || {}),
        procedures: data.procedures || []
      };
      
      setFormData(parsedData);
    } catch (error) {
      console.error('Error loading form:', error);
      alert('Error loading form data');
      navigate('/eye-approvals');
    } finally {
      setLoading(false);
    }
  };

  const loadAiValidations = async () => {
    try {
      setLoadingAiValidations(true);
      // Fetch AI validations for this form from the database
      const response = await api.request(`/ai-validation/history/${id}`);
      const data = response.data || [];
      setAiValidations(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error loading AI validations:', error);
      // Silent fail - AI validations are optional
      setAiValidations([]);
    } finally {
      setLoadingAiValidations(false);
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
      
      element.classList.remove('hidden');
      element.classList.add('pdf-export');
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
      });
      
      element.classList.add('hidden');
      element.classList.remove('pdf-export');
      
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;
      
      const ratio = imgWidth / imgHeight;
      let finalWidth = pdfWidth - 20;
      let finalHeight = finalWidth / ratio;
      
      if (finalHeight > pdfHeight - 20) {
        finalHeight = pdfHeight - 20;
        finalWidth = finalHeight * ratio;
      }
      
      const imgX = (pdfWidth - finalWidth) / 2;
      const imgY = 10;
      
      pdf.addImage(imgData, 'PNG', imgX, imgY, finalWidth, finalHeight);
      pdf.save(`EyeApproval_${formData?.form_number || 'Form'}_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Error generating PDF. Please try again.');
    } finally {
      setExportingPDF(false);
    }
  };

  const handleDelete = async () => {
    if (window.confirm('Are you sure you want to delete this eye form?')) {
      try {
        await api.deleteEyeApproval(id);
        alert('Form deleted successfully');
        navigate('/eye-approvals');
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
            onClick={() => navigate('/eye-approvals')}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Eye Approval Form
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
                  <h1 className="text-2xl font-bold text-gray-900">Eye/Optical Approval Form</h1>
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

            {/* Section 3: Optician Section */}
            <Card className="border-l-4 border-l-purple-500 print:break-inside-avoid">
              <CardHeader className="bg-gradient-to-r from-purple-50 to-transparent">
                <div className="flex items-center gap-2">
                  <Eye className="h-5 w-5 text-purple-600" />
                  <CardTitle className="text-purple-900">Section 3: Optician Information</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-6 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
                  <div>
                    <Label className="text-xs text-gray-500 uppercase tracking-wide">Duration of Illness</Label>
                    <p className="mt-2 text-sm font-semibold text-gray-900">{formData.duration_of_illness_days ? `${formData.duration_of_illness_days} days` : 'N/A'}</p>
                  </div>
                </div>
                <div className="border-t pt-4">
                  <Label className="text-xs text-gray-500 uppercase tracking-wide">Chief Complaints</Label>
                  <p className="mt-2 text-sm text-gray-700 leading-relaxed">{formData.chief_complaints || 'N/A'}</p>
                </div>
                <div className="border-t pt-4">
                  <Label className="text-xs text-gray-500 uppercase tracking-wide">Significant Signs</Label>
                  <p className="mt-2 text-sm text-gray-700 leading-relaxed">{formData.significant_signs || 'N/A'}</p>
                </div>
              </CardContent>
            </Card>

            {/* Eye Specifications */}
            <Card className="border-l-4 border-l-green-500 print:break-inside-avoid">
              <CardHeader className="bg-gradient-to-r from-green-50 to-transparent">
                <div className="flex items-center gap-2">
                  <Eye className="h-5 w-5 text-green-600" />
                  <CardTitle className="text-green-900">Eye Specifications</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-6 space-y-6">
                {/* Right Eye */}
                <div>
                  <h4 className="text-sm font-semibold text-gray-900 mb-3">RIGHT EYE</h4>
                  <div className="overflow-x-auto">
                    <table className="w-full border border-gray-300 text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="border border-gray-300 px-3 py-2 text-left"></th>
                          <th className="border border-gray-300 px-3 py-2">Sphere</th>
                          <th className="border border-gray-300 px-3 py-2">Cylinder</th>
                          <th className="border border-gray-300 px-3 py-2">Axis</th>
                          <th className="border border-gray-300 px-3 py-2">Prism</th>
                          <th className="border border-gray-300 px-3 py-2">V/N</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td className="border border-gray-300 px-3 py-2 font-medium">Distance</td>
                          <td className="border border-gray-300 px-3 py-2 text-center">{formData.right_eye_specs?.distance?.sphere || 'N/A'}</td>
                          <td className="border border-gray-300 px-3 py-2 text-center">{formData.right_eye_specs?.distance?.cylinder || 'N/A'}</td>
                          <td className="border border-gray-300 px-3 py-2 text-center">{formData.right_eye_specs?.distance?.axis || 'N/A'}</td>
                          <td className="border border-gray-300 px-3 py-2 text-center">{formData.right_eye_specs?.distance?.prism || 'N/A'}</td>
                          <td className="border border-gray-300 px-3 py-2 text-center">{formData.right_eye_specs?.distance?.vn || 'N/A'}</td>
                        </tr>
                        <tr>
                          <td className="border border-gray-300 px-3 py-2 font-medium">Near</td>
                          <td className="border border-gray-300 px-3 py-2 text-center">{formData.right_eye_specs?.near?.sphere || 'N/A'}</td>
                          <td className="border border-gray-300 px-3 py-2 text-center">{formData.right_eye_specs?.near?.cylinder || 'N/A'}</td>
                          <td className="border border-gray-300 px-3 py-2 text-center">{formData.right_eye_specs?.near?.axis || 'N/A'}</td>
                          <td className="border border-gray-300 px-3 py-2 text-center">{formData.right_eye_specs?.near?.prism || 'N/A'}</td>
                          <td className="border border-gray-300 px-3 py-2 text-center">{formData.right_eye_specs?.near?.vn || 'N/A'}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="font-medium">Bifocal Add:</span> {formData.right_eye_specs?.bifocal_add || 'N/A'}
                    </div>
                    <div>
                      <span className="font-medium">Vertex Add:</span> {formData.right_eye_specs?.vertex_add || 'N/A'}
                    </div>
                  </div>
                </div>

                {/* Left Eye */}
                <div>
                  <h4 className="text-sm font-semibold text-gray-900 mb-3">LEFT EYE</h4>
                  <div className="overflow-x-auto">
                    <table className="w-full border border-gray-300 text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="border border-gray-300 px-3 py-2 text-left"></th>
                          <th className="border border-gray-300 px-3 py-2">Sphere</th>
                          <th className="border border-gray-300 px-3 py-2">Cylinder</th>
                          <th className="border border-gray-300 px-3 py-2">Axis</th>
                          <th className="border border-gray-300 px-3 py-2">Prism</th>
                          <th className="border border-gray-300 px-3 py-2">V/N</th>
                          <th className="border border-gray-300 px-3 py-2">PD</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td className="border border-gray-300 px-3 py-2 font-medium">Distance</td>
                          <td className="border border-gray-300 px-3 py-2 text-center">{formData.left_eye_specs?.distance?.sphere || 'N/A'}</td>
                          <td className="border border-gray-300 px-3 py-2 text-center">{formData.left_eye_specs?.distance?.cylinder || 'N/A'}</td>
                          <td className="border border-gray-300 px-3 py-2 text-center">{formData.left_eye_specs?.distance?.axis || 'N/A'}</td>
                          <td className="border border-gray-300 px-3 py-2 text-center">{formData.left_eye_specs?.distance?.prism || 'N/A'}</td>
                          <td className="border border-gray-300 px-3 py-2 text-center">{formData.left_eye_specs?.distance?.vn || 'N/A'}</td>
                          <td className="border border-gray-300 px-3 py-2 text-center">{formData.left_eye_specs?.distance?.pd || 'N/A'}</td>
                        </tr>
                        <tr>
                          <td className="border border-gray-300 px-3 py-2 font-medium">Near</td>
                          <td className="border border-gray-300 px-3 py-2 text-center">{formData.left_eye_specs?.near?.sphere || 'N/A'}</td>
                          <td className="border border-gray-300 px-3 py-2 text-center">{formData.left_eye_specs?.near?.cylinder || 'N/A'}</td>
                          <td className="border border-gray-300 px-3 py-2 text-center">{formData.left_eye_specs?.near?.axis || 'N/A'}</td>
                          <td className="border border-gray-300 px-3 py-2 text-center">{formData.left_eye_specs?.near?.prism || 'N/A'}</td>
                          <td className="border border-gray-300 px-3 py-2 text-center">{formData.left_eye_specs?.near?.vn || 'N/A'}</td>
                          <td className="border border-gray-300 px-3 py-2 text-center"></td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  <div className="mt-2 text-sm">
                    <span className="font-medium">Bifocal Add:</span> {formData.left_eye_specs?.bifocal_add || 'N/A'}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Lens Specifications */}
            <Card className="border-l-4 border-l-orange-500 print:break-inside-avoid">
              <CardHeader className="bg-gradient-to-r from-orange-50 to-transparent">
                <div className="flex items-center gap-2">
                  <Stethoscope className="h-5 w-5 text-orange-600" />
                  <CardTitle className="text-orange-900">Lens Specifications</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-6 space-y-4">
                <div>
                  <Label className="text-xs text-gray-500 uppercase tracking-wide mb-2 block">Lens Type</Label>
                  <Badge variant="outline">{formData.lens_type || 'Not specified'}</Badge>
                </div>
                <div>
                  <Label className="text-xs text-gray-500 uppercase tracking-wide mb-3 block">Lens Specifications</Label>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(formData.lens_specifications || {}).map(([key, value]) => (
                      value && <Badge key={key} variant="outline">{key.replace(/_/g, ' ')}</Badge>
                    ))}
                  </div>
                </div>
                <div>
                  <Label className="text-xs text-gray-500 uppercase tracking-wide mb-3 block">Contact Lenses</Label>
                  <div className="flex gap-2">
                    {formData.contact_lenses_permanent && <Badge variant="outline">Permanent</Badge>}
                    {formData.contact_lenses_disposal && <Badge variant="outline">Disposal</Badge>}
                  </div>
                </div>
                <div>
                  <Label className="text-xs text-gray-500 uppercase tracking-wide mb-3 block">Frames</Label>
                  <div>
                    {formData.frames_required ? (
                      <Badge variant="outline">Yes - {formData.number_of_pairs || 0} pair(s)</Badge>
                    ) : (
                      <Badge variant="outline">No</Badge>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Procedures */}
            <Card className="border-l-4 border-l-teal-500 print:break-inside-avoid">
              <CardHeader className="bg-gradient-to-r from-teal-50 to-transparent">
                <div className="flex items-center gap-2">
                  <Stethoscope className="h-5 w-5 text-teal-600" />
                  <CardTitle className="text-teal-900">Procedures</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-6">
                {formData.procedures && formData.procedures.length > 0 ? (
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-gray-50">
                          <TableHead className="font-semibold">Code</TableHead>
                          <TableHead className="font-semibold">Service</TableHead>
                          <TableHead className="font-semibold">Type</TableHead>
                          <TableHead className="font-semibold text-right">Cost</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {formData.procedures.map((proc, index) => (
                          <TableRow key={index} className="hover:bg-gray-50">
                            <TableCell className="font-medium">{proc.code || 'N/A'}</TableCell>
                            <TableCell>{proc.service_description || 'N/A'}</TableCell>
                            <TableCell>{proc.type || 'N/A'}</TableCell>
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

            {/* Provider Approval */}
            <Card className="border-l-4 border-l-indigo-500 print:break-inside-avoid">
              <CardHeader className="bg-gradient-to-r from-indigo-50 to-transparent">
                <div className="flex items-center gap-2">
                  <Shield className="h-5 w-5 text-indigo-600" />
                  <CardTitle className="text-indigo-900">Provider Approval/Coding Staff</CardTitle>
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

            {/* AI Validation Section - Only visible on screen */}
            {aiValidations.length > 0 && (
              <Card className="border-l-4 border-l-purple-500 print:hidden">
                <CardHeader className="bg-gradient-to-r from-purple-50 to-transparent">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Brain className="h-5 w-5 text-purple-600" />
                      <CardTitle className="text-purple-900">AI Medical Validation</CardTitle>
                    </div>
                    <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-300">
                      {aiValidations.length} validation{aiValidations.length > 1 ? 's' : ''}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="pt-6 space-y-6">
                  {aiValidations.map((validation, index) => {
                    // Parse validation_result if it's a string, otherwise use as-is
                    const validationResult = typeof validation.validation_result === 'string' 
                      ? JSON.parse(validation.validation_result) 
                      : (validation.validation_result || {});
                    
                    // Extract arrays from the validation result
                    const recommendations = Array.isArray(validationResult.recommendations) 
                      ? validationResult.recommendations 
                      : [];
                    const missingAnalyses = Array.isArray(validationResult.missingAnalyses) 
                      ? validationResult.missingAnalyses 
                      : [];
                    const warnings = Array.isArray(validationResult.warnings) 
                      ? validationResult.warnings 
                      : [];
                    
                    return (
                      <div key={validation.id || index} className="border-b last:border-b-0 pb-6 last:pb-0">
                        {/* Validation Header */}
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-3">
                            <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium ${
                              validation.is_valid 
                                ? 'bg-green-100 text-green-700' 
                                : 'bg-orange-100 text-orange-700'
                            }`}>
                              {validation.is_valid ? (
                                <>✓ Valid</>
                              ) : (
                                <>⚠ Issues Detected</>
                              )}
                            </div>
                            {validation.confidence_score && (
                              <span className="text-sm text-gray-500">
                                Confidence: {(parseFloat(validation.confidence_score) * 100).toFixed(0)}%
                              </span>
                            )}
                          </div>
                          <span className="text-xs text-gray-500">
                            {validation.created_at 
                              ? format(new Date(validation.created_at), 'MMM dd, yyyy HH:mm')
                              : 'N/A'
                            }
                          </span>
                        </div>

                        {/* Warnings */}
                        {warnings.length > 0 && (
                          <div className="mb-4">
                            <div className="flex items-center gap-2 mb-3">
                              <AlertTriangle className="h-4 w-4 text-orange-600" />
                              <Label className="text-xs text-gray-700 uppercase tracking-wide font-semibold">
                                Warnings ({warnings.length})
                              </Label>
                            </div>
                            <div className="space-y-2">
                              {warnings.map((warning, idx) => (
                                <div 
                                  key={idx} 
                                  className={`p-3 rounded-lg border-l-4 ${
                                    warning.severity === 'high' 
                                      ? 'bg-red-50 border-red-500' 
                                      : warning.severity === 'medium' 
                                      ? 'bg-orange-50 border-orange-500' 
                                      : 'bg-yellow-50 border-yellow-500'
                                  }`}
                                >
                                  <div className="flex items-start gap-2">
                                    <Badge variant="outline" className="text-xs">
                                      {warning.field || 'general'}
                                    </Badge>
                                    <p className="text-sm text-gray-700 flex-1">
                                      {warning.message}
                                    </p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Recommendations */}
                        {recommendations.length > 0 && (
                          <div className="mb-4">
                            <div className="flex items-center gap-2 mb-3">
                              <Lightbulb className="h-4 w-4 text-blue-600" />
                              <Label className="text-xs text-gray-700 uppercase tracking-wide font-semibold">
                                Recommendations ({recommendations.length})
                              </Label>
                            </div>
                            <ul className="space-y-2">
                              {recommendations.map((rec, idx) => (
                                <li key={idx} className="flex items-start gap-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                                  <div className="mt-1 flex-shrink-0">
                                    <div className="h-1.5 w-1.5 rounded-full bg-blue-500"></div>
                                  </div>
                                  <span className="text-sm text-gray-700">{rec}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {/* Missing Analyses */}
                        {missingAnalyses.length > 0 && (
                          <div>
                            <div className="flex items-center gap-2 mb-3">
                              <FlaskConical className="h-4 w-4 text-purple-600" />
                              <Label className="text-xs text-gray-700 uppercase tracking-wide font-semibold">
                                Suggested Additional Tests ({missingAnalyses.length})
                              </Label>
                            </div>
                            <ul className="space-y-2">
                              {missingAnalyses.map((analysis, idx) => (
                                <li key={idx} className="flex items-start gap-3 p-3 bg-purple-50 rounded-lg border border-purple-200">
                                  <div className="mt-1 flex-shrink-0">
                                    <div className="h-1.5 w-1.5 rounded-full bg-purple-500"></div>
                                  </div>
                                  <span className="text-sm text-gray-700">{analysis}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {/* No content */}
                        {warnings.length === 0 && recommendations.length === 0 && missingAnalyses.length === 0 && (
                          <div className="text-center py-4 text-gray-500 text-sm">
                            No validation details available
                          </div>
                        )}
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            )}

            {/* Print Footer */}
            <div className="hidden print:block border-t-2 border-gray-200 pt-4 mt-8 text-center text-xs text-gray-500">
              <p>Generated on {formatDate(new Date())}</p>
              <p className="mt-1">This is an official document - Eye/Optical Approval Form</p>
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
                      <Eye className="h-5 w-5 text-orange-600 mx-auto mb-1" />
                      <p className="text-lg font-bold text-orange-600">2</p>
                      <p className="text-xs text-gray-600">Eyes</p>
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
                  onClick={() => navigate(`/eye-approvals/${id}/edit`)}
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
            <h1 style={{ fontSize: '18px', fontWeight: 'bold', margin: '0' }}>EYE/OPTICAL APPROVALS AND CLAIMS APPLICATION FORM</h1>
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
                <span style={{ marginLeft: '10px' }}>Approval: <span style={{ borderBottom: '1px dotted #000', display: 'inline-block', minWidth: '100px' }}>{formData.approval || ''}</span></span>
              </div>
            </div>

          </div>

          {/* Main Optician Section */}
          <div style={{ border: '2px solid #000', padding: '10px', marginBottom: '10px' }}>
            <div style={{ fontWeight: 'bold', marginBottom: '10px', fontSize: '11px' }}>
              To be completed by the Attending OPTICIAN:
            </div>

            {/* Eye Specifications Tables */}
            <div style={{ marginBottom: '10px' }}>
              <div style={{ fontWeight: 'bold', fontSize: '10px', marginBottom: '5px' }}>RIGHT EYE</div>
              <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '10px', fontSize: '10px' }}>
                <thead>
                  <tr style={{ backgroundColor: '#fff' }}>
                    <th style={{ border: '2px solid #000', padding: '6px', fontWeight: 'bold', textAlign: 'left', width: '100px' }}></th>
                    <th style={{ border: '2px solid #000', padding: '6px', fontWeight: 'bold', textAlign: 'center' }}>Sphere</th>
                    <th style={{ border: '2px solid #000', padding: '6px', fontWeight: 'bold', textAlign: 'center' }}>Cylinder</th>
                    <th style={{ border: '2px solid #000', padding: '6px', fontWeight: 'bold', textAlign: 'center' }}>Axis</th>
                    <th style={{ border: '2px solid #000', padding: '6px', fontWeight: 'bold', textAlign: 'center' }}>Prism</th>
                    <th style={{ border: '2px solid #000', padding: '6px', fontWeight: 'bold', textAlign: 'center' }}>V/N</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style={{ border: '1px solid #000', padding: '6px', fontWeight: 'bold' }}>Distance</td>
                    <td style={{ border: '1px solid #000', padding: '6px', textAlign: 'center' }}>{formData.right_eye_specs?.distance?.sphere || ''}</td>
                    <td style={{ border: '1px solid #000', padding: '6px', textAlign: 'center' }}>{formData.right_eye_specs?.distance?.cylinder || ''}</td>
                    <td style={{ border: '1px solid #000', padding: '6px', textAlign: 'center' }}>{formData.right_eye_specs?.distance?.axis || ''}</td>
                    <td style={{ border: '1px solid #000', padding: '6px', textAlign: 'center' }}>{formData.right_eye_specs?.distance?.prism || ''}</td>
                    <td style={{ border: '1px solid #000', padding: '6px', textAlign: 'center' }}>{formData.right_eye_specs?.distance?.vn || ''}</td>
                  </tr>
                  <tr>
                    <td style={{ border: '1px solid #000', padding: '6px', fontWeight: 'bold' }}>Near</td>
                    <td style={{ border: '1px solid #000', padding: '6px', textAlign: 'center' }}>{formData.right_eye_specs?.near?.sphere || ''}</td>
                    <td style={{ border: '1px solid #000', padding: '6px', textAlign: 'center' }}>{formData.right_eye_specs?.near?.cylinder || ''}</td>
                    <td style={{ border: '1px solid #000', padding: '6px', textAlign: 'center' }}>{formData.right_eye_specs?.near?.axis || ''}</td>
                    <td style={{ border: '1px solid #000', padding: '6px', textAlign: 'center' }}>{formData.right_eye_specs?.near?.prism || ''}</td>
                    <td style={{ border: '1px solid #000', padding: '6px', textAlign: 'center' }}>{formData.right_eye_specs?.near?.vn || ''}</td>
                  </tr>
                  <tr>
                    <td style={{ border: '1px solid #000', padding: '6px', fontWeight: 'bold' }}>Bifocal</td>
                    <td colSpan="2" style={{ border: '1px solid #000', padding: '6px' }}>Add: {formData.right_eye_specs?.bifocal_add || ''}</td>
                    <td colSpan="3" style={{ border: '1px solid #000', padding: '6px' }}>Vertex: {formData.right_eye_specs?.vertex_add || ''}</td>
                  </tr>
                </tbody>
              </table>

              <div style={{ fontWeight: 'bold', fontSize: '10px', marginBottom: '5px' }}>LEFT EYE</div>
              <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '10px', fontSize: '10px' }}>
                <thead>
                  <tr style={{ backgroundColor: '#fff' }}>
                    <th style={{ border: '2px solid #000', padding: '6px', fontWeight: 'bold', textAlign: 'left', width: '100px' }}></th>
                    <th style={{ border: '2px solid #000', padding: '6px', fontWeight: 'bold', textAlign: 'center' }}>Sphere</th>
                    <th style={{ border: '2px solid #000', padding: '6px', fontWeight: 'bold', textAlign: 'center' }}>Cylinder</th>
                    <th style={{ border: '2px solid #000', padding: '6px', fontWeight: 'bold', textAlign: 'center' }}>Axis</th>
                    <th style={{ border: '2px solid #000', padding: '6px', fontWeight: 'bold', textAlign: 'center' }}>Prism</th>
                    <th style={{ border: '2px solid #000', padding: '6px', fontWeight: 'bold', textAlign: 'center' }}>V/N</th>
                    <th style={{ border: '2px solid #000', padding: '6px', fontWeight: 'bold', textAlign: 'center' }}>PD</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style={{ border: '1px solid #000', padding: '6px', fontWeight: 'bold' }}>Distance</td>
                    <td style={{ border: '1px solid #000', padding: '6px', textAlign: 'center' }}>{formData.left_eye_specs?.distance?.sphere || ''}</td>
                    <td style={{ border: '1px solid #000', padding: '6px', textAlign: 'center' }}>{formData.left_eye_specs?.distance?.cylinder || ''}</td>
                    <td style={{ border: '1px solid #000', padding: '6px', textAlign: 'center' }}>{formData.left_eye_specs?.distance?.axis || ''}</td>
                    <td style={{ border: '1px solid #000', padding: '6px', textAlign: 'center' }}>{formData.left_eye_specs?.distance?.prism || ''}</td>
                    <td style={{ border: '1px solid #000', padding: '6px', textAlign: 'center' }}>{formData.left_eye_specs?.distance?.vn || ''}</td>
                    <td style={{ border: '1px solid #000', padding: '6px', textAlign: 'center' }}>{formData.left_eye_specs?.distance?.pd || ''}</td>
                  </tr>
                  <tr>
                    <td style={{ border: '1px solid #000', padding: '6px', fontWeight: 'bold' }}>Near</td>
                    <td style={{ border: '1px solid #000', padding: '6px', textAlign: 'center' }}>{formData.left_eye_specs?.near?.sphere || ''}</td>
                    <td style={{ border: '1px solid #000', padding: '6px', textAlign: 'center' }}>{formData.left_eye_specs?.near?.cylinder || ''}</td>
                    <td style={{ border: '1px solid #000', padding: '6px', textAlign: 'center' }}>{formData.left_eye_specs?.near?.axis || ''}</td>
                    <td style={{ border: '1px solid #000', padding: '6px', textAlign: 'center' }}>{formData.left_eye_specs?.near?.prism || ''}</td>
                    <td style={{ border: '1px solid #000', padding: '6px', textAlign: 'center' }}>{formData.left_eye_specs?.near?.vn || ''}</td>
                    <td style={{ border: '1px solid #000', padding: '6px', textAlign: 'center' }}></td>
                  </tr>
                  <tr>
                    <td style={{ border: '1px solid #000', padding: '6px', fontWeight: 'bold' }}>Bifocal</td>
                    <td colSpan="6" style={{ border: '1px solid #000', padding: '6px' }}>Add: {formData.left_eye_specs?.bifocal_add || ''}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Lens Type */}
            <div style={{ marginBottom: '8px', borderTop: '1px solid #000', paddingTop: '6px' }}>
              <span style={{ fontWeight: 'bold', fontSize: '10px' }}>Regular Lenses Type:</span>
              <span style={{ marginLeft: '20px' }}>Glass ( {formData.lens_type === 'glass' ? '✓' : '\u00A0'} )</span>
              <span style={{ marginLeft: '20px' }}>Plastic ( {formData.lens_type === 'plastic' ? '✓' : '\u00A0'} )</span>
              <span style={{ marginLeft: '20px' }}>None ( {formData.lens_type === 'none' ? '✓' : '\u00A0'} )</span>
            </div>

            {/* Lens Specifications */}
            <div style={{ marginBottom: '8px', fontSize: '10px' }}>
              <span style={{ fontWeight: 'bold' }}>Lenses Specification:</span>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '4px', marginTop: '4px' }}>
                {Object.entries(formData.lens_specifications || {}).map(([key, value]) => (
                  <span key={key}>
                    {key.replace(/_/g, ' ').charAt(0).toUpperCase() + key.replace(/_/g, ' ').slice(1)} ( {value ? '✓' : '\u00A0'} )
                  </span>
                ))}
              </div>
            </div>

            {/* Contact Lenses */}
            <div style={{ marginBottom: '8px', fontSize: '10px' }}>
              <span style={{ fontWeight: 'bold' }}>Contact Lenses Type:</span>
              <span style={{ marginLeft: '20px' }}>Permanent ( {formData.contact_lenses_permanent ? '✓' : '\u00A0'} )</span>
              <span style={{ marginLeft: '20px' }}>Disposal ( {formData.contact_lenses_disposal ? '✓' : '\u00A0'} )</span>
            </div>

            {/* Frames */}
            <div style={{ marginBottom: '8px', fontSize: '10px' }}>
              <span style={{ fontWeight: 'bold' }}>Frames:</span>
              <span style={{ marginLeft: '20px' }}>Yes ( {formData.frames_required ? '✓' : '\u00A0'} )</span>
              <span style={{ marginLeft: '20px' }}>No ( {!formData.frames_required ? '✓' : '\u00A0'} )</span>
              {formData.frames_required && (
                <span style={{ marginLeft: '20px' }}>Number of pairs: <span style={{ borderBottom: '1px solid #000', display: 'inline-block', minWidth: '50px' }}>{formData.number_of_pairs || ''}</span></span>
              )}
            </div>

            {/* Procedures Table */}
            <div style={{ marginBottom: '10px', fontSize: '10px' }}>
              <span style={{ fontWeight: 'bold' }}>Procedures:</span>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '10px', fontSize: '10px' }}>
              <thead>
                <tr style={{ backgroundColor: '#fff' }}>
                  <th style={{ border: '2px solid #000', padding: '6px', fontWeight: 'bold', textAlign: 'left' }}>Code</th>
                  <th style={{ border: '2px solid #000', padding: '6px', fontWeight: 'bold', textAlign: 'left' }}>Service Description</th>
                  <th style={{ border: '2px solid #000', padding: '6px', fontWeight: 'bold', textAlign: 'center', width: '100px' }}>Type</th>
                  <th style={{ border: '2px solid #000', padding: '6px', fontWeight: 'bold', textAlign: 'right', width: '80px' }}>Cost</th>
                </tr>
              </thead>
              <tbody>
                {formData.procedures && formData.procedures.length > 0 ? (
                  formData.procedures.map((proc, index) => (
                    <tr key={index}>
                      <td style={{ border: '1px solid #000', padding: '6px' }}>{proc.code || ''}</td>
                      <td style={{ border: '1px solid #000', padding: '6px' }}>{proc.service_description || ''}</td>
                      <td style={{ border: '1px solid #000', padding: '6px', textAlign: 'center' }}>{proc.type || ''}</td>
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

        .pdf-export-content,
        .pdf-export {
          background: white !important;
        }

        .pdf-export-content *,
        .pdf-export * {
          color: #000000 !important;
        }

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

