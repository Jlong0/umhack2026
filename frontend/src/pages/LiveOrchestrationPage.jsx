import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ExternalLink } from "lucide-react";
import AgentDetailModal from "@/components/AgentDetailModal";
import HITLChatbot from "@/components/HITLChatbot";
import { API_BASE_URL } from "@/services/api";

const WS_BASE = API_BASE_URL.replace(/^http/, "ws").replace(/\/+$/, "");

/*
 * ══════════════════════════════════════════════════════════════════════
 *  Compliance Graph — matches app/agents/graph.py  _build_legacy_graph
 *
 *  route_supervisor logic:
 *    init             → auditor
 *    gate_1_jtksm     → company_audit
 *    docs_validated   → strategist
 *    gate_2_kdn       → vdr_filing
 *    gate_3_jim       → plks_monitor
 *    strategy_done    → filing
 *    deadlock         → hitl
 *    complete/error   → END
 *
 *  All agents return → supervisor
 *  HITL → supervisor (if resolved) or END
 * ══════════════════════════════════════════════════════════════════════
 */

// ── Node positions (3-row hub-and-spoke) ──────────────────────────────
const NODES = [
  { id: "supervisor",    label: "Supervisor",     cx: 350, cy: 45,  desc: "Central router" },
  { id: "auditor",       label: "Auditor",        cx: 100, cy: 165, desc: "Document & passport audit" },
  { id: "strategist",    label: "Strategist",     cx: 350, cy: 165, desc: "Levy & deadlock analysis" },
  { id: "plks_monitor",  label: "PLKS Monitor",   cx: 600, cy: 165, desc: "FOMEMA & PLKS gates" },
  { id: "company_audit", label: "Company Audit",  cx: 100, cy: 285, desc: "JTKSM Section 60K" },
  { id: "vdr_filing",    label: "VDR Filing",     cx: 350, cy: 285, desc: "VDR prerequisites" },
  { id: "filing",        label: "Filing",         cx: 600, cy: 285, desc: "Permit renewal package" },
  { id: "hitl",          label: "HITL Review",    cx: 350, cy: 385, desc: "Human-in-the-loop" },
];

// ── Edges — one solid line per connection ─────────────────────────────
const EDGES = [
  { from: "supervisor", to: "auditor" },
  { from: "supervisor", to: "strategist" },
  { from: "supervisor", to: "plks_monitor" },
  { from: "auditor", to: "company_audit" },
  { from: "strategist", to: "vdr_filing" },
  { from: "plks_monitor", to: "filing" },
  { from: "vdr_filing", to: "hitl" },
];

const NODE_W = 130, NODE_H = 44, NODE_RX = 12;

// ── Visual styles ────────────────────────────────────────────────────
function nodeStyle(status) {
  if (status === "running") return { fill: "#fef3c7", stroke: "#f59e0b", text: "#92400e", badge: "#d97706", shadow: "rgba(245,158,11,0.25)" };
  if (status === "done")    return { fill: "#d1fae5", stroke: "#10b981", text: "#065f46", badge: "#059669", shadow: "rgba(16,185,129,0.25)" };
  if (status === "failed")  return { fill: "#fee2e2", stroke: "#ef4444", text: "#991b1b", badge: "#dc2626", shadow: "rgba(239,68,68,0.25)" };
  return { fill: "#f8fafc", stroke: "#e2e8f0", text: "#475569", badge: "#94a3b8", shadow: "none" };
}

function statusLabel(s) {
  if (s === "running") return "IN PROGRESS";
  if (s === "done")    return "DONE ✓";
  if (s === "failed")  return "FAILED ✗";
  return "PENDING";
}

// Determine edge color based on BOTH connected nodes
function edgeColor(fromStatus, toStatus) {
  if (fromStatus === "running" || toStatus === "running") return "#f59e0b";
  if (fromStatus === "done" && toStatus === "done") return "#10b981";
  if (fromStatus === "done" || toStatus === "done") return "#86efac";
  return "#e2e8f0";
}

// ══════════════════════════════════════════════════════════════════════
export default function LiveOrchestrationPage() {
  const { workerId } = useParams();
  const navigate = useNavigate();
  const [agentStatuses, setAgentStatuses] = useState({});
  const [executionTrace, setExecutionTrace] = useState([]);
  const [workflowStage, setWorkflowStage] = useState("init");
  const [currentGate, setCurrentGate] = useState(null);
  const [workflowStatusText, setWorkflowStatusText] = useState(null);
  const [workflowComplete, setWorkflowComplete] = useState(false);
  const [wsStatus, setWsStatus] = useState("connecting");
  const [selectedNode, setSelectedNode] = useState(null);
  const [chatTarget, setChatTarget] = useState(null);
  const [hitlRequired, setHitlRequired] = useState(false);
  const traceEndRef = useRef(null);

  // ── Firestore recovery on mount ──
  useEffect(() => {
    if (!workerId) return;
    fetch(`${API_BASE_URL}/workflows/${workerId}/trace`)
      .then(r => r.json())
      .then(data => {
        if (data.agent_statuses && Object.keys(data.agent_statuses).length > 0) {
          setAgentStatuses(data.agent_statuses);
        }

        if (data.execution_trace?.length > 0) {
          setExecutionTrace(data.execution_trace);
        }

        if (data.workflow_stage) setWorkflowStage(data.workflow_stage);
        if (data.current_gate) setCurrentGate(data.current_gate);
        if (data.workflow_status) setWorkflowStatusText(data.workflow_status);
        setWorkflowComplete(Boolean(data.workflow_complete));
      })
      .catch(() => {});
  }, [workerId]);

  // ── WebSocket live updates ──
  useEffect(() => {
    const ws = new WebSocket(`${WS_BASE}/ws/dashboard`);
    ws.onopen  = () => setWsStatus("live");
    ws.onclose = () => setWsStatus("disconnected");
    ws.onerror = () => setWsStatus("error");
    ws.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.worker_id !== workerId || data.type !== "agent_event") return;
        setAgentStatuses(data.agent_statuses);
        setExecutionTrace(data.execution_trace || []);
        setWorkflowStage(data.workflow_stage || "init");

        if (data.current_gate) setCurrentGate(data.current_gate);
        if (data.workflow_status) setWorkflowStatusText(data.workflow_status);
        if (typeof data.workflow_complete === "boolean") {
          setWorkflowComplete(data.workflow_complete);
        }

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
    workflowComplete ? "DONE"
    : Object.values(agentStatuses).includes("running") ? "RUNNING"
    : Object.values(agentStatuses).includes("failed") ? "FAILED"
    : workflowStage === "ready_to_complete" ? "DONE"
    : Object.values(agentStatuses).some(s => s === "done") ? "RUNNING"
    : "PENDING";

  const statusColor = workflowStatus === "RUNNING" ? "#d97706"
    : workflowStatus === "DONE" ? "#059669"
    : workflowStatus === "FAILED" ? "#dc2626"
    : "#94a3b8";

  return (
    <div className="flex h-full flex-col bg-white text-gray-800" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
      {/* ── Header ── */}
      <div className="flex items-center justify-between border-b border-gray-200 px-6 py-3">
        <div>
          <h1 className="text-lg font-bold text-gray-900">Live Orchestration</h1>
          <p className="mt-0.5 text-xs text-gray-500">
            Workflow:{" "}
            <span className="font-semibold" style={{ color: statusColor }}>
              ● {workflowStatus}
            </span>

            {workerId && (
              <span className="ml-2 font-mono text-gray-400">
                {workerId}
              </span>
            )}

            <span className="ml-2 text-gray-400">|</span>

            <span className="ml-2">
              Gate:{" "}
              <span className="font-semibold text-gray-700">
                {currentGate || workflowStage || "unknown"}
              </span>
            </span>

            <span className="ml-2">
              Status:{" "}
              <span className="font-semibold text-gray-700">
                {workflowStatusText || "unknown"}
              </span>
            </span>
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className={`rounded-full px-3 py-1 text-xs font-medium ${wsStatus === "live" ? "bg-emerald-50 text-emerald-600 border border-emerald-200" : "bg-gray-100 text-gray-500 border border-gray-200"}`}>
            ● WS {wsStatus.toUpperCase()}
          </span>
          <button onClick={() => navigate(-1)} className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs text-gray-500 hover:bg-gray-50 hover:text-gray-800 transition-colors">
            ← Back
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* ── Graph + Trace ── */}
        <div className="flex flex-1 flex-col">

          {/* ── SVG Compliance Graph ── */}
          <div className="flex flex-1 items-center justify-center px-6 py-4">
            <svg viewBox="0 0 700 430" className="w-full max-w-3xl" style={{ maxHeight: 420 }}>

              {/* Edges — solid lines, no arrows */}
              {EDGES.map(({ from, to }) => {
                const s = NODES.find(n => n.id === from);
                const d = NODES.find(n => n.id === to);
                const color = edgeColor(agentStatuses[from], agentStatuses[to]);
                const isActive = agentStatuses[from] === "running" || agentStatuses[to] === "running";
                return (
                  <line
                    key={`${from}-${to}`}
                    x1={s.cx} y1={s.cy + NODE_H / 2}
                    x2={d.cx} y2={d.cy - NODE_H / 2}
                    stroke={color}
                    strokeWidth={isActive ? 2.5 : 1.5}
                    strokeLinecap="round"
                  >
                    {isActive && (
                      <animate attributeName="stroke-width" values="1.5;3;1.5" dur="1.5s" repeatCount="indefinite" />
                    )}
                  </line>
                );
              })}

              {/* Nodes */}
              {NODES.map((node) => {
                const status = agentStatuses[node.id] || "pending";
                const st = nodeStyle(status);
                const isRunning = status === "running";
                const x = node.cx - NODE_W / 2;
                const y = node.cy - NODE_H / 2;
                return (
                  <g key={node.id} style={{ cursor: "pointer" }} onClick={() => handleNodeClick(node)}>
                    {/* Glow ring for active nodes */}
                    {isRunning && (
                      <rect x={x - 4} y={y - 4} width={NODE_W + 8} height={NODE_H + 8}
                        rx={NODE_RX + 3} fill="none" stroke={st.stroke} strokeWidth={2.5} opacity={0.5}>
                        <animate attributeName="opacity" values="0.2;0.7;0.2" dur="1.4s" repeatCount="indefinite" />
                      </rect>
                    )}
                    {/* Node background */}
                    <rect x={x} y={y} width={NODE_W} height={NODE_H}
                      rx={NODE_RX} fill={st.fill} stroke={st.stroke} strokeWidth={1.5} />
                    {/* Node label */}
                    <text x={node.cx} y={node.cy - 2} textAnchor="middle"
                      fill={st.text} fontSize={11} fontWeight="600" fontFamily="Inter, system-ui, sans-serif">
                      {node.label}
                    </text>
                    {/* Status text */}
                    <text x={node.cx} y={node.cy + 13} textAnchor="middle"
                      fill={st.badge} fontSize={7.5} fontWeight="500" letterSpacing="0.5" fontFamily="Inter, system-ui, sans-serif">
                      {statusLabel(status)}
                    </text>
                  </g>
                );
              })}

              {/* Legend */}
              <g transform="translate(10, 415)">
                {[
                  { fill: "#f8fafc", stroke: "#e2e8f0", label: "Pending" },
                  { fill: "#fef3c7", stroke: "#f59e0b", label: "In Progress" },
                  { fill: "#d1fae5", stroke: "#10b981", label: "Done" },
                  { fill: "#fee2e2", stroke: "#ef4444", label: "Failed" },
                ].map((item, i) => (
                  <g key={i} transform={`translate(${i * 100}, 0)`}>
                    <rect width={10} height={10} rx={3} fill={item.fill} stroke={item.stroke} strokeWidth={1} />
                    <text x={14} y={8} fill="#64748b" fontSize={9} fontFamily="Inter, system-ui, sans-serif">{item.label}</text>
                  </g>
                ))}
              </g>
            </svg>
          </div>

          {/* ── Execution Trace ── */}
          <div className="border-t border-gray-200 px-6 py-3 bg-gray-50/80">
            <div className="mb-2 flex items-center justify-between">
              <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-gray-500">
                <span className="text-amber-500">›_</span> Execution Trace
                <span className="ml-2 rounded-full bg-gray-200 px-2 py-0.5 text-[10px] font-normal text-gray-500">
                  {executionTrace.length}
                </span>
              </p>
              {executionTrace.length > 0 && (
                <a href="https://smith.langchain.com/o/default/projects/p/foreign-worker-compliance"
                  target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1 text-[10px] text-indigo-500 hover:text-indigo-700 transition-colors">
                  <ExternalLink className="h-3 w-3" /> LangSmith
                </a>
              )}
            </div>
            <div className="max-h-40 overflow-y-auto rounded-lg border border-gray-200 bg-white p-3 space-y-1.5">
              {executionTrace.length === 0 ? (
                <p className="text-xs text-gray-400 italic">No events yet — start a workflow to see agent activity.</p>
              ) : (
                executionTrace.map((e, i) => {
                  const sc = e.step === "running" ? "text-amber-600 bg-amber-50 border-amber-200"
                    : e.step === "done" ? "text-emerald-600 bg-emerald-50 border-emerald-200"
                    : "text-red-600 bg-red-50 border-red-200";
                  const icon = e.step === "done" ? "✓" : e.step === "running" ? "▶" : "✗";
                  return (
                    <div key={i} className="flex items-start gap-2 text-xs">
                      <span className={`shrink-0 rounded border px-1.5 py-0.5 font-mono text-[10px] font-medium ${sc}`}>
                        {icon} {e.agent}
                      </span>
                      <span className="text-gray-600">{e.summary || e.msg}</span>
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

        {/* ── HITL Chatbot sidebar ── */}
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

      {/* ── Agent Detail Modal ── */}
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
