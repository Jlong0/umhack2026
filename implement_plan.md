## PermitIQ — Full Enhancement Plan v2.0

---

## 1. System Architecture


┌─────────────────────────────────────────────────────────────────────┐
│                         FRONTEND (React + Tailwind)                  │
│  /company  /ingestion  /vdr  /plks  /workflows  /hitl  /dashboard   │
│  /alerts   /simulator  /worker-visualizer  /analytics               │
└──────────────────────────┬──────────────────────────────────────────┘
                           │ REST + WebSocket
┌──────────────────────────▼──────────────────────────────────────────┐
│                         FASTAPI (Backend)                            │
│                                                                      │
│  Routers:                                                            │
│  /documents  /workers  /companies  /agents  /compliance              │
│  /vdr  /plks  /analytics  /simulator  /alerts                       │
│                                                                      │
│  Services Layer:                                                     │
│  Triage  │  VDRService  │  PLKSService  │  ComplianceReasoning      │
│  LevyService  │  FOEMAService  │  BiometricService                  │
└──────┬───────────────┬──────────────────┬───────────────────────────┘
       │               │                  │
┌──────▼──────┐ ┌──────▼──────┐ ┌────────▼────────────────────────┐
│   Celery    │ │  LangGraph  │ │         Firebase                 │
│   Workers   │ │  Agents     │ │  Firestore  │  Storage           │
│             │ │  Supervisor │ │  workers    │  documents/        │
│  parse_job  │ │  Auditor    │ │  companies  │  vdr/              │
│  sweep      │ │  Strategist │ │  compliance │  plks/             │
│  vdr_check  │ │  Filing     │ │  tasks      │  fomema/           │
│  fomema     │ │             │ │  vdr_apps   │  contracts/        │
│  plks       │ │             │ │  plks_apps  │                    │
└──────┬──────┘ └──────┬──────┘ └────────┬────────────────────────┘
       │               │                  │
┌──────▼───────────────▼──────────────────▼───────────────────────────┐
│                         Redis Cache                                  │
│  compliance_state (60s)  │  levy_results (24h)  │  agent_locks      │
│  vdr_status (30s)        │  fomema_status (30s) │  job_dedup        │
└─────────────────────────────────────────────────────────────────────┘


---

## 2. Firestore Collection Schema (Enhanced)


companies/{company_id}
  ├── ssm_number
  ├── jtksm_60k_status: "approved" | "expired" | "none"
  ├── act_446_cert_id
  ├── act_446_expiry_date
  ├── quota_balance: { MFG: 10, CON: 5, SVC: 3 }
  ├── total_local_headcount
  ├── total_foreign_headcount
  ├── myfuturejobs_account_id
  └── created_at / updated_at

workers/{worker_id}
  ├── passport_no
  ├── full_name
  ├── nationality
  ├── ep_category: "I"|"II"|"III"|"plks"|null
  ├── salary
  ├── sector
  ├── job_title
  ├── company_id
  ├── thread_id
  ├── gate_stage: "jtksm"|"vdr"|"transit"|"fomema"|"plks"|"active"
  ├── status: "pending"|"in_progress"|"hitl_pending"|"active"|"repatriated"
  ├── vdr_reference_number
  ├── arrival_date
  ├── fomema_deadline        ← auto: arrival_date + 30 days
  ├── fomema_registration_date
  ├── fomema_attended_date
  ├── fomema_result: "fit"|"unfit"|"pending"|null
  ├── plks_number
  ├── plks_issue_date
  ├── plks_expiry_date
  ├── ikad_status: "pending"|"issued"|null
  ├── biometric_done: bool
  ├── mdac_verified: bool
  ├── employment_start_date
  ├── contract_signed: bool
  └── created_at / updated_at

  subcollection: tasks/
    ├── type: "vdr"|"fomema"|"plks"|"hitl"|"renewal"|"alert"|"filing"
    ├── status: "pending"|"in_progress"|"done"|"blocked"|"overdue"
    ├── priority: "critical"|"high"|"mandatory"|"final"
    ├── depends_on: [task_ids]
    ├── due_date
    ├── payload: {}
    └── created_at

  subcollection: agent_checkpoints/
    ├── thread_id
    ├── graph_state: {}
    ├── node_name
    └── created_at

vdr_applications/{vdr_id}
  ├── worker_id
  ├── company_id
  ├── status: "draft"|"docs_pending"|"biomedical_pending"|"ready"|"submitted"|"approved"|"rejected"
  ├── passport_scan_url
  ├── passport_photo_url
  ├── photo_biometric_compliant: bool
  ├── home_address: {}
  ├── emergency_contact: {}
  ├── marital_status
  ├── signed_contract_url
  ├── biomedical_ref_number
  ├── biomedical_status: "pending"|"fit"|"unfit"
  ├── imm47_payload: {}           ← auto-generated form fields
  ├── succession_plan_url          ← required for EP-II/III
  ├── academic_certs_urls: []      ← required for EP
  ├── checklist: []
  └── created_at / updated_at

plks_applications/{plks_id}
  ├── worker_id
  ├── vdr_id
  ├── status: "pending_arrival"|"mdac_verified"|"fomema_registered"|
  │          "fomema_attended"|"fomema_fit"|"fomema_unfit"|
  │          "endorsement_pending"|"plks_issued"|"ikad_issued"
  ├── mdac_verified: bool
  ├── mdac_date
  ├── sev_stamp_verified: bool
  ├── boarding_pass_url
  ├── fomema_clinic_code
  ├── fomema_registration_date
  ├── fomema_attended_date
  ├── fomema_result
  ├── fomema_result_date
  ├── com_triggered: bool          ← Check Out Memo if unfit
  ├── biometric_date
  ├── ikad_number
  └── created_at / updated_at

compliance_state/{worker_id}
  ├── gate_jtksm: "pending"|"approved"|"rejected"
  ├── gate_vdr: "pending"|"docs_pending"|"approved"|"rejected"
  ├── gate_fomema: "pending"|"registered"|"attended"|"fit"|"unfit"
  ├── gate_plks: "pending"|"endorsed"|"issued"
  ├── expiry_date
  ├── passport_expiry_date
  ├── levy_tier: "1"|"2"|"3"
  ├── fomema_status
  ├── ep_salary_compliant: bool
  ├── overstay_days: int
  ├── health_score: 0–100
  ├── flags: []
  ├── last_swept_at
  └── updated_at

reference/vdr_checklist
  ├── required_docs: []
  ├── biometric_photo_rules: {}
  ├── passport_min_validity_months: 18
  └── ep_additional_docs: []

reference/plks_checklist
  ├── post_arrival_tasks: []
  ├── fomema_window_days: 30
  ├── fomema_registration_window_days: 7
  └── com_trigger_conditions: []


---

## 3. Gate Stage State Machine


[JTKSM Gate]
     │
     │  60K approval + Act 446 cert verified
     ▼
[VDR Stage] ◄─────────────────────────────────┐
     │                                         │
     │  Sub-states:                            │
     │  docs_pending → biomedical_pending      │
     │  → levy_payment → submitted → approved  │  REJECTED
     ▼                                         │  (loop back)
[TRANSIT]
     │
     │  Worker boards flight
     ▼
[FOMEMA Stage]
     │
     │  Sub-states:
     │  registered → attended → fit ──────────────┐
     │                       → unfit              │
     │                            │               │
     │                            ▼               │
     │                    [COM Triggered]          │
     │                    [Repatriation]           │
     ▼                                            │
[PLKS Endorsement] ◄────────────────────────────┘
     │
     │  passport_endorsed → ikad_issued
     ▼
[ACTIVE WORKER]
     │
     │  (compliance monitoring loop begins)
     ▼
[RENEWAL / EXPIRY] ──► back to VDR stage


---

## 4. Backend Enhancement Plan

### New API Endpoints


COMPANY GATE (JTKSM)
POST   /companies/{id}/upload-cert          → Upload Act 446 / 60K cert
POST   /compliance/check-gate/{gate_name}   → Auditor Agent validates gate
GET    /companies/{id}/quota-balance        → Current quota by sector

VDR STAGE
POST   /vdr/applications                    → Create VDR application
POST   /vdr/{vdr_id}/upload/{doc_type}      → Upload passport/photo/contract/certs
POST   /vdr/{vdr_id}/verify-biomedical      → Ping FWCMS with biomedical_ref_number
POST   /vdr/{vdr_id}/validate-photo         → Check biometric compliance
POST   /vdr/{vdr_id}/generate-imm47         → Auto-fill visa form from Firestore data
POST   /vdr/{vdr_id}/prepare-filing         → Filing Agent generates task list
GET    /vdr/{vdr_id}/checklist              → Returns checklist status per item
GET    /vdr/{vdr_id}/status                 → Full VDR application state

PLKS STAGE
POST   /plks/applications                   → Create PLKS app (post-arrival)
POST   /plks/{plks_id}/verify-mdac          → Log MDAC arrival card verification
POST   /plks/{plks_id}/register-fomema      → Register worker at FOMEMA clinic
PATCH  /plks/{plks_id}/fomema-result        → Update Fit/Unfit result
POST   /plks/{plks_id}/trigger-com          → Generate Check Out Memo if Unfit
POST   /plks/{plks_id}/confirm-biometrics   → Mark biometric capture done
GET    /plks/{plks_id}/status               → Full PLKS pipeline state

MEDICAL (ENHANCED)
POST   /workers/{id}/verify-medical         → Extract Bio-Medical Ref from doc
GET    /workers/{id}/fomema-timeline        → registered → attended → result

ANALYTICS
GET    /analytics/levy-forecast             → MTLM projection from active workers
GET    /analytics/gate-bottlenecks          → Where workers are getting stuck
GET    /analytics/repatriation-risk         → Workers with FOMEMA risk factors


### New Service Layer

python
# app/services/vdr_service.py
class VDRService:
    async def create_application(company_id, worker_id) -> vdr_id
    async def validate_passport_photo(photo_bytes) -> {compliant, issues[]}
    async def ping_biomedical_database(ref_no, passport_no) -> {status, fit}
    async def generate_imm47_payload(vdr_id) -> {form_fields}
    async def get_checklist_status(vdr_id) -> {items[], complete_count, total}
    async def check_succession_plan_required(ep_category) -> bool

# app/services/plks_service.py
class PLKSService:
    async def verify_mdac(worker_id, arrival_date) -> {verified, fomema_deadline}
    async def register_fomema(worker_id, clinic_code) -> {registration_date}
    async def update_fomema_result(plks_id, result) -> {next_action}
    async def trigger_com(worker_id) -> {com_document_url}
    async def calculate_fomema_deadline(arrival_date) -> timestamp

# app/services/compliance_reasoning_service.py  [UNWIRE MOCK]
class ComplianceReasoningService:
    async def generate_obligations(worker_id, confirmed_fields) -> tasks[]
    async def evaluate_gate_readiness(gate_name, worker_id) -> {ready, blockers[]}
    async def detect_june_deadline_risk(worker_id) -> {at_risk, salary_gap}
    async def write_agent_findings(worker_id, findings) -> None  ← NEW


### New Celery Tasks

python
# app/workers/tasks.py additions

@celery.task
def check_biomedical_status(vdr_id, passport_no, biomedical_ref):
    # Poll FWCMS for biomedical result
    # Update vdr_applications/{vdr_id}.biomedical_status
    # If "fit" → unblock levy payment task
    # If "unfit" → create HITL interrupt

@celery.task
def monitor_fomema_deadline(worker_id):
    # Run daily via beat
    # Check fomema_deadline vs today
    # Day 7:  flag "fomema_registration_overdue" if not registered
    # Day 25: escalate "fomema_attendance_critical"
    # Day 31: trigger COM if result still pending

@celery.task
def validate_photo_biometrics(vdr_id, photo_bytes):
    # Use GLM-4V / Gemini Vision
    # Check: white background, no glasses, face clear, 35x50mm ratio
    # Return {compliant, issues[]}
    # Update vdr_applications/{vdr_id}.photo_biometric_compliant

@celery.task
def sweep_june_deadline_risk():
    # Run monthly via beat
    # Query workers WHERE ep_category IS NOT NULL
    # For each: check_ep_salary_threshold(category, salary, renewal_date)
    # If renewal_date > 2026-06-01 AND non-compliant:
    #   Create "Salary Adjustment Task" with priority="critical"
    #   Alert dashboard


### LangGraph Agent Enhancements

python
# New nodes added to StateGraph

async def company_audit_node(state):
    # Validate JTKSM 60K readiness
    # Check Act 446 cert expiry
    # Check quota_balance > 0 for sector
    # Tools: check_60k_status(), check_act446_validity(), check_quota()
    # Output: gate_jtksm = "approved" | "rejected" + blockers[]

async def vdr_filing_node(state):
    # Check all VDR checklist items complete
    # Validate biomedical = "fit"
    # If EP: check succession_plan uploaded
    # Generate IMM.47 payload
    # Output: vdr_ready_payload, filing_checklist

async def plks_monitor_node(state):
    # Track MDAC → FOMEMA → Biometric → PLKS chain
    # Check deadlines: Day 7 (registration), Day 30 (medical)
    # If fomema = "unfit": trigger COM
    # Output: plks_stage, next_action, deadline_alerts[]

# Write-back hook (FIX CURRENT GAP)
async def post_agent_writeback(state, findings):
    # After any node completes:
    # Write findings → workers/{id}/tasks/
    # Write levy/fines → compliance_state/{id}
    # Update health_score
    # Trigger dashboard refresh via WebSocket


---

## 5. Frontend Enhancement Plan

### New Pages & Routes


/company                → Company audit + JTKSM gate status
/vdr/:workerId          → VDR application manager (new)
/plks/:workerId         → PLKS post-arrival tracker (new)
/worker-pipeline        → Kanban gate view (replaces generic dashboard)
/analytics              → Levy forecast + gate bottleneck charts
/simulator              → (existing, enhanced)
/hitl                   → (existing, enhanced with VDR/PLKS context)


### Page: /worker-pipeline — Kanban Gate View


┌──────────┬──────────┬──────────┬──────────┬──────────┬──────────┐
│  JTKSM   │   VDR    │ TRANSIT  │  FOMEMA  │   PLKS   │  ACTIVE  │
│  Gate    │ Pending  │          │          │  Endorse │          │
├──────────┼──────────┼──────────┼──────────┼──────────┼──────────┤
│[Ahmad]   │[Rahim]   │[Kumar]   │[Sinthu]  │[Ali]     │[John]    │
│60K ✅    │Passport✅│In Flight │Registered│Fit ✅    │Expires   │
│446 ⚠️   │Photo ❌  │ETA:2d    │Day 5/30  │Biometric │90 days   │
│          │BioMed ⏳ │          │          │Pending   │          │
├──────────┼──────────┼──────────┼──────────┼──────────┼──────────┤
│1 worker  │3 workers │1 worker  │2 workers │1 worker  │12 workers│
└──────────┴──────────┴──────────┴──────────┴──────────┴──────────┘


### Page: /vdr/:workerId — VDR Application Manager


┌─────────────────────────────────────────────────────┐
│  VDR Application — Ahmad Razali                      │
│  Status: BIOMEDICAL PENDING          [View IMM.47]   │
├─────────────────┬───────────────────────────────────┤
│  CHECKLIST      │  DOCUMENT UPLOAD                   │
│                 │                                    │
│  ✅ Passport    │  [Upload Zone]                     │
│  ✅ Photo       │  Drag & drop or click              │
│     Biometric   │  Accepted: PDF, JPG                │
│     Check: ❌   │                                    │
│     (glasses    │  doc_type selector:                │
│      detected)  │  [passport▼] [Upload]              │
│                 │                                    │
│  ⏳ BioMed Ref  │  Bio-Medical Reference:            │
│  __ __ __ __    │  [BM-2026-XXXXXXX    ] [Verify]   │
│                 │  Status: Pinging FWCMS...          │
│  ❌ Contract    │                                    │
│  ❌ Succession  │  [Generate IMM.47 Form]            │
│     Plan (EP-II)│  [Prepare VDR Filing]              │
│                 │                                    │
│  Overall: 2/6   │                                    │
└─────────────────┴───────────────────────────────────┘


### Page: /plks/:workerId — PLKS Post-Arrival Tracker


┌─────────────────────────────────────────────────────┐
│  PLKS Tracker — Kumar Suresh                         │
│  Arrived: 15 Apr 2026    FOMEMA Deadline: 15 May 2026│
├─────────────────────────────────────────────────────┤
│                                                      │
│  ●━━━━━━━━●━━━━━━━━○━━━━━━━━○━━━━━━━━○━━━━━━━━○   │
│  MDAC    SEV     FOMEMA  FOMEMA  PLKS   i-Kad       │
│  Verified Stamp  Reg'd   Fit    Issued  Issued       │
│  ✅      ✅      Day 5   ⏳      ⏳      ⏳           │
│                  (Due:   (Due:                        │
│                  Day 7)  Day 30)                      │
│                                                      │
├─────────────────────────────────────────────────────┤
│  COUNTDOWN                                           │
│  ┌──────────────────────────────┐                   │
│  │  FOMEMA Deadline             │                   │
│  │  ████████░░░░░░░  Day 5/30  │                   │
│  │  25 days remaining           │                   │
│  │  [Register FOMEMA Now]       │                   │
│  └──────────────────────────────┘                   │
│                                                      │
│  If FOMEMA = Unfit: [Trigger COM] button appears    │
└─────────────────────────────────────────────────────┘


### Enhanced /workflows/:workerId — ReactFlow with Action Buttons


Nodes now have action buttons:

┌─────────────────┐
│  FOMEMA Check   │
│  Status: Due    │
│  Day 5 / 30     │
│ [Upload Result] │ ← action button on node
│ [View Deadline] │
└─────────────────┘
        │
        ▼
┌─────────────────┐
│  PLKS Endorse   │
│  Status:        │
│  BLOCKED        │
│  (awaiting fit) │
└─────────────────┘


### Enhanced /dashboard — Compliance Weather


┌─────────────────────────────────────────────────────┐
│  COMPLIANCE WEATHER                                  │
├──────────┬──────────┬──────────┬────────────────────┤
│ ⛈️       │ ⛅       │ ☀️       │ 🌧️                 │
│CRITICAL  │ WARNING  │ CLEAR    │ MONITORING          │
│Ahmad     │Rahim     │John      │Kumar                │
│446 exp   │Photo rej │Active    │FOMEMA Day 5         │
│in 7 days │at VDR    │Healthy   │                     │
├──────────┴──────────┴──────────┴────────────────────┤
│  LEVY FORECAST (Next 6 Months)                       │
│  Jan ████████ RM 32,000                              │
│  Feb ████████ RM 32,000                              │
│  Mar █████████ RM 36,500 ← new hire pushes Tier 2   │
│  Apr █████████ RM 36,500                             │
│  May ██████████ RM 41,000 ← June salary pivot impact │
│  Jun ██████████ RM 41,000                            │
└─────────────────────────────────────────────────────┘


---

## 6. Complete End-to-End Workflow


PHASE 0 — COMPANY AUDIT
Input:  SSM cert, Act 446 cert, housing inspection report
Output: { jtksm_60k_status, quota_balance, act_446_valid }
Agent:  company_audit_node
UI:     /company

PHASE 1 — DOCUMENT INGESTION
Input:  Passport scan, FOMEMA/EP docs (bulk zip)
Output: { worker_id, extracted_fields, confidence_score }
Agent:  triage L0/L1/L2
UI:     /ingestion → review → confirm

PHASE 2 — VDR APPLICATION
Input:  passport_scan, digital_photo, biomedical_ref,
        home_address, signed_contract, [certs if EP],
        [succession_plan if EP-II/III]
Process:
  1. validate_passport_photo()    → biometric check
  2. ping_biomedical_database()   → FWCMS verification
  3. check_succession_required()  → EP-II/III gate
  4. generate_imm47_payload()     → auto-fill form
  5. Filing Agent generates tasks
Output: { vdr_checklist_status, imm47_payload, filing_tasks[] }
Agent:  vdr_filing_node
UI:     /vdr/:workerId

PHASE 3 — TRANSIT
Input:  flight booking confirmation, estimated arrival date
Output: { fomema_deadline (arrival + 30d), mdac_reminder }
Agent:  passive (date calculation only)
UI:     /worker-pipeline (TRANSIT column)

PHASE 4A — ARRIVAL & FOMEMA
Input:  arrival_date, mdac_form, sev_stamp_photo,
        boarding_pass (optional), clinic_code
Process:
  Day 0:  verify_mdac() + calculate fomema_deadline
  Day 7:  check fomema_registered (alert if not)
  Day 25: escalate if not attended
  Day 30: final deadline
  Result: "fit" → Phase 4B
  Result: "unfit" → trigger_com() → repatriation workflow
Output: { fomema_stage, days_remaining, next_action }
Agent:  plks_monitor_node
UI:     /plks/:workerId

PHASE 4B — PLKS ENDORSEMENT
Input:  original_passport (physical), biometric capture
Process:
  1. Confirm fomema_result = "fit"
  2. confirm_biometrics()
  3. Generate PLKS endorsement payload
  4. Issue i-Kad upon PLKS approval
Output: { plks_number, plks_expiry, ikad_number }
Agent:  filing_node
UI:     /plks/:workerId (final steps)

PHASE 5 — ACTIVE MONITORING
Input:  (continuous, no user action needed)
Process: Daily sweep checks:
  - permit expiry (T-90, T-60, T-30 alerts)
  - EP salary vs June 2026 threshold
  - MTLM levy tier on headcount changes
  - Passport validity (< 18 months)
  - Act 446 cert renewal
Output: { health_score, flags[], tasks_created[], levy_forecast }
Agent:  compliance sweep (Celery Beat daily)
UI:     /dashboard + /alerts


---

## 7. Expected Outputs Per Gate


GATE          INPUT REQUIRED              OUTPUT EXPECTED
──────────────────────────────────────────────────────────
JTKSM         Act 446 cert                { approved: bool,
              SSM registration             blockers: [],
              Housing inspection           quota_allocated: int }

VDR           Passport (18m+ validity)    { checklist_complete: bool,
              Biometric photo             imm47_payload: {},
              Biomedical ref number        biomedical_fit: bool,
              Signed contract              succession_required: bool,
              [Certs if EP]               vdr_ready: bool }
              [Succession plan if EP-II]

FOMEMA        Arrival date                { stage: "registered|attended|result",
              MDAC form                   days_remaining: int,
              Clinic code                  result: "fit|unfit|pending",
              Passport copy               com_triggered: bool }

PLKS          Fomema = "fit"             { plks_number: str,
              Original passport           plks_expiry: date,
              Biometrics captured          ikad_number: str,
              SEV stamp verified          endorsement_complete: bool }

ACTIVE        (none — automated)         { health_score: 0-100,
                                          flags: [],
                                          levy_tier: "1|2|3",
                                          next_deadline: date,
                                          tasks_pending: int }


---

## 8. Implementation Priority Order


SPRINT 1 — Unblock Current Gaps (Week 1-2)
  ├── Unwire compliance_reasoning_service.py mock
  ├── Add post_agent_writeback hook to LangGraph
  ├── Move Gemini keys to .env
  └── Add idempotency check on /workflows/start

SPRINT 2 — VDR Stage (Week 2-3)
  ├── vdr_applications Firestore collection
  ├── /vdr/* API endpoints
  ├── VDRService (photo validation, biomedical ping, IMM.47)
  ├── vdr_filing_node in LangGraph
  └── /vdr/:workerId frontend page

SPRINT 3 — PLKS Stage (Week 3-4)
  ├── plks_applications Firestore collection
  ├── /plks/* API endpoints
  ├── PLKSService (MDAC, FOMEMA tracking, COM trigger)
  ├── plks_monitor_node in LangGraph
  ├── monitor_fomema_deadline Celery task
  └── /plks/:workerId frontend page

SPRINT 4 — Dashboard & Analytics (Week 4-5)
  ├── /worker-pipeline Kanban view
  ├── Compliance Weather widget
  ├── Levy forecast chart (/analytics/levy-forecast)
  ├── Gate bottleneck analytics
  └── sweep_june_deadline_risk Celery task

SPRINT 5 — Hardening (Week 5-6)
  ├── WebSocket for real-time dashboard refresh
  ├── Full agent observability (Arize Phoenix)
  ├── COM document generation (repatriation)
  └── End-to-end integration testing per gate

