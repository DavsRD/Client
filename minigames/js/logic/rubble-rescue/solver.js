/* 12 Rubble Rescue — the pure sliding-block solver (Rush Hour rules, no DOM).
 * Tested in kalasag-dev/minigames/tests/rubble-rescue.test.js; the level search tool
 * (kalasag-dev/minigames/tools/rubble_levels.js) uses it too.
 *
 * A puzzle: { size, escapeRow, blocks: [{ id, x, y, len, axis: 'h'|'v', kind }] }
 *   kind 'normal' | 'dusty' slide along their axis; 'cracked' (load-bearing) and 'slab' (2 × 2)
 *   never move, so they are walls. Solved = every cell of the escape row is free (the
 *   player's pocket is just left of the row, the exit gap just right of it).
 *
 *   const m = S.model(puzzle)              the movable blocks, the fixed walls, the start
 *   S.solve(m, pos?) → { dist, path: [{ i, id, delta }] } | null      BFS, 1 move = 1 slide
 *   const g = S.graph(m)                   every state reachable from the start, with its
 *                                          distance to the nearest solved state
 *   S.dist(g, pos) → n | -1    S.hint(m, g, pos) → { i, id, delta, dir } | null
 *   S.aftershocks(m, g, pos, budget) → [{ i, id, delta, dist }]   1-cell shifts that keep it
 *                                          solvable within the budget (never solved by itself)
 *   S.validate(puzzle) → { ok, errors, par }
 * A state is a Uint8Array: the position along its axis of each movable block (x for 'h',
 * y for 'v'), in model order. Keys pack 3 bits per block into one number (≤ 17 blocks). */
(function (root) {
  const AG = root.AG = root.AG || {};
  AG.logic = AG.logic || {};

  const MOVABLE = { normal: true, dusty: true };
  const MAX_MOVABLE = 17;

  /** Every cell a block covers. */
  function cells(b) {
    const out = [];
    if (b.kind === 'slab') { for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) out.push({ x: b.x + dx, y: b.y + dy }); return out; }
    for (let k = 0; k < b.len; k++) out.push(b.axis === 'h' ? { x: b.x + k, y: b.y } : { x: b.x, y: b.y + k });
    return out;
  }
  const movable = b => !!MOVABLE[b.kind];

  function model(p) {
    const n = p.size, fixed = new Uint8Array(n * n), mov = [];
    for (const b of p.blocks) {
      if (movable(b)) mov.push({ id: b.id, axis: b.axis, len: b.len, line: b.axis === 'h' ? b.y : b.x, start: b.axis === 'h' ? b.x : b.y });
      else for (const c of cells(b)) fixed[c.y * n + c.x] = 1;
    }
    if (mov.length > MAX_MOVABLE) throw new Error('rubble solver: at most ' + MAX_MOVABLE + ' movable blocks');
    return { size: n, row: p.escapeRow, fixed, mov, start: Uint8Array.from(mov.map(b => b.start)) };
  }

  function key(pos) { let k = 0; for (let i = pos.length - 1; i >= 0; i--) k = k * 8 + pos[i]; return k; }
  function unkey(m, k) { const pos = new Uint8Array(m.mov.length); for (let i = 0; i < pos.length; i++) { pos[i] = k % 8; k = Math.floor(k / 8); } return pos; }

  /** Occupancy for a state: 0 free, 1 fixed, 2 + i movable block i. */
  function grid(m, pos) {
    const n = m.size, g = new Uint8Array(n * n);
    for (let c = 0; c < g.length; c++) g[c] = m.fixed[c];
    m.mov.forEach((b, i) => { for (let k = 0; k < b.len; k++) g[b.axis === 'h' ? b.line * n + pos[i] + k : (pos[i] + k) * n + b.line] = 2 + i; });
    return g;
  }
  function isGoal(m, pos) {
    const g = grid(m, pos), n = m.size;
    for (let x = 0; x < n; x++) if (g[m.row * n + x]) return false;
    return true;
  }
  /** How far block i can slide each way: { min, max } positions it can reach. */
  function range(m, pos, i, g) {
    g = g || grid(m, pos);
    const b = m.mov[i], n = m.size, at = p => (b.axis === 'h' ? b.line * n + p : p * n + b.line);
    let lo = pos[i], hi = pos[i];
    while (lo - 1 >= 0 && !g[at(lo - 1)]) lo--;
    while (hi + b.len < n && !g[at(hi + b.len)]) hi++;
    return { min: lo, max: hi };
  }
  /** Every single slide from a state: [{ i, delta }]. */
  function moves(m, pos) {
    const g = grid(m, pos), out = [];
    for (let i = 0; i < m.mov.length; i++) {
      const r = range(m, pos, i, g);
      for (let p = r.min; p <= r.max; p++) if (p !== pos[i]) out.push({ i, delta: p - pos[i] });
    }
    return out;
  }
  const apply = (pos, mv) => { const q = pos.slice(); q[mv.i] += mv.delta; return q; };

  /** Shortest solution from pos (default: the start). */
  function solve(m, pos, opts) {
    pos = pos || m.start;
    const max = (opts && opts.maxStates) || 400000;
    if (isGoal(m, pos)) return { dist: 0, path: [] };
    const prev = new Map([[key(pos), null]]);
    let frontier = [pos];
    while (frontier.length) {
      const next = [];
      for (const s of frontier) {
        const ks = key(s);
        for (const mv of moves(m, s)) {
          const t = apply(s, mv), kt = key(t);
          if (prev.has(kt)) continue;
          prev.set(kt, { from: ks, mv });
          if (isGoal(m, t)) {
            const path = [];
            for (let k = kt; prev.get(k); k = prev.get(k).from) { const e = prev.get(k).mv; path.unshift({ i: e.i, id: m.mov[e.i].id, delta: e.delta }); }
            return { dist: path.length, path };
          }
          next.push(t);
        }
      }
      if (prev.size > max) return null;
      frontier = next;
    }
    return null;
  }

  /** The whole state space reachable from the start (slides are reversible, so it is one
   *  component), then a BFS from every solved state: dist to the nearest exit for each. */
  function graph(m, opts) {
    const max = (opts && opts.maxStates) || 400000;
    const seen = new Map(), goals = [];
    let frontier = [m.start];
    seen.set(key(m.start), -1);
    while (frontier.length && seen.size <= max) {
      const next = [];
      for (const s of frontier) {
        if (isGoal(m, s)) goals.push(s);
        for (const mv of moves(m, s)) { const t = apply(s, mv), kt = key(t); if (!seen.has(kt)) { seen.set(kt, -1); next.push(t); } }
      }
      frontier = next;
    }
    const truncated = frontier.length > 0;
    goals.forEach(s => seen.set(key(s), 0));
    let d = 0;
    frontier = goals;
    while (frontier.length) {
      d++;
      const next = [];
      for (const s of frontier) for (const mv of moves(m, s)) { const t = apply(s, mv), kt = key(t); if (seen.get(kt) === -1) { seen.set(kt, d); next.push(t); } }
      frontier = next;
    }
    return { dist: seen, states: seen.size, truncated };
  }
  function dist(g, pos) { const d = g.dist.get(key(pos)); return d == null ? -1 : d; }

  const DIR = { h: ['left', 'right'], v: ['up', 'down'] };
  /** The next move of a shortest solution (the first in model order, so hints are stable). */
  function hint(m, g, pos) {
    const d = dist(g, pos);
    if (d <= 0) return null;
    for (const mv of moves(m, pos)) {
      if (dist(g, apply(pos, mv)) === d - 1) { const b = m.mov[mv.i]; return { i: mv.i, id: b.id, delta: mv.delta, dir: DIR[b.axis][mv.delta > 0 ? 1 : 0] }; }
    }
    return null;
  }

  /** Aftershock candidates: one movable block shifted by one cell into a free cell, leaving a
   *  state that is still solvable within budget moves and not already solved. */
  function aftershocks(m, g, pos, budget) {
    const gr = grid(m, pos), out = [];
    for (let i = 0; i < m.mov.length; i++) {
      const r = range(m, pos, i, gr);
      for (const delta of [-1, 1]) {
        const p = pos[i] + delta;
        if (p < r.min || p > r.max) continue;
        const t = apply(pos, { i, delta }), d = dist(g, t);
        if (d > 0 && (budget == null || d <= budget)) out.push({ i, id: m.mov[i].id, delta, dist: d });
      }
    }
    return out;
  }

  /** Is everything in the puzzle where the rules want it? par = the shortest solution. */
  function validate(p) {
    const errors = [], n = p.size;
    if (!(n >= 4 && n <= 8)) errors.push('size ' + n);
    if (!(p.escapeRow >= 0 && p.escapeRow < n)) errors.push('escapeRow ' + p.escapeRow);
    const occ = new Map(), ids = new Set();
    for (const b of p.blocks) {
      if (ids.has(b.id)) errors.push('duplicate id ' + b.id);
      ids.add(b.id);
      if (!['normal', 'dusty', 'cracked', 'slab'].includes(b.kind)) errors.push(b.id + ': kind ' + b.kind);
      if (b.kind !== 'slab' && (![2, 3].includes(b.len) || !['h', 'v'].includes(b.axis))) errors.push(b.id + ': shape');
      for (const c of cells(b)) {
        if (c.x < 0 || c.y < 0 || c.x >= n || c.y >= n) errors.push(b.id + ': off the board');
        const k = c.x + ',' + c.y;
        if (occ.has(k)) errors.push(b.id + ' overlaps ' + occ.get(k));
        occ.set(k, b.id);
      }
      const onRow = cells(b).some(c => c.y === p.escapeRow);
      if (onRow && (!movable(b) || b.axis === 'h')) errors.push(b.id + ': can never leave the escape row');
    }
    if (errors.length) return { ok: false, errors, par: -1 };
    const m = model(p), r = solve(m);
    if (!r) return { ok: false, errors: ['unsolvable'], par: -1 };
    if (r.dist === 0) errors.push('already solved');
    return { ok: !errors.length, errors, par: r.dist };
  }

  const api = { cells, movable, model, key, unkey, grid, isGoal, range, moves, apply, solve, graph, dist, hint, aftershocks, validate, MAX_MOVABLE };
  AG.logic.rubbleSolver = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
