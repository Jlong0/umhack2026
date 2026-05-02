"""
Deadline detection and alert system for compliance monitoring.
Continuously monitors worker states for expiry risks and deadlocks.
"""
from fastapi import APIRouter, HTTPException
from typing import List, Dict
from datetime import datetime, timedelta
from app.firebase_config import db
from app.tools.compliance_tools import (
    calculate_compounding_fines,
    calculate_fomema_requirements,
    check_passport_validity,
    calculate_compliance_deadlock_risk
)

router = APIRouter(prefix="/alerts", tags=["alerts"])


def scan_worker_for_alerts(worker_data: Dict) -> List[Dict]:
    """
    Scan a single worker for compliance alerts.
    """
    alerts = []
    current_date = datetime.now()

    # Check permit expiry
    if worker_data.get("permit_expiry_date"):
        permit_expiry = datetime.fromisoformat(worker_data["permit_expiry_date"])
        days_to_expiry = (permit_expiry - current_date).days

        if days_to_expiry < 0:
            # Expired
            overstay_days = abs(days_to_expiry)
            fine_calc = calculate_compounding_fines(overstay_days)
            alerts.append({
                "type": "permit_expired",
                "severity": "critical",
                "worker_id": worker_data.get("worker_id"),
                "message": f"Permit expired {overstay_days} days ago",
                "days_overdue": overstay_days,
                "fine_rm": fine_calc["total_fine_rm"],
                "action": fine_calc["recommended_action"]
            })
        elif days_to_expiry <= 30:
            alerts.append({
                "type": "permit_expiring_soon",
                "severity": "high",
                "worker_id": worker_data.get("worker_id"),
                "message": f"Permit expires in {days_to_expiry} days",
                "days_remaining": days_to_expiry,
                "action": "Initiate renewal process immediately"
            })
        elif days_to_expiry <= 90:
            alerts.append({
                "type": "permit_expiring_90_days",
                "severity": "medium",
                "worker_id": worker_data.get("worker_id"),
                "message": f"Permit expires in {days_to_expiry} days",
                "days_remaining": days_to_expiry,
                "action": "Begin renewal preparation"
            })

    # Check passport validity
    if worker_data.get("passport_expiry_date") and worker_data.get("permit_expiry_date"):
        passport_check = check_passport_validity(
            passport_expiry=datetime.fromisoformat(worker_data["passport_expiry_date"]),
            permit_expiry=datetime.fromisoformat(worker_data["permit_expiry_date"])
        )

        if passport_check["renewal_blocked"]:
            alerts.append({
                "type": "passport_renewal_required",
                "severity": "critical",
                "worker_id": worker_data.get("worker_id"),
                "message": "Passport validity insufficient for permit renewal",
                "months_remaining": passport_check["months_until_passport_expiry"],
                "action": passport_check["action"]
            })

    # Check FOMEMA requirements
    if worker_data.get("permit_issue_date"):
        fomema_check = calculate_fomema_requirements(
            permit_issue_date=datetime.fromisoformat(worker_data["permit_issue_date"]),
            last_fomema_date=datetime.fromisoformat(worker_data["last_fomema_date"]) if worker_data.get("last_fomema_date") else None
        )

        if fomema_check["screening_required"] and fomema_check["days_until_due"] <= 30:
            alerts.append({
                "type": "fomema_screening_due",
                "severity": "high" if fomema_check["days_until_due"] <= 14 else "medium",
                "worker_id": worker_data.get("worker_id"),
                "message": f"FOMEMA screening due in {fomema_check['days_until_due']} days",
                "days_until_due": fomema_check["days_until_due"],
                "estimated_cost_rm": fomema_check["estimated_cost_rm"],
                "action": "Schedule FOMEMA appointment"
            })

    # Check for deadlocks
    if worker_data.get("permit_expiry_date") and worker_data.get("passport_expiry_date"):
        passport_months = (datetime.fromisoformat(worker_data["passport_expiry_date"]) - current_date).days / 30.44

        deadlock_check = calculate_compliance_deadlock_risk(
            permit_expiry=datetime.fromisoformat(worker_data["permit_expiry_date"]),
            fomema_status=worker_data.get("fomema_status", "pending"),
            passport_months_remaining=passport_months
        )

        if deadlock_check["deadlock_detected"]:
            alerts.append({
                "type": "compliance_deadlock",
                "severity": "critical",
                "worker_id": worker_data.get("worker_id"),
                "message": f"Deadlock detected: {deadlock_check['deadlock_type']}",
                "deadlock_type": deadlock_check["deadlock_type"],
                "mitigation": deadlock_check["mitigation_action"],
                "action": deadlock_check["mitigation_action"]
            })

    return alerts


@router.get("/scan")
async def scan_all_workers(company_id: str | None = None):
    """
    Scan all workers for compliance alerts and deadlines.
    """
    try:
        workers_ref = db.collection("workers")
        if company_id:
            workers_ref = workers_ref.where("company_id", "==", company_id)
        workers = workers_ref.stream()

        all_alerts = []
        workers_scanned = 0
        critical_count = 0
        high_count = 0

        for worker in workers:
            workers_scanned += 1
            worker_data = worker.to_dict()
            worker_data["worker_id"] = worker.id

            alerts = scan_worker_for_alerts(worker_data)

            for alert in alerts:
                all_alerts.append(alert)
                if alert["severity"] == "critical":
                    critical_count += 1
                elif alert["severity"] == "high":
                    high_count += 1

        return {
            "scan_timestamp": datetime.now().isoformat(),
            "workers_scanned": workers_scanned,
            "total_alerts": len(all_alerts),
            "critical_alerts": critical_count,
            "high_alerts": high_count,
            "alerts": all_alerts
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Scan failed: {str(e)}")


@router.get("/worker/{worker_id}")
async def get_worker_alerts(worker_id: str):
    """
    Get all alerts for a specific worker.
    """
    try:
        worker_ref = db.collection("workers").document(worker_id)
        worker_doc = worker_ref.get()

        if not worker_doc.exists:
            raise HTTPException(status_code=404, detail="Worker not found")

        worker_data = worker_doc.to_dict()
        worker_data["worker_id"] = worker_id

        alerts = scan_worker_for_alerts(worker_data)

        return {
            "worker_id": worker_id,
            "full_name": worker_data.get("full_name"),
            "passport_number": worker_data.get("passport_number"),
            "total_alerts": len(alerts),
            "alerts": alerts
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get alerts: {str(e)}")


@router.get("/critical")
async def get_critical_alerts(company_id: str | None = None):
    """
    Get only critical alerts requiring immediate action.
    """
    try:
        workers_ref = db.collection("workers")
        if company_id:
            workers_ref = workers_ref.where("company_id", "==", company_id)
        workers = workers_ref.stream()

        critical_alerts = []

        for worker in workers:
            worker_data = worker.to_dict()
            worker_data["worker_id"] = worker.id

            alerts = scan_worker_for_alerts(worker_data)

            for alert in alerts:
                if alert["severity"] == "critical":
                    critical_alerts.append(alert)

        return {
            "total_critical": len(critical_alerts),
            "alerts": critical_alerts
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get critical alerts: {str(e)}")


@router.get("/expiring")
async def get_expiring_permits(days: int = 30, company_id: str | None = None):
    """
    Get workers with permits expiring within specified days.
    """
    try:
        workers_ref = db.collection("workers")
        if company_id:
            workers_ref = workers_ref.where("company_id", "==", company_id)
        workers = workers_ref.stream()

        expiring_workers = []
        current_date = datetime.now()
        cutoff_date = current_date + timedelta(days=days)

        for worker in workers:
            worker_data = worker.to_dict()

            if worker_data.get("permit_expiry_date"):
                permit_expiry = datetime.fromisoformat(worker_data["permit_expiry_date"])

                if current_date <= permit_expiry <= cutoff_date:
                    days_remaining = (permit_expiry - current_date).days

                    expiring_workers.append({
                        "worker_id": worker.id,
                        "full_name": worker_data.get("full_name"),
                        "passport_number": worker_data.get("passport_number"),
                        "permit_expiry_date": worker_data["permit_expiry_date"],
                        "days_remaining": days_remaining,
                        "sector": worker_data.get("sector"),
                        "permit_class": worker_data.get("permit_class")
                    })

        # Sort by days remaining
        expiring_workers.sort(key=lambda x: x["days_remaining"])

        return {
            "cutoff_days": days,
            "total_expiring": len(expiring_workers),
            "workers": expiring_workers
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get expiring permits: {str(e)}")


@router.get("/dashboard")
async def get_alert_dashboard(company_id: str | None = None):
    """
    Get comprehensive alert dashboard data.
    """
    try:
        workers_ref = db.collection("workers")
        if company_id:
            workers_ref = workers_ref.where("company_id", "==", company_id)
        workers = workers_ref.stream()

        total_workers = 0
        expiring_30_days = 0
        expiring_90_days = 0
        expired = 0
        deadlocks = 0
        fomema_due = 0
        passport_issues = 0

        current_date = datetime.now()

        for worker in workers:
            total_workers += 1
            worker_data = worker.to_dict()
            worker_data["worker_id"] = worker.id

            alerts = scan_worker_for_alerts(worker_data)

            for alert in alerts:
                if alert["type"] == "permit_expired":
                    expired += 1
                elif alert["type"] == "permit_expiring_soon":
                    expiring_30_days += 1
                elif alert["type"] == "permit_expiring_90_days":
                    expiring_90_days += 1
                elif alert["type"] == "compliance_deadlock":
                    deadlocks += 1
                elif alert["type"] == "fomema_screening_due":
                    fomema_due += 1
                elif alert["type"] == "passport_renewal_required":
                    passport_issues += 1

        return {
            "timestamp": current_date.isoformat(),
            "summary": {
                "total_workers": total_workers,
                "expired_permits": expired,
                "expiring_30_days": expiring_30_days,
                "expiring_90_days": expiring_90_days,
                "compliance_deadlocks": deadlocks,
                "fomema_screenings_due": fomema_due,
                "passport_issues": passport_issues
            },
            "health_score": max(0, 100 - (expired * 20) - (deadlocks * 15) - (expiring_30_days * 5))
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get dashboard: {str(e)}")
