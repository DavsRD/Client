/* Memory-flip rules, pure: flip cards until a set is up, then it matches or flips back.
 * Sets of 2 (pairs) or 3 (triple match: pest + cause + prevention).
 *
 *   const m = AG.logic.memory.create({ setSize: 2 })
 *   m.flip(id, key)  → { kind: 'up' }                 still collecting this attempt
 *                    | { kind: 'match', ids }         the whole set shares one key
 *                    | { kind: 'miss', ids }          flip these back (after the game's delay)
 *                    | { kind: 'ignored' }            already up, matched, or a miss is pending
 *   m.settle()       call after flipping a miss back; flips are ignored until then
 *   m.attempts, m.matches, m.up (ids face up this attempt)
 * A miss is called as soon as two up cards differ, so a triple never wastes a third flip. */
(function (root) {
  const AG = root.AG = root.AG || {};
  AG.logic = AG.logic || {};

  function create(opts) {
    const size = (opts && opts.setSize) || 2;
    const matched = new Set();
    let up = [], waiting = false;
    const m = {
      attempts: 0, matches: 0,
      get up() { return up.map(c => c.id); },
      isMatched: id => matched.has(id),
      flip(id, key) {
        if (waiting || matched.has(id) || up.some(c => c.id === id)) return { kind: 'ignored' };
        up.push({ id, key });
        if (up.some(c => c.key !== up[0].key)) {
          m.attempts++; waiting = true;
          return { kind: 'miss', ids: up.map(c => c.id) };
        }
        if (up.length < size) return { kind: 'up' };
        m.attempts++; m.matches++;
        const ids = up.map(c => c.id);
        ids.forEach(i => matched.add(i)); up = [];
        return { kind: 'match', ids };
      },
      settle() { up = []; waiting = false; },
      reset() { up = []; waiting = false; matched.clear(); m.attempts = 0; m.matches = 0; }
    };
    return m;
  }

  const api = { create };
  AG.logic.memory = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
