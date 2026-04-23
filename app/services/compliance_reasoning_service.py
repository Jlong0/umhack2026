from app.services.glm_service import glm_service

def generate_compliance_obligations(worker_data: dict):
    # Mock implementation - replace with actual GLM reasoning logic
    return {
        "obligations": [
            "Valid passport with 12+ months validity",
            "FOMEMA medical clearance",
            "Valid work permit (PLKS/EP)",
            "Compliant accommodation (Act 446)"
        ],
        "status": "pending_verification"
    }
