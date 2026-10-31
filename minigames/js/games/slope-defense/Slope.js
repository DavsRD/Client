/* 04 Slope Defense: the pure model, no DOM, so a bot (kalasag-dev/minigames/tests/slope-defense.test.js) plays whole levels with it.
 *   rules   rain bands, spawn rate, stars, score, badges, the reticle step, sign facts.
 *   SlopeSim  one wave: BUILD (defenses, budget, refunds) then RAIN (a sim Timeline, mud PathFollowers, signs, big slides, villagers).
 *   LevelRun  the waves of a level: trees and other defenses persist, trees grow after each rain, budget carries over.
 * Built on the E7 sim engine (AG.logic.sim). Numbers come from tuning.js, levels from levels.json. */
(function (root) {
  const AG = root.AG = root.AG || {};
  AG.logic = AG.logic || {};
  const SD = AG.slopeDefense = AG.slopeDefense || {};
  const S = () => AG.logic.sim, T = () => SD.tuning;
  const en = t => ({ en: t });

  /* ---------- pure rules ---------- */
  const BANDS = ['yellow', 'orange', 'red'];
  const bandOf = p => (p < T().bands[0] ? 0 : p < T().bands[1] ? 1 : 2);
  /** Mud units per second on one path: a trickle at first, a flood at the top of the red band (so slowing the mud cuts what arrives in time). */
  const spawnRate = (rain, lv, diff) => (T().mud.rMin + (T().mud.rMax - T().mud.rMin) * Math.pow(rain, 4)) * (lv.spawn || 1) * T().diff[diff].spawn;
  const treeSlow = stage => T().tree.slow[Math.max(0, Math.min(2, stage))];
  const housesNeeded = (total, pct) => Math.ceil(total * pct / 100 - 1e-9);
  /** "Good call": the alert is high, or it is not yet RED. Never negative: evacuating at 0 % is fine too. */
  const goodCall = (alert, rain) => alert >= T().alert.good || rain < T().bands[1];
  /** a = totals over the waves: { safe, total, intact, houses, signsReported, signsTotal, evacBeforeFirst }. */
  function stars(a, lv) {
    const s1 = a.total > 0 && a.safe === a.total;
    const s2 = s1 && a.intact >= housesNeeded(a.houses, lv.housesTarget);
    const s3 = s2 && a.signsReported === a.signsTotal && (!lv.evacBeforeFirst || !!a.evacBeforeFirst);
    return s3 ? 3 : s2 ? 2 : s1 ? 1 : 0;
  }
  const score = (a, budgetLeft, good) => a.safe * T().score.safe + a.intact * T().score.house + a.signsReported * T().score.sign + Math.max(0, budgetLeft) + (good ? T().score.goodCall : 0);
  /** Updates the badge record q and returns the badge ids won now. o: { fullTrees (grown this level), signs (reported), early (evacuated before ORANGE), level, won }. */
  function badges(q, o) {
    const ev = [];
    q.fullTrees = (q.fullTrees || 0) + (o.fullTrees || 0); q.signs = (q.signs || 0) + (o.signs || 0); q.early = q.early || {};
    if (q.fullTrees >= T().badges.fullTrees && !q.gotGreen) { q.gotGreen = true; ev.push('green-slope'); }
    if (q.signs >= T().badges.signs && !q.gotEagle) { q.gotEagle = true; ev.push('eagle-eye'); }
    if (o.won) q.early[o.level] = !!o.early;
    if ([1, 2, 3, 4, 5].every(l => q.early[l]) && !q.gotBird) { q.gotBird = true; ev.push('early-bird'); }
    return ev;
  }
  /** The lookout reticle: r = { x, y, hold } moves 150 px/s, ramping to 300 while a key is held; Shift = 60. dx, dy in -1..1. */
  function reticleStep(r, dx, dy, fine, dt, W, H) {
    const R = T().reticle;
    if (!dx && !dy) { r.hold = 0; return r; }
    r.hold = (r.hold || 0) + dt;
    const v = fine ? R.fine : Math.min(R.max, R.speed + R.accel * r.hold), n = Math.hypot(dx, dy) || 1;
    r.x = Math.max(0, Math.min((W || T().W) - 1, r.x + dx / n * v * dt));
    r.y = Math.max(0, Math.min((H || T().H) - 1, r.y + dy / n * v * dt));
    return r;
  }
  const tileOf = (x, y) => ({ tx: Math.max(0, Math.min(T().cols - 1, Math.floor(x / T().tile))), ty: Math.max(0, Math.min(T().rows - 1, Math.floor(y / T().tile))) });
  const tileCentre = (tx, ty) => ({ x: tx * T().tile + T().tile / 2, y: ty * T().tile + T().tile / 2 });

  const FACTS = {
    crack: en('New cracks in the ground or on a wall? The soil may be moving. Tell an adult!'),
    tilt_tree: en('A tree that starts to lean is a warning: the ground under it is creeping.'),
    tilt_post: en('Fence posts and poles that tilt mean the slope is moving. Tell an adult.'),
    muddy_creek: en('Sudden muddy water in the creek? Soil upstream may be sliding. Move to safety.'),
    rumble: en('A rumbling sound from the hill is a danger sign. Do not wait: move away!')
  };

  /* ---------- one wave ---------- */
  class SlopeSim extends S().Emitter {
    /** lv = a levels.json entry; o: { diff, seed, wave, budget, persist: { built, found } (shared by the waves) }. */
    constructor(lv, o) {
      super();
      o = o || {};
      const t = T();
      this.lv = lv; this.diff = o.diff === 'advanced' ? 'advanced' : 'easy'; this.D = t.diff[this.diff]; this.wave = o.wave || 1; this.waves = lv.waves || 1; this.seed = o.seed || 1;
      const keep = e => !e.only || e.only === this.diff;
      this.pathDefs = lv.paths.filter(keep);
      this.houses = lv.houses.filter(keep).map(h => Object.assign({}, h, { mud: 0, muddy: false, damaged: false, protectedBy: null }));
      this.slots = lv.buildSlots.filter(keep).map(s => Object.assign({ w: 30, h: 30 }, s));
      this.canalSlots = lv.canalSlots.filter(keep).map(s => Object.assign({ w: 30, h: 30, canal: true }, s));
      this.allSlots = this.slots.concat(this.canalSlots);
      this.options = lv.options.map(id => t.options.find(op => op.id === id));
      this.persist = o.persist || { built: {}, found: [false, false, false] };
      this.budget = o.budget != null ? o.budget : Math.round(lv.budget * this.D.budget);
      this.polys = {}; this.pathDefs.forEach(p => { this.polys[p.id] = S().polyline(p.pts.map(([x, y]) => ({ x, y }))); });
      this.built = new Map();
      Object.keys(this.persist.built).forEach(id => { if (this.slot(id)) this.built.set(id, Object.assign({}, this.persist.built[id])); });
      this.phase = 'build'; this.rain = 0; this.alert = 0; this.signs = []; this.fronts = []; this.villagers = []; this.arrived = 0;
      this.evac = null; this.slidesStarted = 0; this.slideDefs = []; this.tail = 0; this.ended = false; this.firstSlideAt = null;
      this.limit = (lv.mudLimit && lv.mudLimit[this.diff]) || T().mud.houseLimit;
    }
    slot(id) { return this.allSlots.find(s => s.id === id) || null; }
    optionOf(id) { return this.options.find(op => op.id === id) || null; }

    /* ----- BUILD ----- */
    /** true, or the reason ({ en }) the option can't go on that slot now. */
    canBuild(slotId, opId) {
      const s = this.slot(slotId), op = this.optionOf(opId), have = this.built.get(slotId);
      if (this.phase !== 'build') return en('You can only build before the rain.');
      if (!s) return en('No build spot there.');
      if (!op) return en('Not on this level.');
      if (!!s.canal !== (opId === 'canal')) return en(s.canal ? 'Canals go on the upper slope spot.' : 'Canals go on the upper slope spots.');
      if (opId === 'wall' && this.polys[s.path].project(s.x, s.y).d > T().wall.reach) return en('Walls go right beside the mud path.');
      const refund = have ? this.optionOf(have.op).cost : 0;
      if (have && have.op === opId) return en('Already built here.');
      if (this.budget + refund < op.cost) return en('Not enough coins.');
      return true;
    }
    build(slotId, opId) {
      const r = this.canBuild(slotId, opId);
      if (r !== true) return r;
      const have = this.built.get(slotId), op = this.optionOf(opId);
      if (have) this.budget += this.optionOf(have.op).cost;
      this.budget -= op.cost;
      this.built.set(slotId, { op: opId, stage: 0 });
      this.emit('build', { slot: slotId, op: opId });
      return true;
    }
    /** Removal during BUILD refunds 100 %. */
    remove(slotId) {
      const have = this.built.get(slotId);
      if (!have || this.phase !== 'build') return false;
      this.budget += this.optionOf(have.op).cost; this.built.delete(slotId);
      this.emit('remove', { slot: slotId, op: have.op });
      return true;
    }
    count(op, stage) { let n = 0; this.built.forEach(b => { if (b.op === op && (stage == null || b.stage === stage)) n++; }); return n; }

    /* ----- RAIN ----- */
    start() {
      if (this.phase !== 'build') return false;
      const t = T(), lv = this.lv, D = this.D;
      this.phase = 'rain'; this.dur = lv.rainMs / D.esc;
      this.followers = new (S().PathFollowers)({ speed: t.mud.speed * D.mud, dps: 0, spacing: t.mud.spacing });
      this.pathDefs.forEach(p => this.followers.addPath(p.id, p.pts.map(([x, y]) => ({ x, y }))));
      this.acc = {}; this.pathDefs.forEach(p => { this.acc[p.id] = 0; });
      this.canals = {};
      this.built.forEach((b, id) => {
        const s = this.slot(id);
        if (b.op === 'tree') this.followers.addSlowZone({ id, x: s.x, y: s.y, r: t.tree.r, mul: 1 - treeSlow(b.stage) });
        else if (b.op === 'vetiver') this.followers.addSlowZone({ id, x: s.x, y: s.y, r: t.vetiver.r, mul: 1 - t.vetiver.slow });
        else if (b.op === 'canal') this.canals[s.path] = true;
        else if (b.op === 'wall') {
          const hit = this.polys[s.path].project(s.x, s.y);
          b.blocker = this.followers.addBlocker({ id, path: s.path, s: hit.s, x: s.x, y: s.y, hp: t.wall.hp });
        }
      });
      this.followers.on('blocked', e => this.absorb(e.unit, e.blocker));
      this.followers.on('arrive', u => this.reach(u));
      this.tl = new (S().Timeline)({ duration: this.dur });
      this.tl.add({ at: this.dur * t.bands[0], fn: () => this.emit('band', 1) });
      this.tl.add({ at: this.dur * t.bands[1], fn: () => this.emit('band', 2) });
      this.slideDefs = lv.bigSlides.filter(b => (b.wave || 1) === this.wave).map(b => ({ at: b.atPct * this.dur, paths: b.paths.filter(id => this.polys[id]), done: false }));
      this.slideDefs.forEach(d => this.tl.add({ at: d.at, fn: () => this.startSlide(d) }));
      this.firstSlideAt = this.slideDefs.length ? Math.min(...this.slideDefs.map(d => d.at)) : null;
      this.makeSigns();
      this.makeVillagers();
      this.emit('band', 0);
      this.emit('start', this);
      return true;
    }
    makeSigns() {
      const t = T().signs, lv = this.lv, rng = AG.util.mulberry32(this.seed * 977 + lv.level * 101 + this.wave * 7919), vis = t.visible[this.diff];
      this.signs = [];
      if (!lv.signs) return;
      let at = t.startMs, prev = null;
      while (at + vis <= this.dur - 500) {
        let pick = null;
        for (let k = 0; k < 8 && !pick; k++) {
          const pid = this.pathDefs[Math.floor(rng() * this.pathDefs.length)].id, poly = this.polys[pid];
          const p = poly.at(poly.length * (t.reach[0] + rng() * (t.reach[1] - t.reach[0]))), side = rng() < 0.5 ? -1 : 1;
          const x = Math.max(16, Math.min(T().W - 16, p.x - p.dy * side * t.off)), y = Math.max(34, Math.min(222, p.y + p.dx * side * t.off));
          if (!this.signs.some(o => o.at + vis > at && Math.hypot(o.x - x, o.y - y) < 34)) pick = { path: pid, x: Math.round(x), y: Math.round(y) };
        }
        if (pick) {
          let type = t.types[Math.floor(rng() * t.types.length)];
          if (type === prev) type = t.types[(t.types.indexOf(type) + 1) % t.types.length];
          prev = type;
          this.signs.push(Object.assign({ id: 'sg' + this.signs.length, type, at, state: 'pending', vis }, pick));
        }
        at += t.every[0] + rng() * (t.every[1] - t.every[0]);
      }
      this.signs.forEach(s => this.tl.add({ at: s.at, fn: () => { s.state = 'visible'; this.emit('sign', s); } }));
    }
    makeVillagers() {
      const lv = this.lv, ev = lv.evacRoute.map(([x, y]) => ({ x, y }));
      ev.push({ x: lv.safeZone.x, y: ev[ev.length - 1].y });
      this.route = S().polyline(ev);
      this.houses.forEach(h => { h.s0 = this.route.project(h.x, h.y + 14).s; });
      const far = Math.max(...this.houses.map(h => this.route.length - h.s0));
      this.walk = far / (T().evacMs / 1000);                                  // px/s: the longest walk takes evacMs, for everybody
      this.villagers = [];
      this.houses.forEach(h => { for (let i = 0; i < h.people; i++) this.villagers.push({ id: h.id + 'v' + i, house: h.id, i, state: 'home', s: h.s0 + i * 0, x: Math.round(h.x - (h.people - 1) * 5 + i * 10), y: 262 - (i % 2) * 3 }); });
    }
    house(id) { return this.houses.find(h => h.id === id); }
    houseOf(pathId) { return this.houses.find(h => h.path === pathId); }

    /** A mud unit hit a wall: the wall takes 1 HP and the unit stops there. */
    absorb(u, b) {
      this.followers.remove(u);
      b.hp -= 1;
      if (b.hp <= 0) { this.followers.removeBlocker(b); const e = this.built.get(b.id); if (e) e.broken = true; this.emit('break', b); }
      else this.emit('absorb', b);
    }
    /** A mud unit reached the end of its path: the house takes a splash; at the limit it is MUDDY. */
    reach(u) {
      const h = this.houseOf(u.path);
      if (!h) return;
      this.arrived++; h.mud++;
      if (h.mud >= this.limit && !h.muddy) { h.muddy = true; this.emit('muddy', h); } else this.emit('splash', h);
    }
    wallOn(pathId) { let best = null; this.followers.blockers.forEach(b => { if (b.at[pathId] != null && b.hp > 0 && (!best || b.at[pathId] < best.at[pathId])) best = b; }); return best; }

    startSlide(def) {
      def.started = true; this.slidesStarted++;
      def.paths.forEach(pid => this.fronts.push({ path: pid, s: 0, state: 'run', def }));
      this.emit('slide', def);
    }
    updateFronts(dt) {
      this.fronts.forEach(f => {
        if (f.state !== 'run') return;
        const poly = this.polys[f.path], wall = this.wallOn(f.path), h = this.houseOf(f.path);
        f.s += T().mud.slideSpeed * dt;
        if (wall && f.s >= wall.at[f.path]) {
          f.state = 'held'; f.s = wall.at[f.path]; wall.hp = Math.min(wall.hp, Math.max(1, Math.floor(T().wall.hp / 2))); wall.hit = true;
          if (h) h.protectedBy = wall.id;
          this.emit('held', { path: f.path, wall });
        } else if (f.s >= poly.length) {
          f.state = 'hit'; f.s = poly.length;
          if (h) {
            h.damaged = true;
            // villagers of that house who are not safe yet wait to be rescued later: never hurt
            this.villagers.forEach(v => { if (v.house === h.id && (v.state === 'home' || v.state === 'walking')) { v.state = 'waiting'; this.emit('waiting', v); } });
            this.emit('damaged', h);
          }
        }
      });
      if (this.slidesStarted === this.slideDefs.length && this.fronts.every(f => f.state !== 'run')) this.tail += dt * 1000;
    }

    /** E = EVACUATE. Early is never wrong. → { good } or null (already called / not raining). */
    evacuate() {
      if (this.phase !== 'rain' || this.evac) return null;
      const good = goodCall(this.alert, this.rain);
      this.evac = { at: this.tl.t, rain: this.rain, good, beforeFirst: this.firstSlideAt == null || this.tl.t <= this.firstSlideAt };
      this.villagers.forEach(v => { if (v.state === 'home') v.state = 'walking'; });
      this.emit('evacuate', this.evac);
      return this.evac;
    }
    /** Reports a visible sign. → the sign, or null. */
    report(id) {
      const s = this.signs.find(x => x.id === id);
      if (!s || s.state !== 'visible' || this.phase !== 'rain') return null;
      s.state = 'reported'; this.alert = Math.min(100, this.alert + T().alert.add);
      this.emit('report', s);
      return s;
    }
    visibleSigns() { return this.signs.filter(s => s.state === 'visible'); }

    update(dt) {
      if (this.phase !== 'rain' || !(dt > 0)) return this;
      const t = T();
      this.tl.update(dt);
      this.rain = this.tl.progress;
      this.pathDefs.forEach(p => {
        this.acc[p.id] += spawnRate(this.rain, this.lv, this.diff) * (this.canals[p.id] ? 1 - t.canal.cut : 1) * dt;
        while (this.acc[p.id] >= 1) { this.acc[p.id] -= 1; this.followers.spawn({ path: p.id }); }
      });
      this.followers.update(dt);
      this.signs.forEach(s => { if (s.state === 'visible' && this.tl.t >= s.at + s.vis) { s.state = 'missed'; this.emit('missed', s); } });
      this.updateFronts(dt);
      this.villagers.forEach(v => {
        if (v.state !== 'walking') return;
        v.s = Math.min(this.route.length, (v.s || 0) + this.walk * dt);
        const p = this.route.at(v.s); v.x = p.x + (v.i % 2) * 0; v.y = p.y + 2 - (v.i % 2) * 3;
        if (v.s >= this.route.length) { v.state = 'safe'; this.emit('safe', v); }
      });
      if (!this.ended && this.slidesStarted === this.slideDefs.length && this.tail >= t.slideTailMs) this.finish();
      return this;
    }
    finish() {
      if (this.ended) return;
      this.ended = true; this.phase = 'done';
      this.villagers.forEach(v => { if (v.state !== 'safe') v.state = 'waiting'; });
      this.emit('end', this.result());
    }
    /** After the rain every tree is one stage older: sapling → young → full. */
    grow() { this.built.forEach(b => { if (b.op === 'tree') b.stage = Math.min(2, b.stage + 1); }); }

    result() {
      const houses = this.houses.length, intact = this.houses.filter(h => !h.damaged && !h.muddy).length;
      const safe = this.villagers.filter(v => v.state === 'safe').length;
      return {
        wave: this.wave, safe, total: this.villagers.length, intact, houses,
        signsReported: this.signs.filter(s => s.state === 'reported').length, signsTotal: this.signs.filter(s => s.state !== 'pending').length,
        good: !!(this.evac && this.evac.good), called: !!this.evac, evacRain: this.evac ? this.evac.rain : null, evacBeforeFirst: !!(this.evac && this.evac.beforeFirst),
        budget: this.budget, fullTrees: this.count('tree', 2)
      };
    }
  }

  /* ---------- the waves of a level ---------- */
  class LevelRun {
    constructor(lv, o) {
      o = o || {};
      this.lv = lv; this.o = o; this.diff = o.diff === 'advanced' ? 'advanced' : 'easy'; this.seed = o.seed || 1;
      this.persist = { built: {}, found: [false, false, false] };
      this.wave = 0; this.results = []; this.budget = null; this.sim = null;
    }
    get waves() { return this.lv.waves || 1; }
    get finished() { return this.results.length >= this.waves; }
    /** A fresh SlopeSim for the next wave: the defenses stay, the budget carries over (plus the wave top-up). */
    next() {
      this.wave++;
      const D = T().diff[this.diff];
      this.budget = this.budget == null ? Math.round(this.lv.budget * D.budget) : this.budget + Math.round((this.lv.waveBudget || 0) * D.budget);
      this.sim = new SlopeSim(this.lv, { diff: this.diff, seed: this.seed, wave: this.wave, budget: this.budget, persist: this.persist });
      return this.sim;
    }
    /** Call when the wave ends: keeps the defenses (a broken wall is gone), grows the trees, remembers the result. */
    endWave() {
      const sim = this.sim;
      sim.grow();
      const r = sim.result();
      this.persist.built = {};
      sim.built.forEach((b, id) => { if (!b.broken) this.persist.built[id] = { op: b.op, stage: b.stage }; });
      this.budget = sim.budget; this.results.push(r);
      return r;
    }
    totals() {
      const a = { safe: 0, total: 0, intact: 0, houses: 0, signsReported: 0, signsTotal: 0, evacBeforeFirst: this.results.length > 0, good: this.results.length > 0, called: this.results.length > 0, fullTrees: 0 };
      this.results.forEach(r => {
        a.safe += r.safe; a.total += r.total; a.intact += r.intact; a.houses += r.houses; a.signsReported += r.signsReported; a.signsTotal += r.signsTotal;
        a.evacBeforeFirst = a.evacBeforeFirst && r.evacBeforeFirst; a.good = a.good && r.good; a.called = a.called && r.called;
      });
      const last = this.results[this.results.length - 1];
      a.fullTrees = last ? last.fullTrees : 0;
      return a;
    }
  }

  Object.assign(SD, { SlopeSim, LevelRun, FACTS });
  SD.rules = { BANDS, bandOf, spawnRate, treeSlow, housesNeeded, goodCall, stars, score, badges, reticleStep, tileOf, tileCentre };
  if (typeof module !== 'undefined') module.exports = SD.rules;
})(typeof window !== 'undefined' ? window : globalThis);
