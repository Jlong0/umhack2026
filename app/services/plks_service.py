from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional

from app.firebase_config import db


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


class PLKSService:
    async def create_application(self, worker_id: str, vdr_id: Optional[str] = None) -> str:
        data = {
            "worker_id": worker_id,
            "vdr_id": vdr_id,
            "status": "pending_arrival",
            "mdac_verified": False,
            "mdac_date": None,
            "sev_stamp_verified": False,
            "boarding_pass_url": None,
            "fomema_clinic_code": None,
            "fomema_registration_date": None,
            "fomema_attended_date": None,
            "fomema_result": "pending",
            "fomema_result_date": None,
            "com_triggered": False,
            "biometric_date": None,
            "ikad_number": None,
            "created_at": _now_iso(),
            "updated_at": _now_iso(),
        }
        doc_ref = db.collection("plks_applications").add(data)
        return doc_ref[1].id

    async def verify_mdac(self, worker_id: str, arrival_date: str) -> Dict[str, Any]:
        deadline = await self.calculate_fomema_deadline(arrival_date)
        worker_ref = db.collection("workers").document(worker_id)
        worker_doc = worker_ref.get()
        if worker_doc.exists:
            worker_ref.update(
                {
                    "arrival_date": arrival_date,
                    "fomema_deadline": deadline,
                    "mdac_verified": True,
                    "updated_at": _now_iso(),
                }
            )

        return {
            "verified": True,
            "arrival_date": arrival_date,
            "fomema_deadline": deadline,
        }

    async def register_fomema(self, plks_id: str, clinic_code: str) -> Dict[str, Any]:
        plks_ref = db.collection("plks_applications").document(plks_id)
        plks_doc = plks_ref.get()
        if not plks_doc.exists:
            raise ValueError("PLKS application not found")

        registration_date = _now_iso()
        plks_ref.update(
            {
                "fomema_clinic_code": clinic_code,
                "fomema_registration_date": registration_date,
                "status": "fomema_registered",
                "updated_at": _now_iso(),
            }
        )

        return {
            "plks_id": plks_id,
            "registration_date": registration_date,
            "clinic_code": clinic_code,
            "status": "fomema_registered",
        }

    async def update_fomema_result(self, plks_id: str, result: str) -> Dict[str, Any]:
        normalized = (result or "pending").strip().lower()
        if normalized not in {"fit", "unfit", "pending"}:
            raise ValueError("FOMEMA result must be fit, unfit, or pending")

        plks_ref = db.collection("plks_applications").document(plks_id)
        plks_doc = plks_ref.get()
        if not plks_doc.exists:
            raise ValueError("PLKS application not found")

        status_map = {
            "fit": "fomema_fit",
            "unfit": "fomema_unfit",
            "pending": "fomema_attended",
        }
        next_action = {
            "fit": "proceed_to_endorsement",
            "unfit": "trigger_com",
            "pending": "await_result",
        }

        plks_ref.update(
            {
                "fomema_result": normalized,
                "fomema_result_date": _now_iso(),
                "status": status_map[normalized],
                "updated_at": _now_iso(),
            }
        )

        return {
            "plks_id": plks_id,
            "result": normalized,
            "next_action": next_action[normalized],
            "status": status_map[normalized],
        }

    async def trigger_com(self, worker_id: str) -> Dict[str, Any]:
        """
        Trigger the COM Request Letter process for a worker declared FOMEMA UNFIT.

        This does NOT generate the Check Out Memo itself (that is issued by JIM).
        Instead it generates a formal cover letter from the employer to JIM
        requesting that a COM be issued, then uploads it to Firebase Storage.
        """
        from app.services.glm_service import glm_service
        from app.firebase_config import bucket, USE_MOCK

        # ── 1. Fetch worker data ──────────────────────────────────────
        worker_ref = db.collection("workers").document(worker_id)
        worker_doc = worker_ref.get()
        if not worker_doc.exists:
            raise ValueError("Worker not found")
        worker_data = worker_doc.to_dict()

        # ── 2. Fetch employer / company info ──────────────────────────
        company_id = worker_data.get("company_id")
        employer_name = "N/A"
        company_registration = "N/A"
        if company_id:
            company_doc = db.collection("companies").document(company_id).get()
            if company_doc.exists:
                company = company_doc.to_dict()
                employer_name = company.get("name", "N/A")
                company_registration = company.get("registration_number", "N/A")

        # ── 3. Fetch FOMEMA result metadata ───────────────────────────
        plks_docs_iter = (
            db.collection("plks_applications")
            .where("worker_id", "==", worker_id)
            .stream()
        )
        plks_snapshot = next(plks_docs_iter, None)
        fomema_result_date = "N/A"
        condition_category = "Category 1 — Communicable Disease"
        if plks_snapshot:
            plks_data = plks_snapshot.to_dict()
            fomema_result_date = plks_data.get("fomema_result_date", "N/A")
            condition_category = plks_data.get(
                "condition_category",
                "Category 1 — Communicable Disease",
            )

        # ── 4. Generate COM Request Letter via AI ─────────────────────
        context = {
            "employer_name": employer_name,
            "company_registration": company_registration,
            "fomema_result_date": fomema_result_date,
            "condition_category": condition_category,
        }
        result = glm_service.generate_justification_letter_with_glm5(
            worker_data=worker_data,
            application_type="com_request_letter",
            context=context,
        )

        letter_text = result.get("letter", "")
        if not letter_text:
            letter_text = (
                "[AUTO-GENERATED FALLBACK]\n\n"
                f"COM Request Letter for worker {worker_data.get('full_name', worker_id)}.\n"
                f"Passport: {worker_data.get('passport_number', 'N/A')}\n"
                f"Reason: FOMEMA Medical Examination — UNFIT\n"
                f"Date: {_now_iso()}\n"
            )

        # ── 5. Upload to Firebase Storage ─────────────────────────────
        file_name = (
            f"com_requests/{worker_id}/"
            f"COM_Request_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}.txt"
        )

        com_document_url: str
        if not USE_MOCK and bucket:
            try:
                blob = bucket.blob(file_name)
                blob.upload_from_string(letter_text, content_type="text/plain")
                blob.make_public()
                com_document_url = blob.public_url
            except Exception as exc:
                print(f"WARNING: Failed to upload COM request letter: {exc}")
                com_document_url = f"storage://{file_name}"
        else:
            com_document_url = f"mock://{file_name}"

        # ── 6. Update database statuses ───────────────────────────────
        # Mark all PLKS applications for this worker
        all_plks = (
            db.collection("plks_applications")
            .where("worker_id", "==", worker_id)
            .stream()
        )
        for doc in all_plks:
            doc.reference.update(
                {
                    "com_triggered": True,
                    "com_request_letter_url": com_document_url,
                    "status": "pending_com_application",
                    "updated_at": _now_iso(),
                }
            )

        # Update worker status
        worker_ref.set(
            {
                "status": "pending_com_application",
                "com_request_letter_url": com_document_url,
                "updated_at": _now_iso(),
            },
            merge=True,
        )

        return {
            "worker_id": worker_id,
            "com_request_letter_url": com_document_url,
            "triggered": True,
            "letter_generated": result.get("success", False),
            "model_used": result.get("model", "fallback"),
        }

    async def confirm_biometrics(self, plks_id: str) -> Dict[str, Any]:
        plks_ref = db.collection("plks_applications").document(plks_id)
        plks_doc = plks_ref.get()
        if not plks_doc.exists:
            raise ValueError("PLKS application not found")

        current = plks_doc.to_dict()
        if current.get("fomema_result") != "fit":
            raise ValueError("Cannot confirm biometrics before FOMEMA fit result")

        biometric_date = _now_iso()
        ikad_number = f"IKAD-{plks_id[:8].upper()}"

        plks_ref.update(
            {
                "biometric_date": biometric_date,
                "status": "plks_issued",
                "ikad_number": ikad_number,
                "updated_at": _now_iso(),
            }
        )

        return {
            "plks_id": plks_id,
            "biometric_date": biometric_date,
            "ikad_number": ikad_number,
            "status": "plks_issued",
        }

    async def calculate_fomema_deadline(self, arrival_date: str) -> str:
        parsed = datetime.fromisoformat(arrival_date)
        return (parsed + timedelta(days=30)).isoformat()

    async def get_status(self, plks_id: str) -> Dict[str, Any]:
        plks_doc = db.collection("plks_applications").document(plks_id).get()
        if not plks_doc.exists:
            raise ValueError("PLKS application not found")

        data = plks_doc.to_dict()

        days_remaining = None
        worker_id = data.get("worker_id")
        if worker_id:
            worker_doc = db.collection("workers").document(worker_id).get()
            if worker_doc.exists:
                worker_data = worker_doc.to_dict()
                deadline = worker_data.get("fomema_deadline")
                if deadline:
                    try:
                        days_remaining = (datetime.fromisoformat(deadline) - datetime.now()).days
                    except Exception:
                        days_remaining = None

        return {
            "plks_id": plks_id,
            **data,
            "days_remaining_to_fomema_deadline": days_remaining,
        }


plks_service = PLKSService()
