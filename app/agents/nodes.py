"""
Agent node implementations for LangGraph compliance workflow.
Each node represents a specialist agent with specific responsibilities.
"""
from datetime import datetime
from app.agents.state import WorkerComplianceState, AgentType, ComplianceStatus
from app.tools.compliance_tools import (
    calculate_mtlm_levy,
    calculate_compounding_fines,
    check_ep_salary_compliance,
    calculate_fomema_requirements,
    check_passport_validity,
    calculate_compliance_deadlock_risk
)


def supervisor_node(state: WorkerComplianceState) -> WorkerComplianceState:
    """
    Agent Supervisor - orchestrates the workflow and decides next actions.
    """
    observations = state.get("agent_observations", [])
    observations.append(f"[Supervisor] Evaluating worker {state['worker_id']} - Status: {state['compliance_status']}")

    # Determine next action based on current state
    if not state.get("documents_validated"):
        next_action = "audit_documents"
    elif state.get("compliance_status") == ComplianceStatus.ONBOARDING:
        next_action = "calculate_strategy"
    elif state.get("compliance_status") == ComplianceStatus.RENEWAL_PENDING:
        next_action = "prepare_filing"
    elif state.get("deadlock_detected"):
        next_action = "hitl_review"
    elif len(state.get("pending_obligations", [])) == 0 and state.get("documents_validated"):
        next_action = None
        workflow_complete = True
        observations.append("[Supervisor] All obligations completed. Workflow complete.")
        return {
            **state,
            "current_agent": AgentType.SUPERVISOR,
            "agent_observations": observations,
            "next_action": next_action,
            "workflow_complete": workflow_complete
        }
    else:
        next_action = "calculate_strategy"

    return {
        **state,
        "current_agent": AgentType.SUPERVISOR,
        "agent_observations": observations,
        "next_action": next_action
    }


def auditor_node(state: WorkerComplianceState) -> WorkerComplianceState:
    """
    Auditor Agent - validates documents and identifies compliance gaps.
    """
    observations = state.get("agent_observations", [])
    observations.append(f"[Auditor] Auditing worker {state['passport_number']}")

    tool_calls = state.get("tool_calls", [])
    alerts = state.get("alerts", [])
    missing_docs = []

    # Check passport validity
    if state.get("passport_expiry_date") and state.get("permit_expiry_date"):
        passport_check = check_passport_validity(
            passport_expiry=datetime.fromisoformat(state["passport_expiry_date"]),
            permit_expiry=datetime.fromisoformat(state["permit_expiry_date"])
        )
        tool_calls.append({
            "tool": "check_passport_validity",
            "result": passport_check,
            "timestamp": datetime.now().isoformat()
        })

        if passport_check["renewal_blocked"]:
            observations.append(f"[Auditor] CRITICAL: Passport expires in {passport_check['months_until_passport_expiry']} months - renewal blocked")
            alerts.append({
                "type": "passport_expiry",
                "severity": "critical",
                "message": passport_check["action"],
                "data": passport_check
            })
            missing_docs.append("passport_renewal_application")

    # Check FOMEMA requirements
    if state.get("permit_issue_date"):
        fomema_check = calculate_fomema_requirements(
            permit_issue_date=datetime.fromisoformat(state["permit_issue_date"]),
            last_fomema_date=datetime.fromisoformat(state["last_fomema_date"]) if state.get("last_fomema_date") else None
        )
        tool_calls.append({
            "tool": "calculate_fomema_requirements",
            "result": fomema_check,
            "timestamp": datetime.now().isoformat()
        })

        if fomema_check["screening_required"]:
            observations.append(f"[Auditor] FOMEMA screening required - {fomema_check['days_until_due']} days until due")
            alerts.append({
                "type": "fomema_due",
                "severity": "high" if fomema_check["days_until_due"] < 30 else "medium",
                "message": f"FOMEMA screening due in {fomema_check['days_until_due']} days",
                "data": fomema_check
            })

    # Check for overstay
    if state.get("permit_expiry_date"):
        permit_expiry = datetime.fromisoformat(state["permit_expiry_date"])
        days_to_expiry = (permit_expiry - datetime.now()).days

        if days_to_expiry < 0:
            # Permit expired - calculate fines
            overstay_days = abs(days_to_expiry)
            fine_calc = calculate_compounding_fines(overstay_days)
            tool_calls.append({
                "tool": "calculate_compounding_fines",
                "result": fine_calc,
                "timestamp": datetime.now().isoformat()
            })

            observations.append(f"[Auditor] CRITICAL: Permit expired {overstay_days} days ago - Fine: RM {fine_calc['total_fine_rm']}")
            alerts.append({
                "type": "permit_expired",
                "severity": "critical",
                "message": fine_calc["recommended_action"],
                "data": fine_calc
            })

            return {
                **state,
                "current_agent": AgentType.AUDITOR,
                "agent_observations": observations,
                "tool_calls": tool_calls,
                "alerts": alerts,
                "outstanding_fines_rm": fine_calc["total_fine_rm"],
                "compliance_status": ComplianceStatus.EXPIRED,
                "documents_validated": True,
                "missing_documents": missing_docs,
                "next_action": "hitl_review",
                "hitl_required": True,
                "hitl_reason": "permit_expired_requires_immediate_action",
                "hitl_data": fine_calc
            }

    observations.append("[Auditor] Document audit complete")

    return {
        **state,
        "current_agent": AgentType.AUDITOR,
        "agent_observations": observations,
        "tool_calls": tool_calls,
        "alerts": alerts,
        "documents_validated": True,
        "missing_documents": missing_docs,
        "next_action": "calculate_strategy"
    }


def strategist_node(state: WorkerComplianceState) -> WorkerComplianceState:
    """
    Strategist Agent - calculates financial impacts and compliance strategy.
    """
    observations = state.get("agent_observations", [])
    observations.append(f"[Strategist] Calculating compliance strategy for {state['worker_id']}")

    tool_calls = state.get("tool_calls", [])
    alerts = state.get("alerts", [])
    pending_obligations = []

    # Calculate MTLM levy impact (placeholder - needs company-level data)
    # For now, calculate individual worker levy
    if state.get("sector"):
        levy_calc = calculate_mtlm_levy(
            sector=state["sector"],
            current_foreign_count=1,  # Placeholder
            current_local_count=10,   # Placeholder
            new_foreign_workers=0
        )
        tool_calls.append({
            "tool": "calculate_mtlm_levy",
            "result": levy_calc,
            "timestamp": datetime.now().isoformat()
        })

        observations.append(f"[Strategist] MTLM Levy: RM {levy_calc['levy_per_worker_rm']}/year (Tier: {levy_calc['tier']})")

        state["mtlm_levy_rm"] = levy_calc["levy_per_worker_rm"]

    # Check EP salary compliance for June 2026
    if state.get("permit_class", "").startswith("EP_") and state.get("current_salary_rm"):
        renewal_date = datetime.fromisoformat(state["permit_expiry_date"]) if state.get("permit_expiry_date") else datetime.now()

        salary_check = check_ep_salary_compliance(
            category=state["permit_class"],
            current_salary_rm=state["current_salary_rm"],
            renewal_date=renewal_date
        )
        tool_calls.append({
            "tool": "check_ep_salary_compliance",
            "result": salary_check,
            "timestamp": datetime.now().isoformat()
        })

        if not salary_check["compliant"]:
            observations.append(f"[Strategist] WARNING: Salary shortfall of RM {salary_check['shortfall_rm']} for {state['permit_class']}")
            alerts.append({
                "type": "salary_non_compliance",
                "severity": "high",
                "message": f"Salary increase of RM {salary_check['shortfall_rm']} required before renewal",
                "data": salary_check
            })

            pending_obligations.append({
                "task_type": "SALARY_ADJUSTMENT",
                "task_name": f"Increase salary to RM {salary_check['required_salary_rm']}",
                "status": "pending",
                "due_date": renewal_date.isoformat(),
                "estimated_cost": salary_check["shortfall_rm"],
                "authority": "Employer"
            })

    # Check for deadlock scenarios
    if state.get("permit_expiry_date") and state.get("passport_expiry_date"):
        passport_months = (datetime.fromisoformat(state["passport_expiry_date"]) - datetime.now()).days / 30.44

        deadlock_check = calculate_compliance_deadlock_risk(
            permit_expiry=datetime.fromisoformat(state["permit_expiry_date"]),
            fomema_status=state.get("fomema_status", "pending"),
            passport_months_remaining=passport_months
        )
        tool_calls.append({
            "tool": "calculate_compliance_deadlock_risk",
            "result": deadlock_check,
            "timestamp": datetime.now().isoformat()
        })

        if deadlock_check["deadlock_detected"]:
            observations.append(f"[Strategist] DEADLOCK DETECTED: {deadlock_check['deadlock_type']}")
            alerts.append({
                "type": "compliance_deadlock",
                "severity": "critical",
                "message": deadlock_check["mitigation_action"],
                "data": deadlock_check
            })

            return {
                **state,
                "current_agent": AgentType.STRATEGIST,
                "agent_observations": observations,
                "tool_calls": tool_calls,
                "alerts": alerts,
                "deadlock_detected": True,
                "deadlock_type": deadlock_check["deadlock_type"],
                "compliance_status": ComplianceStatus.DEADLOCK,
                "next_action": "hitl_review",
                "hitl_required": True,
                "hitl_reason": "compliance_deadlock_detected",
                "hitl_data": deadlock_check
            }

    observations.append("[Strategist] Strategy calculation complete")

    return {
        **state,
        "current_agent": AgentType.STRATEGIST,
        "agent_observations": observations,
        "tool_calls": tool_calls,
        "alerts": alerts,
        "pending_obligations": state.get("pending_obligations", []) + pending_obligations,
        "compliance_status": ComplianceStatus.ACTIVE,
        "next_action": None,
        "workflow_complete": True
    }


def filing_node(state: WorkerComplianceState) -> WorkerComplianceState:
    """
    Filing Agent - prepares government submission documents and payloads.
    """
    observations = state.get("agent_observations", [])
    observations.append(f"[Filing] Preparing filing documents for {state['worker_id']}")

    # Generate filing payload (placeholder for actual document generation)
    filing_payload = {
        "worker_id": state["worker_id"],
        "passport_number": state["passport_number"],
        "permit_class": state["permit_class"],
        "sector": state["sector"],
        "documents_ready": state.get("documents_validated", False),
        "fomema_status": state.get("fomema_status"),
        "estimated_cost": state.get("estimated_renewal_cost_rm", 0)
    }

    observations.append("[Filing] Filing payload prepared - ready for MyEG/FWCMS submission")

    return {
        **state,
        "current_agent": AgentType.FILING,
        "agent_observations": observations,
        "compliance_status": ComplianceStatus.RENEWAL_PENDING,
        "next_action": None,
        "workflow_complete": True
    }


def hitl_interrupt_node(state: WorkerComplianceState) -> WorkerComplianceState:
    """
    HITL (Human-in-the-Loop) Interrupt Node - pauses workflow for human decision.
    """
    observations = state.get("agent_observations", [])
    observations.append(f"[HITL] Workflow paused - awaiting human decision: {state.get('hitl_reason')}")

    # This node simply marks the state as requiring human input
    # The workflow will pause here until the user provides input via API

    return {
        **state,
        "current_agent": AgentType.SUPERVISOR,
        "agent_observations": observations,
        "next_action": "hitl_review"
    }
