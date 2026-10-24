/**
 * hazard-card.js — the one hazard card markup used on Learn, Home, and Subject pages,
 * so a hazard always looks the same (same icon, same category color) everywhere.
 */

import { esc, hazardBanner, assetOrPlaceholder } from "../core/data.js";
import { pick, t } from "../core/i18n.js";
import * as state from "../core/state.js";
import { isGameBuilt } from "../core/games.js";

export function hazardUrl(hazardId) {
  return `courses.html?hazard=${encodeURIComponent(hazardId)}`;
}

export function hazardIconImg(hazard, extraClass = "") {
  return `<img class="hazard-icon ${extraClass}" src="${esc(assetOrPlaceholder(hazard.icon))}" alt="" loading="lazy" width="48" height="48">`;
}

export function hazardCard(hazard, index) {
  const category = index.categoryById.get(hazard.category);
  const watched = state.hasWatchedVideo(hazard.id);
  const tags = [
    `<span class="tag tag--cat">${esc(pick(category?.name))}</span>`,
    hazard.video ? `<span class="tag">▶ ${esc(t("learn.videoTag"))}</span>` : "",
    watched ? `<span class="tag tag--done">✓ ${esc(t("learn.watched"))}</span>` : "",
    // Shown once the hazard's game is built (pages await loadGames() before rendering cards).
    isGameBuilt(hazard.game) ? `<span class="tag tag--game">🎮 ${esc(t("learn.gameTag"))}</span>` : "",
  ].join("");

  return `
    <a class="card hazard-card" href="${hazardUrl(hazard.id)}" data-category="${esc(hazard.category)}" data-hazard-id="${esc(hazard.id)}">
      <div class="hazard-card__banner">
        <img class="hazard-card__banner-img" src="${esc(hazardBanner(hazard))}" alt="" loading="lazy">
      </div>
      <div class="hazard-card__body">
        <span class="label-kicker">${esc(t("learn.cardLabel"))}</span>
        <h3 class="hazard-card__title">${esc(pick(hazard.name))}</h3>
        <p class="hazard-card__desc">${esc(pick(hazard.blurb))}</p>
        <div class="hazard-card__tags">${tags}</div>
      </div>
    </a>`;
}
