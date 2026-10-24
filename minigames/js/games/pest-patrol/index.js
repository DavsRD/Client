/* 10 Pest Patrol Match (pest-patrol) — Pest Infestation · biological · words · expert MEDIC.
 * courses.html?hazard=pest-infestation#game, play route #play/<level>.
 *
 *   L1 identical pairs face down                     MEMORY FLIP (modes/MemoryFlip.js)
 *   L2 drag each prevention onto its pest            PEST → PREVENTION (modes/PairDrop.js)
 *   L3 pest + cause + prevention, 3 flips            TRIPLE MATCH (modes/TripleFlip.js)
 *   L4 partner pairs joined by ≤ 2 turns, timed      ONET CONNECT (modes/Onet.js)
 *   L5 Onet that uncovers breeding sites to clean    BOSS BOARD (modes/BossBoard.js)
 * All five share PestPatrolScene.js (portraits, HUD, scoring, facts, hint/shuffle, badges) and
 * tuning.js. Content is JSON: levels.json and data/sets.json.
 *
 * Keys: arrows move (WASD off, S = shuffle), Enter / Space flips or selects, H = hint (−50),
 * S = shuffle (Onet), Esc cancels a picked tile (level 2) or pauses. Touch / mouse: tap, drag
 * (level 2), 🔀 and 💡. */
window.AG = window.AG || {};
(function (AG) {
  const PP = AG.pestPatrol;
  const S = (en, fil) => ({ en, fil });

  const MODE = n => ['memory', 'drop', 'triple', 'onet', 'boss'][Math.min(5, Math.max(1, n || 1)) - 1];
  const modeOf = ctx => (ctx.levelData && ctx.levelData.mode) || MODE(ctx.level);

  AG.games['pest-patrol'] = {
    id: 'pest-patrol',
    learn: [
      S('Empty, scrub and cover anything that holds water: mosquitoes that carry dengue breed there.', 'Itapon, kuskusin at takpan ang anumang may naipong tubig: doon namumugad ang lamok na may dengue.'),
      S('Cover garbage and stay out of floodwater: rat pee can cause leptospirosis.', 'Takpan ang basura at umiwas sa baha: ang ihi ng daga ay puwedeng magdulot ng leptospirosis.'),
      S('Cover food and wash your hands with soap: flies and cockroaches leave germs.', 'Takpan ang pagkain at maghugas ng kamay gamit ang sabon: nag-iiwan ng mikrobyo ang langaw at ipis.'),
      S('Report crop pests to the farm technician early.', 'Isumbong agad sa farm technician ang peste ng pananim.')
    ],
    badges: [
      { id: 'memory-master', name: S('Memory Master', 'Bihasa sa Memorya'), icon: 'star', desc: S('Get 3 stars on level 1 (Memory Flip).', 'Makakuha ng 3 bituin sa antas 1 (Memory Flip).') },
      { id: 'onet-pro', name: S('Onet Pro', 'Onet Pro'), icon: 'trophy', desc: S('Make a speed chain of 10 matches.', 'Makagawa ng 10 sunod-sunod na mabilis na tugma.') },
      { id: 'four-s', name: S('4S Hero', 'Bayani ng 4S'), icon: 'check', desc: S('Clean 40 mosquito breeding sites.', 'Maglinis ng 40 pinamumugaran ng lamok.') }
    ],
    characterActions: ['idle', 'think', 'happy', 'cheer', 'point'],

    intro(ctx) {
      const ex = ctx.expertId, me = ctx.characterId;
      const lines = {
        memory: [
          [ex, S('Pests like mosquitoes, rats and flies can spread sickness. Let\'s get to know them!', 'Ang mga peste gaya ng lamok, daga at langaw ay puwedeng magkalat ng sakit. Kilalanin natin sila!')],
          [me, S("I'll find the matching cards!", 'Hahanapin ko ang magkaparehong card!')],
          [ex, S("And I'll tell you a fact about each pest you find.", 'At sasabihin ko ang isang katotohanan tungkol sa bawat pesteng mahanap mo.')]
        ],
        drop: [
          [ex, S('Every pest has a way to stop it. Can you match them?', 'May paraan para mapigil ang bawat peste. Kaya mo bang itugma?')],
          [me, S("I'll put each fix next to its pest!", 'Ilalagay ko ang bawat lunas sa tabi ng peste nito!')]
        ],
        triple: [
          [ex, S('Now find three cards that go together: the pest, the sickness it spreads, and how to stop it.', 'Hanapin ang tatlong card na magkakasama: ang peste, ang sakit na dala nito, at paano ito pipigilan.')],
          [me, S('Three in a row. I can do it!', 'Tatlo nang sunod. Kaya ko ito!')]
        ],
        onet: [
          [ex, S('Join each pest to its sickness or its fix. The line can only turn twice!', 'Ikabit ang bawat peste sa sakit o lunas nito. Dalawang beses lang puwedeng lumiko ang linya!')],
          [me, S("I'll be quick. Fast matches make a speed chain!", 'Bibilisan ko. Ang mabibilis na tugma ay sunod-sunod na bonus!')]
        ],
        boss: [
          [ex, S('Mosquitoes hide their eggs in standing water: tires, vases, gutters and drums.', 'Itinatago ng lamok ang itlog nila sa naipong tubig: gulong, plorera, alulod at drum.')],
          [me, S("I'll clear the board and clean every breeding site!", 'Aalisin ko ang tiles at lilinisin ang bawat pinamumugaran!')],
          [ex, S('That is the first S of the 4S against dengue: Search and destroy!', 'Iyan ang unang S ng 4S laban sa dengue: Hanapin at sirain!')]
        ]
      }[modeOf(ctx)];
      return lines.map(([speaker, text]) => ({ speaker, text }));
    },

    tutorial(ctx) {
      const common = S('Press **H** or tap **💡** for a hint (−50 points).', 'Pindutin ang **H** o i-tap ang **💡** para sa pahiwatig (−50 puntos).');
      return {
        memory: [
          S('Use the **arrow keys** and **Enter**, or **tap**, to flip two cards.', 'Gamitin ang **arrow keys** at **Enter**, o **i-tap**, para magbukas ng dalawang card.'),
          S('The same picture twice is a match. If not, they flip back, so remember them!', 'Kapag pareho ang larawan, tugma. Kung hindi, babalik sila, kaya tandaan!'),
          common
        ],
        drop: [
          S('**Drag** a tile from the tray onto its pest, or **tap** the tile and then the pest.', '**I-drag** ang tile mula sa tray papunta sa peste nito, o **i-tap** ang tile saka ang peste.'),
          S('Keyboard: **Enter** picks a tile, **arrows** choose a pest, **Enter** places it, **Esc** puts it back.', 'Keyboard: **Enter** para pumili ng tile, **arrows** para pumili ng peste, **Enter** para ilagay, **Esc** para ibalik.'),
          common
        ],
        triple: [
          S('Flip **three** cards: a pest, the sickness it spreads, and how to stop it.', 'Magbukas ng **tatlong** card: peste, ang sakit na dala nito, at paano ito pipigilan.'),
          S('Two cards that don\'t belong together flip back right away.', 'Babalik agad ang dalawang card na hindi magkasama.'),
          common
        ],
        onet: [
          S('Select a pest and its sickness or fix. If a line with **at most 2 turns** joins them, both clear.', 'Pumili ng peste at ng sakit o lunas nito. Kapag naikabit ng linyang may **hanggang 2 liko**, maaalis ang dalawa.'),
          S('The line can run around the outside of the board. **S** or **🔀** shuffles (2 per level).', 'Puwedeng dumaan ang linya sa labas ng board. **S** o **🔀** para haluin (2 bawat antas).'),
          common
        ],
        boss: [
          S('Clear tiles like in level 4. Some tiles hide a **dirty breeding site**.', 'Mag-alis ng tiles gaya sa antas 4. May tiles na nagtatago ng **maruming pinamumugaran**.'),
          S('Select the site (**Enter** or **tap**) to clean it. Win by clearing the board **and** cleaning every site.', 'Piliin ang lugar (**Enter** o **i-tap**) para linisin. Manalo sa pag-alis ng lahat ng tiles **at** paglinis ng bawat lugar.'),
          common
        ]
      }[modeOf(ctx)];
    },

    mount(stage, ctx, done) {
      let scene = null, mode = null, dead = false;
      const loading = AG.util.h('p', { class: 'ag-loading' }, AG.t('ov.loading'));
      stage.append(loading);
      AG.data.load('pest-patrol', 'data/sets.json').then(data => {
        if (dead) return;
        loading.remove();
        scene = new PP.Scene(stage, ctx, done, data);
        const Mode = { memory: PP.MemoryFlip, drop: PP.PairDrop, triple: PP.TripleFlip, onet: PP.Onet, boss: PP.BossBoard }[modeOf(ctx)];
        mode = new Mode(scene, data);
        mode.start();
        if (AG.debug.on) PP.live = { scene, mode }; // ?debug=1: scripted browser checks
      }).catch(err => {
        console.error(err);
        if (!dead) loading.textContent = AG.t('sh.loadFailed', { msg: err.message });
      });
      return () => { dead = true; if (mode) mode.destroy(); if (scene) scene.destroy(); };
    }
  };
})(window.AG);
