/* Fire Escape Maze — STOP, DROP and ROLL (World 4 embers). Movement freezes and a close-up
 * panel shows the player's side-view rig.
 *
 *   AG.fireEscape.SDR — the pure steps (tested in fire-escape.test.js):
 *     const s = new SDR(tuning.qte); s.input('stop' | 'drop' | 'left' | 'right') → 'stop' | 'drop' | 'roll' | 'success' | null
 *     s.update(dtSeconds) → 'fail' | null      s.phase: 'stop' → 'drop' → 'roll' → 'done'
 *   STOP within 1.5 s (S / tap STOP) → DROP within 1.5 s (D / tap DROP) → ROLL: four
 *   alternating ←/→ presses or swipes within 3 s. A wrong key is ignored; only the clock fails.
 *
 *   AG.fireEscape.SDRQuickTime — the panel (DOM, built by the scene):
 *     const q = new SDRQuickTime(stage, ctx, { onEnd(ok) }); q.update(dt); q.destroy()
 * The scene turns S and D into STOP / DROP only while the panel is open (the mover is
 * disabled then, so they are movement everywhere else). */
(function (root) {
  const AG = root.AG = root.AG || {};
  const FE = AG.fireEscape = AG.fireEscape || {};
  const S = (en, fil) => ({ en, fil });

  class SDR {
    constructor(t) {
      t = t || {};
      this.t = { stopMs: t.stopMs || 1500, dropMs: t.dropMs || 1500, rollMs: t.rollMs || 3000, rolls: t.rolls || 4 };
      this.phase = 'stop'; this.left = this.t.stopMs; this.rolls = 0; this.last = null;
    }
    get total() { return this.t[this.phase + 'Ms'] || 1; }
    input(act) {
      if (this.phase === 'stop' && act === 'stop') { this.phase = 'drop'; this.left = this.t.dropMs; return 'stop'; }
      if (this.phase === 'drop' && act === 'drop') { this.phase = 'roll'; this.left = this.t.rollMs; return 'drop'; }
      if (this.phase === 'roll' && (act === 'left' || act === 'right') && act !== this.last) {
        this.last = act; this.rolls++;
        if (this.rolls >= this.t.rolls) { this.phase = 'done'; return 'success'; }
        return 'roll';
      }
      return null;
    }
    update(dt) {
      if (this.phase === 'done' || this.phase === 'failed') return null;
      this.left -= dt * 1000;
      if (this.left <= 0) { this.phase = 'failed'; return 'fail'; }
      return null;
    }
  }

  const STR = {
    title: S('A spark landed on your clothes!', 'May tilamsik sa damit mo!'),
    stop: S('STOP', 'HINTO'), drop: S('DROP', 'DAPA'), roll: S('ROLL', 'GULONG'),
    tellStop: S("Stop! Don't run.", 'Huminto! Huwag tumakbo.'),
    tellDrop: S('Drop to the floor and cover your face.', 'Dumapa sa sahig at takpan ang mukha.'),
    tellRoll: S('Roll from side to side!', 'Gumulong pakaliwa at pakanan!'),
    rolls: S('Rolls {n} / {of}', 'Gulong {n} / {of}')
  };
  const CSS = `
#ag-app .fe-qte { position: absolute; inset: 0; z-index: 7; display: grid; place-items: center; background: rgba(20, 12, 58, .72); padding: 10px; touch-action: none; }
#ag-app .fe-qte__box { display: grid; gap: 8px; justify-items: center; width: min(420px, 100%); padding: 12px; background: var(--panel); color: var(--fg); border: var(--b) solid var(--ink); box-shadow: 6px 6px 0 rgba(0,0,0,.45); border-radius: var(--r); text-align: center; }
#ag-app .fe-qte__box h3 { margin: 0; font-family: var(--font-display); font-size: var(--step-1); }
#ag-app .fe-qte__fig { width: 192px; height: 128px; image-rendering: pixelated; background: #fff4cc; border: 2px solid #1e1538; }
#ag-app .fe-qte__steps { display: flex; gap: 6px; margin: 0; padding: 0; list-style: none; }
#ag-app .fe-qte__steps li { padding: 2px 10px; font-family: var(--font-display); font-weight: 700; border: 2px solid var(--ink); background: var(--panel-2); color: var(--muted); }
#ag-app .fe-qte__steps li[aria-current="step"] { background: var(--hat); color: #1e1538; }
#ag-app .fe-qte__steps li.is-done { background: #dff7e3; color: #1e1538; }
#ag-app .fe-qte__steps li.is-done::before { content: "✔ "; }
#ag-app .fe-qte__tell { margin: 0; font-weight: 800; min-height: 1.4em; }
#ag-app .fe-qte__bar { width: 100%; height: 10px; border: 2px solid #1e1538; background: #fff; }
#ag-app .fe-qte__bar i { display: block; height: 100%; background: var(--vest); }
#ag-app .fe-qte__btns { display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; align-items: center; }
#ag-app .fe-qte__btns .ag-btn { min-width: 64px; min-height: 52px; }
#ag-app .fe-qte__btns .ag-btn[hidden] { display: none; }`;

  class SDRQuickTime {
    constructor(stage, ctx, o) {
      const { h } = AG.util;
      if (!document.querySelector('style[data-ag-css="fire-escape-qte"]')) document.head.append(h('style', { 'data-ag-css': 'fire-escape-qte' }, CSS));
      this.stage = stage; this.ctx = ctx; this.onEnd = o.onEnd; this.sdr = new SDR(FE.tuning.qte);
      this.offs = []; this.ended = false;
      this.rig = new AG.CharacterRig(stage, ctx.characterId, 'side', { height: 48 });
      this.rig.play('alert');
      this.cv = h('canvas', { class: 'fe-qte__fig ag-px', width: 96, height: 64, 'aria-hidden': 'true' });
      this.g = this.cv.getContext('2d'); this.g.imageSmoothingEnabled = false;
      this.steps = ['stop', 'drop', 'roll'].map(k => h('li', { 'data-step': k }, AG.pick(STR[k])));
      this.tell = h('p', { class: 'fe-qte__tell', 'aria-live': 'assertive' });
      this.bar = h('i');
      const btn = (label, act, prompt) => {
        const b = h('button', { class: 'ag-btn', type: 'button', 'data-act': act }, label);
        b.addEventListener('click', () => this.act(act));
        return [AG.input.promptIcon(prompt), b];
      };
      this.btns = {
        stop: btn(AG.pick(STR.stop), 'stop', { keys: ['key_s'], gesture: 'gesture_tap' }),
        drop: btn(AG.pick(STR.drop), 'drop', { keys: ['key_d'], gesture: 'gesture_tap' }),
        left: btn('◀', 'left', { keys: ['key_left'], gesture: 'gesture_swipe_left' }),
        right: btn('▶', 'right', { keys: ['key_right'], gesture: 'gesture_swipe_right' })
      };
      this.el = h('div', { class: 'fe-qte', role: 'dialog', 'aria-label': AG.pick(STR.title) },
        h('div', { class: 'fe-qte__box' }, h('h3', {}, AG.pick(STR.title)), this.cv,
          h('ol', { class: 'fe-qte__steps' }, this.steps), this.tell, h('div', { class: 'fe-qte__bar' }, this.bar),
          h('div', { class: 'fe-qte__btns' }, Object.values(this.btns).flat())));
      stage.append(this.el);

      AG.input.register('QTE_STOP', { keys: ['KeyS'] });
      AG.input.register('QTE_DROP', { keys: ['KeyD'] });
      const on = (action, act) => this.offs.push(AG.input.on(action, e => { if (e.phase === 'down') this.act(act); }));
      on('QTE_STOP', 'stop'); on('QTE_DROP', 'drop'); on('LEFT', 'left'); on('RIGHT', 'right');
      this.offs.push(AG.input.onPointer('swipe', e => { if (e.dir === 'left' || e.dir === 'right') this.act(e.dir); }));
      AG.sfx.play('fire-escape.sfx.qte');
      this.render();
      stage.focus({ preventScroll: true });
    }
    act(a) {
      if (this.ended) return;
      const r = this.sdr.input(a);
      if (!r) return;
      AG.sfx.play('tap');
      if (r === 'stop') this.rig.play('stop');
      else if (r === 'drop') this.rig.play('duck_cover');
      else { this.rig.play('slide', { restart: true }); this.rig.setFacing(a === 'left' ? 'left' : 'right'); }
      if (r === 'success') return this.finish(true);
      this.render();
    }
    render() {
      const ph = this.sdr.phase, order = ['stop', 'drop', 'roll'], i = order.indexOf(ph);
      this.steps.forEach((li, j) => { li.classList.toggle('is-done', j < i || ph === 'done'); if (j === i) li.setAttribute('aria-current', 'step'); else li.removeAttribute('aria-current'); });
      const tell = { stop: STR.tellStop, drop: STR.tellDrop, roll: STR.tellRoll }[ph];
      let text = tell ? AG.pick(tell) : '';
      if (ph === 'roll') text += ' ' + AG.pick(STR.rolls).replace('{n}', this.sdr.rolls).replace('{of}', this.sdr.t.rolls);
      this.tell.textContent = text;
      const show = { stop: ph === 'stop', drop: ph === 'drop', left: ph === 'roll', right: ph === 'roll' };
      for (const k in this.btns) this.btns[k].forEach(n => { n.hidden = !show[k]; });
    }
    update(dt) {
      if (this.ended) return;
      if (this.sdr.update(dt) === 'fail') { this.finish(false); return; }
      this.bar.style.width = Math.max(0, Math.round(this.sdr.left / this.sdr.total * 100)) + '%';
      const g = this.g, t = performance.now() / 1000;
      g.fillStyle = '#fff4cc'; g.fillRect(0, 0, 96, 64);
      g.fillStyle = '#c9b48a'; g.fillRect(0, 56, 96, 8);
      this.rig.draw(g, 48, 56, t);
    }
    finish(ok) {
      this.ended = true;
      this.rig.play(ok ? 'cheer' : 'oops');
      this.update = () => {};
      setTimeout(() => { this.destroy(); this.onEnd(ok); }, ok ? 450 : 250);
    }
    destroy() {
      this.offs.forEach(f => f()); this.offs = [];
      AG.input.register('QTE_STOP', { keys: [] }); AG.input.register('QTE_DROP', { keys: [] });
      this.el.remove();
    }
  }

  FE.SDR = SDR;
  FE.SDRQuickTime = SDRQuickTime;
  FE.SDR_STR = STR;
  if (typeof module !== 'undefined') module.exports = SDR;
})(typeof window !== 'undefined' ? window : globalThis);
