/* Spot the Shock (spot-the-shock): every feel number, and the pure rules (no DOM).
 * AG.spotTheShock.tuning holds the numbers; .scoring turns a finished level into points, stars, collectibles and
 * badge events; .Guard is the wrong-tap rule (300 ms debounce, 3 misses in 2 s = a short lockout); .pickPair,
 * .pickHint and .hintRadius choose what a play shows. Pure, so it also runs in kalasag-dev/minigames/tests/
 * (spot-the-shock.test.js). */
(function (root) {
  const AG = root.AG = root.AG || {};
  const ST = AG.spotTheShock = AG.spotTheShock || {};

  const tuning = {
    tolerance: { easy: 10, advanced: 6 }, // scene px around a zone, the same for touch, mouse and keys
    wrongMs: { easy: 1000, advanced: 3000 }, // a wrong tap takes this much off the clock
    guard: { debounceMs: 300, burst: 3, burstMs: 2000, lockMs: 2000 },
    hint: { ms: 1500, flashes: 3, scale: 3, min: 14, max: 56, easy: Infinity, advanced: 2 },
    cardMs: 2000,                     // the FIX CARD toast; Enter or a tap closes it sooner
    cardGuardMs: 350,                 // the key press or tap that opened a card must not also close it
    reactMs: 1100,
    stopMs: 1600,                     // power-line finds: worried, then "Don't touch!" with the stop pose
    lens: { size: 64, zoom: 2 },
    beamR: 30,                        // night: the flashlight lights 60 px across (scene px)
    darkAlpha: 0.9,
    starPx: 9,                        // the hidden ⭐ collectibles (tiny)
    points: { found: 100, perSec: 3, hint: 50, wrong: 10, fix: 50 },
    star2: { wrong: 2, hints: 1 },    // ⭐⭐ all found AND wrong ≤ 2 AND hints ≤ 1
    star3: { wrong: 1, hints: 0, timeShare: 0.4 } // ⭐⭐⭐ no hints AND wrong ≤ 1 AND ≥ 40 % of the time left
  };

  const mmss = ms => { const s = Math.max(0, Math.ceil(ms / 1000)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };

  /* ---------- scoring ---------- */
  const scoring = {
    /** found × 100 + seconds left × 3 − hints × 50 − wrong × 10 + first-try fixes × 50 (never below 0). */
    points(o) {
      const P = tuning.points;
      return Math.max(0, o.found * P.found + Math.floor(Math.max(0, o.msLeft) / 1000) * P.perSec - o.hints * P.hint - o.wrong * P.wrong + (o.fixes || 0) * P.fix);
    },
    /** 0 unless every hazard was found in time; then 1, 2 or 3. */
    stars(o) {
      if (!o.allFound || o.msLeft <= 0) return 0;
      const a = tuning.star3, b = tuning.star2;
      if (o.hints <= a.hints && o.wrong <= a.wrong && o.msLeft >= a.timeShare * o.timeMs) return 3;
      if (o.wrong <= b.wrong && o.hints <= b.hints) return 2;
      return 1;
    },
    collectibles: got => [0, 1, 2].map(i => !!got[i]),
    /** Updates the game's stats record q ({ finished, clean }) for a finished run; returns the badge events.
     *  run: { level, won, wrong, fixIt, fixesFirst, fixTotal } */
    badges(q, run) {
      const add = (k, n) => { q[k] = q[k] || []; if (!q[k].includes(n)) q[k].push(n); };
      const ev = [];
      if (run.won) { add('finished', run.level); if (run.wrong === 0) add('clean', run.level); }
      if ([1, 2, 3, 4, 5].every(n => (q.clean || []).includes(n))) ev.push('sharp-eyes');
      if (run.won && run.fixIt && run.fixTotal > 0 && run.fixesFirst === run.fixTotal) ev.push('fixer');
      if ([3, 4].every(n => (q.finished || []).includes(n))) ev.push('line-safe');
      return ev;
    }
  };

  /* ---------- wrong taps: debounce, and a short lockout after a burst ---------- */
  class Guard {
    constructor(o) { this.o = Object.assign({}, tuning.guard, o); this.last = -Infinity; this.misses = []; this.until = -Infinity; }
    locked(now) { return now < this.until; }
    /** A check (tap, click or Enter) at time now: false when it comes within the debounce or during a lockout. */
    accept(now) {
      if (this.locked(now) || now - this.last < this.o.debounceMs) return false;
      this.last = now;
      return true;
    }
    /** Records a wrong check; true when it starts a lockout (burst misses within burstMs). */
    wrong(now) {
      this.misses = this.misses.filter(t => now - t < this.o.burstMs).concat(now);
      if (this.misses.length < this.o.burst) return false;
      this.misses = []; this.until = now + this.o.lockMs;
      return true;
    }
  }

  /** Which pair a play shows: ?pair=<id> when it is in the pool, else the pool rotated by the play count. */
  function pickPair(level, plays, want) {
    const pool = level.pairs;
    return (want && pool.find(p => p.id === want)) || pool[((plays || 0) % pool.length + pool.length) % pool.length];
  }
  /** The n-th hint (0-based) points at the unfound differences in turn. */
  const pickHint = (unfound, n) => (unfound.length ? unfound[n % unfound.length] : null);
  /** Hint ring radius in scene px: 3 × the zone's (a rect: half its longer side), kept on the picture. */
  function hintRadius(zone, W, H) {
    const r = zone.shape === 'rect' ? Math.max(zone.w * W, zone.h * H) / 2 : zone.r * W;
    return Math.round(Math.min(tuning.hint.max, Math.max(tuning.hint.min, tuning.hint.scale * r)));
  }
  const hintsAllowed = difficulty => tuning.hint[difficulty === 'advanced' ? 'advanced' : 'easy'];

  Object.assign(ST, { tuning, scoring, Guard, pickPair, pickHint, hintRadius, hintsAllowed, mmss });
  if (typeof module !== 'undefined') module.exports = ST;
})(typeof window !== 'undefined' ? window : globalThis);
