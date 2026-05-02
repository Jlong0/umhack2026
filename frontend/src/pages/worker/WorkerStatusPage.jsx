import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, Circle, Loader2, Lock, AlertTriangle, Info } from "lucide-react";
import { listWorkers } from "@/services/api";
import { useAuthStore } from "@/store/useAuthStore";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { ErrorState } from "@/components/ui/error-state";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";

// ── Plain-language labels + descriptions for workers ──
const STAGE_INFO = {
  gate_1_jtksm:         { label: "Agency Verification",     description: "Your employer's labour agency is being verified by JTKSM." },
  gate_2_kdn:           { label: "Quota Approval",          description: "The government is reviewing your employer's foreign worker quota." },
  gate_3_jim_vdr:       { label: "Visa Application",        description: "Your calling visa is being submitted to immigration." },
  arrival_verification: { label: "Arrival Check-In",        description: "Your arrival in Malaysia needs to be verified and registered." },
  fomema_registration:  { label: "Medical Registration",    description: "You need to register for your mandatory health screening." },
  fomema_screening:     { label: "Medical Screening",       description: "Your FOMEMA medical examination needs to be completed." },
  plks_issuance:        { label: "Work Permit Issued",      description: "Your PLKS work permit card will be issued once everything is approved." },
  com_repatriation:     { label: "Registration Complete",   description: "Final registration and repatriation bond processing." },
};

function phaseStatus(data) {
  const vals = Object.values(data || {});
  if (!vals.length) return "not_started";
  if (vals.every((v) => v !== null && v !== undefined && v !== "")) return "complete";
  if (vals.some((v) => v !== null && v !== undefined && v !== "")) return "in_progress";
  return "not_started";
}

const STATUS_CONFIG = {
  complete:    { icon: CheckCircle2, color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-100 dark:bg-emerald-950/60", line: "bg-emerald-400 dark:bg-emerald-600", label: "Complete", badge: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800" },
  in_progress: { icon: Loader2,     color: "text-indigo-600 dark:text-indigo-400",   bg: "bg-indigo-100 dark:bg-indigo-950/60",   line: "bg-border",                         label: "In Progress", badge: "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800" },
  not_started: { icon: Circle,      color: "text-muted-foreground",                   bg: "bg-muted",                               line: "bg-border",                         label: "Pending", badge: "bg-muted text-muted-foreground border-border" },
  blocked:     { icon: Lock,        color: "text-rose-600 dark:text-rose-400",        bg: "bg-rose-100 dark:bg-rose-950/60",        line: "bg-border",                         label: "Needs Action", badge: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800" },
};

function TimelineNode({ phaseKey, data, isLast }) {
  const status = phaseStatus(data);
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.not_started;
  const info = STAGE_INFO[phaseKey] || { label: phaseKey, description: "" };
  const Icon = config.icon;
  const isActive = status === "in_progress";

  return (
    <div className="flex gap-4">
      {/* Timeline track */}
      <div className="flex flex-col items-center">
        <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-all", config.bg, isActive && "ring-4 ring-indigo-200 dark:ring-indigo-900")}>
          <Icon className={cn("h-4 w-4", config.color, isActive && "animate-spin")} />
        </div>
        {!isLast && (
          <div className={cn("mt-1 w-0.5 flex-1 min-h-[24px] rounded-full transition-colors", config.line)} />
        )}
      </div>

      {/* Content */}
      <div className={cn("pb-6 flex-1", isLast && "pb-0")}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className={cn("text-sm font-semibold", status === "not_started" ? "text-muted-foreground" : "text-foreground")}>
              {info.label}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed">{info.description}</p>
          </div>
          <span className={cn("shrink-0 rounded-full border px-2.5 py-0.5 text-[11px] font-medium", config.badge)}>
            {config.label}
          </span>
        </div>
      </div>
    </div>
  );
}

function CurrentStepCard({ worker }) {
  // Find the first in-progress or not-started phase
  const allPhases = [
    ...Object.entries(worker.stage_1 || {}).map(([k, v]) => ({ key: k, data: v.data, stage: 1 })),
    ...Object.entries(worker.stage_2 || {}).map(([k, v]) => ({ key: k, data: v.data, stage: 2 })),
  ];

  const activePhase = allPhases.find((p) => phaseStatus(p.data) === "in_progress");
  const completedCount = allPhases.filter((p) => phaseStatus(p.data) === "complete").length;
  const totalCount = allPhases.length;

  if (!activePhase) {
    if (completedCount === totalCount && totalCount > 0) {
      return (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 dark:border-emerald-800 dark:bg-emerald-950/30">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
            <div>
              <p className="text-base font-semibold text-emerald-800 dark:text-emerald-200">All steps complete!</p>
              <p className="text-sm text-emerald-700 dark:text-emerald-300">Your application has been fully processed.</p>
            </div>
          </div>
        </div>
      );
    }
    return null;
  }

  const info = STAGE_INFO[activePhase.key] || { label: activePhase.key, description: "" };
  const progress = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  return (
    <div className="rounded-2xl border border-indigo-200 bg-indigo-50/80 p-5 dark:border-indigo-800 dark:bg-indigo-950/40">
      <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600 dark:text-indigo-400">What's happening now</p>
      <p className="mt-2 text-lg font-heading font-bold text-foreground">{info.label}</p>
      <p className="mt-1 text-sm text-muted-foreground">{info.description}</p>

      {/* Progress bar */}
      <div className="mt-4 space-y-1.5">
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>{completedCount} of {totalCount} steps done</span>
          <span>{progress}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-indigo-100 dark:bg-indigo-900">
          <div className="h-full rounded-full bg-indigo-500 transition-all duration-500" style={{ width: `${progress}%` }} />
        </div>
      </div>
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
      <EmptyState
        icon={Info}
        title="No active session"
        description="Please log in again to view your application status."
        tone="neutral"
      />
    );
  }

  if (isLoading) return <PageSkeleton variant="detail" />;

  if (error || !worker) {
    return <ErrorState title="Unable to load status" message="We couldn't retrieve your application status. Please try again later." />;
  }

  const stage1Entries = Object.entries(worker.stage_1 || {});
  const stage2Entries = Object.entries(worker.stage_2 || {})
    .filter(([key]) => key !== "com_repatriation" || worker.stage_2?.arrival_verification?.data?.mdac_verified);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-heading font-bold text-foreground">Your Application Status</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {worker.full_name || "—"} · Passport: {worker.passport_number || "—"}
        </p>
      </div>

      {/* Current step highlight */}
      <CurrentStepCard worker={worker} />

      {/* Validation errors */}
      {worker.validation_errors?.length > 0 && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5 dark:border-rose-800 dark:bg-rose-950/30">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 shrink-0 text-rose-600 mt-0.5 dark:text-rose-400" />
            <div>
              <p className="text-sm font-semibold text-rose-800 dark:text-rose-200">Action required</p>
              <ul className="mt-2 space-y-1">
                {worker.validation_errors.map((e, i) => (
                  <li key={i} className="text-sm text-rose-700 dark:text-rose-300">• {e}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Timeline: Stage 1 */}
      {stage1Entries.length > 0 && (
        <div className="rounded-2xl border border-border bg-card p-5 sm:p-6">
          <h3 className="mb-5 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Stage 1 — Visa Application
          </h3>
          <div>
            {stage1Entries.map(([key, phase], i) => (
              <TimelineNode key={key} phaseKey={key} data={phase.data} isLast={i === stage1Entries.length - 1} />
            ))}
          </div>
        </div>
      )}

      {/* Timeline: Stage 2 */}
      {stage2Entries.length > 0 && (
        <div className="rounded-2xl border border-border bg-card p-5 sm:p-6">
          <h3 className="mb-5 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Stage 2 — Work Permit
          </h3>
          <div>
            {stage2Entries.map(([key, phase], i) => (
              <TimelineNode key={key} phaseKey={key} data={phase.data} isLast={i === stage2Entries.length - 1} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
