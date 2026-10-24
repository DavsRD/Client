/* E1 GRID / TILE ENGINE — the base: the AG.grid namespace, Tileset and TileMap. Canvas 2D.
 * Styles for the DOM parts (GridCursor) are in minigames/css/grid.css, added by this file.
 * Docs: kalasag-dev/minigames/docs/engines/grid.md
 *
 *   const tiles = new AG.grid.Tileset([
 *     { id: 'floor', frame: 'fire-escape.tiles.floor' },
 *     { id: 'wall',  frame: 'fire-escape.tiles.wall', walkable: false, tags: ['solid'] },
 *     { id: 'fire',  frame: 'fire-escape.fire', anim: { fps: 8 }, walkable: false, tags: ['hazard'] }
 *   ]);
 *   const map = new AG.grid.TileMap({ w: 24, h: 13, tile: 20, tiles });
 *   map.load(rows, { '#': { floor: 'floor', walls: 'wall' }, '.': { floor: 'floor' }, S: { floor: 'floor', mark: 'start' } });
 *   await map.prepare();                    // loads the art, pre-renders the static layers
 *   cam.begin(ctx); map.draw(ctx, cam, t, ['floor', 'walls', 'objects']); rig…; map.draw(ctx, cam, t, ['overlay']); cam.end(ctx);
 *
 * Tile def: { id, walkable = true, frame, anim?, tags = [], rot?, dynamic? }
 *   frame  'asset.key' (AG.assets, a labelled placeholder if missing) · { key, i } a fixed
 *          frame of a strip · '#rrggbb' a flat colour · { icon } an AG.icons icon, centred ·
 *          function (ctx, px, py, size, t, x, y) drawn by code
 *   anim   { fps, frames? , seq?: [0, 1, 2, 1], sync = false }  frames of an asset strip;
 *          unsynced tiles start at a per-cell phase so a fire doesn't flicker in lockstep
 *   rot    0–3: the frame turned in 90° steps (pipes)
 * Layers: floor, walls, objects, overlay (or your own list). Static layers (default floor +
 * walls) are pre-rendered once into offscreen canvases; animated / dynamic tiles and the
 * other layers are drawn each frame. set() on a static layer redraws only that cell. */
window.AG = window.AG || {};
(function (AG) {
  const P = AG.logic.gridPath;

  /* ---------- the engine stylesheet (once per page) ---------- */
  if (typeof document !== 'undefined' && !document.querySelector('link[data-ag-css="grid"]')) {
    document.head.append(AG.util.h('link', { rel: 'stylesheet', href: AG.path('css/grid.css'), 'data-ag-css': 'grid' }));
  }

  AG.STRINGS = Object.assign(AG.STRINGS || {}, {
    'grid.cell': { en: 'Row {row}, column {col}', fil: 'Hilera {row}, hanay {col}' }
  });

  const LAYERS = ['floor', 'walls', 'objects', 'overlay'];

  class Tileset {
    constructor(defs) {
      this.list = [null]; this.byId = new Map();
      (Array.isArray(defs) ? defs : Object.entries(defs || {}).map(([id, d]) => Object.assign({ id }, d))).forEach(d => this.add(d));
    }
    add(def) {
      const d = Object.assign({ walkable: true, tags: [] }, def);
      d.walkable = d.walkable !== false; d.tagSet = new Set(d.tags);
      d.dynamic = !!(d.dynamic || d.anim);
      if (this.byId.has(d.id)) { const i = this.byId.get(d.id).index; d.index = i; this.list[i] = d; }
      else { d.index = this.list.length; this.list.push(d); }
      this.byId.set(d.id, d);
      return d;
    }
    get(id) { return id == null ? null : this.byId.get(id) || null; }
    /** Every asset key the tiles use (for loading and offline lists). */
    keys() { return this.list.filter(d => d && typeof d.frame === 'string' && d.frame[0] !== '#').map(d => d.frame).concat(this.list.filter(d => d && d.frame && d.frame.key).map(d => d.frame.key)); }
  }

  /** Draws one tile's frame at px, py (world pixels). */
  function drawTile(ctx, d, px, py, size, t, x, y) {
    const f = d.frame;
    if (f == null) return;
    if (d.rot) { ctx.save(); ctx.translate(px + size / 2, py + size / 2); ctx.rotate(d.rot * Math.PI / 2); px = -size / 2; py = -size / 2; }
    if (typeof f === 'function') f(ctx, px, py, size, t, x, y);
    else if (typeof f === 'string' && f[0] === '#') { ctx.fillStyle = f; ctx.fillRect(px, py, size, size); }
    else if (f.icon) AG.gfx.drawIcon(ctx, f.icon, px + Math.floor((size - 18) / 2), py + Math.floor((size - 18) / 2), 1);
    else {
      const key = f.key || f;
      let i = f.i || 0;
      if (d.anim) {
        const a = d.anim, seq = a.seq, n = seq ? seq.length : a.frames || AG.assets.image(key).frames || 1;
        const phase = a.sync ? 0 : ((x * 7 + y * 13) % n);
        const k = Math.floor((t || 0) * (a.fps || 6) + phase) % n;
        i = seq ? seq[k] : k;
      }
      AG.assets.draw(ctx, key, px, py, size, size, i);
    }
    if (d.rot) ctx.restore();
  }

  class TileMap {
    constructor(o) {
      this.w = o.w; this.h = o.h; this.tile = o.tile || 20;
      this.tiles = o.tiles instanceof Tileset ? o.tiles : new Tileset(o.tiles || []);
      this.layers = (o.layers || LAYERS).slice();
      this.staticLayers = new Set(o.staticLayers || ['floor', 'walls']);
      this.data = {}; this.layers.forEach(l => { this.data[l] = new Uint16Array(this.w * this.h); });
      this.marks = {};
      this.bands = null; this.dirty = new Set(); this.dynamicCount = {}; this.layers.forEach(l => { this.dynamicCount[l] = 0; });
    }
    get pw() { return this.w * this.tile; }
    get ph() { return this.h * this.tile; }
    inBounds(x, y) { return x >= 0 && y >= 0 && x < this.w && y < this.h; }

    get(layer, x, y) { return this.inBounds(x, y) ? this.tiles.list[this.data[layer][y * this.w + x]] : null; }
    id(layer, x, y) { const d = this.get(layer, x, y); return d ? d.id : null; }
    set(layer, x, y, id) {
      if (!this.inBounds(x, y)) return;
      const arr = this.data[layer], i = y * this.w + x;
      const old = this.tiles.list[arr[i]], d = id == null ? null : this.tiles.get(id);
      if (id != null && !d) AG.warnOnce('grid:tile:' + id, 'unknown tile id', id);
      if (old && old.dynamic) this.dynamicCount[layer]--;
      if (d && d.dynamic) this.dynamicCount[layer]++;
      arr[i] = d ? d.index : 0;
      if (this.bands && this.staticLayers.has(layer)) this.dirty.add(i);
    }
    fill(layer, id) { for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) this.set(layer, x, y, id); }
    clear(layer) { this.fill(layer, null); }

    /** In bounds, and no tile on any layer says walkable: false. */
    walkable(x, y) {
      if (!this.inBounds(x, y)) return false;
      const i = y * this.w + x;
      for (const l of this.layers) { const d = this.tiles.list[this.data[l][i]]; if (d && !d.walkable) return false; }
      return true;
    }
    passable(x, y) { return this.walkable(x, y); }
    tagsAt(x, y) { const out = new Set(); if (this.inBounds(x, y)) this.layers.forEach(l => { const d = this.get(l, x, y); if (d) d.tags.forEach(t => out.add(t)); }); return out; }
    hasTag(x, y, tag) { return this.layers.some(l => { const d = this.get(l, x, y); return d && d.tagSet.has(tag); }); }
    /** Cells whose tile matches: an id, a tag, or a function (def, x, y, layer) → bool. */
    find(match, layer) {
      const test = typeof match === 'function' ? match : d => d.id === match || d.tagSet.has(match), out = [];
      for (const l of layer ? [layer] : this.layers) for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
        const d = this.get(l, x, y);
        if (d && test(d, x, y, l)) out.push({ x, y, layer: l, tile: d });
      }
      return out;
    }
    /** The 4 (or 8) neighbours in bounds: [{ x, y, dir }]. opts.walkable keeps only walkable ones. */
    neighbours(x, y, opts) {
      const out = [], diag = opts && opts.diagonal, walk = opts && opts.walkable;
      const list = P.DIRS.map(D => [D.x, D.y, D.name]).concat(diag ? [[1, -1, 'up-right'], [1, 1, 'down-right'], [-1, 1, 'down-left'], [-1, -1, 'up-left']] : []);
      for (const [dx, dy, dir] of list) { const nx = x + dx, ny = y + dy; if (this.inBounds(nx, ny) && (!walk || this.walkable(nx, ny))) out.push({ x: nx, y: ny, dir }); }
      return out;
    }
    /** World pixels → the cell under them (may be out of bounds; check inBounds). */
    toGrid(wx, wy) { return { x: Math.floor(wx / this.tile), y: Math.floor(wy / this.tile) }; }
    /** A cell → world pixels of its top-left corner, or its centre with { center: true }. */
    toWorld(x, y, opts) { const c = opts && opts.center ? this.tile / 2 : 0; return { x: x * this.tile + c, y: y * this.tile + c }; }

    /** Fills the map from rows of characters. legend[ch] = { <layer>: tileId, mark: name };
     *  marked cells are listed in map.marks[name]. Unknown characters warn once. */
    load(rows, legend) {
      this.layers.forEach(l => this.clear(l)); this.marks = {};
      rows.forEach((row, y) => row.split('').forEach((ch, x) => {
        const e = legend[ch];
        if (!e) { AG.warnOnce('grid:legend:' + ch, 'no legend entry for', JSON.stringify(ch)); return; }
        for (const l of this.layers) if (e[l] !== undefined) this.set(l, x, y, e[l]);
        if (e.mark) (this.marks[e.mark] = this.marks[e.mark] || []).push({ x, y });
      }));
      if (this.bands) this.invalidate();
      return this;
    }

    /* ---------- rendering ---------- */
    /** Loads every tile image, then pre-renders the static layers. Call again after a load(). */
    async prepare() {
      await AG.assets.ready();
      await Promise.all(this.tiles.keys().map(k => AG.assets.loadImage(k)));
      this.invalidate();
      return this;
    }
    /** Rebuilds the offscreen canvases. Consecutive static layers share one canvas (a band). */
    invalidate() {
      const bands = [];
      for (const l of this.layers) {
        const st = this.staticLayers.has(l), last = bands[bands.length - 1];
        if (st && last && last.static) last.layers.push(l); else bands.push({ static: st, layers: [l] });
      }
      for (const b of bands) {
        if (!b.static) continue;
        b.cv = document.createElement('canvas'); b.cv.width = this.pw; b.cv.height = this.ph;
        b.ctx = b.cv.getContext('2d'); b.ctx.imageSmoothingEnabled = false;
        for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) this.renderCell(b, x, y, false);
      }
      this.bands = bands; this.dirty.clear();
    }
    renderCell(b, x, y, clear) {
      const s = this.tile, px = x * s, py = y * s;
      if (clear) b.ctx.clearRect(px, py, s, s);
      for (const l of b.layers) { const d = this.get(l, x, y); if (d && !d.dynamic) drawTile(b.ctx, d, px, py, s, 0, x, y); }
    }
    /** Visible cell range for a camera (or the whole map). */
    range(cam) {
      if (!cam) return { x0: 0, y0: 0, x1: this.w - 1, y1: this.h - 1 };
      const v = cam.view(), s = this.tile;
      return { x0: Math.max(0, Math.floor(v.x / s)), y0: Math.max(0, Math.floor(v.y / s)), x1: Math.min(this.w - 1, Math.floor((v.x + v.w - 1) / s)), y1: Math.min(this.h - 1, Math.floor((v.y + v.h - 1) / s)) };
    }
    /** Draws the given layers (default all) in world pixels: call it inside cam.begin(ctx). */
    draw(ctx, cam, t, layers) {
      if (!this.bands) this.invalidate();
      if (this.dirty.size) { for (const i of this.dirty) { const x = i % this.w, y = (i - x) / this.w; this.bands.forEach(b => { if (b.static) this.renderCell(b, x, y, true); }); } this.dirty.clear(); }
      const want = layers ? new Set(layers) : null, r = this.range(cam), s = this.tile;
      for (const b of this.bands) {
        const ls = want ? b.layers.filter(l => want.has(l)) : b.layers;
        if (!ls.length) continue;
        if (b.static && ls.length === b.layers.length) {
          const sx = r.x0 * s, sy = r.y0 * s, sw = (r.x1 - r.x0 + 1) * s, sh = (r.y1 - r.y0 + 1) * s;
          if (sw > 0 && sh > 0) ctx.drawImage(b.cv, sx, sy, sw, sh, sx, sy, sw, sh);
        }
        for (const l of ls) {
          const onlyDynamic = b.static && ls.length === b.layers.length;
          if (onlyDynamic && !this.dynamicCount[l]) continue;
          for (let y = r.y0; y <= r.y1; y++) for (let x = r.x0; x <= r.x1; x++) {
            const d = this.get(l, x, y);
            if (d && (!onlyDynamic || d.dynamic)) drawTile(ctx, d, x * s, y * s, s, t, x, y);
          }
        }
      }
    }
  }

  AG.grid = Object.assign(AG.grid || {}, { LAYERS, DIRS: P.DIRS, OPPOSITE: P.OPPOSITE, Tileset, TileMap, drawTile });
})(window.AG);
