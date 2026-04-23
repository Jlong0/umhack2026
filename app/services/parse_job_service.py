from datetime import datetime, timezone
from app.firebase_config import db

def create_parse_job(document_id: str):
    job_data = {
        "document_id": document_id,
        "status": "queued",
        "result": None,
        "error": None,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }

    doc_ref = db.collection("parse_jobs").add(job_data)
    return {
        "job_id": doc_ref[1].id,
        **job_data
    }

def get_parse_job(job_id: str):
    doc = db.collection("parse_jobs").document(job_id).get()

    if not doc.exists:
        return None

    data = doc.to_dict()
    data["job_id"] = doc.id
    return data

def process_parse_job(job_id: str, document_id: str):
    job_ref = db.collection("parse_jobs").document(job_id)
    job_ref.update({
        "status": "processing",
        "updated_at": datetime.now(timezone.utc).isoformat()
    })

    try:
        # temporary fake result until GLM is wired in
        parsed_result = {
            "fields": {
                "full_name": {"value": "Ali", "confidence": 0.96},
                "passport_number": {"value": "A123456", "confidence": 0.98},
                "nationality": {"value": "Bangladesh", "confidence": 0.93},
                "sector": {"value": "manufacturing", "confidence": 0.0},
                "permit_class": {"value": "PLKS", "confidence": 0.0},
                "passport_expiry_date": {"value": None, "confidence": 0.0},
                "permit_expiry_date": {"value": None, "confidence": 0.0},
            }
        }

        low_confidence_fields = [
            key for key, val in parsed_result["fields"].items()
            if val["confidence"] < 0.75
        ]

        job_ref.update({
            "status": "completed",
            "result": parsed_result,
            "low_confidence_fields": low_confidence_fields,
            "updated_at": datetime.now(timezone.utc).isoformat()
        })

    except Exception as e:
        job_ref.update({
            "status": "failed",
            "error": str(e),
            "updated_at": datetime.now(timezone.utc).isoformat()
        })