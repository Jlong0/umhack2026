import { cn } from "@/lib/utils";
import { createElement } from "react";
import { Inbox, CheckCircle } from "lucide-react";

const TONE_STYLES = {
  neutral: {
    icon: "bg-muted text-muted-foreground",
    border: "border-border",
  },
  success: {
    icon: "bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400",
    border: "border-emerald-200 dark:border-emerald-800",
  },
};

const TONE_ICON = {
  neutral: Inbox,
  success: CheckCircle,
};

/**
 * EmptyState — Centered empty-data placeholder with optional CTA.
 *
 * Supports two tones:
 *  - "neutral" (default): No data available / nothing to show yet
 *  - "success": All clear! No issues found / no pending items
 *
 * @param {object}   props
 * @param {Function} [props.icon]         - Lucide icon component (auto-selected by tone if omitted)
 * @param {string}   props.title          - Primary message
 * @param {string}   [props.description]  - Secondary text
 * @param {React.ReactNode} [props.action] - CTA button element
 * @param {"neutral"|"success"} [props.tone="neutral"]
 * @param {string}   [props.className]
 */
function EmptyState({ icon, title, description, action, tone = "neutral", className }) {
  const styles = TONE_STYLES[tone] || TONE_STYLES.neutral;
  const Icon = icon || TONE_ICON[tone] || Inbox;

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-2xl border border-dashed px-6 py-16 text-center",
        styles.border,
        className,
      )}
    >
      <div className={cn("mb-4 flex h-12 w-12 items-center justify-center rounded-full", styles.icon)}>
        {createElement(Icon, { className: "h-6 w-6" })}
      </div>
      <p className="text-sm font-medium text-foreground">{title}</p>
      {description && (
        <p className="mt-1.5 max-w-sm text-xs text-muted-foreground">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export { EmptyState };
