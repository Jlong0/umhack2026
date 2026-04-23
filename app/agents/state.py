"""
Worker compliance state management for LangGraph agent system.
Defines the state structure for tracking worker compliance journey.
"""
from typing import TypedDict, List, Optional, Annotated
from datetime import datetime
from enum import Enum
import operator


class ComplianceStatus(str, Enum):
    """Current compliance state of a worker"""
    ONBOARDING = "onboarding"
    ACTIVE = "active"
    RENEWAL_PENDING = "renewal_pending"
    MEDICAL_REVIEW = "medical_review"
    APPEAL_PENDING = "appeal_pending"
    EXPIRED = "expired"
    DEADLOCK = "deadlock"
    REPATRIATION = "repatriation"


class RegulatoryGate(str, Enum):
    """Three-gate compliance architecture"""
    GATE_1_JTKSM = "gate_1_jtksm"  # Section 60K readiness
    GATE_2_KDN = "gate_2_kdn"      # Quota allocation
    GATE_3_JIM = "gate_3_jim"      # VDR and PLKS issuance


class AgentType(str, Enum):
    """Specialist agents in the system"""
    SUPERVISOR = "supervisor"
    AUDITOR = "auditor"
    STRATEGIST = "strategist"
    FILING = "filing"


class WorkerComplianceState(TypedDict):
    """
    State structure for LangGraph worker compliance workflow.
    This state is persisted and updated as the agent processes the worker.
    """
    # Core Identity
    worker_id: str
    passport_number: str
    full_name: str
    nationality: str

    # Employment Details
    sector: str
    permit_class: str
    current_salary_rm: Optional[float]
    employer_id: str

    # Critical Dates
    permit_issue_date: Optional[str]  # ISO format
    permit_expiry_date: Optional[str]
    passport_expiry_date: Optional[str]
    last_fomema_date: Optional[str]

    # Compliance State
    compliance_status: ComplianceStatus
    current_gate: Optional[RegulatoryGate]
    days_to_expiry: Optional[int]

    # Document Status
    documents_uploaded: Annotated[List[str], operator.add]  # List of document IDs
    documents_validated: bool
    missing_documents: Annotated[List[str], operator.add]

    # Medical Status
    fomema_status: Optional[str]  # suitable, unsuitable, pending, appeal_pending
    fomema_conditions: Annotated[List[str], operator.add]
    ncd_monitoring_enrolled: bool

    # Financial Calculations
    mtlm_levy_rm: Optional[float]
    outstanding_fines_rm: Optional[float]
    estimated_renewal_cost_rm: Optional[float]

    # Obligations & Tasks
    pending_obligations: Annotated[List[dict], operator.add]
    completed_obligations: Annotated[List[dict], operator.add]
    blocked_obligations: Annotated[List[dict], operator.add]

    # Agent Reasoning
    current_agent: AgentType
    agent_observations: Annotated[List[str], operator.add]  # Agent reasoning log
    tool_calls: Annotated[List[dict], operator.add]  # Tool execution history

    # HITL (Human-in-the-Loop)
    hitl_required: bool
    hitl_reason: Optional[str]
    hitl_data: Optional[dict]

    # Alerts & Risks
    alerts: Annotated[List[dict], operator.add]
    deadlock_detected: bool
    deadlock_type: Optional[str]

    # Workflow Control
    next_action: Optional[str]
    workflow_complete: bool
    error_state: Optional[str]


class ParseJobState(TypedDict):
    """State for document parsing workflow"""
    job_id: str
    document_id: str
    document_type: str
    content_type: str
    storage_path: str

    # Triage
    triage_level: str  # L0 (digital), L1 (OCR), L2 (GLM-4V)
    ocr_confidence: Optional[float]

    # Extraction
    extracted_data: Optional[dict]
    extraction_confidence: Optional[float]

    # Validation
    validation_errors: Annotated[List[str], operator.add]
    requires_human_review: bool

    # Status
    status: str  # pending, processing, completed, failed
    error_message: Optional[str]


class ComplianceGraphState(TypedDict):
    """
    Global state for the compliance reasoning engine.
    Tracks company-level compliance metrics.
    """
    employer_id: str
    company_name: str
    sector: str

    # Workforce Composition
    total_foreign_workers: int
    total_local_workers: int
    foreign_to_local_ratio: float

    # MTLM Status
    current_mtlm_tier: str
    total_annual_levy_rm: float

    # Aggregate Risks
    workers_expiring_30_days: int
    workers_expiring_90_days: int
    workers_in_deadlock: int
    total_outstanding_fines_rm: float

    # Regulatory Compliance
    housing_capacity: int  # Act 446 bed spaces
    housing_certificates_valid: bool
    ssm_registration_valid: bool

    # Agent Activity
    active_workflows: Annotated[List[str], operator.add]  # List of worker_ids
    completed_workflows: Annotated[List[str], operator.add]
    failed_workflows: Annotated[List[str], operator.add]


def create_initial_worker_state(worker_data: dict) -> WorkerComplianceState:
    """Initialize a new worker compliance state from uploaded data"""
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
        error_state=None
    )


def calculate_days_to_expiry(permit_expiry_date: str) -> int:
    """Calculate days until permit expiry"""
    expiry = datetime.fromisoformat(permit_expiry_date.replace('Z', '+00:00'))
    today = datetime.now(expiry.tzinfo)
    return (expiry - today).days
