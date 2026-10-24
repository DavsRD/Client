/* Sound effects and music from the starter MP3s (minigames/assets/…), played through
 * Web Audio so music loops without a gap. The prototype's names still work
 * (AG.sfx.play('good'), 'soft', 'alarm', 'blip', 'tap', 'win', 'end', 'badge'…) and map to
 * the shared sounds; any asset key works too (AG.sfx.play('drop-cover-hold.sfx.clatter')).
 *
 * The site owns the switches (Settings → Sound, js/core/state.js); js/ui/game-host.js
 * passes them in with AG.sound.setPrefs({ sfx, music }). Music never starts on the
 * overview: the shell calls AG.music.allow() when the player presses Play. Browsers only
 * allow audio after a tap or key press, which Play always is. */
window.AG = window.AG || {};
(function (AG) {
  const NAMES = {
    tap: 'shared.sfx.tap', good: 'shared.sfx.confirm', confirm: 'shared.sfx.confirm', collect: 'shared.sfx.collect',
    soft: 'shared.sfx.soft_wrong', hit: 'shared.sfx.hit', jump: 'shared.sfx.jump', oops: 'shared.sfx.oops',
    alarm: 'shared.sfx.whistle', blip: 'shared.sfx.tick', tick: 'shared.sfx.tick', badge: 'shared.sfx.badge',
    splash: 'shared.sfx.splash', go: 'shared.sfx.go', pause: 'shared.sfx.pause', star: 'shared.sfx.star', xp: 'shared.sfx.xp',
    whistle: 'shared.sfx.whistle',
    win: 'shared.jingles.win', end: 'shared.jingles.good_try', good_try: 'shared.jingles.good_try',
    level_start: 'shared.jingles.level_start', rank_up: 'shared.jingles.rank_up'
  };
  const prefs = { sfx: true, music: false };
  let ctx = null, master = null, musicGain = null;
  const buffers = new Map(); // url → Promise<AudioBuffer|null>

  function ensure() {
    if (ctx) return ctx;
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain(); master.gain.value = 0.8; master.connect(ctx.destination);
      musicGain = ctx.createGain(); musicGain.gain.value = 0.45; musicGain.connect(master);
    } catch (e) { ctx = null; }
    return ctx;
  }
  function resume() { if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {}); }

  function buffer(src) {
    if (!buffers.has(src)) {
      buffers.set(src, fetch(src)
        .then(r => { if (!r.ok) throw new Error(r.status); return r.arrayBuffer(); })
        .then(b => new Promise((res, rej) => ensure().decodeAudioData(b, res, rej)))
        .catch(() => { AG.warnOnce('sound:' + src, 'missing sound', src); return null; }));
    }
    return buffers.get(src);
  }
  const srcFor = name => AG.assets.url(NAMES[name] || (name.includes('.') ? name : 'shared.sfx.' + name));

  AG.sfx = {
    play(name, opts) {
      if (!prefs.sfx || !name) return;
      const src = srcFor(name); if (!src || !ensure()) return;
      resume();
      buffer(src).then(buf => {
        if (!buf || !prefs.sfx) return;
        const s = ctx.createBufferSource(), g = ctx.createGain();
        s.buffer = buf; g.gain.value = (opts && opts.volume) || 1;
        s.connect(g).connect(master); s.start();
      });
    },
    /** Warm the cache (e.g. a game's sounds when it mounts). */
    preload(names) { if (ensure()) names.forEach(n => { const src = srcFor(n); if (src) buffer(src); }); }
  };

  let current = null; // { key, node }
  let wanted = null;  // key the shell asked for
  let allowed = false;
  function startMusic(key) {
    const src = AG.assets.url(key); if (!src || !ensure()) return;
    resume();
    const token = {}; current = { key, token, node: null };
    buffer(src).then(buf => {
      if (!buf || !current || current.token !== token) return;
      const node = ctx.createBufferSource(); node.buffer = buf; node.loop = true;
      node.connect(musicGain); node.start(); current.node = node;
    });
  }
  function stopMusic() { if (current && current.node) { try { current.node.stop(); } catch (e) { /* already stopped */ } } current = null; }
  function sync() {
    if (!prefs.music || !allowed || !wanted) return stopMusic();
    if (current && current.key === wanted) return;
    stopMusic(); startMusic(wanted);
  }

  AG.music = {
    /** key: an asset key (a game's '<id>.music.theme', or 'shared.music.menu'). */
    play(key) { wanted = key || wanted; sync(); },
    stop() { wanted = null; stopMusic(); },
    /** The player pressed Play: music may start from now on. */
    allow() { allowed = true; ensure(); resume(); sync(); },
    /** Leaving the play screen: back to silence on the overview. */
    disallow() { allowed = false; stopMusic(); },
    mood() { sync(); }, // the prototype's API; moods are now per-game themes
    playing: () => !!(current && current.node)
  };

  AG.sound = {
    prefs: () => Object.assign({}, prefs),
    setPrefs(p) { if (p) { if ('sfx' in p) prefs.sfx = !!p.sfx; if ('music' in p) prefs.music = !!p.music; } sync(); }
  };
})(window.AG);
