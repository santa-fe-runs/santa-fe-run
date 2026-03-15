---
name: run-gen
description: >
  Generate a complete run page for the santa-fe-run Jekyll site from a GPX file.
  Use this skill whenever the user invokes /run-gen or asks to generate/create a run
  from a GPX file. Automates the full workflow: running gpx_to_run.py, parsing the
  GPX <desc> tag for metadata and description
  and the AllTrails URL.
---

# /run-gen — Generate a Run Page from a GPX File

You are helping generate a complete run page for the santa-fe-run Jekyll site.

## Usage

```
/run-gen assets/gpx/my-trail.gpx
```

The GPX file **must be in `assets/gpx/`** already. If it isn't, stop and ask the user to move it there first.

---

## Step 1: Run the GPX-to-run script

From the repo root, run:

```bash
uv run scripts/gpx_to_run.py <gpx_path>
```

This creates `_runs/<slug>.md` with the basic stats (distance, elevation gain, altitude range, trailhead lat/lng, geocoded address). The slug is derived from the GPX filename.

If the script errors because the file already exists, tell the user and stop — don't delete it automatically.

---

## Step 2: Parse the `<desc>` tag from the GPX file

Read the GPX file and extract the `<desc>` element text from the root `<metadata>` element (not from a track or waypoint).

The `<desc>` tag follows this format:
```
Popularity: <1-5>/5
Difficulty: <1-5>/5
Dates: <MM-DD> to <MM-DD>

<trail description text, may span multiple paragraphs>
```

Parse out:
- **popularity**: integer 1–5
- **difficulty**: integer 1–5, mapped to a string label:
  - 1 → `green`
  - 2 → `blue`
  - 3 → `black`
  - 4 → `double-black`
  - 5 → `extreme`
- **date range**: the start/end dates as `MM-DD` strings, may not be 0 padded.
- **parking**: Look for a line in the description that starts with "Parking:" and extract the text after it as parking info.
- **area**: Look for a line in the description that starts with "Area:" and extract the area keyword from the text after it.
- **description**: everything after the blank line that follows the three header lines — this is the trail description body text

If the `<desc>` tag is missing or malformed, tell the user what was found and ask them to fix it before continuing.

---

## Step 3: Update the generated markdown file

Open `_runs/<slug>.md` and update the front matter:

1. Replace `difficulty: green` with `difficulty: <mapped-label>`
2. Add `popularity: <number>` immediately after the `difficulty` line
3. Replace the placeholder best_dates block:
   ```yaml
   best_dates:
     - start: "MM-DD"
       end: "MM-DD"
   ```
   with the actual dates from the desc:
   ```yaml
   best_dates:
     - start: "<start>"
       end: "<end>"
   ```
4. Replace the `parking` field with the actual parking info from the desc:
    ```yaml
    parking: "1-3 sentences of parking info from the desc"
    ```
5. Replace the `area` field with the actual area info from the desc:
    ```yaml
    area: "The area the run is in"
    ```
6. The `alltrails_url` fields will be filled in Step 4 — leave them as `"TODO"` and `""` for now.

Then replace the body placeholder (`TODO: Add run description.`) with the description text parsed from the `<desc>` tag.

---

## Step 4: Find AllTrails URL via web search

Use the run's `name` field (from the front matter) plus "Santa Fe" to search for:

1. **AllTrails URL**: Search for `"<run name> AllTrails Santa Fe"`. Look for a URL starting with `https://www.alltrails.com/trail/`. If found, update `alltrails_url` in the front matter. If not found with confidence, leave it blank and note it for the user.

---

## Step 5: Report what was done

Print a short summary:
- The run name and slug
- The values set for difficulty, popularity, and dates
- Whether AllTrails URL was found (and the URL if yes)
- Any fields that still need attention (e.g., `caltopo_url`, `image`)

## Step 6: Create a commit and push

Create a git commit with the message `Add run: <run name>` and push it to the repository.

---

## Notes

- Always run this from the repo root so the script can find `_runs/`.
- The GPX file name becomes the slug: `Hyde_Park_Road.gpx` → `hyde-park-road` → `_runs/hyde-park-road.md`.
- The `<desc>` tag parser should handle both `\r\n` and `\n` line endings.
- If the desc has multiple date windows (e.g., two separate seasons), add multiple entries under `best_dates`.
