/* Lunch Table Logic: the Upstander Moments, played after each level (data/upstander.json).
 *
 *   new AG.lunchTable.Upstander(stage, ctx, { moments, people, seed, onDone({ ranks }) })
 *
 * One moment at a time: a short pixel scene (playground, hallway, or the class group chat), the role expert
 * with the megaphone (AGILA points), and three choices in a seeded order. Nobody in a scene is unkind; the
 * teasing is something "someone" did. A weaker choice never ends anything: the expert explains gently, the choice
 * is marked as tried, and the player picks again until they find the best one. ranks = the FIRST choice made in
 * each moment ('best' | 'second' | 'third'), which is what the score and stars read.
 * Keys: ↑ / ↓ + Enter, or 1–3. Touch / mouse: tap a choice. */
window.AG = window.AG || {};
(function (AG) {
  const { h } = AG.util;
  const LT = AG.lunchTable;
  const pick = v => AG.pick(v);

  const STR = {
    eyebrow: { en: 'Upstander moment' }, of: { en: '{i} of {n}' },
    lead: { en: 'An upstander stands with the person who is hurt. What would you do?' },
    best: { en: 'Great upstander!' }, second: { en: 'Good thinking!' }, third: { en: "Let's think again" },
    again: { en: 'Is there a choice that would help even more?' },
    next: { en: 'Next ▶' }, finish: { en: 'Finish ✔' },
    cast: { en: 'In this scene' }, unknown: { en: 'Unknown account' },
    moodWord: { happy: { en: 'feeling fine' }, neutral: { en: 'watching' }, sad: { en: 'feeling hurt' }, lonely: { en: 'feeling alone' } }
  };

  const CSS = `
#ag-app .lt-up { --k: 1; display: grid; gap: 12px; justify-items: center; color: var(--fg); }
@container (min-width: 1000px) { #ag-app .lt-up { --k: 2; } }
#ag-app .lt-up__head { display: flex; align-items: flex-end; gap: 12px; width: min(760px, 100%); }
#ag-app .lt-up__fig { flex: none; display: flex; align-items: flex-start; justify-content: center; height: 96px; overflow: hidden; }
#ag-app .lt-up__fig .ag-charimg { display: block; }
#ag-app .lt-up__fig--me { height: 72px; opacity: .95; }
#ag-app .lt-up__bubble { position: relative; flex: 1 1 auto; min-width: 0; display: grid; gap: 4px; padding: 10px 14px; color: #1e1538; background: #fff4cc; border: var(--b) solid #1e1538; box-shadow: 4px 4px 0 var(--shadow-c); }
#ag-app .lt-up__eyebrow { display: flex; justify-content: space-between; gap: 8px; font: 700 .8rem var(--font-display); text-transform: uppercase; letter-spacing: .06em; color: #4a4170; }
#ag-app .lt-up__lead { margin: 0; font-weight: 800; line-height: 1.3; }
#ag-app .lt-up__scene { margin: 0; width: min(100%, 640px); box-sizing: border-box; background: #fffaf0; border: var(--b) solid #1e1538; box-shadow: 4px 4px 0 var(--shadow-c); }
#ag-app .lt-up__art { display: grid; place-items: center; aspect-ratio: 16 / 9; background: var(--lt-scene) center / cover no-repeat, #bfe8ff; image-rendering: pixelated; }
#ag-app .lt-up__scene--chat .lt-up__art { aspect-ratio: auto; padding: 14px 0; }
#ag-app .lt-up__setting { margin: 0; padding: 8px 12px; font-weight: 800; line-height: 1.3; color: #1e1538; background: #fffaf0; border-top: var(--b) solid #1e1538; }
#ag-app .lt-up__cast { list-style: none; display: flex; flex-wrap: wrap; justify-content: center; gap: 10px; margin: 0; padding: 0; }
#ag-app .lt-up__cast li { display: grid; justify-items: center; gap: 2px; min-width: 64px; padding: 4px 6px; font: 700 .8rem / 1.2 var(--font-display); color: #1e1538; background: rgba(255, 250, 240, .92); border: 2px solid #1e1538; }
#ag-app .lt-up__cast li small { font-weight: 400; color: #4a4170; font-family: inherit; }
#ag-app .lt-up .lt-face { --k: 1; }
#ag-app .lt-up .ag-choices { width: min(760px, 100%); grid-template-columns: 1fr; }
@container (max-width: 599px) {
  #ag-app .lt-up__head { flex-wrap: wrap; justify-content: space-between; align-items: center; }
  #ag-app .lt-up__bubble { order: 3; flex: 1 1 100%; }
}
#ag-app .lt-up .ag-choice.tried { opacity: .55; }
#ag-app .lt-up .ag-choice.right { background: var(--safe-soft); }
#ag-app .lt-up__next { justify-self: center; }
#ag-app .lt-up__next[hidden] { display: none; }

/* the class group chat */
#ag-app .lt-chat { width: min(82%, 340px); box-sizing: border-box; background: #fffaf0; color: #1e1538; border: 4px solid #1e1538; box-shadow: 4px 4px 0 var(--shadow-c); image-rendering: auto; }
#ag-app .lt-chat__bar { padding: 4px 10px; font: 700 .85rem var(--font-display); color: #fff; background: #4aa8ee; border-bottom: 3px solid #1e1538; }
#ag-app .lt-chat__list { display: grid; gap: 8px; padding: 8px; }
#ag-app .lt-msg { display: flex; gap: 6px; align-items: flex-start; }
#ag-app .lt-msg .lt-face { --k: 1; flex: none; }
#ag-app .lt-msg__avatar { flex: none; display: grid; place-items: center; width: 32px; height: 32px; background: #d6d2f5; border: 2px solid #1e1538; }
#ag-app .lt-msg__body { min-width: 0; display: grid; gap: 2px; padding: 4px 8px; background: #e3defa; border: 2px solid #1e1538; border-radius: 4px; }
#ag-app .lt-msg--unknown .lt-msg__body { background: #ececec; border-style: dashed; }
#ag-app .lt-msg__name { font: 700 .75rem var(--font-display); color: #4a4170; }
#ag-app .lt-msg__text { margin: 0; font-weight: 700; font-size: .95rem; overflow-wrap: anywhere; }
#ag-app .lt-msg__photo { display: flex; align-items: center; gap: 6px; padding: 4px 6px; font-size: .8rem; font-style: italic; background: #fffaf0; border: 2px dashed #1e1538; }
#ag-app .lt-msg__react { justify-self: start; padding: 0 6px; font-size: .8rem; font-weight: 800; background: #fff4cc; border: 2px solid #1e1538; border-radius: 10px; }
#ag-app .lt-up .lt-ico { --k: 1; }`;
  function injectCss() {
    if (!document.querySelector('style[data-ag-css="lunch-table-up"]')) document.head.append(h('style', { 'data-ag-css': 'lunch-table-up' }, CSS));
  }
  const fmt = (t, vars) => pick(t).replace(/\{(\w+)\}/g, (_, k) => vars[k]);

  class Upstander {
    constructor(stage, ctx, o) {
      LT.injectCss(); injectCss();
      this.stage = stage; this.ctx = ctx; this.o = o;
      this.i = 0; this.ranks = []; this.offs = []; this.choices = null; this.timers = [];
      this.expert = new AG.CharacterRig(stage, ctx.expertId, 'portrait');
      this.expert.play(ctx.expertId === 'agila' ? 'point' : 'hold:megaphone');   // COMMS holds the megaphone; AGILA points
      this.player = ctx.rig('portrait');
      this.show();
    }

    /** The three choices in an order that is the same for the same seed (so a retry never reshuffles them). */
    order(m) {
      const rnd = AG.util.mulberry32(this.o.seed * 31 + this.i * 7919);
      return AG.util.shuffle(m.choices, rnd);
    }

    scene(m) {
      const art = LT.assetUrl('lunch-table.scene.' + m.scene);
      const pic = h('div', { class: 'lt-up__art' }, m.chat ? this.chat(m.chat) : null);
      if (art) pic.style.setProperty('--lt-scene', LT.cssUrl(art));
      return h('figure', { class: 'lt-up__scene lt-up__scene--' + m.scene }, pic, h('figcaption', { class: 'lt-up__setting' }, pick(m.setting)));
    }
    chat(c) {
      const people = this.o.people;
      const msgs = c.messages.map(msg => {
        const who = msg.from ? people[msg.from] : null;
        return h('div', { class: 'lt-msg' + (who ? '' : ' lt-msg--unknown') },
          who ? LT.face(who, 'neutral') : h('span', { class: 'lt-msg__avatar', 'aria-hidden': 'true' }, LT.pxIcon('👤')),
          h('div', { class: 'lt-msg__body' },
            h('b', { class: 'lt-msg__name' }, who ? who.name : pick(msg.name || STR.unknown)),
            msg.photo ? h('div', { class: 'lt-msg__photo' }, LT.pxIcon('🖼️'), h('span', {}, pick(msg.photo))) : null,
            h('p', { class: 'lt-msg__text' }, pick(msg.text)),
            msg.reactions ? h('span', { class: 'lt-msg__react' }, msg.reactions) : null));
      });
      return h('div', { class: 'lt-chat', role: 'log', 'aria-label': pick(c.title) }, h('div', { class: 'lt-chat__bar' }, pick(c.title)), h('div', { class: 'lt-chat__list' }, msgs));
    }

    show() {
      const { ctx, o } = this, m = o.moments[this.i], n = o.moments.length;
      this.clear();
      this.tries = 0; this.settled = false;
      this.expertFig = h('div', { class: 'lt-up__fig', 'aria-hidden': 'true' }, this.expert.img(1));
      this.meFig = h('div', { class: 'lt-up__fig lt-up__fig--me', 'aria-hidden': 'true' });
      this.setMe('think');
      const eyebrow = h('div', { class: 'lt-up__eyebrow' }, h('span', {}, pick(STR.eyebrow)), n > 1 ? h('span', {}, fmt(STR.of, { i: this.i + 1, n })) : null);
      const head = h('div', { class: 'lt-up__head' }, this.expertFig, h('div', { class: 'lt-up__bubble', role: 'status' }, eyebrow, h('p', { class: 'lt-up__lead' }, pick(STR.lead))), this.meFig);
      const cast = h('ul', { class: 'lt-up__cast', 'aria-label': pick(STR.cast) }, m.cast.map(c => {
        const p = o.people[c.id];
        return h('li', {}, LT.face(p, c.mood), h('span', {}, p.name), h('small', {}, pick(STR.moodWord[c.mood])));
      }));
      const opts = this.order(m).map(c => ({ text: c.text, ok: false, rank: c.rank, why: c.why }));
      this.choices = AG.kit.choices(opts, (opt, i, btn) => this.onPick(opt, i, btn), { label: m.ask });
      this.next = h('button', { type: 'button', class: 'ag-btn lt-up__next', hidden: true }, pick(this.i + 1 < n ? STR.next : STR.finish));
      this.next.addEventListener('click', () => this.advance());
      this.el = h('div', { class: 'lt-up', 'data-moment': m.id },
        head, this.scene(m), cast, this.choices.el, this.next);
      this.stage.append(this.el);
      // ↑ / ↓ move between the choices (Enter picks the focused one; 1–3 pick directly)
      for (const d of ['UP', 'DOWN']) this.offs.push(AG.input.on(d, e => { if (e.phase === 'down') this.step(d === 'DOWN' ? 1 : -1); }));
      this.timers.push(setTimeout(() => this.focusChoice(0), 60));
      this.stage.scrollTop = 0;
    }
    clear() {
      this.offs.forEach(f => f()); this.offs = [];
      this.timers.forEach(clearTimeout); this.timers = [];
      if (this.choices) this.choices.destroy();
      if (this.el) this.el.remove();
    }
    setMe(action) { this.player.play(action); this.meFig.replaceChildren(this.player.img(1)); }
    live() { return this.choices.btns.filter(b => !b.disabled); }
    focusChoice(i) { const l = this.live(); if (l.length) l[Math.max(0, Math.min(l.length - 1, i))].focus({ preventScroll: false }); }
    step(dir) {
      if (this.settled) return;
      const l = this.live(), cur = l.indexOf(document.activeElement);
      this.focusChoice(cur < 0 ? (dir > 0 ? 0 : l.length - 1) : (cur + dir + l.length) % l.length);
      AG.sfx.play('tap');
    }

    onPick(opt, i, btn) {
      if (this.settled) return;
      const { ctx } = this, first = this.tries++ === 0;
      if (first) this.ranks.push(opt.rank);
      const best = opt.rank === 'best';
      const text = best ? opt.why : { en: pick(opt.why) + ' ' + pick(STR.again) };
      ctx.say(best ? 'success' : 'retry', text, { speaker: ctx.expertId, title: pick(STR[opt.rank]), sound: false, ms: 14000 });
      btn.classList.add(best ? 'right' : 'tried');
      if (best) {
        this.settled = true;
        this.choices.lock();
        this.setMe('cheer');
        if (first) ctx.safe();
        AG.sfx.play('star');
        this.next.hidden = false;
        this.timers.push(setTimeout(() => this.next.focus(), 60));
      } else {
        btn.disabled = true;
        this.setMe(opt.rank === 'second' ? 'think' : 'worried');
        AG.sfx.play('soft');
        this.focusChoice(0);
      }
    }
    advance() {
      if (this.i + 1 < this.o.moments.length) { this.i++; this.show(); return; }
      this.clear();
      this.o.onDone({ ranks: this.ranks.slice() });
    }
    destroy() { this.clear(); }
  }

  LT.Upstander = Upstander;
  LT.UPSTANDER_STR = STR;
})(window.AG);
