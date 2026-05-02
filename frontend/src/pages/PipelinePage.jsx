import { useAllWorkflows, useJtksmDecision } from "@/hooks/queries/useWorkflowQueries";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useCriticalAlerts } from "@/hooks/queries/useAlertQueries";
import { useUIStore } from "@/store/useUIStore";
import { GATE_ORDER, GATE_LABELS, NATIONALITY_FLAGS } from "@/types/worker";
import { issuePermit } from "@/services/api";
import { PageHeader } from "@/components/ui/page-header";
import { ErrorState } from "@/components/ui/error-state";

const GATE_COLORS = {
  JTKSM: "border-t-violet-500/60",
  VDR_PENDING: "border-t-blue-500/60",
  TRANSIT: "border-t-cyan-500/60",
  FOMEMA: "border-t-amber-500/60",
  PLKS_ENDORSE: "border-t-orange-500/60",
  ACTIVE: "border-t-emerald-500/60",
};

function WorkerCard({ worker, isBlocked }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const openHITLDrawer = useUIStore((s) => s.openHITLDrawer);
  const jtksmMutation = useJtksmDecision();
  const [issuing, setIssuing] = useState(false);

  const isVdrPending = worker.current_gate === "VDR_PENDING";
  const flag = NATIONALITY_FLAGS[worker.nationality] || "🏳️";
  const isJtksmPending =
    worker.current_gate === "JTKSM" &&
    worker.jtksm_status !== "approved" &&
    worker.jtksm_status !== "rejected";

  const handleIssuePermit = async (e) => {
    e.stopPropagation();
    setIssuing(true);
    try {
      await issuePermit(worker.worker_id);
      queryClient.invalidateQueries({ queryKey: ["workflows"] });
    } catch {}
    finally { setIssuing(false); }
  };

  return (
    <div
      className={`group cursor-pointer rounded-xl border-t-2 bg-card/60 p-3 transition-all hover:bg-card ${
        isBlocked
          ? "border border-red-500/40 shadow-lg shadow-red-500/5 border-t-red-500"
          : "border border-border " + (GATE_COLORS[worker.current_gate] || "border-t-gray-500/60")
      }`}
      onClick={() => navigate(`/orchestration/${worker.worker_id}`)}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg">{flag}</span>
          <div>
            <div className="text-sm font-semibold text-foreground">
              {worker.full_name || `${worker.first_name || ""} ${worker.last_name || ""}`}
            </div>
            <div className="font-mono text-[10px] text-muted-foreground">{worker.worker_id}</div>
          </div>
        </div>
      </div>

      <div className="mt-2 flex items-center justify-between">
        <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
          {worker.sector || "—"}
        </span>
        <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700">
          {worker.jtksm_status || "pending"}
        </span>
      </div>

      {isJtksmPending && (
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button
            disabled={jtksmMutation.isPending}
            onClick={(e) => { e.stopPropagation(); jtksmMutation.mutate({ workerId: worker.worker_id, decision: "approve" }); }}
            className="rounded-lg bg-emerald-600 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
          >
            Approve
          </button>
          <button
            disabled={jtksmMutation.isPending}
            onClick={(e) => { e.stopPropagation(); jtksmMutation.mutate({ workerId: worker.worker_id, decision: "reject" }); }}
            className="rounded-lg bg-rose-600 py-1.5 text-xs font-semibold text-white hover:bg-rose-500 disabled:opacity-50"
          >
            Reject
          </button>
        </div>
      )}

      {isVdrPending && worker.vdr_requirements && (
        <div className="mt-3 space-y-1 rounded-lg bg-muted/50 p-2">
          {Object.entries(worker.vdr_requirements).map(([key, done]) => (
            <div key={key} className="flex items-center justify-between text-[11px]">
              <span className="text-muted-foreground">{key.replaceAll("_", " ")}</span>
              <span className={done ? "text-emerald-600" : "text-amber-600"}>{done ? "Done" : "Pending"}</span>
            </div>
          ))}
        </div>
      )}

      {isBlocked && (
        <button
          onClick={(e) => { e.stopPropagation(); openHITLDrawer(worker.worker_id, null); }}
          className="mt-2 w-full rounded-lg bg-red-600/80 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-red-500"
        >
          Resolve — HITL Required
        </button>
      )}

      {worker.current_gate === "PLKS_ENDORSE" && !isBlocked && (
        <button
          onClick={handleIssuePermit}
          disabled={issuing}
          className="mt-2 w-full rounded-lg bg-emerald-600/80 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-emerald-500 disabled:opacity-50"
        >
          {issuing ? "Issuing..." : "🎫 Issue Permit → Active"}
        </button>
      )}
    </div>
  );
}

function GateColumn({ gate, workers, blockedIds }) {
  const count = workers.length;
  const blockedCount = workers.filter((w) => blockedIds.has(w.worker_id)).length;

  return (
    <div className="flex w-72 flex-shrink-0 flex-col rounded-xl border border-border bg-card/40">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground">{GATE_LABELS[gate] || gate}</h3>
          <p className="text-[10px] text-muted-foreground">
            {count} worker{count !== 1 ? "s" : ""}
            {blockedCount > 0 && <span className="ml-1 text-red-400">({blockedCount} blocked)</span>}
          </p>
        </div>
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-xs font-bold text-muted-foreground">
          {count}
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-2 overflow-y-auto p-3">
        {workers.length === 0 ? (
          <div className="flex h-20 items-center justify-center rounded-lg border border-dashed border-border text-xs text-muted-foreground">
            No workers
          </div>
        ) : (
          workers.map((worker) => (
            <WorkerCard key={worker.worker_id} worker={worker} isBlocked={blockedIds.has(worker.worker_id)} />
          ))
        )}
      </div>
    </div>
  );
}

export default function PipelinePage() {
  const { data: workflows, isLoading, error } = useAllWorkflows();
  const { data: criticalAlerts } = useCriticalAlerts();

  const { gateMap, blockedIds } = useMemo(() => {
    const map = {};
    GATE_ORDER.forEach((gate) => (map[gate] = []));

    const normalizeGate = (raw) => {
      if (!raw) return "JTKSM";
      const upper = raw.toUpperCase().replace(/\s+/g, "_");
      if (upper.includes("JTKSM") || upper === "GATE_1_JTKSM") return "JTKSM";
      if (upper.includes("VDR")) return "VDR_PENDING";
      if (upper.includes("TRANSIT")) return "TRANSIT";
      if (upper.includes("FOMEMA")) return "FOMEMA";
      if (upper.includes("PLKS")) return "PLKS_ENDORSE";
      if (upper.includes("ACTIVE")) return "ACTIVE";
      return map[upper] ? upper : "JTKSM";
    };

    const blocked = new Set();
    if (criticalAlerts?.alerts) {
      criticalAlerts.alerts.forEach((a) => { if (a.worker_id) blocked.add(a.worker_id); });
    }

    const workers = workflows?.workflows || workflows || [];
    if (Array.isArray(workers)) {
      workers.forEach((w) => {
        const gate = normalizeGate(w.current_gate || w.current_state);
        map[gate].push({ ...w, current_gate: gate });
        if (w.status === "BLOCKED_HITL" || w.requires_hitl || w.hitl_required) blocked.add(w.worker_id);
      });
    }

    return { gateMap: map, blockedIds: blocked };
  }, [workflows, criticalAlerts]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Permit Stages Board"
        description="Real-time permit stage tracker — cards move autonomously as AI verifies each step"
      />

      {isLoading ? (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {GATE_ORDER.map((gate) => (
            <div key={gate} className="h-96 w-72 flex-shrink-0 animate-pulse rounded-xl border border-border bg-muted/50" />
          ))}
        </div>
      ) : error ? (
        <ErrorState title="Failed to load pipeline data" message={error.message} />
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {GATE_ORDER.map((gate) => (
            <GateColumn key={gate} gate={gate} workers={gateMap[gate] || []} blockedIds={blockedIds} />
          ))}
        </div>
      )}
    </div>
  );
}
