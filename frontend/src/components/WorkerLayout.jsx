import { Outlet, useNavigate, useLocation } from "react-router-dom";

export default function WorkerLayout() {
  const navigate = useNavigate();
  const location = useLocation();

  const handleRoleSwitch = (role) => {
    if (role === "staff") navigate("/dashboard");
  };

  return (
    <div className="relative min-h-screen">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_12%_18%,rgba(30,64,175,0.11),transparent_36%),radial-gradient(circle_at_88%_2%,rgba(190,24,93,0.08),transparent_24%)]" />

      <header className="border-b border-slate-200/70 bg-white/80 backdrop-blur-sm">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-4 sm:px-6">
          <div>
            <p className="font-heading text-xs uppercase tracking-[0.24em] text-indigo-700">PermitIQ</p>
            <h1 className="font-heading text-xl font-semibold text-slate-950">Worker Portal</h1>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">Role:</span>
              <select
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                value="worker"
                onChange={(e) => handleRoleSwitch(e.target.value)}
              >
                <option value="worker">Worker</option>
                <option value="staff">Staff</option>
              </select>
            </div>
          </div>
        </div>

        <div className="mx-auto w-full max-w-5xl px-4 pb-3 sm:px-6">
          <nav className="flex gap-2">
            <button
              onClick={() => navigate("/worker/upload")}
              className={`rounded-lg border px-3 py-2 text-sm font-medium transition ${
                location.pathname.includes("upload")
                  ? "border-indigo-300 bg-indigo-50 text-indigo-900"
                  : "border-slate-200 bg-white text-slate-700 hover:border-indigo-200 hover:text-indigo-800"
              }`}
            >
              Document Upload
            </button>
            <button
              onClick={() => navigate("/worker/status")}
              className={`rounded-lg border px-3 py-2 text-sm font-medium transition ${
                location.pathname.includes("status")
                  ? "border-indigo-300 bg-indigo-50 text-indigo-900"
                  : "border-slate-200 bg-white text-slate-700 hover:border-indigo-200 hover:text-indigo-800"
              }`}
            >
              Application Status
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
