import { Navigate, Route, Routes } from "react-router-dom";
import AppLayout from "@/components/AppLayout";
import WorkerLayout from "@/components/WorkerLayout";
import ConfirmPage from "@/pages/ConfirmPage";
import Dashboard from "@/pages/Dashboard";
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
import ContractGenerationPage from "@/pages/ContractGenerationPage";
import WorkerObligationCalendar from "@/pages/WorkerObligationCalendar";


import MedicalReviewPage from "@/pages/MedicalReviewPage";

function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/dashboard" element={<Dashboard />} />
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
        <Route path="/worker-calendar" element={<WorkerObligationCalendar />} />
      </Route>
      <Route element={<WorkerLayout />}>
        <Route path="/worker" element={<Navigate to="/worker/upload" replace />} />
        <Route path="/worker/upload" element={<WorkerUploadPage />} />
        <Route path="/worker/status" element={<WorkerStatusPage />} />
        <Route path="/worker/contracts" element={<WorkerContractPage />} />
      </Route>
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

export default App;

