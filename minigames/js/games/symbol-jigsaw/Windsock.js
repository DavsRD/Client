/* Hazard Symbol Jigsaw: the windsock and the upwind finale.
 *
 *   AG.symbolJigsaw.arrowCanvas(dir)        a pixel-art arrow (8 directions, no rotation: each is drawn on its own)
 *   new AG.symbolJigsaw.Windsock({ dir, scale })   .el (a canvas), .setDir(dir), .destroy()   the sock TIP points where the wind blows TO
 *   new AG.symbolJigsaw.Upwind(host, ctx, { sceneId, tip, react(action), onDone({ tries, firstTry }) })
 * The player picks one of four arrows. The right one points toward where the wind comes FROM (opposite the sock
 * tip). The windsock explanation is arrow + text, never colour alone. Keys: ←/→ or ↑/↓ + Enter, or 1–4; touch: tap. */
window.AG = window.AG || {};
(function (AG) {
  const { h } = AG.util;
  const SJ = AG.symbolJigsaw, T = SJ.tuning, W = SJ.wind;
  const K = 'symbol-jigsaw.';
  const pick = v => AG.pick(v);
  const fmt = (t, vars) => pick(t).replace(/\{(\w+)\}/g, (_, k) => (vars[k] == null ? '' : vars[k]));
  const low = d => W.NAME[d].toLowerCase();
  const rich = text => AG.dialogue.renderText(text, h('span'));    // **bold** and :icon: in a <span>
  SJ.onPress = (el, fn) => AG.pieces.onPress(el, fn);              // touch fires on pointerup (engine rule 2), mouse and keys on click

  const STR = {
    eyebrow: { en: 'Which way is upwind?' },
    ask: { en: "The windsock's tip points where the wind is **going**. Which way do you walk to go **upwind**?" },
    sockLine: { en: 'The sock tip points {tip}, so the wind is blowing {tip}.' },
    sockLabel: { en: 'Windsock. The tip points {tip}.' },
    wind: { en: 'Wind' }, windCaption: { en: 'The wind is blowing.' }, you: { en: 'YOU' }, north: { en: 'N' },
    group: { en: 'Which way do you go?' }, goLabel: { en: 'Go {dir}' },
    wrongDown: { en: 'That is **downwind**. The fumes would blow right at you! Try another way.' },
    wrongSide: { en: 'Sideways is not safe enough, because fumes spread. Go **upwind**, toward where the wind comes from.' },
    right: { en: 'Upwind! You walk **{from}**, toward where the wind comes from.' },
    explain: { en: 'The sock tip points **{tip}**, so the wind blows toward the {tip}. Walk the other way, **{from}**. That is **upwind**. Then go uphill, far from the spill, and **tell an adult**.' },
    legendWind: { en: 'The wind blows {tip}' }, legendYou: { en: 'You walk {from} (upwind)' },
    cont: { en: 'Continue ▶' }, right_: { en: 'Right way' }, wrong_: { en: 'Not this way' }
  };
  SJ.STR_WIND = STR;

  /* ---------- the pixel arrow ---------- */
  /** 15 × 15 px arrow (plus a 1 px ink outline) drawn pixel by pixel, one per compass direction, so diagonals stay crisp. */
  function arrowCanvas(dir, fill, ink) {
    const N = 15, c = 7, v = W.VEC[dir] || [1, 0], len = Math.hypot(v[0], v[1]), ux = v[0] / len, uy = v[1] / len;
    const on = (x, y) => {
      if (x < 0 || y < 0 || x >= N || y >= N) return false;
      const dx = x - c, dy = y - c, a = dx * ux + dy * uy, p = Math.abs(dx * uy - dy * ux);
      return (a >= -6 && a <= 2.5 && p <= 1.2) || (a > 1.5 && a <= 7.4 && p <= (7.4 - a) * 0.85 + 0.2);
    };
    const cv = document.createElement('canvas'); cv.width = cv.height = N + 2;
    const g = cv.getContext('2d');
    for (let y = -1; y <= N; y++) for (let x = -1; x <= N; x++) {
      if (on(x, y)) { g.fillStyle = fill || '#fff8e6'; g.fillRect(x + 1, y + 1, 1, 1); }
      else if (on(x - 1, y) || on(x + 1, y) || on(x, y - 1) || on(x, y + 1)) { g.fillStyle = ink || '#1e1538'; g.fillRect(x + 1, y + 1, 1, 1); }
    }
    cv.className = 'ag-px sj-arrowart';
    return cv;
  }
  const sized = (cv, k) => { cv.style.width = cv.width * k + 'px'; cv.style.height = cv.height * k + 'px'; return cv; };

  /* ---------- the windsock (two-frame flap, drawn from the 8-direction art) ---------- */
  class Windsock {
    constructor(o) {
      o = o || {};
      this.dir = o.dir || 'e'; this.scale = o.scale || 3; this.frame = 0;
      this.el = h('canvas', { class: 'ag-px sj-sock', width: 32, height: 32, role: 'img', 'aria-label': fmt(STR.sockLabel, { tip: low(this.dir) }) });
      this.el.style.width = 32 * this.scale + 'px'; this.el.style.height = 32 * this.scale + 'px';
      AG.assets.loadImage(K + 'windsock.' + this.dir).then(() => this.draw());
      if (!AG.reducedMotion()) this.timer = setInterval(() => { this.frame ^= 1; this.draw(); }, T.sockMs);
    }
    draw() {
      const g = this.el.getContext('2d');
      g.clearRect(0, 0, 32, 32); g.imageSmoothingEnabled = false;
      AG.assets.draw(g, K + 'windsock.' + this.dir, 0, 0, 32, 32, this.frame);
    }
    setDir(d) { this.dir = d; this.el.setAttribute('aria-label', fmt(STR.sockLabel, { tip: low(d) })); this.draw(); }
    destroy() { clearInterval(this.timer); this.el.remove(); }
  }

  /* ---------- the finale ---------- */
  class Upwind {
    constructor(host, ctx, o) {
      this.host = host; this.ctx = ctx; this.o = o;
      this.tip = o.tip; this.right = W.opposite(o.tip); this.tries = 0; this.settled = false; this.offs = []; this.timers = [];
      this.opts = W.options(this.tip);
      const sceneKey = K + 'scene.' + o.sceneId;
      this.sock = new Windsock({ dir: this.tip, scale: 3 });
      const art = h('img', { class: 'ag-px sj-wind__img', src: AG.assets.url(sceneKey) || AG.assets.placeholderURL(sceneKey, 480, 270), alt: '', draggable: 'false' });
      const scene = h('figure', { class: 'sj-wind__scene' },
        h('div', { class: 'sj-wind__art' }, art, h('span', { class: 'sj-wind__sock' }, this.sock.el)),
        h('figcaption', { class: 'sj-wind__cap' }, pick(STR.windCaption) + ' ' + fmt(STR.sockLine, { tip: low(this.tip) })));
      this.btns = this.opts.map((d, i) => this.arrowButton(d, i));
      const grid = h('div', { class: 'sj-compass', role: 'group', 'aria-label': pick(STR.group) },
        h('span', { class: 'sj-compass__n', 'aria-hidden': 'true' }, '▲ ' + pick(STR.north)),
        h('span', { class: 'sj-compass__you' }, AG.ui.icon('star', 18, '', 'sj-ico'), h('b', {}, pick(STR.you))),
        ...this.btns);
      this.say = h('p', { class: 'sj-wind__say', role: 'status', 'aria-live': 'polite' });
      this.explainEl = h('div', { class: 'sj-wind__explain', hidden: true });
      this.next = h('button', { type: 'button', class: 'ag-btn sj-next', hidden: true }, pick(STR.cont));
      this.offs.push(SJ.onPress(this.next, () => this.finish()));
      this.el = h('section', { class: 'sj-wind', 'aria-label': pick(STR.eyebrow) },
        h('span', { class: 'ag-eyebrow' }, pick(STR.eyebrow)), scene,
        h('p', { class: 'sj-wind__ask' }, rich(STR.ask)), grid, this.say, this.explainEl, this.next);
      host.append(this.el);
      this.loop = AG.sfx.loop(K + 'sfx.wind_loop', { volume: 0.2 });
      // ↑ ← previous · ↓ → next · 1–4 pick (Enter presses the focused arrow)
      for (const [a, d] of [['UP', -1], ['LEFT', -1], ['DOWN', 1], ['RIGHT', 1]]) this.offs.push(AG.input.on(a, e => { if (e.phase === 'down') this.step(d); }));
      const key = e => {
        const n = parseInt(e.key, 10);
        if (!this.el.isConnected || this.settled || e.target.closest('input,textarea') || !(n >= 1 && n <= this.btns.length)) return;
        e.preventDefault(); this.choose(this.opts[n - 1], this.btns[n - 1]);
      };
      window.addEventListener('keydown', key); this.offs.push(() => window.removeEventListener('keydown', key));
      this.timers.push(setTimeout(() => this.btns[0] && this.btns[0].focus({ preventScroll: true }), 80));
    }

    arrowButton(d, i) {
      const v = W.VEC[d];
      const b = h('button', { type: 'button', class: 'sj-arrow', 'data-dir': d, 'aria-label': (i + 1) + ': ' + fmt(STR.goLabel, { dir: W.NAME[d] }), style: { gridColumn: String(v[0] + 2), gridRow: String(v[1] + 2) } },
        h('span', { class: 'sj-arrow__key', 'aria-hidden': 'true' }, String(i + 1)), sized(arrowCanvas(d), 3), h('span', { class: 'sj-arrow__name' }, W.NAME[d]));
      this.offs.push(SJ.onPress(b, () => this.choose(d, b)));
      return b;
    }
    live() { return this.btns.filter(b => !b.disabled); }
    step(dir) {
      if (this.settled) return;
      const l = this.live(); if (!l.length) return;
      const cur = l.indexOf(document.activeElement);
      l[cur < 0 ? (dir > 0 ? 0 : l.length - 1) : (cur + dir + l.length) % l.length].focus({ preventScroll: true });
      AG.sfx.play('tap');
    }
    mark(btn, ok) {
      btn.classList.add(ok ? 'is-right' : 'is-wrong');
      btn.append(h('span', { class: 'sj-arrow__mark', 'aria-hidden': 'true' }, ok ? '✔ ' + pick(STR.right_) : '✖ ' + pick(STR.wrong_)));
    }
    choose(dir, btn) {
      if (this.settled || btn.disabled) return;
      this.tries++;
      const kind = W.kind(this.tip, dir);
      if (kind !== 'up') {
        btn.disabled = true; this.mark(btn, false);
        const text = pick(kind === 'down' ? STR.wrongDown : STR.wrongSide);
        this.say.replaceChildren(rich({ en: text }));
        AG.sfx.play('soft'); this.o.react('worried');
        const l = this.live(); if (l.length) l[0].focus({ preventScroll: true });
        return;
      }
      this.settled = true;
      this.mark(btn, true);
      this.btns.forEach(b => { if (b !== btn) b.disabled = true; });
      AG.sfx.play('good'); this.o.react('cheer');
      this.say.replaceChildren(rich({ en: fmt(STR.right, { from: low(this.right) }) }));
      if (this.loop) this.loop.volume(0.08);
      this.explain();
    }

    /** The short arrow animation: the wind goes along the sock tip, you go the other way. Arrow + words, no colour needed. */
    explain() {
      const { ctx } = this, tipV = W.VEC[this.tip], youV = W.VEC[this.right], vars = { tip: low(this.tip), from: low(this.right) };
      const a = (dir, v, cls) => {
        const el = h('span', { class: 'sj-demo__a ' + cls }, sized(arrowCanvas(dir), 3));
        el.style.setProperty('--dx', v[0] * 40 + 'px'); el.style.setProperty('--dy', v[1] * 40 + 'px');
        return el;
      };
      const demo = h('div', { class: 'sj-demo', role: 'img', 'aria-label': fmt(STR.legendWind, vars) + '. ' + fmt(STR.legendYou, vars) },
        h('span', { class: 'sj-demo__you', 'aria-hidden': 'true' }, pick(STR.you)), a(this.tip, tipV, 'is-wind'), a(this.right, youV, 'is-you'));
      const legend = h('ul', { class: 'sj-legend' },
        h('li', {}, sized(arrowCanvas(this.tip), 2), h('span', {}, fmt(STR.legendWind, vars))),
        h('li', {}, sized(arrowCanvas(this.right), 2), h('span', {}, fmt(STR.legendYou, vars))));
      const pose = AG.rig.resolve(ctx.expertId, 'point').frame;
      const box = AG.dialogue.box({ speaker: ctx.expertId, style: 'info', text: { en: fmt(STR.explain, vars) }, pose, typewriter: AG.store.setting('typewriter') !== false && !AG.reducedMotion(), plainFont: AG.store.setting('plainFont') });
      this.explainEl.replaceChildren(h('div', { class: 'sj-wind__demo' }, demo, legend), box);
      this.explainEl.hidden = false; this.next.hidden = false;
      this.timers.push(setTimeout(() => { this.next.focus({ preventScroll: false }); }, 120));
    }
    finish() {
      if (this.done) return; this.done = true;
      this.o.onDone({ tries: this.tries, firstTry: this.tries === 1 });
    }
    destroy() {
      this.offs.forEach(f => f()); this.offs = [];
      this.timers.forEach(clearTimeout); this.timers = [];
      if (this.loop) this.loop.stop();
      this.sock.destroy(); this.el.remove();
    }
  }

  SJ.arrowCanvas = arrowCanvas; SJ.Windsock = Windsock; SJ.Upwind = Upwind;
})(window.AG);
