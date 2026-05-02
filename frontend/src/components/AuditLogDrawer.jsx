/**
 * AuditLogDrawer — PRD §2 (Action Audit & Undo)
 *
 * Slide-out panel showing the append-only audit trail.
 * Filterable by worker, actor (AI/Human), and action type.
 * Includes "Export for Audit" JSON download.
 */

import { useState, useMemo } from "react";
import { useUIStore } from "@/store/useUIStore";
import { useAuditLogStore } from "@/store/useAuditLogStore";

const ACTOR_COLORS = {
  AI: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  HUMAN: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  SYSTEM: "bg-gray-500/10 text-muted-foreground border-gray-500/20",
};

export default function AuditLogDrawer() {
  const isOpen = useUIStore((s) => s.isAuditLogOpen);
  const toggleAuditLog = useUIStore((s) => s.toggleAuditLog);
  const logEntries = useAuditLogStore((s) => s.logEntries);
  const exportAsJSON = useAuditLogStore((s) => s.exportAsJSON);

  const [filterActor, setFilterActor] = useState("ALL");
  const [filterWorker, setFilterWorker] = useState("");

  const filtered = useMemo(() => {
    let entries = [...logEntries].reverse();
    if (filterActor !== "ALL") {
      entries = entries.filter((e) => e.actor === filterActor);
    }
    if (filterWorker.trim()) {
      entries = entries.filter((e) =>
        e.workerId?.toLowerCase().includes(filterWorker.toLowerCase())
      );
    }
    return entries;
  }, [logEntries, filterActor, filterWorker]);

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
          onClick={toggleAuditLog}
        />
      )}

      {/* Drawer */}
      <div
        className={`fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col border-l border-border bg-card shadow-2xl transition-transform duration-300 ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div>
            <h2 className="text-base font-bold text-foreground">Action Audit Log</h2>
            <p className="text-xs text-muted-foreground">{logEntries.length} entries recorded</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={exportAsJSON}
              className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted"
            >
              Export JSON
            </button>
            <button
              onClick={toggleAuditLog}
              className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label="Close audit log"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-2 border-b border-border px-5 py-3">
          <select
            value={filterActor}
            onChange={(e) => setFilterActor(e.target.value)}
            className="rounded-lg border border-border bg-muted px-2 py-1 text-xs text-foreground"
          >
            <option value="ALL">All Actors</option>
            <option value="AI">AI Only</option>
            <option value="HUMAN">Human Only</option>
            <option value="SYSTEM">System Only</option>
          </select>
          <input
            type="text"
            placeholder="Filter by Worker ID..."
            value={filterWorker}
            onChange={(e) => setFilterWorker(e.target.value)}
            className="flex-1 rounded-lg border border-border bg-muted px-3 py-1 text-xs text-foreground placeholder-muted-foreground"
          />
        </div>

        {/* Entries */}
        <div className="flex-1 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              No audit entries yet
            </div>
          ) : (
            <div className="divide-y divide-border">
              {filtered.map((entry) => (
                <div key={entry.id} className="px-5 py-3 transition-colors hover:bg-muted/50">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                          ACTOR_COLORS[entry.actor] || ACTOR_COLORS.SYSTEM
                        }`}
                      >
                        {entry.actor}
                      </span>
                      <span className="font-mono text-xs font-medium text-foreground">
                        {entry.action}
                      </span>
                    </div>
                    <time className="text-[10px] text-muted-foreground">
                      {new Date(entry.timestamp).toLocaleTimeString()}
                    </time>
                  </div>
                  {entry.details && (
                    <p className="mt-1 text-xs text-muted-foreground">{entry.details}</p>
                  )}
                  {entry.workerId && (
                    <span className="mt-1 inline-block font-mono text-[10px] text-muted-foreground">
                      Worker: {entry.workerId}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
