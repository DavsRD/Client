/* 12 Rubble Rescue (rubble-rescue) — Building / Structural Collapse · technological · planning ·
 * expert RESCUE. courses.html?hazard=structural-collapse#game, play route #play/<level>.
 *
 *   L1 slide the rubble off the escape row        L2 + LOAD-BEARING slabs and cracked blocks
 *   L3 + ENERGY and KNOCKING on the pipe, a match decoy   L4 + DUST: put the mask on first
 *   L5 + AFTERSHOCKS (the hard hat)
 * Each level starts with "Spot the warning" (evacuate or stay?). The puzzles are in
 * levels.json (one per difficulty, written by kalasag-dev/minigames/tools/rubble_levels.py and
 * checked by the solver, js/logic/rubble-rescue/solver.js). One run = RubbleRescueScene.js;
 * knock rounds = Knock.js; numbers in tuning.js. The tone stays calm: nobody is ever hurt,
 * and running out of energy only means resting and signalling.
 *
 * Keys: arrows / Tab choose, Enter grabs and drops, arrows slide, Esc puts back, Space knocks,
 * H hint, Backspace undo (Easy). Touch / mouse: drag a block, tap the mask, the match, a photo
 * or the pipe (🔔). */
window.AG = window.AG || {};
(function (AG) {
  const RR = AG.rubbleRescue, T = RR.tuning, R = RR.rules;
  const S = (en, fil) => ({ en, fil });

  const STR = {
    moves: S('Moves (par)', 'Galaw (par)'), energy: S('Energy left', 'Natitirang lakas'), knocks: S('Knocks answered', 'Nasagot na katok'),
    photos: S('Photos found', 'Nakitang litrato'), warning: S('Spotted the warning', 'Napansin ang babala'), hints: S('Hints used', 'Ginamit na pahiwatig'),
    yes: S('Yes', 'Oo'), no: S('No', 'Hindi'),
    winMsg: S("You're out! Next time, leave a damaged building right away — and if you're trapped, cover your mouth, stay still and tap for help.", 'Nakalabas ka! Sa susunod, lumabas agad sa sirang gusali — at kung naipit, takpan ang bibig, manatiling kalmado at kumatok para humingi ng tulong.'),
    winMatch: S('You got out! Remember: never light a match in a damaged building — there may be gas leaks.', 'Nakalabas ka! Tandaan: huwag magsindi ng posporo sa sirang gusali — baka may tagas ng gas.'),
    winLoad: S('You got out! Remember: never move the blocks that hold the building up.', 'Nakalabas ka! Tandaan: huwag galawin ang mga sumusuporta sa gusali.')
  };

  AG.games['rubble-rescue'] = {
    id: 'rubble-rescue',
    takeaway: S("Leave a damaged building right away. If you're trapped: cover your mouth, stay still, and tap or whistle for help.", 'Lumabas agad sa sirang gusali. Kung naipit: takpan ang bibig, manatiling kalmado, at kumatok o pumito para humingi ng tulong.'),
    learn: [
      S('Big cracks, doors that stick and leaning walls mean: leave the building right away.', 'Malalaking bitak, pintong naiipit at nakahilig na pader: lumabas agad sa gusali.'),
      S('Never move debris that holds the building up.', 'Huwag galawin ang gumuhong bagay na sumusuporta sa gusali.'),
      S('Cover your nose and mouth from the dust.', 'Takpan ang ilong at bibig laban sa alikabok.'),
      S('Save your energy: tap on a pipe or blow a whistle instead of shouting.', 'Magtipid ng lakas: kumatok sa tubo o pumito sa halip na sumigaw.'),
      S('Never light a match: there may be a gas leak.', 'Huwag magsindi ng posporo: baka may tagas ng gas.')
    ],
    badges: [
      { id: 'light-tapper', name: S('Light Tapper', 'Mahinang Katok'), icon: 'whistle', desc: S('Answer 30 knock patterns.', 'Sumagot sa 30 pattern ng katok.') },
      { id: 'structural-sense', name: S('Structural Sense', 'Matalas sa Istruktura'), icon: 'sign_collapse', desc: S('Clear level 2 without touching a load-bearing block.', 'Tapusin ang antas 2 nang hindi ginagalaw ang sumusuporta sa gusali.') },
      { id: 'no-sparks', name: S('No Sparks', 'Walang Siklab'), icon: 'flame', desc: S('Escape a level with a match without ever picking it up.', 'Makatakas sa antas na may posporo nang hindi ito pinupulot.') }
    ],
    characterActions: ['idle', 'worried', 'cover_mouth', 'alert', 'happy', 'cheer', 'hold:whistle'],

    intro(ctx) {
      const ex = ctx.expertId, me = ctx.characterId;
      const light = AG.rig.resolve(ex, 'hold:flashlight').frame, radio = AG.rig.resolve(ex, 'hold:radio').frame;
      const L = (speaker, text, pose) => ({ speaker, text, pose });
      const lines = {
        1: [L(ex, S('Part of the building came down. Can you hear me? Follow my flashlight!', 'Bumagsak ang bahagi ng gusali. Naririnig mo ba ako? Sundan ang flashlight ko!'), light),
          L(me, S("I'm OK, but the way out is blocked.", 'Ayos lang ako, pero harang ang daan palabas.')),
          L(ex, S('Slide the rubble off the glowing row, one block at a time. Stay calm.', 'Idulas palayo ang mga gumuho sa umiilaw na hilera, isa-isa. Manatiling kalmado.'), light)],
        2: [L(ex, S('Careful in there! Some blocks hold the building up.', 'Ingat diyan! May mga blokeng sumusuporta sa gusali.'), light),
          L(me, S('The cracked ones and the big slabs?', 'Iyong may bitak at ang malalaking tipak?')),
          L(ex, S("Yes. Never move those. Find another way around them.", 'Oo. Huwag na huwag galawin ang mga iyon. Humanap ng ibang paraan.'), light)],
        3: [L(ex, S("We're coming! Don't shout — it wastes your energy.", 'Paparating na kami! Huwag sumigaw — nauubos ang lakas mo.'), radio),
          L(me, S('Then how will you find me?', 'Paano ninyo ako mahahanap?')),
          L(ex, S('Tap on a pipe. When we knock, knock back the same way. And never light a match!', 'Kumatok sa tubo. Kapag kumatok kami, kumatok pabalik nang pareho. At huwag magsindi ng posporo!'), radio)],
        4: [L(ex, S('There is a lot of dust in there.', 'Maraming alikabok diyan.'), light),
          L(me, S("I'll cover my nose and mouth!", 'Tatakpan ko ang ilong at bibig ko!')),
          L(ex, S('Good. Pick up the 😷 mask before you move the dusty blocks.', 'Magaling. Kunin muna ang 😷 mask bago galawin ang maalikabok na bloke.'), light)],
        5: [L(ex, S('There may be aftershocks. Your hard hat protects you.', 'Baka may aftershock. Protektado ka ng hard hat mo.'), radio),
          L(me, S('What if the blocks shift?', 'Paano kung gumalaw ang mga bloke?')),
          L(ex, S("Stay calm and keep going. We're right here at the gap.", 'Manatiling kalmado at magpatuloy. Nandito lang kami sa labasan.'), light)]
      };
      return lines[R.theme(R.features(ctx.levelData, ctx.level))];
    },

    tutorial(ctx) {
      const f = R.features(ctx.levelData, ctx.level);
      const out = [
        S('First: spot the warning sign and choose what to do (press **1** or **2**, or tap).', 'Una: hanapin ang babala at piliin ang gagawin (pindutin ang **1** o **2**, o i-tap).'),
        S('Clear every block off the **glowing row** so you can walk out to the rescuer\'s light.', 'Alisin ang lahat ng bloke sa **umiilaw na hilera** para makalabas ka papunta sa ilaw ng rescuer.'),
        S('Keys: **arrows** or **Tab** choose a block, **Enter** grabs it, **arrows** slide it, **Enter** drops it. Touch: **drag** a block.', 'Keys: **arrows** o **Tab** para pumili, **Enter** para hawakan, **arrows** para idulas, **Enter** para ibaba. Touch: **i-drag** ang bloke.'),
        S('Each block slides only along its length. Stuck? Press **H** or tap **💡**.', 'Dumudulas lang ang bloke ayon sa haba nito. Naipit? Pindutin ang **H** o i-tap ang **💡**.')
      ];
      if (f.loadBearing) out.push(S('Blocks with cracks ⚠️ and big slabs hold the building up: **never move them**.', 'Ang may bitak ⚠️ at malalaking tipak ay sumusuporta sa gusali: **huwag galawin**.'));
      if (f.knocks) out.push(S('Every move uses energy. When the rescuers knock, knock back the same rhythm: **Space** or tap the **pipe** (🔔).', 'Bawat galaw ay gumagamit ng lakas. Kapag kumatok ang mga rescuer, kumatok pabalik sa parehong ritmo: **Space** o i-tap ang **tubo** (🔔).'));
      if (f.match) out.push(S('Leave the 🔥 match alone: gas may be leaking.', 'Huwag galawin ang 🔥 posporo: baka may tagas ng gas.'));
      if (f.dust) out.push(S('Select the 😷 mask **before** moving dusty blocks.', 'Piliin ang 😷 mask **bago** galawin ang maalikabok na bloke.'));
      if (f.aftershocks) out.push(S('Aftershocks may shift a block. Stay calm: the way out is always still there.', 'Puwedeng gumalaw ang bloke sa aftershock. Manatiling kalmado: laging may daan palabas.'));
      return out;
    },

    mount(stage, ctx, done) {
      const scene = new RR.Scene(stage, ctx, {
        onEnd: run => {
          const st = AG.store.update('stats', s => { s.rubbleRescue = s.rubbleRescue || { knocksOk: 0 }; }).rubbleRescue;
          const pick = AG.pick;
          const detail = [
            { label: STR.moves, value: run.moves + ' (' + run.par + ')' },
            { label: STR.warning, value: pick(run.warning ? STR.yes : STR.no) },
            { label: STR.photos, value: run.photos.filter(Boolean).length + ' / 3' }
          ];
          if (run.hasEnergy) detail.push({ label: STR.energy, value: run.energy });
          if (run.knockRounds) detail.push({ label: STR.knocks, value: run.knocks + ' / ' + run.knockRounds });
          if (run.hints) detail.push({ label: STR.hints, value: run.hints });
          done({
            won: true, stars: R.stars(run), score: R.points(run), timeMs: Math.round(run.usedMs), collectibles: run.photos,
            detail, message: run.matchUsed ? STR.winMatch : run.loadBearing ? STR.winLoad : STR.winMsg,
            badgeEvents: R.badges(st, run), delay: 400
          });
        }
      });
      if (AG.debug.on) RR.live = { scene }; // ?debug=1: scripted checks
      scene.mount();
      return () => scene.destroy();
    }
  };
})(window.AG);
