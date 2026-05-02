import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ExternalLink } from "lucide-react";
import AgentDetailModal from "@/components/AgentDetailModal";
import HITLChatbot from "@/components/HITLChatbot";
import { API_BASE_URL } from "@/services/api";

const WS_BASE = API_BASE_URL.replace(/^http/, "ws").replace(/\/+$/, "");

// ── Node layout — matches Compliance Graph exactly ───────────────────────────
// Supervisor at top-center, 7 agents around it in a hub-and-spoke pattern
const NODES = [
  { id: "supervisor",    label: "🎯 Supervisor",        cx: 350, cy: 50  },
  { id: "company_audit", label: "🏢 Company Audit",     cx: 70,  cy: 170 },
  { id: "auditor",       label: "📋 Auditor",           cx: 210, cy: 170 },
  { id: "vdr_filing",    label: "📁 VDR Filing",        cx: 350, cy: 170 },
  { id: "plks_monitor",  label: "📡 PLKS Monitor",      cx: 490, cy: 170 },
  { id: "strategist",    label: "🧮 Strategist",        cx: 140, cy: 310 },
  { id: "filing",        label: "📝 Filing",            cx: 350, cy: 310 },
  { id: "hitl",          label: "👤 HITL Review",       cx: 560, cy: 310 },
];

// Simple straight edges
const EDGES = [
  { from: "supervisor", to: "company_audit" },
  { from: "supervisor", to: "auditor" },
  { from: "supervisor", to: "vdr_filing" },
  { from: "supervisor", to: "plks_monitor" },
  { from: "supervisor", to: "strategist" },
  { from: "supervisor", to: "filing" },
  { from: "supervisor", to: "hitl" },
];

const NODE_W = 130, NODE_H = 42, NODE_RX = 10;

function nodeStyle(status) {
  if (status === "running") return { fill: "#fef3c7", stroke: "#f59e0b", text: "#92400e", badge: "#f59e0b" };
  if (status === "done")    return { fill: "#d1fae5", stroke: "#10b981", text: "#065f46", badge: "#10b981" };
  if (status === "failed")  return { fill: "#fee2e2", stroke: "#ef4444", text: "#991b1b", badge: "#ef4444" };
  return { fill: "#f1f5f9", stroke: "#cbd5e1", text: "#475569", badge: "#94a3b8" };
}

function statusText(status) {
  if (status === "running") return "IN PROGRESS";
  if (status === "done")    return "DONE ✓";
  if (status === "failed")  return "FAILED ✗";
  return "PENDING";
}

export default function LiveOrchestrationPage() {
  const { workerId } = useParams();
  const navigate = useNavigate();
  const [agentStatuses, setAgentStatuses] = useState({});
  const [executionTrace, setExecutionTrace] = useState([]);
  const [workflowStage, setWorkflowStage] = useState("init");
  const [wsStatus, setWsStatus] = useState("connecting");
  const [selectedNode, setSelectedNode] = useState(null);
  const [chatTarget, setChatTarget] = useState(null);
  const [hitlRequired, setHitlRequired] = useState(false);
  const traceEndRef = useRef(null);

  // Load persisted trace on mount (page reload recovery)
  useEffect(() => {
    if (!workerId) return;
    fetch(`${API_BASE_URL}/workflows/${workerId}/trace`)
      .then(r => r.json())
      .then(data => {
        if (data.agent_statuses && Object.keys(data.agent_statuses).length > 0) {
          setAgentStatuses(prev => ({ ...data.agent_statuses, ...prev }));
        }
        if (data.execution_trace?.length > 0) {
          setExecutionTrace(prev => prev.length > 0 ? prev : data.execution_trace);
        }
        if (data.workflow_stage) setWorkflowStage(data.workflow_stage);
      })
      .catch(() => {});
  }, [workerId]);

  // WebSocket for live updates
  useEffect(() => {
    const ws = new WebSocket(`${WS_BASE}/ws/dashboard`);
    ws.onopen = () => setWsStatus("live");
    ws.onclose = () => setWsStatus("disconnected");
    ws.onerror = () => setWsStatus("error");
    ws.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.worker_id !== workerId || data.type !== "agent_event") return;
        setAgentStatuses(prev => {
          const merged = { ...prev };
          for (const [k, v] of Object.entries(data.agent_statuses || {})) {
            if (prev[k] === "done" && v === "running") continue;
            merged[k] = v;
          }
          return merged;
        });
        setExecutionTrace(data.execution_trace || []);
        setWorkflowStage(data.workflow_stage || "init");
        if (data.agent_statuses?.hitl === "running") setHitlRequired(true);
      } catch {}
    };
    return () => ws.close();
  }, [workerId]);

  useEffect(() => {
    traceEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [executionTrace]);

  const handleNodeClick = useCallback((node) => setSelectedNode(node), []);
  const handleDiscuss = useCallback((agentId) => {
    setChatTarget(agentId);
    setSelectedNode(null);
  }, []);

  const workflowStatus =
    Object.values(agentStatuses).includes("running") ? "RUNNING"
    : Object.values(agentStatuses).includes("failed") ? "FAILED"
    : workflowStage === "ready_to_complete" ? "DONE"
    : Object.values(agentStatuses).some(s => s === "done") ? "RUNNING"
    : "PENDING";

  const statusColor = workflowStatus === "RUNNING" ? "#f59e0b"
    : workflowStatus === "DONE" ? "#10b981"
    : workflowStatus === "FAILED" ? "#ef4444"
    : "#94a3b8";

  return (
    <div className="flex h-full flex-col bg-white text-gray-900" style={{ fontFamily: "'Inter', sans-serif" }}>
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-200 px-6 py-3">
        <div>
          <h1 className="text-lg font-bold text-gray-800">Live Orchestration</h1>
          <p className="text-xs text-gray-500">
            Workflow:{" "}
            <span style={{ color: statusColor }}>● {workflowStatus}</span>
            {workerId && <span className="ml-2 font-mono text-gray-400">{workerId}</span>}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className={`rounded-full px-3 py-1 text-xs font-medium ${wsStatus === "live" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
            ● WS {wsStatus.toUpperCase()}
          </span>
          <button onClick={() => navigate(-1)} className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs text-gray-500 hover:text-gray-800 hover:border-gray-400">
            ← Back
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Graph + Trace */}
        <div className="flex flex-1 flex-col">
          {/* SVG Graph */}
          <div className="flex flex-1 items-center justify-center p-4">
            <svg viewBox="0 0 700 380" className="w-full max-w-3xl" style={{ maxHeight: 400 }}>
              {/* Edges */}
              {EDGES.map(({ from, to }) => {
                const s = NODES.find(n => n.id === from);
                const d = NODES.find(n => n.id === to);
                const srcStatus = agentStatuses[from];
                const active = srcStatus === "running";
                const done = srcStatus === "done";
                const color = active ? "#f59e0b" : done ? "#10b981" : "#e2e8f0";
                
                // Connect from bottom of source to top of destination
                const x1 = s.cx;
                const y1 = s.cy + NODE_H / 2;
                const x2 = d.cx;
                const y2 = d.cy - NODE_H / 2;
                
                return (
                  <line
                    key={`${from}-${to}`}
                    x1={x1}
                    y1={y1}
                    x2={x2}
                    y2={y2}
                    stroke={color}
                    strokeWidth={active ? 2.5 : 1.2}
                    opacity={active || done ? 1 : 0.5}
                  >
                    {active && (
                      <animate attributeName="opacity" values="0.4;1;0.4" dur="1.2s" repeatCount="indefinite" />
                    )}
                  </line>
                );
              })}

              {/* Nodes */}
              {NODES.map((node) => {
                const status = agentStatuses[node.id] || "pending";
                const s = nodeStyle(status);
                const isRunning = status === "running";
                const x = node.cx - NODE_W / 2;
                const y = node.cy - NODE_H / 2;
                return (
                  <g key={node.id} style={{ cursor: "pointer" }} onClick={() => handleNodeClick(node)}>
                    {/* Pulse glow */}
                    {isRunning && (
                      <rect x={x - 3} y={y - 3} width={NODE_W + 6} height={NODE_H + 6}
                        rx={NODE_RX + 2} fill="none" stroke={s.badge} strokeWidth={2}>
                        <animate attributeName="opacity" values="0.3;0.8;0.3" dur="1.2s" repeatCount="indefinite" />
                      </rect>
                    )}
                    {/* Box */}
                    <rect x={x} y={y} width={NODE_W} height={NODE_H}
                      rx={NODE_RX} fill={s.fill} stroke={s.stroke} strokeWidth={1.5} />
                    {/* Label */}
                    <text x={node.cx} y={node.cy - 3} textAnchor="middle"
                      fill={s.text} fontSize={10} fontWeight="600">{node.label}</text>
                    {/* Status badge */}
                    <text x={node.cx} y={node.cy + 12} textAnchor="middle"
                      fill={s.badge} fontSize={8} fontWeight="500">{statusText(status)}</text>
                  </g>
                );
              })}

              {/* Legend */}
              <g transform="translate(10, 362)">
                {[
                  { color: "#f1f5f9", stroke: "#cbd5e1", label: "Pending" },
                  { color: "#fef3c7", stroke: "#f59e0b", label: "In Progress" },
                  { color: "#d1fae5", stroke: "#10b981", label: "Done" },
                  { color: "#fee2e2", stroke: "#ef4444", label: "Failed" },
                ].map((item, i) => (
                  <g key={i} transform={`translate(${i * 90}, 0)`}>
                    <rect width={10} height={10} rx={2} fill={item.color} stroke={item.stroke} strokeWidth={1} />
                    <text x={14} y={8} fill="#64748b" fontSize={9}>{item.label}</text>
                  </g>
                ))}
              </g>
            </svg>
          </div>

          {/* Execution Trace Panel */}
          <div className="border-t border-gray-200 px-6 py-3 bg-gray-50">
            <div className="mb-2 flex items-center justify-between">
              <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-gray-500">
                <span className="text-amber-500">›_</span> Execution Trace
                <span className="ml-2 rounded bg-gray-200 px-1.5 py-0.5 text-[10px] font-normal text-gray-500">
                  {executionTrace.length} events
                </span>
              </p>
              {executionTrace.length > 0 && (
                <a
                  href="https://smith.langchain.com/o/default/projects/p/foreign-worker-compliance"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-[10px] text-indigo-500 hover:text-indigo-700"
                >
                  <ExternalLink className="h-3 w-3" /> View in LangSmith
                </a>
              )}
            </div>
            <div className="max-h-40 overflow-y-auto rounded-lg border border-gray-200 bg-white p-3 space-y-2">
              {executionTrace.length === 0 ? (
                <p className="text-xs text-gray-400 italic">No trace events yet. Start a workflow to see real-time agent activity.</p>
              ) : (
                executionTrace.map((e, i) => {
                  const stepColor =
                    e.step === "running" ? "text-amber-600 bg-amber-50 border-amber-200"
                    : e.step === "done" ? "text-emerald-600 bg-emerald-50 border-emerald-200"
                    : "text-red-600 bg-red-50 border-red-200";
                  return (
                    <div key={i} className="flex items-start gap-2 text-xs">
                      <span className={`shrink-0 rounded border px-1.5 py-0.5 font-mono text-[10px] font-medium ${stepColor}`}>
                        {e.step === "done" ? "✓" : e.step === "running" ? "▶" : "✗"} {e.agent}
                      </span>
                      <span className="text-gray-700">{e.summary || e.msg}</span>
                      {e.timestamp && (
                        <span className="ml-auto shrink-0 text-[10px] text-gray-400">
                          {new Date(e.timestamp).toLocaleTimeString()}
                        </span>
                      )}
                    </div>
                  );
                })
              )}
              <div ref={traceEndRef} />
            </div>
          </div>
        </div>

        {/* HITL Chatbot sidebar */}
        {(chatTarget || hitlRequired) && (
          <div className="w-80 border-l border-gray-200">
            <HITLChatbot
              workerId={workerId}
              targetAgent={chatTarget || "supervisor"}
              onClose={() => { setChatTarget(null); setHitlRequired(false); }}
            />
          </div>
        )}
      </div>

      {/* Agent Detail Modal */}
      {selectedNode && (
        <AgentDetailModal
          agent={selectedNode.id}
          label={selectedNode.label}
          status={agentStatuses[selectedNode.id] || "pending"}
          trace={executionTrace.filter(e => e.agent === selectedNode.id)}
          onClose={() => setSelectedNode(null)}
          onDiscuss={handleDiscuss}
        />
      )}
    </div>
  );
}
