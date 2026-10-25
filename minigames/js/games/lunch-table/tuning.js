/* Lunch Table Logic (lunch-table): every feel number, and the pure scoring rules.
 * AG.lunchTable.tuning holds the numbers; AG.lunchTable.scoring turns a finished level into points, stars,
 * Kindness Stickers and badge events. Pure (no DOM), so it also runs in kalasag-dev/minigames/tests/
 * (lunch-table.test.js). The seating rules themselves are in js/logic/lunch-table/rules.js. */
(function (root) {
  const AG = root.AG = root.AG || {};
  const LT = AG.lunchTable = AG.lunchTable || {};

  const tuning = {
    points: { base: 1000, extraMove: 20, hint: 50, best: 200, second: 100 },
    stars: { twoMoves: 4, threeMoves: 1 },       // moves ≤ par + n
    hints: { easy: Infinity, advanced: 3 },
    badges: { upstander: 15 },                   // first-try best choices, over all plays
    reactMs: 1500,                               // the happy pose after a rule turns ✔
    celebrateMs: 1900,                           // the cheer before the Upstander Moment
    hintMs: 4500,                                // how long a hint stays lit
    mood: { happy: 'happy', neutral: 'neutral', sad: 'sad', lonely: 'lonely' },
    /** hero classmates: the mood → the Ready Squad frame */
    heroFrame: { happy: 'happy', neutral: 'talk', sad: 'worried', lonely: 'worried' },
    squad: ['comms', 'medic', 'logistics', 'rescue', 'firesafety']   // AGILA is the mascot, never a classmate
  };

  const rankOf = r => (r === 'best' || r === 'second' ? r : 'third');

  const scoring = {
    hintsFor: d => tuning.hints[d === 'advanced' ? 'advanced' : 'easy'],
    /** 1000 − 20 × (moves − par) − 50 per hint + the Upstander Moment(s): best 200, second-best 100
     *  (split over the moments of a level). ranks = the FIRST choice made in each moment. */
    points(o) {
      const P = tuning.points, ranks = o.ranks || [];
      let s = P.base - P.extraMove * Math.max(0, o.moves - o.par) - P.hint * (o.hints || 0);
      ranks.forEach(r => { s += (r === 'best' ? P.best : r === 'second' ? P.second : 0) / ranks.length; });
      return Math.max(0, Math.round(s));
    },
    /** ⭐ solved · ⭐⭐ moves ≤ par + 4 and every first choice best or second-best · ⭐⭐⭐ moves ≤ par + 1,
     *  every first choice best, no hints. */
    stars(o) {
      if (!o.solved) return 0;
      const ranks = (o.ranks || []).map(rankOf), S = tuning.stars;
      if (o.moves <= o.par + S.threeMoves && ranks.every(r => r === 'best') && !o.hints) return 3;
      if (o.moves <= o.par + S.twoMoves && ranks.every(r => r !== 'third')) return 2;
      return 1;
    },
    /** Kindness Stickers: no undo · the best Upstander choice first try · moves ≤ par. */
    collectibles: o => [!o.undos, (o.ranks || []).length > 0 && o.ranks.every(r => r === 'best'), o.moves <= o.par],
    /** Running counts → the badges earned now (upstander, everyone-included, fair-play). */
    badges(stats, o) {
      const ev = [];
      if ((stats.best || 0) >= tuning.badges.upstander) ev.push('upstander');
      if (o.level === 2 && o.stars === 3) ev.push('everyone-included');
      if (o.level === 4 && o.solved) ev.push('fair-play');
      return ev;
    },
    /** The hero classmates for this player: the squad minus the player and the role expert, in roster order. */
    heroes(playerId, expertId) { return tuning.squad.filter(id => id !== playerId && id !== expertId); }
  };

  LT.tuning = tuning;
  LT.scoring = scoring;
  if (typeof module !== 'undefined') module.exports = { tuning, scoring };
})(typeof window !== 'undefined' ? window : globalThis);
