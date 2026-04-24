from __future__ import annotations

import asyncio
import base64
from datetime import datetime, timezone
from typing import Any

from app.firebase_config import db
from app.services.vdr_service import vdr_service
from app.tools.compliance_tools import check_ep_salary_compliance
from app.workers.celery_app import celery


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


@celery.task
def check_biomedical_status(vdr_id: str, passport_no: str, biomedical_ref: str):
    """
    Poll placeholder biomedical source and update vdr_applications status.
    """
    verification = asyncio.run(
        vdr_service.ping_biomedical_database(
            ref_no=biomedical_ref,
            passport_no=passport_no,
        )
    )

    status = verification.get("status", "pending")
    vdr_ref = db.collection("vdr_applications").document(vdr_id)
    vdr_doc = vdr_ref.get()
    if not vdr_doc.exists:
        return {"success": False, "error": "VDR application not found", "vdr_id": vdr_id}

    vdr_ref.update(
        {
            "biomedical_ref_number": biomedical_ref,
            "biomedical_status": status,
            "updated_at": _now_iso(),
        }
    )

    if status == "unfit":
        worker_id = vdr_doc.to_dict().get("worker_id")
        if worker_id:
            db.collection("workflows").document(worker_id).set(
                {
                    "current_state": {
                        "hitl_required": True,
                        "hitl_reason": "biomedical_unfit_requires_review",
                        "hitl_data": verification,
                    },
                    "last_updated": _now_iso(),
                },
                merge=True,
            )

    return {"success": True, "vdr_id": vdr_id, "biomedical_status": status}


@celery.task
def monitor_fomema_deadline(worker_id: str):
    """
    Monitor one worker for Day 7 / Day 25 / Day 31 FOMEMA milestones.
    """
    worker_ref = db.collection("workers").document(worker_id)
    worker_doc = worker_ref.get()
    if not worker_doc.exists:
        return {"success": False, "error": "worker_not_found", "worker_id": worker_id}

    worker = worker_doc.to_dict()
    deadline_raw = worker.get("fomema_deadline")
    arrival_raw = worker.get("arrival_date")

    if not deadline_raw or not arrival_raw:
        return {"success": True, "worker_id": worker_id, "skipped": "missing_arrival_or_deadline"}

    now = datetime.now()
    deadline = datetime.fromisoformat(deadline_raw)
    arrival = datetime.fromisoformat(arrival_raw)
    days_since_arrival = (now - arrival).days

    plks_docs = db.collection("plks_applications").where("worker_id", "==", worker_id).stream()
    plks_doc = next(plks_docs, None)
    plks = plks_doc.to_dict() if plks_doc else {}

    alerts = []

    if days_since_arrival >= 7 and not plks.get("fomema_registration_date"):
        alerts.append("fomema_registration_overdue")

    if days_since_arrival >= 25 and not plks.get("fomema_attended_date"):
        alerts.append("fomema_attendance_critical")

    if now > deadline and plks.get("fomema_result", "pending") == "pending":
        alerts.append("fomema_result_overdue_trigger_com")

    for alert_type in alerts:
        db.collection("workers").document(worker_id).collection("tasks").add(
            {
                "type": "alert",
                "task_type": alert_type.upper(),
                "task_name": alert_type,
                "status": "pending",
                "priority": "critical",
                "created_at": _now_iso(),
            }
        )

    return {
        "success": True,
        "worker_id": worker_id,
        "days_since_arrival": days_since_arrival,
        "alerts": alerts,
    }


@celery.task
def monitor_fomema_deadline_all():
    """Daily sweep across all workers with arrival dates."""
    workers = db.collection("workers").stream()
    results = []

    for worker in workers:
        worker_data = worker.to_dict()
        if worker_data.get("arrival_date"):
            results.append(monitor_fomema_deadline(worker.id))

    return {
        "success": True,
        "processed": len(results),
        "results": results,
    }


@celery.task
def validate_photo_biometrics(vdr_id: str, photo_b64: str):
    """
    Validate VDR photo biometrics using current service checks.
    """
    photo_bytes = base64.b64decode(photo_b64)
    validation = asyncio.run(vdr_service.validate_passport_photo(photo_bytes))

    vdr_ref = db.collection("vdr_applications").document(vdr_id)
    vdr_doc = vdr_ref.get()
    if not vdr_doc.exists:
        return {"success": False, "error": "vdr_not_found", "vdr_id": vdr_id}

    vdr_ref.update(
        {
            "photo_biometric_compliant": validation.get("compliant", False),
            "photo_validation_issues": validation.get("issues", []),
            "updated_at": _now_iso(),
        }
    )

    return {
        "success": True,
        "vdr_id": vdr_id,
        "validation": validation,
    }


@celery.task
def sweep_june_deadline_risk():
    """
    Monthly sweep for EP salary threshold risks after June 1, 2026.
    """
    workers = db.collection("workers").stream()
    created = 0

    for worker_doc in workers:
        worker_id = worker_doc.id
        worker = worker_doc.to_dict()

        permit_class = (worker.get("permit_class") or "").upper()
        salary = worker.get("salary") or worker.get("current_salary_rm")
        renewal_date_raw = worker.get("permit_expiry_date")

        if not permit_class.startswith("EP") or not salary or not renewal_date_raw:
            continue

        renewal_date = datetime.fromisoformat(renewal_date_raw)
        if renewal_date <= datetime(2026, 6, 1):
            continue

        result = check_ep_salary_compliance(
            category=permit_class,
            current_salary_rm=float(salary),
            renewal_date=renewal_date,
        )

        if result.get("compliant"):
            continue

        db.collection("workers").document(worker_id).collection("tasks").add(
            {
                "type": "renewal",
                "task_type": "SALARY_ADJUSTMENT_TASK",
                "task_name": f"Increase salary by RM {result.get('shortfall_rm', 0)} before renewal",
                "status": "pending",
                "priority": "critical",
                "payload": result,
                "created_at": _now_iso(),
            }
        )
        created += 1

    return {
        "success": True,
        "tasks_created": created,
    }
