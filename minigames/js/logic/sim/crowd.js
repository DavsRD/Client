/* E7 SIMULATION ENGINE — Crowd: up to `max` agents in typed arrays with Reynolds steering (seek,
 * arrive, separation, alignment, follow a FlowField, avoid walls) over a SpatialHash rebuilt each
 * update; walls never let an agent through (axis-separated collision). FpsGovernor watches real frame
 * times and says when to cut the crowd by 25 % (fps < 45 for 3 s). Pure (no DOM); AG.sim.CrowdView
 * draws it. Tested in kalasag-dev/minigames/tests/sim.test.js. Docs: docs/engines/sim.md */
(function (root) {
  const AG = root.AG = root.AG || {};
  AG.logic = AG.logic || {};
  const S = AG.logic.sim = AG.logic.sim || {};

  const WEIGHTS = { seek: 0, arrive: 0, separation: 1.6, alignment: 0.25, flow: 1, walls: 2.5 };
  /* 8 wall feelers around the agent */
  const FEEL = Array.from({ length: 8 }, (_, k) => [Math.cos(k * Math.PI / 4), Math.sin(k * Math.PI / 4)]);

  class Crowd extends S.Emitter {
    /** o: { max: 200, w, h, cell: 25, speed: 40 (px/s), force: 160 (px/s²), radius: 3, sepRadius: 8,
     *       alignRadius: 16, arriveRadius: 24, arriveDist: 4, feel: 8, weights, flow, solid(x, y) → bool,
     *       groups: [{ speed?, weights?, flow? }], speedAt(x, y, i) → factor, despawn: false, seed: 1 } */
    constructor(o) {
      super();
      o = o || {};
      this.o = o; this.max = o.max || 200; this.w = o.w || 480; this.h = o.h || 270;
      this.speed = o.speed || 40; this.force = o.force || 160; this.radius = o.radius == null ? 3 : o.radius;
      this.sepRadius = o.sepRadius || 8; this.alignRadius = o.alignRadius || 16; this.arriveRadius = o.arriveRadius || 24;
      this.arriveDist = o.arriveDist || 4; this.feel = o.feel || 8;
      this.weights = Object.assign({}, WEIGHTS, o.weights);
      this.flow = o.flow || null; this.solid = o.solid || null; this.speedAt = o.speedAt || null; this.despawn = !!o.despawn;
      this.groups = (o.groups || []).map(g => Object.assign({}, g, { weights: Object.assign({}, this.weights, g.weights) }));
      const n = this.max, F = () => new Float32Array(n), U = () => new Uint8Array(n);
      this.x = F(); this.y = F(); this.vx = F(); this.vy = F(); this.tx = F(); this.ty = F(); this.mul = F();
      this.alive = U(); this.hasT = U(); this.group = U(); this.arrived = U();
      this.n = 0; this.active = 0; this.limitTo = n;
      this.hash = new S.SpatialHash({ w: this.w, h: this.h, cell: o.cell || 25, capacity: n });
      this.near = []; this.tmp = {};
      let seed = (o.seed == null ? 1 : o.seed) >>> 0; // small LCG: the same speed spread on every device
      this.rnd = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
    }
    get count() { return this.active; }
    /** → the agent's index, or -1 when the crowd is full (or reduced). o: { group, target: { x, y }, vx, vy, mul } */
    spawn(x, y, o) {
      o = o || {};
      if (this.active >= this.limitTo) return -1;
      let i = 0;
      while (i < this.max && this.alive[i]) i++;
      if (i >= this.max) return -1;
      this.x[i] = x; this.y[i] = y; this.vx[i] = o.vx || 0; this.vy[i] = o.vy || 0;
      this.mul[i] = o.mul != null ? o.mul : 0.85 + this.rnd() * 0.3;
      this.group[i] = o.group || 0; this.alive[i] = 1; this.arrived[i] = 0; this.hasT[i] = 0;
      if (o.target) this.setTarget(i, o.target.x, o.target.y);
      this.active++; if (i >= this.n) this.n = i + 1;
      return i;
    }
    remove(i) { if (!this.alive[i]) return; this.alive[i] = 0; this.active--; this.emit('remove', i); }
    setTarget(i, x, y) { this.tx[i] = x; this.ty[i] = y; this.hasT[i] = 1; this.arrived[i] = 0; }
    clearTarget(i) { this.hasT[i] = 0; }
    each(fn) { for (let i = 0; i < this.n; i++) if (this.alive[i]) fn(i); }
    /** Keeps at most count agents (the newest go first) and spawns no more than that. */
    limit(count) {
      const from = this.active;
      this.limitTo = Math.max(0, Math.min(this.max, Math.round(count)));
      for (let i = this.n - 1; i >= 0 && this.active > this.limitTo; i--) if (this.alive[i]) this.remove(i);
      if (this.active < from) this.emit('reduce', { from, to: this.active });
      return this.active;
    }
    /** Agents within r px of x, y (uses the hash from the last update). */
    density(x, y, r) { return this.hash.count(x, y, r); }
    blocked(x, y) { return !!this.solid && this.solid(x, y); }

    update(dt) {
      if (!(dt > 0)) return this;
      const { x, y, vx, vy, alive, near, tmp } = this, R = Math.max(this.sepRadius, this.alignRadius);
      this.hash.build(x, y, this.n, alive);
      for (let i = 0; i < this.n; i++) {
        if (!alive[i]) continue;
        const G = this.groups[this.group[i]], W = G ? G.weights : this.weights, flow = (G && G.flow) || this.flow;
        const maxV = ((G && G.speed) || this.speed) * this.mul[i] * (this.speedAt ? this.speedAt(x[i], y[i], i) : 1);
        let fx = 0, fy = 0;
        if (this.hasT[i]) {
          const dx = this.tx[i] - x[i], dy = this.ty[i] - y[i], d = Math.hypot(dx, dy);
          if (d < this.arriveDist && !this.arrived[i]) { this.arrived[i] = 1; this.emit('arrive', i); if (this.despawn) { this.remove(i); continue; } }
          if (d > 0.001) {
            if (W.seek) { fx += W.seek * (dx / d * maxV - vx[i]); fy += W.seek * (dy / d * maxV - vy[i]); }
            if (W.arrive) { const s = d < this.arriveRadius ? maxV * d / this.arriveRadius : maxV; fx += W.arrive * (dx / d * s - vx[i]); fy += W.arrive * (dy / d * s - vy[i]); }
          }
        }
        if (flow && W.flow) {
          const cx = Math.floor(x[i] / flow.cell), cy = Math.floor(y[i] / flow.cell);
          if (flow.distAt(cx, cy) === 0 && !this.arrived[i]) { this.arrived[i] = 1; this.emit('arrive', i); if (this.despawn) { this.remove(i); continue; } }
          flow.sample(x[i], y[i], tmp);
          fx += W.flow * (tmp.x * maxV - vx[i]); fy += W.flow * (tmp.y * maxV - vy[i]);
        }
        if (W.separation || W.alignment) {
          const k = this.hash.query(x[i], y[i], R, near, i);
          let px = 0, py = 0, ax = 0, ay = 0, na = 0;
          for (let m = 0; m < k; m++) {
            const j = near[m];
            let dx = x[i] - x[j], dy = y[i] - y[j];
            let d = Math.hypot(dx, dy);
            if (d < 0.01) { const sg = i < j ? -1 : 1; dx = sg; dy = sg * (((i + j) % 3) - 1); d = Math.hypot(dx, dy); } // stacked: split them (opposite ways)
            if (d < this.sepRadius) { const s = (1 - d / this.sepRadius) / d; px += dx * s; py += dy * s; }
            if (d < this.alignRadius) { ax += vx[j]; ay += vy[j]; na++; }
          }
          const L = Math.hypot(px, py);
          if (L > 0 && W.separation) { const s = maxV * Math.min(1, L) / L; fx += W.separation * (px * s - vx[i]); fy += W.separation * (py * s - vy[i]); }
          const A = Math.hypot(ax, ay);
          if (na && A > 0.01 && W.alignment) { fx += W.alignment * (ax / A * maxV - vx[i]); fy += W.alignment * (ay / A * maxV - vy[i]); }
        }
        if (this.solid && W.walls) {
          let wx = 0, wy = 0;
          for (let k = 0; k < 8; k++) if (this.solid(x[i] + FEEL[k][0] * this.feel, y[i] + FEEL[k][1] * this.feel)) { wx -= FEEL[k][0]; wy -= FEEL[k][1]; }
          const L = Math.hypot(wx, wy);
          if (L > 0) { fx += W.walls * (wx / L * maxV - vx[i]); fy += W.walls * (wy / L * maxV - vy[i]); }
        }
        const F = Math.hypot(fx, fy);
        if (F > this.force) { fx *= this.force / F; fy *= this.force / F; }
        vx[i] += fx * dt; vy[i] += fy * dt;
        const V = Math.hypot(vx[i], vy[i]);
        if (V > maxV) { vx[i] *= maxV / V; vy[i] *= maxV / V; }
        this.move(i, dt);
      }
      return this;
    }
    /** Moves one agent, sliding along walls (x then y) and staying inside the world. */
    move(i, dt) {
      const { x, y, vx, vy } = this, r = this.radius;
      const stuck = this.blocked(x[i], y[i]); // spawned inside a wall: let it walk out
      let nx = x[i] + vx[i] * dt;
      if (!stuck && vx[i] && this.blocked(nx + Math.sign(vx[i]) * r, y[i])) { nx = x[i]; vx[i] = 0; }
      let ny = y[i] + vy[i] * dt;
      if (!stuck && vy[i] && this.blocked(nx, ny + Math.sign(vy[i]) * r)) { ny = y[i]; vy[i] = 0; }
      x[i] = Math.max(r, Math.min(this.w - r, nx)); y[i] = Math.max(r, Math.min(this.h - r, ny));
    }
    /** solid(x, y) for a grid of cell px: walls are cells where passable(cx, cy) is false (outside = wall). */
    static solidFromGrid(grid, cell) {
      return (px, py) => { const cx = Math.floor(px / cell), cy = Math.floor(py / cell); return cx < 0 || cy < 0 || cx >= grid.w || cy >= grid.h || !grid.passable(cx, cy); };
    }
  }

  class FpsGovernor extends S.Emitter {
    /** o: { min: 45, holdMs: 3000, factor: 0.75, smooth: 0.15 }. Feed real frame times, once per drawn frame. */
    constructor(o) {
      super();
      this.o = o || {};
      this.min = this.o.min || 45; this.holdMs = this.o.holdMs || 3000; this.factor = this.o.factor || 0.75; this.smooth = this.o.smooth || 0.15;
      this.fps = 60; this.lowMs = 0; this.last = null; this.reductions = 0;
    }
    /** One frame that took ms. → true when the fps has been under min for holdMs (then the count restarts).
     *  Gaps over 250 ms (a pause, a hidden tab) are ignored. */
    frame(ms) {
      if (!(ms > 0) || ms > 250) return false;
      this.fps += (1000 / ms - this.fps) * this.smooth;
      this.lowMs = this.fps < this.min ? this.lowMs + ms : 0;
      if (this.lowMs < this.holdMs) return false;
      this.lowMs = 0; this.reductions++;
      this.emit('reduce', { fps: this.fps, factor: this.factor, reductions: this.reductions });
      return true;
    }
    /** frame() from a timestamp (performance.now()). */
    tick(now) { const ms = this.last == null ? 0 : now - this.last; this.last = now; return this.frame(ms); }
  }

  Object.assign(S, { Crowd, FpsGovernor });
  if (typeof module !== 'undefined') module.exports = S;
})(typeof window !== 'undefined' ? window : globalThis);
