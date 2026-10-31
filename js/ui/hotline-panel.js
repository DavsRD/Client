/**
 * hotline-panel.js — the emergency hotlines, one tap away on every page.
 *
 * Two forms share the same list:
 *   - a dialog opened by any [data-open-hotlines] button (header, footer chip)
 *   - an always-visible inline panel: render(container)  (Home sidebar)
 *
 * National numbers are fixed here (verified 2026). The two local numbers come
 * from js/data/local-hotlines.json so another school can reuse the site by
 * editing that one file.
 *
 * Numbers are shown as plain text, not tap-to-call links: shared school
 * computers can't place calls, and a pupil should read the number to an adult.
 */

import { fetchJSON, esc } from "../core/data.js";
import { t, pick } from "../core/i18n.js";

const NATIONAL = [
  { labelKey: "emergency.national", number: "911", primary: true },
  { labelKey: "emergency.ndrrmc", number: "(02) 8911-1406" },
  { labelKey: "emergency.redcross", number: "143" },
  { labelKey: "emergency.pnp", number: "117" },
];

let localPromise = null;
function getLocalNumbers() {
  localPromise ??= fetchJSON("js/data/local-hotlines.json").catch(() => ({}));
  return localPromise;
}

async function listMarkup() {
  const local = await getLocalNumbers();
  const rows = NATIONAL.map((n) => ({ label: t(n.labelKey), number: n.number, primary: n.primary }));
  for (const key of ["bfp", "drrm"]) {
    const entry = local[key];
    if (entry) rows.push({ label: pick(entry.label), number: entry.number });
  }

  return rows
    .map((row) => {
      const number = row.number
        ? `<span class="hotline__number">${esc(row.number)}</span>`
        : `<span class="hotline__missing">${esc(t("emergency.missing"))}</span>`;
      return `<li class="hotline${row.primary ? " hotline--primary" : ""}">
                <span class="hotline__label">${esc(row.label)}</span>
                ${number}
              </li>`;
    })
    .join("");
}

async function fill(panel) {
  panel.querySelector("[data-hotline-title]").textContent = t("emergency.title");
  panel.querySelector("[data-hotline-intro]").textContent = t("emergency.intro");
  panel.querySelector("[data-hotline-list]").innerHTML = await listMarkup();
}

function panelMarkup(headingTag) {
  return `
    <${headingTag} class="hotline-panel__title"><span aria-hidden="true">🚨</span> <span data-hotline-title></span></${headingTag}>
    <p class="hotline-panel__intro" data-hotline-intro></p>
    <ul class="hotline-list" data-hotline-list></ul>`;
}

const inlinePanels = new Set();

/** Mounts an always-visible hotline panel inside container. */
export function render(container) {
  container.classList.add("hotline-panel");
  container.innerHTML = panelMarkup("h2");
  inlinePanels.add(container);
  fill(container);
}

// ---------- Dialog form ----------
let dialog = null;

function ensureDialog() {
  if (dialog) return dialog;
  dialog = document.createElement("dialog");
  dialog.className = "modal hotline-dialog";
  dialog.setAttribute("aria-labelledby", "hotline-dialog-title");
  dialog.innerHTML = `
    <div class="modal__box hotline-panel">
      <button type="button" class="modal__close" data-close aria-label="${esc(t("common.close"))}">✕</button>
      ${panelMarkup("h2").replace("<h2 ", '<h2 id="hotline-dialog-title" ')}
    </div>`;
  dialog.addEventListener("click", (e) => {
    // Clicking the backdrop (the dialog itself, outside the box) closes it.
    if (e.target === dialog || e.target.closest("[data-close]")) dialog.close();
  });
  document.body.appendChild(dialog);
  return dialog;
}

export async function openDialog() {
  const d = ensureDialog();
  await fill(d);
  d.querySelector("[data-close]").setAttribute("aria-label", t("common.close"));
  if (!d.open) d.showModal();
}

export function toggleExpanded() {
  if (dialog?.open) dialog.close();
  else openDialog();
}

/** Called once per page by main.js: any [data-open-hotlines] opens the dialog. */
export function mountSiteWide() {
  document.addEventListener("click", (e) => {
    if (e.target.closest("[data-open-hotlines]")) {
      e.preventDefault();
      openDialog();
    }
  });
  window.addEventListener("kalasag:languagechange", () => {
    inlinePanels.forEach(fill);
    if (dialog?.open) fill(dialog);
  });
}
