"""
Master Graph — The top-level orchestrator that routes user intent to sub-graphs.

Connects Orchestrator -> Router -> (VDR Pipeline | Compliance Audit | Simulator).
"""

from typing import Dict, Any, TypedDict, Optional
from langgraph.graph import StateGraph, END

from app.agents.orchestrator import orchestrator_node
from app.agents.firebase_checkpointer import FirestoreCheckpointer

# Define Master State
class MasterState(TypedDict):
    user_input: str
    worker_id: Optional[str]
    intent: Optional[str]
    orchestrator_parameters: Dict[str, Any]
    orchestrator_reasoning: str
    # Results from sub-graphs
    vdr_result: Optional[Dict[str, Any]]
    compliance_result: Optional[Dict[str, Any]]
    simulator_result: Optional[Dict[str, Any]]

def router_node(state: MasterState) -> str:
    """Decision logic to route to sub-graphs."""
    intent = state.get("intent")
    
    if intent == "START_VDR_WORKFLOW":
        return "vdr_pipeline"
    elif intent == "RUN_COMPLIANCE_AUDIT":
        return "compliance_audit"
    elif intent == "RUN_SIMULATION":
        return "simulator"
    else:
        return "end"

# Placeholder nodes for sub-graph integration
# In a full implementation, these would call vdr_graph.invoke() and compliance_graph.invoke()

def vdr_pipeline_wrapper(state: MasterState) -> MasterState:
    # This simulates calling the VDR sub-graph
    return {**state, "vdr_result": {"status": "started", "message": "VDR Pipeline triggered"}}

def compliance_audit_wrapper(state: MasterState) -> MasterState:
    # This simulates calling the Compliance sub-graph
    return {**state, "compliance_result": {"status": "started", "message": "Compliance Audit triggered"}}

def simulator_wrapper(state: MasterState) -> MasterState:
    return {**state, "simulator_result": {"status": "completed", "message": "Simulation run"}}

def build_master_graph():
    workflow = StateGraph(MasterState)
    
    workflow.add_node("orchestrator", orchestrator_node)
    workflow.add_node("vdr_pipeline", vdr_pipeline_wrapper)
    workflow.add_node("compliance_audit", compliance_audit_wrapper)
    workflow.add_node("simulator", simulator_wrapper)
    
    workflow.set_entry_point("orchestrator")
    
    workflow.add_conditional_edges(
        "orchestrator",
        router_node,
        {
            "vdr_pipeline": "vdr_pipeline",
            "compliance_audit": "compliance_audit",
            "simulator": "simulator",
            "end": END
        }
    )
    
    workflow.add_edge("vdr_pipeline", END)
    workflow.add_edge("compliance_audit", END)
    workflow.add_edge("simulator", END)
    
    return workflow.compile(checkpointer=FirestoreCheckpointer("master_checkpoints"))

master_graph = build_master_graph()
