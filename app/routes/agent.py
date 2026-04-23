"""
API routes for agent operations and compliance workflows.
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, Dict, List
from app.agents.graph import compliance_graph
from app.agents.state import create_initial_worker_state, WorkerComplianceState
from app.firebase_config import db
from datetime import datetime

router = APIRouter(prefix="/agents", tags=["agents"])


class StartWorkflowRequest(BaseModel):
    worker_id: str
    worker_data: Dict


class ResumeWorkflowRequest(BaseModel):
    user_decision: str
    additional_data: Optional[Dict] = None


class WorkflowStatusResponse(BaseModel):
    worker_id: str
    status: str
    current_agent: str
    compliance_status: str
    hitl_required: bool
    workflow_complete: bool
    alerts: List[Dict]
    observations: List[str]


@router.post("/workflows/start")
async def start_compliance_workflow(request: StartWorkflowRequest):
    """
    Start a new compliance workflow for a worker.
    Initializes the LangGraph state and begins agent processing.
    """
    try:
        existing_ref = db.collection("workflows").document(request.worker_id)
        existing_doc = existing_ref.get()
        if existing_doc.exists:
            existing_data = existing_doc.to_dict()
            existing_state = existing_data.get("current_state", {})
            if not existing_state.get("workflow_complete", False):
                return {
                    "message": "Workflow already active",
                    "worker_id": request.worker_id,
                    "thread_id": f"worker_{request.worker_id}",
                    "status": existing_state.get("compliance_status"),
                    "hitl_required": existing_state.get("hitl_required", False),
                    "workflow_complete": existing_state.get("workflow_complete", False),
                    "alerts": existing_state.get("alerts", [])
                }

        # Create initial state
        initial_state = create_initial_worker_state(request.worker_data)
        initial_state["worker_id"] = request.worker_id

        # Create thread config for persistence
        config = {
            "configurable": {
                "thread_id": f"worker_{request.worker_id}",
                "checkpoint_ns": "compliance"
            }
        }

        # Invoke the graph
        result = compliance_graph.invoke(initial_state, config)

        # Save workflow state to Firestore
        workflow_ref = db.collection("workflows").document(request.worker_id)
        workflow_ref.set({
            "worker_id": request.worker_id,
            "status": "active",
            "current_state": result,
            "started_at": datetime.now().isoformat(),
            "last_updated": datetime.now().isoformat()
        })

        return {
            "message": "Workflow started",
            "worker_id": request.worker_id,
            "thread_id": f"worker_{request.worker_id}",
            "status": result.get("compliance_status"),
            "hitl_required": result.get("hitl_required", False),
            "workflow_complete": result.get("workflow_complete", False),
            "alerts": result.get("alerts", [])
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Workflow start failed: {str(e)}")


@router.get("/workflows/{worker_id}/status")
async def get_workflow_status(worker_id: str):
    """
    Get the current status of a worker's compliance workflow.
    """
    try:
        workflow_ref = db.collection("workflows").document(worker_id)
        workflow_doc = workflow_ref.get()

        if not workflow_doc.exists:
            raise HTTPException(status_code=404, detail="Workflow not found")

        workflow_data = workflow_doc.to_dict()
        current_state = workflow_data.get("current_state", {})

        return WorkflowStatusResponse(
            worker_id=worker_id,
            status=workflow_data.get("status", "unknown"),
            current_agent=current_state.get("current_agent", "unknown"),
            compliance_status=current_state.get("compliance_status", "unknown"),
            hitl_required=current_state.get("hitl_required", False),
            workflow_complete=current_state.get("workflow_complete", False),
            alerts=current_state.get("alerts", []),
            observations=current_state.get("agent_observations", [])
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get workflow status: {str(e)}")


@router.post("/workflows/{worker_id}/resume")
async def resume_workflow_after_hitl(worker_id: str, request: ResumeWorkflowRequest):
    """
    Resume a workflow after human-in-the-loop decision.
    """
    try:
        # Get current workflow state
        workflow_ref = db.collection("workflows").document(worker_id)
        workflow_doc = workflow_ref.get()

        if not workflow_doc.exists:
            raise HTTPException(status_code=404, detail="Workflow not found")

        workflow_data = workflow_doc.to_dict()
        current_state = workflow_data.get("current_state", {})

        # Update state with human decision
        current_state["hitl_required"] = False
        current_state["hitl_decision"] = request.user_decision
        if request.additional_data:
            current_state["hitl_data"] = request.additional_data

        current_state["agent_observations"].append(
            f"[HITL] Human decision received: {request.user_decision}"
        )

        # Resume workflow
        config = {
            "configurable": {
                "thread_id": f"worker_{worker_id}",
                "checkpoint_ns": "compliance"
            }
        }

        result = compliance_graph.invoke(current_state, config)

        # Update Firestore
        workflow_ref.update({
            "current_state": result,
            "last_updated": datetime.now().isoformat()
        })

        return {
            "message": "Workflow resumed",
            "worker_id": worker_id,
            "status": result.get("compliance_status"),
            "workflow_complete": result.get("workflow_complete", False),
            "alerts": result.get("alerts", [])
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to resume workflow: {str(e)}")


@router.get("/workflows/{worker_id}/graph")
async def get_compliance_graph(worker_id: str):
    """
    Get the compliance graph visualization data for React Flow.
    """
    try:
        workflow_ref = db.collection("workflows").document(worker_id)
        workflow_doc = workflow_ref.get()

        if not workflow_doc.exists:
            raise HTTPException(status_code=404, detail="Workflow not found")

        workflow_data = workflow_doc.to_dict()
        current_state = workflow_data.get("current_state", {})

        # Build graph nodes for React Flow
        nodes = [
            {
                "id": "supervisor",
                "type": "agent",
                "data": {
                    "label": "Supervisor",
                    "active": current_state.get("current_agent") == "supervisor"
                },
                "position": {"x": 250, "y": 0}
            },
            {
                "id": "auditor",
                "type": "agent",
                "data": {
                    "label": "Auditor",
                    "active": current_state.get("current_agent") == "auditor",
                    "status": "completed" if current_state.get("documents_validated") else "pending"
                },
                "position": {"x": 50, "y": 150}
            },
            {
                "id": "strategist",
                "type": "agent",
                "data": {
                    "label": "Strategist",
                    "active": current_state.get("current_agent") == "strategist"
                },
                "position": {"x": 250, "y": 150}
            },
            {
                "id": "filing",
                "type": "agent",
                "data": {
                    "label": "Filing",
                    "active": current_state.get("current_agent") == "filing"
                },
                "position": {"x": 450, "y": 150}
            }
        ]

        edges = [
            {"id": "e1", "source": "supervisor", "target": "auditor"},
            {"id": "e2", "source": "supervisor", "target": "strategist"},
            {"id": "e3", "source": "supervisor", "target": "filing"},
            {"id": "e4", "source": "auditor", "target": "supervisor"},
            {"id": "e5", "source": "strategist", "target": "supervisor"},
            {"id": "e6", "source": "filing", "target": "supervisor"}
        ]

        return {
            "worker_id": worker_id,
            "nodes": nodes,
            "edges": edges,
            "current_agent": current_state.get("current_agent"),
            "compliance_status": current_state.get("compliance_status")
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get graph: {str(e)}")


@router.get("/workflows")
async def list_all_workflows():
    """
    List all active workflows.
    """
    try:
        workflows_ref = db.collection("workflows")
        workflows = workflows_ref.stream()

        result = []
        for workflow in workflows:
            data = workflow.to_dict()
            current_state = data.get("current_state", {})

            result.append({
                "worker_id": workflow.id,
                "status": data.get("status"),
                "compliance_status": current_state.get("compliance_status"),
                "hitl_required": current_state.get("hitl_required", False),
                "workflow_complete": current_state.get("workflow_complete", False),
                "started_at": data.get("started_at"),
                "last_updated": data.get("last_updated")
            })

        return {
            "total": len(result),
            "workflows": result
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to list workflows: {str(e)}")
