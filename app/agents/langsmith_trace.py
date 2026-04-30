"""
Lightweight LangSmith tracing at node boundaries only.

Adds a @trace_node decorator that wraps each LangGraph node function
with a LangSmith span capturing inputs/outputs.

Does NOT wrap Gemini SDK calls.
Does NOT change prompt formats.
Does NOT restructure nodes.
"""

import os
import functools
from datetime import datetime, timezone

# Ensure tracing env is set before langsmith import
os.environ.setdefault("LANGCHAIN_TRACING_V2", "true")

try:
    from langsmith import traceable
    LANGSMITH_AVAILABLE = True
except ImportError:
    LANGSMITH_AVAILABLE = False


def trace_node(node_name: str, graph_name: str = "compliance"):
    """Decorator: wraps a LangGraph node function with LangSmith tracing.

    Only traces the node entry/exit — does NOT instrument internal LLM calls.
    If langsmith is not installed, the decorator is a no-op.

    Usage:
        @trace_node("document_parser_node", "vdr")
        def document_parser_node(state: VDRState) -> VDRState:
            ...
    """
    def decorator(func):
        if not LANGSMITH_AVAILABLE:
            return func

        @traceable(
            name=node_name,
            run_type="chain",
            metadata={"graph": graph_name, "node": node_name},
        )
        @functools.wraps(func)
        def wrapper(state, *args, **kwargs):
            result = func(state, *args, **kwargs)
            return result

        return wrapper

    return decorator
