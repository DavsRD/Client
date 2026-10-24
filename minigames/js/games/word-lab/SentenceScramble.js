/* Health Center Word Lab — SENTENCE SCRAMBLE (level 5).
 *
 * Three short health rules per level (WASH HANDS FOR 20 SECONDS; COVER YOUR COUGH WITH YOUR
 * ELBOW; STAY HOME WHEN YOU ARE SICK; …, from data/sentences.json, in the site language).
 * Each word is a tile: ←/→ pick a tile and Enter places it (or tap), Backspace takes the last
 * one back. The rule checks itself when every blank is filled; the role expert then explains
 * why it matters. 150 points per rule, 2 per second left when all three are done; a rule
 * solved without a hint is that slot's golden star. Pass at 2 rules. */
window.AG = window.AG || {};
(function (AG) {
  const { h } = AG.util;
  const WL = AG.wordLab, T = WL.tuning, R = WL.rules;
  const S = (en, fil) => ({ en, fil });
  const fill = (spec, vars) => S(spec.en.replace(/\{(\w+)\}/g, (_, k) => vars[k]), spec.fil.replace(/\{(\w+)\}/g, (_, k) => vars[k]));

  const STR = {
    label: S('Rules', 'Tuntunin'),
    prompt: S('Rule {n} of {total}: put the words in order. Arrows + Enter, or tap.', 'Tuntunin {n} sa {total}: ayusin ang mga salita. Arrows + Enter, o i-tap.'),
    sign: S('Health center rule', 'Tuntunin ng health center'),
    start: S('Build each safety rule before the time runs out!', 'Buuin ang bawat tuntunin bago maubos ang oras!'),
    wrong: S('Not in order yet. Read it out loud: does it make sense?', 'Hindi pa tama ang ayos. Basahin nang malakas: may saysay ba?'),
    next: S('Next rule', 'Susunod na tuntunin'),
    last: S('Finish', 'Tapusin'),
    timeUp: S("Time's up!", 'Ubos na ang oras!'),
    done: S('Rules built', 'Nabuong tuntunin'),
    winAll: S('You built every rule!', 'Nabuo mo ang lahat ng tuntunin!'),
    winSome: S('You built {n} rules.', 'Nakabuo ka ng {n} tuntunin.'),
    lose: S('Build at least {n} rules to clear the level.', 'Bumuo ng kahit {n} tuntunin para matapos ang antas.')
  };

  class SentenceScramble {
    constructor(scene, data) {
      this.s = scene;
      const lv = scene.ctx.levelData || {};
      const ids = lv.sentences || data.sentences.slice(0, 3).map(x => x.id);
      this.list = ids.map(id => data.sentences.find(x => x.id === id)).filter(Boolean);
      this.i = 0; this.solvedN = 0; this.hintsRule = 0; this.busy = false;
      this.rnd = AG.util.mulberry32(scene.ctx.seed);
    }
    words(x) { return (this.s.fil ? x.fil || x.en : x.en).split(/\s+/); }

    start() {
      const s = this.s, ctx = s.ctx;
      this.signIcon = h('span'); this.signStars = h('div', { class: 'wl-sign__row' });
      this.signTitle = h('b');
      s.middle.replaceChildren(h('div', { class: 'wl-sign' }, this.signIcon, this.signTitle, this.signStars));
      this.lt = new AG.cards.LetterTiles({
        answer: this.words(this.list[0]), words: true, rnd: this.rnd,
        onCheck: r => this.check(r),
        onHint: () => { this.hintsRule++; s.chargeHint(); },
        onChange: r => { if (!this.busy) s.setBase(/[^_\s]/.test(r.value) ? 'think' : 'idle'); }
      });
      s.board.append(this.lt.el);
      this.render();
      s.onRelabel = () => this.render();
      s.startTimer(R.sentenceTime(ctx.level, ctx.difficulty), () => this.timeUp());
      ctx.say('instruction', STR.start);
      this.lt.el.focus({ preventScroll: true });
    }

    render() {
      const s = this.s, x = this.list[this.i];
      s.setLabel(STR.label, this.solvedN + '/' + this.list.length);
      if (x) s.setPrompt(STR.prompt, { n: String(this.i + 1), total: String(this.list.length) });
      this.signTitle.textContent = AG.pick(STR.sign);
      this.signIcon.replaceChildren(AG.cards.face(x ? x.icon : 'star', { iconSize: 36 }));
      this.signStars.replaceChildren(...this.list.map((_, k) => AG.ui.icon(s.collect[k] ? 'star' : 'star_empty', 18)));
    }

    check(r) {
      const s = this.s;
      if (!r.correct) { s.wrong(STR.wrong); return; }
      const x = this.list[this.i];
      this.busy = true; this.solvedN++;
      s.solved({ points: T.sentence.points, hinted: this.hintsRule > 0, golden: this.hintsRule === 0 ? this.i : -1 });
      this.render();
      const last = this.i === this.list.length - 1;
      s.read({ word: x.en, wordFil: x.fil || x.en, definition: x.tip }, last ? STR.last : STR.next).then(() => {
        if (s.ended) return;
        if (last) { this.finish(true); return; }
        this.i++; this.hintsRule = 0; this.busy = false;
        this.lt.load({ answer: this.words(this.list[this.i]) });
        s.setBase('idle');
        this.render();
        this.lt.el.focus({ preventScroll: true });
      });
    }

    timeUp() {
      if (this.s.ended) return;
      this.s.ctx.say('instruction', STR.timeUp);
      this.finish(false);
    }
    finish(allDone) {
      const s = this.s, n = this.solvedN, need = T.sentence.passSentences;
      const passed = n >= need;
      s.finish({
        passed, allDone,
        targets: R.sentenceTargets(this.list.length, s.timerTotal),
        detail: [{ label: STR.done, value: n + '/' + this.list.length }],
        message: !passed ? fill(STR.lose, { n: need }) : allDone ? STR.winAll : fill(STR.winSome, { n })
      });
    }
    destroy() { if (this.lt) this.lt.destroy(); }
  }

  WL.SentenceScramble = SentenceScramble;
})(window.AG);
