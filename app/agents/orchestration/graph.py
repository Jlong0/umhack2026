"""
Orchestration LangGraph — StateGraph definition + compiled graph.

10-node DAG:
  entry_point → planner → router → [verifier|form_filler|portal_agent]
  → critic → hitl_check → pipeline_sync → advance → router (loop) or END
"""
from __future__ import annotations

from langgraph.graph import StateGraph, END

from app.agents.firebase_checkpointer import FirestoreCheckpointer
from app.agents.orchestration.state import (
    OrchestrationState,
    OrchestrationStatus,
    SpecialistType,
)
from app.agents.orchestration.nodes import (
    entry_point_node,
    planner_node,
    router_node,
    verifier_node,
    form_filler_node,
    portal_agent_node,
    critic_node,
    hitl_check_node,
    pipeline_sync_node,
    advance_node,
)


# ── Edge conditions ────────────────────────────────────────────────────────────

def route_specialist(state: OrchestrationState) -> str:
    """Route from router to the correct specialist."""
    specialist = state.get("current_specialist", "")
    plan = state.get("plan", [])
    idx = state.get("current_task_index", 0)
    if idx >= len(plan):
        return "advance"
    if specialist == SpecialistType.VERIFIER:
        return "verifier"
    if specialist == SpecialistType.FORM_FILLER:
        return "form_filler"
    if specialist == SpecialistType.PORTAL_AGENT:
        return "portal_agent"
    return "verifier"  # default


def route_after_critic(state: OrchestrationState) -> str:
    """After critic: retry (→ router) or continue (→ hitl_check)."""
    verdict = state.get("critic_verdict", "approved")
    retry_count = state.get("retry_count", 0)
    if verdict == "rejected" and retry_count < 2:
        return "router"
    return "hitl_check"


def route_after_hitl(state: OrchestrationState) -> str:
    """After hitl_check: pause at END if HITL needed, else sync."""
    if state.get("hitl_required"):
        return END
    return "pipeline_sync"


def route_after_advance(state: OrchestrationState) -> str:
    """After advance: loop back to router or finish."""
    status = state.get("status", "")
    if status == OrchestrationStatus.COMPLETED:
        return END
    if status in (OrchestrationStatus.FAILED, OrchestrationStatus.HITL_PAUSED):
        return END
    return "router"


def should_abort(state: OrchestrationState) -> str:
    """Early-exit checks after each specialist."""
    status = state.get("status", "")
    if status == OrchestrationStatus.FAILED:
        return END
    return "critic"


# ── Graph builder ──────────────────────────────────────────────────────────────

def build_orchestration_graph():
    g = StateGraph(OrchestrationState)

    # Register nodes
    g.add_node("entry_point",   entry_point_node)
    g.add_node("planner",       planner_node)
    g.add_node("router",        router_node)
    g.add_node("verifier",      verifier_node)
    g.add_node("form_filler",   form_filler_node)
    g.add_node("portal_agent",  portal_agent_node)
    g.add_node("critic",        critic_node)
    g.add_node("hitl_check",    hitl_check_node)
    g.add_node("pipeline_sync", pipeline_sync_node)
    g.add_node("advance",       advance_node)

    # Linear start
    g.set_entry_point("entry_point")
    g.add_edge("entry_point", "planner")
    g.add_edge("planner", "router")

    # Router → specialist (conditional)
    g.add_conditional_edges("router", route_specialist, {
        "verifier":     "verifier",
        "form_filler":  "form_filler",
        "portal_agent": "portal_agent",
        "advance":      "advance",
    })

    # Specialists → critic (with abort on failure)
    for specialist in ("verifier", "form_filler", "portal_agent"):
        g.add_conditional_edges(specialist, should_abort, {"critic": "critic", END: END})

    # Critic → retry or continue
    g.add_conditional_edges("critic", route_after_critic, {
        "router":    "router",
        "hitl_check": "hitl_check",
    })

    # HITL → pause or continue
    g.add_conditional_edges("hitl_check", route_after_hitl, {
        "pipeline_sync": "pipeline_sync",
        END: END,
    })

    # Sync → advance
    g.add_edge("pipeline_sync", "advance")

    # Advance → loop or end
    g.add_conditional_edges("advance", route_after_advance, {
        "router": "router",
        END: END,
    })

    return g.compile(checkpointer=FirestoreCheckpointer("orchestration_checkpoints"))


orchestration_graph = build_orchestration_graph()
