/* Swipe-card decisions, pure. All numbers are CSS px and CSS px per second.
 *
 *   swipe.decide(dx, vx)          → 'left' | 'right' | null (spring back)
 *        commits past ±120 px, or on a fling of ≥ 600 px/s in the direction the card moved
 *   const v = swipe.tracker()     v.add(timeMs, x); v.velocity() → px/s over the last 100 ms
 *   swipe.labelAlpha(dx)          0..1 in 4 steps: how strongly a side label shows
 * The same numbers hold for every device (mouse drag, touch, pen). */
(function (root) {
  const AG = root.AG = root.AG || {};
  AG.logic = AG.logic || {};

  const DISTANCE = 120, VELOCITY = 600, WINDOW_MS = 100;

  function decide(dx, vx, opts) {
    const dist = (opts && opts.distance) || DISTANCE, vel = (opts && opts.velocity) || VELOCITY;
    if (Math.abs(dx) >= dist) return dx > 0 ? 'right' : 'left';
    // a fling counts only when it carries the card the way it was already going
    if (Math.abs(vx) >= vel && dx * vx > 0) return vx > 0 ? 'right' : 'left';
    return null;
  }

  function tracker(windowMs) {
    const win = windowMs || WINDOW_MS;
    let pts = [];
    return {
      add(t, x) { pts.push({ t, x }); while (pts.length > 2 && t - pts[0].t > win) pts.shift(); },
      velocity() {
        if (pts.length < 2) return 0;
        const a = pts[0], b = pts[pts.length - 1], dt = b.t - a.t;
        return dt > 0 ? ((b.x - a.x) / dt) * 1000 : 0;
      },
      reset() { pts = []; }
    };
  }

  const labelAlpha = (dx, opts) => Math.min(4, Math.floor((Math.abs(dx) / ((opts && opts.distance) || DISTANCE)) * 4)) / 4;

  const api = { decide, tracker, labelAlpha, DISTANCE, VELOCITY };
  AG.logic.swipe = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
