/* Safe Crossing (safe-crossing): every feel number, and the pure scoring rules.
 * AG.safeCrossing.tuning holds the numbers; AG.safeCrossing.rules scores a crossing, a run
 * and the stars. Pure (no DOM), so it also runs in kalasag-dev/minigames/tests/
 * (safe-crossing.test.js). Crossing SAFELY scores more than just getting across. */
(function (root) {
  const AG = root.AG = root.AG || {};
  const SC = AG.safeCrossing = AG.safeCrossing || {};

  const tuning = {
    tile: 30, cols: 16,
    speeds: { hop: 120, phone: 200 },          // ms per hop (the same for all six characters)
    holdDelay: 140,
    hop: 3,                                    // px of hop arc
    hitbox: 14,                                // px wide, centred on the player's cell
    vehicleInset: 3,                           // px trimmed off each end of a vehicle's hitbox
    hearts: 3,
    blinkMs: 1000,                             // after a hit: blink and can't be hit again
    lookIdleMs: 500,                           // standing still on a curb this long → look left, look right
    lookMs: { left: 380, right: 380 },
    lengths: { motorcycle: 1, tricycle: 1, car: 2, jeepney: 2, bus: 3 },   // cells
    mixes: {
      light: { motorcycle: 2, tricycle: 3, car: 1 },
      mixed: { car: 3, jeepney: 3, tricycle: 2, motorcycle: 2, bus: 1 },
      market: { jeepney: 4, tricycle: 3, motorcycle: 2, car: 1 },
      busy: { car: 3, jeepney: 3, bus: 2, motorcycle: 2 }
    },
    minGap: 8,                                 // px kept between queued vehicles
    jeepneyStop: { p: 0.5, minMs: 3000, maxMs: 6000 },
    signal: { walkMs: 6000, flashMs: 2000, stopMs: 8000 },
    rail: { warnMs: 3000, speed: 360, cars: 3 },   // the barrier is down warnMs before the train
    school: 0.6,                               // vehicles in a school zone
    vest: { factor: 0.5, cols: 3 },            // vehicles this close, coming at a vested player, slow down
    difficulty: { easy: { speed: 1, gap: 1 }, advanced: { speed: 1.25, gap: 0.8 } },
    prewarmS: 30,                              // traffic runs this long before the level starts
    dark: { player: 44, vest: 60, streetlight: 50, vehicle: 26 },
    camera: { deadzone: { x: 0, y: 170, w: 480, h: 60 }, smooth: 10 },
    points: { row: 10, coin: 10, look: 50, noLook: -20, walk: 100, bridge: 100, phoneAway: 20, waitTrain: 50, sidewalkRide: -20 },
    jaywalkCols: 3,                            // outside the zebra with one this close = jaywalking
    stars: { two: 0.45, three: 0.7, twoHeartsLost: 1 },   // share of the level's ideal score
    endless: { rows: 200, ramp: 40, stars: [40, 90, 150] },
    badges: { looked: 100, zebra: 50 },
    nightLevels: ['5']
  };

  /** A clonable seeded random (mulberry32 with its state in .s), so traffic can be copied
   *  and run ahead (the wait-and-go bot in the tests). */
  function rng(seed) {
    return {
      s: seed >>> 0,
      next() {
        let t = this.s = (this.s + 0x6D2B79F5) >>> 0;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      },
      int(a, b) { return a + Math.floor(this.next() * (b - a + 1)); },
      clone() { const r = rng(0); r.s = this.s; return r; }
    };
  }

  const P = tuning.points;
  const rules = {
    /** Points for one finished crossing. c = { rows, looked, walk, zebra, jaywalk, bridge }.
     *  Looking (+50) and the walk signal (+100) are bonuses; a whole crossing inside the
     *  pedestrian lane doubles the crossing (rows + bonuses); jaywalking cancels the bonuses.
     *  Not looking (−20) was already taken when the player stepped off the curb. */
    crossing(c) {
      if (c.bridge) return { bonus: P.bridge, extra: 0, total: P.bridge };
      if (c.jaywalk) return { bonus: 0, extra: 0, total: 0 };
      const bonus = (c.looked ? P.look : 0) + (c.walk ? P.walk : 0);
      const extra = c.zebra ? c.rows * P.row + bonus : 0;
      return { bonus, extra, total: bonus + extra };
    },
    /** Outside the zebra, with a zebra within 3 columns of where you are = jaywalking. */
    jaywalk(col, zebra) {
      if (!zebra) return false;
      if (col >= zebra[0] && col <= zebra[1]) return false;
      const d = col < zebra[0] ? zebra[0] - col : col - zebra[1];
      return d <= tuning.jaywalkCols;
    },
    /** The best score a level allows (rows, paws, and every crossing done the safest way). */
    ideal(course) {
      let n = (course.lanes.length - 1) * P.row + 3 * P.coin;
      for (const g of course.groups) {
        if (g.kind !== 'road') continue;
        const rows = g.end - g.start + 1;
        let best = P.look + (g.signal ? P.walk : 0);
        if (g.zebra) best = best * 2 + rows * P.row;
        if (g.bridge) best = Math.max(best, P.bridge);
        n += best;
      }
      return n;
    },
    targets(course, entry) {
      if (entry && entry.targets) return entry.targets;
      const ideal = rules.ideal(course), r10 = x => Math.round(x / 10) * 10;
      return { two: r10(ideal * tuning.stars.two), three: r10(ideal * tuning.stars.three), ideal };
    },
    /** Stage: 1 = reached School; 2 = ≥ target2 and ≤ 1 heart lost; 3 = ≥ target3 and none lost.
     *  Endless (Daily): by rows reached. */
    stars(run, targets) {
      if (run.endless) { const s = tuning.endless.stars; return run.rows >= s[2] || run.school ? 3 : run.rows >= s[1] ? 2 : run.rows >= s[0] ? 1 : 0; }
      if (!run.school) return 0;
      if (run.score >= targets.three && run.heartsLost === 0) return 3;
      if (run.score >= targets.two && run.heartsLost <= tuning.stars.twoHeartsLost) return 2;
      return 1;
    },
    /** Running badge counts → the badges earned now. */
    badges(stats) {
      const ev = [];
      if ((stats.looked || 0) >= tuning.badges.looked) ev.push('looks-both-ways');
      if ((stats.zebra || 0) >= tuning.badges.zebra) ev.push('zebra-fan');
      if (tuning.nightLevels.every(k => (stats.nightVest || {})[k])) ev.push('bright-at-night');
      return ev;
    },
    /** Speed and gap multipliers for a difficulty. */
    diff: d => tuning.difficulty[d === 'advanced' ? 'advanced' : 'easy']
  };

  SC.tuning = tuning;
  SC.rules = rules;
  SC.rng = rng;
  if (typeof module !== 'undefined') module.exports = { tuning, rules, rng };
})(typeof window !== 'undefined' ? window : globalThis);
