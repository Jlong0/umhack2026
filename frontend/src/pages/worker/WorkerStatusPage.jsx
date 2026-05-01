import { useQuery } from "@tanstack/react-query";
import { listWorkers } from "@/services/api";
import { useAuthStore } from "@/store/useAuthStore";

const STAGE_LABELS = {
  gate_1_jtksm:          "Gate 1 — JTKSM Approval",
  gate_2_kdn:            "Gate 2 — KDN Quota",
  gate_3_jim_vdr:        "Gate 3 — VDR Submission",
  arrival_verification:  "Arrival Verification",
  fomema_registration:   "FOMEMA Registration",
  fomema_screening:      "FOMEMA Screening",
  plks_issuance:         "PLKS Issuance",
  com_repatriation:      "COM / Repatriation",
};

function phaseStatus(data) {
  const vals = Object.values(data || {});
  if (!vals.length) return "not_started";
  if (vals.every((v) => v !== null && v !== undefined && v !== "")) return "complete";
  if (vals.some((v) => v !== null && v !== undefined && v !== "")) return "in_progress";
  return "not_started";
}

const STATUS_STYLE = {
  complete:    { dot: "bg-green-500",  text: "text-green-700",  label: "Complete" },
  in_progress: { dot: "bg-yellow-400", text: "text-yellow-700", label: "In Progress" },
  not_started: { dot: "bg-slate-300",  text: "text-muted-foreground",  label: "Not Started" },
  blocked:     { dot: "bg-red-500",    text: "text-red-700",    label: "Blocked" },
};

function PhaseRow({ phaseKey, data }) {
  const s = phaseStatus(data);
  const style = STATUS_STYLE[s] || STATUS_STYLE.not_started;
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-border last:border-0">
      <span className="text-sm text-foreground">{STAGE_LABELS[phaseKey] || phaseKey}</span>
      <span className={`flex items-center gap-1.5 text-xs font-medium ${style.text}`}>
        <span className={`h-2 w-2 rounded-full ${style.dot}`} />
        {style.label}
      </span>
    </div>
  );
}

export default function WorkerStatusPage() {
  const user = useAuthStore((s) => s.user);
  const workerId = user?.id;

  const { data, isLoading, error } = useQuery({
    queryKey: ["workersList"],
    queryFn: listWorkers,
    staleTime: 30_000,
    enabled: !!workerId,
  });

  const worker = data?.workers?.find((w) => w.worker_id === workerId);

  if (!workerId) {
    return (
      <div className="permit-surface px-5 py-12 text-center text-sm text-muted-foreground">
        No active worker session.
      </div>
    );
  }

  if (isLoading) {
    return <div className="permit-surface px-5 py-12 text-center text-sm text-muted-foreground">Loading status…</div>;
  }

  if (error || !worker) {
    return (
      <div className="permit-surface px-5 py-12 text-center text-sm text-red-500">
        Unable to load application status.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="permit-surface px-5 py-4 sm:px-6">
        <h2 className="text-xl font-semibold">Application Status</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {worker.full_name || "—"} · {worker.passport_number || "—"}
        </p>
      </section>

      <section className="permit-surface p-5 sm:p-6">
        <h3 className="text-sm font-semibold text-foreground mb-3">Stage 1 — VDR Application</h3>
        {Object.entries(worker.stage_1 || {}).map(([key, phase]) => (
          <PhaseRow key={key} phaseKey={key} data={phase.data} />
        ))}
      </section>

      <section className="permit-surface p-5 sm:p-6">
        <h3 className="text-sm font-semibold text-foreground mb-3">Stage 2 — PLKS Application</h3>
        {Object.entries(worker.stage_2 || {})
          .filter(([key]) => key !== "com_repatriation" || worker.stage_2?.arrival_verification?.data?.mdac_verified)
          .map(([key, phase]) => (
            <PhaseRow key={key} phaseKey={key} data={phase.data} />
          ))}
      </section>

      {worker.validation_errors?.length > 0 && (
        <section className="permit-surface p-5 sm:p-6 border-red-200 bg-red-50">
          <h3 className="text-sm font-semibold text-red-700 mb-2">Validation Issues</h3>
          {worker.validation_errors.map((e, i) => (
            <p key={i} className="text-xs text-red-600">• {e}</p>
          ))}
        </section>
      )}
    </div>
  );
}
