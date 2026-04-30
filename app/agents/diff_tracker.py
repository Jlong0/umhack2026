"""
State diff computation and Firestore storage.

Computes what changed between old and new state at node boundaries,
then stores diffs in Firestore under workflows/{worker_id}/diffs/{step_id}.
"""

from __future__ import annotations

from copy import deepcopy
from datetime import datetime, timezone
from typing import Any

from app.firebase_config import db


def compute_diff(old: dict, new: dict, path: str = "") -> list[dict]:
    """Recursively compute field-level diffs between two state dicts.

    Returns a list of {path, old, new} entries for every changed field.
    """
    diffs: list[dict] = []
    all_keys = set(list(old.keys()) + list(new.keys()))

    for key in all_keys:
        new_path = f"{path}.{key}" if path else key

        # Skip internal / large fields that add noise
        if key in ("trace", "tool_calls", "agent_observations"):
            continue

        old_val = old.get(key)
        new_val = new.get(key)

        if key not in old:
            diffs.append({"path": new_path, "old": None, "new": _safe(new_val)})
        elif key not in new:
            continue  # Don't flag removed keys as diffs
        elif isinstance(new_val, dict) and isinstance(old_val, dict):
            diffs.extend(compute_diff(old_val, new_val, new_path))
        elif old_val != new_val:
            diffs.append({
                "path": new_path,
                "old": _safe(old_val),
                "new": _safe(new_val),
            })

    return diffs


def _safe(val: Any) -> Any:
    """Make a value JSON-safe for Firestore storage."""
    if val is None:
        return None
    if isinstance(val, (str, int, float, bool)):
        return val
    if isinstance(val, list) and len(val) > 10:
        return f"[list of {len(val)} items]"
    try:
        return str(val)[:200]
    except Exception:
        return "<unserializable>"


def store_diff(
    worker_id: str,
    node_name: str,
    diff: list[dict],
    summary: str = "",
) -> None:
    """Persist a state diff to Firestore under the workflow's diffs subcollection."""
    if not worker_id or not diff:
        return
    try:
        ts = datetime.now(timezone.utc)
        step_id = f"{node_name}_{ts.strftime('%Y%m%d%H%M%S%f')}"
        db.collection("workflows").document(worker_id)\
          .collection("diffs").document(step_id).set({
            "node": node_name,
            "diff": diff[:50],  # Cap stored diffs to prevent bloat
            "summary": summary or "",
            "timestamp": ts.isoformat(),
            "change_count": len(diff),
        })
    except Exception:
        pass  # Don't break graph execution on diff storage failure
