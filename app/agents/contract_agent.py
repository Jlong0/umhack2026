from __future__ import annotations

import json
import re
from uuid import uuid4
from datetime import datetime, timezone
from pathlib import Path

from app.firebase_config import db, bucket

LOCAL_UPLOAD_DIR = Path("uploads")
_FITZ = None


def _get_fitz():
    global _FITZ
    if _FITZ is None:
        try:
            import fitz  # pymupdf
        except Exception as exc:
            raise RuntimeError(
                "PyMuPDF is unavailable. Install the correct package with `pip install PyMuPDF` "
                "and remove any conflicting `fitz` package."
            ) from exc
        _FITZ = fitz
    return _FITZ

# Maps search phrases in the PDF to worker field keys
LABEL_TO_FIELD = [
    ("Passport Number", "passport_number"),
    ("passport number", "passport_number"),
    ("Passport No", "passport_number"),
    ("IC/Passport", "passport_number"),
    ("Nationality", "nationality"),
    ("Sector", "sector"),
    ("Permit Class", "permit_class"),
    ("Permit Expiry", "permit_expiry_date"),
    ("Passport Expiry", "passport_expiry_date"),
    ("Arrival Date", "arrival_date"),
]


def _flatten_worker(worker: dict) -> dict:
    passport = worker.get("passport") or {}
    general = worker.get("general_information") or {}
    return {
        "full_name": worker.get("full_name") or passport.get("full_name") or passport.get("name") or worker.get("name", ""),
        "passport_number": worker.get("passport_number") or passport.get("passport_number", ""),
        "nationality": worker.get("nationality") or passport.get("nationality", ""),
        "sector": worker.get("sector") or general.get("sector", ""),
        "permit_class": worker.get("permit_class") or general.get("permit_class", ""),
        "permit_expiry_date": worker.get("permit_expiry_date") or general.get("permit_expiry_date", ""),
        "passport_expiry_date": worker.get("passport_expiry_date") or passport.get("passport_expiry_date", ""),
        "arrival_date": worker.get("arrival_date", ""),
    }


def _fill_name_blank(page, name: str):
    """Find the blank line for the employee name (before 'the Employee') and fill it."""
    # Search for all occurrences — pick the one near "the Employee", not "the Company"
    employee_hits = page.search_for("the Employee")
    company_hits = page.search_for("the Company")

    if not employee_hits:
        return

    # Use the y-position of the "the Employee" hit to find the right blank line
    emp_rect = employee_hits[0]

    # Search for underscore sequences on the same line
    underscore_hits = page.search_for("___")
    target = None
    for hit in underscore_hits:
        # Find the underscore line closest to (and above) the "the Employee" text
        if abs(hit.y0 - emp_rect.y0) < 15:
            target = hit
            break

    if target:
        insert_point = _get_fitz().Point(target.x0 + 2, target.y0 + target.height * 0.8)
    else:
        # Fallback: insert just to the left of "the Employee" text
        insert_point = _get_fitz().Point(72, emp_rect.y0 + emp_rect.height * 0.8)

    page.insert_text(insert_point, name, fontsize=10, color=(0, 0, 0))


def _insert_after_label(page, label: str, value: str):
    """Find label text on page and insert value right after it on the same baseline."""
    hits = page.search_for(label)
    if not hits:
        return
    rect = hits[0]
    insert_point = _get_fitz().Point(rect.x1 + 4, rect.y0 + rect.height * 0.8)
    page.insert_text(insert_point, value, fontsize=10, color=(0, 0, 0))


def fill_contract_for_worker(template_bytes: bytes, worker: dict) -> bytes:
    flat = _flatten_worker(worker)
    fitz = _get_fitz()
    doc = fitz.open(stream=template_bytes, filetype="pdf")

    for page in doc:
        # Fill worker name in the blank before "(hereinafter referred to as"
        if flat.get("full_name"):
            _fill_name_blank(page, flat["full_name"])

        # Fill labelled fields
        for label, field_key in LABEL_TO_FIELD:
            value = flat.get(field_key, "")
            if value:
                _insert_after_label(page, label, str(value))

    return doc.tobytes(deflate=True)


def _save_pdf_bytes(pdf_bytes: bytes, storage_path: str) -> bool:
    if bucket is not None:
        try:
            blob = bucket.blob(storage_path)
            blob.upload_from_string(pdf_bytes, content_type="application/pdf")
            return True
        except Exception:
            pass
    LOCAL_UPLOAD_DIR.mkdir(exist_ok=True)
    filename = storage_path.split("/")[-1]
    (LOCAL_UPLOAD_DIR / filename).write_bytes(pdf_bytes)
    return False


def generate_contracts_for_all_workers(template_bytes: bytes, job_id: str):
    """Background task: generate one contract PDF per worker."""
    workers = db.collection("workers").stream()
    worker_list = [(w.id, w.to_dict()) for w in workers]

    db.collection("contract_jobs").document(job_id).set({
        "status": "processing",
        "total": len(worker_list),
        "done": 0,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })

    done = 0
    errors = []
    for worker_id, worker in worker_list:
        try:
            flat = _flatten_worker(worker)
            pdf_bytes = fill_contract_for_worker(template_bytes, worker)
            filename = f"{uuid4()}.pdf"
            storage_path = f"contracts/{filename}"
            _save_pdf_bytes(pdf_bytes, storage_path)

            db.collection("contracts").add({
                "worker_id": worker_id,
                "worker_name": flat["full_name"] or "Unknown",
                "generated_pdf_path": storage_path,
                "signed_pdf_path": None,
                "status": "generated",
                "created_at": datetime.now(timezone.utc).isoformat(),
                "reviewed_at": None,
            })
            done += 1
        except Exception as e:
            errors.append({"worker_id": worker_id, "error": str(e)})

    db.collection("contract_jobs").document(job_id).update({
        "status": "done",
        "done": done,
        "errors": errors,
    })
