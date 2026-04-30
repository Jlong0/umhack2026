import os
from pathlib import Path

import firebase_admin
from firebase_admin import credentials, firestore, storage
from dotenv import load_dotenv

_ENV_PATH = Path(__file__).resolve().parents[1] / ".env"
load_dotenv(dotenv_path=_ENV_PATH)


def _env_bool(name: str, default: str = "false") -> bool:
    val = os.getenv(name, default)
    return str(val).strip().lower() in ("1", "true", "yes")


USE_MOCK = _env_bool("USE_MOCK_FIREBASE", "false")
FIREBASE_STORAGE_BUCKET = os.getenv("FIREBASE_STORAGE_BUCKET", "umhack-493907.firebasestorage.app")


def _resolve_credentials_path() -> Path:
    env_path = os.getenv("FIREBASE_CREDENTIALS_PATH")
    google_path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
    repo_root = Path(__file__).resolve().parents[1]
    candidate_paths = [
        env_path,
        google_path,
        "secrets/firebase-service-account.json",
        "serviceAccountKey.json",
        "serviceAccountkey.json",
    ]

    for candidate in candidate_paths:
        if not candidate:
            continue
        candidate_path = Path(candidate).expanduser()
        resolved = (repo_root / candidate_path).resolve() if not candidate_path.is_absolute() else candidate_path.resolve()
        if resolved.exists():
            return resolved

    raise FileNotFoundError(
        "Firebase service account key not found. "
        "Set FIREBASE_CREDENTIALS_PATH to your key file or place it at "
        "secrets/firebase-service-account.json."
    )


if USE_MOCK:
    print("WARNING: Using mock Firebase - data will not persist")

    from uuid import uuid4
    from collections import defaultdict

    class _MockDoc:
        def __init__(self, data=None):
            self._data = data or {}
            self.id = str(uuid4())
            self.exists = data is not None
        def to_dict(self): return dict(self._data)
        def get(self): return self

    class _MockDocRef:
        def __init__(self, store, col, doc_id):
            self._store = store
            self._col = col
            self.id = doc_id
        def get(self):
            data = self._store[self._col].get(self.id)
            d = _MockDoc(data)
            d.id = self.id
            return d
        def set(self, data, merge=False):
            if merge:
                self._store[self._col].setdefault(self.id, {}).update(data)
            else:
                self._store[self._col][self.id] = data
        def update(self, data): self._store[self._col].setdefault(self.id, {}).update(data)

    class _MockCollection:
        def __init__(self, store, name):
            self._store = store
            self._name = name
        def add(self, data):
            doc_id = str(uuid4())
            self._store[self._name][doc_id] = data
            ref = _MockDocRef(self._store, self._name, doc_id)
            ref.id = doc_id
            return (None, ref)
        def document(self, doc_id):
            return _MockDocRef(self._store, self._name, doc_id)

    class _MockDB:
        def __init__(self):
            self._store = defaultdict(dict)
        def collection(self, name):
            return _MockCollection(self._store, name)

    class _MockBucket:
        pass

    db = _MockDB()
    bucket = _MockBucket()
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
