/* 19 Check Before You Share (check-before-share) — Community Conflict / Unrest, framed as
 * "trouble in the community" · social · expert COMMS.
 * courses.html?hazard=community-conflict#game, play route #play/<world>-<level>.
 *
 *   W1 obvious rumours (ALL CAPS, no source, "forward this!")
 *   W2 source badges ("forwarded many times", unknown senders)
 *   W3 too scary / too good to be true
 *   W4 what to do at home (action cards: Do it / Don't)
 *   W5 everything mixed, with a timer on every card (a timeout = "check first")
 * One scene for all five (CheckShareScene.js), cards from Deck.js, the feelings check-in in
 * Feelings.js, numbers and pure rules in tuning.js. Content is JSON: levels.json (card ids
 * per level) and data/cards.json. No violence is ever shown or described.
 *
 * Keys: → / D share or do it, ← / A check first or don't, Enter skips the explanation, 1–4
 * answer the check-in. Touch / mouse: drag or fling the card, or tap ✔ / ✋ under it. */
window.AG = window.AG || {};
(function (AG) {
  const CS = AG.checkShare;
  const S = (en, fil) => ({ en, fil });

  AG.games['check-before-share'] = {
    id: 'check-before-share',
    takeaway: S('Stay calm, stay inside with family, listen to trusted adults — and check before you share.', 'Manatiling kalmado, manatili sa loob kasama ang pamilya, makinig sa pinagkakatiwalaang nakatatanda — at suriin bago ibahagi.'),
    learn: [
      S('Trusted sources: the barangay, your school, official radio, your parents and teachers.', 'Mapagkakatiwalaan: ang barangay, paaralan, opisyal na radyo, magulang at guro.'),
      S('Rumour clues: ALL CAPS, no source, "forward this!", forwarded many times, too scary or too good to be true.', 'Palatandaan ng tsismis: puro malalaking titik, walang pinagmulan, "ipasa ito!", maraming beses nang naipasa, sobrang nakakatakot o masyadong maganda.'),
      S('When there is trouble outside, stay inside with your family and away from windows. Never go out to watch.', 'Kapag may gulo sa labas, manatili sa loob kasama ang pamilya at lumayo sa bintana. Huwag lumabas para manood.'),
      S('Follow curfew announcements, and talk to a trusted adult about how you feel.', 'Sundin ang anunsiyo ng curfew, at sabihin sa pinagkakatiwalaang nakatatanda ang nararamdaman mo.')
    ],
    badges: [
      { id: 'fact-checker', name: S('Fact-Checker', 'Tagasuri ng Balita'), icon: 'check', desc: S('Make 100 right choices.', 'Gumawa ng 100 tamang pasya.') },
      { id: 'calm-household', name: S('Calm Household', 'Kalmadong Tahanan'), icon: 'heart', desc: S('End 5 levels with the calm meter at 90 or more.', 'Tapusin ang 5 antas na 90 pataas ang kalmado.') },
      { id: 'source-sleuth', name: S('Source Sleuth', 'Detektib ng Pinagmulan'), icon: 'star', desc: S('Get 3 stars on every World 2 level.', 'Makakuha ng 3 bituin sa bawat antas ng Mundo 2.') }
    ],
    characterActions: ['idle', 'think', 'worried', 'happy', 'hold:sign', 'point', 'hold:radio'],

    intro(ctx) {
      const ex = ctx.expertId, me = ctx.characterId;
      const lines = {
        1: [
          [ex, S('When there is trouble in the community, lots of messages go around. Some are true, and some are rumours.', 'Kapag may gulo sa komunidad, maraming mensahe ang kumakalat. May totoo, at may tsismis.')],
          [me, S('How can I tell which is which?', 'Paano ko malalaman kung alin ang alin?')],
          [ex, S('Check who sent it! Trust the barangay, your school, official radio, your parents and teachers.', 'Alamin kung sino ang nagpadala! Magtiwala sa barangay, paaralan, opisyal na radyo, magulang at guro.')]
        ],
        2: [
          [ex, S('Now every message has a badge that shows who sent it. A ↪ tag means it was forwarded many times.', 'Ngayon, may badge ang bawat mensahe na nagpapakita kung sino ang nagpadala. Ang ↪ ay nangangahulugang maraming beses na itong naipasa.')],
          [me, S('Unknown sender, or forwarded many times? I check first!', 'Hindi kilala o maraming beses nang naipasa? Susuriin ko muna!')]
        ],
        3: [
          [ex, S('Some messages are too scary, or too good to be true. Those are rumour clues too.', 'May mga mensaheng sobrang nakakatakot, o masyadong maganda para maging totoo. Palatandaan din iyon ng tsismis.')],
          [me, S('A free prize just for sharing? I will check first!', 'Libreng premyo dahil lang sa pagbabahagi? Susuriin ko muna!')]
        ],
        4: [
          [ex, S('Now think about what to do at home. Swipe right for Do it, and left for Don\'t.', 'Isipin naman kung ano ang gagawin sa bahay. I-swipe pakanan para Gawin, at pakaliwa para Huwag.')],
          [me, S('I stay inside with my family, away from the windows!', 'Mananatili ako sa loob kasama ang pamilya, malayo sa bintana!')]
        ],
        5: [
          [ex, S('Everything together now, and each card has a timer. If time runs out, it counts as Check first.', 'Lahat na nang sabay, at may oras ang bawat card. Kapag naubos ang oras, Suriin muna ang bilang.')],
          [me, S("I'll be quick, but I'll stay calm and careful.", 'Bibilisan ko, pero kalmado at maingat pa rin.')]
        ]
      }[Math.min(5, Math.max(1, ctx.world))];
      return lines.map(([speaker, text]) => ({ speaker, text }));
    },

    /** AGILA holds up her sign to show the two sides; the heroes point instead. */
    tutorial(ctx) {
      const pose = AG.chars.get(ctx.characterId).agila ? 'prop_on_sign_geared' : 'pose_point';
      const actions = ctx.world === 4;
      const lines = [
        actions
          ? S('My sign has two sides: **DO IT ✔** and **DON\'T ✋**.', 'Dalawa ang panig ng karatula ko: **GAWIN ✔** at **HUWAG ✋**.')
          : S('My sign has two sides: **SHARE ✔** and **CHECK FIRST ✋**.', 'Dalawa ang panig ng karatula ko: **IBAHAGI ✔** at **SURIIN MUNA ✋**.'),
        actions
          ? S('Safe at home? Send it **right**: **→**, **D**, swipe right, or tap **✔ Do it**.', 'Ligtas sa bahay? Ipadala **pakanan**: **→**, **D**, i-swipe pakanan, o i-tap ang **✔ Gawin**.')
          : S('Trusted? Send it **right**: **→**, **D**, swipe right, or tap **✔ Follow / Share**.', 'Mapagkakatiwalaan? Ipadala **pakanan**: **→**, **D**, i-swipe pakanan, o i-tap ang **✔ Sundin / Ibahagi**.'),
        actions
          ? S('Not safe? Send it **left**: **←**, **A**, swipe left, or tap **✋ Don\'t**.', 'Hindi ligtas? Ipadala **pakaliwa**: **←**, **A**, i-swipe pakaliwa, o i-tap ang **✋ Huwag**.')
          : S('A rumour? Send it **left**: **←**, **A**, swipe left, or tap **✋ Check first**.', 'Tsismis? Ipadala **pakaliwa**: **←**, **A**, i-swipe pakaliwa, o i-tap ang **✋ Suriin muna**.'),
        S('Rumour clues: **ALL CAPS**, **no source**, **"forward this!"**, **too scary** or **too good to be true**.', 'Palatandaan ng tsismis: **puro malalaking titik**, **walang pinagmulan**, **"ipasa ito!"**, **sobrang nakakatakot** o **masyadong maganda**.'),
        S('Keep the **calm meter** high. Press **Enter** to skip an explanation.', 'Panatilihing mataas ang **kalmado**. Pindutin ang **Enter** para laktawan ang paliwanag.')
      ];
      return lines.map((text, i) => ({ text, pose: i < 3 ? pose : undefined }));
    },

    mount(stage, ctx, done) {
      let scene = null, dead = false;
      const loading = AG.util.h('p', { class: 'ag-loading' }, AG.t('ov.loading'));
      stage.append(loading);
      AG.data.load('check-before-share', 'data/cards.json').then(data => {
        if (dead) return;
        loading.remove();
        scene = new CS.Scene(stage, ctx, done, data);
        if (AG.debug.on) CS.live = { scene }; // ?debug=1: scripted browser checks
      }).catch(err => {
        console.error(err);
        if (!dead) loading.textContent = AG.t('sh.loadFailed', { msg: err.message });
      });
      return () => { dead = true; if (scene) scene.destroy(); };
    }
  };
})(window.AG);
