/* Fire Escape Maze: one maze run.
 *
 *   const scene = new AG.fireEscape.Scene(stage, ctx, { seed, onEnd(result) })
 *   result: { escaped, timedOut, … } → index.js turns it into done() or the timeout panel
 *
 * The plan comes from AG.logic.fireEscapeGen (pure, seeded). The scene builds a TileMap of
 * it (20 px tiles; floor + walls pre-rendered, doors / fire / embers on 'objects', smoke on
 * 'overlay'), a GridMover driving the player's 'top' rig, a follow camera, and the world's
 * hazards: smoke + the cough meter (Smoke.js), doors to feel (Doors.js), spreading fire and
 * embers (FireSpread.js) with Stop-Drop-Roll (SDRQuickTime.js), the elevator, the power cut
 * (AG.grid.Darkness) and the classmate to alert.
 *
 * Keys: arrows / WASD move · C crawl · E feel · Enter / Space open or alert. In the QTE S, D
 * and ←/→ are STOP, DROP and ROLL. Touch: swipe (hold to keep walking) or the D-pad, the
 * 🧎 ✋ 🚪 buttons, tap a door or the classmate. Mouse: drag like a swipe, click the buttons. */
window.AG = window.AG || {};
(function (AG) {
  const { h } = AG.util;
  const FE = AG.fireEscape, T = FE.tuning, R = FE.rules;
  const GEN = AG.logic.fireEscapeGen, C = GEN.T;
  const S = (en, fil) => ({ en, fil });
  const TILE = T.tile;
  const VEC = { up: [0, -1], right: [1, 0], down: [0, 1], left: [-1, 0] };
  const OPP = { up: 'down', down: 'up', left: 'right', right: 'left' };
  const key = (x, y) => x + ',' + y;

  const STR = {
    crawl: S('Crawl', 'Gumapang'), walk: S('Stand', 'Tumayo'), feel: S('Feel', 'Damhin'), open: S('Open', 'Buksan'), alert: S('Alert', 'Tawagin'),
    time: S('Time', 'Oras'), coins: S('Stars', 'Bituin'), cough: S('Cough', 'Ubo'),
    smokeFirst: S('Smoke rises. Get LOW and crawl under it! Press C or tap 🧎.', 'Pumapataas ang usok. YUMUKO at gumapang sa ilalim nito! Pindutin ang C o i-tap ang 🧎.'),
    coughFull: S('Too much smoke! Crawl low under it. Back to the checkpoint.', 'Sobrang usok! Gumapang nang mababa. Balik sa checkpoint.'),
    doorHere: S('A closed door. Feel it first ✋ (E), then open it 🚪 (Enter).', 'Saradong pinto. Damhin muna ✋ (E), saka buksan 🚪 (Enter).'),
    hot: S('Hot! Find another way.', 'Mainit! Humanap ng ibang daan.'),
    cool: S('Cool — safe to open.', 'Malamig — ligtas buksan.'),
    unfelt: S('Always feel the door first!', 'Laging damhin muna ang pinto!'),
    unfeltHot: S('That door was hot! Always feel it first. Back to the checkpoint.', 'Mainit pala ang pinto! Laging damhin muna. Balik sa checkpoint.'),
    noDoor: S('Walk up to a door first.', 'Lumapit muna sa pinto.'),
    elevator: S('Use the stairs! Never the elevator in a fire.', 'Gumamit ng hagdan! Huwag ang elevator kapag may sunog.'),
    fire: S('Too hot! The fire blocks the way. Find another route.', 'Sobrang init! Harang ang apoy. Humanap ng ibang daan.'),
    qteWin: S('Stop, drop and roll: the flames are out!', 'Huminto, dumapa at gumulong: patay na ang apoy!'),
    qteFail: S('Next time: STOP, DROP and ROLL right away. Back to the checkpoint.', 'Sa susunod: HUMINTO, DUMAPA at GUMULONG agad. Balik sa checkpoint.'),
    checkpoint: S('Checkpoint!', 'Checkpoint!'),
    mateCall: S('A classmate is still in this room! Press Enter or tap them to alert them.', 'May kaklase pa sa kuwartong ito! Pindutin ang Enter o i-tap sila para tawagin.'),
    mateGo: S("Let's go! Stay low and follow me.", 'Tara na! Yumuko at sumunod ka sa akin.'),
    mateLeft: S('You got out, but your classmate is still inside. Always alert others!', 'Nakalabas ka, pero nasa loob pa ang kaklase mo. Laging tawagin ang iba!'),
    escaped: S("You're out! Now go straight to the assembly area and stay with your class.", 'Nakalabas ka! Dumiretso sa assembly area at manatili kasama ang klase.'),
    timeUp: S("Time's up!", 'Ubos na ang oras!'),
    penaltyS: S('−{n} s', '−{n} s')
  };
  FE.STR = STR;

  /* ---------- styles, once per page (all under #ag-app, classes fe-) ---------- */
  const CSS = `
#ag-app .fe { display: grid; gap: 8px; justify-items: center; width: 100%; }
#ag-app .fe .ag-canvas { width: 100%; }
#ag-app .fe-tools { display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; align-items: center; }
#ag-app .fe-tools .ag-btn { min-height: 52px; min-width: 64px; }
#ag-app .fe-tool { display: inline-flex; gap: 4px; align-items: center; }
#ag-app .fe-tool[hidden] { display: none; }
#ag-app .fe-tools .ag-btn[aria-pressed="true"] { background: var(--hat); color: #1e1538; }
#ag-app .fe-tools .ag-btn.is-cue { outline: 3px dashed var(--vest); outline-offset: 2px; }
#ag-app .fe-hudmeter { min-width: 110px; display: grid; gap: 2px; }
#ag-app .fe-hudmeter small { font-size: .7rem; color: var(--muted); font-weight: 800; }
#ag-app .fe-time.is-low b { color: var(--alert); }
@media (prefers-reduced-motion: reduce) { #ag-app .fe-tools .ag-btn.is-cue { outline-style: solid; } }`;
  function injectCss() {
    if (!document.querySelector('style[data-ag-css="fire-escape"]')) document.head.append(h('style', { 'data-ag-css': 'fire-escape' }, CSS));
  }

  /* tiny 7 × 7 pixel flag for checkpoints, drawn once */
  const FLAG = ['.##....', '.####..', '.#####.', '.##....', '.#.....', '.#.....', '###....'];
  function flag(color) {
    const cv = document.createElement('canvas'); cv.width = cv.height = 7;
    const c = cv.getContext('2d');
    FLAG.forEach((row, y) => row.split('').forEach((ch, x) => { if (ch === '#') { c.fillStyle = x === 1 || y === 6 ? '#1e1538' : color; c.fillRect(x, y, 1, 1); } }));
    return cv;
  }

  class Scene {
    constructor(stage, ctx, o) {
      injectCss();
      this.stage = stage; this.ctx = ctx; this.onEnd = o.onEnd; this.seed = o.seed >>> 0;
      this.adv = ctx.difficulty === 'advanced';
      this.offs = []; this.ended = false; this.qte = null;
      this.reduce = AG.reducedMotion();
      const entry = ctx.levelData || {};
      this.world = entry.world || ctx.world;
      this.params = R.params(entry, ctx.difficulty, this.world, entry.level || ctx.level);
      this.plan = GEN.generate(this.params, this.seed);
      this.f = this.plan.features;
      this.rnd = AG.util.mulberry32(this.seed ^ 0xf17e);
      // run stats
      this.msLeft = this.plan.par; this.penalties = 0; this.elevatorHits = 0; this.qteWins = 0;
      this.coins = [false, false, false]; this.smokeCrawled = 0; this.saidSmoke = false;
      this.feelUntil = 0; this.coughUntil = 0; this.safeUntil = 0; this.lastHint = {};
      this.cough = new FE.CoughMeter(T.cough);
      this.doors = new FE.Doors(this.plan.doors);
      this.cp = { x: this.plan.start.x, y: this.plan.start.y };
      this.cpReached = new Set();
      this.smoke = new Set(this.plan.smoke.map(c => key(c.x, c.y)));
      this.flags = { off: flag('#ff7a1a'), on: flag('#2f8a4a') };
      this.build();
    }

    /* ---------- map, mover, camera ---------- */
    build() {
      const plan = this.plan, rm = this.reduce;
      const tiles = new AG.grid.Tileset([
        { id: 'yard', frame: (c, px, py, s, t, x, y) => { c.fillStyle = '#3d7a3a'; c.fillRect(px, py, s, s); c.fillStyle = '#4b8c45'; for (let i = (x + y) % 2; i < s; i += 4) c.fillRect(px + i, py + ((i * 7 + y) % s), 1, 1); }, walkable: false },
        { id: 'wall', frame: 'fire-escape.tiles.wall', walkable: false, tags: ['solid'] },
        { id: 'window', frame: 'fire-escape.tiles.window', walkable: false, tags: ['solid'] },
        { id: 'hall', frame: 'fire-escape.tiles.floor' },
        { id: 'room', frame: 'fire-escape.tiles.floor_classroom' },
        { id: 'exit', frame: 'fire-escape.tiles.stairs_exit', tags: ['exit'] },
        { id: 'assembly', frame: 'fire-escape.tiles.assembly', tags: ['assembly'] },
        { id: 'elevator', frame: 'fire-escape.tiles.elevator', walkable: false, tags: ['elevator'] },
        { id: 'door_closed', frame: 'fire-escape.tiles.door_closed', walkable: false, tags: ['door'] },
        { id: 'door_open', frame: 'fire-escape.tiles.door_open', tags: ['door'] },
        // the red glow only once it has been felt; Reduce Motion: no blinking
        rm ? { id: 'door_hot', frame: { key: 'fire-escape.tiles.door_hot', i: 1 }, walkable: false, tags: ['door', 'hot'] }
          : { id: 'door_hot', frame: 'fire-escape.tiles.door_hot', anim: { fps: 2 }, walkable: false, tags: ['door', 'hot'] },
        rm ? { id: 'fire', frame: { key: 'fire-escape.fire', i: 0 }, walkable: false, tags: ['fire'], dynamic: true }
          : { id: 'fire', frame: 'fire-escape.fire', anim: { fps: 8 }, walkable: false, tags: ['fire'] },
        rm ? { id: 'ember', frame: { key: 'fire-escape.ember', i: 0 }, tags: ['ember'], dynamic: true }
          : { id: 'ember', frame: 'fire-escape.ember', anim: { fps: 4 }, tags: ['ember'] },
        rm ? { id: 'smoke', frame: { key: 'fire-escape.smoke', i: 0 }, tags: ['smoke'], dynamic: true }
          : { id: 'smoke', frame: 'fire-escape.smoke', anim: { fps: 2 }, tags: ['smoke'] }
      ]);
      const map = this.map = new AG.grid.TileMap({ w: plan.w, h: plan.h, tile: TILE, tiles });
      for (let y = 0; y < plan.h; y++) for (let x = 0; x < plan.w; x++) {
        const c = plan.grid[y * plan.w + x];
        if (c === C.YARD) { map.set('floor', x, y, 'yard'); continue; }
        map.set('floor', x, y, c === C.ROOM ? 'room' : c === C.EXIT ? 'exit' : c === C.ASSEMBLY ? 'assembly' : 'hall');
        if (c === C.WALL) {
          // windows on the outside wall, every few tiles
          const outside = map.inBounds(x, y) && [[0, -1], [1, 0], [0, 1], [-1, 0]].some(([dx, dy]) => plan.grid[(y + dy) * plan.w + x + dx] === C.YARD);
          map.set('walls', x, y, outside && (x + y) % 4 === 1 ? 'window' : 'wall');
        }
        if (c === C.ELEVATOR) map.set('walls', x, y, 'elevator');
        if (c === C.DOOR) map.set('objects', x, y, 'door_closed');
      }
      plan.smoke.forEach(s => map.set('overlay', s.x, s.y, 'smoke'));
      if (this.f.fire) {
        const protect = [plan.start, plan.exit, plan.assembly].concat(plan.checkpoints).map(c => key(c.x, c.y));
        this.fire = new FE.FireSpread({
          w: plan.w, h: plan.h, fires: plan.fires, protect, goal: plan.assembly, rnd: this.rnd,
          p: T.spread.p, emberP: T.spread.emberP, maxEmbers: T.spread.maxEmbers,
          isFloor: (x, y) => { const c = plan.grid[y * plan.w + x]; return c === C.HALL || c === C.ROOM; },
          // a closed door can be opened, unless it is hot: the BFS before igniting counts it
          passable: (x, y) => this.open(x, y) || (this.doors.blocks(x, y) && !this.doors.at(x, y).hot)
        });
        this.fire.list().forEach(f => map.set('objects', f.x, f.y, 'fire'));
      }

      this.view = AG.gfx.canvas(480, 270);
      this.cam = new AG.grid.Camera({ map, viewW: 480, viewH: 270, mode: map.pw > 480 || map.ph > 270 ? 'follow' : 'fixed', deadzone: T.camera.deadzone, smooth: T.camera.smooth });
      this.dark = this.f.dark ? new AG.grid.Darkness({ w: 480, h: 270, rings: 3, ringWidth: 4 }) : null;

      this.rig = this.ctx.rig('top');
      this.mover = new AG.grid.GridMover({
        map, x: plan.start.x, y: plan.start.y, facing: 'down', rig: this.rig,
        speeds: T.speeds, speed: 'walk', holdDelay: T.holdDelay, actions: { idle: 'idle', move: { walk: 'walk', crawl: 'walk' } },
        canEnter: (x, y) => this.open(x, y) && !(this.mate && !this.mate.alerted && x === this.mate.x && y === this.mate.y),
        onStart: (x, y, dir, m) => this.onStart(x, y, dir, m),
        onEnter: (x, y) => this.onEnter(x, y),
        onBlocked: (x, y, dir) => this.onBlocked(x, y, dir)
      });

      if (this.f.classmate && plan.classmate) {
        const heroes = AG.chars.list().filter(c => !c.agila && c.id !== this.ctx.characterId);
        const id = heroes[Math.floor(this.rnd() * heroes.length)].id;
        const c = plan.classmate;
        this.mate = { id, x: c.x, y: c.y, room: c.room, alerted: false, from: { x: c.x, y: c.y }, to: { x: c.x, y: c.y }, rig: new AG.CharacterRig(this.stage, id, 'top'), facing: 'down' };
        AG.chars.preload(id);
      }
      this.signs = plan.signs;
    }
    /** Walkable for the player now: the map (doors, fire, walls) — fire tiles live on the map too. */
    open(x, y) { return this.map.walkable(x, y); }

    /* ---------- the DOM around the canvas ---------- */
    async mount() {
      const stage = this.stage, ctx = this.ctx;
      const tool = (label, prompt, fn, cls) => {
        const b = h('button', { class: 'ag-btn ag-btn--alt ' + (cls || ''), type: 'button', tabindex: '-1' }, label);
        b.addEventListener('click', () => { fn(); stage.focus({ preventScroll: true }); });
        return { b, wrap: h('span', { class: 'fe-tool' }, AG.input.promptIcon(prompt), b) };
      };
      this.tools = {
        crawl: tool('', { keys: ['key_c'], gesture: 'gesture_tap' }, () => this.toggleCrawl(), 'fe-crawl'),
        feel: tool('', { keys: ['key_e'], gesture: 'gesture_tap' }, () => this.feel(), 'fe-feel'),
        open: tool('', { keys: ['key_enter'], gesture: 'gesture_tap' }, () => this.confirm(), 'fe-open')
      };
      this.tools.crawl.b.setAttribute('aria-pressed', 'false');
      const showDoors = !!this.f.doors, showOpen = !!(this.f.doors || this.mate);
      this.tools.feel.wrap.hidden = !showDoors;
      this.tools.open.wrap.hidden = !showOpen;
      const move = AG.input.promptIcon({ keys: ['key_up', 'key_left', 'key_down', 'key_right'], gesture: 'gesture_swipe_right' });
      this.el = h('div', { class: 'fe' }, this.view.cv,
        h('div', { class: 'fe-tools' }, move, ...Object.values(this.tools).map(t => t.wrap)));
      stage.append(this.el);
      AG.input.setView(this.view);
      this.pad = AG.input.touchControls(ctx.controls, { dpad: true, buttons: [] });

      // HUD: time, stars, cough meter (worlds with smoke)
      this.hud = ctx.hud({ score: 0, scoreLabel: STR.coins, timer: true });
      this.timeStat = this.hud.el.querySelector('.ag-stat:last-child'); this.timeStat.classList.add('fe-time');
      if (this.f.smoke) {
        this.meter = AG.kit.meter({ label: STR.cough, markers: [{ at: T.stars.two.cough, kind: 'danger', label: S('2-star limit', 'Hangganan sa 2 bituin') }] });
        this.meterLabel = h('small', {}, AG.pick(STR.cough));
        this.hud.el.append(h('div', { class: 'fe-hudmeter' }, this.meterLabel, this.meter.el));
      }
      this.relabel();

      AG.input.register('CRAWL', { keys: ['KeyC'] });
      AG.input.register('FEEL', { keys: ['KeyE'] });
      this.offs.push(AG.input.on('CRAWL', e => { if (e.phase === 'down') this.toggleCrawl(); }));
      this.offs.push(AG.input.on('FEEL', e => { if (e.phase === 'down') this.feel(); }));
      this.offs.push(AG.input.on('CONFIRM', e => { if (e.phase === 'down') this.confirm(); }));
      this.offs.push(AG.input.onPointer('tap', p => this.tap(p)));
      this.offs.push(AG.on('kalasag:languagechange', () => this.relabel()));
      this.offs.push(() => this.mover.destroy(), () => this.pad.destroy());
      AG.sfx.preload(['fire-escape.sfx.alarm', 'fire-escape.sfx.cough', 'fire-escape.sfx.door', 'fire-escape.sfx.door_hot', 'fire-escape.sfx.qte']);

      this.cam.follow(this.mover.cx, this.mover.cy).snap();
      this.updateHud(true);
      this.mover.enabled = false;
      await this.map.prepare(); // the floor art loads before the clock starts
      if (this.dead) return;
      this.mover.enabled = true;
      if (this.f.fire) this.spreadId = ctx.every(this.adv ? T.spread.advanced : T.spread.easy, () => this.spread());
      AG.sfx.play('fire-escape.sfx.alarm');
      this.stop = AG.gfx.loop(dt => this.frame(dt));
    }
    relabel() {
      const t = this.tools;
      t.crawl.b.textContent = '🧎 ' + AG.pick(this.mover.speed === 'crawl' ? STR.walk : STR.crawl);
      t.feel.b.textContent = '✋ ' + AG.pick(STR.feel);
      t.open.b.textContent = (this.f.doors ? '🚪 ' + AG.pick(STR.open) : '') + (this.mate ? (this.f.doors ? ' · ' : '📣 ') + AG.pick(STR.alert) : '');
      const small = this.hud.el.querySelectorAll('.ag-stat small');
      if (small[0]) small[0].textContent = '⭐ ' + AG.pick(STR.coins);
      if (small[1]) small[1].textContent = AG.pick(STR.time);
      if (this.meterLabel) this.meterLabel.textContent = AG.pick(STR.cough);
    }
    updateHud(force) {
      const s = Math.max(0, Math.ceil(this.msLeft / 1000));
      if (force || s !== this.shownS) {
        this.shownS = s;
        this.hud.set({ timer: AG.ui.fmtTime(s), score: this.coins.filter(Boolean).length + ' / 3' });
        this.timeStat.classList.toggle('is-low', s <= 10);
      }
      if (this.meter) this.meter.set(this.cough.value);
    }

    /* ---------- actions ---------- */
    get crawling() { return this.mover.speed === 'crawl'; }
    toggleCrawl() {
      if (this.ended || this.qte) return;
      this.mover.setSpeed(this.crawling ? 'walk' : 'crawl');
      this.tools.crawl.b.setAttribute('aria-pressed', String(this.crawling));
      AG.sfx.play('tap');
      this.relabel();
    }
    /** The closed door in front of the player (or next to them), else null. */
    doorAhead() {
      const m = this.mover, [dx, dy] = VEC[m.facing];
      const ahead = this.doors.at(m.x + dx, m.y + dy);
      if (ahead && !ahead.open) return ahead;
      for (const d of Object.keys(VEC)) { const n = this.doors.at(m.x + VEC[d][0], m.y + VEC[d][1]); if (n && !n.open) return n; }
      return null;
    }
    feel(door) {
      if (this.ended || this.qte || !this.f.doors) return;
      const d = door || this.doorAhead();
      if (!d) { this.hint('noDoor', 'instruction', STR.noDoor); return; }
      this.cueDoor(null);
      this.feelUntil = performance.now() + T.feelMs;
      this.rig.play('point');
      const hot = this.doors.feel(d) === 'hot';
      this.ctx.after(T.feelMs, () => {
        if (this.ended) return;
        if (hot) { this.map.set('objects', d.x, d.y, 'door_hot'); AG.sfx.play('fire-escape.sfx.door_hot'); this.say('warning', STR.hot); }
        else { AG.sfx.play('tap'); this.say('success', STR.cool); this.ctx.safe(); }
      });
    }
    confirm() {
      if (this.ended || this.qte) return;
      if (this.mate && !this.mate.alerted && this.nextTo(this.mate)) { this.alertMate(); return; }
      if (!this.f.doors) return;
      const d = this.doorAhead();
      if (!d) { this.hint('noDoor', 'instruction', STR.noDoor); return; }
      this.cueDoor(null);
      const r = this.doors.open(d);
      if (r === 'hot') { this.say('warning', STR.hot); AG.sfx.play('fire-escape.sfx.door_hot'); return; }
      if (r === 'unfelt-hot') {
        this.map.set('objects', d.x, d.y, 'door_hot');
        AG.sfx.play('fire-escape.sfx.door_hot');
        this.penalize(T.penalty.checkpointMs, true, 'retry', STR.unfeltHot);
        return;
      }
      this.map.set('objects', d.x, d.y, 'door_open');
      AG.sfx.play('fire-escape.sfx.door');
      if (r === 'unfelt-cool') this.penalize(T.penalty.openUnfeltMs, false, 'warning', STR.unfelt);
    }
    nextTo(p) { return Math.abs(this.mover.x - p.x) + Math.abs(this.mover.y - p.y) === 1; }
    alertMate() {
      const m = this.mate;
      m.alerted = true;
      m.from = { x: m.x, y: m.y }; m.to = { x: m.x, y: m.y };
      this.rig.play('alert');
      AG.sfx.play('good');
      this.say('success', STR.mateGo);
      this.ctx.safe();
    }
    tap(p) {
      if (this.ended || this.qte) return;
      const w = this.cam.toWorld(p.x, p.y), c = this.map.toGrid(w.x, w.y);
      if (this.mate && !this.mate.alerted && c.x === this.mate.x && c.y === this.mate.y) {
        if (this.nextTo(this.mate)) this.alertMate(); else this.hint('mate', 'instruction', STR.mateCall);
        return;
      }
      const d = this.doors.at(c.x, c.y);
      if (d && !d.open) {
        if (!this.nextTo(d)) { this.hint('noDoor', 'instruction', STR.noDoor); return; }
        this.mover.facing = Object.keys(VEC).find(k => this.mover.x + VEC[k][0] === d.x && this.mover.y + VEC[k][1] === d.y) || this.mover.facing;
        this.mover.syncRig();
        if (!d.felt) this.feel(d); else this.confirm();
      }
    }

    /* ---------- mover hooks ---------- */
    onStart(x, y, dir, m) {
      this.cueDoor(null);
      if (this.mate && this.mate.alerted) {
        this.mate.from = this.mate.to; this.mate.to = { x: m.trail[0].x, y: m.trail[0].y };
        this.mate.facing = this.mate.to.x > this.mate.from.x ? 'right' : this.mate.to.x < this.mate.from.x ? 'left' : this.mate.to.y < this.mate.from.y ? 'up' : 'down';
      }
    }
    onEnter(x, y) {
      if (this.ended) return;
      const k = key(x, y), plan = this.plan;
      if (this.crawling && this.smoke.has(k)) this.smokeCrawled++;
      plan.coins.forEach((c, i) => {
        if (!this.coins[i] && c.x === x && c.y === y) { this.coins[i] = true; AG.sfx.play('star'); this.pop('⭐', true); this.updateHud(true); }
      });
      const cp = plan.checkpoints.find(c => c.x === x && c.y === y);
      if (cp && !this.cpReached.has(k)) { this.cpReached.add(k); this.cp = { x, y }; AG.sfx.play('collect'); this.pop(AG.pick(STR.checkpoint), true); }
      if (this.mate && !this.mate.alerted && this.nextTo(this.mate)) this.hint('mate', 'instruction', STR.mateCall);
      if (this.fire && this.fire.ember(x, y) && performance.now() > this.safeUntil) { this.fire.takeEmber(x, y); this.map.set('objects', x, y, null); this.startQte(); return; }
      if (x === plan.assembly.x && y === plan.assembly.y) this.escape();
    }
    onBlocked(x, y, dir) {
      if (this.ended) return;
      const d = this.doors.at(x, y);
      if (d && !d.open) {
        if (d.felt && d.hot) this.say('warning', STR.hot);
        else { this.cueDoor(d); this.hint('door', 'instruction', STR.doorHere, 4000); }
        return;
      }
      if (this.map.hasTag(x, y, 'elevator')) {
        this.elevatorHits++;
        // pushed back one tile, away from the doors
        const bx = this.mover.x - VEC[dir][0], by = this.mover.y - VEC[dir][1];
        if (this.open(bx, by)) this.mover.teleport(bx, by, OPP[dir]);
        this.penalize(T.penalty.elevatorMs, false, 'warning', STR.elevator);
        return;
      }
      if (this.map.hasTag(x, y, 'fire')) this.penalize(T.penalty.checkpointMs, true, 'retry', STR.fire);
    }
    cueDoor(d) {
      this.cue = d;
      this.tools.feel.b.classList.toggle('is-cue', !!d && !d.felt);
      this.tools.open.b.classList.toggle('is-cue', !!d && d.felt && !d.hot);
    }

    /* ---------- hazards ---------- */
    spread() {
      if (this.ended || this.qte) return;
      const keep = this.mate && !this.mate.alerted ? [this.mate] : this.mate ? [this.mate.to] : [];
      const r = this.fire.step({ player: { x: this.mover.x, y: this.mover.y }, keep });
      r.ignited.forEach(c => this.map.set('objects', c.x, c.y, 'fire'));
      r.embers.forEach(c => this.map.set('objects', c.x, c.y, 'ember'));
      const near = r.ignited.some(c => Math.abs(c.x - this.mover.x) + Math.abs(c.y - this.mover.y) <= 6);
      if (near && performance.now() - (this.crackleAt || 0) > 4000) { this.crackleAt = performance.now(); AG.sfx.play('fire-escape.sfx.crackle'); }
    }
    startQte() {
      const m = this.mover;
      m.enabled = false; m.stop(); AG.input.releaseAll();
      this.qte = new FE.SDRQuickTime(this.stage, this.ctx, {
        onEnd: ok => {
          this.qte = null;
          this.safeUntil = performance.now() + T.qte.safeMs;
          if (this.ended) return;
          m.enabled = true;
          if (ok) { this.qteWins++; this.pop('+' + T.points.qte, true); this.say('success', STR.qteWin); this.ctx.safe(); }
          else this.penalize(T.penalty.checkpointMs, true, 'retry', STR.qteFail);
          this.stage.focus({ preventScroll: true });
        }
      });
    }
    /** −ms off the clock; toCheckpoint sends the player (and the classmate) back. */
    penalize(ms, toCheckpoint, type, text) {
      this.penalties++;
      this.msLeft -= ms;
      this.pop(AG.pick(STR.penaltyS).replace('{n}', Math.round(ms / 1000)), false);
      AG.sfx.play('oops');
      if (toCheckpoint) {
        this.mover.teleport(this.cp.x, this.cp.y);
        this.cough.reset();
        this.rig.blink(900);
        if (this.mate && this.mate.alerted) { this.mate.from = { x: this.cp.x, y: this.cp.y }; this.mate.to = { x: this.cp.x, y: this.cp.y }; }
        this.cam.follow(this.mover.cx, this.mover.cy).snap();
      }
      this.say(type, text);
      this.updateHud(true);
    }
    /** A word box; info and warning come from the role expert, pointing. */
    say(type, text, o) {
      const ex = type === 'info' || type === 'warning';
      return this.ctx.say(type, text, Object.assign(ex ? { pose: this.expertPoint() } : {}, o || {}));
    }
    expertPoint() { return AG.rig.resolve(this.ctx.expertId, 'point').frame; }
    /** A hint that doesn't repeat more than once every few seconds. */
    hint(id, type, text, ms) {
      const now = performance.now();
      if (now - (this.lastHint[id] || -1e9) < (ms || 2500)) return;
      this.lastHint[id] = now;
      this.say(type, text, { sound: false });
    }
    pop(text, good) {
      const r = this.stage.getBoundingClientRect(), c = this.view.cv.getBoundingClientRect();
      const p = this.cam.toScreen(this.mover.cx, this.mover.py), k = c.width / 480;
      AG.kit.pop(this.stage, Math.round(c.left - r.left + p.x * k), Math.round(c.top - r.top + p.y * k - 8), text, good);
    }

    /* ---------- the frame ---------- */
    frame(dt) {
      if (this.ended) return this.draw();
      if (this.qte) { this.qte.update(dt); return this.draw(); }
      this.mover.update(dt);
      this.cam.follow(this.mover.cx, this.mover.cy).update(dt);
      // smoke: upright fills the cough meter; crawling adds nothing
      if (this.f.smoke && !this.ended) {
        const inSmoke = this.smoke.has(key(this.mover.x, this.mover.y));
        if (inSmoke && !this.crawling && !this.saidSmoke) { this.saidSmoke = true; this.say('warning', STR.smokeFirst); }
        const ev = this.cough.update(dt, inSmoke, this.crawling);
        if (ev === 'cough') { AG.sfx.play('fire-escape.sfx.cough'); this.coughUntil = performance.now() + 600; }
        if (ev === 'full') this.penalize(T.penalty.checkpointMs, true, 'retry', STR.coughFull);
      }
      this.msLeft -= dt * 1000;
      this.updateHud();
      if (this.msLeft <= 0 && !this.ended) { this.msLeft = 0; this.updateHud(true); this.timeout(); }
      this.draw();
    }
    draw() {
      const g = this.view.ctx, cam = this.cam, map = this.map, t = performance.now() / 1000, now = performance.now();
      g.fillStyle = '#1e1538'; g.fillRect(0, 0, 480, 270);
      cam.begin(g);
      map.draw(g, cam, t, ['floor', 'walls', 'objects']);
      for (const c of this.plan.checkpoints) g.drawImage(this.cpReached.has(key(c.x, c.y)) ? this.flags.on : this.flags.off, c.x * TILE + 12, c.y * TILE + 2);
      this.plan.coins.forEach((c, i) => { if (!this.coins[i]) AG.gfx.drawIcon(g, 'star', c.x * TILE + 1, c.y * TILE + 1, 1); });
      if (!this.dark) for (const s of this.signs) AG.assets.draw(g, 'fire-escape.sign.' + s.dir + '.lit', s.x * TILE, s.y * TILE, TILE, TILE);
      if (this.mate) this.drawMate(g, t);
      this.drawPlayer(g, t, now);
      map.draw(g, cam, t, ['overlay']);
      if (this.cue && !this.cue.open) this.drawCue(g, this.cue, t);
      cam.end(g);
      if (this.dark) this.drawDark(g, t);
    }
    drawPlayer(g, t, now) {
      const m = this.mover, cx = m.cx, cy = m.cy;
      // shadow: flatter while crawling
      g.fillStyle = 'rgba(30, 21, 56, .35)';
      if (this.crawling) g.fillRect(cx - 8, cy + 5, 16, 2); else { g.fillRect(cx - 6, cy + 6, 12, 3); g.fillRect(cx - 4, cy + 9, 8, 1); }
      m.draw(g, t);
      const badge = (emoji, size, dy) => g.drawImage(AG.pixelIcon(emoji, size, true), Math.round(cx - size / 2), Math.round(cy - 10 - size + dy));
      if (now < this.feelUntil) badge('✋', 12, 0);
      else if (now < this.coughUntil) badge('💨', 10, 0);
      else if (this.crawling) badge('🧎', 10, 2);
    }
    drawMate(g, t) {
      const mt = this.mate, m = this.mover;
      let x, y;
      if (!mt.alerted) { x = mt.x * TILE + TILE / 2; y = mt.y * TILE + TILE / 2; }
      else {
        const k = m.moving ? m.progress : 1;
        x = Math.round((mt.from.x + (mt.to.x - mt.from.x) * k) * TILE + TILE / 2);
        y = Math.round((mt.from.y + (mt.to.y - mt.from.y) * k) * TILE + TILE / 2);
      }
      mt.rig.setFacing(mt.alerted ? mt.facing : 'down');
      mt.rig.play(mt.alerted && m.moving ? 'walk' : 'idle');
      g.fillStyle = 'rgba(30, 21, 56, .35)'; g.fillRect(x - 6, y + 6, 12, 3);
      if (!AG.chars.drawTop(g, mt.id, x, y, mt.rig.facing, { t, moving: mt.alerted && m.moving, hop: 0 })) AG.assets.placeholder(g, mt.id, x - 10, y - 10, 20, 20);
      if (!mt.alerted) g.drawImage(AG.pixelIcon('❗', 10, true), x - 5, y - 22 - (this.reduce ? 0 : Math.floor(t * 2) % 2));
    }
    /** Over a closed door the player bumped: the two choices as icons. */
    drawCue(g, d, t) {
      const x = d.x * TILE, y = d.y * TILE - 14;
      g.fillStyle = '#fff4cc'; g.fillRect(x - 4, y, 28, 13);
      g.fillStyle = '#1e1538'; g.fillRect(x - 4, y, 28, 1); g.fillRect(x - 4, y + 12, 28, 1); g.fillRect(x - 4, y, 1, 13); g.fillRect(x + 23, y, 1, 13);
      g.drawImage(AG.pixelIcon('✋', 10, true), x - 2, y + 1);
      g.drawImage(AG.pixelIcon('🚪', 10, true), x + 12, y + 1);
      if (!d.felt && !this.reduce && Math.floor(t * 3) % 2) { g.fillStyle = '#ff7a1a'; g.fillRect(x - 2, y + 11, 10, 1); }
    }
    drawDark(g, t) {
      const m = this.mover, s = TILE, D = T.dark;
      const near = this.signs.filter(sg => Math.abs(sg.x - m.x) + Math.abs(sg.y - m.y) <= D.signTiles);
      const glows = near.map(sg => ({ x: sg.x * s, y: sg.y * s, w: s, h: s, key: 'fire-escape.sign.' + sg.dir + '.glow', halo: 12 }))
        .concat([{ x: this.plan.exit.x * s, y: this.plan.exit.y * s, w: s, h: s, key: 'fire-escape.tiles.stairs_exit', halo: 16 }]);
      if (this.mate && !this.mate.alerted) glows.push({ x: this.mate.x * s, y: this.mate.y * s - 14, w: 10, h: 10, halo: 10, draw: (c, x, y) => c.drawImage(AG.pixelIcon('❗', 10, true), x, y) });
      this.dark.draw(g, { cam: this.cam, t, lights: [{ x: m.cx, y: m.cy, r: D.radius * s }], glows });
    }

    /* ---------- the end ---------- */
    escape() {
      this.ended = true;
      this.mover.enabled = false;
      const saved = !!(this.mate && this.mate.alerted);
      if (this.mate && !saved) this.say('warning', STR.mateLeft);
      else this.say('congratulations', STR.escaped, { sound: false });
      this.rig.play('cheer');
      this.end({ escaped: true, saved });
    }
    timeout() {
      this.ended = true;
      this.mover.enabled = false;
      this.end({ escaped: false, timedOut: true, saved: false });
    }
    end(o) {
      if (this.spreadId) this.ctx.clear(this.spreadId);
      const run = {
        escaped: o.escaped, timedOut: !!o.timedOut, timeLeftMs: Math.max(0, this.msLeft), parMs: this.plan.par,
        coins: this.coins.filter(Boolean).length, coinFlags: this.coins.slice(), penalties: this.penalties, qte: this.qteWins,
        classmate: o.saved, needsClassmate: !!this.mate, maxCough: this.cough.max, elevatorHits: this.elevatorHits,
        smokeCrawled: this.smokeCrawled, doorsFeltFirst: this.doors.feltFirst, world: this.world, mode: this.ctx.mode,
        usedMs: this.plan.par - this.msLeft, shortest: this.plan.shortest, seed: this.seed
      };
      this.onEnd(run);
    }
    destroy() {
      this.dead = true;
      if (this.stop) this.stop();
      if (this.spreadId) this.ctx.clear(this.spreadId);
      if (this.qte) { this.qte.destroy(); this.qte = null; }
      this.offs.forEach(f => f()); this.offs = [];
      if (this.el) this.el.remove();
    }
  }

  FE.Scene = Scene;
})(window.AG);
