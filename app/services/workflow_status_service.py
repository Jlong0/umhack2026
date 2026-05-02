from datetime import datetime, timezone


def build_vdr_requirements(worker: dict) -> dict:
    medical = worker.get("medical_information", {}) or {}

    return {
        "profile_complete": worker.get("data_status") == "complete",
        "medical_uploaded": bool(
            medical.get("storage_path") or medical.get("document_id")
        ),
        "health_check_approved": worker.get("health_check_result") == "approve",
        "contract_signed": bool(worker.get("contract_signed")),
        "contract_reviewed": bool(worker.get("contract_reviewed")),
    }


def is_vdr_ready(worker: dict) -> bool:
    requirements = build_vdr_requirements(worker)
    return all(requirements.values())


def refresh_vdr_status(worker_ref, worker: dict) -> dict:
    """
    Recompute and save VDR requirements for a worker.
    Use this after profile update, medical review, contract signing, or contract review.
    """
    requirements = build_vdr_requirements(worker)
    now = datetime.now(timezone.utc).isoformat()

    vdr_status = "ready_for_approval" if all(requirements.values()) else "pending"

    worker_ref.set({
        "vdr_requirements": requirements,
        "vdr_status": vdr_status,
        "updated_at": now,
    }, merge=True)

    return {
        "vdr_requirements": requirements,
        "vdr_status": vdr_status,
    }