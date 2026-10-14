/**
 * state.js — the only module that touches localStorage / sessionStorage.
 *
 * Every key is prefixed "kalasag:". Every read and write is wrapped in
 * try/catch and falls back to an in-memory copy, so the site still works on
 * locked-down school browsers and in private windows (progress just won't
 * survive a reload there). Nothing that identifies a person is ever stored.
 *
 * Any change fires a "kalasag:statechange" event on window so open UI
 * (stats card, header) can refresh itself.
 */

const PREFIX = "kalasag:";
const HEARTS_PER_ROUND = 3;
const HURDLE_ORDER = ["locked", "encountered", "cleared"];
const SETTINGS_KEYS = ["lang", "theme"]; // survive "Reset my progress"

const memory = { local: new Map(), session: new Map() };

function probe(kind) {
  try {
    const store = window[kind];
    const key = PREFIX + "__probe";
    store.setItem(key, "1");
    store.removeItem(key);
    return store;
  } catch {
    return null;
  }
}

const stores = { local: probe("localStorage"), session: probe("sessionStorage") };

function read(where, key, fallback) {
  try {
    const store = stores[where];
    const raw = store ? store.getItem(PREFIX + key) : memory[where].get(key);
    return raw == null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function write(where, key, value) {
  const raw = JSON.stringify(value);
  try {
    const store = stores[where];
    if (store) store.setItem(PREFIX + key, raw);
    else memory[where].set(key, raw);
  } catch {
    // Quota full or storage revoked mid-session: keep going in memory.
    memory[where].set(key, raw);
  }
  window.dispatchEvent(new CustomEvent("kalasag:statechange", { detail: { key } }));
}

function todayStamp(date = new Date()) {
  // Local calendar date, not UTC, so a streak follows the pupil's own day.
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function countTrue(map) {
  return Object.values(map).filter(Boolean).length;
}

// ---------- XP ----------
export function getXP() {
  return read("local", "xp", 0);
}

export function addXP(amount) {
  const total = getXP() + Math.max(0, Math.round(amount));
  write("local", "xp", total);
  return total;
}

// ---------- Streak ----------
export function getStreak() {
  const streak = read("local", "streak", { count: 0, lastVisitDate: null });
  // A streak is broken if the last engagement was before yesterday.
  if (streak.lastVisitDate) {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const alive = streak.lastVisitDate === todayStamp() || streak.lastVisitDate === todayStamp(yesterday);
    if (!alive) return { count: 0, lastVisitDate: streak.lastVisitDate };
  }
  return streak;
}

/** Call on real engagement (finishing a video, lesson, or game round). */
export function bumpStreakIfNewDay() {
  const today = todayStamp();
  const current = getStreak();
  if (current.lastVisitDate === today) return current;
  const next = { count: current.count + 1, lastVisitDate: today };
  write("local", "streak", next);
  return next;
}

// ---------- Hearts (in memory only: reset every lesson/round) ----------
let hearts = HEARTS_PER_ROUND;

export function getHearts() {
  return hearts;
}

export function loseHeart() {
  hearts = Math.max(0, hearts - 1);
  return hearts;
}

export function resetHearts(count = HEARTS_PER_ROUND) {
  hearts = count;
  return hearts;
}

// ---------- Hazards explored (this session) ----------
export function markHazardExplored(hazardId) {
  const explored = read("session", "explored", {});
  if (explored[hazardId]) return;
  explored[hazardId] = true;
  write("session", "explored", explored);
}

export function getExploredCount() {
  return countTrue(read("session", "explored", {}));
}

// ---------- Last hazard opened (drives "Jump back in") ----------
export function setLastHazard(hazardId) {
  write("local", "lastHazard", hazardId);
}

export function getLastHazard() {
  return read("local", "lastHazard", null);
}

// ---------- Badges ----------
export function getBadge(hazardId) {
  return Boolean(read("local", "badges", {})[hazardId]);
}

export function setBadge(hazardId) {
  const badges = read("local", "badges", {});
  if (badges[hazardId]) return;
  badges[hazardId] = true;
  write("local", "badges", badges);
}

export function getBadgeCount() {
  return countTrue(read("local", "badges", {}));
}

// ---------- Videos ----------
// "Gate seen" means the first-visit modal already opened once (watched or skipped),
// so it never forces itself again. "Watched" means the video actually played to the end.
export function hasSeenVideoGate(hazardId) {
  return Boolean(read("local", "videoGate", {})[hazardId]);
}

export function markVideoGateSeen(hazardId) {
  const seen = read("local", "videoGate", {});
  if (seen[hazardId]) return;
  seen[hazardId] = true;
  write("local", "videoGate", seen);
}

export function hasWatchedVideo(hazardId) {
  return Boolean(read("local", "videosWatched", {})[hazardId]);
}

/** Returns true the first time a hazard's video is finished. */
export function markVideoWatched(hazardId) {
  const watched = read("local", "videosWatched", {});
  if (watched[hazardId]) return false;
  watched[hazardId] = true;
  write("local", "videosWatched", watched);
  return true;
}

export function getWatchedCount() {
  return countTrue(read("local", "videosWatched", {}));
}

// ---------- Story Mode hurdles (Story Mode itself is built last) ----------
export function getHurdleStatus(hazardId) {
  return read("local", "hurdles", {})[hazardId] || "locked";
}

/** Status only ever moves forward: locked → encountered → cleared. */
export function setHurdleStatus(hazardId, status) {
  if (!HURDLE_ORDER.includes(status)) return;
  const hurdles = read("local", "hurdles", {});
  const current = hurdles[hazardId] || "locked";
  if (HURDLE_ORDER.indexOf(status) <= HURDLE_ORDER.indexOf(current)) return;
  hurdles[hazardId] = status;
  write("local", "hurdles", hurdles);
}

export function getShieldPieces() {
  return Object.values(read("local", "hurdles", {})).filter((s) => s === "cleared").length;
}

export function getCurrentStage() {
  return read("local", "storyStage", 1);
}

export function isUnlocked(hazardId) {
  return getHurdleStatus(hazardId) !== "locked";
}

// ---------- Language ----------
export function getLanguage() {
  return read("local", "lang", "en") === "fil" ? "fil" : "en";
}

export function setLanguage(lang) {
  write("local", "lang", lang === "fil" ? "fil" : "en");
}

// ---------- Theme ----------
export function getTheme(fallback) {
  return read("local", "theme", fallback);
}

export function setTheme(themeId) {
  write("local", "theme", themeId);
}

// ---------- Reset (shared school devices) ----------
/** Clears all progress on this device. Settings (language, theme) are kept. */
export function resetAllProgress() {
  for (const where of ["local", "session"]) {
    const store = stores[where];
    if (store) {
      try {
        const keys = [];
        for (let i = 0; i < store.length; i++) {
          const key = store.key(i);
          if (key && key.startsWith(PREFIX) && !SETTINGS_KEYS.includes(key.slice(PREFIX.length))) keys.push(key);
        }
        keys.forEach((key) => store.removeItem(key));
      } catch {
        // Fall through to clearing the in-memory copy.
      }
    }
    for (const key of [...memory[where].keys()]) {
      if (!SETTINGS_KEYS.includes(key)) memory[where].delete(key);
    }
  }
  resetHearts();
  window.dispatchEvent(new CustomEvent("kalasag:statechange", { detail: { key: "*" } }));
}
