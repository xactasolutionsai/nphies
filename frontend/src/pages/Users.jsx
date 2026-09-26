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
import { ROLES } from '@/utils/roles';

export default function UsersPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleSavingId, setRoleSavingId] = useState(null);
  const [roleMessage, setRoleMessage] = useState(null);

  const isSuperAdmin = user?.role === 'admin';

  useEffect(() => {
    if (!isSuperAdmin) {
      navigate('/', { replace: true });
    }
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
    // Single loader: immediate on mount / cleared search, debounced while typing
    if (!isSuperAdmin) return undefined;
    const timeoutId = setTimeout(() => {
      loadUsers();
    }, searchTerm ? 500 : 0);
    return () => clearTimeout(timeoutId);
  }, [searchTerm, isSuperAdmin]);

  const handleRoleChange = async (target, role) => {
    if (!role || role === target.role) return;
    if (!window.confirm(`Change the role of ${target.email} from ${target.role || 'none'} to ${role}?`)) return;
    try {
      setRoleSavingId(target.id);
      setRoleMessage(null);
      await api.updateUserRole(target.id, role);
      setUsers(prev => prev.map(u => (u.id === target.id ? { ...u, role } : u)));
      setRoleMessage({ type: 'success', text: `Role of ${target.email} changed to ${role}.` });
    } catch (err) {
      const status = err?.response?.status;
      // A missing route (older backend) answers 404 "Endpoint not found"; a missing user is a
      // 404 with its own message, which is shown as-is.
      const routeMissing = status === 405 || (status === 404 && err?.response?.data?.error === 'Endpoint not found');
      setRoleMessage({
        type: 'error',
        text: routeMissing
          ? 'Changing roles is not supported by this server version yet.'
          : extractErrorMessage(err)
      });
    } finally {
      setRoleSavingId(null);
    }
  };

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
          {row.role === 'admin' && (
            <Badge className="bg-purple-100 text-purple-800 border-purple-200">
              <Shield className="h-3 w-3 mr-1" />
              Super Admin
            </Badge>
          )}
        </div>
      )
    },
    {
      key: 'role',
      header: 'Role',
      accessor: 'role',
      render: (row) => {
        // Legacy 'user' rows behave as 'submitter'; show them as-is so nothing is silently rewritten.
        const options = ROLES.includes(row.role) || !row.role ? ROLES : [row.role, ...ROLES];
        return (
          <select
            value={row.role || ''}
            disabled={roleSavingId === row.id || row.id === user?.id}
            title={row.id === user?.id ? 'You cannot change your own role' : 'Change role'}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => handleRoleChange(row, e.target.value)}
            className="px-2 py-1 border border-gray-300 rounded-md text-sm bg-white disabled:opacity-60"
          >
            {!row.role && <option value="">-</option>}
            {options.map(r => (
              <option key={r} value={r}>{r === 'user' ? 'user (submitter)' : r}</option>
            ))}
          </select>
        );
      }
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

      {roleMessage && (
        <div className={`rounded-lg p-3 text-sm border ${roleMessage.type === 'success' ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
          {roleMessage.text}
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

