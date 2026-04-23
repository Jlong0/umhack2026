/**
 * PermitIQ Agentic Task / Node Schema (PRD §6.2)
 * Used by Kanban board and React Flow timelines
 */

/**
 * @typedef {'PENDING'|'IN_PROGRESS'|'COMPLETED'|'BLOCKED_HITL'|'FAILED'} TaskStatus
 */

/**
 * @typedef {Object} AIMetadata
 * @property {number} confidence_score - 0.0 to 1.0
 * @property {string} reasoning - AI's explanation string
 * @property {boolean} requires_human_approval
 */

/**
 * @typedef {Object} AgenticTask
 * @property {string} task_id - e.g., "T-9876"
 * @property {string} worker_id - e.g., "W-12345"
 * @property {string} task_name - Human-readable name
 * @property {TaskStatus} status
 * @property {string[]} depends_on - Array of task_ids this depends on
 * @property {AIMetadata} ai_metadata
 */

/** Task status display config */
export const TASK_STATUS_CONFIG = {
  PENDING: { label: 'Pending', color: 'text-gray-400', bg: 'bg-gray-500/10', icon: 'clock' },
  IN_PROGRESS: { label: 'In Progress', color: 'text-blue-400', bg: 'bg-blue-500/10', icon: 'loader' },
  COMPLETED: { label: 'Completed', color: 'text-emerald-400', bg: 'bg-emerald-500/10', icon: 'check' },
  BLOCKED_HITL: { label: 'Blocked – HITL Required', color: 'text-red-400', bg: 'bg-red-500/10', icon: 'alert-triangle' },
  FAILED: { label: 'Failed', color: 'text-red-500', bg: 'bg-red-500/20', icon: 'x-circle' },
};

/** Confidence thresholds */
export const CONFIDENCE = {
  HIGH: 0.85,
  MEDIUM: 0.60,
};
