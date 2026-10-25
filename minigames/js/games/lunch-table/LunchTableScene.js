/* Lunch Table Logic: the scene every level plays in, and the faces it shares with Upstander.js.
 *
 *   const scene = new AG.lunchTable.Scene(stage, ctx, done, { level, students, rules, moments })
 *
 * DOM board: seats (a GridCursor over real <button>s), the waiting tray, and the rule cards, joined by three
 * FocusZones (Tab: tray ↔ seats ↔ rules). The player's portrait: think while a student is held, happy when a
 * rule turns ✔, worried while someone sits alone, cheer when solved. Solved = everyone seated and every rule
 * met; then the Upstander Moment(s) (Upstander.js) and done(). The rules are js/logic/lunch-table/rules.js,
 * the solver (hints) is solver.js, the numbers are tuning.js.
 * Keys: Tab zone · arrows move · Enter pick up / place (swap if taken) · Esc put back · Backspace undo · H hint.
 * Touch / mouse: drag a student to a seat (onto a seated one = swap), tap a seated student to lift them, ↶, 💡. */
window.AG = window.AG || {};
(function (AG) {
  const { h } = AG.util;
  const LT = AG.lunchTable, L = AG.logic.lunchRules, S = AG.logic.lunchSolver, SC = LT.scoring, T = LT.tuning;
  const pick = v => AG.pick(v);
  const fmt = (t, vars) => pick(t).replace(/\{(\w+)\}/g, (_, k) => (vars[k] == null ? '' : vars[k]));

  const STR = {
    score: { en: 'Score' }, moves: { en: 'Moves' }, par: { en: 'par' },
    happy: { en: 'Happy table' }, rulesTitle: { en: 'Table rules' }, rulesMet: { en: '{n} of {m} rules met' },
    waiting: { en: 'Waiting to sit' }, slot: { en: 'Waiting area' }, slotHint: { en: 'Put back here' },
    seats: { en: 'Seats' }, undo: { en: 'Undo' }, hint: { en: 'Hint' }, putBack: { en: 'Put back' },
    seatLabel: { en: '{table}, seat {n}: {who}{aisle}' }, empty: { en: 'empty' }, aisle: { en: ', aisle end' },
    chipLabel: { en: '{name}, waiting. {traits}' },
    holding: { en: 'Holding {name}. Choose a seat. Esc puts them back.' },
    holdingTouch: { en: 'Holding {name}. Tap a seat, or tap Put back.' },
    kept: { en: '{name} stays where they were.' }, placed: { en: '{name} sits at {table}.' }, swapped: { en: '{a} and {b} swap seats.' }, returned: { en: '{name} is waiting again.' },
    undone: { en: 'Undone.' }, nothing: { en: 'Nothing to undo yet.' }, pickFirst: { en: 'Pick up a student first, then choose a seat.' },
    hintLine: { en: 'Try seating {name} at {table}, seat {n}.' }, hintCost: { en: '(−50)' },
    noHints: { en: 'No more hints on Advanced. You can do it!' }, noRule: { en: 'Every rule is met!' },
    ruleOn: { en: 'Rule {n}: {state}. {text}' }, met: { en: 'met' }, notYet: { en: 'not met yet' },
    alone: { en: 'Someone is sitting alone. Nobody should be left out. Let\'s find them a friend!' },
    solved: { en: '**Everyone has a seat, a friend and a smile!** :star:' },
    teamTotal: { en: '⭐ {n}' },
    msg3: { en: 'Everyone is included, and you stood up for others. That is what an upstander does!' },
    msg2: { en: 'Everyone has a seat! Next time, try an even kinder choice to earn the third star.' },
    msg1: { en: 'Everyone has a seat. Remember: include others, don\'t join in, and tell a trusted adult.' },
    dMoves: { en: 'Moves' }, dHints: { en: 'Hints used' }, dUp: { en: 'Upstander choices' }, dBest: { en: 'best choice first try' }
  };

  /* ---------- styles, once per page (all under #ag-app, classes lt-) ---------- */
  const CSS = `
#ag-app .lt { --k: 1; --cw: calc(60px * var(--k)); --ch: calc(80px * var(--k)); --fs: calc(6px * (var(--k) + 1)); position: relative; display: grid; gap: 10px; grid-template-columns: minmax(0, 1fr); grid-template-areas: "top" "status" "room" "tray" "rules"; font-variant-ligatures: none; isolation: isolate; color: var(--fg); }
#ag-app .lt[hidden] { display: none; }
@container (min-width: 600px) { #ag-app .lt { grid-template-columns: minmax(0, 1fr) 250px; grid-template-areas: "top rules" "status rules" "room rules" "tray rules"; align-items: start; } }
@container (min-width: 1000px) { #ag-app .lt { --k: 2; grid-template-columns: minmax(0, 1fr) 320px; } }
#ag-app .lt-top { grid-area: top; display: flex; align-items: flex-end; gap: 10px; min-width: 0; }
#ag-app .lt-who { flex: none; display: flex; flex-direction: column; align-items: center; }
#ag-app .lt-who__fig { display: flex; align-items: flex-start; justify-content: center; height: 88px; overflow: hidden; }
#ag-app .lt-who__fig .ag-charimg { display: block; }
#ag-app .lt-who__tag { margin-top: 2px; padding: 0 6px; font-family: var(--font-display); font-size: .75rem; font-weight: 700; color: #1e1538; background: #fff4cc; border: 2px solid #1e1538; white-space: nowrap; }
#ag-app .lt-meter { flex: 1 1 auto; display: grid; gap: 6px; min-width: 0; padding: 8px 10px; color: #1e1538; background: #fff4cc; border: var(--b) solid #1e1538; box-shadow: 3px 3px 0 var(--shadow-c); }
#ag-app .lt-meter__row { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; font-family: var(--font-display); font-weight: 700; }
#ag-app .lt-meter__row b { font-size: 1.2rem; font-variant-numeric: tabular-nums; }
#ag-app .lt-bar { position: relative; display: flex; align-items: center; gap: 6px; }
#ag-app .lt-bar__track { position: relative; flex: 1 1 auto; height: 22px; background: #fffaf0; border: 3px solid #1e1538; overflow: hidden; }
#ag-app .lt-bar__fill { position: absolute; inset: 0 auto 0 0; width: 0; background: repeating-linear-gradient(90deg, #7ee08a 0 8px, #5bc46b 8px 16px); border-right: 3px solid #1e1538; transition: width .25s steps(5); }
#ag-app .lt-bar.has-art .lt-bar__track { border: 0; background: var(--lt-meter-art) 0 0 / 100% 100% no-repeat; image-rendering: pixelated; }
#ag-app .lt-bar.has-art .lt-bar__fill { inset: 4px 4px 4px auto; width: auto; right: 4px; left: auto; background: #1e1538; border: 0; }
#ag-app .lt-bar.is-full .lt-bar__track { box-shadow: 0 0 0 3px #2f8a4a; }
#ag-app .lt-tools { flex: none; display: flex; flex-direction: column; gap: 6px; }
#ag-app .lt-tools .ag-btn { min-height: 44px; min-width: 44px; padding: 4px 10px; display: inline-flex; align-items: center; justify-content: center; gap: 6px; }
#ag-app .lt-tools .ag-btn[disabled] { opacity: .5; }
#ag-app .lt-status { grid-area: status; display: flex; align-items: center; gap: 8px; min-height: 48px; box-sizing: border-box; margin: 0; padding: 4px 10px; font-weight: 700; background: var(--panel-2); border: 2px solid var(--line); border-radius: var(--r); }
#ag-app .lt-status .lt-face { flex: none; }
#ag-app .lt-status__txt { flex: 1 1 auto; min-width: 0; }
#ag-app .lt-status .ag-btn { flex: none; }
#ag-app .lt-status .ag-btn[hidden] { display: none; }

/* the room: the layout art behind the tables */
#ag-app .lt-room { grid-area: room; position: relative; display: grid; grid-template-columns: repeat(var(--cols), minmax(0, 1fr)); gap: calc(8px * var(--k)); justify-items: center; align-items: center; padding: calc(10px * var(--k)) calc(6px * var(--k)); min-height: calc(120px * var(--k)); background: var(--lt-bg) center / cover no-repeat, #dcd9ff; image-rendering: pixelated; border: var(--b) solid var(--line); border-radius: var(--r); }
#ag-app .lt-table { position: relative; display: grid; justify-items: center; gap: 2px; padding: calc(4px * var(--k)) calc(2px * var(--k)); }
#ag-app .lt-table__name { position: relative; z-index: 1; padding: 0 6px; font: 700 var(--fs) / 1.2 var(--font-display); color: #1e1538; background: #fff4cc; border: 2px solid #1e1538; max-width: 100%; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
#ag-app .lt-table__total { position: relative; z-index: 1; padding: 0 6px; font: 700 var(--fs) / 1.2 var(--font-display); color: #1e1538; background: #ffe9a8; border: 2px solid #1e1538; }
#ag-app .lt-table__total.is-ok { background: #dff7e3; }
#ag-app .lt-table__body { position: relative; display: grid; }
#ag-app .lt-table__art { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); width: 100%; height: 56%; background: var(--lt-art) center / 100% 100% no-repeat; image-rendering: pixelated; pointer-events: none; }
#ag-app .lt-table--round .lt-table__art { width: calc(var(--tw) * var(--cw) * .7); height: calc(var(--tw) * var(--cw) * .7); background-size: contain; }
#ag-app .lt-table--bus_seat .lt-table__art { height: 50%; top: 56%; }
#ag-app .lt-table--none .lt-table__art { display: none; }
#ag-app .lt-seats { position: relative; display: grid; grid-template-columns: repeat(var(--tw), var(--cw)); grid-auto-rows: var(--ch); }

/* a seat and a waiting chip look the same: face, name, interests */
#ag-app .lt-seat, #ag-app .lt-chip { user-select: none; -webkit-user-select: none; position: relative; display: flex; flex-direction: column; align-items: center; justify-content: flex-start; gap: 1px; width: var(--cw); height: var(--ch); padding: calc(3px * var(--k)) 0 0; font: inherit; color: #1e1538; background: transparent; border: 2px dashed transparent; border-radius: 4px; cursor: pointer; -webkit-tap-highlight-color: transparent; }
#ag-app .lt-seat[data-student], #ag-app .lt-chip { touch-action: none; background: rgba(255, 250, 240, .92); border: 2px solid #1e1538; box-shadow: 2px 2px 0 rgba(0, 0, 0, .35); }
#ag-app .lt-seat:focus-visible, #ag-app .lt-chip:focus-visible, #ag-app .lt-rule:focus-visible, #ag-app .lt-slot:focus-visible { outline: 3px solid var(--vest); outline-offset: 2px; }
#ag-app .lt-seat__empty { width: calc(28px * var(--k)); height: calc(28px * var(--k)); margin-top: calc(10px * var(--k)); background: var(--lt-seat) center / 100% 100% no-repeat; image-rendering: pixelated; opacity: .9; }
#ag-app .lt-seat__aisle { position: absolute; top: 1px; left: 1px; width: calc(16px * var(--k)); height: calc(16px * var(--k)); }
#ag-app .lt-face { position: relative; display: block; width: calc(32px * var(--k)); height: calc(32px * var(--k)); flex: none; }
#ag-app .lt-face img, #ag-app .lt-face .lt-hero { display: block; width: 100%; height: 100%; image-rendering: pixelated; }
#ag-app .lt-hero { background: var(--src) calc(-9px * var(--k)) calc(-1px * var(--k)) / calc(50px * var(--k)) calc(65px * var(--k)) no-repeat; image-rendering: auto; }
#ag-app .lt-face .lt-mood { position: absolute; right: calc(-4px * var(--k)); top: calc(-4px * var(--k)); width: calc(12px * var(--k)); height: calc(12px * var(--k)); }
#ag-app .lt-name { max-width: 100%; padding: 0 2px; font: 700 var(--fs) / 1.15 var(--font-display); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
#ag-app .lt-traits { display: flex; justify-content: center; gap: 0; min-height: calc(16px * var(--k)); }
#ag-app .lt-ico { display: block; width: calc(16px * var(--k)); height: calc(16px * var(--k)); image-rendering: pixelated; }
#ag-app .lt-seat[data-mood="lonely"][data-student] { background: #e8e4ff; }
#ag-app .lt-seat[data-mood="sad"][data-student] { background: #ffe3e8; border-color: var(--alert); }
#ag-app .lt-seat[data-mood="happy"][data-student] { background: #e6f9e8; }
#ag-app .lt-seat.is-held, #ag-app .lt-chip.is-held { opacity: .55; border-style: dashed; transform: translateY(-3px); }
#ag-app .lt-seat.is-hot { outline: 3px solid var(--hat); outline-offset: 2px; background: #fff4cc; }
#ag-app .lt-seat.is-hint, #ag-app .lt-chip.is-hint, #ag-app .lt-rule.is-hint { outline: 4px dashed var(--vest); outline-offset: 3px; animation: lt-blink .9s steps(2) infinite; }
#ag-app .lt-seat.is-flag, #ag-app .lt-chip.is-flag { outline: 3px dotted var(--sky); outline-offset: 2px; }
#ag-app .lt-seat .lt-seat__tick { display: none; }
@keyframes lt-blink { 50% { outline-color: transparent; } }

/* the waiting area */
#ag-app .lt-tray { grid-area: tray; display: flex; flex-wrap: wrap; gap: 8px; align-items: flex-start; padding: 8px; min-height: calc(var(--ch) + 40px); background: var(--panel-2); border: var(--b) dashed var(--line); border-radius: var(--r); }
#ag-app .lt-tray__title { flex: 1 0 100%; margin: 0; font: 700 .85rem var(--font-display); text-transform: uppercase; letter-spacing: .06em; color: var(--muted); }
#ag-app .lt-slot { align-self: stretch; display: flex; align-items: center; justify-content: center; flex: 1 1 90px; min-width: 90px; min-height: 48px; padding: 4px 8px; font: 700 .85rem var(--font-display); color: var(--muted); background: transparent; border: 2px dashed var(--line); border-radius: 4px; cursor: pointer; }
#ag-app .lt-slot.is-ready { color: var(--fg); background: var(--panel); border-color: var(--vest); }

/* the rule cards */
#ag-app .lt-rules { grid-area: rules; list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; align-content: start; }
#ag-app .lt-rules__title { margin: 0 0 2px; font: 700 .85rem var(--font-display); text-transform: uppercase; letter-spacing: .06em; color: var(--muted); }
#ag-app .lt-rule { display: flex; align-items: flex-start; gap: 8px; width: 100%; box-sizing: border-box; padding: 4px 6px; text-align: left; font: 700 .95rem / 1.3 var(--font-body, inherit); color: #1e1538; background: #ffe2b0; border: 8px solid #1e1538; border-image: var(--lt-card) 8 fill / 8px stretch; image-rendering: pixelated; cursor: pointer; }
#ag-app .lt-rule > * { image-rendering: auto; }
#ag-app .lt-rule .ag-px { image-rendering: pixelated; }
#ag-app .lt-rule__mark { flex: none; display: grid; place-items: center; width: 30px; height: 30px; background: #fffaf0; border: 2px solid #1e1538; }
#ag-app .lt-rule__txt { flex: 1 1 auto; min-width: 0; padding-top: 2px; overflow-wrap: anywhere; }
#ag-app .lt-rule[data-state="met"] { background: #d8f5dc; }
#ag-app .lt-rule[data-state="met"] .lt-rule__mark { background: #b6ecbe; }
#ag-app .lt-rule[data-state="broken"] .lt-rule__mark { background: #ffc4cf; }
#ag-app .lt-rule[data-state="pending"] { background: #fff1cf; }
#ag-app .lt-rule[data-state="pending"] .lt-rule__mark { border-style: dashed; }
#ag-app .lt-rule.is-flag { outline: 3px dotted var(--sky); outline-offset: 2px; }
#ag-app .lt-ghost { position: fixed; z-index: 60; pointer-events: none; transform: translate(-50%, -60%); opacity: .92; }
#ag-app .lt-ghost .lt-face { --k: 2; }
#ag-app .lt-sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
@container (max-width: 599px) {
  #ag-app .lt-who__fig { height: 72px; }
  #ag-app .lt-status { min-height: 68px; }   /* two lines + the Put back button, so the board never moves under a drag */
  #ag-app .lt-top { flex-wrap: wrap; align-items: center; }
  #ag-app .lt-who { order: 1; }
  #ag-app .lt-tools { order: 2; flex-direction: row; margin-left: auto; }
  #ag-app .lt-meter { order: 3; flex: 1 1 100%; }
}
@media (prefers-reduced-motion: reduce) {
  #ag-app .lt-seat.is-hint, #ag-app .lt-chip.is-hint, #ag-app .lt-rule.is-hint { animation: none; }
  #ag-app .lt-bar__fill { transition: none; }
}`;
  function injectCss() {
    if (!document.querySelector('style[data-ag-css="lunch-table"]')) document.head.append(h('style', { 'data-ag-css': 'lunch-table' }, CSS));
  }
  const cssUrl = u => (u ? 'url("' + u + '")' : 'none');
  /** A file path for an asset key. The image is also requested through AG.assets, which warns once about a missing
   *  one and lists it in ?debug=assets (the board still plays: a missing picture shows a placeholder or nothing). */
  const assetUrl = key => { const u = AG.assets.url(key); AG.assets.image(key); return u; };

  /* ---------- faces: a student's portrait for a mood (shared with Upstander.js) ---------- */
  const titleCase = s => s.toLowerCase().replace(/(^|\s)\S/g, c => c.toUpperCase());
  const pxIcon = (emoji, cls) => h('img', { class: 'ag-px lt-ico' + (cls ? ' ' + cls : ''), src: AG.pixelIcon(emoji, 16), alt: '', draggable: 'false' });
  const MOOD_ICON = { lonely: '😔', sad: '😢' };

  function faceUrl(p, mood) {
    if (p.hero) return AG.chars.src(p.heroChar, T.heroFrame[mood] || 'talk');
    const key = p.portrait + '.' + mood;
    return assetUrl(key) || AG.assets.placeholderURL(p.id + ' ' + mood, 32, 32);
  }
  /** A missing portrait file becomes a labelled placeholder instead of a broken image. */
  function img(p, mood) {
    const el = h('img', { class: 'ag-px', alt: '', draggable: 'false', width: 32, height: 32 });
    el.addEventListener('error', () => { el.src = AG.assets.placeholderURL(p.id + ' ' + mood, 32, 32); }, { once: true });
    el.src = faceUrl(p, mood);
    return el;
  }
  /** <span class="lt-face"> for a student; setFace() changes the mood in place. */
  function face(p, mood) {
    const el = h('span', { class: 'lt-face' + (p.hero ? ' lt-face--hero' : ''), 'aria-hidden': 'true' });
    setFace(el, p, mood);
    return el;
  }
  function setFace(el, p, mood) {
    el.dataset.mood = mood;
    if (p.hero) { el.replaceChildren(h('span', { class: 'lt-hero' })); el.firstChild.style.setProperty('--src', cssUrl(faceUrl(p, mood))); }
    else el.replaceChildren(img(p, mood));
    const old = el.querySelector('.lt-mood');
    if (old) old.remove();
    if (MOOD_ICON[mood]) el.append(pxIcon(MOOD_ICON[mood], 'lt-mood'));
  }

  class Scene {
    constructor(stage, ctx, done, data) {
      injectCss();
      this.stage = stage; this.ctx = ctx; this.doneFn = done; this.data = data;
      const level = this.level = data.level;
      this.ids = level.students.slice();
      this.t0 = performance.now();

      // the students: custom ones as they are, the hero slots filled with Ready Squad heroes (never the player or the expert)
      const heroes = SC.heroes(ctx.characterId, ctx.expertId);
      this.people = {};
      data.students.forEach(s => {
        if (!this.ids.includes(s.id)) return;
        this.people[s.id] = s.hero ? Object.assign({}, s, { heroChar: heroes[(+s.id.slice(1) - 1) % heroes.length], name: titleCase(AG.chars.get(heroes[(+s.id.slice(1) - 1) % heroes.length]).name) }) : s;
      });
      this.cast = {}; data.students.forEach(s => { if (!s.hero) this.cast[s.id] = s; });   // everyone the Upstander scenes can show
      this.names = {}; this.ids.forEach(id => { this.names[id] = this.people[id].name; });
      this.traits = data.rules.traits;

      this.board = L.buildBoard(level);
      this.rules = level.rules;
      this.texts = this.rules.map(r => L.describe(r, this.names, data.rules));
      this.model = S.make(level, this.people);
      this.seating = {}; this.ids.forEach(id => { this.seating[id] = null; });
      this.cell = {}; this.board.order.forEach(id => { const s = this.board.seats[id]; this.cell[s.x + ',' + s.y] = id; });
      this.undo = new AG.logic.UndoStack({ limit: 400, onChange: () => this.syncTools() });
      this.par = level.par; this.moves = 0; this.hints = 0; this.maxHints = SC.hintsFor(ctx.difficulty);
      this.held = null; this.drag = null; this.hint = null; this.flag = null;
      this.sum = null; this.metBefore = new Set(); this.solved = false; this.locked = false; this.sayAlone = false;
      this.reaction = null; this.shown = ''; this.reactT = null; this.cheering = false;
      this.offs = []; this.timers = [];
      this.hasAisleRule = this.rules.some(r => r.type === 'accessibleSeat');
      this.fair = this.rules.find(r => r.type === 'fairTeams');

      this.build();
      this.hud = ctx.hud({ score: 0, scoreLabel: STR.score, label: STR.moves });
      this.render();
      this.bind();
      this.timers.push(setTimeout(() => this.zones.apply(), 90)); // the shell focuses the stage after mount; then the zone takes the focus
    }

    /* ---------- DOM ---------- */
    traitIcons(p) {
      const out = (p.traits || []).filter(t => this.traits[t]).map(t => pxIcon(this.traits[t].icon));
      if (p.wheelchair) out.push(pxIcon('♿'));
      return h('span', { class: 'lt-traits', 'aria-hidden': 'true' }, out);
    }
    traitWords(p) {
      const w = (p.traits || []).filter(t => this.traits[t]).map(t => this.traits[t].en);
      if (p.wheelchair) w.push('uses a wheelchair');
      return w.length ? 'Likes: ' + w.join(', ') + '.' : '';
    }
    build() {
      const { ctx, level, board } = this;
      this.rig = ctx.rig('portrait');
      this.fig = h('div', { class: 'lt-who__fig' });
      this.tag = h('span', { class: 'lt-who__tag' }, AG.chars.get(ctx.characterId).name);
      const who = h('div', { class: 'lt-who', 'aria-hidden': 'true' }, this.fig, this.tag);

      this.meterNum = h('b'); this.meterTxt = h('span', {}, pick(STR.happy));
      const art = assetUrl('lunch-table.ui.happiness_meter');
      this.fill = h('i', { class: 'lt-bar__fill' });
      this.bar = h('div', { class: 'lt-bar' + (art ? ' has-art' : ''), role: 'meter', 'aria-valuemin': 0, 'aria-valuemax': 100 }, pxIcon('😞'), h('span', { class: 'lt-bar__track' }, this.fill), pxIcon('😊'));
      if (art) this.bar.style.setProperty('--lt-meter-art', cssUrl(art));
      const meter = h('div', { class: 'lt-meter' }, h('div', { class: 'lt-meter__row' }, this.meterTxt, this.meterNum), this.bar);

      this.undoBtn = h('button', { type: 'button', class: 'ag-btn ag-btn--alt', 'aria-label': pick(STR.undo), title: pick(STR.undo) + ' (Backspace)' }, '↶');
      this.hintBtn = h('button', { type: 'button', class: 'ag-btn ag-btn--alt', 'aria-label': pick(STR.hint), title: pick(STR.hint) + ' (H)' }, AG.ui.icon('bulb', 24), h('span', {}, pick(STR.hint)));
      const tools = h('div', { class: 'lt-tools' }, this.undoBtn, this.hintBtn);
      const top = h('div', { class: 'lt-top' }, who, meter, tools);

      this.statusTxt = h('span', { class: 'lt-status__txt' }, pick(STR.pickFirst));
      this.heldFace = h('span', { class: 'lt-status__face' });
      this.putBackBtn = h('button', { type: 'button', class: 'ag-btn ag-btn--alt ag-btn--small', hidden: true }, pick(STR.putBack));
      this.status = h('p', { class: 'lt-status', role: 'status', 'aria-live': 'polite' }, this.heldFace, this.statusTxt, this.putBackBtn);

      // the room: tables with seats
      this.room = h('div', { class: 'lt-room', role: 'group', 'aria-label': pick(STR.seats) });
      this.room.style.setProperty('--cols', board.w);
      this.room.style.setProperty('--lt-bg', cssUrl(assetUrl('lunch-table.layout.' + level.layout)));
      this.room.style.setProperty('--lt-seat', cssUrl(assetUrl('lunch-table.table.seat_empty')));
      this.seatEls = {}; this.tableEls = {}; this.totalEls = {};
      for (const t of board.tables) {
        const spec = level.tables.find(x => x.id === t.id), art2 = spec.art || 'none';
        const seatsEl = h('div', { class: 'lt-seats' });
        seatsEl.style.setProperty('--tw', t.w);
        t.seats.forEach(id => {
          const s = board.seats[id];
          const el = h('button', { type: 'button', class: 'lt-seat', 'data-seat': id });
          el.style.gridColumn = String(s.c + 1); el.style.gridRow = String(s.r + 1);
          this.seatEls[id] = el; seatsEl.append(el);
        });
        const body = h('div', { class: 'lt-table__body' }, h('div', { class: 'lt-table__art' }), seatsEl);
        const tableEl = h('div', { class: 'lt-table lt-table--' + art2, 'data-table': t.id }, h('span', { class: 'lt-table__name' }, pick(t.name)), body);
        tableEl.style.gridColumn = (t.x + 1) + ' / span ' + t.w; tableEl.style.gridRow = (t.y + 1) + ' / span ' + t.h;
        tableEl.style.setProperty('--tw', t.w);
        const artUrl = art2 === 'none' ? null : assetUrl('lunch-table.table.' + art2);
        if (artUrl) tableEl.style.setProperty('--lt-art', cssUrl(artUrl));
        if (this.fair) { const tot = h('span', { class: 'lt-table__total' }); this.totalEls[t.id] = tot; tableEl.append(tot); }
        this.tableEls[t.id] = tableEl;
        this.room.append(tableEl);
      }

      this.tray = h('div', { class: 'lt-tray', role: 'group', 'aria-label': pick(STR.waiting) });
      this.rulesEl = h('ul', { class: 'lt-rules', role: 'list', 'aria-label': pick(STR.rulesTitle) });
      this.rulesEl.style.setProperty('--lt-card', cssUrl(assetUrl('lunch-table.ui.rule_card_9slice')));
      this.ruleEls = this.rules.map((r, i) => {
        const mark = h('span', { class: 'lt-rule__mark', 'aria-hidden': 'true' });
        const b = h('button', { type: 'button', class: 'lt-rule', 'data-i': i }, mark, h('span', { class: 'lt-rule__txt' }, pick(this.texts[i])));
        this.rulesEl.append(h('li', {}, b));
        return b;
      });

      this.el = h('div', { class: 'lt', 'data-layout': level.layout }, top, this.status, this.room, this.tray, this.rulesEl);
      this.stage.append(this.el);
      this.ghostRoot = this.stage.closest('#ag-app') || document.body;
    }

    bind() {
      const { ctx } = this;
      // seats: arrows + Enter + taps (nearest mode, so the ragged tables never trap the cursor)
      this.cursor = new AG.grid.GridCursor({
        w: this.board.w, h: this.board.h, el: this.room, mode: 'nearest',
        cellEl: (x, y) => this.seatEls[this.cell[x + ',' + y]],
        selectable: (x, y) => !!this.cell[x + ',' + y],
        onConfirm: (x, y, info) => this.seatAction(this.cell[x + ',' + y], info)
      });
      this.cursor.active = false;
      this.trayIdx = 0; this.ruleIdx = 0;
      this.zones = new AG.input.FocusZones([
        { el: this.tray, name: 'tray', onEnter: () => this.enterZone('tray') },
        { el: this.room, name: 'seats', onEnter: () => this.enterZone('seats') },
        { el: this.rulesEl, name: 'rules', onEnter: () => this.enterZone('rules') }
      ]);
      for (const d of ['UP', 'DOWN', 'LEFT', 'RIGHT']) this.offs.push(AG.input.on(d, e => { if (!this.locked && (e.phase === 'down' || e.phase === 'repeat')) this.moveInZone(d); }));
      this.offs.push(AG.input.on('UNDO', e => { if (e.phase === 'down') this.undoMove(); }));
      this.offs.push(AG.input.on('HINT', e => { if (e.phase === 'down') this.giveHint(); }));
      this.offs.push(AG.input.on('CANCEL', e => { if (e.phase === 'down') this.cancelHold(true); }));
      this.undoBtn.addEventListener('click', () => this.undoMove());
      this.hintBtn.addEventListener('click', () => this.giveHint());
      this.putBackBtn.addEventListener('click', () => this.cancelHold(true));
      this.tray.addEventListener('click', e => {
        if (this.locked) return;
        const chip = e.target.closest('.lt-chip');
        if (chip && e.detail === 0 && this.guardKey) return;
        if (chip) return this.chipAction(chip.dataset.student);
        if (this.held && this.held.from !== 'tray') this.returnHeld(); // the waiting area is a drop spot for a seated student
      });
      this.rulesEl.addEventListener('click', e => { const b = e.target.closest('.lt-rule'); if (b && !this.locked) this.ruleAction(+b.dataset.i); });
      this.bindPointer();
      // a tap that ended a drag is not a click
      this.stage.addEventListener('click', this.noClick = e => { if (this.suppress) { e.stopPropagation(); e.preventDefault(); } }, true);
      AG.sfx.preload(['lunch-table.sfx.pick', 'lunch-table.sfx.place', 'lunch-table.sfx.rule_ok', 'lunch-table.sfx.solved']);
      ctx.onPause(p => { if (p) this.cancelDrag(); });
    }

    /* ---------- zones ---------- */
    get zone() { return this.zones.current.name; }
    trayItems() { return [...this.tray.querySelectorAll('.lt-chip, .lt-slot')]; }
    enterZone(name) {
      if (!this.cursor) return;
      this.cursor.active = !this.locked && name === 'seats';
      if (this.locked) return;
      if (name === 'tray') { const it = this.trayItems(); if (!it.length) return; this.trayIdx = Math.min(this.trayIdx, it.length - 1); this.setRoving(it, this.trayIdx); it[this.trayIdx].focus({ preventScroll: true }); }
      else if (name === 'rules') { if (!this.ruleEls.length) return; this.setRoving(this.ruleEls, this.ruleIdx); this.ruleEls[this.ruleIdx].focus({ preventScroll: true }); }
      else { const c = this.seatEls[this.cell[this.cursor.x + ',' + this.cursor.y]]; if (c) c.focus({ preventScroll: true }); }
    }
    setRoving(list, idx) { list.forEach((el, i) => { el.tabIndex = i === idx ? 0 : -1; }); }
    moveInZone(dir) {
      const z = this.zone, fwd = dir === 'RIGHT' || dir === 'DOWN';
      if (z === 'tray') {
        const it = this.trayItems(); this.trayIdx = AG.util.clamp(this.trayIdx + (fwd ? 1 : -1), 0, it.length - 1);
        this.setRoving(it, this.trayIdx); it[this.trayIdx].focus({ preventScroll: true }); AG.sfx.play('tap');
      } else if (z === 'rules' && (dir === 'UP' || dir === 'DOWN')) {
        this.ruleIdx = AG.util.clamp(this.ruleIdx + (fwd ? 1 : -1), 0, this.ruleEls.length - 1);
        this.setRoving(this.ruleEls, this.ruleIdx); this.ruleEls[this.ruleIdx].focus({ preventScroll: true }); AG.sfx.play('tap');
      }
    }

    /* ---------- the seating ---------- */
    ctxNow() { return { board: this.board, ids: this.ids, students: this.people, seating: this.seating, attrs: this.level.attrs || {} }; }
    occupant(seatId) { return this.ids.find(id => this.seating[id] === seatId) || null; }
    seatName(seatId) { const s = this.board.seats[seatId]; return { table: pick(this.board.tableById[s.table].name), n: s.i + 1 }; }
    say(text) { this.statusTxt.textContent = text; }

    pickUp(id, from, o) {
      if (this.locked) return;
      this.held = { id, from };
      AG.input.armCancel(true);
      AG.sfx.play('lunch-table.sfx.pick');
      this.say(fmt(AG.input.lastDevice === 'touch' ? STR.holdingTouch : STR.holding, { name: this.names[id] }));
      this.render();
      if (!(o && o.drag)) this.zones.set('seats');
    }
    cancelHold(user) {
      if (!this.held) return;
      const id = this.held.id;
      this.held = null; AG.input.armCancel(false);
      this.say(user ? fmt(STR.kept, { name: this.names[id] }) : '');
      this.render();
    }
    seatAction(seatId, info) {
      if (this.locked || !seatId) return;
      if (this.held) { if (this.held.from === seatId) this.cancelHold(true); else this.placeHeld(seatId); return; }
      const who = this.occupant(seatId);
      if (who) this.pickUp(who, seatId);
      else { this.say(pick(STR.pickFirst)); AG.sfx.play('soft'); }
    }
    chipAction(id) {
      if (this.locked) return;
      if (this.held && this.held.id === id) return this.cancelHold(true);
      if (this.held) { this.held = null; }
      this.pickUp(id, 'tray');
    }
    ruleAction(i) {
      this.flag = { rule: i, until: performance.now() + 3200 };
      this.say(fmt(STR.ruleOn, { n: i + 1, state: pick(this.sum.statuses[i] === 'met' ? STR.met : STR.notYet), text: pick(this.texts[i]) }));
      this.render();
      this.timers.push(setTimeout(() => { if (this.flag && this.flag.rule === i) { this.flag = null; this.render(); } }, 3300));
    }
    /** The held student goes to the seat; a student already there swaps (to the held student's old seat, or the waiting area). */
    placeHeld(seatId) {
      const { id, from } = this.held, occ = this.occupant(seatId), old = from === 'tray' ? null : from;
      const changes = { [id]: seatId };
      if (occ) changes[occ] = old;
      this.held = null; AG.input.armCancel(false);
      this.commit(changes);
      const sn = this.seatName(seatId);
      this.say(occ ? fmt(STR.swapped, { a: this.names[id], b: this.names[occ] }) : fmt(STR.placed, { name: this.names[id], table: sn.table }));
      // keyboard: after seating someone from the waiting area, go straight back to it for the next student
      if (from === 'tray' && AG.input.lastDevice === 'keyboard' && !this.locked && this.ids.some(x => !this.seating[x])) {
        if (AG.input.isDown('CONFIRM')) { // the Space that placed them clicks on key-up: that click must not pick the next chip
          this.guardKey = true;
          const off = AG.input.on('CONFIRM', e => { if (e.phase === 'up') { off(); setTimeout(() => { this.guardKey = false; }, 0); } });
        }
        this.zones.set('tray');
      }
    }
    returnHeld() {
      const { id, from } = this.held;
      if (from === 'tray') return this.cancelHold(true);
      this.held = null; AG.input.armCancel(false);
      this.commit({ [id]: null });
      this.say(fmt(STR.returned, { name: this.names[id] }));
    }
    /** One move: apply, count, remember for undo, see what changed. */
    commit(changes) {
      const before = {}, after = {};
      Object.keys(changes).forEach(id => { before[id] = this.seating[id]; after[id] = changes[id]; this.seating[id] = changes[id]; });
      this.moves++;
      this.undo.push({ before, after });
      AG.sfx.play('lunch-table.sfx.place');
      this.hint = null;
      this.afterChange();
    }
    undoMove() {
      if (this.locked) return;
      this.cancelHold(false);
      const e = this.undo.undo();
      if (!e) { this.say(pick(STR.nothing)); return; }
      Object.keys(e.before).forEach(id => { this.seating[id] = e.before[id]; });
      this.hint = null;
      AG.sfx.play('tap');
      this.say(pick(STR.undone));
      this.afterChange(true);
    }
    syncTools() { if (this.undoBtn) this.undoBtn.disabled = !this.undo.canUndo || this.locked; }

    /** After any change: redraw, cheer for a rule that just turned ✔, note who sits alone, check for solved. */
    afterChange(quiet) {
      const before = this.metBefore;
      this.render();
      const now = new Set(); this.sum.statuses.forEach((s, i) => { if (s === 'met') now.add(i); });
      const turned = [...now].filter(i => !before.has(i));
      this.metBefore = now;
      if (!quiet && turned.length && !this.sum.solved) { AG.sfx.play('lunch-table.sfx.rule_ok'); this.react('happy'); }
      if (!quiet && this.sum.alone.length && !this.sayAlone && !this.sum.solved) { this.sayAlone = true; this.ctx.say('encouragement', STR.alone); }
      if (this.sum.solved) this.win();
    }

    /* ---------- drawing ---------- */
    render() {
      const sum = this.sum = L.summary(this.rules, this.ctxNow());
      const heldId = this.held && this.held.id;
      for (const id of this.board.order) this.renderSeat(id, sum, heldId);
      this.renderTray(sum, heldId);
      this.sum.statuses.forEach((st, i) => {
        const b = this.ruleEls[i];
        b.dataset.state = st;
        const mark = b.firstChild, want = st === 'met' ? 'check' : 'cross';
        if (mark.dataset.icon !== want) { mark.dataset.icon = want; mark.replaceChildren(AG.ui.icon(want, 20)); }
        b.setAttribute('aria-label', fmt(STR.ruleOn, { n: i + 1, state: pick(st === 'met' ? STR.met : STR.notYet), text: pick(this.texts[i]) }));
        b.classList.toggle('is-hint', !!this.hint && this.hint.rule === i);
        b.classList.toggle('is-flag', !!this.flag && this.flag.rule === i);
      });
      const pct = Math.round(sum.happiness * 100);
      this.fill.style.width = this.bar.classList.contains('has-art') ? 'calc(' + (100 - pct) + '% - 8px)' : pct + '%';
      this.bar.classList.toggle('is-full', sum.solved);
      this.bar.setAttribute('aria-valuenow', pct); this.bar.setAttribute('aria-label', pick(STR.happy) + ' ' + fmt(STR.rulesMet, { n: sum.met, m: sum.total }));
      this.meterNum.textContent = sum.met + ' / ' + sum.total;
      this.meterTxt.textContent = pick(STR.happy);
      if (this.fair) {
        const totals = L.teamTotals(this.ctxNow(), this.fair.attr);
        for (const t of this.board.tables) {
          const el = this.totalEls[t.id], n = totals[t.id] || 0;
          el.textContent = fmt(STR.teamTotal, { n });
          el.classList.toggle('is-ok', this.sum.statuses[this.rules.indexOf(this.fair)] === 'met');
        }
      }
      this.heldFace.replaceChildren(...(this.held ? [face(this.people[this.held.id], 'neutral')] : []));
      this.putBackBtn.hidden = !this.held;
      this.hud.set({ score: SC.points({ moves: Math.max(this.moves, this.par), par: this.par, hints: this.hints, ranks: [] }), label: this.moves + ' / ' + this.par + ' ' + pick(STR.par) });
      this.syncTools();
      this.renderPlayer();
    }
    cardInner(p, mood) { return [face(p, mood), h('span', { class: 'lt-name' }, p.name), this.traitIcons(p)]; }
    renderSeat(seatId, sum, heldId) {
      const el = this.seatEls[seatId], s = this.board.seats[seatId], who = this.occupant(seatId), sn = this.seatName(seatId);
      const aisle = this.hasAisleRule && s.aisle;
      if (who) {
        const p = this.people[who], mood = sum.moods[who];
        el.dataset.student = who; el.dataset.from = seatId; el.dataset.mood = mood;
        el.replaceChildren(...this.cardInner(p, mood), ...(aisle ? [pxIcon('♿', 'lt-seat__aisle')] : []));
      } else {
        delete el.dataset.student; delete el.dataset.from; delete el.dataset.mood;
        el.replaceChildren(h('span', { class: 'lt-seat__empty', 'aria-hidden': 'true' }), ...(aisle ? [pxIcon('♿', 'lt-seat__aisle')] : []));
      }
      el.classList.toggle('is-held', !!who && who === heldId);
      el.classList.toggle('is-hint', !!this.hint && (this.hint.seat === seatId || (!!who && who === this.hint.student)));
      el.classList.toggle('is-flag', !!this.flag && who && L.involves(this.rules[this.flag.rule]).includes(who));
      el.setAttribute('aria-label', fmt(STR.seatLabel, { table: sn.table, n: sn.n, who: who ? this.names[who] + (this.traitWords(this.people[who]) ? '. ' + this.traitWords(this.people[who]) : '') : pick(STR.empty), aisle: aisle ? pick(STR.aisle) : '' }));
    }
    renderTray(sum, heldId) {
      const waiting = this.ids.filter(id => !this.seating[id]);
      const hadFocus = this.tray.contains(document.activeElement) ? document.activeElement.dataset.student || 'slot' : null;
      const chips = waiting.map(id => {
        const p = this.people[id], b = h('button', { type: 'button', class: 'lt-chip', 'data-student': id, 'data-from': 'tray', 'data-mood': 'neutral', 'aria-label': fmt(STR.chipLabel, { name: p.name, traits: this.traitWords(p) }) }, this.cardInner(p, 'neutral'));
        b.classList.toggle('is-held', id === heldId);
        b.classList.toggle('is-hint', !!this.hint && this.hint.student === id && !this.hint.onBoard);
        b.classList.toggle('is-flag', !!this.flag && L.involves(this.rules[this.flag.rule]).includes(id));
        return b;
      });
      const slot = h('button', { type: 'button', class: 'lt-slot' + (this.held && this.held.from !== 'tray' ? ' is-ready' : ''), 'aria-label': pick(STR.slot) + (this.held && this.held.from !== 'tray' ? '. ' + pick(STR.slotHint) : '') }, waiting.length ? pick(STR.slotHint) : pick(STR.slot));
      this.tray.replaceChildren(h('p', { class: 'lt-tray__title' }, pick(STR.waiting) + ' (' + waiting.length + ')'), ...chips, slot);
      const items = this.trayItems();
      this.trayIdx = Math.min(this.trayIdx, items.length - 1);
      this.setRoving(items, this.trayIdx);
      if (hadFocus) { const i = hadFocus === 'slot' ? items.length - 1 : items.findIndex(x => x.dataset.student === hadFocus); (items[i >= 0 ? i : Math.min(this.trayIdx, items.length - 1)]).focus({ preventScroll: true }); }
    }

    /* ---------- the player's portrait ---------- */
    actionNow() {
      if (this.cheering) return 'cheer';
      if (this.reaction) return this.reaction;
      if (this.held) return 'think';
      if (this.sum && this.sum.alone.length) return 'worried';
      return 'idle';
    }
    renderPlayer() {
      const a = this.actionNow();
      if (a === this.shown) return;
      this.shown = a;
      this.rig.play(a);
      this.fig.replaceChildren(this.rig.img(1));
    }
    react(action, ms) {
      clearTimeout(this.reactT);
      this.reaction = action; this.renderPlayer();
      this.reactT = setTimeout(() => { this.reaction = null; this.renderPlayer(); }, ms || T.reactMs);
    }

    /* ---------- drag and drop (touch and mouse; a tap is handled by the click handlers) ---------- */
    bindPointer() {
      const down = e => {
        if (this.locked || e.button > 0) return;
        if (this.room.contains(e.target) && this.zone !== 'seats') this.zones.set('seats'); // taps on seats need the cursor awake
        const el = e.target.closest('[data-student], .lt-seat');
        if (!el || !this.el.contains(el)) return;
        this.drag = { id: el.dataset.student || null, seat: el.dataset.seat || null, from: el.dataset.from, x: e.clientX, y: e.clientY, pid: e.pointerId, type: e.pointerType, moved: false, ghost: null };
      };
      const move = e => {
        const d = this.drag;
        if (!d || e.pointerId !== d.pid) return;
        if (!d.moved && d.id && Math.hypot(e.clientX - d.x, e.clientY - d.y) > 8) {
          d.moved = true;
          if (!this.held || this.held.id !== d.id) { this.held = null; this.pickUp(d.id, d.from, { drag: true }); }
          d.ghost = h('span', { class: 'lt-ghost' }, face(this.people[d.id], 'neutral'));
          this.ghostRoot.append(d.ghost);
        }
        if (d.moved) {
          e.preventDefault();
          d.ghost.style.left = e.clientX + 'px'; d.ghost.style.top = e.clientY + 'px';
          const t = this.dropTarget(e.clientX, e.clientY);
          for (const id in this.seatEls) this.seatEls[id].classList.toggle('is-hot', !!t && t.seat === id);
          this.tray.classList.toggle('is-hot', !!t && !!t.tray);
        }
      };
      const up = e => {
        const d = this.drag;
        if (!d || e.pointerId !== d.pid) return;
        this.drag = null;
        if (!d.moved) {
          // a touch tap is handled here, not by the click that follows (some browsers drop that click after a drag)
          if (d.type === 'touch' && !this.locked) {
            this.suppress = true; setTimeout(() => { this.suppress = false; }, 450);
            if (d.seat) this.seatAction(d.seat, { device: 'touch', via: 'tap' });
            else if (d.id) this.chipAction(d.id);
          }
          return;
        }
        const t = this.dropTarget(e.clientX, e.clientY);
        this.endGhost(d);
        this.suppress = true; setTimeout(() => { this.suppress = false; }, 60);
        if (this.locked || !this.held) return;
        if (t && t.seat) { if (this.held.from === t.seat) this.cancelHold(true); else this.placeHeld(t.seat); }
        else if (t && t.tray) this.returnHeld();
        else this.cancelHold(true);
      };
      const cancel = e => { const d = this.drag; if (d && e.pointerId === d.pid) { this.cancelDrag(); } };
      this.el.addEventListener('pointerdown', down);
      window.addEventListener('pointermove', move, { passive: false });
      window.addEventListener('pointerup', up);
      window.addEventListener('pointercancel', cancel);
      this.offs.push(() => { this.el.removeEventListener('pointerdown', down); window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', cancel); });
    }
    dropTarget(x, y) {
      const el = document.elementFromPoint(x, y);
      if (!el) return null;
      const seat = el.closest('[data-seat]');
      if (seat && this.room.contains(seat)) return { seat: seat.dataset.seat };
      return el.closest('.lt-tray') ? { tray: true } : null;
    }
    endGhost(d) {
      if (d && d.ghost) d.ghost.remove();
      for (const id in this.seatEls) this.seatEls[id].classList.remove('is-hot');
      this.tray.classList.remove('is-hot');
    }
    cancelDrag() { const d = this.drag; this.drag = null; this.endGhost(d); if (d && d.moved) this.cancelHold(false); }

    /* ---------- hints ---------- */
    giveHint() {
      if (this.locked) return;
      if (this.hints >= this.maxHints) { this.say(pick(STR.noHints)); return; }
      this.cancelHold(false);
      const hn = S.hint(this.model, this.seating);
      if (!hn) { this.say(pick(STR.noRule)); return; }
      this.hints++;
      const onBoard = !!this.seating[hn.student];
      this.hint = { rule: hn.rule, student: hn.student, seat: hn.seat, onBoard };
      const sn = this.seatName(hn.seat);
      this.say(fmt(STR.hintLine, { name: this.names[hn.student], table: sn.table, n: sn.n }) + ' ' + pick(STR.hintCost));
      this.ctx.say('instruction', fmt(STR.hintLine, { name: this.names[hn.student], table: sn.table, n: sn.n }));
      AG.sfx.play('blip');
      this.render();
      this.timers.push(setTimeout(() => { if (this.hint && this.hint.seat === hn.seat) { this.hint = null; this.render(); } }, T.hintMs));
    }

    /* ---------- solved → the Upstander Moment(s) → results ---------- */
    win() {
      if (this.solved) return;
      this.solved = true; this.locked = true;
      this.held = null; this.hint = null; this.flag = null;
      AG.input.armCancel(false);
      this.cursor.active = false;
      this.cheering = true;
      this.render();
      this.say(fmt({ en: 'Everyone is seated and every rule is met!' }, {}));
      AG.kit.celebrate(this.stage);
      AG.sfx.play('lunch-table.sfx.solved');
      this.ctx.say('congratulations', STR.solved);
      this.ctx.after(T.celebrateMs, () => this.upstander());
    }
    upstander() {
      const moments = this.level.upstander.map(id => this.data.moments.find(m => m.id === id)).filter(Boolean);
      this.el.hidden = true;
      this.up = new LT.Upstander(this.stage, this.ctx, { moments, people: this.cast, seed: this.ctx.seed + this.level.level, onDone: r => this.finish(r) });
    }
    finish(res) {
      if (this.ended) return;
      this.ended = true;
      const o = { solved: true, moves: this.moves, par: this.par, hints: this.hints, ranks: res.ranks, undos: this.undo.used };
      const stars = SC.stars(o), score = SC.points(o);
      let stats = {};
      if (this.ctx.mode === 'stage') {
        stats = AG.store.update('stats', s => { const t = s.lunchTable = s.lunchTable || { best: 0 }; t.best = (t.best || 0) + res.ranks.filter(r => r === 'best').length; }).lunchTable;
      }
      const best = res.ranks.filter(r => r === 'best').length;
      const detail = [
        { label: STR.dMoves, value: this.moves + ' (' + pick(STR.par) + ' ' + this.par + ')' },
        { label: STR.dHints, value: this.hints },
        { label: STR.dUp, value: best + ' / ' + res.ranks.length + ' ' + pick(STR.dBest), icon: 'heart' }
      ];
      this.doneFn({
        won: true, stars, score, timeMs: Math.round(performance.now() - this.t0),
        collectibles: SC.collectibles(o), detail,
        message: stars === 3 ? STR.msg3 : stars === 2 ? STR.msg2 : STR.msg1,
        badgeEvents: SC.badges(stats, { level: this.ctx.level, stars, solved: true })
      });
    }

    destroy() {
      this.ended = true; this.locked = true;
      clearTimeout(this.reactT);
      this.timers.forEach(clearTimeout);
      this.offs.forEach(f => f());
      this.cancelDrag();
      this.stage.removeEventListener('click', this.noClick, true);
      if (this.cursor) this.cursor.destroy();
      if (this.zones) this.zones.destroy();
      if (this.up) this.up.destroy();
      AG.input.armCancel(false);
    }
  }

  LT.Scene = Scene;
  LT.STR = STR;
  LT.face = face; LT.setFace = setFace; LT.pxIcon = pxIcon; LT.cssUrl = cssUrl; LT.assetUrl = assetUrl; LT.injectCss = injectCss;
})(window.AG);
