import { cn } from "@/lib/utils";
import { CheckCircle2 } from "lucide-react";

/**
 * SuccessScreen — Full-section confirmation with animated checkmark.
 *
 * @param {string}          title
 * @param {string}          [description]
 * @param {React.ReactNode} [action]    - Optional CTA button
 * @param {string}          [className]
 */
function SuccessScreen({ title, description, action, className }) {
  return (
    <div className={cn("flex flex-col items-center justify-center px-6 py-16 text-center", className)}>
      <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400 animate-in zoom-in-50 duration-500">
        <CheckCircle2 className="h-10 w-10" />
      </div>

      <h2 className="font-heading text-2xl font-bold text-foreground">{title}</h2>

      {description && (
        <p className="mt-3 max-w-md text-base text-muted-foreground leading-relaxed">{description}</p>
      )}

      {action && <div className="mt-8">{action}</div>}
    </div>
  );
}

export { SuccessScreen };
