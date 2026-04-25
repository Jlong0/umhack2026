from datetime import date
from typing import Literal, Optional
from pydantic import BaseModel, Field, field_validator, ConfigDict

DOCUMENT_TYPES = {
    "passport", "ssm_profile", "act446_certificate",
    "epf_socso_statement", "biomedical_slip", "borang100", "fomema_report",
}


class ConfirmDocumentData(BaseModel):
    model_config = ConfigDict(extra="ignore")

    full_name: str = Field(..., min_length=2, max_length=100)
    passport_number: str = Field(..., min_length=3, max_length=30)
    nationality: Optional[str] = Field(default=None, max_length=50)

    sector: str = Field()
    permit_class: str = Field(default="PLKS")

    passport_expiry_date: Optional[date] = None
    permit_expiry_date: Optional[date] = None

    @field_validator("full_name")
    @classmethod
    def validate_full_name(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("full_name cannot be empty")
        return v

    @field_validator("passport_number")
    @classmethod
    def validate_passport_number(cls, v: str) -> str:
        return v.strip().upper()

    @field_validator("sector")
    @classmethod
    def validate_sector(cls, v: str) -> str:
        allowed = {"manufacturing", "construction", "services", "plantation", "agriculture"}
        n = v.strip().lower()
        if n not in allowed:
            raise ValueError(f"sector must be one of: {', '.join(sorted(allowed))}")
        return n.title()

    @field_validator("permit_class")
    @classmethod
    def validate_permit_class(cls, v: str) -> str:
        allowed = {"plks", "temporary", "professional_visit_pass"}
        n = v.strip().lower()
        if n not in allowed:
            raise ValueError(f"permit_class must be one of: {', '.join(sorted(allowed))}")
        return n.upper() if n == "plks" else n


class ConfirmDocumentResponse(BaseModel):
    status: str
    worker_id: Optional[str] = None
    obligations: Optional[int] = None
    missing_fields: Optional[list[str]] = None


class DocumentUpload(BaseModel):
    document_type: str
    worker_id: Optional[str] = None

    @field_validator("document_type")
    @classmethod
    def validate_document_type(cls, v: str) -> str:
        if v not in DOCUMENT_TYPES:
            raise ValueError(f"document_type must be one of: {', '.join(sorted(DOCUMENT_TYPES))}")
        return v
