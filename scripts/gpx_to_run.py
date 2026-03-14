#!/usr/bin/env python3
"""Generate a stub _runs/<slug>.md from a GPX file in assets/gpx/.

Usage (from repo root):
    uv run scripts/gpx_to_run.py assets/gpx/<slug>.gpx
"""

import json
import re
import sys
import textwrap
import urllib.request
from pathlib import Path

import gpxpy

M_TO_FT = 3.28084
M_PER_MILE = 1609.344


def reverse_geocode(lat: float, lng: float) -> str:
    """Return a short address string for the given coordinates via Nominatim.

    Returns an empty string on any error so the script never fails over geocoding.
    """
    url = f"https://nominatim.openstreetmap.org/reverse?lat={lat}&lon={lng}&format=json"
    req = urllib.request.Request(url, headers={"User-Agent": "santa-fe-run/1.0"})
    try:
        with urllib.request.urlopen(req, timeout=5) as resp:
            data = json.loads(resp.read())
        addr = data.get("address", {})
        road = addr.get("road", "")
        locality = addr.get("city") or addr.get("town") or addr.get("village") or addr.get("hamlet") or ""
        state = addr.get("state", "")
        parts = [p for p in (road, locality, state) if p]
        return ", ".join(parts)
    except Exception:
        return ""


def slug_to_name(slug: str) -> str:
    return " ".join(word.capitalize() for word in slug.split("-"))


def normalize_slug(stem: str) -> str:
    """Lowercase and collapse any non-alphanumeric characters to hyphens."""
    return re.sub(r"[^a-z0-9]+", "-", stem.lower()).strip("-")


def parse_gpx(gpx_path: Path) -> dict:
    with gpx_path.open() as f:
        gpx = gpxpy.parse(f)

    if not gpx.tracks:
        raise ValueError("no tracks found in GPX file")

    # Flatten all trackpoints across tracks and segments
    all_points = [
        pt
        for track in gpx.tracks
        for seg in track.segments
        for pt in seg.points
    ]
    if not all_points:
        raise ValueError("no trackpoints found in GPX file")

    # Validate elevation data before calculating gain
    elevations = [pt.elevation for pt in all_points if pt.elevation is not None]
    if not elevations:
        raise ValueError("no elevation data found in GPX file")

    # 2D distance in miles
    distance_mi = round(gpx.length_2d() / M_PER_MILE, 1)

    # Cumulative elevation gain (uphill only), rounded to nearest 10 ft
    uphill_m, _ = gpx.get_uphill_downhill()
    if uphill_m is None:
        raise ValueError("could not calculate elevation gain")
    elevation_gain_ft = int(round(uphill_m * M_TO_FT / 10) * 10)

    # Altitude range from raw trackpoints, rounded to nearest 10 ft
    min_ft = int(round(min(elevations) * M_TO_FT / 10) * 10)
    max_ft = int(round(max(elevations) * M_TO_FT / 10) * 10)

    # Trailhead = first trackpoint (search across segments for safety)
    first_pt = all_points[0]

    return {
        "distance": distance_mi,
        "elevation_gain": elevation_gain_ft,
        "alt_min": min_ft,
        "alt_max": max_ft,
        "lat": round(first_pt.latitude, 4),
        "lng": round(first_pt.longitude, 4),
    }


def build_markdown(name: str, gpx_site_path: str, stats: dict) -> str:
    return textwrap.dedent(f"""\
        ---
        name: "{name}"
        distance: {stats["distance"]}
        elevation_gain: {stats["elevation_gain"]}
        altitude_range:
          min: {stats["alt_min"]}
          max: {stats["alt_max"]}
        difficulty: green
        best_dates:
          - start: "MM-DD"
            end: "MM-DD"
        trailhead:
          lat: {stats["lat"]}
          lng: {stats["lng"]}
          address: "{stats["address"]}"
        parking: "TODO"
        gpx: "{gpx_site_path}"
        caltopo_url: ""
        alltrails_url: ""
        image: ""
        ---

        TODO: Add run description.
    """)


def main() -> None:
    if len(sys.argv) != 2:
        sys.exit("Usage: uv run scripts/gpx_to_run.py assets/gpx/<slug>.gpx")

    gpx_path = Path(sys.argv[1])
    if not gpx_path.is_absolute():
        gpx_path = Path.cwd() / gpx_path

    if not gpx_path.exists():
        sys.exit(f"Error: file not found: {sys.argv[1]}")

    repo_root = Path.cwd()
    if not (repo_root / "_runs").is_dir():
        sys.exit("Error: run this script from the repo root (_runs/ not found)")

    slug = normalize_slug(gpx_path.stem)
    output_path = repo_root / "_runs" / f"{slug}.md"

    if output_path.exists():
        sys.exit(f"Error: _runs/{slug}.md already exists — delete it first to regenerate")

    try:
        gpx_site_path = "/" + gpx_path.relative_to(repo_root).as_posix()
    except ValueError:
        gpx_site_path = f"/assets/gpx/{gpx_path.name}"

    name = slug_to_name(slug)

    try:
        stats = parse_gpx(gpx_path)
    except Exception as e:
        sys.exit(f"Error parsing GPX: {e}")

    print("Geocoding trailhead…", end=" ", flush=True)
    stats["address"] = reverse_geocode(stats["lat"], stats["lng"])
    print(stats["address"] or "(no result)")

    output_path.write_text(build_markdown(name, gpx_site_path, stats), encoding="utf-8")

    print(f"Created _runs/{slug}.md")
    print(f"  Name:      {name}")
    print(f"  Distance:  {stats['distance']} mi")
    print(f"  Gain:      {stats['elevation_gain']} ft")
    print(f"  Altitude:  {stats['alt_min']}–{stats['alt_max']} ft")
    print(f"  Trailhead: {stats['lat']}, {stats['lng']}")
    print(f"  Address:   {stats['address'] or '(none)'}")


if __name__ == "__main__":
    main()
