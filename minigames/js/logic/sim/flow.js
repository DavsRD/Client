/* E7 SIMULATION ENGINE — FlowField: a distance field from the goal cells (a wavefront like BFS;
 * with diagonal: true, steps cost 10 straight / 14 diagonal and never cut a wall corner), then one
 * unit direction per cell toward its cheapest neighbour (tied neighbours are averaged, so open
 * ground points straight at the goal, not in 45° zig-zags), sampled bilinearly at any pixel.
 * A grid is { w, h, passable(cx, cy) } (an E1 TileMap or gridPath.fromRows works). Pure; tests/sim.test.js. */
(function (root) {
  const AG = root.AG = root.AG || {};
  AG.logic = AG.logic || {};
  const S = AG.logic.sim = AG.logic.sim || {};

  /* neighbours: 4 straight first, then 4 diagonal (dx, dy, cost) */
  const N8 = [[0, -1, 10], [1, 0, 10], [0, 1, 10], [-1, 0, 10], [1, -1, 14], [1, 1, 14], [-1, 1, 14], [-1, -1, 14]];

  class FlowField {
    /** o: { grid | (w, h, passable), cell: 20 (px per cell), diagonal: true, goals: [{ x, y }] (cells) } */
    constructor(o) {
      o = o || {};
      const g = o.grid || o;
      this.w = g.w; this.h = g.h; this.passable = g.passable.bind(g);
      this.cell = o.cell || 20; this.diagonal = o.diagonal !== false;
      this.dist = new Int32Array(this.w * this.h); this.dx = new Float32Array(this.w * this.h); this.dy = new Float32Array(this.w * this.h);
      this.goals = [];
      if (o.goals) this.compute(o.goals);
    }
    inside(x, y) { return x >= 0 && y >= 0 && x < this.w && y < this.h; }
    open(x, y) { return this.inside(x, y) && this.passable(x, y); }
    /** Recomputes the field (call again after walls change). goals default to the last ones. */
    compute(goals) {
      if (goals) this.goals = [].concat(goals);
      const { w, h, dist } = this, q = S.heap(), K = this.diagonal ? 8 : 4;
      dist.fill(-1);
      this.goals.forEach(g => { if (this.inside(g.x, g.y)) { dist[g.y * w + g.x] = 0; q.push(0, g.y * w + g.x); } });
      const done = new Uint8Array(w * h);
      while (q.size) {
        const i = q.pop();
        if (done[i]) continue;
        done[i] = 1;
        const x = i % w, y = (i - x) / w, d = dist[i];
        for (let k = 0; k < K; k++) {
          const nx = x + N8[k][0], ny = y + N8[k][1];
          if (!this.open(nx, ny)) continue;
          if (k >= 4 && !(this.open(x + N8[k][0], y) && this.open(x, y + N8[k][1]))) continue; // no corner cutting
          const j = ny * w + nx, nd = d + N8[k][2];
          if (dist[j] < 0 || nd < dist[j]) { dist[j] = nd; q.push(nd, j); }
        }
      }
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) this.solveCell(x, y);
      return this;
    }
    solveCell(x, y) {
      const { w, dist } = this, i = y * w + x, K = this.diagonal ? 8 : 4;
      this.dx[i] = 0; this.dy[i] = 0;
      if (dist[i] <= 0) return; // a goal, a wall or unreachable
      let best = Infinity, sx = 0, sy = 0, first = -1;
      for (let k = 0; k < K; k++) {
        const nx = x + N8[k][0], ny = y + N8[k][1];
        if (!this.inside(nx, ny)) continue;
        const dn = dist[ny * w + nx];
        if (dn < 0) continue;
        if (k >= 4 && !(this.open(x + N8[k][0], y) && this.open(x, y + N8[k][1]))) continue;
        const via = dn + N8[k][2], len = k >= 4 ? Math.SQRT2 : 1;
        if (via < best) { best = via; sx = 0; sy = 0; first = k; }
        if (via === best) { sx += N8[k][0] / len; sy += N8[k][1] / len; }
      }
      let L = Math.hypot(sx, sy);
      // a saddle (as short going left as right, under a wall) would cancel out: take the first best step
      if (L < 0.5 && first >= 0) { sx = N8[first][0]; sy = N8[first][1]; L = Math.hypot(sx, sy); }
      if (L > 0) { this.dx[i] = sx / L; this.dy[i] = sy / L; }
    }

    /** The cell's own unit direction ({ x: 0, y: 0 } at goals, walls and unreachable cells). */
    dirAt(cx, cy) { if (!this.inside(cx, cy)) return { x: 0, y: 0 }; const i = cy * this.w + cx; return { x: this.dx[i], y: this.dy[i] }; }
    /** Steps to the nearest goal (straight steps = 1, diagonal 1.4), -1 = unreachable. */
    distAt(cx, cy) { if (!this.inside(cx, cy)) return -1; const d = this.dist[cy * this.w + cx]; return d < 0 ? -1 : d / 10; }
    cellAt(px, py) { return { x: Math.floor(px / this.cell), y: Math.floor(py / this.cell) }; }
    /** Bilinear blend of the four nearest cell-centre directions at pixel px, py; normalised
     *  (raw = true keeps the blended length). Writes into out when given. */
    sample(px, py, out, raw) {
      out = out || {};
      const gx = px / this.cell - 0.5, gy = py / this.cell - 0.5;
      const x0 = Math.floor(gx), y0 = Math.floor(gy), fx = gx - x0, fy = gy - y0;
      let vx = 0, vy = 0;
      for (let k = 0; k < 4; k++) {
        const cx = Math.min(this.w - 1, Math.max(0, x0 + (k & 1))), cy = Math.min(this.h - 1, Math.max(0, y0 + (k >> 1)));
        const wgt = ((k & 1) ? fx : 1 - fx) * ((k >> 1) ? fy : 1 - fy), i = cy * this.w + cx;
        vx += this.dx[i] * wgt; vy += this.dy[i] * wgt;
      }
      const L = Math.hypot(vx, vy);
      if (raw || L === 0) { out.x = vx; out.y = vy; }
      else { out.x = vx / L; out.y = vy / L; }
      return out;
    }
  }

  S.FlowField = FlowField;
  if (typeof module !== 'undefined') module.exports = S;
})(typeof window !== 'undefined' ? window : globalThis);
