/* E7 SIMULATION ENGINE — WaypointGraph: named points (rooms, doors, stairs, the yard) joined by
 * edges, with Dijkstra shortest paths. An edge costs its length × mul (mul > 1 = slower ground,
 * e.g. ankle-deep water), so the cheapest path is also the fastest one for an AG.sim.Walker.
 * Edges can be one-way or blocked. Pure (no DOM). Tested in kalasag-dev/minigames/tests/sim.test.js.
 * Docs: kalasag-dev/minigames/docs/engines/sim.md */
(function (root) {
  const AG = root.AG = root.AG || {};
  AG.logic = AG.logic || {};
  const S = AG.logic.sim = AG.logic.sim || {};

  class WaypointGraph {
    /** o: { nodes: [{ id, x, y, tags? }], edges: [[a, b, { mul, oneWay, blocked, length, tags }?] | { a, b, … }] } */
    constructor(o) {
      o = o || {};
      this.nodes = new Map(); this.adj = new Map(); this.edges = [];
      (o.nodes || []).forEach(n => this.addNode(n));
      (o.edges || []).forEach(e => (Array.isArray(e) ? this.addEdge(e[0], e[1], e[2]) : this.addEdge(e.a, e.b, e)));
    }
    addNode(n) {
      const node = Object.assign({ tags: [] }, n);
      this.nodes.set(n.id, node);
      if (!this.adj.has(n.id)) this.adj.set(n.id, []);
      return node;
    }
    node(id) { return this.nodes.get(id) || null; }
    addEdge(a, b, o) {
      o = o || {};
      const A = this.node(a), B = this.node(b);
      if (!A || !B) throw new Error('WaypointGraph: unknown node ' + (A ? b : a));
      const e = { a, b, length: o.length != null ? o.length : Math.hypot(B.x - A.x, B.y - A.y), mul: o.mul || 1, oneWay: !!o.oneWay, blocked: !!o.blocked, tags: o.tags || [] };
      this.edges.push(e);
      this.adj.get(a).push({ to: b, e });
      if (!e.oneWay) this.adj.get(b).push({ to: a, e });
      return e;
    }
    /** The edge between a and b (either way round for two-way edges). */
    edge(a, b) { const l = this.adj.get(a); const hit = l && l.find(x => x.to === b); return hit ? hit.e : null; }
    setEdge(a, b, props) { const e = this.edge(a, b); if (e) Object.assign(e, props); return e; }
    neighbours(id) { return this.adj.get(id) || []; }
    /** The node nearest to x, y (filter(node) optional). */
    nearest(x, y, filter) {
      let best = null, bd = Infinity;
      this.nodes.forEach(n => { if (filter && !filter(n)) return; const d = (n.x - x) * (n.x - x) + (n.y - y) * (n.y - y); if (d < bd) { bd = d; best = n; } });
      return best;
    }
    cost(e, opts) { if (opts && opts.cost) return opts.cost(e); return e.blocked ? Infinity : e.length * e.mul; }

    /** Dijkstra from one node (or several, all at 0). opts: { to, cost(edge) → number (Infinity blocks) }.
     *  → { dist: Map id → cost, prev: Map id → id } */
    dijkstra(from, opts) {
      const dist = new Map(), prev = new Map(), done = new Set(), q = S.heap();
      [].concat(from).forEach(f => { if (this.nodes.has(f)) { dist.set(f, 0); q.push(0, f); } });
      const to = opts && opts.to;
      while (q.size) {
        const id = q.pop();
        if (done.has(id)) continue;
        done.add(id);
        if (id === to) break;
        const d = dist.get(id);
        for (const { to: nb, e } of this.neighbours(id)) {
          const c = this.cost(e, opts);
          if (!(c < Infinity) || done.has(nb)) continue;
          const nd = d + c;
          if (nd < (dist.has(nb) ? dist.get(nb) : Infinity)) { dist.set(nb, nd); prev.set(nb, id); q.push(nd, nb); }
        }
      }
      return { dist, prev };
    }
    /** The cheapest path from → to: { nodes: [ids], points: [{ x, y }], cost, length } or null. */
    path(from, to, opts) {
      if (!this.nodes.has(from) || !this.nodes.has(to)) return null;
      const { dist, prev } = this.dijkstra(from, Object.assign({}, opts, { to }));
      if (!dist.has(to)) return null;
      const nodes = [to];
      while (nodes[0] !== from) nodes.unshift(prev.get(nodes[0]));
      let length = 0;
      for (let i = 1; i < nodes.length; i++) length += this.edge(nodes[i - 1], nodes[i]).length;
      return { nodes, points: nodes.map(id => { const n = this.node(id); return { x: n.x, y: n.y }; }), cost: dist.get(to), length };
    }
  }

  S.WaypointGraph = WaypointGraph;
  if (typeof module !== 'undefined') module.exports = S;
})(typeof window !== 'undefined' ? window : globalThis);
