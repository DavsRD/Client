/* Lost & Found, phase 3: TELL THE HELPER (memory). The role expert is the info-desk helper.
 *   the PRACTICE CARD (a made-up name, a fake number that always starts 0900 000) shows for 6 s (Advanced 4 s),
 *   then hides → the name: a ChoiceModal of 3 names (no typing) → the number: a number pad for the last 4 digits
 *   (digit keys, Backspace, Enter; or the on-screen pad), partial credit per digit in its place → the helper calls
 *   (hold:radio) → the family arrives (happy → cheer) → the Safe Choices card.
 * Privacy: there is no text field; the digits typed live only in this object and are wiped once checked. */
window.AG = window.AG || {};
(function (AG) {
  const { h } = AG.util;
  const LF = AG.lostFound, T = LF.tuning, P = T.points;
  const K = 'lost-and-found.';
  const pick = v => AG.pick(v);

  const STR = {
    walk: { en: 'The {helper} takes you to the info desk.' },
    walkDesk: { en: 'You are at the info desk.' },
    desk: { en: 'Info desk' },
    remember: { en: 'This is your **PRACTICE CARD**. Remember the name and the number!' },
    hidden: { en: 'The card is put away. Can you remember it?' },
    cardTitle: { en: 'PRACTICE CARD' }, cardName: { en: 'Name' }, cardNum: { en: "Parent's number" }, cardFoot: { en: 'Made up, just for practice' },
    askName: { en: 'The helper asks: "What is your name?"' },
    nameRight: { en: 'Yes! The name on your card is {name}.' },
    nameWrong: { en: 'Your card had a different name.' },
    nameIs: { en: 'Your card said: **{text}**.' },
    askNum: { en: 'Now tell the helper your parent\'s number.' },
    numHelp: { en: 'Type the last 4 digits: number keys or the pad, ⌫ to fix, Enter or ✔ when done.' },
    numPad: { en: 'Number pad' }, del: { en: 'Delete' }, ok: { en: 'Done' },
    numAll: { en: 'Every digit is right! ✔' },
    numSome: { en: '{n} of 4 digits in the right place. The card said {number}.' },
    calling: { en: '📻 Calling your family now!' },
    callMe: { en: 'The helper is calling my family!' },
    family: { en: 'Your family is here!' },
    familyMe: { en: 'I stayed, found a safe helper and told them who I am!' },
    cont: { en: 'Continue ▶' }
  };

  /** Draws the PRACTICE CARD on a 320 × 200 canvas (the 160 × 100 card art at 2×, text on top). */
  function drawCard(cv, card) {
    cv.width = 320; cv.height = 200;
    const c = cv.getContext('2d'), tx = (s, x, y, o) => AG.gfx.text(c, s, x, y, o);
    c.imageSmoothingEnabled = false;
    AG.assets.draw(c, K + 'ui.id_card', 0, 0, 320, 200);
    c.fillStyle = '#ffffff'; c.fillRect(128, 46, 182, 124);
    tx(pick(STR.cardTitle), 160, 10, { size: 18, bold: true, align: 'center', color: '#ffffff', outline: '#1e1538' });
    tx(pick(STR.cardName), 132, 50, { size: 12, color: '#4a4170' });
    tx(card.name, 132, 66, { size: 18, bold: true });
    tx(pick(STR.cardNum), 132, 108, { size: 12, color: '#4a4170' });
    tx(card.number, 132, 124, { size: 18, bold: true });
    tx(pick(STR.cardFoot), 160, 179, { size: 11, align: 'center', color: '#1e1538' });
  }

  class TellHelper {
    constructor(scene, helperId) { this.s = scene; this.helperId = helperId; this.offs = []; this.timers = []; this.typed = ''; }
    after(ms, fn) { const id = this.s.ctx.after(ms, () => { if (!this.s.over && !this.dead) fn(); }); this.timers.push(id); return id; }
    start() {
      const s = this.s, ex = s.ctx.expertId;
      this.card = LF.practiceCard(s.o.names, s.seed + 5);
      this.fig = h('div', { class: 'lf-tell__fig' }, LF.expertFigure(ex, 'idle'));
      this.status = h('p', { class: 'lf-say', role: 'status', 'aria-live': 'polite' });
      this.body = h('div', { class: 'lf-tell__body' });
      this.el = h('section', { class: 'lf-panel lf-tell' },
        h('div', { class: 'lf-expert' }, this.fig, h('div', { class: 'lf-expert__body' },
          h('span', { class: 'lf-tag' }, 'ℹ ' + pick(STR.desk) + ' · ' + AG.chars.get(ex).name), this.status)),
        this.body);
      s.board.append(this.el);
      s.setMe('idle');
      const hd = this.helperId && s.safe.helpers[this.helperId];
      s.say(hd && this.helperId !== 'infodesk' ? LF.fmt(STR.walk, { helper: pick(hd.label).toLowerCase() }) : STR.walkDesk);
      this.showCard();
    }
    setStatus(t, vars) { this.status.replaceChildren(LF.rich({ en: LF.fmt(t, vars || {}) })); }
    setFig(action) { this.fig.replaceChildren(LF.expertFigure(this.s.ctx.expertId, action)); }

    /* ---------- the card: shown, then hidden ---------- */
    showCard() {
      const s = this.s, ms = T.cardMs[s.diff];
      const cv = h('canvas', { class: 'ag-px lf-card', role: 'img', 'aria-label': pick(STR.cardTitle) + ': ' + this.card.name + ', ' + this.card.number });
      AG.assets.loadImage(K + 'ui.id_card').then(() => { if (!this.dead) drawCard(cv, this.card); });
      drawCard(cv, this.card);
      const ring = AG.kit.timerRing({ size: 48, segments: 20 });
      this.ring = ring;
      this.body.replaceChildren(h('div', { class: 'lf-cardwrap' }, cv, ring.el));
      this.setStatus(STR.remember);
      s.setMe('think');
      ring.run(ms, () => { if (!this.dead) this.askName(); });
    }

    /* ---------- the name: 3 choices ---------- */
    askName() {
      const s = this.s, card = this.card;
      this.body.replaceChildren();
      this.setStatus(STR.hidden);
      const options = LF.nameChoices(s.o.names, card, s.diff, s.seed + 9).map(o => Object.assign(o, { why: o.ok ? { en: LF.fmt(STR.nameRight, { name: card.name }) } : STR.nameWrong }));
      this.modal = new LF.ChoiceModal(this.body, s.ctx, {
        eyebrow: { en: '🪪 ' + pick(STR.cardName) }, ask: STR.askName, options, reveal: STR.nameIs,
        onWrong: () => s.react('think'),
        onRight: (opt, first) => {
          s.run.nameFirst = first;
          if (first) s.react('happy');
          s.updateHud();
        },
        onDone: () => { this.modal.destroy(); this.modal = null; this.askNumber(); }
      });
    }

    /* ---------- the number: a pad for the last 4 digits ---------- */
    askNumber() {
      const s = this.s, I = AG.input;
      this.setStatus(STR.hidden);
      this.slots = Array.from({ length: T.digits }, () => h('span', { class: 'lf-slot' }, ''));
      const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'del', '0', 'ok'];
      this.okBtn = null;
      const pad = h('div', { class: 'lf-pad', role: 'group', 'aria-label': pick(STR.numPad) }, keys.map(k => {
        const label = k === 'del' ? '⌫' : k === 'ok' ? '✔' : k;
        const b = h('button', { type: 'button', class: 'ag-btn ag-btn--alt lf-pad__key' + (k === 'ok' ? ' lf-pad__ok' : ''), tabindex: '-1',
          'aria-label': k === 'del' ? pick(STR.del) : k === 'ok' ? pick(STR.ok) : k }, label);
        if (k === 'ok') this.okBtn = b;
        b.addEventListener('click', e => {
          if (LF.ghost(e, this.tPad)) return;
          this.press(k);
          s.stage.focus({ preventScroll: true }); // keys keep working; Enter never re-presses this button
        });
        return b;
      }));
      this.numLine = h('div', { class: 'lf-num', 'aria-live': 'polite' }, h('span', { class: 'lf-num__pre' }, T.prefix), ...this.slots);
      this.result = h('p', { class: 'lf-why', role: 'status', hidden: true });
      this.body.replaceChildren(h('div', { class: 'lf-numwrap' },
        h('h3', { class: 'lf-modal__ask' }, pick(STR.askNum)), h('p', { class: 'lf-help' }, pick(STR.numHelp)), this.numLine, pad, this.result));
      this.tPad = performance.now();
      this.padOn = true;
      I.register('DIGIT_0', { keys: ['Digit0', 'Numpad0'] });
      const on = (a, fn) => this.offs.push(I.on(a, e => { if (e.phase === 'down' && this.padOn) fn(); }));
      for (let n = 1; n <= 9; n++) on('CHOICE_' + n, () => this.press(String(n)));
      on('DIGIT_0', () => this.press('0'));
      on('UNDO', () => this.press('del'));
      on('CONFIRM', () => this.press('ok'));
      this.renderSlots();
      s.stage.focus({ preventScroll: true });
    }
    press(k) {
      if (!this.padOn) return;
      if (k === 'del') this.typed = this.typed.slice(0, -1);
      else if (k === 'ok') { if (this.typed.length === T.digits) { this.submit(); return; } }
      else if (this.typed.length < T.digits) this.typed += k;
      AG.sfx.play('tap');
      this.renderSlots();
    }
    renderSlots() {
      this.slots.forEach((el, i) => { el.textContent = this.typed[i] || ''; el.classList.toggle('is-next', i === this.typed.length); });
      if (this.okBtn) this.okBtn.disabled = this.typed.length !== T.digits;
    }
    submit() {
      const s = this.s, res = LF.digitScore(this.card.digits, this.typed);
      this.padOn = false;
      this.typed = ''; // nothing typed is kept
      s.run.digits = res.right;
      this.slots.forEach((el, i) => { el.classList.remove('is-next'); el.classList.add(res.marks[i] ? 'is-right' : 'is-wrong'); el.textContent = this.card.digits[i]; });
      this.result.hidden = false;
      this.result.replaceChildren(LF.rich({ en: res.right === T.digits ? pick(STR.numAll) : LF.fmt(STR.numSome, { n: res.right, number: this.card.number }) }));
      this.body.querySelectorAll('.lf-pad__key').forEach(b => { b.disabled = true; });
      AG.sfx.play(res.right === T.digits ? 'good' : 'soft');
      if (res.right) this.popAt(this.numLine, '+' + res.right * P.digit);
      if (res.right === T.digits) s.react('happy');
      s.updateHud();
      this.after(1600, () => this.call());
    }
    popAt(el, text) {
      const r = el.getBoundingClientRect(), sr = this.s.stage.getBoundingClientRect();
      AG.kit.pop(this.s.stage, r.left - sr.left + r.width / 2, r.top - sr.top, text, true);
    }

    /* ---------- the call, then the family ---------- */
    call() {
      const s = this.s;
      this.setFig('hold:radio');
      this.setStatus(STR.calling);
      AG.sfx.play(K + 'sfx.call');
      s.setMe('idle');
      s.say(STR.callMe);
      this.after(T.callMs, () => this.family());
    }
    family() {
      const s = this.s;
      this.setFig('happy');
      this.setStatus(STR.family);
      AG.sfx.play(K + 'sfx.family');
      s.setMe('happy');
      this.after(900, () => s.setMe('cheer'));
      s.say(STR.familyMe);
      AG.kit.celebrate(s.stage);
      const cont = h('button', { type: 'button', class: 'ag-btn' }, pick(STR.cont));
      const t0 = performance.now();
      cont.addEventListener('click', e => { if (!LF.ghost(e, t0)) { s.next(null); s.safeCard(); } });
      this.body.replaceChildren(h('div', { class: 'lf-family' },
        LF.artCanvas(K + 'card.call_family', 2, 'lf-art lf-family__art'), h('p', { class: 'lf-say' }, '💛 ' + pick(STR.family)), h('div', { class: 'lf-actions' }, cont)));
      setTimeout(() => cont.focus({ preventScroll: true }), 60);
    }

    destroy() {
      this.dead = true; this.padOn = false; this.typed = '';
      if (this.ring) this.ring.stop();
      this.timers.forEach(id => this.s.ctx.clear(id));
      this.offs.forEach(f => f()); this.offs = [];
      if (this.modal) this.modal.destroy();
      if (this.el) this.el.remove();
    }
  }

  LF.TellHelper = TellHelper;
})(window.AG);
