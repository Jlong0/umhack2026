/**
 * PermitIQ Worker Profile Schema (PRD §6.1)
 * Maps to Firestore document: workers/{worker_id}
 */

/**
 * @typedef {Object} WorkerDeadlines
 * @property {string} mdac_verification - ISO 8601 timestamp
 * @property {string} plks_expiry - ISO 8601 timestamp
 * @property {string} passport_expiry - ISO 8601 timestamp
 * @property {string} [typhoid_expiry] - ISO 8601 timestamp (F&B sector only)
 */

/**
 * @typedef {Object} WorkerProfile
 * @property {string} worker_id - e.g., "W-12345"
 * @property {string} first_name
 * @property {string} last_name
 * @property {string} nationality - ISO 3166-1 alpha-3 code (e.g., "IDN")
 * @property {string} passport_number
 * @property {'F&B'|'Manufacturing'|'Construction'|'Services'|'Agriculture'|'Plantation'} sector
 * @property {'JTKSM'|'VDR_PENDING'|'TRANSIT'|'FOMEMA'|'PLKS_ENDORSE'|'ACTIVE'} current_gate
 * @property {number} compliance_health_score - 0-100
 * @property {WorkerDeadlines} deadlines
 */

/** Gate order for the Kanban pipeline (PRD Screen B) */
export const GATE_ORDER = [
  'JTKSM',
  'VDR_PENDING',
  'TRANSIT',
  'FOMEMA',
  'PLKS_ENDORSE',
  'ACTIVE',
];

/** Human-readable gate labels */
export const GATE_LABELS = {
  JTKSM: 'JTKSM Gate',
  VDR_PENDING: 'VDR Pending',
  TRANSIT: 'Transit',
  FOMEMA: 'FOMEMA',
  PLKS_ENDORSE: 'PLKS Endorse',
  ACTIVE: 'Active',
};

/** Nationality flag emoji map */
export const NATIONALITY_FLAGS = {
  IDN: '🇮🇩',
  BGD: '🇧🇩',
  NPL: '🇳🇵',
  MMR: '🇲🇲',
  VNM: '🇻🇳',
  PHL: '🇵🇭',
  IND: '🇮🇳',
  PAK: '🇵🇰',
  KHM: '🇰🇭',
  THA: '🇹🇭',
};
