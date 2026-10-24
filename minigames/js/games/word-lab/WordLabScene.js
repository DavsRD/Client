/* Health Center Word Lab: the shared scene every mode plays in.
 *
 *   const scene = new AG.wordLab.Scene(stage, ctx, done)
 *
 * The health-center counter (word-lab.bg.center) with the role expert on the left holding the
 * first-aid kit, the mode's middle (the patient queue, the Twist board or the rule poster) and
 * the player's portrait on the right; under it the prompt line, the LetterTiles board and an
 * extra area. Portrait phones get a short scene strip and busts instead of full figures.
 *
 * The scene keeps the score, hints, the no-hint streak (+5 XP per word from 2 in a row; a cheer
 * at 3), the golden words (collectibles), the timer in the HUD and the definition box: the
 * expert reads it in a DialogueBox that waits for Enter or a tap (no auto-advance; the timer
 * stops meanwhile). finish() turns all of it into stars, badges and done(). */
window.AG = window.AG || {};
(function (AG) {
  const { h } = AG.util;
  const WL = AG.wordLab, T = WL.tuning, R = WL.rules;
  const S = (en, fil) => ({ en, fil });
  const pick = v => AG.pick(v);

  const STR = {
    score: S('Score', 'Puntos'),
    hints: S('Hints', 'Pahiwatig'),
    timeBonus: S('Time bonus', 'Bonus sa oras'),
    bestStreak: S('Best no-hint streak', 'Pinakamahabang walang pahiwatig'),
    continue: S('Continue', 'Ituloy'),
    enterOrTap: S('Enter or tap to continue', 'Enter o i-tap para ituloy'),
    retry: [S('Not quite. The tiles went back. Try again!', 'Hindi pa tama. Bumalik ang tiles. Subukan muli!'),
      S('Almost! Look at the clue and try another order.', 'Malapit na! Tingnan ang clue at subukan ang ibang ayos.'),
      S('Stuck? Press ? or tap 💡 for a letter.', 'Nahihirapan? Pindutin ang ? o i-tap ang 💡 para sa isang letra.')],
    lowTime: S('15 seconds left!', '15 segundo na lang!'),
    poster: S('You cleared World {w}: a new health poster is on the world map!', 'Natapos mo ang Mundo {w}: may bagong health poster sa world map!')
  };

  /* ---------- styles, once per page (all under #ag-app, classes wl-) ---------- */
  const CSS = `
#ag-app .wl { display: flex; flex-direction: column; gap: 14px; font-variant-ligatures: none; font-feature-settings: 'liga' 0, 'clig' 0; }
#ag-app .wl-scene {
  position: relative; display: flex; align-items: flex-end; justify-content: space-between; gap: 8px; height: 270px; padding: 0 10px;
  background-color: #bfe9ff; background-repeat: no-repeat; background-position: center bottom; background-size: 480px 270px;
  image-rendering: pixelated; border: 2px solid var(--ink); border-radius: var(--r); overflow: hidden;
}
#ag-app .wl-who { position: relative; flex: none; display: flex; flex-direction: column; align-items: center; }
#ag-app .wl-who__fig { position: relative; display: flex; align-items: flex-end; justify-content: center; }
#ag-app .wl-who__fig .ag-charimg { display: block; }
#ag-app .wl-who__tag {
  margin-top: 2px; padding: 0 8px; font-family: var(--font-display); font-size: .8rem; font-weight: 700; color: #1e1538;
  background: #fff4cc; border: 2px solid #1e1538; white-space: nowrap;
}
#ag-app .wl-who__prop { position: absolute; bottom: 8px; right: -16px; }
#ag-app .wl-who__gear { position: absolute; top: 22px; right: -10px; }
#ag-app .wl-who.is-hop .wl-who__fig { animation: wl-hop .5s steps(2) 3; }
@keyframes wl-hop { 50% { transform: translateY(-2px); } }
#ag-app .wl-middle { flex: 1 1 auto; min-width: 0; align-self: stretch; display: flex; align-items: flex-end; justify-content: center; padding-bottom: 6px; }

#ag-app .wl-queue { display: flex; align-items: flex-end; gap: 6px; }
#ag-app .wl-patient { position: relative; display: flex; flex-direction: column; align-items: center; transition: transform .4s steps(4), opacity .4s steps(4); }
#ag-app .wl-patient canvas { display: block; image-rendering: pixelated; }
#ag-app .wl-patient.is-leaving { transform: translateX(-90px); opacity: 0; }
#ag-app .wl-patient__star { position: absolute; top: -6px; right: -8px; }
#ag-app .wl-bubble {
  position: relative; display: flex; align-items: center; gap: 6px; margin-bottom: 10px; padding: 6px 10px; min-height: 48px;
  color: #1e1538; background: #fff; border: 2px solid #1e1538; box-shadow: 3px 3px 0 #1e1538;
  font-family: var(--font-display); font-weight: 700; font-size: .85rem; white-space: nowrap;
}
#ag-app .wl-bubble::after { content: ""; position: absolute; left: 50%; bottom: -10px; width: 10px; height: 10px; background: #fff; border-right: 2px solid #1e1538; border-bottom: 2px solid #1e1538; transform: translateX(-50%) rotate(45deg); }
#ag-app .wl-bubble .agc-face__text { font-size: 1.4rem; }
#ag-app .wl-bubble__gold { color: #8a5a00; }

#ag-app .wl-sign {
  align-self: center; display: grid; justify-items: center; gap: 6px; padding: 10px 14px; max-width: 100%;
  color: #1e1538; background: #fff; border: var(--b) solid #1e1538; box-shadow: 4px 4px 0 #1e1538; text-align: center;
}
#ag-app .wl-sign b { font-family: var(--font-display); font-size: 1.15rem; }
#ag-app .wl-sign small { font-weight: 800; color: #4a4170; }
#ag-app .wl-sign__row { display: flex; gap: 6px; align-items: center; justify-content: center; flex-wrap: wrap; }
#ag-app .wl-sign__bingo { padding: 2px 8px; font-family: var(--font-display); font-weight: 700; border: 2px dashed #1e1538; }
#ag-app .wl-sign__bingo.is-on { border-style: solid; background: #ffd23f; }
#ag-app .wl-sign__bingo.is-on::before { content: "✔ "; }

#ag-app .wl-prompt { margin: 0; text-align: center; font-weight: 800; color: var(--fg); min-height: 1.5em; }
#ag-app .wl-board { display: flex; justify-content: center; }
#ag-app .wl-extra:empty { display: none; }
#ag-app .wl-extra { display: grid; gap: 10px; justify-items: center; }
#ag-app .wl-found { display: flex; flex-wrap: wrap; gap: 10px 18px; justify-content: center; width: 100%; }
#ag-app .wl-found__group { display: grid; gap: 4px; align-content: start; min-width: 6rem; }
#ag-app .wl-found__group h4 { margin: 0; font-size: var(--step--1); color: var(--muted); text-transform: uppercase; letter-spacing: .06em; }
#ag-app .wl-found__list { display: flex; flex-wrap: wrap; gap: 4px; }
#ag-app .wl-word { padding: 1px 8px; font-family: var(--font-display); font-weight: 700; color: #1e1538; background: #dff7e3; border: 2px solid #1e1538; }
#ag-app .wl-word.is-gold { background: #ffd23f; }
#ag-app .wl-word.is-gold::before { content: "⭐ "; }
#ag-app .wl-word.is-locked { color: #4a4170; background: #fff4cc; border-style: dashed; letter-spacing: .15em; }
#ag-app .wl-word.is-locked::before { content: "⭐ "; letter-spacing: 0; }

#ag-app .wl-dlg { position: absolute; inset: 0; z-index: 30; display: grid; place-items: center; padding: 12px; background: rgba(10, 8, 30, .55); }
#ag-app .wl-dlg[hidden] { display: none; }
#ag-app .wl-dlg__box { display: grid; gap: 10px; justify-items: end; width: min(680px, 100%); }
#ag-app .wl-dlg__box .rs-dlg-wrap { width: 100%; }
#ag-app .wl-dlg__row { display: flex; align-items: center; gap: 10px; }

/* portrait phones: a short strip, busts instead of full figures, tiles wrap to 2 rows (engine) */
@container (max-width: 520px) {
  #ag-app .wl-scene { height: 150px; padding: 0 6px; }
  #ag-app .wl-who__fig { height: 68px; overflow: hidden; align-items: flex-start; }
  #ag-app .wl-who__prop { bottom: 4px; right: -6px; }
  #ag-app .wl-who__gear { top: 30px; right: -4px; }
  #ag-app .wl-who__tag { font-size: .7rem; padding: 0 4px; }
  #ag-app .wl-bubble { margin-bottom: 6px; padding: 4px 6px; min-height: 40px; font-size: .75rem; }
  #ag-app .wl-queue { gap: 2px; }
  #ag-app .wl-patient:not(.is-front) { display: none; }
  #ag-app .wl-sign { padding: 6px 8px; } #ag-app .wl-sign b { font-size: 1rem; }
}
@container (min-width: 960px) {
  /* wide stages: the backdrop at 2× (whole multiples only), the counter just behind the figures */
  #ag-app .wl-scene { height: 300px; background-size: 960px 540px; }
}
@media (prefers-reduced-motion: reduce) {
  #ag-app .wl-patient { transition: none; }
  #ag-app .wl-who.is-hop .wl-who__fig { animation: none; }
}`;
  function injectCss() {
    if (!document.querySelector('style[data-ag-css="word-lab"]')) document.head.append(h('style', { 'data-ag-css': 'word-lab' }, CSS));
  }

  class Scene {
    constructor(stage, ctx, done) {
      injectCss();
      this.stage = stage; this.ctx = ctx; this.doneFn = done;
      this.fil = ctx.lang === 'fil';
      this.score = 0; this.hints = 0; this.bonusXP = 0; this.ended = false; this.masked = false;
      this.collect = [false, false, false];
      this.timer = null; this.timerTotal = 0; this.retryN = 0; this.lastRetry = 0;
      this.offs = [];
      this.labels = {};

      this.rig = ctx.rig('portrait');
      this.base = 'idle'; this.reaction = null; this.reactT = null; this.shown = '';
      this.expertRig = new AG.CharacterRig(null, ctx.expertId, 'portrait').play('hold:first_aid');

      this.playerFig = h('div', { class: 'wl-who__fig' });
      this.playerTag = h('span', { class: 'wl-who__tag' });
      this.player = h('div', { class: 'wl-who wl-player', 'aria-hidden': 'true' }, this.playerFig, this.playerTag);
      this.expertFig = h('div', { class: 'wl-who__fig' });
      this.expertTag = h('span', { class: 'wl-who__tag' });
      this.expert = h('div', { class: 'wl-who wl-expert', 'aria-hidden': 'true' }, this.expertFig, this.expertTag);
      this.middle = h('div', { class: 'wl-middle' });
      this.sceneEl = h('div', { class: 'wl-scene' }, this.expert, this.middle, this.player);
      const bg = AG.assets.url('word-lab.bg.center');
      if (!bg) AG.assets.image('word-lab.bg.center'); // registers the missing key for ?debug=assets
      this.sceneEl.style.backgroundImage = 'url("' + (bg || AG.assets.placeholderURL('word-lab.bg.center', 480, 270)) + '")';
      if (bg) { const probe = new Image(); probe.onerror = () => { AG.assets.image('word-lab.bg.center'); this.sceneEl.style.backgroundImage = 'url("' + AG.assets.placeholderURL('word-lab.bg.center', 480, 270) + '")'; }; probe.src = bg; }

      this.promptEl = h('p', { class: 'wl-prompt', 'aria-live': 'polite' });
      this.board = h('div', { class: 'wl-board' });
      this.extra = h('div', { class: 'wl-extra' });
      this.dlg = h('div', { class: 'wl-dlg', hidden: true });
      this.el = h('div', { class: 'wl' }, this.sceneEl, this.promptEl, this.board, this.extra);
      stage.append(this.el, this.dlg);

      this.streak = new AG.cards.Streak();
      this.hud = ctx.hud({ score: 0, scoreLabel: STR.score, label: S('Words', 'Salita') });
      this.hud.set({ score: 0 });
      this.hud.el.append(this.streak.el);

      this.renderExpert(); this.renderPlayer();
      this.offs.push(AG.on('kalasag:languagechange', () => this.relabel()));
      ctx.onPause(on => { if (!on && this.dlgOpen) setTimeout(() => this.dlgFocus(), 0); });
      // tile taps and shuffles play the engine's sounds; the game adds right / wrong
      AG.sfx.preload(['word-lab.sfx.correct', 'word-lab.sfx.wrong']);
      // every letter key types a letter here, from the first frame (LetterTiles does the same)
      AG.input.disableWasd();
      AG.input.register('PAUSE', { keys: ['Escape'] });
    }

    /* ---------- characters ---------- */
    renderExpert() {
      const r = this.expertRig.info(performance.now() / 1000);
      this.expertFig.replaceChildren(this.expertRig.img(1), r.icon ? AG.ui.icon(r.icon, 36, '', 'wl-who__prop') : '');
      this.expertTag.textContent = AG.chars.get(this.ctx.expertId).name;
    }
    /** The base pose: think while a word is in progress, otherwise idle (AGILA keeps her mask on). */
    setBase(action) { this.base = action; this.renderPlayer(); }
    poseNow() {
      const a = this.reaction || this.base;
      return a === 'idle' && this.masked && this.rig.agila ? 'mask_on' : a;
    }
    renderPlayer() {
      const action = this.poseNow(), key = action + (this.rig.gear || '');
      if (key === this.shown) return;
      this.shown = key;
      this.rig.play(action);
      const r = this.rig.info(performance.now() / 1000);
      const kids = [this.rig.img(1)];
      if (this.rig.gear === 'mask') kids.push(AG.ui.icon('facemask', 36, '', 'wl-who__gear'));
      else if (r.icon) kids.push(AG.ui.icon(r.icon, 36, '', r.at === 'head' ? 'wl-who__gear' : 'wl-who__prop'));
      this.playerFig.replaceChildren(...kids);
      this.player.classList.toggle('is-hop', action === 'cheer');
      this.playerTag.textContent = AG.chars.get(this.ctx.characterId).name;
    }
    /** A short reaction (happy, cheer, mask_on), then back to the base pose. */
    react(action, ms) {
      clearTimeout(this.reactT);
      this.reaction = action; this.renderPlayer();
      this.reactT = setTimeout(() => { this.reaction = null; this.renderPlayer(); }, ms || T.reactMs);
    }
    /** MASK solved: the player wears a mask for the rest of the level. */
    maskOn() { this.masked = true; this.rig.setGear('mask'); this.react('mask_on', 1600); }

    /* ---------- text that follows the site language ---------- */
    setPrompt(spec, vars) { this.labels.prompt = [spec, vars]; this.promptEl.textContent = this.fmt(spec, vars); }
    setLabel(spec, value) { this.labels.hud = spec; this.hud.el.querySelector('.ag-stat:nth-child(2) small').textContent = pick(spec); if (value != null) this.hud.set({ label: value }); }
    fmt(spec, vars) { let s = pick(spec); if (vars) s = s.replace(/\{(\w+)\}/g, (_, k) => (vars[k] != null ? pick(vars[k]) : '')); return s; }
    relabel() {
      if (this.labels.prompt) this.setPrompt(...this.labels.prompt);
      if (this.labels.hud) this.setLabel(this.labels.hud);
      this.hud.el.querySelector('.ag-stat small').textContent = pick(STR.score);
      this.onRelabel && this.onRelabel();
    }

    /* ---------- timer ---------- */
    startTimer(seconds, onEnd) {
      this.timerTotal = seconds;
      this.timer = new AG.cards.Timer({ seconds, warnAt: 15, onEnd, onWarn: () => this.ctx.say('instruction', STR.lowTime, { sound: false }) });
      this.hud.el.append(this.timer.el);
      this.timer.start();
    }

    /* ---------- scoring ---------- */
    pop(text, good) {
      const r = this.stage.getBoundingClientRect(), b = this.board.getBoundingClientRect();
      AG.kit.pop(this.stage, Math.round(b.left - r.left + b.width / 2), Math.round(b.top - r.top), text, good);
    }
    chargeHint() {
      this.hints++;
      this.score = Math.max(0, this.score - T.hintCost);
      this.hud.set({ score: this.score });
      this.pop('−' + T.hintCost, false);
    }
    /** A word or rule is solved. golden: 0..2 when it is one of the level's golden words. */
    solved(o) {
      this.score += o.points;
      this.hud.set({ score: this.score });
      this.pop('+' + o.points, true);
      if (o.golden != null && o.golden >= 0 && o.golden < 3) { this.collect[o.golden] = true; AG.sfx.play('star'); }
      AG.sfx.play('word-lab.sfx.correct');
      this.ctx.safe();
      let cheer = false;
      if (o.hinted) this.streak.miss();
      else {
        const n = this.streak.hit();
        this.bonusXP += R.streakXP(n);
        cheer = n >= T.cheerEvery && n % T.cheerEvery === 0;
      }
      this.react(cheer ? 'cheer' : 'happy', cheer ? 1600 : T.reactMs);
      if (cheer) this.ctx.say('success', this.ctx.characterLine().text, { sound: false });
    }
    /** A wrong answer: a gentle, specific nudge (not on every miss, so the bar stays calm). */
    wrong(text) {
      AG.sfx.play('word-lab.sfx.wrong');
      const now = performance.now();
      if (text || now - this.lastRetry > 2500) {
        this.lastRetry = now;
        this.ctx.say('retry', text || STR.retry[Math.min(this.retryN++, STR.retry.length - 1)], { sound: false });
      }
    }

    /* ---------- the role expert reads a definition (Enter / tap to continue) ---------- */
    read(entry, nextLabel) {
      return new Promise(res => {
        if (this.ended) { res(); return; }
        if (this.timer) this.timer.stop();
        const t0 = performance.now();
        let closed = false;
        const close = () => {
          if (closed || performance.now() - t0 < T.readMinMs) return; // the key that solved the word must not skip it
          closed = true; this.dlgOpen = false;
          this.dlg.hidden = true; this.dlg.replaceChildren();
          if (this.timer && !this.ended) this.timer.start();
          AG.sfx.play('tap');
          res();
        };
        const def = entry.definition || {};
        const text = { en: '**' + entry.word + '**: ' + (def.en || ''), fil: '**' + (entry.wordFil || entry.word) + '**: ' + (def.fil || def.en || '') };
        const box = AG.dialogue.box({ speaker: this.ctx.expertId, style: 'info', text, next: close, typewriter: AG.store.setting('typewriter') !== false && !AG.reducedMotion(), plainFont: AG.store.setting('plainFont') });
        const btn = h('button', { class: 'ag-btn wl-dlg__next', type: 'button' }, '▶ ' + pick(nextLabel || STR.continue));
        btn.addEventListener('click', close);
        this.dlg.replaceChildren(h('div', { class: 'wl-dlg__box', role: 'dialog', 'aria-label': AG.chars.get(this.ctx.expertId).name },
          box, h('div', { class: 'wl-dlg__row' }, AG.input.promptIcon({ keys: ['key_enter'], gesture: 'gesture_tap' }), btn)));
        this.dlg.hidden = false; this.dlgOpen = true;
        this.dlgFocus();
      });
    }
    dlgFocus() { const f = this.dlg.querySelector('.rs-clickable'); if (f) f.focus({ preventScroll: true }); }

    /* ---------- the end of the level ---------- */
    /** o: { passed, allDone, targets, detail, message, bingo, learned } */
    finish(o) {
      if (this.ended) return;
      this.ended = true;
      clearTimeout(this.reactT);
      let left = 0, used = 0;
      if (this.timer) { this.timer.stop(); left = Math.floor(this.timer.left); used = this.timer.elapsed; }
      const bonus = o.passed && o.allDone && isFinite(left) ? T.timeBonus * left : 0;
      this.score += bonus;
      this.hud.set({ score: this.score });
      const stars = R.stars(o.passed, this.score, o.targets, this.hints);
      const badgeEvents = this.badgeEvents(o.passed, !!o.bingo);
      let message = o.message;
      if (o.passed && this.completesWorld()) message = [message, S(this.fmt(STR.poster.en, { w: String(this.ctx.world) }), this.fmt(STR.poster.fil, { w: String(this.ctx.world) }))];
      this.reaction = null; this.base = o.passed ? 'cheer' : 'think'; this.renderPlayer();
      this.doneFn({
        won: !!o.passed, stars, score: this.score, timeMs: Math.round(used * 1000),
        collectibles: this.collect.slice(),
        detail: (o.detail || []).concat([{ label: STR.hints, value: this.hints }, { label: STR.bestStreak, value: this.streak.best }, { label: STR.timeBonus, value: '+' + bonus }]),
        message: Array.isArray(message) ? { en: message.map(m => m && m.en).filter(Boolean).join(' '), fil: message.map(m => m && (m.fil || m.en)).filter(Boolean).join(' ') } : message,
        learned: o.learned, badgeEvents, bonusXP: this.bonusXP
      });
    }
    /** Does clearing this level finish its world (the world's poster unlocks on the map)? */
    completesWorld() {
      const { gameId, world, level } = this.ctx;
      if (this.ctx.mode !== 'stage') return false;
      for (let l = 1; l <= 5; l++) {
        if (l === level) continue;
        const rec = AG.progress.level(gameId, world, l);
        if (!rec || !rec.stars) return false;
      }
      const mine = AG.progress.level(gameId, world, level);
      return !(mine && mine.stars);
    }
    /** no-hints-needed (10 levels with 0 hints), word-wizard (BINGO in all 5 Twist levels),
     *  bilingual (5 levels played in Filipino). Counted per level id in stats.wordLab. */
    badgeEvents(won, bingo) {
      const id = this.ctx.world + '-' + this.ctx.level, ev = [];
      if (this.ctx.mode !== 'stage') return ev;
      const stats = AG.store.update('stats', s => {
        const w = s.wordLab = s.wordLab || {};
        w.noHint = w.noHint || {}; w.bingo = w.bingo || {}; w.fil = w.fil || {};
        if (won && this.hints === 0) w.noHint[id] = 1;
        if (bingo) w.bingo[id] = 1;
        if (won && this.fil) w.fil[id] = 1;
      }).wordLab;
      if (Object.keys(stats.noHint).length >= T.badges.noHints) ev.push('no-hints-needed');
      if ([1, 2, 3, 4, 5].every(l => stats.bingo['4-' + l])) ev.push('word-wizard');
      if (Object.keys(stats.fil).length >= T.badges.bilingual) ev.push('bilingual');
      return ev;
    }

    destroy() {
      clearTimeout(this.reactT);
      this.offs.forEach(f => f());
      if (this.timer) this.timer.destroy();
    }
  }

  WL.Scene = Scene;
  WL.STR = STR;
})(window.AG);
