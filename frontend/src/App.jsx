import { Navigate, Route, Routes } from "react-router-dom";
import AppLayout from "@/components/AppLayout";
import ConfirmPage from "@/pages/ConfirmPage";
import Dashboard from "@/pages/Dashboard";
import UploadPage from "@/pages/UploadPage";
import WorkerProfilePage from "@/pages/WorkerProfilePage";

function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/ingestion" element={<UploadPage />} />
        <Route path="/worker-visualizer" element={<WorkerProfilePage />} />
        <Route path="/tool-handoff" element={<ConfirmPage />} />
      </Route>
      <Route path="/" element={<Navigate to="/ingestion" replace />} />
      <Route path="*" element={<Navigate to="/ingestion" replace />} />
    </Routes>
  );
}

export default App;
