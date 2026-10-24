/* E1 GRID ENGINE — Darkness: a dark mask with dithered circular reveals (a power outage, a
 * night road) and glow sprites that stay visible through it (exit signs, a lit centre).
 * Docs: kalasag-dev/minigames/docs/engines/grid.md
 *
 *   const dark = new AG.grid.Darkness({ w: 480, h: 270, color: '#0a0b1f', alpha: 1, rings: 3, ringWidth: 4 });
 *   dark.draw(ctx, {
 *     cam,                                          // optional: lights and glows in world px
 *     lights: [{ x, y, r }],                        // centre + radius in px (2.5 tiles = 50 at 20 px)
 *     glows: [{ x, y, w, h, key, frame } | { x, y, icon } | { x, y, w, h, draw(ctx, x, y, w, h) }, halo?: px],
 *     t
 *   });
 * Call it after the world, in screen space (outside cam.begin / cam.end). Each reveal is a
 * clear circle with 2–3 rings of ordered (Bayer 4 × 4) dither around it: 25 / 50 / 75 % dark
 * for 3 rings. The dither is aligned to the screen, so the pattern never swims as a light
 * moves; only the ring edges move, in whole pixels. Stamps are cached per radius. */
window.AG = window.AG || {};
(function (AG) {
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

  class Darkness {
    constructor(o) {
      o = o || {};
      this.w = o.w || 480; this.h = o.h || 270;
      this.color = o.color || '#0a0b1f'; this.alpha = o.alpha == null ? 1 : o.alpha;
      this.rings = Math.max(0, Math.min(3, o.rings == null ? 3 : o.rings)); this.ringWidth = o.ringWidth || 4;
      this.enabled = o.enabled !== false;
      this.stamps = new Map();
      this.mask = document.createElement('canvas'); this.mask.width = this.w; this.mask.height = this.h;
      this.mctx = this.mask.getContext('2d');
    }
    /** A light stamp of radius r, its dither lined up for a centre at (cx & 3, cy & 3). */
    stamp(r, ax, ay) {
      const key = r + ':' + ax + ':' + ay;
      if (this.stamps.has(key)) return this.stamps.get(key);
      const S = 2 * r + 1, cv = document.createElement('canvas'); cv.width = cv.height = S;
      const c = cv.getContext('2d'), img = c.createImageData(S, S), d = img.data;
      const inner = Math.max(0, r - this.rings * this.ringWidth);
      for (let py = 0; py < S; py++) for (let px = 0; px < S; px++) {
        const dist = Math.hypot(px - r, py - r);
        let lit = dist <= inner;
        if (!lit && dist <= r) {
          const ring = Math.min(this.rings, Math.ceil((dist - inner) / this.ringWidth)); // 1 = the inner ring
          const dark = ring / (this.rings + 1) * 16;
          lit = BAYER[((py + ay) & 3) * 4 + ((px + ax) & 3)] >= dark;
        }
        if (lit) d[(py * S + px) * 4 + 3] = 255;
      }
      c.putImageData(img, 0, 0);
      if (this.stamps.size > 256) this.stamps.clear();
      this.stamps.set(key, cv);
      return cv;
    }
    draw(ctx, o) {
      if (!this.enabled) return;
      o = o || {};
      const cam = o.cam, k = cam ? cam.k : 1, m = this.mctx;
      const at = (x, y) => (cam ? cam.toScreen(x, y) : { x, y });
      m.globalCompositeOperation = 'source-over'; m.globalAlpha = 1;
      m.clearRect(0, 0, this.w, this.h);
      m.globalAlpha = this.alpha; m.fillStyle = this.color; m.fillRect(0, 0, this.w, this.h);
      m.globalAlpha = 1; m.globalCompositeOperation = 'destination-out';
      const reveal = (x, y, r) => {
        const p = at(x, y), cx = Math.round(p.x), cy = Math.round(p.y), rr = Math.max(1, Math.round(r * k));
        m.drawImage(this.stamp(rr, (cx - rr) & 3, (cy - rr) & 3), cx - rr, cy - rr);
      };
      (o.lights || []).forEach(L => reveal(L.x, L.y, L.r));
      (o.glows || []).forEach(g => { if (g.halo) reveal(g.x + (g.w || 18) / 2, g.y + (g.h || 18) / 2, g.halo); });
      m.globalCompositeOperation = 'source-over';
      ctx.drawImage(this.mask, 0, 0);
      // glow sprites on top: visible however dark it is
      for (const g of o.glows || []) {
        const p = at(g.x, g.y), w = (g.w || 18) * k, h = (g.h || 18) * k;
        if (g.draw) g.draw(ctx, Math.round(p.x), Math.round(p.y), w, h, o.t);
        else if (g.icon) AG.gfx.drawIcon(ctx, g.icon, p.x, p.y, k);
        else if (g.key) AG.assets.draw(ctx, g.key, p.x, p.y, w, h, g.frame || 0);
      }
    }
  }

  AG.grid = Object.assign(AG.grid || {}, { Darkness });
})(window.AG);
