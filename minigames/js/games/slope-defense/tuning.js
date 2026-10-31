/* 04 Slope Defense (slope-defense): every number, option and art key in one place. Pure data, no drawing.
 * The rules and the mud / rain / villager model are in Slope.js (tested without a screen), the phases are BuildPhase.js and RainPhase.js,
 * the scene that joins them is SlopeDefenseScene.js, the five levels are levels.json. Distances are canvas px (480 × 270, 30 px tiles). */
(function (root) {
  const AG = root.AG = root.AG || {};
  const SD = AG.slopeDefense = AG.slopeDefense || {};
  const K = 'slope-defense.';
  const S = en => ({ en });

  SD.tuning = {
    id: 'slope-defense',
    W: 480, H: 270, tile: 30, cols: 16, rows: 9,
    options: [
      { id: 'tree', label: S('Tree'), cost: 20, costLabel: S('20 coins'), art: K + 'def.tree_0' },
      { id: 'vetiver', label: S('Vetiver grass'), cost: 10, costLabel: S('10 coins'), art: K + 'def.vetiver' },
      { id: 'canal', label: S('Drainage canal'), cost: 30, costLabel: S('30 coins'), art: K + 'def.canal' },
      { id: 'wall', label: S('Retaining wall'), cost: 60, costLabel: S('60 coins'), art: K + 'def.wall' }
    ],
    tree: { r: 45, slow: [0.15, 0.25, 0.35], art: [K + 'def.tree_0', K + 'def.tree_1', K + 'def.tree_2'], names: ['sapling', 'young tree', 'full tree'] },
    vetiver: { r: 30, slow: 0.2 },
    canal: { cut: 0.4 },
    wall: { hp: 10, reach: 24, art: [K + 'def.wall', K + 'def.wall_cracked', K + 'def.wall_broken'] },
    /* mud units: px/s, the gap they keep, and how many reach a house before it is muddy; spawn rate per path per second */
    mud: { speed: 15, spacing: 3, rMin: 0.02, rMax: 2, slideSpeed: 70, houseLimit: 3 },
    bands: [0.3, 0.7],                         // rain share where ORANGE and RED begin
    evacMs: 8000,                              // the longest walk to the safe zone
    slideTailMs: 1800,                         // the wave ends this long after the last slide has been resolved
    hit: { r: 14, pad: 8 },                    // a sign or a hidden paw print: the reticle / finger reaches this far
    alert: { add: 20, good: 60 },
    signs: { every: [6000, 10000], startMs: 5000, visible: { easy: 9000, advanced: 6000 }, fadeMs: 700, types: ['crack', 'tilt_tree', 'tilt_post', 'muddy_creek', 'rumble'], reach: [0.25, 0.75], off: 18 },
    diff: {
      easy: { mud: 0.8, spawn: 0.75, budget: 1.3, esc: 1, light: 84, outline: true, signSize: 24 },
      advanced: { mud: 1, spawn: 1, budget: 1, esc: 1.1, light: 64, outline: false, signSize: 16 }
    },
    score: { safe: 100, house: 80, sign: 50, goodCall: 150 },
    reticle: { speed: 150, max: 300, accel: 150, fine: 60 },     // px/s: start, top speed (hold), Shift
    badges: { fullTrees: 20, signs: 50, earlyLevels: 5 },
    art: {
      houses: [K + 'house.ok', K + 'house.muddy'], safe: K + 'safezone', post: K + 'watchpost', path: K + 'path',
      creep: K + 'mud.creep_4f', slide: K + 'mud.slide_4f', villager: K + 'villager_2f', waiting: K + 'villager_waiting',
      rain: [K + 'ui.rain_yellow', K + 'ui.rain_orange', K + 'ui.rain_red'], sign: type => K + 'sign.' + type, map: n => K + 'map.w' + n
    },
    sfx: [K + 'sfx.build', K + 'sfx.report', K + 'sfx.evacuate', K + 'sfx.mud_slide', K + 'sfx.rain_loop']
  };
  if (typeof module !== 'undefined') module.exports = SD.tuning;
})(typeof window !== 'undefined' ? window : globalThis);
