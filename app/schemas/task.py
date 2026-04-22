from pydantic import BaseModel
from enum import Enum

class TaskCreate(BaseModel):
    task_type: str
    status: str = "pending"
    due_date: str | None = None

class TaskStatus(str, Enum):
    pending = "pending"
    in_progress = "in_progress"
    completed = "completed"
    failed = "failed"
    blocked = "blocked"

class TaskStatusUpdate(BaseModel):
    status: TaskStatus