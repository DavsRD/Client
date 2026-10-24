/* Pest Patrol Match — TRIPLE MATCH (level 3).
 *
 * Memory flip with sets of three: a pest, what it causes and how to stop it share one key.
 * Three flips per attempt; a miss is called as soon as two face-up cards belong to different
 * sets (AG.logic.memory), so the third flip is never wasted. Stars as in level 1 (attempts ≤
 * sets × 1.3 = 3 …). Three sets are golden. */
window.AG = window.AG || {};
(function (AG) {
  const PP = AG.pestPatrol, R = PP.rules;
  const S = (en, fil) => ({ en, fil });

  const STR = {
    label: S('Sets', 'Grupo'),
    prompt: S('Flip three: a pest, what it causes, and how to stop it.', 'Magbukas ng tatlo: peste, ang dala nito, at paano ito pipigilan.'),
    grid: S('Triple match cards', 'Mga card na tatluhan'),
    start: S('Each pest has a sickness and a way to stop it. Find all three!', 'Bawat peste ay may dalang sakit at paraan ng pagpigil. Hanapin ang tatlo!'),
    win: S('You matched every pest with its sickness and its fix!', 'Natugma mo ang bawat peste sa sakit at lunas nito!'),
    winTight: S('Every set, with hardly any extra flips!', 'Lahat ng grupo, halos walang sobrang bukas!')
  };

  class TripleFlip extends PP.MemoryFlip {
    constructor(scene, data) {
      super(scene, data);
      this.setSize = 3; this.str = STR;
      if (!this.lv.sets) this.lv = { sets: 3, cols: 3 };
    }
    deck() {
      const s = this.s;
      const chosen = R.pick(this.data.sets.map(x => x.id), this.lv.sets, s.rnd);
      const gold = R.golden(chosen.length, s.rnd).map(i => chosen[i]);
      this.total = chosen.length;
      const cards = chosen.flatMap(set => ['pest', 'cause', 'prevent'].map(role => ({ cid: set + '.' + role, key: set, set, role, golden: gold.indexOf(set) })));
      return PP.shuffle(cards, s.rnd);
    }
    cols() { return this.lv.cols || 3; }
  }

  PP.TripleFlip = TripleFlip;
})(window.AG);
