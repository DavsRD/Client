/* Fire Escape Maze (fire-escape): every feel number, and the pure rules.
 * AG.fireEscape.tuning holds the numbers; AG.fireEscape.rules turns a level entry into
 * generator params and a finished run into points, stars and badge counts. Pure (no DOM),
 * so it also runs in kalasag-dev/minigames/tests/ (fire-escape.test.js). */
(function (root) {
  const AG = root.AG = root.AG || {};
  const FE = AG.fireEscape = AG.fireEscape || {};

  const tuning = {
    tile: 20,
    speeds: { walk: 140, crawl: 260 },        // ms per tile (the same for all six characters)
    holdDelay: 120,
    parMult: { easy: 2.5, advanced: 1.6 },    // par = shortest × walk × this + doors × doorMs
    doorMs: 1000,
    parMinMs: 20000,                          // a floor so the smallest mazes still give young pupils time
    braid: { easy: 0.5, advanced: 0.3 },
    cells: { easy: [7, 8, 9, 10, 11], advanced: [13, 15, 17, 19, 21] },     // by level 1–5
    rooms: { easy: [2, 2, 3, 3, 4], advanced: [3, 4, 5, 6, 7] },
    doorShare: [0.3, 0.5], hotDoors: { easy: [1, 1], advanced: [1, 3] },
    fires: { easy: 2, advanced: 3 },
    smoke: { easy: { sources: 2, radius: 3 }, advanced: { sources: 3, radius: 5 } },
    /** The hazards each world adds (W1 signs only … W5 power cut + rescue). */
    worlds: {
      1: [],
      2: ['smoke'],
      3: ['smoke', 'doors'],
      4: ['smoke', 'doors', 'fire', 'elevator'],
      5: ['smoke', 'doors', 'dark', 'classmate']
    },
    cough: { fillPerS: 0.25, decayPerS: 0.1, coughEveryS: 1.1 },  // upright in smoke; crawling adds 0
    penalty: { checkpointMs: 3000, openUnfeltMs: 1000, elevatorMs: 5000 },
    feelMs: 500,                              // the ✋ badge over the character
    spread: { easy: 4000, advanced: 2500, p: 0.5, emberP: 0.35, maxEmbers: 4 },
    qte: { stopMs: 1500, dropMs: 1500, rollMs: 3000, rolls: 4, safeMs: 2500 },
    dark: { radius: 2.5, signTiles: 6 },
    camera: { deadzone: { w: 120, h: 68 }, smooth: 10 },
    points: { timeLeft: 20, coin: 50, noPenalty: 300, qte: 100, classmate: 200 },
    stars: { two: { timeLeft: 0.3, cough: 0.5 }, three: { timeLeft: 0.5 } },
    badges: { smokeTiles: 100, doorsFelt: 50 },
    dailyModifiers: ['smoke', 'doors', 'fire', 'dark']
  };

  const lvl = n => Math.min(5, Math.max(1, n || 1)) - 1;

  const rules = {
    /** The hazards for a level: its own list, else the world's. Fire brings the elevator,
     *  the power cut brings the classmate to rescue. */
    features(entry, world) {
      const list = (entry && entry.features) || tuning.worlds[Math.min(5, Math.max(1, world || 1))];
      const f = {};
      list.forEach(k => { f[k] = true; });
      if (f.fire) f.elevator = true;
      if (f.dark) f.classmate = true;
      return f;
    },
    /** Generator params for a level entry (levels.json or generateDaily) and a difficulty. */
    params(entry, difficulty, world, level) {
      const d = difficulty === 'advanced' ? 'advanced' : 'easy', o = (entry && entry[d]) || {};
      const sm = tuning.smoke[d];
      return {
        cells: o.cells || tuning.cells[d][lvl(level)],
        rooms: o.rooms || tuning.rooms[d][lvl(level)],
        braid: o.braid != null ? o.braid : tuning.braid[d],
        features: rules.features(entry, world),
        doorShare: tuning.doorShare, hotDoors: tuning.hotDoors[d], fires: o.fires || tuning.fires[d],
        smokeSources: o.smokeSources || sm.sources, smokeRadius: o.smokeRadius || sm.radius,
        walkStepMs: tuning.speeds.walk, parMult: tuning.parMult[d], doorMs: tuning.doorMs, parMinMs: tuning.parMinMs
      };
    },
    /** Points = time left (s) × 20 + coins × 50 + no-penalty 300 + QTE successes × 100 + classmate 200. */
    points(o) {
      if (!o.escaped) return (o.coins || 0) * tuning.points.coin + (o.qte || 0) * tuning.points.qte;
      const P = tuning.points;
      return Math.floor(Math.max(0, o.timeLeftMs || 0) / 1000) * P.timeLeft + (o.coins || 0) * P.coin + (o.penalties ? 0 : P.noPenalty)
        + (o.qte || 0) * P.qte + (o.classmate ? P.classmate : 0);
    },
    /** 1 = escaped; 2 = time left ≥ 30 % and max cough ≤ 50 %; 3 = time left ≥ 50 %, no
     *  penalties and (with a classmate) the classmate saved. */
    stars(o) {
      if (!o.escaped) return 0;
      const share = o.parMs > 0 ? o.timeLeftMs / o.parMs : 0, S = tuning.stars;
      const three = share >= S.three.timeLeft && !o.penalties && (!o.needsClassmate || o.classmate);
      if (three) return 3;
      return share >= S.two.timeLeft && (o.maxCough || 0) <= S.two.cough ? 2 : 1;
    },
    /** Running badge counts → which badges are earned now. */
    badges(stats, run) {
      const ev = [];
      if ((stats.smokeCrawled || 0) >= tuning.badges.smokeTiles) ev.push('low-and-slow');
      if ((stats.doorsFelt || 0) >= tuning.badges.doorsFelt) ev.push('door-checker');
      if (run && run.escaped && run.world === 4 && run.mode === 'stage' && !run.elevatorHits) ev.push('stairs-not-elevator');
      return ev;
    },
    /** A different seed for "New maze" (n = how many new mazes asked for). */
    reseed: (seed, n) => ((seed >>> 0) + Math.imul(n, 0x9e3779b1)) >>> 0
  };

  FE.tuning = tuning;
  FE.rules = rules;
  if (typeof module !== 'undefined') module.exports = { tuning, rules };
})(typeof window !== 'undefined' ? window : globalThis);
