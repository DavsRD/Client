/**
 * welcome.js — the landing page hero slideshow.
 *
 * Cycles through the Philippine scenes in js/data/scenes.json. Only the first
 * image loads with the page; each next image is fetched just before it's shown,
 * so weak school connections aren't hit with 8 images at once.
 * Auto-advance pauses when the tab is hidden, and never starts if the visitor
 * prefers reduced motion (the dots still work).
 */

import { fetchJSON, sceneUrl, esc } from "../core/data.js";
import { pick, t } from "../core/i18n.js";

const INTERVAL_MS = 7000;

export async function init() {
  const hero = document.querySelector(".hero");
  const slidesEl = hero.querySelector("[data-slides]");
  const dotsEl = hero.querySelector("[data-dots]");
  const captionEl = hero.querySelector("[data-caption]");
  const pauseBtn = hero.querySelector("[data-pause]");

  let slides;
  try {
    slides = (await fetchJSON("js/data/scenes.json")).slides;
  } catch {
    return; // The first scene is already in the HTML; the page works without the rest.
  }
  if (!slides.length) return;

  // The first <img> is in the HTML for a fast first paint; create the rest empty.
  const images = slides.map((slide, i) => {
    if (i === 0) return slidesEl.querySelector(".hero__slide");
    const img = document.createElement("img");
    img.className = "hero__slide";
    img.alt = "";
    img.decoding = "async";
    slidesEl.appendChild(img);
    return img;
  });

  dotsEl.innerHTML = slides
    .map((_, i) => `<button type="button" class="hero__dot" data-index="${i}" aria-label="${esc(t("welcome.slide"))} ${i + 1}"></button>`)
    .join("");
  const dots = [...dotsEl.children];

  let current = 0;
  let timer = null;
  const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  let playing = !reduceMotion;

  function load(i) {
    const img = images[i];
    if (img.getAttribute("src")) return Promise.resolve();
    return new Promise((resolve) => {
      img.onload = img.onerror = () => resolve();
      img.src = sceneUrl(slides[i].id);
    });
  }

  function render() {
    images.forEach((img, i) => img.classList.toggle("is-active", i === current));
    dots.forEach((dot, i) => dot.setAttribute("aria-current", String(i === current)));
    captionEl.textContent = "📍 " + pick(slides[current].name);
  }

  async function show(i) {
    const next = (i + slides.length) % slides.length;
    await load(next);
    current = next;
    render();
    load((current + 1) % slides.length); // warm the next one quietly
  }

  function schedule() {
    clearTimeout(timer);
    if (playing && !document.hidden) timer = setTimeout(() => show(current + 1).then(schedule), INTERVAL_MS);
  }

  function setPlaying(next) {
    playing = next;
    pauseBtn.textContent = playing ? "❚❚" : "▶";
    pauseBtn.setAttribute("aria-label", t(playing ? "welcome.pause" : "welcome.play"));
    pauseBtn.dataset.i18nAttr = `aria-label:${playing ? "welcome.pause" : "welcome.play"}`;
    schedule();
  }

  dotsEl.addEventListener("click", (e) => {
    const dot = e.target.closest("[data-index]");
    if (!dot) return;
    show(Number(dot.dataset.index)).then(schedule);
  });
  pauseBtn.addEventListener("click", () => setPlaying(!playing));
  document.addEventListener("visibilitychange", schedule);
  window.addEventListener("kalasag:languagechange", () => {
    render();
    dots.forEach((dot, i) => dot.setAttribute("aria-label", `${t("welcome.slide")} ${i + 1}`));
  });

  render();
  setPlaying(playing);
  load(1);
}
