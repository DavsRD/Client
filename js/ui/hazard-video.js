/**
 * hazard-video.js — plays a hazard's video and counts it, the same way everywhere
 * (the lesson page and Collections): finishing it the first time marks it watched,
 * gives a small XP reward and bumps the day streak.
 */

import { pick } from "../core/i18n.js";
import * as state from "../core/state.js";
import * as videoModal from "./video-modal.js";

const VIDEO_XP = 10; // PROPOSED: small reward for finishing a hazard video the first time

/** Resolves with { completed, firstTime }. */
export async function watchHazardVideo(hazard, { autoplay = true } = {}) {
  const { completed } = await videoModal.open({
    src: hazard.video,
    title: pick(hazard.name),
    captions: hazard.captions,
    autoplay,
  });
  const firstTime = Boolean(completed && state.markVideoWatched(hazard.id));
  if (firstTime) {
    state.addXP(VIDEO_XP);
    state.bumpStreakIfNewDay();
  }
  return { completed, firstTime };
}
