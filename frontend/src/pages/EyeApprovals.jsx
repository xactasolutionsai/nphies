import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import DataTable from '@/components/DataTable';
import api from '@/services/api';
import { FileText, Plus, Edit, Trash2, Eye } from 'lucide-react';

export default function EyeApprovals() {
  const navigate = useNavigate();
  const [forms, setForms] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadForms();
  }, []);

  const loadForms = async () => {
    try {
      setLoading(true);
      const response = await api.getEyeApprovals({ limit: 1000 });
      // Handle nested response structure
      const data = response?.data?.data || response?.data || response || [];
      setForms(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error loading eye approvals:', error);
      setForms([]);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteForm = async (id) => {
    if (window.confirm('Are you sure you want to delete this eye form?')) {
      try {
        setLoading(true);
        await api.deleteEyeApproval(id);
        // Optimistically update state - remove deleted item immediately
        setForms(prevForms => prevForms.filter(form => form.id !== id));
        // Also reload to ensure consistency
        await loadForms();
      } catch (error) {
        console.error('Error deleting form:', error);
        alert('Error deleting form. Please try again.');
        // Reload on error to ensure state is correct
        await loadForms();
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
      key: 'provider_name',
      header: 'Provider',
      accessor: 'provider_name'
    },
    {
      key: 'insurance_company_name',
      header: 'Insurance Company',
      accessor: 'insurance_company_name'
    },
    {
      key: 'insured_name',
      header: 'Insured Name',
      accessor: 'insured_name'
    },
    {
      key: 'status',
      header: 'Status',
      accessor: 'status',
      render: (row) => (
        <Badge variant={row.status === 'Approved' ? 'default' : row.status === 'Draft' ? 'secondary' : 'outline'}>
          {row.status}
        </Badge>
      )
    },
    {
      key: 'date_of_visit',
      header: 'Date of Visit',
      accessor: 'date_of_visit',
      render: (row) => row.date_of_visit ? new Date(row.date_of_visit).toLocaleDateString() : 'N/A'
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
              navigate(`/eye-approvals/${row.id}`);
            }}
          >
            <Eye className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/eye-approvals/${row.id}/edit`);
            }}
          >
            <Edit className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant="destructive"
            onClick={(e) => {
              e.stopPropagation();
              handleDeleteForm(row.id);
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
                Eye/Optical Approvals and Claims
              </h1>
              <p className="text-gray-600 mt-2 text-lg">Manage eye/optical approval and claims application forms</p>
              <div className="flex items-center space-x-4 mt-4">
                <div className="flex items-center space-x-2 text-sm text-gray-500">
                  <div className="w-2 h-2 bg-accent-cyan rounded-full animate-pulse"></div>
                  <span>System Active</span>
                </div>
                <div className="text-sm text-gray-500">
                  Total Forms: {forms.length}
                </div>
              </div>
            </div>
            <Button 
              onClick={() => navigate('/eye-approvals/new')} 
              className="bg-gradient-to-r from-primary-purple to-accent-purple"
            >
              <Plus className="h-5 w-5 mr-2" />
              Add New Eye Form
            </Button>
          </div>
        </div>
      </div>

      {/* Data Table */}
      <Card>
        <CardHeader>
          <CardTitle>Eye/Optical Forms List</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            data={forms}
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

