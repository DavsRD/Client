/* 08 Water Ways: the pure water model (no DOM). AG.logic.waterFlow
 *
 *   const board = WF.parse(levelsEntry.easy, tuning)  → { n, w, h, tiles[], serve, wasteTarget }
 *   const res = WF.simulate(board, rots, opts)         → who gets how much water, and the losses
 *   WF.scramble(board, seed, opts, isSolved)           → { rots, par } (never already solved)
 *
 * A board is w × h cells (n × n in the game; index y × w + x); a cell is null or a tile:
 *   { type, rot, sol, locked, pad, leak, fixed, open, source, supply, kind, demand, out, greyIn }
 * Directions are 0 up, 1 right, 2 down, 3 left (like AG.logic.gridPath). A tile's openings
 * are its type's openings at rot 0 (as the art is drawn), turned clockwise by rot.
 *
 * simulate() on FLOW:
 *   1. BFS from every source (reservoir, barrel, rain catcher) through matching openings;
 *      each connected network is a component. Destinations take water in, never pass it on.
 *   2. supply = sources + rain catchers (+R each)
 *   3. each unfixed leak in the component −L;  4. each OPEN canal −E (covered: 0)
 *   5. the rest is split equally among the component's destinations in whole units, capped at
 *      each one's need, the surplus going round again (remainders go to the higher priority)
 *   6. a drip tile on a field's inlet halves the field's demand
 *   7. grey tiles from the laundry's outlet to a field's grey inlet carry 60 % of the
 *      laundry's water on (the split is repeated until the grey share settles)
 * Tests: kalasag-dev/minigames/tests/water-ways.test.js */
(function (root) {
  const AG = root.AG = root.AG || {};
  AG.logic = AG.logic || {};

  const DX = [0, 1, 0, -1], DY = [-1, 0, 1, 0];
  const OPP = d => (d + 2) % 4;
  const DIR = { up: 0, right: 1, down: 2, left: 3 };

  /* Level codes: <letter><solution rot>[*]. Sources, destinations and rain catchers never turn. */
  const CODES = {
    R: { type: 'reservoir', source: true }, B: { type: 'barrel', source: true }, N: { type: 'rain', source: true },
    H: { type: 'dest', kind: 'house' }, A: { type: 'dest', kind: 'animals' }, F: { type: 'dest', kind: 'field' }, L: { type: 'dest', kind: 'laundry' },
    I: { type: 'straight' }, K: { type: 'straight', leak: true }, C: { type: 'corner' }, T: { type: 'tee' }, X: { type: 'cross' },
    E: { type: 'end' }, V: { type: 'valve' }, D: { type: 'drip' }, G: { type: 'grey' },
    O: { type: 'canal', open: true }, U: { type: 'canal', open: false }
  };
  const BASE = {
    straight: [0, 2], corner: [0, 1], tee: [0, 1, 2], cross: [0, 1, 2, 3], end: [0], valve: [0, 2],
    drip: [0, 2], grey: [0, 2], canal: [1, 3], rain: [2], reservoir: [2], barrel: [2], dest: [0]
  };
  /** Turns that look and connect the same: a straight is the same after 2, a cross after 1. */
  const PERIOD = { cross: 1, straight: 2, valve: 2, drip: 2, grey: 2, canal: 2 };
  const PRIORITY = { house: 1, animals: 2, field: 3, laundry: 4 };
  const DEFAULTS = {
    supply: { reservoir: 10, barrel: 6 },
    demand: { house: 4, animals: 3, field: 4, laundry: 3 },
    leak: 2, evap: 1, rain: 2, grey: 0.6
  };
  const opt = o => {
    o = o || {};
    return {
      supply: Object.assign({}, DEFAULTS.supply, o.supply), demand: Object.assign({}, DEFAULTS.demand, o.demand),
      leak: o.leak != null ? o.leak : DEFAULTS.leak, evap: o.evap != null ? o.evap : DEFAULTS.evap,
      rain: o.rain != null ? o.rain : DEFAULTS.rain, grey: o.grey != null ? o.grey : DEFAULTS.grey
    };
  };
  const dirOf = v => (v == null ? null : typeof v === 'number' ? v : DIR[v]);

  function openings(tile, rot) {
    const r = rot == null ? tile.rot : rot;
    return (BASE[tile.type] || []).map(d => (d + r) % 4);
  }
  const has = (tile, d, rot) => openings(tile, rot).includes(d);
  const period = tile => PERIOD[tile.type] || 4;
  const rotatable = tile => !!tile && !tile.locked && period(tile) > 1;
  /** Clockwise quarter turns from one rotation to another (counting the tile's symmetry). */
  function turns(tile, from, to) { const p = period(tile); return (((to - from) % p) + p) % p; }

  /** A levels.json board → tiles at their SOLUTION rotation (leaks unfixed). */
  function parse(spec, o) {
    o = opt(o);
    const h = spec.rows.length, w = spec.size || spec.rows[0].trim().split(/\s+/).length;
    const tiles = new Array(w * h).fill(null);
    const props = spec.props || {};
    spec.rows.forEach((row, y) => {
      const toks = row.trim().split(/\s+/);
      if (toks.length !== w) throw new Error('row ' + y + ' has ' + toks.length + ' cells, not ' + w);
      toks.forEach((tok, x) => {
        if (tok === '.') return;
        const m = /^([A-Z])([0-3])(\*)?$/.exec(tok);
        if (!m || !CODES[m[1]]) throw new Error('bad cell "' + tok + '" at ' + x + ',' + y);
        const c = CODES[m[1]], p = props[x + ',' + y] || {};
        const t = { x, y, type: c.type, rot: +m[2], sol: +m[2], locked: !!(c.source || c.type === 'dest' || m[3]), pad: !!m[3], leak: !!(c.leak || p.leak), fixed: false };
        if (c.type === 'canal') t.open = c.open;
        if (c.source) { t.source = true; t.supply = p.supply != null ? p.supply : c.type === 'rain' ? o.rain : o.supply[c.type]; }
        if (c.type === 'dest') {
          t.kind = c.kind; t.priority = PRIORITY[c.kind];
          t.demand = p.demand != null ? p.demand : o.demand[c.kind];
          if (p.out != null) t.out = dirOf(p.out);
          if (p.grey != null) t.greyIn = dirOf(p.grey);
        }
        tiles[y * w + x] = t;
      });
    });
    return { n: w, w, h, tiles, serve: spec.serve || null, wasteTarget: spec.wasteTarget || 0 };
  }

  const rotsOf = (board, which) => board.tiles.map(t => (t ? t[which || 'rot'] : 0));
  const tileAt = (board, x, y) => (x >= 0 && y >= 0 && x < board.w && y < board.h ? board.tiles[y * board.w + x] : null);

  /** Whole units, one at a time round the list in priority order, to those still in need. */
  function split(units, needs, priorities) {
    const got = needs.map(() => 0);
    const order = needs.map((_, i) => i).sort((a, b) => (priorities ? priorities[a] - priorities[b] : 0) || a - b);
    let left = Math.max(0, Math.floor(units));
    while (left > 0) {
      let gave = false;
      for (const i of order) { if (left > 0 && got[i] < needs[i]) { got[i]++; left--; gave = true; } }
      if (!gave) break;
    }
    return { got, left };
  }

  /**
   * One FLOW. rots: the current rotation per cell (default: each tile's rot).
   * → { comps, dests, supply, lost: { leak, evap }, waste, unused, order, maxDist, wet, greyWet,
   *     leaks (unfixed leaks with water), greyUsed }
   */
  function simulate(board, rots, o) {
    o = opt(o);
    const W = board.w, H = board.h, T = board.tiles;
    const R = rots || rotsOf(board);
    const open = (i, d) => has(T[i], d, R[i]);
    const nb = (i, d) => { const x = i % W + DX[d], y = Math.floor(i / W) + DY[d]; return x >= 0 && y >= 0 && x < W && y < H ? y * W + x : -1; };
    const fresh = t => t && t.type !== 'grey';

    /* 1. networks */
    const comp = new Array(W * H).fill(-1), dist = new Array(W * H).fill(-1);
    const comps = [], order = [];
    T.forEach((t, s) => {
      if (!t || !t.source || comp[s] >= 0) return;
      const c = { id: comps.length, cells: [], sources: [], dests: [], leaks: [], canals: [], supply: 0 };
      comps.push(c);
      const q = [s]; comp[s] = c.id; dist[s] = 0;
      while (q.length) {
        const i = q.shift(), ti = T[i];
        c.cells.push(i); order.push({ i, dist: dist[i] });
        if (ti.source) c.sources.push(i);
        if (ti.type === 'dest') { c.dests.push(i); continue; } // destinations never pass water on
        if (ti.leak && !ti.fixed) c.leaks.push(i);
        if (ti.type === 'canal' && ti.open) c.canals.push(i);
        for (const d of openings(ti, R[i])) {
          const j = nb(i, d);
          if (j < 0 || comp[j] >= 0 || !fresh(T[j]) || !open(j, OPP(d))) continue;
          comp[j] = c.id; dist[j] = dist[i] + 1; q.push(j);
        }
      }
    });

    /* 2–4. supply and losses per network */
    let supply = 0, lostLeak = 0, lostEvap = 0;
    for (const c of comps) {
      c.supply = c.sources.reduce((s, i) => s + (T[i].supply || 0), 0);
      c.leakLoss = Math.min(c.supply, c.leaks.length * o.leak);
      c.evapLoss = Math.min(c.supply - c.leakLoss, c.canals.length * o.evap);
      c.net = c.supply - c.leakLoss - c.evapLoss;
      supply += c.supply; lostLeak += c.leakLoss; lostEvap += c.evapLoss;
    }

    /* 6. drip tiles on field inlets */
    const dests = [];
    T.forEach((t, i) => {
      if (!t || t.type !== 'dest') return;
      const inlet = openings(t, R[i])[0], j = nb(i, inlet);
      const drip = t.kind === 'field' && j >= 0 && T[j] && T[j].type === 'drip' && open(j, OPP(inlet));
      dests.push({ i, x: i % W, y: Math.floor(i / W), kind: t.kind, priority: t.priority, demand: t.demand,
        need: drip ? Math.ceil(t.demand / 2) : t.demand, drip, comp: comp[i], connected: comp[i] >= 0, fresh: 0, grey: 0 });
    });
    const byCell = new Map(dests.map(d => [d.i, d]));

    /* 7. greywater: laundry outlet → grey tiles → a field's grey inlet */
    const links = [], greyDist = new Map();
    dests.forEach(d => {
      const t = T[d.i];
      if (t.kind !== 'laundry' || t.out == null) return;
      const first = nb(d.i, t.out);
      if (first < 0 || !T[first] || T[first].type !== 'grey' || !open(first, OPP(t.out))) return;
      const link = { from: d, fields: [], cells: [] }, seen = new Set([first]), q = [[first, 0]];
      while (q.length) {
        const [i, k] = q.shift();
        link.cells.push(i);
        if (!greyDist.has(i) || greyDist.get(i) > k) greyDist.set(i, k);
        for (const dd of openings(T[i], R[i])) {
          const j = nb(i, dd);
          if (j < 0 || !T[j] || seen.has(j)) continue;
          const tj = T[j];
          if (tj.type === 'grey' && open(j, OPP(dd))) { seen.add(j); q.push([j, k + 1]); }
          else if (tj.type === 'dest' && tj.kind === 'field' && tj.greyIn === OPP(dd)) { seen.add(j); link.fields.push(byCell.get(j)); }
        }
      }
      if (link.fields.length) links.push(link);
    });

    /* 5. split, repeated while the greywater share changes */
    let greyIn = new Map();
    for (let pass = 0; pass < 10; pass++) {
      for (const c of comps) {
        const ds = c.dests.map(i => byCell.get(i));
        const r = split(c.net, ds.map(d => Math.max(0, d.need - (greyIn.get(d.i) || 0))), ds.map(d => d.priority));
        ds.forEach((d, k) => { d.fresh = r.got[k]; });
        c.unused = r.left;
      }
      const next = new Map();
      for (const L of links) {
        const share = Math.round(L.from.fresh * o.grey);
        const parts = split(share, L.fields.map(() => Infinity)).got; // an equal share for each field
        L.fields.forEach((f, k) => next.set(f.i, (next.get(f.i) || 0) + parts[k]));
        L.share = share;
      }
      const same = next.size === greyIn.size && [...next].every(([k, v]) => greyIn.get(k) === v);
      greyIn = next;
      if (same) break;
    }
    for (const d of dests) {
      d.grey = greyIn.get(d.i) || 0;
      d.got = Math.min(d.need, d.fresh + d.grey);
      d.met = d.got >= d.need;
      d.partial = !d.met && d.got > 0;
    }

    const wet = new Set(), greyWet = new Set(), leaks = [];
    for (const c of comps) {
      if (c.supply <= 0) continue;
      c.cells.forEach(i => wet.add(i));
      c.leaks.forEach(i => leaks.push(i));
    }
    for (const L of links) if (L.share > 0) L.cells.forEach(i => greyWet.add(i));
    const maxDist = order.reduce((m, e) => Math.max(m, e.dist), 0);
    return {
      comps, dests, links, supply, lost: { leak: lostLeak, evap: lostEvap }, waste: lostLeak + lostEvap,
      unused: comps.reduce((s, c) => s + (c.supply > 0 ? c.unused : 0), 0),
      order: order.filter(e => wet.has(e.i)), maxDist, greyDist, wet, greyWet, leaks,
      greyUsed: links.some(L => L.share > 0 && L.fields.some(f => f.grey > 0)),
      rain: comps.reduce((s, c) => s + (c.dests.length ? c.sources.filter(i => T[i].type === 'rain').length : 0), 0) // catchers that feed someone
    };
  }

  /** The cells that carry water in the stored solution (leaks fixed): the rest are decoys. */
  function network(board, o) {
    const fixedBoard = Object.assign({}, board, { tiles: board.tiles.map(t => (t && t.leak ? Object.assign({}, t, { fixed: true }) : t)) });
    const r = simulate(fixedBoard, rotsOf(board, 'sol'), o);
    const set = new Set([...r.wet, ...r.greyWet]);
    return set;
  }

  /** Quarter turns from rots to the stored solution, over the tiles that carry water. */
  function par(board, rots, net) {
    net = net || network(board);
    let p = 0;
    board.tiles.forEach((t, i) => { if (rotatable(t) && net.has(i)) p += turns(t, rots[i], t.sol); });
    return p;
  }

  /** Same function as AG.util.mulberry32 (pure files carry their own copy). */
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

  /**
   * Seeded start position. Water-carrying tiles get random rotations; decoys get random ones
   * that keep the stored solution perfect. checks.solved(rots): does this position already
   * count as solved (the game: every target destination has its water)? checks.perfect(rots):
   * is it a 3-star position (with every leak fixed)? A scramble is never solved and always
   * needs at least one turn. Locked tiles keep their rotation. → { rots, par }
   */
  function scramble(board, seed, o, checks) {
    const rnd = mulberry32((seed >>> 0) ^ 0x5a7e2);
    const net = network(board, o), sol = rotsOf(board, 'sol');
    const spin = board.tiles.map(t => rotatable(t));
    const decoys = board.tiles.map((t, i) => spin[i] && !net.has(i));
    const perfect = checks && checks.perfect, isSolved = checks && checks.solved;
    let best = null;
    for (let tries = 0; tries < 80; tries++) {
      const rots = sol.slice();
      board.tiles.forEach((t, i) => { if (spin[i] && !decoys[i]) rots[i] = Math.floor(rnd() * 4); });
      // decoys: random, but the stored solution must stay perfect with them
      for (let k = 0; k < 20; k++) {
        board.tiles.forEach((t, i) => { if (decoys[i]) rots[i] = Math.floor(rnd() * 4); });
        if (!perfect) break;
        const test = sol.map((r, i) => (decoys[i] ? rots[i] : r));
        if (perfect(test)) break;
        if (k === 19) board.tiles.forEach((t, i) => { if (decoys[i]) rots[i] = sol[i]; });
      }
      const p = par(board, rots, net);
      if (p < 1) continue;
      if (isSolved && isSolved(rots)) continue;
      best = { rots, par: p };
      break;
    }
    if (!best) { // practically never: turn the first water-carrying tile once
      const rots = sol.slice(), i = board.tiles.findIndex((t, k) => spin[k] && net.has(k) && period(t) > 1);
      if (i >= 0) rots[i] = (sol[i] + 1) % 4;
      best = { rots, par: par(board, rots, net) };
    }
    return best;
  }

  const api = { DX, DY, OPP, DIR, CODES, BASE, PERIOD, PRIORITY, DEFAULTS, openings, has, period, rotatable, turns, parse, rotsOf, tileAt, split, simulate, network, par, scramble, mulberry32 };
  AG.logic.waterFlow = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
