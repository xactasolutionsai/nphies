import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { 
  ArrowLeft,
  Edit,
  Trash2,
  User,
  Mail,
  Phone,
  Calendar,
  FileText,
  Heart,
  MapPin,
  Briefcase,
  Globe,
  AlertCircle,
  Loader2
} from 'lucide-react';
import api, { extractErrorMessage } from '@/services/api';

export default function PatientDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [patient, setPatient] = useState(null);
  const [error, setError] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    loadPatient();
  }, [id]);

  const loadPatient = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.getPatient(id);
      setPatient(response.data || response);
    } catch (err) {
      console.error('Error loading patient:', err);
      setError(extractErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    try {
      setDeleting(true);
      await api.deletePatient(id);
      navigate('/patients');
    } catch (err) {
      console.error('Error deleting patient:', err);
      setError(extractErrorMessage(err));
      setShowDeleteConfirm(false);
    } finally {
      setDeleting(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'Invalid Date';
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const calculateAge = (birthDate) => {
    if (!birthDate) return 'N/A';
    const birth = new Date(birthDate);
    if (isNaN(birth.getTime())) return 'Invalid Date';
    const today = new Date();
    
    // Calculate total age in years
    let ageYears = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      ageYears--;
    }
    
    // Check if newborn (less than 1 year old or is_newborn flag is true)
    const isNewborn = patient?.is_newborn || ageYears < 1;
    
    if (isNewborn) {
      // Calculate months and days for newborns
      let months = today.getMonth() - birth.getMonth();
      let days = today.getDate() - birth.getDate();
      
      // Adjust for negative days
      if (days < 0) {
        months--;
        // Get days in the previous month
        const lastMonth = new Date(today.getFullYear(), today.getMonth(), 0);
        days += lastMonth.getDate();
      }
      
      // Adjust for negative months
      if (months < 0) {
        months += 12;
      }
      
      // Format the age string
      if (months === 0 && days === 0) {
        return 'Born today';
      } else if (months === 0) {
        return `${days} ${days === 1 ? 'day' : 'days'} old`;
      } else if (days === 0) {
        return `${months} ${months === 1 ? 'month' : 'months'} old`;
      } else {
        return `${months} ${months === 1 ? 'month' : 'months'} and ${days} ${days === 1 ? 'day' : 'days'} old`;
      }
    }
    
    return `${ageYears} ${ageYears === 1 ? 'year' : 'years'} old`;
  };

  const getIdentifierTypeLabel = (type) => {
    const types = {
      'national_id': 'National ID',
      'iqama': 'Iqama',
      'passport': 'Passport',
      'mrn': 'Medical Record Number',
      'border_number': 'Border Number',
      'displaced_person': 'Displaced Person',
      'gcc_id': 'GCC ID'
    };
    return types[type] || type || 'N/A';
  };

  const getNationalityLabel = (code) => {
    const countries = {
      'SAU': 'Saudi Arabia',
      'ARE': 'UAE',
      'KWT': 'Kuwait',
      'BHR': 'Bahrain',
      'QAT': 'Qatar',
      'OMN': 'Oman',
      'EGY': 'Egypt',
      'JOR': 'Jordan',
      'LBN': 'Lebanon',
      'SYR': 'Syria',
      'IRQ': 'Iraq',
      'YEM': 'Yemen',
      'PAK': 'Pakistan',
      'IND': 'India',
      'PHL': 'Philippines'
    };
    return countries[code] || code || 'N/A';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="relative">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-primary-purple/20"></div>
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-transparent border-t-primary-purple absolute top-0"></div>
        </div>
      </div>
    );
  }

  if (error && !patient) {
    return (
      <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <div className="bg-red-50 border-l-4 border-red-500 rounded-lg p-4">
            <div className="flex items-start space-x-3">
              <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-red-800 font-medium">Error</p>
                <p className="text-red-700 mt-1 text-sm">{error}</p>
              </div>
            </div>
            <button
              onClick={() => navigate('/patients')}
              className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              Back to Patients
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!patient) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => navigate('/patients')}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                title="Back to patients"
              >
                <ArrowLeft className="h-5 w-5 text-gray-600" />
              </button>
              <div className="flex items-center space-x-3">
                <div className="bg-gradient-to-br from-primary-purple to-accent-purple rounded-lg p-2.5">
                  <User className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h1 className="text-3xl font-bold text-gray-900">Patient Details</h1>
                  <p className="text-gray-600 mt-1">Comprehensive patient information</p>
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="px-4 py-2 text-red-600 hover:text-red-800 hover:bg-red-50 font-medium transition-colors rounded-lg border border-red-200 flex items-center space-x-2"
              >
                <Trash2 className="h-4 w-4" />
                <span>Delete</span>
              </button>
              <button
                onClick={() => navigate(`/patients/${id}/edit`)}
                className="bg-gradient-to-r from-primary-purple to-accent-purple text-white px-6 py-2 rounded-lg transition-all duration-200 font-medium flex items-center space-x-2 hover:shadow-md"
              >
                <Edit className="h-4 w-4" />
                <span>Edit Patient</span>
              </button>
            </div>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="bg-red-50 border-l-4 border-red-500 rounded-lg p-4 flex items-start space-x-3">
            <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-red-800 font-medium">Error</p>
              <p className="text-red-700 mt-1 text-sm">{error}</p>
            </div>
          </div>
        )}

        {/* Patient Information */}
        <Card className="bg-white border border-gray-200 shadow-sm">
          <CardHeader className="pb-4 border-b border-gray-200">
            <CardTitle className="text-xl font-semibold text-gray-900">
              Personal Information
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Full Name */}
              <div className="space-y-2">
                <Label className="text-sm font-medium text-gray-500 uppercase tracking-wider">Full Name</Label>
                <p className="text-lg font-semibold text-gray-900">{patient.name}</p>
              </div>

              {/* Patient ID */}
              <div className="space-y-2">
                <Label className="text-sm font-medium text-gray-500 uppercase tracking-wider">
                  {getIdentifierTypeLabel(patient.identifier_type)}
                </Label>
                <p className="text-lg font-semibold text-gray-900">{patient.identifier}</p>
              </div>

              {/* Gender */}
              <div className="space-y-2">
                <Label className="text-sm font-medium text-gray-500 uppercase tracking-wider">Gender</Label>
                <div>
                  <Badge variant={patient.gender?.toLowerCase() === 'male' ? 'default' : 'secondary'} className="text-sm">
                    {patient.gender ? patient.gender.charAt(0).toUpperCase() + patient.gender.slice(1).toLowerCase() : 'N/A'}
                  </Badge>
                </div>
              </div>

              {/* Date of Birth */}
              <div className="space-y-2">
                <Label className="text-sm font-medium text-gray-500 uppercase tracking-wider">Date of Birth</Label>
                <p className="text-lg font-semibold text-gray-900">
                  {formatDate(patient.birth_date)}
                </p>
              </div>

              {/* Phone */}
              <div className="space-y-2">
                <Label className="text-sm font-medium text-gray-500 uppercase tracking-wider">Phone Number</Label>
                <p className="text-lg font-semibold text-gray-900">{patient.phone || 'N/A'}</p>
              </div>

              {/* Email */}
              <div className="space-y-2">
                <Label className="text-sm font-medium text-gray-500 uppercase tracking-wider">Email Address</Label>
                <p className="text-lg font-semibold text-gray-900">{patient.email || 'N/A'}</p>
              </div>

              {/* Nationality */}
              <div className="space-y-2">
                <Label className="text-sm font-medium text-gray-500 uppercase tracking-wider">Nationality</Label>
                <p className="text-lg font-semibold text-gray-900">{getNationalityLabel(patient.nationality)}</p>
              </div>

              {/* Marital Status */}
              <div className="space-y-2">
                <Label className="text-sm font-medium text-gray-500 uppercase tracking-wider">Marital Status</Label>
                <p className="text-lg font-semibold text-gray-900">
                  {patient.marital_status 
                    ? patient.marital_status.charAt(0).toUpperCase() + patient.marital_status.slice(1).toLowerCase() 
                    : 'N/A'}
                </p>
              </div>

              {/* Is Newborn */}
              {patient.is_newborn && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-gray-500 uppercase tracking-wider">Status</Label>
                  <div>
                    <Badge className="bg-blue-100 text-blue-700">Newborn</Badge>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Address Information */}
        {(patient.address || patient.city || patient.country || patient.occupation) && (
          <Card className="bg-white border border-gray-200 shadow-sm">
            <CardHeader className="pb-4 border-b border-gray-200">
              <CardTitle className="text-xl font-semibold text-gray-900">
                Address & Additional Information
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* Address */}
                {(patient.address || patient.city) && (
                  <div className="space-y-2 md:col-span-2 lg:col-span-3">
                    <Label className="text-sm font-medium text-gray-500 uppercase tracking-wider">Address</Label>
                    <p className="text-lg font-semibold text-gray-900">
                      {[patient.address, patient.city, getNationalityLabel(patient.country)]
                        .filter(Boolean)
                        .join(', ') || 'N/A'}
                    </p>
                  </div>
                )}

                {/* Occupation */}
                {patient.occupation && (
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-gray-500 uppercase tracking-wider">Occupation</Label>
                    <p className="text-lg font-semibold text-gray-900">{patient.occupation}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Age Calculation */}
        <Card className="bg-white border border-gray-200 shadow-sm">
          <CardContent className="pt-6">
            <div className="bg-gradient-to-r from-primary-purple/5 to-accent-purple/5 rounded-xl p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="bg-primary-purple/10 rounded-lg p-2">
                    <Calendar className="h-5 w-5 text-primary-purple" />
                  </div>
                  <div>
                    <Label className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Age</Label>
                    <p className="text-lg font-semibold text-gray-900">
                      {calculateAge(patient.birth_date)}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-xs text-gray-500">Calculated from birth date</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Additional Info */}
        {(patient.nphies_patient_id || patient.identifier_system) && (
          <Card className="bg-white border border-gray-200 shadow-sm">
            <CardHeader className="pb-4 border-b border-gray-200">
              <CardTitle className="text-xl font-semibold text-gray-900">
                System Information
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {patient.nphies_patient_id && (
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-gray-500 uppercase tracking-wider">NPHIES Patient ID</Label>
                    <p className="text-lg font-semibold text-gray-900">{patient.nphies_patient_id}</p>
                  </div>
                )}
                {patient.identifier_system && (
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-gray-500 uppercase tracking-wider">Identifier System</Label>
                    <p className="text-lg font-semibold text-gray-900">{patient.identifier_system}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Delete Confirmation Modal */}
        {showDeleteConfirm && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl">
              <div className="flex items-center space-x-3 mb-4">
                <div className="bg-red-100 rounded-full p-3">
                  <AlertCircle className="h-6 w-6 text-red-600" />
                </div>
                <h3 className="text-xl font-bold text-gray-900">Delete Patient</h3>
              </div>
              <p className="text-gray-600 mb-6">
                Are you sure you want to delete <span className="font-semibold">{patient.name}</span>? 
                This action cannot be undone and will remove all associated records.
              </p>
              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  disabled={deleting}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800 font-medium transition-colors border border-gray-300 rounded-xl hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-xl transition-colors font-medium flex items-center space-x-2 disabled:opacity-50"
                >
                  {deleting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Deleting...</span>
                    </>
                  ) : (
                    <>
                      <Trash2 className="h-4 w-4" />
                      <span>Delete Patient</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

