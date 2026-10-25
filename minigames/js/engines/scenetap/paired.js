/* E2 SCENE-TAP ENGINE — PairedScenes: two SceneViews of the same-sized pictures, side by side
 * (landscape) or stacked (portrait), sharing one set of HitZones. Tab moves the reticle to the
 * same normalised spot on the other picture; a hit counts on either; marks show on both.
 * Docs: kalasag-dev/minigames/docs/engines/scenetap.md
 *
 *   const pair = new AG.scenetap.PairedScenes({ a: 'spot-the-shock.pair.1-1_a', b: 'spot-the-shock.pair.1-1_b',
 *     zones: level.differences, mode: 'reticle', layout: 'auto' | 'row' | 'col',
 *     onPick(zone, info) { pair.mark(zone); … },  onMiss(info) { … } });     // info.side = 'a' | 'b'
 *   stage.append(pair.el);  pair.active (0 | 1)  pair.switchTo(i)  pair.views  pair.enabled = false  pair.destroy()
 * Each view is its own canvas, sized to the picture unless viewW / viewH say otherwise. Pan and
 * zoom stay in step on both (syncCamera: false to stop that). The other picture shows a faint
 * reticle at the same spot. */
window.AG = window.AG || {};
(function (AG) {
  const { h } = AG.util;
  const SIDES = ['a', 'b'];

  class PairedScenes {
    constructor(o) {
      o = this.o = Object.assign({ layout: 'auto', mode: 'reticle', syncCamera: true }, o);
      const first = typeof o.a === 'string' ? AG.assets.image(o.a) : null;
      const W = o.w || (first && first.w) || 224, H = o.h || (first && first.h) || 168;
      this.zones = o.zones && o.zones.hitTest ? o.zones : new AG.logic.HitZones(o.zones || [], { w: W, h: H });
      this.offs = []; this._active = 0; this.syncing = false;
      const labels = o.labels || [AG.t('scenetap.sideA'), AG.t('scenetap.sideB')];
      const lens = (opt, Cls) => (opt ? new Cls(opt === true ? {} : opt) : null);
      this.views = SIDES.map((side, i) => new AG.scenetap.SceneView({
        scene: o[side], w: W, h: H, viewW: o.viewW || W, viewH: o.viewH || H, zones: this.zones, mode: o.mode, zooms: o.zooms,
        tolerance: o.tolerance, reticle: o.reticle, dragMode: o.dragMode, markerArt: o.markerArt, describe: o.describe, order: o.order,
        label: labels[i], loop: false, magnifier: lens(o.magnifier, AG.scenetap.Magnifier), flashlight: lens(o.flashlight, AG.scenetap.Flashlight),
        objects: o.objects && o.objects[side],
        onPick: (zone, info) => { this.switchTo(i, false); if (o.onPick) o.onPick(zone, Object.assign(info, { side })); },
        onMiss: info => { this.switchTo(i, false); if (o.onMiss) o.onMiss(Object.assign(info, { side })); },
        onHighlight: (zone, info) => { const other = this.views[1 - i]; if (other && other.hiId !== zone.id) other.hiId = zone.id; if (o.onHighlight) o.onHighlight(zone, Object.assign(info, { side })); },
        onCamera: v => this.sync(v),
        drawWorld: o.drawWorld && ((c, v, t) => o.drawWorld(c, v, t, side)),
        drawScreen: o.drawScreen && ((c, v, t) => o.drawScreen(c, v, t, side))
      }));
      this.sides = this.views.map((v, i) => h('div', { class: 'ags-pair__side', 'data-side': SIDES[i] }, h('div', { class: 'ags-pair__cap' }, AG.pick(labels[i])), v.el));
      this.el = h('div', { class: 'ags-pair ags-pair--col' }, this.sides);
      this.switchTo(0, false, true);

      if (AG.input) this.offs.push(AG.input.on('NEXT_ZONE', e => { if (e.phase === 'down' && this.enabled) { this.switchTo(1 - this._active, true); if (AG.sfx) AG.sfx.play('tap'); } }));
      if (o.loop !== false) this.stopLoop = AG.gfx.loop(dt => this.frame(dt));
      if (o.layout === 'auto' && typeof ResizeObserver !== 'undefined') {
        this.ro = new ResizeObserver(() => this.layout());
        this.ro.observe(this.el);
      } else this.layout();
    }
    get active() { return this._active; }
    get view() { return this.views[this._active]; }
    get enabled() { return this.views[0].enabled; }
    set enabled(v) { this.views.forEach(x => { x.enabled = v; }); }
    layout() {
      const row = this.o.layout === 'row' || (this.o.layout === 'auto' && this.el.clientWidth >= 520 && window.innerWidth >= window.innerHeight);
      this.el.classList.toggle('ags-pair--row', row); this.el.classList.toggle('ags-pair--col', !row);
    }
    /** Makes side i the one the keys drive. carry: put its reticle on the same normalised spot. */
    switchTo(i, carry, quiet) {
      const from = this.views[this._active], to = this.views[i];
      if (carry && from !== to) {
        const n = from.toNorm(from.reticle.x, from.reticle.y);
        to.aimAt(n.x * to.W, n.y * to.H, true);
        if (from.hiId != null) to.hiId = from.hiId;
      }
      const changed = i !== this._active;
      this._active = i;
      this.views.forEach((v, j) => { v.keysOn = j === i; });
      this.sides.forEach((s, j) => s.classList.toggle('is-active', j === i));
      if (changed && !quiet) to.announce(AG.t('scenetap.onSide', { name: AG.pick((this.o.labels || [AG.t('scenetap.sideA'), AG.t('scenetap.sideB')])[i]) }));
    }
    /** Keeps pan and zoom the same on both pictures (by normalised position). */
    sync(v) {
      if (!this.o.syncCamera || this.syncing) return;
      this.syncing = true;
      const other = this.views[1 - this.views.indexOf(v)];
      if (other) {
        if (other.cam.k !== v.cam.k) other.cam.setZoom(v.cam.k);
        other.cam.scrollTo(v.cam.fx / v.W * other.W, v.cam.fy / v.H * other.H);
      }
      this.syncing = false;
    }
    mark(target, kind, ms) { return this.views.map(v => v.mark(target, kind, ms)); }
    clearMarks(kind) { this.views.forEach(v => v.clearMarks(kind)); }
    frame(dt) {
      const a = this.view, n = a.toNorm(a.reticle.x, a.reticle.y);
      this.views.forEach(v => { v.ghost = v !== a && v.mode === 'reticle' ? { x: n.x * v.W, y: n.y * v.H } : null; v.frame(dt); });
    }
    destroy() {
      if (this.stopLoop) this.stopLoop();
      if (this.ro) this.ro.disconnect();
      this.offs.forEach(f => f()); this.offs = [];
      this.views.forEach(v => v.destroy());
      this.el.remove();
    }
  }

  AG.scenetap = Object.assign(AG.scenetap || {}, { PairedScenes });
})(window.AG);
