/* E5 PIECES ENGINE — PiecePlay: the one way to move pieces, on a GridBoard or a SlotBoard.
 *   Touch / mouse: drag a piece (AG.dnd); or tap it (held), tap where it goes; tap the held piece or ↻ to turn it
 *   (on a GridBoard a tap on the ghost places it when it fits ✔ and turns it when it's blocked ✖).
 *   Keyboard: Tab cycles tray ↔ board ↔ buttons (FocusZones); in the tray ←/→ cycle and Enter picks; then the
 *   arrows move it cell to cell (or slot to slot), R turns it, Enter places it, Esc puts it back. Backspace undoes.
 *
 *   const play = new AG.pieces.PiecePlay({ board, tray, undo, lockPlaced, sfx: { pick, place, rotate, invalid, back },
 *        targets: [{ el, accept(piece), onDrop(piece) }], buttons: [{ label, glyph, onClick }],
 *        onPick, onPlace(piece, at, info), onReturn(piece), onBlocked(piece, why, info), onRotate, onChange, onUndo })
 *   stage.append(play.el); play.focus()   play.held  play.zone  play.pick(piece)  play.place()  play.cancel()  play.rotate()  play.undo()
 *   play.enabled = false (locks every input)   play.cancelDrag() (on pause)   play.destroy() */
window.AG = window.AG || {};
(function (AG) {
  const { h } = AG.util;
  const P = AG.pieces;
  const DIRS = { UP: 'up', DOWN: 'down', LEFT: 'left', RIGHT: 'right' };
  const DV = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
  const SFX = { pick: 'tap', place: 'good', rotate: 'tap', invalid: 'soft', back: 'tap' };

  class PiecePlay {
    constructor(o) {
      this.o = o = o || {};
      this.board = o.board; this.tray = o.tray;
      this.grid = this.board.kind === 'grid';
      this.lockPlaced = o.lockPlaced != null ? o.lockPlaced : !this.grid;
      this.sounds = Object.assign({}, SFX, o.sfx);
      this.undoStack = o.undo === false ? null : o.undo instanceof AG.logic.UndoStack ? o.undo : (o.undo || this.grid ? new AG.logic.UndoStack({ limit: 200 }) : null);
      this.targets = o.targets || [];
      this.held = null; this.enabled = true;
      this.cur = this.grid ? { x: 0, y: 0 } : 0;
      this.offs = [];

      /* ---------- the layout: board, tray, buttons (games may move these with CSS) ---------- */
      this.btn = {};
      const mk = (id, glyph, label, fn) => { const b = h('button', { type: 'button', class: 'ag-btn ag-btn--alt agp-btn', 'data-id': id }, h('span', { class: 'agp-btn__glyph', 'aria-hidden': 'true' }, glyph), h('span', {}, label)); this.offs.push(P.onPress(b, () => { if (this.enabled) fn(); })); this.btn[id] = b; return b; };
      this.buttonsEl = h('div', { class: 'agp-buttons', role: 'toolbar', 'aria-label': AG.t('pieces.buttons') },
        mk('rotate', '↻', AG.t('pieces.rotate'), () => this.rotate()),
        mk('back', '✕', AG.t('pieces.putBack'), () => this.cancel()),
        this.undoStack ? mk('undo', '↶', AG.t('pieces.undo'), () => this.undo()) : null,
        ...(o.buttons || []).map((b, i) => mk(b.id || 'extra' + i, b.glyph || '', AG.pick(b.label), () => b.onClick(this.held && this.held.piece, this))));
      this.live = h('div', { class: 'agp-sr', 'aria-live': 'polite' });
      this.limbo = h('div', { hidden: true });
      this.boardWrap = h('div', { class: 'agp-play__board' }, this.board.el);
      this.el = h('div', { class: 'agp-play' }, this.boardWrap, this.tray.el, this.buttonsEl, this.live, this.limbo);
      this.syncButtons();

      /* ---------- whole-multiple scale that fits the width ---------- */
      const fit = () => { const w = this.boardWrap.clientWidth; if (!w) return; const s = this.board.fit(w); if (this.tray.scale !== s && o.trayScale == null) { this.tray.scale = s; this.tray.layout(); } };
      this.ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(fit) : null;
      if (this.ro) this.ro.observe(this.boardWrap); else { window.addEventListener('resize', fit); this.offs.push(() => window.removeEventListener('resize', fit)); }
      if (o.trayScale) { this.tray.scale = o.trayScale; this.tray.layout(); }

      /* ---------- pointer: AG.dnd does drag vs tap ---------- */
      this.dnd = AG.dnd({
        root: this.el, keys: false,
        items: () => [...this.tray.pieces, ...this.board.pieces].map(p => p.el),
        targets: () => [this.board.el, this.tray.el, ...this.targets.map(t => t.el)],
        onTap: (el, info) => { this.tapPiece(el._agPiece, info); return true; },
        // touch on the tray: a clearly sideways swipe (under ~27°) scrolls the shelf, any other way picks the piece up
        // (CSS gives pieces touch-action: none, so the browser never takes a diagonal drag for a scroll)
        canDrag: (el, i) => {
          const sh = this.tray.shelf;
          if (i.pointerType === 'mouse' || !this.tray.has(el._agPiece) || sh.scrollWidth <= sh.clientWidth || Math.abs(i.dx) <= 2 * Math.abs(i.dy)) return true;
          this.shelfScroll(i); return false;
        },
        onDragStart: (el, info) => this.dragStart(el._agPiece, info),
        onDragMove: (el, info) => this.dragMove(info),
        onDrop: (el, t, info) => (info.via === 'drag' ? this.dragDrop(t, info) : this.tapTarget(t, info)),
        onMiss: (el, info) => this.dragDrop(null, info)
      });

      /* ---------- keyboard: actions only, never raw keys ---------- */
      this.zones = new AG.input.FocusZones([
        { el: this.tray.el, name: 'tray', onEnter: () => this.enterZone('tray') },
        { el: this.board.el, name: 'board', onEnter: () => this.enterZone('board') },
        { el: this.buttonsEl, name: 'buttons', onEnter: () => this.enterZone('buttons') }
      ]);
      [['tray', this.tray.el], ['board', this.board.el], ['buttons', this.buttonsEl]].forEach(([name, el]) => {
        const f = () => { if (this.zone !== name) this.setZone(name, true); };
        el.addEventListener('pointerdown', f); this.offs.push(() => el.removeEventListener('pointerdown', f));
      });
      Object.keys(DIRS).forEach(a => { AG.input.repeat(a, { delay: 260, interval: 120 }); this.offs.push(AG.input.on(a, e => { if (e.phase !== 'up') this.arrow(DIRS[a]); })); });
      this.offs.push(AG.input.on('CONFIRM', e => { if (e.phase === 'down' && e.device === 'keyboard') this.confirm(); }));
      this.offs.push(AG.input.on('ROTATE', e => { if (e.phase === 'down') this.rotate(); }));
      this.offs.push(AG.input.on('CANCEL', e => { if (e.phase === 'down') this.cancel(); }));
      if (this.undoStack) this.offs.push(AG.input.on('UNDO', e => { if (e.phase === 'down') this.undo(); }));
      AG.input.armCancel(false);
    }

    get zone() { return this.zones.current.name; }
    sfx(k) { P.sfx(this.sounds[k]); }
    say(text) { this.live.textContent = ''; this.live.textContent = text; }
    setZone(name, quiet) { this.quiet = !!quiet; this.zones.set(name); this.quiet = false; }
    /** After stage.append(play.el): keyboard focus into the current zone (the tray at first). */
    focus() { this.enterZone(this.zone); }
    enterZone(name) {
      if (name !== 'board' && !this.held) this.board.cursor(null);
      if (this.quiet) return;
      if (name === 'tray') this.tray.focus();
      else if (name === 'board') { this.board.el.focus({ preventScroll: true }); if (this.held) this.showGhost(); else this.showCursor(); }
      else { const b = this.buttonsEl.querySelector('button:not([aria-disabled="true"])') || this.buttonsEl.querySelector('button'); if (b) b.focus({ preventScroll: true }); }
    }
    syncButtons() {
      const set = (b, on) => { if (b) { b.setAttribute('aria-disabled', String(!on)); b.classList.toggle('is-off', !on); } };
      set(this.btn.rotate, !!this.held && this.held.piece.rotatable);
      set(this.btn.back, !!this.held);
      set(this.btn.undo, !!(this.undoStack && this.undoStack.canUndo));
    }

    /* ---------- where a piece is, and putting it anywhere (moves and undo use the same) ---------- */
    locate(p) { return this.tray.has(p) ? { kind: 'tray', rot: p.rot } : p.state === 'placed' ? { kind: 'board', at: this.grid ? Object.assign({}, p.at) : p.at, rot: p.rot } : { kind: 'gone', rot: p.rot }; }
    apply(p, loc) {
      if (p.state === 'placed') this.board.remove(p);
      p.el.classList.remove('is-lifted');
      if (p.rot !== loc.rot) p.setRot(loc.rot);
      if (loc.kind === 'tray') this.tray.add(p);
      else {
        this.tray.remove(p);
        if (loc.kind === 'board') this.grid ? this.board.place(p, loc.at.x, loc.at.y) : this.board.place(p, loc.at, true);
        else this.limbo.append(p.el); // gone (a bin): hidden until an undo, but never detached mid-touch (see GridBoard.remove)
      }
    }
    commit(p, from, to) {
      if (this.undoStack && (from.kind !== to.kind || from.kind === 'board')) this.undoStack.push({ piece: p, from, to, undo: () => this.apply(p, from), redo: () => this.apply(p, to) });
      this.syncButtons();
      if (this.o.onChange) this.o.onChange(this);
    }

    /* ---------- hold, turn, place, put back ---------- */
    pick(p, via) {
      if (!this.enabled || !p) return;
      if (this.held && this.held.piece === p) return this.rotate();
      if (p.state === 'placed' && this.lockPlaced) return;
      if (this.held) this.cancel(true);
      const from = this.locate(p);
      if (from.kind === 'board') { this.board.remove(p, true); p.el.classList.add('is-lifted'); this.cur = this.grid ? Object.assign({}, from.at) : from.at; }
      else if (this.grid) this.cur = this.board.clamp(p, this.cur.x, this.cur.y);
      else if (this.board.pieceAt(this.cur)) { const free = this.board.slots.findIndex((s, i) => !this.board.pieceAt(i)); if (free >= 0) this.cur = free; }
      this.held = { piece: p, from };
      p.setState('held');
      if (this.tray.has(p)) { this.tray.index = this.tray.indexOf(p); this.tray.roving(); }
      this.dnd.select(p.el);
      AG.input.armCancel(true);
      this.sfx('pick');
      this.say(AG.t(via === 'key' ? 'pieces.holdKeys' : 'pieces.holdTouch', { name: p.label }));
      if (via === 'key') this.setZone('board'); else this.board.cursor(null);
      this.showGhost();
      this.syncButtons();
      if (this.o.onPick) this.o.onPick(p, from);
    }
    release() {
      const p = this.held && this.held.piece;
      this.held = null; this.dnd.clear(); AG.input.armCancel(false);
      this.board.hideGhost();
      if (p && p.state === 'held') p.setState(this.tray.has(p) ? 'tray' : p.state);
      this.syncButtons();
      if (this.zone === 'board') this.showCursor();
    }
    rotate() {
      if (!this.enabled) return;
      const p = this.held ? this.held.piece : this.zone === 'tray' ? this.tray.current : null;
      if (!p || !p.rotatable) return;
      p.rotate(1);
      this.sfx('rotate');
      if (this.drag) this.dragTurned();
      else if (this.held) { if (this.grid) this.cur = this.board.clamp(p, this.cur.x, this.cur.y); this.showGhost(); }
      this.say(AG.t('pieces.turnedBy', { name: p.label, deg: String(p.rot * 90) }));
      if (this.o.onRotate) this.o.onRotate(p);
    }
    showGhost() {
      if (!this.held) return;
      const p = this.held.piece;
      if (this.grid) return this.board.ghost(p, this.cur.x, this.cur.y);
      this.board.ghost(p, this.cur);
    }
    showCursor() { if (!this.held && this.zone === 'board') { this.grid ? this.board.cursor(this.cur.x, this.cur.y) : this.board.cursor(this.cur); } }
    /** Places the held piece at the cursor (keyboard), or at `at` (a tap or a drop). */
    place(at, info) {
      if (!this.held || !this.enabled) return false;
      const p = this.held.piece, from = this.held.from, via = (info && info.via) || 'key';
      at = at != null ? at : this.cur;
      if (this.grid) {
        const res = this.board.canPlace(p, at.x, at.y);
        if (!res.ok) {
          this.sfx('invalid'); this.say(AG.t('pieces.blocked'));
          if (this.o.onBlocked) this.o.onBlocked(p, res, info || { via });
          if (via === 'drag') this.returnTo(p, from, info); // a drop that doesn't fit flies back
          else { this.cur = at; this.showGhost(); } // keys and taps keep holding it, the ✖ ghost shows why
          return false;
        }
      } else {
        const why = this.board.pieceAt(at) ? 'slot' : this.board.check(p, at);
        if (why !== 'ok') {
          this.sfx('invalid'); this.say(AG.t(why === 'turn' ? 'pieces.wrongTurn' : 'pieces.wrongSpot'));
          if (this.o.onBlocked) this.o.onBlocked(p, why, info || { via });
          this.returnTo(p, { kind: 'tray', rot: p.rot }, info);
          if (via === 'key') this.setZone('tray');
          return false;
        }
      }
      this.release();
      this.tray.remove(p);
      p.el.classList.remove('is-lifted');
      this.grid ? this.board.place(p, at.x, at.y) : this.board.place(p, at);
      this.sfx('place'); this.say(AG.t('pieces.placed', { name: p.label }));
      this.commit(p, from, this.locate(p));
      if (this.o.onPlace) this.o.onPlace(p, at, info || { via });
      // keyboard: straight back to the tray for the next piece
      if (via === 'key' && this.tray.pieces.length) this.setZone('tray'); else this.showCursor();
      return true;
    }
    /** Esc / ✕: the held piece goes back where it came from (to the tray it keeps its turn; to the board, its old one). */
    cancel(silent) {
      if (!this.held) return;
      const { piece, from } = this.held;
      this.returnTo(piece, from.kind === 'tray' ? { kind: 'tray', rot: piece.rot } : from);
      if (!silent && AG.input.lastDevice === 'keyboard' && from.kind === 'tray') this.setZone('tray');
    }
    returnTo(p, loc, info) {
      const fromEl = this.drag && this.drag.float;
      const was = this.held && this.held.from;
      this.release();
      this.apply(p, loc);
      if (p.state === 'held') p.setState('tray');
      if (fromEl) this.bounce(fromEl, p.el); else if (this.drag) this.drag.float = null;
      this.sfx('back');
      if (loc.kind === 'tray') this.say(AG.t('pieces.back', { name: p.label }));
      if (was && (was.kind !== loc.kind || loc.kind === 'board' && JSON.stringify(was.at) !== JSON.stringify(loc.at))) this.commit(p, was, this.locate(p));
      if (this.o.onReturn) this.o.onReturn(p, info || {});
    }
    undo() {
      if (!this.undoStack || !this.enabled) return;
      if (this.held) this.cancel(true);
      const e = this.undoStack.undo();
      this.syncButtons();
      if (!e) return;
      this.say(AG.t('pieces.undone'));
      this.sfx('back');
      if (this.o.onUndo) this.o.onUndo(e);
      if (this.o.onChange) this.o.onChange(this);
    }

    /* ---------- keyboard ---------- */
    arrow(dir) {
      if (!this.enabled) return;
      const z = this.zone;
      if (z === 'tray') { if (dir === 'left' || dir === 'right') { if (this.tray.move(dir === 'left' ? -1 : 1)) AG.sfx.play('tap'); } return; }
      if (z === 'buttons') {
        if (dir !== 'left' && dir !== 'right') return;
        const bs = [...this.buttonsEl.querySelectorAll('button')], i = bs.indexOf(document.activeElement);
        const j = AG.util.clamp((i < 0 ? 0 : i) + (dir === 'left' ? -1 : 1), 0, bs.length - 1);
        bs[j].focus({ preventScroll: true }); return;
      }
      if (this.grid) {
        const n = { x: this.cur.x + DV[dir][0], y: this.cur.y + DV[dir][1] };
        const c = this.held ? this.board.clamp(this.held.piece, n.x, n.y) : { x: AG.util.clamp(n.x, 0, this.board.w - 1), y: AG.util.clamp(n.y, 0, this.board.h - 1) };
        if (c.x === this.cur.x && c.y === this.cur.y) return;
        this.cur = c;
      } else {
        const j = this.board.step(this.cur, dir);
        if (j < 0) return;
        this.cur = j;
      }
      AG.sfx.play('tap');
      if (this.held) {
        const res = this.showGhost();
        const where = this.grid ? this.board.describe(this.cur.x, this.cur.y) : this.board.describe(this.cur);
        this.say(where + (res ? '. ' + AG.t(res.ok ? 'pieces.fits' : 'pieces.blocked') : ''));
      } else { this.showCursor(); this.say(this.grid ? this.board.describe(this.cur.x, this.cur.y) : this.board.describe(this.cur)); }
    }
    confirm() {
      if (!this.enabled) return;
      const z = this.zone;
      if (z === 'tray') { const p = this.tray.current; if (p) this.pick(p, 'key'); }
      else if (z === 'board') {
        if (this.held) this.place(null, { via: 'key' });
        else if (this.grid) { const p = this.board.pieceAt(this.cur.x, this.cur.y); if (p) this.pick(p, 'key'); }
      }
      // buttons: a focused <button> clicks by itself
    }

    /* ---------- touch and mouse ---------- */
    tapPiece(p, info) {
      if (!this.enabled || AG.paused || !p) return;
      if (this.held && this.held.piece === p) return this.rotate();
      if (this.held && p.state === 'placed') return this.tapTarget(this.board.el, info); // a placed piece under the tap: the board spot
      this.pick(p, 'tap');
    }
    tapTarget(t, info) {
      if (!this.held || !this.enabled || AG.paused) return;
      const p = this.held.piece, ex = this.targets.find(x => x.el === t);
      if (ex) return this.toTarget(p, ex, info);
      if (t === this.tray.el) return this.returnTo(p, { kind: 'tray', rot: p.rot }, info);
      if (t !== this.board.el) return;
      if (this.grid) {
        const c = this.board.cellAt(info.x, info.y);
        if (!c) return this.dnd.select(p.el);
        // a tap on the ghost places it if it fits (✔) and turns it if not (✖); anywhere else tries it there, centred on the tap
        const onGhost = this.board._ghost && this.board.canPlace(p, this.cur.x, this.cur.y);
        if (onGhost && onGhost.cells.some(q => q.x === c.x && q.y === c.y)) {
          if (onGhost.ok) return this.place(this.cur, info);
          this.dnd.select(p.el); return this.rotate();
        }
        const at = this.board.centreOn(p, c.x, c.y);
        if (!this.place(at, info)) this.dnd.select(p.el);
      } else {
        const s = this.board.slotAt(info.x, info.y);
        if (s < 0) return this.dnd.select(p.el);
        this.cur = s;
        this.place(s, info);
      }
    }
    toTarget(p, t, info) {
      if (t.accept && !t.accept(p)) { this.sfx('invalid'); return this.returnTo(p, this.held ? this.held.from : this.locate(p), info); }
      const from = this.held ? this.held.from : this.locate(p);
      if (this.drag && this.drag.float) { this.drag.float.remove(); this.drag.float = null; }
      this.release();
      this.apply(p, { kind: 'gone', rot: p.rot });
      p.setState('gone');
      this.commit(p, from, { kind: 'gone', rot: p.rot });
      if (t.onDrop) t.onDrop(p, info);
    }
    dragStart(p, info) {
      if (!this.enabled || AG.paused || !p) return;
      if (this.held && this.held.piece !== p) this.cancel(true);
      const r = p.el.getBoundingClientRect(), s = this.board.scale, sz = p.size;
      const grab = { x: AG.util.clamp((info.startX - r.left) / r.width, 0, 1) * sz.w * s, y: AG.util.clamp((info.startY - r.top) / r.height, 0, 1) * sz.h * s };
      if (!this.held) this.pick(p, 'drag');
      if (!this.held) return; // a locked piece
      const float = p.copy(s, 'agp-float');
      (this.el.closest('#ag-app') || document.body).append(float);
      this.drag = { piece: p, grab, float };
      p.el.classList.add('is-lifted');
      this.dragMove(info);
    }
    dragTurned() { const d = this.drag, s = this.board.scale, sz = d.piece.size; d.float.replaceWith(d.float = d.piece.copy(s, 'agp-float')); d.grab = { x: sz.w * s / 2, y: sz.h * s / 2 }; this.dragMove(this.lastPtr || { x: 0, y: 0 }); }
    dragMove(info) {
      const d = this.drag; if (!d || !d.float) return;
      this.lastPtr = { x: info.x, y: info.y };
      d.float.style.left = Math.round(info.x - d.grab.x) + 'px'; d.float.style.top = Math.round(info.y - d.grab.y) + 'px';
      const r = this.board.el.getBoundingClientRect(), over = info.x >= r.left && info.x <= r.right && info.y >= r.top && info.y <= r.bottom;
      if (!over) { this.board.hideGhost(); return; }
      if (this.grid) { this.cur = this.board.originFor(d.piece, info.x, info.y, d.grab); this.board.ghost(d.piece, this.cur.x, this.cur.y); }
      else { const sn = this.board.snapFor(d.piece, ...this.centreOf(info)); if (sn.slot >= 0) { this.cur = sn.slot; this.board.ghost(d.piece, sn.slot); } }
    }
    centreOf(info) { const d = this.drag, sz = d.piece.size, s = this.board.scale; return [info.x - d.grab.x + sz.w * s / 2, info.y - d.grab.y + sz.h * s / 2]; }
    dragDrop(t, info) {
      const d = this.drag; if (!d) return;
      const p = d.piece;
      // a piece lifted from the board stays faint where it was until it lands (place / apply clear it)
      if (!this.held) { p.el.classList.remove('is-lifted'); if (d.float) d.float.remove(); this.drag = null; return; }
      const ex = t && this.targets.find(x => x.el === t);
      if (ex) this.toTarget(p, ex, info);
      else if (t === this.board.el) {
        if (this.grid) { const o = this.board.originFor(p, info.x, info.y, d.grab); if (this.place(o, info)) d.float.remove(); }
        else {
          const sn = this.board.snapFor(p, ...this.centreOf(info));
          if (sn.ok) { this.place(sn.slot, info); d.float.remove(); }
          else { // let go off the mark: back to the tray
            this.sfx('invalid'); this.say(AG.t(sn.slot === p.home && p.rot ? 'pieces.wrongTurn' : 'pieces.wrongSpot'));
            if (this.o.onBlocked) this.o.onBlocked(p, sn.slot === p.home && p.rot ? 'turn' : 'slot', info);
            this.returnTo(p, { kind: 'tray', rot: p.rot }, info);
          }
        }
      } else if (t === this.tray.el) this.returnTo(p, { kind: 'tray', rot: p.rot }, info);
      else this.returnTo(p, this.held.from, info);
      if (this.drag && this.drag.float && this.drag.float.isConnected && !this.drag.bouncing) this.drag.float.remove();
      this.drag = null;
    }
    /** The shelf follows the finger until it lifts. */
    shelfScroll(i) {
      const shelf = this.tray.shelf, x0 = i.x - i.dx, s0 = shelf.scrollLeft;
      const mv = e => { if (e.pointerId === i.id) { e.preventDefault(); shelf.scrollLeft = s0 - (e.clientX - x0); } };
      const end = e => { if (e.pointerId !== i.id) return; window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', end); window.removeEventListener('pointercancel', end); };
      mv({ pointerId: i.id, clientX: i.x, preventDefault() {} });
      window.addEventListener('pointermove', mv, { passive: false }); window.addEventListener('pointerup', end); window.addEventListener('pointercancel', end);
    }
    /** The dragged copy flies back to where the piece now is (4 stepped frames; none with Reduce Motion). */
    bounce(float, toEl) {
      if (this.drag) this.drag.bouncing = true;
      const a = float.getBoundingClientRect(), b = toEl.isConnected ? toEl.getBoundingClientRect() : null;
      if (!b || AG.reducedMotion() || !float.animate) { float.remove(); return; }
      const anim = float.animate([{ transform: 'translate(0, 0)' }, { transform: 'translate(' + Math.round(b.left - a.left) + 'px, ' + Math.round(b.top - a.top) + 'px)' }], { duration: 180, easing: 'steps(4, end)', fill: 'forwards' });
      anim.onfinish = anim.oncancel = () => float.remove();
    }
    cancelDrag() { if (this.drag) { const d = this.drag; if (d.float) d.float.remove(); d.float = null; d.piece.el.classList.remove('is-lifted'); if (this.held) this.returnTo(d.piece, this.held.from); this.drag = null; } }

    destroy() {
      this.cancelDrag();
      this.offs.forEach(f => f()); this.offs = [];
      if (this.ro) this.ro.disconnect();
      this.dnd.destroy(); this.zones.destroy();
      AG.input.armCancel(false);
      this.el.remove();
    }
  }

  P.PiecePlay = PiecePlay;
})(window.AG);
