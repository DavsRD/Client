/* 06 Rising Water House (rising-water-house): Severe Flooding · hydrometeorological · planning · expert LOGISTICS (AGILA if the player is Logistics).
 * courses.html?hazard=severe-flooding#game, play route #play/<level>.
 *   L1 basic tasks · L2 power before water · L3 family members with needs (and an early evacuation order) · L4 night + outage · L5 surprise evacuation order
 * The E7 sim engine runs the walker, the task queue and the bubbles; RisingWaterScene.js is the game, Water.js the flood and the pure rules,
 * tuning.js the numbers, levels.json the five levels, data/tasks.json the tasks. */
window.AG = window.AG || {};
(function (AG) {
  const RW = AG.risingWater;
  const S = en => ({ en });

  AG.games['rising-water-house'] = {
    id: 'rising-water-house',
    takeaway: S("Power off, move up, and never walk through floodwater — leave when you're told to."),
    learn: [
      S('Turn off the main power BEFORE the water reaches the outlets. Water and electricity can hurt people.'),
      S('Move valuables, papers, clean water and your family to the upper floor, and keep a go bag ready.'),
      S('Listen to the radio for evacuation updates. Go when the order comes: do not wait.'),
      S('Never walk or wade through floodwater. It can hide holes and strong currents, and a bike or a TV can be replaced.')
    ],
    badges: [
      { id: 'power-first', name: S('Power First'), icon: 'sign_power', desc: S('Switch the power off first on all 5 levels.') },
      { id: 'family-hero', name: S('Family Hero'), icon: 'heart', desc: S('Get the whole family safe on level 3.') },
      { id: 'no-wading', name: S('No Wading'), icon: 'sign_nowading', desc: S('Never go out for the decoy bike, 3 levels in a row.') }
    ],
    characterActions: ['idle', 'walk', 'carry:📺', 'stop', 'oops', 'happy', 'cheer', 'hold:flashlight'],

    intro(ctx) {
      const ex = ctx.expertId, me = ctx.characterId;
      return [
        { speaker: ex, text: S('When floodwater rises, do these things, in this order: **switch off the main power**, move people and valuables **upstairs**, and keep **papers, clean water and a go bag** safe.'), pose: AG.rig.resolve(ex, 'point').frame },
        { speaker: me, text: S('What if the water is already in the street?') },
        { speaker: ex, text: S('**Never walk through floodwater.** Listen to the **radio**, and **leave right away** when an evacuation order comes.'), pose: AG.rig.resolve(ex, 'alert').frame }
      ];
    },

    tutorial(ctx) {
      const pose = AG.rig.resolve(ctx.characterId, 'point').frame;
      return [
        { text: S('The **bubbles** are jobs. **← → or Tab** pick one, **Enter** queues it. Or just **tap** it. You can line up 4; tap a chip below to remove one.'), pose },
        { text: S('Watch the **water lines** on the wall: **ankle (outlets)**, **knee**, **waist**. Switch the power off before the first one!'), pose },
        { text: S('If an **EVACUATE NOW!** banner appears, press **E** or tap it. Leave right away, together.'), pose }
      ];
    },

    mount(stage, ctx, done) {
      let scene = null, dead = false;
      Promise.all([AG.assets.ready(), AG.data.asset('rising-water-house', 'data/house_layouts.json'), AG.data.load('rising-water-house', 'data/tasks.json')])
        .then(([, layouts, tasks]) => {
          const T = RW.tuning, K = 'rising-water-house.';
          const art = [T.art.houses[ctx.levelData && ctx.levelData.house], T.art.surface, T.art.current, T.art.boat, T.art.outlet, T.art.breakerOn, T.art.breakerOff, T.art.bike].concat(
            Object.values(T.art.markers), ['tv', 'ref', 'cabinet', 'jugs', 'gobag', 'radio'].map(n => K + 'prop.' + n),
            ['lola_2f', 'dog_2f', 'chicken_2f', 'baby'].map(n => K + 'family.' + n)).filter(Boolean);
          return Promise.all(art.map(k => AG.assets.loadImage(k))).then(() => [layouts, tasks]);
        })
        .then(([layouts, tasks]) => {
          if (dead) return;
          if (!ctx.levelData) throw new Error('Level ' + ctx.level + ' is missing from levels.json');
          scene = new RW.RisingWaterScene(stage, ctx, done, layouts, tasks);
        })
        .catch(err => { console.error(err); stage.append(AG.util.h('p', { class: 'ag-loading' }, AG.t('sh.loadFailed', { msg: err.message }))); });
      return () => { dead = true; if (scene) scene.destroy(); };
    }
  };
})(window.AG);
