import os
import json
from datetime import datetime
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(dotenv_path=Path(__file__).with_name(".env"))

def read_airbyte_items(max_results: int = 3):
    path = os.getenv("AIRBYTE_RSS_JSON_PATH", "").strip()
    if not path:
        raise RuntimeError("Missing AIRBYTE_RSS_JSON_PATH in backend/.env")

    if not os.path.exists(path):
        raise RuntimeError(f"Airbyte JSON not found: {path}")

    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)

    # Accept either {"items":[...]} or [...]
    items = data.get("items") if isinstance(data, dict) else data
    if not isinstance(items, list) or not items:
        raise RuntimeError("Airbyte JSON has no items list")

    out = []
    for it in items[:max_results]:
        out.append({
            "title": it.get("title") or it.get("name") or "Untitled RSS Item",
            "url": it.get("link") or it.get("url") or "",
            "published": it.get("published") or it.get("pubDate") or datetime.utcnow().isoformat() + "Z",
            "content": it.get("description") or it.get("content") or it.get("summary") or "",
            "source": "airbyte",
        })

    return out