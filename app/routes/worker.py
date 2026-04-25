from fastapi import APIRouter, HTTPException

from app.schemas.document import ConfirmDocumentResponse, WorkerCreateRequest
from app.schemas.worker import WorkerCreate
from app.services.document_service import create_worker_from_payload
from app.services.worker_service import create_worker
from app.firebase_config import db
from app.constants.application_fields import STAGE_1_PHASES, STAGE_2_PHASES

router = APIRouter()


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

            # keep full nested data for frontend/admin review
            "passport": passport,
            "general_information": general,
            "medical_information": medical,

            # optional flat fallback fields for old UI
            "full_name": passport.get("full_name") or w.get("full_name") or w.get("master_name"),
            "passport_number": passport.get("passport_number") or w.get("passport_number"),
            "nationality": passport.get("nationality") or w.get("nationality"),
            "sector": general.get("sector") or w.get("sector"),

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