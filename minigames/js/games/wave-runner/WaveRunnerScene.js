/* 03 Wave Runner: one run on a 480 × 270 canvas. The E3 side-scroll engine does the running (RunnerController, Chaser, Course); this file
 * wires it to the game: the warning intro (IntroScene.js), hearts and score, the helmet / double-jump shoes / magnet power-ups, the lost
 * pets, the decoy fish on the seabed, the second wave of level 5, the final "wait or go back down?" choice at the flag (stage) or the
 * endless run (daily), the word boxes and the results. The numbers are in tuning.js, the pure rules in rules.js. */
window.AG = window.AG || {};
(function (AG) {
  const { h, clamp } = AG.util;
  const WR = AG.waveRunner, T = WR.tuning, R = WR.rules;
  const K = 'wave-runner.';
  const W = 480, H = 270, INK = '#1e1538', GOLD = '#ffd23f';
  const S = en => ({ en });
  const pick = v => AG.pick(v);

  const STR = {
    metres: S('Distance'), coins: S('Coins'), reaction: S('Reaction'), hearts: S('Hearts left'), pets: S('Pets found'), wait: S('Waited'),
    hitLow: S('Ouch! Jump over low things. Hold the jump to go higher.'), hitHigh: S('Ouch! Slide under things that hang high: press down or the ⤓ button.'),
    fell: S('Mind the gaps! Jump over them and try again.'),
    caught: S('The wave caught up! Back to the last flag. Keep running and never stop.'),
    sand: S('Sand slows you down. The road and the high ledges are faster!'),
    fork: S('Jump up to the high path: it is shorter and safer. The low way is longer.'),
    forkSigns: S('The evacuation-route signs point the fast way. Follow them!'),
    sea: S('Never go toward the sea!'), seaSay: S('Those fish are on the seabed. **Never go toward the sea!** The wave comes back fast.'),
    pet: S('A lost pet! Pets matter, but never go toward the sea to look for them.'),
    helmet: S('Hard hat! It blocks one hit.'), shoes: S('Fast shoes! You can jump twice in the air for 10 seconds.'), magnet: S('Magnet! Coins come to you for 10 seconds.'),
    blocked: S('BLOCKED'), checkpoint: S('Checkpoint!'), doubleJump: S('DOUBLE!'),
    wave2: S('ANOTHER WAVE!'), wave2Sub: S('More waves can follow. Keep going!'), wave2Say: S('A second wave is coming behind you! **More waves can follow.** Keep running uphill!'),
    capRush: S('(the wave is roaring)'), capSplash: S('(splash!)'),
    choiceTitle: S('You made it to high ground!'), choiceAsk: S('The wave went by. Go back down?'),
    goBack: S('Go back down'), waitAll: S('Wait for the all-clear'),
    again: S('More waves can come. Stay on high ground.'), againAsk: S('Wait here until the officials say it is safe to go back.'),
    waitSay: S('Yes! A tsunami is **many waves**, and they can keep coming for hours. Wait on high ground until the officials say it is safe.'),
    capCut: S('(another wave rushes past below)'),
    msg3: S('Perfect run! You ran at the first warning and stayed on high ground.'),
    msg2: S('Great run! For 3 stars: react faster, lose no hearts and pick up more coins.'),
    msg1: S('You reached high ground! Next time, press RUN faster and take the high paths.'),
    msg0: S('Good try! When the ground shakes, the sea pulls back or you hear a roar: run to high ground at once.'),
    msgEnd: S('You ran {m} m! The first warning is your best head start.'),
    runHint: S('Jump'), slideHint: S('Slide')
  };
  const fmt = (t, vars) => pick(t).replace(/\{(\w+)\}/g, (_, k) => (vars[k] == null ? '' : vars[k]));

  const CSS = `
#ag-app .wr { display: grid; gap: 8px; justify-items: center; width: 100%; }
#ag-app .wr-box { position: relative; width: 100%; max-width: calc(62vh * 1.7778); }
#ag-app .wr-over { position: absolute; inset: 0; display: grid; place-items: end center; padding-bottom: 7%; pointer-events: none; }
#ag-app .wr-run { pointer-events: auto; font-size: 1.7rem; min-width: 190px; min-height: 64px; animation: wr-pulse .8s steps(2) infinite; }
@keyframes wr-pulse { 50% { transform: scale(1.07); } }
@media (prefers-reduced-motion: reduce) { #ag-app .wr-run { animation: none; } }
#ag-app .wr-tools { display: flex; flex-wrap: wrap; gap: 14px; justify-content: center; align-items: center; min-height: 44px; font-size: .85rem; color: var(--muted); font-weight: 700; }
#ag-app .wr-tools span { display: inline-flex; align-items: center; gap: 6px; }`;
  function injectCss() {
    if (!document.querySelector('style[data-ag-css="wave-runner"]')) document.head.append(h('style', { 'data-ag-css': 'wave-runner' }, CSS));
  }

  /** An AG.icons name or an emoji at 18 px (x, y = top-left). */
  function icon(c, name, x, y) {
    if (AG.icons.has(name)) AG.gfx.drawIcon(c, name, x, y, 1);
    else c.drawImage(AG.pixelIcon(name, 18, true), Math.round(x), Math.round(y));
  }
  /** Canvas text with a crisp 1 px ink outline. */
  function label(c, str, x, y, o) {
    o = Object.assign({ size: 12, color: '#fff' }, o);
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, 1], [-1, 1], [1, -1]]) AG.gfx.text(c, str, x + dx, y + dy, Object.assign({}, o, { color: INK, outline: null }));
    AG.gfx.text(c, str, x, y, Object.assign({}, o, { outline: null }));
  }

  class WaveRunnerScene {
    /** chunks = chunks.json (already loaded). ctx.levelData is a levels.json row, or generateDaily's object. */
    constructor(stage, ctx, done, chunks) {
      injectCss();
      this.stage = stage; this.ctx = ctx; this.doneFn = done; this.chunks = chunks;
      this.lv = ctx.levelData; this.endless = !!this.lv.endless;
      this.diff = ctx.difficulty === 'advanced' ? 'advanced' : 'easy';
      this.level = ctx.level; this.reduce = AG.reducedMotion();
      this.t = 0; this.phase = 'intro'; this.said = new Set(); this.pops = []; this.parts = []; this.offs = [];
      this.hearts = T.hearts; this.heartsLost = 0; this.hits = 0; this.coins = 0; this.pets = [false, false, false]; this.petCount = 0;
      this.reaction = null; this.auto = false; this.maxX = 0; this.waitPts = 0; this.wentBack = false; this.finished = false; this.dead = false;
      this.shoesUntil = 0; this.magnetUntil = 0; this.toast = null; this.cut = null; this.flash = 0; this.seaToastAt = -9; this.lastChunk = null; this.branch = null; this.branchLog = [];
      this.base = R.speedFor(this.diff, this.level);

      this.view = AG.gfx.canvas(W, H);
      this.rig = ctx.rig('side', { height: T.rigH });
      this.buildCourse();

      const jump = AG.input.promptIcon({ keys: ['key_space', 'key_up'], gesture: 'gesture_tap' }), slide = AG.input.promptIcon({ keys: ['key_down'], gesture: 'gesture_swipe_down' });
      this.box = h('div', { class: 'wr-box' }, this.view.cv);
      this.el = h('div', { class: 'wr' }, this.box, h('div', { class: 'wr-tools' }, h('span', {}, jump, pick(STR.runHint)), h('span', {}, slide, pick(STR.slideHint))));
      stage.append(this.el);
      this.pad = AG.sidescroll.touchControls(ctx.controls);
      this.hud = ctx.hud({ hearts: T.hearts, score: 0, label: STR.metres });
      this.hud.set({ hearts: this.hearts, score: 0, label: S('0 m') });

      AG.sfx.preload(T.art.sfx);
      ctx.onPause(p => { if (this.rush) this.rush.volume(p ? 0 : this.rushVol || 0); });
      this.intro = new WR.IntroScene({ stage, ctx, view: this.view, box: this.box, rig: this.rig, warning: this.lv.warning || R.warningFor(ctx.seed), onRun: (r, auto) => this.start(r, auto) });
      if (AG.debug.on) WR.live = { scene: this, course: this.course, runner: this.course.runner };
      this.stopLoop = AG.gfx.loop(dt => this.frame(dt));
    }

    /* ---------- the course ---------- */
    sceneKey() {
      if (!this.endless) return this.lv.scene;
      const th = this.lv.theme;
      return th === 'night' ? 'night' : th === 'town' ? 'town' : 'beach';
    }
    parallax(sc, endX) {
      const layers = sc.bg.map(l => Object.assign({}, l));
      if (sc.end && endX) { // the hill comes into view near the end of a beach stage
        sc.end.forEach(l => layers.push({ factor: l.factor, draw: (c, ox, oy, cam) => {
          const p = clamp((cam.x - endX * 0.4) / (endX * 0.4), 0, 1);
          if (p <= 0) return;
          c.globalAlpha = this.reduce ? (p > 0.5 ? 1 : 0) : p;
          for (let x = -(((ox % W) + W) % W); x < W; x += W) AG.assets.draw(c, l.key, x, 0, W, H);
          c.globalAlpha = 1;
        } }));
      }
      return layers;
    }
    buildCourse() {
      const ctx = this.ctx, lv = this.lv, sc = T.scenes[this.sceneKey()], S_ = AG.sidescroll, L_ = AG.logic.sidescroll;
      const lib = new L_.ChunkLibrary(this.endless ? WR.endlessChunks(this.chunks) : this.chunks);
      this.lib = lib;
      const wave = {
        gap: R.headStart(this.diff, null), speedFactor: R.chaserFactor(this.diff), rubberBand: T.chaser.rubber,
        art: T.art.wave, frames: T.chaser.frames, fps: T.chaser.fps, w: T.chaser.w, h: T.chaser.h, enabled: false
      };
      const common = {
        view: this.view, rig: this.rig, runSpeed: this.base, checkpointEvery: T.checkpointEvery, tiles: T.tiles,
        runner: { debug: AG.debug.overlay && AG.debug.on, actions: { idle: 'idle', run: 'run', jump: 'jump', fall: 'fall', slide: 'slide', climb: 'run', oops: 'oops', cheer: 'cheer' }, fallRespawn: 'safe' },
        chasers: [wave], camera: { followY: !!lv.followY }, darkness: lv.dark && sc.dark ? sc.dark : null,
        drawBehind: (c, cam, t) => this.drawBehind(c, cam, t), drawFront: (c, cam, t) => this.drawFront(c, cam, t), drawTop: (c, cam, t) => this.drawTop(c, cam, t)
      };
      if (!this.endless) {
        const plan = R.plan(lib, lv.sequence);
        const endX = plan[plan.length - 1].x + plan[plan.length - 1].chunk.width * 16;
        this.course = new S_.Course(Object.assign(common, { plan, parallax: this.parallax(sc, endX), seed: ctx.seed, level: this.level }));
        this.assignPets();
      } else {
        // endless: the Stitcher streams chunks, starting with the start chunk (WR.endlessStitcher decides the pool)
        this.course = new S_.Course(Object.assign(common, { library: lib, seed: ctx.seed, level: WR.poolLevel(this.level), band: R.bandAt(0), tags: [R.themeOf(this.level)], count: Infinity, startY: 14, parallax: this.parallax(sc) }));
        const w = this.course.world, e = WR.endlessStitcher(this.chunks, ctx.seed, this.level);
        w.chunks.length = 0; w.serial = 0; w.append(e.start, 0);
        this.course.stitcher = e.stitcher;
        this.course.on('chunk', p => { this.course.stitcher.band = R.bandAt(p.index); this.addPower(w.chunks[w.chunks.length - 1]); });
        this.course.stream(this.course.runner.x);
      }
      const r = this.course.runner, wv = this.course.chasers[0];
      this.runner = r; this.wave = wv;
      r.stop(); r.pose('alert', 0);
      if (!this.endless) this.course.world.chunks.forEach(pc => this.addPower(pc));
      r.on('jump', e => { AG.sfx.play(K + 'sfx.jump', { volume: 0.45 }); if (e.double) this.pop(STR.doubleJump, r.x, r.y - 44, '#c4b5ff'); });
      r.on('hit', e => this.onHit(e));
      r.on('fell', () => this.loseHeart('fell'));
      r.on('pickup', pk => this.onPickup(pk));
      r.on('checkpoint', cp => this.onCheckpoint(cp));
      r.on('end', () => this.onEnd());
      wv.on('caught', () => this.onCaught());
    }
    /** The first three lost pets of a stage (in running order) are the collectibles; any more are not placed. */
    assignPets() {
      let n = 0;
      for (const pc of this.course.world.chunks) for (const o of pc.objs) if (o.type === 'pickup' && o.id === 'pet') { if (n < 3) o.petIx = n; else o.taken = true; n++; }
    }
    /** 10 % of the chunk slots hold a power-up (seeded by the run's seed and the chunk number). */
    addPower(pc) {
      const slot = pc && pc.chunk.slot;
      if (!slot) return;
      const kind = R.powerFor(this.ctx.seed, pc.i);
      if (!kind) return;
      const o = AG.logic.sidescroll.place({ type: 'pickup', id: 'power', kind, x: slot[0], y: slot[1], icon: T.icons[kind], magnet: false }, pc.x0, pc.i);
      pc.objs.push(o); pc.pickups.push(o);
    }

    /* ---------- starting the chase ---------- */
    start(reaction, auto) {
      this.reaction = reaction; this.auto = auto;
      const gap = R.headStart(this.diff, reaction);
      this.wave.startGap = gap; this.wave.reset(gap); this.wave.start();
      this.runner.pose(null); this.runner.go(); this.runner.jumpAt = -Infinity;
      this.phase = 'run'; this.t = 0; this.intro.destroy();
      this.rush = AG.sfx.loop(K + 'sfx.rush_loop', { volume: 0 }); this.rushVol = 0;
      AG.kit.banner(this.stage, S('RUN!'), this.lv.title || S('Endless'), 1200);
      if (reaction != null) this.pop(S('Reaction ' + reaction.toFixed(2) + ' s  +' + R.reactionBonus(reaction)), W / 2, 120, GOLD, true);
      if (AG.debug.on) console.log('[wave-runner] RUN: reaction', reaction, 'head start gap', gap, 'px, auto', !!auto);
    }

    /* ---------- what happens in the run ---------- */
    say(key, type, text, o) { if (key && this.said.has(key)) return; if (key) this.said.add(key); this.ctx.say(type, text, o); }
    /** A floating text at a world point (screen = true: at a screen point, as in "Reaction 0.5 s"). */
    pop(text, x, y, color, screen) {
      const cam = this.course.camera, ox = screen ? 0 : cam.x, oy = screen ? 0 : cam.y;
      this.pops.push({ text: pick(text), x: clamp(Math.round(x - ox), 40, W - 40), y: Math.round(y - oy), t: 0, color: color || '#fff' });
    }
    splash(x, y) {
      const n = this.reduce ? 8 : 18;
      for (let i = 0; i < n; i++) this.parts.push({ x, y: y - 4, vx: (i / n - 0.5) * 140, vy: -60 - (i % 5) * 26, t: 0 });
    }
    loseHeart(why) {
      if (this.phase !== 'run') return;
      this.hearts = Math.max(0, this.hearts - 1); this.heartsLost++;
      this.hud.set({ hearts: this.hearts });
      if (why === 'fell') this.say('fell', 'retry', STR.fell);
      if (this.hearts <= 0) this.over();
    }
    onHit(e) {
      const r = this.runner;
      if (this.phase !== 'run') return; // the run is over (or at the flag): a late touch counts for nothing
      if (e.shielded) {
        AG.sfx.play(K + 'sfx.hit', { volume: 0.5 }); this.pop(STR.blocked, r.x, r.y - 44, '#6ed8ff');
        if (r.shield <= 0) this.rig.setGear(null);
        return;
      }
      this.hits++;
      AG.sfx.play(K + 'sfx.hit');
      if (!this.reduce) AG.kit.shake(this.view.cv);
      const high = e.src && e.src.id === 'beam';
      this.say(high ? 'hit:high' : 'hit:low', 'retry', high ? STR.hitHigh : STR.hitLow);
      this.loseHeart('hit');
    }
    onCaught() {
      const r = this.runner;
      if (this.phase !== 'run') return;
      this.splash(r.x, r.y); AG.sfx.play('splash', { volume: 0.7 }); this.caption(STR.capSplash);
      this.say('caught', 'retry', STR.caught);
      this.loseHeart('caught');
    }
    onCheckpoint(cp) {
      AG.sfx.play(K + 'sfx.checkpoint', { volume: 0.7 });
      this.pop(STR.checkpoint, cp.x + 8, cp.y - 6, GOLD);
      if (this.lv.multiwave && !this.wave2 && this.chunkIndexAt(cp.x) >= this.lv.wave2Chunk) this.startWave2();
    }
    chunkIndexAt(x) { const pc = this.course.world.chunkAt(x); return pc ? pc.i : 0; }
    /** Level 5: after the middle checkpoint a second wave starts far behind, a little faster than the first. */
    startWave2() {
      this.wave2 = this.course.addChaser({
        gap: T.wave2.gap, speedFactor: R.chaserFactor(this.diff) + T.wave2.plus, rubberBand: null,
        art: T.art.wave, frames: T.chaser.frames, fps: T.chaser.fps, w: T.chaser.w, h: T.chaser.h
      });
      this.wave2.on('caught', () => this.onCaught());
      AG.sfx.play(K + 'sfx.roar', { volume: 0.8 });
      AG.kit.banner(this.stage, STR.wave2, STR.wave2Sub, 2200);
      this.ctx.say('warning', STR.wave2Say, { pose: AG.rig.resolve(this.ctx.expertId, 'alert').frame });
    }
    onPickup(pk) {
      const r = this.runner;
      if (pk.id === 'coin') {
        this.coins++; AG.sfx.play('collect', { volume: 0.5 }); this.pop(S('+' + T.score.coin), pk.x + 8, pk.y - 4, GOLD);
      } else if (pk.id === 'decoy') {
        AG.sfx.play('soft', { volume: 0.6 }); this.pop(S('0'), pk.x + 8, pk.y - 4, '#9aa0b4');
        this.toast = { text: STR.sea, until: this.t + 2.4 };
        this.say('sea', 'warning', STR.seaSay, { pose: AG.rig.resolve(this.ctx.expertId, 'alert').frame });
      } else if (pk.id === 'pet') {
        AG.sfx.play('star', { volume: 0.7 }); this.petCount++;
        if (pk.petIx != null) this.pets[pk.petIx] = true;
        this.pop(S('PET FOUND!'), pk.x + 8, pk.y - 8, '#ffb3d1');
        this.say('pet', 'info', STR.pet);
      } else if (pk.id === 'power') this.takePower(pk.kind);
      this.hud.set({ score: this.liveScore() });
    }
    takePower(kind) {
      const r = this.runner, P = T.power;
      AG.sfx.play('collect');
      if (kind === 'helmet') { r.shield = P.helmetHits; this.rig.setGear('hard_hat'); }
      else if (kind === 'shoes') { r.doubleJump = true; this.shoesUntil = this.t + P.shoesMs / 1000; }
      else { r.magnet = P.magnetR; this.magnetUntil = this.t + P.magnetMs / 1000; }
      this.pop(S(kind === 'helmet' ? 'HARD HAT' : kind === 'shoes' ? 'DOUBLE JUMP' : 'MAGNET'), r.x, r.y - 44, '#c4b5ff');
      this.say('power:' + kind, 'info', STR[kind]);
    }
    caption(text) { this.cap = { text, until: this.t + 2 }; }
    liveScore() {
      return R.score({ metres: R.metres(this.maxX - this.runner.startX), coins: this.coins, reaction: this.reaction, hits: this.hits, wait: this.waitPts, finished: false }).total;
    }

    /* ---------- frame ---------- */
    frame(dt) {
      if (this.phase === 'intro') { this.intro.update(dt); this.intro.draw(this.view.ctx); return; }
      this.t += dt;
      const r = this.runner, c = this.course;
      if (this.endless && this.phase === 'run') r.runSpeed = R.endlessSpeed(this.base, R.metres(this.maxX - r.startX));
      c.update(dt);
      this.maxX = Math.max(this.maxX, r.x);
      if (this.shoesUntil && this.t > this.shoesUntil) { r.doubleJump = false; this.shoesUntil = 0; }
      if (this.magnetUntil && this.t > this.magnetUntil) { r.magnet = 0; this.magnetUntil = 0; }
      this.tick(dt);
      if (this.phase === 'choice') for (const w of c.chasers) w.x -= 110 * dt; // the wave drains away behind the hill, nobody is hurt
      this.pops = this.pops.filter(p => (p.t += dt) < 0.9);
      this.parts = this.parts.filter(p => { p.t += dt; p.vy += 420 * dt; p.x += p.vx * dt; p.y += p.vy * dt; return p.t < 0.8; });
      c.draw(performance.now() / 1000);
    }
    /** Per-frame bookkeeping: the HUD, the wave's roar, chunk hints and the debug route log. */
    tick(dt) {
      const r = this.runner, gap = Math.max(0, this.wave.gap);
      this.hud.set({ score: this.liveScore(), label: S(R.metres(this.maxX - r.startX) + ' m') });
      if (this.rush) { this.rushVol = this.phase === 'run' ? clamp(1 - gap / 420, 0, 0.7) * 0.8 : 0; this.rush.volume(this.rushVol); }
      if (this.rushVol > 0.35) this.say('rush', 'warning', S('The wave is close! **Keep running** and never stop.'), { sound: false });
      const pc = this.course.world.chunkAt(r.x);
      if (pc && pc !== this.lastChunk) this.enterChunk(pc);
      if (this.branch) {
        if (r.ground && r.ground.route === 'upper') this.branch.upper = true;
        if (r.mul < 1) this.branch.slow = true;
      }
      if (this.phase === 'run' && r.mul < 1 && r.grounded) this.say('sand', 'info', STR.sand);
    }
    enterChunk(pc) {
      if (this.branch) this.leaveBranch();
      this.lastChunk = pc;
      if (pc.chunk.tags.includes('branch')) {
        this.branch = { pc, at: this.runner.clock, upper: false, slow: false };
        const signs = pc.chunk.objects.some(o => o.id === 'sign' && o.route === 'upper');
        this.say('fork', 'info', signs && this.level === 2 ? STR.forkSigns : STR.fork);
      }
    }
    /** Debug: how long the fork took on the route the player used, against both routes' estimates. */
    leaveBranch() {
      const b = this.branch; this.branch = null;
      const secs = (this.runner.clock - b.at) / 1000, route = b.upper ? 'upper' : 'lower';
      const rep = AG.debug.on ? R.routeReport(b.pc.chunk, this.runner.runSpeed) : null;
      const row = { chunk: b.pc.id, route, secs: +secs.toFixed(2), est: rep && { upper: +rep.upper.toFixed(2), lower: +rep.lower.toFixed(2), gain: +rep.gain.toFixed(2) } };
      this.branchLog.push(row);
      if (AG.debug.on) console.log('[wave-runner] branch', row.chunk, 'took the', route, 'route in', row.secs, 's; estimates', JSON.stringify(row.est));
    }

    /* ---------- drawing (called by the engine's Course.draw) ---------- */
    /** Behind the world: the evacuation-route signs and the flag, at their natural size. */
    drawBehind(c, cam, t) {
      const A = AG.assets;
      for (const pc of this.course.world.near(cam.x, cam.x + W)) for (const d of pc.decos) {
        const x = Math.round(d.x - cam.x), y = Math.round(d.y - cam.y);
        if (d.id === 'sign') A.draw(c, T.art.sign, x, y + d.h - 24, 16, 24);
        else if (d.id === 'flag') A.draw(c, T.art.flag, x, y, 16, 32, this.reduce ? 0 : Math.floor(t * 3) % 2);
      }
    }
    drawFront(c, cam, t) {
      c.fillStyle = '#ffffff';
      for (const p of this.parts) c.fillRect(Math.round(p.x - cam.x), Math.round(p.y - cam.y), 2, 2);
      if (this.cut) this.drawCut(c);
    }
    /** The canvas HUD: the wave's distance, power-ups, reaction and the pops. */
    drawTop(c, cam, t) {
      const r = this.runner, text = (s, x, y, o) => label(c, s, x, y, o);
      if (this.phase === 'run' || this.phase === 'choice') {
        // the wave: a bar that empties as it comes closer (and a ▲ + label, not colour alone)
        const gap = Math.max(0, this.wave.gap), p = clamp(gap / 350, 0, 1), danger = p < 0.35;
        c.fillStyle = INK; c.fillRect(190, 8, 100, 8); c.fillStyle = danger ? '#ff4f6d' : '#6ed8ff'; c.fillRect(191, 9, Math.round(98 * p), 6);
        text(danger ? '▲ WAVE' : 'WAVE', 240, 18, { size: 10, align: 'center', color: danger ? '#ff9b9b' : '#e6e2ff' });
      }
      // power-ups
      let y = 8;
      if (r.shield > 0) { c.fillStyle = INK; c.fillRect(6, y, 56, 22); c.fillStyle = '#3a2f66'; c.fillRect(7, y + 1, 54, 20); icon(c, 'helmet', 8, y + 2); text('×' + r.shield, 30, y + 5); y += 24; }
      if (this.shoesUntil) { this.powerBar(c, 'shoes', y, (this.shoesUntil - this.t) / (T.power.shoesMs / 1000)); y += 24; }
      if (this.magnetUntil) { this.powerBar(c, T.icons.magnet, y, (this.magnetUntil - this.t) / (T.power.magnetMs / 1000)); y += 24; }
      if (this.toast && this.toast.until > this.t) text(this.toast.text, W / 2, 40, { size: 14, bold: true, align: 'center', color: '#ffb3b3' });
      if (this.cap && this.cap.until > this.t) text(this.cap.text, W / 2, 252, { size: 10, align: 'center', color: '#e6e2ff' });
      for (const p of this.pops) text(p.text, p.x, p.y - Math.round(p.t * 30), { align: 'center', size: 12, bold: true, color: p.color });
    }
    powerBar(c, ic, y, frac) {
      c.fillStyle = INK; c.fillRect(6, y, 56, 22); c.fillStyle = '#3a2f66'; c.fillRect(7, y + 1, 54, 20);
      icon(c, ic, 8, y + 2);
      c.fillStyle = INK; c.fillRect(28, y + 8, 30, 6); c.fillStyle = '#c4b5ff'; c.fillRect(29, y + 9, Math.round(28 * clamp(frac, 0, 1)), 4);
    }

    /* ---------- the flag: wait for the all-clear, or go back down ---------- */
    onEnd() {
      if (this.endless || this.phase === 'choice') return;
      this.phase = 'choice';
      this.runner.pose('cheer', 0);
      if (this.rush) { this.rush.stop(); this.rush = null; }
      AG.kit.celebrate(this.stage);
      this.ctx.after(900, () => this.openChoice(false));
    }
    openChoice(again) {
      if (this.dead || this.finished) return;
      const ctx = this.ctx, ex = ctx.expertId, agila = AG.chars.get(ex).agila;
      const frame = AG.rig.resolve(ex, agila ? 'point' : 'hold:megaphone').frame; // heroes hold the megaphone, AGILA points
      const opts = [{ text: STR.goBack, icon: 'walk', ok: false }, { text: STR.waitAll, icon: 'sign_highground', ok: true }];
      this.choice = AG.kit.choices(opts, (o, i, b) => this.pickChoice(o, i), { label: STR.choiceTitle });
      if (again) this.choice.mark(0, false);
      this.modal = h('div', { class: 'ag-overlay wr-choice', role: 'dialog', 'aria-label': pick(STR.choiceTitle) }, h('div', { class: 'ag-box' },
        AG.chars.img(ex, frame, 1), h('h3', {}, pick(again ? STR.again : STR.choiceTitle)), h('p', {}, pick(again ? STR.againAsk : STR.choiceAsk)), this.choice.el));
      this.stage.append(this.modal);
      setTimeout(() => { const b = this.choice && this.choice.btns[again ? 1 : 0]; if (b && !b.disabled) b.focus(); }, 40);
    }
    closeChoice() {
      if (this.choice) { this.choice.destroy(); this.choice = null; }
      if (this.modal) { this.modal.remove(); this.modal = null; }
    }
    pickChoice(o, i) {
      if (this.choiceLock) return;
      this.closeChoice();
      if (o.ok) {
        this.choiceLock = true;
        this.waitPts = this.wentBack ? T.score.waitRetry : T.score.wait;
        this.waitedFirst = !this.wentBack;
        this.ctx.safe(1);
        this.runner.pose('stop', 900);
        this.ctx.after(950, () => { this.runner.pose('cheer', 0); AG.kit.celebrate(this.stage); AG.sfx.play('star'); });
        this.pop(S('+' + this.waitPts), this.runner.x, this.runner.y - 50, GOLD);
        this.hud.set({ score: this.liveScore() });
        this.ctx.say('info', STR.waitSay, { pose: AG.rig.resolve(this.ctx.expertId, 'point').frame });
        this.ctx.after(2800, () => this.finish(true));
        return;
      }
      // go back down: a gentle second wave rushes past below (nobody is hurt), then the choice comes back
      this.wentBack = true; this.choiceLock = true;
      this.cut = { t: 0 };
      this.runner.pose('alert', 0); this.caption(STR.capCut);
      AG.sfx.play(K + 'sfx.roar', { volume: 0.7 });
      this.ctx.say('warning', STR.again, { pose: AG.rig.resolve(this.ctx.expertId, 'alert').frame });
      this.ctx.after(3400, () => { this.cut = null; this.choiceLock = false; this.runner.pose('cheer', 0); this.openChoice(true); });
    }
    drawCut(c) {
      this.cut.t += 1 / 60;
      const p = clamp(this.cut.t / 2.6, 0, 1), x = Math.round(-80 + p * (W + 160));
      c.save(); c.beginPath(); c.rect(0, 196, W, H - 196); c.clip();
      AG.assets.draw(c, T.art.wave, x - 80, H - 105, 80, 105, this.reduce ? 0 : Math.floor(this.cut.t * 6) % 4);
      c.fillStyle = '#2a6ad8'; c.fillRect(0, H - 60, Math.max(0, x - 80), 60);
      c.restore();
    }

    /* ---------- the end ---------- */
    /** Out of hearts: not harsh, the run just ends and the results encourage another try. */
    over() {
      if (this.finished || this.phase === 'over') return;
      this.phase = 'over';
      this.runner.stop(); this.wave.stop(); if (this.wave2) this.wave2.stop();
      this.runner.pose('oops', 0);
      if (this.rush) { this.rush.stop(); this.rush = null; }
      this.ctx.after(1100, () => this.finish(this.endless && R.metres(this.maxX - this.runner.startX) >= 50));
    }
    finish(won) {
      if (this.finished) return;
      this.finished = true;
      const r = this.runner, lv = this.lv, m = R.metres(this.maxX - r.startX);
      const sc = R.score({ metres: m, coins: this.coins, reaction: this.reaction, hits: this.hits, wait: this.waitPts, finished: won && !this.endless });
      const stars = this.endless ? R.endlessStars(m) : R.stars({ won, heartsLost: this.heartsLost, reaction: this.reaction, score: sc.total, target3: R.target3(lv, this.diff) });
      let events = [];
      AG.store.update('stats', s => { events = R.badges(s.waveRunner = s.waveRunner || {}, { level: this.level, won, hits: this.hits, reaction: this.reaction, waitedFirst: !!this.waitedFirst, mode: this.endless ? 'daily' : 'stage' }); });
      const msg = this.endless ? fmt(STR.msgEnd, { m }) : pick(!won ? STR.msg0 : stars >= 3 ? STR.msg3 : stars === 2 ? STR.msg2 : STR.msg1);
      if (this.rush) this.rush.stop();
      this.doneFn({
        won, stars, score: sc.total, timeMs: Math.round(this.t * 1000), collectibles: this.endless ? [false, false, false] : this.pets.slice(), heartsLeft: this.hearts,
        detail: [
          { label: STR.metres, value: m + ' m', icon: 'sign_highground' },
          { label: STR.coins, value: String(this.coins), icon: 'star' },
          this.reaction != null ? { label: STR.reaction, value: this.reaction.toFixed(2) + ' s', icon: 'bulb' } : { label: STR.reaction, value: '—', icon: 'bulb' },
          !this.endless && won ? { label: STR.pets, value: this.pets.filter(Boolean).length + ' / 3', icon: '🐾' } : null,
          { label: STR.hearts, value: this.hearts + ' / ' + T.hearts, icon: 'heart' }
        ].filter(Boolean),
        message: msg, badgeEvents: events, delay: 300
      });
    }
    destroy() {
      this.dead = true;
      if (this.stopLoop) this.stopLoop();
      if (this.rush) this.rush.stop();
      this.closeChoice();
      if (this.intro) this.intro.destroy();
      this.course.destroy(); this.pad.destroy(); this.el.remove();
      this.offs.forEach(f => f()); this.offs = [];
      if (WR.live && WR.live.scene === this) WR.live = null;
    }
  }

  Object.assign(WR, { STR, WaveRunnerScene });
})(window.AG);
