/* Hazard Symbol Jigsaw: the Sign Album, a sticker book opened from the game's overview ("Sign Album" button,
 * registry overviewExtras → sceneKey SignAlbumScene). One page per category (Chemical, Household, Beach); a sign
 * you have rebuilt is a coloured sticker with its name and meaning, one you have not is a dark silhouette marked
 * "???" (shape and words, never colour alone). The player stands beside the book holding the sign (AGILA's sign
 * frame; the heroes point).
 *
 *   AG.symbolJigsaw.SignAlbumScene.mount(host, { characterId }) → cleanup     (the shell hands it a dialog body)
 * Keys: ←/→ move between stickers (past the page's edge turns the page), ↑/↓ by row, PageUp/PageDown or the ◀ ▶
 * buttons turn pages. Touch: tap a tab or ◀ ▶, or swipe the page. Reads data/signs.json and the album in the
 * stats store (AG.store 'stats'.symbolJigsaw.album: just sign ids, nothing personal). */
window.AG = window.AG || {};
(function (AG) {
  const { h } = AG.util;
  const SJ = AG.symbolJigsaw;
  const K = 'symbol-jigsaw.';
  const pick = v => AG.pick(v);

  const STR = {
    title: { en: 'Sign Album' }, found: { en: '{n} of {total} signs found' },
    cat: { chemical: { en: 'Chemical' }, household: { en: 'Household' }, beach: { en: 'Beach' } },
    page: { en: 'Page {i} of {n}: {name}' }, prev: { en: 'Previous page' }, next: { en: 'Next page' },
    unknown: { en: '???' }, notYetShort: { en: 'Not found yet' }, notYet: { en: 'Not found yet. Rebuild this sign in a level to get its sticker.' },
    tabs: { en: 'Album pages' }, stickers: { en: 'Stickers' }, empty: { en: 'The Sign Album could not load. Try again.' },
    hint: { en: 'Rebuild a sign to stick it in here. ←/→ look around, PageUp / PageDown turn the page.' }
  };

  const CSS = `
#ag-app .sja { display: grid; gap: 10px; width: 100%; color: var(--fg); }
#ag-app .sja-head { display: flex; align-items: flex-end; gap: 10px; }
#ag-app .sja-who { flex: none; width: 72px; height: 76px; overflow: hidden; display: flex; justify-content: center; align-items: flex-start; }
#ag-app .sja-count { flex: 1 1 auto; min-width: 0; display: grid; gap: 4px; }
#ag-app .sja-count h3 { margin: 0; font: 700 1.3rem var(--font-display); }
#ag-app .sja-count p { margin: 0; font-weight: 700; }
#ag-app .sja-tabs { display: flex; flex-wrap: wrap; gap: 6px; }
#ag-app .sja-tab { min-height: 48px; padding: 4px 12px; font: 700 .95rem var(--font-display); color: #1e1538; background: #fffaf0; border: 3px solid #1e1538; cursor: pointer; }
#ag-app .sja-tab[aria-selected="true"] { background: #ffd23f; box-shadow: 3px 3px 0 var(--shadow-c); }
#ag-app .sja-tab[aria-selected="true"]::before { content: "▶ "; }
#ag-app .sja-tab:focus-visible { outline: 3px solid var(--vest); outline-offset: 2px; }
#ag-app .sja-page { position: relative; padding: 14px 6px; color: #1e1538; border: 4px solid #1e1538; box-shadow: 4px 4px 0 var(--shadow-c); background: #ffe3b0 center / 100% 100% no-repeat; image-rendering: pixelated; touch-action: pan-y; }
#ag-app .sja-grid { list-style: none; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px 8px; margin: 0; padding: 0; }
#ag-app .sja-sticker { display: grid; justify-items: center; align-content: start; gap: 4px; padding: 4px; text-align: center; background: none; border: 0; }
#ag-app .sja-sticker:focus { outline: none; }
#ag-app .sja-sticker:focus-visible .sja-frame { outline: 3px solid var(--vest); outline-offset: 3px; }
#ag-app .sja-frame { position: relative; display: grid; place-items: center; width: 128px; height: 128px; background: #fff var(--sja-frame, none) center / 128px 128px no-repeat; image-rendering: pixelated; }
#ag-app .sja-frame img { display: block; width: 120px; height: 120px; image-rendering: pixelated; }
#ag-app .sja-sticker.is-locked .sja-frame img { filter: brightness(0); opacity: .85; }
#ag-app .sja-sticker.is-locked .sja-frame::after { content: "?"; position: absolute; inset: 0; display: grid; place-items: center; font: 900 3rem var(--font-display); color: #fff; text-shadow: 3px 3px 0 #1e1538; }
#ag-app .sja-name { font: 700 1rem/1.2 var(--font-display); }
#ag-app .sja-sticker.is-locked .sja-name { color: #4a4170; }
#ag-app .sja-meaning { font-size: .75rem; line-height: 1.3; font-weight: 700; }
#ag-app .sja-nav { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
#ag-app .sja-nav button { min-width: 48px; min-height: 48px; }
#ag-app .sja-nav span { text-align: center; font-weight: 800; }
#ag-app .sja-hint { margin: 0; text-align: center; font-size: .85rem; font-weight: 700; opacity: .85; }`;
  function injectCss() {
    if (!document.querySelector('style[data-ag-css="symbol-jigsaw-album"]')) document.head.append(h('style', { 'data-ag-css': 'symbol-jigsaw-album' }, CSS));
  }

  const albumOf = () => ((AG.store.get('stats') || {}).symbolJigsaw || {}).album || [];

  class SignAlbum {
    constructor(host, o) {
      injectCss();
      this.host = host; this.o = o; this.signs = o.signs; this.album = o.album || albumOf();
      this.pages = SJ.CATEGORIES.map(c => ({ id: c, signs: this.signs.filter(s => s.category === c) })).filter(p => p.signs.length);
      this.i = 0; this.offs = []; this.cur = 0;
      this.rig = new AG.CharacterRig(null, o.characterId || AG.chars.selected(), 'portrait');
      this.rig.play(AG.chars.get(this.rig.id).agila ? 'hold:sign' : 'point'); // heroes have no sign frame: they point
      const who = h('div', { class: 'sja-who', 'aria-hidden': 'true' }, this.rig.img(1));
      this.count = h('p', {});
      this.bar = AG.kit.meter ? AG.kit.meter({ label: STR.found }) : null;
      this.tabs = h('div', { class: 'sja-tabs', role: 'tablist', 'aria-label': pick(STR.tabs) });
      this.tabBtns = this.pages.map((p, k) => {
        const b = h('button', { type: 'button', class: 'sja-tab', role: 'tab', id: 'sja-tab-' + p.id, 'aria-controls': 'sja-page', 'aria-selected': 'false', tabindex: '-1' });
        this.offs.push(SJ.onPress(b, () => this.turn(k)));
        this.tabs.append(b); return b;
      });
      this.grid = h('ul', { class: 'sja-grid', 'aria-label': pick(STR.stickers) });
      this.pageEl = h('div', { class: 'sja-page', id: 'sja-page', role: 'tabpanel' }, this.grid);
      const frame = AG.assets.url(K + 'ui.sticker_frame'), pageArt = AG.assets.url(K + 'ui.album_page');
      if (frame) this.pageEl.style.setProperty('--sja-frame', 'url("' + frame + '")');
      if (pageArt) this.pageEl.style.backgroundImage = 'url("' + pageArt + '")';
      this.prev = h('button', { type: 'button', class: 'ag-btn ag-btn--alt', 'aria-label': pick(STR.prev) }, '◀');
      this.next = h('button', { type: 'button', class: 'ag-btn ag-btn--alt', 'aria-label': pick(STR.next) }, '▶');
      this.label = h('span', { 'aria-live': 'polite' });
      this.offs.push(SJ.onPress(this.prev, () => this.turn(this.i - 1)), SJ.onPress(this.next, () => this.turn(this.i + 1)));
      this.el = h('section', { class: 'sja', 'aria-label': pick(STR.title) },
        h('div', { class: 'sja-head' }, who, h('div', { class: 'sja-count' }, h('h3', {}, pick(STR.title)), this.count, this.bar ? this.bar.el : null)),
        this.tabs, this.pageEl, h('div', { class: 'sja-nav' }, this.prev, this.label, this.next), h('p', { class: 'sja-hint' }, pick(STR.hint)));
      host.append(this.el);
      this.el.addEventListener('keydown', e => this.key(e));
      this.swipe();
      this.render();
    }

    /** A swipe across the page turns it (touch and pen); a mostly vertical drag still scrolls. */
    swipe() {
      let d = null;
      const down = e => { if (e.pointerType !== 'mouse') d = { x: e.clientX, y: e.clientY, t: performance.now() }; };
      const up = e => {
        const s = d; d = null; if (!s) return;
        const dx = e.clientX - s.x, dy = e.clientY - s.y;
        if (Math.abs(dx) >= 40 && Math.abs(dx) > 2 * Math.abs(dy) && performance.now() - s.t < 600) this.turn(this.i + (dx < 0 ? 1 : -1));
      };
      this.pageEl.addEventListener('pointerdown', down); this.pageEl.addEventListener('pointerup', up); this.pageEl.addEventListener('pointercancel', () => { d = null; });
    }

    page() { return this.pages[this.i]; }
    cols() { const n = getComputedStyle(this.grid).gridTemplateColumns.split(' ').filter(Boolean).length; return n || 2; }
    cells() { return [...this.grid.children]; }

    render(focusAt) {
      const pg = this.page(), have = new Set(this.album);
      const found = this.signs.filter(s => have.has(s.id)).length;
      this.count.textContent = fmt(STR.found, { n: found, total: this.signs.length });
      if (this.bar) this.bar.set(found / this.signs.length);
      this.tabBtns.forEach((b, k) => {
        const p = this.pages[k], n = p.signs.filter(s => have.has(s.id)).length, on = k === this.i;
        b.textContent = pick(STR.cat[p.id]) + ' ' + n + '/' + p.signs.length;
        b.setAttribute('aria-selected', String(on)); b.tabIndex = on ? 0 : -1;
      });
      this.pageEl.setAttribute('aria-labelledby', 'sja-tab-' + pg.id);
      this.grid.replaceChildren(...pg.signs.map(s => this.sticker(s, have.has(s.id))));
      this.cur = AG.util.clamp(focusAt == null ? 0 : focusAt < 0 ? pg.signs.length - 1 : focusAt, 0, pg.signs.length - 1);
      this.rove();
      this.label.textContent = fmt(STR.page, { i: this.i + 1, n: this.pages.length, name: pick(STR.cat[pg.id]) });
      this.prev.disabled = this.i === 0; this.next.disabled = this.i === this.pages.length - 1;
    }
    sticker(s, got) {
      const url = AG.assets.url(s.art) || AG.assets.placeholderURL(s.art, 120, 120);
      const label = got ? pick(s.name) + '. ' + pick(s.meaning) : pick(STR.unknown) + ' ' + pick(STR.notYet);
      const li = h('li', { class: 'sja-sticker' + (got ? '' : ' is-locked'), tabindex: '-1', 'aria-label': label },
        h('span', { class: 'sja-frame', 'aria-hidden': 'true' }, h('img', { class: 'ag-px', src: url, alt: '', width: 120, height: 120, draggable: 'false' })),
        h('b', { class: 'sja-name', 'aria-hidden': 'true' }, got ? pick(s.name) : pick(STR.unknown)),
        h('span', { class: 'sja-meaning', 'aria-hidden': 'true' }, got ? pick(s.meaning) : pick(STR.notYetShort)));
      li.addEventListener('focus', () => { this.cur = this.cells().indexOf(li); this.rove(); });
      li.addEventListener('pointerdown', () => li.focus({ preventScroll: true }));
      return li;
    }
    rove() { this.cells().forEach((c, k) => { c.tabIndex = k === this.cur ? 0 : -1; }); }
    focusCell(k) { const c = this.cells()[k]; if (c) { this.cur = k; this.rove(); c.focus({ preventScroll: false }); } }

    turn(k, focusAt) {
      if (k < 0 || k >= this.pages.length || k === this.i) return;
      this.i = k; this.render(focusAt);
      AG.sfx.play('tap');
    }
    key(e) {
      if (e.target.closest('.sja-tabs')) {
        const j = e.key === 'ArrowRight' ? this.i + 1 : e.key === 'ArrowLeft' ? this.i - 1 : null;
        if (j != null && j >= 0 && j < this.pages.length) { e.preventDefault(); this.turn(j); this.tabBtns[j].focus(); }
        else if (e.key === 'ArrowDown') { e.preventDefault(); this.focusCell(0); }
        return;
      }
      if (!e.target.closest('.sja-grid')) return;
      const n = this.cells().length, c = this.cols(), k = this.cur;
      let to = null;
      if (e.key === 'ArrowRight') { if (k + 1 < n) to = k + 1; else { e.preventDefault(); this.turn(this.i + 1, 0); this.focusCell(0); return; } }
      else if (e.key === 'ArrowLeft') { if (k > 0) to = k - 1; else { e.preventDefault(); const was = this.i; this.turn(this.i - 1, -1); if (was !== this.i) this.focusCell(this.cells().length - 1); return; } }
      else if (e.key === 'ArrowDown') { if (k + c < n) to = k + c; else return; }
      else if (e.key === 'ArrowUp') { if (k - c >= 0) to = k - c; else { e.preventDefault(); this.tabBtns[this.i].focus(); return; } }
      else if (e.key === 'Home') to = 0; else if (e.key === 'End') to = n - 1;
      else if (e.key === 'PageDown') { e.preventDefault(); const was = this.i; this.turn(this.i + 1, 0); if (was !== this.i) this.focusCell(0); return; }
      else if (e.key === 'PageUp') { e.preventDefault(); const was = this.i; this.turn(this.i - 1, 0); if (was !== this.i) this.focusCell(0); return; }
      if (to != null) { e.preventDefault(); this.focusCell(to); AG.sfx.play('tap'); }
    }
    focus() { this.focusCell(0); }
    destroy() { this.offs.forEach(f => f()); this.offs = []; this.el.remove(); }
  }
  const fmt = (t, vars) => pick(t).replace(/\{(\w+)\}/g, (_, k) => (vars[k] == null ? '' : vars[k]));

  SJ.SignAlbumScene = {
    /** The shell's extras dialog calls this with its body element; returns the cleanup. */
    mount(host, info) {
      injectCss();
      const box = h('div', { class: 'sja-load' });
      host.append(box);
      let album = null, dead = false;
      Promise.all([AG.assets.ready(), AG.data.load('symbol-jigsaw', 'data/signs.json')])
        .then(([, signs]) => { if (dead) return; box.remove(); album = new SignAlbum(host, { signs, characterId: info && info.characterId }); album.focus(); })
        .catch(err => { console.error(err); box.textContent = pick(STR.empty); });
      return () => { dead = true; if (album) album.destroy(); box.remove(); };
    },
    SignAlbum
  };
})(window.AG);
