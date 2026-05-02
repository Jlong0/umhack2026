import { X, MessageSquare, Shield } from "lucide-react";

const AGENT_DESCRIPTIONS = {
  supervisor:    "Routes the workflow between agents based on current compliance stage.",
  auditor:       "Audits worker documents, checks passport validity and FOMEMA requirements.",
  company_audit: "Verifies company gate (JTKSM Section 60K, Act 446, quota balance).",
  strategist:    "Calculates MTLM levy, EP salary compliance, and deadlock risk.",
  vdr_filing:    "Checks VDR filing prerequisites — documents, biometrics, succession plan.",
  plks_monitor:  "Monitors post-arrival FOMEMA registration and PLKS issuance.",
  filing:        "Prepares permit renewal filing package.",
  hitl:          "Pauses workflow for human review and decision.",
};

const STATUS_COLORS = {
  running: "bg-teal-500 text-white",
  done:    "bg-teal-900 text-teal-300",
  failed:  "bg-red-900 text-red-300",
  pending: "bg-slate-700 text-slate-400",
};

export default function AgentDetailModal({ agent, label, status, trace, onClose, onDiscuss }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-[#0f172a] border border-slate-700 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
          <div className="flex items-center gap-3">
            <Shield className="h-5 w-5 text-teal-400" />
            <span className="font-semibold text-slate-100">{label}</span>
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${STATUS_COLORS[status] || STATUS_COLORS.pending}`}>
              {status === "done" ? "Completed" : status}
            </span>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Description */}
        <p className="px-5 py-3 text-sm text-slate-400">{AGENT_DESCRIPTIONS[agent] || "Compliance agent."}</p>

        {/* Execution trace */}
        <div className="px-5 pb-2">
          <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
            <span className="text-teal-500">›_</span> Execution Trace
          </p>
          <div className="max-h-52 overflow-y-auto rounded-lg bg-slate-950 p-3 font-mono text-xs text-slate-300 space-y-1.5">
            {trace.length === 0 ? (
              <span className="text-slate-600">No trace entries yet.</span>
            ) : (
              trace.map((e, i) => (
                <div key={i}>
                  <span className="text-slate-500">[{i + 1}]</span>{" "}
                  <span className="text-teal-400">[{e.agent}]</span> {e.msg}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 border-t border-slate-800 px-5 py-3">
          <button onClick={onClose}
            className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-400 hover:text-slate-200">
            Close
          </button>
          <button onClick={() => onDiscuss(agent)}
            className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500">
            <MessageSquare className="h-4 w-4" />
            Discuss Findings
          </button>
        </div>
      </div>
    </div>
  );
}
