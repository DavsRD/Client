/* E7 SIMULATION ENGINE — TaskQueue: the jobs a worker does in order (unplug the fridge, carry the
 * photos upstairs). Each task: walk to its node → work for durationMs → (optionally) carry the
 * result to deliverTo → onComplete. Tasks whose `requires` is not met wait while later ones run.
 * The worker is anything with { node, moving, goTo(id) → bool, stop(), setCarry?(name), work?(task) }
 * (an AG.sim.Walker). Pure (no DOM). Tested in kalasag-dev/minigames/tests/sim.test.js. */
(function (root) {
  const AG = root.AG = root.AG || {};
  AG.logic = AG.logic || {};
  const S = AG.logic.sim = AG.logic.sim || {};

  /* phases of the current task: walk → work → deliver (only with deliverTo) */
  class TaskQueue extends S.Emitter {
    /** o: { walker, max: 4, has(name, task) → bool (for string requires), workSpeed: 1 } */
    constructor(o) {
      super();
      this.o = o || {};
      this.walker = this.o.walker; this.max = this.o.max || 4; this.workSpeed = this.o.workSpeed || 1;
      this.items = []; this.cur = null; this.phase = null; this.doneCount = 0;
    }
    get length() { return this.items.length; }
    get full() { return this.items.length >= this.max; }
    get current() { return this.cur; }
    get idle() { return !this.cur; }
    has(id) { return this.items.some(t => t.id === id); }
    indexOf(id) { return this.items.findIndex(t => t.id === id); }
    get(id) { return this.items.find(t => t.id === id) || null; }

    /** task: { id, nodeId, durationMs, requires?, deliverTo?, carry?, onComplete?, … } → false when full or a duplicate id. */
    add(task) {
      if (this.has(task.id)) { this.emit('duplicate', task); return false; }
      if (this.full) { this.emit('full', task); return false; }
      const t = Object.assign({ durationMs: 1000 }, task, { state: 'queued', elapsed: 0, progress: 0, blockedNoted: false });
      this.items.push(t);
      this.emit('add', t);
      return true;
    }
    /** Removes a task (the worker stops if it was the current one). */
    cancel(id) {
      const i = this.indexOf(id);
      if (i < 0) return false;
      const t = this.items[i];
      this.items.splice(i, 1);
      if (t === this.cur) this.dropCurrent();
      t.state = 'cancelled';
      this.emit('cancel', t);
      if (!this.items.length) this.emit('empty', this);
      return true;
    }
    /** Cancels the task added last (UNDO). */
    cancelLast() { const t = this.items[this.items.length - 1]; return t ? this.cancel(t.id) : false; }
    clear() { this.items.slice().reverse().forEach(t => this.cancel(t.id)); }

    ready(t) {
      const r = t.requires;
      if (!r) return true;
      if (typeof r === 'function') return !!r(t, this);
      const has = this.o.has || (() => false);
      return [].concat(r).every(name => has(name, t));
    }
    arrived(nodeId) { const w = this.walker; return !w.moving && w.node === nodeId; }
    dropCurrent() {
      const w = this.walker;
      if (w.stop) w.stop();
      if (w.setCarry) w.setCarry(null);
      if (w.work) w.work(null);
      this.cur = null; this.phase = null;
    }
    startNext() {
      for (let i = 0; i < this.items.length; i++) {
        const t = this.items[i];
        if (!this.ready(t)) {
          if (!t.blockedNoted) { t.blockedNoted = true; t.state = 'blocked'; this.emit('blocked', t); }
          continue;
        }
        if (!this.walker.goTo(t.nodeId)) { // no way there: drop it
          this.items.splice(i--, 1); t.state = 'unreachable'; this.emit('unreachable', t);
          continue;
        }
        this.cur = t; this.phase = 'walk'; t.state = 'walk';
        this.emit('start', t);
        return t;
      }
      return null;
    }

    update(dt) {
      if (!this.cur && !this.startNext()) return this;
      const t = this.cur, w = this.walker;
      if (this.phase === 'walk' && this.arrived(t.nodeId)) {
        this.phase = 'work'; t.state = 'work';
        if (w.work) w.work(t);
        this.emit('arrive', t);
        return this; // work starts counting on the next frame
      }
      if (this.phase === 'work') {
        t.elapsed += dt * 1000 * this.workSpeed;
        t.progress = t.durationMs > 0 ? Math.min(1, t.elapsed / t.durationMs) : 1;
        if (t.progress < 1) return this;
        if (w.work) w.work(null);
        if (t.deliverTo != null && t.deliverTo !== t.nodeId) {
          if (w.setCarry) w.setCarry(t.carry || t.id);
          if (!w.goTo(t.deliverTo)) { this.cancel(t.id); return this; }
          this.phase = 'deliver'; t.state = 'deliver';
          this.emit('pickup', t);
          return this;
        }
        this.finish(t);
        return this;
      }
      if (this.phase === 'deliver' && this.arrived(t.deliverTo)) {
        if (w.setCarry) w.setCarry(null);
        this.emit('deliver', t);
        this.finish(t);
      }
      return this;
    }
    finish(t) {
      this.items.splice(this.items.indexOf(t), 1);
      this.cur = null; this.phase = null; t.state = 'done'; this.doneCount++;
      if (t.onComplete) { try { t.onComplete(t, this); } catch (err) { console.error(err); } }
      this.emit('complete', t);
      if (!this.items.length) this.emit('empty', this);
    }
  }

  S.TaskQueue = TaskQueue;
  if (typeof module !== 'undefined') module.exports = S;
})(typeof window !== 'undefined' ? window : globalThis);
