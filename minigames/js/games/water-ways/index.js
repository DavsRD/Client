/* 08 Water Ways (water-ways) — El Niño / drought · hydrometeorological · planning ·
 * expert LOGISTICS. courses.html?hazard=el-nino#game, play route #play/<level>.
 *
 *   L1 connect the pipes            L2 + limited supply and priorities (leave some places off)
 *   L3 + hidden leaks (FLOW shows the drips; fix them with 🔧)
 *   L4 + saving water: drip pipes, greywater from the laundry, rain catchers
 *   L5 + heat wave: open canals evaporate, tight supply
 * Each board ends with the heat check (HeatCheck.js). The boards are in levels.json (one per
 * difficulty, each a stored solution that the game scrambles with the level seed); the water
 * model is js/logic/water-ways/flow.js; one board = WaterWaysScene.js; numbers in tuning.js.
 *
 * Keys: arrows / WASD move, Space or R turns a pipe, E fixes a leak, F = FLOW, H hint, Q done;
 * heat check 1 / 2 / 3 + Enter. Touch / mouse: tap a pipe, 🔧 then a leak, ▶ FLOW, ✔ Done. */
window.AG = window.AG || {};
(function (AG) {
  const WW = AG.waterWays, R = WW.rules, TL = WW.tiles;
  const S = (en, fil) => ({ en, fil });

  const STR = {
    turns: S('Turns (par)', 'Ikot (par)'), tests: S('Tests', 'Subok'), leaks: S('Leaks fixed', 'Naayos na tagas'),
    saved: S('Water saved', 'Natipid na tubig'), heat: S('Heat check', 'Tanong sa init'), yes: S('Yes', 'Oo'), no: S('No', 'Hindi'),
    later: S('later', 'mamaya'),
    win3: S('Every drop counted! Drinking water came first, and nothing leaked away.', 'Mahalaga ang bawat patak! Inuna ang inuming tubig, at walang nasayang.'),
    win2: S('Everyone got water! Next time, fix every leak and keep the water out of the hot sun.', 'May tubig ang lahat! Sa susunod, ayusin ang bawat tagas at ilayo ang tubig sa init ng araw.'),
    win1: S('The house has drinking water! In a drought, drinking water always comes first.', 'May inuming tubig ang bahay! Sa tagtuyot, laging inuuna ang inuming tubig.')
  };

  AG.games['water-ways'] = {
    id: 'water-ways',
    takeaway: S('In a drought, every drop counts — fix leaks, reuse water, and drink enough to stay cool.', 'Sa tagtuyot, mahalaga ang bawat patak — ayusin ang tagas, gamiting muli ang tubig, at uminom nang sapat para manatiling presko.'),
    learn: [
      S('When water is short, drinking water comes first: people, then animals, then crops, then laundry.', 'Kapag kulang ang tubig, inuna ang inuming tubig: tao, saka hayop, saka pananim, saka labahan.'),
      S('A leaking pipe wastes water every day. Report or fix leaks right away.', 'Araw-araw nasasayang ang tubig sa tumutulong tubo. Ipaalam o ayusin agad ang tagas.'),
      S('Reuse water: laundry water can water plants. Catch the rain when it comes.', 'Gamiting muli ang tubig: puwedeng ipandilig ang tubig-labahan. Saluhin ang ulan kapag umulan.'),
      S('In the heat, drink water and rest in the shade. Sugary drinks and the hot sun make you thirstier.', 'Sa init, uminom ng tubig at magpahinga sa lilim. Lalo kang mauuhaw sa matatamis na inumin at init ng araw.')
    ],
    badges: [
      { id: 'leak-hunter', name: S('Leak Hunter', 'Tagahanap ng Tagas'), icon: 'tap', desc: S('Fix 30 leaks.', 'Mag-ayos ng 30 tagas.') },
      { id: 'reuse-it', name: S('Reuse It', 'Gamiting Muli'), icon: 'sign_savewater', desc: S('Water a field with laundry water 10 times.', 'Magdilig ng palayan gamit ang tubig-labahan nang 10 beses.') },
      { id: 'cool-head', name: S('Cool Head', 'Presko ang Ulo'), icon: 'sunhat', desc: S('Get the heat check right on the heat-wave level.', 'Masagot nang tama ang tanong sa init sa antas ng heat wave.') }
    ],
    characterActions: ['idle', 'think', 'happy', 'worried', 'cheer', 'point'],

    intro(ctx) {
      const ex = ctx.expertId, me = ctx.characterId, point = AG.rig.resolve(ex, 'point').frame;
      const L = (speaker, text, pose) => ({ speaker, text, pose });
      const first = L(ex, S('Water is limited — drinking water first!', 'Limitado ang tubig — inuming tubig muna!'), point);
      const lines = {
        1: [first, L(me, S('How do I get water to the house?', 'Paano ko padadaluyin ang tubig sa bahay?')),
          L(ex, S('Turn the pipes so the water flows from the tank. Then press FLOW to test it.', 'Ikutin ang mga tubo para dumaloy ang tubig mula sa imbakan. Saka pindutin ang DALOY para subukan.'), point)],
        2: [first, L(me, S("But there isn't enough for everyone…", 'Pero hindi sapat para sa lahat…')),
          L(ex, S('Then the house and the animals come first. The laundry can wait.', 'Kung gayon, inuuna ang bahay at ang mga hayop. Makapaghihintay ang labahan.'), point)],
        3: [first, L(me, S('I hear dripping somewhere…', 'May naririnig akong tumutulo…')),
          L(ex, S('Some old pipes leak. Test the flow, find the drips, and fix them with the 🔧 wrench.', 'May mga lumang tubong tumutulo. Subukan ang daloy, hanapin ang tulo, at ayusin gamit ang 🔧.'), point)],
        4: [first, L(me, S('How can we make the water last?', 'Paano natin patatagalin ang tubig?')),
          L(ex, S('Catch the rain, use the drip pipe on the field, and send used laundry water to the field.', 'Saluhin ang ulan, gamitin ang tubong patak-patak sa palayan, at ipadala sa palayan ang gamit nang tubig-labahan.'), point)],
        5: [first, L(me, S("Phew, it's a heat wave!", 'Hay, ang init!')),
          L(ex, S('Open canals lose water to the sun: use the covered ones. And drink water to stay cool!', 'Natutuyo ang tubig sa bukas na kanal: gamitin ang natatakpan. At uminom ng tubig para manatiling presko!'), point)]
      };
      return lines[R.theme(R.features(ctx.levelData, ctx.level))];
    },

    tutorial(ctx) {
      const f = R.features(ctx.levelData, ctx.level);
      const out = [
        S('Turn the pipes so water flows from the tank to the 🏠 house and the others.', 'Ikutin ang mga tubo para dumaloy ang tubig mula sa imbakan papunta sa 🏠 bahay at sa iba.'),
        S('Keys: **arrows** move, **Space** or **R** turns a pipe, **F** tests the water. Touch: **tap** a pipe to turn it, then **▶ FLOW**.', 'Keys: **arrows** para gumalaw, **Space** o **R** para ikutin ang tubo, **F** para subukan ang tubig. Touch: **i-tap** ang tubo para ikutin, saka **▶ DALOY**.'),
        S('Each place shows the water it gets and needs: ✅ enough, ⚠️ not enough, ❌ none. Pipes with a 🔒 cannot turn.', 'Makikita sa bawat lugar ang tubig na natanggap at kailangan: ✅ sapat, ⚠️ kulang, ❌ wala. Hindi naiikot ang tubong may 🔒.')
      ];
      if (f.priority) out.push(S('Not enough for everyone? **Drinking water first**: the house, then the animals, the field, the laundry.', 'Hindi sapat para sa lahat? **Inuming tubig muna**: ang bahay, saka ang hayop, ang palayan, ang labahan.'));
      if (f.leaks) out.push(S('Testing shows the leaks. Fix one with **E**, or tap **🔧** then the leak.', 'Makikita ang tagas kapag sinubukan. Ayusin gamit ang **E**, o i-tap ang **🔧** saka ang tagas.'));
      if (f.drip || f.grey || f.rain) out.push(S('Save water: connect the **rain catcher**, put the **drip pipe** on the field, and send laundry water to the field with the **greywater pipe**.', 'Magtipid: ikonekta ang **saluhan ng ulan**, ilagay ang **tubong patak-patak** sa palayan, at ipadala ang tubig-labahan sa palayan gamit ang **tubo ng gamit nang tubig**.'));
      if (f.canals) out.push(S('**Open canals** lose water in the heat. **Covered canals** keep it.', 'Natutuyo ang tubig sa **bukas na kanal**. Hindi sa **natatakpang kanal**.'));
      out.push(S('Happy with it? Press **Q** or tap **✔ Done**. Then answer the heat check (**1**, **2**, **3**, then **Enter**).', 'Ayos na? Pindutin ang **Q** o i-tap ang **✔ Tapos na**. Saka sagutin ang tanong sa init (**1**, **2**, **3**, saka **Enter**).'));
      return out;
    },

    mount(stage, ctx, done) {
      const scene = new WW.Scene(stage, ctx, {
        onEnd: run => {
          const stats = AG.store.get('stats').waterWays || {};
          const res = run.res, pick = AG.pick;
          const mark = d => (d.met ? ' ✓' : d.partial ? ' ~' : ' ✗');
          const targets = R.targets(run.board, res);
          // a place left off on purpose (outside this board's water budget) is "later", not a miss
          const value = d => (!d.connected && !targets.includes(d) ? pick(STR.later) : d.got + ' / ' + d.need + mark(d));
          const detail = res.dests.slice().sort((a, b) => a.priority - b.priority)
            .map(d => ({ label: TL.KIND[d.kind], value: value(d), icon: TL.ICON[d.kind] }));
          if (run.board.tiles.some(t => t && t.leak)) detail.push({ label: STR.leaks, value: run.leaksFixed, icon: '🔧' });
          detail.push({ label: STR.saved, value: res.unused, icon: 'water' });
          detail.push({ label: STR.turns, value: run.rotations + ' (' + run.par + ')' });
          detail.push({ label: STR.tests, value: run.tests });
          detail.push({ label: STR.heat, value: pick(run.heat ? STR.yes : STR.no), icon: run.heat ? 'sunhat' : null });
          const score = R.points({ res, board: run.board, tests: run.tests, difficulty: run.difficulty, par: run.par, rotations: run.rotations, leaksFixed: run.leaksFixed, heat: run.heat });
          done({
            won: true, stars: run.stars, score, timeMs: Math.round(run.usedMs), collectibles: R.collectibles(run),
            detail, message: run.stars === 3 ? STR.win3 : run.stars === 2 ? STR.win2 : STR.win1,
            badgeEvents: R.badges(stats, run), delay: 300
          });
        }
      });
      if (AG.debug.on) WW.live = { scene }; // ?debug=1: scripted checks
      scene.mount();
      return () => scene.destroy();
    }
  };
})(window.AG);
