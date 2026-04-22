from fastapi import APIRouter
from app.schemas.task import TaskCreate, TaskStatusUpdate
from app.services.task_service import create_task, list_tasks, update_task_status

router = APIRouter()

@router.post("/workers/{worker_id}/tasks")
def add_task(worker_id: str, task: TaskCreate):
    task_dict = task.dict()
    task_id = create_task(worker_id, task_dict)

    return {
        "message": "task created",
        "worker_id": worker_id,
        "task_id": task_id,
        "data": task
    }

@router.get("/workers/{worker_id}/tasks")
def get_tasks(worker_id: str):
    tasks = list_tasks(worker_id)
    return {
        "worker_id": worker_id,
        "tasks": tasks
    }

@router.patch("/workers/{worker_id}/tasks/{task_id}")
def patch_task_status(worker_id: str, task_id: str, payload: TaskStatusUpdate):
    update_task_status(worker_id, task_id, payload.status.value)
    return {
        "message": "task status updated",
        "worker_id": worker_id,
        "task_id": task_id,
        "new_status": payload.status
    }