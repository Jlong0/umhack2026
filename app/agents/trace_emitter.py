import asyncio
from datetime import datetime, timezone

from app.services.realtime_service import realtime_dashboard_manager


def emit(agent: str, step: str, msg: str, state: dict) -> dict:
    now = datetime.now(timezone.utc).isoformat()
    entry = {"agent": agent, "step": step, "msg": msg, "timestamp": now}
    new_trace = state.get("execution_trace", []) + [entry]
    new_statuses = {**state.get("agent_statuses", {}), agent: step}
    updated = {**state, "execution_trace": new_trace, "agent_statuses": new_statuses}

    payload = {
        "type": "agent_event",
        "worker_id": state.get("worker_id"),
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
