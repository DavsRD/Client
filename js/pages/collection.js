/**
 * collection.js — the Collections page.
 *
 * Games and quizzes aren't built yet, so for now every hazard shows as a
 * grayed, locked silhouette (the "collect them all" preview). Once the quiz
 * engine and games exist, unlocked hazards (state.isUnlocked) become playable here.
 */

import { getHazardIndex, esc } from "../core/data.js";
import { t, pick } from "../core/i18n.js";
import * as state from "../core/state.js";
import * as mascot from "../core/mascot.js";
import { hazardIconImg } from "../ui/hazard-card.js";

let index;

export async function init() {
  index = await getHazardIndex();
  render();
  window.addEventListener("kalasag:languagechange", render);
}

function render() {
  const main = document.getElementById("main");
  const unlocked = index.hazards.filter((h) => state.isUnlocked(h.id)).length;
  document.title = `${t("collection.title")} · Kalasag Kids`;

  main.innerHTML = `
    <div class="page-hero">
      <img class="mascot mascot--3x" data-mascot data-rest="idle" src="${mascot.spriteUrl("pose_run_flap_1_geared")}" alt="" width="120" height="120">
      <div>
        <h1 class="page-hero__title">${esc(t("collection.title"))}</h1>
        <p class="page-hero__sub">${esc(t("collection.subtitle"))} · ${unlocked}/${index.hazards.length}</p>
      </div>
    </div>

    <div class="pending">
      <img class="sprite" src="${mascot.spriteUrl("gear_on_full")}" alt="" width="80" height="80">
      <p>${esc(t("collection.pending"))}</p>
    </div>

    <ul class="collection-grid">
      ${index.hazards
        .map((h) => {
          const open = state.isUnlocked(h.id);
          return `
          <li class="card collection-item${open ? "" : " is-locked"}" data-category="${esc(h.category)}">
            ${hazardIconImg(h, "hazard-icon--lg")}
            <span class="collection-item__name">${esc(pick(h.name))}</span>
            ${open ? "" : `<span class="tag">🔒 ${esc(t("collection.locked"))}</span>`}
          </li>`;
        })
        .join("")}
    </ul>`;

  mascot.init(main);
}
