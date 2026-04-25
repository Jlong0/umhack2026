import json
from uuid import uuid4
from datetime import datetime, timezone
from pathlib import Path

import fitz  # pymupdf

from app.firebase_config import db, bucket
from app.services.gemini_service import generate_text

LOCAL_UPLOAD_DIR = Path("uploads")

WORKER_FIELD_MAP = {
    "full_name": ["full name", "worker name", "name of worker", "employee name"],
    "passport_number": ["passport number", "passport no", "ic/passport"],
    "nationality": ["nationality", "country"],
    "sector": ["sector", "industry"],
    "permit_class": ["permit class", "permit type", "visa type"],
    "permit_expiry_date": ["permit expiry", "permit expiry date", "work permit expiry"],
    "passport_expiry_date": ["passport expiry", "passport expiry date"],
    "arrival_date": ["arrival date", "date of arrival"],
    "biomedical_ref_number": ["biomedical ref", "biomedical reference"],
}


def _extract_pdf_context(doc: fitz.Document) -> dict:
    """Extract text blocks and AcroForm fields from PDF."""
    acroform_fields = []
    text_blocks = []

    for page_num, page in enumerate(doc):
        # AcroForm fields
        for widget in page.widgets() or []:
            acroform_fields.append({
                "page": page_num,
                "field_name": widget.field_name,
                "field_type": widget.field_type_string,
                "rect": list(widget.rect),
            })

        # Text blocks (to find blank lines / labels)
        blocks = page.get_text("blocks")
        for b in blocks:
            text = b[4].strip()
            if text:
                text_blocks.append({"page": page_num, "text": text, "rect": list(b[:4])})

    return {"acroform_fields": acroform_fields, "text_blocks": text_blocks}


def _gemini_map_fields(pdf_context: dict, worker: dict) -> dict:
    """Ask Gemini to map PDF fields/labels to worker values."""
    worker_info = {k: worker.get(k) or worker.get("full_name" if k == "name" else k)
                   for k in WORKER_FIELD_MAP}

    prompt = f"""You are filling an employment contract PDF with worker data.

PDF AcroForm fields: {json.dumps(pdf_context['acroform_fields'][:30])}
PDF text labels (near blank lines): {json.dumps(pdf_context['text_blocks'][:50])}

Worker data:
{json.dumps(worker_info, indent=2)}

Return a JSON object mapping each field to fill:
{{
  "acroform": {{"field_name": "value_to_insert"}},
  "text_overlay": [{{"page": 0, "label_text": "exact label text from pdf", "value": "worker value", "rect": [x0,y0,x1,y1]}}]
}}

Only include fields where you can confidently match worker data. Return only valid JSON."""

    result = generate_text(prompt)
    if not result.get("success"):
        return {"acroform": {}, "text_overlay": []}
    try:
        text = result["text"]
        if "```json" in text:
            text = text.split("```json")[1].split("```")[0].strip()
        elif "```" in text:
            text = text.split("```")[1].split("```")[0].strip()
        return json.loads(text)
    except Exception:
        return {"acroform": {}, "text_overlay": []}


def fill_contract_for_worker(template_bytes: bytes, worker: dict) -> bytes:
    doc = fitz.open(stream=template_bytes, filetype="pdf")
    pdf_context = _extract_pdf_context(doc)
    mapping = _gemini_map_fields(pdf_context, worker)

    # Fill AcroForm fields
    acroform_map = mapping.get("acroform", {})
    if acroform_map:
        for page in doc:
            for widget in page.widgets() or []:
                if widget.field_name in acroform_map:
                    widget.field_value = str(acroform_map[widget.field_name])
                    widget.update()

    # Text overlays for blank-line style templates
    for overlay in mapping.get("text_overlay", []):
        page_num = overlay.get("page", 0)
        rect = overlay.get("rect")
        value = overlay.get("value", "")
        if rect and value and page_num < len(doc):
            page = doc[page_num]
            # Insert text just above the detected rect (baseline of blank line)
            insert_point = fitz.Point(rect[0] + 2, rect[3] - 2)
            page.insert_text(insert_point, str(value), fontsize=10, color=(0, 0, 0))

    return doc.tobytes(deflate=True)


def _save_pdf_bytes(pdf_bytes: bytes, storage_path: str) -> bool:
    if bucket is not None:
        try:
            blob = bucket.blob(storage_path)
            blob.upload_from_string(pdf_bytes, content_type="application/pdf")
            return True
        except Exception:
            pass
    LOCAL_UPLOAD_DIR.mkdir(exist_ok=True)
    filename = storage_path.split("/")[-1]
    (LOCAL_UPLOAD_DIR / filename).write_bytes(pdf_bytes)
    return False


def generate_contracts_for_all_workers(template_bytes: bytes, job_id: str):
    """Background task: generate one contract PDF per worker."""
    workers = db.collection("workers").stream()
    worker_list = [(w.id, w.to_dict()) for w in workers]

    db.collection("contract_jobs").document(job_id).set({
        "status": "processing",
        "total": len(worker_list),
        "done": 0,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })

    done = 0
    for worker_id, worker in worker_list:
        try:
            pdf_bytes = fill_contract_for_worker(template_bytes, worker)
            filename = f"{uuid4()}.pdf"
            storage_path = f"contracts/{filename}"
            _save_pdf_bytes(pdf_bytes, storage_path)

            db.collection("contracts").add({
                "worker_id": worker_id,
                "worker_name": worker.get("full_name") or worker.get("name", "Unknown"),
                "generated_pdf_path": storage_path,
                "signed_pdf_path": None,
                "status": "generated",
                "created_at": datetime.now(timezone.utc).isoformat(),
                "reviewed_at": None,
            })
            done += 1
        except Exception:
            pass

    db.collection("contract_jobs").document(job_id).update({
        "status": "done",
        "done": done,
    })
