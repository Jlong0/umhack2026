import { cn } from "@/lib/utils";
import { createElement } from "react";

const TONE_STYLES = {
  blue: {
    icon: "bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400",
    value: "text-blue-600 dark:text-blue-400",
    ring: "ring-blue-500/20",
  },
  red: {
    icon: "bg-red-50 text-red-500 dark:bg-red-950 dark:text-red-400",
    value: "text-red-500 dark:text-red-400",
    ring: "ring-red-500/20",
  },
  amber: {
    icon: "bg-amber-50 text-amber-500 dark:bg-amber-950 dark:text-amber-400",
    value: "text-amber-500 dark:text-amber-400",
    ring: "ring-amber-500/20",
  },
  emerald: {
    icon: "bg-emerald-50 text-emerald-500 dark:bg-emerald-950 dark:text-emerald-400",
    value: "text-emerald-500 dark:text-emerald-400",
    ring: "ring-emerald-500/20",
  },
  slate: {
    icon: "bg-muted text-muted-foreground",
    value: "text-foreground",
    ring: "ring-border",
  },
};

/**
 * MetricCard — Unified KPI/stat card.
 *
 * @param {object}   props
 * @param {Function} props.icon  - Lucide icon component
 * @param {string}   props.label - Metric label
 * @param {string|number} props.value - Display value
 * @param {string}   [props.tone="slate"] - blue|red|amber|emerald|slate
 * @param {Function} [props.onClick] - Makes the card interactive
 * @param {string}   [props.className]
 */
function MetricCard({ icon: Icon, label, value, tone = "slate", onClick, className }) {
  const styles = TONE_STYLES[tone] || TONE_STYLES.slate;
  const isInteractive = Boolean(onClick);

  return (
    <article
      className={cn(
        "rounded-2xl border border-border bg-card p-5 transition-all duration-200",
        isInteractive &&
          "cursor-pointer hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2",
        className,
      )}
      onClick={onClick}
      tabIndex={isInteractive ? 0 : undefined}
      role={isInteractive ? "button" : undefined}
      onKeyDown={
        isInteractive
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") onClick();
            }
          : undefined
      }
    >
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <div className="mt-3 flex items-center gap-3">
        {Icon && (
          <div className={cn("rounded-lg p-2.5", styles.icon)}>
            {createElement(Icon, { className: "h-5 w-5" })}
          </div>
        )}
        <p className={cn("text-2xl font-semibold", styles.value)}>{value}</p>
      </div>
    </article>
  );
}

export { MetricCard, TONE_STYLES };
