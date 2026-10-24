/* Health Center Word Lab — WORD TWIST (level 4).
 *
 * The letters of one long word (PREVENTION, VACCINATION, QUARANTINE, HANDWASHING, OUTBREAK;
 * KALINISAN in Filipino mode where the level has one). 90 s to make words of 3+ letters;
 * Enter or ✔ submits. A word counts only if it is on the level's PRECOMPUTED kid-safe list in
 * data/twist.json (built by kalasag-dev/minigames/tools/build-twist.html; nothing is derived
 * from a dictionary at runtime). Found words are listed by length; the three golden words
 * show as ⭐ blanks until found. The full word is BINGO (+300) and passes the round; otherwise
 * it passes at minWords. 10 points per letter. A hint (? / 💡, −30) places the next letter of
 * the shortest word that is still open. */
window.AG = window.AG || {};
(function (AG) {
  const { h } = AG.util;
  const WL = AG.wordLab, T = WL.tuning, R = WL.rules;
  const S = (en, fil) => ({ en, fil });
  const fill = (spec, vars) => S(spec.en.replace(/\{(\w+)\}/g, (_, k) => vars[k]), spec.fil.replace(/\{(\w+)\}/g, (_, k) => vars[k]));

  const STR = {
    label: S('Words', 'Salita'),
    prompt: S('Make words of 3 or more letters, then press Enter or ✔.', 'Bumuo ng salitang may 3 o higit pang letra, saka pindutin ang Enter o ✔.'),
    sign: S('{n}-letter word', 'Salitang may {n} letra'),
    pass: S('Pass: {n} words', 'Pasado: {n} salita'),
    bingo: S('BINGO', 'BINGO'),
    group: S('{n} letters', '{n} letra'),
    finish: S('Finish the round', 'Tapusin ang round'),
    start: S('Find as many health-center words as you can!', 'Humanap ng pinakamaraming salita hangga\'t kaya mo!'),
    short: S('Words need 3 letters or more.', 'Kailangan ng 3 letra o higit pa.'),
    again: S('You already found {w}. Try another!', 'Nahanap mo na ang {w}. Subukan ang iba!'),
    unknown: S('{w} is not on our word list. Try another word!', 'Wala ang {w} sa listahan namin. Subukan ang ibang salita!'),
    passed: S('You passed! Keep going for more points, or finish the round.', 'Pasado ka na! Ituloy para sa mas maraming puntos, o tapusin ang round.'),
    bingoSay: S('BINGO! You used every letter!', 'BINGO! Nagamit mo ang lahat ng letra!'),
    found: S('Words found', 'Nahanap na salita'),
    win: S('You found {n} words.', 'Nakahanap ka ng {n} salita.'),
    winBingo: S('You found {n} words, BINGO included!', 'Nakahanap ka ng {n} salita, kasama ang BINGO!'),
    lose: S('Find {n} words, or the whole word, to clear the level.', 'Humanap ng {n} salita, o ang buong salita, para matapos ang antas.')
  };

  class WordTwist {
    constructor(scene, data) {
      this.s = scene;
      const ctx = scene.ctx, lv = ctx.levelData || {};
      const fil = scene.fil && lv.seedFil && data.twist.seeds[lv.seedFil];
      this.seed = fil ? lv.seedFil : (lv.seed || 'PREVENTION');
      const entry = data.twist.seeds[this.seed] || { words: [this.seed] };
      this.words = entry.words.slice();
      this.golden = (fil ? lv.goldenFil : lv.golden) || [];
      const mins = (fil ? lv.minWordsFil : lv.minWords) || { easy: 5, advanced: 8 };
      this.min = mins[ctx.difficulty === 'advanced' ? 'advanced' : 'easy'];
      this.found = new Set(); this.bingo = false; this.target = null; this.hintsWord = 0; this.saidPass = false;
      this.rnd = AG.util.mulberry32(ctx.seed);
      console.info('[word-lab] Word Twist ' + this.seed + ': ' + this.words.length + ' words on the filtered list');
    }
    get passed() { return this.bingo || this.found.size >= this.min; }

    start() {
      const s = this.s, ctx = s.ctx;
      this.signWord = h('b'); this.signPass = h('small'); this.signBingo = h('span', { class: 'wl-sign__bingo' });
      s.middle.replaceChildren(h('div', { class: 'wl-sign' }, AG.ui.icon('first_aid', 36), this.signWord, h('div', { class: 'wl-sign__row' }, this.signPass, this.signBingo)));
      s.setLabel(STR.label, '0');
      s.setPrompt(STR.prompt);
      const tiles = AG.util.shuffle([...this.seed], this.rnd);
      this.lt = new AG.cards.LetterTiles({
        answer: null, tiles, maxLength: tiles.length, lang: s.fil ? 'fil' : 'en', rnd: this.rnd,
        onSubmit: r => this.submit(r.value),
        onHint: () => { this.hintsWord++; s.chargeHint(); },
        onChange: r => s.setBase(r.value ? 'think' : 'idle')
      });
      // FREE mode has no answer to hint from: aim the hint at an open word
      const rawHint = this.lt.hint.bind(this.lt);
      this.lt.hint = target => rawHint(target || this.hintTarget());
      s.board.append(this.lt.el);
      this.finishBtn = h('button', { class: 'ag-btn', type: 'button', hidden: true }, '✔ ' + AG.pick(STR.finish));
      this.finishBtn.addEventListener('click', () => this.finish());
      this.foundEl = h('div', { class: 'wl-found', 'aria-label': AG.pick(STR.found) });
      s.extra.replaceChildren(this.foundEl, this.finishBtn);
      this.render();
      s.onRelabel = () => this.render();
      s.startTimer(T.twist.time, () => this.finish());
      ctx.say('instruction', STR.start);
      this.lt.el.focus({ preventScroll: true });
    }

    hintTarget() {
      const placed = this.lt.value();
      if (!(this.target && !this.found.has(this.target) && this.target.startsWith(placed))) this.target = R.hintTarget(this.words, this.found, placed);
      return this.target;
    }

    submit(value) {
      const s = this.s, verdict = R.judge(value, this.seed, this.words, this.found);
      if (verdict === 'short' || verdict === 'again' || verdict === 'unknown') {
        s.wrong(fill(STR[verdict], { w: value }));
        AG.kit.shake(this.lt.row);
        this.reset();
        return;
      }
      this.found.add(value);
      const bingo = verdict === 'bingo';
      s.solved({ points: R.twistPoints(value) + (bingo ? T.twist.bingo : 0), hinted: this.hintsWord > 0, golden: this.golden.indexOf(value) });
      if (bingo) {
        this.bingo = true;
        AG.kit.banner(s.stage, STR.bingo, '+' + T.twist.bingo);
        s.react('cheer', 1800);
        s.ctx.say('success', STR.bingoSay, { sound: false });
      } else if (this.passed && !this.saidPass) {
        s.ctx.say('success', STR.passed, { sound: false });
      }
      if (this.passed) this.saidPass = true;
      if (value === this.target) this.target = null;
      this.reset();
      this.render();
      if (this.found.size >= this.words.length) this.finish();
    }
    /** Clears the board (hint pins too) and keeps the tray order. */
    reset() {
      this.hintsWord = 0;
      this.lt.load({ tiles: this.lt.tiles.map(t => t.label) });
      this.lt.el.focus({ preventScroll: true });
    }

    render() {
      const s = this.s;
      s.setLabel(STR.label, String(this.found.size));
      this.signWord.textContent = AG.pick(fill(STR.sign, { n: [...this.seed].length }));
      this.signPass.textContent = AG.pick(fill(STR.pass, { n: this.min }));
      this.signBingo.textContent = AG.pick(STR.bingo);
      this.signBingo.classList.toggle('is-on', this.bingo);
      this.finishBtn.textContent = '✔ ' + AG.pick(STR.finish);
      this.finishBtn.hidden = !this.passed;
      // found words by length; the golden words wait as ⭐ blanks of their length
      const byLen = new Map();
      const add = (n, el) => { if (!byLen.has(n)) byLen.set(n, []); byLen.get(n).push(el); };
      [...this.found].forEach(w => add([...w].length, h('span', { class: 'wl-word' + (this.golden.includes(w) ? ' is-gold' : '') }, w)));
      this.golden.filter(w => !this.found.has(w)).forEach(w => add([...w].length, h('span', { class: 'wl-word is-locked', 'aria-label': AG.pick(STR.group).replace('{n}', [...w].length) + ' ⭐' }, '_'.repeat([...w].length))));
      this.foundEl.replaceChildren(...[...byLen.keys()].sort((a, b) => a - b).map(n =>
        h('div', { class: 'wl-found__group' }, h('h4', {}, AG.pick(STR.group).replace('{n}', n)), h('div', { class: 'wl-found__list' }, byLen.get(n)))));
    }

    finish() {
      const s = this.s;
      if (s.ended) return;
      const n = this.found.size;
      s.finish({
        passed: this.passed, allDone: false, bingo: this.bingo,
        targets: R.twistTargets([...this.seed].length, this.min),
        detail: [{ label: STR.found, value: n + '/' + this.words.length }, { label: STR.bingo, value: this.bingo ? '✔' : '—' }],
        message: !this.passed ? fill(STR.lose, { n: this.min }) : fill(this.bingo ? STR.winBingo : STR.win, { n })
      });
    }
    destroy() { if (this.lt) this.lt.destroy(); }
  }

  WL.WordTwist = WordTwist;
})(window.AG);
