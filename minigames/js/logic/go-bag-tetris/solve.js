/* 05 Go Bag Tetris — the packing solver, pure (no DOM). Proves a bag holds a set of items, checks a stored
 * solution, and finds where the next item can go for hints. Backtracking over the bag's cells in reading order:
 * each free cell is covered by some piece (anchored at its first cell) or left empty (at most "slack" times).
 * Same rotation rule as AG.logic.pieceShape (clockwise). Tested in kalasag-dev/minigames/tests/go-bag-tetris.test.js;
 * kalasag-dev/minigames/tools/go_bag_levels.py is a Python port used to design levels.json.
 *
 *   const GS = AG.logic.goBagSolve
 *   GS.solve({ mask, pieces: [{ id, shape }], rotate: true, blocked: [{ x, y }], maxNodes })
 *     → { ok: true, placements: [{ id, x, y, rot }], nodes } | { ok: false, reason: 'area' | 'nofit' | 'none' | 'limit' }
 *   GS.check({ mask, pieces, placements }) → { ok, why }      GS.expand(['canned', 'canned']) → ['canned', 'canned_2']
 *   GS.itemOf('canned_2') → 'canned' */
(function (root) {
  const AG = root.AG = root.AG || {};
  AG.logic = AG.logic || {};
  const S = AG.logic.pieceShape;

  /** Item ids (repeats allowed) → piece ids: the second can is canned_2, the third canned_3. */
  function expand(ids) {
    const seen = {};
    return ids.map(id => { seen[id] = (seen[id] || 0) + 1; return seen[id] === 1 ? id : id + '_' + seen[id]; });
  }
  const itemOf = pid => String(pid).replace(/_\d+$/, '');

  function freeGrid(mask, blocked) {
    const H = mask.length, W = Math.max(...mask.map(r => r.length));
    const free = [];
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) free.push(mask[y][x] === '.');
    (blocked || []).forEach(c => { if (c.x >= 0 && c.y >= 0 && c.x < W && c.y < H) free[c.y * W + c.x] = false; });
    return { W, H, free };
  }

  function solve(o) {
    const rotate = o.rotate !== false, maxNodes = o.maxNodes || 2e6;
    const { W, H, free } = freeGrid(o.mask, o.blocked);
    const cap = free.filter(Boolean).length;
    const shapes = o.pieces.map(p => ({ id: p.id, s: S.parse(p.shape) }));
    const area = shapes.reduce((n, p) => n + p.s.cells.length, 0);
    if (area > cap) return { ok: false, reason: 'area' };

    // identical shapes (all turns, when turning is allowed) share one group, so three cans don't triple the search
    const byKey = new Map();
    shapes.forEach(p => {
      const k = rotate ? S.rotations(p.s).map(q => S.key(S.rotate(p.s, q))).sort()[0] : S.key(p.s);
      if (!byKey.has(k)) byKey.set(k, { ids: [], base: p.s, own: {} });
      byKey.get(k).ids.push(p.id); byKey.get(k).own[p.id] = p.s;
    });
    const groups = [...byKey.values()].map(g => {
      const ors = (rotate ? S.rotations(g.base) : [0]).map(q => {
        const t = S.rotate(g.base, q), a = t.cells[0]; // the first cell in reading order is the anchor
        return { q, ax: a.x, ay: a.y, offs: t.cells.map(c => [c.x - a.x, c.y - a.y]) };
      });
      return { ids: g.ids, n: g.ids.length, ors, size: g.base.cells.length, base: g.base, own: g.own };
    }).sort((a, b) => b.size - a.size);

    const fitsAt = (offs, x0, y0, occ) => offs.every(([dx, dy]) => {
      const x = x0 + dx, y = y0 + dy;
      return x >= 0 && y >= 0 && x < W && y < H && free[y * W + x] && !(occ && occ[y * W + x]);
    });
    // a piece with no spot at all, even in an empty bag: nothing to search
    for (const g of groups) {
      let any = false;
      for (const or of g.ors) { for (let y = 0; y < H && !any; y++) for (let x = 0; x < W && !any; x++) any = fitsAt(or.offs, x, y); if (any) break; }
      if (!any) return { ok: false, reason: 'nofit' };
    }

    // a group is one shape up to turning: a piece's own turn is the one that gives the group's turn q
    const ownRot = (g, id, q) => {
      const want = S.key(S.rotate(g.base, q)), own = g.own[id];
      for (let r = 0; r < 4; r++) if (S.key(S.rotate(own, r)) === want) return r;
      return q;
    };
    const order = []; for (let i = 0; i < W * H; i++) if (free[i]) order.push(i);
    const occ = new Uint8Array(W * H), placed = [], slack = cap - area;
    let nodes = 0, left = shapes.length;
    function rec(k, voids) {
      if (++nodes > maxNodes) throw new Error('limit');
      while (k < order.length && occ[order[k]]) k++;
      if (left === 0) return true;
      if (k >= order.length) return false;
      const i = order[k], x0 = i % W, y0 = (i / W) | 0;
      for (const g of groups) {
        if (!g.n) continue;
        for (const or of g.ors) {
          if (!fitsAt(or.offs, x0, y0, occ)) continue;
          or.offs.forEach(([dx, dy]) => { occ[(y0 + dy) * W + x0 + dx] = 1; });
          const id = g.ids[g.ids.length - g.n];
          g.n--; left--;
          placed.push({ id, x: x0 - or.ax, y: y0 - or.ay, rot: ownRot(g, id, or.q) });
          if (rec(k + 1, voids)) return true;
          placed.pop(); g.n++; left++;
          or.offs.forEach(([dx, dy]) => { occ[(y0 + dy) * W + x0 + dx] = 0; });
        }
      }
      if (voids < slack) { occ[i] = 2; if (rec(k + 1, voids + 1)) return true; occ[i] = 0; }
      return false;
    }
    try {
      if (!rec(0, 0)) return { ok: false, reason: 'none', nodes };
    } catch (e) { if (e.message === 'limit') return { ok: false, reason: 'limit', nodes }; throw e; }
    return { ok: true, placements: placed.slice().sort((a, b) => (a.id < b.id ? -1 : 1)), nodes };
  }

  /** Does a stored solution really hold every piece, inside the bag, with no overlaps? */
  function check(o) {
    const g = new AG.logic.PackGrid({ mask: o.mask });
    const want = new Map(o.pieces.map(p => [p.id, p]));
    for (const pl of o.placements) {
      const p = want.get(pl.id);
      if (!p) return { ok: false, why: 'unknown piece ' + pl.id };
      if (!g.place(pl.id, S.parse(p.shape), pl.x, pl.y, pl.rot)) return { ok: false, why: 'cannot place ' + pl.id };
    }
    const missing = o.pieces.filter(p => !g.placements.has(p.id)).map(p => p.id);
    return missing.length ? { ok: false, why: 'missing ' + missing.join(', ') } : { ok: true };
  }

  AG.logic.goBagSolve = { solve, check, expand, itemOf };
  if (typeof module !== 'undefined') module.exports = AG.logic.goBagSolve;
})(typeof window !== 'undefined' ? window : globalThis);
