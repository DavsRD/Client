/* Pest Patrol Match: the shared scene every mode plays in.
 *
 *   const scene = new AG.pestPatrol.Scene(stage, ctx, done, data)
 *
 * The player's portrait (AG.CharacterRig 'portrait') beside the board, with the role expert
 * under it holding the first-aid kit (AGILA as the expert thinks instead). Then the prompt
 * line, the framed board the mode fills, and the 💡 / 🔀 tools. Portrait phones get a row
 * of small figures above the board.
 *
 * The scene keeps the score (matches × 100 + chain + time left × 5 − hints × 50), the speed
 * chain (matches within 3 s), hints, golden cards (collectibles), the expert's fact after each
 * NEW pair type, the player's poses (think · happy · cheer · point) and the badges.
 * finish() turns all of it into done(). Keys: arrows (WASD off: S = shuffle), H = hint. */
window.AG = window.AG || {};
(function (AG) {
  const { h } = AG.util;
  const PP = AG.pestPatrol, T = PP.tuning, R = PP.rules;
  const S = (en, fil) => ({ en, fil });
  const pick = v => AG.pick(v);

  const STR = {
    score: S('Score', 'Puntos'),
    hint: S('Hint −50', 'Pahiwatig −50'),
    shuffle: S('Shuffle', 'Haluin'),
    hints: S('Hints', 'Pahiwatig'),
    attempts: S('Attempts', 'Subok'),
    bestChain: S('Best speed chain', 'Pinakamahabang sunod-sunod'),
    timeBonus: S('Time bonus', 'Bonus sa oras'),
    noHint: S('Nothing to hint right now.', 'Wala pang maipapahiwatig.'),
    chain: S('Speed chain ×{n}!', 'Sunod-sunod ×{n}!'),
    retry: [S('Not a match. Remember where they were!', 'Hindi tugma. Tandaan kung nasaan sila!'),
      S('Almost! Look for the same picture.', 'Malapit na! Hanapin ang parehong larawan.'),
      S('Stuck? Press H or tap 💡 for a hint.', 'Nahihirapan? Pindutin ang H o i-tap ang 💡 para sa pahiwatig.')]
  };

  /* ---------- styles, once per page (all under #ag-app, classes pp-) ---------- */
  const CSS = `
#ag-app .pp { display: flex; gap: 14px; align-items: flex-start; font-variant-ligatures: none; font-feature-settings: 'liga' 0, 'clig' 0; }
#ag-app .pp-side { flex: none; width: 104px; display: flex; flex-direction: column; align-items: center; gap: 12px; }
#ag-app .pp-who { position: relative; display: flex; flex-direction: column; align-items: center; }
#ag-app .pp-who__fig { position: relative; display: flex; align-items: flex-end; justify-content: center; min-height: 64px; }
#ag-app .pp-who__fig .ag-charimg { display: block; }
#ag-app .pp-who__prop { position: absolute; bottom: 4px; right: -14px; }
#ag-app .pp-who__tag { margin-top: 2px; padding: 0 6px; font-family: var(--font-display); font-size: .75rem; font-weight: 700; color: #1e1538; background: #fff4cc; border: 2px solid #1e1538; white-space: nowrap; }
#ag-app .pp-who.is-hop .pp-who__fig { animation: pp-hop .5s steps(2) 3; }
@keyframes pp-hop { 50% { transform: translateY(-2px); } }
#ag-app .pp-main { flex: 1 1 auto; min-width: 0; display: grid; gap: 10px; justify-items: center; }
#ag-app .pp-prompt { margin: 0; text-align: center; font-weight: 800; color: var(--fg); min-height: 1.5em; }
#ag-app .pp-board {
  max-width: 100%; padding: 10px; background: var(--panel-2);
  border: 16px solid var(--line); border-image: var(--pp-frame) 8 fill / 16px round; image-rendering: pixelated;
}
#ag-app .pp-board > .agc-onet { border: 0; background: transparent; }
#ag-app .pp-tools { display: flex; flex-wrap: wrap; gap: 10px; justify-content: center; align-items: center; }
#ag-app .pp-tools .ag-btn { min-height: 52px; min-width: 64px; }
#ag-app .pp-tools .ag-btn[hidden] { display: none; }

/* cards: cream fronts with ink text in every theme, the pack's back at 2×, 8 px labels */
#ag-app .pp .agc-card__front { background: #fff4cc; color: #1e1538; }
#ag-app .pp .agc-card[data-state="matched"] .agc-card__front { background: #dff7e3; }
#ag-app .pp .agc-card__back { background: var(--lilac) var(--pp-back) center / 64px 64px no-repeat; image-rendering: pixelated; }
#ag-app .pp .agc-card__back .agc-card__pattern { display: none; }
#ag-app .pp .agc-face__label { font-size: 8px; line-height: 1.15; color: #1e1538; max-width: 100%; overflow-wrap: anywhere; }
#ag-app.ag-bigtext .pp .agc-face__label { font-size: 10px; }
#ag-app .pp .agc-face img { width: 36px; height: 36px; image-rendering: pixelated; }
#ag-app .pp .agc-card.is-empty .agc-face img { width: 32px; height: 32px; }
#ag-app .pp .agc-card.has-under .agc-face img { width: 32px; height: 32px; }
/* the cursor: a vest outline outside the card AND a vest ring inside it, so it shows on the
   lilac back, the cream front, the green matched face and an empty Onet cell alike */
#ag-app .pp .agc-card:focus-visible, #ag-app .pp .pp-tile:focus-visible, #ag-app .pp .pp-pest:focus-visible {
  outline: 4px solid var(--vest); outline-offset: 2px; box-shadow: inset 0 0 0 3px var(--vest), inset 0 0 0 5px #1e1538;
}
#ag-app .pp .pp-gold:not([data-state="hidden"]) .agc-card__front::after,
#ag-app .pp .pp-gold.pp-tile::after { content: ""; position: absolute; top: 2px; left: 2px; width: 18px; height: 18px; background: var(--pp-star) center / 18px 18px no-repeat; image-rendering: pixelated; }

/* World 2: pests on the left, prevention tiles in the tray */
#ag-app .pp-drop { display: grid; grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr); gap: 14px; width: min(560px, 100%); }
#ag-app .pp-drop h4 { margin: 0 0 4px; font-size: var(--step--1); color: var(--muted); text-transform: uppercase; letter-spacing: .06em; text-align: center; }
#ag-app .pp-col { display: grid; gap: 8px; align-content: start; }
#ag-app .pp-pest, #ag-app .pp-tile {
  position: relative; display: flex; align-items: center; gap: 8px; min-height: 64px; padding: 6px 8px; text-align: left;
  color: #1e1538; background: #fff4cc; border: var(--b) solid #1e1538; border-radius: var(--r); box-shadow: var(--sh) var(--sh) 0 var(--shadow-c);
  font: inherit; cursor: pointer; user-select: none; touch-action: none;
}
#ag-app .pp-pest .agc-face, #ag-app .pp-tile .agc-face { flex-direction: row; gap: 6px; text-align: left; }
#ag-app .pp-pest .agc-face__label, #ag-app .pp-tile .agc-face__label { font-size: 10px; }
#ag-app.ag-bigtext .pp-pest .agc-face__label, #ag-app.ag-bigtext .pp-tile .agc-face__label { font-size: 12px; }
#ag-app .pp-slot { margin-left: auto; display: grid; place-items: center; min-width: 48px; min-height: 48px; border: 2px dashed #4a4170; border-radius: var(--r); font-family: var(--font-display); font-weight: 700; }
#ag-app .pp-pest.is-done { background: #dff7e3; cursor: default; }
#ag-app .pp-pest.is-done .pp-slot { border-style: solid; border-color: var(--safe); background: #fff; }
#ag-app .pp-pest.is-done::after { content: "✔"; position: absolute; top: -10px; right: -10px; display: grid; place-items: center; width: 24px; height: 24px; font-size: 14px; font-weight: 900; color: #fff; background: var(--safe); border: 2px solid var(--ink); }
#ag-app .pp-pest.hot, #ag-app .pp-pest.is-target { border-color: var(--vest); border-width: 4px; }
#ag-app .pp-pest.is-target::before { content: "▶"; position: absolute; left: -18px; font-size: 14px; color: var(--vest); text-shadow: 1px 1px 0 var(--ink); }
#ag-app .pp-tile.sel { transform: translate(-2px, -2px); border-color: var(--vest); border-width: 4px; box-shadow: calc(var(--sh) + 2px) calc(var(--sh) + 2px) 0 var(--shadow-c); }
#ag-app .pp-tile.sel::before { content: "▼"; position: absolute; top: -18px; left: 50%; transform: translateX(-50%); font-size: 14px; color: var(--vest); text-shadow: 1px 1px 0 var(--ink); }
#ag-app .pp-tile.dragging { opacity: .5; }
#ag-app .pp-tile.done { display: none; }
#ag-app .pp-tile.is-hint, #ag-app .pp-pest.is-hint { outline: 3px dashed var(--hat); outline-offset: 3px; animation: agc-blink .8s steps(2) infinite; }

/* World 5: breeding sites in cleared cells */
#ag-app .pp-site { display: grid; place-items: center; gap: 0; }
#ag-app .pp-site b { font-size: 8px; font-family: var(--font-display); color: #1e1538; background: #ffe0e6; padding: 0 2px; border: 1px solid #1e1538; }
#ag-app .pp-site.is-clean b { background: #dff7e3; }
#ag-app .agc-card.is-empty.pp-dirty { background: #ffe0e6; border: 2px solid var(--alert); }
#ag-app .agc-card.is-empty.pp-dirty::after { content: "!"; position: absolute; top: -10px; right: -8px; display: grid; place-items: center; width: 20px; height: 20px; font-weight: 900; color: #fff; background: var(--alert); border: 2px solid var(--ink); }
#ag-app .agc-card.is-empty.pp-clean { background: #dff7e3; }
#ag-app .pp-sites { font-weight: 800; }

@container (max-width: 520px) {
  #ag-app .pp { flex-direction: column; align-items: stretch; gap: 8px; }
  #ag-app .pp-side { width: 100%; flex-direction: row; justify-content: space-between; }
  #ag-app .pp-who { flex-direction: row; gap: 6px; }
  #ag-app .pp-who__fig { height: 56px; min-height: 0; overflow: hidden; align-items: flex-start; }
  #ag-app .pp-board { padding: 4px; border-width: 10px; border-image-width: 10px; }
  #ag-app .pp-drop { gap: 8px; }
}
@media (prefers-reduced-motion: reduce) {
  #ag-app .pp-who.is-hop .pp-who__fig, #ag-app .pp-tile.is-hint, #ag-app .pp-pest.is-hint { animation: none; }
}`;
  function injectCss() {
    if (!document.querySelector('style[data-ag-css="pest-patrol"]')) document.head.append(h('style', { 'data-ag-css': 'pest-patrol' }, CSS));
  }
  const cssUrl = u => (u ? 'url("' + u + '")' : 'none');

  class Scene {
    constructor(stage, ctx, done, data) {
      injectCss();
      this.stage = stage; this.ctx = ctx; this.doneFn = done; this.data = data;
      this.adv = ctx.difficulty === 'advanced';
      this.rnd = AG.util.mulberry32(ctx.seed);
      this.matches = 0; this.chainPts = 0; this.hints = 0; this.attempts = 0; this.ended = false;
      this.collect = [false, false, false];
      this.facted = new Set(); this.retryN = 0; this.lastRetry = 0;
      this.timer = null; this.offs = []; this.labels = {}; this.t0 = performance.now();
      this.sets = new Map(data.sets.map(s => [s.id, s]));

      this.rig = ctx.rig('portrait');
      this.base = 'idle'; this.reaction = null; this.reactT = null; this.shown = '';
      this.expertRig = new AG.CharacterRig(null, ctx.expertId, 'portrait');
      this.expertRig.play(this.expertRig.agila ? 'think' : 'hold:first_aid');

      this.playerFig = h('div', { class: 'pp-who__fig' });
      this.playerTag = h('span', { class: 'pp-who__tag' });
      this.player = h('div', { class: 'pp-who pp-player' }, this.playerFig, this.playerTag);
      this.expertFig = h('div', { class: 'pp-who__fig' });
      this.expertTag = h('span', { class: 'pp-who__tag' });
      this.expert = h('div', { class: 'pp-who pp-expert' }, this.expertFig, this.expertTag);
      this.side = h('div', { class: 'pp-side', 'aria-hidden': 'true' }, this.player, this.expert);

      this.promptEl = h('p', { class: 'pp-prompt', 'aria-live': 'polite' });
      this.board = h('div', { class: 'pp-board' });
      this.hintBtn = h('button', { class: 'ag-btn ag-btn--alt pp-hint', type: 'button' });
      this.shuffleBtn = h('button', { class: 'ag-btn ag-btn--alt pp-shuffle', type: 'button', hidden: true });
      this.tools = h('div', { class: 'pp-tools' },
        AG.input.promptIcon({ keys: ['key_h'], gesture: 'gesture_tap' }), this.hintBtn,
        this.shufflePrompt = AG.input.promptIcon({ keys: ['key_s'], gesture: 'gesture_tap' }), this.shuffleBtn);
      this.shufflePrompt.style.display = 'none';
      this.main = h('div', { class: 'pp-main' }, this.promptEl, this.board, this.tools);
      this.el = h('div', { class: 'pp' }, this.side, this.main);
      this.el.style.setProperty('--pp-back', cssUrl(this.assetUrl('pest-patrol.card.back')));
      this.el.style.setProperty('--pp-frame', cssUrl(this.assetUrl('pest-patrol.board.frame')));
      this.el.style.setProperty('--pp-star', cssUrl(AG.icons.src('star')));
      stage.append(this.el);

      this.streak = new AG.cards.Streak({ windowMs: T.chainMs });
      this.hud = ctx.hud({ score: 0, scoreLabel: STR.score, label: S('Pairs', 'Pares') });
      this.hud.set({ score: 0 });
      this.hud.el.append(this.streak.el);

      // arrows only: S is the shuffle key, H the hint
      AG.input.disableWasd();
      AG.input.register('SHUFFLE', { keys: ['KeyS'] });
      this.offs.push(AG.input.on('HINT', e => { if (e.phase === 'down') this.hint(); }));
      this.offs.push(AG.input.on('SHUFFLE', e => { if (e.phase === 'down' && this.onShuffle) this.onShuffle(); }));
      this.hintBtn.addEventListener('click', () => this.hint());
      this.shuffleBtn.addEventListener('click', () => this.onShuffle && this.onShuffle());
      this.offs.push(AG.on('kalasag:languagechange', () => this.relabel()));
      AG.sfx.preload(['pest-patrol.sfx.flip', 'pest-patrol.sfx.match', 'pest-patrol.sfx.mismatch', 'pest-patrol.sfx.clean']);

      this.renderExpert(); this.renderPlayer(); this.relabelTools();
    }

    /** An asset's URL, or null (registering the miss for ?debug=assets). Prompt keys come
     *  first, then the pack's own name for the same art (card.frame → card.front). */
    assetUrl(key, alt) {
      const u = AG.assets.url(key) || (alt && AG.assets.url(alt));
      if (!u) AG.assets.image(key);
      return u;
    }

    /* ---------- faces ---------- */
    /** The face spec for a set's pest / cause / prevent (or a look-alike), with or without its label. */
    face(setId, role, withLabel) {
      let f;
      if (role === 'alike') f = (this.data.lookalikes.find(l => l.id === setId) || {}).face;
      else f = (this.sets.get(setId) || {})[role];
      f = f || { emoji: '⭐', label: S(setId, setId) };
      const spec = {};
      if (f.asset) {
        const u = AG.assets.url(f.asset);
        if (u) spec.img = u; else { AG.assets.image(f.asset); spec.emoji = f.emoji; }
      } else if (f.icon && AG.icons.has(f.icon)) spec.icon = f.icon;
      else spec.emoji = f.emoji;
      if (withLabel) spec.label = f.label;
      return spec;
    }
    labelOf(setId, role) {
      const f = role === 'alike' ? (this.data.lookalikes.find(l => l.id === setId) || {}).face : (this.sets.get(setId) || {})[role];
      return (f && f.label) || S(setId, setId);
    }
    /** Easy shows labels all the time; Advanced only once that pair type has been matched. */
    showLabel(setId) { return !this.adv || this.facted.has(setId); }

    /* ---------- characters ---------- */
    renderExpert() {
      const r = this.expertRig.info(performance.now() / 1000);
      this.expertFig.replaceChildren(this.expertRig.img(1), r.icon ? AG.ui.icon(r.icon, 36, '', 'pp-who__prop') : '');
      this.expertTag.textContent = AG.chars.get(this.ctx.expertId).name;
    }
    setBase(action) { this.base = action; this.renderPlayer(); }
    renderPlayer() {
      const action = this.reaction || this.base;
      if (action === this.shown) return;
      this.shown = action;
      this.rig.play(action);
      const r = this.rig.info(performance.now() / 1000);
      this.playerFig.replaceChildren(this.rig.img(1), r.icon ? AG.ui.icon(r.icon, 36, '', 'pp-who__prop') : '');
      this.player.classList.toggle('is-hop', action === 'cheer');
      this.playerTag.textContent = AG.chars.get(this.ctx.characterId).name;
    }
    /** A short reaction (happy, cheer, point), then back to the base pose. */
    react(action, ms) {
      clearTimeout(this.reactT);
      this.reaction = action; this.renderPlayer();
      this.reactT = setTimeout(() => { this.reaction = null; this.renderPlayer(); }, ms || T.reactMs);
    }

    /* ---------- text that follows the site language ---------- */
    setPrompt(spec, vars) { this.labels.prompt = [spec, vars]; this.promptEl.textContent = this.fmt(spec, vars); }
    setLabel(spec, value) {
      this.labels.hud = spec;
      this.hud.el.querySelector('.ag-stat:nth-child(2) small').textContent = pick(spec);
      if (value != null) this.hud.set({ label: value });
    }
    fmt(spec, vars) { let s = pick(spec); if (vars) s = s.replace(/\{(\w+)\}/g, (_, k) => (vars[k] != null ? pick(vars[k]) : '')); return s; }
    /** { en, fil } with {vars} filled in both, for text the shell shows later (results, word boxes). */
    fmtBoth(spec, vars) {
      const f = s => s.replace(/\{(\w+)\}/g, (_, k) => (vars[k] != null ? (typeof vars[k] === 'object' ? '' : String(vars[k])) : ''));
      return { en: f(spec.en), fil: f(spec.fil || spec.en) };
    }
    relabelTools() {
      this.hintBtn.textContent = '💡 ' + pick(STR.hint);
      this.hintBtn.setAttribute('aria-label', pick(STR.hint));
      if (this.shuffles != null) {
        this.shuffleBtn.textContent = '🔀 ' + pick(STR.shuffle) + ' (' + this.shuffles + ')';
        this.shuffleBtn.setAttribute('aria-label', pick(STR.shuffle) + ' (' + this.shuffles + ')');
      }
    }
    relabel() {
      if (this.labels.prompt) this.setPrompt(...this.labels.prompt);
      if (this.labels.hud) this.setLabel(this.labels.hud);
      this.hud.el.querySelector('.ag-stat small').textContent = pick(STR.score);
      this.relabelTools();
      this.onRelabel && this.onRelabel();
    }

    /* ---------- tools ---------- */
    /** Shuffles left (shown as 🔀 (n)); fn runs on S or 🔀. */
    useShuffles(n, fn) {
      this.shuffles = n; this.onShuffle = fn;
      this.shuffleBtn.hidden = false; this.shufflePrompt.style.display = '';
      this.relabelTools();
    }
    spendShuffle() { this.shuffles = Math.max(0, this.shuffles - 1); this.shuffleBtn.disabled = this.shuffles === 0; this.relabelTools(); }
    /** H / 💡: the mode highlights one valid pair (doHint → truthy), −50 points, the player points. */
    hint() {
      if (this.ended || AG.paused || !this.doHint) return;
      if (!this.doHint()) { this.ctx.say('instruction', STR.noHint, { sound: false }); return; }
      this.hints++;
      AG.sfx.play('blip');
      this.updateScore();
      this.pop('−' + T.hintCost, false);
      this.react('point', T.hintMs);
    }

    /* ---------- timer ---------- */
    startTimer(seconds, onEnd) {
      this.timerTotal = seconds;
      this.timer = new AG.cards.Timer({ seconds, warnAt: 15, onEnd });
      this.hud.el.append(this.timer.el);
      this.timer.start();
    }

    /* ---------- scoring ---------- */
    get score() { return R.points({ matches: this.matches, chain: this.chainPts, hints: this.hints }); }
    updateScore() { this.hud.set({ score: this.score }); }
    pop(text, good) {
      const r = this.stage.getBoundingClientRect(), b = this.board.getBoundingClientRect();
      AG.kit.pop(this.stage, Math.round(b.left - r.left + b.width / 2), Math.round(b.top - r.top), text, good);
    }
    /** A match: points, the speed chain, golden cards, the happy / cheer pose and the fact. */
    matched(o) {
      this.matches++;
      const n = this.streak.hit(), bonus = R.chainPoints(n);
      this.chainPts += bonus;
      this.updateScore();
      this.pop('+' + (T.matchPoints + bonus), true);
      if (o.golden != null && o.golden >= 0 && o.golden < 3 && !this.collect[o.golden]) { this.collect[o.golden] = true; AG.sfx.play('star'); }
      if (o.sound !== false) AG.sfx.play('pest-patrol.sfx.match');
      this.ctx.safe();
      if (n >= 2) {
        this.react('cheer', 1400);
        if (!this.fact(o.set)) this.ctx.say('success', this.fmtBoth(STR.chain, { n }), { sound: false, ms: 1600 });
      } else {
        this.react('happy');
        this.fact(o.set);
      }
    }
    /** The role expert's fact the first time a pair type is matched. Returns true if it spoke. */
    fact(setId) {
      if (!setId || this.facted.has(setId)) return false;
      this.facted.add(setId);
      const set = this.sets.get(setId), alike = this.data.lookalikes.find(l => l.id === setId);
      const text = (set && set.fact) || (alike && alike.fact);
      if (!text) return false;
      this.ctx.say('info', text, { title: pick(this.labelOf(setId, set ? 'pest' : 'alike')) });
      this.onFact && this.onFact(setId);
      return true;
    }
    /** A miss: a gentle, specific nudge (not on every miss, so the bar stays calm). */
    wrong(text) {
      AG.sfx.play('pest-patrol.sfx.mismatch');
      const now = performance.now();
      if (text || now - this.lastRetry > 2500) {
        this.lastRetry = now;
        this.ctx.say('retry', text || STR.retry[Math.min(this.retryN++, STR.retry.length - 1)], { sound: false });
      }
    }

    /* ---------- the end of the level ---------- */
    /** o: { passed, stars, detail, message, learned, cleared, sites } */
    finish(o) {
      if (this.ended) return;
      this.ended = true;
      clearTimeout(this.reactT);
      let left = 0, used = 0;
      if (this.timer) { this.timer.stop(); left = Math.floor(this.timer.left); used = this.timer.elapsed; }
      else used = (performance.now() - this.t0) / 1000;
      const timeLeft = o.passed && o.cleared !== false && this.timer ? left : 0;
      const score = R.points({ matches: this.matches, chain: this.chainPts, hints: this.hints, timeLeft });
      this.hud.set({ score });
      const detail = (o.detail || []).concat([{ label: STR.hints, value: this.hints }, { label: STR.bestChain, value: this.streak.best }]);
      if (this.timer) detail.push({ label: STR.timeBonus, value: '+' + timeLeft * T.timePoints });
      this.reaction = null; this.base = o.passed ? 'cheer' : 'think'; this.renderPlayer();
      this.doneFn({
        won: !!o.passed, stars: o.passed ? o.stars : 0, score, timeMs: Math.round(used * 1000),
        collectibles: this.collect.slice(), detail,
        message: o.message, learned: o.learned, badgeEvents: this.badgeEvents(o)
      });
    }
    /** memory-master (every World 1 level at 3 stars), onet-pro (a 10-match chain),
     *  four-s (40 breeding sites cleaned in all). Counted in stats.pestPatrol. */
    badgeEvents(o) {
      const ev = [], { gameId, world, level } = this.ctx;
      if (this.ctx.mode !== 'stage') return ev;
      if (world === 1 && o.passed && o.stars === 3) {
        const all = [1, 2, 3, 4, 5].every(l => l === level || ((AG.progress.level(gameId, 1, l) || {}).stars || 0) >= 3);
        if (all) ev.push('memory-master');
      }
      if (this.streak.best >= T.badges.onetChain) ev.push('onet-pro');
      const stats = AG.store.update('stats', s => {
        const p = s.pestPatrol = s.pestPatrol || { sites: 0 };
        p.sites = (p.sites || 0) + (o.sites || 0);
      }).pestPatrol;
      if (stats.sites >= T.badges.sites) ev.push('four-s');
      return ev;
    }

    destroy() {
      clearTimeout(this.reactT);
      this.offs.forEach(f => f());
      if (this.timer) this.timer.destroy();
    }
  }

  PP.Scene = Scene;
  PP.STR = STR;
})(window.AG);
