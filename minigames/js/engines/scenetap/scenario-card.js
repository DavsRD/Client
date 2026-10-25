/* E2 SCENE-TAP ENGINE — ScenarioCard: a "what would you do?" card with pixel art, text and
 * choices (AG.kit.choices: tap, click, number keys, Enter on a focused button). Every choice has
 * its own feedback through ctx.say(); a wrong choice explains why, is crossed out, and the player
 * picks again (never harsh). Docs: kalasag-dev/minigames/docs/engines/scenetap.md
 *
 *   const card = new AG.scenetap.ScenarioCard({ ctx, art: 'lost-and-found.card.stay_put', title, text,
 *     choices: [{ text, icon, ok: true, why }, { text, ok: false, why, feedback: { type: 'warning', text } }],
 *     onAnswer(choice, i, { ok, firstTry, tries }), onDone(choice, { firstTry, tries }) });
 *   stage.append(card.el); card.focus();   …   card.destroy()
 * Defaults: right → ctx.say('success', why || ctx.characterLine()); wrong → ctx.say('retry', why).
 * While a card is up, set the SceneView's enabled = false (both listen to Enter and 1–9). */
window.AG = window.AG || {};
(function (AG) {
  const { h } = AG.util;

  class ScenarioCard {
    constructor(o) {
      this.o = o = o || {};
      this.tries = 0; this.done = false;
      this.art = o.art ? AG.scenetap.px.mkCanvas(1, 1) : null;
      if (this.art) { this.art.className = 'ag-px'; this.art.setAttribute('aria-hidden', 'true'); this.drawArt(); }
      this.kit = AG.kit.choices(o.choices || [], (choice, i) => this.answer(choice, i), { label: o.label || AG.t('scenetap.choices'), compact: o.compact });
      this.el = h('section', { class: 'ags-card', role: 'group', 'aria-label': AG.pick(o.title) || AG.t('scenetap.choices') },
        this.art ? h('figure', { class: 'ags-card__art' }, this.art) : null,
        h('div', { class: 'ags-card__body' },
          o.title ? h('h3', { class: 'ags-card__title' }, AG.pick(o.title)) : null,
          o.text ? h('p', { class: 'ags-card__text' }, AG.pick(o.text)) : null,
          this.kit.el));
      if (this.art && typeof ResizeObserver !== 'undefined') { this.ro = new ResizeObserver(() => this.fit()); this.ro.observe(this.el); }
    }
    async drawArt() {
      const a = this.o.art;
      let w, hh, paint;
      if (typeof a === 'string') {
        const rec = await AG.assets.loadImage(a);
        w = rec.w || 160; hh = rec.h || 90;
        paint = c => AG.assets.draw(c, a, 0, 0, w, hh);
      } else { w = a.naturalWidth || a.width; hh = a.naturalHeight || a.height; paint = c => c.drawImage(a, 0, 0); }
      this.art.width = w; this.art.height = hh;
      const c = this.art.getContext('2d'); c.imageSmoothingEnabled = false; paint(c);
      this.fit();
    }
    /** The art at the largest whole multiple that fits the card (at most maxScale, default 3). */
    fit() {
      if (!this.art || !this.el.isConnected) return;
      const box = this.el.querySelector('.ags-card__art'), avail = (box && box.clientWidth) || this.el.clientWidth;
      const s = Math.max(1, Math.min(this.o.maxScale || 3, Math.floor(avail / this.art.width)));
      this.art.style.width = this.art.width * s + 'px'; this.art.style.height = this.art.height * s + 'px';
    }
    say(type, text) {
      const ctx = this.o.ctx;
      if (ctx && ctx.say) return ctx.say(type, text);
      const stage = this.o.stage || this.el.closest('.ag-stage');
      return AG.ui.feedback(stage, text, { type });
    }
    answer(choice, i) {
      if (this.done) return;
      this.tries++;
      const ok = !!choice.ok, res = { ok, firstTry: ok && this.tries === 1, tries: this.tries }, fb = choice.feedback || {};
      if (ok) {
        this.done = true; this.kit.mark(i, true); this.kit.lock();
        const ctx = this.o.ctx;
        this.say(fb.type || 'success', fb.text || choice.why || (ctx && ctx.characterLine ? ctx.characterLine() : AG.t('scenetap.right')));
      } else {
        this.kit.mark(i, false);
        this.say(fb.type || 'retry', fb.text || choice.why || AG.t('scenetap.tryAgain'));
        const next = this.kit.btns.find(b => !b.disabled);
        if (next && this.el.contains(document.activeElement)) next.focus();
      }
      if (this.o.onAnswer) this.o.onAnswer(choice, i, res);
      if (ok && this.o.onDone) this.o.onDone(choice, res);
    }
    focus() { const b = this.kit.btns.find(x => !x.disabled); if (b) b.focus({ preventScroll: true }); }
    destroy() { this.kit.destroy(); if (this.ro) this.ro.disconnect(); this.el.remove(); }
  }

  AG.scenetap = Object.assign(AG.scenetap || {}, { ScenarioCard });
})(window.AG);
