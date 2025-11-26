import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import DataTable from '@/components/DataTable';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { TrendingUp, DollarSign, CreditCard, Calendar, Building2, Shield } from 'lucide-react';
import api from '@/services/api';

const COLORS = ['#553781', '#9658C4', '#8572CD', '#00DEFE', '#26A69A', '#E0E7FF'];

export default function Payments() {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedPayment, setSelectedPayment] = useState(null);
  
  // Chart data states
  const [paymentsByStatus, setPaymentsByStatus] = useState([]);
  const [paymentsByInsurer, setPaymentsByInsurer] = useState([]);
  const [monthlyTrends, setMonthlyTrends] = useState([]);
  const [paymentMethods, setPaymentMethods] = useState([]);
  
  // Drill-down state
  const [drillDownData, setDrillDownData] = useState([]);
  const [showDrillDown, setShowDrillDown] = useState(false);
  const [drillDownTitle, setDrillDownTitle] = useState('');

  useEffect(() => {
    loadPayments();
  }, []);

  const loadPayments = async () => {
    try {
      setLoading(true);
      const response = await api.getPayments({ limit: 1000 });
      const paymentsData = response.data || response || [];
      setPayments(paymentsData);
      
      // Process chart data
      processChartData(paymentsData);
    } catch (error) {
      console.error('Error loading payments:', error);
      // Mock data for demonstration
      const mockPayments = [
        {
          id: 1,
          payment_ref_number: 'PAY001',
          insurer_name: 'التأمين الصحي السعودي',
          provider_name: 'مستشفى الملك فهد التخصصي',
          total_amount: '15000',
          payment_date: '2024-01-20',
          status: 'Completed',
          method: 'Bank Transfer',
          description: 'Payment for surgery claim CLM001'
        },
        {
          id: 2,
          payment_ref_number: 'PAY002',
          insurer_name: 'بوبا العربية للتأمين',
          provider_name: 'عيادة الدكتور أحمد محمد',
          total_amount: '500',
          payment_date: '2024-01-25',
          status: 'Pending',
          method: 'Bank Transfer',
          description: 'Payment for consultation claim CLM002'
        },
        {
          id: 3,
          payment_ref_number: 'PAY003',
          insurer_name: 'تأمين مدجلف',
          provider_name: 'مركز الأسنان المتخصص',
          total_amount: '2000',
          payment_date: '2024-01-22',
          status: 'Failed',
          method: 'Bank Transfer',
          description: 'Payment for dental treatment claim CLM003'
        }
      ];
      setPayments(mockPayments);
      processChartData(mockPayments);
    } finally {
      setLoading(false);
    }
  };

  const processChartData = (paymentsData) => {
    // Payments by Status
    const statusCounts = {};
    paymentsData.forEach(payment => {
      statusCounts[payment.status] = (statusCounts[payment.status] || 0) + 1;
    });
    setPaymentsByStatus(Object.entries(statusCounts).map(([name, value]) => ({ name, value })));

    // Payments by Insurer
    const insurerAmounts = {};
    paymentsData.forEach(payment => {
      const insurer = payment.insurer_name || 'Unknown';
      insurerAmounts[insurer] = (insurerAmounts[insurer] || 0) + parseFloat(payment.total_amount || 0);
    });
    setPaymentsByInsurer(Object.entries(insurerAmounts).map(([name, value]) => ({ name, value })));

    // Monthly Trends
    const monthlyData = {};
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    paymentsData.forEach(payment => {
      const date = new Date(payment.payment_date);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      if (!monthlyData[monthKey]) {
        monthlyData[monthKey] = {
          month: months[date.getMonth()],
          amount: 0,
          count: 0
        };
      }
      monthlyData[monthKey].amount += parseFloat(payment.total_amount || 0);
      monthlyData[monthKey].count += 1;
    });
    setMonthlyTrends(Object.values(monthlyData).sort((a, b) => {
      const aDate = new Date(a.month + ' 1, 2024');
      const bDate = new Date(b.month + ' 1, 2024');
      return aDate - bDate;
    }));

    // Payment Methods
    const methodCounts = {};
    paymentsData.forEach(payment => {
      methodCounts[payment.method] = (methodCounts[payment.method] || 0) + 1;
    });
    setPaymentMethods(Object.entries(methodCounts).map(([name, value]) => ({ name, value })));
  };

  // Drill-down functions
  const handleStatusClick = async (data) => {
    try {
      setDrillDownTitle(`Payment Notifications with Status: ${data.name}`);
      
      const filteredPayments = payments.filter(payment => payment.status === data.name);
      setDrillDownData(filteredPayments);
      setShowDrillDown(true);
    } catch (error) {
      console.error('Error loading status drill-down data:', error);
    }
  };

  const handleInsurerClick = async (data) => {
    try {
      setDrillDownTitle(`Payment Notifications for Insurer: ${data.name}`);
      
      const filteredPayments = payments.filter(payment => payment.insurer_name === data.name);
      setDrillDownData(filteredPayments);
      setShowDrillDown(true);
    } catch (error) {
      console.error('Error loading insurer drill-down data:', error);
    }
  };

  const handleMonthlyTrendClick = async (data) => {
    try {
      setDrillDownTitle(`Payment Notifications for Month: ${data.month}`);
      
      // Filter payments for the selected month
      const monthDate = new Date(data.month + ' 1, 2024');
      const startDate = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
      const endDate = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0);
      
      const filteredPayments = payments.filter(payment => {
        const paymentDate = new Date(payment.payment_date || payment.created_at);
        return paymentDate >= startDate && paymentDate <= endDate;
      });
      
      setDrillDownData(filteredPayments);
      setShowDrillDown(true);
    } catch (error) {
      console.error('Error loading monthly trend drill-down data:', error);
    }
  };

  const handleMethodClick = async (data) => {
    try {
      setDrillDownTitle(`Payment Notifications with Method: ${data.name}`);
      
      const filteredPayments = payments.filter(payment => payment.method === data.name);
      setDrillDownData(filteredPayments);
      setShowDrillDown(true);
    } catch (error) {
      console.error('Error loading method drill-down data:', error);
    }
  };

  const closeDrillDown = () => {
    setShowDrillDown(false);
    setDrillDownData([]);
    setDrillDownTitle('');
  };

  const getStatusBadge = (status) => {
    const variants = {
      'Completed': 'default',
      'Pending': 'secondary',
      'Failed': 'destructive',
      'Processing': 'outline'
    };
    return variants[status] || 'outline';
  };

  const columns = [
    {
      key: 'payment_ref_number',
      header: 'Payment Ref',
      accessor: 'payment_ref_number'
    },
    {
      key: 'insurer_name',
      header: 'Insurer',
      accessor: 'insurer_name'
    },
    {
      key: 'provider_name',
      header: 'Provider',
      accessor: 'provider_name'
    },
    {
      key: 'total_amount',
      header: 'Amount',
      accessor: 'total_amount',
      render: (row) => `$${parseFloat(row.total_amount || 0).toLocaleString()}`
    },
    {
      key: 'status',
      header: 'Status',
      accessor: 'status',
      render: (row) => (
        <Badge variant={getStatusBadge(row.status)}>
          {row.status}
        </Badge>
      )
    },
    {
      key: 'payment_date',
      header: 'Payment Date',
      accessor: 'payment_date',
      render: (row) => new Date(row.payment_date).toLocaleDateString()
    }
  ];

  const handleRowClick = (payment) => {
    setSelectedPayment(payment);
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
                Payment Transactions
              </h1>
              <p className="text-gray-600 mt-2 text-lg">Track and manage payment transactions</p>
              <div className="flex items-center space-x-4 mt-4">
                <div className="flex items-center space-x-2 text-sm text-gray-500">
                  <div className="w-2 h-2 bg-accent-cyan rounded-full animate-pulse"></div>
                  <span>System Active</span>
                </div>
                <div className="text-sm text-gray-500">
                  Total Payments: {payments.length}
                </div>
                <div className="text-sm text-gray-500">
                  Last updated: {new Date().toLocaleTimeString()}
                </div>
              </div>
            </div>
            <div className="hidden md:flex items-center space-x-3">
              <div className="relative">
 
                <div className="relative bg-white rounded-xl p-3 border border-gray-100">
                  <CreditCard className="h-8 w-8 text-primary-purple" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Enhanced Payments by Status */}
        <div className="relative group">
 
          <Card className="relative bg-white border-0 transition-all duration-300 hover:-translate-y-2">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center text-gray-900">
                <div className="relative mr-3">
                  <div className="absolute -inset-1 bg-primary-purple/20 rounded-lg"></div>
                  <div className="relative from-primary-purple/10 to-accent-purple/10 rounded-lg p-2">
                    <CreditCard className="h-6 w-6 text-primary-purple" />
                  </div>
                </div>
                <div>
                  <h3 className="text-xl font-bold">Payments by Status</h3>
                  <p className="text-sm text-gray-600 font-medium">Distribution of payment statuses</p>
                </div>
              </CardTitle>
            </CardHeader>
          <CardContent>
            <div className="h-[400px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={paymentsByStatus}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    innerRadius={60}
                    outerRadius={120}
                    fill="#2196F3"
                    dataKey="value"
                    onClick={handleStatusClick}
                    style={{ cursor: 'pointer' }}
                  >
                    {paymentsByStatus.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{
                      backgroundColor: '#FFFFFF',
                      border: '1px solid #E5E7EB',
                      borderRadius: '8px',
                      boxShadow: 'none'
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
          </Card>
        </div>

        {/* Enhanced Payments by Insurer */}
        <div className="relative group">
 
          <Card className="relative bg-white border-0 transition-all duration-300 hover:-translate-y-2">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center text-gray-900">
                <div className="relative mr-3">
                  <div className="absolute -inset-1 bg-primary-purple/20 rounded-lg"></div>
                  <div className="relative from-primary-purple/10 to-accent-purple/10 rounded-lg p-2">
                    <DollarSign className="h-6 w-6 text-primary-purple" />
                  </div>
                </div>
                <div>
                  <h3 className="text-xl font-bold">Payments by Insurer</h3>
                  <p className="text-sm text-gray-600 font-medium">Total payment amounts by insurer</p>
                </div>
              </CardTitle>
            </CardHeader>
          <CardContent>
            <div className="h-[400px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={paymentsByInsurer} onClick={handleInsurerClick}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                  <XAxis dataKey="name" angle={-45} textAnchor="end" height={120} stroke="#6B7280" />
                  <YAxis stroke="#6B7280" />
                  <Tooltip 
                    contentStyle={{
                      backgroundColor: '#FFFFFF',
                      border: '1px solid #E5E7EB',
                      borderRadius: '8px',
                      boxShadow: 'none'
                    }}
                    formatter={(value) => [`$${value.toLocaleString()}`, 'Amount']} 
                  />
                  <Bar dataKey="value" fill="#059669" style={{ cursor: 'pointer' }} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
          </Card>
        </div>

        {/* Enhanced Daily Trends */}
        <div className="relative group">
 
          <Card className="relative bg-white border-0 transition-all duration-300 hover:-translate-y-2">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center text-gray-900">
                <div className="relative mr-3">
                  <div className="absolute -inset-1 bg-primary-purple/20 rounded-lg"></div>
                  <div className="relative from-primary-purple/10 to-accent-purple/10 rounded-lg p-2">
                    <TrendingUp className="h-6 w-6 text-primary-purple" />
                  </div>
                </div>
                <div>
                  <h3 className="text-xl font-bold">Daily Payment Trends</h3>
                  <p className="text-sm text-gray-600 font-medium">Payment amounts and counts over the last 30 days</p>
                </div>
              </CardTitle>
            </CardHeader>
          <CardContent>
            <div className="h-[400px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={monthlyTrends} onClick={handleMonthlyTrendClick}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                  <XAxis 
                    dataKey="day" 
                    stroke="#6B7280" 
                    angle={-45}
                    textAnchor="end"
                    height={80}
                    fontSize={12}
                  />
                  <YAxis yAxisId="left" stroke="#6B7280" />
                  <YAxis yAxisId="right" orientation="right" stroke="#6B7280" />
                  <Tooltip 
                    contentStyle={{
                      backgroundColor: '#FFFFFF',
                      border: '1px solid #E5E7EB',
                      borderRadius: '8px',
                      boxShadow: 'none'
                    }}
                    formatter={(value, name) => [
                      name === 'amount' ? `$${value.toLocaleString()}` : value,
                      name === 'amount' ? 'Amount' : 'Count'
                    ]}
                  />
                  <Line yAxisId="left" type="monotone" dataKey="amount" stroke="#059669" strokeWidth={2} style={{ cursor: 'pointer' }} />
                  <Line yAxisId="right" type="monotone" dataKey="count" stroke="#10B981" strokeWidth={2} style={{ cursor: 'pointer' }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
          </Card>
        </div>

        {/* Enhanced Payment Methods */}
        <div className="relative group">
 
          <Card className="relative bg-white border-0 transition-all duration-300 hover:-translate-y-2">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center text-gray-900">
                <div className="relative mr-3">
                  <div className="absolute -inset-1 bg-primary-purple/20 rounded-lg"></div>
                  <div className="relative from-primary-purple/10 to-accent-purple/10 rounded-lg p-2">
                    <Calendar className="h-6 w-6 text-primary-purple" />
                  </div>
                </div>
                <div>
                  <h3 className="text-xl font-bold">Payment Methods</h3>
                  <p className="text-sm text-gray-600 font-medium">Distribution of payment methods used</p>
                </div>
              </CardTitle>
            </CardHeader>
          <CardContent>
            <div className="h-[400px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={paymentMethods}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    innerRadius={60}
                    outerRadius={120}
                    fill="#2196F3"
                    dataKey="value"
                    onClick={handleMethodClick}
                    style={{ cursor: 'pointer' }}
                  >
                    {paymentMethods.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{
                      backgroundColor: '#FFFFFF',
                      border: '1px solid #E5E7EB',
                      borderRadius: '8px',
                      boxShadow: 'none'
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
          </Card>
        </div>
      </div>

      {/* Enhanced Payment Transactions Data Table */}
      <div className="relative group">
 
        <Card className="relative bg-white border-0 transition-all duration-300 hover:-translate-y-2">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center text-gray-900">
              <div className="relative mr-3">
                <div className="absolute -inset-1 bg-primary-purple/20 rounded-lg"></div>
                <div className="relative from-primary-purple/10 to-accent-purple/10 rounded-lg p-2">
                  <DollarSign className="h-6 w-6 text-primary-purple" />
                </div>
              </div>
              <div>
                <h3 className="text-xl font-bold">Payment Transactions</h3>
                <p className="text-sm text-gray-600 font-medium">Monitor all payment transactions between insurers and providers</p>
              </div>
            </CardTitle>
          </CardHeader>
        <CardContent>
          <DataTable
            data={payments}
            columns={columns}
            onRowClick={handleRowClick}
            searchable={true}
            sortable={true}
            pageSize={10}
          />
        </CardContent>
        </Card>
      </div>

      {/* Enhanced Payment Detail Modal */}
      {selectedPayment && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="relative bg-white rounded-3xl max-w-4xl w-full max-h-[90vh] overflow-hidden ">
 
            <div className="relative bg-white rounded-3xl overflow-hidden">
              {/* Enhanced Header */}
              <div className="bg-gradient-to-r from-primary-purple to-accent-purple p-6 text-white">
                <div className="flex justify-between items-center">
                  <div className="flex items-center space-x-3">
                    <div className="relative">
 
                      <div className="relative bg-white/20 rounded-full p-2">
                        <CreditCard className="h-6 w-6" />
                      </div>
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold">Payment Details</h2>
                      <p className="text-white/80 mt-1">Comprehensive payment information</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedPayment(null)}
                    className="text-white/80 hover:text-white hover:bg-white/20 p-2 rounded-xl transition-all duration-200"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Payment Information Grid */}
              <div className="p-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="relative group">
 
                    <div className="relative bg-gray-50 rounded-xl p-4">
                      <div className="flex items-center space-x-3">
                        <div className="bg-primary-purple/10 rounded-lg p-2">
                          <CreditCard className="h-5 w-5 text-primary-purple" />
                        </div>
                        <div>
                          <label className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Payment Reference</label>
                          <p className="text-lg font-semibold text-gray-900">{selectedPayment.payment_ref_number || 'N/A'}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="relative group">
 
                    <div className="relative bg-gray-50 rounded-xl p-4">
                      <div className="flex items-center space-x-3">
                        <div className="bg-accent-cyan/10 rounded-lg p-2">
                          <Badge variant={getStatusBadge(selectedPayment.status)} className="h-5 w-5" />
                        </div>
                        <div>
                          <label className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Status</label>
                          <div className="mt-1">
                            <Badge variant={getStatusBadge(selectedPayment.status)} className="text-sm">
                              {selectedPayment.status}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="relative group">
 
                    <div className="relative bg-gray-50 rounded-xl p-4">
                      <div className="flex items-center space-x-3">
                        <div className="bg-primary-purple/10 rounded-lg p-2">
                          <DollarSign className="h-5 w-5 text-primary-purple" />
                        </div>
                        <div>
                          <label className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Total Amount</label>
                          <p className="text-lg font-semibold text-gray-900">${parseFloat(selectedPayment.total_amount || 0).toLocaleString()}</p>
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
                          <label className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Payment Method</label>
                          <p className="text-lg font-semibold text-gray-900">{selectedPayment.method || 'N/A'}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="relative group">
 
                    <div className="relative bg-gray-50 rounded-xl p-4">
                      <div className="flex items-center space-x-3">
                        <div className="bg-primary-purple/10 rounded-lg p-2">
                          <Shield className="h-5 w-5 text-primary-purple" />
                        </div>
                        <div>
                          <label className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Insurer</label>
                          <p className="text-lg font-semibold text-gray-900">{selectedPayment.insurer_name || 'N/A'}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="relative group">
 
                    <div className="relative bg-gray-50 rounded-xl p-4">
                      <div className="flex items-center space-x-3">
                        <div className="bg-accent-cyan/10 rounded-lg p-2">
                          <Building2 className="h-5 w-5 text-accent-cyan" />
                        </div>
                        <div>
                          <label className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Provider</label>
                          <p className="text-lg font-semibold text-gray-900">{selectedPayment.provider_name || 'N/A'}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="relative group">
 
                    <div className="relative bg-gray-50 rounded-xl p-4">
                      <div className="flex items-center space-x-3">
                        <div className="bg-primary-purple/10 rounded-lg p-2">
                          <Calendar className="h-5 w-5 text-primary-purple" />
                        </div>
                        <div>
                          <label className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Payment Date</label>
                          <p className="text-lg font-semibold text-gray-900">{new Date(selectedPayment.payment_date).toLocaleDateString()}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="relative group md:col-span-2">
 
                    <div className="relative bg-gray-50 rounded-xl p-4">
                      <div className="flex items-center space-x-3">
                        <div className="bg-accent-cyan/10 rounded-lg p-2">
                          <CreditCard className="h-5 w-5 text-accent-cyan" />
                        </div>
                        <div className="flex-1">
                          <label className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Description</label>
                          <p className="text-lg font-semibold text-gray-900">{selectedPayment.description || 'N/A'}</p>
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
                    <span className="font-medium">Payment Reference:</span> {selectedPayment.payment_ref_number || 'N/A'}
                  </div>
                  <div className="flex space-x-3">
                    <button
                      onClick={() => setSelectedPayment(null)}
                      className="px-6 py-2 text-gray-600 hover:text-gray-800 font-medium transition-colors"
                    >
                      Close
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Enhanced Drill-down Modal */}
      {showDrillDown && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="relative bg-white rounded-3xl max-w-7xl w-full max-h-[90vh] overflow-hidden ">
 
            <div className="relative bg-white rounded-3xl overflow-hidden">
              {/* Header */}
              <div className="bg-gradient-to-r from-primary-purple to-accent-purple p-6 text-white">
                <div className="flex justify-between items-center">
                  <div>
                    <h2 className="text-2xl font-bold">{drillDownTitle}</h2>
                    <p className="text-white/80 mt-1">Detailed breakdown of selected data</p>
                  </div>
                  <button
                    onClick={closeDrillDown}
                    className="text-white/80 hover:text-white hover:bg-white/20 p-2 rounded-xl transition-all duration-200"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
              
              <div className="overflow-x-auto p-6">
                <table className="min-w-full">
                  <thead>
                    <tr className="bg-gradient-to-r from-gray-50 to-gray-100">
                      <th className="px-6 py-4 text-left text-xs font-bold text-gray-600 uppercase tracking-wider rounded-tl-xl">
                        Payment Ref
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">
                        Insurer
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">
                        Provider
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">
                        Amount
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-gray-600 uppercase tracking-wider rounded-tr-xl">
                        Date
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {drillDownData.map((payment, index) => (
                      <tr key={index} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {payment.payment_ref_number || 'N/A'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          {payment.insurer_name || 'N/A'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          {payment.provider_name || 'N/A'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {payment.total_amount ? `$${parseFloat(payment.total_amount).toLocaleString()}` : 'N/A'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex px-3 py-1 text-xs font-semibold rounded-full ${
                            payment.status === 'Completed' ? 'bg-accent-teal/10 text-accent-teal' :
                            payment.status === 'Pending' ? 'bg-yellow-100 text-yellow-800' :
                            payment.status === 'Failed' ? 'bg-red-100 text-red-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {payment.status || 'N/A'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          {payment.payment_date ? new Date(payment.payment_date).toLocaleDateString() : 'N/A'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                
                {drillDownData.length === 0 && (
                  <div className="text-center text-gray-500 py-12">
                    <div className="w-20 h-20 bg-gray-100 rounded-full mx-auto mb-4 flex items-center justify-center">
                      <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <p className="text-xl font-medium">No data found</p>
                    <p className="text-gray-400 mt-2">No records match the selected criteria</p>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="bg-gray-50 px-6 py-4 border-t border-gray-200">
                <div className="flex justify-between items-center">
                  <div className="text-sm text-gray-600">
                    Showing {drillDownData.length} record{drillDownData.length !== 1 ? 's' : ''}
                  </div>
                  <button
                    onClick={closeDrillDown}
                    className="bg-gradient-to-r from-primary-purple to-accent-purple text-white px-6 py-2 rounded-xl transition-all duration-200 font-medium"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
