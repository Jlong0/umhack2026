from app.firebase_config import db

def create_worker(worker_data: dict):
    doc_ref = db.collection("workers").document()
    doc_ref.set(worker_data)
    return doc_ref.id