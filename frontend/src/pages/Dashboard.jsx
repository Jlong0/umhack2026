import { AlertTriangle, ShieldAlert, Timer, Workflow, TrendingUp, Users, AlertCircle } from "lucide-react";
import { createElement, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import TaskList from "@/components/TaskList";
import StatutoryExposureCalculator from "@/components/StatutoryExposureCalculator";
import MTLMTracker from "@/components/MTLMTracker";
import { useWorkerTasksPolling } from "@/hooks/useWorkerTasksPolling";
import { isStatusActive, isStatusAwaitingApproval, isStatusBlocked } from "@/services/taskAdapter";
import { useWorkerStore } from "@/store/useWorkerStore";
import { useAlertDashboard } from "@/hooks/queries/useAlertQueries";
import { useAllWorkflows } from "@/hooks/queries/useWorkflowQueries";
import { usePendingInterrupts } from "@/hooks/queries/useHITLQueries";

function asCurrency(value) {
  return new Intl.NumberFormat("en-MY", {
    style: "currency",
    currency: "MYR",
    maximumFractionDigits: 0,
  }).format(value || 0);
}

const TONE_STYLES = {
  blue: {
    icon: "bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400",
    value: "text-blue-600 dark:text-blue-400",
  },
  red: {
    icon: "bg-red-50 text-red-500 dark:bg-red-950 dark:text-red-400",
    value: "text-red-500 dark:text-red-400",
  },
  amber: {
    icon: "bg-amber-50 text-amber-500 dark:bg-amber-950 dark:text-amber-400",
    value: "text-amber-500 dark:text-amber-400",
  },
  emerald: {
    icon: "bg-emerald-50 text-emerald-500 dark:bg-emerald-950 dark:text-emerald-400",
    value: "text-emerald-500 dark:text-emerald-400",
  },
  slate: {
    icon: "bg-muted text-muted-foreground",
    value: "text-foreground",
  },
};

function HealthCard({ icon: Icon, label, value, tone = "slate", onClick }) {
  const iconNode = createElement(Icon, { className: "h-5 w-5" });
  const styles = TONE_STYLES[tone] || TONE_STYLES.slate;

  return (
    <article
      className={`rounded-2xl border border-border bg-card p-6 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md ${
        onClick
          ? "cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          : ""
      }`}
      onClick={onClick}
      tabIndex={onClick ? 0 : undefined}
      role={onClick ? "button" : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === "Enter" || e.key === " ") onClick(); } : undefined}
    >
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="mt-4 flex items-center gap-3">
        <div className={`rounded-lg p-2.5 ${styles.icon}`}>
          {iconNode}
        </div>
        <p className={`text-2xl font-semibold ${styles.value}`}>{value}</p>
      </div>
    </article>
  );
}

function SummaryCard({ label, value, tone = "slate" }) {
  const styles = TONE_STYLES[tone] || TONE_STYLES.slate;

  return (
    <div className="rounded-2xl border border-border bg-card p-6 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`mt-3 text-2xl font-semibold ${styles.value}`}>{value}</p>
    </div>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const workerId = useWorkerStore((state) => state.workerId);
  const taskSource = useWorkerStore((state) => state.taskSource);
  const storeTasks = useWorkerStore((state) => state.tasks);

  const { data: alertDashboard } = useAlertDashboard();
  const { data: workflowData } = useAllWorkflows();
  const { data: interruptData } = usePendingInterrupts();

  const workflows = workflowData?.workflows || [];
  const pendingInterrupts = interruptData?.total || 0;

  const { lastUpdatedAt } = useWorkerTasksPolling(workerId, {
    enabled: Boolean(workerId),
    intervalMs: 6500,
  });

  const tasks = storeTasks;

  const metrics = useMemo(() => {
    const activeRuns = tasks.filter((task) => isStatusActive(task.status)).length;
    const blockedTasks = tasks.filter((task) => isStatusBlocked(task.status)).length;
    const pendingConfirmations = tasks.filter(
      (task) => task.requiresApproval || isStatusAwaitingApproval(task.status),
    ).length;

    const fineTasks = tasks.filter(
      (task) =>
        task.nodeType === "CalculateFines" || /fine|levy|penalty|calculate/i.test(task.taskType),
    );

    const strictLiabilityExposure = fineTasks.reduce((sum, task) => {
      const exposure = Number(task.fineExposure);
      return Number.isFinite(exposure) ? sum + exposure : sum;
    }, 0);

    return {
      activeRuns,
      blockedTasks,
      pendingConfirmations,
      strictLiabilityExposure,
    };
  }, [tasks]);

  return (
    <div className="space-y-6">
      {/* Page header */}
      <section className="rounded-2xl border border-border bg-card px-6 py-5">
        <h2 className="text-xl font-semibold text-foreground">Overview</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Real-time compliance monitoring, worker workflows, and task tracking.
        </p>
        <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 font-medium">
            Source: {taskSource}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 font-medium">
            Last refresh: {lastUpdatedAt ? new Date(lastUpdatedAt).toLocaleTimeString() : "Not yet polled"}
          </span>
        </div>
      </section>

      {/* Primary KPIs */}
      <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <HealthCard
          icon={Workflow}
          label="Active Workflows"
          value={workflows.length}
          tone="blue"
          onClick={() => navigate("/workflows")}
        />
        <HealthCard
          icon={AlertCircle}
          label="Critical Alerts"
          value={alertDashboard?.summary?.expired_permits || 0}
          tone="red"
          onClick={() => navigate("/alerts")}
        />
        <HealthCard
          icon={Users}
          label="Approvals Queue"
          value={pendingInterrupts}
          tone="amber"
          onClick={() => navigate("/hitl")}
        />
        <HealthCard
          icon={TrendingUp}
          label="Health Score"
          value={alertDashboard?.health_score ? `${alertDashboard.health_score}%` : "N/A"}
          tone="emerald"
          onClick={() => navigate("/alerts")}
        />
      </section>

      {/* Secondary metrics */}
      {alertDashboard && (
        <section className="grid gap-4 md:grid-cols-3">
          <SummaryCard
            label="Total Workers"
            value={alertDashboard.summary.total_workers}
            tone="slate"
          />
          <SummaryCard
            label="Expiring (30 days)"
            value={alertDashboard.summary.expiring_30_days}
            tone="amber"
          />
          <SummaryCard
            label="Compliance Deadlocks"
            value={alertDashboard.summary.compliance_deadlocks}
            tone="red"
          />
        </section>
      )}

      {/* PRD Screen A: Risk Widgets */}
      <section className="grid gap-4 md:grid-cols-2">
        <StatutoryExposureCalculator />
        <MTLMTracker />
      </section>

      {/* Workflow detail metrics */}
      <section className="grid gap-4 md:grid-cols-3">
        <HealthCard icon={Workflow} label="Active LangGraph Runs" value={metrics.activeRuns} tone="blue" />
        <HealthCard icon={ShieldAlert} label="Blocked Tasks" value={metrics.blockedTasks} tone="red" />
        <HealthCard
          icon={Timer}
          label="Pending Human Confirmations"
          value={metrics.pendingConfirmations}
          tone="amber"
        />
      </section>

      {/* Blocked dependency table */}
      <section className="space-y-4">
        <div className="rounded-2xl border border-border bg-card px-6 py-5">
          <h3 className="text-lg font-semibold text-foreground">Blocked Dependency Table</h3>
          <p className="mt-1 text-sm text-muted-foreground">Rows in blocked state are highlighted and dependency failures are surfaced.</p>
        </div>
        <TaskList tasks={tasks} />
      </section>
    </div>
  );
}
