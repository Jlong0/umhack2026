import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import AgentDetailModal from "@/components/AgentDetailModal";
import HITLChatbot from "@/components/HITLChatbot";

const WS_BASE = (import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8001")
  .replace(/^http/, "ws").replace(/\/+$/, "");

// DAG layout: node positions in a 700×420 SVG viewBox
const NODES = [
  { id: "supervisor",    label: "Supervisor",     x: 310, y: 30  },
  { id: "auditor",       label: "Auditor",         x: 80,  y: 140 },
  { id: "company_audit", label: "Company Audit",   x: 80,  y: 260 },
  { id: "strategist",    label: "Strategist",      x: 310, y: 140 },
  { id: "vdr_filing",    label: "VDR Filing",      x: 310, y: 260 },
  { id: "plks_monitor",  label: "PLKS Monitor",    x: 540, y: 140 },
  { id: "filing",        label: "Filing",          x: 540, y: 260 },
  { id: "hitl",          label: "HITL Review",     x: 310, y: 370 },
];

const EDGES = [
  ["supervisor", "auditor"],
  ["supervisor", "strategist"],
  ["supervisor", "plks_monitor"],
  ["auditor",    "company_audit"],
  ["strategist", "vdr_filing"],
  ["vdr_filing", "hitl"],
  ["plks_monitor","filing"],
  ["supervisor", "hitl"],
];

const NODE_W = 110, NODE_H = 36;

function nodeColor(status) {
  if (status === "running") return { fill: "#0d9488", stroke: "#14b8a6", text: "#fff" };
  if (status === "done")    return { fill: "#134e4a", stroke: "#0d9488", text: "#5eead4" };
  if (status === "failed")  return { fill: "#450a0a", stroke: "#ef4444", text: "#fca5a5" };
  return { fill: "#1e293b", stroke: "#334155", text: "#94a3b8" };
}

function edgeActive(src, statuses) {
  return statuses[src] === "running";
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

  useEffect(() => {
    const ws = new WebSocket(`${WS_BASE}/ws/dashboard`);
    ws.onopen = () => setWsStatus("live");
    ws.onclose = () => setWsStatus("disconnected");
    ws.onerror = () => setWsStatus("error");
    ws.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.worker_id !== workerId || data.type !== "agent_event") return;
        setAgentStatuses(data.agent_statuses || {});
        setExecutionTrace(data.execution_trace || []);
        setWorkflowStage(data.workflow_stage || "init");
        if (data.agent_statuses?.hitl === "running") setHitlRequired(true);
      } catch {}
    };
    return () => ws.close();
  }, [workerId]);

  const handleNodeClick = useCallback((node) => setSelectedNode(node), []);
  const handleDiscuss = useCallback((agentId) => {
    setChatTarget(agentId);
    setSelectedNode(null);
  }, []);

  const workflowStatus = agentStatuses.supervisor === "running" || Object.values(agentStatuses).includes("running")
    ? "RUNNING"
    : Object.values(agentStatuses).includes("failed") ? "FAILED"
    : workflowStage === "ready_to_complete" ? "DONE"
    : "PENDING";

  return (
    <div className="flex h-full flex-col bg-[#0f172a] text-slate-100">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800 px-6 py-3">
        <div>
          <h1 className="text-lg font-semibold">Live Orchestration</h1>
          <p className="text-xs text-slate-400">
            Workflow:{" "}
            <span className={workflowStatus === "RUNNING" ? "text-amber-400" : workflowStatus === "DONE" ? "text-teal-400" : "text-slate-400"}>
              ● {workflowStatus}
            </span>
            {workerId && <span className="ml-2 font-mono text-slate-500">{workerId}</span>}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className={`rounded-full px-3 py-1 text-xs font-medium ${wsStatus === "live" ? "bg-teal-900 text-teal-300" : "bg-slate-800 text-slate-400"}`}>
            ● SSE {wsStatus.toUpperCase()}
          </span>
          <button onClick={() => navigate(-1)} className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200">
            ← Back
          </button>
        </div>
      </div>

      {/* DAG + chatbot layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* DAG */}
        <div className="flex flex-1 items-center justify-center p-6">
          <svg viewBox="0 0 700 430" className="w-full max-w-2xl" style={{ maxHeight: 420 }}>
            {/* Edges */}
            {EDGES.map(([src, dst]) => {
              const s = NODES.find(n => n.id === src);
              const d = NODES.find(n => n.id === dst);
              const active = edgeActive(src, agentStatuses);
              return (
                <line
                  key={`${src}-${dst}`}
                  x1={s.x + NODE_W / 2} y1={s.y + NODE_H}
                  x2={d.x + NODE_W / 2} y2={d.y}
                  stroke={active ? "#14b8a6" : "#334155"}
                  strokeWidth={active ? 2 : 1}
                  strokeDasharray={active ? "6 3" : "4 4"}
                  opacity={active ? 1 : 0.5}
                >
                  {active && (
                    <animate attributeName="stroke-dashoffset" from="0" to="-18" dur="0.6s" repeatCount="indefinite" />
                  )}
                </line>
              );
            })}

            {/* Nodes */}
            {NODES.map((node) => {
              const status = agentStatuses[node.id] || "pending";
              const c = nodeColor(status);
              const isRunning = status === "running";
              return (
                <g key={node.id} style={{ cursor: "pointer" }} onClick={() => handleNodeClick(node)}>
                  {isRunning && (
                    <rect x={node.x - 3} y={node.y - 3} width={NODE_W + 6} height={NODE_H + 6}
                      rx={10} fill="none" stroke="#14b8a6" strokeWidth={2} opacity={0.4}>
                      <animate attributeName="opacity" values="0.4;0.9;0.4" dur="1.2s" repeatCount="indefinite" />
                    </rect>
                  )}
                  <rect x={node.x} y={node.y} width={NODE_W} height={NODE_H}
                    rx={8} fill={c.fill} stroke={c.stroke} strokeWidth={1.5} />
                  <text x={node.x + NODE_W / 2} y={node.y + 14} textAnchor="middle"
                    fill={c.text} fontSize={11} fontWeight="600">{node.label}</text>
                  <text x={node.x + NODE_W / 2} y={node.y + 27} textAnchor="middle"
                    fill={c.text} fontSize={9} opacity={0.7}>
                    {status === "pending" ? "PENDING" : status === "running" ? "RUNNING..." : status === "done" ? "DONE" : "FAILED"}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>

        {/* Chatbot panel */}
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

      {/* Execution trace footer */}
      {executionTrace.length > 0 && (
        <div className="border-t border-slate-800 px-6 py-2 text-xs text-slate-500 overflow-x-auto whitespace-nowrap">
          {executionTrace.slice(-5).map((e, i) => (
            <span key={i} className="mr-4">
              <span className="text-teal-500">[{e.agent}]</span> {e.msg}
            </span>
          ))}
        </div>
      )}

      {/* Node detail modal */}
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
