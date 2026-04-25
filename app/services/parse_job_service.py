from datetime import datetime, timezone
from app.firebase_config import db
from app.services.document_triage_service import document_triage_service
from app.agents.nodes import document_parser_node


def create_parse_job(document_id: str):
    job_data = {
        "document_id": document_id,
        "status": "queued",
        "result": None,
        "error": None,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    doc_ref = db.collection("parse_jobs").add(job_data)
    return {"job_id": doc_ref[1].id, **job_data}


def get_parse_job(job_id: str):
    doc = db.collection("parse_jobs").document(job_id).get()
    if not doc.exists:
        return None
    data = doc.to_dict()
    data["job_id"] = doc.id
    return data


async def process_parse_job(job_id: str, document_id: str):
    job_ref = db.collection("parse_jobs").document(job_id)
    now = datetime.now(timezone.utc).isoformat()
    job_ref.update({"status": "processing", "updated_at": now})

    try:
        doc_data = db.collection("documents").document(document_id).get().to_dict()
        storage_path = doc_data.get("storage_path")
        document_type = doc_data.get("document_type", "unknown")
        content_type = doc_data.get("content_type", "image/jpeg")

        parse_result = await document_triage_service.triage_and_parse(
            document_id=document_id,
            storage_path=storage_path,
            document_type=document_type,
            content_type=content_type,
        )

        if parse_result["success"]:
            confidence = parse_result.get("confidence", 0.85)
            raw = parse_result.get("extracted_data", {})
            # Gemini returns {field: {value, confidence}} — use as-is; only wrap flat values
            fields = {
                k: v if isinstance(v, dict) and "value" in v else {"value": v, "confidence": confidence}
                for k, v in raw.items()
            }
            low_confidence_fields = [k for k, v in fields.items() if v.get("confidence", 1.0) < 0.75]
            job_ref.update({
                "status": "completed",
                "result": {
                    "fields": fields,
                    "triage_level": parse_result.get("triage_level"),
                    "method": parse_result.get("method"),
                    "cost_rm": parse_result.get("cost_rm", 0),
                },
                "low_confidence_fields": low_confidence_fields,
                "updated_at": datetime.now(timezone.utc).isoformat(),
            })

            # Feed into document_parser_node if a pipeline state exists
            pipeline_id = doc_data.get("pipeline_id")
            if pipeline_id:
                pipeline_ref = db.collection("pipeline_states").document(pipeline_id)
                pipeline_doc = pipeline_ref.get()
                if pipeline_doc.exists:
                    state = pipeline_doc.to_dict()
                    docs = state.get("vdr_form_data", {}).get("documents", {})
                    docs[document_type] = storage_path
                    state.setdefault("vdr_form_data", {})["documents"] = docs
                    updated = document_parser_node(state)
                    pipeline_ref.set(updated, merge=True)
        else:
            job_ref.update({
                "status": "failed",
                "error": parse_result.get("error", "Unknown error"),
                "updated_at": datetime.now(timezone.utc).isoformat(),
            })

    except Exception as e:
        job_ref.update({
            "status": "failed",
            "error": str(e),
            "updated_at": datetime.now(timezone.utc).isoformat(),
        })
