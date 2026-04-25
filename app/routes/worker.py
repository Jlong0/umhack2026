from fastapi import APIRouter, HTTPException

from app.schemas.document import ConfirmDocumentResponse, WorkerCreateRequest
from app.schemas.worker import WorkerCreate
from app.services.document_service import create_worker_from_payload
from app.services.worker_service import create_worker

router = APIRouter()

@router.post("/workers")
def add_worker(worker: WorkerCreate):
    worker_dict = worker.model_dump()
    worker_id = create_worker(worker_dict)

    return {
        "message": "worker created",
        "worker_id": worker_id,
        "data": worker_dict
    }

@router.post("/workers/create", response_model=ConfirmDocumentResponse)
def create_worker_endpoint(payload: WorkerCreateRequest):
    try:
        result = create_worker_from_payload(payload)
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))