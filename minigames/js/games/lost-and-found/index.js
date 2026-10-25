/* 16 Lost & Found: Mall Mission (lost-and-found) — Missing Child / Stranger Danger · social · expert COMMS
 * (AGILA if the player is Comms). courses.html?hazard=missing-child#game, play route #play/<level>.
 *   L1 mall · L2 wet market · L3 park fiesta · L4 beach · L5 a crowded event (less obvious helpers)
 * Each level: STOP & STAY → FIND A SAFE HELPER → TELL THE HELPER → a Safe Choices card (LostFoundScene.js, phases/).
 * Scenes are the starter file assets/games/lost-and-found/data/scenes.json; texts are data/*.json; numbers tuning.js. */
window.AG = window.AG || {};
(function (AG) {
  const LF = AG.lostFound;
  const S = en => ({ en });
  const K = 'lost-and-found.';

  AG.games['lost-and-found'] = {
    id: 'lost-and-found',
    takeaway: S("Lost? Stop, stay, find a safe helper, and tell them your name and your parent's number."),
    learn: [
      S('If you get separated, stop and stay close to where you are.'),
      S('A safe helper works there: a guard, a cashier, the info desk. A parent with children can help too.'),
      S("Tell the helper your name and your parent's phone number."),
      S('No, Go, Tell: say no, get away, and tell a trusted adult.')
    ],
    badges: [
      { id: 'stop-and-stay', name: S('Stop and Stay'), icon: 'star', desc: S('Choose "stop and stay" on the first try 15 times.') },
      { id: 'helper-finder', name: S('Helper Finder'), icon: 'check', desc: S('Find 50 safe helpers.') },
      { id: 'number-memory', name: S('Number Memory'), icon: 'clipboard', desc: S('Remember the whole practice number 10 times.') }
    ],
    characterActions: ['idle', 'worried', 'stop', 'think', 'wave', 'happy', 'cheer'],

    intro(ctx) {
      const ex = ctx.expertId, me = ctx.characterId;
      const alert = AG.rig.resolve(ex, 'alert').frame, point = AG.rig.resolve(ex, 'point').frame;
      return [
        { speaker: ex, text: S('Busy places are fun, but sometimes kids and their families get **separated**. It happens, and there is always help.'), pose: alert },
        { speaker: me, text: S('So if I can\'t see my family, I **stop and stay** close by?') },
        { speaker: ex, text: S('Yes! Then find a **safe helper**, someone who works there, and tell them your **name** and your **parent\'s number**.'), pose: point }
      ];
    },

    tutorial(ctx) {
      return [
        S('First choose what to do: press **1–3**, use **↑/↓** and **Enter**, or tap a choice.'),
        S('Then find the helpers on the list. **Arrows** move the reticle (hold **Shift** for small steps), **Enter** checks. Drag to look around; **Z**, pinch or the wheel zooms.'),
        S('Last, remember your **PRACTICE CARD**. It is made up: never type your real name or number into a website.')
      ];
    },

    mount(stage, ctx, done) {
      let scene = null, dead = false;
      AG.sfx.preload(['found', 'call', 'family'].map(n => K + 'sfx.' + n));
      Promise.all([AG.assets.ready(), AG.data.asset('lost-and-found', 'data/scenes.json'),
        AG.data.load('lost-and-found', 'data/safe-choices.json'), AG.data.load('lost-and-found', 'data/practice-names.json')])
        .then(([, scenes, safe, names]) => {
          if (dead) return;
          const level = ctx.levelData;
          if (!level || !scenes[level.scene]) throw new Error('Level ' + ctx.level + ' is missing from levels.json');
          let plays = 0;
          AG.store.update('stats', s => {
            const q = s.lostFound = s.lostFound || {};
            q.plays = q.plays || {};
            plays = q.plays[level.level] || 0;
            q.plays[level.level] = plays + 1;
          });
          scene = new LF.LostFoundScene(stage, ctx, done, { level, scene: scenes[level.scene], safe, names, plays });
        })
        .catch(err => { console.error(err); stage.append(AG.util.h('p', { class: 'ag-loading' }, AG.t('sh.loadFailed', { msg: err.message }))); });
      return () => { dead = true; if (scene) scene.destroy(); };
    }
  };
})(window.AG);
