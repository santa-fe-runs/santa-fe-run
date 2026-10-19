#!/usr/bin/env python3
"""Fetch upcoming New Mexico races from RunSignup and UltraSignup into _data/races.json.

Stdlib only so it runs in CI without installing anything.

Usage (from repo root):
    python3 scripts/fetch_races.py

RunSignup addresses have no coordinates, so cities are geocoded via Nominatim
and cached in scripts/race_geocache.json (commit it to keep CI builds fast).
"""

import datetime as dt
import html
import json
import re
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parent.parent
OUT_PATH = ROOT / "_data" / "races.json"
GEOCACHE_PATH = Path(__file__).resolve().parent / "race_geocache.json"

USER_AGENT = "santa-fe-run/1.0 (+https://santafe.run)"
MONTHS_AHEAD = 12

KM_TO_MI = 0.621371
M_PER_MILE = 1609.344

# RunSignup event types that are actually foot races
RUNSIGNUP_RUN_TYPES = {"running_race", "trail_race", "running_only", "nonprofit_event", "other"}

# Several centers so the UltraSignup radius search fully covers the state
ULTRASIGNUP_CENTERS = [(36.4, -106.0), (34.4, -106.1), (32.8, -105.5), (35.0, -108.0), (34.5, -104.0)]
ULTRASIGNUP_RADIUS_MI = 250


def get_json(url: str, timeout: int = 30):
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT, "Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read())


# ─── Distance parsing ──────────────────────────────────────────────────────────

_NUM = r"(\d+(?:\.\d+)?)"


def parse_distance(label: str):
    """Return (miles, timed) for a free-form distance label like '50K', '13.1 Miles', '24hrs'.

    miles is None when the label can't be interpreted.
    """
    if not label:
        return None, False
    s = label.lower().replace(",", "")

    if re.search(r"\b\d+\s*(?:hrs?|hours?)\b|\bbackyard\b|\bhour\b", s):
        return None, True
    if "half marathon" in s or "half-marathon" in s:
        return 13.1, False
    if "marathon" in s and "ultra" not in s:
        return 26.2, False

    m = re.search(_NUM + r"\s*(?:km|k)\b", s)
    if m:
        return round(float(m.group(1)) * KM_TO_MI, 2), False
    m = re.search(_NUM + r"\s*(?:miles?|miler|mi)\b", s)
    if m:
        return float(m.group(1)), False
    m = re.search(_NUM + r"\s*(?:yards?|yds?)\b", s)
    if m:
        return round(float(m.group(1)) / 1760, 3), False
    m = re.search(_NUM + r"\s*(?:m|meters?)\b", s)
    if m:
        return round(float(m.group(1)) / M_PER_MILE, 2), False
    # Bare number, e.g. "Backbone 100" — UltraSignup convention is miles
    m = re.search(r"\b" + _NUM + r"\b(?![:.]?\d|\s*[ap]m)", s)
    if m and 1 <= float(m.group(1)) <= 250:
        return float(m.group(1)), False
    return None, False


def make_distance(label: str):
    miles, timed = parse_distance(label)
    return {"label": label.strip(), "miles": miles, "timed": timed}


def classify_type(name: str, default: str) -> str:
    n = name.lower()
    if re.search(r"\btrail|\bultra\b|\bskyrace|\bmountain\b|\bpeak|\bcanyon|\bmesa\b", n):
        return "trail"
    if re.search(r"\broad\b|\bstreet\b", n):
        return "road"
    return default


# ─── Geocoding ─────────────────────────────────────────────────────────────────

def load_geocache():
    try:
        return json.loads(GEOCACHE_PATH.read_text())
    except (FileNotFoundError, json.JSONDecodeError):
        return {}


def geocode(cache: dict, city: str, state: str, zipcode: str):
    key = f"{city}, {state} {zipcode}".strip()
    if key in cache:
        return cache[key]
    coords = None
    queries = []
    if city:
        queries.append({"city": city, "state": state, "country": "USA"})
    if zipcode:
        queries.append({"postalcode": zipcode, "country": "USA"})
    for q in queries:
        url = "https://nominatim.openstreetmap.org/search?" + urllib.parse.urlencode({**q, "format": "json", "limit": 1})
        try:
            time.sleep(1.1)  # Nominatim usage policy: max 1 req/sec
            res = get_json(url, timeout=10)
        except Exception as e:  # noqa: BLE001 — never fail the build over geocoding
            print(f"  geocode failed for {key}: {e}", file=sys.stderr)
            continue
        if res:
            coords = [round(float(res[0]["lat"]), 4), round(float(res[0]["lon"]), 4)]
            break
    cache[key] = coords
    return coords


# ─── RunSignup ─────────────────────────────────────────────────────────────────

def parse_rs_datetime(s: str):
    # "8/14/2027 08:00"
    return dt.datetime.strptime(s, "%m/%d/%Y %H:%M")


def fetch_runsignup(today: dt.date, end: dt.date, geocache: dict):
    races = []
    page = 1
    while True:
        params = {
            "format": "json",
            "state": "NM",
            "country": "US",
            "start_date": today.isoformat(),
            "end_date": end.isoformat(),
            "events": "T",
            "results_per_page": 100,
            "page": page,
            "sort": "date ASC",
        }
        data = get_json("https://runsignup.com/Rest/races?" + urllib.parse.urlencode(params))
        batch = data.get("races", [])
        if not batch:
            break
        for item in batch:
            race = item["race"]
            if race.get("is_draft_race") == "T" or race.get("is_private_race") == "T":
                continue
            events = []
            for ev in race.get("events") or []:
                if ev.get("event_type") not in RUNSIGNUP_RUN_TYPES or ev.get("volunteer") == "T":
                    continue
                try:
                    start = parse_rs_datetime(ev["start_time"])
                except (KeyError, ValueError):
                    continue
                if not (today <= start.date() <= end):
                    continue
                events.append((start, ev))
            if not events:
                continue

            distances, seen = [], set()
            for _, ev in sorted(events, key=lambda e: e[0]):
                label = ev.get("distance") or ev.get("name") or ""
                d = make_distance(label)
                if d["miles"] is None and not d["timed"] and ev.get("name"):
                    d = make_distance(ev["name"]) | {"label": label or ev["name"]}
                if d["miles"] is None and not d["timed"]:
                    continue
                k = (d["miles"], d["timed"])
                if k not in seen:
                    seen.add(k)
                    distances.append(d)
            if not distances:
                continue

            start_date = min(e[0] for e in events).date()
            end_date = max(e[0] for e in events).date()
            is_trail = any(ev.get("event_type") == "trail_race" for _, ev in events)
            addr = race.get("address") or {}
            coords = geocode(geocache, addr.get("city", ""), addr.get("state", "NM"), addr.get("zipcode", ""))

            races.append({
                "id": f"rs-{race['race_id']}",
                "source": "RunSignup",
                "name": html.unescape(race["name"]).strip(),
                "url": race.get("url"),
                "date": start_date.isoformat(),
                "end_date": end_date.isoformat() if end_date != start_date else None,
                "city": addr.get("city", ""),
                "lat": coords[0] if coords else None,
                "lng": coords[1] if coords else None,
                "type": "trail" if is_trail else classify_type(race["name"], "road"),
                "distances": distances,
                "registration_open": race.get("is_registration_open") == "T",
            })
        page += 1
        if len(batch) < 100:
            break
    return races


# ─── UltraSignup ───────────────────────────────────────────────────────────────

def fetch_ultrasignup(today: dt.date, end: dt.date):
    by_id = {}
    for lat, lng in ULTRASIGNUP_CENTERS:
        params = {"lat": lat, "lng": lng, "mi": ULTRASIGNUP_RADIUS_MI, "mo": MONTHS_AHEAD}
        try:
            events = get_json("https://ultrasignup.com/service/events.svc/closestevents?" + urllib.parse.urlencode(params))
        except Exception as e:  # noqa: BLE001
            print(f"  UltraSignup query failed at {lat},{lng}: {e}", file=sys.stderr)
            continue
        for ev in events:
            if ev.get("State") != "NM" or ev.get("VirtualEvent") or ev.get("Cancelled"):
                continue
            by_id[ev["EventDateId"]] = ev

    races = []
    for ev in by_id.values():
        try:
            date = dt.datetime.strptime(ev["EventDate"], "%m/%d/%Y").date()
        except (KeyError, ValueError):
            continue
        if not (today <= date <= end):
            continue
        end_date = None
        if ev.get("EventDateEnd"):
            try:
                end_date = dt.datetime.strptime(ev["EventDateEnd"], "%m/%d/%Y").date().isoformat()
            except ValueError:
                pass
        labels = [x.strip() for x in (ev.get("Distances") or "").split(",") if x.strip()]
        distances, seen = [], set()
        for label in labels:
            d = make_distance(label)
            k = (d["miles"], d["timed"])
            if (d["miles"] is None and not d["timed"]) or k in seen:
                continue
            seen.add(k)
            distances.append(d)
        if not distances:
            continue
        name = html.unescape(ev["EventName"]).strip()
        races.append({
            "id": f"us-{ev['EventDateId']}",
            "source": "UltraSignup",
            "name": name,
            "url": f"https://ultrasignup.com/register.aspx?eid={ev['EventId']}",
            "date": date.isoformat(),
            "end_date": end_date,
            "city": ev.get("City", ""),
            "lat": float(ev["Latitude"]) if ev.get("Latitude") else None,
            "lng": float(ev["Longitude"]) if ev.get("Longitude") else None,
            # UltraSignup is overwhelmingly trail; only obvious road/fun runs get flipped
            "type": "road" if re.search(r"\broad\b|fun run", name.lower()) else "trail",
            "distances": distances,
            "registration_open": bool(ev.get("OpenRegistration")),
        })
    return races


# ─── Merge ─────────────────────────────────────────────────────────────────────

def norm_name(name: str) -> str:
    n = re.sub(r"\b(19|20)\d{2}\b", "", name.lower())
    n = re.sub(r"\b\d+(st|nd|rd|th)\b|\bannual\b", "", n)
    return re.sub(r"[^a-z0-9]", "", n)


def dedupe(races):
    """Drop races listed on both platforms (same date + same normalized name). Prefer UltraSignup for coords."""
    out = {}
    for r in sorted(races, key=lambda r: r["source"] != "UltraSignup"):
        key = (r["date"], norm_name(r["name"]))
        if key not in out:
            out[key] = r
    return list(out.values())


def main():
    today = dt.datetime.now(ZoneInfo("America/Denver")).date()
    end = today + dt.timedelta(days=365)
    geocache = load_geocache()

    races = []
    try:
        rs = fetch_runsignup(today, end, geocache)
        print(f"RunSignup: {len(rs)} races")
        races += rs
    except Exception as e:  # noqa: BLE001
        print(f"RunSignup fetch failed: {e}", file=sys.stderr)
    try:
        us = fetch_ultrasignup(today, end)
        print(f"UltraSignup: {len(us)} races")
        races += us
    except Exception as e:  # noqa: BLE001
        print(f"UltraSignup fetch failed: {e}", file=sys.stderr)

    GEOCACHE_PATH.write_text(json.dumps(dict(sorted(geocache.items())), indent=2) + "\n")

    if not races:
        print("No races fetched; leaving existing data untouched", file=sys.stderr)
        return 1

    races = sorted(dedupe(races), key=lambda r: (r["date"], r["name"]))
    OUT_PATH.parent.mkdir(exist_ok=True)
    OUT_PATH.write_text(json.dumps({
        "fetched_at": dt.datetime.now(ZoneInfo("America/Denver")).isoformat(timespec="seconds"),
        "races": races,
    }, indent=1) + "\n")
    print(f"Wrote {len(races)} races to {OUT_PATH.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
