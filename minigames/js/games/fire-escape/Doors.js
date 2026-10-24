/* Fire Escape Maze — FEEL THE DOOR (World 3+). Pure (no DOM), tested in fire-escape.test.js.
 *
 *   const doors = new AG.fireEscape.Doors(plan.doors)    // [{ x, y, hot }]
 *   doors.at(x, y)        → { x, y, hot, open, felt } or null
 *   doors.blocks(x, y)    → a closed door is a wall until it is opened
 *   doors.feel(door)      → 'hot' | 'cool'   (remembers that it was felt)
 *   doors.open(door)      → 'opened'        felt and cool: it opens
 *                           'hot'           felt and hot: it stays shut ("find another way")
 *                           'unfelt-cool'   opened without feeling: it opens, −1 s
 *                           'unfelt-hot'    opened without feeling and hot: back to the checkpoint, −3 s
 * doors.feltFirst counts the doors opened after being felt (the door-checker badge). */
(function (root) {
  const AG = root.AG = root.AG || {};
  const FE = AG.fireEscape = AG.fireEscape || {};

  class Doors {
    constructor(list) {
      this.map = new Map();
      (list || []).forEach(d => this.map.set(d.x + ',' + d.y, { x: d.x, y: d.y, hot: !!d.hot, open: false, felt: false }));
      this.feltFirst = 0; this.felt = 0;
    }
    at(x, y) { return this.map.get(x + ',' + y) || null; }
    blocks(x, y) { const d = this.at(x, y); return !!d && !d.open; }
    list() { return [...this.map.values()]; }
    feel(d) {
      if (!d.felt) this.felt++;
      d.felt = true;
      return d.hot ? 'hot' : 'cool';
    }
    open(d) {
      if (d.open) return 'opened';
      if (d.felt) {
        if (d.hot) return 'hot';
        d.open = true; this.feltFirst++;
        return 'opened';
      }
      if (d.hot) { d.felt = true; return 'unfelt-hot'; } // now they know: it glows red
      d.open = true;
      return 'unfelt-cool';
    }
  }

  FE.Doors = Doors;
  if (typeof module !== 'undefined') module.exports = Doors;
})(typeof window !== 'undefined' ? window : globalThis);
