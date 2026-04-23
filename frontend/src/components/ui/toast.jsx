/* eslint-disable react-refresh/only-export-components */
import { X } from "lucide-react";
import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";

const ToastContext = createContext(null);

function toastId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  return `toast-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timers = useRef(new Map());

  const dismiss = useCallback((id) => {
    const timer = timers.current.get(id);
    if (timer) {
      window.clearTimeout(timer);
      timers.current.delete(id);
    }

    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const toast = useCallback(
    ({ title, description, variant = "default", duration = 5000 }) => {
      const id = toastId();

      setToasts((current) => [...current, { id, title, description, variant }].slice(-4));

      const timer = window.setTimeout(() => dismiss(id), duration);
      timers.current.set(id, timer);
      return id;
    },
    [dismiss],
  );

  const contextValue = useMemo(
    () => ({
      toasts,
      toast,
      dismiss,
    }),
    [dismiss, toast, toasts],
  );

  return <ToastContext.Provider value={contextValue}>{children}</ToastContext.Provider>;
}

export function useToast() {
  const context = useContext(ToastContext);

  if (!context) {
    throw new Error("useToast must be used within ToastProvider.");
  }

  return context;
}

export function Toaster() {
  const { toasts, dismiss } = useToast();

  return (
    <div className="pointer-events-none fixed right-4 top-4 z-50 flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-3">
      {toasts.map((toast) => (
        <article
          key={toast.id}
          className={cn(
            "pointer-events-auto rounded-xl border bg-white/95 p-4 text-sm shadow-soft backdrop-blur-sm transition-transform duration-200",
            toast.variant === "destructive" && "border-rose-300 bg-rose-50 text-rose-900",
            toast.variant === "success" && "border-emerald-300 bg-emerald-50 text-emerald-900",
            toast.variant === "default" && "border-slate-200 text-slate-900",
          )}
          role="status"
          aria-live="polite"
        >
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              {toast.title ? <p className="font-semibold tracking-tight">{toast.title}</p> : null}
              {toast.description ? <p className="mt-1 text-xs leading-relaxed opacity-90">{toast.description}</p> : null}
            </div>
            <button
              type="button"
              className="rounded-md p-1 opacity-70 transition hover:opacity-100"
              onClick={() => dismiss(toast.id)}
              aria-label="Dismiss notification"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </article>
      ))}
    </div>
  );
}
