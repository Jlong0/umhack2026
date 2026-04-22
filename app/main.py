from fastapi import FastAPI
from app.routes import worker, task, document

app = FastAPI(title="PermitIQ")

app.include_router(worker.router)
app.include_router(task.router)
app.include_router(document.router)

@app.get("/")
def root():
    return {"status": "PermitIQ backend running"}