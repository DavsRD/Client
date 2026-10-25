/* E2 SCENE-TAP ENGINE — ObjectLayer: sprites standing at zone positions in a SceneView, with a
 * 1 px outline highlight traced around the sprite's own pixels, a whole-pixel shake and frame
 * swaps by state (e.g. 'fixed'). Drawn in scene px under the view's camera, so 1 px grows with zoom.
 * Docs: kalasag-dev/minigames/docs/engines/scenetap.md
 *
 *   const objects = new AG.scenetap.ObjectLayer({ outline: '#ff7a1a', items: [
 *     { id: 'desk', zone: 'desk', art: 'drop-cover-hold.obj.desk' },            // centred in the zone's box
 *     { id: 'plug', zone: 'toy', x: 190, y: 110, w: 18, h: 18, art: { normal: 'k.plug', fixed: 'k.plug_safe' } },
 *     { id: 'sign', art: 'k.sign_2f', frames: { normal: 0, fixed: 1 }, x: 40, y: 20 },
 *     { id: 'lamp', zone: 'lamp', draw(ctx, x, y, w, h, item, t) { … } } ] });
 *   new AG.scenetap.SceneView({ …, objects });   // cycle mode outlines the highlighted zone's object
 *   objects.setState('plug', 'fixed')  objects.shake('desk', 320)  objects.highlight('desk')  objects.show('sign', false) */
window.AG = window.AG || {};
(function (AG) {
  const P = () => AG.scenetap.px;
  const outlines = new Map();
  let srcIds = new WeakMap(), nextSrc = 1;
  const srcId = cv => { if (!srcIds.has(cv)) srcIds.set(cv, nextSrc++); return 'cv' + srcIds.get(cv); };

  /** A (w+2) × (h+2) canvas: a 1 px ring of `color` around the sprite's opaque pixels. */
  function outlineOf(img, sx, sy, sw, sh, w, h, color, id) {
    const key = id + ':' + sx + ':' + w + 'x' + h + color;
    if (outlines.has(key)) return outlines.get(key);
    const cv = P().mkCanvas(w + 2, h + 2), c = cv.getContext('2d');
    c.imageSmoothingEnabled = false;
    [[0, 1], [2, 1], [1, 0], [1, 2]].forEach(([ox, oy]) => c.drawImage(img, sx, sy, sw, sh, ox, oy, w, h));
    c.globalCompositeOperation = 'source-in'; c.fillStyle = color; c.fillRect(0, 0, w + 2, h + 2);
    c.globalCompositeOperation = 'destination-out'; c.drawImage(img, sx, sy, sw, sh, 1, 1, w, h);
    if (outlines.size > 200) outlines.clear();
    outlines.set(key, cv);
    return cv;
  }

  class ObjectLayer {
    constructor(o) {
      o = o || {};
      this.outline = o.outline || P().VEST; this.t = 0;
      this.items = (o.items || []).map(s => this.norm(s));
    }
    norm(s) { return Object.assign({ state: 'normal', hidden: false, highlight: false, shakeUntil: 0, amp: 1 }, s); }
    add(spec) { const it = this.norm(spec); this.items.push(it); return it; }
    remove(id) { this.items = this.items.filter(i => i.id !== id); }
    get(id) { return this.items.find(i => i.id === id) || null; }
    forZone(zoneId) { return this.items.find(i => i.zone === zoneId && !i.hidden) || null; }
    /** Frame swap: art[state] when art is a map, else frames[state] (or 0 normal / 1 otherwise) of a strip. */
    setState(id, state) { const it = this.get(id); if (it) it.state = state; return it; }
    show(id, on) { const it = this.get(id); if (it) it.hidden = on === false; return it; }
    highlight(id) { this.items.forEach(i => { i.highlight = i.id === id; }); }
    /** A whole-pixel side-to-side shake (none with Reduce Motion: show the change another way too). */
    shake(id, ms, amp) {
      const it = this.get(id);
      if (it && !AG.reducedMotion()) { it.shakeUntil = this.t + (ms || 320) / 1000; it.amp = amp || 1; }
      return it;
    }
    update(dt) { this.t += dt || 0; }

    /** Where an item stands, in scene px (rounded). */
    box(it, view) {
      const src = this.source(it), aw = it.w || (src && src.sw), ah = it.h || (src && src.sh);
      if (it.x != null && it.y != null) return { x: Math.round(it.x), y: Math.round(it.y), w: Math.round(aw || 16), h: Math.round(ah || 16) };
      const z = it.zone != null && view && view.zones.get(it.zone);
      if (!z) return { x: 0, y: 0, w: Math.round(aw || 16), h: Math.round(ah || 16) };
      const b = view.zones.bounds(z), bx = b.x * view.W, by = b.y * view.H, bw = b.w * view.W, bh = b.h * view.H;
      const w = aw || bw, hh = ah || bh;
      return { x: Math.round(bx + (bw - w) / 2), y: Math.round(by + (bh - hh) / 2), w: Math.round(w), h: Math.round(hh) };
    }
    /** The current frame's source rect, or null while the art is loading / missing. */
    source(it) {
      const art = it.art && typeof it.art === 'object' && !it.art.getContext && !it.art.tagName ? (it.art[it.state] || it.art.normal) : it.art;
      if (!art) return null;
      if (typeof art !== 'string') return { img: art, sx: 0, sy: 0, sw: art.naturalWidth || art.width, sh: art.naturalHeight || art.height, id: srcId(art), key: null };
      const rec = AG.assets.image(art);
      if (!rec.ok) return { img: null, sw: rec.frameW || rec.w, sh: rec.h, key: art };
      const frame = it.frame != null ? it.frame : it.frames ? (it.frames[it.state] || 0) : art === it.art && it.state !== 'normal' && rec.frames > 1 ? 1 : 0;
      const fw = rec.frameW || rec.img.naturalWidth;
      return { img: rec.img, sx: (frame % rec.frames) * fw, sy: 0, sw: fw, sh: rec.img.naturalHeight, id: art, key: art };
    }
    draw(c, t, view, hlId) {
      for (const it of this.items) {
        if (it.hidden) continue;
        const b = this.box(it, view), src = this.source(it);
        const dx = this.t < it.shakeUntil ? (Math.floor(this.t * 25) % 2 ? it.amp : -it.amp) : 0;
        const x = b.x + dx, y = b.y;
        if (it.draw) it.draw(c, x, y, b.w, b.h, it, t);
        else if (src && src.img) c.drawImage(src.img, src.sx, src.sy, src.sw, src.sh, x, y, b.w, b.h);
        else if (src) AG.assets.draw(c, src.key, x, y, b.w, b.h); // labelled placeholder
        if (it.highlight || it.id === hlId) {
          if (src && src.img) c.drawImage(outlineOf(src.img, src.sx, src.sy, src.sw, src.sh, b.w, b.h, this.outline, src.id), x - 1, y - 1);
          else { c.fillStyle = this.outline; c.fillRect(x - 1, y - 1, b.w + 2, 1); c.fillRect(x - 1, y + b.h, b.w + 2, 1); c.fillRect(x - 1, y, 1, b.h); c.fillRect(x + b.w, y, 1, b.h); }
        }
      }
    }
  }

  AG.scenetap = Object.assign(AG.scenetap || {}, { ObjectLayer });
})(window.AG);
