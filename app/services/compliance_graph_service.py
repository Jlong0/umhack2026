from datetime import datetime, timezone


def build_agent_statuses_from_worker(worker: dict):
    current_gate = worker.get("current_gate")
    workflow_status = worker.get("workflow_status")
    vdr_requirements = worker.get("vdr_requirements") or {}

    requires_hitl = (
        worker.get("requires_hitl") is True
        or bool(worker.get("missing_fields"))
        or workflow_status in ["fomema_rejected", "vdr_rejected", "jtksm_rejected"]
    )

    return {
        "supervisor": "done" if current_gate else "pending",

        "auditor": "done"
        if worker.get("data_status") == "complete"
        else "running"
        if worker.get("data_status") == "incomplete"
        else "pending",

        "company_audit": "done"
        if worker.get("jtksm_status") == "approved"
        else "failed"
        if worker.get("jtksm_status") == "rejected"
        else "running"
        if current_gate == "JTKSM"
        else "pending",

        "strategist": "done"
        if vdr_requirements and all(vdr_requirements.values())
        else "running"
        if current_gate == "VDR_PENDING"
        else "pending",

        "vdr_filing": "done"
        if worker.get("vdr_status") == "complete"
        else "failed"
        if worker.get("vdr_status") == "rejected"
        else "running"
        if current_gate == "VDR_PENDING"
        else "pending",

        "plks_monitor": "done"
        if worker.get("fomema_status") == "fit"
        else "failed"
        if worker.get("fomema_status") == "unfit"
        else "running"
        if current_gate in ["TRANSIT", "FOMEMA"]
        else "pending",

        "filing": "done"
        if worker.get("plks_status") == "approved"
        else "running"
        if current_gate == "PLKS_ENDORSE"
        else "pending",

        "hitl": "running" if requires_hitl else "pending",
    }


def infer_workflow_stage(worker: dict):
    current_gate = worker.get("current_gate")
    workflow_status = worker.get("workflow_status")

    if worker.get("workflow_complete") or current_gate == "ACTIVE" or workflow_status == "active":
        return "ready_to_complete"

    if workflow_status in ["jtksm_rejected", "vdr_rejected", "fomema_rejected"]:
        return "error"

    if current_gate == "JTKSM":
        return "gate_1_jtksm"

    if current_gate == "VDR_PENDING":
        return "gate_2_kdn"

    if current_gate in ["TRANSIT", "FOMEMA"]:
        return "gate_3_jim"

    if current_gate == "PLKS_ENDORSE":
        return "strategy_done"

    return "init"


def build_execution_trace_from_worker(worker_id: str, worker: dict):
    trace = []

    def add(agent, step, summary, timestamp=None):
        trace.append({
            "agent": agent,
            "step": step,
            "summary": summary,
            "timestamp": timestamp or worker.get("updated_at") or datetime.now(timezone.utc).isoformat(),
        })

    if worker.get("data_status") == "complete":
        add("auditor", "done", "Worker profile and required uploaded data are complete.")

    if worker.get("jtksm_status") == "approved":
        add("company_audit", "done", "JTKSM gate approved. Worker can proceed to VDR preparation.", worker.get("jtksm_decided_at"))

    if worker.get("vdr_status") == "complete":
        add("vdr_filing", "done", f"VDR/IMM.47 submitted successfully. Receipt: {worker.get('vdr_receipt_id') or 'available'}", worker.get("vdr_submitted_at"))

    if worker.get("transit_status") == "arrived":
        add("plks_monitor", "done", "Worker arrival confirmed in Malaysia.", worker.get("arrival_confirmed_at"))

    if worker.get("fomema_status") == "fit":
        add("plks_monitor", "done", "FOMEMA result synced as FIT.", worker.get("fomema_checked_at"))

    if worker.get("plks_status") == "approved":
        add("filing", "done", f"PLKS application approved. Receipt: {worker.get('plks_receipt_id') or 'available'}", worker.get("plks_submitted_at"))

    if worker.get("requires_hitl") or worker.get("missing_fields"):
        add("hitl", "running", "Human review required for missing or blocked workflow information.")

    if not trace:
        add("supervisor", "running", "Supervisor is waiting for the next workflow event.")

    return trace


def get_compliance_status(worker: dict) -> str:
    workflow_status = worker.get("workflow_status")
    current_gate = worker.get("current_gate")

    if workflow_status in ["jtksm_rejected", "vdr_rejected", "fomema_rejected"]:
        return "blocked"

    if worker.get("requires_hitl") or worker.get("missing_fields"):
        return "needs_review"

    if worker.get("data_status") != "complete":
        return "incomplete"

    if (
        worker.get("workflow_complete") is True
        or current_gate == "ACTIVE"
        or workflow_status == "active"
    ):
        return "compliant"

    return "in_progress"