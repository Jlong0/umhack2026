"""
Orchestration State — TypedDict, enums, and factory function.

Defines the full state shape carried through the 10-node orchestration graph.
"""

from __future__ import annotations

from enum import Enum
from typing import Optional, TypedDict
from uuid import uuid4
from datetime import datetime, timezone


class OrchestrationStatus(str, Enum):
    ORCHESTRATING = "orchestrating"
    EXECUTING = "executing"
    REVIEWING = "reviewing"
    HITL_PAUSED = "hitl_paused"
    COMPLETED = "completed"
    FAILED = "failed"


class SpecialistType(str, Enum):
    VERIFIER = "verifier"
    FORM_FILLER = "form_filler"
    PORTAL_AGENT = "portal_agent"


# Task-type → specialist mapping
TASK_TYPE_TO_SPECIALIST: dict[str, SpecialistType] = {
    "verify_eligibility": SpecialistType.VERIFIER,
    "verify_documents": SpecialistType.VERIFIER,
    "verify_passport": SpecialistType.VERIFIER,
    "verify_biomedical": SpecialistType.VERIFIER,
    "verify_contract": SpecialistType.VERIFIER,
    "fill_imm47": SpecialistType.FORM_FILLER,
    "fill_plks": SpecialistType.FORM_FILLER,
    "generate_contract": SpecialistType.FORM_FILLER,
    "send_visa_letter": SpecialistType.FORM_FILLER,
    "submit_portal": SpecialistType.PORTAL_AGENT,
    "check_status": SpecialistType.PORTAL_AGENT,
}


class OrchestrationState(TypedDict):
    """Full state for the orchestration graph."""

    # Session / trigger
    session_id: str
    worker_id: str
    trigger_reason: str

    # Loaded context (entry_point populates these)
    worker_data: dict
    company_data: dict
    documents: dict

    # Planner output
    plan: list  # list[dict] — each: {task_id, task_type, description, target_form?, status}
    current_task_index: int

    # Specialist routing
    current_specialist: str
    specialist_reasoning: str
    specialist_result: dict
    retry_count: int

    # Accumulated results
    verification_results: list  # list[dict]
    form_fill_results: list     # list[dict]
    portal_results: list        # list[dict]

    # Critic
    critic_verdict: str
    critic_feedback: str
    critic_confidence: float

    # HITL
    hitl_required: bool
    hitl_reason: Optional[str]
    hitl_suggestions: list  # list[dict]

    # Pipeline sync
    pipeline_stage: str
    pipeline_updates: dict

    # Observability
    trace: list             # list[dict] — same schema as append_trace entries
    agent_statuses: dict    # {node_name: "pending"|"running"|"done"|"failed"}
    execution_log: list     # list[dict] — human-readable log

    # Overall
    status: str
    error: Optional[str]


def create_initial_orchestration_state(
    worker_id: str,
    trigger_reason: str = "manual",
) -> OrchestrationState:
    """Factory: build a fresh orchestration state for a given worker."""
    return OrchestrationState(
        session_id=f"orch_{uuid4().hex[:12]}",
        worker_id=worker_id,
        trigger_reason=trigger_reason,

        worker_data={},
        company_data={},
        documents={},

        plan=[],
        current_task_index=0,

        current_specialist="",
        specialist_reasoning="",
        specialist_result={},
        retry_count=0,

        verification_results=[],
        form_fill_results=[],
        portal_results=[],

        critic_verdict="",
        critic_feedback="",
        critic_confidence=1.0,

        hitl_required=False,
        hitl_reason=None,
        hitl_suggestions=[],

        pipeline_stage="",
        pipeline_updates={},

        trace=[],
        agent_statuses={},
        execution_log=[],

        status=OrchestrationStatus.ORCHESTRATING,
        error=None,
    )
