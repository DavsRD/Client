/* Shared UI building blocks every game uses: icons, stars, hearts, the in-game HUD,
 * event-driven feedback word boxes and stage overlays (ported from the prototype).
 * Text may be a plain string or { en, fil }. Class names carry an "ag-" prefix so the
 * site's own .btn / .card / .chip rules never reach inside #ag-app. */
window.AG = window.AG || {};
(function (AG) {
  const { h } = AG.util;

  AG.ui = {
    h,
    icon(name, size, alt, cls) { return h('img', { class: 'ag-px ' + (cls || ''), src: AG.icons.src(name), alt: alt || '', width: size || 48, height: size || 48, draggable: 'false' }); },
    stars(n, cls) { return h('span', { class: cls || 'ag-stars', role: 'img', 'aria-label': AG.t('map.stars', { n }) }, [0, 1, 2].map(i => AG.ui.icon(i < n ? 'star' : 'star_empty', 18, '', i < n ? 'on' : ''))); },
    hearts(n, max) { return h('span', { class: 'ag-hearts', role: 'img', 'aria-label': n + ' / ' + max }, Array.from({ length: max }, (_, i) => AG.ui.icon(i < n ? 'heart' : 'heart_empty', 24))); },

    /** In-game status bar. Only the parts a game asks for are shown. Labels may be { en, fil }. */
    hud(opts) {
      const root = h('div', { class: 'ag-hud', role: 'status', 'aria-live': 'polite' });
      const parts = {};
      if (opts.hearts) { parts.hearts = h('span'); root.append(parts.hearts); }
      if (opts.score !== undefined) { parts.score = h('b'); root.append(h('span', { class: 'ag-stat' }, h('small', {}, AG.pick(opts.scoreLabel) || AG.t('res.score')), parts.score)); }
      if (opts.label) { parts.label = h('b'); root.append(h('span', { class: 'ag-stat' }, h('small', {}, AG.pick(opts.label)), parts.label)); }
      if (opts.meter) { parts.meter = h('div', { class: 'ag-meter' }, h('i')); root.append(h('div', { class: 'ag-grow' }, parts.meter)); }
      if (opts.timer) { parts.timer = h('b'); root.append(h('span', { class: 'ag-stat' }, h('small', {}, AG.t('res.time')), parts.timer)); }
      return {
        el: root,
        set(v) {
          if (v.hearts !== undefined && parts.hearts) parts.hearts.replaceChildren(AG.ui.hearts(v.hearts, opts.hearts));
          if (v.score !== undefined && parts.score) parts.score.textContent = v.score;
          if (v.label !== undefined && parts.label) parts.label.textContent = AG.pick(v.label);
          if (v.meter !== undefined && parts.meter) { parts.meter.firstChild.style.width = Math.round(AG.util.clamp(v.meter, 0, 1) * 100) + '%'; parts.meter.classList.toggle('warn', !!v.warn); }
          if (v.timer !== undefined && parts.timer) parts.timer.textContent = v.timer;
        }
      };
    },

    /**
     * Event-driven feedback in a READY SQUAD word box. type: success | encouragement |
     * retry | instruction | warning | info | congratulations. Call it only from real game
     * events. In the shell, messages go to the feedback bar under the controls; full-width
     * canvas stages (.flush) show a compact box over the top of the scene instead.
     */
    feedback(stage, text, opts) {
      opts = opts || {};
      if (!stage || !AG.dialogue) return () => {};
      const type = opts.type || 'info';
      const box = AG.dialogue.word({ type, text, title: opts.title, speaker: opts.speaker || AG.chars.selected(), icon: opts.icon, plainFont: AG.store.setting('plainFont') });
      const shell = stage.closest('.ag-shell');
      const bar = !stage.classList.contains('flush') && shell && shell.querySelector('.ag-fbbar');
      let el;
      if (bar) { el = h('div', { class: 'ag-fbmsg', 'data-type': type }, box); bar.replaceChildren(el); bar.setAttribute('aria-live', type === 'warning' ? 'assertive' : 'polite'); }
      else { stage.querySelectorAll(':scope > .ag-fb').forEach(n => n.remove()); el = h('div', { class: 'ag-fb' + (opts.top !== false ? ' top' : ''), 'aria-live': 'polite', 'data-type': type }, box); stage.append(el); }
      stage.dataset.feedback = type; stage.dataset.feedbackText = AG.dialogue.plain(AG.pick(text));
      if (opts.sound !== false) AG.sfx.play(type === 'success' || type === 'congratulations' ? 'good' : type === 'retry' ? 'soft' : type === 'warning' ? 'alarm' : 'blip');
      const len = AG.pick(text).length;
      const t = setTimeout(() => { if (bar) el.classList.add('stale'); else el.remove(); }, opts.ms || Math.min(6500, 1800 + len * 45));
      return () => { clearTimeout(t); el.remove(); };
    },
    /** The prototype's older call style: tone good → success, tip → info. */
    say(stage, text, opts) {
      opts = opts || {};
      return AG.ui.feedback(stage, text, Object.assign({}, opts, { type: opts.type || (opts.tone === 'good' ? 'success' : opts.tone === 'tip' ? 'info' : 'instruction') }));
    },

    /** Full-stage overlay with a message and one button. The character shown is the player's. */
    overlay(stage, { action, title, text, button, onClick, cls }) {
      const btn = h('button', { class: 'ag-btn', type: 'button' }, AG.pick(button) || 'OK');
      const el = h('div', { class: 'ag-overlay ' + (cls || '') }, h('div', { class: 'ag-box' },
        AG.chars.img(AG.chars.selected(), action || 'alert', 1), title ? h('h3', {}, AG.pick(title)) : null, text ? h('p', {}, AG.pick(text)) : null, btn));
      btn.addEventListener('click', () => { onClick && onClick(el, btn); });
      stage.append(el); setTimeout(() => btn.focus(), 50);
      return el;
    },
    fmtTime(s) { s = Math.max(0, Math.ceil(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }
  };
})(window.AG);
