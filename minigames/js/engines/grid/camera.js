/* E1 GRID ENGINE — Camera: what part of the world a 480 × 270 canvas shows. No DOM, so it
 * is tested like the pure parts. Scroll is always whole pixels (crisp sprites).
 * Docs: kalasag-dev/minigames/docs/engines/grid.md
 *
 *   const cam = new AG.grid.Camera({ viewW: 480, viewH: 270, map, mode: 'follow' | 'fixed' | 'manual',
 *                                    deadzone: { w: 120, h: 68 } | { x, y, w, h }, smooth: 0, zoom: 1 });
 *   cam.follow(mover.cx, mover.cy); cam.update(dt);   // follow: keep the target in the deadzone
 *   cam.snap()                                        // jump straight to the target (level start)
 *   cam.scrollTo(x, y) / cam.scrollBy(dx, dy)          // manual mode (or any mode, then clamped)
 *   cam.begin(ctx) … draw in world pixels … cam.end(ctx)
 *   cam.toScreen(wx, wy)  cam.toWorld(sx, sy)  cam.view() → { x, y, w, h } in world pixels
 * 'fixed' = fixed-fit: the whole world, centred, at the biggest whole zoom that fits (at least
 * 1×). In every mode a world smaller than the view is centred on that axis, and the scroll is
 * clamped to the world's edges. smooth = catch-up rate per second (0 = snap; Reduce Motion
 * always snaps). */
window.AG = window.AG || {};
(function (AG) {
  class Camera {
    constructor(o) {
      o = o || {};
      this.viewW = o.viewW || 480; this.viewH = o.viewH || 270;
      this.mode = o.mode || 'follow'; this.smooth = o.smooth || 0; this.zoomOpt = o.zoom || 1;
      this.deadzoneOpt = o.deadzone || null;
      this.fx = 0; this.fy = 0; this.tx = 0; this.ty = 0;
      this.setWorld(o.map ? o.map.pw : o.worldW || this.viewW, o.map ? o.map.ph : o.worldH || this.viewH);
    }
    setWorld(w, h) {
      this.worldW = w; this.worldH = h;
      const fit = Math.floor(Math.min(this.viewW / w, this.viewH / h));
      this.k = this.mode === 'fixed' ? Math.max(1, fit) : Math.max(1, Math.round(this.zoomOpt));
      const vw = this.viewW / this.k, vh = this.viewH / this.k;
      this.ox = w * this.k < this.viewW ? Math.floor((this.viewW - w * this.k) / 2) : 0;
      this.oy = h * this.k < this.viewH ? Math.floor((this.viewH - h * this.k) / 2) : 0;
      this.maxX = Math.max(0, Math.ceil(w - vw)); this.maxY = Math.max(0, Math.ceil(h - vh));
      const dz = this.deadzoneOpt || { w: Math.round(this.viewW / 4), h: Math.round(this.viewH / 4) };
      this.deadzone = { x: dz.x != null ? dz.x : Math.round((this.viewW - dz.w) / 2), y: dz.y != null ? dz.y : Math.round((this.viewH - dz.h) / 2), w: dz.w, h: dz.h };
      this.clampNow();
      return this;
    }
    get x() { return Math.round(this.fx); }
    get y() { return Math.round(this.fy); }
    clampNow() { this.fx = Math.max(0, Math.min(this.maxX, this.fx)); this.fy = Math.max(0, Math.min(this.maxY, this.fy)); }

    follow(wx, wy) { this.tx = wx; this.ty = wy; return this; }
    /** Where the scroll should be so the target sits inside the deadzone. */
    desired() {
      const dz = this.deadzone, k = this.k;
      let x = this.fx, y = this.fy;
      const sx = (this.tx - x) * k, sy = (this.ty - y) * k;
      if (sx < dz.x) x = this.tx - dz.x / k; else if (sx > dz.x + dz.w) x = this.tx - (dz.x + dz.w) / k;
      if (sy < dz.y) y = this.ty - dz.y / k; else if (sy > dz.y + dz.h) y = this.ty - (dz.y + dz.h) / k;
      return { x: Math.max(0, Math.min(this.maxX, x)), y: Math.max(0, Math.min(this.maxY, y)) };
    }
    update(dt) {
      if (this.mode !== 'follow') return this;
      const d = this.desired();
      const reduce = typeof AG.reducedMotion === 'function' && AG.reducedMotion();
      const a = this.smooth > 0 && !reduce ? 1 - Math.exp(-this.smooth * (dt || 0)) : 1;
      this.fx += (d.x - this.fx) * a; this.fy += (d.y - this.fy) * a;
      if (Math.abs(d.x - this.fx) < 0.5) this.fx = d.x;
      if (Math.abs(d.y - this.fy) < 0.5) this.fy = d.y;
      return this;
    }
    /** Centre the target (inside the clamp) at once: a level start or a respawn. */
    snap() {
      if (this.mode !== 'follow') return this;
      this.fx = this.tx - this.viewW / this.k / 2; this.fy = this.ty - this.viewH / this.k / 2;
      this.clampNow();
      return this;
    }
    scrollTo(x, y) { this.fx = x; this.fy = y; this.clampNow(); return this; }
    scrollBy(dx, dy) { return this.scrollTo(this.fx + dx, this.fy + dy); }

    begin(ctx) { ctx.save(); ctx.translate(this.ox, this.oy); if (this.k !== 1) ctx.scale(this.k, this.k); ctx.translate(-this.x, -this.y); }
    end(ctx) { ctx.restore(); }
    toScreen(wx, wy) { return { x: (wx - this.x) * this.k + this.ox, y: (wy - this.y) * this.k + this.oy }; }
    toWorld(sx, sy) { return { x: (sx - this.ox) / this.k + this.x, y: (sy - this.oy) / this.k + this.y }; }
    view() { return { x: this.x, y: this.y, w: Math.min(this.worldW, Math.ceil(this.viewW / this.k)), h: Math.min(this.worldH, Math.ceil(this.viewH / this.k)) }; }
  }

  AG.grid = Object.assign(AG.grid || {}, { Camera });
})(window.AG);
