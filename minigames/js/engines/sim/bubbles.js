/* E7 SIMULATION ENGINE — TaskBubbles: the task bubbles over WaypointGraph nodes for a TaskQueue.
 * Offered tasks show a dashed bubble; queued ones their place in line (1, 2, 3…); the task being
 * worked on gets a pixel progress ring; a carried task rides above the walker. Touch: tap a bubble to
 * queue it, tap a queued one to cancel. Keys: arrows move the highlight, Enter queues / cancels,
 * Backspace cancels the last one added. Needs AG.input.setView(view) for taps. Docs: docs/engines/sim.md */
window.AG = window.AG || {};
(function (AG) {
  const S = AG.logic.sim;
  const DIRS = { UP: 'up', DOWN: 'down', LEFT: 'left', RIGHT: 'right' };

  class TaskBubbles extends S.Emitter {
    /** o: { queue, graph, offers: [task] | () => [task], dy: -36, size: 22, hitPad: 8, input: true,
     *       icon(task) → icon name (default task.icon), art(task) → asset key, ring: { color } } */
    constructor(o) {
      super();
      this.o = o; this.queue = o.queue; this.graph = o.graph;
      this.dy = o.dy == null ? -36 : o.dy; this.size = o.size || 22; this.hitPad = o.hitPad == null ? 8 : o.hitPad;
      this.sel = 0; this.boxes = []; this.offs = [];
      if (o.input !== false && AG.input) this.bind();
    }
    offers() { const f = this.o.offers; return (typeof f === 'function' ? f() : f) || []; }
    /** Offers plus queued tasks that are not offered (added by the game), each with its bubble point;
     *  bubbles on the same node sit side by side (so arrows can reach each one). */
    items() {
      const offers = this.offers(), ids = new Set(offers.map(t => t.id));
      const all = offers.concat(this.queue.items.filter(t => !ids.has(t.id))), per = new Map();
      all.forEach(t => per.set(t.nodeId, (per.get(t.nodeId) || 0) + 1));
      const seen = new Map();
      return all.map(t => {
        const n = this.graph.node(t.nodeId), k = seen.get(t.nodeId) || 0, of = per.get(t.nodeId);
        seen.set(t.nodeId, k + 1);
        return { t, x: (n ? n.x : 0) + (k - (of - 1) / 2) * (this.size + 6), y: (n ? n.y : 0) + this.dy };
      });
    }
    get selected() { const it = this.items(); return it.length ? it[Math.min(this.sel, it.length - 1)].t : null; }
    move(dir) {
      const it = this.items();
      if (!it.length) return;
      const j = S.nearestInDirection(it, Math.min(this.sel, it.length - 1), dir);
      if (j >= 0) { this.sel = j; this.emit('select', it[j].t); }
    }
    /** Queues an offered task, or cancels it if it is already queued. */
    toggle(task) {
      if (!task) return false;
      if (this.queue.has(task.id)) { this.queue.cancel(task.id); return false; }
      return this.queue.add(task);
    }
    bind() {
      Object.keys(DIRS).forEach(a => this.offs.push(AG.input.on(a, e => { if (e.phase !== 'up') this.move(DIRS[a]); })));
      this.offs.push(AG.input.on('CONFIRM', e => { if (e.phase === 'down') this.toggle(this.selected); }));
      this.offs.push(AG.input.on('UNDO', e => { if (e.phase === 'down') this.queue.cancelLast(); }));
      this.offs.push(AG.input.onPointer('tap', p => { const i = this.hit(p.x, p.y); if (i >= 0) { this.sel = i; this.toggle(this.items()[i].t); } }));
    }
    /** Index (in items()) of the bubble at canvas x, y (boxes padded by hitPad for fingers), or -1. */
    hit(x, y) {
      let best = -1, bd = Infinity;
      this.boxes.forEach((b, i) => {
        const p = this.hitPad;
        if (x < b.x - p || y < b.y - p || x > b.x + b.w + p || y > b.y + b.h + p) return;
        const d = (x - b.x - b.w / 2) ** 2 + (y - b.y - b.h / 2) ** 2;
        if (d < bd) { bd = d; best = i; }
      });
      return best;
    }
    draw(ctx, t) {
      const q = this.queue, D = AG.sim.draw, it = this.items(), w = q.walker;
      const keys = AG.input && AG.input.lastDevice === 'keyboard';
      this.sel = Math.min(this.sel, Math.max(0, it.length - 1));
      this.boxes = it.map((item, i) => {
        const task = item.t, k = q.indexOf(task.id), cur = q.current && q.current.id === task.id;
        const carried = cur && q.phase === 'deliver' && w;
        const x = carried ? w.px : item.x, y = carried ? w.py + this.dy : item.y;
        const look = { icon: this.o.icon ? this.o.icon(task) : task.icon, art: this.o.art ? this.o.art(task) : task.art, size: this.size, highlight: keys && i === this.sel };
        if (k < 0) Object.assign(look, { dashed: true, dim: q.full || !q.ready(task) });
        else Object.assign(look, { badge: k + 1, badgeFill: cur ? '#7ee08a' : '#ffd23f', dim: !cur && !q.ready(task) });
        const box = D.bubble(ctx, x, y, look);
        if (cur && (q.phase === 'work' || carried)) D.ring(ctx, box.x + box.w / 2, box.y + this.size / 2, this.size / 2 + 5, carried ? 1 : q.current.progress, (this.o.ring || {}));
        return box;
      });
    }
    destroy() { this.offs.forEach(f => f()); this.offs = []; }
  }

  AG.sim = AG.sim || {};
  AG.sim.TaskBubbles = TaskBubbles;
})(window.AG);
