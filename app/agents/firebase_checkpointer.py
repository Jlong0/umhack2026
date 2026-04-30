"""
Firebase Firestore checkpointer for LangGraph.

Stores graph checkpoints in Firestore instead of MemorySaver,
so graph state survives server restarts. All data stays in Firebase.
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any, Iterator, Optional, Sequence, Tuple

from langgraph.checkpoint.base import (
    BaseCheckpointSaver,
    Checkpoint,
    CheckpointMetadata,
    CheckpointTuple,
)

from app.firebase_config import db


class FirestoreCheckpointer(BaseCheckpointSaver):
    """LangGraph checkpoint saver backed by Firestore.

    Stores one checkpoint per (thread_id, checkpoint_ns) pair.
    Business data stays in other Firestore collections — this only
    handles LangGraph execution state.
    """

    def __init__(self, collection_name: str = "graph_checkpoints"):
        super().__init__()
        self._collection = collection_name

    def _doc_id(self, config: dict) -> str:
        thread_id = config["configurable"]["thread_id"]
        ns = config["configurable"].get("checkpoint_ns", "")
        return f"{thread_id}__{ns}" if ns else thread_id

    def get_tuple(self, config: dict) -> Optional[CheckpointTuple]:
        """Retrieve the latest checkpoint for a given config."""
        try:
            doc = db.collection(self._collection).document(
                self._doc_id(config)
            ).get()
            if not doc.exists:
                return None
            data = doc.to_dict()
            checkpoint = json.loads(data["checkpoint_json"])
            metadata = data.get("metadata", {})
            return CheckpointTuple(
                config=config,
                checkpoint=checkpoint,
                metadata=metadata,
            )
        except Exception:
            return None

    def put(
        self,
        config: dict,
        checkpoint: Checkpoint,
        metadata: CheckpointMetadata,
        new_versions: Optional[dict] = None,
    ) -> dict:
        """Persist a checkpoint to Firestore."""
        try:
            db.collection(self._collection).document(
                self._doc_id(config)
            ).set({
                "checkpoint_json": json.dumps(checkpoint, default=str),
                "metadata": metadata or {},
                "updated_at": datetime.now(timezone.utc).isoformat(),
            })
        except Exception:
            pass  # Fail silently — don't block graph execution
        return config

    def list(
        self,
        config: Optional[dict] = None,
        *,
        filter: Optional[dict[str, Any]] = None,
        before: Optional[dict] = None,
        limit: Optional[int] = None,
    ) -> Iterator[CheckpointTuple]:
        """List checkpoints. Simplified — yields single checkpoint if exists."""
        if config is None:
            return
        tup = self.get_tuple(config)
        if tup:
            yield tup

    def put_writes(
        self,
        config: dict,
        writes: Sequence[Tuple[str, Any]],
        task_id: str,
    ) -> None:
        """Store intermediate writes. No-op for simplified implementation."""
        pass
