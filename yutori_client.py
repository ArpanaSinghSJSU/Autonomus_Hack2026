import os
import time
import json
import re
import requests
from datetime import datetime
from pathlib import Path
from dotenv import load_dotenv

# Always load .env from the same folder as this file (Windows-safe)
load_dotenv(dotenv_path=Path(__file__).with_name(".env"))

YUTORI_CREATE_URL = "https://api.yutori.com/v1/scouting/tasks"
CACHE_FILE = "yutori_scout_cache.json"


def _load_cache():
    try:
        with open(CACHE_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return {}


def _save_cache(cache: dict):
    with open(CACHE_FILE, "w", encoding="utf-8") as f:
        json.dump(cache, f, indent=2)


def _get_key() -> str:
    # ✅ Correct: env var name, not the actual key string
    key = os.getenv("YUTORI_API_KEY", "").strip()
    if not key:
        raise RuntimeError("Missing YUTORI_API_KEY in backend/.env")
    return key


def clean_html(text: str) -> str:
    """Strip HTML tags for cleaner demo output."""
    if not text:
        return ""
    text = re.sub(r"<.*?>", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def normalize_timestamp(ts):
    """Handles seconds, milliseconds, string, None safely for Windows."""
    if ts is None:
        return int(time.time())

    if isinstance(ts, str):
        try:
            ts = float(ts)
        except Exception:
            return int(time.time())

    if isinstance(ts, float):
        ts = int(ts)

    # If milliseconds (very large), convert to seconds
    if isinstance(ts, int) and ts > 1_000_000_000_000:
        ts = ts // 1000

    if not isinstance(ts, int) or ts < 0:
        return int(time.time())

    return ts


def ensure_scout(topic: str) -> str:
    """
    Creates a scout ONCE per topic and caches its id in yutori_scout_cache.json.
    Prints scout_id when created or reused.
    """
    key = _get_key()
    cache = _load_cache()

    if topic in cache:
        scout_id = cache[topic]
        print(f"[YUTORI] Using cached scout for '{topic}': {scout_id}")
        return scout_id

    headers = {"X-API-Key": key, "Content-Type": "application/json"}
    payload = {
        "query": (
            f"Monitor breaking news and major incident updates about: {topic}. "
            "Return concise summaries with citations and include source URLs."
        ),
        "skip_email": True
    }

    print(f"[YUTORI] Creating new scout for '{topic}'...")
    r = requests.post(YUTORI_CREATE_URL, headers=headers, json=payload, timeout=30)
    r.raise_for_status()

    scout = r.json()
    scout_id = scout["id"]

    print(f"[YUTORI] NEW SCOUT CREATED for '{topic}': {scout_id}")

    cache[topic] = scout_id
    _save_cache(cache)
    return scout_id


def fetch_updates(scout_id: str, page_size: int = 10):
    key = _get_key()
    headers = {"X-API-Key": key}

    url = f"https://api.yutori.com/v1/scouting/tasks/{scout_id}/updates?page_size={page_size}"
    r = requests.get(url, headers=headers, timeout=30)
    r.raise_for_status()

    data = r.json()
    updates = data.get("updates", []) or []
    print(f"[YUTORI] updates count for {scout_id}: {len(updates)}")
    return updates


def yutori_realtime(topic: str, want_items: int = 3, poll_seconds: int = 120):
    """
    Poll updates for up to poll_seconds.
    Scouts may take time to produce first update — 120s is safer for demo.
    """
    scout_id = ensure_scout(topic)

    deadline = time.time() + poll_seconds
    updates = []

    while time.time() < deadline and not updates:
        updates = fetch_updates(scout_id, page_size=20)
        if not updates:
            time.sleep(3)

    if not updates:
        raise RuntimeError(
            "Yutori returned no updates yet. Keep the scout warmed up and retry in 1–3 minutes."
        )

    out = []
    for upd in updates[:want_items]:
        citations = upd.get("citations", []) or []
        url = citations[0].get("url") if citations else ""

        ts_norm = normalize_timestamp(upd.get("timestamp"))
        published = datetime.utcfromtimestamp(ts_norm).isoformat() + "Z"

        out.append({
            "title": f"Yutori update: {topic}",
            "url": url or "",
            "published": published,
            "content": clean_html(upd.get("content") or ""),
            "source": "yutori",
            "scout_id": scout_id,   # ✅ include scout id in output for debugging/demo
        })

    return out