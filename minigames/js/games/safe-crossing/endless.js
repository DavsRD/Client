/* Safe Crossing — the Daily Challenge: an endless road, the same for every device on the
 * same date. Pure (tested in safe-crossing.test.js with a wait-and-go bot on 50 seeds).
 *
 *   AG.safeCrossing.generateDaily(seed) → an entry like levels.json's, with endless: true
 *     { daily, endless, seed, world, level, lanes: [...], items: [...], bridges: [...] }
 * Rules: at most 4 road lanes in a row; a safe row after every rail; a zebra on at least
 * every second road; every 40 rows the ramp goes up a step (faster, busier, then signals,
 * parked vehicles, rails, footbridges). It ends at School after tuning.endless.rows rows,
 * or when the hearts run out. */
(function (root) {
  const AG = root.AG = root.AG || {};
  const SC = AG.safeCrossing = AG.safeCrossing || {};

  const MIXES = ['light', 'mixed', 'market', 'busy', 'busy'];

  function zebraFor(rng) { const c = rng.int(2, 12); return [c, c + 1]; }

  function parkedLane(rng, zebra) {
    const cars = [], kinds = ['jeepney', 'car', 'tricycle', 'jeepney'];
    const free = c => !zebra || c < zebra[0] - 1 || c > zebra[1] + 1;
    let c = rng.int(0, 1);
    while (c < 16) {
      const kind = kinds[rng.int(0, kinds.length - 1)], n = SC.tuning.lengths[kind];
      let ok = c + n <= 16;
      for (let k = 0; k < n && ok; k++) ok = free(c + k);
      if (ok) { cars.push([c, kind]); c += n + rng.int(1, 2); } else c++;
    }
    return { t: 'parked', cars };
  }

  /** Lanes from `from` (exclusive) on: a safe strip, then a hazard segment, until `rows`. */
  function generateDaily(seed) {
    const T = SC.tuning, E = T.endless, rng = SC.rng((seed >>> 0) ^ 0x5afec0de);
    const lanes = [{ t: 'home' }, { t: 'side' }], items = [], bridges = [];
    let roadsSinceZebra = 0, lastWasRail = false, phones = 0;
    const tierAt = i => Math.min(4, Math.floor(i / E.ramp));
    while (lanes.length < E.rows - 3) {
      const i = lanes.length, tier = tierAt(i), left = E.rows - 2 - i; // rows before the last safe row and School
      // the hazard segment
      if (tier >= 2 && !lastWasRail && rng.next() < 0.18) {
        lanes.push({ t: 'rail', dir: rng.next() < 0.5 ? 'L' : 'R', every: rng.int(11, 15) * 1000, offset: rng.int(0, 14) * 1000 });
        lastWasRail = true;
      } else {
        lastWasRail = false;
        const n = Math.max(1, Math.min(4, 1 + rng.int(0, Math.min(3, 1 + tier)), left - 1));
        const zebra = roadsSinceZebra >= 1 || rng.next() < 0.65 - tier * 0.08 ? zebraFor(rng) : null;
        roadsSinceZebra = zebra ? 0 : roadsSinceZebra + 1;
        const signal = zebra && tier >= 1 && rng.next() < 0.4 ? { offset: rng.int(0, 15) * 1000 } : null;
        const parked = tier >= 1 && n >= 2 && rng.next() < 0.35;
        const mix = MIXES[Math.min(MIXES.length - 1, tier + rng.int(0, 1))];
        const start = lanes.length;
        let dir = rng.next() < 0.5 ? 'L' : 'R';
        for (let k = 0; k < n; k++) {
          if (parked && k === 0) { lanes.push(parkedLane(rng, zebra)); continue; }
          const road = { t: 'road', dir, speed: 34 + tier * 8 + rng.int(0, 10), mix, gap: [Math.max(2, 4 - Math.floor(tier / 2)), Math.max(4, 8 - tier)] };
          if (zebra) road.z = zebra.slice();
          if (signal) road.sig = Object.assign({}, signal);
          if (mix === 'market' && k === (parked ? 1 : 0)) road.stops = true;
          lanes.push(road);
          dir = dir === 'L' ? 'R' : 'L';
        }
        // a footbridge over a wide road, stairs on the safe rows either side
        const roads = lanes.length - start;
        if (tier >= 2 && roads >= 3 && rng.next() < 0.5) {
          let col = rng.int(1, 14);
          if (zebra && col >= zebra[0] - 1 && col <= zebra[1] + 1) col = zebra[0] > 4 ? 1 : 14;
          lanes.slice(start).forEach(l => { if (l.t === 'parked') l.cars = l.cars.filter(([c, kind]) => col < c || col >= c + T.lengths[kind]); });
          bridges.push({ col, from: start - 1, to: lanes.length });
        }
      }
      // the safe strip after it (always at least one row: a rail is never followed by a road)
      const strip = 1 + (rng.next() < 0.45 ? 1 : 0);
      for (let k = 0; k < strip && lanes.length < E.rows - 2; k++) {
        lanes.push({ t: rng.next() < 0.25 ? 'grass' : 'side' });
        const j = lanes.length - 1;
        if (tier >= 1 && phones < 4 && rng.next() < 0.12) { items.push({ i: j, col: rng.int(2, 13), kind: 'phone' }); phones++; }
      }
    }
    // the last road is a school zone, then the School
    for (let k = lanes.length - 1; k > 0; k--) if (lanes[k].t === 'road') { for (let j = k; j > 0 && lanes[j].t !== 'side' && lanes[j].t !== 'grass'; j--) if (lanes[j].t === 'road') lanes[j].school = true; break; }
    while (lanes.length < E.rows - 1) lanes.push({ t: 'side' });
    lanes.push({ t: 'school' });
    // three paw prints on safe rows in the first stretch, not on footbridge stairs or a phone
    const safeRows = []; for (let k = 1; k < Math.min(lanes.length - 1, 60); k++) if (SC.LANES[lanes[k].t].safe) safeRows.push(k);
    for (let n = 0; n < 3 && safeRows.length; n++) {
      const j = safeRows.splice(Math.floor((n + rng.next()) / 3 * safeRows.length), 1)[0];
      let col = rng.int(0, 15);
      while (bridges.some(b => b.col === col && (b.from === j || b.to === j)) || items.some(it => it.i === j && it.col === col)) col = (col + 3) % 16;
      items.push({ i: j, col, kind: 'paw' });
    }
    return { daily: true, endless: true, seed: seed >>> 0, world: 2, level: 3, lanes, items, bridges };
  }

  SC.generateDaily = generateDaily;
  if (typeof module !== 'undefined') module.exports = generateDaily;
})(typeof window !== 'undefined' ? window : globalThis);
