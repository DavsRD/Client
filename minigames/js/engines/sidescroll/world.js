/* E3 SIDE-SCROLL ENGINE — World: the placed chunks in world pixels (solids, one-way, crumbling and
 * moving platforms, ladders, stairs, bounce pads, hazards, pickups, checkpoints, zones, deco), their
 * per-frame motion and drawing (static tiles cached per chunk once their art has loaded). Also the
 * small Emitter and the side-scroll Camera (whole-pixel scroll, optional vertical deadzone).
 * Docs: kalasag-dev/minigames/docs/engines/sidescroll.md */
window.AG = window.AG || {};
(function (AG) {
  const L = () => AG.logic.sidescroll;
  const INK = '#1e1538', TILE = 16;

  /** on(type, fn) → off; emit(type, data) also calls o['on' + Type] if the options have one. */
  class Emitter {
    on(type, fn) { (this._h = this._h || {})[type] = (this._h[type] || []).concat(fn); return () => { this._h[type] = this._h[type].filter(f => f !== fn); }; }
    emit(type, data) {
      ((this._h && this._h[type]) || []).slice().forEach(fn => { try { fn(data, this); } catch (e) { console.error(e); } });
      const cb = this.o && this.o['on' + type[0].toUpperCase() + type.slice(1)];
      if (cb) cb(data, this);
    }
  }

  /** Follows the runner: x keeps it leadX from the left edge; y (optional) keeps its feet between
   *  top and bottom of the view; y never goes below maxY (0 = the base screen). Whole pixels. */
  class Camera {
    constructor(o) {
      o = o || {};
      this.w = o.w || 480; this.h = o.h || 270; this.leadX = o.leadX == null ? 120 : o.leadX;
      this.followY = !!o.followY; this.top = o.top == null ? 72 : o.top; this.bottom = o.bottom == null ? 200 : o.bottom;
      this.minY = o.minY == null ? -Infinity : o.minY; this.maxY = o.maxY == null ? 0 : o.maxY;
      this.minX = o.minX == null ? 0 : o.minX; this.maxX = o.maxX == null ? Infinity : o.maxX;
      this.x = 0; this.y = 0;
    }
    follow(r) {
      this.x = Math.round(Math.max(this.minX, Math.min(this.maxX, r.x - this.leadX)));
      if (this.followY) {
        let y = this.y;
        if (r.y - y < this.top) y = r.y - this.top;
        if (r.y - y > this.bottom) y = r.y - this.bottom;
        this.y = Math.round(Math.max(this.minY, Math.min(this.maxY, y)));
      }
      return this;
    }
    snap(r) { if (this.followY) this.y = Math.round(Math.max(this.minY, Math.min(this.maxY, r.y - (this.top + this.bottom) / 2))); return this.follow(r); }
    toScreen(x, y) { return { x: Math.round(x - this.x), y: Math.round(y - this.y) }; }
  }

  const overlaps = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  const EMOJI = /\p{Extended_Pictographic}/u;

  class World {
    /** { tiles: { groundTop, ground, block, oneway, ladder, stairs, crumble, moving, bounce, checkpoint } asset keys,
     *    tuning } — without a key a part is drawn as plain pixel shapes. */
    constructor(o) {
      o = o || {};
      this.o = o; this.tiles = o.tiles || {}; this.T = L().tune(o.tuning);
      this.chunks = []; this.clock = 0; this.endX = Infinity;
    }
    /** Places a chunk with its left edge at x px (Stitcher.next() gives x). */
    append(chunk, x) {
      const c = L().normalize(chunk);
      const i = this.serial = (this.serial || 0) + 1;
      const pc = Object.assign(L().toWorld(c, x == null ? this.right : x, i), { id: c.id, chunk: c, i, canvas: null });
      const by = t => pc.objs.filter(ob => ob.type === t);
      pc.solids = by('solid'); pc.ramps = by('ramp'); pc.ladders = by('ladder'); pc.pads = by('bounce');
      pc.hazards = by('hazard'); pc.pickups = by('pickup'); pc.checkpoints = by('checkpoint'); pc.zones = by('zone'); pc.decos = by('deco');
      pc.crumbles = by('crumble'); pc.movers = by('moving');
      pc.ladders.forEach(l => { l.top = { type: 'ladderTop', x: l.x, y: l.y, w: l.w, h: 4, ladder: l }; });
      pc.oneways = by('oneway').concat(pc.crumbles, pc.movers, pc.ladders.map(l => l.top));
      pc.movers.forEach(m => { m.px = m.x; m.py = m.y; m.ddx = 0; m.ddy = 0; });
      this.chunks.push(pc);
      if (this.onAppend) this.onAppend(pc);
      return pc;
    }
    /** Adds a checkpoint flag at the chunk's left edge, on its entry row. */
    addCheckpoint(pc) {
      if (pc.checkpoints.some(c => c.x === pc.x0)) return null;
      const cp = L().place({ type: 'checkpoint', x: 0, y: pc.chunk.entryY }, pc.x0, pc.i);
      pc.checkpoints.push(cp); pc.objs.push(cp);
      return cp;
    }
    appendAll(list) { list.forEach(p => this.append(p.chunk, p.x)); return this; }
    /** Ends the course at the right edge of the last chunk (a finite stage). */
    close() { this.endX = this.right; return this; }
    get right() { return this.chunks.length ? this.chunks[this.chunks.length - 1].x1 : 0; }
    get left() { return this.chunks.length ? this.chunks[0].x0 : 0; }
    /** Drops chunks wholly left of x (endless runs). */
    drop(x) { while (this.chunks.length > 2 && this.chunks[0].x1 < x) this.chunks.shift(); }
    near(x0, x1) { return this.chunks.filter(c => c.x1 > x0 - TILE && c.x0 < x1 + TILE); }
    chunkAt(x) { return this.chunks.find(c => x >= c.x0 && x < c.x1) || (x < this.left ? this.chunks[0] : this.chunks[this.chunks.length - 1]); }
    killY(x) { const c = this.chunkAt(x); return c ? c.killY : 400; }
    /** All objects of one list name ('solids', 'oneways', 'hazards', …) near an x range. */
    each(name, x0, x1, fn) { for (const c of this.near(x0, x1)) for (const ob of c[name]) if (fn(ob) === false) return; }

    update(dt) {
      const ms = dt * 1000; this.clock += ms;
      for (const c of this.near(-Infinity, Infinity)) {
        for (const m of c.movers) {
          const p = (1 - Math.cos(2 * Math.PI * (this.clock % m.ms) / m.ms)) / 2;
          const nx = m.hx + m.dx * p, ny = m.hy + m.dy * p;
          m.ddx = nx - m.x; m.ddy = ny - m.y; m.x = nx; m.y = ny;
        }
        for (const k of c.crumbles) {
          if (k.touched != null && !k.falling && this.clock - k.touched >= this.T.crumbleMs) { k.falling = true; k.vy = 0; k.fy = k.y; }
          if (k.falling && k.fy < c.killY + 200) { k.vy += this.T.gravity * dt; k.fy += k.vy * dt; }
        }
      }
    }
    /** A crumbling platform the runner stood on: it falls crumbleMs later. */
    touch(k) { if (k.touched == null) k.touched = this.clock; }
    /** Puts crumbling platforms back (on respawn). */
    reset() { for (const c of this.chunks) for (const k of c.crumbles) { k.touched = null; k.falling = false; } }
    /** Is a box free of solids (standing up after a slide)? */
    free(box) { let ok = true; this.each('solids', box.x, box.x + box.w, s => { if (overlaps(box, s)) { ok = false; return false; } }); return ok; }

    /* ---------- drawing ---------- */
    draw(ctx, cam, t) {
      const x0 = cam.x, x1 = cam.x + cam.w;
      for (const c of this.near(x0, x1)) this.drawStatic(ctx, c, cam);
      for (const c of this.near(x0, x1)) {
        for (const k of c.crumbles) this.drawCrumble(ctx, k, cam, t);
        for (const m of c.movers) this.drawTiles(ctx, this.tiles.moving, m, cam, () => this.plain(ctx, 'moving', m, cam));
        for (const p of c.pads) this.drawPad(ctx, p, cam, t);
        for (const cp of c.checkpoints) this.drawCheckpoint(ctx, cp, cam, t);
        for (const hz of c.hazards) this.drawThing(ctx, hz, cam, t);
        for (const pk of c.pickups) if (!pk.taken) this.drawThing(ctx, pk, cam, t, AG.reducedMotion() ? 0 : Math.floor(t * 3 + pk.x / 40) % 2);
      }
    }
    /** Static parts (solids, one-ways, ladders, stairs, deco): cached per chunk when their art is in. */
    drawStatic(ctx, c, cam) {
      if (!c.canvas && this.artReady(c)) {
        const cv = document.createElement('canvas'); cv.width = c.x1 - c.x0; cv.height = c.bottom - c.top;
        const g = cv.getContext('2d'); g.imageSmoothingEnabled = false;
        this.paintStatic(g, c, { x: c.x0, y: c.top });
        c.canvas = cv;
      }
      if (c.canvas) ctx.drawImage(c.canvas, Math.round(c.x0 - cam.x), Math.round(c.top - cam.y));
      else this.paintStatic(ctx, c, cam);
    }
    artReady(c) {
      if (c.keys == null) {
        const k = new Set(), T = this.tiles;
        for (const s of c.solids) [s.art, s.top, s.kind === 'ground' ? T.ground : T.block, s.kind === 'ground' && T.groundTop].forEach(v => v && k.add(v));
        if (c.ramps.length && T.stairs) k.add(T.stairs);
        if (c.ladders.length && T.ladder) k.add(T.ladder);
        if (c.oneways.some(o => o.type === 'oneway') && T.oneway) k.add(T.oneway);
        c.decos.forEach(d => d.art && k.add(d.art));
        c.keys = [...k];
      }
      return c.keys.every(k => AG.assets.image(k).loaded);
    }
    paintStatic(g, c, cam) {
      for (const d of c.decos) this.drawThing(g, d, cam, 0);
      for (const s of c.solids) {
        if (s.kind === 'ground') {
          const fill = s.art || this.tiles.ground, top = s.top || this.tiles.groundTop;
          this.drawTiles(g, fill, s, cam, () => this.plain(g, 'ground', s, cam), top);
        } else this.drawTiles(g, s.art || this.tiles.block, s, cam, () => this.plain(g, 'block', s, cam));
      }
      for (const r of c.ramps) this.drawRamp(g, r, cam);
      for (const o of c.oneways) if (o.type === 'oneway') this.drawTiles(g, o.art || this.tiles.oneway, o, cam, () => this.plain(g, 'oneway', o, cam));
      for (const l of c.ladders) this.drawTiles(g, l.art || this.tiles.ladder, l, cam, () => this.plain(g, 'ladder', l, cam));
    }
    /** Tiles a key over the box (16 px tiles; a bigger image is drawn once, filling the box). */
    drawTiles(g, key, b, cam, fallback, topKey) {
      const x = Math.round(b.x - cam.x), y = Math.round(b.y - cam.y);
      if (!key) { fallback(); return; }
      const rec = AG.assets.image(key);
      const tw = rec.frameW || TILE, th = rec.h || TILE;
      if (tw > TILE * 2 && tw >= b.w) { AG.assets.draw(g, key, x, y, b.w, b.h); return; }
      for (let yy = 0; yy < b.h; yy += th) for (let xx = 0; xx < b.w; xx += tw) {
        const k = topKey && yy === 0 ? topKey : key;
        AG.assets.draw(g, k, x + xx, y + yy, Math.min(tw, b.w - xx), Math.min(th, b.h - yy));
      }
    }
    drawRamp(g, r, cam) {
      const steps = Math.max(1, Math.round(r.w / TILE)), sh = r.h / steps;
      for (let i = 0; i < steps; i++) {
        const k = r.dir === 'up' ? i + 1 : steps - i, top = r.y + r.h - Math.round(k * sh);
        const box = { x: r.x + i * TILE, y: top, w: TILE, h: r.y + r.h - top };
        if (this.tiles.stairs || r.art) this.drawTiles(g, r.art || this.tiles.stairs, box, cam, null);
        else this.plain(g, 'block', box, cam);
      }
    }
    drawCrumble(ctx, k, cam, t) {
      const shake = k.touched != null && !k.falling && !AG.reducedMotion() ? (Math.floor(t * 30) % 2 ? 1 : -1) : 0;
      const box = { x: k.x + shake, y: k.falling ? k.fy : k.y, w: k.w, h: k.h };
      if (k.falling && box.y > cam.y + cam.h) return;
      const key = k.art || this.tiles.crumble, f = k.touched != null ? 1 : 0;
      if (key) { for (let xx = 0; xx < k.w; xx += TILE) AG.assets.draw(ctx, key, Math.round(box.x - cam.x + xx), Math.round(box.y - cam.y), TILE, TILE, f); }
      else this.plain(ctx, 'crumble', box, cam, f);
    }
    drawPad(ctx, p, cam, t) {
      const x = Math.round(p.x - cam.x), y = Math.round(p.y - cam.y), up = p.fired != null && this.clock - p.fired < 200 ? 2 : 0;
      if (this.tiles.bounce || p.art) { AG.assets.draw(ctx, p.art || this.tiles.bounce, x, y - up, p.w, p.h + up); return; }
      ctx.fillStyle = INK; ctx.fillRect(x + 2, y + 5 - up, 12, 3 + up);
      ctx.fillStyle = '#ffd23f'; ctx.fillRect(x, y - up, 16, 3);
      ctx.fillStyle = INK; ctx.fillRect(x, y - up, 16, 1); for (let i = 0; i < 3; i++) ctx.fillRect(x + 3 + i * 4, y + 3 - up, 2, 2); // springs (shape, not colour only)
    }
    drawCheckpoint(ctx, cp, cam, t) {
      const x = Math.round(cp.x - cam.x), y = Math.round(cp.y - cam.y), f = AG.reducedMotion() ? 0 : Math.floor(t * 4) % 2;
      if (this.tiles.checkpoint || cp.art) { AG.assets.draw(ctx, cp.art || this.tiles.checkpoint, x, y, 16, 32, cp.reached ? f : 0); return; }
      ctx.fillStyle = INK; ctx.fillRect(x + 2, y, 2, 32);
      const fy = cp.reached ? y + 1 : y + 14;
      ctx.fillStyle = cp.reached ? '#5ed16a' : '#ff7a1a'; ctx.fillRect(x + 4, fy, 10 - f, 8);
      ctx.fillStyle = INK; ctx.fillRect(x + 4, fy, 10 - f, 1); ctx.fillRect(x + 4, fy + 7, 10 - f, 1);
      if (cp.reached) { ctx.fillStyle = '#ffffff'; ctx.fillRect(x + 7, fy + 4, 1, 1); ctx.fillRect(x + 8, fy + 5, 1, 1); ctx.fillRect(x + 9, fy + 2, 1, 3); } // a tick
    }
    /** Hazards, pickups and deco: an asset key (art), an AG.icons name or an emoji (icon), or a box. */
    drawThing(g, ob, cam, t, bob) {
      const x = Math.round(ob.x - cam.x), y = Math.round(ob.y - cam.y - (bob || 0));
      if (ob.art) { AG.assets.draw(g, ob.art, x, y, ob.w, ob.h, ob.frames ? Math.floor(t * (ob.fps || 6)) % ob.frames : 0); return; }
      if (ob.icon) {
        const ix = x + Math.round((ob.w - 18) / 2), iy = y + ob.h - 18;
        if (AG.icons.has(ob.icon)) AG.gfx.drawIcon(g, ob.icon, ix, iy, 1);
        else if (EMOJI.test(ob.icon)) g.drawImage(AG.pixelIcon(ob.icon, 18, true), ix, iy);
        return;
      }
      if (ob.type === 'hazard') this.plain(g, 'hazard', ob, cam);
      else if (ob.type === 'pickup') { g.fillStyle = INK; g.fillRect(x + 3, y + 3, 10, 10); g.fillStyle = '#ffd23f'; g.fillRect(x + 4, y + 4, 8, 8); g.fillStyle = '#fff'; g.fillRect(x + 5, y + 5, 2, 2); }
    }
    /** Plain pixel shapes for parts with no art (the demo, or before a game's tiles exist). */
    plain(g, kind, b, cam, f) {
      const x = Math.round(b.x - cam.x), y = Math.round(b.y - cam.y), w = b.w, h = b.h;
      const C = { ground: ['#9a6a44', '#7e5236'], block: ['#b07a3c', '#8a5a2c'], oneway: ['#c89a5a', '#8a5a2c'], crumble: ['#c8a46a', '#7e5236'], moving: ['#6e9ad8', '#3e5aa0'], hazard: ['#ff7a1a', INK], ladder: ['#c89a5a', '#8a5a2c'] }[kind];
      if (kind === 'ladder') { g.fillStyle = C[1]; g.fillRect(x + 2, y, 2, h); g.fillRect(x + 12, y, 2, h); g.fillStyle = C[0]; for (let yy = 3; yy < h; yy += 6) g.fillRect(x + 4, y + yy, 8, 2); return; }
      g.fillStyle = C[0]; g.fillRect(x, y, w, h);
      g.fillStyle = C[1];
      if (kind === 'ground') {
        for (let yy = 6; yy < h; yy += 4) for (let xx = ((yy >> 2) & 1) * 4 + 1; xx < w; xx += 8) g.fillRect(x + xx, y + yy, 2, 1);
        g.fillStyle = '#5ec26a'; g.fillRect(x, y, w, 4); g.fillStyle = '#3e9a4c'; g.fillRect(x, y + 4, w, 1);
      } else if (kind === 'hazard') {
        for (let xx = 0; xx < w; xx += 6) g.fillRect(x + xx, y, 3, h); // stripes: danger is a shape too
      } else if (kind === 'crumble') {
        for (let xx = 0; xx < w; xx += TILE) { g.fillRect(x + xx + 5, y + 2, 1, 6); g.fillRect(x + xx + 6, y + 7, 4, 1); if (f) g.fillRect(x + xx + 11, y + 3, 1, 8); }
      } else for (let xx = 0; xx < w; xx += TILE) g.fillRect(x + xx + TILE - 1, y, 1, h);
      g.fillStyle = INK; g.fillRect(x, y, w, 1); if (kind !== 'ground') { g.fillRect(x, y + h - 1, w, 1); g.fillRect(x, y, 1, h); g.fillRect(x + w - 1, y, 1, h); }
    }
  }

  AG.sidescroll = Object.assign(AG.sidescroll || {}, { Emitter, Camera, World, overlaps });
})(window.AG);
