/* Water Ways (water-ways): every feel number, and the pure rules.
 * AG.waterWays.tuning holds the numbers (the water model's own numbers sit in tuning.flow and
 * go to AG.logic.waterFlow); AG.waterWays.rules turns a level entry into a board and a finished
 * run into stars, points and badge counts. Pure (no DOM), so it also runs in
 * kalasag-dev/minigames/tests/ (water-ways.test.js). Load after js/logic/water-ways/flow.js. */
(function (root) {
  const AG = root.AG = root.AG || {};
  const WW = AG.waterWays = AG.waterWays || {};
  const WF = AG.logic.waterFlow;

  const tuning = {
    cell: 32,                                 // every board size: 4 × 4 = 128 px … 8 × 8 = 256 px
    bust: 48,                                 // the player's portrait left of the board
    flow: {
      supply: { reservoir: 10, barrel: 6 },   // defaults; levels.json props override them
      demand: { house: 4, animals: 3, field: 4, laundry: 3 },
      leak: 2,                                // L: each unfixed leak in a network
      evap: 1,                                // E: each OPEN canal (covered: 0)
      rain: 2,                                // R: each rain catcher
      grey: 0.6                               // the share of the laundry's water that flows on
    },
    fillMs: 2000,                             // water fills the pipes along the BFS order
    thinkMs: 900,                             // the "think" pose after a turn
    heat: { ms: 10000, points: 50 },          // the heat check after the board
    testCost: { easy: 0, advanced: 20 },      // each FLOW after the first
    hints: { easy: Infinity, advanced: 3 },
    points: { house: 200, other: 100, leak: 50, unused: 10, underPar: 10 },
    /** What each level adds, when levels.json has no "features". */
    levels: {
      1: [],
      2: ['priority'],
      3: ['priority', 'leaks'],
      4: ['leaks', 'drip', 'grey', 'rain'],
      5: ['leaks', 'canals', 'heat']
    },
    badges: { leaks: 30, grey: 10 }
  };

  const lvl = n => Math.min(5, Math.max(1, n || 1));
  const diffOf = d => (d === 'advanced' ? 'advanced' : 'easy');

  const rules = {
    features(entry, level) {
      const f = {};
      ((entry && entry.features) || tuning.levels[lvl(level)]).forEach(k => { f[k] = true; });
      return f;
    },
    /** The board for a difficulty (levels.json keeps one per difficulty), at its solution. */
    board(entry, difficulty) {
      const spec = entry && (entry[diffOf(difficulty)] || entry.easy);
      return spec ? WF.parse(spec, tuning.flow) : null;
    },
    /** The destinations this board's water budget is meant to cover (default: all). */
    targets(board, res) { return res.dests.filter(d => !board.serve || board.serve.includes(d.kind)); },
    houseMet: res => { const hs = res.dests.filter(d => d.kind === 'house'); return hs.length > 0 && hs.every(d => d.met); },
    /** Solved = every target destination has all its water. */
    solved(board, res) { return rules.houseMet(res) && rules.targets(board, res).every(d => d.met); },
    /** ⭐ drinking water met · ⭐⭐ + every target · ⭐⭐⭐ + no unfixed leak and waste ≤ target. */
    stars(board, res) {
      if (!rules.houseMet(res)) return 0;
      if (!rules.solved(board, res)) return 1;
      return res.leaks.length === 0 && res.waste <= board.wasteTarget ? 3 : 2;
    },
    /** For WF.scramble: never start solved; decoys must keep the stored solution perfect. */
    checks(board) {
      const at = rots => WF.simulate(board, rots, tuning.flow);
      const fixed = Object.assign({}, board, { tiles: board.tiles.map(t => (t && t.leak ? Object.assign({}, t, { fixed: true }) : t)) });
      return {
        solved: rots => rules.solved(board, at(rots)),
        perfect: rots => rules.stars(fixed, WF.simulate(fixed, rots, tuning.flow)) === 3
      };
    },
    tests: d => tuning.testCost[diffOf(d)],
    hints: d => tuning.hints[diffOf(d)],
    /**
     * Drinking water fully met 200, every other target destination met 100 (a place outside the
     * board's water plan earns nothing, so priorities always score best), leaks fixed × 50,
     * unused water × 10, − 20 per extra test (Advanced), + (par − turns) × 10, + 50 for the
     * heat check. o: { res, board, tests, difficulty, par, rotations, leaksFixed, heat }
     */
    points(o) {
      const P = tuning.points, ds = !o.res ? [] : o.board ? rules.targets(o.board, o.res) : o.res.dests;
      let s = 0;
      ds.forEach(d => { if (d.met) s += d.kind === 'house' ? P.house : P.other; });
      s += (o.leaksFixed || 0) * P.leak;
      s += (o.res ? o.res.unused : 0) * P.unused;
      s -= Math.max(0, (o.tests || 0) - 1) * rules.tests(o.difficulty);
      s += Math.max(0, (o.par || 0) - (o.rotations || 0)) * P.underPar;
      if (o.heat) s += tuning.heat.points;
      return Math.max(0, Math.round(s));
    },
    /** "Water Saver" stickers: solved on the first FLOW · turns ≤ par · a perfect heat check. */
    collectibles: run => [!!run.firstSolved, run.rotations <= run.par, !!run.heat],
    /** Running counts → which badges are earned now. */
    badges(stats, run) {
      const ev = [];
      if ((stats.leaks || 0) >= tuning.badges.leaks) ev.push('leak-hunter');
      if ((stats.grey || 0) >= tuning.badges.grey) ev.push('reuse-it');
      if (run && run.heat && run.level === 5) ev.push('cool-head');
      return ev;
    },
    /** The level whose intro fits these features. */
    theme: f => (f.canals || f.heat ? 5 : f.grey || f.drip || f.rain ? 4 : f.leaks ? 3 : f.priority ? 2 : 1)
  };

  WW.tuning = tuning;
  WW.rules = rules;
  if (typeof module !== 'undefined') module.exports = { tuning, rules };
})(typeof window !== 'undefined' ? window : globalThis);
