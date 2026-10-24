/* E1 GRID ENGINE — pure, seeded maze generation (no DOM). The same seed gives the same maze
 * on every device (mulberry32, as in AG.util). Tested in kalasag-dev/minigames/tests/grid.test.js.
 *
 *   const m = gridGen.mazeBacktracker(cw, ch, seed)  // cw × ch CELLS → a (2cw+1) × (2ch+1) tile grid
 *   gridGen.braid(m, 0.5, seed)        // removes about half of the dead ends (adds loops)
 *   gridGen.carveRooms(m, 3, seed)     // clears up to 3 rectangular rooms → m.rooms
 *   m.w m.h m.cw m.ch m.data (Uint8Array, 1 = wall) m.passable(x, y) m.wall(x, y) m.open(x, y)
 *   m.rows('#', '.')  gridGen.deadEnds(m)  gridGen.cellToTile(cx, cy)
 * Cells sit on odd tile coordinates; the walls between them on the even ones. The outer
 * border is always wall. Every step only removes walls, so a maze stays fully connected
 * after braid() and carveRooms(). seed = a number or a random function. */
(function (root) {
  const AG = root.AG = root.AG || {};
  AG.logic = AG.logic || {};

  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const rng = seed => (typeof seed === 'function' ? seed : mulberry32(seed == null ? 1 : seed));
  const shuffle = (a, rnd) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); const t = a[i]; a[i] = a[j]; a[j] = t; } return a; };
  const STEPS = [[0, -1], [1, 0], [0, 1], [-1, 0]];

  /** A w × h tile grid, all walls. */
  function grid(w, h) {
    const data = new Uint8Array(w * h).fill(1);
    const inside = (x, y) => x >= 0 && y >= 0 && x < w && y < h;
    return {
      w, h, data,
      wall: (x, y) => !inside(x, y) || data[y * w + x] === 1,
      passable: (x, y) => inside(x, y) && data[y * w + x] === 0,
      open(x, y) { if (inside(x, y)) data[y * w + x] = 0; },
      close(x, y) { if (inside(x, y)) data[y * w + x] = 1; },
      rows: (wallCh, floorCh) => Array.from({ length: h }, (_, y) => Array.from({ length: w }, (_, x) => (data[y * w + x] ? wallCh || '#' : floorCh || '.')).join(''))
    };
  }
  const cellToTile = (cx, cy) => ({ x: 2 * cx + 1, y: 2 * cy + 1 });

  /** A perfect maze (exactly one route between any two cells) by iterative depth-first
   *  backtracking. opts.start = the first cell (default 0, 0). */
  function mazeBacktracker(cw, ch, seed, opts) {
    const rnd = rng(seed), m = grid(2 * cw + 1, 2 * ch + 1);
    m.cw = cw; m.ch = ch; m.rooms = [];
    const seen = new Uint8Array(cw * ch), start = (opts && opts.start) || { x: 0, y: 0 };
    const stack = [[start.x, start.y]];
    seen[start.y * cw + start.x] = 1; m.open(2 * start.x + 1, 2 * start.y + 1);
    while (stack.length) {
      const [cx, cy] = stack[stack.length - 1];
      const options = STEPS.filter(([dx, dy]) => { const nx = cx + dx, ny = cy + dy; return nx >= 0 && ny >= 0 && nx < cw && ny < ch && !seen[ny * cw + nx]; });
      if (!options.length) { stack.pop(); continue; }
      const [dx, dy] = options[Math.floor(rnd() * options.length)];
      const nx = cx + dx, ny = cy + dy;
      seen[ny * cw + nx] = 1;
      m.open(2 * cx + 1 + dx, 2 * cy + 1 + dy); m.open(2 * nx + 1, 2 * ny + 1);
      stack.push([nx, ny]);
    }
    return m;
  }

  const openSides = (m, x, y) => STEPS.reduce((n, [dx, dy]) => n + (m.passable(x + dx, y + dy) ? 1 : 0), 0);
  /** Floor tiles on cell positions with exactly one open side. */
  function deadEnds(m) {
    const out = [];
    for (let y = 1; y < m.h; y += 2) for (let x = 1; x < m.w; x += 2) if (m.passable(x, y) && openSides(m, x, y) === 1) out.push({ x, y });
    return out;
  }

  /** Removes round(ratio × dead ends) dead ends by knocking out one wall at each, preferring
   *  a wall that joins two dead ends. ratio 0 = a perfect maze, 1 = no dead ends left. The
   *  count can end one lower than asked, when the last knock joins two dead ends at once. */
  function braid(m, ratio, seed) {
    const rnd = rng(seed), ends = shuffle(deadEnds(m), rnd), start = ends.length;
    const target = Math.round(start * Math.max(0, Math.min(1, ratio)));
    let left = start;
    for (const e of ends) {
      if (start - left >= target) break;
      if (openSides(m, e.x, e.y) !== 1) continue; // an earlier knock already fixed it
      const walls = STEPS.filter(([dx, dy]) => {
        const wx = e.x + dx, wy = e.y + dy, nx = e.x + 2 * dx, ny = e.y + 2 * dy;
        return m.wall(wx, wy) && nx > 0 && ny > 0 && nx < m.w - 1 && ny < m.h - 1 && m.passable(nx, ny);
      });
      if (!walls.length) continue;
      const joins = walls.filter(([dx, dy]) => openSides(m, e.x + 2 * dx, e.y + 2 * dy) === 1);
      const pool = joins.length ? joins : walls;
      const [dx, dy] = pool[Math.floor(rnd() * pool.length)];
      m.open(e.x + dx, e.y + dy);
      left = deadEnds(m).length;
    }
    m.braided = start - left;
    return m;
  }

  /** Clears up to count rectangular rooms (sizes in cells, default 2–3 each way) that don't
   *  touch each other. Returns the rooms in tile coordinates, each with its entrances (the
   *  open tiles just outside the room that lead into it). */
  function carveRooms(m, count, seed, opts) {
    const rnd = rng(seed), min = (opts && opts.min) || 2, max = (opts && opts.max) || 3;
    const tries = (opts && opts.tries) || 60, rooms = [];
    const fits = r => rooms.every(o => r.x + r.w + 1 < o.x || o.x + o.w + 1 < r.x || r.y + r.h + 1 < o.y || o.y + o.h + 1 < r.y);
    for (let n = 0; n < tries && rooms.length < count; n++) {
      const cw = min + Math.floor(rnd() * (max - min + 1)), ch = min + Math.floor(rnd() * (max - min + 1));
      if (cw > m.cw || ch > m.ch) continue;
      const cx = Math.floor(rnd() * (m.cw - cw + 1)), cy = Math.floor(rnd() * (m.ch - ch + 1));
      const r = { x: 2 * cx + 1, y: 2 * cy + 1, w: 2 * cw - 1, h: 2 * ch - 1 };
      if (!fits(r)) continue;
      for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) m.open(x, y);
      rooms.push(r);
    }
    for (const r of rooms) {
      r.entrances = [];
      for (let x = r.x; x < r.x + r.w; x++) { if (m.passable(x, r.y - 1)) r.entrances.push({ x, y: r.y - 1, dir: 'up' }); if (m.passable(x, r.y + r.h)) r.entrances.push({ x, y: r.y + r.h, dir: 'down' }); }
      for (let y = r.y; y < r.y + r.h; y++) { if (m.passable(r.x - 1, y)) r.entrances.push({ x: r.x - 1, y, dir: 'left' }); if (m.passable(r.x + r.w, y)) r.entrances.push({ x: r.x + r.w, y, dir: 'right' }); }
    }
    m.rooms = (m.rooms || []).concat(rooms);
    return rooms;
  }

  const api = { mulberry32, grid, cellToTile, mazeBacktracker, deadEnds, braid, carveRooms };
  AG.logic.gridGen = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
