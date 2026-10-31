/* 17 Go With the Flow: the buddy, pure (no DOM). Holds hands (stays `hold` px from the player) while within 60 px; farther than that it waits;
 * more than 100 px away for 2 s and it is LOST: it walks to the meeting point and waits there until the player comes back within 60 px (reunited).
 * A packed crowd slows the buddy more than the player, so rushing through a crowd leaves the buddy behind. Events: lost, reunite. */
(function (root) {
  const AG = root.AG = root.AG || {};
  const G = AG.goWithTheFlow = AG.goWithTheFlow || {};

  class Buddy extends AG.logic.sim.Emitter {
    /** o: { x, y, solid(x, y), density(x, y) → n, meet: { x, y }, tuning } */
    constructor(o) {
      super();
      this.o = o; this.T = o.tuning || G.tuning.buddy;
      this.x = o.x; this.y = o.y; this.vx = 0; this.vy = 0; this.facing = 'down';
      this.state = 'with';                       // 'with' | 'lost' (walking to the meeting point) | 'meet' (waiting there)
      this.apart = 0; this.everLost = false; this.lostCount = 0; this.reunites = 0; this.moving = false;
    }
    get isLost() { return this.state !== 'with'; }
    teleport(x, y) { this.x = x; this.y = y; this.apart = 0; this.state = 'with'; }
    update(dt, px, py) {
      const T = this.T, o = this.o, d = Math.hypot(px - this.x, py - this.y);
      let tx = null, ty = null, speed = T.speed;
      if (this.state === 'with') {
        if (d > T.lost) {
          this.apart += dt * 1000;
          if (this.apart >= T.lostMs) { this.state = 'lost'; this.everLost = true; this.lostCount++; this.apart = 0; this.emit('lost'); }
        } else this.apart = 0;
        if (d <= T.follow && d > T.hold + 0.5) { // arrive at the point `hold` px from the player on the buddy's own side
          const k = T.hold / d; tx = px + (this.x - px) * k; ty = py + (this.y - py) * k;
        }
      }
      if (this.state === 'lost' || this.state === 'meet') {
        if (d <= T.follow) { this.state = 'with'; this.apart = 0; this.reunites++; this.emit('reunite'); }
        else if (Math.hypot(o.meet.x - this.x, o.meet.y - this.y) > 4) { this.state = 'lost'; tx = o.meet.x; ty = o.meet.y; speed = T.meetSpeed; }
        else this.state = 'meet';
      }
      this.moving = false; this.vx = 0; this.vy = 0;
      if (tx != null) {
        const dx = tx - this.x, dy = ty - this.y, dist = Math.hypot(dx, dy);
        if (dist > 0.4) {
          const n = o.density ? o.density(this.x, this.y) : 0, D = T.drag;
          speed *= Math.max(D.min, 1 - D.per * Math.max(0, n - D.free));
          const v = Math.min(speed, dist * 6); // arrive: slow down near the point
          this.vx = dx / dist * v; this.vy = dy / dist * v;
          this.step(dt);
        }
      }
      if (this.moving) this.facing = Math.abs(this.vx) > Math.abs(this.vy) ? (this.vx > 0 ? 'right' : 'left') : (this.vy > 0 ? 'down' : 'up');
    }
    step(dt) {
      const r = this.T.r, s = this.o.solid, nx = this.x + this.vx * dt, ny = this.y + this.vy * dt;
      const hit = (x, y) => !!s && (s(x - r, y - r) || s(x + r, y - r) || s(x - r, y + r) || s(x + r, y + r));
      if (!hit(nx, this.y)) this.x = nx; else this.vx = 0;
      if (!hit(this.x, ny)) this.y = ny; else this.vy = 0;
      this.moving = this.vx !== 0 || this.vy !== 0;
    }
  }

  G.Buddy = Buddy;
  if (typeof module !== 'undefined') module.exports = Buddy;
})(typeof window !== 'undefined' ? window : globalThis);
