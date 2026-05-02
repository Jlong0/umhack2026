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


def normalize_missing_fields(raw_missing):
    result = []

    for item in raw_missing or []:
        if isinstance(item, dict):
            section = item.get("section") or item.get("field") or "unknown"
            label = item.get("label") or section.replace("_", " ").title()
            reason = item.get("reason") or "This section requires review."

            result.append({
                "section": section,
                "field": item.get("field") or section,
                "label": label,
                "reason": reason,
                "value": item.get("value", ""),
            })
        else:
            field = str(item)

            result.append({
                "section": field.split(".")[0],
                "field": field,
                "label": field.split(".")[-1].replace("_", " ").title(),
                "reason": "This section requires review.",
                "value": "",
            })

    return result


def build_missing_sections(worker: dict):
    sections = []

    passport = worker.get("passport", {}) or {}
    general = worker.get("general_information", {}) or {}
    medical = worker.get("medical_information", {}) or {}

    passport_missing = []

    if not passport.get("full_name"):
        passport_missing.append({
            "field": "passport.full_name",
            "label": "Full Name",
        })

    if not passport.get("passport_number"):
        passport_missing.append({
            "field": "passport.passport_number",
            "label": "Passport Number",
        })

    if not passport.get("nationality"):
        passport_missing.append({
            "field": "passport.nationality",
            "label": "Nationality",
        })

    if not passport.get("date_of_birth"):
        passport_missing.append({
            "field": "passport.date_of_birth",
            "label": "Date of Birth",
        })

    if not passport.get("issue_date"):
        passport_missing.append({
            "field": "passport.issue_date",
            "label": "Passport Issue Date",
        })

    if not passport.get("expiry_date"):
        passport_missing.append({
            "field": "passport.expiry_date",
            "label": "Passport Expiry Date",
        })

    if passport_missing:
        sections.append({
            "section": "passport",
            "label": "Passport Information",
            "reason": "Passport information is incomplete.",
            "data": passport,
            "items": passport_missing,
        })

    general_missing = []

    if not general.get("address"):
        general_missing.append({
            "field": "general_information.address",
            "label": "Address",
        })

    if not general.get("emergency_contact_name"):
        general_missing.append({
            "field": "general_information.emergency_contact_name",
            "label": "Emergency Contact Name",
        })

    if not general.get("emergency_contact_phone"):
        general_missing.append({
            "field": "general_information.emergency_contact_phone",
            "label": "Emergency Contact Phone",
        })

    if not general.get("employment_history"):
        general_missing.append({
            "field": "general_information.employment_history",
            "label": "Employment History",
        })

    if general_missing:
        sections.append({
            "section": "general_information",
            "label": "General Information",
            "reason": "General worker information is incomplete.",
            "data": general,
            "items": general_missing,
        })

    medical_missing = []

    if not medical.get("storage_path") and not medical.get("document_id"):
        medical_missing.append({
            "field": "medical_information.storage_path",
            "label": "Medical Record",
        })

    if medical_missing:
        sections.append({
            "section": "medical_information",
            "label": "Medical Information",
            "reason": "Medical information is incomplete.",
            "data": medical,
            "items": medical_missing,
        })

    return sections

def set_nested_value(data: dict, dotted_key: str, value):
    keys = dotted_key.split(".")
    current = data

    for key in keys[:-1]:
        current = current.setdefault(key, {})

    current[keys[-1]] = value


@router.get("/workers")
async def list_workers():
    try:
        workers = []

        for doc in db.collection("workers").stream():
            data = doc.to_dict()
            worker_id = doc.id

            passport = data.get("passport", {}) or {}
            general_info = data.get("general_information", {}) or {}
            medical_info = data.get("medical_information", {}) or {}

            full_name = (
                passport.get("full_name")
                or data.get("full_name")
                or general_info.get("full_name")
                or worker_id
            )

            raw_missing = data.get("missing_fields", [])
            missing_fields = build_missing_sections(data)

            health_result = data.get("health_check_result")
            review_status = data.get("review_status", "")

            med_url = None

            storage_path = medical_info.get("storage_path")
            if storage_path:
                med_url = _signed_url(storage_path)

            if not med_url:
                medical_docs = (
                    db.collection("documents")
                    .where("worker_id", "==", worker_id)
                    .where("document_type", "in", ["fomema_report", "medical_checkup", "medical_record"])
                    .limit(1)
                    .stream()
                )

                for md in medical_docs:
                    med_url = _signed_url(md.to_dict().get("storage_path"))
                    break

            if missing_fields:
                workers.append({
                    "worker_id": worker_id,
                    "company_id": data.get("company_id"),
                    "full_name": full_name,
                    "whatsapp": data.get("whatsapp"),
                    "login_code": data.get("login_code"),
                    "email": data.get("email"),
                    "status": "pending",
                    "interrupt_type": "missing_field",
                    "reason": f"Missing required sections: {', '.join(f['label'] for f in missing_fields)}",
                    "missing_fields": missing_fields,
                    "passport_image_url": None,
                    "medical_form_url": med_url,
                    "medical_result": None,
                })

            elif review_status in ["pending", "pending_review"] and not health_result:
                workers.append({
                    "worker_id": worker_id,
                    "company_id": data.get("company_id"),
                    "full_name": full_name,
                    "whatsapp": data.get("whatsapp"),
                    "login_code": data.get("login_code"),
                    "email": data.get("email"),
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
                    "company_id": data.get("company_id"),
                    "full_name": full_name,
                    "whatsapp": data.get("whatsapp"),
                    "login_code": data.get("login_code"),
                    "email": data.get("email"),
                    "status": "complete",
                    "interrupt_type": None,
                    "reason": None,
                    "missing_fields": [],
                    "passport_image_url": None,
                    "medical_form_url": med_url,
                    "medical_result": health_result,
                })

        return {"workers": workers}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


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



@router.patch("/workers/{worker_id}/resolve-fields")
async def resolve_missing_fields(worker_id: str, body: FieldUpdate):
    worker_ref = db.collection("workers").document(worker_id)
    worker_doc = worker_ref.get()

    if not worker_doc.exists:
        raise HTTPException(status_code=404, detail="Worker not found")

    worker = worker_doc.to_dict()

    # Apply submitted updates only
    updates = dict(body.fields or {})

    # If no fields were submitted, do NOT clear missing_fields
    if not updates:
        raise HTTPException(
            status_code=400,
            detail="No fields submitted. Missing information cannot be marked complete."
        )

    # Apply dot-notation fields to local worker object
    for key, value in updates.items():
        set_nested_value(worker, key, value)

    # Recalculate missing sections based on updated worker data
    missing_sections = build_missing_sections(worker)

    update_data = {
        **updates,
        "missing_fields": [
            {
                "section": section["section"],
                "label": section["label"],
                "reason": section["reason"],
            }
            for section in missing_sections
        ],
        "data_status": "complete" if not missing_sections else "incomplete",
        "review_status": "pending" if missing_sections else "reviewed",
        "updated_at": datetime.now().isoformat(),
        "hitl_resolved_at": datetime.now().isoformat(),
    }

    worker_ref.update(update_data)

    return {
        "worker_id": worker_id,
        "status": "complete" if not missing_sections else "pending",
        "data_status": update_data["data_status"],
        "missing_fields": update_data["missing_fields"],
    }



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
