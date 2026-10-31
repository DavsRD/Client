/* 17 Go With the Flow: the pure rules, no DOM and no engine, so the tests (kalasag-dev/minigames/tests/go-with-the-flow.test.js) run them directly.
 *   rate()      the pressure change per second from what the crowd is doing to the player (the meter's whole recipe)
 *   Pressure    the 0-100 meter: value, peak, +/- events, reset to the checkpoint value
 *   Stopper     "standing still on a dropped item": speed < 5 within 15 px for 0.5 s
 *   within()    is a direction within N degrees of another (marshal arrows)
 *   fallChance, score, stars, badges.   Attached to AG.logic.goWithTheFlow. */
(function (root) {
  const AG = root.AG = root.AG || {};
  AG.logic = AG.logic || {};

  const RULES = {
    max: 100, respawn: 40,
    crowdRadius: 25,                       // "density" = agents within this many px of the player
    densityFree: 4, perAgent: 6,           // +6 per second for every agent above 4
    against: { cos: -0.3, add: 15 },       // moving against the flow
    still: { speed: 5, density: 4, add: 10 },
    wall: { dist: 15, density: 4, add: 10 },
    with: { cos: 0.3, sub: 20 },           // with the flow AND drifting to lower density
    calm: { density: 2, sub: 15 },
    brace: 0.6,                            // BRACE held: every increase x 0.6
    item: { speed: 5, dist: 15, ms: 500, add: 25 },
    marshal: { deg: 30, sub: 10, score: 50 },
    fall: { above: 85, chance: 0.1, ms: 1200 },
    reunite: 100, peakPenalty: 5, buddyBonus: 200, base: 1000
  };

  /** One second of pressure. s: { density, cos (null when standing), speed, nearWall, toLower, brace } → { up, down, net }. */
  function rate(s, R) {
    R = R || RULES;
    let up = Math.max(0, s.density - R.densityFree) * R.perAgent;
    if (s.cos != null && s.cos < R.against.cos) up += R.against.add;
    if (s.speed < R.still.speed && s.density >= R.still.density) up += R.still.add;
    if (s.nearWall && s.density >= R.wall.density) up += R.wall.add;
    if (s.brace) up *= R.brace;
    let down = 0;
    if (s.cos != null && s.cos > R.with.cos && s.toLower) down += R.with.sub;
    if (s.density <= R.calm.density) down += R.calm.sub;
    return { up, down, net: up - down };
  }

  class Pressure {
    constructor(o) {
      o = o || {};
      this.R = o.rules || RULES; this.value = o.value || 0; this.peak = this.value; this.full = false;
      this.lastUp = 0; this.listeners = {};
    }
    on(type, fn) { (this.listeners[type] = this.listeners[type] || []).push(fn); return this; }
    emit(type, a) { (this.listeners[type] || []).forEach(fn => fn(a)); }
    get ratio() { return this.value / this.R.max; }
    /** Advances dt seconds with the sample s. Fires 'full' once when it reaches 100 (then call reset()). */
    update(dt, s) {
      const r = rate(s, this.R);
      this.lastUp = r.up; this.lastNet = r.net;
      return this.add(r.net * dt);
    }
    /** An instant change (an item stop +25, a marshal -10). Clamped to 0..100. */
    add(n) {
      this.value = Math.max(0, Math.min(this.R.max, this.value + n));
      if (this.value > this.peak) this.peak = this.value;
      if (this.value >= this.R.max && !this.full) { this.full = true; this.emit('full'); }
      return this.value;
    }
    /** After a lost heart: back to the checkpoint value. The peak stays (it already counted). */
    reset(v) { this.value = v == null ? this.R.respawn : v; this.full = false; return this; }
  }

  /** Detects "stopping to pick something up": speed < 5 px/s within 15 px for 0.5 s. update() → true once per item per visit. */
  class Stopper {
    constructor(R) { this.R = (R || RULES).item; this.t = 0; this.fired = false; }
    update(dt, speed, dist) {
      if (speed < this.R.speed && dist <= this.R.dist) {
        this.t += dt * 1000;
        if (this.t >= this.R.ms && !this.fired) { this.fired = true; return true; }
      } else { this.t = 0; if (dist > this.R.dist * 2) this.fired = false; }
      return false;
    }
  }

  /** Is (vx, vy) within `deg` degrees of (dx, dy)? Standing still (zero length) never is. */
  function within(vx, vy, dx, dy, deg) {
    const a = Math.hypot(vx, vy), b = Math.hypot(dx, dy);
    if (a < 1e-6 || b < 1e-6) return false;
    return (vx * dx + vy * dy) / (a * b) >= Math.cos((deg == null ? RULES.marshal.deg : deg) * Math.PI / 180) - 1e-9;
  }

  /** The chance of slipping during dt seconds (Advanced only, above 85 pressure). */
  function fallChance(pressure, dt, advanced) {
    return advanced && pressure > RULES.fall.above ? 1 - Math.pow(1 - RULES.fall.chance, dt) : 0;
  }

  /** a: { peak, marshals, buddyLost (bool), reunites, timeSec, par }. */
  function score(a, R) {
    R = R || RULES;
    const bonus = Math.max(0, Math.round(((a.par || 0) - a.timeSec) * 5));
    return Math.max(0, Math.round(R.base - a.peak * R.peakPenalty + a.marshals * R.marshal.score + (a.buddyLost ? 0 : R.buddyBonus) + (a.reunites || 0) * R.reunite + bonus));
  }
  /** a: { won, peak, marshals, buddyLost, heartsLost }. */
  function stars(a) {
    if (!a.won) return 0;
    if (a.peak <= 50 && !a.buddyLost && !a.heartsLost) return 3;
    if (a.peak <= 70 && a.marshals >= 1) return 2;
    return 1;
  }
  /** Updates the badge record q and returns the badge ids won now. o: { level, won, peak, buddyLost, stopped }. */
  function badges(q, o) {
    const ev = [];
    q.calm = q.calm || {}; q.buddy = q.buddy || {}; q.leave = q.leave || {};
    if (o.won) { q.calm[o.level] = o.peak <= 50; q.buddy[o.level] = !o.buddyLost; q.leave[o.level] = !o.stopped; }
    const all = m => [1, 2, 3, 4, 5].every(l => m[l]);
    if (all(q.calm) && !q.gotCalm) { q.gotCalm = true; ev.push('calm-walker'); }
    if (all(q.buddy) && !q.gotBuddy) { q.gotBuddy = true; ev.push('buddy-system'); }
    if (all(q.leave) && !q.gotLeave) { q.gotLeave = true; ev.push('leave-it'); }
    return ev;
  }

  AG.logic.goWithTheFlow = { RULES, rate, Pressure, Stopper, within, fallChance, score, stars, badges };
  if (typeof module !== 'undefined') module.exports = AG.logic.goWithTheFlow;
})(typeof window !== 'undefined' ? window : globalThis);
