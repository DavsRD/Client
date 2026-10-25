/* Lost & Found, phase 2: FIND A SAFE HELPER (hidden object). The scene (800 × 450) is bigger than the 480 × 270
 * view: the E2 SceneView reticle (arrows, Shift fine, the camera pans near the edge, Z zoom, Enter checks; drag pans,
 * pinch / wheel zoom, tap checks; never Tab-to-target). The top bar lists the 2–4 helper types to find.
 *   a listed helper → ✔ + why they can help · another helper → "can help too" (no cost) · another shopper → the
 *   "someone who WORKS here" tip, −2 s · a lost pet 🐾 → a collectible · time up → the helpers are shown, go on.
 * ?zones=1 draws every zone (helpers, shoppers, pets). */
window.AG = window.AG || {};
(function (AG) {
  const { h } = AG.util;
  const LF = AG.lostFound, T = LF.tuning, P = T.points;
  const K = 'lost-and-found.';
  const pick = v => AG.pick(v);

  const STR = {
    start: { en: 'Find someone who **works here**. Look for: {list}.' },
    findTitle: { en: 'Find a safe helper' },
    found: { en: '✔ {why}' },
    already: { en: 'You found that helper already. Look for the others!' },
    pet: { en: 'A lost pet! 🐾 {n} of 3 found.' },
    petAgain: { en: 'That pet is safe now. 🐾' },
    allFound: { en: 'I found safe helpers! Now I can tell them who I am.' },
    timeUp: { en: "Time's up! Here are the safe helpers: {list}." },
    goTo: { en: 'Let’s go to a helper together.' },
    left: { en: '{n} to find' }, done: { en: 'Found' }
  };

  class HelperSearch {
    constructor(scene) { this.s = scene; this.offs = []; this.timers = []; }
    start() {
      const s = this.s, ctx = s.ctx, sd = s.sceneData, [W, H] = sd.size;
      this.W = W; this.H = H;
      this.find = s.find; this.found = new Set(); this.extra = new Set();
      this.msLeft = s.timeMs; this.running = false; this.lastCheck = -Infinity;
      this.debugZones = new URLSearchParams(location.search).get('zones') === '1';
      const helpers = s.safe.helpers;
      const zones = Object.entries(sd.helpers).map(([id, rect]) => ({ id, rect, label: pick((helpers[id] || {}).label) || id }));
      this.pets = new AG.logic.HitZones(sd.pets.map((rect, i) => ({ id: 'pet' + i, rect })), { w: W, h: H });
      this.shoppers = new AG.logic.HitZones((sd.shoppers || []).map((rect, i) => ({ id: 's' + i, rect })), { w: W, h: H });

      // the top bar: the helper types to find, each with its picture
      this.chips = new Map();
      const list = h('ul', { class: 'lf-find', 'aria-label': pick(STR.findTitle) }, this.find.map(id => {
        const mark = h('span', { class: 'lf-find__mark', 'aria-hidden': 'true' }, '?');
        const li = h('li', { class: 'lf-find__chip' }, LF.artCanvas(K + 'helper.' + id, 1, 'lf-find__art'),
          h('span', { class: 'lf-find__name' }, pick(helpers[id].label)), mark);
        this.chips.set(id, { li, mark });
        return li;
      }));
      const start = s.level.start || [0.5, 0.6];
      this.view = new AG.scenetap.SceneView({
        scene: K + 'scene.' + s.level.scene, w: W, h: H, zones, mode: 'reticle', zooms: T.lens.zooms, start: { x: start[0], y: start[1] },
        label: { en: pick(s.level.place) + ': ' + pick(STR.findTitle) },
        onPick: (zone, info) => this.check(zone, info), onMiss: info => this.miss(info),
        drawWorld: c => this.drawWorld(c), drawScreen: (c, v) => this.drawScreen(c, v)
      });
      this.view.enabled = false;
      this.el = h('div', { class: 'lf-search' }, list, h('div', { class: 'lf-search__view' }, this.view.el));
      s.board.append(this.el);
      this.bindWheel();
      this.pad = AG.input.touchControls(ctx.controls, { dpad: true, buttons: [{ action: 'CONFIRM', label: '✔' }, { action: 'ZOOM', label: '🔍' }] });
      this.mall = AG.sfx.loop(K + 'sfx.mall_loop', { volume: 0.25 });
      s.setMe('think');
      s.say(STR.start, { list: this.find.map(id => pick(helpers[id].label).toLowerCase()).join(', ') });
      s.updateHud(this.msLeft);
      this.last = performance.now();
      this.tickId = ctx.every(100, () => this.tick());
      this.view.ready.then(() => { if (!s.over && this.view) { this.running = true; this.view.enabled = true; this.last = performance.now(); } });
    }
    after(ms, fn) { const id = this.s.ctx.after(ms, () => { if (!this.s.over && this.view) fn(); }); this.timers.push(id); return id; }
    onPause(p) { if (!this.view) return; if (p) this.view.cancelGesture(); else this.last = performance.now(); }

    /** The mouse wheel zooms in whole steps around the pointer. */
    bindWheel() {
      const cv = this.view.cv;
      const fn = e => {
        if (!this.running || AG.paused || !e.deltaY) return;
        e.preventDefault();
        const p = this.view.view.toLocal(e);
        this.view.zoomStep(e.deltaY < 0 ? 1 : -1, p.x, p.y);
      };
      cv.addEventListener('wheel', fn, { passive: false });
      this.offs.push(() => cv.removeEventListener('wheel', fn));
    }

    tick() {
      const now = performance.now(), dt = Math.min(400, now - this.last);
      this.last = now;
      if (!this.running) return;
      this.msLeft = Math.max(0, this.msLeft - dt);
      this.s.updateHud(this.msLeft);
      if (this.msLeft <= 0) this.complete(false);
    }
    accept() { const now = performance.now(); if (now - this.lastCheck < T.debounceMs) return false; this.lastCheck = now; return true; }
    pop(point, text, good) {
      const v = this.view, cr = v.cv.getBoundingClientRect(), sr = this.s.stage.getBoundingClientRect();
      const sp = v.cam.normToScreen(point.x, point.y), k = cr.width / v.o.viewW;
      AG.kit.pop(this.s.stage, cr.left - sr.left + sp.x * k, cr.top - sr.top + sp.y * k, text, good);
    }

    /* ---------- checks ---------- */
    check(zone, info) {
      if (!this.running || !this.accept()) return;
      const s = this.s, id = zone.id, d = s.safe.helpers[id] || { label: { en: id }, why: { en: '' }, name: { en: id } };
      if (!this.find.includes(id)) { // a real helper, just not on this mission's list: kind words, no cost
        this.extra.add(id);
        s.react('happy');
        s.say(LF.fmt(s.safe.extraHelper, { name: pick(d.name) }));
        this.view.announce(pick(d.label));
        return;
      }
      if (this.found.has(id)) { s.say(STR.already); return; }
      this.found.add(id);
      s.run.found = this.found.size;
      this.view.mark(zone);
      const chip = this.chips.get(id);
      chip.li.classList.add('is-found'); chip.mark.textContent = '✔';
      AG.sfx.play(K + 'sfx.found');
      s.react('wave', 1400);
      s.say(STR.found, { why: pick(d.why) });
      this.view.announce(pick(d.label) + ': ' + pick(d.why));
      this.pop(info.point || this.view.zones.centre(zone), '+' + P.helper, true);
      s.updateHud(this.msLeft);
      if (this.found.size === this.find.length) this.complete(true);
    }
    miss(info) {
      if (!this.running || !this.accept()) return;
      const s = this.s, p = info.point, tol = info.view.tolFor(info.device);
      const pet = this.pets.hitTest(p, tol);
      if (pet) {
        const i = +pet.id.slice(3);
        if (s.run.pets[i]) { s.say(STR.petAgain); return; }
        s.run.pets[i] = true;
        AG.sfx.play('collect');
        s.react('happy');
        const n = s.run.pets.filter(Boolean).length;
        s.say(STR.pet, { n });
        this.view.announce(LF.fmt(STR.pet, { n }));
        return;
      }
      if (this.shoppers.hitTest(p, tol)) {
        // another shopper: not "bad", just not a worker. A gentle tip and a little time.
        this.msLeft = Math.max(0, this.msLeft - T.shopperMs);
        AG.sfx.play('soft');
        s.react('think');
        s.say(s.safe.shopper);
        this.view.announce(pick(s.safe.shopper));
        this.pop(p, '−' + T.shopperMs / 1000 + ' s', false);
        s.updateHud(this.msLeft);
        if (this.msLeft <= 0) this.complete(false);
        return;
      }
      s.say(s.safe.empty);
    }

    /** All found (inTime) or the clock ran out: the time bonus counts only when every helper was found. */
    complete(inTime) {
      if (!this.running) return;
      const s = this.s;
      this.running = false;
      this.view.enabled = false;
      this.view.cancelGesture();
      s.run.msLeft = inTime ? this.msLeft : 0;
      s.updateHud(this.msLeft);
      if (this.mall) this.mall.stop();
      if (inTime) {
        s.react('happy', 1400);
        s.say(STR.allFound);
        AG.kit.banner(s.stage, { en: '✔ ' + pick(STR.done) + '!' }, null, 1100);
        this.after(1300, () => s.next(new LF.TellHelper(s, this.firstFound())));
        return;
      }
      // time's up: never a fail. Show where the helpers were, then go on together.
      const left = this.find.filter(id => !this.found.has(id));
      left.forEach(id => this.view.mark(this.view.zones.get(id)));
      if (left[0]) { const c = this.view.zones.centre(this.view.zones.get(left[0])); this.view.cam.centreOn(c.x * this.W, c.y * this.H); }
      s.say(STR.timeUp, { list: left.map(id => pick(s.safe.helpers[id].label).toLowerCase()).join(', ') });
      AG.kit.banner(s.stage, { en: "Time's up!" }, STR.goTo, T.timeUpMs - 300);
      this.after(T.timeUpMs, () => s.next(new LF.TellHelper(s, this.firstFound() || left[0])));
    }
    firstFound() { return [...this.found][0] || null; }

    /* ---------- drawing ---------- */
    drawWorld(c) {
      if (!this.pets) return;
      const s = this.s, paw = AG.pixelIcon('🐾', 12, true);
      this.pets.zones.forEach((z, i) => {
        if (!s.run.pets[i]) return;
        const b = this.pets.bounds(z);
        c.drawImage(paw, Math.round((b.x + b.w / 2) * this.W - 6), Math.round(b.y * this.H - 14), 12, 12);
      });
    }
    drawScreen(c, v) {
      if (!this.debugZones || !this.pets) return;
      const px = AG.scenetap.px;
      v.zones.zones.forEach(z => px.strokeZone(c, z, v.cam, this.find.includes(z.id) ? px.VEST : px.SAFE));
      this.shoppers.zones.forEach(z => px.strokeZone(c, z, v.cam, '#a9b1d6'));
      this.pets.zones.forEach(z => px.strokeZone(c, z, v.cam, '#4aa8e8'));
    }

    destroy() {
      this.running = false;
      this.s.ctx.clear(this.tickId);
      this.timers.forEach(id => this.s.ctx.clear(id));
      this.offs.forEach(f => f()); this.offs = [];
      if (this.mall) this.mall.stop();
      if (this.pad) this.pad.destroy();
      if (this.view) this.view.destroy();
      this.view = null;
      if (this.el) this.el.remove();
    }
  }

  LF.HelperSearch = HelperSearch;
})(window.AG);
