import { Activity, CheckCircle2, Lock, ShieldCheck, UserCircle2, Workflow } from "lucide-react";
import { useEffect, useMemo, useRef } from "react";
import ReactFlow, { Background, Controls, MarkerType, MiniMap } from "reactflow";
import "reactflow/dist/style.css";
import { useWorkerTasksPolling } from "@/hooks/useWorkerTasksPolling";
import { cn } from "@/lib/utils";
import { isStatusActive, isStatusBlocked, statusLabel } from "@/services/taskAdapter";
import { useWorkerStore } from "@/store/useWorkerStore";

function nodeIconForType(nodeType) {
  if (nodeType === "DocumentAudit") {
    return "DA";
  }

  if (nodeType === "ComplianceCheck") {
    return "CC";
  }

  if (nodeType === "CalculateFines") {
    return "CF";
  }

  if (nodeType === "MyEGPending") {
    return "MY";
  }

  return "TS";
}

function WorkflowNode({ data }) {
  const selector = useMemo(
    () => (state) => state.tasks.find((task) => task.id === data.taskId),
    [data.taskId],
  );

  const liveTask = useWorkerStore(selector);
  const task = liveTask || data.task;

  const isActive = isStatusActive(task.status) || task.status === "awaiting_approval";
  const isBlocked = isStatusBlocked(task.status);
  const isCompleted = task.status === "completed";

  return (
    <article
      className={cn(
        "node-transition min-w-52 rounded-xl border bg-white px-4 py-3 shadow-md",
        isActive && "border-indigo-500 ring-4 ring-indigo-500/30 motion-safe:animate-pulse",
        isCompleted && "border-emerald-500 bg-emerald-50",
        isBlocked && "border-rose-600 bg-rose-50",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="rounded-md bg-slate-100 px-2 py-1 font-mono text-[11px] font-semibold text-slate-700">
          {nodeIconForType(task.nodeType)}
        </span>
        {isCompleted ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : null}
        {isBlocked ? <Lock className="h-4 w-4 text-rose-700" /> : null}
        {isActive ? <Activity className="h-4 w-4 text-indigo-700" /> : null}
      </div>

      <p className="mt-2 text-sm font-semibold text-slate-900">{task.taskName}</p>
      <p className="mt-1 text-xs text-slate-500">{task.nodeType}</p>
      <span className="mt-3 inline-flex rounded-full bg-slate-100 px-2 py-1 text-[11px] font-medium capitalize text-slate-700">
        {statusLabel(task.status)}
      </span>
    </article>
  );
}

const nodeTypes = {
  workflowNode: WorkflowNode,
};

function buildFlow(tasks) {
  const byType = new Map(tasks.map((task, index) => [task.taskType, { task, index }]));

  const nodes = tasks.map((task, index) => ({
    id: task.id,
    type: "workflowNode",
    data: { taskId: task.id, task },
    position: {
      x: 90 + (index % 2) * 330,
      y: 70 + Math.floor(index / 2) * 180,
    },
    draggable: false,
  }));

  const edges = [];

  for (const targetTask of tasks) {
    for (const dependencyType of targetTask.dependsOn) {
      const dependency = byType.get(dependencyType);
      if (!dependency) {
        continue;
      }

      const sourceTask = dependency.task;
      const sourceIndex = dependency.index;
      const targetIndex = byType.get(targetTask.taskType)?.index ?? 0;
      const backwardEdge = sourceIndex >= targetIndex;
      const intoBlockedNode = isStatusBlocked(targetTask.status);

      edges.push({
        id: `${sourceTask.id}->${targetTask.id}`,
        source: sourceTask.id,
        target: targetTask.id,
        type: backwardEdge ? "smoothstep" : "bezier",
        animated: isStatusActive(sourceTask.status) || isStatusActive(targetTask.status),
        style: intoBlockedNode
          ? { stroke: "#be123c", strokeDasharray: "6 4", strokeWidth: 2 }
          : { stroke: "#334155", strokeWidth: 1.8 },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: intoBlockedNode ? "#be123c" : "#334155",
        },
      });
    }
  }

  return { nodes, edges };
}

export default function WorkerProfilePage() {
  const workerId = useWorkerStore((state) => state.workerId);
  const taskSource = useWorkerStore((state) => state.taskSource);
  const storeTasks = useWorkerStore((state) => state.tasks);
  const ruminationLines = useWorkerStore((state) => state.ruminationLines);
  const setRuminationLines = useWorkerStore((state) => state.setRuminationLines);

  useWorkerTasksPolling(workerId, {
    enabled: Boolean(workerId),
    intervalMs: 5500,
  });

  const tasks = storeTasks;

  const graph = useMemo(() => buildFlow(tasks), [tasks]);

  const activeTask = useMemo(
    () => tasks.find((task) => isStatusActive(task.status) || task.status === "awaiting_approval"),
    [tasks],
  );

  const activeTaskRef = useRef(null);

  useEffect(() => {
    if (!activeTask) {
      setRuminationLines(["> Waiting for active task..."]);
      activeTaskRef.current = null;
      return;
    }

    if (activeTaskRef.current === activeTask.id) {
      return;
    }

    activeTaskRef.current = activeTask.id;
    setRuminationLines([
      `> Agent entering ${activeTask.taskType} node...`,
      `> Ruminating: ${activeTask.taskName} is in active execution state.`,
      activeTask.dependsOn.length
        ? `> Checking depends_on: ${activeTask.dependsOn.join(", ")}.`
        : "> No upstream dependency blockers detected.",
      activeTask.status === "awaiting_approval"
        ? "> Action: pausing graph for human approval before resume."
        : "> Action: continue orchestration through next transition edge.",
    ]);
  }, [activeTask, setRuminationLines]);

  const completedCount = tasks.filter((task) => task.status === "completed").length;
  const blockedCount = tasks.filter((task) => isStatusBlocked(task.status)).length;

  return (
    <div className="space-y-6">
      <section className="permit-surface px-5 py-4 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <UserCircle2 className="h-11 w-11 text-slate-500" />
            <div>
              <h2 className="text-xl font-semibold">Worker Profile & LangGraph Visualizer</h2>
              <p className="text-sm text-slate-600">
                Worker ID: {workerId || "demo-worker-001"} | Source: {taskSource}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 text-xs text-slate-600">
            <span className="rounded-full bg-emerald-100 px-3 py-1 font-medium text-emerald-800">
              Completed: {completedCount}
            </span>
            <span className="rounded-full bg-rose-100 px-3 py-1 font-medium text-rose-800">
              Blocked: {blockedCount}
            </span>
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.35fr_1fr]">
        <article className="permit-surface h-[560px] overflow-hidden">
          <header className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
            <div className="flex items-center gap-2">
              <Workflow className="h-4 w-4 text-indigo-700" />
              <h3 className="text-sm font-semibold text-slate-900">LangGraph Task Topology</h3>
            </div>
            <span className="text-xs text-slate-500">React Flow</span>
          </header>

          <div className="h-[calc(100%-49px)]">
            <ReactFlow
              nodes={graph.nodes}
              edges={graph.edges}
              nodeTypes={nodeTypes}
              fitView
              fitViewOptions={{ padding: 0.22 }}
              proOptions={{ hideAttribution: true }}
              nodesDraggable={false}
              nodesConnectable={false}
              elementsSelectable={false}
            >
              <Background color="#cbd5e1" gap={22} />
              <MiniMap pannable zoomable className="!bg-white/90" />
              <Controls showInteractive={false} />
            </ReactFlow>
          </div>
        </article>

        <article className="rounded-2xl border border-slate-700 bg-slate-900 text-green-300 shadow-soft">
          <header className="flex items-center justify-between border-b border-slate-700 px-4 py-3">
            <div className="flex items-center gap-2 text-slate-100">
              <ShieldCheck className="h-4 w-4 text-green-400" />
              <h3 className="text-sm font-semibold">GLM-5 Rumination Terminal</h3>
            </div>
            <span className="font-mono text-[11px] text-slate-400">streaming</span>
          </header>

          <div className="space-y-2 px-4 py-4 font-mono text-xs leading-relaxed">
            {ruminationLines.map((line, index) => (
              <p key={`${line}-${index}`} className="text-green-300">
                {line}
              </p>
            ))}
          </div>
        </article>
      </section>
    </div>
  );
}
