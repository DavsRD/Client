/**
 * subject-connect.js — browse hazards by school subject.
 * subject-connect.html?subject=<id> opens on that subject (linked from each
 * hazard's subject strip on the Learn page).
 */

import { getHazardIndex, fetchJSON, esc } from "../core/data.js";
import { t, pick } from "../core/i18n.js";
import * as mascot from "../core/mascot.js";
import { hazardCard } from "../ui/hazard-card.js";
import { loadGames } from "../core/games.js";

let index;
let subjects;
let current;

export async function init() {
  [index, { subjects }] = await Promise.all([getHazardIndex(), fetchJSON("js/data/subjects.json"), loadGames()]);
  const requested = new URLSearchParams(location.search).get("subject");
  current = subjects.some((s) => s.id === requested) ? requested : subjects[0].id;

  render();
  window.addEventListener("kalasag:languagechange", render);
}

function render() {
  const main = document.getElementById("main");
  const subject = subjects.find((s) => s.id === current);
  const hazards = index.hazards.filter((h) => h.subjects?.includes(subject.id));
  document.title = `${t("subject.title")} · Kalasag Kids`;

  main.innerHTML = `
    <div class="page-hero">
      <img class="mascot mascot--3x" data-mascot data-rest="idle" src="${mascot.spriteUrl("prop_on_sign_geared")}" alt="" width="120" height="120">
      <div>
        <h1 class="page-hero__title">${esc(t("subject.title"))}</h1>
        <p class="page-hero__sub">${esc(t("subject.subtitle"))}</p>
      </div>
    </div>

    <div class="chip-row subject-tabs" role="tablist">
      ${subjects
        .map(
          (s) =>
            `<button type="button" class="chip" role="tab" data-subject="${esc(s.id)}" aria-selected="${s.id === current}" aria-pressed="${s.id === current}">${esc(pick(s.name))}</button>`
        )
        .join("")}
    </div>

    <section class="section subject-panel" role="tabpanel">
      <div class="card card--pad subject-intro">
        <h2 class="section-title">${esc(pick(subject.name))}</h2>
        <p>${esc(pick(subject.blurb))}</p>
      </div>
      <h3 class="subject-count">${esc(t("subject.hazardsIn"))} ${esc(pick(subject.name))} · ${hazards.length}</h3>
      ${
        hazards.length
          ? `<div class="card-grid">${hazards.map((h) => hazardCard(h, index)).join("")}</div>`
          : `<div class="pending">
               <img class="sprite" src="${mascot.spriteUrl("prop_on_magnifier_geared")}" alt="" width="80" height="80">
               <p>${esc(t("learn.subjectsPending"))}</p>
             </div>`
      }
    </section>`;

  mascot.init(main);
  main.querySelector(".subject-tabs").addEventListener("click", (e) => {
    const tab = e.target.closest("[data-subject]");
    if (!tab || tab.dataset.subject === current) return;
    current = tab.dataset.subject;
    history.replaceState(null, "", `?subject=${encodeURIComponent(current)}`);
    render();
  });
}
