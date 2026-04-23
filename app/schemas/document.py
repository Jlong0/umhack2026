from pydantic import BaseModel

class ConfirmDocumentData(BaseModel):
    name: str | None = None
    full_name: str | None = None
    passport_number: str
    nationality: str | None = None
    permit_expiry_date: str | None = None
    permit_class: str | None = None
    sector: str | None = None
    employment_date: str | None = None
