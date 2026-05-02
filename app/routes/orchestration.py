"""
Orchestration API routes — FastAPI endpoints for the agentic orchestration framework.
"""
from __future__ import annotations

import asyncio
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, HTTPException
from pydantic import BaseModel

from app.firebase_config import db
from app.agents.orchestration.state import create_initial_orchestration_state, OrchestrationStatus

router = APIRouter(prefix="/orchestration", tags=["orchestration"])


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


# ── Pydantic schemas ───────────────────────────────────────────────────────────

class StartOrchestrationRequest(BaseModel):
    worker_id: str
    trigger_reason: Optional[str] = "manual"


class ResumeOrchestrationRequest(BaseModel):
    decision: str           # "approve" | "reject" | "override"
    notes: Optional[str] = None
    modified_data: Optional[dict] = None


# ── Background runner ──────────────────────────────────────────────────────────

def _run_orchestration(state: dict) -> dict:
    """Invoke the graph synchronously (called from a background task)."""
    from app.agents.orchestration.graph import orchestration_graph
    session_id = state["session_id"]
    config = {"configurable": {"thread_id": session_id, "checkpoint_ns": "orchestration"}}
    try:
        result = orchestration_graph.invoke(state, config)
        db.collection("orchestration_sessions").document(session_id).set(
            {"final_state": {k: v for k, v in result.items() if k not in ("trace", "execution_log")},
             "status": result.get("status", OrchestrationStatus.COMPLETED),
             "completed_at": _now()},
            merge=True,
        )
        return result
    except Exception as e:
        db.collection("orchestration_sessions").document(session_id).set(
            {"status": OrchestrationStatus.FAILED, "error": str(e), "updated_at": _now()},
            merge=True,
        )
        raise


# ── POST /orchestration/start ──────────────────────────────────────────────────

@router.post("/start")
async def start_orchestration(body: StartOrchestrationRequest, background_tasks: BackgroundTasks):
    """Start an orchestration session for a worker."""
    worker_id = body.worker_id
    worker_doc = db.collection("workers").document(worker_id).get()
    if not worker_doc.exists:
        raise HTTPException(status_code=404, detail=f"Worker '{worker_id}' not found")

    state = create_initial_orchestration_state(
        worker_id=worker_id,
        trigger_reason=body.trigger_reason or "manual",
    )
    session_id = state["session_id"]

    # Persist initial session record
    db.collection("orchestration_sessions").document(session_id).set({
        "session_id": session_id,
        "worker_id": worker_id,
        "trigger_reason": body.trigger_reason,
        "status": OrchestrationStatus.ORCHESTRATING,
        "created_at": _now(),
        "updated_at": _now(),
    })

    # Run graph in background thread so we return immediately
    def _bg():
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            _run_orchestration(state)
        except Exception:
            pass
        finally:
            loop.close()

    background_tasks.add_task(_bg)

    return {
        "session_id": session_id,
        "worker_id": worker_id,
        "status": OrchestrationStatus.ORCHESTRATING,
        "message": "Orchestration started — poll /orchestration/{session_id}/status for updates",
    }


# ── GET /orchestration/{session_id}/status ─────────────────────────────────────

@router.get("/{session_id}/status")
async def get_status(session_id: str):
    """Get current orchestration state."""
    doc = db.collection("orchestration_sessions").document(session_id).get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Session not found")
    data = doc.to_dict() or {}
    return {
        "session_id": session_id,
        "worker_id": data.get("worker_id"),
        "status": data.get("status"),
        "plan": data.get("plan", []),
        "tasks_done": data.get("tasks_done", 0),
        "tasks_total": data.get("tasks_total", 0),
        "pipeline_stage": data.get("pipeline_stage"),
        "hitl_required": data.get("hitl_required", False),
        "hitl_reason": data.get("hitl_reason"),
        "hitl_suggestions": data.get("hitl_suggestions", []),
        "agent_statuses": data.get("agent_statuses", {}),
        "updated_at": data.get("updated_at"),
    }


# ── GET /orchestration/{session_id}/graph ──────────────────────────────────────

@router.get("/{session_id}/graph")
async def get_graph(session_id: str):
    """Return DAG nodes + edges for visualization."""
    nodes = [
        {"id": "entry_point",   "label": "Entry Point",    "row": 0},
        {"id": "planner",       "label": "Planner",        "row": 1},
        {"id": "router",        "label": "Router",         "row": 2},
        {"id": "verifier",      "label": "Verifier",       "row": 3},
        {"id": "form_filler",   "label": "Form Filler",    "row": 3},
        {"id": "portal_agent",  "label": "Portal Agent",   "row": 3},
        {"id": "critic",        "label": "Critic",         "row": 4},
        {"id": "hitl_check",    "label": "HITL Check",     "row": 5},
        {"id": "pipeline_sync", "label": "Pipeline Sync",  "row": 6},
        {"id": "advance",       "label": "Advance",        "row": 7},
    ]
    edges = [
        {"from": "entry_point",   "to": "planner"},
        {"from": "planner",       "to": "router"},
        {"from": "router",        "to": "verifier"},
        {"from": "router",        "to": "form_filler"},
        {"from": "router",        "to": "portal_agent"},
        {"from": "verifier",      "to": "critic"},
        {"from": "form_filler",   "to": "critic"},
        {"from": "portal_agent",  "to": "critic"},
        {"from": "critic",        "to": "hitl_check",   "label": "approved"},
        {"from": "critic",        "to": "router",       "label": "retry"},
        {"from": "hitl_check",    "to": "pipeline_sync","label": "pass"},
        {"from": "hitl_check",    "to": "END",          "label": "pause"},
        {"from": "pipeline_sync", "to": "advance"},
        {"from": "advance",       "to": "router",       "label": "more tasks"},
        {"from": "advance",       "to": "END",          "label": "done"},
    ]
    doc = db.collection("orchestration_sessions").document(session_id).get()
    agent_statuses = (doc.to_dict() or {}).get("agent_statuses", {}) if doc.exists else {}
    for n in nodes:
        n["status"] = agent_statuses.get(n["id"], "pending")
    return {"nodes": nodes, "edges": edges}


# ── GET /orchestration/{session_id}/trace ──────────────────────────────────────

@router.get("/{session_id}/trace")
async def get_trace(session_id: str):
    """Get execution trace for a session."""
    doc = db.collection("orchestration_sessions").document(session_id).get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Session not found")
    data = doc.to_dict() or {}
    return {
        "session_id": session_id,
        "trace": data.get("trace", []),
        "agent_statuses": data.get("agent_statuses", {}),
    }


# ── POST /orchestration/{session_id}/resume ────────────────────────────────────

@router.post("/{session_id}/resume")
async def resume_orchestration(session_id: str, body: ResumeOrchestrationRequest,
                               background_tasks: BackgroundTasks):
    """Resume an orchestration that is paused at HITL."""
    doc = db.collection("orchestration_sessions").document(session_id).get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Session not found")

    data = doc.to_dict() or {}
    if data.get("status") != OrchestrationStatus.HITL_PAUSED:
        raise HTTPException(status_code=400, detail="Session is not paused at HITL")

    # Reconstruct state from persisted data + apply human decision
    from app.agents.orchestration.state import OrchestrationState
    worker_id = data.get("worker_id", "")
    state = create_initial_orchestration_state(worker_id)
    state = {**state,
             "session_id": session_id,
             "plan": data.get("plan", []),
             "current_task_index": data.get("current_task_index", 0),
             "hitl_required": False,
             "hitl_reason": None,
             "critic_verdict": "approved" if body.decision == "approve" else "rejected",
             "critic_confidence": 0.9 if body.decision == "approve" else 0.3,
             "status": OrchestrationStatus.EXECUTING}

    if body.modified_data:
        state["worker_data"] = {**state.get("worker_data", {}), **body.modified_data}

    db.collection("orchestration_sessions").document(session_id).set(
        {"status": OrchestrationStatus.EXECUTING, "hitl_required": False,
         "hitl_decision": body.decision, "hitl_notes": body.notes, "updated_at": _now()},
        merge=True,
    )

    def _bg():
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            _run_orchestration(state)
        except Exception:
            pass
        finally:
            loop.close()

    background_tasks.add_task(_bg)
    return {"session_id": session_id, "status": OrchestrationStatus.EXECUTING,
            "message": f"Resuming after HITL decision: {body.decision}"}


# ── GET /orchestration/sessions ────────────────────────────────────────────────

@router.get("/sessions")
async def list_sessions(worker_id: Optional[str] = None, limit: int = 20):
    """List orchestration sessions."""
    query = db.collection("orchestration_sessions")
    if worker_id:
        query = query.where("worker_id", "==", worker_id)
    sessions = []
    for doc in query.limit(limit).stream():
        d = doc.to_dict() or {}
        sessions.append({
            "session_id": doc.id,
            "worker_id": d.get("worker_id"),
            "status": d.get("status"),
            "tasks_done": d.get("tasks_done", 0),
            "tasks_total": d.get("tasks_total", 0),
            "created_at": d.get("created_at"),
            "updated_at": d.get("updated_at"),
        })
    return {"sessions": sessions, "total": len(sessions)}


# ── DELETE /orchestration/{session_id} ────────────────────────────────────────

@router.delete("/{session_id}")
async def cancel_session(session_id: str):
    """Cancel/delete an orchestration session."""
    doc = db.collection("orchestration_sessions").document(session_id).get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Session not found")
    db.collection("orchestration_sessions").document(session_id).set(
        {"status": OrchestrationStatus.FAILED, "error": "Cancelled by user", "updated_at": _now()},
        merge=True,
    )
    return {"session_id": session_id, "status": "cancelled"}
