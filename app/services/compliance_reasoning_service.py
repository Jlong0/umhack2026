"""
Compliance reasoning service — unwired from mock.

Provides real gate-readiness evaluation, June 2026 EP salary risk
detection, and a write-back helper that persists agent findings into
Firestore worker task subcollections and compliance_state aggregates.
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Optional

from app.firebase_config import db
from app.tools.compliance_tools import check_ep_salary_compliance


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _task(
    task_type: str,
    task_name: str,
    priority: str = "mandatory",
    status: str = "pending",
    depends_on: list[str] | None = None,
    payload: dict[str, Any] | None = None,
) -> dict[str, Any]:
    return {
        "task_type": task_type,
        "task_name": task_name,
        "type": task_type.lower(),
        "status": status,
        "priority": priority,
        "depends_on": depends_on or [],
        "payload": payload or {},
        "created_at": _now_iso(),
    }


# ── legacy helper kept for backward-compatibility ──────────────────────

def generate_compliance_obligations(worker_data: dict, use_agent: bool = False) -> dict[str, Any]:
    """Generate compliance obligations. Set use_agent=True to route through compliance_reasoner_node."""
    if use_agent:
        from app.agents.state import VDRState
        from app.agents.nodes import compliance_reasoner_node
        state: VDRState = {
            "master_name": worker_data.get("full_name"),
            "passport_number": worker_data.get("passport_number"),
            "nature_of_business": worker_data.get("sector"),
            "fomema_status": worker_data.get("fomema_status", "Pending"),
            "pipeline_status": "running",
            "company_name": None, "roc_number": None, "act446_cert_number": None,
            "act446_max_capacity": None, "local_employee_count": None,
            "foreign_employee_count": None, "quota_requested": None,
            "passport_expiry": None, "worker_dob": None, "biomedical_ref": None,
            "borang100_home_address": None, "borang100_parents_names": None,
            "employer_eligible": True, "housing_compliant": True, "worker_eligible": True,
            "quota_flags": [], "validation_errors": [], "signatures_required": [],
            "signatures_completed": [], "obligations": [], "vdr_form_data": {}, "halt_reason": None,
        }
        result = compliance_reasoner_node(state)
        obligations = result.get("obligations", [])
        return {"obligations": obligations, "status": "generated", "obligation_count": len(obligations)}

    # fall through to legacy path
    obligations: list[dict[str, Any]] = []
    obligations: list[dict[str, Any]] = []

    obligations.append(
        _task(
            "PASSPORT_VALIDATION",
            "Validate passport validity and renewal window",
            priority="high",
        )
    )

    obligations.append(
        _task(
            "FOMEMA_CLEARANCE",
            "Complete or verify FOMEMA medical clearance",
            priority="mandatory",
            depends_on=["PASSPORT_VALIDATION"],
        )
    )

    permit_class = (worker_data.get("permit_class") or "PLKS").upper()
    sector = worker_data.get("sector")

    if permit_class.startswith("EP"):
        obligations.append(
            _task(
                "EP_SALARY_COMPLIANCE",
                "Check EP salary threshold compliance",
                priority="high",
                depends_on=["PASSPORT_VALIDATION"],
                payload={"permit_class": permit_class},
            )
        )

    obligations.append(
        _task(
            "PERMIT_RENEWAL_OR_ISSUANCE",
            "Prepare permit filing package",
            priority="mandatory",
            depends_on=["FOMEMA_CLEARANCE"],
            payload={"permit_class": permit_class, "sector": sector},
        )
    )

    company_id = worker_data.get("company_id")
    if company_id:
        obligations.append(
            _task(
                "ACT_446_HOUSING_COMPLIANCE",
                "Verify Act 446 housing compliance",
                priority="high",
                depends_on=[],
                payload={"company_id": company_id},
            )
        )

    return {
        "obligations": obligations,
        "status": "generated",
        "obligation_count": len(obligations),
    }


# ── NEW: gate-readiness evaluation ────────────────────────────────────

def evaluate_gate_readiness(
    gate_name: str,
    worker_id: str,
) -> dict[str, Any]:
    """
    Check whether *worker_id* is ready to pass through *gate_name*.
    Returns ``{ready: bool, blockers: [str], gate_name, worker_id}``.
    """
    normalized = (gate_name or "").strip().lower()
    blockers: list[str] = []

    worker_doc = db.collection("workers").document(worker_id).get()
    if not worker_doc.exists:
        return {
            "ready": False,
            "blockers": ["worker_not_found"],
            "gate_name": normalized,
            "worker_id": worker_id,
        }

    worker = worker_doc.to_dict()

    # ── JTKSM gate ────────────────────────────────────────────────
    if normalized == "jtksm":
        company_id = worker.get("company_id")
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

                expiry_raw = company.get("act_446_expiry_date")
                if not expiry_raw:
                    blockers.append("act_446_cert_missing")
                else:
                    try:
                        expiry = datetime.fromisoformat(expiry_raw)
                        if expiry < datetime.now():
                            blockers.append("act_446_cert_expired")
                    except (ValueError, TypeError):
                        blockers.append("act_446_cert_invalid_date")

                quota = company.get("quota_balance", {})
                sector = worker.get("sector", "MFG")
                if isinstance(quota, dict) and quota.get(sector, 0) <= 0:
                    blockers.append(f"quota_exhausted_{sector}")

    # ── VDR gate ──────────────────────────────────────────────────
    elif normalized == "vdr":
        vdr_docs = db.collection("vdr_applications").where("worker_id", "==", worker_id).stream()
        vdr_doc = next(vdr_docs, None)
        if not vdr_doc:
            blockers.append("vdr_application_missing")
        else:
            vdr = vdr_doc.to_dict()
            if not vdr.get("passport_scan_url"):
                blockers.append("passport_scan_missing")
            if not vdr.get("passport_photo_url"):
                blockers.append("passport_photo_missing")
            if not vdr.get("photo_biometric_compliant"):
                blockers.append("photo_biometric_non_compliant")
            if vdr.get("biomedical_status") != "fit":
                blockers.append("biomedical_not_fit")
            if not vdr.get("signed_contract_url"):
                blockers.append("signed_contract_missing")

            # EP succession plan requirement
            permit_class = (worker.get("permit_class") or "").upper()
            if permit_class in {"EP_II", "EP_III", "EP_CATEGORY_II", "EP_CATEGORY_III"}:
                if not vdr.get("succession_plan_url"):
                    blockers.append("succession_plan_missing")

    # ── FOMEMA gate ───────────────────────────────────────────────
    elif normalized == "fomema":
        plks_docs = db.collection("plks_applications").where("worker_id", "==", worker_id).stream()
        plks_doc = next(plks_docs, None)
        if not plks_doc:
            blockers.append("plks_application_missing")
        else:
            plks = plks_doc.to_dict()
            if not plks.get("mdac_verified"):
                blockers.append("mdac_not_verified")
            if not plks.get("fomema_registration_date"):
                blockers.append("fomema_not_registered")
            result = plks.get("fomema_result", "pending")
            if result == "unfit":
                blockers.append("fomema_unfit")
            elif result != "fit":
                blockers.append("fomema_result_pending")

    # ── PLKS gate ─────────────────────────────────────────────────
    elif normalized == "plks":
        plks_docs = db.collection("plks_applications").where("worker_id", "==", worker_id).stream()
        plks_doc = next(plks_docs, None)
        if not plks_doc:
            blockers.append("plks_application_missing")
        else:
            plks = plks_doc.to_dict()
            if plks.get("fomema_result") != "fit":
                blockers.append("fomema_not_fit")
            if not plks.get("biometric_date"):
                blockers.append("biometric_not_done")
            if not plks.get("sev_stamp_verified"):
                blockers.append("sev_stamp_not_verified")

    else:
        blockers.append(f"unknown_gate_{normalized}")

    return {
        "ready": len(blockers) == 0,
        "blockers": blockers,
        "gate_name": normalized,
        "worker_id": worker_id,
        "checked_at": _now_iso(),
    }


# ── NEW: June 2026 EP salary risk detection ──────────────────────────

def detect_june_deadline_risk(worker_id: str) -> dict[str, Any]:
    """
    Check whether a worker's EP salary will fail the post-June-2026
    threshold at renewal time.
    """
    worker_doc = db.collection("workers").document(worker_id).get()
    if not worker_doc.exists:
        return {"at_risk": False, "worker_id": worker_id, "reason": "worker_not_found"}

    worker = worker_doc.to_dict()
    permit_class = (worker.get("permit_class") or "").upper()
    if not permit_class.startswith("EP"):
        return {"at_risk": False, "worker_id": worker_id, "reason": "not_ep_worker"}

    salary = worker.get("current_salary_rm") or worker.get("salary")
    renewal_date_raw = worker.get("permit_expiry_date")

    if not salary or not renewal_date_raw:
        return {"at_risk": False, "worker_id": worker_id, "reason": "missing_salary_or_renewal_date"}

    try:
        renewal_date = datetime.fromisoformat(renewal_date_raw)
    except (ValueError, TypeError):
        return {"at_risk": False, "worker_id": worker_id, "reason": "invalid_renewal_date"}

    if renewal_date <= datetime(2026, 6, 1):
        return {"at_risk": False, "worker_id": worker_id, "reason": "renews_before_june_cutoff"}

    result = check_ep_salary_compliance(
        category=permit_class,
        current_salary_rm=float(salary),
        renewal_date=renewal_date,
    )

    return {
        "at_risk": not result.get("compliant", True),
        "worker_id": worker_id,
        "salary_gap": result.get("shortfall_rm", 0),
        "required_salary": result.get("required_salary_rm"),
        "current_salary": float(salary),
        "permit_class": permit_class,
        "renewal_date": renewal_date_raw,
        "compliance_detail": result,
    }


# ── NEW: write-back helper ────────────────────────────────────────────

def write_agent_findings(
    worker_id: str,
    findings: dict[str, Any],
) -> None:
    """
    Persist agent findings into Firestore.

    *findings* may contain:
      - ``alerts``: list of ``{type, severity, message, ...}``
      - ``health_score``: int 0–100
      - ``compliance_status``: str
      - ``levy_tier``: str
      - ``flags``: list of strings
    """
    if not worker_id:
        return

    now = _now_iso()

    # ── Write alert tasks ─────────────────────────────────────────
    alerts = findings.get("alerts") or []
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

    # ── Upsert compliance_state aggregate ─────────────────────────
    flags = findings.get("flags") or [a.get("type") for a in alerts if a.get("type")]
    health_score = findings.get("health_score")
    if health_score is None:
        health_score = max(0, 100 - 10 * len(alerts))

    compliance_update: dict[str, Any] = {
        "worker_id": worker_id,
        "flags": flags,
        "health_score": health_score,
        "updated_at": now,
        "last_swept_at": now,
    }

    if findings.get("compliance_status"):
        compliance_update["compliance_status"] = findings["compliance_status"]
    if findings.get("levy_tier"):
        compliance_update["levy_tier"] = findings["levy_tier"]

    db.collection("compliance_state").document(worker_id).set(
        compliance_update,
        merge=True,
    )
