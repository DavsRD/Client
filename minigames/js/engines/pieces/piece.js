/* E5 PIECES ENGINE — the base: the AG.pieces namespace, the engine stylesheet and strings, and
 * Piece. DOM in the prototype's panel style; art is drawn into canvases at whole multiples and
 * turned in 90° steps only. Styles in minigames/css/pieces.css (all under #ag-app, agp- classes).
 * Docs: kalasag-dev/minigames/docs/engines/pieces.md
 *
 *   new AG.pieces.Piece({ id, shape: ['##', '#.'], cell: 28, art | color | icon, label, data, rot })   polyomino
 *   new AG.pieces.Piece({ id, kind: 'image', art: canvas | key, home, rot: 0 | 90 | 180 | 270 })      jigsaw / image
 *   piece.state 'tray' | 'held' | 'placed'   piece.rot (quarter turns, clockwise)   piece.rotate(±1)   piece.cells
 *   piece.size → { w, h } art px at the current turn   piece.image(rot) → a cached canvas   piece.copy(scale) → a canvas */
window.AG = window.AG || {};
(function (AG) {
  const { h } = AG.util;
  const S = AG.logic.pieceShape;

  if (typeof document !== 'undefined' && !document.querySelector('link[data-ag-css="pieces"]')) {
    document.head.append(h('link', { rel: 'stylesheet', href: AG.path('css/pieces.css'), 'data-ag-css': 'pieces' }));
  }

  AG.STRINGS = Object.assign(AG.STRINGS || {}, {
    'pieces.tray': { en: 'Pieces to place' },
    'pieces.board': { en: 'Board' },
    'pieces.buttons': { en: 'Buttons' },
    'pieces.rotate': { en: 'Turn' },
    'pieces.putBack': { en: 'Put back' },
    'pieces.undo': { en: 'Undo' },
    'pieces.cell': { en: 'Row {row}, column {col}: {what}' },
    'pieces.slot': { en: 'Spot {n}: {what}' },
    'pieces.empty': { en: 'empty' },
    'pieces.wall': { en: 'no space' },
    'pieces.piece': { en: 'Piece {n}' },
    'pieces.turnedBy': { en: '{name}, turned {deg}°' },
    'pieces.holdKeys': { en: 'Holding {name}. Arrows move it, R turns it, Enter places it, Esc puts it back.' },
    'pieces.holdTouch': { en: 'Holding {name}. Tap where it goes. Tap it again to turn it.' },
    'pieces.placed': { en: '{name} placed.' },
    'pieces.fits': { en: 'Fits here.' },
    'pieces.blocked': { en: "Doesn't fit there." },
    'pieces.wrongSpot': { en: 'Not this spot. Back to the tray.' },
    'pieces.wrongTurn': { en: 'Right spot, but turn it first. Back to the tray.' },
    'pieces.back': { en: '{name} is back in the tray.' },
    'pieces.undone': { en: 'Undone.' },
    'pieces.tile': { en: 'Tile {n}' },
    'pieces.gap': { en: 'Gap' },
    'pieces.slid': { en: 'Moved tile {n}.' },
    'pieces.solved': { en: 'Solved!' }
  });

  const sfx = (name) => { if (name && AG.sfx) AG.sfx.play(name); };
  /** 0–3 are quarter turns; 90 / 180 / 270 are degrees. */
  const quarter = r => { r = +r || 0; if (Math.abs(r) >= 4) r = Math.round(r / 90); return ((Math.round(r) % 4) + 4) % 4; };
  const canvas = (w, hh) => { const cv = document.createElement('canvas'); cv.width = Math.max(1, w); cv.height = Math.max(1, hh); return cv; };

  /** Draws src (w × h) into a new canvas turned q quarter turns clockwise. Exact for 90° steps: no smoothing, no blur. */
  function turned(src, q) {
    const w = src.width, hh = src.height, odd = q % 2 === 1, cv = canvas(odd ? hh : w, odd ? w : hh), c = cv.getContext('2d');
    c.imageSmoothingEnabled = false;
    if (q === 1) { c.translate(hh, 0); c.rotate(Math.PI / 2); }
    else if (q === 2) { c.translate(w, hh); c.rotate(Math.PI); }
    else if (q === 3) { c.translate(0, w); c.rotate(-Math.PI / 2); }
    c.drawImage(src, 0, 0);
    return cv;
  }
  /** Copies a canvas at a whole-number scale: an element sized in CSS px, pixels kept crisp by CSS. */
  function copy(src, scale, cls) {
    const cv = canvas(src.width, src.height);
    const c = cv.getContext('2d'); c.imageSmoothingEnabled = false; c.drawImage(src, 0, 0);
    cv.className = 'ag-px ' + (cls || '');
    sizeTo(cv, src.width, src.height, scale);
    return cv;
  }
  const sizeTo = (el, w, hh, scale) => { el.style.width = w * scale + 'px'; el.style.height = hh * scale + 'px'; };
  /** The largest whole multiple ≥ 1 (≤ max) at which w × h fits inside fitW × fitH. */
  function fitScale(w, hh, fitW, fitH, max) {
    let s = Math.max(1, max || 8);
    while (s > 1 && ((fitW && w * s > fitW) || (fitH && hh * s > fitH))) s--;
    return s;
  }
  /** A button press that never waits on click for touch: the browser can drop the click of the first tap after a
   *  touch drag. Touch and pen fire on pointerup (and the click that may follow is ignored); mouse and keys on click. */
  function onPress(el, fn) {
    let down = null, last = -1e9;
    const pd = e => { down = e.pointerType !== 'mouse' && e.isPrimary ? { x: e.clientX, y: e.clientY, id: e.pointerId } : null; };
    const pu = e => {
      const d = down; down = null;
      if (!d || e.pointerId !== d.id || Math.hypot(e.clientX - d.x, e.clientY - d.y) >= 10) return;
      const r = el.getBoundingClientRect();
      if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) return;
      last = performance.now(); fn(e);
    };
    const ck = e => { e.preventDefault(); if (performance.now() - last > 700) fn(e); };
    const pc = () => { down = null; };
    el.addEventListener('pointerdown', pd); el.addEventListener('pointerup', pu); el.addEventListener('pointercancel', pc); el.addEventListener('click', ck);
    return () => { el.removeEventListener('pointerdown', pd); el.removeEventListener('pointerup', pu); el.removeEventListener('pointercancel', pc); el.removeEventListener('click', ck); };
  }
  const ink = () => { const app = document.getElementById('ag-app'); return (app && getComputedStyle(app).getPropertyValue('--ink').trim()) || '#1e1538'; };

  /** Plain blocks for a shape without art: the fill, a 1 px light bevel, a 1 px ink outline on the outer edges only. */
  function drawBlocks(c, shape, cell, color, edge) {
    const on = new Set(shape.cells.map(p => p.x + ',' + p.y)), has = (x, y) => on.has(x + ',' + y);
    for (const p of shape.cells) {
      const x = p.x * cell, y = p.y * cell;
      c.fillStyle = color; c.fillRect(x, y, cell, cell);
      c.fillStyle = 'rgba(255,255,255,.35)'; c.fillRect(x + 1, y + 1, cell - 2, 1); c.fillRect(x + 1, y + 1, 1, cell - 2);
      c.fillStyle = 'rgba(0,0,0,.18)'; c.fillRect(x + 2, y + cell - 2, cell - 3, 1); c.fillRect(x + cell - 2, y + 2, 1, cell - 3);
      c.fillStyle = edge;
      if (!has(p.x, p.y - 1)) c.fillRect(x, y, cell, 1);
      if (!has(p.x, p.y + 1)) c.fillRect(x, y + cell - 1, cell, 1);
      if (!has(p.x - 1, p.y)) c.fillRect(x, y, 1, cell);
      if (!has(p.x + 1, p.y)) c.fillRect(x + cell - 1, y, 1, cell);
    }
  }

  let seq = 0;
  class Piece {
    constructor(spec) {
      spec = spec || {};
      this.n = seq++;
      this.id = spec.id != null ? String(spec.id) : 'p' + this.n;
      this.kind = spec.kind === 'image' ? 'image' : 'poly';
      this.data = spec.data; this.labelText = spec.label;
      this.art = spec.art || null; this.color = spec.color || '#ffd23f'; this.icon = spec.icon || null;
      this.cell = spec.cell || 28;
      this.rotatable = spec.rotatable !== false;
      this.home = spec.home != null ? spec.home : null;
      this.shape = this.kind === 'poly' ? S.parse(spec.shape || ['#']) : null;
      this.ox = spec.ox || 0; this.oy = spec.oy || 0; // image pieces: where the body starts inside the art (jigsaw tabs)
      this.rot = quarter(spec.rot);
      this.state = 'tray';
      this.at = null; // GridBoard: { x, y } of the top-left cell; SlotBoard: the slot index
      this._img = [];
      this.el = h('button', { type: 'button', class: 'agp-piece', 'data-dnd-item': '', 'data-id': this.id, 'data-kind': this.kind });
      this.el._agPiece = this;
      this.view = canvas(1, 1); this.view.className = 'ag-px agp-piece__art';
      this.el.append(this.view);
      this.scale = spec.scale || 1;
      this.setState('tray');
      this.redraw();
      if (typeof this.art === 'string' && AG.assets) AG.assets.loadImage(this.art).then(() => { this._img = []; this.redraw(); });
    }
    get label() { return AG.pick(this.labelText) || AG.t('pieces.piece', { n: String(this.n + 1) }); }
    get cells() { return this.shape ? S.rotate(this.shape, this.rot).cells : []; }
    get turnedShape() { return this.shape ? S.rotate(this.shape, this.rot) : null; }
    /** The base art at turn 0, in art px. */
    base() {
      if (this._base) return this._base;
      let w, hh;
      if (this.shape) { w = this.shape.w * this.cell; hh = this.shape.h * this.cell; }
      else if (this.art && this.art.width) { w = this.art.width; hh = this.art.height; }
      else { const rec = typeof this.art === 'string' && AG.assets ? AG.assets.image(this.art) : null; w = (rec && rec.w) || 40; hh = (rec && rec.h) || 40; }
      const cv = canvas(w, hh), c = cv.getContext('2d');
      c.imageSmoothingEnabled = false;
      if (this.art && this.art.width && typeof this.art !== 'string') c.drawImage(this.art, 0, 0, w, hh);
      else if (typeof this.art === 'string') {
        const rec = AG.assets.image(this.art);
        if (rec.ok) AG.assets.draw(c, this.art, 0, 0, w, hh);
        else if (rec.loaded) { if (this.shape) drawBlocks(c, this.shape, this.cell, '#c4b5ff', ink()); AG.assets.placeholder(c, this.art, 0, 0, Math.min(w, this.cell), Math.min(hh, this.cell)); }
        else return cv; // not loaded yet: redrawn when it arrives (not cached)
      }
      else if (this.shape) {
        drawBlocks(c, this.shape, this.cell, this.color, ink());
        if (this.icon && AG.icons) { const img = new Image(); img.onload = () => { const sz = Math.min(18 * Math.floor(Math.min(w, hh) / 18), 36) || 18; c.drawImage(img, Math.floor((w - sz) / 2), Math.floor((hh - sz) / 2), sz, sz); this._img = []; this.redraw(true); }; img.src = AG.icons.src(this.icon); }
      }
      this._base = cv;
      return cv;
    }
    /** The art turned q quarter turns (cached per turn). */
    image(q) {
      q = q == null ? this.rot : quarter(q);
      if (!this._img[q]) { const b = this.base(); if (b !== this._base) return b; this._img[q] = q ? turned(b, q) : b; }
      return this._img[q];
    }
    get size() { const im = this.image(); return { w: im.width, h: im.height }; }
    copy(scale, cls) { return copy(this.image(), scale || this.scale, cls); }
    /** Re-paints the piece's own element at its scale (after a turn or a new scale). */
    redraw(keepBase) {
      if (!keepBase) this._base = null;
      const im = this.image();
      this.view.width = im.width; this.view.height = im.height;
      const c = this.view.getContext('2d'); c.imageSmoothingEnabled = false; c.clearRect(0, 0, im.width, im.height); c.drawImage(im, 0, 0);
      sizeTo(this.view, im.width, im.height, this.scale);
      this.el.setAttribute('aria-label', this.rot && this.rotatable ? AG.t('pieces.turnedBy', { name: this.label, deg: String(this.rot * 90) }) : this.label);
      return this;
    }
    setScale(s) { if (s !== this.scale) { this.scale = s; sizeTo(this.view, this.view.width, this.view.height, s); } return this; }
    rotate(dir) {
      if (!this.rotatable) return this.rot;
      this.rot = ((this.rot + (dir || 1)) % 4 + 4) % 4;
      this.redraw(true);
      return this.rot;
    }
    setRot(q) { this.rot = quarter(q); this.redraw(true); return this; }
    setState(s) {
      this.state = s;
      this.el.dataset.state = s;
      this.el.classList.toggle('is-held', s === 'held');
      this.el.classList.toggle('is-placed', s === 'placed');
      return this;
    }
    destroy() { this.el.remove(); }
  }

  AG.pieces = Object.assign(AG.pieces || {}, { Piece, turned, copy, sizeTo, fitScale, quarter, ink, sfx, canvas, onPress });
})(window.AG);
