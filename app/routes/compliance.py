from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from datetime import datetime

from app.firebase_config import db


router = APIRouter(prefix="/compliance", tags=["compliance"])


class CheckGateRequest(BaseModel):
    worker_id: str = Field(min_length=1)


@router.post("/check-gate/{gate_name}")
async def check_gate(gate_name: str, payload: CheckGateRequest):
    normalized_gate = gate_name.strip().lower()
    if normalized_gate not in {"jtksm", "vdr", "fomema", "plks"}:
        raise HTTPException(status_code=400, detail="gate_name must be one of jtksm, vdr, fomema, plks")

    worker_doc = db.collection("workers").document(payload.worker_id).get()
    if not worker_doc.exists:
        raise HTTPException(status_code=404, detail="Worker not found")

    worker = worker_doc.to_dict()
    blockers: list[str] = []

    if normalized_gate == "jtksm":
        company_id = worker.get("company_id")
        if not company_id:
            blockers.append("missing_company_id")
        else:
            company_doc = db.collection("companies").document(company_id).get()
            if not company_doc.exists:
                blockers.append("company_not_found")
            else:
                company = company_doc.to_dict()
                if company.get("jtksm_60k_status") != "approved":
                    blockers.append("jtksm_60k_not_approved")
                if not company.get("act_446_expiry_date"):
                    blockers.append("act_446_expiry_missing")

    if normalized_gate == "vdr":
        vdr_docs = db.collection("vdr_applications").where("worker_id", "==", payload.worker_id).stream()
        first = next(vdr_docs, None)
        if not first:
            blockers.append("vdr_application_missing")
        else:
            vdr = first.to_dict()
            if vdr.get("status") not in {"ready", "submitted", "approved"}:
                blockers.append("vdr_not_ready")

    if normalized_gate == "fomema":
        plks_docs = db.collection("plks_applications").where("worker_id", "==", payload.worker_id).stream()
        first = next(plks_docs, None)
        if not first:
            blockers.append("plks_application_missing")
        else:
            plks = first.to_dict()
            if not plks.get("fomema_registration_date"):
                blockers.append("fomema_not_registered")

    if normalized_gate == "plks":
        plks_docs = db.collection("plks_applications").where("worker_id", "==", payload.worker_id).stream()
        first = next(plks_docs, None)
        if not first:
            blockers.append("plks_application_missing")
        else:
            plks = first.to_dict()
            if plks.get("fomema_result") != "fit":
                blockers.append("fomema_not_fit")
            if not plks.get("biometric_date"):
                blockers.append("biometric_not_done")

    ready = len(blockers) == 0
    return {
        "worker_id": payload.worker_id,
        "gate_name": normalized_gate,
        "ready": ready,
        "blockers": blockers,
        "checked_at": datetime.now().isoformat(),
    }
