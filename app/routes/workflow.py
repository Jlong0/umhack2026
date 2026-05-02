from fastapi import APIRouter, HTTPException
from app.firebase_config import db
from app.services.compliance_graph_service import (
    build_agent_statuses_from_worker,
    infer_workflow_stage,
    build_execution_trace_from_worker,
)

router = APIRouter()


@router.get("/workflows/{worker_id}/trace")
def get_workflow_trace(worker_id: str):
    worker_ref = db.collection("workers").document(worker_id)
    worker_doc = worker_ref.get()

    if not worker_doc.exists:
        raise HTTPException(status_code=404, detail="Worker not found")

    worker = worker_doc.to_dict() or {}

    agent_statuses = build_agent_statuses_from_worker(worker)
    workflow_stage = infer_workflow_stage(worker)
    execution_trace = build_execution_trace_from_worker(worker_id, worker)

    return {
        "worker_id": worker_id,
        "agent_statuses": agent_statuses,
        "execution_trace": execution_trace,
        "workflow_stage": workflow_stage,
        "current_gate": worker.get("current_gate"),
        "workflow_status": worker.get("workflow_status"),
        "workflow_complete": (
            worker.get("workflow_complete") is True
            or worker.get("current_gate") == "ACTIVE"
            or worker.get("workflow_status") == "active"
        ),
    }

@router.get("/workflows")
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