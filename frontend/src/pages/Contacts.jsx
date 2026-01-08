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
  Globe,
  X,
  Eye,
  ExternalLink,
  MapPin
} from 'lucide-react';
import DataTable from '@/components/DataTable';
import api, { extractErrorMessage } from '@/services/api';
import { useAuth } from '@/context/AuthContext';

// Contact Detail Modal Component
function ContactDetailModal({ contact, onClose, onStatusChange, updatingStatus }) {
  if (!contact) return null;

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

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'Invalid Date';
    return date.toLocaleString();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-primary-purple to-accent-purple px-6 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="bg-white/20 rounded-lg p-2">
              <MessageSquare className="h-6 w-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Contact Details</h2>
              <p className="text-white/80 text-sm">ID: #{contact.id}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white hover:bg-white/10 p-2 rounded-lg transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-180px)]">
          {/* Contact Info Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            {/* Name */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Name</label>
              <p className="text-lg font-medium text-gray-900">{contact.name}</p>
            </div>

            {/* Email */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Email</label>
              <a 
                href={`mailto:${contact.email}`}
                className="flex items-center space-x-2 text-primary-purple hover:underline"
              >
                <Mail className="h-4 w-4" />
                <span>{contact.email}</span>
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>

            {/* Company */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Company</label>
              {contact.company ? (
                <div className="flex items-center space-x-2">
                  <Building2 className="h-4 w-4 text-gray-400" />
                  <span className="text-gray-900">{contact.company}</span>
                </div>
              ) : (
                <span className="text-gray-400">Not provided</span>
              )}
            </div>

            {/* Status */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</label>
              <div className="flex items-center space-x-3">
                {getStatusBadge(contact.status)}
                {updatingStatus === contact.id ? (
                  <Loader2 className="h-4 w-4 animate-spin text-primary-purple" />
                ) : (
                  <select
                    value={contact.status}
                    onChange={(e) => onStatusChange(contact.id, e.target.value)}
                    className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary-purple/30"
                  >
                    <option value="new">New</option>
                    <option value="read">Read</option>
                    <option value="replied">Replied</option>
                    <option value="archived">Archived</option>
                  </select>
                )}
              </div>
            </div>

            {/* Source URL */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Source URL</label>
              {contact.source_url ? (
                <a 
                  href={contact.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center space-x-2 text-primary-purple hover:underline text-sm"
                >
                  <Globe className="h-4 w-4" />
                  <span className="truncate">{contact.source_url}</span>
                  <ExternalLink className="h-3 w-3 flex-shrink-0" />
                </a>
              ) : (
                <span className="text-gray-400">Not tracked</span>
              )}
            </div>

            {/* IP Address */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">IP Address</label>
              {contact.ip_address ? (
                <div className="flex items-center space-x-2 text-gray-600">
                  <MapPin className="h-4 w-4 text-gray-400" />
                  <span className="font-mono text-sm">{contact.ip_address}</span>
                </div>
              ) : (
                <span className="text-gray-400">Not recorded</span>
              )}
            </div>

            {/* Received Date */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Received</label>
              <div className="flex items-center space-x-2 text-gray-600">
                <Calendar className="h-4 w-4 text-gray-400" />
                <span>{formatDate(contact.created_at)}</span>
              </div>
            </div>

            {/* Updated Date */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Last Updated</label>
              <div className="flex items-center space-x-2 text-gray-600">
                <Calendar className="h-4 w-4 text-gray-400" />
                <span>{formatDate(contact.updated_at)}</span>
              </div>
            </div>
          </div>

          {/* Message */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Message</label>
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
              <p className="text-gray-800 whitespace-pre-wrap leading-relaxed">{contact.message}</p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 px-6 py-4 bg-gray-50 flex items-center justify-between">
          <a
            href={`mailto:${contact.email}?subject=Re: Your inquiry&body=Dear ${contact.name},%0D%0A%0D%0AThank you for contacting us.%0D%0A%0D%0A`}
            className="inline-flex items-center space-x-2 px-4 py-2 bg-primary-purple text-white rounded-lg hover:bg-primary-purple/90 transition-colors"
          >
            <Reply className="h-4 w-4" />
            <span>Reply via Email</span>
          </a>
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ContactsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [updatingStatus, setUpdatingStatus] = useState(null);
  const [selectedContact, setSelectedContact] = useState(null);

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
      // Update selected contact if it's the one being updated
      if (selectedContact && selectedContact.id === contactId) {
        setSelectedContact(prev => ({ ...prev, status: newStatus }));
      }
    } catch (error) {
      console.error('Error updating status:', error);
      setError(extractErrorMessage(error));
    } finally {
      setUpdatingStatus(null);
    }
  };

  const handleViewContact = (contact) => {
    setSelectedContact(contact);
    // Auto-mark as read if it's new
    if (contact.status === 'new') {
      handleStatusChange(contact.id, 'read');
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
    },
    {
      key: 'actions',
      header: 'Actions',
      accessor: 'id',
      render: (row) => (
        <button
          onClick={() => handleViewContact(row)}
          className="inline-flex items-center space-x-1 px-3 py-1.5 bg-primary-purple/10 text-primary-purple rounded-lg hover:bg-primary-purple/20 transition-colors text-sm font-medium"
        >
          <Eye className="h-4 w-4" />
          <span>View</span>
        </button>
      )
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

      {/* Contact Detail Modal */}
      {selectedContact && (
        <ContactDetailModal
          contact={selectedContact}
          onClose={() => setSelectedContact(null)}
          onStatusChange={handleStatusChange}
          updatingStatus={updatingStatus}
        />
      )}
    </div>
  );
}
