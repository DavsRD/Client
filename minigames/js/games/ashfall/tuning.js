/* Ashfall (ashfall): every feel number and the pure rules (no DOM): the object defs, waves built from
 * levels.json (alert levels, fall speed, spawn interval, good:bad ratio), wave orders, scoring, stars and badges.
 * AG.ashfall.tuning holds the numbers; .defs / .buildWaves / .nextOrder build what the E4 FallingField needs.
 * Pure, so it also runs in kalasag-dev/minigames/tests/ (ashfall.test.js). */
(function (root) {
  const AG = root.AG = root.AG || {};
  const A = AG.ashfall = AG.ashfall || {};
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * clamp(t, 0, 1);

  const tuning = {
    rigH: 40,                                         // body height; the hitbox is the engine's fixed 20 × 28
    width: 480, groundY: 235, minX: 20, maxX: 460,
    hearts: { easy: 5, advanced: 4 },
    maxSpeed: { easy: 160, advanced: 190 },           // px/s: keys and follow-finger alike
    fall: { easy: [90, 160], advanced: [120, 210] },  // px/s, first wave → last wave
    interval: { easy: [900, 500], advanced: [600, 300] }, // spawn interval ms, first wave → last wave
    goodShare: [0.5, 0.35],                           // good : bad = 50 : 50 → 35 : 65 by the last wave
    rockWarnMs: { easy: 1100, advanced: 800 },        // the rock's shadow shows this long before it falls
    powerWeight: 3,                                   // each power-up's weight in the table (the 20 s cooldown does the rest)
    powerCooldownMs: 20000,
    orderBoost: 3.5,                                  // the ordered items are this much likelier in their wave
    waveBonus: 100, orderBonus: 200,
    hitGraceMs: 1000, oopsMs: 1000,
    lahar: { w: 80, warnMs: 2000, activeMs: 5000, offsetMs: 3000 }, // the flow starts offsetMs after its wave begins
    dark: { max: 0.55, radius: { easy: 110, advanced: 80 }, color: '#150f26' },
    evac: { timeMs: { easy: 6000, advanced: 4000 }, extraMs: 3000, intervalMul: 0.5, base: 300, perSec: 50, boardMs: 1500, badgeSecs: 3 },
    bus: { w: 96, h: 48, door: 12 },                  // a sprite frame; the door end is `door` px deep
    badgeMasks: 50,
    star2: 0.6, star3: 0.85,                          // targets are about this share of a simulated max (see levels.json)
    photos: 3
  };

  /* ---------- the objects ---------- */
  const R = id => 'ashfall.obj.' + id;
  /** The def list for a difficulty (the FallingField's `defs`). The coconut is Advanced only. */
  function defs(difficulty) {
    const adv = difficulty === 'advanced';
    const list = [
      { id: 'rock', kind: 'bad', icon: R('rock'), size: 24, speedMul: 1.0, shadowWarnMs: tuning.rockWarnMs[adv ? 'advanced' : 'easy'] },
      { id: 'ash', kind: 'bad', icon: R('ash'), size: 18, speedMul: 0.8, drift: { amp: 10, freq: 1.2 }, shadow: true },
      { id: 'ember', kind: 'bad', icon: R('ember'), size: 12, speedMul: 1.3, shadow: true, frames: 2, fps: 6 },
      { id: 'mask', kind: 'good', icon: 'facemask', size: 16, speedMul: 0.9, points: 100 },
      { id: 'goggles', kind: 'good', icon: 'goggles', size: 16, speedMul: 0.9, points: 100 },
      { id: 'water', kind: 'good', icon: 'water', size: 16, speedMul: 0.9, points: 60 },
      { id: 'flashlight', kind: 'good', icon: 'flashlight', size: 16, speedMul: 0.9, points: 60 },
      { id: 'radio', kind: 'good', icon: 'radio', size: 16, speedMul: 0.9, points: 60 },
      { id: 'hardhat', kind: 'powerup', icon: 'hard_hat', size: 16, speedMul: 0.8, power: 'shield' },
      { id: 'slowmo', kind: 'powerup', icon: '🐢', size: 16, speedMul: 0.8, power: 'slowmo' },
      { id: 'magnet', kind: 'powerup', icon: '🧲', size: 16, speedMul: 0.8, power: 'magnet' },
      { id: 'photo', kind: 'collectible', icon: 'documents', size: 16, speedMul: 0.7 }
    ];
    if (adv) list.push({ id: 'coconut', kind: 'good', icon: R('coconut'), size: 20, speedMul: 1.0, points: 50 }); // a rock look-alike, but no shadow
    return list;
  }

  /** Words for a wave order and its toasts. */
  const NAMES = { mask: ['mask', 'masks'], goggles: ['pair of goggles', 'pairs of goggles'], water: ['water bottle', 'water bottles'], flashlight: ['flashlight', 'flashlights'], radio: ['radio', 'radios'] };
  const orderLabel = need => ({ en: 'Catch ' + Object.keys(need).map(id => need[id] + ' ' + (NAMES[id] || [id, id])[need[id] === 1 ? 0 : 1]).join(' + ') });

  /* ---------- waves ---------- */
  /** A level's good weights are scaled to `share` of 100, its bad weights to the rest, plus the power-ups. */
  function waveTable(src, i, n, difficulty, order) {
    const share = lerp(tuning.goodShare[0], tuning.goodShare[1], n > 1 ? i / (n - 1) : 1);
    const scale = (o, total) => { const sum = Object.keys(o).reduce((s, k) => s + o[k], 0) || 1; const out = {}; Object.keys(o).forEach(k => { out[k] = o[k] * total / sum; }); return out; };
    const good = Object.assign({}, src.good);
    if (difficulty !== 'advanced') delete good.coconut;
    if (order) Object.keys(order.need).forEach(id => { if (good[id]) good[id] *= tuning.orderBoost; });
    const table = Object.assign(scale(good, share * 100), scale(src.bad, (1 - share) * 100));
    (src.power || []).forEach(id => { table[id] = tuning.powerWeight; });
    return table;
  }
  /** levels.json's waves as the engine's waves: fall speed and spawn interval climb across the level. */
  function buildWaves(level, difficulty) {
    const d = difficulty === 'advanced' ? 'advanced' : 'easy', n = level.waves.length;
    return level.waves.map((w, i) => {
      const p0 = i / n, p1 = (i + 1) / n, f = tuning.fall[d], s = tuning.interval[d];
      return {
        alert: w.alert, label: { en: 'Alert Level ' + w.alert }, durationMs: w.durationMs,
        fallSpeed: [Math.round(lerp(f[0], f[1], p0)), Math.round(lerp(f[0], f[1], p1))],
        spawnIntervalMs: [Math.round(lerp(s[0], s[1], p0)), Math.round(lerp(s[0], s[1], p1))],
        table: waveTable(w.table, i, n, d, w.order),
        order: w.order ? { need: Object.assign({}, w.order.need), bonus: tuning.orderBonus, label: orderLabel(w.order.need) } : null
      };
    });
  }
  /** The next order in a wave after one is done: two different good items of the wave, 2 + 1 (never the coconut). */
  function nextOrder(table, defs, rng) {
    const ids = Object.keys(table).filter(id => defs[id] && defs[id].kind === 'good' && id !== 'coconut');
    if (!ids.length) return null;
    const a = ids[Math.floor(rng() * ids.length)], rest = ids.filter(id => id !== a), need = { [a]: 2 };
    if (rest.length) need[rest[Math.floor(rng() * rest.length)]] = 1;
    return { need, bonus: tuning.orderBonus, label: orderLabel(need) };
  }

  /* ---------- scoring ---------- */
  const scoring = {
    evacBonus: secsLeft => tuning.evac.base + tuning.evac.perSec * Math.max(0, secsLeft),
    /** The star targets for a difficulty: levels.json has Easy's and an `advanced` override. */
    targets(level, difficulty) {
      const t = difficulty === 'advanced' && level.advanced ? level.advanced : level;
      return { target2: t.target2, target3: t.target3 };
    },
    /** 0 = did not finish; 1 = survived every wave (L5: reached the bus); 2 = score ≥ target2; 3 = score ≥ target3 AND every wave order done. */
    stars(o) {
      if (!o.completed) return 0;
      if (o.score >= o.target3 && o.ordersAll) return 3;
      return o.score >= o.target2 ? 2 : 1;
    },
    /** Adds a finished level to the stats record q ({ masks, riverWise }); returns the badge events. */
    badges(q, o) {
      q.masks = (q.masks || 0) + o.masks;
      const ev = [];
      if (q.masks >= tuning.badgeMasks) ev.push('mask-on');
      if (o.level === 4 && o.completed && o.laharHits === 0) ev.push('river-wise');
      if (o.level === 5 && o.completed && o.secsLeft >= tuning.evac.badgeSecs) ev.push('first-on-the-bus');
      return ev;
    }
  };

  const api = { tuning, defs, orderLabel, waveTable, buildWaves, nextOrder, scoring, NAMES };
  Object.assign(A, api);
  if (typeof module !== 'undefined') module.exports = A;
})(typeof window !== 'undefined' ? window : globalThis);
