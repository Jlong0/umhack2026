import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { LogOut, Sun, Moon } from "lucide-react";
import { useAuthStore } from "@/store/useAuthStore";
import { useThemeStore } from "@/store/useThemeStore";

function ThemeSelectorSelect() {
  const theme = useThemeStore((state) => state.theme);
  const setTheme = useThemeStore((state) => state.setTheme);

  return (
    <select
      value={theme}
      onChange={(e) => setTheme(e.target.value)}
      className="rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-foreground shadow-sm transition hover:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-300"
    >
      <option value="light">Light</option>
      <option value="dark">Dark</option>
    </select>
  );
}

export default function WorkerLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const logout = useAuthStore((state) => state.logout);

  const handleRoleSwitch = (role) => {
    if (role === "staff") {
      logout();
      navigate("/login/admin", { replace: true });
    }
  };

  const handleLogout = () => {
    logout();
    navigate("/", { replace: true });
  };

  return (
    <div className="relative min-h-screen">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_12%_18%,rgba(30,64,175,0.11),transparent_36%),radial-gradient(circle_at_88%_2%,rgba(190,24,93,0.08),transparent_24%)]" />

      <header className="border-b border-border bg-card/80 backdrop-blur-sm">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-4 sm:px-6">
          <div>
            <p className="font-heading text-xs uppercase tracking-[0.24em] text-indigo-700 dark:text-indigo-400">PermitIQ</p>
            <h1 className="font-heading text-xl font-semibold text-foreground">Worker Portal</h1>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Theme:</span>
              <ThemeSelectorSelect />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Role:</span>
              <select
                className="rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-foreground shadow-sm transition hover:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                value="worker"
                onChange={(e) => handleRoleSwitch(e.target.value)}
              >
                <option value="worker">Worker</option>
                <option value="staff">Staff</option>
              </select>
            </div>
            <button
              onClick={handleLogout}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium text-muted-foreground shadow-sm transition hover:border-rose-200 hover:text-rose-700 dark:hover:border-rose-800 dark:hover:text-rose-400"
            >
              <LogOut className="h-3.5 w-3.5" />
              Sign out
            </button>
          </div>
        </div>

        <div className="mx-auto w-full max-w-5xl px-4 pb-3 sm:px-6">
          <nav className="flex gap-2">
            <button
              onClick={() => navigate("/worker/upload")}
              className={`rounded-lg border px-3 py-2 text-sm font-medium transition ${
                location.pathname.includes("upload")
                  ? "border-indigo-300 bg-indigo-50 text-indigo-900 dark:border-indigo-800 dark:bg-indigo-950 dark:text-indigo-100"
                  : "border-border bg-card text-foreground hover:border-indigo-300 hover:text-indigo-800 dark:hover:border-indigo-700 dark:hover:text-indigo-300"
              }`}
            >
              Upload Documents
            </button>
            <button
              onClick={() => navigate("/worker/status")}
              className={`rounded-lg border px-3 py-2 text-sm font-medium transition ${
                location.pathname.includes("status")
                  ? "border-indigo-300 bg-indigo-50 text-indigo-900 dark:border-indigo-800 dark:bg-indigo-950 dark:text-indigo-100"
                  : "border-border bg-card text-foreground hover:border-indigo-300 hover:text-indigo-800 dark:hover:border-indigo-700 dark:hover:text-indigo-300"
              }`}
            >
              My Status
            </button>
            <button
              onClick={() => navigate("/worker/contracts")}
              className={`rounded-lg border px-3 py-2 text-sm font-medium transition ${
                location.pathname.includes("contracts")
                  ? "border-indigo-300 bg-indigo-50 text-indigo-900 dark:border-indigo-800 dark:bg-indigo-950 dark:text-indigo-100"
                  : "border-border bg-card text-foreground hover:border-indigo-300 hover:text-indigo-800 dark:hover:border-indigo-700 dark:hover:text-indigo-300"
              }`}
            >
              My Contracts
            </button>
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 lg:py-8">
        <Outlet />
      </main>
    </div>
  );
}
