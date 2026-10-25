/* Water Ways: one pipe board.
 *
 *   const scene = new AG.waterWays.Scene(stage, ctx, { onEnd(run) })
 *   run: { stars, res, tests, rotations, par, leaksFixed, firstSolved, heat, … } → index.js
 *
 * A 480 × 270 canvas: the player's portrait left, the board (32 px cells, a TileMap with a
 * GridCursor) in the middle, the water budget right (supply, losses, and every destination's
 * icon with its numbers). The board starts scrambled from the level's stored solution
 * (AG.logic.waterFlow.scramble, seeded). FLOW runs the pure water model and fills the pipes
 * along the BFS order (about 2 s); leaks show their drips the first time water reaches them.
 * Three stars end the board; with fewer, ✔ Done ends it. Then the heat check (HeatCheck.js),
 * then the results. Every number is in tuning.js.
 *
 * Keys: arrows / WASD move · Space, Enter or R turns a pipe · E fixes the leak under the
 * cursor · F = FLOW · H hint · Q done. Touch / mouse: tap a pipe to turn it, tap 🔧 then a
 * leak, ▶ FLOW, 💡, ✔ Done. */
window.AG = window.AG || {};
(function (AG) {
  const { h } = AG.util;
  const WW = AG.waterWays, T = WW.tuning, R = WW.rules, WF = AG.logic.waterFlow, TL = WW.tiles;
  const S = (en, fil) => ({ en, fil });
  const C = T.cell;
  const LEFT = 96, MID = 264, PANEL = { x: 364, y: 10, w: 108 };
  const PORTRAIT = { x: 16, y: 14, w: 64, h: 64 };
  const STATUS = { met: '✅', partial: '⚠️', none: '❌' };

  const STR = {
    turns: S('Turns (par)', 'Ikot (par)'), par: S('par', 'par'), tests: S('Tests', 'Subok'),
    fix: S('Fix', 'Ayusin'), flow: S('FLOW', 'DALOY'), hint: S('Hint', 'Pahiwatig'), done: S('Done', 'Tapos na'), turn: S('Turn', 'Ikot'),
    water: S('Water', 'Tubig'), rain: S('Rain', 'Ulan'), leaks: S('Leaks', 'Tagas'), heat: S('Heat', 'Init'), saved: S('Saved', 'Natipid'),
    lastTest: S('last test', 'huling subok'), notYet: S('Press FLOW to test', 'Pindutin ang DALOY'),
    locked: S('That pipe is locked 🔒. Turn the others!', 'Nakakandado 🔒 ang tubong iyan. Ikutin ang iba!'),
    fixed: S('Fixed! No more drips there.', 'Naayos! Wala nang tulo diyan.'),
    noLeak: S("That pipe isn't leaking. Test the water to find the drips.", 'Hindi tumutulo ang tubong iyan. Subukan ang daloy para makita ang tulo.'),
    wrench: S('Now tap the leaking pipe.', 'Ngayon, i-tap ang tumutulong tubo.'),
    cross: S('A cross pipe joins all four sides: no need to turn it.', 'Nakakonekta sa apat na gilid ang krus na tubo: hindi na kailangang ikutin.'),
    still: S('Tanks, rain catchers and places stay where they are. Turn the pipes!', 'Hindi gumagalaw ang imbakan, saluhan at mga lugar. Ikutin ang mga tubo!'),
    perfect: S('Every drop counts — and you saved them all!', 'Mahalaga ang bawat patak — at natipid mo lahat!'),
    allButLeak: S('Everyone has water, but a pipe is still leaking. Fix it with 🔧 and test again!', 'May tubig na ang lahat, pero may tumutulo pa. Ayusin gamit ang 🔧 at subukan ulit!'),
    allButHeat: S('Everyone has water, but the open canals lose some to the heat. Try the covered canals!', 'May tubig na ang lahat, pero natutuyo ang tubig sa bukas na kanal. Subukan ang natatakpang kanal!'),
    leaksFound: S('Drip, drip! Leaks waste water. Fix them: E, or tap 🔧 then the leak.', 'Tulo, tulo! Nasasayang ang tubig sa tagas. Ayusin: E, o i-tap ang 🔧 saka ang tagas.'),
    dilute: S('The water is shared by every place it reaches. Drinking water first: leave a lower-priority place off for now.', 'Hinahati ang tubig sa lahat ng naaabot nito. Inuming tubig muna: huwag munang ikonekta ang hindi gaanong kailangan.'),
    noHouse: S('The house has no water yet. Connect the drinking water first!', 'Wala pang tubig ang bahay. Ikonekta muna ang inuming tubig!'),
    canals: S('Open canals lose water in the heat. Use the covered canals!', 'Natutuyo ang tubig sa bukas na kanal. Gamitin ang natatakpang kanal!'),
    save: S('Not enough water! Catch the rain, put the drip pipe on the field, and reuse the laundry water.', 'Kulang ang tubig! Saluhin ang ulan, ilagay ang tubong patak-patak sa palayan, at gamitin muli ang tubig-labahan.'),
    houseOk: S('The drinking water is OK! Now get water to the others.', 'Ayos na ang inuming tubig! Ngayon, padaluyin sa iba.'),
    short: S('Not enough water reached the house. Look where the water goes!', 'Kulang ang tubig sa bahay. Tingnan kung saan napupunta ang tubig!'),
    canDone: S('Happy with it? Press Q or tap ✔ Done.', 'Ayos na ba? Pindutin ang Q o i-tap ang ✔ Tapos na.'),
    hintTurn: S('Turn this pipe.', 'Ikutin ang tubong ito.'),
    hintLeak: S('This one is leaking: fix it!', 'Tumutulo ito: ayusin!'),
    hintNone: S('Looks good! Test the water with FLOW.', 'Mukhang ayos! Subukan ang daloy.'),
    noHints: S('No hints left. Follow the water from the tank to the house.', 'Wala nang pahiwatig. Sundan ang tubig mula sa imbakan papunta sa bahay.'),
    testCost: S('−20', '−20'),
    at: S('row {r}, column {c}', 'hilera {r}, hanay {c}'),
    needs: S('needs {n}', 'kailangan {n}'),
    has: S('has {n}', 'may {n}')
  };
  WW.STR = STR;

  /* ---------- styles, once per page (all under #ag-app, classes ww-) ---------- */
  const CSS = `
#ag-app .ww { display: grid; gap: 8px; justify-items: center; width: 100%; }
#ag-app .ww .ag-canvas { width: 100%; }
#ag-app .ww-tools { display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; align-items: center; }
#ag-app .ww-tools .ag-btn { min-height: 52px; min-width: 64px; }
#ag-app .ww-tool { display: inline-flex; gap: 4px; align-items: center; }
#ag-app .ww-tool[hidden] { display: none; }
#ag-app .ww-tools .ag-btn[aria-pressed="true"] { outline: 3px solid var(--vest); outline-offset: 2px; }
#ag-app .ww-tools .ag-btn.is-cue { outline: 3px dashed var(--vest); outline-offset: 2px; }
#ag-app .ww-heat .ag-box { max-width: 600px; }
#ag-app .ww-heatrow { display: flex; gap: 12px; align-items: center; flex-wrap: wrap; justify-content: center; }
#ag-app .ww-heatme { display: flex; gap: 6px; align-items: end; }
#ag-app .ww-heatface img { display: block; }
#ag-app .ww-heatgauge { position: relative; display: inline-block; width: 24px; height: 96px; }
#ag-app .ww-heatgauge img { position: relative; z-index: 1; }
#ag-app .ww-heatfill { position: absolute; z-index: 2; left: 8px; width: 8px; bottom: 20px; height: 60px; background: #e0245e; }
#ag-app .ww-heatq { flex: 1 1 260px; display: grid; gap: 6px; }
#ag-app .ww-heatq p { margin: 0; font-weight: 700; }
#ag-app .ww-heat .ag-choice.is-on { outline: 3px solid var(--vest); outline-offset: 1px; background: var(--panel-2); }
#ag-app .ww-heat .ag-choice.is-on .ag-txt::after { content: ' ✔'; }
#ag-app .ww-heatfoot { display: flex; gap: 10px; align-items: center; justify-content: center; flex-wrap: wrap; margin-top: 8px; }
@media (max-width: 520px) {
  #ag-app .ww-heatface img { width: 48px; height: auto; }
  #ag-app .ww-heatgauge { width: 12px; height: 48px; }
  #ag-app .ww-heatgauge img { width: 12px; height: 48px; }
  #ag-app .ww-heatfill { left: 4px; width: 4px; bottom: 10px; height: 30px; }
}
@media (prefers-reduced-motion: reduce) { #ag-app .ww-tools .ag-btn.is-cue { outline-style: solid; } }`;
  function injectCss() {
    if (!document.querySelector('style[data-ag-css="water-ways"]')) document.head.append(h('style', { 'data-ag-css': 'water-ways' }, CSS));
  }

  class Scene {
    constructor(stage, ctx, o) {
      injectCss();
      this.stage = stage; this.ctx = ctx; this.onEnd = o.onEnd;
      this.adv = ctx.difficulty === 'advanced';
      this.reduce = AG.reducedMotion();
      this.offs = []; this.lastHint = {};
      const entry = this.entry = ctx.levelData || {};
      this.level = entry.level || ctx.level;
      this.f = R.features(entry, this.level);
      const b = this.board = R.board(entry, ctx.difficulty);
      this.n = b.n;
      this.net = WF.network(b, T.flow);
      const sc = WF.scramble(b, ctx.seed, T.flow, R.checks(b));
      b.tiles.forEach((t, i) => { if (t) t.rot = sc.rots[i]; });
      this.par = sc.par;
      // the run
      this.rotations = 0; this.tests = 0; this.leaksFixed = 0; this.firstSolved = false; this.heat = false;
      this.hints = 0; this.hintsLeft = R.hints(ctx.difficulty);
      this.revealed = new Set(); this.last = null; this.lastStars = 0; this.stale = false; this.shown = null;
      this.anim = null; this.lock = null; this.wrench = false; this.hintAt = null; this.ended = false;
      this.state = b.tiles.map(() => 'empty');
      // layout (logical canvas px): portrait | board | water budget
      const bw = this.n * C;
      this.ox = LEFT + Math.floor((MID - bw) / 2);
      this.oy = Math.floor((270 - bw) / 2);
    }

    /* ---------- the board ---------- */
    idx(x, y) { return y * this.n + x; }
    tile(x, y) { return this.board.tiles[this.idx(x, y)]; }
    leakShown(i) { return this.revealed.has(i); }
    syncTile(i) {
      const t = this.board.tiles[i];
      if (t) this.map.set('pipes', i % this.n, Math.floor(i / this.n), TL.id(t, this.state[i], this.leakShown(i)));
    }
    describe(x, y) {
      const i = this.idx(x, y), t = this.board.tiles[i], name = TL.name(t, this.leakShown(i));
      const at = l => STR.at[l].replace('{r}', y + 1).replace('{c}', x + 1);
      const extra = l => {
        if (!t) return '';
        if (t.pad) return ' (' + TL.NAMES.locked[l] + ')';
        if (t.type === 'dest') { const d = this.last && this.last.dests.find(q => q.i === i); return ', ' + STR.needs[l].replace('{n}', d ? d.need : t.demand) + (d && !this.stale ? ', ' + STR.has[l].replace('{n}', d.got) : ''); }
        if (t.source) return ': ' + t.supply;
        return '';
      };
      return S(name.en + extra('en') + ', ' + at('en'), name.fil + extra('fil') + ', ' + at('fil'));
    }

    /* ---------- the DOM around the canvas ---------- */
    mount() {
      const stage = this.stage, ctx = this.ctx;
      this.view = AG.gfx.canvas(480, 270);
      const tool = (prompt, fn, cls) => {
        const b = h('button', { class: 'ag-btn ' + (cls || 'ag-btn--alt'), type: 'button', tabindex: '-1' });
        b.addEventListener('click', () => { fn(); stage.focus({ preventScroll: true }); });
        return { b, wrap: h('span', { class: 'ww-tool' }, AG.input.promptIcon(prompt), b) };
      };
      this.turnLabel = h('b', {});
      this.tools = {
        fix: tool({ keys: ['key_e'], gesture: 'gesture_tap' }, () => this.toggleWrench()),
        flow: tool({ keys: ['key_f'], gesture: 'gesture_tap' }, () => this.flow(), 'ww-flow'),
        hint: tool({ keys: ['key_h'], gesture: 'gesture_tap' }, () => this.useHint()),
        done: tool({ keys: ['key_q'], gesture: 'gesture_tap' }, () => this.done())
      };
      this.tools.fix.b.setAttribute('aria-pressed', 'false');
      this.tools.fix.wrap.hidden = !this.board.tiles.some(t => t && t.leak);
      this.tools.done.wrap.hidden = true;
      const turn = h('span', { class: 'ww-tool' }, AG.input.promptIcon({ keys: ['key_space', 'key_r'], gesture: 'gesture_tap' }), this.turnLabel);
      this.el = h('div', { class: 'ww' }, this.view.cv, h('div', { class: 'ww-tools' }, turn, ...Object.values(this.tools).map(t => t.wrap)));
      stage.append(this.el);
      AG.input.setView(this.view);
      AG.input.pointerMode('tap');

      // the board: dry soil (static) + the pipes, drawn at 1× with 32 px cells
      this.map = new AG.grid.TileMap({ w: this.n, h: this.n, tile: C, tiles: TL.tileset(), layers: ['floor', 'pipes'], staticLayers: ['floor'] });
      this.map.fill('floor', 'soil');
      this.board.tiles.forEach((t, i) => this.syncTile(i));
      this.cam = new AG.grid.Camera({ map: this.map, viewW: this.map.pw, viewH: this.map.ph, mode: 'fixed' });
      this.map.prepare();

      this.rig = ctx.rig('portrait', { height: T.bust });
      this.rig.play('idle');
      this.hud = ctx.hud({ score: '', scoreLabel: STR.turns, label: STR.tests });
      this.cursor = new AG.grid.GridCursor({
        w: this.n, h: this.n, cell: C, originX: this.ox, originY: this.oy, view: this.view, stage, mode: 'nearest',
        x: this.firstCell().x, y: this.firstCell().y,
        selectable: (x, y) => !!this.tile(x, y),
        describe: (x, y) => this.describe(x, y),
        onConfirm: (x, y, info) => this.act(x, y, info),
        onMove: () => { this.hintAt = null; }
      });
      const I = AG.input, on = (a, fn) => this.offs.push(I.on(a, fn));
      I.register('FLOW', { keys: ['KeyF'] });
      I.register('FIX', { keys: ['KeyE'] });
      I.register('DONE', { keys: ['KeyQ'] });
      on('ROTATE', e => { if (e.phase === 'down' && !this.lock && this.cursor.active) this.rotate(this.cursor.x, this.cursor.y); });
      on('FIX', e => { if (e.phase === 'down' && !this.lock) this.fix(this.cursor.x, this.cursor.y); });
      on('FLOW', e => { if (e.phase === 'down') this.flow(); });
      on('HINT', e => { if (e.phase === 'down') this.useHint(); });
      on('DONE', e => { if (e.phase === 'down') this.done(); });
      on('CANCEL', e => { if (e.phase === 'down' && this.wrench) this.toggleWrench(false); });
      this.offs.push(AG.on('kalasag:languagechange', () => { this.relabel(); if (this.heatCheck) this.heatCheck.relabel(); }));
      this.offs.push(() => this.cursor.destroy());
      AG.sfx.preload(['water-ways.sfx.rotate', 'water-ways.sfx.flow', 'water-ways.sfx.drip', 'water-ways.sfx.leak_fix']);
      ['water-ways.ui.lock', 'water-ways.ui.heat_meter', 'water-ways.fx.flow', 'water-ways.fx.shimmer'].forEach(k => AG.assets.image(k));

      this.relabel();
      this.stop = AG.gfx.loop(dt => this.frame(dt));
    }
    firstCell() {
      const i = this.board.tiles.findIndex(t => t && WF.rotatable(t));
      return { x: Math.max(0, i) % this.n, y: Math.floor(Math.max(0, i) / this.n) };
    }
    relabel() {
      const t = this.tools;
      this.turnLabel.textContent = '↻ ' + AG.pick(STR.turn);
      t.fix.b.textContent = '🔧 ' + AG.pick(STR.fix);
      t.flow.b.textContent = '▶ ' + AG.pick(STR.flow);
      t.hint.b.textContent = '💡 ' + AG.pick(STR.hint) + (Number.isFinite(this.hintsLeft) ? ' · ' + this.hintsLeft : '');
      t.hint.b.disabled = this.hintsLeft <= 0;
      t.done.b.textContent = '✔ ' + AG.pick(STR.done);
      const small = this.hud.el.querySelectorAll('.ag-stat small');
      if (small[0]) small[0].textContent = AG.pick(STR.turns);
      if (small[1]) small[1].textContent = AG.pick(STR.tests);
      this.updateHud();
    }
    updateHud() {
      this.hud.set({ score: this.rotations + ' (' + this.par + ')', label: String(this.tests) });
    }
    /** A short pose, then back to idle. */
    react(action, ms) {
      this.rig.play(action, { restart: true });
      clearTimeout(this.reactT);
      if (ms) this.reactT = setTimeout(() => { if (!this.ended && !this.anim) this.rig.play('idle'); }, ms);
    }

    /* ---------- turning, fixing ---------- */
    act(x, y, info) {
      if (this.lock) return;
      if (this.wrench) { this.fix(x, y); return; }
      this.rotate(x, y, info);
    }
    rotate(x, y) {
      if (this.lock) return;
      const i = this.idx(x, y), t = this.board.tiles[i];
      if (!t) return;
      if (t.locked) {
        AG.sfx.play('soft');
        this.lockShake = { i, until: performance.now() + 300 };
        this.hint('locked', t.pad ? 'instruction' : 'info', t.pad ? STR.locked : STR.still);
        return;
      }
      if (WF.period(t) === 1) { this.hint('cross', 'info', STR.cross); return; }
      t.rot = (t.rot + 1) % 4;
      this.rotations++;
      AG.sfx.play('water-ways.sfx.rotate');
      this.react('think', T.thinkMs);
      this.changed();
      this.syncTile(i);
      this.cursor.set(x, y); // the live region reads the turned pipe
      this.updateHud();
    }
    toggleWrench(on) {
      if (this.lock) return;
      this.wrench = on != null ? on : !this.wrench;
      this.tools.fix.b.setAttribute('aria-pressed', String(this.wrench));
      AG.input.armCancel(this.wrench);
      if (this.wrench) this.hint('wrench', 'instruction', STR.wrench, 4000);
    }
    fix(x, y) {
      if (this.lock) return;
      const i = this.idx(x, y), t = this.board.tiles[i];
      if (!t || !t.leak || t.fixed || !this.revealed.has(i)) { AG.sfx.play('soft'); this.hint('noleak', 'instruction', STR.noLeak); return; }
      t.fixed = true;
      this.leaksFixed++;
      AG.store.update('stats', s => { const w = s.waterWays = s.waterWays || {}; w.leaks = (w.leaks || 0) + 1; });
      AG.sfx.play('water-ways.sfx.leak_fix');
      this.ctx.safe();
      this.popCell(x, y, '+' + T.points.leak, true);
      this.say('success', STR.fixed, { sound: false });
      this.react('happy', 900);
      if (this.wrench) this.toggleWrench(false);
      this.changed();
      this.syncTile(i);
    }
    /** The board changed since the last test: the pipes run dry until the next FLOW. */
    changed() {
      this.hintAt = null;
      if (this.last) this.stale = true;
      if (!this.shown) return;
      this.shown = null;
      this.state.fill('empty');
      this.board.tiles.forEach((t, i) => this.syncTile(i));
    }

    /* ---------- FLOW ---------- */
    flow() {
      if (this.lock || this.ended) return;
      if (this.wrench) this.toggleWrench(false);
      this.tests++;
      const res = WF.simulate(this.board, null, T.flow);
      this.last = res; this.stale = false;
      this.lastStars = R.stars(this.board, res);
      if (this.tests === 1 && R.solved(this.board, res)) this.firstSolved = true;
      if (this.tests > 1 && R.tests(this.ctx.difficulty) > 0) this.popAt(PANEL.x + 40, PANEL.y + 4, '−' + R.tests(this.ctx.difficulty), false);
      this.updateHud();
      AG.sfx.play('water-ways.sfx.flow');
      this.rig.play('idle');
      // fill along the BFS order, then the greywater
      const dist = new Map(res.order.map(e => [e.i, e.dist]));
      const greyMax = Math.max(-1, ...res.greyDist.values());
      const steps = res.maxDist + 1 + (res.greyWet.size ? greyMax + 1 : 0);
      this.shown = null; this.state.fill('empty');
      this.board.tiles.forEach((t, i) => this.syncTile(i));
      this.anim = { t: 0, res, dist, steps, stepMs: T.fillMs / Math.max(1, steps), k: -1, dripped: false };
      this.lock = 'flow'; this.cursor.active = false;
    }
    stepAnim(dt) {
      const a = this.anim;
      a.t += this.reduce ? T.fillMs : dt * 1000;
      const k = Math.min(a.steps - 1, Math.floor(a.t / a.stepMs));
      if (k !== a.k) {
        a.k = k;
        const fresh = a.res.maxDist + 1;
        a.res.wet.forEach(i => {
          if (this.state[i] === 'full' || a.dist.get(i) > k) return;
          this.state[i] = 'full';
          const t = this.board.tiles[i];
          if (t.leak && !t.fixed && !this.revealed.has(i)) { this.revealed.add(i); a.newLeaks = true; if (!a.dripped) { a.dripped = true; AG.sfx.play('water-ways.sfx.drip'); } }
          this.syncTile(i);
        });
        a.res.greyWet.forEach(i => { if (this.state[i] !== 'full' && fresh + a.res.greyDist.get(i) <= k) { this.state[i] = 'full'; this.syncTile(i); } });
      }
      if (a.t >= T.fillMs) this.animDone();
    }
    animDone() {
      const a = this.anim, res = a.res;
      this.anim = null; this.lock = null; this.shown = res;
      this.cursor.active = true;
      const stars = this.lastStars, ds = res.dests;
      const house = ds.find(d => d.kind === 'house');
      const targets = R.targets(this.board, res);
      const extra = ds.some(d => d.connected && !targets.includes(d));
      const leaky = res.leaks.length > 0, hot = res.lost.evap > 0;
      this.tools.done.wrap.hidden = stars < 1;
      if (stars === 3) {
        this.react('cheer');
        AG.sfx.play('good');
        AG.kit.celebrate(this.stage);
        this.say('congratulations', STR.perfect, { sound: false });
        this.lock = 'won'; this.cursor.active = false;
        this.ctx.after(1700, () => { if (!this.dead) this.finishBoard(); });
        return;
      }
      if (stars === 2) {
        this.react('cheer', 1400);
        this.say(leaky ? 'warning' : 'info', leaky ? STR.allButLeak : hot ? STR.allButHeat : STR.canDone);
      } else if (stars === 1) {
        this.react('happy', 1400);
        if (a.newLeaks || leaky) this.say('warning', STR.leaksFound);
        else if (extra) this.say('info', STR.dilute);
        else if (hot) this.say('info', STR.canals);
        else if (this.f.drip || this.f.grey || this.f.rain) this.say('info', STR.save);
        else this.say('encouragement', STR.houseOk);
      } else {
        this.react('worried');
        if (a.newLeaks) this.say('warning', STR.leaksFound); // the first drips matter more than the rest
        else if (!house || !house.connected) this.say('retry', STR.noHouse);
        else if (leaky) this.say('warning', STR.leaksFound);
        else if (extra) this.say('info', STR.dilute);
        else if (hot) this.say('info', STR.canals);
        else if (this.f.drip || this.f.grey || this.f.rain) this.say('info', STR.save);
        else this.say('retry', STR.short);
      }
      if (stars >= 1) this.ctx.after(3200, () => { if (!this.dead && !this.ended && !this.anim && this.lastStars < 3) this.hint('done', 'instruction', STR.canDone, 20000); });
    }

    /* ---------- hints ---------- */
    useHint() {
      if (this.lock || this.ended) return;
      if (this.hintsLeft <= 0) { this.hint('nohint', 'instruction', STR.noHints); return; }
      const B = this.board;
      let pick = null, kind = 'turn';
      const cx = this.cursor.x, cy = this.cursor.y, dist = i => Math.abs(i % this.n - cx) + Math.abs(Math.floor(i / this.n) - cy);
      const leaks = [...this.revealed].filter(i => !B.tiles[i].fixed && this.net.has(i));
      if (leaks.length) { pick = leaks.sort((a, b) => dist(a) - dist(b))[0]; kind = 'leak'; }
      else {
        const wrong = B.tiles.map((t, i) => i).filter(i => WF.rotatable(B.tiles[i]) && this.net.has(i) && WF.turns(B.tiles[i], B.tiles[i].rot, B.tiles[i].sol) > 0);
        if (wrong.length) pick = wrong.sort((a, b) => dist(a) - dist(b))[0];
      }
      if (pick == null) { this.say('info', STR.hintNone); return; }
      this.hints++; this.hintsLeft--;
      const x = pick % this.n, y = Math.floor(pick / this.n);
      this.cursor.set(x, y, { via: 'key' });
      this.hintAt = { i: pick, kind };
      AG.sfx.play('blip');
      this.say('info', kind === 'leak' ? STR.hintLeak : STR.hintTurn, { sound: false });
      this.relabel();
    }

    /* ---------- the end ---------- */
    done() {
      if (this.lock || this.ended || !this.last || this.lastStars < 1) return;
      this.finishBoard();
    }
    finishBoard() {
      if (this.ended) return;
      this.ended = true; this.lock = 'heat'; this.cursor.active = false; this.hintAt = null;
      if (this.wrench) this.toggleWrench(false);
      this.tools.done.wrap.hidden = true;
      this.heatCheck = new WW.HeatCheck(this.stage, this.ctx, {
        rig: this.rig, seed: this.ctx.seed,
        onDone: perfect => { this.heat = perfect; this.heatCheck.destroy(); this.heatCheck = null; this.finish(); }
      });
    }
    finish() {
      if (this.last.greyUsed) AG.store.update('stats', s => { const w = s.waterWays = s.waterWays || {}; w.grey = (w.grey || 0) + 1; });
      this.rig.play(this.lastStars === 3 ? 'cheer' : 'happy');
      this.onEnd({
        level: this.level, mode: this.ctx.mode, difficulty: this.ctx.difficulty, board: this.board, res: this.last, stars: this.lastStars,
        tests: this.tests, rotations: this.rotations, par: this.par, leaksFixed: this.leaksFixed, firstSolved: this.firstSolved,
        heat: this.heat, hints: this.hints, usedMs: performance.now() - this.t0
      });
    }

    /* ---------- feedback helpers ---------- */
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
    popAt(x, y, text, good) {
      const r = this.stage.getBoundingClientRect(), c = this.view.cv.getBoundingClientRect(), k = c.width / 480;
      AG.kit.pop(this.stage, Math.round(c.left - r.left + x * k), Math.round(c.top - r.top + y * k), text, good);
    }
    popCell(x, y, text, good) { this.popAt(this.ox + x * C + C / 2, this.oy + y * C, text, good); }

    /* ---------- the frame ---------- */
    frame(dt) {
      if (this.t0 == null) this.t0 = performance.now();
      if (this.anim) this.stepAnim(dt);
      this.draw();
    }
    draw() {
      const g = this.view.ctx, now = performance.now(), t = now / 1000, n = this.n, bw = n * C;
      AG.gfx.sky(g, 480, 270, ['#f7dc9c', '#f2cf8a', '#ecc27a', '#e5b56c']);
      // the board
      g.fillStyle = '#1e1538'; g.fillRect(this.ox - 4, this.oy - 4, bw + 8, bw + 8);
      g.save(); g.translate(this.ox, this.oy);
      this.cam.begin(g); this.map.draw(g, this.cam, t, ['floor', 'pipes']); this.cam.end(g);
      g.restore();
      this.drawOverlays(g, t, now);
      if (this.hintAt) this.drawHint(g, t);
      if (!this.lock) this.cursor.draw(g, t);
      this.drawPortrait(g, t);
      this.drawPanel(g, t);
    }
    cellXY(i) { return { x: this.ox + (i % this.n) * C, y: this.oy + Math.floor(i / this.n) * C }; }
    drawOverlays(g, t, now) {
      const B = this.board, frame4 = this.reduce ? 0 : Math.floor(t * 6) % 4;
      B.tiles.forEach((tile, i) => {
        if (!tile) return;
        const { x, y } = this.cellXY(i);
        if (tile.type === 'canal' && tile.open && this.f.heat) AG.assets.draw(g, 'water-ways.fx.shimmer', x, y, C, C, frame4);
        if (this.anim && this.state[i] === 'full' && this.anim.dist.get(i) === this.anim.k) AG.assets.draw(g, 'water-ways.fx.flow', x, y, C, C, frame4);
        if (tile.type === 'dest') this.drawDest(g, tile, i, x, y);
        if (tile.source) {
          const sup = String(tile.supply);
          AG.gfx.text(g, sup, x + C - 2, y + C - 12, { size: 10, color: '#ffffff', outline: '#1e1538', align: 'right', bold: true });
        }
        if (tile.pad) {
          const dx = this.lockShake && this.lockShake.i === i && now < this.lockShake.until && !this.reduce ? (Math.floor(t * 40) % 2 ? 1 : -1) : 0;
          AG.assets.draw(g, 'water-ways.ui.lock', x + C - 13 + dx, y + 1, 12, 12);
        }
        if (tile.leak && this.revealed.has(i)) {
          if (tile.fixed) { g.fillStyle = '#1e1538'; this.band(g, tile, x, y); }
          else {
            if (this.state[i] === 'full') { // falling drops beside the crack
              const k = this.reduce ? 0 : Math.floor(t * 8) % 8;
              g.fillStyle = '#6ed8ff'; g.fillRect(x + 25, y + 18 + k, 2, 3); g.fillRect(x + 7, y + 12 + ((k + 4) % 8), 2, 3);
            }
            if (this.wrench) this.outline(g, x, y, C, C, Math.floor(t * 3) % 2 ? '#ffd23f' : '#1e1538');
          }
        }
      });
    }
    /** A fixed leak gets a wrapped band across the pipe. */
    band(g, tile, x, y) {
      const across = tile.rot % 2 === 0; // a vertical pipe gets a horizontal band
      g.fillStyle = '#1e1538';
      if (across) { g.fillRect(x + 9, y + 13, 14, 6); g.fillStyle = '#ffd23f'; g.fillRect(x + 10, y + 14, 12, 4); }
      else { g.fillRect(x + 13, y + 9, 6, 14); g.fillStyle = '#ffd23f'; g.fillRect(x + 14, y + 10, 4, 12); }
    }
    drawDest(g, tile, i, x, y) {
      g.drawImage(AG.pixelIcon(TL.ICON[tile.kind], 18, true), x + 7, y + 8);
      // the laundry's grey outlet and the field's grey inlet: little brown stubs
      [tile.out, tile.greyIn].forEach(d => {
        if (d == null) return;
        g.fillStyle = '#1e1538';
        const r = [[x + 11, y, 10, 4], [x + C - 4, y + 11, 4, 10], [x + 11, y + C - 4, 10, 4], [x, y + 11, 4, 10]][d];
        g.fillRect(r[0], r[1], r[2], r[3]); g.fillStyle = '#9b8457'; g.fillRect(r[0] + 1, r[1] + 1, r[2] - 2, r[3] - 2);
      });
      const d = this.shown && this.shown.dests.find(q => q.i === i);
      if (d) g.drawImage(AG.pixelIcon(d.met ? STATUS.met : d.partial ? STATUS.partial : STATUS.none, 12, true), x + C - 13, y + 1);
    }
    drawHint(g, t) {
      const { x, y } = this.cellXY(this.hintAt.i), bob = this.reduce ? 0 : Math.floor(t * 3) % 2;
      this.outline(g, x - 1, y - 1, C + 2, C + 2, '#ffd23f');
      AG.gfx.drawIcon(g, 'bulb', x + C - 8, y - 12 - bob, 1);
    }
    outline(g, x, y, w, hh, color) {
      g.fillStyle = color; g.fillRect(x, y, w, 2); g.fillRect(x, y + hh - 2, w, 2); g.fillRect(x, y, 2, hh); g.fillRect(x + w - 2, y, 2, hh);
    }
    drawPortrait(g, t) {
      const P = PORTRAIT;
      g.fillStyle = '#1e1538'; g.fillRect(P.x - 2, P.y - 2, P.w + 4, P.h + 4);
      g.fillStyle = '#fff6e0'; g.fillRect(P.x, P.y, P.w, P.h);
      g.fillStyle = AG.chars.get(this.ctx.characterId).color; g.fillRect(P.x, P.y + P.h - 6, P.w, 6);
      g.save(); g.beginPath(); g.rect(P.x, P.y, P.w, P.h); g.clip();
      this.rig.draw(g, P.x + P.w / 2, P.y + P.h - 6, t);
      g.restore();
      if (this.f.heat) {
        AG.gfx.text(g, STR.heat, P.x + P.w / 2, P.y + P.h + 8, { size: 10, align: 'center', bold: true });
        const mx = P.x + P.w / 2 - 12, my = P.y + P.h + 22;
        AG.assets.draw(g, 'water-ways.ui.heat_meter', mx, my, 24, 96);
        g.fillStyle = '#e0245e'; g.fillRect(mx + 8, my + 16, 8, 60); // the tube is hot almost to the top
      }
    }
    drawPanel(g, t) {
      const P = PANEL, B = this.board, res = this.last, fade = this.stale;
      const rows = [];
      const base = B.tiles.filter(x => x && x.source && x.type !== 'rain').reduce((s, x) => s + x.supply, 0);
      const rains = B.tiles.filter(x => x && x.type === 'rain').length;
      rows.push({ icon: 'water', text: AG.pick(STR.water) + ' ' + base });
      if (rains) rows.push({ emoji: '🌧️', text: AG.pick(STR.rain) + ' +' + (res && !fade ? res.rain * T.flow.rain : rains * T.flow.rain) });
      if (res && !fade && res.lost.leak) rows.push({ emoji: '🔧', text: AG.pick(STR.leaks) + ' −' + res.lost.leak, bad: true });
      if (res && !fade && res.lost.evap) rows.push({ emoji: '☀️', text: AG.pick(STR.heat) + ' −' + res.lost.evap, bad: true });
      const ph = 24 + rows.length * 18 + B.tiles.filter(x => x && x.type === 'dest').length * 24 + 30;
      g.fillStyle = '#1e1538'; g.fillRect(P.x - 2, P.y - 2, P.w + 4, ph + 4);
      g.fillStyle = '#fff6e0'; g.fillRect(P.x, P.y, P.w, ph);
      let y = P.y + 6;
      rows.forEach(r => {
        if (r.icon) AG.gfx.drawIcon(g, r.icon, P.x + 4, y - 3, 1); else g.drawImage(AG.pixelIcon(r.emoji, 14, true), P.x + 6, y - 1);
        AG.gfx.text(g, r.text, P.x + 26, y, { size: 10, bold: true, color: r.bad ? '#b0103f' : '#1e1538' });
        y += 18;
      });
      g.fillStyle = '#1e1538'; g.fillRect(P.x + 4, y, P.w - 8, 1); y += 6;
      const dests = B.tiles.map((x, i) => (x && x.type === 'dest' ? i : -1)).filter(i => i >= 0).sort((a, b) => B.tiles[a].priority - B.tiles[b].priority);
      dests.forEach(i => {
        const tile = B.tiles[i], d = res && res.dests.find(q => q.i === i);
        g.drawImage(AG.pixelIcon(TL.ICON[tile.kind], 18, true), P.x + 4, y);
        const need = d ? d.need : tile.demand;
        AG.gfx.text(g, (d ? d.got : '–') + ' / ' + need, P.x + 28, y + 4, { size: 12, bold: true, color: fade ? '#7a6f8f' : '#1e1538' });
        if (d && !fade) g.drawImage(AG.pixelIcon(d.met ? STATUS.met : d.partial ? STATUS.partial : STATUS.none, 12, true), P.x + P.w - 18, y + 3);
        y += 24;
      });
      g.fillStyle = '#1e1538'; g.fillRect(P.x + 4, y, P.w - 8, 1); y += 6;
      if (res && !fade) AG.gfx.text(g, AG.pick(STR.saved) + ' ' + res.unused, P.x + 6, y + 2, { size: 10, bold: true });
      else AG.gfx.text(g, res ? '(' + AG.pick(STR.lastTest) + ')' : AG.pick(STR.notYet), P.x + 6, y + 2, { size: 10, color: '#5a4f6f' });
    }

    /** ?debug=1: set every tile to the stored solution and fix every leak (scripted checks). */
    debugSolve() {
      this.board.tiles.forEach((t, i) => { if (t) { t.rot = t.sol; if (t.leak) { t.fixed = true; this.revealed.add(i); } } });
      this.changed(); this.board.tiles.forEach((t, i) => this.syncTile(i));
    }

    destroy() {
      this.dead = true;
      clearTimeout(this.reactT);
      if (this.stop) this.stop();
      if (this.heatCheck) this.heatCheck.destroy();
      this.offs.forEach(f => f()); this.offs = [];
      if (this.el) this.el.remove();
    }
  }

  WW.Scene = Scene;
})(window.AG);
