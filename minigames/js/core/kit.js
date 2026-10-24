/* Small shared game pieces (ported from the prototype): decision cards, level banners,
 * score pops, confetti, a press-and-hold button, star rules, a shake — plus a pixel
 * TimerRing and a Meter with colour + shape markers (danger and safe never differ by
 * colour alone). Each game combines these with its own mechanics. Text may be { en, fil }. */
window.AG = window.AG || {};
(function (AG) {
  const { h } = AG.util;

  AG.kit = {
    /**
     * Decision cards. options: [{ text, icon, ok, why }]. onPick(option, index, button).
     * Number keys 1–9 pick a card. Returns { el, btns, lock(), unlock(), mark(i, ok), destroy() }.
     */
    choices(options, onPick, opts) {
      opts = opts || {};
      let locked = false;
      const el = h('div', { class: 'ag-choices' + (opts.compact ? ' compact' : ''), role: 'group', 'aria-label': AG.pick(opts.label) || 'Choices' });
      const btns = options.map((o, i) => {
        const b = h('button', { type: 'button', class: 'ag-choice', 'data-i': i, 'data-ok': o.ok ? '1' : '0' },
          h('span', { class: 'ag-key', 'aria-hidden': 'true' }, String(i + 1)), o.icon ? AG.ui.icon(o.icon, 36) : null, h('span', { class: 'ag-txt' }, AG.pick(o.text)));
        b.addEventListener('click', () => { if (!locked && !b.disabled) onPick(o, i, b); });
        el.append(b); return b;
      });
      const key = e => {
        if (locked || e.target.closest('input,textarea') || !el.isConnected) return;
        const n = parseInt(e.key, 10);
        if (n >= 1 && n <= btns.length && !btns[n - 1].disabled) { e.preventDefault(); onPick(options[n - 1], n - 1, btns[n - 1]); }
      };
      window.addEventListener('keydown', key);
      return {
        el, btns,
        lock() { locked = true; el.classList.add('locked'); },
        unlock() { locked = false; el.classList.remove('locked'); },
        mark(i, ok) { btns[i].classList.add(ok ? 'right' : 'wrong'); if (!ok) btns[i].disabled = true; },
        destroy() { window.removeEventListener('keydown', key); }
      };
    },
    /** A big banner across the stage ("Level 2", "Shaking stopped!"). */
    banner(stage, text, sub, ms) {
      stage.querySelectorAll(':scope > .ag-banner').forEach(n => n.remove());
      const b = h('div', { class: 'ag-banner', role: 'status' }, h('b', {}, AG.pick(text)), sub ? h('small', {}, AG.pick(sub)) : null);
      stage.append(b); setTimeout(() => b.remove(), ms || 1600);
      return b;
    },
    /** Floating "+20" over a point of the stage (x, y in px of the stage box). */
    pop(stage, x, y, text, good) {
      const p = h('span', { class: 'ag-scorepop' + (good === false ? ' bad' : ''), style: { left: x + 'px', top: y + 'px' } }, AG.pick(text));
      stage.append(p); setTimeout(() => p.remove(), 900);
    },
    /** Confetti over the stage (skipped with Reduce Motion). */
    celebrate(stage) {
      if (AG.reducedMotion()) return;
      const box = h('div', { class: 'ag-confetti', 'aria-hidden': 'true' });
      const cols = ['#ffd23f', '#ff6b8b', '#3ec7ff', '#7ee08a', '#ff9f1c', '#c4b5ff'];
      for (let i = 0; i < 46; i++) {
        box.append(h('i', { style: { left: (Math.random() * 100) + '%', background: cols[i % cols.length], animationDelay: (Math.random() * 0.4) + 's', animationDuration: (1 + Math.random() * 0.9) + 's', transform: 'rotate(' + Math.floor(Math.random() * 90) + 'deg)' } }));
      }
      stage.append(box); setTimeout(() => box.remove(), 2400);
    },
    /** Press-and-hold button. onChange(held) when pressed and released (pointer, Space or Enter). */
    holdButton(label, onChange) {
      const b = h('button', { type: 'button', class: 'ag-btn ag-btn--big ag-holdbtn', 'aria-pressed': 'false' }, AG.pick(label));
      let down = false;
      const set = v => { if (down === v) return; down = v; b.setAttribute('aria-pressed', String(v)); b.classList.toggle('held', v); onChange(v); };
      b.addEventListener('pointerdown', e => { e.preventDefault(); b.setPointerCapture && b.setPointerCapture(e.pointerId); set(true); });
      b.addEventListener('pointerup', () => set(false));
      b.addEventListener('pointercancel', () => set(false));
      b.addEventListener('lostpointercapture', () => set(false));
      b.addEventListener('keydown', e => { if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) { e.preventDefault(); set(true); } });
      b.addEventListener('keyup', e => { if (e.key === ' ' || e.key === 'Enter') set(false); });
      return { el: b, held: () => down, release: () => set(false), press: () => set(true) };
    },

    /**
     * A stepped pixel ring that empties over time (e.g. around the HOLD button).
     * AG.kit.timerRing({ size: 70, segments: 24 }) → { el, set(0..1), run(ms, onDone), stop() }
     * Pauses with the game (AG.paused).
     */
    timerRing(opts) {
      opts = opts || {};
      const size = opts.size || 64, segs = opts.segments || 24;
      const cv = h('canvas', { class: 'ag-px ag-timerring', width: size, height: size, 'aria-hidden': 'true' });
      const g = cv.getContext('2d');
      let value = 1, raf = 0;
      const draw = () => {
        g.clearRect(0, 0, size, size);
        const c = size / 2, r = size / 2 - 4, lit = Math.ceil(value * segs);
        for (let i = 0; i < segs; i++) {
          const a = -Math.PI / 2 + (i / segs) * Math.PI * 2;
          g.fillStyle = i < lit ? (value < 0.25 ? '#e0245e' : value < 0.5 ? '#ff7a1a' : '#2f8a4a') : 'rgba(30,21,56,.25)';
          g.fillRect(Math.round(c + Math.cos(a) * r) - 2, Math.round(c + Math.sin(a) * r) - 2, 4, 4);
        }
      };
      draw();
      return {
        el: cv,
        set(v) { value = AG.util.clamp(v, 0, 1); draw(); },
        run(ms, onDone) {
          cancelAnimationFrame(raf);
          let left = ms, last = performance.now();
          const tick = now => {
            if (!AG.paused) left -= now - last;
            last = now; value = Math.max(0, left / ms); draw();
            if (left <= 0) { onDone && onDone(); return; }
            raf = requestAnimationFrame(tick);
          };
          raf = requestAnimationFrame(tick);
        },
        stop() { cancelAnimationFrame(raf); }
      };
    },

    /**
     * A meter with markers that differ by shape as well as colour.
     * AG.kit.meter({ label, markers: [{ at: 0.8, kind: 'danger' }, { at: 0.3, kind: 'safe' }] })
     *   → { el, set(value 0..1) }  The fill turns orange then red past the danger marker.
     */
    meter(opts) {
      opts = opts || {};
      const fill = h('i');
      const marks = (opts.markers || []).map(m => h('span', { class: 'ag-meter__mark ag-meter__mark--' + (m.kind || 'safe'), style: { left: (m.at * 100) + '%' }, title: AG.pick(m.label) || m.kind }, m.kind === 'danger' ? '▲' : '●'));
      const bar = h('div', { class: 'ag-meter ag-meter--marked', role: 'meter', 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-label': AG.pick(opts.label) || '' }, fill, ...marks);
      const danger = (opts.markers || []).find(m => m.kind === 'danger');
      return {
        el: bar,
        set(v) {
          v = AG.util.clamp(v, 0, 1);
          fill.style.width = Math.round(v * 100) + '%'; bar.setAttribute('aria-valuenow', Math.round(v * 100));
          bar.classList.toggle('warn', !!danger && v >= danger.at * 0.8 && v < danger.at);
          bar.classList.toggle('danger', !!danger && v >= danger.at);
        }
      };
    },

    /** Stars from a 0..1 performance ratio. */
    stars(r) { return r >= 0.85 ? 3 : r >= 0.6 ? 2 : 1; },
    /** Shake an element once (skipped with Reduce Motion). */
    shake(el) { if (AG.reducedMotion()) return; el.classList.remove('ag-shake'); void el.offsetWidth; el.classList.add('ag-shake'); }
  };
})(window.AG);
