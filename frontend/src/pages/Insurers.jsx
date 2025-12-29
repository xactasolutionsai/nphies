import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Shield, PlusCircle, Loader2, AlertCircle, Eye, Edit, Trash2 } from 'lucide-react';
import DataTable from '@/components/DataTable';
import api, { extractErrorMessage } from '@/services/api';

export default function Insurers() {
  const navigate = useNavigate();
  const [insurers, setInsurers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [insurerToDelete, setInsurerToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    loadInsurers();
  }, []);

  const loadInsurers = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.getInsurers({ limit: 1000 });
      setInsurers(response.data || response || []);
    } catch (err) {
      console.error('Error loading insurers:', err);
      setError(extractErrorMessage(err));
    } finally {
      setLoading(false);
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

  const handleDelete = async () => {
    if (!insurerToDelete) return;
    try {
      setDeleting(true);
      await api.deleteInsurer(insurerToDelete.insurer_id);
      setInsurers(insurers.filter(i => i.insurer_id !== insurerToDelete.insurer_id));
      setShowDeleteConfirm(false);
      setInsurerToDelete(null);
    } catch (err) {
      console.error('Error deleting insurer:', err);
      setError(extractErrorMessage(err));
    } finally {
      setDeleting(false);
    }
  };

  const columns = [
    {
      key: 'insurer_name',
      header: 'Insurer Name',
      accessor: 'insurer_name'
    },
    {
      key: 'nphies_id',
      header: 'NPHIES ID',
      accessor: 'nphies_id',
      render: (row) => row.nphies_id || 'N/A'
    },
    {
      key: 'status',
      header: 'Status',
      accessor: 'status',
      render: (row) => (
        <Badge className={`text-sm ${getStatusColor(row.status)}`}>
          {row.status || 'N/A'}
        </Badge>
      )
    },
    {
      key: 'plan_type',
      header: 'Plan Type',
      accessor: 'plan_type',
      render: (row) => row.plan_type || 'N/A'
    },
    {
      key: 'contact_person',
      header: 'Contact Person',
      accessor: 'contact_person',
      render: (row) => row.contact_person || 'N/A'
    },
    {
      key: 'phone',
      header: 'Phone',
      accessor: 'phone',
      render: (row) => row.phone || 'N/A'
    },
    {
      key: 'actions',
      header: 'Actions',
      accessor: 'insurer_id',
      render: (row) => (
        <div className="flex items-center space-x-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/insurers/${row.insurer_id}`);
            }}
            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            title="View Details"
          >
            <Eye className="h-4 w-4" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/insurers/${row.insurer_id}/edit`);
            }}
            className="p-1.5 text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
            title="Edit"
          >
            <Edit className="h-4 w-4" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setInsurerToDelete(row);
              setShowDeleteConfirm(true);
            }}
            className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            title="Delete"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      )
    }
  ];

  const handleRowClick = (insurer) => {
    navigate(`/insurers/${insurer.insurer_id}`);
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

  return (
    <div className="space-y-8">
      {/* Enhanced Header */}
      <div className="relative">
        <div className="relative bg-white rounded-2xl p-8 border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold text-gray-900">
                Insurance Providers
              </h1>
              <p className="text-gray-600 mt-2 text-lg">Manage insurance providers and their information</p>
              <div className="flex items-center space-x-4 mt-4">
                <div className="flex items-center space-x-2 text-sm text-gray-500">
                  <div className="w-2 h-2 bg-accent-cyan rounded-full animate-pulse"></div>
                  <span>System Active</span>
                </div>
                <div className="text-sm text-gray-500">
                  Total Insurers: {insurers.length}
                </div>
                <div className="text-sm text-gray-500">
                  Last updated: {new Date().toLocaleTimeString()}
                </div>
              </div>
            </div>
            <div className="hidden md:flex items-center space-x-3">
              <button
                onClick={() => navigate('/insurers/new')}
                className="bg-gradient-to-r from-primary-purple to-accent-purple text-white px-4 py-2 rounded-xl transition-all duration-200 font-medium flex items-center space-x-2 hover:shadow-lg hover:scale-105"
              >
                <PlusCircle className="h-5 w-5" />
                <span>New Insurer</span>
              </button>
              <div className="relative">
                <div className="relative bg-white rounded-xl p-3 border border-gray-100">
                  <Shield className="h-8 w-8 text-primary-purple" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="bg-red-50 border-l-4 border-red-500 rounded-lg p-4 flex items-start space-x-3">
          <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-red-800 font-medium">Error loading insurers</p>
            <p className="text-red-700 mt-1 text-sm">{error}</p>
          </div>
          <button
            onClick={loadInsurers}
            className="text-red-600 hover:text-red-800 font-medium text-sm"
          >
            Retry
          </button>
        </div>
      )}

      {/* Enhanced Insurer Records Card */}
      <div className="relative group">
        <Card className="relative bg-white border-0 transition-all duration-300 hover:-translate-y-2">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center text-gray-900">
              <div className="relative mr-3">
                <div className="absolute -inset-1 bg-primary-purple/20 rounded-lg"></div>
                <div className="relative from-primary-purple/10 to-accent-purple/10 rounded-lg p-2">
                  <Shield className="h-6 w-6 text-primary-purple" />
                </div>
              </div>
              <div>
                <h3 className="text-xl font-bold">Insurance Providers</h3>
                <p className="text-sm text-gray-600 font-medium">Comprehensive list of all insurance providers in the system</p>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <DataTable
              data={insurers}
              columns={columns}
              onRowClick={handleRowClick}
              searchable={true}
              sortable={true}
              pageSize={10}
            />
          </CardContent>
        </Card>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && insurerToDelete && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6 shadow-xl">
            <div className="flex items-center space-x-3 mb-4">
              <div className="bg-red-100 rounded-full p-3">
                <AlertCircle className="h-6 w-6 text-red-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900">Confirm Deletion</h3>
            </div>
            <p className="text-gray-600 mb-6">
              Are you sure you want to delete insurer <span className="font-semibold">{insurerToDelete.insurer_name}</span>?
              This action cannot be undone.
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setInsurerToDelete(null);
                }}
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
                    <span>Delete</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
