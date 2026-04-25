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

        result.append({
            "worker_id": wid,
            "full_name": w.get("full_name") or w.get("master_name"),
            "passport_number": w.get("passport_number"),
            "nationality": w.get("nationality"),
            "sector": w.get("sector"),
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