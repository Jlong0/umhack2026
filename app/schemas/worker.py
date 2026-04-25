from pydantic import BaseModel

class WorkerCreate(BaseModel):
    passport: dict
    medical_information: dict
    general_information: dict

class WorkerDelete(BaseModel):
    name: str
    passport_number: str