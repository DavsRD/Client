/* E7 SIMULATION ENGINE — BuildSlots: spots on the canvas where the player builds (plant a tree, dig
 * a canal) from a pop-up menu of up to 4 options. Touch: tap a slot → the menu opens beside it; tap
 * an option (or Remove, or ✕ / outside to close). Keys: arrows move between slots, Enter opens /
 * closes, 1–4 pick, Backspace removes, Esc closes. The engine never charges or scores: can() says yes
 * or why not, and 'build' / 'remove' tell the game. Needs AG.input.setView(view). Docs: docs/engines/sim.md */
window.AG = window.AG || {};
(function (AG) {
  const S = AG.logic.sim, { h } = AG.util;
  const DIRS = { UP: 'up', DOWN: 'down', LEFT: 'left', RIGHT: 'right' };
  const GHOST_MS = 300; // a tap that opened the menu never also picks from it

  class BuildSlots extends S.Emitter {
    /** o: { view, stage, slots: [{ id, x, y (centre), w: 20, h: 20, built?, label? }], options: [{ id, label, icon | art, cost? }] (≤ 4),
     *       can(slot, option) → true | false | { en } (why not), removable: true, title: { en }, removeLabel: { en: 'Remove' }, hitPad: 8, input: true, alwaysShow } */
    constructor(o) {
      super();
      this.o = o; this.view = o.view; this.stage = o.stage || o.view.cv.parentElement;
      this.slots = o.slots.map(s => Object.assign({ w: 20, h: 20, built: null }, s));
      this.options = (o.options || []).slice(0, 4);
      this.removable = o.removable !== false; this.hitPad = o.hitPad == null ? 8 : o.hitPad;
      this.sel = 0; this.isOpen = false; this.menu = null; this.openedAt = 0; this.offs = [];
      if (o.input !== false && AG.input) this.bind();
    }
    get selected() { return this.slots[this.sel] || null; }
    option(id) { return this.options.find(op => op.id === id) || null; }
    slot(id) { return this.slots.find(s => s.id === id) || null; }
    select(i) { if (i >= 0 && i < this.slots.length && i !== this.sel) { this.sel = i; this.emit('select', this.selected); } return this; }
    move(dir) {
      const j = S.nearestInDirection(this.slots, this.sel, dir);
      if (j < 0) return false;
      if (this.isOpen) this.close();
      this.select(j);
      return true;
    }
    /** true, or the reason (a { en } text, or false) this option can't go on this slot now. */
    check(slot, op) { const r = this.o.can ? this.o.can(slot, op) : true; return r === undefined ? true : r; }
    /** Builds option n (1-based) on the selected slot. → true when built. */
    pick(n) {
      const op = this.options[n - 1], slot = this.selected;
      if (!op || !slot) return false;
      if (slot.built === op.id) { this.close(); return false; }
      const r = this.check(slot, op);
      if (r !== true) { this.emit('deny', { slot, option: op, reason: r || null }); this.shakeMenu(); return false; }
      const prev = this.option(slot.built);
      slot.built = op.id;
      this.emit('build', { slot, option: op, replaced: prev });
      this.close();
      return true;
    }
    /** Removes what is built on slot i (default: the selected one). */
    remove(i) {
      const slot = this.slots[i == null ? this.sel : i];
      if (!slot || !slot.built || !this.removable) return false;
      const op = this.option(slot.built);
      slot.built = null;
      this.emit('remove', { slot, option: op });
      if (this.isOpen) this.close();
      return true;
    }
    /** Sets a slot's building without events (level setup). */
    setBuilt(id, optionId) { const s = this.slot(id); if (s) s.built = optionId || null; return this; }
    hit(x, y) {
      let best = -1, bd = Infinity;
      this.slots.forEach((s, i) => {
        const p = this.hitPad;
        if (Math.abs(x - s.x) > s.w / 2 + p || Math.abs(y - s.y) > s.h / 2 + p) return;
        const d = (x - s.x) ** 2 + (y - s.y) ** 2;
        if (d < bd) { bd = d; best = i; }
      });
      return best;
    }

    bind() {
      Object.keys(DIRS).forEach(a => this.offs.push(AG.input.on(a, e => { if (e.phase !== 'up') this.move(DIRS[a]); })));
      this.offs.push(AG.input.on('CONFIRM', e => { if (e.phase === 'down') (this.isOpen ? this.close() : this.open()); }));
      for (let n = 1; n <= 4; n++) this.offs.push(AG.input.on('CHOICE_' + n, e => { if (e.phase === 'down' && this.isOpen) this.pick(n); }));
      this.offs.push(AG.input.on('UNDO', e => { if (e.phase === 'down') this.remove(); }));
      this.offs.push(AG.input.on('CANCEL', e => { if (e.phase === 'down' && this.isOpen) this.close(); }));
      this.offs.push(AG.input.onPointer('tap', p => {
        const i = this.hit(p.x, p.y);
        if (i < 0) { if (this.isOpen) this.close(); return; }
        if (i === this.sel && this.isOpen) this.close(); else this.open(i);
      }));
    }

    /* ---------- the pop-up menu (DOM, over the stage) ---------- */
    open(i) {
      if (i != null) this.select(i);
      const slot = this.selected;
      if (!slot) return this;
      this.close(true);
      const btn = (cls, kids, act, extra) => {
        const b = h('button', Object.assign({ type: 'button', class: 'ag-simmenu__opt ' + cls, role: 'menuitem' }, extra), ...kids);
        b.addEventListener('pointerdown', e => e.preventDefault()); // keep the focus (and the keys) on the stage
        b.addEventListener('pointerup', e => { if (performance.now() - this.openedAt > GHOST_MS) act(); e.preventDefault(); });
        b.addEventListener('click', e => { if (e.detail === 0) act(); }); // keyboard activation only; pointers use pointerup
        return b;
      };
      const opts = this.options.map((op, k) => {
        const r = this.check(slot, op), why = r === true ? '' : AG.pick(r) || '';
        return btn((slot.built === op.id ? 'is-on' : '') + (r === true ? '' : ' is-no'), [
          h('span', { class: 'ag-key', 'aria-hidden': 'true' }, String(k + 1)),
          op.icon ? AG.ui.icon(op.icon, 36) : op.art ? h('img', { class: 'ag-px', src: AG.assets.url(op.art) || 'assets/images/Blank.jpg', alt: '', width: 36, height: 36 }) : null,
          h('span', { class: 'ag-simmenu__txt' }, AG.pick(op.label), why ? h('small', {}, why) : op.cost != null ? h('small', {}, AG.pick(op.costLabel) || String(op.cost)) : null)
        ], () => this.pick(k + 1), { 'aria-disabled': r === true ? null : 'true', title: why || AG.pick(op.costLabel) || null });
      });
      const op = this.option(slot.built);
      const rm = op && this.removable ? btn('is-remove', [h('span', { class: 'ag-key', 'aria-hidden': 'true' }, '⌫'), h('span', { class: 'ag-simmenu__txt' }, AG.pick(this.o.removeLabel) || 'Remove')], () => this.remove()) : null;
      const x = btn('ag-simmenu__close', ['✕'], () => this.close(), { 'aria-label': 'Close', role: null });
      this.menu = h('div', { class: 'ag-simmenu', role: 'menu', 'aria-label': AG.pick(slot.label || this.o.title) || 'Build' },
        h('div', { class: 'ag-simmenu__head' }, h('b', {}, AG.pick(slot.label || this.o.title) || 'Build'), x), ...opts, rm);
      this.stage.append(this.menu);
      this.place(slot);
      this.isOpen = true; this.openedAt = performance.now();
      if (AG.input) AG.input.armCancel(true);
      this.emit('open', slot);
      return this;
    }
    /** Puts the menu beside the slot (above it if it fits, else below), inside the stage. A list too
     *  tall for the stage (phones) becomes one row of tiles. */
    place(slot) {
      const m = this.menu, cv = this.view.cv.getBoundingClientRect(), st = this.stage.getBoundingClientRect(), k = cv.width / this.view.W;
      const cx = cv.left - st.left + slot.x * k, top = cv.top - st.top + (slot.y - slot.h / 2) * k, bottom = cv.top - st.top + (slot.y + slot.h / 2) * k;
      if (m.offsetHeight > st.height - 8) m.classList.add('ag-simmenu--tiles');
      const mw = m.offsetWidth, mh = m.offsetHeight;
      const left = Math.max(4, Math.min(st.width - mw - 4, cx - mw / 2));
      let y = top - mh - 6;
      if (y < 4) y = bottom + 6;
      y = Math.max(4, Math.min(st.height - mh - 4, y));
      m.style.left = Math.round(left) + 'px'; m.style.top = Math.round(y) + 'px';
    }
    close(quiet) {
      if (!this.menu) return this;
      const had = this.menu.contains(document.activeElement);
      this.menu.remove(); this.menu = null; this.isOpen = false;
      if (AG.input) AG.input.armCancel(false);
      if (had) (this.stage.closest('.ag-stage') || this.stage).focus({ preventScroll: true });
      if (!quiet) this.emit('close', this.selected);
      return this;
    }
    shakeMenu() { if (this.menu && AG.kit) AG.kit.shake(this.menu); }

    /** Slots on the canvas: empty = dashed square with a +, built = the option's art or icon;
     *  the selected slot gets corner brackets (keyboard players always see it, touch while the menu is open). */
    draw(ctx, t) {
      const D = AG.sim.draw, keys = AG.input && AG.input.lastDevice === 'keyboard';
      this.slots.forEach((s, i) => {
        const x = Math.round(s.x - s.w / 2), y = Math.round(s.y - s.h / 2), op = this.option(s.built);
        if (op) {
          if (op.art) AG.assets.draw(ctx, op.art, x, y, s.w, s.h);
          else if (op.icon) AG.gfx.drawIcon(ctx, op.icon, Math.round(s.x - 9), Math.round(s.y - 9), 1);
        } else {
          D.line(ctx, x, y, x + s.w - 1, y, { color: '#fff8e6', dash: [2, 2] }); D.line(ctx, x, y + s.h - 1, x + s.w - 1, y + s.h - 1, { color: '#fff8e6', dash: [2, 2] });
          D.line(ctx, x, y, x, y + s.h - 1, { color: '#fff8e6', dash: [2, 2] }); D.line(ctx, x + s.w - 1, y, x + s.w - 1, y + s.h - 1, { color: '#fff8e6', dash: [2, 2] });
          ctx.fillStyle = '#1e1538'; ctx.fillRect(Math.round(s.x) - 3, Math.round(s.y) - 1, 7, 3); ctx.fillRect(Math.round(s.x) - 1, Math.round(s.y) - 3, 3, 7);
          ctx.fillStyle = '#fff8e6'; ctx.fillRect(Math.round(s.x) - 2, Math.round(s.y), 5, 1); ctx.fillRect(Math.round(s.x), Math.round(s.y) - 2, 1, 5);
        }
        if (i === this.sel && (keys || this.isOpen || this.o.alwaysShow)) D.brackets(ctx, x, y, s.w, s.h);
      });
    }
    destroy() { this.close(true); this.offs.forEach(f => f()); this.offs = []; }
  }

  AG.sim = AG.sim || {};
  AG.sim.BuildSlots = BuildSlots;
})(window.AG);
