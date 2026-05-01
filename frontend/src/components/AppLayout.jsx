import {
  Activity,
  LayoutDashboard,
  Wrench,
  Workflow,
  AlertCircle,
  Users,
  Calculator,
  Columns,
  GitBranch,
  ScrollText,
  FileSignature,
  CalendarIcon,
  Building2,
  LogOut,
  UserPlus,
  Menu,
  X,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { createElement, useState } from "react";
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
    label: "Compliance Workflow",
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
    return "text-emerald-400";
  }

  if (status === "failed") {
    return "text-red-400";
  }

  if (status === "processing" || status === "in_progress" || status === "queued") {
    return "text-blue-400";
  }

  return "text-slate-400";
}

export default function AppLayout() {
  const parseJobStatus = useWorkerStore((state) => state.parseJobStatus);
  const workerId = useWorkerStore((state) => state.workerId);
  const toggleAuditLog = useUIStore((s) => s.toggleAuditLog);
  const logout = useAuthStore((state) => state.logout);
  const companyName = useAuthStore((state) => state.user?.name);
  const navigate = useNavigate();

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);

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

  const sidebarContent = (
    <div className="flex h-full flex-col">
      {/* Branding */}
      <div className="flex items-center justify-between border-b border-slate-700/50 px-4 py-5">
        {/* Expanded: icon + text. Collapsed: nothing (arrow takes full row) */}
        {sidebarOpen ? (
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-blue-600">
              <Activity className="h-5 w-5 text-white" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-blue-400">PermitIQ</p>
              <p className="truncate text-sm font-semibold text-white">Admin Console</p>
            </div>
          </div>
        ) : (
          /* Collapsed: empty spacer so the arrow centers */
          <div className="hidden lg:block" />
        )}
        {/* Desktop collapse toggle */}
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className={cn(
            "hidden rounded-md p-1.5 text-slate-400 transition-colors duration-200 hover:bg-slate-800 hover:text-white lg:block",
            !sidebarOpen && "lg:mx-auto",
          )}
          aria-label={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
        >
          {sidebarOpen ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>
        {/* Mobile close */}
        <button
          onClick={() => setMobileOpen(false)}
          className="rounded-md p-1 text-slate-400 transition-colors duration-200 hover:bg-slate-800 hover:text-white lg:hidden"
          aria-label="Close sidebar"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Company & Role — hidden entirely when collapsed */}
      <div className={cn("border-b border-slate-700/50 px-4 py-3", !sidebarOpen && "lg:hidden")}>
        {companyName && (
          <p className="mb-2 truncate text-xs text-slate-400">
            {companyName}
          </p>
        )}
        <div className="flex items-center gap-2">
          <span className="text-[10px] uppercase tracking-wide text-slate-500">Role</span>
          <select
            className="w-full rounded-md border border-slate-700 bg-slate-800 px-2 py-1.5 text-xs font-medium text-slate-300 transition-colors duration-200 hover:border-slate-600 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            value="staff"
            onChange={(e) => handleRoleSwitch(e.target.value)}
          >
            <option value="staff">Staff</option>
            <option value="worker">Worker</option>
          </select>
        </div>
      </div>

      {/* Nav Links */}
      <nav className="flex-1 overflow-y-auto px-3 py-3" aria-label="Primary navigation">
        <ul className="space-y-1">
          {NAV_ITEMS.map((item) => {
            const iconNode = createElement(item.icon, { className: "h-4 w-4 flex-shrink-0" });

            return (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  onClick={() => setMobileOpen(false)}
                  title={!sidebarOpen ? item.label : undefined}
                  className={({ isActive }) =>
                    cn(
                      "group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
                      isActive
                        ? "border-l-2 border-blue-500 bg-blue-600/15 text-white"
                        : "border-l-2 border-transparent text-slate-400 hover:bg-slate-800 hover:text-white",
                      !sidebarOpen && "lg:justify-center lg:px-2",
                    )
                  }
                >
                  {iconNode}
                  <span className={cn("truncate", !sidebarOpen && "lg:hidden")}>{item.label}</span>
                </NavLink>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Bottom Section */}
      <div className="mt-auto border-t border-slate-700/50">
        {/* Status bar */}
        <div className={cn("border-b border-slate-700/50 px-4 py-3", !sidebarOpen && "lg:px-2")}>
          <div className={cn("flex items-center gap-2 text-xs", !sidebarOpen && "lg:flex-col lg:gap-1")}>
            <Activity className="h-3.5 w-3.5 flex-shrink-0 text-blue-400" />
            <span className={cn("truncate", !sidebarOpen && "lg:hidden")}>
              <span className={cn("font-medium capitalize", statusTone(parseJobStatus))}>
                {String(parseJobStatus).replace(/_/g, " ")}
              </span>
            </span>
          </div>
          <p className={cn("mt-1 truncate font-mono text-[10px] text-slate-500", !sidebarOpen && "lg:hidden")}>
            WID: {workerId || "none"}
          </p>
        </div>

        {/* Actions */}
        <div className={cn("space-y-1 px-3 py-3", !sidebarOpen && "lg:px-2")}>
          <div className={cn(!sidebarOpen && "lg:hidden")}>
            <AutonomyDial compact />
          </div>

          <button
            onClick={toggleAuditLog}
            title={!sidebarOpen ? "Audit Log" : undefined}
            className={cn(
              "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-400 transition-colors duration-200 hover:bg-slate-800 hover:text-white",
              !sidebarOpen && "lg:justify-center lg:px-2",
            )}
          >
            <ScrollText className="h-4 w-4 flex-shrink-0" />
            <span className={cn(!sidebarOpen && "lg:hidden")}>Audit Log</span>
          </button>

          <button
            onClick={handleLogout}
            title={!sidebarOpen ? "Sign out" : undefined}
            className={cn(
              "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-red-400 transition-colors duration-200 hover:bg-red-500/10 hover:text-red-300",
              !sidebarOpen && "lg:justify-center lg:px-2",
            )}
          >
            <LogOut className="h-4 w-4 flex-shrink-0" />
            <span className={cn(!sidebarOpen && "lg:hidden")}>Sign out</span>
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="relative min-h-screen bg-slate-50">
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/60 backdrop-blur-sm transition-opacity duration-300 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar — mobile: slide-over drawer, desktop: persistent rail */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex flex-col bg-slate-900 transition-all duration-300",
          // Desktop sizing
          sidebarOpen ? "lg:w-64" : "lg:w-[68px]",
          // Mobile: slide from left
          mobileOpen ? "w-72 translate-x-0" : "-translate-x-full lg:translate-x-0",
        )}
      >
        {sidebarContent}
      </aside>

      {/* Main content wrapper */}
      <div
        className={cn(
          "min-h-screen transition-all duration-300",
          sidebarOpen ? "lg:ml-64" : "lg:ml-[68px]",
        )}
      >
        {/* Mobile top bar */}
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-slate-200 bg-white/80 px-4 py-3 backdrop-blur-sm lg:hidden">
          <button
            onClick={() => setMobileOpen(true)}
            className="rounded-lg border border-slate-200 p-2 text-slate-600 transition-colors duration-200 hover:bg-slate-100"
            aria-label="Open navigation"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-blue-600">PermitIQ</p>
            <p className="text-sm font-semibold text-slate-900">Admin Console</p>
          </div>
        </header>

        <ComplianceBreachBanner />

        <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <Outlet />
        </main>
      </div>

      <IntentPreviewModal />
      <AuditLogDrawer />
      <AICommandConsole />
    </div>
  );
}
