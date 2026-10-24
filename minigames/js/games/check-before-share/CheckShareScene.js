/* Check Before You Share: the scene every level plays in.
 *
 *   const scene = new AG.checkShare.Scene(stage, ctx, done, data)
 *
 * The player's portrait above the card stack (think while a card is up, happy when right,
 * worried when wrong; a bust on phones), the CALM METER beside it, the two side labels, the
 * SwipeStack and its ✋ / ✔ buttons. After each swipe the role expert explains in their word
 * box; the deck waits 1.5 s or until Enter. Calm below 20 brings a "take a breath" card that
 * refills it to 50 (and caps the 3rd star). World 5 times every card: a timeout counts as
 * "check first". After the last card comes the feelings check-in, then done().
 *
 * Keys: → / D right, ← / A left (the stack's own LEFT / RIGHT), Enter skips the explanation,
 * 1–4 answer the check-in. Touch / mouse: drag or fling the card, or tap ✋ / ✔. */
window.AG = window.AG || {};
(function (AG) {
  const { h } = AG.util;
  const CS = AG.checkShare, T = CS.tuning, R = CS.rules;
  const S = (en, fil) => ({ en, fil });
  const pick = v => AG.pick(v);

  const STR = {
    score: S('Score', 'Puntos'),
    cards: S('Card', 'Card'),
    calm: S('Calm', 'Kalmado'),
    right: { message: S('Follow / Share', 'Sundin / Ibahagi'), action: S('Do it', 'Gawin') },
    left: { message: S("Check first — don't share", 'Suriin muna — huwag ibahagi'), action: S("Don't", 'Huwag') },
    good: { followed: S('✔ Trusted source', '✔ Mapagkakatiwalaan'), checked: S('✋ Good check!', '✋ Magaling na pagsuri!'), safe: S('✔ Safe choice', '✔ Ligtas na pasya'), unsafe: S("✋ Right, don't!", '✋ Tama, huwag!') },
    oops: S("Let's think again", 'Pag-isipan natin ulit'),
    clues: S('Rumour clues: {c}.', 'Palatandaan ng tsismis: {c}.'),
    wasRumour: S('That was a rumour. Clues: {c}.', 'Tsismis iyon. Palatandaan: {c}.'),
    rejected: S("That was from {src} — it's important to follow official news.", 'Galing iyon sa {src} — mahalagang sundin ang opisyal na balita.'),
    unsafe: S("That one isn't safe.", 'Hindi ligtas iyon.'),
    safeAct: S('That one is safe to do!', 'Ligtas gawin iyon!'),
    timeUp: S("Time's up, so it counts as Check first.", 'Ubos ang oras, kaya Suriin muna ang bilang.'),
    breathTitle: S("Let's take a breath 🫁", 'Huminga muna tayo 🫁'),
    breathSteps: [S('Breathe in slowly… 1, 2, 3', 'Huminga nang dahan-dahan… 1, 2, 3'), S('Breathe out slowly… 1, 2, 3', 'Ibuga nang dahan-dahan… 1, 2, 3')],
    breathTip: S("It's okay to feel worried. Slow breaths help. Stay with your family.", 'Okay lang mag-alala. Nakatutulong ang mabagal na paghinga. Manatili sa pamilya.'),
    breathBtn: S('I feel calmer ✔', 'Mas kalmado na ako ✔'),
    accuracy: S('Correct', 'Tama'),
    calmEnd: S('Calm at the end', 'Kalmado sa dulo'),
    speed: S('Speed bonus', 'Bonus sa bilis'),
    breaths: S('Breathing breaks', 'Pahinga sa paghinga'),
    msgPerfect: S('Every message checked, and a calm household!', 'Nasuri ang bawat mensahe, at kalmado ang buong bahay!'),
    msgGood: S('Great checking! Look for the rumour clues to do even better.', 'Magaling na pagsuri! Hanapin ang palatandaan ng tsismis para mas gumaling pa.'),
    msgTry: S("Good try! Check who sent each message, then try again.", 'Magaling na subok! Alamin kung sino ang nagpadala ng bawat mensahe, saka subukan ulit.')
  };

  /* ---------- styles, once per page (all under #ag-app, classes cbs-) ---------- */
  const CSS = `
#ag-app .cbs { position: relative; display: grid; gap: 10px; justify-items: center; padding: 12px 8px 4px; font-variant-ligatures: none; font-feature-settings: 'liga' 0, 'clig' 0; isolation: isolate; }
#ag-app .cbs::before { content: ""; position: absolute; inset: 0; z-index: -1; background: var(--cbs-bg) center / cover no-repeat; image-rendering: pixelated; opacity: .35; border-radius: var(--r); }
#ag-app .cbs-top { display: flex; align-items: flex-end; justify-content: center; gap: 16px; width: min(420px, 100%); }
#ag-app .cbs-who { display: flex; flex-direction: column; align-items: center; flex: none; }
#ag-app .cbs-who__fig { position: relative; display: flex; align-items: flex-end; justify-content: center; }
#ag-app .cbs-who__fig .ag-charimg { display: block; }
#ag-app .cbs-who__prop { position: absolute; bottom: 4px; right: -14px; }
#ag-app .cbs-who__tag { margin-top: 2px; padding: 0 6px; font-family: var(--font-display); font-size: .75rem; font-weight: 700; color: #1e1538; background: #fff4cc; border: 2px solid #1e1538; white-space: nowrap; }
#ag-app .cbs-calm { flex: 1 1 auto; display: grid; gap: 4px; min-width: 0; padding: 8px 10px 10px; color: #1e1538; background: #fff4cc; border: var(--b) solid #1e1538; box-shadow: 3px 3px 0 var(--shadow-c); }
#ag-app .cbs-calm__row { display: flex; justify-content: space-between; align-items: baseline; font-family: var(--font-display); font-weight: 700; }
#ag-app .cbs-calm__row b { font-size: 1.25rem; font-variant-numeric: tabular-nums; }
#ag-app .cbs-meter { position: relative; width: 192px; max-width: 100%; height: 30px; margin-top: 12px; background: var(--cbs-meter) 0 0 / 100% 100% no-repeat; image-rendering: pixelated; }
#ag-app .cbs-meter > i { position: absolute; top: 6px; bottom: 6px; right: 6px; background: #1e1538; }
#ag-app .cbs-meter__mark { position: absolute; top: -13px; transform: translateX(-50%); font-size: 11px; line-height: 1; }
#ag-app .cbs-meter__mark--low { color: var(--alert); }
#ag-app .cbs-meter__mark--ok { color: var(--safe); }
#ag-app .cbs-calm.is-low { background: #ffe0e6; }
#ag-app .cbs-calm.is-low .cbs-calm__row b::before { content: "▲ "; font-size: .8em; color: var(--alert); }
#ag-app .cbs-sides { display: flex; justify-content: space-between; gap: 8px; width: min(380px, 100%); }
#ag-app .cbs-side { padding: 2px 8px; font-family: var(--font-display); font-weight: 700; font-size: .85rem; color: #1e1538; border: 2px solid #1e1538; }
#ag-app .cbs-side--left { background: #ffe3d1; }
#ag-app .cbs-side--right { background: #dff7e3; text-align: right; }
#ag-app .cbs-deck { position: relative; width: 100%; display: grid; justify-items: center; }
#ag-app .cbs-deck .agc-swipe { --agc-swipe-h: 272px; gap: 14px; }
#ag-app .cbs-deck .agc-swipe__deck { width: min(360px, 100%); }
#ag-app .cbs-deck .agc-swipecard { padding: 0; }
#ag-app .cbs-deck .agc-swipe__btn { min-width: 150px; }
#ag-app .cbs-deck .agc-swipe__btn--left { white-space: normal; max-width: 200px; }

/* cards: fixed papers with ink text, so they read in all five themes */
#ag-app .cbs-card { position: relative; box-sizing: border-box; width: 100%; height: 100%; display: flex; flex-direction: column; gap: 8px; padding: 14px 16px; text-align: left; color: #1e1538; background: #fff8e1; border: 16px solid #1e1538; border-image: var(--cbs-frame) 8 fill / 16px stretch; image-rendering: pixelated; }
#ag-app .cbs-card > * { image-rendering: auto; }
#ag-app .cbs-card .ag-px { image-rendering: pixelated; }
#ag-app .cbs-card__head { display: flex; align-items: center; gap: 8px; min-height: 48px; }
#ag-app .cbs-card__who { display: grid; gap: 2px; min-width: 0; }
#ag-app .cbs-card__src { font-family: var(--font-display); font-size: 1rem; line-height: 1.15; }
#ag-app .cbs-card__fwd { justify-self: start; padding: 0 6px; font-size: .75rem; font-weight: 800; color: #1e1538; background: #e3defa; border: 2px dashed #1e1538; }
#ag-app .cbs-card__text { margin: 0; font-size: 1.05rem; line-height: 1.35; font-weight: 700; overflow-wrap: anywhere; }
#ag-app .cbs-card--radio .cbs-card__text { padding-right: 76px; }
#ag-app .cbs-card__host { position: absolute; right: 4px; bottom: 0; height: 80px; overflow: hidden; display: flex; align-items: flex-start; pointer-events: none; }
#ag-app .cbs-card__host .ag-charimg { width: auto; height: 104px; }
#ag-app .cbs-card__host .ag-charimg.is-agila { height: 80px; }
#ag-app .cbs-card__prop { position: absolute; left: -10px; bottom: 6px; }
#ag-app .cbs-card__star { position: absolute; top: -6px; right: -6px; }
#ag-app .cbs-card--action { align-items: center; justify-content: center; text-align: center; background: #eef3ff; border-color: #1e1538; border-image: none; border-width: var(--b); }
#ag-app .cbs-card__eyebrow { font-family: var(--font-display); font-size: .85rem; text-transform: uppercase; letter-spacing: .06em; color: #4a4170; }
#ag-app .cbs-card__icon { width: 72px; height: 72px; }
#ag-app .cbs-card--action .cbs-card__text { font-size: 1.2rem; }
#ag-app.ag-bigtext .cbs-card__text { font-size: 1.2rem; }

/* the breathing card, over the deck */
#ag-app .cbs-breath { position: absolute; inset: 0 0 auto; z-index: 40; margin: 0 auto; width: min(360px, 100%); height: 272px; box-sizing: border-box; display: grid; align-content: center; justify-items: center; gap: 10px; padding: 16px; text-align: center; color: #1e1538; background: #dff1ff; border: var(--b) solid #1e1538; box-shadow: 6px 6px 0 var(--shadow-c); }
#ag-app .cbs-breath h3 { margin: 0; font-family: var(--font-display); font-size: 1.3rem; }
#ag-app .cbs-breath p { margin: 0; font-weight: 700; }
#ag-app .cbs-breath__lungs { width: 72px; height: 72px; transition: transform 1.6s steps(4); }
#ag-app .cbs-breath.is-in .cbs-breath__lungs { transform: scale(1.25); }

/* the feelings check-in */
#ag-app .cbs-feel { display: grid; gap: 10px; justify-items: center; width: min(520px, 100%); padding: 14px; color: #1e1538; background: #fff8e1; border: var(--b) solid #1e1538; box-shadow: 6px 6px 0 var(--shadow-c); }
#ag-app .cbs-feel__ask { margin: 0; font-family: var(--font-display); font-size: 1.35rem; }
#ag-app .cbs-feel__note { margin: 0; font-size: .9rem; color: #4a4170; text-align: center; }
#ag-app .cbs-feel__row { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; width: 100%; }
#ag-app .cbs-feel__btn { position: relative; display: grid; justify-items: center; gap: 4px; min-height: 88px; padding: 8px 4px; font: inherit; font-weight: 800; color: #1e1538; background: #ffffff; border: var(--b) solid #1e1538; box-shadow: 3px 3px 0 var(--shadow-c); cursor: pointer; }
#ag-app .cbs-feel__btn[aria-pressed="true"] { background: #dff7e3; border-width: 4px; transform: translate(-2px, -2px); box-shadow: 5px 5px 0 var(--shadow-c); }
#ag-app .cbs-feel__btn[aria-pressed="true"]::after { content: "✔"; position: absolute; top: -10px; right: -10px; display: grid; place-items: center; width: 24px; height: 24px; font-size: 14px; color: #fff; background: var(--safe); border: 2px solid #1e1538; }
#ag-app .cbs-feel__btn:focus-visible { outline: 4px solid var(--vest); outline-offset: 2px; }
#ag-app .cbs-feel__key { position: absolute; top: 2px; left: 4px; font-family: var(--font-display); font-size: .75rem; color: #4a4170; }
#ag-app .cbs-feel__reply { width: 100%; }
#ag-app .cbs-feel__reply:empty { display: none; }

@container (max-width: 520px) {
  #ag-app .cbs { padding: 6px 0 0; gap: 8px; }
  #ag-app .cbs-top { gap: 10px; }
  #ag-app .cbs-who { flex-direction: row; gap: 6px; align-items: flex-end; }
  #ag-app .cbs-who__fig { height: 64px; overflow: hidden; align-items: flex-start; }
  #ag-app .cbs-meter { width: 128px; height: 20px; margin-top: 10px; }
  #ag-app .cbs-meter > i { top: 4px; bottom: 4px; right: 4px; }
  #ag-app .cbs-deck .agc-swipe { --agc-swipe-h: 256px; }
  #ag-app .cbs-card { padding: 10px 12px; }
  #ag-app .cbs-card__text { font-size: 1rem; }
  #ag-app .cbs-deck .agc-swipe__btns { gap: 10px; }
  #ag-app .cbs-deck .agc-swipe__btn { min-width: 0; flex: 1 1 0; }
  #ag-app .cbs-breath { height: 256px; }
  #ag-app .cbs-feel__row { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
@media (prefers-reduced-motion: reduce) {
  #ag-app .cbs-breath__lungs { transition: none; }
}`;
  function injectCss() {
    if (!document.querySelector('style[data-ag-css="check-before-share"]')) document.head.append(h('style', { 'data-ag-css': 'check-before-share' }, CSS));
  }
  const cssUrl = u => (u ? 'url("' + u + '")' : 'none');
  const fill = (spec, vars) => {
    const f = (s, l) => s.replace(/\{(\w+)\}/g, (_, k) => { const v = vars[k]; return v == null ? '' : typeof v === 'object' ? (v[l] || v.en) : String(v); });
    return { en: f(spec.en, 'en'), fil: f(spec.fil || spec.en, 'fil') };
  };
  const join = (...parts) => ({ en: parts.filter(Boolean).map(p => p.en).join(' '), fil: parts.filter(Boolean).map(p => p.fil || p.en).join(' ') });

  class Scene {
    constructor(stage, ctx, done, data) {
      injectCss();
      this.stage = stage; this.ctx = ctx; this.doneFn = done; this.data = data;
      this.level = ctx.levelData || { cards: [] };
      this.rnd = AG.util.mulberry32(ctx.seed);
      this.calm = T.calm.start; this.minCalm = this.calm; this.breaths = 0;
      this.correct = 0; this.answered = 0; this.speed = 0; this.ended = false;
      this.collect = [false, false, false];
      this.offs = []; this.timer = null; this.waiting = null; this.t0 = performance.now();
      this.seconds = R.timerFor(this.level, ctx.difficulty);

      const levelCards = (this.level.cards || []).map(id => data.cards.find(c => c.id === id)).filter(Boolean);
      this.golden = R.golden(levelCards, this.rnd);
      this.deck = new CS.Deck(data, { world: ctx.world, expertId: ctx.expertId, golden: new Set(this.golden) });
      this.total = levelCards.length;

      // the player, above the stack
      this.rig = ctx.rig('portrait');
      this.base = 'think'; this.reaction = null; this.shown = ''; this.reactT = null;
      this.fig = h('div', { class: 'cbs-who__fig' });
      this.tag = h('span', { class: 'cbs-who__tag' });
      this.who = h('div', { class: 'cbs-who', 'aria-hidden': 'true' }, this.fig, this.tag);

      // the calm meter: the pack's gradient bar, an ink cover over the empty part, ▲ at 20 and ● at 70
      this.calmNum = h('b');
      this.calmLabel = h('span');
      this.meterCover = h('i');
      this.meter = h('div', { class: 'cbs-meter', role: 'meter', 'aria-valuemin': 0, 'aria-valuemax': 100 },
        this.meterCover,
        h('span', { class: 'cbs-meter__mark cbs-meter__mark--low', style: { left: T.calm.low + '%' }, 'aria-hidden': 'true' }, '▲'),
        h('span', { class: 'cbs-meter__mark cbs-meter__mark--ok', style: { left: T.calm.start + '%' }, 'aria-hidden': 'true' }, '●'));
      this.calmBox = h('div', { class: 'cbs-calm' }, h('div', { class: 'cbs-calm__row' }, this.calmLabel, this.calmNum), this.meter);
      this.top = h('div', { class: 'cbs-top' }, this.who, this.calmBox);

      // the two sides, always on screen (the stack's buttons carry them too)
      this.sideL = h('span', { class: 'cbs-side cbs-side--left', 'aria-hidden': 'true' });
      this.sideR = h('span', { class: 'cbs-side cbs-side--right', 'aria-hidden': 'true' });
      this.sides = h('div', { class: 'cbs-sides' }, this.sideL, this.sideR);

      const self = this;
      this.stack = new AG.cards.SwipeStack({
        cards: this.deck.cards(this.level, this.rnd),
        stage,
        labels: {
          get left() { return { text: self.sideText('left'), icon: '✋' }; },
          get right() { return { text: self.sideText('right'), icon: '✔' }; }
        },
        onCommit: (card, dir, o) => this.onCommit(card, dir, o),
        onEmpty: () => this.checkIn()
      });
      this.deckEl = h('div', { class: 'cbs-deck' }, this.stack.el);
      this.el = h('div', { class: 'cbs' }, this.top, this.sides, this.deckEl);
      this.el.style.setProperty('--cbs-bg', cssUrl(this.assetUrl('check-before-share.bg.home')));
      this.el.style.setProperty('--cbs-meter', cssUrl(this.assetUrl('check-before-share.ui.calm_meter')));
      stage.append(this.el);

      this.hud = ctx.hud({ score: 0, scoreLabel: STR.score, label: STR.cards });
      this.updateHud();

      // Enter skips the explanation (only Enter: Space would also press a focused button)
      AG.input.register('SKIP', { keys: ['Enter', 'NumpadEnter'] });
      this.offs.push(AG.input.on('SKIP', e => { if (e.phase === 'down' && this.waiting) this.waiting(); }));
      this.offs.push(AG.on('kalasag:languagechange', () => this.relabel()));
      AG.sfx.preload(['check-before-share.sfx.correct', 'check-before-share.sfx.wrong', 'check-before-share.sfx.swipe', 'check-before-share.sfx.message', 'check-before-share.sfx.breathe']);

      this.relabel();
      this.renderPlayer();
      this.startCard();
    }

    assetUrl(key) { const u = AG.assets.url(key); if (!u) AG.assets.image(key); return u; }
    get topType() { const t = this.stack && this.stack.top; return t && t.data.type === 'action' ? 'action' : 'message'; }
    dropTimer() { if (this.timer) { this.timer.destroy(); this.timer.el.remove(); this.timer = null; } }
    sideText(dir) { return STR[dir][this.topType]; }

    /* ---------- characters ---------- */
    renderPlayer() {
      const action = this.reaction || this.base;
      if (action === this.shown) return;
      this.shown = action;
      this.rig.play(action);
      const r = this.rig.info(performance.now() / 1000);
      this.fig.replaceChildren(this.rig.img(1), r.icon ? AG.ui.icon(r.icon, 36, '', 'cbs-who__prop') : '');
      this.tag.textContent = AG.chars.get(this.ctx.characterId).name;
    }
    react(action, ms) {
      clearTimeout(this.reactT);
      this.reaction = action; this.renderPlayer();
      this.reactT = setTimeout(() => { this.reaction = null; this.renderPlayer(); }, ms || T.reactMs);
    }

    /* ---------- HUD, meter and labels ---------- */
    updateHud() {
      this.hud.set({ score: R.points({ correct: this.correct, calm: this.calm, speed: this.speed }), label: Math.min(this.answered + 1, this.total) + ' / ' + this.total });
      this.calmNum.textContent = this.calm;
      this.meterCover.style.width = 'calc((100% - 12px) * ' + ((100 - this.calm) / 100).toFixed(2) + ')';
      this.meter.setAttribute('aria-valuenow', this.calm);
      this.meter.setAttribute('aria-label', pick(STR.calm) + ' ' + this.calm);
      this.calmBox.classList.toggle('is-low', this.calm < T.calm.low);
    }
    relabel() {
      this.calmLabel.textContent = pick(STR.calm);
      this.sideL.textContent = '← ✋ ' + pick(this.sideText('left'));
      this.sideR.textContent = pick(this.sideText('right')) + ' ✔ →';
      this.hud.el.querySelector('.ag-stat small').textContent = pick(STR.score);
      this.hud.el.querySelector('.ag-stat:nth-child(2) small').textContent = pick(STR.cards);
      this.deck.relabel(this.el);
      this.stack.relabel();
      if (this.breath) this.breath.relabel();
      if (this.feelings && this.feelings.relabel) this.feelings.relabel();
      this.updateHud();
    }

    /* ---------- one card ---------- */
    /** The top card is up: think, the side labels, and (World 5) its own timer. */
    startCard() {
      if (this.ended || !this.stack.top) return;
      this.base = 'think'; this.renderPlayer();
      this.relabel();
      AG.sfx.play('check-before-share.sfx.message');
      if (this.seconds) {
        this.dropTimer();
        this.timer = new AG.cards.Timer({ seconds: this.seconds, warnAt: 2, onEnd: () => { this.timedOut = true; this.stack.commit('left', 'game'); } });
        this.hud.el.append(this.timer.el);
        this.timer.start();
      }
    }

    onCommit(card, dir, o) {
      const c = card.data, v = R.judge(c, dir), timeout = o.via === 'game' && this.timedOut;
      this.timedOut = false;
      let left = 0;
      if (this.timer) { this.timer.stop(); left = this.timer.left; }
      this.answered++;
      if (v.correct) {
        this.correct++;
        if (this.seconds) this.speed += R.speedPoints(left);
        this.ctx.safe();
        const gi = this.golden.indexOf(c.id);
        if (gi >= 0 && dir === 'right' && !this.collect[gi]) { this.collect[gi] = true; AG.sfx.play('star'); }
        AG.sfx.play('check-before-share.sfx.correct');
        this.react('happy');
      } else {
        AG.sfx.play('check-before-share.sfx.wrong');
        this.react('worried', 1400);
      }
      const after = R.calmAfter(this.calm, v.delta);
      this.calm = after.calm; this.minCalm = Math.min(this.minCalm, this.calm);
      this.updateHud();
      this.explain(c, v, timeout);
      // the deck waits for the explanation (1.5 s or Enter), then a breath if calm ran low
      return this.wait(T.explainMs).then(() => (after.low && !this.ended ? this.takeBreath() : null)).then(() => {
        // resolve after this event turn, so the Enter that skipped can't also press a focused ✔ / ✋
        return new Promise(r => setTimeout(r, 0));
      }).then(() => setTimeout(() => this.startCard(), 0));
    }
    /** Resolves after ms (game time) or when Enter is pressed. */
    wait(ms) {
      return new Promise(resolve => {
        let id = null;
        const go = () => { this.waiting = null; if (id != null) this.ctx.clear(id); resolve(); };
        this.waiting = go;
        id = this.ctx.after(ms, go);
      });
    }
    /** The role expert explains the swipe in their word box. */
    explain(c, v, timeout) {
      const clues = this.deck.clueText(c), src = this.deck.source(c);
      let title, text;
      if (c.type === 'action') {
        title = v.correct ? STR.good[c.safe ? 'safe' : 'unsafe'] : STR.oops;
        text = v.correct ? c.explain : join(c.safe ? STR.safeAct : STR.unsafe, c.explain);
      } else if (c.trusted) {
        title = v.correct ? STR.good.followed : STR.oops;
        text = v.correct ? c.explain : join(fill(STR.rejected, { src: src.name }), c.explain);
      } else {
        title = v.correct ? STR.good.checked : STR.oops;
        text = join(fill(v.correct ? STR.clues : STR.wasRumour, { c: clues }), c.explain);
      }
      if (timeout) text = join(STR.timeUp, text);
      this.ctx.say(v.correct ? 'success' : 'retry', text, { speaker: this.ctx.expertId, title: pick(title), sound: false, ms: T.boxMs });
    }

    /* ---------- calm below 20: the breathing card ---------- */
    takeBreath() {
      this.breaths++;
      this.stack.lock();
      AG.sfx.play('check-before-share.sfx.breathe');
      const txt = CS.txt;
      const step = txt('p', 'cbs-breath__step', () => STR.breathSteps[this.breathStep || 0]);
      const btn = h('button', { type: 'button', class: 'ag-btn' }); btn.append(txt('span', '', STR.breathBtn));
      const el = h('div', { class: 'cbs-breath', role: 'dialog', 'aria-label': pick(STR.breathTitle) },
        txt('h3', '', STR.breathTitle),
        h('img', { class: 'ag-px cbs-breath__lungs', src: AG.pixelIcon('🫁', 36), alt: '', width: 72, height: 72 }),
        step, txt('p', 'cbs-breath__tip', STR.breathTip), btn);
      this.deckEl.append(el);
      this.base = 'idle'; this.renderPlayer();
      this.breathStep = 0;
      const tick = () => { this.breathStep = 1 - this.breathStep; el.classList.toggle('is-in', this.breathStep === 0); this.deck.relabel(el); };
      el.classList.add('is-in');
      const iv = AG.reducedMotion() ? null : this.ctx.every(T.breathMs / 2, tick);
      this.breath = { relabel: () => this.deck.relabel(el) };
      setTimeout(() => btn.focus({ preventScroll: true }), 50);
      return new Promise(resolve => {
        btn.addEventListener('click', () => {
          if (iv != null) this.ctx.clear(iv);
          el.remove(); this.breath = null;
          this.calm = Math.max(this.calm, T.calm.refill);
          this.updateHud();
          this.stack.unlock();
          this.stage.focus({ preventScroll: true });
          AG.sfx.play('good');
          resolve();
        }, { once: true });
      });
    }

    /* ---------- the end of the level ---------- */
    checkIn() {
      if (this.ended) return;
      this.dropTimer();
      this.base = 'idle'; this.renderPlayer();
      this.sides.hidden = true;
      this.feelings = new CS.Feelings(this, { onDone: () => this.finish() });
      this.deckEl.replaceChildren(this.feelings.el);
      this.hud.set({ label: this.total + ' / ' + this.total });
      setTimeout(() => { this.feelings.focus(); this.feelings.el.scrollIntoView({ block: 'center' }); }, 50);
    }

    finish() {
      if (this.ended) return;
      this.ended = true;
      clearTimeout(this.reactT);
      const o = { correct: this.correct, total: this.total, calm: this.calm, minCalm: this.minCalm };
      const stars = R.stars(o), won = stars > 0;
      const score = R.points({ correct: this.correct, calm: this.calm, speed: this.speed });
      const detail = [
        { label: STR.accuracy, value: this.correct + ' / ' + this.total + ' (' + R.accuracy(this.correct, this.total) + '%)' },
        { label: STR.calmEnd, value: this.calm }
      ];
      if (this.seconds) detail.push({ label: STR.speed, value: '+' + this.speed });
      if (this.breaths) detail.push({ label: STR.breaths, value: this.breaths });
      this.hud.set({ score });
      this.base = won ? 'happy' : 'think'; this.reaction = null; this.renderPlayer();
      this.doneFn({
        won, stars, score, timeMs: Math.round(performance.now() - this.t0),
        collectibles: this.collect.slice(), detail,
        message: stars === 3 ? STR.msgPerfect : won ? STR.msgGood : STR.msgTry,
        badgeEvents: this.badgeEvents(stars)
      });
    }
    /** fact-checker (100 right answers), calm-household (5 levels ending at calm ≥ 90),
     *  source-sleuth (every World 2 level at 3 stars). Counted in stats.checkShare. */
    badgeEvents(stars) {
      const ev = [], { gameId, world, level } = this.ctx;
      if (this.ctx.mode !== 'stage') return ev;
      const key = world + '-' + level, calmOk = this.calm >= T.badges.calmAt;
      const st = AG.store.update('stats', s => {
        const c = s.checkShare = s.checkShare || { correct: 0, calm: [] };
        c.correct = (c.correct || 0) + this.correct;
        c.calm = c.calm || [];
        if (calmOk && !c.calm.includes(key)) c.calm.push(key);
      }).checkShare;
      if (st.correct >= T.badges.factChecker) ev.push('fact-checker');
      if (st.calm.length >= T.badges.calmLevels) ev.push('calm-household');
      if (world === 2 && stars === 3 && [1, 2, 3, 4, 5].every(l => l === level || ((AG.progress.level(gameId, 2, l) || {}).stars || 0) >= 3)) ev.push('source-sleuth');
      return ev;
    }

    destroy() {
      this.ended = true;
      clearTimeout(this.reactT);
      this.offs.forEach(f => f());
      this.dropTimer();
      if (this.feelings) this.feelings.destroy();
      this.stack.destroy();
    }
  }

  CS.Scene = Scene;
  CS.STR = STR;
})(window.AG);
