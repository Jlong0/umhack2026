from langgraph.graph import StateGraph, END
from langgraph.checkpoint.memory import MemorySaver
from typing import Literal

from app.agents.state import VDRState, WorkerComplianceState, AgentType, ComplianceStatus, RegulatoryGate
from app.agents.nodes import (
    document_parser_node,
    pre_form_validator_node,
    signature_tracker_node,
    compliance_reasoner_node,
    fomema_gate_node,
    vdr_assembler_node,
    supervisor_node,
    auditor_node,
    strategist_node,
    filing_node,
    hitl_interrupt_node,
)


# ---------------------------------------------------------------------------
# PLKS VDR pipeline (new)
# ---------------------------------------------------------------------------

def should_continue(state: VDRState) -> str:
    return END if state["pipeline_status"] in ("failed", "paused") else "continue"


def build_graph():
    g = StateGraph(VDRState)
    g.add_node("parse",      document_parser_node)
    g.add_node("validate",   pre_form_validator_node)
    g.add_node("signatures", signature_tracker_node)
    g.add_node("compliance", compliance_reasoner_node)
    g.add_node("fomema",     fomema_gate_node)
    g.add_node("assemble",   vdr_assembler_node)

    g.set_entry_point("parse")
    g.add_conditional_edges("parse",      should_continue, {"continue": "validate",   END: END})
    g.add_conditional_edges("validate",   should_continue, {"continue": "signatures", END: END})
    g.add_conditional_edges("signatures", should_continue, {"continue": "compliance", END: END})
    g.add_conditional_edges("compliance", should_continue, {"continue": "fomema",     END: END})
    g.add_conditional_edges("fomema",     should_continue, {"continue": "assemble",   END: END})
    g.add_edge("assemble", END)
    return g.compile()


vdr_graph = build_graph()


# ---------------------------------------------------------------------------
# Legacy compliance pipeline (kept for existing routes)
# ---------------------------------------------------------------------------

def route_supervisor(state: WorkerComplianceState) -> Literal[
    "auditor", "strategist", "filing", "company_audit", "vdr_filing", "plks_monitor", "hitl", "end"
]:
    if state.get("hitl_required"):
        return "hitl"
    if state.get("workflow_complete") or state.get("error_state"):
        return "end"
    action = state.get("next_action")
    mapping = {
        "audit_documents": "auditor",
        "company_audit": "company_audit",
        "vdr_filing": "vdr_filing",
        "plks_monitor": "plks_monitor",
        "calculate_strategy": "strategist",
        "prepare_filing": "filing",
        "hitl_review": "hitl",
    }
    return mapping.get(action, "end")


def route_after_hitl(state: WorkerComplianceState) -> Literal["supervisor", "end"]:
    return "end" if state.get("hitl_required") else "supervisor"


def _build_legacy_graph():
    # Import legacy nodes that aren't in the new pipeline
    from app.agents.nodes import company_audit_node, vdr_filing_node, plks_monitor_node

    w = StateGraph(WorkerComplianceState)
    w.add_node("supervisor",    supervisor_node)
    w.add_node("auditor",       auditor_node)
    w.add_node("strategist",    strategist_node)
    w.add_node("filing",        filing_node)
    w.add_node("company_audit", company_audit_node)
    w.add_node("vdr_filing",    vdr_filing_node)
    w.add_node("plks_monitor",  plks_monitor_node)
    w.add_node("hitl",          hitl_interrupt_node)

    w.set_entry_point("supervisor")
    w.add_conditional_edges("supervisor", route_supervisor, {
        "auditor": "auditor", "strategist": "strategist", "filing": "filing",
        "company_audit": "company_audit", "vdr_filing": "vdr_filing",
        "plks_monitor": "plks_monitor", "hitl": "hitl", "end": END,
    })
    for node in ("auditor", "strategist", "filing", "company_audit", "vdr_filing", "plks_monitor"):
        w.add_edge(node, "supervisor")
    w.add_conditional_edges("hitl", route_after_hitl, {"supervisor": "supervisor", "end": END})
    return w.compile(checkpointer=MemorySaver())


compliance_graph = _build_legacy_graph()

# Alias kept for any existing imports
def compile_compliance_graph():
    return _build_legacy_graph()
