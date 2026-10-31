/* 04 Slope Defense: the RAIN phase. The model (Slope.js) runs the rain on a sim Timeline: mud, signs, big slides, villagers. This file is the
 * lookout's side: the reticle (arrows, Shift = slow; Enter reports the sign under it; E = EVACUATE), taps on signs, the night flashlight that
 * follows the reticle or your finger, the rain overlay and the warning signs drawn on the map, and the radio / megaphone lines. */
window.AG = window.AG || {};
(function (AG) {
  const SD = AG.slopeDefense, T = SD.tuning, R = SD.rules, STR = () => SD.STR, pick = v => AG.pick(v);
  const W = T.W, H = T.H, INK = '#1e1538', GOLD = '#ffd23f';

  class RainPhase {
    constructor(scene) { this.sc = scene; this.offs = []; this.ret = { x: 0, y: 0, hold: 0 }; this.target = null; this.ghosts = []; this.said = new Set(); this.nSafe = 0; this.backAt = 0; this.loop = null; }

    enter() {
      const sc = this.sc, sim = sc.sim, post = R.tileCentre(sc.lv.watchPost.tx, sc.lv.watchPost.ty), S = STR();
      this.ret = { x: post.x, y: post.y, hold: 0 }; this.target = null; this.ghosts = []; this.said = new Set(); this.nSafe = 0;
      const on = (type, f) => this.offs.push(sim.on(type, f));
      on('band', b => { sc.say('info', S.band[b], 'hold:radio'); sc.refreshHud(); });
      on('sign', s => { AG.sfx.play('blip'); if (s.type === 'rumble') sc.toast({ en: '🔊 Rumbling…' }, 2); });
      on('report', s => this.onReport(s));
      on('missed', s => this.ghosts.push({ s, t: sc.real }));
      on('evacuate', e => this.onEvac(e));
      on('safe', v => { v.x = sc.lv.safeZone.x - 18 + (this.nSafe % 4) * 9; v.y = 258 - Math.floor(this.nSafe / 4) * 9; this.nSafe++; sc.refreshHud(); });
      on('slide', () => { AG.sfx.play(T.sfx[3]); if (!sc.reduce) AG.kit.shake(sc.box); sc.toast(S.slideSay, 3); });
      on('held', () => { AG.sfx.play('good'); if (!this.said.has('held')) { this.said.add('held'); sc.ctx.say('success', S.heldSay); } });
      on('muddy', () => { if (!this.said.has('muddy')) { this.said.add('muddy'); sc.toast(S.muddySay, 3.6); } });
      on('waiting', () => {});
      on('end', () => sc.onWaveEnd());
      sim.start();
      sc.rig.play('think'); sc.setPortrait('think');
      const k = AG.input.on.bind(AG.input);
      const key = (a, f) => this.offs.push(k(a, e => { if (e.phase === 'down' && sc.phase === 'rain' && !sc.finished) f(e); }));
      key('CONFIRM', () => this.act());
      key('EVAC', () => this.evacuate());
      this.offs.push(AG.input.onPointer('tap', p => this.tap(p)));
      if (sc.night) ['down', 'move', 'drag'].forEach(type => this.offs.push(AG.input.onPointer(type, p => { if (sc.phase === 'rain') this.target = { x: p.x, y: p.y }; })));
      AG.input.pointerMode(sc.night ? 'follow' : 'tap');
      this.loop = AG.sfx.loop(T.sfx[4], { volume: 0.5 });
      sc.refreshGo();
    }
    exit() {
      this.offs.forEach(f => f()); this.offs = [];
      if (this.loop) { this.loop.stop(); this.loop = null; }
      this.sc.ctx && AG.input.pointerMode('tap');
    }

    /* ---------- actions ---------- */
    lit(x, y) { return !this.sc.night || Math.hypot(x - this.ret.x, y - this.ret.y) <= this.sc.D.light; }
    signNear(x, y, pad) {
      let best = null, bd = Infinity;
      this.sc.sim.visibleSigns().forEach(s => { const d = Math.hypot(s.x - x, s.y - y); if (d <= T.hit.r + pad && d < bd && this.lit(s.x, s.y)) { best = s; bd = d; } });
      return best;
    }
    act() {
      const sc = this.sc, s = this.signNear(this.ret.x, this.ret.y, 0);
      if (s) { sc.sim.report(s.id); return; }
      if (sc.takePet(sc.petAt(this.ret.x, this.ret.y))) return;
      AG.sfx.play('soft');
    }
    tap(p) {
      const sc = this.sc;
      if (sc.phase !== 'rain' || sc.finished) return;
      if (sc.night) this.target = { x: p.x, y: p.y };
      const s = this.signNear(p.x, p.y, T.hit.pad);
      if (s) { sc.sim.report(s.id); return; }
      sc.takePet(sc.petAt(p.x, p.y));
    }
    onReport(s) {
      const sc = this.sc, sim = sc.sim, S = STR();
      AG.sfx.play(T.sfx[1]);
      sc.rig.play('alert'); sc.setPortrait('alert'); this.backAt = sc.real + 1.3;
      sc.toast({ en: pick(SD.FACTS[s.type]) }, 4.2);
      sc.pop('+' + T.alert.add, s.x, s.y - 14, true);
      sc.ctx.safe(1);
      if (sim.alert >= T.alert.good && !this.said.has('alert')) { this.said.add('alert'); sc.ctx.after(900, () => sc.say('warning', S.alertHigh, 'hold:radio')); }
      sc.refreshHud();
    }
    evacuate() {
      const sc = this.sc;
      if (sc.phase !== 'rain' || sc.finished) return null;
      return sc.sim.evacuate();
    }
    onEvac(e) {
      const sc = this.sc, S = STR();
      AG.sfx.play(T.sfx[2]);
      sc.say('warning', S.evacSay, 'hold:megaphone');
      sc.rig.play('cheer'); sc.setPortrait('cheer'); this.backAt = 0;
      if (e.good) sc.ctx.after(1400, () => sc.ctx.say('success', S.goodSay));
      sc.ctx.safe(1);
      sc.refreshGo(); sc.refreshHud();
    }

    /* ---------- each frame ---------- */
    update(dt) {
      const sc = this.sc, sim = sc.sim, IN = AG.input;
      const dx = (IN.isDown('RIGHT') ? 1 : 0) - (IN.isDown('LEFT') ? 1 : 0), dy = (IN.isDown('DOWN') ? 1 : 0) - (IN.isDown('UP') ? 1 : 0);
      if (dx || dy) { this.target = null; R.reticleStep(this.ret, dx, dy, IN.isDown('FINE'), dt); }
      else {
        this.ret.hold = 0;
        if (this.target) { // a finger or a mouse follows no faster than the keyboard does
          const ddx = this.target.x - this.ret.x, ddy = this.target.y - this.ret.y, d = Math.hypot(ddx, ddy), step = T.reticle.max * dt;
          if (d <= step) { this.ret.x = this.target.x; this.ret.y = this.target.y; } else { this.ret.x += ddx / d * step; this.ret.y += ddy / d * step; }
        }
      }
      sim.update(dt);
      if (this.backAt && sc.real > this.backAt) { this.backAt = 0; if (!sim.evac) { sc.rig.play('think'); sc.setPortrait('think'); } }
      const rainNow = R.bandOf(sim.rain);
      if (rainNow !== this.lastBand || Math.abs(sim.rain - (this.lastRain || 0)) > 0.01) { this.lastBand = rainNow; this.lastRain = sim.rain; sc.refreshHud(); }
      this.ghosts = this.ghosts.filter(g => sc.real - g.t < 0.7);
    }

    /* ---------- drawing ---------- */
    draw(c, t) {
      const sc = this.sc, sim = sc.sim, band = R.bandOf(sim.rain), keys = AG.input.lastDevice === 'keyboard';
      this.drawSigns(c, sim, t);
      this.drawRain(c, band, t);
      if (sc.dark) sc.dark.draw(c, { lights: [{ x: Math.round(this.ret.x), y: Math.round(this.ret.y), r: sc.D.light }], t });
      if (sc.night) this.drawLit(c, sim, t);
      if (keys || sc.night) this.drawReticle(c, sim, t);
    }
    /** Signs that are in the dark stay hidden; the ones inside the light are redrawn on top of the dark. */
    drawSigns(c, sim, t) {
      const sc = this.sc, size = sc.D.signSize;
      const one = (s, alpha) => {
        const x = Math.round(s.x - size / 2), y = Math.round(s.y - size / 2);
        c.save(); c.globalAlpha = alpha;
        AG.assets.draw(c, T.art.sign(s.type), x, y, size, size);
        if (sc.D.outline) { const k = sc.reduce ? 0 : Math.floor(t * 3) % 2; c.fillStyle = k ? '#fff8e6' : GOLD; c.fillRect(x - 1, y - 1, size + 2, 1); c.fillRect(x - 1, y + size, size + 2, 1); c.fillRect(x - 1, y - 1, 1, size + 2); c.fillRect(x + size, y - 1, 1, size + 2); }
        if (s.type === 'rumble') { AG.gfx.drawIcon(c, '🔊', Math.round(s.x - 28), y + size + 1, 1); SD.label(c, 'Rumbling', Math.round(s.x - 8), y + size + 5, { size: 10 }); }
        c.restore();
      };
      if (sc.night) return;
      sim.signs.forEach(s => { if (s.state === 'visible') one(s, Math.max(0.4, Math.min(1, (s.at + s.vis - sim.tl.t) / 1500))); });
      this.ghosts.forEach(g => one(g.s, 0.5 * (1 - (sc.real - g.t) / 0.7)));
    }
    drawLit(c, sim, t) {
      const sc = this.sc, size = sc.D.signSize;
      sim.signs.forEach(s => {
        if (s.state !== 'visible' || !this.lit(s.x, s.y)) return;
        const x = Math.round(s.x - size / 2), y = Math.round(s.y - size / 2);
        AG.assets.draw(c, T.art.sign(s.type), x, y, size, size);
        if (sc.D.outline) { const k = sc.reduce ? 0 : Math.floor(t * 3) % 2; c.fillStyle = k ? '#fff8e6' : GOLD; c.fillRect(x - 1, y - 1, size + 2, 1); c.fillRect(x - 1, y + size, size + 2, 1); c.fillRect(x - 1, y - 1, 1, size + 2); c.fillRect(x + size, y - 1, 1, size + 2); }
        if (s.type === 'rumble') { AG.gfx.drawIcon(c, '🔊', Math.round(s.x - 28), y + size + 1, 1); SD.label(c, 'Rumbling', Math.round(s.x - 8), y + size + 5, { size: 10 }); }
      });
      if (sim.signs.some(s => s.state === 'visible' && !this.lit(s.x, s.y)) && !sc.reduce && Math.floor(t * 2) % 2) SD.label(c, '🔦 ?', W / 2, 24, { size: 10, align: 'center', color: GOLD });
    }
    drawRain(c, band, t) {
      const sc = this.sc, n = [24, 48, 84][band] >> (sc.reduce ? 1 : 0), shift = sc.reduce ? 0 : t * (70 + band * 40);
      c.fillStyle = 'rgba(30,21,56,' + [0.05, 0.12, 0.2][band] + ')'; c.fillRect(0, 0, W, H);
      c.fillStyle = 'rgba(200,222,255,.6)';
      for (let i = 0; i < n; i++) {
        const x = (i * 97 + (i * i * 13) % 61) % W, y = Math.floor(((i * 53 + (i * 29) % 37) % H + shift) % H);
        c.fillRect(x, y, 1, 5 + band * 2); c.fillRect(x - 1, y + 5 + band * 2, 1, 1);
      }
    }
    drawReticle(c, sim, t) {
      const x = Math.round(this.ret.x), y = Math.round(this.ret.y), s = this.signNear(this.ret.x, this.ret.y, 0), on = !!s || this.sc.petAt(this.ret.x, this.ret.y) >= 0;
      const col = on ? '#7ee08a' : GOLD;
      [[-9, -1, 5, 3], [5, -1, 5, 3], [-1, -9, 3, 5], [-1, 5, 3, 5]].forEach(([dx, dy, w, h]) => { c.fillStyle = INK; c.fillRect(x + dx - 1, y + dy - 1, w + 2, h + 2); });
      [[-9, 0, 5, 1], [5, 0, 5, 1], [0, -9, 1, 5], [0, 5, 1, 5]].forEach(([dx, dy, w, h]) => { c.fillStyle = col; c.fillRect(x + dx, y + dy, w, h); });
      c.fillStyle = col; c.fillRect(x, y, 1, 1);
      if (s) { AG.sim.draw.brackets(c, s.x - 13, s.y - 13, 26, 26, { color: '#7ee08a' }); SD.label(c, 'Enter', Math.round(s.x), Math.round(s.y) - 28, { size: 10, align: 'center', color: '#7ee08a' }); }
    }
  }

  SD.RainPhase = RainPhase;
})(window.AG);
