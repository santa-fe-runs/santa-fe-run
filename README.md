# Run Santa Fe

A curated guide to trail running in Northern New Mexico — built with Jekyll and hosted on GitHub Pages.

**Live site:** https://santafe.run

---

## Local Development

### Prerequisites

- Ruby 3.x — managed via [rbenv](https://github.com/rbenv/rbenv) (a `.ruby-version` file pins the version)
- Bundler: `gem install bundler`

If rbenv isn't active in your shell, add it to `~/.zshrc` (or `~/.bashrc`) first:

```bash
echo 'eval "$(rbenv init -)"' >> ~/.zshrc
source ~/.zshrc
```

### Setup

```bash
cd santa-fe-run
bundle install
```

### Run locally

```bash
bundle exec jekyll serve --livereload
```

Open http://localhost:4000/santa-fe-run/ in your browser.

> **Note:** If the baseurl causes issues locally, run with:
> ```bash
> bundle exec jekyll serve --livereload --baseurl ""
> ```
> Then open http://localhost:4000/

### Build for production

```bash
JEKYLL_ENV=production bundle exec jekyll build
```

Output goes to `_site/`.

---

## Deployment (GitHub Pages)

This project uses GitHub Actions for deployment. The workflow is in `.github/workflows/deploy.yml`.

### First-time setup

1. **Create the repository** in the [`santa-fe-runs`](https://github.com/santa-fe-runs) GitHub organization:
   - Repo name: `santa-fe-run`
   - Visibility: Public (required for free GitHub Pages)

2. **Push the code:**
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin git@github.com:santa-fe-runs/santa-fe-run.git
   git push -u origin main
   ```

3. **Enable GitHub Pages** in the repo settings:
   - Go to **Settings → Pages**
   - Under **Source**, select **GitHub Actions**
   - Save

4. The workflow will run automatically on the next push to `main`. Check the **Actions** tab for deployment status.

### Subsequent deploys

Push to `main` and GitHub Actions handles the rest:

```bash
git add .
git commit -m "Add new trail"
git push
```

---

## Adding a Trail Run

Create a new file in `_runs/` with a `.md` extension. The filename becomes the URL slug.

**Example:** `_runs/my-new-trail.md`

```yaml
---
name: "My New Trail"
distance: 8.5             # miles
elevation_gain: 1500      # feet
altitude_range:
  min: 8000
  max: 9500               # feet
difficulty: blue          # green | blue | black | double-black
best_dates:
  - start: "04-15"        # MM-DD (month-day, year-agnostic)
    end:   "06-30"
  - start: "09-01"
    end:   "11-01"
trailhead:
  lat: 35.7000
  lng: -105.9000
  address: "Trailhead Rd, Santa Fe, NM 87501"
parking: "Description of parking situation."
caltopo_url: "https://caltopo.com/m/XXXXX"   # Required
alltrails_url: ""                             # Optional — leave blank if none
image: ""                                     # Optional — /assets/images/runs/my-trail.jpg
---

Your trail description in **Markdown** goes here. This is displayed on the run's detail page.

You can use headers, bullet points, bold text, etc.
```

### Difficulty levels

Use ski run terminology:

| Value | Symbol | Meaning |
|-------|--------|---------|
| `green` | ● | Easiest — gentle grades, good footing |
| `blue` | ■ | Intermediate — moderate climbs, some technical terrain |
| `black` | ◆ | Advanced — sustained climbing, technical sections |
| `double-black` | ◆◆ | Expert — serious elevation, remote, demanding conditions |

### Adding a GPX file

If you have a GPX file for the route, the run page will display an interactive MapLibre map with the track drawn on it and a download button in the sidebar.

1. Drop the GPX file into `assets/gpx/`
2. Set `gpx: "/assets/gpx/your-file.gpx"` in the run's front matter

#### Generating a stub run file from a GPX

The `scripts/gpx_to_run.py` script reads a GPX file and auto-calculates distance, elevation gain, altitude range, and trailhead coordinates, then writes a stub `_runs/<slug>.md` for you to fill in.

**Prerequisites:** [uv](https://docs.astral.sh/uv/getting-started/installation/)

**Usage (run from repo root):**

```bash
uv run scripts/gpx_to_run.py assets/gpx/my-trail.gpx
```

This creates `_runs/my-trail.md` with the calculated stats pre-filled. Fields that can't be derived from the GPX (`difficulty`, `best_dates`, `parking`, `caltopo_url`, description) are stubbed with `TODO` placeholders for you to complete.

The script errors out if `_runs/<slug>.md` already exists, so it won't overwrite existing run files.

### CalTopo maps

1. Create or open your map at [caltopo.com](https://caltopo.com)
2. Click **Share** → copy the public URL (e.g., `https://caltopo.com/m/XXXXX`)
3. Paste into the `caltopo_url` field
4. The site will embed this URL in an iframe on the run page

### Adding a photo (future support)

1. Add the image to `assets/images/runs/` (JPG or WebP recommended, max 1MB)
2. Set `image: /assets/images/runs/your-image.jpg` in the YAML front matter
3. Images appear as a hero photo on the run detail page

---

## Project Structure

```
santa-fe-run/
├── _runs/              # Trail run files (one .md per run)
├── _layouts/           # Page templates
│   ├── default.html    # Base HTML shell
│   └── run.html        # Individual run page
├── _includes/          # Reusable components
│   ├── difficulty-badge.html
│   ├── run-card.html
│   ├── header.html
│   └── footer.html
├── _sass/              # SCSS source
│   ├── _variables.scss # Design tokens (colors, spacing)
│   ├── _base.scss      # Reset and typography
│   ├── _components.scss
│   └── _layout.scss
├── assets/
│   ├── css/main.scss   # Stylesheet entry point
│   ├── js/search.js    # Client-side filtering
│   └── images/         # Trail photos (future)
├── index.html          # Home page
├── search.json         # Machine-readable run data
├── _config.yml         # Jekyll configuration
└── Gemfile
```

---

## Configuration

Key settings in `_config.yml`:

| Setting | Description |
|---------|-------------|
| `title` | Site name |
| `tagline` | Short description |
| `baseurl` | URL path prefix — set to `""` if repo is `santa-fe-runs.github.io` |
| `url` | Full site URL for absolute links and SEO |
