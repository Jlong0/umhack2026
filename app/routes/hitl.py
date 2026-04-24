"""
HITL (Human-in-the-Loop) interrupt system for high-stakes compliance decisions.
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, Dict, List
from app.firebase_config import db
from datetime import datetime

router = APIRouter(prefix="/hitl", tags=["hitl"])


class HITLInterrupt(BaseModel):
    worker_id: str
    interrupt_type: str
    reason: str
    data: Dict
    severity: str  # low, medium, high, critical


class HITLDecision(BaseModel):
    decision: str  # approve, reject, modify
    notes: Optional[str] = None
    modified_data: Optional[Dict] = None


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
