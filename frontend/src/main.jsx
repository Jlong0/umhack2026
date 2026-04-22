import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "@/App";
import { ToastProvider, Toaster } from "@/components/ui/toast";
import "./index.css";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <ToastProvider>
      <BrowserRouter>
        <App />
        <Toaster />
      </BrowserRouter>
    </ToastProvider>
  </StrictMode>,
);
