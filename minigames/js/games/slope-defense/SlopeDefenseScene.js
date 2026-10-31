/* 04 Slope Defense: the scene. One level on a 480 × 270 canvas (16 × 9 tiles of 30 px, mountain at the top, village at the bottom).
 * It owns the canvas, the HUD (budget / rain / portrait), the big button under the map, the wave flow (BUILD → RAIN → wave summary → next
 * wave → results), the drawing shared by both phases and the scoring. BuildPhase.js and RainPhase.js hold the input and the extra drawing
 * of each phase, Slope.js the model, tuning.js the numbers, levels.json the levels. */
window.AG = window.AG || {};
(function (AG) {
  const { h } = AG.util;
  const SD = AG.slopeDefense, T = SD.tuning, R = SD.rules, D = () => AG.sim.draw;
  const W = T.W, H = T.H, INK = '#1e1538', GOLD = '#ffd23f', BROWN = '#7a4f2a';
  const S = en => ({ en });
  const pick = v => AG.pick(v);

  const STR = {
    hudBuild: S('Build'), now: S('Now'), rain: S('Rain'), budget: S('coins'), wave: S('Wave'), alert: S('ALERT'),
    start: S('START RAIN'), startKey: S('Space'), evac: S('EVACUATE'), evacKey: S('E'), evacing: S('Going to safety…'), cont: S('Continue'),
    bandName: [S('YELLOW'), S('ORANGE'), S('RED')],
    hintBuildKey: S('Arrows: pick a spot · Enter: build menu · 1–4: choose · Backspace: remove · Space: START RAIN'),
    hintBuildTouch: S('Tap a spot to build. Tap START RAIN when you are ready.'),
    hintRainKey: S('Arrows: move the lookout (hold Shift to go slow) · Enter: report a sign · E: EVACUATE'),
    hintRainTouch: S('Tap a warning sign to report it. Tap EVACUATE to send everyone to safety.'),
    hintNightKey: S('Arrows: sweep the flashlight · Enter: report a sign · E: EVACUATE'),
    hintNightTouch: S('Drag to sweep the flashlight, tap a sign to report it. Tap EVACUATE to send everyone to safety.'),
    cantBuild: S('Not here.'), built: S('Built!'), refund: S('Refunded'),
    pet: S('You found a paw print!'),
    waveDone: S('Wave {n} done'), allDone: S('Level done'),
    safe: S('Villagers safe'), houses: S('Houses intact'), signs: S('Signs reported'), left: S('Coins left'), good: S('Good call'), pets: S('Paw prints'),
    grew: S('Your trees grew! They slow the mud more now.'),
    waiting: S('Some villagers were still waiting. They are safe for now and will be rescued later. Next time, press EVACUATE earlier: leaving early is never wrong!'),
    heldSay: S('The wall held the big slide! The house behind it is safe.'),
    muddySay: S('Mud reached a house. Trees, grass, canals and walls slow or stop it.'),
    slideSay: S('The big slide is coming down the slope!'),
    goodSay: S('Good call! You evacuated early. Leaving early is never wrong.'),
    alertHigh: S('Your Alert is high! Time to tell everyone to evacuate.'),
    evacSay: S('**EVERYONE, EVACUATE NOW!** Walk to the safe zone together.'),
    band: [S('Radio: light rain. Look for cracks, leaning trees and posts, and muddy creek water.'),
      S('Radio: heavy rain. The soil is soaking up water. Report every warning sign!'),
      S('Radio: very heavy rain! Landslide danger. If you have not yet, EVACUATE now!')],
    msg3: S('Perfect! Everyone is safe, the houses held and you reported every warning sign.'),
    msg2: S('Great job! For 3 stars, report every warning sign too.'),
    msg1: S('Everyone is safe! For more stars, protect more houses with trees, grass, canals and walls.'),
    msg0: S('The villagers are waiting to be rescued. Next time press EVACUATE earlier. Leaving early is never wrong!'),
    cantRain: S('Build something first, or start the rain anyway.')
  };
  const fmt = (t, vars) => pick(t).replace(/\{(\w+)\}/g, (_, k) => (vars[k] == null ? '' : vars[k]));

  const CSS = `
#ag-app .sd { display: grid; gap: 8px; justify-items: center; width: 100%; }
#ag-app .sd-box { position: relative; width: 100%; max-width: calc(62vh * 1.7778); }
#ag-app .sd-toast { position: absolute; left: 6px; right: 6px; top: 26px; z-index: 4; margin: 0 auto; width: max-content; max-width: calc(100% - 12px); padding: 4px 10px; background: #fff8e6; color: #1e1538; border: 3px solid #1e1538; box-shadow: 0 3px 0 #1e1538; font-weight: 800; font-size: .85rem; text-align: center; pointer-events: none; }
#ag-app .sd-toast[hidden] { display: none; }
#ag-app .sd-bar { display: flex; align-items: center; justify-content: space-between; gap: 10px; width: 100%; max-width: calc(62vh * 1.7778); }
#ag-app .sd-hint { flex: 1; font-size: .85rem; color: var(--muted); font-weight: 700; min-height: 1.2em; }
#ag-app .sd-go { flex: none; display: flex; flex-direction: column; align-items: center; justify-content: center; min-width: 168px; min-height: 56px; padding: 6px 16px; border: 3px solid #1e1538; box-shadow: 0 4px 0 #1e1538; font-family: var(--font-display); font-size: 1.15rem; color: #fff; background: #2f8a4a; cursor: pointer; touch-action: manipulation; }
#ag-app .sd-go small { font-family: var(--font-body); font-size: .72rem; font-weight: 800; color: #ffd23f; }
#ag-app .sd-go.evac { background: #e0245e; }
#ag-app .sd-go[disabled] { opacity: .55; cursor: default; }
#ag-app .sd-go[hidden] { display: none; }
#ag-app .sd-portrait { display: inline-flex; align-items: center; width: 40px; height: 40px; overflow: hidden; flex: none; }
#ag-app .sd-portrait img { height: 40px; width: auto; image-rendering: pixelated; }
#ag-app .sd-wave { position: absolute; inset: 0; z-index: 7; display: grid; place-items: center; background: rgba(30, 21, 56, .6); padding: 6px; overflow: auto; }
#ag-app .sd-wave > div { background: var(--panel, #fff8e6); color: var(--fg, #1e1538); border: 3px solid #1e1538; box-shadow: 0 4px 0 #1e1538; padding: 10px 14px; display: grid; gap: 6px; max-width: 360px; width: 100%; }
#ag-app .sd-wave b { font-family: var(--font-display); font-size: 1.1rem; text-align: center; }
#ag-app .sd-wave p { margin: 0; display: flex; justify-content: space-between; gap: 12px; font-weight: 700; font-size: .9rem; }
#ag-app .sd-wave .sd-note { display: block; text-align: center; font-weight: 700; font-size: .85rem; }
#ag-app .ag-simmenu__opt.is-focus { outline: 3px solid var(--vest, #ffd23f); outline-offset: 1px; }
@media (max-width: 520px) { #ag-app .sd-bar { flex-direction: column-reverse; align-items: stretch; } #ag-app .sd-go { width: 100%; } }`;
  function injectCss() {
    if (!document.querySelector('style[data-ag-css="slope-defense"]')) document.head.append(h('style', { 'data-ag-css': 'slope-defense' }, CSS));
  }
  /** Outlined pixel text (white with an ink edge) so it reads on every map. */
  function label(c, str, x, y, o) {
    o = Object.assign({ size: 10, color: '#fff' }, o);
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) AG.gfx.text(c, str, x + dx, y + dy, Object.assign({}, o, { color: INK }));
    AG.gfx.text(c, str, x, y, o);
  }
  /** A dotted circle (the reach of a tree or a patch of grass). */
  function dots(c, x, y, r, color) {
    c.fillStyle = color;
    for (let a = 0; a < 360; a += Math.max(4, Math.round(360 / (r * 0.9)))) c.fillRect(Math.round(x + Math.cos(a * Math.PI / 180) * r), Math.round(y + Math.sin(a * Math.PI / 180) * r), 2, 2);
  }

  class SlopeDefenseScene {
    constructor(stage, ctx, done) {
      injectCss();
      this.stage = stage; this.ctx = ctx; this.doneFn = done; this.lv = ctx.levelData;
      this.diff = ctx.difficulty === 'advanced' ? 'advanced' : 'easy'; this.D = T.diff[this.diff];
      this.level = ctx.level; this.reduce = AG.reducedMotion(); this.night = !!this.lv.night;
      this.finished = false; this.dead = false; this.real = 0; this.offs = []; this.toastUntil = 0; this.phase = 'build'; this.hintTick = 0;
      this.run = new SD.LevelRun(this.lv, { diff: this.diff, seed: ctx.seed });
      this.found = this.run.persist.found; this.score = 0; this.safeSaid = false; this.pops = [];

      this.view = AG.gfx.canvas(W, H);
      this.rig = ctx.rig('top', { height: 28 });
      this.portraitRig = ctx.rig('portrait', { height: 40 });
      this.portrait = h('span', { class: 'sd-portrait', 'aria-hidden': 'true' });
      this.dark = this.night && AG.grid ? new AG.grid.Darkness({ w: W, h: H, color: '#070816', alpha: 0.9 }) : null;

      this.toastEl = h('div', { class: 'sd-toast', role: 'status', hidden: true });
      this.box = h('div', { class: 'sd-box' }, this.view.cv, this.toastEl);
      this.hint = h('div', { class: 'sd-hint' });
      this.go = h('button', { type: 'button', class: 'sd-go' });
      this.go.addEventListener('click', () => this.onGo());
      this.el = h('div', { class: 'sd' }, this.box, h('div', { class: 'sd-bar' }, this.hint, this.go));
      stage.append(this.el);
      this.hud = ctx.hud({ score: 0, label: STR.now, meter: true });
      this.hud.el.prepend(this.portrait);
      this.setPortrait('idle');
      AG.sfx.preload(T.sfx);
      AG.input.setView(this.view);
      AG.input.register('EVAC', { keys: ['KeyE'], button: { en: 'Evacuate' } });
      this.build = new SD.BuildPhase(this); this.rainPh = new SD.RainPhase(this);
      if (AG.debug.on) SD.live = { scene: this };
      this.startWave();
      this.stopLoop = AG.gfx.loop(dt => this.frame(dt));
    }

    /* ---------- waves ---------- */
    get sim() { return this.run.sim; }
    startWave() {
      const sim = this.run.next();
      this.phase = 'build'; this.rig.play('idle'); this.setPortrait('idle');
      this.build.enter();
      this.refreshGo(); this.refreshHud();
      const n = this.run.wave, ctx = this.ctx;
      if (n === 1) ctx.after(500, () => ctx.say('instruction', this.lv.blurb));
      else ctx.after(500, () => ctx.say('instruction', STR.grew));
      return sim;
    }
    startRain() {
      if (this.phase !== 'build' || this.finished) return false;
      this.build.exit(); this.phase = 'rain';
      this.rainPh.enter();
      this.refreshGo(); this.refreshHud();
      return true;
    }
    /** The rain and the slides are over: the summary, then the next wave or the results. */
    onWaveEnd() {
      if (this.phase !== 'rain') return;
      this.phase = 'wave'; this.rainPh.exit();
      const r = this.run.endWave(), ctx = this.ctx, last = this.run.finished;
      this.refreshGo(); this.refreshHud();
      const waiting = r.safe < r.total;
      if (waiting) ctx.say('retry', STR.waiting);
      this.rig.play(r.safe === r.total ? 'cheer' : 'idle'); this.setPortrait(r.safe === r.total ? 'cheer' : 'idle');
      ctx.after(700, () => this.showSummary(r, last));
    }
    showSummary(r, last) {
      if (this.finished || this.dead) return;
      const rows = [[STR.safe, r.safe + ' / ' + r.total], [STR.houses, r.intact + ' / ' + r.houses]];
      if (this.lv.signs) rows.push([STR.signs, r.signsReported + ' / ' + r.signsTotal]);
      const btn = h('button', { type: 'button', class: 'ag-btn' }, pick(STR.cont));
      this.summary = h('div', { class: 'sd-wave' }, h('div', {}, h('b', {}, last ? pick(STR.allDone) : fmt(STR.waveDone, { n: r.wave })),
        ...rows.map(([k, v]) => h('p', {}, h('span', {}, pick(k)), h('span', {}, v))),
        last ? null : h('span', { class: 'sd-note' }, pick(STR.grew)), btn));
      btn.addEventListener('click', () => this.nextWave());
      this.box.append(this.summary);
      setTimeout(() => btn.focus(), 60);
    }
    nextWave() {
      if (this.summary) { this.summary.remove(); this.summary = null; }
      if (this.finished) return;
      if (this.run.finished) this.finish(); else this.startWave();
    }

    /* ---------- the big button, the hint, the HUD, the portrait ---------- */
    onGo() { if (this.phase === 'build') this.startRain(); else if (this.phase === 'rain') this.rainPh.evacuate(); }
    refreshGo() {
      const g = this.go, p = this.phase, sim = this.sim;
      g.hidden = p === 'wave' || p === 'done';
      g.classList.toggle('evac', p === 'rain');
      if (p === 'build') { g.disabled = false; g.replaceChildren(pick(STR.start) + ' ▶', h('small', {}, pick(STR.startKey))); }
      else if (p === 'rain') { const on = sim.evac; g.disabled = !!on; g.replaceChildren(on ? pick(STR.evacing) : '🚨 ' + pick(STR.evac), on ? null : h('small', {}, pick(STR.evacKey))); }
    }
    refreshHud(extra) {
      const sim = this.sim, p = this.phase, band = p === 'rain' || p === 'wave' ? R.bandOf(sim.rain) : null;
      this.hud.set(Object.assign({ score: this.liveScore(), label: p === 'rain' ? { en: pick(STR.rain) + ': ' + pick(STR.bandName[band]) } : p === 'build' ? STR.hudBuild : STR.rain, meter: p === 'build' ? 0 : sim.rain, warn: band === 2 }, extra));
    }
    liveScore() { const a = this.run.totals(), s = this.sim; return a.safe * T.score.safe + (s && s.phase !== 'build' ? s.villagers.filter(v => v.state === 'safe').length * T.score.safe : 0) + (a.signsReported + (s ? s.signs.filter(x => x.state === 'reported').length : 0)) * T.score.sign; }
    setPortrait(action) {
      this.portraitRig.play(action);
      this.portrait.replaceChildren(this.portraitRig.img(1));
      this.portraitAt = action;
    }
    setHint() {
      const touch = AG.input.lastDevice === 'touch', p = this.phase;
      const t = p === 'build' ? (touch ? STR.hintBuildTouch : STR.hintBuildKey) : p === 'rain' ? (this.night ? (touch ? STR.hintNightTouch : STR.hintNightKey) : (touch ? STR.hintRainTouch : STR.hintRainKey)) : null;
      this.hint.textContent = t ? pick(t) : '';
    }
    toast(text, sec) { this.toastEl.textContent = pick(text); this.toastEl.hidden = false; this.toastUntil = this.real + (sec || 3.2); }
    pop(text, x, y, good) { const k = this.box.clientWidth / W || 1; AG.kit.pop(this.box, Math.round(x * k), Math.round(y * k), text, good !== false); }
    say(type, text, action) {
      const ex = this.ctx.expertId, pose = action ? AG.rig.resolve(ex, action === 'hold:megaphone' && ex === 'agila' ? 'point' : action).frame : undefined;
      this.ctx.say(type, text, pose ? { pose } : undefined);
    }

    /* ---------- hidden paw prints ---------- */
    petAt(x, y) {
      const t = R.tileOf(x, y);
      return this.lv.pets.findIndex((p, i) => !this.found[i] && p.tx === t.tx && p.ty === t.ty);
    }
    takePet(i) {
      if (i < 0 || this.found[i]) return false;
      this.found[i] = true;
      const c = R.tileCentre(this.lv.pets[i].tx, this.lv.pets[i].ty);
      this.pop('🐾', c.x, c.y - 10, true); AG.sfx.play('good'); this.toast(STR.pet, 2);
      this.pawGlint = { x: c.x, y: c.y, t: this.real };
      return true;
    }

    /* ---------- the frame ---------- */
    frame(dt) {
      dt = Math.min(dt, 0.05);
      this.real += dt;
      if (!this.finished) {
        if (this.phase === 'build') this.build.update(dt); else if (this.phase === 'rain') this.rainPh.update(dt);
        if (this.toastUntil && this.real > this.toastUntil) { this.toastUntil = 0; this.toastEl.hidden = true; }
        if ((this.hintTick += dt) > 0.4) { this.hintTick = 0; this.setHint(); }
      }
      this.draw(dt);
    }

    /* ---------- drawing ---------- */
    draw() {
      const c = this.view.ctx, sim = this.sim, t = performance.now() / 1000, lv = this.lv;
      c.imageSmoothingEnabled = false;
      AG.assets.draw(c, T.art.map(this.level), 0, 0, W, H);
      this.drawPaths(c, sim);
      this.drawVillage(c, sim, t);
      this.drawDefenses(c, sim, t);
      if (this.phase !== 'build') this.drawMud(c, sim, t);
      this.drawVillagers(c, sim, t);
      this.drawPost(c, t);
      if (this.phase === 'build') this.build.draw(c, t);
      else this.rainPh.draw(c, t);
      if (this.pawGlint && this.real - this.pawGlint.t < 1.2) AG.gfx.drawIcon(c, '🐾', Math.round(this.pawGlint.x - 9), Math.round(this.pawGlint.y - 9 - (this.real - this.pawGlint.t) * 10), 1);
      this.drawHud(c, sim, t);
    }
    drawPaths(c, sim) {
      sim.pathDefs.forEach(p => {
        const pts = p.pts.map(([x, y]) => ({ x, y }));
        D().polyline(c, pts, { color: 'rgba(30,21,56,.55)', size: 7 });
        D().polyline(c, pts, { color: '#a87b46', size: 5 });
        D().polyline(c, pts, { color: '#c79a62', size: 1, dash: [2, 5] });
        const s = pts[0]; // the source: a dark patch of loose soil at the top of the path
        c.fillStyle = INK; c.fillRect(s.x - 8, s.y - 4, 16, 9); c.fillStyle = BROWN; c.fillRect(s.x - 7, s.y - 3, 14, 7); c.fillStyle = '#a87b46'; c.fillRect(s.x - 4, s.y - 2, 8, 3);
      });
    }
    drawVillage(c, sim, t) {
      const lv = this.lv;
      // the evacuation route, dashed, with arrows that slide while people walk
      const ev = lv.evacRoute, y = ev[ev.length - 1][1], end = lv.safeZone.x;
      D().line(c, ev[0][0], y, end, y, { color: 'rgba(255,248,230,.6)', dash: [4, 4] });
      const walking = sim.evac && sim.villagers.some(v => v.state === 'walking');
      for (let x = 70 + (walking && !this.reduce ? Math.floor(t * 20) % 60 : 0); x < end - 8; x += 60) { c.fillStyle = 'rgba(255,248,230,.85)'; c.fillRect(x, y - 2, 5, 1); c.fillRect(x + 3, y - 3, 1, 3); c.fillRect(x + 4, y - 2, 1, 1); }
      AG.assets.draw(c, T.art.safe, lv.safeZone.x - 15, lv.safeZone.y - 15, 30, 30);
      label(c, 'SAFE', lv.safeZone.x, lv.safeZone.y - 28, { align: 'center' });
      sim.houses.forEach(hs => {
        const bad = hs.muddy || hs.damaged;
        AG.assets.draw(c, T.art.houses[bad ? 1 : 0], hs.x - 15, hs.y - 15, 30, 30);
        if (this.phase !== 'build' && !bad && hs.mud > 0) D().bar(c, hs.x - 12, hs.y - 21, 24, 4, hs.mud / sim.limit, { fill: '#a87b46' });
        if (hs.protectedBy) { c.fillStyle = INK; c.fillRect(hs.x - 6, hs.y - 27, 12, 8); c.fillStyle = '#7ee08a'; c.fillRect(hs.x - 5, hs.y - 26, 10, 6); c.fillStyle = INK; c.fillRect(hs.x - 3, hs.y - 23, 2, 2); c.fillRect(hs.x - 1, hs.y - 22, 2, 2); c.fillRect(hs.x + 1, hs.y - 24, 2, 3); }
      });
    }
    drawDefenses(c, sim) {
      const live = sim.followers;
      sim.allSlots.forEach(s => {
        const b = sim.built.get(s.id);
        if (!b) return;
        const x = Math.round(s.x - 15), y = Math.round(s.y - 15);
        if (b.op === 'tree') AG.assets.draw(c, T.tree.art[b.stage], x, y, 30, 30);
        else if (b.op === 'vetiver') AG.assets.draw(c, 'slope-defense.def.vetiver', x, y, 30, 30);
        else if (b.op === 'canal') AG.assets.draw(c, 'slope-defense.def.canal', x, y, 30, 30);
        else if (b.op === 'wall') {
          const bl = live && live.blockers.find(k => k.id === s.id), hp = bl ? bl.hp : b.broken ? 0 : T.wall.hp;
          const pt = sim.polys[s.path].project(s.x, s.y), p = sim.polys[s.path].at(pt.s);
          D().line(c, s.x, s.y, p.x, p.y, { color: INK, size: 3 }); D().line(c, s.x, s.y, p.x, p.y, { color: '#c79a62', size: 1 });
          if (hp > 0) { c.fillStyle = INK; c.fillRect(Math.round(p.x) - 8, Math.round(p.y) - 3, 16, 7); c.fillStyle = '#8a8a8a'; c.fillRect(Math.round(p.x) - 7, Math.round(p.y) - 2, 14, 5); }
          AG.assets.draw(c, T.wall.art[hp <= 0 ? 2 : hp <= T.wall.hp / 2 ? 1 : 0], x, y, 30, 30);
          if (this.phase !== 'build' && hp > 0) D().bar(c, s.x - 12, s.y - 22, 24, 4, hp / T.wall.hp, { fill: hp <= T.wall.hp / 2 ? '#e0245e' : '#2f8a4a' });
        }
      });
    }
    drawMud(c, sim, t) {
      const f = sim.followers, k = this.reduce ? 0 : Math.floor(t * 3);
      f.units.forEach(u => {
        const x = Math.round(u.x), y = Math.round(u.y), w = u.state === 'move' ? 0 : 1;
        c.fillStyle = INK; c.fillRect(x - 4, y - 3, 9, 7); c.fillRect(x - 3, y - 4, 7, 9);
        c.fillStyle = w ? '#5d3a1c' : BROWN; c.fillRect(x - 3, y - 3, 7, 7); c.fillStyle = '#a87b46'; c.fillRect(x - 2 + ((k + u.s) & 1), y - 2, 2, 2);
      });
      sim.fronts.forEach(fr => {
        const poly = sim.polys[fr.path], pts = [];
        for (let s = 0; s <= fr.s; s += 6) pts.push(poly.at(s));
        pts.push(poly.at(fr.s));
        D().polyline(c, pts, { color: INK, size: 11 }); D().polyline(c, pts, { color: '#6b4423', size: 9 });
        const p = poly.at(fr.s);
        AG.assets.draw(c, T.art.slide, Math.round(p.x - 30), Math.round(p.y - 30), 60, 60, this.reduce ? 0 : Math.floor(t * 6));
      });
    }
    drawVillagers(c, sim, t) {
      const walk = this.reduce ? 0 : Math.floor(t * 6) % 2;
      sim.villagers.forEach(v => {
        const x = Math.round(v.x - 6), y = Math.round(v.y - 16);
        if (v.state === 'waiting') {
          AG.assets.draw(c, T.art.waiting, x, y, 12, 16);
          AG.gfx.drawIcon(c, '⏳', x - 3, y - 15, 1);
        } else AG.assets.draw(c, T.art.villager, x, y, 12, 16, v.state === 'walking' ? walk : 0);
      });
    }
    drawPost(c, t) {
      const p = R.tileCentre(this.lv.watchPost.tx, this.lv.watchPost.ty);
      AG.assets.draw(c, T.art.post, p.x - 15, p.y - 15, 30, 30);
      this.rig.draw(c, p.x, p.y - 2, t);
      const mood = this.rig.action === 'think' ? '💭' : this.rig.action === 'alert' ? '❗' : this.rig.action === 'cheer' || this.rig.action === 'happy' ? '🎉' : null;
      if (mood) AG.gfx.drawIcon(c, mood, Math.round(p.x - 9), Math.round(p.y - 36), 1);
      this.postAt = p;
    }
    drawHud(c, sim) {
      const lv = this.lv, band = this.phase === 'rain' || this.phase === 'wave' ? R.bandOf(sim.rain) : -1;
      if (band >= 0) { AG.assets.draw(c, T.art.rain[band], 3, 3, 32, 32); label(c, pick(STR.bandName[band]), 38, 6, { size: 10, color: ['#ffd23f', '#ff9f1c', '#ff5a7a'][band] }); }
      else { AG.gfx.drawIcon(c, '🪙', 4, 3, 1); }
      label(c, sim.budget + ' ' + pick(STR.budget), band >= 0 ? 38 : 24, band >= 0 ? 18 : 6, { size: 10, color: GOLD });
      if (lv.waves > 1) label(c, pick(STR.wave) + ' ' + this.run.wave + '/' + lv.waves, 190, 6, { size: 10 });
      if (lv.signs && band >= 0) {
        label(c, pick(STR.alert), 335, 4, { size: 10, align: 'right' });
        D().bar(c, 340, 6, 96, 9, sim.alert / 100, { markers: [{ at: 0.6, kind: 'safe' }], fill: sim.alert >= T.alert.good ? '#2f8a4a' : '#ff9f1c' });
        label(c, String(sim.alert), 443, 4, { size: 10 });
      }
      // the three hidden paw prints
      for (let i = 0; i < 3; i++) { c.save(); c.globalAlpha = this.found[i] ? 1 : 0.35; AG.gfx.drawIcon(c, '🐾', 400 + i * 24, lv.signs && band >= 0 ? 17 : 3, 1); c.restore(); }
    }

    /* ---------- the end ---------- */
    finish() {
      if (this.finished) return;
      this.finished = true; this.phase = 'done'; this.rainPh.exit();
      const run = this.run, a = run.totals(), lv = this.lv, stars = R.stars(a, lv);
      const good = a.called && a.good, early = run.results.length > 0 && run.results.every(r => r.called && r.evacRain < T.bands[0]);
      const score = R.score(a, run.budget, good), won = stars >= 1;
      let events = [];
      AG.store.update('stats', s => { events = R.badges(s.slopeDefense = s.slopeDefense || {}, { fullTrees: a.fullTrees, signs: a.signsReported, level: this.level, won, early }); });
      const detail = [
        { label: STR.safe, value: a.safe + ' / ' + a.total, icon: '🏃' },
        { label: STR.houses, value: a.intact + ' / ' + a.houses, icon: 'house' },
        lv.signs ? { label: STR.signs, value: a.signsReported + ' / ' + a.signsTotal, icon: '🔊' } : null,
        { label: STR.left, value: String(run.budget), icon: '🪙' },
        good ? { label: STR.good, value: '+' + T.score.goodCall, icon: 'star' } : null,
        { label: STR.pets, value: this.found.filter(Boolean).length + ' / 3', icon: '🐾' }
      ].filter(Boolean);
      if (stars >= 1) { AG.kit.celebrate(this.stage); AG.sfx.play('star'); }
      this.doneFn({
        won, stars, score, timeMs: Math.round(this.real * 1000), collectibles: this.found.slice(), detail,
        message: pick(stars >= 3 ? STR.msg3 : stars === 2 ? STR.msg2 : stars === 1 ? STR.msg1 : STR.msg0), badgeEvents: events, bonusXP: good ? 5 : 0, delay: 300
      });
    }
    destroy() {
      this.dead = true;
      if (this.stopLoop) this.stopLoop();
      this.build.exit(); this.rainPh.exit();
      AG.input.pointerMode('tap');
      if (this.summary) this.summary.remove();
      this.el.remove();
      if (SD.live && SD.live.scene === this) SD.live = null;
    }
  }

  Object.assign(SD, { STR, SlopeDefenseScene, label, dots, fmt });
})(window.AG);
