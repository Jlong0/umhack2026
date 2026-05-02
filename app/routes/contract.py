from uuid import uuid4
from datetime import datetime, timezone

from fastapi import APIRouter, BackgroundTasks, HTTPException, UploadFile, File
from app.firebase_config import db, bucket
from app.agents.contract_agent import generate_contracts_for_all_workers


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
    if not doc_ref.get().exists:
        raise HTTPException(status_code=404, detail="Contract not found")

    contents = await file.read()
    filename = f"{uuid4()}.pdf"
    storage_path = f"contracts/signed/{filename}"

    uploaded = False
    if bucket is not None:
        try:
            bucket.blob(storage_path).upload_from_string(contents, content_type="application/pdf")
            uploaded = True
        except Exception:
            pass
    if not uploaded:
        from pathlib import Path
        Path("uploads").mkdir(exist_ok=True)
        (Path("uploads") / filename).write_bytes(contents)
        storage_path = f"uploads/{filename}"

    doc_ref.update({
        "signed_pdf_path": storage_path,
        "status": "signed",
        "signed_at": datetime.now(timezone.utc).isoformat(),
    })
    return {"contract_id": contract_id, "status": "signed"}


@router.patch("/{contract_id}/review")
async def review_contract(contract_id: str):
    doc_ref = db.collection("contracts").document(contract_id)
    if not doc_ref.get().exists:
        raise HTTPException(status_code=404, detail="Contract not found")
    doc_ref.update({
        "status": "reviewed",
        "reviewed_at": datetime.now(timezone.utc).isoformat(),
    })
    return {"contract_id": contract_id, "status": "reviewed"}
