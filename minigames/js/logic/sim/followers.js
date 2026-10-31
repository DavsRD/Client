/* E7 SIMULATION ENGINE — PathFollowers: tower-defense style units (mud flows, water) moving along
 * polylines by arc length. Slow zones (circles or rects, the strongest one wins) scale their speed;
 * blockers with HP (a sandbag wall, a planted tree line) stop the units that reach them, and those
 * units wear the blocker down (dps each) until it breaks. Units keep `spacing` px behind the unit
 * ahead on the same path. Pure (no DOM); AG.sim.FollowersView draws it. Tested in tests/sim.test.js. */
(function (root) {
  const AG = root.AG = root.AG || {};
  AG.logic = AG.logic || {};
  const S = AG.logic.sim = AG.logic.sim || {};

  const inZone = (z, x, y) => (z.r != null ? (x - z.x) * (x - z.x) + (y - z.y) * (y - z.y) <= z.r * z.r : x >= z.x && y >= z.y && x < z.x + z.w && y < z.y + z.h);

  class PathFollowers extends S.Emitter {
    /** o: { paths: { id: [{ x, y }, …] } | [[…], …], speed: 30, dps: 1, gap: 4, spacing: 0, minMul: 0.1,
     *       slowZones: [{ id?, x, y, r | w, h, mul }], blockers: [{ id?, path?, s | x, y, hp }] } */
    constructor(o) {
      super();
      o = o || {};
      this.o = o; this.speed = o.speed || 30; this.dps = o.dps == null ? 1 : o.dps; this.gap = o.gap == null ? 4 : o.gap;
      this.spacing = o.spacing || 0; this.minMul = o.minMul == null ? 0.1 : o.minMul;
      this.paths = new Map(); this.units = []; this.zones = []; this.blockers = []; this.serial = 0; this.arrivedCount = 0;
      const ps = o.paths || {};
      (Array.isArray(ps) ? ps.map((p, i) => [i, p]) : Object.entries(ps)).forEach(([id, pts]) => this.addPath(id, pts));
      (o.slowZones || []).forEach(z => this.addSlowZone(z));
      (o.blockers || []).forEach(b => this.addBlocker(b));
    }
    addPath(id, points) { const p = S.polyline(points); p.id = String(id); this.paths.set(String(id), p); return p; }
    path(id) { return this.paths.get(String(id)) || null; }

    /** o: { path, speed?, hp?, dps?, s?, data? } → the unit { id, path, s, x, y, dx, dy, mul, state: 'move'|'blocked', … } */
    spawn(o) {
      o = o || {};
      const pid = String(o.path != null ? o.path : this.paths.keys().next().value), p = this.path(pid);
      if (!p) throw new Error('PathFollowers: unknown path ' + pid);
      const u = Object.assign({ speed: this.speed, dps: this.dps, hp: 1, data: null }, o, { id: o.id != null ? o.id : 'u' + (++this.serial), path: pid, s: o.s || 0, mul: 1, state: 'move', blocker: null });
      p.at(u.s, u);
      this.units.push(u);
      this.emit('spawn', u);
      return u;
    }
    remove(u) { const i = this.units.indexOf(u); if (i >= 0) { this.units.splice(i, 1); this.emit('remove', u); } }
    /** Damages a unit; at 0 hp it is removed ('defeat'). */
    hurt(u, n) { u.hp -= n; if (u.hp <= 0 && this.units.includes(u)) { this.remove(u); this.emit('defeat', u); } }

    addSlowZone(z) { const zz = Object.assign({ mul: 0.5 }, z, { id: z.id != null ? z.id : 'z' + (++this.serial) }); this.zones.push(zz); return zz; }
    removeSlowZone(id) { this.zones = this.zones.filter(z => z.id !== id && z !== id); }
    /** The speed factor at x, y: the slowest zone there (1 when none), never below minMul. */
    mulAt(x, y) { let m = 1; for (const z of this.zones) if (z.mul < m && inZone(z, x, y)) m = z.mul; return Math.max(this.minMul, m); }

    /** b: { id?, path? (one path; default every path it lies on), s? | x, y (snapped onto paths within reach: 12 px), hp: 10 }.
     *  b.at = { pathId: s } where it stands on each path. */
    addBlocker(b) {
      const bb = Object.assign({ hp: 10, reach: 12 }, b, { id: b.id != null ? b.id : 'b' + (++this.serial), at: {} });
      bb.maxHp = b.maxHp || bb.hp;
      this.paths.forEach((p, pid) => {
        if (bb.path != null && String(bb.path) !== pid) return;
        if (bb.s != null) { bb.at[pid] = bb.s; return; }
        const hit = p.project(bb.x, bb.y);
        if (hit.d <= bb.reach) bb.at[pid] = hit.s;
      });
      if (bb.x == null) { const pid = Object.keys(bb.at)[0]; if (pid != null) { const pt = this.path(pid).at(bb.at[pid]); bb.x = pt.x; bb.y = pt.y; } }
      this.blockers.push(bb);
      return bb;
    }
    removeBlocker(ref) {
      const b = this.blockers.find(x => x === ref || x.id === ref);
      if (!b) return false;
      this.blockers.splice(this.blockers.indexOf(b), 1);
      this.units.forEach(u => { if (u.blocker === b) { u.blocker = null; u.state = 'move'; } });
      return true;
    }
    /** The first blocker on path pid at or ahead of s. */
    blockerAhead(pid, s) {
      let best = null, bs = Infinity;
      for (const b of this.blockers) { const at = b.at[pid]; if (at != null && at >= s - 0.001 && at < bs) { bs = at; best = b; } }
      return best;
    }

    update(dt) {
      if (!(dt > 0)) return this;
      const lead = new Map(); // per path: the s of the unit just ahead (units are walked front to back)
      const order = this.units.slice().sort((a, b) => b.s - a.s);
      for (const u of order) {
        if (!this.units.includes(u)) continue;
        const p = this.path(u.path);
        u.mul = this.mulAt(u.x, u.y);
        let s = u.s + u.speed * u.mul * dt;
        const b = this.blockerAhead(u.path, u.s); // a blocker dropped right on a unit's nose stops it too
        const bLimit = b ? b.at[u.path] - this.gap : Infinity;
        const lLimit = this.spacing && lead.has(u.path) ? lead.get(u.path) - this.spacing : Infinity;
        if (s >= bLimit && bLimit <= lLimit) {
          s = Math.max(u.s, bLimit);
          if (u.blocker !== b) { u.blocker = b; u.state = 'blocked'; this.emit('blocked', { unit: u, blocker: b }); }
          b.hp -= u.dps * dt;
          if (b.hp <= 0 && this.blockers.includes(b)) { this.removeBlocker(b); this.emit('break', b); }
        } else if (s >= lLimit) { s = Math.max(u.s, lLimit); u.state = 'wait'; u.blocker = null; }
        else if (u.state !== 'move') { u.state = 'move'; u.blocker = null; }
        u.s = s;
        lead.set(u.path, u.s);
        if (u.s >= p.length) { this.remove(u); this.arrivedCount++; this.emit('arrive', u); continue; }
        p.at(u.s, u);
      }
      return this;
    }
  }

  S.PathFollowers = PathFollowers;
  if (typeof module !== 'undefined') module.exports = S;
})(typeof window !== 'undefined' ? window : globalThis);
