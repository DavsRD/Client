/* E7 SIMULATION ENGINE — SpatialHash: a dense bucket grid (25 px cells by default) over a bounded
 * world, rebuilt every frame in O(n) with linked lists in typed arrays (no garbage), so neighbour
 * queries for 200+ agents stay cheap. Ids are small integers (agent indices). Points outside the
 * world go in the edge cells; queries are exact (distance ≤ r). Pure. Tested in tests/sim.test.js. */
(function (root) {
  const AG = root.AG = root.AG || {};
  AG.logic = AG.logic || {};
  const S = AG.logic.sim = AG.logic.sim || {};

  class SpatialHash {
    /** o: { w, h (world px), cell: 25, capacity: 256 } */
    constructor(o) {
      o = o || {};
      this.cell = o.cell || 25; this.w = o.w || 480; this.h = o.h || 270;
      this.cols = Math.max(1, Math.ceil(this.w / this.cell)); this.rows = Math.max(1, Math.ceil(this.h / this.cell));
      this.head = new Int32Array(this.cols * this.rows).fill(-1);
      this.grow(o.capacity || 256);
      this.size = 0;
    }
    grow(cap) {
      const next = new Int32Array(cap), px = new Float32Array(cap), py = new Float32Array(cap);
      if (this.next) { next.set(this.next); px.set(this.px); py.set(this.py); }
      this.next = next; this.px = px; this.py = py; this.capacity = cap;
    }
    cx(x) { const c = Math.floor(x / this.cell); return c < 0 ? 0 : c >= this.cols ? this.cols - 1 : c; }
    cy(y) { const c = Math.floor(y / this.cell); return c < 0 ? 0 : c >= this.rows ? this.rows - 1 : c; }
    cellOf(x, y) { return this.cy(y) * this.cols + this.cx(x); }
    clear() { this.head.fill(-1); this.size = 0; return this; }
    /** Each id at most once per build (insert again only after clear()). */
    insert(id, x, y) {
      if (id >= this.capacity) this.grow(Math.max(id + 1, this.capacity * 2));
      const c = this.cellOf(x, y);
      this.px[id] = x; this.py[id] = y; this.next[id] = this.head[c]; this.head[c] = id; this.size++;
      return this;
    }
    /** Clears, then inserts ids 0..n-1 from coordinate arrays (skipping on[i] === 0 when given). */
    build(xs, ys, n, on) {
      this.clear();
      for (let i = 0; i < n; i++) if (!on || on[i]) this.insert(i, xs[i], ys[i]);
      return this;
    }
    /** Ids within r of x, y written into out (an array, reused); returns how many. skip = an id to leave out. */
    query(x, y, r, out, skip) {
      const r2 = r * r, x0 = this.cx(x - r), x1 = this.cx(x + r), y0 = this.cy(y - r), y1 = this.cy(y + r);
      let n = 0;
      for (let cy = y0; cy <= y1; cy++) for (let cx = x0; cx <= x1; cx++) {
        for (let id = this.head[cy * this.cols + cx]; id >= 0; id = this.next[id]) {
          if (id === skip) continue;
          const dx = this.px[id] - x, dy = this.py[id] - y;
          if (dx * dx + dy * dy <= r2) out[n++] = id;
        }
      }
      out.length = n;
      return n;
    }
    /** fn(id, dx, dy, d2) for every id within r (no array). */
    each(x, y, r, fn, skip) {
      const r2 = r * r, x0 = this.cx(x - r), x1 = this.cx(x + r), y0 = this.cy(y - r), y1 = this.cy(y + r);
      for (let cy = y0; cy <= y1; cy++) for (let cx = x0; cx <= x1; cx++) {
        for (let id = this.head[cy * this.cols + cx]; id >= 0; id = this.next[id]) {
          if (id === skip) continue;
          const dx = this.px[id] - x, dy = this.py[id] - y, d2 = dx * dx + dy * dy;
          if (d2 <= r2) fn(id, dx, dy, d2);
        }
      }
    }
    count(x, y, r) { let n = 0; this.each(x, y, r, () => { n++; }); return n; }
  }

  S.SpatialHash = SpatialHash;
  if (typeof module !== 'undefined') module.exports = S;
})(typeof window !== 'undefined' ? window : globalThis);
