/* 01 Drop! Cover! Hold! (drop-cover-hold) — Earthquake · geological · reflex · expert RESCUE (AGILA if the player is
 * Rescue). courses.html?hazard=earthquake#game, play route #play/<level>.
 *   L1 classroom & library · L2 home and canteen · L3 outdoors (open ground, cover your head) · L4 aftershocks ·
 *   L5 special rounds (in bed, a classmate in a wheelchair, the mall). 6 → 10 micro-rounds per level.
 * Rooms are the starter file assets/games/drop-cover-hold/data/rooms.json; rounds are levels.json; numbers tuning.js;
 * the round flow js/logic/drop-cover-hold/roundMachine.js; drawing and input DropCoverHoldScene.js. */
window.AG = window.AG || {};
(function (AG) {
  const DCH = AG.dropCoverHold;
  const S = en => ({ en });

  AG.games['drop-cover-hold'] = {
    id: 'drop-cover-hold',
    takeaway: S('When the ground shakes: Drop, Cover, Hold — and stay put until it stops.'),
    learn: [
      S('When the ground shakes: DROP down, take COVER under something sturdy, and HOLD ON.'),
      S('Stay away from windows, glass, tall shelves and hanging lights.'),
      S('Outdoors, go to open ground away from trees, walls and power poles. In bed, stay there and cover your head with a pillow.'),
      S('Hold on until it stops (aftershocks can come back), then walk out calmly. Doorways are not the safest spot in modern buildings.')
    ],
    badges: [
      { id: 'steady-hands', name: S('Steady Hands'), icon: 'sign_dch', desc: S('Let go right when the shaking stops 10 times.') },
      { id: 'myth-buster', name: S('Myth Buster'), icon: 'bulb', desc: S('Pick sturdy cover instead of the doorway 5 times.') },
      { id: 'aftershock-ready', name: S('Aftershock Ready'), icon: 'sign_quake', desc: S('Finish level 4 without losing a heart.') }
    ],
    characterActions: ['idle', 'walk', 'alert', 'duck_cover', 'hold_on', 'cover_head', 'oops', 'happy', 'cheer'],

    intro(ctx) {
      const ex = ctx.expertId, me = ctx.characterId;
      return [
        { speaker: ex, text: S('Earthquakes come without warning. When the ground shakes: **Drop, Cover, Hold On!**'), pose: AG.rig.resolve(ex, 'duck_cover').frame },
        { speaker: me, text: S('So I drop down, get under something sturdy, and hold on?') },
        { speaker: ex, text: S('Yes! Stay away from windows and tall shelves, and hold on until it **stops**. Then walk out calmly to open ground.'), pose: AG.rig.resolve(ex, 'point').frame }
      ];
    },

    tutorial(ctx) {
      const pose = AG.rig.resolve(ctx.characterId, 'point').frame;
      return [
        { text: S('When the room rumbles, pick a **cover spot**: **←/→** and **Enter**, a number key, or tap it.'), pose },
        { text: S('Then press and hold **Space** or the **HOLD** button the whole time it shakes.'), pose },
        { text: S('Let go right when it **stops**, then pick the safe way out.'), pose }
      ];
    },

    mount(stage, ctx, done) {
      let scene = null, dead = false;
      Promise.all([AG.assets.ready(), AG.data.asset('drop-cover-hold', 'data/rooms.json')])
        .then(([, rooms]) => {
          if (dead) return;
          const level = ctx.levelData;
          if (!level || !level.rounds) throw new Error('Level ' + ctx.level + ' is missing from levels.json');
          let plays = 0;
          AG.store.update('stats', s => {
            const q = s.dropCoverHold = s.dropCoverHold || {};
            q.plays = q.plays || {};
            plays = q.plays[level.level] || 0;
            q.plays[level.level] = plays + 1;
          });
          scene = new DCH.DropCoverHoldScene(stage, ctx, done, { level, rooms, plays });
        })
        .catch(err => { console.error(err); stage.append(AG.util.h('p', { class: 'ag-loading' }, AG.t('sh.loadFailed', { msg: err.message }))); });
      return () => { dead = true; if (scene) scene.destroy(); };
    }
  };
})(window.AG);
