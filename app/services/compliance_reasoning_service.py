from __future__ import annotations

from datetime import datetime
from typing import Any


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
        "created_at": datetime.now().isoformat(),
    }


def generate_compliance_obligations(worker_data: dict):
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
