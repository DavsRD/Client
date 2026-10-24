/* 09 Health Center Word Lab (word-lab) — Disease Outbreak · biological · words · expert MEDIC.
 * courses.html?hazard=disease-outbreak#game, play route #play/<level>.
 *
 *   L1 short words · L2 hygiene words · L3 outbreak words   PATIENT QUEUE (PatientQueue.js)
 *   L4 one long word, find the words inside it               WORD TWIST (WordTwist.js)
 *   L5 safety rules as word tiles                            SENTENCE SCRAMBLE (SentenceScramble.js)
 * All three share WordLabScene.js (counter, characters, HUD, definitions, scoring) and
 * tuning.js. Content is JSON: levels.json, data/words.en.json, data/words.fil.json,
 * data/twist.json (precomputed, kid-safe), data/sentences.json. Filipino mode follows the
 * site language (Settings → Language).
 *
 * Keys (LetterTiles): letters TYPE (WASD off; H, P, R are letters too), Backspace removes,
 * Space shuffles, Enter checks / submits, ? or / = hint, Esc = pause, arrows + Enter reach
 * any tile (Ñ too). Touch: tap tiles and ⌫ 🔀 💡 ✔. */
window.AG = window.AG || {};
(function (AG) {
  const WL = AG.wordLab;
  const S = (en, fil) => ({ en, fil });

  /** Loads every data file once (they are small), so a language switch never waits. */
  WL.data = () => Promise.all(['data/words.en.json', 'data/words.fil.json', 'data/twist.json', 'data/sentences.json'].map(f => AG.data.load('word-lab', f)))
    .then(([en, fil, twist, sentences]) => ({ en, fil, twist, sentences }));

  const MODE = n => (n <= 3 ? 'queue' : n === 4 ? 'twist' : 'sentence');
  const modeOf = ctx => (ctx.levelData && ctx.levelData.mode) || MODE(ctx.level);

  AG.games['word-lab'] = {
    id: 'word-lab',
    takeaway: S("Wash hands, cover coughs, get vaccinated, and stay home when sick — that's how outbreaks stop.",
      'Maghugas ng kamay, takpan ang ubo, magpabakuna, at manatili sa bahay kapag may sakit — ganyan napipigil ang outbreak.'),
    learn: [
      S('Wash your hands with soap and water for 20 seconds.', 'Maghugas ng kamay gamit ang sabon at tubig nang 20 segundo.'),
      S('Cover coughs and sneezes with your elbow or a tissue.', 'Takpan ang ubo at bahing gamit ang siko o tisyu.'),
      S('Wear a mask when you are sick, and stay home to rest.', 'Magsuot ng mask kapag may sakit, at magpahinga sa bahay.'),
      S('Get your vaccines, and quarantine or isolate when health workers tell you to.', 'Magpabakuna, at mag-quarantine o mag-isolate kapag sinabi ng health worker.')
    ],
    badges: [
      { id: 'no-hints-needed', name: S('No Hints Needed', 'Walang Pahiwatig'), icon: 'check', desc: S('Clear all 5 Word Lab levels without a hint.', 'Tapusin ang 5 antas ng Word Lab nang walang pahiwatig.') },
      { id: 'word-wizard', name: S('Word Wizard', 'Salamangkero ng Salita'), icon: 'trophy', desc: S('Get the BINGO word in level 4 (Word Twist).', 'Makuha ang BINGO sa antas 4 (Word Twist).') },
      { id: 'bilingual', name: S('Bilingual Helper', 'Bilingguwal na Katulong'), icon: 'star', desc: S('Clear 5 Word Lab levels in Filipino.', 'Tapusin ang 5 antas ng Word Lab sa Filipino.') }
    ],
    characterActions: ['idle', 'think', 'happy', 'cheer', 'mask_on'],
    /** Extra switches in the pause menu ⚙ (read when the next word loads). */
    settings: [{ key: 'fil.ngSingleTile', label: S('Filipino: "NG" is one tile', 'Filipino: isang tile ang "NG"') }],

    intro(ctx) {
      const ex = ctx.expertId, me = ctx.characterId;
      const lines = {
        queue: [
          [ex, S('Welcome to the health center! Patients are lining up, and each one needs a health word.', 'Maligayang pagdating sa health center! Pumipila ang mga pasyente, at bawat isa ay may kailangang salita.')],
          [me, S("I'll unscramble the letters!", 'Aayusin ko ang mga letra!')],
          [ex, S("And I'll tell you what each word means. Knowing the words helps stop germs from spreading.", 'At sasabihin ko kung ano ang ibig sabihin ng bawat salita. Ang pag-alam sa mga salita ay nakatutulong pigilan ang pagkalat ng mikrobyo.')]
        ],
        twist: [
          [ex, S('Look at this big word on the board. Many small words hide inside it!', 'Tingnan ang malaking salita sa board. Maraming maliliit na salita ang nakatago rito!')],
          [me, S("I'll find as many as I can, and the whole word too!", 'Hahanapin ko ang pinakamarami, pati ang buong salita!')]
        ],
        sentence: [
          [ex, S('The health center rules got mixed up. Can you put the words back in order?', 'Nagulo ang mga tuntunin ng health center. Kaya mo bang ayusin ang mga salita?')],
          [me, S('Yes! These rules keep everyone healthy.', 'Oo! Pinapanatiling malusog ng mga tuntuning ito ang lahat.')],
          [ex, S("After each rule, I'll tell you why it matters.", 'Pagkatapos ng bawat tuntunin, sasabihin ko kung bakit ito mahalaga.')]
        ]
      }[modeOf(ctx)];
      return lines.map(([speaker, text]) => ({ speaker, text }));
    },

    tutorial(ctx) {
      const common = S('Press **?** or tap **💡** for a hint (−30 points). **Esc** or **⏸** pauses: P and H are letters here!', 'Pindutin ang **?** o i-tap ang **💡** para sa pahiwatig (−30 puntos). **Esc** o **⏸** para huminto: letra ang P at H dito!');
      return {
        queue: [
          S('A patient shows a clue. **Type** the letters or **tap** the tiles to fill the blanks.', 'May clue ang pasyente. **Mag-type** ng letra o **i-tap** ang tiles para punan ang patlang.'),
          S('**Backspace** or **⌫** takes a letter back. **Space** or **🔀** shuffles the tiles.', 'Ang **Backspace** o **⌫** ay nagbabalik ng letra. Ang **Space** o **🔀** ay naghahalo ng tiles.'),
          S('Arrow keys + **Enter** can pick any tile, even **Ñ**. The word checks itself when every blank is full.', 'Ang arrow keys + **Enter** ay puwedeng pumili ng kahit anong tile, pati **Ñ**. Kusang susuriin ang salita kapag puno na ang patlang.'),
          common
        ],
        twist: [
          S('Make words of **3 or more letters** from the big word, then press **Enter** or **✔**.', 'Bumuo ng salitang may **3 o higit pang letra** mula sa malaking salita, saka pindutin ang **Enter** o **✔**.'),
          S('Use **every letter** for a BINGO: +300 points!', 'Gamitin ang **lahat ng letra** para sa BINGO: +300 puntos!'),
          common
        ],
        sentence: [
          S('Each tile is a word. Use **←/→** and **Enter**, or tap, to put the rule in order.', 'Salita ang bawat tile. Gamitin ang **←/→** at **Enter**, o i-tap, para ayusin ang tuntunin.'),
          S('**Backspace** or **⌫** takes the last word back.', 'Ang **Backspace** o **⌫** ay nagbabalik ng huling salita.'),
          common
        ]
      }[modeOf(ctx)];
    },

    mount(stage, ctx, done) {
      const scene = new WL.Scene(stage, ctx, done);
      let mode = null, dead = false;
      const loading = AG.util.h('p', { class: 'ag-loading' }, AG.t('ov.loading'));
      scene.board.append(loading);
      WL.data().then(data => {
        if (dead) return;
        loading.remove();
        const Mode = { queue: WL.PatientQueue, twist: WL.WordTwist, sentence: WL.SentenceScramble }[modeOf(ctx)];
        mode = new Mode(scene, data);
        mode.start();
        if (AG.debug.on) WL.live = { scene, mode }; // ?debug=1: scripted browser checks
      }).catch(err => {
        console.error(err);
        if (!dead) loading.textContent = AG.t('sh.loadFailed', { msg: err.message });
      });
      return () => { dead = true; if (mode) mode.destroy(); scene.destroy(); };
    }
  };
})(window.AG);
