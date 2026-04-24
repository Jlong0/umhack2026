import { Activity, CheckCircle2, Lock, ShieldCheck, UserCircle2, Workflow, MessageSquare, Send } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import ReactFlow, { Background, Controls, MarkerType, MiniMap } from "reactflow";
import "reactflow/dist/style.css";
import { useWorkerTasksPolling } from "@/hooks/useWorkerTasksPolling";
import { useFirestoreStream } from "@/hooks/useFirestoreStream";
import { cn } from "@/lib/utils";
import { isStatusActive, isStatusBlocked, statusLabel } from "@/services/taskAdapter";
import { useWorkerStore } from "@/store/useWorkerStore";
import ConfidenceBadge from "@/components/ConfidenceBadge";

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
      <div className="mt-2 flex items-center justify-between">
        <span className="inline-flex rounded-full bg-slate-100 px-2 py-1 text-[11px] font-medium capitalize text-slate-700">
          {statusLabel(task.status)}
        </span>
        {task.confidenceScore != null && (
          <ConfidenceBadge score={task.confidenceScore} reasoning={task.reasoning} />
        )}
      </div>
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

  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState([]);
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef(null);

  // Real-time Firestore stream for live AI updates
  const { latestEvent, isConnected } = useFirestoreStream(workerId);

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

      {/* AI Chat Interface — PRD Screen D */}
      <section className="permit-surface overflow-hidden flex flex-col" style={{ minHeight: "280px" }}>
        <header className="flex items-center gap-2 border-b border-slate-200 px-4 py-3">
          <MessageSquare className="h-4 w-4 text-indigo-700" />
          <h3 className="text-sm font-semibold text-slate-900">Worker AI Assistant</h3>
          {isConnected && (
            <span className="ml-auto flex items-center gap-1 text-[10px] text-emerald-600">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Live
            </span>
          )}
        </header>

        {/* Message History */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 max-h-64">
          {chatMessages.length === 0 && (
            <div className="text-center py-6">
              <MessageSquare className="h-8 w-8 text-slate-300 mx-auto mb-2" />
              <p className="text-xs text-slate-400">
                Ask about {workerId || "this worker"}'s compliance status, permit timeline, or legal transfer rights.
              </p>
            </div>
          )}
          {chatMessages.map((msg, idx) => (
            <div
              key={idx}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                  msg.role === "user"
                    ? "bg-indigo-600 text-white"
                    : "bg-slate-100 text-slate-800 border border-slate-200"
                }`}
              >
                {msg.content}
                <div className={`text-[10px] mt-1 ${msg.role === "user" ? "text-indigo-200" : "text-slate-400"}`}>
                  {new Date(msg.timestamp).toLocaleTimeString()}
                </div>
              </div>
            </div>
          ))}
          {chatLoading && (
            <div className="flex justify-start">
              <div className="bg-slate-100 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-500">
                <span className="inline-flex gap-1">
                  <span className="animate-bounce" style={{ animationDelay: "0ms" }}>●</span>
                  <span className="animate-bounce" style={{ animationDelay: "150ms" }}>●</span>
                  <span className="animate-bounce" style={{ animationDelay: "300ms" }}>●</span>
                </span>
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        {/* Input */}
        <div className="flex items-center gap-2 border-t border-slate-200 p-3">
          <input
            type="text"
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            placeholder={`Ask about ${workerId || 'this worker'}'s legal transfer rights...`}
            className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm placeholder-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400"
            onKeyDown={(e) => {
              if (e.key === "Enter" && chatInput.trim() && !chatLoading) {
                handleSendChat();
              }
            }}
            disabled={chatLoading}
          />
          <button
            onClick={handleSendChat}
            disabled={!chatInput.trim() || chatLoading}
            className="rounded-lg bg-indigo-600 p-2 text-white transition-colors hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </section>
    </div>
  );

  function handleSendChat() {
    const message = chatInput.trim();
    if (!message) return;

    const userMsg = { role: "user", content: message, timestamp: Date.now() };
    setChatMessages((prev) => [...prev, userMsg]);
    setChatInput("");
    setChatLoading(true);

    // Scroll to bottom
    setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);

    // Simulate AI response (replace with real API call when backend endpoint is ready)
    // TODO: Replace with `POST /agents/chat` when backend team implements it
    setTimeout(() => {
      const aiResponse = generatePlaceholderResponse(message, workerId, tasks);
      setChatMessages((prev) => [...prev, { role: "assistant", content: aiResponse, timestamp: Date.now() }]);
      setChatLoading(false);
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    }, 800 + Math.random() * 700);
  }
}

function generatePlaceholderResponse(question, workerId, tasks) {
  const q = question.toLowerCase();
  const activeTasks = tasks.filter((t) => t.status === "IN_PROGRESS").length;
  const blockedTasks = tasks.filter((t) => t.status === "BLOCKED_HITL").length;
  const totalTasks = tasks.length;

  if (q.includes("status") || q.includes("compliance")) {
    return `Worker ${workerId || "N/A"} currently has ${totalTasks} tasks tracked: ${activeTasks} in progress, ${blockedTasks} blocked for human review. ${blockedTasks > 0 ? "⚠️ Action required on blocked tasks." : "✅ No blockers detected."}`;
  }
  if (q.includes("permit") || q.includes("expir")) {
    return `To check permit expiry details for ${workerId || "this worker"}, please visit the Alerts page. The system automatically scans for permits expiring within 30/60/90 day windows.`;
  }
  if (q.includes("transfer") || q.includes("legal")) {
    return `Legal transfer eligibility for ${workerId || "this worker"} depends on current permit class, employer sponsorship status, and compliance with Section 55B of the Immigration Act. Please verify all documents are in COMPLETED status before initiating transfer.`;
  }
  if (q.includes("fine") || q.includes("penalty") || q.includes("55b")) {
    return `Under Section 55B of the Immigration Act, penalties range from RM 10,000 to RM 50,000 per violation. ${blockedTasks > 0 ? `This worker has ${blockedTasks} task(s) requiring human review that may carry fine exposure.` : "No active fine exposure detected for this worker."}`;
  }
  return `I can help with compliance status, permit expiry, transfer rights, and Section 55B fine calculations for ${workerId || "this worker"}. What would you like to know?`;
}

