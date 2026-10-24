/* E1 GRID ENGINE — pure path utilities on a 4-connected grid (no DOM). Tested in
 * kalasag-dev/minigames/tests/grid.test.js. Docs: kalasag-dev/minigames/docs/engines/grid.md
 *
 * A grid is anything with { w, h, passable(x, y) }: an AG.grid.TileMap is one, a maze from
 * AG.logic.gridGen is one, and fromRows(['#.#', …]) makes one for tests and level checks.
 * Cells are indexed i = y * w + x. Directions: 0 up, 1 right, 2 down, 3 left.
 *
 *   bfs(grid, starts, { maxDist })     → Int32Array distances (-1 = unreachable)
 *   nextStep(grid, goals)              → { dist, dir, at(x, y) } the step toward the nearest goal
 *   astar(grid, start, goal, { cost }) → [{ x, y }, …] from start to goal, or null
 *   isReachable(grid, a, b)            → boolean
 *   pathFromNext(next, start)          → the path that following nextStep gives
 * Start and goal cells count even when they are not passable themselves (an exit door, a
 * fire tile being tested), but the search only steps INTO passable cells. */
(function (root) {
  const AG = root.AG = root.AG || {};
  AG.logic = AG.logic || {};

  const DIRS = [{ x: 0, y: -1, name: 'up' }, { x: 1, y: 0, name: 'right' }, { x: 0, y: 1, name: 'down' }, { x: -1, y: 0, name: 'left' }];
  const DIR_INDEX = { up: 0, right: 1, down: 2, left: 3 };
  const OPPOSITE = { up: 'down', down: 'up', left: 'right', right: 'left' };
  const asList = p => (Array.isArray(p) ? p : [p]);

  /** A grid from rows of characters. blocked = the characters that are walls (default '#'). */
  function fromRows(rows, blocked) {
    const bl = new Set((blocked || '#').split(''));
    const h = rows.length, w = rows[0].length;
    return { w, h, rows, passable: (x, y) => x >= 0 && y >= 0 && x < w && y < h && !bl.has(rows[y][x]), find: ch => { const out = []; rows.forEach((r, y) => r.split('').forEach((c, x) => { if (c === ch) out.push({ x, y }); })); return out; } };
  }

  function bfs(grid, starts, opts) {
    const { w, h } = grid, max = opts && opts.maxDist != null ? opts.maxDist : Infinity;
    const dist = new Int32Array(w * h).fill(-1), queue = new Int32Array(w * h);
    let head = 0, tail = 0;
    for (const s of asList(starts)) {
      if (s.x < 0 || s.y < 0 || s.x >= w || s.y >= h) continue;
      const i = s.y * w + s.x;
      if (dist[i] < 0) { dist[i] = 0; queue[tail++] = i; }
    }
    while (head < tail) {
      const i = queue[head++], x = i % w, y = (i - x) / w, d = dist[i];
      if (d >= max) continue;
      for (const D of DIRS) {
        const nx = x + D.x, ny = y + D.y;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const j = ny * w + nx;
        if (dist[j] >= 0 || !grid.passable(nx, ny)) continue;
        dist[j] = d + 1; queue[tail++] = j;
      }
    }
    return dist;
  }

  /** For every reachable cell, the direction (0–3) of one step toward the nearest goal.
   *  Goals and unreachable cells get -1. Ties go up, right, down, left (deterministic), so
   *  exit signs computed from it never change between runs. */
  function nextStep(grid, goals) {
    const { w, h } = grid, dist = bfs(grid, goals), dir = new Int8Array(w * h).fill(-1);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const d = dist[y * w + x];
      if (d <= 0) continue;
      for (let k = 0; k < 4; k++) {
        const nx = x + DIRS[k].x, ny = y + DIRS[k].y;
        if (nx >= 0 && ny >= 0 && nx < w && ny < h && dist[ny * w + nx] === d - 1) { dir[y * w + x] = k; break; }
      }
    }
    return {
      w, h, dist, dir,
      at: (x, y) => (x < 0 || y < 0 || x >= w || y >= h || dir[y * w + x] < 0 ? null : DIRS[dir[y * w + x]].name),
      distAt: (x, y) => (x < 0 || y < 0 || x >= w || y >= h ? -1 : dist[y * w + x])
    };
  }

  function pathFromNext(next, start) {
    if (next.distAt(start.x, start.y) < 0) return null;
    const path = [{ x: start.x, y: start.y }];
    let { x, y } = start;
    for (let guard = next.w * next.h; guard > 0; guard--) {
      const k = next.dir[y * next.w + x];
      if (k < 0) break;
      x += DIRS[k].x; y += DIRS[k].y; path.push({ x, y });
    }
    return path;
  }

  /* a small binary heap of [priority, tiebreak, index] */
  function heap() {
    const a = [];
    const less = (i, j) => a[i][0] < a[j][0] || (a[i][0] === a[j][0] && a[i][1] < a[j][1]);
    const swap = (i, j) => { const t = a[i]; a[i] = a[j]; a[j] = t; };
    return {
      get size() { return a.length; },
      push(item) { a.push(item); let i = a.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (!less(i, p)) break; swap(i, p); i = p; } },
      pop() {
        const top = a[0], last = a.pop();
        if (a.length) { a[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < a.length && less(l, m)) m = l; if (r < a.length && less(r, m)) m = r; if (m === i) break; swap(i, m); i = m; } }
        return top;
      }
    };
  }

  /** A* with a Manhattan heuristic. opts.cost(x, y) = the cost of stepping into a cell
   *  (default 1; Infinity blocks; must be ≥ 1 so the heuristic stays admissible). */
  function astar(grid, start, goal, opts) {
    const { w, h } = grid, cost = (opts && opts.cost) || null;
    if (start.x < 0 || start.y < 0 || start.x >= w || start.y >= h || goal.x < 0 || goal.y < 0 || goal.x >= w || goal.y >= h) return null;
    const g = new Float64Array(w * h).fill(Infinity), from = new Int32Array(w * h).fill(-1), closed = new Uint8Array(w * h);
    const s = start.y * w + start.x, t = goal.y * w + goal.x;
    const hh = (x, y) => Math.abs(x - goal.x) + Math.abs(y - goal.y);
    const open = heap();
    let order = 0;
    g[s] = 0; open.push([hh(start.x, start.y), order++, s]);
    while (open.size) {
      const i = open.pop()[2];
      if (closed[i]) continue;
      if (i === t) break;
      closed[i] = 1;
      const x = i % w, y = (i - x) / w;
      for (const D of DIRS) {
        const nx = x + D.x, ny = y + D.y;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const j = ny * w + nx;
        if (closed[j]) continue;
        if (j !== t && !grid.passable(nx, ny)) continue;
        const c = cost ? cost(nx, ny) : 1;
        if (!(c < Infinity)) continue;
        const ng = g[i] + c;
        if (ng < g[j]) { g[j] = ng; from[j] = i; open.push([ng + hh(nx, ny), order++, j]); }
      }
    }
    if (s !== t && from[t] < 0) return null;
    const path = [];
    for (let i = t; i !== -1; i = i === s ? -1 : from[i]) path.push({ x: i % w, y: Math.floor(i / w) });
    return path.reverse();
  }

  function isReachable(grid, a, b) {
    if (a.x === b.x && a.y === b.y) return true;
    const { w, h } = grid, seen = new Uint8Array(w * h), stack = [a.y * w + a.x], t = b.y * w + b.x;
    seen[stack[0]] = 1;
    while (stack.length) {
      const i = stack.pop(), x = i % w, y = (i - x) / w;
      for (const D of DIRS) {
        const nx = x + D.x, ny = y + D.y;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const j = ny * w + nx;
        if (seen[j]) continue;
        if (j === t) return true;
        if (!grid.passable(nx, ny)) continue;
        seen[j] = 1; stack.push(j);
      }
    }
    return false;
  }

  const api = { DIRS, DIR_INDEX, OPPOSITE, fromRows, bfs, nextStep, pathFromNext, astar, isReachable };
  AG.logic.gridPath = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
