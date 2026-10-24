/* Rubble Rescue (rubble-rescue): every feel number, and the pure rules.
 * AG.rubbleRescue.tuning holds the numbers; AG.rubbleRescue.rules turns a level entry into
 * the puzzle and its hazards, and a finished run into points, stars and badge counts. Pure
 * (no DOM), so it also runs in kalasag-dev/minigames/tests/ (rubble-rescue.test.js). */
(function (root) {
  const AG = root.AG = root.AG || {};
  const RR = AG.rubbleRescue = AG.rubbleRescue || {};

  const tuning = {
    cell: 32,
    bust: 48,                                 // the player's bust frame in the pocket
    warnMs: 10000,                            // the "Spot the warning" question
    slack: { easy: 10, advanced: 3 },         // energy = par + slack
    knock: {
      every: 6,                               // moves between knock rounds
      count: { easy: [3, 4], advanced: [4, 5] },
      gaps: [350, 700],                       // ms between knocks: short and long beats
      tolerance: { easy: 250, advanced: 150 },
      leadMs: 900,                            // the radio call before the first knock
      firstTapMs: 8000,                       // waiting for the player's first knock
      afterMs: 1200,                          // after the last expected knock
      energy: 3, restEnergy: 5
    },
    dustEnergy: 2, matchEnergy: 3,
    aftershockEvery: { easy: 6, advanced: 4 },
    hints: { easy: Infinity, advanced: 2 },
    slideMs: 90,                              // a block glides 90 ms per cell (drawing only)
    walkMs: 1100,                             // the walk-out to the exit gap
    shakeMs: 320, dustFrames: 4, dustFps: 10,
    /** The hazards each level adds, when levels.json has no "features". */
    levels: {
      1: [],
      2: ['loadBearing'],
      3: ['loadBearing', 'energy', 'knocks', 'match'],
      4: ['loadBearing', 'energy', 'knocks', 'match', 'dust'],
      5: ['loadBearing', 'energy', 'knocks', 'match', 'aftershocks']
    },
    points: { base: 1000, overPar: 30, energy: 10, knock: 50, warning: 100, hint: 50 },
    stars: { twoOverPar: 3 },
    badges: { knocks: 30 }
  };

  const lvl = n => Math.min(5, Math.max(1, n || 1));
  const diffOf = d => (d === 'advanced' ? 'advanced' : 'easy');

  const rules = {
    features(entry, level) {
      const list = (entry && entry.features) || tuning.levels[lvl(level)];
      const f = {};
      list.forEach(k => { f[k] = true; });
      return f;
    },
    /** The puzzle for a difficulty: levels.json keeps one per difficulty. */
    puzzle(entry, difficulty) { return entry && (entry[diffOf(difficulty)] || entry.easy) || null; },
    energy(par, difficulty) { return par + tuning.slack[diffOf(difficulty)]; },
    hints(difficulty) { return tuning.hints[diffOf(difficulty)]; },
    /** Is this move count a knock round (every 6 moves) or an aftershock (every K)? */
    knockDue: (moves, f) => !!f.knocks && moves > 0 && moves % tuning.knock.every === 0,
    aftershockDue: (moves, f, difficulty) => !!f.aftershocks && moves > 0 && moves % tuning.aftershockEvery[diffOf(difficulty)] === 0,
    /** 1000 − 30 × (moves − par) + energy left × 10 + knocks × 50 + pre-level 100 − hints × 50. */
    points(o) {
      const P = tuning.points;
      const over = Math.max(0, (o.moves || 0) - (o.par || 0));
      const s = P.base - P.overPar * over + (o.energy || 0) * P.energy + (o.knocks || 0) * P.knock + (o.warning ? P.warning : 0) - (o.hints || 0) * P.hint;
      return Math.max(0, Math.round(s));
    },
    /** 1 = escaped; 2 = moves ≤ par + 3; 3 = moves ≤ par, every knock answered and no match
     *  or load-bearing mistake. */
    stars(o) {
      if (!o.escaped) return 0;
      const three = o.moves <= o.par && o.knocksMissed === 0 && !o.matchUsed && !o.loadBearing;
      if (three) return 3;
      return o.moves <= o.par + tuning.stars.twoOverPar ? 2 : 1;
    },
    /** Running counts → which badges are earned now. */
    badges(stats, run) {
      const ev = [];
      if ((stats.knocksOk || 0) >= tuning.badges.knocks) ev.push('light-tapper');
      if (run && run.escaped && run.level === 2 && run.mode === 'stage' && !run.loadBearing) ev.push('structural-sense');
      if (run && run.escaped && run.hasMatch && !run.matchUsed) ev.push('no-sparks');
      return ev;
    },
    /** The level whose intro fits these hazards. */
    theme: f => (f.aftershocks ? 5 : f.dust ? 4 : f.knocks ? 3 : f.loadBearing ? 2 : 1)
  };

  RR.tuning = tuning;
  RR.rules = rules;
  if (typeof module !== 'undefined') module.exports = { tuning, rules };
})(typeof window !== 'undefined' ? window : globalThis);
