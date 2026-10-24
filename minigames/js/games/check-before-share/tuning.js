/* Check Before You Share (check-before-share): every feel number, and the pure rules.
 * AG.checkShare.tuning holds the numbers; AG.checkShare.rules turns a swipe into a verdict,
 * moves the calm meter, scores, gives stars, picks the golden cards and orders the deck.
 * The rules need nothing but plain data, so they also run in kalasag-dev/minigames/tests/
 * (check-before-share.test.js). */
(function (root) {
  const AG = root.AG = root.AG || {};
  const CS = AG.checkShare = AG.checkShare || {};

  const tuning = {
    calm: { start: 70, correct: 8, shared: -15, rejected: -8, low: 20, refill: 50 },
    explainMs: 1500,                         // the deck waits this long after a swipe (or Enter)
    boxMs: 4500,                             // the explanation box stays readable this long
    timer: { easy: 6, advanced: 4 },         // level 5, seconds per card (levels.json can override)
    points: { correct: 100, calm: 5, speed: 10 }, // + calm at the end × 5, + whole seconds left × 10 (L5)
    stars: [
      { accuracy: 0.7 },
      { accuracy: 0.85, calm: 50 },
      { accuracy: 0.95, calm: 70, neverLow: true }
    ],
    maxRun: 3,                               // the deck never asks for the same side more than 3 times running
    orderTries: 60,
    reactMs: 900, breathMs: 3200,
    badges: { factChecker: 100, calmLevels: 5, calmAt: 90 }
  };

  const rules = {
    /** The side the safe choice is on: trusted messages and safe actions go RIGHT. */
    correctDir: card => ((card.type === 'action' ? card.safe : card.trusted) ? 'right' : 'left'),
    /**
     * What one swipe means: { correct, kind, delta }.
     * kind: 'followed' | 'checked' (right answers), 'shared' (a rumour or an unsafe action sent
     * RIGHT), 'rejected' (a trusted message or a safe action sent LEFT).
     */
    judge(card, dir) {
      const C = tuning.calm, want = rules.correctDir(card);
      if (dir === want) return { correct: true, kind: want === 'right' ? 'followed' : 'checked', delta: C.correct };
      return dir === 'right' ? { correct: false, kind: 'shared', delta: C.shared } : { correct: false, kind: 'rejected', delta: C.rejected };
    },
    clampCalm: v => Math.max(0, Math.min(100, Math.round(v))),
    /** The calm meter after one swipe; below `low` it needs the breathing card. */
    calmAfter(calm, delta) { const v = rules.clampCalm(calm + delta); return { calm: v, low: v < tuning.calm.low }; },
    /** Seconds per card on level 5, or 0 (no timer). */
    timerFor(levelData, difficulty) {
      const t = levelData && levelData.timer;
      if (!t) return 0;
      return (typeof t === 'number' ? t : t[difficulty]) || tuning.timer[difficulty] || tuning.timer.easy;
    },
    /** Speed bonus for a right answer with `left` seconds on the card's timer. */
    speedPoints: left => Math.max(0, Math.floor(left || 0)) * tuning.points.speed,
    /** correct × 100 + calm at the end × 5 + speed bonus. */
    points(o) { const P = tuning.points; return (o.correct || 0) * P.correct + rules.clampCalm(o.calm || 0) * P.calm + (o.speed || 0); },
    /**
     * Stars: accuracy ≥ 70 % → 1; ≥ 85 % and calm ≥ 50 → 2; ≥ 95 %, calm ≥ 70 and the meter never
     * went below 20 → 3. o: { correct, total, calm, minCalm }.
     */
    stars(o) {
      const acc = o.total ? o.correct / o.total : 0;
      let n = 0;
      tuning.stars.forEach((s, i) => {
        if (n !== i) return;
        if (acc + 1e-9 < s.accuracy) return;
        if (s.calm != null && o.calm < s.calm) return;
        if (s.neverLow && o.minCalm < tuning.calm.low) return;
        n = i + 1;
      });
      return n;
    },
    accuracy: (correct, total) => (total ? Math.round((correct / total) * 100) : 0),

    /** The 3 golden source cards: trusted messages from the level's list, seeded. */
    golden(cards, rnd) {
      const pool = cards.filter(c => c.type === 'message' && c.trusted).map(c => c.id);
      for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
      return pool.slice(0, 3);
    },
    /** Longest run of cards that want the same side. */
    longestRun(cards) {
      let best = 0, run = 0, last = null;
      cards.forEach(c => { const d = rules.correctDir(c); run = d === last ? run + 1 : 1; last = d; best = Math.max(best, run); });
      return best;
    },
    /** A seeded shuffle of the level's cards with no run longer than maxRun (best effort). */
    order(cards, rnd) {
      let best = cards.slice(), bestRun = Infinity;
      for (let t = 0; t < tuning.orderTries; t++) {
        const a = cards.slice();
        for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
        const r = rules.longestRun(a);
        if (r < bestRun) { best = a; bestRun = r; }
        if (r <= tuning.maxRun) break;
      }
      return best;
    },
    /** The rumour clues of a card, as clue ids (none for trusted messages and actions). */
    cluesFor(card) { return card.type === 'message' && !card.trusted ? (card.clues || []).slice() : []; },
    /** Which feelings reply goes with answer 1–4 (😊 😟 😢 😠). The answer itself is never kept. */
    feeling: n => ['happy', 'worried', 'sad', 'angry'][n - 1] || null
  };

  CS.tuning = tuning;
  CS.rules = rules;
  if (typeof module !== 'undefined') module.exports = { tuning, rules };
})(typeof window !== 'undefined' ? window : globalThis);
