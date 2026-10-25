/* E5 PIECES ENGINE — SlidingTilePuzzle, pure (no DOM). Cells hold tile ids 0…n-1; tile i belongs
 * in cell i and the gap is the last id (it starts bottom-right). Shuffles are seeded and always
 * solvable (inversion parity, plus the gap's row on even widths). Tested in tests/pieces.test.js.
 *
 *   const p = new AG.logic.SlidingTilePuzzle({ cols: 3, rows: 3, seed, tiles })   tiles: a start layout (optional)
 *   p.shuffle(seed) → this (solvable, never already solved)   p.reset()   p.solved   p.moves   p.gap (cell index)
 *   p.move('left') → { from, to, tile } | null     a direction moves a tile INTO the gap: 'left' slides the tile
 *                                                  right of the gap leftwards (arrows and swipes feel the same)
 *   p.canTap(cell)  p.tap(cell) → the move | null  only a neighbour of the gap slides
 *   p.neighbours() → cells next to the gap   p.at(cell) → tile   p.cellOf(tile)
 *   SlidingTilePuzzle.solvable(tiles, cols, rows) → bool */
(function (root) {
  const AG = root.AG = root.AG || {};
  AG.logic = AG.logic || {};

  function rng(seed) { // mulberry32, as AG.util.mulberry32
    let a = seed >>> 0;
    return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  // the tile that moves into the gap comes from the opposite side
  const FROM = { left: [1, 0], right: [-1, 0], up: [0, 1], down: [0, -1] };

  /** Parity of the inversions (gap ignored), plus the gap's row when the width is even; solvable iff it matches the solved layout's. */
  function parity(tiles, cols) {
    const n = tiles.length, gapId = n - 1;
    let inv = 0;
    for (let i = 0; i < n; i++) { if (tiles[i] === gapId) continue; for (let j = i + 1; j < n; j++) if (tiles[j] !== gapId && tiles[j] < tiles[i]) inv++; }
    const gapRow = Math.floor(tiles.indexOf(gapId) / cols);
    return (inv + (cols % 2 === 0 ? gapRow : 0)) % 2;
  }
  function solvable(tiles, cols, rows) {
    const n = cols * rows;
    if (tiles.length !== n || new Set(tiles).size !== n || tiles.some(t => t < 0 || t >= n)) return false;
    return parity(tiles, cols) === parity(Array.from({ length: n }, (_, i) => i), cols);
  }

  class SlidingTilePuzzle {
    constructor(opts) {
      opts = opts || {};
      this.cols = opts.cols || 3; this.rows = opts.rows || 3; this.n = this.cols * this.rows;
      this.gapId = this.n - 1;
      if (opts.tiles) this.tiles = opts.tiles.slice(); else this.reset();
      if (opts.seed != null && !opts.tiles) this.shuffle(opts.seed);
      this.moves = 0;
    }
    reset() { this.tiles = Array.from({ length: this.n }, (_, i) => i); this.moves = 0; return this; }
    get gap() { return this.tiles.indexOf(this.gapId); }
    get solved() { return this.tiles.every((t, i) => t === i); }
    at(cell) { return this.tiles[cell]; }
    cellOf(tile) { return this.tiles.indexOf(tile); }
    xy(cell) { return { x: cell % this.cols, y: Math.floor(cell / this.cols) }; }
    /** A seeded Fisher–Yates; an unsolvable result swaps two tiles (not the gap), which flips the parity. */
    shuffle(seed) {
      const rnd = rng(seed == null ? 1 : seed);
      do {
        const t = Array.from({ length: this.n }, (_, i) => i);
        for (let i = t.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [t[i], t[j]] = [t[j], t[i]]; }
        if (!solvable(t, this.cols, this.rows)) {
          const a = t[0] === this.gapId ? 1 : 0, b = t[a + 1] === this.gapId ? a + 2 : a + 1;
          [t[a], t[b]] = [t[b], t[a]];
        }
        this.tiles = t;
      } while (this.solved && this.n > 2);
      this.moves = 0;
      return this;
    }
    neighbours() {
      const g = this.xy(this.gap), out = [];
      for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) { const x = g.x + dx, y = g.y + dy; if (x >= 0 && y >= 0 && x < this.cols && y < this.rows) out.push(y * this.cols + x); }
      return out;
    }
    canTap(cell) { return this.neighbours().includes(cell); }
    slide(cell) {
      const gap = this.gap, tile = this.tiles[cell];
      this.tiles[gap] = tile; this.tiles[cell] = this.gapId; this.moves++;
      return { from: cell, to: gap, tile };
    }
    tap(cell) { return this.canTap(cell) ? this.slide(cell) : null; }
    move(dir) {
      const d = FROM[dir]; if (!d) return null;
      const g = this.xy(this.gap), x = g.x + d[0], y = g.y + d[1];
      if (x < 0 || y < 0 || x >= this.cols || y >= this.rows) return null;
      return this.slide(y * this.cols + x);
    }
  }
  SlidingTilePuzzle.solvable = solvable;

  AG.logic.SlidingTilePuzzle = SlidingTilePuzzle;
  if (typeof module !== 'undefined') module.exports = SlidingTilePuzzle;
})(typeof window !== 'undefined' ? window : globalThis);
