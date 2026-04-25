import os
from pathlib import Path
from uuid import uuid4
from datetime import datetime, timezone, date
from app.config import REQUIRED_WORKER_FIELDS
from app.firebase_config import db, bucket
from app.schemas.document import WorkerCreateRequest
from app.services.worker_service import create_worker
from app.services.task_service import create_tasks_from_obligations
from app.services.compliance_reasoning_service import generate_compliance_obligations

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

def create_worker_from_payload(payload: WorkerCreateRequest):
    raw = payload.model_dump(exclude_none=True)

    # 🔒 enforce structure
    worker_data = {
        "passport": raw.get("passport") or {},
        "medical_information": raw.get("medical_information") or {},
        "general_information": raw.get("general_information") or {},
    }

    worker_data = serialize_dates(worker_data)

    # 🔍 validate
    missing_fields = get_missing_required_fields(worker_data)

    # 📌 status flags
    worker_data["review_status"] = "pending_review"
    worker_data["workflow_status"] = "not_started"
    worker_data["created_at"] = datetime.now(timezone.utc).isoformat()
    worker_data["updated_at"] = datetime.now(timezone.utc).isoformat()

    if missing_fields:
        worker_data["data_status"] = "incomplete"
        worker_data["missing_fields"] = missing_fields
    else:
        worker_data["data_status"] = "complete"
        worker_data["missing_fields"] = []

    # ✅ create worker
    worker_id = create_worker(worker_data)

    return {
        "status": "pending_review",
        "worker_id": worker_id,
        "data_status": worker_data["data_status"],
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