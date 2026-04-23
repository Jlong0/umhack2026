import { AlertTriangle, ShieldAlert, Timer, Workflow } from "lucide-react";
import { createElement, useMemo } from "react";
import TaskList from "@/components/TaskList";
import { useWorkerTasksPolling } from "@/hooks/useWorkerTasksPolling";
import { isStatusActive, isStatusAwaitingApproval, isStatusBlocked } from "@/services/taskAdapter";
import { useWorkerStore } from "@/store/useWorkerStore";

function asCurrency(value) {
  return new Intl.NumberFormat("en-MY", {
    style: "currency",
    currency: "MYR",
    maximumFractionDigits: 0,
  }).format(value || 0);
}

function HealthCard({ icon: Icon, label, value, tone = "slate" }) {
  const iconNode = createElement(Icon, { className: "h-4 w-4" });

  const toneClass = {
    slate: "text-slate-900",
    indigo: "text-indigo-800",
    rose: "text-rose-800",
    amber: "text-amber-800",
  }[tone];

  return (
    <article className="permit-surface p-5">
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
  const workerId = useWorkerStore((state) => state.workerId);
  const taskSource = useWorkerStore((state) => state.taskSource);
  const storeTasks = useWorkerStore((state) => state.tasks);

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
        <h2 className="text-xl font-semibold">Executive Dashboard & Task Tracking</h2>
        <p className="mt-1 text-sm text-slate-600">
          Live dependency health for the active worker workflow.
        </p>
        <p className="mt-2 text-xs text-slate-500">
          Source: {taskSource} | Last refresh: {lastUpdatedAt ? new Date(lastUpdatedAt).toLocaleTimeString() : "Not yet polled"}
        </p>
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

      <section className="rounded-2xl border border-rose-200 bg-rose-50 px-5 py-5 shadow-soft sm:px-6">
        <div className="flex items-center gap-2 text-rose-700">
          <AlertTriangle className="h-5 w-5" />
          <h3 className="text-base font-semibold">Strict Liability Exposure</h3>
        </div>

        <p className="mt-3 text-3xl font-bold text-rose-800">
          {metrics.strictLiabilityExposure > 0
            ? `Critical Risk: ${asCurrency(metrics.strictLiabilityExposure)} Fine Exposure`
            : "Critical Risk: Pending CalculateFines execution"}
        </p>
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
