#!/usr/bin/env python3
import os
import json
import sys
from datetime import datetime
from decimal import Decimal, InvalidOperation
import requests

# ---------------------------------------------------------------------------
# CONFIG
# ---------------------------------------------------------------------------

# New endpoint (no API key required)
BASE_URL = "https://api.menace.com/api/retention/tournaments/d172ea1b-98b9-4e24-9e2a-d31c7cd5915c"

# Fallback fixed date range (will be overwritten if API returns startAt/endAt)
FALLBACK_START_AT = "2025-11-24"
FALLBACK_END_AT = "2025-12-24"

# Output path
OUT_PATH = "public/leaderboard.json"

# ---------------------------------------------------------------------------

POSSIBLE_USERNAME_KEYS = [
    "username", "userName", "player", "playerName", "nickname", "name", "player_id", "user"
]

POSSIBLE_AMOUNT_KEYS = [
    "wagered", "amount", "value", "score", "total", "wager", "points", "real_amount"
]

def safe_decimal(value):
    """Return Decimal from various possible numeric/string inputs. Falls back to 0."""
    if value is None:
        return Decimal(0)
    if isinstance(value, (int, float, Decimal)):
        try:
            return Decimal(str(value))
        except InvalidOperation:
            return Decimal(0)
    # string
    try:
        # strip commas etc
        s = str(value).replace(",", "")
        return Decimal(s)
    except Exception:
        return Decimal(0)

def extract_username(entry):
    for k in POSSIBLE_USERNAME_KEYS:
        if isinstance(entry, dict) and k in entry and entry[k] not in (None, ""):
            return str(entry[k])
    # sometimes username might be nested under 'user' dict
    if isinstance(entry, dict) and "user" in entry and isinstance(entry["user"], dict):
        for k in POSSIBLE_USERNAME_KEYS:
            if k in entry["user"] and entry["user"][k] not in (None, ""):
                return str(entry["user"][k])
    return "No User"

def extract_amount(entry):
    for k in POSSIBLE_AMOUNT_KEYS:
        if isinstance(entry, dict) and k in entry and entry[k] is not None:
            return safe_decimal(entry[k])
    # sometimes a nested 'stats' or 'totals' object holds it
    if isinstance(entry, dict):
        for possible_container in ("stats", "totals", "metrics"):
            if possible_container in entry and isinstance(entry[possible_container], dict):
                for k in POSSIBLE_AMOUNT_KEYS:
                    if k in entry[possible_container] and entry[possible_container][k] is not None:
                        return safe_decimal(entry[possible_container][k])
    return Decimal(0)

def find_leaderboard_from_payload(payload):
    """Try multiple locations for leaderboard data and return list-like object."""
    if not isinstance(payload, dict):
        return []

    # typical location in your sample: data.leaderboard
    data = payload.get("data", payload)

    # If data itself is a list, assume it's the leaderboard
    if isinstance(data, list):
        return data

    # Try common keys
    for k in ("leaderboard", "leaders", "players", "entries", "items"):
        if k in data and isinstance(data[k], list):
            return data[k]

    # As a last resort, try to find any list inside data that looks like leaderboard entries
    for v in data.values():
        if isinstance(v, list):
            return v

    return []

def main():
    try:
        resp = requests.get(BASE_URL, timeout=30)
    except Exception as e:
        print(f"❌ Request failed: {e}", file=sys.stderr)
        sys.exit(1)

    if resp.status_code != 200:
        print(f"❌ Error {resp.status_code}: {resp.text}", file=sys.stderr)
        sys.exit(1)

    try:
        payload = resp.json()
    except Exception as e:
        print(f"❌ Failed to parse JSON: {e}", file=sys.stderr)
        sys.exit(1)

    # Attempt to read startAt / endAt from payload (ISO strings), else fallback
    start_at = FALLBACK_START_AT
    end_at = FALLBACK_END_AT
    try:
        data_node = payload.get("data", {}) if isinstance(payload, dict) else {}
        if isinstance(data_node, dict):
            if "startAt" in data_node and data_node.get("startAt"):
                # Keep date-only part if present, else full ISO
                start_at = data_node.get("startAt")
            if "endAt" in data_node and data_node.get("endAt"):
                end_at = data_node.get("endAt")
    except Exception:
        pass

    leaderboard_raw = find_leaderboard_from_payload(payload)

    rows = []
    for entry in leaderboard_raw:
        try:
            username = extract_username(entry)
            amount = extract_amount(entry)
            # ----- ADJUSTMENT: divide by 100 to get correct wagered amount -----
            adjusted_amount = (amount / Decimal(100)) if isinstance(amount, Decimal) else Decimal(0)
            rows.append({
                "username": username or "No User",
                "wagered": float(adjusted_amount),  # keep compatibility with original format
            })
        except Exception:
            # be robust: skip problematic entry but continue
            continue

    # If we found no rows, still return placeholders (keeps behaviour similar to original)
    if not rows:
        # try another fallback: maybe payload.data contains single 'playerEntry' or 'player' object
        fallback_player = None
        try:
            data_node = payload.get("data", {}) if isinstance(payload, dict) else {}
            if isinstance(data_node, dict):
                for k in ("playerEntry", "player"):
                    if k in data_node and isinstance(data_node[k], dict):
                        fallback_player = data_node[k]
                        break
            if fallback_player:
                fp_amount = extract_amount(fallback_player)
                adjusted_fp_amount = (fp_amount / Decimal(100)) if isinstance(fp_amount, Decimal) else Decimal(0)
                rows.append({
                    "username": extract_username(fallback_player),
                    "wagered": float(adjusted_fp_amount),
                })
        except Exception:
            pass

    # Sort descending by wagered
    rows.sort(key=lambda r: r.get("wagered", 0.0), reverse=True)

    # Ensure at least 10 rows
    while len(rows) < 10:
        rows.append({"username": "No User", "wagered": 0.0})

    # Trim to top 10
    rows = rows[:10]

    out = {
        "updated_at_utc": datetime.utcnow().isoformat(timespec="seconds") + "Z",
        "range": {"start_at": start_at, "end_at": end_at},
        "count": len(rows),
        "rows": rows,
        # try to grab any cache/update timestamp from payload, else None
        "source_cache_updated_at": None
    }

    # common fields that might contain an "updated at" in the payload
    try:
        data_node = payload.get("data", {}) if isinstance(payload, dict) else {}
        for k in ("cacheUpdatedAt", "updatedAt", "updated_at", "lastUpdated", "modifiedAt"):
            if isinstance(data_node, dict) and k in data_node and data_node[k]:
                out["source_cache_updated_at"] = data_node[k]
                break
    except Exception:
        pass

    # Write atomically to public/leaderboard.json
    os.makedirs(os.path.dirname(OUT_PATH), exist_ok=True)
    tmp_path = OUT_PATH + ".tmp"
    try:
        with open(tmp_path, "w", encoding="utf-8") as f:
            json.dump(out, f, ensure_ascii=False, indent=2)
        os.replace(tmp_path, OUT_PATH)
    except Exception as e:
        print(f"❌ Failed to write output file: {e}", file=sys.stderr)
        sys.exit(1)

    print(f"✅ Wrote {OUT_PATH} with {len(rows)} rows for {start_at} → {end_at}")

if __name__ == "__main__":
    main()
