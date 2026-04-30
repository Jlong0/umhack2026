import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Building2, Shield } from "lucide-react";
import { useAuthStore } from "@/store/useAuthStore";

export default function AdminLoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const fetchCompanyList = useAuthStore((state) => state.fetchCompanyList);
  const companyList = useAuthStore((state) => state.companyList);
  const loginAsAdmin = useAuthStore((state) => state.loginAsAdmin);
  const isLoading = useAuthStore((state) => state.isLoading);
  const loginError = useAuthStore((state) => state.loginError);
  const clearError = useAuthStore((state) => state.clearError);

  const [selectedCompanyId, setSelectedCompanyId] = useState("");

  useEffect(() => {
    async function loadCompanies() {
      const companies = await fetchCompanyList();
      if (companies.length > 0) {
        setSelectedCompanyId(companies[0].id);
      }
    }

    loadCompanies();
  }, [fetchCompanyList]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!selectedCompanyId) return;

    const ok = await loginAsAdmin(selectedCompanyId);
    if (ok) {
      const destination = location.state?.from?.pathname || "/dashboard";
      navigate(destination, { replace: true });
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto flex min-h-screen max-w-4xl items-center justify-center px-6">
        <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900/60 p-8 shadow-xl">
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-600/20">
              <Shield className="h-6 w-6 text-indigo-300" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-indigo-400">PermitIQ</p>
              <h1 className="text-xl font-semibold text-white">Admin Portal</h1>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs font-medium uppercase tracking-wide text-slate-400">
                Company
              </label>
              <select
                value={selectedCompanyId}
                onChange={(e) => {
                  setSelectedCompanyId(e.target.value);
                  if (loginError) clearError();
                }}
                className="mt-2 w-full rounded-lg border border-slate-800 bg-slate-950/40 px-4 py-2.5 text-sm text-white focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
              >
                <option value="">Select a company</option>
                {companyList.map((company) => (
                  <option key={company.id} value={company.id}>
                    {company.company_name || company.name || company.id}
                  </option>
                ))}
              </select>
            </div>

            {loginError && (
              <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
                {loginError}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading || !selectedCompanyId}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Building2 className="h-4 w-4" />
              {isLoading ? "Opening portal..." : "Open admin portal"}
            </button>
          </form>

          <div className="mt-6 text-center text-xs text-slate-400">
            <Link className="hover:text-indigo-300" to="/">
              Back to landing
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
