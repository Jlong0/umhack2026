# UMHack 2026 - PermitIQ

Monorepo containing:

- FastAPI backend in `app/`
- React + Vite frontend in `frontend/`
- Shared root scripts for one-command local development

## Root Structure

- `app/` backend API, routes, services, schemas
- `frontend/` frontend application
- `docs/` product and implementation docs
- `run.py` backend launcher
- `requirements.txt` backend dependencies
- `package.json` root dev scripts (`dev:backend`, `dev:frontend`, `dev:full`)

## Run Locally

### 1) Backend dependencies

```bash
python -m pip install -r requirements.txt
```

### 2) Frontend dependencies

```bash
cd frontend
npm install
cd ..
```

### 3) Firebase credentials

Create `.env` in the repository root and set:

```env
FIREBASE_CREDENTIALS_PATH=C:/absolute/path/to/serviceAccountKey.json
```

### 4) Start both services

```bash
npm install
npm run dev:full
```

Frontend runs on `http://localhost:5173` (or next free port), backend on `http://127.0.0.1:8000`.
