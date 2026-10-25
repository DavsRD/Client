/* E3 SIDE-SCROLL ENGINE — the jump, pure (no DOM): the tuning, the one vertical step the
 * RunnerController uses in the air (jumpStep / jumpRelease), the closed-form arc and the jump
 * envelope the chunk validator checks against. Tested in kalasag-dev/minigames/tests/sidescroll.test.js.
 * Docs: kalasag-dev/minigames/docs/engines/sidescroll.md
 * Times in ms (arc times in s), speeds px/s, y grows downward; heights are px above take-off. */
(function (root) {
  const AG = root.AG = root.AG || {};
  AG.logic = AG.logic || {};

  /** The same for every character and device (GOVERNING rule 7). */
  const TUNING = {
    w: 16, h: 28, slideH: 14,              // FIXED hitbox; sliding halves it
    gravity: 1100, jumpV: 360, maxFall: 640,
    holdMs: 220, holdGravityMul: 0.45,     // variable jump: lighter gravity while held, up to 220 ms
    cutMul: 0.5, minJumpMs: 180,           // early release halves vy, applied no sooner than 180 ms
    coyoteMs: 100, bufferMs: 120,
    slideMs: 600, dropMs: 200, climbSpeed: 110, bounceV: 500, crumbleMs: 400,
    accel: 1200, stepUp: 8,                // walks up lips ≤ 8 px (half a tile: never a real step)
    stepS: 1 / 240                         // fixed physics step
  };
  /** The validator's limits (the E3 prompt): max gap ≈ 0.7 × runSpeedMax × 0.65 s. */
  const LIMITS = { gapFactor: 0.7, gapTime: 0.65, tapStep: 55, holdStep: 85 };

  const tune = t => Object.assign({}, TUNING, t);

  /** A fresh jump state at take-off. bounce = a pad launch (no hold, no cut). */
  function takeOff(T, bounce) { return { vy: -(bounce ? T.bounceV : T.jumpV), since: 0, hold: !bounce, cutPending: false }; }
  /** Falling with no jump (walked off an edge). */
  function freeFall(vy) { return { vy: vy || 0, since: Infinity, hold: false, cutPending: false }; }

  /** One air step of h seconds; returns dy. Exact for this piecewise-constant gravity: the step is
   *  split where the cut (minJumpMs), the end of the hold window or the apex falls inside it. */
  function jumpStep(s, h, T) {
    let left = h, dy = 0;
    for (let n = 0; left > 1e-12 && n < 4; n++) {
      const low = s.hold && s.since < T.holdMs && s.vy < 0;
      const g = T.gravity * (low ? T.holdGravityMul : 1);
      let seg = left;
      if (low) seg = Math.min(seg, (T.holdMs - s.since) / 1000, -s.vy / g);
      if (s.cutPending) seg = Math.min(seg, Math.max(0, (T.minJumpMs - s.since) / 1000));
      dy += s.vy * seg + 0.5 * g * seg * seg;
      s.vy = Math.min(T.maxFall, s.vy + g * seg);
      s.since += seg * 1000; left -= seg;
      if (s.cutPending && s.since >= T.minJumpMs - 1e-9) { s.cutPending = false; s.hold = false; if (s.vy < 0) s.vy *= T.cutMul; }
      if (s.since >= T.holdMs - 1e-9) s.hold = false;
    }
    return dy;
  }
  /** The jump key/finger is let go. Early (inside the hold window) while rising → vy halves. */
  function jumpRelease(s, T) {
    if (!s.hold) return s;
    if (s.vy < 0 && s.since < T.holdMs) {
      if (s.since < T.minJumpMs) { s.cutPending = true; return s; } // a tap still counts as a 180 ms jump
      s.vy *= T.cutMul;
    }
    s.hold = false;
    return s;
  }

  /** Closed-form arc for a jump held holdMs (0 = a tap, Infinity = a full hold). */
  function arc(holdMs, t) {
    const T = tune(t), g = T.gravity, gl = g * T.holdGravityMul, v0 = T.jumpV;
    const held = Math.max(holdMs || 0, T.minJumpMs);
    const t1 = Math.min(held, T.holdMs) / 1000;
    const y1 = v0 * t1 - 0.5 * gl * t1 * t1;
    let v1 = v0 - gl * t1;
    if (held < T.holdMs) v1 *= T.cutMul;
    const apex = y1 + v1 * v1 / (2 * g), tApex = t1 + v1 / g;
    /** Seconds after take-off when the falling body is back at height dh (negative = lower). */
    const landAt = dh => (dh > apex ? NaN : tApex + Math.sqrt(2 * (apex - dh) / g));
    /** Seconds after take-off when the rising body first reaches height dh. */
    const riseTo = dh => {
      if (dh > apex) return NaN;
      if (dh <= y1) return (v0 - Math.sqrt(Math.max(0, v0 * v0 - 2 * gl * dh))) / gl;
      return t1 + (v1 - Math.sqrt(Math.max(0, v1 * v1 - 2 * g * (dh - y1)))) / g;
    };
    return { holdMs: held, apex, tApex, air: landAt(0), landAt, riseTo };
  }

  /** Steps jumpStep until the body is back at take-off height (cross-checks arc()). */
  function simulate(holdMs, t, stepS) {
    const T = tune(t), h = stepS || T.stepS, s = takeOff(T);
    let y = 0, apex = 0, ms = 0, released = false;
    while (ms < 5000) {
      if (!released && ms >= (holdMs || 0) - 1e-9) { jumpRelease(s, T); released = true; }
      const until = released ? Infinity : (holdMs || 0) - ms, step = Math.min(h * 1000, until); // let go at the exact ms
      y += jumpStep(s, step / 1000, T); ms += step;
      apex = Math.max(apex, -y);
      if (y >= 0 && s.vy > 0) break;
    }
    return { apex, airMs: ms };
  }

  /** What a chunk may ask of the player at this run speed. */
  function envelope(o) {
    o = o || {};
    const T = tune(o.tuning), L = Object.assign({}, LIMITS, o.limits);
    const v = o.runSpeedMax || o.runSpeed || 150;
    const tap = arc(0, T), hold = arc(Infinity, T);
    const bounce = T.bounceV * T.bounceV / (2 * T.gravity);
    return {
      runSpeed: v, T, L, tap, hold,
      maxGap: L.gapFactor * v * L.gapTime,
      tapStep: L.tapStep, holdStep: L.holdStep, bounceStep: bounce * 0.85,
      /** Widest gap to a ledge `rise` px higher (≤ 0 = same or lower: maxGap). */
      reach(rise) {
        if (rise <= 0) return this.maxGap;
        if (rise > L.holdStep) return -1;
        return Math.min(this.maxGap, L.gapFactor * v * hold.landAt(rise));
      },
      /** A pad d px before a ledge `rise` px up: high enough there at runSpeedMax AND at 0.7 × it? */
      bounces(d, rise) {
        if (d < 0) return false;
        return [v, L.gapFactor * v].every(sp => { const t = d / sp; return T.bounceV * t - T.gravity * t * t / 2 >= rise; });
      },
      /** Can a w px wide, h px tall thing on the ground be jumped (hold) at this speed? */
      clears(w, h) {
        if (h > L.holdStep) return false;
        const up = hold.riseTo(h), down = hold.landAt(h);
        return L.gapFactor * v * (down - up) >= w + T.w;
      }
    };
  }

  const api = { TUNING, LIMITS, tune, takeOff, freeFall, jumpStep, jumpRelease, arc, simulate, envelope };
  AG.logic.sidescroll = Object.assign(AG.logic.sidescroll || {}, api);
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
