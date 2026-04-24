/**
 * StatutoryExposureCalculator — PRD Screen A Widget
 *
 * Real-time financial liability widget that updates dynamically.
 * Displays Section 55B fine exposure with breakdown.
 *
 * Design: Industrial Utilitarian — high-density data, stark contrast,
 * monospaced numbers for urgency.
 */

import { useCriticalAlerts, useExpiringPermits } from "@/hooks/queries/useAlertQueries";
import { AlertTriangle, TrendingDown } from "lucide-react";

function asCurrency(value) {
  return new Intl.NumberFormat("en-MY", {
    style: "currency",
    currency: "MYR",
    maximumFractionDigits: 0,
  }).format(value || 0);
}

export default function StatutoryExposureCalculator() {
  const { data: criticalAlerts, isLoading: loadingCritical } = useCriticalAlerts();
  const { data: expiringPermits, isLoading: loadingExpiring } = useExpiringPermits(30);

  const expiredCount = criticalAlerts?.alerts?.length || 0;
  const expiringCount = expiringPermits?.workers?.length || expiringPermits?.alerts?.length || 0;

  // Section 55B: RM10,000 minimum per expired permit
  const minExposure = expiredCount * 10000;
  // Maximum under Section 55B: RM50,000 or 12 months imprisonment
  const maxExposure = expiredCount * 50000;

  const isLoading = loadingCritical || loadingExpiring;

  if (isLoading) {
    return (
      <div className="permit-surface animate-pulse p-6">
        <div className="h-4 w-32 rounded bg-slate-200" />
        <div className="mt-4 h-10 w-48 rounded bg-slate-200" />
        <div className="mt-3 h-3 w-full rounded bg-slate-200" />
      </div>
    );
  }

  return (
    <div className={`permit-surface overflow-hidden ${
      expiredCount > 0 ? "border-red-200 bg-gradient-to-br from-white to-red-50" : ""
    }`}>
      {/* Risk Indicator Bar */}
      {expiredCount > 0 && (
        <div className="bg-red-600 px-4 py-1.5">
          <div className="flex items-center gap-2 text-xs font-bold text-white">
            <AlertTriangle className="h-3.5 w-3.5" />
            ACTIVE SECTION 55B EXPOSURE — {expiredCount} EXPIRED PERMIT{expiredCount !== 1 ? "S" : ""}
          </div>
        </div>
      )}

      <div className="p-5">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          Statutory Exposure Calculator
        </p>

        {/* Primary Number */}
        <div className="mt-3 flex items-baseline gap-2">
          <span className={`font-mono text-3xl font-black tracking-tight ${
            expiredCount > 0 ? "text-red-700" : "text-emerald-700"
          }`}>
            {expiredCount > 0 ? asCurrency(minExposure) : "RM 0"}
          </span>
          {expiredCount > 0 && (
            <span className="text-sm text-red-500">minimum</span>
          )}
        </div>

        {/* Range */}
        {expiredCount > 0 && (
          <p className="mt-1 font-mono text-sm text-red-400">
            Up to {asCurrency(maxExposure)} or 12 months imprisonment
          </p>
        )}

        {/* Breakdown */}
        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="rounded-lg bg-slate-50 p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Expired Permits</p>
            <p className={`mt-1 font-mono text-xl font-bold ${
              expiredCount > 0 ? "text-red-700" : "text-slate-700"
            }`}>{expiredCount}</p>
          </div>
          <div className="rounded-lg bg-slate-50 p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Expiring (30d)</p>
            <p className={`mt-1 font-mono text-xl font-bold ${
              expiringCount > 0 ? "text-amber-700" : "text-slate-700"
            }`}>{expiringCount}</p>
          </div>
        </div>

        {/* Status Line */}
        <div className="mt-4 flex items-center gap-2">
          {expiredCount === 0 ? (
            <>
              <div className="h-2 w-2 rounded-full bg-emerald-500" />
              <span className="text-xs font-medium text-emerald-700">All permits compliant</span>
            </>
          ) : (
            <>
              <TrendingDown className="h-3.5 w-3.5 text-red-500" />
              <span className="text-xs font-medium text-red-600">
                Immediate remediation required
              </span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
