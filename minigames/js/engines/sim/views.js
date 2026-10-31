/* E7 SIMULATION ENGINE — the canvas views of the pure simulations:
 *   CrowdView      draws an AG.logic.sim.Crowd from one SpriteBatch atlas and, through an FpsGovernor,
 *                  cuts the crowd by 25 % whenever the real frame rate stays under 45 fps for 3 s.
 *   FollowersView  draws PathFollowers: dotted paths, dithered slow zones, blockers with HP bars, units.
 * Docs: kalasag-dev/minigames/docs/engines/sim.md */
window.AG = window.AG || {};
(function (AG) {
  const S = AG.logic.sim, D = () => AG.sim.draw, R = Math.round;
  const INK = '#1e1538';

  class CrowdView extends S.Emitter {
    /** o: { crowd, sprites: SpriteBatch | its options, governor: { min, holdMs, factor } | false, floor: 40,
     *       fps: 8 (walk frames), variant(i) → n, sortY: false, onReduce } */
    constructor(o) {
      super();
      this.o = o; this.crowd = o.crowd;
      this.sprites = o.sprites instanceof AG.sim.SpriteBatch ? o.sprites : new AG.sim.SpriteBatch(o.sprites);
      this.gov = o.governor === false ? null : new S.FpsGovernor(o.governor);
      this.floor = o.floor == null ? 40 : o.floor; this.fps = o.fps || 8; this.order = [];
    }
    /** Call once per drawn frame (the governor times real frames, not simulation steps). */
    draw(ctx, t) {
      const c = this.crowd, sp = this.sprites;
      t = t == null ? performance.now() / 1000 : t;
      if (this.gov && this.gov.tick(performance.now())) {
        const to = Math.max(this.floor, Math.floor(c.count * this.gov.factor));
        if (to < c.count) { const from = c.count; c.limit(to); this.emit('reduce', { from, to: c.count, fps: this.gov.fps }); }
      }
      let list = null;
      if (this.o.sortY) { list = this.order; list.length = 0; for (let i = 0; i < c.n; i++) if (c.alive[i]) list.push(i); list.sort((a, b) => c.y[a] - c.y[b]); }
      const n = list ? list.length : c.n;
      for (let k = 0; k < n; k++) {
        const i = list ? list[k] : k;
        if (!c.alive[i]) continue;
        const moving = c.vx[i] * c.vx[i] + c.vy[i] * c.vy[i] > 16;
        sp.draw(ctx, c.x[i], c.y[i], this.o.variant ? this.o.variant(i) : i, moving ? Math.floor(t * this.fps + i * 0.37) : 0);
      }
    }
    get fpsNow() { return this.gov ? this.gov.fps : null; }
  }

  /* a slow zone's dither, drawn once per zone */
  function zoneLayer(z, color) {
    const w = z.r != null ? z.r * 2 : z.w, h = z.r != null ? z.r * 2 : z.h;
    const cv = document.createElement('canvas'); cv.width = Math.max(1, R(w)); cv.height = Math.max(1, R(h));
    const g = cv.getContext('2d'); g.fillStyle = color;
    for (let y = 0; y < cv.height; y++) for (let x = (y & 1); x < cv.width; x += 2) {
      if (z.r != null && (x - z.r + 0.5) ** 2 + (y - z.r + 0.5) ** 2 > z.r * z.r) continue;
      g.fillRect(x, y, 1, 1);
    }
    return cv;
  }

  class FollowersView {
    /** o: { followers, path: { color, dash: [2, 3] } | false, zoneColor, unit(u) → { art?, icon?, color?, size? },
     *       blocker(b) → { art?, icon?, color?, size? }, hpBar: true } */
    constructor(o) {
      this.o = o; this.f = o.followers; this.layers = new WeakMap();
    }
    draw(ctx, t) {
      const f = this.f, o = this.o;
      f.zones.forEach(z => {
        let cv = this.layers.get(z);
        if (!cv) { cv = zoneLayer(z, z.color || o.zoneColor || 'rgba(47,138,74,.55)'); this.layers.set(z, cv); }
        ctx.drawImage(cv, R(z.r != null ? z.x - z.r : z.x), R(z.r != null ? z.y - z.r : z.y));
      });
      if (o.path !== false) { const ps = o.path || {}; f.paths.forEach(p => D().polyline(ctx, p.pts, { color: ps.color || 'rgba(30,21,56,.45)', dash: ps.dash || [2, 3] })); }
      f.blockers.forEach(b => {
        const a = (o.blocker && o.blocker(b)) || {}, s = a.size || 14, x = R(b.x - s / 2), y = R(b.y - s / 2);
        drawThing(ctx, a, x, y, s, t, '#8a5a2b');
        if (o.hpBar !== false) D().bar(ctx, x - 1, y - 5, s + 2, 4, b.hp / b.maxHp, { fill: b.hp / b.maxHp < 0.34 ? '#e0245e' : '#2f8a4a' });
      });
      f.units.forEach(u => {
        const a = (o.unit && o.unit(u)) || {}, s = a.size || 8;
        drawThing(ctx, a, R(u.x - s / 2), R(u.y - s / 2), s, t, '#7a4f2a');
      });
    }
  }
  /* art key, icon, or an ink-outlined pixel blob */
  function drawThing(ctx, a, x, y, s, t, color) {
    if (a.art && AG.assets) { AG.assets.draw(ctx, a.art, x, y, s, s, a.frame); return; }
    if (a.icon && AG.gfx && s >= 18) { AG.gfx.drawIcon(ctx, a.icon, x + R((s - 18 * Math.floor(s / 18)) / 2), y, Math.max(1, Math.floor(s / 18))); return; }
    ctx.fillStyle = INK; ctx.fillRect(x + 1, y, s - 2, s); ctx.fillRect(x, y + 1, s, s - 2);
    ctx.fillStyle = a.color || color; ctx.fillRect(x + 1, y + 1, s - 2, s - 2);
  }

  AG.sim = AG.sim || {};
  Object.assign(AG.sim, { CrowdView, FollowersView });
})(window.AG);
