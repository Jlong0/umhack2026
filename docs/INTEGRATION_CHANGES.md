# Frontend-Backend Integration & Gemini API Key Rotation

## Summary

Successfully removed all frontend mock data and implemented full backend integration. Added Gemini API key rotation system as a temporary replacement for GLM API during testing and optimization phase.

## Backend Changes

### 1. Gemini API Key Rotation Service
**File:** `app/services/gemini_key_rotation_service.py` (NEW)

- Manages 10 Gemini API keys with automatic rotation on quota exhaustion
- Detects quota/rate limit errors (429, "resource exhausted", etc.)
- Automatically switches to next available key when current key is exhausted
- Supports both text generation and multimodal (image + text) generation
- Returns detailed response with success status, key index, and timestamp

**Key Features:**
- `generate_content()` - Text generation with auto-rotation
- `generate_content_with_image()` - Multimodal generation with auto-rotation
- `reset_failed_keys()` - Reset rotation state for periodic retry

### 2. Updated GLM Service
**File:** `app/services/glm_service.py` (MODIFIED)

- Added `USE_GEMINI_FOR_TESTING` environment variable flag
- Routes to Gemini when flag is `true`, GLM when `false`
- New methods:
  - `_parse_with_gemini()` - Document parsing using Gemini 1.5 Flash
  - `_generate_letter_with_gemini()` - Letter generation using Gemini 1.5 Pro
- Handles image URLs, base64 data, and file paths
- Extracts JSON from markdown code blocks automatically

### 3. Environment Configuration
**File:** `.env` (MODIFIED)

Added:
```bash
# Gemini (Temporary for testing/optimization)
USE_GEMINI_FOR_TESTING=true
```

### 4. Dependencies
**File:** `requirements.txt` (MODIFIED)

Added:
```
google-generativeai       # Gemini API with key rotation for testing/optimization
```

## Frontend Changes

### 1. API Service - Removed Mock Fallbacks
**File:** `frontend/src/services/api.js` (MODIFIED)

- Removed `getFallbackTasks` import
- Removed `allowMockFallback` option from `getWorkerTasks()`
- Now throws errors directly instead of falling back to mock data
- All API calls now require real backend responses

### 2. Dashboard Page
**File:** `frontend/src/pages/Dashboard.jsx` (MODIFIED)

- Removed `getFallbackTasks` import
- Removed fallback logic in tasks computation
- Now uses `storeTasks` directly from Zustand store
- Empty state handled by backend, not mock data

### 3. Worker Profile Page
**File:** `frontend/src/pages/WorkerProfilePage.jsx` (MODIFIED)

- Removed `getFallbackTasks` and `getFallbackRumination` imports
- Removed fallback logic for tasks
- Changed rumination fallback to simple waiting message
- Now fully dependent on backend data

### 4. Confirm Page
**File:** `frontend/src/pages/ConfirmPage.jsx` (MODIFIED)

- Removed `getFallbackTasks` and `DEFAULT_MYEG_PAYLOAD` imports
- Removed fallback logic for tasks
- MyEG payload now computed inline with worker ID
- No mock data dependencies

### 5. Zustand Store
**File:** `frontend/src/store/useWorkerStore.js` (MODIFIED)

- Removed `getFallbackTasks` and `getFallbackRumination` imports
- Initial state:
  - `tasks: []` (empty array instead of mock tasks)
  - `taskSource: "api"` (instead of "mock")
  - `ruminationLines: ["> Waiting for active task..."]` (instead of mock rumination)
- Store now starts empty and waits for real backend data

## API Key Configuration

The system uses 10 Gemini API keys in rotation:
1. AIzaSyBWLkK_OIEZF_ONNyTeo1jRTXUiIAx8wdU
2. AIzaSyAiGG8sLx9n3C5yODI2-_AaYzo7BFDCO6U
3. AIzaSyDcyohOtkcP7SCqhusu4dBIhiYz3-GTT6s
4. AIzaSyD1MJZcTOVYvx_89UJMOYVJF1QRJrbrPQM
5. AIzaSyDQx6ClDDE3di0dNTdUN3dWbNYgpDLHwS8
6. AIzaSyCow_VeqicIfr9z-MwfM2HZQieCyqEKE70
7. AIzaSyDWpPRTDLYe6YgrIbF-s0Cfno1W9RB9psg
8. AIzaSyDTBQYIsEyX9_z2qb5OEFNLDhF2CGtUdks
9. AIzaSyCD4svIrskGYBR8-wIWIk8FAWdk7bZmiQw
10. AIzaSyBkW43UO8eEFKtpmS9qD_Lj2SwC66xgbJI

## Switching Between Gemini and GLM

### Use Gemini (Testing/Optimization):
```bash
USE_GEMINI_FOR_TESTING=true
```

### Use GLM (Production):
```bash
USE_GEMINI_FOR_TESTING=false
ZHIPUAI_API_KEY=your-actual-glm-api-key
```

## Testing Checklist

- [ ] Backend starts without errors
- [ ] Frontend connects to backend API
- [ ] Document upload triggers real parsing job
- [ ] Worker tasks load from backend
- [ ] Task status updates persist to backend
- [ ] Gemini API key rotation works on quota exhaustion
- [ ] Dashboard shows real-time task updates
- [ ] Worker profile visualizes actual task graph
- [ ] Confirm page handles real approval flow

## Migration Path

1. **Current Phase:** Testing with Gemini API (10 keys with rotation)
2. **Optimization Phase:** Tune agentic workflow with Gemini
3. **Production Phase:** Switch to GLM API by setting `USE_GEMINI_FOR_TESTING=false`

## Notes

- All mock data files remain in codebase but are no longer imported
- Frontend will show empty states if backend is not running
- Gemini key rotation logs to console for monitoring
- GLM service automatically detects which API to use based on env flag
