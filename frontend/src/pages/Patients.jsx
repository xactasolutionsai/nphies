import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Users, User, Mail, Phone, Calendar, FileText, Heart } from 'lucide-react';
import DataTable from '@/components/DataTable';
import api from '@/services/api';

export default function Patients() {
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedPatient, setSelectedPatient] = useState(null);

  useEffect(() => {
    loadPatients();
  }, []);

  const loadPatients = async () => {
    try {
      setLoading(true);
      const response = await api.getPatients({ limit: 1000 });
      setPatients(response.data || response || []);
    } catch (error) {
      console.error('Error loading patients:', error);
      // Mock data for demonstration
      setPatients([
        {
          id: 1,
          name: 'أحمد محمد العلي',
          identifier: '1234567890',
          gender: 'Male',
          birthdate: '1985-03-15',
          phone: '+966501234567',
          email: 'ahmed.ali@example.com'
        },
        {
          id: 2,
          name: 'فاطمة عبدالله السعد',
          identifier: '0987654321',
          gender: 'Female',
          birthdate: '1990-07-22',
          phone: '+966502345678',
          email: 'fatima.saad@example.com'
        },
        {
          id: 3,
          name: 'محمد خالد القحطاني',
          identifier: '1122334455',
          gender: 'Male',
          birthdate: '1978-12-10',
          phone: '+966503456789',
          email: 'mohammed.qhtani@example.com'
        }
      ]);
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
        <Badge variant={row.gender === 'Male' ? 'default' : 'secondary'}>
          {row.gender}
        </Badge>
      )
    },
    {
      key: 'birthdate',
      header: 'Birth Date',
      accessor: 'birthdate',
      render: (row) => {
        if (!row.birthdate) return 'N/A';
        const date = new Date(row.birthdate);
        if (isNaN(date.getTime())) return 'Invalid Date';
        return date.toLocaleDateString();
      }
    },
    {
      key: 'phone',
      header: 'Phone',
      accessor: 'phone'
    }
  ];

  const handleRowClick = (patient) => {
    setSelectedPatient(patient);
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
            <div className="hidden md:flex items-center space-x-3">
              <div className="relative">
 
                <div className="relative bg-white rounded-xl p-3 border border-gray-100">
                  <Users className="h-8 w-8 text-primary-purple" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

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

      {/* Enhanced Patient Detail Modal */}
      {selectedPatient && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="relative bg-white rounded-3xl max-w-4xl w-full max-h-[90vh] overflow-hidden ">
 
            <div className="relative bg-white rounded-3xl overflow-hidden">
              {/* Enhanced Header */}
              <div className="bg-gradient-to-r from-primary-purple to-accent-purple p-6 text-white">
                <div className="flex justify-between items-center">
                  <div className="flex items-center space-x-3">
                    <div className="relative">
 
                      <div className="relative bg-white/20 rounded-full p-2">
                        <User className="h-6 w-6" />
                      </div>
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold">Patient Details</h2>
                      <p className="text-white/80 mt-1">Comprehensive patient information</p>
                    </div>
                  </div>
              <button
                onClick={() => setSelectedPatient(null)}
                    className="text-white/80 hover:text-white hover:bg-white/20 p-2 rounded-xl transition-all duration-200"
              >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
              </button>
            </div>
            </div>
            
              {/* Patient Information Grid */}
              <div className="p-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="relative group">
 
                    <div className="relative bg-gray-50 rounded-xl p-4">
                      <div className="flex items-center space-x-3">
                        <div className="bg-primary-purple/10 rounded-lg p-2">
                          <User className="h-5 w-5 text-primary-purple" />
                        </div>
              <div>
                          <label className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Full Name</label>
                          <p className="text-lg font-semibold text-gray-900">{selectedPatient.name}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="relative group">
 
                    <div className="relative bg-gray-50 rounded-xl p-4">
                      <div className="flex items-center space-x-3">
                        <div className="bg-accent-cyan/10 rounded-lg p-2">
                          <FileText className="h-5 w-5 text-accent-cyan" />
              </div>
              <div>
                          <label className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Patient ID</label>
                          <p className="text-lg font-semibold text-gray-900">{selectedPatient.identifier}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="relative group">
 
                    <div className="relative bg-gray-50 rounded-xl p-4">
                      <div className="flex items-center space-x-3">
                        <div className="bg-primary-purple/10 rounded-lg p-2">
                          <Heart className="h-5 w-5 text-primary-purple" />
              </div>
              <div>
                          <label className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Gender</label>
                          <div className="mt-1">
                            <Badge variant={selectedPatient.gender === 'Male' ? 'default' : 'secondary'} className="text-sm">
                              {selectedPatient.gender}
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
                          <Calendar className="h-5 w-5 text-accent-cyan" />
              </div>
              <div>
                          <label className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Date of Birth</label>
                          <p className="text-lg font-semibold text-gray-900">
                            {selectedPatient.birthdate ? (() => {
                              const date = new Date(selectedPatient.birthdate);
                              if (isNaN(date.getTime())) return 'Invalid Date';
                              return date.toLocaleDateString('en-US', {
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric'
                              });
                            })() : 'N/A'}
                          </p>
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
                          <p className="text-lg font-semibold text-gray-900">{selectedPatient.phone}</p>
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
                          <p className="text-lg font-semibold text-gray-900">{selectedPatient.email}</p>
                        </div>
                      </div>
                    </div>
              </div>
            </div>
            
                {/* Age Calculation */}
                <div className="mt-6 relative group">
 
                  <div className="relative bg-gradient-to-r from-primary-purple/5 to-accent-purple/5 rounded-xl p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="bg-primary-purple/10 rounded-lg p-2">
                          <Calendar className="h-5 w-5 text-primary-purple" />
                        </div>
                        <div>
                          <label className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Age</label>
                          <p className="text-lg font-semibold text-gray-900">
                            {selectedPatient.birthdate ? (() => {
                              const birthDate = new Date(selectedPatient.birthdate);
                              if (isNaN(birthDate.getTime())) return 'Invalid Date';
                              const today = new Date();
                              const age = today.getFullYear() - birthDate.getFullYear();
                              const monthDiff = today.getMonth() - birthDate.getMonth();
                              if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
                                return `${age - 1} years old`;
                              }
                              return `${age} years old`;
                            })() : 'N/A'}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-xs text-gray-500">Calculated from birth date</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Enhanced Footer */}
              <div className="bg-gray-50 px-6 py-4 border-t border-gray-200">
                <div className="flex justify-between items-center">
                  <div className="text-sm text-gray-600">
                    <span className="font-medium">Patient ID:</span> {selectedPatient.identifier}
                  </div>
                  <div className="flex space-x-3">
              <button
                onClick={() => setSelectedPatient(null)}
                      className="px-6 py-2 text-gray-600 hover:text-gray-800 font-medium transition-colors"
              >
                Close
              </button>
                    <button
                      className="bg-gradient-to-r from-primary-purple to-accent-purple text-white px-6 py-2 rounded-xl transition-all duration-200 font-medium"
                    >
                      Edit Patient
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
