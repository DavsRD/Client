/* E4 FALLING ENGINE — FallingField: the falling objects of a dodge-and-collect game on a 480 × 270
 * canvas. Runs the WaveDirector, Spawner, ComboCounter, PowerUps and LaneHazards (js/logic/falling/),
 * moves and draws the objects with dithered shadow warnings, and tests circle hitboxes (80 % of the
 * icon size) against the BottomMover's fixed 20 × 28 box. The game keeps score, hearts and the HUD.
 * Docs: kalasag-dev/minigames/docs/engines/falling.md */
window.AG = window.AG || {};
(function (AG) {
  const L = () => AG.logic.falling;
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  const INK = '#1e1538';
  const EMOJI = /\p{Extended_Pictographic}/u;

  /** Circle vs rectangle. */
  function circleRect(cx, cy, r, b) {
    const nx = Math.max(b.x, Math.min(cx, b.x + b.w)), ny = Math.max(b.y, Math.min(cy, b.y + b.h));
    return (cx - nx) ** 2 + (cy - ny) ** 2 <= r * r;
  }

  class FallingField {
    constructor(o) {
      o = o || {};
      this.o = o;
      this.W = o.width || 480; this.H = o.height || 270; this.groundY = o.groundY == null ? 235 : o.groundY;
      this.mover = o.mover || null;
      this.rng = o.rng || AG.util.mulberry32(o.seed || 1);
      this.hitScale = o.hitScale == null ? 0.8 : o.hitScale;
      this.spawner = new (L().Spawner)({ defs: o.defs, minX: o.minX == null ? 8 : o.minX, maxX: o.maxX == null ? this.W - 8 : o.maxX,
        safeGap: o.safeGap == null ? 40 : o.safeGap, hitScale: this.hitScale, rng: this.rng, jitter: o.jitter, cooldown: o.cooldown, firstDelayMs: o.firstDelayMs });
      this.defs = this.spawner.defs;
      this.director = o.waves ? new (L().WaveDirector)(o.waves, { loop: o.loop }) : null;
      this.wave = o.wave || null; // a fixed wave when there is no director
      this.combo = new (L().ComboCounter)(o.combo);
      this.power = new (L().PowerUps)(o.powerups);
      this.lanes = (o.lanes || []).map(l => (l instanceof L().LaneHazard ? l : new (L().LaneHazard)(l)));
      this.hitGraceMs = o.hitGraceMs == null ? 1000 : o.hitGraceMs;
      this.magnetSpeed = o.magnetSpeed || 260;
      this.objects = []; this.fx = []; this.clock = 0; this.graceUntil = 0; this.running = true;
      this.stats = { spawned: 0, caught: 0, hits: 0, blocked: 0, dodged: 0, missed: 0 };
      this.sprites = new Map(); this.shadowCache = new Map();
    }
    get time() { return this.clock; }
    /** The current wave values ({ label, t, spawnIntervalMs, fallSpeed, table, order, index }). */
    get current() { return this.director ? this.director.at() : this.wave; }
    call(name, ...args) { const f = this.o[name]; return f ? f(...args) : undefined; }

    /* ---------- update ---------- */
    update(dt) {
      if (!this.running) return this;
      const ms = dt * 1000;
      this.clock += ms;
      for (const k of this.power.update(ms)) this.call('onPowerEnd', k);
      const ts = this.power.timeScale, wms = ms * ts; // slow-mo slows the objects and the spawn clock, not the level clock
      if (this.director) for (const e of this.director.update(ms)) this.call(e.type === 'wave' ? 'onWave' : 'onDone', e.wave, e.index);
      const cur = this.current;
      for (const ob of this.spawner.update(wms, this.objects, cur)) { this.objects.push(ob); this.stats.spawned++; this.call('onSpawn', ob); }
      for (const lane of this.lanes) for (const st of lane.update(ms)) this.call('onLane', lane, st);
      if (this.mover) this.mover.update(dt);
      this.moveObjects(dt * ts, wms);
      this.checkLanes();
      this.fx = this.fx.filter(f => (f.t += ms) < f.ms);
      return this;
    }
    moveObjects(dts, wms) {
      const box = this.mover && this.mover.hitbox(), mr = this.power.magnetRadius;
      const mx = this.mover ? this.mover.x : 0, my = box ? box.y + box.h / 2 : 0;
      for (const ob of this.objects) {
        if (ob.phase === 'warn') { ob.warnLeft -= wms; if (ob.warnLeft > 0) continue; ob.phase = 'fall'; }
        ob.age += wms;
        ob.y += ob.vy * dts;
        if (mr && ob.kind !== 'bad' && ob.kind !== 'neutral' && Math.hypot(ob.x - mx, ob.y - my) <= mr) {
          const step = this.magnetSpeed * dts, dx = mx - ob.x;
          ob.x0 += Math.abs(dx) <= step ? dx : Math.sign(dx) * step;
          ob.magnet = true;
        }
        ob.x = ob.x0 + (ob.drift ? ob.drift.amp * Math.sin(ob.drift.phase + 2 * Math.PI * ob.drift.freq * ob.age / 1000) : 0);
        if (box && ob.kind !== 'neutral' && !ob.ignored && circleRect(ob.x, ob.y, ob.r, box)) { this.resolve(ob); continue; }
        if (ob.y + ob.r >= this.groundY) this.land(ob);
      }
      this.objects = this.objects.filter(ob => !ob.done);
    }
    resolve(ob) {
      if (ob.kind === 'bad') {
        if (this.clock < this.graceUntil) { ob.ignored = true; return; } // blinking: it passes through
        ob.done = true;
        if (this.power.absorb()) { this.puff(ob, 'block'); this.stats.blocked++; this.call('onHit', ob, { shielded: true, comboLost: 0 }); return; }
        this.hurt(ob);
        return;
      }
      ob.done = true; this.puff(ob, 'catch');
      if (ob.kind === 'good') {
        const c = this.combo.add(), points = this.combo.score(ob.def.points);
        this.stats.caught++;
        const order = this.director && this.director.order;
        const counted = order ? order.add(ob.id) : false;
        this.call('onCatch', ob, { points, mult: c.mult, combo: c.count, stepped: c.stepped });
        if (counted) { this.call('onOrder', order, order.done); if (order.done && order.repeat !== false) order.renew(); }
      } else if (ob.kind === 'powerup') {
        const kind = ob.def.power || ob.id;
        this.power.grant(kind); this.call('onPower', kind, ob);
      } else if (ob.kind === 'collectible') this.call('onCollect', ob);
    }
    /** A hit that costs the player: resets the combo, blinks for hitGraceMs. Also for game-made hazards. */
    hurt(source) {
      const lost = this.combo.reset();
      this.graceUntil = this.clock + this.hitGraceMs; this.stats.hits++;
      if (this.mover && this.mover.rig) this.mover.rig.blink(this.hitGraceMs);
      if (source && source.def) this.puff(source, 'hit');
      this.call('onHit', source, { shielded: false, comboLost: lost });
    }
    get blinking() { return this.clock < this.graceUntil; }
    land(ob) {
      ob.done = true;
      if (ob.kind === 'bad') { this.stats.dodged++; this.puff(ob, 'land'); this.call('onLand', ob); }
      else if (ob.kind !== 'neutral') { this.stats.missed++; this.call('onMiss', ob); }
    }
    checkLanes() {
      if (!this.mover) return;
      for (const lane of this.lanes) {
        if (!lane.active || !lane.overlaps(this.mover.left, this.mover.right)) continue;
        if (lane.take()) {
          if (lane.shieldable && this.power.absorb()) this.call('onHit', lane, { shielded: true, comboLost: 0, lane: true });
          else if (this.clock >= this.graceUntil) this.hurt(lane);
        }
        if (!this.mover.shoving) this.mover.shove(this.exitX(lane), 280);
      }
    }
    /** The nearest x outside a lane that is still inside the mover's bounds. */
    exitX(lane) {
      const m = this.mover, half = AG.falling.BottomMover ? AG.falling.BottomMover.HITBOX.w / 2 : 10;
      const a = lane.x - half - 2, b = lane.x + lane.w + half + 2;
      const okA = a >= m.minX, okB = b <= m.maxX;
      if (okA && (!okB || Math.abs(m.x - a) <= Math.abs(m.x - b))) return a;
      return okB ? b : m.x;
    }
    /** Starts a lane's warning (then it flows by itself). */
    triggerLane(laneOrId) {
      const lane = typeof laneOrId === 'string' ? this.lanes.find(l => l.id === laneOrId) : laneOrId || this.lanes[0];
      if (!lane) return null;
      lane.trigger(); this.call('onLane', lane, lane.state);
      return lane;
    }
    schedule(atMs, id, o) { this.spawner.schedule(atMs, id, o); return this; }
    puff(ob, type) { this.fx.push({ type, x: Math.round(ob.x), y: Math.round(type === 'land' ? this.groundY : ob.y), t: 0, ms: type === 'land' ? 260 : 320, size: ob.def ? ob.def.size : 16 }); }
    clear(kinds) { this.objects = this.objects.filter(ob => kinds && !kinds.includes(ob.kind)); return this; }
    stop() { this.running = false; return this; }

    /* ---------- drawing ---------- */
    /** Lanes, shadows, the mover, objects, then effects. Pass { mover: false } to draw the player yourself. */
    draw(ctx, t, opt) {
      opt = opt || {};
      t = t == null ? this.clock / 1000 : t;
      for (const lane of this.lanes) this.drawLane(ctx, lane, t);
      for (const ob of this.objects) if (ob.def.shadowWarnMs || ob.def.shadow) this.drawShadow(ctx, ob);
      if (this.mover && opt.mover !== false) { this.drawPower(ctx, t); this.mover.draw(ctx, t); }
      for (const ob of this.objects) if (ob.phase === 'fall') this.drawObject(ctx, ob, t);
      for (const f of this.fx) this.drawFx(ctx, f);
    }
    /** The object's art: an asset key ('ashfall.obj.rock'), an AG.icons name or an emoji, at def.size. */
    sprite(def) {
      if (this.sprites.has(def.id)) return this.sprites.get(def.id);
      const icon = def.icon || def.id, S = def.size;
      let src = null, sw = 18, sh = 18;
      if (AG.icons.has(icon)) {
        src = AG.icons.canvas(icon);
        if (!src) { const rec = AG.icons.image(icon); if (!rec.img.complete || !rec.img.naturalWidth) return null; src = rec.img; sw = rec.img.naturalWidth; sh = rec.img.naturalHeight; }
      } else if (EMOJI.test(icon)) src = AG.pixelIcon(icon, 18, true);
      else return null; // an asset key: drawn by AG.assets each frame
      const cv = document.createElement('canvas'); cv.width = cv.height = S;
      const c = cv.getContext('2d'); c.imageSmoothingEnabled = false;
      c.drawImage(src, 0, 0, sw, sh, 0, 0, S, S); // nearest-neighbour: crisp at any size
      this.sprites.set(def.id, cv);
      return cv;
    }
    drawObject(ctx, ob, t) {
      const d = ob.def, S = d.size, x = Math.round(ob.x - S / 2), y = Math.round(ob.y - S / 2);
      if (this.o.drawObject && this.o.drawObject(ctx, ob, x, y, t) !== false) return;
      const sp = this.sprite(d);
      if (sp) ctx.drawImage(sp, x, y);
      else AG.assets.draw(ctx, d.icon, x, y, S, S, d.frames ? Math.floor(ob.age / 1000 * (d.fps || 8)) % d.frames : 0);
      if (ob.kind === 'powerup' || ob.kind === 'collectible') { // a sparkle corner: they differ by shape, not colour alone
        const k = Math.floor(t * 4) % 2 && !AG.reducedMotion();
        ctx.fillStyle = '#ffffff'; ctx.fillRect(x + S - 2, y - 1 - (k ? 1 : 0), 2, 2); ctx.fillRect(x - 1, y + S - 2 + (k ? 1 : 0), 2, 2);
      }
    }
    /** A dithered shadow on the ground under a falling object: 25 % → 100 % as it comes closer. */
    drawShadow(ctx, ob) {
      const fallP = Math.max(0, Math.min(1, (ob.y + ob.def.size / 2) / this.groundY));
      const p = ob.phase === 'warn' ? (ob.warnMs ? 1 - ob.warnLeft / ob.warnMs : 1) * 0.34 : 0.34 + fallP * 0.66;
      const level = Math.min(4, 1 + Math.floor(p * 4));
      const w = Math.max(6, Math.round(ob.def.size * (0.7 + 0.3 * p))), h = Math.max(3, Math.round(w / 4));
      const x = Math.round(ob.x - w / 2), y = this.groundY - Math.ceil(h / 2);
      ctx.drawImage(this.shadowStamp(w, h, level, x & 3, y & 3), x, y);
    }
    shadowStamp(w, h, level, ax, ay) {
      const key = w + ':' + h + ':' + level + ':' + ax + ':' + ay;
      let cv = this.shadowCache.get(key);
      if (cv) return cv;
      cv = document.createElement('canvas'); cv.width = w; cv.height = h;
      const c = cv.getContext('2d'); c.fillStyle = INK;
      const rx = w / 2, ry = h / 2;
      for (let py = 0; py < h; py++) for (let px = 0; px < w; px++) {
        const dx = (px + 0.5 - rx) / rx, dy = (py + 0.5 - ry) / ry;
        if (dx * dx + dy * dy > 1) continue;
        if (BAYER[((py + ay) & 3) * 4 + ((px + ax) & 3)] < level * 4) c.fillRect(px, py, 1, 1);
      }
      if (this.shadowCache.size > 400) this.shadowCache.clear();
      this.shadowCache.set(key, cv);
      return cv;
    }
    drawLane(ctx, lane, t) {
      if (lane.state === 'idle') return;
      if (this.o.drawLane && this.o.drawLane(ctx, lane, t) !== false) return;
      const top = lane.data.top == null ? this.groundY - 24 : lane.data.top, x = Math.round(lane.x), w = lane.w, h = this.H - top;
      if (lane.warning) {
        // dithered 25 % stripe + a ⚠ that blinks (steady with Reduce Motion)
        ctx.fillStyle = '#ff7a1a';
        for (let yy = top; yy < this.H; yy += 2) for (let xx = x + ((yy >> 1) & 1) * 2; xx < x + w; xx += 4) ctx.fillRect(xx, yy, 1, 1);
        ctx.fillStyle = INK; ctx.fillRect(x, top, w, 1); ctx.fillRect(x, top, 1, h); ctx.fillRect(x + w - 1, top, 1, h);
        if (AG.reducedMotion() || Math.floor(t * 4) % 2 === 0) AG.gfx.drawIcon(ctx, 'warning', x + w / 2 - 9, top - 22, 1);
        return;
      }
      if (lane.data.art) { AG.assets.draw(ctx, lane.data.art, x, top, w, h, Math.floor(t * 6) % (lane.data.frames || 1)); return; }
      ctx.fillStyle = '#7e3f22'; ctx.fillRect(x, top, w, h);
      ctx.fillStyle = '#b86b3c';
      const off = AG.reducedMotion() ? 0 : Math.floor(t * 30) % 8;
      for (let yy = top + 2; yy < this.H; yy += 6) for (let xx = x + ((yy + off) % 8); xx < x + w - 3; xx += 8) ctx.fillRect(xx, yy, 4, 2);
      ctx.fillStyle = INK; ctx.fillRect(x, top, w, 1);
    }
    /** Shield bracket and magnet ring around the player (the game's HUD lists them too). */
    drawPower(ctx, t) {
      const m = this.mover, b = m.hitbox(), cx = m.px;
      if (this.power.active('magnet')) {
        const r = this.power.magnetRadius, cy = Math.round(b.y + b.h / 2);
        ctx.fillStyle = '#c4b5ff';
        for (let a = 0; a < 48; a++) { const an = a / 48 * Math.PI * 2 + (AG.reducedMotion() ? 0 : t * 0.5); const yy = cy + Math.sin(an) * r; if (yy < this.groundY) ctx.fillRect(Math.round(cx + Math.cos(an) * r), Math.round(yy), 2, 2); }
      }
      if (this.power.active('shield')) {
        ctx.fillStyle = '#6ed8ff';
        const x0 = Math.round(b.x) - 6, x1 = Math.round(b.x + b.w) + 4, y0 = Math.round(b.y) - 14;
        ctx.fillRect(x0, y0, 2, b.h + 12); ctx.fillRect(x1, y0, 2, b.h + 12); ctx.fillRect(x0, y0, 6, 2); ctx.fillRect(x1 - 4, y0, 6, 2);
      }
    }
    drawFx(ctx, f) {
      const p = f.t / f.ms, n = AG.reducedMotion() ? 2 : 4;
      ctx.fillStyle = f.type === 'catch' ? '#ffd23f' : f.type === 'block' ? '#6ed8ff' : f.type === 'hit' ? '#ff4f6d' : '#a9b1d6';
      for (let i = 0; i < n; i++) {
        const an = i / n * Math.PI * 2 + (f.type === 'land' ? Math.PI : 0), d = Math.round(2 + p * f.size * 0.6);
        const yy = f.type === 'land' ? f.y - 2 - Math.round(Math.abs(Math.sin(an)) * d * 0.5) : f.y + Math.round(Math.sin(an) * d);
        ctx.fillRect(f.x + Math.round(Math.cos(an) * d) - 1, yy, 2, 2);
      }
    }
  }

  AG.falling = Object.assign(AG.falling || {}, { FallingField, circleRect });
})(window.AG);
