/**
 * ComplianceBreachBanner — PRD Flow 3 (Edge Case Resolution)
 *
 * Full-width critical red alert that cannot be dismissed without action.
 * Triggered by Firebase stream events with COMPLIANCE_BREACH type.
 */

import { useUIStore } from "@/store/useUIStore";
import { useAuditLogStore } from "@/store/useAuditLogStore";

export default function ComplianceBreachBanner() {
  const alerts = useUIStore((s) => s.activeBreachAlerts);
  const dismissBreachAlert = useUIStore((s) => s.dismissBreachAlert);
  const openIntentPreview = useUIStore((s) => s.openIntentPreview);
  const appendEntry = useAuditLogStore((s) => s.appendEntry);

  if (alerts.length === 0) return null;

  const handleResolve = (alert) => {
    openIntentPreview({
      action: "Resolve Compliance Breach",
      worker_id: alert.worker_id,
      message: alert.message,
      computed_data: alert.computed_data,
    });
  };

  const handleAcknowledge = (alert) => {
    appendEntry({
      actor: "HUMAN",
      action: "BREACH_ACKNOWLEDGED",
      workerId: alert.worker_id,
      details: alert.message,
    });
    dismissBreachAlert(alert.worker_id);
  };

  return (
    <div className="space-y-2">
      {alerts.map((alert) => (
        <div
          key={alert.worker_id}
          className="animate-pulse-slow border-b border-red-500/20 bg-gradient-to-r from-red-950/80 via-red-900/40 to-red-950/80 px-6 py-3"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-red-500/20">
                <svg className="h-4 w-4 text-red-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                </svg>
              </div>
              <div>
                <h3 className="text-sm font-bold text-red-300">
                  🚨 Compliance Breach Detected
                </h3>
                <p className="text-xs text-red-400/80">{alert.message}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {alert.computed_data?.fine_amount_rm && (
                <div className="rounded-lg bg-red-500/10 px-3 py-1 text-right">
                  <div className="text-[10px] text-red-400/60">Fine Exposure</div>
                  <div className="text-sm font-bold text-red-400">
                    RM {alert.computed_data.fine_amount_rm.toLocaleString()}
                  </div>
                </div>
              )}

              <button
                onClick={() => handleResolve(alert)}
                className="rounded-lg bg-red-600 px-4 py-1.5 text-xs font-semibold text-white shadow-lg shadow-red-500/20 transition-colors hover:bg-red-500"
              >
                Resolve Now
              </button>
              <button
                onClick={() => handleAcknowledge(alert)}
                className="rounded-lg border border-red-500/20 px-3 py-1.5 text-xs text-red-400 transition-colors hover:bg-red-500/10"
              >
                Acknowledge
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
