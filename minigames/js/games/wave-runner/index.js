/* 03 Wave Runner (wave-runner): Tsunami · geological · reflex · expert RESCUE (AGILA if the player is Rescue).
 * courses.html?hazard=tsunami#game, play route #play/<level>, Daily #daily (endless).
 *   L1 beach → hill · L2 town streets with evacuation-route signs · L3 vertical climb (ladders, stairs, rooftops)
 *   L4 night run (dark, light radius 130) · L5 more waves (a second wave starts behind after the middle checkpoint)
 * The E3 side-scroll engine runs the player and the wave; WaveRunnerScene.js is the game, IntroScene.js the warning at the start,
 * rules.js the pure rules, tuning.js the numbers, chunks.json the 30 chunks, levels.json the five stages, daily.js the endless run. */
window.AG = window.AG || {};
(function (AG) {
  const WR = AG.waveRunner;
  const S = en => ({ en });
  const K = 'wave-runner.';

  AG.games['wave-runner'] = {
    id: 'wave-runner',
    takeaway: S("If the ground shakes or the sea pulls back — run to high ground. Don't wait, and don't go back."),
    learn: [
      S('Strong shaking, the sea suddenly pulling back, or a loud roar are natural warnings. Run to high ground right away.'),
      S('Never walk toward a sea that is pulling back. The fish on the sand are a danger sign, not a treat.'),
      S('Go UP: a hill or a tall concrete building. The high way is shorter and safer than the beach.'),
      S('A tsunami is many waves. Stay on high ground and wait for the all-clear.')
    ],
    badges: [
      { id: 'quick-to-run', name: S('Quick to Run'), icon: 'run', desc: S('Press RUN in under 0.8 seconds, 5 times.') },
      { id: 'high-ground', name: S('High Ground'), icon: 'sign_highground', desc: S('Choose to wait for the all-clear 10 times.') },
      { id: 'night-runner', name: S('Night Runner'), icon: 'bulb', desc: S('Finish the night run (level 4) without a single hit.') }
    ],
    characterActions: ['idle', 'run', 'jump', 'fall', 'slide', 'alert', 'stop', 'oops', 'cheer'],
    generateDaily: seed => WR.generateDaily(seed),

    intro(ctx) {
      const ex = ctx.expertId, me = ctx.characterId;
      return [
        { speaker: ex, text: S('A tsunami can come after **strong shaking**, when **the sea pulls back**, or when you hear a **loud roar**. Those are natural warnings!'), pose: AG.rig.resolve(ex, 'point').frame },
        { speaker: me, text: S('What do I do when I see one?') },
        { speaker: ex, text: S('**Run UP to high ground** right away: a hill or a tall concrete building. Do not wait for a siren, and never walk toward the sea!'), pose: AG.rig.resolve(ex, 'point').frame }
      ];
    },

    tutorial(ctx) {
      const pose = AG.rig.resolve(ctx.characterId, 'point').frame;
      return [
        { text: S('Press **RUN** the moment you see the warning. The faster you react, the bigger your head start on the wave.'), pose },
        { text: S('**Jump**: Space, ↑ or W, or tap the screen. Hold it to jump higher. **Slide** under high things: ↓ or S, swipe down, or the ⤓ button.'), pose },
        { text: S('At a fork, **jump up** to the high path: it is shorter and safer. Staying on the low road is longer, and sand slows you down.'), pose }
      ];
    },

    mount(stage, ctx, done) {
      let scene = null, dead = false;
      const art = [].concat(
        ['street', 'street_top', 'crate', 'oneway', 'ladder', 'stairs', 'crumble_2f', 'raft', 'sand', 'sand_top', 'dirt', 'grass_top', 'wall', 'wall_window', 'roof', 'hut', 'tall_building', 'debris'].map(n => K + 'tiles.' + n),
        ['wave_4f', 'flag_2f', 'sign_route'].map(n => K + n),
        ['calm', 'shake', 'retreat', 'roar'].map(n => K + 'intro.' + n),
        ['beach', 'town', 'night', 'hill'].flatMap(s => [1, 2, 3].map(i => K + 'bg.' + s + '_' + i + (i === 1 ? '_sky' : i === 2 ? '_far' : '_near')))
      );
      Promise.all([AG.assets.ready(), AG.data.load('wave-runner', 'chunks.json')])
        .then(([, chunks]) => { WR.chunks = chunks; return Promise.all(art.map(k => AG.assets.loadImage(k))).then(() => chunks); })
        .then(chunks => {
          if (dead) return;
          if (!ctx.levelData) throw new Error('Level ' + ctx.level + ' is missing from levels.json');
          scene = new WR.WaveRunnerScene(stage, ctx, done, chunks);
        })
        .catch(err => { console.error(err); stage.append(AG.util.h('p', { class: 'ag-loading' }, AG.t('sh.loadFailed', { msg: err.message }))); });
      return () => { dead = true; if (scene) scene.destroy(); };
    }
  };
})(window.AG);
