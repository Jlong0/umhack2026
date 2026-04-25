"""
HITL (Human-in-the-Loop) interrupt system.

Data flow:
  workers/{worker_id}  ←  documents.worker_id  ←  parse_jobs.document_id
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, Dict
from app.firebase_config import db, bucket
from datetime import datetime, timedelta

router = APIRouter(prefix="/hitl", tags=["hitl"])


class FieldUpdate(BaseModel):
    fields: Dict[str, str]


class MedicalResult(BaseModel):
    result: str  # approve | reject


class HITLDecision(BaseModel):
    decision: str
    notes: Optional[str] = None
    modified_data: Optional[Dict] = None


def _signed_url(storage_path: str) -> Optional[str]:
    if not storage_path or not bucket:
        return None
    try:
        return bucket.blob(storage_path).generate_signed_url(expiration=timedelta(hours=1))
    except Exception:
        return storage_path


@router.get("/workers")
async def list_workers():
    try:
        workers = []
        for doc in db.collection("workers").stream():
            data = doc.to_dict()
            worker_id = doc.id
            passport = data.get("passport", {}) or {}
            full_name = passport.get("full_name") or worker_id

            raw_missing = data.get("missing_fields", [])
            missing_fields = [
                {"field": f, "label": f.split(".")[-1].replace("_", " ").title(), "value": ""}
                for f in raw_missing
            ]

            health_result = data.get("health_check_result")
            review_status = data.get("review_status", "")

            if missing_fields:
                workers.append({
                    "worker_id": worker_id,
                    "full_name": full_name,
                    "status": "pending",
                    "interrupt_type": "missing_field",
                    "reason": f"Missing required fields: {', '.join(f['label'] for f in missing_fields)}",
                    "missing_fields": missing_fields,
                    "passport_image_url": None,
                    "medical_form_url": None,
                    "medical_result": None,
                })
            elif review_status == "pending_review" and not health_result:
                workers.append({
                    "worker_id": worker_id,
                    "full_name": full_name,
                    "status": "pending",
                    "interrupt_type": "health_check",
                    "reason": "Health status has not been reviewed by admin.",
                    "missing_fields": [],
                    "passport_image_url": None,
                    "medical_form_url": None,
                    "medical_result": None,
                })
            else:
                workers.append({
                    "worker_id": worker_id,
                    "full_name": full_name,
                    "status": "complete",
                    "interrupt_type": None,
                    "reason": None,
                    "missing_fields": [],
                    "passport_image_url": None,
                    "medical_form_url": None,
                    "medical_result": health_result,
                })

        return {"workers": workers}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.patch("/workers/{worker_id}/resolve-fields")
async def resolve_missing_fields(worker_id: str, body: FieldUpdate):
    worker_ref = db.collection("workers").document(worker_id)
    if not worker_ref.get().exists:
        raise HTTPException(status_code=404, detail="Worker not found")
    update = dict(body.fields)
    update["missing_fields"] = []
    update["data_status"] = "complete"
    update["hitl_resolved_at"] = datetime.now().isoformat()
    worker_ref.update(update)
    return {"worker_id": worker_id, "status": "complete"}


@router.patch("/workers/{worker_id}/medical-result")
async def set_medical_result(worker_id: str, body: MedicalResult):
    worker_ref = db.collection("workers").document(worker_id)
    if not worker_ref.get().exists:
        raise HTTPException(status_code=404, detail="Worker not found")
    worker_ref.update({
        "health_check_result": body.result,
        "review_status": "reviewed",
        "health_check_reviewed_at": datetime.now().isoformat(),
    })
    return {"worker_id": worker_id, "status": "complete" if body.result == "approve" else "rejected"}


@router.get("/interrupts")
async def list_pending_interrupts():
    try:
        interrupts = []
        for workflow in db.collection("workflows").where("current_state.hitl_required", "==", True).stream():
            data = workflow.to_dict()
            state = data.get("current_state", {})
            interrupts.append({
                "worker_id": workflow.id,
                "interrupt_type": state.get("hitl_reason"),
                "data": state.get("hitl_data"),
                "compliance_status": state.get("compliance_status"),
                "alerts": state.get("alerts", []),
                "created_at": data.get("last_updated"),
            })
        return {"total": len(interrupts), "interrupts": interrupts}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/interrupts/stats")
async def get_interrupt_statistics():
    try:
        total = pending = resolved = 0
        by_type: Dict[str, int] = {}
        for workflow in db.collection("workflows").stream():
            state = workflow.to_dict().get("current_state", {})
            if state.get("hitl_reason"):
                total += 1
                t = state["hitl_reason"]
                by_type[t] = by_type.get(t, 0) + 1
                if state.get("hitl_required"):
                    pending += 1
                else:
                    resolved += 1
        return {"total_interrupts": total, "pending": pending, "resolved": resolved, "by_type": by_type}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/interrupts/{worker_id}")
async def get_interrupt_details(worker_id: str):
    try:
        doc = db.collection("workflows").document(worker_id).get()
        if not doc.exists:
            raise HTTPException(status_code=404, detail="Workflow not found")
        state = doc.to_dict().get("current_state", {})
        if not state.get("hitl_required"):
            raise HTTPException(status_code=400, detail="No pending interrupt")
        return {
            "worker_id": worker_id,
            "interrupt_type": state.get("hitl_reason"),
            "reason": state.get("hitl_reason"),
            "data": state.get("hitl_data"),
            "worker_info": {
                "full_name": state.get("full_name"),
                "passport_number": state.get("passport_number"),
                "sector": state.get("sector"),
                "permit_class": state.get("permit_class"),
            },
            "compliance_status": state.get("compliance_status"),
            "alerts": state.get("alerts", []),
            "agent_observations": state.get("agent_observations", []),
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/interrupts/{worker_id}/resolve")
async def resolve_interrupt(worker_id: str, decision: HITLDecision):
    try:
        ref = db.collection("workflows").document(worker_id)
        doc = ref.get()
        if not doc.exists:
            raise HTTPException(status_code=404, detail="Workflow not found")
        state = doc.to_dict().get("current_state", {})
        if not state.get("hitl_required"):
            raise HTTPException(status_code=400, detail="No pending interrupt")
        state.update({
            "hitl_required": False,
            "hitl_decision": decision.decision,
            "hitl_decision_notes": decision.notes,
            "hitl_decision_timestamp": datetime.now().isoformat(),
        })
        if decision.modified_data:
            state["hitl_modified_data"] = decision.modified_data
        state.setdefault("agent_observations", []).append(
            f"[HITL] Decision: {decision.decision} - {decision.notes or 'No notes'}"
        )
        ref.update({"current_state": state, "last_updated": datetime.now().isoformat()})
        return {"message": "Interrupt resolved", "worker_id": worker_id, "decision": decision.decision, "workflow_will_resume": True}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


    result = []
    for field in raw_missing:
        result.append({
            "field": field,
            "label": field.replace("_", " ").title(),
            "value": parsed_fields.get(field, ""),
        })
    return result


@router.get("/workers")
async def list_workers():
    try:
        workers_snap = db.collection("workers").stream()
        workers = []

        for doc in workers_snap:
            data = doc.to_dict()
            worker_id = doc.id
            passport = data.get("passport", {}) or {}
            full_name = passport.get("full_name") or worker_id

            raw_missing = data.get("missing_fields", [])
            missing_fields = [
                {"field": f, "label": f.split(".")[-1].replace("_", " ").title(), "value": ""}
                for f in raw_missing
            ]

            health_result = data.get("health_check_result")
            review_status = data.get("review_status", "")

            if missing_fields:
                workers.append({
                    "worker_id": worker_id,
                    "full_name": full_name,
                    "status": "pending",
                    "interrupt_type": "missing_field",
                    "reason": f"Missing required fields: {', '.join(f['label'] for f in missing_fields)}",
                    "missing_fields": missing_fields,
                    "passport_image_url": None,
                    "medical_form_url": None,
                    "medical_result": None,
                })
            elif review_status == "pending_review" and not health_result:
                med_url = None
                for md in db.collection("documents").where("worker_id", "==", worker_id).where("document_type", "in", ["fomema_report", "medical_checkup"]).limit(1).stream():
                    med_url = _signed_url(md.to_dict().get("storage_path"))
                workers.append({
                    "worker_id": worker_id,
                    "full_name": full_name,
                    "status": "pending",
                    "interrupt_type": "health_check",
                    "reason": "Health status has not been reviewed by admin.",
                    "missing_fields": [],
                    "passport_image_url": None,
                    "medical_form_url": med_url,
                    "medical_result": None,
                })
            else:
                workers.append({
                    "worker_id": worker_id,
                    "full_name": full_name,
                    "status": "complete",
                    "interrupt_type": None,
                    "reason": None,
                    "missing_fields": [],
                    "passport_image_url": None,
                    "medical_form_url": None,
                    "medical_result": health_result,
                })

        return {"workers": workers}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.patch("/workers/{worker_id}/resolve-fields")
async def resolve_missing_fields(worker_id: str, body: FieldUpdate):
    worker_ref = db.collection("workers").document(worker_id)
    if not worker_ref.get().exists:
        raise HTTPException(status_code=404, detail="Worker not found")

    # body.fields keys are dot-notation e.g. "general_information.address"
    update = {k: v for k, v in body.fields.items()}
    update["missing_fields"] = []
    update["data_status"] = "complete"
    update["hitl_resolved_at"] = datetime.now().isoformat()
    worker_ref.update(update)

    return {"worker_id": worker_id, "status": "complete"}


@router.patch("/workers/{worker_id}/medical-result")
async def set_medical_result(worker_id: str, body: MedicalResult):
    worker_ref = db.collection("workers").document(worker_id)
    if not worker_ref.get().exists:
        raise HTTPException(status_code=404, detail="Worker not found")

    worker_ref.update({
        "health_check_result": body.result,
        "review_status": "reviewed",
        "health_check_reviewed_at": datetime.now().isoformat(),
    })

    return {"worker_id": worker_id, "status": "complete" if body.result == "approve" else "rejected"}


@router.get("/interrupts")
async def list_pending_interrupts():
    try:
        workflows = db.collection("workflows").where("current_state.hitl_required", "==", True).stream()
        interrupts = []
        for workflow in workflows:
            data = workflow.to_dict()
            state = data.get("current_state", {})
            interrupts.append({
                "worker_id": workflow.id,
                "interrupt_type": state.get("hitl_reason"),
                "data": state.get("hitl_data"),
                "compliance_status": state.get("compliance_status"),
                "alerts": state.get("alerts", []),
                "created_at": data.get("last_updated"),
            })
        return {"total": len(interrupts), "interrupts": interrupts}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/interrupts/stats")
async def get_interrupt_statistics():
    try:
        total = pending = resolved = 0
        by_type: Dict[str, int] = {}
        for workflow in db.collection("workflows").stream():
            state = workflow.to_dict().get("current_state", {})
            if state.get("hitl_reason"):
                total += 1
                t = state["hitl_reason"]
                by_type[t] = by_type.get(t, 0) + 1
                if state.get("hitl_required"):
                    pending += 1
                else:
                    resolved += 1
        return {"total_interrupts": total, "pending": pending, "resolved": resolved, "by_type": by_type}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/interrupts/{worker_id}")
async def get_interrupt_details(worker_id: str):
    try:
        doc = db.collection("workflows").document(worker_id).get()
        if not doc.exists:
            raise HTTPException(status_code=404, detail="Workflow not found")
        state = doc.to_dict().get("current_state", {})
        if not state.get("hitl_required"):
            raise HTTPException(status_code=400, detail="No pending interrupt")
        return {
            "worker_id": worker_id,
            "interrupt_type": state.get("hitl_reason"),
            "reason": state.get("hitl_reason"),
            "data": state.get("hitl_data"),
            "worker_info": {
                "full_name": state.get("full_name"),
                "passport_number": state.get("passport_number"),
                "sector": state.get("sector"),
                "permit_class": state.get("permit_class"),
            },
            "compliance_status": state.get("compliance_status"),
            "alerts": state.get("alerts", []),
            "agent_observations": state.get("agent_observations", []),
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/interrupts/{worker_id}/resolve")
async def resolve_interrupt(worker_id: str, decision: HITLDecision):
    try:
        ref = db.collection("workflows").document(worker_id)
        doc = ref.get()
        if not doc.exists:
            raise HTTPException(status_code=404, detail="Workflow not found")
        data = doc.to_dict()
        state = data.get("current_state", {})
        if not state.get("hitl_required"):
            raise HTTPException(status_code=400, detail="No pending interrupt")
        state.update({
            "hitl_required": False,
            "hitl_decision": decision.decision,
            "hitl_decision_notes": decision.notes,
            "hitl_decision_timestamp": datetime.now().isoformat(),
        })
        if decision.modified_data:
            state["hitl_modified_data"] = decision.modified_data
        state.setdefault("agent_observations", []).append(
            f"[HITL] Decision: {decision.decision} - {decision.notes or 'No notes'}"
        )
        ref.update({"current_state": state, "last_updated": datetime.now().isoformat()})
        return {"message": "Interrupt resolved", "worker_id": worker_id, "decision": decision.decision, "workflow_will_resume": True}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
