import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Users, 
  Mail,
  Calendar,
  AlertCircle,
  Loader2,
  Shield
} from 'lucide-react';
import DataTable from '@/components/DataTable';
import api, { extractErrorMessage } from '@/services/api';
import { useAuth } from '@/context/AuthContext';

export default function UsersPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  const isSuperAdmin = user?.email === 'eng.anasshamia@gmail.com';

  useEffect(() => {
    if (!isSuperAdmin) {
      navigate('/', { replace: true });
      return;
    }
    loadUsers();
  }, [isSuperAdmin, navigate]);

  const loadUsers = async () => {
    try {
      setLoading(true);
      setError(null);
      const params = { limit: 1000 };
      if (searchTerm) {
        params.search = searchTerm;
      }
      const response = await api.getUsers(params);
      setUsers(response.data || []);
    } catch (error) {
      console.error('Error loading users:', error);
      setError(extractErrorMessage(error));
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isSuperAdmin && searchTerm !== undefined) {
      const timeoutId = setTimeout(() => {
        loadUsers();
      }, 500);
      return () => clearTimeout(timeoutId);
    }
  }, [searchTerm, isSuperAdmin]);

  if (!isSuperAdmin) {
    return null;
  }

  const columns = [
    {
      key: 'id',
      header: 'ID',
      accessor: 'id'
    },
    {
      key: 'email',
      header: 'Email',
      accessor: 'email',
      render: (row) => (
        <div className="flex items-center space-x-2">
          <Mail className="h-4 w-4 text-gray-400" />
          <span className="font-medium">{row.email}</span>
          {row.email === 'eng.anasshamia@gmail.com' && (
            <Badge className="bg-purple-100 text-purple-800 border-purple-200">
              <Shield className="h-3 w-3 mr-1" />
              Super Admin
            </Badge>
          )}
        </div>
      )
    },
    {
      key: 'created_at',
      header: 'Created At',
      accessor: 'created_at',
      render: (row) => {
        if (!row.created_at) return 'N/A';
        const date = new Date(row.created_at);
        if (isNaN(date.getTime())) return 'Invalid Date';
        return (
          <div className="flex items-center space-x-2 text-sm text-gray-600">
            <Calendar className="h-4 w-4" />
            <span>{date.toLocaleDateString()} {date.toLocaleTimeString()}</span>
          </div>
        );
      }
    },
    {
      key: 'updated_at',
      header: 'Last Updated',
      accessor: 'updated_at',
      render: (row) => {
        if (!row.updated_at) return 'N/A';
        const date = new Date(row.updated_at);
        if (isNaN(date.getTime())) return 'Invalid Date';
        return date.toLocaleDateString();
      }
    }
  ];

  if (loading && users.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary-purple mx-auto mb-4" />
          <p className="text-gray-600 font-medium">Loading users...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center space-x-3">
            <div className="relative bg-gradient-to-br from-primary-purple/10 to-accent-purple/10 rounded-lg p-2">
              <Users className="h-8 w-8 text-primary-purple" />
            </div>
            <span>Users Management</span>
          </h1>
          <p className="text-gray-600 mt-1">Manage system users and access</p>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start space-x-3">
          <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-red-800">Error loading users</p>
            <p className="text-sm text-red-600 mt-1">{error}</p>
          </div>
        </div>
      )}

      {/* Users Table Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center space-x-2">
              <Users className="h-5 w-5" />
              <span>Registered Users</span>
            </CardTitle>
            <div className="flex items-center space-x-2">
              <input
                type="text"
                placeholder="Search by email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-purple/30"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {users.length === 0 && !loading ? (
            <div className="text-center py-12">
              <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 font-medium">No users found</p>
              <p className="text-sm text-gray-500 mt-1">
                {searchTerm ? 'Try a different search term' : 'Users will appear here once they register'}
              </p>
            </div>
          ) : (
            <DataTable
              data={users}
              columns={columns}
              loading={loading}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

