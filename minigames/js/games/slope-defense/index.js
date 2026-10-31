/* 04 Slope Defense (slope-defense): Landslide · geological · planning · expert COMMS (AGILA if the player is Comms).
 * courses.html?hazard=landslide#game, play route #play/<level>.
 *   L1 planting (trees) · L2 drainage (canals) · L3 warning signs (Alert meter) · L4 night storm (flashlight, walls) · L5 typhoon, two big slides
 * Slope.js is the model (mud, rain, signs, villagers, waves), BuildPhase.js and RainPhase.js the two phases, SlopeDefenseScene.js the scene,
 * tuning.js the numbers, levels.json the five levels. Built on the E7 sim engine. */
window.AG = window.AG || {};
(function (AG) {
  const SD = AG.slopeDefense, T = SD.tuning;
  const S = en => ({ en });

  AG.games['slope-defense'] = {
    id: 'slope-defense',
    takeaway: S("Cracks, tilting trees, muddy water? Tell an adult and move to safety. Don't wait for the slope to fall."),
    learn: [
      S('Trees, grass and drainage canals help hold a slope, but they cannot stop every landslide.'),
      S('Warning signs: new cracks, leaning trees or posts, sudden muddy creek water, and a rumbling sound.'),
      S('When you notice a sign, tell an adult right away.'),
      S('Evacuate early. Leaving early is never wrong!')
    ],
    badges: [
      { id: 'green-slope', name: S('Green Slope'), icon: 'badge_1', desc: S('Grow 20 full trees.') },
      { id: 'eagle-eye', name: S('Eagle Eye'), icon: 'badge_2', desc: S('Report 50 warning signs.') },
      { id: 'early-bird', name: S('Early Bird'), icon: 'badge_3', desc: S('Evacuate before the rain turns orange on all 5 levels.') }
    ],
    characterActions: ['idle', 'think', 'alert', 'happy', 'cheer'],

    intro(ctx) {
      const ex = ctx.expertId, me = ctx.characterId;
      return [
        { speaker: ex, text: S('Watch for warning signs and tell everyone!'), pose: AG.rig.resolve(ex, 'hold:radio').frame },
        { speaker: me, text: S('What kind of signs?') },
        { speaker: ex, text: S('**Cracks** in the ground, **tilting** trees or posts, sudden **muddy creek water**, or a **rumbling** sound. If you see one, **tell an adult and evacuate early**. Leaving early is never wrong!'), pose: AG.rig.resolve(ex, 'alert').frame }
      ];
    },

    tutorial(ctx) {
      const pose = AG.rig.resolve(ctx.characterId, 'point').frame;
      return [
        { text: S('**Build first.** Pick a spot (arrows or tap), choose a **tree**, **grass**, **canal** or **wall**. You can take them back for all your coins. Then press **Space** or tap **START RAIN**.'), pose },
        { text: S('**In the rain,** move the lookout with the **arrows** (hold **Shift** to go slow) and press **Enter** on a warning sign, or just **tap** it. Every report raises your **Alert**.'), pose },
        { text: S('Press **E** or tap **EVACUATE** to send everyone to the safe zone. It takes about 8 seconds, so call it **early**: it is never wrong!'), pose }
      ];
    },

    mount(stage, ctx, done) {
      let scene = null, dead = false;
      const keys = [T.art.map(ctx.level), T.art.safe, T.art.post, T.art.creep, T.art.slide, T.art.villager, T.art.waiting].concat(
        T.art.houses, T.art.rain, T.tree.art, T.wall.art, T.signs.types.map(T.art.sign), ['slope-defense.def.vetiver', 'slope-defense.def.canal']);
      Promise.all([AG.assets.ready()])
        .then(() => Promise.all(keys.map(k => AG.assets.loadImage(k))))
        .then(() => {
          if (dead) return;
          if (!ctx.levelData) throw new Error('Level ' + ctx.level + ' is missing from levels.json');
          scene = new SD.SlopeDefenseScene(stage, ctx, done);
        })
        .catch(err => { console.error(err); stage.append(AG.util.h('p', { class: 'ag-loading' }, AG.t('sh.loadFailed', { msg: err.message }))); });
      return () => { dead = true; if (scene) scene.destroy(); };
    }
  };
})(window.AG);
