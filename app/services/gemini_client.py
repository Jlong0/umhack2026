import os
import re
import time
import threading
import logging
from itertools import cycle

from dotenv import load_dotenv

load_dotenv()

import google.genai as genai

logger = logging.getLogger(__name__)

_raw_keys = os.getenv("GEMINI_API_KEYS", "")
API_KEYS = [k.strip() for k in _raw_keys.split(",") if k.strip()]

if not API_KEYS:
    raise RuntimeError("GEMINI_API_KEYS env var is empty — add comma-separated keys to .env")

_lock = threading.Lock()
_key_cycle = cycle(API_KEYS)
_current_index = 0
_dead_keys: set[str] = set()

_RETRYABLE_MESSAGES = (
    "429", "rate", "quota", "resource_exhausted",
    "leaked", "not found", "denied access",
    "permission_denied", "invalid_argument", "api key",
)

_RETRY_DELAY_RE = re.compile(r"retryDelay['\"]*:\s*['\"](\d+)s", re.IGNORECASE)


def _is_retryable(e: Exception) -> bool:
    err = str(e).lower()
    return any(msg in err for msg in _RETRYABLE_MESSAGES)


def _is_permanent_fail(e: Exception) -> bool:
    err = str(e)
    if "leaked" in err.lower():
        return True
    if "API Key not found" in err:
        return True
    if "denied access" in err.lower():
        return True
    if "quota_limit_value" in err and "'0'" in err:
        return True
    return False


def _extract_retry_delay(e: Exception) -> float:
    m = _RETRY_DELAY_RE.search(str(e))
    if m:
        return float(m.group(1))
    return 2.0


def _next_live_key() -> tuple[str, int] | None:
    global _current_index
    with _lock:
        for _ in range(len(API_KEYS)):
            key = next(_key_cycle)
            _current_index = (_current_index + 1) % len(API_KEYS)
            if key not in _dead_keys:
                return key, _current_index
        return None


def get_client() -> genai.Client:
    result = _next_live_key()
    if result is None:
        raise RuntimeError("All Gemini API keys are dead/revoked")
    key, idx = result
    logger.debug("Gemini client created with key index %d", idx)
    return genai.Client(api_key=key)


def call_with_rotation(fn, max_retries: int = None):
    if max_retries is None:
        max_retries = len(API_KEYS) + 10
    last_err = None
    consecutive_429 = 0
    for attempt in range(max_retries):
        result = _next_live_key()
        if result is None:
            wait = _extract_retry_delay(last_err) if last_err else 5.0
            logger.warning("All keys exhausted. Waiting %.1fs...", wait)
            time.sleep(wait)
            with _lock:
                _dead_keys.clear()
            continue
        key, idx = result
        client = genai.Client(api_key=key)
        try:
            return fn(client)
        except Exception as e:
            if _is_retryable(e):
                if _is_permanent_fail(e):
                    with _lock:
                        _dead_keys.add(key)
                    logger.warning("Key #%d permanently dead (total dead: %d/%d): %s",
                                   idx, len(_dead_keys), len(API_KEYS), str(e)[:120])
                else:
                    consecutive_429 += 1
                    delay = _extract_retry_delay(e)
                    if delay < 1.0:
                        delay = min(2 ** consecutive_429, 10.0) # exponential backoff
                    logger.warning("Key #%d rate-limited (attempt %d). Sleeping %.1fs: %s",
                                   idx, attempt + 1, delay, str(e)[:120])
                    time.sleep(delay)
                last_err = e
                continue
            raise
    raise last_err
