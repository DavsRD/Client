/* 02 Ashfall (ashfall): Volcanic Eruption · geological · reflex · expert MEDIC (AGILA if the player is Medic).
 * courses.html?hazard=volcanic-eruption#game, play route #play/<level>.
 *   L1 light ashfall · L2 falling rocks with shadows · L3 ash darkness · L4 lahar lane · L5 full eruption + evacuation dash.
 * The E4 falling engine does the objects; AshfallRun.js is the rules, AshfallScene.js the drawing, tuning.js the numbers,
 * levels.json the waves (Alert Levels), orders, photos and star targets. */
window.AG = window.AG || {};
(function (AG) {
  const A = AG.ashfall;
  const S = en => ({ en });

  AG.games.ashfall = {
    id: 'ashfall',
    takeaway: S('During ashfall: mask on, goggles on, stay indoors — and leave right away when told to evacuate.'),
    learn: [
      S('During ashfall, wear a mask and goggles to protect your nose, mouth and eyes.'),
      S('Stay away from rivers near a volcano. A lahar (a fast mudflow) can rush down them.'),
      S('Alert Levels go up as a volcano gets more active. A higher level means more danger.'),
      S('When you are told to evacuate, leave right away. Do not wait.')
    ],
    badges: [
      { id: 'mask-on', name: S('Mask On'), icon: 'facemask', desc: S('Catch 50 masks.') },
      { id: 'river-wise', name: S('River Wise'), icon: 'water_drop', desc: S('Finish level 4 without a single lahar hit.') },
      { id: 'first-on-the-bus', name: S('First on the Bus'), icon: 'hard_hat', desc: S('Reach the bus in level 5 with 3 seconds or more left.') }
    ],
    characterActions: ['idle', 'run', 'alert', 'oops', 'happy', 'cheer', 'mask_on'],
    settings: [{ key: 'ashfallHalves', label: S('Touch: hold the left or right half to move') }],

    intro(ctx) {
      const ex = ctx.expertId, me = ctx.characterId;
      return [
        { speaker: ex, text: S('Masks on, goggles on — and listen for the evacuation call!'), pose: AG.rig.resolve(ex, 'hold:first_aid').frame },
        { speaker: me, text: S('When the volcano erupts, ash and rocks fall from the sky. What should I do?') },
        { speaker: ex, text: S('Catch masks and goggles to protect yourself, dodge the falling rocks, and stay away from rivers. Lahar can rush down them!'), pose: AG.rig.resolve(ex, 'point').frame }
      ];
    },

    tutorial(ctx) {
      const pose = AG.rig.resolve(ctx.characterId, 'point').frame;
      return [
        { text: S('Move left and right: **←/→** or **A/D**. On a touch screen, drag along the ground. With a mouse, hold the button.'), pose },
        { text: S('**Catch** masks, goggles, water, a flashlight and a radio. **Dodge** ash, embers and rocks. Rocks show a **shadow** first.'), pose },
        { text: S('The alert level rises wave by wave. When the siren sounds, stay off the riverbank. When told to evacuate, **run to the bus**!'), pose }
      ];
    },

    mount(stage, ctx, done) {
      let scene = null, dead = false;
      const art = ['bg.volcano_1', 'bg.volcano_2', 'bg.volcano_3', 'bg.volcano_4', 'bg.volcano_5', 'plume', 'bus', 'lahar.bank', 'lahar.flow', 'ui.alert_1', 'ui.alert_2',
        'ui.alert_3', 'ui.alert_4', 'ui.alert_5', 'obj.rock', 'obj.ash', 'obj.ember', 'obj.coconut'].map(k => 'ashfall.' + k);
      AG.assets.ready().then(() => Promise.all(art.map(k => AG.assets.loadImage(k))))
        .then(() => {
          if (dead) return;
          if (!ctx.levelData || !ctx.levelData.waves) throw new Error('Level ' + ctx.level + ' is missing from levels.json');
          scene = new A.AshfallScene(stage, ctx, done);
        })
        .catch(err => { console.error(err); stage.append(AG.util.h('p', { class: 'ag-loading' }, AG.t('sh.loadFailed', { msg: err.message }))); });
      return () => { dead = true; if (scene) scene.destroy(); };
    }
  };
})(window.AG);
