import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import {
  ArrowLeft,
  Edit,
  Shield,
  Phone,
  Mail,
  MapPin,
  CreditCard,
  User,
  Loader2,
  AlertCircle,
  Trash2,
  FileText
} from 'lucide-react';
import api, { extractErrorMessage } from '@/services/api';

export default function InsurerDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [insurer, setInsurer] = useState(null);
  const [error, setError] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    loadInsurerDetails();
  }, [id]);

  const loadInsurerDetails = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.getInsurer(id);
      setInsurer(response.data || response);
    } catch (err) {
      console.error('Error loading insurer details:', err);
      setError(extractErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    try {
      setDeleting(true);
      setError(null);
      await api.deleteInsurer(insurer.insurer_id);
      navigate('/insurers', { state: { message: 'Insurer deleted successfully!' } });
    } catch (err) {
      console.error('Error deleting insurer:', err);
      setError(extractErrorMessage(err));
    } finally {
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'active':
        return 'bg-green-100 text-green-800';
      case 'inactive':
        return 'bg-gray-100 text-gray-800';
      case 'suspended':
        return 'bg-red-100 text-red-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getPlanTypeLabel = (type) => {
    const types = {
      'HMO': 'HMO (Health Maintenance Organization)',
      'PPO': 'PPO (Preferred Provider Organization)',
      'EPO': 'EPO (Exclusive Provider Organization)',
      'POS': 'POS (Point of Service)',
      'Comprehensive': 'Comprehensive',
      'Basic': 'Basic',
      'Premium': 'Premium'
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

  if (error && !insurer) {
    return (
      <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8 flex items-center justify-center">
        <div className="bg-red-50 border-l-4 border-red-500 rounded-lg p-4 flex items-start space-x-3 max-w-md w-full">
          <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-red-800 font-medium">Error loading insurer</p>
            <p className="text-red-700 mt-1 text-sm">{error}</p>
          </div>
          <button
            onClick={() => navigate('/insurers')}
            className="text-red-500 hover:text-red-700 transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
        </div>
      </div>
    );
  }

  if (!insurer) {
    return (
      <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8 flex items-center justify-center">
        <div className="bg-yellow-50 border-l-4 border-yellow-500 rounded-lg p-4 flex items-start space-x-3 max-w-md w-full">
          <AlertCircle className="h-5 w-5 text-yellow-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-yellow-800 font-medium">Insurer Not Found</p>
            <p className="text-yellow-700 mt-1 text-sm">The insurer you are looking for does not exist.</p>
          </div>
          <button
            onClick={() => navigate('/insurers')}
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
                onClick={() => navigate('/insurers')}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                title="Back to insurers"
              >
                <ArrowLeft className="h-5 w-5 text-gray-600" />
              </button>
              <div className="flex items-center space-x-3">
                <div className="relative bg-gradient-to-br from-primary-purple/10 to-accent-purple/10 rounded-lg p-2">
                  <Shield className="h-6 w-6 text-primary-purple" />
                </div>
                <div>
                  <h1 className="text-3xl font-bold text-gray-900">Insurer Details</h1>
                  <p className="text-gray-600 mt-1">Information for {insurer.insurer_name}</p>
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <button
                onClick={() => navigate(`/insurers/${insurer.insurer_id}/edit`)}
                className="bg-primary-purple hover:bg-primary-purple/90 text-white px-4 py-2 rounded-lg transition-colors font-medium flex items-center space-x-2"
              >
                <Edit className="h-4 w-4" />
                <span>Edit Insurer</span>
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

        {/* Insurer Information */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Basic Information */}
          <Card className="bg-white border border-gray-200 shadow-sm">
            <CardHeader className="pb-4 border-b border-gray-200">
              <CardTitle className="text-xl font-semibold text-gray-900">Basic Information</CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-4">
              <div>
                <Label className="text-sm font-medium text-gray-500 uppercase tracking-wider">Insurer Name</Label>
                <p className="text-lg font-semibold text-gray-900 mt-1">{insurer.insurer_name}</p>
              </div>
              <div>
                <Label className="text-sm font-medium text-gray-500 uppercase tracking-wider">NPHIES ID</Label>
                <p className="text-lg font-mono text-gray-900 mt-1">{insurer.nphies_id || 'N/A'}</p>
              </div>
              <div>
                <Label className="text-sm font-medium text-gray-500 uppercase tracking-wider">Status</Label>
                <div className="mt-1">
                  <Badge className={`text-sm ${getStatusColor(insurer.status)}`}>
                    {insurer.status || 'N/A'}
                  </Badge>
                </div>
              </div>
              <div>
                <Label className="text-sm font-medium text-gray-500 uppercase tracking-wider">Plan Type</Label>
                <p className="text-lg text-gray-900 mt-1">{getPlanTypeLabel(insurer.plan_type)}</p>
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
                <p className="text-lg text-gray-900 mt-1">{insurer.contact_person || 'N/A'}</p>
              </div>
              <div>
                <Label className="text-sm font-medium text-gray-500 uppercase tracking-wider">Phone Number</Label>
                <p className="text-lg text-gray-900 mt-1">{insurer.phone || 'N/A'}</p>
              </div>
              <div>
                <Label className="text-sm font-medium text-gray-500 uppercase tracking-wider">Email Address</Label>
                <p className="text-lg text-gray-900 mt-1">{insurer.email || 'N/A'}</p>
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
                <p className="text-lg text-gray-900 mt-1">{insurer.address || 'N/A'}</p>
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
                Are you sure you want to delete insurer <span className="font-semibold">{insurer.insurer_name}</span>?
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
                      <span>Delete Insurer</span>
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

