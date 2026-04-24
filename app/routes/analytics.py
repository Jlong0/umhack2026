from __future__ import annotations

from collections import Counter, defaultdict
from datetime import datetime
from fastapi import APIRouter

from app.firebase_config import db
from app.tools.compliance_tools import calculate_mtlm_levy


router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.get("/levy-forecast")
async def levy_forecast():
    workers = list(db.collection("workers").stream())

    grouped = defaultdict(lambda: {"foreign": 0, "local": 10})
    for doc in workers:
        worker = doc.to_dict()
        sector = worker.get("sector", "Manufacturing")
        grouped[sector]["foreign"] += 1

    forecast = []
    total = 0
    for sector, counts in grouped.items():
        calc = calculate_mtlm_levy(
            sector=sector,
            current_foreign_count=counts["foreign"],
            current_local_count=counts["local"],
            new_foreign_workers=0,
        )
        total += calc["total_annual_levy_rm"]
        forecast.append(calc)

    return {
        "generated_at": datetime.now().isoformat(),
        "annual_total_levy_rm": total,
        "by_sector": forecast,
    }


@router.get("/gate-bottlenecks")
async def gate_bottlenecks():
    workers = list(db.collection("workers").stream())
    gate_counts = Counter()
    status_counts = Counter()

    for doc in workers:
        worker = doc.to_dict()
        gate_counts[worker.get("gate_stage", "unknown")] += 1
        status_counts[worker.get("status", "unknown")] += 1

    return {
        "generated_at": datetime.now().isoformat(),
        "gate_stage_counts": dict(gate_counts),
        "status_counts": dict(status_counts),
    }


@router.get("/repatriation-risk")
async def repatriation_risk():
    workers = list(db.collection("workers").stream())
    at_risk = []

    for doc in workers:
        worker = doc.to_dict()
        risk_reasons = []

        if worker.get("status") == "repatriation":
            risk_reasons.append("already_marked_repatriation")

        if worker.get("fomema_result") == "unfit":
            risk_reasons.append("fomema_unfit")

        if worker.get("overstay_days", 0) > 30:
            risk_reasons.append("overstay_gt_30_days")

        if risk_reasons:
            at_risk.append(
                {
                    "worker_id": doc.id,
                    "full_name": worker.get("full_name"),
                    "passport_number": worker.get("passport_number"),
                    "risk_reasons": risk_reasons,
                }
            )

    return {
        "generated_at": datetime.now().isoformat(),
        "total_at_risk": len(at_risk),
        "workers": at_risk,
    }
