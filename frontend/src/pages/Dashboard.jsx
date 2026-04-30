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

function HealthCard({ icon: Icon, label, value, tone = "slate", onClick }) {
  const iconNode = createElement(Icon, { className: "h-4 w-4" });

  const toneClass = {
    slate: "text-slate-900",
    indigo: "text-indigo-800",
    rose: "text-rose-800",
    amber: "text-amber-800",
    green: "text-green-800",
    orange: "text-orange-800",
  }[tone];

  return (
    <article
      className={`permit-surface p-5 ${onClick ? "cursor-pointer hover:shadow-lg transition-shadow" : ""}`}
      onClick={onClick}
    >
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <div className="mt-3 flex items-center gap-3">
        <div className="rounded-lg bg-slate-100 p-2 text-slate-700">
          {iconNode}
        </div>
        <p className={`text-2xl font-semibold ${toneClass}`}>{value}</p>
      </div>
    </article>
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
      <section className="permit-surface px-5 py-4 sm:px-6">
        <h2 className="text-xl font-semibold">Overview</h2>
        <p className="mt-1 text-sm text-slate-600">
          Real-time compliance monitoring, worker workflows, and task tracking.
        </p>
        <p className="mt-2 text-xs text-slate-500">
          Source: {taskSource} | Last refresh: {lastUpdatedAt ? new Date(lastUpdatedAt).toLocaleTimeString() : "Not yet polled"}
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <HealthCard
          icon={Workflow}
          label="Active Workflows"
          value={workflows.length}
          tone="indigo"
          onClick={() => navigate("/workflows")}
        />
        <HealthCard
          icon={AlertCircle}
          label="Critical Alerts"
          value={alertDashboard?.summary?.expired_permits || 0}
          tone="rose"
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
          tone="green"
          onClick={() => navigate("/alerts")}
        />
      </section>

      {alertDashboard && (
        <section className="grid gap-4 md:grid-cols-3">
          <div className="permit-surface p-5">
            <p className="text-xs uppercase tracking-wide text-slate-500">Total Workers</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{alertDashboard.summary.total_workers}</p>
          </div>
          <div className="permit-surface p-5">
            <p className="text-xs uppercase tracking-wide text-slate-500">Expiring (30 days)</p>
            <p className="mt-2 text-2xl font-semibold text-orange-800">{alertDashboard.summary.expiring_30_days}</p>
          </div>
          <div className="permit-surface p-5">
            <p className="text-xs uppercase tracking-wide text-slate-500">Compliance Deadlocks</p>
            <p className="mt-2 text-2xl font-semibold text-rose-800">{alertDashboard.summary.compliance_deadlocks}</p>
          </div>
        </section>
      )}

      {/* PRD Screen A: Risk Widgets */}
      <section className="grid gap-4 md:grid-cols-2">
        <StatutoryExposureCalculator />
        <MTLMTracker />
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <HealthCard icon={Workflow} label="Active LangGraph Runs" value={metrics.activeRuns} tone="indigo" />
        <HealthCard icon={ShieldAlert} label="Blocked Tasks" value={metrics.blockedTasks} tone="rose" />
        <HealthCard
          icon={Timer}
          label="Pending Human Confirmations"
          value={metrics.pendingConfirmations}
          tone="amber"
        />
      </section>

      <section className="space-y-3">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">Blocked Dependency Table</h3>
          <p className="text-sm text-slate-600">Rows in blocked state are highlighted and dependency failures are surfaced.</p>
        </div>
        <TaskList tasks={tasks} />
      </section>
    </div>
  );
}
