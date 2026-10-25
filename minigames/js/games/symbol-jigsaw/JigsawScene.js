/* Hazard Symbol Jigsaw: the level flow (Round) and the jigsaw puzzle (JigsawScene, levels 1–4).
 *
 *   SCENE (3 s: a spill, a covered sign) → PUZZLE → REVEAL (pixel pop + the sign's name, the expert explains it)
 *   → QUESTION (ChoiceModal) → FINALE (outdoors: the windsock, which way is upwind; indoors: "tell an adult")
 *   → a HOME SAFETY card (bonus) → results; the sign becomes a sticker in the Sign Album.
 *
 * Round holds everything but the puzzle (SlideScene.js does the sliding-tile level the same way). JigsawScene cuts
 * the sign with the pieces engine (seeded, cached), puts the pieces in a Tray over a SlotBoard and lets PiecePlay do
 * the moving: drag, tap, or keys (←/→ choose, Enter picks up, arrows slot to slot, R turns, Enter places, Esc puts
 * back, Tab tray ↔ board). A piece that does not snap bounces back and counts a misplacement. Numbers and scoring:
 * tuning.js. Text is English only ({ en }). */
window.AG = window.AG || {};
(function (AG) {
  const { h } = AG.util;
  const SJ = AG.symbolJigsaw, T = SJ.tuning, SC = SJ.scoring, W = SJ.wind, P = AG.pieces;
  const K = 'symbol-jigsaw.';
  const pick = v => AG.pick(v);
  const fmt = (t, vars) => pick(t).replace(/\{(\w+)\}/g, (_, k) => (vars[k] == null ? '' : vars[k]));
  const rich = text => AG.dialogue.renderText(text, h('span'));

  const STR = {
    detective: { en: 'Hazard Detective' }, mistakes: { en: 'Mistakes' }, moves: { en: 'Moves' },
    sceneLine: { en: 'What spilled here? **Rebuild the sign!**' }, start: { en: 'Start ▶' },
    scene: {
      warehouse: { en: 'A warehouse floor. Something spilled, and its warning sign is covered up.' },
      tanker: { en: 'A tanker truck leaked on the road. Its warning sign is covered up.' },
      beach: { en: 'Oil washed up on the beach. The warning sign is covered up.' },
      cabinet: { en: 'A bottle tipped over under the kitchen sink. Its warning label is covered up.' }
    },
    pickFirst: { en: 'Pick a piece from the tray and put it where it belongs. Par time: **{par}**.' },
    pickRot: { en: 'Some pieces are turned. Press **R** or ↻ until a piece is the right way up. Par time: **{par}**.' },
    pickDecoy: { en: 'Careful: a few pieces come from a **different sign**. Par time: **{par}**.' },
    ghostNote: { en: 'The faint dots show the picture.' },
    snap: { en: 'Snap! {n} of {total} pieces.' },
    noSpot: { en: 'Not there. Try another spot.' }, noTurn: { en: 'Right spot, but turn the piece first (R or ↻).' },
    decoy: { en: 'This piece is from a different sign.' }, filled: { en: 'That spot is already filled.' },
    slidePick: { en: 'Slide the tiles into the gap to rebuild the sign. Par time: **{par}**.' },
    peek: { en: 'Peek' }, peekAlt: { en: 'A faint picture of the sign' },
    solvedLine: { en: 'Sign rebuilt!' },
    revealLine: { en: 'It is the **{name}** sign!' }, newSticker: { en: 'New sticker for your Sign Album!' }, haveSticker: { en: 'This sticker is already in your Sign Album.' },
    cont: { en: 'Continue ▶' }, skip: { en: 'Skip this card' },
    qEyebrow: { en: 'Symbol check' }, qLine: { en: 'Think like a detective. What is the **safe** thing to do?' }, windLine: { en: 'Read the windsock. Which way is **upwind**?' }, tryAgain: { en: 'Try another answer.' },
    homeEyebrow: { en: 'At home' }, cardEyebrow: { en: 'Home safety card' },
    dSign: { en: 'Sign' }, dTime: { en: 'Time' }, dAlbum: { en: 'Sign Album' }, dQuestion: { en: 'Question' }, dUpwind: { en: 'Upwind' }, dHome: { en: 'Finale' },
    tries1: { en: 'first try' }, triesN: { en: '{n} tries' },
    msg3: { en: 'A perfect detective job! You read the sign, then you chose the safe way.' },
    msg2: { en: 'You read the sign and chose the safe way. For 3 stars: at most 1 mistake, a faster time, and the question right on your first try.' },
    msg1: { en: 'You rebuilt the sign and learned what it means. Try for fewer mistakes and a faster time.' }
  };

  /* ---------- styles, once per page (all under #ag-app, classes sj-) ---------- */
  const CSS = `
#ag-app .sj { position: relative; isolation: isolate; display: grid; grid-template-columns: minmax(0, 1fr); gap: 10px; width: min(100%, 720px); margin-inline: auto; color: var(--fg); font-variant-ligatures: none; }
#ag-app .sj-head { display: flex; align-items: flex-end; gap: 10px; }
#ag-app .sj-who { flex: none; display: flex; flex-direction: column; align-items: center; }
#ag-app .sj-who__fig { display: flex; align-items: flex-start; justify-content: center; width: 72px; height: 76px; overflow: hidden; }
#ag-app .sj-who__tag { margin-top: 2px; padding: 0 6px; font: 700 .75rem var(--font-display); color: #1e1538; background: #fff4cc; border: 2px solid #1e1538; white-space: nowrap; }
#ag-app .sj-bubble { flex: 1 1 auto; min-width: 0; display: grid; gap: 4px; padding: 8px 12px; color: #1e1538; background: #fff4cc; border: var(--b) solid #1e1538; box-shadow: 3px 3px 0 var(--shadow-c); }
#ag-app .sj-bubble .ag-eyebrow { color: #4a4170; }
#ag-app .sj-line { margin: 0; min-height: 2.7em; font-weight: 700; line-height: 1.35; }
#ag-app .sj-line strong, #ag-app .sj-line .rs-em { color: #6a2b00; }
#ag-app .sj-main { min-width: 0; display: grid; grid-template-columns: minmax(0, 1fr); gap: 10px; justify-items: center; }
#ag-app .sj-ico { image-rendering: pixelated; vertical-align: middle; }
#ag-app .sj strong.rs-em, #ag-app .sj .sj-wind__ask strong { display: inline; margin: 0; padding: 0; }
#ag-app .sj-next { justify-self: center; }
#ag-app .sj [hidden] { display: none !important; }

/* the spill scene, with the sign covered */
#ag-app .sj-scene { margin: 0; width: min(100%, 480px); box-sizing: border-box; background: #fffaf0; color: #1e1538; border: var(--b) solid #1e1538; box-shadow: 4px 4px 0 var(--shadow-c); }
#ag-app .sj-scene__art, #ag-app .sj-wind__art { position: relative; aspect-ratio: 16 / 9; overflow: hidden; background: #bfe8ff; }
#ag-app .sj-scene__art img, #ag-app .sj-wind__art img { display: block; width: 100%; height: 100%; object-fit: cover; image-rendering: pixelated; }
#ag-app .sj-scene figcaption, #ag-app .sj-wind__cap { margin: 0; padding: 6px 10px; font-weight: 800; line-height: 1.3; border-top: var(--b) solid #1e1538; }
#ag-app .sj-cover { position: absolute; right: 10px; top: 10px; display: grid; place-items: center; width: 64px; height: 64px; background: #fff4cc; border: 4px solid #1e1538; box-shadow: 4px 4px 0 rgba(30, 21, 56, .5); outline: 3px dashed #e8a317; outline-offset: -9px; font: 900 2.2rem/1 var(--font-display); color: #1e1538; }

/* the puzzle: engine boards in 9-slice frames */
#ag-app .sj-puzzle { display: grid; grid-template-columns: minmax(0, 1fr); gap: 8px; justify-items: center; width: 100%; min-width: 0; }
#ag-app .sj .agp-play__board { padding: 18px 0 10px; }
#ag-app .sj.is-framed .agp-board { border: 8px solid transparent; border-image: var(--sj-board) 8 fill / 8px stretch; background: transparent; image-rendering: pixelated; }
#ag-app .sj.is-framed .agp-tray { border: 8px solid transparent; border-image: var(--sj-tray) 8 fill / 8px stretch; background: transparent; image-rendering: pixelated; }
#ag-app .sj.is-framed .agp-slide { border: 8px solid transparent; border-image: var(--sj-slide) 8 fill / 8px stretch; background: transparent; image-rendering: pixelated; }
#ag-app .sj .agp-slots__guide { opacity: 1; filter: none; }
#ag-app .sj--norot .agp-btn[data-id="rotate"] { display: none; }
#ag-app .sj-peek { display: grid; justify-items: center; gap: 4px; }
#ag-app .sj-peek canvas { background: var(--panel-2); border: 3px solid #1e1538; }
#ag-app .sj-peekbtn { min-height: 48px; min-width: 48px; display: inline-flex; align-items: center; gap: 6px; }

/* reveal */
#ag-app .sj-reveal { display: grid; justify-items: center; gap: 8px; width: 100%; }
#ag-app .sj-reveal__stage { display: grid; place-items: center; }
#ag-app .sj-reveal__sign { display: block; image-rendering: pixelated; border: 4px solid #1e1538; box-shadow: 4px 4px 0 var(--shadow-c); background: #fff; }
#ag-app .sj-reveal__name { margin: 0; padding: 4px 14px; font: 700 1.5rem/1.2 var(--font-display); color: #1e1538; background: #ffd23f; border: var(--b) solid #1e1538; box-shadow: 3px 3px 0 var(--shadow-c); text-align: center; }
#ag-app .sj-reveal__sticker { display: inline-flex; align-items: center; gap: 6px; margin: 0; padding: 2px 10px; font-weight: 800; color: #1e1538; background: #dff7e3; border: 2px solid #1e1538; }
#ag-app .sj-reveal .rs-dlg-wrap { width: min(100%, 640px); }

/* ChoiceModal: the question, the home finale and the home cards */
#ag-app .sj-modal { width: min(100%, 640px); box-sizing: border-box; display: grid; gap: 10px; padding: 12px; background: var(--panel); border: var(--b) solid var(--ink); box-shadow: var(--sh) var(--sh) 0 var(--shadow-c); }
#ag-app .sj-modal__top { display: flex; align-items: center; gap: 12px; }
#ag-app .sj-modal__art { flex: none; display: block; image-rendering: pixelated; border: 3px solid #1e1538; background: #fff; }
#ag-app .sj-modal__ask { margin: 0; font: 700 1.2rem/1.3 var(--font-display); }
#ag-app .sj-modal .ag-choices { grid-template-columns: 1fr; }
#ag-app .sj-modal .ag-choice.right { background: var(--safe-soft); }
#ag-app .sj-modal__why { margin: 0; padding: 8px 12px; font-weight: 700; line-height: 1.35; color: #1e1538; background: #fff4cc; border: 2px solid #1e1538; border-left-width: 8px; }
#ag-app .sj-modal__actions { display: flex; flex-wrap: wrap; gap: 10px; justify-content: center; }
@container (max-width: 480px) { #ag-app .sj-modal__top { flex-direction: column; text-align: center; } }

/* upwind finale */
#ag-app .sj-wind { width: min(100%, 640px); display: grid; gap: 10px; justify-items: center; }
#ag-app .sj-wind__scene { margin: 0; width: min(100%, 480px); box-sizing: border-box; background: #fffaf0; color: #1e1538; border: var(--b) solid #1e1538; box-shadow: 4px 4px 0 var(--shadow-c); }
#ag-app .sj-wind__sock { position: absolute; left: 8px; top: 6px; line-height: 0; }
#ag-app .sj-wind__ask { margin: 0; font-weight: 800; line-height: 1.35; text-align: center; }
#ag-app .sj-compass { display: grid; grid-template-columns: repeat(3, minmax(84px, 1fr)); grid-template-rows: repeat(3, auto); gap: 6px; width: min(100%, 330px); }
#ag-app .sj-compass__n { grid-column: 3; grid-row: 1; justify-self: end; align-self: start; font: 700 .8rem var(--font-display); }
#ag-app .sj-compass__you { grid-column: 2; grid-row: 2; display: grid; place-items: center; align-content: center; gap: 2px; font: 700 .9rem var(--font-display); }
#ag-app .sj-arrow { position: relative; display: grid; justify-items: center; align-content: center; gap: 2px; min-height: 84px; padding: 6px 4px; font: 700 .8rem/1.2 var(--font-display); color: #1e1538; background: #fffaf0; border: 3px solid #1e1538; box-shadow: 3px 3px 0 var(--shadow-c); cursor: pointer; }
#ag-app .sj-arrow:focus-visible { outline: 3px solid var(--vest); outline-offset: 2px; }
#ag-app .sj-arrow__key { position: absolute; left: 3px; top: 2px; font-size: .75rem; }
#ag-app .sj-arrow__mark { font-size: .7rem; }
#ag-app .sj-arrow.is-wrong { opacity: .6; background: #ececec; }
#ag-app .sj-arrow.is-right { background: #dff7e3; }
#ag-app .sj-arrow:disabled { cursor: default; }
#ag-app .sj-arrowart { display: block; }
#ag-app .sj-wind__say { margin: 0; min-height: 1.4em; font-weight: 700; text-align: center; }
#ag-app .sj-wind__explain { display: grid; gap: 10px; justify-items: center; width: 100%; }
#ag-app .sj-wind__demo { display: flex; flex-wrap: wrap; gap: 12px; justify-content: center; align-items: center; }
#ag-app .sj-demo { position: relative; flex: none; width: 200px; height: 130px; overflow: hidden; background: #e8f6ff; border: 3px solid #1e1538; }
#ag-app .sj-demo__you { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); padding: 1px 4px; font: 700 .8rem var(--font-display); color: #1e1538; background: #fff4cc; border: 2px solid #1e1538; z-index: 2; }
#ag-app .sj-demo__a { position: absolute; left: calc(50% - 25px); top: calc(50% - 25px); line-height: 0; animation: sj-go ${T.arrowMs}ms steps(5, end) infinite; }
#ag-app .sj-demo__a.is-you { z-index: 1; }
@keyframes sj-go { from { transform: translate(0, 0); } to { transform: translate(var(--dx), var(--dy)); } }
@media (prefers-reduced-motion: reduce) { #ag-app .sj-demo__a { animation: none; transform: translate(var(--dx), var(--dy)); } }
#ag-app .sj-legend { list-style: none; display: grid; gap: 6px; margin: 0; padding: 0; font-weight: 800; }
#ag-app .sj-legend li { display: flex; align-items: center; gap: 8px; }
#ag-app .sj-wind__explain .rs-dlg-wrap { width: min(100%, 640px); }
#ag-app .sj-sock { display: block; image-rendering: pixelated; }`;
  function injectCss() {
    if (!document.querySelector('style[data-ag-css="symbol-jigsaw"]')) document.head.append(h('style', { 'data-ag-css': 'symbol-jigsaw' }, CSS));
  }
  const cssUrl = u => 'url("' + u + '")';

  /* ---------- ChoiceModal: a question with 3 choices; a wrong one explains and the player tries again ---------- */
  class ChoiceModal {
    /** o: { eyebrow, ask, art (url), options: [{ text, ok, why }], seed, skip, onWrong(opt), onRight(opt), onDone({ tries, firstTry, skipped }) } */
    constructor(host, ctx, o) {
      this.o = o; this.ctx = ctx; this.tries = 0; this.settled = false; this.offs = [];
      const opts = SJ.util.shuffled(o.options, o.seed || 1);
      this.opts = opts;
      this.kit = AG.kit.choices(opts.map(x => ({ text: x.text, ok: false })), (opt, i, btn) => this.pick(opts[i], i, btn), { label: o.ask });
      this.why = h('p', { class: 'sj-modal__why', role: 'status', 'aria-live': 'polite', hidden: true });
      this.cont = h('button', { type: 'button', class: 'ag-btn', hidden: true }, pick(STR.cont));
      this.offs.push(SJ.onPress(this.cont, () => this.finish(false)));
      const actions = h('div', { class: 'sj-modal__actions' }, this.cont);
      if (o.skip) {
        this.skipBtn = h('button', { type: 'button', class: 'ag-btn ag-btn--alt ag-btn--small' }, pick(STR.skip));
        this.offs.push(SJ.onPress(this.skipBtn, () => this.finish(true)));
        actions.append(this.skipBtn);
      }
      const id = 'sj-ask-' + Math.random().toString(36).slice(2, 7);
      this.el = h('section', { class: 'sj-modal', 'aria-labelledby': id },
        o.eyebrow ? h('span', { class: 'ag-eyebrow' }, pick(o.eyebrow)) : null,
        h('div', { class: 'sj-modal__top' }, o.art ? h('img', { class: 'ag-px sj-modal__art', src: o.art, alt: '', width: 120, height: 120, draggable: 'false' }) : null,
          h('h3', { class: 'sj-modal__ask', id }, pick(o.ask))),
        this.kit.el, this.why, actions);
      host.append(this.el);
      for (const [a, d] of [['UP', -1], ['LEFT', -1], ['DOWN', 1], ['RIGHT', 1]]) this.offs.push(AG.input.on(a, e => { if (e.phase === 'down') this.step(d); }));
      this.timer = setTimeout(() => this.focusChoice(0), 80);
    }
    live() { return this.kit.btns.filter(b => !b.disabled); }
    focusChoice(i) { const l = this.live(); if (l.length) l[Math.max(0, Math.min(l.length - 1, i))].focus({ preventScroll: true }); }
    step(dir) {
      if (this.settled) return;
      const l = this.live(), cur = l.indexOf(document.activeElement);
      this.focusChoice(cur < 0 ? (dir > 0 ? 0 : l.length - 1) : (cur + dir + l.length) % l.length);
      AG.sfx.play('tap');
    }
    pick(opt, i, btn) {
      if (this.settled) return;
      this.tries++;
      this.why.hidden = false;
      if (!opt.ok) {
        this.kit.mark(i, false);
        this.why.textContent = pick(opt.why) + ' ' + pick(STR.tryAgain);
        AG.sfx.play('soft');
        if (this.o.onWrong) this.o.onWrong(opt);
        this.focusChoice(0);
        return;
      }
      this.settled = true;
      this.kit.mark(i, true); this.kit.lock();
      this.why.textContent = pick(opt.why);
      this.cont.hidden = false;
      if (this.skipBtn) this.skipBtn.hidden = true;
      AG.sfx.play('good');
      if (this.o.onRight) this.o.onRight(opt);
      this.timer = setTimeout(() => this.cont.focus({ preventScroll: true }), 60);
    }
    finish(skipped) {
      if (this.done) return; this.done = true;
      this.o.onDone({ tries: this.tries, firstTry: !skipped && this.tries === 1, skipped: !!skipped });
    }
    destroy() { clearTimeout(this.timer); this.offs.forEach(f => f()); this.offs = []; this.kit.destroy(); this.el.remove(); }
  }

  /** A dithered copy of a picture: every other pixel of every other row, so about a quarter of it shows. */
  function ditherCanvas(img, w, hh, share) {
    const cv = P.canvas(w, hh), g = cv.getContext('2d');
    const src = P.canvas(w, hh); src.getContext('2d').drawImage(img, 0, 0, w, hh, 0, 0, w, hh);
    const from = src.getContext('2d').getImageData(0, 0, w, hh), to = g.createImageData(w, hh);
    const every = share >= 0.5 ? 1 : 2; // 25 %: the lattice of even rows and columns
    for (let y = 0; y < hh; y++) for (let x = 0; x < w; x++) {
      if (every === 2 && (x % 2 || y % 2)) continue;
      const i = (y * w + x) * 4; to.data[i] = from.data[i]; to.data[i + 1] = from.data[i + 1]; to.data[i + 2] = from.data[i + 2]; to.data[i + 3] = from.data[i + 3];
    }
    g.putImageData(to, 0, 0);
    return cv;
  }

  /* ---------- Round: the whole level but the puzzle ---------- */
  class Round {
    /** o: { level (levels.json entry), spec (easy | advanced), sign, signs, qa, ask, home, cards, album } */
    constructor(stage, ctx, done, o) {
      injectCss();
      this.stage = stage; this.ctx = ctx; this.doneFn = done; this.o = o;
      this.level = o.level; this.spec = o.spec; this.sign = o.sign; this.sc = SJ.scenes[o.sign.scene] || SJ.scenes.warehouse;
      this.par = this.spec.par;
      this.mis = 0; this.counter = 0; this.ms = 0; this.timing = false; this.phase = 'scene';
      this.timers = []; this.offs = []; this.reaction = null; this.shown = null;
      this.qTries = 0; this.fTries = 0; this.cardTries = 0; this.began = false; this.over = false;
      this.rig = ctx.rig('portrait');
      this.build();
      this.hud = ctx.hud({ label: this.counterLabel(), timer: true });
      this.hud.set({ label: 0, timer: SC.mmss(0) });
      this.last = performance.now();
      this.tickId = ctx.every(200, () => this.tick());
      this.prep = Promise.resolve(this.prepare()).catch(err => { console.error(err); this.stage.append(h('p', { class: 'ag-loading' }, AG.t('sh.loadFailed', { msg: err.message }))); });
      this.showScene();
    }
    counterLabel() { return STR.mistakes; }
    prepare() { return null; }
    startPuzzle() { /* a subclass builds the puzzle in this.puzzleHost */ }

    build() {
      const { ctx } = this;
      this.fig = h('div', { class: 'sj-who__fig' });
      const who = h('div', { class: 'sj-who', 'aria-hidden': 'true' }, this.fig, h('span', { class: 'sj-who__tag' }, AG.chars.get(ctx.characterId).name));
      this.line = h('p', { class: 'sj-line', role: 'status', 'aria-live': 'polite' });
      this.bubble = h('div', { class: 'sj-bubble' }, h('span', { class: 'ag-eyebrow' }, h('img', { class: 'ag-px sj-ico', src: AG.pixelIcon('🔍'), width: 18, height: 18, alt: '', draggable: 'false' }), ' ' + pick(STR.detective)), this.line);
      this.main = h('div', { class: 'sj-main' });
      this.root = h('div', { class: 'sj sj--' + this.level.mode + (this.spec.rotate ? '' : ' sj--norot') }, h('div', { class: 'sj-head' }, who, this.bubble), this.main);
      // 9-slice frames from the asset pack (a missing one leaves the engine's plain frame)
      let framed = false;
      [['board', '--sj-board'], ['tray', '--sj-tray'], ['slide_frame', '--sj-slide']].forEach(([k, v]) => {
        const u = AG.assets.url(K + 'ui.' + k + '_9slice');
        if (u) { this.root.style.setProperty(v, cssUrl(u)); framed = true; }
      });
      this.root.classList.toggle('is-framed', framed);
      this.stage.append(this.root);
      this.renderMe();
    }
    say(text, vars) { this.line.replaceChildren(rich({ en: fmt(text, vars || {}) })); }
    after(ms, fn) { const id = this.ctx.after(ms, () => { if (!this.over) fn(); }); this.timers.push(id); return id; }

    /* ---------- the player's portrait ---------- */
    baseAction() { return this.phase === 'puzzle' ? 'think' : this.phase === 'reveal' ? 'cheer' : 'idle'; }
    renderMe() {
      const a = this.reaction || this.baseAction();
      if (a === this.shown) return;
      this.shown = a; this.rig.play(a);
      this.fig.replaceChildren(this.rig.img(1));
    }
    react(action, ms) {
      this.reaction = action; this.renderMe();
      clearTimeout(this.reactT);
      this.reactT = setTimeout(() => { this.reaction = null; this.renderMe(); }, ms || T.reactMs);
    }
    go(phase) { this.phase = phase; this.reaction = null; this.renderMe(); this.stage.scrollTop = 0; }

    tick() {
      const now = performance.now(), dt = Math.min(400, now - this.last);
      this.last = now;
      if (!this.timing) return;
      this.ms += dt;
      this.hud.set({ timer: SC.mmss(this.ms) });
    }
    /** Misplacements: they cost points and stars. (The sliding level shows its move count in the same HUD slot, which is not a mistake.) */
    countMis(n) { this.mis = this.counter = n; this.hud.set({ label: n }); }

    /* ---------- 1. the scene ---------- */
    /** The spill scene's picture and caption; covered = the "?" over the sign. */
    sceneFigure(covered) {
      const key = K + 'scene.' + this.sc.id;
      const img = h('img', { class: 'ag-px', src: AG.assets.url(key) || AG.assets.placeholderURL(key, 480, 270), alt: '', draggable: 'false' });
      return h('figure', { class: 'sj-scene' }, h('div', { class: 'sj-scene__art' }, img, covered ? h('div', { class: 'sj-cover', 'aria-hidden': 'true' }, '?') : null), h('figcaption', {}, pick(STR.scene[this.sc.id])));
    }
    showScene() {
      const { ctx } = this;
      const fig = this.sceneFigure(true);
      const start = h('button', { type: 'button', class: 'ag-btn' }, pick(STR.start));
      this.offs.push(SJ.onPress(start, () => this.begin()));
      this.main.replaceChildren(fig, start);
      this.say(STR.sceneLine);
      this.left = T.sceneMs;
      this.sceneTick = ctx.every(100, () => { this.left -= 100; if (this.left <= 0) this.begin(); });
      this.timers.push(this.sceneTick);
      setTimeout(() => { if (!this.began && start.isConnected) start.focus({ preventScroll: true }); }, 60);
    }
    async begin() {
      if (this.began || this.over) return;
      this.began = true; this.ctx.clear(this.sceneTick);
      await this.prep;
      if (this.over) return;
      this.go('puzzle');
      this.puzzleHost = h('div', { class: 'sj-puzzle' });
      this.main.replaceChildren(this.puzzleHost);
      this.startPuzzle();
      this.last = performance.now(); this.timing = true;
    }

    /* ---------- 2 → 3. the puzzle is done: the reveal ---------- */
    puzzleDone() {
      if (this.phase !== 'puzzle') return;
      this.timing = false; this.puzzleMs = Math.round(this.ms);
      this.say(STR.solvedLine);
      this.after(700, () => { this.teardownPuzzle(); this.showReveal(); }); // the finished picture stays up for a moment
    }
    teardownPuzzle() { /* a subclass lets go of its engine objects */ }

    showReveal() {
      const { ctx, sign } = this, ex = ctx.expertId;
      this.go('reveal');
      const album = this.o.album || [], isNew = !album.includes(sign.id);
      const url = AG.assets.url(sign.art) || AG.assets.placeholderURL(sign.art, 120, 120);
      const avail = Math.max(120, Math.min(this.root.clientWidth || 360, 400) - 24);
      const S = Math.max(1, Math.min(T.maxScale, Math.floor(avail / 120)));
      const popS = (S + 1) * 120 <= avail + 40 ? S + 1 : S;
      const img = h('img', { class: 'ag-px sj-reveal__sign', src: url, alt: pick(sign.name), width: 120, height: 120, draggable: 'false' });
      const set = s => { img.style.width = img.style.height = 120 * s + 'px'; };
      set(S);
      const stage = h('div', { class: 'sj-reveal__stage' }, img);
      stage.style.minHeight = 120 * popS + 8 + 'px';
      const name = h('h2', { class: 'sj-reveal__name', tabindex: '-1' }, pick(sign.name));
      const sticker = h('p', { class: 'sj-reveal__sticker' }, AG.ui.icon('star', 18, '', 'sj-ico'), pick(isNew ? STR.newSticker : STR.haveSticker));
      const pose = AG.rig.resolve(ex, sign.danger ? 'alert' : 'point').frame;
      const box = AG.dialogue.box({ speaker: ex, style: sign.danger ? 'warning' : 'info', text: { en: pick(sign.meaning) }, pose, typewriter: AG.store.setting('typewriter') !== false && !AG.reducedMotion(), plainFont: AG.store.setting('plainFont') });
      const next = h('button', { type: 'button', class: 'ag-btn sj-next' }, pick(STR.cont));
      this.offs.push(SJ.onPress(next, () => this.showQuestion()));
      this.main.replaceChildren(h('div', { class: 'sj-reveal' }, stage, name, sticker, box, next));
      this.say(STR.revealLine, { name: pick(sign.name) });
      AG.sfx.play(K + 'sfx.reveal');
      this.react('cheer', 1800);
      if (popS > S && !AG.reducedMotion()) { // the pixel pop: 1× → 2× → 1×, three stepped frames
        this.after(T.revealStepMs, () => set(popS));
        this.after(T.revealStepMs * 2, () => set(S));
      }
      this.after(80, () => next.focus({ preventScroll: true }));
      name.focus({ preventScroll: true });
    }

    /* ---------- 4. what should you do? ---------- */
    showQuestion() {
      const { ctx, sign } = this;
      this.go('question');
      this.clearMain();
      this.modal = new ChoiceModal(this.main, ctx, {
        eyebrow: STR.qEyebrow, ask: this.o.ask, art: AG.assets.url(sign.art) || AG.assets.placeholderURL(sign.art, 120, 120),
        options: this.o.qa.choices, seed: ctx.seed + 17,
        onWrong: () => this.react('worried'), onRight: opt => { this.react('happy', 1500); if (this.modal.tries === 1) ctx.safe(); },
        onDone: r => { this.qTries = r.tries; this.showFinale(); }
      });
      this.say(STR.qLine);
    }
    clearMain() { if (this.modal) { this.modal.destroy(); this.modal = null; } if (this.finale) { this.finale.destroy(); this.finale = null; } this.main.replaceChildren(); }

    /* ---------- 5. outdoors: which way is upwind; indoors: tell an adult ---------- */
    showFinale() {
      const { ctx } = this;
      this.go('finale');
      this.clearMain();
      if (this.sc.wind) {
        this.say(STR.windLine);
        this.finale = new SJ.Upwind(this.main, ctx, {
          sceneId: this.sc.id, tip: W.tipFor(SJ.util.hash(this.sign.id) + ctx.seed), react: (a, ms) => this.react(a, ms),
          onDone: r => { this.fTries = r.tries; this.afterFinale(r.firstTry); }
        });
      } else {
        this.say({ en: pick(this.o.home.ask) });
        this.main.append(this.sceneFigure(false));
        this.modal = new ChoiceModal(this.main, ctx, {
          eyebrow: STR.homeEyebrow, ask: this.o.home.ask, options: this.o.home.choices, seed: ctx.seed + 29,
          onWrong: () => this.react('worried'), onRight: () => { this.react('happy', 1500); if (this.modal.tries === 1) ctx.safe(); },
          onDone: r => { this.fTries = r.tries; this.afterFinale(r.firstTry); }
        });
      }
    }
    afterFinale(firstTry) {
      if (this.sc.wind && firstTry) AG.store.update('stats', s => { const g = s.symbolJigsaw = s.symbolJigsaw || {}; g.upwind = (g.upwind || 0) + 1; });
      this.showCard();
    }

    /* ---------- 6. a home safety card (bonus; one of three, by level) ---------- */
    showCard() {
      const { ctx } = this, cards = this.o.cards;
      if (!cards || !cards.length) return this.end();
      const card = cards[(this.level.level - 1) % cards.length];
      this.go('card');
      this.clearMain();
      this.say({ en: pick(card.title) + '. ' + pick(card.tip) });
      this.modal = new ChoiceModal(this.main, ctx, {
        eyebrow: { en: pick(STR.cardEyebrow) + ': ' + pick(card.title) }, ask: card.ask, options: card.choices, seed: ctx.seed + 41, skip: true,
        onWrong: () => this.react('worried'), onRight: () => { this.react('happy', 1500); },
        onDone: r => { this.cardTries = r.skipped ? 0 : r.tries; this.end(); }
      });
    }

    /* ---------- results ---------- */
    end() {
      if (this.over) return;
      const { ctx, sign } = this;
      this.clearMain();
      this.over = true;
      const timeMs = this.puzzleMs != null ? this.puzzleMs : Math.round(this.ms);
      const o = { mis: this.mis, timeMs, par: this.par, questionTries: this.qTries, finaleTries: this.fTries };
      const score = SC.points(o), stars = SC.stars(o), collectibles = SC.collectibles(o);
      let isNew = false;
      const g = AG.store.update('stats', s => {
        const q = s.symbolJigsaw = s.symbolJigsaw || {};
        q.album = q.album || []; q.upwind = q.upwind || 0;
        if (!q.album.includes(sign.id)) { q.album.push(sign.id); isNew = true; }
      }).symbolJigsaw;
      const badgeEvents = SC.badges({ album: g.album, total: this.o.signs.length, upwind: g.upwind });
      const tries = n => (n === 1 ? pick(STR.tries1) : fmt(STR.triesN, { n }));
      const detail = [
        { label: STR.dSign, value: pick(sign.name), icon: '🔍' },
        { label: this.counterLabel(), value: this.counter },
        { label: STR.dTime, value: SC.mmss(timeMs) },
        { label: STR.dQuestion, value: tries(this.qTries) },
        { label: this.sc.wind ? STR.dUpwind : STR.dHome, value: tries(this.fTries) },
        { label: STR.dAlbum, value: g.album.length + ' / ' + this.o.signs.length + (isNew ? ' ★' : ''), icon: '⭐' }
      ];
      this.doneFn({
        won: true, stars, score, timeMs, collectibles, detail,
        message: pick(stars >= 3 ? STR.msg3 : stars === 2 ? STR.msg2 : STR.msg1),
        badgeEvents, bonusXP: this.cardTries === 1 ? T.cardBonusXP : 0, delay: 200
      });
    }

    destroy() {
      this.over = true; this.timing = false;
      clearTimeout(this.reactT);
      this.timers.forEach(id => this.ctx.clear(id));
      this.offs.forEach(f => f()); this.offs = [];
      this.teardownPuzzle();
      if (this.modal) this.modal.destroy();
      if (this.finale) this.finale.destroy();
      AG.input.armCancel(false);
    }
  }

  /* ---------- the jigsaw (levels 1–4) ---------- */
  class JigsawScene extends Round {
    async prepare() {
      const { spec, sign, ctx, level } = this, n = spec.cols * spec.rows;
      const cutSeed = SJ.puzzle.cutSeed(level.seed, sign.id);
      const rots = SJ.puzzle.rotations(n, ctx.seed + 3, spec.rotate);
      AG.sfx.preload(['snap', 'bounce', 'reveal'].map(k => K + 'sfx.' + k));
      this.real = await P.jigsawPieces(sign.art, { cols: spec.cols, rows: spec.rows, seed: cutSeed, rotatable: !!spec.rotate, rot: i => rots[i] });
      this.cut = this.real[0].data.cut;
      this.decoys = [];
      if (spec.decoys && sign.decoys && sign.decoys.length) {
        const idx = SJ.puzzle.decoyIndices(n, spec.decoys, ctx.seed + 5);
        const cuts = await Promise.all(sign.decoys.map(src => P.cutJigsaw(src, { cols: spec.cols, rows: spec.rows, seed: cutSeed })));
        this.decoys = idx.map((pi, j) => {
          const q = cuts[j % cuts.length].pieces[pi];
          return new P.Piece({ id: 'decoy' + j, kind: 'image', art: q.canvas, home: -1, ox: q.ox, oy: q.oy, rotatable: false, data: { decoy: true }, label: AG.t('pieces.piece', { n: String(n + j + 1) }) });
        });
      }
      const all = this.real.concat(this.decoys);
      this.all = SJ.puzzle.order(all.length, ctx.seed + 9).map(i => all[i]);
      if (spec.ghost) {
        const rec = await AG.assets.loadImage(sign.art);
        this.guide = ditherCanvas(rec.ok ? rec.img : P.canvas(this.cut.w, this.cut.h), this.cut.w, this.cut.h, spec.ghost);
      }
    }

    startPuzzle() {
      const { ctx, spec } = this, total = spec.cols * spec.rows;
      this.board = new P.SlotBoard({ cols: spec.cols, rows: spec.rows, pw: this.cut.pw, ph: this.cut.ph, snap: T.snap, guide: this.guide || null, scale: 'auto', maxScale: T.maxScale, label: { en: 'Sign board' } });
      this.tray = new P.Tray({ pieces: this.all, maxSize: 112, label: { en: 'Pieces to place' } });
      this.play = new P.PiecePlay({
        board: this.board, tray: this.tray, undo: false,
        sfx: { pick: 'tap', place: K + 'sfx.snap', rotate: 'tap', invalid: K + 'sfx.bounce', back: 'tap' },
        onPlace: () => {
          const n = this.board.placed.size;
          this.say(STR.snap, { n, total });
          this.react('happy', 900);
          if (this.board.done) { this.play.enabled = false; this.puzzleDone(); }
        },
        onBlocked: (p, why, info) => {
          if (info && info.via !== 'drag' && this.board.pieceAt(this.play.cur)) { ctx.say('retry', pick(STR.filled)); return; } // a filled spot is not a mistake
          this.countMis(this.mis + 1);
          this.react('worried');
          const decoy = p.data && p.data.decoy;
          const msg = decoy ? STR.decoy : why === 'turn' ? STR.noTurn : STR.noSpot;
          this.say(msg); ctx.say('retry', pick(msg));
        }
      });
      this.puzzleHost.append(this.play.el);
      ctx.onPause(p => { if (p && this.play) this.play.cancelDrag(); });
      this.say(spec.decoys ? STR.pickDecoy : spec.rotate ? STR.pickRot : STR.pickFirst, { par: SC.mmss(this.par * 1000) });
      if (this.guide) this.line.append(' ' + pick(STR.ghostNote));
      this.play.focus();
    }
    teardownPuzzle() { if (this.play) { this.play.enabled = false; this.play.destroy(); this.play = null; } }
  }

  SJ.STR = STR; SJ.fmt = fmt; SJ.rich = rich; SJ.ditherCanvas = ditherCanvas;
  SJ.ChoiceModal = ChoiceModal; SJ.Round = Round; SJ.JigsawScene = JigsawScene;
})(window.AG);
