/* Go Bag Tetris (go-bag-tetris): every feel number, and the pure scoring rules.
 * AG.goBag.tuning holds the numbers; AG.goBag.scoring turns a packed bag into points, stars, Pro Packer
 * collectibles and badge events, and runs the Conveyor Rush clock (signal steps, place time). Pure (no DOM),
 * so it also runs in kalasag-dev/minigames/tests/ (go-bag-tetris.test.js). Weights are counted in tenths of a
 * kilo so 0.2 + 0.3 never drifts. */
(function (root) {
  const AG = root.AG = root.AG || {};
  const GB = AG.goBag = AG.goBag || {};

  const tuning = {
    cell: 28,                                   // art px per bag cell
    points: { essential: 100, scenario: 150, nice: 50, decoy: -50, missed: -100 },
    proEff: 0.9,                                // Pro Packer: the bag at least this full (or the fullest the level allows)
    rush: {
      stepFactor: 0.9,                          // place time −10 % per signal step
      gapMs: 380,                               // between one item leaving the belt and the next arriving
      avgLeftMs: 1000,                          // ⭐⭐⭐ in Rush: on average ≥ 1 s left on the item timer
      warnMs: 2000,                             // the ring's last stretch: a tick each second
      wind: [0.15, 0.25, 0.4, 0.6, 0.85]        // wind loop volume at signal 1..5
    },
    reactMs: 1200,                              // happy / worried pose after a placement
    holdBagMs: 1300,                            // hold:go_bag, then cheer, when the bag is packed
    confirmMs: 4000,                            // "Pack it anyway?" stays armed this long
    hintMs: 5000,
    maxScale: 3,
    reservedH: { pack: 330, rush: 500 }         // CSS px kept for the HUD, the shelf / belt and the buttons when sizing the bag
  };

  const tenths = kg => Math.round((kg || 0) * 10);

  const scoring = {
    tenths,
    /** +100 essential · +150 scenario · +50 nice-to-have · −50 decoy · −100 per essential missed in Rush. Never below 0. */
    points(o) {
      const P = tuning.points, c = o.counts || {};
      const s = P.essential * (c.essential || 0) + P.scenario * (c.scenario || 0) + P.nice * (c.nice || 0) + P.decoy * (c.decoy || 0) + P.missed * (o.missed || 0);
      return Math.max(0, s);
    },
    /** ⭐ every essential · ⭐⭐ + every scenario item · ⭐⭐⭐ + no decoys and (Pack Puzzle: efficiency ≥ effTarget;
     *  Rush: on average ≥ 1 s left on the item timer). */
    stars(o) {
      if (!o.allEssentials) return 0;
      if (!o.allScenario) return 1;
      const third = o.mode === 'rush' ? (o.avgLeftMs || 0) >= tuning.rush.avgLeftMs : (o.efficiency || 0) + 1e-9 >= (o.effTarget || 0);
      return !o.decoys && third ? 3 : 2;
    },
    /** The level's Pro Packer bar: 90 %, or the fullest bag the level allows without decoys if that is less. */
    proEff: spec => Math.min(tuning.proEff, spec.effTarget || tuning.proEff),
    /** Pro Packer: efficiency ≥ the bar · time ≤ par · no undo. */
    collectibles: o => [(o.efficiency || 0) + 1e-9 >= o.proEff, o.timeMs <= o.parSec * 1000, !o.undos],

    /* ---------- Conveyor Rush clock ---------- */
    /** Wind Signal 1..5: the clock's step, or the belt's progress, whichever is further (the last fifth of the
     *  belt is always Signal 5, so a finished Rush always reaches it). */
    signal(elapsedMs, clockMs, done, total) {
      const byClock = Math.floor(5 * Math.max(0, elapsedMs) / Math.max(1, clockMs));
      const byBelt = total ? Math.floor(5 * done / total) : 0;
      return Math.max(1, Math.min(5, 1 + Math.max(byClock, byBelt)));
    },
    /** Time to place the front item: placeSec at Signal 1, 10 % less per step. */
    placeMs: (placeSec, signal) => Math.round(placeSec * 1000 * Math.pow(tuning.rush.stepFactor, Math.max(0, signal - 1))),
    avgLeft: list => (list.length ? Math.round(list.reduce((a, b) => a + b, 0) / list.length) : 0),

    /* ---------- weight ---------- */
    weight: items => items.reduce((n, it) => n + tenths(it.weight), 0),
    overWeight: (w, maxKg) => maxKg != null && w > tenths(maxKg),

    /** perfect-bag (3 stars on all 5 levels) · family-planner (all four scenarios packed, ever) ·
     *  signal-five (a Rush finished at Signal 5 with every essential). best: level → best stars so far. */
    badges(o) {
      const ev = [];
      const best = Object.assign({}, o.best || {}); best[o.level] = Math.max(best[o.level] || 0, o.stars);
      if ([1, 2, 3, 4, 5].every(l => best[l] === 3)) ev.push('perfect-bag');
      if (['lola', 'baby', 'dog', 'tito'].every(s => (o.scenariosDone || []).includes(s))) ev.push('family-planner');
      if (o.mode === 'rush' && o.allEssentials && o.signal >= 5) ev.push('signal-five');
      return ev;
    }
  };

  GB.tuning = tuning;
  GB.scoring = scoring;
  if (typeof module !== 'undefined') module.exports = { tuning, scoring };
})(typeof window !== 'undefined' ? window : globalThis);
