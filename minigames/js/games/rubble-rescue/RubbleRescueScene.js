/* Rubble Rescue: one trapped-pocket puzzle.
 *
 *   const scene = new AG.rubbleRescue.Scene(stage, ctx, { onEnd(run) })
 *   run: { escaped, moves, par, energy, knocks, … } → index.js turns it into done()
 *
 * First "Spot the warning" (a DOM question over the stage, 10 s), then the board: a canvas
 * (480 × 270) with the rubble on a 32 px grid, the player's bust in the pocket left of the
 * escape row, and the role expert with a flashlight at the exit gap right of it. The pure
 * solver (AG.logic.rubbleSolver) gives the par, the hints and the safe aftershocks; knock
 * rounds are Knock.js; every number is in tuning.js.
 *
 * Keys: arrows (or Tab) choose a block, the mask, the match or a photo · Enter grabs a block ·
 * arrows slide it along its axis · Enter drops it (Esc puts it back) · Space knocks on the pipe ·
 * H hint · Backspace undo (Easy). Touch / mouse: drag a block along its axis (it snaps per
 * cell), tap the mask, the match or a photo, tap the pipe (or 🔔) to knock. */
window.AG = window.AG || {};
(function (AG) {
  const { h } = AG.util;
  const RR = AG.rubbleRescue, T = RR.tuning, R = RR.rules, SV = AG.logic.rubbleSolver;
  const S = (en, fil) => ({ en, fil });
  const C = T.cell;
  const VEC = { up: [0, -1], right: [1, 0], down: [0, 1], left: [-1, 0] };
  const AXIS_DIRS = { h: ['left', 'right'], v: ['up', 'down'] };
  const ARROW = { up: '⬆️', down: '⬇️', left: '⬅️', right: '➡️' };

  const STR = {
    moves: S('Moves', 'Galaw'), par: S('par', 'par'), energy: S('Energy', 'Lakas'), photos: S('Photos', 'Litrato'),
    hint: S('Hint', 'Pahiwatig'), undo: S('Undo', 'Ibalik'), knock: S('Knock', 'Kumatok'),
    warnTitle: S('Spot the warning!', 'Hanapin ang babala!'),
    warnQ: S('You see this inside a building. What do you do?', 'Nakita mo ito sa loob ng gusali. Ano ang gagawin mo?'),
    evacuate: S('EVACUATE now', 'LUMIKAS agad'),
    stay: S("Stay and finish what you're doing", 'Manatili at tapusin ang ginagawa'),
    warnYes: S('Yes! Big cracks, stuck doors and leaning walls mean: get out right away.', 'Tama! Malalaking bitak, naipit na pinto at nakahilig na pader: lumabas agad.'),
    warnNo: S('Never stay. Those signs mean the building may fall. Leave right away!', 'Huwag manatili. Senyales ang mga iyan na baka gumuho ang gusali. Lumabas agad!'),
    warnTime: S('When you see signs like these, leave the building right away.', 'Kapag nakita mo ang ganitong senyales, lumabas agad sa gusali.'),
    warn: {
      cracks: S('Big cracks in the walls', 'Malalaking bitak sa pader'),
      jammed_door: S('A door that is stuck', 'Pintong naipit'),
      tilting_wall: S('A wall that leans', 'Pader na nakahilig')
    },
    trapped: S("After a partial collapse — you're safe but trapped. Help clear the way.", 'Pagkatapos ng bahagyang pagguho — ligtas ka pero naipit. Tumulong na buksan ang daan.'),
    trappedShort: S('Safe, but trapped', 'Ligtas, pero naipit'),
    firstGrab: S('Slide it with the arrow keys, then press Enter to drop it.', 'Idulas gamit ang arrow keys, saka pindutin ang Enter para ibaba.'),
    holdUp: S("That's holding the building up — don't move it!", 'Iyan ang sumusuporta sa gusali — huwag galawin!'),
    loadReset: S('Load-bearing! Never move it.', 'Sumusuporta iyan! Huwag na huwag galawin.'),
    fixedInfo: S('Cracked blocks and slabs hold the building up. Leave them where they are.', 'Ang may bitak at ang malalaking tipak ay sumusuporta sa gusali. Hayaan sila sa puwesto.'),
    dustFirst: S('Cover your nose and mouth first! Pick up the 😷 mask.', 'Takpan muna ang ilong at bibig! Kunin ang 😷 mask.'),
    maskOn: S("Mask on! Now the dust can't get into your nose and mouth.", 'Suot na ang mask! Hindi na papasok ang alikabok sa ilong at bibig.'),
    match: S('Never light a match — there may be gas leaks!', 'Huwag magsindi ng posporo — baka may tagas ng gas!'),
    photo: S('A photo! You found a keepsake.', 'Isang litrato! Nakakita ka ng alaala.'),
    photoSeen: S('Something is under there! Select the 📸 to keep it.', 'May nasa ilalim! Piliin ang 📸 para itago.'),
    weHear: S('We hear you — tap back!', 'Naririnig ka namin — kumatok ka pabalik!'),
    rest: S('Out of energy. Rest and signal: knock back to the rescuers.', 'Ubos na ang lakas. Magpahinga at sumenyas: kumatok pabalik sa mga rescuer.'),
    yourTurn: S('Your turn! Knock the same rhythm: Space, or tap the pipe.', 'Ikaw na! Kumatok sa parehong ritmo: Space, o i-tap ang tubo.'),
    knockOk: S('They heard you! Tapping saves your voice and energy.', 'Narinig ka nila! Ang pagkatok ay nagtitipid ng boses at lakas.'),
    knockMiss: S('Close! Listen to the gaps between the knocks next time.', 'Malapit na! Pakinggan ang pagitan ng mga katok sa susunod.'),
    restDone: S('Rested. You can keep clearing the way.', 'Nakapagpahinga. Puwede mo nang ituloy.'),
    waitKnock: S('Save your energy. The rescuers will knock first — then knock back.', 'Magtipid ng lakas. Kakatok muna ang mga rescuer — saka ka kumatok pabalik.'),
    aftershock: S('Aftershock! Stay calm and stay put — your hard hat protects you.', 'Aftershock! Manatiling kalmado at huwag gumalaw — protektado ka ng hard hat.'),
    noHints: S('No hints left. Look at the escape row: what is in the way?', 'Wala nang pahiwatig. Tingnan ang daan palabas: ano ang nakaharang?'),
    hintSay: S('Try this block, this way.', 'Subukan ang blokeng ito, sa direksyong ito.'),
    free: S('The way is clear! Walk out to the rescuers.', 'Malinaw na ang daan! Lumabas papunta sa mga rescuer.'),
    blockH: S('Block, slides left and right', 'Bloke, dumudulas pakaliwa at pakanan'),
    blockV: S('Block, slides up and down', 'Bloke, dumudulas pataas at pababa'),
    dusty: S('Dusty block', 'Maalikabok na bloke'),
    cracked: S('Cracked block: it holds the building up', 'Blokeng may bitak: sumusuporta sa gusali'),
    slab: S('Slab: it holds the building up', 'Malaking tipak: sumusuporta sa gusali'),
    mask: S('Face mask: select it to put it on', 'Face mask: piliin para isuot'),
    matchItem: S('A match', 'Isang posporo'),
    photoItem: S('A photo', 'Isang litrato'),
    at: S('row {r}, column {c}', 'hilera {r}, hanay {c}'),
    grabbed: S('Grabbed', 'Hawak')
  };
  RR.STR = STR;

  /* ---------- styles, once per page (all under #ag-app, classes rr-) ---------- */
  const CSS = `
#ag-app .rr { display: grid; gap: 8px; justify-items: center; width: 100%; }
#ag-app .rr .ag-canvas { width: 100%; touch-action: none; }
#ag-app .rr-tools { display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; align-items: center; }
#ag-app .rr-tools .ag-btn { min-height: 52px; min-width: 64px; }
#ag-app .rr-tool { display: inline-flex; gap: 4px; align-items: center; }
#ag-app .rr-tool[hidden] { display: none; }
#ag-app .rr-tools .ag-btn.is-cue { outline: 3px dashed var(--vest); outline-offset: 2px; }
#ag-app .rr-hudrig { display: inline-flex; align-items: end; width: 40px; height: 40px; overflow: hidden; }
#ag-app .rr-hudrig img { width: 40px; height: auto; }
#ag-app .rr-hudmeter { min-width: 110px; display: grid; gap: 2px; }
#ag-app .rr-hudmeter small { font-size: .7rem; color: var(--muted); font-weight: 800; }
#ag-app .rr-hudmeter.is-low small { color: var(--alert); }
#ag-app .rr-warn .ag-box { max-width: 560px; }
#ag-app .rr-warnimgs { display: flex; gap: 8px; justify-content: center; flex-wrap: wrap; margin: 6px 0; }
#ag-app .rr-warnimgs figure { margin: 0; display: grid; gap: 2px; justify-items: center; flex: 1 1 200px; max-width: 240px; }
#ag-app .rr-warnimgs img { width: 100%; height: auto; border: 2px solid var(--ink); }
#ag-app .rr-warnimgs figcaption { font-size: .8rem; font-weight: 800; }
#ag-app .rr-warnrow { display: flex; gap: 10px; align-items: center; justify-content: center; flex-wrap: wrap; }
@media (prefers-reduced-motion: reduce) { #ag-app .rr-tools .ag-btn.is-cue { outline-style: solid; } }`;
  function injectCss() {
    if (!document.querySelector('style[data-ag-css="rubble-rescue"]')) document.head.append(h('style', { 'data-ag-css': 'rubble-rescue' }, CSS));
  }
  const shapeOf = b => (b.kind === 'slab' ? 'slab' : b.axis + b.len);
  const artKey = b => 'rubble-rescue.block.' + shapeOf(b) + (b.kind === 'cracked' ? '.cracked' : b.kind === 'dusty' ? '.dusty' : '');

  class Scene {
    constructor(stage, ctx, o) {
      injectCss();
      this.stage = stage; this.ctx = ctx; this.onEnd = o.onEnd;
      this.adv = ctx.difficulty === 'advanced';
      this.reduce = AG.reducedMotion();
      this.offs = []; this.lastHint = {}; this.fx = [];
      const entry = this.entry = ctx.levelData || {};
      this.level = entry.level || ctx.level;
      this.f = R.features(entry, this.level);
      const p = this.puzzle = R.puzzle(entry, ctx.difficulty);
      this.n = p.size; this.row = p.escapeRow;
      this.m = SV.model(p);
      this.pos = this.m.start.slice();
      let k = 0;
      this.blocks = p.blocks.map(b => Object.assign({}, b, { i: SV.movable(b) ? k++ : -1 }));
      this.byIndex = this.blocks.filter(b => b.i >= 0);
      this.par = p.par != null ? p.par : SV.solve(this.m).dist;
      this.parExtra = 0;
      this.rnd = AG.util.mulberry32((ctx.seed >>> 0) ^ 0x2b1e);
      this.energyStart = this.f.energy ? R.energy(this.par, ctx.difficulty) : null;
      this.energy = this.energyStart;
      this.items = [];
      (p.photos || []).slice(0, 3).forEach((c, idx) => this.items.push({ type: 'photo', idx, x: c.x, y: c.y, done: false }));
      if (this.f.dust && p.mask) this.items.push({ type: 'mask', x: p.mask.x, y: p.mask.y, done: false });
      if (this.f.match && p.match) this.items.push({ type: 'match', x: p.match.x, y: p.match.y, done: false });
      // the run
      this.moves = 0; this.slides = 0; this.knocksOk = 0; this.knockRounds = 0; this.knocksMissed = 0;
      this.hints = 0; this.hintsLeft = R.hints(ctx.difficulty); this.matchUsed = false; this.loadBearing = 0;
      this.warning = false; this.maskOn = false; this.dustHits = 0; this.aftershocks = 0;
      this.photos = [false, false, false]; this.seenPhoto = false;
      this.lock = 'warn'; this.grab = null; this.knock = null; this.hintShow = null; this.walk = null;
      this.shake = null; this.quakeUntil = 0; this.pipeHitAt = 0; this.ended = false;
      this.undo = this.adv ? null : new AG.logic.UndoStack({ limit: 200, onChange: e => { if (this.tools) this.tools.undo.b.disabled = !e.canUndo; } });
      // layout (logical canvas px): the pocket left of the escape row, the exit gap right of it
      const bw = this.n * C;
      this.ox = Math.round(240 - bw / 2) + 16;
      this.oy = Math.round((270 - bw) / 2);
      this.rowY = this.oy + this.row * C;
      this.pocket = { x: this.ox - 4 - T.bust - 2, y: this.rowY + C / 2 - T.bust / 2, w: T.bust, h: T.bust };
      this.gap = { x: this.ox + bw, y: this.rowY };
      this.pipe = { x: this.pocket.x - 60, y: this.pocket.y + T.bust + 14, w: 96, h: 12 };
      this.knockBox = { x: this.pipe.x, y: this.pocket.y - 52, w: 96, h: 34 };
      for (const b of this.blocks) { const q = this.cellOf(b); b.px = this.ox + q.x * C; b.py = this.oy + q.y * C; }
    }

    /* ---------- the board ---------- */
    cellOf(b) {
      if (b.i < 0) return { x: b.x, y: b.y };
      return b.axis === 'h' ? { x: this.pos[b.i], y: b.y } : { x: b.x, y: this.pos[b.i] };
    }
    sizeOf(b) { return b.kind === 'slab' ? { w: 2, h: 2 } : b.axis === 'h' ? { w: b.len, h: 1 } : { w: 1, h: b.len }; }
    blockAt(x, y) {
      for (const b of this.blocks) { const c = this.cellOf(b), s = this.sizeOf(b); if (x >= c.x && y >= c.y && x < c.x + s.w && y < c.y + s.h) return b; }
      return null;
    }
    /** Items lie on the floor: selectable while nothing covers them. */
    itemAt(x, y) { return this.items.find(it => !it.done && it.x === x && it.y === y && !this.blockAt(x, y)) || null; }
    /** What covers a cell (a block, else an item), with the cell the cursor uses for it. */
    thingAt(x, y) {
      const b = this.blockAt(x, y);
      if (b) return { block: b, rep: this.cellOf(b) };
      const it = this.itemAt(x, y);
      return it ? { item: it, rep: { x, y } } : null;
    }
    selAt(x, y) { const t = this.thingAt(x, y); return t && t.rep.x === x && t.rep.y === y ? t : null; }
    things() {
      const out = [];
      for (let y = 0; y < this.n; y++) for (let x = 0; x < this.n; x++) { const t = this.selAt(x, y); if (t) out.push(t); }
      return out;
    }
    cellAt(px, py) {
      const x = Math.floor((px - this.ox) / C), y = Math.floor((py - this.oy) / C);
      return x >= 0 && y >= 0 && x < this.n && y < this.n ? { x, y } : null;
    }
    describe(x, y) {
      const t = this.selAt(x, y);
      if (!t) return '';
      let s;
      if (t.block) {
        const b = t.block;
        s = b.kind === 'cracked' ? STR.cracked : b.kind === 'slab' ? STR.slab : b.axis === 'h' ? STR.blockH : STR.blockV;
        if (b.kind === 'dusty') s = S(STR.dusty.en + '. ' + s.en, STR.dusty.fil + '. ' + s.fil);
      } else s = t.item.type === 'mask' ? STR.mask : t.item.type === 'match' ? STR.matchItem : STR.photoItem;
      const at = l => STR.at[l].replace('{r}', y + 1).replace('{c}', x + 1);
      return S(s.en + ', ' + at('en'), s.fil + ', ' + at('fil'));
    }
    goal() { return SV.isGoal(this.m, this.pos); }
    get parNow() { return this.par + this.parExtra; }
    get graph() { if (!this.g) this.g = SV.graph(this.m); return this.g; }

    /* ---------- the DOM around the canvas ---------- */
    mount() {
      const stage = this.stage, ctx = this.ctx;
      this.view = AG.gfx.canvas(480, 270);
      const tool = (label, prompt, fn, cls) => {
        const b = h('button', { class: 'ag-btn ag-btn--alt ' + (cls || ''), type: 'button', tabindex: '-1' }, label);
        b.addEventListener('click', () => { fn(); stage.focus({ preventScroll: true }); });
        return { b, wrap: h('span', { class: 'rr-tool' }, AG.input.promptIcon(prompt), b) };
      };
      this.tools = {
        hint: tool('', { keys: ['key_h'], gesture: 'gesture_tap' }, () => this.useHint(), 'rr-hint'),
        undo: tool('', { keys: ['key_backspace'], gesture: 'gesture_tap' }, () => this.doUndo(), 'rr-undo'),
        knock: tool('', { keys: ['key_space'], gesture: 'gesture_tap' }, () => {}, 'rr-knock')
      };
      // a knock counts on pointerdown, like Space counts on keydown: the same timing on every device
      this.tools.knock.b.addEventListener('pointerdown', e => { e.preventDefault(); this.knockTap(e.timeStamp); });
      this.tools.undo.wrap.hidden = this.adv;
      this.tools.undo.b.disabled = true;
      this.tools.knock.wrap.hidden = !this.f.knocks;
      const move = AG.input.promptIcon({ keys: ['key_tab', 'key_enter'], gesture: 'gesture_drag' });
      this.el = h('div', { class: 'rr' }, this.view.cv, h('div', { class: 'rr-tools' }, move, ...Object.values(this.tools).map(t => t.wrap)));
      stage.append(this.el);
      AG.input.setView(this.view);
      AG.input.pointerMode('drag');

      // HUD: moves / par, energy, photos, and the player's portrait
      this.rig = ctx.rig('portrait', { height: 48 });
      if (this.f.aftershocks) this.rig.setGear('hard_hat');
      this.rig.play('worried');
      this.expert = new AG.CharacterRig(stage, ctx.expertId, 'portrait', { height: 48 });
      this.expert.setFacing('left').play('hold:flashlight');
      this.hud = ctx.hud({ score: '', scoreLabel: STR.moves, label: STR.photos });
      this.hudRig = h('span', { class: 'rr-hudrig', 'aria-hidden': 'true' });
      this.hud.el.prepend(this.hudRig);
      if (this.f.energy) {
        this.meter = AG.kit.meter({ label: STR.energy });
        this.meterLabel = h('small', {}, '');
        this.meterWrap = h('div', { class: 'rr-hudmeter' }, this.meterLabel, this.meter.el);
        this.hud.el.append(this.meterWrap);
      }
      this.relabel();

      this.cursor = new AG.grid.GridCursor({
        w: this.n, h: this.n, view: this.view, stage, mode: 'nearest', tapConfirms: false,
        selectable: (x, y) => !!this.selAt(x, y),
        rect: (x, y) => { const t = this.selAt(x, y); if (t && t.block) { const s = this.sizeOf(t.block); return { x: t.block.px, y: t.block.py, w: s.w * C, h: s.h * C }; } return { x: this.ox + x * C, y: this.oy + y * C, w: C, h: C }; },
        cellAt: (px, py) => { const c = this.cellAt(px, py), t = c && this.thingAt(c.x, c.y); return t ? t.rep : null; },
        describe: (x, y) => this.describe(x, y),
        onMove: () => { this.hintShow = null; }
      });
      this.cursor.active = false;

      AG.input.register('CONFIRM', { keys: ['Enter', 'NumpadEnter'] }); // Space knocks instead
      AG.input.register('KNOCK', { keys: ['Space'] });
      const I = AG.input, on = (a, fn) => this.offs.push(I.on(a, fn));
      on('CONFIRM', e => { if (e.phase === 'down') this.confirm(); });
      on('KNOCK', e => { if (e.phase === 'down') this.knockTap(e.event && e.event.timeStamp); });
      on('NEXT_ZONE', e => { if (e.phase === 'down') this.tab(e.event && e.event.shiftKey ? -1 : 1); });
      on('CANCEL', e => { if (e.phase === 'down') this.cancelGrab(); });
      on('HINT', e => { if (e.phase === 'down') this.useHint(); });
      if (!this.adv) on('UNDO', e => { if (e.phase === 'down') this.doUndo(); });
      for (const dir of Object.keys(VEC)) on(dir.toUpperCase(), e => {
        if (e.phase === 'down' && this.lock === 'warn') this.warnFocus(dir === 'left' || dir === 'up' ? -1 : 1);
        else if ((e.phase === 'down' || e.phase === 'repeat') && this.grab && this.grab.via === 'key') this.nudge(dir);
      });
      const ptr = (type, fn) => this.offs.push(I.onPointer(type, fn));
      ptr('down', p => this.pointerDown(p));
      ptr('dragstart', p => this.dragStart(p));
      ptr('drag', p => this.dragMove(p));
      ptr('dragend', p => this.dragEnd(p));
      ptr('tap', p => this.tap(p));
      this.offs.push(AG.on('kalasag:languagechange', () => this.relabel()));
      ctx.onPause(paused => { if (paused && this.knock && this.knock.phase !== 'done') this.knock.restart(); });
      this.offs.push(() => this.cursor.destroy());
      AG.sfx.preload(['rubble-rescue.sfx.slide', 'rubble-rescue.sfx.knock', 'rubble-rescue.sfx.dust', 'rubble-rescue.sfx.rumble', 'rubble-rescue.sfx.cheer', 'rubble-rescue.sfx.whistle']);
      ['floor', 'cell_item', 'bg', 'pipe', 'light.exit', 'light.rescuer', 'ui.knock', 'fx.dust'].forEach(k => AG.assets.image('rubble-rescue.' + k));
      this.blocks.forEach(b => AG.assets.image(artKey(b)));

      this.updateHud();
      this.stop = AG.gfx.loop(dt => this.frame(dt));
      this.warnPanel();
      // the state graph (hints, aftershocks) while the player reads the question
      ctx.after(80, () => { if (!this.dead) void this.graph; });
    }
    relabel() {
      const t = this.tools;
      t.hint.b.textContent = '💡 ' + AG.pick(STR.hint) + (Number.isFinite(this.hintsLeft) ? ' · ' + this.hintsLeft : '');
      t.hint.b.disabled = this.hintsLeft <= 0;
      t.undo.b.textContent = '↶ ' + AG.pick(STR.undo);
      t.knock.b.textContent = '🔔 ' + AG.pick(STR.knock);
      const small = this.hud.el.querySelectorAll('.ag-stat small');
      if (small[0]) small[0].textContent = AG.pick(STR.moves);
      if (small[1]) small[1].textContent = '📸 ' + AG.pick(STR.photos);
      this.updateHud();
    }
    updateHud() {
      if (!this.hud) return;
      this.hud.set({ score: this.moves + ' / ' + AG.pick(STR.par) + ' ' + this.parNow, label: this.photos.filter(Boolean).length + ' / 3' });
      if (this.meter) {
        this.meter.set(this.energy / Math.max(1, this.energyStart));
        this.meterLabel.textContent = '⚡ ' + AG.pick(STR.energy) + ' ' + this.energy;
        this.meterWrap.classList.toggle('is-low', this.energy <= 3);
      }
    }
    syncHudRig() {
      const frame = this.rig.info(performance.now() / 1000).frame;
      if (frame === this.hudFrame) return;
      this.hudFrame = frame;
      this.hudRig.replaceChildren(this.rig.img(1));
    }
    baseAction() { return this.maskOn ? 'cover_mouth' : this.moves === 0 && !this.slides ? 'worried' : 'idle'; }
    /** A short reaction, then back to the calm base pose. */
    react(action, ms) {
      this.rig.play(action, { restart: true });
      clearTimeout(this.reactT);
      this.reactT = setTimeout(() => { if (!this.ended && !this.knock) this.rig.play(this.baseAction()); }, ms || 900);
    }

    /* ---------- "Spot the warning" ---------- */
    warnPanel() {
      const keys = (this.entry.warnScene && this.entry.warnScene.length ? this.entry.warnScene : ['cracks']).slice(0, 2);
      const figs = keys.map(k => {
        const key = 'rubble-rescue.warn.' + k, ph = AG.assets.placeholderURL(key, 240, 135);
        const img = h('img', { class: 'ag-px', src: AG.assets.url(key) || ph, width: 240, height: 135, alt: AG.pick(STR.warn[k] || STR.warn.cracks), draggable: 'false' });
        img.addEventListener('error', () => { img.src = ph; }, { once: true });
        return h('figure', {}, img, h('figcaption', {}, '⚠️ ' + AG.pick(STR.warn[k] || STR.warn.cracks)));
      });
      const opts = [{ text: STR.evacuate, icon: 'sign_evacuate', ok: true }, { text: STR.stay, icon: 'clipboard', ok: false }];
      if (this.rnd() < 0.5) opts.reverse();
      let answered = false;
      const ring = AG.kit.timerRing({ size: 52 });
      const answer = (ok, i) => {
        if (answered || this.dead) return;
        answered = true;
        ring.stop(); choices.lock();
        if (i != null) choices.mark(i, ok);
        if (ok) { this.warning = true; this.ctx.safe(); this.say('success', STR.warnYes); this.popAt(this.pocket.x + 24, this.pocket.y, '+' + T.points.warning, true); }
        else if (ok === false) this.say('retry', STR.warnNo);
        else this.say('instruction', STR.warnTime);
        this.ctx.after(ok ? 1500 : 2600, () => {
          if (this.dead) return;
          choices.destroy(); panel.remove(); this.panel = null;
          AG.kit.banner(this.stage, STR.trappedShort, STR.trapped, 2200);
          this.say('instruction', STR.trapped, { sound: false });
          this.unlock();
        });
      };
      const choices = AG.kit.choices(opts, (o, i) => answer(o.ok, i), { label: STR.warnQ });
      const panel = this.panel = h('div', { class: 'ag-overlay rr-warn', role: 'dialog', 'aria-label': AG.pick(STR.warnTitle) },
        h('div', { class: 'ag-box' }, h('h3', {}, AG.pick(STR.warnTitle)), h('p', {}, AG.pick(STR.warnQ)),
          h('div', { class: 'rr-warnimgs' }, figs), h('div', { class: 'rr-warnrow' }, ring.el, choices.el)));
      this.stage.append(panel);
      this.warnChoices = choices;
      ring.run(T.warnMs, () => answer(null));
      // after the shell's own stage.focus(), so Enter answers at once
      setTimeout(() => { if (!answered && !this.dead) choices.btns[0].focus({ preventScroll: true }); }, 0);
    }
    /** Tab and the arrows move between the two answers while the question is open. */
    warnFocus(step) {
      const btns = this.warnChoices && this.warnChoices.btns;
      if (!btns || !this.panel) return;
      const i = btns.indexOf(document.activeElement);
      btns[((i < 0 ? 0 : i + step) + btns.length) % btns.length].focus({ preventScroll: true });
    }
    unlock() {
      this.lock = null;
      if (this.ended) return;
      this.cursor.active = true;
      this.fixCursor();
      this.stage.focus({ preventScroll: true });
    }

    /* ---------- choosing and grabbing ---------- */
    fixCursor() {
      if (this.selAt(this.cursor.x, this.cursor.y)) return;
      const all = this.things();
      if (!all.length) return;
      const cx = this.cursor.x, cy = this.cursor.y;
      all.sort((a, b) => (Math.abs(a.rep.x - cx) + Math.abs(a.rep.y - cy)) - (Math.abs(b.rep.x - cx) + Math.abs(b.rep.y - cy)));
      this.cursor.set(all[0].rep.x, all[0].rep.y);
    }
    tab(step) {
      if (this.lock === 'warn') { this.warnFocus(step); return; }
      if (this.lock || this.grab) return;
      const all = this.things();
      if (!all.length) return;
      const i = all.findIndex(t => t.rep.x === this.cursor.x && t.rep.y === this.cursor.y);
      const t = all[((i < 0 ? 0 : i + step) + all.length) % all.length];
      AG.sfx.play('tap');
      this.cursor.set(t.rep.x, t.rep.y, { via: 'key' });
    }
    confirm() {
      if (this.lock) return;
      if (this.grab) { if (this.grab.via === 'key') this.release(); return; }
      const t = this.selAt(this.cursor.x, this.cursor.y);
      if (!t) return;
      if (t.item) { this.useItem(t.item); return; }
      const b = t.block;
      if (b.i < 0) { this.loadBearingTry(b); return; }
      this.grab = { b, from: this.pos[b.i], via: 'key' };
      this.cursor.active = false;
      AG.input.armCancel(true);
      AG.sfx.play('tap');
      this.hintShow = this.hintShow && this.hintShow.i === b.i ? this.hintShow : null;
      this.once('grab', 'instruction', STR.firstGrab);
    }
    /** Arrow keys while a block is held: one cell along its axis (perpendicular keys do nothing). */
    nudge(dir) {
      const g = this.grab, b = g.b;
      if (!AXIS_DIRS[b.axis].includes(dir)) return;
      const r = SV.range(this.m, this.pos, b.i), d = dir === 'left' || dir === 'up' ? -1 : 1, to = this.pos[b.i] + d;
      if (to < r.min || to > r.max) { AG.sfx.play('soft'); return; }
      this.pos[b.i] = to;
      AG.sfx.play('tap');
    }
    cancelGrab() {
      if (!this.grab) return;
      this.pos[this.grab.b.i] = this.grab.from;
      this.endGrab();
    }
    endGrab() {
      const b = this.grab && this.grab.b;
      this.grab = null;
      AG.input.armCancel(false);
      if (!this.lock) this.cursor.active = true;
      if (b) { const c = this.cellOf(b); this.cursor.set(c.x, c.y); }
    }
    release() {
      const g = this.grab;
      this.endGrab();
      if (g && this.pos[g.b.i] !== g.from) this.commit(g.b, g.from);
    }

    /* ---------- touch and mouse ---------- */
    pointerDown(p) {
      this.down = { x: p.x, y: p.y };
      // in a knock round's answer phase, a press anywhere on the board knocks (pointerdown time)
      if (this.knock && this.knock.phase === 'answer') { this.knockTap(p.event && p.event.timeStamp); this.down = null; }
    }
    dragStart(p) {
      if (this.lock || !this.down || this.grab) return;
      const c = this.cellAt(this.down.x, this.down.y), t = c && this.thingAt(c.x, c.y);
      if (!t || !t.block) return;
      const b = t.block;
      this.cursor.set(t.rep.x, t.rep.y, { via: 'tap' });
      if (b.i < 0) { this.loadBearingTry(b); return; }
      const r = SV.range(this.m, this.pos, b.i);
      this.grab = { b, from: this.pos[b.i], via: 'drag', min: r.min, max: r.max, at: { x: this.down.x, y: this.down.y } };
      this.cursor.active = false;
    }
    dragMove(p) {
      const g = this.grab;
      if (!g || g.via !== 'drag') return;
      const delta = g.b.axis === 'h' ? p.x - g.at.x : p.y - g.at.y;
      const to = AG.util.clamp(g.from + Math.round(delta / C), g.min, g.max);
      if (to !== this.pos[g.b.i]) { this.pos[g.b.i] = to; AG.sfx.play('tap'); }
    }
    dragEnd() { if (this.grab && this.grab.via === 'drag') this.release(); this.down = null; }
    tap(p) {
      if (this.lock || this.grab) return;
      const c = this.cellAt(p.x, p.y);
      if (c) {
        const t = this.thingAt(c.x, c.y);
        if (t && t.item) this.useItem(t.item);
        else if (t && t.block && t.block.i < 0 && this.f.loadBearing) this.hint('fixed', 'info', STR.fixedInfo, 6000);
        return;
      }
      const P = this.pipe;
      if (this.f.knocks && p.x >= P.x - 6 && p.x <= P.x + P.w + 6 && p.y >= P.y - 14 && p.y <= P.y + P.h + 14) this.knockTap(p.event && p.event.timeStamp);
    }

    /* ---------- moves ---------- */
    commit(b, from) {
      this.moves++; this.slides++;
      if (this.f.energy) this.energy = Math.max(0, this.energy - 1);
      if (this.undo) this.undo.push({ i: b.i, from, to: this.pos[b.i] });
      this.hintShow = null;
      AG.sfx.play('rubble-rescue.sfx.slide');
      if (b.kind === 'dusty') {
        this.puff(b);
        AG.sfx.play('rubble-rescue.sfx.dust');
      }
      if (b.kind === 'dusty' && this.f.dust && !this.maskOn) {
        this.dustHits++;
        if (this.f.energy) this.energy = Math.max(0, this.energy - T.dustEnergy);
        this.react('worried', 1200);
        this.say('warning', STR.dustFirst);
      } else if (this.rig.action === 'worried') this.rig.play(this.baseAction()); // calmer after the first move
      this.checkPhotos();
      this.updateHud();
      if (this.goal()) { this.win(); return; }
      this.afterMove();
    }
    afterMove() {
      if (R.aftershockDue(this.slides, this.f, this.ctx.difficulty)) {
        this.aftershock();
        this.lock = 'quake'; this.cursor.active = false;
        this.ctx.after(700, () => { if (this.dead || this.ended) return; this.lock = null; this.cursor.active = true; this.fixCursor(); this.signalCheck(); });
        return;
      }
      this.signalCheck();
    }
    /** Out of energy → "rest and signal"; else every 6 moves the rescuers knock. */
    signalCheck() {
      if (this.ended) return;
      if (this.f.energy && this.energy <= 0) this.startKnock(true);
      else if (R.knockDue(this.slides, this.f)) this.startKnock(false);
    }
    doUndo() {
      if (!this.undo || this.lock || this.grab) return;
      const e = this.undo.undo();
      if (!e) return;
      this.pos[e.i] = e.from;
      this.moves = Math.max(0, this.moves - 1);
      if (this.f.energy) this.energy += 1;
      this.hintShow = null;
      AG.sfx.play('tap');
      const b = this.byIndex[e.i], c = this.cellOf(b);
      this.cursor.set(c.x, c.y);
      this.updateHud();
    }
    checkPhotos() {
      this.items.forEach(it => {
        if (it.type !== 'photo' || it.done || it.seen || this.blockAt(it.x, it.y)) return;
        it.seen = true;
        AG.sfx.play('blip');
        if (!this.seenPhoto) { this.seenPhoto = true; this.say('instruction', STR.photoSeen, { sound: false }); }
      });
    }
    useItem(it) {
      if (it.done) return;
      if (it.type === 'photo') {
        it.done = true; this.photos[it.idx] = true;
        AG.sfx.play('star');
        this.popCell(it.x, it.y, '📸', true);
        this.say('success', STR.photo, { sound: false });
      } else if (it.type === 'mask') {
        it.done = true; this.maskOn = true;
        this.rig.setGear('mask').play('cover_mouth');
        AG.sfx.play('collect');
        this.ctx.safe();
        this.say('success', STR.maskOn);
      } else if (it.type === 'match') {
        it.done = true; this.matchUsed = true;
        if (this.f.energy) this.energy = Math.max(0, this.energy - T.matchEnergy);
        this.popCell(it.x, it.y, '−' + T.matchEnergy + ' ⚡', false);
        this.react('worried', 1400);
        this.say('warning', STR.match);
        if (this.f.energy && this.energy <= 0) this.ctx.after(400, () => { if (!this.lock && !this.ended) this.startKnock(true); });
      }
      this.updateHud();
      this.fixCursor();
    }
    /** Trying to move a slab or a cracked block: Easy shakes it, Advanced resets the level. */
    loadBearingTry(b) {
      this.loadBearing++;
      this.react('alert', 900);
      if (!this.adv) {
        this.shake = { b, until: performance.now() + T.shakeMs };
        AG.sfx.play('soft');
        this.say('warning', STR.holdUp);
        return;
      }
      this.puff(b);
      AG.sfx.play('rubble-rescue.sfx.dust');
      this.say('warning', STR.loadReset);
      this.lock = 'reset'; this.cursor.active = false;
      this.ctx.after(900, () => { if (!this.dead && !this.ended) this.resetBoard(); });
    }
    resetBoard() {
      this.pos = this.m.start.slice();
      this.moves = 0; this.slides = 0; this.parExtra = 0; this.energy = this.energyStart;
      if (this.undo) this.undo.clear();
      this.hintShow = null;
      this.rig.play(this.baseAction());
      this.updateHud();
      this.unlock();
    }

    /* ---------- hints and aftershocks (the solver) ---------- */
    useHint() {
      if (this.lock || this.grab || this.ended) return;
      if (this.hintsLeft <= 0) { this.hint('nohint', 'instruction', STR.noHints); return; }
      const g = this.graph;
      let hn = g.truncated ? null : SV.hint(this.m, g, this.pos);
      if (!hn) { const s = SV.solve(this.m, this.pos); if (s && s.path.length) { const mv = s.path[0], b = this.m.mov[mv.i]; hn = { i: mv.i, delta: mv.delta, dir: AXIS_DIRS[b.axis][mv.delta > 0 ? 1 : 0] }; } }
      if (!hn) return;
      this.hints++; this.hintsLeft--;
      const b = this.byIndex[hn.i], c = this.cellOf(b);
      this.cursor.set(c.x, c.y);
      this.hintShow = { i: hn.i, dir: hn.dir, to: this.pos[hn.i] + hn.delta };
      AG.sfx.play('blip');
      this.popCell(c.x, c.y, '−' + T.points.hint, false);
      this.say('instruction', STR.hintSay, { sound: false });
      this.relabel();
    }
    aftershock() {
      this.aftershocks++;
      AG.sfx.play('rubble-rescue.sfx.rumble');
      this.quakeUntil = performance.now() + 500;
      this.say('info', STR.aftershock);
      const g = this.graph;
      if (g.truncated) return;
      const cur = SV.dist(g, this.pos);
      const all = SV.aftershocks(this.m, g, this.pos, this.f.energy ? this.energy : null);
      const calm = all.filter(c => c.dist <= cur), pool = calm.length ? calm : all;
      if (!pool.length) return;
      const pick = pool[Math.floor(this.rnd() * pool.length)];
      this.pos[pick.i] += pick.delta;
      this.parExtra += Math.max(0, pick.dist - cur);
      this.puff(this.byIndex[pick.i]);
      if (this.undo) this.undo.clear();
      this.hintShow = null;
      this.checkPhotos();
      this.updateHud();
    }

    /* ---------- knocking ---------- */
    startKnock(rest) {
      if (this.ended || this.knock) return;
      const K = T.knock, d = this.adv ? 'advanced' : 'easy';
      const [lo, hi] = K.count[d], n = lo + Math.floor(this.rnd() * (hi - lo + 1));
      this.lock = 'knock'; this.cursor.active = false; this.hintShow = null;
      this.knock = new RR.KnockRound({
        pattern: RR.knock.pattern(this.rnd, n, K.gaps), tolerance: K.tolerance[d], rest,
        onPhase: ph => this.knockPhase(ph, rest),
        onEnd: r => this.knockEnd(r)
      });
      this.tools.knock.b.classList.add('is-cue');
    }
    knockPhase(ph, rest) {
      if (ph === 'lead') {
        this.expert.play('hold:radio');
        this.rig.play(this.baseAction());
        this.say('info', rest ? STR.rest : STR.weHear, { pose: AG.rig.resolve(this.ctx.expertId, 'hold:radio').frame });
      }
      if (ph === 'answer') {
        this.rig.play('hold:whistle');
        this.say('instruction', STR.yourTurn, { sound: false });
      }
    }
    knockTap(ts) {
      if (this.knock && this.knock.phase === 'answer') {
        this.knock.tap(ts);
        this.pipeHitAt = performance.now();
        return;
      }
      if (!this.f.knocks || this.ended || this.lock === 'warn') return;
      if (!this.knock) this.hint('wait', 'instruction', STR.waitKnock, 5000);
    }
    knockEnd(r) {
      this.knockRounds++;
      const K = T.knock;
      if (r.ok) {
        this.knocksOk++;
        if (this.f.energy) this.energy += r.rest ? K.restEnergy : K.energy;
        AG.sfx.play('rubble-rescue.sfx.whistle');
        this.popAt(this.pipe.x + 48, this.pipe.y - 8, '+' + T.points.knock, true);
        this.say('success', r.rest ? STR.restDone : STR.knockOk);
        this.ctx.safe();
      } else {
        this.knocksMissed++;
        if (r.rest && this.f.energy) this.energy += K.restEnergy; // resting never fails
        this.say('encouragement', r.rest ? STR.restDone : STR.knockMiss);
      }
      AG.store.update('stats', s => { const rr = s.rubbleRescue = s.rubbleRescue || { knocksOk: 0 }; if (r.ok) rr.knocksOk = (rr.knocksOk || 0) + 1; });
      this.updateHud();
      this.ctx.after(1300, () => {
        if (this.dead) return;
        this.knock = null;
        this.tools.knock.b.classList.remove('is-cue');
        this.expert.play('hold:flashlight');
        if (!this.ended) { this.rig.play(this.baseAction()); this.unlock(); }
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
    once(id, type, text) { if (this.lastHint[id]) return; this.lastHint[id] = performance.now(); this.say(type, text, { sound: false }); }
    popAt(x, y, text, good) {
      const r = this.stage.getBoundingClientRect(), c = this.view.cv.getBoundingClientRect(), k = c.width / 480;
      AG.kit.pop(this.stage, Math.round(c.left - r.left + x * k), Math.round(c.top - r.top + y * k), text, good);
    }
    popCell(x, y, text, good) { this.popAt(this.ox + x * C + C / 2, this.oy + y * C, text, good); }
    puff(b) {
      const c = this.cellOf(b), s = this.sizeOf(b);
      for (let k = 0; k < s.w * s.h && k < 3; k++) this.fx.push({ x: this.ox + (c.x + (s.w > 1 ? k % s.w : 0)) * C, y: this.oy + (c.y + (s.h > 1 ? k % s.h : 0)) * C, t0: performance.now() });
    }

    /* ---------- the end ---------- */
    win() {
      this.ended = true; this.lock = 'won';
      this.cursor.active = false; this.grab = null; this.hintShow = null;
      this.rig.play('happy');
      this.say('congratulations', STR.free, { sound: false });
      this.walk = { t0: performance.now() };
    }
    finish() {
      const run = {
        escaped: true, level: this.level, mode: this.ctx.mode, moves: this.moves, par: this.parNow, basePar: this.par,
        energy: this.f.energy ? this.energy : 0, hasEnergy: !!this.f.energy, knocks: this.knocksOk, knockRounds: this.knockRounds, knocksMissed: this.knocksMissed,
        warning: this.warning, hints: this.hints, matchUsed: this.matchUsed, hasMatch: !!this.items.find(i => i.type === 'match'),
        loadBearing: this.loadBearing, dustHits: this.dustHits, aftershocks: this.aftershocks, photos: this.photos.slice(),
        usedMs: performance.now() - this.t0
      };
      this.onEnd(run);
    }

    /* ---------- the frame ---------- */
    frame(dt) {
      if (this.t0 == null) this.t0 = performance.now();
      if (this.knock) this.knock.update(dt);
      // blocks glide to their cells (snap under Reduce Motion or while dragging)
      const step = dt * 1000 * C / T.slideMs;
      for (const b of this.blocks) {
        const c = this.cellOf(b), tx = this.ox + c.x * C, ty = this.oy + c.y * C;
        const snap = this.reduce || (this.grab && this.grab.b === b);
        b.px = snap ? tx : b.px + AG.util.clamp(tx - b.px, -step, step);
        b.py = snap ? ty : b.py + AG.util.clamp(ty - b.py, -step, step);
      }
      if (this.walk) {
        const k = (performance.now() - this.walk.t0) / T.walkMs;
        if (k >= 1 && !this.walk.cheer) { this.walk.cheer = true; this.rig.play('cheer'); AG.sfx.play('rubble-rescue.sfx.cheer'); AG.kit.celebrate(this.stage); this.ctx.after(900, () => this.finish()); }
      }
      this.syncHudRig();
      this.draw();
    }
    draw() {
      const g = this.view.ctx, now = performance.now(), t = now / 1000, n = this.n, bw = n * C;
      g.save();
      if (now < this.quakeUntil && !this.reduce) g.translate(Math.floor(t * 30) % 2 ? 1 : -1, 0);
      if (!AG.assets.draw(g, 'rubble-rescue.bg', 0, 0, 480, 270)) { g.fillStyle = '#2a2240'; g.fillRect(0, 0, 480, 270); }
      // the board and its floor
      g.fillStyle = '#1e1538'; g.fillRect(this.ox - 4, this.oy - 4, bw + 8, bw + 8);
      for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) AG.assets.draw(g, 'rubble-rescue.floor', this.ox + x * C, this.oy + y * C, C, C);
      // the escape row: a lit path with chevrons where it is already clear
      g.fillStyle = 'rgba(255, 210, 63, .16)'; g.fillRect(this.ox, this.rowY, bw, C);
      for (let x = 0; x < n; x++) if (!this.blockAt(x, this.row)) { g.fillStyle = 'rgba(255, 210, 63, .7)'; const cx = this.ox + x * C + 13, cy = this.rowY + 12; for (let i = 0; i < 4; i++) g.fillRect(cx + i, cy + i, 2, 1), g.fillRect(cx + i, cy + 7 - i, 2, 1); }
      // floor items (photos lie under blocks until uncovered)
      for (const it of this.items) {
        if (it.done) continue;
        const x = this.ox + it.x * C, y = this.oy + it.y * C;
        AG.assets.draw(g, 'rubble-rescue.cell_item', x, y, C, C);
        // 😷 and 🔥 are kit icons (facemask, flame); 📸 has none yet
        if (it.type === 'photo') g.drawImage(AG.pixelIcon('📸', 18, true), x + 7, y + 7);
        else AG.gfx.drawIcon(g, it.type === 'mask' ? 'facemask' : 'flame', x + 7, y + 7, 1);
      }
      // blocks
      for (const b of this.blocks) {
        const s = this.sizeOf(b);
        let dx = 0;
        if (this.shake && this.shake.b === b && now < this.shake.until) dx = this.reduce ? 0 : (Math.floor(t * 40) % 2 ? 1 : -1);
        AG.assets.draw(g, artKey(b), Math.round(b.px) + dx, Math.round(b.py), s.w * C, s.h * C);
        if (b.i < 0 && this.f.loadBearing) g.drawImage(AG.pixelIcon('⚠️', 10, true), Math.round(b.px) + dx + 2, Math.round(b.py) + 2);
        if (this.shake && this.shake.b === b && now < this.shake.until && this.reduce) this.outline(g, b.px, b.py, s.w * C, s.h * C, '#e0245e');
      }
      // board frame with the pocket opening (left) and the exit gap (right) on the escape row
      g.fillStyle = '#5b4a3a';
      g.fillRect(this.ox - 4, this.oy - 4, bw + 8, 4); g.fillRect(this.ox - 4, this.oy + bw, bw + 8, 4);
      g.fillRect(this.ox - 4, this.oy, 4, this.rowY - this.oy); g.fillRect(this.ox - 4, this.rowY + C, 4, this.oy + bw - this.rowY - C);
      g.fillRect(this.ox + bw, this.oy, 4, this.rowY - this.oy); g.fillRect(this.ox + bw, this.rowY + C, 4, this.oy + bw - this.rowY - C);
      this.drawExit(g, t);
      this.drawPocket(g, t);
      if (this.f.knocks) this.drawPipe(g, now);
      if (this.knock) this.knock.draw(g, this.knockBox);
      if (this.hintShow) this.drawHint(g, t);
      if (this.grab) this.drawGrab(g, t);
      else if (!this.lock) this.cursor.draw(g, t);
      this.drawFx(g, now);
      g.restore();
    }
    outline(g, x, y, w, hh, color) {
      x = Math.round(x); y = Math.round(y);
      g.fillStyle = color; g.fillRect(x, y, w, 2); g.fillRect(x, y + hh - 2, w, 2); g.fillRect(x, y, 2, hh); g.fillRect(x + w - 2, y, 2, hh);
    }
    drawExit(g, t) {
      const gx = this.gap.x, gy = this.gap.y;
      g.fillStyle = '#0a0b1f'; g.fillRect(gx, gy, C, C);
      AG.assets.draw(g, 'rubble-rescue.light.exit', gx, gy, C, C);
      AG.assets.draw(g, 'rubble-rescue.light.rescuer', gx + C, gy, C, C);
      this.expert.draw(g, gx + C + 34, gy + C + 12, t);
    }
    drawPocket(g, t) {
      const P = this.pocket;
      if (this.walk) {
        const k = Math.min(1, (performance.now() - this.walk.t0) / T.walkMs);
        const x0 = P.x + P.w / 2, x1 = this.gap.x + C / 2;
        this.rig.draw(g, Math.round(x0 + (x1 - x0) * k), this.rowY + C + 6, t);
        return;
      }
      // the 48 × 48 bust frame: ink edge, dark niche, the rig cropped at the chest
      g.fillStyle = '#1e1538'; g.fillRect(P.x - 2, P.y - 2, P.w + 4, P.h + 4);
      g.fillStyle = '#3a2f55'; g.fillRect(P.x, P.y, P.w, P.h);
      g.save();
      g.beginPath(); g.rect(P.x, P.y, P.w, P.h); g.clip();
      this.rig.draw(g, P.x + P.w / 2, P.y + P.h + 10, t);
      g.restore();
      g.fillStyle = '#ffd23f'; g.fillRect(P.x - 2, P.y - 2, P.w + 4, 1); g.fillRect(P.x - 2, P.y + P.h + 1, P.w + 4, 1);
    }
    drawPipe(g, now) {
      const P = this.pipe, answering = this.knock && this.knock.phase === 'answer';
      const hit = now - this.pipeHitAt < 120 && !this.reduce ? 1 : 0;
      if (answering) { g.fillStyle = 'rgba(255, 210, 63, .35)'; g.fillRect(P.x - 4, P.y - 4, P.w + 8, P.h + 8); }
      AG.assets.draw(g, 'rubble-rescue.pipe', P.x, P.y + hit, P.w, P.h);
      if (answering) g.drawImage(AG.pixelIcon('👆', 14, true), P.x + P.w / 2 - 7, P.y + P.h + 2);
    }
    drawHint(g, t) {
      const hs = this.hintShow, b = this.byIndex[hs.i], s = this.sizeOf(b);
      const bob = this.reduce ? 0 : Math.floor(t * 3) % 2;
      const [vx, vy] = VEC[hs.dir], cx = b.px + s.w * C / 2, cy = b.py + s.h * C / 2;
      const ax = Math.round(cx + vx * (s.w * C / 2 + 8 + bob) - 8), ay = Math.round(cy + vy * (s.h * C / 2 + 8 + bob) - 8);
      this.outline(g, b.px - 1, b.py - 1, s.w * C + 2, s.h * C + 2, '#ffd23f');
      g.drawImage(AG.pixelIcon(ARROW[hs.dir], 16, true), ax, ay);
    }
    drawGrab(g, t) {
      const b = this.grab.b, s = this.sizeOf(b), w = s.w * C, hh = s.h * C;
      this.outline(g, b.px - 2, b.py - 2, w + 4, hh + 4, '#ffd23f');
      this.outline(g, b.px - 4, b.py - 4, w + 8, hh + 8, '#1e1538');
      const [a, z] = AXIS_DIRS[b.axis];
      if (b.axis === 'h') {
        g.drawImage(AG.pixelIcon(ARROW[a], 12, true), Math.round(b.px) - 14, Math.round(b.py + hh / 2 - 6));
        g.drawImage(AG.pixelIcon(ARROW[z], 12, true), Math.round(b.px + w) + 2, Math.round(b.py + hh / 2 - 6));
      } else {
        g.drawImage(AG.pixelIcon(ARROW[a], 12, true), Math.round(b.px + w / 2 - 6), Math.round(b.py) - 14);
        g.drawImage(AG.pixelIcon(ARROW[z], 12, true), Math.round(b.px + w / 2 - 6), Math.round(b.py + hh) + 2);
      }
    }
    drawFx(g, now) {
      const life = T.dustFrames * 1000 / T.dustFps;
      this.fx = this.fx.filter(f => now - f.t0 < life);
      for (const f of this.fx) AG.assets.draw(g, 'rubble-rescue.fx.dust', f.x, f.y, C, C, Math.floor((now - f.t0) / (1000 / T.dustFps)));
    }

    destroy() {
      this.dead = true;
      clearTimeout(this.reactT);
      if (this.stop) this.stop();
      if (this.warnChoices) this.warnChoices.destroy();
      this.offs.forEach(f => f()); this.offs = [];
      if (this.panel) this.panel.remove();
      if (this.el) this.el.remove();
    }
  }

  RR.Scene = Scene;
})(window.AG);
