/* Ashfall: one level on a 480 × 270 canvas. The rules are AG.ashfall.Run (AshfallRun.js) on the E4 FallingField; this
 * file draws them (volcano stage and plume by Alert Level, the lahar lane, ash darkness in L3, the evacuation bus in L5),
 * reads the controls through the engine's BottomMover, shows the HUD (hearts, score, Alert Level badge, wave order with
 * ticks, combo, power-ups, evacuation timer) and tells the player what happened through the word boxes. */
window.AG = window.AG || {};
(function (AG) {
  const { h, clamp } = AG.util;
  const A = AG.ashfall, T = A.tuning;
  const K = 'ashfall.';
  const W = 480, H = 270, INK = '#1e1538', GOLD = '#ffd23f';
  const S = en => ({ en });
  const pick = v => AG.pick(v);

  const STR = {
    alert: S('Alert Level'), alertText: S('Alert Level {n}'), order: S('ORDER'),
    maskOn: S('Mask on! It keeps ash out of your nose and mouth.'),
    gogglesOn: S('Goggles on! They keep ash out of your eyes.'),
    coconut: S("That's a coconut, not a rock! Rocks show a shadow first."),
    hat: S('Hard hat on! It blocks one hit.'), slowmo: S('Slow-mo! Everything falls slower for a few seconds.'), magnet: S('Magnet! Good things drift toward you.'),
    blocked: S('Your hard hat blocked it!'),
    photo: S('A family photo! Keep important papers and photos in your go-bag.'),
    hitRock: S('Rocks show a shadow first. Step away from it!'), hitAsh: S('Ash and embers hurt. Keep dodging!'),
    hitLahar: S('Get off the riverbank as soon as the siren sounds!'),
    river: S('Stay away from rivers near a volcano!'), riverBanner: S('LAHAR WARNING'), riverSub: S('Move away from the river!'),
    evac: S('EVACUATE NOW!'), evacSub: S('Run to the bus!'), evacSay: S('Go! When you are told to evacuate, leave right away.'),
    late: S('Too slow! The bus waits a little longer. Hurry!'),
    combo: S('COMBO ×{n}!'), orderDone: S('ORDER +{n}!'), wave: S('Wave cleared +{n}'), blockedPop: S('BLOCKED'),
    capRumble: S('(the volcano rumbles)'), capSiren: S('(siren!)'), capHorn: S('(bus horn!)'), capLahar: S('(lahar flowing)'),
    hint: S('Dodge the shadows. Catch masks and goggles.'),
    dMasks: S('Masks'), dOrders: S('Orders'), dCombo: S('Best combo'), dHearts: S('Hearts left'), dSecs: S('Seconds left'),
    msg3: S('Mask on, goggles on, and out on time! You handled every alert level.'),
    msg2: S('Great job! For 3 stars: finish every wave order and push your score higher.'),
    msg1: S('You made it! Play again to catch more masks and goggles.'),
    msg0: S('Good try! Mask and goggles on, dodge the shadows, and go the moment you are told to evacuate.')
  };
  const ALERT_SAY = [
    S('Alert Level 1: the volcano is restless. Stay ready!'),
    S('Alert Level 2: more ash is coming. Mask and goggles on!'),
    S('Alert Level 3: the volcano is very active. Stay away from rivers!'),
    S('Alert Level 4: an eruption could come soon. Be ready to evacuate!'),
    S('Alert Level 5: a big eruption! Evacuate the moment you are told.')
  ];
  const fmt = (t, vars) => pick(t).replace(/\{(\w+)\}/g, (_, k) => (vars[k] == null ? '' : vars[k]));
  const PLUME = [0.5, 0.75, 1, 1.5, 2]; // the plume's scale at Alert Levels 1–5

  const CSS = `
#ag-app .af { display: grid; gap: 8px; justify-items: center; width: 100%; }
#ag-app .af-tools { display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; align-items: center; min-height: 44px; }
#ag-app .af-hint { font-size: .85rem; color: var(--muted); font-weight: 700; }`;
  function injectCss() {
    if (!document.querySelector('style[data-ag-css="ashfall"]')) document.head.append(h('style', { 'data-ag-css': 'ashfall' }, CSS));
  }

  /** An AG.icons name or an emoji, at 18 px (x, y = top-left). */
  function icon(c, name, x, y) {
    if (AG.icons.has(name)) AG.gfx.drawIcon(c, name, x, y, 1);
    else c.drawImage(AG.pixelIcon(name, 18, true), Math.round(x), Math.round(y));
  }
  const POWER_ICON = { shield: 'hard_hat', slowmo: '🐢', magnet: '🧲' };
  /** Canvas text with a crisp 1 px ink outline (the engine's stroke is 2 px wide and fills small glyphs in). */
  function label(c, str, x, y, o) {
    o = Object.assign({ size: 12, color: '#fff' }, o);
    if (o.outline !== null) for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, 1], [-1, 1], [1, -1]]) AG.gfx.text(c, str, x + dx, y + dy, Object.assign({}, o, { color: INK, outline: null }));
    AG.gfx.text(c, str, x, y, Object.assign({}, o, { outline: null }));
  }

  class AshfallScene {
    constructor(stage, ctx, done) {
      injectCss();
      this.stage = stage; this.ctx = ctx; this.doneFn = done;
      this.lv = ctx.levelData; this.diff = ctx.difficulty === 'advanced' ? 'advanced' : 'easy';
      this.t = 0; this.pops = []; this.said = new Set(); this.offs = []; this.caption = null; this.flash = 0; this.lastAlert = 0;
      this.ex = null; this.busT = 0; this.finished = false; this.dead = false; this.lastHud = {};
      this.reduce = AG.reducedMotion();

      this.view = AG.gfx.canvas(W, H);
      this.rig = ctx.rig('side', { height: T.rigH });
      this.expert = new AG.CharacterRig(stage, ctx.expertId, 'side', { height: T.rigH });
      const start = this.lv.laharSide === 'left' ? 280 : 240;
      this.mover = new AG.falling.BottomMover({
        rig: this.rig, view: this.view, x: start, groundY: T.groundY, minX: T.minX, maxX: T.maxX, maxSpeed: T.maxSpeed[this.diff],
        touch: AG.store.setting('ashfallHalves') ? 'halves' : 'follow', actions: { idle: 'idle', move: 'run' }
      });
      this.run = new A.Run({ level: this.lv, difficulty: this.diff, seed: ctx.seed, mover: this.mover, on: this.events() });
      this.dark = this.lv.darkness ? new AG.grid.Darkness({ w: W, h: H, color: T.dark.color, alpha: 0, rings: 3, ringWidth: 4 }) : null;

      const move = AG.input.promptIcon({ keys: ['key_left', 'key_right'], gesture: 'gesture_drag' });
      this.el = h('div', { class: 'af' }, this.view.cv, h('div', { class: 'af-tools' }, move, h('span', { class: 'af-hint' }, pick(STR.hint))));
      stage.append(this.el);
      this.pad = AG.input.touchControls(ctx.controls, { dpad: true });
      this.hud = ctx.hud({ hearts: this.run.maxHearts, score: 0, label: STR.alert, timer: !!this.lv.evac });
      this.hud.set({ hearts: this.run.hearts, score: 0, label: S(String(this.run.alert)), timer: this.lv.evac ? '–' : undefined });
      this.offs.push(AG.on('ag:settings', () => this.mover.setTouchMode(AG.store.setting('ashfallHalves') ? 'halves' : 'follow')));
      ctx.onPause(p => { if (this.laharLoop) this.laharLoop.volume(p ? 0 : 0.6); });
      AG.sfx.preload(['rumble', 'siren', 'horn', 'catch', 'hit', 'lahar_loop'].map(n => K + 'sfx.' + n));
      this.rumble = AG.sfx.loop(K + 'sfx.rumble', { volume: 0.25 });
      if (AG.debug.on) A.live = { scene: this, run: this.run };
      this.stop = AG.gfx.loop(dt => this.frame(dt));
    }

    /* ---------- what happens in the run ---------- */
    say(key, type, text, o) { if (key && this.said.has(key)) return; if (key) this.said.add(key); this.ctx.say(type, text, o); }
    pop(text, x, y, color) { this.pops.push({ text: pick(text), x: clamp(Math.round(x), 30, W - 30), y: Math.round(y), t: 0, color: color || '#fff' }); }
    cap(text) { this.caption = { text: pick(text), until: this.t + 2 }; }
    events() {
      const ctx = this.ctx, ex = ctx.expertId;
      return {
        wave: (w, i) => {
          const order = this.run.field.director.order;
          AG.kit.banner(this.stage, w.label, order ? order.label : null, 1600);
          this.hud.set({ label: S(String(w.alert)) });
          if (w.alert > this.lastAlert) {
            this.lastAlert = w.alert;
            ctx.say('warning', ALERT_SAY[w.alert - 1], { pose: AG.rig.resolve(ex, 'alert').frame });
            if (i) { AG.sfx.play(K + 'sfx.rumble', { volume: 0.8 }); this.cap(STR.capRumble); }
          }
        },
        waveClear: (i, pts) => { this.pop(fmt(STR.wave, { n: pts }), W / 2, 96, GOLD); this.hud.set({ score: this.run.score }); },
        catch: (ob, r) => {
          AG.sfx.play(K + 'sfx.catch', { volume: 0.7 });
          this.pop('+' + r.points, ob.x, ob.y - 10, r.mult > 1 ? GOLD : '#fff');
          if (r.stepped) { this.pop(fmt(STR.combo, { n: r.mult }), this.mover.x, this.mover.groundY - 52, GOLD); this.flash = this.t + 0.4; }
          if (ob.id === 'goggles') this.say('goggles', 'success', STR.gogglesOn);
          if (ob.id === 'coconut') this.say('coconut', 'success', STR.coconut);
          this.hud.set({ score: this.run.score });
        },
        maskOn: () => {
          this.rig.setGear('mask'); // heroes get the mask badge; AGILA shows prop_on_face_mask while idle
          if (this.rig.agila) this.mover.actions.idle = 'mask_on';
          this.say('mask', 'success', STR.maskOn);
        },
        hit: (src, kind) => {
          AG.sfx.play(K + 'sfx.hit');
          this.mover.pose('oops', T.oopsMs);
          if (!this.reduce) AG.kit.shake(this.view.cv);
          this.say('hit:' + (kind === 'rock' ? 'rock' : kind === 'lahar' ? 'lahar' : 'ash'), 'retry', kind === 'rock' ? STR.hitRock : kind === 'lahar' ? STR.hitLahar : STR.hitAsh);
        },
        block: () => { AG.sfx.play(K + 'sfx.catch', { volume: 0.5 }); this.pop(STR.blockedPop, this.mover.x, this.mover.groundY - 52, '#6ed8ff'); this.say('blocked', 'info', STR.blocked); },
        heart: n => this.hud.set({ hearts: n }),
        power: kind => this.say('power:' + kind, 'info', kind === 'shield' ? STR.hat : kind === 'slowmo' ? STR.slowmo : STR.magnet),
        collect: () => { AG.sfx.play(K + 'sfx.catch'); this.pop('PHOTO!', this.mover.x, this.mover.groundY - 52, GOLD); this.say('photo', 'info', STR.photo); },
        order: order => { this.pop(fmt(STR.orderDone, { n: order.bonus }), W / 2, 70, GOLD); this.flash = this.t + 0.8; this.hud.set({ score: this.run.score }); },
        lane: (lane, st) => {
          if (st === 'warning') {
            AG.sfx.play(K + 'sfx.siren'); this.cap(STR.capSiren);
            AG.kit.banner(this.stage, STR.riverBanner, STR.riverSub, 2000);
            ctx.say('warning', STR.river, { pose: AG.rig.resolve(ex, 'alert').frame });
          } else if (st === 'active') { this.laharLoop = AG.sfx.loop(K + 'sfx.lahar_loop', { volume: 0.6 }); this.cap(STR.capLahar); }
          else if (this.laharLoop) { this.laharLoop.stop(); this.laharLoop = null; }
        },
        evac: () => {
          AG.sfx.play(K + 'sfx.horn'); this.cap(STR.capHorn);
          AG.kit.banner(this.stage, STR.evac, STR.evacSub, 2000);
          ctx.say('warning', STR.evacSay, { pose: AG.rig.resolve(ex, 'alert').frame });
        },
        evacLate: () => { this.say(null, 'retry', STR.late); this.pop('HURRY!', W / 2, 96, '#ff4f6d'); },
        board: e => {
          this.mover.pose('cheer', 0); this.ex = { action: 'cheer' };
          AG.kit.celebrate(this.stage); AG.sfx.play(K + 'sfx.horn', { volume: 0.7 });
          this.pop('+' + e.bonus, W / 2, 96, GOLD); this.hud.set({ score: this.run.score });
        },
        end: won => {
          if (won && !this.run.evac) { this.mover.pose('cheer', 0); this.ex = { action: 'cheer' }; AG.kit.celebrate(this.stage); }
          else if (!won) { this.mover.pose('oops', 0); this.ex = { action: 'happy' }; }
          if (this.laharLoop) { this.laharLoop.stop(); this.laharLoop = null; }
          ctx.after(won ? 1600 : 900, () => this.finish());
        }
      };
    }

    /* ---------- frame ---------- */
    frame(dt) {
      this.t += dt;
      this.run.update(dt);
      const run = this.run, e = run.evac;
      this.rig.setGear(run.field.power.active('shield') ? 'hard_hat' : run.maskOn ? 'mask' : null); // no-op for AGILA
      if (e) { this.busT = Math.min(1, this.busT + dt / 0.4); if (run.phase === 'dash') this.hud.set({ timer: (Math.max(0, e.left) / 1000).toFixed(1) }); }
      this.pops = this.pops.filter(p => (p.t += dt) < 0.9);
      this.render();
    }

    render() {
      const c = this.view.ctx, run = this.run, field = run.field, t = this.t;
      this.drawBackdrop(c, t);
      if (this.lv.laharSide) AG.assets.draw(c, K + 'lahar.bank', run.field.lanes[0].x, T.groundY, T.lahar.w, 35);
      if (run.evac) this.drawBus(c);
      field.draw(c, t);
      if (this.ex) this.drawExpert(c, t);
      if (this.dark) this.drawDark(c, t);
      this.drawHud(c, t);
    }
    /** Volcano stage and plume by Alert Level, with drifting ash. */
    drawBackdrop(c, t) {
      const a = clamp(this.run.alert, 1, 5);
      AG.assets.draw(c, K + 'bg.volcano_' + a, 0, 0, W, H);
      const s = PLUME[a - 1], pw = Math.round(96 * s);
      AG.assets.draw(c, K + 'plume', 245 - pw / 2, 74 - pw, pw, pw, this.reduce ? 0 : Math.floor(t * 3) % 4);
      c.fillStyle = a > 2 ? '#dcd7e8' : '#a9a4bd';
      const n = Math.round(a * 8 * (this.reduce ? 0.5 : 1));
      for (let i = 0; i < n; i++) {
        const x = ((i * 73 + t * (10 + i % 5 * 4)) % (W + 20)) - 10, y = ((i * 41 + t * (24 + i % 4 * 8)) % (T.groundY + 10)) - 5;
        c.fillRect(Math.round(x), Math.round(y), 2, 2);
      }
    }
    drawBus(c) {
      const run = this.run, e = run.evac, right = e.side === 'right', w = T.bus.w, y = T.groundY - 46;
      const slide = (1 - this.busT) * 110, x = Math.round(run.busX() + (right ? slide : -slide));
      const near = run.phase === 'dash' && Math.abs(this.mover.x - run.doorX()) < 60;
      const frame = run.phase === 'board' || run.phase === 'ended' ? 2 : near ? 1 : 0; // the door opens as you arrive
      c.save();
      if (right) { c.translate(x + w, y); c.scale(-1, 1); } else c.translate(x, y); // the door end faces the player
      AG.assets.draw(c, K + 'bus', 0, 0, w, T.bus.h, frame);
      c.restore();
      if (run.phase === 'dash' && (this.reduce || Math.floor(this.t * 3) % 2 === 0)) { // a chevron points at the bus
        const dir = right ? 1 : -1, ax = Math.round(run.doorX() - dir * 26), ay = T.groundY - 60;
        c.fillStyle = INK; for (let i = 0; i < 6; i++) { c.fillRect(ax + dir * i * 2 - 1, ay + i * 2 - 1, 4, 4); c.fillRect(ax + dir * i * 2 - 1, ay + 20 - i * 2 - 1, 4, 4); }
        c.fillStyle = GOLD; for (let i = 0; i < 6; i++) { c.fillRect(ax + dir * i * 2, ay + i * 2, 2, 2); c.fillRect(ax + dir * i * 2, ay + 20 - i * 2, 2, 2); }
      }
    }
    drawExpert(c, t) {
      const m = this.mover, x = clamp(m.x + (m.x > W / 2 ? -28 : 28), T.minX, T.maxX);
      this.expert.play(this.ex.action); this.expert.setFacing(x < m.x ? 'right' : 'left');
      this.expert.draw(c, x, T.groundY, t);
    }
    /** L3: the ash darkens the screen as the level goes on; a light circle follows the player and shadows stay visible. */
    drawDark(c, t) {
      const f = this.run.field, d = this.dark;
      d.alpha = T.dark.max * (f.director ? f.director.progress : 0);
      if (d.alpha < 0.01) return;
      d.draw(c, { lights: [{ x: Math.round(this.mover.x), y: T.groundY - 16, r: T.dark.radius[this.diff] }], t });
      for (const ob of f.objects) if (ob.def.shadowWarnMs || ob.def.shadow) f.drawShadow(c, ob);
    }

    /* ---------- the canvas HUD ---------- */
    drawHud(c, t) {
      const run = this.run, f = run.field, cur = f.current, text = (s, x, y, o) => label(c, s, x, y, o);
      // the Alert Level badge, its wave bar and one pip per wave
      AG.assets.draw(c, K + 'ui.alert_' + clamp(run.alert, 1, 5), 6, 6, 32, 32);
      text(fmt(STR.alertText, { n: run.alert }), 44, 5, { size: 14 });
      const n = run.waves.length, bw = 84, pw = Math.floor((bw - (n - 1) * 2) / n);
      for (let i = 0; i < n; i++) {
        const x = 44 + i * (pw + 2), fill = i < run.waveIx ? 1 : i === run.waveIx && cur ? cur.t : 0;
        c.fillStyle = INK; c.fillRect(x - 1, 24, pw + 2, 8); c.fillStyle = '#4b4570'; c.fillRect(x, 25, pw, 6);
        c.fillStyle = GOLD; c.fillRect(x, 25, Math.round(pw * fill), 6);
      }
      // power-ups
      f.power.list().forEach((p, i) => {
        const x = 6, y = 44 + i * 22;
        c.fillStyle = INK; c.fillRect(x - 2, y - 2, 60, 22); c.fillStyle = '#c4b5ff'; c.fillRect(x - 1, y - 1, 58, 20); c.fillStyle = '#3a2f66'; c.fillRect(x, y, 56, 18);
        icon(c, POWER_ICON[p.kind], x, y);
        if (isFinite(p.totalMs)) { c.fillStyle = INK; c.fillRect(x + 20, y + 6, 32, 6); c.fillStyle = '#c4b5ff'; c.fillRect(x + 21, y + 7, Math.round(30 * p.leftMs / p.totalMs), 4); }
        else text('×' + p.hits, x + 22, y + 2);
      });
      // the wave order: each wanted item with one tick box per catch (filled = caught)
      const ord = f.director && f.director.order;
      if (ord && run.phase === 'waves') {
        const items = ord.progress, w = 10 + items.reduce((s, it) => s + 18 + 4 + it.need * 8 + 6, 0) - 6, x0 = W - 6 - w, hot = this.t < this.flash;
        c.fillStyle = hot ? GOLD : INK; c.fillRect(x0 - 2, 4, w + 4, 38); c.fillStyle = '#2b2266'; c.fillRect(x0, 6, w, 34);
        text(pick(STR.order), x0 + 4, 5, { size: 10, outline: null, color: GOLD });
        let x = x0 + 5;
        for (const it of items) {
          icon(c, f.defs[it.id].icon, x, 18); x += 22;
          for (let k = 0; k < it.need; k++) { c.fillStyle = '#fff'; c.fillRect(x, 26, 6, 6); c.fillStyle = k < it.have ? '#3ecf6e' : '#2b2266'; c.fillRect(x + 1, 27, 4, 4); x += 8; }
          x += 6;
        }
      }
      // combo
      if (f.combo.count >= 2) text('Combo ' + f.combo.count + (f.combo.mult > 1 ? '  ×' + f.combo.mult : ''), W - 6, run.phase === 'waves' && ord ? 46 : 8, { align: 'right', color: f.combo.mult > 1 ? GOLD : '#fff' });
      // the evacuation timer
      if (run.phase === 'dash') {
        const e = run.evac, left = Math.max(0, e.left);
        if (this.reduce || Math.floor(t * 3) % 2 === 0) text(pick(STR.evac), W / 2, 8, { size: 16, bold: true, align: 'center', color: '#ff7a7a' });
        c.fillStyle = INK; c.fillRect(W / 2 - 62, 30, 124, 10); c.fillStyle = left < 2000 ? '#ff4f6d' : GOLD; c.fillRect(W / 2 - 60, 32, Math.round(120 * left / e.totalMs), 6);
        text((left / 1000).toFixed(1) + ' s', W / 2, 42, { align: 'center' });
      }
      // sound captions and floating points
      if (this.caption && this.caption.until > t) text(this.caption.text, W / 2, 252, { size: 10, align: 'center', color: '#e6e2ff' });
      for (const p of this.pops) text(p.text, p.x, p.y - Math.round(p.t * 28), { align: 'center', size: 12, bold: true, color: p.color });
    }

    /* ---------- the end ---------- */
    finish() {
      if (this.finished) return;
      this.finished = true;
      const run = this.run, r = run.result(), lv = this.lv, st = r.stats;
      let events = [];
      AG.store.update('stats', s => { events = A.scoring.badges(s.ashfall = s.ashfall || {}, { level: lv.level, completed: r.won, masks: st.masks, laharHits: st.laharHits, secsLeft: r.secsLeft }); });
      this.doneFn({
        won: r.won, stars: r.stars, score: r.score, timeMs: Math.round(run.time), heartsLeft: r.hearts, collectibles: r.photos,
        detail: [
          { label: STR.dMasks, value: String(st.masks), icon: 'facemask' },
          { label: STR.dOrders, value: String(st.orders), icon: 'documents' },
          { label: STR.dCombo, value: String(r.bestCombo), icon: '⭐' },
          lv.evac && r.won ? { label: STR.dSecs, value: String(r.secsLeft), icon: '🚌' } : null,
          { label: STR.dHearts, value: r.hearts + ' / ' + run.maxHearts, icon: 'heart' }
        ].filter(Boolean),
        message: pick(!r.won ? STR.msg0 : r.stars >= 3 ? STR.msg3 : r.stars === 2 ? STR.msg2 : STR.msg1),
        badgeEvents: events, delay: 300
      });
    }
    destroy() {
      this.dead = true;
      if (this.stop) this.stop();
      if (this.rumble) this.rumble.stop();
      if (this.laharLoop) this.laharLoop.stop();
      this.offs.forEach(f => f()); this.offs = [];
      this.mover.destroy(); this.pad.destroy(); this.el.remove();
      if (A.live && A.live.scene === this) A.live = null;
    }
  }

  Object.assign(A, { STR, AshfallScene });
})(window.AG);
