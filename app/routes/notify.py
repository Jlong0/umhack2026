from typing import Optional
from pydantic import BaseModel
import json
from datetime import datetime, date, timezone, timedelta

from fastapi import APIRouter, HTTPException

from app.firebase_config import db
from app.services.gemini_service import generate_text, _parse_json
from app.services.whatsapp_bot import start_bot, get_bot_status, setup_bot_visible

router = APIRouter(prefix="/notify", tags=["notify"])

MAX_WORKERS_PER_TRIGGER = 50
DEDUP_HOURS = 24

PORTAL_URL = "http://127.0.0.1:5173/login/worker"


class NotifyRequest(BaseModel):
    worker_id: Optional[str] = None  # if set, only notify this worker (bypasses dedup)

SYSTEM_PROMPT = (
    "You are a WhatsApp notification agent for PermitIQ, a Malaysian foreign worker compliance platform. "
    "Craft a personalized WhatsApp message for each worker based on their situation. "
    "Return ONLY a JSON array (no markdown). Each element: {worker_id, message}. "
    "Messages must be polite, under 300 chars, in English. "
    "For login_credentials: include their login code and portal URL. "
    "For upload_reminder: mention the specific missing sections by name. "
    "For visa_letter: congratulate and tell them to check the portal. "
    "For permit_issued: congratulate on permit approval. "
    "For permit_renewal: urgently remind them of the expiry date and days remaining."
)


def _worker_name(d: dict, doc_id: str) -> str:
    return (
        (d.get("passport") or {}).get("full_name")
        or d.get("full_name")
        or d.get("master_name")
        or doc_id
    )


def _already_queued(worker_id: str, decision: str, since: datetime) -> bool:
    """Return True if this worker already has a pending/sent message for this decision recently."""
    docs = (
        db.collection("message_queue")
        .where("worker_id", "==", worker_id)
        .where("decision", "==", decision)
        .stream()
    )
    cutoff = since.isoformat()
    for doc in docs:
        d = doc.to_dict() or {}
        if d.get("status") == "sent" and (d.get("created_at") or "") >= cutoff:
            return True
    return False


def _detect_case(worker: dict, visa_letter: dict | None, today: date) -> str | None:
    gate = (worker.get("current_gate") or "JTKSM").upper()
    data_status = (worker.get("data_status") or "").lower()
    missing = worker.get("missing_fields") or []

    # Case 1: new worker — has login code, hasn't been onboarded yet
    if worker.get("login_code") and data_status in ("", "new", "pending", "unknown"):
        return "login_credentials"

    # Case 2: incomplete data — missing fields or explicitly incomplete
    if missing or data_status == "incomplete":
        return "upload_reminder"

    # Case 3: visa letter ready — worker is in TRANSIT and letter not yet acknowledged
    if gate == "TRANSIT" and visa_letter and not visa_letter.get("acknowledged"):
        return "visa_letter"

    # Case 4: permit issued — worker reached ACTIVE
    if gate == "ACTIVE":
        return "permit_issued"

    # Case 5: permit renewal — expiry within 60 days
    expiry_str = worker.get("permit_expiry_date") or worker.get("permit_expiry")
    if expiry_str:
        try:
            exp = date.fromisoformat(str(expiry_str)[:10])
            days_left = (exp - today).days
            if 0 < days_left <= 60:
                return "permit_renewal"
        except (ValueError, TypeError):
            pass

    return None


@router.post("/trigger")
def trigger_notify(body: NotifyRequest = None):
    body = body or NotifyRequest()
    target_id = body.worker_id
    today = date.today()
    dedup_since = datetime.now(timezone.utc) - timedelta(hours=DEDUP_HOURS)

    visa_letters = {doc.id: doc.to_dict() or {} for doc in db.collection("visa_letters").stream()}

    candidates = []

    if target_id:
        # Targeted send: fetch single worker, skip dedup
        doc = db.collection("workers").document(target_id).get()
        worker_docs = [doc] if doc.exists else []
    else:
        worker_docs = list(db.collection("workers").stream())

    for doc in worker_docs:
        d = doc.to_dict() or {}
        phone = str(d.get("whatsapp") or "").replace("+", "").replace(" ", "")
        if not phone:
            continue

        decision = _detect_case(d, visa_letters.get(doc.id), today)
        if not decision:
            continue

        if not target_id and _already_queued(doc.id, decision, dedup_since):
            continue

        name = _worker_name(d, doc.id)
        missing_labels = [
            m.get("label") or m.get("section") or ""
            for m in (d.get("missing_fields") or [])
            if isinstance(m, dict)
        ]
        expiry_str = d.get("permit_expiry_date") or d.get("permit_expiry") or ""
        days_left = None
        if expiry_str:
            try:
                days_left = (date.fromisoformat(str(expiry_str)[:10]) - today).days
            except (ValueError, TypeError):
                pass

        candidates.append({
            "worker_id": doc.id,
            "phone": phone,
            "worker_name": name,
            "decision": decision,
            "login_code": d.get("login_code", ""),
            "portal_url": PORTAL_URL,
            "missing_labels": missing_labels,
            "permit_expiry": expiry_str,
            "days_until_expiry": days_left,
        })

        if len(candidates) >= MAX_WORKERS_PER_TRIGGER:
            break

    if not candidates:
        return {"queued": 0, "workers": [], "message": "No notifications needed right now."}

    # Gemini crafts personalized message text for each candidate
    prompt = (
        f"Craft WhatsApp messages for these {len(candidates)} workers:\n\n"
        f"{json.dumps(candidates, indent=2)}\n\n"
        "Return a JSON array where each element has: worker_id, message."
    )
    result = generate_text(prompt, system_prompt=SYSTEM_PROMPT)
    if not result.get("success"):
        raise HTTPException(status_code=500, detail=f"Gemini call failed: {result.get('error')}")

    messages_by_id = {}
    parsed = _parse_json(result["text"])
    if isinstance(parsed, list):
        for item in parsed:
            if isinstance(item, dict) and item.get("worker_id"):
                messages_by_id[item["worker_id"]] = item.get("message", "")

    now = datetime.now(timezone.utc).isoformat()
    queued = []
    for c in candidates:
        message = messages_by_id.get(c["worker_id"], "")
        if not message:
            # fallback message if Gemini didn't return one
            message = _fallback_message(c)

        db.collection("message_queue").add({
            "worker_id": c["worker_id"],
            "phone": c["phone"],
            "worker_name": c["worker_name"],
            "message": message[:1000],
            "decision": c["decision"],
            "status": "pending",
            "created_at": now,
            "sent_at": None,
        })
        queued.append({"worker_id": c["worker_id"], "name": c["worker_name"], "decision": c["decision"]})

    if queued:
        start_bot()  # wake the background thread to process the new messages

    return {"queued": len(queued), "workers": queued}


def _fallback_message(c: dict) -> str:
    decision = c["decision"]
    name = c["worker_name"]
    if decision == "login_credentials":
        return f"Hi {name}, your PermitIQ account is ready. Login code: {c['login_code']}. Portal: {PORTAL_URL}"
    if decision == "upload_reminder":
        missing = ", ".join(c["missing_labels"]) or "some documents"
        return f"Hi {name}, please upload your missing documents: {missing}. Visit: {PORTAL_URL}"
    if decision == "visa_letter":
        return f"Hi {name}, your visa letter is ready. Please check the PermitIQ portal: {PORTAL_URL}"
    if decision == "permit_issued":
        return f"Hi {name}, congratulations! Your work permit has been successfully issued."
    if decision == "permit_renewal":
        days = c.get("days_until_expiry")
        return f"Hi {name}, your permit expires in {days} days ({c['permit_expiry']}). Please renew soon."
    return f"Hi {name}, please check your PermitIQ portal for updates: {PORTAL_URL}"


@router.get("/bot-status")
def bot_status():
    return get_bot_status()


@router.post("/bot-setup")
def bot_setup():
    """Open Chrome visibly for one-time QR scan. Call once, then the bot runs headless."""
    return setup_bot_visible()
