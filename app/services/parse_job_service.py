from datetime import datetime, timezone
from app.firebase_config import db
from app.services.document_triage_service import document_triage_service

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

async def process_parse_job(job_id: str, document_id: str):
    """
    Process document parsing job using the triage system.
    """
    job_ref = db.collection("parse_jobs").document(job_id)
    job_ref.update({
        "status": "processing",
        "updated_at": datetime.now(timezone.utc).isoformat()
    })

    try:
        # Get document metadata
        doc_ref = db.collection("documents").document(document_id)
        doc_data = doc_ref.get().to_dict()

        storage_path = doc_data.get("storage_path")
        document_type = doc_data.get("document_type", "unknown")
        content_type = doc_data.get("content_type", "image/jpeg")

        # Use triage service to parse
        parse_result = await document_triage_service.triage_and_parse(
            document_id=document_id,
            storage_path=storage_path,
            document_type=document_type,
            content_type=content_type
        )

        if parse_result["success"]:
            # Convert extracted data to field format with confidence
            extracted_data = parse_result.get("extracted_data", {})
            print(extracted_data)
            confidence = parse_result.get("confidence", 0.85)

            fields = {}
            for key, value in extracted_data.items():
                fields[key] = {
                    "value": value,
                    "confidence": confidence
                }

            low_confidence_fields = [
                key for key, val in fields.items()
                if val["confidence"] < 0.75
            ]

            job_ref.update({
                "status": "completed",
                "result": {
                    "fields": fields,
                    "triage_level": parse_result.get("triage_level"),
                    "method": parse_result.get("method"),
                    "cost_rm": parse_result.get("cost_rm", 0)
                },
                "low_confidence_fields": low_confidence_fields,
                "updated_at": datetime.now(timezone.utc).isoformat()
            })
        else:
            job_ref.update({
                "status": "failed",
                "error": parse_result.get("error", "Unknown error"),
                "updated_at": datetime.now(timezone.utc).isoformat()
            })

    except Exception as e:
        job_ref.update({
            "status": "failed",
            "error": str(e),
            "updated_at": datetime.now(timezone.utc).isoformat()
        })
