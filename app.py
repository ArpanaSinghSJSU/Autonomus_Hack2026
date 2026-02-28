from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware

from tavily_client import tavily_search
from yutori_client import yutori_realtime, ensure_scout
from airbyte_reader import read_airbyte_items

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def warmup():
    # Warmup scouts so updates arrive before demo call
    try:
        ensure_scout("earthquake")
        ensure_scout("cyberattack")
        ensure_scout("airport outage")
        print("Yutori scouts warmed up")
    except Exception as e:
        print("Yutori warmup skipped:", e)


def dedup_by_url(items):
    seen = set()
    out = []
    for it in items:
        url = (it.get("url") or "").strip()
        key = url if url else (it.get("title") or "")
        if key and key not in seen:
            seen.add(key)
            out.append(it)
    return out


@app.get("/sources")
def get_sources(topic: str = Query("earthquake")):
    merged = []

    # Tavily
    try:
        merged += tavily_search(topic, max_results=3)
    except Exception as e:
        print("Tavily failed:", e)

    # Yutori
    try:
        merged += yutori_realtime(topic, want_items=2, poll_seconds=120)
    except Exception as e:
        print("Yutori failed:", e)

    # Airbyte
    try:
        merged += read_airbyte_items(max_results=3)
    except Exception as e:
        print("Airbyte failed:", e)

    merged = dedup_by_url(merged)

    return {
        "topic": topic,
        "count": len(merged),
        "items": merged
    }