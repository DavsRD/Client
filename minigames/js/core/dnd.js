/* One gesture, two ways to do it: drag a thing onto a target, or tap the thing
 * and then tap the target. Every drag game uses it (the pieces and cards engines build
 * on it), so they all behave the same: mouse, touch, and Enter on the keyboard. */
window.AG = window.AG || {};
(function (AG) {
  AG.dnd = function (opts) {
    // opts: { root, items: () => [el], targets: () => [el], ghostSrc(el), onDrop(itemEl, targetEl, info), onSelect(itemEl|null) }
    // optional (the pieces engine): onTap(itemEl, info) → true skips the select toggle, and taps (items and targets) are then
    //   taken on pointerup, never from click; canDrag(itemEl, { dx, dy, pointerType }) → false gives the gesture up (a shelf
    //   scrolls instead); onDragStart / onDragMove(itemEl, info);
    //   onMiss(itemEl, info) for a drag let go over no target; keys: false leaves Enter / Space to the caller.
    //   info = { x, y (client px), target, via: 'drag' | 'tap' | 'key', event }
    let sel = null, drag = null;
    const select = el => {
      if (sel) sel.classList.remove('sel');
      sel = el; if (sel) sel.classList.add('sel');
      opts.onSelect && opts.onSelect(sel);
    };
    const targetAt = (x, y) => opts.targets().find(t => { const r = t.getBoundingClientRect(); return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom; });
    const info = (e, target, via) => ({ x: e.clientX, y: e.clientY, target: target || null, via, event: e });

    // with onTap, a tap on a target is taken on pointerup: after a touch drag, the browser can drop the next tap's click
    let tdown = null;
    function down(e) {
      if (e.button > 0) return;
      const it = e.target.closest('[data-dnd-item]');
      if (opts.onTap && !it) { const t = e.target.closest('[data-dnd-target]'); tdown = t && opts.root.contains(t) ? { t, x: e.clientX, y: e.clientY, id: e.pointerId } : null; }
      if (!it || !opts.root.contains(it) || it.classList.contains('gone') || it.classList.contains('done')) return;
      drag = { el: it, x: e.clientX, y: e.clientY, moved: false, id: e.pointerId };
    }
    function tapUp(e) {
      const d = tdown; tdown = null;
      if (!d || e.pointerId !== d.id || e.type === 'pointercancel' || Math.hypot(e.clientX - d.x, e.clientY - d.y) >= 10) return;
      if (sel) { const it = sel; select(null); opts.onDrop(it, d.t, info(e, d.t, 'tap')); }
    }
    function move(e) {
      if (!drag || e.pointerId !== drag.id) return;
      if (!drag.moved && Math.hypot(e.clientX - drag.x, e.clientY - drag.y) > 8) {
        if (opts.canDrag && !opts.canDrag(drag.el, { dx: e.clientX - drag.x, dy: e.clientY - drag.y, x: e.clientX, y: e.clientY, pointerType: e.pointerType, id: e.pointerId })) { drag = null; return; }
        drag.moved = true; drag.el.classList.add('dragging');
        const src = opts.ghostSrc ? opts.ghostSrc(drag.el) : null;
        // the ghost lives inside #ag-app so the scoped arcade CSS applies to it
        if (src) { drag.ghost = AG.util.h('img', { class: 'ag-ghost ag-px', src, alt: '' }); (opts.root.closest('#ag-app') || document.body).append(drag.ghost); }
        if (opts.onDragStart) opts.onDragStart(drag.el, Object.assign(info(e, null, 'drag'), { startX: drag.x, startY: drag.y }));
      }
      if (drag.moved) {
        e.preventDefault();
        if (drag.ghost) { drag.ghost.style.left = e.clientX + 'px'; drag.ghost.style.top = e.clientY + 'px'; }
        const t = targetAt(e.clientX, e.clientY);
        opts.targets().forEach(x => x.classList.toggle('hot', x === t));
        if (opts.onDragMove) opts.onDragMove(drag.el, info(e, t, 'drag'));
      }
    }
    function up(e) {
      if (tdown) tapUp(e);
      if (!drag || e.pointerId !== drag.id) return;
      const d = drag; drag = null;
      d.el.classList.remove('dragging'); if (d.ghost) d.ghost.remove();
      opts.targets().forEach(x => x.classList.remove('hot'));
      if (d.moved) {
        const t = e.type === 'pointercancel' ? null : targetAt(e.clientX, e.clientY);
        if (t) { select(null); opts.onDrop(d.el, t, info(e, t, 'drag')); } else if (opts.onMiss) opts.onMiss(d.el, info(e, null, 'drag'));
      } else if (e.type === 'pointercancel') return; // the browser took the touch (a scroll): not a tap
      else if (opts.onTap && opts.onTap(d.el, info(e, null, 'tap'))) return;
      else { select(sel === d.el ? null : d.el); AG.sfx.play('tap'); }
    }
    function click(e) {
      if (opts.onTap) return; // pointerup already did the work: items in up(), targets in tapUp()
      const t = e.target.closest('[data-dnd-target]');
      if (t && sel && opts.root.contains(t)) { const it = sel; select(null); opts.onDrop(it, t, info(e, t, 'tap')); }
    }
    function key(e) {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      const it = e.target.closest('[data-dnd-item]'), t = e.target.closest('[data-dnd-target]');
      if (it) { e.preventDefault(); select(sel === it ? null : it); }
      else if (t && sel) { e.preventDefault(); const s = sel; select(null); opts.onDrop(s, t, { x: 0, y: 0, target: t, via: 'key', event: e }); }
    }
    opts.root.addEventListener('pointerdown', down);
    window.addEventListener('pointermove', move, { passive: false });
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    opts.root.addEventListener('click', click);
    if (opts.keys !== false) opts.root.addEventListener('keydown', key);
    return {
      selected: () => sel, clear: () => select(null), select,
      dragging: () => !!(drag && drag.moved),
      destroy() {
        opts.root.removeEventListener('pointerdown', down); window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up);
        opts.root.removeEventListener('click', click); opts.root.removeEventListener('keydown', key);
        if (drag && drag.ghost) drag.ghost.remove();
      }
    };
  };
})(window.AG);
