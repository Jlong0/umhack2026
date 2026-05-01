/**
 * DualSyncPage — Sync check between internal Firestore records and mock gov records.
 * No live FWCMS connection — all external data is simulated.
 */

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle, FileX, RefreshCw, X } from "lucide-react";
import { getSyncCheck, resolveSyncConflict } from "@/services/api";
import { useAuditLogStore } from "@/store/useAuditLogStore";
import { PageHeader } from "@/components/ui/page-header";
import { MetricCard } from "@/components/ui/metric-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

function useSyncCheck() {
  return useQuery({ queryKey: ["sync-check"], queryFn: getSyncCheck, refetchInterval: 30000 });
}

function useResolveConflict() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ worker_id, field }) => resolveSyncConflict(worker_id, field),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sync-check"] }),
  });
}

const STATUS_VARIANT = {
  matched:   "success",
  conflict:  "warning",
  not_filed: "danger",
};

const STATUS_ICON = {
  matched:   <CheckCircle className="h-4 w-4" />,
  conflict:  <AlertTriangle className="h-4 w-4" />,
  not_filed: <FileX className="h-4 w-4" />,
};

const STATUS_LABEL = {
  matched:   "Matched",
  conflict:  "CONFLICT",
  not_filed: "Not Filed",
};

export default function DualSyncPage() {
  const { data, isLoading, refetch, isFetching } = useSyncCheck();
  const resolveMutation = useResolveConflict();
  const appendEntry = useAuditLogStore((s) => s.appendEntry);
  const [selected, setSelected] = useState(null);

  const records = data?.records || [];
  const matched   = records.filter(r => r.status === "matched").length;
  const conflicts = records.filter(r => r.status === "conflict").length;
  const notFiled  = records.filter(r => r.status === "not_filed").length;

  function handleExport() {
    const blob = new Blob([JSON.stringify({ records, exported_at: new Date().toISOString() }, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `sync-report-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    appendEntry({ actor: "HUMAN", action: "SYNC_REPORT_EXPORTED", details: `${records.length} records exported` });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="F&B Integration Layer"
        description={
          <span className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1 inline-block dark:bg-amber-950/40 dark:border-amber-800 dark:text-amber-300">
            Government portal data is simulated (mock). No live FWCMS connection.
          </span>
        }
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleExport}>
              Export Report
            </Button>
            <Button variant="outline" onClick={() => refetch()} disabled={isFetching}>
              <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
              Run Sync Check
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-4 gap-4">
        <MetricCard label="Total Workers" value={records.length} tone="slate" />
        <MetricCard label="Matched" value={matched} tone="emerald" />
        <MetricCard label="Conflicts" value={conflicts} tone="amber" />
        <MetricCard label="Not Filed" value={notFiled} tone="red" />
      </div>

      <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted border-b border-border">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Worker</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Internal (Parsed)</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">
                Mock Gov. Record <span className="text-muted-foreground cursor-help" title="Simulated. No live FWCMS.">?</span>
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {isLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <tr key={i}><td colSpan={4} className="px-4 py-3"><Skeleton className="h-8 w-full" /></td></tr>
              ))
            ) : records.map(r => {
              return (
                <tr key={r.worker_id}
                  onClick={() => r.conflicts?.length && setSelected(r)}
                  className={r.conflicts?.length ? "cursor-pointer hover:bg-muted" : ""}>
                  <td className="px-4 py-3 font-medium text-foreground">{r.worker_name}</td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">
                    {r.conflicts?.map(c => `${c.field}: ${c.internal}`).join(", ") || "—"}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">
                    {r.status === "not_filed" ? "— Not Found —" :
                      r.conflicts?.map(c => `${c.field}: ${c.mock_gov}`).join(", ") || "In sync"}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge
                      variant={STATUS_VARIANT[r.status] || "neutral"}
                      icon={STATUS_ICON[r.status]}
                    >
                      {STATUS_LABEL[r.status] || r.status}
                    </StatusBadge>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {selected && (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center" onClick={() => setSelected(null)}>
          <div className="bg-card rounded-xl shadow-xl w-full max-w-lg p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-foreground">CONFLICT — {selected.worker_name}</h2>
              <button onClick={() => setSelected(null)}><X className="h-4 w-4 text-muted-foreground" /></button>
            </div>
            <p className="text-xs text-amber-600 mb-4">Marking as Correct updates mock_gov_records in Firestore only. No real portal submission.</p>
            <table className="w-full text-sm mb-4">
              <thead><tr className="text-xs text-muted-foreground border-b">
                <th className="pb-2 text-left">Field</th>
                <th className="pb-2 text-left">Internal</th>
                <th className="pb-2 text-left">Mock Gov.</th>
                <th className="pb-2"></th>
              </tr></thead>
              <tbody className="divide-y divide-border">
                {selected.conflicts.map(c => (
                  <tr key={c.field}>
                    <td className="py-2 font-mono text-xs">{c.field}</td>
                    <td className="py-2">{String(c.internal)}</td>
                    <td className="py-2 text-red-600">{String(c.mock_gov)}</td>
                    <td className="py-2">
                      <button onClick={() => resolveMutation.mutate({ worker_id: selected.worker_id, field: c.field })}
                        disabled={resolveMutation.isPending}
                        className="text-xs text-indigo-600 hover:underline disabled:opacity-50">
                        Mark Correct
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button
              onClick={() => { selected.conflicts.forEach(c => resolveMutation.mutate({ worker_id: selected.worker_id, field: c.field })); setSelected(null); }}
              className="w-full rounded-lg bg-indigo-600 py-2 text-sm font-semibold text-white hover:bg-indigo-500">
              Mark All Internal as Correct
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
