from pydantic import BaseModel

class WorkerCreate(BaseModel):
    name: str