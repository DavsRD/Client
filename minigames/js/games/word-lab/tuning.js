/* Health Center Word Lab (word-lab): every feel number, and the pure scoring rules.
 * AG.wordLab.tuning holds the numbers; AG.wordLab.rules turns them into level timers,
 * star targets and stars. The rules need nothing but plain data, so they also run in
 * kalasag-dev/minigames/tests/ (word-lab.test.js) and under Node. */
(function (root) {
  const AG = root.AG = root.AG || {};
  const WL = AG.wordLab = AG.wordLab || {};

  const tuning = {
    /* Patient Queue (levels 1–3): 5 patients, the timer runs down from level 1 to level 3 */
    queue: {
      patients: 5, passWords: 3,
      time: { easy: [150, 120], advanced: [90, 70] },     // seconds, level 1 → level 3
      decoys: { easy: [0, 0, 0], advanced: [1, 1, 2] },   // per queue level
      clue: { easy: [true, true, true], advanced: [true, false, false] }, // clue icon shown?
      wordPoints: 100, starTime: [0.2, 0.4]               // targets: points + this share of the time as bonus
    },
    /* Word Twist (level 4) */
    twist: { time: 90, pointsPerLetter: 10, bingo: 300, minLength: 3 },
    /* Sentence Scramble (level 5) */
    sentence: { time: { easy: [120, 90], advanced: [80, 60] }, points: 150, passSentences: 2, starTime: [0.2, 0.4] },
    /* everywhere */
    hintCost: 30, timeBonus: 2,      // points per second left at the end
    streakXP: 5, cheerEvery: 3,      // +5 XP per word in a no-hint streak (2+); cheer at 3, 6, 9…
    maxHintsFor3: 1,
    readMinMs: 300,                  // a definition box ignores Enter for this long after it opens
    reactMs: 900, leaveMs: 420,      // happy / oops face; a patient walking off
    badges: { noHints: 5, bilingual: 5 }
  };

  const lerp = (a, b, t) => a + (b - a) * t;
  const rules = {
    /** Patient Queue seconds for a level: easy 150 → 120, advanced 90 → 70 over levels 1–3. */
    queueTime(level, difficulty) {
      const [a, b] = tuning.queue.time[difficulty === 'advanced' ? 'advanced' : 'easy'];
      return Math.round(lerp(a, b, (rules.queueLevel(level) - 1) / 2));
    },
    /** The Patient Queue step (1–3) for a level, for the per-level timer, decoys and clues. */
    queueLevel: level => Math.min(3, Math.max(1, level || 1)),
    sentenceTime(level, difficulty) {
      const [a, b] = tuning.sentence.time[difficulty === 'advanced' ? 'advanced' : 'easy'];
      return Math.round(lerp(a, b, (level - 1) / 4));
    },
    /** [target2, target3]: every word solved plus a share of the time as the bonus. */
    timedTargets(base, seconds, share) {
      return share.map(s => base + tuning.timeBonus * Math.round(seconds * s));
    },
    queueTargets: seconds => rules.timedTargets(tuning.queue.patients * tuning.queue.wordPoints, seconds, tuning.queue.starTime),
    sentenceTargets: (n, seconds) => rules.timedTargets(n * tuning.sentence.points, seconds, tuning.sentence.starTime),
    /** Twist: 2 stars = the pass mark plus a little; 3 stars needs the BINGO word too. */
    twistTargets(seedLength, minWords) {
      return [minWords * 40 + 60, tuning.twist.bingo + seedLength * tuning.twist.pointsPerLetter + minWords * 40];
    },
    twistPoints: word => [...word].length * tuning.twist.pointsPerLetter,
    /** 1 = passed; 2 = score ≥ target2; 3 = score ≥ target3 and at most one hint. */
    stars(passed, score, targets, hints) {
      if (!passed) return 0;
      if (score >= targets[1] && hints <= tuning.maxHintsFor3) return 3;
      return score >= targets[0] ? 2 : 1;
    },
    /** XP for a no-hint streak: +5 for every word that makes the streak 2 or longer. */
    streakXP: streak => (streak >= 2 ? tuning.streakXP : 0),
    /** The Twist hint target: an unfound word that starts with what is placed, shortest first. */
    hintTarget(words, found, placed) {
      const open = words.filter(w => !found.has(w));
      const fit = open.filter(w => w.startsWith(placed || ''));
      const list = (fit.length ? fit : open).slice().sort((a, b) => a.length - b.length || a.localeCompare(b));
      return list[0] || null;
    },
    /** Twist answer check → 'short' | 'found' | 'again' | 'bingo' | 'unknown'. */
    judge(value, seed, words, found) {
      if ([...value].length < tuning.twist.minLength) return 'short';
      if (found.has(value)) return 'again';
      if (value === seed) return 'bingo';
      return words.includes(value) ? 'found' : 'unknown';
    }
  };

  WL.tuning = tuning;
  WL.rules = rules;
  if (typeof module !== 'undefined') module.exports = { tuning, rules };
})(typeof window !== 'undefined' ? window : globalThis);
