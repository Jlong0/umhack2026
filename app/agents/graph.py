"""
LangGraph agent orchestration system for PermitIQ.
Implements the multi-agent compliance reasoning engine with StateGraph.
"""
from typing import Literal
from langgraph.graph import StateGraph, END
from langgraph.checkpoint.memory import MemorySaver
from app.agents.state import WorkerComplianceState, AgentType, ComplianceStatus
from app.agents.nodes import (
    supervisor_node,
    auditor_node,
    strategist_node,
    filing_node,
    hitl_interrupt_node,
    company_audit_node,
    vdr_filing_node,
    plks_monitor_node,
)


def route_supervisor(state: WorkerComplianceState) -> Literal["auditor", "strategist", "filing", "company_audit", "vdr_filing", "plks_monitor", "hitl", "end"]:
    """
    Supervisor routing logic - decides which specialist agent to invoke next.
    """
    # Check for HITL requirement first
    if state.get("hitl_required"):
        return "hitl"

    # Check for workflow completion
    if state.get("workflow_complete"):
        return "end"

    # Check for error state
    if state.get("error_state"):
        return "end"

    # Route based on next_action
    next_action = state.get("next_action")

    if next_action == "audit_documents":
        return "auditor"
    elif next_action == "company_audit":
        return "company_audit"
    elif next_action == "vdr_filing":
        return "vdr_filing"
    elif next_action == "plks_monitor":
        return "plks_monitor"
    elif next_action == "calculate_strategy":
        return "strategist"
    elif next_action == "prepare_filing":
        return "filing"
    elif next_action == "hitl_review":
        return "hitl"
    else:
        return "end"


def route_after_hitl(state: WorkerComplianceState) -> Literal["supervisor", "end"]:
    """
    Route after HITL interrupt is resolved.
    """
    if state.get("hitl_required"):
        # Still waiting for human input
        return "end"
    else:
        # Human provided input, resume workflow
        return "supervisor"


def create_compliance_graph() -> StateGraph:
    """
    Create the LangGraph StateGraph for worker compliance workflow.

    Graph structure:
    START -> Supervisor -> [Auditor, Strategist, Filing, HITL] -> Supervisor -> END

    The Supervisor acts as the orchestrator, routing to specialist agents based on state.
    """
    # Initialize graph with state schema
    workflow = StateGraph(WorkerComplianceState)

    # Add nodes
    workflow.add_node("supervisor", supervisor_node)
    workflow.add_node("auditor", auditor_node)
    workflow.add_node("strategist", strategist_node)
    workflow.add_node("filing", filing_node)
    workflow.add_node("company_audit", company_audit_node)
    workflow.add_node("vdr_filing", vdr_filing_node)
    workflow.add_node("plks_monitor", plks_monitor_node)
    workflow.add_node("hitl", hitl_interrupt_node)

    # Set entry point
    workflow.set_entry_point("supervisor")

    # Add conditional edges from supervisor
    workflow.add_conditional_edges(
        "supervisor",
        route_supervisor,
        {
            "auditor": "auditor",
            "strategist": "strategist",
            "filing": "filing",
            "company_audit": "company_audit",
            "vdr_filing": "vdr_filing",
            "plks_monitor": "plks_monitor",
            "hitl": "hitl",
            "end": END
        }
    )

    # Specialist agents return to supervisor
    workflow.add_edge("auditor", "supervisor")
    workflow.add_edge("strategist", "supervisor")
    workflow.add_edge("filing", "supervisor")
    workflow.add_edge("company_audit", "supervisor")
    workflow.add_edge("vdr_filing", "supervisor")
    workflow.add_edge("plks_monitor", "supervisor")

    # HITL can either wait or return to supervisor
    workflow.add_conditional_edges(
        "hitl",
        route_after_hitl,
        {
            "supervisor": "supervisor",
            "end": END
        }
    )

    return workflow


def compile_compliance_graph():
    """
    Compile the graph with memory persistence for long-running workflows.
    """
    workflow = create_compliance_graph()
    memory = MemorySaver()
    return workflow.compile(checkpointer=memory)


# Global compiled graph instance
compliance_graph = compile_compliance_graph()
