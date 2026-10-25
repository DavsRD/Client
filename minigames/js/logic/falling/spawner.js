/* E4 FALLING ENGINE — Spawner, pure (no DOM). Tested in kalasag-dev/minigames/tests/falling.test.js.
 * Docs: kalasag-dev/minigames/docs/engines/falling.md
 *
 *   const sp = new AG.logic.falling.Spawner({ defs, minX: 8, maxX: 472, safeGap: 40, rng, jitter: 0.2,
 *                                             cooldown: { powerup: 20000 }, hitScale: 0.8 });
 *   sp.update(dtMs, live, { spawnIntervalMs, fallSpeed, table }) → [new objects]
 *   sp.schedule(atMs, id, { x })   a spawn at that time on the spawner's clock (photos, set pieces)
 *   sp.place(def, live) → x | null  sp.pick(table, exclude) → def   sp.intervalMul (0.5 = twice as many)
 *
 * Def: { id, kind: 'bad'|'good'|'powerup'|'collectible'|'neutral', icon, size, speedMul, drift?: { amp, freq },
 * shadowWarnMs?, points?, power? }. SAFE GAP: a new bad object is placed so the clear space between its
 * hitbox (widened by its drift) and every live bad object's is ≥ safeGap px; with no room left, the spawn
 * becomes a non-bad pick from the table, or is skipped (sp.skipped counts them). */
(function (root) {
  const AG = root.AG = root.AG || {};
  AG.logic = AG.logic || {};

  const KINDS = ['bad', 'good', 'powerup', 'collectible', 'neutral'];

  function def(d) {
    const o = Object.assign({ kind: 'neutral', size: 16, speedMul: 1, shadowWarnMs: 0, points: 0 }, d);
    if (!KINDS.includes(o.kind)) o.kind = 'neutral';
    if (o.drift && !o.drift.amp) o.drift = null;
    return o;
  }
  /** Defs as an id → def map, from an array or a map. */
  function defs(list) {
    const out = {};
    (Array.isArray(list) ? list : Object.keys(list || {}).map(id => Object.assign({ id }, list[id]))).forEach(d => { out[d.id] = def(d); });
    return out;
  }
  /** A weight table as [{ id, w }]: from { id: w }, [{ id, w | weight }], [[id, w]] or [id, …]. */
  function table(t) {
    if (!t) return [];
    if (!Array.isArray(t)) return Object.keys(t).map(id => ({ id, w: +t[id] || 0 })).filter(e => e.w > 0);
    return t.map(e => (typeof e === 'string' ? { id: e, w: 1 } : Array.isArray(e) ? { id: e[0], w: +e[1] } : { id: e.id, w: +(e.w != null ? e.w : e.weight != null ? e.weight : 1) }))
      .filter(e => e.w > 0);
  }
  function weightedPick(tbl, rng, ok) {
    const list = table(tbl).filter(e => !ok || ok(e.id));
    const total = list.reduce((s, e) => s + e.w, 0);
    if (!total) return null;
    let u = rng() * total;
    for (const e of list) { u -= e.w; if (u < 0) return e.id; }
    return list[list.length - 1].id;
  }
  /** Hit radius (80 % of the icon size is the diameter) and the half-width an object can sweep. */
  const radius = (d, hitScale) => d.size * (hitScale == null ? 0.8 : hitScale) / 2;
  const reach = (d, hitScale) => radius(d, hitScale) + (d.drift ? Math.abs(d.drift.amp) : 0);

  /** The clear horizontal space between two objects' hitboxes (drift included). */
  function gapBetween(a, b, hitScale) { return Math.abs(a.x0 - b.x0) - reach(a.def, hitScale) - reach(b.def, hitScale); }

  class Spawner {
    constructor(o) {
      o = o || {};
      this.defs = defs(o.defs);
      this.minX = o.minX == null ? 8 : o.minX; this.maxX = o.maxX == null ? 472 : o.maxX;
      this.safeGap = o.safeGap == null ? 40 : o.safeGap;
      this.hitScale = o.hitScale == null ? 0.8 : o.hitScale;
      this.rng = o.rng || Math.random; this.jitter = o.jitter == null ? 0.2 : o.jitter;
      this.cooldown = Object.assign({}, o.cooldown); this.lastAt = {};
      this.intervalMul = 1; this.clock = 0; this.next = o.firstDelayMs == null ? 400 : o.firstDelayMs;
      this.queue = []; this.skipped = 0; this.seq = 0;
    }
    onCooldown(d) {
      return [d.id, d.kind].some(k => this.cooldown[k] && this.lastAt[k] != null && this.clock - this.lastAt[k] < this.cooldown[k]);
    }
    pick(tbl, exclude) {
      const id = weightedPick(tbl, this.rng, id => this.defs[id] && !this.onCooldown(this.defs[id]) && !(exclude && exclude(this.defs[id])));
      return id ? this.defs[id] : null;
    }
    /** A random x where the def fits; for a bad def only where the safe gap holds. null = no room. */
    place(d, live) {
      const h = reach(d, this.hitScale), lo = this.minX + h, hi = this.maxX - h;
      if (hi < lo) return null;
      let free = [[lo, hi]];
      if (d.kind === 'bad') {
        for (const b of live || []) {
          if (b.def.kind !== 'bad' || b.done) continue;
          const block = h + reach(b.def, this.hitScale) + this.safeGap;
          const a = b.x0 - block, z = b.x0 + block, next = [];
          for (const [s, e] of free) {
            if (z <= s || a >= e) { next.push([s, e]); continue; }
            if (a > s) next.push([s, a]);
            if (z < e) next.push([z, e]);
          }
          free = next;
        }
      }
      // whole-pixel x only, so rounding can never eat into the gap
      const spots = free.map(([a, z]) => [Math.ceil(a), Math.floor(z)]).filter(([a, z]) => a <= z);
      const total = spots.reduce((s, [a, z]) => s + (z - a + 1), 0);
      if (!total) return null;
      let u = Math.floor(this.rng() * total);
      for (const [a, z] of spots) { if (u <= z - a) return a + u; u -= z - a + 1; }
      return spots[spots.length - 1][1];
    }
    /** A new object record (pure data; the engine moves and draws it). */
    make(d, x, fallSpeed) {
      this.lastAt[d.id] = this.lastAt[d.kind] = this.clock;
      const r = radius(d, this.hitScale);
      return {
        uid: ++this.seq, id: d.id, def: d, kind: d.kind, x0: x, x, y: -d.size / 2, r,
        vy: (fallSpeed || 120) * (d.speedMul || 1), age: 0,
        warnMs: d.shadowWarnMs || 0, warnLeft: d.shadowWarnMs || 0, phase: d.shadowWarnMs ? 'warn' : 'fall',
        drift: d.drift ? { amp: d.drift.amp, freq: d.drift.freq || 1, phase: this.rng() * Math.PI * 2 } : null, done: false
      };
    }
    schedule(atMs, id, o) { this.queue.push(Object.assign({ at: atMs, id }, o)); this.queue.sort((a, b) => a.at - b.at); return this; }
    spawnOne(tbl, live, fallSpeed) {
      let d = this.pick(tbl);
      if (!d) return null;
      let x = this.place(d, live);
      if (x == null && d.kind === 'bad') { // no safe room: something harmless instead, or nothing
        d = this.pick(tbl, dd => dd.kind === 'bad');
        x = d ? this.place(d, live) : null;
      }
      if (x == null) { this.skipped++; return null; }
      return this.make(d, x, fallSpeed);
    }
    update(dtMs, live, wave) {
      wave = wave || {};
      live = live ? live.slice() : [];
      const out = [], speed = wave.fallSpeed;
      this.clock += dtMs;
      while (this.queue.length && this.queue[0].at <= this.clock) {
        const q = this.queue.shift(), d = this.defs[q.id];
        if (!d) continue;
        const x = q.x != null ? q.x : this.place(d, live);
        if (x == null) { this.queue.unshift(Object.assign(q, { at: this.clock + 100 })); break; } // wait for room
        const ob = this.make(d, x, q.fallSpeed || speed); out.push(ob); live.push(ob);
      }
      if (!wave.table) return out;
      this.next -= dtMs;
      let guard = 0;
      while (this.next <= 0 && guard++ < 8) {
        const ob = this.spawnOne(wave.table, live, speed);
        if (ob) { out.push(ob); live.push(ob); }
        const base = (wave.spawnIntervalMs || 800) * this.intervalMul;
        this.next += Math.max(30, base * (1 + this.jitter * (this.rng() * 2 - 1)));
      }
      return out;
    }
  }

  const api = { Spawner, def, defs, table, weightedPick, radius, reach, gapBetween, KINDS };
  AG.logic.falling = Object.assign(AG.logic.falling || {}, api);
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
