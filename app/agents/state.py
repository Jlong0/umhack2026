from typing import TypedDict, Optional
from datetime import datetime
from enum import Enum


class ComplianceStatus(str, Enum):
    ONBOARDING = "onboarding"
    ACTIVE = "active"
    RENEWAL_PENDING = "renewal_pending"
    MEDICAL_REVIEW = "medical_review"
    APPEAL_PENDING = "appeal_pending"
    EXPIRED = "expired"
    DEADLOCK = "deadlock"
    REPATRIATION = "repatriation"


class RegulatoryGate(str, Enum):
    GATE_1_JTKSM = "gate_1_jtksm"
    GATE_2_KDN = "gate_2_kdn"
    GATE_3_JIM = "gate_3_jim"


class AgentType(str, Enum):
    SUPERVISOR = "supervisor"
    AUDITOR = "auditor"
    STRATEGIST = "strategist"
    FILING = "filing"


class VDRState(TypedDict):
    # --- Stage 1: Employer & Housing ---
    company_name: Optional[str]
    roc_number: Optional[str]
    nature_of_business: Optional[str]
    act446_cert_number: Optional[str]
    act446_max_capacity: Optional[int]
    local_employee_count: Optional[int]
    foreign_employee_count: Optional[int]
    quota_requested: Optional[int]

    # --- Stage 2: Worker Identity ---
    master_name: Optional[str]        # from passport MRZ — canonical name on ALL forms
    passport_number: Optional[str]
    passport_expiry: Optional[str]    # must be >= 18 months from today
    worker_dob: Optional[str]         # to verify age <= 45
    biomedical_ref: Optional[str]     # 10-12 digit ref from bio-medical slip
    borang100_home_address: Optional[str]
    borang100_parents_names: Optional[str]

    # --- Validation flags ---
    employer_eligible: bool
    housing_compliant: bool
    worker_eligible: bool
    quota_flags: list
    validation_errors: list           # hard stops

    # --- Signature tracking ---
    signatures_required: list         # list of SignatureItem dicts
    signatures_completed: list

    # --- Downstream ---
    fomema_status: str                # "Fit" | "Unfit" | "Pending"
    obligations: list
    vdr_form_data: dict
    pipeline_status: str              # "running"|"paused"|"completed"|"failed"
    halt_reason: Optional[str]


# Keep legacy types for backward compatibility with existing routes/services
class WorkerComplianceState(TypedDict):
    worker_id: str
    passport_number: str
    full_name: str
    nationality: str
    sector: str
    permit_class: str
    current_salary_rm: Optional[float]
    employer_id: str
    permit_issue_date: Optional[str]
    permit_expiry_date: Optional[str]
    passport_expiry_date: Optional[str]
    last_fomema_date: Optional[str]
    compliance_status: ComplianceStatus
    current_gate: Optional[RegulatoryGate]
    days_to_expiry: Optional[int]
    documents_uploaded: list
    documents_validated: bool
    missing_documents: list
    fomema_status: Optional[str]
    fomema_conditions: list
    ncd_monitoring_enrolled: bool
    mtlm_levy_rm: Optional[float]
    outstanding_fines_rm: Optional[float]
    estimated_renewal_cost_rm: Optional[float]
    pending_obligations: list
    completed_obligations: list
    blocked_obligations: list
    current_agent: AgentType
    agent_observations: list
    tool_calls: list
    hitl_required: bool
    hitl_reason: Optional[str]
    hitl_data: Optional[dict]
    alerts: list
    deadlock_detected: bool
    deadlock_type: Optional[str]
    next_action: Optional[str]
    workflow_complete: bool
    error_state: Optional[str]


class ParseJobState(TypedDict):
    job_id: str
    document_id: str
    document_type: str
    content_type: str
    storage_path: str
    triage_level: str
    ocr_confidence: Optional[float]
    extracted_data: Optional[dict]
    extraction_confidence: Optional[float]
    validation_errors: list
    requires_human_review: bool
    status: str
    error_message: Optional[str]


class ComplianceGraphState(TypedDict):
    employer_id: str
    company_name: str
    sector: str
    total_foreign_workers: int
    total_local_workers: int
    foreign_to_local_ratio: float
    current_mtlm_tier: str
    total_annual_levy_rm: float
    workers_expiring_30_days: int
    workers_expiring_90_days: int
    workers_in_deadlock: int
    total_outstanding_fines_rm: float
    housing_capacity: int
    housing_certificates_valid: bool
    ssm_registration_valid: bool
    active_workflows: list
    completed_workflows: list
    failed_workflows: list


def create_initial_worker_state(worker_data: dict) -> WorkerComplianceState:
    return WorkerComplianceState(
        worker_id=worker_data.get("worker_id", ""),
        passport_number=worker_data.get("passport_number", ""),
        full_name=worker_data.get("full_name", ""),
        nationality=worker_data.get("nationality", ""),
        sector=worker_data.get("sector", "Manufacturing"),
        permit_class=worker_data.get("permit_class", "PLKS"),
        current_salary_rm=worker_data.get("current_salary_rm"),
        employer_id=worker_data.get("employer_id", ""),
        permit_issue_date=worker_data.get("permit_issue_date"),
        permit_expiry_date=worker_data.get("permit_expiry_date"),
        passport_expiry_date=worker_data.get("passport_expiry_date"),
        last_fomema_date=worker_data.get("last_fomema_date"),
        compliance_status=ComplianceStatus.ONBOARDING,
        current_gate=worker_data.get("current_gate"),
        days_to_expiry=None,
        documents_uploaded=[],
        documents_validated=False,
        missing_documents=[],
        fomema_status=None,
        fomema_conditions=[],
        ncd_monitoring_enrolled=False,
        mtlm_levy_rm=None,
        outstanding_fines_rm=None,
        estimated_renewal_cost_rm=None,
        pending_obligations=[],
        completed_obligations=[],
        blocked_obligations=[],
        current_agent=AgentType.SUPERVISOR,
        agent_observations=[],
        tool_calls=[],
        hitl_required=False,
        hitl_reason=None,
        hitl_data=None,
        alerts=[],
        deadlock_detected=False,
        deadlock_type=None,
        next_action="audit_documents",
        workflow_complete=False,
        error_state=None,
    )


def calculate_days_to_expiry(permit_expiry_date: str) -> int:
    expiry = datetime.fromisoformat(permit_expiry_date.replace("Z", "+00:00"))
    today = datetime.now(expiry.tzinfo)
    return (expiry - today).days
