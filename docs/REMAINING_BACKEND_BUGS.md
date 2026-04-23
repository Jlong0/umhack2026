# Backend Bugs for Team Resolution

> These bugs require changes in `app/` (FastAPI). Frontend team cannot fix these.
> Updated: 2026-04-24

---

## BUG 1: Duplicate CORS Middleware in `main.py`
**File:** `app/main.py` lines 12-19 and lines 30-41
**Impact:** Doubled `Access-Control-Allow-Origin` headers, intermittent preflight failures
**Fix:** Remove lines 30-41 (the second `app.add_middleware(CORSMiddleware, ...)` block)

---

## BUG 2: HITL `/interrupts/stats` route conflict with `/{worker_id}`
**File:** `app/routes/hitl.py` lines 59 and 150
**Impact:** `GET /hitl/interrupts/stats` matches `{worker_id}="stats"` → 404 error
**Fix:** Move the `@router.get("/interrupts/stats")` definition (line 150) **above** `@router.get("/interrupts/{worker_id}")` (line 59)

---

## BUG 3: PipelinePage needs joined worker + workflow data
**File:** `app/routes/agent.py` → `GET /agents/workflows`
**Impact:** Frontend Kanban cards expect `first_name`, `last_name`, `nationality`, `sector`, `current_gate`, `days_in_gate` but the endpoint only returns `{ worker_id, status, compliance_status, hitl_required, workflow_complete }`
**Fix option A:** Enrich the `/agents/workflows` response with worker profile fields from the `workers` collection
**Fix option B:** Add a `GET /workers` list endpoint that returns full worker profiles (the existing one in `__init__.py` returns `[]`)

---

## BUG 4: `confirmDocument` Pydantic schema needs documentation
**File:** `app/schemas/document.py` → `ConfirmDocumentData`
**Impact:** Frontend sends arbitrary parsed form fields. If schema doesn't match → 422 Unprocessable Entity
**Fix:** Share the `ConfirmDocumentData` schema fields with the frontend team so `api.js` can send the correct shape

---

## BUG 5: `GET /workers` returns hardcoded empty array
**File:** `app/routes/__init__.py` lines 5-7
**Impact:** No way for the frontend to list workers independently of workflows
**Fix:** Implement actual worker listing from Firestore `workers` collection
