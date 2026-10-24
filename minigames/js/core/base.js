/* AGILA Safety Games inside Kalasag Kids — the shared namespace.
 * Loaded first by js/ui/game-host.js (the site's only bridge to these classic scripts).
 *
 *   AG.lang()            'en' | 'fil', from <html lang> (the site sets it)
 *   AG.t(key, vars)      shell string from js/data/strings.js, {name} placeholders filled
 *   AG.pick({ en, fil }) the current-language text; English when the Filipino is missing
 *   AG.data.load(gameId, 'levels.json')     JSON next to a game's scripts (cached)
 *   AG.data.asset(gameId, 'data/rooms.json') JSON shipped in the game's asset folder
 *   AG.util              element builder, shuffle, clamp, seeded random
 *   AG.debug             ?debug=1 | assets | rig (comma-separated)
 * Paths are relative to the page (every site page lives at the site root). */
window.AG = window.AG || {};
(function (AG) {
  AG.ROOT = 'minigames/';
  AG.path = p => AG.ROOT + p;

  /* ---------- language ---------- */
  AG.lang = () => (document.documentElement.lang === 'fil' ? 'fil' : 'en');
  AG.pick = v => {
    if (v == null) return '';
    if (typeof v === 'string' || typeof v === 'number') return String(v);
    return v[AG.lang()] || v.en || '';
  };
  AG.t = (key, vars) => {
    const entry = AG.STRINGS && AG.STRINGS[key];
    let text = entry ? AG.pick(entry) : key;
    if (vars) text = text.replace(/\{(\w+)\}/g, (_, name) => (vars[name] != null ? AG.pick(vars[name]) : ''));
    return text;
  };

  /* ---------- events ---------- */
  AG.emit = (name, detail) => window.dispatchEvent(new CustomEvent(name, { detail }));
  AG.on = (name, fn) => { window.addEventListener(name, fn); return () => window.removeEventListener(name, fn); };
  const warned = new Set();
  AG.warnOnce = (key, ...msg) => { if (!warned.has(key)) { warned.add(key); console.warn('[AG]', ...msg); } };

  /* ---------- debug flags ---------- */
  const q = new URLSearchParams(location.search);
  const flags = new Set((q.get('debug') || '').split(',').filter(Boolean));
  AG.debug = { on: flags.size > 0, rig: flags.has('rig'), assets: flags.has('assets'), overlay: flags.has('1') };

  AG.reducedMotion = () => !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);

  /* ---------- small utilities (the prototype's AG.util) ---------- */
  function h(tag, props, ...kids) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(props || {})) {
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
      else if (k === 'html') el.innerHTML = v;
      else el.setAttribute(k, v === true ? '' : v);
    }
    for (const kid of kids.flat()) if (kid != null && kid !== false) el.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
    return el;
  }
  const shuffle = (a, rnd) => { a = a.slice(); const r = rnd || Math.random; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  /** Seeded random numbers in [0, 1): the same seed gives the same sequence on every device. */
  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  /** 2026-10-23 → 20261023, from the local calendar date (the pupil's own day). */
  const seedFromDate = (d = new Date()) => d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();

  AG.util = {
    h, shuffle, mulberry32, seedFromDate,
    clamp: (v, a, b) => Math.max(a, Math.min(b, v)),
    rand: (a, b) => a + Math.random() * (b - a),
    pick: a => a[Math.floor(Math.random() * a.length)]
  };

  /* ---------- JSON data, fetched at runtime ---------- */
  const cache = new Map();
  function json(url) {
    if (!cache.has(url)) {
      const req = fetch(url).then(r => { if (!r.ok) throw new Error(url + ': ' + r.status); return r.json(); });
      req.catch(() => cache.delete(url)); // a later call may retry
      cache.set(url, req);
    }
    return cache.get(url);
  }
  AG.data = {
    json,
    load: (gameId, file) => json(AG.path('js/games/' + gameId + '/' + file)),
    asset: (gameId, file) => json(AG.path('assets/games/' + gameId + '/' + file))
  };

  /* ---------- the site side, filled in by js/ui/game-host.js ---------- */
  AG.bridge = AG.bridge || {
    getXP: () => 0,
    rank: () => ({ name: { en: 'Cadet', fil: 'Kadete' }, pct: 0, next: null }),
    saveFiles: null, isSaved: null, offlineSupported: false
  };
})(window.AG);
