from datetime import datetime, timezone
from app.firebase_config import db


def update_workflow_doc(worker_id: str, update_data: dict):
    now = datetime.now(timezone.utc).isoformat()

    worker_doc = db.collection("workers").document(worker_id).get()
    worker = worker_doc.to_dict() if worker_doc.exists else {}

    db.collection("workflows").document(worker_id).set({
        "worker_id": worker_id,
        "company_id": update_data.get("company_id") or worker.get("company_id"),
        "current_gate": update_data.get("current_gate") or worker.get("current_gate"),
        "workflow_status": update_data.get("workflow_status") or worker.get("workflow_status"),
        "workflow_complete": update_data.get("workflow_complete", worker.get("workflow_complete", False)),
        "last_updated": now,
    }, merge=True)