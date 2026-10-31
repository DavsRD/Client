/* E7 SIMULATION ENGINE — Meter: a value that accumulates (rate per second) and decays (toward rest,
 * per second), with named thresholds that fire 'up' / 'down' once per crossing (hysteresis keeps
 * a value hovering on a line from flickering), plus 'full' / 'empty'. bind() mirrors it into an
 * AG.kit.meter (or anything with set(0..1)). Pure (no DOM). Tested in kalasag-dev/minigames/tests/sim.test.js. */
(function (root) {
  const AG = root.AG = root.AG || {};
  AG.logic = AG.logic || {};
  const S = AG.logic.sim = AG.logic.sim || {};

  class Meter extends S.Emitter {
    /** o: { value: 0, min: 0, max: 1, rate: 0, decay: 0, rest: min, hysteresis: 2 % of the range,
     *       thresholds: [{ at, id, kind?: 'danger'|'safe'|… }] } */
    constructor(o) {
      super();
      o = o || {};
      this.o = o; this.min = o.min || 0; this.max = o.max == null ? 1 : o.max;
      this.rate = o.rate || 0; this.decay = o.decay || 0; this.rest = o.rest == null ? this.min : o.rest;
      this.hysteresis = o.hysteresis == null ? (this.max - this.min) * 0.02 : o.hysteresis;
      this.thresholds = (o.thresholds || []).map(t => Object.assign({}, t, { above: false })).sort((a, b) => a.at - b.at);
      this.bound = []; this.wasFull = false; this.wasEmpty = false;
      this.value = this.min;
      this.set(o.value == null ? this.min : o.value, true);
    }
    get ratio() { return this.max > this.min ? (this.value - this.min) / (this.max - this.min) : 0; }
    /** The highest threshold the value is above (or null). */
    get level() { let l = null; this.thresholds.forEach(t => { if (t.above) l = t; }); return l; }
    above(id) { const t = this.thresholds.find(x => x.id === id); return !!(t && t.above); }
    add(n) { return this.set(this.value + n); }
    set(v, quiet) {
      const old = this.value;
      this.value = Math.max(this.min, Math.min(this.max, v));
      this.check(quiet);
      if (this.value !== old || quiet) this.bound.forEach(b => b.set(this.ratio));
      if (this.value !== old && !quiet) this.emit('change', this.value);
      return this;
    }
    update(dt) {
      if (!(dt > 0)) return this;
      let v = this.value + this.rate * dt;
      if (this.decay) { const d = this.decay * dt; v = v > this.rest ? Math.max(this.rest, v - d) : Math.min(this.rest, v + d); }
      return this.set(v);
    }
    check(quiet) {
      for (const t of this.thresholds) {
        if (!t.above && this.value >= t.at) { t.above = true; if (!quiet) { this.emit('up', t); this.emit('cross', { threshold: t, dir: 'up' }); } }
        else if (t.above && this.value < t.at - this.hysteresis) { t.above = false; if (!quiet) { this.emit('down', t); this.emit('cross', { threshold: t, dir: 'down' }); } }
      }
      const full = this.value >= this.max, empty = this.value <= this.min;
      if (full && !this.wasFull && !quiet) this.emit('full', this);
      if (empty && !this.wasEmpty && !quiet) this.emit('empty', this);
      this.wasFull = full; this.wasEmpty = empty;
    }
    /** Mirrors the ratio into target.set(0..1) (an AG.kit.meter); returns unbind. */
    bind(target) { this.bound.push(target); target.set(this.ratio); return () => { this.bound = this.bound.filter(b => b !== target); }; }
    /** Markers for AG.kit.meter / AG.sim.draw.bar: [{ at: 0..1, kind, label }]. */
    markers() { const span = this.max - this.min || 1; return this.thresholds.map(t => ({ at: (t.at - this.min) / span, kind: t.kind || 'danger', label: t.label })); }
  }

  S.Meter = Meter;
  if (typeof module !== 'undefined') module.exports = S;
})(typeof window !== 'undefined' ? window : globalThis);
