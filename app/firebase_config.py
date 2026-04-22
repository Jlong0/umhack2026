import firebase_admin
from firebase_admin import credentials, firestore, storage

cred = credentials.Certificate("serviceAccountKey.json")

if not firebase_admin._apps:
    firebase_admin.initialize_app(
        credential=cred,
        options={
            "storageBucket": "umhack2026.firebasestorage.app"
        }
    )

db = firestore.client(database_id="umhack2026")
bucket = storage.bucket()