/* Drop! Cover! Hold! (drop-cover-hold): every feel number, and the pure scoring rules (no DOM).
 * AG.dropCoverHold.tuning holds the numbers (phase timings in ms, per level 1–5 where it ramps);
 * .scoring turns finished rounds into points (with the streak multiplier), stars, Calm Badges and badge events.
 * The round flow itself is js/logic/drop-cover-hold/roundMachine.js. Pure, so it also runs in
 * kalasag-dev/minigames/tests/ (drop-cover-hold.test.js). */
(function (root) {
  const AG = root.AG = root.AG || {};
  const DCH = AG.dropCoverHold = AG.dropCoverHold || {};

  const tuning = {
    rigH: 36,                          // body height: every character's duck_cover fits under the desk / table tops
    hitbox: { w: 20, h: 28 },          // falling debris vs the player, the same for all six
    calmMs: 1000,                      // 1 CALM: "Ready…"
    warnMs: { easy: 1000, advanced: 300 },          // 2 WARNING: the rumble before the shaking
    chooseMs: { easy: [3000, 2800, 2600, 2400, 2200], advanced: [2000, 1850, 1700, 1550, 1400] }, // 3 CHOOSE window, L1–L5
    cardMs: 6000,                      // wheelchair round: the instruction card's reaction-bonus window (never a time-out)
    moveMs: 400,                       // 4 MOVE (auto)
    holdMs: [3000, 7000],              // 5 HOLD: the shaking lasts this long after MOVE (seeded, 100 ms steps)
    graceMs: { easy: 1200, advanced: 800 },         // time to put the HOLD input down after MOVE (touch needs a moment)
    rampMs: 500, easeMs: 500,          // the shake ramps in, holds, eases out; it "stops" when the ease ends
    release: { perfect: 500, good: 1000, max: 3000 },  // 6 RELEASE after the stop; still holding at max = late
    settleMs: 300,
    exitMs: 4000,                      // 7 EXIT window
    walkMs: 1000,                      // the rig walks out
    pointMs: 1200,                     // a wrong spot: the role expert points at the right one
    toastMs: 1500,                     // 8 the round toast
    aftershock: { delayMs: [1000, 2000], lengthMs: [1500, 2500], reholdMs: 800, rampMs: 300, easeMs: 300, advancedChance: 0.2 },
    hearts: 3,
    decoys: { easy: [2, 3, 3, 3, 3], advanced: [3, 4, 4, 4, 4] },  // most decoys per round (the doorway myth is extra, Advanced only)
    glowLevels: 2,                     // Easy: safe spots glow in L1–L2
    shakePx: [1, 1, 2, 2, 2],          // whole-pixel shake at full strength, L1–L5
    debris: { perSec: 2.5, max: 14, gravity: 600 },
    points: { spot: 50, react: 100, hold: 100, perfect: 50, good: 20, exit: 50 },
    streak: [1, 1.2, 1.5, 2],          // consecutive perfect rounds: ×1.0, 1.2, 1.5, 2.0 (cap)
    refReactMs: 400,                   // the "max" counts a 0.4 s reaction (a 0 ms one is not humanly possible)
    star2: 0.7, star3: 0.9,
    calmReactMs: 800, calmReleases: 3, // Calm Badges: a reaction < 0.8 s · 3 perfect releases · every exit right first try
    badges: { 'steady-hands': 10, 'myth-buster': 5 }
  };

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const P = tuning.points;

  const scoring = {
    /** round(100 × (1 − chooseTime / window)). */
    reactBonus: (ms, windowMs) => Math.round(P.react * (1 - clamp(ms / windowMs, 0, 1))),
    releasePoints: grade => (grade === 'perfect' ? P.perfect : grade === 'good' ? P.good : 0),
    /** r: a RoundMachine result. Points before the streak multiplier. */
    base(r) {
      return (r.spotOk ? P.spot + scoring.reactBonus(r.chooseMs, r.windowMs) : 0) + (r.fullHold ? P.hold : 0)
        + scoring.releasePoints(r.release) + (r.exitOk ? P.exit : 0);
    },
    /** Right spot, the whole hold, a perfect release, the right exit and no missed aftershock. */
    perfect: r => !!(r.spotOk && r.fullHold && r.release === 'perfect' && r.exitOk && !r.aftershockMiss),
    /** n = consecutive perfect rounds including this one (0 = not perfect). */
    mult: n => (n > 0 ? tuning.streak[Math.min(n, tuning.streak.length) - 1] : 1),
    /** Every round's points with the streak: { total, base, rounds: [{ base, mult, points, streak }] }. */
    run(results) {
      let streak = 0, total = 0, base = 0;
      const rounds = results.map(r => {
        streak = scoring.perfect(r) ? streak + 1 : 0;
        const b = scoring.base(r), mult = scoring.mult(streak), points = Math.round(b * mult);
        total += points; base += b;
        return { base: b, mult, points, streak };
      });
      return { total, base, rounds };
    },
    /** The best a round can give (before the streak), with the reference reaction. */
    roundMax: windowMs => P.spot + scoring.reactBonus(tuning.refReactMs, windowMs) + P.hold + P.perfect + P.exit,
    /** windows: each round's CHOOSE (or card) window. { base, total } of a flawless run. */
    max(windows) {
      let base = 0, total = 0;
      windows.forEach((w, i) => { const m = scoring.roundMax(w); base += m; total += Math.round(m * scoring.mult(i + 1)); });
      return { base, total };
    },
    /** 0 = not completed; 1 = completed; 2 = ≥ 70 % of max; 3 = ≥ 90 % AND no heart lost.
     *  The share uses points before the streak bonus, so one imperfect round never costs two stars. */
    stars(o) {
      if (!o.completed) return 0;
      const share = o.base / Math.max(1, o.maxBase);
      if (share >= tuning.star3 && o.heartsLost === 0) return 3;
      return share >= tuning.star2 ? 2 : 1;
    },
    /** The 3 Calm Badges of a level. */
    collectibles(results, completed) {
      const exits = results.filter(r => r.exitTried);
      return [
        results.some(r => r.spotOk && r.chooseMs < tuning.calmReactMs),
        results.filter(r => r.release === 'perfect').length >= tuning.calmReleases,
        !!completed && exits.length > 0 && exits.every(r => r.exitOk)
      ];
    },
    /** Adds a finished level to the stats record q ({ perfectReleases, mythAvoided }); returns the badge events. */
    badges(q, o) {
      q.perfectReleases = (q.perfectReleases || 0) + o.results.filter(r => r.release === 'perfect').length;
      q.mythAvoided = (q.mythAvoided || 0) + o.results.filter(r => r.mythAvoided).length;
      const B = tuning.badges, ev = [];
      if (q.perfectReleases >= B['steady-hands']) ev.push('steady-hands');
      if (q.mythAvoided >= B['myth-buster']) ev.push('myth-buster');
      if (o.level === 4 && o.completed && o.heartsLost === 0) ev.push('aftershock-ready');
      return ev;
    }
  };

  Object.assign(DCH, { tuning, scoring });
  if (typeof module !== 'undefined') module.exports = DCH;
})(typeof window !== 'undefined' ? window : globalThis);
