import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Patients from './pages/Patients';
import Providers from './pages/Providers';
import Insurers from './pages/Insurers';
import Authorizations from './pages/Authorizations';
import Eligibility from './pages/Eligibility';
import Claims from './pages/Claims';
import ClaimBatches from './pages/ClaimBatches';
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
import NphiesEligibility from './pages/NphiesEligibility';
import PriorAuthorizations from './pages/PriorAuthorizations';
import PriorAuthorizationForm from './pages/PriorAuthorizationForm';
import PriorAuthorizationDetails from './pages/PriorAuthorizationDetails';
import ChatAssistant from './components/chat/ChatAssistant';

function App() {
  return (
    <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/patients" element={<Patients />} />
          <Route path="/providers" element={<Providers />} />
          <Route path="/insurers" element={<Insurers />} />
          <Route path="/authorizations" element={<Authorizations />} />
          <Route path="/eligibility" element={<Eligibility />} />
          <Route path="/nphies-eligibility" element={<NphiesEligibility />} />
          <Route path="/claims" element={<Claims />} />
          <Route path="/claim-batches" element={<ClaimBatches />} />
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
        </Routes>
      </Layout>
      <ChatAssistant />
    </Router>
  );
}

export default App;
