import { cn } from "@/lib/utils";

const STATUS_STYLES = {
  success: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300",
  warning: "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300",
  danger: "bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300",
  info: "bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300",
  neutral: "bg-muted text-muted-foreground",
  indigo: "bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300",
  orange: "bg-orange-100 text-orange-800 dark:bg-orange-950/60 dark:text-orange-300",
};

/**
 * StatusBadge — Unified status pill used across all admin pages.
 *
 * @param {object}   props
 * @param {"success"|"warning"|"danger"|"info"|"neutral"|"indigo"|"orange"} [props.variant="neutral"]
 * @param {string}   props.children - Label text
 * @param {React.ReactNode} [props.icon] - Optional leading icon
 * @param {string}   [props.className]
 */
function StatusBadge({ variant = "neutral", children, icon, className }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold",
        STATUS_STYLES[variant] || STATUS_STYLES.neutral,
        className,
      )}
    >
      {icon}
      {children}
    </span>
  );
}

export { StatusBadge, STATUS_STYLES };
