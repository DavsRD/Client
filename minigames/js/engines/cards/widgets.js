/* E6 CARDS ENGINE — small widgets for card and word games.
 *
 *   new AG.cards.Timer({ seconds: 120, warnAt: 10, onEnd, onTick(left), style: 'bar' | 'ring' })
 *        .el .start() .stop() .add(s) .left .elapsed .running
 *        seconds: null counts up (for time bonuses). Stops counting while the game is paused.
 *        Running low shows by colour AND shape (the bar's ▲ marker, bold time).
 *   new AG.cards.Streak({ windowMs: 3000, onChange(n, best) })
 *        .el .hit() → n .miss() .reset() .value .best
 *        windowMs: a hit later than this after the last one starts a new chain (speed chains)
 *   AG.cards.define(ctxOrStage, { word, definition, icon })
 *        a definition popup: the 'info' word box (AG.ui.feedback), so the role expert says it
 *        when given the game's ctx. Returns the box's close function. */
window.AG = window.AG || {};
(function (AG) {
  const { h } = AG.util;

  class Timer {
    constructor(opts) {
      this.opts = Object.assign({ warnAt: 10, style: 'bar' }, opts || {});
      this.total = this.opts.seconds == null ? null : this.opts.seconds;
      this.ms = 0; this.running = false; this.ended = false; this.warned = false;
      this.text = h('b', { class: 'agc-timer__text' });
      if (this.opts.style === 'ring' && this.total != null) {
        this.ring = AG.kit.timerRing({ size: this.opts.size || 64 });
        this.el = h('span', { class: 'agc-timer agc-timer--ring', role: 'timer' }, this.ring.el, this.text);
      } else {
        this.fill = h('i');
        this.bar = h('span', { class: 'agc-timer__bar', 'aria-hidden': 'true' }, this.fill, h('span', { class: 'agc-timer__mark' }, '▲'));
        this.label = h('small', {}, AG.t(this.total == null ? 'cards.time' : 'cards.timeLeft'));
        this.el = h('span', { class: 'agc-timer' + (this.total == null ? ' agc-timer--up' : ''), role: 'timer' },
          this.label, this.total == null ? null : this.bar, this.text);
        if (this.bar) this.bar.lastChild.style.left = (this.opts.warnAt / this.total) * 100 + '%';
      }
      this.draw();
      this.offLang = AG.on('kalasag:languagechange', () => {
        if (this.label) this.label.textContent = AG.t(this.total == null ? 'cards.time' : 'cards.timeLeft');
        this.text.textContent = ''; this.draw(); // redraws the aria-label too
      });
    }
    get elapsed() { return this.ms / 1000; }
    get left() { return this.total == null ? Infinity : Math.max(0, this.total - this.ms / 1000); }
    add(s) { this.ms = Math.max(0, this.ms - s * 1000); this.ended = false; if (this.left > this.opts.warnAt) this.warned = false; this.draw(); }
    start() {
      if (this.running) return this;
      this.running = true; let last = performance.now();
      const tick = now => {
        if (!this.running) return;
        // a long gap (hidden tab, slow frame) counts at most 250 ms
        if (!AG.paused) this.ms += Math.min(250, now - last);
        last = now;
        this.draw();
        this.opts.onTick && this.opts.onTick(this.left);
        if (this.total != null && this.left <= 0 && !this.ended) { this.ended = true; this.running = false; this.opts.onEnd && this.opts.onEnd(); return; }
        this.raf = requestAnimationFrame(tick);
      };
      this.raf = requestAnimationFrame(tick);
      return this;
    }
    stop() { this.running = false; cancelAnimationFrame(this.raf); return this; }
    draw() {
      const shown = this.total == null ? this.elapsed : this.left;
      const t = AG.ui.fmtTime(this.total == null ? Math.floor(shown) : shown);
      if (this.text.textContent !== t) { this.text.textContent = t; this.el.setAttribute('aria-label', AG.t(this.total == null ? 'cards.time' : 'cards.timeLeft') + ' ' + t); }
      if (this.total == null) return;
      const v = this.left / this.total, low = this.left <= this.opts.warnAt;
      if (this.ring) this.ring.set(v);
      else this.fill.style.width = Math.ceil(v * 20) * 5 + '%'; // 20 stepped blocks
      this.el.classList.toggle('is-low', low);
      if (low && !this.warned && this.left > 0) { this.warned = true; this.opts.onWarn && this.opts.onWarn(); }
    }
    destroy() { this.stop(); this.offLang(); }
  }

  class Streak {
    constructor(opts) {
      this.opts = opts || {};
      this.value = 0; this.best = 0; this.lastHit = 0;
      this.num = h('b');
      this.el = h('span', { class: 'agc-streak', role: 'status', 'aria-label': '' }, AG.ui.icon('star', 18), h('span', { class: 'agc-streak__x', 'aria-hidden': 'true' }, '×'), this.num);
      this.draw(false);
    }
    hit(now) {
      now = now != null ? now : performance.now();
      const w = this.opts.windowMs;
      this.value = w && this.value && now - this.lastHit > w ? 1 : this.value + 1;
      this.lastHit = now; this.best = Math.max(this.best, this.value);
      this.draw(true);
      return this.value;
    }
    miss() { this.value = 0; this.draw(false); return 0; }
    reset() { this.value = 0; this.best = 0; this.lastHit = 0; this.draw(false); }
    draw(bump) {
      this.num.textContent = this.value;
      this.el.classList.toggle('is-on', this.value >= 2);
      this.el.setAttribute('aria-label', AG.t('cards.streak') + ' ' + this.value);
      if (bump && !AG.reducedMotion()) { this.el.classList.remove('bump'); void this.el.offsetWidth; this.el.classList.add('bump'); }
      this.opts.onChange && this.opts.onChange(this.value, this.best);
    }
  }

  /** A definition popup in the 'info' word box. With the game's ctx the role expert says it. */
  function define(target, entry, opts) {
    entry = entry || {};
    const text = entry.definition || entry.text || '';
    const o = Object.assign({ title: entry.word, icon: entry.icon && AG.icons.has(entry.icon) ? entry.icon : undefined, ms: 7000 }, opts || {});
    if (target && typeof target.say === 'function') return target.say('info', text, o);
    return AG.ui.feedback(target, text, Object.assign({ type: 'info' }, o));
  }

  AG.cards = Object.assign(AG.cards || {}, { Timer, Streak, define });
})(window.AG);
