/**
 * main.js — the one script every page loads. Deliberately thin:
 * theme → language → shared layout → hotlines → mascot → that page's controller.
 * Feature logic belongs in the page modules, not here.
 */

import * as i18n from "./core/i18n.js";
import * as layout from "./core/layout.js";
import * as theme from "./core/theme.js";
import * as mascot from "./core/mascot.js";
import * as hotlines from "./ui/hotline-panel.js";
import { PLACEHOLDER_IMG } from "./core/data.js";

// Each page names its controller with <body data-page="...">. Loaded on demand
// so a page only downloads the code it needs.
const PAGE_CONTROLLERS = {
  welcome: () => import("./pages/welcome.js"),
  dashboard: () => import("./pages/dashboard.js"),
  courses: () => import("./pages/courses.js"),
  collection: () => import("./pages/collection.js"),
  subject: () => import("./pages/subject-connect.js"),
};

/** Any image that fails to load (an asset not made yet) shows the blank placeholder instead. */
function usePlaceholderForMissingImages() {
  document.addEventListener(
    "error",
    (e) => {
      const img = e.target;
      if (img instanceof HTMLImageElement && !img.src.endsWith(PLACEHOLDER_IMG)) {
        img.src = PLACEHOLDER_IMG;
        img.classList.add("is-placeholder");
      }
    },
    true // error events don't bubble; listen in the capture phase
  );
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  // Skipped on a local dev server so edits show up on refresh instead of being
  // served from the offline cache. Add ?sw to the URL to test offline locally.
  const isLocal = ["localhost", "127.0.0.1", "[::1]"].includes(location.hostname);
  if (isLocal && !new URLSearchParams(location.search).has("sw")) return;
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("service-worker.js").catch((err) => {
      console.warn("Service worker registration failed:", err);
    });
  });
}

async function routeToPageController() {
  const load = PAGE_CONTROLLERS[document.body.dataset.page];
  if (!load) return;
  const controller = await load();
  await controller.init?.();
}

async function bootstrap() {
  usePlaceholderForMissingImages();
  theme.init();
  layout.render();
  i18n.applyToPage();
  hotlines.mountSiteWide();
  mascot.init();
  registerServiceWorker();
  try {
    await routeToPageController();
  } finally {
    // Anything the page controller rendered gets translated and its mascots wired.
    i18n.applyToPage();
    mascot.init();
  }
}

bootstrap();
