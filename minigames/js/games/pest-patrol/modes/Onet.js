/* Pest Patrol Match — ONET CONNECT (world 4).
 *
 * An OnetView of partner pairs: a pest clears with its own cause or prevention when a line
 * with ≤ 2 turns joins them. Every board starts solvable (greedy play with ≤ 2 shuffles,
 * re-dealt if stuck). Timer bar: Easy 120 s, Advanced 80 s. S / 🔀 shuffles (2 per level);
 * when no move is left, a free shuffle runs with a toast. Matches within 3 s are a speed
 * chain (× 1.5). Phones turn boards wider than 6 columns on their side. Advanced shows a
 * pair type's labels only after its first match. Three tiles are golden.
 * BossBoard (world 5) extends this class. */
window.AG = window.AG || {};
(function (AG) {
  const PP = AG.pestPatrol, T = PP.tuning, R = PP.rules;
  const S = (en, fil) => ({ en, fil });

  const STR = {
    label: S('Pairs', 'Pares'),
    prompt: S('Join a pest to what it causes or how to stop it: a line with at most 2 turns.', 'Ikabit ang peste sa dala nito o sa pagpigil dito: linyang may hanggang 2 liko lang.'),
    board: S('Onet board', 'Onet board'),
    start: S('Connect each pest to its sickness or its fix before time runs out!', 'Ikabit ang bawat peste sa sakit o lunas nito bago maubos ang oras!'),
    different: S("Those two don't go together. A pest pairs with its own sickness or fix.", 'Hindi magkapares ang dalawang iyan. Ipares ang peste sa sarili nitong sakit o lunas.'),
    blocked: S('Right pair, but the path is blocked. Clear the tiles in the way first.', 'Tamang pares, pero may harang. Alisin muna ang nakaharang na tiles.'),
    freeShuffle: S('No moves left, so here is a free shuffle!', 'Wala nang galaw, kaya libreng halo!'),
    noShuffles: S('No shuffles left. Try a hint (H or 💡).', 'Ubos na ang halo. Subukan ang pahiwatig (H o 💡).'),
    cleared: S('Cleared', 'Naalis'),
    win: S('Board clear! Every pest is matched.', 'Malinis ang board! Natugma ang bawat peste.'),
    passTime: S('Time! You cleared most of the board. Well done.', 'Oras na! Naalis mo ang halos buong board. Magaling.'),
    lose: S("Time's up! Clear at least three quarters of the board to pass.", 'Ubos na ang oras! Alisin ang kahit tatlong-kapat ng board para pumasa.')
  };

  /** OnetView plus a hook to dress each cell (golden tiles, breeding sites). */
  class PPOnet extends AG.cards.OnetView {
    cardFor(tile, i) {
      const c = super.cardFor(tile, i);
      if (this.opts.decorate) this.opts.decorate(c, tile, i);
      return c;
    }
  }

  class Onet {
    constructor(scene, data) {
      this.s = scene; this.data = data; this.str = STR;
      const ctx = scene.ctx;
      this.lv = (ctx.levelData && ctx.levelData[ctx.difficulty]) || { w: 4, h: 4 };
      this.cleared = 0;
      this.seconds = T.onet.time[scene.adv ? 'advanced' : 'easy'];
    }

    /** Easy plays 3–4 very distinct sets (no 🦟 / 🪰 look-alike pair); Advanced all five. */
    chooseSets(w, h) {
      const ids = this.data.sets.map(x => x.id);
      if (this.s.adv) return ids;
      return R.pick(ids.filter(id => id !== 'fly'), w * h <= 20 ? 3 : 4, this.s.rnd);
    }

    start() {
      const s = this.s, ctx = s.ctx;
      const { w, h } = R.fitBoard(this.lv.w, this.lv.h, s.stage.clientWidth < 520);
      const tiles = R.onetTiles(this.chooseSets(w, h), w, h);
      R.golden(tiles.length, s.rnd).forEach((ti, k) => { tiles[ti].gold = k; });
      this.totalTiles = tiles.length;
      const dealt = R.dealSolvable(w, h, tiles, s.rnd);
      if (dealt.stuck) AG.warnOnce('pp:stuck', 'pest-patrol: no greedy-solvable deal found for', w + '×' + h);
      this.board = dealt.board;
      this.setup && this.setup();
      this.view = new PPOnet({
        board: this.board, rnd: s.rnd, label: this.str.board,
        face: t => s.face(t.set, t.role, s.showLabel(t.set)),
        decorate: (c, t, i) => this.decorate(c, t, i),
        under: this.under ? (x, y) => this.under(x, y) : null,
        onSelect: () => s.setBase('think'),
        onMatch: m => this.onMatch(m),
        onMiss: m => { s.setBase('idle'); s.wrong(m.reason === 'blocked' ? STR.blocked : STR.different); },
        onEmptySelect: p => this.onEmpty && this.onEmpty(p),
        onClear: () => this.onClear(),
        onNoMoves: () => { ctx.say('instruction', STR.freeShuffle, { ms: T.toastMs }); this.view.shuffle(); }
      });
      s.board.append(this.view.el);
      if (s.adv) s.onFact = () => this.view.refresh(); // the new pair type's labels show from now on
      s.setPrompt(this.str.prompt);
      this.updateLabel();
      s.doHint = () => !!this.view.hint(T.hintMs);
      s.useShuffles(T.onet.shuffles, () => this.shuffle());
      s.startTimer(this.seconds, () => this.timeUp());
      ctx.say('instruction', this.str.start);
      this.view.grid.cards[0].el.focus({ preventScroll: true });
    }

    decorate(card, tile) { if (tile && tile.gold != null) card.el.classList.add('pp-gold'); }
    updateLabel() { this.s.setLabel(STR.label, this.cleared / 2 + '/' + this.totalTiles / 2); }

    onMatch({ tiles }) {
      const s = this.s, g = tiles.find(t => t.gold != null);
      this.cleared += 2;
      s.setBase('idle');
      s.matched({ set: tiles[0].set, golden: g ? g.gold : null, sound: false }); // the engine played 'good'
      this.updateLabel();
    }
    shuffle() {
      const s = this.s;
      if (s.ended || AG.paused || this.view.busy) return;
      if (!s.shuffles) { s.ctx.say('instruction', STR.noShuffles, { sound: false }); return; }
      this.view.shuffle();
      s.spendShuffle();
    }
    onClear() { this.finish(true); }
    timeUp() { if (!this.s.ended) this.finish(false); }

    /** Extra conditions for a win (World 5: every site clean). */
    get extraDone() { return true; }
    finish(cleared) {
      const s = this.s;
      if (s.ended) return;
      const left = s.timer ? s.timer.left : 0;
      const passed = cleared ? this.extraDone : R.onetPassed(this.cleared, this.totalTiles) && this.extraDone;
      const stars = R.onetStars({ passed, cleared, left, total: this.seconds, bestChain: s.streak.best });
      s.finish(Object.assign({
        passed, stars, cleared,
        detail: [{ label: STR.cleared, value: Math.round((100 * this.cleared) / this.totalTiles) + '%' }],
        message: cleared ? STR.win : passed ? STR.passTime : STR.lose,
        learned: [...s.facted].map(id => (s.sets.get(id) || {}).fact).filter(Boolean)
      }, this.finishExtra ? this.finishExtra(passed) : {}));
    }
    destroy() { if (this.view) this.view.destroy(); }
  }

  PP.Onet = Onet;
  PP.OnetSTR = STR;
})(window.AG);
