/* 17 Go With the Flow (go-with-the-flow): Crowd Crush (Stampede) · social · reflex · expert MEDIC (AGILA if the player is Medic).
 * courses.html?hazard=crowd-crush#game, play route #play/<level>.
 *   L1 school evacuation drill · L2 fiesta procession · L3 stadium exit · L4 bottleneck doors (marshals) · L5 sudden surge
 * The E7 sim engine runs the crowd (agents + flow field + spatial hash). CrowdScene.js is the model and the scene, Buddy.js and Marshals.js the
 * buddy and the marshals, js/logic/go-with-the-flow/pressure.js the pressure rules, tuning.js the numbers, levels.json the five levels. */
window.AG = window.AG || {};
(function (AG) {
  const G = AG.goWithTheFlow, T = G.tuning;
  const S = en => ({ en });

  AG.games['go-with-the-flow'] = {
    id: 'go-with-the-flow',
    takeaway: S("In a crowd: walk, don't push, move with the flow toward the side — and never stop to pick things up."),
    learn: [
      S('Walk. Never run or push: pushing makes the crowd press harder.'),
      S('Move WITH the flow and edge diagonally toward the sides, where it is calmer.'),
      S('Keep your arms in front of your chest to protect your breathing space.'),
      S('Never stop to pick up dropped things. Leave them and keep moving.'),
      S('Follow the marshals, stay with your buddy and use your meeting point if you get separated. If you fall, protect your head and get up fast.')
    ],
    badges: [
      { id: 'calm-walker', name: S('Calm Walker'), icon: 'badge_1', desc: S('Finish all 5 levels with a peak pressure of 50 or less.') },
      { id: 'buddy-system', name: S('Buddy System'), icon: 'badge_2', desc: S('Finish all 5 levels without losing your buddy.') },
      { id: 'leave-it', name: S('Leave It!'), icon: 'badge_3', desc: S('Finish all 5 levels without stopping for a dropped thing.') }
    ],
    characterActions: ['idle', 'walk', 'alert', 'oops', 'cheer'],
    settings: [{ key: 'gwfJoystick', label: S('Touch: a floating joystick instead of follow-the-finger') }],

    intro(ctx) {
      const ex = ctx.expertId, me = ctx.characterId;
      return [
        { speaker: ex, text: S('Arms in front, move with the flow, edge to the side!'), pose: AG.rig.resolve(ex, 'point').frame },
        { speaker: me, text: S('What if I get squeezed?') },
        { speaker: ex, text: S('**Walk, don\'t push.** Keep your **arms in front of your chest**, move **with the flow** and edge **diagonally toward the sides**. **Never stop to pick things up**, follow the **marshals** and stay with your **buddy**.'), pose: AG.rig.resolve(ex, 'alert').frame }
      ];
    },

    tutorial(ctx) {
      const pose = AG.rig.resolve(ctx.characterId, 'point').frame;
      return [
        { text: S('**Walk** with the **arrows or WASD**, or **drag** on a touch screen. Walk **with** the crowd toward the exit. Your buddy holds your hand: stay close!'), pose },
        { text: S('Watch the **pressure** meter. A packed crowd, pushing against the flow, standing still or being squeezed on a wall all raise it. Edge to a calmer side and it drops.'), pose },
        { text: S('**Hold Space** (or hold 🛡️ **BRACE**) to put your **arms in front**. Pressure rises slower, but you walk slower too.'), pose },
        { text: S('**Never stop on dropped things.** Follow the marshal\'s arrow. If you get separated, go to your meeting point 📍.'), pose }
      ];
    },

    mount(stage, ctx, done) {
      let scene = null, dead = false;
      const keys = [T.art.map(ctx.level), T.art.marshal, T.art.meet, T.art.pressure].concat(T.art.crowd);
      Promise.all([AG.assets.ready(), AG.data.asset('go-with-the-flow', 'data/maps.json')])
        .then(([, maps]) => Promise.all(keys.map(k => AG.assets.loadImage(k))).then(() => maps))
        .then(maps => {
          if (dead) return;
          if (!ctx.levelData) throw new Error('Level ' + ctx.level + ' is missing from levels.json');
          const map = maps[ctx.levelData.map];
          if (!map) throw new Error('Map ' + ctx.levelData.map + ' is missing from maps.json');
          scene = new G.CrowdScene(stage, ctx, done, map);
        })
        .catch(err => { console.error(err); stage.append(AG.util.h('p', { class: 'ag-loading' }, AG.t('sh.loadFailed', { msg: err.message }))); });
      return () => { dead = true; if (scene) scene.destroy(); };
    }
  };
})(window.AG);
