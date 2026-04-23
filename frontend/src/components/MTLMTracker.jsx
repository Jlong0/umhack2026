/**
 * MTLMTracker — PRD Screen A Widget
 *
 * Tracks company's Multi-Tier Levy Mechanism quota ratio
 * to forecast future tax bracket hikes.
 */

import { useMTLMTiers } from "@/hooks/queries/useSimulatorQueries";

export default function MTLMTracker() {
  const { data: tiers, isLoading } = useMTLMTiers();

  if (isLoading) {
    return (
      <div className="permit-surface animate-pulse p-6">
        <div className="h-4 w-32 rounded bg-slate-200" />
        <div className="mt-4 h-10 w-48 rounded bg-slate-200" />
      </div>
    );
  }

  // Parse tier data from API
  const tierData = tiers?.tiers || tiers?.tier_structure || [];
  const currentRatio = tiers?.current_ratio || tiers?.quota_ratio || 0;
  const currentTier = tiers?.current_tier || "Standard";
  const nextThreshold = tiers?.next_threshold || 100;

  const ratioPercent = Math.min(Math.round(currentRatio * 100), 100);
  const distanceToNext = Math.max(0, nextThreshold - ratioPercent);

  // Color based on how close to next tier
  let barColor = "bg-emerald-500";
  let textColor = "text-emerald-700";
  if (ratioPercent > 80) {
    barColor = "bg-red-500";
    textColor = "text-red-700";
  } else if (ratioPercent > 60) {
    barColor = "bg-amber-500";
    textColor = "text-amber-700";
  }

  return (
    <div className="permit-surface p-5">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          MTLM Quota Tracker
        </p>
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
          ratioPercent > 80 ? "bg-red-100 text-red-700" :
          ratioPercent > 60 ? "bg-amber-100 text-amber-700" :
          "bg-emerald-100 text-emerald-700"
        }`}>
          Tier: {currentTier}
        </span>
      </div>

      {/* Ratio Display */}
      <div className="mt-3 flex items-baseline gap-2">
        <span className={`font-mono text-3xl font-black tracking-tight ${textColor}`}>
          {ratioPercent}%
        </span>
        <span className="text-sm text-slate-500">quota used</span>
      </div>

      {/* Progress Bar */}
      <div className="mt-3 h-3 overflow-hidden rounded-full bg-slate-100">
        <div
          className={`h-full rounded-full transition-all duration-700 ${barColor}`}
          style={{ width: `${ratioPercent}%` }}
        />
      </div>

      {/* Tier Markers */}
      <div className="mt-1 flex justify-between text-[10px] text-slate-400">
        <span>0%</span>
        <span>50%</span>
        <span>100%</span>
      </div>

      {/* Forecast */}
      <div className="mt-4 rounded-lg bg-slate-50 p-3">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
          Next Tier Threshold
        </p>
        <p className="mt-1 text-sm">
          {distanceToNext > 0 ? (
            <span className="text-slate-700">
              <strong className="font-mono">{distanceToNext}%</strong> capacity remaining before tier escalation
            </span>
          ) : (
            <span className="font-semibold text-red-600">
              ⚠ At maximum tier — levy rate at highest bracket
            </span>
          )}
        </p>
      </div>

      {/* Tier List */}
      {Array.isArray(tierData) && tierData.length > 0 && (
        <div className="mt-3 space-y-1">
          {tierData.slice(0, 4).map((tier, i) => (
            <div key={i} className="flex items-center justify-between text-xs">
              <span className="text-slate-500">{tier.name || `Tier ${i + 1}`}</span>
              <span className="font-mono text-slate-700">
                {tier.levy_rate ? `RM${tier.levy_rate}/worker` : tier.range || "—"}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
