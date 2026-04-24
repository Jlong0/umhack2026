from __future__ import annotations
# PLKS (Pas Lawatan Kerja Sementara) route handlers

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import Optional

from app.services.plks_service import plks_service


router = APIRouter(prefix="/plks", tags=["plks"])


class CreatePLKSApplicationRequest(BaseModel):
    worker_id: str = Field(min_length=1)
    vdr_id: Optional[str] = None


class VerifyMDACRequest(BaseModel):
    worker_id: str = Field(min_length=1)
    arrival_date: str = Field(min_length=8)


class RegisterFOMEMARequest(BaseModel):
    clinic_code: str = Field(min_length=1)


class FOMEMAResultRequest(BaseModel):
    result: str


class TriggerCOMRequest(BaseModel):
    worker_id: str = Field(min_length=1)


@router.post("/applications")
async def create_application(payload: CreatePLKSApplicationRequest):
    try:
        plks_id = await plks_service.create_application(
            worker_id=payload.worker_id,
            vdr_id=payload.vdr_id,
        )
        return {
            "message": "PLKS application created",
            "plks_id": plks_id,
        }
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to create PLKS application: {exc}")


@router.post("/{plks_id}/verify-mdac")
async def verify_mdac(plks_id: str, payload: VerifyMDACRequest):
    try:
        verification = await plks_service.verify_mdac(
            worker_id=payload.worker_id,
            arrival_date=payload.arrival_date,
        )
        # keep plks state aligned
        status = await plks_service.get_status(plks_id)
        return {
            "plks_id": plks_id,
            "verification": verification,
            "status": status,
        }
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to verify MDAC: {exc}")


@router.post("/{plks_id}/register-fomema")
async def register_fomema(plks_id: str, payload: RegisterFOMEMARequest):
    try:
        return await plks_service.register_fomema(plks_id, payload.clinic_code)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to register FOMEMA: {exc}")


@router.patch("/{plks_id}/fomema-result")
async def update_fomema_result(plks_id: str, payload: FOMEMAResultRequest):
    try:
        return await plks_service.update_fomema_result(plks_id, payload.result)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to update FOMEMA result: {exc}")


@router.post("/{plks_id}/trigger-com")
async def trigger_com(plks_id: str, payload: TriggerCOMRequest):
    try:
        result = await plks_service.trigger_com(payload.worker_id)
        status = await plks_service.get_status(plks_id)
        return {
            "result": result,
            "status": status,
        }
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to trigger COM: {exc}")


@router.post("/{plks_id}/confirm-biometrics")
async def confirm_biometrics(plks_id: str):
    try:
        return await plks_service.confirm_biometrics(plks_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to confirm biometrics: {exc}")


@router.get("/{plks_id}/status")
async def get_plks_status(plks_id: str):
    try:
        return await plks_service.get_status(plks_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to get PLKS status: {exc}")


@router.get("/workers/{worker_id}/com-checklist")
async def get_com_checklist(worker_id: str):
    """
    Generate a structured COM (Check Out Memo) repatriation checklist for a worker
    declared FOMEMA UNFIT.

    Returns a full step-by-step repatriation guide including:
    - Case summary (worker, employer, FOMEMA result details)
    - 7 action steps with deadlines
    - Complete required document list
    - Important compliance warnings
    - Authority contact information
    """
    try:
        return await plks_service.generate_com_checklist(worker_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to generate COM checklist: {exc}")
