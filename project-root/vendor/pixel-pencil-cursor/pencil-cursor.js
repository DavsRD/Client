/*!
 * Pixel Pencil Cursor
 * A tiny pixel-art pencil that replaces the mouse cursor, with a sparkle on
 * interactive elements and a pixel burst on click. No dependencies.
 *
 * Plain HTML:  <link rel="stylesheet" href="pencil-cursor.css">
 *              <script src="pencil-cursor.js" defer></script>   (auto-starts)
 *              add data-manual to the script tag to start it yourself.
 * JS / React:  window.PixelPencilCursor.init(options) / .destroy()
 */
(function () {
  'use strict';

  if (typeof window === 'undefined') return;
  if (window.PixelPencilCursor) return; // already loaded: never double-register

  // 16x16 sprite, drawn at 2x (32px). Graphite point is at sprite pixel (2,2).
  var PENCIL_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="16" height="16" shape-rendering="crispEdges"><path fill="#FFFFFF" fill-opacity="0.9" d="M2 0h3v1h-3zM1 1h2v1h-2zM4 1h4v1h-4zM0 2h2v1h-2zM7 2h2v1h-2zM0 3h1v1h-1zM8 3h2v1h-2zM0 4h2v1h-2zM9 4h2v1h-2zM1 5h1v1h-1zM10 5h2v1h-2zM1 6h1v1h-1zM11 6h2v1h-2zM1 7h2v1h-2zM12 7h2v1h-2zM2 8h2v1h-2zM13 8h2v1h-2zM3 9h2v1h-2zM14 9h2v1h-2zM4 10h2v1h-2zM15 10h1v1h-1zM5 11h2v1h-2zM14 11h2v1h-2zM6 12h2v1h-2zM14 12h1v1h-1zM7 13h2v1h-2zM13 13h2v1h-2zM8 14h2v1h-2zM11 14h3v1h-3zM9 15h3v1h-3z"/><path fill="#211B2A" d="M3 1h1v1h-1zM2 2h1v1h-1zM4 2h3v1h-3zM1 3h2v1h-2zM7 3h1v1h-1zM2 4h1v1h-1zM8 4h1v1h-1zM2 5h1v1h-1zM9 5h1v1h-1zM2 6h1v1h-1zM10 6h1v1h-1zM3 7h1v1h-1zM11 7h1v1h-1zM4 8h1v1h-1zM12 8h1v1h-1zM5 9h1v1h-1zM13 9h1v1h-1zM6 10h1v1h-1zM14 10h1v1h-1zM7 11h1v1h-1zM13 11h1v1h-1zM8 12h1v1h-1zM13 12h1v1h-1zM9 13h1v1h-1zM11 13h2v1h-2zM10 14h1v1h-1z"/><path fill="#7A7092" d="M3 2h1v1h-1z"/><path fill="#FFE3A3" d="M3 3h4v1h-4zM4 4h3v1h-3zM5 5h2v1h-2zM5 6h1v1h-1z"/><path fill="#E9B96A" d="M3 4h1v1h-1zM3 5h2v1h-2zM3 6h2v1h-2z"/><path fill="#FFF1C7" d="M7 4h1v1h-1zM8 5h1v1h-1zM9 6h1v1h-1zM10 7h1v1h-1z"/><path fill="#FFC928" d="M7 5h1v1h-1zM6 6h3v1h-3zM6 7h4v1h-4zM7 8h3v1h-3zM8 9h1v1h-1z"/><path fill="#F59E0B" d="M4 7h2v1h-2zM5 8h2v1h-2zM6 9h2v1h-2zM7 10h1v1h-1z"/><path fill="#D9DAE6" d="M10 8h1v1h-1zM11 9h1v1h-1z"/><path fill="#7C7E96" d="M11 8h1v1h-1zM10 9h1v1h-1zM8 10h2v1h-2zM8 11h2v1h-2z"/><path fill="#A6A8BB" d="M9 9h1v1h-1zM10 10h1v1h-1z"/><path fill="#F16B91" d="M12 9h1v1h-1zM11 10h3v1h-3zM10 11h3v1h-3zM11 12h2v1h-2z"/><path fill="#C9466E" d="M9 12h2v1h-2zM10 13h1v1h-1z"/></svg>';
  var SCALE = 2;
  var SPRITE_PX = 16;
  var HOTSPOT = { x: 2 * SCALE, y: 2 * SCALE };

  var DEFAULTS = {
    spriteUrl: null,          // optional: path to your own sprite (e.g. assets/pencil-cursor@2x.png)
    size: SPRITE_PX * SCALE,  // displayed size in CSS px
    hotspot: HOTSPOT,         // where the graphite tip sits inside the sprite
    hoverSparkle: true,
    clickBurst: true,
    releaseSparkle: false,
    interactiveSelector: [
      'a[href]', 'button', 'summary', 'select', 'textarea', 'label[for]',
      'input:not([type="hidden"])', '[role="button"]', '[role="link"]', '[role="tab"]',
      '[role="menuitem"]', '[role="option"]', '[role="checkbox"]', '[role="radio"]',
      '[role="switch"]', '[onclick]', '[tabindex]:not([tabindex="-1"])',
      '[contenteditable="true"]', '[data-cursor="interactive"]', '.clickable'
    ].join(','),
    maxEffects: 24
  };

  var BURST_COLORS = ['#F59E0B', '#FFC928', '#F59E0B', '#FFE45C', '#F59E0B', '#FFC928'];
  var BURST_DIRS = [[0, -1], [0.87, -0.5], [0.87, 0.5], [0, 1], [-0.87, 0.5], [-0.87, -0.5]];

  var state = null;

  function svgUrl(svg) {
    return 'url("data:image/svg+xml,' + encodeURIComponent(svg) + '")';
  }

  function init(userOptions) {
    if (state) return api;
    var opts = {};
    for (var k in DEFAULTS) opts[k] = DEFAULTS[k];
    for (var u in userOptions || {}) opts[u] = userOptions[u];

    var root = document.documentElement;
    var reduceMq = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;

    var layer = document.createElement('div');
    layer.className = 'ppc-layer';
    layer.setAttribute('aria-hidden', 'true');

    var cursor = document.createElement('div');
    cursor.className = 'ppc-cursor';
    cursor.style.width = opts.size + 'px';
    cursor.style.height = opts.size + 'px';
    cursor.style.marginLeft = -opts.hotspot.x + 'px';
    cursor.style.marginTop = -opts.hotspot.y + 'px';

    var sprite = document.createElement('div');
    sprite.className = 'ppc-sprite';
    cursor.appendChild(sprite);
    layer.appendChild(cursor);

    state = {
      opts: opts,
      layer: layer,
      cursor: cursor,
      sprite: sprite,
      ready: false,        // sprite loaded
      active: false,       // custom cursor currently replacing the native one
      x: -100, y: -100,
      hoverEl: null,
      lastSparkle: 0,
      pressPoint: null,
      effects: [],
      reduceMq: reduceMq,
      reduced: !!(reduceMq && reduceMq.matches),
      listeners: []
    };

    function on(target, type, fn, o) {
      target.addEventListener(type, fn, o);
      state.listeners.push([target, type, fn, o]);
    }

    // Load the sprite before ever hiding the native cursor (fallback if it fails).
    var src = opts.spriteUrl ? 'url("' + opts.spriteUrl + '")' : svgUrl(PENCIL_SVG);
    var probe = new Image();
    probe.onload = function () {
      if (!state) return;
      sprite.style.backgroundImage = src;
      state.ready = true;
    };
    probe.onerror = function () { /* keep native cursor */ };
    probe.src = opts.spriteUrl || ('data:image/svg+xml,' + encodeURIComponent(PENCIL_SVG));

    if (state.reduced) root.classList.add('ppc-reduced');

    function ensureLayer() {
      if (!layer.isConnected && document.body) document.body.appendChild(layer);
    }

    function activate() {
      if (state.active || !state.ready) return;
      ensureLayer();
      state.active = true;
      root.classList.add('ppc-active');
    }

    function deactivate() {
      if (!state.active) return;
      state.active = false;
      root.classList.remove('ppc-active', 'ppc-pressed');
      cursor.classList.remove('ppc-visible');
      state.hoverEl = null;
    }

    function move(x, y) {
      state.x = x; state.y = y;
      cursor.style.transform = 'translate3d(' + x + 'px,' + y + 'px,0)';
    }

    function isPointerish(e) {
      return e.pointerType === 'mouse' || e.pointerType === undefined || e.pointerType === '';
    }

    function onPointerMove(e) {
      if (!isPointerish(e)) return;
      activate();
      if (!state.active) return;
      ensureLayer();
      move(e.clientX, e.clientY);
      cursor.classList.add('ppc-visible');
    }

    function interactiveFrom(el) {
      if (!el || !el.closest) return null;
      var hit = el.closest(opts.interactiveSelector);
      if (!hit) return null;
      if (hit.closest('[disabled],[aria-disabled="true"]')) return null;
      return hit;
    }

    function onPointerOver(e) {
      if (!state.active || !isPointerish(e)) return;
      var hit = interactiveFrom(e.target);
      if (hit === state.hoverEl) return;
      state.hoverEl = hit;
      cursor.classList.toggle('ppc-hover', !!hit);
      if (hit && opts.hoverSparkle && !state.reduced) {
        var now = performance.now();
        if (now - state.lastSparkle > 150) {
          state.lastSparkle = now;
          // just up-left of the graphite tip
          spawnSparkle(e.clientX - 7, e.clientY - 7, 'ppc-sparkle');
        }
      }
    }

    function onPointerDown(e) {
      if (!isPointerish(e)) {
        deactivate(); // touch / pen: hand back to the native pointer
        return;
      }
      if (e.button !== 0) return;
      activate();
      if (!state.active) return;
      move(e.clientX, e.clientY);
      cursor.classList.add('ppc-visible');
      root.classList.add('ppc-pressed');
      state.pressPoint = { x: e.clientX, y: e.clientY };
      if (opts.clickBurst) spawnBurst(e.clientX, e.clientY);
    }

    function onPointerUp(e) {
      if (e.button !== 0 && e.type !== 'blur') return;
      root.classList.remove('ppc-pressed');
      if (opts.releaseSparkle && state.pressPoint && !state.reduced && state.active) {
        spawnSparkle(state.pressPoint.x, state.pressPoint.y, 'ppc-sparkle ppc-sparkle-small');
      }
      state.pressPoint = null;
    }

    function onLeave(e) {
      if (!e.relatedTarget) cursor.classList.remove('ppc-visible');
    }

    function onDragOver(e) {
      if (state.active) move(e.clientX, e.clientY);
    }

    function onBlur() {
      root.classList.remove('ppc-pressed');
      cursor.classList.remove('ppc-visible');
    }

    function onReduceChange(e) {
      state.reduced = e.matches;
      root.classList.toggle('ppc-reduced', e.matches);
    }

    function track(node, ms) {
      layer.appendChild(node);
      state.effects.push(node);
      while (state.effects.length > opts.maxEffects) {
        var old = state.effects.shift();
        if (old.parentNode) old.parentNode.removeChild(old);
      }
      var done = function () {
        if (node.parentNode) node.parentNode.removeChild(node);
        var i = state ? state.effects.indexOf(node) : -1;
        if (i > -1) state.effects.splice(i, 1);
      };
      node.addEventListener('animationend', function (ev) {
        if (ev.target === node) done();
      });
      setTimeout(done, ms + 100); // safety net if animations are disabled
    }

    function spawnSparkle(x, y, cls) {
      ensureLayer();
      var s = document.createElement('div');
      s.className = cls;
      s.style.transform = 'translate3d(' + Math.round(x) + 'px,' + Math.round(y) + 'px,0)';
      track(s, 360);
    }

    function spawnBurst(x, y) {
      ensureLayer();
      var b = document.createElement('div');
      b.className = 'ppc-burst';
      b.style.transform = 'translate3d(' + Math.round(x) + 'px,' + Math.round(y) + 'px,0)';
      if (!state.reduced) {
        for (var i = 0; i < BURST_DIRS.length; i++) {
          var p = document.createElement('i');
          var dist = i % 2 ? 12 : 14;
          // snap travel to the 2px pixel grid
          p.style.setProperty('--dx', Math.round(BURST_DIRS[i][0] * dist / 2) * 2 + 'px');
          p.style.setProperty('--dy', Math.round(BURST_DIRS[i][1] * dist / 2) * 2 + 'px');
          p.style.background = BURST_COLORS[i];
          b.appendChild(p);
        }
      }
      track(b, 320);
    }

    on(document, 'pointermove', onPointerMove, { passive: true });
    on(document, 'pointerover', onPointerOver, { passive: true });
    on(document, 'pointerdown', onPointerDown, { passive: true, capture: true });
    on(document, 'pointerup', onPointerUp, { passive: true, capture: true });
    on(document, 'pointercancel', onPointerUp, { passive: true, capture: true });
    on(document, 'pointerout', onLeave, { passive: true });
    on(document, 'dragover', onDragOver, { passive: true });
    on(window, 'blur', onBlur);
    if (reduceMq) {
      if (reduceMq.addEventListener) on(reduceMq, 'change', onReduceChange);
      else if (reduceMq.addListener) reduceMq.addListener(onReduceChange);
    }

    state.deactivate = deactivate;
    return api;
  }

  function destroy() {
    if (!state) return;
    state.listeners.forEach(function (l) { l[0].removeEventListener(l[1], l[2], l[3]); });
    if (state.layer.parentNode) state.layer.parentNode.removeChild(state.layer);
    document.documentElement.classList.remove('ppc-active', 'ppc-pressed', 'ppc-reduced');
    state = null;
  }

  var api = {
    init: init,
    destroy: destroy,
    isActive: function () { return !!(state && state.active); }
  };
  window.PixelPencilCursor = api;

  // Auto-start when included as a plain <script> (skip with data-manual).
  var script = document.currentScript;
  if (script && !script.hasAttribute('data-manual')) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function () { init(); }, { once: true });
    } else {
      init();
    }
  }
})();
