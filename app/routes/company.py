from __future__ import annotations

from fastapi import APIRouter, HTTPException, UploadFile, File
from pydantic import BaseModel, Field
from datetime import datetime, timezone
from uuid import uuid4

from app.firebase_config import db, bucket


router = APIRouter(prefix="/companies", tags=["companies"])


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


class UpsertCompanyRequest(BaseModel):
    company_id: str = Field(min_length=1)
    name: str | None = None
    sector: str | None = None
    ssm_number: str | None = None
    jtksm_60k_status: str = "none"
    act_446_expiry_date: str | None = None
    quota_balance: dict = Field(default_factory=dict)


@router.get("")
async def list_companies():
    try:
        companies = []
        for doc in db.collection("companies").stream():
            data = doc.to_dict() or {}
            companies.append({
                "id": doc.id,
                "company_id": doc.id,
                **data,
            })

        companies.sort(key=lambda company: company.get("company_name") or company.get("name") or company["id"])
        return {"companies": companies, "total": len(companies)}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to list companies: {exc}")


@router.post("")
async def upsert_company(payload: UpsertCompanyRequest):
    try:
        data = payload.model_dump()
        company_id = data.pop("company_id")
        data["updated_at"] = _now_iso()
        data.setdefault("created_at", _now_iso())

        db.collection("companies").document(company_id).set(data, merge=True)

        return {
            "message": "company upserted",
            "company_id": company_id,
        }
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to upsert company: {exc}")


@router.post("/{company_id}/upload-cert")
async def upload_company_certificate(
    company_id: str,
    cert_type: str,
    file: UploadFile = File(...),
):
    if cert_type not in {"act_446", "jtksm_60k"}:
        raise HTTPException(status_code=400, detail="cert_type must be act_446 or jtksm_60k")

    try:
        content = await file.read()
        ext = file.filename.rsplit(".", 1)[-1] if "." in file.filename else "bin"
        storage_path = f"companies/{company_id}/certificates/{cert_type}/{uuid4()}.{ext}"

        blob = bucket.blob(storage_path)
        blob.upload_from_string(content, content_type=file.content_type or "application/octet-stream")

        update_data = {
            "updated_at": _now_iso(),
            f"{cert_type}_cert_url": storage_path,
        }

        if cert_type == "jtksm_60k":
            update_data["jtksm_60k_status"] = "approved"

        db.collection("companies").document(company_id).set(update_data, merge=True)

        return {
            "message": "certificate uploaded",
            "company_id": company_id,
            "cert_type": cert_type,
            "storage_path": storage_path,
        }
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to upload certificate: {exc}")


@router.get("/{company_id}/quota-balance")
async def get_quota_balance(company_id: str):
    try:
        company_doc = db.collection("companies").document(company_id).get()
        if not company_doc.exists:
            raise HTTPException(status_code=404, detail="Company not found")

        data = company_doc.to_dict()
        quota_balance = data.get("quota_balance", {})
        return {
            "company_id": company_id,
            "quota_balance": quota_balance,
            "jtksm_60k_status": data.get("jtksm_60k_status", "none"),
            "act_446_expiry_date": data.get("act_446_expiry_date"),
        }
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to get quota balance: {exc}")
