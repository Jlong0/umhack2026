import { cn } from "@/lib/utils";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "./button";

/**
 * ErrorState — Unified error display with optional retry CTA.
 *
 * Replaces the 5+ different error text/banner patterns scattered across pages.
 *
 * @param {object}   props
 * @param {string}   [props.title="Something went wrong"]
 * @param {string}   [props.message]        - User-friendly description
 * @param {Function} [props.onRetry]        - If provided, renders a "Try again" button
 * @param {boolean}  [props.retrying=false]  - Shows spinner on retry button
 * @param {boolean}  [props.compact=false]   - Smaller inline variant (for table rows, etc.)
 * @param {string}   [props.className]
 */
function ErrorState({
  title = "Something went wrong",
  message,
  onRetry,
  retrying = false,
  compact = false,
  className,
}) {
  if (compact) {
    return (
      <div
        className={cn(
          "flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300",
          className,
        )}
      >
        <AlertTriangle className="h-4 w-4 shrink-0" />
        <span className="flex-1">{message || title}</span>
        {onRetry && (
          <button
            onClick={onRetry}
            disabled={retrying}
            className="text-xs font-medium underline underline-offset-2 hover:no-underline disabled:opacity-50"
          >
            {retrying ? "Retrying…" : "Retry"}
          </button>
        )}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-2xl border border-dashed border-red-200 bg-red-50/50 px-6 py-16 text-center dark:border-red-900 dark:bg-red-950/20",
        className,
      )}
    >
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-red-600 dark:bg-red-950 dark:text-red-400">
        <AlertTriangle className="h-6 w-6" />
      </div>
      <p className="text-sm font-medium text-foreground">{title}</p>
      {message && (
        <p className="mt-1.5 max-w-sm text-xs text-muted-foreground">
          {message}
        </p>
      )}
      {onRetry && (
        <div className="mt-4">
          <Button
            variant="outline"
            size="sm"
            onClick={onRetry}
            disabled={retrying}
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${retrying ? "animate-spin" : ""}`}
            />
            {retrying ? "Retrying…" : "Try again"}
          </Button>
        </div>
      )}
    </div>
  );
}

export { ErrorState };
