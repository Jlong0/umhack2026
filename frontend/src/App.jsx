import { Navigate, Route, Routes } from "react-router-dom";
import AppLayout from "@/components/AppLayout";
import ConfirmPage from "@/pages/ConfirmPage";
import Dashboard from "@/pages/Dashboard";
import UploadPage from "@/pages/UploadPage";
import WorkerProfilePage from "@/pages/WorkerProfilePage";
import WorkflowsPage from "@/pages/WorkflowsPage";
import WorkflowDetailPage from "@/pages/WorkflowDetailPage";
import AlertsPage from "@/pages/AlertsPage";
import HITLPage from "@/pages/HITLPage";
import SimulatorPage from "@/pages/SimulatorPage";
import PipelinePage from "@/pages/PipelinePage";
import DualSyncPage from "@/pages/DualSyncPage";

function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/ingestion" element={<UploadPage />} />
        <Route path="/worker-visualizer" element={<WorkerProfilePage />} />
        <Route path="/tool-handoff" element={<ConfirmPage />} />
        <Route path="/workflows" element={<WorkflowsPage />} />
        <Route path="/workflows/:workerId" element={<WorkflowDetailPage />} />
        <Route path="/alerts" element={<AlertsPage />} />
        <Route path="/hitl" element={<HITLPage />} />
        <Route path="/simulator" element={<SimulatorPage />} />
        <Route path="/pipeline" element={<PipelinePage />} />
        <Route path="/dual-sync" element={<DualSyncPage />} />
      </Route>
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

export default App;

