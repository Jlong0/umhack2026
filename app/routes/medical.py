from __future__ import annotations

from datetime import datetime
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.firebase_config import db
from app.services.vdr_service import vdr_service


router = APIRouter(prefix="/workers", tags=["medical"])


class VerifyMedicalRequest(BaseModel):
    biomedical_ref_number: str = Field(min_length=3)


@router.post("/{worker_id}/verify-medical")
async def verify_medical(worker_id: str, payload: VerifyMedicalRequest):
    worker_doc = db.collection("workers").document(worker_id).get()
    if not worker_doc.exists:
        raise HTTPException(status_code=404, detail="Worker not found")

    worker = worker_doc.to_dict()
    passport_no = worker.get("passport_number")
    if not passport_no:
        raise HTTPException(status_code=400, detail="Worker passport_number missing")

    verification = await vdr_service.ping_biomedical_database(
        ref_no=payload.biomedical_ref_number,
        passport_no=passport_no,
    )

    db.collection("workers").document(worker_id).set(
        {
            "biomedical_ref_number": verification["reference_number"],
            "biomedical_status": verification["status"],
            "updated_at": datetime.now().isoformat(),
        },
        merge=True,
    )

    return {
        "worker_id": worker_id,
        "verification": verification,
    }


@router.get("/{worker_id}/fomema-timeline")
async def get_fomema_timeline(worker_id: str):
    worker_doc = db.collection("workers").document(worker_id).get()
    if not worker_doc.exists:
        raise HTTPException(status_code=404, detail="Worker not found")

    worker = worker_doc.to_dict()

    plks_docs = db.collection("plks_applications").where("worker_id", "==", worker_id).stream()
    first = next(plks_docs, None)
    plks = first.to_dict() if first else {}

    return {
        "worker_id": worker_id,
        "arrival_date": worker.get("arrival_date"),
        "fomema_deadline": worker.get("fomema_deadline"),
        "registered_at": plks.get("fomema_registration_date"),
        "attended_at": plks.get("fomema_attended_date"),
        "result": plks.get("fomema_result", "pending"),
        "result_date": plks.get("fomema_result_date"),
    }
