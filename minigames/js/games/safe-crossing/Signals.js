/* Safe Crossing — the pedestrian walk signal. Pure (tested in safe-crossing.test.js).
 *
 *   AG.safeCrossing.signal.phase(sig, tMs) → { phase: 'walk' | 'flash' | 'stop', leftMs }
 *   sig = { walkMs, flashMs, stopMs, offsetMs } (missing times come from tuning.signal)
 * WALK (6 s) → FLASH (2 s, finish crossing, don't start) → STOP (8 s). While it shows WALK or
 * FLASH, the group's traffic waits before the zebra. Stepping onto the road on STOP always
 * costs a heart, even when no vehicle is near. */
(function (root) {
  const AG = root.AG = root.AG || {};
  const SC = AG.safeCrossing = AG.safeCrossing || {};

  const signal = {
    times(sig) {
      const T = SC.tuning.signal;
      return { walk: sig.walkMs || T.walkMs, flash: sig.flashMs || T.flashMs, stop: sig.stopMs || T.stopMs, offset: sig.offsetMs != null ? sig.offsetMs : sig.offset || 0 };
    },
    phase(sig, t) {
      const s = signal.times(sig), cycle = s.walk + s.flash + s.stop;
      const p = (((t + s.offset) % cycle) + cycle) % cycle;
      if (p < s.walk) return { phase: 'walk', leftMs: s.walk - p };
      if (p < s.walk + s.flash) return { phase: 'flash', leftMs: s.walk + s.flash - p };
      return { phase: 'stop', leftMs: cycle - p };
    },
    /** Traffic waits at the zebra while pedestrians may be on it. */
    holds: (sig, t) => signal.phase(sig, t).phase !== 'stop'
  };

  SC.signal = signal;
  if (typeof module !== 'undefined') module.exports = signal;
})(typeof window !== 'undefined' ? window : globalThis);
