Frontend System Prompt: PermitIQ App (Agentic Workflow UI)
System Context for Code Generator:
You are building the frontend MVP for "PermitIQ," an enterprise SaaS dashboard that uses a LangGraph-orchestrated AI agent (powered by GLM-5) to manage foreign worker compliance in Malaysia.
The UI must interact with a FastAPI backend connected to Firebase. The frontend is not just a standard CRUD app; it is a visualizer for an autonomous agent. It must handle polling for background parse jobs, explicit human-in-the-loop confirmation steps, and use React Flow to render the backend LangGraph state (showing nodes firing, cycles, and blocked dependencies).

1. Technical Stack & Design System
Framework: React (Next.js App Router preferred) + Axios/Fetch for FastAPI integration.

Styling: Tailwind CSS.

UI Components: Shadcn UI (Cards, Badges, Progress, Data Tables, Dialogs, Tabs, Toasts for polling updates).

Graph Visualization (CRITICAL): React Flow (Used to visualize the LangGraph execution path and task dependencies).

State Management (CRITICAL): Do not use prop-drilling or basic useState for the graph data. You MUST use Zustand to create a global useWorkerStore. This store will hold the worker_id, the parse_job_status, and the tasks array. React Flow nodes must subscribe to this store so they re-render instantly when a task's status changes from pending to completed.

Icons: Lucide React.

Color Palette:

Primary/Brand: Trustworthy Navy/Slate (slate-900 to slate-800).

Status Green: emerald-500 (Completed).

Status Amber/Pulse: amber-500 animate-pulse (Agent is actively processing/rumination state).

Status Red: rose-600 (Blocked task / Failed dependency).

Agentic Purple: indigo-500 (Autonomous actions).

2. API Data Layer Expectations (FastAPI + Firebase)
The UI components must be built to support these specific backend flows:

Upload Flow: POST /documents/upload -> initiate polling GET /documents/jobs/{job_id} until status === 'completed'.

Confirmation Flow: POST /documents/{document_id}/confirm (sends human-validated schema, triggers worker creation and LangGraph task generation).

Task Flow: GET /workers/{worker_id}/tasks (returns array with depends_on gating). Update via PATCH /workers/{worker_id}/tasks/{task_id}.

3. Core Page Specifications
Page 1: Executive Dashboard & Task Tracking
Goal: High-level view of system health, financial risk, and blocked worker workflows.

Component A: Agentic System Health (Top Cards)

Active LangGraph Runs, Blocked Tasks, and Pending Human Confirmations.

Strict Liability Exposure Widget (High Contrast Card): A dynamic counter displaying aggregated potential liability (e.g., "Critical Risk: RM 50,000 Fine Exposure"). Style this with a subtle rose background and bold red typography. This must pull data from the CalculateFines tool executions.

Component B: Blocked Dependency Table (Center)

A data table tracking GET /workers/{worker_id}/tasks.

Highlight rows where status === 'blocked'.

Include a column showing the depends_on task that caused the blockage (e.g., "MyEG Renewal [Blocked] -> Fails on: FOMEMA Clearance").

Page 2: Document Ingestion & Human-in-the-Loop Triage
Goal: Exercise the FastAPI "Parse Job -> Confirm -> Create" scaffold.

Component A: Upload & Polling State

Drag-and-drop zone.

Upon upload, show a Shadcn Progress bar or skeleton loader.

UI State Rule: Display "Agent extracting data..." while polling the GET /documents/jobs/{job_id} endpoint.

Component B: The "Confirm & Create" Schema Form

Trigger: When polling completes.

UI: A side-by-side view. Left: Document image. Right: Extracted fields (mocked or real) with confidence scores.

Action: A prominent "Confirm & Generate Obligations" button (POST /documents/{document_id}/confirm).

Note for UI: Expect the payload to map to an obligations array (handling the backend schema resolution).

Page 3: Worker Profile & LangGraph Visualizer (The Star Feature)
Goal: Visually map the backend LangGraph orchestration and GLM-5 rumination using React Flow.

Component A: Worker Header

Avatar, Name, Passport No., and current overall workflow state.

Component B: React Flow Canvas (Centerpiece)

A dynamic, node-based graph mirroring the LangGraph state.

Node Types: DocumentAudit, ComplianceCheck, CalculateFines (Tool Use), MyEGPending.

Visual Rules:

Active Node: Give the node currently being executed a glowing indigo border (ring-4 ring-indigo-500 animate-pulse).

Completed Node: Solid green border, checkmark icon.

Blocked Node: Solid red, padlock icon. Edges (connecting lines) to blocked nodes should be dashed red to show a failed depends_on gate.

Cycles: Use curved React Flow edges to visualize if the graph cycles backward (e.g., ComplianceCheck fails and loops back to HumanInput).

Component C: GLM-5 "Rumination" Terminal (Bottom or Side Panel)

A dark-mode terminal window (styling: bg-slate-900 text-green-400 font-mono).

Streams the internal chain-of-thought from the agent.

Example Text: > Agent entering ComplianceCheck node...
> Ruminating: Passport expires in 45 days. 13MP requires Fomema. Checking dependencies...
> Dependency 'fomema_clearance' is FALSE.
> Action: Marking task 'renew_plks' as BLOCKED.

Page 4: Interactive Tool Execution & Payload Handoff
Goal: Handle states where LangGraph pauses and waits for user input or hands off external payloads.

Component A: The Edge-Case Modal

Trigger: When the React Flow hits a state requiring human tool approval (e.g., approving a calculated fine).

UI: Displays the tool payload (e.g., {"days_overstayed": 45, "fine": "RM 1000"}).

Action: "Approve & Resume Graph" button (PATCH request to update the task status and unblock the LangGraph cycle).

Component B: MyEG Payload Execution Widget

Trigger: Appears dynamically when the MyEGPending node becomes active and all upstream dependencies are satisfied.

UI: A visually distinct Card displaying a highly structured, read-only key-value list (Levy Amount, Processing Fee, Worker ID).

Action: A large primary button "Copy Payload" (using the Lucide Copy icon) allowing the HR manager to bypass manual data entry when remitting payment on the external government portal.

4. Specific Micro-Interactions & State Rules
Polling Transitions: When polling the parse_jobs endpoint, transition the UI smoothly from a general spinner to specific extraction steps (even if simulated on the frontend) to give the illusion of deep OCR work. Create a custom React hook useParseJobPolling(jobId) using setInterval (2000ms) that clears immediately on success/fail.

React Flow Mock Initial State: Initialize the React Flow instance mapped to the depends_on logic. Give it dummy data ensuring one node is completed, one is pulsing (ruminating), and one is blocked with dashed red lines to prove the visualizer works out of the box.

Error Handling (Backend Mismatches): If the POST /confirm endpoint throws a 500 (due to the known obligation vs obligations schema bug on the backend), catch it and display a Shadcn Toast: "Error: Schema mismatch on obligation generation. Please check backend LangGraph alignment."