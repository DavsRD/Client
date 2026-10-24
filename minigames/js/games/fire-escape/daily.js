/* Fire Escape Maze — the Daily Challenge. Pure, tested in fire-escape.test.js.
 *
 *   AG.fireEscape.generateDaily(seed) → a level entry like levels.json's:
 *     { daily: true, seed, level, features: [2 modifiers], easy: { cells, rooms }, advanced: { … } }
 * seed = the date (YYYYMMDD), so every device gets the same maze and the same two of the
 * level modifiers (smoke · doors · spreading fire + elevator · power cut + classmate). */
(function (root) {
  const AG = root.AG = root.AG || {};
  const FE = AG.fireEscape = AG.fireEscape || {};

  FE.generateDaily = function (seed) {
    const rnd = AG.logic.fireEscapeGen.mulberry32((seed >>> 0) ^ 0xda11);
    const mods = FE.tuning.dailyModifiers.slice();
    for (let i = mods.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [mods[i], mods[j]] = [mods[j], mods[i]]; }
    const features = mods.slice(0, 2).sort((a, b) => FE.tuning.dailyModifiers.indexOf(a) - FE.tuning.dailyModifiers.indexOf(b));
    const level = 2 + Math.floor(rnd() * 3); // a mid-size maze: levels 2–4
    const T = FE.tuning;
    return {
      daily: true, seed: seed >>> 0, level, features,
      easy: { cells: T.cells.easy[level - 1], rooms: T.rooms.easy[level - 1] },
      advanced: { cells: T.cells.advanced[level - 1], rooms: T.rooms.advanced[level - 1] }
    };
  };

  if (typeof module !== 'undefined') module.exports = FE.generateDaily;
})(typeof window !== 'undefined' ? window : globalThis);
