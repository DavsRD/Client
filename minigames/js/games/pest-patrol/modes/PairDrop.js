/* Pest Patrol Match — PEST → PREVENTION (level 2).
 *
 * The pests stand in a column; the prevention tiles wait in the tray. Drag each tile onto its
 * pest (AG.dnd: drag, or tap the tile then the pest). Keyboard: arrows move (↑/↓ in a column,
 * ← pests, → tray), Enter picks a tile and jumps to the pests, arrows move, Enter places,
 * Esc puts it back. A wrong drop bounces back with a hint about that pest. Stars: 0–1
 * misplacements = 3, 2–3 = 2, more = 1. Advanced hides the tray labels until a tile is placed.
 * Three tiles are golden. */
window.AG = window.AG || {};
(function (AG) {
  const { h } = AG.util;
  const PP = AG.pestPatrol, T = PP.tuning, R = PP.rules;
  const S = (en, fil) => ({ en, fil });

  const STR = {
    label: S('Stopped', 'Napigil'),
    prompt: S('Drag each way to stop a pest onto that pest.', 'I-drag ang bawat paraan ng pagpigil sa peste nito.'),
    pests: S('Pests', 'Peste'),
    tray: S('Ways to stop them', 'Paraan ng pagpigil'),
    picked: S('Now choose the pest it stops, then press Enter. Esc puts it back.', 'Piliin ang pesteng napipigil nito, saka pindutin ang Enter. Esc para ibalik.'),
    start: S('Match each pest with the way to stop it!', 'Itugma ang bawat peste sa paraan ng pagpigil dito!'),
    misplaced: S('Misplaced', 'Maling lagay'),
    tile: S('Prevention tile {n}', 'Tile ng pagpigil {n}'),
    win: S('Every pest has its stop sign!', 'May pangontra na ang bawat peste!'),
    winTight: S('Every pest stopped, and almost no mistakes!', 'Napigil ang bawat peste, halos walang mali!')
  };

  class PairDrop {
    constructor(scene, data) {
      this.s = scene; this.data = data;
      const ctx = scene.ctx;
      this.lv = (ctx.levelData && ctx.levelData[ctx.difficulty]) || { sets: 3 };
      this.misplaced = 0; this.placed = 0;
      this.zone = 'tray'; this.picked = null;
    }

    start() {
      const s = this.s, ctx = s.ctx;
      const chosen = R.pick(this.data.sets.map(x => x.id), this.lv.sets, s.rnd);
      const gold = R.golden(chosen.length, s.rnd).map(i => chosen[i]);
      this.total = chosen.length;
      this.pests = PP.shuffle(chosen, s.rnd).map(set => {
        const el = h('button', { type: 'button', class: 'pp-pest', 'data-dnd-target': '', 'data-set': set }, h('span', { class: 'pp-pest__face' }), h('span', { class: 'pp-slot', 'aria-hidden': 'true' }, '?'));
        return { set, el, done: false };
      });
      this.tiles = PP.shuffle(chosen, s.rnd).map(set => {
        const el = h('button', { type: 'button', class: 'pp-tile' + (gold.includes(set) ? ' pp-gold' : ''), 'data-dnd-item': '', 'data-set': set });
        return { set, el, done: false, golden: gold.indexOf(set) };
      });
      this.pestCol = h('div', { class: 'pp-col', role: 'group' }, ...this.pests.map(p => p.el));
      this.trayCol = h('div', { class: 'pp-col', role: 'group' }, ...this.tiles.map(t => t.el));
      this.headP = h('h4'); this.headT = h('h4');
      this.wrap = h('div', { class: 'pp-drop' }, h('div', {}, this.headP, this.pestCol), h('div', {}, this.headT, this.trayCol));
      s.board.append(this.wrap);
      this.render();

      this.dnd = AG.dnd({
        root: this.wrap,
        items: () => this.tiles.filter(t => !t.done).map(t => t.el),
        targets: () => this.pests.filter(p => !p.done).map(p => p.el),
        ghostSrc: el => { const img = el.querySelector('img'); return img && img.src; },
        onSelect: el => this.onPick(el),
        onDrop: (it, t) => this.drop(it, t)
      });
      // keyboard: arrows move between and within the columns; Esc returns a picked tile
      const offs = [['UP', 0, -1], ['DOWN', 0, 1], ['LEFT', -1, 0], ['RIGHT', 1, 0]].map(([a, dx, dy]) => AG.input.on(a, e => { if (e.phase !== 'up') this.move(dx, dy); }));
      offs.push(AG.input.on('CANCEL', () => this.cancel()));
      ['UP', 'DOWN'].forEach(a => AG.input.repeat(a, { delay: 260, interval: 120 }));
      this.offs = offs;
      this.wrap.addEventListener('focusin', this.onFocus = e => this.track(e.target));

      s.setPrompt(STR.prompt);
      s.setLabel(STR.label, '0/' + this.total);
      s.doHint = () => this.hint();
      s.onRelabel = () => this.render();
      ctx.say('instruction', STR.start);
      this.focusList('tray', 0);
    }

    /** Faces and labels (again after a language switch). */
    render() {
      const s = this.s;
      this.headP.textContent = AG.pick(STR.pests); this.headT.textContent = AG.pick(STR.tray);
      this.pestCol.setAttribute('aria-label', AG.pick(STR.pests)); this.trayCol.setAttribute('aria-label', AG.pick(STR.tray));
      this.pests.forEach(p => {
        p.el.firstChild.replaceChildren(AG.cards.face(s.face(p.set, 'pest', true)));
        p.el.lastChild.replaceChildren(p.done ? AG.cards.face(s.face(p.set, 'prevent', false)) : '?');
        p.el.setAttribute('aria-label', AG.pick(s.labelOf(p.set, 'pest')) + (p.done ? ': ' + AG.pick(s.labelOf(p.set, 'prevent')) + ' ✔' : ''));
      });
      this.tiles.forEach(t => {
        const lab = !s.adv;
        t.el.replaceChildren(AG.cards.face(s.face(t.set, 'prevent', lab)));
        // Advanced hides the printed label; screen readers still get a neutral name
        t.el.setAttribute('aria-label', lab ? AG.pick(s.labelOf(t.set, 'prevent')) : AG.pick(STR.tile).replace('{n}', this.tiles.indexOf(t) + 1));
      });
    }

    /* ---------- keyboard ---------- */
    list(zone) { return (zone === 'tray' ? this.tiles : this.pests).filter(x => !x.done); }
    focusList(zone, i) {
      const l = this.list(zone);
      if (!l.length) return;
      this.zone = zone; this.index = AG.util.clamp(i, 0, l.length - 1);
      l[this.index].el.focus({ preventScroll: true });
      this.mark();
    }
    track(el) {
      for (const zone of ['tray', 'pests']) {
        const i = this.list(zone).findIndex(x => x.el === el);
        if (i >= 0) { this.zone = zone; this.index = i; this.mark(); }
      }
    }
    /** ▶ on the pest the picked tile would go to. */
    mark() { this.pests.forEach(p => p.el.classList.toggle('is-target', !!this.picked && this.zone === 'pests' && document.activeElement === p.el)); }
    owns() { const ae = document.activeElement; return this.wrap.isConnected && (this.wrap.contains(ae) || ae === this.s.stage); }
    move(dx, dy) {
      if (this.s.ended || !this.owns()) return;
      if (!this.wrap.contains(document.activeElement)) { this.focusList(this.zone, this.index || 0); return; }
      if (dx) this.focusList(dx < 0 ? 'pests' : 'tray', this.index);
      else this.focusList(this.zone, this.index + dy);
    }
    onPick(el) {
      const t = el && this.tiles.find(x => x.el === el);
      this.picked = t || null;
      AG.input.armCancel(!!t);
      if (t) {
        this.s.setBase('think');
        if (AG.input.lastDevice === 'keyboard') { this.focusList('pests', 0); this.s.setPrompt(STR.picked); }
      } else { this.s.setBase('idle'); this.s.setPrompt(STR.prompt); }
      this.mark();
    }
    cancel() {
      const t = this.picked;
      if (!t) return;
      this.dnd.clear();
      t.el.focus({ preventScroll: true });
    }

    /* ---------- placing ---------- */
    drop(itemEl, targetEl) {
      const s = this.s, t = this.tiles.find(x => x.el === itemEl), p = this.pests.find(x => x.el === targetEl);
      if (!t || !p || t.done || p.done || s.ended) return;
      const wasKeys = AG.input.lastDevice === 'keyboard';
      if (t.set !== p.set) {
        this.misplaced++;
        AG.kit.shake(t.el);
        s.wrong(this.data.sets.find(x => x.id === p.set).hint);
        if (wasKeys) t.el.focus({ preventScroll: true });
        return;
      }
      t.done = true; p.done = true; this.placed++;
      t.el.classList.add('done'); p.el.classList.add('is-done');
      this.render();
      s.matched({ set: t.set, golden: t.golden });
      s.setLabel(STR.label, this.placed + '/' + this.total);
      if (this.placed === this.total) { s.ctx.after(700, () => this.finish()); return; }
      if (wasKeys) this.focusList('tray', 0);
    }

    hint() {
      const t = this.picked || this.tiles.find(x => !x.done);
      if (!t) return false;
      const p = this.pests.find(x => x.set === t.set);
      [t.el, p.el].forEach(el => { el.classList.add('is-hint'); setTimeout(() => el.classList.remove('is-hint'), T.hintMs); });
      return true;
    }

    finish() {
      const s = this.s, stars = R.dropStars(this.misplaced);
      s.attempts = this.placed + this.misplaced;
      s.finish({
        passed: true, stars,
        detail: [{ label: STR.misplaced, value: this.misplaced }, { label: STR.label, value: this.placed + '/' + this.total }],
        message: stars === 3 ? STR.winTight : STR.win,
        learned: [...s.facted].map(id => (s.sets.get(id) || {}).fact).filter(Boolean)
      });
    }
    destroy() {
      if (this.dnd) this.dnd.destroy();
      if (this.offs) this.offs.forEach(f => f());
      AG.input.armCancel(false);
    }
  }

  PP.PairDrop = PairDrop;
})(window.AG);
