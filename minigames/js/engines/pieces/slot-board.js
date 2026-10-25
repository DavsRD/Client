/* E5 PIECES ENGINE — SlotBoard: the jigsaw board. Every image piece has one home slot; it snaps in
 * when its centre is let go within `snap` board px (14) of the home centre at turn 0, else PiecePlay
 * bounces it back to the tray. The ghost only shows where the piece would go, never whether it's right.
 *
 *   const b = new AG.pieces.SlotBoard({ cols, rows, pw, ph, slots, scale: 'auto', maxScale: 3, snap: 14, guide, label })
 *        slots: [{ x, y, w, h }] in board px (default: a cols × rows grid of pw × ph)   guide: a faint picture (key or canvas)
 *   b.check(piece, slot) → 'ok' | 'slot' | 'turn'   b.place(piece, slot) → bool   b.remove(piece)   b.done   b.placed (Map)
 *   b.snapFor(piece, clientX, clientY) → { slot, dist, ok }   (piece centre in client px)   b.slotAt(clientX, clientY)
 *   b.step(slot, 'left' | 'right' | 'up' | 'down') → the nearest slot that way   b.ghost(piece, slot)  b.hideGhost()  b.cursor(slot) */
window.AG = window.AG || {};
(function (AG) {
  const { h } = AG.util;
  const P = AG.pieces;
  const DIRV = { left: [-1, 0], right: [1, 0], up: [0, -1], down: [0, 1] };

  class SlotBoard {
    constructor(opts) {
      opts = opts || {};
      this.kind = 'slots';
      this.pw = opts.pw || 40; this.ph = opts.ph || this.pw;
      this.cols = opts.cols || 3; this.rows = opts.rows || 3;
      this.slots = opts.slots || Array.from({ length: this.cols * this.rows }, (_, i) => ({ x: (i % this.cols) * this.pw, y: Math.floor(i / this.cols) * this.ph, w: this.pw, h: this.ph }));
      this.bw = Math.max(...this.slots.map(s => s.x + s.w)); this.bh = Math.max(...this.slots.map(s => s.y + s.h));
      this.snap = opts.snap != null ? opts.snap : 14;
      this.auto = opts.scale === 'auto' || opts.scale == null; this.maxScale = opts.maxScale || 3; this.scale = this.auto ? 2 : opts.scale;
      this.placed = new Map(); // slot → piece
      this.slotEls = this.slots.map((s, i) => h('div', { class: 'agp-slot', 'data-slot': String(i) }));
      this.guideEl = null;
      if (opts.guide) {
        const src = typeof opts.guide === 'string' ? null : opts.guide;
        this.guideEl = src ? P.copy(src, 1, 'agp-slots__guide') : h('img', { class: 'ag-px agp-slots__guide', src: (AG.assets && AG.assets.url(opts.guide)) || AG.assets.placeholderURL(opts.guide, this.bw, this.bh), alt: '', draggable: 'false' });
      }
      this.layer = h('div', { class: 'agp-grid__layer' });
      this.ghostEl = h('div', { class: 'agp-ghost agp-ghost--slot', hidden: true, 'aria-hidden': 'true' });
      this.cursorEl = h('div', { class: 'agp-cursor', hidden: true, 'aria-hidden': 'true' });
      this.el = h('div', { class: 'agp-board agp-slots', 'data-dnd-target': '', tabindex: '-1', role: 'application', 'aria-label': AG.pick(opts.label) || AG.t('pieces.board') },
        this.guideEl, ...this.slotEls, this.layer, this.ghostEl, this.cursorEl);
      this.setScale(this.scale);
    }
    get pieces() { return [...this.placed.values()]; }
    get done() { return this.placed.size === this.slots.length; }
    fit(width) { if (this.auto && width > 0) this.setScale(P.fitScale(this.bw + 6, 1, width, 0, this.maxScale)); return this.scale; }
    setScale(s) {
      this.scale = s;
      this.el.style.setProperty('--agp-dot', s + 'px');
      this.el.style.width = this.bw * s + 'px'; this.el.style.height = this.bh * s + 'px';
      this.slots.forEach((r, i) => { Object.assign(this.slotEls[i].style, { left: r.x * s + 'px', top: r.y * s + 'px', width: r.w * s + 'px', height: r.h * s + 'px' }); });
      if (this.guideEl) P.sizeTo(this.guideEl, this.bw, this.bh, s);
      this.pieces.forEach(p => this.position(p, p.at));
      if (this._ghost) this.ghost(...this._ghost);
      if (this._cursor != null) this.cursor(this._cursor);
    }
    centre(i) { const r = this.slots[i]; return { x: r.x + r.w / 2, y: r.y + r.h / 2 }; }
    /** Centres the piece's art on the slot (cutter pieces have their body in the middle of the art). */
    position(p, i, el) {
      const c = this.centre(i), sz = p.size, s = this.scale;
      (el || p.el).style.left = Math.round(c.x - sz.w / 2) * s + 'px'; (el || p.el).style.top = Math.round(c.y - sz.h / 2) * s + 'px';
    }
    check(piece, i) { return i !== piece.home ? 'slot' : piece.rot !== 0 ? 'turn' : 'ok'; }
    place(piece, i, force) {
      if (this.placed.has(i) || (!force && this.check(piece, i) !== 'ok')) return false;
      this.placed.set(i, piece); piece.at = i; piece.setState('placed'); piece.setScale(this.scale);
      piece.el.removeAttribute('role'); piece.el.tabIndex = -1; piece.el.classList.add('done');
      this.layer.append(piece.el); this.position(piece, i);
      this.slotEls[i].classList.add('is-filled');
      return true;
    }
    remove(piece) {
      if (piece.at == null || this.placed.get(piece.at) !== piece) return;
      this.placed.delete(piece.at); this.slotEls[piece.at].classList.remove('is-filled');
      piece.el.classList.remove('done'); piece.el.style.left = piece.el.style.top = '';
      if (piece.el.parentNode === this.layer) piece.el.remove();
      piece.at = null;
    }
    pieceAt(i) { return this.placed.get(i) || null; }
    local(cx, cy) { const r = this.el.getBoundingClientRect(); return { x: (cx - r.left) / this.scale, y: (cy - r.top) / this.scale }; }
    slotAt(cx, cy) { const p = this.local(cx, cy); return this.slots.findIndex(r => p.x >= r.x && p.y >= r.y && p.x < r.x + r.w && p.y < r.y + r.h); }
    /** The open slot nearest the piece's centre (client px), and whether it snaps home. */
    snapFor(piece, cx, cy) {
      const p = this.local(cx, cy);
      let best = -1, dist = Infinity;
      this.slots.forEach((r, i) => { if (this.placed.has(i)) return; const c = this.centre(i), d = Math.hypot(c.x - p.x, c.y - p.y); if (d < dist) { dist = d; best = i; } });
      return { slot: best, dist, ok: best === piece.home && piece.rot === 0 && dist <= this.snap };
    }
    /** The nearest slot in a direction (it must lie that way; the sideways distance counts double). */
    step(i, dir) {
      const v = DIRV[dir], a = this.centre(i);
      let best = -1, score = Infinity;
      this.slots.forEach((r, j) => {
        if (j === i) return;
        const c = this.centre(j), along = (c.x - a.x) * v[0] + (c.y - a.y) * v[1], side = Math.abs((c.x - a.x) * v[1] - (c.y - a.y) * v[0]);
        if (along <= 0.5) return;
        const sc = along + side * 2;
        if (sc < score) { score = sc; best = j; }
      });
      return best;
    }
    ghost(piece, i) {
      this._ghost = [piece, i];
      const g = this.ghostEl, art = piece.copy(this.scale, 'agp-ghost__art');
      g.hidden = false; g.className = 'agp-ghost agp-ghost--slot';
      g.style.width = piece.size.w * this.scale + 'px'; g.style.height = piece.size.h * this.scale + 'px';
      this.position(piece, i, g);
      g.replaceChildren(art);
      this.slotEls.forEach((el, j) => el.classList.toggle('hot', j === i));
    }
    hideGhost() { this._ghost = null; this.ghostEl.hidden = true; this.ghostEl.replaceChildren(); this.slotEls.forEach(el => el.classList.remove('hot')); }
    cursor(i) {
      if (i == null) { this._cursor = null; this.cursorEl.hidden = true; return; }
      this._cursor = i;
      const r = this.slots[i], s = this.scale;
      Object.assign(this.cursorEl.style, { left: r.x * s + 'px', top: r.y * s + 'px', width: r.w * s + 'px', height: r.h * s + 'px' });
      this.cursorEl.hidden = false;
    }
    describe(i) { const p = this.pieceAt(i); return AG.t('pieces.slot', { n: String(i + 1), what: p ? p.label : AG.t('pieces.empty') }); }
    destroy() { this.el.remove(); }
  }

  P.SlotBoard = SlotBoard;
})(window.AG);
