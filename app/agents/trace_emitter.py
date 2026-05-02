"""
Real-time trace emitter for the Live Orchestration dashboard.

Broadcasts agent status updates via WebSocket AND persists them
to Firestore so the frontend can recover state on page reload.
"""
import asyncio
from datetime import datetime, timezone

from app.services.realtime_service import realtime_dashboard_manager


# Human-readable summaries for each agent step
_HUMAN_SUMMARIES = {
    ("supervisor", "running"):      "The Supervisor is deciding which agent to route the workflow to next.",
    ("supervisor", "done"):         "The Supervisor finished routing — the next agent has been selected.",
    ("auditor", "running"):         "The Auditor is checking worker documents, passport validity, and FOMEMA requirements.",
    ("auditor", "done"):            "Document audit complete — all findings have been recorded.",
    ("company_audit", "running"):   "Company Audit is verifying JTKSM Section 60K approval, Act 446 housing cert, and quota balance.",
    ("company_audit", "done"):      "Company gate check finished — employer eligibility determined.",
    ("strategist", "running"):      "The Strategist is calculating MTLM levy, salary compliance, and deadlock risk.",
    ("strategist", "done"):         "Compliance strategy complete — obligations and risks identified.",
    ("vdr_filing", "running"):      "VDR Filing is checking document completeness — biometrics, passport, contracts.",
    ("vdr_filing", "done"):         "VDR prerequisite check done — filing readiness determined.",
    ("plks_monitor", "running"):    "PLKS Monitor is tracking post-arrival gates — FOMEMA registration and permit issuance.",
    ("plks_monitor", "done"):       "Post-arrival monitoring complete — FOMEMA and PLKS status recorded.",
    ("filing", "running"):          "Filing agent is preparing the permit renewal package.",
    ("filing", "done"):             "Renewal filing package prepared and queued.",
    ("hitl", "running"):            "Workflow paused — a human reviewer needs to make a decision.",
    ("hitl", "done"):               "Human review complete — workflow will resume based on the decision.",
}


def _get_summary(agent: str, step: str, detail: str = "") -> str:
    """Return a human-readable summary for a given agent+step."""
    base = _HUMAN_SUMMARIES.get((agent, step), f"{agent} is {step}.")
    if detail:
        return f"{base} {detail}"
    return base


def emit(agent: str, step: str, msg: str, state: dict, *, detail: str = "") -> dict:
    """Emit a real-time agent status event.

    1. Updates state dict with new trace entry + agent statuses
    2. Persists to Firestore for recovery on page reload
    3. Broadcasts via WebSocket for live dashboard updates

    Args:
        agent:  Agent identifier (e.g. "supervisor", "auditor")
        step:   Status step ("running" or "done")
        msg:    Technical message for the trace log
        state:  Current workflow state dict
        detail: Optional extra context appended to the human summary
    """
    now = datetime.now(timezone.utc).isoformat()
    human_summary = _get_summary(agent, step, detail)

    entry = {
        "agent": agent,
        "step": step,
        "msg": msg,
        "summary": human_summary,
        "timestamp": now,
    }
    new_trace = state.get("execution_trace", []) + [entry]
    new_statuses = {**state.get("agent_statuses", {}), agent: step}
    updated = {**state, "execution_trace": new_trace, "agent_statuses": new_statuses}

    # Persist to Firestore for page-reload recovery
    worker_id = state.get("worker_id")
    if worker_id:
        try:
            from app.firebase_config import db
            db.collection("workflow_trace").document(worker_id).set({
                "worker_id": worker_id,
                "agent_statuses": new_statuses,
                "execution_trace": new_trace[-30:],  # keep last 30 entries
                "workflow_stage": state.get("workflow_stage"),
                "updated_at": now,
            }, merge=True)
        except Exception:
            pass  # Non-critical — don't break the workflow

    # Broadcast via WebSocket
    payload = {
        "type": "agent_event",
        "worker_id": worker_id,
        "agent_statuses": new_statuses,
        "execution_trace": new_trace,
        "workflow_stage": state.get("workflow_stage"),
        "timestamp": now,
    }
    try:
        loop = asyncio.get_running_loop()
        loop.create_task(realtime_dashboard_manager.broadcast_json(payload))
    except RuntimeError:
        pass

    return updated
