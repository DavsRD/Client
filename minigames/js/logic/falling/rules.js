/* E4 FALLING ENGINE — the rules, pure (no DOM): ComboCounter, PowerUps, LaneHazard, WaveDirector,
 * WaveOrder and moveStep (the BottomMover's kinematics). Tested in kalasag-dev/minigames/tests/falling.test.js.
 * Docs: kalasag-dev/minigames/docs/engines/falling.md
 * All times are ms, speeds px/s, accelerations px/s². */
(function (root) {
  const AG = root.AG = root.AG || {};
  AG.logic = AG.logic || {};
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  /* ---------- ComboCounter: 5 catches → ×2, 10 → ×3, 20 → ×5; a hit resets ---------- */
  const STEPS = [[5, 2], [10, 3], [20, 5]];
  const multFor = (count, steps) => (steps || STEPS).reduce((m, [n, k]) => (count >= n ? k : m), 1);
  class ComboCounter {
    constructor(o) { this.steps = (o && o.steps) || STEPS; this.count = 0; this.best = 0; }
    get mult() { return multFor(this.count, this.steps); }
    /** One more catch; the catch that reaches a step already scores at the new multiplier. */
    add() {
      const before = this.mult;
      this.count++; this.best = Math.max(this.best, this.count);
      return { count: this.count, mult: this.mult, stepped: this.mult > before };
    }
    reset() { const c = this.count; this.count = 0; return c; }
    score(points) { return Math.round((points || 0) * this.mult); }
  }

  /* ---------- PowerUps: shield (absorbs hits), slow-mo (× 0.5 for 5 s), magnet (100 px) ---------- */
  const POWER = { shield: { hits: 1, ms: 0 }, slowmo: { ms: 5000, mul: 0.5 }, magnet: { ms: 6000, radius: 100 } };
  class PowerUps {
    constructor(o) {
      o = o || {};
      this.cfg = {};
      for (const k in POWER) this.cfg[k] = Object.assign({}, POWER[k], o[k]);
      this.left = {}; this.hits = 0;
    }
    /** Starts (or refreshes) a power-up. A shield with ms: 0 lasts until its hits are used. */
    grant(kind) {
      const c = this.cfg[kind]; if (!c) return false;
      if (kind === 'shield') this.hits = c.hits || 1;
      this.left[kind] = c.ms > 0 ? c.ms : Infinity;
      return true;
    }
    active(kind) { return (this.left[kind] || 0) > 0 && (kind !== 'shield' || this.hits > 0); }
    remaining(kind) { return this.active(kind) ? this.left[kind] : 0; }
    /** A hit arrives: true if the shield took it. */
    absorb() {
      if (!this.active('shield')) return false;
      if (--this.hits <= 0) this.left.shield = 0;
      return true;
    }
    /** Counts down; returns the kinds that just ran out. */
    update(dtMs) {
      const ended = [];
      for (const k in this.left) {
        if (this.left[k] <= 0 || this.left[k] === Infinity) continue;
        this.left[k] -= dtMs;
        if (this.left[k] <= 0) { this.left[k] = 0; ended.push(k); }
      }
      return ended;
    }
    clear() { this.left = {}; this.hits = 0; }
    get timeScale() { return this.active('slowmo') ? this.cfg.slowmo.mul : 1; }
    get magnetRadius() { return this.active('magnet') ? this.cfg.magnet.radius : 0; }
    list() { return Object.keys(this.cfg).filter(k => this.active(k)).map(k => ({ kind: k, leftMs: this.left[k], totalMs: this.cfg[k].ms || Infinity, hits: k === 'shield' ? this.hits : undefined })); }
  }

  /* ---------- LaneHazard: idle → warning (warnMs) → active (activeMs) → idle ---------- */
  class LaneHazard {
    constructor(o) {
      o = o || {};
      this.id = o.id || 'lane'; this.x = o.x || 0; this.w = o.w || 80;
      this.warnMs = o.warnMs == null ? 2000 : o.warnMs; this.activeMs = o.activeMs == null ? 5000 : o.activeMs;
      this.shieldable = !!o.shieldable; this.data = o.data || o;
      this.state = 'idle'; this.t = 0; this.flows = 0; this.taken = false;
    }
    trigger() { this.state = this.warnMs > 0 ? 'warning' : 'active'; this.t = 0; this.taken = false; if (this.state === 'active') this.flows++; return this; }
    stop() { this.state = 'idle'; this.t = 0; return this; }
    get active() { return this.state === 'active'; }
    get warning() { return this.state === 'warning'; }
    /** 0..1 through the current state. */
    get progress() { const d = this.state === 'warning' ? this.warnMs : this.state === 'active' ? this.activeMs : 1; return clamp(this.t / (d || 1), 0, 1); }
    /** Advances; returns the states entered on the way ('active', 'idle'). */
    update(dtMs) {
      const ev = [];
      this.t += dtMs;
      if (this.state === 'warning' && this.t >= this.warnMs) { this.t -= this.warnMs; this.state = 'active'; this.flows++; ev.push('active'); }
      if (this.state === 'active' && this.t >= this.activeMs) { this.t = 0; this.state = 'idle'; ev.push('idle'); }
      return ev;
    }
    overlaps(left, right) { return right > this.x && left < this.x + this.w; }
    /** true the first time per flow (one heart per flow). */
    take() { if (!this.active || this.taken) return false; this.taken = true; return true; }
  }

  /* ---------- WaveOrder: "Catch 2 😷 + 1 🥽" ---------- */
  class WaveOrder {
    constructor(spec) {
      spec = spec || {};
      this.need = Object.assign({}, spec.need || spec); delete this.need.label; delete this.need.bonus;
      this.label = spec.label || null; this.bonus = spec.bonus || 0; this.have = {}; this.completed = 0;
    }
    /** A caught id; true if it counted toward the order. */
    add(id) {
      if (!(id in this.need) || (this.have[id] || 0) >= this.need[id]) return false;
      this.have[id] = (this.have[id] || 0) + 1;
      if (this.done) this.completed++;
      return true;
    }
    get done() { return Object.keys(this.need).every(id => (this.have[id] || 0) >= this.need[id]); }
    get progress() { return Object.keys(this.need).map(id => ({ id, have: this.have[id] || 0, need: this.need[id] })); }
    renew(spec) { if (spec) { const w = new WaveOrder(spec); this.need = w.need; this.label = w.label; this.bonus = w.bonus; } this.have = {}; return this; }
  }

  /* ---------- WaveDirector: waves of { label, durationMs, spawnIntervalMs:[a,b], fallSpeed:[a,b], table, order? } ---------- */
  const lerp = (range, t) => (Array.isArray(range) ? range[0] + (range[range.length - 1] - range[0]) * clamp(t, 0, 1) : range);
  class WaveDirector {
    constructor(waves, o) { this.waves = (waves || []).slice(); this.loop = !!(o && o.loop); this.i = 0; this.elapsed = 0; this.total = 0; this.started = false; this.done = !this.waves.length; this.order = null; }
    get wave() { return this.waves[this.i] || null; }
    /** The current wave's values at this moment (each [a, b] range interpolated across the wave). */
    at() {
      const w = this.wave; if (!w) return null;
      const t = this.done ? 1 : w.durationMs > 0 && isFinite(w.durationMs) ? clamp(this.elapsed / w.durationMs, 0, 1) : 0;
      return { index: this.i, wave: w, label: w.label, t, elapsed: this.elapsed, remaining: Math.max(0, (w.durationMs || 0) - this.elapsed),
        spawnIntervalMs: lerp(w.spawnIntervalMs, t), fallSpeed: lerp(w.fallSpeed, t), table: w.table, order: this.order };
    }
    enter(i) { this.i = i; this.elapsed = 0; const w = this.wave; this.order = w && w.order ? new WaveOrder(w.order) : null; return { type: 'wave', index: i, wave: w }; }
    /** Advances; returns events: { type: 'wave', index, wave } and { type: 'done' }. */
    update(dtMs) {
      const ev = [];
      if (!this.started) { this.started = true; if (this.waves.length) ev.push(this.enter(0)); }
      if (this.done) return ev;
      this.elapsed += dtMs; this.total += dtMs;
      let guard = 0;
      while (!this.done && this.wave && this.elapsed >= this.wave.durationMs && guard++ < this.waves.length + 1) {
        const carry = this.elapsed - this.wave.durationMs;
        if (this.i + 1 < this.waves.length || this.loop) { ev.push(this.enter((this.i + 1) % this.waves.length)); this.elapsed = carry; }
        else { this.done = true; this.elapsed = this.wave.durationMs; ev.push({ type: 'done' }); }
      }
      return ev;
    }
    push(wave) { this.waves.push(wave); if (this.done) { this.done = false; return this.enter(this.waves.length - 1); } return null; }
    get progress() { const all = this.waves.reduce((s, w) => s + (w.durationMs || 0), 0); return all ? clamp(this.total / all, 0, 1) : 0; }
  }

  /* ---------- moveStep: the BottomMover's kinematics ----------
   * state { x, v }; o { dir: -1|0|1, target: x | null, maxSpeed, accel, minX, maxX }.
   * Keys: accelerate toward dir × maxSpeed. Follow: head for the target, braking so it arrives without
   * overshoot, and never faster than maxSpeed (the same cap as the keys). Returns the new { x, v }. */
  function moveStep(s, o, dt) {
    const max = o.maxSpeed, acc = o.accel || 1500;
    let x = s.x, v = s.v || 0, want;
    const follow = o.target != null && !o.dir;
    if (follow) {
      const dx = o.target - x;
      want = Math.sign(dx) * Math.min(max, Math.sqrt(2 * acc * Math.abs(dx)));
    } else want = (o.dir || 0) * max;
    v += clamp(want - v, -acc * dt, acc * dt);
    v = clamp(v, -max, max);
    const nx = x + v * dt;
    if (follow && (o.target - x) * (o.target - nx) <= 0) { x = o.target; v = 0; } // reached (or would pass) the finger
    else x = nx;
    if (x < o.minX) { x = o.minX; v = Math.max(0, v); }
    if (x > o.maxX) { x = o.maxX; v = Math.min(0, v); }
    return { x, v };
  }

  const api = { ComboCounter, PowerUps, LaneHazard, WaveOrder, WaveDirector, moveStep, multFor, lerp, STEPS, POWER };
  AG.logic.falling = Object.assign(AG.logic.falling || {}, api);
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
