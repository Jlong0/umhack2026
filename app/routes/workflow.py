from fastapi import APIRouter, HTTPException
from app.firebase_config import db

router = APIRouter(prefix="/workflows", tags=["workflows"])


@router.get("")
def list_workflows():
    result = []

    for doc in db.collection("workers").stream():
        worker = doc.to_dict()
        worker_id = doc.id

        full_name = (
            worker.get("passport", {}).get("full_name")
            or worker.get("full_name")
            or worker_id
        )

        name_parts = full_name.split(" ", 1)

        result.append({
            "worker_id": worker_id,
            "full_name": full_name,
            "first_name": name_parts[0],
            "last_name": name_parts[1] if len(name_parts) > 1 else "",
            "company_id": worker.get("company_id"),

            # Pipeline fields
            "current_gate": worker.get("current_gate") or "JTKSM",
            "jtksm_status": worker.get("jtksm_status") or "pending",
            "workflow_status": worker.get("workflow_status"),

            # Display fields
            "nationality": (
                worker.get("passport", {}).get("nationality")
                or worker.get("general_information", {}).get("nationality")
            ),
            "sector": (
                worker.get("general_information", {}).get("sector")
                or worker.get("sector")
            ),
            "days_in_gate": worker.get("days_in_gate", 0),
        })

    return {"workflows": result}