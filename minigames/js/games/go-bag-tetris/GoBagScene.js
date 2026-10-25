/* Go Bag Tetris: the scene both modes play in (PackPuzzle.js, ConveyorRush.js plug into it).
 *
 *   const scene = new AG.goBag.Scene(stage, ctx, done, { level, spec, items, scenarios })
 *
 * The E5 pieces engine does the moving (PiecePlay over a GridBoard bag and a Tray shelf, Tab: shelf ↔ bag ↔
 * buttons). This file adds the go-bag parts: the bag and shelf art, the 🗑 bin (drag, tap or X), 💡 hints, the
 * Pack it! button, the player's portrait (think while holding, happy for an essential, worried for a decoy,
 * hold:go_bag then cheer when packed), scenario cards read by the role expert, the L5 weight bar, the score and
 * the checklist reveal before the results. The numbers and scoring rules are tuning.js. */
window.AG = window.AG || {};
(function (AG) {
  const { h } = AG.util;
  const GB = AG.goBag, T = GB.tuning, SC = GB.scoring, GS = AG.logic.goBagSolve, P = AG.pieces, SH = AG.logic.pieceShape;
  const K = 'go-bag-tetris.';
  const pick = v => AG.pick(v);
  const fmt = (t, vars) => pick(t).replace(/\{(\w+)\}/g, (_, k) => (vars[k] == null ? '' : vars[k]));
  const kg = t => (t / 10).toFixed(1).replace(/\.0$/, '');
  const mmss = ms => { const s = Math.max(0, Math.ceil(ms / 1000)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
  const listOf = names => (names.length < 2 ? names.join('') : names.slice(0, -1).join(', ') + ' and ' + names[names.length - 1]);

  const STR = {
    score: { en: 'Score' }, space: { en: 'Space' }, shelf: { en: 'Shelf: things you could pack' }, belt: { en: 'Conveyor belt' },
    backpack: { en: 'Go bag (backpack)' }, duffel: { en: 'Go bag (duffel bag)' },
    bin: { en: 'Toss' }, binLabel: { en: 'Toss: leave it at home (X)' }, hint: { en: 'Hint' }, pack: { en: 'Pack it!' }, packAnyway: { en: 'Pack anyway' },
    pickFirst: { en: 'Pick something from the shelf and fit it into the bag.' },
    pickFirstRush: { en: 'Items come on the belt. Put each one in the bag, or toss it, before the ring runs out.' },
    holding: { en: 'Holding: **{name}**' },
    noRoom: { en: "No room there. Try another spot." }, noRoomTurn: { en: "No room there. Turn it (↻ or R) or try another spot." },
    allEssentials: { en: 'All the essentials are in! :check:' },
    forWho: { en: '{name} packed for {who}!' },
    decoyOut: { en: 'Good call! The {name} stays at home.' },
    niceOut: { en: 'OK, the {name} stays at home.' },
    keepEssential: { en: "Keep the {name} in! It's an essential for every go bag." },
    keepScenario: { en: 'Keep the {name} in! {who} needs it.' },
    missingConfirm: { en: 'Wait! {list} {verb} not packed yet. Press **Pack it!** again to go anyway.' },
    tooHeavy: { en: 'Too heavy to carry! Take out {kg} kg so you can lift the bag.' },
    heavyLine: { en: 'Too heavy!' },
    weight: { en: 'Weight' }, weightOf: { en: '{w} / {max} kg' },
    hintTry: { en: 'Try the {name} here. It fits!' },
    hintRemove: { en: 'The {name} is using space you need. Toss it or move it.' },
    hintStuck: { en: "It won't all fit like this. Press ↶ Undo, then pack the big things first." },
    hintDone: { en: 'Everything you need is packed! Fill the gaps with useful extras, or press **Pack it!**' },
    hintNone: { en: 'Pick up an item first, then press 💡 for a spot.' },
    cardRead: { en: 'Read the card' },
    // the checklist reveal
    checkTitle: { en: 'Go bag check' }, essentials: { en: 'Essentials' }, family: { en: 'For your family' }, extras: { en: 'Nice to have' },
    home: { en: 'Better left at home' }, packed: { en: 'packed' }, missing: { en: 'not packed' }, leftHome: { en: 'left at home' },
    inBag: { en: 'in the bag' }, leftOut: { en: 'left out' }, of: { en: '{a} of {b}' }, continue: { en: 'Continue' },
    sum3: { en: 'A perfect go bag: everything you need, nothing you don\'t!' },
    sum2: { en: 'Everything you need is packed!' },
    sum1: { en: 'All the essentials are packed!' },
    sum0: { en: 'Some things you need were left behind.' },
    closing: { en: 'Keep your go bag by the door, and check it at the start of every typhoon season.' },
    // the results screen
    msg3: { en: 'A perfect go bag! Safe things first, no wasted space.' },
    msg3rush: { en: 'A perfect go bag, packed fast and sure! Safe things first.' },
    msg2pack: { en: 'Your family is ready! For 3 stars, fill the space with useful extras.' },
    msg2decoy: { en: 'Your family is ready! For 3 stars, leave the things you don\'t need at home.' },
    msg2rush: { en: 'Your family is ready! For 3 stars, leave the decoys behind and place things a little faster.' },
    msg1: { en: 'All the essentials are in! Next time, pack what your family needs, too.' },
    msg0: { en: 'Some essentials were left behind. Check the list and try again. You can do it!' },
    dEss: { en: 'Essentials' }, dFam: { en: 'Family items' }, dSpace: { en: 'Bag space used' }, dLeft: { en: 'Time left per item' },
    dWeight: { en: 'Weight' }, dDecoys: { en: 'Decoys packed' }, sec: { en: '{n} s' }
  };

  /* ---------- styles, once per page (all under #ag-app, classes gb-) ---------- */
  const CSS = `
#ag-app .gb { position: relative; isolation: isolate; display: grid; gap: 10px; grid-template-columns: minmax(0, 1fr); grid-template-areas: "side" "play"; color: var(--fg); font-variant-ligatures: none; }
@container (min-width: 720px) { #ag-app .gb { grid-template-columns: 230px minmax(0, 1fr); grid-template-areas: "side play"; align-items: start; } }
#ag-app .gb-side { grid-area: side; display: flex; flex-wrap: wrap; gap: 8px; align-items: stretch; min-width: 0; }
@container (min-width: 720px) { #ag-app .gb-side { flex-direction: column; flex-wrap: nowrap; } #ag-app .gb-side > .gb-status { flex: 0 0 auto; } }
@container (max-width: 480px) { #ag-app .gb { margin-inline: -10px; } }   /* a 6-wide bag at ×2 is 338 px: use the panel's side padding on phones */
#ag-app .gb-who { flex: none; display: flex; flex-direction: column; align-items: center; }
#ag-app .gb-who__fig { position: relative; display: flex; align-items: flex-start; justify-content: center; width: 72px; height: 76px; overflow: hidden; }
@container (min-width: 720px) { #ag-app .gb-who__fig { width: 120px; height: 120px; } #ag-app .gb-who__fig .ag-charimg { transform: scale(1.5); transform-origin: top center; image-rendering: pixelated; } }
#ag-app .gb-who__prop { position: absolute; right: 0; bottom: 4px; }
#ag-app .gb-who__tag { margin-top: 2px; padding: 0 6px; font: 700 .75rem var(--font-display); color: #1e1538; background: #fff4cc; border: 2px solid #1e1538; white-space: nowrap; }
#ag-app .gb-status { flex: 1 1 180px; min-width: 0; display: grid; gap: 6px; align-content: start; padding: 8px 10px; color: #1e1538; background: #fff4cc; border: var(--b) solid #1e1538; box-shadow: 3px 3px 0 var(--shadow-c); }
#ag-app .gb-line { margin: 0; min-height: 2.7em; font-weight: 700; line-height: 1.35; }
#ag-app .gb-line .rs-em, #ag-app .gb-line strong { color: #6a2b00; }
#ag-app .gb-signal { display: flex; align-items: center; gap: 8px; font: 700 1rem var(--font-display); }
#ag-app .gb-signal img { width: 32px; height: 32px; image-rendering: pixelated; }
#ag-app .gb-signal[data-n="4"], #ag-app .gb-signal[data-n="5"] { color: #a1123f; }
#ag-app .gb-weight { display: grid; gap: 3px; }
#ag-app .gb-weight__row { display: flex; justify-content: space-between; gap: 8px; font: 700 .85rem var(--font-display); white-space: nowrap; }
#ag-app .gb-weight .ag-meter { height: 16px; }
#ag-app .gb-weight.is-over .gb-weight__row { color: #a1123f; }
#ag-app .gb-weight.is-over .gb-weight__row b::before { content: "▲ "; }
#ag-app .gb-cards { flex: 1 1 100%; display: flex; flex-wrap: wrap; gap: 8px; }
@container (min-width: 720px) { #ag-app .gb-cards { flex-direction: column; } }
#ag-app .gb-card { flex: 1 1 150px; display: flex; align-items: center; gap: 8px; min-height: 52px; padding: 4px 8px 4px 4px; text-align: left; font: 700 .85rem/1.2 var(--font-display); color: #1e1538; background: #fffaf0; border: 2px solid #1e1538; box-shadow: 2px 2px 0 var(--shadow-c); cursor: pointer; }
#ag-app .gb-card:focus-visible { outline: 3px solid var(--vest); outline-offset: 2px; }
#ag-app .gb-card__art { flex: none; width: 48px; height: 48px; image-rendering: pixelated; }
#ag-app .gb-card__txt { flex: 1 1 auto; min-width: 0; display: grid; gap: 2px; }
#ag-app .gb-card__need { display: flex; flex-wrap: wrap; gap: 4px; }
#ag-app .gb-need { position: relative; display: inline-flex; width: 22px; height: 22px; align-items: center; justify-content: center; background: #fff; border: 2px dashed #1e1538; }
#ag-app .gb-need img { width: 18px; height: 18px; image-rendering: pixelated; }
#ag-app .gb-need.is-in { border-style: solid; background: #dff7e3; }
#ag-app .gb-need.is-in::after { content: "✔"; position: absolute; right: -7px; top: -8px; font: 900 11px/1 var(--font-display); color: #fff; background: #2f8a4a; border: 1px solid #1e1538; padding: 1px 2px; }
#ag-app .gb-card.is-done { background: #dff7e3; }

#ag-app .gb-play { grid-area: play; min-width: 0; }
#ag-app .gb .agp-play__board { padding: 22px 0 12px; }
/* the bag: its 9-slice art is a frame behind the board (top and bottom only on a narrow screen) */
#ag-app .gb .agp-board { border: 1px solid #1e1538; }
#ag-app .gb .agp-board::before { content: ""; position: absolute; z-index: -1; inset: -16px -1px; border: solid transparent; border-width: 16px 0; border-image: var(--gb-bag) 16 / 16px 0 stretch; image-rendering: pixelated; pointer-events: none; }
#ag-app .gb.is-framed .agp-board { border-width: 0; }
#ag-app .gb.is-framed .agp-board::before { inset: -16px; border-width: 16px; border-image-width: 16px; }
#ag-app .gb .agp-cell.is-wall { background-color: #3b2a55; }
#ag-app .gb .agp-piece.gb-flag { outline: 4px dashed var(--vest); outline-offset: -4px; animation: gb-blink .9s steps(2) infinite; }
@keyframes gb-blink { 50% { outline-color: transparent; } }
/* the shelf (and the belt in Rush) + the bin */
#ag-app .gb-shelfrow { display: flex; align-items: stretch; gap: 8px; width: 100%; min-width: 0; }
#ag-app .gb-shelfrow > .agp-tray { flex: 1 1 auto; min-width: 0; }
#ag-app .gb .agp-tray { border: 8px solid #1e1538; border-image: var(--gb-shelf) 8 fill / 8px stretch; background: transparent; image-rendering: pixelated; }
#ag-app .gb .agp-tray > * { image-rendering: auto; }
#ag-app .gb .agp-tray .agp-piece__art { image-rendering: pixelated; }
#ag-app .gb .agp-tray__shelf { min-height: 84px; }
#ag-app .gb-bin { flex: none; display: inline-flex; align-items: center; gap: 6px; min-width: 48px; min-height: 48px; padding: 4px 12px 4px 8px; font: 700 .95rem var(--font-display); color: var(--fg); background: var(--panel); border: var(--b) dashed var(--line); border-radius: var(--r); cursor: pointer; touch-action: none; }
#ag-app .gb-bin img { width: 32px; height: 32px; image-rendering: pixelated; pointer-events: none; }
#ag-app .gb-bin span { pointer-events: none; }
#ag-app .gb-bin.hot, #ag-app .gb-bin:focus-visible { outline: 3px solid var(--sky); outline-offset: 2px; border-style: solid; }
#ag-app .gb .ag-btn.gb-pack { font-size: 1.05rem; }
#ag-app .gb .ag-btn.gb-pack.is-armed { background: #ffd23f; color: #1e1538; }
#ag-app .gb .agp-btn.is-off.gb-pack { opacity: .55; }
#ag-app .gb .agp-btn[hidden] { display: none; }
/* L1: names under the items */
#ag-app .gb-label { display: none; }
#ag-app .gb--labels .agp-tray .gb-label { display: block; position: absolute; left: 50%; top: calc(100% + 3px); transform: translateX(-50%); width: max-content; max-width: 92px; font: 700 11px/1.15 var(--font-display); text-align: center; color: #1e1538; background: #fffaf0; border: 1px solid #1e1538; padding: 0 3px; pointer-events: none; line-height: 1.2; }
#ag-app .gb--labels .agp-tray__shelf { gap: 22px; padding-bottom: 40px; }
#ag-app .gb--labels .agp-tray .agp-piece.is-held::after { bottom: auto; top: -16px; content: "▼"; }
/* Rush: the belt, the ring and NEXT */
#ag-app .gb-beltwrap { position: relative; flex: 1 1 auto; min-width: 0; display: flex; align-items: center; gap: 8px; }
#ag-app .gb-beltwrap > .agp-tray { flex: 1 1 auto; min-width: 0; }
#ag-app .gb--rush .agp-tray__shelf { justify-content: center; overflow: hidden; min-height: 118px; padding-bottom: 30px; background: var(--gb-belt) left bottom 4px / 56px 20px repeat-x; image-rendering: pixelated; }
#ag-app .gb--rush .agp-tray__shelf.is-moving { animation: gb-belt .5s steps(7) infinite; }
@keyframes gb-belt { to { background-position-x: -56px; } }
#ag-app .gb-ring { flex: none; display: grid; place-items: center; position: relative; }
#ag-app .gb-ring b { position: absolute; font: 700 .9rem var(--font-display); }
#ag-app .gb-next { flex: none; display: grid; gap: 4px; justify-items: center; align-content: start; min-width: 64px; padding: 4px 6px; background: var(--panel); border: 2px solid var(--line); border-radius: var(--r); font: 700 .75rem var(--font-display); color: var(--muted); }
#ag-app .gb-next__items { display: flex; gap: 6px; align-items: flex-end; min-height: 56px; }
#ag-app .gb-next__items canvas:first-child { outline: 2px dashed var(--line); outline-offset: 2px; }
#ag-app .gb-arrive { animation: gb-arrive .32s steps(4) both; }
@keyframes gb-arrive { from { transform: translateX(80px); } }
#ag-app .gb-fall { position: fixed; z-index: 60; pointer-events: none; animation: gb-fall .5s steps(5) forwards; }
@keyframes gb-fall { to { transform: translateY(60px); opacity: 0; } }
@container (max-width: 480px) { #ag-app .gb-next { min-width: 0; } #ag-app .gb-next__items canvas:nth-child(2) { display: none; } }

/* the checklist reveal */
#ag-app .gb-check { grid-area: side; display: grid; gap: 8px; padding: 12px; color: #1e1538; background: #fffaf0; border: 12px solid #1e1538; border-image: var(--gb-check) 8 fill / 12px stretch; image-rendering: pixelated; }
#ag-app .gb-check > * { image-rendering: auto; }
#ag-app .gb-check__head { display: flex; align-items: flex-end; justify-content: space-between; gap: 8px; }
#ag-app .gb-check__head h2 { margin: 0; flex: 1 1 auto; text-align: center; font: 700 1.3rem var(--font-display); }
#ag-app .gb-check__fig { position: relative; width: 64px; height: 72px; overflow: hidden; display: flex; justify-content: center; }
#ag-app .gb-check__sum { margin: 0; font-weight: 700; text-align: center; }
#ag-app .gb-check__grp { margin: 4px 0 0; font: 700 .8rem var(--font-display); text-transform: uppercase; letter-spacing: .06em; color: #5a4a7a; }
#ag-app .gb-check ul { list-style: none; margin: 0; padding: 0; display: grid; gap: 3px; }
#ag-app .gb-row { display: grid; grid-template-columns: 22px 24px minmax(0, 1fr) auto; align-items: center; gap: 6px; padding: 2px 4px; font-weight: 700; font-size: .92rem; }
#ag-app .gb-row img { image-rendering: pixelated; }
#ag-app .gb-row__mark { display: grid; place-items: center; width: 22px; height: 22px; font: 900 14px/1 var(--font-display); color: #fff; border: 2px solid #1e1538; }
#ag-app .gb-row.is-ok .gb-row__mark { background: #2f8a4a; }
#ag-app .gb-row.is-bad .gb-row__mark { background: #c2264b; }
#ag-app .gb-row.is-meh .gb-row__mark { background: #8a7fa6; }
#ag-app .gb-row__state { font-size: .8rem; color: #5a4a7a; }
#ag-app .gb-row__tip { grid-column: 3 / -1; font-weight: 400; font-size: .85rem; line-height: 1.3; }
#ag-app .gb-row.is-bad { background: #ffe3e8; }
#ag-app .gb-check__take { margin: 4px 0 0; padding: 6px 8px; font-weight: 700; background: #fff4cc; border: 2px solid #1e1538; }
#ag-app .gb-check .ag-btn { justify-self: center; min-width: 160px; min-height: 48px; }
@container (min-width: 720px) { #ag-app .gb.is-over { grid-template-columns: minmax(300px, 380px) minmax(0, 1fr); } }
#ag-app .gb.is-over .gb-shelfrow, #ag-app .gb.is-over .agp-buttons { display: none; }
#ag-app .gb-sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
@media (prefers-reduced-motion: reduce) {
  #ag-app .gb--rush .agp-tray__shelf.is-moving, #ag-app .gb-arrive, #ag-app .gb-fall { animation: none; }
}`;
  function injectCss() {
    if (!document.querySelector('style[data-ag-css="go-bag-tetris"]')) document.head.append(h('style', { 'data-ag-css': 'go-bag-tetris' }, CSS));
  }
  const cssUrl = key => { const u = AG.assets.url(key); AG.assets.image(key); return u ? 'url("' + u + '")' : 'none'; };
  /** An item's small icon: an AG.icons name, or an emoji drawn as a pixel icon. */
  const itemIcon = (it, size) => (AG.icons.has(it.icon) ? AG.ui.icon(it.icon, size || 18) : h('img', { class: 'ag-px', src: AG.pixelIcon(it.icon, size || 18), alt: '', width: size || 18, height: size || 18, draggable: 'false' }));

  class Scene {
    constructor(stage, ctx, done, data) {
      injectCss();
      this.stage = stage; this.ctx = ctx; this.doneFn = done;
      const level = this.level = data.level, spec = this.spec = data.spec;
      this.items = data.items; this.scen = data.scenarios;
      this.rush = level.mode === 'rush';
      this.active = new Set(spec.scenarios || []);
      this.ms = 0; this.lastT = performance.now();
      this.offs = []; this.timers = [];
      this.shown = ''; this.reaction = null; this.reactT = 0; this.cheering = null;
      this.said = {}; this.lastBlocked = 0; this.lastToss = 0; this.confirmUntil = 0; this.ended = false; this.essDone = false;
      this.wasOver = false;

      this.pieces = GS.expand(spec.items).map(pid => {
        const it = this.items[GS.itemOf(pid)];
        if (!it) throw new Error('Unknown item ' + pid);
        const p = new P.Piece({ id: pid, shape: it.shape, cell: T.cell, art: K + 'item.' + it.id, label: it.label, data: it, rotatable: SH.rotations(SH.parse(it.shape)).length > 1 });
        if (level.labels) p.el.append(h('span', { class: 'gb-label', 'aria-hidden': 'true' }, pick(it.short || it.label)));
        return p;
      });
      this.byId = new Map(this.pieces.map(p => [p.id, p]));
      this.needed = this.pieces.filter(p => this.isNeeded(p));
      this.maxW = spec.maxWeight != null ? SC.tenths(spec.maxWeight) : null;

      this.ctrl = new (this.rush ? GB.ConveyorRush : GB.PackPuzzle)(this);
      this.build();
      this.hud = ctx.hud({ score: 0, scoreLabel: STR.score, label: STR.space, meter: true, timer: true });
      this.changed();
      this.renderPlayer();
      this.bind();
      this.ctrl.start();
      // the shell focuses the stage after mount; then the shelf takes the keyboard focus
      this.timers.push(setTimeout(() => { if (!this.ended) this.play.focus(); }, 90));
    }

    /* ---------- what an item is ---------- */
    kind(p) { const it = p.data; return it.type === 'scenario' ? (this.active.has(it.scenario) ? 'scenario' : 'nice') : it.type; }
    isNeeded(p) { const k = this.kind(p); return k === 'essential' || k === 'scenario'; }
    whoFor(p) { const s = this.scen[p.data.scenario]; return s ? pick(s.who) : ''; }

    /* ---------- DOM ---------- */
    build() {
      const { ctx, spec } = this;
      this.rig = ctx.rig('portrait');
      this.fig = h('div', { class: 'gb-who__fig' });
      const who = h('div', { class: 'gb-who', 'aria-hidden': 'true' }, this.fig, h('span', { class: 'gb-who__tag' }, AG.chars.get(ctx.characterId).name));
      this.line = h('p', { class: 'gb-line', role: 'status', 'aria-live': 'polite' });
      this.setLine(this.rush ? STR.pickFirstRush : STR.pickFirst);
      this.status = h('div', { class: 'gb-status' }, this.line);
      if (this.maxW != null) {
        this.wNum = h('b');
        this.wMeter = AG.kit.meter({ label: STR.weight, markers: [{ at: 0.8, kind: 'danger', label: { en: 'Most you can carry' } }] });
        this.wLine = h('span', { class: 'gb-weight__lbl' }, pick(STR.weight));
        this.wEl = h('div', { class: 'gb-weight' }, h('div', { class: 'gb-weight__row' }, this.wLine, this.wNum), this.wMeter.el);
        this.status.append(this.wEl);
      }
      this.cards = this.buildCards();
      this.side = h('div', { class: 'gb-side' }, who, this.status, this.cards);

      // the bag, the shelf, the bin
      this.board = new P.GridBoard({ mask: spec.mask, cell: T.cell, cellArt: K + 'bag.cell', maxScale: T.maxScale, label: STR[spec.bag] || STR.backpack });
      this.board.fit = width => this.fitBoard(width);
      this.tray = new P.Tray({ pieces: this.rush ? [] : this.pieces, maxSize: 112, label: this.rush ? STR.belt : STR.shelf });
      this.bin = h('button', { type: 'button', class: 'gb-bin', 'data-dnd-target': '', 'aria-label': pick(STR.binLabel), title: pick(STR.binLabel) },
        h('img', { class: 'ag-px', src: AG.assets.url(K + 'trash') || AG.assets.placeholderURL('trash', 32, 32), alt: '', draggable: 'false' }), h('span', {}, pick(STR.bin)));
      this.binTarget = { el: this.bin, accept: p => this.canToss(p), onDrop: p => this.tossed(p) };

      const pl = this.play = new P.PiecePlay({
        board: this.board, tray: this.tray, undo: !this.rush, lockPlaced: false,
        sfx: { pick: K + 'sfx.pick', place: K + 'sfx.place', rotate: K + 'sfx.rotate', invalid: K + 'sfx.invalid', back: K + 'sfx.pick' },
        targets: [this.binTarget],
        buttons: [{ id: 'hint', glyph: '', label: STR.hint, onClick: () => this.hint() }, { id: 'pack', glyph: '✔', label: STR.pack, onClick: () => this.packIt() }],
        onPick: (p, from) => this.picked(p, from),
        onPlace: (p, at, info) => this.placed(p, at, info),
        onBlocked: (p, res, info) => this.blocked(p, res, info),
        onReturn: (p, info) => this.returned(p, info),
        onRotate: () => this.renderPlayer(),
        onChange: () => this.changed(),
        onUndo: () => this.renderPlayer()
      });
      pl.btn.hint.querySelector('.agp-btn__glyph').replaceChildren(AG.ui.icon('bulb', 24));
      pl.btn.hint.title = pick(STR.hint) + ' (H)';
      pl.btn.pack.classList.remove('ag-btn--alt'); pl.btn.pack.classList.add('gb-pack');
      this.packLabel = pl.btn.pack.lastChild;
      this.shelfRow = h('div', { class: 'gb-shelfrow' });
      pl.el.insertBefore(this.shelfRow, this.tray.el);
      this.shelfRow.append(this.tray.el);
      pl.buttonsEl.insertBefore(this.bin, pl.btn.hint); // below the shelf: tossing is a downward drag (a sideways one would scroll the shelf)

      this.root = h('div', { class: 'gb gb--' + this.level.mode + (this.level.labels ? ' gb--labels' : '') }, this.side, h('div', { class: 'gb-play' }, pl.el));
      this.root.style.setProperty('--gb-bag', cssUrl(K + 'bag.' + spec.bag));
      this.root.style.setProperty('--gb-shelf', cssUrl(K + 'shelf'));
      this.root.style.setProperty('--gb-check', cssUrl(K + 'ui.checklist'));
      this.ctrl.build(this.root);
      this.stage.append(this.root);
    }
    buildCards() {
      const wrap = h('div', { class: 'gb-cards' });
      this.cardEls = [];
      (this.spec.scenarios || []).forEach(id => {
        const s = this.scen[id];
        const needs = s.items.map(iid => { const el = h('span', { class: 'gb-need', title: pick(this.items[iid].label) }, itemIcon(this.items[iid], 18)); el.dataset.item = iid; return el; });
        const b = h('button', { type: 'button', class: 'gb-card', 'aria-label': pick(s.title) + '. ' + AG.dialogue.plain(pick(s.text)) },
          h('img', { class: 'ag-px gb-card__art', src: AG.assets.url(s.card) || AG.assets.placeholderURL(id, 48, 48), alt: '', draggable: 'false', width: 48, height: 48 }),
          h('span', { class: 'gb-card__txt' }, h('span', {}, pick(s.title)), h('span', { class: 'gb-card__need' }, needs)));
        this.offs.push(P.onPress(b, () => this.readCard(s)));
        this.cardEls.push({ s, el: b, needs });
        wrap.append(b);
      });
      wrap.hidden = !this.cardEls.length;
      return wrap;
    }
    /** The role expert reads a scenario card (it shows on screen too). */
    readCard(s) { this.ctx.say('info', s.text, { title: pick(s.title) }); }
    setLine(t, vars) { const txt = vars ? fmt(t, vars) : pick(t); if (this.lineTxt === txt) return; this.lineTxt = txt; this.line.replaceChildren(); AG.dialogue.renderText(txt, this.line); }

    /** The bag's scale: the largest whole multiple that fits the width (minus the frame) and leaves room below. */
    fitBoard(width) {
      const b = this.board, framed = this.root && this.root.clientWidth >= 560;
      if (this.root) this.root.classList.toggle('is-framed', framed);
      const side = framed ? 32 : 2, maxH = Math.max(b.h * T.cell, window.innerHeight - T.reservedH[this.rush ? 'rush' : 'pack']);
      let s = T.maxScale;
      while (s > 1 && (b.w * T.cell * s + side > width || b.h * T.cell * s > maxH)) s--;
      if (s !== b.scale) b.setScale(s);
      return s;
    }

    bind() {
      const { ctx } = this;
      AG.input.register('TOSS', { keys: ['KeyX'], button: STR.bin });
      this.offs.push(AG.input.on('TOSS', e => { if (e.phase === 'down') this.tossKey(); }));
      this.offs.push(AG.input.on('HINT', e => { if (e.phase === 'down') this.hint(); }));
      this.offs.push(P.onPress(this.bin, () => this.binPress()));
      ctx.onPause(p => {
        if (p) this.play.cancelDrag(); else { this.lastT = performance.now(); if (!this.ended) this.timers.push(setTimeout(() => this.play.zones.apply(), 0)); }
        this.ctrl.pause(p);
      });
      this.tickId = ctx.every(200, () => this.tick());
    }
    tick() {
      const now = performance.now();
      if (!this.ended) this.ms += Math.min(500, now - this.lastT);
      this.lastT = now;
      this.hud.set({ timer: mmss(this.ctrl.clockLeft != null ? this.ctrl.clockLeft() : this.ms) });
      if (this.confirmUntil && now > this.confirmUntil) { this.confirmUntil = 0; this.syncPack(); }
    }

    /* ---------- the bag's state ---------- */
    counts() {
      const c = { essential: 0, scenario: 0, nice: 0, decoy: 0 };
      this.board.pieces.forEach(p => { c[this.kind(p)]++; });
      return c;
    }
    weight() { return SC.weight(this.board.pieces.map(p => p.data)); }
    missing() { return this.needed.filter(p => p.state !== 'placed'); }
    allOf(kind) { return this.needed.filter(p => this.kind(p) === kind).every(p => p.state === 'placed'); }
    overWeight() { return SC.overWeight(this.weight(), this.maxW != null ? this.maxW / 10 : null); }
    score() { return SC.points({ counts: this.counts(), missed: this.ctrl.missedCount ? this.ctrl.missedCount() : 0 }); }

    changed() {
      const st = this.board.stats();
      this.hud.set({ score: this.score(), label: st.filled + ' / ' + st.capacity, meter: st.efficiency });
      // scenario cards: a ✔ on each packed thing
      this.cardEls.forEach(c => {
        const placedIds = new Set(this.board.pieces.map(p => p.data.id));
        c.needs.forEach(n => n.classList.toggle('is-in', placedIds.has(n.dataset.item)));
        c.el.classList.toggle('is-done', c.needs.every(n => n.classList.contains('is-in')));
      });
      if (this.maxW != null) {
        const w = this.weight(), over = w > this.maxW;
        this.wNum.textContent = fmt(STR.weightOf, { w: kg(w), max: kg(this.maxW) });
        this.wMeter.set(w / (this.maxW / 0.8));
        this.wEl.classList.toggle('is-over', over);
        this.wLine.textContent = pick(over ? STR.heavyLine : STR.weight);
        if (over && !this.wasOver && !this.ended) this.ctx.say('warning', fmt(STR.tooHeavy, { kg: kg(w - this.maxW) }));
        this.wasOver = over;
      }
      const ess = this.allOf('essential');
      if (ess && !this.essDone && !this.ended) { this.essDone = true; this.ctx.say('success', STR.allEssentials, { sound: false }); }
      if (!ess) this.essDone = false;
      this.syncPack();
    }
    /** Pack it! is off while the bag is too heavy (and, in Rush, while the belt still runs). */
    syncPack() {
      const b = this.play.btn.pack, ready = this.ctrl.canFinish(), heavy = this.overWeight();
      b.hidden = !ready;
      const off = this.ended || heavy;
      b.setAttribute('aria-disabled', String(off)); b.classList.toggle('is-off', off);
      b.title = heavy ? pick(STR.heavyLine) : '';
      b.classList.toggle('is-armed', !!this.confirmUntil);
      this.packLabel.textContent = pick(this.confirmUntil ? STR.packAnyway : STR.pack);
    }

    /* ---------- PiecePlay events ---------- */
    picked(p, from) {
      if (from.kind === 'board') this.liftedFrom = { piece: p, at: Object.assign({}, from.at), rot: from.rot };
      else this.liftedFrom = null;
      // keyboard: start the ghost at the nearest spot where it fits, so keys are as quick as a drag
      if (from.kind === 'tray' && AG.input.lastDevice === 'keyboard' && !this.board.canPlace(p, this.play.cur.x, this.play.cur.y).ok) {
        const n = this.nearestFit(p, [p.rot]);
        if (n) { this.play.cur = { x: n.x, y: n.y }; this.play.showGhost(); }
      }
      this.setLine(STR.holding, { name: p.label });
      this.renderPlayer();
      this.ctrl.picked(p, from);
    }
    placed(p, at, info) {
      const k = this.kind(p), it = p.data;
      if (k === 'decoy') { this.react('worried'); this.ctx.say('retry', it.why); }
      else if (k === 'nice') { this.react('happy'); if (!this.said[it.id]) { this.said[it.id] = 1; this.ctx.say('success', it.why, { sound: false }); } }
      else if (k === 'scenario') { this.react('happy'); this.ctx.say('success', fmt(STR.forWho, { name: pick(it.label), who: this.whoFor(p) }), { sound: false }); }
      else this.react('happy');
      this.setLine(this.rush ? STR.pickFirstRush : STR.pickFirst);
      this.ctrl.placed(p, info);
    }
    blocked(p, res, info) {
      const now = performance.now();
      if (now - this.lastBlocked > 3500) { this.lastBlocked = now; this.ctx.say('retry', p.rotatable ? STR.noRoomTurn : STR.noRoom, { sound: false }); }
    }
    returned(p, info) {
      // in Rush the shelf is the belt: a bag item let go over it goes back into the bag where it was
      if (this.rush && this.tray.has(p) && this.liftedFrom && this.liftedFrom.piece === p && !this.ctrl.isFront(p)) {
        const lf = this.liftedFrom; this.liftedFrom = null;
        this.play.apply(p, { kind: 'board', at: lf.at, rot: lf.rot });
        this.changed();
      }
      this.setLine(this.rush ? STR.pickFirstRush : STR.pickFirst);
      this.renderPlayer();
      this.ctrl.returned(p, info);
    }

    /* ---------- tossing ---------- */
    canToss(p) {
      if (this.ended) return false;
      const k = this.kind(p);
      if ((k === 'essential' || k === 'scenario') && !(this.rush && this.ctrl.isFront(p))) {
        this.ctx.say('warning', fmt(k === 'essential' ? STR.keepEssential : STR.keepScenario, { name: pick(p.data.label), who: this.whoFor(p) }));
        return false;
      }
      return true;
    }
    tossed(p) {
      this.lastToss = performance.now();
      AG.sfx.play(K + 'sfx.toss');
      const k = this.kind(p), name = pick(p.data.label);
      if (k === 'decoy') { this.react('happy'); this.ctx.say('success', fmt(STR.decoyOut, { name }), { sound: false }); }
      else if (k === 'nice') this.setLine(STR.niceOut, { name });
      this.ctrl.tossed(p);
      this.renderPlayer();
      this.changed();
    }
    /** X: toss what is held, or the shelf item that has the focus (Rush: the item on the belt). */
    tossKey() {
      if (this.ended || !this.play.enabled || AG.paused) return;
      const pl = this.play;
      const p = pl.held ? pl.held.piece : this.rush ? this.ctrl.frontOnBelt() : pl.zone === 'tray' ? this.tray.current : null;
      if (p) pl.toTarget(p, this.binTarget, { via: 'key' });
    }
    /** The bin as a button: the held item goes in (a tap on the bin while holding is the same thing). */
    binPress() {
      if (performance.now() - this.lastToss < 450) return;
      if (this.ended || !this.play.enabled || AG.paused) return;
      const pl = this.play, p = pl.held ? pl.held.piece : this.rush ? this.ctrl.frontOnBelt() : null;
      if (p) pl.toTarget(p, this.binTarget, { via: 'tap' });
    }

    /* ---------- hints (💡 / H): the role expert points ---------- */
    sayHint(text, vars) { this.ctx.say('info', fmt(text, vars || {}), { pose: AG.rig.resolve(this.ctx.expertId, 'point').frame }); AG.sfx.play('blip'); }
    /** Holds p (turned to rot) with the ghost at (x, y): Enter or a tap on the ghost places it. */
    showSpot(p, x, y, rot) {
      const pl = this.play;
      if (!pl.held || pl.held.piece !== p) pl.pick(p, AG.input.lastDevice === 'keyboard' ? 'key' : 'tap');
      if (!pl.held || pl.held.piece !== p) return;
      if (p.rot !== rot) p.setRot(rot);
      pl.cur = { x, y };
      if (AG.input.lastDevice === 'keyboard') pl.setZone('board');
      pl.showGhost();
    }
    hint() { if (!this.ended && this.play.enabled && !AG.paused) this.ctrl.hint(); }
    /** The spot nearest the cursor where p fits, trying the given turns (default: all distinct ones). */
    nearestFit(p, rots) {
      const b = this.board, c = this.play.cur;
      let best = null;
      for (const rot of rots || SH.rotations(p.shape)) {
        const s = SH.rotate(p.shape, rot);
        for (let y = 0; y <= b.h - s.h; y++) for (let x = 0; x <= b.w - s.w; x++) {
          if (!b.canPlace(p, x, y, rot).ok) continue;
          const d = Math.abs(x - c.x) + Math.abs(y - c.y) + (rot === p.rot ? 0 : 0.5);
          if (!best || d < best.d) best = { x, y, rot, d };
        }
      }
      return best;
    }
    /** Occupied bag cells, except those of the pieces in `free` (for "what if this came out?"). */
    blockedCells(free) {
      const out = [];
      this.board.pieces.forEach(p => { if (!(free && free.includes(p))) p.cells.forEach(c => out.push({ x: p.at.x + c.x, y: p.at.y + c.y })); });
      return out;
    }

    /* ---------- the player's portrait ---------- */
    actionNow() {
      if (this.cheering) return this.cheering;
      if (this.reaction) return this.reaction;
      if (this.play && this.play.held) return 'think';
      return 'idle';
    }
    renderPlayer() {
      const a = this.actionNow();
      if (a === this.shown) return;
      this.shown = a;
      this.rig.play(a);
      const r = this.rig.info(performance.now() / 1000);
      this.fig.replaceChildren(this.rig.img(1), r.icon ? AG.ui.icon(r.icon, 36, '', 'gb-who__prop') : '');
    }
    react(action, ms) {
      clearTimeout(this.reactT);
      this.reaction = action; this.renderPlayer();
      this.reactT = setTimeout(() => { this.reaction = null; this.renderPlayer(); }, ms || T.reactMs);
    }

    /* ---------- Pack it! and the end ---------- */
    packIt() {
      if (this.ended || !this.play.enabled || !this.ctrl.canFinish()) return;
      if (this.overWeight()) {
        AG.sfx.play(K + 'sfx.invalid');
        this.ctx.say('warning', fmt(STR.tooHeavy, { kg: kg(this.weight() - this.maxW) }));
        if (this.wEl && !AG.reducedMotion()) AG.kit.shake(this.wEl);
        return;
      }
      const miss = this.missing();
      if (miss.length && !this.confirmUntil) {
        const names = [...new Set(miss.map(p => pick(p.data.label)))];
        this.confirmUntil = performance.now() + T.confirmMs;
        this.ctx.say('warning', fmt(STR.missingConfirm, { list: names.length > 3 ? listOf([names[0], names[1], (names.length - 2) + ' more things']) : listOf(names), verb: names.length > 1 ? 'are' : 'is' }));
        this.syncPack();
        return;
      }
      this.finish();
    }
    finish() {
      if (this.ended) return;
      const pl = this.play;
      pl.cancelDrag();
      if (pl.held) pl.cancel(true);
      this.ended = true; pl.enabled = false;
      this.ctrl.stop();
      pl.zones.destroy(); // Tab works normally in the checklist
      AG.input.armCancel(false);
      const res = this.result();
      this.res = res;
      AG.sfx.play(K + 'sfx.place');
      this.cheering = 'hold:go_bag'; this.renderPlayer();
      this.timers.push(setTimeout(() => { this.cheering = 'cheer'; this.renderPlayer(); }, T.holdBagMs));
      if (res.stars) AG.kit.celebrate(this.stage);
      this.timers.push(setTimeout(() => this.showChecklist(res), 650));
      this.syncPack();
    }
    result() {
      const st = this.board.stats(), counts = this.counts(), mode = this.level.mode;
      const allEssentials = this.allOf('essential'), allScenario = this.allOf('scenario');
      const missed = this.rush ? this.needed.filter(p => this.kind(p) === 'essential' && p.state !== 'placed').length : 0;
      const avgLeftMs = this.rush ? this.ctrl.avgLeft() : 0;
      const o = { mode, allEssentials, allScenario, decoys: counts.decoy, efficiency: st.efficiency, effTarget: this.spec.effTarget, avgLeftMs };
      const stars = SC.stars(o), score = SC.points({ counts, missed });
      const collectibles = SC.collectibles({ efficiency: st.efficiency, proEff: SC.proEff(this.spec), timeMs: this.ms, parSec: this.spec.parSec, undos: this.play.undoStack ? this.play.undoStack.used : 0 });
      return { stars, score, counts, st, allEssentials, allScenario, avgLeftMs, collectibles, missed };
    }

    /** CHECKLIST REVEAL: what a go bag should hold ✔ / ✖, a tip for each missing thing, then Continue. */
    showChecklist(res) {
      if (this.checkEl) return;
      const { ctx } = this;
      const groups = [['essential', STR.essentials], ['scenario', STR.family], ['nice', STR.extras], ['decoy', STR.home]];
      const rows = {};
      this.pieces.forEach(p => {
        const k = this.kind(p), id = p.data.id;
        const g = rows[k] = rows[k] || new Map();
        if (!g.has(id)) g.set(id, { it: p.data, n: 0, in: 0 });
        const r = g.get(id); r.n++; if (p.state === 'placed') r.in++;
      });
      const list = [];
      let firstTip = null;
      groups.forEach(([k, title]) => {
        if (!rows[k]) return;
        list.push(h('p', { class: 'gb-check__grp' }, pick(title)));
        const ul = h('ul');
        rows[k].forEach(r => {
          const all = r.in === r.n, none = !r.in;
          let cls, mark, state, tip = null;
          if (k === 'decoy') { cls = none ? 'is-ok' : 'is-bad'; mark = none ? '✔' : '✖'; state = pick(none ? STR.leftHome : STR.inBag); if (!none) tip = r.it.why; }
          else if (k === 'nice') { cls = all ? 'is-ok' : 'is-meh'; mark = all ? '✔' : '–'; state = pick(all ? STR.packed : STR.leftOut); }
          else { cls = all ? 'is-ok' : 'is-bad'; mark = all ? '✔' : '✖'; state = r.n > 1 ? fmt(STR.of, { a: r.in, b: r.n }) : pick(all ? STR.packed : STR.missing); if (!all) { tip = r.it.tip; firstTip = firstTip || tip; } }
          const name = pick(r.it.label) + (r.n > 1 ? ' ×' + r.n : '');
          ul.append(h('li', { class: 'gb-row ' + cls },
            h('span', { class: 'gb-row__mark', 'aria-hidden': 'true' }, mark), itemIcon(r.it, 24),
            h('span', {}, name, h('span', { class: 'gb-sr' }, ': ' + state)), h('span', { class: 'gb-row__state', 'aria-hidden': 'true' }, state),
            tip ? h('span', { class: 'gb-row__tip' }, pick(tip)) : null));
        });
        list.push(ul);
      });
      const fig = (id, action) => { const r = AG.rig.resolve(id, action); return h('span', { class: 'gb-check__fig', 'aria-hidden': 'true' }, AG.chars.img(id, r.frame, 1)); };
      const sum = res.stars >= 3 ? STR.sum3 : res.allScenario && res.allEssentials ? STR.sum2 : res.allEssentials ? STR.sum1 : STR.sum0;
      const go = h('button', { type: 'button', class: 'ag-btn' }, pick(STR.continue) + ' ▶');
      this.checkEl = h('section', { class: 'gb-check', role: 'region', 'aria-label': pick(STR.checkTitle) },
        h('div', { class: 'gb-check__head' }, this.checkFig = fig(ctx.characterId, 'hold:go_bag'), h('h2', { tabindex: '-1' }, pick(STR.checkTitle)), fig(ctx.expertId, 'cheer')),
        h('p', { class: 'gb-check__sum' }, pick(sum)),
        ...list,
        h('p', { class: 'gb-check__take' }, pick(GB.takeaway)),
        go);
      this.side.hidden = true;
      this.root.classList.add('is-over');
      this.root.prepend(this.checkEl);
      this.timers.push(setTimeout(() => { if (this.checkFig) this.checkFig.replaceChildren(AG.chars.img(ctx.characterId, AG.rig.resolve(ctx.characterId, 'cheer').frame, 1)); }, T.holdBagMs));
      ctx.say('info', firstTip || STR.closing);
      this.offs.push(P.onPress(go, () => this.end()));
      this.offs.push(AG.input.on('CONFIRM', e => { if (e.phase === 'down' && e.device === 'keyboard' && document.activeElement !== go) this.end(); }));
      go.focus({ preventScroll: true });
      this.checkEl.scrollIntoView({ block: 'start', behavior: AG.reducedMotion() ? 'auto' : 'smooth' });
    }
    end() {
      if (this.over) return;
      this.over = true;
      const res = this.res, { ctx } = this, st = res.st;
      const ess = this.needed.filter(p => this.kind(p) === 'essential'), fam = this.needed.filter(p => this.kind(p) === 'scenario');
      const detail = [
        { label: STR.dEss, value: ess.filter(p => p.state === 'placed').length + ' / ' + ess.length, icon: 'go_bag' },
        fam.length ? { label: STR.dFam, value: fam.filter(p => p.state === 'placed').length + ' / ' + fam.length, icon: 'heart' } : null,
        { label: STR.dSpace, value: Math.round(st.efficiency * 100) + '%' },
        res.counts.decoy ? { label: STR.dDecoys, value: res.counts.decoy } : null,
        this.rush ? { label: STR.dLeft, value: fmt(STR.sec, { n: (res.avgLeftMs / 1000).toFixed(1) }) } : null,
        this.maxW != null ? { label: STR.dWeight, value: fmt(STR.weightOf, { w: kg(this.weight()), max: kg(this.maxW) }) } : null
      ].filter(Boolean);
      // badges: best stars per level, the scenarios packed so far (nothing personal)
      let best = {}, done = [];
      if (ctx.mode === 'stage') {
        for (let l = 1; l <= 5; l++) { const r = AG.progress.level(ctx.gameId, l); best[l] = (r && r.stars) || 0; }
        const full = (this.spec.scenarios || []).filter(id => this.scen[id].items.every(iid => this.board.pieces.some(p => p.data.id === iid)));
        done = (AG.store.update('stats', s => { const g = s.goBag = s.goBag || { scenarios: [] }; full.forEach(id => { if (!g.scenarios.includes(id)) g.scenarios.push(id); }); }).goBag || {}).scenarios || [];
      }
      const badgeEvents = SC.badges({ level: ctx.level, stars: res.stars, best, scenariosDone: done, mode: this.level.mode, allEssentials: res.allEssentials, signal: this.ctrl.signalN || 0 });
      const msg = res.stars >= 3 ? (this.rush ? STR.msg3rush : STR.msg3) : res.stars === 2 ? (this.rush ? STR.msg2rush : res.counts.decoy ? STR.msg2decoy : STR.msg2pack) : res.stars === 1 ? STR.msg1 : STR.msg0;
      this.doneFn({
        won: res.stars > 0, stars: res.stars, score: res.score, timeMs: Math.round(this.ms),
        collectibles: res.collectibles, detail, message: msg, badgeEvents, delay: 200
      });
    }

    destroy() {
      this.ended = true; this.over = true;
      clearTimeout(this.reactT);
      this.timers.forEach(clearTimeout);
      if (this.tickId) this.ctx.clear(this.tickId);
      this.offs.forEach(f => f()); this.offs = [];
      this.ctrl.destroy();
      this.play.destroy();
      AG.input.armCancel(false);
    }
  }

  GB.Scene = Scene;
  GB.STR = STR;
  GB.fmt = fmt;
  GB.itemIcon = itemIcon;
})(window.AG);
