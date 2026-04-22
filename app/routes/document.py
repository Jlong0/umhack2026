from fastapi import APIRouter, UploadFile, File, Form, HTTPException, BackgroundTasks
from app.services.document_service import save_uploaded_document, confirm_document_and_create_worker
from app.schemas.document import ConfirmDocumentData
from app.services.parse_job_service import create_parse_job, process_parse_job, get_parse_job

router = APIRouter()


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

    document = await save_uploaded_document(file, worker_id, document_type)
    job = create_parse_job(document["document_id"])

    background_tasks.add_task(process_parse_job, job["job_id"], document["document_id"])

    return {
        "message": "upload received",
        "document_id": document["document_id"],
        "job_id": job["job_id"],
        "status": job["status"]
    }


@router.get("/documents/jobs/{job_id}")
def get_document_job(job_id: str):
    job = get_parse_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job


@router.post("/documents/{document_id}/confirm")
def confirm_document(document_id: str, payload: ConfirmDocumentData):
    result = confirm_document_and_create_worker(document_id, payload.model_dump())

    return {
        "message": "document confirmed and worker created",
        "document_id": document_id,
        "worker_id": result["worker_id"],
        "obligations_created": result["obligations_created"]
    }

