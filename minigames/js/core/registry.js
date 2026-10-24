/* The 19 games: metadata and the scripts to lazy-load, from js/data/registry.json (the same
 * file the site's pages read through js/core/games.js, so there is one list).
 *
 *   await AG.registry.ready()
 *   AG.registry.get('fire-escape')        → entry ({ id, hazardId, title, built, scripts, … })
 *   AG.registry.forHazard('fire')         → the hazard's entry
 *   AG.registry.load('fire-escape')       → injects the engine's and the game's scripts once,
 *                                            resolves with AG.games['fire-escape']
 *   AG.registry.daily()                   → the 4 daily game ids
 *
 * A game session sets "built": true and lists its scripts in registry.json; an engine
 * session adds its scripts under "engines". The sandbox test game (_sandbox) is added only
 * in debug mode and never appears in any list pupils see. */
window.AG = window.AG || {};
(function (AG) {
  AG.games = AG.games || {};
  let reg = null, readyPromise = null;
  const loaded = new Map(); // script src → Promise

  const SANDBOX = {
    id: '_sandbox', num: 0, hazardGroup: 'geological', engine: null, skill: 'reflex', hostRole: 'rescue', view: 'side', hearts: false, daily: false, built: true, sandbox: true,
    title: { en: 'Tap the Stars', fil: 'Pindutin ang mga Bituin' },
    genre: { en: 'Test game (debug only)', fil: 'Pansubok na laro (debug lang)' },
    objective: { en: 'Collect every star before the time runs out. This tiny game tests the shell: input, prompts, the rig, placeholders, results and XP.', fil: 'Kunin ang lahat ng bituin bago maubos ang oras. Sinusubok ng maliit na larong ito ang shell.' },
    howTo: [
      { en: 'Move the cursor to a star', fil: 'Ilipat ang cursor sa bituin', keys: ['key_left', 'key_right', 'key_up', 'key_down'], gesture: 'gesture_tap' },
      { en: 'Grab it', fil: 'Kunin ito', keys: ['key_enter', 'key_space'], gesture: 'gesture_tap' }
    ],
    takeaway: { en: 'Every safe choice counts, one star at a time.', fil: 'Mahalaga ang bawat ligtas na pasya, isang bituin sa bawat pagkakataon.' },
    scripts: [AG.path('js/games/_sandbox/index.js')], data: []
  };

  function loadScript(src) {
    if (!loaded.has(src)) {
      loaded.set(src, new Promise((res, rej) => {
        const s = document.createElement('script');
        s.src = src; s.async = false;
        s.onload = res; s.onerror = () => { loaded.delete(src); rej(new Error('Could not load ' + src)); };
        document.head.append(s);
      }));
    }
    return loaded.get(src);
  }

  AG.registry = {
    ready() {
      if (!readyPromise) readyPromise = AG.data.json(AG.path('js/data/registry.json')).then(r => { reg = r; return r; });
      return readyPromise;
    },
    list: () => (reg ? reg.games : []),
    get(id) {
      if (id === '_sandbox') return AG.debug.on ? SANDBOX : null;
      return reg ? reg.games.find(g => g.id === id) || null : null;
    },
    forHazard: hazardId => (reg ? reg.games.find(g => g.hazardId === hazardId) || null : null),
    daily: () => (reg ? reg.daily.slice() : []),
    engineScripts: engine => (reg && engine && reg.engines[engine]) || [],
    sandbox: hazardId => Object.assign({}, SANDBOX, { hazardId }),
    /** Loads a game's engine and own scripts (in order, once each) and returns its module. */
    async load(id) {
      await AG.registry.ready();
      const g = AG.registry.get(id);
      if (!g) throw new Error('Unknown game ' + id);
      for (const src of AG.registry.engineScripts(g.engine).concat(g.scripts || [])) await loadScript(src);
      const mod = AG.games[id];
      if (!mod) throw new Error('The game ' + id + ' did not register itself in AG.games');
      return mod;
    },
    loadScript
  };
})(window.AG);
