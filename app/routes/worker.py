from fastapi import APIRouter
from app.schemas.worker import WorkerCreate
from app.services.worker_service import create_worker

router = APIRouter()

@router.post("/workers")
def add_worker(worker: WorkerCreate):
    worker_dict = worker.dict()
    worker_id = create_worker(worker_dict)

    return {
        "message": "worker created",
        "worker_id": worker_id,
        "data": worker_dict
    }