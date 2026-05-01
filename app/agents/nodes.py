import asyncio
import json
import re
from datetime import datetime, date, timezone
from dateutil.relativedelta import relativedelta

from app.agents.state import VDRState, WorkerComplianceState, AgentType, ComplianceStatus, RegulatoryGate
from app.agents.trace import append_trace
from app.agents.langsmith_trace import trace_node
from app.agents.trace_emitter import emit
from app.firebase_config import db
from app.services.gemini_service import parse_document, generate_text
from app.services.realtime_service import realtime_dashboard_manager
from app.tools.compliance_tools import (
    calculate_mtlm_levy,
    calculate_compounding_fines,
    check_ep_salary_compliance,
    calculate_fomema_requirements,
    check_passport_validity,
    calculate_compliance_deadlock_risk,
)

TODAY = date.today


def safe_json_parse(text: str) -> tuple[dict, str | None]:
    try:
        if "```json" in text:
            text = text.split("```json")[1].split("```")[0].strip()
        parsed = json.loads(text)
        if not isinstance(parsed, dict):
            return {}, f"Expected object, got {type(parsed).__name__}"
        return parsed, None
    except json.JSONDecodeError as e:
        return {}, str(e)


def is_workflow_complete(state: WorkerComplianceState) -> bool:
    return (
        state.get("workflow_stage") == "ready_to_complete"
        and state.get("deadlock_detected") is False
        and state.get("hitl_required") is False
    )


_APPROVED_NATIONALITIES = {
    "bangladesh", "indonesia", "nepal", "myanmar", "vietnam",
    "cambodia", "laos", "pakistan", "sri lanka", "india",
    "philippines", "kazakhstan", "turkmenistan", "uzbekistan",
}


# ---------------------------------------------------------------------------
# Shared writeback (legacy WorkerComplianceState pipeline)
# ---------------------------------------------------------------------------

def post_agent_writeback(state: WorkerComplianceState, findings: dict) -> None:
    worker_id = state.get("worker_id")
    if not worker_id:
        return
    now = datetime.now().isoformat()
    alerts = findings.get("alerts", []) or []
    tasks_ref = db.collection("workers").document(worker_id).collection("tasks")
    for alert in alerts:
        tasks_ref.add({
            "type": "alert",
            "task_type": (alert.get("type") or "ALERT").upper(),
            "task_name": alert.get("message") or "Compliance alert",
            "status": "pending",
            "priority": "critical" if alert.get("severity") == "critical" else "high",
            "payload": alert,
            "created_at": now,
        })
    db.collection("compliance_state").document(worker_id).set({
        "worker_id": worker_id,
        "compliance_status": str(state.get("compliance_status")),
        "deadlock_detected": bool(state.get("deadlock_detected")),
        "outstanding_fines_rm": state.get("outstanding_fines_rm") or 0,
        "flags": [a.get("type") for a in alerts if a.get("type")],
        "health_score": max(0, 100 - (20 if state.get("deadlock_detected") else 0) - (10 * len(alerts))),
        "updated_at": now,
    }, merge=True)
    try:
        loop = asyncio.get_running_loop()
        loop.create_task(realtime_dashboard_manager.broadcast_json({
            "event": "dashboard_refresh",
            "worker_id": worker_id,
            "compliance_status": str(state.get("compliance_status")),
            "updated_at": now,
        }))
    except RuntimeError:
        pass


# ---------------------------------------------------------------------------
# Agent 1 — Document Parser
# ---------------------------------------------------------------------------

def _extract_field(extracted: dict, field: str):
    """Pull value from { field: {value, confidence} } or flat dict."""
    entry = extracted.get(field)
    if isinstance(entry, dict):
        return entry.get("value"), entry.get("confidence", 0.0)
    return entry, 1.0 if entry is not None else 0.0


def _low_confidence_fields(extracted: dict, threshold: float = 0.75) -> list:
    return [
        k for k, v in extracted.items()
        if isinstance(v, dict) and v.get("confidence", 1.0) < threshold
    ]


@trace_node("document_parser_node", "vdr")
def document_parser_node(state: VDRState) -> VDRState:
    state = append_trace(state, "document_parser_node", "running")
    try:
        updates: dict = {}
        low_conf: list = []

        docs: dict = (state.get("vdr_form_data") or {}).get("documents", {})

        for doc_type, image_url in docs.items():
            if not image_url:
                continue
            result = parse_document(image_url, doc_type)
            if not result.get("success"):
                continue
            extracted = result.get("extracted_data", {})

            if doc_type == "passport":
                master_name, conf = _extract_field(extracted, "master_name")
                passport_number, pconf = _extract_field(extracted, "passport_number")
                expiry, econf = _extract_field(extracted, "expiry_date")
                dob, _ = _extract_field(extracted, "dob")
                updates["master_name"] = master_name
                updates["passport_number"] = passport_number
                updates["passport_expiry"] = expiry
                updates["worker_dob"] = dob
                for field, c in [("master_name", conf), ("passport_number", pconf), ("passport_expiry", econf)]:
                    if c < 0.75:
                        low_conf.append(field)

            elif doc_type == "ssm_profile":
                updates["company_name"], _ = _extract_field(extracted, "company_name")
                updates["roc_number"], _ = _extract_field(extracted, "roc_number")
                updates["nature_of_business"], _ = _extract_field(extracted, "nature_of_business")

            elif doc_type == "act446_certificate":
                updates["act446_cert_number"], _ = _extract_field(extracted, "cert_number")
                cap, _ = _extract_field(extracted, "max_capacity")
                updates["act446_max_capacity"] = int(cap) if cap is not None else None

            elif doc_type == "epf_socso_statement":
                lc, _ = _extract_field(extracted, "local_employee_count")
                fc, _ = _extract_field(extracted, "foreign_employee_count")
                updates["local_employee_count"] = int(lc) if lc is not None else None
                updates["foreign_employee_count"] = int(fc) if fc is not None else None

            elif doc_type == "biomedical_slip":
                updates["biomedical_ref"], _ = _extract_field(extracted, "reference_number")

            elif doc_type == "borang100":
                updates["borang100_home_address"], _ = _extract_field(extracted, "home_country_address")
                parents, _ = _extract_field(extracted, "parents_names")
                updates["borang100_parents_names"] = json.dumps(parents) if parents else None

            elif doc_type == "fomema_report":
                result_val, _ = _extract_field(extracted, "result")
                updates["fomema_status"] = result_val or "Pending"

        if low_conf:
            state = {**state, **updates, "pipeline_status": "paused",
                     "halt_reason": f"Low confidence on critical fields: {', '.join(low_conf)}. Manual review required."}
            return append_trace(state, "document_parser_node", "completed",
                                summary=f"Paused — low confidence: {', '.join(low_conf)}")

        state = {**state, **updates, "pipeline_status": "running"}
        return append_trace(state, "document_parser_node", "completed",
                            summary=f"Parsed {len(docs)} documents")
    except Exception as e:
        state = {**state, "pipeline_status": "failed"}
        return append_trace(state, "document_parser_node", "failed", error=str(e))


# ---------------------------------------------------------------------------
# Agent 2 — Pre-Form Validator
# ---------------------------------------------------------------------------

@trace_node("pre_form_validator_node", "vdr")
def pre_form_validator_node(state: VDRState) -> VDRState:
    state = append_trace(state, "pre_form_validator_node", "running")
    try:
        today = TODAY()
        errors: list = []
        flags: list = []

        # Passport validity >= 18 months
        if state.get("passport_expiry"):
            try:
                expiry = datetime.strptime(state["passport_expiry"], "%y%m%d").date()
                if expiry < today + relativedelta(months=18):
                    errors.append("Passport expires in < 18 months. New passport required.")
            except (ValueError, TypeError):
                pass

        # Worker age <= 45
        if state.get("worker_dob"):
            try:
                dob = datetime.strptime(state["worker_dob"], "%y%m%d").date()
                age = relativedelta(today, dob).years
                if age > 45:
                    errors.append("Worker age exceeds 45. Ineligible for PLKS.")
            except (ValueError, TypeError):
                pass

        # Housing capacity
        quota = state.get("quota_requested") or 0
        capacity = state.get("act446_max_capacity") or 0
        if quota and capacity and quota > capacity:
            errors.append("Quota exceeds licensed housing capacity. Reduce quota.")

        # Local ratio <= 33%
        local = state.get("local_employee_count") or 0
        foreign = state.get("foreign_employee_count") or 0
        total = local + foreign
        if total > 0 and foreign / total > 0.33:
            errors.append("Foreign worker ratio exceeds 33% cap.")

        # Nationality from approved source-country list
        nationality = (state.get("nationality") or "").lower().strip()
        if nationality and nationality not in _APPROVED_NATIONALITIES:
            errors.append(f"Nationality '{nationality}' not on JTKSM approved source-country list.")

        # Borang 100 home address (hard stop)
        if not state.get("borang100_home_address"):
            errors.append("Borang 100 home address missing.")

        # Borang 100 parents names (hard stop)
        if not state.get("borang100_parents_names"):
            errors.append("Borang 100 parents' names missing.")

        # Biomedical ref format (hard stop)
        bio_ref = state.get("biomedical_ref") or ""
        if not re.fullmatch(r"\d{10,12}", str(bio_ref)):
            errors.append("Bio-medical reference number must be 10–12 digits.")

        # Employer-side checks via Firestore
        roc = state.get("roc_number")
        if roc:
            company_docs = db.collection("companies").where("roc_number", "==", roc).limit(1).stream()
            company_doc = next((d.to_dict() for d in company_docs), None)
            if company_doc:
                if not company_doc.get("ssm_registration_valid"):
                    errors.append("SSM registration is not active.")
                act446_expiry = company_doc.get("act_446_expiry_date")
                if not act446_expiry:
                    errors.append("Act 446 certificate missing.")
                else:
                    try:
                        if datetime.fromisoformat(act446_expiry).date() < today:
                            errors.append("Act 446 housing certificate has expired.")
                    except (ValueError, TypeError):
                        errors.append("Act 446 expiry date is invalid.")
                if company_doc.get("jtksm_60k_status") != "approved":
                    errors.append("Section 60K (JTKSM) approval not granted.")
                sector = (state.get("nature_of_business") or "").lower()
                quota_balance = company_doc.get("quota_balance", {})
                if isinstance(quota_balance, dict) and sector and quota_balance.get(sector, 1) <= 0:
                    errors.append(f"Quota exhausted for sector '{sector}'.")

        if errors:
            state = {**state, "employer_eligible": False, "housing_compliant": False,
                     "worker_eligible": False, "validation_errors": errors,
                     "quota_flags": flags, "pipeline_status": "failed", "halt_reason": errors[0]}
            return append_trace(state, "pre_form_validator_node", "completed",
                                summary=f"Failed: {errors[0]}")

        state = {**state, "employer_eligible": True, "housing_compliant": True,
                 "worker_eligible": True, "validation_errors": [], "quota_flags": flags,
                 "pipeline_status": "running"}
        return append_trace(state, "pre_form_validator_node", "completed",
                            summary="All validations passed")
    except Exception as e:
        state = {**state, "pipeline_status": "failed"}
        return append_trace(state, "pre_form_validator_node", "failed", error=str(e))


# ---------------------------------------------------------------------------
# Agent 3 — Signature Tracker
# ---------------------------------------------------------------------------

_SIGNATURE_REQUIREMENTS = [
    {
        "document": "Employment Contract",
        "signature_type": "wet_ink",
        "parties": ["Worker", "Employer"],
        "special_steps": ["print", "sign", "scan", "m_stamp"],
        "stage": "pre_vdr",
        "status": "pending",
    },
    {
        "document": "IMM.47 Visa Form",
        "signature_type": "wet_ink",
        "parties": ["Worker"],
        "special_steps": ["signature_must_match_passport"],
        "stage": "pre_vdr",
        "status": "pending",
    },
    {
        "document": "Borang 100",
        "signature_type": "wet_ink_thumbprint",
        "parties": ["Worker"],
        "special_steps": ["mandatory_for_e_vetting"],
        "stage": "pre_vdr",
        "status": "pending",
    },
    {
        "document": "Letter of Undertaking",
        "signature_type": "wet_ink_company_stamp",
        "parties": ["Employer"],
        "special_steps": ["legal_commitment_to_government"],
        "stage": "pre_vdr",
        "status": "pending",
    },
    {
        "document": "Repatriation Bond Declaration",
        "signature_type": "wet_ink_company_stamp",
        "parties": ["Employer"],
        "special_steps": ["employer_financial_liability_for_repatriation"],
        "stage": "pre_vdr",
        "status": "pending",
    },
    {
        "document": "SOCSO Form 2 (Worker Registration)",
        "signature_type": "wet_ink",
        "parties": ["Employer"],
        "special_steps": ["submit_to_socso_before_first_day"],
        "stage": "post_arrival",
        "status": "pending",
    },
    {
        "document": "EPF KWSP 3 (Worker Registration)",
        "signature_type": "wet_ink",
        "parties": ["Employer"],
        "special_steps": ["submit_to_kwsp_before_first_day"],
        "stage": "post_arrival",
        "status": "pending",
    },
    {
        "document": "FOMEMA Consent Form",
        "signature_type": "wet_ink",
        "parties": ["Worker"],
        "special_steps": ["clinic_issued", "required_at_fomema_registration"],
        "stage": "post_arrival",
        "status": "pending",
    },
    {
        "document": "Biometrics Consent Form",
        "signature_type": "wet_ink",
        "parties": ["Worker"],
        "special_steps": ["jim_issued", "required_at_ikad_enrollment"],
        "stage": "post_arrival",
        "status": "pending",
    },
]


@trace_node("signature_tracker_node", "vdr")
def signature_tracker_node(state: VDRState) -> VDRState:
    state = append_trace(state, "signature_tracker_node", "running")
    existing = state.get("signatures_required") or []
    if existing:
        state = {**state, "pipeline_status": "running"}
    else:
        state = {**state, "signatures_required": _SIGNATURE_REQUIREMENTS,
                 "signatures_completed": state.get("signatures_completed") or [],
                 "pipeline_status": "running"}
    return append_trace(state, "signature_tracker_node", "completed",
                        summary=f"{len(state.get('signatures_required', []))} signature documents tracked")


# ---------------------------------------------------------------------------
# Agent 4 — Compliance Reasoner
# ---------------------------------------------------------------------------

_LEVY_BY_SECTOR = {
    "manufacturing": 590, "construction": 1850, "services": 1850,
    "agriculture": 640, "domestic": 410,
}

_COMPLIANCE_SYSTEM = (
    "You are a Malaysian PLKS compliance expert. "
    "Generate obligations following: SOCSO_REGISTRATION -> FOMEMA_SCREENING -> "
    "PERMIT_RENEWAL -> LEVY_PAYMENT -> I_KAD_ISSUANCE."
)


@trace_node("compliance_reasoner_node", "vdr")
def compliance_reasoner_node(state: VDRState) -> VDRState:
    state = append_trace(state, "compliance_reasoner_node", "running")
    try:
        fomema_status = state.get("fomema_status") or "Pending"
        if fomema_status == "Unfit":
            state = {**state, "obligations": [], "pipeline_status": "failed",
                     "halt_reason": "FOMEMA result Unfit. Repatriation required."}
            return append_trace(state, "compliance_reasoner_node", "completed",
                                summary="Failed: FOMEMA Unfit")

        sector = (state.get("nature_of_business") or "manufacturing").lower()
        levy = _LEVY_BY_SECTOR.get(sector, 590)
        prompt = (
            f"Worker: {state.get('master_name')}, Passport: {state.get('passport_number')}\n"
            f"Sector: {sector}, Permit class: PLKS, Today: {TODAY()}, Annual levy: RM {levy}\n"
            f"FOMEMA status: {fomema_status}\n"
            "Return a JSON array of obligations. Each: {task_type, task_name, status, depends_on, "
            "due_date, authority, estimated_cost, notes}. "
            "FOMEMA-gated tasks have status 'blocked' when FOMEMA is Pending. "
            "Use master_name on all documents."
        )
        result = generate_text(prompt, _COMPLIANCE_SYSTEM)
        obligations = []
        if result.get("success"):
            parsed, _ = safe_json_parse('{"items":' + result["text"] + '}')
            raw = parsed.get("items", result["text"])
            try:
                if isinstance(raw, str):
                    if "```json" in raw:
                        raw = raw.split("```json")[1].split("```")[0].strip()
                    raw = json.loads(raw)
                obligations = raw if isinstance(raw, list) else []
            except Exception:
                pass

        state = {**state, "obligations": obligations, "pipeline_status": "running"}
        return append_trace(state, "compliance_reasoner_node", "completed",
                            summary=f"{len(obligations)} obligations generated")
    except Exception as e:
        state = {**state, "pipeline_status": "failed"}
        return append_trace(state, "compliance_reasoner_node", "failed", error=str(e))


# ---------------------------------------------------------------------------
# Agent 5 — FOMEMA Gate
# ---------------------------------------------------------------------------

_FOMEMA_SYSTEM = (
    "You are a FOMEMA verification agent. Verify passport match, result value, "
    "and that exam_date is within 12 months of today. "
    'Return JSON: {"verified": bool, "fomema_status": "Fit"|"Unfit"|"Pending", "flags": []}'
)


@trace_node("fomema_gate_node", "vdr")
def fomema_gate_node(state: VDRState) -> VDRState:
    state = append_trace(state, "fomema_gate_node", "running")
    try:
        fomema_status = state.get("fomema_status") or "Pending"
        if fomema_status == "Pending":
            state = {**state, "pipeline_status": "paused", "halt_reason": "Awaiting FOMEMA report upload."}
            return append_trace(state, "fomema_gate_node", "completed", summary="Paused: awaiting FOMEMA")

        result = generate_text(
            f"FOMEMA status: {fomema_status}, Passport: {state.get('passport_number')}, Today: {TODAY()}",
            _FOMEMA_SYSTEM,
        )
        verified_status = fomema_status
        if result.get("success"):
            try:
                verified_status = json.loads(result["text"]).get("fomema_status", fomema_status)
            except Exception:
                pass

        if verified_status == "Unfit":
            state = {**state, "fomema_status": "Unfit", "pipeline_status": "failed",
                     "halt_reason": "FOMEMA result Unfit. Generate REPATRIATION obligation."}
            return append_trace(state, "fomema_gate_node", "completed", summary="Failed: FOMEMA Unfit")

        if verified_status == "Pending":
            state = {**state, "fomema_status": "Pending", "pipeline_status": "paused",
                     "halt_reason": "FOMEMA result still pending. Re-upload when available."}
            return append_trace(state, "fomema_gate_node", "completed", summary="Paused: FOMEMA pending")

        obligations = [
            {**ob, "status": "pending"} if ob.get("task_type") == "LEVY_PAYMENT" and ob.get("status") == "blocked"
            else ob
            for ob in (state.get("obligations") or [])
        ]
        state = {**state, "fomema_status": "Fit", "obligations": obligations, "pipeline_status": "running"}
        return append_trace(state, "fomema_gate_node", "completed", summary="FOMEMA Fit — gate cleared")
    except Exception as e:
        state = {**state, "pipeline_status": "failed"}
        return append_trace(state, "fomema_gate_node", "failed", error=str(e))


# ---------------------------------------------------------------------------
# Agent 6 — VDR Assembler
# ---------------------------------------------------------------------------

_VDR_SYSTEM = (
    "You are a VDR form assembly agent for Malaysian PLKS immigration. "
    "Populate all IMM.47/FWCMS fields from verified state data. "
    "Use master_name (MRZ-derived) as the worker name — never the visual name. "
    'Return JSON: {"form_fields": {...}, "null_fields": [...], "submission_ready": bool}'
)


@trace_node("vdr_assembler_node", "vdr")
def vdr_assembler_node(state: VDRState) -> VDRState:
    state = append_trace(state, "vdr_assembler_node", "running")
    try:
        if not (state.get("employer_eligible") and state.get("housing_compliant") and
                state.get("worker_eligible") and state.get("fomema_status") == "Fit"):
            state = {**state, "pipeline_status": "paused", "halt_reason": "VDR prerequisites not met."}
            return append_trace(state, "vdr_assembler_node", "completed", summary="Paused: prerequisites not met")

        sigs_required = state.get("signatures_required") or []
        sigs_completed = state.get("signatures_completed") or []
        completed_docs = {s.get("document") for s in sigs_completed}
        m_stamp_ok = any(
            s.get("document") == "Employment Contract" and "m_stamp" in (s.get("special_steps") or [])
            for s in sigs_completed
        )
        pending_sigs = [s["document"] for s in sigs_required if s["document"] not in completed_docs]
        if pending_sigs or not m_stamp_ok:
            missing = pending_sigs + ([] if m_stamp_ok else ["Employment Contract M-Stamp"])
            state = {**state, "pipeline_status": "paused",
                     "halt_reason": f"Pending signatures/stamps: {', '.join(missing)}"}
            return append_trace(state, "vdr_assembler_node", "completed",
                                summary=f"Paused: missing {len(missing)} signatures")

        prompt = (
            f"Verified state:\n"
            f"master_name={state.get('master_name')}, passport_number={state.get('passport_number')}, "
            f"passport_expiry={state.get('passport_expiry')}, company_name={state.get('company_name')}, "
            f"roc_number={state.get('roc_number')}, act446_cert_number={state.get('act446_cert_number')}, "
            f"biomedical_ref={state.get('biomedical_ref')}, nature_of_business={state.get('nature_of_business')}\n"
            "Populate all IMM.47/FWCMS fields."
        )
        result = generate_text(prompt, _VDR_SYSTEM)
        form_data, parse_err = {}, None
        if result.get("success"):
            form_data, parse_err = safe_json_parse(result["text"])

        submission_ready = form_data.get("submission_ready", False)
        null_fields = form_data.get("null_fields", [])
        if parse_err or null_fields or not submission_ready:
            reason = parse_err or f"Missing required fields: {', '.join(null_fields)}"
            state = {**state, "vdr_form_data": form_data, "pipeline_status": "paused",
                     "halt_reason": reason}
            return append_trace(state, "vdr_assembler_node", "completed",
                                summary=f"Paused: {len(null_fields)} null fields")

        # Write pending handoff instead of real API call
        worker_id = state.get("worker_id")
        if worker_id:
            from datetime import timezone as _tz
            db.collection("pending_handoffs").add({
                "worker_id": worker_id,
                "action_type": "submit_imm47",
                "triggered_by": "vdr_assembler_node",
                "payload": form_data.get("form_fields", {}),
                "status": "awaiting_confirmation",
                "simulated": True,
                "created_at": datetime.now(_tz.utc).isoformat(),
            })

        state = {**state, "vdr_form_data": form_data, "pipeline_status": "completed"}
        return append_trace(state, "vdr_assembler_node", "completed",
                            summary="IMM.47 assembled — pending handoff confirmation")
    except Exception as e:
        state = {**state, "pipeline_status": "failed"}
        return append_trace(state, "vdr_assembler_node", "failed", error=str(e))


# ---------------------------------------------------------------------------
# Legacy nodes (WorkerComplianceState pipeline — kept for existing routes)
# ---------------------------------------------------------------------------

@trace_node("supervisor_node", "compliance")
def supervisor_node(state: WorkerComplianceState) -> WorkerComplianceState:
    state = emit("supervisor", "running", "Routing workflow...", state)
    state = append_trace(state, "supervisor_node", "running")
    observations = state.get("agent_observations", [])
    current_gate = state.get("current_gate")
    workflow_stage = state.get("workflow_stage", "init")

    if current_gate in {RegulatoryGate.GATE_1_JTKSM, RegulatoryGate.GATE_1_JTKSM.value}:
        next_action = "company_audit"
    elif current_gate in {RegulatoryGate.GATE_2_KDN, RegulatoryGate.GATE_2_KDN.value}:
        next_action = "vdr_filing"
    elif current_gate in {RegulatoryGate.GATE_3_JIM, RegulatoryGate.GATE_3_JIM.value}:
        next_action = "plks_monitor"
    elif workflow_stage == "init":
        next_action = "audit_documents"
    elif workflow_stage == "docs_validated":
        next_action = "calculate_strategy"
    elif workflow_stage == "strategy_done":
        if state.get("deadlock_detected"):
            next_action = "hitl_review"
        else:
            result = {**state, "current_agent": AgentType.SUPERVISOR,
                      "agent_observations": observations, "next_action": None,
                      "workflow_stage": "ready_to_complete", "workflow_complete": True}
            return append_trace(result, "supervisor_node", "completed", summary="Workflow complete")
    elif state.get("deadlock_detected"):
        next_action = "hitl_review"
    else:
        next_action = "calculate_strategy"

    result = {**state, "current_agent": AgentType.SUPERVISOR,
              "agent_observations": observations, "next_action": next_action}
    return append_trace(result, "supervisor_node", "completed", summary=f"Routing to {next_action}")


@trace_node("auditor_node", "compliance")
def auditor_node(state: WorkerComplianceState) -> WorkerComplianceState:
    state = emit("auditor", "running", "Auditing documents...", state)
    state = append_trace(state, "auditor_node", "running")
    observations = state.get("agent_observations", [])
    tool_calls = state.get("tool_calls", [])
    alerts = state.get("alerts", [])
    missing_docs = []
    now = datetime.now().isoformat()

    if state.get("passport_expiry_date") and state.get("permit_expiry_date"):
        check = check_passport_validity(
            passport_expiry=datetime.fromisoformat(state["passport_expiry_date"]),
            permit_expiry=datetime.fromisoformat(state["permit_expiry_date"]),
        )
        tool_calls.append({"tool": "check_passport_validity", "result": check, "timestamp": now})
        if check["renewal_blocked"]:
            alerts.append({"type": "passport_expiry", "severity": "critical",
                           "message": check["action"], "data": check})
            missing_docs.append("passport_renewal_application")

    if state.get("permit_issue_date"):
        fcheck = calculate_fomema_requirements(
            permit_issue_date=datetime.fromisoformat(state["permit_issue_date"]),
            last_fomema_date=datetime.fromisoformat(state["last_fomema_date"]) if state.get("last_fomema_date") else None,
        )
        tool_calls.append({"tool": "calculate_fomema_requirements", "result": fcheck, "timestamp": now})
        if fcheck["screening_required"]:
            alerts.append({"type": "fomema_due",
                           "severity": "high" if fcheck["days_until_due"] < 30 else "medium",
                           "message": f"FOMEMA screening due in {fcheck['days_until_due']} days",
                           "data": fcheck})

    if state.get("permit_expiry_date"):
        days = (datetime.fromisoformat(state["permit_expiry_date"]) - datetime.now()).days
        if days < 0:
            fine = calculate_compounding_fines(abs(days))
            tool_calls.append({"tool": "calculate_compounding_fines", "result": fine, "timestamp": now})
            alerts.append({"type": "permit_expired", "severity": "critical",
                           "message": fine["recommended_action"], "data": fine})
            updated = {**state, "current_agent": AgentType.AUDITOR, "agent_observations": observations,
                       "tool_calls": tool_calls, "alerts": alerts, "outstanding_fines_rm": fine["total_fine_rm"],
                       "compliance_status": ComplianceStatus.EXPIRED, "documents_validated": True,
                       "missing_documents": missing_docs, "next_action": "hitl_review",
                       "hitl_required": True, "hitl_reason": "permit_expired_requires_immediate_action",
                       "hitl_data": fine}
            post_agent_writeback(updated, {"alerts": alerts})
            return append_trace(updated, "auditor_node", "completed", summary="HITL: permit expired")

    updated = {**state, "current_agent": AgentType.AUDITOR, "agent_observations": observations,
               "tool_calls": tool_calls, "alerts": alerts, "documents_validated": True,
               "missing_documents": missing_docs, "next_action": "calculate_strategy",
               "workflow_stage": "docs_validated"}
    post_agent_writeback(updated, {"alerts": alerts})
    return append_trace(updated, "auditor_node", "completed",
                        summary=f"{len(alerts)} alerts, {len(missing_docs)} missing docs")


@trace_node("strategist_node", "compliance")
def strategist_node(state: WorkerComplianceState) -> WorkerComplianceState:
    state = emit("strategist", "running", "Calculating compliance strategy...", state)
    state = append_trace(state, "strategist_node", "running")
    observations = state.get("agent_observations", [])
    tool_calls = state.get("tool_calls", [])
    alerts = state.get("alerts", [])
    pending_obligations = []
    now = datetime.now().isoformat()

    mtlm_levy_rm = state.get("mtlm_levy_rm")
    if state.get("sector"):
        levy = calculate_mtlm_levy(sector=state["sector"], current_foreign_count=1,
                                   current_local_count=10, new_foreign_workers=0)
        tool_calls.append({"tool": "calculate_mtlm_levy", "result": levy, "timestamp": now})
        mtlm_levy_rm = levy["levy_per_worker_rm"]

    if state.get("permit_class", "").startswith("EP_") and state.get("current_salary_rm"):
        renewal = datetime.fromisoformat(state["permit_expiry_date"]) if state.get("permit_expiry_date") else datetime.now()
        sc = check_ep_salary_compliance(category=state["permit_class"],
                                        current_salary_rm=state["current_salary_rm"],
                                        renewal_date=renewal)
        tool_calls.append({"tool": "check_ep_salary_compliance", "result": sc, "timestamp": now})
        if not sc["compliant"]:
            alerts.append({"type": "salary_non_compliance", "severity": "high",
                           "message": f"Salary increase of RM {sc['shortfall_rm']} required"})
            pending_obligations.append({"task_type": "SALARY_ADJUSTMENT",
                                        "task_name": f"Increase salary to RM {sc['required_salary_rm']}",
                                        "status": "pending"})

    if state.get("permit_expiry_date") and state.get("passport_expiry_date"):
        passport_months = (datetime.fromisoformat(state["passport_expiry_date"]) - datetime.now()).days / 30.44
        dc = calculate_compliance_deadlock_risk(
            permit_expiry=datetime.fromisoformat(state["permit_expiry_date"]),
            fomema_status=state.get("fomema_status", "pending"),
            passport_months_remaining=passport_months,
        )
        tool_calls.append({"tool": "calculate_compliance_deadlock_risk", "result": dc, "timestamp": now})
        if dc["deadlock_detected"]:
            alerts.append({"type": "compliance_deadlock", "severity": "critical",
                           "message": dc["mitigation_action"], "data": dc})
            updated = {**state, "current_agent": AgentType.STRATEGIST, "agent_observations": observations,
                       "tool_calls": tool_calls, "alerts": alerts, "deadlock_detected": True,
                       "deadlock_type": dc["deadlock_type"], "compliance_status": ComplianceStatus.DEADLOCK,
                       "next_action": "hitl_review", "hitl_required": True,
                       "hitl_reason": "compliance_deadlock_detected", "hitl_data": dc}
            post_agent_writeback(updated, {"alerts": alerts})
            return append_trace(updated, "strategist_node", "completed", summary="HITL: deadlock detected")

    updated = {**state, "current_agent": AgentType.STRATEGIST, "agent_observations": observations,
               "tool_calls": tool_calls, "alerts": alerts, "mtlm_levy_rm": mtlm_levy_rm,
               "pending_obligations": state.get("pending_obligations", []) + pending_obligations,
               "compliance_status": ComplianceStatus.ACTIVE, "next_action": None,
               "workflow_stage": "strategy_done"}
    post_agent_writeback(updated, {"alerts": alerts})
    return append_trace(updated, "strategist_node", "completed", summary="Strategy calculated")


@trace_node("filing_node", "compliance")
def filing_node(state: WorkerComplianceState) -> WorkerComplianceState:
    state = emit("filing", "running", "Preparing renewal filing...", state)
    state = append_trace(state, "filing_node", "running")
    updated = {**state, "current_agent": AgentType.FILING,
               "compliance_status": ComplianceStatus.RENEWAL_PENDING,
               "next_action": None, "workflow_complete": True}
    post_agent_writeback(updated, {"alerts": state.get("alerts", [])})
    return append_trace(updated, "filing_node", "completed", summary="Renewal pending")


@trace_node("hitl_interrupt_node", "compliance")
def hitl_interrupt_node(state: WorkerComplianceState) -> WorkerComplianceState:
    state = emit("hitl", "running", "Human review required...", state)
    state = append_trace(state, "hitl_interrupt_node", "running")
    updated = {**state, "current_agent": AgentType.SUPERVISOR, "next_action": "hitl_review"}
    post_agent_writeback(updated, {"alerts": state.get("alerts", [])})
    return append_trace(updated, "hitl_interrupt_node", "completed", summary="HITL interrupt raised")


@trace_node("company_audit_node", "compliance")
def company_audit_node(state: WorkerComplianceState) -> WorkerComplianceState:
    state = emit("company_audit", "running", "Auditing company gate (JTKSM)...", state)
    state = append_trace(state, "company_audit_node", "running")
    observations = state.get("agent_observations", [])
    alerts = state.get("alerts", [])
    tool_calls = state.get("tool_calls", [])
    worker_id = state.get("worker_id")
    worker_data = {}
    if worker_id:
        doc = db.collection("workers").document(worker_id).get()
        worker_data = doc.to_dict() if doc.exists else {}

    company_id = worker_data.get("company_id") or state.get("employer_id")
    sector = worker_data.get("sector") or state.get("sector", "MFG")
    blockers = []
    gate_result = "pending"
    now = datetime.now().isoformat()

    if not company_id:
        blockers.append("missing_company_id")
    else:
        company_doc = db.collection("companies").document(company_id).get()
        if not company_doc.exists:
            blockers.append("company_not_found")
        else:
            company = company_doc.to_dict()
            if company.get("jtksm_60k_status") != "approved":
                blockers.append("jtksm_60k_not_approved")
            expiry = company.get("act_446_expiry_date")
            if not expiry:
                blockers.append("act_446_cert_missing")
            else:
                try:
                    days_left = (datetime.fromisoformat(expiry) - datetime.now()).days
                    if days_left < 0:
                        blockers.append("act_446_cert_expired")
                    elif days_left < 30:
                        alerts.append({"type": "act_446_expiry_warning", "severity": "high",
                                       "message": f"Act 446 cert expires in {days_left} days"})
                except (ValueError, TypeError):
                    blockers.append("act_446_cert_invalid_date")
            quota = company.get("quota_balance", {})
            if isinstance(quota, dict) and quota.get(sector, 0) <= 0:
                blockers.append(f"quota_exhausted_{sector}")

    gate_result = "rejected" if blockers else "approved"
    if blockers:
        alerts.append({"type": "jtksm_gate_blocked", "severity": "high",
                       "message": "Company gate blockers found", "blockers": blockers})
    if worker_id:
        db.collection("compliance_state").document(worker_id).set(
            {"gate_jtksm": gate_result, "updated_at": now}, merge=True)

    updated = {**state, "current_agent": AgentType.AUDITOR, "agent_observations": observations,
               "tool_calls": tool_calls, "alerts": alerts, "next_action": "calculate_strategy"}
    post_agent_writeback(updated, {"alerts": alerts})
    return append_trace(updated, "company_audit_node", "completed",
                        summary=f"Gate: {gate_result}, {len(blockers)} blockers")


@trace_node("vdr_filing_node", "compliance")
def vdr_filing_node(state: WorkerComplianceState) -> WorkerComplianceState:
    state = emit("vdr_filing", "running", "Checking VDR filing prerequisites...", state)
    state = append_trace(state, "vdr_filing_node", "running")
    observations = state.get("agent_observations", [])
    alerts = state.get("alerts", [])
    tool_calls = state.get("tool_calls", [])
    worker_id = state.get("worker_id")
    blockers = []
    now = datetime.now().isoformat()

    vdr_docs = db.collection("vdr_applications").where("worker_id", "==", worker_id).stream()
    vdr_doc = next(vdr_docs, None)
    if not vdr_doc:
        blockers.append("vdr_application_missing")
    else:
        vdr = vdr_doc.to_dict()
        for field in ("passport_scan_url", "passport_photo_url", "signed_contract_url"):
            if not vdr.get(field):
                blockers.append(f"{field}_missing")
        if not vdr.get("photo_biometric_compliant"):
            blockers.append("photo_biometric_non_compliant")
        if vdr.get("biomedical_status") != "fit":
            blockers.append("biomedical_not_fit")
        worker_doc = db.collection("workers").document(worker_id).get() if worker_id else None
        permit_class = ((worker_doc.to_dict() if worker_doc and worker_doc.exists else {})
                        .get("permit_class") or state.get("permit_class", "")).upper()
        if permit_class in {"EP_II", "EP_III", "EP_CATEGORY_II", "EP_CATEGORY_III"}:
            if not vdr.get("succession_plan_url"):
                blockers.append("succession_plan_missing")

    gate_result = "docs_pending" if blockers else "approved"
    if blockers:
        alerts.append({"type": "vdr_filing_blocked", "severity": "high",
                       "message": "VDR filing prerequisites not met", "blockers": blockers})
    if worker_id:
        db.collection("compliance_state").document(worker_id).set(
            {"gate_vdr": gate_result, "updated_at": now}, merge=True)

    updated = {**state, "current_agent": AgentType.FILING, "agent_observations": observations,
               "tool_calls": tool_calls, "alerts": alerts,
               "next_action": "prepare_filing" if not blockers else "calculate_strategy"}
    post_agent_writeback(updated, {"alerts": alerts})
    return append_trace(updated, "vdr_filing_node", "completed",
                        summary=f"Gate: {gate_result}, {len(blockers)} blockers")


@trace_node("plks_monitor_node", "compliance")
def plks_monitor_node(state: WorkerComplianceState) -> WorkerComplianceState:
    state = emit("plks_monitor", "running", "Monitoring PLKS post-arrival gates...", state)
    state = append_trace(state, "plks_monitor_node", "running")
    observations = state.get("agent_observations", [])
    alerts = state.get("alerts", [])
    tool_calls = state.get("tool_calls", [])
    worker_id = state.get("worker_id")
    now = datetime.now().isoformat()
    gate_fomema = "pending"
    gate_plks = "pending"

    worker_data = {}
    if worker_id:
        doc = db.collection("workers").document(worker_id).get()
        worker_data = doc.to_dict() if doc.exists else {}

    days_since_arrival = None
    days_remaining = None
    try:
        if worker_data.get("arrival_date"):
            days_since_arrival = (datetime.now() - datetime.fromisoformat(worker_data["arrival_date"])).days
        if worker_data.get("fomema_deadline"):
            days_remaining = (datetime.fromisoformat(worker_data["fomema_deadline"]) - datetime.now()).days
    except (ValueError, TypeError):
        pass

    plks_doc = next(db.collection("plks_applications").where("worker_id", "==", worker_id).stream(), None)
    if not plks_doc:
        observations.append("[PLKSMonitor] No PLKS application found")
    else:
        plks = plks_doc.to_dict()
        fomema_result = plks.get("fomema_result", "pending")
        if fomema_result == "fit":
            gate_fomema = "fit"
            gate_plks = "issued" if plks.get("ikad_number") else ("endorsed" if plks.get("biometric_date") else "pending")
        elif fomema_result == "unfit":
            gate_fomema = "unfit"
            alerts.append({"type": "fomema_unfit", "severity": "critical",
                           "message": "FOMEMA result UNFIT — Check Out Memo (COM) required"})
        if days_since_arrival is not None and days_since_arrival >= 7 and not plks.get("fomema_registration_date"):
            alerts.append({"type": "fomema_registration_overdue", "severity": "critical",
                           "message": f"FOMEMA registration overdue — Day {days_since_arrival}"})

    if worker_id:
        db.collection("compliance_state").document(worker_id).set(
            {"gate_fomema": gate_fomema, "gate_plks": gate_plks, "updated_at": now}, merge=True)

    updated = {**state, "current_agent": AgentType.STRATEGIST, "agent_observations": observations,
               "tool_calls": tool_calls, "alerts": alerts, "next_action": "calculate_strategy"}
    post_agent_writeback(updated, {"alerts": alerts})
    return append_trace(updated, "plks_monitor_node", "completed",
                        summary=f"FOMEMA: {gate_fomema}, PLKS: {gate_plks}")
