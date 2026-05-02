/**
 * PipelinePage — PRD Screen B (Macro Gate Pipeline / Kanban Tracker)
 *
 * Horizontally scrolling Kanban board mapped to backend state machine:
 * JTKSM Gate → VDR Pending → Transit → FOMEMA → PLKS Endorse → Active
 *
 * Cards move autonomously (manual dragging disabled).
 * Blocked workers highlighted with red border + HITL resolution button.
 */

import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAllWorkflows, useJtksmDecision, useVdrDecision, useTransitComplete, useSimulateFomemaGovResult } from "@/hooks/queries/useWorkflowQueries";
import { useCriticalAlerts } from "@/hooks/queries/useAlertQueries";
import { useUIStore } from "@/store/useUIStore";
import { GATE_ORDER, GATE_LABELS, NATIONALITY_FLAGS } from "@/types/worker";
import ConfidenceBadge from "@/components/ConfidenceBadge";
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
  const openHITLDrawer = useUIStore((s) => s.openHITLDrawer);
  const jtksmMutation = useJtksmDecision();
  const isVdrPending = worker.current_gate === "VDR_PENDING";
  const vdrRequirements = worker.vdr_requirements || {};
  const vdrMutation = useVdrDecision();
  const transitMutation = useTransitComplete();
  const fomemaGovMutation = useSimulateFomemaGovResult();

  const vdrReady =
    isVdrPending &&
    Object.keys(vdrRequirements).length > 0 &&
    Object.values(vdrRequirements).every(Boolean);

  const isTransit = worker.current_gate === "TRANSIT";

  const isFomema = worker.current_gate === "FOMEMA";
  const fomemaRejected =
    worker.fomema_status === "unfit" ||
    worker.workflow_status === "fomema_rejected";

  const isPlksEndorse = worker.current_gate === "PLKS_ENDORSE";
  const isPlksPending =
    isPlksEndorse &&
    worker.fomema_status === "fit" &&
    worker.plks_status !== "approved" &&
    worker.workflow_status !== "active";

  const flag = NATIONALITY_FLAGS[worker.nationality] || "🏳️";
  const daysInGate = worker.days_in_gate || 0;

  const isJtksmPending =
    worker.current_gate === "JTKSM" &&
    worker.jtksm_status !== "approved" &&
    worker.jtksm_status !== "rejected";

  const stageStatus =
    worker.current_gate === "JTKSM"
      ? worker.jtksm_status || "pending"
      : worker.current_gate === "VDR_PENDING"
        ? worker.vdr_status || "pending"
        : worker.current_gate === "TRANSIT"
          ? worker.transit_status || "awaiting_arrival"
          : worker.current_gate === "FOMEMA"
            ? worker.fomema_status || "pending"
            : worker.current_gate === "PLKS_ENDORSE"
              ? worker.plks_status || "pending"
              : worker.workflow_status || "pending";

  return (
    <div
      className={`group rounded-xl border-t-2 bg-card/60 p-3 transition-all hover:bg-card ${
        isBlocked
          ? "border border-red-500/40 shadow-lg shadow-red-500/5 border-t-red-500"
          : "border border-border " + (GATE_COLORS[worker.current_gate] || "border-t-gray-500/60")
      }`}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg">{flag}</span>
          <div>
            <div className="text-sm font-semibold text-foreground">
              {worker.full_name || `${worker.first_name || ""} ${worker.last_name || ""}`}
            </div>
            <div className="font-mono text-[10px] text-muted-foreground">
              {worker.worker_id}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-2 flex items-center justify-between">
        <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
          {worker.sector || "—"}
        </span>

        <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700">
          {stageStatus}
        </span>
      </div>

      {isJtksmPending && (
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button
            disabled={jtksmMutation.isPending}
            onClick={() =>
              jtksmMutation.mutate({
                workerId: worker.worker_id,
                decision: "approve",
              })
            }
            className="rounded-lg bg-emerald-600 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
          >
            Approve
          </button>

          <button
            disabled={jtksmMutation.isPending}
            onClick={() =>
              jtksmMutation.mutate({
                workerId: worker.worker_id,
                decision: "reject",
              })
            }
            className="rounded-lg bg-rose-600 py-1.5 text-xs font-semibold text-white hover:bg-rose-500 disabled:opacity-50"
          >
            Reject
          </button>
        </div>
      )}

      {isVdrPending && Object.keys(vdrRequirements).length > 0 && (
        <div className="mt-3 space-y-1 rounded-lg bg-muted/50 p-2">
          {Object.entries(vdrRequirements).map(([key, done]) => (
            <div key={key} className="flex items-center justify-between text-[11px]">
              <span className="text-muted-foreground capitalize">
                {key.replaceAll("_", " ")}
              </span>

              <span className={done ? "text-emerald-600" : "text-amber-600"}>
                {done ? "Done" : "Pending"}
              </span>
            </div>
          ))}
        </div>
      )}

      {isVdrPending && vdrReady && (
        <button
          type="button"
          disabled={vdrMutation.isPending}
          onClick={() =>
            vdrMutation.mutate(
              {
                workerId: worker.worker_id,
                decision: "approve",
              },
              {
                onSuccess: () => {
                  navigate(`/gov-portal?workerId=${worker.worker_id}&mode=vdr`);
                },
              }
            )
          }
          className="mt-3 w-full rounded-lg bg-blue-600 py-1.5 text-xs font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
        >
          {vdrMutation.isPending ? "Approving..." : "Approve VDR"}
        </button>
      )}

      {isVdrPending && !vdrReady && (
        <p className="mt-2 rounded-lg bg-amber-50 px-2 py-1.5 text-[11px] text-amber-700">
          VDR cannot be approved yet. Complete all requirements first.
        </p>
      )}

      {isTransit && (
        <div className="mt-3 rounded-lg bg-cyan-50 p-2 text-[11px] text-cyan-800">
          <p className="font-semibold">Awaiting worker transit to Malaysia</p>
          <p className="mt-1">
            Click below for arrival confirmation
          </p>

          <button
            type="button"
            disabled={transitMutation.isPending}
            onClick={() => transitMutation.mutate(worker.worker_id)}
            className="mt-2 w-full rounded-lg bg-cyan-600 py-1.5 text-xs font-semibold text-white hover:bg-cyan-500 disabled:opacity-50"
          >
            {transitMutation.isPending ? "Updating..." : "Transit Complete"}
          </button>
        </div>
      )}

      {isFomema && !fomemaRejected && (
        <div className="mt-3 rounded-lg bg-amber-50 p-2 text-[11px] text-amber-800">
          <p className="font-semibold">Waiting for FOMEMA government result</p>
          <p className="mt-1">
            Ping the government
          </p>
          <button
            type="button"
            disabled={fomemaGovMutation.isPending}
            onClick={() =>
              fomemaGovMutation.mutate({
                workerId: worker.worker_id,
                result: "fit",
                notes: "Mock FOMEMA result returned as FIT.",
              })
            }
            className="mt-2 w-full rounded-lg bg-emerald-600 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
          >
            Sync
          </button>
        </div>
      )}

      {isFomema && fomemaRejected && (
        <div className="mt-3 rounded-lg bg-rose-50 p-2 text-[11px] text-rose-700">
          <p className="font-semibold">FOMEMA result: Unfit</p>
          <p className="mt-1">
            Result was returned by mock government source. Workflow stopped.
          </p>
        </div>
      )}

      {isPlksPending && (
        <div className="mt-3 rounded-lg bg-orange-50 p-2 text-[11px] text-orange-800">
          <p className="font-semibold">PLKS endorsement pending</p>
          <p className="mt-1">
            Submit the PLKS application through the simulated government portal.
          </p>

          <button
            type="button"
            onClick={() =>
              navigate(`/gov-portal?workerId=${worker.worker_id}&mode=plks`)
            }
            className="mt-2 w-full rounded-lg bg-orange-600 py-1.5 text-xs font-semibold text-white hover:bg-orange-500"
          >
            Apply PLKS
          </button>
        </div>
      )}

      {/*{isBlocked && (*/}
      {/*  <button*/}
      {/*    onClick={() => openHITLDrawer(worker.worker_id, null)}*/}
      {/*    className="mt-2 w-full rounded-lg bg-red-600/80 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-red-500"*/}
      {/*  >*/}
      {/*    Resolve — HITL Required*/}
      {/*  </button>*/}
      {/*)}*/}
    </div>
  );
}

function GateColumn({ gate, workers, blockedIds }) {
  const count = workers.length;
  const blockedCount = workers.filter((w) => blockedIds.has(w.worker_id)).length;

  return (
    <div className="flex w-72 flex-shrink-0 flex-col rounded-xl border border-border bg-card/40">
      {/* Column Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground">
            {GATE_LABELS[gate] || gate}
          </h3>
          <p className="text-[10px] text-muted-foreground">
            {count} worker{count !== 1 ? "s" : ""}
            {blockedCount > 0 && (
              <span className="ml-1 text-red-400">
                ({blockedCount} blocked)
              </span>
            )}
          </p>
        </div>
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-xs font-bold text-muted-foreground">
          {count}
        </span>
      </div>

      {/* Cards */}
      <div className="flex flex-1 flex-col gap-2 overflow-y-auto p-3">
        {workers.length === 0 ? (
          <div className="flex h-20 items-center justify-center rounded-lg border border-dashed border-border text-xs text-muted-foreground">
            No workers
          </div>
        ) : (
          workers.map((worker) => (
            <WorkerCard
              key={worker.worker_id}
              worker={worker}
              isBlocked={blockedIds.has(worker.worker_id)}
            />
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

    const blocked = new Set();
    if (criticalAlerts?.alerts) {
      criticalAlerts.alerts.forEach((a) => {
        if (a.worker_id) blocked.add(a.worker_id);
      });
    }

    const workers = workflows?.workflows || workflows || [];
    if (Array.isArray(workers)) {
      workers.forEach((w) => {
        const gate = w.current_gate || w.current_state || "JTKSM";
        const normalizedGate = gate.toUpperCase().replace(/\s+/g, "_");
        if (map[normalizedGate]) {
          map[normalizedGate].push(w);
        } else {
          map.JTKSM.push(w);
        }

        if (w.status === "BLOCKED_HITL" || w.requires_hitl) {
          blocked.add(w.worker_id);
        }
      });
    }

    return { gateMap: map, blockedIds: blocked };
  }, [workflows, criticalAlerts]);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        title="Permit Stages Board"
        description="Real-time permit stage tracker — cards move autonomously as AI verifies each step"
      />

      {/* Kanban Board */}
      {isLoading ? (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {GATE_ORDER.map((gate) => (
            <div
              key={gate}
              className="h-96 w-72 flex-shrink-0 animate-pulse rounded-xl border border-border bg-muted/50"
            />
          ))}
        </div>
      ) : error ? (
        <ErrorState
          title="Failed to load pipeline data"
          message={error.message}
        />
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {GATE_ORDER.map((gate) => (
            <GateColumn
              key={gate}
              gate={gate}
              workers={gateMap[gate] || []}
              blockedIds={blockedIds}
            />
          ))}
        </div>
      )}
    </div>
  );
}
