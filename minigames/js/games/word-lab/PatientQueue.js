/* Health Center Word Lab — PATIENT QUEUE (levels 1–3).
 *
 * Five patients wait at the counter. The front one shows a CLUE icon (not on Advanced from
 * level 2) and the blanks; the scrambled tiles are never in answer order, and Advanced adds
 * 1–2 decoy tiles. Filling every blank checks the word: right = the role expert reads the
 * definition and the patient leaves smiling; wrong = the tiles bounce back and the blanks
 * clear. The level ends when all five are helped (time bonus) or the timer runs out (pass at
 * 3 words). Golden words (⭐) are the level's collectibles. Filipino mode uses the Filipino
 * word list; "NG" is two tiles unless the fil.ngSingleTile setting makes it one. */
window.AG = window.AG || {};
(function (AG) {
  const { h } = AG.util;
  const WL = AG.wordLab, T = WL.tuning, R = WL.rules;
  const S = (en, fil) => ({ en, fil });

  const STR = {
    label: S('Patients', 'Pasyente'),
    prompt: S('Patient {n} of {total}: spell the word.', 'Pasyente {n} sa {total}: buuin ang salita.'),
    promptNoClue: S('Patient {n} of {total}: no clue this time. Unscramble the letters!', 'Pasyente {n} sa {total}: walang clue ngayon. Ayusin ang mga letra!'),
    letters: S('{n} letters', '{n} letra'),
    golden: S('Golden word', 'Gintong salita'),
    next: S('Next patient', 'Susunod na pasyente'),
    last: S('Finish', 'Tapusin'),
    start: S('Your first patient is here! Type the letters or tap the tiles.', 'Narito na ang unang pasyente! Mag-type ng letra o i-tap ang tiles.'),
    timeUp: S("Time's up at the health center!", 'Ubos na ang oras sa health center!'),
    helped: S('Patients helped', 'Natulungang pasyente'),
    winAll: S('You helped every patient!', 'Natulungan mo ang lahat ng pasyente!'),
    winSome: S('You helped {n} patients before closing time.', 'Natulungan mo ang {n} pasyente bago magsara.'),
    lose: S('Help at least {n} patients to clear the level.', 'Tulungan ang kahit {n} pasyente para matapos ang antas.')
  };
  const FIL_DECOYS = 'ABDEGHIKLMNÑOPRSTUWY'; // the Filipino alphabet's letters, Ñ included

  class PatientQueue {
    constructor(scene, data) {
      this.s = scene;
      const ctx = scene.ctx, lv = ctx.levelData || {};
      const list = scene.fil ? data.fil : data.en;
      const names = (scene.fil ? lv.wordsFil : lv.words) || list.filter(e => e.tier === R.queueLevel(ctx.level)).map(e => e.word);
      const golden = lv.golden || [0, 1, 2];
      this.rnd = AG.util.mulberry32(ctx.seed);
      this.queue = names.slice(0, T.queue.patients).map((w, i) => {
        const entry = list.find(e => e.word === w);
        if (!entry) AG.warnOnce('wl:' + w, 'word-lab: no entry for', w);
        return { entry: entry || { word: w, clue: '⭐', definition: S('', '') }, golden: golden.indexOf(i), sprite: 'word-lab.patient.p' + (1 + ((i + ctx.level) % 4)) };
      });
      const d = ctx.difficulty === 'advanced' ? 'advanced' : 'easy', wi = R.queueLevel(ctx.level) - 1;
      this.nDecoys = T.queue.decoys[d][wi];
      this.showClue = T.queue.clue[d][wi];
      this.i = 0; this.served = 0; this.hintsWord = 0; this.busy = false;
      this.ngSingle = scene.fil && !!AG.store.setting('fil.ngSingleTile');
    }

    decoys(word) {
      if (!this.nDecoys) return 0;
      const tokens = AG.logic.letters.tokenize(word, { ngSingle: this.ngSingle });
      const pool = (this.s.fil ? FIL_DECOYS : AG.logic.letters.DECOY_LETTERS.en).split('').filter(c => !tokens.includes(c));
      const out = [];
      for (let k = 0; k < this.nDecoys && pool.length; k++) out.push(pool.splice(Math.floor(this.rnd() * pool.length), 1)[0]);
      return out;
    }
    spec(p) { return { answer: p.entry.word, decoys: this.decoys(p.entry.word), lang: this.s.fil ? 'fil' : 'en', ngSingle: this.ngSingle, rnd: this.rnd }; }

    start() {
      const s = this.s, ctx = s.ctx;
      this.queueEl = h('div', { class: 'wl-queue' });
      s.middle.replaceChildren(this.queueEl);
      s.setLabel(STR.label, '0/' + this.queue.length);
      this.lt = new AG.cards.LetterTiles(Object.assign(this.spec(this.queue[0]), {
        onCheck: r => this.check(r),
        onHint: () => { this.hintsWord++; s.chargeHint(); },
        onChange: r => { if (!this.busy) s.setBase(r.value.replace(/[_\s]/g, '') ? 'think' : 'idle'); }
      }));
      s.board.append(this.lt.el);
      this.render();
      s.startTimer(R.queueTime(ctx.level, ctx.difficulty), () => this.timeUp());
      s.onRelabel = () => this.render();
      ctx.say('instruction', STR.start);
      this.lt.el.focus({ preventScroll: true });
    }

    render() {
      const s = this.s, p = this.queue[this.i];
      if (p) s.setPrompt(this.showClue ? STR.prompt : STR.promptNoClue, { n: String(this.i + 1), total: String(this.queue.length) });
      // the queue: the front patient (2×) with the clue bubble, the others (1×) behind
      const kids = [];
      for (let k = this.queue.length - 1; k >= this.i; k--) kids.push(this.patientEl(this.queue[k], k === this.i));
      this.queueEl.replaceChildren(...kids);
    }
    patientEl(p, front) {
      const scale = front ? 2 : 1;
      const cv = h('canvas', { width: 26, height: 42, style: { width: 26 * scale + 'px', height: 42 * scale + 'px' } });
      const draw = () => { const c = cv.getContext('2d'); c.clearRect(0, 0, 26, 42); c.imageSmoothingEnabled = false; AG.assets.draw(c, p.sprite, 0, 0, 26, 42, p.happy ? 1 : 0); };
      AG.assets.loadImage(p.sprite).then(draw);
      p.redraw = draw;
      const el = h('div', { class: 'wl-patient' + (front ? ' is-front' : '') }, cv);
      if (p.golden >= 0) el.append(h('span', { class: 'wl-patient__star', title: AG.pick(STR.golden) }, AG.ui.icon('star', 18, AG.pick(STR.golden))));
      if (front) {
        const n = AG.logic.letters.tokenize(p.entry.word, { ngSingle: this.ngSingle }).length;
        const bubble = h('div', { class: 'wl-bubble' },
          this.showClue ? AG.cards.face(p.entry.clue, { iconSize: 36 }) : AG.cards.face({ text: '?' }),
          h('span', {}, AG.pick(STR.letters).replace('{n}', n)),
          p.golden >= 0 ? h('span', { class: 'wl-bubble__gold' }, '⭐') : null);
        el.prepend(bubble);
        p.el = el;
      }
      return el;
    }

    check(r) {
      const s = this.s;
      if (!r.correct) { s.wrong(); return; }
      const p = this.queue[this.i];
      this.busy = true;
      this.served++;
      s.setLabel(STR.label, this.served + '/' + this.queue.length);
      s.solved({ points: T.queue.wordPoints, hinted: this.hintsWord > 0, golden: p.golden });
      if (p.entry.word === 'MASK') s.maskOn();
      p.happy = true; if (p.redraw) p.redraw();
      const last = this.i === this.queue.length - 1;
      s.read({ word: p.entry.word, definition: p.entry.definition }, last ? STR.last : STR.next).then(() => this.leave(p, last));
    }
    leave(p, last) {
      const s = this.s;
      if (s.ended) return;
      if (last) { this.finish(true); return; }
      const go = () => {
        if (s.ended) return;
        this.i++; this.hintsWord = 0; this.busy = false;
        this.lt.load(this.spec(this.queue[this.i]));
        s.setBase('idle');
        this.render();
        this.lt.el.focus({ preventScroll: true });
      };
      if (p.el && !AG.reducedMotion()) { p.el.classList.add('is-leaving'); setTimeout(go, T.leaveMs); } else go();
    }

    timeUp() {
      if (this.s.ended) return;
      this.s.ctx.say('instruction', STR.timeUp);
      this.finish(false);
    }
    finish(allDone) {
      const s = this.s, n = this.served, need = T.queue.passWords;
      const passed = n >= need;
      s.finish({
        passed, allDone,
        targets: R.queueTargets(s.timerTotal),
        detail: [{ label: STR.helped, value: n + '/' + this.queue.length }],
        message: !passed ? S(STR.lose.en.replace('{n}', need), STR.lose.fil.replace('{n}', need)) : allDone ? STR.winAll : S(STR.winSome.en.replace('{n}', n), STR.winSome.fil.replace('{n}', n))
      });
    }
    destroy() { if (this.lt) this.lt.destroy(); }
  }

  WL.PatientQueue = PatientQueue;
})(window.AG);
