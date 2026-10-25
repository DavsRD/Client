/* E2 SCENE-TAP ENGINE — the base: the AG.scenetap namespace, its stylesheet and strings, pixel
 * drawing helpers, and SceneView: a pixel-art scene (an image or layers) on a canvas viewport
 * (480 × 270 by default) that may be bigger than the view. Touch drag pans, pinch zooms in whole
 * steps, Z toggles zoom; 'reticle' mode aims freely, 'cycle' mode steps a highlight through zones.
 * Docs: kalasag-dev/minigames/docs/engines/scenetap.md (styles: minigames/css/scenetap.css, ags- classes)
 *
 *   const view = new AG.scenetap.SceneView({ scene: 'lost-and-found.scene.mall', zones, mode: 'reticle',
 *                                            onPick(zone, info) { … }, onMiss(info) { … } });
 *   stage.append(view.el);  view.mark(zone);  view.enabled = false;  view.destroy();
 * SceneView owns pointer input on its own canvas (it needs two fingers for pinch, and paired
 * views need their own coordinates), so games don't add AG.input.onPointer handlers for it. */
window.AG = window.AG || {};
(function (AG) {
  const { h, clamp } = AG.util;

  if (typeof document !== 'undefined' && !document.querySelector('link[data-ag-css="scenetap"]')) {
    document.head.append(h('link', { rel: 'stylesheet', href: AG.path('css/scenetap.css'), 'data-ag-css': 'scenetap' }));
  }

  AG.STRINGS = Object.assign(AG.STRINGS || {}, {
    'scenetap.scene': { en: 'Scene' },
    'scenetap.zoom': { en: 'Zoom' },
    'scenetap.zoomed': { en: 'Zoom {k}×' },
    'scenetap.spot': { en: 'Spot {n} of {count}' },
    'scenetap.sideA': { en: 'Picture A' },
    'scenetap.sideB': { en: 'Picture B' },
    'scenetap.onSide': { en: 'Now on {name}.' },
    'scenetap.tryAgain': { en: 'Not quite. Try another choice.' },
    'scenetap.right': { en: 'Yes, that is the safe choice!' },
    'scenetap.choices': { en: 'What should you do?' }
  });

  const INK = '#1e1538', VEST = '#ff7a1a', WHITE = '#fffaf0', SAFE = '#2f8a4a', DANGER = '#e0245e';
  const sfx = name => { if (name && AG.sfx) AG.sfx.play(name); };
  const mkCanvas = (w, hh) => { const cv = document.createElement('canvas'); cv.width = Math.max(1, w); cv.height = Math.max(1, hh); return cv; };

  /* ---------- pixel helpers (whole pixels only) ---------- */
  /** Integer points along a circle of radius R (canvas px). */
  function ringPoints(cx, cy, R) {
    const pts = [], seen = new Set(), n = Math.max(12, Math.ceil(2 * Math.PI * R));
    for (let i = 0; i < n; i++) {
      const a = i / n * Math.PI * 2, x = Math.round(cx + Math.cos(a) * R), y = Math.round(cy + Math.sin(a) * R), k = x + ',' + y;
      if (!seen.has(k)) { seen.add(k); pts.push([x, y]); }
    }
    return pts;
  }
  /** Bresenham line points. */
  function linePoints(x0, y0, x1, y1, out) {
    out = out || [];
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      out.push([x0, y0]);
      if (x0 === x1 && y0 === y1) return out;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
  }
  /** The outline of a zone in canvas px (under the camera's zoom and scroll). */
  function zonePoints(zone, cam) {
    if (zone.shape === 'circle') { const c = cam.normToScreen(zone.x, zone.y); return ringPoints(Math.round(c.x), Math.round(c.y), Math.max(3, zone.r * cam.worldW * cam.k)); }
    const pts = zone.shape === 'rect'
      ? [[zone.x, zone.y], [zone.x + zone.w, zone.y], [zone.x + zone.w, zone.y + zone.h], [zone.x, zone.y + zone.h]]
      : zone.points;
    const s = pts.map(p => cam.normToScreen(p[0], p[1])), out = [];
    s.forEach((p, i) => linePoints(p.x, p.y, s[(i + 1) % s.length].x, s[(i + 1) % s.length].y, out));
    return out;
  }
  function stamp(c, pts, size, color) {
    c.fillStyle = color; const o = Math.floor(size / 2);
    for (const p of pts) c.fillRect(p[0] - o, p[1] - o, size, size);
  }
  /** A zone outline: 4 px ink under 2 px colour, so it shows on light and dark art. */
  function strokeZone(c, zone, cam, color) { const pts = zonePoints(zone, cam); stamp(c, pts, 4, INK); stamp(c, pts, 2, color || VEST); }

  /* ---------- glyphs: ✔ / ✖ (shape, not just colour), a reticle, a number badge ---------- */
  const GLYPHS = {
    check: ['......#', '.....##', '#...##.', '##.##..', '.###...', '..#....'],
    cross: ['#.....#', '.#...#.', '..#.#..', '...#...', '..#.#..', '.#...#.', '#.....#']
  };
  const glyphCache = new Map();
  /** A glyph at scale s in `color` with a 1-step ink outline, as a cached canvas. */
  function glyph(name, color, s) {
    s = s || 2;
    const key = name + color + s;
    if (glyphCache.has(key)) return glyphCache.get(key);
    const rows = GLYPHS[name], W = rows[0].length, H = rows.length, cv = mkCanvas((W + 2) * s, (H + 2) * s), c = cv.getContext('2d');
    const dots = (col, ox, oy) => { c.fillStyle = col; rows.forEach((r, y) => [...r].forEach((ch, x) => { if (ch === '#') c.fillRect((x + 1 + ox) * s, (y + 1 + oy) * s, s, s); })); };
    [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, 1], [-1, 1], [1, -1]].forEach(([ox, oy]) => dots(INK, ox, oy));
    dots(color, 0, 0);
    glyphCache.set(key, cv);
    return cv;
  }
  let reticleCv = null;
  /** 15 × 15 crosshair: white arms on ink, a vest-orange centre dot. */
  function reticle() {
    if (reticleCv) return reticleCv;
    const cv = mkCanvas(15, 15), c = cv.getContext('2d');
    c.fillStyle = INK; c.fillRect(0, 6, 15, 3); c.fillRect(6, 0, 3, 15);
    c.fillStyle = WHITE; c.fillRect(1, 7, 4, 1); c.fillRect(10, 7, 4, 1); c.fillRect(7, 1, 1, 4); c.fillRect(7, 10, 1, 4);
    c.fillStyle = VEST; c.fillRect(7, 7, 1, 1);
    return (reticleCv = cv);
  }
  /** A number key badge (cycle mode, keyboard only); the highlighted zone's is orange. */
  function badge(c, n, x, y, on) {
    x = Math.round(x); y = Math.round(y);
    c.fillStyle = INK; c.fillRect(x, y, 13, 14);
    c.fillStyle = on ? VEST : WHITE; c.fillRect(x + 1, y + 1, 11, 12);
    AG.gfx.text(c, String(n), x + 7, y + 2, { size: 10, bold: true, align: 'center', color: INK });
  }

  /* ---------- SceneView ---------- */
  const TOL = { keyboard: 4, mouse: 4, touch: 12 };
  const RETICLE = { speed: 150, max: 300, fine: 60, accelMs: 700, margin: 30 };

  class SceneView {
    constructor(o) {
      o = this.o = Object.assign({ mode: 'reticle', viewW: 480, viewH: 270, zooms: [1, 2], dragMode: 'pan', order: 'x', keys: true, loop: true }, o);
      this.mode = o.mode; this._enabled = true; this.keysOn = o.keys !== false; this.t = 0;
      this.tol = typeof o.tolerance === 'number' ? { keyboard: o.tolerance, mouse: o.tolerance, touch: o.tolerance } : Object.assign({}, TOL, o.tolerance);
      this.ret = Object.assign({}, RETICLE, o.reticle && typeof o.reticle === 'object' ? o.reticle : {});
      this.marks = []; this.offs = []; this.ptrs = new Map(); this.g = null; this.pinch = null;
      this.hiId = null; this.held = 0; this.follow = null; this.ghost = null;

      this.view = AG.gfx.canvas(o.viewW, o.viewH, 'ags-canvas');
      this.cv = this.view.cv; this.ctx = this.view.ctx;
      this.cv.style.touchAction = 'none';
      this.cv.setAttribute('role', 'img'); this.cv.setAttribute('aria-label', AG.pick(o.label) || AG.t('scenetap.scene'));
      this.live = h('div', { class: 'ags-sr', 'aria-live': 'polite' });
      this.el = h('div', { class: 'ags-view' + (o.cls ? ' ' + o.cls : '') }, this.cv, this.live);

      this.cam = new AG.logic.SceneCam({ viewW: o.viewW, viewH: o.viewH, zooms: o.zooms, zoom: o.zoom });
      this.setScene(o.scene, o);
      this.setZones(o.zones || []);
      this.objects = o.objects ? (o.objects.draw ? o.objects : new AG.scenetap.ObjectLayer({ items: o.objects })) : null;
      this.magnifier = o.magnifier ? (o.magnifier.draw ? o.magnifier : new AG.scenetap.Magnifier(o.magnifier === true ? {} : o.magnifier)) : null;
      this.flashlight = o.flashlight ? (o.flashlight.draw ? o.flashlight : new AG.scenetap.Flashlight(o.flashlight === true ? {} : o.flashlight)) : null;
      const start = o.start || { x: 0.5, y: 0.5 };
      this.reticle = { x: start.x * this.W, y: start.y * this.H };
      this.aimPt = { x: this.reticle.x, y: this.reticle.y };
      if (o.centre !== false) this.cam.centreOn(this.reticle.x, this.reticle.y);

      this.bindPointer();
      if (AG.input) this.bindKeys();
      if (this.mode === 'cycle' && AG.input && AG.input.lastDevice === 'keyboard') this.hiId = (this.cycleList()[0] || {}).id || null;
      // a switch to keys shows the highlight, after the key that caused it (so → lands on the first zone, not the second)
      this.offs.push(AG.on('ag:device', e => { if (e.detail.device === 'keyboard') setTimeout(() => { if (this.mode === 'cycle' && this.hiId == null && this.keysOn && this.el.isConnected) this.highlight(0, { via: 'key' }); }, 0); }));
      if (o.loop !== false) this.stopLoop = AG.gfx.loop(dt => this.frame(dt));
      this.render();
    }

    /* ----- scene, zones, size ----- */
    /** scene: an asset key or path, a canvas / <img>, or layers [{ src | draw(ctx, t, view), x, y, w, h, hidden }]. */
    setScene(scene, size) {
      size = size || {};
      const list = scene == null ? [] : Array.isArray(scene) ? scene : [scene];
      this.layers = list.map(l => (typeof l === 'string' || (l && (l.tagName || l.getContext))) ? { src: l } : Object.assign({}, l));
      const first = this.layers.find(l => l.src);
      let w = size.w, hh = size.h;
      if (first && !w) {
        if (typeof first.src === 'string') { const rec = AG.assets.image(first.src); w = rec.w; hh = rec.h; }
        else { w = first.src.naturalWidth || first.src.width; hh = first.src.naturalHeight || first.src.height; }
      }
      this.W = w || this.o.viewW; this.H = hh || this.o.viewH;
      this.cam.setWorld(this.W, this.H);
      if (this.zones) { this.zones.w = this.W; this.zones.h = this.H; }
      // sizes from the manifest are known at once; otherwise take them from the loaded image
      this.ready = Promise.all(this.layers.filter(l => typeof l.src === 'string').map(l => AG.assets.loadImage(l.src))).then(recs => {
        if (!size.w && first && typeof first.src === 'string' && recs[0] && recs[0].ok && (recs[0].w !== this.W || recs[0].h !== this.H)) {
          this.W = recs[0].w; this.H = recs[0].h; this.cam.setWorld(this.W, this.H); this.zones.w = this.W; this.zones.h = this.H;
        }
        return this;
      });
      return this;
    }
    setZones(zones) {
      this.zones = zones && zones.hitTest ? zones : new AG.logic.HitZones(zones, { w: this.W, h: this.H });
      this.zones.w = this.W; this.zones.h = this.H;
      if (this.hiId != null && !this.zones.get(this.hiId)) this.hiId = null;
      return this;
    }
    setMode(mode) { this.mode = mode; this.hiId = null; this.follow = null; return this; }
    get k() { return this.cam.k; }
    get enabled() { return this._enabled; }
    set enabled(v) { this._enabled = !!v; if (!v) this.cancelGesture(); }
    /** Where the magnifier and flashlight point, in scene px: the reticle, or the last touch / highlight. */
    get aim() { return this.mode === 'reticle' ? this.reticle : this.aimPt; }
    toNorm(wx, wy) { return { x: wx / this.W, y: wy / this.H }; }
    fromNorm(p) { return { x: p.x * this.W, y: p.y * this.H }; }
    tolFor(device) { return (this.tol[device] != null ? this.tol[device] : this.tol.mouse) / this.cam.k; }
    announce(text) { this.live.textContent = AG.pick(text); }
    camChanged() { if (this.o.onCamera) this.o.onCamera(this); }

    /* ----- picking ----- */
    /** Tests a scene point (scene px) and calls onPick(zone, info) or onMiss(info). */
    pickAt(wx, wy, info) {
      info = Object.assign({ view: this }, info, { point: this.toNorm(wx, wy) });
      const zone = this.zones.hitTest(info.point, this.tolFor(info.device), this.mode === 'cycle' ? this.cycleList() : null);
      if (zone) { if (this.o.onPick) this.o.onPick(zone, info); }
      else if (this.o.onMiss) this.o.onMiss(info);
      return zone;
    }
    pick(zone, info) {
      if (!zone) return;
      info = Object.assign({ view: this, point: this.zones.centre(zone) }, info);
      if (this.o.onPick) this.o.onPick(zone, info);
    }
    /** Cycle mode: the enabled zones, left to right (order 'x') or as listed ('list'). */
    cycleList() {
      const list = this.zones.zones.filter(z => z.enabled);
      if (this.o.order !== 'x') return list;
      const c = z => this.zones.centre(z);
      return list.slice().sort((a, b) => c(a).x - c(b).x || c(a).y - c(b).y);
    }
    get highlighted() { return this.hiId != null ? this.zones.get(this.hiId) : null; }
    /** Cycle mode: highlight the i-th zone of cycleList() (or a zone), scroll it into view. */
    highlight(i, info) {
      const list = this.cycleList();
      const z = typeof i === 'number' ? list[(i + list.length) % list.length] : i;
      if (!z) { this.hiId = null; return null; }
      const changed = z.id !== this.hiId;
      this.hiId = z.id;
      const c = this.fromNorm(this.zones.centre(z));
      this.aimPt = c;
      if (!info || info.via !== 'hover') { if (this.cam.push(c.x, c.y, this.ret.margin)) this.camChanged(); }
      if (changed) {
        const n = list.indexOf(z) + 1;
        this.announce(this.o.describe ? this.o.describe(z) : z.label || AG.t('scenetap.spot', { n, count: list.length }));
        if (this.o.onHighlight) this.o.onHighlight(z, info || {});
      }
      return z;
    }
    cycle(step, info) {
      const list = this.cycleList(); if (!list.length) return;
      const i = list.findIndex(z => z.id === this.hiId);
      sfx(this.o.sfx === false ? null : 'tap');
      this.highlight(i < 0 ? (step > 0 ? 0 : list.length - 1) : i + step, info);
    }

    /* ----- markers (drawn on top, in canvas px, so they stay crisp at any zoom) ----- */
    /** mark(zone | { x, y } normalised, 'found' | 'miss'). A miss fades after `ms` (900). */
    mark(target, kind, ms) {
      kind = kind || 'found';
      const isZone = target && target.shape;
      const p = isZone ? this.zones.centre(target) : target;
      let R = 8;
      if (isZone) { const b = this.zones.bounds(target); R = Math.max(6, Math.round(Math.max(b.w * this.W, b.h * this.H) / 2) + 2); }
      const m = { x: p.x, y: p.y, R, kind, id: isZone ? target.id : null, t0: this.t, ttl: kind === 'miss' ? (ms || 900) / 1000 : 0 };
      this.marks.push(m);
      return m;
    }
    clearMarks(kind) { this.marks = kind ? this.marks.filter(m => m.kind !== kind) : []; }

    /* ----- zoom and camera ----- */
    zoomTo(k, sx, sy) {
      if (sx == null) { const s = this.cam.toScreen(this.aim.x, this.aim.y); sx = s.x; sy = s.y; }
      if (!this.cam.setZoom(k, sx, sy)) return false;
      if (this.mode === 'reticle') this.cam.push(this.reticle.x, this.reticle.y, this.ret.margin);
      this.announce(AG.t('scenetap.zoomed', { k: this.cam.k }));
      if (this.o.onZoom) this.o.onZoom(this.cam.k, this);
      this.camChanged();
      return true;
    }
    toggleZoom(sx, sy) { const z = this.cam.zooms; if (z.length < 2) return false; sfx(this.o.sfx === false ? null : 'tap'); return this.zoomTo(z[(this.cam.zoomIndex + 1) % z.length], sx, sy); }
    zoomStep(dir, sx, sy) { const z = this.cam.zooms[this.cam.zoomIndex + (dir > 0 ? 1 : -1)]; return z != null && this.zoomTo(z, sx, sy); }
    /** Moves the reticle to a scene point (scene px), clamped to the scene. */
    aimAt(wx, wy, push) {
      this.reticle.x = clamp(wx, 0, this.W); this.reticle.y = clamp(wy, 0, this.H);
      this.aimPt = { x: this.reticle.x, y: this.reticle.y };
      if (push && this.cam.push(this.reticle.x, this.reticle.y, this.ret.margin)) this.camChanged();
    }

    /* ----- keyboard (through AG.input actions) ----- */
    bindKeys() {
      const I = AG.input, on = (a, fn) => this.offs.push(I.on(a, fn));
      const live = () => this._enabled && this.keysOn;
      if (this.cam.zooms.length > 1) {
        I.register('ZOOM', { keys: ['KeyZ'], button: { en: 'Zoom' } });
        on('ZOOM', e => { if (live() && e.phase === 'down') this.toggleZoom(); });
      }
      I.repeat('LEFT', { delay: 260, interval: 140 }); I.repeat('RIGHT', { delay: 260, interval: 140 });
      on('LEFT', e => { if (live() && this.mode === 'cycle' && e.phase !== 'up') this.cycle(-1, { device: e.device, via: 'key' }); });
      on('RIGHT', e => { if (live() && this.mode === 'cycle' && e.phase !== 'up') this.cycle(1, { device: e.device, via: 'key' }); });
      on('CONFIRM', e => {
        if (!live() || e.phase !== 'down') return;
        if (this.mode === 'reticle') this.pickAt(this.reticle.x, this.reticle.y, { device: e.device, via: 'key' });
        else if (this.mode === 'cycle') { if (this.highlighted) this.pick(this.highlighted, { device: e.device, via: 'key' }); else this.highlight(0, { via: 'key' }); }
      });
      for (let n = 1; n <= 9; n++) on('CHOICE_' + n, e => {
        if (!live() || this.mode !== 'cycle' || e.phase !== 'down') return;
        const z = this.cycleList()[n - 1];
        if (z) { this.highlight(z, { via: 'key' }); this.pick(z, { device: e.device, via: 'number' }); }
      });
    }
    /** Reticle movement: 150 px/s, accelerating to 300 while held; FINE (Shift) = 60. Canvas px. */
    moveReticle(dt) {
      if (this.mode !== 'reticle' || !this._enabled) return;
      const I = AG.input, d = a => (this.keysOn && I && I.isDown(a) ? 1 : 0);
      const dx = d('RIGHT') - d('LEFT'), dy = d('DOWN') - d('UP');
      const k = this.cam.k, R = this.ret;
      if (dx || dy) {
        this.held += dt;
        const speed = d('FINE') ? R.fine : R.speed + (R.max - R.speed) * clamp(this.held * 1000 / R.accelMs, 0, 1);
        const len = Math.hypot(dx, dy);
        this.follow = null;
        this.aimAt(this.reticle.x + dx / len * speed * dt / k, this.reticle.y + dy / len * speed * dt / k, true);
      } else this.held = 0;
      if (this.follow) { // a dragging finger in 'aim' mode: followed at no more than the keyboard's top speed
        const fx = this.follow.x - this.reticle.x, fy = this.follow.y - this.reticle.y, dist = Math.hypot(fx, fy), step = R.max * dt / k;
        if (dist <= step) this.aimAt(this.follow.x, this.follow.y, true); else this.aimAt(this.reticle.x + fx / dist * step, this.reticle.y + fy / dist * step, true);
      }
    }

    /* ----- pointers: tap, drag (pan or aim), pinch (zoom steps), mouse hover ----- */
    bindPointer() {
      const cv = this.cv, on = (t, fn) => { cv.addEventListener(t, fn); this.offs.push(() => cv.removeEventListener(t, fn)); };
      const dev = e => (e.pointerType === 'mouse' ? 'mouse' : 'touch');
      on('pointerdown', e => {
        if (!this._enabled || AG.paused || e.button > 0) return;
        try { cv.setPointerCapture(e.pointerId); } catch (_) { /* synthetic events */ }
        const p = this.view.toLocal(e);
        this.ptrs.set(e.pointerId, { cx: e.clientX, cy: e.clientY, x: p.x, y: p.y });
        if (this.ptrs.size === 2) { // pinch: zoom steps around the midpoint
          const [a, b] = [...this.ptrs.values()];
          this.pinch = { d0: Math.hypot(a.cx - b.cx, a.cy - b.cy) };
          if (this.g) this.g.multi = true;
          this.follow = null;
          return;
        }
        if (this.ptrs.size === 1) this.g = { id: e.pointerId, cx: e.clientX, cy: e.clientY, x: p.x, y: p.y, t: performance.now(), drag: false, multi: false, fx: this.cam.fx, fy: this.cam.fy, device: dev(e) };
      });
      on('pointermove', e => {
        if (AG.paused) return;
        const p = this.view.toLocal(e);
        const rec = this.ptrs.get(e.pointerId);
        if (!rec) { // hover: the mouse aims the reticle / highlights in cycle mode
          if (e.pointerType === 'mouse' && !e.buttons && this._enabled) this.hover(p);
          return;
        }
        rec.cx = e.clientX; rec.cy = e.clientY; rec.x = p.x; rec.y = p.y;
        if (this.pinch && this.ptrs.size >= 2) {
          const [a, b] = [...this.ptrs.values()], d = Math.hypot(a.cx - b.cx, a.cy - b.cy), r = d / Math.max(1, this.pinch.d0);
          if (r >= 1.25 || r <= 0.8) { this.zoomStep(r > 1 ? 1 : -1, (a.x + b.x) / 2, (a.y + b.y) / 2); this.pinch.d0 = d; }
          return;
        }
        const g = this.g;
        if (!g || g.id !== e.pointerId || g.multi) return;
        if (!g.drag && Math.hypot(e.clientX - g.cx, e.clientY - g.cy) >= 10) g.drag = true;
        if (!g.drag) return;
        e.preventDefault();
        const pan = this.o.dragMode !== 'aim' && this.cam.canScroll;
        if (pan) { this.cam.scrollTo(g.fx - (p.x - g.x) / this.cam.k, g.fy - (p.y - g.y) / this.cam.k); this.camChanged(); }
        else {
          const w = this.cam.toWorld(p.x, p.y);
          if (this.mode === 'reticle') this.follow = { x: clamp(w.x, 0, this.W), y: clamp(w.y, 0, this.H) };
          else this.aimPt = w;
        }
      });
      const end = (e, cancelled) => {
        const rec = this.ptrs.get(e.pointerId); if (!rec) return;
        this.ptrs.delete(e.pointerId);
        if (this.ptrs.size < 2) this.pinch = null;
        const g = this.g;
        if (g && g.id === e.pointerId) {
          this.g = null; this.follow = null;
          if (!cancelled && !g.drag && !g.multi && performance.now() - g.t < 250 && this._enabled && !AG.paused) this.tap(this.view.toLocal(e), g.device);
        }
      };
      on('pointerup', e => end(e, false));
      on('pointercancel', e => end(e, true));
      on('contextmenu', e => e.preventDefault());
    }
    /** A tap at canvas point p: reticle mode tests the tap point (and moves the reticle there);
     *  cycle mode picks the zone under it. */
    tap(p, device) {
      if (!this.cam.onScene(p.x, p.y)) return;
      const w = this.cam.toWorld(p.x, p.y);
      if (this.o.onTap) this.o.onTap(this.toNorm(w.x, w.y), { device, view: this });
      if (this.mode === 'reticle') { this.aimAt(w.x, w.y, false); this.pickAt(w.x, w.y, { device, via: 'tap' }); }
      else if (this.mode === 'cycle') {
        this.aimPt = w;
        const z = this.zones.hitTest(this.toNorm(w.x, w.y), this.tolFor(device), this.cycleList());
        if (z) { this.highlight(z, { via: 'tap' }); this.pick(z, { device, via: 'tap', point: this.toNorm(w.x, w.y) }); }
        else if (this.o.onMiss) this.o.onMiss({ device, via: 'tap', point: this.toNorm(w.x, w.y), view: this });
      }
    }
    hover(p) {
      if (!this.cam.onScene(p.x, p.y)) return;
      const w = this.cam.toWorld(p.x, p.y);
      if (this.mode === 'reticle') this.aimAt(w.x, w.y, false);
      else if (this.mode === 'cycle') {
        this.aimPt = w;
        const z = this.zones.hitTest(this.toNorm(w.x, w.y), this.tolFor('mouse'), this.cycleList());
        if (z) this.highlight(z, { via: 'hover' });
      }
    }
    cancelGesture() { this.ptrs.clear(); this.g = null; this.pinch = null; this.follow = null; }

    /* ----- frame ----- */
    frame(dt) { this.t += dt || 0; this.update(dt || 0); this.render(); }
    update(dt) {
      this.moveReticle(dt);
      if (this.objects) this.objects.update(dt);
      this.marks = this.marks.filter(m => !m.ttl || this.t - m.t0 < m.ttl);
      if (this.o.onFrame) this.o.onFrame(dt, this);
    }
    render() {
      const c = this.ctx, cam = this.cam, t = this.t, VW = this.o.viewW, VH = this.o.viewH;
      c.fillStyle = INK; c.fillRect(0, 0, VW, VH);
      cam.begin(c);
      for (const l of this.layers) {
        if (l.hidden) continue;
        if (l.draw) l.draw(c, t, this);
        else if (typeof l.src === 'string') AG.assets.draw(c, l.src, l.x || 0, l.y || 0, l.w || this.W, l.h || this.H, l.frame || 0);
        else c.drawImage(l.src, l.x || 0, l.y || 0, l.w || l.src.width, l.h || l.src.height);
      }
      const hz = this.mode === 'cycle' ? this.highlighted : null;
      const hItem = hz && this.objects ? this.objects.forZone(hz.id) : null;
      if (this.objects) this.objects.draw(c, t, this, hItem ? hItem.id : null);
      if (this.o.drawWorld) this.o.drawWorld(c, this, t);
      cam.end(c);
      if (this.flashlight) this.flashlight.draw(c, this);
      this.drawMarks(c);
      if (hz && !hItem) strokeZone(c, hz, cam, VEST);
      if (this.mode === 'cycle' && AG.input && AG.input.lastDevice === 'keyboard') this.drawBadges(c);
      if (this.magnifier) this.magnifier.draw(c, this);
      if (this.mode === 'reticle' && !this.ret.hidden) this.drawReticle(c, this.reticle, 1);
      if (this.ghost) this.drawReticle(c, this.ghost, 0.45);
      if (this.o.drawScreen) this.o.drawScreen(c, this, t);
    }
    drawReticle(c, at, alpha) {
      const s = this.cam.toScreen(at.x, at.y);
      c.save(); c.globalAlpha = alpha;
      if (this.ret.art) { const r = AG.assets.image(this.ret.art); AG.assets.draw(c, this.ret.art, Math.round(s.x - (r.w || 15) / 2), Math.round(s.y - (r.h || 15) / 2)); }
      else c.drawImage(reticle(), Math.round(s.x) - 7, Math.round(s.y) - 7);
      c.restore();
    }
    drawMarks(c) {
      for (const m of this.marks) {
        const s = this.cam.normToScreen(m.x, m.y), x = Math.round(s.x), y = Math.round(s.y);
        if (m.kind === 'miss') { const g = glyph('cross', DANGER, 2); c.drawImage(g, x - g.width / 2, y - g.height / 2); continue; }
        const R = clamp(Math.round(m.R * this.cam.k), 8, 80);
        const art = this.o.markerArt && this.o.markerArt[m.kind];
        if (art) { // the art at the whole multiple nearest the zone's size (crisp pixels)
          const rec = AG.assets.image(art), aw = rec.frameW || rec.w || 24, ah = rec.h || 24, s = Math.max(1, Math.round(R * 2 / Math.max(aw, ah)));
          AG.assets.draw(c, art, x - Math.round(aw * s / 2), y - Math.round(ah * s / 2), aw * s, ah * s);
        }
        else { const pts = ringPoints(x, y, R); stamp(c, pts, 4, INK); stamp(c, pts, 2, SAFE); }
        const g = glyph('check', SAFE, 2);
        c.drawImage(g, Math.round(x + R * 0.7 - g.width / 2), Math.round(y - R * 0.7 - g.height / 2));
      }
    }
    drawBadges(c) {
      this.cycleList().slice(0, 9).forEach((z, i) => {
        const b = this.zones.bounds(z), s = this.cam.normToScreen(b.x, b.y);
        badge(c, i + 1, clamp(s.x - 4, 1, this.o.viewW - 14), clamp(s.y - 4, 1, this.o.viewH - 15), z.id === this.hiId);
      });
    }

    destroy() {
      if (this.stopLoop) this.stopLoop();
      this.offs.forEach(f => f()); this.offs = [];
      this.cancelGesture();
      this.el.remove();
    }
  }

  AG.scenetap = Object.assign(AG.scenetap || {}, {
    SceneView, HitZones: AG.logic.HitZones, SceneCam: AG.logic.SceneCam,
    px: { ringPoints, linePoints, zonePoints, stamp, strokeZone, glyph, reticle, mkCanvas, INK, VEST, WHITE, SAFE, DANGER }
  });
})(window.AG);
