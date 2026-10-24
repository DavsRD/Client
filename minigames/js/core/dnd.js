/* One gesture, two ways to do it: drag a thing onto a target, or tap the thing
 * and then tap the target. Every drag game uses it (the pieces and cards engines build
 * on it), so they all behave the same: mouse, touch, and Enter on the keyboard. */
window.AG = window.AG || {};
(function (AG) {
  AG.dnd = function (opts) {
    // opts: { root, items: () => [el], targets: () => [el], ghostSrc(el), onDrop(itemEl, targetEl), onSelect(itemEl|null) }
    let sel = null, drag = null;
    const select = el => {
      if (sel) sel.classList.remove('sel');
      sel = el; if (sel) sel.classList.add('sel');
      opts.onSelect && opts.onSelect(sel);
    };
    const targetAt = (x, y) => opts.targets().find(t => { const r = t.getBoundingClientRect(); return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom; });

    function down(e) {
      const it = e.target.closest('[data-dnd-item]');
      if (!it || !opts.root.contains(it) || it.classList.contains('gone') || it.classList.contains('done')) return;
      drag = { el: it, x: e.clientX, y: e.clientY, moved: false, id: e.pointerId };
    }
    function move(e) {
      if (!drag || e.pointerId !== drag.id) return;
      if (!drag.moved && Math.hypot(e.clientX - drag.x, e.clientY - drag.y) > 8) {
        drag.moved = true; drag.el.classList.add('dragging');
        const src = opts.ghostSrc ? opts.ghostSrc(drag.el) : null;
        // the ghost lives inside #ag-app so the scoped arcade CSS applies to it
        if (src) { drag.ghost = AG.util.h('img', { class: 'ag-ghost ag-px', src, alt: '' }); (opts.root.closest('#ag-app') || document.body).append(drag.ghost); }
      }
      if (drag.moved) {
        e.preventDefault();
        if (drag.ghost) { drag.ghost.style.left = e.clientX + 'px'; drag.ghost.style.top = e.clientY + 'px'; }
        const t = targetAt(e.clientX, e.clientY);
        opts.targets().forEach(x => x.classList.toggle('hot', x === t));
      }
    }
    function up(e) {
      if (!drag || e.pointerId !== drag.id) return;
      const d = drag; drag = null;
      d.el.classList.remove('dragging'); if (d.ghost) d.ghost.remove();
      opts.targets().forEach(x => x.classList.remove('hot'));
      if (d.moved) { const t = targetAt(e.clientX, e.clientY); if (t) { select(null); opts.onDrop(d.el, t); } }
      else { select(sel === d.el ? null : d.el); AG.sfx.play('tap'); }
    }
    function click(e) {
      const t = e.target.closest('[data-dnd-target]');
      if (t && sel && opts.root.contains(t)) { const it = sel; select(null); opts.onDrop(it, t); }
    }
    function key(e) {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      const it = e.target.closest('[data-dnd-item]'), t = e.target.closest('[data-dnd-target]');
      if (it) { e.preventDefault(); select(sel === it ? null : it); }
      else if (t && sel) { e.preventDefault(); const s = sel; select(null); opts.onDrop(s, t); }
    }
    opts.root.addEventListener('pointerdown', down);
    window.addEventListener('pointermove', move, { passive: false });
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    opts.root.addEventListener('click', click);
    opts.root.addEventListener('keydown', key);
    return {
      selected: () => sel, clear: () => select(null),
      destroy() {
        opts.root.removeEventListener('pointerdown', down); window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up);
        opts.root.removeEventListener('click', click); opts.root.removeEventListener('keydown', key);
        if (drag && drag.ghost) drag.ghost.remove();
      }
    };
  };
})(window.AG);
