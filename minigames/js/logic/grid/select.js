/* E1 GRID ENGINE — pure cursor stepping for puzzle grids (no DOM). AG.grid.GridCursor uses it
 * for canvas and DOM grids alike. Tested in kalasag-dev/minigames/tests/grid.test.js.
 *
 *   gridSelect.step({ w, h, selectable }, from, 'right', { mode, wrap }) → { x, y } | null
 *     mode 'cell'    (default) the next selectable cell along the row or column, skipping holes
 *     mode 'nearest' the closest selectable cell anywhere on that side, so a ragged board
 *                    never traps the cursor (sideways distance counts double)
 *     wrap           'cell' mode only: run off one edge and come in at the other
 * null means "no move" (the caller can bump). */
(function (root) {
  const AG = root.AG = root.AG || {};
  AG.logic = AG.logic || {};

  const VEC = { up: [0, -1], right: [1, 0], down: [0, 1], left: [-1, 0] };

  function step(grid, from, dir, opts) {
    const { w, h } = grid, sel = grid.selectable || (() => true), v = VEC[dir];
    if (!v) return null;
    const mode = (opts && opts.mode) || 'cell', wrap = !!(opts && opts.wrap);
    if (mode === 'cell') {
      let x = from.x, y = from.y;
      for (let n = 1; n < Math.max(w, h) + 1; n++) {
        x += v[0]; y += v[1];
        if (x < 0 || y < 0 || x >= w || y >= h) {
          if (!wrap) return null;
          x = (x + w) % w; y = (y + h) % h;
        }
        if (x === from.x && y === from.y) return null;
        if (sel(x, y)) return { x, y };
      }
      return null;
    }
    let best = null, bestScore = Infinity, bestAcross = Infinity;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const dx = x - from.x, dy = y - from.y;
      const along = dx * v[0] + dy * v[1], across = Math.abs(dx * v[1] - dy * v[0]);
      if (along <= 0 || !sel(x, y)) continue;
      const score = along + 2 * across;
      if (score < bestScore || (score === bestScore && across < bestAcross)) { best = { x, y }; bestScore = score; bestAcross = across; }
    }
    return best;
  }

  /** The first selectable cell in reading order (where a cursor starts). */
  function first(grid) {
    const sel = grid.selectable || (() => true);
    for (let y = 0; y < grid.h; y++) for (let x = 0; x < grid.w; x++) if (sel(x, y)) return { x, y };
    return null;
  }

  const api = { step, first };
  AG.logic.gridSelect = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
