import { Activity, LayoutDashboard, Wrench, Workflow, AlertCircle, Users, Calculator, Columns, GitBranch, ScrollText, FileSignature, CalendarIcon, Network, Building2, LogOut, UserPlus } from "lucide-react";
import { createElement } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/useAuthStore";
import { useWorkerStore } from "@/store/useWorkerStore";
import { useUIStore } from "@/store/useUIStore";
import ComplianceBreachBanner from "@/components/ComplianceBreachBanner";
import IntentPreviewModal from "@/components/IntentPreviewModal";
import AuditLogDrawer from "@/components/AuditLogDrawer";
import AutonomyDial from "@/components/AutonomyDial";
import AICommandConsole from "@/components/AICommandConsole";

const NAV_ITEMS = [
  {
    to: "/dashboard",
    label: "Overview",
    icon: LayoutDashboard,
  },
  {
    to: "/graph",
    label: "Workflow Diagram",
    icon: Network,
  },
  {
    to: "/workflows",
    label: "Worker Workflows",
    icon: Workflow,
  },
  {
    to: "/pipeline",
    label: "Permit Stages Board",
    icon: Columns,
  },
  {
    to: "/alerts",
    label: "Alerts",
    icon: AlertCircle,
  },
  {
    to: "/workers",
    label: "Workers",
    icon: ScrollText,
  },
  {
    to: "/hitl",
    label: "Approvals Queue",
    icon: Users,
  },
  {
    to: "/contract-generation",
    label: "Contract Generator",
    icon: FileSignature,
  },
  {
    to: "/gov-portal",
    label: "Gov Portal (Demo)",
    icon: Building2,
  },
  {
    to: "/dual-sync",
    label: "Sync With Gov Records",
    icon: GitBranch,
  },
  {
    to: "/simulator",
    label: "Cost Simulator",
    icon: Calculator,
  },
  {
    to: "/worker-visualizer",
    label: "Worker Compliance Graph",
    icon: Workflow,
  },
  {
    to: "/tool-handoff",
    label: "Action Approvals",
    icon: Wrench,
  },
  {
    to: "/worker-calendar",
    label: "Renewal Calendar",
    icon: CalendarIcon,
  },
  {
    to: "/worker-invite",
    label: "Invite Workers",
    icon: UserPlus,
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
  const logout = useAuthStore((state) => state.logout);
  const companyName = useAuthStore((state) => state.user?.name);
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/", { replace: true });
  };

  const handleRoleSwitch = (role) => {
    if (role === "worker") {
      logout();
      navigate("/login/worker", { replace: true });
    }
  };

  return (
    <div className="relative min-h-screen">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_12%_18%,rgba(30,64,175,0.11),transparent_36%),radial-gradient(circle_at_88%_2%,rgba(190,24,93,0.08),transparent_24%)]" />

      <header className="border-b border-slate-200/70 bg-white/80 backdrop-blur-sm">
        <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <div>
            <p className="font-heading text-xs uppercase tracking-[0.24em] text-indigo-700">PermitIQ</p>
            <h1 className="font-heading text-xl font-semibold text-slate-950">Admin Console</h1>
            {companyName && <p className="text-xs text-slate-500">{companyName}</p>}
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">Role:</span>
              <select
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                value="staff"
                onChange={(e) => handleRoleSwitch(e.target.value)}
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
            <button
              onClick={handleLogout}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 shadow-soft transition hover:border-rose-200 hover:text-rose-700"
            >
              <LogOut className="h-3.5 w-3.5" />
              Sign out
            </button>
            <div className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs text-slate-600 shadow-soft">
              <Activity className="h-4 w-4 text-indigo-600" />
              <span className={cn("font-medium capitalize", statusTone(parseJobStatus))}>
                Parse state: {String(parseJobStatus).replace(/_/g, " ")}
              </span>
              <span className="hidden text-slate-400 sm:inline">|</span>
              <span className="font-mono text-[11px] text-slate-500">
                Worker: {workerId || "not-selected"}
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
      <AICommandConsole />
    </div>
  );
}
