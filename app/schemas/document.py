from datetime import date
from typing import Literal, Optional, Any
from pydantic import BaseModel, Field, field_validator, ConfigDict


class ConfirmDocumentData(BaseModel):
    model_config = ConfigDict(extra="ignore")

    full_name: str = Field(..., min_length=2, max_length=100)
    dob: Optional[date] = None
    passport_number: str = Field(..., min_length=3, max_length=30)
    nationality: Optional[str] = Field(default=None, max_length=50)

    sector: str = Field()
    permit_class: str = Field(default="PLKS")

    passport_expiry_date: Optional[date] = None
    permit_expiry_date: Optional[date] = None

    @field_validator("full_name")
    @classmethod
    def validate_full_name(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("full_name cannot be empty")
        return value

    @field_validator("passport_number")
    @classmethod
    def validate_passport_number(cls, value: str) -> str:
        value = value.strip().upper()
        if not value:
            raise ValueError("passport_number cannot be empty")
        return value

    @field_validator("sector")
    @classmethod
    def validate_sector(cls, value: str) -> str:
        allowed = {"manufacturing", "construction", "services", "plantation", "agriculture"}
        normalized = value.strip().lower()
        if normalized not in allowed:
            raise ValueError(f"sector must be one of: {', '.join(sorted(allowed))}")
        return normalized.title()

    @field_validator("permit_class")
    @classmethod
    def validate_permit_class(cls, value: str) -> str:
        allowed = {"plks", "temporary", "professional_visit_pass"}
        normalized = value.strip().lower()
        if normalized not in allowed:
            raise ValueError(f"permit_class must be one of: {', '.join(sorted(allowed))}")
        return normalized.upper() if normalized == "plks" else normalized

class PassportInfo(BaseModel):
    full_name: Optional[str] = None
    date_of_birth: Optional[date] = None
    sex: Optional[str] = None
    nationality: Optional[str] = None
    passport_number: Optional[str] = None
    issue_date: Optional[date] = None
    expiry_date: Optional[str] = None
    document_id: Optional[str] = None
    source: Literal["parsed", "manual"] = "parsed"

class MedicalInformation(BaseModel):
    source: Literal["raw_file"] = "raw_file"
    document_id: Optional[str] = None
    storage_path: Optional[str] = None
    document_type: str = "medical_record"

class GeneralInformation(BaseModel):
    marital_status: Optional[str] = None
    dependent_details: Optional[str] = None
    address: Optional[str] = None
    emergency_contact_name: Optional[str] = None
    emergency_contact_phone: Optional[str] = None
    family_background: Optional[str] = None
    education_history: Optional[str] = None
    employment_history: Optional[str] = None
    past_overseas_travel_history: Optional[str] = None

class WorkerCreateRequest(BaseModel):
    passport: PassportInfo
    medical_information: MedicalInformation
    general_information: GeneralInformation

class ConfirmDocumentResponse(BaseModel):
    status: str
    worker_id: Optional[str] = None
    obligations: Optional[int] = None
    missing_fields: Optional[list[str]] = None
