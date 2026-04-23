import os
import logging
from uuid import uuid4
from datetime import datetime, timezone
from app.firebase_config import db, bucket
from app.services.worker_service import create_worker
from app.services.task_service import create_tasks_from_obligations
from app.services.compliance_reasoning_service import generate_compliance_obligations

UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)
logger = logging.getLogger(__name__)


async def save_uploaded_document(file, worker_id=None, document_type=None):
    ext = file.filename.split(".")[-1]
    filename = f"{uuid4()}.{ext}"
    storage_path = f"documents/{filename}"
    local_path = os.path.join(UPLOAD_DIR, filename)

    contents = await file.read()

    storage_backend = "gcs"
    try:
        blob = bucket.blob(storage_path)
        blob.upload_from_string(contents, content_type=file.content_type)
    except Exception as exc:
        # Dev fallback when cloud bucket IAM is not configured.
        storage_backend = "local"
        storage_path = None
        with open(local_path, "wb") as f:
            f.write(contents)
        logger.warning(
            "Falling back to local upload storage due to cloud upload error: %s",
            exc,
        )

    doc_data = {
        "filename": file.filename,
        "stored_filename": filename,
        "storage_path": storage_path,
        "local_path": local_path if storage_backend == "local" else None,
        "storage_backend": storage_backend,
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


def confirm_document_and_create_worker(document_id: str, confirmed_data: dict):
    document_ref = db.collection("documents").document(document_id)
    document_doc = document_ref.get()

    if not document_doc.exists:
        raise ValueError("Document not found")

    # create worker
    worker_id = create_worker(confirmed_data)

    obligations = generate_compliance_obligations(confirmed_data)
    create_tasks_from_obligations(worker_id, obligations)

    # update document metadata
    document_ref.update({
        "confirmed": True,
        "confirmed_data": confirmed_data,
        "worker_id": worker_id,
        "confirmed_at": datetime.now(timezone.utc).isoformat()
    })

    return {
        "worker_id": worker_id,
        "obligations_created": len(obligations)
    }
