import { X, MessageSquare, Shield, ExternalLink } from "lucide-react";

const AGENT_DESCRIPTIONS = {
  supervisor:    "Routes the workflow between agents based on current compliance stage. Acts as the central coordinator.",
  auditor:       "Audits worker documents, checks passport validity (12+ month rule) and FOMEMA medical requirements.",
  company_audit: "Verifies company eligibility — JTKSM Section 60K approval, Act 446 housing certificate, and sector quota balance.",
  strategist:    "Calculates MTLM levy costs, EP salary compliance, and identifies potential compliance deadlocks.",
  vdr_filing:    "Checks VDR filing prerequisites — passport scan, biometric photo, signed contracts, and succession plan.",
  plks_monitor:  "Monitors post-arrival compliance gates — FOMEMA registration deadline and PLKS permit issuance.",
  filing:        "Prepares the permit renewal filing package for government submission.",
  hitl:          "Pauses the automated workflow when a human decision is required — e.g. deadlocks, expired permits, or policy conflicts.",
};

const STATUS_COLORS = {
  running: "bg-amber-500 text-white",
  done:    "bg-emerald-600 text-white",
  failed:  "bg-red-600 text-white",
  pending: "bg-slate-700 text-slate-400",
};

const STATUS_LABELS = {
  running: "In Progress",
  done:    "Completed",
  failed:  "Failed",
  pending: "Pending",
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
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[status] || STATUS_COLORS.pending}`}>
              {STATUS_LABELS[status] || status}
            </span>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Description */}
        <p className="px-5 py-3 text-sm text-slate-400">{AGENT_DESCRIPTIONS[agent] || "Compliance agent."}</p>

        {/* Execution trace — human-readable summaries */}
        <div className="px-5 pb-2">
          <div className="mb-2 flex items-center justify-between">
            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
              <span className="text-amber-500">›_</span> Activity Log
            </p>
            <a
              href={`https://smith.langchain.com/o/default/projects/p/foreign-worker-compliance`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-[10px] text-indigo-400 hover:text-indigo-300"
            >
              <ExternalLink className="h-3 w-3" /> LangSmith
            </a>
          </div>
          <div className="max-h-52 overflow-y-auto rounded-lg bg-slate-950 p-3 space-y-2">
            {trace.length === 0 ? (
              <span className="text-slate-600 text-xs italic">No activity recorded yet.</span>
            ) : (
              trace.map((e, i) => {
                const stepColor =
                  e.step === "running" ? "text-amber-400"
                  : e.step === "done" ? "text-emerald-400"
                  : "text-red-400";
                const stepIcon = e.step === "done" ? "✓" : e.step === "running" ? "▶" : "✗";
                return (
                  <div key={i} className="flex items-start gap-2 text-xs">
                    <span className={`shrink-0 font-bold ${stepColor}`}>{stepIcon}</span>
                    <div className="flex-1">
                      <p className="text-slate-200">{e.summary || e.msg}</p>
                      {e.timestamp && (
                        <p className="mt-0.5 text-[10px] text-slate-600">
                          {new Date(e.timestamp).toLocaleTimeString()}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })
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
