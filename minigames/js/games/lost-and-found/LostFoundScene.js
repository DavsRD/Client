/* Lost & Found: one level, phase by phase.
 *   1 STOP & STAY (phases/StopStay.js) → 2 FIND A SAFE HELPER (phases/HelperSearch.js, the E2 SceneView)
 *   → 3 TELL THE HELPER (phases/TellHelper.js: the PRACTICE CARD, the name, the number pad, the call)
 *   → a SAFE CHOICES card read by the role expert → results.
 * LostFoundScene holds the run (points, pets, the player's portrait and speech line); ChoiceModal is the 3-choice
 * question both phase 1 and the name use (a wrong pick explains, then shows the right answer to pick). */
window.AG = window.AG || {};
(function (AG) {
  const { h } = AG.util;
  const LF = AG.lostFound, T = LF.tuning, SC = LF.scoring;
  const K = 'lost-and-found.';
  const pick = v => AG.pick(v);
  const fmt = (t, vars) => pick(t).replace(/\{(\w+)\}/g, (_, k) => (vars[k] == null ? '' : vars[k]));
  const rich = text => AG.dialogue.renderText(text, h('span'));

  const STR = {
    eyebrow: { en: 'Mall Mission' }, helpers: { en: 'Helpers' },
    cont: { en: 'Continue ▶' }, safeIs: { en: 'The safe choice is: **{text}**.' }, pickIt: { en: 'Pick it to go on.' },
    safeEyebrow: { en: 'Safe Choices · read by {name}' },
    dStop: { en: 'Stop & stay' }, dFirst: { en: 'First try' }, dLater: { en: 'Second try' },
    dHelpers: { en: 'Helpers found' }, dLeft: { en: 'Time left' }, dName: { en: 'Name' }, dDigits: { en: 'Number digits' },
    dPets: { en: 'Lost pets' }, yes: { en: '✔' }, no: { en: 'Later' },
    msg3: { en: 'You stopped, found safe helpers fast, and remembered the whole practice number!' },
    msg2: { en: 'Great mission! For 3 stars: stop and stay on the first try, find helpers fast, and get every digit.' },
    msg1: { en: 'You made it back to your family! Play again to find the helpers faster and remember the card.' },
    note: { en: "Practise your real parent's phone number at home, offline — never type it into a website." }
  };

  /* ---------- styles, once per page (all under #ag-app, classes lf-) ---------- */
  const CSS = `
#ag-app .lf { position: relative; display: grid; grid-template-columns: minmax(0, 1fr); gap: 8px; width: 100%; margin-inline: auto; color: var(--fg); }
#ag-app .lf-head { display: flex; align-items: flex-end; gap: 8px; }
#ag-app .lf-who { flex: none; display: flex; flex-direction: column; align-items: center; }
#ag-app .lf-who__fig { display: flex; align-items: flex-start; justify-content: center; width: 60px; height: 64px; overflow: hidden; }
#ag-app .lf-who__fig img { max-height: 64px; width: auto; }
#ag-app .lf-who__tag { margin-top: 2px; padding: 0 6px; font: 700 .75rem var(--font-display); color: #1e1538; background: #fff4cc; border: 2px solid #1e1538; white-space: nowrap; }
#ag-app .lf-bubble { flex: 1 1 auto; min-width: 0; display: grid; gap: 2px; padding: 6px 10px; color: #1e1538; background: #fff4cc; border: var(--b) solid #1e1538; box-shadow: 3px 3px 0 var(--shadow-c); }
#ag-app .lf-bubble .ag-eyebrow { color: #4a4170; }
#ag-app .lf-line { margin: 0; min-height: 2.7em; font-weight: 700; line-height: 1.35; }
#ag-app .lf-line strong { color: #6a2b00; }
#ag-app .lf-board { position: relative; min-width: 0; display: grid; grid-template-columns: minmax(0, 1fr); gap: 8px; justify-items: center; }
#ag-app .lf-panel { width: min(100%, 660px); box-sizing: border-box; display: grid; gap: 10px; padding: 12px; background: var(--panel); border: var(--b) solid var(--ink); box-shadow: var(--sh) var(--sh) 0 var(--shadow-c); }
#ag-app .lf-panel .ag-eyebrow { color: var(--muted, inherit); }
#ag-app .lf-modal__top { display: flex; align-items: center; gap: 12px; }
#ag-app .lf-art { flex: none; display: block; image-rendering: pixelated; border: 3px solid #1e1538; background: #fff; }
#ag-app .lf-modal__ask { margin: 0; font: 700 1.2rem/1.3 var(--font-display); }
#ag-app .lf-panel .ag-choices { grid-template-columns: minmax(0, 1fr); }
#ag-app .lf-panel .ag-choice.is-hint { outline: 4px dashed var(--vest); outline-offset: 2px; background: var(--safe-soft); }
#ag-app .lf-panel .ag-choice.wrong::after { content: '✖'; margin-left: auto; color: #e0245e; text-decoration: none; }
#ag-app .lf-panel .ag-choice.right::after { content: '✔'; margin-left: auto; color: #2f8a4a; }
#ag-app .lf-why { margin: 0; padding: 8px 12px; font-weight: 700; line-height: 1.35; color: #1e1538; background: #fff4cc; border: 2px solid #1e1538; border-left-width: 8px; }
#ag-app .lf-why strong { color: #6a2b00; }
#ag-app .lf-actions { display: flex; flex-wrap: wrap; gap: 10px; justify-content: center; }
#ag-app .lf-expert { display: flex; align-items: center; gap: 10px; }
#ag-app .lf-expert__fig { flex: none; position: relative; width: 64px; height: 68px; overflow: hidden; display: flex; justify-content: center; }
#ag-app .lf-expert__fig img { max-height: 68px; width: auto; }
#ag-app .lf-expert__prop { position: absolute; right: 0; bottom: 4px; }
#ag-app .lf-expert__body { display: grid; gap: 2px; min-width: 0; }
#ag-app .lf-tag { justify-self: start; padding: 0 6px; font: 700 .8rem var(--font-display); color: #1e1538; background: #dff1ff; border: 2px solid #1e1538; }
#ag-app .lf-say { margin: 0; font: 700 1.05rem/1.3 var(--font-display); }
#ag-app .lf [hidden] { display: none !important; }
/* phase 2: the list of helpers to find, over the scene */
#ag-app .lf-search { width: 100%; display: grid; grid-template-columns: minmax(0, 1fr); gap: 6px; }
#ag-app .lf-find { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: 6px; justify-content: center; }
#ag-app .lf-find__chip { display: flex; align-items: center; gap: 6px; padding: 3px 8px; font: 700 .85rem/1.1 var(--font-display); color: #1e1538; background: #fffaf0; border: 3px solid #1e1538; box-shadow: 2px 2px 0 var(--shadow-c); }
#ag-app .lf-find__art { display: block; image-rendering: pixelated; }
#ag-app .lf-find__mark { min-width: 1.2em; text-align: center; font-size: 1rem; color: #4a4170; }
#ag-app .lf-find__chip.is-found { background: #dff7e3; }
#ag-app .lf-find__chip.is-found .lf-find__mark { color: #2f8a4a; }
#ag-app .lf-search__view { position: relative; min-width: 0; }
/* phase 3: the info desk */
#ag-app .lf-tell__fig { flex: none; }
#ag-app .lf-tell__body { display: grid; gap: 10px; justify-items: center; min-width: 0; }
#ag-app .lf-tell__body > .lf-panel { box-shadow: none; border-width: 2px; }
#ag-app .lf-cardwrap { display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: 10px; }
#ag-app .lf-card { display: block; width: 320px; max-width: 100%; height: auto; image-rendering: pixelated; box-shadow: 4px 4px 0 var(--shadow-c); }
#ag-app .lf-numwrap { display: grid; gap: 8px; justify-items: center; width: 100%; }
#ag-app .lf-help { margin: 0; font-size: .9rem; text-align: center; }
#ag-app .lf-num { display: flex; align-items: center; gap: 6px; font: 700 1.6rem var(--font-display); }
#ag-app .lf-num__pre { padding-right: 4px; }
#ag-app .lf-slot { position: relative; display: inline-grid; place-items: center; width: 40px; height: 48px; color: #1e1538; background: #fffaf0; border: 3px solid #1e1538; }
#ag-app .lf-slot.is-next { outline: 3px dashed var(--vest); outline-offset: 2px; }
#ag-app .lf-slot.is-right { background: #dff7e3; }
#ag-app .lf-slot.is-wrong { background: #ffe4ea; }
#ag-app .lf-slot.is-right::after, #ag-app .lf-slot.is-wrong::after { position: absolute; top: -10px; right: -8px; font-size: .8rem; line-height: 1; padding: 1px 2px; background: #fffaf0; border: 2px solid #1e1538; }
#ag-app .lf-slot.is-right::after { content: '✔'; color: #2f8a4a; }
#ag-app .lf-slot.is-wrong::after { content: '✖'; color: #e0245e; }
#ag-app .lf-pad { display: grid; grid-template-columns: repeat(3, 64px); gap: 6px; }
#ag-app .lf-pad__key { min-width: 64px; min-height: 52px; padding: 0; font: 700 1.3rem var(--font-display); }
#ag-app .lf-pad__ok:not(:disabled) { background: var(--safe-soft); }
#ag-app .lf-family { display: grid; gap: 8px; justify-items: center; }
@container (max-width: 560px) {
  #ag-app .lf-who__fig { width: 48px; height: 52px; }
  #ag-app .lf-who__fig img { max-height: 52px; }
  #ag-app .lf-line { min-height: 0; font-size: .95rem; }
  #ag-app .lf-panel { padding: 8px; gap: 8px; }
  #ag-app .lf-modal__top { flex-direction: column; text-align: center; }
  #ag-app .lf-modal__ask { font-size: 1.05rem; }
  #ag-app .lf-find__chip { padding: 2px 6px; font-size: .78rem; }
  #ag-app .lf-num { font-size: 1.25rem; gap: 4px; }
  #ag-app .lf-slot { width: 34px; height: 42px; }
  #ag-app .lf-family__art { width: 240px !important; height: auto !important; }
}`;
  function injectCss() {
    if (!document.querySelector('style[data-ag-css="lost-and-found"]')) document.head.append(h('style', { 'data-ag-css': 'lost-and-found' }, CSS));
  }

  /** A pixel-art asset on its own canvas at a whole scale (the placeholder if it is missing). */
  function artCanvas(key, scale, cls) {
    const cv = h('canvas', { class: 'ag-px ' + (cls || 'lf-art'), 'aria-hidden': 'true' });
    AG.assets.loadImage(key).then(rec => {
      const w = rec.frameW || rec.w || 160, hh = rec.h || 90;
      cv.width = w; cv.height = hh;
      cv.style.width = w * scale + 'px'; cv.style.height = hh * scale + 'px';
      const c = cv.getContext('2d'); c.imageSmoothingEnabled = false;
      AG.assets.draw(c, key, 0, 0, w, hh);
    });
    return cv;
  }
  /** The role expert's figure in an action (AGILA has no prop frames: the prop's icon stands beside her). */
  function expertFigure(id, action) {
    const r = AG.rig.resolve(id, action);
    return h('div', { class: 'lf-expert__fig', 'aria-hidden': 'true' }, AG.chars.img(id, r.frame, 1),
      r.icon ? h('img', { class: 'lf-expert__prop ag-px', src: AG.icons.names().includes(r.icon) ? AG.icons.src(r.icon) : AG.pixelIcon('📻', 24), width: 24, height: 24, alt: '' }) : null);
  }
  /** Clicks right after a panel opens are the end of the tap that opened it (a ghost click), not a choice.
   *  Only pointer clicks (detail > 0) are held back; Enter / Space and number keys always count. */
  const GHOST_MS = 350;
  const ghost = (e, t0) => e && e.detail > 0 && performance.now() - t0 < GHOST_MS;
  function guardClicks(btns, t0) { btns.forEach(b => b.addEventListener('click', e => { if (ghost(e, t0())) e.stopImmediatePropagation(); }, true)); }

  /* ---------- ChoiceModal: 3 choices; wrong → why + the safe choice shown, the player picks it ---------- */
  class ChoiceModal {
    /** o: { eyebrow, ask, art (asset key), artScale, options: [{ text, ok, why }], seed, then, reveal ('… {text}'), onWrong(opt), onRight(opt, firstTry), onDone({ firstTry, tries }) } */
    constructor(host, ctx, o) {
      this.o = o; this.ctx = ctx; this.tries = 0; this.settled = false; this.offs = []; this.t0 = performance.now();
      const opts = this.opts = o.seed != null ? LF.shuffled(o.options, o.seed) : o.options.slice();
      this.kit = AG.kit.choices(opts.map(x => ({ text: x.text })), (opt, i) => this.pick(i), { label: o.ask });
      guardClicks(this.kit.btns, () => this.t0);
      this.why = h('p', { class: 'lf-why', role: 'status', 'aria-live': 'polite', hidden: true });
      this.cont = h('button', { type: 'button', class: 'ag-btn', hidden: true }, pick(STR.cont));
      this.cont.addEventListener('click', e => { if (!ghost(e, this.tRight)) this.finish(); });
      const id = 'lf-ask-' + Math.random().toString(36).slice(2, 7);
      this.el = h('section', { class: 'lf-panel lf-modal', 'aria-labelledby': id },
        o.eyebrow ? h('span', { class: 'ag-eyebrow' }, pick(o.eyebrow)) : null,
        h('div', { class: 'lf-modal__top' }, o.art ? artCanvas(o.art, o.artScale || 1) : null, o.who || null,
          h('h3', { class: 'lf-modal__ask', id }, pick(o.ask))),
        this.kit.el, this.why, h('div', { class: 'lf-actions' }, this.cont));
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
    pick(i) {
      if (this.settled) return;
      const opt = this.opts[i];
      this.tries++;
      this.why.hidden = false;
      if (!opt.ok) {
        // gentle: why it is not the best, then the safe choice is shown; the other wrong ones step aside
        const ri = this.opts.findIndex(x => x.ok);
        this.opts.forEach((x, j) => { if (!x.ok) this.kit.mark(j, false); });
        this.kit.btns[ri].classList.add('is-hint');
        this.why.replaceChildren(rich({ en: pick(opt.why) + ' ' + (this.o.then ? pick(this.o.then) + ' ' : '') + fmt(this.o.reveal || STR.safeIs, { text: pick(this.opts[ri].text) }) + ' ' + pick(STR.pickIt) }));
        AG.sfx.play('soft');
        if (this.o.onWrong) this.o.onWrong(opt);
        this.t0 = performance.now();
        this.focusChoice(0);
        return;
      }
      this.settled = true; this.tRight = performance.now();
      this.kit.btns[i].classList.remove('is-hint');
      this.kit.mark(i, true); this.kit.lock();
      this.why.replaceChildren(rich(opt.why));
      this.cont.hidden = false;
      AG.sfx.play('good');
      if (this.o.onRight) this.o.onRight(opt, this.tries === 1);
      this.timer = setTimeout(() => this.cont.focus({ preventScroll: true }), 60);
    }
    finish() {
      if (this.done) return; this.done = true;
      this.o.onDone({ tries: this.tries, firstTry: this.tries === 1 });
    }
    destroy() { clearTimeout(this.timer); this.offs.forEach(f => f()); this.offs = []; this.kit.destroy(); this.el.remove(); }
  }

  /* ---------- the level ---------- */
  class LostFoundScene {
    /** o: { level (levels.json), scene (scenes.json entry), safe (data/safe-choices.json), names (data/practice-names.json), plays } */
    constructor(stage, ctx, done, o) {
      injectCss();
      this.stage = stage; this.ctx = ctx; this.doneFn = done; this.o = o;
      this.level = o.level; this.sceneData = o.scene; this.safe = o.safe;
      this.diff = ctx.difficulty === 'advanced' ? 'advanced' : 'easy';
      this.find = this.level.find[this.diff];
      this.timeMs = T.searchMs[this.diff];
      this.seed = (ctx.seed >>> 0) + (o.plays || 0) * 7919;
      this.run = { stopFirst: false, found: 0, msLeft: 0, digits: 0, nameFirst: false, pets: [false, false, false], safeFirst: false };
      this.max = SC.max({ helpers: this.find.length, timeMs: this.timeMs });
      this.over = false; this.offs = []; this.phase = null; this.reaction = null; this.shown = null; this.base = 'worried';
      this.rig = ctx.rig('portrait');
      this.build();
      this.hud = ctx.hud({ score: 0, label: STR.helpers, timer: true });
      this.updateHud(this.timeMs);
      ctx.onPause(p => { if (this.phase && this.phase.onPause) this.phase.onPause(p); });
      if (AG.debug.on) LF.live = { scene: this };   // ?debug=1: scripted checks
      this.next(new LF.StopStay(this));
    }

    build() {
      const { ctx } = this;
      this.fig = h('div', { class: 'lf-who__fig' });
      const who = h('div', { class: 'lf-who', 'aria-hidden': 'true' }, this.fig, h('span', { class: 'lf-who__tag' }, AG.chars.get(ctx.characterId).name));
      this.line = h('p', { class: 'lf-line', role: 'status', 'aria-live': 'polite' });
      this.board = h('div', { class: 'lf-board' });
      this.root = h('div', { class: 'lf' },
        h('div', { class: 'lf-head' }, who, h('div', { class: 'lf-bubble' }, h('span', { class: 'ag-eyebrow' }, '🔍 ' + pick(STR.eyebrow) + ' · ' + pick(this.level.place)), this.line)),
        this.board);
      this.stage.append(this.root);
      this.renderMe();
    }
    /** The player's own speech line (the bubble beside their portrait). */
    say(text, vars) { this.line.replaceChildren(rich({ en: fmt(text, vars || {}) })); }
    /* the portrait: a base pose per phase, and short reactions */
    setMe(action) { this.base = action; this.renderMe(); }
    renderMe() {
      const a = this.reaction || this.base;
      if (a === this.shown) return;
      this.shown = a; this.rig.play(a);
      this.fig.replaceChildren(this.rig.img(1));
    }
    react(action, ms) {
      this.reaction = action; this.renderMe();
      clearTimeout(this.reactT);
      this.reactT = setTimeout(() => { this.reaction = null; this.renderMe(); }, ms || T.reactMs);
    }
    score() { return SC.points(this.run); }
    updateHud(msLeft) {
      const v = { score: this.score(), label: this.run.found + '/' + this.find.length };
      if (msLeft != null) v.timer = LF.mmss(msLeft);
      this.hud.set(v);
    }
    /** Ends the current phase and starts the next one (or the end). */
    next(phase) {
      if (this.over) return;
      if (this.phase) this.phase.destroy();
      this.board.replaceChildren();
      this.phase = phase;
      if (phase) phase.start();
      this.stage.focus({ preventScroll: true });
    }

    /* ---------- the Safe Choices card: the role expert reads it, between this level and the next ---------- */
    safeCard() {
      const ctx = this.ctx, ex = ctx.expertId, cards = this.safe.cards;
      const card = LF.pickCard(cards, this.level.level, this.o.plays);
      const panel = h('section', { class: 'lf-panel lf-safe' });
      const cont = h('button', { type: 'button', class: 'ag-btn', hidden: true }, pick(STR.cont));
      let t0 = performance.now(), tDone = 0;
      const sc = new AG.scenetap.ScenarioCard({
        ctx, art: K + 'card.' + card.art, title: card.title, text: card.text, maxScale: 2,
        choices: LF.shuffled(card.choices, this.seed + 3).map(c => ({ text: c.text, ok: c.ok, why: c.why, feedback: { type: 'info', text: c.why } })),
        onAnswer: (c, i, res) => { if (!res.ok) { AG.sfx.play('soft'); this.react('think'); } },
        onDone: (c, res) => {
          this.run.safeFirst = res.firstTry; tDone = performance.now();
          AG.sfx.play('good'); this.react('happy');
          cont.hidden = false;
          setTimeout(() => cont.focus({ preventScroll: true }), 60);
        }
      });
      // a ghost click from the tap that closed the last panel must not answer the card
      guardClicks(sc.kit.btns, () => t0);
      cont.addEventListener('click', e => { if (!ghost(e, tDone)) this.finish(); });
      panel.append(h('div', { class: 'lf-expert' }, expertFigure(ex, 'point'),
        h('div', { class: 'lf-expert__body' }, h('span', { class: 'ag-eyebrow' }, fmt(STR.safeEyebrow, { name: AG.chars.get(ex).name })))),
        sc.el, h('div', { class: 'lf-actions' }, cont));
      this.board.append(panel);
      this.safeUI = sc;
      this.offs.push(() => sc.destroy());
      for (const [a, d] of [['UP', -1], ['DOWN', 1]]) this.offs.push(AG.input.on(a, e => {
        if (e.phase !== 'down' || sc.done) return;
        const l = sc.kit.btns.filter(b => !b.disabled), cur = l.indexOf(document.activeElement);
        const n = l[cur < 0 ? (d > 0 ? 0 : l.length - 1) : (cur + d + l.length) % l.length]; if (n) n.focus({ preventScroll: true });
      }));
      setTimeout(() => { t0 = performance.now(); sc.focus(); }, 80);
    }

    /* ---------- the end ---------- */
    finish() {
      if (this.over) return;
      this.over = true;
      const run = this.run, stars = SC.stars(run, this.max), score = SC.points(run);
      let events = [];
      AG.store.update('stats', s => { events = SC.badges(s.lostFound = s.lostFound || {}, run); });
      const allInTime = run.found === this.find.length && run.msLeft > 0;
      this.doneFn({
        won: true, stars, score, timeMs: this.timeMs - run.msLeft, collectibles: SC.collectibles(run.pets),
        detail: [
          { label: STR.dStop, value: pick(run.stopFirst ? STR.dFirst : STR.dLater), icon: '✋' },
          { label: STR.dHelpers, value: run.found + ' / ' + this.find.length, icon: '🔍' },
          { label: STR.dLeft, value: allInTime ? LF.mmss(run.msLeft) : '0:00' },
          { label: STR.dName, value: pick(run.nameFirst ? STR.yes : STR.no) },
          { label: STR.dDigits, value: run.digits + ' / ' + T.digits, icon: '📞' },
          { label: STR.dPets, value: run.pets.filter(Boolean).length + ' / 3', icon: '🐾' }
        ],
        message: pick(stars >= 3 ? STR.msg3 : stars === 2 ? STR.msg2 : STR.msg1),
        note: STR.note,
        badgeEvents: events, bonusXP: run.safeFirst ? T.safeBonusXP : 0, delay: 300
      });
    }

    destroy() {
      this.over = true;
      clearTimeout(this.reactT);
      if (this.phase) this.phase.destroy();
      this.phase = null;
      this.offs.forEach(f => f()); this.offs = [];
      if (LF.live && LF.live.scene === this) LF.live = null;
    }
  }

  Object.assign(LF, { STR, ChoiceModal, LostFoundScene, artCanvas, expertFigure, GHOST_MS, ghost, guardClicks, fmt, rich });
})(window.AG);
