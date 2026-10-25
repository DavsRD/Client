/* 18 Lunch Table Logic (lunch-table) — Bullying & Peer Violence · social · expert COMMS (AGILA if the player is Comms).
 * courses.html?hazard=bullying#game, play route #play/<level>.
 *
 *   L1 classroom groups (4 students)   L2 the canteen (8, with an aisle seat)   L3 field-trip bus (pairs, seat buddies)
 *   L4 picking fair teams              L5 the class group chat (project groups + cyberbullying moments)
 * Seat everyone so nobody is alone and every rule card shows ✔, then an Upstander Moment: include others, don't join
 * in, tell a trusted adult (online: screenshot, block, report). The seating rules are js/logic/lunch-table/rules.js,
 * the solver that proves every level (and gives hints) is solver.js, one level = LunchTableScene.js, the moments =
 * Upstander.js, numbers and scoring = tuning.js. Content is JSON: levels.json, data/rules.json, data/upstander.json
 * (and the students, in assets/games/lunch-table/data/students.json). Nobody is ever drawn or described as mean.
 *
 * Keys: Tab tray ↔ seats ↔ rules · arrows · Enter pick up / place (swap) · Esc put back · Backspace undo · H hint ·
 * Upstander ↑ / ↓ + Enter or 1–3. Touch / mouse: drag a student to a seat, or tap, then tap; ↶ and 💡. */
window.AG = window.AG || {};
(function (AG) {
  const LT = AG.lunchTable;
  const S = en => ({ en });

  AG.games['lunch-table'] = {
    id: 'lunch-table',
    takeaway: S("Be an upstander: include others, don't join in, and tell a trusted adult."),
    learn: [
      S('Include others. Invite someone who is alone to sit or play with you, so nobody is left out.'),
      S('Everybody has hard days. When classmates need space, give it, and let a trusted adult help them talk it out.'),
      S("Be an upstander: don't laugh along or pass on unkind messages. Stand with the person who is hurt, and tell a trusted adult."),
      S("Online: don't reply, react or forward. Take a screenshot, block and report, and show a trusted adult.")
    ],
    badges: [
      { id: 'upstander', name: S('Upstander'), icon: 'heart', desc: S('Choose the best upstander action on the first try, 15 times.') },
      { id: 'everyone-included', name: S('Everyone Included'), icon: 'star', desc: S('Earn 3 stars on the canteen level.') },
      { id: 'fair-play', name: S('Fair Play'), icon: 'check', desc: S('Pick fair teams on the team-picking level.') }
    ],
    characterActions: ['idle', 'think', 'happy', 'worried', 'cheer'],

    intro(ctx) {
      const ex = ctx.expertId, me = ctx.characterId, point = AG.rig.resolve(ex, 'point').frame;
      const E = text => ({ speaker: ex, text: S(text), pose: point }), M = text => ({ speaker: me, text: S(text) });
      const lines = {
        1: [E('Welcome to Lunch Table Logic! Our job is to make sure **nobody is left out**.'), M('How do I do that?'),
          E('Seat every classmate, follow the rule cards, and watch the faces. A smile means a happy classmate.')],
        2: [E('The canteen is busy! Some classmates need a little space today, and a teacher is helping them.'), M('I will make room for everyone.'),
          E('A seat marked ♿ is at the end of a row, where there is room for a wheelchair.')],
        3: [E('On the bus, seats come in pairs. Seat buddies sit side by side, and nobody rides alone.'), M('Everyone gets a buddy!')],
        4: [E('When we pick teams, **nobody should be picked last**.'), M('Then let\'s make the teams fair and fun!'),
          E('Add up the ⭐ on each team. The two totals should be close.')],
        5: [E('Now we are in the class group chat. Kindness counts online, too.'), M('What if something unkind shows up?'),
          E("Be an upstander: don't react or forward it. Take a screenshot, block and report, and tell a trusted adult.")]
      };
      return lines[ctx.level] || lines[1];
    },

    tutorial(ctx) {
      const types = new Set(((ctx.levelData && ctx.levelData.rules) || []).map(r => r.type));
      const out = [
        S('Seat every student so **nobody is left alone**. Each rule card shows ✔ when it is met and ✖ when it is not.'),
        S('Keys: **Tab** jumps between the waiting area, the seats and the rules. **Arrows** move, **Enter** picks a student up and places them (a seated student swaps). **Esc** puts them back, **Backspace** undoes, **H** gives a hint.'),
        S('Touch: **drag** a student to a seat, or tap a student, then tap a seat. Tap a seated student to lift them again. **↶** undoes and **💡** gives a hint.')
      ];
      if (types.has('apart')) out.push(S('When classmates had a hard morning, we **give them space**. A teacher is helping them talk it out.'));
      if (types.has('accessibleSeat')) out.push(S('A seat marked ♿ is at the end of a row, with room for a wheelchair.'));
      if (types.has('fairTeams')) out.push(S('Add up the ⭐ on each team. The totals can differ by only a little, so the game is fair.'));
      out.push(S('When the table is happy, an **Upstander moment** comes up. Pick the kindest choice. You can try again!'));
      return out;
    },

    mount(stage, ctx, done) {
      let scene = null, dead = false;
      Promise.all([AG.assets.ready(), AG.data.load('lunch-table', 'data/rules.json'), AG.data.load('lunch-table', 'data/upstander.json'), AG.data.asset('lunch-table', 'data/students.json')])
        .then(([, rules, moments, students]) => {
          if (dead) return;
          if (!ctx.levelData) throw new Error('Level ' + ctx.level + ' is missing from levels.json');
          scene = new LT.Scene(stage, ctx, done, { level: ctx.levelData, students, rules, moments });
          if (AG.debug.on) LT.live = { scene }; // ?debug=1: scripted checks
        })
        .catch(err => { console.error(err); stage.append(AG.util.h('p', { class: 'ag-loading' }, AG.t('sh.loadFailed', { msg: err.message }))); });
      return () => { dead = true; if (scene) scene.destroy(); };
    }
  };
})(window.AG);
