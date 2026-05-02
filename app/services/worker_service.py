from app.firebase_config import db

def create_worker(worker_data: dict):
    doc_ref = db.collection("workers").document()
    doc_ref.set(worker_data)
    return doc_ref.id

def update_worker(worker_id: str, worker_data: dict):
    doc_ref = db.collection("workers").document(worker_id)
    doc_ref.set(worker_data, merge=True)
    return