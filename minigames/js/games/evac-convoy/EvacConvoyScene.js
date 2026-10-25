/* Evac Convoy: one run of a level. new AG.evacConvoy.Scene(stage, ctx, { onEnd(run) }).mount() builds the
 * 480 × 270 canvas (a 10 px band over the 24 × 13 map), drives the snake-mode GridMover, floods rows with
 * Surge.js, runs the end-of-level Headcount.js and calls onEnd(run); index.js turns run into done().
 * Keys: arrows / WASD turn, Space or Enter counts. Touch: swipe, the D-pad, tap the counter. Numbers: tuning.js. */
window.AG = window.AG || {};
(function (AG) {
  const { h } = AG.util;
  const EC = AG.evacConvoy, T = EC.tuning, R = EC.rules;
  const S = en => ({ en });
  const TILE = T.tile, BAND = T.hudBand, INK = '#1e1538';
  const K = n => 'evac-convoy.' + n;
  const OPP = { up: 'down', down: 'up', left: 'right', right: 'left' };
  const SEG = { 'down,up': 'seg_v', 'left,right': 'seg_h', 'right,up': 'seg_corner_ne', 'left,up': 'seg_corner_nw', 'down,right': 'seg_corner_se', 'down,left': 'seg_corner_sw' };
  const dirTo = (a, b) => (b.x > a.x ? 'right' : b.x < a.x ? 'left' : b.y > a.y ? 'down' : b.y < a.y ? 'up' : null);

  const STR = {
    score: S('Score'), saved: S('Saved'),
    load: S('Load'), pulse: S('Pulse'),
    start: S('Press an arrow key or swipe to drive'), again: S('Press an arrow to drive'),
    full: S('Convoy full — go to the center!'),
    prio: S('Seniors, mothers-to-be, people with disabilities and young children need help first. Good choice!'),
    prioWait: S('Help those who need it first! Someone with a gold ring is still waiting.'),
    warn: S('Surge warning! The shaded row floods in 3 seconds — stay away from it!'),
    warnCaption: S('🔊 Surge alarm: the shaded row floods in 3 seconds'),
    closeWarn: S('Road closing ahead! Look for another way.'),
    closeCaption: S('🔊 Whistle: a road is about to close'),
    firstPulse: S('The surge just flooded a row. Flooded roads are closed — never drive into floodwater.'),
    stranded: S('Families left behind climb onto their roofs and wait for boat rescue. They are safe, but leaving early is the best plan.'),
    roofs: S('Waiting for boat rescue'),
    crash: {
      wall: S('Oops! Stay on the road. Your families went back to their houses — try again.'),
      closed: S('That road is closed. Look for another way around!'),
      flood: S('That road is flooded. Never drive into floodwater — go around!'),
      self: S("Careful — don't turn into your own convoy. Your families went back to their houses."),
      surge: S('The surge caught up with the convoy! Watch the shaded row and leave early.')
    },
    finalSurge: S('The surge reached the final row!'),
    finalSurgeSub: S('Boats will help the families still waiting.'),
    allIn: S('Every reachable family is safe!'),
    heartsOut: S('No hearts left — the convoy needs a rest.'),
    countTitle: S('Headcount!'), countSub: S('Count each person who walks into the center'),
    countHelp: S('Press Space (or tap the counter) once for each person who goes in.'),
    countNow: S('Count'), recount: S('Let us count again'),
    madeIt: S('Everyone made it!'),
    madeItSay: S('Everyone made it! A headcount makes sure no one is left behind.'),
    recountSay: S('Not quite — let us recount together. A careful headcount keeps everyone safe.'),
    counter: S('Tap here for each person')
  };
  EC.STR = STR;

  /* ---------- styles, once per page (all under #ag-app, classes ec-) ---------- */
  const CSS = `
#ag-app .ec { display: grid; gap: 8px; justify-items: center; width: 100%; }
#ag-app .ec .ag-canvas { width: 100%; touch-action: none; }
#ag-app .ec-tools { display: flex; flex-wrap: wrap; gap: 8px 14px; justify-content: center; align-items: center; min-height: 36px; }
#ag-app .ec-caption { min-height: 1.4em; font-weight: 800; text-align: center; }
#ag-app .ag-hud:has(.ec-driver) { position: relative; padding-right: 72px; min-height: 64px; }
#ag-app .ec-driver { position: absolute; right: 8px; top: 50%; transform: translateY(-50%); width: 48px; height: 48px; border: 2px solid var(--ink); background: var(--sky); overflow: hidden; display: grid; place-items: end center; }
#ag-app .ec-driver img { width: 48px; height: auto; }
#ag-app .ec-count { display: grid; gap: 4px; justify-items: center; }
#ag-app .ec-count[hidden] { display: none; }
#ag-app .ec-counter { min-width: 240px; min-height: 84px; display: grid; justify-items: center; gap: 0; touch-action: manipulation; }
#ag-app .ec-counter b { font-family: var(--font-display); font-size: 2.6rem; line-height: 1; }
#ag-app .ec-counter small { font-weight: 800; }
#ag-app .ec-counter.is-bump b { animation: ec-bump .18s ease-out; }
@keyframes ec-bump { from { transform: scale(1.35); } to { transform: scale(1); } }
@media (prefers-reduced-motion: reduce) { #ag-app .ec-counter.is-bump b { animation: none; } }`;
  function injectCss() {
    if (!document.querySelector('style[data-ag-css="evac-convoy"]')) document.head.append(h('style', { 'data-ag-css': 'evac-convoy' }, CSS));
  }

  class Scene {
    constructor(stage, ctx, o) {
      injectCss();
      this.stage = stage; this.ctx = ctx; this.onEnd = o.onEnd;
      this.adv = ctx.difficulty === 'advanced';
      this.reduce = AG.reducedMotion();
      this.offs = []; this.fx = []; this.greys = {}; this.icons = {}; this.warnCache = {};
      this.dead = false; this.ended = false; this.phase = 'load';
      this.time = 0; this.clock = 0; this.started = false;
    }

    /* ---------- set-up ---------- */
    async mount() {
      const ctx = this.ctx;
      let entry = ctx.levelData;
      if (!entry || entry.pending) {
        const templates = await AG.data.load('evac-convoy', 'data/templates.json');
        if (this.dead) return;
        entry = EC.dailyBuild(entry || EC.generateDaily(ctx.seed), templates);
      }
      this.setup(entry);
      this.buildDom();
      this.buildMap();
      this.buildMover();
      this.bindInput();
      AG.sfx.preload(['pickup', 'deliver', 'crash', 'surge_warn', 'count'].map(n => K('sfx.' + n)));
      ['center', 'surge.edge', 'resident.normal', 'resident.priority', 'headcount.walker'].concat(['up', 'down', 'left', 'right'].map(d => 'vehicle.head_' + d), Object.values(SEG).map(n => 'vehicle.' + n)).forEach(k => AG.assets.image(K(k)));
      this.relabel();
      await this.map.prepare();
      if (this.dead) return;
      this.phase = 'play';
      this.mover.enabled = true;
      this.stop = AG.gfx.loop(dt => this.frame(dt));
    }

    setup(entry) {
      const ctx = this.ctx;
      this.entry = entry; this.level = entry.level || ctx.level;
      const chk = this.chk = R.check(entry);
      if (!chk.ok) AG.warnOnce('ec:check', 'evac-convoy: the map failed its start check', chk.problems);
      const m = this.m = chk.m || R.parse(entry.map);
      this.f = R.features(entry);
      this.night = !!entry.night;
      this.cap = R.capacity(ctx.difficulty);
      this.tickMs = R.tickMs(this.level, ctx.difficulty);
      this.spawn = R.spawn(m);
      this.closed = new Set();
      this.closures = (entry.closures || []).map(c => Object.assign({}, c, { warned: false, done: false }));
      this.surge = new EC.Surge({ rows: T.rows, finalRow: entry.finalRow, intervals: EC.surgeIntervals(entry, this.level, ctx.difficulty), warnMs: T.warnMs });
      this.houses = new Map();
      for (const r of R.residents(entry, m)) this.houses.set(R.key(r.x, r.y), { x: r.x, y: r.y, waiting: r.folks.slice(), stranded: [], flooded: false });
      this.total = 0; this.priorityTotal = 0;
      this.houses.forEach(hs => hs.waiting.forEach(p => { this.total++; if (p.priority) this.priorityTotal++; }));
      this.onboard = []; this.maxLoad = 0;
      this.delivered = 0; this.priorityDelivered = 0; this.seq = [];
      this.hearts = T.hearts; this.heartsLost = 0;
      this.pets = (entry.pets || []).slice(0, 3).map(p => ({ x: p.x, y: p.y, got: false }));
      this.pulses = 0; this.strandedShown = false; this.lastFull = -9999; this.lastPrioWait = -9999; this.sawPrio = false;
      this.shakeUntil = 0; this.captionT = 0; this.captionText = ''; this.lockT = 0;
      this.rnd = AG.util.mulberry32((ctx.seed >>> 0) ^ 0xec11);
    }

    buildDom() {
      const stage = this.stage, ctx = this.ctx;
      this.view = AG.gfx.canvas(480, 270);
      this.view.cv.setAttribute('role', 'img');
      this.view.cv.setAttribute('aria-label', 'Evac Convoy map');
      this.caption = h('div', { class: 'ec-caption', role: 'status', 'aria-live': 'polite' });
      const steer = AG.input.promptIcon({ keys: ['key_up', 'key_down', 'key_left', 'key_right'], gesture: 'gesture_swipe_right' });
      this.tools = h('div', { class: 'ec-tools' }, steer, this.caption);
      this.counter = h('button', { class: 'ag-btn ag-btn--big ec-counter', type: 'button', tabindex: '-1' }, h('b', {}, '0'), h('small', {}, ''));
      this.countHelp = h('div', { class: 'ec-caption' }, '');
      this.countBox = h('div', { class: 'ec-count', hidden: true }, this.counter, h('div', { class: 'ec-tools' }, AG.input.promptIcon({ keys: ['key_space'], gesture: 'gesture_tap' }), this.countHelp));
      // a count is taken on pointerdown, like Space on keydown: the same timing on every device
      this.counter.addEventListener('pointerdown', e => { e.preventDefault(); this.countOne(); });
      this.counter.addEventListener('mousedown', e => e.preventDefault()); // keep the focus on the stage
      this.counter.addEventListener('click', e => e.preventDefault());
      this.el = h('div', { class: 'ec' }, this.view.cv, this.tools, this.countBox);
      stage.append(this.el);
      AG.input.setView(this.view);
      this.pad = AG.input.touchControls(ctx.controls, { dpad: true, buttons: [] });

      this.hud = ctx.hud({ hearts: T.hearts, score: 0, scoreLabel: STR.score, label: STR.saved });
      this.driver = h('span', { class: 'ec-driver', 'aria-hidden': 'true' });
      this.hud.el.append(this.driver);
      this.rig = ctx.rig('portrait', { height: 48 });
      this.rig.play('idle');
      this.offs.push(AG.on('kalasag:languagechange', () => this.relabel()));
    }

    buildMap() {
      const m = this.m, f = n => K('tiles.' + n);
      const tiles = new AG.grid.Tileset([
        { id: 'road', frame: f('road') }, { id: 'road_h', frame: f('road_h') }, { id: 'road_v', frame: f('road_v') },
        { id: 'grass', frame: f('grass'), walkable: false }, { id: 'tree', frame: f('tree'), walkable: false },
        { id: 'sand', frame: f('sand'), walkable: false }, { id: 'sea', frame: f('sea'), walkable: false },
        { id: 'house', frame: f('house'), tags: ['house'] }, { id: 'house_flooded', frame: f('house_flooded'), walkable: false },
        { id: 'bridge', frame: f('bridge'), tags: ['bridge'] }, { id: 'bridge_flooded', frame: f('bridge_flooded'), walkable: false },
        { id: 'tree_fallen', frame: f('tree_fallen'), walkable: false },
        { id: 'water', frame: K('surge.water'), anim: { fps: 2 }, walkable: false }
      ]);
      const map = this.map = new AG.grid.TileMap({ w: T.cols, h: T.rows, tile: TILE, tiles });
      const road = (x, y) => R.isRoad(m.at(x, y));
      for (let y = 0; y < T.rows; y++) for (let x = 0; x < T.cols; x++) {
        const ch = m.at(x, y);
        let id;
        if (ch === '#') id = y >= T.rows - 2 ? 'sand' : (x * 7 + y * 13 + this.level) % 5 === 0 ? 'tree' : 'grass';
        else if (ch === '~') id = 'sea';
        else if (ch === 'H') id = 'house';
        else if (ch === 'B') id = 'bridge';
        else if (ch === 'C') id = 'road';
        else {
          const side = road(x - 1, y) || road(x + 1, y), vert = road(x, y - 1) || road(x, y + 1);
          id = side && !vert ? 'road_h' : vert && !side ? 'road_v' : 'road';
        }
        map.set('floor', x, y, id);
      }
      // the view is the map under the band: 24 × 13 tiles in 480 × 260
      this.cam = new AG.grid.Camera({ map, viewW: 480, viewH: 260, mode: 'fixed' });
      this.dark = this.night ? new AG.grid.Darkness({ w: 480, h: 270, color: '#0a0b1f', alpha: 0.92, rings: 3, ringWidth: 4 }) : null;
      const xs = m.center.map(c => c.x), ys = m.center.map(c => c.y);
      this.cbox = { x: Math.min(...xs), y: Math.min(...ys) };
    }

    buildMover() {
      const sp = this.spawn;
      this.mover = new AG.grid.GridMover({
        map: this.map, x: sp.x, y: sp.y, facing: sp.dir,
        speeds: { tick: this.tickMs }, speed: 'tick', buffer: T.buffer, snake: true, trailMax: 64,
        canEnter: (x, y, dir) => this.canEnter(x, y, dir),
        onEnter: (x, y, dir) => this.onEnter(x, y, dir),
        onBlocked: (x, y, dir) => this.onBlocked(x, y, dir)
      });
      this.mover.enabled = false;
      this.offs.push(() => this.mover.destroy(), () => this.pad.destroy());
    }

    bindInput() {
      this.offs.push(AG.input.on('CONFIRM', e => { if (e.phase === 'down' && this.phase === 'count') this.countOne(); }));
    }

    relabel() {
      const small = this.hud.el.querySelectorAll('.ag-stat small');
      if (small[0]) small[0].textContent = AG.pick(STR.score);
      if (small[1]) small[1].textContent = AG.pick(STR.saved);
      this.counter.lastChild.textContent = AG.pick(STR.counter);
      this.updateHud();
    }
    updateHud() {
      if (!this.hud) return;
      this.hud.set({ hearts: this.hearts, score: R.points({ delivered: this.delivered, priorityDelivered: this.priorityDelivered }), label: this.delivered + ' / ' + this.total });
    }
    syncDriver() {
      const frame = this.rig.info(performance.now() / 1000).frame;
      if (frame === this.driverFrame) return;
      this.driverFrame = frame;
      this.driver.replaceChildren(this.rig.img(1));
    }
    /** A short reaction (happy, worried, cheer), then back to the calm pose. */
    react(action, ms) {
      this.rig.play(action, { restart: true });
      if (this.reactId) this.ctx.clear(this.reactId);
      this.reactId = this.ctx.after(ms || 800, () => { if (!this.dead) this.rig.play('idle'); });
    }
    say(type, text, o) { return this.ctx.say(type, text, o); }
    expertPose() { return AG.rig.resolve(this.ctx.expertId, 'alert').frame; }
    setCaption(text, ms) {
      this.captionText = AG.pick(text); this.captionT = ms || 3500;
      this.caption.textContent = this.captionText;
    }
    popAt(x, y, text, good) {
      const r = this.stage.getBoundingClientRect(), c = this.view.cv.getBoundingClientRect(), k = c.width / 480;
      AG.kit.pop(this.stage, Math.round(c.left - r.left + x * k), Math.round(c.top - r.top + y * k), text, good);
    }
    popTile(x, y, text, good) { this.popAt(x * TILE + TILE / 2, BAND + y * TILE, text, good); }
    shake(ms) { if (!this.reduce) this.shakeUntil = this.time + ms / 1000; }

    /* ---------- the road rules ---------- */
    flooded(y) { return this.surge.isFlooded(y); }
    /** Tiles the convoy fills right now: the head and one tile per passenger behind it. */
    parts() {
      const mv = this.mover;
      return [{ x: mv.x, y: mv.y }].concat(mv.trail.slice(0, this.onboard.length));
    }
    canEnter(x, y) {
      this.why = null;
      if (this.ended || this.phase !== 'play') { this.why = 'wall'; return false; }
      const ch = this.m.at(x, y);
      if (ch === '~') this.why = 'flood';
      else if (!R.isRoad(ch)) this.why = 'wall';
      else if (this.closed.has(R.key(x, y))) this.why = 'closed';
      else if (this.flooded(y)) this.why = 'flood';
      else {
        // after this step the convoy fills the old head tile and trail[0 .. n - 2]: the tail tile is free
        const n = this.onboard.length;
        if (n > 1 && this.mover.trail.slice(0, n - 1).some(p => p.x === x && p.y === y)) this.why = 'self';
      }
      return !this.why;
    }
    onBlocked(x, y) { this.crash(this.why || 'wall', x, y); }

    crash(why, x, y) {
      if (this.ended) return;
      this.hearts--; this.heartsLost++;
      // the families on board go back to their houses, safe and waiting again (or onto the roof if the house is flooded)
      for (const p of this.onboard) {
        const hs = this.houses.get(p.house);
        if (hs.flooded) hs.stranded.push(p); else hs.waiting.push(p);
        hs.waiting.sort((a, b) => b.priority - a.priority);
      }
      this.onboard = [];
      const sp = this.spawn;
      this.mover.teleport(sp.x, sp.y, sp.dir);
      this.mover.trail.length = 0;
      this.mover.enabled = false; this.lockT = T.crashLockMs;
      this.fx.push({ kind: 'crash', x: x * TILE + TILE / 2, y: y * TILE + TILE / 2, t0: this.time });
      this.shake(300);
      AG.sfx.play(K('sfx.crash'));
      this.react('worried', 1400);
      this.say('retry', STR.crash[why] || STR.crash.wall, { sound: false });
      this.updateHud();
      this.checkEnd();
    }

    /* ---------- pickups, the center, pets ---------- */
    onEnter(x, y) {
      if (this.ended || this.phase !== 'play') return;
      const k = R.key(x, y);
      const hs = this.houses.get(k);
      if (hs && !hs.flooded && hs.waiting.length) this.pickUp(hs);
      const pet = this.pets.find(p => !p.got && p.x === x && p.y === y);
      if (pet) { pet.got = true; AG.sfx.play('collect'); this.popTile(x, y, '🐾', true); }
      if (this.onboard.length && this.parts().some(p => this.m.at(p.x, p.y) === 'C')) this.unload(x, y);
      this.checkEnd();
    }
    pickUp(hs) {
      let n = 0, prio = false;
      while (hs.waiting.length && this.onboard.length < this.cap) {
        const p = hs.waiting.shift();
        this.onboard.push(p); n++; if (p.priority) prio = true;
      }
      if (n) {
        this.maxLoad = Math.max(this.maxLoad, this.onboard.length);
        AG.sfx.play(K('sfx.pickup'));
        this.popTile(hs.x, hs.y, '+' + n, true);
        this.react('happy', 800);
        if (prio && !this.sawPrio) { this.sawPrio = true; this.say('success', STR.prio); this.ctx.safe(); }
        this.updateHud();
      }
      if (hs.waiting.length && this.onboard.length >= this.cap && this.time - this.lastFull > 4) {
        this.lastFull = this.time;
        this.say('encouragement', STR.full);
        this.setCaption(STR.full, 2500);
      }
    }
    /** One passenger leaves per tick while any part of the convoy is in the center: the first on board first. */
    unload(x, y) {
      const p = this.onboard.shift();
      this.delivered++; this.seq.push(p.priority);
      if (p.priority) { this.priorityDelivered++; this.ctx.safe(); }
      AG.sfx.play(K('sfx.deliver'));
      this.popTile(x, y, '+' + (p.priority ? T.points.priority : T.points.resident), true);
      this.react('cheer', 700);
      if (!p.priority && this.time - this.lastPrioWait > 6 && this.houses.size) {
        let waitingPrio = false;
        this.houses.forEach(hs => { if (!hs.flooded && hs.waiting.some(q => q.priority)) waitingPrio = true; });
        if (waitingPrio) { this.lastPrioWait = this.time; this.say('encouragement', STR.prioWait); }
      }
      this.updateHud();
    }

    waitingCount() { let n = 0; this.houses.forEach(hs => { if (!hs.flooded) n += hs.waiting.length; }); return n; }
    strandedCount() { let n = 0; this.houses.forEach(hs => { n += hs.stranded.length; }); return n; }

    /* ---------- the surge and the scripted closures ---------- */
    simulate(dt) {
      const mv = this.mover, ms = dt * 1000;
      if (this.lockT > 0) { this.lockT -= ms; if (this.lockT <= 0) mv.enabled = true; }
      mv.update(dt);
      if (!this.started && !mv.stalled) this.started = true;
      if (this.captionT > 0) { this.captionT -= ms; if (this.captionT <= 0) this.caption.textContent = ''; }
      if (!this.started) return;
      this.clock += ms;
      for (const c of this.closures) {
        const at = c.at * 1000;
        if (!c.warned && this.clock >= at - T.warnMs) { c.warned = true; this.closureWarn(); }
        if (!c.done && this.clock >= at && !this.parts().some(p => p.x === c.x && p.y === c.y)) { c.done = true; this.closeRoad(c); }
      }
      for (const ev of this.surge.update(ms)) {
        if (this.ended) break;
        if (ev.type === 'warn') this.surgeWarn(ev.row);
        else if (ev.type === 'pulse') this.pulse(ev.row);
        else if (ev.type === 'final') this.endLevel('surge');
      }
    }
    surgeWarn() {
      AG.sfx.play(K('sfx.surge_warn'));
      this.setCaption(STR.warnCaption, T.warnMs + 600);
      this.react('worried', 1500);
      this.say('warning', STR.warn, { pose: this.expertPose(), sound: false });
    }
    closureWarn() {
      AG.sfx.play('whistle');
      this.setCaption(STR.closeCaption, T.warnMs + 600);
      this.say('warning', STR.closeWarn, { pose: this.expertPose(), sound: false });
    }
    closeRoad(c) {
      this.closed.add(R.key(c.x, c.y));
      this.map.set('floor', c.x, c.y, c.kind === 'bridge' ? 'bridge_flooded' : 'tree_fallen');
      AG.sfx.play('hit');
      this.shake(200);
    }
    /** One more row floods: roads and bridges close, the families still there climb onto their roofs. */
    pulse(row) {
      this.pulses++;
      for (let x = 0; x < T.cols; x++) {
        const ch = this.m.at(x, row);
        if (ch === '~') continue;
        this.map.set('floor', x, row, ch === 'H' ? 'house_flooded' : ch === 'B' ? 'bridge_flooded' : 'water');
      }
      let left = 0;
      this.houses.forEach(hs => {
        if (hs.y === row) { hs.flooded = true; left += hs.waiting.length; hs.stranded.push(...hs.waiting.splice(0)); }
      });
      AG.sfx.play('splash');
      this.shake(300);
      if (this.pulses === 1) this.say('warning', STR.firstPulse, { pose: this.expertPose(), sound: false });
      if (left && !this.strandedShown) { this.strandedShown = true; this.ctx.after(1800, () => { if (!this.dead && !this.ended) this.say('info', STR.stranded, { sound: false }); }); }
      this.fx.push({ kind: 'splash', row, t0: this.time });
      if (this.parts().some(p => p.y === row)) { const hd = this.mover; this.crash('surge', hd.x, hd.y); }
      this.updateHud();
      this.checkEnd();
    }

    /* ---------- the end of a level ---------- */
    checkEnd() {
      if (this.ended) return;
      if (this.hearts <= 0) this.endLevel('hearts');
      else if (!this.waitingCount() && !this.onboard.length) this.endLevel('done');
    }
    endLevel(why) {
      if (this.ended) return;
      this.ended = true; this.endedBy = why;
      this.mover.stop();
      this.timeLeftS = why === 'done' ? Math.floor(this.surge.msToFinal / 1000) : 0;
      this.pulsesLeft = this.surge.pulsesLeft;
      this.phase = 'end';
      if (why === 'surge') AG.kit.banner(this.stage, STR.finalSurge, STR.finalSurgeSub, 1800);
      else if (why === 'done') AG.kit.banner(this.stage, STR.allIn, null, 1600);
      else this.say('encouragement', STR.heartsOut);
      this.ctx.after(1900, () => {
        if (this.dead) return;
        if (why === 'hearts' || !this.delivered) this.finish(null);
        else this.startCount();
      });
    }

    /* ---------- the headcount ---------- */
    startCount() {
      this.phase = 'count';
      const sp = this.spawn, V = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[sp.dir];
      let steps = 3;
      while (steps > 1 && !R.isRoad(this.m.at(sp.x + V[0] * steps, sp.y + V[1] * steps))) steps--;
      const from = { x: (sp.x + V[0] * steps) * TILE + TILE / 2, y: BAND + (sp.y + V[1] * steps) * TILE + TILE / 2 };
      const to = { x: (this.cbox.x + 1) * TILE, y: BAND + (this.cbox.y + 1) * TILE };
      this.hc = new EC.Headcount({
        n: this.delivered, rnd: this.rnd, from, to,
        onEnter: () => { AG.sfx.play('tick'); },
        onRecount: i => { this.counterSet(i, STR.recount); AG.sfx.play(K('sfx.count')); },
        onDone: hc => this.afterCount(hc)
      });
      this.counterSet(0, STR.countNow);
      this.countBox.hidden = false;
      this.countBox.scrollIntoView({ block: 'nearest' });
      this.countHelp.textContent = AG.pick(STR.countHelp);
      AG.kit.banner(this.stage, STR.countTitle, STR.countSub, 2200);
      this.say('instruction', STR.countHelp, { sound: false });
    }
    counterSet(n, label) {
      this.counter.firstChild.textContent = String(n);
      this.counter.lastChild.textContent = AG.pick(label);
      this.counter.classList.remove('is-bump'); void this.counter.offsetWidth; this.counter.classList.add('is-bump');
    }
    countOne() {
      if (!this.hc || !this.hc.press()) return;
      this.counterSet(this.hc.counted, STR.countNow);
      AG.sfx.play(K('sfx.count'));
    }
    afterCount(hc) {
      if (hc.exact) {
        AG.sfx.play('star');
        AG.kit.celebrate(this.stage);
        AG.kit.banner(this.stage, STR.madeIt, S('+' + T.points.headcount), 1800);
        this.say('congratulations', STR.madeItSay, { sound: false });
        this.react('cheer', 1500);
      } else {
        this.counterSet(hc.n, STR.recount);
        this.say('encouragement', STR.recountSay, { sound: false });
      }
      this.ctx.after(1900, () => { if (!this.dead) this.finish(hc); });
    }
    finish(hc) {
      this.phase = 'over';
      this.onEnd({
        level: this.level, mode: this.ctx.mode, difficulty: this.ctx.difficulty,
        won: this.delivered >= this.entry.target, endedBy: this.endedBy,
        delivered: this.delivered, total: this.total, target: this.entry.target,
        priorityDelivered: this.priorityDelivered, priorityTotal: this.priorityTotal,
        order: R.order(this.seq, this.priorityTotal),
        stranded: this.strandedCount(), timeLeftS: this.timeLeftS || 0, pulsesLeft: this.pulsesLeft || 0, pulsesDone: this.pulses,
        heartsLost: this.heartsLost, heartsLeft: Math.max(0, this.hearts), maxLoad: this.maxLoad,
        pets: this.pets.map(p => p.got), usedMs: Math.round(this.clock),
        headcount: hc ? { counted: hc.counted, actual: hc.n, exact: hc.exact } : null,
        headcountExact: !!(hc && hc.exact)
      });
    }

    /* ---------- the frame ---------- */
    frame(dt) {
      this.time += dt;
      if (this.phase === 'play') this.simulate(dt);
      else if (this.phase === 'count' && this.hc) this.hc.update(dt * 1000);
      this.draw();
      this.syncDriver();
    }

    icon(emoji, size) {
      const k = emoji + size;
      return this.icons[k] || (this.icons[k] = AG.pixelIcon(emoji, size, true));
    }
    /** A grey copy of a sprite (families waiting on a roof): cached once the art has loaded. */
    grey(key) {
      if (this.greys[key]) return this.greys[key];
      const rec = AG.assets.image(key);
      if (!rec.ok || !rec.img.naturalWidth) return null;
      const w = rec.frameW || rec.img.naturalWidth, hh = rec.img.naturalHeight;
      const cv = document.createElement('canvas'); cv.width = w; cv.height = hh;
      const g = cv.getContext('2d'); g.drawImage(rec.img, 0, 0, w, hh, 0, 0, w, hh);
      const img = g.getImageData(0, 0, w, hh), d = img.data;
      for (let i = 0; i < d.length; i += 4) { const v = Math.round(d[i] * 0.3 + d[i + 1] * 0.59 + d[i + 2] * 0.11); d[i] = d[i + 1] = d[i + 2] = v; }
      g.putImageData(img, 0, 0);
      return (this.greys[key] = cv);
    }

    draw() {
      const c = this.view.ctx, t = this.time;
      c.fillStyle = INK; c.fillRect(0, 0, 480, 270);
      const sx = this.time < this.shakeUntil ? (Math.floor(t * 40) % 2 ? 1 : -1) : 0, sy = this.time < this.shakeUntil ? (Math.floor(t * 31) % 2 ? 1 : 0) : 0;
      c.save(); c.translate(sx, BAND + sy);
      this.cam.begin(c);
      this.map.draw(c, this.cam, t);
      this.drawFront(c, t);
      this.drawCenter(c);
      this.drawHouses(c);
      this.drawPets(c, t);
      const inCount = this.phase === 'count' || this.phase === 'over';
      if (!this.night && !inCount) this.drawConvoy(c);
      this.cam.end(c);
      c.restore();
      if (this.dark) {
        const mv = this.mover, cb = this.cbox;
        const glows = [{ x: cb.x * TILE, y: BAND + cb.y * TILE, w: 40, h: 40, key: K('center'), halo: 24 }];
        this.houses.forEach(hs => {
          if (hs.flooded || !hs.waiting.length) return;
          const res = K(hs.waiting.some(p => p.priority) ? 'resident.priority' : 'resident.normal');
          glows.push({ x: hs.x * TILE, y: BAND + hs.y * TILE, w: TILE, h: TILE, halo: 12, draw: (g, x, y) => { AG.assets.draw(g, K('tiles.house'), x, y, TILE, TILE); AG.assets.draw(g, res, x, y - 6, TILE, TILE); } });
        });
        this.dark.draw(c, { t, lights: [{ x: mv.cx, y: BAND + mv.cy, r: T.light * TILE }], glows });
        if (!inCount) { c.save(); c.translate(0, BAND); this.drawConvoy(c); c.restore(); }
      }
      if (this.night) AG.gfx.rain(c, 480, 270, t, 'rgba(190,220,255,.6)', 55, 0.35);
      c.save(); c.translate(0, BAND);
      this.drawWarnings(c, t);
      this.drawFx(c, t);
      c.restore();
      if (this.phase === 'count' && this.hc) this.hc.draw(c, t);
      this.drawBand(c);
      this.drawTexts(c);
    }

    /** The surge's front: foam along the newest flooded row (the sea row at the start). */
    drawFront(c, t) {
      const row = this.surge.floodedFrom, frame = Math.floor(t * 4) % 4;
      for (let x = 0; x < T.cols; x++) AG.assets.draw(c, K('surge.edge'), x * TILE, row * TILE, TILE, TILE, frame);
    }
    drawCenter(c) {
      AG.assets.draw(c, K('center'), this.cbox.x * TILE, this.cbox.y * TILE, 40, 40);
    }
    drawHouses(c) {
      this.houses.forEach(hs => {
        const px = hs.x * TILE, py = hs.y * TILE;
        if (hs.waiting.length) {
          const anyP = hs.waiting.some(p => p.priority);
          AG.assets.draw(c, K(anyP ? 'resident.priority' : 'resident.normal'), px, py - 6, TILE, TILE);
          if (hs.waiting.length > 1) {
            c.fillStyle = INK; c.fillRect(px + 9, py + 9, 11, 11);
            AG.gfx.text(c, String(hs.waiting.length), px + 14.5, py + 9, { size: 10, color: '#fff', align: 'center' });
          }
          const pr = hs.waiting.filter(p => p.priority);
          pr.forEach((p, i) => c.drawImage(this.icon(T.emoji[p.kind], 12), Math.round(px + 10 - pr.length * 5 + i * 10), py - 17));
        }
        if (hs.stranded.length) {
          const key = K(hs.stranded.some(p => p.priority) ? 'resident.priority' : 'resident.normal'), g = this.grey(key);
          if (g) c.drawImage(g, px, py - 8, TILE, TILE); else { c.globalAlpha = 0.5; AG.assets.draw(c, key, px, py - 8, TILE, TILE); c.globalAlpha = 1; }
          c.drawImage(this.icon('⛵', 12), px + 4, py - 19);
        }
      });
    }
    drawPets(c, t) {
      for (const p of this.pets) {
        if (p.got || this.flooded(p.y)) continue;
        c.drawImage(this.icon('🐾', 16), p.x * TILE + 2, p.y * TILE + 2 - (this.reduce ? 0 : Math.floor(t * 3) % 2));
      }
    }
    /** The head and the segments, each a straight or corner piece from its two neighbours on the trail. */
    drawConvoy(c) {
      const mv = this.mover, n = this.onboard.length;
      const chain = [{ x: mv.x, y: mv.y }].concat(mv.trail.slice(0, n + 1));
      const at = j => chain[Math.min(j, chain.length - 1)];
      const p = mv.step ? mv.progress : 1;
      for (let i = n - 1; i >= 0; i--) {
        const to = at(i + 1), from = at(i + 2), head = at(i), tail = chain[i + 2];
        const x = Math.round((from.x + (to.x - from.x) * p) * TILE), y = Math.round((from.y + (to.y - from.y) * p) * TILE);
        const hd = dirTo(to, head) || 'up', tl = tail ? dirTo(to, tail) || OPP[hd] : OPP[hd];
        AG.assets.draw(c, K('vehicle.' + (SEG[[hd, tl].sort().join(',')] || 'seg_h')), x, y, TILE, TILE);
        if (this.onboard[i].priority) { // a gold diamond marks a priority passenger
          c.fillStyle = INK; c.fillRect(x + 6, y + 8, 8, 4); c.fillRect(x + 8, y + 6, 4, 8);
          c.fillStyle = '#ffd23f'; c.fillRect(x + 7, y + 9, 6, 2); c.fillRect(x + 9, y + 7, 2, 6);
        }
      }
      AG.assets.draw(c, K('vehicle.head_' + mv.facing), mv.px, mv.py, TILE, TILE);
    }

    /* warning marks: a dithered tile with a SHAPE (▲ for the surge, ✕ for a closing road), so colour is never the only cue */
    warnTile(kind, phase) {
      const key = kind + phase;
      if (this.warnCache[key]) return this.warnCache[key];
      const cv = document.createElement('canvas'); cv.width = cv.height = TILE;
      const g = cv.getContext('2d');
      for (let by = 0; by < 10; by++) for (let bx = 0; bx < 10; bx++) {
        if ((bx + by + phase) % 2 === 0) { g.fillStyle = kind === 'surge' ? '#ff7a1a' : '#ffd23f'; g.fillRect(bx * 2, by * 2, 2, 2); }
        else { g.fillStyle = 'rgba(30,21,56,.55)'; g.fillRect(bx * 2, by * 2, 2, 2); }
      }
      const tri = (top, hgt, col) => { g.fillStyle = col; for (let r = 0; r < hgt; r++) g.fillRect(10 - r, top + r, 2 * r + 1, 1); };
      if (kind === 'surge') { tri(3, 11, INK); tri(5, 8, '#fff'); g.fillStyle = INK; g.fillRect(10, 9, 1, 3); g.fillRect(10, 13, 1, 1); }
      else {
        for (let i = 0; i < 12; i++) { g.fillStyle = INK; g.fillRect(3 + i - 1, 3 + i - 1, 5, 5); g.fillRect(16 - i - 1, 3 + i - 1, 5, 5); }
        for (let i = 0; i < 12; i++) { g.fillStyle = '#fff'; g.fillRect(3 + i, 3 + i, 3, 3); g.fillRect(16 - i, 3 + i, 3, 3); }
      }
      return (this.warnCache[key] = cv);
    }
    drawWarnings(c, t) {
      const phase = this.reduce ? 0 : Math.floor(t * 4) % 2;
      if (this.phase === 'play' && this.surge.warningOn) {
        const row = this.surge.nextRow, tile = this.warnTile('surge', phase);
        for (let x = 0; x < T.cols; x++) c.drawImage(tile, x * TILE, row * TILE);
      }
      for (const cl of this.closures) if (cl.warned && !cl.done) c.drawImage(this.warnTile('close', phase), cl.x * TILE, cl.y * TILE);
    }
    drawFx(c, t) {
      this.fx = this.fx.filter(f => t - f.t0 < 0.6);
      for (const f of this.fx) {
        const k = (t - f.t0) / 0.6;
        if (f.kind === 'crash') {
          const r = this.reduce ? 8 : 4 + Math.round(k * 10);
          for (let i = 0; i < 8; i++) {
            const a = i * Math.PI / 4, x = Math.round(f.x + Math.cos(a) * r), y = Math.round(f.y + Math.sin(a) * r);
            c.fillStyle = i % 2 ? '#ff7a1a' : '#ffd23f'; c.fillRect(x - 2, y - 2, 4, 4);
          }
          c.fillStyle = '#e0245e'; c.fillRect(Math.round(f.x) - 3, Math.round(f.y) - 3, 6, 6);
        } else if (f.kind === 'splash' && !this.reduce) {
          for (let x = 0; x < T.cols; x++) {
            const h2 = Math.round(Math.sin(k * Math.PI) * (3 + (x % 3) * 2));
            c.fillStyle = '#fff'; c.fillRect(x * TILE + 4, f.row * TILE - h2, 3, h2); c.fillRect(x * TILE + 12, f.row * TILE - h2 + 1, 3, Math.max(0, h2 - 1));
          }
        }
      }
    }
    /** The band over the map: the load, the surge meter (colour AND a ▲ marker for the warning), the pulses. */
    drawBand(c) {
      c.fillStyle = INK; c.fillRect(0, 0, 480, BAND);
      const full = this.onboard.length >= this.cap, sg = this.surge;
      AG.gfx.text(c, AG.pick(STR.load) + ' ' + this.onboard.length + '/' + this.cap, 4, 0, { size: 10, color: full ? '#ffd23f' : '#fff' });
      const mx = 150, mw = 180;
      if (!this.started) {
        AG.gfx.text(c, AG.pick(STR.start), 240, 0, { size: 10, color: '#fff', align: 'center' });
      } else if (!sg.done) {
        const warn = sg.warningOn, flash = warn && !this.reduce && Math.floor(this.time * 4) % 2;
        c.fillStyle = '#3a2f66'; c.fillRect(mx, 2, mw, 6);
        c.fillStyle = warn ? (flash ? '#fff' : '#ff7a1a') : '#3ec7ff';
        c.fillRect(mx, 2, Math.round(mw * sg.progress), 6);
        const interval = sg.times[sg.k] - (sg.k ? sg.times[sg.k - 1] : 0), tx = mx + Math.round(mw * (1 - T.warnMs / interval));
        c.fillStyle = '#ffd23f'; c.fillRect(tx, 0, 1, 10);
        AG.gfx.text(c, warn ? '▲ ' + Math.ceil(sg.msToNext / 1000) : 'Surge', mx - 4, 0, { size: 10, color: warn ? '#ff7a1a' : '#fff', align: 'right' });
      }
      AG.gfx.text(c, AG.pick(STR.pulse) + ' ' + sg.k + '/' + sg.n, 476, 0, { size: 10, color: '#fff', align: 'right' });
    }
    drawTexts(c) {
      if (this.captionT > 0 && this.captionText) AG.gfx.text(c, this.captionText, 240, BAND + 3, { size: 10, color: '#fff', outline: INK, align: 'center' });
      if (this.phase === 'play' && this.mover.stalled && this.started && this.lockT <= 0) AG.gfx.text(c, AG.pick(STR.again), 240, 268 - 14, { size: 10, color: '#fff', outline: INK, align: 'center' });
    }

    destroy() {
      this.dead = true;
      if (this.stop) this.stop();
      this.offs.forEach(f => f()); this.offs = [];
      if (this.el) this.el.remove();
    }
  }

  EC.Scene = Scene;
})(window.AG);
