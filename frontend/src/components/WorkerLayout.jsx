import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { getWorkerStatus } from "@/services/api";
import { LogOut, Upload, ClipboardList, FileSignature, Sun, Moon, Mail } from "lucide-react";
import { useAuthStore } from "@/store/useAuthStore";
import { useThemeStore } from "@/store/useThemeStore";
import { cn } from "@/lib/utils";

const TABS = [
  { path: "/worker/upload", label: "Upload", fullLabel: "Upload Documents", icon: Upload },
  { path: "/worker/status", label: "Status", fullLabel: "My Status", icon: ClipboardList },
  { path: "/worker/visa-letter", label: "Visa", fullLabel: "Visa Letter", icon: Mail },
  { path: "/worker/contracts", label: "Contracts", fullLabel: "My Contracts", icon: FileSignature },
];


function JtksmPendingOverlay({ status }) {
  const isRejected = status === "rejected";

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="mx-4 max-w-md rounded-2xl bg-white p-6 text-center shadow-xl dark:bg-slate-900">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">
          {isRejected ? "JTKSM Approval Rejected" : "JTKSM Approval Pending"}
        </h2>

        <p className="mt-3 text-sm text-gray-600 dark:text-gray-300">
          {isRejected
            ? "Your application has been rejected at the JTKSM gate. Please contact your company or admin for more information."
            : "Your application is waiting for company/admin approval at the JTKSM gate. Please wait until your employer approves your profile before continuing."}
        </p>
      </div>
    </div>
  );
}


export default function WorkerLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const logout = useAuthStore((state) => state.logout);
  const theme = useThemeStore((state) => state.theme);
  const setTheme = useThemeStore((state) => state.setTheme);

  const user = useAuthStore((state) => state.user);
  const workerId = user?.id;

  const { data: workerStatus } = useQuery({
    queryKey: ["worker-status", workerId],
    queryFn: () => getWorkerStatus(workerId),
    enabled: !!workerId,
    refetchInterval: 10000,
  });

  const jtksmBlocked =
    workerStatus &&
    workerStatus.jtksm_status !== "approved";

  const handleLogout = () => {
    navigate("/", { replace: true });
    logout();
  };

  return (
    <div className="relative min-h-screen bg-background pb-20 md:pb-0">
      <div className={jtksmBlocked ? "pointer-events-none select-none blur-sm" : ""}>
        <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_12%_18%,rgba(30,64,175,0.11),transparent_36%),radial-gradient(circle_at_88%_2%,rgba(190,24,93,0.08),transparent_24%)]" />

        {/* ── Top header ── */}
        <header className="sticky top-0 z-30 border-b border-border bg-card/80 backdrop-blur-sm">
          <div className="flex w-full items-center justify-between px-4 py-3 sm:px-6 sm:py-4">
            {/* Branding */}
            <div className="flex items-center gap-2.5 sm:gap-3">
              <img src="/logo.png" alt="PermitIQ" className="h-8 w-8 rounded-lg object-contain sm:h-9 sm:w-9" />
              <div>
                <p className="font-heading text-[10px] uppercase tracking-[0.24em] text-indigo-700 dark:text-indigo-400 sm:text-xs">
                  PermitIQ
                </p>
                <h1 className="font-heading text-base font-semibold text-foreground sm:text-xl">
                  Worker Portal
                </h1>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1.5 sm:gap-2">
              <button
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
                className="rounded-lg border border-border p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </button>
              <button
                onClick={handleLogout}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-2 text-xs font-medium text-muted-foreground transition hover:border-rose-200 hover:text-rose-700 dark:hover:border-rose-800 dark:hover:text-rose-400"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Sign out</span>
              </button>
            </div>
          </div>

          {/* ── Desktop navigation tabs (hidden on mobile) ── */}
          <div className="hidden w-full px-4 sm:px-6 md:block">
            <nav className="flex gap-1 border-t border-border pt-1" aria-label="Worker navigation">
              {TABS.map((tab) => {
                const isActive = location.pathname.includes(tab.path.split("/").pop());
                return (
                  <button
                    key={tab.path}
                    onClick={() => navigate(tab.path)}
                    className={cn(
                      "flex items-center gap-2 rounded-t-lg border-b-2 px-4 py-2.5 text-sm font-medium transition-all duration-200",
                      isActive
                        ? "border-indigo-600 bg-indigo-50 text-indigo-900 dark:border-indigo-400 dark:bg-indigo-950/60 dark:text-indigo-100"
                        : "border-transparent text-muted-foreground hover:border-indigo-300 hover:bg-muted hover:text-foreground dark:hover:border-indigo-700",
                    )}
                  >
                    <tab.icon className="h-4 w-4" />
                    {tab.fullLabel}
                  </button>
                );
              })}
            </nav>
          </div>
        </header>

        {/* ── Main content ── */}
        <main className="w-full px-4 py-5 sm:px-6 sm:py-6 lg:px-6 lg:py-8">
          <Outlet />
        </main>

        {/* ── Mobile bottom navigation (visible only on <md) ── */}
        <nav
          className="fixed inset-x-0 bottom-0 z-40 flex items-stretch border-t border-border bg-card/95 backdrop-blur-md md:hidden"
          aria-label="Worker navigation"
          style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
        >
          {TABS.map((tab) => {
            const isActive = location.pathname.includes(tab.path.split("/").pop());
            return (
              <button
                key={tab.path}
                onClick={() => navigate(tab.path)}
                className={cn(
                  "flex flex-1 flex-col items-center justify-center gap-1 py-2.5 text-[11px] font-medium transition-colors",
                  isActive
                    ? "text-indigo-700 dark:text-indigo-400"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <div
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-xl transition-all duration-200",
                    isActive && "bg-indigo-100 dark:bg-indigo-950/60",
                  )}
                >
                  <tab.icon className={cn("h-[18px] w-[18px]", isActive && "text-indigo-700 dark:text-indigo-400")} />
                </div>
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      {jtksmBlocked && (
        <JtksmPendingOverlay status={workerStatus.jtksm_status} />
      )}

    </div>
  );
}
