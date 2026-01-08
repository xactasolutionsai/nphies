import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  MessageSquare, 
  Mail,
  Calendar,
  AlertCircle,
  Loader2,
  Shield,
  Building2,
  CheckCircle,
  Clock,
  Archive,
  Reply,
  Globe
} from 'lucide-react';
import DataTable from '@/components/DataTable';
import api, { extractErrorMessage } from '@/services/api';
import { useAuth } from '@/context/AuthContext';

export default function ContactsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [updatingStatus, setUpdatingStatus] = useState(null);

  const isSuperAdmin = user?.email === 'eng.anasshamia@gmail.com';

  useEffect(() => {
    if (!isSuperAdmin) {
      navigate('/', { replace: true });
      return;
    }
    loadContacts();
  }, [isSuperAdmin, navigate]);

  const loadContacts = async () => {
    try {
      setLoading(true);
      setError(null);
      const params = { limit: 1000 };
      if (searchTerm) {
        params.search = searchTerm;
      }
      if (statusFilter) {
        params.status = statusFilter;
      }
      const response = await api.getContacts(params);
      setContacts(response.data || []);
    } catch (error) {
      console.error('Error loading contacts:', error);
      setError(extractErrorMessage(error));
      setContacts([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isSuperAdmin) {
      const timeoutId = setTimeout(() => {
        loadContacts();
      }, 500);
      return () => clearTimeout(timeoutId);
    }
  }, [searchTerm, statusFilter, isSuperAdmin]);

  const handleStatusChange = async (contactId, newStatus) => {
    try {
      setUpdatingStatus(contactId);
      await api.updateContactStatus(contactId, newStatus);
      // Update local state
      setContacts(prev => prev.map(contact => 
        contact.id === contactId ? { ...contact, status: newStatus } : contact
      ));
    } catch (error) {
      console.error('Error updating status:', error);
      setError(extractErrorMessage(error));
    } finally {
      setUpdatingStatus(null);
    }
  };

  if (!isSuperAdmin) {
    return null;
  }

  const getStatusBadge = (status) => {
    const statusConfig = {
      new: { color: 'bg-blue-100 text-blue-800 border-blue-200', icon: Clock, label: 'New' },
      read: { color: 'bg-yellow-100 text-yellow-800 border-yellow-200', icon: CheckCircle, label: 'Read' },
      replied: { color: 'bg-green-100 text-green-800 border-green-200', icon: Reply, label: 'Replied' },
      archived: { color: 'bg-gray-100 text-gray-800 border-gray-200', icon: Archive, label: 'Archived' }
    };
    const config = statusConfig[status] || statusConfig.new;
    const Icon = config.icon;
    return (
      <Badge className={`${config.color} border`}>
        <Icon className="h-3 w-3 mr-1" />
        {config.label}
      </Badge>
    );
  };

  const columns = [
    {
      key: 'id',
      header: 'ID',
      accessor: 'id'
    },
    {
      key: 'name',
      header: 'Name',
      accessor: 'name',
      render: (row) => (
        <span className="font-medium text-gray-900">{row.name}</span>
      )
    },
    {
      key: 'email',
      header: 'Email',
      accessor: 'email',
      render: (row) => (
        <div className="flex items-center space-x-2">
          <Mail className="h-4 w-4 text-gray-400" />
          <a href={`mailto:${row.email}`} className="text-primary-purple hover:underline">
            {row.email}
          </a>
        </div>
      )
    },
    {
      key: 'company',
      header: 'Company',
      accessor: 'company',
      render: (row) => row.company ? (
        <div className="flex items-center space-x-2">
          <Building2 className="h-4 w-4 text-gray-400" />
          <span>{row.company}</span>
        </div>
      ) : (
        <span className="text-gray-400">-</span>
      )
    },
    {
      key: 'message',
      header: 'Message',
      accessor: 'message',
      render: (row) => (
        <div className="max-w-xs truncate text-sm text-gray-600" title={row.message}>
          {row.message}
        </div>
      )
    },
    {
      key: 'source_url',
      header: 'Source',
      accessor: 'source_url',
      render: (row) => row.source_url ? (
        <div className="flex items-center space-x-1 text-xs text-gray-500" title={row.source_url}>
          <Globe className="h-3 w-3" />
          <span className="truncate max-w-[100px]">{new URL(row.source_url).hostname}</span>
        </div>
      ) : (
        <span className="text-gray-400">-</span>
      )
    },
    {
      key: 'status',
      header: 'Status',
      accessor: 'status',
      render: (row) => (
        <div className="flex items-center space-x-2">
          {updatingStatus === row.id ? (
            <Loader2 className="h-4 w-4 animate-spin text-primary-purple" />
          ) : (
            <select
              value={row.status}
              onChange={(e) => handleStatusChange(row.id, e.target.value)}
              className="text-xs border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-primary-purple/30"
            >
              <option value="new">New</option>
              <option value="read">Read</option>
              <option value="replied">Replied</option>
              <option value="archived">Archived</option>
            </select>
          )}
        </div>
      )
    },
    {
      key: 'created_at',
      header: 'Received',
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
    }
  ];

  // Stats
  const stats = {
    total: contacts.length,
    new: contacts.filter(c => c.status === 'new').length,
    read: contacts.filter(c => c.status === 'read').length,
    replied: contacts.filter(c => c.status === 'replied').length,
    archived: contacts.filter(c => c.status === 'archived').length
  };

  if (loading && contacts.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary-purple mx-auto mb-4" />
          <p className="text-gray-600 font-medium">Loading contacts...</p>
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
              <MessageSquare className="h-8 w-8 text-primary-purple" />
            </div>
            <span>Contact Submissions</span>
          </h1>
          <p className="text-gray-600 mt-1">Manage contact form submissions from external websites</p>
        </div>
        <Badge className="bg-purple-100 text-purple-800 border-purple-200">
          <Shield className="h-3 w-3 mr-1" />
          Super Admin Only
        </Badge>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card className="bg-gradient-to-br from-gray-50 to-gray-100">
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
            <div className="text-sm text-gray-600">Total</div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100">
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-blue-700">{stats.new}</div>
            <div className="text-sm text-blue-600">New</div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-yellow-50 to-yellow-100">
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-yellow-700">{stats.read}</div>
            <div className="text-sm text-yellow-600">Read</div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-green-50 to-green-100">
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-green-700">{stats.replied}</div>
            <div className="text-sm text-green-600">Replied</div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-gray-50 to-gray-100">
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-gray-700">{stats.archived}</div>
            <div className="text-sm text-gray-600">Archived</div>
          </CardContent>
        </Card>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start space-x-3">
          <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-red-800">Error loading contacts</p>
            <p className="text-sm text-red-600 mt-1">{error}</p>
          </div>
        </div>
      )}

      {/* Contacts Table Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-4">
            <CardTitle className="flex items-center space-x-2">
              <MessageSquare className="h-5 w-5" />
              <span>Contact Messages</span>
            </CardTitle>
            <div className="flex items-center space-x-2">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-purple/30"
              >
                <option value="">All Status</option>
                <option value="new">New</option>
                <option value="read">Read</option>
                <option value="replied">Replied</option>
                <option value="archived">Archived</option>
              </select>
              <input
                type="text"
                placeholder="Search by name, email, company..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-purple/30 w-64"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {contacts.length === 0 && !loading ? (
            <div className="text-center py-12">
              <MessageSquare className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 font-medium">No contacts found</p>
              <p className="text-sm text-gray-500 mt-1">
                {searchTerm || statusFilter ? 'Try different filters' : 'Contact submissions will appear here'}
              </p>
            </div>
          ) : (
            <DataTable
              data={contacts}
              columns={columns}
              loading={loading}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
