/* Go Bag Tetris — CONVEYOR RUSH (levels 4–5): the items come one at a time on a belt, with the next two shown.
 * The front item is held for you at once: place it or toss it (X / 🗑) before its TimerRing runs out, or it falls
 * off the belt (an essential that falls off or is tossed is −100). Wind Signal No. 1 → 5 rises with the level
 * clock or the belt, whichever is further: the badge changes, the wind gets louder and each step takes 10 % off
 * the place time. No undo, but bag items can still be moved or tossed. When the belt is empty the bag zips up
 * (Pack it! waits while it is too heavy, on level 5). Plugs into GoBagScene.js:  new AG.goBag.ConveyorRush(scene). */
window.AG = window.AG || {};
(function (AG) {
  const { h } = AG.util;
  const GB = AG.goBag, T = GB.tuning, SC = GB.scoring;
  const K = 'go-bag-tetris.';
  const pick = v => AG.pick(v);

  const RSTR = {
    next: { en: 'Next' }, signal: { en: 'Signal No. {n}' },
    signalUp: { en: 'Wind Signal No. {n}! The wind is getting stronger. Keep packing!' },
    fell: { en: 'The {name} fell off the belt.' },
    fellNeed: { en: 'Oh no, the {name} fell off the belt! We needed that. Keep going!' },
    tossedNeed: { en: 'The {name} was something we needed! Make room for things like that next time.' },
    beltDone: { en: 'The belt is empty. Zipping up the bag!' },
    beltHeavy: { en: 'The belt is empty, but the bag is too heavy to carry! Take something out, then press **Pack it!**' },
    hintToss: { en: "The {name} won't help in a storm. Toss it! (🗑 or X)" },
    hintNoRoom: { en: 'No room for the {name}. Move things to make a gap, or it falls off.' },
    hintWait: { en: 'Wait for the next item on the belt.' }
  };

  class ConveyorRush {
    constructor(scene) {
      this.s = scene;
      const sp = scene.spec;
      this.queue = scene.pieces.slice();
      this.total = this.queue.length;
      this.front = null; this.doneN = 0; this.elapsed = 0; this.clockMs = sp.clockSec * 1000;
      this.signalN = 1; this.lefts = []; this.missed = new Set(); this.over = false;
      this.gapLeft = 700; this.limit = 1; this.left = 0; this.lastSec = 0; this.ringShown = -1;
    }

    build(root) {
      const s = this.s;
      this.ring = AG.kit.timerRing({ size: 56, segments: 20 });
      this.ringNum = h('b');
      this.ringEl = h('div', { class: 'gb-ring', 'aria-hidden': 'true' }, this.ring.el, this.ringNum);
      this.ring.set(0);
      this.nextItems = h('div', { class: 'gb-next__items' });
      this.nextEl = h('div', { class: 'gb-next', 'aria-hidden': 'true' }, h('span', {}, pick(RSTR.next).toUpperCase()), this.nextItems);
      const wrap = h('div', { class: 'gb-beltwrap' });
      s.shelfRow.insertBefore(wrap, s.tray.el);
      wrap.append(this.ringEl, s.tray.el, this.nextEl);
      this.shelf = s.tray.shelf;
      // the belt: frame 0 of the conveyor strip, tiled and slid in 1 px steps while an item rides in
      AG.assets.loadImage(K + 'conveyor').then(rec => {
        if (!rec.ok) return;
        const cv = P0(56, 20); const c = cv.getContext('2d'); c.imageSmoothingEnabled = false; AG.assets.draw(c, K + 'conveyor', 0, 0, 56, 20, 0);
        root.style.setProperty('--gb-belt', 'url("' + cv.toDataURL() + '")');
      });
      this.sigImg = h('img', { class: 'ag-px', alt: '', width: 32, height: 32, draggable: 'false' });
      this.sigTxt = h('span');
      this.sigEl = h('div', { class: 'gb-signal', role: 'status' }, this.sigImg, this.sigTxt);
      s.status.prepend(this.sigEl);
      this.setSignal(1, true);
    }
    start() {
      this.stopLoop = AG.gfx.loop(dt => this.step(dt * 1000));
      // a first key press (the item was auto-held while the last input was still "mouse"): the cursor goes to the bag
      this.offDevice = AG.on('ag:device', e => { const pl = this.s.play; if (e.detail && e.detail.device === 'keyboard' && pl.held && pl.zone !== 'board' && !this.s.ended) { pl.setZone('board'); pl.showGhost(); } });
      this.wind = AG.sfx.loop(K + 'sfx.wind_loop', { volume: T.rush.wind[0] });
      this.renderNext();
      // bag and belt on one screen: bring the stage up if its lower part is off the bottom
      const r = this.s.stage.getBoundingClientRect();
      if (r.bottom > window.innerHeight + 8 && r.top > 0) this.s.stage.scrollIntoView({ block: 'start', behavior: 'auto' });
    }

    /* ---------- the clock ---------- */
    step(ms) {
      if (this.over || this.s.ended) return;
      this.elapsed += ms;
      const n = SC.signal(this.elapsed, this.clockMs, this.doneN, this.total);
      if (n > this.signalN) this.setSignal(n);
      if (!this.front) { this.gapLeft -= ms; if (this.gapLeft <= 0) this.arrive(); return; }
      this.left -= ms;
      const v = Math.max(0, this.left / this.limit), seg = Math.ceil(v * 40);
      if (seg !== this.ringShown) { this.ringShown = seg; this.ring.set(v); }
      const sec = Math.max(0, Math.ceil(this.left / 1000));
      if (sec !== this.lastSec) { this.lastSec = sec; this.ringNum.textContent = sec; if (this.left <= T.rush.warnMs && sec > 0) AG.sfx.play('tick'); }
      if (this.left <= 0) this.timeout();
    }
    clockLeft() { return Math.max(0, this.clockMs - this.elapsed); }
    setSignal(n, quiet) {
      this.signalN = n;
      this.sigEl.dataset.n = n;
      this.sigImg.src = AG.assets.url(K + 'ui.signal_' + n) || AG.assets.placeholderURL('signal ' + n, 32, 32);
      this.sigTxt.textContent = GB.fmt(RSTR.signal, { n });
      if (this.wind) this.wind.volume(T.rush.wind[n - 1]);
      if (!quiet) this.s.ctx.say('warning', GB.fmt(RSTR.signalUp, { n }));
    }

    /* ---------- the belt ---------- */
    arrive() {
      const s = this.s;
      if (!this.queue.length) return this.finishBelt();
      const p = this.front = this.queue.shift();
      this.limit = this.left = SC.placeMs(s.spec.placeSec, this.signalN);
      this.lastSec = 0; this.ringShown = -1;
      s.tray.add(p);
      if (!AG.reducedMotion()) { p.el.classList.remove('gb-arrive'); void p.el.offsetWidth; p.el.classList.add('gb-arrive'); }
      this.shelf.classList.add('is-moving');
      clearTimeout(this.beltT); this.beltT = setTimeout(() => this.shelf.classList.remove('is-moving'), 360);
      this.renderNext();
      this.autoHold();
    }
    /** The front item is always held for you, unless you are moving something else (or put it down with Esc). */
    autoHold() {
      const s = this.s, pl = s.play, p = this.front;
      if (!p || s.ended || pl.held || !s.tray.has(p) || !pl.enabled) return;
      pl.pick(p, AG.input.lastDevice === 'touch' ? 'tap' : 'key'); // held before any key press: the cursor is on the bag, not the belt
    }
    renderNext() {
      this.nextItems.replaceChildren(...this.queue.slice(0, 2).map(p => p.copy(1)));
      this.nextEl.style.visibility = this.queue.length ? '' : 'hidden';
    }
    resolve(how) {
      if (!this.front) return;
      this.lefts.push(how === 'fell' ? 0 : Math.max(0, this.left));
      this.front = null; this.doneN++;
      this.gapLeft = T.rush.gapMs;
      this.ring.set(0); this.ringNum.textContent = ''; this.ringShown = -1;
      const n = SC.signal(this.elapsed, this.clockMs, this.doneN, this.total);
      if (n > this.signalN) this.setSignal(n);
    }
    timeout() {
      const s = this.s, pl = s.play, p = this.front, name = pick(p.data.label);
      if (pl.held && pl.held.piece === p) { pl.cancelDrag(); if (pl.held) pl.cancel(true); }
      const r = p.el.getBoundingClientRect();
      if (!AG.reducedMotion() && r.width) {
        const c = p.copy(p.scale, 'gb-fall');
        c.style.left = Math.round(r.left) + 'px'; c.style.top = Math.round(r.top) + 'px';
        (s.root.closest('#ag-app') || document.body).append(c);
        setTimeout(() => c.remove(), 600);
      }
      s.tray.forget(p); pl.limbo.append(p.el); p.setState('gone'); // parked, never detached mid-touch
      AG.sfx.play('soft');
      if (s.isNeeded(p)) {
        if (s.kind(p) === 'essential') this.missed.add(p.id);
        s.react('worried');
        s.ctx.say('encouragement', GB.fmt(RSTR.fellNeed, { name }));
      } else s.setLine(RSTR.fell, { name });
      this.resolve('fell');
      s.changed();
    }
    finishBelt() {
      const s = this.s;
      this.over = true;
      this.ringEl.style.visibility = 'hidden'; this.nextEl.style.visibility = 'hidden';
      if (this.wind) this.wind.volume(T.rush.wind[0]);
      s.syncPack();
      if (s.overWeight()) { s.setLine(RSTR.beltHeavy); s.ctx.say('warning', RSTR.beltHeavy); if (AG.input.lastDevice === 'keyboard') s.play.setZone('buttons'); }
      else { s.setLine(RSTR.beltDone); s.timers.push(setTimeout(() => { if (!s.ended && !AG.paused) s.finish(); else if (!s.ended) this.finishWhenResumed = true; }, 900)); }
    }

    /* ---------- events from the scene ---------- */
    picked() {}
    placed(p) { if (p === this.front) this.resolve('placed'); else this.autoHold(); }
    returned(p) { if (p !== this.front) this.autoHold(); }
    tossed(p) {
      if (p === this.front) {
        if (this.s.isNeeded(p)) {
          if (this.s.kind(p) === 'essential') this.missed.add(p.id);
          this.s.ctx.say('warning', GB.fmt(RSTR.tossedNeed, { name: pick(p.data.label) }));
        }
        this.resolve('tossed');
      } else this.autoHold();
    }
    canFinish() { return this.over; }
    isFront(p) { return !!p && p === this.front; }
    frontOnBelt() { return this.front; }
    missedCount() { return this.missed.size; }
    avgLeft() { return SC.avgLeft(this.lefts); }
    pause(p) {
      if (this.wind) this.wind.volume(p ? 0 : T.rush.wind[this.signalN - 1]);
      if (!p && this.finishWhenResumed && !this.s.ended) { this.finishWhenResumed = false; this.s.finish(); }
    }

    hint() {
      const s = this.s, STR = GB.STR, pl = s.play, p = pl.held ? pl.held.piece : this.front;
      if (!p) return s.sayHint(this.over ? STR.hintDone : RSTR.hintWait);
      const k = s.kind(p), name = pick(p.data.label);
      if (k === 'decoy') return s.sayHint(RSTR.hintToss, { name });
      const n = s.nearestFit(p);
      if (n) { s.showSpot(p, n.x, n.y, n.rot); return s.sayHint(STR.hintTry, { name: p.label }); }
      if (k === 'nice') return s.sayHint(RSTR.hintToss, { name });
      const extra = s.board.pieces.find(q => !s.isNeeded(q));
      s.sayHint(extra ? STR.hintRemove : RSTR.hintNoRoom, { name: extra ? pick(extra.data.label) : name });
    }

    stop() {
      this.over = true;
      if (this.stopLoop) { this.stopLoop(); this.stopLoop = null; }
      if (this.wind) { this.wind.stop(); this.wind = null; }
      clearTimeout(this.beltT);
      if (this.offDevice) { this.offDevice(); this.offDevice = null; }
    }
    destroy() { this.stop(); }
  }
  const P0 = (w, hh) => { const cv = document.createElement('canvas'); cv.width = w; cv.height = hh; return cv; };

  GB.ConveyorRush = ConveyorRush;
  GB.RSTR = RSTR;
})(window.AG);
