/* E2 SCENE-TAP ENGINE — Magnifier (a round 64 px lens at 2× over the aim point) and Flashlight
 * (a dark scene with a dithered reveal that follows the reticle or the last touch, built on the
 * E1 grid engine's Darkness). Both are drawn by a SceneView each frame; toggle with .enabled.
 * Docs: kalasag-dev/minigames/docs/engines/scenetap.md
 *
 *   new AG.scenetap.SceneView({ …, magnifier: true | { size: 64, zoom: 2, lift: 44 },
 *                                   flashlight: true | { r: 44, color, alpha, rings: 3, ringWidth: 4, lights: [], glows: [] } })
 *   view.magnifier.enabled = false;  view.flashlight.r = 60;  view.flashlight.lights = [{ x, y, r }]   (scene px)
 * The lens samples what is already drawn (darkness included), so it never shows what the light
 * hides. For touch players it floats `lift` px above the finger so the finger doesn't cover it. */
window.AG = window.AG || {};
(function (AG) {
  const P = () => AG.scenetap.px;

  class Magnifier {
    constructor(o) {
      o = o || {};
      this.size = Math.round(o.size || 64); this.zoom = Math.max(2, Math.round(o.zoom || 2)); this.lift = o.lift == null ? 44 : o.lift;
      this.enabled = o.enabled !== false;
      const S = this.size, r = S / 2;
      this.lens = P().mkCanvas(S, S); this.lctx = this.lens.getContext('2d'); this.lctx.imageSmoothingEnabled = false;
      this.mask = P().mkCanvas(S, S); this.ring = P().mkCanvas(S + 6, S + 6);
      const m = this.mask.getContext('2d'), g = this.ring.getContext('2d');
      m.fillStyle = '#000';
      for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) if (Math.hypot(x + 0.5 - r, y + 0.5 - r) <= r) m.fillRect(x, y, 1, 1);
      for (let y = 0; y < S + 6; y++) for (let x = 0; x < S + 6; x++) {
        const d = Math.hypot(x + 0.5 - r - 3, y + 0.5 - r - 3);
        if (d > r && d <= r + 3) { g.fillStyle = P().INK; g.fillRect(x, y, 1, 1); }
        else if (d > r - 1 && d <= r) { g.fillStyle = P().WHITE; g.fillRect(x, y, 1, 1); }
      }
    }
    draw(c, view) {
      if (!this.enabled) return;
      const S = this.size, src = S / this.zoom, VW = view.o.viewW, VH = view.o.viewH;
      const s = view.cam.toScreen(view.aim.x, view.aim.y), sx = Math.round(s.x), sy = Math.round(s.y);
      const l = this.lctx;
      l.globalCompositeOperation = 'source-over'; l.fillStyle = P().INK; l.fillRect(0, 0, S, S);
      l.drawImage(view.cv, sx - src / 2, sy - src / 2, src, src, 0, 0, S, S);
      l.globalCompositeOperation = 'destination-in'; l.drawImage(this.mask, 0, 0);
      l.globalCompositeOperation = 'source-over';
      const lift = AG.input && AG.input.lastDevice === 'touch' ? this.lift : 0;
      const cx = AG.util.clamp(sx, S / 2 + 3, VW - S / 2 - 3), cy = AG.util.clamp(sy - lift, S / 2 + 3, VH - S / 2 - 3);
      c.drawImage(this.lens, cx - S / 2, cy - S / 2);
      c.drawImage(this.ring, cx - S / 2 - 3, cy - S / 2 - 3);
    }
  }

  class Flashlight {
    constructor(o) {
      o = o || {};
      this.r = o.r || 44; this.enabled = o.enabled !== false;
      this.lights = o.lights || []; this.glows = o.glows || [];
      this.opts = { color: o.color || '#0a0b1f', alpha: o.alpha == null ? 0.96 : o.alpha, rings: o.rings == null ? 3 : o.rings, ringWidth: o.ringWidth || 4 };
      this.dark = null;
    }
    draw(c, view) {
      if (!this.enabled) return;
      if (!AG.grid || !AG.grid.Darkness) { AG.warnOnce('scenetap:darkness', 'Flashlight needs engines/grid/darkness.js'); return; }
      if (!this.dark || this.dark.w !== view.o.viewW || this.dark.h !== view.o.viewH) this.dark = new AG.grid.Darkness(Object.assign({ w: view.o.viewW, h: view.o.viewH }, this.opts));
      this.dark.draw(c, { cam: view.cam, lights: [{ x: view.aim.x, y: view.aim.y, r: this.r }].concat(this.lights), glows: this.glows, t: view.t });
    }
  }

  AG.scenetap = Object.assign(AG.scenetap || {}, { Magnifier, Flashlight });
})(window.AG);
