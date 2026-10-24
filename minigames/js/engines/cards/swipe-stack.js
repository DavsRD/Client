/* E6 CARDS ENGINE — SwipeStack: a deck where the top card is sent LEFT or RIGHT.
 *
 *   const s = new AG.cards.SwipeStack({
 *     cards: [{ id, front: faceSpec | render(card) → Element, label, data }],
 *     labels: { left: { text: { en, fil }, icon: '✋' }, right: { text: { en, fil }, icon: '✔' } },
 *     onCommit(card, dir, { via }) { … }   // may return a Promise: the deck waits for it
 *     onEmpty() { … }
 *   });
 *   stage.append(s.el)
 *
 * Drag the top card (touch, mouse or pen): past 120 CSS px, or a fling of 600 CSS px/s the
 * way it is going, commits; anything less springs back (AG.logic.swipe). The side labels
 * fade in, in 4 steps, while dragging. ← / → (and A / D) commit; so do the ✋ / ✔ buttons
 * under the card. The card leans at most 0.05 rad (the prototype's lean) and moves in whole
 * pixels; with Reduce Motion it doesn't fly off or spring, it just goes.
 * s.commit(dir) (e.g. a timeout = 'left'), s.push(cards), s.top, s.remaining, s.lock() /
 * s.unlock(), s.destroy(). */
window.AG = window.AG || {};
(function (AG) {
  const { h } = AG.util;
  const S = () => AG.logic.swipe;
  const sfx = name => AG.sfx && AG.sfx.play(name);
  const LEAN = 0.05, FLY_MS = 200;

  class SwipeStack {
    constructor(opts) {
      this.opts = opts || {};
      this.queue = (this.opts.cards || []).slice();
      this.locked = 0; this.drag = null; this.done = 0;
      this.sides = {
        left: h('span', { class: 'agc-swipe__side agc-swipe__side--left', 'aria-hidden': 'true' }),
        right: h('span', { class: 'agc-swipe__side agc-swipe__side--right', 'aria-hidden': 'true' })
      };
      this.deck = h('div', { class: 'agc-swipe__deck', role: 'group' }, this.sides.left, this.sides.right);
      this.btn = {
        left: h('button', { type: 'button', class: 'ag-btn ag-btn--alt agc-swipe__btn agc-swipe__btn--left' }),
        right: h('button', { type: 'button', class: 'ag-btn agc-swipe__btn agc-swipe__btn--right' })
      };
      this.status = h('span', { class: 'agc-sr', 'aria-live': 'polite' });
      this.el = h('div', { class: 'agc-swipe' }, this.deck, h('div', { class: 'agc-swipe__btns' }, this.btn.left, this.btn.right), this.status);
      this.btn.left.addEventListener('click', () => this.commit('left', 'button'));
      this.btn.right.addEventListener('click', () => this.commit('right', 'button'));

      const mine = () => this.el.isConnected && (this.el.contains(document.activeElement) || document.activeElement === (this.opts.stage || this.el.closest('.ag-stage')));
      this.offs = [
        AG.input.on('LEFT', e => { if (e.phase === 'down' && mine()) this.commit('left', 'key'); }),
        AG.input.on('RIGHT', e => { if (e.phase === 'down' && mine()) this.commit('right', 'key'); }),
        AG.on('kalasag:languagechange', () => this.relabel())
      ];
      this.onDown = this.onDown.bind(this); this.onMove = this.onMove.bind(this); this.onUp = this.onUp.bind(this);
      this.deck.addEventListener('pointerdown', this.onDown);
      window.addEventListener('pointermove', this.onMove);
      window.addEventListener('pointerup', this.onUp);
      window.addEventListener('pointercancel', this.onUp);
      this.relabel();
      this.render();
    }

    labelOf(dir) {
      const l = (this.opts.labels || {})[dir] || {};
      return { text: AG.pick(l.text) || AG.t(dir === 'left' ? 'cards.left' : 'cards.right'), icon: l.icon || (dir === 'left' ? '✋' : '✔') };
    }
    relabel() {
      ['left', 'right'].forEach(d => {
        const l = this.labelOf(d);
        this.sides[d].textContent = d === 'left' ? l.icon + ' ' + l.text : l.text + ' ' + l.icon;
        this.btn[d].replaceChildren(h('span', { class: 'agc-swipe__glyph', 'aria-hidden': 'true' }, l.icon), h('span', {}, l.text));
        this.btn[d].setAttribute('aria-label', l.text);
      });
      this.deck.setAttribute('aria-label', AG.t('cards.cardsLeft', { n: String(this.remaining) }));
      if (this.queue[0]) this.status.textContent = this.cardLabel(this.queue[0]);
    }
    cardLabel(c) { return AG.pick(c.label) || AG.cards.faceLabel(c.front); }

    get top() { return this.queue[0] || null; }
    get remaining() { return this.queue.length; }
    push(cards) { this.queue.push(...[].concat(cards)); this.render(); }
    lock() { this.locked++; this.el.classList.add('is-locked'); }
    unlock() { this.locked = Math.max(0, this.locked - 1); if (!this.locked) this.el.classList.remove('is-locked'); }

    /** Draws the top 3 cards; only the top one is live. */
    render() {
      this.deck.querySelectorAll('.agc-swipecard:not(.is-gone)').forEach(n => n.remove());
      const show = this.queue.slice(0, this.opts.depth || 3);
      show.slice().reverse().forEach((c, ri) => {
        const depth = show.length - 1 - ri;
        if (!c._el) {
          c._el = h('div', { class: 'agc-swipecard' });
          c._el.append(typeof c.render === 'function' ? c.render(c) : AG.cards.face(c.front, { iconSize: c.iconSize || 72 }));
        }
        c._el.style.setProperty('--depth', depth);
        c._el.classList.toggle('is-top', depth === 0);
        c._el.setAttribute('aria-hidden', String(depth !== 0));
        c._el.style.transform = '';
        this.deck.append(c._el);
      });
      this.deck.classList.toggle('is-empty', !show.length);
      ['left', 'right'].forEach(d => { this.btn[d].disabled = !show.length; });
      this.setSide(0);
      this.relabel();
    }
    setSide(dx) {
      const a = S().labelAlpha(dx);
      this.sides.left.style.opacity = dx < 0 ? a : 0;
      this.sides.right.style.opacity = dx > 0 ? a : 0;
      this.deck.dataset.lean = dx > 0 && a >= 1 ? 'right' : dx < 0 && a >= 1 ? 'left' : '';
    }
    place(el, dx) {
      const lean = AG.util.clamp(dx / S().DISTANCE, -1, 1) * LEAN;
      el.style.transform = 'translateX(' + Math.round(dx) + 'px) rotate(' + lean.toFixed(3) + 'rad)';
    }

    /* ---------- dragging ---------- */
    onDown(e) {
      const top = this.top;
      if (!top || this.locked || AG.paused || e.button > 0 || !top._el || !top._el.contains(e.target)) return;
      if (e.target.closest('button, a, input')) return;
      this.drag = { id: e.pointerId, x: e.clientX, dx: 0, v: S().tracker(), el: top._el };
      this.drag.v.add(performance.now(), e.clientX);
      top._el.classList.add('is-dragging');
      top._el.setPointerCapture && top._el.setPointerCapture(e.pointerId);
    }
    onMove(e) {
      const d = this.drag; if (!d || e.pointerId !== d.id) return;
      d.dx = e.clientX - d.x; d.v.add(performance.now(), e.clientX);
      this.place(d.el, d.dx); this.setSide(d.dx);
    }
    onUp(e) {
      const d = this.drag; if (!d || e.pointerId !== d.id) return;
      this.drag = null;
      d.el.classList.remove('is-dragging');
      const vx = d.v.velocity();
      const dir = e.type === 'pointercancel' ? null : S().decide(d.dx, vx);
      this.lastRelease = { dx: Math.round(d.dx), vx: Math.round(vx), dir };
      if (dir) this.commit(dir, Math.abs(d.dx) >= S().DISTANCE ? 'drag' : 'fling', d.dx);
      else { d.el.style.transform = ''; this.setSide(0); }
    }

    /** Sends the top card one way. via: 'drag' | 'fling' | 'key' | 'button' | 'game'. */
    commit(dir, via, fromDx) {
      const card = this.top;
      if (!card || this.locked || AG.paused || (dir !== 'left' && dir !== 'right')) return false;
      this.queue.shift(); this.done++;
      const el = card._el;
      if (AG.reducedMotion()) el.remove();
      else {
        el.classList.add('is-gone');
        if (fromDx == null) this.place(el, 0);
        void el.offsetWidth;
        this.place(el, (dir === 'right' ? 1 : -1) * (this.deck.clientWidth + 120));
        setTimeout(() => el.remove(), FLY_MS + 40);
      }
      sfx(dir === 'right' ? 'tap' : 'blip');
      this.setSide(0);
      const res = this.opts.onCommit ? this.opts.onCommit(card, dir, { via: via || 'game' }) : null;
      const next = () => { this.render(); if (!this.queue.length && this.opts.onEmpty) this.opts.onEmpty(); };
      if (res && typeof res.then === 'function') { this.lock(); res.then(() => { this.unlock(); next(); }, () => { this.unlock(); next(); }); }
      else next();
      return true;
    }

    destroy() {
      this.offs.forEach(f => f());
      this.deck.removeEventListener('pointerdown', this.onDown);
      window.removeEventListener('pointermove', this.onMove);
      window.removeEventListener('pointerup', this.onUp);
      window.removeEventListener('pointercancel', this.onUp);
    }
  }

  AG.cards = Object.assign(AG.cards || {}, { SwipeStack });
})(window.AG);
