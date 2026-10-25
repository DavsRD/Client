/* E4 FALLING ENGINE — BottomMover: the player on a ground strip, driving an AG.CharacterRig('side').
 * Docs: kalasag-dev/minigames/docs/engines/falling.md
 *
 *   const mover = new AG.falling.BottomMover({
 *     rig, view,                       // the rig; the AG.gfx.canvas (pointer x in canvas px)
 *     x: 240, groundY: 235, minX: 20, maxX: 460,
 *     maxSpeed: 160, accel: 1500,      // px/s, px/s²: the same for every character and device
 *     touch: 'follow' | 'halves',      // follow = toward the finger x at maxSpeed; halves = hold a side
 *     actions: { idle: 'idle', move: 'run' }
 *   });
 *   mover.update(dt)  mover.draw(ctx, t)  mover.hitbox() → { x, y, w: 20, h: 28 } (FIXED for all six)
 *   mover.pose('oops', 600)  mover.shove(x, ms)  mover.setTouchMode(m)  mover.enabled  mover.destroy()
 *
 * Keys ←/→ or A/D (and the D-pad) hold to move; if both are held the last one wins. Keys win over
 * the pointer. A mouse follows only while its button is held. */
window.AG = window.AG || {};
(function (AG) {
  const HIT = { w: 20, h: 28 };

  class BottomMover {
    constructor(o) {
      o = o || {};
      this.rig = o.rig || null;
      this.groundY = o.groundY == null ? 235 : o.groundY;
      this.minX = o.minX == null ? 20 : o.minX; this.maxX = o.maxX == null ? 460 : o.maxX;
      this.x = o.x == null ? (this.minX + this.maxX) / 2 : o.x; this.v = 0;
      this.maxSpeed = o.maxSpeed || 160; this.accel = o.accel || 1500;
      this.viewW = (o.view && o.view.W) || o.viewW || 480;
      this.actions = Object.assign({ idle: 'idle', move: 'run' }, o.actions);
      this.facing = o.facing || 'right';
      this.enabled = true; this.offs = [];
      this.keyDir = 0; this.lastKey = 0; this.ptr = null; this.posed = null; this.shoving = null;
      this.touchMode = o.touch || 'follow';
      if (o.view && AG.input) AG.input.setView(o.view);
      if (o.input !== false && AG.input) this.bind();
      this.syncRig();
    }

    /* ---------- input ---------- */
    bind() {
      this.offs.push(
        AG.input.on('LEFT', e => { if (e.phase === 'down') this.lastKey = -1; }),
        AG.input.on('RIGHT', e => { if (e.phase === 'down') this.lastKey = 1; })
      );
      AG.input.pointerMode('follow'); // touch-action: none, so dragging along the ground never scrolls
      const down = p => { this.ptr = { x: p.x, device: p.device }; };
      const move = p => { if (this.ptr) this.ptr.x = p.x; };
      const up = () => { this.ptr = null; };
      this.offs.push(AG.input.onPointer('down', down), AG.input.onPointer('move', move), AG.input.onPointer('up', up));
      window.addEventListener('pointercancel', up);
      this.offs.push(() => window.removeEventListener('pointercancel', up));
    }
    setTouchMode(m) { this.touchMode = m === 'halves' ? 'halves' : 'follow'; return this; }
    /** The key direction: -1, 0 or 1 (both held → the last pressed). */
    keys() {
      if (!AG.input) return 0;
      const l = AG.input.isDown('LEFT'), r = AG.input.isDown('RIGHT');
      return l && r ? this.lastKey : l ? -1 : r ? 1 : 0;
    }
    /** What the controls ask for this frame: { dir } or { target }. */
    intent() {
      if (!this.enabled) return { dir: 0, target: null };
      const k = this.keys();
      if (k || !this.ptr) return { dir: k, target: null };
      if (this.touchMode === 'halves' && this.ptr.device === 'touch') return { dir: this.ptr.x < this.viewW / 2 ? -1 : 1, target: null };
      return { dir: 0, target: Math.max(this.minX, Math.min(this.maxX, this.ptr.x)) };
    }

    /* ---------- movement ---------- */
    update(dt) {
      if (this.shoving) {
        const s = this.shoving; s.t += dt * 1000;
        const p = Math.min(1, s.t / s.ms), e = 1 - (1 - p) * (1 - p);
        this.x = s.from + (s.to - s.from) * e; this.v = 0;
        if (p >= 1) this.shoving = null;
      } else {
        const it = this.intent();
        const r = AG.logic.falling.moveStep({ x: this.x, v: this.v }, { dir: it.dir, target: it.target, maxSpeed: this.maxSpeed, accel: this.accel, minX: this.minX, maxX: this.maxX }, dt);
        this.x = r.x; this.v = r.v;
        if (it.dir) this.facing = it.dir < 0 ? 'left' : 'right';
        else if (it.target != null && Math.abs(it.target - this.x) > 2) this.facing = it.target < this.x ? 'left' : 'right';
      }
      if (this.posed && performance.now() >= this.posed.until) this.posed = null;
      this.syncRig();
      return this;
    }
    /** Push the player to x over ms (a lahar pushing them out of the lane); controls wait meanwhile. */
    shove(x, ms) { this.shoving = { from: this.x, to: Math.max(this.minX, Math.min(this.maxX, x)), t: 0, ms: ms || 250 }; return this; }
    /** Play a rig action for ms (oops on a hit, cheer at the end); 0 / Infinity = until pose(null). */
    pose(action, ms) { this.posed = action ? { action, until: ms ? performance.now() + ms : Infinity } : null; this.syncRig(); return this; }
    get moving() { return Math.abs(this.v) > 15 || !!this.shoving; }
    get px() { return Math.round(this.x); }
    /** FIXED 20 × 28 for every character (fairness), standing on the ground line. */
    hitbox() { return { x: this.x - HIT.w / 2, y: this.groundY - HIT.h, w: HIT.w, h: HIT.h }; }
    get left() { return this.x - HIT.w / 2; }
    get right() { return this.x + HIT.w / 2; }
    teleport(x) { this.x = Math.max(this.minX, Math.min(this.maxX, x)); this.v = 0; this.shoving = null; return this; }

    syncRig() {
      if (!this.rig) return;
      this.rig.setFacing(this.facing);
      this.rig.play(this.posed ? this.posed.action : this.moving ? this.actions.move : this.actions.idle);
    }
    draw(ctx, t) { if (this.rig) this.rig.draw(ctx, this.px, this.groundY, t); }
    destroy() { this.offs.forEach(f => f()); this.offs = []; this.ptr = null; }
  }

  BottomMover.HITBOX = HIT;
  AG.falling = Object.assign(AG.falling || {}, { BottomMover });
})(window.AG);
