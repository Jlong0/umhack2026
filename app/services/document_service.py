import os
from pathlib import Path
from uuid import uuid4
from datetime import datetime, timezone, date

from fastapi import HTTPException

from app.config import REQUIRED_WORKER_FIELDS
from app.firebase_config import db, bucket
from app.schemas.document import WorkerCreateRequest
from app.services.worker_service import create_worker, update_worker
from app.services.task_service import create_tasks_from_obligations
from app.services.compliance_reasoning_service import generate_compliance_obligations
from app.services.workflow_status_service import refresh_vdr_status

LOCAL_UPLOAD_DIR = Path("uploads")


async def save_uploaded_document(file, worker_id=None, document_type=None):
    ext = file.filename.split(".")[-1]
    filename = f"{uuid4()}.{ext}"
    storage_path = f"documents/{filename}"

    contents = await file.read()

    # Try Firebase Storage, fall back to local disk
    if bucket is not None:
        try:
            blob = bucket.blob(storage_path)
            blob.upload_from_string(contents, content_type=file.content_type)
        except Exception:
            bucket_ok = False
        else:
            bucket_ok = True
    else:
        bucket_ok = False

    if not bucket_ok:
        LOCAL_UPLOAD_DIR.mkdir(exist_ok=True)
        local_path = LOCAL_UPLOAD_DIR / filename
        local_path.write_bytes(contents)
        storage_path = str(local_path)

    doc_data = {
        "filename": file.filename,
        "stored_filename": filename,
        "storage_path": storage_path,
        "content_type": file.content_type,
        "worker_id": worker_id,
        "document_type": document_type,
        "uploaded_at": datetime.now(timezone.utc).isoformat()
    }

    doc_ref = db.collection("documents").add(doc_data)
    document_id = doc_ref[1].id

    return {
        "document_id": document_id,
        **doc_data
    }


def _normalize_obligations_to_tasks(obligations_payload) -> list[dict]:
    """
    Normalize obligations output into Firestore task documents.
    Supports:
    - list[dict] already in task format
    - list[str] obligation labels
    - dict with key "obligations" containing list[str|dict]
    """
    raw_items = obligations_payload
    if isinstance(obligations_payload, dict):
        raw_items = obligations_payload.get("obligations", [])

    if not isinstance(raw_items, list):
        return []

    tasks: list[dict] = []
    for idx, item in enumerate(raw_items):
        if isinstance(item, dict):
            task = dict(item)
            task.setdefault("task_type", f"OBLIGATION_{idx + 1}")
            task.setdefault("task_name", task.get("task_type", f"Obligation {idx + 1}"))
            task.setdefault("status", "pending")
            task.setdefault("depends_on", [])
            tasks.append(task)
            continue

        if isinstance(item, str):
            task_type = (
                item.upper()
                .replace("(", "")
                .replace(")", "")
                .replace("/", "_")
                .replace("-", "_")
                .replace(" ", "_")
            )[:60]
            tasks.append(
                {
                    "task_type": task_type or f"OBLIGATION_{idx + 1}",
                    "task_name": item,
                    "status": "pending",
                    "depends_on": [],
                }
            )

    return tasks

def serialize_dates(obj):
    if isinstance(obj, dict):
        return {k: serialize_dates(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [serialize_dates(v) for v in obj]
    elif isinstance(obj, date):
        return obj.isoformat()  # 🔥 convert to "YYYY-MM-DD"
    else:
        return obj

def deep_merge_dict(existing: dict, incoming: dict) -> dict:
    result = dict(existing or {})

    for key, value in (incoming or {}).items():
        if isinstance(value, dict) and isinstance(result.get(key), dict):
            result[key] = deep_merge_dict(result[key], value)
        else:
            result[key] = value

    return result


def create_worker_from_payload(payload: WorkerCreateRequest):
    raw = payload.model_dump(exclude_none=True)
    worker_id = raw.get("worker_id")

    if not worker_id:
        raise HTTPException(status_code=400, detail="worker_id is required")

    worker_ref = db.collection("workers").document(worker_id)
    existing_doc = worker_ref.get()

    if not existing_doc.exists:
        raise HTTPException(status_code=404, detail="Worker not found")

    existing_worker = existing_doc.to_dict()

    incoming_worker_data = {
        "passport": raw.get("passport") or {},
        "medical_information": raw.get("medical_information") or {},
        "general_information": raw.get("general_information") or {},
    }

    incoming_worker_data = serialize_dates(incoming_worker_data)

    worker_data = deep_merge_dict(existing_worker, incoming_worker_data)

    missing_fields = get_missing_required_fields(worker_data)

    now = datetime.now(timezone.utc).isoformat()

    worker_data["updated_at"] = now

    if missing_fields:
        worker_data["data_status"] = "incomplete"
        worker_data["missing_fields"] = missing_fields
        worker_data["review_status"] = "pending"
        worker_data["workflow_status"] = "missing_information"
    else:
        worker_data["data_status"] = "complete"
        worker_data["missing_fields"] = []
        worker_data["review_status"] = "pending_review"
        worker_data["workflow_status"] = "ready_for_admin_review"
        refresh_vdr_status(worker_ref, worker_data)

    update_worker(worker_id, worker_data)

    return {
        "status": worker_data["review_status"],
        "worker_id": worker_id,
        "data_status": worker_data["data_status"],
        "workflow_status": worker_data["workflow_status"],
        "missing_fields": worker_data["missing_fields"],
    }

def flatten_worker_for_compliance(worker_data: dict):
    passport = worker_data.get("passport", {}) or {}
    general = worker_data.get("general_information", {}) or {}

    return {
        "name": passport.get("full_name") or passport.get("name"),
        "passport_number": passport.get("passport_number"),
        "nationality": passport.get("nationality"),
        "passport_expiry_date": passport.get("passport_expiry_date"),
        "permit_expiry_date": general.get("permit_expiry_date"),
        "permit_class": general.get("permit_class"),
        "sector": general.get("sector"),
        "employment_date": general.get("employment_date"),
    }

def get_missing_required_fields(worker_data):
    passport = worker_data.get("passport", {})
    general = worker_data.get("general_information", {})

    missing = []

    if not passport.get("passport_number"):
        missing.append("passport.passport_number")

    if not passport.get("full_name"):
        missing.append("passport.full_name")

    if not general.get("address"):
        missing.append("general_information.address")

    return missing