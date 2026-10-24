/* Pest Patrol Match — MEMORY FLIP (world 1).
 *
 * Identical pairs face down in a CardGrid. Flip two (arrows + Enter, or tap): the same picture
 * matches, a different one flips back after 800 ms. Easy: 4–6 very distinct pairs with labels;
 * Advanced: 8–10 pairs that always include the look-alikes (🦟 / 🪰, 🐀 / 🐁), labels only after
 * a match. Stars: attempts ≤ pairs × 1.3 = 3, ≤ × 1.8 = 2, complete = 1. Three pairs are golden
 * (⭐ in the corner once face up): matching one collects it.
 * TripleFlip (world 3) extends this class with sets of three. */
window.AG = window.AG || {};
(function (AG) {
  const PP = AG.pestPatrol, T = PP.tuning, R = PP.rules;
  const S = (en, fil) => ({ en, fil });

  const STR = {
    label: S('Pairs', 'Pares'),
    prompt: S('Flip two cards. Find the matching pairs!', 'Magbukas ng dalawang card. Hanapin ang magkapares!'),
    grid: S('Memory cards', 'Mga card'),
    start: S("Let's find every pair! Remember where each picture is.", 'Hanapin natin ang bawat pares! Tandaan kung nasaan ang bawat larawan.'),
    win: S('You matched every pair!', 'Natugma mo ang lahat ng pares!'),
    winTight: S('Every pair, with hardly any extra flips. Great memory!', 'Lahat ng pares, halos walang sobrang bukas. Ang galing ng memorya mo!')
  };

  class MemoryFlip {
    constructor(scene, data) {
      this.s = scene; this.data = data;
      const ctx = scene.ctx, lv = (ctx.levelData && ctx.levelData[ctx.difficulty]) || { pairs: 6, cols: 4 };
      this.lv = lv; this.setSize = 2; this.str = STR;
      this.busy = false;
    }

    /** Every memory face: each set's pest, cause and prevention, plus the look-alikes. */
    allFaces() {
      const out = [];
      this.data.sets.forEach(s => ['pest', 'cause', 'prevent'].forEach(role => out.push({ id: s.id + '.' + role, set: s.id, role })));
      this.data.lookalikes.forEach(l => out.push({ id: l.id, set: l.id, role: 'alike' }));
      return out;
    }
    /** [{ id, key, set, role, golden }] in deal order. */
    deck() {
      const s = this.s, faces = this.allFaces(), byId = new Map(faces.map(f => [f.id, f]));
      const chosen = R.memoryFaces(faces, this.lv.pairs, s.rnd, s.adv, this.data.pairs);
      const gold = R.golden(chosen.length, s.rnd).map(i => chosen[i]);
      this.total = chosen.length;
      const cards = chosen.flatMap(id => [0, 1].map(k => Object.assign({ cid: id + '#' + k, key: id, golden: gold.indexOf(id) }, byId.get(id))));
      return shuffle(cards, s.rnd);
    }
    cols() {
      const narrow = this.s.stage.clientWidth < 520;
      return narrow ? Math.min(this.lv.cols || 4, 4) : this.lv.cols || 4;
    }

    start() {
      const s = this.s, ctx = s.ctx;
      this.m = AG.logic.memory.create({ setSize: this.setSize });
      this.cards = this.deck().map(c => new AG.cards.Card({
        id: c.cid, key: c.key, data: c, className: c.golden >= 0 ? 'pp-gold' : '',
        front: s.face(c.set, c.role, !s.adv), label: s.labelOf(c.set, c.role)
      }));
      this.grid = new AG.cards.CardGrid({ cards: this.cards, cols: this.cols(), label: this.str.grid, sound: false, onSelect: c => this.flip(c) });
      s.board.append(this.grid.el);
      s.setPrompt(this.str.prompt);
      s.setLabel(this.str.label, '0/' + this.total);
      s.doHint = () => this.hint();
      ctx.say('instruction', this.str.start);
      this.cards[0].el.focus({ preventScroll: true });
    }

    flip(card) {
      const s = this.s;
      if (s.ended) return;
      const r = this.m.flip(card.id, card.key);
      if (r.kind === 'ignored') return;
      card.reveal();
      AG.sfx.play('pest-patrol.sfx.flip');
      if (r.kind === 'up') { s.setBase('think'); return; }
      s.setBase('idle');
      s.attempts = this.m.attempts;
      if (r.kind === 'match') {
        const cards = r.ids.map(id => this.grid.byId(id)), d = card.data;
        setTimeout(() => {
          cards.forEach(c => { if (s.adv) c.setFront(s.face(c.data.set, c.data.role, true)); c.match(); });
        }, AG.cards.FLIP_MS + 20);
        s.matched({ set: d.set, golden: d.golden });
        s.setLabel(this.str.label, this.m.matches + '/' + this.total);
        if (this.m.matches === this.total) s.ctx.after(700, () => this.finish());
        return;
      }
      // a miss: show both a moment, then face down again
      s.ctx.after(T.flipBackMs, () => {
        r.ids.forEach(id => { const c = this.grid.byId(id); if (c && c.state === 'revealed') c.hide(); });
        this.m.settle();
      });
      s.wrong();
    }

    /** Highlights one pair (or set) not matched yet, preferring one with a card already up. */
    hint() {
      const open = this.cards.filter(c => c.state !== 'matched');
      if (!open.length) return false;
      const up = new Set(this.m.up);
      const key = (open.find(c => up.has(c.id)) || open[0]).key;
      open.filter(c => c.key === key).forEach(c => {
        c.el.classList.add('is-hint');
        setTimeout(() => c.el.classList.remove('is-hint'), T.hintMs);
      });
      return true;
    }

    finish() {
      const s = this.s, stars = R.memoryStars(this.m.attempts, this.total);
      s.finish({
        passed: true, stars,
        detail: [{ label: PP.STR.attempts, value: this.m.attempts }, { label: this.str.label, value: this.total }],
        message: stars === 3 ? this.str.winTight : this.str.win,
        learned: [...s.facted].map(id => (s.sets.get(id) || {}).fact).filter(Boolean)
      });
    }
    destroy() { if (this.grid) this.grid.destroy(); }
  }

  function shuffle(list, rnd) {
    const a = list.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }

  PP.shuffle = shuffle;
  PP.MemoryFlip = MemoryFlip;
})(window.AG);
