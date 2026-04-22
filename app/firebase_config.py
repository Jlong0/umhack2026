import os
from pathlib import Path

import firebase_admin
from firebase_admin import credentials, firestore, storage
from dotenv import load_dotenv

load_dotenv()


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


resolved_cred_path = _resolve_credentials_path()
cred = credentials.Certificate(str(resolved_cred_path))

if not firebase_admin._apps:
    firebase_admin.initialize_app(
        credential=cred,
        options={
            "storageBucket": "umhack2026.firebasestorage.app"
        }
    )

db = firestore.client(database_id="umhack2026")
bucket = storage.bucket()