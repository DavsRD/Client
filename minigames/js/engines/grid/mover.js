/* E1 GRID ENGINE — GridMover: tile-to-tile movement for a player (or anything) on a TileMap.
 * Docs: kalasag-dev/minigames/docs/engines/grid.md
 *
 *   const mover = new AG.grid.GridMover({
 *     map, x: 1, y: 1, facing: 'down',
 *     speeds: { walk: 140, crawl: 260 }, speed: 'walk',   // ms per tile, by name
 *     buffer: 2,                       // directions remembered while a step is under way
 *     holdDelay: 120,                  // a held key keeps walking after this long
 *     snake: false,                    // true: keeps going every tick (a step = one tick)
 *     reverse,                         // allow 180° turns (default: yes, but not in snake mode)
 *     hop: 0,                          // px of hop arc per step (Safe Crossing)
 *     rig,                             // an AG.CharacterRig('top'): facing + walk/idle are set for you
 *     actions: { idle: 'idle', move: 'walk' | { walk: 'walk', crawl: 'walk' } },
 *     canEnter(x, y, dir, mover) → bool   (default map.walkable)
 *     onStart(x, y, dir, mover)  onEnter(x, y, dir, mover)  onBlocked(x, y, dir, mover)
 *     input: true, touch: true         // bind AG.input (arrows/WASD, D-pad) and swipes
 *   });
 *   mover.update(dt)  mover.draw(ctx, t)   (inside cam.begin / cam.end)
 *   mover.px mover.py (whole-pixel top-left)  mover.cx mover.cy (centre)  mover.moving
 *   mover.setSpeed('crawl' | ms)  mover.queueDir('left')  mover.teleport(x, y)  mover.stop()
 *   mover.trail (the tiles it left, newest first)  mover.enabled = false  mover.destroy()
 *
 * Keys: a press steps at once (or is buffered during a step); holding keeps stepping at the
 * speed's own rate (never the OS key repeat), so keys, the D-pad and swipes feel the same.
 * Touch: dragging 30 CSS px presses that direction (one step); keep the finger down to keep
 * walking; drag another way 30 px to turn; lift to stop. onBlocked fires once per bump. */
window.AG = window.AG || {};
(function (AG) {
  const VEC = { up: [0, -1], right: [1, 0], down: [0, 1], left: [-1, 0] };
  const ACTION = { up: 'UP', right: 'RIGHT', down: 'DOWN', left: 'LEFT' };
  const OPP = { up: 'down', down: 'up', left: 'right', right: 'left' };
  const SWIPE = 30; // CSS px, the input layer's swipe threshold

  class GridMover {
    constructor(o) {
      this.map = o.map || null; this.tile = o.tile || (this.map ? this.map.tile : 20);
      this.x = o.x || 0; this.y = o.y || 0; this.facing = o.facing || 'down';
      this.speeds = Object.assign({}, o.speeds || { walk: 140 });
      this.speed = o.speed || Object.keys(this.speeds)[0];
      this.buffer = o.buffer == null ? 2 : o.buffer; this.holdDelay = o.holdDelay == null ? 120 : o.holdDelay;
      this.snake = !!o.snake; this.reverse = o.reverse == null ? !this.snake : !!o.reverse;
      this.hop = o.hop || 0; this.rig = o.rig || null;
      this.actions = Object.assign({ idle: 'idle', move: 'walk' }, o.actions);
      this.canEnter = o.canEnter || ((x, y) => (this.map ? this.map.walkable(x, y) : true));
      this.onStart = o.onStart || null; this.onEnter = o.onEnter || null; this.onBlocked = o.onBlocked || null;
      this.queue = []; this.step = null; this.trail = []; this.trailMax = o.trailMax || 64;
      this.pressedAt = {}; this.bumped = null; this.stalled = this.snake && !o.autostart;
      this.enabled = true; this.offs = [];
      if (o.input !== false && AG.input) this.bindKeys();
      if (o.touch !== false && AG.input) this.bindTouch();
      this.syncRig();
    }

    /* ---------- input ---------- */
    bindKeys() {
      for (const dir of Object.keys(ACTION)) {
        this.offs.push(AG.input.on(ACTION[dir], e => { if (e.phase === 'down') this.press(dir); }));
      }
    }
    bindTouch() {
      AG.input.pointerMode('drag'); // touch-action: none on the stage, so a swipe never scrolls
      let t = null;
      const release = () => { if (t && t.dir) AG.input.release(ACTION[t.dir], 'touch'); t = null; };
      this.offs.push(
        AG.input.onPointer('down', p => { release(); t = { x: p.clientX, y: p.clientY, dir: null }; }),
        AG.input.onPointer('move', p => {
          if (!t || !this.enabled) return;
          const dx = p.clientX - t.x, dy = p.clientY - t.y;
          if (Math.max(Math.abs(dx), Math.abs(dy)) < SWIPE) return;
          const dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
          if (dir !== t.dir) { if (t.dir) AG.input.release(ACTION[t.dir], 'touch'); t.dir = dir; AG.input.press(ACTION[dir], 'touch'); }
          t.x = p.clientX; t.y = p.clientY; // re-anchor: the next 30 px decide a turn
        }),
        AG.input.onPointer('up', release)
      );
      window.addEventListener('pointercancel', release);
      this.offs.push(() => { window.removeEventListener('pointercancel', release); release(); });
    }
    press(dir) {
      if (!this.enabled) return;
      this.pressedAt[dir] = performance.now(); this.bumped = null;
      this.queueDir(dir);
    }
    /** Adds a direction as if it were pressed (also for game-made moves, e.g. tap = forward). */
    queueDir(dir) {
      if (!VEC[dir]) return;
      if (this.snake) {
        const last = this.queue.length ? this.queue[this.queue.length - 1] : this.heading();
        if (dir === last && !this.stalled) return;
        if (!this.reverse && dir === OPP[last] && !this.stalled) return;
        if (this.queue.length >= this.buffer) this.queue[this.queue.length - 1] = dir; else this.queue.push(dir);
        this.stalled = false;
        return;
      }
      if (!this.step) { this.tryStart(dir, 0); return; }
      if (this.queue.length >= this.buffer) { if (this.buffer) this.queue[this.queue.length - 1] = dir; } else this.queue.push(dir);
    }
    heading() { return this.step ? this.step.dir : this.facing; }
    /** The most recently pressed direction still held for at least holdDelay. */
    heldDir() {
      if (!AG.input) return null;
      const now = performance.now();
      let best = null, bestAt = -1;
      for (const dir of Object.keys(ACTION)) {
        if (!AG.input.isDown(ACTION[dir])) continue;
        const at = this.pressedAt[dir] == null ? now - this.holdDelay : this.pressedAt[dir];
        if (now - at >= this.holdDelay && at > bestAt) { best = dir; bestAt = at; }
      }
      return best;
    }

    /* ---------- movement ---------- */
    get stepMs() { const s = typeof this.speed === 'number' ? this.speed : this.speeds[this.speed]; return Math.max(16, s || 140); }
    setSpeed(nameOrMs) { this.speed = nameOrMs; this.syncRig(); return this; }
    tryStart(dir, carry) {
      this.facing = dir;
      const nx = this.x + VEC[dir][0], ny = this.y + VEC[dir][1];
      if (!this.canEnter(nx, ny, dir, this)) {
        const key = dir + ':' + this.x + ':' + this.y;
        if (this.bumped !== key) { this.bumped = key; if (this.onBlocked) this.onBlocked(nx, ny, dir, this); }
        this.syncRig();
        return false;
      }
      this.bumped = null;
      this.step = { fx: this.x, fy: this.y, tx: nx, ty: ny, dir, t: Math.min(carry || 0, this.stepMs - 1) };
      this.trail.unshift({ x: this.x, y: this.y });
      if (this.trail.length > this.trailMax) this.trail.length = this.trailMax;
      this.x = nx; this.y = ny; // the logical tile is the target at once: collisions are by tile
      if (this.onStart) this.onStart(nx, ny, dir, this);
      this.syncRig();
      return true;
    }
    nextDir() {
      while (this.queue.length) {
        const d = this.queue.shift();
        if (this.snake && !this.reverse && d === OPP[this.facing]) continue;
        return d;
      }
      if (this.snake) return this.stalled ? null : this.facing;
      return this.enabled ? this.heldDir() : null;
    }
    update(dt) {
      let carry = 0;
      if (this.step) {
        this.step.t += dt * 1000;
        if (this.step.t < this.stepMs) return this;
        carry = this.step.t - this.stepMs;
        const s = this.step; this.step = null;
        if (this.onEnter) this.onEnter(s.tx, s.ty, s.dir, this);
        if (this.step) return this; // the hook teleported or restarted the mover
      }
      // try the buffered / held directions until one moves (or none is left)
      for (let guard = 0; guard < this.buffer + 2; guard++) {
        const dir = this.nextDir();
        if (!dir) break;
        if (this.tryStart(dir, carry)) return this;
        if (this.snake) { this.stalled = true; this.queue.length = 0; break; } // a snake waits for a new direction
      }
      this.syncRig();
      return this;
    }
    get moving() { return !!this.step; }
    get progress() { return this.step ? this.step.t / this.stepMs : 1; }
    get px() { const s = this.step; return Math.round((s ? s.fx + (s.tx - s.fx) * this.progress : this.x) * this.tile); }
    get py() { const s = this.step; return Math.round((s ? s.fy + (s.ty - s.fy) * this.progress : this.y) * this.tile); }
    get cx() { return this.px + this.tile / 2; }
    get cy() { return this.py + this.tile / 2; }
    get hopY() { return this.step && this.hop ? Math.round(Math.sin(Math.PI * this.progress) * this.hop) : 0; }
    teleport(x, y, facing) { this.x = x; this.y = y; this.step = null; this.queue.length = 0; this.bumped = null; if (facing) this.facing = facing; if (this.snake) this.stalled = true; this.syncRig(); return this; }
    stop() { this.queue.length = 0; if (this.snake) this.stalled = true; return this; }

    syncRig() {
      if (!this.rig) return;
      this.rig.setFacing(this.facing);
      const mv = this.actions.move, name = typeof this.speed === 'string' ? this.speed : null;
      const moving = this.step || (this.snake && !this.stalled);
      this.rig.play(moving ? (typeof mv === 'string' ? mv : mv[name] || 'walk') : this.actions.idle);
    }
    draw(ctx, t) { if (this.rig) this.rig.draw(ctx, this.cx, this.cy - this.hopY, t); }
    destroy() { this.offs.forEach(f => f()); this.offs = []; }
  }

  AG.grid = Object.assign(AG.grid || {}, { GridMover });
})(window.AG);
