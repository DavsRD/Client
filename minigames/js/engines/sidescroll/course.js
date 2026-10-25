/* E3 SIDE-SCROLL ENGINE — Parallax (3–4 background layers, whole-pixel scroll) and Course, which wires
 * the parts together: Stitcher → World (a finite stage, or endless chunks streamed ahead and dropped
 * behind), RunnerController, Camera, Chasers, Parallax and optional darkness (E1 grid/darkness.js) with
 * reflective edges. One update(dt) and one draw(t) per frame. Docs: kalasag-dev/minigames/docs/engines/sidescroll.md */
window.AG = window.AG || {};
(function (AG) {
  const L = () => AG.logic.sidescroll, SS = () => AG.sidescroll;

  /** Layer: { key (an image tiled across), factor, fy?, y?, w?, h? } | { color } | { bands: [colours] } |
   *  { hills: { base, amp, period, color } } | { draw(ctx, offX, offY, cam, t) }. factor 0 = fixed sky. */
  class Parallax {
    constructor(layers) { this.layers = (layers || []).map(l => Object.assign({ factor: 0, fy: 0 }, l)); }
    draw(ctx, cam, t) {
      const W = cam.w, H = cam.h;
      for (const l of this.layers) {
        const ox = Math.floor(cam.x * l.factor), oy = Math.floor(cam.y * l.fy);
        if (l.color) { ctx.fillStyle = l.color; ctx.fillRect(0, 0, W, H); }
        else if (l.bands) AG.gfx.sky(ctx, W, H, l.bands);
        else if (l.hills) AG.gfx.hills(ctx, W, l.hills.base - oy, l.hills.color, l.hills.amp || 40, l.hills.period || 90, ox);
        else if (l.draw) l.draw(ctx, ox, oy, cam, t);
        else if (l.key) {
          const rec = AG.assets.image(l.key), w = l.w || rec.frameW || W, h = l.h || rec.h || H, y = (l.y || 0) - oy;
          for (let x = -(((ox % w) + w) % w); x < W; x += w) AG.assets.draw(ctx, l.key, x, y, w, h);
        }
      }
    }
  }

  class Course extends AG.sidescroll.Emitter {
    constructor(o) {
      super();
      o = o || {};
      this.o = o; this.view = o.view; this.W = (o.view && o.view.W) || 480; this.H = (o.view && o.view.H) || 270;
      this.world = new (SS().World)({ tiles: o.tiles, tuning: o.tuning });
      this.ahead = o.ahead == null ? 2 * this.W : o.ahead;
      this.every = o.checkpointEvery || 0; // a checkpoint at the start of every n-th chunk
      this.world.onAppend = pc => { if (this.every && pc.i > 1 && (pc.i - 1) % this.every === 0) this.world.addCheckpoint(pc); };
      let startRow;
      if (o.plan) { this.world.appendAll(o.plan).close(); startRow = o.plan[0].chunk.entryY; }
      else {
        const lib = o.library instanceof L().ChunkLibrary ? o.library : new (L().ChunkLibrary)(o.library || o.chunks);
        this.stitcher = new (L().Stitcher)(lib, { seed: o.seed, level: o.level, band: o.band, tags: o.tags, first: o.first, last: o.last, startY: o.startY });
        startRow = this.stitcher.y;
        if (o.count != null && isFinite(o.count)) { this.plan = this.stitcher.plan(o.count); this.world.appendAll(this.plan).close(); startRow = this.plan[0].chunk.entryY; }
      }
      this.endless = !isFinite(this.world.endX);
      this.runner = new (SS().RunnerController)(Object.assign({ rig: o.rig, world: this.world, view: o.view, x: 40, y: startRow * L().TILE, runSpeed: o.runSpeed, tuning: o.tuning, input: o.input }, o.runner));
      if (this.endless) this.stream(this.runner.x);
      this.camera = new (SS().Camera)(Object.assign({ w: this.W, h: this.H, maxX: this.endless ? Infinity : this.world.right - this.W }, o.camera)).snap(this.runner);
      this.chasers = (o.chasers || []).map(c => (c instanceof SS().Chaser ? c : new (SS().Chaser)(Object.assign({ runner: this.runner }, c))));
      this.parallax = o.parallax ? (o.parallax instanceof Parallax ? o.parallax : new Parallax(o.parallax)) : null;
      this.dark = null;
      if (o.darkness) {
        if (AG.grid && AG.grid.Darkness) this.dark = new AG.grid.Darkness(Object.assign({ w: this.W, h: this.H }, o.darkness));
        else AG.warnOnce('ss:dark', 'sidescroll: darkness needs engines/grid/darkness.js');
      }
      this.lightR = (o.darkness && o.darkness.radius) || 130;
      this.clock = 0;
    }
    /** Endless: keep chunks `ahead` px past x, drop the ones well behind the camera and the respawn points. */
    stream(x) {
      while (this.world.right < x + this.W + this.ahead) { const p = this.stitcher.next(); this.world.append(p.chunk, p.x); this.emit('chunk', p); }
      const r = this.runner;
      this.world.drop(Math.min(x - this.W, r.checkpoint.x - this.W, r.safe.x - this.W));
    }
    addChaser(o) { const c = o instanceof SS().Chaser ? o : new (SS().Chaser)(Object.assign({ runner: this.runner }, o)); this.chasers.push(c); return c; }

    update(dt) {
      this.clock += dt * 1000;
      this.world.update(dt);
      this.runner.update(dt);
      for (const c of this.chasers) c.update(dt);
      this.camera.follow(this.runner);
      if (this.endless && this.stitcher) this.stream(this.camera.x);
      return this;
    }
    /** parallax → drawBehind → world → runner → chasers → drawFront → darkness + reflective edges → drawTop */
    draw(t, ctx) {
      ctx = ctx || this.view.ctx;
      t = t == null ? this.clock / 1000 : t;
      const cam = this.camera, o = this.o;
      if (this.parallax) this.parallax.draw(ctx, cam, t); else { ctx.fillStyle = '#7ec8f0'; ctx.fillRect(0, 0, this.W, this.H); }
      if (o.drawBehind) o.drawBehind(ctx, cam, t);
      this.world.draw(ctx, cam, t);
      this.runner.draw(ctx, cam, t);
      for (const c of this.chasers) c.draw(ctx, cam, t);
      if (o.drawFront) o.drawFront(ctx, cam, t);
      if (this.dark) {
        const r = this.runner, lights = [{ x: r.x - cam.x, y: r.y - 14 - cam.y, r: this.lightR }].concat(o.lights ? o.lights(cam) : []);
        this.dark.draw(ctx, { lights, glows: this.reflectors(cam), t });
      }
      if (o.drawTop) o.drawTop(ctx, cam, t);
    }
    /** Objects with reflect: true keep a dashed bright edge in the dark (shape, not colour alone). */
    reflectors(cam) {
      const out = [], x0 = cam.x, x1 = cam.x + cam.w;
      for (const c of this.world.near(x0, x1)) for (const ob of c.objs) {
        if (!ob.reflect || ob.x > x1 || ob.x + ob.w < x0 || ob.taken) continue;
        out.push({ x: ob.x - cam.x, y: ob.y - cam.y, w: ob.w, h: ob.h, draw: (g, x, y, w, h) => {
          g.fillStyle = '#ffd23f';
          for (let i = 0; i < w; i += 4) g.fillRect(x + i, y, 2, 1);
          for (let i = 0; i < h; i += 4) { g.fillRect(x, y + i, 1, 2); g.fillRect(x + w - 1, y + i, 1, 2); }
        } });
      }
      return out;
    }
    destroy() { this.runner.destroy(); this.chasers.forEach(c => c.destroy()); }
  }

  AG.sidescroll = Object.assign(AG.sidescroll || {}, { Parallax, Course });
})(window.AG);
