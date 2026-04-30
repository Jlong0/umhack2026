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

        # Initialise trace fields before invoking graph
        initial_state["trace"] = []
        initial_state["current_node"] = None

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
                "position": {"x": 350, "y": 0}
            },
            {
                "id": "company_audit",
                "type": "agent",
                "data": {
                    "label": "Company Audit (JTKSM)",
                    "active": current_state.get("current_agent") == "auditor"
                            and current_state.get("next_action") == "company_audit",
                    "status": "completed" if current_state.get("alerts")
                             and any(a.get("type") == "jtksm_gate_blocked" for a in current_state.get("alerts", []))
                             else "pending"
                },
                "position": {"x": 0, "y": 120}
            },
            {
                "id": "auditor",
                "type": "agent",
                "data": {
                    "label": "Auditor",
                    "active": current_state.get("current_agent") == "auditor",
                    "status": "completed" if current_state.get("documents_validated") else "pending"
                },
                "position": {"x": 175, "y": 120}
            },
            {
                "id": "vdr_filing",
                "type": "agent",
                "data": {
                    "label": "VDR Filing",
                    "active": current_state.get("current_agent") == "filing"
                            and current_state.get("next_action") == "vdr_filing",
                },
                "position": {"x": 350, "y": 120}
            },
            {
                "id": "strategist",
                "type": "agent",
                "data": {
                    "label": "Strategist",
                    "active": current_state.get("current_agent") == "strategist"
                },
                "position": {"x": 175, "y": 260}
            },
            {
                "id": "plks_monitor",
                "type": "agent",
                "data": {
                    "label": "PLKS Monitor",
                    "active": current_state.get("current_agent") == "strategist"
                            and current_state.get("next_action") == "plks_monitor",
                },
                "position": {"x": 525, "y": 120}
            },
            {
                "id": "filing",
                "type": "agent",
                "data": {
                    "label": "Filing",
                    "active": current_state.get("current_agent") == "filing"
                },
                "position": {"x": 350, "y": 260}
            },
            {
                "id": "hitl",
                "type": "agent",
                "data": {
                    "label": "HITL Review",
                    "active": current_state.get("hitl_required", False)
                },
                "position": {"x": 525, "y": 260}
            },
        ]

        edges = [
            {"id": "e-sup-ca",  "source": "supervisor",    "target": "company_audit"},
            {"id": "e-sup-aud", "source": "supervisor",    "target": "auditor"},
            {"id": "e-sup-vdr", "source": "supervisor",    "target": "vdr_filing"},
            {"id": "e-sup-plk", "source": "supervisor",    "target": "plks_monitor"},
            {"id": "e-sup-str", "source": "supervisor",    "target": "strategist"},
            {"id": "e-sup-fil", "source": "supervisor",    "target": "filing"},
            {"id": "e-sup-hit", "source": "supervisor",    "target": "hitl"},
            {"id": "e-ca-sup",  "source": "company_audit", "target": "supervisor"},
            {"id": "e-aud-sup", "source": "auditor",       "target": "supervisor"},
            {"id": "e-vdr-sup", "source": "vdr_filing",    "target": "supervisor"},
            {"id": "e-plk-sup", "source": "plks_monitor",  "target": "supervisor"},
            {"id": "e-str-sup", "source": "strategist",    "target": "supervisor"},
            {"id": "e-fil-sup", "source": "filing",        "target": "supervisor"},
            {"id": "e-hit-sup", "source": "hitl",          "target": "supervisor"},
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
                "last_updated": data.get("last_updated"),
                "first_name": current_state.get("full_name", "").split()[0] if current_state.get("full_name") else "",
                "last_name": " ".join(current_state.get("full_name", "").split()[1:]) if current_state.get("full_name") else "",
                "nationality": current_state.get("nationality"),
                "sector": current_state.get("sector"),
                "current_gate": current_state.get("current_gate"),
                "days_in_gate": current_state.get("days_to_expiry"),
            })

        return {
            "total": len(result),
            "workflows": result
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to list workflows: {str(e)}")
# ---------------------------------------------------------------------------

@router.get("/handoffs")
async def list_pending_handoffs():
    docs = db.collection("pending_handoffs").stream()
    handoffs = []
    for doc in docs:
        data = doc.to_dict()
        if data.get("status") == "awaiting_confirmation":
            data["handoff_id"] = doc.id
            handoffs.append(data)
    return {"handoffs": handoffs, "total": len(handoffs)}


@router.post("/handoffs/{handoff_id}/confirm")
async def confirm_handoff(handoff_id: str):
    from datetime import timezone
    ref = db.collection("pending_handoffs").document(handoff_id)
    doc = ref.get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Handoff not found")
    now = datetime.now(timezone.utc).isoformat()
    date_str = datetime.now(timezone.utc).strftime("%Y%m%d")
    receipt_id = f"MOCK-FWCMS-{date_str}-{handoff_id[:5].upper()}"
    ref.update({"status": "confirmed"})
    db.collection("handoff_log").document(handoff_id).set({
        **doc.to_dict(),
        "status": "confirmed",
        "simulated": True,
        "receipt_id": receipt_id,
        "actioned_at": now,
    })
    return {"handoff_id": handoff_id, "receipt_id": receipt_id, "status": "confirmed"}


@router.post("/handoffs/{handoff_id}/reject")
async def reject_handoff(handoff_id: str, notes: str = ""):
    from datetime import timezone
    ref = db.collection("pending_handoffs").document(handoff_id)
    if not ref.get().exists:
        raise HTTPException(status_code=404, detail="Handoff not found")
    ref.update({"status": "rejected", "notes": notes,
                "actioned_at": datetime.now(timezone.utc).isoformat()})
    return {"handoff_id": handoff_id, "status": "rejected"}


# ---------------------------------------------------------------------------
# Sync-check endpoints
# ---------------------------------------------------------------------------

_SYNC_FIELDS = ["salary_rm", "permit_expiry_date", "fomema_status", "levy_status"]


@router.get("/sync-check")
async def sync_check():
    workers = {w.id: w.to_dict() for w in db.collection("workers").stream()}
    mock_records = {m.id: m.to_dict() for m in db.collection("mock_gov_records").stream()}

    results = []
    for worker_id, worker in workers.items():
        mock = mock_records.get(worker_id)
        if not mock:
            results.append({"worker_id": worker_id,
                            "worker_name": worker.get("full_name", worker_id),
                            "status": "not_filed", "conflicts": []})
            continue

        conflicts = []
        for field in _SYNC_FIELDS:
            internal = worker.get(field)
            external = mock.get(field)
            if internal is not None and external is not None and str(internal) != str(external):
                conflicts.append({"field": field, "internal": internal, "mock_gov": external})

        results.append({
            "worker_id": worker_id,
            "worker_name": worker.get("full_name", worker_id),
            "status": "conflict" if conflicts else "matched",
            "conflicts": conflicts,
        })

    return {"records": results, "total": len(results)}


@router.post("/sync-check/{worker_id}/resolve")
async def resolve_sync_conflict(worker_id: str, field: str):
    worker_doc = db.collection("workers").document(worker_id).get()
    if not worker_doc.exists:
        raise HTTPException(status_code=404, detail="Worker not found")
    internal_value = worker_doc.to_dict().get(field)
    db.collection("mock_gov_records").document(worker_id).set(
        {field: internal_value, "last_updated": datetime.now().isoformat()}, merge=True)
    return {"worker_id": worker_id, "field": field, "resolved_to": internal_value}


# ---------------------------------------------------------------------------
# Graph definition endpoint — live Mermaid diagram for website rendering
# ---------------------------------------------------------------------------

MASTER_MERMAID = """graph TD
    User["👤 User Input"] --> Orchestrator["🧠 Orchestrator Agent"]
    Orchestrator --> Router{"🔀 Route Decision"}
    Router -->|"VDR Workflow"| VDR_SUB["📋 VDR Pipeline"]
    Router -->|"Compliance Audit"| COMP_SUB["🔍 Compliance Pipeline"]
    Router -->|"Simulation"| SIM["📊 Simulator Tools"]
    Router -->|"Get Status"| STATUS["📌 Status Check"]

    subgraph VDR["VDR Pipeline"]
        direction TB
        parse["📄 Document Parser"] --> validate["✅ Pre-Form Validator"]
        validate --> signatures["✍️ Signature Tracker"]
        signatures --> comp_reason["⚖️ Compliance Reasoner"]
        comp_reason --> fomema["🏥 FOMEMA Gate"]
        fomema --> assemble["📦 VDR Assembler"]
    end

    subgraph COMP["Compliance Pipeline"]
        direction TB
        supervisor["🎯 Supervisor"] --> auditor["📋 Auditor"]
        supervisor --> company_audit["🏢 Company Audit"]
        supervisor --> vdr_filing["📁 VDR Filing"]
        supervisor --> plks_monitor["📡 PLKS Monitor"]
        supervisor --> strategist["🧮 Strategist"]
        supervisor --> filing["📝 Filing"]
        supervisor --> hitl["👤 HITL Review"]
        auditor --> supervisor
        company_audit --> supervisor
        vdr_filing --> supervisor
        plks_monitor --> supervisor
        strategist --> supervisor
        filing --> supervisor
        hitl --> supervisor
    end

    VDR_SUB --> VDR
    COMP_SUB --> COMP

    assemble -->|"Submit"| GOV["🏛️ Mock Gov Portal"]
    hitl -->|"Human Decision"| supervisor

    style User fill:#6366f1,stroke:#4f46e5,color:#fff
    style Orchestrator fill:#8b5cf6,stroke:#7c3aed,color:#fff
    style Router fill:#f59e0b,stroke:#d97706,color:#fff
    style GOV fill:#10b981,stroke:#059669,color:#fff"""


@router.get("/graph-definition")
async def get_graph_definition():
    """Return Mermaid diagram definitions for live rendering in the browser.

    Equivalent to app.get_graph().draw_mermaid_png() but served as text
    for the frontend Mermaid renderer.
    """
    from app.agents.graph import vdr_graph, compliance_graph
    from app.agents.master_graph import master_graph

    vdr_mermaid = None
    compliance_mermaid = None
    master_mermaid_result = None

    try:
        master_mermaid_result = master_graph.get_graph().draw_mermaid()
    except Exception:
        master_mermaid_result = MASTER_MERMAID

    try:
        vdr_mermaid = vdr_graph.get_graph().draw_mermaid()
    except Exception:
        # Fallback static definition
        vdr_mermaid = """graph TD
    parse["Document Parser"] --> validate["Pre-Form Validator"]
    validate --> signatures["Signature Tracker"]
    signatures --> compliance["Compliance Reasoner"]
    compliance --> fomema["FOMEMA Gate"]
    fomema --> assemble["VDR Assembler"]
    assemble --> END["__end__"]"""

    try:
        compliance_mermaid = compliance_graph.get_graph().draw_mermaid()
    except Exception:
        compliance_mermaid = """graph TD
    supervisor["Supervisor"] --> auditor["Auditor"]
    supervisor --> strategist["Strategist"]
    supervisor --> filing["Filing"]
    supervisor --> company_audit["Company Audit"]
    supervisor --> vdr_filing["VDR Filing"]
    supervisor --> plks_monitor["PLKS Monitor"]
    supervisor --> hitl["HITL Review"]
    auditor --> supervisor
    strategist --> supervisor
    filing --> supervisor
    company_audit --> supervisor
    vdr_filing --> supervisor
    plks_monitor --> supervisor
    hitl --> supervisor"""

    return {
        "master_mermaid": master_mermaid_result,
        "vdr_mermaid": vdr_mermaid,
        "compliance_mermaid": compliance_mermaid,
    }

