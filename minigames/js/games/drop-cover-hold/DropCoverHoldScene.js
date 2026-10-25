/* Drop! Cover! Hold!: one level, round by round, on an E2 SceneView in 'cycle' mode (480 × 270).
 * Each round: CALM → WARNING (rumble) → CHOOSE a cover spot (or the wheelchair card) → MOVE → HOLD while it
 * shakes → RELEASE when it stops → EXIT the safe way → a toast. The round flow is the pure RoundMachine
 * (js/logic/drop-cover-hold/roundMachine.js); this file draws it and feeds it input: Space and the HOLD button both
 * press the HOLD action, so keyboard, touch and mouse behave the same. */
window.AG = window.AG || {};
(function (AG) {
  const { h, clamp } = AG.util;
  const DCH = AG.dropCoverHold, T = DCH.tuning, SC = DCH.scoring, LOGIC = AG.logic.dropCoverHold;
  const K = 'drop-cover-hold.';
  const W = 480, H = 270, FEET = 206; // the player stands in front of the furniture
  const INK = '#1e1538', PAPER = '#fffaf0', VEST = '#ff7a1a';
  const pick = v => AG.pick(v);
  const fmt = (t, vars) => pick(t).replace(/\{(\w+)\}/g, (_, k) => (vars[k] == null ? '' : vars[k]));
  const S = en => ({ en });

  const STR = {
    round: S('Round'), scene: S('The room'),
    ready: S('Ready…'), rumble: S('Rumbling…'), choose: S('Pick a cover spot!'), card: S('Help your classmate!'),
    drop: S('Drop!'), hold: S('HOLD ON!'), holdNow: S('Press and hold!'), shaking: S('Shaking!'), stopped: S('It stopped! Let go.'),
    exit: S('Pick the safe way out'), walk: S('Walk out calmly'), after: S('Aftershock! Hold on again!'),
    perfect: S('Perfect!'), good: S('Good!'), late: S('Let go sooner next time'),
    holdBtn: S('Hold on (press and hold)'), holdTxt: S('HOLD'),
    letgo: S('Hold on until it stops!'),
    timeout: S("Don't wait! Drop under something sturdy right away."),
    afterMiss: S('Aftershocks can come back. Drop and hold on again right away!'),
    afterOk: S('Good! You held on through the aftershock.'),
    exitLate: S('Take your time, but go: {label} is the safe way.'),
    myth: S('Myth busted! Doorways aren\'t the safest spot. You picked sturdy cover.'),
    perfectRelease: S('You let go right when it stopped!'),
    tPerfect: S('Perfect round!'), tSafe: S('Safe!'), tNext: S("Let's try the next one"), tPts: S('+{n} points'), tStreak: S('streak ×{m}'),
    hChoose: S('Pick a cover spot'), hCard: S('Pick what your classmate should do'), hHold: S('Press and hold HOLD until the shaking stops'),
    hRelease: S('Let go when it stops'), hExit: S('Pick the safe way out'), hAfter: S('Aftershock! Hold on again'),
    cardEyebrow: S('Your classmate uses a wheelchair'), cardAsk: S('The room is shaking! What should your classmate do?'),
    dSpots: S('Safe spots'), dReleases: S('Perfect let-go'), dExits: S('Safe exits'), dReact: S('Best reaction'), dHearts: S('Hearts left'),
    msg3: S('Drop, Cover, Hold, every time! You stayed put until it stopped.'),
    msg2: S('Great job! For 3 stars: take cover fast, let go right when it stops, and keep every heart.'),
    msg1: S('You stayed safe! Play again to react faster and keep your hearts.'),
    msg0: S('Good try! Drop under something sturdy and hold on until the shaking stops.')
  };
  const NAMES = {
    desk: S('Desk'), table: S('Table'), long_table: S('Long table'), glass_table: S('Glass table'), bookshelf: S('Tall bookshelf'),
    window: S('By the window'), doorway: S('Doorway'), light: S('Under the hanging light'), bed: S('Stay in bed'), shelf: S('Beside the shelves'),
    tree: S('Under the tree'), pole: S('Next to the power pole'), wall: S('Next to the wall'), open_ground: S('Open ground'),
    open_area: S('Open area'), storefront: S('By the glass shop')
  };
  const CARD = [
    { text: S('Lock the wheels, cover your head and neck, and hold on'), ok: true, why: S("Yes! Locked wheels can't roll, and covering up keeps your head safe.") },
    { text: S('Get out of the chair and crawl under a desk'), ok: false, why: S('Climbing out while it shakes can hurt. Lock the wheels and cover up right where you are.') },
    { text: S('Roll quickly to the door'), ok: false, why: S('Rolling while it shakes is dangerous. Stay put, lock the wheels and cover your head.') }
  ];
  const HINTS = {
    choose: { keys: ['key_left', 'key_right', 'key_enter'], gesture: 'gesture_tap', text: STR.hChoose },
    card: { keys: ['key_1', 'key_2', 'key_3'], gesture: 'gesture_tap', text: STR.hCard },
    hold: { keys: ['key_space'], gesture: 'gesture_hold', text: STR.hHold },
    release: { keys: ['key_space'], gesture: 'gesture_hold', text: STR.hRelease },
    exit: { keys: ['key_left', 'key_right', 'key_enter'], gesture: 'gesture_tap', text: STR.hExit },
    aftershock: { keys: ['key_space'], gesture: 'gesture_hold', text: STR.hAfter }
  };

  /* ---------- styles, once per page (all under #ag-app, classes dch-) ---------- */
  const CSS = `
#ag-app .dch { position: relative; display: grid; grid-template-columns: minmax(0, 1fr); gap: 8px; width: 100%; }
#ag-app .dch-view { position: relative; overflow: hidden; min-width: 0; display: flex; justify-content: center; background: #1e1538; }
#ag-app .dch-view .ags-view > canvas { width: 100%; height: auto; }
#ag-app .dch-card { position: absolute; inset: 0; display: grid; place-items: center; padding: 6px; background: rgba(30, 21, 56, .55); overflow: auto; }
#ag-app .dch-card__panel { width: min(100%, 560px); box-sizing: border-box; display: grid; gap: 8px; padding: 10px; color: var(--fg); background: var(--panel); border: var(--b) solid var(--ink); box-shadow: 4px 4px 0 var(--shadow-c); }
#ag-app .dch-card__top { display: flex; align-items: center; gap: 10px; }
#ag-app .dch-card__top canvas { flex: none; image-rendering: pixelated; background: #dff1ff; border: 2px solid #1e1538; }
#ag-app .dch-card__ask { margin: 0; font: 700 1.05rem/1.25 var(--font-display); }
#ag-app .dch-card .ag-choices { grid-template-columns: minmax(0, 1fr); gap: 6px; }
#ag-app .dch-card .ag-choice { min-height: 48px; }
#ag-app .dch-card .ag-choice.wrong::after { content: '✖'; margin-left: auto; color: #e0245e; }
#ag-app .dch-card .ag-choice.right::after { content: '✔'; margin-left: auto; color: #2f8a4a; }
#ag-app .dch-ctl { display: flex; align-items: center; justify-content: flex-end; gap: 12px; min-height: 84px; }
#ag-app .dch-hint { flex: 1 1 auto; min-width: 0; justify-content: flex-start; flex-wrap: wrap; }
#ag-app .dch-hint[hidden] { display: flex !important; visibility: hidden; }
#ag-app .dch-hold { position: relative; flex: none; width: 84px; height: 84px; padding: 0; margin: 0; border: 0; background: none; cursor: pointer;
  touch-action: none; user-select: none; -webkit-user-select: none; -webkit-touch-callout: none; }
#ag-app .dch-hold .ag-timerring { position: absolute; inset: 0; width: 84px; height: 84px; }
#ag-app .dch-hold__btn { position: absolute; left: 7px; top: 7px; width: 70px; height: 70px; image-rendering: pixelated; }
#ag-app .dch-hold__txt { position: absolute; left: 0; right: 0; bottom: 14px; font: 700 .8rem var(--font-display); color: #1e1538; text-align: center; pointer-events: none; }
#ag-app .dch-hold:focus-visible { outline: 3px solid var(--vest); outline-offset: 2px; }
@container (max-width: 560px) {
  #ag-app .dch-card__top { gap: 6px; }
  #ag-app .dch-card__ask { font-size: .95rem; }
  #ag-app .dch-card .ag-choice { min-height: 44px; font-size: .9rem; }
}`;
  function injectCss() {
    if (!document.querySelector('style[data-ag-css="drop-cover-hold"]')) document.head.append(h('style', { 'data-ag-css': 'drop-cover-hold' }, CSS));
  }

  /** A canvas text panel (ink border, paper fill), centred on cx. */
  function panel(c, text, cx, y, o) {
    o = o || {};
    const size = o.size || 12;
    c.save();
    c.font = '700 ' + size + 'px "Pixelify Sans", monospace';
    const icon = o.icon ? AG.pixelIcon(o.icon, 18, true) : null;
    const tw = Math.ceil(c.measureText(text).width) + (icon ? 22 : 0), w = tw + 12, hh = size + 8;
    const x = Math.round(clamp(cx - w / 2, 2, W - w - 2));
    c.fillStyle = INK; c.fillRect(x - 1, y - 1, w + 2, hh + 2);
    c.fillStyle = o.bg || PAPER; c.fillRect(x, y, w, hh);
    if (icon) c.drawImage(icon, x + 5, Math.round(y + (hh - 18) / 2));
    c.restore();
    AG.gfx.text(c, text, x + 6 + (icon ? 22 : 0), y + 4, { size, bold: true, color: o.color || INK });
    return { x, y, w, h: hh };
  }

  class DropCoverHoldScene {
    /** o: { level (levels.json entry), rooms (data/rooms.json), plays } */
    constructor(stage, ctx, done, o) {
      injectCss();
      this.stage = stage; this.ctx = ctx; this.doneFn = done; this.o = o;
      this.diff = ctx.difficulty === 'advanced' ? 'advanced' : 'easy';
      this.li = clamp(ctx.level, 1, 5) - 1;
      this.seed = ((ctx.seed >>> 0) + (o.plays || 0) * 7919) >>> 0;
      this.rnd = LOGIC.rng(this.seed + 99);
      this.rounds = LOGIC.plan(o.level, o.rooms, { difficulty: this.diff, level: ctx.level, seed: this.seed }, T);
      this.hearts = T.hearts; this.results = []; this.idx = -1; this.over = false; this.clock = 0; this.t = 0;
      this.offs = []; this.debris = []; this.hinted = new Set(); this.clatterAt = 0; this.saidPerfect = false; this.saidMyth = false;
      this.rig = ctx.rig('side', { height: T.rigH });
      this.expert = new AG.CharacterRig(stage, ctx.expertId, 'side', { height: T.rigH });
      this.me = { x: 240, y: FEET, action: 'idle', facing: 'right', behind: false, pillow: false, hidden: false, tween: null };
      this.ex = null; // the role expert, while pointing or cheering
      this.build();
      this.bindInput();
      this.hud = ctx.hud({ hearts: T.hearts, score: 0, label: STR.round });
      this.updateHud();
      ctx.onPause(p => { if (p) this.view.cancelGesture(); else if (this.m) { this.m.regrab(); this.pump(); } });
      AG.sfx.preload(['rumble_loop', 'clatter', 'all_clear'].map(n => K + 'sfx.' + n));
      if (AG.debug.on) DCH.live = { scene: this }; // ?debug=1: scripted checks
      this.nextRound();
    }

    /* ---------- DOM ---------- */
    build() {
      const { ctx } = this;
      this.objLayer = new AG.scenetap.ObjectLayer({ items: [] });
      this.glow = new AG.scenetap.ObjectLayer({ items: [], outline: '#fff3a0' });
      this.view = new AG.scenetap.SceneView({
        scene: this.layers(this.rounds[0].roomData), w: W, h: H, zones: [], mode: 'none', zooms: [1],
        objects: this.objLayer, label: STR.scene, describe: z => pick(z.label),
        onPick: z => this.onPick(z), onFrame: dt => this.frame(dt),
        drawWorld: c => this.drawWorld(c), drawScreen: c => this.drawScreen(c)
      });
      this.viewBox = h('div', { class: 'dch-view' }, this.view.el);
      this.root = h('div', { class: 'dch' }, this.viewBox);
      this.stage.append(this.root);

      // the HOLD button: a 70 px pixel circle in a TimerRing, pressing the same HOLD action as Space
      this.ring = AG.kit.timerRing({ size: 84, segments: 28 });
      this.ring.set(0);
      this.holdCv = h('canvas', { class: 'ag-px dch-hold__btn', width: 70, height: 70, 'aria-hidden': 'true' });
      this.holdBtn = h('button', { type: 'button', class: 'dch-hold', tabindex: '-1', 'aria-label': pick(STR.holdBtn), 'aria-pressed': 'false' },
        this.ring.el, this.holdCv, h('span', { class: 'dch-hold__txt' }, pick(STR.holdTxt)));
      this.hint = h('div', { class: 'ag-hint dch-hint', hidden: true });
      this.ctl = h('div', { class: 'dch-ctl' }, this.hint, this.holdBtn);
      ctx.controls.append(this.ctl);
      AG.assets.loadImage(K + 'ui.hold_button').then(() => this.drawHoldBtn(true));
    }
    layers(room) { return [{ src: room.bg }, { draw: c => this.drawActors(c, true) }]; }
    drawHoldBtn(force) {
      const down = AG.input.isDown('HOLD');
      if (!force && down === this.btnDown) return;
      this.btnDown = down;
      const c = this.holdCv.getContext('2d');
      c.imageSmoothingEnabled = false; c.clearRect(0, 0, 70, 70);
      AG.assets.draw(c, K + 'ui.hold_button', 0, 0, 70, 70, down ? 1 : 0);
      this.holdBtn.setAttribute('aria-pressed', String(down));
    }

    bindInput() {
      const I = AG.input, on = (a, fn) => this.offs.push(I.on(a, fn));
      I.register('CONFIRM', { keys: ['Enter', 'NumpadEnter'] }); // Space is HOLD in this game
      I.register('HOLD', { keys: ['Space'], button: STR.holdTxt });
      on('HOLD', e => {
        if (!this.m || this.over) return;
        if (e.phase === 'down') this.m.holdDown(); else if (e.phase === 'up') this.m.holdUp();
        this.drawHoldBtn(); this.pump();
      });
      for (const [a, d] of [['UP', -1], ['DOWN', 1]]) on(a, e => { if (e.phase === 'down' && this.card) this.card.step(d); });
      const b = this.holdBtn, dev = e => (e.pointerType === 'mouse' ? 'mouse' : 'touch');
      const down = e => {
        if (e.button > 0) return;
        e.preventDefault(); // keeps the focus (and so Space) on the stage
        try { b.setPointerCapture(e.pointerId); } catch (_) { /* synthetic events */ }
        this.btnPtr = e.pointerId; I.press('HOLD', dev(e), e);
      };
      const up = e => { if (this.btnPtr == null || e.pointerId !== this.btnPtr) return; this.btnPtr = null; I.release('HOLD', dev(e), e); };
      b.addEventListener('pointerdown', down);
      ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(t => b.addEventListener(t, up));
      b.addEventListener('contextmenu', e => e.preventDefault());
    }

    /* ---------- rounds ---------- */
    nextRound() {
      if (this.over) return;
      this.idx++;
      if (this.idx >= this.rounds.length || this.hearts <= 0) return this.end();
      const r = this.round = this.rounds[this.idx], room = r.roomData;
      this.view.setScene(this.layers(room), { w: W, h: H });
      this.view.setZones([]); this.view.setMode('none'); this.view.clearMarks();
      this.objLayer.items = room.objects.map(ob => this.objLayer.norm({ id: ob.id, zone: ob.id, art: K + 'obj.' + ob.obj, x: ob.x, y: ob.y, w: ob.w, h: ob.h }));
      this.glow.items = r.glow ? r.spots.filter(s => s.kind === 'safe').map(s => this.glow.norm({ id: s.id, art: K + 'obj.' + s.obj, x: s.x, y: s.y, w: s.w, h: s.h, highlight: true })) : [];
      this.debris = []; this.ex = null; this.npcFrame = 0; this.walkTo = null; this.flash = null;
      const bed = r.special === 'bed' && r.spots.find(s => s.pose === 'bed');
      if (bed) Object.assign(this.me, this.coverPos(bed), { action: 'duck_cover', facing: 'left', behind: false, pillow: false, hidden: false, tween: null, asleep: true });
      else Object.assign(this.me, { x: room.start, y: FEET, action: 'idle', facing: room.start > W / 2 ? 'left' : 'right', behind: false, pillow: false, hidden: false, tween: null, asleep: false });
      this.m = new LOGIC.RoundMachine(r, T).start();
      if (AG.input.isDown('HOLD')) this.m.holding = true; // still down from the last round: no new press edge will come
      this.updateHud();
      this.pump();
    }

    /** Where the player takes cover at a spot (scene px; y = the feet line). */
    coverPos(s) {
      if (s.pose === 'bed') return { x: s.x + 44, y: s.y + 17, behind: false };
      if (s.pose === 'cover_head') return { x: s.x + Math.round(s.w / 2), y: s.y + s.h - 4, behind: false };
      return { x: s.x + Math.round(s.w / 2), y: s.y + s.h, behind: true }; // under the desk / table: drawn behind its top
    }
    moveTo(x, y, ms, then) {
      const me = this.me;
      me.tween = { x0: me.x, y0: me.y, x1: x, y1: y, ms, t: 0, then };
      if (Math.abs(x - me.x) > 1) me.facing = x < me.x ? 'left' : 'right';
      me.action = 'walk';
    }

    /** Runs the machine's events now (inputs call this too, so nothing waits for the next frame). */
    pump() {
      if (!this.m) return;
      for (const e of this.m.drain()) this.on(e);
    }
    on(e) {
      const ctx = this.ctx, r = this.round, me = this.me;
      switch (e.type) {
        case 'phase': return this.enter(e.phase);
        case 'shake': if (this.rumble) this.rumble.volume(0.9); return;
        case 'spot':
          if (!e.ok) { const z = this.view.zones.get(e.spot.id); if (z) this.view.mark(z, 'miss', T.pointMs); }
          else if (e.spot.kind === 'safe' && r.mythPresent && !this.saidMyth) { this.saidMyth = true; ctx.say('info', STR.myth); }
          return;
        case 'fail':
          this.loseHeart();
          me.asleep = false; me.pillow = false;
          if (e.kind === 'letgo') {
            me.behind = false; me.y = FEET; me.action = 'oops';
            ctx.say('retry', STR.letgo);
          } else {
            me.action = 'oops';
            ctx.say('warning', e.kind === 'wrong' ? e.spot.feedback : STR.timeout);
            this.pointAt(r.cover);
          }
          return;
        case 'stop': AG.sfx.play(K + 'sfx.all_clear'); return;
        case 'release': {
          if (!this.m.quaking) { me.behind = false; me.pillow = false; me.asleep = false; me.action = 'idle'; me.y = FEET; } // else: still under cover for the aftershock
          this.flash = { text: e.grade === 'perfect' ? STR.perfect : e.grade === 'good' ? STR.good : STR.late, until: this.t + 0.9 };
          if (e.grade === 'perfect' && !this.saidPerfect) { this.saidPerfect = true; ctx.say('success', STR.perfectRelease); }
          return;
        }
        case 'aftershock':
          this.rumble = this.rumble || AG.sfx.loop(K + 'sfx.rumble_loop', { volume: 0.7 });
          this.view.enabled = false;
          this.showHint('aftershock');
          if (e.holding) this.dropInPlace();
          return;
        case 'rehold': this.dropInPlace(); return;
        case 'aftershockMiss':
          this.loseHeart();
          ctx.say('retry', STR.afterMiss);
          this.dropInPlace();
          return;
        case 'aftershockEnd':
          if (e.ok) ctx.say('success', STR.afterOk);
          if (!me.tween) Object.assign(me, { action: 'idle', behind: false, pillow: false, y: FEET });
          if (this.m.phase === 'exit' && !this.m.r.exitTried) this.view.enabled = true;
          return;
        case 'exit': {
          const safe = r.exits.find(x => x.kind === 'safe');
          if (e.ok) ctx.say('success', e.exit.why);
          else if (e.timeout) ctx.say('info', fmt(STR.exitLate, { label: pick(safe.label).toLowerCase() }));
          else ctx.say('info', e.exit.why);
          this.walkTo = safe; this.view.enabled = false; this.view.setMode('none');
          return;
        }
        case 'card': return;
      }
    }
    enter(phase) {
      const r = this.round, me = this.me, view = this.view, ctx = this.ctx;
      this.showHint(phase);
      view.enabled = phase === 'choose' || phase === 'exit';
      switch (phase) {
        case 'calm': break;
        case 'warning':
          me.asleep = false; me.action = 'alert';
          this.rumble = AG.sfx.loop(K + 'sfx.rumble_loop', { volume: 0.35 });
          break;
        case 'choose':
          view.setZones(r.spots.map(s => ({ id: s.id, rect: s.zone, label: NAMES[s.obj] || S(s.obj), data: s })));
          view.setMode('cycle');
          if (this.diff === 'easy' && AG.input.lastDevice === 'keyboard') view.highlight(0, { via: 'key' });
          break;
        case 'card': this.openCard(); break;
        case 'move': {
          view.setMode('none');
          const s = this.m.spot, p = this.coverPos(s);
          if (Math.abs(p.x - me.x) <= 1 && Math.abs(p.y - me.y) <= 1) me.action = 'duck_cover';
          else this.moveTo(p.x, p.y, T.moveMs);
          break;
        }
        case 'hold': {
          const s = this.m.spot, p = this.coverPos(s);
          me.tween = null; Object.assign(me, { x: p.x, y: p.y, behind: p.behind, pillow: s.pose === 'bed', facing: s.pose === 'bed' ? 'left' : me.facing });
          me.action = s.pose === 'cover_head' ? 'cover_head' : 'hold_on';
          if (r.special === 'wheelchair') { this.npcFrame = 1; ctx.after(500, () => { if (this.round === r) this.npcFrame = 2; }); }
          break;
        }
        case 'exit':
          view.setZones(r.exits.map(x => ({ id: 'x:' + x.id, rect: x.zone, label: x.label, data: x })));
          view.setMode('cycle');
          if (this.diff === 'easy' && AG.input.lastDevice === 'keyboard') view.highlight(0, { via: 'key' });
          view.enabled = !this.m.quaking;
          break;
        case 'walk': {
          const ex = this.walkTo || r.exits.find(x => x.kind === 'safe');
          me.behind = false; me.pillow = false;
          this.moveTo(clamp(Math.round((ex.zone[0] + ex.zone[2] / 2) * W), 12, W - 12), FEET, T.walkMs - 150, () => { me.hidden = true; });
          break;
        }
        case 'toast': this.toast(); break;
        case 'done': this.nextRound(); break;
      }
      if (phase === 'point' || phase === 'toast' || phase === 'done') this.stopRumble(phase === 'done');
      this.stage.dataset.phase = phase;
    }

    /** The player drops where they stand (an aftershock away from cover). */
    dropInPlace() {
      const me = this.me;
      me.tween = null; me.action = this.round.roomData.outdoor ? 'cover_head' : 'duck_cover';
    }
    pointAt(spot) {
      if (!spot) return;
      const p = this.coverPos(spot), side = p.x > W / 2 ? -1 : 1;
      this.ex = { x: clamp(p.x + side * (spot.w / 2 + 16), 14, W - 14), y: FEET, action: 'point', facing: side < 0 ? 'right' : 'left', spot, until: this.t + T.pointMs / 1000 };
    }
    loseHeart() {
      this.hearts = Math.max(0, this.hearts - 1);
      AG.sfx.play('soft');
      this.updateHud();
    }
    stopRumble(now) {
      if (!this.rumble) return;
      if (now || !this.m || !this.m.shaking) { this.rumble.stop(); this.rumble = null; }
    }
    toast() {
      this.ex = null;
      this.results.push(this.m.r);
      const run = SC.run(this.results), last = run.rounds[run.rounds.length - 1], r = this.m.r;
      const ok = r.spotOk && !r.fail;
      if (SC.perfect(r)) this.me.action = 'happy';
      const sub = ok ? fmt(STR.tPts, { n: last.points }) + (last.mult > 1 ? ' · ' + fmt(STR.tStreak, { m: last.mult }) : '') : '❤ ' + this.hearts + ' / ' + T.hearts;
      AG.kit.banner(this.stage, SC.perfect(r) ? STR.tPerfect : ok ? STR.tSafe : STR.tNext, sub, T.toastMs - 100);
      this.score = run.total; this.streak = last.streak;
      this.updateHud();
    }
    updateHud() {
      this.hud.set({ hearts: this.hearts, score: this.score || 0, label: Math.min(this.idx + 1, this.rounds.length) + '/' + this.rounds.length });
    }
    /** The PromptIcon hint, shown the first time each phase (or the aftershock) comes up in this level. */
    showHint(key) {
      const spec = HINTS[key];
      if (!spec || this.hinted.has(key)) { this.hint.hidden = true; return; }
      this.hinted.add(key);
      this.hint.replaceChildren(AG.input.promptIcon({ keys: spec.keys, gesture: spec.gesture }), h('span', {}, pick(spec.text)));
      this.hint.hidden = false;
    }

    /* ---------- picks (taps, clicks, ←/→ + Enter, 1–9: all through the SceneView) ---------- */
    onPick(z) {
      if (!this.m) return;
      if (this.m.phase === 'choose') this.m.choose(z.data);
      else if (this.m.phase === 'exit') this.m.pickExit(z.data);
      this.pump();
    }

    /* ---------- the wheelchair card ---------- */
    openCard() {
      const ctx = this.ctx, m = this.m;
      const opts = LOGIC.shuffle(CARD, LOGIC.rng(this.seed + this.idx * 31));
      const npc = h('canvas', { class: 'ag-px', width: 46, height: 48, style: { width: '92px', height: '96px' }, 'aria-hidden': 'true' });
      AG.assets.loadImage(K + 'npc.wheelchair').then(() => { const c = npc.getContext('2d'); c.imageSmoothingEnabled = false; AG.assets.draw(c, K + 'npc.wheelchair', 0, 0, 46, 48, 0); });
      const kit = AG.kit.choices(opts.map(o => ({ text: o.text })), (o, i) => {
        const opt = opts[i];
        if (!opt.ok) { kit.mark(i, false); AG.sfx.play('soft'); ctx.say('info', opt.why); m.answerCard(false); card.focus(0); this.pump(); return; }
        kit.mark(i, true); kit.lock();
        ctx.say('success', opt.why);
        m.answerCard(true);
        this.closeCard();
        this.pump();
      }, { label: STR.cardAsk });
      const el = h('div', { class: 'dch-card' }, h('section', { class: 'dch-card__panel', role: 'dialog', 'aria-label': pick(STR.cardAsk) },
        h('span', { class: 'ag-eyebrow' }, pick(STR.cardEyebrow)),
        h('div', { class: 'dch-card__top' }, npc, h('h3', { class: 'dch-card__ask' }, pick(STR.cardAsk))), kit.el));
      const live = () => kit.btns.filter(b => !b.disabled);
      const card = this.card = {
        el, kit,
        focus(i) { const l = live(); if (l.length) l[clamp(i, 0, l.length - 1)].focus({ preventScroll: true }); },
        step(d) { const l = live(), cur = l.indexOf(document.activeElement); card.focus(cur < 0 ? (d > 0 ? 0 : l.length - 1) : (cur + d + l.length) % l.length); AG.sfx.play('tap'); }
      };
      this.viewBox.append(el);
      this.view.enabled = false;
      ctx.after(60, () => { if (this.card === card) card.focus(0); });
    }
    closeCard() {
      if (!this.card) return;
      this.card.kit.destroy(); this.card.el.remove(); this.card = null;
      this.stage.focus({ preventScroll: true });
    }

    /* ---------- the frame ---------- */
    frame(dt) {
      if (this.over || !this.m) return;
      this.t += dt; this.clock += dt * 1000;
      this.m.update(dt * 1000);
      this.pump();
      const me = this.me;
      if (me.tween) {
        const tw = me.tween; tw.t += dt * 1000;
        const k = clamp(tw.t / tw.ms, 0, 1);
        me.x = Math.round(tw.x0 + (tw.x1 - tw.x0) * k); me.y = Math.round(tw.y0 + (tw.y1 - tw.y0) * k);
        if (k >= 1) { me.tween = null; me.action = 'idle'; if (tw.then) tw.then(); }
      }
      if (this.ex && this.ex.until < this.t) this.ex = null;
      this.updateDebris(dt);
      this.updateShake();
      this.drawHoldBtn();
      const left = this.m.windowLeft(), holdOn = this.m.holding && (this.m.phase === 'hold' || this.m.quaking);
      this.ring.set(this.m.quaking && left != null ? left : holdOn ? 1 : 0);
      if (this.rumble && !this.m.shaking && this.m.phase !== 'warning') this.stopRumble();
    }
    /** Whole-pixel shake of the view (none with Reduce Motion: the meter and the caption show it instead). */
    updateShake() {
      const lv = this.m.shakeLevel(), cv = this.view.cv;
      if (!lv || AG.reducedMotion()) { if (cv.style.transform) cv.style.transform = ''; return; }
      const px = Math.max(1, Math.round(T.shakePx[this.li] * lv)), tick = Math.floor(this.t * 24);
      const s = cv.clientWidth / W;
      const dx = (tick % 2 ? px : -px) * s, dy = (tick % 3 === 0 ? 1 : 0) * s;
      cv.style.transform = 'translate(' + Math.round(dx) + 'px,' + Math.round(dy) + 'px)';
    }

    /* ---------- debris: falls while it shakes, bounces off the cover, never lands on an uncovered player ---------- */
    coverRect() {
      const s = this.m.spot, ph = this.m.phase;
      if (!s || !(ph === 'hold' || ph === 'release') || s.pose === 'cover_head') return null;
      if (s.pose === 'bed') return { x0: this.me.x - 12, x1: this.me.x + 12, top: this.me.y - T.hitbox.h - 4, id: null };
      return { x0: s.x + 2, x1: s.x + s.w - 2, top: s.y, id: s.id };
    }
    updateDebris(dt) {
      const room = this.round.roomData, lv = this.m.shakeLevel(), D = T.debris;
      if (lv > 0.3 && room.debris.length && this.debris.length < D.max && this.rnd() < D.perSec * lv * dt * (AG.reducedMotion() ? 0.5 : 1)) this.spawnDebris(room);
      const cov = this.coverRect();
      for (const d of this.debris) {
        if (d.rest > 0) { d.rest += dt; continue; }
        d.vy += D.gravity * dt; d.y += d.vy * dt;
        const onCover = cov && d.x >= cov.x0 && d.x <= cov.x1;
        const land = onCover ? cov.top : d.floor;
        if (d.vy > 0 && d.y >= land && d.y - d.vy * dt <= land + 2) {
          d.y = land;
          if (d.bounces < 2 && d.vy > 80) {
            d.vy = -d.vy * 0.35; d.bounces++;
            if (onCover && cov.id) this.objLayer.shake(cov.id, 120, 1);
            if (this.t - this.clatterAt > 0.25) { this.clatterAt = this.t; AG.sfx.play(K + 'sfx.clatter'); }
          } else { d.vy = 0; d.rest = 0.001; }
        } else if (!onCover && d.y > d.floor) { d.y = d.floor; d.vy = 0; d.rest = 0.001; }
      }
      this.debris = this.debris.filter(d => d.rest < 1.2);
    }
    spawnDebris(room) {
      const kind = room.debris[Math.floor(this.rnd() * room.debris.length)];
      const lights = room.objects.filter(o => o.obj === 'light'), cov = this.coverRect(), me = this.me;
      let x;
      if (kind === 'light' && lights.length) { const L = lights[Math.floor(this.rnd() * lights.length)]; x = L.x + L.w / 2; }
      else if (cov && this.rnd() < 0.45) x = cov.x0 + 4 + this.rnd() * Math.max(1, cov.x1 - cov.x0 - 8);
      else x = 16 + this.rnd() * (W - 32);
      const covered = cov && x >= cov.x0 && x <= cov.x1;
      if (!covered && Math.abs(x - me.x) < T.hitbox.w / 2 + 10) return; // never onto an uncovered player
      this.debris.push({ kind, x: Math.round(x), y: -4, vy: 30, bounces: 0, rest: 0, floor: 194 + Math.floor(this.rnd() * 24) });
    }

    /* ---------- drawing ---------- */
    drawActors(c, behindPass) {
      const me = this.me;
      if (!me.hidden && me.behind === behindPass) {
        this.rig.play(me.action); this.rig.setFacing(me.facing);
        this.rig.draw(c, me.x, me.y, this.t);
        if (me.pillow) AG.assets.draw(c, K + 'debris.pillow', me.x - 13, me.y - T.hitbox.h - 4, 22, 10);
        if (me.asleep) AG.gfx.text(c, 'z', me.x + 8, me.y - 34 - (Math.floor(this.t * 2) % 2) * 3, { size: 10, bold: true, color: PAPER, outline: INK });
      }
      if (behindPass) return;
      if (this.round.special === 'wheelchair') AG.assets.draw(c, K + 'npc.wheelchair', 150, FEET - 48, 46, 48, this.npcFrame);
      if (this.ex) {
        this.expert.play(this.ex.action); this.expert.setFacing(this.ex.facing);
        this.expert.draw(c, this.ex.x, this.ex.y, this.t);
      }
    }
    drawWorld(c) {
      const r = this.round, ph = this.m && this.m.phase;
      if (!r) return;
      if (r.special === 'bed') { c.fillStyle = 'rgba(20, 16, 60, 0.38)'; c.fillRect(0, 0, W, H); }
      if (ph === 'choose' && this.glow.items.length) {
        this.glow.items.forEach(it => { it.hidden = it.id === this.view.hiId; });
        this.glow.draw(c, this.t, this.view, null);
      }
      if (ph === 'exit' || ph === 'settle') this.drawExitSigns(c);
      this.drawActors(c, false);
      for (const d of this.debris) {
        const rec = AG.assets.image(K + 'debris.' + d.kind), w = rec.frameW || 12, hh = rec.h || 10;
        AG.assets.draw(c, K + 'debris.' + d.kind, Math.round(d.x - w / 2), Math.round(d.y - hh), w, hh);
      }
      if (this.ex && this.ex.spot) { // the expert's arrow over the right spot
        const s = this.ex.spot, x = Math.round(s.x + s.w / 2), y = Math.max(14, s.y - 6 - (Math.floor(this.t * 4) % 2) * 2);
        c.fillStyle = INK; c.fillRect(x - 6, y - 11, 13, 7); c.fillRect(x - 4, y - 4, 9, 2); c.fillRect(x - 2, y - 2, 5, 2);
        c.fillStyle = VEST; c.fillRect(x - 5, y - 10, 11, 5); c.fillRect(x - 3, y - 5, 7, 2); c.fillRect(x - 1, y - 3, 3, 1);
      }
    }
    drawExitSigns(c) {
      for (const x of this.round.exits) {
        const cx = (x.zone[0] + x.zone[2] / 2) * W, cy = (x.zone[1] + x.zone[3] / 2) * H;
        panel(c, '➜ ' + pick(x.tag), cx, Math.round(clamp(cy - 9, 2, H - 22)), { size: 10, bg: '#dff1ff' });
      }
    }
    drawScreen(c) {
      const m = this.m; if (!m) return;
      // the shake meter, top centre: lit segments follow the shaking (and say it with Reduce Motion)
      const lv = m.shakeLevel(), lit = Math.ceil(lv * 5 - 0.001);
      AG.assets.draw(c, K + 'ui.shake_meter', 190, 3, 100, 14);
      c.fillStyle = 'rgba(30, 21, 56, 0.72)';
      for (let i = lit; i < 5; i++) c.fillRect(194 + i * 19, 7, 16, 6);
      // streak, top right
      const mult = SC.mult(this.streak || 0);
      if (mult > 1) panel(c, '×' + mult, W - 24, 3, { size: 10, bg: '#fff4cc' });
      // the caption for this phase (sounds always get a caption too)
      const cap = this.caption();
      if (cap) panel(c, pick(cap.text), W / 2, H - 26, { size: 12, icon: cap.icon, bg: cap.bg });
      const left = m.windowLeft();
      if (left != null) {
        const w = 120, x = W / 2 - w / 2, y = H - 6;
        c.fillStyle = INK; c.fillRect(x - 1, y - 1, w + 2, 5);
        c.fillStyle = left < 0.3 ? '#e0245e' : left < 0.6 ? VEST : '#2f8a4a'; c.fillRect(x, y, Math.round(w * clamp(left, 0, 1)), 3);
      }
      if (this.flash && this.flash.until > this.t) panel(c, pick(this.flash.text), this.me.x, Math.max(20, this.me.y - 62), { size: 10, bg: '#dff7e3' });
    }
    caption() {
      const m = this.m, ph = m.phase, rm = AG.reducedMotion();
      if (m.quaking) return { text: STR.after, icon: '⚠️', bg: '#ffe4ea' };
      switch (ph) {
        case 'calm': return { text: STR.ready };
        case 'warning': return { text: STR.rumble, icon: '🔊' };
        case 'choose': return { text: rm ? S(pick(STR.shaking) + ' ' + pick(STR.choose)) : STR.choose, bg: '#fff4cc' };
        case 'card': return { text: STR.card, bg: '#fff4cc' };
        case 'move': return { text: STR.drop };
        case 'hold': return { text: m.holding ? (rm ? STR.shaking : STR.hold) : STR.holdNow, bg: m.holding ? '#dff7e3' : '#fff4cc' };
        case 'release': return { text: STR.stopped, icon: '✅', bg: '#dff7e3' };
        case 'exit': return m.r.exitTried ? { text: STR.walk } : { text: STR.exit, bg: '#fff4cc' };
        case 'walk': return { text: STR.walk };
      }
      return null;
    }

    /* ---------- the end ---------- */
    end() {
      if (this.over) return;
      const completed = this.hearts > 0 && this.results.length === this.rounds.length;
      const perfectRun = completed && this.hearts === T.hearts && this.results.every(SC.perfect);
      this.stopRumble(true);
      if (!perfectRun) return this.finish(completed);
      // a perfect run: the player and the role expert cheer (the last machine stays, 'done')
      Object.assign(this.me, { x: W / 2 - 24, y: FEET, action: 'cheer', facing: 'right', hidden: false, behind: false, pillow: false, tween: null });
      this.ex = { x: W / 2 + 24, y: FEET, action: 'cheer', facing: 'left', until: Infinity };
      AG.kit.celebrate(this.stage);
      this.ctx.after(1400, () => this.finish(true));
    }
    finish(completed) {
      if (this.over) return;
      this.over = true;
      const res = this.results, run = SC.run(res);
      const max = SC.max(this.rounds.map(r => (r.special === 'wheelchair' ? T.cardMs : r.chooseMs)));
      const heartsLost = T.hearts - this.hearts;
      const stars = SC.stars({ completed, base: run.base, maxBase: max.base, heartsLost });
      let events = [];
      AG.store.update('stats', s => { events = SC.badges(s.dropCoverHold = s.dropCoverHold || {}, { results: res, level: this.ctx.level, completed, heartsLost }); });
      const reacts = res.filter(r => r.spotOk).map(r => r.chooseMs);
      this.doneFn({
        won: completed, stars, score: run.total, timeMs: Math.round(this.clock), heartsLeft: this.hearts,
        collectibles: SC.collectibles(res, completed),
        detail: [
          { label: STR.dSpots, value: res.filter(r => r.spotOk).length + ' / ' + this.rounds.length, icon: '🛡️' },
          { label: STR.dReleases, value: String(res.filter(r => r.release === 'perfect').length), icon: '✋' },
          { label: STR.dExits, value: res.filter(r => r.exitOk).length + ' / ' + res.filter(r => r.exitTried).length, icon: '🚪' },
          { label: STR.dReact, value: reacts.length ? (Math.min(...reacts) / 1000).toFixed(2) + ' s' : '–', icon: '⚡' },
          { label: STR.dHearts, value: this.hearts + ' / ' + T.hearts, icon: 'heart' }
        ],
        message: pick(!completed ? STR.msg0 : stars >= 3 ? STR.msg3 : stars === 2 ? STR.msg2 : STR.msg1),
        badgeEvents: events, delay: 400
      });
    }

    destroy() {
      this.over = true;
      this.stopRumble(true);
      this.closeCard();
      this.offs.forEach(f => f()); this.offs = [];
      this.view.destroy();
      this.ctl.remove();
      if (DCH.live && DCH.live.scene === this) DCH.live = null;
    }
  }

  Object.assign(DCH, { STR, DropCoverHoldScene });
})(window.AG);
