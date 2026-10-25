/* 03 Wave Runner: the pure rules (no DOM, no drawing). Speeds and the head start, scoring and stars, the seeded warning and
 * power-up rolls, a stage's chunk plan, and how long each ROUTE of a fork takes (the upper route must always win). The scenes
 * call these; wave-runner.test.js checks them and every chunk. Needs tuning.js and the E3 logic (logic/sidescroll/chunks.js). */
(function (root) {
  const AG = root.AG = root.AG || {};
  const WR = AG.waveRunner = AG.waveRunner || {};
  const T = () => WR.tuning, SS = () => AG.logic.sidescroll;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const diffOf = d => (d === 'advanced' ? 'advanced' : 'easy');
  const rng = seed => SS().mulberry32(seed >>> 0);

  /* ---------- speeds and the wave ---------- */
  /** Run speed (px/s) of a level. */
  const speedFor = (diff, level) => T().speed[diffOf(diff)][clamp(level | 0, 1, 5) - 1];
  /** Every run speed the chunks must be playable at (both difficulties, all levels). */
  const allSpeeds = () => [].concat(T().speed.easy, T().speed.advanced);
  /** Endless: +2 % per 100 m, at most +50 %. */
  const endlessSpeed = (base, metres) => base * Math.min(T().endless.cap, 1 + T().endless.perHundred * (Math.max(0, metres) / 100));
  const chaserFactor = diff => T().chaser[diffOf(diff)];
  /** gap = baseGap + max(0, 2.0 − reaction) × 60. reaction = null (no press in time) gives baseGap. */
  const headStart = (diff, reaction) => T().baseGap[diffOf(diff)] + (reaction == null ? 0 : Math.max(0, T().reactionWindow - reaction) * T().headPerSec);
  const metres = px => Math.max(0, Math.floor(px / T().px));

  /* ---------- scoring ---------- */
  /** 300 × max(0, 1 − reaction / 2): the faster the RUN press, the more. */
  const reactionBonus = r => (r == null ? 0 : Math.round(T().score.reactionMax * Math.max(0, 1 - r / T().reactionWindow)));
  /** o: { metres, coins, reaction, hits, wait } → { total, parts } (stage: no-hit bonus when no obstacle hit). */
  function score(o) {
    const S = T().score, parts = {
      distance: Math.round((o.metres || 0) * S.perMetre), coins: (o.coins || 0) * S.coin, reaction: reactionBonus(o.reaction),
      noHit: o.finished && !(o.hits > 0) ? S.noHit : 0, wait: o.wait || 0
    };
    return { total: parts.distance + parts.coins + parts.reaction + parts.noHit + parts.wait, parts };
  }
  /** 0 = not at the flag; 1 = the flag; 2 = ≤ 1 heart lost AND reaction < 2 s; 3 = no hearts lost AND score ≥ target3. */
  function stars(o) {
    if (!o.won) return 0;
    const fast = o.reaction != null && o.reaction < T().stars.reaction;
    if (o.heartsLost === 0 && o.score >= o.target3) return 3;
    return o.heartsLost <= 1 && fast ? 2 : 1;
  }
  /** Easy's target3, or the `advanced` override. */
  const target3 = (level, diff) => (diffOf(diff) === 'advanced' && level.advanced ? level.advanced.target3 : level.target3);
  /** Endless stars by distance (the daily never opens a level, it only keeps the best score). */
  const endlessStars = m => (m >= 600 ? 3 : m >= 300 ? 2 : m >= 100 ? 1 : 0);

  /** Adds a finished run to the badge record q ({ quick, waits }) and returns the badge ids won now. */
  function badges(q, o) {
    const B = T().badges, ev = [];
    if (o.reaction != null && o.reaction < B.quickSec) q.quick = (q.quick || 0) + 1;
    if (o.waitedFirst) q.waits = (q.waits || 0) + 1;
    if (o.reaction != null && o.reaction < B.quickSec && q.quick >= B.quickCount) ev.push('quick-to-run');
    if (o.waitedFirst && q.waits >= B.waitCount) ev.push('high-ground');
    if (o.level === 4 && o.won && !(o.hits > 0) && o.mode === 'stage') ev.push('night-runner');
    return ev;
  }

  /* ---------- seeded picks ---------- */
  /** The warning at the start: shake | retreat | roar. */
  const warningFor = seed => T().warnings[Math.floor(rng((seed >>> 0) ^ 0x7a11)() * T().warnings.length)];
  /** The power-up (or null) in a chunk's slot: 10 % of the slots, a third each. Same seed and index → same answer. */
  function powerFor(seed, index) {
    const r = rng(((seed >>> 0) ^ Math.imul(index + 1, 0x9e3779b1)) >>> 0), k = T().power.kinds;
    return r() < T().power.chance ? k[Math.floor(r() * k.length)] : null;
  }
  /** Endless: the difficulty band of chunk number i (it widens every few chunks). */
  function bandAt(i) { const hi = Math.min(5, 1 + Math.floor(i / T().endless.bandEvery)); return [Math.max(1, hi - 3), hi]; }
  /** Which tag the endless pool of level 1–5 draws on (the climb level uses the town pool: endless has no vertical climb). */
  const themeOf = level => ({ 1: 'beach', 2: 'town', 3: 'town', 4: 'night', 5: 'multiwave' })[level] || 'beach';

  /* ---------- a stage's plan ---------- */
  /** levels.json `sequence` (chunk ids) → [{ chunk, x }] from the library; throws on an unknown id or a broken row chain. */
  function plan(lib, ids) {
    let x = 0, y = null;
    return ids.map((id, i) => {
      const chunk = lib.get(id);
      if (!chunk) throw new Error('Unknown chunk ' + id);
      if (y != null && chunk.entryY !== y) throw new Error('Chunk ' + id + ' enters at row ' + chunk.entryY + ' but the last one exits at ' + y);
      const p = { chunk, x, index: i };
      x += chunk.width * 16; y = chunk.exitY;
      return p;
    });
  }
  /** What a plan holds: metres from the start to the flag, coins on the safe routes, pets, forks. */
  function planStats(pl) {
    let coins = 0, pets = 0, forks = 0, decoys = 0;
    for (const p of pl) {
      if (p.chunk.tags.includes('branch')) forks++;
      for (const o of p.chunk.objects) {
        if (o.type !== 'pickup') continue;
        if (o.id === 'coin' && o.route !== 'lower') coins++;
        else if (o.id === 'pet') pets++;
        else if (o.id === 'decoy') decoys++;
      }
    }
    const last = pl[pl.length - 1], end = last.x + last.chunk.width * 16;
    return { chunks: pl.length, metres: metres(end - 24 - 40), coins, pets, forks, decoys };
  }
  /** The star target of a stage: finish without a hit, react in about 1 s and pick up half of the coins. */
  function suggestTarget3(st, diff) {
    const S = T().score, react = diffOf(diff) === 'advanced' ? 0.8 : 1.0, share = diffOf(diff) === 'advanced' ? 0.6 : 0.5;
    return Math.round((st.metres * S.perMetre + S.noHit + reactionBonus(react) + share * st.coins * S.coin) / 50) * 50;
  }

  /* ---------- forks ---------- */
  /** The chunk with only one route's objects (shared objects stay). */
  function routeChunk(chunk, route) {
    return Object.assign({}, chunk, { objects: chunk.objects.filter(o => !o.route || o.route === route) });
  }
  /** Seconds to run one route of a chunk at `speed`: the easiest path of the route alone, ground speed × its `mul`, plus ladder time. */
  function routeTime(chunk, route, speed) {
    const S = SS(), c = route ? routeChunk(chunk, route) : chunk, v = S.validate(c, { runSpeedMax: speed });
    if (!v.ok) return NaN;
    const objs = S.toWorld(S.normalize(c), 0).objs, path = v.path, W = c.width * 16, step = 4, climb = S.TUNING.climbSpeed;
    let t = 0, i = 0;
    for (let x = step / 2; x < W; x += step) {
      while (i + 1 < path.length && path[i + 1].x0 <= x) i++;
      const g = objs.find(o => o.type === 'solid' && o.y === path[i].y && o.x <= x && o.x + o.w > x);
      t += step / (speed * (g && g.mul != null ? g.mul : 1));
    }
    for (let k = 1; k < path.length; k++) if (path[k].via === 'ladder') t += (path[k - 1].y - path[k].y) / climb;
    return t;
  }
  /** { upper, lower, gain } seconds at a speed; gain = lower − upper, which must be > 0 in every fork. */
  function routeReport(chunk, speed) {
    const upper = routeTime(chunk, 'upper', speed), lower = routeTime(chunk, 'lower', speed);
    return { upper, lower, gain: lower - upper };
  }

  const api = { speedFor, allSpeeds, endlessSpeed, chaserFactor, headStart, metres, reactionBonus, score, stars, target3, endlessStars, badges,
    warningFor, powerFor, bandAt, themeOf, plan, planStats, suggestTarget3, routeChunk, routeTime, routeReport };
  WR.rules = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
