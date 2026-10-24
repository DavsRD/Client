/* One input layer for every game: games listen for ACTIONS, never raw keys or touches.
 *
 *   AG.input.on('CONFIRM', ({ phase, device }) => …)   phase: 'down' | 'up' | 'repeat'
 *   AG.input.isDown('LEFT')
 *   AG.input.repeat('LEFT', { delay: 180, interval: 90 })  held keys/buttons repeat
 *   AG.input.register('BRACE', { keys: ['KeyB'], button: { en: 'Brace', fil: 'Kapit' } })
 *   AG.input.disableWasd()                      (typing games: letters are letters)
 *   AG.input.pointerMode('tap' | 'swipe' | 'drag' | 'follow')
 *   AG.input.onPointer('tap', ({ x, y, device }) => …)   x, y in stage-logical px
 *        types: down, move, up, tap, hold, holdend, dragstart, drag, dragend, swipe ({ dir })
 *   AG.input.setView(AG.gfx.canvas(480, 270))   pointer coordinates in canvas pixels
 *   AG.input.lastDevice                          'keyboard' | 'touch' | 'mouse' (+ 'ag:device' event)
 *   AG.input.touchControls(container, { dpad, buttons: [{ action, label, hold }] })
 *   new AG.input.FocusZones([{ el, name }])      Tab cycles zones, arrows move inside
 *   AG.input.promptIcon({ keys: ['key_space'], gesture: 'gesture_hold' })  switches live
 *
 * Keys are captured only while the game stage has focus, so the page scrolls normally
 * elsewhere; arrows and Space are kept from scrolling only inside the stage. Gesture
 * thresholds are in CSS px (tap < 10 px and < 250 ms, hold ≥ 250 ms, swipe ≥ 30 px within
 * 300 ms). Timing windows are the same on every device. The shell owns PAUSE (Esc / P);
 * Esc means CANCEL instead while a game has armed it (inside a pick or hold state). */
window.AG = window.AG || {};
(function (AG) {
  const { h } = AG.util;
  const BASE = {
    UP: ['ArrowUp', 'KeyW'], DOWN: ['ArrowDown', 'KeyS'], LEFT: ['ArrowLeft', 'KeyA'], RIGHT: ['ArrowRight', 'KeyD'],
    CONFIRM: ['Enter', 'NumpadEnter', 'Space'], CANCEL: [], ROTATE: ['KeyR'], HINT: ['KeyH'], UNDO: ['Backspace'],
    PAUSE: ['Escape', 'KeyP'], NEXT_ZONE: ['Tab'], FINE: ['ShiftLeft', 'ShiftRight']
  };
  for (let i = 1; i <= 9; i++) BASE['CHOICE_' + i] = ['Digit' + i, 'Numpad' + i];
  const WASD = ['KeyW', 'KeyA', 'KeyS', 'KeyD'];
  const NO_SCROLL = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space']);
  const ACTION_OF_DIR = { up: 'UP', down: 'DOWN', left: 'LEFT', right: 'RIGHT' };

  let keys = {}, handlers = new Map(), shellHandlers = new Map(), pointerHandlers = new Map();
  const downActions = new Set(), repeats = new Map(), repeatTimers = new Map();
  let stage = null, view = null, mode = 'tap', cancelArmed = false, buttons = {};

  function resetKeys() { keys = {}; for (const a in BASE) keys[a] = BASE[a].slice(); }
  resetKeys();

  /* ---------- device tracking (always on) ---------- */
  const coarse = window.matchMedia && matchMedia('(hover: none) and (pointer: coarse)').matches;
  let lastDevice = coarse ? 'touch' : 'mouse';
  function setDevice(d) { if (d !== lastDevice) { lastDevice = d; AG.emit('ag:device', { device: d }); } }
  window.addEventListener('keydown', e => { if (!['Shift', 'Control', 'Alt', 'Meta'].includes(e.key)) setDevice('keyboard'); }, true);
  window.addEventListener('pointerdown', e => setDevice(e.pointerType === 'mouse' ? 'mouse' : 'touch'), true);

  /* ---------- dispatch ---------- */
  function fire(map, action, info) {
    const set = map.get(action); if (!set) return false;
    set.forEach(fn => { try { fn(info); } catch (err) { console.error(err); } });
    return set.size > 0;
  }
  function emit(action, phase, device, event) {
    const info = { action, phase, device: device || lastDevice, event };
    const shellTook = fire(shellHandlers, action, info);
    if (!AG.paused || action === 'PAUSE') fire(handlers, action, info);
    if (AG.debug.overlay) AG.input.recent = [action + ':' + phase].concat(AG.input.recent).slice(0, 6);
    return shellTook;
  }
  function press(action, device, event) {
    if (downActions.has(action)) return;
    downActions.add(action); emit(action, 'down', device, event);
    const r = repeats.get(action);
    if (r) {
      const t = setTimeout(function again() {
        if (!downActions.has(action)) return;
        emit(action, 'repeat', device);
        repeatTimers.set(action, setTimeout(again, r.interval));
      }, r.delay);
      repeatTimers.set(action, t);
    }
  }
  function release(action, device, event) {
    if (!downActions.has(action)) return;
    downActions.delete(action); clearTimeout(repeatTimers.get(action)); repeatTimers.delete(action);
    emit(action, 'up', device, event);
  }
  function releaseAll() { [...downActions].forEach(a => release(a)); }

  const inStage = () => stage && (document.activeElement === stage || stage.contains(document.activeElement));
  const inShell = () => stage && stage.closest('.ag-shell') && stage.closest('.ag-shell').contains(document.activeElement);
  const actionsFor = code => Object.keys(keys).filter(a => keys[a].includes(code));
  const typing = el => el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);

  function onKeyDown(e) {
    if (!stage || typing(e.target)) return;
    let acts = actionsFor(e.code);
    if (e.code === 'Escape' && cancelArmed) acts = ['CANCEL'];
    if (!acts.length) return;
    const pauseKey = acts.includes('PAUSE');
    // PAUSE works anywhere in the shell (or the page body while playing); everything else needs the stage
    if (!inStage() && !(pauseKey && (inShell() || document.activeElement === document.body))) return;
    if (inStage()) {
      if (NO_SCROLL.has(e.code)) e.preventDefault();
      if (e.code === 'Tab' && handlers.get('NEXT_ZONE') && handlers.get('NEXT_ZONE').size) e.preventDefault();
      if (e.code === 'Backspace' && handlers.get('UNDO') && handlers.get('UNDO').size) e.preventDefault();
    }
    if (pauseKey) e.preventDefault();
    if (e.repeat) return; // repeats are timed by repeat() so every device feels the same
    acts.forEach(a => press(a, 'keyboard', e));
    if (e.code === 'Escape' && cancelArmed) release('CANCEL', 'keyboard', e);
  }
  function onKeyUp(e) { actionsFor(e.code).forEach(a => release(a, 'keyboard', e)); }

  /* ---------- pointer gestures on the stage ---------- */
  let ptr = null;
  function local(e) {
    if (view && view.toLocal) { const p = view.toLocal(e); return { x: p.x, y: p.y }; }
    const r = stage.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top };
  }
  function pointerInfo(e, extra) { const p = local(e); return Object.assign({ x: p.x, y: p.y, clientX: e.clientX, clientY: e.clientY, device: e.pointerType === 'mouse' ? 'mouse' : 'touch', event: e }, extra); }
  function firePtr(type, info) { if (AG.paused) return; const set = pointerHandlers.get(type); if (set) set.forEach(fn => { try { fn(info); } catch (err) { console.error(err); } }); }
  function onPointerDown(e) {
    if (e.target.closest('button, a, input, select, textarea, .ag-pad')) return; // UI controls inside the stage handle themselves
    if (e.button > 0) return;
    stage.focus({ preventScroll: true });
    ptr = { id: e.pointerId, x: e.clientX, y: e.clientY, t: performance.now(), dragging: false, held: false };
    ptr.holdTimer = setTimeout(() => { if (ptr && !ptr.dragging) { ptr.held = true; firePtr('hold', pointerInfo(e)); } }, 250);
    firePtr('down', pointerInfo(e));
  }
  function onPointerMove(e) {
    if (!stage) return;
    if (!ptr || e.pointerId !== ptr.id) { if (mode === 'follow' && e.pointerType === 'mouse' && stage.contains(e.target)) firePtr('move', pointerInfo(e)); return; }
    const dx = e.clientX - ptr.x, dy = e.clientY - ptr.y;
    if (!ptr.dragging && Math.hypot(dx, dy) >= 10) { ptr.dragging = true; clearTimeout(ptr.holdTimer); firePtr('dragstart', pointerInfo(e, { dx, dy })); }
    if (ptr.dragging) { if (mode !== 'tap') e.preventDefault(); firePtr('drag', pointerInfo(e, { dx, dy })); }
    firePtr('move', pointerInfo(e, { dx, dy }));
  }
  function onPointerUp(e) {
    if (!ptr || e.pointerId !== ptr.id) return;
    const p = ptr; ptr = null; clearTimeout(p.holdTimer);
    const dx = e.clientX - p.x, dy = e.clientY - p.y, dist = Math.hypot(dx, dy), dt = performance.now() - p.t;
    if (p.dragging) {
      if (dist >= 30 && dt <= 300) {
        const dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
        firePtr('swipe', pointerInfo(e, { dir, dx, dy }));
        if (mode === 'swipe') { press(ACTION_OF_DIR[dir], 'touch'); release(ACTION_OF_DIR[dir], 'touch'); }
      }
      firePtr('dragend', pointerInfo(e, { dx, dy }));
    } else if (p.held) firePtr('holdend', pointerInfo(e));
    else if (dt < 250 && dist < 10) firePtr('tap', pointerInfo(e));
    firePtr('up', pointerInfo(e));
  }
  function onPointerCancel(e) { if (ptr && e.pointerId === ptr.id) { clearTimeout(ptr.holdTimer); if (ptr.held) firePtr('holdend', pointerInfo(e)); ptr = null; } }

  function attach(el) {
    detach();
    stage = el; stage.tabIndex = 0;
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    stage.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove, { passive: false });
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerCancel);
    window.addEventListener('blur', releaseAll);
  }
  /** Ends a game session: every game handler, repeat, custom key and setting is dropped. */
  function detach() {
    releaseAll();
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
    if (stage) stage.removeEventListener('pointerdown', onPointerDown);
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', onPointerUp);
    window.removeEventListener('pointercancel', onPointerCancel);
    window.removeEventListener('blur', releaseAll);
    handlers = new Map(); pointerHandlers = new Map(); repeats.clear(); buttons = {};
    resetKeys(); view = null; mode = 'tap'; cancelArmed = false; stage = null; ptr = null;
  }

  function on(action, fn) { if (!handlers.has(action)) handlers.set(action, new Set()); handlers.get(action).add(fn); return () => handlers.get(action).delete(fn); }
  function onShell(action, fn) { if (!shellHandlers.has(action)) shellHandlers.set(action, new Set()); shellHandlers.get(action).add(fn); return () => shellHandlers.get(action).delete(fn); }
  function onPointer(type, fn) { if (!pointerHandlers.has(type)) pointerHandlers.set(type, new Set()); pointerHandlers.get(type).add(fn); return () => pointerHandlers.get(type).delete(fn); }

  /* ---------- on-screen touch controls ---------- */
  function padButton(action, label, cls) {
    const b = h('button', { type: 'button', class: 'ag-btn ag-padbtn ' + (cls || ''), 'data-action': action, 'aria-label': AG.pick(label) }, AG.pick(label));
    const down = e => { e.preventDefault(); b.setPointerCapture && b.setPointerCapture(e.pointerId); b.classList.add('held'); press(action, 'touch', e); };
    const up = e => { b.classList.remove('held'); release(action, 'touch', e); };
    b.addEventListener('pointerdown', down);
    b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up); b.addEventListener('lostpointercapture', up);
    b.addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && !e.repeat) { e.preventDefault(); press(action, 'keyboard', e); } });
    b.addEventListener('keyup', e => { if (e.key === 'Enter' || e.key === ' ') release(action, 'keyboard', e); });
    return b;
  }
  /** D-pad (≥ 48 CSS px) + action buttons in the thumb zones, shown for touch players
   *  (or always / never, from the pause menu's Touch controls setting). */
  function touchControls(container, opts) {
    opts = opts || {};
    const pad = h('div', { class: 'ag-pad', 'aria-label': 'Touch controls' });
    let dpad = null;
    if (opts.dpad) {
      dpad = h('div', { class: 'ag-dpad' },
        padButton('UP', '▲', 'up'), padButton('LEFT', '◀', 'left'), padButton('DOWN', '▼', 'down'), padButton('RIGHT', '▶', 'right'));
      pad.append(dpad);
    }
    const acts = h('div', { class: 'ag-padacts' }, (opts.buttons || []).map(bt => padButton(bt.action, bt.label || buttons[bt.action] || bt.action, bt.cls)));
    pad.append(acts);
    container.append(pad);
    const sync = () => {
      const setting = AG.store.setting('touchControls');
      const show = setting === 'always' || (setting === 'auto' && lastDevice === 'touch');
      pad.hidden = !show;
      if (dpad) dpad.hidden = !AG.store.setting('dpad');
    };
    sync();
    const offs = [AG.on('ag:device', sync), AG.on('ag:settings', sync)];
    return { el: pad, sync, destroy() { offs.forEach(f => f()); pad.remove(); } };
  }

  /* ---------- FocusZones: Tab cycles named areas, arrows work inside the active one ---------- */
  class FocusZones {
    constructor(zones) {
      this.zones = zones; this.i = 0;
      this.off = on('NEXT_ZONE', e => { if (e.phase === 'down') this.next(e.event && e.event.shiftKey ? -1 : 1); });
      this.apply();
    }
    next(step) { this.i = (this.i + (step || 1) + this.zones.length) % this.zones.length; this.apply(); }
    set(name) { const i = this.zones.findIndex(z => z.name === name); if (i >= 0) { this.i = i; this.apply(); } }
    get current() { return this.zones[this.i]; }
    apply() { this.zones.forEach((z, j) => z.el.classList.toggle('ag-zone-active', j === this.i)); const z = this.zones[this.i]; if (z && z.onEnter) z.onEnter(); }
    destroy() { this.off(); this.zones.forEach(z => z.el.classList.remove('ag-zone-active')); }
  }

  /* ---------- PromptIcon: keycaps for keyboard and mouse players, gestures for touch ---------- */
  const promptSrc = name => AG.path('assets/shared/prompts/' + name + '.png');
  function promptIcon(spec) {
    const el = h('span', { class: 'ag-prompt' });
    const render = () => {
      const touch = lastDevice === 'touch';
      const names = touch ? (spec.gesture ? [spec.gesture] : []) : (spec.keys || []);
      el.replaceChildren(...names.map((n, i) => {
        const img = h('img', { class: 'ag-px', src: promptSrc(n), alt: n.replace(/^(key|gesture)_/, '').replace(/_/g, ' '), width: 36, height: 36, draggable: 'false' });
        return i && !touch && spec.joiner ? [h('span', { class: 'ag-prompt__or' }, spec.joiner), img] : img;
      }).flat());
      el.hidden = !names.length;
      el.dataset.device = touch ? 'touch' : 'keys';
    };
    render();
    const off = AG.on('ag:device', render);
    el._destroy = off; // removed with the element; the listener is cheap if left behind
    return el;
  }

  AG.input = {
    attach, detach, on, onShell, onPointer, touchControls, promptIcon, FocusZones,
    isDown: a => downActions.has(a),
    repeat(action, o) { repeats.set(action, { delay: (o && o.delay) || 180, interval: (o && o.interval) || 90 }); },
    register(name, o) { keys[name] = (o && o.keys) || []; if (o && o.button) buttons[name] = o.button; },
    disableWasd() { ['UP', 'DOWN', 'LEFT', 'RIGHT'].forEach(a => { keys[a] = keys[a].filter(k => !WASD.includes(k)); }); },
    pointerMode(m) { mode = m; if (stage) stage.style.touchAction = m === 'tap' ? 'manipulation' : 'none'; },
    setView(v) { view = v; },
    armCancel(on) { cancelArmed = !!on; },
    press, release, releaseAll,
    get lastDevice() { return lastDevice; },
    recent: []
  };
})(window.AG);
