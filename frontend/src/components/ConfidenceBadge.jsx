/**
 * ConfidenceBadge — Atomic component (PRD §2 — Confidence Signals)
 *
 * Displays AI confidence score with color-coded badge:
 * - >= 85% → green (high confidence)
 * - 60-84% → amber (medium)
 * - < 60% → red with pulse (low — requires attention)
 */

import { CONFIDENCE } from "@/types/task";

export default function ConfidenceBadge({ score, reasoning, className = "" }) {
  const pct = Math.round((score || 0) * 100);

  let colorClasses, dotColor, label;
  if (score >= CONFIDENCE.HIGH) {
    colorClasses = "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
    dotColor = "bg-emerald-400";
    label = "High";
  } else if (score >= CONFIDENCE.MEDIUM) {
    colorClasses = "bg-amber-500/10 text-amber-400 border-amber-500/20";
    dotColor = "bg-amber-400";
    label = "Medium";
  } else {
    colorClasses = "bg-red-500/10 text-red-400 border-red-500/20";
    dotColor = "bg-red-400 animate-pulse";
    label = "Low";
  }

  return (
    <div className={`group relative inline-flex items-center ${className}`}>
      <span
        className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${colorClasses}`}
        aria-label={`Confidence score: ${pct} percent — ${label} confidence`}
      >
        <span className={`h-1.5 w-1.5 rounded-full ${dotColor}`} />
        {pct}%
      </span>

      {reasoning && (
        <div className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 w-64 -translate-x-1/2 rounded-lg border border-white/10 bg-gray-900 px-3 py-2 text-xs text-gray-300 opacity-0 shadow-xl transition-opacity duration-200 group-hover:pointer-events-auto group-hover:opacity-100">
          <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-gray-500">
            AI Reasoning
          </div>
          {reasoning}
          <div className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
        </div>
      )}
    </div>
  );
}
