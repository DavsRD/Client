/* 03 Wave Runner: the warning at the start of every run. The beach shows ONE seeded natural warning (the ground shakes, the sea pulls back
 * and shows the fish, or a loud roar) while the player's character plays "alert". A big RUN button (or Enter / Space / a tap) appears at the
 * start of the warning; the time to press it is the reaction time (the faster, the bigger the head start). No press in 4 s: the run starts alone
 * with the base gap and the role expert says "Don't wait — run!". It draws on the scene's own canvas; WaveRunnerScene starts the chase in onRun. */
window.AG = window.AG || {};
(function (AG) {
  const { h } = AG.util;
  const WR = AG.waveRunner, T = WR.tuning;
  const S = en => ({ en });
  const K = 'wave-runner.';

  const WARN = {
    shake: {
      banner: S('THE GROUND IS SHAKING!'), sub: S('Strong shaking near the sea: RUN!'), caption: S('(the ground rumbles)'),
      say: S('The ground is shaking hard! Near the sea, that can mean a tsunami is coming. **Run to high ground now!**')
    },
    retreat: {
      banner: S('THE SEA IS PULLING BACK!'), sub: S('Never walk toward it!'), caption: S('(the sea rushes away)'),
      say: S('The sea is pulling back and fish are on the sand. That is a **tsunami warning**! Never walk toward the sea. **Run uphill!**')
    },
    roar: {
      banner: S('A LOUD ROAR!'), sub: S('That sound is a wave coming!'), caption: S('(a loud roar!)'),
      say: S('That loud roar is a tsunami coming in! Do not wait for anything else. **Run to high ground now!**')
    }
  };
  const DONT_WAIT = S("Don't wait — run!");

  class IntroScene {
    /** { stage, ctx, view, rig, warning, onRun(reactionSec | null, auto) } */
    constructor(o) {
      this.o = o; this.ctx = o.ctx; this.stage = o.stage; this.rig = o.rig;
      this.kind = WARN[o.warning] ? o.warning : 'shake';
      this.reduce = AG.reducedMotion();
      this.clock = 0; this.lastStep = performance.now(); this.shownAt = null; this.pressed = false; this.done = false; this.offs = [];
      this.flash = 0;
      this.btn = h('button', { class: 'ag-btn ag-btn--big wr-run', type: 'button', hidden: true }, '▶ ' + 'RUN!');
      this.btn.addEventListener('click', e => { e.stopPropagation(); this.press(false); });
      this.over = h('div', { class: 'wr-over' }, this.btn);
      o.box.append(this.over);
      this.offs.push(
        AG.input.on('CONFIRM', e => { if (e.phase === 'down') this.press(false); }),
        AG.input.onPointer('down', () => this.press(false))
      );
      this.rig.play('alert');
    }
    get shown() { return this.shownAt != null; }

    update(dt) {
      if (this.done) return;
      this.clock += dt; this.lastStep = performance.now();
      if (this.shownAt == null && this.clock * 1000 >= T.introMs.warnAt) this.begin();
      if (this.shown && !this.pressed && (this.clock - this.shownAt) * 1000 >= T.autoMs) this.press(true);
    }
    /** The warning starts: sound, banner, the expert, and the RUN button. */
    begin() {
      const W = WARN[this.kind];
      this.shownAt = this.clock;
      this.btn.hidden = false;
      AG.kit.banner(this.stage, W.banner, W.sub, 2600);
      this.caption = { text: W.caption, until: this.clock + 2.6 };
      if (this.kind === 'roar') AG.sfx.play(K + 'sfx.roar', { volume: 0.9 });
      else if (this.kind === 'shake') AG.sfx.play(K + 'sfx.roar', { volume: 0.3 });
      else this.rush = AG.sfx.loop(K + 'sfx.rush_loop', { volume: 0.35 });
      this.ctx.say('warning', W.say, { pose: AG.rig.resolve(this.ctx.expertId, 'alert').frame });
    }
    /** RUN: the reaction time is how long the button has been up. auto = nobody pressed in 4 s. */
    press(auto) {
      if (this.pressed || !this.shown || this.done) return;
      this.pressed = true;
      const late = Math.min(0.05, (performance.now() - this.lastStep) / 1000); // the press came between two frames
      const reaction = auto ? null : Math.max(0, this.clock - this.shownAt + late);
      if (auto) this.ctx.say('warning', DONT_WAIT, { pose: AG.rig.resolve(this.ctx.expertId, 'point').frame });
      this.finish(reaction, auto);
    }
    finish(reaction, auto) {
      this.done = true;
      if (this.rush) { this.rush.stop(); this.rush = null; }
      this.btn.hidden = true;
      this.o.onRun(reaction, auto);
    }

    /* ---------- drawing ---------- */
    draw(c) {
      const t = this.clock, since = this.shown ? t - this.shownAt : 0, K_ = this.kind, A = AG.assets;
      const jitter = !this.reduce && K_ === 'shake' && this.shown ? (Math.floor(t * 30) % 2 ? 2 : -2) : 0;
      c.save();
      c.translate(jitter, 0);
      A.draw(c, K + 'intro.calm', 0, 0, 480, 270);
      if (this.shown) {
        if (K_ === 'shake') A.draw(c, K + 'intro.shake', 0, 0, 480, 270);
        else if (K_ === 'retreat') {
          // the water slides away: the wet seabed shows from the right, the sea edge moving left
          const p = Math.min(1, since * 1000 / T.introMs.retreatMs), edge = Math.round(220 * (1 - p));
          A.draw(c, K + 'intro.retreat', 0, 0, 480, 270);
          if (edge > 0) { c.save(); c.beginPath(); c.rect(0, 0, edge, 270); c.clip(); A.draw(c, K + 'intro.calm', 0, 0, 480, 270); c.restore(); }
        } else { // roar: the storm light comes in over about a second
          c.globalAlpha = this.reduce ? 1 : Math.min(1, since / 1.2);
          A.draw(c, K + 'intro.roar', 0, 0, 480, 270);
          c.globalAlpha = 1;
        }
      }
      this.rig.play('alert');
      this.rig.setFacing('right');
      this.rig.draw(c, 300, 238, performance.now() / 1000);
      c.restore();
      if (this.caption && this.caption.until > t) this.label(c, this.caption.text, 240, 252, { size: 10, align: 'center', color: '#e6e2ff' });
    }
    label(c, str, x, y, o) {
      o = Object.assign({ size: 12, color: '#fff' }, o);
      for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, 1], [-1, 1], [1, -1]]) AG.gfx.text(c, str, x + dx, y + dy, Object.assign({}, o, { color: '#1e1538' }));
      AG.gfx.text(c, str, x, y, o);
    }
    destroy() {
      this.done = true;
      if (this.rush) this.rush.stop();
      this.offs.forEach(f => f()); this.offs = [];
      this.over.remove();
    }
  }

  Object.assign(WR, { IntroScene, WARN });
})(window.AG);
