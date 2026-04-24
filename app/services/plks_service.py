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


    async def generate_com_checklist(self, worker_id: str) -> Dict[str, Any]:
        """
        Generate a structured COM repatriation checklist document for a worker
        declared FOMEMA UNFIT.

        Returns a structured JSON payload containing:
          - Worker & employer info summary
          - Step-by-step repatriation action steps
          - Required document checklist
          - Important deadlines and contact references
        """
        # ── 1. Fetch worker data ──────────────────────────────────────
        worker_ref = db.collection("workers").document(worker_id)
        worker_doc = worker_ref.get()
        if not worker_doc.exists:
            raise ValueError("Worker not found")
        worker = worker_doc.to_dict()

        # ── 2. Fetch company data ─────────────────────────────────────
        company_id = worker.get("company_id")
        employer_name = "N/A"
        company_registration = "N/A"
        if company_id:
            company_doc = db.collection("companies").document(company_id).get()
            if company_doc.exists:
                company = company_doc.to_dict()
                employer_name = company.get("name", "N/A")
                company_registration = company.get("ssm_number", "N/A")

        # ── 3. Fetch PLKS / FOMEMA data ───────────────────────────────
        plks_docs_iter = (
            db.collection("plks_applications")
            .where("worker_id", "==", worker_id)
            .stream()
        )
        plks_snapshot = next(plks_docs_iter, None)
        fomema_result_date = "N/A"
        fomema_clinic_code = "N/A"
        condition_category = "Category 1 — Communicable Disease"
        if plks_snapshot:
            plks_data = plks_snapshot.to_dict()
            fomema_result_date = plks_data.get("fomema_result_date", "N/A")
            fomema_clinic_code = plks_data.get("fomema_clinic_code", "N/A")
            condition_category = plks_data.get(
                "condition_category",
                "Category 1 — Communicable Disease",
            )

        generated_at = _now_iso()

        # ── 4. Build the structured checklist ────────────────────────
        checklist = _build_com_checklist_document(
            worker=worker,
            worker_id=worker_id,
            employer_name=employer_name,
            company_registration=company_registration,
            fomema_result_date=fomema_result_date,
            fomema_clinic_code=fomema_clinic_code,
            condition_category=condition_category,
            generated_at=generated_at,
        )

        # ── 5. Persist checklist reference to Firestore ───────────────
        worker_ref.set(
            {
                "com_checklist_generated_at": generated_at,
                "com_checklist": checklist,
                "updated_at": generated_at,
            },
            merge=True,
        )

        return {
            "worker_id": worker_id,
            "generated_at": generated_at,
            "checklist": checklist,
        }


def _build_com_checklist_document(
    worker: Dict[str, Any],
    worker_id: str,
    employer_name: str,
    company_registration: str,
    fomema_result_date: str,
    fomema_clinic_code: str,
    condition_category: str,
    generated_at: str,
) -> Dict[str, Any]:
    """
    Build a structured COM repatriation reminder checklist.

    Returns a dict with:
      - summary: worker & case summary
      - steps: ordered list of action steps with sub-items
      - required_documents: flat checklist of all documents needed
      - important_notes: key compliance notes
      - contacts: relevant authority contacts
    """
    full_name = worker.get("full_name", "N/A")
    passport_number = worker.get("passport_number", worker.get("passport_no", "N/A"))
    nationality = worker.get("nationality", "N/A")
    sector = worker.get("sector", "N/A")
    plks_number = worker.get("plks_number", "N/A")
    permit_expiry = worker.get("plks_expiry_date", worker.get("permit_expiry_date", "N/A"))

    return {
        "title": "COM (Check Out Memo) Repatriation Checklist",
        "subtitle": "Panduan Penghantaran Pulang Pekerja — FOMEMA UNFIT",
        "generated_at": generated_at,

        # ── Case summary ─────────────────────────────────────────────
        "summary": {
            "worker_name": full_name,
            "passport_number": passport_number,
            "nationality": nationality,
            "sector": sector,
            "plks_number": plks_number,
            "permit_expiry_date": permit_expiry,
            "fomema_result": "UNFIT (Tidak Layak)",
            "fomema_result_date": fomema_result_date,
            "fomema_clinic_code": fomema_clinic_code,
            "condition_category": condition_category,
            "employer_name": employer_name,
            "company_registration": company_registration,
        },

        # ── Step-by-step action guide ────────────────────────────────
        "steps": [
            {
                "step": 1,
                "title": "Terima Keputusan FOMEMA (Receive FOMEMA Result)",
                "description": (
                    "Majikan menerima notis rasmi hasil pemeriksaan FOMEMA. "
                    "Pekerja diklasifikasikan sebagai TIDAK LAYAK (Unfit)."
                ),
                "action_items": [
                    "Dapatkan salinan laporan FOMEMA yang ditandatangani doktor",
                    f"Sahkan kategori penyakit: {condition_category}",
                    "Semak sama ada pekerja layak untuk rayuan program NCD Monitoring (Kategori 2 sahaja)",
                ],
                "documents_needed": [
                    "FOMEMA Medical Report (original)",
                    "FOMEMA Result Letter",
                ],
                "deadline": "Immediately upon receiving result",
                "status_flag": "mandatory",
            },
            {
                "step": 2,
                "title": "Notifikasi kepada Pekerja (Notify Worker)",
                "description": (
                    "Majikan wajib memaklumkan pekerja tentang keputusan FOMEMA dan "
                    "hak-hak mereka sebelum proses penghantaran pulang dimulakan."
                ),
                "action_items": [
                    "Maklumkan secara bertulis kepada pekerja tentang keputusan FOMEMA UNFIT",
                    "Terangkan proses penghantaran pulang (repatriation)",
                    "Berikan masa yang munasabah untuk pekerja menyelesaikan urusan peribadi",
                    "Simpan salinan notifikasi yang ditandatangani pekerja",
                ],
                "documents_needed": [
                    "Termination / Repatriation Letter (from employer)",
                    "Acknowledgment Letter (signed by worker)",
                ],
                "deadline": "Within 3 working days of FOMEMA result",
                "status_flag": "mandatory",
            },
            {
                "step": 3,
                "title": "Sediakan Surat Permohonan COM (Prepare COM Request Letter)",
                "description": (
                    "Majikan perlu menyediakan surat rasmi kepada Jabatan Imigresen Malaysia (JIM) "
                    "memohon pengeluaran Check Out Memo (COM)."
                ),
                "action_items": [
                    "Sediakan surat permohonan COM atas kepala syarikat",
                    "Nyatakan butiran penuh pekerja dan hasil FOMEMA",
                    "Sahkan syarikat akan menanggung kos tiket penerbangan",
                    "Tandatangan dan cop syarikat pada surat",
                    "Hantar ke pejabat Imigresen daerah yang berkenaan",
                ],
                "documents_needed": [
                    "COM Request Letter (company letterhead)",
                    "Company SSM Registration Certificate",
                    "Authorized Signatory IC copy",
                ],
                "deadline": "Within 7 days of FOMEMA result",
                "status_flag": "mandatory",
            },
            {
                "step": 4,
                "title": "Kumpul Dokumen Pekerja (Collect Worker Documents)",
                "description": (
                    "Kumpulkan semua dokumen rasmi pekerja yang diperlukan untuk "
                    "proses penghantaran pulang di Imigresen."
                ),
                "action_items": [
                    "Ambil semula passport pekerja dari pekerja / tempat simpanan",
                    "Dapatkan salinan PLKS / permit kerja yang masih sah",
                    "Kumpulkan laporan FOMEMA asal",
                    "Sediakan surat pemberhentian kerja / repatriation letter",
                    "Pastikan semua dokumen belum tamat tempoh atau tidak rosak",
                ],
                "documents_needed": [
                    {
                        "document": "Passport (original)",
                        "details": f"No: {passport_number} — Pastikan sah dan tidak tamat tempoh",
                        "mandatory": True,
                    },
                    {
                        "document": "PLKS / Work Permit",
                        "details": f"No: {plks_number} — Permit kerja semasa",
                        "mandatory": True,
                    },
                    {
                        "document": "FOMEMA Result (UNFIT)",
                        "details": f"Tarikh keputusan: {fomema_result_date}",
                        "mandatory": True,
                    },
                    {
                        "document": "Termination / Repatriation Letter",
                        "details": "Surat pemberhentian/penghantaran pulang dari majikan",
                        "mandatory": True,
                    },
                    {
                        "document": "Flight Ticket (return)",
                        "details": "Tiket penerbangan pulang ke negara asal",
                        "mandatory": True,
                    },
                    {
                        "document": "Borang IM.12 (Special Pass, if needed)",
                        "details": "Jika permit pekerja sudah tamat semasa proses COM",
                        "mandatory": False,
                    },
                    {
                        "document": "i-Kad (if issued)",
                        "details": "Kad Pekerja Asing jika telah dikeluarkan",
                        "mandatory": False,
                    },
                ],
                "deadline": "Before submitting COM application to JIM",
                "status_flag": "mandatory",
            },
            {
                "step": 5,
                "title": "Serah Dokumen ke Imigresen (Submit to JIM)",
                "description": (
                    "Hantar semua dokumen ke kaunter Jabatan Imigresen Malaysia (JIM) "
                    "untuk mendapatkan Check Out Memo (COM)."
                ),
                "action_items": [
                    "Pergi ke pejabat Imigresen daerah atau Imigresen negeri yang berkenaan",
                    "Serahkan semua dokumen yang telah dikumpulkan",
                    "Bayar yuran COM jika dikenakan",
                    "Dapatkan resit / slip pengesahan penerimaan dokumen",
                    "Tanya anggaran masa siap COM (biasanya 1–3 hari bekerja)",
                ],
                "documents_needed": [
                    "Complete document package from Step 4",
                    "COM Request Letter (Step 3)",
                    "Payment receipt (if applicable)",
                ],
                "deadline": "As soon as documents are complete",
                "status_flag": "mandatory",
                "authority": "Jabatan Imigresen Malaysia (JIM)",
            },
            {
                "step": 6,
                "title": "Proses Penghantaran Pulang (Execute Repatriation)",
                "description": (
                    "Setelah COM diterima, laksanakan penghantaran pulang pekerja ke negara asal."
                ),
                "action_items": [
                    "Terima COM dari Imigresen",
                    "Tempah tiket penerbangan pulang untuk pekerja (kos ditanggung majikan)",
                    "Pastikan pekerja hadir di lapangan terbang pada masa yang ditetapkan",
                    "Serahkan COM kepada pegawai imigresen di lapangan terbang semasa departure",
                    "Dapatkan pengesahan 'Telah Berlepas' dari imigresen lapangan terbang",
                    "Kemukakan laporan penutupan kepada JTKSM dalam masa 14 hari",
                ],
                "documents_needed": [
                    "Check Out Memo (COM) — issued by JIM",
                    "Flight ticket (booked by employer)",
                    "Worker's passport",
                    "Departure confirmation from airport immigration",
                ],
                "deadline": "Within 14 days of receiving COM",
                "status_flag": "mandatory",
            },
            {
                "step": 7,
                "title": "Penghantaran Laporan Penutup (Submit Closure Report)",
                "description": (
                    "Selepas pekerja berlepas, majikan perlu mengemukakan laporan penutup "
                    "kepada pihak berkuasa berkenaan."
                ),
                "action_items": [
                    "Kemukakan laporan kepada JTKSM (Jabatan Tenaga Kerja Semenanjung Malaysia)",
                    "Kemukakan laporan kepada FWCMS (Foreign Workers Centralised Management System)",
                    "Batalkan PLKS dan permit kerja pekerja di sistem MyEG",
                    "Simpan semua rekod untuk audit selama sekurang-kurangnya 3 tahun",
                ],
                "documents_needed": [
                    "Departure confirmation",
                    "Closure report form (JTKSM)",
                    "PLKS cancellation confirmation",
                ],
                "deadline": "Within 14 days of worker departure",
                "status_flag": "mandatory",
            },
        ],

        # ── Flat required documents list ─────────────────────────────
        "required_documents": [
            {"no": 1, "document": "Passport (original)", "status": "pending", "mandatory": True},
            {"no": 2, "document": "PLKS / Work Permit", "status": "pending", "mandatory": True},
            {"no": 3, "document": "FOMEMA Medical Report (UNFIT)", "status": "ready", "mandatory": True},
            {"no": 4, "document": "COM Request Letter (company letterhead)", "status": "pending", "mandatory": True},
            {"no": 5, "document": "Termination / Repatriation Letter", "status": "pending", "mandatory": True},
            {"no": 6, "document": "Flight Ticket (return)", "status": "pending", "mandatory": True},
            {"no": 7, "document": "Company SSM Registration Certificate", "status": "pending", "mandatory": True},
            {"no": 8, "document": "Check Out Memo — COM (from JIM)", "status": "pending", "mandatory": True},
            {"no": 9, "document": "Borang IM.12 (Special Pass)", "status": "not_required", "mandatory": False},
            {"no": 10, "document": "i-Kad (surrender to JIM)", "status": "pending", "mandatory": False},
        ],

        # ── Important compliance notes ────────────────────────────────
        "important_notes": [
            {
                "type": "warning",
                "message": (
                    "Majikan yang gagal melaksanakan penghantaran pulang pekerja FOMEMA UNFIT "
                    "dalam masa yang ditetapkan boleh didenda sehingga RM 50,000 atau dipenjarakan "
                    "di bawah Akta Imigresen 1959/63."
                ),
            },
            {
                "type": "info",
                "message": (
                    f"Pekerja dengan {condition_category} TIDAK layak untuk rayuan NCD Monitoring. "
                    "Proses COM adalah mandatori dan mesti dilaksanakan dengan segera."
                )
                if "Category 1" in condition_category
                else (
                    f"Pekerja dengan {condition_category} mungkin layak untuk rayuan NCD Monitoring Programme. "
                    "Sila semak dengan FOMEMA sebelum meneruskan COM."
                ),
            },
            {
                "type": "info",
                "message": (
                    "Semua kos penghantaran pulang (tiket penerbangan, pengangkutan, dll.) "
                    "adalah tanggungjawab majikan mengikut seksyen 60N Akta Kerja 1955."
                ),
            },
            {
                "type": "warning",
                "message": (
                    "Jika permit pekerja tamat tempoh semasa proses COM, majikan perlu memohon "
                    "Special Pass (Borang IM.12) daripada Imigresen untuk mengelak overstay."
                ),
            },
        ],

        # ── Authority contacts ────────────────────────────────────────
        "contacts": [
            {
                "authority": "Jabatan Imigresen Malaysia (JIM)",
                "hotline": "03-8880 1000",
                "website": "https://www.imi.gov.my",
                "purpose": "COM application, Special Pass",
            },
            {
                "authority": "FOMEMA Sdn Bhd",
                "hotline": "03-7843 7800",
                "website": "https://www.fomema.com.my",
                "purpose": "Medical result enquiry",
            },
            {
                "authority": "Jabatan Tenaga Kerja Semenanjung Malaysia (JTKSM)",
                "hotline": "03-8886 5000",
                "website": "https://www.jtksm.mohr.gov.my",
                "purpose": "Closure report, quota cancellation",
            },
            {
                "authority": "MyEG Services",
                "website": "https://www.myeg.com.my",
                "purpose": "PLKS / permit cancellation online",
            },
        ],
    }


plks_service = PLKSService()

