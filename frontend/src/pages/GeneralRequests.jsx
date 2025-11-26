import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import DataTable from '@/components/DataTable';
import api from '@/services/api';
import { FileText, Plus, Edit, Trash2, Eye } from 'lucide-react';

export default function GeneralRequests() {
  const navigate = useNavigate();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadRequests();
  }, []);

  const loadRequests = async () => {
    try {
      setLoading(true);
      const response = await api.getGeneralRequests({ limit: 1000 });
      // Handle nested response structure
      const data = response?.data?.data || response?.data || response || [];
      setRequests(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error loading general requests:', error);
      setRequests([]);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteRequest = async (id) => {
    if (window.confirm('Are you sure you want to delete this request?')) {
      try {
        setLoading(true);
        await api.deleteGeneralRequest(id);
        // Optimistically update state - remove deleted item immediately
        setRequests(prevRequests => prevRequests.filter(req => req.id !== id));
        // Also reload to ensure consistency
        await loadRequests();
      } catch (error) {
        console.error('Error deleting request:', error);
        alert('Error deleting request. Please try again.');
        // Reload on error to ensure state is correct
        await loadRequests();
      } finally {
        setLoading(false);
      }
    }
  };

  const columns = [
    {
      key: 'form_number',
      header: 'Form Number',
      accessor: 'form_number'
    },
    {
      key: 'patient_name',
      header: 'Patient Name',
      accessor: 'patient_name',
      render: (row) => row.patient_name || row.patient_name_joined || 'N/A'
    },
    {
      key: 'diagnosis',
      header: 'Diagnosis',
      accessor: 'diagnosis',
      render: (row) => row.diagnosis || 'N/A'
    },
    {
      key: 'service_description',
      header: 'Service',
      accessor: 'service_description',
      render: (row) => {
        const desc = row.service_description || 'N/A';
        return desc.length > 50 ? desc.substring(0, 50) + '...' : desc;
      }
    },
    {
      key: 'status',
      header: 'Status',
      accessor: 'status',
      render: (row) => {
        const variantMap = {
          'Approved': 'default',
          'Draft': 'secondary',
          'Submitted': 'default',
          'Rejected': 'destructive',
          'Pending': 'outline'
        };
        return (
          <Badge variant={variantMap[row.status] || 'outline'}>
            {row.status}
          </Badge>
        );
      }
    },
    {
      key: 'emergency',
      header: 'Emergency',
      accessor: 'emergency_case',
      render: (row) => (
        row.emergency_case === 'true' || row.emergency_case === true ? (
          <Badge variant="destructive" className="text-xs">Yes</Badge>
        ) : null
      )
    },
    {
      key: 'created_at',
      header: 'Created',
      accessor: 'created_at',
      render: (row) => row.created_at ? new Date(row.created_at).toLocaleDateString() : 'N/A'
    },
    {
      key: 'actions',
      header: 'Actions',
      accessor: 'id',
      render: (row) => (
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/general-requests/${row.id}`);
            }}
          >
            <Eye className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/general-requests/${row.id}/edit`);
            }}
          >
            <Edit className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant="destructive"
            onClick={(e) => {
              e.stopPropagation();
              handleDeleteRequest(row.id);
            }}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      )
    }
  ];

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
      {/* Header */}
      <div className="relative">
        <div className="relative bg-white rounded-2xl p-8 border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold text-gray-900">
                General Requests
              </h1>
              <p className="text-gray-600 mt-2 text-lg">Manage general service requests and approvals</p>
              <div className="flex items-center space-x-4 mt-4">
                <div className="flex items-center space-x-2 text-sm text-gray-500">
                  <div className="w-2 h-2 bg-accent-cyan rounded-full animate-pulse"></div>
                  <span>System Active</span>
                </div>
                <div className="text-sm text-gray-500">
                  Total Requests: {requests.length}
                </div>
              </div>
            </div>
            <Button 
              onClick={() => navigate('/general-requests/new')} 
              className="bg-gradient-to-r from-primary-purple to-accent-purple"
            >
              <Plus className="h-5 w-5 mr-2" />
              New Request
            </Button>
          </div>
        </div>
      </div>

      {/* Data Table */}
      <Card>
        <CardHeader>
          <CardTitle>Requests List</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            data={requests}
            columns={columns}
            searchable={true}
            sortable={true}
            pageSize={10}
          />
        </CardContent>
      </Card>
    </div>
  );
}

