"""
API routes for levy and salary simulation (What-If scenarios).
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from app.tools.compliance_tools import (
    calculate_mtlm_levy,
    check_ep_salary_compliance
)

router = APIRouter(prefix="/simulator", tags=["simulator"])


class MTLMSimulationRequest(BaseModel):
    sector: str
    current_foreign_count: int
    current_local_count: int
    new_foreign_workers: int = 0


class SalarySimulationRequest(BaseModel):
    category: str  # EP_Category_I, EP_Category_II, EP_Category_III
    current_salary_rm: float
    renewal_date: str  # ISO format


@router.post("/mtlm-levy")
async def simulate_mtlm_levy(request: MTLMSimulationRequest):
    """
    Simulate Multi-Tier Levy Mechanism (MTLM) impact.
    Calculate levy costs for different hiring scenarios.
    """
    try:
        # Calculate current state
        current_levy = calculate_mtlm_levy(
            sector=request.sector,
            current_foreign_count=request.current_foreign_count,
            current_local_count=request.current_local_count,
            new_foreign_workers=0
        )

        # Calculate with new workers
        new_levy = calculate_mtlm_levy(
            sector=request.sector,
            current_foreign_count=request.current_foreign_count,
            current_local_count=request.current_local_count,
            new_foreign_workers=request.new_foreign_workers
        )

        # Calculate impact
        levy_increase = new_levy["total_annual_levy_rm"] - current_levy["total_annual_levy_rm"]
        tier_change = current_levy["tier"] != new_levy["tier"]

        return {
            "current_state": current_levy,
            "projected_state": new_levy,
            "impact": {
                "levy_increase_rm": levy_increase,
                "tier_change": tier_change,
                "new_tier": new_levy["tier"] if tier_change else None,
                "recommendation": "Consider automation investment" if tier_change else "Within current tier"
            }
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Simulation failed: {str(e)}")


@router.post("/ep-salary")
async def simulate_ep_salary_compliance(request: SalarySimulationRequest):
    """
    Simulate Employment Pass salary compliance for June 2026 threshold changes.
    """
    try:
        renewal_date = datetime.fromisoformat(request.renewal_date)

        compliance_check = check_ep_salary_compliance(
            category=request.category,
            current_salary_rm=request.current_salary_rm,
            renewal_date=renewal_date
        )

        # Calculate monthly and annual impact
        monthly_increase = compliance_check["shortfall_rm"]
        annual_increase = monthly_increase * 12

        return {
            "compliance_check": compliance_check,
            "financial_impact": {
                "monthly_increase_rm": monthly_increase,
                "annual_increase_rm": annual_increase,
                "compliant": compliance_check["compliant"]
            },
            "recommendation": compliance_check["action"]
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Simulation failed: {str(e)}")


@router.get("/mtlm-tiers")
async def get_mtlm_tier_structure():
    """
    Get the complete MTLM tier structure for all sectors.
    """
    return {
        "effective_date": "2026-01-01",
        "tiers": {
            "Manufacturing": {
                "tier_1": {"ratio": "≤ 10%", "levy_rm": 590},
                "tier_2": {"ratio": "10-15%", "levy_rm": 1180},
                "tier_3": {"ratio": "> 15%", "levy_rm": 1770}
            },
            "Construction": {
                "tier_1": {"ratio": "≤ 10%", "levy_rm": 640},
                "tier_2": {"ratio": "10-15%", "levy_rm": 1280},
                "tier_3": {"ratio": "> 15%", "levy_rm": 1920}
            },
            "Plantation": {
                "tier_1": {"ratio": "≤ 10%", "levy_rm": 590},
                "tier_2": {"ratio": "10-15%", "levy_rm": 1180},
                "tier_3": {"ratio": "> 15%", "levy_rm": 1770}
            },
            "Agriculture": {
                "tier_1": {"ratio": "≤ 10%", "levy_rm": 590},
                "tier_2": {"ratio": "10-15%", "levy_rm": 1180},
                "tier_3": {"ratio": "> 15%", "levy_rm": 1770}
            },
            "Services": {
                "tier_1": {"ratio": "≤ 10%", "levy_rm": 710},
                "tier_2": {"ratio": "10-15%", "levy_rm": 1420},
                "tier_3": {"ratio": "> 15%", "levy_rm": 2130}
            }
        }
    }


@router.get("/ep-salary-thresholds")
async def get_ep_salary_thresholds():
    """
    Get Employment Pass salary thresholds (pre and post June 2026).
    """
    return {
        "pre_june_2026": {
            "EP_Category_I": 10000,
            "EP_Category_II": 5000,
            "EP_Category_III": 3000
        },
        "post_june_2026": {
            "effective_date": "2026-06-01",
            "EP_Category_I": 20000,
            "EP_Category_II": 10000,
            "EP_Category_III": 5000
        },
        "max_pass_duration": {
            "EP_Category_I": "10 years",
            "EP_Category_II": "10 years",
            "EP_Category_III": "5 years"
        }
    }
