# Malaysian Foreign Worker Compliance System — Enhancement Plan

> **Objective:** Transform the current working prototype into a production-grade, observable, and orchestration-first agentic system. Every step below targets a specific bottleneck. Follow the order — each step depends on the one before it.

---

## Current Bottlenecks (Honest Assessment)

| Component | Problem |
|---|---|
| `MemorySaver` | Not production-safe — state lost on restart |
| Firestore (for graph state) | Weak for graph execution, no replay support |
| Gemini raw SDK | Breaks LangSmith tracing and observability |
| Supervisor loop | Internal routing only — not a true orchestrator |
| ReactFlow | Status-based, not reasoning-aware or live |

---

## What to Keep vs. Change

### ✅ Keep
- FastAPI
- LangGraph (core engine)
- React + ReactFlow (UI layer)
- Firebase Firestore (for **business/app data only**)

### 🔄 Change / Add
- Replace `MemorySaver` → **PostgresSaver** (persistent checkpointer)
- Wrap Gemini calls → **LangChain interfaces** (enables LangSmith)
- Add **LangSmith** as primary tracing and debug layer
- Add **LangGraph Studio** for internal dev-only graph inspection
- Add a dedicated **Orchestrator Agent** as the top-level entry point

---

## Final Target Architecture

```
User Chat Interface
        ↓
  Orchestrator Agent
        ↓
  Master LangGraph
        ↓
┌───────┼───────────┐
↓       ↓           ↓
VDR  Compliance  Simulator
Graph   Graph     Tools
        ↓
 Persistent State (PostgreSQL)
 Business Data   (Firestore)
 Tracing         (LangSmith)
        ↓
  WebSocket Stream
        ↓
  ReactFlow Live UI
```

---

## Step-by-Step Enhancement Plan

---

### STEP 1 — Fix State Persistence (Foundation)

**Problem:** `MemorySaver` loses all state on restart. Workflows cannot be resumed. LangSmith cannot replay executions.

**Action:**
1. Install `langgraph[checkpoint-postgres]`
2. Replace every instance of `MemorySaver` with `PostgresSaver`
3. Configure PostgreSQL connection using environment variables
4. Restrict Firestore usage to business data only (workers, companies, documents)

**Implementation:**
```python
from langgraph.checkpoint.postgres import PostgresSaver

DB_URI = "postgresql://user:password@host/dbname"
checkpointer = PostgresSaver.from_conn_string(DB_URI)

graph = builder.compile(checkpointer=checkpointer)
```

**Firestore must only store:**
- Worker profiles
- Company records
- Uploaded documents

**Firestore must NOT store:**
- Graph execution state
- Node checkpoints
- Step history

**Expected Output:**
- Workflows survive server restarts
- LangSmith can replay any execution from any step
- Orchestrator can resume paused workflows by `thread_id`

---

### STEP 2 — Unify the LLM Layer (Critical for Observability)

**Problem:** Direct Gemini SDK calls bypass LangChain's instrumentation layer, making LangSmith tracing useless.

**Action:**
1. Remove all raw `google.generativeai` SDK calls
2. Replace with LangChain-wrapped equivalents:

```python
# BEFORE (broken for tracing)
import google.generativeai as genai
response = genai.GenerativeModel("gemini-pro").generate_content(prompt)

# AFTER (traceable)
from langchain_google_genai import ChatGoogleGenerativeAI

llm = ChatGoogleGenerativeAI(model="gemini-1.5-pro", temperature=0)
response = llm.invoke(prompt)
```

3. Apply this replacement to **every** node that calls an LLM

**Expected Output:**
- Every LLM call automatically appears in LangSmith
- Prompts, outputs, latency, and failures are logged without extra code
- Tracing works end-to-end across all agents and nodes

---

### STEP 3 — Design the Orchestrator Agent

**Problem:** There is no true top-level entry point. The current "supervisor" is internal graph routing, not a brain that understands user language.

**Responsibility of the Orchestrator:**
- Parse user natural language input
- Map intent → system action
- Build initial state
- Trigger the correct LangGraph pipeline
- Return status to the user

**The Orchestrator must NOT:**
- Perform compliance reasoning
- Parse documents
- Do salary calculations
- Handle deep domain logic

**Prompt Design:**
```
You are the Orchestrator of a Malaysian foreign worker compliance system.
Your job is to translate user requests into structured system actions.

Available actions:
1. START_VDR_WORKFLOW
2. RUN_COMPLIANCE_AUDIT
3. RESUME_WORKFLOW
4. RUN_SIMULATION
5. GET_STATUS

Rules:
- Be deterministic
- Do not hallucinate missing data
- If required data is missing, set requires_input to true and ask for clarification
- Always return valid JSON only — no prose, no markdown

Output format:
{
  "action": "...",
  "worker_id": "...",
  "parameters": {},
  "requires_input": false,
  "message": "..."
}
```

**Capability Registry (prevent LLM guessing):**
```python
CAPABILITIES = {
    "vdr": ["documents", "imm47", "validation"],
    "compliance": ["audit", "expiry", "fines"],
    "simulation": ["mtlm", "salary"]
}
```

Inject this registry into the system prompt so the LLM understands what each pipeline can do.

**Expected Output — Example:**
```
User: "Start VDR for worker A123"

Orchestrator Output:
{
  "action": "START_VDR_WORKFLOW",
  "worker_id": "A123",
  "parameters": {},
  "requires_input": false,
  "message": "Starting VDR workflow for worker A123"
}
```

---

### STEP 4 — Connect Orchestrator to Graph Execution

**Problem:** Workflows are currently triggered manually via direct API calls. There is no dynamic orchestration from natural language.

**Action:**
1. Implement the orchestrator handler that routes decisions to graphs
2. The orchestrator calls `graph.invoke()` dynamically with a `thread_id`

**Implementation:**
```python
def orchestrator_handler(user_input: str):
    decision = orchestrator_llm(user_input)
    action = decision["action"]

    if action == "START_VDR_WORKFLOW":
        return start_vdr(decision["worker_id"])

    elif action == "RUN_COMPLIANCE_AUDIT":
        return run_compliance(decision["worker_id"])

    elif action == "RESUME_WORKFLOW":
        return resume_workflow(decision["worker_id"])

    elif action == "RUN_SIMULATION":
        return run_simulator(decision["parameters"])

    elif action == "GET_STATUS":
        return get_status(decision["worker_id"])


def start_vdr(worker_id: str):
    thread_id = f"vdr-{worker_id}-{uuid4()}"
    initial_state = build_initial_vdr_state(worker_id)

    result = vdr_graph.invoke(
        initial_state,
        config={"configurable": {"thread_id": thread_id}}
    )
    return result
```

**Expected Output:**
- User message triggers graph execution automatically
- Each execution gets a unique `thread_id` for tracking and resumption
- No manual API calls needed to start workflows

---

### STEP 5 — Restructure the Codebase (Graph Layers)

**Problem:** Two disconnected graphs, supervisor overloaded, no master entry point.

**New Folder Structure:**
```
app/
  agents/
    orchestrator/
      node.py          ← orchestrator LLM node
      prompt.py        ← prompt template
    graphs/
      vdr_graph.py     ← VDR pipeline
      compliance_graph.py
      master_graph.py  ← NEW: top-level entry graph
    nodes/
      vdr_nodes.py
      compliance_nodes.py
    state/
      orchestrator_state.py
      vdr_state.py
      compliance_state.py
  services/
    orchestrator_service.py
```

**Orchestrator State:**
```python
class OrchestratorState(TypedDict):
    user_input: str
    action: str
    worker_id: str
    parameters: dict
    status: str
    result: dict
```

**Master Graph (new top-level graph):**
```python
from langgraph.graph import StateGraph

builder = StateGraph(OrchestratorState)

builder.add_node("orchestrator", orchestrator_node)
builder.add_node("router", router_node)

builder.set_entry_point("orchestrator")
builder.add_edge("orchestrator", "router")

builder.add_conditional_edges(
    "router",
    lambda state: state["action"],
    {
        "START_VDR_WORKFLOW":   "vdr_graph",
        "RUN_COMPLIANCE_AUDIT": "compliance_graph",
        "RUN_SIMULATION":       "simulator",
        "END":                  "__end__"
    }
)
```

**Split Supervisor Responsibilities:**

| Role | Responsibility |
|---|---|
| Orchestrator | User-facing — understands intent, makes decisions |
| Supervisor | Graph-internal routing only — no domain logic |

**Expected Output:**
- Single entry point for all workflows
- Master graph fans out to the correct sub-graph
- Supervisor is lightweight — routing logic only

---

### STEP 6 — Implement the Global State Schema

**Problem:** `VDRState` and `WorkerComplianceState` have duplicated fields, unclear ownership, and no structure that maps to the UI.

**New Layered Global State:**
```python
class GlobalState(TypedDict):
    meta:       dict   # orchestrator owns
    worker:     dict   # parser owns
    documents:  dict   # parser owns
    compliance: dict   # validator/auditor owns
    vdr:        dict   # vdr nodes own
    tasks:      dict   # reasoning agent owns
    agents:     dict   # graph engine owns
    system:     dict   # shared (controlled writes)
```

**Section Schemas:**

```python
# meta — orchestrator only
meta = {
    "worker_id": str,
    "workflow_id": str,
    "current_phase": str,   # vdr / compliance / simulation
    "current_node": str,
    "status": str,          # running / paused / completed / failed
    "version": int,
    "last_updated_by": str,
    "created_at": str,
    "updated_at": str
}

# worker — parser owns, reasoning agents read-only
worker = {
    "personal": {"name": str, "passport_no": str, "nationality": str, "dob": str, "age": int},
    "employment": {"sector": str, "employer_id": str, "salary": float, "permit_type": str}
}

# documents — parser owns
documents = {
    "passport": {"fields": {}, "confidence": {}, "verified": bool},
    "fomema":   {"status": str, "expiry": str},
    "ssm": {},
    "act446": {},
    "contracts": []
}

# compliance — validator/auditor owns
compliance = {
    "status": str,       # compliant / non-compliant / blocked
    "violations": [],
    "alerts": [],
    "deadlocks": [],
    "risk_score": float,
    "checks": {"passport_valid": bool, "quota_ok": bool, "age_valid": bool}
}

# vdr — vdr pipeline owns
vdr = {
    "stage": str,
    "completed_steps": [],
    "missing_requirements": [],
    "signatures": {"contract_signed": bool, "imm47_signed": bool},
    "form_data": {},
    "ready_for_submission": bool
}

# tasks — reasoning agent owns
tasks = {
    "pending":   [{"id": str, "type": str, "due_date": str, "priority": str, "assigned_agent": str}],
    "completed": [],
    "blocked":   []
}

# agents — graph engine owns (for UI + debug)
agents = {
    "history": [{"agent": str, "action": str, "status": str, "timestamp": str}],
    "current": str,
    "last_output": dict
}

# system — shared, all nodes may write
system = {
    "hitl_required": bool,
    "hitl_reason": str,
    "errors": [],
    "retry_count": int,
    "max_retries": 3
}
```

**Ownership Rules (enforce strictly):**

| Section | Owner | Others |
|---|---|---|
| `meta` | Orchestrator | Read only |
| `worker` | Parser node | Read only |
| `documents` | Parser node | Read only |
| `compliance` | Validator / Auditor | Read only |
| `vdr` | VDR nodes | Read only |
| `tasks` | Reasoning agent | Read only |
| `agents` | Graph engine | Read only |
| `system` | All nodes | Controlled writes |

**Write Rules:**
```python
# WRONG — overwrites entire section
state["worker"] = new_data

# CORRECT — targeted update only
state["worker"]["personal"]["name"] = "Ali"
```

**Node Update Pattern:**
```python
# document_parser_node
return {**state, "documents": updated_docs, "worker": extracted_worker_info}

# validator_node
return {**state, "compliance": updated_compliance}

# orchestrator
return {**state, "meta": updated_meta}
```

**Expected Output:**
- No duplicated fields across state objects
- Clear section ownership prevents corruption
- State maps directly to ReactFlow node groups
- Versioning (`meta.version`) enables LangSmith replay and diff tracking

---

### STEP 7 — Implement State Diff Tracking

**Problem:** You log traces but cannot see what changed, where, who changed it, and why — making debugging and UI reasoning impossible.

**Diff Data Structure:**
```python
state_diff = {
    "node": "validator_node",
    "timestamp": "2024-01-15T10:30:00Z",
    "changes": [
        {"path": "compliance.status",       "old": "pending",  "new": "non-compliant"},
        {"path": "compliance.violations[0]", "old": None,      "new": "Passport < 18 months"}
    ],
    "summary": "Passport validity check failed",
    "status": "completed"
}
```

**Diff Helper Function:**
```python
from copy import deepcopy

def compute_diff(old: dict, new: dict, path: str = "") -> list:
    diffs = []
    for key in new:
        new_path = f"{path}.{key}" if path else key
        if key not in old:
            diffs.append({"path": new_path, "old": None, "new": new[key]})
        elif isinstance(new[key], dict):
            diffs.extend(compute_diff(old.get(key, {}), new[key], new_path))
        elif old.get(key) != new[key]:
            diffs.append({"path": new_path, "old": old.get(key), "new": new[key]})
    return diffs
```

**Node Wrapper (wrap every node):**
```python
def run_node(node_func, state: dict) -> dict:
    old_state = deepcopy(state)
    new_state = node_func(state)
    diff = compute_diff(old_state, new_state)

    emit_diff({
        "node": node_func.__name__,
        "diff": diff,
        "summary": new_state.get("agents", {}).get("last_output", {}).get("summary", "")
    })

    return new_state
```

**Firestore Storage (diffs only, not full state):**
```
workflows/{worker_id}/diffs/{step_id}
  - node: "validator_node"
  - diff: [...]
  - summary: "Passport validity check failed"
  - timestamp: "..."
```

**Do NOT** store full state snapshots in Firestore — store only:
- Checkpoints → PostgreSQL (via LangGraph)
- Diffs → Firestore

**Expected Output:**
- Every node execution produces a structured diff
- Diffs are streamed in real time to the UI
- Full execution replay is possible by replaying ordered diffs
- LangSmith shows prompts + execution tree; ReactFlow shows business state changes

---

### STEP 8 — Make the Graph Live (WebSocket + ReactFlow)

**Problem:** ReactFlow is status-based and static. Users cannot see what is happening or why decisions were made.

**Node Emission Events:**
Each node must emit on start and completion:
```python
# On node start
realtime_dashboard_manager.broadcast({
    "type": "node_started",
    "node": "validator_node",
    "timestamp": "..."
})

# On node completion
realtime_dashboard_manager.broadcast({
    "type": "state_diff",
    "node": "validator_node",
    "diff": diff,
    "summary": "Passport validity check failed",
    "status": "completed"
})
```

**ReactFlow Node Visual States:**

| State | Color | Badge |
|---|---|---|
| `running` | 🟡 Yellow | Spinner |
| `completed` | 🟢 Green | ✔ + change count |
| `failed` | 🔴 Red | ✖ + error |
| `hitl_paused` | 🔴 Red pulse | Waiting for input |

**Node Card Display:**
```
[ Validator Node ]
✔ Completed
⚠ 2 changes
"Passport validity check failed"
```

**Side Panel (on node click):**
```
Node: validator_node

Changes:
- compliance.status
    pending → non-compliant

- compliance.violations[0]
    → "Passport < 18 months"
```

**Timeline View (reasoning playback):**
```
1. document_parser_node   ✔  →  Click to inspect diff
2. validator_node         ✔  →  Click to inspect diff
3. compliance_reasoner    ◌  →  Running...
```

**Diff Color Mapping:**

| Change Type | Color |
|---|---|
| New value added | 🟢 Green |
| Value modified | 🟡 Yellow |
| Error / failure | 🔴 Red |

**Expected Output:**
- Graph updates in real time without page refresh
- Users see which agent is running, what it decided, and what changed
- Clicking any node shows its full diff and summary
- Timeline enables full reasoning playback from any point

---

### STEP 9 — Add Evaluation Nodes (Accuracy Loop)

**Problem:** There is no explicit evaluation/retry loop. Nodes execute once and move on, even if the result is poor quality.

**Pattern to Add:**
```
Executor Node → Evaluator Node → (pass) → next node
                               → (fail)  → Retry → Executor
```

**Evaluator Node Template:**
```python
def evaluator_node(state: GlobalState) -> GlobalState:
    last_output = state["agents"]["last_output"]
    retry_count = state["system"]["retry_count"]
    max_retries = state["system"]["max_retries"]

    is_valid = validate_output(last_output)

    if not is_valid and retry_count < max_retries:
        return {
            **state,
            "system": {
                **state["system"],
                "retry_count": retry_count + 1
            },
            "meta": {**state["meta"], "current_node": "retry"}
        }

    return {
        **state,
        "meta": {**state["meta"], "current_node": "next_node"}
    }
```

**Apply this loop to:**
- Document parser output validation
- Compliance reasoning output validation
- VDR form data validation before submission

**Expected Output:**
- Agents retry automatically on low-confidence or invalid outputs
- Retry count is tracked in `system.retry_count`
- Maximum retries are enforced via `system.max_retries`

---

### STEP 10 — Enable LangSmith Tracing

**Problem:** Without LangChain wrappers (Step 2) and correct env setup, LangSmith captures nothing useful.

**Action:**
1. Set environment variables:
```bash
LANGCHAIN_TRACING_V2=true
LANGCHAIN_API_KEY=your_key
LANGCHAIN_PROJECT=foreign-worker-compliance
```

2. Enable globally in app startup:
```python
import os
os.environ["LANGCHAIN_TRACING_V2"] = "true"
```

3. No additional code needed — LangChain wrappers (Step 2) handle the rest.

**LangSmith provides (internal dev use only):**
- Full execution tree per workflow
- Prompt + response per LLM call
- Node-level latency
- Failure point identification

**LangSmith is NOT the user-facing UI.** ReactFlow remains the user-facing graph.

**Expected Output:**
- Every workflow execution appears in LangSmith dashboard
- Any failed workflow can be debugged by inspecting the exact prompt and response that caused failure
- Latency bottlenecks are visible per node

---

### STEP 11 — Use LangGraph Studio (Dev Only)

**Purpose:** Internal development tooling. Do not expose to users.

**Use LangGraph Studio to:**
- Validate node transitions visually
- Test conditional routing logic
- Debug infinite loops or deadlocks
- Inspect state at each checkpoint

**Setup:**
```bash
pip install "langgraph-cli[inmem]"
langgraph dev
```

**Expected Output:**
- Developers can step through graph execution interactively
- State at each checkpoint is visible and inspectable
- Routing logic can be tested without running the full application

---

## Full End-to-End Flow (Final Behavior)

```
User types: "Check all workers expiring soon and fix issues"
                ↓
        Orchestrator parses intent
                ↓
        Returns structured action JSON
                ↓
        Master Graph routes to Compliance Graph
                ↓
        Graph nodes execute sequentially
                ↓
        Each node emits state diff via WebSocket
                ↓
        ReactFlow updates live:
          - Nodes turn yellow (running)
          - Nodes turn green (completed)
          - Diff + summary appear in side panel
          - Timeline tracks reasoning history
                ↓
        HITL pause shown in red if human input needed
                ↓
        User approves → Graph resumes
                ↓
        Final state persisted in PostgreSQL
        Business data updated in Firestore
        Full trace visible in LangSmith
```

---

## Implementation Priority Order

| Priority | Step | Impact |
|---|---|---|
| 🔴 Critical | Step 1 — PostgresSaver | System stability |
| 🔴 Critical | Step 2 — LangChain wrappers | Observability foundation |
| 🔴 Critical | Step 3 + 4 — Orchestrator | Unified entry point |
| 🟡 High | Step 5 — Restructure codebase | Maintainability |
| 🟡 High | Step 6 — Global state schema | Correctness + UI sync |
| 🟡 High | Step 7 — Diff tracking | Debuggability |
| 🟡 High | Step 8 — Live ReactFlow | User experience |
| 🟢 Medium | Step 9 — Evaluation nodes | Accuracy |
| 🟢 Medium | Step 10 — LangSmith | Dev observability |
| 🟢 Low | Step 11 — LangGraph Studio | Dev tooling |

---

## What NOT to Do

- ❌ Do not add more agents before Steps 1–4 are complete
- ❌ Do not add new features before execution is observable
- ❌ Do not let the LLM control graph routing fully — keep the router deterministic
- ❌ Do not merge all logic into one giant graph
- ❌ Do not store full state snapshots in Firestore — only diffs
- ❌ Do not expose LangGraph Studio or LangSmith to end users
- ❌ Do not use raw Gemini SDK anywhere in the agent layer
- ❌ Do not overwrite entire state sections — update targeted fields only