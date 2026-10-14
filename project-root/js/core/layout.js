/**
 * layout.js — the header (nav, language toggle, Emergency button) and footer
 * shared by every page. Pages only provide empty placeholders:
 *   <header class="site-header" data-site-header></header>
 *   <footer class="site-footer" data-site-footer></footer>
 * so the nav exists in exactly one place.
 */

import { fetchJSON, esc } from "./data.js";
import { t, getLanguage, setLanguage, applyToPage } from "./i18n.js";

// 16x16 pixel icons, drawn with whole-pixel paths so they stay crisp.
const ICONS = {
  home: "M7 1h2v1h1v1h1v1h1v1h1v1h1v1h-2v7h-3v-4h-2v4h-3v-7h-2v-1h1v-1h1v-1h1v-1h1v-1h1v-1z",
  learn: "M1 3h6v1h2v-1h6v11h-6v1h-2v-1h-6z M2 4v9h5v-9z M9 4v9h5v-9z M3 6h3v1h-3z M3 9h3v1h-3z M10 6h3v1h-3z M10 9h3v1h-3z",
  collection: "M7 1h2v4h5v2h-1v1h-1v1h-1v2h1v3h-2v-1h-4v1h-2v-3h1v-2h-1v-1h-1v-1h-1v-2h5z",
  subject: "M1 2h6v6h-6z M2 3v4h4v-4z M9 8h6v6h-6z M10 9v4h4v-4z M3 8h2v3h4v2h-6z",
};

const NAV = [
  { page: "dashboard", href: "dashboard.html", key: "nav.home", icon: "home" },
  { page: "courses", href: "courses.html", key: "nav.learn", icon: "learn" },
  { page: "collection", href: "collection.html", key: "nav.collection", icon: "collection" },
  { page: "subject", href: "subject-connect.html", key: "nav.subject", icon: "subject" },
];

export function pixelIcon(name, className = "pixel-icon") {
  return `<svg class="${className}" viewBox="0 0 16 16" aria-hidden="true" shape-rendering="crispEdges"><path fill="currentColor" fill-rule="evenodd" d="${ICONS[name]}"/></svg>`;
}

function headerMarkup(currentPage) {
  const links = NAV.map(
    (item) => `
      <a class="main-nav__link" href="${item.href}"${item.page === currentPage ? ' aria-current="page"' : ""}>
        ${pixelIcon(item.icon, "main-nav__icon")}
        <span data-i18n="${item.key}"></span>
      </a>`
  ).join("");

  return `
    <a class="skip-link" href="#main" data-i18n="site.skip"></a>
    <div class="site-header__inner">
      <a class="brand" href="index.html">
        <img class="brand__icon sprite" src="assets/icons/favicon-64.png" width="32" height="32" alt="">
        <span class="brand__name" data-i18n="site.name"></span>
      </a>
      <nav class="main-nav" data-i18n-attr="aria-label:nav.main">${links}</nav>
      <div class="site-header__actions">
        <div class="lang-toggle" role="group" data-i18n-attr="aria-label:lang.label">
          <button type="button" class="lang-toggle__btn" data-lang="en" lang="en">EN</button>
          <button type="button" class="lang-toggle__btn" data-lang="fil" lang="fil">FIL</button>
        </div>
        <button type="button" class="btn btn--emergency" data-open-hotlines>
          <span aria-hidden="true">🚨</span><span class="btn--emergency__text" data-i18n="emergency.button"></span>
        </button>
      </div>
    </div>`;
}

function syncLangButtons(header) {
  const lang = getLanguage();
  header.querySelectorAll("[data-lang]").forEach((btn) => {
    btn.setAttribute("aria-pressed", String(btn.dataset.lang === lang));
  });
}

async function renderFooter(footer) {
  footer.innerHTML = `
    <div class="site-footer__inner">
      <button type="button" class="emergency-chip" data-open-hotlines>
        <span aria-hidden="true">🚨</span> <span data-i18n="emergency.chip"></span>
      </button>
      <div class="site-footer__brand">
        <img class="sprite" src="assets/icons/favicon-64.png" width="32" height="32" alt="">
        <span class="brand__name" data-i18n="site.name"></span>
      </div>
      <p class="site-footer__tagline" data-i18n="site.tagline"></p>
      <div class="site-footer__credits" data-credits></div>
      <p class="site-footer__small">© ${new Date().getFullYear()} Kalasag Kids · <span data-i18n="footer.offline"></span></p>
    </div>`;
  applyToPage(footer);

  try {
    const site = await fetchJSON("js/data/site.json");
    footer.querySelector("[data-credits]").innerHTML = `
      <p><span data-i18n="footer.thesis">${esc(t("footer.thesis"))}</span>: <cite>${esc(site.thesisTitle)}</cite></p>
      <p>${esc(site.school)}${site.proponents?.length ? " · " + site.proponents.map(esc).join(", ") : ""}</p>`;
  } catch {
    // Credits are optional; the footer still works without them.
  }
}

export function render() {
  const page = document.body.dataset.page;

  const header = document.querySelector("[data-site-header]");
  if (header) {
    header.innerHTML = headerMarkup(page);
    header.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-lang]");
      if (btn) setLanguage(btn.dataset.lang);
    });
    syncLangButtons(header);
    window.addEventListener("kalasag:languagechange", () => syncLangButtons(header));
  }

  const footer = document.querySelector("[data-site-footer]");
  if (footer) renderFooter(footer);
}
