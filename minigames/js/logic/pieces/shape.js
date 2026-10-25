/* E5 PIECES ENGINE — polyomino shapes and the packing grid, pure (no DOM).
 * Tested in kalasag-dev/minigames/tests/pieces.test.js. Docs: kalasag-dev/minigames/docs/engines/pieces.md
 *
 *   const S = AG.logic.pieceShape
 *   S.parse(['##', '#.'])  or  S.parse([[1, 1], [1, 0]])  → { w, h, cells: [{ x, y }] }   ('#', 'X', 1 = filled)
 *   S.rect(w, h)   S.rotate(shape, quarterTurns)  (clockwise: (x, y) → (h-1-y, x))   S.key(shape)
 *   S.rotations(shape) → the distinct turns [0, 1, …]   S.size(shape) → cell count
 *
 *   const g = new AG.logic.PackGrid({ w, h, mask: ['..#', '...'] })   ('#' = no space there)
 *   g.canPlace(shape, x, y, rot) → { ok, cells, blocked: [{ x, y, why: 'out' | 'wall' | 'full', by }] }
 *   g.place(id, shape, x, y, rot) → bool   g.remove(id) → the placement or null   g.at(x, y) → id | null
 *   g.placements  g.occupancy() → Array(w × h) of id | null | '#'   g.filled  g.capacity  g.efficiency()  (0–1)
 *   g.stats() → { filled, capacity, free, efficiency, pieces }   g.fits(shape) → first { x, y, rot } or null */
(function (root) {
  const AG = root.AG = root.AG || {};
  AG.logic = AG.logic || {};

  function norm(cells) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const c of cells) { minX = Math.min(minX, c.x); minY = Math.min(minY, c.y); maxX = Math.max(maxX, c.x); maxY = Math.max(maxY, c.y); }
    if (!cells.length) return { w: 0, h: 0, cells: [] };
    const out = cells.map(c => ({ x: c.x - minX, y: c.y - minY })).sort((a, b) => a.y - b.y || a.x - b.x);
    return { w: maxX - minX + 1, h: maxY - minY + 1, cells: out };
  }
  const FILLED = v => v === 1 || v === true || v === '#' || v === 'X' || v === 'x';
  function parse(rows) {
    if (rows && rows.cells) return norm(rows.cells);
    const cells = [];
    (rows || []).forEach((row, y) => { const r = typeof row === 'string' ? row.split('') : row; r.forEach((v, x) => { if (FILLED(v)) cells.push({ x, y }); }); });
    return norm(cells);
  }
  const rect = (w, h) => { const cells = []; for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) cells.push({ x, y }); return { w, h, cells }; };
  /** Clockwise quarter turns. The art turns the same way (see Piece). */
  function rotate(shape, q) {
    q = ((q % 4) + 4) % 4;
    let s = shape;
    for (let i = 0; i < q; i++) s = norm(s.cells.map(c => ({ x: s.h - 1 - c.y, y: c.x })));
    return q ? s : norm(shape.cells);
  }
  const key = s => s.w + 'x' + s.h + ':' + s.cells.map(c => c.x + ',' + c.y).join(';');
  function rotations(shape) {
    const seen = new Set(), out = [];
    for (let q = 0; q < 4; q++) { const k = key(rotate(shape, q)); if (!seen.has(k)) { seen.add(k); out.push(q); } }
    return out;
  }
  const size = s => s.cells.length;

  class PackGrid {
    constructor(opts) {
      opts = opts || {};
      this.w = opts.w || (opts.mask ? Math.max(...opts.mask.map(r => r.length)) : 0);
      this.h = opts.h || (opts.mask ? opts.mask.length : 0);
      this.wall = new Uint8Array(this.w * this.h);
      if (opts.mask) opts.mask.forEach((row, y) => { for (let x = 0; x < this.w; x++) if (row[x] === '#' || row[x] === undefined || row[x] === ' ') this.wall[y * this.w + x] = 1; });
      this.cells = new Array(this.w * this.h).fill(null);
      this.placements = new Map(); // id → { id, shape, x, y, rot, cells }
    }
    inside(x, y) { return x >= 0 && y >= 0 && x < this.w && y < this.h; }
    isWall(x, y) { return !this.inside(x, y) || this.wall[y * this.w + x] === 1; }
    at(x, y) { return this.inside(x, y) ? this.cells[y * this.w + x] : null; }
    /** Which board cells the shape would cover with its top-left at (x, y), and what's in the way. */
    canPlace(shape, x, y, rot, ignoreId) {
      const s = rotate(shape, rot || 0), cells = [], blocked = [];
      for (const c of s.cells) {
        const cx = x + c.x, cy = y + c.y;
        cells.push({ x: cx, y: cy });
        if (!this.inside(cx, cy)) blocked.push({ x: cx, y: cy, why: 'out' });
        else if (this.wall[cy * this.w + cx]) blocked.push({ x: cx, y: cy, why: 'wall' });
        else { const by = this.cells[cy * this.w + cx]; if (by != null && by !== ignoreId) blocked.push({ x: cx, y: cy, why: 'full', by }); }
      }
      return { ok: blocked.length === 0, cells, blocked, w: s.w, h: s.h };
    }
    place(id, shape, x, y, rot) {
      const r = this.canPlace(shape, x, y, rot, id);
      if (!r.ok) return false;
      if (this.placements.has(id)) this.remove(id);
      r.cells.forEach(c => { this.cells[c.y * this.w + c.x] = id; });
      this.placements.set(id, { id, shape, x, y, rot: rot || 0, cells: r.cells });
      return true;
    }
    remove(id) {
      const p = this.placements.get(id);
      if (!p) return null;
      p.cells.forEach(c => { this.cells[c.y * this.w + c.x] = null; });
      this.placements.delete(id);
      return p;
    }
    clear() { this.cells.fill(null); this.placements.clear(); }
    occupancy() { return this.cells.map((v, i) => (this.wall[i] ? '#' : v)); }
    get capacity() { let n = 0; for (let i = 0; i < this.wall.length; i++) if (!this.wall[i]) n++; return n; }
    get filled() { let n = 0; for (let i = 0; i < this.cells.length; i++) if (this.cells[i] != null) n++; return n; }
    /** How full the space is: filled cells / usable cells (0–1). */
    efficiency() { const cap = this.capacity; return cap ? this.filled / cap : 0; }
    stats() { const filled = this.filled, capacity = this.capacity; return { filled, capacity, free: capacity - filled, efficiency: capacity ? filled / capacity : 0, pieces: this.placements.size }; }
    /** The first spot (row by row, each distinct turn) where the shape fits, or null. Hints and "will it fit?" checks. */
    fits(shape, rots) {
      for (const rot of rots || rotations(shape)) {
        const s = rotate(shape, rot);
        for (let y = 0; y <= this.h - s.h; y++) for (let x = 0; x <= this.w - s.w; x++) if (this.canPlace(shape, x, y, rot).ok) return { x, y, rot };
      }
      return null;
    }
  }

  AG.logic.pieceShape = { parse, rect, rotate, rotations, key, size, norm };
  AG.logic.PackGrid = PackGrid;
  if (typeof module !== 'undefined') module.exports = { pieceShape: AG.logic.pieceShape, PackGrid };
})(typeof window !== 'undefined' ? window : globalThis);
