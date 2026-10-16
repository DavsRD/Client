/**
 * mascot.js — Agila the eagle, everywhere on the site.
 *
 * Reaction-only: callers decide *when* Agila reacts; this module decides *how*.
 * Any <img data-mascot> on the page is a mascot. A mascot reacts to hover/tap
 * by itself; everything else goes through setExpression() / the helpers below.
 */

import { fetchJSON } from "./data.js";
import { pick, t } from "./i18n.js";

const SPRITE_DIR = "assets/pixel-eagle-sprites/png/1x/";

// Each expression: sprite frames (looped if more than one) + a CSS motion class.
const EXPRESSIONS = {
  idle: { frames: ["pose_idle_geared"], motion: "is-idle" },
  greet: { frames: ["pose_head_flip_1_geared", "pose_head_flip_2_geared"], motion: "is-greet", ms: 260, settle: 1600 },
  point: { frames: ["pose_point_geared"], motion: "is-idle" },
  happy: { frames: ["pose_run_flap_2_geared"], motion: "is-happy", settle: 900 },
  tryAgain: { frames: ["prop_on_sweat_drop_geared"], motion: "is-shake", settle: 900 },
  cheer: { frames: ["pose_run_flap_1_geared", "pose_run_flap_2_geared"], motion: "is-happy", ms: 180, settle: 1800 },
  alert: { frames: ["pose_alert_geared"], motion: "is-idle" },
  thinking: { frames: ["prop_on_magnifier_geared"], motion: "is-idle" },
};

const MOTION_CLASSES = ["is-idle", "is-greet", "is-happy", "is-shake"];
const timers = new WeakMap();
const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)");

export function spriteUrl(name) {
  return `${SPRITE_DIR}${name}.png`;
}

function primaryMascot() {
  return document.querySelector("[data-mascot]");
}

/** Switches a mascot to an expression. Temporary ones settle back to its resting pose. */
export function setExpression(name, el = primaryMascot()) {
  const expr = EXPRESSIONS[name];
  if (!el || !expr) return;

  const prev = timers.get(el);
  if (prev) {
    clearInterval(prev.loop);
    clearTimeout(prev.settle);
  }

  el.classList.remove(...MOTION_CLASSES);
  // Force a reflow so the same motion can replay back to back.
  void el.offsetWidth;
  el.classList.add(expr.motion);

  let frame = 0;
  el.src = spriteUrl(expr.frames[0]);
  const handles = {};
  if (expr.frames.length > 1 && !reduceMotion?.matches) {
    handles.loop = setInterval(() => {
      frame = (frame + 1) % expr.frames.length;
      el.src = spriteUrl(expr.frames[frame]);
    }, expr.ms || 250);
  }
  if (expr.settle) {
    handles.settle = setTimeout(() => setExpression(el.dataset.rest || "idle", el), expr.settle);
  }
  timers.set(el, handles);
}

export function greet(el) {
  setExpression("greet", el);
}

export function reactToAnswer(isCorrect, el) {
  setExpression(isCorrect ? "happy" : "tryAgain", el);
}

export function reactToGameEnd(outcome, el) {
  setExpression(outcome === "win" ? "cheer" : "happy", el);
}

let tipsPromise = null;
export async function getRandomTip(exclude) {
  tipsPromise ??= fetchJSON("js/data/tips.json").then((d) => d.tips);
  const tips = await tipsPromise;
  let tip;
  do {
    tip = pick(tips[Math.floor(Math.random() * tips.length)]);
  } while (tips.length > 1 && tip === exclude);
  return tip;
}

window.addEventListener("kalasag:languagechange", () => {
  document.querySelectorAll("img[data-mascot]").forEach((el) => (el.alt = t("mascot.alt")));
});

/** Wires every <img data-mascot> on the page: resting pose, alt text, hover/tap reactions. */
export function init(root = document) {
  root.querySelectorAll("img[data-mascot]:not([data-mascot-ready])").forEach((el) => {
    el.dataset.mascotReady = "";
    el.alt = t("mascot.alt");
    el.draggable = false;
    setExpression(el.dataset.rest || "idle", el);
    el.addEventListener("pointerenter", () => setExpression("greet", el));
    el.addEventListener("click", () => setExpression("happy", el));
  });
}
