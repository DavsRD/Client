/* 05 Go Bag Tetris (go-bag-tetris) — Typhoon · hydrometeorological · planning · expert LOGISTICS (AGILA if the
 * player is Logistics). courses.html?hazard=typhoon#game, play route #play/<level>.
 *
 *   L1 a small backpack, every item labelled, no turning needed   L2 a duffel with a zip divider: turn things to fit
 *   L3 scenario cards (Lola, the baby, Bantay the dog, Tito)      L4 Conveyor Rush: items on a belt, Wind Signal 1 → 5
 *   L5 Rush in a tight bag with a weight bar: too heavy to carry = Pack it! waits
 * Pack the go bag BEFORE the storm with what keeps you safe, adjusted for the household; space is tight, so
 * essentials before fun things. One level = GoBagScene.js with PackPuzzle.js (L1–3) or ConveyorRush.js (L4–5);
 * the numbers and scoring are tuning.js; the solver that proves every bag is js/logic/go-bag-tetris/solve.js.
 * Content is JSON: levels.json (bags, items, stored solutions), data/items.json, data/scenarios.json.
 *
 * Keys: Tab shelf ↔ bag ↔ buttons · ←/→ choose · Enter pick up / place · arrows move · R turn · Esc put back ·
 * X toss · Backspace undo (Pack Puzzle) · H hint. Touch / mouse: drag into the bag, tap the held item or ↻ to
 * turn it, drag to 🗑 or tap it to toss, ↶ undo, 💡 hint, Pack it! */
window.AG = window.AG || {};
(function (AG) {
  const GB = AG.goBag;
  const S = en => ({ en });
  GB.takeaway = S("Pack what keeps you safe, not what's fun — a go bag should be ready before the signal goes up.");

  AG.games['go-bag-tetris'] = {
    id: 'go-bag-tetris',
    takeaway: GB.takeaway,
    learn: [
      S('Pack your go bag BEFORE the storm: water, food, a flashlight, batteries, a radio, first aid, medicines, documents, a power bank and a whistle.'),
      S('Space is tight. Essentials go in first, then useful extras like a raincoat or a blanket. Toys and gadgets stay at home.'),
      S('Pack for your whole household: medicines for Lola, milk and diapers for a baby, food for pets, and what someone with a disability needs.'),
      S('A go bag must be light enough to carry. Too heavy means too slow.')
    ],
    badges: [
      { id: 'perfect-bag', name: S('Perfect Bag'), icon: 'go_bag', desc: S('Earn 3 stars on all 5 levels.') },
      { id: 'family-planner', name: S('Family Planner'), icon: 'heart', desc: S('Pack what Lola, the baby, Bantay the dog and Tito need.') },
      { id: 'signal-five', name: S('Signal Five'), icon: 'sign_typhoon', desc: S('Finish a Conveyor Rush at Signal No. 5 with every essential packed.') }
    ],
    characterActions: ['idle', 'think', 'happy', 'worried', 'cheer', 'hold:go_bag'],

    intro(ctx) {
      const ex = ctx.expertId, me = ctx.characterId;
      const bag = AG.rig.resolve(ex, 'hold:go_bag').frame;
      return [
        { speaker: ex, text: S('A typhoon is on its way! We pack our **go bag** now, before the signal goes up.'), pose: bag },
        { speaker: me, text: S('What goes in a go bag?') },
        { speaker: ex, text: S('Water, food, a flashlight, a radio, first aid, medicines, documents, a power bank and a whistle. **Space is tight — essentials first!**'), pose: bag }
      ];
    },

    tutorial(ctx) {
      const lv = ctx.levelData || {}, rush = lv.mode === 'rush';
      const out = rush ? [
        S('Things ride in on the **belt**, one at a time. The one in front is already in your hands!'),
        S('Put it in the bag (**arrows** + **Enter**, or drag or tap), or toss it (**X** or 🗑), before the ring runs out. **NEXT** shows what is coming.'),
        S('When the **Wind Signal** goes up, you get less time. There is no undo here, but you can still move things in the bag.')
      ] : [
        S('Fit things from the shelf into the go bag. Drag them in, or pick one with **Enter**, move it with the **arrows** and press **Enter** to put it in. **Tab** jumps between the shelf, the bag and the buttons.'),
        S('**R** or ↻ turns the item. The ghost shows ✔ where it fits and ✖ where it doesn\'t. **Esc** puts it back.'),
        S('Things you don\'t need can go in the 🗑 (or press **X**). **Backspace** or ↶ undoes. Stuck? Press **H** or 💡.'),
        S('Essentials first! When the bag is ready, press **Pack it!**')
      ];
      if (lv.level === 3) out.push(S('Read the **family cards**: they show what else your family needs.'));
      if (lv.weightBar) out.push(S('Watch the **weight bar**. If the bag is too heavy to carry, take something out before you zip it up.'));
      return out;
    },

    mount(stage, ctx, done) {
      let scene = null, dead = false;
      const byId = list => Object.fromEntries(list.map(x => [x.id, x]));
      AG.sfx.preload(['pick', 'place', 'rotate', 'invalid', 'toss'].map(n => 'go-bag-tetris.sfx.' + n));
      Promise.all([AG.assets.ready(), AG.data.load('go-bag-tetris', 'data/items.json'), AG.data.load('go-bag-tetris', 'data/scenarios.json')])
        .then(([, items, scenarios]) => {
          if (dead) return;
          const level = ctx.levelData;
          if (!level) throw new Error('Level ' + ctx.level + ' is missing from levels.json');
          const spec = level[ctx.difficulty === 'advanced' ? 'advanced' : 'easy'];
          scene = new GB.Scene(stage, ctx, done, { level, spec, items: byId(items), scenarios: byId(scenarios) });
          if (AG.debug.on) GB.live = { scene }; // ?debug=1: scripted checks
        })
        .catch(err => { console.error(err); stage.append(AG.util.h('p', { class: 'ag-loading' }, AG.t('sh.loadFailed', { msg: err.message }))); });
      return () => { dead = true; if (scene) scene.destroy(); };
    }
  };
})(window.AG);
