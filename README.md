# PermitIQ — Autonomous Foreign Worker Compliance Engine

> AI-powered compliance management system for Malaysian SMEs navigating the complex foreign worker regulatory landscape (UMHack 2026).

---

## Problem Statement

Malaysian SMEs managing foreign workers face a fragmented, manual compliance process spanning multiple government portals (FWCMS, JTKSM, FOMEMA, MyEG), strict regulatory deadlines, and severe penalties under the Immigration Act. A single missed deadline can result in fines of RM 10,000–50,000 per worker. Most SMEs lack the legal expertise and bandwidth to track 13+ compliance obligations per worker simultaneously.

**PermitIQ solves this by:**
- Automating document parsing and field extraction via multimodal AI
- Running multi-agent compliance reasoning across all regulatory gates
- Surfacing deadlines, blockers, and risks before they become violations
- Providing a human-in-the-loop layer for high-stakes decisions
- Generating and managing employment contracts end-to-end

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Frontend (React)                      │
│  Dashboard │ Pipeline │ HITL │ Contracts │ Simulator │ ...  │
└──────────────────────┬──────────────────────────────────────┘
                       │ REST + WebSocket
┌──────────────────────▼──────────────────────────────────────┐
│                    FastAPI Backend                           │
│  /workers  /agents  /hitl  /contracts  /vdr  /plks  ...     │
└──────────────────────┬──────────────────────────────────────┘
                       │
        ┌──────────────┼──────────────┐
        ▼              ▼              ▼
  ┌──────────┐  ┌────────────┐  ┌──────────────┐
  │ LangGraph│  │  Firebase  │  │ Gemini 2.5   │
  │ Agents   │  │ Firestore  │  │ Flash (AI)   │
  │(2 pipelines)│ + Storage │  │              │
  └──────────┘  └────────────┘  └──────────────┘
```

### Two LangGraph Pipelines

**VDR Pipeline** (linear) — document processing:
```
parse → validate → signatures → compliance → fomema → assemble
```

**Legacy Compliance Pipeline** (supervisor loop) — ongoing monitoring:
```
supervisor → auditor / strategist / filing / company_audit / vdr_filing / plks_monitor → hitl
```

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

## Core Features

| Feature | Description |
|---------|-------------|
| Multimodal Document Ingestion | Gemini vision extracts passport, FOMEMA, SSM, Act 446 fields with confidence scores |
| Multi-Agent Compliance Reasoning | 14 LangGraph nodes across 2 pipelines covering all regulatory gates |
| Gate Pipeline Visualizer | Kanban board showing workers across 8 regulatory gates |
| Human-in-the-Loop (HITL) | Auto-interrupt on permit expiry, deadlock, missing fields; admin review flow |
| Contract Generation | AI fills worker-specific PDF contracts; worker signs and re-uploads |
| Tool Handoff & Audit Log | Agent actions queued for human confirmation with simulated FWCMS submission |
| What-If Simulator | MTLM levy calculator + EP salary compliance checker |
| F&B Dual Sync | Compares internal records vs simulated government portal data |
| Worker Obligation Calendar | Visual timeline of all compliance deadlines per worker |
| Execution Trace | Per-node trace with status, duration, and error capture for every workflow |

---

## Key Regulatory Problems Solved

| Problem | Solution |
|---------|----------|
| Manual document extraction | Gemini vision with confidence scoring and low-confidence HITL |
| Tracking 13+ obligations per worker | LangGraph multi-agent pipeline with Firestore persistence |
| Missing FOMEMA deadline (RM 10K–50K fine) | Automated 7-day post-arrival monitoring with HITL alert |
| MTLM levy tier miscalculation | Formula-based simulator matching JTKSM tier structure |
| Employment contract generation for N workers | PyMuPDF template filling with AI field mapping |
| Compliance deadlock detection | Strategist agent cross-checks permit + passport + FOMEMA simultaneously |
| Government portal data drift | Dual-sync comparison against mock FWCMS records |

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

