/**
 * IntentPreviewModal — PRD §2 (Intent Preview & Autonomy Dial)
 *
 * CRITICAL COMPLIANCE COMPONENT
 * Forces explicit human approval for irreversible actions to prevent
 * Section 55B violations. Includes:
 * - Full form/document preview
 * - Financial impact display
 * - Mandatory checkbox confirmation
 * - 3-second countdown before Execute
 * - Dual confirmation for actions > RM5,000
 */

import { useState, useEffect, useCallback } from "react";
import { useUIStore } from "@/store/useUIStore";
import { useAuditLogStore } from "@/store/useAuditLogStore";

const COUNTDOWN_SECONDS = 3;
const HIGH_LIABILITY_THRESHOLD = 5000;

export default function IntentPreviewModal() {
  const isOpen = useUIStore((s) => s.isIntentPreviewOpen);
  const data = useUIStore((s) => s.intentPreviewData);
  const storeOnConfirm = useUIStore((s) => s.intentPreviewOnConfirm);
  const closeIntentPreview = useUIStore((s) => s.closeIntentPreview);
  const appendEntry = useAuditLogStore((s) => s.appendEntry);

  const [isChecked, setIsChecked] = useState(false);
  const [countdown, setCountdown] = useState(COUNTDOWN_SECONDS);
  const [isCountingDown, setIsCountingDown] = useState(false);
  const [dualConfirmed, setDualConfirmed] = useState(false);

  const fineAmount = data?.computed_data?.fine_amount_rm || 0;
  const isHighLiability = fineAmount > HIGH_LIABILITY_THRESHOLD;

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setIsChecked(false);
      setCountdown(COUNTDOWN_SECONDS);
      setIsCountingDown(false);
      setDualConfirmed(false);

      appendEntry({
        actor: "SYSTEM",
        action: "INTENT_PREVIEWED",
        workerId: data?.worker_id,
        details: `Intent preview opened: ${data?.action || "Unknown action"}`,
        metadata: data?.computed_data,
      });
    }
  }, [isOpen, data, appendEntry]);

  // Countdown timer
  useEffect(() => {
    if (!isCountingDown || countdown <= 0) return;
    const timer = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [isCountingDown, countdown]);

  // Start countdown when checkbox is checked
  useEffect(() => {
    if (isChecked) {
      setIsCountingDown(true);
    } else {
      setIsCountingDown(false);
      setCountdown(COUNTDOWN_SECONDS);
    }
  }, [isChecked]);

  const canExecute = isChecked && countdown <= 0 && (!isHighLiability || dualConfirmed);

  const handleExecute = useCallback(() => {
    if (!canExecute) return;

    appendEntry({
      actor: "HUMAN",
      action: "INTENT_CONFIRMED",
      workerId: data?.worker_id,
      details: `Confirmed irreversible action: ${data?.action}. Liability: RM${fineAmount}`,
      reversible: false,
      metadata: data?.computed_data,
    });

    onConfirm?.(data);
    storeOnConfirm?.(data);
    closeIntentPreview();
  }, [canExecute, data, fineAmount, storeOnConfirm, closeIntentPreview, appendEntry]);

  const handleCancel = useCallback(() => {
    appendEntry({
      actor: "HUMAN",
      action: "INTENT_CANCELLED",
      workerId: data?.worker_id,
      details: `Cancelled irreversible action: ${data?.action}`,
    });

    closeIntentPreview();
  }, [data, closeIntentPreview, appendEntry]);

  if (!isOpen || !data) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

      {/* Modal */}
      <div className="relative mx-4 w-full max-w-lg rounded-2xl border border-red-500/20 bg-card shadow-2xl shadow-red-500/10">
        {/* Header */}
        <div className="border-b border-red-500/20 bg-red-500/5 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-500/10">
              <svg className="h-5 w-5 text-red-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-bold text-red-300">
                ⚠️ Irreversible Action — Intent Preview
              </h2>
              <p className="text-xs text-red-400/70">
                Section 55B Immigration Act Compliance Check
              </p>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="space-y-4 px-6 py-5">
          {/* Action Description */}
          <div className="rounded-lg border border-border bg-muted p-4">
            <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Proposed Action
            </div>
            <p className="text-sm text-foreground">{data.action || "Unknown action"}</p>
            {data.message && (
              <p className="mt-2 text-xs text-muted-foreground">{data.message}</p>
            )}
          </div>

          {/* Financial Impact */}
          {fineAmount > 0 && (
            <div className={`rounded-lg border p-4 ${
              isHighLiability
                ? "border-red-500/30 bg-red-500/5"
                : "border-amber-500/30 bg-amber-500/5"
            }`}>
              <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Financial Impact
              </div>
              <div className={`text-2xl font-bold ${
                isHighLiability ? "text-red-400" : "text-amber-400"
              }`}>
                RM {fineAmount.toLocaleString()}
              </div>
              {data.computed_data?.liability_level && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Liability Level: {data.computed_data.liability_level}
                </p>
              )}
            </div>
          )}

          {/* Worker Info */}
          {data.worker_id && (
            <div className="text-xs text-muted-foreground">
              Worker: <span className="font-mono text-foreground">{data.worker_id}</span>
            </div>
          )}

          {/* Mandatory Checkbox */}
          <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-muted p-3 transition-colors hover:bg-muted/80">
            <input
              type="checkbox"
              checked={isChecked}
              onChange={(e) => setIsChecked(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-border bg-muted accent-red-500"
            />
            <span className="text-xs text-muted-foreground">
              I confirm this action is authorized under Section 55B of the Immigration Act
              and understand it <strong className="text-red-400">cannot be undone</strong>.
            </span>
          </label>

          {/* Dual Confirmation for High Liability */}
          {isHighLiability && isChecked && (
            <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-red-500/20 bg-red-500/5 p-3">
              <input
                type="checkbox"
                checked={dualConfirmed}
                onChange={(e) => setDualConfirmed(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-red-600 bg-muted accent-red-500"
              />
              <span className="text-xs text-red-300">
                <strong>HIGH LIABILITY (RM {fineAmount.toLocaleString()}+)</strong>: I have
                verified this action with authorized management.
              </span>
            </label>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-border px-6 py-4">
          <button
            onClick={handleCancel}
            className="rounded-lg border border-border px-4 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            Cancel
          </button>

          <button
            onClick={handleExecute}
            disabled={!canExecute}
            className={`rounded-lg px-6 py-2 text-sm font-semibold transition-all ${
              canExecute
                ? "bg-red-600 text-white shadow-lg shadow-red-500/20 hover:bg-red-500"
                : "cursor-not-allowed bg-muted text-muted-foreground"
            }`}
          >
            {!isChecked
              ? "Confirm above to proceed"
              : countdown > 0
                ? `Execute (${countdown}s)`
                : "Execute Action"}
          </button>
        </div>
      </div>
    </div>
  );
}
