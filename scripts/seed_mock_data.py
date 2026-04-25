"""
Seed mock_gov_records in Firestore for all existing workers.
Run: python -m scripts.seed_mock_data
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from datetime import datetime, timezone
from app.firebase_config import db

FIELDS_TO_COPY = ["permit_expiry_date", "fomema_status", "salary_rm"]

def seed():
    workers = list(db.collection("workers").stream())
    now = datetime.now(timezone.utc).isoformat()
    seeded = 0

    for doc in workers:
        worker = doc.to_dict()
        mock = {
            "salary": worker.get("salary_rm", 1200),
            "permit_expiry": worker.get("permit_expiry_date"),
            "fomema_status": worker.get("fomema_status", "pending"),
            "levy_status": "unpaid",
            "source": "mock",
            "last_updated": now,
        }
        db.collection("mock_gov_records").document(doc.id).set(mock)
        seeded += 1

    print(f"Seeded {seeded} mock_gov_records")

if __name__ == "__main__":
    seed()
