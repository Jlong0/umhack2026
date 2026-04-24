from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from uuid import uuid4
import io

from PIL import Image, ImageStat

from app.firebase_config import db, bucket


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


class VDRService:
    DOC_FIELD_MAP = {
        "passport": "passport_scan_url",
        "photo": "passport_photo_url",
        "contract": "signed_contract_url",
        "succession_plan": "succession_plan_url",
        "academic_cert": "academic_certs_urls",
    }

    EP_REQUIRES_SUCCESSION = {
        "EP_CATEGORY_II",
        "EP_CATEGORY_III",
        "EP_II",
        "EP_III",
    }

    async def create_application(self, company_id: str, worker_id: str) -> str:
        data = {
            "worker_id": worker_id,
            "company_id": company_id,
            "status": "draft",
            "passport_scan_url": None,
            "passport_photo_url": None,
            "photo_biometric_compliant": False,
            "home_address": {},
            "emergency_contact": {},
            "marital_status": None,
            "signed_contract_url": None,
            "biomedical_ref_number": None,
            "biomedical_status": "pending",
            "imm47_payload": {},
            "succession_plan_url": None,
            "academic_certs_urls": [],
            "checklist": [],
            "created_at": _now_iso(),
            "updated_at": _now_iso(),
        }
        doc_ref = db.collection("vdr_applications").add(data)
        vdr_id = doc_ref[1].id

        checklist_status = await self.get_checklist_status(vdr_id)
        db.collection("vdr_applications").document(vdr_id).update(
            {
                "checklist": checklist_status["items"],
                "updated_at": _now_iso(),
            }
        )
        return vdr_id

    async def upload_document(
        self,
        vdr_id: str,
        doc_type: str,
        filename: str,
        content_type: str,
        content: bytes,
    ) -> Dict[str, Any]:
        field_name = self.DOC_FIELD_MAP.get(doc_type)
        if not field_name:
            raise ValueError("Unsupported doc_type")

        ext = filename.rsplit(".", 1)[-1] if "." in filename else "bin"
        storage_path = f"vdr/{vdr_id}/{doc_type}/{uuid4()}.{ext}"

        blob = bucket.blob(storage_path)
        blob.upload_from_string(content, content_type=content_type)

        vdr_ref = db.collection("vdr_applications").document(vdr_id)
        vdr_doc = vdr_ref.get()
        if not vdr_doc.exists:
            raise ValueError("VDR application not found")

        current = vdr_doc.to_dict()
        update_payload: Dict[str, Any] = {"updated_at": _now_iso()}

        if field_name == "academic_certs_urls":
            existing = current.get("academic_certs_urls", [])
            existing.append(storage_path)
            update_payload[field_name] = existing
        else:
            update_payload[field_name] = storage_path

        if doc_type == "photo":
            validation = await self.validate_passport_photo(content)
            update_payload["photo_biometric_compliant"] = validation["compliant"]
            update_payload["photo_validation_issues"] = validation["issues"]

        vdr_ref.update(update_payload)

        checklist_status = await self.get_checklist_status(vdr_id)
        new_status = self._derive_vdr_status(
            checklist_complete=checklist_status["all_required_complete"],
            biomedical_status=(current.get("biomedical_status") or "pending"),
        )

        vdr_ref.update(
            {
                "status": new_status,
                "checklist": checklist_status["items"],
                "updated_at": _now_iso(),
            }
        )

        return {
            "vdr_id": vdr_id,
            "doc_type": doc_type,
            "storage_path": storage_path,
            "status": new_status,
            "checklist": checklist_status,
        }

    async def validate_passport_photo(self, photo_bytes: bytes) -> Dict[str, Any]:
        issues: List[str] = []

        try:
            image = Image.open(io.BytesIO(photo_bytes))
        except Exception as exc:
            return {
                "compliant": False,
                "issues": [f"Unable to decode image: {exc}"],
            }

        width, height = image.size
        if width < 350 or height < 500:
            issues.append("resolution_too_low")

        ratio = width / height if height else 0
        if ratio < 0.62 or ratio > 0.78:
            issues.append("photo_ratio_not_35x50")

        grayscale = image.convert("L")
        mean_brightness = ImageStat.Stat(grayscale).mean[0]
        if mean_brightness < 145:
            issues.append("background_may_not_be_white")

        return {
            "compliant": len(issues) == 0,
            "issues": issues,
            "image_width": width,
            "image_height": height,
        }

    async def ping_biomedical_database(
        self,
        ref_no: str,
        passport_no: str,
    ) -> Dict[str, Any]:
        # Deterministic placeholder until external FWCMS integration is wired.
        normalized_ref = (ref_no or "").strip().upper()
        status = "pending"
        fit: Optional[bool] = None

        if normalized_ref.startswith("BM-") and len(normalized_ref) >= 10:
            status = "fit"
            fit = True

        if "UNFIT" in normalized_ref:
            status = "unfit"
            fit = False

        return {
            "reference_number": normalized_ref,
            "passport_no": passport_no,
            "status": status,
            "fit": fit,
            "source": "fwcms_placeholder",
            "checked_at": _now_iso(),
        }

    async def set_biomedical_result(
        self,
        vdr_id: str,
        biomedical_ref_number: str,
        biomedical_status: str,
    ) -> Dict[str, Any]:
        vdr_ref = db.collection("vdr_applications").document(vdr_id)
        vdr_doc = vdr_ref.get()
        if not vdr_doc.exists:
            raise ValueError("VDR application not found")

        current = vdr_doc.to_dict()
        checklist_status = await self.get_checklist_status(vdr_id)

        next_status = self._derive_vdr_status(
            checklist_complete=checklist_status["all_required_complete"],
            biomedical_status=biomedical_status,
        )

        vdr_ref.update(
            {
                "biomedical_ref_number": biomedical_ref_number,
                "biomedical_status": biomedical_status,
                "status": next_status,
                "checklist": checklist_status["items"],
                "updated_at": _now_iso(),
            }
        )

        return {
            "vdr_id": vdr_id,
            "status": next_status,
            "previous_status": current.get("status"),
            "biomedical_status": biomedical_status,
            "checklist": checklist_status,
        }

    async def generate_imm47_payload(self, vdr_id: str) -> Dict[str, Any]:
        vdr_ref = db.collection("vdr_applications").document(vdr_id)
        vdr_doc = vdr_ref.get()
        if not vdr_doc.exists:
            raise ValueError("VDR application not found")

        vdr_data = vdr_doc.to_dict()

        worker_data: Dict[str, Any] = {}
        worker_id = vdr_data.get("worker_id")
        if worker_id:
            worker_doc = db.collection("workers").document(worker_id).get()
            if worker_doc.exists:
                worker_data = worker_doc.to_dict()

        company_data: Dict[str, Any] = {}
        company_id = vdr_data.get("company_id")
        if company_id:
            company_doc = db.collection("companies").document(company_id).get()
            if company_doc.exists:
                company_data = company_doc.to_dict()

        payload = {
            "worker": {
                "worker_id": worker_id,
                "full_name": worker_data.get("full_name"),
                "passport_no": worker_data.get("passport_number"),
                "nationality": worker_data.get("nationality"),
                "permit_class": worker_data.get("permit_class"),
                "job_title": worker_data.get("job_title"),
                "salary": worker_data.get("current_salary_rm") or worker_data.get("salary"),
            },
            "company": {
                "company_id": company_id,
                "name": company_data.get("name"),
                "ssm_number": company_data.get("ssm_number"),
                "sector": company_data.get("sector") or worker_data.get("sector"),
            },
            "documents": {
                "passport_scan": vdr_data.get("passport_scan_url"),
                "passport_photo": vdr_data.get("passport_photo_url"),
                "signed_contract": vdr_data.get("signed_contract_url"),
                "succession_plan": vdr_data.get("succession_plan_url"),
                "academic_certs": vdr_data.get("academic_certs_urls", []),
            },
            "biomedical": {
                "reference_number": vdr_data.get("biomedical_ref_number"),
                "status": vdr_data.get("biomedical_status", "pending"),
            },
            "generated_at": _now_iso(),
        }

        vdr_ref.update({"imm47_payload": payload, "updated_at": _now_iso()})
        return payload

    async def prepare_filing_tasks(self, vdr_id: str) -> Dict[str, Any]:
        vdr_doc = db.collection("vdr_applications").document(vdr_id).get()
        if not vdr_doc.exists:
            raise ValueError("VDR application not found")

        vdr_data = vdr_doc.to_dict()
        checklist = await self.get_checklist_status(vdr_id)

        tasks = [
            {
                "type": "vdr",
                "status": "done" if checklist["all_required_complete"] else "blocked",
                "priority": "high",
                "task_name": "Complete VDR mandatory document checklist",
                "depends_on": [],
                "created_at": _now_iso(),
            },
            {
                "type": "filing",
                "status": "pending" if checklist["all_required_complete"] else "blocked",
                "priority": "mandatory",
                "task_name": "Generate IMM.47 payload and package filing",
                "depends_on": ["vdr"],
                "created_at": _now_iso(),
            },
            {
                "type": "filing",
                "status": "pending" if vdr_data.get("biomedical_status") == "fit" else "blocked",
                "priority": "final",
                "task_name": "Submit VDR bundle to portal",
                "depends_on": ["filing"],
                "created_at": _now_iso(),
            },
        ]

        return {
            "vdr_id": vdr_id,
            "tasks": tasks,
            "checklist": checklist,
        }

    async def get_checklist_status(self, vdr_id: str) -> Dict[str, Any]:
        vdr_doc = db.collection("vdr_applications").document(vdr_id).get()
        if not vdr_doc.exists:
            raise ValueError("VDR application not found")

        vdr_data = vdr_doc.to_dict()
        worker_id = vdr_data.get("worker_id")

        permit_class = "PLKS"
        if worker_id:
            worker_doc = db.collection("workers").document(worker_id).get()
            if worker_doc.exists:
                permit_class = (worker_doc.to_dict().get("permit_class") or "PLKS").upper()

        requires_succession = await self.check_succession_plan_required(permit_class)

        items = [
            {
                "key": "passport_scan",
                "complete": bool(vdr_data.get("passport_scan_url")),
                "required": True,
            },
            {
                "key": "passport_photo",
                "complete": bool(vdr_data.get("passport_photo_url")),
                "required": True,
            },
            {
                "key": "photo_biometric_compliant",
                "complete": bool(vdr_data.get("photo_biometric_compliant")),
                "required": True,
            },
            {
                "key": "biomedical_ref",
                "complete": bool(vdr_data.get("biomedical_ref_number")),
                "required": True,
            },
            {
                "key": "signed_contract",
                "complete": bool(vdr_data.get("signed_contract_url")),
                "required": True,
            },
            {
                "key": "succession_plan",
                "complete": bool(vdr_data.get("succession_plan_url")),
                "required": requires_succession,
            },
            {
                "key": "academic_certs",
                "complete": len(vdr_data.get("academic_certs_urls", [])) > 0,
                "required": requires_succession,
            },
        ]

        required_items = [item for item in items if item["required"]]
        complete_required = [item for item in required_items if item["complete"]]

        return {
            "items": items,
            "complete_count": len(complete_required),
            "total": len(required_items),
            "all_required_complete": len(complete_required) == len(required_items),
            "requires_succession": requires_succession,
        }

    async def check_succession_plan_required(self, ep_category: Optional[str]) -> bool:
        if not ep_category:
            return False
        return ep_category.upper() in self.EP_REQUIRES_SUCCESSION

    async def get_status(self, vdr_id: str) -> Dict[str, Any]:
        vdr_doc = db.collection("vdr_applications").document(vdr_id).get()
        if not vdr_doc.exists:
            raise ValueError("VDR application not found")

        data = vdr_doc.to_dict()
        checklist = await self.get_checklist_status(vdr_id)

        return {
            "vdr_id": vdr_id,
            **data,
            "checklist_status": checklist,
        }

    def _derive_vdr_status(self, checklist_complete: bool, biomedical_status: str) -> str:
        normalized = (biomedical_status or "pending").lower()

        if normalized == "unfit":
            return "rejected"

        if not checklist_complete:
            return "docs_pending"

        if normalized in {"pending", "registered", ""}:
            return "biomedical_pending"

        if normalized == "fit":
            return "ready"

        return "draft"


vdr_service = VDRService()
