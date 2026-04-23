"""
Agent node implementations for LangGraph compliance workflow.
Each node represents a specialist agent with specific responsibilities.
"""
import asyncio
from datetime import datetime
from app.agents.state import WorkerComplianceState, AgentType, ComplianceStatus, RegulatoryGate
from app.firebase_config import db
from app.services.realtime_service import realtime_dashboard_manager
from app.tools.compliance_tools import (
    calculate_mtlm_levy,
    calculate_compounding_fines,
    check_ep_salary_compliance,
    calculate_fomema_requirements,
    check_passport_validity,
    calculate_compliance_deadlock_risk
)


def post_agent_writeback(state: WorkerComplianceState, findings: dict) -> None:
    """
    Persist key findings after node execution.
    - writes alerts/findings into worker task subcollection
    - updates compliance_state aggregate
    """
    worker_id = state.get("worker_id")
    if not worker_id:
        return

    now = datetime.now().isoformat()

    # Write concise findings as tasks.
    alerts = findings.get("alerts", []) or []
    tasks_ref = db.collection("workers").document(worker_id).collection("tasks")
    for alert in alerts:
        tasks_ref.add(
            {
                "type": "alert",
                "task_type": (alert.get("type") or "ALERT").upper(),
                "task_name": alert.get("message") or "Compliance alert",
                "status": "pending",
                "priority": "critical" if alert.get("severity") == "critical" else "high",
                "payload": alert,
                "created_at": now,
            }
        )

    compliance_ref = db.collection("compliance_state").document(worker_id)
    compliance_ref.set(
        {
            "worker_id": worker_id,
            "compliance_status": str(state.get("compliance_status")),
            "deadlock_detected": bool(state.get("deadlock_detected")),
            "outstanding_fines_rm": state.get("outstanding_fines_rm") or 0,
            "flags": [alert.get("type") for alert in alerts if alert.get("type")],
            "health_score": max(
                0,
                100
                - (20 if state.get("deadlock_detected") else 0)
                - (10 * len(alerts)),
            ),
            "updated_at": now,
        },
        merge=True,
    )

    try:
        loop = asyncio.get_running_loop()
        loop.create_task(
            realtime_dashboard_manager.broadcast_json(
                {
                    "event": "dashboard_refresh",
                    "worker_id": worker_id,
                    "compliance_status": str(state.get("compliance_status")),
                    "updated_at": now,
                }
            )
        )
    except RuntimeError:
        # No running loop, skip push notification.
        pass


def supervisor_node(state: WorkerComplianceState) -> WorkerComplianceState:
    """
    Agent Supervisor - orchestrates the workflow and decides next actions.
    """
    observations = state.get("agent_observations", [])
    observations.append(f"[Supervisor] Evaluating worker {state['worker_id']} - Status: {state['compliance_status']}")

    # Determine next action based on current state
    current_gate = state.get("current_gate")

    if current_gate in {RegulatoryGate.GATE_1_JTKSM, RegulatoryGate.GATE_1_JTKSM.value}:
        next_action = "company_audit"
    elif current_gate in {RegulatoryGate.GATE_2_KDN, RegulatoryGate.GATE_2_KDN.value}:
        next_action = "vdr_filing"
    elif current_gate in {RegulatoryGate.GATE_3_JIM, RegulatoryGate.GATE_3_JIM.value}:
        next_action = "plks_monitor"
    elif not state.get("documents_validated"):
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

            updated_state = {
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
            post_agent_writeback(updated_state, {"alerts": alerts})
            return updated_state

    observations.append("[Auditor] Document audit complete")

    updated_state = {
        **state,
        "current_agent": AgentType.AUDITOR,
        "agent_observations": observations,
        "tool_calls": tool_calls,
        "alerts": alerts,
        "documents_validated": True,
        "missing_documents": missing_docs,
        "next_action": "calculate_strategy"
    }
    post_agent_writeback(updated_state, {"alerts": alerts})
    return updated_state


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

            updated_state = {
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
            post_agent_writeback(updated_state, {"alerts": alerts})
            return updated_state

    observations.append("[Strategist] Strategy calculation complete")

    updated_state = {
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
    post_agent_writeback(updated_state, {"alerts": alerts})
    return updated_state


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

    updated_state = {
        **state,
        "current_agent": AgentType.FILING,
        "agent_observations": observations,
        "compliance_status": ComplianceStatus.RENEWAL_PENDING,
        "next_action": None,
        "workflow_complete": True
    }
    post_agent_writeback(updated_state, {"alerts": state.get("alerts", [])})
    return updated_state


def hitl_interrupt_node(state: WorkerComplianceState) -> WorkerComplianceState:
    """
    HITL (Human-in-the-Loop) Interrupt Node - pauses workflow for human decision.
    """
    observations = state.get("agent_observations", [])
    observations.append(f"[HITL] Workflow paused - awaiting human decision: {state.get('hitl_reason')}")

    # This node simply marks the state as requiring human input
    # The workflow will pause here until the user provides input via API

    updated_state = {
        **state,
        "current_agent": AgentType.SUPERVISOR,
        "agent_observations": observations,
        "next_action": "hitl_review"
    }
    post_agent_writeback(updated_state, {"alerts": state.get("alerts", [])})
    return updated_state


def company_audit_node(state: WorkerComplianceState) -> WorkerComplianceState:
    """
    Company Audit Node — validates JTKSM 60K readiness.

    Checks performed (per implement_plan.md §4 company_audit_node):
      1. JTKSM 60K approval status
      2. Act 446 cert existence AND expiry date
      3. Sector quota_balance > 0
    Results are written back to compliance_state/{worker_id}.
    """
    observations = state.get("agent_observations", [])
    alerts = state.get("alerts", [])
    tool_calls = state.get("tool_calls", [])

    worker_id = state.get("worker_id")
    worker_doc = db.collection("workers").document(worker_id).get() if worker_id else None
    worker_data = worker_doc.to_dict() if worker_doc and worker_doc.exists else {}

    company_id = worker_data.get("company_id") or state.get("employer_id")
    sector = worker_data.get("sector") or state.get("sector", "MFG")
    blockers = []
    gate_result = "pending"

    if not company_id:
        blockers.append("missing_company_id")
    else:
        company_doc = db.collection("companies").document(company_id).get()
        if not company_doc.exists:
            blockers.append("company_not_found")
        else:
            company = company_doc.to_dict()

            # 1. JTKSM 60K status
            jtksm_status = company.get("jtksm_60k_status")
            tool_calls.append({
                "tool": "check_60k_status",
                "result": {"status": jtksm_status},
                "timestamp": datetime.now().isoformat(),
            })
            if jtksm_status != "approved":
                blockers.append("jtksm_60k_not_approved")

            # 2. Act 446 cert validity
            act_446_expiry = company.get("act_446_expiry_date")
            if not act_446_expiry:
                blockers.append("act_446_cert_missing")
            else:
                try:
                    expiry_dt = datetime.fromisoformat(act_446_expiry)
                    days_left = (expiry_dt - datetime.now()).days
                    tool_calls.append({
                        "tool": "check_act446_validity",
                        "result": {"expiry": act_446_expiry, "days_left": days_left},
                        "timestamp": datetime.now().isoformat(),
                    })
                    if days_left < 0:
                        blockers.append("act_446_cert_expired")
                    elif days_left < 30:
                        alerts.append({
                            "type": "act_446_expiry_warning",
                            "severity": "high",
                            "message": f"Act 446 cert expires in {days_left} days",
                        })
                except (ValueError, TypeError):
                    blockers.append("act_446_cert_invalid_date")

            # 3. Quota balance
            quota = company.get("quota_balance", {})
            sector_quota = quota.get(sector, 0) if isinstance(quota, dict) else 0
            tool_calls.append({
                "tool": "check_quota",
                "result": {"sector": sector, "available": sector_quota},
                "timestamp": datetime.now().isoformat(),
            })
            if sector_quota <= 0:
                blockers.append(f"quota_exhausted_{sector}")

    # Determine gate outcome
    if blockers:
        gate_result = "rejected"
        alerts.append({
            "type": "jtksm_gate_blocked",
            "severity": "high",
            "message": "Company gate blockers found",
            "blockers": blockers,
        })
        observations.append(f"[CompanyAudit] Blockers: {', '.join(blockers)}")
    else:
        gate_result = "approved"
        observations.append("[CompanyAudit] JTKSM gate approved")

    # Write gate status to compliance_state
    if worker_id:
        db.collection("compliance_state").document(worker_id).set(
            {
                "gate_jtksm": gate_result,
                "updated_at": datetime.now().isoformat(),
            },
            merge=True,
        )

    updated_state = {
        **state,
        "current_agent": AgentType.AUDITOR,
        "agent_observations": observations,
        "tool_calls": tool_calls,
        "alerts": alerts,
        "next_action": "calculate_strategy",
    }
    post_agent_writeback(updated_state, {"alerts": alerts})
    return updated_state


def vdr_filing_node(state: WorkerComplianceState) -> WorkerComplianceState:
    """
    VDR Filing Node — validates all VDR prerequisites before filing.

    Checks performed (per implement_plan.md §4 vdr_filing_node):
      1. All VDR checklist items complete (passport, photo, contract, etc.)
      2. Biomedical result == "fit"
      3. If EP-II/III: succession plan uploaded
      4. Generate IMM.47 payload when ready
    Results are written back to compliance_state/{worker_id}.
    """
    observations = state.get("agent_observations", [])
    alerts = state.get("alerts", [])
    tool_calls = state.get("tool_calls", [])
    worker_id = state.get("worker_id")

    blockers = []
    vdr_id = None
    checklist_status = None
    imm47_payload = None
    gate_result = "pending"

    vdr_docs = db.collection("vdr_applications").where("worker_id", "==", worker_id).stream()
    vdr_doc = next(vdr_docs, None)
    if not vdr_doc:
        blockers.append("vdr_application_missing")
    else:
        vdr_id = vdr_doc.id
        vdr = vdr_doc.to_dict()

        # 1. Check each mandatory document
        if not vdr.get("passport_scan_url"):
            blockers.append("passport_scan_missing")
        if not vdr.get("passport_photo_url"):
            blockers.append("passport_photo_missing")
        if not vdr.get("signed_contract_url"):
            blockers.append("signed_contract_missing")

        # 2. Photo biometric compliance
        if not vdr.get("photo_biometric_compliant"):
            blockers.append("photo_biometric_non_compliant")
            photo_issues = vdr.get("photo_validation_issues", [])
            if photo_issues:
                observations.append(f"[VDRFiling] Photo issues: {', '.join(photo_issues)}")

        # 3. Biomedical status
        biomedical_status = vdr.get("biomedical_status", "pending")
        tool_calls.append({
            "tool": "check_biomedical_status",
            "result": {"status": biomedical_status},
            "timestamp": datetime.now().isoformat(),
        })
        if biomedical_status != "fit":
            blockers.append("biomedical_not_fit")

        # 4. EP succession plan check
        worker_doc = db.collection("workers").document(worker_id).get() if worker_id else None
        worker_data = worker_doc.to_dict() if worker_doc and worker_doc.exists else {}
        permit_class = (worker_data.get("permit_class") or state.get("permit_class", "")).upper()

        ep_succession_categories = {"EP_II", "EP_III", "EP_CATEGORY_II", "EP_CATEGORY_III"}
        if permit_class in ep_succession_categories:
            if not vdr.get("succession_plan_url"):
                blockers.append("succession_plan_missing")
            if not vdr.get("academic_certs_urls"):
                blockers.append("academic_certs_missing")
            tool_calls.append({
                "tool": "check_succession_plan_required",
                "result": {"required": True, "permit_class": permit_class},
                "timestamp": datetime.now().isoformat(),
            })

        # 5. Biomedical ref number
        if not vdr.get("biomedical_ref_number"):
            blockers.append("biomedical_ref_missing")

        # Summarise checklist
        checklist = vdr.get("checklist", [])
        required_items = [item for item in checklist if item.get("required")]
        complete_items = [item for item in required_items if item.get("complete")]
        checklist_status = {
            "complete_count": len(complete_items),
            "total": len(required_items),
            "all_required_complete": len(complete_items) == len(required_items) if required_items else False,
        }
        tool_calls.append({
            "tool": "get_checklist_status",
            "result": checklist_status,
            "timestamp": datetime.now().isoformat(),
        })

    # Determine gate outcome
    if blockers:
        gate_result = "docs_pending" if any("missing" in b for b in blockers) else "rejected"
        alerts.append({
            "type": "vdr_filing_blocked",
            "severity": "high",
            "message": "VDR filing prerequisites not met",
            "blockers": blockers,
        })
        observations.append(f"[VDRFiling] Blockers: {', '.join(blockers)}")
    else:
        gate_result = "approved"
        observations.append("[VDRFiling] All VDR filing prerequisites met — generating IMM.47")

        # Generate IMM.47 payload when everything is ready
        if vdr_id:
            try:
                import asyncio
                from app.services.vdr_service import vdr_service
                imm47_payload = asyncio.get_event_loop().run_until_complete(
                    vdr_service.generate_imm47_payload(vdr_id)
                )
                tool_calls.append({
                    "tool": "generate_imm47_payload",
                    "result": {"generated": True, "vdr_id": vdr_id},
                    "timestamp": datetime.now().isoformat(),
                })
                observations.append("[VDRFiling] IMM.47 payload generated successfully")
            except Exception as exc:
                observations.append(f"[VDRFiling] IMM.47 generation deferred: {exc}")

    # Write gate status to compliance_state
    if worker_id:
        db.collection("compliance_state").document(worker_id).set(
            {
                "gate_vdr": gate_result,
                "updated_at": datetime.now().isoformat(),
            },
            merge=True,
        )

    updated_state = {
        **state,
        "current_agent": AgentType.FILING,
        "agent_observations": observations,
        "tool_calls": tool_calls,
        "alerts": alerts,
        "next_action": "prepare_filing" if not blockers else "calculate_strategy",
    }
    post_agent_writeback(updated_state, {"alerts": alerts})
    return updated_state


def plks_monitor_node(state: WorkerComplianceState) -> WorkerComplianceState:
    """
    PLKS Monitor Node — tracks the entire post-arrival chain.

    Checks performed (per implement_plan.md §4 plks_monitor_node):
      1. MDAC verification status
      2. SEV stamp verification
      3. FOMEMA registration / attendance / result
      4. Deadline tracking: Day 7 (registration), Day 25 (attendance), Day 30 (result)
      5. If fomema == "unfit": flag COM trigger
      6. Biometric completion status
    Results are written back to compliance_state/{worker_id}.
    """
    observations = state.get("agent_observations", [])
    alerts = state.get("alerts", [])
    tool_calls = state.get("tool_calls", [])
    worker_id = state.get("worker_id")

    blockers = []
    plks_stage = "unknown"
    next_plks_action = None
    deadline_alerts = []
    gate_fomema = "pending"
    gate_plks = "pending"

    # Get worker arrival info for deadline tracking
    worker_doc = db.collection("workers").document(worker_id).get() if worker_id else None
    worker_data = worker_doc.to_dict() if worker_doc and worker_doc.exists else {}
    arrival_raw = worker_data.get("arrival_date")
    deadline_raw = worker_data.get("fomema_deadline")

    days_since_arrival = None
    days_remaining = None
    if arrival_raw:
        try:
            arrival = datetime.fromisoformat(arrival_raw)
            days_since_arrival = (datetime.now() - arrival).days
        except (ValueError, TypeError):
            pass
    if deadline_raw:
        try:
            deadline = datetime.fromisoformat(deadline_raw)
            days_remaining = (deadline - datetime.now()).days
        except (ValueError, TypeError):
            pass

    plks_docs = db.collection("plks_applications").where("worker_id", "==", worker_id).stream()
    plks_doc = next(plks_docs, None)
    if not plks_doc:
        blockers.append("plks_application_missing")
        plks_stage = "missing"
    else:
        plks = plks_doc.to_dict()

        # 1. MDAC verification
        if not plks.get("mdac_verified"):
            blockers.append("mdac_not_verified")
            plks_stage = "pending_mdac"
            next_plks_action = "verify_mdac"
        else:
            plks_stage = "mdac_verified"

        # 2. SEV stamp
        if not plks.get("sev_stamp_verified"):
            blockers.append("sev_stamp_not_verified")

        # 3. FOMEMA registration
        if not plks.get("fomema_registration_date"):
            blockers.append("fomema_not_registered")
            if plks_stage == "mdac_verified":
                plks_stage = "pending_fomema_registration"
                next_plks_action = "register_fomema"

            # Day 7 deadline alert
            if days_since_arrival is not None and days_since_arrival >= 7:
                deadline_alerts.append("fomema_registration_overdue")
                alerts.append({
                    "type": "fomema_registration_overdue",
                    "severity": "critical",
                    "message": f"FOMEMA registration overdue — Day {days_since_arrival} (due by Day 7)",
                })
        else:
            # FOMEMA is registered — check attendance
            if not plks.get("fomema_attended_date"):
                if plks_stage in {"mdac_verified", "pending_fomema_registration"}:
                    plks_stage = "fomema_registered"
                    next_plks_action = "attend_fomema"

                # Day 25 deadline alert
                if days_since_arrival is not None and days_since_arrival >= 25:
                    deadline_alerts.append("fomema_attendance_critical")
                    alerts.append({
                        "type": "fomema_attendance_critical",
                        "severity": "critical",
                        "message": f"FOMEMA attendance critical — Day {days_since_arrival} (due by Day 30)",
                    })
            else:
                plks_stage = "fomema_attended"

            # FOMEMA result
            fomema_result = plks.get("fomema_result", "pending")
            tool_calls.append({
                "tool": "check_fomema_result",
                "result": {"result": fomema_result, "days_since_arrival": days_since_arrival},
                "timestamp": datetime.now().isoformat(),
            })

            if fomema_result == "fit":
                gate_fomema = "fit"
                plks_stage = "fomema_fit"

                # Check biometric
                if not plks.get("biometric_date"):
                    blockers.append("biometric_not_completed")
                    next_plks_action = "confirm_biometrics"
                else:
                    plks_stage = "biometric_done"
                    gate_plks = "endorsed" if plks.get("ikad_number") else "pending"
                    if plks.get("ikad_number"):
                        plks_stage = "plks_issued"
                        gate_plks = "issued"
                        next_plks_action = None
                    else:
                        next_plks_action = "endorse_plks"

            elif fomema_result == "unfit":
                gate_fomema = "unfit"
                plks_stage = "fomema_unfit"
                blockers.append("fomema_unfit_repatriation_required")
                next_plks_action = "trigger_com"
                alerts.append({
                    "type": "fomema_unfit",
                    "severity": "critical",
                    "message": "FOMEMA result UNFIT — Check Out Memo (COM) required",
                })
                if not plks.get("com_triggered"):
                    observations.append("[PLKSMonitor] COM not yet triggered for unfit worker")

            else:
                # Result still pending
                gate_fomema = "pending"
                if days_remaining is not None and days_remaining <= 0:
                    deadline_alerts.append("fomema_result_overdue")
                    alerts.append({
                        "type": "fomema_result_overdue",
                        "severity": "critical",
                        "message": "FOMEMA 30-day deadline exceeded — result still pending",
                    })

    # Summary observation
    if blockers:
        observations.append(f"[PLKSMonitor] Stage: {plks_stage} | Actions needed: {', '.join(blockers)}")
    else:
        observations.append(f"[PLKSMonitor] Stage: {plks_stage} | PLKS chain healthy")

    if days_since_arrival is not None:
        observations.append(f"[PLKSMonitor] Day {days_since_arrival}/30 since arrival | {days_remaining or 0} days remaining")

    if deadline_alerts:
        observations.append(f"[PLKSMonitor] Deadline alerts: {', '.join(deadline_alerts)}")

    # Write gate status to compliance_state
    if worker_id:
        db.collection("compliance_state").document(worker_id).set(
            {
                "gate_fomema": gate_fomema,
                "gate_plks": gate_plks,
                "updated_at": datetime.now().isoformat(),
            },
            merge=True,
        )

    updated_state = {
        **state,
        "current_agent": AgentType.STRATEGIST,
        "agent_observations": observations,
        "tool_calls": tool_calls,
        "alerts": alerts,
        "next_action": "calculate_strategy",
    }
    post_agent_writeback(updated_state, {"alerts": alerts})
    return updated_state

