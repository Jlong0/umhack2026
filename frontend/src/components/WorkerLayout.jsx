import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { LogOut, Upload, ClipboardList, FileSignature, Sun, Moon } from "lucide-react";
import { useAuthStore } from "@/store/useAuthStore";
import { useThemeStore } from "@/store/useThemeStore";
import { cn } from "@/lib/utils";

const TABS = [
  { path: "/worker/upload", label: "Upload Documents", icon: Upload },
  { path: "/worker/status", label: "My Status", icon: ClipboardList },
  { path: "/worker/contracts", label: "My Contracts", icon: FileSignature },
];

export default function WorkerLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const logout = useAuthStore((state) => state.logout);
  const theme = useThemeStore((state) => state.theme);
  const setTheme = useThemeStore((state) => state.setTheme);

  const handleLogout = () => {
    logout();
    navigate("/", { replace: true });
  };

  return (
    <div className="relative min-h-screen bg-background">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_12%_18%,rgba(30,64,175,0.11),transparent_36%),radial-gradient(circle_at_88%_2%,rgba(190,24,93,0.08),transparent_24%)]" />

      <header className="border-b border-border bg-card/80 backdrop-blur-sm">
        {/* Top row: branding + actions */}
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-4">
          <div>
            <p className="font-heading text-xs uppercase tracking-[0.24em] text-indigo-700 dark:text-indigo-400">PermitIQ</p>
            <h1 className="font-heading text-xl font-semibold text-foreground">Worker Portal</h1>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
              className="rounded-lg border border-border p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
            <button
              onClick={handleLogout}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-medium text-muted-foreground transition hover:border-rose-200 hover:text-rose-700 dark:hover:border-rose-800 dark:hover:text-rose-400"
            >
              <LogOut className="h-3.5 w-3.5" />
              Sign out
            </button>
          </div>
        </div>

        {/* Navigation tabs — stronger visual treatment */}
        <div className="mx-auto w-full max-w-5xl px-6">
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
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl px-6 py-6 lg:py-8">
        <Outlet />
      </main>
    </div>
  );
}
