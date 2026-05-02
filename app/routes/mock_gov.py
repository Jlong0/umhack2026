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

class PLKSSubmission(BaseModel):
    worker_id: Optional[str] = None
    worker_name: Optional[str] = None
    passport_number: Optional[str] = None
    nationality: Optional[str] = None
    sector: Optional[str] = None
    employer_name: Optional[str] = None
    roc_number: Optional[str] = None
    fomema_status: Optional[str] = None
    arrival_date: Optional[str] = None
    levy_amount_rm: Optional[float] = None
    insurance_policy_no: Optional[str] = None
    security_bond_no: Optional[str] = None
    medical_exam_ref: Optional[str] = None


# ── FWCMS Portal ──────────────────────────────────────────


@router.get("/fwcms/worker/{worker_id}")
async def mock_fwcms_lookup(worker_id: str):
    """Simulate FWCMS portal lookup — returns data for autofill demo."""
    worker_doc = db.collection("workers").document(worker_id).get()
    wf_doc = db.collection("workflows").document(worker_id).get()

    w = worker_doc.to_dict()
    state = (wf_doc.to_dict() or {}).get("current_state", {}) if wf_doc.exists else {}

    passport = w.get("passport")
    general = w.get("general_information")

    # Pull company info
    company_id = w.get("company_id")
    company = {}
    if company_id:
        c_doc = db.collection("companies").document(company_id).get()
        company = c_doc.to_dict() if c_doc.exists else {}

    worker_name = passport.get("full_name")
    passport_no = passport.get("passport_number")
    nationality = passport.get("nationality")
    expiry_date = passport.get("expiry_date")
    sector = general.get("sector")
    permit_class = general.get("permit_class")

    return {
        "portal": "FWCMS",
        "status": "found" if w else "not_found",
        "worker_name": worker_name,
        "passport_number": passport_no,
        "nationality": nationality,
        "sector": sector,
        "permit_class": permit_class,
        "employer_name": company.get("company_name", w.get("company_id")),
        "form_fields": {
            "imm47_worker_name": worker_name,
            "imm47_passport_no": passport_no,
            "imm47_nationality": nationality,
            "imm47_sector": sector,
            "imm47_salary_rm": w.get("salary_rm") or 1600,
            "imm47_permit_expiry": expiry_date,
            "imm47_employer": company.get("company_name", ""),
            "imm47_roc_number": company.get("roc_number", ""),
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


@router.get("/plks/worker/{worker_id}")
async def mock_plks_lookup(worker_id: str):
    worker_doc = db.collection("workers").document(worker_id).get()

    if not worker_doc.exists:
        raise HTTPException(status_code=404, detail="Worker not found")

    w = worker_doc.to_dict()
    passport = w.get("passport", {}) or {}
    general = w.get("general_information", {}) or {}

    company_id = w.get("company_id")
    company = {}

    if company_id:
        c_doc = db.collection("companies").document(company_id).get()
        company = c_doc.to_dict() if c_doc.exists else {}

    return {
        "portal": "PLKS",
        "status": "found",
        "worker_id": worker_id,
        "form_fields": {
            "plks_worker_name": passport.get("full_name") or w.get("full_name"),
            "plks_passport_no": passport.get("passport_number"),
            "plks_nationality": passport.get("nationality") or general.get("nationality"),
            "plks_sector": general.get("sector"),
            "plks_employer": company.get("company_name") or "PermitIQ Demo Sdn Bhd",
            "plks_roc_number": company.get("roc_number") or "ROC-202401012345",
            "plks_fomema_status": w.get("fomema_status"),
            "plks_arrival_date": w.get("arrival_confirmed_at"),
            "plks_fomema_checked_at": w.get("fomema_checked_at"),
            "plks_levy_amount_rm": w.get("levy_amount_rm") or 1850,
            "plks_insurance_policy_no": w.get("insurance_policy_no") or "INS-DEMO-001",
            "plks_security_bond_no": w.get("security_bond_no") or "BOND-DEMO-001",
            "plks_medical_exam_ref": w.get("medical_exam_ref") or "FOMEMA-DEMO-001",
        },
        "simulated": True,
    }


@router.post("/plks/submit")
async def mock_submit_plks(payload: PLKSSubmission):
    now = datetime.now(timezone.utc)
    receipt_id = f"PLKS-{now.strftime('%Y%m%d')}-{uuid4().hex[:8].upper()}"

    db.collection("mock_gov_submissions").add({
        "portal": "PLKS",
        "form_type": "PLKS_APPLICATION",
        "receipt_id": receipt_id,
        "payload": payload.model_dump(),
        "status": "accepted",
        "submitted_at": now.isoformat(),
        "simulated": True,
    })

    if payload.worker_id:
        db.collection("workers").document(payload.worker_id).set({
            "plks_status": "approved",
            "plks_receipt_id": receipt_id,
            "plks_submitted_at": now.isoformat(),
            "current_gate": "ACTIVE",
            "workflow_status": "active",
            "active_status": "active",
            "updated_at": now.isoformat(),
        }, merge=True)

    return {
        "portal": "PLKS",
        "form_type": "PLKS_APPLICATION",
        "status": "accepted",
        "receipt_id": receipt_id,
        "message": "PLKS application approved successfully (simulated)",
        "estimated_processing": "Immediate demo approval",
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
            "company_id": w.get("company_id"),

            "current_gate": w.get("current_gate"),
            "workflow_status": w.get("workflow_status"),
            "vdr_status": w.get("vdr_status"),
            "vdr_submission_status": w.get("vdr_submission_status"),
        })
    return {"workers": workers, "total": len(workers)}


@router.post("/plks/submit")
async def mock_submit_plks(payload: PLKSSubmission):
    now = datetime.now(timezone.utc)
    receipt_id = f"PLKS-{now.strftime('%Y%m%d')}-{uuid4().hex[:8].upper()}"

    if not payload.worker_id:
        raise HTTPException(status_code=400, detail="worker_id is required")

    worker_ref = db.collection("workers").document(payload.worker_id)
    worker_doc = worker_ref.get()

    if not worker_doc.exists:
        raise HTTPException(status_code=404, detail="Worker not found")

    # Optional safety check
    worker = worker_doc.to_dict()
    if worker.get("current_gate") != "PLKS_ENDORSE":
        raise HTTPException(
            status_code=400,
            detail="Worker is not currently in PLKS endorsement stage.",
        )

    # Store simulated PLKS submission
    db.collection("mock_gov_submissions").add({
        "portal": "PLKS",
        "form_type": "PLKS_APPLICATION",
        "receipt_id": receipt_id,
        "payload": payload.model_dump(),
        "status": "accepted",
        "submitted_at": now.isoformat(),
        "simulated": True,
    })

    # Mark worker as active and end workflow
    worker_ref.set({
        "plks_status": "approved",
        "plks_receipt_id": receipt_id,
        "plks_submitted_at": now.isoformat(),

        "current_gate": "ACTIVE",
        "workflow_status": "active",
        "workflow_complete": True,
        "active_status": "active",
        "activated_at": now.isoformat(),

        "updated_at": now.isoformat(),
    }, merge=True)

    return {
        "portal": "PLKS",
        "form_type": "PLKS_APPLICATION",
        "status": "accepted",
        "receipt_id": receipt_id,
        "message": "PLKS application approved. Worker is now active.",
        "current_gate": "ACTIVE",
        "workflow_status": "active",
        "workflow_complete": True,
        "simulated": True,
    }