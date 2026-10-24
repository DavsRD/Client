/* E1 GRID ENGINE — GridCursor: the selection cursor for puzzle grids (pipes, blocks, seats),
 * on a canvas or on DOM cells. Moves with arrows / WASD / the D-pad (key repeat), CONFIRM
 * (Enter / Space) picks, a tap or click selects and picks.
 * Docs: kalasag-dev/minigames/docs/engines/grid.md
 *
 *   const cur = new AG.grid.GridCursor({
 *     w, h, x: 0, y: 0,
 *     selectable(x, y) → bool,             // default: every cell
 *     mode: 'cell' | 'nearest', wrap,      // AG.logic.gridSelect.step
 *     onMove(x, y, info), onConfirm(x, y, info), onBump(dir),   // info = { device, via: 'key' | 'tap' }
 *     tapConfirms: true,                   // false: a tap only moves the cursor
 *     // canvas grid: cells at originX + x × cell (logical canvas px), or your own mapping
 *     cell: 32, originX: 0, originY: 0, rect(x, y) → { x, y, w, h }, cellAt(px, py) → { x, y } | null,
 *     describe(x, y) → text | { en, fil }, // read out by a live region (canvas grids)
 *     stage,                               // where the live region goes (canvas grids)
 *     // DOM grid: the elements are the cells
 *     el, cellEl(x, y) → Element,          // roving tabindex, .agg-cursor, focus follows
 *     repeat: { delay: 260, interval: 120 }
 *   });
 *   cur.draw(ctx, t)   (canvas)   cur.set(x, y)  cur.move('left')  cur.confirm()  cur.refresh()
 *   cur.active = false (ignores keys and taps, e.g. while another FocusZone is active)
 *   cur.destroy()
 * For a canvas grid, the game calls AG.input.setView(view) so taps arrive in canvas pixels.
 * DOM cells are best real <button>s; Enter on a focused cell is not counted twice. */
window.AG = window.AG || {};
(function (AG) {
  const S = AG.logic.gridSelect;
  const ACTION = { up: 'UP', right: 'RIGHT', down: 'DOWN', left: 'LEFT' };
  const stageOf = o => o.stage || (o.view && o.view.cv && o.view.cv.closest('.ag-stage')) || null;

  class GridCursor {
    constructor(o) {
      this.o = o; this.w = o.w; this.h = o.h;
      this.selectable = o.selectable || (() => true);
      this.mode = o.mode || 'cell'; this.wrap = !!o.wrap;
      this.cell = o.cell || 32; this.originX = o.originX || 0; this.originY = o.originY || 0;
      this.el = o.el || null; this.offs = []; this._active = true; this.lastKeyConfirm = null;
      const start = o.x != null ? { x: o.x, y: o.y } : S.first(this) || { x: 0, y: 0 };
      this.x = start.x; this.y = start.y;
      const rep = o.repeat || { delay: 260, interval: 120 };
      if (AG.input) {
        for (const dir of Object.keys(ACTION)) {
          AG.input.repeat(ACTION[dir], rep);
          this.offs.push(AG.input.on(ACTION[dir], e => { if (this.active && (e.phase === 'down' || e.phase === 'repeat')) this.move(dir, e); }));
        }
        this.offs.push(AG.input.on('CONFIRM', e => { if (this.active && e.phase === 'down') this.confirm({ device: e.device, via: 'key' }); }));
      }
      if (this.el) this.bindDom(); else this.bindCanvas();
      this.refresh();
    }

    bindCanvas() {
      this.live = AG.util.h('div', { class: 'agg-sr', 'aria-live': 'polite' }); // placed in the stage on first use
      if (!AG.input) return;
      this.offs.push(AG.input.onPointer('tap', p => {
        if (!this.active) return;
        const c = this.cellAt(p.x, p.y);
        if (!c || !this.selectable(c.x, c.y)) return;
        this.set(c.x, c.y, { device: p.device, via: 'tap' });
        if (this.o.tapConfirms !== false) this.confirm({ device: p.device, via: 'tap' });
      }));
    }
    bindDom() {
      const onClick = e => {
        const cellEl = e.target.closest('[data-gx]');
        if (!cellEl || !this.el.contains(cellEl) || !this.active) return;
        const x = +cellEl.dataset.gx, y = +cellEl.dataset.gy;
        if (!this.selectable(x, y)) return;
        // Enter / Space on a focused <button> also clicks it: CONFIRM has already handled that
        const k = this.lastKeyConfirm;
        if (e.detail === 0 && k && k.x === x && k.y === y && performance.now() - k.at < 1000) return;
        const device = AG.input ? AG.input.lastDevice : 'mouse';
        this.set(x, y, { device, via: 'tap' });
        if (this.o.tapConfirms !== false) this.confirm({ device, via: 'tap' });
      };
      this.el.addEventListener('click', onClick);
      this.offs.push(() => this.el.removeEventListener('click', onClick));
    }
    /** Re-reads the DOM cells (after a re-render) and redraws the cursor state. */
    refresh() {
      if (this.el) {
        for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
          const c = this.o.cellEl(x, y);
          if (!c) continue;
          c.dataset.gx = x; c.dataset.gy = y;
          const on = x === this.x && y === this.y;
          c.tabIndex = on ? 0 : -1;
          c.classList.toggle('agg-cursor', on);
          c.classList.toggle('agg-cursor--idle', on && !this._active);
          if (on) c.setAttribute('aria-current', 'true'); else c.removeAttribute('aria-current');
        }
      }
      return this;
    }
    get active() { return this._active; }
    set active(v) { this._active = !!v; this.refresh(); }
    rect(x, y) { return this.o.rect ? this.o.rect(x, y) : { x: this.originX + x * this.cell, y: this.originY + y * this.cell, w: this.cell, h: this.cell }; }
    cellAt(px, py) {
      if (this.o.cellAt) return this.o.cellAt(px, py);
      const x = Math.floor((px - this.originX) / this.cell), y = Math.floor((py - this.originY) / this.cell);
      return x >= 0 && y >= 0 && x < this.w && y < this.h ? { x, y } : null;
    }

    set(x, y, info) {
      const moved = x !== this.x || y !== this.y;
      this.x = x; this.y = y;
      if (this.el) {
        this.refresh();
        const c = this.o.cellEl(x, y), stage = c && c.closest('.ag-stage');
        // focus follows the cursor while the player is using the grid (never steals it from elsewhere)
        if (c && (this.el.contains(document.activeElement) || document.activeElement === stage)) c.focus({ preventScroll: false });
      } else {
        // the canvas usually joins the stage after the cursor is made, so look for it now
        if (!this.live.isConnected) { const stage = stageOf(this.o); if (stage) stage.append(this.live); }
        const text = this.o.describe ? this.o.describe(x, y) : AG.t('grid.cell', { row: y + 1, col: x + 1 });
        this.live.textContent = AG.pick(text);
      }
      if (moved && this.o.onMove) this.o.onMove(x, y, info || {});
      return this;
    }
    move(dir, e) {
      const to = S.step(this, { x: this.x, y: this.y }, dir, { mode: this.mode, wrap: this.wrap });
      if (!to) { if (this.o.onBump) this.o.onBump(dir); return false; }
      if (AG.sfx) AG.sfx.play('tap');
      this.set(to.x, to.y, { device: e && e.device, via: 'key' });
      return true;
    }
    confirm(info) {
      info = info || {};
      if (!this.selectable(this.x, this.y)) return;
      if (info.via === 'key') this.lastKeyConfirm = { x: this.x, y: this.y, at: performance.now() };
      if (this.o.onConfirm) this.o.onConfirm(this.x, this.y, info);
    }

    /** Canvas grids: a 3 px --vest outline with a 1 px ink edge, like :focus-visible. It
     *  breathes 1 px unless Reduce Motion; a dashed look while inactive. */
    draw(ctx, t) {
      const r = this.rect(this.x, this.y);
      const pulse = this.active && !AG.reducedMotion() ? Math.floor((t || 0) * 2.5) % 2 : 0;
      const x = Math.round(r.x) - 2 - pulse, y = Math.round(r.y) - 2 - pulse, w = Math.round(r.w) + 4 + pulse * 2, h = Math.round(r.h) + 4 + pulse * 2;
      ctx.save();
      ctx.fillStyle = '#1e1538';
      ctx.fillRect(x - 1, y - 1, w + 2, 1); ctx.fillRect(x - 1, y + h, w + 2, 1); ctx.fillRect(x - 1, y, 1, h); ctx.fillRect(x + w, y, 1, h);
      ctx.fillStyle = '#ff7a1a';
      if (this.active) { ctx.fillRect(x, y, w, 3); ctx.fillRect(x, y + h - 3, w, 3); ctx.fillRect(x, y + 3, 3, h - 6); ctx.fillRect(x + w - 3, y + 3, 3, h - 6); }
      else for (let i = 0; i < Math.max(w, h); i += 6) { if (i < w) { ctx.fillRect(x + i, y, 3, 3); ctx.fillRect(x + i, y + h - 3, 3, 3); } if (i < h) { ctx.fillRect(x, y + i, 3, 3); ctx.fillRect(x + w - 3, y + i, 3, 3); } }
      ctx.restore();
    }
    destroy() {
      this.offs.forEach(f => f()); this.offs = [];
      if (this.live) this.live.remove(); // canvas grids only
      if (this.el) for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) { const c = this.o.cellEl(x, y); if (c) c.classList.remove('agg-cursor', 'agg-cursor--idle'); }
    }
  }

  AG.grid = Object.assign(AG.grid || {}, { GridCursor });
})(window.AG);
