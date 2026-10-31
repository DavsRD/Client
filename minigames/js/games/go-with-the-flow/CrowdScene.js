/* 17 Go With the Flow: the model (FlowRun, no DOM, so a bot in kalasag-dev/minigames/tests/go-with-the-flow.test.js plays whole levels) and the scene.
 *   FlowRun     one level: the E7 Crowd + FlowField on the 960 × 540 map, the player (collision radius 6), the buddy, marshals, dropped items, stars,
 *               checkpoints, hearts, the surge (L5) and the slip (Advanced). The pressure recipe is js/logic/go-with-the-flow/pressure.js.
 *   CrowdScene  the canvas (480 × 270, a camera with a deadzone and integer scroll), the HUD, keyboard / follow-finger / joystick / BRACE input,
 *               the captions and the results. Numbers: tuning.js, levels: levels.json, masks: assets/games/go-with-the-flow/data/maps.json. */
(function (root) {
  const AG = root.AG = root.AG || {};
  const G = AG.goWithTheFlow = AG.goWithTheFlow || {};
  const T = G.tuning;
  const L = () => AG.logic.goWithTheFlow;
  const SIM = () => AG.logic.sim;
  const S = en => ({ en });
  const pick = v => AG.pick(v);

  /* ====================================================================================================================
   *  FlowRun: the model
   * ================================================================================================================== */
  class FlowRun extends SIM().Emitter {
    /** lv: a levels.json entry; map: the maps.json entry; o: { diff: 'easy' | 'advanced', seed, autoBrace, buddyId } */
    constructor(lv, map, o) {
      super();
      o = o || {};
      const R = L(), sim = SIM();
      this.lv = lv; this.map = map; this.diff = o.diff === 'advanced' ? 'advanced' : 'easy'; this.autoBrace = !!o.autoBrace;
      this.rnd = AG.util && AG.util.mulberry32 ? AG.util.mulberry32((o.seed || 1) >>> 0) : (() => { let s = (o.seed || 1) >>> 0; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); })();
      const rows = map.blocked, cell = map.cell;
      this.cell = cell; this.w = map.cols * cell; this.h = map.rows * cell;
      const grid = { w: map.cols, h: map.rows, passable: (cx, cy) => !!rows[cy] && rows[cy][cx] === '.' };
      this.grid = grid;
      this.solid = sim.Crowd.solidFromGrid(grid, cell);
      this.exits = map.exits.map(([fx, fy, fw, fh]) => ({ x: fx * this.w, y: fy * this.h, w: fw * this.w, h: fh * this.h }));
      const goals = [];
      this.exits.forEach(e => {
        for (let cy = Math.floor(e.y / cell); cy < Math.ceil((e.y + e.h) / cell); cy++) for (let cx = Math.floor(e.x / cell); cx < Math.ceil((e.x + e.w) / cell); cx++) if (grid.passable(cx, cy)) goals.push({ x: cx, y: cy });
      });
      this.flow = new sim.FlowField({ grid, cell, goals });

      const n = T.crowd.count[this.diff][lv.level - 1], mul = lv.surge ? lv.surge.mul : 1;
      this.count = n;
      this.crowd = new sim.Crowd({
        max: Math.ceil(n * Math.max(1, mul)), w: this.w, h: this.h, cell: 25, speed: T.crowd.speed[lv.level - 1], sepRadius: T.crowd.sepRadius,
        radius: 3, alignRadius: T.crowd.sepRadius, flow: this.flow, solid: this.solid, despawn: false, seed: (o.seed || 1) + lv.level
      });
      this.exited = 0; this.tokens = 2; this.exitRate = T.crowd.exitRate[lv.level - 1];
      this.crowd.on('remove', () => { this.exited++; });

      this.player = { x: lv.player.x, y: lv.player.y };
      this.vx = 0; this.vy = 0; this.speed = 0; this.facing = 'right'; this.brace = false; this.density = 0;
      const free = [[0, 21], [0, -21], [21, 0], [-21, 0]].find(([dx, dy]) => !this.solid(this.player.x + dx, this.player.y + dy)) || [0, 0];
      this.buddy = new G.Buddy({ x: this.player.x + free[0], y: this.player.y + free[1], solid: this.solid, meet: lv.meet, density: (x, y) => this.crowd.density(x, y, R.RULES.crowdRadius), tuning: T.buddy });
      this.buddy.on('lost', () => this.emit('lost'));
      this.buddy.on('reunite', () => { this.score100++; this.emit('reunite'); });
      this.score100 = 0;

      this.spawnCrowd(n);
      this.crowd.hash.build(this.crowd.x, this.crowd.y, this.crowd.n, this.crowd.alive);

      this.marshals = new G.Marshals({ list: lv.marshals, density: (x, y, r) => this.crowd.density(x, y, r), tuning: T.marshal });
      this.marshals.on('near', m => this.emit('near', m));
      this.marshals.on('follow', m => { this.pressure.add(-R.RULES.marshal.sub); this.emit('marshal', m); });
      this.items = lv.items.map(it => ({ x: it.x, y: it.y, icon: it.icon, used: false, stopper: new R.Stopper() }));
      this.stars = lv.stars.map(s => ({ x: s.x, y: s.y, got: false }));
      this.pressure = new R.Pressure();
      this.hearts = T.hearts; this.heartsLost = 0; this.stopped = 0;
      this.cp = 0; this.time = 0; this.thin = null; this.fall = null; this.fallCool = 0; this.surgeAt = lv.surge ? lv.surge.at : null; this.surgeLeft = 0; this.surgeAcc = 0;
      this.over = false; this.won = false; this.waitSaid = 0; this.hurtT = 0;
      this.tmp = {}; this.slips = 0; this.cacc = 0;
    }

    spawnCrowd(n) {
      const lv = this.lv, rnd = this.rnd, p = this.player, b = this.buddy, k = Math.sqrt(n / T.crowd.count.easy[lv.level - 1]); // more people take more room: the same starting density on both difficulties
      for (let j = 0; j < n; j++) {
        for (let tries = 0; tries < 30; tries++) {
          const r = lv.spawn[Math.floor(rnd() * lv.spawn.length)], x = r.x + r.w / 2 + (rnd() - 0.5) * r.w * k, y = r.y + r.h / 2 + (rnd() - 0.5) * r.h * k;
          if (this.solid(x, y) || Math.hypot(x - p.x, y - p.y) < 16 || Math.hypot(x - b.x, y - b.y) < 16) continue;
          this.crowd.spawn(x, y);
          break;
        }
      }
    }
    /** The exits let only so many people through per second: the rest queue up against them (that is the crush). */
    drainExits(dt) {
      const c = this.crowd;
      this.tokens = Math.min(3, this.tokens + this.exitRate * dt);
      for (let i = 0; i < c.n && this.tokens >= 1; i++) if (c.alive[i] && c.arrived[i]) { this.tokens--; c.remove(i); }
    }
    dragFactor(n) { const D = T.drag; return Math.max(D.min, 1 - D.per * Math.max(0, n - D.free)); }
    hitBody(x, y, r) { return this.solid(x - r, y - r) || this.solid(x + r, y - r) || this.solid(x - r, y + r) || this.solid(x + r, y + r); }
    inExit(x, y, pad) { return this.exits.some(e => x >= e.x - pad && x <= e.x + e.w + pad && y >= e.y - pad && y <= e.y + e.h + pad); }

    /** Pushes agents out of a body's circle (the player and the buddy are not walked through). */
    pushAgents(x, y, r) {
      const c = this.crowd;
      for (let i = 0; i < c.n; i++) {
        if (!c.alive[i]) continue;
        const dx = c.x[i] - x, dy = c.y[i] - y;
        if (Math.abs(dx) > r || Math.abs(dy) > r) continue;
        const d = Math.hypot(dx, dy);
        if (d >= r) continue;
        const ux = d > 0.01 ? dx / d : 1, uy = d > 0.01 ? dy / d : 0, nx = x + ux * r, ny = y + uy * r;
        if (!this.solid(nx, ny)) { c.x[i] = nx; c.y[i] = ny; }
      }
    }

    /** inp: { mx, my } (−1..1 each, length ≤ 1) or { tx, ty } (a world point to walk toward), and brace. */
    update(dt, inp) {
      if (this.over || !(dt > 0)) return this;
      dt = Math.min(dt, 0.05); inp = inp || {};
      if (this.fall) { this.updateFall(dt); return this; }
      const R = L(), RU = R.RULES, c = this.crowd, p = this.player;
      this.time += dt; this.hurtT = Math.max(0, this.hurtT - dt); this.fallCool = Math.max(0, this.fallCool - dt);
      this.surgeStep(dt);
      // the crowd steps at 30 Hz (the player and everything you control run every frame): half the cost, and 40 px/s agents move 1.3 px a step
      this.cacc += dt;
      if (this.cacc >= T.crowd.step) { c.update(this.cacc); this.drainExits(this.cacc); this.cacc = 0; }
      this.thinStep(dt);

      // the player's own move (the same speed on every device)
      let mx = inp.mx || 0, my = inp.my || 0;
      if (inp.tx != null) { const dx = inp.tx - p.x, dy = inp.ty - p.y, d = Math.hypot(dx, dy), step = T.player.speed * dt; if (d > 2) { const k = Math.min(1, d / step) / d; mx = dx * k; my = dy * k; } }
      const mag = Math.hypot(mx, my); if (mag > 1) { mx /= mag; my /= mag; }
      const dens0 = c.density(p.x, p.y, RU.crowdRadius);
      this.brace = !!inp.brace || (this.autoBrace && dens0 >= RU.still.density);
      const v = T.player.speed * (this.brace ? T.player.brace : 1) * this.dragFactor(dens0), r = T.player.r;
      const nx = p.x + mx * v * dt, ny = p.y + my * v * dt, ox = p.x, oy = p.y;
      if (!this.hitBody(nx, p.y, r)) p.x = nx;
      if (!this.hitBody(p.x, ny, r)) p.y = ny;
      this.vx = (p.x - ox) / dt; this.vy = (p.y - oy) / dt; this.speed = Math.hypot(this.vx, this.vy); // the player's OWN walking (what the pressure rules read)
      // a packed crowd carries you along with the flow (so fighting it gets you nowhere, and walls pin you)
      const carry = Math.min(1, Math.max(0, dens0 - T.carry.free) / T.carry.span) * T.carry.k;
      if (carry > 0) {
        const f = this.flow.sample(p.x, p.y, this.tmp), d = T.crowd.speed[this.lv.level - 1] * carry * dt, cx = p.x + f.x * d, cy = p.y + f.y * d;
        if (!this.hitBody(cx, p.y, r)) p.x = cx;
        if (!this.hitBody(p.x, cy, r)) p.y = cy;
      }
      if (mag > 0.05) this.facing = Math.abs(mx) > Math.abs(my) ? (mx > 0 ? 'right' : 'left') : (my > 0 ? 'down' : 'up');

      this.buddy.update(dt, p.x, p.y);
      this.pushAgents(p.x, p.y, T.crowd.push); this.pushAgents(this.buddy.x, this.buddy.y, T.crowd.push);

      // the pressure
      const dens = c.density(p.x, p.y, RU.crowdRadius); this.density = dens;
      let cos = null, toLower = false;
      if (this.speed >= RU.still.speed) {
        const ux = this.vx / this.speed, uy = this.vy / this.speed, f = this.flow.sample(p.x, p.y, this.tmp);
        cos = ux * f.x + uy * f.y;
        toLower = c.density(p.x + ux * 14, p.y + uy * 14, RU.crowdRadius) < dens;
      }
      let nearWall = false;
      for (let k = 0; k < 8 && !nearWall; k++) nearWall = this.solid(p.x + Math.cos(k * Math.PI / 4) * RU.wall.dist, p.y + Math.sin(k * Math.PI / 4) * RU.wall.dist);
      this.pressure.update(dt, { density: dens, cos, speed: this.speed, nearWall, toLower, brace: this.brace });

      // dropped things: stopping on one is the mistake, walking over is fine
      this.items.forEach(it => {
        if (it.used) return;
        if (it.stopper.update(dt, this.speed, Math.hypot(it.x - p.x, it.y - p.y))) { it.used = true; this.stopped++; this.hurtT = 1.2; this.pressure.add(RU.item.add); this.emit('item', it); }
      });
      this.marshals.update(dt, p.x, p.y, this.vx, this.vy);
      this.stars.forEach((s, i) => { if (!s.got && Math.hypot(s.x - p.x, s.y - p.y) <= T.star.r) { s.got = true; this.emit('star', i); } });
      this.lv.checkpoints.forEach((cp, i) => { if (i > this.cp && Math.hypot(cp.x - p.x, cp.y - p.y) <= T.checkpoint.r) this.cp = i; });

      if (this.pressure.full) { this.loseHeart('pressure', true); if (this.over) return this; }
      if (this.diff === 'advanced' && !this.fallCool && this.rnd() < R.fallChance(this.pressure.value, dt, true)) { this.fall = { t: 0, ms: RU.fall.ms, done: false }; this.slips++; this.emit('fall'); return this; }

      // the exit: you and your buddy
      if (this.inExit(p.x, p.y, 2)) {
        if (this.buddy.state === 'with' && this.inExit(this.buddy.x, this.buddy.y, 10)) this.finish(true);
        else if (this.time - this.waitSaid > 6) { this.waitSaid = this.time; this.emit('waitBuddy', { lost: this.buddy.isLost }); }
      }
      return this;
    }
    surgeStep(dt) {
      const s = this.lv.surge;
      if (!s) return;
      if (!this.surged && this.time >= s.at) {
        this.surged = true; this.surgeLeft = Math.floor(this.count * (s.mul - 1)); this.surgeTotal = this.surgeLeft; this.emit('surge');
      }
      if (this.surgeLeft > 0) {
        this.surgeAcc += this.surgeTotal * dt / (s.ms / 1000);
        while (this.surgeAcc >= 1 && this.surgeLeft > 0) {
          this.surgeAcc--; this.surgeLeft--;
          const r = s.rects[Math.floor(this.rnd() * s.rects.length)], x = r.x + this.rnd() * r.w, y = r.y + this.rnd() * r.h;
          if (!this.solid(x, y)) this.crowd.spawn(x, y, { mul: 1.1 });
        }
      }
    }
    /** For 3 s after a lost heart nobody stands within 40 px of the checkpoint. */
    thinStep(dt) {
      const th = this.thin;
      if (!th) return;
      th.t -= dt * 1000;
      if (th.t <= 0) { this.thin = null; return; }
      const c = this.crowd, r = T.crowd.thin.r;
      for (let i = 0; i < c.n; i++) {
        if (!c.alive[i]) continue;
        const dx = c.x[i] - th.x, dy = c.y[i] - th.y, d = Math.hypot(dx, dy);
        if (d >= r) continue;
        const ux = d > 0.01 ? dx / d : 1, uy = d > 0.01 ? dy / d : 0;
        if (!this.solid(th.x + ux * r, th.y + uy * r)) { c.x[i] = th.x + ux * r; c.y[i] = th.y + uy * r; }
      }
    }
    loseHeart(why, respawn) {
      this.hearts--; this.heartsLost++; this.hurtT = 1.5;
      this.emit('heart', { why, hearts: this.hearts });
      if (this.hearts <= 0) { this.finish(false); return; }
      if (respawn) {
        const cp = this.lv.checkpoints[this.cp];
        this.player.x = cp.x; this.player.y = cp.y; this.vx = this.vy = this.speed = 0;
        const free = [[0, 21], [0, -21], [21, 0], [-21, 0]].find(([dx, dy]) => !this.solid(cp.x + dx, cp.y + dy)) || [0, 0];
        this.buddy.teleport(cp.x + free[0], cp.y + free[1]);
        this.thin = { x: cp.x, y: cp.y, t: T.crowd.thin.ms };
        this.pressure.reset(L().RULES.respawn);
      } else this.pressure.reset(L().RULES.respawn + 20);
    }
    /** The slip: Space / tap in time protects the head and gets you up; too late costs a heart. → true when it counted. */
    answerFall() {
      const f = this.fall;
      if (!f || f.done || f.t < T.fall.tapGuard) return false;
      f.done = true; f.ok = true; f.t = Math.min(f.t, f.ms - 1);
      this.pressure.add(-20); this.fallCool = 6; this.emit('fallEnd', { ok: true });
      this.fall = null;
      return true;
    }
    updateFall(dt) {
      const f = this.fall; f.t += dt * 1000;
      if (f.t >= f.ms) { this.fall = null; this.fallCool = 6; this.emit('fallEnd', { ok: false }); this.loseHeart('fall', false); }
    }
    finish(won) {
      if (this.over) return;
      this.over = true; this.won = won; this.emit('end', this.result());
    }
    result() {
      const R = L(), a = { won: this.won, peak: Math.round(this.pressure.peak), marshals: this.marshals.followedCount, buddyLost: this.buddy.everLost, heartsLost: this.heartsLost, reunites: this.buddy.reunites, timeSec: this.time, par: T.parSec[this.lv.level - 1] };
      const stars = R.stars(a);
      return Object.assign(a, { stars, score: this.won ? R.score(a) : Math.round(R.score(a) * 0.3), stopped: this.stopped, hearts: this.hearts, collected: this.stars.map(s => s.got) });
    }
  }

  /* ====================================================================================================================
   *  CrowdScene: canvas, HUD, input
   * ================================================================================================================== */
  const STR = {
    pressure: S('Pressure'), brace: S('BRACE'), hearts: S('Hearts left'),
    hintKey: S('Arrows / WASD: walk · hold Space: arms in front (brace) · stay close to your buddy'),
    hintTouch: S('Drag to walk · hold 🛡️ BRACE with your other thumb · stay close to your buddy'),
    hintStick: S('Drag to steer the joystick · hold 🛡️ BRACE with your other thumb · stay close to your buddy'),
    hintAuto: S('Auto-brace is on: just walk. Stay close to your buddy.'),
    high: S('Too much pressure! Move WITH the flow and edge toward the side, away from the packed middle.'),
    leave: S('Leave it! Never stop to pick things up.'),
    meet: S('Go to your meeting point!'),
    reunited: S('Reunited! Stay with your buddy.'),
    marshal: S('Good! Follow the marshals: they know the less crowded way.'),
    marshalPop: S('Marshal! −10'),
    heart: S('Too much pressure. Slow down, move with the flow and keep your arms in front. Try again from the checkpoint.'),
    wait: S('Wait for your buddy. You leave together.'),
    waitLost: S('Find your buddy first! Go to the meeting point 📍.'),
    surge: S('A loud noise! The crowd surges. Stay calm, don\'t push: edge diagonally out of the pack.'),
    slip: S('You slipped! Protect your head, then get up fast!'),
    slipOk: S('Good! Head protected and back on your feet.'),
    slipBad: S('Too slow. When you fall, protect your head and get up fast.'),
    star: S('Calm spot! +1 ⭐'),
    win3: S('Perfect! Calm, together and no hearts lost. You walked with the flow.'),
    win2: S('Great! For 3 stars: keep the pressure at 50 or less, never lose your buddy and lose no hearts.'),
    win1: S('You got out together! For more stars, move with the flow toward the side, follow a marshal and keep the pressure down.'),
    lose: S('That was a lot of pressure. In a crowd: walk, don\'t push, move with the flow toward the side. Try again!'),
    rowPeak: S('Peak pressure'), rowMarshal: S('Marshals followed'), rowBuddy: S('Buddy kept'), rowHearts: S('Hearts left'), rowTime: S('Time'), rowItems: S('Stopped for things'), rowStars: S('Calm spots'),
    yes: S('Yes'), no: S('Lost once'), none: S('Never'),
    shape: ['●', '■', '▲']
  };
  const INK = '#1e1538', GOLD = '#ffd23f';
  const pressureShape = v => (v >= 70 ? 2 : v >= 35 ? 1 : 0);

  const CSS = `
#ag-app .gwf { display: grid; gap: 6px; justify-items: center; width: 100%; }
#ag-app .gwf-box { position: relative; width: 100%; max-width: calc(62vh * 1.7778); }
#ag-app .gwf-box canvas { touch-action: none; }
#ag-app .gwf-hint { width: 100%; max-width: calc(62vh * 1.7778); font-size: .85rem; color: var(--muted); font-weight: 700; min-height: 1.2em; }
#ag-app .gwf-brace { display: inline-flex; align-items: center; gap: 4px; padding: 2px 8px; border: 3px solid #1e1538; background: #3ec7ff; color: #1e1538; font-weight: 800; font-size: .8rem; box-shadow: 0 2px 0 #1e1538; }
#ag-app .gwf-brace[hidden] { display: none; }
#ag-app .ag-padbtn[data-action="BRACE"] { min-width: 120px; min-height: 56px; }`;

  /** Outlined pixel text so it reads on every map. */
  function label(c, str, x, y, o) {
    o = Object.assign({ size: 10, color: '#fff' }, o);
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) AG.gfx.text(c, str, x + dx, y + dy, Object.assign({}, o, { color: INK }));
    AG.gfx.text(c, str, x, y, o);
  }
  /* 5 × 5 pixel heart for the "holding hands" connector */
  const HEART = ['.#.#.', '#####', '#####', '.###.', '..#..'];
  function pixelHeart(c, cx, cy) {
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) { c.fillStyle = INK; HEART.forEach((row, y) => row.split('').forEach((ch, x) => { if (ch === '#') c.fillRect(cx - 2 + x + dx, cy - 2 + y + dy, 1, 1); })); }
    c.fillStyle = '#ff4d6d'; HEART.forEach((row, y) => row.split('').forEach((ch, x) => { if (ch === '#') c.fillRect(cx - 2 + x, cy - 2 + y, 1, 1); }));
  }
  /* a small shape marker: ● calm, ■ busy, ▲ danger (never colour alone) */
  function shapeMark(c, kind, x, y, col) {
    c.fillStyle = INK;
    if (kind === 0) { c.fillRect(x + 1, y, 5, 7); c.fillRect(x, y + 1, 7, 5); c.fillStyle = col; c.fillRect(x + 2, y + 1, 3, 5); c.fillRect(x + 1, y + 2, 5, 3); }
    else if (kind === 1) { c.fillRect(x, y, 7, 7); c.fillStyle = col; c.fillRect(x + 1, y + 1, 5, 5); }
    else { c.fillRect(x, y + 5, 7, 2); c.fillRect(x + 1, y + 3, 5, 2); c.fillRect(x + 2, y + 1, 3, 2); c.fillRect(x + 3, y, 1, 1); c.fillStyle = col; c.fillRect(x + 1, y + 5, 5, 1); c.fillRect(x + 2, y + 3, 3, 2); c.fillRect(x + 3, y + 1, 1, 2); }
  }

  class CrowdScene {
    constructor(stage, ctx, done, map) {
      if (!document.querySelector('style[data-ag-css="go-with-the-flow"]')) document.head.append(AG.util.h('style', { 'data-ag-css': 'go-with-the-flow' }, CSS));
      const { h } = AG.util;
      this.stage = stage; this.ctx = ctx; this.doneFn = done; this.lv = ctx.levelData; this.map = map;
      this.diff = ctx.difficulty === 'advanced' ? 'advanced' : 'easy';
      this.reduce = AG.reducedMotion(); this.finished = false; this.dead = false; this.real = 0; this.camX = 0; this.camY = 0;
      this.say0 = {}; this.popped = 0; this.hintTick = 0; this.ptr = null; this.fallT = 0;

      // the buddy: a random Ready Squad hero that is not the player's character
      const rnd = AG.util.mulberry32((ctx.seed >>> 0) || 1), heroes = ['comms', 'medic', 'logistics', 'rescue', 'firesafety'].filter(id => id !== ctx.characterId);
      this.buddyId = heroes[Math.floor(rnd() * heroes.length)];
      this.run = new FlowRun(this.lv, map, { diff: this.diff, seed: ctx.seed, autoBrace: !!AG.store.setting('autoBrace') });
      this.setAuto = () => { this.run.autoBrace = !!AG.store.setting('autoBrace'); };
      this.offs = [AG.on('ag:settings', this.setAuto)];

      this.view = AG.gfx.canvas(T.W, T.H);
      this.rig = ctx.rig('top', { height: 20 });
      this.buddyRig = new AG.CharacterRig(stage, this.buddyId, 'top');
      this.sideRig = ctx.rig('side', { height: 72 });
      this.hintEl = h('div', { class: 'gwf-hint' });
      this.box = h('div', { class: 'gwf-box' }, this.view.cv);
      this.el = h('div', { class: 'gwf' }, this.box, this.hintEl);
      stage.append(this.el);
      this.braceChip = h('span', { class: 'gwf-brace', hidden: true }, braceIcon(), h('span', {}, pick(STR.brace)));
      this.hud = ctx.hud({ hearts: T.hearts, score: 0, label: STR.pressure });
      this.hud.el.append(this.braceChip);
      this.hud.set({ hearts: this.run.hearts, score: 0, label: { en: '0 ' + STR.shape[0] } });
      this.hudAt = -1;

      this.sprites = buildSprites();
      this.crowdView = new AG.sim.CrowdView({ crowd: this.run.crowd, sprites: this.sprites, floor: T.crowd.floor, variant: i => i % 4 });
      this.crowdView.on('reduce', e => { this.reduced = e; });
      AG.sfx.preload(T.sfx);
      this.murmur = AG.sfx.loop(T.sfxKey.murmur, { volume: 0.3 });
      this.bindInput();
      this.centreCamera();
      this.wire();
      if (AG.debug && AG.debug.on) G.live = { scene: this, run: this.run };
      ctx.after(500, () => ctx.say('instruction', this.lv.blurb));
      this.stopLoop = AG.gfx.loop(dt => this.frame(dt));
    }

    /* ---------- input ---------- */
    bindInput() {
      const I = AG.input;
      I.register('BRACE', { keys: ['Space'], button: S('🛡️ BRACE') });
      I.pointerMode('follow'); I.setView(this.view);
      this.pad = I.touchControls(this.ctx.controls, { dpad: false, buttons: [{ action: 'BRACE', label: S('🛡️ BRACE'), hold: true }] });
      this.offs.push(
        I.onPointer('down', info => { if (this.run.fall) { this.answerFall(); return; } this.ptr = { x: info.x, y: info.y, ox: info.x, oy: info.y, device: info.device }; }),
        I.onPointer('move', info => { if (this.ptr) { this.ptr.x = info.x; this.ptr.y = info.y; } }),
        I.onPointer('up', () => { this.ptr = null; }),
        I.on('CONFIRM', e => { if (e.phase === 'down' && this.run.fall) this.answerFall(); })
      );
      this.onUp = () => { this.ptr = null; };
      window.addEventListener('pointercancel', this.onUp); window.addEventListener('blur', this.onUp);
      this.offs.push(() => { window.removeEventListener('pointercancel', this.onUp); window.removeEventListener('blur', this.onUp); });
    }
    /** → { mx, my, tx, ty, brace } from the keyboard, else the finger (follow or joystick) or the mouse. */
    readInput() {
      const I = AG.input, inp = { brace: I.isDown('BRACE') };
      let mx = (I.isDown('RIGHT') ? 1 : 0) - (I.isDown('LEFT') ? 1 : 0), my = (I.isDown('DOWN') ? 1 : 0) - (I.isDown('UP') ? 1 : 0);
      if (mx || my) { const d = Math.hypot(mx, my); inp.mx = mx / d; inp.my = my / d; return inp; }
      const p = this.ptr;
      if (p) {
        if (p.device === 'touch' && AG.store.setting('gwfJoystick')) {
          const dx = p.x - p.ox, dy = p.y - p.oy, d = Math.hypot(dx, dy);
          if (d > 4) { const k = Math.min(1, d / 22) / d; inp.mx = dx * k; inp.my = dy * k; }
        } else { inp.tx = p.x + this.camX; inp.ty = p.y + this.camY; }
      }
      return inp;
    }
    answerFall() { if (this.run.answerFall()) this.sideRig.play('duck_cover'); }

    /* ---------- the run's events become captions, sounds and the end ---------- */
    wire() {
      const r = this.run, ctx = this.ctx, ex = ctx.expertId;
      const warn = (key, text, ms, action) => { if (this.real - (this.say0[key] || -99) < (ms || 8)) return; this.say0[key] = this.real; ctx.say(key === 'high' ? 'warning' : 'instruction', text, action ? { pose: AG.rig.resolve(ex, action).frame } : undefined); };
      r.pressure.on('full', () => AG.sfx.play(T.sfxKey.pressure));
      r.on('item', it => { ctx.say('retry', STR.leave); this.pop('+25', it.x, it.y - 10, false); AG.sfx.play('oops'); });
      r.on('lost', () => { ctx.say('instruction', STR.meet); AG.sfx.play('blip'); });
      r.on('reunite', () => { ctx.say('success', STR.reunited); AG.sfx.play(T.sfxKey.reunite); this.pop('+100', r.player.x, r.player.y - 16, true); });
      r.on('marshal', m => { AG.sfx.play(T.sfxKey.whistle); this.pop(pick(STR.marshalPop), m.x, m.y - 24, true); this.say0.marshal || ctx.say('success', STR.marshal); this.say0.marshal = 1; });
      r.on('near', () => AG.sfx.play(T.sfxKey.whistle, { volume: 0.4 }));
      r.on('star', i => { AG.sfx.play('collect'); this.pop('⭐', r.stars[i].x, r.stars[i].y - 8, true); });
      r.on('heart', e => { this.hud.set({ hearts: Math.max(0, e.hearts) }); if (e.hearts > 0) { ctx.say('encouragement', e.why === 'fall' ? STR.slipBad : STR.heart); AG.sfx.play('hit'); } });
      r.on('waitBuddy', e => ctx.say('instruction', e.lost ? STR.waitLost : STR.wait));
      r.on('surge', () => { AG.sfx.play(T.sfxKey.noise); ctx.say('warning', STR.surge, { pose: AG.rig.resolve(ex, 'alert').frame }); this.surgeFlash = this.real; });
      r.on('fall', () => { ctx.say('warning', STR.slip, { pose: AG.rig.resolve(ex, 'alert').frame }); this.sideRig.play('oops'); AG.sfx.play('oops'); this.fallT = 0; });
      r.on('fallEnd', e => { if (e.ok) { ctx.say('success', STR.slipOk); this.sideRig.play('duck_cover'); ctx.after(0, () => {}); } });
      r.on('end', res => this.finish(res));
      this.warnHigh = warn;
    }
    pop(text, wx, wy, good) {
      const k = this.box.clientWidth / T.W || 1;
      AG.kit.pop(this.box, Math.round((wx - this.camX) * k), Math.round((wy - this.camY) * k), text, good !== false);
    }

    /* ---------- the frame ---------- */
    frame(dt) {
      dt = Math.min(dt, 0.05); this.real += dt;
      const r = this.run;
      if (!this.finished) {
        r.update(dt, this.readInput());
        this.updateCamera();
        this.syncRig(dt);
        if (r.pressure.value >= 70 && !r.fall) this.warnHigh('high', STR.high, 15, 'alert');
        if ((this.hintTick += dt) > 0.4) { this.hintTick = 0; this.setHint(); this.syncHud(); }
        if (r.fall) this.fallT += dt;
      }
      this.draw();
    }
    syncRig(dt) {
      const r = this.run, rig = this.rig;
      rig.setFacing(r.facing);
      const moving = r.speed >= 5;
      rig.play(r.won ? 'cheer' : r.hurtT > 0 ? 'oops' : r.pressure.value >= 70 ? 'alert' : moving ? 'walk' : 'idle');
      this.buddyRig.setFacing(r.buddy.facing); this.buddyRig.play(r.buddy.moving ? 'walk' : 'idle');
      this.braceChip.hidden = !r.brace;
    }
    syncHud() {
      const r = this.run, v = Math.round(r.pressure.value);
      if (v !== this.hudAt) { this.hudAt = v; this.hud.set({ label: { en: v + ' ' + STR.shape[pressureShape(v)] }, score: this.liveScore() }); }
    }
    liveScore() { const r = this.run; return Math.round(r.marshals.followedCount * 50 + r.score100 * 100); }
    setHint() {
      const touch = AG.input.lastDevice === 'touch', auto = AG.store.setting('autoBrace');
      this.hintEl.textContent = pick(auto ? STR.hintAuto : touch ? (AG.store.setting('gwfJoystick') ? STR.hintStick : STR.hintTouch) : STR.hintKey);
    }
    centreCamera() { this.camX = this.clampX(this.run.player.x - T.W / 2); this.camY = this.clampY(this.run.player.y - T.H / 2); }
    clampX(x) { return Math.round(Math.max(0, Math.min(T.mapW - T.W, x))); }
    clampY(y) { return Math.round(Math.max(0, Math.min(T.mapH - T.H, y))); }
    updateCamera() {
      const p = this.run.player, C = T.camera, l = (T.W - C.dzw) / 2, t = (T.H - C.dzh) / 2;
      let cx = this.camX, cy = this.camY;
      if (p.x - cx < l) cx = p.x - l; else if (p.x - cx > l + C.dzw) cx = p.x - l - C.dzw;
      if (p.y - cy < t) cy = p.y - t; else if (p.y - cy > t + C.dzh) cy = p.y - t - C.dzh;
      this.camX = this.clampX(cx); this.camY = this.clampY(cy);
    }

    /* ---------- drawing ---------- */
    draw() {
      const c = this.view.ctx, r = this.run, t = performance.now() / 1000, cx = this.camX, cy = this.camY;
      c.imageSmoothingEnabled = false;
      AG.assets.draw(c, T.art.map(this.lv.level), -cx, -cy, T.mapW, T.mapH);
      this.drawMarks(c, r, t, cx, cy);
      this.drawCrowd(c, r, t, cx, cy);
      r.marshals.draw(c, t, cx, cy);
      this.drawPair(c, r, t, cx, cy);
      this.drawPointer(c);
      this.drawHud(c, r, t);
      if (r.fall) this.drawFall(c, r);
    }
    /** The crowd: only the agents on screen are drawn; the CrowdView's FpsGovernor still times every frame and cuts the crowd by 25 % when the fps stays under 45. */
    drawCrowd(c, r, t, cx, cy) {
      const cv = this.crowdView, cr = r.crowd, sp = this.sprites, W = T.W + 10, H = T.H + 10, fr = Math.floor(t * 8);
      if (cv.gov && cv.gov.tick(performance.now())) {
        const to = Math.max(T.crowd.floor, Math.floor(cr.count * cv.gov.factor));
        if (to < cr.count) { const from = cr.count; cr.limit(to); this.reduced = { from, to: cr.count, fps: cv.gov.fps }; }
      }
      for (let i = 0; i < cr.n; i++) {
        if (!cr.alive[i]) continue;
        const x = cr.x[i] - cx, y = cr.y[i] - cy;
        if (x < -10 || y < -10 || x > W || y > H) continue;
        sp.draw(c, x, y, i, cr.vx[i] * cr.vx[i] + cr.vy[i] * cr.vy[i] > 16 ? fr + (i % 3) : 0);
      }
    }
    drawMarks(c, r, t, cx, cy) {
      const lv = this.lv;
      AG.assets.draw(c, T.art.meet, Math.round(lv.meet.x - 6 - cx), Math.round(lv.meet.y - 16 - cy), 12, 16);
      label(c, 'MEET', Math.round(lv.meet.x - cx), Math.round(lv.meet.y - 28 - cy), { align: 'center' });
      r.items.forEach(it => { if (!it.used) AG.gfx.drawIcon(c, it.icon, Math.round(it.x - 9 - cx), Math.round(it.y - 9 - cy), 1); });
      r.stars.forEach(s => {
        c.save(); c.globalAlpha = s.got ? 0.3 : 1;
        AG.gfx.drawIcon(c, 'star', Math.round(s.x - 9 - cx), Math.round(s.y - 9 - cy - (this.reduce ? 0 : Math.floor(t * 2) % 2)), 1); c.restore();
      });
    }
    drawPair(c, r, t, cx, cy) {
      const p = r.player, b = r.buddy, px = Math.round(p.x - cx), py = Math.round(p.y - cy), bx = Math.round(b.x - cx), by = Math.round(b.y - cy);
      // buddy first when it is behind (higher on screen), so overlaps look right
      const buddyFirst = by < py;
      const drawBuddy = () => {
        if (!AG.chars.drawTop(c, this.buddyId, bx, by, b.facing, { t, moving: b.moving })) { // token fallback
          c.fillStyle = INK; c.fillRect(bx - 7, by - 7, 14, 14); c.fillStyle = (AG.CHARS[this.buddyId] || {}).color || '#ff9f1c'; c.fillRect(bx - 6, by - 6, 12, 12);
          AG.gfx.text(c, this.buddyId[0].toUpperCase(), bx, by - 5, { size: 10, align: 'center', color: INK, bold: true });
        }
        if (b.isLost) AG.gfx.drawIcon(c, '📍', bx - 9, by - 28, 1);
      };
      if (buddyFirst) drawBuddy();
      this.rig.draw(c, px, py, t);
      if (!buddyFirst) drawBuddy();
      if (!b.isLost && Math.hypot(b.x - p.x, b.y - p.y) < T.buddy.hold + 6) pixelHeart(c, Math.round((px + bx) / 2), Math.round((py + by) / 2) - 1);
      if (r.brace) AG.gfx.drawIcon(c, '🛡️', px - 9, py - 30, 1);
      // a compass to the meeting point while the buddy is lost
      if (b.isLost) {
        const dx = this.lv.meet.x - p.x, dy = this.lv.meet.y - p.y, d = Math.hypot(dx, dy) || 1;
        if (d > 60) { const ax = Math.round(px + dx / d * 30), ay = Math.round(py + dy / d * 30); AG.sim.draw.line(c, px + Math.round(dx / d * 16), py + Math.round(dy / d * 16), ax, ay, { color: INK, size: 4 }); AG.sim.draw.line(c, px + Math.round(dx / d * 16), py + Math.round(dy / d * 16), ax, ay, { color: '#ff4d6d', size: 2 }); AG.gfx.drawIcon(c, '📍', ax - 9, ay - 18, 1); }
      }
    }
    drawPointer(c) {
      const p = this.ptr;
      if (!p || p.device !== 'touch' || !AG.store.setting('gwfJoystick')) return;
      c.save(); c.globalAlpha = 0.6;
      c.fillStyle = INK; c.fillRect(Math.round(p.ox) - 14, Math.round(p.oy) - 14, 28, 28);
      c.fillStyle = '#fff8e6'; c.fillRect(Math.round(p.ox) - 12, Math.round(p.oy) - 12, 24, 24);
      const dx = p.x - p.ox, dy = p.y - p.oy, d = Math.hypot(dx, dy) || 1, k = Math.min(10, d) / d;
      c.fillStyle = GOLD; c.fillRect(Math.round(p.ox + dx * k) - 5, Math.round(p.oy + dy * k) - 5, 10, 10);
      c.restore();
    }
    drawHud(c, r, t) {
      const v = r.pressure.value, ratio = v / 100, D = AG.sim.draw, strip = AG.assets.image(T.art.pressure);
      // the pressure meter: the art's gradient fills it, ▲ marks danger and ● marks calm, and the number and shape sit beside it
      D.bar(c, 5, 8, 68, 12, ratio, { markers: [{ at: 0.7, kind: 'danger' }, { at: 0.3, kind: 'safe' }], fill: 'rgba(0,0,0,0)' });
      if (strip.ok && ratio > 0) c.drawImage(strip.img, 0, 0, Math.max(1, Math.round(64 * ratio)), 10, 7, 9, Math.max(1, Math.round(64 * ratio)), 10);
      else { c.fillStyle = ratio >= 0.7 ? '#e0245e' : ratio >= 0.35 ? '#ff9f1c' : '#2f8a4a'; c.fillRect(7, 9, Math.round(64 * ratio), 10); }
      const kind = pressureShape(v), col = ['#7ee08a', '#ffd23f', '#ff5a7a'][kind];
      shapeMark(c, kind, 78, 10, col);
      label(c, String(Math.round(v)), 88, 8, { size: 10, color: kind === 2 ? '#ff9db2' : '#fff' });
      AG.gfx.drawIcon(c, 'heart', T.W - 70, 3, 1); label(c, '×' + r.hearts, T.W - 50, 8, { size: 10 });
      if (r.brace) { AG.gfx.drawIcon(c, '🛡️', 4, 22, 1); }
      if (r.crowd.count > 0 && AG.debug && AG.debug.on) label(c, r.crowd.count + ' ' + Math.round(this.crowdView.fpsNow || 0) + 'fps', T.W - 4, T.H - 12, { size: 10, align: 'right' });
      // the danger edge: a dashed border (a shape, not only red) while the pressure is high
      if (v >= 70) {
        const on = this.reduce || Math.floor(t * 4) % 2 === 0;
        c.fillStyle = on ? 'rgba(224,36,94,.85)' : 'rgba(224,36,94,.45)';
        for (let x = 0; x < T.W; x += 12) { c.fillRect(x, 0, 6, 3); c.fillRect(x + 6, T.H - 3, 6, 3); }
        for (let y = 0; y < T.H; y += 12) { c.fillRect(0, y, 3, 6); c.fillRect(T.W - 3, y + 6, 3, 6); }
      }
      if (this.surgeFlash && this.real - this.surgeFlash < 8 && !this.reduce) { AG.gfx.drawIcon(c, '📢', T.W - 24, 24, 1); }
      else if (this.surgeFlash && this.real - this.surgeFlash < 8) AG.gfx.drawIcon(c, '📢', T.W - 24, 24, 1);
    }
    drawFall(c, r) {
      c.fillStyle = 'rgba(30,21,56,.82)'; c.fillRect(0, 0, T.W, T.H);
      this.sideRig.draw(c, T.W / 2 - 50, 196, performance.now() / 1000);
      const f = r.fall;
      AG.sim.draw.ring(c, T.W / 2 + 60, 130, 26, 1 - f.t / f.ms, { segments: 24, dot: 3, color: '#ff5a7a' });
      AG.gfx.drawIcon(c, '🛡️', T.W / 2 + 60 - 18, 130 - 18, 2);
      AG.gfx.drawIcon(c, 'warning', T.W / 2 - 9, 28, 1);
    }

    /* ---------- the end ---------- */
    finish(res) {
      if (this.finished) return;
      this.finished = true;
      const ctx = this.ctx, lv = this.lv;
      this.rig.play(res.won ? 'cheer' : 'oops');
      let events = [];
      if (res.won) AG.store.update('stats', s => { events = L().badges(s.goWithTheFlow = s.goWithTheFlow || {}, { level: lv.level, won: true, peak: res.peak, buddyLost: res.buddyLost, stopped: res.stopped > 0 }); });
      const detail = [
        { label: STR.rowPeak, value: res.peak + ' / 100', icon: 'warning' },
        { label: STR.rowMarshal, value: res.marshals + ' / ' + lv.marshals.length, icon: 'vest' },
        { label: STR.rowBuddy, value: pick(res.buddyLost ? STR.no : STR.yes), icon: 'heart' },
        { label: STR.rowHearts, value: res.hearts + ' / ' + T.hearts, icon: 'heart' },
        { label: STR.rowItems, value: res.stopped ? String(res.stopped) : pick(STR.none), icon: '🧢' },
        { label: STR.rowStars, value: res.collected.filter(Boolean).length + ' / 3', icon: 'star' }
      ];
      if (res.won) { AG.kit.celebrate(this.stage); AG.sfx.play('star'); }
      this.doneFn({
        won: res.won, stars: res.stars, score: res.score, timeMs: Math.round(res.timeSec * 1000), collectibles: res.collected, heartsLeft: res.hearts, detail,
        message: pick(!res.won ? STR.lose : res.stars >= 3 ? STR.win3 : res.stars === 2 ? STR.win2 : STR.win1), badgeEvents: events, bonusXP: res.won && !res.buddyLost ? 5 : 0, delay: 600
      });
    }
    destroy() {
      this.dead = true;
      if (this.stopLoop) this.stopLoop();
      if (this.murmur) this.murmur.stop();
      this.offs.forEach(f => { try { f(); } catch (e) { /* already off */ } });
      if (this.pad) this.pad.destroy();
      AG.input.pointerMode('tap');
      this.el.remove();
      if (G.live && G.live.scene === this) G.live = null;
    }
  }

  /* the crowd atlas: the four art sheets (10 × 12, two walk frames) stacked as four variants; the built-in pixel kids if art is missing */
  function buildSprites() {
    const recs = T.art.crowd.map(k => AG.assets.image(k));
    if (!recs.every(r => r.ok)) return new AG.sim.SpriteBatch({});
    const cv = document.createElement('canvas'); cv.width = 20; cv.height = 12 * recs.length;
    const g = cv.getContext('2d'); recs.forEach((r, i) => g.drawImage(r.img, 0, i * 12));
    return new AG.sim.SpriteBatch({ image: cv, fw: 10, fh: 12, frames: 2, variants: recs.length });
  }
  function braceIcon() {
    const h = AG.util.h;
    if (AG.icons && AG.icons.has && AG.icons.has('brace') && AG.ui.icon) return AG.ui.icon('brace', 20);
    return h('img', { src: AG.pixelIcon('🛡️', 20), alt: '', width: 20, height: 20, style: 'image-rendering: pixelated' });
  }

  Object.assign(G, { FlowRun, CrowdScene, STR });
  if (typeof module !== 'undefined') module.exports = G;
})(typeof window !== 'undefined' ? window : globalThis);
