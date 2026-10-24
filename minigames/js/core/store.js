/* Game progress, saved on this device only under one key, "kalasag:games" (KALASAG O6).
 * Every read and write is guarded: private windows or blocked storage fall back to memory
 * so the games still work. XP, the streak, sound, language and theme belong to the site
 * (js/core/state.js) and are never stored here. The site's "Reset my progress" removes
 * this key; AG then drops its in-memory copy when the site announces the reset. */
window.AG = window.AG || {};
(function (AG) {
  const KEY = 'kalasag:games';
  const DEFAULTS = () => ({
    v: 1,
    character: 'agila',
    difficulty: 'easy',
    levels: {},      // '<gameId>:<w>-<l>' → { stars, best, plays, last, collectibles }
    daily: {},       // 'YYYY-MM-DD:<gameId>' → { best }
    badges: {},      // id → timestamp
    tutorials: {},   // gameId → 1 once the tutorial was shown
    intros: {},      // '<gameId>:<w>' → 1 once the world's intro talk was shown
    stats: { safeChoices: 0, games: 0, used: {}, advanced3: 0 },
    settings: { touchControls: 'auto', dpad: true, autoBrace: false, bigText: false, plainFont: false, typewriter: true },
    last: null,      // { gameId, hazardId, world, level }: the last level played anywhere
    lastByGame: {},  // gameId → { world, level }: drives "Continue 2-3" on each overview
    unlocks: []
  });
  let mem = null;

  function load() {
    if (mem) return mem;
    let saved = null;
    try { saved = JSON.parse(localStorage.getItem(KEY)); } catch (e) { saved = null; }
    const d = DEFAULTS();
    mem = Object.assign(d, saved || {});
    // nested defaults survive older saves
    mem.stats = Object.assign(DEFAULTS().stats, mem.stats || {});
    mem.settings = Object.assign(DEFAULTS().settings, mem.settings || {});
    return mem;
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(mem)); } catch (e) { /* memory only */ } }

  AG.store = {
    KEY,
    get(k) { return load()[k]; },
    set(k, v) { load()[k] = v; save(); },
    /** Change a nested object in place: AG.store.update('stats', s => { s.games++; }). */
    update(k, fn) { const s = load(); fn(s[k]); save(); return s[k]; },
    setting(k) { return load().settings[k]; },
    setSetting(k, v) { load().settings[k] = v; save(); AG.emit('ag:settings', { key: k, value: v }); },
    all: () => load(),
    /** Forget the in-memory copy (the site reset progress, or another tab wrote it). */
    reload() { mem = null; }
  };

  // The site's "Reset my progress" fires kalasag:statechange with key "*".
  window.addEventListener('kalasag:statechange', e => { if (e.detail && e.detail.key === '*') mem = null; });
  window.addEventListener('storage', e => { if (e.key === KEY || e.key === null) mem = null; });
})(window.AG);
