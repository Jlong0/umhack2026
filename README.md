# PermitIQ — Autonomous Foreign Worker Compliance Engine

> AI-powered, stateful workflow engine for Malaysian SMEs navigating the complex foreign worker regulatory landscape. Built for UMHack 2026.

---

## Problem Definition & Purpose

Malaysian SMEs managing foreign workers face a fragmented, manual compliance process spanning multiple government portals — FWCMS, JTKSM, FOMEMA, MyEG — with strict regulatory deadlines and severe penalties under the Immigration Act 1959/63. A single missed deadline can result in fines of RM 10,000–50,000 per worker, and employers can face criminal prosecution for systemic non-compliance.

The core problem is not a lack of regulation — it is a lack of tooling. Compliance officers must simultaneously track 13+ obligations per worker (passport validity, work permit renewal, FOMEMA health screening, SOCSO/EPF contributions, housing certification under Act 446, security vetting via Borang 100, and more), manually cross-reference government portals, and generate paperwork under time pressure. Most SMEs lack the legal expertise and bandwidth to do this reliably at scale.

**PermitIQ solves this by replacing the manual compliance workflow with a stateful, adaptive AI engine that:**
- Ingests unstructured documents (passports, FOMEMA reports, SSM profiles, employment contracts) via multimodal AI vision
- Orchestrates multi-agent reasoning pipelines that track every worker through every regulatory gate
- Surfaces deadlines, blockers, and compliance risks before they become violations
- Interrupts for human review only when genuinely needed (low-confidence extractions, permit expiry, deadlocks)
- Generates and manages employment contracts end-to-end
- Provides what-if simulation for levy cost and salary compliance planning

---

## Target Users & User Stories

### Primary Users

| User | Role |
|------|------|
| HR / Compliance Officer | Manages worker onboarding, document submission, and deadline tracking |
| Operations Manager | Monitors workforce compliance health and cost exposure |
| Foreign Worker | Self-uploads documents and tracks their own permit/contract status |

### User Stories

**As a compliance officer**, I want to upload a worker's passport and have the system automatically extract all relevant fields, flag low-confidence values for my review, and trigger the compliance workflow — so I don't have to manually key in data across multiple portals.

**As a compliance officer**, I want to see a live pipeline view of every worker across all 8 regulatory gates — so I can immediately identify who is blocked, overdue, or at risk.

**As an operations manager**, I want to simulate the MTLM levy impact before hiring additional foreign workers — so I can make informed headcount decisions without surprises at billing time.

**As an operations manager**, I want to receive automated alerts when any worker's permit or passport is within 30/90 days of expiry — so renewals are never missed.

**As a foreign worker**, I want to upload my own documents via a simple mobile-friendly interface and see my permit and contract status in real time — so I am not dependent on my employer for information about my own compliance.

**As a compliance officer**, I want the system to detect when a worker is in a compliance deadlock (e.g. permit renewal blocked by expired passport) and recommend a resolution path — so I know what to fix first.

---

## Originality, Innovation & Value Realization

### What makes PermitIQ different

Most compliance tools are passive — they store documents and send calendar reminders. PermitIQ is an **active reasoning engine**:

1. **Stateful multi-agent orchestration** — LangGraph pipelines maintain full worker state across workflow stages. Agents share context, hand off tasks, and resume from failure without losing progress.

2. **Multimodal document understanding** — Gemini 2.5 Flash reads passport bio-data pages, FOMEMA reports, SSM profiles, and Act 446 certificates as images, extracting structured fields with per-field confidence scores. Low-confidence fields are automatically routed to human review rather than silently accepted.

3. **Compliance deadlock detection** — The strategist agent cross-checks permit, passport, FOMEMA, and housing obligations simultaneously and identifies circular dependencies (e.g. permit renewal requires valid passport, but passport renewal requires valid permit address) that a checklist tool would miss.

4. **What-if simulation** — Employers can model MTLM levy tier changes before hiring, and check EP salary compliance against pre/post-June 2026 thresholds — turning reactive compliance into proactive planning.

5. **Dual-sync drift detection** — The system compares internal records against simulated government portal data to surface discrepancies before an audit does.

6. **Worker-facing self-service** — Workers upload their own documents and track their status independently, reducing the administrative burden on HR and giving workers agency over their own compliance.

### Value delivered

- Reduces compliance officer time per worker from ~4 hours/month to minutes
- Eliminates missed-deadline fines (RM 10K–50K per incident)
- Provides audit-ready documentation trail for every decision
- Scales to hundreds of workers without proportional headcount increase

---

## Feature Prioritization & MVP Scope

### MVP (delivered)

| Feature | Justification |
|---------|---------------|
| Multimodal document ingestion (passport, FOMEMA, SSM) | Core data entry point — everything downstream depends on it |
| Multi-agent compliance pipeline (14 nodes, 2 graphs) | The primary value proposition |
| Gate pipeline Kanban visualizer | Makes workflow state visible to non-technical users |
| HITL interrupt system | Required for trust — humans must be able to review and override |
| Compliance alerts dashboard | Immediate operational value — surfaces risk without workflow knowledge |
| Worker obligation calendar | Deadline visibility per worker |
| What-if simulator (MTLM + EP salary) | High-value planning tool with low implementation cost |
| Contract generation (PDF fill + worker upload) | Closes the end-to-end loop |
| Worker self-service portal | Differentiator; reduces HR load |

### Deferred (post-MVP)

- Direct government portal API integration (FWCMS, MyEG) — requires production credentials and MoU
- Mobile app — web is sufficient for hackathon scope
- Multi-tenancy / SaaS billing — single-tenant for now
- Full audit trail export (PDF) — audit log drawer exists; export deferred

---

## System Logic & Architecture

### Overview

PermitIQ operates as a **stateful, event-driven workflow engine**. Each worker has a persistent state object in Firestore that is updated as agents process documents, check compliance gates, and generate outputs. The system is designed to handle:

- **Ambiguity** — low-confidence OCR fields are flagged and routed to HITL rather than accepted silently
- **Missing data** — agents check for required fields before proceeding and surface blockers explicitly
- **Process failures** — LangGraph nodes catch exceptions and write error state to the trace; the supervisor can retry or escalate
- **Partial completion** — workflows can be paused at any node and resumed; state is persisted between sessions

### Two LangGraph Pipelines

**VDR Pipeline** (linear, document-triggered):
```
upload → parse (Gemini vision) → validate fields → check signatures
       → compliance gate check → FOMEMA screening → assemble VDR package
```
Triggered when a new document is uploaded. Runs once per document. Produces a validated document record and triggers the compliance pipeline.

**Legacy Compliance Pipeline** (supervisor loop, ongoing):
```
supervisor ──► auditor          (checks permit/passport/FOMEMA deadlines)
            ├─► strategist       (detects deadlocks, recommends resolution order)
            ├─► filing           (prepares renewal submissions)
            ├─► company_audit    (validates employer-side obligations: EPF, SOCSO, housing)
            ├─► vdr_filing       (assembles VDR package for government submission)
            └─► plks_monitor     (tracks PLKS permit status)
                     │
                     ▼
                   hitl          (interrupts for human review when needed)
```
The supervisor routes to specialist agents based on current worker state. Each agent reads from and writes to the shared Firestore state. The loop continues until all gates are cleared or a HITL interrupt is raised.

### Edge Case Handling

| Scenario | Handling |
|----------|----------|
| OCR confidence < threshold | Field flagged; HITL interrupt raised before workflow proceeds |
| Missing required document field | Agent writes `missing_field` blocker to state; pipeline pauses |
| Permit expiry within 30 days | Auditor agent raises `EXPIRY_IMMINENT` alert; HITL notified |
| Compliance deadlock detected | Strategist agent identifies dependency cycle; resolution path recommended |
| API / LLM call failure | Node catches exception; writes error to execution trace; supervisor can retry |
| Worker uploads wrong document type | Document type mismatch detected at validation node; user prompted to re-upload |
| Government portal data drift | Dual-sync agent compares internal vs mock portal records; discrepancies surfaced |

---

## System Schema & Design

### Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        Frontend (React 18 + Vite)                │
│                                                                   │
│  Dashboard │ Gate Pipeline │ HITL │ Alerts │ Simulator │ ...     │
│  Worker Portal (separate layout, mobile-friendly)                │
└──────────────────────────┬──────────────────────────────────────┘
                           │ REST API + WebSocket
┌──────────────────────────▼──────────────────────────────────────┐
│                      FastAPI Backend (Python 3.13)               │
│                                                                   │
│  /workers  /agents  /hitl  /contracts  /alerts  /simulator  ...  │
│  16 route modules, Pydantic validation, async throughout         │
└──────────┬───────────────────────────────┬──────────────────────┘
           │                               │
    ┌──────▼──────┐                 ┌──────▼──────┐
    │  LangGraph  │                 │  Firebase   │
    │  Agents     │◄───state r/w───►│  Firestore  │
    │  (2 graphs, │                 │  + Storage  │
    │  14 nodes)  │                 └─────────────┘
    └──────┬──────┘
           │ LLM calls
    ┌──────▼──────┐
    │ Gemini 2.5  │
    │ Flash       │
    │ (vision +   │
    │  reasoning) │
    └─────────────┘
```

### Data Schema (Firestore)

**Worker document** (`/workers/{worker_id}`):
```json
{
  "worker_id": "string",
  "full_name": "string",
  "nationality": "string",
  "passport_number": "string",
  "passport_expiry_date": "ISO date",
  "permit_expiry_date": "ISO date",
  "permit_class": "string",
  "sector": "string",
  "status": "active | pending | expired",
  "compliance_gates": {
    "fomema": "cleared | pending | overdue",
    "socso": "cleared | pending",
    "epf": "cleared | pending",
    "housing": "cleared | pending",
    "security_vetting": "cleared | pending"
  },
  "workflow_state": "object",
  "hitl_flags": ["array of interrupt reasons"],
  "created_at": "timestamp"
}
```

**Parse job** (`/parse_jobs/{job_id}`):
```json
{
  "job_id": "string",
  "document_id": "string",
  "doc_type": "passport | fomema_report | ssm_profile | ...",
  "status": "queued | processing | completed | failed",
  "parsed_fields": { "field_key": { "value": "string", "confidence": 0.0–1.0 } },
  "low_confidence_fields": ["array"],
  "created_at": "timestamp"
}
```

**HITL interrupt** (`/hitl_queue/{interrupt_id}`):
```json
{
  "worker_id": "string",
  "interrupt_type": "low_confidence | permit_expiry | deadlock | missing_field",
  "severity": "critical | high | medium",
  "context": "object",
  "status": "pending | reviewed | resolved",
  "resolution": "string | null"
}
```

---

## Technical Feasibility & Workflow Integration

### Why this stack is the right fit

| Decision | Rationale |
|----------|-----------|
| **LangGraph** over plain LLM chains | Stateful graph execution with conditional routing, loops, and checkpointing — essential for a multi-stage compliance workflow that must pause, resume, and branch |
| **Gemini 2.5 Flash** | Best-in-class multimodal performance for document OCR at low latency and cost; native vision API avoids a separate OCR service |
| **FastAPI** | Async-native Python backend; WebSocket support for real-time workflow status; Pydantic for strict input validation at API boundaries |
| **Firebase Firestore** | Schemaless NoSQL suits the variable structure of compliance state across different worker types and document combinations; real-time listeners enable live UI updates |
| **TanStack Query** | Declarative server state management with automatic background refetch — keeps the pipeline visualizer and alerts dashboard live without manual polling logic |
| **ReactFlow** | Purpose-built for node-graph visualization; used for the workflow execution trace view |

### Integration points

- **Document upload → parse job → compliance workflow**: Uploading a document creates a Firestore parse job, triggers Gemini extraction, and on confirmation starts the LangGraph compliance pipeline — all as a single user action.
- **HITL interrupts**: Any agent node can raise a HITL interrupt by writing to the `hitl_queue` collection. The frontend polls this queue and surfaces pending reviews. Resolving a review resumes the paused workflow.
- **WebSocket workflow status**: The backend streams workflow node execution events over WebSocket. The frontend workflow detail page renders these in real time as a node graph with per-node status and duration.
- **What-if simulator**: Stateless calculation endpoints — no workflow required. Takes input parameters, applies JTKSM tier formulas, returns structured results. Designed to be fast and usable without any worker data loaded.

### Handling real-world constraints

**Ambiguity**: Gemini returns per-field confidence scores. Fields below the threshold are not auto-accepted — they are presented to the compliance officer for manual correction before the workflow proceeds. This prevents garbage-in-garbage-out propagation through the pipeline.

**Incomplete data**: Each agent node validates its required inputs before executing. Missing fields are written as explicit blockers to the worker's state, surfaced in the HITL queue, and prevent downstream nodes from running on bad assumptions.

**Process failures**: Every LangGraph node is wrapped in exception handling. Failures are written to the execution trace with full error context. The supervisor agent can detect failed nodes and either retry or escalate to HITL. No failure is silent.

**Scale**: The architecture is stateless at the API layer (all state in Firestore) and async throughout. Adding workers does not require schema changes. The LangGraph pipelines run per-worker and are independent — one worker's workflow failure does not affect others.

---

## AI Usage Disclosure

PermitIQ uses AI in the following ways:

| Usage | Model | Purpose |
|-------|-------|---------|
| Document field extraction | Google Gemini 2.5 Flash (vision) | Reads passport bio-data pages, FOMEMA reports, SSM profiles, and other documents as images; extracts structured fields with confidence scores |
| Compliance reasoning | Google Gemini 2.5 Flash (text) | Powers the auditor, strategist, and filing agents; reasons over worker state to identify risks, deadlocks, and recommended actions |
| Contract field mapping | Google Gemini 2.5 Flash (text) | Maps extracted worker fields to PDF contract template placeholders |
| Development assistance | Claude (Anthropic) | Used during development for code generation, debugging, and architecture review |

All AI-generated compliance outputs are subject to human review via the HITL system before any action is taken on government portals. The system is designed so that AI handles data extraction and reasoning, while humans retain final authority over submissions and high-stakes decisions.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Vite, Tailwind CSS, TanStack Query, Zustand, ReactFlow |
| Backend | FastAPI, Python 3.13 |
| AI / LLM | Google Gemini 2.5 Flash (vision + reasoning) |
| Agent Framework | LangGraph (stateful multi-agent orchestration) |
| Database | Firebase Firestore (NoSQL) |
| File Storage | Firebase Storage |
| PDF Processing | PyMuPDF (fitz) |
| Real-time | WebSocket (FastAPI) |

---

## Project Structure

```
umhack2026/
├── app/
│   ├── agents/
│   │   ├── contract_agent.py    # PDF filling with PyMuPDF
│   │   ├── graph.py             # LangGraph pipeline definitions
│   │   ├── nodes.py             # 14 agent nodes (VDR + legacy)
│   │   ├── state.py             # TypedDict state schemas
│   │   └── trace.py             # Execution trace helper
│   ├── routes/                  # FastAPI routers (16 modules)
│   ├── services/
│   │   ├── gemini_service.py    # Gemini vision + text generation
│   │   └── document_service.py  # File storage abstraction
│   └── main.py
├── frontend/
│   └── src/
│       ├── pages/               # 15 pages
│       ├── hooks/queries/       # TanStack Query hooks
│       ├── store/               # Zustand stores
│       └── services/api.js      # Centralized API client
└── scripts/
    ├── seed_demo.py             # Seed demo data
    └── seed_mock_data.py        # Seed mock gov records
```

---

## Run Locally

### 1. Backend dependencies

```bash
python -m pip install -r requirements.txt
```

### 2. Frontend dependencies

```bash
cd frontend && npm install && cd ..
```

### 3. Environment variables

Create `.env` in the repository root:

```env
FIREBASE_CREDENTIALS_PATH=secrets/firebase-service-account.json
FIREBASE_STORAGE_BUCKET=your-bucket.firebasestorage.app
GEMINI_API_KEY=your-gemini-api-key
```

### 4. Start both services

```bash
npm install
npm run dev:full
```

Frontend: `http://localhost:5173` | Backend: `http://127.0.0.1:8001`

### 5. Seed demo data

```bash
python -m scripts.seed_demo
```

---

## License

MIT License — see [LICENSE](LICENSE)
