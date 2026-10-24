/* Pest Patrol Match (pest-patrol): every feel number, and the pure rules.
 * AG.pestPatrol.tuning holds the numbers; AG.pestPatrol.rules turns them into stars,
 * points, face picks and Onet deals. The rules need nothing but plain data and
 * AG.logic.onet, so they also run in kalasag-dev/minigames/tests/ (pest-patrol.test.js). */
(function (root) {
  const AG = root.AG = root.AG || {};
  const PP = AG.pestPatrol = AG.pestPatrol || {};

  const tuning = {
    flipBackMs: 800,                         // a memory miss flips back after this
    memoryStars: [1.3, 1.8],                 // attempts ≤ sets × 1.3 = 3 stars, ≤ × 1.8 = 2
    dropStars: [1, 3],                       // misplacements ≤ 1 = 3 stars, ≤ 3 = 2
    onet: {
      time: { easy: 120, advanced: 80 },     // world 4 (seconds)
      bossTime: { easy: 150, advanced: 110 },// world 5: the sites take time to clean too
      shuffles: 2,                           // S / 🔀 per level (the no-moves shuffle is free)
      passShare: 0.75,                       // time up with this share of the board cleared still passes
      starShare: [0.15, 0.4],                // time left / total (+ the chain bonus) for 2 / 3 stars
      chainShare: 0.02, chainShareMax: 0.2,  // each match of the best chain adds this to the share
      greedyShuffles: 2,                     // a deal must clear by greedy play with ≤ this many shuffles
      dealTries: 40
    },
    matchPoints: 100, chainBonus: 50,        // a match inside a speed chain is worth × 1.5
    chainMs: 3000, timePoints: 5, hintCost: 50,
    hintMs: 1600, reactMs: 900, toastMs: 2200,
    badges: { onetChain: 10, sites: 40 }
  };

  const rules = {
    /** Memory and Triple: 3 = attempts ≤ sets × 1.3; 2 = ≤ × 1.8; 1 = complete. */
    memoryStars(attempts, sets, complete) {
      if (complete === false) return 0;
      const [a, b] = tuning.memoryStars;
      return attempts <= sets * a ? 3 : attempts <= sets * b ? 2 : 1;
    },
    /** Pest → Prevention: 0–1 misplacements = 3 stars, 2–3 = 2, more = 1. */
    dropStars(misplaced) {
      const [a, b] = tuning.dropStars;
      return misplaced <= a ? 3 : misplaced <= b ? 2 : 1;
    },
    /** Onet: cleared (or passed on time) → 1–3 stars by the share of time left plus the best chain. */
    onetStars(o) {
      if (!o.passed) return 0;
      if (!o.cleared) return 1;
      const T = tuning.onet;
      const share = o.left / o.total + Math.min(T.chainShareMax, (o.bestChain || 0) * T.chainShare);
      return share >= T.starShare[1] ? 3 : share >= T.starShare[0] ? 2 : 1;
    },
    /** Did a timed-out Onet board clear enough to pass? */
    onetPassed: (clearedTiles, totalTiles) => clearedTiles >= totalTiles * tuning.onet.passShare,
    /** Chain points for one match: × 1.5 from the 2nd match inside the speed window. */
    chainPoints: n => (n >= 2 ? tuning.chainBonus : 0),
    /** Points = matches × 100 + chain + time left × 5 − hints × 50 (never below 0). */
    points(o) {
      return Math.max(0, (o.matches || 0) * tuning.matchPoints + (o.chain || 0) + Math.floor(o.timeLeft || 0) * tuning.timePoints - (o.hints || 0) * tuning.hintCost);
    },

    /** Seeded pick of n items (no repeats), keeping `must` first. */
    pick(list, n, rnd, must) {
      const head = (must || []).filter(x => list.includes(x));
      const rest = list.filter(x => !head.includes(x));
      for (let i = rest.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [rest[i], rest[j]] = [rest[j], rest[i]]; }
      return head.concat(rest).slice(0, n);
    },
    /**
     * Memory faces: every face of every set (pest, cause, prevent) plus the look-alikes.
     * Easy leaves out the second half of each look-alike pair (🪰 of 🦟 / 🪰, 🐁 of 🐀 / 🐁);
     * Advanced always puts both halves of every look-alike pair in.
     * faces: [{ id, set }]; lookalikes: [[idA, idB], …]
     */
    memoryFaces(faces, n, rnd, advanced, lookalikes) {
      const pairs = lookalikes || [];
      if (!advanced) { const second = new Set(pairs.map(p => p[1])); return rules.pick(faces.map(f => f.id).filter(id => !second.has(id)), n, rnd); }
      return rules.pick(faces.map(f => f.id), n, rnd, pairs.flat());
    },
    /** The 3 golden indexes out of n (collectibles), seeded. */
    golden(n, rnd) { return rules.pick(Array.from({ length: n }, (_, i) => i), Math.min(3, n), rnd); },

    /**
     * Onet tiles for a w × h board: pest ↔ cause and pest ↔ prevention partner pairs, spread
     * over the sets in turn. Each tile is { id, set, role } and pairs with the same set's pest.
     */
    onetTiles(sets, w, h) {
      const pairs = Math.floor((w * h) / 2), out = [];
      for (let i = 0; i < pairs; i++) {
        const set = sets[i % sets.length], role = Math.floor(i / sets.length) % 2 ? 'cause' : 'prevent';
        out.push({ id: 't' + (i * 2), set, role: 'pest' }, { id: 't' + (i * 2 + 1), set, role });
      }
      return out;
    },
    /** A pest matches its own set's cause or prevention (in either order). */
    partner(a, b) {
      if (!a || !b || a === b || a.set !== b.set) return false;
      return (a.role === 'pest') !== (b.role === 'pest');
    },
    /**
     * Plays a board greedily (always the first move findMove gives) and shuffles when stuck.
     * Returns { cleared, shuffles }. Never changes `board`.
     */
    greedy(board, rnd, maxShuffles) {
      const O = AG.logic.onet;
      let b = { w: board.w, h: board.h, cells: board.cells.slice(), match: board.match }, shuffles = 0;
      for (;;) {
        if (O.isClear(b)) return { cleared: true, shuffles };
        const m = O.findMove(b);
        if (m) { O.remove(b, m.a, m.b); continue; }
        if (shuffles >= maxShuffles) return { cleared: false, shuffles };
        shuffles++;
        b = O.shuffle(b, rnd);
      }
    },
    /** Deals a board that the greedy simulation clears with ≤ greedyShuffles shuffles (re-deals if stuck). */
    dealSolvable(w, h, tiles, rnd, maxShuffles) {
      const O = AG.logic.onet, T = tuning.onet;
      const limit = maxShuffles != null ? maxShuffles : T.greedyShuffles;
      let b = null;
      for (let t = 0; t < T.dealTries; t++) {
        b = O.deal(w, h, tiles, rnd, rules.partner);
        if (rules.greedy(b, rnd, limit).cleared) return { board: b, tries: t + 1 };
      }
      return { board: b, tries: T.dealTries, stuck: true };
    },
    /** Phones: a board wider than 6 columns is turned on its side (6 × 8 instead of 8 × 6). */
    fitBoard(w, h, narrow) { return narrow && w > 6 && h < w ? { w: h, h: w } : { w, h }; },
    /** Breeding-site cells for World 5: n distinct cells that hold a tile, seeded. */
    sites(board, n, rnd) {
      const O = AG.logic.onet;
      return rules.pick(O.occupied(board).map(p => p.y * board.w + p.x), n, rnd).sort((a, b) => a - b);
    }
  };

  PP.tuning = tuning;
  PP.rules = rules;
  if (typeof module !== 'undefined') module.exports = { tuning, rules };
})(typeof window !== 'undefined' ? window : globalThis);
