/* Safe Crossing — a course: the lanes of one level, bottom (Home, lane 0) to top (School).
 * Pure (tested in safe-crossing.test.js).
 *
 *   const course = new AG.safeCrossing.Course(entry)   entry = a levels.json entry or generateDaily()
 *   course.lanes[i]  course.H  course.groups  course.items  course.bridges
 *   course.safe(i)  course.curb(i)  course.groupAt(i)  course.parked(i, col)
 *   course.deck(i, col)  course.stairs(i, col)  course.bridgeAt(i, col)  course.y(i) / course.lane(y)
 *
 * A GROUP is a run of hazard lanes between two safe rows: 'road' (road + parked lanes,
 * sharing one zebra, signal and maybe a footbridge) or 'rail'. Lanes are counted from the
 * bottom; map rows from the top (course.y(i) = H − 1 − i). */
(function (root) {
  const AG = root.AG = root.AG || {};
  const SC = AG.safeCrossing = AG.safeCrossing || {};
  const COLS = 16;

  class Course {
    constructor(entry) {
      const LANES = SC.LANES;
      this.entry = entry || {};
      this.lanes = (entry.lanes || []).map(l => (typeof l === 'string' ? { t: l } : Object.assign({}, l)));
      this.H = this.lanes.length; this.cols = COLS;
      this.items = (entry.items || []).map((it, n) => Object.assign({ n }, it));
      this.bridges = (entry.bridges || []).slice();
      this.lanes.forEach((l, i) => {
        if (!LANES[l.t]) throw new Error('safe-crossing: unknown lane "' + l.t + '" at ' + i);
        l.i = i;
        if (l.t === 'parked') { l.carAt = new Array(COLS).fill(null); (l.cars || []).forEach(([c, kind]) => { const n = SC.tuning.lengths[kind] || 2; for (let k = 0; k < n && c + k < COLS; k++) l.carAt[c + k] = { col: c, kind }; }); }
      });
      // groups
      this.groups = []; this.gOf = new Array(this.H).fill(-1);
      for (let i = 0; i < this.H; i++) {
        const kind = LANES[this.lanes[i].t].group;
        if (!kind) continue;
        let g = this.groups[this.groups.length - 1];
        if (!g || g.end !== i - 1 || g.kind !== kind) { g = { n: this.groups.length, kind, start: i, end: i, zebra: null, signal: null, bridge: null, school: false, parked: [] }; this.groups.push(g); }
        g.end = i;
        this.gOf[i] = g.n;
      }
      for (const g of this.groups) {
        for (let i = g.start; i <= g.end; i++) {
          const l = this.lanes[i];
          if (l.t === 'parked') g.parked.push(i);
          if (l.t !== 'road') continue;
          if (l.z && !g.zebra) g.zebra = l.z.slice();
          if (l.sig && !g.signal) g.signal = Object.assign({}, l.sig);
          if (l.school) g.school = true;
        }
      }
      for (const b of this.bridges) { const g = this.groupAt(b.from + 1); if (g) g.bridge = b; }
    }
    lane(y) { return this.H - 1 - y; }
    y(i) { return this.H - 1 - i; }
    inBounds(i, c) { return i >= 0 && i < this.H && c >= 0 && c < COLS; }
    safe(i) { return i >= 0 && i < this.H && SC.LANES[this.lanes[i].t].safe; }
    groupAt(i) { return i >= 0 && i < this.H && this.gOf[i] >= 0 ? this.groups[this.gOf[i]] : null; }
    /** A safe row with a road group right above or below it. */
    curb(i) {
      if (!this.safe(i)) return false;
      const a = this.groupAt(i + 1), b = this.groupAt(i - 1);
      return !!((a && a.kind === 'road') || (b && b.kind === 'road'));
    }
    /** The road group the player would enter going up from curb i (else down), or null. */
    groupNext(i, dir) { const g = this.groupAt(i + (dir === 'down' ? -1 : 1)); return g; }
    parked(i, c) { const l = this.lanes[i]; return !!(l && l.t === 'parked' && l.carAt[c]); }
    bridgeAt(i, c) { return this.bridges.find(b => b.col === c && i >= b.from && i <= b.to) || null; }
    /** A footbridge deck cell (over the road): you get there only by the stairs. */
    deck(i, c) { const b = this.bridgeAt(i, c); return !!(b && i > b.from && i < b.to); }
    stairs(i, c) { const b = this.bridgeAt(i, c); return !!(b && (i === b.from || i === b.to)); }
    itemsAt(i, c) { return this.items.filter(it => it.i === i && it.col === c); }
    /** Is the zebra (pedestrian lane) at this column in this group? */
    inZebra(g, c) { return !!(g && g.zebra && c >= g.zebra[0] && c <= g.zebra[1]); }
  }

  SC.Course = Course;
  SC.COLS = COLS;
  if (typeof module !== 'undefined') module.exports = Course;
})(typeof window !== 'undefined' ? window : globalThis);
