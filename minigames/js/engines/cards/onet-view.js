/* E6 CARDS ENGINE — OnetView: the Onet connect board on screen, over AG.logic.onet.
 *
 *   const v = new AG.cards.OnetView({
 *     board: AG.logic.onet.deal(8, 6, tiles, rnd),   // tiles: values, or { pair, front, label }
 *     face: tile => faceSpec,                       // default: tile.front, else the tile itself
 *     under: (x, y) => Element | null,              // shown in a cleared cell (e.g. a breeding site)
 *     onMatch({ a, b, path, tiles }), onMiss({ a, b, reason: 'different' | 'blocked' }),
 *     onSelect({ x, y, tile }), onEmptySelect({ x, y }), onClear(), onNoMoves()
 *   });
 *   stage.append(v.el)
 *
 * Select two tiles (arrows + Enter, or tap): if they match and a line with ≤ 2 turns joins
 * them (through empty cells and the outer border), a pixel line is drawn and both clear.
 * When no move is left, onNoMoves() runs; without it the board shuffles itself.
 * v.shuffle(), v.hint() (highlights a valid pair, returns it), v.setBoard(b), v.destroy().
 * The cursor is a CardGrid, so focus, WASD and Home/End work as there. */
window.AG = window.AG || {};
(function (AG) {
  const { h } = AG.util;
  const O = () => AG.logic.onet;
  const sfx = name => AG.sfx && AG.sfx.play(name);
  const PX = 2; // one line pixel = 2 CSS px

  class OnetView {
    constructor(opts) {
      this.opts = Object.assign({ lineMs: 380 }, opts || {});
      this.sel = null; this.busy = false;
      this.canvas = h('canvas', { class: 'ag-px agc-onet__line', 'aria-hidden': 'true' });
      this.grid = new AG.cards.CardGrid({
        className: 'agc-onet__grid', label: this.opts.label, stage: this.opts.stage, sound: false,
        selectable: () => true,
        onSelect: (card, i) => this.pick(i % this.board.w, Math.floor(i / this.board.w))
      });
      this.el = h('div', { class: 'agc-onet' }, this.grid.el, this.canvas);
      this.setBoard(this.opts.board);
    }

    faceOf(tile) { return this.opts.face ? this.opts.face(tile) : tile && typeof tile === 'object' && 'front' in tile ? tile.front : tile; }
    setBoard(b) {
      this.board = b; this.sel = null;
      this.grid.setCols(b.w);
      this.el.style.setProperty('--cols', b.w);
      this.grid.setCards(b.cells.map((tile, i) => this.cardFor(tile, i)));
      this.clearLine();
    }
    cardFor(tile, i) {
      const x = i % this.board.w, y = Math.floor(i / this.board.w);
      if (tile == null) {
        const under = this.opts.under ? this.opts.under(x, y) : null;
        const c = new AG.cards.Card({ id: 'o' + i, front: null, state: 'disabled', className: 'is-empty', label: AG.t('cards.empty') });
        if (under) { c.frontEl.replaceChildren(under); c.el.classList.add('has-under'); }
        return c;
      }
      return new AG.cards.Card({ id: 'o' + i, front: this.faceOf(tile), state: 'revealed', label: tile && tile.label });
    }
    /** Re-draws every cell from the board (after a shuffle or a game change). */
    refresh() {
      const idx = this.grid.index;
      this.setBoard(this.board);
      this.grid.nav.index = idx; this.grid.nav.sync();
    }
    cardAt(p) { return this.grid.cards[p.y * this.board.w + p.x]; }

    pick(x, y) {
      if (this.busy || AG.paused) return;
      const tile = O().get(this.board, x, y), p = { x, y };
      if (tile == null) { this.opts.onEmptySelect && this.opts.onEmptySelect(p); return; }
      if (!this.sel) { this.sel = p; this.cardAt(p).select(true); sfx('tap'); this.opts.onSelect && this.opts.onSelect({ x, y, tile }); return; }
      if (this.sel.x === x && this.sel.y === y) { this.cardAt(p).select(false); this.sel = null; return; }
      const a = this.sel, path = O().canConnect(this.board, a, p);
      this.cardAt(a).select(false); this.sel = null;
      if (!path) {
        const reason = this.board.match(O().get(this.board, a.x, a.y), tile) ? 'blocked' : 'different';
        [a, p].forEach(q => AG.kit.shake(this.cardAt(q).el));
        sfx('soft');
        this.opts.onMiss && this.opts.onMiss({ a, b: p, reason });
        return;
      }
      const tiles = [O().get(this.board, a.x, a.y), tile];
      this.busy = true;
      this.cardAt(p).select(true); this.cardAt(a).select(true);
      this.drawLine(path);
      sfx('good');
      setTimeout(() => {
        O().remove(this.board, a, p);
        [a, p].forEach(q => { const i = q.y * this.board.w + q.x; this.replaceCard(i); });
        this.clearLine(); this.busy = false;
        this.opts.onMatch && this.opts.onMatch({ a, b: p, path, tiles });
        if (O().isClear(this.board)) { this.opts.onClear && this.opts.onClear(); return; }
        if (!O().hasAnyMove(this.board)) { if (this.opts.onNoMoves) this.opts.onNoMoves(); else this.shuffle(); }
      }, AG.reducedMotion() ? Math.min(240, this.opts.lineMs) : this.opts.lineMs);
    }
    replaceCard(i) {
      const old = this.grid.cards[i], card = this.cardFor(this.board.cells[i], i);
      card.n = i; card.updateLabel();
      card.el.tabIndex = old.el.tabIndex;
      const hadFocus = document.activeElement === old.el;
      old.el.replaceWith(card.el); this.grid.cards[i] = card;
      if (hadFocus) card.el.focus({ preventScroll: true });
    }

    /** Pair-preserving shuffle of the tiles left (AG.logic.onet.shuffle). */
    shuffle() {
      if (this.busy) return this.board;
      this.board = O().shuffle(this.board, this.opts.rnd);
      this.refresh();
      sfx('blip');
      return this.board;
    }
    /** Highlights one valid pair for a moment; returns { a, b, path } or null. */
    hint(ms) {
      const m = O().findMove(this.board);
      if (!m) return null;
      [m.a, m.b].forEach(q => { const el = this.cardAt(q).el; el.classList.add('is-hint'); setTimeout(() => el.classList.remove('is-hint'), ms || 1600); });
      return m;
    }

    /* ---------- the pixel line ---------- */
    /** Cell (or border lane) → its centre in px of the board's padding box, where the canvas sits.
     *  The border lanes (x = -1 / w, y = -1 / h) run down the middle of the padding ring. */
    centers() {
      const r = this.el.getBoundingClientRect();
      const ox = r.left + this.el.clientLeft, oy = r.top + this.el.clientTop;
      const W = this.el.clientWidth, H = this.el.clientHeight, { w, h } = this.board;
      const c0 = this.cardAt({ x: 0, y: 0 }).el.getBoundingClientRect();
      const cx = w > 1 ? this.cardAt({ x: 1, y: 0 }).el.getBoundingClientRect().left - c0.left : c0.width;
      const cy = h > 1 ? this.cardAt({ x: 0, y: 1 }).el.getBoundingClientRect().top - c0.top : c0.height;
      const left = c0.left - ox, top = c0.top - oy, right = left + (w - 1) * cx + c0.width, bottom = top + (h - 1) * cy + c0.height;
      return p => ({
        x: p.x < 0 ? left / 2 : p.x >= w ? (right + W) / 2 : left + c0.width / 2 + p.x * cx,
        y: p.y < 0 ? top / 2 : p.y >= h ? (bottom + H) / 2 : top + c0.height / 2 + p.y * cy
      });
    }
    drawLine(path) {
      const W = Math.ceil(this.el.clientWidth / PX), H = Math.ceil(this.el.clientHeight / PX);
      this.canvas.width = W; this.canvas.height = H;
      const g = this.canvas.getContext('2d');
      const css = getComputedStyle(this.el);
      const ink = css.getPropertyValue('--ink').trim() || '#1e1538', hat = css.getPropertyValue('--hat').trim() || '#ffd23f';
      const at = this.centers();
      const pts = path.map(p => { const c = at(p); return { x: Math.round(c.x / PX), y: Math.round(c.y / PX) }; });
      const seg = (a, b, t, col) => {
        g.fillStyle = col;
        const x = Math.min(a.x, b.x) - t, y = Math.min(a.y, b.y) - t;
        g.fillRect(x, y, Math.abs(a.x - b.x) + t * 2 + 1, Math.abs(a.y - b.y) + t * 2 + 1);
      };
      // ink outline under a 3-pixel hard-hat yellow line; square dots at the ends
      for (let i = 1; i < pts.length; i++) seg(pts[i - 1], pts[i], 2, ink);
      [pts[0], pts[pts.length - 1]].forEach(p => seg(p, p, 3, ink));
      for (let i = 1; i < pts.length; i++) seg(pts[i - 1], pts[i], 1, hat);
      [pts[0], pts[pts.length - 1]].forEach(p => seg(p, p, 2, hat));
      this.canvas.hidden = false;
    }
    clearLine() { const g = this.canvas.getContext('2d'); g.clearRect(0, 0, this.canvas.width, this.canvas.height); this.canvas.hidden = true; }

    destroy() { this.grid.destroy(); }
  }

  AG.cards = Object.assign(AG.cards || {}, { OnetView });
})(window.AG);
