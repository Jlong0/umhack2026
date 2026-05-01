import { ShieldAlert, Timer, Workflow, TrendingUp, Users, AlertCircle, Clock, AlertTriangle } from "lucide-react";
import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import TaskList from "@/components/TaskList";
import StatutoryExposureCalculator from "@/components/StatutoryExposureCalculator";
import MTLMTracker from "@/components/MTLMTracker";
import { MetricCard } from "@/components/ui/metric-card";
import { PageHeader } from "@/components/ui/page-header";
import { SectionLabel } from "@/components/ui/section-label";
import { Button } from "@/components/ui/button";
import { useWorkerTasksPolling } from "@/hooks/useWorkerTasksPolling";
import { isStatusActive, isStatusAwaitingApproval, isStatusBlocked } from "@/services/taskAdapter";
import { useWorkerStore } from "@/store/useWorkerStore";
import { useAlertDashboard } from "@/hooks/queries/useAlertQueries";
import { useAllWorkflows } from "@/hooks/queries/useWorkflowQueries";
import { usePendingInterrupts } from "@/hooks/queries/useHITLQueries";

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

    return { activeRuns, blockedTasks, pendingConfirmations };
  }, [tasks]);

  // Derived urgency state for the attention banner
  const expiredPermits = alertDashboard?.summary?.expired_permits || 0;
  const expiringPermits = alertDashboard?.summary?.expiring_30_days || 0;
  const deadlocks = alertDashboard?.summary?.compliance_deadlocks || 0;
  const totalWorkers = alertDashboard?.summary?.total_workers || 0;
  const healthScore = alertDashboard?.health_score;

  const needsAttention = expiredPermits > 0 || metrics.blockedTasks > 0 || deadlocks > 0;

  return (
    <div className="space-y-8">
      {/* ── Page Header ── */}
      <PageHeader
        title="Overview"
        description="Real-time compliance monitoring, worker workflows, and task tracking."
      >
        <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 font-medium">
            Source: {taskSource}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 font-medium">
            Last refresh: {lastUpdatedAt ? new Date(lastUpdatedAt).toLocaleTimeString() : "Not yet polled"}
          </span>
        </div>
      </PageHeader>

      {/* ── Attention Banner ── */}
      {needsAttention && (
        <div className="flex items-center gap-4 rounded-2xl border border-red-200 bg-gradient-to-r from-red-50 to-orange-50 px-5 py-4 dark:border-red-900 dark:from-red-950/40 dark:to-orange-950/30">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100 dark:bg-red-950">
            <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-foreground">Immediate attention required</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {[
                expiredPermits > 0 && `${expiredPermits} expired permit${expiredPermits !== 1 ? "s" : ""}`,
                metrics.blockedTasks > 0 && `${metrics.blockedTasks} blocked task${metrics.blockedTasks !== 1 ? "s" : ""}`,
                deadlocks > 0 && `${deadlocks} compliance deadlock${deadlocks !== 1 ? "s" : ""}`,
              ].filter(Boolean).join(" · ")}
            </p>
          </div>
          <Button size="sm" variant="destructive" onClick={() => navigate("/alerts")}>
            Review Alerts
          </Button>
        </div>
      )}

      {/* ── Section 1: Compliance Health ── */}
      <section className="space-y-4">
        <SectionLabel title="Compliance Health" subtitle="Permit status and workforce overview" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            icon={TrendingUp}
            label="Health Score"
            value={healthScore ? `${healthScore}%` : "N/A"}
            tone={healthScore >= 80 ? "emerald" : healthScore >= 50 ? "amber" : "red"}
            description={healthScore >= 80 ? "Good standing" : healthScore >= 50 ? "Needs improvement" : "Critical risk"}
            onClick={() => navigate("/alerts")}
          />
          <MetricCard
            icon={Users}
            label="Total Workers"
            value={totalWorkers}
            tone="slate"
            description="Active workforce"
            onClick={() => navigate("/workers")}
          />
          <MetricCard
            icon={AlertCircle}
            label="Expired Permits"
            value={expiredPermits}
            tone={expiredPermits > 0 ? "red" : "emerald"}
            description={expiredPermits > 0 ? "Immediate action needed" : "All compliant"}
            onClick={() => navigate("/alerts")}
          />
          <MetricCard
            icon={Clock}
            label="Expiring (30 days)"
            value={expiringPermits}
            tone={expiringPermits > 0 ? "amber" : "emerald"}
            description={expiringPermits > 0 ? "Renewal window open" : "No upcoming expirations"}
            onClick={() => navigate("/alerts")}
          />
        </div>
      </section>

      {/* ── Section 2: Risk Exposure ── */}
      <section className="space-y-4">
        <SectionLabel title="Risk Exposure" subtitle="Section 55B fines and MTLM levy projections" />
        <div className="grid gap-4 md:grid-cols-2">
          <StatutoryExposureCalculator />
          <MTLMTracker />
        </div>
      </section>

      {/* ── Section 3: Operational Status ── */}
      <section className="space-y-4">
        <SectionLabel
          title="Operational Status"
          subtitle="Active workflows, approvals, and task execution"
          action={
            <Button variant="ghost" size="sm" onClick={() => navigate("/workflows")}>
              View all workflows →
            </Button>
          }
        />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            icon={Workflow}
            label="Active Workflows"
            value={workflows.length}
            tone="blue"
            onClick={() => navigate("/workflows")}
          />
          <MetricCard
            icon={Users}
            label="Approval Queue"
            value={pendingInterrupts}
            tone={pendingInterrupts > 0 ? "amber" : "emerald"}
            description={pendingInterrupts > 0 ? "Awaiting human review" : "Queue clear"}
            onClick={() => navigate("/hitl")}
          />
          <MetricCard
            icon={ShieldAlert}
            label="Blocked Tasks"
            value={metrics.blockedTasks}
            tone={metrics.blockedTasks > 0 ? "red" : "emerald"}
            onClick={() => navigate("/tool-handoff")}
          />
          <MetricCard
            icon={Timer}
            label="Pending Confirmations"
            value={metrics.pendingConfirmations}
            tone={metrics.pendingConfirmations > 0 ? "amber" : "slate"}
            onClick={() => navigate("/tool-handoff")}
          />
        </div>
      </section>

      {/* ── Section 4: Task Execution Detail (promoted higher) ── */}
      <section className="space-y-4">
        <SectionLabel title="Task Execution" subtitle="Dependency graph status — blocked rows are highlighted" />
        <TaskList tasks={tasks} />
      </section>
    </div>
  );
}
