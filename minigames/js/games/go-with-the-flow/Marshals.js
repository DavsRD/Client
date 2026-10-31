/* 17 Go With the Flow: the marshals at the junctions, pure (no DOM) except draw(). Each one points an arrow at the LESS crowded of its targets
 * (re-checked every 0.4 s). Moving within 30° of the arrow while near the marshal for 0.35 s = followed (once each): the model takes 10 off the
 * pressure and adds 50 points. Events: near (first time the player is within the show radius: the whistle), follow. */
(function (root) {
  const AG = root.AG = root.AG || {};
  const G = AG.goWithTheFlow = AG.goWithTheFlow || {};

  class Marshals extends AG.logic.sim.Emitter {
    /** o: { list: [{ x, y, targets: [{ x, y }] }], density(x, y, r) → n, tuning } */
    constructor(o) {
      super();
      this.o = o; this.T = o.tuning || G.tuning.marshal;
      this.list = o.list.map((m, i) => ({ i, x: m.x, y: m.y, targets: m.targets, pick: 0, dx: 1, dy: 0, held: 0, followed: false, seen: false }));
      this.t = 0; this.followedCount = 0;
      this.list.forEach(m => this.point(m));
    }
    /** The arrow: toward the target with the fewest agents within 70 px of it (ties keep the first). */
    point(m) {
      let best = 0, bn = Infinity;
      m.targets.forEach((t, k) => { const n = this.o.density(t.x, t.y, 70); if (n < bn - 1e-9) { bn = n; best = k; } });
      m.pick = best;
      const t = m.targets[best], dx = t.x - m.x, dy = t.y - m.y, L = Math.hypot(dx, dy) || 1;
      m.dx = dx / L; m.dy = dy / L;
    }
    update(dt, px, py, vx, vy) {
      const T = this.T;
      this.t += dt;
      const recheck = this.t >= 0.4; if (recheck) this.t = 0;
      this.list.forEach(m => {
        if (recheck) this.point(m);
        const d = Math.hypot(px - m.x, py - m.y);
        if (!m.seen && d <= T.show) { m.seen = true; this.emit('near', m); }
        if (m.followed) return;
        const speed = Math.hypot(vx, vy);
        if (d <= T.r && speed >= T.minSpeed && AG.logic.goWithTheFlow.within(vx, vy, m.dx, m.dy, 30)) {
          m.held += dt * 1000;
          if (m.held >= T.ms) { m.followed = true; this.followedCount++; this.emit('follow', m); }
        } else m.held = Math.max(0, m.held - dt * 1000);
      });
    }
    /** Marshal sprite (2 frames) and a stepped arrow toward the chosen target. cx, cy = the camera. */
    draw(c, t, cx, cy) {
      const D = AG.sim.draw, run = AG.reducedMotion() ? 0 : Math.floor(t * 3) % 2;
      this.list.forEach(m => {
        const x = Math.round(m.x - cx), y = Math.round(m.y - cy);
        if (x < -30 || x > 510 || y < -30 || y > 300) return;
        const ax = x + Math.round(m.dx * 22), ay = y + Math.round(m.dy * 22), bx = x + Math.round(m.dx * 12), by = y + Math.round(m.dy * 12);
        const col = m.followed ? '#7ee08a' : '#ffd23f';
        D.line(c, bx, by, ax, ay, { color: '#1e1538', size: 4 }); D.line(c, bx, by, ax, ay, { color: col, size: 2 });
        // arrow head: two short strokes back from the tip
        const hx = -m.dx, hy = -m.dy, ca = Math.cos(0.6), sa = Math.sin(0.6);
        [[ca, sa], [ca, -sa]].forEach(([a, b]) => {
          const ex = ax + Math.round((hx * a - hy * b) * 6), ey = ay + Math.round((hx * b + hy * a) * 6);
          D.line(c, ax, ay, ex, ey, { color: '#1e1538', size: 4 }); D.line(c, ax, ay, ex, ey, { color: col, size: 2 });
        });
        AG.assets.draw(c, G.tuning.art.marshal, x - 7, y - 14, 14, 18, run);
        if (m.followed) AG.gfx.drawIcon(c, 'star', x - 9, y - 32, 1);
      });
    }
  }

  G.Marshals = Marshals;
  if (typeof module !== 'undefined') module.exports = Marshals;
})(typeof window !== 'undefined' ? window : globalThis);
