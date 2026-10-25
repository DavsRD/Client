/* Lost & Found, phase 1: STOP & STAY. The player can't see their grown-up: what do they do first?
 * A 3-choice ChoiceModal (1–3, ↑/↓ + Enter, tap). The player starts worried; the right choice plays "stop".
 * A wrong pick gets a gentle explanation, then the safe choice is shown and the player picks it.
 * 100 points on the first try only. Text: data/safe-choices.json → stopStay. */
window.AG = window.AG || {};
(function (AG) {
  const LF = AG.lostFound;
  const K = 'lost-and-found.';

  const STR = {
    start: { en: "Oh no, where did my family go? I can't see them!" },
    wrong: { en: 'Hmm, let me think about that again.' },
    right: { en: "I'll **stop** right here and stay close." }
  };

  class StopStay {
    constructor(scene) { this.s = scene; }
    start() {
      const s = this.s, d = s.safe.stopStay, lv = d.levels[String(s.level.level)] || d.levels['1'];
      s.setMe('worried');
      s.say(STR.start);
      const options = [
        { text: d.right.text, ok: true, why: d.right.why },
        { text: d.run.text, ok: false, why: d.run.why },
        { text: lv.outside, ok: false, why: d.outsideWhy }
      ];
      this.modal = new LF.ChoiceModal(s.board, s.ctx, {
        eyebrow: { en: '✋ Stop & stay' }, ask: lv.ask, art: K + 'card.stay_put', artScale: 1, options, seed: s.seed + 1,
        onWrong: () => { s.say(STR.wrong); s.react('think'); },
        onRight: (opt, first) => {
          s.run.stopFirst = first;
          s.ctx.safe(1);
          s.setMe('stop');
          s.say(STR.right);
          s.updateHud();
        },
        onDone: () => s.next(new LF.HelperSearch(s))
      });
    }
    destroy() { if (this.modal) this.modal.destroy(); this.modal = null; }
  }

  LF.StopStay = StopStay;
})(window.AG);
