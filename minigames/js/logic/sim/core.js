/* E7 SIMULATION ENGINE — shared pure helpers (no DOM): a tiny Emitter, a binary min-heap,
 * polylines measured by arc length, and "the nearest point in a direction" for arrow-key
 * selection of free-standing things (build slots, task bubbles). On AG.logic.sim.
 * Tested in kalasag-dev/minigames/tests/sim.test.js. Docs: kalasag-dev/minigames/docs/engines/sim.md */
(function (root) {
  const AG = root.AG = root.AG || {};
  AG.logic = AG.logic || {};
  const S = AG.logic.sim = AG.logic.sim || {};

  /** on(type, fn) → off; emit(type, data) also calls this.o['on' + Type] when the options have one. */
  class Emitter {
    on(type, fn) { (this._h = this._h || {})[type] = (this._h[type] || []).concat(fn); return () => { this._h[type] = this._h[type].filter(f => f !== fn); }; }
    emit(type, data) {
      ((this._h && this._h[type]) || []).slice().forEach(fn => { try { fn(data, this); } catch (e) { console.error(e); } });
      const cb = this.o && this.o['on' + type[0].toUpperCase() + type.slice(1)];
      if (cb) cb(data, this);
    }
  }

  /** Min-heap of (priority, value); equal priorities pop in push order (deterministic). */
  function heap() {
    const pr = [], val = [], seq = [];
    let n = 0, order = 0;
    const less = (i, j) => pr[i] < pr[j] || (pr[i] === pr[j] && seq[i] < seq[j]);
    const swap = (i, j) => { let t = pr[i]; pr[i] = pr[j]; pr[j] = t; t = val[i]; val[i] = val[j]; val[j] = t; t = seq[i]; seq[i] = seq[j]; seq[j] = t; };
    return {
      get size() { return n; },
      push(p, v) { pr[n] = p; val[n] = v; seq[n] = order++; let i = n++; while (i > 0) { const q = (i - 1) >> 1; if (!less(i, q)) break; swap(i, q); i = q; } },
      pop() {
        const top = val[0]; n--;
        if (n > 0) { pr[0] = pr[n]; val[0] = val[n]; seq[0] = seq[n]; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < n && less(l, m)) m = l; if (r < n && less(r, m)) m = r; if (m === i) break; swap(i, m); i = m; } }
        return top;
      },
      peekPriority() { return n ? pr[0] : Infinity; }
    };
  }

  /** A polyline measured by arc length. at(s) → { x, y, dx, dy, seg } (dx, dy = unit heading);
   *  project(x, y) → { s, d } the nearest point on the line (d = distance to it). */
  function polyline(points) {
    const pts = points.map(p => ({ x: p.x, y: p.y })), cum = new Float64Array(pts.length);
    for (let i = 1; i < pts.length; i++) cum[i] = cum[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
    const length = pts.length ? cum[pts.length - 1] : 0;
    function seg(s) { let lo = 0, hi = pts.length - 1; while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (cum[mid] <= s) lo = mid; else hi = mid; } return lo; }
    function at(s, out) {
      out = out || {};
      if (pts.length < 2) { const p = pts[0] || { x: 0, y: 0 }; out.x = p.x; out.y = p.y; out.dx = 1; out.dy = 0; out.seg = 0; return out; }
      s = Math.max(0, Math.min(length, s));
      const i = seg(s), a = pts[i], b = pts[i + 1], L = cum[i + 1] - cum[i] || 1, f = (s - cum[i]) / L;
      out.x = a.x + (b.x - a.x) * f; out.y = a.y + (b.y - a.y) * f; out.dx = (b.x - a.x) / L; out.dy = (b.y - a.y) / L; out.seg = i;
      return out;
    }
    function project(x, y) {
      let best = { s: 0, d: Infinity };
      for (let i = 0; i + 1 < pts.length; i++) {
        const a = pts[i], b = pts[i + 1], vx = b.x - a.x, vy = b.y - a.y, L2 = vx * vx + vy * vy || 1;
        const f = Math.max(0, Math.min(1, ((x - a.x) * vx + (y - a.y) * vy) / L2));
        const d = Math.hypot(a.x + vx * f - x, a.y + vy * f - y);
        if (d < best.d) best = { s: cum[i] + f * Math.sqrt(L2), d };
      }
      return best;
    }
    return { pts, cum, length, at, project };
  }

  const VEC = { up: [0, -1], right: [1, 0], down: [0, 1], left: [-1, 0] };
  /** Index of the item (with x, y) nearest to items[from] on that side; sideways distance
   *  counts double (like the E1 cursor's 'nearest' mode). -1 = nothing there. */
  function nearestInDirection(items, from, dir, ok) {
    const v = VEC[dir], o = items[from];
    if (!v || !o) return -1;
    let best = -1, bestScore = Infinity, bestAcross = Infinity;
    items.forEach((it, i) => {
      if (i === from || (ok && !ok(it, i))) return;
      const dx = it.x - o.x, dy = it.y - o.y, along = dx * v[0] + dy * v[1], across = Math.abs(dx * v[1] - dy * v[0]);
      if (along <= 0.5) return;
      const score = along + 2 * across;
      if (score < bestScore || (score === bestScore && across < bestAcross)) { best = i; bestScore = score; bestAcross = across; }
    });
    return best;
  }

  Object.assign(S, { Emitter, heap, polyline, nearestInDirection, VEC });
  if (typeof module !== 'undefined') module.exports = S;
})(typeof window !== 'undefined' ? window : globalThis);
