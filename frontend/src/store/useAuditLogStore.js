import { create } from "zustand";

let entryCounter = 0;

/**
 * Append-only audit log store (PRD §2 — Action Audit & Undo)
 * Tracks every AI and human action for government audit traceability.
 */
export const useAuditLogStore = create((set, get) => ({
  /** @type {Array<AuditEntry>} */
  logEntries: [],

  /**
   * Append a new entry to the audit log.
   * @param {Object} entry
   * @param {'AI'|'HUMAN'|'SYSTEM'} entry.actor
   * @param {string} entry.action - e.g., "DOC_UPLOADED", "HITL_APPROVED"
   * @param {string} [entry.workerId]
   * @param {string} [entry.details] - Human-readable description
   * @param {boolean} [entry.reversible] - Whether this action can be undone
   * @param {Object} [entry.metadata] - Additional structured data
   */
  appendEntry: (entry) =>
    set((state) => ({
      logEntries: [
        ...state.logEntries,
        {
          id: `audit-${++entryCounter}-${Date.now()}`,
          timestamp: new Date().toISOString(),
          actor: entry.actor || "SYSTEM",
          action: entry.action,
          workerId: entry.workerId || null,
          details: entry.details || "",
          reversible: entry.reversible || false,
          metadata: entry.metadata || null,
        },
      ],
    })),

  /**
   * Get entries filtered by criteria
   */
  getFilteredEntries: (filters = {}) => {
    const entries = get().logEntries;
    return entries.filter((e) => {
      if (filters.workerId && e.workerId !== filters.workerId) return false;
      if (filters.actor && e.actor !== filters.actor) return false;
      if (filters.action && e.action !== filters.action) return false;
      return true;
    });
  },

  /**
   * Export log as JSON for government audits
   */
  exportAsJSON: () => {
    const entries = get().logEntries;
    const blob = new Blob([JSON.stringify(entries, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `permitiq-audit-log-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  },

  /**
   * Get total entry count
   */
  getEntryCount: () => get().logEntries.length,
}));
