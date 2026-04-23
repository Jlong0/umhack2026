from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routes import worker, task, document, agent, simulator, hitl, alerts
from app.routes import vdr, plks, company, compliance, analytics, medical
from app.routes import realtime

app = FastAPI(
    title="PermitIQ",
    description="Autonomous Foreign Worker Compliance Engine for Malaysian SMEs",
    version="1.0.0"
)

# CORS middleware for frontend integration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(worker.router)
app.include_router(task.router)
app.include_router(document.router)
app.include_router(agent.router)
app.include_router(simulator.router)
app.include_router(hitl.router)
app.include_router(alerts.router)
app.include_router(vdr.router)
app.include_router(plks.router)
app.include_router(company.router)
app.include_router(compliance.router)
app.include_router(analytics.router)
app.include_router(medical.router)
app.include_router(realtime.router)

origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
@app.get("/")
def root():
    return {
        "status": "PermitIQ backend running",
        "version": "1.0.0",
        "features": [
            "Multimodal Document Triage (GLM-4V)",
            "Agentic Audit & Quality Control",
            "13MP Compliance Council",
            "What-If Levy & Salary Simulator",
            "Deadlock & Expiry Detection",
            "Human-in-the-Loop Interrupts",
            "Automated Justification & Filing"
        ]
    }

@app.get("/health")
def health_check():
    return {"status": "healthy", "timestamp": "2026-04-23"}
