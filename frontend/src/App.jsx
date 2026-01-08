import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Patients from './pages/Patients';
import PatientDetails from './pages/PatientDetails';
import PatientForm from './pages/PatientForm';
import Providers from './pages/Providers';
import ProviderDetails from './pages/ProviderDetails';
import ProviderForm from './pages/ProviderForm';
import Insurers from './pages/Insurers';
import InsurerDetails from './pages/InsurerDetails';
import InsurerForm from './pages/InsurerForm';
import Authorizations from './pages/Authorizations';
import Eligibility from './pages/Eligibility';
import Claims from './pages/Claims';
import ClaimBatches from './pages/ClaimBatches';
import BatchClaimDetails from './pages/BatchClaimDetails';
import BatchBundlePreview from './pages/BatchBundlePreview';
import CreateBatchClaim from './pages/CreateBatchClaim';
import Payments from './pages/Payments';
import ResponseViewer from './pages/ResponseViewer';
import GeneralForm from './pages/GeneralForm';
import GeneralRequests from './pages/GeneralRequests';
import GeneralRequestDetails from './pages/GeneralRequestDetails';
import DentalForm from './pages/DentalForm';
import EyesightForm from './pages/EyesightForm';
import StandardApprovals from './pages/StandardApprovals';
import StandardApprovalsForm from './pages/StandardApprovalsForm';
import StandardApprovalsDetails from './pages/StandardApprovalsDetails';
import DentalApprovals from './pages/DentalApprovals';
import DentalApprovalsForm from './pages/DentalApprovalsForm';
import DentalApprovalsDetails from './pages/DentalApprovalsDetails';
import EyeApprovals from './pages/EyeApprovals';
import EyeApprovalsForm from './pages/EyeApprovalsForm';
import EyeApprovalsDetails from './pages/EyeApprovalsDetails';
import MedicineSearch from './pages/MedicineSearch';
import NphiesEligibilityList from './pages/NphiesEligibilityList';
import NphiesEligibilityForm from './pages/NphiesEligibilityForm';
import NphiesEligibilityDetails from './pages/NphiesEligibilityDetails';
import PriorAuthorizations from './pages/PriorAuthorizations';
import PriorAuthorizationForm from './pages/PriorAuthorizationForm';
import PriorAuthorizationDetails from './pages/PriorAuthorizationDetails';
import ClaimSubmissionsList from './pages/ClaimSubmissionsList';
import ClaimDetails from './pages/ClaimDetails';
import PaymentReconciliations from './pages/PaymentReconciliations';
import PaymentReconciliationDetails from './pages/PaymentReconciliationDetails';
import Users from './pages/Users';
import Contacts from './pages/Contacts';
import ChatAssistant from './components/chat/ChatAssistant';

// Protected Route Component
function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="relative inline-flex">
            <div className="w-12 h-12 border-4 border-indigo-200 rounded-full"></div>
            <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin absolute top-0"></div>
          </div>
          <p className="mt-4 text-gray-500 font-medium">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

function AppRoutes() {
  return (
    <Routes>
      {/* Public routes */}
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

      {/* Protected routes */}
      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <Layout>
              <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/patients" element={<Patients />} />
          <Route path="/patients/new" element={<PatientForm />} />
          <Route path="/patients/:id/edit" element={<PatientForm />} />
          <Route path="/patients/:id" element={<PatientDetails />} />
          <Route path="/providers" element={<Providers />} />
          <Route path="/providers/new" element={<ProviderForm />} />
          <Route path="/providers/:id/edit" element={<ProviderForm />} />
          <Route path="/providers/:id" element={<ProviderDetails />} />
          <Route path="/insurers" element={<Insurers />} />
          <Route path="/insurers/new" element={<InsurerForm />} />
          <Route path="/insurers/:id/edit" element={<InsurerForm />} />
          <Route path="/insurers/:id" element={<InsurerDetails />} />
          <Route path="/users" element={<Users />} />
          <Route path="/contacts" element={<Contacts />} />
          <Route path="/authorizations" element={<Authorizations />} />
          <Route path="/eligibility" element={<Eligibility />} />
          <Route path="/nphies-eligibility" element={<NphiesEligibilityList />} />
          <Route path="/nphies-eligibility/new" element={<NphiesEligibilityForm />} />
          <Route path="/nphies-eligibility/:id" element={<NphiesEligibilityDetails />} />
          <Route path="/claims" element={<Claims />} />
          <Route path="/claim-batches" element={<ClaimBatches />} />
          <Route path="/claim-batches/create" element={<CreateBatchClaim />} />
          <Route path="/claim-batches/:id" element={<BatchClaimDetails />} />
          <Route path="/claim-batches/:id/preview" element={<BatchBundlePreview />} />
          <Route path="/payments" element={<Payments />} />
          <Route path="/response-viewer" element={<ResponseViewer />} />
          <Route path="/general-requests" element={<GeneralRequests />} />
          <Route path="/general-requests/new" element={<GeneralForm />} />
          <Route path="/general-requests/:id" element={<GeneralRequestDetails />} />
          <Route path="/general-requests/:id/edit" element={<GeneralForm />} />
          <Route path="/dental-form" element={<DentalForm />} />
          <Route path="/eyesight-form" element={<EyesightForm />} />
          <Route path="/standard-approvals" element={<StandardApprovals />} />
          <Route path="/standard-approvals/new" element={<StandardApprovalsForm />} />
          <Route path="/standard-approvals/:id/edit" element={<StandardApprovalsForm />} />
          <Route path="/standard-approvals/:id" element={<StandardApprovalsDetails />} />
          <Route path="/dental-approvals" element={<DentalApprovals />} />
          <Route path="/dental-approvals/new" element={<DentalApprovalsForm />} />
          <Route path="/dental-approvals/:id/edit" element={<DentalApprovalsForm />} />
          <Route path="/dental-approvals/:id" element={<DentalApprovalsDetails />} />
          <Route path="/eye-approvals" element={<EyeApprovals />} />
          <Route path="/eye-approvals/new" element={<EyeApprovalsForm />} />
          <Route path="/eye-approvals/:id/edit" element={<EyeApprovalsForm />} />
          <Route path="/eye-approvals/:id" element={<EyeApprovalsDetails />} />
          <Route path="/medicines" element={<MedicineSearch />} />
          <Route path="/prior-authorizations" element={<PriorAuthorizations />} />
          <Route path="/prior-authorizations/new" element={<PriorAuthorizationForm />} />
          <Route path="/prior-authorizations/:id" element={<PriorAuthorizationDetails />} />
          <Route path="/prior-authorizations/:id/edit" element={<PriorAuthorizationForm />} />
          <Route path="/claim-submissions" element={<ClaimSubmissionsList />} />
          <Route path="/claim-submissions/:id" element={<ClaimDetails />} />
          <Route path="/payment-reconciliations" element={<PaymentReconciliations />} />
                <Route path="/payment-reconciliations/:id" element={<PaymentReconciliationDetails />} />
              </Routes>
            </Layout>
            <ChatAssistant />
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}

function App() {
  return (
    <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </Router>
  );
}

export default App;
