/* 04 Slope Defense: the BUILD phase (untimed). A BuildSlots menu from the E7 engine sits on every build and canal spot; this file drives it
 * (the engine's own key binding is off because Space must START RAIN) and charges the model: arrows move between spots, Enter opens the menu,
 * 1–4 or ←/→ + Enter choose, Backspace removes (full refund), tap a spot → tap a defense. It also draws the empty spots and the reach of
 * a tree or grass. Hidden paw prints can be tapped here too. Model: Slope.js. Scene: SlopeDefenseScene.js. */
window.AG = window.AG || {};
(function (AG) {
  const SD = AG.slopeDefense, T = SD.tuning, S = en => ({ en }), pick = v => AG.pick(v);
  const D = () => AG.sim.draw;

  class BuildPhase {
    constructor(scene) { this.sc = scene; this.offs = []; this.slots = null; this.focus = 0; }

    enter() {
      const sc = this.sc, sim = sc.sim;
      this.slots = new AG.sim.BuildSlots({
        view: sc.view, stage: sc.box, input: false, hitPad: 6, title: S('Build here'), removeLabel: S('Remove (coins back)'),
        slots: sim.allSlots.map(s => ({ id: s.id, x: s.x, y: s.y, w: 30, h: 30, label: s.canal ? S('Canal spot') : S('Build spot'), built: sim.built.has(s.id) ? sim.built.get(s.id).op : null, canal: !!s.canal })),
        options: sim.options.map(op => ({ id: op.id, label: op.label, cost: op.cost, costLabel: op.costLabel, art: op.art })),
        can: (slot, op) => sim.canBuild(slot.id, op.id)
      });
      const sl = this.slots;
      sl.on('build', e => this.onBuild(e));
      sl.on('remove', e => this.onRemove(e));
      sl.on('deny', e => { if (e.reason && e.reason.en) sc.toast(e.reason, 2.6); sc.rig.play('alert'); sc.ctx.after(700, () => { if (sc.phase === 'build') sc.rig.play('idle'); }); });
      sl.on('open', () => { this.focus = Math.max(0, this.rows().findIndex(r => !r.classList.contains('is-no'))); this.applyFocus(); });
      const on = (a, f) => this.offs.push(AG.input.on(a, e => { if (e.phase === 'down' && sc.phase === 'build' && !sc.finished) f(e); }));
      [['LEFT', 'left'], ['RIGHT', 'right'], ['UP', 'up'], ['DOWN', 'down']].forEach(([a, d]) => on(a, () => this.nav(d)));
      on('CONFIRM', e => { if (e.event && e.event.code === 'Space') sc.startRain(); else if (sl.isOpen) sl.pick(this.focus + 1); else sl.open(); });
      for (let n = 1; n <= 4; n++) on('CHOICE_' + n, () => { if (sl.isOpen) sl.pick(n); });
      on('UNDO', () => sl.remove());
      on('CANCEL', () => sl.close());
      this.offs.push(AG.input.onPointer('tap', p => {
        if (sc.phase !== 'build' || sc.finished) return;
        const i = sl.hit(p.x, p.y);
        if (i >= 0) { if (i === sl.sel && sl.isOpen) sl.close(); else sl.open(i); return; }
        if (sl.isOpen) { sl.close(); return; }
        sc.takePet(sc.petAt(p.x, p.y));
      }));
      AG.input.pointerMode('tap');
    }
    exit() {
      this.offs.forEach(f => f()); this.offs = [];
      if (this.slots) { this.slots.destroy(); this.slots = null; }
    }
    rows() { return this.slots && this.slots.menu ? [...this.slots.menu.querySelectorAll('.ag-simmenu__opt:not(.is-remove):not(.ag-simmenu__close)')] : []; }
    applyFocus() { this.rows().forEach((r, i) => r.classList.toggle('is-focus', i === this.focus)); }
    nav(dir) {
      const sl = this.slots;
      if (sl.isOpen) {
        const n = this.rows().length;
        if (n) { this.focus = (this.focus + (dir === 'left' || dir === 'up' ? -1 : 1) + n) % n; this.applyFocus(); }
      } else sl.move(dir);
    }

    onBuild({ slot, option, replaced }) {
      const sc = this.sc, sim = sc.sim, r = sim.build(slot.id, option.id);
      if (r !== true) { slot.built = replaced ? replaced.id : null; if (r && r.en) sc.toast(r, 2.4); return; }
      AG.sfx.play(T.sfx[0]);
      sc.pop('−' + option.cost, slot.x, slot.y - 18, false);
      sc.rig.play('happy'); sc.ctx.after(600, () => { if (sc.phase === 'build') sc.rig.play('idle'); });
      sc.refreshHud();
    }
    onRemove({ slot, option }) {
      const sc = this.sc;
      sc.sim.remove(slot.id);
      AG.sfx.play('tap');
      sc.pop('+' + option.cost, slot.x, slot.y - 18, true);
      sc.refreshHud();
    }

    update() { /* nothing runs while you build */ }

    draw(c, t) {
      const sl = this.slots, sc = this.sc, keys = AG.input.lastDevice === 'keyboard';
      if (!sl) return;
      const sel = sl.selected, op = sl.isOpen ? sl.options[this.focus] : null;
      // the reach of a tree (45 px) or grass (30 px) on the selected spot
      if (sel && (sl.isOpen || keys)) {
        const have = sc.sim.built.get(sel.id), kind = op ? op.id : have ? have.op : null;
        if (kind === 'tree' || kind === 'vetiver') SD.dots(c, sel.x, sel.y, kind === 'tree' ? T.tree.r : T.vetiver.r, 'rgba(126,224,138,.95)');
      }
      sl.slots.forEach((s, i) => {
        const x = Math.round(s.x - 15), y = Math.round(s.y - 15);
        if (!s.built) {
          const col = s.canal ? '#8fd8ff' : '#fff8e6', w = 26, q = Math.round(s.x - 13), r = Math.round(s.y - 13);
          D().line(c, q, r, q + w - 1, r, { color: col, dash: [2, 2] }); D().line(c, q, r + w - 1, q + w - 1, r + w - 1, { color: col, dash: [2, 2] });
          D().line(c, q, r, q, r + w - 1, { color: col, dash: [2, 2] }); D().line(c, q + w - 1, r, q + w - 1, r + w - 1, { color: col, dash: [2, 2] });
          c.fillStyle = '#1e1538'; c.fillRect(Math.round(s.x) - 3, Math.round(s.y) - 1, 7, 3); c.fillRect(Math.round(s.x) - 1, Math.round(s.y) - 3, 3, 7);
          c.fillStyle = col; c.fillRect(Math.round(s.x) - 2, Math.round(s.y), 5, 1); c.fillRect(Math.round(s.x), Math.round(s.y) - 2, 1, 5);
        }
        if (i === sl.sel && (keys || sl.isOpen)) D().brackets(c, x, y, 30, 30);
      });
    }
  }

  SD.BuildPhase = BuildPhase;
})(window.AG);
