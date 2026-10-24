/* "Tap the Stars" (_sandbox) — the debug-only test game from GOVERNING. Not a real game and
 * never listed for pupils: courses.html?hazard=earthquake&debug=1#play/1-1.
 *
 * 10 pixel stars drift on a 480×270 canvas. Arrows move the cursor to the nearest star in
 * that direction, Enter/Space grabs it; or tap a star. 30 s per level (less on later worlds
 * and Advanced). It exercises the shell: AG.input (keys, D-pad, taps, live prompt icons),
 * the rig (the player runs to the cursor, reacts happy / oops), a deliberately missing
 * image (a labelled placeholder), word boxes from the player and the role expert, results,
 * XP into the site, pause, focus mode and lazy loading. */
(function (AG) {
  const { h } = AG.util;
  const S = (en, fil) => ({ en, fil });

  AG.games._sandbox = {
    id: '_sandbox',
    takeaway: S('Every safe choice counts, one star at a time.', 'Mahalaga ang bawat ligtas na pasya, isang bituin sa bawat pagkakataon.'),
    learn: [S('The arrow keys, the D-pad and tapping all do the same thing.', 'Pareho ang gawa ng arrow keys, D-pad at pag-tap.'),
      S('Your character runs, cheers and talks in every game.', 'Tumatakbo, nagdiriwang at nagsasalita ang karakter mo sa bawat laro.')],
    badges: [{ id: 'speedy', name: S('Speedy Stars', 'Mabilis na Bituin'), icon: 'star', desc: S('Catch all 10 stars with half the time left.', 'Kunin ang 10 bituin na may kalahati pang oras.') }],
    characterActions: ['idle', 'run', 'happy', 'oops', 'cheer'],
    tutorial: () => [
      S('Move the yellow cursor with the arrow keys or the D-pad, or just tap a star.', 'Igalaw ang dilaw na cursor gamit ang arrow keys o D-pad, o i-tap lang ang bituin.'),
      S('Press **Enter** to grab the star under the cursor.', 'Pindutin ang **Enter** para kunin ang bituin sa ilalim ng cursor.'),
      S('Grab all 10 stars before the time runs out!', 'Kunin ang lahat ng 10 bituin bago maubos ang oras!')
    ],

    mount(stage, ctx, done) {
      stage.classList.add('flush');
      const g = AG.gfx.canvas(480, 270);
      stage.append(g.cv);
      AG.input.setView(g);
      AG.input.pointerMode('tap');
      AG.input.repeat('LEFT'); AG.input.repeat('RIGHT'); AG.input.repeat('UP'); AG.input.repeat('DOWN');

      const N = 10;
      const total = Math.max(15, 30 - (ctx.world - 1) * 2 - (ctx.difficulty === 'advanced' ? 5 : 0));
      const drift = (ctx.level - 1) * 5 + (ctx.world - 1) * 6 + (ctx.difficulty === 'advanced' ? 10 : 0);
      const rnd = AG.util.mulberry32(ctx.seed);
      const stars = Array.from({ length: N }, () => ({ x: 30 + rnd() * 410, y: 24 + rnd() * 150, vx: (rnd() - 0.5) * drift, vy: (rnd() - 0.5) * drift, got: false }));
      let cursor = 0, score = 0, caught = 0, misses = 0, left = total, ended = false, t = 0, saidHalf = false, lastMissMsg = 0;

      const hud = ctx.hud({ score: 0, label: S('Stars', 'Bituin'), timer: true });
      hud.set({ score, label: '0/' + N, timer: AG.ui.fmtTime(left) });
      ctx.controls.append(h('div', { class: 'ag-hint' },
        AG.input.promptIcon({ keys: ['key_left', 'key_right', 'key_up', 'key_down'], gesture: 'gesture_tap' }),
        AG.input.promptIcon({ keys: ['key_enter'], gesture: null }),
        h('span', {}, AG.pick(S('Grab every star', 'Kunin ang bawat bituin')))));
      const pad = AG.input.touchControls(ctx.controls, { dpad: true, buttons: [{ action: 'CONFIRM', label: S('Grab', 'Kunin') }] });

      const rig = ctx.rig('side');
      let px = 60, reactUntil = 0;
      // This key is not in the manifest on purpose: it must draw a labelled placeholder.
      AG.assets.image('_sandbox.bg.mountains');

      const live = () => stars.map((s, i) => [s, i]).filter(([s]) => !s.got);
      function nearestFrom(x, y) { let best = -1, bd = Infinity; live().forEach(([s, i]) => { const d = (s.x - x) ** 2 + (s.y - y) ** 2; if (d < bd) { bd = d; best = i; } }); return best; }
      function step(dx, dy) {
        const cur = stars[cursor]; let best = -1, bd = Infinity;
        live().forEach(([s, i]) => {
          if (i === cursor) return;
          const vx = s.x - cur.x, vy = s.y - cur.y, along = vx * dx + vy * dy;
          if (along <= 0) return;
          const d = along + Math.abs(vx * dy - vy * dx) * 2; // prefer stars straight ahead
          if (d < bd) { bd = d; best = i; }
        });
        if (best >= 0) { cursor = best; AG.sfx.play('tick'); }
      }
      function grab(i) {
        const s = stars[i]; if (!s || s.got || ended) return;
        s.got = true; caught++;
        score += 100 + Math.round(left * 5);
        AG.sfx.play('star'); ctx.safe();
        rig.play('happy', { restart: true }); reactUntil = t + 0.6;
        hud.set({ score, label: caught + '/' + N });
        if (caught === 1) { const line = ctx.characterLine(); ctx.say(line.style, line.text); }
        if (caught === 5 && !saidHalf) { saidHalf = true; ctx.say('info', S('Halfway there! In a real emergency, calm steps beat fast ones.', 'Kalahati na! Sa totoong emergency, mas mabuti ang kalmadong hakbang kaysa nagmamadali.')); }
        if (caught === N) return finish();
        cursor = nearestFrom(s.x, s.y);
      }
      function miss() {
        misses++; rig.play('oops', { restart: true }); reactUntil = t + 0.8;
        if (t - lastMissMsg > 4) { lastMissMsg = t; ctx.say('retry', S('No star there. Tap right on a star.', 'Walang bituin diyan. I-tap mismo ang bituin.')); }
      }

      const offs = [
        AG.input.on('LEFT', e => e.phase !== 'up' && step(-1, 0)),
        AG.input.on('RIGHT', e => e.phase !== 'up' && step(1, 0)),
        AG.input.on('UP', e => e.phase !== 'up' && step(0, -1)),
        AG.input.on('DOWN', e => e.phase !== 'up' && step(0, 1)),
        AG.input.on('CONFIRM', e => e.phase === 'down' && grab(cursor)),
        AG.input.onPointer('tap', ({ x, y }) => {
          let hit = -1, bd = 18 * 18;
          live().forEach(([s, i]) => { const d = (s.x + 9 - x) ** 2 + (s.y + 9 - y) ** 2; if (d < bd) { bd = d; hit = i; } });
          if (hit >= 0) { cursor = hit; grab(hit); } else miss();
        })
      ];
      ctx.say('instruction', S('Grab all 10 stars!', 'Kunin ang lahat ng 10 bituin!'));

      function finish() {
        if (ended) return; ended = true;
        const all = caught === N, fast = all && left >= total / 2;
        const stars3 = all ? (left > total * 0.3 ? 3 : 2) : caught >= 6 ? 1 : 0;
        rig.play(all ? 'cheer' : 'oops');
        done({
          won: caught >= 6, stars: stars3, score, timeMs: Math.round((total - left) * 1000),
          collectibles: [all, misses === 0, fast],
          detail: [{ label: S('Stars caught', 'Nakuhang bituin'), value: caught + '/' + N }, { label: S('Misses', 'Mintis'), value: misses }],
          message: all ? S('You caught every star!', 'Nakuha mo ang lahat ng bituin!') : S('Catch at least 6 stars to clear the level.', 'Kumuha ng kahit 6 na bituin para matapos ang antas.'),
          badgeEvents: fast ? ['speedy'] : []
        });
      }

      const stop = AG.gfx.loop(dt => {
        t += dt;
        if (!ended) {
          left = Math.max(0, left - dt);
          hud.set({ timer: AG.ui.fmtTime(left) });
          if (left <= 0) finish();
        }
        stars.forEach(s => {
          if (s.got) return;
          s.x += s.vx * dt; s.y += s.vy * dt;
          if (s.x < 8 || s.x > 454) s.vx *= -1;
          if (s.y < 16 || s.y > 180) s.vy *= -1;
          s.x = AG.util.clamp(s.x, 8, 454); s.y = AG.util.clamp(s.y, 16, 180);
        });
        if (stars[cursor] && stars[cursor].got) cursor = nearestFrom(px, 200);
        // the player runs under the cursor
        const target = stars[cursor] ? stars[cursor].x + 9 : px;
        const moving = Math.abs(target - px) > 3 && !ended;
        if (moving) { px += Math.sign(target - px) * Math.min(Math.abs(target - px), 90 * dt); rig.setFacing(target < px ? 'left' : 'right'); }
        if (t > reactUntil && !ended) rig.play(moving ? 'run' : 'idle');

        const c = g.ctx;
        AG.gfx.sky(c, 480, 270, ['#2b2266', '#3b2a8f', '#4f3fb0', '#6a5ad0', '#8a7fd6', '#a99ff0']);
        AG.assets.draw(c, '_sandbox.bg.mountains', 360, 12, 104, 56);
        c.fillStyle = '#3fa552'; c.fillRect(0, 214, 480, 56);
        c.fillStyle = '#2f8a4a'; for (let x = 0; x < 480; x += 8) c.fillRect(x, 214, 4, 4);
        stars.forEach((s, i) => {
          if (s.got) return;
          AG.gfx.drawIcon(c, 'star', s.x, s.y, 1);
          if (i === cursor) { c.strokeStyle = '#ff7a1a'; c.lineWidth = 3; c.strokeRect(Math.round(s.x) - 3.5, Math.round(s.y) - 3.5, 25, 25); }
        });
        rig.draw(c, px, 250, t);
        if (AG.reducedMotion() === false && ended && caught === N) AG.gfx.text(c, '★', px, 190, { size: 20, color: '#ffd23f', align: 'center' });
      });

      return () => { stop(); offs.forEach(f => f()); pad.destroy(); };
    }
  };
})(window.AG);
