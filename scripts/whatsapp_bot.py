#!/usr/bin/env python3
"""
WhatsApp Bot — watches Firestore message_queue and sends via WhatsApp Web (Selenium).

Runs in a separate Chrome instance (headless by default) so it never
steals focus or interferes with the user's personal browser.

Usage:
    # First run (visible, for QR scan):
    python scripts/whatsapp_bot.py --visible

    # After QR scanned (headless, production):
    python scripts/whatsapp_bot.py

    # Keep visible but minimized to tray:
    python scripts/whatsapp_bot.py --visible --minimized
"""

import argparse
import json
import os
import sys
import time
import traceback
from pathlib import Path
from datetime import datetime, timezone

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from dotenv import load_dotenv
load_dotenv(Path(__file__).resolve().parents[1] / ".env")

from app.firebase_config import db, USE_MOCK
from google.cloud import firestore

from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException, NoSuchElementException

# ── Config ────────────────────────────────────────────────────────────────────
CHROME_PROFILE_DIR = os.path.expanduser("~/.whatsapp-bot-chrome")
PROOF_DIR = os.path.expanduser("~/.whatsapp-bot-proofs")
LOG_FILE = os.path.expanduser("~/.whatsapp-bot-sent.log")
SEND_DELAY = 3  # seconds between messages
CHAT_LOAD_TIMEOUT = 20  # seconds to wait for chat to open
SEND_BTN_TIMEOUT = 8  # seconds to wait for send button

_pending_ids = set()
_driver = None


# ── Proof & logging ───────────────────────────────────────────────────────────

def _save_proof(driver, phone, worker_name, doc_id, success: bool):
    """Save screenshot + metadata as proof of send attempt."""
    try:
        os.makedirs(PROOF_DIR, exist_ok=True)
        ts = datetime.now().strftime("%Y%m%d_%H%M%S")
        tag = "ok" if success else "fail"
        label = worker_name.replace(" ", "_")

        # Screenshot
        img_path = os.path.join(PROOF_DIR, f"{tag}_{label}_{ts}.png")
        driver.save_screenshot(img_path)

        # Metadata JSON
        meta = {
            "doc_id": doc_id,
            "phone": phone,
            "worker_name": worker_name,
            "success": success,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "screenshot": img_path,
        }
        meta_path = os.path.join(PROOF_DIR, f"{tag}_{label}_{ts}.json")
        with open(meta_path, "w") as f:
            json.dump(meta, f, indent=2)

        # Append to CSV log
        with open(LOG_FILE, "a") as f:
            f.write(f"{meta['timestamp']},{phone},{worker_name},{tag},{doc_id},{img_path}\n")

        print(f"[PROOF] Saved: {img_path}")
    except Exception as e:
        print(f"[WARN] Could not save proof: {e}")


# ── Browser ───────────────────────────────────────────────────────────────────

def _create_driver(visible: bool = False, minimized: bool = False) -> webdriver.Chrome:
    options = Options()
    if not visible:
        options.add_argument("--headless=new")
    if minimized:
        options.add_argument("--window-position=-2400,-2400")

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
    # Prevent "Chrome is being controlled" banner
    options.add_experimental_option("excludeSwitches", ["enable-automation"])
    options.add_experimental_option("useAutomationExtension", False)
    return webdriver.Chrome(options=options)


def _wait_for_whatsapp_ready(driver):
    """Wait for WhatsApp Web main UI to load."""
    print("Waiting for WhatsApp Web to load...")
    try:
        WebDriverWait(driver, 90).until(
            EC.presence_of_element_located((By.CSS_SELECTOR, 'div[contenteditable="true"]'))
        )
        print("WhatsApp Web ready!")
        return True
    except TimeoutException:
        _save_proof(driver, "setup", "setup", "setup", False)
        return False


# ── Send logic ────────────────────────────────────────────────────────────────

def _dismiss_popups(driver):
    """Dismiss common WhatsApp Web popups that block interaction."""
    for xpath in [
        '//div[@role="button" and contains(text(), "OK")]',
        '//div[@role="button" and contains(text(), "CONTINUE")]',
        '//div[@role="button" and contains(text(), "Got it")]',
    ]:
        try:
            btn = driver.find_element(By.XPATH, xpath)
            btn.click()
            time.sleep(0.5)
        except NoSuchElementException:
            pass


def _send_message(driver, phone: str, message: str) -> bool:
    """Send a WhatsApp message to a phone number. Returns True on success."""
    from urllib.parse import quote
    url = f"https://web.whatsapp.com/send?phone={phone}&text={quote(message)}"
    driver.get(url)

    # Wait for the chat to open — look for any contenteditable input
    try:
        WebDriverWait(driver, CHAT_LOAD_TIMEOUT).until(
            EC.presence_of_element_located((By.CSS_SELECTOR, 'div[contenteditable="true"]'))
        )
    except TimeoutException:
        _dismiss_popups(driver)
        return False

    _dismiss_popups(driver)

    # Small settle time for the text to appear in the input (it comes via URL param)
    time.sleep(1.5)

    # Strategy 1: Click the send button (most reliable)
    send_selectors = [
        '[data-icon="send"]',
        'button[data-icon="send"]',
        'span[data-icon="send"]',
        'button[aria-label="Send"]',
        '[data-testid="send-btn"]',
        'button span[data-icon="send"]',
    ]
    for sel in send_selectors:
        try:
            btn = WebDriverWait(driver, 3).until(
                EC.element_to_be_clickable((By.CSS_SELECTOR, sel))
            )
            btn.click()
            return True
        except (TimeoutException, NoSuchElementException):
            continue

    # Strategy 2: Press Enter in the chat input
    try:
        inputs = driver.find_elements(By.CSS_SELECTOR, 'div[contenteditable="true"]')
        if inputs:
            # The last contenteditable is usually the message input
            inputs[-1].send_keys(Keys.ENTER)
            return True
    except Exception:
        pass

    return False


# ── Queue processing ──────────────────────────────────────────────────────────

def _process_pending(driver):
    docs = list(
        db.collection("message_queue")
        .where(filter=firestore.FieldFilter("status", "==", "pending"))
        .stream()
    )
    batch = [doc for doc in docs if doc.id not in _pending_ids]

    if not batch:
        return

    print(f"[BATCH] Processing {len(batch)} pending message(s)...")

    for doc in batch:
        _pending_ids.add(doc.id)
        data = doc.to_dict() or {}
        phone = str(data.get("phone", "")).strip().lstrip("+")
        message = data.get("message", "")
        worker_name = data.get("worker_name", "Unknown")

        if not phone or not message:
            doc.reference.update({"status": "failed"})
            print(f"[SKIP] {doc.id} — missing phone/message")
            continue

        # Skip obviously invalid numbers
        if len(phone) < 7 or not phone.isdigit():
            doc.reference.update({"status": "failed"})
            print(f"[SKIP] {doc.id} — invalid phone: {phone}")
            continue

        print(f"[SEND] → {worker_name} ({phone}): {message[:50]}...")
        try:
            success = _send_message(driver, phone, message)
        except Exception as e:
            print(f"[ERROR] {e}")
            traceback.print_exc()
            success = False

        # Always save proof (screenshot of result)
        _save_proof(driver, phone, worker_name, doc.id, success)

        if success:
            now = datetime.now(timezone.utc).isoformat()
            doc.reference.update({"status": "sent", "sent_at": now})
            print(f"[OK] {doc.id}")
        else:
            doc.reference.update({"status": "failed"})
            print(f"[FAIL] {doc.id}")

        time.sleep(SEND_DELAY)


# ── Firestore listener ────────────────────────────────────────────────────────

def _on_snapshot(docs, changes, read_time):
    for doc in docs:
        data = doc.to_dict() or {}
        if data.get("status") == "pending" and doc.id not in _pending_ids:
            print(f"[QUEUE] New message for {data.get('worker_name', '?')}")


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="PermitIQ WhatsApp Bot")
    parser.add_argument("--visible", action="store_true",
                        help="Show browser window (needed first time for QR scan)")
    parser.add_argument("--minimized", action="store_true",
                        help="Open window off-screen so it doesn't steal focus")
    args = parser.parse_args()

    mode = "visible" if args.visible else "headless"
    print(f"╔══════════════════════════════════════════╗")
    print(f"║   PermitIQ WhatsApp Bot ({mode:^10s})   ║")
    print(f"╠══════════════════════════════════════════╣")
    print(f"║ Profile:  {CHROME_PROFILE_DIR:<30s}║")
    print(f"║ Proofs:   {PROOF_DIR:<30s}║")
    print(f"║ Log:      {LOG_FILE:<30s}║")
    print(f"╚══════════════════════════════════════════╝")

    global _driver
    _driver = _create_driver(visible=args.visible, minimized=args.minimized)
    _driver.get("https://web.whatsapp.com")

    if not _wait_for_whatsapp_ready(_driver):
        if args.visible:
            print("Browser is open — please scan the QR code, then restart the bot.")
        else:
            print("Run with --visible first to scan QR code.")
        _driver.quit()
        sys.exit(1)

    # Register Firestore listener for real-time notifications
    try:
        db.collection("message_queue").where(
            filter=firestore.FieldFilter("status", "==", "pending")
        ).on_snapshot(_on_snapshot)
    except Exception as e:
        print(f"[WARN] Firestore listener failed: {e} (will use polling)")

    print("\nListening for pending messages... (Ctrl+C to stop)\n")
    try:
        while True:
            try:
                _process_pending(_driver)
            except Exception as e:
                print(f"[ERROR] {e}")
                traceback.print_exc()
            time.sleep(3)
    except KeyboardInterrupt:
        print("\nShutting down...")
    finally:
        _driver.quit()
        print("Bot stopped.")


if __name__ == "__main__":
    main()
