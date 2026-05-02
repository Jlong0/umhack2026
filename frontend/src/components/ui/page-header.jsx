import { cn } from "@/lib/utils";

/**
 * PageHeader — Consistent page title area for admin pages.
 *
 * @param {object}   props
 * @param {string}   props.title       - Page title (h1)
 * @param {string}   [props.description] - Subtitle text
 * @param {React.ReactNode} [props.actions] - Right-aligned action buttons
 * @param {React.ReactNode} [props.children] - Optional extra content below title
 * @param {string}   [props.className]
 */
function PageHeader({ title, description, actions, children, className }) {
  return (
    <section className={cn("rounded-2xl border border-border bg-card px-6 py-5", className)}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-foreground">{title}</h1>
          {description && (
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          )}
        </div>
        {actions && <div className="flex items-center gap-2 flex-shrink-0">{actions}</div>}
      </div>
      {children}
    </section>
  );
}

export { PageHeader };
