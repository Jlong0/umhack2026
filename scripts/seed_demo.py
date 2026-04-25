"""
Seed all demo data for showcase pages.
Run: python -m scripts.seed_demo
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from datetime import datetime, timezone
from app.firebase_config import db

NOW = datetime.now(timezone.utc).isoformat()

WORKERS = [
    {
        "id": "worker-001",
        "full_name": "Ahmad Bin Razali",
        "passport_number": "A1234567",
        "nationality": "Bangladesh",
        "sector": "Manufacturing",
        "permit_class": "PLKS",
        "permit_expiry_date": "2026-08-01",
        "passport_expiry_date": "2027-03-01",
        "fomema_status": "Fit",
        "salary_rm": 1500,
        "status": "active",
        "arrival_date": "2025-04-01",
        "company_id": "demo-company",
        "current_gate": "gate_2_kdn",
        "passport": {"full_name": "Ahmad Bin Razali", "passport_number": "A1234567", "nationality": "Bangladesh"},
        "general_information": {"sector": "Manufacturing", "permit_class": "PLKS", "permit_expiry_date": "2026-08-01"},
    },
    {
        "id": "worker-002",
        "full_name": "Siti Binti Musa",
        "passport_number": "B9876543",
        "nationality": "Indonesia",
        "sector": "Services",
        "permit_class": "PLKS",
        "permit_expiry_date": "2026-06-15",
        "passport_expiry_date": "2027-01-01",
        "fomema_status": "Pending",
        "salary_rm": 1200,
        "status": "active",
        "arrival_date": "2025-03-15",
        "company_id": "demo-company",
        "current_gate": "gate_1_jtksm",
        "passport": {"full_name": "Siti Binti Musa", "passport_number": "B9876543", "nationality": "Indonesia"},
        "general_information": {"sector": "Services", "permit_class": "PLKS", "permit_expiry_date": "2026-06-15"},
    },
    {
        "id": "worker-003",
        "full_name": "Raju Kumar",
        "passport_number": "C5551234",
        "nationality": "Nepal",
        "sector": "Construction",
        "permit_class": "PLKS",
        "permit_expiry_date": "2025-12-01",
        "passport_expiry_date": "2026-06-01",
        "fomema_status": "Fit",
        "salary_rm": 1800,
        "status": "active",
        "arrival_date": "2025-01-10",
        "company_id": "demo-company",
        "current_gate": "gate_3_jim_vdr",
        "passport": {"full_name": "Raju Kumar", "passport_number": "C5551234", "nationality": "Nepal"},
        "general_information": {"sector": "Construction", "permit_class": "PLKS", "permit_expiry_date": "2025-12-01"},
    },
]

WORKFLOWS = [
    {
        "worker_id": "worker-001",
        "status": "active",
        "current_node": "compliance_reasoner_node",
        "pipeline_status": "running",
        "started_at": NOW,
        "last_updated": NOW,
        "current_state": {
            "worker_id": "worker-001",
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
        "trace": [
            {"node": "supervisor_node", "status": "completed", "timestamp": NOW, "output_summary": "Routing to audit_documents", "error": None},
            {"node": "auditor_node", "status": "completed", "timestamp": NOW, "output_summary": "0 alerts, 0 missing docs", "error": None},
            {"node": "company_audit_node", "status": "completed", "timestamp": NOW, "output_summary": "Gate: approved, 0 blockers", "error": None},
            {"node": "compliance_reasoner_node", "status": "running", "timestamp": NOW, "output_summary": None, "error": None},
        ],
    },
    {
        "worker_id": "worker-002",
        "status": "active",
        "current_node": "hitl_interrupt_node",
        "pipeline_status": "paused",
        "started_at": NOW,
        "last_updated": NOW,
        "current_state": {
            "worker_id": "worker-002",
            "full_name": "Siti Binti Musa",
            "nationality": "Indonesia",
            "sector": "Services",
            "current_gate": "gate_1_jtksm",
            "compliance_status": "ONBOARDING",
            "hitl_required": True,
            "hitl_reason": "fomema_pending_requires_review",
            "hitl_data": {"fomema_status": "Pending", "days_since_arrival": 41},
            "workflow_complete": False,
            "alerts": [{"type": "fomema_due", "severity": "high", "message": "FOMEMA screening overdue — Day 41"}],
            "agent_observations": ["[Auditor] FOMEMA pending after 41 days", "[HITL] Interrupt raised"],
            "documents_validated": True,
            "current_agent": "hitl",
        },
        "trace": [
            {"node": "supervisor_node", "status": "completed", "timestamp": NOW, "output_summary": "Routing to audit_documents", "error": None},
            {"node": "auditor_node", "status": "completed", "timestamp": NOW, "output_summary": "1 alert: FOMEMA overdue", "error": None},
            {"node": "hitl_interrupt_node", "status": "completed", "timestamp": NOW, "output_summary": "HITL interrupt raised", "error": None},
        ],
    },
    {
        "worker_id": "worker-003",
        "status": "completed",
        "current_node": "filing_node",
        "pipeline_status": "completed",
        "started_at": NOW,
        "last_updated": NOW,
        "current_state": {
            "worker_id": "worker-003",
            "full_name": "Raju Kumar",
            "nationality": "Nepal",
            "sector": "Construction",
            "current_gate": "gate_3_jim_vdr",
            "compliance_status": "RENEWAL_PENDING",
            "hitl_required": False,
            "workflow_complete": True,
            "alerts": [],
            "agent_observations": ["[Strategist] Levy calculated: RM 1850/yr", "[Filing] Renewal pending"],
            "documents_validated": True,
            "current_agent": "filing",
        },
        "trace": [
            {"node": "supervisor_node", "status": "completed", "timestamp": NOW, "output_summary": "Routing to audit_documents", "error": None},
            {"node": "auditor_node", "status": "completed", "timestamp": NOW, "output_summary": "0 alerts, 0 missing docs", "error": None},
            {"node": "strategist_node", "status": "completed", "timestamp": NOW, "output_summary": "Strategy calculated", "error": None},
            {"node": "filing_node", "status": "completed", "timestamp": NOW, "output_summary": "Renewal pending", "error": None},
        ],
    },
]

COMPLIANCE_STATES = [
    {"worker_id": "worker-001", "compliance_status": "ACTIVE", "deadlock_detected": False, "outstanding_fines_rm": 0, "flags": [], "health_score": 100, "gate_jtksm": "approved", "gate_vdr": "approved", "updated_at": NOW},
    {"worker_id": "worker-002", "compliance_status": "ONBOARDING", "deadlock_detected": False, "outstanding_fines_rm": 0, "flags": ["fomema_due"], "health_score": 70, "gate_jtksm": "pending", "updated_at": NOW},
    {"worker_id": "worker-003", "compliance_status": "RENEWAL_PENDING", "deadlock_detected": False, "outstanding_fines_rm": 0, "flags": [], "health_score": 85, "gate_jtksm": "approved", "gate_vdr": "approved", "gate_fomema": "fit", "updated_at": NOW},
]

WORKER_TASKS = {
    "worker-001": [
        {"task_type": "SOCSO_REGISTRATION", "task_name": "Register with SOCSO", "status": "completed", "node_type": "ComplianceCheck", "depends_on": [], "confidence_score": 0.95, "reasoning": "Worker arrived, SOCSO registration required within 30 days", "created_at": NOW},
        {"task_type": "FOMEMA_SCREENING", "task_name": "FOMEMA Medical Screening", "status": "completed", "node_type": "DocumentAudit", "depends_on": ["SOCSO_REGISTRATION"], "confidence_score": 0.92, "reasoning": "FOMEMA Fit result confirmed", "created_at": NOW},
        {"task_type": "LEVY_PAYMENT", "task_name": "Pay Annual MTLM Levy", "status": "IN_PROGRESS", "node_type": "CalculateFines", "depends_on": ["FOMEMA_SCREENING"], "confidence_score": 0.88, "reasoning": "Levy RM 590/yr for Manufacturing sector", "tool_payload": {"levy_amount": "RM 590", "sector": "Manufacturing", "worker_id": "worker-001", "channel": "MyEG"}, "created_at": NOW},
        {"task_type": "IKAD_ISSUANCE", "task_name": "iKAD Enrollment", "status": "pending", "node_type": "ComplianceCheck", "depends_on": ["LEVY_PAYMENT"], "confidence_score": 0.80, "reasoning": "iKAD required after levy payment", "created_at": NOW},
    ],
    "worker-002": [
        {"task_type": "FOMEMA_SCREENING", "task_name": "FOMEMA Medical Screening", "status": "BLOCKED_HITL", "node_type": "DocumentAudit", "depends_on": [], "confidence_score": 0.60, "reasoning": "FOMEMA overdue — 41 days since arrival", "created_at": NOW},
    ],
    "worker-003": [
        {"task_type": "PERMIT_RENEWAL", "task_name": "Renew Work Permit", "status": "awaiting_approval", "node_type": "ComplianceCheck", "depends_on": [], "confidence_score": 0.90, "reasoning": "Permit expires 2025-12-01, renewal required", "tool_payload": {"permit_class": "PLKS", "worker_id": "worker-003", "expiry": "2025-12-01", "channel": "MyEG"}, "created_at": NOW},
    ],
}

MOCK_GOV_RECORDS = [
    {"worker_id": "worker-001", "salary": 1200, "permit_expiry": "2025-08-01", "fomema_status": "pending", "levy_status": "unpaid", "source": "mock", "last_updated": NOW},
    {"worker_id": "worker-002", "salary": 1200, "permit_expiry": "2026-06-15", "fomema_status": "pending", "levy_status": "unpaid", "source": "mock", "last_updated": NOW},
    {"worker_id": "worker-003", "salary": 1800, "permit_expiry": "2025-12-01", "fomema_status": "fit", "levy_status": "paid", "source": "mock", "last_updated": NOW},
]

PENDING_HANDOFFS = [
    {
        "worker_id": "worker-001",
        "action_type": "submit_imm47",
        "triggered_by": "vdr_assembler_node",
        "payload": {"worker_name": "Ahmad Bin Razali", "passport_no": "A1234567", "form": "IMM.47", "nationality": "Bangladesh", "sector": "Manufacturing", "levy_status": "paid", "fomema_result": "Fit"},
        "status": "awaiting_confirmation",
        "simulated": True,
        "created_at": NOW,
    },
    {
        "worker_id": "worker-003",
        "action_type": "trigger_levy_record",
        "triggered_by": "strategist_node",
        "payload": {"worker_name": "Raju Kumar", "levy_amount_rm": 1850, "sector": "Construction", "channel": "MyEG"},
        "status": "awaiting_confirmation",
        "simulated": True,
        "created_at": NOW,
    },
]

COMPANY = {
    "id": "demo-company",
    "company_name": "Titan Core Technologies Sdn. Bhd.",
    "roc_number": "202401887766",
    "jtksm_60k_status": "approved",
    "act_446_expiry_date": "2027-01-01",
    "ssm_registration_valid": True,
    "quota_balance": {"Manufacturing": 10, "Services": 5, "Construction": 8},
}


def seed():
    # Workers
    for w in WORKERS:
        wid = w.pop("id")
        db.collection("workers").document(wid).set(w)
        print(f"Worker: {wid}")

    # Worker tasks (subcollection)
    for worker_id, tasks in WORKER_TASKS.items():
        for task in tasks:
            db.collection("workers").document(worker_id).collection("tasks").add(task)
        print(f"Tasks for {worker_id}: {len(tasks)}")

    # Workflows
    for wf in WORKFLOWS:
        wid = wf["worker_id"]
        db.collection("workflows").document(wid).set(wf)
        print(f"Workflow: {wid}")

    # Compliance states
    for cs in COMPLIANCE_STATES:
        wid = cs["worker_id"]
        db.collection("compliance_state").document(wid).set(cs)
        print(f"Compliance state: {wid}")

    # Mock gov records
    for rec in MOCK_GOV_RECORDS:
        wid = rec["worker_id"]
        db.collection("mock_gov_records").document(wid).set(rec)
        print(f"Mock gov record: {wid}")

    # Pending handoffs
    for h in PENDING_HANDOFFS:
        db.collection("pending_handoffs").add(h)
        print(f"Handoff: {h['action_type']} for {h['worker_id']}")

    # Company
    db.collection("companies").document(COMPANY["id"]).set({k: v for k, v in COMPANY.items() if k != "id"})
    print(f"Company: {COMPANY['id']}")

    print("\nDone. All demo data seeded.")


if __name__ == "__main__":
    seed()
