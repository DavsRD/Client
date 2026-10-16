/**
 * theme.js — the color themes chosen in Settings.
 *
 * The palettes themselves live in css/variables.css as :root[data-theme="..."]
 * blocks; this module only sets the attribute, remembers the choice, and keeps
 * the browser's theme-color in sync. An inline script in each page's <head>
 * applies the saved theme before first paint so there's no flash.
 */

import * as state from "./state.js";

export const THEMES = [
  { id: "night", mode: "dark", swatch: ["#0a0b1f", "#1a1d3d", "#ffd23f"] },
  { id: "indigo", mode: "dark", swatch: ["#120d2b", "#281f5c", "#4cc8ff"] },
  { id: "daylight", mode: "light", swatch: ["#f3f5fb", "#ffffff", "#3b8eea"] },
  { id: "sunny", mode: "light", swatch: ["#fff7e3", "#fff0c7", "#f0613a"] },
  { id: "auto", mode: "auto", swatch: ["#0a0b1f", "#f3f5fb", "#ffd23f"] },
];

export const DEFAULT_THEME = "night";
const ids = new Set(THEMES.map((t) => t.id));
const systemLight = window.matchMedia?.("(prefers-color-scheme: light)");

export function getTheme() {
  const saved = state.getTheme(DEFAULT_THEME);
  return ids.has(saved) ? saved : DEFAULT_THEME;
}

function syncThemeColor() {
  // Let the new tokens apply, then hand the page background to the browser UI.
  const bg = getComputedStyle(document.documentElement).getPropertyValue("--bg").trim();
  document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.setAttribute("content", bg));
}

export function apply(themeId = getTheme()) {
  document.documentElement.dataset.theme = themeId;
  syncThemeColor();
}

export function setTheme(themeId) {
  if (!ids.has(themeId)) return;
  state.setTheme(themeId);
  apply(themeId);
  window.dispatchEvent(new CustomEvent("kalasag:themechange", { detail: { theme: themeId } }));
}

export function init() {
  apply();
  // "Match my device" follows the system setting live.
  systemLight?.addEventListener?.("change", () => getTheme() === "auto" && syncThemeColor());
}
