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
  ChevronDown,
  Sun,
  Moon,
  Beaker,
} from "lucide-react";
import { createElement, useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/useAuthStore";
import { useWorkerStore } from "@/store/useWorkerStore";
import { useUIStore } from "@/store/useUIStore";
import { useThemeStore } from "@/store/useThemeStore";
import { useAlertDashboard } from "@/hooks/queries/useAlertQueries";
import { usePendingInterrupts } from "@/hooks/queries/useHITLQueries";
import ComplianceBreachBanner from "@/components/ComplianceBreachBanner";
import IntentPreviewModal from "@/components/IntentPreviewModal";
import AuditLogDrawer from "@/components/AuditLogDrawer";
import AutonomyDial from "@/components/AutonomyDial";
import AICommandConsole from "@/components/AICommandConsole";
import { Badge } from "@/components/ui/badge";

/* ───────── Navigation structure ───────── */

const NAV_GROUPS = [
  {
    label: "Operations",
    items: [
      { to: "/dashboard", label: "Overview", icon: LayoutDashboard },
      { to: "/pipeline", label: "Permit Stages", icon: Columns },
      { to: "/alerts", label: "Alerts", icon: AlertCircle, badgeKey: "alerts" },
      { to: "/workers", label: "Workers", icon: ScrollText },
      { to: "/hitl", label: "Approvals", icon: Users, badgeKey: "hitl" },
    ],
  },
  {
    label: "Planning",
    items: [
      { to: "/simulator", label: "Cost Simulator", icon: Calculator },
      { to: "/worker-visualizer", label: "Compliance Flow", icon: Workflow },
      { to: "/worker-calendar", label: "Renewal Calendar", icon: CalendarIcon },
    ],
  },
  {
    label: "Administration",
    items: [
      { to: "/contract-generation", label: "Contracts", icon: FileSignature },
      { to: "/tool-handoff", label: "Action Approvals", icon: Wrench },
      { to: "/worker-invite", label: "Invite Workers", icon: UserPlus },
    ],
  },
  {
    label: "Demo",
    collapsible: true,
    items: [
      { to: "/gov-portal", label: "Gov Portal", icon: Building2 },
      { to: "/dual-sync", label: "Sync Records", icon: GitBranch },
    ],
  },
];

/* ───────── Helpers ───────── */

function statusTone(status) {
  if (status === "completed") return "text-emerald-400";
  if (status === "failed") return "text-red-400";
  if (status === "processing" || status === "in_progress" || status === "queued") return "text-blue-400";
  return "text-slate-400";
}

/* ───────── Sub-components ───────── */

function ThemeSelectorButton({ sidebarOpen }) {
  const theme = useThemeStore((state) => state.theme);
  const setTheme = useThemeStore((state) => state.setTheme);

  return (
    <button
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
      title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      className={cn(
        "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors duration-200 hover:bg-muted hover:text-foreground",
        !sidebarOpen && "lg:justify-center lg:px-2",
      )}
    >
      {theme === "dark" ? (
        <Sun className="h-4 w-4 flex-shrink-0" />
      ) : (
        <Moon className="h-4 w-4 flex-shrink-0" />
      )}
      <span className={cn("truncate", !sidebarOpen && "lg:hidden")}>
        {theme === "dark" ? "Light mode" : "Dark mode"}
      </span>
    </button>
  );
}

function NavBadge({ count }) {
  if (!count || count <= 0) return null;
  return (
    <Badge
      variant={count > 0 ? "danger" : "default"}
      className="ml-auto h-5 min-w-[1.25rem] justify-center px-1.5 text-[10px]"
    >
      {count > 99 ? "99+" : count}
    </Badge>
  );
}

function SectionLabel({ label, sidebarOpen }) {
  if (!sidebarOpen) return <div className="my-2 border-t border-border lg:mx-2" />;
  return (
    <li className="px-3 pb-1 pt-4 first:pt-0">
      <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </span>
    </li>
  );
}

function CollapsibleGroup({ label, children, sidebarOpen }) {
  const [open, setOpen] = useState(false);

  if (!sidebarOpen) {
    // Collapsed sidebar: just show items without group header
    return <>{open && children}</>;
  }

  return (
    <>
      <li className="px-3 pb-1 pt-4">
        <button
          onClick={() => setOpen(!open)}
          className="flex w-full items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground transition-colors hover:text-foreground"
        >
          <ChevronDown className={cn("h-3 w-3 transition-transform duration-200", !open && "-rotate-90")} />
          {label}
        </button>
      </li>
      {open && children}
    </>
  );
}

/* ───────── Main Layout ───────── */

export default function AppLayout() {
  const parseJobStatus = useWorkerStore((state) => state.parseJobStatus);
  const workerId = useWorkerStore((state) => state.workerId);
  const toggleAuditLog = useUIStore((s) => s.toggleAuditLog);
  const logout = useAuthStore((state) => state.logout);
  const companyName = useAuthStore((state) => state.user?.name);
  const navigate = useNavigate();

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Badge counts
  const { data: alertDashboard } = useAlertDashboard();
  const { data: interruptData } = usePendingInterrupts();
  const alertCount = alertDashboard?.summary?.expired_permits || 0;
  const hitlCount = interruptData?.total || 0;
  const badgeCounts = { alerts: alertCount, hitl: hitlCount };

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
      <div className="flex items-center justify-between border-b border-border px-4 py-5">
        {sidebarOpen ? (
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-blue-600">
              <Activity className="h-5 w-5 text-white" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-blue-600 dark:text-blue-400">PermitIQ</p>
              <p className="truncate text-sm font-semibold text-foreground">Admin Console</p>
            </div>
          </div>
        ) : (
          <div className="hidden lg:block" />
        )}
        {/* Desktop collapse toggle */}
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className={cn(
            "hidden rounded-md p-1.5 text-muted-foreground transition-colors duration-200 hover:bg-muted hover:text-foreground lg:block",
            !sidebarOpen && "lg:mx-auto",
          )}
          aria-label={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
        >
          {sidebarOpen ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>
        {/* Mobile close */}
        <button
          onClick={() => setMobileOpen(false)}
          className="rounded-md p-1 text-muted-foreground transition-colors duration-200 hover:bg-muted hover:text-foreground lg:hidden"
          aria-label="Close sidebar"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Company & Role — hidden when collapsed */}
      <div className={cn("border-b border-border px-4 py-3", !sidebarOpen && "lg:hidden")}>
        {companyName && (
          <p className="mb-2 truncate text-xs text-muted-foreground">{companyName}</p>
        )}
        <div className="flex items-center gap-2">
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Role</span>
          <select
            className="w-full rounded-md border border-border bg-muted px-2 py-1.5 text-xs font-medium text-foreground transition-colors duration-200 hover:border-blue-500/30 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            value="staff"
            onChange={(e) => handleRoleSwitch(e.target.value)}
          >
            <option value="staff">Staff</option>
            <option value="worker">Worker</option>
          </select>
        </div>
      </div>

      {/* Nav Links — grouped */}
      <nav className="flex-1 overflow-y-auto px-3 py-2" aria-label="Primary navigation">
        <ul className="space-y-0.5">
          {NAV_GROUPS.map((group) => {
            const navItems = group.items.map((item) => {
              const iconNode = createElement(item.icon, { className: "h-4 w-4 flex-shrink-0" });
              const count = item.badgeKey ? badgeCounts[item.badgeKey] : 0;

              return (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    onClick={() => setMobileOpen(false)}
                    title={!sidebarOpen ? item.label : undefined}
                    className={({ isActive }) =>
                      cn(
                        "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
                        isActive
                          ? "border-l-2 border-blue-500 bg-blue-600/15 text-blue-700 dark:text-white"
                          : "border-l-2 border-transparent text-muted-foreground hover:bg-muted hover:text-foreground",
                        !sidebarOpen && "lg:justify-center lg:px-2",
                      )
                    }
                  >
                    {iconNode}
                    <span className={cn("truncate", !sidebarOpen && "lg:hidden")}>{item.label}</span>
                    {sidebarOpen && count > 0 && <NavBadge count={count} />}
                  </NavLink>
                </li>
              );
            });

            if (group.collapsible) {
              return (
                <CollapsibleGroup key={group.label} label={group.label} sidebarOpen={sidebarOpen}>
                  {navItems}
                </CollapsibleGroup>
              );
            }

            return (
              <li key={group.label} className="list-none">
                <SectionLabel label={group.label} sidebarOpen={sidebarOpen} />
                <ul className="space-y-0.5">{navItems}</ul>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Bottom Section */}
      <div className="mt-auto border-t border-border">
        {/* Status bar */}
        <div className={cn("border-b border-border px-4 py-3", !sidebarOpen && "lg:px-2")}>
          <div className={cn("flex items-center gap-2 text-xs", !sidebarOpen && "lg:flex-col lg:gap-1")}>
            <Activity className="h-3.5 w-3.5 flex-shrink-0 text-blue-500" />
            <span className={cn("truncate", !sidebarOpen && "lg:hidden")}>
              <span className={cn("font-medium capitalize", statusTone(parseJobStatus))}>
                {String(parseJobStatus).replace(/_/g, " ")}
              </span>
            </span>
          </div>
          <p className={cn("mt-1 truncate font-mono text-[10px] text-muted-foreground", !sidebarOpen && "lg:hidden")}>
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
              "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors duration-200 hover:bg-muted hover:text-foreground",
              !sidebarOpen && "lg:justify-center lg:px-2",
            )}
          >
            <ScrollText className="h-4 w-4 flex-shrink-0" />
            <span className={cn(!sidebarOpen && "lg:hidden")}>Audit Log</span>
          </button>

          <ThemeSelectorButton sidebarOpen={sidebarOpen} />

          <button
            onClick={handleLogout}
            title={!sidebarOpen ? "Sign out" : undefined}
            className={cn(
              "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-red-500 dark:text-red-400 transition-colors duration-200 hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-300",
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
    <div className="relative min-h-screen bg-background">
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm transition-opacity duration-300 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex flex-col border-r border-border bg-card transition-all duration-300",
          sidebarOpen ? "lg:w-64" : "lg:w-[68px]",
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
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-border bg-card/80 px-4 py-3 backdrop-blur-sm lg:hidden">
          <button
            onClick={() => setMobileOpen(true)}
            className="rounded-lg border border-border p-2 text-muted-foreground transition-colors duration-200 hover:bg-muted"
            aria-label="Open navigation"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-blue-600 dark:text-blue-400">PermitIQ</p>
            <p className="text-sm font-semibold text-foreground">Admin Console</p>
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
