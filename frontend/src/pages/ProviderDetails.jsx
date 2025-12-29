import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import {
  ArrowLeft,
  Edit,
  Building2,
  Phone,
  Mail,
  MapPin,
  CreditCard,
  User,
  Loader2,
  AlertCircle,
  Trash2,
  Briefcase
} from 'lucide-react';
import api, { extractErrorMessage } from '@/services/api';

export default function ProviderDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [provider, setProvider] = useState(null);
  const [error, setError] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    loadProviderDetails();
  }, [id]);

  const loadProviderDetails = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.getProvider(id);
      setProvider(response.data || response);
    } catch (err) {
      console.error('Error loading provider details:', err);
      setError(extractErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    try {
      setDeleting(true);
      setError(null);
      await api.deleteProvider(provider.provider_id);
      navigate('/providers', { state: { message: 'Provider deleted successfully!' } });
    } catch (err) {
      console.error('Error deleting provider:', err);
      setError(extractErrorMessage(err));
    } finally {
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  const getProviderTypeLabel = (type) => {
    const types = {
      'hospital': 'Hospital',
      'clinic': 'Clinic',
      'pharmacy': 'Pharmacy',
      'laboratory': 'Laboratory',
      'imaging': 'Imaging',
      'rehabilitation': 'Rehabilitation'
    };
    return types[type] || type || 'N/A';
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

  if (error && !provider) {
    return (
      <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8 flex items-center justify-center">
        <div className="bg-red-50 border-l-4 border-red-500 rounded-lg p-4 flex items-start space-x-3 max-w-md w-full">
          <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-red-800 font-medium">Error loading provider</p>
            <p className="text-red-700 mt-1 text-sm">{error}</p>
          </div>
          <button
            onClick={() => navigate('/providers')}
            className="text-red-500 hover:text-red-700 transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
        </div>
      </div>
    );
  }

  if (!provider) {
    return (
      <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8 flex items-center justify-center">
        <div className="bg-yellow-50 border-l-4 border-yellow-500 rounded-lg p-4 flex items-start space-x-3 max-w-md w-full">
          <AlertCircle className="h-5 w-5 text-yellow-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-yellow-800 font-medium">Provider Not Found</p>
            <p className="text-yellow-700 mt-1 text-sm">The provider you are looking for does not exist.</p>
          </div>
          <button
            onClick={() => navigate('/providers')}
            className="text-yellow-500 hover:text-yellow-700 transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-8 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto space-y-6">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => navigate('/providers')}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                title="Back to providers"
              >
                <ArrowLeft className="h-5 w-5 text-gray-600" />
              </button>
              <div className="flex items-center space-x-3">
                <div className="relative bg-gradient-to-br from-primary-purple/10 to-accent-purple/10 rounded-lg p-2">
                  <Building2 className="h-6 w-6 text-primary-purple" />
                </div>
                <div>
                  <h1 className="text-3xl font-bold text-gray-900">Provider Details</h1>
                  <p className="text-gray-600 mt-1">Information for {provider.provider_name}</p>
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <button
                onClick={() => navigate(`/providers/${provider.provider_id}/edit`)}
                className="bg-primary-purple hover:bg-primary-purple/90 text-white px-4 py-2 rounded-lg transition-colors font-medium flex items-center space-x-2"
              >
                <Edit className="h-4 w-4" />
                <span>Edit Provider</span>
              </button>
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg transition-colors font-medium flex items-center space-x-2"
              >
                <Trash2 className="h-4 w-4" />
                <span>Delete</span>
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

        {/* Provider Information */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Basic Information */}
          <Card className="bg-white border border-gray-200 shadow-sm">
            <CardHeader className="pb-4 border-b border-gray-200">
              <CardTitle className="text-xl font-semibold text-gray-900">Basic Information</CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-4">
              <div>
                <Label className="text-sm font-medium text-gray-500 uppercase tracking-wider">Provider Name</Label>
                <p className="text-lg font-semibold text-gray-900 mt-1">{provider.provider_name}</p>
              </div>
              <div>
                <Label className="text-sm font-medium text-gray-500 uppercase tracking-wider">Facility Type</Label>
                <div className="mt-1">
                  <Badge variant="default" className="text-sm">
                    {provider.type || 'N/A'}
                  </Badge>
                </div>
              </div>
              <div>
                <Label className="text-sm font-medium text-gray-500 uppercase tracking-wider">Provider Type</Label>
                <p className="text-lg text-gray-900 mt-1">{getProviderTypeLabel(provider.provider_type)}</p>
              </div>
              <div>
                <Label className="text-sm font-medium text-gray-500 uppercase tracking-wider">NPHIES ID</Label>
                <p className="text-lg font-mono text-gray-900 mt-1">{provider.nphies_id || 'N/A'}</p>
              </div>
              <div>
                <Label className="text-sm font-medium text-gray-500 uppercase tracking-wider">Location License</Label>
                <p className="text-lg text-gray-900 mt-1">{provider.location_license || 'N/A'}</p>
              </div>
            </CardContent>
          </Card>

          {/* Contact Information */}
          <Card className="bg-white border border-gray-200 shadow-sm">
            <CardHeader className="pb-4 border-b border-gray-200">
              <CardTitle className="text-xl font-semibold text-gray-900">Contact Information</CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-4">
              <div>
                <Label className="text-sm font-medium text-gray-500 uppercase tracking-wider">Contact Person</Label>
                <p className="text-lg text-gray-900 mt-1">{provider.contact_person || 'N/A'}</p>
              </div>
              <div>
                <Label className="text-sm font-medium text-gray-500 uppercase tracking-wider">Doctor Name</Label>
                <p className="text-lg text-gray-900 mt-1">{provider.doctor_name || 'N/A'}</p>
              </div>
              <div>
                <Label className="text-sm font-medium text-gray-500 uppercase tracking-wider">Department</Label>
                <p className="text-lg text-gray-900 mt-1">{provider.department || 'N/A'}</p>
              </div>
              <div>
                <Label className="text-sm font-medium text-gray-500 uppercase tracking-wider">Phone Number</Label>
                <p className="text-lg text-gray-900 mt-1">{provider.phone || 'N/A'}</p>
              </div>
              <div>
                <Label className="text-sm font-medium text-gray-500 uppercase tracking-wider">Email Address</Label>
                <p className="text-lg text-gray-900 mt-1">{provider.email || 'N/A'}</p>
              </div>
            </CardContent>
          </Card>

          {/* Address Information */}
          <Card className="bg-white border border-gray-200 shadow-sm lg:col-span-2">
            <CardHeader className="pb-4 border-b border-gray-200">
              <CardTitle className="text-xl font-semibold text-gray-900">Address Information</CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <div>
                <Label className="text-sm font-medium text-gray-500 uppercase tracking-wider">Full Address</Label>
                <p className="text-lg text-gray-900 mt-1">{provider.address || 'N/A'}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Delete Confirmation Modal */}
        {showDeleteConfirm && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] p-4">
            <div className="bg-white rounded-lg max-w-md w-full p-6 shadow-xl">
              <div className="flex items-center space-x-3 mb-4">
                <div className="bg-red-100 rounded-full p-3">
                  <AlertCircle className="h-6 w-6 text-red-600" />
                </div>
                <h3 className="text-xl font-bold text-gray-900">Confirm Deletion</h3>
              </div>
              <p className="text-gray-600 mb-6">
                Are you sure you want to delete provider <span className="font-semibold">{provider.provider_name}</span>?
                This action cannot be undone.
              </p>
              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  disabled={deleting}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800 font-medium transition-colors border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition-colors font-medium flex items-center space-x-2 disabled:opacity-50"
                >
                  {deleting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Deleting...</span>
                    </>
                  ) : (
                    <>
                      <Trash2 className="h-4 w-4" />
                      <span>Delete Provider</span>
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

