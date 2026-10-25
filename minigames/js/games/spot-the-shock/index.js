/* 15 Spot the Shock (spot-the-shock) — Electrical & Power Line · technological · planning · expert FIRE SAFETY
 * (AGILA if the player is Fire Safety). courses.html?hazard=electrical-hazards#game, play route #play/<level>.
 *   L1 home (5)  L2 school (6)  L3 street & power lines (7)  L4 after a typhoon, at night with a flashlight (6)
 *   L5 FIX IT: after each find, choose the safe fix (5)
 * Each level has a pool of pictures; every play shows the next pair. Levels are the starter file
 * assets/games/spot-the-shock/data/levels.json; texts are data/fix-cards.json. The level is SpotTheShockScene.js
 * (FixIt.js for level 5); numbers and scoring are tuning.js. The scene-tap engine (E2) does the aiming. */
window.AG = window.AG || {};
(function (AG) {
  const ST = AG.spotTheShock;
  const S = en => ({ en });
  const K = 'spot-the-shock.';

  AG.games['spot-the-shock'] = {
    id: 'spot-the-shock',
    takeaway: S('Never touch a fallen wire, keep water away from plugs, and tell an adult when something looks wrong.'),
    learn: [
      S('Too many plugs in one outlet can overheat. One outlet, one or two plugs.'),
      S('Water and electricity never mix: no plugs near water and never with wet hands.'),
      S('Frayed cords, open panels and missing outlet covers are for an adult to fix.'),
      S('Never touch or go near a fallen wire. Stay far away and tell an adult.')
    ],
    badges: [
      { id: 'sharp-eyes', name: S('Sharp Eyes'), icon: 'star', desc: S('Finish all 5 levels with no wrong taps.') },
      { id: 'fixer', name: S('Fixer'), icon: 'clipboard', desc: S('Choose every fix on the first try in level 5.') },
      { id: 'line-safe', name: S('Line Safe'), icon: 'sign_power', desc: S('Finish levels 3 and 4, the power-line levels.') }
    ],
    characterActions: ['idle', 'think', 'worried', 'stop', 'happy', 'cheer'],

    intro(ctx) {
      const ex = ctx.expertId, me = ctx.characterId;
      const alert = AG.rig.resolve(ex, 'alert').frame, point = AG.rig.resolve(ex, 'point').frame;
      return [
        { speaker: ex, text: S('Electricity helps us every day, but **overloaded plugs, frayed cords and fallen wires** can shock or start a fire.'), pose: alert },
        { speaker: me, text: S("So I compare the safe picture with the risky one and spot what's wrong?") },
        { speaker: ex, text: S('Yes! Find every hazard before the time runs out. And remember: **never touch a fallen wire, and tell an adult.**'), pose: point }
      ];
    },

    tutorial(ctx) {
      const out = [
        S('Two pictures: the first is **safe**, the second has **hazards**. Tap a hazard on either picture.'),
        S('With keys: the **arrows** move the reticle (hold **Shift** for small steps), **Enter** checks the spot, and **Tab** jumps to the same spot on the other picture.'),
        S('A wrong tap costs time. Stuck? **💡 Hint** (H) flashes a ring near a hazard. **🔍 Zoom** (Z, pinch or the mouse wheel) shows a 2× lens.')
      ];
      if (ctx.level === 4) out.push(S('It is dark! Your **flashlight** follows the reticle or your finger: drag to sweep it. Hidden stars only show in the light.'));
      if (ctx.level === 5) out.push(S('After each find, choose the **fix**: press **1–3**, tap it, or drag it onto the picture. A wrong fix gives a tip, then pick again.'));
      return out;
    },

    mount(stage, ctx, done) {
      let scene = null, dead = false;
      AG.sfx.preload(['found', 'wrong', 'hint', 'fixed', 'zap'].map(n => K + 'sfx.' + n));
      Promise.all([AG.assets.ready(), AG.data.asset('spot-the-shock', 'data/levels.json'), AG.data.load('spot-the-shock', 'data/fix-cards.json')])
        .then(([, data, cards]) => {
          if (dead) return;
          const level = data.levels.find(l => l.level === ctx.level);
          if (!level) throw new Error('Level ' + ctx.level + ' is missing from levels.json');
          let plays = 0;
          AG.store.update('stats', s => {
            const q = s.spotTheShock = s.spotTheShock || {};
            q.plays = q.plays || {};
            plays = q.plays[level.level] || 0;
            q.plays[level.level] = plays + 1;
          });
          const q = new URLSearchParams(location.search);
          const want = q.get('zones') === '1' || AG.debug.on ? q.get('pair') : null;
          const pair = ST.pickPair(level, plays, want);
          scene = new ST.SpotTheShockScene(stage, ctx, done, { level, pair, cards, size: data.size });
        })
        .catch(err => { console.error(err); stage.append(AG.util.h('p', { class: 'ag-loading' }, AG.t('sh.loadFailed', { msg: err.message }))); });
      return () => { dead = true; if (scene) scene.destroy(); };
    }
  };
})(window.AG);
