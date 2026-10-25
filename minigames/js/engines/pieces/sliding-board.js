/* E5 PIECES ENGINE — SlidingBoard: the DOM view of AG.logic.SlidingTilePuzzle. Arrows (and WASD,
 * and the D-pad) move a tile INTO the gap; a tap on a tile next to the gap slides it. Tiles are
 * the cutter's canvases (or numbers) at a whole multiple; the gap's own tile shows once it's solved.
 *
 *   const sb = new AG.pieces.SlidingBoard({ puzzle, tiles, scale: 'auto', maxScale: 3, label, sfx: { slide, bump },
 *        onMove(move, puzzle), onSolved(puzzle) })      tiles: [canvas] from AG.pieces.cutGrid (or none: numbers)
 *   stage.append(sb.el); sb.focus()   sb.move('left')  sb.tap(cell)  sb.render()  sb.enabled = false  sb.destroy() */
window.AG = window.AG || {};
(function (AG) {
  const { h } = AG.util;
  const P = AG.pieces;
  const DIRS = { UP: 'up', DOWN: 'down', LEFT: 'left', RIGHT: 'right' };

  class SlidingBoard {
    constructor(o) {
      this.o = o = o || {};
      this.puzzle = o.puzzle;
      this.tiles = o.tiles || null;
      this.tw = this.tiles ? this.tiles[0].width : (o.tile || 32); this.th = this.tiles ? this.tiles[0].height : (o.tile || 32);
      this.auto = o.scale === 'auto' || o.scale == null; this.maxScale = o.maxScale || 3; this.scale = this.auto ? 2 : o.scale;
      this.sounds = Object.assign({ slide: 'tap', bump: 'soft' }, o.sfx);
      this.enabled = true; this.offs = [];
      const { cols, rows, n } = this.puzzle;
      this.tileEls = Array.from({ length: n }, (_, id) => {
        const b = h('button', { type: 'button', class: 'agp-stile', tabindex: '-1', 'data-tile': String(id) },
          this.tiles ? P.copy(this.tiles[id], 1, 'agp-stile__art') : h('span', { class: 'agp-stile__num' }, String(id + 1)));
        P.onPress(b, () => this.tap(this.puzzle.cellOf(id)));
        return b;
      });
      this.board = h('div', { class: 'agp-slide', tabindex: '-1', role: 'application', 'aria-label': AG.pick(o.label) || AG.t('pieces.board') }, ...this.tileEls);
      this.live = h('div', { class: 'agp-sr', 'aria-live': 'polite' });
      this.el = h('div', { class: 'agp-slidewrap' }, this.board, this.live);
      this.cols = cols; this.rows = rows;
      const fit = () => { const w = this.el.clientWidth; if (w && this.auto) this.setScale(P.fitScale(this.cols * this.tw + 6, 1, w, 0, this.maxScale)); };
      this.ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(fit) : null;
      if (this.ro) this.ro.observe(this.el);
      Object.keys(DIRS).forEach(a => { AG.input.repeat(a, { delay: 260, interval: 160 }); this.offs.push(AG.input.on(a, e => { if (e.phase !== 'up') this.move(DIRS[a]); })); });
      this.setScale(this.scale);
    }
    setScale(s) {
      this.scale = s;
      Object.assign(this.board.style, { width: this.cols * this.tw * s + 'px', height: this.rows * this.th * s + 'px' });
      this.tileEls.forEach(b => { P.sizeTo(b, this.tw, this.th, s); const art = b.firstChild; if (art && art.tagName === 'CANVAS') P.sizeTo(art, this.tw, this.th, s); });
      this.render(true);
    }
    render(instant) {
      const p = this.puzzle, s = this.scale;
      this.board.classList.toggle('is-instant', !!instant || AG.reducedMotion());
      this.board.classList.toggle('is-solved', p.solved);
      p.tiles.forEach((id, cell) => {
        const b = this.tileEls[id], xy = p.xy(cell);
        b.style.left = xy.x * this.tw * s + 'px'; b.style.top = xy.y * this.th * s + 'px';
        const gap = id === p.gapId;
        b.hidden = gap && !p.solved;
        b.classList.toggle('is-next', !p.solved && p.canTap(cell));
        b.setAttribute('aria-label', gap ? AG.t('pieces.gap') : AG.t('pieces.tile', { n: String(id + 1) }));
      });
      if (instant) { void this.board.offsetWidth; this.board.classList.toggle('is-instant', AG.reducedMotion()); } // jump now, slide again from here on
    }
    focus() { this.board.focus({ preventScroll: true }); }
    done(m) {
      if (!m) { P.sfx(this.sounds.bump); return null; }
      P.sfx(this.sounds.slide);
      this.render();
      this.live.textContent = AG.t('pieces.slid', { n: String(m.tile + 1) });
      if (this.o.onMove) this.o.onMove(m, this.puzzle);
      if (this.puzzle.solved) { this.live.textContent = AG.t('pieces.solved'); if (this.o.onSolved) this.o.onSolved(this.puzzle); }
      return m;
    }
    move(dir) { if (!this.enabled || AG.paused || this.puzzle.solved) return null; return this.done(this.puzzle.move(dir)); }
    tap(cell) { if (!this.enabled || AG.paused || this.puzzle.solved) return null; this.focus(); return this.done(this.puzzle.tap(cell)); }
    destroy() { this.offs.forEach(f => f()); this.offs = []; if (this.ro) this.ro.disconnect(); this.el.remove(); }
  }

  P.SlidingBoard = SlidingBoard;
})(window.AG);
