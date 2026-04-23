"""
Arize Phoenix observability integration for agent tracing.
Provides OpenTelemetry instrumentation for LangGraph workflows.
"""
import os
from opentelemetry import trace
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
from phoenix.otel import register


def setup_phoenix_tracing():
    """
    Initialize Arize Phoenix tracing for agent observability.
    """
    phoenix_enabled = os.getenv("PHOENIX_ENABLED", "false").lower() == "true"

    if not phoenix_enabled:
        print("Phoenix tracing disabled - set PHOENIX_ENABLED=true to enable")
        return None

    try:
        # Register Phoenix as the OTLP endpoint
        tracer_provider = register(
            project_name="permitiq-compliance-engine",
            endpoint="http://localhost:6006/v1/traces"  # Default Phoenix endpoint
        )

        print("✓ Phoenix tracing initialized - view at http://localhost:6006")
        return tracer_provider

    except Exception as e:
        print(f"Warning: Failed to initialize Phoenix tracing: {e}")
        return None


def trace_agent_decision(
    agent_name: str,
    worker_id: str,
    decision: str,
    reasoning: str,
    tool_calls: list
):
    """
    Create a trace span for an agent decision.
    """
    tracer = trace.get_tracer(__name__)

    with tracer.start_as_current_span(f"agent_{agent_name}_decision") as span:
        span.set_attribute("agent.name", agent_name)
        span.set_attribute("worker.id", worker_id)
        span.set_attribute("decision", decision)
        span.set_attribute("reasoning", reasoning)
        span.set_attribute("tool_calls.count", len(tool_calls))

        for i, tool_call in enumerate(tool_calls):
            span.set_attribute(f"tool_call.{i}.name", tool_call.get("tool", "unknown"))
            span.set_attribute(f"tool_call.{i}.result", str(tool_call.get("result", "")))


def trace_compliance_workflow(worker_id: str, workflow_status: str):
    """
    Create a trace span for the entire compliance workflow.
    """
    tracer = trace.get_tracer(__name__)

    with tracer.start_as_current_span("compliance_workflow") as span:
        span.set_attribute("worker.id", worker_id)
        span.set_attribute("workflow.status", workflow_status)


# Initialize on module import
phoenix_tracer = setup_phoenix_tracing()
