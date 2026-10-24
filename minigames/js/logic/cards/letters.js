/* Letter-tile rules, pure: the typing map, answer layout with fixed word gaps, dealing a
 * scramble, checking. Used by AG.cards.LetterTiles.
 *
 *   letters.normalizeKey('ñ')                 → 'Ñ'   (null for anything that isn't a letter)
 *   letters.tokenize('NGIPIN', { ngSingle })  → ['N','G','I','P','I','N'] or ['NG','I','P','I','N']
 *   letters.layout('WASH HANDS')              → [{ slot: 0, token: 'W' }, …, { gap: true }, …]
 *   letters.deal(tokens, { decoys, rnd })     → tile labels, shuffled, never in answer order
 *   letters.typeKey(tiles, used, pending, k)  → { kind: 'place', index } | { kind: 'pending', pending }
 *                                               | { kind: 'reject' }
 * TYPING MAP: a typed letter takes the FIRST unused tile with that label. A letter that only
 * starts a longer tile (N for an "NG" tile, with no plain N free) waits for the next key;
 * if the pair spells the tile it is placed, otherwise the wait is dropped and the new key
 * is tried on its own. Ñ is its own letter (N never matches Ñ). */
(function (root) {
  const AG = root.AG = root.AG || {};
  AG.logic = AG.logic || {};

  const LETTER = /^\p{L}$/u;
  /** A KeyboardEvent.key → an upper-case letter, or null. */
  function normalizeKey(key) {
    if (typeof key !== 'string' || key.length === 0 || key.length > 2) return null;
    if (!LETTER.test(key)) return null;
    return key.toUpperCase();
  }

  /** A word → its tiles. Spaces are dropped (they become gaps in layout). */
  function tokenize(word, opts) {
    const s = String(word).toUpperCase().replace(/\s+/g, '');
    const out = [];
    for (let i = 0; i < s.length; i++) {
      if (opts && opts.ngSingle && s[i] === 'N' && s[i + 1] === 'G') { out.push('NG'); i++; }
      else out.push(s[i]);
    }
    return out;
  }

  /**
   * The answer row: a slot for every tile, a fixed gap between words, and punctuation shown
   * as-is (no slot). With `words: true` each word is one slot (sentence scramble).
   */
  function layout(answer, opts) {
    opts = opts || {};
    const parts = Array.isArray(answer) ? answer : String(answer).trim().split(/\s+/);
    const out = [];
    let slot = 0;
    parts.forEach((word, wi) => {
      if (wi && !opts.words) out.push({ gap: true });
      if (opts.words) { out.push({ slot: slot++, token: String(word).toUpperCase() }); return; }
      tokenize(word, opts).forEach(tok => {
        if (LETTER.test(tok[0])) out.push({ slot: slot++, token: tok });
        else out.push({ fixed: tok });
      });
    });
    return out;
  }
  const answerTokens = (answer, opts) => layout(answer, opts).filter(c => c.slot != null).map(c => c.token);

  const DECOY_LETTERS = { en: 'ABCDEFGHIKLMNOPRSTUWY', fil: 'ABDEGHIKLMNOPRSTUWY' };
  /**
   * Shuffled tile labels: the answer's tokens plus decoys (a number, picked from letters the
   * answer doesn't use, or an explicit list). Never returned in answer order when another
   * order exists.
   */
  function deal(tokens, opts) {
    opts = opts || {};
    const rnd = opts.rnd || Math.random;
    let decoys = opts.decoys || [];
    if (typeof decoys === 'number') {
      const pool = (opts.alphabet || DECOY_LETTERS[opts.lang] || DECOY_LETTERS.en).split('').filter(c => !tokens.includes(c));
      const n = decoys; decoys = [];
      for (let i = 0; i < n && pool.length; i++) decoys.push(pool.splice(Math.floor(rnd() * pool.length), 1)[0]);
    }
    const tiles = tokens.concat(decoys);
    const distinct = new Set(tokens).size > 1 || decoys.length > 0;
    for (let tries = 0; tries < 20; tries++) {
      for (let i = tiles.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [tiles[i], tiles[j]] = [tiles[j], tiles[i]]; }
      if (!distinct || tiles.slice(0, tokens.length).join('\u0000') !== tokens.join('\u0000')) return tiles;
    }
    // still in order after 20 tries (tiny words): rotate by one
    if (distinct) tiles.push(tiles.shift());
    return tiles;
  }

  /** The typing map (see the header). `used[i]` is true for placed or locked tiles. */
  function typeKey(tiles, used, pending, key) {
    const free = label => tiles.findIndex((t, i) => !used[i] && t === label);
    const starts = prefix => tiles.some((t, i) => !used[i] && t.length > prefix.length && t.startsWith(prefix));
    if (pending) {
      const both = pending + key;
      const i = free(both);
      if (i >= 0) return { kind: 'place', index: i };
      if (starts(both)) return { kind: 'pending', pending: both };
      // the wait failed: try the new key alone
    }
    const i = free(key);
    if (i >= 0) return { kind: 'place', index: i };
    if (starts(key)) return { kind: 'pending', pending: key };
    return { kind: 'reject' };
  }

  const check = (placed, tokens) => placed.length === tokens.length && placed.every((t, i) => t === tokens[i]);

  const api = { normalizeKey, tokenize, layout, answerTokens, deal, typeKey, check, DECOY_LETTERS };
  AG.logic.letters = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
