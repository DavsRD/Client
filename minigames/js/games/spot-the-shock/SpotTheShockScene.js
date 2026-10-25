/* Spot the Shock: one level. Picture A (safe) and picture B (risky) in an E2 PairedScenes, side by side in
 * landscape and stacked in portrait; the player finds every electrical hazard in B before the clock runs out.
 *   find → a ring on both pictures + the role expert's FIX CARD toast (2 s; Enter or a tap closes it; the clock
 *   waits) · L5: the FixIt chooser first (FixIt.js) · wrong tap → −3 s (Easy −1 s) and a ✖; taps 300 ms apart;
 *   3 misses in 2 s = a 2 s "Take a careful look" pause · H / 💡 hint ring · Z / 🔍 / pinch / wheel = the 2× lens
 *   · night (L4): a flashlight under the reticle or the last touch · 3 hidden ⭐ per picture.
 * ?zones=1 draws every hit zone (and ⭐) over both pictures; with it, ?pair=<id> picks a pair. Numbers: tuning.js. */
window.AG = window.AG || {};
(function (AG) {
  const { h } = AG.util;
  const ST = AG.spotTheShock, T = ST.tuning, SC = ST.scoring;
  const K = 'spot-the-shock.';
  const pick = v => AG.pick(v);
  const fmt = (t, vars) => pick(t).replace(/\{(\w+)\}/g, (_, k) => (vars[k] == null ? '' : vars[k]));
  const rich = text => AG.dialogue.renderText(text, h('span'));

  const STR = {
    spotter: { en: 'Shock Spotter' }, found: { en: 'Found' },
    picA: { en: '✔ Safe picture' }, picB: { en: '⚠ Find the hazards' },
    hint: { en: 'Hint' }, hintsLeft: { en: 'Hint, {n} left' }, zoom: { en: 'Zoom' },
    start: { en: 'Find the **{n} hazards** in the second picture. The first one is the safe way.' },
    startNight: { en: 'The power is out. Sweep your **flashlight** to find the **{n} hazards**.' },
    startFix: { en: 'Find the **{n} hazards**, then choose how to **fix** each one.' },
    found1: { en: 'Found: **{label}**!' },
    dontTouch: { en: "**Don't touch!** {label}. Stay away and tell an adult." },
    already: { en: 'You found that one already. Keep looking!' },
    miss: { en: 'Not there. Compare the two pictures slowly.' },
    star: { en: 'A hidden star! {n} of 3.' },
    lockout: { en: 'Take a careful look 👀' }, lockoutSub: { en: 'Compare the pictures, part by part.' },
    hintLine: { en: 'Look inside the flashing ring.' }, noHints: { en: 'No hints left. You can do it!' },
    cardEyebrow: { en: 'Fix card' }, ok: { en: 'OK ▶' },
    fixRight: { en: 'Fixed! {card}' },
    allFound: { en: 'You found every hazard!' },
    timeUp: { en: "Time's up!" },
    nightTalk1: { en: 'The typhoon knocked the power out. Here is a **flashlight**: move it to light up one part of the picture at a time.' },
    nightTalk2: { en: "I'll look for fallen wires and flooded plugs, and I will **never touch** one!" },
    go: { en: 'Start ▶' },
    dFound: { en: 'Hazards found' }, dWrong: { en: 'Wrong taps' }, dHints: { en: 'Hints' }, dLeft: { en: 'Time left' },
    dFixes: { en: 'Fixes on the first try' }, dStars: { en: 'Hidden stars' },
    msg3: { en: 'Sharp eyes! You spotted every hazard quickly, with no hints.' },
    msg2: { en: 'Every hazard found! For 3 stars: no hints, at most 1 wrong tap, and 40 % of the time left.' },
    msg1: { en: 'Every hazard found! Try for fewer wrong taps and hints.' },
    msgLost: { en: "Time's up! You found {n} of {total}. Look slowly, one part of the picture at a time, and try again." }
  };

  /* ---------- styles, once per page (all under #ag-app, classes sts-) ---------- */
  const CSS = `
#ag-app .sts { position: relative; display: grid; grid-template-columns: minmax(0, 1fr); gap: 8px; width: 100%; margin-inline: auto; color: var(--fg); }
#ag-app .sts-head { display: flex; align-items: flex-end; gap: 8px; }
#ag-app .sts-who { flex: none; display: flex; flex-direction: column; align-items: center; }
#ag-app .sts-who__fig { display: flex; align-items: flex-start; justify-content: center; width: 60px; height: 64px; overflow: hidden; }
#ag-app .sts-who__fig img { max-height: 64px; width: auto; }
#ag-app .sts-who__tag { margin-top: 2px; padding: 0 6px; font: 700 .75rem var(--font-display); color: #1e1538; background: #fff4cc; border: 2px solid #1e1538; white-space: nowrap; }
#ag-app .sts-bubble { flex: 1 1 auto; min-width: 0; display: grid; gap: 2px; padding: 6px 10px; color: #1e1538; background: #fff4cc; border: var(--b) solid #1e1538; box-shadow: 3px 3px 0 var(--shadow-c); }
#ag-app .sts-bubble .ag-eyebrow { color: #4a4170; }
#ag-app .sts-line { margin: 0; min-height: 2.7em; font-weight: 700; line-height: 1.35; }
#ag-app .sts-line strong, #ag-app .sts-line .rs-em { color: #6a2b00; }
#ag-app .sts strong.rs-em { display: inline; margin: 0; padding: 0; }
#ag-app .sts-tools { flex: none; display: flex; flex-direction: column; gap: 6px; }
#ag-app .sts-tool { min-width: 48px; min-height: 48px; display: inline-flex; align-items: center; justify-content: center; gap: 4px; padding: 2px 8px; font: 700 .85rem var(--font-display); }
#ag-app .sts-tool[aria-pressed="true"] { background: var(--vest); color: #1e1538; }
#ag-app .sts-tool small { font-size: .7rem; }
#ag-app .sts-tool img { image-rendering: pixelated; }
#ag-app .sts-board { position: relative; min-width: 0; }
#ag-app .sts .ags-pair--col { gap: 4px; }
#ag-app .sts .ags-pair__side { position: relative; }
/* stacked: both pictures fit under the site header, the HUD and the bubble (about 430 px on a phone) */
#ag-app .sts .ags-pair--col .ags-canvas { max-width: min(100%, max(240px, calc((100svh - 430px) * 2 / 3))) !important; }
#ag-app .sts-toast, #ag-app .sts-lock, #ag-app .sts-talk { position: absolute; left: 50%; transform: translateX(-50%); z-index: 5; box-sizing: border-box; width: min(100% - 12px, 520px); }
/* the FixIt panel and the FIX CARD sit over the safe picture A, so picture B (the drop target) stays in view */
#ag-app .sts-fixhost { position: absolute; z-index: 6; left: 3px; right: 3px; top: 3px; }
#ag-app .sts-fixhost:empty { display: none; }
#ag-app .sts-toast { bottom: 6px; display: flex; gap: 10px; align-items: center; padding: 8px 10px; color: #1e1538; background: #fffaf0; border: var(--b) solid #1e1538; box-shadow: 4px 4px 0 rgba(30, 21, 56, .55); cursor: pointer; }
#ag-app .sts-toast__who { flex: none; width: 56px; height: 60px; overflow: hidden; display: flex; justify-content: center; }
#ag-app .sts-toast__who img { max-height: 60px; width: auto; }
#ag-app .sts-toast__body { flex: 1 1 auto; min-width: 0; display: grid; gap: 2px; }
#ag-app .sts-toast__body .ag-eyebrow { color: #4a4170; }
#ag-app .sts-toast__title { margin: 0; font: 700 1rem/1.2 var(--font-display); }
#ag-app .sts-toast__text { margin: 0; font-weight: 700; line-height: 1.3; }
#ag-app .sts-toast.is-danger { border-left-width: 10px; border-left-color: #e0245e; }
#ag-app .sts-toast .ag-btn { flex: none; }
#ag-app .sts-lock { top: 40%; padding: 10px 14px; text-align: center; color: #1e1538; background: #fff4cc; border: var(--b) solid #1e1538; box-shadow: 4px 4px 0 rgba(30, 21, 56, .55); font: 700 1.2rem var(--font-display); }
#ag-app .sts-lock small { display: block; font: 700 .85rem var(--font-body, inherit); }
#ag-app .sts-talk { top: 8px; display: grid; gap: 8px; justify-items: center; padding: 10px; background: var(--panel); border: var(--b) solid var(--ink); box-shadow: 4px 4px 0 var(--shadow-c); }
#ag-app .sts-talk__box { width: 100%; }
#ag-app .sts-fix { display: grid; gap: 8px; padding: 10px; background: var(--panel); border: var(--b) solid var(--ink); box-shadow: 4px 4px 0 var(--shadow-c); }
#ag-app .sts-fix__top { display: flex; gap: 10px; align-items: center; }
#ag-app .sts-fix__who { flex: none; width: 56px; height: 60px; overflow: hidden; display: flex; justify-content: center; }
#ag-app .sts-fix__who img { max-height: 60px; width: auto; }
#ag-app .sts-fix__body { display: grid; gap: 2px; min-width: 0; }
#ag-app .sts-fix__ask { margin: 0; font: 700 1.05rem/1.3 var(--font-display); }
#ag-app .sts-fix__chips { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 8px; }
#ag-app .sts-chip { position: relative; display: flex; align-items: center; gap: 8px; min-height: 56px; padding: 6px 10px 6px 26px; text-align: left; font: 700 .95rem/1.2 var(--font-display); color: #1e1538; background: #fffaf0; border: 3px solid #1e1538; box-shadow: 3px 3px 0 var(--shadow-c); cursor: grab; touch-action: none; user-select: none; -webkit-user-select: none; }
#ag-app .sts-chip:focus-visible { outline: 3px solid var(--vest); outline-offset: 2px; }
#ag-app .sts-chip__key { position: absolute; left: 4px; top: 3px; font-size: .75rem; }
#ag-app .sts-chip img { flex: none; image-rendering: pixelated; }
#ag-app .sts-chip.dragging { opacity: .5; }
#ag-app .sts-chip.is-wrong { opacity: .55; background: #ececec; text-decoration: line-through; cursor: default; }
#ag-app .sts-chip.is-wrong::after { content: '✖'; margin-left: auto; color: #e0245e; }
#ag-app .sts-chip.is-right { background: #dff7e3; }
#ag-app .sts-chip.is-right::after { content: '✔'; margin-left: auto; color: #2f8a4a; }
#ag-app .sts canvas.hot { outline: 4px dashed var(--vest); outline-offset: -4px; }
#ag-app .sts-fix__tip { margin: 0; padding: 6px 10px; font-weight: 700; line-height: 1.35; color: #1e1538; background: #fff4cc; border: 2px solid #1e1538; border-left-width: 8px; }
#ag-app .sts [hidden] { display: none !important; }
@container (max-width: 560px) {
  #ag-app .sts-tool { width: 48px; padding: 2px; flex-direction: column; gap: 0; }
  #ag-app .sts-tool > span { display: none; }
  #ag-app .sts-who__fig { width: 48px; height: 52px; }
  #ag-app .sts-who__fig img { max-height: 52px; }
  #ag-app .sts-line { min-height: 0; font-size: .95rem; }
  #ag-app .sts-fix { gap: 4px; padding: 6px; }
  #ag-app .sts-fix__who, #ag-app .sts-toast__who { width: 40px; height: 44px; }
  #ag-app .sts-fix__who img, #ag-app .sts-toast__who img { max-height: 44px; }
  #ag-app .sts-fix__ask { font-size: .95rem; }
  #ag-app .sts-fix__chips { grid-template-columns: minmax(0, 1fr); gap: 4px; }
  #ag-app .sts-chip { min-height: 48px; padding-block: 2px; font-size: .9rem; }
  #ag-app .sts-chip img { width: 28px; height: 28px; }
  #ag-app .sts-fix__tip { padding: 4px 8px; font-size: .9rem; }
  #ag-app .sts-toast { padding: 6px 8px; gap: 6px; }
  #ag-app .sts-toast__text { font-size: .9rem; }
}`;
  function injectCss() {
    if (!document.querySelector('style[data-ag-css="spot-the-shock"]')) document.head.append(h('style', { 'data-ag-css': 'spot-the-shock' }, CSS));
  }
  const params = () => new URLSearchParams(location.search);

  class SpotTheShockScene {
    /** o: { level (a levels.json level), pair (one of its pairs), cards (data/fix-cards.json), size: [w, h] } */
    constructor(stage, ctx, done, o) {
      injectCss();
      this.stage = stage; this.ctx = ctx; this.doneFn = done; this.o = o;
      this.level = o.level; this.pairData = o.pair; this.cards = o.cards;
      this.W = o.size[0]; this.H = o.size[1];
      this.diff = ctx.difficulty === 'advanced' ? 'advanced' : 'easy';
      this.found = new Set(); this.fixed = []; this.got = [false, false, false];
      this.wrong = 0; this.hints = 0; this.fixesFirst = 0; this.hintsMax = ST.hintsAllowed(this.diff);
      this.msLeft = this.level.timeMs; this.running = false; this.busy = false; this.over = false; this.lockedUntil = 0;
      this.guard = new ST.Guard(); this.hint = null; this.offs = []; this.timers = [];
      this.reaction = null; this.shown = null;
      this.debugZones = params().get('zones') === '1';
      this.total = this.pairData.differences.length;
      this.allZones = new AG.logic.HitZones(this.pairData.differences, { w: this.W, h: this.H });
      this.starZones = new AG.logic.HitZones(this.pairData.stars.map((s, i) => Object.assign({ id: 'star' + i, shape: 'circle' }, s)), { w: this.W, h: this.H });
      this.rig = ctx.rig('portrait');
      this.build();
      this.makePair();
      this.hud = ctx.hud({ score: 0, label: STR.found, timer: true });
      this.updateHud();
      this.last = performance.now();
      this.tickId = ctx.every(100, () => this.tick());
      ctx.onPause(p => { if (p) this.pair.views.forEach(v => v.cancelGesture()); else this.last = performance.now(); });
      this.bindKeys();
      const n = this.total;
      this.say(this.level.night ? STR.startNight : this.level.fixIt ? STR.startFix : STR.start, { n });
      this.pair.views[0].ready.then(() => { if (!this.over) (this.level.night ? this.nightTalk() : this.begin()); });
    }

    /* ---------- layout ---------- */
    build() {
      const { ctx } = this;
      this.fig = h('div', { class: 'sts-who__fig' });
      const who = h('div', { class: 'sts-who', 'aria-hidden': 'true' }, this.fig, h('span', { class: 'sts-who__tag' }, AG.chars.get(ctx.characterId).name));
      this.line = h('p', { class: 'sts-line', role: 'status', 'aria-live': 'polite' });
      const bubble = h('div', { class: 'sts-bubble' }, h('span', { class: 'ag-eyebrow' }, '⚡ ' + pick(STR.spotter)), this.line);
      this.hintCount = h('small');
      this.hintBtn = h('button', { type: 'button', class: 'ag-btn ag-btn--alt sts-tool', 'aria-label': pick(STR.hint), 'aria-keyshortcuts': 'H' },
        AG.ui.icon('bulb', 24), h('span', {}, pick(STR.hint)), this.hintCount);
      this.zoomBtn = h('button', { type: 'button', class: 'ag-btn ag-btn--alt sts-tool', 'aria-label': pick(STR.zoom), 'aria-pressed': 'false', 'aria-keyshortcuts': 'Z' },
        h('img', { src: AG.pixelIcon('🔍', 24), width: 24, height: 24, alt: '', draggable: 'false' }), h('span', {}, pick(STR.zoom)));
      this.hintBtn.addEventListener('click', () => this.useHint());
      this.zoomBtn.addEventListener('click', () => this.setLens(!this.lens));
      this.board = h('div', { class: 'sts-board' });
      this.fixHost = h('div', { class: 'sts-fixhost' });
      this.root = h('div', { class: 'sts' + (this.level.night ? ' sts--night' : '') },
        h('div', { class: 'sts-head' }, who, bubble, h('div', { class: 'sts-tools' }, this.hintBtn, this.zoomBtn)),
        this.board);
      this.stage.append(this.root);
      this.renderMe();
    }
    makePair() {
      const P = this.pairData, night = this.level.night;
      const side = s => (night ? [{ src: P.night[s] }, { draw: (c, t, v) => this.drawBeam(c, v, P[s]) }] : P[s]);
      this.pair = new AG.scenetap.PairedScenes({
        a: side('a'), b: side('b'), w: this.W, h: this.H, zones: P.differences, mode: 'reticle', layout: 'auto',
        zooms: [1], dragMode: 'aim', tolerance: T.tolerance[this.diff],
        reticle: { art: K + 'ui.reticle' }, markerArt: { found: K + 'ui.found_ring' },
        labels: [STR.picA, STR.picB], magnifier: { size: T.lens.size, zoom: T.lens.zoom, enabled: false },
        flashlight: night ? { r: T.beamR, alpha: T.darkAlpha } : null,
        onPick: (zone, info) => this.onPick(zone, info), onMiss: info => this.onMiss(info),
        drawWorld: (c, v, t, s) => this.drawWorld(c, v, s), drawScreen: (c, v, t, s) => this.drawScreen(c, v, s)
      });
      this.pair.enabled = false;
      this.board.append(this.pair.el);
      this.sideA = this.pair.sides[0];
      this.sideA.append(this.fixHost);
      this.lens = false;
      this.bindGestures();
      if (AG.debug.on) ST.live = { scene: this };   // ?debug=1: scripted checks
    }
    say(text, vars) { this.line.replaceChildren(rich({ en: fmt(text, vars || {}) })); }
    after(ms, fn) { const id = this.ctx.after(ms, () => { if (!this.over) fn(); }); this.timers.push(id); return id; }

    /* ---------- the player's portrait: think while searching ---------- */
    renderMe() {
      const a = this.reaction || (this.over && this.found.size === this.total ? 'cheer' : this.running ? 'think' : 'idle');
      if (a === this.shown) return;
      this.shown = a; this.rig.play(a);
      this.fig.replaceChildren(this.rig.img(1));
    }
    react(action, ms) {
      this.reaction = action; this.renderMe();
      clearTimeout(this.reactT);
      this.reactT = setTimeout(() => { this.reaction = null; this.renderMe(); }, ms || T.reactMs);
    }

    /* ---------- start ---------- */
    nightTalk() {
      const { ctx } = this, ex = ctx.expertId;
      const box = h('div', { class: 'sts-talk__box' }), go = h('button', { type: 'button', class: 'ag-btn' }, pick(STR.go));
      const talk = h('div', { class: 'sts-talk', role: 'dialog', 'aria-label': pick(STR.go) }, box, go);
      let started = false;
      // deferred, so the Enter that presses Start doesn't also check the reticle's spot
      const start = () => { if (started) return; started = true; talk.remove(); setTimeout(() => this.begin(), 0); };
      go.addEventListener('click', start);
      this.board.append(talk);
      AG.dialogue.conversation(box, [
        { speaker: ex, text: STR.nightTalk1, pose: AG.rig.resolve(ex, 'hold:flashlight').frame },
        { speaker: ctx.characterId, text: STR.nightTalk2 }
      ], { typewriter: AG.store.setting('typewriter') !== false && !AG.reducedMotion() });
      this.offs.push(() => talk.remove());
      setTimeout(() => go.focus({ preventScroll: true }), 30);
    }
    begin() {
      if (this.over) return;
      this.running = true; this.last = performance.now();
      this.pair.enabled = true;
      this.renderMe();
      this.stage.focus({ preventScroll: true });
    }

    /* ---------- the clock ---------- */
    tick() {
      const now = performance.now(), dt = Math.min(400, now - this.last);
      this.last = now;
      if (!this.running || this.busy || this.over) return;
      this.msLeft = Math.max(0, this.msLeft - dt);
      this.updateHud();
      if (this.msLeft <= 0) this.finish(false);
    }
    score() { return SC.points({ found: this.found.size, msLeft: 0, hints: this.hints, wrong: this.wrong, fixes: this.fixesFirst }); }
    updateHud() {
      this.hud.set({ score: this.score(), label: this.found.size + '/' + this.total, timer: ST.mmss(this.msLeft) });
      const left = this.hintsMax - this.hints;
      const limited = Number.isFinite(this.hintsMax);
      this.hintCount.textContent = limited ? '×' + left : '';
      this.hintBtn.setAttribute('aria-label', limited ? fmt(STR.hintsLeft, { n: left }) : pick(STR.hint));
      this.hintBtn.disabled = left <= 0;
    }

    /* ---------- keys and gestures beyond the engine's ---------- */
    bindKeys() {
      const I = AG.input;
      I.register('ZOOM', { keys: ['KeyZ'], button: { en: 'Zoom' } });
      this.offs.push(I.on('ZOOM', e => { if (e.phase === 'down' && this.canAct()) this.setLens(!this.lens); }));
      this.offs.push(I.on('HINT', e => { if (e.phase === 'down') this.useHint(); }));
      this.offs.push(I.on('CONFIRM', e => { if (e.phase === 'down' && this.toast && performance.now() - this.toast.t0 > T.cardGuardMs) this.closeCard(); }));
    }
    /** Pinch out / in and the mouse wheel turn the lens on / off (the engine owns the canvas pointers; this only watches). */
    bindGestures() {
      const el = this.pair.el, pts = new Map();
      let d0 = 0;
      const dist = () => { const [a, b] = [...pts.values()]; return Math.hypot(a.x - b.x, a.y - b.y); };
      const on = (t, fn, o) => { el.addEventListener(t, fn, o); this.offs.push(() => el.removeEventListener(t, fn, o)); };
      // a pointer on the other picture makes it the active one, so the shared reticle follows the hover, drag or tap
      const sideOf = e => this.pair.sides.indexOf(e.target.closest('.ags-pair__side'));
      const claim = (e, quiet) => { const i = sideOf(e); if (i >= 0 && i !== this.pair.active && this.pair.enabled) this.pair.switchTo(i, false, quiet); };
      on('pointerdown', e => {
        claim(e, false);
        if (e.pointerType === 'mouse') return;
        pts.set(e.pointerId, { x: e.clientX, y: e.clientY }); if (pts.size === 2) d0 = dist();
      });
      on('pointermove', e => {
        if (e.pointerType === 'mouse' && !e.buttons) claim(e, true);
        if (!pts.has(e.pointerId)) return;
        pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (pts.size !== 2 || !d0) return;
        const r = dist() / d0;
        if (r >= 1.25 || r <= 0.8) { if (this.canAct()) this.setLens(r > 1); d0 = dist(); }
      });
      const up = e => { pts.delete(e.pointerId); if (pts.size < 2) d0 = 0; };
      on('pointerup', up); on('pointercancel', up);
      on('wheel', e => {
        if (!this.canAct() || !e.deltaY) return;
        const want = e.deltaY < 0;
        if (want !== this.lens) { e.preventDefault(); this.setLens(want); }
      }, { passive: false });
    }
    canAct() { return this.running && !this.over && !AG.paused; }
    setLens(on) {
      if (this.over) return;
      this.lens = !!on;
      this.pair.views.forEach(v => { if (v.magnifier) v.magnifier.enabled = this.lens; });
      this.zoomBtn.setAttribute('aria-pressed', String(this.lens));
      this.pair.view.announce(AG.t('scenetap.zoomed', { k: this.lens ? T.lens.zoom : 1 }));
      AG.sfx.play('tap');
    }

    /* ---------- checks ---------- */
    onPick(zone, info) {
      if (!this.running || this.busy || this.over) return;
      if (!this.guard.accept(performance.now())) return;
      const d = zone.data, card = this.cards.hazards[d.hazard] || { label: { en: d.hazard }, card: { en: '' } };
      this.found.add(zone.id);
      this.pair.zones.enable(zone.id, false);
      this.pair.mark(zone);
      if (this.hint && this.hint.id === zone.id) this.hint = null;
      this.updateHud();
      this.pair.view.announce(fmt(STR.found1, { label: pick(card.label) }).replace(/\*\*/g, ''));
      if (card.powerLine) {
        AG.sfx.play(K + 'sfx.zap');
        this.react('worried', 500);
        this.after(500, () => this.react('stop', T.stopMs));
        this.say(STR.dontTouch, { label: pick(card.label) });
      } else {
        AG.sfx.play(K + 'sfx.found');
        this.react('happy');
        this.say(STR.found1, { label: pick(card.label) });
      }
      if (this.level.fixIt) this.openFix(zone, card);
      else this.showCard(card, card.card);
    }
    onMiss(info) {
      if (!this.running || this.busy || this.over) return;
      const now = performance.now();
      if (!this.guard.accept(now)) return;
      const tol = info.view.tolFor(info.device), p = info.point;
      const old = this.allZones.hitTest(p, tol);
      if (old && this.found.has(old.id)) { this.say(STR.already); return; } // a found spot again is never a mistake
      const star = this.starZones.hitTest(p, tol);
      if (star && !this.got[+star.id.slice(4)]) { this.collect(+star.id.slice(4)); return; }
      this.wrong++;
      this.msLeft = Math.max(0, this.msLeft - T.wrongMs[this.diff]);
      this.pair.mark(p, 'miss');
      AG.kit.shake(this.pair.sides[this.pair.active]);
      AG.sfx.play(K + 'sfx.wrong');
      this.say(STR.miss);
      this.updateHud();
      const cr = info.view.cv.getBoundingClientRect(), sr = this.stage.getBoundingClientRect();
      AG.kit.pop(this.stage, cr.left - sr.left + cr.width * p.x, cr.top - sr.top + cr.height * p.y, '−' + T.wrongMs[this.diff] / 1000 + ' s', false);
      if (this.msLeft <= 0) { this.finish(false); return; }
      if (this.guard.wrong(now)) this.lockout();
    }
    lockout() {
      this.pair.enabled = false;
      const box = h('div', { class: 'sts-lock', role: 'status' }, pick(STR.lockout), h('small', {}, pick(STR.lockoutSub)));
      this.board.append(box);
      this.say(STR.lockoutSub);
      this.lockBox = box;
      this.after(T.guard.lockMs, () => { box.remove(); this.lockBox = null; if (!this.busy) this.pair.enabled = true; });
    }
    collect(i) {
      this.got[i] = true;
      AG.sfx.play('collect');
      this.say(STR.star, { n: this.got.filter(Boolean).length });
      this.pair.view.announce(fmt(STR.star, { n: this.got.filter(Boolean).length }));
    }

    /* ---------- the FIX CARD toast: the role expert explains, the clock waits ---------- */
    showCard(card, text) {
      const ex = this.ctx.expertId;
      this.busy = true; this.pair.enabled = false;
      const ok = h('button', { type: 'button', class: 'ag-btn ag-btn--small' }, pick(STR.ok));
      const el = h('div', { class: 'sts-toast' + (card.powerLine ? ' is-danger' : ''), role: 'status', 'aria-live': 'assertive' },
        h('div', { class: 'sts-toast__who', 'aria-hidden': 'true' }, AG.chars.img(ex, AG.rig.resolve(ex, 'point').frame, 1)),
        h('div', { class: 'sts-toast__body' },
          h('span', { class: 'ag-eyebrow' }, (card.powerLine ? '⚠ ' : '💡 ') + pick(STR.cardEyebrow) + ' · ' + AG.chars.get(ex).name),
          h('p', { class: 'sts-toast__title' }, pick(card.label)),
          h('p', { class: 'sts-toast__text' }, pick(text))),
        ok);
      // a tap that chose the fix ends in a click on the card that just opened under the finger: not a close
      el.addEventListener('click', () => { if (this.toast && performance.now() - this.toast.t0 > T.cardGuardMs) this.closeCard(); });
      this.sideA.append(el);
      this.toast = { el, t0: performance.now(), id: this.after(T.cardMs, () => this.closeCard()) };
      this.learned = (this.learned || []).concat(card.card);
    }
    closeCard() {
      const t = this.toast; if (!t) return;
      this.toast = null;
      this.ctx.clear(t.id); t.el.remove();
      this.busy = false;
      if (this.found.size === this.total) { this.finish(true); return; }
      if (!this.lockBox) this.pair.enabled = true;
      this.stage.focus({ preventScroll: true });
    }

    /* ---------- level 5: choose the fix ---------- */
    openFix(zone, card) {
      this.busy = true; this.pair.enabled = false;
      this.fix = new ST.FixIt(this.fixHost, this.ctx, {
        zone, cards: this.cards, targets: this.pair.views.map(v => v.cv),
        onWrong: () => this.react('worried'),
        onRight: first => {
          if (first) this.fixesFirst++;
          this.fixed.push(zone.data.hazard);
          this.fix = null;
          AG.sfx.play(K + 'sfx.fixed');
          this.react('happy');
          this.updateHud();
          this.showCard(card, fmt(STR.fixRight, { card: pick(card.card) }));
        }
      });
      this.stage.focus({ preventScroll: true });
    }

    /* ---------- hints ---------- */
    useHint() {
      if (!this.canAct() || this.busy || this.lockBox) return;
      if (this.hints >= this.hintsMax) { this.say(STR.noHints); return; }
      const unfound = this.pair.zones.zones.filter(z => !this.found.has(z.id));
      const z = ST.pickHint(unfound, this.hints);
      if (!z) return;
      this.hints++;
      this.hint = { id: z.id, zone: z, at: this.pair.zones.centre(z), t0: performance.now(), R: ST.hintRadius(z, this.W, this.H) };
      this.after(T.hint.ms, () => { if (this.hint && this.hint.zone === z) this.hint = null; });
      AG.sfx.play(K + 'sfx.hint');
      this.say(STR.hintLine);
      this.updateHud();
    }

    /* ---------- drawing hooks (PairedScenes) ---------- */
    /** Night: the day picture shows through inside the beam; the dark night picture is around it. */
    drawBeam(c, v, dayKey) {
      const rec = AG.assets.image(dayKey); if (!rec.ok) return;
      const R = T.beamR, D = R * 2;
      if (!this.beam) {
        const px = AG.scenetap.px;
        this.beam = px.mkCanvas(D, D); this.beamMask = px.mkCanvas(D, D);
        const m = this.beamMask.getContext('2d'); m.fillStyle = '#000';
        for (let y = 0; y < D; y++) for (let x = 0; x < D; x++) if (Math.hypot(x + 0.5 - R, y + 0.5 - R) <= R) m.fillRect(x, y, 1, 1);
      }
      const g = this.beam.getContext('2d'), ax = Math.round(v.aim.x), ay = Math.round(v.aim.y);
      g.globalCompositeOperation = 'source-over'; g.clearRect(0, 0, D, D);
      g.drawImage(rec.img, ax - R, ay - R, D, D, 0, 0, D, D);
      g.globalCompositeOperation = 'destination-in'; g.drawImage(this.beamMask, 0, 0);
      g.globalCompositeOperation = 'source-over';
      c.drawImage(this.beam, ax - R, ay - R);
    }
    drawWorld(c, v, side) {
      if (!this.pair) return; // the views draw once while PairedScenes is still being built
      // one reticle: the other picture follows it (the engine draws its faint ghost there), so its lens and light do too
      const a = this.pair.view;
      if (v !== a) { v.reticle.x = a.reticle.x / a.W * v.W; v.reticle.y = a.reticle.y / a.H * v.H; v.aimPt = { x: v.reticle.x, y: v.reticle.y }; }
      v.ret.hidden = v !== a;
      if (side === 'b') this.fixed.forEach(hz => AG.assets.draw(c, K + 'fix.' + this.pairData.id + '_' + hz, 0, 0, this.W, this.H));
      const star = AG.pixelIcon('⭐', T.starPx, true), S = T.starPx;
      this.pairData.stars.forEach((s, i) => {
        if (this.got[i]) return;
        const x = s.x * this.W, y = s.y * this.H;
        if (this.level.night && Math.hypot(x - v.aim.x, y - v.aim.y) > T.beamR) return; // hidden stars show only in the light
        c.drawImage(star, Math.round(x - S / 2), Math.round(y - S / 2), S, S);
      });
    }
    drawScreen(c, v) {
      if (!this.pair) return;
      const px = AG.scenetap.px;
      if (this.hint) {
        const el = performance.now() - this.hint.t0, slot = T.hint.ms / (T.hint.flashes * 2);
        if (AG.reducedMotion() || Math.floor(el / slot) % 2 === 0) {
          const s = v.cam.normToScreen(this.hint.at.x, this.hint.at.y), pts = px.ringPoints(Math.round(s.x), Math.round(s.y), this.hint.R);
          px.stamp(c, pts, 4, px.INK); px.stamp(c, pts, 2, '#ffd23f');
        }
      }
      if (this.debugZones) {
        this.allZones.zones.forEach(z => px.strokeZone(c, z, v.cam, this.found.has(z.id) ? px.SAFE : px.DANGER));
        this.starZones.zones.forEach(z => px.strokeZone(c, z, v.cam, '#ffd23f'));
      }
    }

    /* ---------- the end ---------- */
    finish(won) {
      if (this.over) return;
      this.over = true; this.running = false;
      this.pair.enabled = false;
      if (this.fix) { this.fix.destroy(); this.fix = null; }
      const all = this.found.size === this.total;
      won = won && all;
      const o = { found: this.found.size, msLeft: won ? this.msLeft : 0, hints: this.hints, wrong: this.wrong, fixes: this.fixesFirst, allFound: all, timeMs: this.level.timeMs };
      const score = SC.points(o), stars = won ? SC.stars(o) : 0;
      let events = [];
      AG.store.update('stats', s => {
        const q = s.spotTheShock = s.spotTheShock || {};
        events = SC.badges(q, { level: this.level.level, won, wrong: this.wrong, fixIt: !!this.level.fixIt, fixesFirst: this.fixesFirst, fixTotal: this.total });
      });
      this.renderMe();
      if (won) { this.react('cheer', 3000); this.say(STR.allFound); AG.kit.celebrate(this.stage); }
      else { this.say(STR.timeUp); AG.kit.banner(this.stage, STR.timeUp, null, 1400); }
      const detail = [
        { label: STR.dFound, value: this.found.size + ' / ' + this.total, icon: '🔍' },
        { label: STR.dWrong, value: String(this.wrong) },
        { label: STR.dHints, value: String(this.hints), icon: '💡' },
        { label: STR.dLeft, value: ST.mmss(o.msLeft) }
      ];
      if (this.level.fixIt) detail.push({ label: STR.dFixes, value: this.fixesFirst + ' / ' + this.found.size, icon: '🔌' });
      detail.push({ label: STR.dStars, value: this.got.filter(Boolean).length + ' / 3', icon: '⭐' });
      this.doneFn({
        won, stars, score, timeMs: this.level.timeMs - this.msLeft, collectibles: SC.collectibles(this.got), detail,
        message: won ? pick(stars >= 3 ? STR.msg3 : stars === 2 ? STR.msg2 : STR.msg1) : fmt(STR.msgLost, { n: this.found.size, total: this.total }),
        learned: this.learned && this.learned.length ? this.learned.slice(0, 4) : null,
        badgeEvents: events, delay: won ? 1200 : 1500
      });
    }

    destroy() {
      this.over = true; this.running = false;
      clearTimeout(this.reactT);
      this.ctx.clear(this.tickId);
      this.timers.forEach(id => this.ctx.clear(id));
      this.offs.forEach(f => f()); this.offs = [];
      if (this.fix) this.fix.destroy();
      this.pair.destroy();
      if (ST.live && ST.live.scene === this) ST.live = null;
    }
  }

  ST.STR = STR;
  ST.SpotTheShockScene = SpotTheShockScene;
})(window.AG);
