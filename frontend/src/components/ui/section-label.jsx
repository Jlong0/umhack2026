import { cn } from "@/lib/utils";

/**
 * SectionLabel — Labeled section divider for dashboard grouping.
 *
 * Creates a visual landmark so users can quickly scan page structure.
 *
 * @param {object}   props
 * @param {string}   props.title       - Section heading
 * @param {string}   [props.subtitle]  - Optional description
 * @param {React.ReactNode} [props.action] - Right-aligned action
 * @param {string}   [props.className]
 */
function SectionLabel({ title, subtitle, action, className }) {
  return (
    <div className={cn("flex items-end justify-between gap-4 border-b border-border pb-2", className)}>
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          {title}
        </h2>
        {subtitle && (
          <p className="mt-0.5 text-xs text-muted-foreground/70">{subtitle}</p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export { SectionLabel };
