/* Lost & Found: Mall Mission (lost-and-found): every feel number, and the pure rules (no DOM).
 * AG.lostFound.tuning holds the numbers; .scoring turns a finished level into points, stars and badge events;
 * .practiceCard makes the made-up PRACTICE CARD (a name from data/practice-names.json and a fake number that always
 * starts 0900 000); .nameChoices and .digitScore check what the player remembers. Pure, so it also runs in
 * kalasag-dev/minigames/tests/ (lost-and-found.test.js). */
(function (root) {
  const AG = root.AG = root.AG || {};
  const LF = AG.lostFound = AG.lostFound || {};

  const tuning = {
    searchMs: { easy: 90000, advanced: 60000 }, // phase 2 clock
    shopperMs: 2000,                  // tapping another shopper takes 2 s off (never framed as danger)
    debounceMs: 300,                  // checks closer together than this are ignored (no tap spam)
    cardMs: { easy: 6000, advanced: 4000 }, // the PRACTICE CARD shows this long, then hides
    prefix: '0900 000',               // the fake number always starts like this; the player recalls the last 4 digits
    digits: 4,
    reactMs: 1100,
    timeUpMs: 2600,                   // time's up: the unfound helpers are shown, then the level goes on
    callMs: 2200,                     // the helper "calls" …
    familyMs: 2200,                   // … then the family arrives
    lens: { zooms: [1, 2] },
    points: { stopFirst: 100, helper: 100, perSec: 2, digit: 20, name: 50 },
    star2: 0.7,                       // ⭐⭐ ≥ 70 % of the level's max
    star3: 0.9,                       // ⭐⭐⭐ ≥ 90 % AND phase 1 first try AND every digit
    badges: { 'stop-and-stay': 15, 'helper-finder': 50, 'number-memory': 10 },
    safeBonusXP: 5                    // a Safe Choices card answered on the first try
  };

  /* ---------- seeded picks ---------- */
  function rng(seed) {
    let a = (seed >>> 0) || 1;
    return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  const shuffled = (list, seed) => { const a = list.slice(), r = rng(seed); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

  /** The PRACTICE CARD for a play: { first, last, name, digits: '1234', number: '0900 000 1234' }. Made up, never stored. */
  function practiceCard(names, seed) {
    const r = rng(seed), list = names.names;
    const n = list[Math.floor(r() * list.length)];
    let digits = '';
    for (let i = 0; i < tuning.digits; i++) digits += Math.floor(r() * 10);
    if (/^(\d)\1+$/.test(digits)) digits = digits.slice(0, -1) + ((+digits[0] + 3) % 10); // never 0000 / 1111 …
    return { first: n.first, last: n.last, name: n.first + ' ' + n.last, digits, number: tuning.prefix + ' ' + digits };
  }

  /** Three names: the card's and two others. Easy: other first names; advanced: one shares the first name, one the last. */
  function nameChoices(names, card, difficulty, seed) {
    const list = names.names, r = rng(seed + 7);
    const pickOther = test => { const pool = list.filter(test); return pool[Math.floor(r() * pool.length)]; };
    let a, b;
    if (difficulty === 'advanced') {
      a = { first: card.first, last: pickOther(n => n.last !== card.last).last };
      b = { first: pickOther(n => n.first !== card.first).first, last: card.last };
    } else {
      a = pickOther(n => n.first !== card.first && n.last !== card.last);
      b = pickOther(n => n.first !== card.first && n.first !== a.first && n.last !== card.last && n.last !== a.last) || a;
    }
    const opts = [card, a, b].map((n, i) => ({ text: { en: n.first + ' ' + n.last }, ok: i === 0 }));
    return shuffled(opts, seed + 11);
  }

  /** Digits right in their place: '1234' vs '1243' → { right: 2, marks: [true, true, false, false] }. */
  function digitScore(want, got) {
    const marks = [...want].map((d, i) => got[i] === d);
    return { right: marks.filter(Boolean).length, marks };
  }

  /* ---------- scoring ---------- */
  const scoring = {
    /** The best a level can give: phase 1 + every helper + the whole clock + every digit + the name. */
    max(o) {
      const P = tuning.points;
      return P.stopFirst + o.helpers * P.helper + Math.floor(o.timeMs / 1000) * P.perSec + tuning.digits * P.digit + P.name;
    },
    /** run: { stopFirst, found, msLeft (0 unless every helper was found in time), digits, nameFirst } */
    points(run) {
      const P = tuning.points;
      return (run.stopFirst ? P.stopFirst : 0) + run.found * P.helper + Math.floor(Math.max(0, run.msLeft) / 1000) * P.perSec
        + run.digits * P.digit + (run.nameFirst ? P.name : 0);
    },
    /** 1 = completed; 2 = ≥ 70 % of max; 3 = ≥ 90 % AND phase 1 first try AND every digit. */
    stars(run, max) {
      const share = scoring.points(run) / max;
      if (share >= tuning.star3 && run.stopFirst && run.digits === tuning.digits) return 3;
      return share >= tuning.star2 ? 2 : 1;
    },
    /** Adds a finished level to the stats record q ({ firstTries, helpers, perfect }); returns the badge events. */
    badges(q, run) {
      q.firstTries = (q.firstTries || 0) + (run.stopFirst ? 1 : 0);
      q.helpers = (q.helpers || 0) + run.found;
      q.perfect = (q.perfect || 0) + (run.digits === tuning.digits ? 1 : 0);
      const B = tuning.badges, ev = [];
      if (q.firstTries >= B['stop-and-stay']) ev.push('stop-and-stay');
      if (q.helpers >= B['helper-finder']) ev.push('helper-finder');
      if (q.perfect >= B['number-memory']) ev.push('number-memory');
      return ev;
    },
    collectibles: got => [0, 1, 2].map(i => !!got[i])
  };

  /** Which Safe Choices card a play shows: the level's own first, then the rest in turn. */
  const pickCard = (cards, level, plays) => cards[((level - 1) + (plays || 0)) % cards.length];

  const mmss = ms => { const s = Math.max(0, Math.ceil(ms / 1000)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };

  Object.assign(LF, { tuning, scoring, rng, shuffled, practiceCard, nameChoices, digitScore, pickCard, mmss });
  if (typeof module !== 'undefined') module.exports = LF;
})(typeof window !== 'undefined' ? window : globalThis);
