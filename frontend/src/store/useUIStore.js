import { create } from "zustand";

/**
 * Global UI state store (PRD §2 — Intent Preview & Autonomy Dial)
 * Manages drawer states, autonomy level, and active panel context.
 */
export const useUIStore = create((set) => ({
  // HITL Drawer
  isHITLDrawerOpen: false,
  hitlTargetWorkerId: null,
  hitlTargetTaskId: null,

  // Intent Preview Modal
  isIntentPreviewOpen: false,
  intentPreviewData: null,
  intentPreviewOnConfirm: null,

  // Autonomy Dial (PRD §2 — 0=Full Manual, 33=Suggest, 66=Auto+Approval, 100=Full Auto)
  autonomyLevel: 66,

  // Compliance Breach Banner
  activeBreachAlerts: [],

  // Audit Log Drawer
  isAuditLogOpen: false,

  // Active panel context
  activePanel: "dashboard",

  // --- Actions ---
  openHITLDrawer: (workerId, taskId) =>
    set({
      isHITLDrawerOpen: true,
      hitlTargetWorkerId: workerId,
      hitlTargetTaskId: taskId,
    }),

  closeHITLDrawer: () =>
    set({
      isHITLDrawerOpen: false,
      hitlTargetWorkerId: null,
      hitlTargetTaskId: null,
    }),

  openIntentPreview: (data, onConfirm) =>
    set({
      isIntentPreviewOpen: true,
      intentPreviewData: data,
      intentPreviewOnConfirm: onConfirm || null,
    }),

  closeIntentPreview: () =>
    set({
      isIntentPreviewOpen: false,
      intentPreviewData: null,
      intentPreviewOnConfirm: null,
    }),

  setAutonomyLevel: (level) =>
    set({ autonomyLevel: Math.max(0, Math.min(100, level)) }),

  pushBreachAlert: (alert) =>
    set((state) => ({
      activeBreachAlerts: [
        ...state.activeBreachAlerts.filter((a) => a.worker_id !== alert.worker_id),
        alert,
      ],
    })),

  dismissBreachAlert: (workerId) =>
    set((state) => ({
      activeBreachAlerts: state.activeBreachAlerts.filter(
        (a) => a.worker_id !== workerId
      ),
    })),

  toggleAuditLog: () =>
    set((state) => ({ isAuditLogOpen: !state.isAuditLogOpen })),

  setActivePanel: (panel) => set({ activePanel: panel }),
}));
