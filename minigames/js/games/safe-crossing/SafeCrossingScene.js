/* Safe Crossing: one walk from Home 🏠 up to School 🏫.
 *
 *   const scene = new AG.safeCrossing.Scene(stage, ctx, { entry, onEnd(run) })
 *   run: { school, endless, rows, score, heartsLost, heartsLeft, paws, … } → index.js turns it into done()
 *
 * The course (lanes/course.js) is a TileMap of 30 px rows, 16 columns wide, scrolled by a
 * follow camera that keeps the player in the lower third. Traffic (Vehicles.js), the walk
 * signals (Signals.js) and parked-vehicle occlusion (Occlusion.js) are pure and seeded; this
 * file draws them and applies the safe-crossing rules:
 *   - LOOK FIRST: standing still 500 ms on a curb plays look-left, look-right (no button).
 *     Stepping onto the road having looked +50; without looking "Look first!" −20.
 *   - a whole crossing inside the zebra counts double; jaywalking near one gets no bonus;
 *   - stepping onto the road on STOP costs a heart even on an empty road; WALK +100;
 *   - footbridge +100; waiting at a railway barrier +50; phone away +20;
 *   - a hit is never graphic: back to the last curb, a whistle, −1 heart, a 1 s blink.
 * There is no chaser and no auto-scroll: waiting is the lesson.
 *
 * Keys: ↑/W forward, ←/→ or A/D sideways, ↓/S back, Q puts the phone away. Touch: tap =
 * forward, swipe left/right/down (and up), tap the 📱 badge, the optional D-pad. Mouse:
 * click = forward, click-drag = swipe. */
window.AG = window.AG || {};
(function (AG) {
  const { h } = AG.util;
  const SC = AG.safeCrossing, T = SC.tuning, R = SC.rules, P = T.points;
  const S = (en, fil) => ({ en, fil });
  const TILE = T.tile, W = 480;
  const VEC = { up: [0, -1], right: [1, 0], down: [0, 1], left: [-1, 0] };
  const ROT = { down: 0, left: 1, up: 2, right: 3 };

  const STR = {
    rows: S('Rows', 'Hilera'), score: S('Score', 'Puntos'), paws: S('Paws', 'Bakas'),
    phoneAway: S('Put it away', 'Itabi'),
    lookFirst: S('Look first! Stop at the curb and look left and right.', 'Tumingin muna! Huminto sa gilid at tumingin sa kaliwa at kanan.'),
    looked: S('Looked both ways!', 'Tumingin sa magkabilang direksiyon!'),
    useLane: S('Use the pedestrian lane!', 'Gamitin ang pedestrian lane!'),
    redLight: S('Wait for the walking signal!', 'Hintayin ang signal na maglakad!'),
    flash: S("The signal is flashing: don't start now. Wait for the next walk signal.", 'Kumikislap ang signal: huwag munang tumawid. Hintayin ang susunod na signal.'),
    oops: S('Oops! Wait for it!', 'Ay! Hintayin muna!'),
    safe: S('Safe crossing!', 'Ligtas na pagtawid!'),
    zebra: S('Pedestrian lane ×2!', 'Pedestrian lane ×2!'),
    bridge: S('Footbridge! The safest way across.', 'Footbridge! Ang pinakaligtas na daan.'),
    phone: S('Your phone buzzed and now your eyes are on it! Press Q or tap 📱 to put it away.', 'Tumunog ang cellphone at doon na nakatingin ang mata mo! Pindutin ang Q o i-tap ang 📱 para itabi.'),
    phoneOff: S('Phone away. Eyes on the road!', 'Nakatabi na ang cellphone. Sa daan ang tingin!'),
    phoneLook: S('You can\'t look both ways while you are on your phone!', 'Hindi ka makatingin sa magkabilang direksiyon habang nasa cellphone ka!'),
    helmetFirst: S('Helmet first! Pick up the 🪖 before you ride.', 'Helmet muna! Kunin ang 🪖 bago sumakay.'),
    helmetOn: S('Helmet on! Now ride in the bike lane.', 'Suot na ang helmet! Ngayon, sa bike lane ka sumakay.'),
    sidewalkRide: S('Ride in the bike lane, not on the sidewalk.', 'Sa bike lane sumakay, hindi sa bangketa.'),
    vestOn: S('Reflective vest on! Drivers can see you in the dark.', 'Suot na ang reflective vest! Nakikita ka ng mga drayber sa dilim.'),
    barrier: S('The barrier is down. Wait for the train to pass.', 'Nakababa ang harang. Hintaying makadaan ang tren.'),
    waited: S('You waited for the train!', 'Hinintay mo ang tren!'),
    parked: S("Parked vehicles block the way. Don't step out between them: cross where you can see.", 'May nakaparadang sasakyan. Huwag lumabas sa pagitan nila: tumawid kung saan ka nakakakita.'),
    deck: S('Stay on the footbridge until the other side.', 'Manatili sa footbridge hanggang sa kabila.'),
    school: S('You made it to school safely!', 'Ligtas kang nakarating sa paaralan!'),
    paw: S('Paw print!', 'Bakas ng paa!')
  };
  SC.STR = STR;

  /* ---------- styles, once per page (all under #ag-app, classes sc-) ---------- */
  const CSS = `
#ag-app .sc { display: grid; gap: 8px; justify-items: center; width: 100%; }
#ag-app .sc .ag-canvas { width: 100%; }
#ag-app .sc-tools { display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; align-items: center; min-height: 52px; }
#ag-app .sc-tool { display: inline-flex; gap: 4px; align-items: center; }
#ag-app .sc-tool[hidden] { display: none; }
#ag-app .sc-tools .ag-btn { min-height: 52px; min-width: 64px; }
#ag-app .sc-tools .sc-phone { outline: 3px dashed var(--vest); outline-offset: 2px; }
#ag-app .sc-hint { font-size: .85rem; color: var(--muted); font-weight: 700; }
@media (prefers-reduced-motion: reduce) { #ag-app .sc-tools .sc-phone { outline-style: solid; } }`;
  function injectCss() {
    if (!document.querySelector('style[data-ag-css="safe-crossing"]')) document.head.append(h('style', { 'data-ag-css': 'safe-crossing' }, CSS));
  }

  class Scene {
    constructor(stage, ctx, o) {
      injectCss();
      this.stage = stage; this.ctx = ctx; this.onEnd = o.onEnd;
      this.entry = o.entry; this.seed = (o.entry.seed != null ? o.entry.seed : ctx.seed) >>> 0;
      this.course = new SC.Course(o.entry);
      this.endless = !!o.entry.endless;
      this.night = !!o.entry.night; this.bikeLevel = !!o.entry.bike;
      this.traffic = new SC.Traffic(this.course, { seed: this.seed, difficulty: ctx.difficulty }).prewarm();
      this.targets = R.targets(this.course, o.entry);
      this.reduce = AG.reducedMotion();
      this.offs = []; this.ended = false;
      // run state
      this.hearts = T.hearts; this.heartsLost = 0; this.score = 0; this.maxLane = 0; this.usedMs = 0;
      this.paws = [false, false, false]; this.pawItems = this.course.items.filter(it => it.kind === 'paw').slice(0, 3);
      this.taken = new Set();
      this.looked = false; this.look = null; this.idleMs = 0;
      this.crossing = null; this.lastCurb = { x: 7, i: 0 };
      this.phone = false; this.helmet = false; this.vest = false;
      this.waitedRail = {}; this.safeUntil = 0; this.oopsUntil = 0; this.lastHint = {};
      this.stats = { looked: 0, zebra: 0, crossings: 0, bridge: 0, redLights: 0, noLook: 0 };
      this.prevPhase = {}; this.prevBarrier = {};
      this.build();
    }

    /* ---------- map, mover, camera ---------- */
    build() {
      const c = this.course, key = n => 'safe-crossing.lane.' + n;
      const tiles = new AG.grid.Tileset(['sidewalk', 'curb', 'grass', 'bike', 'road', 'road_line', 'zebra', 'rail', 'school'].map(n => ({ id: n, frame: key(n) }))
        .concat([{ id: 'stairs', frame: key('footbridge_stairs') }, { id: 'deck', frame: key('footbridge_deck') }]));
      const map = this.map = new AG.grid.TileMap({ w: c.cols, h: c.H, tile: TILE, tiles, staticLayers: c.H <= 60 ? ['floor', 'walls'] : [] });
      for (let i = 0; i < c.H; i++) {
        const l = c.lanes[i], y = c.y(i), g = c.groupAt(i);
        for (let x = 0; x < c.cols; x++) {
          let id = SC.LANES[l.t].art;
          if (l.t === 'side' && c.curb(i)) id = 'curb';
          if (l.t === 'road' && c.lanes[i + 1] && c.groupAt(i + 1) === g && c.lanes[i + 1].t === 'road') id = 'road_line';
          if ((l.t === 'road' || l.t === 'parked') && c.inZebra(g, x)) id = 'zebra';
          map.set('floor', x, y, id);
          if (c.stairs(i, x)) map.set('walls', x, y, 'stairs');
          if (c.deck(i, x)) map.set('overlay', x, y, 'deck');
        }
      }
      this.view = AG.gfx.canvas(480, 270);
      this.cam = new AG.grid.Camera({ map, viewW: 480, viewH: 270, mode: 'follow', deadzone: T.camera.deadzone, smooth: T.camera.smooth });
      this.dark = this.night ? new AG.grid.Darkness({ w: 480, h: 270, rings: 3, ringWidth: 4 }) : null;
      this.lights = [];
      if (this.night) for (let i = 1; i < c.H - 1; i++) if (c.curb(i)) [2, 8, 13].forEach(x => { if (!c.stairs(i, x) && !c.itemsAt(i, x).length) this.lights.push({ i, x }); });

      this.rig = this.ctx.rig('top');
      this.mover = new AG.grid.GridMover({
        map, x: 7, y: c.y(0), facing: 'up', rig: this.rig,
        speeds: T.speeds, speed: 'hop', buffer: 1, holdDelay: T.holdDelay, hop: this.reduce ? 0 : T.hop, touch: false,
        actions: { idle: 'idle', move: 'walk' },
        canEnter: (x, y, dir) => this.canEnter(x, y, dir),
        onStart: (x, y, dir, m) => this.onStart(x, y, dir, m),
        onEnter: (x, y) => this.onEnter(x, y),
        onBlocked: (x, y, dir) => this.onBlocked(x, y, dir)
      });
      // the front-facing mini for looking left and right (AGILA's geared front mini; heroes: their front frame)
      const me = AG.chars.get(this.ctx.characterId);
      this.front = me.agila ? AG.chars.image(AG.path('assets/agila/mini_front_geared.png')) : AG.chars.image(AG.chars.topSrc(me.id, 'down'));
      this.frontAgila = !!me.agila;
    }
    lane() { return this.course.lane(this.mover.y); }

    /* ---------- the DOM around the canvas ---------- */
    async mount() {
      const stage = this.stage, ctx = this.ctx;
      this.phoneBtn = h('button', { class: 'ag-btn sc-phone', type: 'button', tabindex: '-1' }, '');
      this.phoneBtn.addEventListener('click', () => { this.putAway(); stage.focus({ preventScroll: true }); });
      this.phoneTool = h('span', { class: 'sc-tool' }, AG.input.promptIcon({ keys: ['key_q'], gesture: 'gesture_tap' }), this.phoneBtn);
      this.phoneTool.hidden = true;
      const move = AG.input.promptIcon({ keys: ['key_up', 'key_left', 'key_down', 'key_right'], gesture: 'gesture_tap' });
      this.hintEl = h('span', { class: 'sc-hint' });
      this.el = h('div', { class: 'sc' }, this.view.cv, h('div', { class: 'sc-tools' }, move, this.hintEl, this.phoneTool));
      stage.append(this.el);
      AG.input.setView(this.view);
      this.pad = AG.input.touchControls(ctx.controls, { dpad: true, buttons: [] });

      this.hud = ctx.hud({ hearts: T.hearts, score: 0, scoreLabel: STR.score, label: STR.rows });
      this.relabel();

      // touch / mouse: tap = forward (or the 📱 badge), swipe = that way
      AG.input.pointerMode('drag');
      this.offs.push(AG.input.onPointer('tap', p => this.tap(p)));
      this.offs.push(AG.input.onPointer('swipe', p => { if (!this.ended) this.mover.queueDir(p.dir); }));
      AG.input.register('PHONE', { keys: ['KeyQ'] });
      this.offs.push(AG.input.on('PHONE', e => { if (e.phase === 'down') this.putAway(); }));
      this.offs.push(AG.on('kalasag:languagechange', () => this.relabel()));
      this.offs.push(() => this.mover.destroy(), () => this.pad.destroy());
      AG.sfx.preload(['hop', 'horn', 'bell', 'beep', 'whistle', 'looked'].map(n => 'safe-crossing.sfx.' + n));

      this.cam.follow(this.mover.cx, this.mover.cy).snap();
      this.updateHud();
      this.mover.enabled = false;
      await this.map.prepare();
      if (this.dead) return;
      this.mover.enabled = true;
      this.stop = AG.gfx.loop(dt => this.frame(dt));
    }
    relabel() {
      this.phoneBtn.textContent = '📱 ' + AG.pick(STR.phoneAway);
      const small = this.hud.el.querySelectorAll('.ag-stat small');
      if (small[0]) small[0].textContent = AG.pick(STR.score);
      if (small[1]) small[1].textContent = AG.pick(STR.rows);
      this.updateHud();
    }
    updateHud() {
      const top = this.course.H - 1;
      const rows = this.endless ? String(this.maxLane) : this.maxLane + ' / ' + top;
      this.hud.set({ hearts: this.hearts, score: Math.max(0, this.score), label: { en: rows, fil: rows } });
    }

    /* ---------- moving ---------- */
    canEnter(x, y, dir) {
      const c = this.course, i = c.lane(y), i0 = this.lane(), x0 = this.mover.x;
      this.why = null;
      if (this.ended || !c.inBounds(i, x)) return false;
      if (this.bikeLevel && !this.helmet && !c.safe(i)) { this.why = 'helmet'; return false; }
      if (c.parked(i, x)) { this.why = 'parked'; return false; }
      if (c.deck(i0, x0) && (dir === 'left' || dir === 'right')) { this.why = 'deck'; return false; }
      if (c.deck(i, x) && !(x === x0 && (c.deck(i0, x0) || c.stairs(i0, x0)))) { this.why = 'deck'; return false; }
      if (c.lanes[i].t === 'rail' && i !== i0 && this.traffic.barrierDown(i)) { this.why = 'barrier'; return false; }
      if (!c.deck(i, x) && this.traffic.solid(i, x)) { this.why = 'vehicle'; return false; }
      return true;
    }
    onBlocked(x, y, dir) {
      if (this.ended) return;
      const i = this.course.lane(y);
      if (this.why === 'helmet') this.hint('helmet', 'instruction', STR.helmetFirst);
      else if (this.why === 'parked') this.hint('parked', 'warning', STR.parked, 5000);
      else if (this.why === 'deck') this.hint('deck', 'instruction', STR.deck);
      else if (this.why === 'barrier') { this.waitedRail[i] = this.traffic.rail(i).trainNo(); this.hint('barrier', 'instruction', STR.barrier, 4000); }
    }
    onStart(x, y, dir, m) {
      if (this.ended) return;
      const c = this.course, i = c.lane(y), from = m.trail[0], i0 = c.lane(from.y);
      this.cancelLook();
      const wasLooked = this.looked;
      this.looked = false; this.idleMs = 0;
      AG.sfx.play('safe-crossing.sfx.hop');
      const g = c.groupAt(i), g0 = c.groupAt(i0);
      // stepping off a safe row onto a hazard: a crossing starts
      if (c.safe(i0) && g) {
        if (g.kind === 'rail') { this.lastCurb = { x: from.x, i: i0 }; this.crossing = { g, rail: true, waited: this.waitedRail[i] === this.traffic.rail(i).trainNo() }; }
        else if (c.deck(i, x)) { this.lastCurb = { x: from.x, i: i0 }; this.crossing = { g, bridge: true, from: i0 }; }
        else if (!this.startCrossing(g, i0, from, x, wasLooked)) return;
      } else if (g && this.crossing && this.crossing.g === g && !this.crossing.rail && !this.crossing.bridge) {
        // still on the road: did the crossing leave the pedestrian lane?
        const cr = this.crossing;
        if (!c.inZebra(g, x)) cr.zebra = false;
        if (!cr.jaywalk && R.jaywalk(x, g.zebra)) { cr.jaywalk = true; this.hint('jay', 'warning', STR.useLane); }
      } else if (c.safe(i) && g0 && this.crossing && this.crossing.g === g0) {
        // off the hazard onto a safe row: beyond it = done, back where we came from = called off
        if (i > g0.end) this.finishCrossing(this.crossing);
        this.crossing = null;
      }
      if (c.safe(i) && c.safe(i0) && i === i0 && this.helmet && c.lanes[i].t === 'side') {
        this.addScore(P.sidewalkRide); this.hint('ride', 'retry', STR.sidewalkRide, 4000);
      }
      if (i > this.maxLane) { this.addScore((i - this.maxLane) * P.row, false); this.maxLane = i; }
      if (c.lanes[i].t === 'road' && !c.deck(i, x)) this.honk(i, x);
      this.updateHud();
    }
    /** Off the curb onto the road. Returns false when a red light sent the player back. */
    startCrossing(g, i0, from, x, looked) {
      const sig = this.traffic.signal(g);
      this.lastCurb = { x: from.x, i: i0 };
      if (sig && sig.phase === 'stop') { this.redLight(); return false; }
      if (sig && sig.phase === 'flash') this.hint('flash', 'instruction', STR.flash, 4000);
      if (looked) this.pop('👀 ✓', true);
      else {
        this.stats.noLook++;
        this.addScore(P.noLook);
        this.hint('look', 'retry', this.phone ? STR.phoneLook : STR.lookFirst, 3000);
      }
      const c = this.course;
      this.crossing = { g, looked, walk: !!(sig && sig.phase === 'walk'), zebra: c.inZebra(g, x), jaywalk: R.jaywalk(x, g.zebra), rows: g.end - g.start + 1 };
      if (this.crossing.jaywalk) this.hint('jay', 'warning', STR.useLane);
      return true;
    }
    finishCrossing(cr) {
      if (cr.rail) {
        if (cr.waited) { this.addScore(P.waitTrain); this.say('success', STR.waited); this.ctx.safe(); }
        return;
      }
      const r = R.crossing(cr);
      this.stats.crossings++;
      if (cr.bridge) { this.stats.bridge++; this.addScore(r.total); this.say('success', STR.bridge); this.ctx.safe(); return; }
      if (cr.looked && !cr.jaywalk) this.stats.looked++;
      if (cr.zebra && !cr.jaywalk) this.stats.zebra++;
      if (r.total > 0) {
        this.addScore(r.total);
        AG.sfx.play('good');
        if (cr.zebra && cr.looked) { this.say('success', cr.walk ? STR.safe : STR.zebra, { sound: false }); this.ctx.safe(); }
      }
    }
    onEnter(x, y) {
      if (this.ended) return;
      const c = this.course, i = c.lane(y);
      for (const it of c.itemsAt(i, x)) {
        if (this.taken.has(it.n)) continue;
        this.taken.add(it.n);
        this.pickUp(it);
      }
      if (i === c.H - 1) this.finish(true);
    }
    pickUp(it) {
      if (it.kind === 'paw') {
        const k = this.pawItems.indexOf(it);
        if (k >= 0) this.paws[k] = true;
        this.addScore(P.coin); AG.sfx.play('star');
      } else if (it.kind === 'phone') {
        this.phone = true; this.mover.setSpeed('phone');
        AG.sfx.play('soft'); this.phoneTool.hidden = false;
        this.say('warning', STR.phone);
      } else if (it.kind === 'helmet') {
        this.helmet = true; this.rig.setGear('geared'); AG.sfx.play('collect'); this.say('success', STR.helmetOn);
      } else if (it.kind === 'vest') {
        this.vest = true; this.rig.setGear('geared'); AG.sfx.play('collect'); this.say('success', STR.vestOn); this.ctx.safe();
      }
      this.updateHud();
    }
    putAway() {
      if (!this.phone || this.ended) return;
      this.phone = false; this.mover.setSpeed('hop'); this.phoneTool.hidden = true;
      this.addScore(P.phoneAway); AG.sfx.play('good');
      this.say('success', STR.phoneOff, { sound: false }); this.ctx.safe();
      this.updateHud();
    }
    tap(p) {
      if (this.ended) return;
      if (this.phone && p.x >= 436 && p.y <= 44) { this.putAway(); return; }
      this.mover.queueDir('up');
    }
    honk(i, x) {
      const now = performance.now();
      if (now - (this.honkAt || 0) < 1500) return;
      const cx = x * TILE + TILE / 2;
      const near = this.traffic.vehicles(i).find(v => !v.stopped && (v.dir === 'R' ? v.x1 < cx && cx - v.x1 < 50 : v.x0 > cx && v.x0 - cx < 50));
      if (near) { this.honkAt = now; AG.sfx.play(near.kind === 'jeepney' ? 'safe-crossing.sfx.jeepney_horn' : 'safe-crossing.sfx.horn'); }
    }

    /* ---------- looking left and right (waiting is the trigger, on every device) ---------- */
    cancelLook() { if (this.look) { this.look = null; this.rig.play('idle'); } }
    updateLook(dt) {
      const c = this.course, i = this.lane();
      if (this.mover.moving || this.mover.queue.length || this.phone || this.looked || !c.curb(i) || c.stairs(i, this.mover.x)) {
        if (!this.mover.moving) this.idleMs = 0;
        return;
      }
      if (this.look) {
        this.look.t += dt * 1000;
        if (this.look.side === 'left' && this.look.t >= T.lookMs.left) { this.look = { side: 'right', t: 0 }; this.rig.play('look_right'); }
        else if (this.look.side === 'right' && this.look.t >= T.lookMs.right) {
          this.look = null; this.looked = true; this.rig.play('idle');
          AG.sfx.play('safe-crossing.sfx.looked');
        }
        return;
      }
      this.idleMs += dt * 1000;
      if (this.idleMs >= T.lookIdleMs) { this.look = { side: 'left', t: 0 }; this.rig.play('look_left'); }
    }

    /* ---------- mistakes ---------- */
    hit() {
      AG.sfx.play('safe-crossing.sfx.whistle');
      this.loseHeart(STR.oops, 'retry');
    }
    redLight() {
      this.stats.redLights++;
      AG.sfx.play('safe-crossing.sfx.whistle');
      this.loseHeart(STR.redLight, 'warning', { pose: AG.rig.resolve(this.ctx.expertId, 'stop').frame });
    }
    loseHeart(text, type, o) {
      this.hearts--; this.heartsLost++;
      this.crossing = null; this.looked = false; this.cancelLook(); this.idleMs = 0;
      this.mover.teleport(this.lastCurb.x, this.course.y(this.lastCurb.i), 'up');
      this.rig.play('oops'); this.rig.blink(T.blinkMs);
      this.oopsUntil = performance.now() + 700;
      this.safeUntil = this.traffic.t + T.blinkMs;
      AG.input.releaseAll();
      this.say(type, text, o);
      this.updateHud();
      if (this.hearts <= 0) this.finish(false);
    }

    /** A word box; info and warning come from the role expert, pointing. */
    say(type, text, o) {
      const ex = type === 'info' || type === 'warning';
      return this.ctx.say(type, text, Object.assign(ex ? { pose: AG.rig.resolve(this.ctx.expertId, 'point').frame } : {}, o || {}));
    }
    hint(id, type, text, ms) {
      const now = performance.now();
      if (now - (this.lastHint[id] || -1e9) < (ms || 2500)) return;
      this.lastHint[id] = now;
      this.say(type, text, { sound: false });
    }
    addScore(n, show) {
      this.score += n;
      if (show !== false && n) this.pop((n > 0 ? '+' : '−') + Math.abs(n), n > 0);
    }
    pop(text, good) {
      const r = this.stage.getBoundingClientRect(), c = this.view.cv.getBoundingClientRect();
      const p = this.cam.toScreen(this.mover.cx, this.mover.py), k = c.width / 480;
      AG.kit.pop(this.stage, Math.round(c.left - r.left + p.x * k), Math.round(c.top - r.top + p.y * k - 8), text, good);
    }

    /* ---------- the frame ---------- */
    frame(dt) {
      if (this.ended) return this.draw();
      this.usedMs += dt * 1000;
      const m = this.mover, c = this.course;
      this.traffic.update(dt, { slow: this.vest ? (i, v, L) => this.vestSlow(i, v, L) : null });
      m.update(dt);
      if (this.ended) return this.draw();
      this.updateLook(dt);
      const i = this.lane();
      // waiting at a lowered barrier counts (+50 once you cross after that train)
      const ahead = c.lanes[i + 1];
      if (!m.moving && ahead && ahead.t === 'rail' && this.traffic.barrierDown(i + 1)) this.waitedRail[i + 1] = this.traffic.rail(i + 1).trainNo();
      // hits: the mover's tile and pixel span; never on the footbridge deck
      const lt = c.lanes[i].t;
      if ((lt === 'road' || lt === 'rail') && !c.deck(i, m.x) && this.traffic.t >= this.safeUntil) {
        const half = T.hitbox / 2;
        if (this.traffic.hit(i, m.cx - half, m.cx + half)) this.hit();
      }
      this.sounds();
      this.cam.follow(m.cx, m.cy).update(dt);
      this.draw();
    }
    /** With the reflective vest, drivers coming at the player within 3 columns slow down. */
    vestSlow(i, v, L) {
      const pi = this.lane();
      if (i !== pi && i !== pi + 1) return 1;
      const px = this.mover.cx, [x0, x1] = SC.xRange(L.dir, v.u, v.len), reach = T.vest.cols * TILE;
      const coming = L.dir === 'R' ? x1 <= px + TILE / 2 && px - x1 < reach : x0 >= px - TILE / 2 && x0 - px < reach;
      return coming ? T.vest.factor : 1;
    }
    /** Bells when a barrier on screen comes down, a beep when a signal on screen turns WALK. */
    sounds() {
      const v = this.cam.view(), c = this.course, onScreen = i => { const y = c.y(i) * TILE; return y + TILE > v.y && y < v.y + v.h; };
      c.groups.forEach(g => {
        if (g.kind === 'rail') {
          const down = this.traffic.barrierDown(g.start);
          if (down && !this.prevBarrier[g.n] && onScreen(g.start)) AG.sfx.play('safe-crossing.sfx.bell');
          this.prevBarrier[g.n] = down;
        } else if (g.signal) {
          const ph = this.traffic.signal(g).phase;
          if (ph === 'walk' && this.prevPhase[g.n] && this.prevPhase[g.n] !== 'walk' && onScreen(g.start)) AG.sfx.play('safe-crossing.sfx.beep');
          this.prevPhase[g.n] = ph;
        }
      });
    }

    draw() {
      const g = this.view.ctx, cam = this.cam, map = this.map, c = this.course, t = performance.now() / 1000;
      g.fillStyle = '#1e1538'; g.fillRect(0, 0, 480, 270);
      cam.begin(g);
      map.draw(g, cam, t, ['floor', 'walls', 'objects']);
      const r = map.range(cam);
      const lanes = []; for (let y = r.y0; y <= r.y1; y++) lanes.push(c.lane(y));
      this.drawLandmarks(g, r);
      this.drawItems(g, lanes, t);
      const mask = SC.occlusion.mask(c, this.lane(), this.mover.x);
      lanes.forEach(i => this.drawLane(g, i, mask));
      map.draw(g, cam, t, ['overlay']);
      lanes.forEach(i => this.drawSignals(g, i, t));
      if (this.night) this.lights.forEach(L => AG.assets.draw(g, 'safe-crossing.overlay.streetlight', L.x * TILE, c.y(L.i) * TILE, TILE, TILE));
      this.drawPlayer(g, t);
      cam.end(g);
      if (this.dark) this.drawDark(g, t, lanes);
      if (this.phone) {
        AG.assets.draw(g, 'safe-crossing.overlay.phone', 0, 0, 480, 270);
        g.fillStyle = '#fff4cc'; g.fillRect(438, 6, 36, 36); g.fillStyle = '#1e1538'; g.strokeStyle = '#1e1538'; g.lineWidth = 2; g.strokeRect(439, 7, 34, 34);
        g.drawImage(AG.pixelIcon('📱', 24, true), 444, 12 - (this.reduce ? 0 : Math.floor(t * 4) % 2));
      }
    }
    drawLandmarks(g, r) {
      const c = this.course, home = c.y(0), school = c.y(c.H - 1);
      if (home >= r.y0 && home <= r.y1) [1, 13].forEach(x => g.drawImage(AG.pixelIcon('🏠', 24, true), x * TILE + 3, home * TILE + 3));
      if (school >= r.y0 && school <= r.y1) [2, 7, 12].forEach(x => g.drawImage(AG.pixelIcon('🏫', 24, true), x * TILE + 3, school * TILE + 3));
    }
    drawItems(g, lanes, t) {
      const c = this.course, bob = this.reduce ? 0 : Math.floor(t * 3) % 2;
      const EMOJI = { paw: '🐾', phone: '📱', helmet: '🪖', vest: '🦺' };
      for (const it of c.items) {
        if (this.taken.has(it.n) || !lanes.includes(it.i)) continue;
        g.drawImage(AG.pixelIcon(EMOJI[it.kind], 18, true), it.col * TILE + 6, c.y(it.i) * TILE + 6 - bob);
      }
      // a signal on the curb lights the way when a school zone starts
      c.groups.forEach(gr => { if (gr.school && lanes.includes(gr.start - 1)) g.drawImage(AG.pixelIcon('🏫', 12, true), 0 * TILE + 2, c.y(gr.start - 1) * TILE + 2); });
    }
    drawLane(g, i, mask) {
      const c = this.course, l = c.lanes[i], y = c.y(i) * TILE;
      if (l.t === 'parked') {
        for (const [col, kind] of l.cars) AG.assets.draw(g, 'safe-crossing.vehicle.' + kind + '.right', col * TILE, y, (T.lengths[kind] || 2) * TILE, TILE);
        return;
      }
      if (l.t === 'rail') {
        const down = this.traffic.barrierDown(i), key = down ? 'safe-crossing.barrier_down' : 'safe-crossing.barrier_up';
        for (const v of this.traffic.vehicles(i)) for (let k = 0; k < T.rail.cars; k++) AG.assets.draw(g, 'safe-crossing.vehicle.train.' + (v.dir === 'L' ? 'left' : 'right'), Math.round(v.x0) + k * 120, y, 120, TILE);
        for (let x = 0; x < W; x += 90) { AG.assets.draw(g, key, x, y + TILE - 12, 90, TILE); AG.assets.draw(g, key, x, y - TILE + 12, 90, TILE); }
        return;
      }
      if (l.t !== 'road') return;
      for (const v of this.traffic.vehicles(i)) {
        const span = SC.occlusion.clip(mask, i, v.x0, v.x1);
        if (!span) continue;
        const k = 'safe-crossing.vehicle.' + v.kind + '.' + (v.dir === 'L' ? 'left' : 'right');
        if (span[0] === v.x0 && span[1] === v.x1) { AG.assets.draw(g, k, Math.round(v.x0), y, v.len, TILE); continue; }
        g.save(); g.beginPath(); g.rect(Math.round(span[0]), y, Math.round(span[1] - span[0]), TILE); g.clip();
        AG.assets.draw(g, k, Math.round(v.x0), y, v.len, TILE);
        g.restore();
      }
    }
    /** The walk signal on the curb beside the zebra, below and above the road. */
    drawSignals(g, i, t) {
      const c = this.course, gr = c.groupAt(i);
      if (!gr || !gr.signal || i !== gr.start) return;
      const s = this.traffic.signal(gr);
      let key = 'safe-crossing.signal.' + s.phase;
      if (s.phase === 'flash' && !this.reduce && Math.floor(t * 4) % 2) key = 'safe-crossing.signal.stop';
      const x = (gr.zebra[1] + 1 <= 15 ? gr.zebra[1] + 1 : gr.zebra[0] - 1) * TILE + 7;
      AG.assets.draw(g, key, x, c.y(gr.start - 1) * TILE - 2, 16, 32);
      AG.assets.draw(g, key, x, c.y(gr.end + 1) * TILE - 2, 16, 32);
    }
    drawPlayer(g, t) {
      const m = this.mover, cx = m.cx, cy = m.cy - m.hopY, now = performance.now();
      g.fillStyle = 'rgba(30, 21, 56, .35)'; g.fillRect(cx - 6, m.cy + 6, 12, 3);
      if (this.helmet) this.drawBike(g, cx, cy, m.facing);
      if (this.vest) AG.assets.draw(g, 'safe-crossing.overlay.vest_glow', cx - 14, cy - 14, 28, 28);
      if (this.look) this.drawLook(g, cx, cy, this.look.side);
      else if (this.ended && this.won) { const hop = this.reduce ? 0 : Math.floor(t * 4) % 2 ? 3 : 0; AG.chars.drawTop(g, this.ctx.characterId, cx, cy - hop, 'down', { t }) || m.draw(g, t); }
      else m.draw(g, t);
      // gear badges for the heroes (AGILA's mini already wears her hard hat and vest)
      if (!this.frontAgila) {
        if (this.helmet) g.drawImage(AG.pixelIcon('🪖', 10, true), cx + 4, cy - 14);
        if (this.vest) g.drawImage(AG.pixelIcon('🦺', 10, true), cx - 14, cy - 14);
      }
      if (this.phone) g.drawImage(AG.pixelIcon('📱', 10, true), cx + 6, cy - 2);
      if (now < this.oopsUntil) g.drawImage(AG.pixelIcon('💦', 10, true), cx - 5, cy - 22);
      else if (this.looked && !m.moving) g.drawImage(AG.pixelIcon('👀', 10, true), cx - 5, cy - 22);
    }
    /** Looking left, then right: the front-facing mini, flipped toward the side, with an arrow. */
    drawLook(g, cx, cy, side) {
      const img = this.front, left = side === 'left';
      g.save(); g.imageSmoothingEnabled = false; g.translate(Math.round(cx), Math.round(cy));
      if (left) g.scale(-1, 1);
      if (img && img.complete && img.naturalWidth) {
        if (this.frontAgila) g.drawImage(img, -10, -8, 20, 15);
        else g.drawImage(img, 0, 0, 20, 20, -10, -10, 20, 20);
      } else this.mover.draw(g, 0);
      // the arrow beside the head, pointing the way they look
      g.fillStyle = '#ffd23f'; g.strokeStyle = '#1e1538';
      g.fillRect(12, -3, 2, 6); g.fillRect(14, -2, 1, 4); g.fillRect(15, -1, 1, 2);
      g.fillStyle = '#1e1538'; g.fillRect(11, -4, 1, 8);
      g.restore();
    }
    drawBike(g, cx, cy, facing) {
      g.save(); g.translate(Math.round(cx), Math.round(cy + 2));
      g.rotate((ROT[facing] || 0) * Math.PI / 2);
      AG.assets.draw(g, 'safe-crossing.bike', -10, -7, 20, 15);
      g.restore();
    }
    drawDark(g, t, lanes) {
      const c = this.course, D = T.dark, m = this.mover, lights = [{ x: m.cx, y: m.cy, r: this.vest ? D.vest : D.player }];
      this.lights.forEach(L => lights.push({ x: L.x * TILE + TILE / 2, y: c.y(L.i) * TILE + TILE / 2, r: D.streetlight }));
      const glows = [];
      lanes.forEach(i => {
        const y = c.y(i) * TILE;
        this.traffic.vehicles(i).forEach(v => {
          // headlights: every vehicle lights itself up, so nothing on the road is ever invisible
          lights.push({ x: (v.x0 + v.x1) / 2, y: y + TILE / 2, r: Math.min(D.vehicle + v.len / 2, 60) });
        });
        const gr = c.groupAt(i);
        if (gr && gr.signal && i === gr.start) {
          const s = this.traffic.signal(gr), x = (gr.zebra[1] + 1 <= 15 ? gr.zebra[1] + 1 : gr.zebra[0] - 1) * TILE + 7;
          glows.push({ x, y: c.y(gr.start - 1) * TILE - 2, w: 16, h: 32, key: 'safe-crossing.signal.' + s.phase, halo: 10 });
        }
        if (c.lanes[i].t === 'rail' && this.traffic.barrierDown(i)) glows.push({ x: 0, y: y + TILE - 12, w: 480, h: 4, draw: (cx2, x, yy) => { cx2.fillStyle = '#e0245e'; for (let k = 0; k < 480; k += 30) cx2.fillRect(x + k + 4, yy, 12, 3); } });
      });
      for (const it of c.items) if (!this.taken.has(it.n) && (it.kind === 'vest' || it.kind === 'phone') && lanes.includes(it.i)) glows.push({ x: it.col * TILE + 6, y: c.y(it.i) * TILE + 6, w: 18, h: 18, halo: 14, draw: (cx2, x, y) => cx2.drawImage(AG.pixelIcon(it.kind === 'vest' ? '🦺' : '📱', 18, true), x, y) });
      if (this.vest) glows.push({ x: m.cx - 14, y: m.cy - m.hopY - 14, w: 28, h: 28, key: 'safe-crossing.overlay.vest_glow' });
      this.dark.draw(g, { cam: this.cam, t, lights, glows });
    }

    /* ---------- the end ---------- */
    finish(won) {
      if (this.ended) return;
      this.ended = true; this.won = won;
      this.mover.enabled = false; this.cancelLook();
      if (won) { this.rig.play('cheer'); this.say('congratulations', STR.school, { sound: false }); AG.sfx.play('win'); }
      const run = {
        school: won, endless: this.endless, rows: this.maxLane, score: Math.max(0, this.score), heartsLost: this.heartsLost, heartsLeft: this.hearts,
        paws: this.paws.filter(Boolean).length, pawFlags: this.paws.slice(), usedMs: this.usedMs, vest: this.vest,
        stats: Object.assign({}, this.stats), world: this.entry.world, level: this.entry.level, night: this.night, targets: this.targets
      };
      this.onEnd(run);
    }
    destroy() {
      this.dead = true;
      if (this.stop) this.stop();
      this.offs.forEach(f => f()); this.offs = [];
      if (this.el) this.el.remove();
    }
  }

  SC.Scene = Scene;
})(window.AG);
