/* 06 Rising Water House (rising-water-house): every number, node position and art key in one place. Pure data, no drawing.
 * The rules that use it are in Water.js (water + pure rules), the scene is RisingWaterScene.js, the levels are levels.json and the
 * task list data/tasks.json. House layouts (floors, water lines, prop spots) are the starter file assets/.../data/house_layouts.json. */
(function (root) {
  const AG = root.AG = root.AG || {};
  const RW = AG.risingWater = AG.risingWater || {};
  const K = 'rising-water-house.';

  RW.tuning = {
    id: 'rising-water-house',
    hearts: 3,
    rigH: 36,
    speed: { walk: 80, carry: 60, stairs: 50, lola: 35, evac: { lola: 55, baby: 60, dog: 80, chicken: 70 } },
    peakDepth: 58,                            // px above the ground floor where the flood stops (waist is 44)
    ffMul: 5,                                 // the clock speed-up once nothing is left to do, and when the flood surges at peakMs
    wade: { ms: 3000 },                       // walking in water ≥ ankle with the power on: −1 heart at most every 3 s
    queueMax: 4, bubbleDy: -44, bubbleSize: 22,
    diff: { easy: { water: 0.8, glow: true, evac: 1 }, advanced: { water: 1.3, glow: false, evac: 0.8 } },
    score: { chain: 15, chainCap: 4, evacBase: 300, evacPerSec: 30 },
    stars: {},
    light: { base: 70, flash: 120 },
    /* x of every node (the floor comes from the layout: 'g' ground, 'u' upper). Spaced ≥ 22 px so bubbles do not overlap. */
    nodes: {
      bike: [40, 'g'], yard: [78, 'g'], door: [106, 'g'], breaker: [140, 'g'], tv: [172, 'g'], lola: [198, 'g'], radio: [224, 'g'],
      cabinet: [256, 'g'], drawer: [281, 'g'], jugs: [305, 'g'], ref: [332, 'g'], gobag: [360, 'g'], stair_bottom: [390, 'g'],
      stair_top: [458, 'u'], up_store: [388, 'u'], up_pets: [322, 'u'], bedroom: [250, 'u'], up_mid: [190, 'u'], window: [128, 'u']
    },
    ground: ['bike', 'yard', 'door', 'breaker', 'tv', 'lola', 'radio', 'cabinet', 'drawer', 'jugs', 'ref', 'gobag', 'stair_bottom'],
    upper: ['stair_top', 'up_store', 'up_pets', 'bedroom', 'up_mid', 'window'],
    /* rooms in order: a task in the same or the next / previous room continues a chain */
    rooms: ['yard', 'entry', 'living', 'hall', 'kitchen', 'store', 'landing', 'upper', 'window'],
    roomOf: { bike: 0, yard: 0, door: 1, breaker: 1, tv: 2, lola: 2, radio: 2, cabinet: 3, drawer: 3, jugs: 4, ref: 4, gobag: 5, stair_bottom: 5, stair_top: 6, up_store: 6, up_pets: 7, bedroom: 7, up_mid: 7, window: 8 },
    /* where saved things stand upstairs: x of their left edge */
    stash: { tv: 358, ref: 394, gobag: 424, dog: 300, chicken: 336 },
    carryIcons: { tv: '📺', ref: '📺', gobag: '🎒', pets: '🐔', lola: 'info', docs: '📄' },
    family: {
      lola: { art: K + 'family.lola_2f', w: 28, h: 50, home: 'lola' },
      dog: { art: K + 'family.dog_2f', w: 22, h: 14, home: 'yard' },
      chicken: { art: K + 'family.chicken_2f', w: 12, h: 12, home: 'yard' },
      baby: { art: K + 'family.baby', w: 18, h: 18, home: 'bedroom', frames: 1 }
    },
    art: { houses: { twostory: K + 'house.twostory', stilt: K + 'house.stilt', night: K + 'house.night' }, surface: K + 'water.surface_4f', current: K + 'street_current_4f',
      boat: K + 'boat', outlet: K + 'outlet', breakerOn: K + 'breaker.on', breakerOff: K + 'breaker.off', markers: { outlet: K + 'markers.ankle', knee: K + 'markers.knee', waist: K + 'markers.waist' },
      bike: K + 'prop.bike', props: { tv: 'tv', ref: 'ref', cabinet: 'cabinet', jugs: 'jugs', gobag: 'gobag', radio: 'radio' } },
    sfx: [K + 'sfx.power_off', K + 'sfx.splash', K + 'sfx.task_done', K + 'sfx.warning'],
    badges: { clean: 3 }
  };
  if (typeof module !== 'undefined') module.exports = RW.tuning;
})(typeof window !== 'undefined' ? window : globalThis);
