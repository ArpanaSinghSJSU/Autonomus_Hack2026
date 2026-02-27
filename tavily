import os
import requests
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()

TAVILY_URL = "https://api.tavily.com/search"

def tavily_search(topic: str, max_results: int = 5):
    key = os.getenv("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", "").strip()

    if not key:
        return [{
            "title": f"[SIM] Tavily result for {topic}",
            "url": "https://example.com/tavily",
            "published": datetime.utcnow().isoformat(),
            "content": f"Simulated Tavily content for {topic}",
            "source": "tavily"
        } for _ in range(3)]

    headers = {"Authorization": f"Bearer {key}"}
    payload = {
        "query": topic,
        "max_results": max_results
    }

    r = requests.post(TAVILY_URL, json=payload, headers=headers)
    data = r.json()

    results = []
    for item in data.get("results", [])[:max_results]:
        results.append({
            "title": item.get("title"),
            "url": item.get("url"),
            "published": datetime.utcnow().isoformat(),
            "content": item.get("content", ""),
            "source": "tavily"
        })

    return results
