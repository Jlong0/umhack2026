/**
 * MTLMTracker — PRD Screen A Widget
 *
 * Tracks company's Multi-Tier Levy Mechanism quota ratio
 * to forecast future tax bracket hikes.
 */

import { useMTLMTiers } from "@/hooks/queries/useSimulatorQueries";
import { useState } from "react";

const SECTORS = ["Manufacturing", "Construction", "Plantation", "Agriculture", "Services"];

export default function MTLMTracker() {
  const { data: tiersData, isLoading } = useMTLMTiers();
  const [selectedSector, setSelectedSector] = useState("Manufacturing");

  if (isLoading) {
    return (
      <div className="permit-surface animate-pulse p-6">
        <div className="h-4 w-32 rounded bg-muted" />
        <div className="mt-4 h-10 w-48 rounded bg-muted" />
      </div>
    );
  }

  const allTiers = tiersData?.tiers || {};
  const sectorTiers = allTiers[selectedSector] || {};
  const tierEntries = Object.entries(sectorTiers);
  const effectiveDate = tiersData?.effective_date || "2026";

  return (
    <div className="permit-surface p-5">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          MTLM Levy Structure
        </p>
        <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
          Effective {effectiveDate}
        </span>
      </div>

      {/* Sector Selector */}
      <div className="mt-3 flex flex-wrap gap-1.5">
        {SECTORS.map((sector) => (
          <button
            key={sector}
            onClick={() => setSelectedSector(sector)}
            className={`rounded-md px-2 py-1 text-[10px] font-semibold transition-colors ${
              selectedSector === sector
                ? "bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            {sector}
          </button>
        ))}
      </div>

      {/* Tier Breakdown */}
      <div className="mt-4 space-y-2">
        {tierEntries.length > 0 ? (
          tierEntries.map(([tierKey, tierData]) => {
            const label = tierKey.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
            return (
              <div
                key={tierKey}
                className="flex items-center justify-between rounded-lg bg-muted px-3 py-2.5"
              >
                <div>
                  <p className="text-xs font-semibold text-foreground">{label}</p>
                  <p className="text-[10px] text-muted-foreground">Ratio: {tierData.ratio}</p>
                </div>
                <span className="font-mono text-sm font-bold text-foreground">
                  RM {tierData.levy_rm?.toLocaleString() || "—"}
                </span>
              </div>
            );
          })
        ) : (
          <div className="rounded-lg bg-muted p-4 text-center text-xs text-muted-foreground">
            No tier data available for {selectedSector}
          </div>
        )}
      </div>

      {/* Footer note */}
      <p className="mt-3 text-[10px] text-muted-foreground">
        Levy per worker per year. Ratio = foreign workers ÷ total workforce.
      </p>
    </div>
  );
}
