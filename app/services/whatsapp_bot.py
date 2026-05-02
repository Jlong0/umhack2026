"""
WhatsApp Bot Service — integrated into the FastAPI app lifecycle.

Runs as a daemon thread when the server starts.  No separate script needed.
If the QR session isn't set up yet, the bot starts in a degraded "waiting"
mode and keeps retrying silently until the user does a one-time visible scan.
"""

import os
import threading
import time
import traceback
from datetime import datetime, timezone

from app.firebase_config import db
from google.cloud import firestore

# ── Config ────────────────────────────────────────────────────────────────────
CHROME_PROFILE_DIR = os.path.expanduser("~/.whatsapp-bot-chrome")

POLL_INTERVAL = 5  # seconds between Firestore polls
SEND_DELAY = 3  # seconds between consecutive sends
CHAT_LOAD_TIMEOUT = 20
SETUP_RETRY_INTERVAL = 30  # seconds between WhatsApp-ready retries
IDLE_STOP_POLLS = 3  # auto-stop after this many consecutive empty polls

_bot_thread: threading.Thread | None = None
_bot_running = threading.Event()
_driver = None
_bot_status = {
    "running": False,
    "whatsapp_ready": False,
    "session_scanned": False,
    "last_activity": None,
    "sent_count": 0,
    "fail_count": 0,
    "error": None,
}
_status_lock = threading.Lock()


def _update_status(**kwargs):
    with _status_lock:
        _bot_status.update(kwargs)


def get_bot_status() -> dict:
    with _status_lock:
        return dict(_bot_status)


# ── Browser ───────────────────────────────────────────────────────────────────

def _create_driver(headless: bool = True):
    from selenium import webdriver
    from selenium.webdriver.chrome.options import Options

    options = Options()
    if headless:
        options.add_argument("--headless=new")
    options.add_argument(f"--user-data-dir={CHROME_PROFILE_DIR}")
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-dev-shm-usage")
    options.add_argument("--disable-gpu")
    options.add_argument("--window-size=1280,800")
    options.add_argument("--lang=en-US")
    options.add_argument("--disable-notifications")
    options.add_argument("--disable-extensions")
    options.add_argument("--disable-background-timer-throttling")
    options.add_argument("--disable-backgrounding-occluded-windows")
    options.add_argument("--disable-renderer-backgrounding")
    options.add_experimental_option("excludeSwitches", ["enable-automation"])
    options.add_experimental_option("useAutomationExtension", False)
    return webdriver.Chrome(options=options)


def _wait_for_whatsapp(driver, timeout=60) -> bool:
    from selenium.webdriver.support.ui import WebDriverWait
    from selenium.webdriver.support import expected_conditions as EC
    from selenium.webdriver.common.by import By
    try:
        WebDriverWait(driver, timeout).until(
            EC.presence_of_element_located((By.CSS_SELECTOR, 'div[contenteditable="true"]'))
        )
        return True
    except Exception:
        return False


# ── Send logic ────────────────────────────────────────────────────────────────

def _dismiss_popups(driver):
    from selenium.webdriver.common.by import By
    from selenium.common.exceptions import NoSuchElementException
    for xpath in [
        '//div[@role="button" and contains(text(), "OK")]',
        '//div[@role="button" and contains(text(), "CONTINUE")]',
        '//div[@role="button" and contains(text(), "Got it")]',
    ]:
        try:
            btn = driver.find_element(By.XPATH, xpath)
            btn.click()
            time.sleep(0.3)
        except NoSuchElementException:
            pass


def _send_whatsapp(driver, phone: str, message: str) -> bool:
    from urllib.parse import quote
    from selenium.webdriver.support.ui import WebDriverWait
    from selenium.webdriver.support import expected_conditions as EC
    from selenium.webdriver.common.by import By
    from selenium.webdriver.common.keys import Keys
    from selenium.common.exceptions import TimeoutException, NoSuchElementException

    url = f"https://web.whatsapp.com/send?phone={phone}&text={quote(message)}"
    driver.get(url)

    try:
        WebDriverWait(driver, CHAT_LOAD_TIMEOUT).until(
            EC.presence_of_element_located((By.CSS_SELECTOR, 'div[contenteditable="true"]'))
        )
    except TimeoutException:
        _dismiss_popups(driver)
        return False

    _dismiss_popups(driver)
    time.sleep(1.5)

    # Try send button selectors
    for sel in [
        '[data-icon="send"]',
        'button[data-icon="send"]',
        'span[data-icon="send"]',
        'button[aria-label="Send"]',
        '[data-testid="send-btn"]',
    ]:
        try:
            btn = WebDriverWait(driver, 3).until(
                EC.element_to_be_clickable((By.CSS_SELECTOR, sel))
            )
            btn.click()
            return True
        except (TimeoutException, NoSuchElementException):
            continue

    # Fallback: press Enter
    try:
        inputs = driver.find_elements(By.CSS_SELECTOR, 'div[contenteditable="true"]')
        if inputs:
            inputs[-1].send_keys(Keys.ENTER)
            return True
    except Exception:
        pass

    return False


# ── Queue processing ──────────────────────────────────────────────────────────

_seen_ids: set[str] = set()


def _process_queue(driver):
    docs = list(
        db.collection("message_queue")
        .where(filter=firestore.FieldFilter("status", "==", "pending"))
        .stream()
    )
    batch = [doc for doc in docs if doc.id not in _seen_ids]
    if not batch:
        return False

    print(f"[WHATSAPP-BOT] Processing {len(batch)} message(s)...")

    for doc in batch:
        if not _bot_running.is_set():
            break

        _seen_ids.add(doc.id)
        data = doc.to_dict() or {}
        phone = str(data.get("phone", "")).strip().lstrip("+")
        message = data.get("message", "")
        worker_name = data.get("worker_name", "Unknown")

        if not phone or not message or len(phone) < 7 or not phone.isdigit():
            doc.reference.update({"status": "failed"})
            continue

        print(f"[WHATSAPP-BOT] → {worker_name} ({phone}): {message[:50]}...")
        try:
            success = _send_whatsapp(driver, phone, message)
        except Exception as e:
            print(f"[WHATSAPP-BOT] Error: {e}")
            success = False

        now = datetime.now(timezone.utc).isoformat()
        if success:
            doc.reference.update({"status": "sent", "sent_at": now})
            _update_status(sent_count=_bot_status["sent_count"] + 1, last_activity=now)
            print(f"[WHATSAPP-BOT] ✓ {doc.id}")
        else:
            doc.reference.update({"status": "failed"})
            _update_status(fail_count=_bot_status["fail_count"] + 1, last_activity=now)
            print(f"[WHATSAPP-BOT] ✗ {doc.id}")

        time.sleep(SEND_DELAY)

    return True


# ── Background thread ────────────────────────────────────────────────────────

def _bot_loop():
    global _driver
    _update_status(running=True)

    while _bot_running.is_set():
        driver = None
        try:
            # Start Chrome + WhatsApp Web
            driver = _create_driver(headless=True)
            _driver = driver
            driver.get("https://web.whatsapp.com")

            if not _wait_for_whatsapp(driver, timeout=60):
                _update_status(whatsapp_ready=False, error="QR not scanned. Run setup first (see below).")
                print("[WHATSAPP-BOT] WhatsApp not ready. Will retry...")
                driver.quit()
                _driver = None
                # Retry later
                _bot_running.wait(SETUP_RETRY_INTERVAL)
                continue

            _update_status(whatsapp_ready=True, session_scanned=True, error=None)
            print("[WHATSAPP-BOT] ✓ WhatsApp Web connected. Sending queued messages...")

            # Poll until queue is drained, then auto-stop
            empty_polls = 0
            while _bot_running.is_set():
                try:
                    had_work = _process_queue(driver)
                    if not had_work:
                        empty_polls += 1
                        if empty_polls >= IDLE_STOP_POLLS:
                            print("[WHATSAPP-BOT] Queue empty. Auto-stopping.")
                            break
                    else:
                        empty_polls = 0
                except Exception as e:
                    print(f"[WHATSAPP-BOT] Queue error: {e}")
                    traceback.print_exc()
                _bot_running.wait(POLL_INTERVAL)

        except Exception as e:
            _update_status(error=str(e))
            print(f"[WHATSAPP-BOT] Restarting after error: {e}")
            traceback.print_exc()
        finally:
            if driver:
                try:
                    driver.quit()
                except Exception:
                    pass
                _driver = None

            if _bot_running.is_set():
                print("[WHATSAPP-BOT] Reconnecting in 10s...")
                _bot_running.wait(10)

    _update_status(running=False)
    print("[WHATSAPP-BOT] Stopped.")


# ── Public API ────────────────────────────────────────────────────────────────

def start_bot():
    """Start the bot background thread. Safe to call multiple times."""
    global _bot_thread
    if _bot_thread and _bot_thread.is_alive():
        return
    _seen_ids.clear()
    _update_status(sent_count=0, fail_count=0, error=None, whatsapp_ready=False)
    _bot_running.set()
    _bot_thread = threading.Thread(target=_bot_loop, name="whatsapp-bot", daemon=True)
    _bot_thread.start()
    print("[WHATSAPP-BOT] Background thread started.")


def stop_bot():
    """Signal the bot to stop."""
    _bot_running.clear()
    print("[WHATSAPP-BOT] Stop signal sent.")


def setup_bot_visible():
    """
    One-time setup: open Chrome visibly so user can scan the QR code.
    Returns once the session is established or times out.
    """
    driver = None
    try:
        print("[WHATSAPP-BOT] Opening Chrome for QR scan...")
        driver = _create_driver(headless=False)
        driver.get("https://web.whatsapp.com")

        if _wait_for_whatsapp(driver, timeout=120):
            print("[WHATSAPP-BOT] ✓ QR scanned! Session saved. Starting headless bot...")
            _update_status(session_scanned=True)
            driver.quit()
            driver = None
            start_bot()
            return {"success": True, "message": "QR scanned. Bot is now running in the background."}
        else:
            return {"success": False, "message": "Timed out waiting for QR scan."}
    except Exception as e:
        return {"success": False, "message": str(e)}
    finally:
        if driver:
            driver.quit()
