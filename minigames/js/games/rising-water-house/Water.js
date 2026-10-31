/* 06 Rising Water House: the flood and the pure rules. Water wraps an E7 Meter (depth in px above the ground floor) with the three
 * lines: OUTLET (ankle), KNEE, WAIST; the rest is plain functions (chain bonus, evacuation bonus, wading penalty, stars, badges,
 * the suggested next task, the graph builder). No DOM, so it is tested in kalasag-dev/minigames/tests/rising-water-house.test.js. */
(function (root) {
  const AG = root.AG = root.AG || {};
  AG.logic = AG.logic || {};
  const RW = AG.risingWater = AG.risingWater || {};
  const S = () => AG.logic.sim, T = () => RW.tuning;

  /** The three line depths from a layout (floor y minus the line's y). */
  function lines(layout) {
    return { outlet: layout.groundFloorY - layout.outletY, knee: layout.groundFloorY - layout.kneeY, waist: layout.groundFloorY - layout.waistY };
  }

  class Water extends S().Emitter {
    /** o: { layout, rate (px/s), peak (px) }. Events: outlet, knee, waist (once each, when the depth first reaches the line), peak. */
    constructor(o) {
      super();
      this.layout = o.layout; this.lines = lines(o.layout); this.peak = o.peak || T().peakDepth; this.mul = 1;
      this.baseRate = o.rate;
      this.meter = new (S().Meter)({ max: this.peak, rate: o.rate, thresholds: [
        { at: this.lines.outlet, id: 'outlet', kind: 'danger' }, { at: this.lines.knee, id: 'knee', kind: 'danger' }, { at: this.lines.waist, id: 'waist', kind: 'danger' }] });
      this.meter.on('up', t => this.emit(t.id, this));
      this.meter.on('full', () => this.emit('peak', this));
    }
    get depth() { return this.meter.value; }
    get ratio() { return this.meter.ratio; }
    get surfaceY() { return this.layout.groundFloorY - this.meter.value; }
    /** The clock speed-up (1 = normal). */
    setMul(m) { this.mul = m; this.meter.rate = this.baseRate * m; }
    update(dt) { this.meter.update(dt); return this; }
    above(id) { return this.meter.above(id); }
    /** Seconds until a line is reached at the current rate (Infinity if never). */
    eta(id) { const d = this.lines[id] - this.meter.value; return d <= 0 ? 0 : this.meter.rate > 0 ? d / this.meter.rate : Infinity; }
  }

  /* ---------- pure rules ---------- */
  /** A chain continues when the task is in the same room as the last one, or the next / previous. */
  const chains = (prevRoom, room) => prevRoom != null && room != null && Math.abs(prevRoom - room) <= 1;
  /** Points for a chain of n links (1 = the second task in a row). */
  const chainBonus = n => (n > 0 ? T().score.chain * Math.min(n, T().score.chainCap) : 0);
  /** 300 − 30 per second of delay, never below 0. */
  const evacBonus = delaySec => Math.max(0, Math.round(T().score.evacBase - T().score.evacPerSec * Math.max(0, delaySec)));
  /** Walking through water at or past the ankle with the power on costs a heart at most every 3 s. */
  const wadePenalty = (depth, lineOutlet, powerOn, moving, nowMs, lastMs) => !!(powerOn && moving && depth >= lineOutlet && (lastMs == null || nowMs - lastMs >= T().wade.ms));
  /** ⭐ family safe · ⭐⭐ + power off by the player before the outlet line AND documents, water, go bag saved · ⭐⭐⭐ + idle ≤ target AND no hearts lost. */
  function stars(o) {
    if (!o.won || !o.familySafe) return 0;
    let n = 1;
    if (o.powerEarly && o.essentialsSaved) n = 2; else return n;
    if (o.idleMs <= o.idleTarget && o.heartsLost === 0) n = 3;
    return n;
  }
  /** Updates the badge record q and returns the badge ids won now. o: { level, won, powerFirst, familySafe, decoyPresent, decoyStarted }. */
  function badges(q, o) {
    const ev = [];
    q.powerFirst = q.powerFirst || {}; q.clean = q.clean || 0;
    if (o.won) {
      q.powerFirst[o.level] = !!o.powerFirst;
      if ([1, 2, 3, 4, 5].every(l => q.powerFirst[l])) ev.push('power-first');
      if (o.level === 3 && o.familySafe) ev.push('family-hero');
      if (o.decoyPresent) { q.clean = o.decoyStarted ? 0 : q.clean + 1; if (q.clean >= T().badges.clean) ev.push('no-wading'); }
    } else if (o.decoyStarted) q.clean = 0;
    return ev;
  }
  /** The task to glow on Easy: the lowest prio among offered ones not queued (the decoy and photos never). */
  function suggest(offers, queued) {
    let best = null;
    offers.forEach(t => { if (!t.decoy && !t.optional && !queued.has(t.id) && (!best || t.prio < best.prio)) best = t; });
    return best;
  }
  /** Bubble keys in reading order: the upper floor first, then the ground floor, each left to right. */
  function readingOrder(items) {
    return items.map((it, i) => ({ it, i })).sort((a, b) => (Math.round(a.it.y / 40) - Math.round(b.it.y / 40)) || (a.it.x - b.it.x)).map(o => o.i);
  }
  /** The house WaypointGraph from a layout: ground chain, stairs (mul = walk / stairs speed), upstairs chain. */
  function buildGraph(layout) {
    const t = T(), g = new (S().WaypointGraph)({}), up = layout.upperFloorY, gr = layout.groundFloorY;
    const add = id => { const n = t.nodes[id]; g.addNode({ id, x: n[0], y: n[1] === 'g' ? gr : up }); };
    t.ground.concat(t.upper).forEach(add);
    const xs = a => a.slice().sort((p, q) => t.nodes[p][0] - t.nodes[q][0]);
    const chain = ids => { for (let i = 1; i < ids.length; i++) g.addEdge(ids[i - 1], ids[i]); };
    chain(xs(t.ground)); chain(xs(t.upper));
    g.addEdge('stair_bottom', 'stair_top', { mul: t.speed.walk / t.speed.stairs });
    return g;
  }
  /** A node is on the ground floor? */
  const isGround = id => !!(T().nodes[id] && T().nodes[id][1] === 'g');

  RW.Water = Water;
  RW.rules = { lines, chains, chainBonus, evacBonus, wadePenalty, stars, badges, suggest, readingOrder, buildGraph, isGround };
  if (typeof module !== 'undefined') module.exports = RW.rules;
})(typeof window !== 'undefined' ? window : globalThis);
