/* 11 Fire Escape Maze — the pure, seeded floor-plan generator (no DOM). The same params and
 * seed give the same school floor on every device (the Daily Challenge). Tested in
 * kalasag-dev/minigames/tests/fire-escape.test.js. Needs AG.logic.gridGen + AG.logic.gridPath.
 *
 *   const plan = AG.logic.fireEscapeGen.generate(params, seed)
 *   params: { cells, rooms, braid, features: { smoke, doors, fire, elevator, classmate },
 *             doorShare: [0.3, 0.5], hotDoors: [1, 3], fires, smokeSources, smokeRadius,
 *             walkStepMs, parMult, doorMs, parMinMs }
 *
 * 1. mazeBacktracker(cells) → braid(ratio) → carveRooms(count). The building gets a ring of
 *    yard tiles around it, so plan.w = 2 × cells + 3.
 * 2. START = the centre of the first room (the classroom). EXIT = the stairwell on the
 *    building's border farthest from it; the ASSEMBLY area is the yard tile just outside.
 * 3. DOORS (doors): 30–50 % of the room entrances, 1–3 of them HOT (blocked), each hot door
 *    kept only while the assembly area stays reachable from the start (and the classmate).
 * 4. FIRES (fire): rooms or halls off the main path. ELEVATOR (elevator): a wall tile near
 *    the start between two halls, where a hole would look like a shortcut.
 * 5. EXIT SIGNS along the BFS next step, computed once: every hall junction, plus every tile
 *    where a pupil who keeps walking straight would leave the route (so following the signs
 *    alone always gets out; followSigns() proves it).
 * 6. 2–4 CHECKPOINTS on the main path; 3 ⭐ coins in dead ends or loops off it.
 * 7. Par = shortest path (steps) × walkStepMs × parMult + doors on the path × doorMs
 *    (at least parMinMs). */
(function (root) {
  const AG = root.AG = root.AG || {};
  AG.logic = AG.logic || {};

  const T = { YARD: 0, WALL: 1, HALL: 2, ROOM: 3, EXIT: 4, ASSEMBLY: 5, DOOR: 6, ELEVATOR: 7 };
  const DIRS = [{ x: 0, y: -1, name: 'up' }, { x: 1, y: 0, name: 'right' }, { x: 0, y: 1, name: 'down' }, { x: -1, y: 0, name: 'left' }];
  const VEC = { up: [0, -1], right: [1, 0], down: [0, 1], left: [-1, 0] };
  const OPP = { up: 'down', down: 'up', left: 'right', right: 'left' };
  const key = (x, y) => x + ',' + y;

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
  const shuffle = (a, rnd) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); const t = a[i]; a[i] = a[j]; a[j] = t; } return a; };
  const between = (r, rnd) => (Array.isArray(r) ? r[0] + rnd() * (r[1] - r[0]) : r);
  const intBetween = (r, rnd) => (Array.isArray(r) ? r[0] + Math.floor(rnd() * (r[1] - r[0] + 1)) : r);

  /** A grid view of a plan for the path utils. opts: { block: Set of 'x,y', open: Set } */
  function navGrid(plan, opts) {
    const block = (opts && opts.block) || null, open = (opts && opts.open) || null;
    return {
      w: plan.w, h: plan.h,
      passable(x, y) {
        if (x < 0 || y < 0 || x >= plan.w || y >= plan.h) return false;
        const k = key(x, y);
        if (block && block.has(k)) return false;
        if (open && open.has(k)) return true;
        const c = plan.grid[y * plan.w + x];
        if (c === T.HALL || c === T.ROOM || c === T.EXIT || c === T.ASSEMBLY) return true;
        if (c === T.DOOR) return !plan.hot.has(k);
        return false;
      }
    };
  }
  /** Tiles that never block for navigation purposes, but fires and hot doors do. */
  function blockedSet(plan, extra) {
    const s = new Set(plan.hot);
    plan.fires.forEach(f => s.add(key(f.x, f.y)));
    if (plan.classmate) s.add(key(plan.classmate.x, plan.classmate.y));
    (extra || []).forEach(k => s.add(k));
    return s;
  }

  function generate(params, seed) {
    const G = AG.logic.gridGen, P = AG.logic.gridPath;
    const p = Object.assign({ cells: 7, rooms: 2, braid: 0.5, features: {}, doorShare: [0.3, 0.5], hotDoors: [1, 1], fires: 2, smokeSources: 2, smokeRadius: 3, walkStepMs: 140, parMult: 2.5, doorMs: 1000, parMinMs: 0 }, params);
    const f = Object.assign({}, p.features);
    seed = seed >>> 0;
    const rnd = mulberry32(seed ^ 0x5eed);

    /* 1. maze → braid → rooms, then the yard ring */
    const m = G.mazeBacktracker(p.cells, p.cells, seed);
    G.braid(m, p.braid, seed + 1);
    const mazeRooms = G.carveRooms(m, p.rooms, seed + 2, { min: 2, max: Math.min(3, p.cells) });
    const W = m.w + 2, H = m.h + 2;
    const grid = new Uint8Array(W * H).fill(T.YARD);
    const rooms = mazeRooms.map(r => ({ x: r.x + 1, y: r.y + 1, w: r.w, h: r.h, entrances: r.entrances.map(e => ({ x: e.x + 1, y: e.y + 1, dir: e.dir })) }));
    const roomOf = new Int16Array(W * H).fill(-1);
    rooms.forEach((r, i) => { for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) roomOf[y * W + x] = i; });
    for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) {
      const i = (y + 1) * W + x + 1;
      grid[i] = !m.passable(x, y) ? T.WALL : roomOf[i] >= 0 ? T.ROOM : T.HALL;
    }
    const plan = {
      w: W, h: H, cells: p.cells, seed, grid, rooms, roomOf, features: f,
      hot: new Set(), doors: [], fires: [], smoke: [], signs: [], checkpoints: [], coins: [],
      elevator: null, classmate: null
    };
    const at = (x, y) => (x < 0 || y < 0 || x >= W || y >= H ? -1 : grid[y * W + x]);
    const set = (x, y, c) => { grid[y * W + x] = c; };
    const isFloor = (x, y) => { const c = at(x, y); return c === T.HALL || c === T.ROOM; };

    /* 2. start in the classroom; the stairwell farthest from it; the assembly area outside */
    const sr = rooms[0];
    plan.startRoom = sr ? 0 : -1;
    plan.start = sr ? { x: sr.x + (sr.w >> 1), y: sr.y + (sr.h >> 1) } : { x: 2, y: 2 };
    let dist = P.bfs(navGrid(plan), plan.start);
    let best = null;
    for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
      if (at(x, y) !== T.WALL || !(x === 1 || y === 1 || x === W - 2 || y === H - 2)) continue;
      for (const D of DIRS) {
        const ix = x - D.x, iy = y - D.y, ox = x + D.x, oy = y + D.y;
        if (at(ox, oy) !== T.YARD || !isFloor(ix, iy)) continue; // must face out of the building
        const d = dist[iy * W + ix];
        if (d >= 0 && (!best || d > best.d || (d === best.d && rnd() < 0.5))) best = { x, y, d, out: D };
      }
    }
    plan.exit = { x: best.x, y: best.y, dir: best.out.name };
    plan.assembly = { x: best.x + best.out.x, y: best.y + best.out.y };
    set(plan.exit.x, plan.exit.y, T.EXIT);
    set(plan.assembly.x, plan.assembly.y, T.ASSEMBLY);
    const goal = plan.assembly;
    const reachable = (block, from) => P.isReachable(navGrid(plan, { block }), from || plan.start, goal);
    let mainPath = P.astar(navGrid(plan), plan.start, goal);
    const onPath = () => new Set(mainPath.map(c => key(c.x, c.y)));

    /* the classmate (needed before doors so a hot door can't shut them in) */
    if (f.classmate) {
      const others = rooms.map((r, i) => ({ r, i })).filter(o => o.i !== plan.startRoom);
      const path = onPath();
      others.sort((a, b) => {
        const ca = { x: a.r.x + (a.r.w >> 1), y: a.r.y + (a.r.h >> 1) }, cb = { x: b.r.x + (b.r.w >> 1), y: b.r.y + (b.r.h >> 1) };
        return (path.has(key(ca.x, ca.y)) ? 1 : 0) - (path.has(key(cb.x, cb.y)) ? 1 : 0) || 0;
      });
      const pickRoom = others.length ? others[0].r : null;
      if (pickRoom) plan.classmate = { x: pickRoom.x + (pickRoom.w >> 1), y: pickRoom.y + (pickRoom.h >> 1), room: rooms.indexOf(pickRoom) };
      else {
        const ends = G.deadEnds(m).map(e => ({ x: e.x + 1, y: e.y + 1 })).filter(e => !path.has(key(e.x, e.y)));
        const e = ends[0] || mainPath[mainPath.length >> 1];
        plan.classmate = { x: e.x, y: e.y, room: -1 };
      }
    }
    const mates = () => (plan.classmate ? [plan.classmate] : []);
    // the classmate's tile itself is occupied: reach a tile next to them
    const mateOk = block => mates().every(c => DIRS.some(D => {
      const nx = c.x + D.x, ny = c.y + D.y;
      return navGrid(plan, { block }).passable(nx, ny) && P.isReachable(navGrid(plan, { block }), plan.start, { x: nx, y: ny });
    }));

    /* 3. doors on room entrances; some hot */
    if (f.doors) {
      const share = between(p.doorShare, rnd), cands = [];
      rooms.forEach(r => r.entrances.forEach(e => {
        if (at(e.x, e.y) !== T.HALL || roomOf[e.y * W + e.x] >= 0) return;
        if (cands.some(c => c.x === e.x && c.y === e.y)) return;
        // a door sits in a one-tile gap: walls on both sides across the doorway
        const side = e.dir === 'up' || e.dir === 'down' ? [[1, 0], [-1, 0]] : [[0, 1], [0, -1]];
        if (!side.every(([dx, dy]) => at(e.x + dx, e.y + dy) === T.WALL)) return;
        cands.push({ x: e.x, y: e.y, dir: e.dir });
      }));
      shuffle(cands, rnd);
      const n = Math.max(f.doors ? 1 : 0, Math.round(cands.length * share));
      plan.doors = cands.slice(0, Math.min(cands.length, n)).map(d => ({ x: d.x, y: d.y, dir: d.dir, hot: false }));
      plan.doors.forEach(d => set(d.x, d.y, T.DOOR));
      // hot doors: prefer doors off the main path, and one on the start room if it has two ways out
      const want = intBetween(p.hotDoors, rnd), path = onPath();
      const order = plan.doors.slice().sort((a, b) => (path.has(key(a.x, a.y)) ? 1 : 0) - (path.has(key(b.x, b.y)) ? 1 : 0));
      for (const d of order) {
        if (plan.hot.size >= want) break;
        const k = key(d.x, d.y), block = blockedSet(plan, [k]);
        if (reachable(block) && mateOk(block)) { plan.hot.add(k); d.hot = true; }
      }
      mainPath = P.astar(navGrid(plan, { block: blockedSet(plan) }), plan.start, goal);
    }

    /* 4. fires off the main path, and the elevator that looks like a shortcut */
    if (f.fire) {
      const path = onPath(), dPath = P.bfs(navGrid(plan), mainPath), dStart = P.bfs(navGrid(plan), plan.start);
      const cands = [];
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const i = y * W + x;
        if (!isFloor(x, y) || path.has(key(x, y)) || dPath[i] < 2 || dStart[i] < 5) continue;
        if (roomOf[i] === plan.startRoom && plan.startRoom >= 0) continue;
        if (plan.classmate && Math.abs(x - plan.classmate.x) + Math.abs(y - plan.classmate.y) < 3) continue;
        cands.push({ x, y, room: roomOf[i] >= 0, d: dPath[i] });
      }
      shuffle(cands, rnd).sort((a, b) => (b.room ? 1 : 0) - (a.room ? 1 : 0));
      for (const c of cands) {
        if (plan.fires.length >= p.fires) break;
        if (plan.fires.some(o => Math.abs(o.x - c.x) + Math.abs(o.y - c.y) < 4)) continue;
        const block = blockedSet(plan, [key(c.x, c.y)]);
        if (reachable(block) && mateOk(block)) plan.fires.push({ x: c.x, y: c.y });
      }
    }
    const nav = () => navGrid(plan, { block: blockedSet(plan) });
    const toGoal = P.bfs(nav(), goal);
    if (f.elevator) {
      const fromStart = P.bfs(nav(), plan.start);
      let pick = null;
      for (let y = 2; y < H - 2; y++) for (let x = 2; x < W - 2; x++) {
        if (at(x, y) !== T.WALL) continue;
        for (const [a, b] of [[[x - 1, y], [x + 1, y]], [[x, y - 1], [x, y + 1]]]) {
          if (at(a[0], a[1]) !== T.HALL || at(b[0], b[1]) !== T.HALL) continue;
          const ia = a[1] * W + a[0], ib = b[1] * W + b[0];
          const near = Math.min(fromStart[ia] < 0 ? 1e9 : fromStart[ia], fromStart[ib] < 0 ? 1e9 : fromStart[ib]);
          if (near > 8 || toGoal[ia] < 0 || toGoal[ib] < 0) continue;
          const gain = Math.abs(toGoal[ia] - toGoal[ib]) - near * 0.5 + rnd() * 0.1;
          if (!pick || gain > pick.gain) pick = { x, y, gain };
        }
      }
      if (pick) { plan.elevator = { x: pick.x, y: pick.y }; set(pick.x, pick.y, T.ELEVATOR); }
    }

    /* the route out, and 2–4 checkpoints along it (respawn points, so they get a sign too) */
    const next = P.nextStep(nav(), goal);
    plan.next = next;
    plan.path = P.pathFromNext(next, plan.start);
    plan.shortest = plan.path.length - 1;
    const nCp = Math.max(2, Math.min(4, 2 + Math.floor(plan.shortest / 40)));
    for (let i = 1; i <= nCp; i++) {
      let j = Math.round(plan.shortest * i / (nCp + 1));
      for (let k = 0; k < 6 && j < plan.path.length - 2; k++, j++) if (at(plan.path[j].x, plan.path[j].y) === T.HALL) break;
      const c = plan.path[Math.max(1, Math.min(plan.path.length - 3, j))];
      if (!plan.checkpoints.some(o => o.x === c.x && o.y === c.y)) plan.checkpoints.push({ x: c.x, y: c.y, i: plan.path.indexOf(c) });
    }

    /* 5. exit signs: hall junctions + wherever walking straight would leave the route */
    const signAt = new Map();
    const N = nav();
    const degree = (x, y) => DIRS.reduce((n, D) => n + (N.passable(x + D.x, y + D.y) ? 1 : 0), 0);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (at(x, y) !== T.HALL || !N.passable(x, y)) continue;
      const d = next.at(x, y);
      if (d && degree(x, y) >= 3) signAt.set(key(x, y), d);
    }
    const walkFrom = (sx, sy, heading) => {
      let x = sx, y = sy, h = heading;
      for (let guard = W * H; guard > 0; guard--) {
        const want = next.at(x, y);
        if (!want) return; // the goal (or a tile with no route)
        const k = key(x, y);
        let d = signAt.get(k) || defaultDir(N, x, y, h);
        if (d !== want) { signAt.set(k, want); d = want; }
        x += VEC[d][0]; y += VEC[d][1]; h = d;
      }
    };
    walkFrom(plan.start.x, plan.start.y, null);
    plan.checkpoints.forEach(c => walkFrom(c.x, c.y, null));
    rooms.forEach(r => walkFrom(r.x + (r.w >> 1), r.y + (r.h >> 1), null));
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (N.passable(x, y) && next.at(x, y)) walkFrom(x, y, next.at(x, y));
    plan.signs = [...signAt].map(([k, dir]) => { const [x, y] = k.split(',').map(Number); return { x, y, dir }; })
      .filter(s => at(s.x, s.y) !== T.ASSEMBLY);

    /* 6. the main path, checkpoints and coins */
    const pathSet = new Set(plan.path.map(c => key(c.x, c.y)));
    const dPath = P.bfs(N, plan.path);
    const taken = new Set([key(plan.start.x, plan.start.y)].concat(plan.checkpoints.map(c => key(c.x, c.y))));
    const ends = [], loops = [];
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (!isFloor(x, y) || !N.passable(x, y) || pathSet.has(key(x, y)) || dPath[i] < 1) continue;
      (degree(x, y) === 1 ? ends : loops).push({ x, y, d: dPath[i] + rnd() * 0.5 });
    }
    const far = (a, b) => b.d - a.d;
    for (const c of ends.sort(far).concat(loops.sort(far))) {
      if (plan.coins.length >= 3) break;
      if (taken.has(key(c.x, c.y)) || plan.coins.some(o => Math.abs(o.x - c.x) + Math.abs(o.y - c.y) < 4)) continue;
      plan.coins.push({ x: c.x, y: c.y });
    }
    for (const c of plan.path.slice(2, -2).reverse()) { // tiny mazes: fall back to the path itself
      if (plan.coins.length >= 3) break;
      if (!taken.has(key(c.x, c.y)) && !plan.coins.some(o => o.x === c.x && o.y === c.y)) plan.coins.push({ x: c.x, y: c.y });
    }

    /* smoke: one cloud on the main path's middle, the rest from rooms and halls */
    if (f.smoke) {
      const sources = [plan.path[plan.path.length >> 1]];
      const pool = shuffle(rooms.filter((r, i) => i !== plan.startRoom).map(r => ({ x: r.x + (r.w >> 1), y: r.y + (r.h >> 1) })), rnd)
        .concat(shuffle(plan.path.slice(3, -3), rnd));
      for (const s of pool) { if (sources.length >= p.smokeSources) break; if (sources.every(o => Math.abs(o.x - s.x) + Math.abs(o.y - s.y) > p.smokeRadius)) sources.push(s); }
      const d = P.bfs(navGrid(plan), sources, { maxDist: p.smokeRadius }), keep = [];
      const safe = new Set([key(plan.start.x, plan.start.y), key(plan.exit.x, plan.exit.y), key(goal.x, goal.y)]);
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (d[y * W + x] >= 0 && isFloor(x, y) && !safe.has(key(x, y))) keep.push({ x, y });
      plan.smoke = keep;
    }

    /* 7. par */
    plan.doorsOnPath = plan.path.filter(c => at(c.x, c.y) === T.DOOR).length;
    plan.par = Math.max(p.parMinMs, Math.round(plan.shortest * p.walkStepMs * p.parMult + plan.doorsOnPath * p.doorMs));
    plan.params = p;
    return plan;
  }

  /** The straight-on choice of someone with no sign to read: keep going if you can, else the
   *  one way that isn't back, else turn round; null when there's a real choice to make. */
  function defaultDir(N, x, y, heading) {
    if (heading && N.passable(x + VEC[heading][0], y + VEC[heading][1])) return heading;
    const opts = DIRS.filter(D => N.passable(x + D.x, y + D.y) && D.name !== OPP[heading]).map(D => D.name);
    if (opts.length === 1) return opts[0];
    if (!opts.length && heading && N.passable(x + VEC[OPP[heading]][0], y + VEC[OPP[heading]][1])) return OPP[heading];
    return null;
  }

  /** Walks like a pupil who only reads the signs (and otherwise keeps walking straight).
   *  → { reached, steps, stuck } (stuck: a choice with no sign, or a loop). */
  function followSigns(plan, from, opts) {
    const N = navGrid(plan, { block: blockedSet(plan, opts && opts.block) });
    const signs = new Map(plan.signs.map(s => [key(s.x, s.y), s.dir]));
    let x = from.x, y = from.y, h = (opts && opts.heading) || null;
    const seen = new Set();
    for (let steps = 0; steps < plan.w * plan.h * 4; steps++) {
      if (x === plan.assembly.x && y === plan.assembly.y) return { reached: true, steps };
      const st = key(x, y) + ':' + h;
      if (seen.has(st)) return { reached: false, steps, stuck: 'loop' };
      seen.add(st);
      const d = signs.get(key(x, y)) || defaultDir(N, x, y, h);
      if (!d || !N.passable(x + VEC[d][0], y + VEC[d][1])) return { reached: false, steps, stuck: key(x, y) };
      x += VEC[d][0]; y += VEC[d][1]; h = d;
    }
    return { reached: false, stuck: 'too long' };
  }

  const api = { T, generate, navGrid, blockedSet, followSigns, defaultDir, key, mulberry32 };
  AG.logic.fireEscapeGen = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
