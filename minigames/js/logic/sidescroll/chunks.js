/* E3 SIDE-SCROLL ENGINE — chunks, pure (no DOM): the chunk format on a 16 px grid, placing a chunk
 * in world pixels (toWorld), the validator (finds a runnable path inside the jump envelope),
 * ChunkLibrary and the seeded Stitcher. Tested in kalasag-dev/minigames/tests/sidescroll.test.js.
 * Docs: kalasag-dev/minigames/docs/engines/sidescroll.md
 * Chunk: { id, width, difficulty 1..5, levels[], entryY, exitY, tags[], objects[], weight? } in tiles;
 * a y is a tile ROW from the top of the base screen (row 14 = 224 px); ground rows are surfaces. */
(function (root) {
  const AG = root.AG = root.AG || {};
  AG.logic = AG.logic || {};
  const S = () => AG.logic.sidescroll;
  const TILE = 16, BASE_ROWS = 17; // 270 px ≈ 17 rows; ground is filled down to row 17 at least

  /** Same numbers as AG.util.mulberry32 (kept here so this file stays pure). */
  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const TYPES = ['ground', 'block', 'oneway', 'crumble', 'moving', 'ladder', 'stairs', 'bounce', 'hazard', 'pickup', 'checkpoint', 'zone', 'deco'];
  const GRID_KEYS = ['x', 'y', 'w', 'h', 'd', 'dx', 'dy'];

  function normalize(c) {
    return Object.assign({ difficulty: 1, levels: [], tags: [], objects: [], weight: 1 }, c, {
      levels: (c.levels || []).slice(), tags: (c.tags || []).slice(), objects: (c.objects || []).map(o => Object.assign({}, o))
    });
  }

  /** One chunk object → world px (x0 = the chunk's left edge in px). */
  function place(o, x0, ci) {
    const px = v => v * TILE, w = px(o.w || 1), h = px(o.h || 1), x = x0 + px(o.x || 0), y = px(o.y || 0);
    const base = Object.assign({}, o, { x, y, w, h, chunk: ci });
    switch (o.type) {
      case 'ground': return Object.assign(base, { type: 'solid', kind: 'ground', h: px(Math.max(BASE_ROWS, o.y + (o.d || 3)) - o.y) });
      case 'block': return Object.assign(base, { type: 'solid', kind: 'block' });
      case 'oneway': return Object.assign(base, { h: 6 });
      case 'crumble': return Object.assign(base, { h: TILE });
      case 'moving': return Object.assign(base, { h: 8, dx: px(o.dx || 0), dy: px(o.dy || 0), ms: o.ms || 3000, hx: x, hy: y });
      case 'ladder': return Object.assign(base, { w: TILE });
      case 'stairs': return Object.assign(base, { type: 'ramp', dir: o.dir === 'down' ? 'down' : 'up' });
      case 'bounce': return Object.assign(base, { y: y - 8, w: TILE, h: 8 });
      case 'checkpoint': return Object.assign(base, { y: y - 32, w: TILE, h: 32, groundY: y });
      default: return base; // hazard, pickup, zone, deco: a w × h box from row y
    }
  }
  /** Every object of a chunk placed at x0 px, plus the chunk's extent. */
  function toWorld(chunk, x0, ci) {
    const objs = chunk.objects.map(o => place(o, x0 || 0, ci));
    let top = 0, bottom = BASE_ROWS * TILE;
    for (const o of objs) { top = Math.min(top, o.y); bottom = Math.max(bottom, o.y + o.h); }
    return { objs, x0: x0 || 0, x1: (x0 || 0) + chunk.width * TILE, top, bottom, killY: bottom + 32 };
  }
  /** The ramp's surface y at world x (feet line). */
  function rampY(r, x) {
    const p = Math.max(0, Math.min(1, (x - r.x) / r.w));
    return r.dir === 'up' ? r.y + r.h - p * r.h : r.y + p * r.h;
  }

  /* ---------- surfaces: where a runner can stand ---------- */
  /** Subtract [a, b) ranges from [x0, x1). */
  function cut(spans, a, b) {
    const out = [];
    for (const [s, e] of spans) { if (b <= s || a >= e) { out.push([s, e]); continue; } if (a > s) out.push([s, a]); if (b < e) out.push([b, e]); }
    return out;
  }
  function surfaces(objs, T) {
    const solids = objs.filter(o => o.type === 'solid'), list = [];
    const add = (o, x0, x1, y, extra) => {
      let spans = [[x0, x1]];
      for (const s of solids) if (s !== o && s.y < y && s.y + s.h > y - T.slideH) spans = cut(spans, s.x, s.x + s.w); // buried or no headroom
      for (const [a, b] of spans) if (b - a >= 1) {
        const low = solids.some(s => s !== o && s.y + s.h <= y - T.slideH && s.y + s.h > y - T.h && s.x < b && s.x + s.w > a);
        list.push(Object.assign({ x0: a, x1: b, yl: y, yr: y, src: o, slide: low }, extra));
      }
    };
    for (const o of objs) {
      if (o.type === 'solid') add(o, o.x, o.x + o.w, o.y);
      else if (o.type === 'oneway' || o.type === 'crumble') add(o, o.x, o.x + o.w, o.y);
      else if (o.type === 'moving') add(o, Math.min(o.x, o.x + o.dx), Math.max(o.x, o.x + o.dx) + o.w, o.y + Math.max(0, o.dy), { timed: true }); // its sweep, at its lowest
      else if (o.type === 'ladder') add(o, o.x, o.x + o.w, o.y, { ladderTop: true });
      else if (o.type === 'ramp') list.push({ x0: o.x, x1: o.x + o.w, yl: rampY(o, o.x), yr: rampY(o, o.x + o.w), src: o, ramp: true });
    }
    for (const s of list) s.pads = objs.filter(b => b.type === 'bounce' && b.y + b.h === s.yl && b.x < s.x1 && b.x + b.w > s.x0);
    return list;
  }

  /* ---------- the validator ---------- */
  /**
   * validate(chunk, { runSpeedMax, tuning?, limits? }) → { ok, errors, warnings, path, holds, slides }.
   * A path must run from the entry (row entryY at x 0) to the exit (row exitY at the right edge) using
   * walks, drops, tap jumps (rise ≤ 55 px), hold jumps (≤ 85), ladders and bounce pads, with every gap
   * inside the envelope (≤ maxGap; a higher ledge has less reach) and nothing solid in the way. Every
   * hazard over a surface must be slid under (≥ 16 px clear) or jumped. A moving platform counts as
   * its whole sweep at its lowest point (a warning says it is timed).
   */
  function validate(chunk, env) {
    const c = normalize(chunk), errors = [], warnings = [];
    const E = env && env.maxGap ? env : S().envelope(env), T = E.T;
    if (typeof c.id !== 'string' || !c.id) errors.push('id must be a string');
    if (!Number.isInteger(c.width) || c.width < 1) errors.push('width must be a whole number of tiles');
    if (!Number.isInteger(c.difficulty) || c.difficulty < 1 || c.difficulty > 5) errors.push('difficulty must be 1..5');
    if (!Number.isInteger(c.entryY) || !Number.isInteger(c.exitY)) errors.push('entryY / exitY must be whole rows');
    if (c.levels.some(l => !Number.isInteger(l) || l < 1 || l > 5)) errors.push('levels must be 1..5');
    c.objects.forEach((o, i) => {
      if (!TYPES.includes(o.type)) errors.push('object ' + i + ': unknown type ' + o.type);
      for (const k of GRID_KEYS) if (o[k] != null && !Number.isInteger(o[k])) errors.push('object ' + i + ' (' + o.type + '): ' + k + ' is off the 16 px grid');
      if ((o.x || 0) < 0 || (o.x || 0) + (o.w || 1) > c.width) errors.push('object ' + i + ' (' + o.type + ') is outside the chunk');
    });
    if (errors.length) return { ok: false, errors, warnings, path: [], holds: 0, slides: 0 };

    const W = c.width * TILE, objs = toWorld(c, 0).objs, list = surfaces(objs, T);
    const solids = objs.filter(o => o.type === 'solid');
    const starts = list.filter(s => s.x0 <= 0 && s.yl === c.entryY * TILE);
    const goal = s => s.x1 >= W && s.yr === c.exitY * TILE;
    if (!starts.length) errors.push('no ground at the entry (row ' + c.entryY + ', x 0)');
    if (!list.some(goal)) errors.push('no ground at the exit (row ' + c.exitY + ', right edge)');

    /** The edge a → b, or null. rise > 0 = b is higher. */
    const edge = (a, b) => {
      if (a === b) return null;
      if (b.ladderTop && !a.ladderTop && b.src.x + 8 >= a.x0 && b.src.x + 8 <= a.x1 && b.src.y + b.src.h === a.yl) return { kind: 'ladder' };
      if (b.x1 < a.x1 || (b.x1 === a.x1 && !b.ramp)) return null;
      const gap = Math.max(0, b.x0 - a.x1), rise = a.yr - b.yl, lower = Math.max(a.yr, b.yl);
      if (gap > 0 && solids.some(s => s.x < b.x0 && s.x + s.w > a.x1 && s.y < lower)) return null; // a wall in the gap
      if (gap === 0 && rise === 0) return { kind: 'walk' };
      if (rise <= 0) return gap <= E.maxGap ? { kind: gap ? 'jump' : 'drop', gap } : null;
      if (rise <= E.bounceStep && a.pads.some(p => E.bounces(b.x0 - p.x, rise))) return { kind: 'bounce', gap, rise };
      if (rise > E.holdStep || gap > E.reach(rise)) return null;
      return { kind: rise > E.tapStep ? 'hold' : 'tap', gap, rise };
    };
    /* the easiest path (Dijkstra: a hold jump costs most), so `holds` = hold jumps really needed */
    const COST = { walk: 1, drop: 1, ladder: 1, jump: 2, tap: 2, bounce: 2, hold: 5 };
    let path = [];
    if (!errors.length) {
      const dist = new Map(starts.map(s => [s, 0])), prev = new Map(starts.map(s => [s, null])), done = new Set();
      let end = null;
      for (;;) {
        let a = null;
        for (const [s, d] of dist) if (!done.has(s) && (!a || d < dist.get(a))) a = s;
        if (!a) break;
        if (goal(a)) { end = a; break; }
        done.add(a);
        for (const b of list) {
          if (done.has(b)) continue;
          const e = edge(a, b), d = e && dist.get(a) + COST[e.kind];
          if (e && (!dist.has(b) || d < dist.get(b))) { dist.set(b, d); prev.set(b, { from: a, e }); }
        }
      }
      if (!end) errors.push('no runnable path from entry to exit inside the jump envelope (max gap ' + Math.round(E.maxGap) + ' px, tap ' + E.tapStep + ', hold ' + E.holdStep + ')');
      for (let s = end; s; s = prev.get(s) && prev.get(s).from) path.unshift({ x0: s.x0, x1: s.x1, y: s.yl, via: prev.get(s) ? prev.get(s).e.kind : 'start', src: s.src.type });
    }
    for (const hz of objs.filter(o => o.type === 'hazard')) {
      for (const s of list) {
        if (s.ramp || s.x0 >= hz.x + hz.w || s.x1 <= hz.x || hz.y >= s.yl || hz.y + hz.h <= s.yl - T.h) continue;
        const clear = s.yl - (hz.y + hz.h), tall = s.yl - hz.y;
        if (clear < T.slideH + 2 && !E.clears(hz.w, tall)) errors.push('hazard ' + (hz.id || '') + ' at tile ' + (hz.x / TILE) + ' can be neither slid under nor jumped');
      }
    }
    for (const o of objs.filter(o => o.type === 'crumble')) if (o.w > E.runSpeed * T.crumbleMs / 1000 + T.w) warnings.push('crumble at tile ' + (o.x / TILE) + ' is wider than the runner crosses in ' + T.crumbleMs + ' ms');
    if (list.some(s => s.timed)) warnings.push('moving platforms are checked as their whole sweep (timed)');
    return { ok: !errors.length, errors, warnings, path, holds: path.filter(p => p.via === 'hold').length, slides: list.filter(s => s.slide).length };
  }

  /* ---------- ChunkLibrary ---------- */
  class ChunkLibrary {
    constructor(chunks) { this.all = []; this.byId = new Map(); (chunks || []).forEach(c => this.add(c)); }
    add(c) { const n = normalize(c); if (this.byId.has(n.id)) throw new Error('duplicate chunk id ' + n.id); this.all.push(n); this.byId.set(n.id, n); return this; }
    get(id) { return this.byId.get(id) || null; }
    /** { level, band: [min, max], entryY, exitY, tags (any of), exclude: id | [ids] } */
    filter(q) {
      q = q || {};
      const ex = new Set([].concat(q.exclude || []));
      return this.all.filter(c => !ex.has(c.id)
        && (!q.band || (c.difficulty >= q.band[0] && c.difficulty <= q.band[1]))
        && (q.level == null || !c.levels.length || c.levels.includes(q.level))
        && (q.entryY == null || c.entryY === q.entryY) && (q.exitY == null || c.exitY === q.exitY)
        && (!q.tags || !q.tags.length || q.tags.some(t => c.tags.includes(t))));
    }
    /** validate() every chunk: [{ id, ok, errors, warnings, holds }]. */
    validate(env) { const E = S().envelope(env); return this.all.map(c => Object.assign({ id: c.id }, validate(c, E))); }
  }

  /* ---------- Stitcher ---------- */
  const RESERVED = ['start', 'finish'];
  /**
   * new Stitcher(library, { seed, level, band: [min, max], startY, tags, first, last })
   * next() → { chunk, x, index }: a chunk whose entryY is the last exitY, difficulty in the band (the band
   * widens by 1 each side if nothing fits), never the same id twice in a row, weighted by chunk.weight.
   * plan(count) → count placed chunks, starting with `first` and ending with `last` (ids) if given.
   * Chunks tagged 'start' / 'finish' are only used as first / last. Same seed → same sequence.
   */
  class Stitcher {
    constructor(lib, o) {
      o = o || {};
      this.lib = lib instanceof ChunkLibrary ? lib : new ChunkLibrary(lib);
      this.rng = mulberry32(o.seed == null ? 1 : o.seed);
      this.level = o.level == null ? null : o.level;
      this.band = o.band || [1, 5]; this.tags = o.tags || null;
      this.first = o.first || null; this.lastId = o.last || null;
      this.y = o.startY != null ? o.startY : this.first ? this.lib.get(this.first).entryY : 14;
      this.x = 0; this.index = 0; this.prev = null;
    }
    pool(q) { return this.lib.filter(Object.assign({ level: this.level, tags: this.tags }, q)).filter(c => !c.tags.some(t => RESERVED.includes(t))); }
    /** Candidates for the next slot, widening the band, then dropping the tag filter. */
    candidates(extra) {
      const q = Object.assign({ entryY: this.y, exclude: this.prev ? this.prev.id : null }, extra);
      for (const tags of this.tags ? [this.tags, null] : [null]) {
        for (let k = 0; k <= 4; k++) {
          const band = [Math.max(1, this.band[0] - k), Math.min(5, this.band[1] + k)];
          const list = this.pool(Object.assign({ band }, q, { tags: tags || undefined })).filter(c => !extra || !extra.ok || extra.ok(c));
          if (list.length) return list;
          if (band[0] === 1 && band[1] === 5) break;
        }
      }
      return [];
    }
    pick(list) {
      const total = list.reduce((s, c) => s + (c.weight > 0 ? c.weight : 0), 0);
      let u = this.rng() * total;
      for (const c of list) { u -= c.weight > 0 ? c.weight : 0; if (u < 0) return c; }
      return list[list.length - 1];
    }
    push(c) {
      const placed = { chunk: c, x: this.x, index: this.index++ };
      this.x += c.width * TILE; this.y = c.exitY; this.prev = c;
      return placed;
    }
    next(extra) {
      const list = this.candidates(extra);
      if (!list.length) throw new Error('Stitcher: no chunk enters at row ' + this.y + ' (after ' + (this.prev ? this.prev.id : 'the start') + ')');
      return this.push(this.pick(list));
    }
    /** Rows from which `target` can be reached in exactly k more pool chunks. */
    reachable(target, k) {
      this.reach = this.reach || new Map();
      const key = target + ':' + k;
      if (this.reach.has(key)) return this.reach.get(key);
      let set;
      if (k === 0) set = new Set([target]);
      else { const after = this.reachable(target, k - 1); set = new Set(this.pool({}).filter(c => after.has(c.exitY)).map(c => c.entryY)); }
      this.reach.set(key, set);
      return set;
    }
    plan(count) {
      const out = [], first = this.first && this.lib.get(this.first), last = this.lastId && this.lib.get(this.lastId);
      if (this.first && !first) throw new Error('Stitcher: unknown first chunk ' + this.first);
      if (this.lastId && !last) throw new Error('Stitcher: unknown last chunk ' + this.lastId);
      if (first) { this.y = first.entryY; out.push(this.push(first)); }
      const middle = count - out.length - (last ? 1 : 0);
      for (let i = 0; i < middle; i++) {
        const left = middle - i - 1;
        out.push(this.next(last ? { ok: c => this.reachable(last.entryY, left).has(c.exitY) } : null));
      }
      if (last) {
        if (this.y !== last.entryY) throw new Error('Stitcher: cannot reach the last chunk ' + last.id);
        out.push(this.push(last));
      }
      return out;
    }
  }

  const api = { TILE, TYPES, normalize, place, toWorld, rampY, surfaces, validate, ChunkLibrary, Stitcher, mulberry32 };
  AG.logic.sidescroll = Object.assign(AG.logic.sidescroll || {}, api);
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
