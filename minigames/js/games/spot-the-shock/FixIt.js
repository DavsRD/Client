/* Spot the Shock, level 5 (FIX IT): after each find the role expert asks "How do we fix it?" and the player
 * picks one of 3 fixes: number keys 1–3, a tap, or a drag onto either picture. The right fix calls onRight
 * (the scene swaps in the "fixed" overlay); a wrong one shows the expert's tip and is crossed out, with no
 * penalty, and the player picks again. Only the first try counts for points and the Fixer badge.
 *   new AG.spotTheShock.FixIt(host, ctx, { zone, cards, targets: [canvas, canvas], onWrong(), onRight(firstTry) }) */
window.AG = window.AG || {};
(function (AG) {
  const { h } = AG.util;
  const ST = AG.spotTheShock;
  const pick = v => AG.pick(v);
  const STR = {
    eyebrow: { en: 'Fix it!' },
    ask: { en: 'How do we fix the **{label}**?' },
    how: { en: 'Press **1–3**, tap a fix, or drag it onto the picture.' },
    notQuite: { en: 'Not that one. ' }
  };
  const fmt = (t, vars) => pick(t).replace(/\{(\w+)\}/g, (_, k) => (vars[k] == null ? '' : vars[k]));
  const rich = text => AG.dialogue.renderText(text, h('span'));
  /** A fix's icon: the pack's ui.fix_icon_<id> once it exists, else the pixel emoji. */
  const fixIcon = (id, emoji) => AG.assets.url('spot-the-shock.ui.fix_icon_' + id) || AG.pixelIcon(emoji || '🔧', 36);

  class FixIt {
    constructor(host, ctx, o) {
      this.ctx = ctx; this.o = o; this.tries = 0; this.closed = false; this.offs = [];
      const zone = o.zone.data, card = o.cards.hazards[zone.hazard];
      const ex = ctx.expertId, point = AG.rig.resolve(ex, 'point').frame;
      this.tip = h('p', { class: 'sts-fix__tip', role: 'status', 'aria-live': 'polite' }, rich(STR.how));
      this.chips = zone.fixOptions.map((id, i) => {
        const f = o.cards.fixes[id] || { text: { en: id } };
        const b = h('button', { type: 'button', class: 'sts-chip', 'data-dnd-item': '', 'data-fix': id, 'aria-label': (i + 1) + '. ' + pick(f.text) },
          h('span', { class: 'sts-chip__key', 'aria-hidden': 'true' }, String(i + 1)),
          h('img', { class: 'ag-px', src: fixIcon(id, f.icon), width: 36, height: 36, alt: '', draggable: 'false' }),
          h('span', { class: 'sts-chip__txt' }, pick(f.text)));
        b.addEventListener('click', e => { if (e.detail === 0) this.choose(id, b); }); // Enter / Space on a focused chip; pointers go through dnd
        return b;
      });
      this.el = h('section', { class: 'sts-fix', 'aria-label': pick(STR.eyebrow) },
        h('div', { class: 'sts-fix__top' },
          h('div', { class: 'sts-fix__who', 'aria-hidden': 'true' }, AG.chars.img(ex, point, 1)),
          h('div', { class: 'sts-fix__body' },
            h('span', { class: 'ag-eyebrow' }, '🔧 ' + pick(STR.eyebrow) + ' · ' + AG.chars.get(ex).name),
            h('p', { class: 'sts-fix__ask' }, rich({ en: fmt(STR.ask, { label: pick(card.label) }) })))),
        h('div', { class: 'sts-fix__chips' }, this.chips), this.tip);
      this.card = card; this.zone = zone;
      host.replaceChildren(this.el);
      o.targets.forEach(t => t.setAttribute('data-dnd-target', ''));
      this.dnd = AG.dnd({
        root: this.el, items: () => this.chips.filter(c => !c.disabled), targets: () => o.targets, keys: false,
        ghostSrc: el => el.querySelector('img').src,
        onTap: el => { this.choose(el.dataset.fix, el); return true; },
        onDrop: el => this.choose(el.dataset.fix, el)
      });
      for (let n = 1; n <= 3; n++) this.offs.push(AG.input.on('CHOICE_' + n, e => {
        const b = this.chips[n - 1];
        if (e.phase === 'down' && b && !b.disabled) this.choose(b.dataset.fix, b);
      }));
      this.el.scrollIntoView({ block: 'nearest', behavior: AG.reducedMotion() ? 'auto' : 'smooth' });
    }
    choose(id, btn) {
      if (this.closed || btn.disabled || AG.paused) return;
      this.tries++;
      if (id === this.zone.correctFix) {
        btn.classList.add('is-right');
        this.chips.forEach(c => { c.disabled = true; });
        this.close();
        this.o.onRight(this.tries === 1);
        return;
      }
      btn.classList.add('is-wrong'); btn.disabled = true;
      btn.setAttribute('aria-label', btn.getAttribute('aria-label') + ' ✖');
      this.tip.replaceChildren(rich({ en: pick(STR.notQuite) + pick(this.card.tip) }));
      AG.sfx.play('spot-the-shock.sfx.wrong');
      this.o.onWrong();
    }
    close() {
      if (this.closed) return;
      this.closed = true;
      this.offs.forEach(f => f()); this.offs = [];
      this.dnd.destroy();
      this.o.targets.forEach(t => t.removeAttribute('data-dnd-target'));
      this.el.remove();
    }
    destroy() { this.close(); }
  }

  ST.FixIt = FixIt;
})(window.AG);
