/* Evac Convoy: the storm surge's clock. new AG.evacConvoy.Surge({ rows, finalRow, intervals }): the sea is the
 * bottom row and each PULSE floods one more row inland, with a 3 s warning first. update(ms) → events
 * 'warn' | 'pulse' | 'final'; isFlooded(y), nextRow, warning, msToFinal, pulsesLeft. Pure, tested in
 * evac-convoy.test.js; EC.surgeIntervals(entry, level, difficulty) gives the gaps. */
(function (root) {
  const AG = root.AG = root.AG || {};
  const EC = AG.evacConvoy = AG.evacConvoy || {};

  class Surge {
    constructor(o) {
      this.rows = o.rows; this.finalRow = o.finalRow; this.warnMs = o.warnMs == null ? 3000 : o.warnMs;
      this.n = this.rows - 1 - this.finalRow;                       // pulses: the sea row (rows - 1) up to the final row
      this.times = []; let t = 0;
      for (let i = 0; i < this.n; i++) { t += o.intervals[i % o.intervals.length]; this.times.push(t); }
      this.t = 0; this.k = 0; this.floodedFrom = this.rows - 1; this.warned = -1;
    }
    update(ms) {
      const ev = [];
      this.t += ms;
      while (this.k < this.n) {
        const at = this.times[this.k];
        if (this.warned < this.k && this.t >= at - this.warnMs) { this.warned = this.k; ev.push({ type: 'warn', row: this.floodedFrom - 1 }); }
        if (this.t < at) break;
        this.floodedFrom--; this.k++;
        ev.push({ type: 'pulse', row: this.floodedFrom });
        if (this.k === this.n) ev.push({ type: 'final', row: this.floodedFrom });
      }
      return ev;
    }
    isFlooded(y) { return y >= this.floodedFrom; }
    get done() { return this.k >= this.n; }
    get nextRow() { return this.done ? null : this.floodedFrom - 1; }
    get pulsesLeft() { return this.n - this.k; }
    get finalAt() { return this.times.length ? this.times[this.n - 1] : 0; }
    get msToFinal() { return Math.max(0, this.finalAt - this.t); }
    get msToNext() { return this.done ? 0 : Math.max(0, this.times[this.k] - this.t); }
    /** 0 → 1 over the warning window before the next pulse (0 when not warning). */
    get warning() { return !this.done && this.warned === this.k ? Math.min(1, Math.max(0, 1 - this.msToNext / this.warnMs)) : 0; }
    get warningOn() { return !this.done && this.warned === this.k; }
    /** 0 → 1 across the whole gap before the next pulse. */
    get progress() {
      if (this.done) return 1;
      const from = this.k ? this.times[this.k - 1] : 0, to = this.times[this.k];
      return Math.min(1, Math.max(0, (this.t - from) / (to - from)));
    }
  }

  /** The gaps between pulses in ms: the level's base time (shorter on later levels and in
   *  Advanced) × the level's own multipliers (uneven in level 4). */
  EC.surgeIntervals = function (entry, level, difficulty) {
    const T = EC.tuning, base = T.pulseS[difficulty === 'advanced' ? 'advanced' : 'easy'][Math.min(5, Math.max(1, level || 1)) - 1] * 1000;
    const mult = entry.pulse && entry.pulse.length ? entry.pulse : [1];
    const n = EC.rules.pulseCount(entry), out = [];
    for (let i = 0; i < n; i++) out.push(Math.max(T.minPulseMs, Math.round(base * mult[i % mult.length])));
    return out;
  };

  EC.Surge = Surge;
  if (typeof module !== 'undefined') module.exports = { Surge, surgeIntervals: EC.surgeIntervals };
})(typeof window !== 'undefined' ? window : globalThis);
