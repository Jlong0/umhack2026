import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ExternalLink, RotateCw } from "lucide-react";
import AgentDetailModal from "@/components/AgentDetailModal";
import HITLChatbot from "@/components/HITLChatbot";
import { API_BASE_URL } from "@/services/api";

const WS_BASE = API_BASE_URL.replace(/^http/, "ws").replace(/\/+$/, "");

// ── Graph layout ──────────────────────────────────────────────────────────────
const NODES = [
  { id: "supervisor",    label: "Supervisor",     x: 310, y: 30,  role: "Routes the workflow between agents" },
  { id: "auditor",       label: "Auditor",        x: 80,  y: 150, role: "Checks documents & passport validity" },
  { id: "company_audit", label: "Company Audit",  x: 80,  y: 270, role: "Verifies JTKSM, Act 446, quota" },
  { id: "strategist",    label: "Strategist",     x: 310, y: 150, role: "Calculates levy & deadlock risk" },
  { id: "vdr_filing",    label: "VDR Filing",     x: 310, y: 270, role: "Checks VDR prerequisites" },
  { id: "plks_monitor",  label: "PLKS Monitor",   x: 540, y: 150, role: "Tracks post-arrival gates" },
  { id: "filing",        label: "Filing",         x: 540, y: 270, role: "Prepares renewal package" },
  { id: "hitl",          label: "HITL Review",    x: 310, y: 390, role: "Human decision required" },
];

// Regular edges (straight lines)
const EDGES = [
  // Supervisor → agents
  { from: "supervisor", to: "auditor" },
  { from: "supervisor", to: "strategist" },
  { from: "supervisor", to: "plks_monitor" },
  // Agents → sub-agents
  { from: "auditor",       to: "company_audit" },
  { from: "strategist",    to: "vdr_filing" },
  { from: "plks_monitor",  to: "filing" },
];

const NODE_W = 120, NODE_H = 40;

function nodeColor(status) {
  if (status === "running") return { fill: "#92400e", stroke: "#f59e0b", text: "#fde68a", glow: "#f59e0b" };  // yellow
  if (status === "done")    return { fill: "#064e3b", stroke: "#10b981", text: "#6ee7b7", glow: "#10b981" };  // green
  if (status === "failed")  return { fill: "#450a0a", stroke: "#ef4444", text: "#fca5a5", glow: "#ef4444" };  // red
  return { fill: "#1e293b", stroke: "#334155", text: "#94a3b8", glow: null };                                 // grey (pending)
}

function statusLabel(status) {
  if (status === "running") return "IN PROGRESS";
  if (status === "done")    return "DONE ✓";
  if (status === "failed")  return "FAILED ✗";
  return "PENDING";
}

// Helper: build a curved SVG path between two nodes (offset to side)
function curvedPath(s, d, offsetX) {
  const x1 = s.x + NODE_W / 2 + offsetX;
  const y1 = s.y + NODE_H;
  const x2 = d.x + NODE_W / 2 + offsetX;
  const y2 = d.y;
  const midY = (y1 + y2) / 2;
  const cpx = x1 + offsetX * 3;  // control point curves outward
  return `M ${x1} ${y1} Q ${cpx} ${midY} ${x2} ${y2}`;
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

  // Load persisted trace from Firestore on mount (page reload recovery)
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
        // Merge — never lose a "done" status
        setAgentStatuses(prev => {
          const merged = { ...prev };
          for (const [k, v] of Object.entries(data.agent_statuses || {})) {
            if (prev[k] === "done" && v === "running") continue; // don't regress
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

  // Auto-scroll trace panel
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

  const statusDot = workflowStatus === "RUNNING" ? "text-amber-400"
    : workflowStatus === "DONE" ? "text-emerald-400"
    : workflowStatus === "FAILED" ? "text-red-400"
    : "text-slate-500";

  // Pre-compute HITL ↔ Supervisor edge states
  const supNode = NODES.find(n => n.id === "supervisor");
  const hitlNode = NODES.find(n => n.id === "hitl");
  const supStatus = agentStatuses["supervisor"];
  const hitlStatus = agentStatuses["hitl"];

  return (
    <div className="flex h-full flex-col bg-[#0f172a] text-slate-100">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800 px-6 py-3">
        <div>
          <h1 className="text-lg font-semibold">Live Orchestration</h1>
          <p className="text-xs text-slate-400">
            Workflow:{" "}
            <span className={statusDot}>● {workflowStatus}</span>
            {workerId && <span className="ml-2 font-mono text-slate-500">{workerId}</span>}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className={`rounded-full px-3 py-1 text-xs font-medium ${wsStatus === "live" ? "bg-teal-900 text-teal-300" : "bg-slate-800 text-slate-400"}`}>
            ● WS {wsStatus.toUpperCase()}
          </span>
          <button onClick={() => navigate(-1)} className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200">
            ← Back
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Graph + Trace */}
        <div className="flex flex-1 flex-col">
          {/* SVG Graph */}
          <div className="flex flex-1 items-center justify-center p-6">
            <svg viewBox="0 0 720 460" className="w-full max-w-2xl" style={{ maxHeight: 440 }}>
              <defs>
                <marker id="arrowhead" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
                  <polygon points="0 0, 8 3, 0 6" fill="#475569" />
                </marker>
                <marker id="arrowhead-active" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
                  <polygon points="0 0, 8 3, 0 6" fill="#f59e0b" />
                </marker>
                <marker id="arrowhead-done" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
                  <polygon points="0 0, 8 3, 0 6" fill="#10b981" />
                </marker>
                <marker id="arrowhead-hitl" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
                  <polygon points="0 0, 8 3, 0 6" fill="#818cf8" />
                </marker>
              </defs>

              {/* Regular straight edges */}
              {EDGES.map(({ from, to }) => {
                const s = NODES.find(n => n.id === from);
                const d = NODES.find(n => n.id === to);
                const srcStatus = agentStatuses[from];
                const active = srcStatus === "running";
                const done = srcStatus === "done";
                const edgeColor = active ? "#f59e0b" : done ? "#10b981" : "#334155";
                const marker = active ? "url(#arrowhead-active)" : done ? "url(#arrowhead-done)" : "url(#arrowhead)";
                return (
                  <line
                    key={`${from}-${to}`}
                    x1={s.x + NODE_W / 2} y1={s.y + NODE_H}
                    x2={d.x + NODE_W / 2} y2={d.y}
                    stroke={edgeColor}
                    strokeWidth={active ? 2.5 : 1}
                    strokeDasharray={active ? "6 3" : "4 4"}
                    opacity={active || done ? 1 : 0.5}
                    markerEnd={marker}
                  >
                    {active && (
                      <animate attributeName="stroke-dashoffset" from="0" to="-18" dur="0.6s" repeatCount="indefinite" />
                    )}
                  </line>
                );
              })}

              {/* ═══ HITL ↔ Supervisor — special bidirectional curved edges ═══ */}
              {/* Supervisor → HITL (left curve) */}
              <path
                d={curvedPath(supNode, hitlNode, -15)}
                fill="none"
                stroke={supStatus === "running" ? "#f59e0b" : supStatus === "done" ? "#10b981" : "#818cf8"}
                strokeWidth={supStatus === "running" ? 2.5 : 2}
                strokeDasharray={supStatus === "running" ? "6 3" : "5 3"}
                opacity={supStatus === "running" || supStatus === "done" ? 1 : 0.7}
                markerEnd={supStatus === "running" ? "url(#arrowhead-active)" : supStatus === "done" ? "url(#arrowhead-done)" : "url(#arrowhead-hitl)"}
              >
                {supStatus === "running" && (
                  <animate attributeName="stroke-dashoffset" from="0" to="-18" dur="0.6s" repeatCount="indefinite" />
                )}
              </path>
              {/* Label on left curve */}
              <text x={supNode.x + NODE_W / 2 - 60} y={(supNode.y + NODE_H + hitlNode.y) / 2}
                fill="#818cf8" fontSize={8} opacity={0.7} textAnchor="middle">Supervisor → HITL</text>

              {/* HITL → Supervisor (right curve — return path) */}
              <path
                d={curvedPath(hitlNode, supNode, 15)}
                fill="none"
                stroke={hitlStatus === "running" ? "#f59e0b" : hitlStatus === "done" ? "#10b981" : "#818cf8"}
                strokeWidth={hitlStatus === "running" ? 2.5 : 2}
                strokeDasharray={hitlStatus === "running" ? "6 3" : "5 3"}
                opacity={hitlStatus === "running" || hitlStatus === "done" ? 1 : 0.7}
                markerEnd={hitlStatus === "running" ? "url(#arrowhead-active)" : hitlStatus === "done" ? "url(#arrowhead-done)" : "url(#arrowhead-hitl)"}
              >
                {hitlStatus === "running" && (
                  <animate attributeName="stroke-dashoffset" from="0" to="-18" dur="0.6s" repeatCount="indefinite" />
                )}
              </path>
              {/* Label on right curve */}
              <text x={supNode.x + NODE_W / 2 + 60} y={(supNode.y + NODE_H + hitlNode.y) / 2}
                fill="#818cf8" fontSize={8} opacity={0.7} textAnchor="middle">HITL → Supervisor</text>

              {NODES.map((node) => {
                const status = agentStatuses[node.id] || "pending";
                const c = nodeColor(status);
                const isRunning = status === "running";
                return (
                  <g key={node.id} style={{ cursor: "pointer" }} onClick={() => handleNodeClick(node)}>
                    {/* Glow effect for active/done */}
                    {c.glow && (
                      <rect x={node.x - 3} y={node.y - 3} width={NODE_W + 6} height={NODE_H + 6}
                        rx={12} fill="none" stroke={c.glow} strokeWidth={2} opacity={isRunning ? 0.6 : 0.3}>
                        {isRunning && (
                          <animate attributeName="opacity" values="0.3;0.8;0.3" dur="1.2s" repeatCount="indefinite" />
                        )}
                      </rect>
                    )}
                    <rect x={node.x} y={node.y} width={NODE_W} height={NODE_H}
                      rx={8} fill={c.fill} stroke={c.stroke} strokeWidth={1.5} />
                    <text x={node.x + NODE_W / 2} y={node.y + 16} textAnchor="middle"
                      fill={c.text} fontSize={11} fontWeight="600">{node.label}</text>
                    <text x={node.x + NODE_W / 2} y={node.y + 30} textAnchor="middle"
                      fill={c.text} fontSize={8} opacity={0.8}>
                      {statusLabel(status)}
                    </text>
                  </g>
                );
              })}

              {/* Legend */}
              <g transform="translate(10, 435)">
                <rect x={0} y={0} width={8} height={8} rx={2} fill="#334155" />
                <text x={12} y={7} fill="#64748b" fontSize={8}>Pending</text>
                <rect x={60} y={0} width={8} height={8} rx={2} fill="#f59e0b" />
                <text x={72} y={7} fill="#64748b" fontSize={8}>In Progress</text>
                <rect x={140} y={0} width={8} height={8} rx={2} fill="#10b981" />
                <text x={152} y={7} fill="#64748b" fontSize={8}>Done</text>
                <rect x={190} y={0} width={8} height={8} rx={2} fill="#ef4444" />
                <text x={202} y={7} fill="#64748b" fontSize={8}>Failed</text>
              </g>
            </svg>
          </div>

          {/* Execution Trace Panel */}
          <div className="border-t border-slate-800 px-6 py-3">
            <div className="mb-2 flex items-center justify-between">
              <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
                <span className="text-amber-500">›_</span> Execution Trace
                <span className="ml-2 rounded bg-slate-800 px-1.5 py-0.5 text-[10px] font-normal text-slate-500">
                  {executionTrace.length} events
                </span>
              </p>
              {executionTrace.length > 0 && (
                <a
                  href={`https://smith.langchain.com/o/default/projects/p/foreign-worker-compliance`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-[10px] text-indigo-400 hover:text-indigo-300"
                >
                  <ExternalLink className="h-3 w-3" /> View in LangSmith
                </a>
              )}
            </div>
            <div className="max-h-44 overflow-y-auto rounded-lg bg-slate-950/80 p-3 space-y-2">
              {executionTrace.length === 0 ? (
                <p className="text-xs text-slate-600 italic">No trace events yet. Start a workflow to see real-time agent activity.</p>
              ) : (
                executionTrace.map((e, i) => {
                  const stepColor =
                    e.step === "running" ? "text-amber-400 bg-amber-950/50"
                    : e.step === "done" ? "text-emerald-400 bg-emerald-950/50"
                    : "text-red-400 bg-red-950/50";
                  return (
                    <div key={i} className="flex items-start gap-2 text-xs">
                      <span className={`shrink-0 rounded px-1.5 py-0.5 font-mono text-[10px] font-medium ${stepColor}`}>
                        {e.step === "done" ? "✓" : e.step === "running" ? "▶" : "✗"} {e.agent}
                      </span>
                      <span className="text-slate-300">{e.summary || e.msg}</span>
                      {e.timestamp && (
                        <span className="ml-auto shrink-0 text-[10px] text-slate-600">
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
          <div className="w-80 border-l border-slate-800">
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
