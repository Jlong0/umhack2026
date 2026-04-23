"""
Deterministic compliance calculation tools for Malaysian foreign worker regulations.
Based on 13MP (2026-2030) regulatory framework.
"""
from datetime import datetime, timedelta
from typing import Dict, List, Optional
from enum import Enum


class Sector(str, Enum):
    MANUFACTURING = "Manufacturing"
    CONSTRUCTION = "Construction"
    PLANTATION = "Plantation"
    AGRICULTURE = "Agriculture"
    SERVICES = "Services"


class PermitClass(str, Enum):
    PLKS = "PLKS"  # Temporary Employment Visit Pass
    EP_CAT_I = "EP_Category_I"
    EP_CAT_II = "EP_Category_II"
    EP_CAT_III = "EP_Category_III"


def calculate_mtlm_levy(
    sector: str,
    current_foreign_count: int,
    current_local_count: int,
    new_foreign_workers: int = 0
) -> Dict:
    """
    Calculate Multi-Tier Levy Mechanism (MTLM) based on foreign-to-local ratio.

    Returns:
        Dict with levy_per_worker, total_annual_levy, tier, and ratio
    """
    total_foreign = current_foreign_count + new_foreign_workers
    total_workers = total_foreign + current_local_count

    if total_workers == 0:
        ratio = 0
    else:
        ratio = total_foreign / total_workers

    # MTLM Tier Structure (2026)
    levy_rates = {
        Sector.MANUFACTURING: {
            "tier_1": 590,  # ratio <= 0.10
            "tier_2": 1180,  # 0.10 < ratio <= 0.15
            "tier_3": 1770,  # ratio > 0.15
        },
        Sector.CONSTRUCTION: {
            "tier_1": 640,
            "tier_2": 1280,
            "tier_3": 1920,
        },
        Sector.PLANTATION: {
            "tier_1": 590,
            "tier_2": 1180,
            "tier_3": 1770,
        },
        Sector.AGRICULTURE: {
            "tier_1": 590,
            "tier_2": 1180,
            "tier_3": 1770,
        },
        Sector.SERVICES: {
            "tier_1": 710,
            "tier_2": 1420,
            "tier_3": 2130,
        }
    }

    sector_rates = levy_rates.get(sector, levy_rates[Sector.MANUFACTURING])

    if ratio <= 0.10:
        tier = "tier_1"
    elif ratio <= 0.15:
        tier = "tier_2"
    else:
        tier = "tier_3"

    levy_per_worker = sector_rates[tier]
    total_annual_levy = levy_per_worker * total_foreign

    return {
        "levy_per_worker_rm": levy_per_worker,
        "total_annual_levy_rm": total_annual_levy,
        "tier": tier,
        "foreign_to_local_ratio": round(ratio, 4),
        "total_foreign_workers": total_foreign,
        "total_local_workers": current_local_count,
        "sector": sector
    }


def calculate_compounding_fines(
    overstay_days: int,
    worker_count: int = 1
) -> Dict:
    """
    Calculate administrative compounds for permit overstay.
    Based on Immigration Act 1959/63 Section 55B.

    Args:
        overstay_days: Number of days past permit expiry
        worker_count: Number of workers with overstay

    Returns:
        Dict with fine amount, escalation risk, and recommended action
    """
    if overstay_days <= 0:
        return {
            "fine_rm": 0,
            "escalation_risk": "none",
            "action": "No overstay detected"
        }

    if overstay_days <= 30:
        # First 30 days: RM 30/day administrative compound
        fine_per_worker = overstay_days * 30
        escalation = "low"
        action = "Pay administrative compound immediately"
    elif overstay_days <= 90:
        # 31-90 days: Tier 2 administrative compound
        fine_per_worker = 1000 + ((overstay_days - 30) * 30)
        escalation = "medium"
        action = "Self-disclosure to JTK recommended to avoid judicial escalation"
    else:
        # >90 days: Judicial escalation likely
        fine_per_worker = 10000  # Minimum judicial fine
        escalation = "critical"
        action = "Immediate legal consultation required - criminal liability risk"

    total_fine = fine_per_worker * worker_count

    return {
        "fine_per_worker_rm": fine_per_worker,
        "total_fine_rm": total_fine,
        "overstay_days": overstay_days,
        "worker_count": worker_count,
        "escalation_risk": escalation,
        "recommended_action": action,
        "judicial_risk": overstay_days > 90
    }


def check_ep_salary_compliance(
    category: str,
    current_salary_rm: float,
    renewal_date: datetime
) -> Dict:
    """
    Check Employment Pass salary compliance against June 2026 threshold changes.

    Args:
        category: EP_Category_I, EP_Category_II, or EP_Category_III
        current_salary_rm: Current monthly salary
        renewal_date: Planned renewal date

    Returns:
        Dict with compliance status and required salary adjustment
    """
    june_2026_cutoff = datetime(2026, 6, 1)

    # Pre-June 2026 thresholds
    old_thresholds = {
        "EP_Category_I": 10000,
        "EP_Category_II": 5000,
        "EP_Category_III": 3000
    }

    # Post-June 2026 thresholds
    new_thresholds = {
        "EP_Category_I": 20000,
        "EP_Category_II": 10000,
        "EP_Category_III": 5000
    }

    applicable_threshold = new_thresholds[category] if renewal_date >= june_2026_cutoff else old_thresholds[category]

    is_compliant = current_salary_rm >= applicable_threshold
    shortfall = max(0, applicable_threshold - current_salary_rm)

    return {
        "compliant": is_compliant,
        "current_salary_rm": current_salary_rm,
        "required_salary_rm": applicable_threshold,
        "shortfall_rm": shortfall,
        "renewal_date": renewal_date.isoformat(),
        "threshold_regime": "post_june_2026" if renewal_date >= june_2026_cutoff else "pre_june_2026",
        "category": category,
        "action": "Salary increase required before renewal" if not is_compliant else "Compliant"
    }


def calculate_fomema_requirements(
    permit_issue_date: datetime,
    last_fomema_date: Optional[datetime] = None,
    current_date: Optional[datetime] = None
) -> Dict:
    """
    Determine FOMEMA medical screening requirements based on employment duration.

    Args:
        permit_issue_date: Original permit issue date
        last_fomema_date: Date of last FOMEMA screening
        current_date: Current date (defaults to today)

    Returns:
        Dict with screening requirement and due date
    """
    if current_date is None:
        current_date = datetime.now()

    employment_years = (current_date - permit_issue_date).days / 365.25

    # FOMEMA required at years 1, 3, 5 (and every 2 years after)
    screening_years = [1, 3, 5, 7, 9, 11]

    next_screening_year = None
    for year in screening_years:
        if employment_years < year:
            next_screening_year = year
            break

    if next_screening_year is None:
        # Beyond year 11, screen every 2 years
        next_screening_year = int(employment_years) + (2 - int(employment_years) % 2)

    next_screening_date = permit_issue_date + timedelta(days=int(next_screening_year * 365.25))
    days_until_due = (next_screening_date - current_date).days

    # Trigger at T-90 days
    screening_required = days_until_due <= 90

    return {
        "screening_required": screening_required,
        "next_screening_date": next_screening_date.isoformat(),
        "days_until_due": days_until_due,
        "employment_years": round(employment_years, 2),
        "last_screening_date": last_fomema_date.isoformat() if last_fomema_date else None,
        "estimated_cost_rm": 190,
        "authority": "FOMEMA / KKM"
    }


def check_passport_validity(
    passport_expiry: datetime,
    permit_expiry: datetime,
    current_date: Optional[datetime] = None
) -> Dict:
    """
    Check passport validity requirements for permit renewal.
    Passport must have 12+ months validity for renewal approval.

    Args:
        passport_expiry: Passport expiration date
        permit_expiry: Work permit expiration date
        current_date: Current date (defaults to today)

    Returns:
        Dict with validity status and renewal requirement
    """
    if current_date is None:
        current_date = datetime.now()

    months_until_passport_expiry = (passport_expiry - current_date).days / 30.44
    months_until_permit_expiry = (permit_expiry - current_date).days / 30.44

    # Passport must have 12+ months validity at permit renewal
    passport_valid_for_renewal = months_until_passport_expiry >= 12

    renewal_blocked = not passport_valid_for_renewal and months_until_permit_expiry <= 4

    return {
        "passport_valid_for_renewal": passport_valid_for_renewal,
        "months_until_passport_expiry": round(months_until_passport_expiry, 1),
        "months_until_permit_expiry": round(months_until_permit_expiry, 1),
        "renewal_blocked": renewal_blocked,
        "passport_expiry_date": passport_expiry.isoformat(),
        "permit_expiry_date": permit_expiry.isoformat(),
        "action": "Initiate passport renewal immediately" if renewal_blocked else "Monitor passport validity"
    }


def calculate_compliance_deadlock_risk(
    permit_expiry: datetime,
    fomema_status: str,
    passport_months_remaining: float,
    current_date: Optional[datetime] = None
) -> Dict:
    """
    Detect potential compliance deadlocks where multiple dependencies create impossible timelines.

    Args:
        permit_expiry: Work permit expiration date
        fomema_status: Current FOMEMA status (pending, unsuitable, suitable, appeal_pending)
        passport_months_remaining: Months until passport expiry
        current_date: Current date (defaults to today)

    Returns:
        Dict with deadlock detection and recommended mitigation
    """
    if current_date is None:
        current_date = datetime.now()

    days_to_permit_expiry = (permit_expiry - current_date).days

    deadlock_detected = False
    deadlock_type = None
    mitigation = None

    # Deadlock Type 1: FOMEMA appeal pending with permit expiring soon
    if fomema_status == "appeal_pending" and days_to_permit_expiry <= 30:
        deadlock_detected = True
        deadlock_type = "fomema_appeal_permit_expiry"
        mitigation = "Apply for Special Pass to bridge gap during FOMEMA appeal"

    # Deadlock Type 2: Passport renewal needed but permit expires before renewal possible
    elif passport_months_remaining < 12 and days_to_permit_expiry <= 60:
        deadlock_detected = True
        deadlock_type = "passport_renewal_timeline"
        mitigation = "Expedite passport renewal via embassy or consider short-term Special Pass"

    # Deadlock Type 3: FOMEMA unsuitable with no appeal window
    elif fomema_status == "unsuitable" and days_to_permit_expiry <= 14:
        deadlock_detected = True
        deadlock_type = "fomema_unsuitable_no_time"
        mitigation = "Immediate repatriation protocol - no renewal possible"

    return {
        "deadlock_detected": deadlock_detected,
        "deadlock_type": deadlock_type,
        "days_to_permit_expiry": days_to_permit_expiry,
        "fomema_status": fomema_status,
        "passport_months_remaining": passport_months_remaining,
        "mitigation_action": mitigation,
        "urgency": "critical" if deadlock_detected else "normal"
    }
