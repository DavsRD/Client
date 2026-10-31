/* 06 Rising Water House: one level on a 480 × 270 canvas. The E7 sim engine does the work (WaypointGraph, Walker, TaskQueue, TaskBubbles);
 * this file wires the flood (Water.js) to the house: the three water lines and their rules, the task bubbles and the queue chips, Lola's
 * escort, the pets and things carried upstairs, the decoy bike, the night darkness, the evacuation order with its two routes, scoring,
 * stars and the results. Numbers are in tuning.js, the pure rules in Water.js, the levels in levels.json, the tasks in data/tasks.json. */
window.AG = window.AG || {};
(function (AG) {
  const { h, clamp } = AG.util;
  const RW = AG.risingWater, T = RW.tuning, R = RW.rules;
  const W = 480, H = 270, INK = '#1e1538', GOLD = '#ffd23f';
  const S = en => ({ en });
  const pick = v => AG.pick(v);

  const STR = {
    water: S('Flood'), dry: S('Dry'), ankle: S('Ankle'), knee: S('Knee'), waist: S('Waist'),
    power: S('Power'), essentials: S('Saved: papers, water, go bag'), family: S('Family safe'), hearts: S('Hearts left'), photos: S('Photos'), evac: S('Evacuation bonus'), chain: S('Chain bonus'),
    yes: S('Yes'), no: S('No'), auto: S('Switched off by an adult'), early: S('You switched it off in time'),
    outlet: S('Danger! Turn off the power before water reaches outlets!'), outletAuto: S('An adult switched the power off for you. Water and electricity do not mix!'),
    knee_: S('The knee line! Things left on the floor are ruined.'), waist_: S('The waist line! The ground floor is unsafe. An adult moves you upstairs.'),
    wade: S('Never walk through floodwater with the power on!'),
    decoy: S('Never wade outside in a flood: the bike can be replaced!'),
    decoySay: S('Never wade outside in a flood. Floodwater can hide holes, sharp things and strong currents. **The bike can be replaced!**'),
    radioSay: S('Evacuation updates coming! Keep the radio on: it tells you when to leave.'),
    warnSoon: S('Radio: an evacuation order may come any second!'),
    orderSay: S('**EVACUATE NOW!** Leave everything else behind. Go together to the exit.'),
    orderBanner: S('EVACUATE NOW!'), orderTap: S('Tap or press E'), orderPre: S('Evacuation order coming…'),
    routeAsk: S('How will the family get out?'), routeBoat: S('Wait for the rescue boat'), routeStreet: S('Cut through the flooded street'),
    routeBad: S('Moving floodwater can knock you down in seconds. Never cut through it: wait for the rescue boat!'),
    routeOk: S('Right! Wait for the boat and keep the family together.'),
    flashSay: S('Flashlight on! Use a flashlight, never a candle: a candle can start a fire.'),
    outageSay: S('The power is out, but it can come back while the water is high. Switch off the main power anyway!'),
    surge: S('The flood is surging!'), allSet: S('All set! Keep everyone upstairs while the water peaks.'),
    full: S('Your queue is full (4). Tap a chip to remove one.'), chainPop: S('Chain!'),
    powerFirst: S('Switch off the main power first. When the water reaches the outlets, electricity is a danger!'),
    lolaFirst: S('Lola walks slowly. Help her early, before the water is in the house!'),
    hintKey: S('← → or Tab: pick a bubble · Enter: queue it · Backspace: undo'), hintTouch: S('Tap a bubble to queue it. Tap a chip to remove it.'),
    queueEmpty: S('Your queue'),
    msg3: S('Perfect! Power off first, the family safe, nothing wasted.'),
    msg2: S('Great job! For 3 stars: waste less time and keep all your hearts.'),
    msg1: S('Everyone is safe! Next time, switch the power off before the water reaches the outlets and save your papers, water and go bag.'),
    msg0: S('The family got out, but it was close. Power off first, move up, and never walk through floodwater.'),
    msgEvac: S('You left when you were told to. That is the safest choice!'),
    msgFail: S('Good try! Switch off the main power first, then move people and things upstairs. Never walk through floodwater.')
  };
  const fmt = (t, vars) => pick(t).replace(/\{(\w+)\}/g, (_, k) => (vars[k] == null ? '' : vars[k]));

  const CSS = `
#ag-app .rwh { display: grid; gap: 8px; justify-items: center; width: 100%; }
#ag-app .rwh-box { position: relative; width: 100%; max-width: calc(62vh * 1.7778); }
#ag-app .rwh-note { position: absolute; left: 0; right: 0; top: 4px; text-align: center; pointer-events: none; font-family: var(--font-display); font-size: var(--step-0); color: #fff; text-shadow: 0 2px 0 #1e1538, 0 0 6px #1e1538; }
#ag-app .rwh-evac { position: absolute; left: 50%; top: 14px; transform: translateX(-50%); z-index: 5; display: flex; flex-direction: column; align-items: center; gap: 2px; padding: 10px 22px; min-width: 220px; min-height: 56px;
  background: #e0245e; color: #fff; border: 3px solid #1e1538; box-shadow: 0 4px 0 #1e1538; font-family: var(--font-display); font-size: 1.5rem; cursor: pointer; animation: rwh-blink .7s steps(2) infinite; }
#ag-app .rwh-evac small { font-family: var(--font-body); font-size: .8rem; font-weight: 800; color: #ffd23f; }
#ag-app .rwh-evac[hidden] { display: none; }
@keyframes rwh-blink { 50% { background: #b3123f; } }
#ag-app .rwh-route { position: fixed; inset: 0; z-index: 60; display: grid; place-items: center; background: rgba(30, 21, 56, .55); padding: 8px; overflow: auto; }
#ag-app .rwh-route > div { background: var(--panel, #fff8e6); border: 3px solid #1e1538; box-shadow: 0 4px 0 #1e1538; padding: 10px; display: grid; gap: 8px; max-width: 520px; width: 100%; }
#ag-app .rwh-route b { font-family: var(--font-display); font-size: 1.1rem; color: #1e1538; text-align: center; }
#ag-app .rwh-chips { display: flex; gap: 8px; justify-content: center; align-items: center; flex-wrap: wrap; min-height: 48px; }
#ag-app .rwh-chips small { font-weight: 800; color: var(--muted); font-size: .8rem; }
#ag-app .rwh-chip { display: inline-flex; align-items: center; gap: 6px; min-width: 112px; min-height: 44px; padding: 4px 10px; background: #fff8e6; border: 3px solid #1e1538; box-shadow: 0 3px 0 #1e1538; font-weight: 800; font-size: .85rem; color: #1e1538; cursor: pointer; }
#ag-app .rwh-chip img { width: 28px; height: 28px; image-rendering: pixelated; }
#ag-app .rwh-chip b { background: #ffd23f; border: 2px solid #1e1538; min-width: 22px; text-align: center; font-family: var(--font-display); }
#ag-app .rwh-chip.now { background: #d6f7dc; }
#ag-app .rwh-chip.empty { opacity: .45; border-style: dashed; box-shadow: none; cursor: default; justify-content: center; }
#ag-app .rwh-hint { font-size: .85rem; color: var(--muted); font-weight: 700; text-align: center; min-height: 1.2em; }
@media (prefers-reduced-motion: reduce) { #ag-app .rwh-evac { animation: none; } }`;
  function injectCss() {
    if (!document.querySelector('style[data-ag-css="rising-water-house"]')) document.head.append(h('style', { 'data-ag-css': 'rising-water-house' }, CSS));
  }
  function label(c, str, x, y, o) {
    o = Object.assign({ size: 12, color: '#fff' }, o);
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) AG.gfx.text(c, str, x + dx, y + dy, Object.assign({}, o, { color: INK, outline: null }));
    AG.gfx.text(c, str, x, y, Object.assign({}, o, { outline: null }));
  }
  const iconUrl = e => AG.pixelIcon(e, 18);

  class RisingWaterScene {
    /** layouts = house_layouts.json, tasks = data/tasks.json (both already loaded). */
    constructor(stage, ctx, done, layouts, tasks) {
      injectCss();
      this.stage = stage; this.ctx = ctx; this.doneFn = done; this.lv = ctx.levelData;
      this.diff = ctx.difficulty === 'advanced' ? 'advanced' : 'easy'; this.D = T.diff[this.diff];
      this.level = ctx.level; this.reduce = AG.reducedMotion(); this.night = !!this.lv.night;
      this.layout = layouts[this.lv.house]; this.defs = {}; tasks.forEach(d => { this.defs[d.id] = d; });
      this.t = 0; this.real = 0; this.clockMul = 1; this.offs = []; this.finished = false; this.dead = false; this.said = new Set();
      this.hearts = T.hearts; this.heartsLost = 0; this.score = 0; this.chainN = 0; this.chainRoom = null; this.chainLinks = 0; this.freeze = 0;
      this.idleMs = 0; this.powerOn = true; this.powerBy = null; this.powerEarly = false; this.firstDone = null; this.radioOn = false; this.gotLight = false;
      this.done = new Set(); this.photoGot = [false, false, false]; this.decoyStarted = false; this.decoyPresent = false; this.saved = {};
      this.order = null; this.evacBonus = 0; this.peaked = false; this.pops = []; this.boat = null; this.sel = null; this.hintTick = 0; this.holdUntil = 0;

      this.view = AG.gfx.canvas(W, H);
      this.rig = ctx.rig('side', { height: T.rigH });
      this.water = new RW.Water({ layout: this.layout, rate: this.lv.riseRate * this.D.water });
      this.graph = R.buildGraph(this.layout);
      this.buildTasks(); this.buildThings();
      this.walker = new AG.sim.Walker({
        graph: this.graph, node: 'radio', rig: this.rig, speed: T.speed.walk, carryIcons: T.carryIcons,
        carryMods: { default: T.speed.carry / T.speed.walk, lola: T.speed.lola / T.speed.walk }, actions: { idle: 'idle', walk: 'walk', work: 'point' }
      });
      this.queue = new AG.logic.sim.TaskQueue({ walker: this.walker, max: T.queueMax });
      this.bubbles = new AG.sim.TaskBubbles({ queue: this.queue, graph: this.graph, offers: () => this.offers(), dy: T.bubbleDy, size: T.bubbleSize, input: false, icon: t => t.icon });
      this.dark = this.night && AG.grid ? new AG.grid.Darkness({ w: W, h: H, color: '#070816', alpha: 0.94 }) : null;
      this.bind(); this.setupWater(); this.wireQueue();

      this.chipBox = h('div', { class: 'rwh-chips', 'aria-label': 'Your queue' });
      this.note = h('div', { class: 'rwh-note', role: 'status' });
      this.evacBtn = h('button', { type: 'button', class: 'rwh-evac', hidden: true }, pick(STR.orderBanner), h('small', {}, pick(STR.orderTap)));
      this.evacBtn.addEventListener('click', () => this.confirmEvac());
      this.hint = h('div', { class: 'rwh-hint' });
      this.box = h('div', { class: 'rwh-box' }, this.view.cv, this.note, this.evacBtn);
      this.el = h('div', { class: 'rwh' }, this.box, this.chipBox, this.hint);
      stage.append(this.el);
      this.pad = AG.input.touchControls(ctx.controls, { buttons: [{ action: 'UNDO', label: '↶ Undo' }, { action: 'EVAC', label: '🚨 Evacuate' }] });
      this.hud = ctx.hud({ hearts: T.hearts, score: 0, label: STR.water, meter: true });
      this.hud.set({ hearts: this.hearts, score: 0, label: STR.dry, meter: 0 });
      AG.sfx.preload(T.sfx);
      AG.input.setView(this.view);
      const ri = this.readingIdx(); this.sel = ri.length ? this.items()[ri[0]].t.id : null;
      this.drawChips();
      if (AG.debug.on) RW.live = { scene: this };
      if (this.night) ctx.after(700, () => ctx.say('warning', STR.outageSay, { pose: AG.rig.resolve(ctx.expertId, 'alert').frame }));
      else if (this.members.lola) ctx.after(700, () => ctx.say('info', STR.lolaFirst, { pose: AG.rig.resolve(ctx.expertId, 'point').frame }));
      else if (this.level === 1) ctx.after(700, () => ctx.say('info', STR.powerFirst, { pose: AG.rig.resolve(ctx.expertId, 'point').frame }));
      this.stopLoop = AG.gfx.loop(dt => this.frame(dt));
    }

    /* ---------- the level's tasks, things and family ---------- */
    buildTasks() {
      const lv = this.lv, drop = this.diff === 'easy' ? lv.easyDrop || [] : [];
      let ids = lv.tasks.filter(id => !drop.includes(id));
      if (this.diff === 'advanced' && !ids.includes('bike')) ids.push('bike'); // the decoy shows more often on Advanced
      if (lv.decoy === 'advanced' && this.diff === 'easy') ids = ids.filter(id => id !== 'bike');
      this.ids = ids; this.decoyPresent = ids.includes('bike');
      this.photoNodes = lv.photos.slice(0, 3);
    }
    buildThings() {
      const L = this.layout, P = L.props, A = T.art.props;
      const mk = (id, key, w, hh, node) => ({ id, art: 'rising-water-house.prop.' + A[key], w, h: hh, x: P[key][0], y: P[key][1], nodeId: node, state: 'home' });
      this.things = {
        tv: mk('tv', 'tv', 32, 30, 'tv'), ref: mk('ref', 'ref', 24, 48, 'ref'), gobag: mk('gobag', 'gobag', 20, 24, 'gobag'),
        docs: mk('docs', 'cabinet', 28, 36, 'cabinet'), water: mk('water', 'jugs', 26, 20, 'jugs'), radio: mk('radio', 'radio', 22, 14, 'radio')
      };
      this.bike = { x: P.bike[0], y: P.bike[1], w: 40, h: 24 };
      this.members = {};
      const gy = L.groundFloorY, uy = L.upperFloorY, F = T.family;
      const need = { lola: 'lola', dog: 'pets', chicken: 'pets' }; // a family member whose task is not in this level is not in it either
      (this.lv.family || []).filter(id => !need[id] || this.ids.includes(need[id])).forEach(id => {
        const f = F[id], home = id === 'lola' ? [T.nodes.lola[0], gy] : id === 'dog' ? [72, gy] : id === 'chicken' ? [98, gy] : [176, uy];
        this.members[id] = Object.assign({ id, state: id === 'baby' ? 'up' : 'home', x: home[0], y: home[1], nodeId: id === 'lola' ? 'lola' : id === 'baby' ? 'bedroom' : 'yard', wk: null, face: 1, boarded: false }, f);
      });
    }
    taskDef(id) { return this.defs[id]; }
    /** The queue task for a def id at its current node (null when nothing to offer). */
    mkTask(id, extra) {
      const d = this.defs[id] || this.defs[id.replace(/\d+$/, '')];
      return Object.assign({ id, def: d, nodeId: d.node, durationMs: d.durationMs, icon: d.icon, deliverTo: d.deliverTo, carry: d.carry, action: d.action, decoy: !!d.decoy, optional: !!d.optional, prio: d.prio, points: d.points }, extra);
    }
    groundOk() { return !this.water.above('waist'); }
    /** Everything the player can queue right now. */
    offers() {
      if (this.finished || this.order) return [];
      const out = [], g = this.groundOk(), M = this.members;
      this.ids.forEach(id => {
        const d = this.defs[id];
        if (this.done.has(id)) return;
        if (d.ground && !g) return;
        let t = null;
        if (id === 'power') { if (this.powerOn && !this.water.above('outlet')) t = this.mkTask(id); }
        else if (id === 'lola') { const m = M.lola; if (m && m.state === 'home') t = this.mkTask(id, { nodeId: m.nodeId }); }
        else if (id === 'pets') { const m = M.dog || M.chicken; if (m && m.state === 'home') t = this.mkTask(id, { nodeId: m.nodeId }); }
        else if (this.things[id]) { const it = this.things[id]; if (it.state === 'home') t = this.mkTask(id, { nodeId: it.nodeId }); }
        else if (id === 'flashlight') { if (!this.gotLight) t = this.mkTask(id); }
        else if (id === 'bike') { if (!this.decoyStarted) t = this.mkTask(id); }
        if (t) out.push(t);
      });
      this.photoNodes.forEach((n, i) => {
        if (this.photoGot[i] || (R.isGround(n) && (!g || this.water.above('knee')))) return;
        out.push(this.mkTask('photo' + (i + 1), { nodeId: n }));
      });
      return out;
    }
    familySafe() { return Object.values(this.members).every(m => m.state === 'up' || m.boarded); }
    essentialsSaved() { return ['docs', 'water', 'gobag'].every(id => !this.ids.includes(id) || this.saved[id]); }

    /* ---------- input ---------- */
    items() { return this.bubbles.items(); }
    readingIdx() { return R.readingOrder(this.items()); }
    step(d) {
      const ord = this.readingIdx(), it = this.items();
      if (!ord.length) return;
      const cur = ord.findIndex(i => it[i].t.id === this.sel);
      this.sel = it[ord[cur < 0 ? (d > 0 ? 0 : ord.length - 1) : (cur + d + ord.length) % ord.length]].t.id;
    }
    toggleSel() {
      if (this.order) return this.order.state === 'pending' ? this.confirmEvac() : false;
      const it = this.items().find(i => i.t.id === this.sel);
      if (it) this.toggle(it.t);
    }
    toggle(task) {
      if (this.finished || this.order || this.chooser) return;
      if (this.queue.has(task.id)) { this.queue.cancel(task.id); return; }
      if (this.queue.full) { this.pop(pick(STR.full), this.walker.px, this.walker.py - 60, false); return; }
      this.queue.add(task);
    }
    bind() {
      const on = (a, f) => this.offs.push(AG.input.on(a, e => { if (e.phase === 'down' && !this.finished) f(e); }));
      AG.input.register('EVAC', { keys: ['KeyE'], button: { en: 'Evacuate' } });
      ['LEFT', 'UP'].forEach(a => on(a, () => this.step(-1)));
      ['RIGHT', 'DOWN'].forEach(a => on(a, () => this.step(1)));
      on('NEXT_ZONE', e => this.step(e.event && e.event.shiftKey ? -1 : 1));
      on('CONFIRM', () => this.toggleSel());
      on('UNDO', () => { if (!this.order && !this.chooser) this.queue.cancelLast(); });
      on('EVAC', () => this.confirmEvac());
      this.offs.push(AG.input.onPointer('tap', p => {
        if (this.finished || this.order || this.chooser) return;
        const i = this.bubbles.hit(p.x, p.y);
        if (i >= 0) { const t = this.items()[i].t; this.sel = t.id; this.toggle(t); }
      }));
    }
    drawChips() {
      const q = this.queue, kids = [];
      for (let i = 0; i < T.queueMax; i++) {
        const t = q.items[i];
        if (!t) { kids.push(h('span', { class: 'rwh-chip empty', 'aria-hidden': 'true' }, '—')); continue; }
        const b = h('button', { type: 'button', class: 'rwh-chip' + (q.current && q.current.id === t.id ? ' now' : ''), 'aria-label': pick(t.def.label) + ' (remove)', title: pick(t.def.label) },
          h('b', {}, String(i + 1)), h('img', { src: iconUrl(t.icon), alt: '' }), pick(t.def.label));
        b.addEventListener('click', () => { if (!this.order) q.cancel(t.id); });
        kids.push(b);
      }
      this.chipBox.replaceChildren(...kids);
      this.chipKey = q.items.map(t => t.id).join(',') + '|' + (q.current ? q.current.id : '');
    }

    /* ---------- effects ---------- */
    pop(text, cx, cy, good) {
      const k = this.box.clientWidth / W || 1;
      AG.kit.pop(this.box, Math.round(cx * k), Math.round(cy * k), text, good !== false);
    }
    addScore(n, cx, cy) { if (n > 0) { this.score += n; this.hud.set({ score: this.score }); this.pop('+' + n, cx, cy - 56, true); } }
    hurt(text, expertPose) {
      if (this.finished) return;
      this.hearts = Math.max(0, this.hearts - 1); this.heartsLost++;
      this.hud.set({ hearts: this.hearts });
      this.rig.play('oops'); this.freeze = Math.max(this.freeze, 900);
      AG.sfx.play('oops');
      this.ctx.say('warning', text, { pose: AG.rig.resolve(this.ctx.expertId, expertPose || 'alert').frame });
      if (this.hearts <= 0) this.over();
    }
    onFloorGround() { return this.walker.y > (this.layout.upperFloorY + this.layout.groundFloorY) / 2; }

    /* ---------- the flood's three lines ---------- */
    setupWater() {
      const w = this.water, gEdges = [];
      const gs = T.ground.slice().sort((a, b) => T.nodes[a][0] - T.nodes[b][0]);
      for (let i = 1; i < gs.length; i++) gEdges.push([gs[i - 1], gs[i]]);
      const setMul = m => gEdges.forEach(([a, b]) => this.graph.setEdge(a, b, m === 'blocked' ? { blocked: true } : { mul: m }));
      w.on('outlet', () => {
        setMul(1.3);
        if (this.powerOn) {
          this.powerOn = false; this.powerBy = 'adult'; this.queue.cancel('power');
          AG.sfx.play(T.sfx[0]);
          this.hurt(STR.outlet, 'alert');
          this.pop(pick(STR.outletAuto), W / 2, 90, false);
        }
      });
      w.on('knee', () => {
        setMul(1.7);
        let n = 0;
        Object.values(this.things).forEach(it => {
          if (it.id !== 'radio' && it.state === 'home' && R.isGround(it.nodeId)) { it.state = 'ruined'; n++; this.queue.cancel(it.id); }
        });
        this.photoNodes.forEach((nd, i) => { if (R.isGround(nd)) this.queue.cancel('photo' + (i + 1)); });
        AG.sfx.play(T.sfx[1]);
        this.ctx.say('info', STR.knee_, { pose: AG.rig.resolve(this.ctx.expertId, 'point').frame });
      });
      w.on('waist', () => {
        setMul('blocked');
        const q = this.queue, cur = q.current, onGround = this.onFloorGround();
        q.items.slice().forEach(t => { if (R.isGround(t.nodeId) && !(t === cur && q.phase === 'deliver')) q.cancel(t.id); });
        // an adult carries Lola and the pets up; what the player carries goes up with the player
        Object.values(this.members).forEach(m => { if (m.state === 'home') this.putUp(m); if (m.wk && R.isGround(this.nearNode(m.wk))) { m.wk.teleport('stair_top'); if (this.order) m.wk.goTo('window'); } });
        if (onGround) {
          if (cur && q.items.includes(cur) && q.phase === 'deliver') this.landCarried(cur);
          q.clear(); this.walker.teleport('stair_top');
          this.hurt(STR.waist_, 'alert');
        } else this.ctx.say('warning', STR.waist_, { pose: AG.rig.resolve(this.ctx.expertId, 'alert').frame });
      });
      w.on('peak', () => { this.peaked = true; });
    }
    setNote(text, sec) { this.note.textContent = pick(text); this.noteUntil = this.real + sec; }
    nearNode(wk) { const n = this.graph.nearest(wk.x, wk.y); return n ? n.id : 'stair_top'; }
    putUp(m) {
      if (m.id === 'lola') { m.state = 'up'; m.nodeId = 'bedroom'; m.x = T.nodes.bedroom[0]; m.y = this.layout.upperFloorY; }
      else if (m.id === 'dog' || m.id === 'chicken') { m.state = 'up'; m.x = T.stash[m.id] + m.w / 2; m.y = this.layout.upperFloorY; }
    }
    landCarried(t) {
      const it = this.things[t.id];
      if (it && it.state === 'carried') { it.state = 'up'; it.x = T.stash[t.id]; it.y = this.layout.upperFloorY - it.h; this.saved[t.id] = true; }
      if (t.id === 'pets') ['dog', 'chicken'].forEach(i => { if (this.members[i]) this.putUp(this.members[i]); });
      if (t.id === 'lola' && this.members.lola) this.putUp(this.members.lola);
    }

    /* ---------- the queue's events ---------- */
    wireQueue() {
      const q = this.queue;
      q.on('add', () => { this.drawChips(); AG.sfx.play('tap'); });
      q.on('cancel', t => { this.dropCarried(t); this.drawChips(); });
      q.on('pickup', t => {
        const it = this.things[t.id];
        if (it) it.state = 'carried';
        if (t.id === 'pets') ['dog', 'chicken'].forEach(i => { if (this.members[i]) this.members[i].state = 'carried'; });
        if (t.id === 'lola') this.members.lola.state = 'escort';
        AG.sfx.play('tap'); this.drawChips();
      });
      q.on('complete', t => { this.drawChips(); this.completed(t); });
      q.on('start', () => this.drawChips());
      q.on('full', () => this.pop(pick(STR.full), this.walker.px, this.walker.py - 60, false));
    }
    /** A cancelled carry drops at the nearest node, so nothing (and no Lola) gets stuck between floors. */
    dropCarried(t) {
      const n = this.graph.nearest(this.walker.x, this.walker.y), nid = n ? n.id : 'stair_bottom', nd = this.graph.node(nid);
      const it = this.things[t.id];
      if (it && it.state === 'carried') { it.state = 'home'; it.nodeId = nid; it.x = nd.x - it.w / 2; it.y = nd.y - it.h; }
      if (t.id === 'pets') ['dog', 'chicken'].forEach(i => { const m = this.members[i]; if (m && m.state === 'carried') { m.state = 'home'; m.nodeId = nid; m.x = nd.x + (i === 'dog' ? -8 : 10); m.y = nd.y; } });
      if (t.id === 'lola') { const m = this.members.lola; if (m.state === 'escort') { m.state = 'home'; m.nodeId = nid; m.x = nd.x; m.y = nd.y; } }
    }
    completed(t) {
      const d = t.def, k = d.kind, w = this.walker, id = t.id;
      let pts = d.points || 0;
      if (k === 'evac') { this.evacDone = true; return; }
      if (k === 'power') { this.powerOn = false; this.powerBy = 'player'; this.powerEarly = !this.water.above('outlet'); AG.sfx.play(T.sfx[0]); }
      else if (k === 'item' && !d.deliverTo) { this.things[id].state = 'saved'; this.saved[id] = true; }
      else if (k === 'item') { const it = this.things[id]; it.state = 'up'; it.x = T.stash[id]; it.y = this.layout.upperFloorY - it.h; this.saved[id] = true; }
      else if (k === 'escort') { this.putUp(this.members.lola); }
      else if (k === 'pets') ['dog', 'chicken'].forEach(i => { if (this.members[i]) this.putUp(this.members[i]); });
      else if (k === 'radio') {
        this.things.radio.state = 'saved'; this.radioOn = true;
        this.ctx.say('info', STR.radioSay, { pose: AG.rig.resolve(this.ctx.expertId, 'hold:radio').frame });
        this.rig.play('happy'); this.holdUntil = 1100;
      } else if (k === 'light') {
        this.gotLight = true; this.rig.setGear('flashlight'); this.walker.actions.idle = 'hold:flashlight';
        this.ctx.say('info', STR.flashSay, { pose: AG.rig.resolve(this.ctx.expertId, 'point').frame });
      } else if (k === 'photo') { this.photoGot[+id.slice(5) - 1] = true; this.pop('📸', w.px, w.py - 60, true); pts = 0; }
      this.done.add(id);
      AG.sfx.play(T.sfx[2]);
      if (k !== 'photo' && k !== 'light' && this.firstDone == null) this.firstDone = id;
      if (k !== 'photo' && k !== 'decoy') {
        const room = T.roomOf[t.nodeId];
        if (R.chains(this.chainRoom, room)) { this.chainN++; this.chainLinks++; const b = R.chainBonus(this.chainN); pts += b; this.pop(pick(STR.chainPop) + ' +' + b, w.px, w.py - 78, true); } else this.chainN = 0;
        this.chainRoom = room;
      }
      this.chainPts = (this.chainPts || 0) + (pts - (d.points || 0));
      this.addScore(pts, w.px, w.py);
      if (k === 'power' || k === 'escort' || k === 'pets') this.ctx.safe(1);
    }
    /** The decoy: queued and started → the wade-warning moment. */
    decoyHit() {
      const t = this.queue.current;
      this.decoyStarted = true; this.done.add('bike');
      this.queue.cancel(t.id); this.walker.stop();
      this.rig.play('stop'); this.freeze = 1500;
      this.pop(pick(STR.decoy), W / 2, 80, false);
      this.hurt(STR.decoySay, 'point');
      this.rig.play('stop');
    }

    /* ---------- the evacuation order ---------- */
    evacAt() { return this.lv.evacAtMs ? this.lv.evacAtMs * this.D.evac / 1000 : Infinity; }
    triggerOrder() {
      this.order = { state: 'pending', real0: this.real, delay: 0, wrong: 0 };
      this.queue.clear(); this.walker.stop();
      this.clockMul = 1; this.water.setMul(1);
      this.rig.play('alert');
      AG.sfx.play(T.sfx[3]);
      this.ctx.say('warning', STR.orderSay, { pose: AG.rig.resolve(this.ctx.expertId, 'alert').frame });
      this.evacBtn.hidden = false; this.setNote(S(''), 0.01);
      this.drawChips();
    }
    confirmEvac() {
      const o = this.order;
      if (!o || o.state !== 'pending' || this.finished) return;
      if (this.lv.routes) this.openRoutes(); else this.goEvac();
    }
    openRoutes() {
      this.order.state = 'choosing';
      const opts = [
        { text: STR.routeBoat, icon: 'boat', ok: true },
        { text: STR.routeStreet, icon: 'sign_nowading', ok: false }
      ];
      this.chooser = AG.kit.choices(opts, (o, i) => {
        if (o.ok) { this.closeRoutes(); this.ctx.say('success', STR.routeOk); this.goEvac(); return; }
        this.chooser.mark(i, false); this.order.wrong++;
        this.rig.play('stop'); this.freeze = 1400;
        this.hurt(STR.routeBad, 'alert');
        this.rig.play('stop');
      }, { label: STR.routeAsk });
      this.modal = h('div', { class: 'rwh-route' }, h('div', {}, h('b', {}, pick(STR.routeAsk)), this.chooser.el));
      this.stage.append(this.modal);
      setTimeout(() => { const b = this.chooser && this.chooser.btns[0]; if (b) b.focus(); }, 40);
    }
    closeRoutes() {
      if (this.chooser) { this.chooser.destroy(); this.chooser = null; }
      if (this.modal) { this.modal.remove(); this.modal = null; }
    }
    goEvac() {
      const o = this.order; o.state = 'moving'; o.delay = this.real - o.real0;
      this.evacBtn.hidden = true; this.ctx.safe(1);
      this.boat = { x: -76, t: 0, docked: false };
      this.queue.add({ id: 'evacuate', def: { label: S('Evacuate'), ground: false, kind: 'evac' }, nodeId: 'window', durationMs: 500, action: 'cheer', icon: '🚨' });
      Object.values(this.members).forEach(m => {
        if (m.boarded) return;
        const sp = T.speed.evac[m.id];
        m.state = 'moving';
        m.wk = new AG.sim.Walker({ graph: this.graph, x: m.x, y: m.y, speed: sp });
        m.wk.on('arrive', () => { m.arrived = true; });
        if (!m.wk.goTo('window')) { m.wk.teleport('stair_top'); m.wk.goTo('window'); }
      });
      this.drawChips();
    }
    updateEvac(dt) {
      const o = this.order;
      if (!o || o.state !== 'moving') return;
      const b = this.boat; b.t += dt; b.x = Math.min(36, b.x + 70 * dt); b.docked = b.x >= 36;
      Object.values(this.members).forEach(m => { if (m.wk) { m.wk.update(dt); m.x = m.wk.x; m.y = m.wk.y; if (m.arrived && b.docked) m.boarded = true; } });
      if (!this.finished && b.docked && this.evacDone && Object.values(this.members).every(m => m.boarded)) {
        o.state = 'done'; this.rig.play('cheer');
        this.evacBonus = R.evacBonus(o.delay);
        this.score += this.evacBonus; this.hud.set({ score: this.score });
        AG.kit.celebrate(this.stage); AG.sfx.play('star');
        this.ctx.after(1400, () => this.finish(true));
      }
    }

    /* ---------- the frame ---------- */
    frame(dt) {
      if (this.finished) { this.draw(dt); return; }
      dt = Math.min(dt, 0.05);
      this.real += dt;
      this.update(dt);
      this.draw(dt);
    }
    update(dt) {
      const w = this.water;
      // the clock: skipping ahead once nothing is left to do, and the flood surges at peakMs
      if (!this.order || this.order.state === 'done') {
        const offers = this.offers(), left = offers.filter(t => !t.optional && !t.decoy);
        const idleDone = !left.length && this.queue.idle && this.familySafe() && !this.lv.evacAtMs;
        const wait = this.lv.evacAtMs && !this.order && !left.length && this.queue.idle && this.familySafe();
        const surge = this.t >= this.lv.peakMs / 1000;
        let mul = 1;
        if (idleDone || surge) mul = Math.max(T.ffMul, (w.peak - w.depth) / w.baseRate / 8);
        else if (wait) mul = Math.max(T.ffMul, (this.evacAt() - this.t) / 6);
        if (Math.abs(mul - this.clockMul) > 1e-6) {
          this.clockMul = mul; w.setMul(mul);
          if (surge && !this.said.has('surge')) { this.said.add('surge'); this.setNote(STR.surge, 5); }
          else if ((idleDone || wait) && !this.said.has('allset')) { this.said.add('allset'); this.ctx.say('info', STR.allSet, { pose: AG.rig.resolve(this.ctx.expertId, 'point').frame }); }
        }
      }
      this.t += dt * this.clockMul;
      if (!this.said.has('warn') && this.radioOn && this.lv.evacAtMs && !this.order && this.t >= this.evacAt() - 5) {
        this.said.add('warn'); this.setNote(STR.orderPre, 6); AG.sfx.play(T.sfx[3]);
        this.ctx.say('warning', STR.warnSoon, { pose: AG.rig.resolve(this.ctx.expertId, 'alert').frame });
      }
      if (!this.order && this.t >= this.evacAt()) this.triggerOrder();

      w.update(dt);
      if (this.freeze > 0) {
        this.freeze -= dt * 1000;
        if (this.freeze <= 0) { this.freeze = 0; this.walker.syncRig(); }
      } else {
        if (this.holdUntil > 0) { this.holdUntil -= dt * 1000; if (this.holdUntil <= 0) this.walker.syncRig(); }
        this.walker.update(dt); this.queue.update(dt);
        if (this.queue.current && this.queue.current.decoy) this.decoyHit();
        if (R.wadePenalty(w.depth, w.lines.outlet, this.powerOn, this.walker.moving && this.onFloorGround(), this.real * 1000, this.lastWade)) { this.lastWade = this.real * 1000; this.hurt(STR.wade, 'alert'); }
      }
      if (this.order && !this.finished) { this.updateEvac(dt); if (this.order.state === 'pending' && this.freeze <= 0) this.rig.play('alert'); }
      // Lola walks beside the player on an escort
      const lola = this.members.lola;
      if (lola && lola.state === 'escort') {
        const side = this.walker.rig.facing === 'left' ? 16 : -16, k = 1 - Math.exp(-10 * dt);
        lola.x += (this.walker.x + side - lola.x) * k; lola.y = this.walker.y; lola.face = side < 0 ? 1 : -1;
      }
      if (!this.order && this.queue.idle && this.freeze <= 0 && this.offers().some(t => !t.decoy && !t.optional)) this.idleMs += dt * 1000;
      if (this.peaked && !this.order && !this.finished && !this.endAt) this.endAt = this.real + 1.4;
      if (this.endAt && this.real >= this.endAt && !this.finished) { this.rig.play('cheer'); AG.kit.celebrate(this.stage); this.finish(this.familySafe()); }
      const lvl = w.above('waist') ? STR.waist : w.above('knee') ? STR.knee : w.above('outlet') ? STR.ankle : STR.dry, m = Math.round(w.ratio * 100);
      if (m !== this.lastMeter || lvl !== this.lastLvl) { this.lastMeter = m; this.lastLvl = lvl; this.hud.set({ meter: w.ratio, label: lvl, warn: w.above('outlet') }); }
      const chipKey = this.queue.items.map(t => t.id).join(',') + '|' + (this.queue.current ? this.queue.current.id : '');
      if (chipKey !== this.chipKey) this.drawChips();
      if ((this.hintTick += dt) > 0.5) { this.hintTick = 0; this.hint.textContent = pick(AG.input.lastDevice === 'touch' ? STR.hintTouch : STR.hintKey); }
      if (this.noteUntil && this.real > this.noteUntil) { this.noteUntil = 0; this.note.textContent = ''; }
      // keep the selection on a live bubble
      const it = this.items();
      if (it.length && !it.some(i => i.t.id === this.sel)) this.sel = it[this.readingIdx()[0]].t.id;
    }

    /* ---------- drawing ---------- */
    drawThing(c, it, x, y, w, hh, state) {
      if (state === 'ruined') { c.save(); c.globalAlpha = 0.5; if ('filter' in c) c.filter = 'grayscale(1)'; AG.assets.draw(c, it.art, x, y, w, hh); c.restore(); } else AG.assets.draw(c, it.art, x, y, w, hh);
    }
    mark(c, x, y, ok) { // a check (saved) or a cross (ruined): a shape, not only a colour
      c.fillStyle = INK; c.fillRect(x - 1, y - 1, 12, 12); c.fillStyle = ok ? '#7ee08a' : '#e0245e'; c.fillRect(x, y, 10, 10);
      c.fillStyle = INK;
      if (ok) { c.fillRect(x + 2, y + 5, 2, 2); c.fillRect(x + 4, y + 7, 2, 2); c.fillRect(x + 6, y + 3, 2, 4); }
      else { for (let i = 2; i < 8; i++) { c.fillRect(x + i, y + i, 1, 1); c.fillRect(x + 9 - i, y + i, 1, 1); } }
    }
    drawMember(c, m, t) {
      if (m.state === 'carried' || m.boarded) return;
      const moving = m.state === 'escort' || (m.wk && m.wk.moving);
      const frame = this.reduce ? 0 : moving ? Math.floor(t * 5) % 2 : 0;
      const x = Math.round(m.x), y = Math.round(m.y);
      if (m.id === 'baby') { AG.assets.draw(c, m.art, x - m.w / 2, y - m.h - 2, m.w, m.h, 0); return; }
      if (m.wk && m.wk.seg) { const dx = m.wk.seg.bx - m.wk.seg.ax; m.face = dx < 0 ? -1 : 1; }
      c.save();
      if (m.face < 0 && m.id !== 'lola') { c.translate(x, 0); c.scale(-1, 1); AG.assets.draw(c, m.art, -m.w / 2, y - m.h, m.w, m.h, frame); } else AG.assets.draw(c, m.art, x - m.w / 2, y - m.h, m.w, m.h, frame);
      c.restore();
    }
    draw(dt) {
      const c = this.view.ctx, L = this.layout, w = this.water, t = performance.now() / 1000, gy = L.groundFloorY;
      c.imageSmoothingEnabled = false;
      AG.assets.draw(c, T.art.houses[this.lv.house], 0, 0, W, H);
      // outlets and the breaker
      [L.props.outlet_1, L.props.outlet_2].forEach(p => {
        AG.assets.draw(c, T.art.outlet, p[0], p[1], 8, 10);
        if (this.powerOn && w.depth > w.lines.outlet - 8 && !this.reduce && Math.floor(t * 6) % 2) AG.gfx.drawIcon(c, '⚡', p[0] - 5, p[1] - 20, 1);
      });
      AG.assets.draw(c, this.powerOn ? T.art.breakerOn : T.art.breakerOff, L.props.breaker[0], L.props.breaker[1], 20, 26);
      this.drawBike(c);
      // things at home or ruined, then saved ones upstairs
      Object.values(this.things).forEach(it => {
        if (it.state === 'carried' || !this.ids.includes(it.id)) return;
        this.drawThing(c, it, Math.round(it.x), Math.round(it.y), it.w, it.h, it.state);
        if (it.state === 'saved' || (it.state === 'up')) this.mark(c, Math.round(it.x + it.w - 6), Math.round(it.y - 6), true);
        if (it.state === 'ruined') this.mark(c, Math.round(it.x + it.w - 6), Math.round(it.y - 6), false);
      });
      Object.values(this.members).forEach(m => this.drawMember(c, m, t));
      if (this.boat) this.drawBoat(c, t);
      // the walker, then the flood over its feet
      this.walker.draw(c, t);
      if (this.gotLight && this.walker.moving && !this.rig.agila) AG.gfx.drawIcon(c, 'flashlight', this.walker.px + 8, this.walker.py - 34, 1);
      this.drawWater(c, t);
      if (this.dark) this.dark.draw(c, { lights: [{ x: this.walker.px, y: this.walker.py - 18, r: this.gotLight ? T.light.flash : T.light.base }], t });
      this.drawBubbles(c, t);
      this.drawHud(c);
    }
    drawBike(c) {
      const b = this.bike;
      if (!this.ids.includes('bike')) return;
      c.save(); if (this.water.above('knee')) c.globalAlpha = 0.6;
      AG.assets.draw(c, T.art.bike, b.x, b.y, b.w, b.h);
      c.restore();
    }
    drawBoat(c, t) {
      const b = this.boat, y = Math.round(this.water.surfaceY - 22 + (this.reduce ? 0 : Math.sin(t * 2) * 1.5));
      AG.assets.draw(c, T.art.boat, Math.round(b.x), y, 64, 28);
      Object.values(this.members).filter(m => m.boarded).forEach((m, i) => { AG.assets.draw(c, m.art, Math.round(b.x) + 8 + i * 12, y - m.h + 12, Math.min(m.w, 14), Math.min(m.h, 18), 0); });
    }
    drawWater(c, t) {
      const w = this.water, gy = this.layout.groundFloorY, sy = Math.round(w.surfaceY);
      if (w.depth <= 0.5) return;
      c.save();
      c.globalAlpha = 0.55; c.fillStyle = '#2a6ad8'; c.fillRect(0, sy, W, H - sy);
      c.globalAlpha = 0.25; c.fillStyle = '#1e1538'; for (let y = sy + 6; y < H; y += 6) c.fillRect(0, y, W, 1);
      c.restore();
      const f = this.reduce ? 0 : Math.floor(t * 4) % 4;
      AG.assets.draw(c, T.art.surface, 0, sy - 4, W, 8, f);
      if (this.lv.routes || this.order) AG.assets.draw(c, T.art.current, 0, gy - 18, 110, 20, this.reduce ? 0 : Math.floor(t * 5) % 4);
    }
    drawBubbles(c, t) {
      const q = this.queue, L = this.layout, gy = L.groundFloorY;
      // the water lines on the wall: dashed, with a marker icon whose shape differs
      [['outlet', L.outletY], ['knee', L.kneeY], ['waist', L.waistY]].forEach(([id, y]) => {
        AG.sim.draw.line(c, 118, y, 452, y, { color: this.water.above(id) ? 'rgba(255,255,255,.7)' : 'rgba(30,21,56,.28)', dash: [3, 7] });
        AG.assets.draw(c, T.art.markers[id], 96, y - 8, 16, 16);
      });
      const it = this.items(), idx = it.findIndex(i => i.t.id === this.sel);
      if (idx >= 0) this.bubbles.sel = idx;
      this.bubbles.draw(c, t);
      const sug = this.D.glow && !this.order ? R.suggest(this.offers(), new Set(q.items.map(x => x.id))) : null;
      if (sug) {
        const i = it.findIndex(x => x.t.id === sug.id), b = this.bubbles.boxes[i];
        if (b) {
          const k = this.reduce ? 1 : (Math.floor(t * 3) % 2) + 1;
          c.fillStyle = GOLD; c.fillRect(b.x - 3 - k, b.y - 3 - k, b.w + 6 + 2 * k, 2); c.fillRect(b.x - 3 - k, b.y + b.w + 1 + k, b.w + 6 + 2 * k, 2);
          c.fillRect(b.x - 3 - k, b.y - 3 - k, 2, b.w + 6 + 2 * k); c.fillRect(b.x + b.w + 1 + k, b.y - 3 - k, 2, b.w + 6 + 2 * k);
          c.fillStyle = INK; c.fillRect(b.x + b.w / 2 - 3, b.y - 9 - k, 7, 2); c.fillRect(b.x + b.w / 2 - 2, b.y - 7 - k, 5, 2); c.fillRect(b.x + b.w / 2 - 1, b.y - 5 - k, 3, 2);
        }
      }
    }
    drawHud(c) {
      if (this.order && this.order.state !== 'done') label(c, pick(this.order.state === 'moving' ? S('Everyone to the boat!') : STR.orderBanner), W / 2, 6, { size: 14, align: 'center', color: '#ffd23f' });
    }

    /* ---------- the end ---------- */
    over() {
      if (this.finished || this.dying) return;
      this.dying = true; this.queue.clear(); this.walker.stop(); this.closeRoutes();
      this.rig.play('oops');
      this.ctx.after(1100, () => this.finish(false));
    }
    finish(won) {
      if (this.finished) return;
      this.finished = true; this.closeRoutes(); this.evacBtn.hidden = true;
      const ev = this.order && this.order.state === 'done';
      const familySafe = won && this.familySafe(), early = this.powerBy === 'player' && this.powerEarly;
      const stars = R.stars({ won, familySafe, powerEarly: early, essentialsSaved: this.essentialsSaved(), idleMs: this.idleMs, idleTarget: this.lv.idleTarget, heartsLost: this.heartsLost });
      let events = [];
      AG.store.update('stats', s => {
        events = R.badges(s.risingWater = s.risingWater || {}, { level: this.level, won, powerFirst: this.firstDone === 'power', familySafe, decoyPresent: this.decoyPresent, decoyStarted: this.decoyStarted });
      });
      const msg = !won ? pick(STR.msgFail) : stars >= 3 ? pick(STR.msg3) : stars === 2 ? pick(ev ? STR.msgEvac : STR.msg2) : pick(ev ? STR.msgEvac : STR.msg1);
      const ess = ['docs', 'water', 'gobag'].filter(id => this.ids.includes(id));
      const detail = [
        { label: STR.power, value: pick(this.powerBy === 'player' ? (early ? STR.early : STR.yes) : this.powerBy === 'adult' ? STR.auto : STR.no), icon: '⚡' },
        { label: STR.essentials, value: ess.filter(id => this.saved[id]).length + ' / ' + ess.length, icon: '🎒' },
        { label: STR.family, value: pick(familySafe ? STR.yes : STR.no), icon: '👵' },
        this.chainPts ? { label: STR.chain, value: '+' + this.chainPts, icon: 'star' } : null,
        ev ? { label: STR.evac, value: '+' + this.evacBonus, icon: '🚨' } : null,
        { label: STR.photos, value: this.photoGot.filter(Boolean).length + ' / 3', icon: '📸' },
        { label: STR.hearts, value: this.hearts + ' / ' + T.hearts, icon: 'heart' }
      ].filter(Boolean);
      this.doneFn({
        won, stars, score: this.score, timeMs: Math.round(this.real * 1000), collectibles: this.photoGot.slice(), heartsLeft: this.hearts,
        detail, message: msg, badgeEvents: events, bonusXP: Math.min(10, this.chainLinks), delay: 300
      });
    }
    destroy() {
      this.dead = true;
      if (this.stopLoop) this.stopLoop();
      this.closeRoutes(); this.bubbles.destroy(); this.pad.destroy(); this.el.remove();
      this.offs.forEach(f => f()); this.offs = [];
      if (RW.live && RW.live.scene === this) RW.live = null;
    }
  }

  Object.assign(RW, { STR, RisingWaterScene });
})(window.AG);
