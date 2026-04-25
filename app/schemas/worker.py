from typing import Optional
from pydantic import BaseModel


class WorkerCreate(BaseModel):
    name: str
    passport_number: str
    nationality: str
    master_name: Optional[str] = None
    dob: Optional[str] = None
    biomedical_ref: Optional[str] = None


class WorkerDelete(BaseModel):
    name: str
    passport_number: str
