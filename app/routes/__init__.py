from fastapi import APIRouter
from app.firebase_config import db

router = APIRouter()

@router.get("/workers")
def get_workers():
    docs = db.collection("workers").stream()
    return [{"worker_id": doc.id, **doc.to_dict()} for doc in docs]
