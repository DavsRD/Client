/**
 * offline-ui.js — the two "Save for offline" controls:
 *   - mountSaveButton(): the button beside "Watch video" on a lesson page
 *   - mountSettings():   the "Offline use" group in the Settings menu (save / remove everything)
 * The saving itself is in js/core/offline.js.
 */

import * as offline from "../core/offline.js";
import { t } from "../core/i18n.js";
import { esc } from "../core/data.js";

/** One video's save button. Hidden where saving isn't possible (old browser, or offline and not saved). */
export function mountSaveButton(btn, url) {
  if (!offline.isSupported() || !url) return;
  let failed = false;

  async function render(loaded = 0, total = 0) {
    if (!btn.isConnected) return stop(); // the lesson re-rendered; a new button took over
    const saving = offline.isSaving(url);
    const saved = !saving && (await offline.isSaved(url));
    btn.hidden = !saved && !saving && !navigator.onLine;
    btn.disabled = saved || saving;
    btn.classList.toggle("is-saved", saved);
    if (saving) btn.textContent = t("offline.saving", { pct: total ? Math.floor((loaded / total) * 100) : 0 });
    else if (saved) btn.textContent = `✓ ${t("offline.saved")}`;
    else btn.textContent = failed ? t("offline.failed") : `📥 ${t("offline.save")}`;
  }

  const onProgress = (e) => e.detail.url === url && render(e.detail.loaded, e.detail.total);
  const onChange = () => render();
  function stop() {
    window.removeEventListener("kalasag:offlineprogress", onProgress);
    window.removeEventListener("kalasag:offlinechange", onChange);
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  }
  window.addEventListener("kalasag:offlineprogress", onProgress);
  window.addEventListener("kalasag:offlinechange", onChange);
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);

  btn.addEventListener("click", () => {
    failed = false;
    offline.saveFile(url).catch(() => (failed = true)).finally(render);
    render();
  });
  render();
}

/**
 * The Settings "Offline use" group. refresh() is called each time the menu opens, so the
 * size and saved state are worked out only when someone looks.
 */
export function mountSettings(group) {
  if (!offline.isSupported()) return { refresh() {} };
  group.hidden = false;
  const body = group.querySelector("[data-offline-body]");
  let message = "";
  let confirmTimer = null; // "Remove saved files" needs a second tap within a few seconds

  function progressMarkup({ loaded, total }) {
    const pct = total ? Math.min(100, Math.floor((loaded / total) * 100)) : 0;
    return `
      <div class="progress" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}" aria-label="${esc(t("offline.savingAll"))}">
        <div class="progress__fill" style="--value:${pct}%"></div>
      </div>
      <p class="offline-settings__note">${esc(t("offline.progress", { done: offline.formatSize(loaded), total: offline.formatSize(total) }))}</p>`;
  }

  async function refresh() {
    if (group.closest("[hidden]")) return; // menu closed; it refreshes again when opened
    const progress = offline.saveAllProgress();
    if (progress) {
      body.innerHTML = `
        <p class="offline-settings__hint">${esc(t("offline.savingAll"))}</p>
        <div data-progress>${progressMarkup(progress)}</div>
        <button type="button" class="btn btn--ghost btn--block" data-offline-stop>${esc(t("offline.stop"))}</button>`;
      return;
    }

    const [todo, used] = await Promise.all([offline.plan(), offline.savedBytes()]);
    if (offline.saveAllProgress()) return refresh(); // started while we were checking

    const parts = [];
    if (!todo.files.length) {
      parts.push(`<p class="offline-settings__done">✓ ${esc(t("offline.allSaved"))}</p>`);
    } else {
      parts.push(`<p class="offline-settings__hint">${esc(t("offline.allHint"))}</p>`);
      const size = todo.bytes ? ` (${offline.formatSize(todo.bytes)})` : "";
      parts.push(`
        <button type="button" class="btn btn--secondary btn--block" data-offline-save${navigator.onLine ? "" : " disabled"}>
          📥 ${esc(t("offline.saveAll"))}${size}
        </button>
        <p class="offline-settings__note">${esc(t(navigator.onLine ? "offline.wifiTip" : "offline.needsInternet"))}</p>`);
    }
    if (message) parts.push(`<p class="offline-settings__note offline-settings__note--warn" role="status">${esc(message)}</p>`);
    if (used) {
      parts.push(`
        <p class="offline-settings__note">${esc(t("offline.used", { size: offline.formatSize(used) }))}</p>
        <button type="button" class="btn btn--ghost btn--block${confirmTimer ? " is-confirming" : ""}" data-offline-remove>
          ${esc(t(confirmTimer ? "offline.removeConfirm" : "offline.remove"))}
        </button>`);
    }
    body.innerHTML = parts.join("");
  }

  async function saveEverything() {
    message = "";
    const todo = await offline.plan();
    if (!(await offline.hasRoomFor(todo.bytes))) {
      message = t("offline.noSpace");
      return refresh();
    }
    const job = offline.saveAll(todo);
    refresh();
    try {
      const failed = await job;
      if (failed) message = t("offline.someFailed", { count: failed });
    } catch (err) {
      if (err?.name !== "AbortError") message = t(err?.name === "QuotaExceededError" ? "offline.noSpace" : "offline.failedAll");
    }
    refresh();
  }

  body.addEventListener("click", (e) => {
    if (e.target.closest("[data-offline-save]")) saveEverything();
    if (e.target.closest("[data-offline-stop]")) offline.stopSaveAll();
    if (e.target.closest("[data-offline-remove]")) {
      message = "";
      if (confirmTimer) {
        clearTimeout(confirmTimer);
        confirmTimer = null;
        offline.removeAll().then(refresh);
      } else {
        confirmTimer = setTimeout(() => {
          confirmTimer = null;
          refresh();
        }, 4000);
        refresh().then(() => body.querySelector("[data-offline-remove]")?.focus());
      }
    }
  });

  // Only the bar and numbers update while downloading, so focus stays on the Stop button.
  window.addEventListener("kalasag:offlineprogress", () => {
    const progress = offline.saveAllProgress();
    const slot = body.querySelector("[data-progress]");
    if (progress && slot) slot.innerHTML = progressMarkup(progress);
  });
  window.addEventListener("kalasag:languagechange", refresh);
  window.addEventListener("online", refresh);
  window.addEventListener("offline", refresh);

  return { refresh };
}
