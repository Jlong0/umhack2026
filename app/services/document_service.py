from uuid import uuid4
from datetime import datetime, timezone
from app.firebase_config import db, bucket
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


def confirm_document_and_create_worker(document_id: str, confirmed_data: dict):
    document_ref = db.collection("documents").document(document_id)
    document_doc = document_ref.get()

    if not document_doc.exists:
        raise ValueError("Document not found")

    # create worker
    worker_id = create_worker(confirmed_data)

    obligations_payload = generate_compliance_obligations(confirmed_data)
    tasks = _normalize_obligations_to_tasks(obligations_payload)
    create_tasks_from_obligations(worker_id, tasks)

    # update document metadata
    document_ref.update({
        "confirmed": True,
        "confirmed_data": confirmed_data,
        "worker_id": worker_id,
        "confirmed_at": datetime.now(timezone.utc).isoformat()
    })

    return {
        "worker_id": worker_id,
        "obligations_created": len(tasks)
    }
