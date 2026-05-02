"""
Gate Transition Engine — manages the 6-stage permit pipeline.

JTKSM → VDR_PENDING → TRANSIT → FOMEMA → PLKS_ENDORSE → ACTIVE

Each transition updates both the `workflows` and `workers` collections
in Firestore, and broadcasts a WebSocket event for real-time UI updates.
"""
from __future__ import annotations

from datetime import datetime, timezone
from uuid import uuid4
from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.firebase_config import db

router = APIRouter(prefix="/gates", tags=["gates"])

GATE_ORDER = ["JTKSM", "VDR_PENDING", "TRANSIT", "FOMEMA", "PLKS_ENDORSE", "ACTIVE"]

GATE_TO_CURRENT_GATE = {
    "JTKSM": "gate_1_jtksm",
    "VDR_PENDING": "VDR_PENDING",
    "TRANSIT": "TRANSIT",
    "FOMEMA": "FOMEMA",
    "PLKS_ENDORSE": "PLKS_ENDORSE",
    "ACTIVE": "ACTIVE",
}


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _advance_gate(worker_id: str, target_gate: str, extra_state: dict = None, hitl_reason: str = None):
    """Core helper: advance a worker's gate in both workflows and workers collections."""
    now = _now_iso()

    # Update workflow
    wf_ref = db.collection("workflows").document(worker_id)
    wf_doc = wf_ref.get()
    if not wf_doc.exists:
        raise HTTPException(status_code=404, detail=f"Workflow for '{worker_id}' not found")

    wf_data = wf_doc.to_dict() or {}
    current_state = wf_data.get("current_state", {})

    current_state["current_gate"] = target_gate
    if hitl_reason:
        current_state["hitl_required"] = True
        current_state["hitl_reason"] = hitl_reason
    else:
        current_state["hitl_required"] = False
        current_state["hitl_reason"] = None

    if extra_state:
        current_state.update(extra_state)

    # Append to trace
    trace = wf_data.get("trace", [])
    trace.append({
        "node": f"gate_transition_{target_gate.lower()}",
        "status": "done",
        "timestamp": now,
        "output_summary": f"Advanced to {target_gate}",
        "error": None,
    })

    wf_ref.update({
        "current_state": current_state,
        "current_node": f"gate_{target_gate.lower()}",
        "last_updated": now,
        "updated_at": now,
        "trace": trace,
        "status": "completed" if target_gate == "ACTIVE" else "active",
        "pipeline_status": "completed" if target_gate == "ACTIVE" else "running",
    })

    # Update worker document
    worker_ref = db.collection("workers").document(worker_id)
    worker_update = {
        "current_gate": GATE_TO_CURRENT_GATE.get(target_gate, target_gate),
        "updated_at": now,
    }
    if target_gate == "ACTIVE":
        worker_update["workflow_status"] = "completed"
        worker_update["status"] = "active"
        worker_update["review_status"] = "approved"
    else:
        worker_update["workflow_status"] = "active"

    worker_ref.update(worker_update)

    return {
        "worker_id": worker_id,
        "previous_gate": wf_data.get("current_state", {}).get("current_gate", "JTKSM"),
        "current_gate": target_gate,
        "timestamp": now,
    }


# ── JTKSM → VDR_PENDING ──────────────────────────────────────


class ApproveJTKSMRequest(BaseModel):
    notes: Optional[str] = None


@router.post("/{worker_id}/approve-jtksm")
async def approve_jtksm(worker_id: str, body: ApproveJTKSMRequest = None):
    """Admin approves worker at JTKSM gate → moves to VDR_PENDING.
    Also auto-generates a mock visa letter.
    """
    result = _advance_gate(
        worker_id,
        "VDR_PENDING",
        extra_state={
            "compliance_status": "VDR_PENDING",
            "current_agent": "vdr_filing",
            "agent_observations": None,
        },
    )

    # Auto-generate visa letter
    now = _now_iso()
    worker_doc = db.collection("workers").document(worker_id).get()
    w = worker_doc.to_dict() if worker_doc.exists else {}

    company_id = w.get("company_id", "")
    company_doc = db.collection("companies").document(company_id).get() if company_id else None
    company = company_doc.to_dict() if (company_doc and company_doc.exists) else {}

    receipt_id = f"FWCMS-{datetime.now(timezone.utc).strftime('%Y%m%d')}-{uuid4().hex[:8].upper()}"

    visa_letter = {
        "worker_id": worker_id,
        "receipt_id": receipt_id,
        "status": "issued",
        "portal": "FWCMS",
        "form_type": "IMM.47",
        "worker_name": w.get("full_name", ""),
        "passport_number": w.get("passport_number", ""),
        "nationality": w.get("nationality", ""),
        "sector": w.get("sector", ""),
        "employer_name": company.get("company_name", company_id),
        "roc_number": company.get("roc_number", ""),
        "permit_class": w.get("permit_class", "PLKS"),
        "salary_rm": w.get("salary_rm"),
        "permit_expiry": w.get("permit_expiry_date", ""),
        "issued_at": now,
        "acknowledged": False,
        "acknowledged_at": None,
        "message": "Your IMM.47 Visa Application has been approved. Please acknowledge receipt to proceed.",
        "simulated": True,
    }

    db.collection("visa_letters").document(worker_id).set(visa_letter)

    # Add HITL interrupt for the worker to acknowledge
    result["visa_letter_receipt_id"] = receipt_id
    result["message"] = "Worker advanced to VDR_PENDING. Visa letter auto-generated and sent to worker portal."

    # Update workflow observations
    wf_ref = db.collection("workflows").document(worker_id)
    wf_doc = wf_ref.get()
    current_state = (wf_doc.to_dict() or {}).get("current_state", {})
    observations = current_state.get("agent_observations", []) or []
    observations.append(f"[VDR] JTKSM approved. Visa letter {receipt_id} generated.")
    current_state["agent_observations"] = observations
    wf_ref.update({"current_state": current_state})

    return result


# ── Worker acknowledges visa → TRANSIT ────────────────────────


@router.get("/{worker_id}/visa-letter")
async def get_visa_letter(worker_id: str):
    """Worker fetches their visa letter."""
    doc = db.collection("visa_letters").document(worker_id).get()
    if not doc.exists:
        return {"status": "not_found", "worker_id": worker_id, "letter": None}
    return {"status": "found", "worker_id": worker_id, "letter": doc.to_dict()}


@router.post("/{worker_id}/acknowledge-visa")
async def acknowledge_visa(worker_id: str):
    """Worker acknowledges visa letter receipt → auto-advance to TRANSIT.
    Creates HITL interrupt for admin to confirm arrival later.
    """
    doc_ref = db.collection("visa_letters").document(worker_id)
    doc = doc_ref.get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="No visa letter found for this worker")

    letter = doc.to_dict()
    if letter.get("acknowledged"):
        return {"message": "Already acknowledged", "current_gate": "TRANSIT"}

    now = _now_iso()
    doc_ref.update({"acknowledged": True, "acknowledged_at": now})

    # Advance to TRANSIT
    result = _advance_gate(
        worker_id,
        "TRANSIT",
        extra_state={
            "compliance_status": "TRANSIT",
            "current_agent": "transit",
            "agent_observations": None,
        },
        hitl_reason="arrival_confirmation",
    )

    # Update observations
    wf_ref = db.collection("workflows").document(worker_id)
    wf_doc = wf_ref.get()
    current_state = (wf_doc.to_dict() or {}).get("current_state", {})
    observations = current_state.get("agent_observations", []) or []
    observations.append(f"[Transit] Worker acknowledged visa letter. Awaiting arrival confirmation.")
    current_state["agent_observations"] = observations
    current_state["hitl_data"] = {"action": "confirm_arrival", "message": "Please confirm you have met and picked up this worker at the airport."}
    wf_ref.update({"current_state": current_state})

    result["message"] = "Visa acknowledged. Worker is now in TRANSIT. Admin must confirm arrival."
    return result


# ── Admin confirms arrival → FOMEMA ──────────────────────────


class ConfirmArrivalRequest(BaseModel):
    notes: Optional[str] = None


@router.post("/{worker_id}/confirm-arrival")
async def confirm_arrival(worker_id: str, body: ConfirmArrivalRequest = None):
    """Admin confirms worker has arrived and been picked up → moves to FOMEMA.
    Creates HITL interrupt for FOMEMA medical result approval.
    """
    result = _advance_gate(
        worker_id,
        "FOMEMA",
        extra_state={
            "compliance_status": "FOMEMA",
            "current_agent": "fomema",
            "agent_observations": None,
        },
        hitl_reason="fomema_medical_pending",
    )

    # Update observations
    wf_ref = db.collection("workflows").document(worker_id)
    wf_doc = wf_ref.get()
    current_state = (wf_doc.to_dict() or {}).get("current_state", {})
    observations = current_state.get("agent_observations", []) or []
    observations.append("[FOMEMA] Worker arrival confirmed. FOMEMA medical checkup required.")
    current_state["agent_observations"] = observations
    current_state["hitl_data"] = {
        "action": "approve_fomema",
        "message": "Worker needs to complete FOMEMA medical checkup. Review results and approve when ready.",
    }
    wf_ref.update({"current_state": current_state})

    # Update worker fomema_status
    db.collection("workers").document(worker_id).update({
        "fomema_status": "Scheduled",
        "updated_at": _now_iso(),
    })

    result["message"] = "Arrival confirmed. Worker moved to FOMEMA stage. Awaiting medical checkup results."
    return result


# ── Admin approves FOMEMA → PLKS_ENDORSE ─────────────────────


class ApproveFOMEMARequest(BaseModel):
    fomema_result: str = "suitable"
    notes: Optional[str] = None


@router.post("/{worker_id}/approve-fomema")
async def approve_fomema(worker_id: str, body: ApproveFOMEMARequest = None):
    """Admin reviews and approves FOMEMA medical result → moves to PLKS_ENDORSE."""
    fomema_result = body.fomema_result if body else "suitable"

    result = _advance_gate(
        worker_id,
        "PLKS_ENDORSE",
        extra_state={
            "compliance_status": "PLKS_ENDORSE",
            "current_agent": "plks_monitor",
        },
    )

    # Update worker fomema fields
    now = _now_iso()
    db.collection("workers").document(worker_id).update({
        "fomema_status": "Passed",
        "fomema_result": fomema_result,
        "fomema_result_date": now[:10],
        "fomema_attended_date": now[:10],
        "updated_at": now,
    })

    # Update observations
    wf_ref = db.collection("workflows").document(worker_id)
    wf_doc = wf_ref.get()
    current_state = (wf_doc.to_dict() or {}).get("current_state", {})
    observations = current_state.get("agent_observations", []) or []
    observations.append(f"[PLKS] FOMEMA result: {fomema_result}. Awaiting permit issuance.")
    current_state["agent_observations"] = observations
    current_state["hitl_data"] = None
    wf_ref.update({"current_state": current_state})

    result["message"] = f"FOMEMA approved ({fomema_result}). Worker moved to PLKS_ENDORSE. Awaiting permit."
    return result


# ── Permit issued → ACTIVE ────────────────────────────────────


@router.post("/{worker_id}/issue-permit")
async def issue_permit(worker_id: str):
    """Permit has been issued (auto or manual) → final transition to ACTIVE."""
    result = _advance_gate(
        worker_id,
        "ACTIVE",
        extra_state={
            "compliance_status": "ACTIVE",
            "workflow_complete": True,
            "current_agent": "filing",
        },
    )

    # Update worker
    now = _now_iso()
    db.collection("workers").document(worker_id).update({
        "status": "active",
        "workflow_status": "completed",
        "review_status": "approved",
        "data_status": "complete",
        "updated_at": now,
    })

    # Update observations
    wf_ref = db.collection("workflows").document(worker_id)
    wf_doc = wf_ref.get()
    current_state = (wf_doc.to_dict() or {}).get("current_state", {})
    observations = current_state.get("agent_observations", []) or []
    observations.append("[Active] PLKS permit issued. Worker is now fully compliant and active.")
    current_state["agent_observations"] = observations
    current_state["hitl_data"] = None
    wf_ref.update({"current_state": current_state})

    result["message"] = "Permit issued. Worker is now ACTIVE and fully compliant."
    return result


# ── Status endpoint ────────────────────────────────────────────


@router.get("/{worker_id}/status")
async def get_gate_status(worker_id: str):
    """Get current gate status for a worker."""
    wf_doc = db.collection("workflows").document(worker_id).get()
    if not wf_doc.exists:
        raise HTTPException(status_code=404, detail="Workflow not found")

    wf = wf_doc.to_dict() or {}
    current_state = wf.get("current_state", {})

    return {
        "worker_id": worker_id,
        "current_gate": current_state.get("current_gate", "JTKSM"),
        "hitl_required": current_state.get("hitl_required", False),
        "hitl_reason": current_state.get("hitl_reason"),
        "hitl_data": current_state.get("hitl_data"),
        "compliance_status": current_state.get("compliance_status"),
        "workflow_complete": current_state.get("workflow_complete", False),
        "observations": current_state.get("agent_observations", []),
    }
