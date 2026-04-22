from pydantic import BaseModel

class ConfirmDocumentData(BaseModel):
    name: str
    passport_number: str
    nationality: str
    permit_expiry_date: str | None = None
    permit_class: str | None = None
    sector: str | None = None
    employment_date: str | None = None