/* Evac Convoy: the HEADCOUNT at the end of a level. new AG.evacConvoy.Headcount({ n, rnd, from, to, onDone }):
 * n walkers enter the center 0.4–1.0 s apart (canvas px from → to); hc.update(ms), hc.press() once per person
 * counted (Space / tap), hc.draw(ctx, t). An exact count is the bonus; otherwise a gentle recount runs.
 * AG.evacConvoy.headcountPlan(n, rnd) (the timing) is pure and tested in evac-convoy.test.js. */
(function (root) {
  const AG = root.AG = root.AG || {};
  const EC = AG.evacConvoy = AG.evacConvoy || {};

  /** When each of n walkers sets off, in ms: a short pause, then a seeded 0.4–1.0 s gap each. */
  EC.headcountPlan = function (n, rnd) {
    const H = EC.tuning.headcount, times = [];
    let t = 600;
    for (let i = 0; i < n; i++) { times.push(Math.round(t)); t += H.gapMin + rnd() * (H.gapMax - H.gapMin); }
    return times;
  };

  class Headcount {
    constructor(o) {
      this.n = o.n; this.from = o.from; this.to = o.to;
      this.onEnter = o.onEnter || null; this.onRecount = o.onRecount || null; this.onDone = o.onDone || null;
      this.times = EC.headcountPlan(o.n, o.rnd);
      this.len = Math.hypot(o.to.x - o.from.x, o.to.y - o.from.y);
      this.walkers = []; this.spawned = 0; this.entered = 0; this.counted = 0;
      this.t = 0; this.wait = 0; this.shown = 0; this.state = 'walk';
    }
    get exact() { return this.counted === this.n; }
    /** One person counted. Counts during the walk and the short pause after it. */
    press() {
      if (this.state !== 'walk' && this.state !== 'settle') return false;
      this.counted++;
      return true;
    }
    update(ms) {
      const H = EC.tuning.headcount;
      if (this.state === 'walk') {
        this.t += ms;
        while (this.spawned < this.n && this.t >= this.times[this.spawned]) this.walkers.push({ i: this.spawned++, d: 0 });
        for (const w of this.walkers) w.d += H.walkPxPerS * ms / 1000;
        const keep = [];
        for (const w of this.walkers) { if (w.d >= this.len) { this.entered++; if (this.onEnter) this.onEnter(this.entered); } else keep.push(w); }
        this.walkers = keep;
        if (this.spawned >= this.n && !this.walkers.length) { this.state = 'settle'; this.wait = 0; }
      } else if (this.state === 'settle') {
        this.wait += ms;
        if (this.wait >= H.settleMs) { if (this.exact) this.finish(); else { this.state = 'recount'; this.wait = 0; this.shown = 0; } }
      } else if (this.state === 'recount') {
        this.wait += ms;
        if (this.shown < this.n && this.wait >= H.recountMs) { this.wait = 0; this.shown++; if (this.onRecount) this.onRecount(this.shown); }
        else if (this.shown >= this.n && this.wait >= H.recountMs * 2.5) this.finish();
      }
    }
    finish() { this.state = 'done'; if (this.onDone) this.onDone(this); }

    draw(ctx, t) {
      const dx = this.to.x - this.from.x, dy = this.to.y - this.from.y;
      for (const w of this.walkers) {
        const k = this.len ? w.d / this.len : 1, lane = ((w.i % 3) - 1) * 3;
        const x = Math.round(this.from.x + dx * k + (Math.abs(dx) > Math.abs(dy) ? 0 : lane)), y = Math.round(this.from.y + dy * k + (Math.abs(dx) > Math.abs(dy) ? lane : 0));
        ctx.save();
        ctx.translate(x, y);
        if (dx < 0) ctx.scale(-1, 1);
        AG.assets.draw(ctx, 'evac-convoy.headcount.walker', -6, -16, 12, 16, Math.floor(t * 6) % 2);
        ctx.restore();
      }
    }
  }

  EC.Headcount = Headcount;
  if (typeof module !== 'undefined') module.exports = { Headcount, headcountPlan: EC.headcountPlan };
})(typeof window !== 'undefined' ? window : globalThis);
