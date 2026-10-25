/* E3 SIDE-SCROLL ENGINE — RunnerController: the auto-running player on a World, driving an
 * AG.CharacterRig('side'). Our own AABB physics at a fixed 240 Hz step: FIXED 16 × 28 hitbox for every
 * character (14 tall while sliding), variable jump (logic/sidescroll/jump.js), coyote + buffer, double
 * jump, slide, drop-through, ladders, stairs, bounce pads, crumbling and moving platforms, hazards,
 * pickups, checkpoints and respawn. Input: JUMP = Space / ↑ / W / tap (hold = higher); SLIDE = ↓ / S /
 * swipe down / ⤓ button. Docs: kalasag-dev/minigames/docs/engines/sidescroll.md */
window.AG = window.AG || {};
(function (AG) {
  const L = () => AG.logic.sidescroll;
  const ONE_WAY = new Set(['oneway', 'crumble', 'moving', 'ladderTop']);

  class RunnerController extends AG.sidescroll.Emitter {
    constructor(o) {
      super();
      o = o || {};
      this.o = o; this.T = L().tune(o.tuning);
      this.rig = o.rig || null; this.world = o.world;
      this.x = o.x == null ? 40 : o.x; this.y = o.y == null ? 224 : o.y; // centre x, feet y (world px)
      this.startX = this.x; this.vx = 0; this.mul = 1;
      this.runSpeed = o.runSpeed == null ? 150 : o.runSpeed;
      this.doubleJump = !!o.doubleJump; this.shield = 0; this.magnet = 0;
      this.actions = Object.assign({ idle: 'idle', run: 'run', jump: 'jump', fall: 'fall', slide: 'slide', climb: 'run', oops: 'oops', cheer: 'cheer' }, o.actions);
      this.fallRespawn = o.fallRespawn === undefined ? 'safe' : o.fallRespawn;
      this.graceMs = o.graceMs == null ? 1000 : o.graceMs; this.freezeMs = o.freezeMs == null ? 500 : o.freezeMs;
      this.swipeWaitMs = o.swipeWaitMs == null ? 50 : o.swipeWaitMs; this.hazardInset = o.hazardInset == null ? 2 : o.hazardInset;
      this.running = o.running !== false; this.debug = !!o.debug;
      this.clock = 0; this.acc = 0;
      this.s = L().freeFall(0); this.ground = null; this.lastGround = -Infinity; this.airMs = 0;
      this.jumpAt = -Infinity; this.slideAt = -Infinity; this.jumpHeld = false; this.usedDouble = false;
      this.sliding = false; this.slideUntil = 0; this.dropUntil = 0;
      this.climbing = null; this.ignoreLadder = null;
      this.frozenUntil = 0; this.graceUntil = 0; this.posed = null; this.ended = false; this.bumping = false;
      this.checkpoint = { x: this.x, y: this.y }; this.safe = { x: this.x, y: this.y };
      this.ptr = null; this.offs = [];
      if (o.view && AG.input) AG.input.setView(o.view);
      if (o.input !== false && AG.input) this.bind();
    }

    /* ---------- input ---------- */
    bind() {
      AG.input.register('JUMP', { keys: ['Space', 'ArrowUp', 'KeyW'], button: { en: 'Jump' } });
      AG.input.register('SLIDE', { keys: ['ArrowDown', 'KeyS'], button: { en: '⤓' } });
      this.offs.push(
        AG.input.on('JUMP', e => { if (e.phase === 'down') this.press('jump'); else if (e.phase === 'up') this.release('jump'); }),
        AG.input.on('SLIDE', e => { if (e.phase === 'down') this.press('slide'); })
      );
      AG.input.pointerMode('drag'); // touch-action: none; a swipe never scrolls the page
      /* A press on the stage waits up to swipeWaitMs to see whether it is a swipe down (slide) before it
       * counts as a jump; the jump is timed from the touch-down, so coyote and buffer stay the same. */
      const down = p => { this.ptr = { id: p.event && p.event.pointerId, at: this.clock, fired: false, mode: null, slid: false }; };
      const move = p => {
        const q = this.ptr; if (!q || p.dx == null) return;
        if (!q.mode && Math.hypot(p.dx, p.dy) >= 10) { q.mode = p.dy > Math.abs(p.dx) ? 'swipe' : 'drag'; if (q.mode === 'drag') this.firePtr(); }
        if (q.mode === 'swipe' && !q.slid && p.dy >= 30 && this.clock - q.at <= 300) { q.slid = true; this.press('slide'); }
      };
      const up = () => { const q = this.ptr; if (!q) return; if (!q.fired && q.mode !== 'swipe') this.firePtr(); if (q.fired) this.release('jump', true); this.ptr = null; };
      this.offs.push(AG.input.onPointer('down', down), AG.input.onPointer('move', move), AG.input.onPointer('up', up));
      const cancel = e => { const q = this.ptr; if (!q || (q.id != null && e.pointerId !== q.id)) return; if (q.fired) this.release('jump', true); this.ptr = null; };
      window.addEventListener('pointercancel', cancel); window.addEventListener('pointerup', cancel); // also while paused
      this.offs.push(() => { window.removeEventListener('pointercancel', cancel); window.removeEventListener('pointerup', cancel); });
    }
    firePtr() { const q = this.ptr; if (!q || q.fired) return; q.fired = true; this.press('jump', q.at, true); }
    /** press('jump' | 'slide', atMs?) — also for bots and tests (input: false). */
    press(what, at, byPtr) {
      const t = at == null ? this.clock : at;
      if (what === 'jump') { this.jumpAt = t; this.jumpHeld = true; this.heldBy = byPtr ? 'ptr' : 'key'; }
      else if (what === 'slide') this.slideAt = t;
    }
    release(what, byPtr) {
      if (what !== 'jump') return;
      if (this.heldBy === 'ptr' && !byPtr && this.ptr && this.ptr.fired) return; // the finger is still down
      this.jumpHeld = false;
      if (this.s.fromJump) L().jumpRelease(this.s, this.T);
    }

    /* ---------- state ---------- */
    get h() { return this.sliding ? this.T.slideH : this.T.h; }
    /** FIXED 16 × 28 (16 × 14 sliding) for every character, feet on y. */
    hitbox() { const T = this.T; return { x: this.x - T.w / 2, y: this.y - this.h, w: T.w, h: this.h }; }
    get grounded() { return !!this.ground; }
    get vy() { return this.s.vy; }
    get frozen() { return this.clock < this.frozenUntil || this.ended || !this.running; }
    get blinking() { return this.clock < this.graceUntil; }
    get distance() { return this.x - this.startX; }
    get state() { return this.ended ? 'end' : this.climbing ? 'climb' : this.sliding ? 'slide' : !this.ground ? (this.s.vy < 0 ? 'jump' : 'fall') : this.frozen ? 'idle' : 'run'; }
    go() { this.running = true; return this; }
    stop() { this.running = false; return this; }
    pose(action, ms) { this.posed = action ? { action, until: ms ? this.clock + ms : Infinity } : null; this.syncRig(); return this; }

    /* ---------- update ---------- */
    update(dt) {
      const g = this.ground;
      if (g && g.type === 'moving') { this.x += g.ddx; this.y = g.y; } // moving platforms carry the player
      this.acc += dt;
      const h = this.T.stepS;
      for (let n = 0; this.acc >= h - 1e-9 && n < 40; n++) { this.step(h); this.acc -= h; }
      this.triggers(dt);
      if (this.posed && this.clock >= this.posed.until) this.posed = null;
      this.syncRig();
      return this;
    }
    step(h) {
      const T = this.T, W = this.world;
      this.clock += h * 1000;
      if (this.ptr && !this.ptr.fired && this.ptr.mode !== 'swipe' && this.clock - this.ptr.at >= this.swipeWaitMs) this.firePtr();
      if (this.clock - this.jumpAt <= T.bufferMs) this.tryJump();
      if (this.clock - this.slideAt <= T.bufferMs) this.trySlide();
      if (this.sliding && this.clock >= this.slideUntil && W.free({ x: this.x - T.w / 2, y: this.y - T.h, w: T.w, h: T.h })) this.sliding = false;
      if (this.ignoreLadder && !AG.sidescroll.overlaps(this.hitbox(), this.ignoreLadder)) this.ignoreLadder = null;
      if (this.climbing) { this.climb(h); return; }
      const target = this.frozen ? 0 : this.runSpeed * this.mul;
      this.vx = this.vx < target ? Math.min(target, this.vx + T.accel * h) : Math.max(target, this.vx - T.accel * h);
      this.moveX(this.vx * h);
      if (this.grab()) return;
      const prevY = this.y;
      this.y += L().jumpStep(this.s, h, T);
      this.resolveY(prevY);
      if (!this.ground) this.airMs += h * 1000;
    }
    moveX(dx) {
      if (!dx) return;
      this.x += dx;
      const b = this.hitbox(), e = 0.01;
      let wall = null;
      this.world.each('solids', b.x, b.x + b.w, s => {
        if (s.x < b.x + b.w && s.x + s.w > b.x && s.y < b.y + b.h - e && s.y + s.h > b.y + e && (!wall || s.x < wall.x)) wall = s;
      });
      const g = this.ground, rise = wall ? this.y - wall.y : 0;
      let maxRise = this.T.stepUp;
      if (g && g.type === 'ramp') maxRise = Math.max(maxRise, this.y - Math.min(g.y, L().rampY(g, g.x), L().rampY(g, g.x + g.w)) + 0.5); // onto the block at the top of the stairs
      if (wall && g && rise > 0 && rise <= maxRise && this.world.free({ x: b.x, y: wall.y - b.h, w: b.w, h: b.h - e })) {
        this.y = wall.y; this.land(wall); this.bumping = false; // the top of stairs, a lip a few px high
        return;
      }
      if (wall && dx > 0) {
        this.x = wall.x - this.T.w / 2; this.vx = 0;
        if (!this.bumping) this.emit('bump', wall);
        this.bumping = true;
      } else this.bumping = false;
    }
    resolveY(prevY) {
      const T = this.T, W = this.world, s = this.s, l = this.x - T.w / 2, r = this.x + T.w / 2;
      const across = ob => ob.x < r && ob.x + ob.w > l;
      if (s.vy >= 0) {
        let best = null, top = Infinity;
        const consider = (ob, y, tolUp, tolDown) => { if (prevY <= y + tolUp && this.y >= y - tolDown && y < top) { best = ob; top = y; } };
        W.each('solids', l, r, ob => { if (across(ob)) consider(ob, ob.y, 0.01, 0.001); });
        if (this.clock >= this.dropUntil) W.each('oneways', l, r, ob => { if (!(ob.type === 'crumble' && ob.falling) && across(ob)) consider(ob, ob.y, ob.type === 'moving' ? Math.abs(ob.ddy) + 1 : 0.01, 0.001); });
        const stick = this.ground ? 8 : 0; // walk up and down stairs without leaving them
        W.each('ramps', l, r, ob => { if (this.x >= ob.x && this.x <= ob.x + ob.w) consider(ob, L().rampY(ob, this.x), Math.max(0.01, stick), Math.max(0.001, stick)); });
        if (best) { this.y = top; this.land(best); } else this.ground = null;
      } else {
        this.ground = null;
        const head = this.y - this.h, prevHead = prevY - this.h;
        W.each('solids', l, r, ob => {
          const bottom = ob.y + ob.h;
          if (across(ob) && prevHead >= bottom - 0.01 && head < bottom) { this.y = bottom + this.h; s.vy = 0; s.hold = false; s.cutPending = false; }
        });
      }
    }
    land(ob) {
      const s = this.s, was = this.ground;
      if (!was && this.airMs > 40) this.emit('land', ob);
      this.ground = ob; this.lastGround = this.clock; this.airMs = 0; this.usedDouble = false;
      s.vy = 0; s.since = Infinity; s.hold = false; s.cutPending = false; s.fromJump = false;
      this.mul = ob.mul != null ? ob.mul : 1;
      if (ob.type === 'crumble') this.world.touch(ob);
      if (ob.type === 'solid' || ob.type === 'oneway') { // last safe ground: not crumbling, moving or stairs;
        const back = Math.min(96, ob.w - 16);              // up to 96 px back from its edge, time to react
        this.safe = { x: Math.max(ob.x + 8, Math.min(ob.x + ob.w - back, this.x)), y: ob.y };
      }
    }
    tryJump() {
      const T = this.T;
      if (this.frozen && !this.ended) { this.jumpAt = -Infinity; return; }
      if (this.ended) return;
      if (this.climbing) { this.ignoreLadder = this.climbing; this.climbing = null; this.jump(false); return; }
      if (this.sliding && !this.world.free({ x: this.x - T.w / 2, y: this.y - T.h, w: T.w, h: T.h })) return; // under something: keep the press buffered
      if (this.ground || this.jumpAt - this.lastGround <= T.coyoteMs) { this.jump(false); return; }
      if (this.doubleJump && !this.usedDouble) { this.usedDouble = true; this.jump(true); }
    }
    jump(double) {
      this.s = L().takeOff(this.T); this.s.fromJump = true;
      if (!this.jumpHeld) L().jumpRelease(this.s, this.T); // already let go: a tap
      this.ground = null; this.lastGround = -Infinity; this.jumpAt = -Infinity; this.sliding = false;
      this.emit('jump', { double });
    }
    trySlide() {
      if (!this.ground || this.climbing || this.frozen) return; // in the air: stays buffered for the landing
      this.slideAt = -Infinity;
      if (ONE_WAY.has(this.ground.type)) { // DOWN on a one-way platform drops through it
        this.dropUntil = this.clock + this.T.dropMs; this.ground = null; this.y += 1;
        this.s = L().freeFall(0); this.emit('drop');
        return;
      }
      this.sliding = true; this.slideUntil = this.clock + this.T.slideMs;
      this.emit('slide');
    }
    /** Starts climbing when the centre reaches a ladder it is not yet on top of. */
    grab() {
      if (this.climbing) return false;
      const b = this.hitbox();
      let lad = null;
      this.world.each('ladders', b.x, b.x + b.w, l => { if (l !== this.ignoreLadder && this.x >= l.x + 4 && this.x <= l.x + 12 && this.y > l.y + 1 && b.y < l.y + l.h) { lad = l; return false; } });
      if (!lad) return false;
      this.climbing = lad; this.x = lad.x + lad.w / 2; this.vx = 0; this.sliding = false; this.ground = null;
      this.s = L().freeFall(0);
      this.emit('climb', lad);
      return true;
    }
    climb(h) {
      const l = this.climbing;
      this.y -= this.T.climbSpeed * h;
      if (this.y <= l.y) { this.y = l.y; this.climbing = null; this.land(l.top); this.emit('climbed', l); }
    }

    /** Pads, hazards, pickups, checkpoints, zones, pits and the end of a finite course (once per frame). */
    triggers(dt) {
      const W = this.world, b = this.hitbox(), ov = AG.sidescroll.overlaps, x0 = b.x - 120, x1 = b.x + 120;
      W.each('pads', x0, x1, p => {
        if (this.s.vy >= 0 && !this.climbing && ov(b, p) && (p.fired == null || W.clock - p.fired > 200)) {
          p.fired = W.clock; this.s = L().takeOff(this.T, true); this.ground = null; this.lastGround = -Infinity; this.sliding = false;
          this.emit('bounce', p);
        }
      });
      const k = this.hazardInset;
      W.each('hazards', x0, x1, hz => { if (!this.blinking && ov(b, { x: hz.x + k, y: hz.y + k, w: hz.w - 2 * k, h: hz.h - 2 * k })) this.hurt(hz); });
      const cx = this.x, cy = this.y - this.T.h / 2, mr = this.magnet, step = (260 + this.vx) * (dt || 0);
      W.each('pickups', x0 - mr, x1 + mr, pk => {
        if (pk.taken) return;
        if (mr && pk.magnet !== false) {
          const dx = cx - (pk.x + pk.w / 2), dy = cy - (pk.y + pk.h / 2), d = Math.hypot(dx, dy);
          if (d <= mr && d > 0) { const m = Math.min(d, step); pk.x += dx / d * m; pk.y += dy / d * m; }
        }
        if (ov(b, pk)) { pk.taken = true; this.emit('pickup', pk); }
      });
      W.each('checkpoints', x0, x1, cp => { if (!cp.reached && this.x >= cp.x + 8) { cp.reached = true; this.checkpoint = { x: cp.x + 8, y: cp.groundY }; this.emit('checkpoint', cp); } });
      W.each('zones', x0, x1, z => { if (!z.entered && ov(b, z)) { z.entered = true; this.emit('zone', z); } });
      if (this.y > W.killY(this.x)) { this.emit('fell', { x: this.x }); if (this.fallRespawn) this.respawn(this.fallRespawn); }
      if (!this.ended && this.x >= W.endX - 24) { this.ended = true; this.emit('end'); }
    }
    /** A hit: the shield takes it, else oops + blink for graceMs. Also for game-made hazards. */
    hurt(src) {
      if (this.shield > 0) { this.shield--; this.graceUntil = this.clock + 500; this.emit('hit', { src, shielded: true }); return; }
      this.graceUntil = this.clock + this.graceMs;
      if (this.rig) this.rig.blink(this.graceMs);
      this.pose(this.actions.oops, 500);
      this.emit('hit', { src, shielded: false });
    }
    /** Back to the last checkpoint ('checkpoint'), the last safe ground ('safe') or { x, y }; blinks. */
    respawn(where) {
      const p = where && typeof where === 'object' ? where : where === 'checkpoint' ? this.checkpoint : this.safe;
      this.x = p.x; this.y = p.y; this.vx = 0; this.s = L().freeFall(0); this.ground = null; this.airMs = 0;
      this.sliding = false; this.climbing = null; this.ignoreLadder = null; this.jumpAt = this.slideAt = -Infinity;
      this.frozenUntil = this.clock + this.freezeMs; this.graceUntil = this.clock + this.freezeMs + this.graceMs;
      if (this.rig) this.rig.blink(this.freezeMs + this.graceMs);
      this.world.reset();
      this.emit('respawn', { at: typeof where === 'string' ? where : 'point', x: p.x, y: p.y });
      return this;
    }

    syncRig() {
      if (!this.rig) return;
      const A = this.actions;
      const a = this.posed ? this.posed.action : this.climbing ? A.climb : this.sliding ? A.slide
        : !this.ground ? (this.s.vy < 0 ? A.jump : this.airMs > 60 ? A.fall : A.run)
        : this.frozen || this.vx < 10 ? A.idle : A.run;
      this.rig.setFacing('right'); this.rig.play(a);
    }
    draw(ctx, cam, t) {
      const x = Math.round(this.x - cam.x), y = Math.round(this.y - cam.y);
      if (this.rig) this.rig.draw(ctx, x, y, t);
      if (this.debug) { const b = this.hitbox(); ctx.strokeStyle = this.blinking ? '#ff4f6d' : '#5ed16a'; ctx.strokeRect(Math.round(b.x - cam.x) + 0.5, Math.round(b.y - cam.y) + 0.5, b.w - 1, b.h - 1); }
    }
    destroy() { this.offs.forEach(f => f()); this.offs = []; this.ptr = null; }
  }

  /** The ⤓ (slide) button for touch players; tap anywhere on the stage jumps. */
  function touchControls(container) { return AG.input.touchControls(container, { buttons: [{ action: 'SLIDE', label: { en: '⤓' } }] }); }

  RunnerController.HITBOX = { w: 16, h: 28, slideH: 14 };
  AG.sidescroll = Object.assign(AG.sidescroll || {}, { RunnerController, touchControls });
})(window.AG);
