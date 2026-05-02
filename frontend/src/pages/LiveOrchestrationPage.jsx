import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ExternalLink, Play, RefreshCw, X, CheckCircle, XCircle, AlertTriangle, Clock } from "lucide-react";
import HITLChatbot from "@/components/HITLChatbot";
import {
  API_BASE_URL,
  startOrchestration,
  getOrchestrationStatus,
  getOrchestrationGraph,
  resumeOrchestration,
  cancelOrchestrationSession,
} from "@/services/api";

const WS_BASE = API_BASE_URL.replace(/^http/, "ws").replace(/\/+$/, "");

// ── DAG layout constants ─────────────────────────────────────────────────────
const DAG_NODES = [
  { id: "entry_point",   label: "Entry Point",   x: 340, y: 40,  icon: "⚙" },
  { id: "planner",       label: "Planner",       x: 340, y: 120, icon: "🧠" },
  { id: "router",        label: "Router",        x: 340, y: 200, icon: "⚡" },
  { id: "verifier",      label: "Verifier",      x: 140, y: 290, icon: "🔍" },
  { id: "form_filler",   label: "Form Filler",   x: 340, y: 290, icon: "📝" },
  { id: "portal_agent",  label: "Portal Agent",  x: 540, y: 290, icon: "🌐" },
  { id: "critic",        label: "Critic",        x: 340, y: 375, icon: "⚖" },
  { id: "hitl_check",   label: "HITL Check",    x: 340, y: 455, icon: "👤" },
  { id: "pipeline_sync", label: "Pipeline Sync", x: 340, y: 535, icon: "🔄" },
  { id: "advance",       label: "Advance",       x: 340, y: 615, icon: "→" },
];

const DAG_EDGES = [
  ["entry_point", "planner"], ["planner", "router"],
  ["router", "verifier"], ["router", "form_filler"], ["router", "portal_agent"],
  ["verifier", "critic"], ["form_filler", "critic"], ["portal_agent", "critic"],
  ["critic", "hitl_check"], ["hitl_check", "pipeline_sync"],
  ["pipeline_sync", "advance"], ["advance", "router"],
];

const NW = 120, NH = 36, NR = 10;

function nodeColor(status) {
  if (status === "running") return { bg: "#1e1b4b", border: "#818cf8", text: "#c7d2fe", glow: "rgba(129,140,248,0.4)" };
  if (status === "done")    return { bg: "#052e16", border: "#22c55e", text: "#86efac", glow: "rgba(34,197,94,0.3)" };
  if (status === "failed")  return { bg: "#450a0a", border: "#f87171", text: "#fca5a5", glow: "rgba(248,113,113,0.3)" };
  return { bg: "#0f172a", border: "#334155", text: "#64748b", glow: "none" };
}

function statusIcon(s) {
  if (s === "running") return "▶";
  if (s === "done")    return "✓";
  if (s === "failed")  return "✗";
  return "○";
}

function statusBadge(s) {
  const base = "px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide border";
  if (s === "running")       return `${base} bg-indigo-950 border-indigo-500 text-indigo-300`;
  if (s === "done")          return `${base} bg-emerald-950 border-emerald-500 text-emerald-300`;
  if (s === "failed")        return `${base} bg-red-950 border-red-500 text-red-300`;
  if (s === "hitl_paused")   return `${base} bg-amber-950 border-amber-500 text-amber-300`;
  if (s === "completed")     return `${base} bg-emerald-950 border-emerald-400 text-emerald-200`;
  return `${base} bg-slate-900 border-slate-600 text-slate-400`;
}

// ── Main page ────────────────────────────────────────────────────────────────
export default function LiveOrchestrationPage() {
  const { workerId } = useParams();
  const navigate = useNavigate();

  const [sessionId, setSessionId] = useState(null);
  const [status, setStatus] = useState(null);       // full status object
  const [agentStatuses, setAgentStatuses] = useState({});
  const [trace, setTrace] = useState([]);
  const [selectedNode, setSelectedNode] = useState(null);
  const [showChat, setShowChat] = useState(false);
  const [wsStatus, setWsStatus] = useState("disconnected");
  const [starting, setStarting] = useState(false);
  const [elapsedSec, setElapsedSec] = useState(0);
  const startTimeRef = useRef(null);
  const traceEndRef = useRef(null);
  const pollRef = useRef(null);

  // ── Start orchestration ──
  const handleStart = useCallback(async () => {
    setStarting(true);
    startTimeRef.current = Date.now();
    setElapsedSec(0);
    try {
      const res = await startOrchestration(workerId, "manual");
      setSessionId(res.session_id);
      setStatus({ status: "orchestrating", agent_statuses: {}, plan: [] });
    } catch (e) {
      alert("Failed to start: " + e.message);
    } finally {
      setStarting(false);
    }
  }, [workerId]);

  // ── Poll status ──
  useEffect(() => {
    if (!sessionId) return;
    const poll = async () => {
      try {
        const s = await getOrchestrationStatus(sessionId);
        setStatus(s);
        setAgentStatuses(s.agent_statuses || {});
      } catch { /* ignore */ }
    };
    poll();
    pollRef.current = setInterval(poll, 2500);
    return () => clearInterval(pollRef.current);
  }, [sessionId]);

  // ── WebSocket live updates ──
  useEffect(() => {
    if (!sessionId) return;
    const ws = new WebSocket(`${WS_BASE}/ws/dashboard`);
    ws.onopen = () => setWsStatus("live");
    ws.onclose = () => setWsStatus("disconnected");
    ws.onerror = () => setWsStatus("error");
    ws.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.session_id !== sessionId && data.type !== "orchestration_event") return;
        setAgentStatuses(prev => ({ ...prev, ...data.agent_statuses }));
        if (data.trace) setTrace(data.trace);
      } catch {}
    };
    return () => ws.close();
  }, [sessionId]);

  // ── Fetch trace from status ──
  useEffect(() => {
    if (status?.trace) setTrace(status.trace);
  }, [status]);

  // ── Elapsed timer ──
  useEffect(() => {
    if (!startTimeRef.current) return;
    const t = setInterval(() => setElapsedSec(Math.floor((Date.now() - startTimeRef.current) / 1000)), 1000);
    return () => clearInterval(t);
  }, [sessionId]);

  // ── Scroll trace ──
  useEffect(() => { traceEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [trace]);

  // ── HITL resume ──
  const handleHITLDecision = useCallback(async (decision) => {
    if (!sessionId) return;
    try {
      await resumeOrchestration(sessionId, decision);
      setStatus(prev => ({ ...prev, hitl_required: false, status: "executing" }));
    } catch (e) {
      alert("Resume failed: " + e.message);
    }
  }, [sessionId]);

  const overallStatus = status?.status || "idle";
  const plan = status?.plan || [];
  const done = plan.filter(t => t.status === "done").length;
  const total = plan.length;
  const hitlRequired = status?.hitl_required;

  // ── Node click ──
  const nodeTrace = selectedNode
    ? trace.filter(e => e.node === selectedNode)
    : [];

  return (
    <div style={{ fontFamily: "'Inter', system-ui, sans-serif", background: "#020617", minHeight: "100vh", color: "#e2e8f0" }}>
      {/* ── Header ── */}
      <div style={{ background: "#0f172a", borderBottom: "1px solid #1e293b", padding: "12px 24px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 700, color: "#f1f5f9", margin: 0 }}>
            ⚡ Live Orchestration
          </h1>
          <p style={{ fontSize: 12, color: "#64748b", margin: "2px 0 0" }}>
            Worker: <span style={{ color: "#94a3b8", fontFamily: "monospace" }}>{workerId}</span>
            {sessionId && <span style={{ marginLeft: 12, color: "#475569", fontFamily: "monospace" }}>{sessionId}</span>}
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 11, padding: "3px 10px", borderRadius: 20, border: "1px solid", ...(wsStatus === "live" ? { background: "#052e16", borderColor: "#166534", color: "#86efac" } : { background: "#1e293b", borderColor: "#334155", color: "#64748b" }) }}>
            ● WS {wsStatus.toUpperCase()}
          </span>
          <span className={statusBadge(overallStatus)}>{overallStatus.replace("_", " ").toUpperCase()}</span>
          {!sessionId ? (
            <button onClick={handleStart} disabled={starting}
              style={{ display: "flex", alignItems: "center", gap: 6, background: "#4f46e5", color: "#fff", border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 13, fontWeight: 600, cursor: starting ? "not-allowed" : "pointer", opacity: starting ? 0.7 : 1 }}>
              <Play size={14} /> {starting ? "Starting…" : "Start Orchestration"}
            </button>
          ) : (
            <button onClick={() => cancelOrchestrationSession(sessionId).then(() => setSessionId(null))}
              style={{ display: "flex", alignItems: "center", gap: 6, background: "#7f1d1d", color: "#fca5a5", border: "1px solid #991b1b", borderRadius: 8, padding: "8px 14px", fontSize: 13, cursor: "pointer" }}>
              <X size={14} /> Cancel
            </button>
          )}
          <button onClick={() => navigate(-1)}
            style={{ background: "#1e293b", color: "#94a3b8", border: "1px solid #334155", borderRadius: 8, padding: "8px 14px", fontSize: 13, cursor: "pointer" }}>
            ← Back
          </button>
        </div>
      </div>

      {/* ── 3-column body ── */}
      <div style={{ display: "grid", gridTemplateColumns: "340px 1fr 320px", height: "calc(100vh - 61px)", overflow: "hidden" }}>

        {/* ── Column 1: DAG Canvas ── */}
        <div style={{ background: "#0a0f1e", borderRight: "1px solid #1e293b", overflow: "auto", padding: "16px 12px" }}>
          <p style={{ fontSize: 11, color: "#475569", marginBottom: 8, textTransform: "uppercase", letterSpacing: 1 }}>Execution Graph</p>
          <svg viewBox="0 0 680 680" style={{ width: "100%", maxHeight: 640 }}>
            <defs>
              <marker id="arrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                <path d="M0,0 L6,3 L0,6 Z" fill="#334155" />
              </marker>
            </defs>

            {/* Edges */}
            {DAG_EDGES.map(([from, to]) => {
              const s = DAG_NODES.find(n => n.id === from);
              const d = DAG_NODES.find(n => n.id === to);
              if (!s || !d) return null;
              const active = agentStatuses[from] === "running" || agentStatuses[to] === "running";
              const done2 = agentStatuses[from] === "done" && agentStatuses[to] === "done";
              const color = active ? "#818cf8" : done2 ? "#22c55e" : "#1e3a5f";
              return (
                <line key={`${from}-${to}`}
                  x1={s.x} y1={s.y + NH / 2} x2={d.x} y2={d.y - NH / 2}
                  stroke={color} strokeWidth={active ? 2 : 1.5} strokeDasharray={active ? "4 3" : "none"}
                  markerEnd="url(#arrow)">
                  {active && <animate attributeName="stroke-dashoffset" from="0" to="-14" dur="0.8s" repeatCount="indefinite" />}
                </line>
              );
            })}

            {/* Nodes */}
            {DAG_NODES.map(node => {
              const st = nodeColor(agentStatuses[node.id] || "pending");
              const x = node.x - NW / 2, y = node.y - NH / 2;
              const isRunning = agentStatuses[node.id] === "running";
              const isSelected = selectedNode === node.id;
              return (
                <g key={node.id} onClick={() => setSelectedNode(selectedNode === node.id ? null : node.id)}
                  style={{ cursor: "pointer" }}>
                  {isRunning && (
                    <rect x={x - 4} y={y - 4} width={NW + 8} height={NH + 8} rx={NR + 3}
                      fill="none" stroke={st.border} strokeWidth={2} opacity={0.6}>
                      <animate attributeName="opacity" values="0.2;0.7;0.2" dur="1.2s" repeatCount="indefinite" />
                    </rect>
                  )}
                  {isSelected && (
                    <rect x={x - 2} y={y - 2} width={NW + 4} height={NH + 4} rx={NR + 2}
                      fill="none" stroke="#f59e0b" strokeWidth={2} />
                  )}
                  <rect x={x} y={y} width={NW} height={NH} rx={NR}
                    fill={st.bg} stroke={st.border} strokeWidth={1.5} />
                  <text x={node.x - 28} y={node.y + 5} fill={st.text} fontSize={10} fontWeight="600"
                    fontFamily="Inter, system-ui">
                    {node.icon} {node.label}
                  </text>
                  <text x={node.x + 44} y={node.y + 5} fill={st.border} fontSize={9}
                    fontFamily="Inter, monospace" textAnchor="middle">
                    {statusIcon(agentStatuses[node.id] || "pending")}
                  </text>
                </g>
              );
            })}
          </svg>

          {/* Legend */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
            {[["pending", "#334155", "#64748b"], ["running", "#818cf8", "#c7d2fe"], ["done", "#22c55e", "#86efac"], ["failed", "#f87171", "#fca5a5"]].map(([label, border, color]) => (
              <div key={label} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10, color }}>
                <div style={{ width: 8, height: 8, borderRadius: 2, border: `1px solid ${border}`, background: "#0f172a" }} />
                {label}
              </div>
            ))}
          </div>
        </div>

        {/* ── Column 2: Trace Panel ── */}
        <div style={{ background: "#060e1f", borderRight: "1px solid #1e293b", display: "flex", flexDirection: "column", overflow: "hidden" }}>
          {/* Node detail header */}
          <div style={{ padding: "12px 16px", borderBottom: "1px solid #1e293b", minHeight: 56 }}>
            {selectedNode ? (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 600, color: "#e2e8f0", margin: 0 }}>
                    {DAG_NODES.find(n => n.id === selectedNode)?.icon} {selectedNode.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())}
                  </p>
                  <p style={{ fontSize: 11, color: "#475569", margin: "2px 0 0" }}>
                    {nodeTrace.length} trace entries
                  </p>
                </div>
                <span className={statusBadge(agentStatuses[selectedNode] || "pending")}>
                  {agentStatuses[selectedNode] || "pending"}
                </span>
              </div>
            ) : (
              <p style={{ fontSize: 12, color: "#475569", margin: 0 }}>Click a node to inspect its trace</p>
            )}
          </div>

          {/* Trace entries */}
          <div style={{ flex: 1, overflowY: "auto", padding: "12px 16px" }}>
            {(selectedNode ? nodeTrace : trace).length === 0 ? (
              <p style={{ fontSize: 12, color: "#334155", fontStyle: "italic" }}>
                {sessionId ? "No trace yet — orchestration running…" : "Start orchestration to see trace events."}
              </p>
            ) : (
              (selectedNode ? nodeTrace : trace).map((e, i) => {
                const isRunning = e.status === "running";
                const isDone = e.status === "done";
                const color = isRunning ? "#818cf8" : isDone ? "#22c55e" : "#f87171";
                const bg = isRunning ? "#1e1b4b" : isDone ? "#052e16" : "#450a0a";
                return (
                  <div key={i} style={{ display: "flex", gap: 8, marginBottom: 10, padding: "8px 10px", background: bg, borderRadius: 8, border: `1px solid ${color}22` }}>
                    <div style={{ fontSize: 16, lineHeight: 1, paddingTop: 2, color }}>
                      {isRunning ? "▶" : isDone ? "✓" : "✗"}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8, marginBottom: 2 }}>
                        <span style={{ fontSize: 11, fontWeight: 600, color, fontFamily: "monospace" }}>
                          {e.node || e.agent}
                        </span>
                        {e.timestamp && (
                          <span style={{ fontSize: 10, color: "#334155", flexShrink: 0 }}>
                            {new Date(e.timestamp).toLocaleTimeString()}
                          </span>
                        )}
                      </div>
                      <p style={{ fontSize: 11, color: "#94a3b8", margin: 0, wordBreak: "break-word" }}>
                        {e.msg || e.summary || e.output_summary || ""}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={traceEndRef} />
          </div>

          {/* Progress bar */}
          {total > 0 && (
            <div style={{ padding: "10px 16px", borderTop: "1px solid #1e293b", background: "#0a0f1e" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, fontSize: 11, color: "#64748b" }}>
                <span>Tasks: {done}/{total}</span>
                <span>{Math.round((done / total) * 100)}%</span>
              </div>
              <div style={{ height: 4, background: "#1e293b", borderRadius: 4, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${total ? (done / total) * 100 : 0}%`, background: "linear-gradient(90deg, #4f46e5, #22c55e)", borderRadius: 4, transition: "width 0.4s ease" }} />
              </div>
            </div>
          )}
        </div>

        {/* ── Column 3: HITL / Chat Panel ── */}
        <div style={{ background: "#0a0f1e", display: "flex", flexDirection: "column", overflow: "hidden" }}>
          {/* Tab bar */}
          <div style={{ display: "flex", borderBottom: "1px solid #1e293b" }}>
            {["HITL", "Chat"].map(tab => (
              <button key={tab} onClick={() => setShowChat(tab === "Chat")}
                style={{ flex: 1, padding: "10px", fontSize: 12, fontWeight: 600, background: "transparent", border: "none", cursor: "pointer",
                  borderBottom: showChat === (tab === "Chat") ? "2px solid #4f46e5" : "2px solid transparent",
                  color: showChat === (tab === "Chat") ? "#818cf8" : "#475569" }}>
                {tab === "HITL" && hitlRequired && "🔴 "}{tab}
              </button>
            ))}
          </div>

          {showChat ? (
            <div style={{ flex: 1, overflow: "hidden" }}>
              <HITLChatbot workerId={workerId} targetAgent="orchestration" onClose={() => setShowChat(false)} />
            </div>
          ) : (
            <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>
              {hitlRequired ? (
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                    <AlertTriangle size={18} color="#f59e0b" />
                    <span style={{ fontSize: 13, fontWeight: 700, color: "#fbbf24" }}>Human Review Required</span>
                  </div>
                  <p style={{ fontSize: 12, color: "#94a3b8", marginBottom: 12 }}>{status?.hitl_reason}</p>
                  {(status?.hitl_suggestions || []).map((s, i) => (
                    <div key={i} style={{ background: "#1c1917", border: "1px solid #78350f", borderRadius: 8, padding: "10px 12px", marginBottom: 8 }}>
                      <p style={{ fontSize: 11, fontWeight: 600, color: "#fbbf24", margin: "0 0 4px" }}>{s.field || s.type}</p>
                      <p style={{ fontSize: 11, color: "#a8a29e", margin: "0 0 6px" }}>{s.message || s.details}</p>
                      {s.suggestion && <p style={{ fontSize: 11, color: "#78716c", margin: 0 }}>💡 {s.suggestion}</p>}
                    </div>
                  ))}
                  <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
                    <button onClick={() => handleHITLDecision("approve")}
                      style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "10px", background: "#052e16", border: "1px solid #166534", borderRadius: 8, color: "#86efac", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                      <CheckCircle size={14} /> Approve
                    </button>
                    <button onClick={() => handleHITLDecision("reject")}
                      style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "10px", background: "#450a0a", border: "1px solid #991b1b", borderRadius: 8, color: "#fca5a5", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                      <XCircle size={14} /> Reject
                    </button>
                  </div>
                </div>
              ) : (
                <div>
                  <p style={{ fontSize: 12, color: "#475569", marginBottom: 16 }}>No human review required at this time.</p>
                  <div style={{ background: "#0f172a", borderRadius: 10, padding: 14, border: "1px solid #1e293b" }}>
                    <p style={{ fontSize: 11, color: "#64748b", marginBottom: 10, textTransform: "uppercase", letterSpacing: 1 }}>Execution Summary</p>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {[
                        ["Status", <span className={statusBadge(overallStatus)}>{overallStatus.replace(/_/g, " ")}</span>],
                        ["Progress", `${done}/${total} tasks`],
                        ["Gate", status?.pipeline_stage || "—"],
                        ["Elapsed", sessionId ? `${elapsedSec}s` : "—"],
                        ["Session", sessionId ? sessionId.slice(-8) : "—"],
                      ].map(([label, val]) => (
                        <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span style={{ fontSize: 11, color: "#475569" }}>{label}</span>
                          <span style={{ fontSize: 11, color: "#94a3b8" }}>{val}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Task list */}
                  {plan.length > 0 && (
                    <div style={{ marginTop: 16 }}>
                      <p style={{ fontSize: 11, color: "#475569", marginBottom: 8, textTransform: "uppercase", letterSpacing: 1 }}>Plan</p>
                      {plan.map((task, i) => {
                        const tDone = task.status === "done";
                        const tActive = !tDone && i === (status?.current_task_index || 0);
                        return (
                          <div key={task.task_id || i} style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: "6px 8px", marginBottom: 4, background: tActive ? "#1e1b4b" : "#0f172a", borderRadius: 6, border: `1px solid ${tActive ? "#4f46e5" : "#1e293b"}` }}>
                            <span style={{ fontSize: 13, marginTop: 1 }}>{tDone ? "✓" : tActive ? "▶" : "○"}</span>
                            <div>
                              <p style={{ fontSize: 11, fontWeight: 600, color: tDone ? "#22c55e" : tActive ? "#818cf8" : "#475569", margin: 0 }}>{task.task_type}</p>
                              <p style={{ fontSize: 10, color: "#334155", margin: "2px 0 0" }}>{task.description}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Bottom actions */}
          <div style={{ padding: "12px 16px", borderTop: "1px solid #1e293b", display: "flex", gap: 8 }}>
            <button onClick={() => setShowChat(c => !c)}
              style={{ flex: 1, padding: "8px", background: "#1e293b", border: "1px solid #334155", borderRadius: 8, color: "#94a3b8", fontSize: 12, cursor: "pointer" }}>
              💬 AI Chat
            </button>
            <a href="https://smith.langchain.com" target="_blank" rel="noopener noreferrer"
              style={{ display: "flex", alignItems: "center", gap: 4, padding: "8px 12px", background: "#1e1b4b", border: "1px solid #3730a3", borderRadius: 8, color: "#818cf8", fontSize: 12, textDecoration: "none" }}>
              <ExternalLink size={12} /> LangSmith
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
