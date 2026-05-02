from uuid import uuid4
from datetime import datetime, timezone

from fastapi import APIRouter, BackgroundTasks, HTTPException, UploadFile, File
from app.firebase_config import db, bucket
from app.agents.contract_agent import generate_contracts_for_all_workers, _save_pdf_bytes
from app.services.workflow_status_service import refresh_vdr_status

router = APIRouter(prefix="/contracts", tags=["contracts"])


@router.get("/demo-worker")
async def get_demo_worker():
    """Returns the first worker in Firestore — used as the demo worker on the worker portal."""
    docs = list(db.collection("workers").limit(1).stream())
    if not docs:
        raise HTTPException(status_code=404, detail="No workers found")
    data = docs[0].to_dict()
    worker_name = (
        data.get("full_name")
        or (data.get("passport") or {}).get("full_name")
        or data.get("master_name")
        or data.get("name", "Worker")
    )
    return {"worker_id": docs[0].id, "worker_name": worker_name}


@router.post("/generate")
async def generate_contracts(background_tasks: BackgroundTasks, template: UploadFile = File(...)):
    if template.content_type != "application/pdf":
        raise HTTPException(status_code=400, detail="Template must be a PDF")
    template_bytes = await template.read()
    job_id = str(uuid4())
    now = datetime.now(timezone.utc).isoformat()

    template_id = str(uuid4())
    storage_path = f"contract_templates/{template_id}.pdf"

    _save_pdf_bytes(template_bytes, storage_path)

    db.collection("contract_templates").document("latest").set({
        "template_id": template_id,
        "storage_path": storage_path,
        "filename": template.filename,
        "content_type": template.content_type,
        "uploaded_at": now,
    })

    background_tasks.add_task(generate_contracts_for_all_workers, template_bytes, job_id)
    return {"job_id": job_id, "message": "Contract generation started"}


@router.get("")
async def list_contracts(status: str = None, worker_id: str = None, company_id: str = None):
    ref = db.collection("contracts")
    docs = ref.stream()

    # Build worker allowlist when company_id is given
    allowed_workers = None
    if company_id:
        worker_docs = db.collection("workers").where("company_id", "==", company_id).stream()
        allowed_workers = {doc.id for doc in worker_docs}

    contracts = []
    for doc in docs:
        data = doc.to_dict()
        data["contract_id"] = doc.id
        if status and data.get("status") != status:
            continue
        if worker_id and data.get("worker_id") != worker_id:
            continue
        if allowed_workers is not None and data.get("worker_id") not in allowed_workers:
            continue
        contracts.append(data)
    return {"contracts": contracts, "total": len(contracts)}


@router.get("/{contract_id}/pdf")
async def get_contract_pdf(contract_id: str):
    doc = db.collection("contracts").document(contract_id).get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Contract not found")
    data = doc.to_dict()
    # Determine which PDF to serve: signed takes priority
    storage_path = data.get("signed_pdf_path") or data.get("generated_pdf_path")
    if not storage_path:
        raise HTTPException(status_code=404, detail="PDF not found")

    try:
        from datetime import timedelta
        blob = bucket.blob(storage_path)
        url = blob.generate_signed_url(expiration=timedelta(hours=1), version="v4")
        return {"url": url}
    except Exception:
        # Local fallback
        from pathlib import Path
        local = Path("uploads") / storage_path.split("/")[-1]
        if local.exists():
            from fastapi.responses import FileResponse
            return FileResponse(str(local), media_type="application/pdf")
        raise HTTPException(status_code=404, detail="PDF file not accessible")


@router.post("/{contract_id}/upload-signed")
async def upload_signed_contract(contract_id: str, file: UploadFile = File(...)):
    if file.content_type != "application/pdf":
        raise HTTPException(status_code=400, detail="Signed contract must be a PDF")

    doc_ref = db.collection("contracts").document(contract_id)
    doc = doc_ref.get()

    if not doc.exists:
        raise HTTPException(status_code=404, detail="Contract not found")

    contract = doc.to_dict()
    worker_id = contract.get("worker_id")

    if not worker_id:
        raise HTTPException(status_code=400, detail="Contract has no worker_id")

    contents = await file.read()
    filename = f"{uuid4()}.pdf"
    storage_path = f"contracts/signed/{filename}"

    uploaded = False

    if bucket is not None:
        try:
            bucket.blob(storage_path).upload_from_string(
                contents,
                content_type="application/pdf",
            )
            uploaded = True
        except Exception:
            pass

    if not uploaded:
        Path("uploads").mkdir(exist_ok=True)
        (Path("uploads") / filename).write_bytes(contents)
        storage_path = f"uploads/{filename}"

    now = datetime.now(timezone.utc).isoformat()

    # Update contract
    doc_ref.set({
        "signed_pdf_path": storage_path,
        "status": "signed",
        "signed_at": now,
        "updated_at": now,
    }, merge=True)

    # Update worker so VDR checklist knows contract is signed
    worker_ref = db.collection("workers").document(worker_id)
    worker_doc = worker_ref.get()

    if not worker_doc.exists:
        raise HTTPException(status_code=404, detail="Worker not found for contract")

    worker = worker_doc.to_dict()

    worker_update = {
        "contract_signed": True,
        "contract_signed_at": now,
        "signed_contract_id": contract_id,
        "signed_contract_path": storage_path,
        "updated_at": now,
    }

    worker_ref.set(worker_update, merge=True)

    worker.update(worker_update)
    vdr_result = refresh_vdr_status(worker_ref, worker)

    return {
        "contract_id": contract_id,
        "worker_id": worker_id,
        "status": "signed",
        "vdr_status": vdr_result["vdr_status"],
        "vdr_requirements": vdr_result["vdr_requirements"],
    }

@router.patch("/{contract_id}/review")
async def review_contract(contract_id: str):
    doc_ref = db.collection("contracts").document(contract_id)
    doc = doc_ref.get()

    if not doc.exists:
        raise HTTPException(status_code=404, detail="Contract not found")

    contract = doc.to_dict()
    worker_id = contract.get("worker_id")

    if not worker_id:
        raise HTTPException(status_code=400, detail="Contract has no worker_id")

    now = datetime.now(timezone.utc).isoformat()

    # 1. Update contract
    doc_ref.set({
        "status": "reviewed",
        "reviewed_at": now,
        "updated_at": now,
    }, merge=True)

    # 2. Update worker
    worker_ref = db.collection("workers").document(worker_id)
    worker_doc = worker_ref.get()

    if not worker_doc.exists:
        raise HTTPException(status_code=404, detail="Worker not found for contract")

    worker = worker_doc.to_dict()

    worker_update = {
        "contract_reviewed": True,
        "contract_reviewed_at": now,
        "reviewed_contract_id": contract_id,
        "updated_at": now,
    }

    worker_ref.set(worker_update, merge=True)

    # 3. Refresh VDR checklist
    worker.update(worker_update)
    vdr_result = refresh_vdr_status(worker_ref, worker)

    return {
        "contract_id": contract_id,
        "worker_id": worker_id,
        "status": "reviewed",
        "vdr_status": vdr_result["vdr_status"],
        "vdr_requirements": vdr_result["vdr_requirements"],
    }
