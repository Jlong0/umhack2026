/**
 * DualSyncPage — PRD Screen C (Dual-Channel Sync View)
 *
 * Two-column comparative table for F&B sector workers:
 * Column 1: Federal status (MyEG/PLKS)
 * Column 2: Municipal status (Typhoid/Food Handler Certs)
 *
 * Includes "Export Audit Packet" button.
 */

import { useState } from "react";
import { useAllWorkflows } from "@/hooks/queries/useWorkflowQueries";
import { useAuditLogStore } from "@/store/useAuditLogStore";

function StatusChip({ status }) {
  const config = {
    verified: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    pending: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    expired: "bg-red-500/10 text-red-400 border-red-500/20",
  };

  const normalized = (status || "pending").toLowerCase();
  const style = config[normalized] || config.pending;
  const label = normalized.charAt(0).toUpperCase() + normalized.slice(1);

  return (
    <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold ${style}`}>
      {label}
    </span>
  );
}

export default function DualSyncPage() {
  const { data: workflows, isLoading } = useAllWorkflows();
  const appendEntry = useAuditLogStore((s) => s.appendEntry);
  const [exporting, setExporting] = useState(false);

  // Filter to F&B sector workers only
  const fbWorkers = (workflows?.workflows || workflows || []).filter(
    (w) => w.sector === "F&B" || w.sector === "FnB" || w.sector === "fnb"
  );

  const handleExport = () => {
    setExporting(true);
    const packet = {
      export_date: new Date().toISOString(),
      sector: "F&B",
      workers: fbWorkers.map((w) => ({
        worker_id: w.worker_id,
        name: `${w.first_name} ${w.last_name}`,
        federal: {
          plks_status: w.current_gate === "ACTIVE" ? "verified" : "pending",
          plks_expiry: w.deadlines?.plks_expiry,
          myeg_status: w.myeg_status || "pending",
        },
        municipal: {
          typhoid_status: w.deadlines?.typhoid_expiry
            ? new Date(w.deadlines.typhoid_expiry) > new Date() ? "verified" : "expired"
            : "pending",
          typhoid_expiry: w.deadlines?.typhoid_expiry,
          food_handler_cert: w.food_handler_cert || "pending",
        },
      })),
    };

    const blob = new Blob([JSON.stringify(packet, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit-packet-fnb-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);

    appendEntry({
      actor: "HUMAN",
      action: "AUDIT_PACKET_EXPORTED",
      details: `F&B audit packet exported with ${fbWorkers.length} workers`,
    });

    setTimeout(() => setExporting(false), 1000);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-100">Dual-Channel Sync View</h1>
          <p className="text-sm text-gray-500">
            Federal (Immigration) vs Municipal (Health) compliance for F&B workers
          </p>
        </div>
        <button
          onClick={handleExport}
          disabled={exporting || fbWorkers.length === 0}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-blue-500/20 transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {exporting ? "Exporting..." : "📦 Export Audit Packet"}
        </button>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-xl bg-white/[0.02]" />
          ))}
        </div>
      ) : fbWorkers.length === 0 ? (
        <div className="rounded-xl border border-white/5 bg-white/[0.02] p-12 text-center">
          <p className="text-sm text-gray-500">No F&B sector workers found</p>
          <p className="mt-1 text-xs text-gray-600">
            This view is exclusive to Food & Beverage sector workers
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-white/5">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/5 bg-white/[0.02]">
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Worker
                </th>
                <th colSpan={2} className="border-l border-white/5 px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-blue-400">
                  Federal (MyEG / PLKS)
                </th>
                <th colSpan={2} className="border-l border-white/5 px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-amber-400">
                  Municipal (Health)
                </th>
              </tr>
              <tr className="border-b border-white/5 bg-white/[0.01]">
                <th className="px-4 py-2 text-left text-[10px] text-gray-600">ID / Name</th>
                <th className="border-l border-white/5 px-4 py-2 text-left text-[10px] text-gray-600">PLKS Status</th>
                <th className="px-4 py-2 text-left text-[10px] text-gray-600">MyEG Status</th>
                <th className="border-l border-white/5 px-4 py-2 text-left text-[10px] text-gray-600">Typhoid Vaccine</th>
                <th className="px-4 py-2 text-left text-[10px] text-gray-600">Food Handler Cert</th>
              </tr>
            </thead>
            <tbody>
              {fbWorkers.map((worker) => {
                const typhoidExpiry = worker.deadlines?.typhoid_expiry;
                const typhoidStatus = typhoidExpiry
                  ? new Date(typhoidExpiry) > new Date() ? "verified" : "expired"
                  : "pending";

                return (
                  <tr key={worker.worker_id} className="border-b border-white/[0.03] transition-colors hover:bg-white/[0.02]">
                    <td className="px-4 py-3">
                      <div className="text-sm font-medium text-gray-200">
                        {worker.first_name} {worker.last_name}
                      </div>
                      <div className="font-mono text-[10px] text-gray-500">{worker.worker_id}</div>
                    </td>
                    <td className="border-l border-white/5 px-4 py-3">
                      <StatusChip status={worker.current_gate === "ACTIVE" ? "verified" : "pending"} />
                    </td>
                    <td className="px-4 py-3">
                      <StatusChip status={worker.myeg_status || "pending"} />
                    </td>
                    <td className="border-l border-white/5 px-4 py-3">
                      <StatusChip status={typhoidStatus} />
                    </td>
                    <td className="px-4 py-3">
                      <StatusChip status={worker.food_handler_cert || "pending"} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
