/* E3 SIDE-SCROLL ENGINE — Chaser: something that follows the runner from behind (a wave, a lahar).
 * Its front edge moves at speedFactor × the runner's NOMINAL runSpeed, so it gains whenever the player
 * is slowed (walls, sand, climbing, respawn); past rubberBand.gap px it speeds up to rubberBand.factor.
 * Emits 'caught' once when it reaches the runner, then (by default) sends the runner back to the last
 * checkpoint, which resets the gap. Never graphic: draw a wave, a splash. Docs: kalasag-dev/minigames/docs/engines/sidescroll.md */
window.AG = window.AG || {};
(function (AG) {
  const INK = '#1e1538';

  class Chaser extends AG.sidescroll.Emitter {
    /** { runner, gap: 200, speedFactor: 0.95, rubberBand: { gap: 350, factor: 1.05 } | null, respawn: 'checkpoint' | false,
     *    art, frames, fps, w: 160, h: 210, y (world top; default: the view's bottom edge), delayMs: 0, onCaught } */
    constructor(o) {
      super();
      o = o || {};
      this.o = o; this.runner = o.runner;
      this.startGap = o.gap == null ? 200 : o.gap; this.speedFactor = o.speedFactor == null ? 0.95 : o.speedFactor;
      this.rubberBand = o.rubberBand === undefined ? { gap: 350, factor: 1.05 } : o.rubberBand;
      this.respawnTo = o.respawn === undefined ? 'checkpoint' : o.respawn;
      this.w = o.w || 160; this.h = o.h || 210; this.enabled = o.enabled !== false;
      this.delay = o.delayMs || 0; this.t = 0; this.latched = false;
      this.reset();
      this.offs = [this.runner.on('respawn', () => this.reset())];
      if (o.stopAtEnd !== false) this.offs.push(this.runner.on('end', () => this.stop()));
    }
    /** The front edge's x, the gap px to the runner's back edge, and the current speed. */
    get gap() { return this.runner.hitbox().x - this.x; }
    get speed() { const rb = this.rubberBand, f = rb && this.gap > rb.gap ? rb.factor : this.speedFactor; return f * this.runner.runSpeed; }
    /** Puts the front edge `gap` px behind the runner (default: the starting gap). */
    reset(gap) { this.x = this.runner.hitbox().x - (gap == null ? this.startGap : gap); this.latched = false; return this; }
    start() { this.enabled = true; return this; }
    stop() { this.enabled = false; return this; }
    update(dt) {
      this.t += dt * 1000;
      if (!this.enabled || this.t < this.delay || this.runner.frozen) return this; // waits at the intro and during a respawn
      this.x += this.speed * dt;
      if (this.gap <= 0 && !this.latched) {
        this.latched = true;
        this.emit('caught', { gap: this.gap });
        if (this.respawnTo) this.runner.respawn(this.respawnTo);
      }
      return this;
    }
    /** The art's front edge sits at x, its bottom on the view's bottom edge (or at y + h). */
    draw(ctx, cam, t) {
      const sx = Math.round(this.x - cam.x), top = this.o.y == null ? cam.h - this.h : Math.round(this.o.y - cam.y);
      if (sx < -4) return;
      if (this.o.art) {
        const f = this.o.frames ? Math.floor(t * (this.o.fps || 6)) % this.o.frames : 0;
        for (let x = sx - this.w; x > -this.w; x -= this.w) AG.assets.draw(ctx, this.o.art, x, top, this.w, this.h, f);
        return;
      }
      // a plain pixel wave: water up to the front, a foam crest that rolls (still under Reduce Motion)
      const roll = AG.reducedMotion() ? 0 : Math.floor(t * 8) % 8;
      ctx.fillStyle = '#2a6ad8'; ctx.fillRect(0, top + 24, Math.max(0, sx), this.h - 24);
      ctx.fillStyle = '#4a8aec';
      for (let y = top + 30; y < top + this.h; y += 8) for (let x = ((y >> 3) & 1) * 8 + roll; x < sx - 4; x += 16) ctx.fillRect(x, y, 6, 2);
      for (let x = 0; x < sx; x += 4) { const yy = top + 16 + Math.round(Math.sin((x + roll * 4) / 14) * 4); ctx.fillStyle = '#ffffff'; ctx.fillRect(x, yy, 4, 8); ctx.fillStyle = INK; ctx.fillRect(x, yy - 1, 4, 1); }
      ctx.fillStyle = '#ffffff'; ctx.fillRect(sx - 6, top + 4, 6, this.h - 4);
      ctx.fillStyle = INK; ctx.fillRect(sx, top + 4, 1, this.h - 4);
    }
    destroy() { this.offs.forEach(f => f()); this.offs = []; }
  }

  AG.sidescroll = Object.assign(AG.sidescroll || {}, { Chaser });
})(window.AG);
