# PermitIQ Product Requirements Document

Version: 1.0
Date: 2026-05-01

## 1. Product Summary

PermitIQ is a web-based foreign worker compliance platform for Malaysian SMEs. The repository implements an admin portal and a worker portal that coordinate document ingestion, workflow execution, alerts, human-in-the-loop review, contract generation, permit planning, and mock government portal interactions.

The product is built around a FastAPI backend and a React frontend. The frontend is responsible for routing, task visualization, worker-facing uploads, approval queues, compliance dashboards, and demo-style operational views. The backend exposes routers for workers, documents, agents, alerts, simulator, HITL, contracts, realtime updates, mock government data, and related support modules.

## 2. Problem Statement

Malaysian SMEs that employ foreign workers must manage passport validity, permit renewals, medical screening, wage thresholds, document completeness, and government-facing filing across multiple workflows. The repository reflects that work as a stateful compliance engine rather than a simple CRUD application.

The product solves three practical problems shown in the codebase:

1. Document intake is fragmented across passport uploads, worker profile creation, and parse-job confirmation flows.
2. Compliance status needs to be visible at both the worker level and the company level through dashboards, workflow views, and alert pages.
3. High-risk decisions require human review, not silent automation, so the UI includes HITL queues, approval modals, and review pages.

## 3. Product Goals

### Primary Goals

- Provide a clear operational dashboard for compliance staff.
- Show each worker’s compliance state, workflow stage, and blockers.
- Support document upload, extraction, confirmation, and workflow kickoff.
- Surface alerts for expiry, deadlocks, and blocked tasks.
- Allow human approval where automation pauses.
- Let workers upload documents, check status, and manage contracts from a separate portal.

### Secondary Goals

- Provide simulation tools for levy and salary planning.
- Provide a mock government portal for demonstrations and internal testing.
- Support contract generation and signed contract review.
- Provide a graph-based visualization of workflow topology.

## 4. Non-Goals

- The current codebase does not implement live external government integrations; the mock government portal and sync views are simulation-oriented.
- The current codebase does not show a production identity provider; role state is managed in frontend store logic.
- The current codebase does not expose a dedicated mobile app.
- The current codebase does not expose a public API specification or customer billing layer.

## 5. Users and Personas

### Admin / Compliance Officer

Uses the admin console to monitor workers, review alerts, inspect workflows, resolve HITL cases, generate contracts, and manage invitation or login-code flows.

### Operations Manager

Uses the dashboard, simulator, and graph views to understand cost exposure, worker load, and compliance risk.

### Foreign Worker

Uses the worker portal to upload documents, view status, and manage contracts.

### Reviewer / Approver

Uses HITL pages and medical review pages to make human decisions on blocked workflows or review-ready records.

## 6. Product Surfaces

### Landing and Login

The root landing page presents two entry paths: admin portal and worker portal. Separate login pages exist for each role. Authentication state is managed in the frontend store, and the app redirects authenticated users to the correct portal path.

Requirements:

- Users must be able to choose admin or worker access from the landing page.
- Users must be redirected away from login pages once authenticated.
- Users must be redirected to an appropriate home screen if they attempt to access the wrong role’s routes.

### Admin Console Shell

The admin shell contains the main navigation and operational widgets. It includes audit log access, autonomy controls, parse-state status, and links to the major admin pages.

Requirements:

- Persistent navigation must provide access to dashboard, pipeline, alerts, workers, HITL, contracts, government demo, sync, simulator, workflow visualizer, approval handoff, calendar, and worker invite.
- The shell must display company context when available.
- The shell must support sign out and role switching.

### Worker Portal Shell

The worker shell provides a smaller navigation set for upload, status, and contracts.

Requirements:

- The worker portal must support upload, status, and contracts views.
- Sign out must return the user to the landing page.
- Switching away from worker mode must clear the session and move to the admin login path.

## 7. Functional Requirements

### 7.1 Dashboard

The dashboard is the admin landing view for operational health.

Must show:

- Active workflow count.
- Critical alert count.
- Approvals queue count.
- Health score when available.
- Total workers, 30-day expiries, and compliance deadlocks when alert dashboard data exists.
- Statutory exposure and MTLM planning widgets.
- Blocked dependency table sourced from worker task data.

Must support:

- Clicking cards to navigate to alerts, workflows, or HITL.
- Displaying the latest worker-task refresh time.

### 7.2 Pipeline Board

The pipeline board is a Kanban-style operational map of workers across compliance gates.

Must show:

- Columns grouped by gate order from the worker types model.
- A count of workers in each gate.
- A blocked count per gate.
- Worker cards with nationality flag, name, ID, sector, and day-in-gate marker when present.
- HITL resolution affordance on blocked cards.

Must support:

- Horizontal scrolling.
- No manual drag-and-drop reordering.
- Automatic grouping from workflow data and alert-derived blocked IDs.

### 7.3 Workflow List and Detail

The workflows pages provide the execution-level view of worker compliance processes.

Must show in list view:

- Worker ID.
- Status badge.
- Compliance status.
- HITL required indicator.
- Started and updated timestamps.
- Workflow complete indicator.

Must show in detail view:

- Current status.
- Current agent.
- Compliance status.
- Completion state.
- Alerts.
- Agent observations.
- Approval controls when HITL is required.
- A ReactFlow compliance graph.
- Execution trace entries with status, output summary, and errors.

### 7.4 Worker Profile Visualizer

The worker profile visualizer is the graph-centric single-worker operations view.

Must show:

- A worker selector.
- Live task counts for completed and blocked items.
- A ReactFlow graph built from task dependencies.
- Visual states for active, blocked, and completed nodes.
- A live textual ruminative stream.
- A worker AI assistant chat panel.

Must support:

- Switching the active worker in the selector.
- Reflecting new task state through polling and Firestore stream updates.

### 7.5 Document Upload and Confirmation

There are multiple document-intake paths in the codebase.

The active worker upload route must:

- Accept a document type.
- Support file upload.
- Show a preview.
- Poll parse-job status.
- Show extracted passport fields when parsing completes.
- Advance a worker draft state in the store.

The alternate upload page in the repo must:

- Support document-type selection.
- Load expected fields from the backend.
- Upload a selected file.
- Poll parse jobs.
- Confirm parsed data and start the compliance workflow.

The PRD should treat the alternate path as [ASK USER] until the team confirms whether it is canonical or legacy.

### 7.6 HITL Queue and Medical Review

The HITL page has two tabs: workflow interrupts and contract review.

Workflow interrupts must:

- List pending workers.
- Allow selecting a pending worker.
- Display the reason for the interrupt.
- Display missing fields and allow manual input.
- Submit resolved fields back to the backend.

Medical review must:

- Show a worker’s medical item.
- Allow confirming a mock result.
- Return the user to the HITL page after confirmation.

Contract review must:

- List signed contracts.
- Show the signed contract PDF.
- Optionally show the worker’s passport image if available.
- Mark the contract reviewed.

### 7.7 Alerts

The alerts page must provide operational risk monitoring.

Must show:

- Total workers.
- Expired permits.
- 30-day expiries.
- 90-day expiries.
- Health score.
- Compliance deadlocks.
- FOMEMA due count.
- Passport issues.
- Critical alert list.
- Expiring permit list.

Must support:

- Triggering a scan of all workers.
- Refreshing the alert-related queries after a scan.

### 7.8 Simulator

The simulator page provides two planning tools.

MTLM levy simulation must:

- Accept sector, foreign-worker count, local-worker count, and planned hires.
- Show the quota usage baseline.
- Show tier structure for the chosen sector.
- Show projected levy impact and recommendations.

EP salary simulation must:

- Accept category, salary, and renewal date.
- Show pre-June and post-June threshold references.
- Show compliance result, shortfall when non-compliant, financial impact, and recommendation.

### 7.9 Workers and Invitations

The workers page is the admin roster view.

Must show:

- Search across name, passport number, and nationality.
- A table of workers with stage status indicators.
- A side drawer with passport, medical, and general information.

The invite page must:

- Add workers with name, email, and WhatsApp number.
- Assign login codes individually or in bulk.
- Edit WhatsApp numbers.
- Generate WhatsApp links containing credentials.
- Show worker credential state in a table.

### 7.10 Contract Generation and Worker Contract Management

The admin contract-generation page must:

- Upload a PDF template.
- Generate contracts for workers.
- List generated contracts.
- Download individual contract PDFs.
- Support signed upload for generated contracts.

The worker contract page must:

- Show the worker’s contracts.
- Allow download.
- Allow signed PDF upload when the contract is generated.
- Show reviewed and signed states.

### 7.11 Mock Government and Sync Views

The mock government portal must:

- Load workers for demo selection.
- Fetch agent-extracted data for a chosen worker.
- Autofill a mock IMM.47-style form.
- Submit a mock government application.
- Show a receipt modal on success or failure.

The dual-sync page must:

- Compare internal records against mock government records.
- Show matched, conflict, and not-filed counts.
- Let the user mark conflicts as resolved.
- Export a JSON sync report.

### 7.12 Calendar

The worker obligation calendar must:

- Load workers from the backend.
- Load obligations for the selected worker.
- Display a monthly calendar.
- Show passport renewal, permit renewal, and health-check obligations.
- Show upcoming obligations in a side panel.

## 8. Data and Integration Requirements

### Frontend Data Layer

The frontend uses a centralized API client with a configurable base URL. The repository shows calls for:

- document upload and confirmation,
- worker list and creation,
- task retrieval and updates,
- workflow status and resume,
- alerts and scans,
- HITL queue and resolution,
- simulator endpoints,
- contract generation and review,
- mock government routes,
- company listing.

The frontend also uses TanStack Query for caching and refetch behavior, Zustand for local session and workflow state, and Firebase client SDK for real-time Firestore reads.

### Backend Surfaces

The FastAPI app currently includes routers for workers, tasks, documents, agents, simulator, HITL, alerts, VDR, PLKS, company, compliance, analytics, medical, realtime, contracts, mock government, and chat.

### Real-Time Behavior

The codebase shows two kinds of live updates:

- Polling-based updates for parse jobs and worker tasks.
- Firestore-stream-based updates for live worker AI state.

The PRD should treat WebSocket-like real-time transport as [TODO] unless the backend team confirms which channels are canonical for production.

## 9. Key User Journeys

### Journey 1: Admin Reviews a Worker’s Compliance Risk

1. User logs into the admin portal.
2. Dashboard loads alert and workflow summaries.
3. User opens the pipeline board or workflow list.
4. User inspects a worker with blocked tasks.
5. If the worker needs review, the user resolves HITL or opens the workflow detail view.

### Journey 2: Worker Uploads a Passport and Confirms Profile

1. Worker logs into the worker portal.
2. Worker uploads a document.
3. The app previews the document and polls the parse job.
4. The worker reviews extracted fields.
5. The worker confirms the data.
6. The backend starts the workflow and the worker is routed to their status or workflow page.

### Journey 3: Admin Generates and Reviews Contracts

1. Admin opens contract generation.
2. Admin uploads a PDF template.
3. System generates contracts.
4. Admin downloads or reviews them.
5. Signed contracts are uploaded and later marked reviewed.

### Journey 4: Compliance Officer Resolves a HITL Interrupt

1. User opens the HITL page.
2. User selects a pending worker.
3. User fills missing fields or reviews the trigger reason.
4. User submits the resolution.
5. The worker resumes in the workflow.

## 10. Product Constraints

- The repository is already split into admin and worker portals.
- The frontend is built as a single-page application with client-side routing.
- The backend runs locally on port 8001 in the current development scripts.
- The codebase contains mock/demo screens alongside core operational screens.
- Some page implementations overlap or duplicate functionality, so a product owner should decide which route is canonical.

## 11. Success Metrics

The codebase does not define analytics events, so the following metrics are proposed based on product behavior and should be confirmed by the team.

- Time to upload and confirm a document.
- Number of workflows started per week.
- Number of blocked tasks resolved per week.
- Alert scan completion time.
- Contract generation completion rate.
- HITL resolution time.
- Worker login success rate.

These should be treated as [ASK USER] until product analytics requirements are finalized.

## 12. Risks and Gaps

- The repo contains multiple similar upload pages and worker-intake flows; the canonical user journey is not fully resolved.
- Several product ideas in the README describe capabilities that are more advanced than the current route implementations, so the PRD should not assume every narrative claim is already production behavior.
- Some pages rely on backend response shapes that are inferred from hooks and helper code rather than a formal schema contract.
- The mock government and sync experiences are clearly demo-oriented rather than live integrations.

## 13. Open Questions

1. [ASK USER] Which document-ingestion route is canonical for the product: [frontend/src/pages/worker/WorkerUploadPage.jsx](../frontend/src/pages/worker/WorkerUploadPage.jsx), [frontend/src/pages/worker/WorkerUploadPage2.jsx](../frontend/src/pages/worker/WorkerUploadPage2.jsx), or [frontend/src/pages/UploadPage.jsx](../frontend/src/pages/UploadPage.jsx)?
2. [ASK USER] Should the mock government portal and dual-sync views remain product features, or are they only demo scaffolding?
3. [ASK USER] Should the public PRD describe the current authentication approach as a temporary hackathon approach, or should it be presented as the intended production model?
4. [ASK USER] Are live backend updates expected to remain polling-based and Firestore-stream-based, or should the PRD reserve space for a different realtime transport?
5. [ASK USER] Which analytics and KPI targets should be added once the product owner defines success thresholds?

## 14. Evidence

- [frontend/src/App.jsx](../frontend/src/App.jsx)
- [frontend/src/main.jsx](../frontend/src/main.jsx)
- [frontend/src/components/AppLayout.jsx](../frontend/src/components/AppLayout.jsx)
- [frontend/src/components/WorkerLayout.jsx](../frontend/src/components/WorkerLayout.jsx)
- [frontend/src/pages/LandingPage.jsx](../frontend/src/pages/LandingPage.jsx)
- [frontend/src/pages/AdminLoginPage.jsx](../frontend/src/pages/AdminLoginPage.jsx)
- [frontend/src/pages/WorkerLoginPage.jsx](../frontend/src/pages/WorkerLoginPage.jsx)
- [frontend/src/pages/Dashboard.jsx](../frontend/src/pages/Dashboard.jsx)
- [frontend/src/pages/PipelinePage.jsx](../frontend/src/pages/PipelinePage.jsx)
- [frontend/src/pages/WorkflowsPage.jsx](../frontend/src/pages/WorkflowsPage.jsx)
- [frontend/src/pages/WorkflowDetailPage.jsx](../frontend/src/pages/WorkflowDetailPage.jsx)
- [frontend/src/pages/AlertsPage.jsx](../frontend/src/pages/AlertsPage.jsx)
- [frontend/src/pages/HITLPage.jsx](../frontend/src/pages/HITLPage.jsx)
- [frontend/src/pages/MedicalReviewPage.jsx](../frontend/src/pages/MedicalReviewPage.jsx)
- [frontend/src/pages/SimulatorPage.jsx](../frontend/src/pages/SimulatorPage.jsx)
- [frontend/src/pages/WorkersPage.jsx](../frontend/src/pages/WorkersPage.jsx)
- [frontend/src/pages/WorkerInvitePage.jsx](../frontend/src/pages/WorkerInvitePage.jsx)
- [frontend/src/pages/WorkerObligationCalendar.jsx](../frontend/src/pages/WorkerObligationCalendar.jsx)
- [frontend/src/pages/ContractGenerationPage.jsx](../frontend/src/pages/ContractGenerationPage.jsx)
- [frontend/src/pages/MockGovPortalPage.jsx](../frontend/src/pages/MockGovPortalPage.jsx)
- [frontend/src/pages/DualSyncPage.jsx](../frontend/src/pages/DualSyncPage.jsx)
- [frontend/src/pages/GraphVisualizerPage.jsx](../frontend/src/pages/GraphVisualizerPage.jsx)
- [frontend/src/pages/ConfirmPage.jsx](../frontend/src/pages/ConfirmPage.jsx)
- [frontend/src/pages/worker/WorkerUploadPage.jsx](../frontend/src/pages/worker/WorkerUploadPage.jsx)
- [frontend/src/pages/worker/WorkerStatusPage.jsx](../frontend/src/pages/worker/WorkerStatusPage.jsx)
- [frontend/src/pages/worker/WorkerContractPage.jsx](../frontend/src/pages/worker/WorkerContractPage.jsx)
- [frontend/src/services/api.js](../frontend/src/services/api.js)
- [frontend/src/services/firebase.js](../frontend/src/services/firebase.js)
- [frontend/src/services/taskAdapter.js](../frontend/src/services/taskAdapter.js)
- [frontend/src/store/useAuthStore.js](../frontend/src/store/useAuthStore.js)
- [app/main.py](../app/main.py)
- [README.md](../README.md)