/* E2 SCENE-TAP ENGINE — HitZones (pure): spots in a scene in NORMALISED coordinates (0..1 of
 * the scene's width and height) as circles, rects or polygons, each carrying its game data,
 * and hitTest with a tolerance in scene pixels. No DOM, so it is tested directly.
 * Docs: kalasag-dev/minigames/docs/engines/scenetap.md
 *
 *   const zones = new AG.logic.HitZones([
 *     { id, shape: 'circle', x, y, r },              // r is a fraction of the scene WIDTH
 *     { id, shape: 'rect', x, y, w, h } | { id, rect: [x, y, w, h] } | { id, zone: [x, y, w, h] } | [x, y, w, h],
 *     { id, shape: 'poly', points: [[x, y], …] | [x0, y0, x1, y1, …] }
 *   ], { w: 800, h: 450 });                            // the scene's size in px
 *   zones.hitTest({ x: 0.5, y: 0.4 }, 6) → zone | null    zones.hitAll(p, 6) → [{ zone, dist }] nearest first
 *   zone → { id, shape, x, y, w, h, r, points, label, enabled, data }   (data = spec.data, else the spec)
 * A point inside a zone is distance 0. The nearest zone within the tolerance wins; on a tie
 * (e.g. a small zone inside a big one) the smaller zone wins. Zones with enabled: false are
 * skipped. */
(function (root) {
  const AG = root.AG = root.AG || {};
  const ARR = v => Array.isArray(v) && v.length === 4 && v.every(n => typeof n === 'number');

  /** Any accepted spec → a zone object (the spec is kept as data unless it has its own). */
  function zone(spec, i) {
    const s = ARR(spec) ? { rect: spec } : spec || {};
    let shape = s.shape === 'polygon' ? 'poly' : s.shape;
    if (!shape) shape = s.points ? 'poly' : s.r != null ? 'circle' : 'rect';
    const z = { id: s.id != null ? s.id : 'z' + (i || 0), shape, label: s.label, enabled: s.enabled !== false, data: s.data !== undefined ? s.data : spec };
    if (shape === 'circle') Object.assign(z, { x: +s.x, y: +s.y, r: +s.r });
    else if (shape === 'poly') {
      const p = s.points || [];
      z.points = typeof p[0] === 'number' ? p.reduce((out, v, j) => (j % 2 ? out[out.length - 1].push(v) : out.push([v]), out), []) : p.map(q => [+q[0], +q[1]]);
    } else {
      const r = ARR(s.rect) ? s.rect : ARR(s.zone) ? s.zone : [s.x, s.y, s.w, s.h];
      Object.assign(z, { shape: 'rect', x: +r[0], y: +r[1], w: +r[2], h: +r[3] });
    }
    return z;
  }

  /** Distance in scene px from (px, py) (scene px) to the zone; 0 inside or on the edge. */
  function distance(z, px, py, W, H) {
    if (z.shape === 'circle') return Math.max(0, Math.hypot(px - z.x * W, py - z.y * H) - z.r * W);
    if (z.shape === 'rect') {
      const x0 = z.x * W, y0 = z.y * H, x1 = x0 + z.w * W, y1 = y0 + z.h * H;
      return Math.hypot(Math.max(x0 - px, 0, px - x1), Math.max(y0 - py, 0, py - y1));
    }
    const pts = z.points.map(p => [p[0] * W, p[1] * H]);
    let inside = false, best = Infinity;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const [xi, yi] = pts[i], [xj, yj] = pts[j];
      if ((yi > py) !== (yj > py) && px < (xj - xi) * (py - yi) / (yj - yi) + xi) inside = !inside;
      best = Math.min(best, segDist(px, py, xi, yi, xj, yj));
    }
    return inside || best < 1e-9 ? 0 : best;
  }
  function segDist(px, py, ax, ay, bx, by) {
    const dx = bx - ax, dy = by - ay, L = dx * dx + dy * dy;
    const t = L ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / L)) : 0;
    return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
  }

  /** Area in scene px² (breaks ties between nested zones). */
  function area(z, W, H) {
    if (z.shape === 'circle') return Math.PI * (z.r * W) ** 2;
    if (z.shape === 'rect') return z.w * W * z.h * H;
    let a = 0;
    z.points.forEach((p, i) => { const q = z.points[(i + 1) % z.points.length]; a += p[0] * W * q[1] * H - q[0] * W * p[1] * H; });
    return Math.abs(a) / 2;
  }
  /** Normalised bounding box { x, y, w, h }. */
  function bounds(z, W, H) {
    if (z.shape === 'circle') { const ry = z.r * W / H; return { x: z.x - z.r, y: z.y - ry, w: 2 * z.r, h: 2 * ry }; }
    if (z.shape === 'rect') return { x: z.x, y: z.y, w: z.w, h: z.h };
    const xs = z.points.map(p => p[0]), ys = z.points.map(p => p[1]);
    const x = Math.min(...xs), y = Math.min(...ys);
    return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
  }
  /** Normalised centre (polygons: the middle of the bounding box). */
  function centre(z, W, H) {
    if (z.shape === 'circle') return { x: z.x, y: z.y };
    const b = bounds(z, W, H);
    return { x: b.x + b.w / 2, y: b.y + b.h / 2 };
  }

  class HitZones {
    constructor(list, size) {
      size = size || {};
      this.w = size.w || 1; this.h = size.h || 1;
      this.list = (list || []).map((s, i) => zone(s, i));
    }
    get zones() { return this.list; }
    get length() { return this.list.length; }
    get(id) { return this.list.find(z => z.id === id) || null; }
    add(spec) { const z = zone(spec, this.list.length); this.list.push(z); return z; }
    remove(id) { this.list = this.list.filter(z => z.id !== id); }
    enable(id, on) { const z = this.get(id); if (z) z.enabled = on !== false; return z; }
    distance(z, p) { return distance(z, p.x * this.w, p.y * this.h, this.w, this.h); }
    area(z) { return area(z, this.w, this.h); }
    bounds(z) { return bounds(z, this.w, this.h); }
    centre(z) { return centre(z, this.w, this.h); }
    /** Every enabled zone within tol scene px of the normalised point p, nearest first. */
    hitAll(p, tol, list) {
      tol = Math.max(0, tol || 0);
      return (list || this.list).filter(z => z.enabled)
        .map(z => ({ zone: z, dist: this.distance(z, p), area: this.area(z) }))
        .filter(o => o.dist <= tol + 1e-6) // normalised round trips leave ~1e-13 px of float noise
        .sort((a, b) => a.dist - b.dist || a.area - b.area)
        .map(o => ({ zone: o.zone, dist: o.dist }));
    }
    hitTest(p, tol, list) { const all = this.hitAll(p, tol, list); return all.length ? all[0].zone : null; }
  }

  AG.logic = AG.logic || {};
  AG.logic.HitZones = HitZones;
  AG.logic.sceneZones = { zone, distance, area, bounds, centre, HitZones };
  if (typeof module !== 'undefined') module.exports = AG.logic.sceneZones;
})(typeof window !== 'undefined' ? window : globalThis);
