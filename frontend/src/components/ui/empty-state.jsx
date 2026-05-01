import { cn } from "@/lib/utils";
import { createElement } from "react";
import { Inbox } from "lucide-react";

/**
 * EmptyState — Centered empty-data placeholder with optional CTA.
 *
 * @param {object}   props
 * @param {Function} [props.icon=Inbox] - Lucide icon component
 * @param {string}   props.title        - Primary message
 * @param {string}   [props.description] - Secondary text
 * @param {React.ReactNode} [props.action] - CTA button element
 * @param {string}   [props.className]
 */
function EmptyState({ icon: Icon = Inbox, title, description, action, className }) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-2xl border border-dashed border-border px-6 py-16 text-center",
        className,
      )}
    >
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
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
