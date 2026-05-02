import json
import re
from datetime import date
from dateutil.relativedelta import relativedelta

_APPROVED_NATIONALITIES = {
    "bangladesh", "indonesia", "nepal", "myanmar", "vietnam",
    "cambodia", "laos", "pakistan", "sri lanka", "india",
    "philippines", "kazakhstan", "turkmenistan", "uzbekistan",
}

_VDR_SCHEMA_REQUIRED = {"form_fields", "null_fields", "submission_ready"}


def validate_vdr_json(data: dict) -> list[str]:
    errors = []
    missing = _VDR_SCHEMA_REQUIRED - data.keys()
    if missing:
        errors.append(f"VDR JSON missing keys: {', '.join(missing)}")
    if "submission_ready" in data and not isinstance(data["submission_ready"], bool):
        errors.append("submission_ready must be bool")
    return errors


def validate_worker_docs(state: dict) -> list[str]:
    errors = []
    today = date.today()

    if state.get("passport_expiry"):
        try:
            expiry = date.fromisoformat(state["passport_expiry"])
            if expiry < today + relativedelta(months=18):
                errors.append("Passport expires in < 18 months.")
        except (ValueError, TypeError):
            pass

    if state.get("worker_dob"):
        try:
            dob = date.fromisoformat(state["worker_dob"])
            if relativedelta(today, dob).years > 45:
                errors.append("Worker age exceeds 45.")
        except (ValueError, TypeError):
            pass

    bio_ref = str(state.get("biomedical_ref") or "")
    if not re.fullmatch(r"\d{10,12}", bio_ref):
        errors.append("Bio-medical reference must be 10–12 digits.")

    nationality = (state.get("nationality") or "").lower().strip()
    if nationality and nationality not in _APPROVED_NATIONALITIES:
        errors.append(f"Nationality '{nationality}' not on approved list.")

    return errors


def validate_compliance_state(state: dict) -> list[str]:
    errors = []
    if not state.get("worker_id"):
        errors.append("worker_id is required.")
    if not state.get("passport_number"):
        errors.append("passport_number is required.")
    return errors
