import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Building2, Shield, Loader2 } from "lucide-react";
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
    <div className="relative min-h-screen bg-background text-foreground">
      {/* Background effects */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-32 -top-32 h-[420px] w-[420px] rounded-full bg-blue-600/15 blur-[100px] animate-pulse" />
        <div className="absolute -bottom-24 -right-24 h-[320px] w-[320px] rounded-full bg-slate-700/20 blur-[80px] animate-pulse [animation-delay:1.5s]" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(59,130,246,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(59,130,246,0.03)_1px,transparent_1px)] bg-[size:48px_48px]" />
      </div>

      <div className="relative z-10 mx-auto flex min-h-screen max-w-4xl items-center justify-center px-6">
        <div className="w-full max-w-md">
          {/* Card */}
          <div className="rounded-2xl border border-border bg-card p-8 shadow-2xl shadow-blue-950/10 dark:shadow-blue-950/20">
            {/* Header */}
            <div className="mb-8 flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600/10">
                <Shield className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-blue-600">PermitIQ</p>
                <h1 className="text-xl font-semibold text-foreground">Admin Portal</h1>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Company
                </label>
                <select
                  value={selectedCompanyId}
                  onChange={(e) => {
                    setSelectedCompanyId(e.target.value);
                    if (loginError) clearError();
                  }}
                  className="mt-2 w-full rounded-lg border border-border bg-muted px-4 py-2.5 text-sm text-foreground transition-colors duration-200 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
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
                <div className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-600 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300">
                  {loginError}
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading || !selectedCompanyId}
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 py-3 text-sm font-semibold text-white transition-colors duration-200 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Opening portal...
                  </>
                ) : (
                  <>
                    <Building2 className="h-4 w-4" />
                    Open admin portal
                  </>
                )}
              </button>
            </form>

            <div className="mt-6 text-center">
              <Link
                className="text-xs text-muted-foreground transition-colors duration-200 hover:text-blue-600"
                to="/"
              >
                ← Back to landing
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
