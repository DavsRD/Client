/* E2 SCENE-TAP ENGINE — SceneCam (pure): which part of a scene a canvas viewport shows, at a
 * whole zoom step (1×, 2×). Scroll is in whole scene pixels and clamped to the scene; a scene
 * smaller than the view is centred on that axis. No DOM, so it is tested directly.
 * Docs: kalasag-dev/minigames/docs/engines/scenetap.md
 *
 *   const cam = new AG.logic.SceneCam({ viewW: 480, viewH: 270, worldW: 800, worldH: 450, zooms: [1, 2], zoom: 1 });
 *   cam.toScreen(wx, wy) / cam.toWorld(sx, sy)          scene px ↔ canvas px
 *   cam.normToScreen(nx, ny) / cam.screenToNorm(sx, sy) 0..1 of the scene ↔ canvas px
 *   cam.setZoom(k, sx, sy)   the scene point under (sx, sy) stays put (default: the view centre)
 *   cam.zoomStep(±1, sx, sy)  cam.scrollTo(x, y)  cam.scrollBy(dx, dy)  cam.centreOn(wx, wy)
 *   cam.push(wx, wy, 30)     scrolls so the point stays ≥ 30 canvas px from the view's edges
 *   cam.begin(ctx) … draw in scene px … cam.end(ctx)     cam.k  cam.x  cam.y  cam.canScroll  */
(function (root) {
  const AG = root.AG = root.AG || {};

  class SceneCam {
    constructor(o) {
      o = o || {};
      this.viewW = o.viewW || 480; this.viewH = o.viewH || 270;
      this.zooms = (o.zooms || [1, 2]).map(z => Math.max(1, Math.round(z)));
      this.k = this.zooms.includes(o.zoom) ? o.zoom : this.zooms[0];
      this.fx = 0; this.fy = 0;
      this.setWorld(o.worldW || this.viewW, o.worldH || this.viewH);
    }
    setWorld(w, h) { this.worldW = w; this.worldH = h; this.layout(); return this; }
    layout() {
      const k = this.k;
      this.ox = this.worldW * k < this.viewW ? Math.floor((this.viewW - this.worldW * k) / 2) : 0;
      this.oy = this.worldH * k < this.viewH ? Math.floor((this.viewH - this.worldH * k) / 2) : 0;
      this.maxX = Math.max(0, Math.ceil(this.worldW - this.viewW / k));
      this.maxY = Math.max(0, Math.ceil(this.worldH - this.viewH / k));
      this.clamp();
    }
    clamp() { this.fx = Math.max(0, Math.min(this.maxX, this.fx)); this.fy = Math.max(0, Math.min(this.maxY, this.fy)); return this; }
    get x() { return Math.round(this.fx); }
    get y() { return Math.round(this.fy); }
    get canScroll() { return this.maxX > 0 || this.maxY > 0; }
    get zoomIndex() { return this.zooms.indexOf(this.k); }

    setZoom(k, sx, sy) {
      if (!this.zooms.includes(k) || k === this.k) return false;
      if (sx == null) { sx = this.viewW / 2; sy = this.viewH / 2; }
      const wx = (sx - this.ox) / this.k + this.fx, wy = (sy - this.oy) / this.k + this.fy;
      this.k = k; this.layout();
      this.fx = wx - (sx - this.ox) / k; this.fy = wy - (sy - this.oy) / k;
      this.clamp();
      return true;
    }
    /** One zoom step in (+1) or out (-1); false at the end of the list. */
    zoomStep(dir, sx, sy) { const z = this.zooms[this.zoomIndex + (dir > 0 ? 1 : -1)]; return z != null && this.setZoom(z, sx, sy); }
    /** Z: the next zoom, wrapping round (1× → 2× → 1×). */
    toggleZoom(sx, sy) { return this.setZoom(this.zooms[(this.zoomIndex + 1) % this.zooms.length], sx, sy); }

    scrollTo(x, y) { this.fx = x; this.fy = y; return this.clamp(); }
    scrollBy(dx, dy) { return this.scrollTo(this.fx + dx, this.fy + dy); }
    centreOn(wx, wy) { return this.scrollTo(wx - this.viewW / this.k / 2, wy - this.viewH / this.k / 2); }
    /** Keeps the scene point (wx, wy) at least `margin` canvas px inside the view; true if it scrolled. */
    push(wx, wy, margin) {
      const m = margin == null ? 30 : margin, k = this.k, s = this.toScreen(wx, wy), x0 = this.x, y0 = this.y;
      if (s.x < m) this.fx = wx - (m - this.ox) / k; else if (s.x > this.viewW - m) this.fx = wx - (this.viewW - m - this.ox) / k;
      if (s.y < m) this.fy = wy - (m - this.oy) / k; else if (s.y > this.viewH - m) this.fy = wy - (this.viewH - m - this.oy) / k;
      this.clamp();
      return this.x !== x0 || this.y !== y0;
    }

    toScreen(wx, wy) { return { x: (wx - this.x) * this.k + this.ox, y: (wy - this.y) * this.k + this.oy }; }
    toWorld(sx, sy) { return { x: (sx - this.ox) / this.k + this.x, y: (sy - this.oy) / this.k + this.y }; }
    normToScreen(nx, ny) { return this.toScreen(nx * this.worldW, ny * this.worldH); }
    screenToNorm(sx, sy) { const w = this.toWorld(sx, sy); return { x: w.x / this.worldW, y: w.y / this.worldH }; }
    /** Is the canvas point over the scene (not the border around a small scene)? */
    onScene(sx, sy) { const w = this.toWorld(sx, sy); return w.x >= 0 && w.y >= 0 && w.x <= this.worldW && w.y <= this.worldH; }
    /** The part of the scene in view, in scene px. */
    view() { return { x: this.x, y: this.y, w: Math.min(this.worldW, this.viewW / this.k), h: Math.min(this.worldH, this.viewH / this.k) }; }

    begin(ctx) { ctx.save(); ctx.translate(this.ox, this.oy); if (this.k !== 1) ctx.scale(this.k, this.k); ctx.translate(-this.x, -this.y); }
    end(ctx) { ctx.restore(); }
  }

  AG.logic = AG.logic || {};
  AG.logic.SceneCam = SceneCam;
  if (typeof module !== 'undefined') module.exports = SceneCam;
})(typeof window !== 'undefined' ? window : globalThis);
