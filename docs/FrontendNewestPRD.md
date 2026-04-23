PermitIQ: Frontend Product Requirements Document (PRD)
Version: 3.0 (Final – Perfectly Aligned with Enhancement Plan v2.0)Stack: Vite + React 18 + Tailwind + Zustand + TanStack Query + Firebase
1. Product Overview
For an agentic workflow engine like PermitIQ, the frontend cannot operate merely as a static dashboard. It must function as a collaborative workspace where human operators and AI interact seamlessly. As the AI assumes autonomous tasks—such as parsing multilingual documents, managing federal immigration gates, and mapping complex 2026 labor regulations—the UI must prioritize transparency, user trust, and robust error recovery.

2. Core Agentic UI/UX Principles
To ensure HR managers and SME owners trust the system with high-stakes compliance tasks, the interface must adhere strictly to these UX patterns:

Explainable Rationale & Confidence Signals: When the AI model parses unstructured data (e.g., a blurry passport or municipal Typhoid card), it must display a "Confidence Score" (e.g., 98% or 65%) adjacent to the extracted data. The UI must also surface the AI's reasoning (e.g., "Calculated MyEG levy at RM1,850 based on the Services sector mandate").
Intent Preview & Autonomy Dial: To prevent severe penalties under Section 55B of the Immigration Act, users must be able to adjust the AI's autonomy. For irreversible actions, such as submitting a Check Out Memo (COM) for repatriation, the UI must force an "Intent Preview," displaying the drafted forms and requiring explicit human approval before execution.
Action Audit & Undo: The frontend must maintain a real-time event log tracking every automated API ping, document verification, and status change executed by the AI, ensuring complete traceability during government audits.

3. User Flows
Flow 1: Document Upload & Human-in-the-Loop (HITL) Verification
Ingestion: The user drags and drops a batch of mixed documents (passports, FOMEMA results) into the upload zone.
Processing: A visual "skeleton" loader indicates the LangGraph AI is processing unstructured data via FastAPI.
Verification Interface: The screen splits into a dual-pane view. The left pane shows the original document with bounding boxes around extracted text; the right pane displays the structured data fields.
Exception Handling: The AI flags fields with low confidence scores in yellow. The user clicks the flagged field, corrects the data, and clicks "Approve" to push the worker into the active pipeline.
Flow 2: Post-Arrival PLKS Pipeline (The 30-Day Window)
Dependency Timeline: When a worker arrives, the UI generates a strict, node-based visual timeline.
Immediate Action (Day 1): The UI prompts the user to verify the MDAC (Malaysia Digital Arrival Card).
Medical Action Required (Day 7): The UI proactively prompts the user to book the FOMEMA clinic. Downstream actions (PLKS endorsement) remain visually locked (greyed out with a padlock icon).
Progression & Finalization: As the AI polls backend systems and detects a cleared "Fit" FOMEMA result, the PLKS Endorsement node visually unlocks. Once PLKS is approved, the final node, i-Kad Issuance, turns green, completing the flow.
Flow 3: Edge Case Resolution (e.g., Expired Permit Discovery)
Alert: A critical red alert takes over the top of the dashboard: "Compliance Breach Detected."
AI Diagnosis: The AI presents its exact reasoning: "Worker Budi Santoso's permit expired 12 days ago."
Dynamic Mitigation: The UI generates a customized mitigation workflow, displaying the calculated Overstay fine (e.g., 12 days x RM30 = RM360) and providing a pre-filled administrative compound form to bypass judicial prosecution.
4. Key Interface Requirements
Screen A: The Executive Risk Dashboard
Objective: Translate compliance gaps into clear financial liabilities.
Statutory Exposure Calculator: A dynamic widget that updates in real-time (e.g., if a permit lapses, it displays "+RM10,000 Minimum Section 55B Fine Exposure").
MTLM Tracker: Tracks the company's Multi-Tier Levy Mechanism quota ratio to forecast future tax bracket hikes.
Screen B: The Macro Gate Pipeline (Kanban Tracker)
Objective: Provide a bird's-eye view of all workers moving through compliance gates.
Layout: A horizontally scrolling Kanban board mapped precisely to the backend state machine: JTKSM Gate → VDR Pending → Transit → FOMEMA → PLKS Endorse → Active.
Behavior: Cards move autonomously based on AI verifications (manual dragging is disabled). Blocked workers are highlighted with a red border and feature a one-click button to open the HITL resolution drawer.
Screen C: Dual-Channel Sync View (Exclusive for F&B Users)
Objective: Manage the split between federal immigration laws and local municipal health laws.
Layout: A two-column comparative table. Column 1 tracks Federal status (MyEG/PLKS). Column 2 tracks Municipal status (Typhoid Vaccine, Food Handler Certs).
Feature: Includes a one-click "Export Audit Packet" button to instantly download consolidated health certificates for on-site municipal inspections.
Screen D: The Worker Command Center (Individual Profile)
Objective: Serve as the single source of truth for an individual employee.
Layout: Contains digitized ID cards, a node-based visual timeline of dependencies (built with React Flow), and a chat interface for querying the AI about that specific worker's legal transfer rights.
5. Technical Stack Requirements
Build Tool & Framework: Vite + React 18+ (Required for optimized SPA bundling).
Routing: React Router v6.
Styling & UI: Tailwind CSS + shadcn/ui (Required for rapid, accessible, enterprise-grade components).
State Management (Global UI): Zustand (Required for lightweight management of active worker context and UI drawer states).
Server State & Data Fetching: TanStack Query / React Query (Crucial for handling caching and background refetching for standard API calls).
Real-time Data Sync (CRITICAL): Firebase/Firestore Real-Time Listeners (onSnapshot).
Note to Developer: Do not build custom WebSockets. The LangGraph backend streams its step-by-step reasoning and state updates directly into Firestore documents. The Vite client must attach onSnapshot listeners to these documents to drive the UI updates instantly without polling.
6. API & Firestore Data Contracts (JSON Schemas)
CRITICAL FOR CODE GENERATION: The frontend UI components must be built to strictly consume and expect the following JSON structures from the backend/Firestore.

6.1 Worker Profile Schema (Firestore Document)
JSON

{
  "worker_id": "W-12345",
  "first_name": "Budi",
  "last_name": "Santoso",
  "nationality": "IDN",
  "passport_number": "C1234567",
  "sector": "F&B",
  "current_gate": "FOMEMA",
  "compliance_health_score": 85,
  "deadlines": {
    "mdac_verification": "2026-07-02T00:00:00Z",
    "plks_expiry": "2026-08-15T00:00:00Z",
    "passport_expiry": "2028-01-10T00:00:00Z",
    "typhoid_expiry": "2027-05-20T00:00:00Z"
  }
}
6.2 Agentic Task / Node Schema (For Kanban & React Flow Timelines)
JSON

{
  "task_id": "T-9876",
  "worker_id": "W-12345",
  "task_name": "Verify FOMEMA Clearance",
  "status": "BLOCKED_HITL", 
  "depends_on": ["T-9875"],
  "ai_metadata": {
    "confidence_score": 0.42,
    "reasoning": "Clinic note is illegible. Unable to confidently extract 'Fit' status.",
    "requires_human_approval": true
  }
}
6.3 LangGraph Stream Schema (Firebase onSnapshot Payload)
JSON

{
  "event_type": "AI_REASONING_UPDATE",
  "timestamp": "2026-04-23T10:15:30Z",
  "payload": {
    "worker_id": "W-12345",
    "action": "CALCULATING_OVERSTAY_FINE",
    "message": "Permit expired 12 days ago. Calculating administrative compound tier...",
    "ui_trigger": "OPEN_WARNING_MODAL",
    "computed_data": {
      "fine_amount_rm": 360,
      "liability_level": "Administrative"
    }
  }
}