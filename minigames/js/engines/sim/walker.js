/* E7 SIMULATION ENGINE — Walker: an entity (an AG.CharacterRig in 'side' or 'top' view, or nothing)
 * that walks the cheapest WaypointGraph path at speed px/s, slowed by an edge's mul and by what it
 * carries (carryMods). Re-routing mid-edge turns back when that is cheaper. It is the worker an
 * AG.logic.sim.TaskQueue drives (node, moving, goTo, stop, setCarry, work). Side view: node y = the
 * feet line; top view: the centre. No DOM. Docs: kalasag-dev/minigames/docs/engines/sim.md */
window.AG = window.AG || {};
(function (AG) {
  const S = AG.logic.sim;

  class Walker extends S.Emitter {
    /** o: { graph, node (start id) | x, y, rig?, view?: 'side'|'top', speed: 60, cost(edge)?,
     *       carryMods: { default: 0.75, <name>: factor }, carryIcons: { <name>: icon },
     *       actions: { idle: 'idle', walk: 'walk', work: 'point', carry?: rig action } } */
    constructor(o) {
      super();
      this.o = o; this.graph = o.graph; this.rig = o.rig || null;
      this.view = this.rig ? this.rig.view : (o.view || 'side');
      this.speed = o.speed || 60;
      this.carryMods = Object.assign({ default: 0.75 }, o.carryMods); this.carryIcons = o.carryIcons || {};
      this.actions = Object.assign({ idle: 'idle', walk: 'walk', work: 'point', carry: null }, o.actions);
      const n = o.node != null ? this.graph.node(o.node) : null;
      this.node = n ? n.id : null; this.x = n ? n.x : (o.x || 0); this.y = n ? n.y : (o.y || 0);
      this.seg = null; this.route = []; this.moving = false; this.dest = null; this.carry = null; this.working = null;
      this.syncRig();
    }
    get px() { return Math.round(this.x); }
    get py() { return Math.round(this.y); }
    carryMul() { return this.carry ? (this.carryMods[this.carry] != null ? this.carryMods[this.carry] : this.carryMods.default) : 1; }
    opts() { return this.o.cost ? { cost: this.o.cost } : null; }
    segMul() { return this.seg && this.seg.edge ? this.seg.edge.mul : 1; }

    /** Walks to node id along the cheapest path. → false when there is no way there. */
    goTo(id) {
      const g = this.graph;
      if (!g.node(id)) return false;
      if (!this.seg) {
        let from = this.node;
        if (from == null) { // off the graph: walk straight to the nearest node first
          const near = g.nearest(this.x, this.y);
          if (!near) return false;
          const p = g.path(near.id, id, this.opts());
          if (!p) return false;
          this.seg = { from: null, to: near.id, edge: null, ax: this.x, ay: this.y, bx: near.x, by: near.y, len: Math.hypot(near.x - this.x, near.y - this.y), done: 0 };
          this.route = p.nodes.slice(1);
        } else {
          if (from === id) { this.route = []; this.moving = false; this.dest = id; this.syncRig(); return true; }
          const p = g.path(from, id, this.opts());
          if (!p) return false;
          this.route = p.nodes.slice(2);
          this.startSeg(p.nodes[0], p.nodes[1]);
        }
      } else { // mid-edge: go on, or turn back if that is cheaper
        const s = this.seg, m = this.segMul();
        const pb = g.path(s.to, id, this.opts()), pa = s.from != null ? g.path(s.from, id, this.opts()) : null;
        const cb = pb ? (s.len - s.done) * m + pb.cost : Infinity, ca = pa ? s.done * m + pa.cost : Infinity;
        if (!(Math.min(ca, cb) < Infinity)) return false;
        if (ca < cb) {
          this.seg = { from: s.to, to: s.from, edge: s.edge, ax: s.bx, ay: s.by, bx: s.ax, by: s.ay, len: s.len, done: s.len - s.done };
          this.route = pa.nodes.slice(1);
        } else this.route = pb.nodes.slice(1);
      }
      this.node = null; this.dest = id; this.moving = true;
      this.face(); this.syncRig();
      return true;
    }
    startSeg(from, to) {
      const A = this.graph.node(from), B = this.graph.node(to);
      this.seg = { from, to, edge: this.graph.edge(from, to), ax: A.x, ay: A.y, bx: B.x, by: B.y, len: Math.hypot(B.x - A.x, B.y - A.y), done: 0 };
      this.face();
    }
    /** Stops where it is (mid-edge is fine: the next goTo carries on from there). */
    stop() { this.moving = false; this.route = []; this.dest = null; if (this.seg && this.seg.done <= 0 && this.seg.from != null) { this.node = this.seg.from; this.seg = null; } this.syncRig(); return this; }
    teleport(id) { const n = this.graph.node(id); this.seg = null; this.route = []; this.moving = false; this.node = id; this.x = n.x; this.y = n.y; this.syncRig(); return this; }
    setCarry(name) { this.carry = name || null; this.syncRig(); return this; }
    work(task) { this.working = task || null; this.syncRig(); return this; }

    update(dt) {
      if (!this.moving || !this.seg) return this;
      let step = this.speed * this.carryMul() / this.segMul() * dt;
      while (step > 0 && this.seg) {
        const s = this.seg, left = s.len - s.done;
        if (step < left) { s.done += step; step = 0; break; }
        step -= left; s.done = s.len;
        this.x = s.bx; this.y = s.by; this.node = s.to; this.seg = null;
        this.emit('step', this.node);
        if (this.route.length) { this.startSeg(this.node, this.route.shift()); this.node = null; }
        else { this.moving = false; this.dest = null; this.syncRig(); this.emit('arrive', this.node); return this; }
      }
      if (this.seg) { const s = this.seg, f = s.len ? s.done / s.len : 1; this.x = s.ax + (s.bx - s.ax) * f; this.y = s.ay + (s.by - s.ay) * f; }
      return this;
    }
    face() {
      if (!this.rig || !this.seg) return;
      const dx = this.seg.bx - this.seg.ax, dy = this.seg.by - this.seg.ay;
      if (this.view === 'top') this.rig.setFacing(Math.abs(dx) >= Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : (dy < 0 ? 'up' : 'down'));
      else if (Math.abs(dx) > 0.5) this.rig.setFacing(dx < 0 ? 'left' : 'right');
    }
    syncRig() {
      if (!this.rig) return;
      const A = this.actions, carryAct = this.carry ? (A.carry || 'carry:' + (this.carryIcons[this.carry] || this.carry)) : null;
      let a;
      if (this.moving) a = this.view === 'top' ? A.walk : (carryAct || A.walk);
      else if (this.working) a = this.working.action || A.work;
      else a = this.view === 'top' ? A.idle : (carryAct || A.idle);
      this.rig.play(a);
    }
    /** Side view: feet on y; top view: centred (the carried icon floats above). */
    draw(ctx, t) {
      const x = this.px, y = this.py;
      if (!this.rig) { ctx.fillStyle = '#1e1538'; ctx.fillRect(x - 3, this.view === 'top' ? y - 3 : y - 10, 6, this.view === 'top' ? 6 : 10); return; }
      this.rig.draw(ctx, x, y, t);
      if (this.view === 'top' && this.carry && AG.gfx) AG.gfx.drawIcon(ctx, this.carryIcons[this.carry] || this.carry, x - 9, y - 28, 1);
    }
  }

  AG.sim = AG.sim || {};
  AG.sim.Walker = Walker;
})(window.AG);
