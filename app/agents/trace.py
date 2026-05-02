"""
Trace helper — appends execution trace entries, computes state diffs,
stores diffs to Firestore, and broadcasts node events via WebSocket.
"""

import asyncio
from datetime import datetime, timezone

from app.firebase_config import db
from app.agents.diff_tracker import compute_diff, store_diff


def append_trace(
    state: dict,
    node_name: str,
    status: str,
    summary: str = None,
    error: str = None,
    old_state: dict = None,
) -> dict:
    """Append a trace entry, compute diffs, store to Firestore, broadcast via WS."""
    entry = {
        "node": node_name,
        "status": status,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "output_summary": summary,
        "error": error,
    }
    trace = list(state.get("trace", []))
    trace.append(entry)

    worker_id = state.get("worker_id")

    # Compute diff if old_state provided and node is completing
    diff_list = []
    if old_state and status in ("completed", "failed"):
        diff_list = compute_diff(old_state, state)
        store_diff(worker_id, node_name, diff_list, summary or "")

    # Update workflow doc in Firestore
    if worker_id:
        try:
            db.collection("workflows").document(worker_id).update({
                "trace": trace,
                "current_node": node_name,
                "pipeline_status": state.get("pipeline_status", "running"),
                "updated_at": entry["timestamp"],
            })
        except Exception:
            pass

    # Broadcast node event via WebSocket (non-blocking)
    try:
        from app.services.realtime_service import realtime_dashboard_manager
        loop = asyncio.get_running_loop()
        loop.create_task(realtime_dashboard_manager.broadcast_json({
            "type": "node_started" if status == "running" else "state_diff",
            "node": node_name,
            "worker_id": worker_id,
            "status": status,
            "summary": summary or "",
            "diff": diff_list[:20] if diff_list else [],
            "timestamp": entry["timestamp"],
        }))
    except RuntimeError:
        pass  # No event loop — skip broadcast

    return {**state, "trace": trace, "current_node": node_name}
