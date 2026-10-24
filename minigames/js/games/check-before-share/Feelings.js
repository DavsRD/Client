/* Check Before You Share: the feelings check-in at the end of every level.
 *
 *   new AG.checkShare.Feelings(scene, { onDone })
 *
 * "How are you feeling?" 😊 😟 😢 😠 — keys 1–4, a tap or a click. Every answer gets a warm
 * reply from the PLAYER's character, then "See my results". The answer lives only in this
 * panel's DOM: it is never written to AG.store, localStorage or done(), and never sent. */
window.AG = window.AG || {};
(function (AG) {
  const { h } = AG.util;
  const CS = AG.checkShare, R = CS.rules;
  const S = (en, fil) => ({ en, fil });

  const STR = {
    ask: S('How are you feeling?', 'Ano ang nararamdaman mo?'),
    note: S('Pick one. Your answer stays here and is not saved.', 'Pumili ng isa. Dito lang ang sagot mo at hindi ito itatabi.'),
    next: S('See my results ▶', 'Tingnan ang resulta ▶')
  };
  const FEELINGS = [
    { id: 'happy', emoji: '😊', label: S('Happy', 'Masaya'),
      reply: S("I'm glad you feel okay! Keep checking before you share.", 'Natutuwa akong maayos ka! Patuloy na suriin bago magbahagi.') },
    { id: 'worried', emoji: '😟', label: S('Worried', 'Nag-aalala'),
      reply: S("It's okay to feel worried. Talking to a trusted adult can help.", 'Okay lang mag-alala. Nakatutulong ang pakikipag-usap sa pinagkakatiwalaang nakatatanda.') },
    { id: 'sad', emoji: '😢', label: S('Sad', 'Malungkot'),
      reply: S("It's okay to feel sad. Stay close to your family and tell a trusted adult how you feel.", 'Okay lang malungkot. Manatiling malapit sa pamilya at sabihin sa pinagkakatiwalaang nakatatanda ang nararamdaman mo.') },
    { id: 'angry', emoji: '😠', label: S('Angry', 'Galit'),
      reply: S("It's okay to feel angry. Take a slow breath, then talk to a trusted adult about it.", 'Okay lang magalit. Huminga nang dahan-dahan, saka kausapin ang pinagkakatiwalaang nakatatanda.') }
  ];

  class Feelings {
    constructor(scene, opts) {
      this.scene = scene; this.opts = opts || {};
      const txt = CS.txt;
      this.reply = h('div', { class: 'cbs-feel__reply', 'aria-live': 'polite' });
      this.btns = FEELINGS.map((f, i) => {
        const b = h('button', { type: 'button', class: 'cbs-feel__btn', 'aria-pressed': 'false', 'data-feeling': f.id },
          h('span', { class: 'cbs-feel__key', 'aria-hidden': 'true' }, String(i + 1)),
          h('img', { class: 'ag-px', src: AG.pixelIcon(f.emoji, 36), alt: '', width: 36, height: 36 }),
          txt('span', 'cbs-feel__label', f.label));
        b.addEventListener('click', () => this.choose(i + 1));
        return b;
      });
      this.nextBtn = h('button', { type: 'button', class: 'ag-btn cbs-feel__next', hidden: true });
      this.nextBtn.append(txt('span', '', STR.next));
      this.nextBtn.addEventListener('click', () => this.opts.onDone && this.opts.onDone());
      this.el = h('section', { class: 'cbs-feel', 'aria-label': AG.pick(STR.ask) },
        txt('h3', 'cbs-feel__ask', STR.ask), txt('p', 'cbs-feel__note', STR.note),
        h('div', { class: 'cbs-feel__row', role: 'group' }, ...this.btns), this.reply, this.nextBtn);
      this.offs = [1, 2, 3, 4].map(n => AG.input.on('CHOICE_' + n, e => { if (e.phase === 'down' && this.el.isConnected) this.choose(n); }));
    }
    focus() { this.btns[0].focus({ preventScroll: true }); }

    choose(n) {
      const f = FEELINGS.find(x => x.id === R.feeling(n));
      if (!f) return;
      this.btns.forEach((b, i) => b.setAttribute('aria-pressed', String(i === n - 1)));
      AG.sfx.play('tap');
      this.scene.react('happy', 1400);
      this.current = f;
      this.showReply();
      this.nextBtn.hidden = false;
      this.nextBtn.focus({ preventScroll: true });
      // the middle of the screen, clear of the site's fixed bottom nav on phones
      this.nextBtn.scrollIntoView({ block: 'center' });
    }
    showReply() {
      if (!this.current) return;
      this.reply.replaceChildren(AG.dialogue.box({ speaker: this.scene.ctx.characterId, text: this.current.reply, style: 'encouragement', side: 'left', plainFont: AG.store.setting('plainFont') }));
    }
    relabel() { this.el.setAttribute('aria-label', AG.pick(STR.ask)); this.showReply(); }

    destroy() { this.offs.forEach(f => f()); }
  }

  CS.Feelings = Feelings;
  CS.FEELINGS = FEELINGS;
})(window.AG);
