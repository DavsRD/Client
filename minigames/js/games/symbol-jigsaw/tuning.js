/* Hazard Symbol Jigsaw (symbol-jigsaw): every feel number, and the pure rules (no DOM).
 * AG.symbolJigsaw.tuning holds the numbers; .scoring turns a finished level into points, stars, Detective Badges
 * and badge events; .puzzle seeds piece turns, tray order and decoys; .wind holds the compass maths for the
 * windsock finale; .pickSign chooses the level's sign. Pure, so it also runs in
 * kalasag-dev/minigames/tests/ (symbol-jigsaw.test.js). */
(function (root) {
  const AG = root.AG = root.AG || {};
  const SJ = AG.symbolJigsaw = AG.symbolJigsaw || {};

  const tuning = {
    snap: 14,                       // board px: a piece let go this close to its home slot, at turn 0, snaps in
    sceneMs: 3000,                  // the spill scene before the puzzle
    revealStepMs: 150,              // the 1× → 2× → 1× pop, three stepped frames
    reactMs: 1100,                  // happy / worried pose after a move
    peekMs: 2500,                   // sliding level: how long the faint picture stays up
    sockMs: 450,                    // windsock flap
    arrowMs: 1200,                  // the explanation arrows' loop
    maxScale: 3,
    ghost: 0.25,                    // Level 1: the share of the picture's pixels shown (a dither)
    points: { base: 500, perMis: 20, perSec: 5, question: 100, questionLate: 50, finale: 100, finaleLate: 50 },
    star2: { mis: 2 },              // ⭐⭐ misplacements ≤ 2 AND time ≤ par
    star3: { mis: 1, parShare: 0.7 }, // ⭐⭐⭐ misplacements ≤ 1 AND time ≤ 0.7 × par AND the question right first try
    badge: { reader: 0.5, upwind: 10 }, // sign-reader at 50 % of the album, upwind-expert at 10 correct
    cardBonusXP: 5                  // a home card answered first try
  };

  /** Spill scenes. wind: the windsock finale (outdoors); indoors the finale is "tell an adult". */
  const scenes = {
    warehouse: { id: 'warehouse', wind: true },
    tanker: { id: 'tanker', wind: true },
    beach: { id: 'beach', wind: true },
    cabinet: { id: 'cabinet', wind: false }
  };
  const CATEGORIES = ['chemical', 'household', 'beach'];

  /* ---------- small seeded helpers ---------- */
  function rng(seed) { // mulberry32, as AG.util.mulberry32
    let a = seed >>> 0;
    return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  const hash = s => { let n = 2166136261; for (const c of String(s)) { n ^= c.charCodeAt(0); n = Math.imul(n, 16777619); } return n >>> 0; };
  const shuffled = (list, seed) => { const a = list.slice(), r = rng(seed); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const mmss = ms => { const s = Math.max(0, Math.round(ms / 1000)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };

  /* ---------- the puzzle: turns, order, decoys, which sign ---------- */
  const puzzle = {
    /** The cutter's seed: the same for a sign on a level, so retries reuse the cached cut. */
    cutSeed: (levelSeed, signId) => levelSeed * 1000 + (hash(signId) % 1000),
    /** Turns (quarter turns, 0–3) for n pieces: about three in four are turned, never all straight. */
    rotations(n, seed, on) {
      if (!on) return Array(n).fill(0);
      const r = rng(seed), out = Array.from({ length: n }, () => (r() < 0.75 ? 1 + Math.floor(r() * 3) : 0));
      if (out.every(q => q === 0)) out[0] = 1 + Math.floor(r() * 3);
      return out;
    },
    /** The order the tray lists n pieces in. */
    order: (n, seed) => shuffled(Array.from({ length: n }, (_, i) => i), seed),
    /** k distinct piece indices (of n) that get a look-alike decoy. */
    decoyIndices: (n, k, seed) => shuffled(Array.from({ length: n }, (_, i) => i), seed).slice(0, Math.min(k, n)).sort((a, b) => a - b),
    /** Which sign a level plays: the first in the pool, rotating by the seed, that is not in the album yet; else by the seed alone. */
    pickSign(pool, collected, seed) {
      const have = new Set(collected || []), n = pool.length, start = Math.abs(seed | 0) % n;
      for (let i = 0; i < n; i++) { const id = pool[(start + i) % n]; if (!have.has(id)) return id; }
      return pool[start];
    }
  };

  /* ---------- the compass: the windsock tip shows where the wind blows TO ---------- */
  const DIRS = ['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw']; // clockwise from the top of the screen
  const VEC = { n: [0, -1], ne: [1, -1], e: [1, 0], se: [1, 1], s: [0, 1], sw: [-1, 1], w: [-1, 0], nw: [-1, -1] };
  const wind = {
    DIRS, VEC,
    NAME: { n: 'North', ne: 'North-east', e: 'East', se: 'South-east', s: 'South', sw: 'South-west', w: 'West', nw: 'North-west' },
    opposite: d => DIRS[(DIRS.indexOf(d) + 4) % 8],
    sideways: d => [DIRS[(DIRS.indexOf(d) + 2) % 8], DIRS[(DIRS.indexOf(d) + 6) % 8]],
    /** The sock tip's direction for a seed. */
    tipFor: seed => DIRS[Math.abs(seed | 0) % 8],
    /** The four arrows to choose from, in compass order: upwind (the right one), downwind (the sock tip) and the two sideways. */
    options(tip) {
      const set = [wind.opposite(tip), tip].concat(wind.sideways(tip));
      return DIRS.filter(d => set.includes(d));
    },
    /** Right: toward where the wind comes FROM. 'down' = along the sock tip, 'side' = across the wind. */
    kind(tip, pick) { return pick === wind.opposite(tip) ? 'up' : pick === tip ? 'down' : 'side' }
  };

  /* ---------- scoring ---------- */
  const scoring = {
    mmss,
    /** 500 − 20 × misplacements + (par − time) × 5 + question + finale. The time bonus never goes below 0; neither does the total. */
    points(o) {
      const P = tuning.points, timeS = Math.round((o.timeMs || 0) / 1000);
      const q = o.questionTries === 1 ? P.question : o.questionTries > 1 ? P.questionLate : 0;
      const f = o.finaleTries === 1 ? P.finale : o.finaleTries > 1 ? P.finaleLate : 0;
      const bonus = Math.max(0, (o.par - timeS) * P.perSec);
      return Math.max(0, P.base - P.perMis * (o.mis || 0) + bonus + q + f);
    },
    /** 1 = completed · 2 = ≤ 2 misplacements and time ≤ par · 3 = ≤ 1 misplacement, time ≤ 0.7 × par and the question right first try. */
    stars(o) {
      const t = (o.timeMs || 0) / 1000, par = o.par;
      if (o.mis <= tuning.star3.mis && t <= par * tuning.star3.parShare + 1e-9 && o.questionTries === 1) return 3;
      if (o.mis <= tuning.star2.mis && t <= par + 1e-9) return 2;
      return 1;
    },
    /** Detective Badges: no misplacements · the question first try · the finale (upwind) first try. */
    collectibles: o => [!o.mis, o.questionTries === 1, o.finaleTries === 1],
    albumPct: (album, total) => (total ? album.length / total : 0),
    /** sign-reader (half the album) · full-album · upwind-expert (10 correct upwind answers, ever). */
    badges(o) {
      const ev = [], pct = scoring.albumPct(o.album || [], o.total);
      if (pct >= tuning.badge.reader) ev.push('sign-reader');
      if (o.total && pct >= 1) ev.push('full-album');
      if ((o.upwind || 0) >= tuning.badge.upwind) ev.push('upwind-expert');
      return ev;
    }
  };

  SJ.tuning = tuning; SJ.scenes = scenes; SJ.CATEGORIES = CATEGORIES;
  SJ.puzzle = puzzle; SJ.wind = wind; SJ.scoring = scoring;
  SJ.util = { rng, hash, shuffled };
  if (typeof module !== 'undefined') module.exports = { tuning, scenes, puzzle, wind, scoring };
})(typeof window !== 'undefined' ? window : globalThis);
