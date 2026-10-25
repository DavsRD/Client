/* Evac Convoy: every feel number (AG.evacConvoy.tuning) and the pure rules (AG.evacConvoy.rules): reading a
 * level map, the BFS start check (every house reaches the center), scoring, stars and badges.
 * No DOM, so it also runs in kalasag-dev/minigames/tests/ (evac-convoy.test.js). */
(function (root) {
  const AG = root.AG = root.AG || {};
  const EC = AG.evacConvoy = AG.evacConvoy || {};

  const tuning = {
    tile: 20, cols: 24, rows: 13, hudBand: 10,    // the 24 × 13 map sits under a 10 px band on the 480 × 270 canvas
    tilesPerSec: { easy: [6, 6.375, 6.75, 7.125, 7.5], advanced: [8, 8.375, 8.75, 9.125, 9.5] },  // the convoy's tick, by level 1–5
    buffer: 2, crashLockMs: 300,
    hearts: 3,
    capacity: { easy: 10, advanced: 8 },
    pulseS: { easy: [20, 18.75, 17.5, 16.25, 15], advanced: [14, 13, 12, 11, 10] },             // seconds between surge pulses, by level
    warnMs: 3000,                                  // the warning meter before each pulse (and each closure)
    minPulseMs: 6000,
    light: 5,                                      // L5: tiles of light around the head
    points: { resident: 100, priority: 200, order: 300, timeLeft: 10, headcount: 100 },
    stars: { two: 0.8 },
    headcount: { gapMin: 400, gapMax: 1000, settleMs: 1200, walkPxPerS: 44, recountMs: 380 },
    badges: { orderBonuses: 10, longConvoy: 8, surgeBeaterPulses: 2, surgeBeaterLevel: 4 },
    daily: { closures: [[18, 38], [44, 68]], priorityShare: 0.3, minPriority: 2, residents: [1, 3], pets: 3, templates: 10 },
    kinds: ['senior', 'pregnant', 'pwd', 'child'],  // the 👵 🤰 🧑‍🦽 👶 priority residents
    emoji: { normal: '🙋', senior: '👵', pregnant: '🤰', pwd: '🧑‍🦽', child: '👶', pet: '🐾' }
  };

  const ROAD = '.HCB';
  const key = (x, y) => x + ',' + y;
  const lvl = n => Math.min(5, Math.max(1, n || 1)) - 1;
  const DIRS = [[0, -1, 'up'], [1, 0, 'right'], [0, 1, 'down'], [-1, 0, 'left']];

  const rules = {
    key,
    tickMs: (level, difficulty) => 1000 / tuning.tilesPerSec[difficulty === 'advanced' ? 'advanced' : 'easy'][lvl(level)],
    capacity: difficulty => tuning.capacity[difficulty === 'advanced' ? 'advanced' : 'easy'],
    isRoad: ch => ROAD.indexOf(ch) >= 0,

    /** A level map (13 rows × 24 characters) → its houses, center, bridges and the spawn. */
    parse(rows) {
      const m = { rows, w: tuning.cols, h: tuning.rows, houses: [], center: [], bridges: [] };
      rows.forEach((r, y) => [...r].forEach((ch, x) => {
        if (ch === 'H') m.houses.push({ x, y });
        else if (ch === 'C') m.center.push({ x, y });
        else if (ch === 'B') m.bridges.push({ x, y });
      }));
      m.at = (x, y) => (x >= 0 && y >= 0 && x < m.w && y < m.h ? rows[y][x] : '#');
      return m;
    },
    /** Where a respawned convoy appears: the first center tile that opens onto a road, facing it. */
    spawn(m) {
      for (const c of m.center) for (const [dx, dy, dir] of DIRS) {
        const ch = m.at(c.x + dx, c.y + dy);
        if (ch !== 'C' && rules.isRoad(ch)) return { x: c.x, y: c.y, dir };
      }
      return m.center.length ? { x: m.center[0].x, y: m.center[0].y, dir: 'up' } : null;
    },
    /** BFS from the center over roads: the Set of 'x,y' reachable, with some tiles closed. */
    reach(m, closed) {
      const seen = new Set(), queue = [];
      for (const c of m.center) { seen.add(key(c.x, c.y)); queue.push(c); }
      for (let i = 0; i < queue.length; i++) {
        const { x, y } = queue[i];
        for (const [dx, dy] of DIRS) {
          const nx = x + dx, ny = y + dy, k = key(nx, ny);
          if (seen.has(k) || !rules.isRoad(m.at(nx, ny)) || (closed && closed.has(k))) continue;
          seen.add(k); queue.push({ x: nx, y: ny });
        }
      }
      return seen;
    },
    /** Road tiles with fewer than two road neighbours: a convoy can't turn round in one. */
    deadEnds(m) {
      const out = [];
      for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) {
        if (rules.isRoad(m.at(x, y)) && DIRS.filter(([dx, dy]) => rules.isRoad(m.at(x + dx, y + dy))).length < 2) out.push({ x, y });
      }
      return out;
    },
    closedSet(entry) { return new Set((entry.closures || []).map(c => key(c.x, c.y))); },
    /** The start check for a level entry: shape, the sea row, a 2 × 2 center above the final row,
     *  every house reachable at the start (and with every scripted closure applied). */
    check(entry) {
      const rows = entry.map || [], problems = [];
      if (rows.length !== tuning.rows || rows.some(r => r.length !== tuning.cols)) return { ok: false, problems: ['size'], m: null };
      const m = rules.parse(rows);
      if (rows[tuning.rows - 1] !== '~'.repeat(tuning.cols)) problems.push('sea row');
      if (m.center.length !== 4) problems.push('center');
      else if (Math.max(...m.center.map(c => c.y)) >= entry.finalRow) problems.push('center below the final row');
      const seen = rules.reach(m), seenClosed = rules.reach(m, rules.closedSet(entry));
      const unreachable = m.houses.filter(h => !seen.has(key(h.x, h.y)));
      const cut = m.houses.filter(h => !seenClosed.has(key(h.x, h.y)));
      if (unreachable.length) problems.push('unreachable houses');
      if (cut.length) problems.push('closures cut houses');
      if (entry.residents && entry.residents.length !== m.houses.length) problems.push('residents vs houses');
      if (!m.houses.length) problems.push('no houses');
      return { ok: !problems.length, problems, unreachable, cut, deadEnds: rules.deadEnds(m), m };
    },
    /** The pulse count: the sea row floods up to the final row, one row each. */
    pulseCount: entry => tuning.rows - 1 - entry.finalRow,
    /** What a level uses (the intro and tutorial read this). */
    features(entry) {
      const rs = entry.residents || [];
      return {
        priority: !!entry.daily || rs.some(r => r.p > 0),
        closures: !!entry.daily || (entry.closures || []).length > 0,
        night: !!entry.night,
        uneven: (entry.pulse || []).some(v => v !== 1)
      };
    },
    /** A priority resident's look: the same one every run, from where the house is. */
    kind: (x, y, i) => tuning.kinds[(x * 7 + y * 3 + i) % tuning.kinds.length],
    /** The residents of every house: priority first, so they board first. */
    residents(entry, m) {
      const list = [];
      m.houses.forEach((h, hi) => {
        const r = (entry.residents && entry.residents[hi]) || { n: 1, p: 0 }, folks = [];
        for (let i = 0; i < r.n; i++) {
          const priority = i < r.p;
          folks.push({ id: hi + ':' + i, house: key(h.x, h.y), priority, kind: priority ? rules.kind(h.x, h.y, i) : 'normal' });
        }
        list.push({ x: h.x, y: h.y, folks });
      });
      return list;
    },

    /** Did every priority resident get delivered before any other? seq = true (priority) / false in delivery order. */
    order(seq, priorityTotal) {
      if (!priorityTotal) return false;
      const lastP = seq.lastIndexOf(true), firstN = seq.indexOf(false);
      return seq.filter(Boolean).length === priorityTotal && (firstN < 0 || lastP < firstN);
    },
    /** 100 per resident (priority 200) + order bonus + whole seconds left before the final surge × 10 + headcount. */
    points(o) {
      const P = tuning.points;
      return (o.delivered || 0) * P.resident + (o.priorityDelivered || 0) * (P.priority - P.resident)
        + (o.order ? P.order : 0) + Math.floor(Math.max(0, o.timeLeftS || 0)) * P.timeLeft + (o.headcountExact ? P.headcount : 0);
    },
    /** 1 = delivered ≥ the target; 2 = ≥ 80 % AND every priority resident; 3 = 100 % AND no hearts lost. */
    stars(o) {
      if ((o.delivered || 0) < (o.target || 0)) return 0;
      const all = o.delivered >= o.total && o.total > 0;
      if (all && !o.heartsLost) return 3;
      return o.delivered >= Math.ceil(o.total * tuning.stars.two) && o.priorityDelivered >= (o.priorityTotal || 0) ? 2 : 1;
    },
    /** Running counts + this run → the badges earned now. */
    badges(stats, run) {
      const ev = [], B = tuning.badges;
      if ((stats.orderBonuses || 0) >= B.orderBonuses) ev.push('priority-first');
      if ((run.maxLoad || 0) >= B.longConvoy) ev.push('long-convoy');
      if (run.level === B.surgeBeaterLevel && run.won && run.endedBy === 'done' && run.pulsesLeft >= B.surgeBeaterPulses) ev.push('surge-beater');
      return ev;
    },
    /** Which of the three 🐾 are found, as the flags done() wants. */
    collectibles: run => [0, 1, 2].map(i => !!(run.pets && run.pets[i]))
  };

  EC.tuning = tuning;
  EC.rules = rules;
  if (typeof module !== 'undefined') module.exports = { tuning, rules };
})(typeof window !== 'undefined' ? window : globalThis);
