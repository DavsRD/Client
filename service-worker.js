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
 * 3. MEDIA_CACHE   — hazard videos + infographic PDFs. NEVER precached.
 *                    Cached when a full file is fetched, or when the page asks
 *                    with a CACHE_MEDIA message ("Save for offline").
 *                    Note: video players request byte ranges (206 responses),
 *                    which the Cache API can't store, so videos are reliably
 *                    saved for offline only through CACHE_MEDIA.
 *
 * All paths are relative to this file, so the site also works from a
 * sub-folder (e.g. a GitHub Pages project site).
 *
 * Bump CACHE_VERSION whenever you change any file listed below and deploy —
 * this clears the old caches.
 * -------------------------------------------------------------
 */

const CACHE_VERSION = "v7";
const SHELL_CACHE = `kalasag-shell-${CACHE_VERSION}`;
const DATA_CACHE = `kalasag-data-${CACHE_VERSION}`;
const MEDIA_CACHE = `kalasag-media-${CACHE_VERSION}`;

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
  "js/dashboard/dashboard.js",
  "js/dashboard/hotline-panel.js",
  "js/pages/welcome.js",
  "js/pages/courses.js",
  "js/pages/collection.js",
  "js/pages/subject-connect.js",
  "js/ui/hazard-card.js",
  "js/ui/video-modal.js",

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

  // Hero first slide. The other slides and the big hazard page images cache as they're viewed.
  "assets/images/scenes/volcano-lake.webp",

  ...HAZARD_ART,
  ...SPRITES,
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
      caches.open(DATA_CACHE).then((cache) => cache.addAll(DATA_FILES)),
    ]).then(() => self.skipWaiting())
  );
});

// ---------- ACTIVATE: clear out old cache versions ----------
self.addEventListener("activate", (event) => {
  const keepCaches = [SHELL_CACHE, DATA_CACHE, MEDIA_CACHE];
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
    event.respondWith(cacheFirstIfPresent(event.request, MEDIA_CACHE));
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

// ---------- Explicit "Save for offline" support ----------
// Call from a page like:
//   navigator.serviceWorker.controller.postMessage({
//     type: "CACHE_MEDIA",
//     urls: ["assets/videos/Earthquake_Safety_Drop_Cover_Hold_On.mp4"]
//   });
self.addEventListener("message", (event) => {
  if (event.data?.type === "CACHE_MEDIA" && Array.isArray(event.data.urls)) {
    event.waitUntil(caches.open(MEDIA_CACHE).then((cache) => cache.addAll(event.data.urls)));
  }
});
