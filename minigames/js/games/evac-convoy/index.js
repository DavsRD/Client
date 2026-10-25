/* 07 Evac Convoy (evac-convoy): Storm Surge, expert RESCUE. Snake-style driving on the grid engine: pick up
 * families, bring them to the evacuation center before the surge floods the map row by row. Levels 1–5 add
 * priority residents, road closures, uneven pulses, night + rain (levels.json; the Daily is daily.js).
 * Registers AG.games['evac-convoy']: intro, tutorial, badges and mount() (EvacConvoyScene.js runs a level). */
window.AG = window.AG || {};
(function (AG) {
  const EC = AG.evacConvoy, R = EC.rules;
  const S = en => ({ en });

  const STR = {
    saved: S('Families saved'), target: S('Needed for a star'), order: S('Priority first'), time: S('Time left'),
    count: S('Headcount'), boat: S('Waiting for boat rescue'), hearts: S('Hearts lost'), pets: S('Lost pets found'),
    orderYes: S('Yes! +300'), orderNo: S('Not this time'), orderNone: S('No priority families'),
    countYes: S('Everyone counted! +100'), countNo: S('Recounted together'), countNone: S('—'),
    win3: S('Everyone is safe! Storm surge can rise faster than you can run — leaving early and helping those who need it first is the best plan.'),
    win: S('Well done! Next time try to bring the priority families first, and leave the coast early.'),
    lose: S('The surge was fast! Next time, start with the houses by the sea and help those who need it first.')
  };

  AG.games['evac-convoy'] = {
    id: 'evac-convoy',
    takeaway: S('Storm surge can rise faster than you can run — coastal families must leave early, and help those who need it first.'),
    learn: [
      S('Storm surge is sea water pushed inland by a typhoon. It can rise faster than you can run.'),
      S('Coastal families must leave EARLY and go inland, to higher ground and the evacuation center.'),
      S('Help those who need it first: seniors, pregnant mothers, people with disabilities and young children.'),
      S('Never drive or walk into floodwater. Flooded roads and bridges are closed: find another way.'),
      S('Count everyone at the evacuation center, so no one is left behind.')
    ],
    badges: [
      { id: 'priority-first', name: S('Priority First'), icon: 'star', desc: S('Earn the order bonus 10 times: deliver every priority family before anyone else.') },
      { id: 'long-convoy', name: S('Long Convoy'), icon: 'car', desc: S('Carry 8 passengers at the same time.') },
      { id: 'surge-beater', name: S('Surge Beater'), icon: 'sign_surge', desc: S('Finish level 4 with at least 2 surge pulses to spare.') }
    ],
    characterActions: ['idle', 'happy', 'worried', 'cheer'],
    generateDaily: seed => EC.generateDaily(seed),

    intro(ctx) {
      const ex = ctx.expertId, me = ctx.characterId;
      const pose = AG.chars.get(ex).agila ? AG.rig.resolve(ex, 'point').frame : AG.rig.resolve(ex, 'hold:megaphone').frame;
      const L = (speaker, text, p) => ({ speaker, text, pose: p });
      const lines = {
        1: [L(ex, S('Storm surge warning! The sea will rise inland, row by row. Drive the convoy to the houses, pick everyone up and bring them to the evacuation center.'), pose),
          L(me, S('How do I steer?')),
          L(ex, S('Arrow keys, or swipe. The convoy keeps moving by itself, so plan your turns. Stay on the road!'), pose)],
        2: [L(ex, S('Some neighbours need help first: seniors, mothers-to-be, people with disabilities and small children. They have a gold ring.'), pose),
          L(me, S('So I pick them up first?')),
          L(ex, S('Yes — and bring them to the center before anyone else. You earn a big order bonus!'), pose)],
        3: [L(ex, S('Trees are falling and a bridge is flooding. A whistle warns you 3 seconds before a road closes.'), pose),
          L(me, S('Then I find another way?')),
          L(ex, S('Right. Never drive into floodwater — go around.'), pose)],
        4: [L(ex, S('The surge comes in uneven waves. Watch the meter at the top: the ▲ mark shows when the warning starts.'), pose),
          L(me, S('Which row floods next?')),
          L(ex, S('The flashing, shaded row. Go to the houses by the sea first, then head inland.'), pose)],
        5: [L(ex, S("It's night and raining. You can only see a little way ahead, but the evacuation center and the houses glow."), pose),
          L(me, S("I'll follow the glow!")),
          L(ex, S('Good. Storm surge rises faster than you can run: leave early, and help those who need it first.'), pose)]
      };
      return lines[Math.min(5, Math.max(1, ctx.level || 1))];
    },

    tutorial(ctx) {
      const lvl = ctx.level || 1, f = R.features(ctx.levelData || {});
      const out = [
        S('Steer with the **arrow keys** (or **WASD**), **swipe**, or the **D-pad**. The convoy keeps moving: it starts when you press a direction.'),
        S('Drive over a **house** to pick up its families: each one adds a car to your convoy. Then drive into the **evacuation center** to unload.'),
        S("Stay on the **road**. Hitting a wall, a flooded tile, a closed road or your own convoy costs a ❤️ and your families go back to their houses."),
        S('The **surge** floods one row of the map at a time, starting at the sea. The row about to flood **flashes** with a ▲ for 3 seconds. Help the houses by the sea first!')
      ];
      if (lvl >= 2 || f.priority) out.push(S('Families with a **gold ring** (👵 🤰 🧑‍🦽 👶) need help first: they score double. Deliver them **before anyone else** for a +300 order bonus.'));
      if (lvl === 3 || f.closures) out.push(S('A whistle and a **✕** warn you 3 seconds before a road closes (a fallen tree, a flooded bridge). Find another way.'));
      if (lvl === 4) out.push(S('The pulses come **unevenly** this time. Watch the meter at the top.'));
      if (lvl === 5 || f.night) out.push(S('At night you see about **5 tiles** around you. The center and the houses glow: follow them.'));
      out.push(S('At the end, **count** the families as they walk in: press **Space** (or tap the big counter) once for each person.'));
      return out;
    },

    mount(stage, ctx, done) {
      const stats = run => AG.store.update('stats', s => {
        const e = s.evacConvoy = s.evacConvoy || { orderBonuses: 0 };
        if (run.order) e.orderBonuses = (e.orderBonuses || 0) + 1;
      }).evacConvoy;
      const scene = new EC.Scene(stage, ctx, {
        onEnd: run => {
          const st = stats(run);
          const stars = run.won ? R.stars(run) : 0, score = R.points(run);
          const detail = [
            { label: STR.saved, value: run.delivered + ' / ' + run.total, icon: 'sign_evaccenter' },
            { label: STR.target, value: run.target },
            { label: STR.order, value: run.priorityTotal ? AG.pick(run.order ? STR.orderYes : STR.orderNo) : AG.pick(STR.orderNone), icon: 'star' },
            { label: STR.time, value: AG.ui.fmtTime(run.timeLeftS), icon: 'bulb' },
            { label: STR.count, value: run.headcount ? AG.pick(run.headcount.exact ? STR.countYes : STR.countNo) : AG.pick(STR.countNone), icon: 'check' },
            { label: STR.boat, value: run.stranded, icon: 'boat' },
            { label: STR.hearts, value: run.heartsLost, icon: 'heart' },
            { label: STR.pets, value: run.pets.filter(Boolean).length + ' / 3', icon: '🐾' }
          ];
          done({
            won: run.won, stars, score, timeMs: run.usedMs, collectibles: R.collectibles(run), heartsLeft: run.heartsLeft,
            detail, message: !run.won ? STR.lose : stars === 3 ? STR.win3 : STR.win,
            badgeEvents: R.badges(st, run), delay: 400
          });
        }
      });
      if (AG.debug.on) EC.live = { scene }; // ?debug=1: scripted checks
      scene.mount().catch(err => { console.error(err); });
      return () => scene.destroy();
    }
  };
})(window.AG);
