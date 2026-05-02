"""
Orchestrator Agent — Top-level entry point for natural language intent routing.

Analyzes user input to decide which specialized graph to trigger
(VDR Pipeline, Compliance Audit, Simulator, etc.)
"""

import json
from typing import Dict, Any

from app.services.gemini_service import generate_text
from app.agents.langsmith_trace import trace_node

ORCHESTRATOR_SYSTEM_PROMPT = """You are the PermitIQ Orchestrator. Your job is to analyze user requests and route them to the correct agentic pipeline.

AVAILABLE PIPELINES:
1. START_VDR_WORKFLOW: When user wants to process documents, start a new VDR application, or extract data from files.
2. RUN_COMPLIANCE_AUDIT: When user wants to check a worker's compliance status, audit existing data, or verify permits.
3. RUN_SIMULATION: When user asks "what if" questions about salary, levy, or sector changes.
4. GET_STATUS: When user asks about the status of an existing workflow or worker.

INPUTS:
- user_input: The text from the user.
- context: Current session context if any.

OUTPUT:
You MUST return a JSON object with:
{
  "intent": "PIPELINE_NAME",
  "confidence": 0.0-1.0,
  "parameters": {
    "worker_id": "if mentioned",
    "document_type": "if mentioned",
    "target_sector": "if mentioned"
  },
  "reasoning": "short explanation"
}
"""

@trace_node("orchestrator_agent", "master")
def orchestrator_node(state: Dict[str, Any]) -> Dict[str, Any]:
    """Analyze intent and add routing information to state."""
    user_input = state.get("user_input", "")
    
    # Use existing Gemini service (not wrapped in LangChain as per constraints)
    result = generate_text(
        prompt=f"User Request: {user_input}",
        system_instructions=ORCHESTRATOR_SYSTEM_PROMPT
    )
    
    intent_data = {
        "intent": "GET_STATUS",
        "confidence": 0.5,
        "parameters": {},
        "reasoning": "Fallback due to service error"
    }
    
    if result.get("success"):
        try:
            # Attempt to extract JSON from markdown if necessary
            raw_text = result["text"]
            if "```json" in raw_text:
                raw_text = raw_text.split("```json")[1].split("```")[0].strip()
            intent_data = json.loads(raw_text)
        except Exception:
            pass

    return {
        **state,
        "intent": intent_data.get("intent"),
        "orchestrator_confidence": intent_data.get("confidence"),
        "orchestrator_parameters": intent_data.get("parameters"),
        "orchestrator_reasoning": intent_data.get("reasoning")
    }
