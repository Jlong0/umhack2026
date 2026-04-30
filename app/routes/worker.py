import random
import string
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.schemas.document import ConfirmDocumentResponse, WorkerCreateRequest
from app.schemas.worker import WorkerCreate
from app.services.document_service import create_worker_from_payload
from app.services.worker_service import create_worker
from app.firebase_config import db
from app.constants.application_fields import STAGE_1_PHASES, STAGE_2_PHASES

router = APIRouter()


class WorkerInviteRequest(BaseModel):
    name: str
    email: str
    whatsapp: str
    company_id: str = "demo-company"


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
        "workflow_status": "not_started",
        "data_status": "incomplete",
        "missing_fields": ["passport_number", "nationality", "sector", "permit_class", "permit_expiry_date"],
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
