from datetime import datetime, timezone
from app.firebase_config import db


def append_trace(state: dict, node_name: str, status: str,
                 summary: str = None, error: str = None) -> dict:
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

    return {**state, "trace": trace, "current_node": node_name}
