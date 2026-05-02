import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useWorkflowStatus, useResumeWorkflow } from "@/hooks/queries/useWorkflowQueries";
import { ArrowLeft, AlertCircle, CheckCircle, XCircle, Loader, Circle } from "lucide-react";
import AgentDetailModal from "@/components/AgentDetailModal";
import { useChatStore } from "@/store/useChatStore";
import { GATE_LABELS } from "@/types/worker";

const WS_BASE = (import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8001")
  .replace(/^http/, "ws").replace(/\/+$/, "");

const normalizeGate = (raw) => {
  if (!raw) return "JTKSM";
  const upper = raw.toUpperCase().replace(/\s+/g, "_");
  if (upper.includes("JTKSM") || upper === "GATE_1_JTKSM") return "JTKSM";
  if (upper.includes("VDR")) return "VDR_PENDING";
  if (upper.includes("TRANSIT")) return "TRANSIT";
  if (upper.includes("FOMEMA")) return "FOMEMA";
  if (upper.includes("PLKS")) return "PLKS_ENDORSE";
  if (upper.includes("ACTIVE")) return "ACTIVE";
  return upper;
};

// ── DAG layout ──────────────────────────────────────────────────────────────
const NODES = [
  { id: "supervisor",    label: "Supervisor",       x: 310, y: 30  },
  { id: "auditor",       label: "Auditor",           x: 80,  y: 140 },
  { id: "company_audit", label: "Company Audit",     x: 80,  y: 260 },
  { id: "strategist",    label: "Strategist",        x: 310, y: 140 },
  { id: "vdr_filing",    label: "VDR Filing",        x: 310, y: 260 },
  { id: "plks_monitor",  label: "PLKS Monitor",      x: 540, y: 140 },
  { id: "filing",        label: "Filing",            x: 540, y: 260 },
  { id: "hitl",          label: "HITL Review",       x: 310, y: 370 },
];
const EDGES = [
  ["supervisor","auditor"],["supervisor","strategist"],["supervisor","plks_monitor"],
  ["auditor","company_audit"],["strategist","vdr_filing"],["vdr_filing","hitl"],
  ["plks_monitor","filing"],["supervisor","hitl"],
];
const NW = 110, NH = 36;

function nodeColor(status) {
  if (status === "running") return { fill: "#0d9488", stroke: "#14b8a6", text: "#fff" };
  if (status === "done")    return { fill: "#134e4a", stroke: "#0d9488", text: "#5eead4" };
  if (status === "failed")  return { fill: "#450a0a", stroke: "#ef4444", text: "#fca5a5" };
  return { fill: "#f8fafc", stroke: "#cbd5e1", text: "#64748b" };
}

function LiveDAG({ agentStatuses, onNodeClick }) {
  return (
    <svg viewBox="0 0 700 430" className="w-full" style={{ maxHeight: 380 }}>
      {EDGES.map(([src, dst]) => {
        const s = NODES.find(n => n.id === src);
        const d = NODES.find(n => n.id === dst);
        const active = agentStatuses[src] === "running";
        return (
          <line key={`${src}-${dst}`}
            x1={s.x + NW/2} y1={s.y + NH} x2={d.x + NW/2} y2={d.y}
            stroke={active ? "#14b8a6" : "#cbd5e1"}
            strokeWidth={active ? 2 : 1}
            strokeDasharray={active ? "6 3" : "4 4"}
            opacity={active ? 1 : 0.6}
          >
            {active && <animate attributeName="stroke-dashoffset" from="0" to="-18" dur="0.6s" repeatCount="indefinite" />}
          </line>
        );
      })}
      {NODES.map((node) => {
        const status = agentStatuses[node.id] || "pending";
        const c = nodeColor(status);
        return (
          <g key={node.id} style={{ cursor: "pointer" }} onClick={() => onNodeClick(node)}>
            {status === "running" && (
              <rect x={node.x-3} y={node.y-3} width={NW+6} height={NH+6} rx={10}
                fill="none" stroke="#14b8a6" strokeWidth={2} opacity={0.4}>
                <animate attributeName="opacity" values="0.4;0.9;0.4" dur="1.2s" repeatCount="indefinite" />
              </rect>
            )}
            <rect x={node.x} y={node.y} width={NW} height={NH} rx={8}
              fill={c.fill} stroke={c.stroke} strokeWidth={1.5} />
            <text x={node.x+NW/2} y={node.y+14} textAnchor="middle" fill={c.text} fontSize={11} fontWeight="600">{node.label}</text>
            <text x={node.x+NW/2} y={node.y+27} textAnchor="middle" fill={c.text} fontSize={9} opacity={0.7}>
              {status === "running" ? "RUNNING..." : status === "done" ? "DONE" : status === "failed" ? "FAILED" : "PENDING"}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ── Trace section ────────────────────────────────────────────────────────────
const TRACE_ICON = {
  completed: <CheckCircle className="h-4 w-4 text-emerald-500 shrink-0" />,
  failed:    <XCircle className="h-4 w-4 text-red-500 shrink-0" />,
  running:   <Loader className="h-4 w-4 text-amber-500 animate-spin shrink-0" />,
};

function TraceSection({ trace }) {
  if (!trace?.length) return null;
  const seen = new Map();
  for (const e of trace) seen.set(e.node, e);
  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
      <h2 className="text-base font-semibold text-foreground mb-4">Execution Trace</h2>
      <div className="space-y-2">
        {[...seen.values()].map((e, i) => (
          <div key={i} className="flex items-start gap-3 rounded-lg border border-gray-100 bg-gray-50 px-4 py-2.5">
            {TRACE_ICON[e.status] || <Circle className="h-4 w-4 text-gray-300 shrink-0" />}
            <div className="flex-1 min-w-0">
              <span className="text-sm font-mono font-medium text-gray-900">{e.node}</span>
              {e.output_summary && <p className="text-xs text-gray-500 mt-0.5">{e.output_summary}</p>}
              {e.error && <p className="text-xs text-red-600 mt-0.5 font-mono">{e.error}</p>}
            </div>
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
              e.status === "completed" ? "bg-emerald-50 text-emerald-700" :
              e.status === "failed"    ? "bg-red-50 text-red-700" :
              e.status === "running"   ? "bg-amber-50 text-amber-700" : "bg-gray-100 text-gray-500"
            }`}>{e.status}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────
export default function WorkflowDetailPage() {
  const { workerId } = useParams();
  const navigate = useNavigate();
  const { data: workflow, isLoading, error: statusError } = useWorkflowStatus(workerId);
  const resumeMutation = useResumeWorkflow(workerId);
  const { open: openChat, appendMessage } = useChatStore();

  const [agentStatuses, setAgentStatuses] = useState({});
  const [executionTrace, setExecutionTrace] = useState([]);
  const [selectedNode, setSelectedNode] = useState(null);

  // Live WebSocket updates
  useEffect(() => {
    const ws = new WebSocket(`${WS_BASE}/ws/dashboard`);
    ws.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.worker_id !== workerId || data.type !== "agent_event") return;
        setAgentStatuses(data.agent_statuses || {});
        setExecutionTrace(data.execution_trace || []);
      } catch {}
    };
    return () => ws.close();
  }, [workerId]);

  function handleDiscuss(agentId) {
    setSelectedNode(null);
    appendMessage({
      id: Date.now(),
      role: "assistant",
      content: `I'm now focused on the **${agentId}** agent for worker \`${workerId}\`. What would you like to know or challenge?`,
      timestamp: new Date().toISOString(),
    });
    openChat();
  }

  if (isLoading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" /></div>;
  if (!workflow && !isLoading) return <div className="p-6 text-muted-foreground">No workflow data found for worker <code>{workerId}</code>.</div>;
  if (statusError) return (
    <div className="space-y-4">
      <button onClick={() => navigate("/workflows")} className="flex items-center text-blue-600 hover:text-blue-800"><ArrowLeft className="w-4 h-4 mr-2" />Back</button>
      <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg">{statusError.message}</div>
    </div>
  );

  return (
    <div className="space-y-6">
      <button onClick={() => navigate("/workflows")} className="flex items-center text-blue-600 hover:text-blue-800">
        <ArrowLeft className="w-4 h-4 mr-2" />Back to Workflows
      </button>

      {/* Status card */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Workflow: {workerId}</h1>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {[["Status", GATE_LABELS[normalizeGate(workflow.current_gate)] || workflow.status], ["Current Agent", workflow.current_agent],
            ["Compliance", workflow.compliance_status], ["Complete", workflow.workflow_complete ? "Yes" : "No"]
          ].map(([label, val]) => (
            <div key={label}><div className="text-sm text-gray-600">{label}</div><div className="font-semibold text-gray-900">{val}</div></div>
          ))}
        </div>

        {workflow.hitl_required && (
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-6">
            <div className="flex items-center gap-2 mb-3">
              <AlertCircle className="w-5 h-5 text-orange-600" />
              <span className="font-semibold text-orange-900">Human Decision Required</span>
            </div>
            <div className="flex gap-3">
              {["approve","reject","modify"].map(d => (
                <button key={d} onClick={() => resumeMutation.mutate({ userDecision: d })}
                  disabled={resumeMutation.isPending}
                  className={`px-4 py-2 rounded-lg text-white disabled:opacity-50 capitalize ${d === "approve" ? "bg-green-600 hover:bg-green-700" : d === "reject" ? "bg-red-600 hover:bg-red-700" : "bg-blue-600 hover:bg-blue-700"}`}>
                  {d}
                </button>
              ))}
            </div>
          </div>
        )}

        {workflow.alerts?.length > 0 && (
          <div className="space-y-2">
            {workflow.alerts.map((a, i) => (
              <div key={i} className="bg-red-50 border border-red-200 text-red-800 px-4 py-2 rounded-lg text-sm">
                {a.message || JSON.stringify(a)}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Live DAG */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-900">Compliance Graph</h2>
          <span className="text-xs text-gray-400">Click any node to inspect · Use ✦ chat to discuss</span>
        </div>
        <LiveDAG agentStatuses={agentStatuses} executionTrace={executionTrace} onNodeClick={setSelectedNode} />
      </div>

      <TraceSection trace={workflow?.trace} />

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
