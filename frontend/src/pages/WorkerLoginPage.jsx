import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { KeyRound, Users } from "lucide-react";
import { useAuthStore } from "@/store/useAuthStore";
import { useWorkerStore } from "@/store/useWorkerStore";

export default function WorkerLoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const loginAsWorker = useAuthStore((state) => state.loginAsWorker);
  const isLoading = useAuthStore((state) => state.isLoading);
  const loginError = useAuthStore((state) => state.loginError);
  const clearError = useAuthStore((state) => state.clearError);
  const setWorkerId = useWorkerStore((state) => state.setWorkerId);

  const [workerId, setWorkerIdInput] = useState("");
  const [loginCode, setLoginCode] = useState("");

  const handleChange = (setter) => (e) => {
    setter(e.target.value);
    if (loginError) clearError();
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const id = workerId.trim();
    const code = loginCode.trim();
    if (!id || !code) return;

    const ok = await loginAsWorker(id, code);
    if (ok) {
      setWorkerId(id);
      const destination = location.state?.from?.pathname || "/worker/upload";
      navigate(destination, { replace: true });
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto flex min-h-screen max-w-4xl items-center justify-center px-6">
        <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900/60 p-8 shadow-xl">
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-600/20">
              <Users className="h-6 w-6 text-emerald-300" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-emerald-400">PermitIQ</p>
              <h1 className="text-xl font-semibold text-white">Worker Portal</h1>
            </div>
          </div>

          <p className="mb-5 text-xs text-slate-400">
            Enter the Worker ID and login code sent to you by your employer.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs font-medium uppercase tracking-wide text-slate-400">
                Worker ID
              </label>
              <input
                type="text"
                value={workerId}
                onChange={handleChange(setWorkerIdInput)}
                placeholder="e.g. worker-001"
                autoComplete="username"
                className="mt-2 w-full rounded-lg border border-slate-800 bg-slate-950/40 px-4 py-2.5 text-sm text-white placeholder-slate-600 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
              />
            </div>

            <div>
              <label className="text-xs font-medium uppercase tracking-wide text-slate-400">
                Login Code
              </label>
              <div className="relative mt-2">
                <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-600" />
                <input
                  type="text"
                  value={loginCode}
                  onChange={handleChange(setLoginCode)}
                  placeholder="e.g. ahmad0001"
                  autoComplete="current-password"
                  className="w-full rounded-lg border border-slate-800 bg-slate-950/40 py-2.5 pl-9 pr-4 text-sm text-white placeholder-slate-600 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                />
              </div>
            </div>

            {loginError && (
              <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
                {loginError}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading || !workerId.trim() || !loginCode.trim()}
              className="w-full rounded-lg bg-emerald-600 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isLoading ? "Verifying..." : "Sign in"}
            </button>
          </form>

          <div className="mt-6 text-center text-xs text-slate-400">
            <Link className="hover:text-emerald-300" to="/">
              Back to landing
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
