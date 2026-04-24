from __future__ import annotations

from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from pydantic import BaseModel, Field
from typing import Any, Dict

from app.services.vdr_service import vdr_service


router = APIRouter(prefix="/vdr", tags=["vdr"])


class CreateVDRApplicationRequest(BaseModel):
    worker_id: str = Field(min_length=1)
    company_id: str = Field(min_length=1)


class VerifyBiomedicalRequest(BaseModel):
    biomedical_ref_number: str = Field(min_length=3)
    passport_no: str = Field(min_length=3)


@router.post("/applications")
async def create_application(payload: CreateVDRApplicationRequest):
    try:
        vdr_id = await vdr_service.create_application(
            company_id=payload.company_id,
            worker_id=payload.worker_id,
        )
        return {
            "message": "VDR application created",
            "vdr_id": vdr_id,
        }
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to create VDR application: {exc}")


@router.post("/{vdr_id}/upload/{doc_type}")
async def upload_vdr_document(
    vdr_id: str,
    doc_type: str,
    file: UploadFile = File(...),
):
    try:
        content = await file.read()
        result = await vdr_service.upload_document(
            vdr_id=vdr_id,
            doc_type=doc_type,
            filename=file.filename,
            content_type=file.content_type or "application/octet-stream",
            content=content,
        )
        return result
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to upload VDR document: {exc}")


@router.post("/{vdr_id}/verify-biomedical")
async def verify_biomedical(vdr_id: str, payload: VerifyBiomedicalRequest):
    try:
        verification = await vdr_service.ping_biomedical_database(
            ref_no=payload.biomedical_ref_number,
            passport_no=payload.passport_no,
        )
        updated = await vdr_service.set_biomedical_result(
            vdr_id=vdr_id,
            biomedical_ref_number=payload.biomedical_ref_number,
            biomedical_status=verification["status"],
        )
        return {
            "verification": verification,
            "updated": updated,
        }
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Biomedical verification failed: {exc}")


@router.post("/{vdr_id}/validate-photo")
async def validate_photo(
    vdr_id: str,
    file: UploadFile = File(...),
):
    try:
        photo_bytes = await file.read()
        validation = await vdr_service.validate_passport_photo(photo_bytes)

        # Keep endpoint behavior deterministic and idempotent: only report validation here.
        return {
            "vdr_id": vdr_id,
            "validation": validation,
        }
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Photo validation failed: {exc}")


@router.post("/{vdr_id}/generate-imm47")
async def generate_imm47(vdr_id: str):
    try:
        payload = await vdr_service.generate_imm47_payload(vdr_id)
        return {
            "vdr_id": vdr_id,
            "imm47_payload": payload,
        }
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to generate IMM.47 payload: {exc}")


@router.post("/{vdr_id}/prepare-filing")
async def prepare_filing(vdr_id: str):
    try:
        result = await vdr_service.prepare_filing_tasks(vdr_id)
        return result
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to prepare filing: {exc}")


@router.get("/{vdr_id}/checklist")
async def get_checklist(vdr_id: str):
    try:
        return await vdr_service.get_checklist_status(vdr_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to get checklist: {exc}")


@router.get("/{vdr_id}/status")
async def get_vdr_status(vdr_id: str):
    try:
        return await vdr_service.get_status(vdr_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to get VDR status: {exc}")
