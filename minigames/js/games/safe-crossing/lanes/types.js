/* Safe Crossing — the lane types. Pure (tested in safe-crossing.test.js).
 *
 *   safe rows:  home 🏠 · side (sidewalk) · grass · bike (bike lane) · school 🏫
 *   hazards:    road  { dir: 'L'|'R', speed px/s, mix, gap: [min, max] cells, z?: [c0, c1] zebra,
 *                       sig?: { offset } walk signal, school?: true, stops?: true (jeepneys stop) }
 *               parked { cars: [[col, kind], …] }  parked vehicles hide the road beyond them
 *               rail   { dir, every ms, offset ms }  a train; the barrier is down 3 s before
 * A safe row next to a road is a CURB (drawn as the curb, where the player stops and looks). */
(function (root) {
  const AG = root.AG = root.AG || {};
  const SC = AG.safeCrossing = AG.safeCrossing || {};

  SC.LANES = {
    home: { safe: true, art: 'sidewalk' },
    side: { safe: true, art: 'sidewalk' },
    grass: { safe: true, art: 'grass' },
    bike: { safe: true, art: 'bike' },
    school: { safe: true, art: 'school' },
    road: { safe: false, art: 'road', group: 'road' },
    parked: { safe: false, art: 'road', group: 'road' },
    rail: { safe: false, art: 'rail', group: 'rail' }
  };

  if (typeof module !== 'undefined') module.exports = SC.LANES;
})(typeof window !== 'undefined' ? window : globalThis);
