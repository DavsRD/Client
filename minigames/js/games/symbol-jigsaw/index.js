/* 14 Hazard Symbol Jigsaw (symbol-jigsaw) — Oil / Chemical Spill · technological · planning · expert FIRE SAFETY
 * (AGILA if the player is Fire Safety). courses.html?hazard=chemical-spill#game, play route #play/<level>.
 *
 *   L1 4 pieces + a faint dithered picture   L2 9 pieces   L3 16 pieces, some turned (only a straight piece snaps)
 *   L4 look-alike decoy pieces from a different sign   L5 sliding tiles (3 × 3, Advanced 4 × 4) against a timer
 * Every level: a spill scene with a covered sign → rebuild it → the sign's name pops up and the expert explains it →
 * "What should you do?" → outdoors the windsock (the sock tip points where the wind blows TO, so walk the other way:
 * upwind), indoors "tell an adult" → a Home Safety card → results; the sign becomes a sticker in the Sign Album
 * (the overview's Sign Album button, SignAlbumScene.js). Content is JSON: levels.json, data/signs.json,
 * data/questions.json, data/home-cards.json. The flow is JigsawScene.js (Round) and SlideScene.js; numbers and
 * scoring are tuning.js; the windsock and the compass are Windsock.js. The pieces engine does the moving. */
window.AG = window.AG || {};
(function (AG) {
  const SJ = AG.symbolJigsaw;
  const S = en => ({ en });
  const K = 'symbol-jigsaw.';

  AG.games['symbol-jigsaw'] = {
    id: 'symbol-jigsaw',
    takeaway: S("See a spill or a hazard sign? Don't touch it, move upwind, and tell an adult."),
    learn: [
      S('A hazard sign tells you what a chemical can do: catch fire, poison, burn, explode, or hurt nature.'),
      S("At a spill, don't touch it. Move upwind (toward where the wind comes from), uphill and away, and tell an adult."),
      S('Never mix cleaning chemicals. Bleach mixed with other cleaners can make a poison gas.'),
      S('Keep products in their original labelled bottles, and store them high or locked away from little siblings.')
    ],
    badges: [
      { id: 'sign-reader', name: S('Sign Reader'), icon: 'clipboard', desc: S('Collect half of the stickers in the Sign Album.') },
      { id: 'full-album', name: S('Full Album'), icon: 'trophy', desc: S('Collect every sticker in the Sign Album.') },
      { id: 'upwind-expert', name: S('Upwind Expert'), icon: 'sign_highground', desc: S('Pick the upwind arrow on the first try 10 times.') }
    ],
    characterActions: ['idle', 'think', 'point', 'happy', 'worried', 'cheer', 'hold:sign'],

    intro(ctx) {
      const ex = ctx.expertId, me = ctx.characterId;
      const alert = AG.rig.resolve(ex, 'alert').frame, point = AG.rig.resolve(ex, 'point').frame;
      return [
        { speaker: ex, text: S('Oil on the beach, chemicals in a warehouse, a bottle that tipped over at home. Every one of them has a **warning sign**.'), pose: alert },
        { speaker: me, text: S("I'm the Hazard Detective! How do I read the signs?") },
        { speaker: ex, text: S('**Rebuild each sign** piece by piece, and learn what it means. At a real spill: **don\'t touch it, move upwind, and tell an adult.**'), pose: point }
      ];
    },

    tutorial(ctx) {
      const lv = ctx.levelData || {}, spec = lv[ctx.difficulty === 'advanced' ? 'advanced' : 'easy'] || {};
      const out = lv.mode === 'slide' ? [
        S('The sign is cut into **sliding tiles**. Press the **arrows** to slide a tile into the gap, or tap a tile next to the gap.'),
        S('Put every tile back in place to rebuild the sign. Stuck? Press **💡 Peek** for a faint look at the picture. The clock is running!')
      ] : [
        S('The sign is in pieces! **Drag** a piece from the tray to the board. With the keyboard: **←/→** choose a piece, **Enter** picks it up, the **arrows** move it, **Enter** places it. **Tab** jumps between the tray and the board.'),
        S('A piece snaps in only at its own spot. If it does not fit, it bounces back and counts as a mistake. **Esc** puts a piece back.')
      ];
      if (spec.rotate) out.push(S('Some pieces are **turned**. Press **R** or tap ↻ until a piece is the right way up. Only a straight piece snaps in.'));
      if (spec.decoys) out.push(S('Careful! A few pieces come from a **different sign**. They never fit.'));
      if (spec.ghost) out.push(S('The faint dots on the board show the picture.'));
      out.push(S('Then answer the question. Outdoors, read the **windsock** to find **upwind**: the tip points where the wind is going, so walk the other way.'));
      return out;
    },

    /** Overview extras (registry overviewExtras): the shell opens these in a dialog. */
    extras: {
      SignAlbumScene: { mount: (host, info) => SJ.SignAlbumScene.mount(host, info) }
    },

    mount(stage, ctx, done) {
      let scene = null, dead = false;
      AG.sfx.preload(['snap', 'bounce', 'slide', 'reveal'].map(n => K + 'sfx.' + n));
      Promise.all([AG.assets.ready(), AG.data.load('symbol-jigsaw', 'data/signs.json'), AG.data.load('symbol-jigsaw', 'data/questions.json'), AG.data.load('symbol-jigsaw', 'data/home-cards.json')])
        .then(([, signs, questions, cards]) => {
          if (dead) return;
          const level = ctx.levelData;
          if (!level) throw new Error('Level ' + ctx.level + ' is missing from levels.json');
          const spec = level[ctx.difficulty === 'advanced' ? 'advanced' : 'easy'];
          const album = ((AG.store.get('stats') || {}).symbolJigsaw || {}).album || [];
          const id = SJ.puzzle.pickSign(level.pool, album, ctx.seed);
          const sign = signs.find(s => s.id === id);
          const qa = questions.questions.find(q => q.sign === id);
          if (!sign || !qa) throw new Error('No sign or question for ' + id);
          const Cls = level.mode === 'slide' ? SJ.SlideScene : SJ.JigsawScene;
          scene = new Cls(stage, ctx, done, { level, spec, sign, signs, qa, ask: questions.ask, home: questions.home, cards, album });
          if (AG.debug.on) SJ.live = { scene };   // ?debug=1: scripted checks
        })
        .catch(err => { console.error(err); stage.append(AG.util.h('p', { class: 'ag-loading' }, AG.t('sh.loadFailed', { msg: err.message }))); });
      return () => { dead = true; if (scene) scene.destroy(); };
    }
  };
})(window.AG);
