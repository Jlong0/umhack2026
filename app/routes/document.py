from datetime import datetime, timezone
from uuid import uuid4
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, BackgroundTasks
from app.services.document_service import save_uploaded_document, confirm_document_and_create_worker
from app.schemas.document import ConfirmDocumentData
from app.services.parse_job_service import create_parse_job, process_parse_job, get_parse_job

router = APIRouter()
_local_documents = {}
_local_jobs = {}


async def _process_local_parse_job(job_id: str, document_id: str, document_type: str | None):
    job = _local_jobs.get(job_id)
    if not job:
        return

    job["status"] = "processing"
    job["updated_at"] = datetime.now(timezone.utc).isoformat()

    # Minimal mock payload so frontend upload + polling remains testable without Firebase.
    fields = {
        "full_name": {"value": "Test Worker", "confidence": 0.95},
        "passport_number": {"value": "P12345678", "confidence": 0.93},
        "document_type": {"value": document_type or "passport", "confidence": 1.0},
    }

    job["status"] = "completed"
    job["result"] = {
        "fields": fields,
        "triage_level": "L2",
        "method": "local_mock",
        "cost_rm": 0,
    }
    job["updated_at"] = datetime.now(timezone.utc).isoformat()


@router.post("/documents/upload")
async def upload_document(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    worker_id: str | None = Form(default=None),
    document_type: str | None = Form(default=None),
):
    allowed_types = ["image/jpeg", "image/png", "application/pdf"]
    if file.content_type not in allowed_types:
        raise HTTPException(status_code=400, detail="Unsupported file type")

    try:
        document = await save_uploaded_document(file, worker_id, document_type)
        job = create_parse_job(document["document_id"])

        background_tasks.add_task(process_parse_job, job["job_id"], document["document_id"])

        return {
            "message": "upload received",
            "document_id": document["document_id"],
            "job_id": job["job_id"],
            "status": job["status"]
        }
    except Exception:
        document_id = str(uuid4())
        job_id = str(uuid4())
        now = datetime.now(timezone.utc).isoformat()

        _local_documents[document_id] = {
            "document_id": document_id,
            "filename": file.filename,
            "worker_id": worker_id,
            "document_type": document_type,
            "created_at": now,
        }
        _local_jobs[job_id] = {
            "job_id": job_id,
            "document_id": document_id,
            "status": "queued",
            "result": None,
            "error": None,
            "created_at": now,
            "updated_at": now,
        }

        background_tasks.add_task(_process_local_parse_job, job_id, document_id, document_type)

        return {
            "message": "upload received (local fallback mode)",
            "document_id": document_id,
            "job_id": job_id,
            "status": "queued",
            "fallback_mode": "local"
        }


@router.get("/documents/jobs/{job_id}")
def get_document_job(job_id: str):
    if job_id in _local_jobs:
        return _local_jobs[job_id]

    job = get_parse_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job


@router.post("/documents/{document_id}/confirm")
def confirm_document(document_id: str, payload: ConfirmDocumentData):
    if document_id in _local_documents:
        return {
            "message": "document confirmed in local fallback mode",
            "document_id": document_id,
            "worker_id": str(uuid4()),
            "obligations_created": 0
        }

    result = confirm_document_and_create_worker(document_id, payload.model_dump())

    return {
        "message": "document confirmed and worker created",
        "document_id": document_id,
        "worker_id": result["worker_id"],
        "obligations_created": result["obligations_created"]
    }
