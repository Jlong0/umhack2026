import { Activity, LayoutDashboard, Upload, Wrench, Workflow, AlertCircle, Users, Calculator, Columns, GitBranch, ScrollText } from "lucide-react";
import { createElement } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useWorkerStore } from "@/store/useWorkerStore";
import { useUIStore } from "@/store/useUIStore";
import ComplianceBreachBanner from "@/components/ComplianceBreachBanner";
import IntentPreviewModal from "@/components/IntentPreviewModal";
import AuditLogDrawer from "@/components/AuditLogDrawer";
import AutonomyDial from "@/components/AutonomyDial";

const NAV_ITEMS = [
  {
    to: "/dashboard",
    label: "Executive Dashboard",
    icon: LayoutDashboard,
  },
  {
    to: "/ingestion",
    label: "Document Ingestion",
    icon: Upload,
  },
  {
    to: "/workflows",
    label: "Agent Workflows",
    icon: Workflow,
  },
  {
    to: "/pipeline",
    label: "Gate Pipeline",
    icon: Columns,
  },
  {
    to: "/alerts",
    label: "Compliance Alerts",
    icon: AlertCircle,
  },
  {
    to: "/hitl",
    label: "HITL Interrupts",
    icon: Users,
  },
  {
    to: "/dual-sync",
    label: "F&B Dual Sync",
    icon: GitBranch,
  },
  {
    to: "/simulator",
    label: "What-If Simulator",
    icon: Calculator,
  },
  {
    to: "/worker-visualizer",
    label: "Worker Visualizer",
    icon: Workflow,
  },
  {
    to: "/tool-handoff",
    label: "Tool Handoff",
    icon: Wrench,
  },
];

function statusTone(status) {
  if (status === "completed") {
    return "text-emerald-700";
  }

  if (status === "failed") {
    return "text-rose-700";
  }

  if (status === "processing" || status === "in_progress" || status === "queued") {
    return "text-indigo-700";
  }

  return "text-slate-700";
}

export default function AppLayout() {
  const parseJobStatus = useWorkerStore((state) => state.parseJobStatus);
  const workerId = useWorkerStore((state) => state.workerId);
  const toggleAuditLog = useUIStore((s) => s.toggleAuditLog);
  const navigate = useNavigate();

  return (
    <div className="relative min-h-screen">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_12%_18%,rgba(30,64,175,0.11),transparent_36%),radial-gradient(circle_at_88%_2%,rgba(190,24,93,0.08),transparent_24%)]" />

      <header className="border-b border-slate-200/70 bg-white/80 backdrop-blur-sm">
        <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <div>
            <p className="font-heading text-xs uppercase tracking-[0.24em] text-indigo-700">PermitIQ</p>
            <h1 className="font-heading text-xl font-semibold text-slate-950">Agentic Workflow Console</h1>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">Role:</span>
              <select
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                value="staff"
                onChange={(e) => { if (e.target.value === "worker") navigate("/worker/upload"); }}
              >
                <option value="staff">Staff</option>
                <option value="worker">Worker</option>
              </select>
            </div>
            <AutonomyDial compact />
            <button
              onClick={toggleAuditLog}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 transition hover:border-indigo-200 hover:text-indigo-800 shadow-soft"
              aria-label="Open audit log"
            >
              <ScrollText className="h-3.5 w-3.5" />
              Audit Log
            </button>
            <div className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs text-slate-600 shadow-soft">
              <Activity className="h-4 w-4 text-indigo-600" />
              <span className={cn("font-medium capitalize", statusTone(parseJobStatus))}>
                Parse state: {String(parseJobStatus).replace(/_/g, " ")}
              </span>
              <span className="hidden text-slate-400 sm:inline">|</span>
              <span className="font-mono text-[11px] text-slate-500">
                Worker: {workerId || "demo-worker-001"}
              </span>
            </div>
          </div>
        </div>

        <div className="mx-auto w-full max-w-7xl px-4 pb-4 sm:px-6 lg:px-8">
          <nav className="flex flex-wrap gap-2" aria-label="Primary navigation">
            {NAV_ITEMS.map((item) => {
              const iconNode = createElement(item.icon, { className: "h-4 w-4" });

              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    cn(
                      "inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition",
                      isActive
                        ? "border-indigo-300 bg-indigo-50 text-indigo-900"
                        : "border-slate-200 bg-white text-slate-700 hover:border-indigo-200 hover:text-indigo-800",
                    )
                  }
                >
                  {iconNode}
                  {item.label}
                </NavLink>
              );
            })}
          </nav>
        </div>
      </header>

      <ComplianceBreachBanner />

      <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <Outlet />
      </main>

      <IntentPreviewModal />
      <AuditLogDrawer />
    </div>
  );
}
