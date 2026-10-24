/**
 * games.js — what the site's own pages need to know about the mini-games, read from
 * minigames/js/data/registry.json (the same file the games use, so there is one list).
 * Pages that only show game info (Home, Collections, Learn cards) use this and never load
 * the game code itself; js/ui/game-host.js does that on a hazard page.
 */

import { fetchJSON } from "./data.js";

export const REGISTRY_URL = "minigames/js/data/registry.json";
const MANIFEST_URL = "minigames/assets/asset-manifest.json";
const STARS_PER_GAME = 75; // 5 worlds × 5 levels × 3 stars

let registry = null;

/** Loads the registry once. Resolves with it, or null if it can't be read (offline, first visit). */
export async function loadGames() {
  try {
    registry ??= await fetchJSON(REGISTRY_URL);
  } catch {
    return null;
  }
  return registry;
}

export function gameById(gameId) {
  return registry?.games.find((g) => g.id === gameId) || null;
}

/** False until loadGames() has finished, so callers that care should await it first. */
export function isGameBuilt(gameId) {
  return Boolean(gameById(gameId)?.built);
}

export function builtGames() {
  return registry ? registry.games.filter((g) => g.built) : [];
}

export function gameThumb(gameId) {
  return `minigames/assets/shared/thumbs/${gameId}.png`;
}

export { STARS_PER_GAME };

/** Today's Daily Challenge: the same game on every device for the same local date. */
export function dailyToday(date = new Date()) {
  const list = registry?.daily || [];
  if (!list.length) return null;
  const seed = date.getFullYear() * 10000 + (date.getMonth() + 1) * 100 + date.getDate();
  return gameById(list[seed % list.length]);
}

/** Every file one game needs offline: its scripts and JSON, its assets, and the shared files. */
export async function gameFiles(gameId) {
  await loadGames();
  const game = gameById(gameId);
  if (!game) return [];
  let manifest = [];
  try {
    manifest = await fetchJSON(MANIFEST_URL);
  } catch {
    // Without the manifest only the scripts can be listed.
  }
  const shared = ["shared/", "characters/", "agila/", "icons/"].map((p) => `minigames/assets/${p}`);
  const own = `minigames/assets/games/${gameId}/`;
  const files = manifest.map((a) => a.path).filter((p) => p.startsWith(own) || shared.some((s) => p.startsWith(s)));
  files.push(...(registry.engines?.[game.engine] || []), ...(game.scripts || []));
  files.push(...(game.data || []).map((d) => `minigames/js/games/${gameId}/${d}`));
  return [...new Set(files)];
}

/** Files of every built game (Settings → Save everything). */
export async function builtGameFiles() {
  await loadGames();
  const lists = await Promise.all(builtGames().map((g) => gameFiles(g.id)));
  return [...new Set(lists.flat())];
}
