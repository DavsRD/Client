/* 11 Fire Escape Maze (fire-escape) — Fire · technological · planning · expert FIRE SAFETY.
 * courses.html?hazard=fire#game, play route #play/<level>, Daily #daily.
 *
 *   L1 follow the exit signs                    L2 + SMOKE: crawl low (the cough meter)
 *   L3 + FEEL THE DOOR before opening it         L4 + SPREADING FIRE, embers (Stop-Drop-Roll), the elevator trap
 *   L5 + POWER CUT and a classmate to alert
 * Every floor plan comes from the pure generator (js/logic/fire-escape/generator.js) seeded by
 * levels.json (fixed Stage seeds) or the date (daily.js). One run = FireEscapeScene.js; its
 * hazards are Smoke.js, Doors.js, FireSpread.js and SDRQuickTime.js; numbers in tuning.js.
 * Kids get out, they don't fight fires: the extinguisher never appears as the player's action.
 *
 * Keys: arrows / WASD move, C crawl, E feel, Enter / Space open or alert; S, D and ←/→ are
 * STOP / DROP / ROLL only inside the Stop-Drop-Roll panel. Touch: swipe (hold to keep going),
 * the D-pad, the 🧎 ✋ 🚪 buttons, tap a door or the classmate. Mouse: drag or click. */
window.AG = window.AG || {};
(function (AG) {
  const FE = AG.fireEscape, T = FE.tuning, R = FE.rules;
  const S = (en, fil) => ({ en, fil });
  const { h } = AG.util;

  const STR = {
    timeLeft: S('Time left', 'Natitirang oras'), coins: S('Stars found', 'Nakuhang bituin'), penalties: S('Mistakes', 'Mali'),
    cough: S('Most cough', 'Pinakamataas na ubo'), qte: S('Stop-Drop-Roll', 'Hinto-Dapa-Gulong'), mate: S('Classmate saved', 'Nailigtas na kaklase'),
    yes: S('Yes', 'Oo'), no: S('No', 'Hindi'),
    winMsg: S('Get low, feel the door, use the stairs, and go straight to the assembly area.', 'Yumuko, damhin ang pinto, gumamit ng hagdan, at dumiretso sa assembly area.'),
    winLeft: S('You got out! Next time, alert your classmate on the way.', 'Nakalabas ka! Sa susunod, tawagin ang kaklase mo habang palabas.'),
    loseMsg: S('Follow the green exit signs and keep moving. You can do it!', 'Sundan ang berdeng exit signs at tuloy-tuloy lang. Kaya mo iyan!'),
    timeUp: S("Time's up!", 'Ubos na ang oras!'),
    timeUpText: S('The exit signs always show the way out. Try again?', 'Laging itinuturo ng exit signs ang labasan. Subukan muli?'),
    retrySame: S('Retry same maze', 'Ulitin ang parehong maze'),
    newMaze: S('New maze', 'Bagong maze'),
    results: S('See results', 'Tingnan ang resulta')
  };

  AG.games['fire-escape'] = {
    id: 'fire-escape',
    takeaway: S('Get low, feel the door, use the stairs, and go straight to the assembly area.', 'Yumuko, damhin ang pinto, gumamit ng hagdan, at dumiretso sa assembly area.'),
    learn: [
      S('Follow the green EXIT signs to the stairs.', 'Sundan ang berdeng EXIT signs papunta sa hagdan.'),
      S('Smoke rises: get LOW and crawl under it.', 'Pumapataas ang usok: YUMUKO at gumapang sa ilalim nito.'),
      S('Feel a closed door with the back of your hand first. Hot? Find another way.', 'Damhin muna ang saradong pinto gamit ang likod ng kamay. Mainit? Humanap ng ibang daan.'),
      S('Use the stairs, never the elevator. If your clothes catch fire: STOP, DROP and ROLL.', 'Gumamit ng hagdan, hindi elevator. Kapag nasunog ang damit: HUMINTO, DUMAPA at GUMULONG.'),
      S('Alert others, get out, and go straight to the assembly area. Kids get out; grown-ups fight fires.', 'Tawagin ang iba, lumabas, at dumiretso sa assembly area. Lumalabas ang mga bata; ang matatanda ang lumalaban sa sunog.')
    ],
    badges: [
      { id: 'low-and-slow', name: S('Low and Slow', 'Mababa at Dahan-dahan'), icon: 'smoke', desc: S('Crawl through 100 smoky tiles.', 'Gumapang sa 100 mausok na tile.') },
      { id: 'door-checker', name: S('Door Checker', 'Tagadama ng Pinto'), icon: 'check', desc: S('Feel 50 doors before opening them.', 'Damhin ang 50 pinto bago buksan.') },
      { id: 'stairs-not-elevator', name: S('Stairs, Not Elevator', 'Hagdan, Hindi Elevator'), icon: 'sign_stairs', desc: S('Escape level 4 without trying the elevator.', 'Makatakas sa antas 4 nang hindi sinusubukan ang elevator.') }
    ],
    characterActions: ['idle', 'walk', 'crawl', 'alert', 'oops', 'cheer', 'stop', 'duck_cover', 'slide'],
    generateDaily: seed => FE.generateDaily(seed),

    intro(ctx) {
      const ex = ctx.expertId, me = ctx.characterId;
      const megaphone = AG.rig.resolve(ex, 'hold:megaphone').frame, point = AG.rig.resolve(ex, 'point').frame;
      const L = (speaker, text, pose) => ({ speaker, text, pose });
      const lines = {
        1: [L(ex, S('Fire alarm! Follow the green exit signs — stay low!', 'Fire alarm! Sundan ang berdeng exit signs — yumuko!'), megaphone),
          L(me, S('Which way do I go?', 'Saan ako dadaan?')),
          L(ex, S('Every sign points to the stairs. Walk, don\'t run, and go straight to the assembly area.', 'Itinuturo ng bawat sign ang hagdan. Maglakad, huwag tumakbo, at dumiretso sa assembly area.'), point)],
        2: [L(ex, S('Fire alarm! There is smoke in the halls. Smoke rises, so the cleanest air is near the floor.', 'Fire alarm! May usok sa pasilyo. Pumapataas ang usok, kaya nasa ibaba ang malinis na hangin.'), megaphone),
          L(me, S('Then I get low and crawl!', 'Kaya yuyuko ako at gagapang!')),
          L(ex, S('Yes! Press C or tap 🧎 to crawl under the smoke.', 'Tama! Pindutin ang C o i-tap ang 🧎 para gumapang sa ilalim ng usok.'), point)],
        3: [L(ex, S('Fire alarm! Before you open a closed door, feel it with the back of your hand.', 'Fire alarm! Bago buksan ang saradong pinto, damhin ito gamit ang likod ng kamay.'), megaphone),
          L(me, S('And if it is hot?', 'Paano kung mainit?')),
          L(ex, S("Don't open it! Fire may be on the other side. Find another way.", 'Huwag buksan! Baka may apoy sa kabila. Humanap ng ibang daan.'), point)],
        4: [L(ex, S('Fire alarm! This fire is spreading. Use the STAIRS, never the elevator.', 'Fire alarm! Kumakalat ang sunog. Gumamit ng HAGDAN, hindi elevator.'), megaphone),
          L(me, S('What if a spark lands on me?', 'Paano kung tamaan ako ng tilamsik?')),
          L(ex, S('STOP, DROP and ROLL! Then keep going to the exit. Leave the fire to the firefighters.', 'HUMINTO, DUMAPA at GUMULONG! Saka tumuloy sa labasan. Iwan ang apoy sa mga bumbero.'), point)],
        5: [L(ex, S('Fire alarm! The lights are out, but the exit signs still glow.', 'Fire alarm! Patay ang ilaw, pero umiilaw pa rin ang exit signs.'), megaphone),
          L(me, S("Someone's still inside!", 'May tao pa sa loob!')),
          L(ex, S('Alert your classmate on the way out: walk up to them and press Enter or tap them.', 'Tawagin ang kaklase mo habang palabas: lumapit at pindutin ang Enter o i-tap sila.'), point)]
      };
      return lines[R.theme(R.features(ctx.levelData, ctx.level))];
    },

    tutorial(ctx) {
      const f = R.features(ctx.levelData, ctx.level);
      const out = [
        S('Walk with the **arrow keys** (or **WASD**), **swipe**, or use the **D-pad**. Hold to keep walking.', 'Maglakad gamit ang **arrow keys** (o **WASD**), **i-swipe**, o ang **D-pad**. Pindutin nang matagal para tuloy-tuloy.'),
        S('Follow the green **exit signs** to the stairs, then step out to the **assembly area**. Pick up the 3 ⭐ on the way if you have time.', 'Sundan ang berdeng **exit signs** papunta sa hagdan, saka lumabas sa **assembly area**. Kunin ang 3 ⭐ kung may oras.')
      ];
      if (f.smoke) out.push(S('In smoke, press **C** or tap **🧎** to crawl. Standing up in smoke fills the cough meter.', 'Sa usok, pindutin ang **C** o i-tap ang **🧎** para gumapang. Kapag nakatayo sa usok, napupuno ang ubo.'));
      if (f.doors) out.push(S('At a closed door: **E** or **✋** to feel it, then **Enter** or **🚪** to open it. Hot = find another way.', 'Sa saradong pinto: **E** o **✋** para damhin, saka **Enter** o **🚪** para buksan. Mainit = ibang daan.'));
      if (f.fire) out.push(S('A spark? **S** STOP, **D** DROP, then **← →** ROLL four times (or tap and swipe). Never take the elevator.', 'May tilamsik? **S** HINTO, **D** DAPA, saka **← →** GUMULONG nang apat na beses (o i-tap at i-swipe). Huwag sumakay sa elevator.'));
      if (f.classmate) out.push(S('Find your classmate: stand next to them and press **Enter** or **tap** them. They follow you out.', 'Hanapin ang kaklase: tumabi at pindutin ang **Enter** o **i-tap** sila. Susunod sila sa iyo.'));
      return out;
    },

    mount(stage, ctx, done) {
      let scene = null, reseeds = 0, panel = null;
      const baseSeed = ((ctx.levelData && ctx.levelData.seed) != null ? ctx.levelData.seed : ctx.seed) >>> 0;
      const stats = run => AG.store.update('stats', s => {
        const fe = s.fireEscape = s.fireEscape || { smokeCrawled: 0, doorsFelt: 0 };
        fe.smokeCrawled = (fe.smokeCrawled || 0) + (run.smokeCrawled || 0);
        fe.doorsFelt = (fe.doorsFelt || 0) + (run.doorsFeltFirst || 0);
      }).fireEscape;
      const start = seed => {
        if (panel) { panel.remove(); panel = null; }
        if (scene) scene.destroy();
        scene = new FE.Scene(stage, ctx, { seed, onEnd: run => (run.escaped ? finish(run) : timedOut(run, seed)) });
        if (AG.debug.on) FE.live = { scene, start, get panel() { return panel; } }; // ?debug=1: scripted checks
        scene.mount().catch(err => { console.error(err); });
      };
      const finish = run => {
        const st = stats(run);
        const stars = R.stars(run), score = R.points(run);
        const pick = AG.pick;
        const detail = [
          { label: STR.timeLeft, value: AG.ui.fmtTime(run.timeLeftMs / 1000) },
          { label: STR.coins, value: run.coins + ' / 3' },
          { label: STR.penalties, value: run.penalties }
        ];
        if (scene.f.smoke) detail.push({ label: STR.cough, value: Math.round(run.maxCough * 100) + '%' });
        if (scene.f.fire) detail.push({ label: STR.qte, value: run.qte });
        if (run.needsClassmate) detail.push({ label: STR.mate, value: pick(run.classmate ? STR.yes : STR.no) });
        done({
          won: true, stars, score, timeMs: Math.round(run.usedMs), collectibles: run.coinFlags,
          detail, message: run.needsClassmate && !run.classmate ? STR.winLeft : STR.winMsg,
          badgeEvents: R.badges(st, run), delay: 1400
        });
      };
      const timedOut = (run, seed) => {
        stats(run);
        AG.sfx.play('end');
        const btn = (label, cls, fn) => { const b = h('button', { class: 'ag-btn ' + (cls || ''), type: 'button' }, AG.pick(label)); b.addEventListener('click', fn); return b; };
        const same = btn('↻ ' + AG.pick(STR.retrySame), '', () => start(seed));
        const fresh = btn('🔀 ' + AG.pick(STR.newMaze), 'ag-btn--alt', () => start(R.reseed(baseSeed, ++reseeds)));
        const res = btn(AG.pick(STR.results), 'ag-btn--alt', () => {
          panel.remove(); panel = null;
          done({ won: false, stars: 0, score: R.points(run), timeMs: Math.round(run.usedMs), collectibles: run.coinFlags, detail: [{ label: STR.coins, value: run.coins + ' / 3' }, { label: STR.penalties, value: run.penalties }], message: STR.loseMsg, delay: 0 });
        });
        panel = h('div', { class: 'ag-overlay fe-timeup', role: 'dialog', 'aria-label': AG.pick(STR.timeUp) }, h('div', { class: 'ag-box' },
          AG.chars.img(ctx.characterId, 'determined', 1), h('h3', {}, AG.pick(STR.timeUp)), h('p', {}, AG.pick(STR.timeUpText)),
          h('div', { class: 'ag-actions' }, same, fresh, res)));
        stage.append(panel);
        same.focus({ preventScroll: true }); // at once: an Enter pressed right away retries
      };
      start(baseSeed);
      return () => { if (scene) scene.destroy(); if (panel) panel.remove(); };
    }
  };
})(window.AG);
