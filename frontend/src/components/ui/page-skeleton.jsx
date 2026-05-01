import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/**
 * PageSkeleton — Full-page loading skeleton matching common page structures.
 *
 * @param {object} props
 * @param {"dashboard"|"table"|"detail"} [props.variant="dashboard"]
 * @param {string} [props.className]
 */
function PageSkeleton({ variant = "dashboard", className }) {
  if (variant === "table") {
    return (
      <div className={cn("space-y-6", className)}>
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-10 w-72" />
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (variant === "detail") {
    return (
      <div className={cn("space-y-6", className)}>
        <Skeleton className="h-20 w-full" />
        <div className="grid gap-6 lg:grid-cols-2">
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  // dashboard variant
  return (
    <div className={cn("space-y-6", className)}>
      <Skeleton className="h-20 w-full" />
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-28 w-full" />
        ))}
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    </div>
  );
}

export { PageSkeleton };
