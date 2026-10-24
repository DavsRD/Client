/**
 * game-host.js — the ONLY bridge between the site (ES modules) and AGILA Safety Games
 * (classic scripts on window.AG in minigames/), KALASAG O5.
 *
 *   attach(slot, hazard)  called by courses.js every time a hazard's lesson renders. The
 *                         first call lazy-loads minigames/css/ag.css and the AG core scripts;
 *                         a game's own scripts load later, when it is played.
 *
 * It owns the hazard page's game routes (O1): '' / #game → the overview in the Mini-game
 * section; #play/<level> and #daily → the game shell takes over <main> (the site
 * header, nav and footer stay). One root element, #ag-app, moves between the two places,
 * so a language switch that re-renders the lesson never interrupts a game.
 *
 * It also carries the site's side across: Sound settings in, game results out (game XP goes
 * into the site XP, the day streak and the "games played" record), offline saving through
 * js/core/offline.js, and ranks computed from the site XP.
 */

import * as state from "../core/state.js";
import * as offline from "../core/offline.js";

const AG_ROOT = "minigames/";
const CORE_SCRIPTS = [
  "js/core/base.js", "js/data/strings.js", "js/data/icons.js", "js/core/store.js", "js/core/assets.js",
  "js/core/sound.js", "js/core/ui.js", "js/core/dnd.js", "js/core/input.js", "js/core/pixelicon.js",
  "js/core/chars.js", "js/core/rig.js", "js/core/canvas.js", "js/core/kit.js", "js/data/dialogue-data.js",
  "js/core/dialogue.js", "js/core/registry.js", "js/core/router.js", "js/core/progress.js", "js/core/app.js",
].map((p) => AG_ROOT + p);
const CORE_CSS = AG_ROOT + "css/ag.css";

/** Precached by the service worker (SHELL_FILES). */
export const CORE_FILES = [CORE_CSS, ...CORE_SCRIPTS];

let corePromise = null;
let root = null;
let slot = null;
let hazardRef = null;
let initPromise = null;
let playing = false;
let lastHash = null;
let lastFocus = null; // the element inside #ag-app that last had focus (see restoreFocus)

const main = () => document.getElementById("main");

function loadCore() {
  if (!corePromise) {
    const css = document.createElement("link");
    css.rel = "stylesheet";
    css.href = CORE_CSS;
    document.head.append(css);
    // async = false keeps the scripts in order while they download in parallel.
    corePromise = Promise.all(
      CORE_SCRIPTS.map(
        (src) =>
          new Promise((resolve, reject) => {
            const s = document.createElement("script");
            s.src = src;
            s.async = false;
            s.onload = resolve;
            s.onerror = () => reject(new Error(`Could not load ${src}`));
            document.head.append(s);
          })
      )
    );
    corePromise.catch(() => (corePromise = null)); // let a later visit retry
  }
  return corePromise;
}

function wireBridge() {
  const AG = window.AG;
  AG.bridge = {
    getXP: () => state.getXP(),
    rank: (xp) => state.rankFor(xp),
    offlineSupported: offline.isSupported(),
    async isSaved(files) {
      const saved = await Promise.all(files.map((f) => offline.isSaved(f)));
      return saved.every(Boolean);
    },
    /** Saves files one by one into the saved-files cache; onProgress(percent). */
    async saveFiles(files, onProgress) {
      let failed = 0;
      for (let i = 0; i < files.length; i++) {
        onProgress?.(Math.floor((i / files.length) * 100));
        if (await offline.isSaved(files[i])) continue;
        try {
          await offline.saveFile(files[i]);
        } catch {
          failed++;
        }
      }
      if (failed) throw new Error(`${failed} files could not be saved`);
    },
  };
  AG.sound.setPrefs(state.getSound());
  window.addEventListener("kalasag:soundchange", (e) => AG.sound.setPrefs(e.detail));
  // Game XP goes into the site's XP (KALASAG O6).
  window.addEventListener("kalasag:gameresult", (e) => {
    const { gameId, xp } = e.detail || {};
    state.addXP(xp || 0);
    state.bumpStreakIfNewDay();
    if (gameId) state.markGamePlayed(gameId);
  });
}

function enterPlay() {
  if (!playing) {
    playing = true;
    main().classList.add("ag-playing");
  }
  if (root.parentElement !== main()) main().prepend(root);
  window.scrollTo(0, 0);
}

/** Re-placing the root (the lesson re-rendered on a language switch) drops keyboard focus to
 *  <body>, and AG only reads keys while its stage has focus: put focus back where it was. */
function restoreFocus() {
  const ae = document.activeElement;
  if (lastFocus && root.contains(lastFocus) && (!ae || ae === document.body)) lastFocus.focus({ preventScroll: true });
}

function exitPlay() {
  if (!playing) return;
  playing = false;
  main().classList.remove("ag-playing");
  if (slot && root.parentElement !== slot) slot.replaceChildren(root);
}

function route() {
  const AG = window.AG;
  const hash = location.hash;
  const r = AG.router.parse(hash);
  if (new URLSearchParams(location.search).get("unlockAll") === "1") r.unlockAll = true;
  const wasPlaying = playing;
  lastHash = hash;

  if (r.view === "play" || r.view === "daily") {
    if (AG.host.show(r) === "fallback") {
      history.replaceState(null, "", "#game");
      return route();
    }
    enterPlay();
    return;
  }

  // Not a game route (e.g. #infographic): make sure no game is running, leave the lesson alone.
  exitPlay();
  if (wasPlaying || r.view === "overview") AG.host.show(r.other ? { view: "overview", unlockAll: r.unlockAll } : r);
  if (r.scroll) document.getElementById("game")?.scrollIntoView({ block: "start" });
  else if (wasPlaying && !r.other) window.scrollTo(0, 0);
}

/** Puts the game root into a hazard page's Mini-game section (and starts AG the first time). */
export async function attach(slotEl, hazard) {
  slot = slotEl;
  hazardRef = hazard;
  if (!root) {
    root = document.createElement("div");
    root.id = "ag-app";
    root.className = "ag";
    root.addEventListener("focusin", (e) => { lastFocus = e.target; });
  }
  if (playing) {
    enterPlay();
    restoreFocus();
  } else slot.replaceChildren(root);

  try {
    await loadCore();
  } catch (err) {
    console.warn(err);
    return;
  }
  if (!initPromise) {
    wireBridge();
    initPromise = window.AG.host.init(root, {
      hazard: { id: hazardRef.id, name: hazardRef.name, category: hazardRef.category },
    });
    window.addEventListener("hashchange", route);
    await initPromise;
    route();
    return;
  }
  await initPromise;
  // A re-render of the lesson (language switch, video watched): only re-place the root.
  if (location.hash !== lastHash) route();
}
