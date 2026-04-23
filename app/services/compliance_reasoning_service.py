from app.services.glm_service import call_glm
def generate_compliance_obligations(worker_data: dict):
    result = call_glm(worker_data)
    return result["obligations"]