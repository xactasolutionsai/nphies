import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Shield, CreditCard, User, Phone, Mail, MapPin, Heart } from 'lucide-react';
import DataTable from '@/components/DataTable';
import api from '@/services/api';

export default function Insurers() {
  const [insurers, setInsurers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedInsurer, setSelectedInsurer] = useState(null);

  useEffect(() => {
    loadInsurers();
  }, []);

  const loadInsurers = async () => {
    try {
      setLoading(true);
      const response = await api.getInsurers({ limit: 1000 });
      setInsurers(response.data || response || []);
    } catch (error) {
      console.error('Error loading insurers:', error);
      // Mock data for demonstration
      setInsurers([
        {
          id: 1,
          name: 'التأمين الصحي السعودي',
          nphiesid: 'INS001',
          status: 'Active',
          contactperson: 'أحمد محمد العلي',
          phone: '+966112345678',
          email: 'info@shic.gov.sa',
          address: 'الرياض، المملكة العربية السعودية'
        },
        {
          id: 2,
          name: 'بوبا العربية للتأمين',
          nphiesid: 'INS002',
          status: 'Active',
          contactperson: 'سارة أحمد السعد',
          phone: '+966123456789',
          email: 'info@bupa.com.sa',
          address: 'جدة، المملكة العربية السعودية'
        },
        {
          id: 3,
          name: 'تأمين مدجلف',
          nphiesid: 'INS003',
          status: 'Active',
          contactperson: 'محمد خالد القحطاني',
          phone: '+966134567890',
          email: 'info@medgulf.com.sa',
          address: 'الدمام، المملكة العربية السعودية'
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const columns = [
    {
      key: 'name',
      header: 'Insurer Name',
      accessor: 'name'
    },
    {
      key: 'nphiesid',
      header: 'NPHIES ID',
      accessor: 'nphiesid'
    },
    {
      key: 'status',
      header: 'Status',
      accessor: 'status',
      render: (row) => (
        <Badge variant={row.status === 'Active' ? 'default' : 'secondary'}>
          {row.status}
        </Badge>
      )
    },
    {
      key: 'contactperson',
      header: 'Contact Person',
      accessor: 'contactperson'
    },
    {
      key: 'phone',
      header: 'Phone',
      accessor: 'phone'
    }
  ];

  const handleRowClick = (insurer) => {
    setSelectedInsurer(insurer);
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
              <div className="relative">
 
                <div className="relative bg-white rounded-xl p-3 border border-gray-100">
                  <Shield className="h-8 w-8 text-primary-purple" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

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

      {/* Enhanced Insurer Detail Modal */}
      {selectedInsurer && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="relative bg-white rounded-3xl max-w-4xl w-full max-h-[90vh] overflow-hidden ">
 
            <div className="relative bg-white rounded-3xl overflow-hidden">
              {/* Enhanced Header */}
              <div className="bg-gradient-to-r from-primary-purple to-accent-purple p-6 text-white">
                <div className="flex justify-between items-center">
                  <div className="flex items-center space-x-3">
                    <div className="relative">
 
                      <div className="relative bg-white/20 rounded-full p-2">
                        <Shield className="h-6 w-6" />
                      </div>
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold">Insurer Details</h2>
                      <p className="text-white/80 mt-1">Insurance provider information</p>
                    </div>
                  </div>
              <button
                onClick={() => setSelectedInsurer(null)}
                    className="text-white/80 hover:text-white hover:bg-white/20 p-2 rounded-xl transition-all duration-200"
              >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
              </button>
            </div>
              </div>

              {/* Insurer Information Grid */}
              <div className="p-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="relative group">
 
                    <div className="relative bg-gray-50 rounded-xl p-4">
                      <div className="flex items-center space-x-3">
                        <div className="bg-primary-purple/10 rounded-lg p-2">
                          <Shield className="h-5 w-5 text-primary-purple" />
                        </div>
                        <div>
                          <label className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Insurer Name</label>
                          <p className="text-lg font-semibold text-gray-900">{selectedInsurer.name}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="relative group">
 
                    <div className="relative bg-gray-50 rounded-xl p-4">
                      <div className="flex items-center space-x-3">
                        <div className="bg-accent-cyan/10 rounded-lg p-2">
                          <CreditCard className="h-5 w-5 text-accent-cyan" />
              </div>
              <div>
                          <label className="text-sm font-semibold text-gray-500 uppercase tracking-wider">NPHIES ID</label>
                          <p className="text-lg font-semibold text-gray-900">{selectedInsurer.nphiesid}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="relative group">
 
                    <div className="relative bg-gray-50 rounded-xl p-4">
                      <div className="flex items-center space-x-3">
                        <div className="bg-primary-purple/10 rounded-lg p-2">
                          <Badge variant={selectedInsurer.status === 'Active' ? 'default' : 'secondary'} className="h-5 w-5" />
              </div>
              <div>
                          <label className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Status</label>
                          <div className="mt-1">
                            <Badge variant={selectedInsurer.status === 'Active' ? 'default' : 'secondary'} className="text-sm">
                              {selectedInsurer.status}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="relative group">
 
                    <div className="relative bg-gray-50 rounded-xl p-4">
                      <div className="flex items-center space-x-3">
                        <div className="bg-accent-cyan/10 rounded-lg p-2">
                          <User className="h-5 w-5 text-accent-cyan" />
              </div>
              <div>
                          <label className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Contact Person</label>
                          <p className="text-lg font-semibold text-gray-900">{selectedInsurer.contactperson}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="relative group">
 
                    <div className="relative bg-gray-50 rounded-xl p-4">
                      <div className="flex items-center space-x-3">
                        <div className="bg-primary-purple/10 rounded-lg p-2">
                          <Phone className="h-5 w-5 text-primary-purple" />
              </div>
              <div>
                          <label className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Phone Number</label>
                          <p className="text-lg font-semibold text-gray-900">{selectedInsurer.phone}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="relative group">
 
                    <div className="relative bg-gray-50 rounded-xl p-4">
                      <div className="flex items-center space-x-3">
                        <div className="bg-accent-cyan/10 rounded-lg p-2">
                          <Mail className="h-5 w-5 text-accent-cyan" />
              </div>
              <div>
                          <label className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Email Address</label>
                          <p className="text-lg font-semibold text-gray-900">{selectedInsurer.email}</p>
                        </div>
              </div>
              </div>
            </div>
            
                  <div className="relative group md:col-span-2">
 
                    <div className="relative bg-gray-50 rounded-xl p-4">
                      <div className="flex items-center space-x-3">
                        <div className="bg-primary-purple/10 rounded-lg p-2">
                          <MapPin className="h-5 w-5 text-primary-purple" />
                        </div>
                        <div>
                          <label className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Address</label>
                          <p className="text-lg font-semibold text-gray-900">{selectedInsurer.address}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Enhanced Footer */}
              <div className="bg-gray-50 px-6 py-4 border-t border-gray-200">
                <div className="flex justify-between items-center">
                  <div className="text-sm text-gray-600">
                    <span className="font-medium">Insurer ID:</span> {selectedInsurer.nphiesid}
                  </div>
                  <div className="flex space-x-3">
              <button
                onClick={() => setSelectedInsurer(null)}
                      className="px-6 py-2 text-gray-600 hover:text-gray-800 font-medium transition-colors"
              >
                Close
              </button>
                    <button
                      className="bg-gradient-to-r from-primary-purple to-accent-purple text-white px-6 py-2 rounded-xl transition-all duration-200 font-medium"
                    >
                      Edit Insurer
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
