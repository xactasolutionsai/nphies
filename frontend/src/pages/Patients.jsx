import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Users, 
  User, 
  Plus,
  Edit,
  Eye,
  Trash2,
  AlertCircle,
  X,
  Loader2
} from 'lucide-react';
import DataTable from '@/components/DataTable';
import api, { extractErrorMessage } from '@/services/api';

export default function Patients() {
  const navigate = useNavigate();
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [patientToDelete, setPatientToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    loadPatients();
  }, []);

  const loadPatients = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.getPatients({ limit: 1000 });
      setPatients(response.data || response || []);
    } catch (error) {
      console.error('Error loading patients:', error);
      setError(extractErrorMessage(error));
      setPatients([]);
    } finally {
      setLoading(false);
    }
  };


  const columns = [
    {
      key: 'name',
      header: 'Name',
      accessor: 'name'
    },
    {
      key: 'identifier',
      header: 'Identifier',
      accessor: 'identifier'
    },
    {
      key: 'gender',
      header: 'Gender',
      accessor: 'gender',
      render: (row) => (
        <Badge variant={row.gender?.toLowerCase() === 'male' ? 'default' : 'secondary'}>
          {row.gender ? row.gender.charAt(0).toUpperCase() + row.gender.slice(1).toLowerCase() : 'N/A'}
        </Badge>
      )
    },
    {
      key: 'birth_date',
      header: 'Birth Date',
      accessor: 'birth_date',
      render: (row) => {
        if (!row.birth_date) return 'N/A';
        const date = new Date(row.birth_date);
        if (isNaN(date.getTime())) return 'Invalid Date';
        return date.toLocaleDateString();
      }
    },
    {
      key: 'phone',
      header: 'Phone',
      accessor: 'phone',
      render: (row) => row.phone || '-'
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (row) => (
        <div className="flex items-center space-x-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/patients/${row.patient_id}`);
            }}
            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            title="View Details"
          >
            <Eye className="h-4 w-4" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/patients/${row.patient_id}/edit`);
            }}
            className="p-1.5 text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
            title="Edit"
          >
            <Edit className="h-4 w-4" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setPatientToDelete(row);
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

  const handleRowClick = (patient) => {
    navigate(`/patients/${patient.patient_id}`);
  };

  const handleDelete = async () => {
    if (!patientToDelete) return;
    try {
      setDeleting(true);
      await api.deletePatient(patientToDelete.patient_id);
      setPatients(patients.filter(p => p.patient_id !== patientToDelete.patient_id));
      setShowDeleteConfirm(false);
      setPatientToDelete(null);
    } catch (err) {
      console.error('Error deleting patient:', err);
      setError(extractErrorMessage(err));
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="relative">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-accent-cyan/20"></div>
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-transparent border-t-accent-cyan absolute top-0"></div>
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
                Patients Management
              </h1>
              <p className="text-gray-600 mt-2 text-lg">Comprehensive patient information and records system</p>
              <div className="flex items-center space-x-4 mt-4">
                <div className="flex items-center space-x-2 text-sm text-gray-500">
                  <div className="w-2 h-2 bg-accent-cyan rounded-full animate-pulse"></div>
                  <span>System Active</span>
                </div>
                <div className="text-sm text-gray-500">
                  Total Patients: {patients.length}
                </div>
                <div className="text-sm text-gray-500">
                  Last updated: {new Date().toLocaleTimeString()}
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <button
                onClick={() => navigate('/patients/new')}
                className="bg-gradient-to-r from-primary-purple to-accent-purple text-white px-6 py-3 rounded-xl transition-all duration-200 font-medium flex items-center space-x-2 hover:shadow-lg"
              >
                <Plus className="h-5 w-5" />
                <span>New Patient</span>
              </button>
              <div className="hidden md:flex items-center space-x-3">
                <div className="relative bg-white rounded-xl p-3 border border-gray-100">
                  <Users className="h-8 w-8 text-primary-purple" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0" />
            <p className="text-red-700">{error}</p>
          </div>
          <button onClick={() => setError(null)} className="text-red-500 hover:text-red-700">
            <X className="h-5 w-5" />
          </button>
        </div>
      )}

      {/* Enhanced Patient Records Card */}
      <div className="relative group">
        <Card className="relative bg-white border-0 transition-all duration-300 hover:-translate-y-2">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center text-gray-900">
              <div className="relative mr-3">
                <div className="absolute -inset-1 bg-primary-purple/20 rounded-lg"></div>
                <div className="relative from-primary-purple/10 to-accent-purple/10 rounded-lg p-2">
                  <User className="h-6 w-6 text-primary-purple" />
                </div>
              </div>
              <div>
                <h3 className="text-xl font-bold">Patient Records</h3>
                <p className="text-sm text-gray-600 font-medium">Comprehensive list of all patients in the system</p>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <DataTable
              data={patients}
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
      {showDeleteConfirm && patientToDelete && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6 shadow-xl">
            <div className="flex items-center space-x-3 mb-4">
              <div className="bg-red-100 rounded-full p-3">
                <AlertCircle className="h-6 w-6 text-red-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900">Confirm Deletion</h3>
            </div>
            <p className="text-gray-600 mb-6">
              Are you sure you want to delete patient <span className="font-semibold">{patientToDelete.name}</span>?
              This action cannot be undone.
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setPatientToDelete(null);
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
