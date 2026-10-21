# Kalasag Kids

*Learning to stay safe, one hazard at a time.*

A disaster-preparedness learning website for elementary pupils (Grades 1–6), hosted by
Agila the eagle. It covers 19 hazards with short videos, step-by-step lessons, printable
safety posters, and links to school subjects. It's a thesis project for Kolehiyo ng Lungsod
ng Lipa. The full plan is in [docs/project-context.md](docs/project-context.md).

- **No accounts, no backend, no database.** Progress is saved in each device's browser.
- **Works offline** after the first visit (it's a Progressive Web App).
- **English and Filipino**, switchable any time from Settings.
- **Plain HTML, CSS and JavaScript**, with no build step.

## Run it locally

From this folder:

```bash
python3 -m http.server 8000
```

Then open <http://localhost:8000>. Opening the HTML files directly (`file://…`) won't
work, because the site loads its content with `fetch()`.

Offline mode is switched off on `localhost` so your edits show up when you refresh. To
test offline mode, add `?sw` to the address (for example `http://localhost:8000/?sw`).

## Pages

| Page | File | What it does |
|---|---|---|
| Welcome | `index.html` | Landing page with the scene slideshow |
| Home | `dashboard.html` | Progress, Jump back in, safety posters, emergency hotlines |
| Learn | `courses.html` | All 19 hazards. `courses.html?hazard=earthquake` opens one hazard's lesson |
| Collections | `collection.html` | Unlocked games and quizzes (not built yet) |
| Subject | `subject-connect.html` | Hazards grouped by school subject |
| Offline | `offline.html` | Shown when a page isn't saved for offline use |

## Folder layout

```
assets/
  fonts/                 Pixelify Sans + Nunito (open licence, self-hosted)
  icons/                 App icons and favicon; icons/hazards/ = one icon per hazard
  images/scenes/         Welcome slideshow backgrounds
  images/hazards/        Each hazard's card thumbnail and page header image
  images/Blank.jpg       Placeholder shown wherever an image is still missing
  pixel-eagle-sprites/   Agila sprite pack (the site uses the *_geared PNGs in png/1x/)
  videos/                One ~1-minute video per hazard
css/                     variables.css (colors, themes, fonts) → components.css → one file per page
js/
  main.js                Loaded by every page; starts everything else
  core/                  Storage, language, themes, layout, mascot, data loading
  pages/ dashboard/ ui/  Page controllers and shared pieces
  data/                  All the content, as JSON (see below)
vendor/pixel-pencil-cursor/   The pixel pencil cursor
tools/optimize_images.py      Turns the original art into the small web images
docs/                         Project plan and notes (not part of the site)
service-worker.js, manifest.json   Offline support and app install
```

## Editing content

Everything pupils read lives in `js/data/`, and every text has an `en` and a `fil` version.

- **Hazards:** `hazards.json` has each hazard's name, short description, category, images,
  video and subjects. The `id` (for example `earthquake`) is used in links and saved progress,
  so don't rename it.
- **Lessons:** `lessons/<id>.json` holds the six steps (what it is, warning signs, before,
  during, after, Agila's reminder), the safety poster, and subject links. So far only
  `earthquake`, `typhoon` and `volcanic-eruption` exist; other hazards show "still preparing".
  To add one, copy an existing file and add `"lesson": "js/data/lessons/<id>.json"` to that
  hazard in `hazards.json`.
- **Local hotlines:** `local-hotlines.json`. Fill in the nearest fire station and the
  barangay/LGU DRRM office numbers; until then pupils are told to ask their teacher.
- **Footer credits:** `site.json`. Keep the key names lowercase (`thesisTitle`, `school`, `proponents`).
- **"Did you know?" tips:** `tips.json`. **School subjects:** `subjects.json`.
- **On-screen labels** (buttons, menus): `js/core/i18n.js`.

## Adding or replacing art

The large original images are kept **outside** this folder, in its parent folder, so
they're never published with the site:

```
../Thumbnails/16:9/<hazard>.jpeg    ../Thumbnails/1x1/1x1-<hazard>.jpeg    ../<scene>.png
```

After changing any of them, run:

```bash
python3 tools/optimize_images.py
```

It rebuilds the small WebP images in `assets/` (about 25 seconds). Requires Python 3 with
Pillow (`pip install pillow`).

## Publishing an update

The site works offline because the service worker keeps a copy of its files. When you
publish changes, **raise `CACHE_VERSION` in `service-worker.js`** (for example `v6` → `v7`).
Otherwise people who already visited keep seeing the old version. If you add a new page,
script or stylesheet, also add it to `SHELL_FILES` in the same file.

Any static host works (GitHub Pages, Netlify, Cloudflare Pages, Vercel). It needs HTTPS for
offline mode, and all of these hosts provide it.

## Not built yet

- Quizzes and mini-games (Collections shows them as locked)
- Story Mode (planned as the last addition)
- Lessons for 16 of the 19 hazards, videos for 10, and video captions
- A native-speaker review of the Filipino text
