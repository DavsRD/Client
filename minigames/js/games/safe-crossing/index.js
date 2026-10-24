/* 13 Safe Crossing (safe-crossing) — Road & Traffic Accidents · technological · reflex · expert LOGISTICS.
 * courses.html?hazard=road-accidents#game, play route #play/<world>-<level>, Daily #daily (endless).
 *
 *   W1 quiet street: slow traffic, a zebra on every road, LOOK FIRST
 *   W2 walk signals and pedestrian lanes, a footbridge, the busy market road with parked
 *      jeepneys (occlusion), phones, railway crossings
 *   W3 bike world (the 🪖 helmet first, ride in the bike lane), then night (dithered dark,
 *      streetlights, the 🦺 reflective vest)
 * Crossy Road / Frogger with a twist: crossing SAFELY scores more than surviving. Courses
 * come from levels.json (fixed lanes, seeded traffic) or endless.js (the Daily). One walk =
 * SafeCrossingScene.js; the pure parts are tuning.js, lanes/*.js, Vehicles.js, Signals.js,
 * Occlusion.js and endless.js (tested in kalasag-dev/minigames/tests/safe-crossing.test.js). */
window.AG = window.AG || {};
(function (AG) {
  const SC = AG.safeCrossing, T = SC.tuning, R = SC.rules;
  const S = (en, fil) => ({ en, fil });

  const STR = {
    rows: S('Rows', 'Hilera'), looked: S('Looked both ways', 'Tumingin muna'), zebra: S('Pedestrian lane', 'Pedestrian lane'),
    hearts: S('Hearts lost', 'Nawalang puso'), paws: S('Paw prints', 'Bakas ng paa'),
    winMsg: S('Stop, look left and right, and cross at the pedestrian lane. Your phone can wait.', 'Huminto, tumingin sa kaliwa at kanan, at tumawid sa pedestrian lane. Makapaghihintay ang cellphone mo.'),
    loseMsg: S('Take your time: stop at the curb, look both ways, and wait for a safe gap.', 'Dahan-dahan lang: huminto sa gilid, tumingin sa magkabilang direksiyon, at maghintay ng ligtas na pagkakataon.'),
    endlessMsg: S('What a walk! Every safe crossing counts.', 'Ang galing ng lakad mo! Mahalaga ang bawat ligtas na pagtawid.')
  };

  AG.games['safe-crossing'] = {
    id: 'safe-crossing',
    takeaway: S('Stop, look left and right, and cross at the pedestrian lane — your phone can wait.', 'Huminto, tumingin sa kaliwa at kanan, at tumawid sa pedestrian lane — makapaghihintay ang cellphone mo.'),
    learn: [
      S('Stop at the curb and look left and right before you cross.', 'Huminto sa gilid ng kalsada at tumingin sa kaliwa at kanan bago tumawid.'),
      S('Cross at the pedestrian lane, wait for the walking signal, and use footbridges.', 'Tumawid sa pedestrian lane, hintayin ang signal na maglakad, at gumamit ng footbridge.'),
      S("Don't step out from between parked vehicles, and wait at railway barriers.", 'Huwag lumabas sa pagitan ng nakaparadang sasakyan, at maghintay sa harang ng riles.'),
      S('Put your phone away. On a bike: helmet on, stay in the bike lane. At night: wear something reflective.', 'Itabi ang cellphone. Sa bisikleta: mag-helmet at manatili sa bike lane. Sa gabi: magsuot ng reflective.')
    ],
    badges: [
      { id: 'looks-both-ways', name: S('Looks Both Ways', 'Tumitingin sa Dalawang Panig'), icon: 'check', desc: S('Look both ways before 100 crossings.', 'Tumingin sa magkabilang direksiyon bago ang 100 pagtawid.') },
      { id: 'zebra-fan', name: S('Zebra Fan', 'Tagahanga ng Pedestrian Lane'), icon: 'star', desc: S('Cross 50 roads inside the pedestrian lane.', 'Tumawid sa 50 kalsada sa loob ng pedestrian lane.') },
      { id: 'bright-at-night', name: S('Bright at Night', 'Maliwanag sa Gabi'), icon: 'vest', desc: S('Finish both night levels wearing the reflective vest.', 'Tapusin ang dalawang antas sa gabi nang suot ang reflective vest.') }
    ],
    characterActions: ['idle', 'hop', 'look_left', 'look_right', 'oops', 'cheer'],
    generateDaily: seed => SC.generateDaily(seed),

    intro(ctx) {
      const ex = ctx.expertId, me = ctx.characterId;
      const point = AG.rig.resolve(ex, 'point').frame, stop = AG.rig.resolve(ex, 'stop').frame;
      const L = (speaker, text, pose) => ({ speaker, text, pose });
      const lines = {
        1: [L(ex, S('Stop, look left, look right — then cross at the pedestrian lane!', 'Huminto, tumingin sa kaliwa, tumingin sa kanan — saka tumawid sa pedestrian lane!'), point),
          L(me, S('How do I look both ways?', 'Paano ako titingin sa magkabilang direksiyon?')),
          L(ex, S('Just wait at the curb for a moment. You will look left and right by yourself. Then go when it is clear!', 'Maghintay lang sandali sa gilid. Titingin ka sa kaliwa at kanan. Saka tumawid kapag maluwag na!'), stop)],
        2: [L(ex, S('This road has walk signals. Cross only when the little person is walking!', 'May signal ang kalsadang ito. Tumawid lang kapag naglalakad ang maliit na tao!'), point),
          L(me, S('And at the market with all the parked jeepneys?', 'Paano sa palengke na maraming nakaparadang jeepney?')),
          L(ex, S("Never step out from between parked vehicles: drivers can't see you, and you can't see them. Use the pedestrian lane, the footbridge, and wait at the railway barrier.", 'Huwag lumabas sa pagitan ng nakaparadang sasakyan: hindi ka nila makikita, at hindi mo rin sila makikita. Gumamit ng pedestrian lane, footbridge, at maghintay sa harang ng riles.'), stop)],
        3: [L(ex, S('Time to ride! Helmet first, then stay in the bike lane.', 'Oras na para mag-bisikleta! Helmet muna, saka manatili sa bike lane.'), point),
          L(me, S('What about walking home at night?', 'Paano kapag pauwi na sa gabi?')),
          L(ex, S('Wear something reflective, like the vest, so drivers see you from far away.', 'Magsuot ng reflective, gaya ng vest, para makita ka agad ng mga drayber.'), point)]
      };
      const world = (ctx.levelData && ctx.levelData.world) || ctx.world;
      return lines[Math.min(3, Math.max(1, world))];
    },

    tutorial(ctx) {
      const e = ctx.levelData || {}, lanes = (e.lanes || []).map(l => (typeof l === 'string' ? l : l.t));
      const out = [
        S('Hop with the **arrow keys** (or **WASD**). On a phone or tablet, **tap** to hop forward and **swipe** to go sideways or back.', 'Lumundag gamit ang **arrow keys** (o **WASD**). Sa phone o tablet, **i-tap** para lumundag pasulong at **i-swipe** para patagilid o paatras.'),
        S('At the curb, **stop and wait** a moment: you look left 👈 and right 👉 by yourself. Looking first scores **+50**; not looking **−20**.', 'Sa gilid ng kalsada, **huminto at maghintay** sandali: kusa kang titingin sa kaliwa 👈 at kanan 👉. **+50** kapag tumingin muna; **−20** kapag hindi.'),
        S('Crossing inside the **pedestrian lane** counts **double**. Get to the 🏫 School.', 'Ang pagtawid sa loob ng **pedestrian lane** ay **doble** ang puntos. Pumunta sa 🏫 paaralan.')
      ];
      if ((e.lanes || []).some(l => l.sig)) out.push(S('Walk signal: go on **WALK** (+100). Stepping out on **STOP** costs a heart.', 'Signal: tumawid kapag **WALK** (+100). Kapag tumawid sa **STOP**, mawawalan ka ng puso.'));
      if ((e.bridges || []).length) out.push(S('A **footbridge** is the safest way over a busy road (+100).', 'Ang **footbridge** ang pinakaligtas na daan sa mataong kalsada (+100).'));
      if (lanes.includes('parked')) out.push(S("**Parked vehicles** hide the traffic. Don't step out between them.", 'Natatakpan ng **nakaparadang sasakyan** ang trapiko. Huwag lumabas sa pagitan nila.'));
      if (lanes.includes('rail')) out.push(S('**Railway**: when the bells ring and the barrier comes down, wait (+50).', '**Riles**: kapag tumunog ang kampana at bumaba ang harang, maghintay (+50).'));
      if ((e.items || []).some(it => it.kind === 'phone')) out.push(S('Stepped on a 📱? Press **Q** or **tap 📱** to put it away (+20).', 'Natapakan ang 📱? Pindutin ang **Q** o **i-tap ang 📱** para itabi (+20).'));
      if (e.bike) out.push(S('Pick up the 🪖 **helmet** before you ride, then stay in the **bike lane**.', 'Kunin ang 🪖 **helmet** bago sumakay, saka manatili sa **bike lane**.'));
      if (e.night) out.push(S("It's night. Grab the 🦺 **reflective vest**: drivers see you and slow down.", 'Gabi na. Kunin ang 🦺 **reflective vest**: makikita ka ng mga drayber at babagal sila.'));
      return out;
    },

    mount(stage, ctx, done) {
      const entry = ctx.levelData || SC.generateDaily(ctx.seed);
      const stats = run => AG.store.update('stats', s => {
        const sc = s.safeCrossing = s.safeCrossing || { looked: 0, zebra: 0, nightVest: {} };
        sc.looked = (sc.looked || 0) + run.stats.looked;
        sc.zebra = (sc.zebra || 0) + run.stats.zebra;
        if (run.school && run.night && run.vest && ctx.mode === 'stage') { sc.nightVest = sc.nightVest || {}; sc.nightVest[run.world + '-' + run.level] = true; }
      }).safeCrossing;
      const scene = new SC.Scene(stage, ctx, {
        entry,
        onEnd: run => {
          const st = stats(run), stars = R.stars(run, run.targets);
          const detail = [
            { label: STR.rows, value: run.endless ? run.rows : run.rows + ' / ' + (entry.lanes.length - 1) },
            { label: STR.looked, value: run.stats.looked + ' / ' + run.stats.crossings },
            { label: STR.zebra, value: run.stats.zebra },
            { label: STR.hearts, value: run.heartsLost }
          ];
          if (!run.endless) detail.push({ label: STR.paws, value: run.paws + ' / 3' });
          done({
            won: run.endless ? stars > 0 : run.school, stars, score: run.score, timeMs: Math.round(run.usedMs),
            collectibles: run.pawFlags, heartsLeft: run.heartsLeft, detail,
            message: run.endless ? STR.endlessMsg : run.school ? STR.winMsg : STR.loseMsg,
            badgeEvents: R.badges(st), delay: run.school ? 1400 : 900
          });
        }
      });
      if (AG.debug.on) SC.live = { scene }; // ?debug=1: scripted checks
      scene.mount().catch(err => { console.error(err); });
      return () => scene.destroy();
    }
  };
})(window.AG);
