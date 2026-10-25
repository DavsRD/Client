/* Water Ways: the heat check between levels (about 10 s).
 *
 *   const hc = new AG.waterWays.HeatCheck(stage, ctx, { rig, seed, onDone(perfect) });
 *   hc.relabel()   hc.destroy()
 *
 * A panel over the stage: the player's portrait with the heat meter, and three choices
 * (💧 drink water, 🧢 rest in the shade, 🥤 soda under the sun). Pick the two safe ones, then
 * confirm. Keys: 1 / 2 / 3 toggle, Enter confirms. Touch / mouse: tap the cards, then ✔.
 * When the time runs out, whatever is picked counts. The portrait starts worried (AGILA's
 * sweat drop) and turns happy after the right choices. */
window.AG = window.AG || {};
(function (AG) {
  const { h } = AG.util;
  const WW = AG.waterWays, T = WW.tuning;
  const S = (en, fil) => ({ en, fil });

  const STR = {
    title: S("It's so hot!", 'Ang init!'),
    q: S('How do you stay safe in the heat? Pick the 2 best choices.', 'Paano ka mananatiling ligtas sa init? Piliin ang 2 pinakamabuting gawin.'),
    confirm: S('Done', 'Tapos na'),
    water: S('Drink water', 'Uminom ng tubig'),
    shade: S('Rest in the shade', 'Magpahinga sa lilim'),
    soda: S('Drink soda under the sun', 'Uminom ng soft drinks sa ilalim ng araw'),
    right: S('Yes! Drink water and rest in the shade to stay cool.', 'Tama! Uminom ng tubig at magpahinga sa lilim para manatiling presko.'),
    soda1: S('Soda and the hot sun make you thirstier. Water and shade keep you cool.', 'Lalo kang mauuhaw sa soft drinks at sa init ng araw. Tubig at lilim ang nagpapapresko.'),
    both: S('Both help: drink water AND rest in the shade.', 'Pareho silang nakatutulong: uminom ng tubig AT magpahinga sa lilim.'),
    time: S('Remember: in the heat, drink water and rest in the shade.', 'Tandaan: sa init, uminom ng tubig at magpahinga sa lilim.'),
    meter: S('Heat', 'Init')
  };
  WW.HEAT_STR = STR;

  class HeatCheck {
    constructor(stage, ctx, o) {
      this.stage = stage; this.ctx = ctx; this.o = o; this.offs = [];
      const rnd = AG.util.mulberry32(((o.seed >>> 0) ^ 0x4ea7) >>> 0);
      this.opts = AG.util.shuffle([
        { id: 'water', icon: 'water', ok: true }, { id: 'shade', icon: 'sunhat', ok: true }, { id: 'soda', icon: 'soda', ok: false }
      ], rnd);
      this.sel = this.opts.map(() => false);
      this.done = false;
      this.open();
    }
    open() {
      const o = this.o;
      o.rig.play('worried');
      this.choices = AG.kit.choices(this.opts.map(x => ({ text: STR[x.id], icon: x.icon, ok: x.ok })), (opt, i) => this.toggle(i), { label: STR.q, compact: true });
      this.choices.btns.forEach(b => { b.setAttribute('aria-pressed', 'false'); b.tabIndex = -1; });
      this.ring = AG.kit.timerRing({ size: 52 });
      this.ok = h('button', { type: 'button', class: 'ag-btn ww-heatok', tabindex: '-1' });
      this.ok.addEventListener('click', () => this.confirm());
      this.face = h('span', { class: 'ww-heatface', 'aria-hidden': 'true' });
      const meterSrc = AG.assets.url('water-ways.ui.heat_meter') || AG.assets.placeholderURL('water-ways.ui.heat_meter', 12, 48);
      const meter = h('img', { class: 'ag-px ww-heatmeter', src: meterSrc, width: 24, height: 96, alt: '', draggable: 'false' });
      meter.addEventListener('error', () => { meter.src = AG.assets.placeholderURL('water-ways.ui.heat_meter', 12, 48); }, { once: true });
      this.titleEl = h('h3', {}); this.qEl = h('p', {});
      this.panel = h('div', { class: 'ag-overlay ww-heat', role: 'dialog' },
        h('div', { class: 'ag-box' }, this.titleEl,
          h('div', { class: 'ww-heatrow' },
            h('div', { class: 'ww-heatme' }, this.face, h('span', { class: 'ww-heatgauge' }, meter, h('i', { class: 'ww-heatfill' }))),
            h('div', { class: 'ww-heatq' }, this.qEl, this.choices.el)),
          h('div', { class: 'ww-heatfoot' }, this.ring.el, AG.input.promptIcon({ keys: ['key_1', 'key_2', 'key_3'], gesture: 'gesture_tap' }),
            h('span', { class: 'ww-tool' }, AG.input.promptIcon({ keys: ['key_enter'], gesture: 'gesture_tap' }), this.ok))));
      this.stage.append(this.panel);
      this.relabel();
      this.syncFace();
      // Enter confirms (the cards are toggled with 1 / 2 / 3 or a tap)
      this.offs.push(AG.input.on('CONFIRM', e => { if (e.phase === 'down' && e.event && e.event.code !== 'Space') this.confirm(); }));
      this.ring.run(T.heat.ms, () => this.confirm(true));
      AG.sfx.play('blip');
      // keep focus on the stage, so Enter is the game's confirm and not a card's click
      setTimeout(() => { if (!this.dead) this.stage.focus({ preventScroll: true }); }, 0);
    }
    relabel() {
      if (!this.panel) return;
      this.panel.setAttribute('aria-label', AG.pick(STR.title));
      this.titleEl.textContent = '🥵 ' + AG.pick(STR.title);
      this.qEl.textContent = AG.pick(STR.q);
      this.ok.textContent = '✔ ' + AG.pick(STR.confirm);
      this.choices.btns.forEach((b, i) => { const t = b.querySelector('.ag-txt'); if (t) t.textContent = AG.pick(STR[this.opts[i].id]); });
    }
    syncFace() { this.face.replaceChildren(this.o.rig.img(2)); }
    toggle(i) {
      if (this.done) return;
      this.sel[i] = !this.sel[i];
      const b = this.choices.btns[i];
      b.classList.toggle('is-on', this.sel[i]);
      b.setAttribute('aria-pressed', String(this.sel[i]));
      AG.sfx.play('tap');
      this.stage.focus({ preventScroll: true });
    }
    confirm(timeUp) {
      if (this.done || this.dead) return;
      this.done = true;
      this.ring.stop(); this.choices.lock();
      const picked = this.opts.filter((x, i) => this.sel[i]);
      const perfect = picked.length === 2 && picked.every(x => x.ok);
      this.opts.forEach((x, i) => { if (x.ok) this.choices.btns[i].classList.add('right'); else if (this.sel[i]) this.choices.mark(i, false); });
      if (perfect) {
        this.o.rig.play('happy');
        AG.sfx.play('good');
        this.ctx.safe();
        this.ctx.say('success', STR.right);
      } else {
        const soda = picked.some(x => !x.ok);
        this.ctx.say(soda ? 'retry' : timeUp && !picked.length ? 'instruction' : 'encouragement', soda ? STR.soda1 : timeUp && !picked.length ? STR.time : STR.both);
        AG.sfx.play('soft');
      }
      this.syncFace();
      this.ctx.after(perfect ? 1600 : 2600, () => { if (!this.dead) this.o.onDone(perfect); });
    }
    destroy() {
      this.dead = true;
      if (this.ring) this.ring.stop();
      if (this.choices) this.choices.destroy();
      this.offs.forEach(f => f()); this.offs = [];
      if (this.panel) this.panel.remove();
    }
  }

  WW.HeatCheck = HeatCheck;
})(window.AG);
