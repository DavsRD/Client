/* E7 SIMULATION ENGINE — Timeline: scripted events by time (the water rises at 20 s, the second
 * rain band at 45 s…), with pause / resume / speed / seek and an optional loop. Pure (no DOM);
 * update(dt) takes seconds like AG.gfx.loop, every time is in ms of TIMELINE time (× speed).
 * Tested in kalasag-dev/minigames/tests/sim.test.js. Docs: kalasag-dev/minigames/docs/engines/sim.md */
(function (root) {
  const AG = root.AG = root.AG || {};
  AG.logic = AG.logic || {};
  const S = AG.logic.sim = AG.logic.sim || {};

  class Timeline extends S.Emitter {
    /** o: { events: [{ at, id?, fn?, data? }], duration?, loop?, speed: 1, paused? } */
    constructor(o) {
      super();
      o = o || {};
      this.o = o; this.t = 0; this.speed = o.speed == null ? 1 : o.speed; this.paused = !!o.paused;
      this.duration = o.duration == null ? null : o.duration; this.loop = !!o.loop;
      this.events = []; this.seq = 0; this.ended = false; this.loops = 0;
      (o.events || []).forEach(e => this.add(e));
    }
    /** Adds an event (kept in time order, ties in the order added). One at or before now fires on the next update. */
    add(ev) {
      const e = Object.assign({}, ev, { at: +ev.at || 0, fired: false, _seq: this.seq++ });
      let i = this.events.length;
      while (i > 0 && this.events[i - 1].at > e.at) i--;
      this.events.splice(i, 0, e);
      this.ended = false;
      return e;
    }
    at(ms, fn, data) { return this.add({ at: ms, fn, data }); }
    after(ms, fn, data) { return this.add({ at: this.t + ms, fn, data }); }
    remove(ref) { const n = this.events.length; this.events = this.events.filter(e => e !== ref && e.id !== ref); return this.events.length < n; }
    get(id) { return this.events.find(e => e.id === id) || null; }

    pause() { this.paused = true; return this; }
    resume() { this.paused = false; return this; }
    setSpeed(x) { this.speed = Math.max(0, x); return this; }
    /** Jumps to ms. Events before it count as done without firing (fire: true fires them now, in order). */
    seek(ms, opts) {
      this.t = Math.max(0, ms); this.ended = false;
      this.events.forEach(e => { e.fired = e.at < this.t && !(opts && opts.fire); });
      if (opts && opts.fire) this.fireDue();
      return this;
    }
    reset() { this.loops = 0; return this.seek(0); }
    get progress() { return this.duration ? Math.min(1, this.t / this.duration) : null; }
    get remaining() { return this.duration == null ? null : Math.max(0, this.duration - this.t); }
    /** The next unfired event, or null. */
    get upcoming() { return this.events.find(e => !e.fired) || null; }

    update(dt) {
      if (this.paused || this.ended && !this.loop) return this;
      this.t += dt * 1000 * this.speed;
      for (let guard = 0; guard < 1000; guard++) {
        this.fireDue();
        if (this.duration == null || this.t < this.duration) break;
        if (!this.loop) { this.t = this.duration; break; }
        this.t -= this.duration; this.loops++;
        this.events.forEach(e => { e.fired = false; });
        this.emit('loop', this.loops);
        if (this.duration <= 0) break;
      }
      const done = this.duration == null ? this.events.every(e => e.fired) : this.t >= this.duration;
      if (done && !this.ended && !this.loop) { this.ended = true; this.emit('end', this); }
      return this;
    }
    fireDue() {
      for (;;) {
        const e = this.events.find(x => !x.fired && x.at <= this.t);
        if (!e) return;
        e.fired = true;
        if (e.fn) { try { e.fn(e, this); } catch (err) { console.error(err); } }
        this.emit('event', e);
      }
    }
  }

  S.Timeline = Timeline;
  if (typeof module !== 'undefined') module.exports = S;
})(typeof window !== 'undefined' ? window : globalThis);
