"""All 10 nodes for the agentic orchestration graph."""
from __future__ import annotations
import json
from datetime import datetime, timezone
from uuid import uuid4

from app.agents.orchestration.state import OrchestrationState, OrchestrationStatus, TASK_TYPE_TO_SPECIALIST
from app.agents.langsmith_trace import trace_node
from app.firebase_config import db
from app.services.gemini_service import generate_text
from app.services.realtime_service import realtime_dashboard_manager
from app.tools.compliance_tools import check_passport_validity, calculate_fomema_requirements


# ── helpers ────────────────────────────────────────────────────────────────────

def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _log(state: OrchestrationState, node: str, status: str, msg: str = "") -> OrchestrationState:
    entry = {"node": node, "status": status, "timestamp": _now(), "msg": msg}
    trace = list(state.get("trace", [])) + [entry]
    statuses = {**state.get("agent_statuses", {}), node: status}
    log = list(state.get("execution_log", [])) + [entry]

    # persist to Firestore
    session_id = state.get("session_id", "")
    if session_id:
        try:
            db.collection("orchestration_sessions").document(session_id).set(
                {"trace": trace, "agent_statuses": statuses, "updated_at": _now()}, merge=True
            )
        except Exception:
            pass

    # broadcast websocket
    import asyncio
    try:
        loop = asyncio.get_running_loop()
        loop.create_task(realtime_dashboard_manager.broadcast_json({
            "type": "orchestration_event",
            "session_id": session_id,
            "worker_id": state.get("worker_id"),
            "node": node,
            "status": status,
            "msg": msg,
            "agent_statuses": statuses,
            "timestamp": _now(),
        }))
    except RuntimeError:
        pass

    return {**state, "trace": trace, "agent_statuses": statuses, "execution_log": log}


def _safe_json(text: str):
    try:
        if "```json" in text:
            text = text.split("```json")[1].split("```")[0].strip()
        return json.loads(text)
    except Exception:
        return None


# ── Node 1: entry_point ────────────────────────────────────────────────────────

@trace_node("entry_point", "orchestration")
def entry_point_node(state: OrchestrationState) -> OrchestrationState:
    state = _log(state, "entry_point", "running", "Loading worker context from Firestore")
    worker_id = state.get("worker_id", "")
    try:
        worker_doc = db.collection("workers").document(worker_id).get()
        worker_data = worker_doc.to_dict() if worker_doc.exists else {}

        company_id = worker_data.get("company_id", "")
        company_data = {}
        if company_id:
            cdoc = db.collection("companies").document(company_id).get()
            company_data = cdoc.to_dict() if cdoc.exists else {}

        docs = {}
        vdr_docs = db.collection("vdr_applications").where("worker_id", "==", worker_id).limit(1).stream()
        for d in vdr_docs:
            docs = d.to_dict()

        state = {**state, "worker_data": worker_data, "company_data": company_data, "documents": docs,
                 "status": OrchestrationStatus.ORCHESTRATING}
        return _log(state, "entry_point", "done", f"Loaded worker '{worker_data.get('full_name', worker_id)}'")
    except Exception as e:
        return _log({**state, "status": OrchestrationStatus.FAILED, "error": str(e)}, "entry_point", "failed", str(e))


# ── Node 2: planner ────────────────────────────────────────────────────────────

_PLANNER_SYSTEM = """You are a Malaysian PLKS compliance orchestration planner.
Given worker data and current gate, decompose work into ordered sub-tasks.
Task types: verify_eligibility, verify_documents, verify_passport, verify_biomedical,
fill_imm47, fill_plks, generate_contract, send_visa_letter, submit_portal, check_status.
Return JSON array: [{task_id, task_type, description, status:"pending"}]"""


@trace_node("planner", "orchestration")
def planner_node(state: OrchestrationState) -> OrchestrationState:
    state = _log(state, "planner", "running", "Decomposing work into sub-tasks")
    try:
        w = state.get("worker_data", {})
        docs = state.get("documents", {})
        gate = w.get("current_gate", "JTKSM")
        prompt = (
            f"Worker: {w.get('full_name')}, Gate: {gate}, "
            f"Trigger: {state.get('trigger_reason')}\n"
            f"Documents uploaded: {list(docs.keys())}\n"
            f"Fomema status: {w.get('fomema_status','Pending')}\n"
            "Create a plan of tasks needed to advance this worker."
        )
        result = generate_text(prompt, _PLANNER_SYSTEM)
        plan = []
        if result.get("success"):
            parsed = _safe_json(result["text"])
            if isinstance(parsed, list):
                plan = parsed
        if not plan:
            plan = [{"task_id": "t1", "task_type": "verify_documents", "description": "Verify uploaded documents", "status": "pending"},
                    {"task_id": "t2", "task_type": "verify_eligibility", "description": "Check worker eligibility", "status": "pending"}]
        state = {**state, "plan": plan, "current_task_index": 0, "status": OrchestrationStatus.EXECUTING}
        return _log(state, "planner", "done", f"Plan created with {len(plan)} tasks")
    except Exception as e:
        return _log({**state, "status": OrchestrationStatus.FAILED, "error": str(e)}, "planner", "failed", str(e))


# ── Node 3: router ─────────────────────────────────────────────────────────────

@trace_node("router", "orchestration")
def router_node(state: OrchestrationState) -> OrchestrationState:
    state = _log(state, "router", "running", "Routing to specialist")
    plan = state.get("plan", [])
    idx = state.get("current_task_index", 0)
    if idx >= len(plan):
        return _log({**state, "current_specialist": ""}, "router", "done", "All tasks complete")
    task = plan[idx]
    task_type = task.get("task_type", "")
    specialist = TASK_TYPE_TO_SPECIALIST.get(task_type, "verifier")
    reasoning = f"Task '{task_type}' → specialist '{specialist}'"
    state = {**state, "current_specialist": specialist, "specialist_reasoning": reasoning,
             "specialist_result": {}, "retry_count": state.get("retry_count", 0)}
    return _log(state, "router", "done", reasoning)


# ── Node 4: verifier ───────────────────────────────────────────────────────────

_VERIFIER_SYSTEM = """You are a Malaysian PLKS compliance verifier.
Cross-reference worker data against regulatory requirements.
Return JSON: {checks: [{field, status:"pass"|"fail"|"warning", details, suggestion?}], overall:"pass"|"fail"}"""


@trace_node("verifier", "orchestration")
def verifier_node(state: OrchestrationState) -> OrchestrationState:
    state = _log(state, "verifier", "running", "Running compliance verification")
    try:
        plan = state.get("plan", [])
        idx = state.get("current_task_index", 0)
        task = plan[idx] if idx < len(plan) else {}
        w = state.get("worker_data", {})
        company = state.get("company_data", {})

        checks = []
        now_dt = datetime.now()

        # Passport validity check
        passport_expiry = w.get("passport_expiry_date")
        permit_expiry = w.get("permit_expiry_date")
        if passport_expiry and permit_expiry:
            try:
                pv = check_passport_validity(
                    datetime.fromisoformat(passport_expiry),
                    datetime.fromisoformat(permit_expiry),
                    now_dt,
                )
                checks.append({"field": "passport_validity", "status": "fail" if pv["renewal_blocked"] else "pass",
                                "details": pv["action"]})
            except Exception:
                checks.append({"field": "passport_validity", "status": "warning", "details": "Could not parse dates"})

        # FOMEMA check
        permit_issue = w.get("permit_issue_date")
        if permit_issue:
            try:
                fv = calculate_fomema_requirements(datetime.fromisoformat(permit_issue))
                checks.append({"field": "fomema", "status": "warning" if fv["screening_required"] else "pass",
                                "details": f"Next screening: {fv['next_screening_date']}"})
            except Exception:
                pass

        # JTKSM company check
        if company.get("jtksm_60k_status") != "approved":
            checks.append({"field": "jtksm_60k", "status": "fail", "details": "Section 60K not approved",
                            "suggestion": "Obtain JTKSM Section 60K approval"})
        else:
            checks.append({"field": "jtksm_60k", "status": "pass", "details": "Section 60K approved"})

        # LLM reasoning for task-specific checks
        prompt = (
            f"Task: {task.get('description')}\n"
            f"Worker: {w.get('full_name')}, Passport: {w.get('passport_number')}\n"
            f"Gate: {w.get('current_gate')}, Fomema: {w.get('fomema_status','Pending')}\n"
            f"Existing checks: {json.dumps(checks)}\n"
            "Perform additional verification checks and return JSON."
        )
        result = generate_text(prompt, _VERIFIER_SYSTEM)
        if result.get("success"):
            parsed = _safe_json(result["text"])
            if isinstance(parsed, dict) and "checks" in parsed:
                checks.extend(parsed["checks"])

        overall = "fail" if any(c.get("status") == "fail" for c in checks) else "pass"
        verification_result = {"task_id": task.get("task_id"), "task_type": task.get("task_type"),
                                "checks": checks, "overall": overall, "timestamp": _now()}

        existing = list(state.get("verification_results", []))
        existing.append(verification_result)
        specialist_result = {"type": "verification", "overall": overall, "checks_count": len(checks)}
        state = {**state, "verification_results": existing, "specialist_result": specialist_result}
        return _log(state, "verifier", "done", f"Verification {overall} — {len(checks)} checks")
    except Exception as e:
        return _log({**state, "specialist_result": {"type": "verification", "error": str(e)}, "status": OrchestrationStatus.FAILED},
                    "verifier", "failed", str(e))


# ── Node 5: form_filler ────────────────────────────────────────────────────────

_FORM_FILLER_SYSTEM = """You are a Malaysian PLKS form auto-fill agent.
Map verified worker data to government form fields.
Return JSON: {form_type, fields_populated:{...}, null_fields:[], ready:bool}"""


@trace_node("form_filler", "orchestration")
def form_filler_node(state: OrchestrationState) -> OrchestrationState:
    state = _log(state, "form_filler", "running", "Auto-filling form fields")
    try:
        plan = state.get("plan", [])
        idx = state.get("current_task_index", 0)
        task = plan[idx] if idx < len(plan) else {}
        w = state.get("worker_data", {})
        company = state.get("company_data", {})
        task_type = task.get("task_type", "")

        prompt = (
            f"Form task: {task_type}\n"
            f"Worker data: name={w.get('full_name')}, passport={w.get('passport_number')}, "
            f"nationality={w.get('nationality')}, sector={w.get('sector')}, "
            f"permit_class={w.get('permit_class','PLKS')}\n"
            f"Company: {company.get('company_name')}, ROC: {company.get('roc_number')}\n"
            "Map all available fields to the appropriate form fields and return JSON."
        )
        result = generate_text(prompt, _FORM_FILLER_SYSTEM)
        fill_result = {"task_id": task.get("task_id"), "form_type": task_type,
                       "fields_populated": {}, "status": "generated", "timestamp": _now()}

        if result.get("success"):
            parsed = _safe_json(result["text"])
            if isinstance(parsed, dict):
                fill_result["fields_populated"] = parsed.get("fields_populated", {})
                fill_result["null_fields"] = parsed.get("null_fields", [])
                fill_result["ready"] = parsed.get("ready", True)

        # For contract generation, call existing agent
        if task_type == "generate_contract":
            try:
                from app.agents.contract_agent import generate_contract_for_worker
                contract_result = generate_contract_for_worker(state.get("worker_id", ""))
                fill_result["contract"] = contract_result
            except Exception as ce:
                fill_result["contract_error"] = str(ce)

        existing = list(state.get("form_fill_results", []))
        existing.append(fill_result)
        specialist_result = {"type": "form_fill", "form_type": task_type, "status": fill_result.get("status")}
        state = {**state, "form_fill_results": existing, "specialist_result": specialist_result}
        return _log(state, "form_filler", "done", f"Form '{task_type}' filled")
    except Exception as e:
        return _log({**state, "specialist_result": {"type": "form_fill", "error": str(e)}, "status": OrchestrationStatus.FAILED},
                    "form_filler", "failed", str(e))


# ── Node 6: portal_agent ───────────────────────────────────────────────────────

_PORTAL_SYSTEM = """You are a mock FWCMS government portal agent for Malaysian PLKS.
Simulate portal submission and return reference IDs.
Return JSON: {portal, action, status:"submitted"|"pending"|"approved"|"rejected",
reference_id, response, simulated:true}"""


@trace_node("portal_agent", "orchestration")
def portal_agent_node(state: OrchestrationState) -> OrchestrationState:
    state = _log(state, "portal_agent", "running", "Interacting with mock government portal")
    try:
        plan = state.get("plan", [])
        idx = state.get("current_task_index", 0)
        task = plan[idx] if idx < len(plan) else {}
        w = state.get("worker_data", {})
        task_type = task.get("task_type", "")
        ref_id = f"FWCMS-{datetime.now(timezone.utc).strftime('%Y%m%d')}-{uuid4().hex[:8].upper()}"

        prompt = (
            f"Portal task: {task_type}\n"
            f"Worker: {w.get('full_name')}, Passport: {w.get('passport_number')}\n"
            f"Reference: {ref_id}\n"
            "Simulate the portal interaction and return result JSON."
        )
        result = generate_text(prompt, _PORTAL_SYSTEM)
        portal_result = {"task_id": task.get("task_id"), "portal": "FWCMS", "action": task_type,
                         "status": "submitted", "reference_id": ref_id,
                         "response": "Submission accepted (simulated)", "simulated": True, "timestamp": _now()}

        if result.get("success"):
            parsed = _safe_json(result["text"])
            if isinstance(parsed, dict):
                portal_result.update({k: v for k, v in parsed.items() if k != "task_id"})

        # Write pending handoff to Firestore
        worker_id = state.get("worker_id", "")
        if worker_id:
            try:
                db.collection("pending_handoffs").add({
                    "worker_id": worker_id, "action_type": task_type,
                    "triggered_by": "orchestration_portal_agent",
                    "reference_id": ref_id, "payload": portal_result,
                    "status": "awaiting_confirmation", "simulated": True,
                    "created_at": _now(),
                })
                # Also check mock gov records
                db.collection("mock_gov_records").document(ref_id).set({
                    "worker_id": worker_id, "reference_id": ref_id,
                    "action": task_type, "status": portal_result.get("status"),
                    "created_at": _now(),
                })
            except Exception:
                pass

        existing = list(state.get("portal_results", []))
        existing.append(portal_result)
        specialist_result = {"type": "portal", "portal": "FWCMS", "reference_id": ref_id,
                             "status": portal_result.get("status")}
        state = {**state, "portal_results": existing, "specialist_result": specialist_result}
        return _log(state, "portal_agent", "done", f"Portal action '{task_type}' → {portal_result.get('status')}")
    except Exception as e:
        return _log({**state, "specialist_result": {"type": "portal", "error": str(e)}, "status": OrchestrationStatus.FAILED},
                    "portal_agent", "failed", str(e))


# ── Node 7: critic ─────────────────────────────────────────────────────────────

_CRITIC_SYSTEM = """You are a compliance output critic for Malaysian PLKS workflows.
Evaluate the specialist result for correctness, completeness, and regulatory compliance.
Return JSON: {verdict:"approved"|"rejected"|"needs_revision",
feedback:str, confidence:float, suggestions:[str]}"""


@trace_node("critic", "orchestration")
def critic_node(state: OrchestrationState) -> OrchestrationState:
    state = _log(state, "critic", "running", "Validating specialist output")
    try:
        specialist_result = state.get("specialist_result", {})
        plan = state.get("plan", [])
        idx = state.get("current_task_index", 0)
        task = plan[idx] if idx < len(plan) else {}
        w = state.get("worker_data", {})

        prompt = (
            f"Task: {task.get('description')}\n"
            f"Specialist result: {json.dumps(specialist_result)}\n"
            f"Worker gate: {w.get('current_gate')}\n"
            f"Retry count: {state.get('retry_count', 0)}\n"
            "Evaluate quality, flag issues, and determine if we can proceed."
        )
        result = generate_text(prompt, _CRITIC_SYSTEM)
        verdict = "approved"
        feedback = "Output validated successfully"
        confidence = 0.85
        suggestions = []

        if result.get("success"):
            parsed = _safe_json(result["text"])
            if isinstance(parsed, dict):
                verdict = parsed.get("verdict", "approved")
                feedback = parsed.get("feedback", feedback)
                confidence = float(parsed.get("confidence", 0.85))
                suggestions = parsed.get("suggestions", [])

        # Auto-approve after 2 retries to prevent infinite loops
        if state.get("retry_count", 0) >= 2:
            verdict = "approved"
            feedback = f"Auto-approved after max retries. Original feedback: {feedback}"
            confidence = max(confidence, 0.5)

        state = {**state, "critic_verdict": verdict, "critic_feedback": feedback,
                 "critic_confidence": confidence}
        return _log(state, "critic", "done", f"Verdict: {verdict} (confidence: {confidence:.2f})")
    except Exception as e:
        state = {**state, "critic_verdict": "approved", "critic_feedback": str(e), "critic_confidence": 0.5}
        return _log(state, "critic", "failed", str(e))


# ── Node 8: hitl_check ─────────────────────────────────────────────────────────

@trace_node("hitl_check", "orchestration")
def hitl_check_node(state: OrchestrationState) -> OrchestrationState:
    state = _log(state, "hitl_check", "running", "Checking if human review is required")
    confidence = state.get("critic_confidence", 1.0)
    verdict = state.get("critic_verdict", "approved")
    verification_results = state.get("verification_results", [])

    # Collect failure signals
    hard_failures = [
        c for r in verification_results for c in r.get("checks", [])
        if c.get("status") == "fail"
    ]
    hitl_required = False
    hitl_reason = None
    suggestions = []

    if confidence < 0.7:
        hitl_required = True
        hitl_reason = f"Low confidence ({confidence:.2f}) — human review recommended"
        suggestions.append({"type": "low_confidence", "message": hitl_reason,
                             "action": "Review and approve or override the AI decision"})

    if hard_failures:
        hitl_required = True
        for f in hard_failures[:3]:
            field = f.get("field", "unknown")
            detail = f.get("details", "")
            sugg = f.get("suggestion", f"Resolve {field} issue")
            hitl_reason = hitl_reason or f"Verification failures require resolution: {field}"
            suggestions.append({"type": "verification_failure", "field": field,
                                 "message": detail, "suggestion": sugg})

    if hitl_required:
        # Persist HITL interrupt to Firestore
        worker_id = state.get("worker_id", "")
        session_id = state.get("session_id", "")
        if worker_id:
            try:
                db.collection("orchestration_sessions").document(session_id).set(
                    {"hitl_required": True, "hitl_reason": hitl_reason,
                     "hitl_suggestions": suggestions, "updated_at": _now()}, merge=True
                )
            except Exception:
                pass
        state = {**state, "hitl_required": True, "hitl_reason": hitl_reason,
                 "hitl_suggestions": suggestions, "status": OrchestrationStatus.HITL_PAUSED}
        return _log(state, "hitl_check", "done", f"HITL required: {hitl_reason}")

    state = {**state, "hitl_required": False, "hitl_reason": None, "hitl_suggestions": []}
    return _log(state, "hitl_check", "done", "No HITL required — proceeding")


# ── Node 9: pipeline_sync ──────────────────────────────────────────────────────

@trace_node("pipeline_sync", "orchestration")
def pipeline_sync_node(state: OrchestrationState) -> OrchestrationState:
    state = _log(state, "pipeline_sync", "running", "Syncing pipeline state to Firestore")
    worker_id = state.get("worker_id", "")
    session_id = state.get("session_id", "")
    try:
        plan = state.get("plan", [])
        done = sum(1 for t in plan if t.get("status") == "done")
        total = len(plan)
        w = state.get("worker_data", {})
        current_gate = w.get("current_gate", "JTKSM")

        updates = {
            "orchestration_session_id": session_id,
            "orchestration_status": state.get("status"),
            "orchestration_progress": f"{done}/{total}",
            "updated_at": _now(),
        }

        # Update workers collection
        if worker_id:
            db.collection("workers").document(worker_id).set(updates, merge=True)

        # Update workflows collection trace
        wf_ref = db.collection("workflows").document(worker_id)
        wf_doc = wf_ref.get()
        if wf_doc.exists:
            wf_ref.update({"orchestration_session_id": session_id, "updated_at": _now()})

        # Persist full session
        db.collection("orchestration_sessions").document(session_id).set({
            "session_id": session_id, "worker_id": worker_id,
            "status": state.get("status"), "plan": plan,
            "pipeline_stage": current_gate, "tasks_done": done, "tasks_total": total,
            "updated_at": _now(),
        }, merge=True)

        pipeline_updates = {"worker_update": updates, "tasks_done": done, "tasks_total": total}
        state = {**state, "pipeline_stage": current_gate, "pipeline_updates": pipeline_updates}
        return _log(state, "pipeline_sync", "done", f"Synced — {done}/{total} tasks done, gate={current_gate}")
    except Exception as e:
        return _log({**state, "pipeline_updates": {"error": str(e)}}, "pipeline_sync", "failed", str(e))


# ── Node 10: advance ───────────────────────────────────────────────────────────

@trace_node("advance", "orchestration")
def advance_node(state: OrchestrationState) -> OrchestrationState:
    state = _log(state, "advance", "running", "Advancing task index")
    plan = list(state.get("plan", []))
    idx = state.get("current_task_index", 0)

    # Mark current task done
    if idx < len(plan):
        plan[idx] = {**plan[idx], "status": "done"}

    next_idx = idx + 1
    if next_idx >= len(plan):
        state = {**state, "plan": plan, "current_task_index": next_idx,
                 "status": OrchestrationStatus.COMPLETED, "retry_count": 0}
        return _log(state, "advance", "done", f"All {len(plan)} tasks complete")

    state = {**state, "plan": plan, "current_task_index": next_idx,
             "retry_count": 0, "specialist_result": {}}
    return _log(state, "advance", "done", f"Moved to task {next_idx + 1}/{len(plan)}")
