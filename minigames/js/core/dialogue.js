/* READY SQUAD + AGILA — dialogue and word box components (ported from the prototype).
 * Needs: js/data/icons.js, js/data/dialogue-data.js and the rs- rules in minigames/css/ag.css.
 * Text may be a string or { en, fil } (read with AG.pick).
 *
 *   AG.dialogue.box({ speaker: 'medic', text: '**Well done!**', side: 'left', next: true })
 *   AG.dialogue.word({ type: 'warning', text: 'Stay away from **fallen power lines**.' })
 *   AG.dialogue.conversation(el, [{ speaker: 'agila', text: '…' }, { speaker: 'comms', text: '…' }])
 *
 * Both builders return an element you can append anywhere. Boxes size themselves
 * to their container: wide → portrait beside the panel, narrow → stacked. */
window.AG = window.AG || {};
(function (AG) {
  const el = (tag, cls, attrs) => { const n = document.createElement(tag); if (cls) n.className = cls; for (const k in attrs || {}) if (attrs[k] != null) n.setAttribute(k, attrs[k]); return n; };
  const icon = (name, size, alt) => { const i = el('img', 'rs-px', { src: AG.icons.has(name) ? AG.icons.src(name) : AG.pixelIcon('⭐'), alt: alt || '', width: size, height: size }); return i; };
  const reduced = () => AG.reducedMotion();

  /* ---------- text: escape, then **emphasis** and :icon: ---------- */
  function renderText(text, target) {
    const parts = AG.pick(text).split(/(\*\*[^*]+\*\*|:[a-z0-9_]+:)/g);
    for (const part of parts) {
      if (!part) continue;
      const em = part.match(/^\*\*([^*]+)\*\*$/), ic = part.match(/^:([a-z0-9_]+):$/);
      if (em) { const s = el('strong', 'rs-em'); s.textContent = em[1]; target.append(s); }
      else if (ic && AG.icons.has(ic[1])) { target.append(icon(ic[1], 24, '')); target.lastChild.classList.add('rs-ico'); }
      else target.append(document.createTextNode(part));
    }
    return target;
  }
  const plain = text => AG.pick(text).replace(/\*\*([^*]+)\*\*/g, '$1').replace(/:([a-z0-9_]+):/g, '');

  /* ---------- the stepped speech tail, drawn once per colour ---------- */
  const TAIL = ['......k', '....kkf', '..kkfff', 'kkfffff', '..kkfff', '....kkf', '......k'];
  const tails = {};
  function tailSrc(fill, ink) {
    const key = fill + ink; if (tails[key]) return tails[key];
    const cv = document.createElement('canvas'); cv.width = 7; cv.height = 7; const g = cv.getContext('2d');
    TAIL.forEach((row, y) => [...row].forEach((c, x) => { if (c === '.') return; g.fillStyle = c === 'k' ? ink : fill; g.fillRect(x, y, 1, 1); }));
    return (tails[key] = cv.toDataURL());
  }

  /* ---------- typewriter: reveals text, screen readers get it all at once ---------- */
  function typewrite(p, speed, done) {
    if (reduced()) { done && done(); return () => {}; }
    const sr = el('span', 'rs-sr'); sr.textContent = p.textContent;
    const vis = el('span', null, { 'aria-hidden': 'true' }); while (p.firstChild) vis.append(p.firstChild); p.append(sr, vis);
    const nodes = []; const walk = n => n.childNodes.forEach(c => c.nodeType === 3 ? nodes.push([c, c.textContent]) : walk(c)); walk(vis);
    const hiddenImgs = [...vis.querySelectorAll('img')]; hiddenImgs.forEach(i => { i.style.visibility = 'hidden'; });
    nodes.forEach(([n]) => { n.textContent = ''; });
    let i = 0, j = 0, timer = null, finished = false;
    const finish = () => { if (finished) return; finished = true; clearInterval(timer); nodes.forEach(([n, t]) => { n.textContent = t; }); hiddenImgs.forEach(im => { im.style.visibility = ''; }); done && done(); };
    timer = setInterval(() => {
      if (i >= nodes.length) return finish();
      const [n, t] = nodes[i]; j++; n.textContent = t.slice(0, j);
      if (j >= t.length) { i++; j = 0; }
    }, speed || 28);
    return finish;
  }

  function attachNext(root, panel, opts, skip) {
    const next = el('span', 'rs-next', { 'aria-hidden': 'true' }); panel.append(next);
    if (!opts.next) { next.hidden = true; return; }
    if (opts.typewriter) next.hidden = true;
    root.classList.add('rs-clickable'); root.tabIndex = 0;
    root.setAttribute('aria-label', (root.getAttribute('aria-label') || '') + ' ⏎');
    const go = () => { if (skip.typing) { skip.typing(); return; } if (typeof opts.next === 'function') opts.next(); };
    root.addEventListener('click', go);
    root.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } });
    root._showNext = () => { next.hidden = false; };
  }

  /* ---------- sprite framing: whole-number scales only ----------
   * full: squad 100×130 at 2× inside the 168×268 frame (pedestal at the bottom);
   *       AGILA (geared, 40 px) at 4× standing on the CSS pedestal.
   * bust: head and shoulders inside a 128 px (dialogue) or 64 px (word box) frame. */
  function place(img, sp, kind, box) {
    const set = (a, b, c, d, pre) => { img.style.setProperty('--' + pre + 'w', a + 'px'); img.style.setProperty('--' + pre + 'h', b + 'px'); img.style.setProperty('--' + pre + 'x', c + 'px'); img.style.setProperty('--' + pre + 'y', d + 'px'); };
    if (kind === 'full') return sp.agila ? set(160, 160, 4, 70, 'f') : set(200, 260, -16, 2, 'f');
    const size = box || 128;
    if (size === 128) return sp.agila ? set(120, 120, 4, 2, 'b') : set(200, 260, -36, -10, 'b');
    return sp.agila ? set(80, 80, -8, -4, 'b') : set(100, 130, -18, -5, 'b');
  }

  /* ---------- dialogue box with portrait ---------- */
  function box(opts) {
    opts = opts || {};
    const sp = AG.SPEAKERS[opts.speaker] || AG.SPEAKERS.agila;
    const side = opts.side === 'right' ? 'right' : 'left';
    const style = opts.style || 'standard';
    const wrap = el('div', 'rs-dlg-wrap' + (opts.plainFont ? ' rs-plain' : ''));
    const fig = el('figure', 'rs-dlg rs-dlg--' + side + (sp.agila ? ' rs-agila' : ''), { 'data-speaker': opts.speaker || 'agila', 'data-style': style });
    fig.style.setProperty('--rs-role', sp.color);
    // portrait (decorative: the name tag already says who is talking)
    const por = el('div', 'rs-portrait', { 'aria-hidden': 'true' });
    const src = AG.speakerSrc(opts.speaker, style, opts.frame || opts.pose);
    const full = el('img', 'rs-px rs-portrait__full', { src, alt: '' });
    const bust = el('img', 'rs-px rs-portrait__bust', { src, alt: '' });
    place(full, sp, 'full'); place(bust, sp, 'bust');
    if (sp.agila) { // the geared expressions are 38 px tall: keep her feet on the platform
      full.addEventListener('load', () => { const hh = Math.round(full.naturalHeight / full.naturalWidth * 40); full.style.setProperty('--fh', hh * 4 + 'px'); full.style.setProperty('--fy', (230 - hh * 4) + 'px'); });
    }
    por.append(full, bust);
    // speech panel
    const panel = el('div', 'rs-panel rs-bubble');
    const tl = el('img', 'rs-px rs-tail rs-tail--left', { src: tailSrc('#ffffff', '#1a1238'), alt: '', 'aria-hidden': 'true' });
    const tr = el('img', 'rs-px rs-tail rs-tail--right', { src: tailSrc('#ffffff', '#1a1238'), alt: '', 'aria-hidden': 'true' });
    const tu = el('img', 'rs-px rs-tail rs-tail--up', { src: tailSrc('#ffffff', '#1a1238'), alt: '', 'aria-hidden': 'true' });
    const name = el('figcaption', 'rs-name');
    name.append(icon(sp.icon, 22, ''));
    const nm = el('span'); nm.textContent = AG.pick(opts.name) || sp.name; name.append(nm);
    if (opts.pin && AG.icons.has(opts.pin)) { const pi = icon(opts.pin, 18, ''); pi.classList.add('rs-pin'); name.append(pi); }
    const person = opts.person != null ? opts.person : sp.person;
    if (person) { const s = el('small'); s.textContent = '· ' + person; name.append(s); }
    const p = renderText(opts.text, el('p', 'rs-text'));
    panel.append(tl, tr, tu, name, p);
    fig.append(por, panel); wrap.append(fig);
    fig._portrait = full; fig._bust = bust;
    fig.setAttribute('aria-label', (AG.pick(opts.name) || sp.name) + ': ' + plain(opts.text));
    const skip = {};
    attachNext(fig, panel, opts, skip);
    if (opts.typewriter) {
      skip.typing = typewrite(p, opts.speed, () => { skip.typing = null; fig._showNext && fig._showNext(); opts.onTyped && opts.onTyped(); });
    }
    return wrap;
  }

  /* ---------- word box ---------- */
  function word(opts) {
    opts = opts || {};
    const type = AG.WORDBOX[opts.type] ? opts.type : 'info', def = AG.WORDBOX[type];
    const wrap = el('div', 'rs-word-wrap' + (opts.plainFont ? ' rs-plain' : ''));
    const w = el('div', 'rs-panel rs-word rs-word--' + type + (opts.speaker ? ' rs-word--has-who' : ''), { role: def.role, 'data-type': type });
    const badge = el('div', 'rs-word__badge', { 'aria-hidden': 'true' }); badge.append(icon(opts.icon || def.icon, 44, ''));
    const main = el('div', 'rs-word__main');
    if (type === 'congratulations' && opts.stars !== 0) {
      const st = el('div', 'rs-word__stars', { role: 'img', 'aria-label': (opts.stars || 3) + ' stars' });
      for (let i = 0; i < 3; i++) st.append(icon(i < (opts.stars || 3) ? 'star' : 'star_empty', 26, ''));
      main.append(st);
    }
    const title = el('p', 'rs-word__title'); title.textContent = AG.pick(opts.title) || AG.pick(def.label);
    const p = renderText(opts.text, el('p', 'rs-text'));
    main.append(title, p);
    w.append(badge, main);
    if (opts.speaker && AG.SPEAKERS[opts.speaker]) {
      const sp = AG.SPEAKERS[opts.speaker];
      const who = el('span', 'rs-word__who', { role: 'img', 'aria-label': sp.name, title: sp.name });
      const im = el('img', 'rs-px', { src: AG.speakerSrc(opts.speaker, type, opts.frame || opts.pose), alt: '' }); place(im, sp, 'bust', 64);
      who.append(im); w.append(who);
    }
    wrap.append(w);
    const skip = {};
    attachNext(w, w, opts, skip);
    if (opts.typewriter) skip.typing = typewrite(p, opts.speed, () => { skip.typing = null; w._showNext && w._showNext(); });
    return wrap;
  }

  /* ---------- a short scripted exchange, advanced with click / Enter ---------- */
  function conversation(container, lines, opts) {
    opts = opts || {}; let i = 0;
    const show = () => {
      const line = lines[i];
      const isLast = i === lines.length - 1;
      const next = () => { if (isLast) { opts.onDone && opts.onDone(); return; } i++; show(); };
      const node = line.type ? word(Object.assign({ typewriter: opts.typewriter !== false, next }, line)) : box(Object.assign({ typewriter: opts.typewriter !== false, side: line.side || (i % 2 ? 'right' : 'left'), next }, line));
      container.replaceChildren(node);
      const focusable = node.querySelector('.rs-clickable'); if (focusable && opts.focus !== false) focusable.focus({ preventScroll: true });
    };
    show();
    return { goTo(n) { i = Math.max(0, Math.min(lines.length - 1, n)); show(); } };
  }

  /* ---------- message library helpers ---------- */
  const lib = {
    categories: () => Object.keys(AG.MESSAGES),
    messages: cat => (AG.MESSAGES[cat] ? AG.MESSAGES[cat].items.map(m => ({ text: m.text, style: m.style || AG.MESSAGES[cat].style, category: cat })) : []),
    random(cat) { const all = cat ? lib.messages(cat) : lib.categories().flatMap(lib.messages); return all[Math.floor(Math.random() * all.length)]; },
    addMessages(cat, items) {
      if (!AG.MESSAGES[cat]) AG.MESSAGES[cat] = { label: cat, style: 'info', items: [] };
      [].concat(items).forEach(m => AG.MESSAGES[cat].items.push(typeof m === 'string' || m.en ? { text: m } : m));
    },
    addCategory(key, def) { AG.MESSAGES[key] = Object.assign({ label: key, style: 'info', items: [] }, def); }
  };

  AG.dialogue = Object.assign({ box, word, conversation, renderText, plain, tailSrc }, lib);
})(window.AG);
