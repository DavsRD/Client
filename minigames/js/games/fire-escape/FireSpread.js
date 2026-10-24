/* Fire Escape Maze — spreading fire (level 4). Pure (no DOM), tested in fire-escape.test.js.
 *
 *   const fire = new AG.fireEscape.FireSpread({
 *     w, h, isFloor(x, y), passable(x, y),   // floor = may burn; passable = walkable now (fire aside)
 *     fires: [{ x, y }], protect: ['x,y', …], goal: { x, y }, rnd, p: 0.5, emberP, maxEmbers
 *   });
 *   fire.step({ player: { x, y }, keep: [{ x, y }] }) → { ignited: [{ x, y }], embers: [{ x, y }] }
 *   fire.has(x, y)  fire.ember(x, y)  fire.takeEmber(x, y)  fire.list()
 *
 * Every step each fire tile (in a fixed order) has a p chance to ignite ONE random floor
 * neighbour. Never the protected tiles (exit, start, checkpoints, the assembly area), never
 * the player's tile, and never a tile that would cut EVERY path from the player (and from
 * each `keep` tile, e.g. the classmate) to the goal: a BFS check before each ignition.
 * Embers land on floor tiles next to the fire; stepping on one starts Stop-Drop-Roll. */
(function (root) {
  const AG = root.AG = root.AG || {};
  const FE = AG.fireEscape = AG.fireEscape || {};
  const STEPS = [[0, -1], [1, 0], [0, 1], [-1, 0]];
  const key = (x, y) => x + ',' + y;

  class FireSpread {
    constructor(o) {
      this.w = o.w; this.h = o.h; this.isFloor = o.isFloor; this.passable = o.passable;
      this.goal = o.goal; this.rnd = o.rnd || Math.random;
      this.p = o.p == null ? 0.5 : o.p; this.emberP = o.emberP || 0; this.maxEmbers = o.maxEmbers || 0;
      this.protect = new Set(o.protect || []);
      if (this.goal) this.protect.add(key(this.goal.x, this.goal.y)); // the goal itself never burns
      this.fires = new Map(); this.embers = new Map();
      (o.fires || []).forEach(f => this.fires.set(key(f.x, f.y), { x: f.x, y: f.y }));
    }
    has(x, y) { return this.fires.has(key(x, y)); }
    ember(x, y) { return this.embers.has(key(x, y)); }
    takeEmber(x, y) { return this.embers.delete(key(x, y)); }
    list() { return [...this.fires.values()]; }
    /** Walkable now, counting fires (and an extra blocked tile). */
    open(x, y, extra) { return this.passable(x, y) && !this.fires.has(key(x, y)) && key(x, y) !== extra; }
    /** Would the goal still be reachable from every `from` tile with (x, y) on fire? */
    safeToIgnite(x, y, froms) {
      const P = AG.logic.gridPath, k = key(x, y);
      const grid = { w: this.w, h: this.h, passable: (gx, gy) => this.open(gx, gy, k) };
      return froms.every(f => P.isReachable(grid, f, this.goal));
    }
    candidate(x, y, banned) {
      const k = key(x, y);
      return this.isFloor(x, y) && this.passable(x, y) && !this.fires.has(k) && !this.protect.has(k) && !banned.has(k);
    }
    step(o) {
      o = o || {};
      const froms = [o.player].concat(o.keep || []).filter(Boolean);
      const banned = new Set(froms.map(f => key(f.x, f.y)));
      const ignited = [], embers = [];
      const order = [...this.fires.values()].sort((a, b) => a.y - b.y || a.x - b.x);
      for (const f of order) {
        if (this.rnd() >= this.p) continue;
        const opts = STEPS.map(([dx, dy]) => ({ x: f.x + dx, y: f.y + dy })).filter(c => this.candidate(c.x, c.y, banned));
        if (!opts.length) continue;
        const c = opts[Math.floor(this.rnd() * opts.length)];
        if (!this.safeToIgnite(c.x, c.y, froms)) continue;
        this.fires.set(key(c.x, c.y), c); this.embers.delete(key(c.x, c.y));
        ignited.push(c);
      }
      if (this.emberP && this.embers.size < this.maxEmbers && this.rnd() < this.emberP) {
        const ring = [];
        for (const f of this.fires.values()) for (const [dx, dy] of STEPS) {
          const x = f.x + dx, y = f.y + dy;
          if (this.candidate(x, y, banned) && !this.embers.has(key(x, y)) && !ring.some(r => r.x === x && r.y === y)) ring.push({ x, y });
        }
        ring.sort((a, b) => a.y - b.y || a.x - b.x);
        if (ring.length) { const e = ring[Math.floor(this.rnd() * ring.length)]; this.embers.set(key(e.x, e.y), e); embers.push(e); }
      }
      return { ignited, embers };
    }
  }

  FE.FireSpread = FireSpread;
  if (typeof module !== 'undefined') module.exports = FireSpread;
})(typeof window !== 'undefined' ? window : globalThis);
