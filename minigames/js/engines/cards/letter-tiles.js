/* E6 CARDS ENGINE — LetterTiles: Pixelify Sans letter tiles and blank slots (word games).
 *
 *   const lt = new AG.cards.LetterTiles({ answer: 'WASH HANDS', decoys: 2, onCheck, … })
 *   stage.append(lt.el)
 *
 * Modes: a fixed answer (blanks for every letter, fixed gaps between words), FREE
 * (answer: null, maxLength blanks, Enter / ✔ submits whatever is typed: Word Twist) and
 * WORDS (words: true; every tile is a word: Sentence Scramble, no typing).
 *
 * Keyboard (the game must call AG.input.disableWasd(); this does it too, and frees the
 * letter keys the shell uses: HINT moves to ? or /, PAUSE to Esc only, R stops rotating,
 * CONFIRM is Enter only, Space becomes SHUFFLE — all until the game ends):
 *   TYPE a letter    fills the next blank with the first unused matching tile
 *                    (letters that aren't free shake the tray; see AG.logic.letters)
 *   Backspace        removes the last placed tile        Space   shuffles
 *   ? or /           hint                                Enter   checks / submits
 *   arrows + Enter   reach any tile (Ñ without special keys) and the ⌫ 🔀 💡 ✔ buttons
 * Touch / mouse: tap a tile to place it, tap a filled blank to send it back; ⌫ 🔀 💡 ✔.
 *
 * Callbacks: onChange({ value, full }), onCheck({ value, correct }) (return false to keep
 * a wrong answer on the board instead of bouncing it back), onSubmit({ value }) (free
 * mode), onHint({ slot, token }), onShuffle(), onReject({ key }). */
window.AG = window.AG || {};
(function (AG) {
  const { h } = AG.util;
  const L = () => AG.logic.letters;
  const sfx = name => AG.sfx && AG.sfx.play(name);

  /** The nearest element from `from` in a direction, by on-screen position. */
  function nearest(from, list, dir) {
    const a = from.getBoundingClientRect(), ax = a.left + a.width / 2, ay = a.top + a.height / 2;
    let best = null, bd = Infinity;
    list.forEach(el => {
      if (el === from) return;
      const b = el.getBoundingClientRect(), bx = b.left + b.width / 2, by = b.top + b.height / 2;
      const dx = bx - ax, dy = by - ay;
      const ok = dir === 'up' ? dy < -a.height / 2 : dir === 'down' ? dy > a.height / 2 : dir === 'left' ? dx < -2 && Math.abs(dy) < a.height / 2 : dx > 2 && Math.abs(dy) < a.height / 2;
      if (!ok) return;
      const d = dir === 'up' || dir === 'down' ? Math.abs(dy) * 4 + Math.abs(dx) : Math.abs(dx);
      if (d < bd) { bd = d; best = el; }
    });
    return best;
  }

  class LetterTiles {
    constructor(opts) {
      this.opts = Object.assign({ autoCheck: true, remapKeys: true }, opts || {});
      this.el = h('div', { class: 'agc-letters', tabindex: '-1' });
      this.status = h('span', { class: 'agc-sr', 'aria-live': 'polite' });
      this.row = h('div', { class: 'agc-answer', role: 'group', 'aria-label': AG.t('cards.answer') });
      this.tray = h('div', { class: 'agc-tray', role: 'group' });
      this.btns = h('div', { class: 'agc-letters__btns' });
      this.el.append(this.row, this.tray, this.btns, this.status);
      this.pending = '';
      this.locked = false;

      if (this.opts.remapKeys) {
        AG.input.disableWasd();
        AG.input.register('HINT', { keys: ['Slash', 'NumpadDivide'] });
        AG.input.register('ROTATE', { keys: [] });
        AG.input.register('PAUSE', { keys: ['Escape'] });
        AG.input.register('CONFIRM', { keys: ['Enter', 'NumpadEnter'] });
        AG.input.register('SHUFFLE', { keys: ['Space'] });
      }
      const atRoot = () => { const ae = document.activeElement; return ae === this.el || ae === this.scope(); };
      const mine = () => this.el.isConnected && !AG.paused && (this.el.contains(document.activeElement) || document.activeElement === this.scope());
      this.offs = [
        AG.input.on('UNDO', e => { if (e.phase !== 'up' && mine()) this.removeLast(); }),
        AG.input.on('SHUFFLE', e => { if (e.phase === 'down' && mine()) this.shuffle(); }),
        AG.input.on('HINT', e => { if (e.phase === 'down' && mine()) this.hint(); }),
        AG.input.on('CONFIRM', e => { if (e.phase === 'down' && mine() && atRoot()) this.submit(); }),
        ...['LEFT', 'RIGHT', 'UP', 'DOWN'].map(a => AG.input.on(a, e => { if (e.phase !== 'up' && mine()) this.move(a.toLowerCase()); }))
      ];
      AG.input.repeat('UNDO', { delay: 300, interval: 110 });

      // typed letters: raw keys, but only while the stage has focus (the input layer's rule)
      this.onKey = e => {
        if (!this.typingOn() || !mine() || this.locked || e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
        if (/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
        const k = L().normalizeKey(e.key);
        if (!k) return;
        e.preventDefault();
        this.type(k);
      };
      this.onClick = e => {
        if (AG.paused) return;
        const tile = e.target.closest('.agc-tile'), slot = e.target.closest('.agc-slot');
        if (tile && this.tray.contains(tile)) this.placeTile(this.tiles.findIndex(t => t.el === tile), { focus: tile });
        else if (slot && this.row.contains(slot)) this.unplace(+slot.dataset.slot);
      };
      this.el.addEventListener('click', this.onClick);
      this.offLang = AG.on('kalasag:languagechange', () => this.relabel());
      document.addEventListener('keydown', this.onKey);
      this.load(this.opts);
    }

    scope() { return this.opts.stage || this.el.closest('.ag-stage') || this.el; }
    typingOn() { return !this.opts.words && this.opts.typing !== false; }

    /** (Re)builds the board for a new answer: same options as the constructor. */
    load(spec) {
      // replacing the tiles must not drop keyboard focus to <body> (keys need the stage)
      const hadFocus = this.el.contains(document.activeElement) && document.activeElement !== this.el;
      Object.assign(this.opts, spec || {});
      const o = this.opts, letters = L();
      this.free = o.answer == null;
      this.words = !!o.words;
      this.cells = this.free ? [] : letters.layout(o.answer, { words: this.words, ngSingle: o.ngSingle });
      this.tokens = this.cells.filter(c => c.slot != null).map(c => c.token);
      const labels = o.tiles ? o.tiles.map(t => String(t).toUpperCase()) : letters.deal(this.tokens, { decoys: o.decoys, rnd: o.rnd, lang: o.lang || AG.lang() });
      const n = this.free ? (o.maxLength || labels.length) : this.tokens.length;
      if (this.free) this.cells = Array.from({ length: n }, (_, i) => ({ slot: i, token: null }));
      this.slots = Array(n).fill(null);   // slot → tile index
      this.lockedSlots = new Set();
      this.pending = ''; this.locked = false;
      clearTimeout(this.bounceT);
      this.el.classList.remove('is-solved');
      this.tiles = labels.map(label => ({ label, el: h('button', { type: 'button', class: 'agc-tile' + (label.length > 2 ? ' agc-tile--word' : ''), tabindex: '-1' }, h('span', {}, label)) }));
      this.tray.setAttribute('aria-label', AG.t(this.words ? 'cards.words' : 'cards.tiles'));
      this.tray.replaceChildren(...this.tiles.map(t => t.el));
      // narrow stages size the tiles so they fit in 2 rows (CSS keeps them 40–56 px)
      this.tray.style.setProperty('--per-row', Math.max(5, Math.ceil(labels.length / 2)));
      this.slotEls = [];
      this.row.classList.toggle('agc-answer--words', this.words);
      this.row.replaceChildren(...this.cells.map(c => {
        if (c.gap) return h('span', { class: 'agc-gap', 'aria-hidden': 'true' });
        if (c.fixed) return h('span', { class: 'agc-fixed', 'aria-hidden': 'true' }, c.fixed);
        const el = h('button', { type: 'button', class: 'agc-slot' + (this.words ? ' agc-slot--word' : ''), 'data-slot': c.slot, tabindex: '-1' }, h('span', {}, ''));
        this.slotEls[c.slot] = el;
        return el;
      }));
      this.buildButtons();
      this.cursor = 0;
      this.render();
      if (hadFocus) this.el.focus({ preventScroll: true });
      return this;
    }

    buildButtons() {
      const want = Object.assign({ back: true, shuffle: true, hint: true, check: true }, this.opts.buttons || {});
      const focused = this.ctl && Object.keys(this.ctl).find(k => this.ctl[k] === document.activeElement);
      const mk = (name, glyph, label, fn) => {
        const b = h('button', { type: 'button', class: 'ag-btn ag-btn--alt agc-ctl agc-ctl--' + name, 'aria-label': AG.t(label), title: AG.t(label) }, glyph);
        b.addEventListener('click', () => { if (!AG.paused) fn(); });
        return b;
      };
      this.ctl = {};
      if (want.back) this.ctl.back = mk('back', '⌫', 'cards.backspace', () => this.removeLast());
      if (want.shuffle) this.ctl.shuffle = mk('shuffle', '🔀', 'cards.shuffle', () => this.shuffle());
      if (want.hint) this.ctl.hint = mk('hint', '💡', 'cards.hint', () => this.hint());
      if (want.check) this.ctl.check = mk('check', '✔', 'cards.check', () => this.submit());
      if (this.ctl.check) this.ctl.check.classList.remove('ag-btn--alt');
      this.btns.replaceChildren(...Object.values(this.ctl));
      if (focused && this.ctl[focused]) this.ctl[focused].focus({ preventScroll: true });
    }
    relabel() {
      this.row.setAttribute('aria-label', AG.t('cards.answer'));
      this.tray.setAttribute('aria-label', AG.t(this.words ? 'cards.words' : 'cards.tiles'));
      this.buildButtons(); this.render();
    }

    /* ---------- state ---------- */
    used(i) { return this.slots.includes(i); }
    placed() { return this.slots.map(i => (i == null ? null : this.tiles[i].label)); }
    filledCount() { return this.slots.filter(i => i != null).length; }
    isFull() { return this.slots.every(i => i != null); }
    value() {
      const p = this.placed();
      if (this.free) return p.filter(Boolean).join('');
      return this.words ? p.map(x => x || '_').join(' ') : this.cells.map(c => (c.gap ? ' ' : c.fixed ? c.fixed : p[c.slot] || '_')).join('');
    }

    render() {
      this.tiles.forEach((t, i) => {
        const u = this.used(i);
        t.el.classList.toggle('is-used', u);
        t.el.classList.toggle('is-pending', !u && !!this.pending && t.label.startsWith(this.pending) && t.label !== this.pending);
        t.el.setAttribute('aria-disabled', String(u));
        t.el.setAttribute('aria-label', u ? AG.t('cards.empty') : t.label);
        t.el.tabIndex = i === this.cursor ? 0 : -1;
      });
      this.slotEls.forEach((el, s) => {
        const i = this.slots[s], txt = i == null ? '' : this.tiles[i].label;
        el.firstChild.textContent = txt;
        el.classList.toggle('is-filled', i != null);
        el.classList.toggle('is-locked', this.lockedSlots.has(s));
        el.classList.toggle('is-next', i == null && s === this.nextSlot());
        el.setAttribute('aria-label', txt ? AG.t('cards.blankFilled', { n: String(s + 1), text: txt }) : AG.t('cards.blank', { n: String(s + 1) }));
      });
    }
    announce() { this.status.textContent = this.value().replace(/_/g, ' _ '); }
    changed() {
      this.render(); this.announce();
      this.opts.onChange && this.opts.onChange({ value: this.value(), full: this.isFull() });
      if (!this.free && this.opts.autoCheck && this.isFull()) this.check();
    }
    nextSlot() { return this.slots.findIndex((v, s) => v == null && !this.lockedSlots.has(s)); }

    /* ---------- actions ---------- */
    type(key) {
      if (this.locked) return;
      const used = this.tiles.map((_, i) => this.used(i));
      const r = L().typeKey(this.tiles.map(t => t.label), used, this.pending, key);
      if (r.kind === 'pending') { this.pending = r.pending; this.render(); return; }
      this.pending = '';
      if (r.kind === 'reject' || this.nextSlot() < 0) { this.reject(key); return; }
      this.el.focus({ preventScroll: true });
      this.placeTile(r.index);
    }
    reject(key) {
      this.pending = ''; this.render();
      AG.kit.shake(this.tray);
      sfx('soft');
      this.opts.onReject && this.opts.onReject({ key });
    }
    /** Puts tile i into the next free blank. */
    placeTile(i, o) {
      if (this.locked || i < 0 || !this.tiles[i]) return false;
      if (this.used(i)) { AG.kit.shake(this.tiles[i].el); return false; }
      const s = this.nextSlot();
      if (s < 0) { AG.kit.shake(this.row); return false; }
      this.slots[s] = i; this.pending = '';
      sfx('tap');
      this.changed();
      if (o && o.focus) o.focus.focus({ preventScroll: true });
      return true;
    }
    /** Sends the tile in blank s back to the tray (hint-locked blanks stay). */
    unplace(s) {
      if (this.locked || this.slots[s] == null || this.lockedSlots.has(s)) return false;
      this.slots[s] = null; this.pending = '';
      sfx('tap'); this.changed();
      return true;
    }
    removeLast() {
      if (this.pending) { this.pending = ''; this.render(); return true; }
      for (let s = this.slots.length - 1; s >= 0; s--) if (this.slots[s] != null && !this.lockedSlots.has(s)) return this.unplace(s);
      return false;
    }
    clear() { this.slots.forEach((v, s) => { if (!this.lockedSlots.has(s)) this.slots[s] = null; }); this.pending = ''; this.render(); this.announce(); }
    /** Reorders the tray (placed tiles keep their blanks). */
    shuffle() {
      if (this.locked) return;
      const rnd = this.opts.rnd || Math.random, order = this.tiles.map((_, i) => i);
      for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
      const map = new Map(order.map((from, to) => [from, to]));
      this.tiles = order.map(i => this.tiles[i]);
      this.slots = this.slots.map(i => (i == null ? null : map.get(i)));
      this.tray.replaceChildren(...this.tiles.map(t => t.el));
      sfx('blip'); this.render();
      this.opts.onShuffle && this.opts.onShuffle();
    }
    /**
     * Locks the next correct letter in place (fixed answers, or a `target` word in free
     * mode). Wrong tiles after the last correct blank go back first. → { slot, token } | null
     */
    hint(target) {
      if (this.locked) return null;
      const tokens = target ? L().tokenize(target, { ngSingle: this.opts.ngSingle }) : this.tokens;
      if (!tokens.length) return null;
      const p = this.placed();
      let k = 0;
      while (k < tokens.length && p[k] === tokens[k] && k < this.slots.length) { this.lockedSlots.add(k); k++; }
      if (k >= tokens.length || k >= this.slots.length) { this.render(); return null; }
      for (let s = k; s < this.slots.length; s++) if (!this.lockedSlots.has(s)) this.slots[s] = null;
      const i = this.tiles.findIndex((t, j) => t.label === tokens[k] && !this.used(j));
      if (i < 0) { this.render(); return null; }
      this.slots[k] = i; this.lockedSlots.add(k);
      sfx('blip');
      const info = { slot: k, token: tokens[k] };
      this.opts.onHint && this.opts.onHint(info);
      this.changed();
      return info;
    }
    /** Enter / ✔: check a full fixed answer, or submit in free mode. */
    submit() {
      if (this.locked) return;
      if (this.free) {
        const value = this.value();
        if (!value) { AG.kit.shake(this.row); return; }
        this.opts.onSubmit && this.opts.onSubmit({ value });
        return;
      }
      if (!this.isFull()) { AG.kit.shake(this.row); return; }
      this.check();
    }
    check() {
      const correct = L().check(this.placed(), this.tokens);
      const keep = this.opts.onCheck ? this.opts.onCheck({ value: this.value(), correct }) : undefined;
      if (correct) this.win();
      else if (keep !== false) this.bounce();
      return correct;
    }
    /** Marks every blank correct and locks the board. */
    win() {
      this.locked = true;
      this.slotEls.forEach(el => el.classList.add('is-correct'));
      this.el.classList.add('is-solved');
    }
    /** Wrong answer: the blanks shake, then the tiles go back to the tray. */
    bounce(ms) {
      this.locked = true;
      AG.kit.shake(this.row);
      this.slotEls.forEach(el => el.classList.add('is-wrong'));
      clearTimeout(this.bounceT);
      this.bounceT = setTimeout(() => {
        this.slotEls.forEach(el => el.classList.remove('is-wrong'));
        this.locked = false; this.clear();
        this.opts.onChange && this.opts.onChange({ value: this.value(), full: false });
      }, ms != null ? ms : AG.reducedMotion() ? 250 : 650);
    }

    /* ---------- arrow keys: real focus across tiles and buttons, by screen position ---------- */
    move(dir) {
      const tiles = this.tiles.map(t => t.el), ctl = Object.values(this.ctl);
      const ae = document.activeElement;
      if (!tiles.includes(ae) && !ctl.includes(ae)) {
        const first = this.tiles.findIndex((_, i) => !this.used(i));
        (tiles[this.cursor] || tiles[first] || tiles[0] || ctl[0]).focus({ preventScroll: true });
        return;
      }
      let next = null;
      if (tiles.includes(ae)) {
        const i = tiles.indexOf(ae);
        if (dir === 'left') next = tiles[i - 1];
        else if (dir === 'right') next = tiles[i + 1];
        else next = nearest(ae, dir === 'down' ? tiles.concat(ctl) : tiles, dir);
      } else {
        const i = ctl.indexOf(ae);
        if (dir === 'left') next = ctl[i - 1];
        else if (dir === 'right') next = ctl[i + 1];
        else if (dir === 'up') next = nearest(ae, tiles, 'up');
      }
      if (next) { next.focus({ preventScroll: true }); const ti = tiles.indexOf(next); if (ti >= 0) { this.cursor = ti; this.render(); } }
    }

    destroy() {
      this.offs.forEach(f => f());
      document.removeEventListener('keydown', this.onKey);
      this.el.removeEventListener('click', this.onClick);
      clearTimeout(this.bounceT); this.offLang();
    }
  }

  AG.cards = Object.assign(AG.cards || {}, { LetterTiles, nearest });
})(window.AG);
