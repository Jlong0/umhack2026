import random
import string
from datetime import datetime, timezone, timedelta

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.schemas.document import ConfirmDocumentResponse, WorkerCreateRequest
from app.schemas.worker import WorkerCreate
from app.services.document_service import create_worker_from_payload
from app.services.worker_service import create_worker
from app.firebase_config import db, bucket
from app.constants.application_fields import STAGE_1_PHASES, STAGE_2_PHASES

router = APIRouter()


class WorkerInviteRequest(BaseModel):
    name: str
    email: str
    whatsapp: str
    company_id: str = "demo-company"


class JTKSMDecision(BaseModel):
    decision: str  # approve | reject
    notes: str | None = None


def _generate_login_code(name: str) -> str:
    first = name.split()[0].lower()
    first = "".join(c for c in first if c.isalnum())
    digits = "".join(random.choices(string.digits, k=4))
    return f"{first}{digits}"


@router.get("/workers")
def list_workers_detail():
    workers = {d.id: d.to_dict() for d in db.collection("workers").stream()}
    vdr_map = {d.to_dict().get("worker_id"): d.to_dict() for d in db.collection("vdr_applications").stream()}
    plks_map = {d.to_dict().get("worker_id"): d.to_dict() for d in db.collection("plks_applications").stream()}
    comp_map = {d.id: d.to_dict() for d in db.collection("compliance_state").stream()}
    company_map = {d.id: d.to_dict() for d in db.collection("companies").stream()}

    result = []
    for wid, w in workers.items():
        vdr = vdr_map.get(wid, {})
        plks = plks_map.get(wid, {})
        comp = comp_map.get(wid, {})
        company = company_map.get(w.get("company_id"), {})
        merged = {**company, **w, **vdr, **plks}

        def phase_data(phase_def):
            return {f["key"]: merged.get(f["key"]) for f in phase_def["fields"]}

        passport = w.get("passport", {})
        general = w.get("general_information", {})
        medical = w.get("medical_information", {})

        result.append({
            "worker_id": wid,
            "company_id": w.get("company_id"),
            "company_name": company.get("company_name") or company.get("name"),

            # keep full nested data for frontend/admin review
            "passport": passport,
            "general_information": general,
            "medical_information": medical,

            # optional flat fallback fields for old UI
            "full_name": passport.get("full_name") or w.get("full_name") or w.get("master_name"),
            "passport_number": passport.get("passport_number") or w.get("passport_number"),
            "nationality": passport.get("nationality") or w.get("nationality"),
            "sector": general.get("sector") or w.get("sector"),

            "email": w.get("email"),
            "whatsapp": w.get("whatsapp"),
            "login_code": w.get("login_code"),

            "review_status": w.get("review_status"),
            "workflow_status": w.get("workflow_status"),
            "data_status": w.get("data_status"),
            "missing_fields": w.get("missing_fields", []),

            "current_gate": w.get("current_gate"),
            "jtksm_status": w.get("jtksm_status"),
            "jtksm_notes": w.get("jtksm_notes"),
            "jtksm_decided_at": w.get("jtksm_decided_at"),

            "stage_1": {k: {"label": v["label"], "data": phase_data(v)} for k, v in STAGE_1_PHASES.items()},
            "stage_2": {k: {"label": v["label"], "data": phase_data(v)} for k, v in STAGE_2_PHASES.items()},
            "compliance_state": comp,
            "validation_errors": comp.get("flags", []),
        })
    return {"workers": result, "total": len(result)}


@router.get("/workers/{worker_id}/obligations")
def list_worker_obligations(worker_id: str):
    try:
        docs = db.collection("worker_obligations").where("worker_id", "==", worker_id).stream()
        obligations = []
        for doc in docs:
            data = doc.to_dict() or {}
            obligations.append({"id": doc.id, **data})

        obligations.sort(key=lambda item: item.get("date") or "")
        return {"worker_id": worker_id, "obligations": obligations, "total": len(obligations)}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to list obligations: {exc}")


@router.post("/workers/invite")
def invite_worker(payload: WorkerInviteRequest):
    existing = list(db.collection("workers").stream())
    next_num = len(existing) + 1
    worker_id = f"worker-{next_num:03d}"

    while db.collection("workers").document(worker_id).get().exists:
        next_num += 1
        worker_id = f"worker-{next_num:03d}"

    login_code = _generate_login_code(payload.name)
    now = datetime.now(timezone.utc).isoformat()

    db.collection("workers").document(worker_id).set({
        "worker_id": worker_id,
        "company_id": payload.company_id,
        "full_name": payload.name,
        "master_name": payload.name,
        "email": payload.email,
        "whatsapp": payload.whatsapp,
        "login_code": login_code,
        "passport": {"full_name": payload.name},
        "general_information": {},
        "medical_information": {},
        "review_status": "pending",
        "current_gate": "JTKSM",
        "jtksm_status": "pending",
        "jtksm_notes": None,
        "jtksm_decided_at": None,
        "workflow_status": "jtksm_pending",
        "data_status": "incomplete",
        "missing_fields": [
            {
                "section": "passport",
                "label": "Passport Information",
                "reason": "Passport details are missing.",
            },
            {
                "section": "general_information",
                "label": "General Information",
                "reason": "General worker information is missing.",
            },
            {
                "section": "medical_information",
                "label": "Medical Information",
                "reason": "Medical checkup record is missing.",
            },
        ],
        "invited_at": now,
        "created_at": now,
        "updated_at": now,
    })

    return {
        "worker_id": worker_id,
        "name": payload.name,
        "login_code": login_code,
        "email": payload.email,
        "whatsapp": payload.whatsapp,
        "current_gate": "JTKSM",
        "jtksm_status": "pending",
    }


@router.get("/workers/{worker_id}/credentials")
def get_worker_credentials(worker_id: str):
    doc = db.collection("workers").document(worker_id).get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Worker not found")
    data = doc.to_dict()
    name = (
        data.get("full_name")
        or (data.get("passport") or {}).get("full_name")
        or data.get("master_name", "")
    )
    return {
        "worker_id": worker_id,
        "name": name,
        "login_code": data.get("login_code"),
        "email": data.get("email"),
        "whatsapp": data.get("whatsapp"),
    }


@router.post("/workers/assign-login-codes")
def assign_all_login_codes():
    """Backfill login codes for every worker that doesn't have one. Idempotent."""
    now = datetime.now(timezone.utc).isoformat()
    assigned = []
    skipped = []

    for doc in db.collection("workers").stream():
        data = doc.to_dict() or {}
        if data.get("login_code"):
            name = (
                data.get("full_name")
                or (data.get("passport") or {}).get("full_name")
                or data.get("master_name", doc.id)
            )
            skipped.append({
                "worker_id": doc.id,
                "name": name,
                "login_code": data["login_code"],
                "email": data.get("email"),
                "whatsapp": data.get("whatsapp"),
            })
            continue

        name = (
            data.get("full_name")
            or (data.get("passport") or {}).get("full_name")
            or data.get("master_name", doc.id)
        )
        code = _generate_login_code(name)
        db.collection("workers").document(doc.id).update({
            "login_code": code,
            "updated_at": now,
        })
        assigned.append({
            "worker_id": doc.id,
            "name": name,
            "login_code": code,
            "email": data.get("email"),
            "whatsapp": data.get("whatsapp"),
        })

    all_workers = assigned + skipped
    all_workers.sort(key=lambda w: w["worker_id"])
    return {
        "assigned": len(assigned),
        "already_had_code": len(skipped),
        "workers": all_workers,
    }


class UpdateContactRequest(BaseModel):
    email: str = ""
    whatsapp: str = ""


@router.patch("/workers/{worker_id}/update-contact")
def update_worker_contact(worker_id: str, payload: UpdateContactRequest):
    """Update email and/or WhatsApp number for an existing worker."""
    doc_ref = db.collection("workers").document(worker_id)
    if not doc_ref.get().exists:
        raise HTTPException(status_code=404, detail="Worker not found")
    update: dict = {"updated_at": datetime.now(timezone.utc).isoformat()}
    if payload.email:
        update["email"] = payload.email
    if payload.whatsapp:
        update["whatsapp"] = payload.whatsapp
    doc_ref.update(update)
    return {"worker_id": worker_id, **update}


@router.post("/workers")
def add_worker(worker: WorkerCreate):
    worker_dict = worker.model_dump()
    worker_id = create_worker(worker_dict)

    return {
        "message": "worker created",
        "worker_id": worker_id,
        "data": worker_dict
    }

@router.post("/workers/create", response_model=ConfirmDocumentResponse)
def create_worker_endpoint(payload: WorkerCreateRequest):
    try:
        print(payload)
        result = create_worker_from_payload(payload)
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


def get_signed_file_url(storage_path: str) -> str:
    blob = bucket.blob(storage_path)

    return blob.generate_signed_url(
        version="v4",
        expiration=timedelta(minutes=30),
        method="GET",
    )


@router.get("/workers/{worker_id}/medical-image-url")
def get_worker_medical_image_url(worker_id: str):
    doc = db.collection("workers").document(worker_id).get()

    if not doc.exists:
        raise HTTPException(status_code=404, detail="Worker not found")

    worker = doc.to_dict()
    medical_info = worker.get("medical_information", {})
    storage_path = medical_info.get("storage_path")

    if not storage_path:
        raise HTTPException(status_code=404, detail="No medical image found")

    return {
        "worker_id": worker_id,
        "url": get_signed_file_url(storage_path),
    }


@router.patch("/workers/{worker_id}/jtksm-decision")
def update_jtksm_decision(worker_id: str, body: JTKSMDecision):
    worker_ref = db.collection("workers").document(worker_id)
    worker_doc = worker_ref.get()

    if not worker_doc.exists:
        raise HTTPException(status_code=404, detail="Worker not found")

    now = datetime.now(timezone.utc).isoformat()

    if body.decision == "approve":
        worker = worker_doc.to_dict()

        medical = worker.get("medical_information", {}) or {}
        missing_fields = worker.get("missing_fields", []) or {}

        update_data = {
            "jtksm_status": "approved",
            "current_gate": "VDR_PENDING",
            "workflow_status": "vdr_pending",
            "vdr_status": "pending",
            "vdr_requirements": {
                "profile_complete": worker.get("data_status") == "complete",
                "medical_uploaded": bool(medical.get("storage_path") or medical.get("document_id")),
                "health_check_approved": worker.get("health_check_result") == "approve",
                "contract_signed": bool(worker.get("contract_signed")),
                "contract_reviewed": bool(worker.get("contract_reviewed")),
            },
            "jtksm_notes": body.notes,
            "jtksm_decided_at": now,
            "updated_at": now,
        }

    elif body.decision == "reject":
        update_data = {
            "jtksm_status": "rejected",
            "current_gate": "JTKSM",
            "workflow_status": "jtksm_rejected",
            "review_status": "rejected",
            "jtksm_notes": body.notes,
            "jtksm_decided_at": now,
            "updated_at": now,
        }

    else:
        raise HTTPException(status_code=400, detail="decision must be approve or reject")

    worker_ref.set(update_data, merge=True)

    workflow_ref = db.collection("workflows").document(worker_id)
    workflow_doc = workflow_ref.get()

    if workflow_doc.exists:
        workflow = workflow_doc.to_dict()
        current_state = workflow.get("current_state", {}) or {}

        current_state.update({
            "current_gate": update_data["current_gate"],
            "jtksm_status": update_data["jtksm_status"],
            "workflow_status": update_data["workflow_status"],
            "vdr_status": update_data.get("vdr_status"),
        })

        workflow_ref.set({
            "current_state": current_state,
            "last_updated": now,
        }, merge=True)

    return {
        "worker_id": worker_id,
        "jtksm_status": update_data["jtksm_status"],
        "current_gate": update_data["current_gate"],
        "workflow_status": update_data["workflow_status"],
        "vdr_status": update_data.get("vdr_status"),
    }


@router.get("/workers/{worker_id}/status")
def get_worker_status(worker_id: str):
    doc = db.collection("workers").document(worker_id).get()

    if not doc.exists:
        raise HTTPException(status_code=404, detail="Worker not found")

    worker = doc.to_dict()

    return {
        "worker_id": worker_id,
        "jtksm_status": worker.get("jtksm_status", "pending"),
        "workflow_status": worker.get("workflow_status"),
        "current_gate": worker.get("current_gate", "JTKSM"),
    }