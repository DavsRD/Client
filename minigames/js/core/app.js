/* AG.host — everything AGILA Safety Games shows inside #ag-app on a hazard page
 * (KALASAG O1 + O3), driven by js/ui/game-host.js:
 *
 *   await AG.host.init(root, { hazard: { id, name, category } })
 *   AG.host.show(AG.router.parse(location.hash))  → true, or 'fallback' (the host then
 *                                                   replaces the hash with #game)
 *   AG.host.leave()                                stop a game (route change, page hide)
 *
 * Screens:
 *   overview  the game card (thumbnail, genre, objective, How to play with live prompt
 *             icons, Controls help, Save for offline), then — for built games — character
 *             selection, Easy/Advanced + tutorial, the row of 5 level tiles and Play / Continue.
 *             Unbuilt games show "Coming soon" instead. With ?debug=1 an unbuilt game's
 *             overview runs the sandbox test game ("Tap the Stars").
 *   play      head bar (← overview, title, level chip, Playing-as face, ↻, ⏸, ⛶), HUD, stage,
 *             touch controls, feedback bar; the game's intro talk (player + role expert),
 *             the tutorial, then the game's mount(stage, ctx, done).
 *   results   the prototype's results screen; Play again · Next level · Change character ·
 *             Back to the lesson.
 * Game XP is announced with the window event kalasag:gameresult; the site adds it to its XP. */
(function (AG) {
  const { h } = AG.util;
  const t = (k, v) => AG.t(k, v), pick = v => AG.pick(v);

  let root = null, hazard = null, game = null, realGame = null, unlockAll = false;
  let view = null, session = 0, play = null, lastResult = null;
  let focusPickerNext = false, tutorialWanted = null, cycleTimer = null, debugTimer = null;

  const gameId = () => game && game.id;
  const me = () => AG.chars.selected();
  /** The role expert joins the intro and speaks the info / warning boxes. If the player
   *  picked the expert, AGILA takes the role; if the player is AGILA, the expert stays. */
  function expertId() {
    const role = game && game.hostRole;
    if (!role) return 'agila';
    return me() === role && role !== 'agila' ? 'agila' : role;
  }
  const difficulty = () => AG.store.get('difficulty') === 'advanced' ? 'advanced' : 'easy';
  const thumbSrc = g => g.sandbox ? AG.assets.placeholderURL('_sandbox.thumb', 160, 90) : AG.path('assets/shared/thumbs/' + g.id + '.png');
  const prompts = item => AG.input.promptIcon({ keys: item.keys, gesture: item.gesture, joiner: '' });

  /* =========================================================
     init / routing
     ========================================================= */
  async function init(rootEl, opts) {
    root = rootEl; hazard = opts.hazard;
    root.classList.add('ag');
    applyRootSettings();
    await Promise.all([AG.registry.ready(), AG.assets.ready()]);
    realGame = AG.registry.forHazard(hazard.id);
    game = realGame;
    if (AG.debug.on && (!realGame || !realGame.built)) game = AG.registry.sandbox(hazard.id);
    AG.on('kalasag:languagechange', relabel);
    AG.on('ag:settings', applyRootSettings);
    // CSS tokens follow the site theme by themselves; canvas games can redraw on ag:theme.
    AG.on('kalasag:themechange', e => AG.emit('ag:theme', e.detail));
    AG.input.onShell('PAUSE', e => { if (e.phase === 'down' && play && play.mounted && !play.finished) setPause(!AG.paused); });
    document.addEventListener('visibilitychange', () => { if (document.hidden && play && play.mounted && !play.finished) setPause(true); });
    window.addEventListener('blur', () => { if (play && play.mounted && !play.finished && !AG.paused) setPause(true); });
    document.addEventListener('fullscreenchange', () => { if (!document.fullscreenElement && play && play.mounted && !play.finished) setPause(true); syncFocusButton(); });
  }

  function applyRootSettings() { if (root) root.classList.toggle('ag-bigtext', !!AG.store.setting('bigText')); }

  function show(route) {
    if (!root || !game) return true;
    if (route.unlockAll) unlockAll = true;
    if (route.view === 'play') {
      if (!game.built) return 'fallback';
      if (!AG.progress.levelOpen(game.id, route.level, unlockAll)) return 'fallback';
      startPlay({ level: route.level, mode: 'stage' });
      return true;
    }
    if (route.view === 'daily') {
      if (!game.built || !game.daily || AG.progress.dailyGame() !== game.id) return 'fallback';
      const seed = AG.progress.dailySeed();
      startPlay({ level: (seed % AG.progress.rules.LEVELS) + 1, mode: 'daily', seed });
      return true;
    }
    if (view !== 'overview') leave();
    renderOverview();
    return true;
  }

  function relabel() {
    if (view === 'overview') renderOverview();
    else if (view === 'result' && lastResult) renderResult(lastResult);
    else if (view === 'play' && play) play.relabel();
  }

  /* =========================================================
     overview
     ========================================================= */
  function renderOverview() {
    clearInterval(cycleTimer); clearInterval(debugTimer);
    view = 'overview';
    const parts = [];
    if (game.sandbox) parts.push(h('p', { class: 'ag-debugnote' }, 'Debug: ' + (realGame ? '“' + pick(realGame.title) + '” is not built yet, so this overview runs the sandbox test game.' : 'sandbox test game.')));
    if (AG.debug.rig) parts.push(rigPanel());
    if (AG.debug.assets) parts.push(assetsPanel());
    parts.push(gameCard());
    if (game.built) parts.push(pickerPanel(), setupPanel(), mapPanel(), playRow());
    else parts.push(soonPanel());
    root.replaceChildren(h('div', { class: 'ag-overview', 'data-category': game.hazardGroup }, parts));
    if (focusPickerNext) {
      focusPickerNext = false;
      const btn = root.querySelector('.ag-lineup__char[aria-pressed="true"]');
      if (btn) { btn.focus({ preventScroll: true }); btn.scrollIntoView({ block: 'center' }); }
    }
  }

  function gameCard() {
    const help = h('button', { type: 'button', class: 'ag-btn ag-btn--alt ag-btn--small', 'aria-haspopup': 'dialog' }, '? ' + t('ov.help'));
    help.addEventListener('click', openHelp);
    const actions = h('div', { class: 'ag-gamecard__actions' }, help);
    if (game.built && !game.sandbox) actions.append(saveButton());
    else if (game.sandbox && AG.bridge.offlineSupported) actions.append(saveButton());
    return h('article', { class: 'ag-gamecard' },
      h('div', { class: 'ag-gamecard__thumb' }, h('img', { class: 'ag-px', src: thumbSrc(game), alt: '', width: 320, height: 180 })),
      h('div', { class: 'ag-gamecard__body' },
        h('span', { class: 'ag-eyebrow' }, t('ov.eyebrow', { genre: game.genre })),
        h('h3', { class: 'ag-gamecard__title' }, pick(game.title)),
        h('p', { class: 'ag-gamecard__obj' }, pick(game.objective)),
        h('h4', { class: 'ag-subhead' }, t('ov.howTo')),
        h('ul', { class: 'ag-howto' }, (game.howTo || []).map(item => h('li', {}, prompts(item), h('span', {}, pick(item))))),
        actions));
  }

  function saveButton() {
    const btn = h('button', { type: 'button', class: 'ag-btn ag-btn--alt ag-btn--small ag-savebtn' }, '📥 ' + t('ov.save'));
    if (!AG.bridge.offlineSupported) { btn.hidden = true; return btn; }
    let files = null, failed = false;
    const render = async (pct) => {
      files = files || await AG.assets.listForGame(game.id);
      if (pct != null) { btn.disabled = true; btn.textContent = t('ov.saving', { pct }); return; }
      const saved = await AG.bridge.isSaved(files);
      btn.disabled = saved; btn.classList.toggle('is-saved', saved);
      btn.textContent = saved ? '✓ ' + t('ov.saved') : failed ? t('ov.saveFailed') : '📥 ' + t('ov.save');
      btn.hidden = !saved && !navigator.onLine;
    };
    btn.addEventListener('click', async () => {
      failed = false; files = files || await AG.assets.listForGame(game.id);
      try { await AG.bridge.saveFiles(files, pct => render(pct)); } catch (e) { failed = true; }
      render();
    });
    render();
    return btn;
  }

  /* ---------- character selection (the prototype's lineup + #chars card in one panel) ---------- */
  const CYCLE = { squad: ['pose_idle', 'pose_wave', 'expr_happy', 'pose_point', 'pose_cheer', 'expr_determined'],
    agila: ['pose_idle_geared', 'pose_point_geared', 'expr_happy_geared', 'expr_wink_geared', 'pose_alert_geared', 'pose_run_flap_1_geared'] };

  function pickerPanel() {
    const sel = me();
    const lineup = h('div', { class: 'ag-lineup', role: 'toolbar', 'aria-label': t('pick.title') });
    AG.chars.list().forEach(c => {
      const on = c.id === sel;
      const b = h('button', { type: 'button', class: 'ag-lineup__char' + (on ? ' on' : ''), 'aria-pressed': String(on), tabindex: on ? '0' : '-1', 'data-char': c.id, 'aria-label': t('pick.label', { name: c.name }), style: { '--role': c.color } },
        h('span', { class: 'ag-lineup__stage' }, AG.chars.img(c.id, on ? 'wave' : 'idle', 1)), h('span', { class: 'ag-lineup__name' }, c.name));
      b.addEventListener('click', () => choose(c.id));
      lineup.append(b);
    });
    lineup.addEventListener('keydown', e => {
      const btns = [...lineup.querySelectorAll('.ag-lineup__char')];
      const i = btns.indexOf(document.activeElement); if (i < 0) return;
      let j = null;
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') j = (i + 1) % btns.length;
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') j = (i - 1 + btns.length) % btns.length;
      else if (e.key === 'Home') j = 0; else if (e.key === 'End') j = btns.length - 1;
      if (j == null) return;
      e.preventDefault();
      btns.forEach((b, k) => b.tabIndex = k === j ? 0 : -1);
      btns[j].focus();
    });
    const c = AG.chars.get(sel);
    const talk = AG.dialogue.box({ speaker: sel, style: 'standard', text: t('pick.intro', { name: c.name, role: c.role, gear: c.gear, bio: c.bio }), plainFont: AG.store.setting('plainFont') });
    const frame = AG.progress.unlocked().filter(u => u.id.startsWith('frame-')).pop();
    if (frame) talk.dataset.frame = frame.id;
    if (AG.progress.unlocked().some(u => u.id === 'plate-gold')) talk.dataset.plate = 'gold';
    startCycle(talk, sel);
    const ex = expertId(), exC = AG.chars.get(ex);
    const swapped = game.hostRole && ex !== game.hostRole;
    const expert = h('p', { class: 'ag-picker__expert', style: { '--role': exC.color } },
      AG.ui.icon(exC.icon, 24), ' ', swapped ? t('pick.expertSwap', { name: AG.chars.get(game.hostRole).name }) : t('pick.expert', { name: exC.name }));
    return h('section', { class: 'ag-picker', 'aria-labelledby': 'ag-pick-title' },
      h('div', { class: 'ag-panelhead' }, h('h3', { id: 'ag-pick-title' }, t('pick.title')), h('span', { class: 'ag-eyebrow' }, t('pick.sub'))),
      lineup, h('div', { class: 'ag-picker__talk' }, talk), expert);
  }

  function startCycle(wrap, id) {
    clearInterval(cycleTimer);
    const fig = wrap.querySelector('.rs-dlg');
    const frames = AG.chars.get(id).agila ? CYCLE.agila : CYCLE.squad;
    let k = 0;
    cycleTimer = setInterval(() => {
      if (AG.reducedMotion() || !fig.isConnected) return;
      k = (k + 1) % frames.length;
      const src = AG.chars.src(id, frames[k]);
      if (fig._portrait) fig._portrait.src = src;
      if (fig._bust) fig._bust.src = src;
    }, 900);
  }

  function choose(id) {
    AG.chars.select(id); AG.sfx.play('good');
    const old = root.querySelector('.ag-picker');
    if (old) { const fresh = pickerPanel(); old.replaceWith(fresh); const b = fresh.querySelector('[data-char="' + id + '"]'); b && b.focus(); }
  }

  function setupPanel() {
    if (tutorialWanted == null) tutorialWanted = !AG.store.get('tutorials')[game.id];
    const seg = h('div', { class: 'ag-seg', role: 'group', 'aria-label': t('lvl.title') });
    ['easy', 'advanced'].forEach(d => {
      const b = h('button', { type: 'button', 'aria-pressed': String(difficulty() === d) }, t('lvl.' + d));
      b.addEventListener('click', () => { AG.store.set('difficulty', d); AG.sfx.play('tap'); seg.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', String(x === b))); });
      seg.append(b);
    });
    const tut = h('input', { type: 'checkbox', id: 'ag-tut', checked: tutorialWanted || null });
    tut.addEventListener('change', () => { tutorialWanted = tut.checked; });
    return h('div', { class: 'ag-setup' },
      h('div', { class: 'ag-setup__level' }, h('span', { class: 'ag-label' }, t('lvl.title')), seg),
      h('label', { class: 'ag-check', for: 'ag-tut' }, tut, h('span', {}, t('lvl.tutorial'))));
  }

  /** One row of 5 level tiles (KALASAG O12: no worlds). Level N+1 opens at ≥ 1 star on level N. */
  function mapPanel() {
    const P = AG.progress, N = P.rules.LEVELS;
    const row = h('ol', { class: 'ag-levels' });
    let firstLocked = 0;
    for (let n = 1; n <= N; n++) {
      const rec = P.level(game.id, n);
      if (P.levelOpen(game.id, n, unlockAll)) {
        row.append(h('li', {}, h('a', { class: 'ag-level' + (rec ? ' is-played' : ''), href: AG.router.playHash(n), 'aria-label': t('map.level', { n }) + ', ' + t('map.stars', { n: rec ? rec.stars : 0 }) },
          h('b', {}, String(n)), AG.ui.stars(rec ? rec.stars : 0))));
      } else {
        if (!firstLocked) firstLocked = n;
        row.append(h('li', {}, h('span', { class: 'ag-level is-locked', 'aria-label': t('map.level', { n }) + ', ' + t('map.lockedLevel') },
          h('b', {}, String(n)), h('span', { 'aria-hidden': 'true' }, '🔒'))));
      }
    }
    const stars = P.gameStars(game.id);
    return h('section', { class: 'ag-map', 'aria-labelledby': 'ag-map-title' },
      h('div', { class: 'ag-panelhead' }, h('h3', { id: 'ag-map-title' }, t('map.title')),
        h('span', { class: 'ag-map__stars' }, AG.ui.icon('star', 18), ' ' + stars + '/' + N * 3),
        unlockAll ? h('span', { class: 'ag-eyebrow' }, t('map.demo')) : null),
      row,
      firstLocked ? h('p', { class: 'ag-map__locked' }, '🔒 ' + t('map.locked', { n: firstLocked - 1, m: firstLocked })) : null,
      postersRow());
  }

  /** Reward posters (registry "posters": { "<n>": { asset, title } }): each opens once its level
   *  has a star, and shows big in a dialog. */
  function postersRow() {
    const defs = game.posters ? Object.keys(game.posters).map(Number).filter(n => n >= 1 && n <= AG.progress.rules.LEVELS).sort() : [];
    if (!defs.length) return null;
    const open = defs.filter(n => AG.progress.rules.stars(AG.store.get('levels'), game.id, n) >= 1);
    return h('div', { class: 'ag-posters' }, open.map(n => posterButton(game.posters[n])),
      open.length < defs.length ? h('small', { class: 'ag-poster is-locked' }, '🔒 ' + t('map.posterLocked', { n: open.length, total: defs.length })) : null);
  }
  function posterButton(def) {
    const src = AG.assets.url(def.asset) || AG.assets.placeholderURL(def.asset, 96, 128);
    const btn = h('button', { type: 'button', class: 'ag-btn ag-btn--alt ag-btn--small ag-poster' }, '🖼 ' + t('map.poster', { title: def.title }));
    btn.addEventListener('click', () => {
      const close = h('button', { type: 'button', class: 'ag-btn ag-btn--alt ag-btn--small' }, t('common.close'));
      const dlg = h('dialog', { class: 'ag-help ag-posterdlg', 'aria-label': pick(def.title) },
        h('div', { class: 'ag-help__box' }, h('div', { class: 'ag-panelhead' }, h('h3', {}, pick(def.title)), close),
          h('img', { class: 'ag-px', src, alt: pick(def.title), width: 192, height: 256 })));
      close.addEventListener('click', () => dlg.close());
      dlg.addEventListener('close', () => { dlg.remove(); btn.focus(); });
      dlg.addEventListener('click', e => { if (e.target === dlg) dlg.close(); });
      root.append(dlg); dlg.showModal(); close.focus();
    });
    return btn;
  }

  function playRow() {
    const next = AG.progress.nextLevel(game.id, unlockAll);
    const label = AG.progress.played(game.id) ? t('play.continue', { n: next.level }) : t('play.start', { n: next.level });
    return h('div', { class: 'ag-playrow' }, h('a', { class: 'ag-btn ag-btn--big ag-playbtn', href: AG.router.playHash(next.level) }, '▶ ' + label),
      (game.overviewExtras || []).map(extraButton));
  }

  /** Registry "overviewExtras": [{ label, sceneKey }]. Each is a button beside Play that opens the game's own scene
   *  (module "extras": { <sceneKey>: { mount(body, { characterId, expertId, close }) → cleanup } }) in a dialog. */
  function extraButton(def) {
    const btn = h('button', { type: 'button', class: 'ag-btn ag-btn--alt ag-btn--big ag-extrabtn', 'aria-haspopup': 'dialog' }, '📖 ' + pick(def.label));
    btn.addEventListener('click', () => openExtra(def, btn));
    return btn;
  }
  async function openExtra(def, btn) {
    btn.disabled = true;
    let mod = null;
    try { mod = await AG.registry.load(game.id); } catch (err) { console.error(err); }
    btn.disabled = false;
    const scene = mod && mod.extras && mod.extras[def.sceneKey];
    if (!scene || view !== 'overview') return;
    const body = h('div', { class: 'ag-extra__body' });
    const close = h('button', { type: 'button', class: 'ag-btn ag-btn--alt ag-btn--small' }, t('common.close'));
    const dlg = h('dialog', { class: 'ag-help ag-extradlg', 'aria-label': pick(def.label) },
      h('div', { class: 'ag-help__box' }, h('div', { class: 'ag-panelhead' }, h('h3', {}, pick(def.label)), close), body));
    let cleanup = null;
    close.addEventListener('click', () => dlg.close());
    dlg.addEventListener('close', () => { try { if (cleanup) cleanup(); } catch (err) { console.error(err); } dlg.remove(); btn.focus(); });
    dlg.addEventListener('click', e => { if (e.target === dlg) dlg.close(); });
    root.append(dlg);
    dlg.showModal();
    cleanup = scene.mount(body, { characterId: me(), expertId: expertId(), close: () => dlg.close() }) || null;
  }

  function soonPanel() {
    return h('div', { class: 'ag-soon' }, AG.chars.img('agila', 'think', 1),
      h('div', {}, h('h3', {}, t('ov.soonTitle')), h('p', {}, t('ov.soonText'))));
  }

  /* ---------- Controls help dialog (KALASAG O11) ---------- */
  function openHelp() {
    const keyImgs = keys => h('span', { class: 'ag-keys' }, (keys || []).map(k => h('img', { class: 'ag-px', src: AG.path('assets/shared/prompts/' + k + '.png'), alt: k.replace('key_', ''), width: 36, height: 36 })));
    const gestureImg = g => g ? h('img', { class: 'ag-px', src: AG.path('assets/shared/prompts/' + g + '.png'), alt: g.replace('gesture_', '').replace('_', ' '), width: 36, height: 36 }) : '—';
    const row = (a, k, tch) => h('tr', {}, h('td', {}, a), h('td', {}, k), h('td', {}, tch));
    const table = rows => h('table', { class: 'ag-table' }, h('thead', {}, h('tr', {}, h('th', {}, t('help.action')), h('th', {}, t('help.keyboard')), h('th', {}, t('help.touch')))), h('tbody', {}, rows));
    const close = h('button', { type: 'button', class: 'ag-btn ag-btn--alt ag-btn--small' }, t('common.close'));
    const legend = h('div', { class: 'ag-legend' }, Object.keys(AG.WORDBOX).map(type => AG.dialogue.word({ type, text: AG.WORDBOX[type].use })));
    const dlg = h('dialog', { class: 'ag-help', 'aria-labelledby': 'ag-help-title' },
      h('div', { class: 'ag-help__box' },
        h('div', { class: 'ag-panelhead' }, h('h3', { id: 'ag-help-title' }, t('help.title')), close),
        h('h4', { class: 'ag-subhead' }, t('help.thisGame') + ': ' + pick(game.title)),
        table((game.howTo || []).map(i => row(pick(i), keyImgs(i.keys), gestureImg(i.gesture)))),
        h('h4', { class: 'ag-subhead' }, t('help.everyGame')),
        table([row(t('help.pauseRow'), keyImgs(game.pauseKeys || ['key_esc', 'key_p']), '⏸ ' + t('help.tapButton')),
          row(t('help.focusRow'), '—', '⛶ ' + t('help.tapButton')),
          row(t('help.choiceRow'), keyImgs(['key_1', 'key_2', 'key_3', 'key_4']), gestureImg('gesture_tap'))]),
        h('h4', { class: 'ag-subhead' }, t('help.messages')), legend,
        h('h4', { class: 'ag-subhead' }, t('help.credits')),
        h('ul', { class: 'ag-credits' }, ['help.creditChars', 'help.creditFonts', 'help.creditAudio', 'help.creditSafety'].map(k => h('li', {}, t(k))))));
    close.addEventListener('click', () => dlg.close());
    dlg.addEventListener('close', () => dlg.remove());
    dlg.addEventListener('click', e => { if (e.target === dlg) dlg.close(); });
    root.append(dlg);
    dlg.showModal();
    close.focus();
  }

  /* =========================================================
     play shell
     ========================================================= */
  function startPlay(spec) {
    stopPlay(true);
    clearInterval(cycleTimer);
    const my = ++session;
    view = 'play'; AG.paused = false;
    const char = me(), diff = difficulty();
    // A link straight into a level skips the overview: the tutorial still shows the first time.
    if (tutorialWanted == null) tutorialWanted = !AG.store.get('tutorials')[game.id];
    AG.store.update('stats', s => { s.used = s.used || {}; s.used[char] = 1; });
    const p = play = { spec, my, char, diff, mounted: false, finished: false, timers: new Set(), pauseHooks: [], cleanup: null };

    const title = h('h2', { class: 'ag-shell__title' });
    const chip = h('span', { class: 'ag-chip' });
    const face = h('span', { class: 'ag-face', style: { '--role': AG.chars.get(char).color } },
      h('span', { class: 'ag-face__img' }, AG.chars.img(char, 'talk', 1)), h('span', { class: 'ag-face__txt' }, h('small', {}), h('b', {}, AG.chars.get(char).name)));
    const back = h('a', { class: 'ag-btn ag-btn--alt ag-btn--icon', href: '#game' }, '←');
    const restart = h('button', { class: 'ag-btn ag-btn--alt ag-btn--icon', type: 'button' }, '↻');
    const pause = h('button', { class: 'ag-btn ag-btn--alt ag-btn--icon ag-pausebtn', type: 'button' }, '⏸');
    const focus = h('button', { class: 'ag-btn ag-btn--alt ag-btn--icon ag-focusbtn', type: 'button' }, '⛶');
    const hudSlot = h('div', { class: 'ag-hudslot' });
    const stage = h('div', { class: 'ag-stage', tabindex: '0', 'data-game': game.id });
    const controls = h('div', { class: 'ag-controls' });
    const fbbar = h('div', { class: 'ag-fbbar', 'aria-live': 'polite' });
    const shell = h('section', { class: 'ag-shell', 'data-game': game.id },
      h('div', { class: 'ag-shell__head' }, back, title, chip, face, restart, pause, focus), hudSlot, stage, controls, fbbar);
    p.shell = shell; p.stage = stage;
    p.relabel = () => {
      title.textContent = spec.mode === 'daily' ? t('sh.daily') + ': ' + pick(game.title) : pick(game.title);
      chip.textContent = (spec.mode === 'daily' ? '' : t('map.level', { n: spec.level }) + ' · ') + t('lvl.' + diff);
      face.querySelector('small').textContent = t('sh.playingAs');
      back.setAttribute('aria-label', t('sh.back')); back.title = t('sh.back');
      restart.setAttribute('aria-label', t('sh.restart')); restart.title = t('sh.restart');
      pause.setAttribute('aria-label', AG.paused ? t('sh.resume') : t('sh.pause')); pause.title = t('sh.pause') + (game.pauseKeys ? ' (Esc)' : ' (P)');
      syncFocusButton();
    };
    p.relabel();
    root.replaceChildren(shell);
    restart.addEventListener('click', () => startPlay(spec));
    pause.addEventListener('click', () => setPause(!AG.paused));
    focus.addEventListener('click', toggleFocus);
    AG.input.attach(stage);
    stage.append(h('p', { class: 'ag-loading' }, t('ov.loading')));
    if (AG.debug.overlay) startDebugOverlay(spec);

    AG.music.allow();
    AG.music.play(AG.assets.resolve(game.id + '.music.theme') ? game.id + '.music.theme' : 'shared.music.menu');

    (async () => {
      let mod;
      try { mod = await AG.registry.load(game.id); await AG.gfx.ready(); }
      catch (err) { console.error(err); if (my === session) stage.replaceChildren(h('p', { class: 'ag-loading' }, t('sh.loadFailed', { msg: err.message }))); return; }
      if (my !== session) return;
      p.mod = mod;
      let levelData = null;
      try {
        const levels = mod.levels || (game.data && game.data.includes('levels.json') ? await AG.data.load(game.id, 'levels.json') : null);
        if (levels) levelData = spec.mode === 'daily' && mod.generateDaily ? mod.generateDaily(spec.seed) : levels.find(x => x.level === spec.level) || null;
      } catch (err) { AG.warnOnce('levels:' + game.id, 'levels.json missing for', game.id); }
      if (spec.mode === 'daily' && !levelData && mod.generateDaily) levelData = mod.generateDaily(spec.seed);
      if (my !== session) return;
      const ctx = makeCtx(p, levelData);
      p.ctx = ctx;
      stage.replaceChildren();
      const needIntro = spec.mode !== 'daily' && !AG.store.get('intros')[game.id];
      const tutLines = tutorialWanted ? (typeof mod.tutorial === 'function' ? mod.tutorial(ctx) : mod.tutorial) : null;
      const mount = () => {
        if (my !== session) return;
        stage.replaceChildren();
        try { p.cleanup = mod.mount(stage, ctx, ctx.done) || null; }
        catch (err) { console.error(err); stage.append(h('p', { class: 'ag-loading' }, t('sh.loadFailed', { msg: err.message }))); }
        p.mounted = true;
        stage.focus({ preventScroll: true });
      };
      const runTutorial = () => {
        if (tutLines && tutLines.length) {
          AG.store.update('tutorials', x => { x[game.id] = 1; });
          tutorialWanted = false;
          talk(stage, t('tut.title') + ' · ' + pick(game.title), tutLines.map((l, i) => Object.assign({ speaker: p.char, style: i === tutLines.length - 1 ? 'success' : 'instruction', side: 'left' }, typeof l === 'string' || l.en ? { text: l } : l)), t('tut.skip'), mount);
        } else mount();
      };
      if (needIntro) {
        AG.store.update('intros', x => { x[game.id] = 1; });
        const lines = mod.intro ? mod.intro(ctx) : [
          { speaker: ctx.expertId, text: t('intro.default1', { title: game.title }) },
          { speaker: p.char, text: pick(game.objective) },
          { speaker: ctx.expertId, text: t('intro.default2') }];
        talk(stage, pick(game.title), lines, t('intro.skip'), runTutorial);
      } else runTutorial();
    })();
  }

  /** A short scripted exchange inside the stage (intro, tutorial), skippable. */
  function talk(stage, label, lines, skipLabel, onDone) {
    const box = h('div', { class: 'ag-talk__box' });
    // Deferred: the key press that ends the talk must not also reach the game that mounts next.
    let done = false; const finish = () => { if (!done) { done = true; setTimeout(onDone, 0); } };
    const skip = h('button', { class: 'ag-btn ag-btn--alt ag-btn--small', type: 'button' }, skipLabel);
    skip.addEventListener('click', finish);
    stage.replaceChildren(h('div', { class: 'ag-talk' }, h('span', { class: 'ag-eyebrow' }, label), box, skip));
    AG.dialogue.conversation(box, lines.map(l => Object.assign({ plainFont: AG.store.setting('plainFont') }, l)), { typewriter: AG.store.setting('typewriter') !== false && !AG.reducedMotion(), onDone: finish });
  }

  function makeCtx(p, levelData) {
    const { spec, my, stage } = p;
    const ex = expertId();
    const shell = p.shell;
    const ctx = {
      gameId: game.id, hazardId: hazard.id, level: spec.level, difficulty: p.diff,
      seed: spec.seed != null ? spec.seed : AG.util.seedFromDate() * 100 + spec.level,
      mode: spec.mode, levelData, characterId: p.char, expertId: ex, lang: AG.lang(),
      stage, controls: shell.querySelector('.ag-controls'), game, assets: AG.assets,
      hud(o) { const hu = AG.ui.hud(o); shell.querySelector('.ag-hudslot').replaceChildren(hu.el); return hu; },
      /** A word box from the right speaker: the role expert says info and warning, the player the rest. */
      say(type, text, o) { return AG.ui.feedback(stage, text, Object.assign({ type, speaker: type === 'info' || type === 'warning' ? ex : p.char }, o || {})); },
      feedback(text, type, o) { return ctx.say(type || 'info', text, o); },
      characterLine() { return AG.CHARACTER_LINES[p.char]; },
      rig(viewName, o) { return new AG.CharacterRig(stage, p.char, viewName || game.view || 'side', o); },
      safe(n) { AG.store.update('stats', s => { s.safeChoices = (s.safeChoices || 0) + (n || 1); }); },
      every(ms, fn) { const id = setInterval(() => { if (!AG.paused && my === session) fn(); }, ms); p.timers.add(id); return id; },
      after(ms, fn) { const id = setTimeout(() => { p.timers.delete(id); if (my === session) fn(); }, ms); p.timers.add(id); return id; },
      clear(id) { clearInterval(id); clearTimeout(id); p.timers.delete(id); },
      onPause(fn) { p.pauseHooks.push(fn); },
      paused: () => !!AG.paused,
      done(res) {
        if (p.finished || my !== session) return;
        p.finished = true;
        setTimeout(() => { if (my === session) finishPlay(p, res || {}); }, res && res.delay != null ? res.delay : 700);
      }
    };
    ctx.finish = ctx.done;
    return ctx;
  }

  /* ---------- pause menu (Esc / P / ⏸), with the game-only settings ---------- */
  function setPause(on) {
    const p = play; if (!p || !p.mounted || p.finished) return;
    AG.paused = on;
    p.pauseHooks.forEach(f => { try { f(on); } catch (e) { console.error(e); } });
    p.stage.querySelectorAll(':scope > .ag-pausebox').forEach(n => n.remove());
    const pb = p.shell.querySelector('.ag-pausebtn');
    pb.textContent = on ? '▶' : '⏸'; pb.setAttribute('aria-label', on ? t('sh.resume') : t('sh.pause'));
    AG.input.releaseAll();
    if (!on) { p.stage.focus({ preventScroll: true }); return; }
    AG.sfx.play('pause');
    const resume = h('button', { class: 'ag-btn', type: 'button' }, '▶ ' + t('sh.resume'));
    resume.addEventListener('click', () => setPause(false));
    const restart = h('button', { class: 'ag-btn ag-btn--alt', type: 'button' }, '↻ ' + t('sh.restart'));
    restart.addEventListener('click', () => startPlay(p.spec));
    const setBtn = h('button', { class: 'ag-btn ag-btn--alt', type: 'button', 'aria-expanded': 'false' }, '⚙ ' + t('pause.settings'));
    const panel = settingsPanel(p.mod && p.mod.settings); panel.hidden = true;
    setBtn.addEventListener('click', () => { panel.hidden = !panel.hidden; setBtn.setAttribute('aria-expanded', String(!panel.hidden)); });
    const quit = h('a', { class: 'ag-btn ag-btn--alt', href: '#game' }, t('pause.quit'));
    p.stage.append(h('div', { class: 'ag-overlay ag-pausebox', role: 'dialog', 'aria-label': t('pause.title') }, h('div', { class: 'ag-box' },
      AG.chars.img(p.char, 'wink', 1), h('h3', {}, t('pause.title')),
      h('div', { class: 'ag-actions' }, resume, restart, setBtn, quit), panel)));
    setTimeout(() => resume.focus(), 30);
  }

  /** extra: a game's own switches, [{ key, label: { en, fil } }] (module "settings"). */
  function settingsPanel(extra) {
    const seg = h('div', { class: 'ag-seg', role: 'group', 'aria-label': t('set.touch') });
    ['auto', 'always', 'never'].forEach(v => {
      const b = h('button', { type: 'button', 'aria-pressed': String(AG.store.setting('touchControls') === v) }, t('set.touch.' + v));
      b.addEventListener('click', () => { AG.store.setSetting('touchControls', v); seg.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', String(x === b))); });
      seg.append(b);
    });
    const check = (key, label) => {
      const id = 'ag-set-' + key.replace(/\W/g, '-');
      const inp = h('input', { type: 'checkbox', id, checked: AG.store.setting(key) ? true : null });
      inp.addEventListener('change', () => AG.store.setSetting(key, inp.checked));
      return h('label', { class: 'ag-check', for: id }, inp, h('span', {}, typeof label === 'string' ? t(label) : pick(label)));
    };
    return h('div', { class: 'ag-settings' },
      h('div', { class: 'ag-setup__level' }, h('span', { class: 'ag-label' }, t('set.touch')), seg),
      check('dpad', 'set.dpad'), check('autoBrace', 'set.autoBrace'), check('bigText', 'set.bigText'), check('plainFont', 'set.plainFont'), check('typewriter', 'set.typewriter'),
      ...(extra || []).map(x => check(x.key, x.label)));
  }

  /* ---------- focus mode: fullscreen on the shell, or a class that hides the site chrome ---------- */
  function toggleFocus() {
    const p = play; if (!p) return;
    if (document.fullscreenElement) { document.exitFullscreen().catch(() => {}); return; }
    if (document.documentElement.classList.contains('ag-focus')) { document.documentElement.classList.remove('ag-focus'); setPause(true); syncFocusButton(); return; }
    const fallback = () => { document.documentElement.classList.add('ag-focus'); syncFocusButton(); };
    if (root.requestFullscreen) root.requestFullscreen().then(syncFocusButton, fallback);
    else fallback();
    p.stage.focus({ preventScroll: true });
  }
  function syncFocusButton() {
    const b = root && root.querySelector('.ag-focusbtn'); if (!b) return;
    const on = !!document.fullscreenElement || document.documentElement.classList.contains('ag-focus');
    b.setAttribute('aria-pressed', String(on)); b.setAttribute('aria-label', on ? t('sh.exitFocus') : t('sh.focus')); b.title = b.getAttribute('aria-label');
  }
  function exitFocus() {
    document.documentElement.classList.remove('ag-focus');
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  }

  /** Ends the current game. keepMusic: restarting, not leaving the play screen. */
  function stopPlay(keepMusic) {
    session++;
    const p = play; play = null;
    AG.paused = false;
    clearInterval(debugTimer);
    if (p) {
      p.timers.forEach(id => { clearInterval(id); clearTimeout(id); });
      try { p.cleanup && p.cleanup(); } catch (e) { console.error(e); }
    }
    AG.input.detach();
    if (!keepMusic) { AG.music.disallow(); exitFocus(); }
  }
  function leave() {
    stopPlay(false);
    document.removeEventListener('keydown', resultKeys);
    if (view !== 'overview') view = null;
  }

  /* =========================================================
     results
     ========================================================= */
  function finishPlay(p, res) {
    const { spec } = p;
    stopPlay(true);
    AG.music.stop();
    const stars = AG.util.clamp(res.stars | 0, 0, 3);
    const xp = AG.progress.xpFor(Object.assign({}, res, { stars }));
    const rankBefore = AG.bridge.rank(AG.bridge.getXP());
    const rec = AG.progress.record(game.id, hazard.id, spec.level, Object.assign({}, res, { stars }), spec.mode);
    if (p.diff === 'advanced' && stars >= 3) AG.store.update('stats', s => { s.advanced3 = 1; });
    const badges = AG.progress.checkBadges(game.id, p.mod && p.mod.badges, res.badgeEvents);
    // The site adds the XP and bumps the streak (js/ui/game-host.js).
    AG.emit('kalasag:gameresult', { gameId: game.id, hazardId: hazard.id, level: spec.level, xp, stars, won: !!res.won, mode: spec.mode });
    const rankAfter = AG.bridge.rank(AG.bridge.getXP());
    AG.sfx.play(badges.length || pick(rankAfter.name) !== pick(rankBefore.name) ? 'rank_up' : res.won ? 'win' : 'end');
    lastResult = { p, res, stars, xp, rec, badges, rankUp: pick(rankAfter.name) !== pick(rankBefore.name) ? rankAfter : null };
    renderResult(lastResult);
  }

  function nextOf(spec) {
    if (spec.mode !== 'stage') return null;
    const n = spec.level + 1;
    return AG.progress.levelOpen(game.id, n, unlockAll) ? n : null;
  }

  /** A result detail's optional icon: an AG.icons name or an emoji (AG.pixelIcon), 2×. */
  function detailIcon(name) {
    if (!name) return null;
    if (AG.icons.has(name)) return AG.ui.icon(name, 36, '', 'ag-detailicon');
    return h('img', { class: 'ag-px ag-detailicon', src: AG.pixelIcon(name, 18), width: 36, height: 36, alt: '', draggable: 'false' });
  }

  function renderResult(r) {
    view = 'result';
    const { p, res, stars, xp, rec, badges, rankUp } = r;
    const spec = p.spec, c = AG.chars.get(p.char), mod = p.mod || {};
    const next = res.won ? nextOf(spec) : null;
    const headline = h('h1', { tabindex: '-1' }, res.won ? (stars === 3 ? t('res.perfect') : t('res.wellDone')) : t('res.goodTry'));
    const say = res.won
      ? t('res.sayWin', { msg: res.message || '' }).trim()
      : t('res.sayLose', { msg: res.message || '' }).replace(/\s+/g, ' ');
    const learned = (res.learned && res.learned.length ? res.learned : mod.learn || game.learn || []).slice(0, 4);
    const again = h('button', { class: 'ag-btn ag-btn--big', type: 'button' }, '↻ ' + t('res.again'));
    again.addEventListener('click', () => startPlay(spec));
    const change = h('a', { class: 'ag-btn ag-btn--alt', href: '#game' }, t('res.changeChar'));
    change.addEventListener('click', () => { focusPickerNext = true; });
    const backBtn = h('button', { class: 'ag-btn ag-btn--alt', type: 'button' }, t('res.backLesson'));
    backBtn.addEventListener('click', backToLesson);
    root.replaceChildren(h('div', { class: 'ag-resultwrap' },
      h('section', { class: 'ag-result', 'aria-live': 'polite', 'data-won': String(!!res.won) },
        h('div', { class: 'ag-resultchar', style: { '--role': c.color } }, AG.chars.img(p.char, res.won ? 'cheer' : 'determined', 2)),
        h('div', { class: 'ag-result__copy' },
          h('span', { class: 'ag-eyebrow' }, pick(game.title) + ' · ' + (spec.mode === 'daily' ? t('sh.daily') : t('map.level', { n: spec.level })) + ' · ' + t('lvl.' + p.diff)),
          headline,
          h('div', { class: 'ag-bigstars', role: 'img', 'aria-label': t('map.stars', { n: stars }) }, [0, 1, 2].map(i => AG.ui.icon(i < stars ? 'star' : 'star_empty', 56, '', i < stars ? 'on' : ''))),
          h('div', { class: 'ag-scoreline' },
            h('div', {}, h('b', {}, String(res.score || 0)), h('small', {}, t('res.score'))),
            ...(res.detail || []).map(d => h('div', {}, h('b', {}, detailIcon(d.icon), String(d.value)), h('small', {}, pick(d.label)))),
            h('div', {}, h('b', {}, '+' + xp), h('small', {}, t('res.xp')))),
          h('div', { class: 'ag-chips' },
            rankUp ? h('span', { class: 'ag-chip ag-chip--hi' }, t('res.newRank', { rank: rankUp.name })) : null,
            rec.newBest ? h('span', { class: 'ag-chip ag-chip--hi' }, t('res.newBest')) : null,
            ...badges.map(b => h('span', { class: 'ag-chip ag-chip--hi' }, AG.ui.icon(b.icon, 20), ' ' + t('res.badge', { name: b.name }))),
            ...rec.unlocks.map(u => h('span', { class: 'ag-chip ag-chip--hi' }, t('res.unlock', { name: u.name })))))),
      h('div', { class: 'ag-resultsay' }, AG.dialogue.box({ speaker: p.char, style: res.won ? 'congratulations' : 'encouragement', text: say, typewriter: AG.store.setting('typewriter') !== false && !AG.reducedMotion(), plainFont: AG.store.setting('plainFont') })),
      learned.length ? h('section', { class: 'ag-learned' }, h('h3', {}, t('res.learned')), h('ul', {}, learned.map(l => h('li', {}, AG.ui.icon('check', 20), ' ' + pick(l))))) : null,
      h('p', { class: 'ag-takeaway' }, pick(mod.takeaway || game.takeaway)),
      h('div', { class: 'ag-actions' }, again,
        next ? h('a', { class: 'ag-btn ag-btn--alt', href: AG.router.playHash(next) }, t('res.next') + ' ' + next + ' →') : null,
        change, backBtn)));
    if (res.won && stars > 0) AG.kit.celebrate(root.querySelector('.ag-result'));
    document.removeEventListener('keydown', resultKeys);
    document.addEventListener('keydown', resultKeys);
    headline.focus({ preventScroll: true });
    root.scrollIntoView({ block: 'start' });
  }

  function resultKeys(e) {
    if (view !== 'result' || !lastResult || e.target.closest('input, textarea, dialog')) return;
    if (e.target.closest('a, button') && e.key === 'Enter') return; // a focused button does its own thing
    if (e.key === 'Enter') {
      e.preventDefault();
      const next = lastResult.res.won ? nextOf(lastResult.p.spec) : null;
      if (next) location.hash = AG.router.playHash(next);
      else startPlay(lastResult.p.spec);
    } else if (e.key === 'Escape') { e.preventDefault(); backToLesson(); }
  }
  function backToLesson() {
    document.removeEventListener('keydown', resultKeys);
    // An empty hash is the lesson itself; game-host scrolls to the top.
    if (location.hash) location.hash = ''; else show({ view: 'overview' });
  }

  /* =========================================================
     debug panels (developer tools, English only)
     ========================================================= */
  function startDebugOverlay(spec) {
    const box = h('pre', { class: 'ag-debug', 'aria-hidden': 'true' });
    root.append(box);
    const upd = () => {
      box.textContent = ['fps ' + Math.round(AG.fps || 0), 'route ' + (location.hash || '(none)'), 'device ' + AG.input.lastDevice,
        'actions ' + (AG.input.recent || []).join(' '), 'missing ' + AG.assets.missing().length + (AG.assets.missing().length ? ' (' + AG.assets.missing().slice(0, 3).join(', ') + ')' : ''),
        'seed ' + (play && play.ctx ? play.ctx.seed : '-'), 'character ' + me() + ' · expert ' + expertId(), 'mode ' + spec.mode].join('\n');
    };
    upd(); debugTimer = setInterval(upd, 500);
  }

  function rigPanel() {
    const actions = AG.rig.ACTIONS, ids = AG.CHAR_ORDER;
    const CW = 64, CH = 70, LW = 84;
    const g = AG.gfx.canvas(LW + ids.length * CW, 24 + (actions.length + 1) * CH, 'ag-rigcanvas');
    g.cv.style.maxWidth = 'none';
    const rigs = actions.map(a => ids.map(id => new AG.CharacterRig(null, id, 'side').play(a)));
    const tops = ids.map(id => new AG.CharacterRig(null, id, 'top'));
    const draw = () => {
      const c = g.ctx, tt = performance.now() / 1000;
      c.fillStyle = '#f1effb'; c.fillRect(0, 0, g.W, g.H);
      ids.forEach((id, i) => AG.gfx.text(c, id, LW + i * CW + CW / 2, 6, { align: 'center' }));
      actions.forEach((a, r) => {
        const y = 24 + r * CH;
        c.fillStyle = r % 2 ? '#e4e0f7' : '#ebe8fa'; c.fillRect(0, y, g.W, CH);
        AG.gfx.text(c, a, 4, y + 4);
        rigs[r].forEach((rig, i) => rig.draw(c, LW + i * CW + CW / 2, y + CH - 8, tt));
      });
      const y = 24 + actions.length * CH;
      AG.gfx.text(c, 'top view', 4, y + 4);
      tops.forEach((rig, i) => { rig.play('walk'); rig.setFacing(['down', 'right', 'up', 'left'][Math.floor(tt) % 4]); rig.draw(c, LW + i * CW + CW / 2, y + CH / 2, tt); });
    };
    const stop = AG.gfx.loop(draw);
    const wrap = h('section', { class: 'ag-debugpanel' }, h('h3', {}, 'Debug: rig (every action × every character; AGILA geared)'), h('div', { class: 'ag-debugscroll' }, g.cv));
    const obs = new MutationObserver(() => { if (!wrap.isConnected) { stop(); obs.disconnect(); } });
    obs.observe(root, { childList: true, subtree: true });
    return wrap;
  }

  function assetsPanel() {
    const out = h('pre', {}, 'Checking…');
    const copy = h('button', { type: 'button', class: 'ag-btn ag-btn--alt ag-btn--small' }, 'Copy as Markdown');
    let md = '';
    (async () => {
      const files = await AG.assets.listForGame(realGame ? realGame.id : game.id);
      const own = files.filter(f => f.includes('/assets/games/')); // the art; scripts and levels.json arrive with the game session
      const res = await AG.assets.check(own);
      const fallbacks = ['walk/run: pose_idle + bob (heroes)', 'jump: pose_cheer (heroes)', 'crawl/slide: pose_duck_cover (heroes)', 'gear: icon beside the hero', 'AGILA hold:<prop>: pose_idle_geared + prop icon'];
      md = '### ' + (realGame ? realGame.id : game.id) + '\n\n' + res.map(r => '- ' + (r.ok ? '✅' : '❌') + ' `' + r.path + '`').join('\n') +
        '\n\nCharacter fallbacks:\n' + fallbacks.map(f => '- ' + f).join('\n') + (AG.assets.missing().length ? '\n\nMissing at runtime:\n' + AG.assets.missing().map(m => '- ' + m).join('\n') : '');
      out.textContent = md;
    })();
    copy.addEventListener('click', () => { try { navigator.clipboard.writeText(md); copy.textContent = 'Copied'; } catch (e) { /* select manually */ } });
    return h('section', { class: 'ag-debugpanel' }, h('h3', {}, 'Debug: assets'), copy, h('div', { class: 'ag-debugscroll' }, out));
  }

  AG.host = {
    init, show, leave,
    view: () => view,
    gameId,
    playing: () => view === 'play' || view === 'result',
    expertId
  };
})(window.AG);
