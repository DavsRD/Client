/* E5 PIECES ENGINE — Tray: the shelf the pieces wait on. It scrolls sideways (touch scrolls it,
 * ←/→ cycles the focus through PiecePlay), keeps each piece's place in the order, and shows each
 * piece at the largest whole multiple (≤ scale) whose longer side fits maxSize CSS px.
 *
 *   const tray = new AG.pieces.Tray({ pieces, scale: 2, maxSize: 112, label })
 *   tray.el (a drop target: a piece let go here goes back)   tray.add(piece)  tray.remove(piece)  tray.has(piece)
 *   tray.pieces (in order)   tray.index  tray.current  tray.focus(i)  tray.move(±1) (wraps) → bool   tray.layout() */
window.AG = window.AG || {};
(function (AG) {
  const { h } = AG.util;
  const P = AG.pieces;

  class Tray {
    constructor(opts) {
      opts = opts || {};
      this.scale = opts.scale || 2; this.maxSize = opts.maxSize || 112;
      this.shelf = h('div', { class: 'agp-tray__shelf', role: 'list' });
      this.el = h('div', { class: 'agp-tray', 'data-dnd-target': '', role: 'group', 'aria-label': AG.pick(opts.label) || AG.t('pieces.tray') }, this.shelf);
      this.order = []; // every piece that belongs to this tray, in its home order
      this.index = 0;
      (opts.pieces || []).forEach(p => this.add(p));
    }
    get pieces() { return this.order.filter(p => p.el.parentNode === this.shelf); }
    get current() { return this.pieces[this.index] || null; }
    has(p) { return p.el.parentNode === this.shelf; }
    scaleFor(p) { const s = p.image(0), turnedMax = Math.max(s.width, s.height); return P.fitScale(turnedMax, turnedMax, this.maxSize, this.maxSize, this.scale); }
    /** Puts a piece (back) on the shelf at its own place in the order. */
    add(p) {
      if (!this.order.includes(p)) this.order.push(p);
      const after = this.order.slice(this.order.indexOf(p) + 1).find(q => this.has(q));
      this.shelf.insertBefore(p.el, after ? after.el : null);
      p.el.style.left = p.el.style.top = ''; // a board position no longer applies
      p.el.setAttribute('role', 'listitem');
      p.setState('tray'); p.at = null;
      p.setScale(this.scaleFor(p));
      this.roving();
      return p;
    }
    /** Takes a piece's element off the shelf (it's on a board now). */
    remove(p) { if (this.has(p)) { p.el.remove(); p.el.removeAttribute('role'); } this.index = Math.min(this.index, Math.max(0, this.pieces.length - 1)); this.roving(); }
    forget(p) { this.remove(p); this.order = this.order.filter(q => q !== p); }
    layout() { this.pieces.forEach(p => p.setScale(this.scaleFor(p))); }
    roving() { this.pieces.forEach((p, i) => { p.el.tabIndex = i === this.index ? 0 : -1; }); }
    focus(i, opts) {
      const list = this.pieces;
      if (!list.length) { this.el.tabIndex = 0; if (!(opts && opts.noFocus)) this.el.focus({ preventScroll: true }); return null; }
      this.el.removeAttribute('tabindex');
      this.index = AG.util.clamp(i == null ? this.index : i, 0, list.length - 1);
      this.roving();
      const p = list[this.index];
      if (!(opts && opts.noFocus)) p.el.focus({ preventScroll: true });
      this.reveal(p);
      return p;
    }
    /** Scrolls the shelf (only the shelf, never the page) so the piece is in view. */
    reveal(p) {
      const s = this.shelf, l = p.el.offsetLeft - s.offsetLeft, r = l + p.el.offsetWidth;
      if (l < s.scrollLeft) s.scrollLeft = l - 8; else if (r > s.scrollLeft + s.clientWidth) s.scrollLeft = r - s.clientWidth + 8;
    }
    /** ←/→ cycle: past the last piece comes the first again. */
    move(d) { const n = this.pieces.length; if (n < 2) return false; this.focus(((this.index + d) % n + n) % n); return true; }
    indexOf(p) { return this.pieces.indexOf(p); }
    destroy() { this.el.remove(); }
  }

  P.Tray = Tray;
})(window.AG);
