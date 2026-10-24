/**
 * service-worker.js
 * -------------------------------------------------------------
 * Three cache tiers, because not everything should be treated the same way:
 *
 * 1. SHELL_CACHE   — HTML/CSS/JS/fonts/icons/sprites. Precached on install
 *                    (cache-first), so the whole interface works offline.
 *
 * 2. DATA_CACHE    — hazard, lesson, and other content JSON. Precached on
 *                    install, then served "stale-while-revalidate": cached copy
 *                    instantly, fresh copy fetched in the background for next
 *                    time. Content can be updated after deploy without
 *                    breaking offline use.
 *
 * 3. SAVED_CACHE   — videos and big pictures the visitor chose to "Save for
 *                    offline" (one video, or everything from Settings). Written
 *                    by js/core/offline.js, never by this file. NOT versioned:
 *                    it survives CACHE_VERSION bumps so nobody has to download
 *                    100 MB again after an update. Video players ask for byte
 *                    ranges; serveMedia() cuts them from the saved full file.
 *
 * The first OFFLINE_SCENES slides in scenes.json are precached so the welcome
 * slideshow works offline; the rest only once someone saves everything.
 *
 * All paths are relative to this file, so the site also works from a
 * sub-folder (e.g. a GitHub Pages project site).
 *
 * Bump CACHE_VERSION whenever you change any file listed below and deploy —
 * this clears the old caches.
 * -------------------------------------------------------------
 */

const CACHE_VERSION = "v18";
const SHELL_CACHE = `kalasag-shell-${CACHE_VERSION}`;
const DATA_CACHE = `kalasag-data-${CACHE_VERSION}`;
const SAVED_CACHE = "kalasag-saved-v1"; // same name as in js/core/offline.js

const OFFLINE_SCENES = 3;

const BASE = new URL("./", self.location).pathname; // e.g. "/" or "/kalasag-kids/"

const SPRITES = [
  "expr_wink_geared", "gear_on_full", "pose_alert_geared", "pose_closed_wings_geared",
  "pose_duck_cover_geared", "pose_head_flip_1_geared", "pose_head_flip_2_geared",
  "pose_idle_geared", "pose_point_geared", "pose_run_flap_1_geared", "pose_run_flap_2_geared",
  "pose_stop_wing_geared", "prop_on_face_mask_geared", "prop_on_magnifier_geared",
  "prop_on_sign_geared", "prop_on_sweat_drop_geared",
].map((name) => `assets/pixel-eagle-sprites/png/1x/${name}.png`);

// Each hazard's icon (Home posters, Collections) and card thumbnail (Learn): ~0.8 MB in all.
const HAZARD_IDS = [
  "earthquake", "volcanic-eruption", "tsunami", "landslide", "typhoon", "severe-flooding", "storm-surge",
  "el-nino", "disease-outbreak", "pest-infestation", "fire", "structural-collapse", "road-accidents",
  "chemical-spill", "electrical-hazards", "missing-child", "bullying", "crowd-crush", "community-conflict",
];
const HAZARD_ART = HAZARD_IDS.flatMap((id) => [
  `assets/icons/hazards/${id}.webp`,
  `assets/images/hazards/${id}-thumb.webp`,
]);

// AGILA Safety Games: the small shared core (KALASAG O8). Keep in step with CORE_SCRIPTS in
// js/ui/game-host.js. Game art, audio and each game's own scripts are NOT precached: they
// cache as they're played, or with "Save game for offline" (kalasag-saved-v1).
const GAME_CORE = [
  "minigames/css/ag.css",
  "minigames/js/core/base.js", "minigames/js/data/strings.js", "minigames/js/data/icons.js",
  "minigames/js/core/store.js", "minigames/js/core/assets.js", "minigames/js/core/sound.js",
  "minigames/js/core/ui.js", "minigames/js/core/dnd.js", "minigames/js/core/input.js",
  "minigames/js/core/pixelicon.js", "minigames/js/core/chars.js", "minigames/js/core/rig.js",
  "minigames/js/core/canvas.js", "minigames/js/core/kit.js", "minigames/js/data/dialogue-data.js",
  "minigames/js/core/dialogue.js", "minigames/js/core/registry.js", "minigames/js/core/router.js",
  "minigames/js/core/progress.js", "minigames/js/core/app.js",
  "minigames/js/data/registry.json",
  // E6 cards engine: the scripts in registry.json engines.cards, plus its stylesheet
  "minigames/css/cards.css",
  "minigames/js/logic/cards/onet.js", "minigames/js/logic/cards/letters.js",
  "minigames/js/logic/cards/swipe.js", "minigames/js/logic/cards/memory.js",
  "minigames/js/engines/cards/cards.js", "minigames/js/engines/cards/letter-tiles.js",
  "minigames/js/engines/cards/swipe-stack.js", "minigames/js/engines/cards/onet-view.js",
  "minigames/js/engines/cards/widgets.js",
  // E1 grid engine: the scripts in registry.json engines.grid, plus its stylesheet
  "minigames/css/grid.css",
  "minigames/js/logic/grid/path.js", "minigames/js/logic/grid/procgen.js",
  "minigames/js/logic/grid/select.js", "minigames/js/logic/grid/undo.js",
  "minigames/js/engines/grid/tilemap.js", "minigames/js/engines/grid/camera.js",
  "minigames/js/engines/grid/darkness.js", "minigames/js/engines/grid/mover.js",
  "minigames/js/engines/grid/cursor.js",
  "minigames/assets/asset-manifest.json",
];

// Small files only: everything here downloads on install.
const SHELL_FILES = [
  "./",
  "index.html",
  "dashboard.html",
  "courses.html",
  "collection.html",
  "subject-connect.html",
  "offline.html",
  "manifest.json",

  "css/variables.css",
  "css/components.css",
  "css/welcome.css",
  "css/dashboard.css",
  "css/courses.css",
  "css/collection.css",

  "js/main.js",
  "js/core/state.js",
  "js/core/i18n.js",
  "js/core/data.js",
  "js/core/layout.js",
  "js/core/theme.js",
  "js/core/mascot.js",
  "js/core/offline.js",
  "js/dashboard/dashboard.js",
  "js/dashboard/hotline-panel.js",
  "js/pages/welcome.js",
  "js/pages/courses.js",
  "js/pages/collection.js",
  "js/pages/subject-connect.js",
  "js/ui/hazard-card.js",
  "js/ui/video-modal.js",
  "js/ui/offline-ui.js",
  "js/ui/game-host.js",
  "js/ui/hazard-video.js",
  "js/core/games.js",

  "vendor/pixel-pencil-cursor/pencil-cursor.css",
  "vendor/pixel-pencil-cursor/pencil-cursor.js",

  "assets/fonts/pixelify-sans-400.woff2",
  "assets/fonts/pixelify-sans-700.woff2",
  "assets/fonts/nunito-400.woff2",
  "assets/fonts/nunito-700.woff2",
  "assets/fonts/nunito-800.woff2",

  "assets/icons/favicon-64.png",
  "assets/icons/apple-touch-icon.png",
  "assets/icons/icon-192.png",
  "assets/icons/icon-512.png",
  "assets/images/Blank.jpg",

  ...HAZARD_ART,
  ...SPRITES,
  ...GAME_CORE,
];

const DATA_FILES = [
  "js/data/hazards.json",
  "js/data/scenes.json",
  "js/data/tips.json",
  "js/data/subjects.json",
  "js/data/site.json",
  "js/data/local-hotlines.json",
  "js/data/lessons/earthquake.json",
  "js/data/lessons/typhoon.json",
  "js/data/lessons/volcanic-eruption.json",
];

// File-type helpers so routing logic below stays readable.
const isMediaRequest = (url) =>
  url.pathname.startsWith(BASE + "assets/videos/") || url.pathname.startsWith(BASE + "assets/infographics/");

const isDataRequest = (url) => url.pathname.startsWith(BASE + "js/data/") && url.pathname.endsWith(".json");

// ---------- INSTALL: precache the app shell and content data ----------
self.addEventListener("install", (event) => {
  event.waitUntil(
    Promise.all([
      caches.open(SHELL_CACHE).then((cache) => cache.addAll(SHELL_FILES)),
      caches.open(DATA_CACHE).then((cache) => cache.addAll(DATA_FILES)).then(precacheFirstScenes),
    ]).then(() => self.skipWaiting())
  );
});

// The first few slideshow scenes, read from scenes.json so adding slides needs no change here.
async function precacheFirstScenes() {
  const { slides } = await (await caches.match("js/data/scenes.json")).json();
  const urls = slides.slice(0, OFFLINE_SCENES).map((slide) => `assets/images/scenes/${slide.id}.webp`);
  await (await caches.open(SHELL_CACHE)).addAll(urls);
}

// ---------- ACTIVATE: clear out old cache versions ----------
self.addEventListener("activate", (event) => {
  const keepCaches = [SHELL_CACHE, DATA_CACHE, SAVED_CACHE];
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => !keepCaches.includes(key)).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

// ---------- FETCH: route each request to the right strategy ----------
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Only handle same-origin GET requests; let everything else pass through.
  if (event.request.method !== "GET" || url.origin !== self.location.origin) return;

  if (isMediaRequest(url)) {
    event.respondWith(serveMedia(event.request));
    return;
  }

  if (isDataRequest(url)) {
    event.respondWith(staleWhileRevalidate(event.request, DATA_CACHE));
    return;
  }

  // Default: app shell files and page navigations — cache first, network fallback,
  // with the offline page for navigations that fail entirely.
  event.respondWith(
    cacheFirstIfPresent(event.request, SHELL_CACHE).catch(() => {
      if (event.request.mode === "navigate") return caches.match(BASE + "offline.html");
      return Response.error();
    })
  );
});

// ---------- Strategies ----------

// Serve from cache if present; otherwise fetch from network and store a copy.
async function cacheFirstIfPresent(request, cacheName) {
  // Page navigations ignore the query string so courses.html?hazard=<id> matches the cached courses.html.
  const cached = await caches.match(request, { ignoreSearch: request.mode === "navigate" });
  if (cached) return cached;

  const response = await fetch(request);
  // Only full 200 responses can be cached (not 206 partial video ranges).
  if (response && response.status === 200) {
    const cache = await caches.open(cacheName);
    cache.put(request, response.clone()).catch(() => {});
  }
  return response;
}

// Videos: from the saved copy if the visitor saved it, otherwise straight from the network
// (not cached: players fetch byte ranges, which can't be stored).
async function serveMedia(request) {
  const saved = await caches.match(request.url); // a plain URL, so the Range header doesn't matter
  if (!saved) return fetch(request);

  const range = /^bytes=(\d*)-(\d*)$/.exec(request.headers.get("Range") || "");
  if (!range) return saved;

  const blob = await saved.blob();
  let start = Number(range[1]);
  let end = range[2] ? Math.min(Number(range[2]), blob.size - 1) : blob.size - 1;
  if (!range[1]) {
    start = Math.max(blob.size - Number(range[2]), 0); // "bytes=-500": the last 500 bytes
    end = blob.size - 1;
  }
  if (start > end || start >= blob.size) {
    return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${blob.size}` } });
  }
  return new Response(blob.slice(start, end + 1), {
    status: 206,
    headers: {
      "Content-Type": saved.headers.get("Content-Type") || "video/mp4",
      "Content-Length": String(end - start + 1),
      "Content-Range": `bytes ${start}-${end}/${blob.size}`,
      "Accept-Ranges": "bytes",
    },
  });
}

// Serve cache instantly if we have it, then refresh it in the background.
async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);

  const networkFetch = fetch(request)
    .then((response) => {
      if (response && response.status === 200) cache.put(request, response.clone()).catch(() => {});
      return response;
    })
    .catch(() => cached || Response.error()); // offline and nothing cached

  return cached || networkFetch;
}
