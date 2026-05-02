import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

/**
 * StepIndicator — Horizontal progress stepper for multi-step wizard flows.
 * Mobile: compact pill dots. Desktop: labeled numbered steps with connector lines.
 *
 * @param {{ label: string, icon?: Function, isComplete: boolean }[]} steps
 * @param {number} currentStep
 * @param {(index: number) => void} [onStepClick]
 */
function StepIndicator({ steps, currentStep, onStepClick }) {
  return (
    <nav aria-label="Progress steps" className="w-full">
      {/* ── Mobile: pill dots ── */}
      <div className="flex items-center justify-center gap-1.5 sm:hidden" role="list">
        {steps.map((step, idx) => (
          <button
            key={step.label}
            type="button"
            role="listitem"
            onClick={() => onStepClick?.(idx)}
            aria-label={`Step ${idx + 1}: ${step.label}${step.isComplete ? " (complete)" : ""}`}
            aria-current={idx === currentStep ? "step" : undefined}
            className={cn(
              "h-2 rounded-full transition-all duration-300",
              idx === currentStep
                ? "w-8 bg-indigo-600 dark:bg-indigo-400"
                : step.isComplete
                  ? "w-2 bg-emerald-500"
                  : "w-2 bg-border",
            )}
          />
        ))}
      </div>

      {/* ── Desktop: labeled steps ── */}
      <ol className="hidden sm:flex items-center w-full">
        {steps.map((step, idx) => {
          const isActive = idx === currentStep;
          const isComplete = step.isComplete;

          return (
            <li
              key={step.label}
              className={cn("flex items-center", idx < steps.length - 1 && "flex-1")}
            >
              <button
                type="button"
                onClick={() => onStepClick?.(idx)}
                className={cn(
                  "group flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium transition-all duration-200",
                  isActive && "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300",
                  isComplete && !isActive && "text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30",
                  !isActive && !isComplete && "text-muted-foreground hover:text-foreground hover:bg-muted",
                )}
              >
                <span
                  className={cn(
                    "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-all",
                    isActive && "bg-indigo-600 text-white shadow-sm",
                    isComplete && !isActive && "bg-emerald-500 text-white",
                    !isActive && !isComplete && "bg-muted text-muted-foreground group-hover:bg-border",
                  )}
                >
                  {isComplete ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : idx + 1}
                </span>
                <span className="hidden lg:inline whitespace-nowrap">{step.label}</span>
              </button>

              {idx < steps.length - 1 && (
                <div
                  className={cn(
                    "mx-1 h-px flex-1 transition-colors duration-300",
                    isComplete ? "bg-emerald-300 dark:bg-emerald-800" : "bg-border",
                  )}
                />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/**
 * WizardNavigation — Back / Next buttons for wizard footer.
 */
function WizardNavigation({ currentStep, totalSteps, onBack, onNext, nextLabel, nextDisabled }) {
  return (
    <div className="flex items-center justify-between gap-3 pt-6">
      {currentStep > 0 ? (
        <button
          type="button"
          onClick={onBack}
          className="rounded-xl border border-border px-5 py-3 text-sm font-semibold text-muted-foreground transition hover:bg-muted hover:text-foreground"
        >
          ← Back
        </button>
      ) : (
        <div />
      )}

      {currentStep < totalSteps - 1 && (
        <button
          type="button"
          onClick={onNext}
          disabled={nextDisabled}
          className="rounded-xl bg-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed dark:bg-indigo-500 dark:hover:bg-indigo-400"
        >
          {nextLabel || "Continue →"}
        </button>
      )}
    </div>
  );
}

export { StepIndicator, WizardNavigation };
