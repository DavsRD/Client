/**
 * video-modal.js — the one video player modal, reused for:
 *   - the first-visit autoplay gate on a hazard (Skip always visible)
 *   - the deliberate "▶ Watch video" replay
 *   - (later) the Story Mode encounter cutscene
 *
 * open() resolves when the modal closes with { completed } — true only if the
 * video actually played to the end.
 */

import { esc, PLACEHOLDER_IMG } from "../core/data.js";
import { t, getLanguage } from "../core/i18n.js";

let dialog = null;

function build() {
  dialog = document.createElement("dialog");
  dialog.className = "modal video-modal";
  dialog.setAttribute("aria-labelledby", "video-modal-title");
  dialog.innerHTML = `
    <div class="video-modal__box">
      <div class="video-modal__bar">
        <h2 class="video-modal__title" id="video-modal-title"></h2>
        <button type="button" class="btn btn--primary video-modal__skip" data-skip></button>
      </div>
      <div class="video-modal__frame">
        <video class="video-modal__video" controls playsinline preload="metadata"></video>
        <button type="button" class="btn btn--secondary video-modal__unmute" data-unmute hidden></button>
        <div class="video-modal__missing" data-missing hidden>
          <img src="${PLACEHOLDER_IMG}" alt="">
          <p></p>
        </div>
      </div>
    </div>`;
  document.body.appendChild(dialog);
  return dialog;
}

/**
 * @param {object} opts
 * @param {string} opts.src       video file
 * @param {string} opts.title     heading shown above the player
 * @param {object} [opts.captions] { en: "x.vtt", fil: "y.vtt" } — optional bilingual captions
 * @param {boolean} [opts.autoplay]
 */
export function open({ src, title, captions, autoplay = true }) {
  const d = dialog || build();
  const video = d.querySelector("video");
  const skipBtn = d.querySelector("[data-skip]");
  const unmuteBtn = d.querySelector("[data-unmute]");
  const missing = d.querySelector("[data-missing]");

  d.querySelector(".video-modal__title").textContent = title;
  skipBtn.textContent = `${t("video.skip")} ⏭`;
  unmuteBtn.textContent = `🔊 ${t("video.sound")}`;
  missing.querySelector("p").textContent = t("learn.noVideo");
  missing.hidden = true;
  unmuteBtn.hidden = true;
  video.hidden = false;

  // Captions follow the site language; the other language stays selectable.
  video.querySelectorAll("track").forEach((tr) => tr.remove());
  if (captions) {
    for (const lang of ["en", "fil"]) {
      if (!captions[lang]) continue;
      video.insertAdjacentHTML(
        "beforeend",
        `<track kind="captions" srclang="${lang === "fil" ? "fil" : "en"}" label="${lang === "fil" ? "Filipino" : "English"}" src="${esc(captions[lang])}"${lang === getLanguage() ? " default" : ""}>`
      );
    }
  }

  video.muted = false;
  video.src = src;

  return new Promise((resolve) => {
    let completed = false;

    const onEnded = () => {
      completed = true;
      d.close();
    };
    const onError = () => {
      video.hidden = true;
      missing.hidden = false;
      missing.querySelector("p").textContent = t(navigator.onLine ? "learn.noVideo" : "video.offline");
    };
    const onSkip = () => d.close();
    const onUnmute = () => {
      video.muted = false;
      unmuteBtn.hidden = true;
      video.play().catch(() => {});
    };
    const onBackdrop = (e) => {
      if (e.target === d) d.close();
    };
    const onClose = () => {
      video.pause();
      video.removeAttribute("src"); // stop downloading the rest of the file
      video.load();
      video.removeEventListener("ended", onEnded);
      video.removeEventListener("error", onError);
      skipBtn.removeEventListener("click", onSkip);
      unmuteBtn.removeEventListener("click", onUnmute);
      d.removeEventListener("click", onBackdrop);
      resolve({ completed });
    };

    video.addEventListener("ended", onEnded);
    video.addEventListener("error", onError);
    skipBtn.addEventListener("click", onSkip);
    unmuteBtn.addEventListener("click", onUnmute);
    d.addEventListener("click", onBackdrop);
    d.addEventListener("close", onClose, { once: true });

    d.showModal();
    skipBtn.focus();

    if (autoplay) {
      // Browsers may block autoplay with sound; fall back to muted + a big "tap for sound" button.
      video.play().catch(() => {
        video.muted = true;
        video
          .play()
          .then(() => (unmuteBtn.hidden = false))
          .catch(() => {});
      });
    }
  });
}
