/* Safe Crossing — parked vehicles hide the traffic behind them. Pure (tested in
 * safe-crossing.test.js).
 *
 *   AG.safeCrossing.occlusion.mask(course, playerLane, playerCol) → null | { lanes: Set, col }
 *   AG.safeCrossing.occlusion.visible(mask, laneIndex, x0, x1) → bool
 * When the player stands behind or between parked vehicles (a parked vehicle in their
 * column or the one next to it, in a parked lane at or ahead of them in the same road),
 * the road lanes beyond that parked lane are hidden, except within 1 column of the player.
 * That is the lesson: don't step out from between parked vehicles; cross where you can see
 * (the pedestrian lane is kept clear of parked vehicles). */
(function (root) {
  const AG = root.AG = root.AG || {};
  const SC = AG.safeCrossing = AG.safeCrossing || {};
  const CELL = 30;

  const occlusion = {
    mask(course, pi, pc) {
      // the road group the player is in, or about to enter (from the curb below it)
      const g = course.groupAt(pi) || (course.safe(pi) ? course.groupAt(pi + 1) : null);
      if (!g || g.kind !== 'road' || !g.parked.length) return null;
      const lanes = new Set();
      for (const k of g.parked) {
        if (k < pi) continue; // already past it
        const blocked = [pc - 1, pc, pc + 1].some(c => course.parked(k, c));
        if (!blocked) continue;
        for (let j = k + 1; j <= g.end; j++) if (course.lanes[j].t === 'road') lanes.add(j);
      }
      return lanes.size ? { lanes, col: pc } : null;
    },
    /** Hidden unless some of it is within 1 column of the player. */
    visible(mask, i, x0, x1) {
      if (!mask || !mask.lanes.has(i)) return true;
      const a = (mask.col - 1) * CELL, b = (mask.col + 2) * CELL;
      return x0 < b && x1 > a;
    },
    /** The visible span of a vehicle, for clipped drawing: [x0, x1] or null. */
    clip(mask, i, x0, x1) {
      if (!mask || !mask.lanes.has(i)) return [x0, x1];
      const a = Math.max(x0, (mask.col - 1) * CELL), b = Math.min(x1, (mask.col + 2) * CELL);
      return b > a ? [a, b] : null;
    }
  };

  SC.occlusion = occlusion;
  if (typeof module !== 'undefined') module.exports = occlusion;
})(typeof window !== 'undefined' ? window : globalThis);
