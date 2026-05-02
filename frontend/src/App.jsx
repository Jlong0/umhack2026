import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import AppLayout from "@/components/AppLayout";
import WorkerLayout from "@/components/WorkerLayout";
import AdminLoginPage from "@/pages/AdminLoginPage";
import ConfirmPage from "@/pages/ConfirmPage";
import Dashboard from "@/pages/Dashboard";
import LandingPage from "@/pages/LandingPage";
import WorkerProfilePage from "@/pages/WorkerProfilePage";
import WorkflowsPage from "@/pages/WorkflowsPage";
import WorkflowDetailPage from "@/pages/WorkflowDetailPage";
import AlertsPage from "@/pages/AlertsPage";
import HITLPage from "@/pages/HITLPage";
import SimulatorPage from "@/pages/SimulatorPage";
import PipelinePage from "@/pages/PipelinePage";
import DualSyncPage from "@/pages/DualSyncPage";
import WorkersPage from "@/pages/WorkersPage";
import WorkerUploadPage from "@/pages/worker/WorkerUploadPage";
import WorkerStatusPage from "@/pages/worker/WorkerStatusPage";
import WorkerContractPage from "@/pages/worker/WorkerContractPage";
import WorkerVisaLetterPage from "@/pages/worker/WorkerVisaLetterPage";
import ContractGenerationPage from "@/pages/ContractGenerationPage";
import WorkerObligationCalendar from "@/pages/WorkerObligationCalendar";
import WorkerInvitePage from "@/pages/WorkerInvitePage";
import GraphVisualizerPage from "@/pages/GraphVisualizerPage";
import LiveOrchestrationPage from "@/pages/LiveOrchestrationPage";
import MockGovPortalPage from "@/pages/MockGovPortalPage";
import WorkerLoginPage from "@/pages/WorkerLoginPage";
import { useAuthStore } from "@/store/useAuthStore";


import MedicalReviewPage from "@/pages/MedicalReviewPage";

function RequireAuth({ role, children }) {
  const location = useLocation();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const currentRole = useAuthStore((state) => state.role);

  if (!isAuthenticated) {
    const loginPath = role === "worker" ? "/login/worker" : "/login/admin";
    return <Navigate to={loginPath} replace state={{ from: location }} />;
  }

  if (role && currentRole !== role) {
    const homePath = currentRole === "worker" ? "/worker/upload" : "/dashboard";
    return <Navigate to={homePath} replace />;
  }

  return children;
}

function RedirectIfAuthenticated({ children }) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const currentRole = useAuthStore((state) => state.role);

  if (isAuthenticated) {
    return <Navigate to={currentRole === "worker" ? "/worker/upload" : "/dashboard"} replace />;
  }

  return children;
}

function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route
        path="/login/admin"
        element={
          <RedirectIfAuthenticated>
            <AdminLoginPage />
          </RedirectIfAuthenticated>
        }
      />
      <Route
        path="/login/worker"
        element={
          <RedirectIfAuthenticated>
            <WorkerLoginPage />
          </RedirectIfAuthenticated>
        }
      />
      <Route
        element={
          <RequireAuth role="admin">
            <AppLayout />
          </RequireAuth>
        }
      >
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/graph" element={<GraphVisualizerPage />} />
        <Route path="/orchestration/:workerId" element={<LiveOrchestrationPage />} />
        <Route path="/worker-visualizer" element={<WorkerProfilePage />} />
        <Route path="/tool-handoff" element={<ConfirmPage />} />
        <Route path="/workflows" element={<WorkflowsPage />} />
        <Route path="/workflows/:workerId" element={<WorkflowDetailPage />} />
        <Route path="/alerts" element={<AlertsPage />} />
        <Route path="/hitl" element={<HITLPage />} />
        <Route path="/hitl/medical/:workerId" element={<MedicalReviewPage />} />
        <Route path="/simulator" element={<SimulatorPage />} />
        <Route path="/pipeline" element={<PipelinePage />} />
        <Route path="/workers" element={<WorkersPage />} />
        <Route path="/dual-sync" element={<DualSyncPage />} />
        <Route path="/contract-generation" element={<ContractGenerationPage />} />
        <Route path="/gov-portal" element={<MockGovPortalPage />} />
        <Route path="/worker-calendar" element={<WorkerObligationCalendar />} />
        <Route path="/worker-invite" element={<WorkerInvitePage />} />
      </Route>
      <Route
        element={
          <RequireAuth role="worker">
            <WorkerLayout />
          </RequireAuth>
        }
      >
        <Route path="/worker" element={<Navigate to="/worker/upload" replace />} />
        <Route path="/worker/upload" element={<WorkerUploadPage />} />
        <Route path="/worker/status" element={<WorkerStatusPage />} />
        <Route path="/worker/visa-letter" element={<WorkerVisaLetterPage />} />
        <Route path="/worker/contracts" element={<WorkerContractPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
