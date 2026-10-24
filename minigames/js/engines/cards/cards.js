/* E6 CARDS ENGINE — the base: card faces, Card, CardGrid, and the roving-focus helper the
 * other pieces share. DOM in the prototype's panel style (ink borders, hard offset shadows);
 * styles in minigames/css/cards.css (added to the page by this file, all under #ag-app).
 * Docs: kalasag-dev/minigames/docs/engines/cards.md
 *
 *   AG.cards.face(spec, { iconSize })   → element. spec: 'mosquito' (an AG.icons name),
 *        '🦟' (emoji → AG.pixelIcon), { icon | emoji | img | asset | text, label }
 *   new AG.cards.Card({ id, key, front, back, state, label })
 *        states hidden | revealed | matched | disabled; .reveal() .hide() .match() .disable()
 *        .select(on); a short stepped flip between hidden and revealed (instant under
 *        Reduce Motion). Every card is a real <button>, at least 64 CSS px.
 *   new AG.cards.CardGrid({ cards, cols, onSelect(card, index), label })
 *        roving focus: arrows move (AG.input LEFT/RIGHT/UP/DOWN, so WASD too unless the
 *        game disabled it), Home/End jump, Enter/Space or a tap selects.
 * Text may be { en, fil }; it is re-read on kalasag:languagechange. */
window.AG = window.AG || {};
(function (AG) {
  const { h } = AG.util;
  const sfx = name => AG.sfx && AG.sfx.play(name);

  /* ---------- the engine stylesheet (once per page) ---------- */
  if (typeof document !== 'undefined' && !document.querySelector('link[data-ag-css="cards"]')) {
    document.head.append(h('link', { rel: 'stylesheet', href: AG.path('css/cards.css'), 'data-ag-css': 'cards' }));
  }

  /* ---------- engine strings (shell strings live in js/data/strings.js) ---------- */
  AG.STRINGS = Object.assign(AG.STRINGS || {}, {
    'cards.facedown': { en: 'Card {n}, face down', fil: 'Kard {n}, nakataob' },
    'cards.matched': { en: '{label}, matched', fil: '{label}, tugma na' },
    'cards.empty': { en: 'Empty', fil: 'Walang laman' },
    'cards.tiles': { en: 'Letter tiles', fil: 'Mga titik' },
    'cards.words': { en: 'Word tiles', fil: 'Mga salita' },
    'cards.answer': { en: 'Your answer', fil: 'Ang sagot mo' },
    'cards.blank': { en: 'Blank {n}', fil: 'Patlang {n}' },
    'cards.blankFilled': { en: 'Blank {n}: {text}', fil: 'Patlang {n}: {text}' },
    'cards.backspace': { en: 'Remove the last letter', fil: 'Alisin ang huling titik' },
    'cards.shuffle': { en: 'Shuffle', fil: 'Haluin' },
    'cards.hint': { en: 'Hint', fil: 'Pahiwatig' },
    'cards.check': { en: 'Check', fil: 'Suriin' },
    'cards.left': { en: 'No', fil: 'Hindi' },
    'cards.right': { en: 'Yes', fil: 'Oo' },
    'cards.cardsLeft': { en: '{n} cards left', fil: '{n} kard pa' },
    'cards.timeLeft': { en: 'Time left', fil: 'Natitirang oras' },
    'cards.time': { en: 'Time', fil: 'Oras' },
    'cards.streak': { en: 'Streak', fil: 'Sunod-sunod' }
  });

  /* ---------- faces ---------- */
  const EMOJI = /\p{Extended_Pictographic}/u;
  function normalizeFace(spec) {
    if (spec == null) return {};
    if (typeof spec === 'string') {
      if (AG.icons && AG.icons.has(spec)) return { icon: spec };
      if (EMOJI.test(spec)) return { emoji: spec };
      return { text: spec };
    }
    return spec;
  }
  /** Plain text for screen readers: the label, else the text, else the icon's name. */
  function faceLabel(spec) {
    const f = normalizeFace(spec);
    return AG.pick(f.label) || AG.pick(f.text) || (f.icon ? f.icon.replace(/_/g, ' ') : '') || f.emoji || '';
  }
  /** Icons are 18 px pixel art: iconSize is rounded to a whole multiple of 18. */
  function face(spec, opts) {
    const f = normalizeFace(spec);
    const px = Math.max(18, Math.round(((opts && opts.iconSize) || f.iconSize || 36) / 18) * 18);
    const el = h('span', { class: 'agc-face' });
    let pic = null;
    if (f.icon) pic = AG.ui.icon(f.icon, px);
    else if (f.emoji) pic = h('img', { class: 'ag-px', src: AG.pixelIcon(f.emoji, 18), width: px, height: px, alt: '', draggable: 'false' });
    else if (f.img || f.asset) {
      const src = f.img || (AG.assets && AG.assets.url(f.asset)) || (AG.assets && AG.assets.placeholderURL(f.asset, 64, 64));
      pic = h('img', { class: 'ag-px agc-face__img', src, alt: '', draggable: 'false' });
    }
    if (pic) el.append(pic);
    if (f.text != null) el.append(h('span', { class: 'agc-face__text' + (pic ? ' small' : '') }, AG.pick(f.text)));
    if (f.label != null) el.append(h('span', { class: 'agc-face__label' }, AG.pick(f.label)));
    return el;
  }

  /* ---------- Card ---------- */
  const STATES = ['hidden', 'revealed', 'matched', 'disabled'];
  const FLIP_MS = 160; // 4 stepped frames: squash to an edge, swap the face, open again

  class Card {
    constructor(spec) {
      spec = spec || {};
      this.id = spec.id != null ? spec.id : 'c' + Math.random().toString(36).slice(2, 8);
      this.key = spec.key != null ? spec.key : this.id;
      this.data = spec.data;
      this.n = spec.n || 0;
      this.front = spec.front; this.back = spec.back;
      this.labelText = spec.label;
      this.el = h('button', { type: 'button', class: 'agc-card' + (spec.className ? ' ' + spec.className : ''), 'data-id': this.id });
      this.el._agCard = this;
      this.backEl = h('span', { class: 'agc-card__side agc-card__back', 'aria-hidden': 'true' });
      this.frontEl = h('span', { class: 'agc-card__side agc-card__front', 'aria-hidden': 'true' });
      this.el.append(this.backEl, this.frontEl, h('span', { class: 'agc-card__mark', 'aria-hidden': 'true' }));
      this.render();
      this._state = 'hidden';
      this.setState(STATES.includes(spec.state) ? spec.state : 'hidden', { animate: false });
    }
    render() {
      this.backEl.replaceChildren(this.back != null ? face(this.back) : h('span', { class: 'agc-card__pattern' }, '?'));
      this.frontEl.replaceChildren(this.front != null ? face(this.front) : '');
      this.updateLabel();
    }
    setFront(spec) { this.front = spec; this.render(); }
    get state() { return this._state; }
    get label() { return AG.pick(this.labelText) || faceLabel(this.front); }
    updateLabel() {
      const s = this._state;
      this.el.setAttribute('aria-label', s === 'hidden' ? AG.t('cards.facedown', { n: String(this.n + 1) })
        : s === 'matched' ? AG.t('cards.matched', { label: this.label }) : (this.label || AG.t('cards.empty')));
    }
    /** Changes state; hidden ↔ shown plays the flip unless { animate: false } or Reduce Motion. */
    setState(s, opts) {
      if (!STATES.includes(s)) return this;
      const was = this._state, flips = (was === 'hidden') !== (s === 'hidden');
      this._state = s;
      clearTimeout(this._flipT);
      const apply = () => {
        this.el.dataset.state = s;
        this.el.setAttribute('aria-disabled', String(s === 'matched' || s === 'disabled'));
        this.updateLabel();
      };
      if (flips && (!opts || opts.animate !== false) && !AG.reducedMotion()) {
        this.el.classList.remove('agc-flip'); void this.el.offsetWidth; this.el.classList.add('agc-flip');
        this._flipT = setTimeout(apply, FLIP_MS / 2);
        setTimeout(() => this.el.classList.remove('agc-flip'), FLIP_MS + 20);
      } else apply();
      return this;
    }
    reveal(o) { return this.setState('revealed', o); }
    hide(o) { return this.setState('hidden', o); }
    match(o) { this.select(false); return this.setState('matched', o); }
    disable(o) { return this.setState('disabled', o); }
    enable(o) { return this.setState('revealed', o); }
    select(on) { this.el.classList.toggle('is-selected', !!on); this.el.setAttribute('aria-pressed', String(!!on)); return this; }
    get selected() { return this.el.classList.contains('is-selected'); }
  }

  /* ---------- roving focus over a list of buttons, driven by AG.input ---------- */
  /**
   * Arrows move a single tab stop through `items()` laid out `cols()` wide. Active only while
   * focus is inside `el`, or on the game stage itself (the first arrow then enters the grid).
   * Returns { index, focus(i, move?), destroy() }.
   */
  function roving(el, opts) {
    const items = opts.items, cols = opts.cols || (() => items().length);
    const scope = () => opts.stage || el.closest('.ag-stage') || el;
    const r = {
      index: 0, active: true,
      sync() { items().forEach((b, i) => { b.tabIndex = i === r.index ? 0 : -1; }); },
      focus(i, move) {
        const list = items(); if (!list.length) return;
        r.index = AG.util.clamp(i, 0, list.length - 1); r.sync();
        if (move !== false) list[r.index].focus({ preventScroll: false });
        opts.onMove && opts.onMove(r.index);
      },
      owns() {
        const ae = document.activeElement;
        return r.active && el.isConnected && (el.contains(ae) || ae === scope());
      },
      destroy() { offs.forEach(f => f()); el.removeEventListener('keydown', key); el.removeEventListener('focusin', track); }
    };
    const step = (dx, dy) => e => {
      if (e.phase === 'up' || !r.owns()) return;
      const list = items(), c = Math.max(1, cols());
      if (!el.contains(document.activeElement)) { r.focus(r.index); return; }
      let i = r.index;
      if (dx) { const row = Math.floor(i / c), nx = (i % c) + dx; if (nx < 0 || nx >= c) return; i = row * c + nx; }
      if (dy) i += dy * c;
      if (i < 0 || i >= list.length) return;
      r.focus(i);
    };
    const offs = [AG.input.on('LEFT', step(-1, 0)), AG.input.on('RIGHT', step(1, 0)), AG.input.on('UP', step(0, -1)), AG.input.on('DOWN', step(0, 1))];
    if (opts.repeat !== false) ['LEFT', 'RIGHT', 'UP', 'DOWN'].forEach(a => AG.input.repeat(a, { delay: 260, interval: 120 }));
    // Home / End, and Space as a press (the input layer keeps Space from scrolling, which
    // also stops the button's own Space click), handled here so they never double up
    const key = e => {
      const list = items(), i = list.indexOf(e.target);
      if (i < 0) return;
      if (e.key === 'Home') { e.preventDefault(); r.focus(0); }
      else if (e.key === 'End') { e.preventDefault(); r.focus(list.length - 1); }
      else if (e.key === ' ' && !e.repeat) { e.preventDefault(); e.target.click(); }
    };
    const track = e => { const i = items().indexOf(e.target); if (i >= 0 && i !== r.index) { r.index = i; r.sync(); opts.onMove && opts.onMove(i); } };
    el.addEventListener('keydown', key);
    el.addEventListener('focusin', track);
    r.sync();
    return r;
  }

  /* ---------- CardGrid ---------- */
  class CardGrid {
    /**
     * opts: { cards: [Card | Card spec], cols, onSelect(card, index), label, className,
     *         selectable(card) (default: not matched/disabled), stage, sound }
     */
    constructor(opts) {
      this.opts = opts || {};
      this.cols = this.opts.cols || 4;
      this.el = h('div', { class: 'agc-grid' + (this.opts.className ? ' ' + this.opts.className : ''), role: 'group', 'aria-label': AG.pick(this.opts.label) || '' });
      this.setCards(this.opts.cards || []);
      this.nav = roving(this.el, { items: () => this.cards.map(c => c.el), cols: () => this.cols, stage: this.opts.stage, repeat: this.opts.repeat });
      this.onClick = e => {
        const b = e.target.closest('.agc-card'); if (!b || !this.el.contains(b)) return;
        const i = this.cards.findIndex(c => c.el === b); if (i < 0) return;
        this.nav.index = i; this.nav.sync();
        const card = this.cards[i];
        const ok = this.opts.selectable ? this.opts.selectable(card) : card.state !== 'matched' && card.state !== 'disabled';
        if (!ok || AG.paused) return;
        if (this.opts.sound !== false) sfx('tap');
        this.opts.onSelect && this.opts.onSelect(card, i);
      };
      this.el.addEventListener('click', this.onClick);
      this.offLang = AG.on('kalasag:languagechange', () => this.cards.forEach(c => c.render()));
    }
    setCards(list) {
      const hadFocus = this.el.contains(document.activeElement);
      this.cards = list.map((c, i) => { const card = c instanceof Card ? c : new Card(c); card.n = i; card.updateLabel(); return card; });
      this.el.style.setProperty('--cols', this.cols);
      this.el.replaceChildren(...this.cards.map(c => c.el));
      if (this.nav) {
        this.nav.index = Math.min(this.nav.index, Math.max(0, this.cards.length - 1)); this.nav.sync();
        // the old buttons are gone: keep keyboard focus on the same spot, not on <body>
        if (hadFocus && this.cards.length) this.cards[this.nav.index].el.focus({ preventScroll: true });
      }
    }
    setCols(n) { this.cols = n; this.el.style.setProperty('--cols', n); }
    get index() { return this.nav.index; }
    get active() { return this.nav.active; }
    set active(v) { this.nav.active = !!v; }
    focus(i) { this.nav.focus(i == null ? this.nav.index : i); }
    at(x, y) { return this.cards[y * this.cols + x] || null; }
    byId(id) { return this.cards.find(c => c.id === id) || null; }
    destroy() { this.nav.destroy(); this.el.removeEventListener('click', this.onClick); this.offLang(); }
  }

  AG.cards = Object.assign(AG.cards || {}, { face, faceLabel, Card, CardGrid, roving, FLIP_MS });
})(window.AG);
