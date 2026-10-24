/* Safe Crossing — traffic: vehicles on the road lanes, trains on the rail lanes, the walk
 * signals holding traffic at the zebra. Pure and seeded (tested in safe-crossing.test.js,
 * where a "wait-and-go" bot clones it to look ahead).
 *
 *   const traffic = new AG.safeCrossing.Traffic(course, { seed, difficulty })
 *   traffic.prewarm()                 the road is busy before the level starts
 *   traffic.update(dt, { slow(laneIndex, vehicle) → factor })   dt in seconds
 *   traffic.vehicles(i) → [{ kind, dir, len, x0, x1, v, stopped }]   (x in px, 0 = left edge)
 *   traffic.hit(i, x0, x1) → the moving vehicle overlapping that span, or null
 *   traffic.solid(i, col)  a parked or stopped vehicle fills that cell (you can't step in)
 *   traffic.barrierDown(i)  traffic.signal(group) → { phase, leftMs }   traffic.clone()
 *
 * Positions run along the direction of travel: u = 0 is where a vehicle enters (its front
 * at the edge), u = 480 + length is where it has left. Spawns use seeded gaps (in cells),
 * so the same seed gives the same traffic on every device. Jeepneys on a lane with
 * `stops` sometimes stop at the curb for 3–6 s; vehicles behind them queue. */
(function (root) {
  const AG = root.AG = root.AG || {};
  const SC = AG.safeCrossing = AG.safeCrossing || {};
  const W = 480, CELL = 30;

  const xRange = (dir, u, len) => (dir === 'R' ? [u - len, u] : [W - u, W - u + len]);

  function pickWeighted(rng, mix) {
    const keys = Object.keys(mix), total = keys.reduce((n, k) => n + mix[k], 0);
    let r = rng.next() * total;
    for (const k of keys) { r -= mix[k]; if (r < 0) return k; }
    return keys[keys.length - 1];
  }

  class VehicleLane {
    constructor(lane, group, o) {
      const T = SC.tuning;
      this.i = lane.i; this.dir = lane.dir === 'L' ? 'L' : 'R'; this.kind = 'road';
      this.speed = (lane.speed || 40) * o.diff.speed * (lane.school || (group && group.school) ? T.school : 1);
      this.mix = typeof lane.mix === 'object' ? lane.mix : T.mixes[lane.mix || 'light'] || T.mixes.light;
      this.gap = lane.gap || [3, 6]; this.gapMult = o.diff.gap;
      this.stops = !!lane.stops; this.zebra = group && group.zebra; this.sig = group && group.signal;
      this.rng = SC.rng(o.seed); this.list = []; this.ids = 0;
      this.nextGap = this.newGap();
    }
    newGap() { return Math.max(2 * CELL * this.gapMult, this.rng.int(this.gap[0], this.gap[1]) * CELL * this.gapMult); }
    /** The u a vehicle's front may not pass while traffic waits for pedestrians. */
    stopLine() {
      const z = this.zebra;
      return this.dir === 'R' ? z[0] * CELL - 2 : W - (z[1] + 1) * CELL - 2;
    }
    spawn(u) {
      const T = SC.tuning, kind = pickWeighted(this.rng, this.mix), len = (T.lengths[kind] || 2) * CELL;
      const v = { id: ++this.ids, kind, len, u, v: this.speed, stopUntil: 0, stopAt: null };
      if (this.stops && kind === 'jeepney' && this.rng.next() < T.jeepneyStop.p) {
        // a curb stop: two whole cells, clear of the zebra and its neighbours
        const ok = c => !this.zebra || c + 1 < this.zebra[0] - 1 || c > this.zebra[1] + 1;
        const cand = []; for (let c = 1; c <= 13; c++) if (ok(c)) cand.push(c);
        if (cand.length) {
          const c = cand[Math.floor(this.rng.next() * cand.length)];
          v.stopAt = this.dir === 'R' ? (c + 2) * CELL : W - c * CELL;
          v.stopMs = this.rng.int(T.jeepneyStop.minMs, T.jeepneyStop.maxMs);
        }
      }
      this.list.push(v);
      return v;
    }
    update(dt, t, env) {
      const T = SC.tuning, hold = this.sig && this.zebra && SC.signal.holds(this.sig, t);
      const stopU = hold ? this.stopLine() : null;
      let lead = null;
      for (const v of this.list) { // the list stays in spawn order: the leader comes first
        let nu = v.u;
        if (v.stopUntil > t) nu = v.u;
        else {
          const f = env && env.slow ? env.slow(this.i, v, this) : 1;
          nu = v.u + this.speed * f * dt;
          if (v.stopAt != null && v.u <= v.stopAt && nu >= v.stopAt) { nu = v.stopAt; v.stopAt = null; v.stopUntil = t + v.stopMs; }
        }
        if (stopU != null && v.u <= stopU + 0.01) nu = Math.min(nu, stopU);
        if (lead) nu = Math.min(nu, lead.u - lead.len - T.minGap);
        nu = Math.max(v.u, nu);
        v.v = dt > 0 ? (nu - v.u) / dt : 0;
        v.u = nu;
        lead = v;
      }
      while (this.list.length && this.list[0].u - this.list[0].len > W) this.list.shift();
      const last = this.list[this.list.length - 1];
      if (!last) this.spawn(0);
      else if (last.u - last.len >= this.nextGap) { this.spawn(last.u - last.len - this.nextGap); this.nextGap = this.newGap(); }
    }
    vehicles() {
      return this.list.map(v => { const [x0, x1] = xRange(this.dir, v.u, v.len); return { id: v.id, kind: v.kind, dir: this.dir, len: v.len, x0, x1, v: v.v, stopped: v.v < 0.5 }; });
    }
    clone() {
      const c = Object.create(VehicleLane.prototype);
      Object.assign(c, this); c.rng = this.rng.clone(); c.list = this.list.map(v => Object.assign({}, v));
      return c;
    }
  }

  /** A railway: a train every `every` ms (shifted by `offset`), the barrier down `warnMs`
   *  before it arrives until it has passed. */
  class RailLane {
    constructor(lane, o) {
      const R = SC.tuning.rail;
      this.i = lane.i; this.dir = lane.dir === 'L' ? 'L' : 'R'; this.kind = 'rail';
      this.len = R.cars * 120; this.speed = R.speed * o.diff.speed; this.warn = R.warnMs;
      this.passMs = (W + this.len) / this.speed * 1000;
      this.every = Math.max(lane.every || 12000, this.warn + this.passMs + 3000); this.offset = lane.offset || 0;
      this.t = 0;
    }
    p(t) { return (((t - this.offset) % this.every) + this.every) % this.every; }
    update(dt, t) { this.t = t; }
    passing(t) { return this.p(t == null ? this.t : t) < this.passMs; }
    barrierDown(t) { const p = this.p(t == null ? this.t : t); return p < this.passMs || p >= this.every - this.warn; }
    /** Which train this is (so "waited for the train" counts once per train). */
    trainNo(t) { const tt = t == null ? this.t : t; return Math.floor((tt - this.offset + this.warn) / this.every); }
    vehicles() {
      if (!this.passing()) return [];
      const u = this.speed * this.p(this.t) / 1000, [x0, x1] = xRange(this.dir, u, this.len);
      return [{ id: 'train', kind: 'train', dir: this.dir, len: this.len, x0, x1, v: this.speed, stopped: false }];
    }
    clone() { return Object.assign(Object.create(RailLane.prototype), this); }
  }

  class Traffic {
    constructor(course, o) {
      o = o || {};
      this.course = course; this.t = 0;
      const diff = SC.rules.diff(o.difficulty), seed = (o.seed >>> 0) || 1;
      this.lanes = new Array(course.H).fill(null);
      course.lanes.forEach((l, i) => {
        const g = course.groupAt(i), s = (seed + Math.imul(i + 1, 0x9e3779b1)) >>> 0;
        if (l.t === 'road') this.lanes[i] = new VehicleLane(l, g, { seed: s, diff });
        if (l.t === 'rail') this.lanes[i] = new RailLane(l, { diff });
      });
    }
    prewarm(seconds) {
      const s = seconds == null ? SC.tuning.prewarmS : seconds, step = 1 / 30;
      this.t = -s * 1000;
      for (let k = 0; k < s * 30; k++) this.update(step);
      this.t = 0;
      this.lanes.forEach(L => { if (L) L.update(0, 0); });
      return this;
    }
    update(dt, env) {
      this.t += dt * 1000;
      for (const L of this.lanes) if (L) L.update(dt, this.t, env);
      return this;
    }
    vehicles(i) { const L = this.lanes[i]; return L ? L.vehicles() : []; }
    hit(i, x0, x1) {
      const inset = SC.tuning.vehicleInset;
      for (const v of this.vehicles(i)) if (!v.stopped && v.x0 + inset < x1 && v.x1 - inset > x0) return v;
      return null;
    }
    solid(i, c) {
      if (this.course.parked(i, c)) return true;
      const a = c * CELL + 4, b = c * CELL + CELL - 4;
      return this.vehicles(i).some(v => v.stopped && v.x0 < b && v.x1 > a);
    }
    barrierDown(i) { const L = this.lanes[i]; return !!(L && L.kind === 'rail' && L.barrierDown()); }
    rail(i) { const L = this.lanes[i]; return L && L.kind === 'rail' ? L : null; }
    signal(g) { return g && g.signal ? SC.signal.phase(g.signal, this.t) : null; }
    clone() {
      const c = Object.create(Traffic.prototype);
      c.course = this.course; c.t = this.t; c.lanes = this.lanes.map(L => (L ? L.clone() : null));
      return c;
    }
  }

  SC.VehicleLane = VehicleLane; SC.RailLane = RailLane; SC.Traffic = Traffic; SC.xRange = xRange;
  if (typeof module !== 'undefined') module.exports = { VehicleLane, RailLane, Traffic };
})(typeof window !== 'undefined' ? window : globalThis);
