from pydantic import BaseModel

class WorkerCreate(BaseModel):
    name: str
    passport_number: str
    nationality: str

class WorkerDelete(BaseModel):
    name: str
    passport_number: str