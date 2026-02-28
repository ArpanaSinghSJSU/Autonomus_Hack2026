import time
import requests
from datetime import datetime

# ⚠️ Keep for local hackathon only. Do NOT commit.
# If you can, move this to .env and use os.getenv("TAVILY_API_KEY") instead.
TAVILY_API_KEY = "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"

TAVILY_URL = "https://api.tavily.com/search"

# -------- Rate limit + cache knobs (tune these) --------
CACHE_TTL_SECONDS = 120          # dev key: cache a bit longer
MIN_SECONDS_BETWEEN_CALLS = 8    # dev key: slow down more
MAX_RESULTS_DEFAULT = 3          # reduce load; you can increase later

# In-memory cache: topic -> (timestamp, results)
_CACHE = {}
_last_call_ts = 0.0


def tavily_search(topic: str, max_results: int = MAX_RESULTS_DEFAULT):
    """
    Returns Tavily search results with:
    - caching (prevents repeated calls on refresh)
    - throttling (reduces 429)
    - graceful 429 handling (no FastAPI 500 crash)
    """
    global _last_call_ts

    if not TAVILY_API_KEY or "REPLACE_ME" in TAVILY_API_KEY:
        return [{
            "title": "Tavily key missing",
            "url": "",
            "published": datetime.utcnow().isoformat() + "Z",
            "content": "Set TAVILY_API_KEY in tavily_client.py (or use .env).",
            "source": "tavily",
        }]

    now = time.time()

    # 1) Cache hit
    cached = _CACHE.get(topic)
    if cached:
        ts, results = cached
        if now - ts < CACHE_TTL_SECONDS:
            return results

    # 2) Throttle
    gap = now - _last_call_ts
    if gap < MIN_SECONDS_BETWEEN_CALLS:
        time.sleep(MIN_SECONDS_BETWEEN_CALLS - gap)

    headers = {
        "Authorization": f"Bearer {TAVILY_API_KEY}",
        "Content-Type": "application/json",
    }
    payload = {
        "query": topic,
        "max_results": max_results,
        "include_answer": False
    }

    r = requests.post(TAVILY_URL, json=payload, headers=headers, timeout=20)

    # 3) Handle Tavily blocks / rate limits without crashing
    if r.status_code == 429:
        # Return cached if we have it, otherwise return a "soft error" item
        if cached:
            return cached[1]
        return [{
            "title": "Tavily rate limited (429)",
            "url": "",
            "published": datetime.utcnow().isoformat() + "Z",
            "content": (
                "Tavily blocked this request due to rate limits (common with tvly-dev keys). "
                "Wait a bit, reduce refresh frequency, or use a production key."
            ),
            "source": "tavily",
        }]

    # Other HTTP errors: don't crash the whole backend
    if r.status_code >= 400:
        return [{
            "title": f"Tavily error {r.status_code}",
            "url": "",
            "published": datetime.utcnow().isoformat() + "Z",
            "content": r.text[:800],
            "source": "tavily",
        }]

    data = r.json()

    out = []
    for item in data.get("results", [])[:max_results]:
        out.append({
            "title": item.get("title") or "Untitled",
            "url": item.get("url") or "",
            "published": datetime.utcnow().isoformat() + "Z",
            "content": item.get("content") or item.get("snippet") or "",
            "source": "tavily",
        })

    # Save cache + update last call time
    if out:
        _CACHE[topic] = (time.time(), out)
    _last_call_ts = time.time()

    return out