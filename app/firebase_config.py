import os
from pathlib import Path

import firebase_admin
from firebase_admin import credentials, firestore, storage
from dotenv import load_dotenv

load_dotenv()

USE_MOCK = os.getenv("USE_MOCK_FIREBASE", "false").lower() == "true"
FIREBASE_STORAGE_BUCKET = os.getenv("FIREBASE_STORAGE_BUCKET", "umhack-493907.firebasestorage.app")


def _resolve_credentials_path() -> Path:
    env_path = os.getenv("FIREBASE_CREDENTIALS_PATH")
    candidate_paths = [
        env_path,
        "secrets/firebase-service-account.json",
        "serviceAccountKey.json",
    ]

    for candidate in candidate_paths:
        if not candidate:
            continue
        resolved = Path(candidate).expanduser().resolve()
        if resolved.exists():
            return resolved

    raise FileNotFoundError(
        "Firebase service account key not found. "
        "Set FIREBASE_CREDENTIALS_PATH to your key file or place it at "
        "secrets/firebase-service-account.json."
    )


if USE_MOCK:
    print("WARNING: Using mock Firebase - data will not persist")
    db = None
    bucket = None
else:
    resolved_cred_path = _resolve_credentials_path()
    cred = credentials.Certificate(str(resolved_cred_path))

    if not firebase_admin._apps:
        firebase_admin.initialize_app(
            credential=cred,
            options={
                "storageBucket": FIREBASE_STORAGE_BUCKET
            }
        )

    firestore_database_id = os.getenv("FIRESTORE_DATABASE_ID", "(default)")
    if firestore_database_id and firestore_database_id != "(default)":
        db = firestore.client(database_id=firestore_database_id)
    else:
        db = firestore.client()
    bucket = storage.bucket()
