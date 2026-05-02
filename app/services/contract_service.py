from datetime import datetime, timezone
from app.firebase_config import db


def generate_contract_for_worker(worker_id: str):
    worker_ref = db.collection("workers").document(worker_id)
    worker_doc = worker_ref.get()

    if not worker_doc.exists:
        return {
            "success": False,
            "error": "Worker not found",
        }

    worker = worker_doc.to_dict()

    # Avoid duplicate contract generation
    existing = (
        db.collection("contracts")
        .where("worker_id", "==", worker_id)
        .limit(1)
        .stream()
    )

    existing_doc = next(existing, None)

    if existing_doc:
        return {
            "success": True,
            "contract_id": existing_doc.id,
            "status": "already_exists",
        }

    passport = worker.get("passport", {}) or {}
    general = worker.get("general_information", {}) or {}

    worker_name = (
        passport.get("full_name")
        or worker.get("full_name")
        or worker_id
    )

    now = datetime.now(timezone.utc).isoformat()

    contract_ref = db.collection("contracts").document()

    contract_ref.set({
        "contract_id": contract_ref.id,
        "worker_id": worker_id,
        "company_id": worker.get("company_id"),
        "worker_name": worker_name,

        "status": "generated",
        "source": "auto_generated_after_medical_approval",

        "template_type": "employment_contract",
        "generated_fields": {
            "worker_name": worker_name,
            "passport_number": passport.get("passport_number"),
            "nationality": passport.get("nationality") or general.get("nationality"),
            "sector": general.get("sector"),
            "permit_class": general.get("permit_class"),
            "employment_date": general.get("employment_date"),
        },

        # Add real pdf/storage fields later
        "pdf_storage_path": None,
        "signed_pdf_storage_path": None,

        "created_at": now,
        "updated_at": now,
    })

    worker_ref.set({
        "contract_generated": True,
        "contract_id": contract_ref.id,
        "contract_generated_at": now,
        "updated_at": now,
    }, merge=True)

    return {
        "success": True,
        "contract_id": contract_ref.id,
        "status": "generated",
    }