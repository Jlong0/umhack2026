/**
 * PermitIQ LangGraph Stream Schema (PRD §6.3)
 * Payloads received via Firebase onSnapshot listeners
 */

/**
 * @typedef {'AI_REASONING_UPDATE'|'GATE_TRANSITION'|'COMPLIANCE_BREACH'|'HITL_REQUEST'|'ACTION_COMPLETE'} StreamEventType
 */

/**
 * @typedef {'OPEN_WARNING_MODAL'|'UPDATE_GATE_STATUS'|'SHOW_CONFIDENCE_SCORE'|'REFRESH_DASHBOARD'|'OPEN_HITL_DRAWER'} UITrigger
 */

/**
 * @typedef {Object} ComputedData
 * @property {number} [fine_amount_rm]
 * @property {string} [liability_level] - e.g., "Administrative", "Criminal"
 * @property {number} [overstay_days]
 * @property {number} [levy_amount_rm]
 */

/**
 * @typedef {Object} StreamPayload
 * @property {string} worker_id
 * @property {string} action - e.g., "CALCULATING_OVERSTAY_FINE"
 * @property {string} message - Human-readable AI reasoning
 * @property {UITrigger} ui_trigger
 * @property {ComputedData} [computed_data]
 */

/**
 * @typedef {Object} LangGraphStreamEvent
 * @property {StreamEventType} event_type
 * @property {string} timestamp - ISO 8601
 * @property {StreamPayload} payload
 */

/** UI Trigger action mapping */
export const UI_TRIGGERS = {
  OPEN_WARNING_MODAL: 'OPEN_WARNING_MODAL',
  UPDATE_GATE_STATUS: 'UPDATE_GATE_STATUS',
  SHOW_CONFIDENCE_SCORE: 'SHOW_CONFIDENCE_SCORE',
  REFRESH_DASHBOARD: 'REFRESH_DASHBOARD',
  OPEN_HITL_DRAWER: 'OPEN_HITL_DRAWER',
};
