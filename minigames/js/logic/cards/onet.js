/* Onet (Shisen-sho) connect rules, pure: no DOM, no AG beyond the namespace.
 * Two tiles that match clear when a line of at most 2 turns joins them through empty
 * cells; the line may run outside the board along the outer border (one cell all round).
 *
 *   const b = AG.logic.onet.create(8, 6, cells)   cells: row-major, null = empty
 *   onet.canConnect(b, { x, y }, { x, y })         → [{ x, y }, …] corner points, or null
 *   onet.findMove(b)                               → { a, b, path } or null (also the hint)
 *   onet.hasAnyMove(b)
 *   onet.remove(b, a, c) / onet.isClear(b)
 *   onet.deal(w, h, tiles, rnd)                    places tiles at random, with a move ready
 *   onet.shuffle(b, rnd)                           new board: same tiles on the same occupied
 *                                                  cells (pairs kept), with a move if one fits
 * Path points may have x = -1 or w, y = -1 or h (the border). `match(a, b)` decides which
 * tiles pair up; the default pairs equal values, or objects with the same `.pair`
 * (partner pairs such as pest ↔ prevention). Pass `b.match` to create() to change it. */
(function (root) {
  const AG = root.AG = root.AG || {};
  AG.logic = AG.logic || {};

  function defaultMatch(a, b) {
    if (a == null || b == null) return false;
    if (typeof a === 'object') return a !== b && a.pair != null && a.pair === b.pair;
    return a === b;
  }

  function create(w, h, cells, match) {
    return { w, h, cells: cells ? cells.slice(0, w * h).concat(Array(Math.max(0, w * h - cells.length)).fill(null)) : Array(w * h).fill(null), match: match || defaultMatch };
  }
  const inside = (b, x, y) => x >= 0 && y >= 0 && x < b.w && y < b.h;
  const get = (b, x, y) => (inside(b, x, y) ? b.cells[y * b.w + x] : null);
  const set = (b, x, y, v) => { if (inside(b, x, y)) b.cells[y * b.w + x] = v; };
  // the border ring (-1 … w, -1 … h) is always empty
  const empty = (b, x, y) => x >= -1 && y >= -1 && x <= b.w && y <= b.h && get(b, x, y) == null;
  const same = (p, q) => p.x === q.x && p.y === q.y;

  /** Every cell strictly between p and q (same row or column) is empty. */
  function lineClear(b, p, q) {
    if (p.x === q.x) { const s = Math.sign(q.y - p.y); for (let y = p.y + s; y !== q.y; y += s) if (!empty(b, p.x, y)) return false; return true; }
    if (p.y === q.y) { const s = Math.sign(q.x - p.x); for (let x = p.x + s; x !== q.x; x += s) if (!empty(b, x, p.y)) return false; return true; }
    return false;
  }
  const len = pts => pts.reduce((n, p, i) => (i ? n + Math.abs(p.x - pts[i - 1].x) + Math.abs(p.y - pts[i - 1].y) : 0), 0);

  /**
   * The path between two cells with the fewest turns (then the shortest), ignoring what the
   * two end tiles are: only the cells in between matter. Endpoints must be different cells.
   */
  function route(b, p, q) {
    if (same(p, q)) return null;
    // 0 turns
    if ((p.x === q.x || p.y === q.y) && lineClear(b, p, q)) return [p, q];
    // 1 turn: the corner shares a row with one end and a column with the other
    for (const c of [{ x: p.x, y: q.y }, { x: q.x, y: p.y }]) {
      if (empty(b, c.x, c.y) && lineClear(b, p, c) && lineClear(b, c, q)) return [p, c, q];
    }
    // 2 turns: out along p's row (or column), across, then in along q's
    let best = null;
    const tryPath = (c1, c2) => {
      if (same(c1, p) || same(c2, q) || !empty(b, c1.x, c1.y) || !empty(b, c2.x, c2.y)) return;
      if (!lineClear(b, p, c1) || !lineClear(b, c1, c2) || !lineClear(b, c2, q)) return;
      const path = [p, c1, c2, q];
      if (!best || len(path) < len(best)) best = path;
    };
    for (let x = -1; x <= b.w; x++) tryPath({ x, y: p.y }, { x, y: q.y });
    for (let y = -1; y <= b.h; y++) tryPath({ x: p.x, y }, { x: q.x, y });
    return best;
  }

  /** The connecting path when the two tiles match and ≤ 2 turns join them; else null. */
  function canConnect(b, p, q) {
    const a = get(b, p.x, p.y), c = get(b, q.x, q.y);
    if (a == null || c == null || same(p, q) || !b.match(a, c)) return null;
    return route(b, p, q);
  }

  const occupied = b => { const out = []; for (let y = 0; y < b.h; y++) for (let x = 0; x < b.w; x++) if (get(b, x, y) != null) out.push({ x, y }); return out; };

  function findMove(b) {
    const occ = occupied(b);
    for (let i = 0; i < occ.length; i++) for (let j = i + 1; j < occ.length; j++) {
      const path = canConnect(b, occ[i], occ[j]);
      if (path) return { a: occ[i], b: occ[j], path };
    }
    return null;
  }
  const hasAnyMove = b => !!findMove(b);
  const remove = (b, p, q) => { set(b, p.x, p.y, null); set(b, q.x, q.y, null); };
  const isClear = b => b.cells.every(v => v == null);
  const clone = b => ({ w: b.w, h: b.h, cells: b.cells.slice(), match: b.match });

  function permute(arr, rnd) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }

  /**
   * Shuffles the remaining tiles among the cells they occupy, so every pair still has its
   * partner and nothing moves into a cleared cell. Retries up to `tries` times for a board
   * with a move; failing that, swaps one matching pair onto two connectable cells.
   */
  function shuffle(b, rnd, tries) {
    rnd = rnd || Math.random;
    const occ = occupied(b), tiles = occ.map(p => get(b, p.x, p.y));
    let out = clone(b);
    for (let t = 0; t < (tries || 40); t++) {
      out = clone(b);
      permute(tiles, rnd).forEach((v, i) => set(out, occ[i].x, occ[i].y, v));
      if (hasAnyMove(out) || occ.length < 2) return out;
    }
    return forceMove(out) || out;
  }
  /** Moves one matching pair onto two cells a ≤ 2-turn line already joins. */
  function forceMove(b) {
    const occ = occupied(b);
    let pair = null;
    for (let i = 0; i < occ.length && !pair; i++) for (let j = i + 1; j < occ.length; j++) {
      if (b.match(get(b, occ[i].x, occ[i].y), get(b, occ[j].x, occ[j].y))) { pair = [occ[i], occ[j]]; break; }
    }
    if (!pair) return null;
    for (let i = 0; i < occ.length; i++) for (let j = i + 1; j < occ.length; j++) {
      if (!route(b, occ[i], occ[j])) continue;
      const out = clone(b);
      const swap = (from, to) => { const v = get(out, to.x, to.y); set(out, to.x, to.y, get(out, from.x, from.y)); set(out, from.x, from.y, v); };
      swap(pair[0], occ[i]);
      // pair[1] may have been the cell just swapped away
      swap(same(pair[1], occ[i]) ? pair[0] : pair[1], occ[j]);
      if (hasAnyMove(out)) return out;
    }
    return null;
  }

  /** Puts `tiles` (both halves of every pair) on random cells of a w × h board, with a move ready. */
  function deal(w, h, tiles, rnd, match) {
    rnd = rnd || Math.random;
    const b = create(w, h, null, match);
    const cells = permute(Array.from({ length: w * h }, (_, i) => i), rnd).slice(0, tiles.length);
    tiles.forEach((v, i) => { b.cells[cells[i]] = v; });
    return hasAnyMove(b) ? b : shuffle(b, rnd);
  }

  const api = { create, get, set, empty, lineClear, route, canConnect, findMove, hasAnyMove, remove, isClear, shuffle, deal, occupied, defaultMatch };
  AG.logic.onet = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
