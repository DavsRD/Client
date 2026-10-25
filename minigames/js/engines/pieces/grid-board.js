/* E5 PIECES ENGINE — GridBoard: the polyomino board (a bag, a shelf) over AG.logic.PackGrid.
 * Cells are cell × scale CSS px (scale a whole number, or 'auto' = the largest that fits the width).
 * The ghost previews a piece: fits → a dithered fill + ✔, blocked → ✖ on every cell in the way.
 *
 *   const b = new AG.pieces.GridBoard({ w, h, mask, cell: 28, scale: 'auto', maxScale: 3, cellArt, label })
 *   b.canPlace(piece, x, y, rot?) → { ok, cells, blocked }   b.place(piece, x, y) → bool   b.remove(piece)
 *   b.pieceAt(x, y)  b.occupancy()  b.efficiency()  b.stats()  b.grid (the PackGrid)  b.pieces
 *   b.ghost(piece, x, y) → the canPlace result (shown)   b.hideGhost()   b.cursor(x, y | null)
 *   b.cellAt(clientX, clientY)  b.originFor(piece, clientX, clientY, grab)  b.clamp(piece, x, y)  b.fit(width) */
window.AG = window.AG || {};
(function (AG) {
  const { h } = AG.util;
  const P = AG.pieces;

  class GridBoard {
    constructor(opts) {
      opts = opts || {};
      this.kind = 'grid';
      this.grid = new AG.logic.PackGrid({ w: opts.w, h: opts.h, mask: opts.mask });
      this.w = this.grid.w; this.h = this.grid.h;
      this.cell = opts.cell || 28;
      this.auto = opts.scale === 'auto' || opts.scale == null;
      this.maxScale = opts.maxScale || 3;
      this.scale = this.auto ? 2 : opts.scale;
      this.byId = new Map();
      this.cellsEl = h('div', { class: 'agp-grid__cells', 'aria-hidden': 'true' });
      this.cellEls = [];
      for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
        const c = h('div', { class: 'agp-cell' + (this.grid.isWall(x, y) ? ' is-wall' : '') });
        if (opts.cellArt && !this.grid.isWall(x, y)) { const url = AG.assets && AG.assets.url(opts.cellArt); if (url) c.style.backgroundImage = 'url("' + url + '")'; }
        this.cellEls.push(c); this.cellsEl.append(c);
      }
      this.layer = h('div', { class: 'agp-grid__layer' });
      this.ghostEl = h('div', { class: 'agp-ghost', hidden: true, 'aria-hidden': 'true' });
      this.cursorEl = h('div', { class: 'agp-cursor', hidden: true, 'aria-hidden': 'true' });
      this.el = h('div', { class: 'agp-board agp-grid', 'data-dnd-target': '', tabindex: '-1', role: 'application', 'aria-roledescription': 'grid', 'aria-label': AG.pick(opts.label) || AG.t('pieces.board') },
        this.cellsEl, this.layer, this.ghostEl, this.cursorEl);
      this.setScale(this.scale);
    }
    get px() { return this.cell * this.scale; }
    get pieces() { return [...this.byId.values()]; }
    /** 'auto' boards: the largest whole multiple (≤ maxScale) whose width fits. */
    fit(width) { if (this.auto && width > 0) this.setScale(P.fitScale(this.w * this.cell + 6, 1, width, 0, this.maxScale)); return this.scale; }
    setScale(s) {
      this.scale = s;
      const px = this.px;
      this.el.style.setProperty('--agp-cell', px + 'px');
      this.el.style.setProperty('--agp-dot', s + 'px');
      this.el.style.width = this.w * px + 'px'; this.el.style.height = this.h * px + 'px';
      this.cellsEl.style.gridTemplateColumns = 'repeat(' + this.w + ', ' + px + 'px)';
      this.pieces.forEach(p => this.position(p));
      if (this._ghost) this.ghost(...this._ghost);
      if (this._cursor) this.cursor(this._cursor.x, this._cursor.y);
    }
    canPlace(piece, x, y, rot) { return this.grid.canPlace(piece.shape, x, y, rot == null ? piece.rot : rot, piece.id); }
    place(piece, x, y) {
      if (!this.grid.place(piece.id, piece.shape, x, y, piece.rot)) return false;
      this.byId.set(piece.id, piece);
      piece.at = { x, y }; piece.setState('placed'); piece.setScale(this.scale);
      piece.el.removeAttribute('role'); piece.el.tabIndex = -1;
      this.layer.append(piece.el);
      this.position(piece);
      return true;
    }
    position(p) { if (!p.at) return; p.setScale(this.scale); p.el.style.left = p.at.x * this.px + 'px'; p.el.style.top = p.at.y * this.px + 'px'; }
    /** Takes a piece off the board. keepEl: its element stays where it was (a faint "came from here") until the
     *  tray or the board takes it again: an element pulled out mid-drag costs the next touch tap its click. */
    remove(piece, keepEl) {
      this.grid.remove(piece.id); this.byId.delete(piece.id);
      if (!keepEl) { piece.el.style.left = piece.el.style.top = ''; if (piece.el.parentNode === this.layer) piece.el.remove(); }
      piece.at = null;
    }
    pieceAt(x, y) { const id = this.grid.at(x, y); return id != null ? this.byId.get(id) || null : null; }
    occupancy() { return this.grid.occupancy(); }
    efficiency() { return this.grid.efficiency(); }
    stats() { return this.grid.stats(); }
    /** Keeps the piece's box inside the board (keyboard moves). */
    clamp(piece, x, y) { const s = piece.turnedShape; return { x: AG.util.clamp(x, 0, Math.max(0, this.w - s.w)), y: AG.util.clamp(y, 0, Math.max(0, this.h - s.h)) }; }
    /** A spot so the piece sits centred on cell (x, y), inside the board. */
    centreOn(piece, x, y) { const s = piece.turnedShape; return this.clamp(piece, x - Math.floor((s.w - 1) / 2), y - Math.floor((s.h - 1) / 2)); }
    cellAt(cx, cy) {
      const r = this.el.getBoundingClientRect(), x = Math.floor((cx - r.left) / this.px), y = Math.floor((cy - r.top) / this.px);
      return x >= 0 && y >= 0 && x < this.w && y < this.h ? { x, y } : null;
    }
    /** Where a dragged piece's top-left cell lands: grab is the pointer's offset inside the piece in board CSS px. */
    originFor(piece, cx, cy, grab) {
      const r = this.el.getBoundingClientRect();
      return { x: Math.round((cx - r.left - grab.x) / this.px), y: Math.round((cy - r.top - grab.y) / this.px) };
    }
    ghost(piece, x, y) {
      this._ghost = [piece, x, y];
      const res = this.canPlace(piece, x, y), px = this.px, s = piece.turnedShape, g = this.ghostEl;
      const bad = new Set(res.blocked.map(c => c.x + ',' + c.y));
      g.hidden = false;
      g.className = 'agp-ghost ' + (res.ok ? 'is-ok' : 'is-bad');
      g.style.left = x * px + 'px'; g.style.top = y * px + 'px'; g.style.width = s.w * px + 'px'; g.style.height = s.h * px + 'px';
      const kids = [piece.copy(this.scale, 'agp-ghost__art')];
      for (const c of res.cells) {
        const cls = res.ok ? 'ok' : bad.has(c.x + ',' + c.y) ? 'bad' : 'dim';
        kids.push(h('span', { class: 'agp-gcell ' + cls, style: { left: (c.x - x) * px + 'px', top: (c.y - y) * px + 'px' } }, cls === 'bad' ? '✖' : ''));
      }
      kids.push(h('span', { class: 'agp-gbadge' }, res.ok ? '✔' : '✖'));
      g.replaceChildren(...kids);
      return res;
    }
    hideGhost() { this._ghost = null; this.ghostEl.hidden = true; this.ghostEl.replaceChildren(); }
    /** The keyboard cursor when nothing is held (null hides it). */
    cursor(x, y) {
      if (x == null) { this._cursor = null; this.cursorEl.hidden = true; return; }
      this._cursor = { x, y };
      const p = this.pieceAt(x, y), px = this.px, c = this.cursorEl;
      // over a placed piece the cursor frames the whole piece: Enter picks it up
      const box = p ? { x: p.at.x, y: p.at.y, w: p.turnedShape.w, h: p.turnedShape.h } : { x, y, w: 1, h: 1 };
      c.hidden = false;
      c.style.left = box.x * px + 'px'; c.style.top = box.y * px + 'px'; c.style.width = box.w * px + 'px'; c.style.height = box.h * px + 'px';
    }
    describe(x, y) {
      const p = this.pieceAt(x, y);
      const what = this.grid.isWall(x, y) ? AG.t('pieces.wall') : p ? p.label : AG.t('pieces.empty');
      return AG.t('pieces.cell', { row: String(y + 1), col: String(x + 1), what });
    }
    destroy() { this.el.remove(); }
  }

  P.GridBoard = GridBoard;
})(window.AG);
