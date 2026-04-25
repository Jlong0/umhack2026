from uuid import uuid4
from datetime import datetime, timezone
from app.config import REQUIRED_WORKER_FIELDS
from app.firebase_config import db, bucket
from app.schemas.document import WorkerCreateRequest
from app.services.worker_service import create_worker
from app.services.task_service import create_tasks_from_obligations
from app.services.compliance_reasoning_service import generate_compliance_obligations


async def save_uploaded_document(file, worker_id=None, document_type=None):
    ext = file.filename.split(".")[-1]
    filename = f"{uuid4()}.{ext}"
    storage_path = f"documents/{filename}"

    contents = await file.read()

    blob = bucket.blob(storage_path)
    blob.upload_from_string(contents, content_type=file.content_type)

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


def create_worker_from_payload(payload: WorkerCreateRequest):
    worker_data = payload.model_dump(exclude_none=True)

    # 🔍 validate required fields
    missing_fields = get_missing_required_fields(worker_data)

    if missing_fields:
        return {
            "status": "incomplete",
            "missing_fields": missing_fields,
            "message": "More information is required before worker creation.",
        }

    # ✅ create worker
    worker_id = create_worker(worker_data)

    # 🧠 flatten for compliance engine
    compliance_input = flatten_worker_for_compliance(worker_data)

    obligations_payload = generate_compliance_obligations(compliance_input)
    tasks = _normalize_obligations_to_tasks(obligations_payload)

    create_tasks_from_obligations(worker_id, tasks)

    return {
        "status": "completed",
        "worker_id": worker_id,
        "obligations_created": len(tasks),
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

def get_missing_required_fields(worker_data: dict):
    passport = worker_data.get("passport", {}) or {}
    general = worker_data.get("general_information", {}) or {}

    required = {
        "passport.full_name": passport.get("full_name") or passport.get("name"),
        "passport.passport_number": passport.get("passport_number"),
        "passport.nationality": passport.get("nationality"),
        "general_information.permit_class": general.get("permit_class"),
        "general_information.sector": general.get("sector"),
    }

    return [field for field, value in required.items() if not value]