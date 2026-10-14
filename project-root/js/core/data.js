/**
 * data.js — loads the JSON content files once per page and shares them.
 *
 * Paths are relative to the site root (every page lives there), so the site
 * also works from a sub-folder such as a GitHub Pages project URL.
 */

/** Shown wherever an image asset hasn't been made yet. */
export const PLACEHOLDER_IMG = "assets/images/Blank.jpg";

const cache = new Map();

export function fetchJSON(path) {
  if (!cache.has(path)) {
    const request = fetch(path).then((res) => {
      if (!res.ok) throw new Error(`${path}: ${res.status}`);
      return res.json();
    });
    // Don't keep a failed request around: a later call can retry.
    request.catch(() => cache.delete(path));
    cache.set(path, request);
  }
  return cache.get(path);
}

let hazardIndex = null;

/** { categories, hazards, byId, categoryById } from hazards.json. */
export function getHazardIndex() {
  if (!hazardIndex) {
    hazardIndex = fetchJSON("js/data/hazards.json").then(({ categories, hazards }) => ({
      categories,
      hazards,
      byId: new Map(hazards.map((h) => [h.id, h])),
      categoryById: new Map(categories.map((c) => [c.id, c])),
    }));
  }
  return hazardIndex;
}

export function sceneUrl(sceneId, { thumb = false } = {}) {
  return sceneId ? `assets/images/scenes/${sceneId}${thumb ? "-thumb" : ""}.webp` : PLACEHOLDER_IMG;
}

export function assetOrPlaceholder(path) {
  return path || PLACEHOLDER_IMG;
}

/** Card/banner image for a hazard: its own banner if it has one, else its category's scene. */
export function hazardBanner(hazard, index) {
  if (hazard.banner) return hazard.banner;
  return sceneUrl(index.categoryById.get(hazard.category)?.scene, { thumb: true });
}

/** Tiny escaping helper for building markup from data. */
export function esc(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
