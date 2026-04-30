"""
Reconstruct Firestore for the no-auth PermitIQ portal flow.

Default mode is a dry run. To actually reset and seed Firebase:
    python -m scripts.reconstruct_firebase --apply

This intentionally removes the old auth_admins/auth_workers collections because
the frontend now uses portal selection, not Firebase/Auth credential records.
"""

import argparse
import copy
import sys
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.firebase_config import db  # noqa: E402


NOW = datetime.now(timezone.utc).isoformat()

RESET_COLLECTIONS = [
    "auth_admins",
    "auth_workers",
    "companies",
    "workers",
    "workflows",
    "compliance_state",
    "vdr_applications",
    "plks_applications",
    "mock_gov_records",
    "pending_handoffs",
    "worker_obligations",
    "langgraph_streams",
    "langgraph_events",
    "contracts",
    "contract_jobs",
]

COMPANIES = [
    {
        "id": "demo-company",
        "company_name": "Titan Core Technologies Sdn. Bhd.",
        "roc_number": "202401887766",
        "nature_of_business": "Manufacturing and workforce operations",
        "jtksm_60k_status": "approved",
        "act446_cert_number": "ACT446-TCT-2026",
        "act446_max_capacity": 80,
        "act446_expiry_date": "2027-01-01",
        "myfuturejobs_proof_url": "gs://demo-company/myfuturejobs-proof.pdf",
        "local_employee_count": 45,
        "foreign_employee_count": 3,
        "ssm_registration_valid": True,
        "quota_requested": 12,
        "quota_approved": 10,
        "quota_balance": {"Manufacturing": 7, "Services": 5, "Construction": 8},
        "osc_approval_ref": "OSC-DEMO-2026-001",
        "created_at": NOW,
        "updated_at": NOW,
    }
]

WORKERS = [
    {
        "id": "worker-001",
        "worker_id": "worker-001",
        "company_id": "demo-company",
        "full_name": "Ahmad Bin Razali",
        "master_name": "Ahmad Bin Razali",
        "passport_number": "A1234567",
        "nationality": "Bangladesh",
        "worker_dob": "1993-04-12",
        "sector": "Manufacturing",
        "permit_class": "PLKS",
        "permit_expiry_date": "2026-08-01",
        "passport_expiry_date": "2027-03-01",
        "passport_expiry": "2027-03-01",
        "salary_rm": 1500,
        "status": "active",
        "review_status": "approved",
        "workflow_status": "running",
        "data_status": "complete",
        "current_gate": "gate_2_kdn",
        "arrival_date": "2025-04-01",
        "fomema_status": "Fit",
        "passport_scan_url": "gs://demo-company/workers/worker-001/passport.pdf",
        "passport_photo_url": "gs://demo-company/workers/worker-001/photo.jpg",
        "photo_biometric_compliant": True,
        "biomedical_ref": "BIO1234567890",
        "biomedical_status": "cleared",
        "signed_contract_url": "gs://demo-company/workers/worker-001/contract.pdf",
        "borang100_home_address": "Dhaka, Bangladesh",
        "borang100_parents_names": "Razali Ahmad / Aminah Begum",
        "mdac_verified": True,
        "sev_stamp_verified": True,
        "boarding_pass_url": "gs://demo-company/workers/worker-001/boarding-pass.pdf",
        "fomema_deadline": "2025-05-01",
        "fomema_clinic_code": "MY-FOM-001",
        "fomema_registration_date": "2025-04-08",
        "fomema_attended_date": "2025-04-14",
        "fomema_result": "fit",
        "fomema_result_date": "2025-04-18",
        "biometric_date": "2025-04-21",
        "ikad_number": "IKAD-W001",
        "plks_number": "PLKS-W001",
        "plks_expiry_date": "2026-08-01",
        "passport": {
            "full_name": "Ahmad Bin Razali",
            "passport_number": "A1234567",
            "nationality": "Bangladesh",
            "date_of_birth": "1993-04-12",
            "expiry_date": "2027-03-01",
            "source": "manual",
        },
        "general_information": {
            "sector": "Manufacturing",
            "permit_class": "PLKS",
            "permit_expiry_date": "2026-08-01",
            "address": "Worker hostel A, Shah Alam",
            "emergency_contact_name": "Rahman",
            "emergency_contact_phone": "+880100000001",
        },
        "medical_information": {
            "source": "raw_file",
            "document_type": "fomema_report",
            "result": "fit",
            "exam_date": "2025-04-14",
        },
        "missing_fields": [],
        "created_at": NOW,
        "updated_at": NOW,
    },
    {
        "id": "worker-002",
        "worker_id": "worker-002",
        "company_id": "demo-company",
        "full_name": "Siti Binti Musa",
        "master_name": "Siti Binti Musa",
        "passport_number": "B9876543",
        "nationality": "Indonesia",
        "worker_dob": "1998-10-03",
        "sector": "Services",
        "permit_class": "PLKS",
        "permit_expiry_date": "2026-06-15",
        "passport_expiry_date": "2027-01-01",
        "passport_expiry": "2027-01-01",
        "salary_rm": 1200,
        "status": "active",
        "review_status": "pending_review",
        "workflow_status": "paused",
        "data_status": "needs_review",
        "current_gate": "gate_1_jtksm",
        "arrival_date": "2025-03-15",
        "fomema_status": "Pending",
        "passport_scan_url": "gs://demo-company/workers/worker-002/passport.pdf",
        "passport_photo_url": "gs://demo-company/workers/worker-002/photo.jpg",
        "photo_biometric_compliant": True,
        "biomedical_ref": "BIO9876543210",
        "biomedical_status": "cleared",
        "signed_contract_url": "gs://demo-company/workers/worker-002/contract.pdf",
        "borang100_home_address": "Jakarta, Indonesia",
        "borang100_parents_names": "Musa Rahman / Aisyah Musa",
        "mdac_verified": True,
        "sev_stamp_verified": True,
        "boarding_pass_url": "gs://demo-company/workers/worker-002/boarding-pass.pdf",
        "fomema_deadline": "2025-04-14",
        "fomema_clinic_code": "MY-FOM-002",
        "fomema_registration_date": "2025-03-22",
        "fomema_attended_date": None,
        "fomema_result": "pending",
        "fomema_result_date": None,
        "passport": {
            "full_name": "Siti Binti Musa",
            "passport_number": "B9876543",
            "nationality": "Indonesia",
            "date_of_birth": "1998-10-03",
            "expiry_date": "2027-01-01",
            "source": "manual",
        },
        "general_information": {
            "sector": "Services",
            "permit_class": "PLKS",
            "permit_expiry_date": "2026-06-15",
            "address": "Worker hostel B, Petaling Jaya",
            "emergency_contact_name": "Ibu Musa",
            "emergency_contact_phone": "+62000000002",
        },
        "medical_information": {
            "source": "raw_file",
            "document_type": "fomema_report",
            "result": "pending",
            "exam_date": None,
        },
        "missing_fields": ["fomema_attended_date", "fomema_result_date"],
        "created_at": NOW,
        "updated_at": NOW,
    },
    {
        "id": "worker-003",
        "worker_id": "worker-003",
        "company_id": "demo-company",
        "full_name": "Raju Kumar",
        "master_name": "Raju Kumar",
        "passport_number": "C5551234",
        "nationality": "Nepal",
        "worker_dob": "1990-02-20",
        "sector": "Construction",
        "permit_class": "PLKS",
        "permit_expiry_date": "2025-12-01",
        "passport_expiry_date": "2026-06-01",
        "passport_expiry": "2026-06-01",
        "salary_rm": 1800,
        "status": "active",
        "review_status": "approved",
        "workflow_status": "completed",
        "data_status": "complete",
        "current_gate": "gate_3_jim_vdr",
        "arrival_date": "2025-01-10",
        "fomema_status": "Fit",
        "passport_scan_url": "gs://demo-company/workers/worker-003/passport.pdf",
        "passport_photo_url": "gs://demo-company/workers/worker-003/photo.jpg",
        "photo_biometric_compliant": True,
        "biomedical_ref": "BIO5551234555",
        "biomedical_status": "cleared",
        "signed_contract_url": "gs://demo-company/workers/worker-003/contract.pdf",
        "borang100_home_address": "Kathmandu, Nepal",
        "borang100_parents_names": "Kumar Rai / Maya Rai",
        "mdac_verified": True,
        "sev_stamp_verified": True,
        "boarding_pass_url": "gs://demo-company/workers/worker-003/boarding-pass.pdf",
        "fomema_deadline": "2025-02-09",
        "fomema_clinic_code": "MY-FOM-003",
        "fomema_registration_date": "2025-01-14",
        "fomema_attended_date": "2025-01-20",
        "fomema_result": "fit",
        "fomema_result_date": "2025-01-24",
        "biometric_date": "2025-01-28",
        "ikad_number": "IKAD-W003",
        "plks_number": "PLKS-W003",
        "plks_expiry_date": "2025-12-01",
        "passport": {
            "full_name": "Raju Kumar",
            "passport_number": "C5551234",
            "nationality": "Nepal",
            "date_of_birth": "1990-02-20",
            "expiry_date": "2026-06-01",
            "source": "manual",
        },
        "general_information": {
            "sector": "Construction",
            "permit_class": "PLKS",
            "permit_expiry_date": "2025-12-01",
            "address": "Worker hostel C, Klang",
            "emergency_contact_name": "Maya Rai",
            "emergency_contact_phone": "+977000000003",
        },
        "medical_information": {
            "source": "raw_file",
            "document_type": "fomema_report",
            "result": "fit",
            "exam_date": "2025-01-20",
        },
        "missing_fields": [],
        "created_at": NOW,
        "updated_at": NOW,
    },
]

COMPLIANCE_STATES = {
    "worker-001": {
        "worker_id": "worker-001",
        "company_id": "demo-company",
        "compliance_status": "ACTIVE",
        "deadlock_detected": False,
        "outstanding_fines_rm": 0,
        "flags": [],
        "health_score": 100,
        "gate_jtksm": "approved",
        "gate_vdr": "approved",
        "gate_fomema": "fit",
        "updated_at": NOW,
    },
    "worker-002": {
        "worker_id": "worker-002",
        "company_id": "demo-company",
        "compliance_status": "ONBOARDING",
        "deadlock_detected": False,
        "outstanding_fines_rm": 0,
        "flags": ["fomema_due"],
        "health_score": 70,
        "gate_jtksm": "pending",
        "gate_vdr": "pending",
        "gate_fomema": "pending",
        "updated_at": NOW,
    },
    "worker-003": {
        "worker_id": "worker-003",
        "company_id": "demo-company",
        "compliance_status": "RENEWAL_PENDING",
        "deadlock_detected": False,
        "outstanding_fines_rm": 0,
        "flags": [],
        "health_score": 85,
        "gate_jtksm": "approved",
        "gate_vdr": "approved",
        "gate_fomema": "fit",
        "updated_at": NOW,
    },
}

WORKER_TASKS = {
    "worker-001": [
        {"task_type": "SOCSO_REGISTRATION", "task_name": "Register with SOCSO", "status": "completed", "node_type": "ComplianceCheck", "depends_on": [], "confidence_score": 0.95, "reasoning": "Worker arrived, SOCSO registration completed within 30 days."},
        {"task_type": "FOMEMA_SCREENING", "task_name": "FOMEMA Medical Screening", "status": "completed", "node_type": "DocumentAudit", "depends_on": ["SOCSO_REGISTRATION"], "confidence_score": 0.92, "reasoning": "FOMEMA fit result confirmed."},
        {"task_type": "LEVY_PAYMENT", "task_name": "Pay Annual MTLM Levy", "status": "in_progress", "node_type": "CalculateFines", "depends_on": ["FOMEMA_SCREENING"], "confidence_score": 0.88, "reasoning": "Levy RM 590/yr for Manufacturing sector.", "tool_payload": {"levy_amount": "RM 590", "sector": "Manufacturing", "worker_id": "worker-001", "channel": "MyEG"}},
        {"task_type": "IKAD_ISSUANCE", "task_name": "iKAD Enrollment", "status": "pending", "node_type": "ComplianceCheck", "depends_on": ["LEVY_PAYMENT"], "confidence_score": 0.80, "reasoning": "iKAD required after levy payment."},
    ],
    "worker-002": [
        {"task_type": "FOMEMA_SCREENING", "task_name": "FOMEMA Medical Screening", "status": "blocked", "node_type": "DocumentAudit", "depends_on": [], "confidence_score": 0.60, "reasoning": "FOMEMA overdue after arrival; human review required."},
    ],
    "worker-003": [
        {"task_type": "PERMIT_RENEWAL", "task_name": "Renew Work Permit", "status": "awaiting_approval", "node_type": "ComplianceCheck", "depends_on": [], "confidence_score": 0.90, "reasoning": "Permit expiry is approaching.", "tool_payload": {"permit_class": "PLKS", "worker_id": "worker-003", "expiry": "2025-12-01", "channel": "MyEG"}},
    ],
}

WORKFLOWS = {
    "worker-001": {
        "worker_id": "worker-001",
        "company_id": "demo-company",
        "status": "active",
        "current_node": "compliance_reasoner_node",
        "pipeline_status": "running",
        "started_at": NOW,
        "last_updated": NOW,
        "current_state": {
            "worker_id": "worker-001",
            "company_id": "demo-company",
            "full_name": "Ahmad Bin Razali",
            "nationality": "Bangladesh",
            "sector": "Manufacturing",
            "current_gate": "gate_2_kdn",
            "compliance_status": "ACTIVE",
            "hitl_required": False,
            "workflow_complete": False,
            "alerts": [],
            "agent_observations": ["[Supervisor] Routing to VDR filing", "[Auditor] Passport valid, no fines"],
            "documents_validated": True,
            "current_agent": "compliance_reasoner",
        },
    },
    "worker-002": {
        "worker_id": "worker-002",
        "company_id": "demo-company",
        "status": "active",
        "current_node": "hitl_interrupt_node",
        "pipeline_status": "paused",
        "started_at": NOW,
        "last_updated": NOW,
        "current_state": {
            "worker_id": "worker-002",
            "company_id": "demo-company",
            "full_name": "Siti Binti Musa",
            "nationality": "Indonesia",
            "sector": "Services",
            "current_gate": "gate_1_jtksm",
            "compliance_status": "ONBOARDING",
            "hitl_required": True,
            "hitl_reason": "fomema_pending_requires_review",
            "hitl_data": {"fomema_status": "Pending", "days_since_arrival": 41},
            "workflow_complete": False,
            "alerts": [{"type": "fomema_due", "severity": "high", "message": "FOMEMA screening overdue."}],
            "agent_observations": ["[Auditor] FOMEMA pending after arrival", "[HITL] Interrupt raised"],
            "documents_validated": True,
            "current_agent": "hitl",
        },
    },
    "worker-003": {
        "worker_id": "worker-003",
        "company_id": "demo-company",
        "status": "completed",
        "current_node": "filing_node",
        "pipeline_status": "completed",
        "started_at": NOW,
        "last_updated": NOW,
        "current_state": {
            "worker_id": "worker-003",
            "company_id": "demo-company",
            "full_name": "Raju Kumar",
            "nationality": "Nepal",
            "sector": "Construction",
            "current_gate": "gate_3_jim_vdr",
            "compliance_status": "RENEWAL_PENDING",
            "hitl_required": False,
            "workflow_complete": True,
            "alerts": [],
            "agent_observations": ["[Strategist] Levy calculated", "[Filing] Renewal pending"],
            "documents_validated": True,
            "current_agent": "filing",
        },
    },
}

TRACE_BY_WORKER = {
    "worker-001": [
        {"node": "supervisor_node", "status": "completed", "timestamp": NOW, "output_summary": "Routing to audit_documents", "error": None},
        {"node": "auditor_node", "status": "completed", "timestamp": NOW, "output_summary": "0 alerts, 0 missing docs", "error": None},
        {"node": "company_audit_node", "status": "completed", "timestamp": NOW, "output_summary": "Gate approved, 0 blockers", "error": None},
        {"node": "compliance_reasoner_node", "status": "running", "timestamp": NOW, "output_summary": None, "error": None},
    ],
    "worker-002": [
        {"node": "supervisor_node", "status": "completed", "timestamp": NOW, "output_summary": "Routing to audit_documents", "error": None},
        {"node": "auditor_node", "status": "completed", "timestamp": NOW, "output_summary": "1 alert: FOMEMA overdue", "error": None},
        {"node": "hitl_interrupt_node", "status": "completed", "timestamp": NOW, "output_summary": "HITL interrupt raised", "error": None},
    ],
    "worker-003": [
        {"node": "supervisor_node", "status": "completed", "timestamp": NOW, "output_summary": "Routing to audit_documents", "error": None},
        {"node": "auditor_node", "status": "completed", "timestamp": NOW, "output_summary": "0 alerts, 0 missing docs", "error": None},
        {"node": "strategist_node", "status": "completed", "timestamp": NOW, "output_summary": "Strategy calculated", "error": None},
        {"node": "filing_node", "status": "completed", "timestamp": NOW, "output_summary": "Renewal pending", "error": None},
    ],
}

PENDING_HANDOFFS = [
    {
        "worker_id": "worker-001",
        "company_id": "demo-company",
        "action_type": "submit_imm47",
        "triggered_by": "vdr_assembler_node",
        "payload": {"worker_name": "Ahmad Bin Razali", "passport_no": "A1234567", "form": "IMM.47", "nationality": "Bangladesh", "sector": "Manufacturing", "levy_status": "paid", "fomema_result": "Fit"},
        "status": "awaiting_confirmation",
        "simulated": True,
        "created_at": NOW,
    },
    {
        "worker_id": "worker-003",
        "company_id": "demo-company",
        "action_type": "trigger_levy_record",
        "triggered_by": "strategist_node",
        "payload": {"worker_name": "Raju Kumar", "levy_amount_rm": 1850, "sector": "Construction", "channel": "MyEG"},
        "status": "awaiting_confirmation",
        "simulated": True,
        "created_at": NOW,
    },
]

OBLIGATION_DEFS = [
    ("passport", "Passport renewal", "passport_expiry_date", "Renew worker passport before expiry."),
    ("permit", "Permit renewal", "permit_expiry_date", "Renew work permit / PLKS before expiry."),
    ("health", "Annual health checkup", "next_health_check_date", "Annual medical checkup requirement."),
]

NEXT_HEALTH_CHECKS = {
    "worker-001": "2026-07-15",
    "worker-002": "2026-05-20",
    "worker-003": "2026-04-05",
}


def delete_collection(collection_name, batch_size=100):
    col_ref = db.collection(collection_name)
    deleted = 0

    while True:
        docs = list(col_ref.limit(batch_size).stream())
        if not docs:
            break

        for doc in docs:
            for subcollection in doc.reference.collections():
                delete_subcollection(subcollection, batch_size=batch_size)
            doc.reference.delete()
            deleted += 1

    return deleted


def delete_subcollection(col_ref, batch_size=100):
    while True:
        docs = list(col_ref.limit(batch_size).stream())
        if not docs:
            break

        for doc in docs:
            for subcollection in doc.reference.collections():
                delete_subcollection(subcollection, batch_size=batch_size)
            doc.reference.delete()


def seed_companies():
    for company in COMPANIES:
        data = copy.deepcopy(company)
        company_id = data.pop("id")
        data["worker_ids"] = [worker["id"] for worker in WORKERS if worker["company_id"] == company_id]
        db.collection("companies").document(company_id).set(data)
        print(f"Seeded company: {company_id}")


def seed_workers():
    for worker in WORKERS:
        data = copy.deepcopy(worker)
        worker_id = data.pop("id")
        next_health_check = NEXT_HEALTH_CHECKS.get(worker_id)
        if next_health_check:
            data["next_health_check_date"] = next_health_check
        db.collection("workers").document(worker_id).set(data)
        print(f"Seeded worker: {worker_id}")

        for idx, task in enumerate(WORKER_TASKS.get(worker_id, []), start=1):
            task_data = copy.deepcopy(task)
            task_data.update({"worker_id": worker_id, "company_id": data["company_id"], "created_at": NOW})
            db.collection("workers").document(worker_id).collection("tasks").document(f"task-{idx:02d}").set(task_data)
        print(f"  Seeded tasks: {len(WORKER_TASKS.get(worker_id, []))}")


def seed_workflows():
    for worker_id, workflow in WORKFLOWS.items():
        data = copy.deepcopy(workflow)
        data["trace"] = copy.deepcopy(TRACE_BY_WORKER.get(worker_id, []))
        db.collection("workflows").document(worker_id).set(data)
        print(f"Seeded workflow: {worker_id}")

        stream_state = {
            "worker_id": worker_id,
            "company_id": data["company_id"],
            "current_node": data["current_node"],
            "pipeline_status": data["pipeline_status"],
            "latest_event": data["trace"][-1] if data["trace"] else None,
            "updated_at": NOW,
        }
        db.collection("langgraph_streams").document(worker_id).set(stream_state)

        for idx, event in enumerate(data["trace"], start=1):
            event_data = copy.deepcopy(event)
            event_data.update({"worker_id": worker_id, "company_id": data["company_id"]})
            db.collection("langgraph_events").document(f"{worker_id}-{idx:02d}").set(event_data)


def seed_status_records():
    for worker_id, state in COMPLIANCE_STATES.items():
        db.collection("compliance_state").document(worker_id).set(copy.deepcopy(state))
        print(f"Seeded compliance state: {worker_id}")

    for worker in WORKERS:
        worker_id = worker["id"]
        base = {
            "worker_id": worker_id,
            "company_id": worker["company_id"],
            "full_name": worker["full_name"],
            "passport_number": worker["passport_number"],
            "nationality": worker["nationality"],
            "sector": worker["sector"],
            "source": "seed",
            "created_at": NOW,
            "updated_at": NOW,
        }
        db.collection("vdr_applications").document(worker_id).set({
            **base,
            "status": "approved" if worker_id != "worker-002" else "pending",
            "vdr_reference": f"VDR-{worker_id.upper()}",
            "submitted_at": NOW,
        })
        db.collection("plks_applications").document(worker_id).set({
            **base,
            "status": "issued" if worker.get("plks_number") else "pending",
            "plks_number": worker.get("plks_number"),
            "expiry_date": worker.get("plks_expiry_date") or worker["permit_expiry_date"],
        })
        db.collection("mock_gov_records").document(worker_id).set({
            "worker_id": worker_id,
            "company_id": worker["company_id"],
            "salary": worker["salary_rm"],
            "permit_expiry": worker["permit_expiry_date"],
            "fomema_status": worker["fomema_status"].lower(),
            "levy_status": "paid" if worker_id == "worker-003" else "unpaid",
            "source": "mock",
            "last_updated": NOW,
        })
        print(f"Seeded VDR/PLKS/mock gov records: {worker_id}")


def seed_obligations():
    count = 0
    for worker in WORKERS:
        for obligation_type, title, date_key, description in OBLIGATION_DEFS:
            date_value = NEXT_HEALTH_CHECKS.get(worker["id"]) if date_key == "next_health_check_date" else worker.get(date_key)
            if not date_value:
                continue
            obligation_id = f"{worker['id']}-{obligation_type}"
            db.collection("worker_obligations").document(obligation_id).set({
                "worker_id": worker["id"],
                "company_id": worker["company_id"],
                "type": obligation_type,
                "title": title,
                "date": date_value,
                "status": "Upcoming",
                "description": description,
                "created_at": NOW,
                "updated_at": NOW,
            })
            count += 1
    print(f"Seeded worker obligations: {count}")


def seed_handoffs():
    for idx, handoff in enumerate(PENDING_HANDOFFS, start=1):
        db.collection("pending_handoffs").document(f"handoff-{idx:02d}").set(copy.deepcopy(handoff))
        print(f"Seeded handoff: handoff-{idx:02d}")


def reconstruct(apply=False):
    print("PermitIQ Firestore reconstruction")
    print("Mode:", "APPLY" if apply else "DRY RUN")
    print("Collections reset:", ", ".join(RESET_COLLECTIONS))

    if not apply:
        print("\nDry run only. Re-run with --apply to delete/reseed Firebase.")
        return

    for collection_name in RESET_COLLECTIONS:
        deleted = delete_collection(collection_name)
        print(f"Deleted {deleted} docs from {collection_name}")

    seed_companies()
    seed_workers()
    seed_workflows()
    seed_status_records()
    seed_obligations()
    seed_handoffs()

    db.collection("reconstruction_metadata").document("latest").set({
        "schema": "no-auth-company-worker-portal",
        "company_count": len(COMPANIES),
        "worker_count": len(WORKERS),
        "reset_collections": RESET_COLLECTIONS,
        "updated_at": NOW,
    })

    print("\nDone. Firebase now matches the no-auth company/worker portal design.")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--apply", action="store_true", help="Actually delete and reseed Firebase.")
    args = parser.parse_args()
    reconstruct(apply=args.apply)


if __name__ == "__main__":
    main()
