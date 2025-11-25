#!/usr/bin/env python3
import os, json, sys
from datetime import datetime
from decimal import Decimal
import requests

# ---------------------------------------------------------------------------
# CONFIG
# ---------------------------------------------------------------------------

# Read API key from GitHub Secret (never hardcode it here!)
API_KEY = os.getenv("RAINBET_API_KEY")

# Rainbet endpoint
BASE_URL = "https://services.rainbet.com/v1/external/affiliates"

# 🔒 Fixed date range — adjust as needed
START_AT = "2025-12-01"
END_AT = "2025-12-30"

# ---------------------------------------------------------------------------

def main():
    if not API_KEY:
        print("❌ Missing RAINBET_API_KEY environment variable", file=sys.stderr)
        sys.exit(1)

    params = {"start_at": START_AT, "end_at": END_AT, "key": API_KEY}
    resp = requests.get(BASE_URL, params=params, timeout=30)

    if resp.status_code != 200:
        print(f"❌ Error {resp.status_code}: {resp.text}", file=sys.stderr)
        sys.exit(1)

    data = resp.json()
    affiliates = data.get("affiliates", [])

    # Normalize + sort by wagered_amount (descending)
    rows = []
    for a in affiliates:
        try:
            wagered = Decimal(str(a.get("wagered_amount", "0")))
        except Exception:
            wagered = Decimal(0)
        rows.append({
            "username": a.get("username") or "No User",
            "wagered": float(wagered),
        })

    rows.sort(key=lambda r: r["wagered"], reverse=True)

    # 🔧 Ensure at least 10 rows (fill missing ranks with placeholders)
    while len(rows) < 10:
        rows.append({
            "username": "No User",
            "wagered": 0.0,
        })

    # Trim to top 10 (just in case API returns more)
    rows = rows[:10]

    out = {
        "updated_at_utc": datetime.utcnow().isoformat(timespec="seconds") + "Z",
        "range": {"start_at": START_AT, "end_at": END_AT},
        "count": len(rows),
        "rows": rows,
        "source_cache_updated_at": data.get("cache_updated_at"),
    }

    # Write to /public (so it's available on your website)
    out_path = "public/leaderboard.json"
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    with open(out_path + ".tmp", "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=2)
    os.replace(out_path + ".tmp", out_path)

    print(f"✅ Wrote {out_path} with {len(rows)} rows for {START_AT} → {END_AT}")

# ---------------------------------------------------------------------------

if __name__ == "__main__":
    main()
