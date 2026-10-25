/* Ashfall: the rules of one level, with no drawing (so a bot can play it in kalasag-dev/minigames/tests/). It owns the E4
 * FallingField and keeps what the field leaves to the game: score, hearts, wave clears, wave orders, the lahar flows (L4, L5),
 * the three family photos and the evacuation dash (L5). new AG.ashfall.Run({ level, difficulty, seed, mover, on }); run.update(dt).
 * Events (all optional): wave catch hit block heart power collect order orderNew maskOn lane evac evacLate board end. */
window.AG = window.AG || {};
(function (AG) {
  const A = AG.ashfall, T = A.tuning;

  class Run {
    constructor(o) {
      const lv = this.lv = o.level;
      this.diff = o.difficulty === 'advanced' ? 'advanced' : 'easy';
      this.on = o.on || {}; this.mover = o.mover || null;
      this.rng = AG.util.mulberry32((o.seed >>> 0) ^ 0x5bd1e995);
      this.maxHearts = T.hearts[this.diff]; this.hearts = this.maxHearts;
      this.score = 0; this.time = 0; this.waveIx = -1; this.alert = lv.waves[0].alert;
      this.waves = A.buildWaves(lv, this.diff);
      this.orderDone = this.waves.map(w => !w.order); // a wave without an order has nothing to complete
      this.stats = { masks: 0, caught: 0, orders: 0, photos: 0, hits: 0, laharHits: 0, waves: 0 };
      this.photos = [false, false, false]; this.photoSpawns = 0;
      this.maskOn = false; this.timers = []; this.phase = 'waves'; this.evac = null; this.over = false; this.won = false;
      const L = T.lahar, lane = lv.laharSide ? [{ id: 'lahar', x: lv.laharSide === 'left' ? 0 : T.width - L.w, w: L.w, top: T.groundY, art: 'ashfall.lahar.flow', frames: 4, warnMs: L.warnMs, activeMs: L.activeMs }] : [];
      const ev = (name, ...a) => { const f = this.on[name]; if (f) f(...a); };
      this.emit = ev;
      this.field = new AG.falling.FallingField({
        defs: A.defs(this.diff), waves: this.waves, mover: this.mover, seed: o.seed, cooldown: { powerup: T.powerCooldownMs },
        hitGraceMs: T.hitGraceMs, lanes: lane,
        onWave: (w, i) => this.onWave(w, i),
        onSpawn: ob => { if (ob.id === 'photo') ob.photoIx = this.photoSpawns++; },
        onCatch: (ob, r) => this.onCatch(ob, r),
        onHit: (src, r) => this.onHit(src, r),
        onPower: kind => ev('power', kind),
        onCollect: ob => { this.photos[ob.photoIx] = true; this.stats.photos++; ev('collect', ob, ob.photoIx); },
        onOrder: (order, done) => this.onOrder(order, done),
        onLane: (l, st) => ev('lane', l, st),
        onDone: () => this.onDone()
      });
      lv.photoTimesMs.forEach(ms => this.field.schedule(ms, 'photo', { x: 90 + Math.floor(this.rng() * 300) }));
    }

    after(ms, fn) { this.timers.push({ at: this.time + ms, fn }); }
    get ordersAll() { return this.orderDone.every(Boolean); }
    get hasLahar() { return !!this.lv.laharSide; }

    /* ---------- the field's callbacks ---------- */
    onWave(w, i) {
      if (i > 0) this.clearWave(i - 1);
      this.waveIx = i; this.alert = w.alert;
      this.emit('wave', w, i);
      if (this.hasLahar && (this.lv.laharWaves || []).includes(i)) this.after(T.lahar.offsetMs, () => this.field.triggerLane('lahar'));
    }
    clearWave(i) { this.score += T.waveBonus; this.stats.waves++; this.emit('waveClear', i, T.waveBonus); }
    onCatch(ob, r) {
      this.score += r.points; this.stats.caught++;
      if (ob.id === 'mask') { this.stats.masks++; if (!this.maskOn) { this.maskOn = true; this.emit('maskOn'); } }
      this.emit('catch', ob, r);
    }
    onHit(src, r) {
      if (r.shielded) return this.emit('block', src);
      const lane = !!src && !src.def; // a lane hazard has no object def
      this.stats.hits++; if (lane) this.stats.laharHits++;
      this.emit('hit', src, lane ? 'lahar' : src && src.id);
      this.loseHeart();
    }
    onOrder(order, done) {
      if (!done) return;
      this.score += order.bonus; this.stats.orders++; this.orderDone[this.waveIx] = true;
      this.emit('order', order);
      const next = A.nextOrder(this.waves[this.waveIx].table, this.field.defs, this.rng);
      if (next) { order.renew(next); this.emit('orderNew', order); }
    }
    loseHeart() {
      this.hearts = Math.max(0, this.hearts - 1);
      this.emit('heart', this.hearts);
      if (!this.hearts) this.finish(false);
    }
    onDone() {
      this.clearWave(this.waves.length - 1);
      if (this.lv.evac) this.startDash();
      else { this.settle(); this.after(600, () => this.finish(true)); }
    }
    /** The level is decided: no more debris or flows, and the player is left to walk and cheer. */
    settle() { this.field.clear(); this.field.stop(); this.field.lanes.forEach(l => l.stop()); }

    /* ---------- the evacuation dash (L5) ---------- */
    startDash() {
      const right = this.lv.laharSide === 'left' || !this.lv.laharSide; // the bus waits at the edge away from the lahar
      const ms = T.evac.timeMs[this.diff];
      this.phase = 'dash';
      this.evac = { side: right ? 'right' : 'left', totalMs: ms, left: ms, late: 0, bonus: 0, secsLeft: 0 };
      this.field.spawner.intervalMul = T.evac.intervalMul; // twice the debris
      this.emit('evac', this.evac);
    }
    /** Where the bus stands: its left edge, and the x the player must reach (inside its door end). */
    busX() { return this.evac.side === 'right' ? T.width - T.bus.w : 0; }
    doorX() { return this.evac.side === 'right' ? T.width - T.bus.w + T.bus.door : T.bus.w - T.bus.door; }
    reached() { const x = this.mover.x; return this.evac.side === 'right' ? x >= this.doorX() : x <= this.doorX(); }
    updateDash(ms) {
      const e = this.evac;
      if (this.reached()) return this.board();
      e.left -= ms;
      if (e.left > 0) return;
      e.late++; e.left = T.evac.extraMs; e.totalMs = T.evac.extraMs; // too slow: a heart, and the bus waits 3 s more
      this.emit('evacLate', e);
      this.loseHeart();
    }
    board() {
      const e = this.evac;
      e.secsLeft = Math.floor(e.left / 1000); e.leftMs = e.left; e.bonus = A.scoring.evacBonus(e.secsLeft);
      this.score += e.bonus; this.phase = 'board';
      this.settle();
      if (this.mover) this.mover.enabled = false;
      this.emit('board', e);
      this.after(T.evac.boardMs, () => this.finish(true));
    }

    /* ---------- running ---------- */
    update(dt) {
      if (this.over) return;
      const ms = dt * 1000;
      this.time += ms;
      this.field.update(dt);
      if (!this.field.running && this.mover) this.mover.update(dt); // the field no longer moves the player
      if (this.phase === 'dash' && !this.over) this.updateDash(ms);
      for (const t of this.timers.filter(t => t.at <= this.time)) { this.timers.splice(this.timers.indexOf(t), 1); if (!this.over) t.fn(); }
    }
    finish(won) {
      if (this.over) return;
      this.over = true; this.won = won; this.phase = 'ended';
      this.settle();
      this.emit('end', won);
    }
    /** Score, stars and what the results screen lists. */
    result() {
      const tg = A.scoring.targets(this.lv, this.diff), won = this.won;
      const stars = A.scoring.stars({ completed: won, score: this.score, target2: tg.target2, target3: tg.target3, ordersAll: this.ordersAll });
      return { won, stars, score: this.score, hearts: this.hearts, stats: this.stats, photos: this.photos.slice(), ordersAll: this.ordersAll, bestCombo: this.field.combo.best, secsLeft: this.evac ? this.evac.secsLeft : 0, target2: tg.target2, target3: tg.target3 };
    }
  }

  A.Run = Run;
})(window.AG);
