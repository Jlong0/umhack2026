"""
HITL (Human-in-the-Loop) interrupt system for high-stakes compliance decisions.
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, Dict
from app.firebase_config import db, bucket
from datetime import datetime

router = APIRouter(prefix="/hitl", tags=["hitl"])


class HITLDecision(BaseModel):
    decision: str
    notes: Optional[str] = None
    modified_data: Optional[Dict] = None


class FieldUpdate(BaseModel):
    fields: Dict[str, str]


class MedicalResult(BaseModel):
    result: str


# Mock data — replace with Firestore query when workers collection is ready.
# Structure mirrors: workers/{worker_id}, documents/{doc_id} (worker_id, document_type, storage_path)
_MOCK_WORKERS = [
    {
        "worker_id": "W001",
        "full_name": "Ahmad bin Razak",
        "status": "pending",
        "interrupt_type": "missing_field",
        "reason": "Missing required fields: Passport Number",
        "missing_fields": [{"field": "passport_number", "label": "Passport Number", "value": ""}],
        "passport_image_url": "https://upload.wikimedia.org/wikipedia/commons/thumb/5/5e/Passport_Malaysia.jpg/320px-Passport_Malaysia.jpg",
        "medical_form_url": None,
    },
    {
        "worker_id": "W002",
        "full_name": "Nguyen Van Minh",
        "status": "pending",
        "interrupt_type": "health_check",
        "reason": "Health status has not been reviewed by admin.",
        "missing_fields": [],
        "passport_image_url": None,
        "medical_form_url": "https://www.w3.org/WAI/WCAG21/Techniques/pdf/img/table-word.jpg",
        "medical_result": None,
    },
    {
        "worker_id": "W003",
        "full_name": "Suresh Kumar",
        "status": "complete",
        "interrupt_type": None,
        "reason": None,
        "missing_fields": [],
        "passport_image_url": None,
        "medical_form_url": None,
    },
]


@router.get("/workers")
async def get_workers():
    """Return mock workers for HITL UI."""
    return {"workers": _MOCK_WORKERS}


@router.patch("/workers/{worker_id}/resolve-fields")
async def resolve_missing_fields(worker_id: str, body: FieldUpdate):
    worker = next((w for w in _MOCK_WORKERS if w["worker_id"] == worker_id), None)
    if not worker:
        raise HTTPException(status_code=404, detail="Worker not found")
    for f in worker["missing_fields"]:
        if f["field"] in body.fields:
            f["value"] = body.fields[f["field"]]
    worker["status"] = "complete"

    # Write to Firestore: merge fields into workers/{worker_id}.passport
    try:
        db.collection("workers").document(worker_id).update({
            f"passport.{field}": value
            for field, value in body.fields.items()
        } | {"hitl_resolved_at": datetime.now().isoformat()})
    except Exception:
        pass  # Firestore not available yet; mock data already updated

    return {"worker_id": worker_id, "status": "complete"}


@router.patch("/workers/{worker_id}/medical-result")
async def set_medical_result(worker_id: str, body: MedicalResult):
    worker = next((w for w in _MOCK_WORKERS if w["worker_id"] == worker_id), None)
    if not worker:
        raise HTTPException(status_code=404, detail="Worker not found")
    worker["medical_result"] = body.result
    worker["status"] = "complete" if body.result == "approve" else "rejected"

    # Write to Firestore: workers/{worker_id}
    try:
        db.collection("workers").document(worker_id).update({
            "health_check_result": body.result,
            "health_check_reviewed_at": datetime.now().isoformat(),
        })
    except Exception:
        pass

    return {"worker_id": worker_id, "status": worker["status"]}




@router.get("/interrupts")
async def list_pending_interrupts():
    try:
        workflows_ref = db.collection("workflows")
        workflows = workflows_ref.where("current_state.hitl_required", "==", True).stream()

        interrupts = []
        for workflow in workflows:
            data = workflow.to_dict()
            current_state = data.get("current_state", {})
            interrupts.append({
                "worker_id": workflow.id,
                "interrupt_type": current_state.get("hitl_reason"),
                "data": current_state.get("hitl_data"),
                "compliance_status": current_state.get("compliance_status"),
                "alerts": current_state.get("alerts", []),
                "created_at": data.get("last_updated")
            })

        return {"total": len(interrupts), "interrupts": interrupts}

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to list interrupts: {str(e)}")


@router.get("/interrupts/stats")
async def get_interrupt_statistics():
    try:
        all_workflows = db.collection("workflows").stream()

        total_interrupts = 0
        pending_interrupts = 0
        resolved_interrupts = 0
        interrupt_types = {}

        for workflow in all_workflows:
            current_state = workflow.to_dict().get("current_state", {})
            if current_state.get("hitl_reason"):
                total_interrupts += 1
                interrupt_type = current_state.get("hitl_reason")
                if current_state.get("hitl_required"):
                    pending_interrupts += 1
                else:
                    resolved_interrupts += 1
                interrupt_types[interrupt_type] = interrupt_types.get(interrupt_type, 0) + 1

        return {
            "total_interrupts": total_interrupts,
            "pending": pending_interrupts,
            "resolved": resolved_interrupts,
            "by_type": interrupt_types
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get statistics: {str(e)}")


@router.get("/interrupts/{worker_id}")
async def get_interrupt_details(worker_id: str):
    try:
        workflow_doc = db.collection("workflows").document(worker_id).get()

        if not workflow_doc.exists:
            raise HTTPException(status_code=404, detail="Workflow not found")

        workflow_data = workflow_doc.to_dict()
        current_state = workflow_data.get("current_state", {})

        if not current_state.get("hitl_required"):
            raise HTTPException(status_code=400, detail="No pending interrupt for this worker")

        return {
            "worker_id": worker_id,
            "interrupt_type": current_state.get("hitl_reason"),
            "reason": current_state.get("hitl_reason"),
            "data": current_state.get("hitl_data"),
            "worker_info": {
                "full_name": current_state.get("full_name"),
                "passport_number": current_state.get("passport_number"),
                "sector": current_state.get("sector"),
                "permit_class": current_state.get("permit_class")
            },
            "compliance_status": current_state.get("compliance_status"),
            "alerts": current_state.get("alerts", []),
            "agent_observations": current_state.get("agent_observations", [])
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get interrupt: {str(e)}")


@router.post("/interrupts/{worker_id}/resolve")
async def resolve_interrupt(worker_id: str, decision: HITLDecision):
    try:
        workflow_ref = db.collection("workflows").document(worker_id)
        workflow_doc = workflow_ref.get()

        if not workflow_doc.exists:
            raise HTTPException(status_code=404, detail="Workflow not found")

        workflow_data = workflow_doc.to_dict()
        current_state = workflow_data.get("current_state", {})

        if not current_state.get("hitl_required"):
            raise HTTPException(status_code=400, detail="No pending interrupt for this worker")

        current_state["hitl_required"] = False
        current_state["hitl_decision"] = decision.decision
        current_state["hitl_decision_notes"] = decision.notes
        current_state["hitl_decision_timestamp"] = datetime.now().isoformat()

        if decision.modified_data:
            current_state["hitl_modified_data"] = decision.modified_data

        current_state["agent_observations"].append(
            f"[HITL] Decision: {decision.decision} - {decision.notes or 'No notes'}"
        )

        workflow_ref.update({
            "current_state": current_state,
            "last_updated": datetime.now().isoformat()
        })

        return {
            "message": "Interrupt resolved",
            "worker_id": worker_id,
            "decision": decision.decision,
            "workflow_will_resume": True
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to resolve interrupt: {str(e)}")
