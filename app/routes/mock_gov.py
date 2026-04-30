"""
Mock Malaysian government portal endpoints for demo purposes.

Simulates FWCMS, MyEG, and JIM portals with autofill data from
the agent's extracted worker state. All data comes from Firebase.
"""

from __future__ import annotations

from datetime import datetime, timezone
from uuid import uuid4

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, Dict

from app.firebase_config import db

router = APIRouter(prefix="/mock-gov", tags=["mock-gov"])


class IMM47Submission(BaseModel):
    worker_name: Optional[str] = None
    passport_number: Optional[str] = None
    nationality: Optional[str] = None
    sector: Optional[str] = None
    permit_class: Optional[str] = None
    salary_rm: Optional[float] = None
    employer_name: Optional[str] = None
    permit_expiry: Optional[str] = None


# ── FWCMS Portal ──────────────────────────────────────────


@router.get("/fwcms/worker/{worker_id}")
async def mock_fwcms_lookup(worker_id: str):
    """Simulate FWCMS portal lookup — returns data for autofill demo."""
    worker_doc = db.collection("workers").document(worker_id).get()
    wf_doc = db.collection("workflows").document(worker_id).get()

    w = worker_doc.to_dict() if worker_doc.exists else {}
    state = (wf_doc.to_dict() or {}).get("current_state", {}) if wf_doc.exists else {}

    # Pull company info
    company_id = w.get("company_id")
    company = {}
    if company_id:
        c_doc = db.collection("companies").document(company_id).get()
        company = c_doc.to_dict() if c_doc.exists else {}

    worker_name = w.get("full_name") or state.get("master_name") or ""
    passport_no = w.get("passport_number") or state.get("passport_number") or ""

    return {
        "portal": "FWCMS",
        "status": "found" if w else "not_found",
        "worker_name": worker_name,
        "passport_number": passport_no,
        "nationality": w.get("nationality") or state.get("nationality"),
        "sector": w.get("sector") or state.get("sector"),
        "permit_class": w.get("permit_class", "PLKS"),
        "employer_name": company.get("company_name", w.get("company_id")),
        "fomema_status": w.get("fomema_status") or state.get("fomema_status"),
        "form_fields": {
            "imm47_worker_name": worker_name,
            "imm47_passport_no": passport_no,
            "imm47_nationality": w.get("nationality"),
            "imm47_sector": w.get("sector"),
            "imm47_salary_rm": w.get("salary_rm"),
            "imm47_permit_expiry": w.get("permit_expiry_date"),
            "imm47_employer": company.get("company_name", ""),
            "imm47_roc_number": company.get("roc_number", ""),
            "imm47_fomema_status": w.get("fomema_status", "Pending"),
        },
        "simulated": True,
    }


@router.post("/fwcms/submit-imm47")
async def mock_submit_imm47(payload: IMM47Submission):
    """Simulate IMM.47 form submission — returns mock FWCMS receipt."""
    now = datetime.now(timezone.utc)
    receipt_id = f"FWCMS-{now.strftime('%Y%m%d')}-{uuid4().hex[:8].upper()}"

    # Store the mock submission in Firestore
    db.collection("mock_gov_submissions").add({
        "portal": "FWCMS",
        "form_type": "IMM.47",
        "receipt_id": receipt_id,
        "payload": payload.model_dump(),
        "status": "accepted",
        "submitted_at": now.isoformat(),
        "simulated": True,
    })

    return {
        "portal": "FWCMS",
        "form_type": "IMM.47",
        "status": "accepted",
        "receipt_id": receipt_id,
        "message": "IMM.47 visa application received successfully (simulated)",
        "estimated_processing": "5-7 working days",
        "simulated": True,
    }


# ── MyEG Portal ───────────────────────────────────────────


@router.get("/myeg/levy-status/{worker_id}")
async def mock_myeg_levy(worker_id: str):
    """Simulate MyEG levy status lookup."""
    rec = db.collection("mock_gov_records").document(worker_id).get()
    data = rec.to_dict() if rec.exists else {}
    return {
        "portal": "MyEG",
        "worker_id": worker_id,
        "levy_status": data.get("levy_status", "unknown"),
        "levy_amount_rm": data.get("levy_amount_rm"),
        "payment_channel": "MyEG Online",
        "simulated": True,
    }


@router.post("/myeg/pay-levy/{worker_id}")
async def mock_myeg_pay_levy(worker_id: str):
    """Simulate MyEG levy payment."""
    now = datetime.now(timezone.utc)
    receipt = f"MYEG-{now.strftime('%Y%m%d')}-{uuid4().hex[:6].upper()}"

    db.collection("mock_gov_records").document(worker_id).set(
        {"levy_status": "paid", "levy_receipt": receipt,
         "last_updated": now.isoformat()},
        merge=True,
    )
    return {
        "portal": "MyEG", "status": "paid", "receipt_id": receipt,
        "message": "Levy payment processed (simulated)", "simulated": True,
    }


# ── JIM Portal (Immigration) ─────────────────────────────


@router.get("/jim/permit-status/{worker_id}")
async def mock_jim_permit_status(worker_id: str):
    """Simulate JIM permit status check."""
    worker = db.collection("workers").document(worker_id).get()
    w = worker.to_dict() if worker.exists else {}
    return {
        "portal": "JIM",
        "worker_id": worker_id,
        "permit_class": w.get("permit_class", "PLKS"),
        "permit_expiry": w.get("permit_expiry_date"),
        "status": "active" if w.get("status") == "active" else "unknown",
        "simulated": True,
    }


# ── Available workers for demo ────────────────────────────


@router.get("/workers")
async def mock_gov_list_workers():
    """List workers available for mock gov portal demo."""
    workers = []
    for doc in db.collection("workers").stream():
        w = doc.to_dict()
        workers.append({
            "worker_id": doc.id,
            "full_name": w.get("full_name", "Unknown"),
            "passport_number": w.get("passport_number"),
            "nationality": w.get("nationality"),
            "sector": w.get("sector"),
        })
    return {"workers": workers, "total": len(workers)}
